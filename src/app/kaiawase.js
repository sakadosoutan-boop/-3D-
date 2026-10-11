/* ============================================================
   波7: 貝合わせ(かいあわせ) — 神経衰弱型ミニゲーム
   平安の姫君の遊び「貝合わせ」(蛤の殻の内側に絵や歌を描いて対をそろえる遊戯)を、
   div/CSSの独立オーバーレイ(3D世界を完全に覆う。ikaiSuikaと同じ軽量化手法)で再現する。
============================================================ */
/* 各対に平安文化の題材(花鳥風月・和歌の景物)を持たせ、一致時に読み仮名つきの一言解説を出す教育要素 */
const KAI_THEMES=[
  {emoji:"🌸",kanji:"桜",kana:"さくら",lore:"春を彩る花。「久方の光のどけき春の日にしづ心なく花の散るらむ」でも知られる、和歌に最も愛された花。"},
  {emoji:"🐦",kanji:"郭公",kana:"ほととぎす",lore:"夏を告げる鳥。初音を待ちわびる心が『枕草子』をはじめ多くの和歌・物語に描かれた。"},
  {emoji:"🌕",kanji:"月",kana:"つき",lore:"秋の夜を彩る風物。『源氏物語』でも月を眺めて物思う場面がたびたび描かれる。"},
  {emoji:"❄️",kanji:"雪",kana:"ゆき",lore:"冬を彩る風物。雪の朝に文を交わし合う贈答歌が多く残る、清らかさの象徴。"},
  {emoji:"🍁",kanji:"紅葉",kana:"もみじ",lore:"秋の彩り。『源氏物語』紅葉賀の巻では、紅葉の下で舞う場面が華やかに描かれる。"},
  {emoji:"🟣",kanji:"藤",kana:"ふじ",lore:"晩春に咲く花。御簾からこぼれる紫の花房は、藤原氏になぞらえて好んで描かれた。"},
  {emoji:"✨",kanji:"蛍",kana:"ほたる",lore:"夏の夜に光る虫。『源氏物語』蛍の巻で、放たれた光が姫君の姿をほのかに照らす場面が知られる。"},
  {emoji:"🐤",kanji:"千鳥",kana:"ちどり",lore:"冬の水辺に群れ鳴く鳥。その声は和歌にしばしば詠まれ、もの寂しい冬の景物とされた。"},
  {emoji:"🌲",kanji:"松風",kana:"まつかぜ",lore:"松に吹く風の音。『源氏物語』松風の巻にも通じる、静けさと孤独を思わせる響き。"},
  {emoji:"🌼",kanji:"女郎花",kana:"おみなえし",lore:"秋の七草の一つ。可憐な姿がしばしば女性にたとえられ、多くの和歌に詠まれた。"}
];
const KAI_DIFF={easy:{n:6,label:"やさしい"},normal:{n:8,label:"ふつう"},hard:{n:10,label:"むずかしい"}};
const KAI_WAKA_CUES={"桜":["桜","花"],"郭公":["ほととぎす","郭公"],"月":["月","有明"],"雪":["雪","白妙"],"紅葉":["紅葉","もみぢ"],"藤":["藤"],"蛍":["蛍"],"千鳥":["千鳥"],"松風":["松風","松"],"女郎花":["女郎花"]};
let KAI=null,KAI_TIMER=null,kaiLoreTimer=null;
function kaiWakaForTheme(t){
  if(typeof WAKA_DATA==="undefined")return null;
  const cues=KAI_WAKA_CUES[t.kanji]||[t.kanji];
  return WAKA_DATA.find(w=>cues.some(c=>w.poem.includes(c)))||null;
}
function kaiShuffle(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
function kaiLoadBest(){try{return JSON.parse(localStorage.getItem("shinden3d-kaiawase-best")||"{}");}catch(e){return {};}}
function kaiSaveBest(obj){try{localStorage.setItem("shinden3d-kaiawase-best",JSON.stringify(obj));}catch(e){}}
function kaiSeenHelp(){try{return localStorage.getItem("shinden3d-kaiawase-help")==="1";}catch(e){return false;}}
function kaiMarkHelpSeen(){try{localStorage.setItem("shinden3d-kaiawase-help","1");}catch(e){}}
function kaiFormatTime(sec){const s=Math.max(0,Math.floor(sec));const m=Math.floor(s/60),r=s%60;return `${m}:${String(r).padStart(2,"0")}`;}
function kaiUpdateBestDisplay(diffKey){
  const el=$("kaiBest");if(!el)return;
  if(!diffKey){el.textContent="--";return;}
  const best=kaiLoadBest()[diffKey];
  el.textContent=best?`${best.moves}手/${kaiFormatTime(best.time)}`:"--";
}
function startKaiawase(){
  KAI=null;
  if(KAI_TIMER){clearInterval(KAI_TIMER);KAI_TIMER=null;}
  const go=$("kaiGameOver");if(go)go.classList.remove("show");
  const nb=$("kaiNewBest");if(nb)nb.classList.remove("show");
  const board=$("kaiBoard");if(board)board.innerHTML="";
  const mv=$("kaiMoves");if(mv)mv.textContent="0";
  const tm=$("kaiTime");if(tm)tm.textContent="0:00";
  kaiUpdateBestDisplay(null);
  const lore=$("kaiLoreBanner");if(lore){lore.textContent="2枚めくって、同じ絵柄の貝をそろえよう。";lore.classList.remove("hit");}
  const dp=$("kaiDiffPicker");if(dp)dp.classList.add("show");
  const help=$("kaiHelp");if(help)help.classList.toggle("show",!kaiSeenHelp());
  // 3Dシーンはこの間まったく見えないため、影マップ更新を止めて軽量化する(位階出世ゲームと同じ手法)
  renderer.shadowMap.autoUpdate=false;
}
function stopKaiawase(){
  KAI=null;
  if(KAI_TIMER){clearInterval(KAI_TIMER);KAI_TIMER=null;}
  if(kaiLoreTimer){clearTimeout(kaiLoreTimer);kaiLoreTimer=null;}
  renderer.shadowMap.autoUpdate=true;renderer.shadowMap.needsUpdate=true;
  const dp=$("kaiDiffPicker");if(dp)dp.classList.remove("show");
}
function kaiRenderBoard(){
  const board=$("kaiBoard");if(!board||!KAI)return;
  board.innerHTML="";
  const total=KAI.cards.length;
  const cols=total<=12?4:(total<=16?4:5);
  board.style.gridTemplateColumns=`repeat(${cols},1fr)`;
  KAI.cardEls=[];
  KAI.cards.forEach((c,idx)=>{
    const el=document.createElement("div");
    el.className="kai-card";el.dataset.idx=String(idx);
    el.innerHTML=`<div class="kai-card-inner">
      <div class="kai-card-face kai-card-back"></div>
      <div class="kai-card-face kai-card-front">
        <div class="kai-card-emoji">${c.t.emoji}</div>
        <div class="kai-card-kanji">${c.t.kanji}</div>
        <div class="kai-card-kana">${c.t.kana}</div>
      </div>
    </div>`;
    board.appendChild(el);
    KAI.cardEls[idx]=el;
  });
}
function kaiSetFlipped(idx,on){const el=KAI&&KAI.cardEls[idx];if(el)el.classList.toggle("flipped",on);}
function kaiSetMatched(idx){const el=KAI&&KAI.cardEls[idx];if(el){el.classList.add("matched");el.classList.remove("flipped");}}
function kaiChooseDifficulty(diffKey){
  const cfg=KAI_DIFF[diffKey];if(!cfg)return;
  const dp=$("kaiDiffPicker");if(dp)dp.classList.remove("show");
  const themes=kaiShuffle(KAI_THEMES.slice()).slice(0,cfg.n);
  let deck=[];themes.forEach(t=>{deck.push({t,matched:false});deck.push({t,matched:false});});
  deck=kaiShuffle(deck);
  KAI={diff:diffKey,n:cfg.n,cards:deck,flippedIdx:[],matchedCount:0,moves:0,over:false,locked:false,startTs:Date.now(),cardEls:[],learned:[]};
  const mv=$("kaiMoves");if(mv)mv.textContent="0";
  const tm=$("kaiTime");if(tm)tm.textContent="0:00";
  kaiUpdateBestDisplay(diffKey);
  kaiRenderBoard();
  if(KAI_TIMER)clearInterval(KAI_TIMER);
  KAI_TIMER=setInterval(kaiTick,500);
  beep(600,.06);
}
function kaiTick(){
  if(!KAI||KAI.over||typeof APP==="undefined"||APP.mode!=="kaiawase"){if(KAI_TIMER){clearInterval(KAI_TIMER);KAI_TIMER=null;}return;}
  const el=$("kaiTime");if(el)el.textContent=kaiFormatTime((Date.now()-KAI.startTs)/1000);
}
function kaiShowLore(t){
  const el=$("kaiLoreBanner");if(!el)return;
  const waka=kaiWakaForTheme(t);
  const known=waka&&typeof codexUnlocked!=="undefined"&&codexUnlocked.has(waka.id);
  el.textContent=`${t.kanji}(${t.kana}): ${t.lore}${waka?`　和歌の景物「${waka.poem}」（${waka.auth}）${known?"・収集済み":"・散策で探せる"}`:""}`;
  if(KAI&&!KAI.learned.some(v=>v.kanji===t.kanji))KAI.learned.push({kanji:t.kanji,waka});
  el.classList.add("hit");
  if(kaiLoreTimer)clearTimeout(kaiLoreTimer);
  kaiLoreTimer=setTimeout(()=>{el.classList.remove("hit");el.textContent="2枚めくって、同じ絵柄の貝をそろえよう。";},6000);
}
function kaiOnCardClick(idx){
  if(!KAI||KAI.over||KAI.locked)return;
  const card=KAI.cards[idx];if(!card||card.matched)return;
  if(KAI.flippedIdx.includes(idx))return;
  if(KAI.flippedIdx.length>=2)return;
  KAI.flippedIdx.push(idx);
  kaiSetFlipped(idx,true);
  beep(520,.04,"sine",.05);
  if(KAI.flippedIdx.length===2){
    KAI.moves++;const mv=$("kaiMoves");if(mv)mv.textContent=String(KAI.moves);
    KAI.locked=true;
    const [i1,i2]=KAI.flippedIdx;
    const match=KAI.cards[i1].t===KAI.cards[i2].t;
    if(match){
      setTimeout(()=>{
        if(!KAI)return;
        KAI.cards[i1].matched=true;KAI.cards[i2].matched=true;
        kaiSetMatched(i1);kaiSetMatched(i2);
        KAI.matchedCount++;KAI.flippedIdx=[];KAI.locked=false;
        seOK();
        kaiShowLore(KAI.cards[i1].t);
        if(KAI.matchedCount>=KAI.n)kaiWin();
      },420);
    }else{
      setTimeout(()=>{
        if(!KAI)return;
        kaiSetFlipped(i1,false);kaiSetFlipped(i2,false);
        KAI.flippedIdx=[];KAI.locked=false;
        seNG();
      },780);
    }
  }
}
function kaiWin(){
  const S=KAI;if(!S||S.over)return;S.over=true;
  if(KAI_TIMER){clearInterval(KAI_TIMER);KAI_TIMER=null;}
  const elapsed=(Date.now()-S.startTs)/1000;
  const bestAll=kaiLoadBest();
  const prev=bestAll[S.diff];
  const isNewBest=!prev||S.moves<prev.moves||(S.moves===prev.moves&&elapsed<prev.time);
  if(isNewBest){bestAll[S.diff]={moves:S.moves,time:elapsed};kaiSaveBest(bestAll);}
  kaiUpdateBestDisplay(S.diff);
  const bestNow=bestAll[S.diff];
  const el=$("kaiGoDetail");
  if(el)el.innerHTML=`難度: <b>${KAI_DIFF[S.diff].label}</b><br>手数: <b>${S.moves}手</b><br>時間: <b>${kaiFormatTime(elapsed)}</b><br>自己最高: <b>${bestNow.moves}手/${kaiFormatTime(bestNow.time)}</b><br>覚えた景物: ${S.learned.map(v=>v.kanji+(v.waka?"（和歌）":"")).join("・")}`;
  const nb=$("kaiNewBest");if(nb)nb.classList.toggle("show",isNewBest);
  const go=$("kaiGameOver");if(go)go.classList.add("show");
  seOK();
  if(isNewBest&&typeof juiceCelebrate==="function")juiceCelebrate(); // 新記録は紙吹雪で祝う
  recordProgress("kaiawase",1);gainParam("miyabi",2);
}
(function bindKaiInput(){
  const board=$("kaiBoard");if(!board)return;
  board.addEventListener("click",e=>{
    if(typeof APP==="undefined"||APP.mode!=="kaiawase")return;
    const el=e.target.closest(".kai-card");if(!el)return;
    kaiOnCardClick(parseInt(el.dataset.idx,10));
  });
})();
$("btnKaiawase").onclick=()=>{beep(600,.08);initAudio();hideSubPanel("miniGameSubPanel");enterMode("kaiawase");};
$("kaiQuit").onclick=()=>{beep(400,.06);enterMode("walk");};
$("kaiHelpStart").onclick=()=>{$("kaiHelp").classList.remove("show");kaiMarkHelpSeen();beep(520,.06);};
$("kaiDiffEasy").onclick=()=>kaiChooseDifficulty("easy");
$("kaiDiffNormal").onclick=()=>kaiChooseDifficulty("normal");
$("kaiDiffHard").onclick=()=>kaiChooseDifficulty("hard");
$("kaiRetry").onclick=()=>{beep(600,.07);const d=(KAI&&KAI.diff)||"normal";const go=$("kaiGameOver");if(go)go.classList.remove("show");kaiChooseDifficulty(d);};
$("kaiToTitle").onclick=()=>{beep(400,.06);returnToTitle();};
