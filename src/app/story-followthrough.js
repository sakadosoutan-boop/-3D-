/* Read-completed evidence and replay mastery live outside old story saves. */
(function(global){
  "use strict";
  const KEY="shinden3d-story-followthrough-v1";
  const clues=[
    {id:"cord",title:"薄紫の紐",seen:["1:seq_002a"],resolved:["6:seq_ed1_wake4"],question:"袖口の紐は、なぜ見覚えがあったのか。",answer:"枕元のノートと隣席の記憶が、小萩の袖口につながった。"},
    {id:"bird",title:"内陸の邸の白い鳥",seen:["1:seq_clear","2:seq_201b2"],resolved:["6:seq_617_ed1_close"],question:"海のない邸に、カモメの声がする。",answer:"海辺の町の窓の外から、現実の声が常世へ届いていた。"},
    {id:"paper",title:"罫線のある短冊",seen:["2:seq_211c"],resolved:["6:seq_ed1_wake4"],question:"夏の短冊に、現代のノートと同じ罫線があった。",answer:"枕元で読まれたノートの記憶が、短冊の姿で入り込んだ。"},
    {id:"reflection",title:"水底の制服",seen:["3:seq_313z2"],resolved:["6:seq_ed1_wake4"],question:"水面には、姫君とは違う横顔が映った。",answer:"常世の役姿だけでは捉えられない、現実の相手への手がかりだった。"}
  ];
  function read(){try{const d=JSON.parse(global.localStorage.getItem(KEY)),obj=v=>v&&typeof v==="object"&&!Array.isArray(v)?v:{};return {read:obj(d&&d.read),mastered:obj(d&&d.mastered),endings:obj(d&&d.endings)};}catch(e){return {read:{},mastered:{},endings:{}};}}
  function update(fn){const d=read();fn(d);try{global.localStorage.setItem(KEY,JSON.stringify(d));}catch(e){}return d;}
  function completed(ch,event){if(event&&event.id)update(d=>{d.read[ch+":"+event.id]=true;});}
  function journal(data){const d=data||read();return clues.filter(c=>c.seen.some(k=>d.read[k])).map(c=>({id:c.id,title:c.title,resolved:c.resolved.some(k=>d.read[k]),text:c.resolved.some(k=>d.read[k])?c.answer:c.question}));}
  function master(group,ids){update(d=>{d.mastered[group]=ids.slice();});}
  function canRecall(group,ids){const m=read().mastered[group];return Array.isArray(m)&&ids.every(id=>m.includes(id));}
  function recordEnding(id,state){update(d=>{d.endings[id]={params:Object.assign({},state.params),flags:Object.assign({},state.routeFlags),choices:(state.history||[]).filter(h=>h.choiceText).map(h=>({chapter:h.chapterId,text:h.choiceText})).slice(-5)};});}
  function endingReview(id){const s=read().endings[id];if(!s)return null;const f=s.flags||{};let reason={ED1_TRUE:"現実へ帰る意志と、この邸で学ぶ心が両立しました。",ED2_NORMAL:"現実への帰路を選びました。相手を知る営みは、まだ先へ続きます。",ED3_GAMEOVER:f.chapter5Lost?"大鬼との試練、または最後の名づけで、帰路が閉じました。":f.chapter4Lost?"歌合で言葉を返しきれず、今宵の灯が消えました。":"言葉の火が消える場面を読み終えました。",ED4_SYNC:"帰路よりも常世に留まる思いが強くなりました。",ED5_SPOOKY:"積み重なった侵食が限界に達しました。"}[id]||"読み終えた結末です。";return {reason,choices:s.choices};}
  function renaiClosures(result){
    const target=result.targetName||"あの方",stats=result.stats||{},choices=[];
    if(result.affection>=15&&stats.modesty>=8)choices.push({id:"trust",label:"恋の返事を急がず、信頼を交わす",title:"言葉を預ける信頼",sent:"「答えを急がせぬことを、これからも約束いたします」",reply:target+"から、短い文が届いた。「ならば、わからぬことも、わからぬまま申せましょう」。二人は願いを叶える約束ではなく、偽らずに話す約束を交わした。"});
    if(result.affection>=15)choices.push({id:"friendship",label:"友として、歌や季節の便りを続ける",title:"友として続く文",sent:"「恋の文とは別に、今日の景色をお知らせしてもよろしいでしょうか」",reply:target+"は「お返しできぬ日もありましょう。それでもよろしければ」と返した。文の数を競う日々は終わる。返事を待てる友として、次の季節を迎えた。"});
    choices.push({id:"farewell",label:"三十日の礼を伝え、別れを受けとめる",title:"返事を求めない別れ",sent:"「お読みくださった日々に、お礼を。これを最後の文にいたします」",reply:result.affection>=15?target+"から、一度だけ礼の文が届いた。引き止める言葉は書かれていない。それぞれの朝へ帰っても、交わした言葉まで消えはしなかった。":"最後の文への返事は、届かなかった。あなたは新しい文を書き足さず、筆を置く。相手の沈黙を自分の答えで埋めぬことも、ここで覚えた礼だった。"});
    return choices;
  }
  function mountRenaiEnding(result){
    const doc=global.document,host=doc&&doc.getElementById("resDetail");if(!host)return;
    const old=doc.getElementById("renaiClosure");if(old)old.remove();
    // Lower scores do not make friendship an inferior romance or demand another attempt.
    if(result.rank==="mid"||result.rank==="bad"){
      host.textContent=result.rank==="mid"?"三十日、文を通じて知り合いました。この縁をどう結ぶか、最後の文を選べます。":"三十日、恋の返事は届きませんでした。相手の気持ちを決めつけず、この日々を結ぶ言葉を選べます。";
      const stats=doc.createElement("p");stats.className="st-renai-stats";stats.textContent="三十日の記録 · 好感度 "+result.affection+" / 慎み "+(result.stats.modesty||0)+" / 文才 "+(result.stats.poetry||0);host.appendChild(stats);
    }
    const wrap=doc.createElement("section");wrap.id="renaiClosure";wrap.className="st-renai-closure";
    const prompt=doc.createElement("p");prompt.textContent="最後の文 — この縁の結び方を選ぶ";wrap.appendChild(prompt);
    renaiClosures(result).forEach(choice=>{
      const button=doc.createElement("button");button.type="button";button.className="st-opt";button.textContent=choice.label;
      button.onclick=()=>{
        // The selected relationship is the ending, so discard the earlier romantic
        // conclusion while retaining every final stat from the thirty-day run.
        const stats=doc.createElement("p"),values=result.stats||{};
        stats.className="st-renai-stats";
        stats.textContent="三十日の記録 · 好感度 "+result.affection+" / "+[["雅","miyabi"],["文才","poetry"],["慎み","modesty"],["評判","reputation"],["薫物","incense"],["装束","fashion"]].map(([label,key])=>label+" "+(values[key]||0)).join(" / ");
        host.replaceChildren(stats,wrap);
        wrap.textContent="";
        const title=doc.createElement("h4");title.textContent=choice.title;wrap.appendChild(title);
        const sent=doc.createElement("p");sent.textContent=choice.sent;wrap.appendChild(sent);
        const reply=doc.createElement("p");reply.textContent=choice.reply;reply.setAttribute("role","status");wrap.appendChild(reply);
        const rank=doc.getElementById("resRank");if(rank)rank.textContent=choice.title;
        update(d=>{d.endings["renai_"+(result.targetId||"unknown")+"_"+choice.id]={read:true};});
        title.tabIndex=-1;title.focus();
      };wrap.appendChild(button);
    });host.appendChild(wrap);
  }
  global.StoryFollowthrough={completed,journal,master,canRecall,recordEnding,endingReview,renaiClosures,mountRenaiEnding};
})(typeof window!=="undefined"?window:globalThis);
