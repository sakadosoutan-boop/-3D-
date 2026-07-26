/*
 * 御前五番勝負
 * 名称当て・貝合わせ・香合わせ・歌合・蹴鞠を短い五局にまとめた共通シード対戦。
 */
(function(){
  "use strict";

  const MODAL_ID="gozenFiveModal";
  const ENTRY_ID="gozenFiveEntry";
  const STORAGE_KEY="shinden3d-gozen-five-v1";
  const BOUTS=[
    {id:"quiz",mark:"札",name:"名称当て",lead:"邸の言葉を読み解く"},
    {id:"kai",mark:"貝",name:"貝合わせ",lead:"伏せた意匠の位置を覚える"},
    {id:"koh",mark:"香",name:"香合わせ",lead:"季節と場に響く香名を選ぶ"},
    {id:"waka",mark:"歌",name:"歌合",lead:"季節の題にふさわしい歌を選ぶ"},
    {id:"kemari",mark:"鞠",name:"蹴鞠",lead:"狙いの輪へ鞠を通す"}
  ];
  const KAI_MOTIFS=[
    ["桜","春の花"],["流水","夏の水"],["紅葉","秋の葉"],["雪輪","冬の雪"],
    ["松","常緑"],["鶴","長寿"],["月","夜空"],["雁","渡り鳥"]
  ];
  const SEASONS={spring:"春",summer:"夏",autumn:"秋",winter:"冬"};
  let modal=null;
  let session=null;
  let priorFocus=null;
  let animationFrame=0;
  let syncTimer=0;
  let submitting=false;

  function create(tag,className,text){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=String(text);
    return node;
  }
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function escapeHtml(value){
    return String(value==null?"":value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }
  function stripHtml(value){const box=document.createElement("div");box.innerHTML=String(value||"");return box.textContent||"";}
  function seedRandom(seed,salt){
    let value=((Number(seed)||1)^(Number(salt)||0))>>>0;
    return function(){
      value+=0x6d2b79f5;
      let t=value;
      t=Math.imul(t^(t>>>15),t|1);
      t^=t+Math.imul(t^(t>>>7),t|61);
      return((t^(t>>>14))>>>0)/4294967296;
    };
  }
  function shuffle(items,random){
    const copy=items.slice();
    for(let index=copy.length-1;index>0;index-=1){
      const swap=Math.floor(random()*(index+1));
      [copy[index],copy[swap]]=[copy[swap],copy[index]];
    }
    return copy;
  }
  function onlineApi(){return window.ONLINE_COMPETITION||null;}
  function currentBout(){return BOUTS[session?.boutIndex||0]||BOUTS[0];}
  function elapsedMs(){return session?Math.max(0,Date.now()-session.startedAt):0;}
  function beepFor(good){
    try{if(typeof window.beep==="function")window.beep(good?760:210,good?.07:.12,good?"triangle":"sawtooth",.05);}catch(_){}
  }
  function readSaved(matchId,seed){
    if(!matchId)return null;
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
      if(parsed?.version===1&&parsed.matchId===matchId&&Number(parsed.seed)===Number(seed))return parsed;
    }catch(_){}
    return null;
  }
  function save(){
    if(!session?.matchId)return;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(session));}catch(_){}
  }
  function clearSaved(){
    try{localStorage.removeItem(STORAGE_KEY);}catch(_){}
  }
  function itemsPool(){
    const ids=(typeof QUIZ_POOL!=="undefined"?QUIZ_POOL:Object.keys(window.ITEMS||{}));
    return ids.filter(id=>typeof ITEMS!=="undefined"&&ITEMS[id]?.n&&ITEMS[id]?.d);
  }
  function buildQuiz(seed){
    const random=seedRandom(seed,101),ids=shuffle(itemsPool(),random);
    return ids.slice(0,3).map((id,index)=>{
      const item=ITEMS[id],others=shuffle(ids.filter(other=>other!==id),random).slice(0,3);
      const options=shuffle([id].concat(others),random);
      const clue=stripHtml(item.d).replace(new RegExp(String(item.n).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"g"),"この場所・品");
      return{id:`quiz-${index}`,prompt:clue,options:options.map(key=>({id:key,label:ITEMS[key].n})),answer:options.indexOf(id),fact:item.d};
    });
  }
  function buildKoh(seed){
    const random=seedRandom(seed,303);
    const scenarios=window.KOH_AWASE?.scenarioBank||[
      {id:"spring",season:"春",occasion:"春の文",clue:"花の朝",title:"baika"},
      {id:"summer",season:"夏",occasion:"池の歌会",clue:"水辺の風",title:"kayo"},
      {id:"autumn",season:"秋",occasion:"菊の宴",clue:"澄んだ花",title:"kikka"}
    ];
    const titles=window.KOH_AWASE?.titles||[
      {id:"baika",name:"梅花",fact:"春の景を重ねる名。"},
      {id:"kayo",name:"荷葉",fact:"蓮の葉と水辺を思わせる名。"},
      {id:"kikka",name:"菊花",fact:"秋の花を重ねる名。"},
      {id:"kurobo",name:"黒方",fact:"重厚な趣と結ばれる名。"}
    ];
    return shuffle(scenarios,random).slice(0,3).map((scenario,index)=>{
      const correct=titles.find(title=>title.id===scenario.title)||titles[0];
      const options=shuffle([correct].concat(shuffle(titles.filter(title=>title.id!==correct.id),random).slice(0,3)),random);
      return{
        id:`koh-${index}`,
        prompt:`${scenario.season}・${scenario.occasion}。「${scenario.clue}」に響く香名は？`,
        options:options.map(title=>({id:title.id,label:title.name})),
        answer:options.findIndex(title=>title.id===correct.id),
        fact:correct.fact||"香の名は季節・場・相手を響かせて味わいました。"
      };
    });
  }
  function buildWaka(seed){
    const random=seedRandom(seed,404);
    const poems=(typeof WAKA_DATA!=="undefined"?WAKA_DATA:[]).filter(item=>SEASONS[item.season]&&item.poem);
    const seasons=shuffle(Object.keys(SEASONS),random).slice(0,3);
    return seasons.map((season,index)=>{
      const correct=shuffle(poems.filter(item=>item.season===season),random)[0];
      const fallback={id:`fallback-${season}`,season,poem:`${SEASONS[season]}の景を詠む歌`,auth:"よみ人知らず",interp:"季節の景を言葉で捉える。"};
      const answerPoem=correct||fallback;
      const distractors=shuffle(poems.filter(item=>item.season!==season),random).slice(0,3);
      while(distractors.length<3)distractors.push(fallback);
      const options=shuffle([answerPoem].concat(distractors),random);
      return{
        id:`waka-${index}`,
        prompt:`御題「${SEASONS[season]}」。もっとも季節に響く歌は？`,
        options:options.map(item=>({id:item.id,label:item.poem,sub:item.auth})),
        answer:options.findIndex(item=>item===answerPoem),
        fact:`${answerPoem.auth}。${answerPoem.interp||""}`
      };
    });
  }
  function buildKai(seed){
    const random=seedRandom(seed,202);
    const motifs=shuffle(KAI_MOTIFS,random).slice(0,4);
    const cards=shuffle(motifs.flatMap((motif,index)=>[
      {id:`${index}-a`,pair:index,label:motif[0],hint:motif[1]},
      {id:`${index}-b`,pair:index,label:motif[0],hint:motif[1]}
    ]),random);
    return{cards,open:cards.map(card=>card.id),matched:[],first:null,locked:true,wrong:0,previewUntil:Date.now()+2400,startedAt:Date.now()};
  }
  function buildKemari(seed){
    const random=seedRandom(seed,505);
    return{targets:Array.from({length:5},()=>.2+random()*.6),kickIndex:0,score:0,cycleStart:Date.now(),last:null};
  }
  function makeCurrent(id,seed){
    if(id==="quiz")return{type:"choice",questions:buildQuiz(seed),index:0,score:0,correct:0,answered:false,startedAt:Date.now(),questionStartedAt:Date.now()};
    if(id==="koh")return{type:"choice",questions:buildKoh(seed),index:0,score:0,correct:0,answered:false,startedAt:Date.now(),questionStartedAt:Date.now()};
    if(id==="waka")return{type:"choice",questions:buildWaka(seed),index:0,score:0,correct:0,answered:false,startedAt:Date.now(),questionStartedAt:Date.now()};
    if(id==="kai")return Object.assign({type:"kai"},buildKai(seed));
    return Object.assign({type:"kemari"},buildKemari(seed));
  }
  function newSession(context){
    const online=!!context?.matchId,seed=Number(context?.seed)||((Date.now()^Math.floor(Math.random()*0xffffffff))>>>0);
    const restored=online?readSaved(context.matchId,seed):null;
    if(restored){
      restored.online=context;
      return restored;
    }
    return{
      version:1,seed,matchId:context?.matchId||null,online:context||null,
      phase:"intro",boutIndex:0,scores:{},total:0,current:null,
      startedAt:Date.now(),submitted:false,complete:false,message:""
    };
  }
  function ensureModal(){
    if(modal)return modal;
    modal=create("div","gozen5-modal");
    modal.id=MODAL_ID;
    modal.setAttribute("role","dialog");
    modal.setAttribute("aria-modal","true");
    modal.setAttribute("aria-labelledby","gozen5Title");
    modal.addEventListener("mousedown",event=>{if(event.target===modal)close();});
    modal.addEventListener("keydown",handleKeydown);
    document.body.append(modal);
    return modal;
  }
  function scoreHeader(root){
    const head=create("header","gozen5-head");
    const title=create("div");
    title.append(create("span","gozen5-kicker",session?.online?"オンライン御前試合":"ひとり稽古"),create("h2",null,"御前五番勝負"));
    title.querySelector("h2").id="gozen5Title";
    const total=create("strong","gozen5-total",`${session?.total||0} / 5000`);
    const closeButton=create("button","gozen5-close","×");closeButton.type="button";closeButton.title="閉じる";closeButton.addEventListener("click",close);
    head.append(title,total,closeButton);root.append(head);
    const bouts=create("div","gozen5-bouts");
    BOUTS.forEach((bout,index)=>{
      const item=create("div",`gozen5-bout${index===session.boutIndex&&!session.complete?" is-current":""}${session.scores[bout.id]!=null?" is-done":""}`);
      item.append(create("b",null,bout.mark),create("span",null,bout.name),create("strong",null,session.scores[bout.id]!=null?session.scores[bout.id]:"―"));
      bouts.append(item);
    });
    root.append(bouts);
    if(session.online){
      const rival=create("div","gozen5-rival");
      const progress=session.online.opponentProgress||{};
      const opponentBout=Number(progress.bout||0);
      const name=create("b",null,session.online.opponentName||"参加者");name.id="gozen5RivalName";
      const score=create("strong",null,`${session.online.opponentScore||0}点`);score.id="gozen5RivalScore";
      const state=create("small",null,session.online.opponentStatus==="finished"?"五局終了":`${Math.min(5,opponentBout+1)}局目`);state.id="gozen5RivalState";
      rival.append(create("span",null,"対戦相手"),name,score,state);
      root.append(rival);
    }
  }
  function frame(){
    const sheet=create("section","gozen5-sheet");
    scoreHeader(sheet);
    const body=create("main","gozen5-body");sheet.append(body);
    modal.replaceChildren(sheet);
    return body;
  }
  function action(label,handler,className){
    const button=create("button",`gozen5-action${className?` ${className}`:""}`,label);
    button.type="button";button.addEventListener("click",handler);return button;
  }
  function renderIntro(){
    const body=frame();
    const intro=create("section","gozen5-intro");
    intro.append(create("span","gozen5-seal","五"),create("h3",null,"五つの芸を、ひと息に。"),create("p",null,"名称・記憶・香・歌・間合いを競います。各局1000点、合計5000点。対戦では二人に同じ札と同じ鞠順が届きます。"));
    const order=create("ol","gozen5-order");
    BOUTS.forEach(bout=>{const item=create("li");item.append(create("b",null,bout.mark),create("span",null,`${bout.name}　${bout.lead}`));order.append(item);});
    intro.append(order,action("第一局を始める",beginBout,"is-primary"));body.append(intro);
  }
  function beginBout(){
    session.phase="playing";
    session.current=makeCurrent(currentBout().id,session.seed);
    save();render();
  }
  function choiceScore(correct,elapsed){
    if(!correct)return 0;
    return 250+Math.round(clamp(80-elapsed/120,0,80));
  }
  function answerChoice(index){
    const current=session.current;
    if(!current||current.answered)return;
    const question=current.questions[current.index],correct=index===question.answer;
    const earned=choiceScore(correct,Date.now()-current.questionStartedAt);
    current.answered=true;current.selected=index;current.earned=earned;current.score+=earned;if(correct)current.correct+=1;
    beepFor(correct);save();render();
  }
  function nextChoice(){
    const current=session.current;
    if(current.index>=current.questions.length-1){
      const perfect=current.correct===current.questions.length?10:0;
      completeBout(clamp(current.score+perfect,0,1000),`${current.correct} / ${current.questions.length} 正解`);
      return;
    }
    current.index+=1;current.answered=false;current.selected=null;current.earned=0;current.questionStartedAt=Date.now();save();render();
  }
  function renderChoice(){
    const body=frame(),bout=currentBout(),current=session.current,question=current.questions[current.index];
    const stage=create("section","gozen5-stage");
    stage.append(create("p","gozen5-round",`第${session.boutIndex+1}局　${bout.name}　${current.index+1} / ${current.questions.length}`),create("h3","gozen5-question",question.prompt));
    const choices=create("div","gozen5-choices");
    question.options.forEach((option,index)=>{
      const button=action(`${index+1}. ${option.label}`,()=>answerChoice(index),"gozen5-choice");
      if(option.sub)button.append(create("small",null,option.sub));
      if(current.answered){
        button.disabled=true;
        if(index===question.answer)button.classList.add("is-correct");
        else if(index===current.selected)button.classList.add("is-wrong");
      }
      choices.append(button);
    });
    stage.append(choices);
    if(current.answered){
      const feedback=create("div",`gozen5-feedback ${current.selected===question.answer?"is-good":"is-bad"}`);
      feedback.innerHTML=`<b>${current.selected===question.answer?`正解　+${current.earned}`:"惜しい"}</b><span>${escapeHtml(stripHtml(question.fact))}</span>`;
      feedback.append(action(current.index===current.questions.length-1?"この局を納める":"次の問い",nextChoice,"is-primary"));
      stage.append(feedback);
    }
    body.append(stage);
  }
  function releaseKaiPreview(){
    if(!session||session.current?.type!=="kai"||!session.current.locked)return;
    if(Date.now()<session.current.previewUntil)return;
    session.current.locked=false;session.current.open=[];session.current.startedAt=Date.now();save();render();
  }
  function pickKai(cardId){
    const current=session.current;
    if(!current||current.locked||current.matched.includes(cardId)||current.open.includes(cardId))return;
    current.open.push(cardId);
    if(!current.first){current.first=cardId;save();render();return;}
    const first=current.cards.find(card=>card.id===current.first),second=current.cards.find(card=>card.id===cardId);
    current.locked=true;
    current.resolveAt=Date.now()+520;
    if(first.pair===second.pair){
      current.matched.push(first.id,second.id);beepFor(true);
    }else{
      current.wrong+=1;beepFor(false);
    }
    save();render();
    window.setTimeout(()=>resolveKaiPick(current),520);
  }
  function resolveKaiPick(current){
    if(!session||session.current!==current||!current.locked||!current.first)return;
    current.open=[];current.first=null;current.locked=false;current.resolveAt=0;save();
    if(current.matched.length===current.cards.length){
      const elapsed=(Date.now()-current.startedAt)/1000;
      completeBout(clamp(Math.round(1000-current.wrong*110-elapsed*7),200,1000),`お手つき ${current.wrong}回`);
    }else render();
  }
  function renderKai(){
    const body=frame(),current=session.current;
    const stage=create("section","gozen5-stage");
    stage.append(create("p","gozen5-round","第二局　貝合わせ"),create("h3","gozen5-question",current.locked&&Date.now()<current.previewUntil?"意匠の位置を覚える":"同じ意匠の貝を合わせる"));
    const grid=create("div","gozen5-shells");
    current.cards.forEach(card=>{
      const shown=current.open.includes(card.id)||current.matched.includes(card.id);
      const button=action(shown?card.label:"貝",()=>pickKai(card.id),"gozen5-shell");
      button.disabled=current.locked||current.matched.includes(card.id);
      button.classList.toggle("is-open",shown);button.classList.toggle("is-matched",current.matched.includes(card.id));
      if(shown)button.append(create("small",null,card.hint));
      grid.append(button);
    });
    stage.append(grid,create("p","gozen5-note",`成立 ${current.matched.length/2} / 4　お手つき ${current.wrong}`));body.append(stage);
    if(current.locked&&Date.now()<current.previewUntil)window.setTimeout(releaseKaiPreview,Math.max(30,current.previewUntil-Date.now()));
    else if(current.locked&&current.first)window.setTimeout(()=>resolveKaiPick(current),Math.max(30,(current.resolveAt||Date.now())-Date.now()));
  }
  function kemariProgress(current){
    const elapsed=Date.now()-current.cycleStart;
    if(elapsed<=0)return 0;
    return(elapsed%1800)/1800;
  }
  function kickKemari(){
    const current=session.current;
    if(!current||current.kickIndex>=current.targets.length)return;
    const progress=kemariProgress(current),target=current.targets[current.kickIndex],distance=Math.abs(progress-target);
    const earned=clamp(Math.round(200*(1-distance/.48)),40,200);
    current.score+=earned;current.last={earned,distance};current.kickIndex+=1;beepFor(earned>=150);save();
    if(current.kickIndex>=current.targets.length){
      window.setTimeout(()=>completeBout(clamp(current.score,0,1000),`五鞠 ${current.score}点`),450);
    }else{
      current.cycleStart=Date.now()+350;render();
    }
  }
  function paintKemari(){
    if(animationFrame)cancelAnimationFrame(animationFrame);
    const tick=()=>{
      if(!modal?.classList.contains("is-open")||session?.current?.type!=="kemari")return;
      const marker=modal.querySelector("#gozen5KemariMarker");
      if(marker)marker.style.left=`${kemariProgress(session.current)*100}%`;
      animationFrame=requestAnimationFrame(tick);
    };
    animationFrame=requestAnimationFrame(tick);
  }
  function renderKemari(){
    const body=frame(),current=session.current,target=current.targets[Math.min(current.kickIndex,current.targets.length-1)];
    const stage=create("section","gozen5-stage gozen5-kemari");
    stage.append(create("p","gozen5-round",`第五局　蹴鞠　${Math.min(5,current.kickIndex+1)} / 5`),create("h3","gozen5-question","動く印が金の輪に重なった瞬間に蹴る"));
    const lane=create("div","gozen5-kemari-lane");
    const targetEl=create("i","gozen5-kemari-target");targetEl.style.left=`${target*100}%`;
    const marker=create("b","gozen5-kemari-marker","鞠");marker.id="gozen5KemariMarker";
    lane.append(targetEl,marker);stage.append(lane);
    if(current.last)stage.append(create("p",`gozen5-kick-result ${current.last.earned>=150?"is-good":""}`,`${current.last.earned>=180?"見事":current.last.earned>=130?"良し":"拾い鞠"}　+${current.last.earned}`));
    stage.append(action("蹴る",kickKemari,"is-primary gozen5-kick"),create("p","gozen5-note",`現在 ${current.score}点。早押しではなく、間を読む勝負です。`));
    body.append(stage);paintKemari();
  }
  function completeBout(score,detail){
    const bout=currentBout();
    session.scores[bout.id]=Math.round(score);
    session.total=Object.values(session.scores).reduce((sum,value)=>sum+(Number(value)||0),0);
    session.phase="between";session.message=detail;save();publishProgress(true);render();
  }
  function nextBout(){
    if(session.boutIndex>=BOUTS.length-1){
      session.complete=true;session.phase="complete";save();render();return;
    }
    session.boutIndex+=1;session.phase="playing";session.current=makeCurrent(currentBout().id,session.seed);session.message="";save();render();
  }
  function renderBetween(){
    const body=frame(),bout=currentBout(),score=session.scores[bout.id];
    const result=create("section","gozen5-between");
    result.append(create("span","gozen5-seal",bout.mark),create("p",null,`${bout.name}　${session.message}`),create("strong",null,`${score}点`));
    const next=BOUTS[session.boutIndex+1];
    result.append(action(next?`次局・${next.name}へ`:"五番勝負の結果へ",nextBout,"is-primary"));body.append(result);
  }
  function grade(total){
    if(total>=4400)return["関白","五芸に隙なし"];
    if(total>=3600)return["大納言","雅と技を兼ね備えた"];
    if(total>=2700)return["殿上人","御前に名を残した"];
    if(total>=1800)return["蔵人","次の勝負で伸びる"];
    return["見習い","五つの芸を知った"];
  }
  async function submitResult(){
    if(session.submitted||submitting)return;
    submitting=true;session.message="送信中…";render();
    const metadata={scores:session.scores,bouts:5,bout:4,progress:5,complete:true,seed:session.seed,source:session.online?"online_match":"gozen_five"};
    try{
      if(session.online){
        const finished=await onlineApi()?.finishChallenge?.("gozen5",session.total,elapsedMs(),metadata);
        if(!finished)throw new Error("result_not_confirmed");
        session.submitted=true;session.message="対戦結果を記録しました";
        clearSaved();
      }else{
        const result=await onlineApi()?.submitScore?.("gozen5",session.total,elapsedMs(),metadata);
        if(result?.ignored||result?.offline)throw new Error("ranking_unavailable");
        session.submitted=true;
        session.message=result?.queued?"通信復帰後に共有順位へ送ります":"共有順位へ記録しました";
      }
      save();
    }catch(_){
      session.submitted=false;session.message="送信できませんでした。もう一度お試しください。";save();
    }finally{
      submitting=false;render();
    }
  }
  function renderComplete(){
    const body=frame(),rank=grade(session.total);
    const result=create("section","gozen5-complete");
    result.append(create("span","gozen5-kicker","五局終了"),create("h3",null,rank[0]),create("strong","gozen5-final-score",`${session.total} / 5000`),create("p",null,rank[1]));
    const list=create("div","gozen5-result-list");
    BOUTS.forEach(bout=>{const row=create("div");row.append(create("span",null,`${bout.mark} ${bout.name}`),create("b",null,`${session.scores[bout.id]||0}点`));list.append(row);});
    result.append(list);
    if(session.message)result.append(create("p","gozen5-note",session.message));
    if(!session.submitted){
      const submitButton=action(submitting?"送信中…":session.online?"対戦結果を開く":"共有順位へ記録",submitResult,"is-primary");
      submitButton.disabled=submitting;result.append(submitButton);
    }
    result.append(action("もう一度稽古する",startSolo,"is-quiet"));body.append(result);
  }
  function render(){
    if(!session)return;
    if(session.phase==="intro")renderIntro();
    else if(session.phase==="between")renderBetween();
    else if(session.phase==="complete"||session.complete)renderComplete();
    else if(session.current?.type==="choice")renderChoice();
    else if(session.current?.type==="kai")renderKai();
    else if(session.current?.type==="kemari")renderKemari();
  }
  function publishProgress(force){
    if(!session?.online||!onlineApi()?.updateChallengeProgress)return;
    const progress=session.complete?5:session.boutIndex+(session.phase==="between"?.95:.15);
    Promise.resolve(onlineApi().updateChallengeProgress("gozen5",session.total,elapsedMs(),{
      progress,bout:session.boutIndex,boutId:currentBout().id,scores:session.scores,complete:session.complete
    })).then(applyOnlineContext).catch(()=>{});
  }
  function applyOnlineContext(context){
    if(!session?.matchId||context?.matchId!==session.matchId)return;
    session.online=context;save();
    const name=modal?.querySelector("#gozen5RivalName"),score=modal?.querySelector("#gozen5RivalScore"),state=modal?.querySelector("#gozen5RivalState");
    const progress=context.opponentProgress||{},opponentBout=Number(progress.bout||0);
    if(name)name.textContent=context.opponentName||"参加者";
    if(score)score.textContent=`${context.opponentScore||0}点`;
    if(state)state.textContent=context.opponentStatus==="finished"?"五局終了":`${Math.min(5,opponentBout+1)}局目`;
  }
  function syncOnline(){
    clearInterval(syncTimer);syncTimer=0;
    if(!session?.online||!onlineApi()?.syncChallenge)return;
    syncTimer=window.setInterval(()=>{
      const active=session;
      Promise.resolve(onlineApi().syncChallenge("gozen5")).then(context=>{
        if(session===active)applyOnlineContext(context);
      }).catch(()=>{});
    },1600);
  }
  function startOnline(){
    const context=onlineApi()?.consumeChallengeContext?.("gozen5");
    if(!context)return false;
    session=newSession(context);open();syncOnline();return true;
  }
  function startSolo(){
    session=newSession(null);open();return true;
  }
  function open(){
    priorFocus=document.activeElement;
    ensureModal().classList.add("is-open");
    if(!session)session=newSession(null);
    render();syncOnline();
    modal.querySelector("button:not([disabled])")?.focus();
  }
  function close(){
    if(animationFrame)cancelAnimationFrame(animationFrame);animationFrame=0;
    clearInterval(syncTimer);syncTimer=0;
    modal?.classList.remove("is-open");
    if(priorFocus&&typeof priorFocus.focus==="function")try{priorFocus.focus();}catch(_){}
  }
  function handleKeydown(event){
    if(event.key==="Escape"){event.preventDefault();close();return;}
    if(session?.current?.type==="choice"&&!session.current.answered){
      const index=Number(event.key)-1;
      if(index>=0&&index<4){event.preventDefault();answerChoice(index);}
    }
    if(session?.current?.type==="kemari"&&(event.key===" "||event.key==="Enter")){
      event.preventDefault();kickKemari();
    }
  }
  function getState(){
    return session?{
      version:session.version,online:!!session.online,matchId:session.matchId,seed:session.seed,
      phase:session.phase,boutIndex:session.boutIndex,boutId:currentBout().id,
      scores:Object.assign({},session.scores),total:session.total,complete:session.complete,submitted:session.submitted
    }:null;
  }
  function injectEntry(){
    const host=document.querySelector("#miniGameSubPanel .t-modes")||document.querySelector("#taikenSubPanel .t-modes");
    if(!host||document.getElementById(ENTRY_ID))return !!host;
    const button=create("button","t-btn gozen5-entry");button.id=ENTRY_ID;button.type="button";
    button.append(create("span","mode-meta","五種競技 / オンライン"),create("span","cat-icon","五"),create("span","mode-name","御前五番勝負"),create("small",null,"札・貝・香・歌・鞠を通した総合戦"));
    button.addEventListener("click",startSolo);host.append(button);return true;
  }
  function boot(){
    injectEntry();let attempts=0;
    const timer=setInterval(()=>{attempts+=1;if(injectEntry()||attempts>40)clearInterval(timer);},250);
  }

  window.GOZEN_FIVE={version:1,startSolo,startOnline,open,close,getState,submit:submitResult};
  window.GOZEN_FIVE_STATUS={ready:true,version:1,bouts:BOUTS.map(item=>item.id),maxScore:5000};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
