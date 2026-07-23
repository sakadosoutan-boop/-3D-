/*
 * 薫物合（香合わせ）: standalone, no external assets.
 * This source is embedded after the existing mini-game scripts.
 */
(function(){
  "use strict";

  const STORAGE_KEY="shinden3d-koh-awase-v1";
  const MODAL_ID="kohAwaseModal";
  const ENTRY_ID="kohAwaseEntry";
  const QUESTION_COUNT=5;
  const BANK=[
    {id:"umehana-name",kind:"name",prompt:"春の花を思わせる代表的な名はどれ？",choices:["梅花","荷葉","黒方","落葉"],answer:0,explain:"梅花（ばいか）は、春の花を思わせる代表名です。香りの調合は家や人によって異なり、この印象は固定のレシピを意味しません。"},
    {id:"kayo-summer",kind:"season",prompt:"夏の池辺の軽やかな趣に合う代表名はどれ？",choices:["菊花","侍従","荷葉","黒方"],answer:2,explain:"荷葉（かよう）は蓮の葉を思わせる、夏の軽やかな連想と結ばれる代表名です。実際の香りは一通りではありません。"},
    {id:"jiju-autumn-wind",kind:"impression",prompt:"穏やかな秋風を思わせる、とされる代表名はどれ？",choices:["侍従","梅花","落葉","荷葉"],answer:0,explain:"侍従（じじゅう）は、落ち着いた秋風のような印象と結ばれる代表名です。名称は季節・場・人の教養を含む遊びでした。"},
    {id:"kikka-autumn",kind:"season",prompt:"菊の季節を連想させる代表名はどれ？",choices:["菊花","荷葉","梅花","黒方"],answer:0,explain:"菊花（きっか）は秋と菊を連想させる代表名です。香そのものだけでなく、季節にふさわしい名を味わうことも大切でした。"},
    {id:"rakuyo-leaves",kind:"impression",prompt:"散る葉・晩秋の景色を重ねる代表名はどれ？",choices:["黒方","落葉","侍従","梅花"],answer:1,explain:"落葉（らくよう）は、落ち葉や秋の深まりを思わせる代表名です。ここでは代表的な連想を学び、香りを画面で再現するものではありません。"},
    {id:"kurobo-formal",kind:"impression",prompt:"重厚であらたまった場を思わせる代表名はどれ？",choices:["黒方","荷葉","菊花","梅花"],answer:0,explain:"黒方（くろぼう）は重厚で格式ある趣と結ばれる代表名です。各家の処方や配合量には幅があり、単一の香りに決められません。"},
    {id:"kneaded-incense",kind:"history",prompt:"平安期の薫物として最も近い説明はどれ？",choices:["香木を一種類だけ焚くもの","香料を練り合わせた練香","花を水に浮かべる遊び","茶葉を比べる会"],answer:1,explain:"薫物は香料を練り合わせる練香です。材料・比率・熟成などは家ごとに伝えられ、同名でも同じ処方とは限りません。"},
    {id:"contest-judgement",kind:"history",prompt:"薫物合で香り以外にも重んじられたものは？",choices:["季節・名・場にふさわしい趣","走る速さ","金銀の量だけ","一度に焚く量"],answer:0,explain:"薫物合は香りだけの点数競技ではありません。季節、名、贈る相手や場面をどう結びつけるかも、教養の見せどころでした。"},
    {id:"recipe-variation",kind:"history",prompt:"六種の薫物の処方について、適切なのはどれ？",choices:["全国で完全に同じだった","家や人により違いがあった","画面で正確に再現できる","香料は一種類だけだった"],answer:1,explain:"六種は代表的な名ですが、処方と印象は家・人・時代により変わります。このゲームの説明は固定の万能レシピではありません。"},
    {id:"kodo-difference",kind:"history",prompt:"平安の薫物合と、後世に整った香道の違いとして適切なのは？",choices:["まったく同じ作法だった","薫物合は練香と季節・場の趣を競う遊びだった","香道は平安にだけ存在した","どちらも香りを使わない"],answer:1,explain:"平安の薫物合は練香と季節・名・場を味わう遊びです。後世の香道は香木を聞く作法などを整えた別の文化として発達しました。"},
    {id:"six-representatives",kind:"history",prompt:"代表的な六種の薫物に含まれないものはどれ？",choices:["梅花","荷葉","藤袴","黒方"],answer:2,explain:"代表的な六種は梅花・荷葉・侍従・菊花・落葉・黒方です。名前は香りと季節や情景を結ぶための大切な手がかりでした。"},
    {id:"spring-choice",kind:"season",prompt:"春の文に添えるなら、まず検討したい代表名は？",choices:["梅花","落葉","黒方","侍従"],answer:0,explain:"梅花は春の花を思わせる代表名として扱えます。ただし実際の選択では、相手・場面・家の伝承も考え合わせます。"},
    {id:"autumn-choice",kind:"season",prompt:"深まる秋の便りに、散る葉の景色を添えるなら？",choices:["荷葉","落葉","梅花","黒方"],answer:1,explain:"落葉は晩秋の景色を結ぶ代表名です。薫物合では、このように景色や季節を名で響かせることが大切でした。"},
    {id:"screen-limits",kind:"history",prompt:"この画面上の香合わせ学習について正しいのは？",choices:["実物と同じ香りを再現している","香りは再現せず、名称と文化的な趣を学ぶ","一つの正解処方を決める","香道の作法をそのまま再現する"],answer:1,explain:"画面では匂いそのものは再現できません。ここでは名称、季節、場、処方に幅があることを通して、薫物合の考え方を学びます。"}
  ];

  let stored={bestScore:0,plays:0,masteredQuestionIds:[]};
  let session=null;
  let modal=null;
  let priorFocus=null;

  function text(value){ return String(value==null?"":value); }
  function uniqueStrings(value){ return Array.from(new Set(Array.isArray(value)?value.filter(v=>typeof v==="string"):[])); }
  function readState(){
    try{
      const raw=window.localStorage&&window.localStorage.getItem(STORAGE_KEY);
      if(!raw)return {bestScore:0,plays:0,masteredQuestionIds:[]};
      const parsed=JSON.parse(raw);
      return {
        bestScore:Math.max(0,Math.min(QUESTION_COUNT,Number(parsed.bestScore)||0)),
        plays:Math.max(0,Number(parsed.plays)||0),
        masteredQuestionIds:uniqueStrings(parsed.masteredQuestionIds)
      };
    }catch(error){ return {bestScore:0,plays:0,masteredQuestionIds:[]}; }
  }
  function writeState(){
    try{ if(window.localStorage)window.localStorage.setItem(STORAGE_KEY,JSON.stringify(stored)); }catch(error){}
  }
  function safeCall(fn,args){ try{ if(typeof fn==="function")fn.apply(null,args||[]); }catch(error){} }
  function signal(kind){
    try{
      if(typeof window.beep==="function")window.beep(kind==="good"?740:220,kind==="good"?.08:.13,kind==="good"?"sine":"triangle",.055);
    }catch(error){}
  }
  function shuffle(items){
    const copy=items.slice();
    for(let i=copy.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));const temp=copy[i];copy[i]=copy[j];copy[j]=temp; }
    return copy;
  }
  function create(tag,className,content){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(content!==undefined)node.textContent=text(content);
    return node;
  }
  function injectStyle(){
    if(document.querySelector("#kohAwaseStyle"))return;
    const style=document.createElement("style");
    style.id="kohAwaseStyle";
    style.textContent=`
      .koh-awase-entry{background:linear-gradient(135deg,#234a45,#16342f)!important;border-color:#86b9a9!important;color:#f7f1dd!important}
      .koh-awase-entry:hover,.koh-awase-entry:focus-visible{filter:brightness(1.15);outline:2px solid #f3d17a;outline-offset:2px}
      .koh-awase-modal{position:fixed;inset:0;z-index:10090;display:none;align-items:center;justify-content:center;padding:clamp(12px,3vh,28px);background:rgba(14,19,18,.84);font-family:serif}
      .koh-awase-modal.is-open{display:flex}.koh-awase-sheet{width:min(660px,100%);max-height:min(790px,calc(100vh - 24px));overflow:auto;box-sizing:border-box;background:#f6f0df;color:#29271e;border:2px solid #b7954c;border-radius:8px;box-shadow:0 18px 60px rgba(0,0,0,.45)}
      .koh-awase-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px 12px;background:#203f3a;color:#fff9e9;border-bottom:3px solid #b7954c}.koh-awase-kicker{margin:0;font-size:12px;color:#d9c180}.koh-awase-title{margin:3px 0 0;font-size:24px;line-height:1.15}.koh-awase-close{flex:0 0 38px;width:38px;height:38px;border:1px solid #d9c180;border-radius:5px;background:transparent;color:#fff9e9;font-size:23px;cursor:pointer}
      .koh-awase-body{padding:18px;display:grid;gap:14px}.koh-awase-score{display:flex;justify-content:space-between;gap:10px;color:#67592d;font-size:14px}.koh-awase-note{margin:0;padding:10px 12px;border-left:4px solid #ad7b2a;background:#eee4c9;font-size:14px;line-height:1.55}.koh-awase-question{margin:0;font-size:20px;line-height:1.45}.koh-awase-options{display:grid;grid-template-columns:1fr 1fr;gap:9px}.koh-awase-option{min-height:52px;padding:10px 12px;text-align:left;border:1px solid #9b8554;border-radius:5px;background:#fffaf0;color:#29271e;font:inherit;font-size:16px;line-height:1.35;cursor:pointer}.koh-awase-option:hover,.koh-awase-option:focus-visible{border-color:#3e756b;background:#edf6ed;outline:2px solid #609f90;outline-offset:1px}.koh-awase-option.is-correct{background:#dceede;border-color:#367451}.koh-awase-option.is-wrong{background:#f3d9d1;border-color:#9e4e3d}.koh-awase-option:disabled{cursor:default;opacity:1}.koh-awase-feedback{min-height:74px;padding:12px;border:1px solid #c4b181;border-radius:5px;background:#fff9eb;line-height:1.55}.koh-awase-feedback[hidden]{display:none}.koh-awase-actions{display:flex;justify-content:flex-end;gap:10px}.koh-awase-action{min-height:44px;padding:8px 16px;border:1px solid #755a21;border-radius:5px;background:#9b6e20;color:#fffbea;font:inherit;font-weight:bold;cursor:pointer}.koh-awase-action:hover,.koh-awase-action:focus-visible{background:#795415;outline:2px solid #d2b566;outline-offset:2px}.koh-awase-review{display:grid;gap:10px}.koh-awase-review-item{padding:11px;border-left:4px solid #a45b45;background:#fff9eb;line-height:1.5}.koh-awase-complete{margin:0;font-size:20px;line-height:1.45}.koh-awase-facts{color:#67592d;font-size:14px}
      @media(max-width:390px){.koh-awase-modal{padding:8px}.koh-awase-sheet{max-height:calc(100vh - 16px)}.koh-awase-head{padding:12px}.koh-awase-title{font-size:21px}.koh-awase-body{padding:13px;gap:11px}.koh-awase-question{font-size:18px}.koh-awase-options{grid-template-columns:1fr}.koh-awase-option{min-height:46px;font-size:15px}.koh-awase-note,.koh-awase-feedback{font-size:13px}.koh-awase-actions{justify-content:stretch}.koh-awase-action{width:100%}}
      @media(prefers-reduced-motion:reduce){.koh-awase-modal,.koh-awase-option{scroll-behavior:auto!important;transition:none!important}}
    `;
    document.head.appendChild(style);
  }
  function ensureModal(){
    if(modal)return modal;
    injectStyle();
    modal=create("div","koh-awase-modal");
    modal.id=MODAL_ID;
    modal.setAttribute("role","dialog");
    modal.setAttribute("aria-modal","true");
    modal.setAttribute("aria-labelledby","kohAwaseTitle");
    modal.addEventListener("mousedown",event=>{ if(event.target===modal)close(); });
    modal.addEventListener("keydown",handleKeydown);
    document.body.appendChild(modal);
    return modal;
  }
  function renderFrame(){
    const root=ensureModal();
    root.replaceChildren();
    const sheet=create("section","koh-awase-sheet");
    const head=create("header","koh-awase-head");
    const headingWrap=create("div");
    headingWrap.append(create("p","koh-awase-kicker","平安の練香を、名と季節から味わう"));
    const heading=create("h2","koh-awase-title","薫物合 香合わせ");heading.id="kohAwaseTitle";headingWrap.append(heading);
    const closeButton=create("button","koh-awase-close","×");closeButton.type="button";closeButton.setAttribute("aria-label","香合わせを閉じる");closeButton.title="閉じる（Esc）";closeButton.addEventListener("click",close);
    head.append(headingWrap,closeButton);sheet.append(head);
    root.append(sheet);
    return sheet;
  }
  function appendIntro(body){
    body.append(create("p","koh-awase-note","薫物は香料を練り合わせた練香です。梅花・荷葉・侍従・菊花・落葉・黒方は代表的な名。処方や印象は家や人によって異なり、画面で実物の香りを再現するものではありません。"));
  }
  function open(){
    priorFocus=document.activeElement;
    const root=ensureModal();
    root.classList.add("is-open");
    if(!session)start();else if(session.complete)renderComplete();else renderQuestion();
    const focusable=root.querySelector("button:not([disabled])");if(focusable)focusable.focus();
  }
  function close(){
    if(!modal)return;
    modal.classList.remove("is-open");
    if(priorFocus&&typeof priorFocus.focus==="function")try{priorFocus.focus();}catch(error){}
  }
  function start(){
    stored=readState();
    const questions=shuffle(BANK).slice(0,QUESTION_COUNT);
    session={questions,index:0,score:0,answered:false,missed:[],complete:false};
    stored.plays+=1;writeState();
    if(modal&&modal.classList.contains("is-open"))renderQuestion();
    return getState();
  }
  function renderQuestion(){
    if(!session)return;
    const question=session.questions[session.index];
    if(!question){renderComplete();return;}
    const sheet=renderFrame();const body=create("main","koh-awase-body");
    const score=create("div","koh-awase-score");
    score.append(create("span",null,`第 ${session.index+1} 問 / ${QUESTION_COUNT}`),create("span",null,`正答 ${session.score}`));
    body.append(score);appendIntro(body);body.append(create("p","koh-awase-question",question.prompt));
    const options=create("div","koh-awase-options");options.setAttribute("role","group");options.setAttribute("aria-label","答えを選ぶ");
    question.choices.forEach((choice,index)=>{
      const button=create("button","koh-awase-option",`${index+1}. ${choice}`);button.type="button";button.dataset.index=String(index);button.addEventListener("click",()=>answer(index));options.append(button);
    });
    body.append(options);
    const feedback=create("div","koh-awase-feedback");feedback.id="kohAwaseFeedback";feedback.hidden=true;feedback.setAttribute("aria-live","polite");body.append(feedback);
    const actions=create("div","koh-awase-actions");const nextButton=create("button","koh-awase-action","次の香へ");nextButton.type="button";nextButton.hidden=true;nextButton.addEventListener("click",next);actions.append(nextButton);body.append(actions);sheet.append(body);
    if(session.answered)showAnswerState(question,session.selectedIndex,false);
  }
  function awardMastery(question){
    if(stored.masteredQuestionIds.includes(question.id))return;
    stored.masteredQuestionIds.push(question.id);writeState();
    safeCall(window.recordProgress,["kohAwase",1]);
    safeCall(window.gainParam,["knowledge",1]);
    safeCall(window.gainParam,["miyabi",1]);
    safeCall(window.markDailyMission,["quiz"]);
  }
  function answer(index){
    if(!session||session.answered||session.complete)return false;
    const question=session.questions[session.index];
    if(!question||index<0||index>=question.choices.length)return false;
    session.answered=true;
    session.selectedIndex=index;
    const correct=index===question.answer;
    if(correct){session.score+=1;awardMastery(question);signal("good");}else{session.missed.push(question);signal("bad");}
    if(!modal)return correct;
    showAnswerState(question,index,true);
    return correct;
  }
  function showAnswerState(question,index,focusNext){
    if(!modal||!question)return;
    const correct=index===question.answer;
    modal.querySelectorAll(".koh-awase-option").forEach((button,optionIndex)=>{
      button.disabled=true;
      if(optionIndex===question.answer)button.classList.add("is-correct");
      if(optionIndex===index&&!correct)button.classList.add("is-wrong");
    });
    const feedback=modal.querySelector("#kohAwaseFeedback");
    if(feedback){feedback.hidden=false;feedback.textContent=`${correct?"正解。":"今回はここを確認。"} ${question.explain}`;}
    const nextButton=modal.querySelector(".koh-awase-action");
    if(nextButton){nextButton.hidden=false;nextButton.textContent=session.index===QUESTION_COUNT-1?"復習帳を見る":"次の香へ";if(focusNext)nextButton.focus();}
  }
  function next(){
    if(!session||!session.answered)return;
    session.index+=1;session.answered=false;session.selectedIndex=null;
    if(session.index>=session.questions.length)renderComplete();else renderQuestion();
  }
  function renderComplete(){
    if(!session)return;
    session.complete=true;stored.bestScore=Math.max(stored.bestScore,session.score);writeState();
    const sheet=renderFrame();const body=create("main","koh-awase-body");
    body.append(create("p","koh-awase-complete",`${QUESTION_COUNT}問を聞き終えました。正答は ${session.score} 問です。`));
    body.append(create("p","koh-awase-facts",`最高記録 ${stored.bestScore} / ${QUESTION_COUNT}・学んだ事実 ${stored.masteredQuestionIds.length} / ${BANK.length}`));
    appendIntro(body);
    const review=create("section","koh-awase-review");review.setAttribute("aria-label","復習帳");
    review.append(create("h3",null,session.missed.length?"もう一度確かめる香":"今回の要点"));
    const items=session.missed.length?session.missed:session.questions;
    items.forEach(question=>{
      const item=create("div","koh-awase-review-item");item.append(create("strong",null,question.prompt),create("div",null,question.explain));review.append(item);
    });
    body.append(review);
    const actions=create("div","koh-awase-actions");const again=create("button","koh-awase-action","もう一度合せる");again.type="button";again.addEventListener("click",start);actions.append(again);body.append(actions);sheet.append(body);again.focus();
  }
  function handleKeydown(event){
    if(!modal||!modal.classList.contains("is-open"))return;
    if(event.key==="Escape"){event.preventDefault();close();return;}
    if(!session||session.answered||session.complete)return;
    const number=Number(event.key);
    if(number>=1&&number<=4){event.preventDefault();answer(number-1);return;}
    const buttons=Array.from(modal.querySelectorAll(".koh-awase-option:not([disabled])"));
    const active=document.activeElement;const current=buttons.indexOf(active);
    if((event.key==="ArrowDown"||event.key==="ArrowRight")&&buttons.length){event.preventDefault();buttons[(current+1+buttons.length)%buttons.length].focus();}
    if((event.key==="ArrowUp"||event.key==="ArrowLeft")&&buttons.length){event.preventDefault();buttons[(current-1+buttons.length)%buttons.length].focus();}
  }
  function injectEntry(){
    const host=document.querySelector("#taikenSubPanel .t-modes");
    if(!host||document.getElementById(ENTRY_ID))return !!host;
    const button=create("button","t-btn koh-awase-entry");
    button.id=ENTRY_ID;button.type="button";button.title="薫物合を学ぶ";button.setAttribute("aria-label","薫物合 香合わせを開く");
    const meta=create("span","mode-meta","香文化 / 学習");
    const icon=create("span","cat-icon","香");
    const name=create("span","mode-name","香合わせ");
    const detail=create("small",null,"六種の薫物を名・季節・場から読み解く");
    button.append(meta,icon,name,detail);
    button.addEventListener("click",open);host.append(button);return true;
  }
  function getState(){
    const current=session&&!session.complete?session.questions[session.index]:null;
    return {bestScore:stored.bestScore,plays:stored.plays,masteredQuestionIds:stored.masteredQuestionIds.slice(),session:session?{index:session.index,score:session.score,answered:session.answered,complete:session.complete,questionId:current?current.id:null,answer:current?current.answer:null}:null};
  }
  function reset(){
    stored={bestScore:0,plays:0,masteredQuestionIds:[]};session=null;
    try{if(window.localStorage)window.localStorage.removeItem(STORAGE_KEY);}catch(error){}
    return getState();
  }
  function boot(){
    stored=readState();injectStyle();
    if(injectEntry())return;
    let attempts=0;
    const timer=window.setInterval(()=>{attempts+=1;if(injectEntry()||attempts>=40)window.clearInterval(timer);},250);
  }
  window.KOH_AWASE={open,close,start,answer,next,getState,questionBank:BANK.slice(),reset};
  window.KOH_AWASE_STATUS={ready:true,questions:BANK.length,storageKey:STORAGE_KEY};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
