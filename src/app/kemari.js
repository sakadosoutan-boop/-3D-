/*
 * 蹴鞠: 鞠の軌道を読み、位置取り・蹴り分け・仲間との連携で四つの懸を巡る協力型ゲーム。
 * 既存互換 API: startKemari / stopKemari / kemariAttemptKick / kemariBeginFlight。
 */
const KEMARI_CFG={
  /* 場面図は 720×500 の固定縮尺で描く。画面が縦長のときは padTop/padBot のぶんだけ
     空を上へ・白砂を下へ広げて画面を使い切る(場面そのものの比率と大きさは変えない)。 */
  W:720,H:500,groundY:350,padTop:0,padBot:0,maxPad:400,
  baseFlight:1950,minFlight:1300,
  perfectWindow:0.085,goodWindow:0.18,saveWindow:0.26,
  rounds:[
    {name:"初懸・松",goal:5,blurb:"受けで鞠の間を知る"},
    {name:"中懸・桜",goal:7,blurb:"高蹴りと渡しで輪をつなぐ"},
    {name:"風懸・柳",goal:8,blurb:"柳風に流れる軌道を、足運びで迎える"},
    {name:"結懸・楓",goal:10,blurb:"雅を保ち、八人で鞠を成就する"}
  ],
  laneX:[-1,0,1],
  techniques:{
    receive:{label:"受け",key:"Z",color:"#d9d4a4",hint:"低く来る鞠を、やわらかく受ける"},
    high:{label:"高蹴り",key:"X",color:"#f1b96a",hint:"高い弧をつくり、仲間に時間を渡す"},
    pass:{label:"渡し",key:"C",color:"#99cfbe",hint:"横の間を読み、次の鞠足へ渡す"}
  }
};
const KEMARI_KAKEGOE=["アリ","ヤア","オウ"];
const KEMARI_KAKARI=[
  {name:"松",kind:"pine",color:"#547d50"},
  {name:"桜",kind:"sakura",color:"#d88c9e"},
  {name:"柳",kind:"willow",color:"#8caf6c"},
  {name:"楓",kind:"maple",color:"#ba6245"}
];
const KMR_STORAGE="shinden3d-kemari-best";
let KMR=null,kmrLoopActive=false,_kmrLastTs=0,_kmrBound=false;

function kmr$(id){return typeof $==="function"?$(id):document.getElementById(id);}
function kmrNow(){return performance&&performance.now?performance.now():Date.now();}
function kmrReduced(){return !!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);}
function kmrLowPower(){return !!(window.LOW_POWER&&window.LOW_POWER.active);}
function kmrTextScale(){return innerWidth<=520?1.55:1;}
function kmrClamp(v,a,b){return Math.max(a,Math.min(b,v));}
function kmrLerp(a,b,t){return a+(b-a)*t;}
function kmrEase(t){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
function kmrRand(S){S.seed=(S.seed*1664525+1013904223)>>>0;return S.seed/4294967296;}
function kmrPick(S,a){return a[Math.floor(kmrRand(S)*a.length)];}
function kmrSafe(fn){try{return fn();}catch(e){return undefined;}}
function kmrOnlineContext(){
  return kmrSafe(()=>window.ONLINE_COMPETITION?.consumeChallengeContext?.("kemari"))||null;
}

function kmrLoadBest(){
  try{
    const raw=JSON.parse(localStorage.getItem(KMR_STORAGE)||"{}");
    return {
      rally:Number(raw.rally)||0,score:Number(raw.score)||0,
      round:Number(raw.round)||0,clears:Number(raw.clears)||0
    };
  }catch(e){return{rally:0,score:0,round:0,clears:0};}
}
function kmrSaveBest(next){kmrSafe(()=>localStorage.setItem(KMR_STORAGE,JSON.stringify(next)));}
function kmrSeenHelp(){return kmrSafe(()=>localStorage.getItem("shinden3d-kemari-help")==="1")||false;}
function kmrMarkHelpSeen(){kmrSafe(()=>localStorage.setItem("shinden3d-kemari-help","1"));}
function kmrSetText(id,text){const el=kmr$(id);if(el)el.textContent=String(text);}

function kmrShowJudge(text,kind){
  const el=kmr$("kmrJudge");if(!el)return;
  if(KMR&&KMR.judgeTimer)clearTimeout(KMR.judgeTimer);
  el.textContent=text;el.className="kmr-judge show "+(kind||"");
  if(KMR)KMR.judgeTimer=setTimeout(()=>{if(el)el.classList.remove("show");},kind==="miss"?1450:1100);
}
function kmrSound(kind){
  if(typeof beep!=="function")return;
  if(kind==="perfect")beep(930,.07,"triangle",.075);
  else if(kind==="good")beep(720,.065,"triangle",.06);
  else if(kind==="save")beep(490,.055,"sine",.045);
  else beep(220,.12,"sawtooth",.06);
}
function kmrTimer(S,fn,ms){
  const id=setTimeout(()=>{S.timers=S.timers.filter(v=>v!==id);fn();},ms);
  S.timers.push(id);return id;
}
function kmrClearTimers(S){if(!S)return;(S.timers||[]).forEach(clearTimeout);S.timers=[];}

function kmrInitialState(){
  const best=kmrLoadBest();
  const online=kmrOnlineContext();
  return {
    version:3,seed:online?.seed?Number(online.seed)>>>0:(Date.now()^Math.floor(Math.random()*0xffffffff))>>>0,
    startedAt:kmrNow(),onlineSubmitted:false,
    best,round:0,roundHits:0,rally:0,score:0,combo:0,maxCombo:0,
    stamina:100,miyabi:18,poise:3,teamSync:0,
    playerX:0,targetX:0,selected:"receive",phase:"intro",over:false,victory:false,
    delivery:null,nextPartner:1,impact:0,shake:0,particles:[],trails:[],
    kickQueued:false,quickStep:false,flowTurns:0,
    online,onlineSyncBusy:false,onlineNextSync:0,onlineNextPublish:0,
    lastTs:0,lastHud:0,judgeTimer:null,timers:[],helpOpen:false,
    message:"鞠庭に入り、仲間の声と鞠の弧を読む。"
  };
}

function kmrRound(){return KEMARI_CFG.rounds[Math.min((KMR&&KMR.round)||0,KEMARI_CFG.rounds.length-1)];}
function kmrTechnique(){return KEMARI_CFG.techniques[(KMR&&KMR.selected)||"receive"];}
function kmrSetTechnique(id){
  if(!KMR||!KEMARI_CFG.techniques[id])return;
  KMR.selected=id;
  const tech=KEMARI_CFG.techniques[id];
  KMR.message=`${tech.label}を選んだ。${tech.hint}`;
  kmrShowJudge(`${tech.label}　${tech.key}キー / 下の札で選ぶ`,"good");
  kmrUpdateHud(true);
}
function kmrMovePlayer(step){
  if(!KMR||KMR.over)return;
  KMR.targetX=kmrClamp(KMR.targetX+step,-1,1);
  KMR.message=KMR.targetX<-.34?"左の間へ寄る":KMR.targetX>.34?"右の間へ寄る":"中央で鞠を待つ";
}
/* 盤面の座標から直接その位置へ寄る。現在は左右ボタンとキーで動かすため未使用だが、
   外部(テスト・オンライン対戦)から位置を指定できるようAPIとして残す。 */
function kmrMoveTo(x){
  if(!KMR||KMR.over)return;
  KMR.targetX=kmrClamp(x,-1,1);
}

function kmrTechniqueForDelivery(S,partner){
  const n=S.roundHits+S.rally;
  if(S.round===0)return n%4===3?"high":"receive";
  if(S.round===1)return ["receive","pass","high","pass"][n%4];
  const cycle=partner===0?["pass","high","receive"]:partner===2?["pass","receive","high"]:["high","pass","receive"];
  return cycle[n%cycle.length];
}
function kmrCreateDelivery(S){
  const partner=S.nextPartner;
  const technique=kmrTechniqueForDelivery(S,partner);
  let lane;
  if(technique==="pass")lane=partner===0?-1:partner===2?1:(kmrRand(S)<.5?-1:1);
  else lane=KEMARI_CFG.laneX[Math.floor(kmrRand(S)*3)];
  if(technique==="high"&&kmrRand(S)<.62)lane=0;
  const flight=Math.max(KEMARI_CFG.minFlight,KEMARI_CFG.baseFlight-S.rally*21-S.round*105);
  const peak=technique==="high"?238:technique==="pass"?158:132;
  const fromX=[-1.24,0,1.24][partner];
  const drift=(kmrRand(S)-.5)*(S.round>=2?(technique==="pass"?82:58):(technique==="pass"?36:20));
  const calls=["アリ、こちらへ。","ヤア、間を取って。","オウ、鞠を見よ。"];
  return {partner,technique,lane,fromX,drift,flight,peak,start:kmrNow(),call:kmrPick(S,calls),landX:lane};
}
function kemariBeginFlight(delay){
  const S=KMR;if(!S||S.over)return;
  S.phase="wait";
  kmrTimer(S,()=>{
    if(KMR!==S||S.over)return;
    S.delivery=kmrCreateDelivery(S);S.phase="flight";S.kickQueued=false;S.quickStep=false;
    /* [UI整理] 掛け声はふき出し、行き先と蹴り方は盤面中央の大書き、こつは下の一行 ——
       同じ文言を三か所に出さないよう、それぞれ別の情報を担当させる */
    S.message=KEMARI_CFG.techniques[S.delivery.technique].hint;
    kmrShowJudge(`${["左の鞠足","正面の鞠足","右の鞠足"][S.delivery.partner]}「${S.delivery.call}」`,"good");
  },Math.max(0,delay||0));
}

function kmrStartRound(S){
  const current=kmrRound();
  S.roundHits=0;S.phase="interlude";
  S.message=`${current.name}: ${current.blurb}`;
  kmrShowJudge(`${current.name}　目標 ${current.goal}鞠`,"perfect");
  kmrTimer(S,()=>kemariBeginFlight(0),kmrReduced()?300:980);
}
function startKemari(){
  if(KMR)kmrClearTimers(KMR);
  KMR=kmrInitialState();
  const go=kmr$("kemariGameOver"),newBest=kmr$("kmrNewBest"),judge=kmr$("kmrJudge"),help=kmr$("kemariHelp");
  if(go)go.classList.remove("show");if(newBest)newBest.classList.remove("show");
  if(judge){judge.textContent="";judge.className="kmr-judge";}
  KMR.helpOpen=!kmrSeenHelp()&&!!help;if(help)help.classList.toggle("show",KMR.helpOpen);
  kmrSetText("kmrRally",0);kmrSetText("kmrScore",0);kmrSetText("kmrBest",KMR.best.rally||0);
  const versus=kmr$("kmrVersus");
  if(versus){
    versus.hidden=!KMR.online;
    if(KMR.online){kmrSetText("kmrRivalName",KMR.online.opponentName);kmrSetText("kmrRivalScore",KMR.online.opponentStatus==="finished"?`${KMR.online.opponentScore}点`:"挑戦中");}
  }
  kmrUpdateHud(true);
  if(typeof renderer!=="undefined"&&renderer&&renderer.shadowMap){renderer.shadowMap.autoUpdate=false;}
  if(!kmrLoopActive){kmrLoopActive=true;_kmrLastTs=0;requestAnimationFrame(kemariLoop);}
  if(!KMR.helpOpen)kmrStartRound(KMR);
}
function stopKemari(){
  if(KMR){kmrClearTimers(KMR);if(KMR.judgeTimer)clearTimeout(KMR.judgeTimer);}
  KMR=null;
  if(typeof renderer!=="undefined"&&renderer&&renderer.shadowMap){renderer.shadowMap.autoUpdate=true;renderer.shadowMap.needsUpdate=true;}
}

function kmrBallAt(S,now){
  const d=S.delivery;if(!d)return null;
  const p=kmrClamp((now-d.start)/d.flight,0,1.16);
  const arc=Math.sin(Math.min(1,p)*Math.PI);
  const sx=KEMARI_CFG.W/2+d.fromX*158,ex=KEMARI_CFG.W/2+d.landX*148;
  return {p,x:kmrLerp(sx,ex,p)+Math.sin(p*Math.PI)*d.drift,y:KEMARI_CFG.groundY-arc*d.peak,arc};
}
function kmrInputQuality(S,now){
  const d=S.delivery;if(!d)return{kind:"miss",reason:"鞠が来ていない"};
  const time=Math.abs((now-d.start)/d.flight-1);
  const position=Math.abs(S.playerX-d.lane);
  const technique=S.selected===d.technique;
  const tired=S.stamina<28?.035:0;
  const flow=S.flowTurns>0;
  const perfect=KEMARI_CFG.perfectWindow-tired+(flow?.025:0);
  const good=KEMARI_CFG.goodWindow-tired+(flow?.045:0);
  const save=KEMARI_CFG.saveWindow+(flow?.04:0);
  if(time<=perfect&&position<=.27&&technique)return{kind:"perfect",time,position,technique};
  if(time<=good&&position<=.58&&technique)return{kind:"good",time,position,technique};
  if(time<=save&&Math.abs(S.targetX-d.lane)<=.12&&position<=1.05){
    S.playerX=d.lane;S.stamina=kmrClamp(S.stamina-10,0,100);S.quickStep=true;
    return{kind:"save",time,position:0,technique,quickStep:true};
  }
  if(time<=save&&position<=.86)return{kind:"save",time,position,technique};
  return{kind:"miss",time,position,technique};
}
function kemariAttemptKick(fromQueue){
  const S=KMR;if(!S||S.over||S.phase!=="flight")return false;
  const now=kmrNow(),progress=(now-S.delivery.start)/S.delivery.flight;
  if(!fromQueue&&progress<1-KEMARI_CFG.goodWindow){
    if(progress>=.42){
      S.kickQueued=true;S.message="蹴る構え。落下の瞬間に合わせる。";
      kmrShowJudge("蹴りを構えた","good");kmrUpdateHud(true);return true;
    }
    S.message="まだ遠い。落下地点へ先に寄る。";kmrShowJudge("先に位置を合わせる","good");kmrUpdateHud(true);return false;
  }
  S.kickQueued=false;
  const result=kmrInputQuality(S,now);
  kmrResolveKick(result.kind,result);return result.kind!=="miss";
}
function kemariJudge(kind){
  const S=KMR;if(!S||S.over)return;
  kmrResolveKick(kind,{kind,time:0,position:0,technique:true});
}
function kmrResolveKick(kind,data){
  const S=KMR;if(!S||S.over)return;
  if(kind==="miss"){kmrDrop(S,data);return;}
  const d=S.delivery,tech=KEMARI_CFG.techniques[d.technique];
  const correct=data.technique;
  const scoreBase=kind==="perfect"?190:kind==="good"?112:48;
  S.combo=kind==="save"?0:S.combo+1;S.maxCombo=Math.max(S.maxCombo,S.combo);
  const flowActive=S.flowTurns>0;
  const multiplier=1+Math.min(1.5,S.combo*.08)+S.miyabi*.004+(flowActive?.3:0);
  const earned=Math.round(scoreBase*multiplier+(correct?25:0));
  S.score+=earned;S.rally++;S.roundHits++;S.teamSync=kmrClamp(S.teamSync+(kind==="perfect"?15:kind==="good"?9:3),0,100);
  S.miyabi=kmrClamp(S.miyabi+(kind==="perfect"?8:kind==="good"?4:-4),0,100);
  const cost=d.technique==="high"?13:d.technique==="pass"?9:6;
  S.stamina=kmrClamp(S.stamina-cost-(Math.abs(S.targetX-S.playerX)>.42?3:0),0,100);
  if(flowActive)S.flowTurns--;
  let flowStarted=false;
  if(S.teamSync>=100&&S.flowTurns<=0){
    S.flowTurns=3;S.teamSync=58;flowStarted=true;
  }
  S.impact=1;S.shake=kind==="perfect"?5:2;
  kmrBurst(S,kmrBallAt(S,kmrNow()),kind);
  const call=kmrPick(S,KEMARI_KAKEGOE);
  const label=kind==="perfect"?"見事":kind==="good"?"良し":"拾い鞠";
  const detail=data.quickStep?`詰め足で拾い、${call}`:correct?`${tech.label}で${call}`:`${tech.label}ではないが、仲間が拾った`;
  S.message=flowStarted?`連携の舞！ 三鞠のあいだ、蹴りの間が広がる。`:`${label}。${detail}　+${earned}`;
  kmrShowJudge(flowStarted?`連携の舞　三鞠の好機`:`${label}！ ${call}　+${earned}`,flowStarted?"perfect":kind);
  kmrSound(kind);
  S.phase="return";
  S.nextPartner=kmrNextPartner(S,d,kind);
  kmrPublishOnline(S);
  kmrUpdateHud(true);
  if(S.roundHits>=kmrRound().goal){
    kmrTimer(S,()=>kmrCompleteRound(S),kmrReduced()?260:720);
  }else{
    kmrTimer(S,()=>kemariBeginFlight(0),kmrReduced()?240:kind==="perfect"?560:760);
  }
}
function kmrNextPartner(S,d,kind){
  if(kind==="save")return 1;
  if(d.technique==="pass")return d.lane<0?0:2;
  if(d.technique==="high")return d.partner===1?(kmrRand(S)<.5?0:2):1;
  return d.partner===0?1:d.partner===1?(S.playerX<0?0:2):1;
}
function kmrDrop(S,data){
  S.poise--;S.combo=0;S.teamSync=kmrClamp(S.teamSync-18,0,100);S.miyabi=kmrClamp(S.miyabi-9,0,100);
  S.impact=.5;S.shake=7;S.message=`鞠が乱れた。残る余裕は ${Math.max(0,S.poise)}。`;
  kmrSound("miss");if(typeof seNG==="function")kmrSafe(()=>seNG());
  kmrShowJudge(S.poise>0?"乱れた… 仲間が鞠を拾う":"鞠を落としてしまった…","miss");
  kmrUpdateHud(true);
  if(S.poise<=0){S.over=true;S.phase="over";kemariGameOver(false);return;}
  S.phase="recovery";
  kmrTimer(S,()=>{if(KMR===S&&!S.over){S.nextPartner=1;kemariBeginFlight(0);}},kmrReduced()?350:1150);
}
function kmrCompleteRound(S){
  if(KMR!==S||S.over)return;
  S.score+=320+S.round*150+S.poise*45;S.miyabi=kmrClamp(S.miyabi+12,0,100);
  const completed=kmrRound();
  if(S.round>=KEMARI_CFG.rounds.length-1){
    S.over=true;S.victory=true;S.phase="clear";
    S.message=`${completed.name}を成就。皆で鞠を地に落とさず結んだ。`;
    kmrShowJudge("成就！ 四つの懸に鞠が通った", "perfect");kmrBurst(S,{x:KEMARI_CFG.W/2,y:180},"perfect");
    kmrTimer(S,()=>kemariGameOver(true),kmrReduced()?400:1300);
  }else{
    S.round++;S.combo=0;S.nextPartner=1;
    kmrStartRound(S);
  }
  kmrUpdateHud(true);
}
function kemariGameOver(victory){
  const S=KMR;if(!S)return;
  const prev=kmrLoadBest(),won=typeof victory==="boolean"?victory:S.victory;
  const next={
    rally:Math.max(S.rally,prev.rally),score:Math.max(S.score,prev.score),
    round:Math.max(S.round+(won?1:0),prev.round),clears:prev.clears+(won?1:0)
  };
  kmrSaveBest(next);kmrSetText("kmrBest",next.rally);
  kmrSetText("kmrGoTitle",won?"四懸成就":"鞠会、納め");
  const el=kmr$("kmrGoDetail");
  if(el){
    const title=won?"四つの懸を巡り、鞠を成就した。":"鞠は地に落ちたが、次の一鞠へ学びは残る。";
    el.innerHTML=`${title}<br>続け鞠: <b>${S.rally}回</b>　最高連携: <b>${S.maxCombo}</b><br>得点: <b>${S.score}</b>　雅: <b>${Math.round(S.miyabi)}</b><br>自己最高: <b>${next.rally}回 / ${next.score}点</b>${won?`<br>成就回数: <b>${next.clears}</b>`:""}`;
  }
  const newBest=kmr$("kmrNewBest");if(newBest)newBest.classList.toggle("show",S.score>prev.score||won&&S.round+1>prev.round);
  const go=kmr$("kemariGameOver");if(go)go.classList.add("show");
  if((S.score>prev.score||won)&&typeof juiceCelebrate==="function")kmrSafe(()=>juiceCelebrate());
  if(typeof recordProgress==="function")kmrSafe(()=>recordProgress("kemari",1));
  if(typeof gainParam==="function")kmrSafe(()=>gainParam("miyabi",won?5:2));
  if(!S.onlineSubmitted&&window.ONLINE_COMPETITION){
    S.onlineSubmitted=true;
    const duration=Math.max(0,Math.round(kmrNow()-S.startedAt));
    const meta={rally:S.rally,maxCombo:S.maxCombo,victory:won,round:S.round+1};
    window.ONLINE_COMPETITION.finishChallenge("kemari",S.score,duration,meta)
      .then(handled=>{if(!handled)window.ONLINE_COMPETITION.submitScore("kemari",S.score,duration,meta);})
      .catch(()=>window.ONLINE_COMPETITION.submitScore("kemari",S.score,duration,meta));
  }
}

function kmrApplyOnlineContext(S,context){
  if(!S||KMR!==S||!context||context.matchId!==S.online?.matchId)return;
  S.online=context;
  const versus=kmr$("kmrVersus");if(versus)versus.hidden=false;
  kmrSetText("kmrRivalName",context.opponentName||"対戦相手");
  kmrSetText("kmrRivalScore",context.opponentStatus==="finished"?`${context.opponentScore||0}点`:`${context.opponentScore||0}点・挑戦中`);
}
function kmrPublishOnline(S,force){
  if(!S?.online||S.onlineSyncBusy||!window.ONLINE_COMPETITION?.updateChallengeProgress)return;
  const now=kmrNow();if(!force&&now<S.onlineNextPublish)return;
  S.onlineNextPublish=now+900;S.onlineSyncBusy=true;
  Promise.resolve(window.ONLINE_COMPETITION.updateChallengeProgress("kemari",S.score,Math.round(now-S.startedAt),{
    rally:S.rally,round:S.round+1,combo:S.combo,flow:S.flowTurns
  })).then(context=>kmrApplyOnlineContext(S,context)).catch(()=>{}).finally(()=>{if(KMR===S)S.onlineSyncBusy=false;});
}
function kmrSyncOnline(S,now){
  if(!S?.online||S.onlineSyncBusy||now<S.onlineNextSync||!window.ONLINE_COMPETITION?.syncChallenge)return;
  S.onlineNextSync=now+1400;S.onlineSyncBusy=true;
  Promise.resolve(window.ONLINE_COMPETITION.syncChallenge("kemari"))
    .then(context=>kmrApplyOnlineContext(S,context)).catch(()=>{}).finally(()=>{if(KMR===S)S.onlineSyncBusy=false;});
}

function kmrBurst(S,ball,kind){
  if(!ball||kmrReduced()||kmrLowPower())return;
  const count=kind==="perfect"?12:kind==="good"?7:4;
  for(let i=0;i<count;i++){
    const a=kmrRand(S)*Math.PI*2,sp=28+kmrRand(S)*64;
    S.particles.push({x:ball.x,y:ball.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-30,life:.5+kmrRand(S)*.45,max:.9,color:kind==="perfect"?"#f8d87e":kind==="good"?"#a7dfc5":"#dccca7"});
  }
}
function kmrUpdate(dt){
  const S=KMR;if(!S)return;
  const now=kmrNow();
  const move=Math.abs(S.targetX-S.playerX);
  if(move>.004){
    let pace=S.stamina<20?2.15:3.8;
    if(S.phase==="flight"&&S.delivery){
      const remaining=Math.max(.12,(1-(now-S.delivery.start)/S.delivery.flight)*S.delivery.flight/1000);
      pace=Math.max(pace,Math.min(8.5,move/Math.max(.12,remaining-.1)*1.08));
    }
    S.playerX=kmrLerp(S.playerX,S.targetX,Math.min(1,pace*dt));
    S.stamina=kmrClamp(S.stamina-dt*4.4,0,100);
  }else S.stamina=kmrClamp(S.stamina+dt*2.25,0,100);
  S.impact=Math.max(0,S.impact-dt*3.8);S.shake=Math.max(0,S.shake-dt*13);
  S.particles=S.particles.filter(p=>{
    p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=125*dt;return p.life>0;
  });
  if(S.phase==="flight"&&S.delivery){
    const p=(now-S.delivery.start)/S.delivery.flight;
    if(S.kickQueued&&p>=1-(KEMARI_CFG.perfectWindow+(S.flowTurns>0?.025:0))*.72){
      kemariAttemptKick(true);
      kmrSyncOnline(S,now);
      return;
    }
    if(p>1+KEMARI_CFG.saveWindow)kmrDrop(S,{kind:"miss"});
  }
  kmrSyncOnline(S,now);
}
function kmrUpdateHud(force){
  const S=KMR;if(!S)return;
  const now=kmrNow();if(!force&&now-S.lastHud<130)return;S.lastHud=now;
  kmrSetText("kmrRally",S.rally);kmrSetText("kmrScore",S.score);
  kmrSetText("kmrRound",`${S.round+1}/${KEMARI_CFG.rounds.length}`);
  kmrSetText("kmrCombo",S.combo);kmrSetText("kmrStamina",Math.round(S.stamina));kmrSetText("kmrMiyabi",Math.round(S.miyabi));
  kmrSetText("kmrObjective",`${kmrRound().name} ${S.roundHits}/${kmrRound().goal}`);
  kmrSetText("kmrLives",`${"◈".repeat(S.poise)}${"◇".repeat(3-S.poise)}`);
  kmrSetText("kmrFlow",S.message);
  kmrSetText("kmrSync",S.flowTurns>0?`舞 ${S.flowTurns}`:`${Math.round(S.teamSync)}%`);
  const syncFill=kmr$("kmrSyncFill");if(syncFill)syncFill.style.width=`${S.flowTurns>0?100:S.teamSync}%`;
  const readout=kmr$("kmrReadout"),timingFill=kmr$("kmrTimingFill"),kick=kmr$("kmrKick");
  if(readout){readout.classList.toggle("is-flow",S.flowTurns>0);readout.classList.toggle("is-queued",!!S.kickQueued);}
  if(S.delivery&&S.phase==="flight"){
    const d=S.delivery,p=kmrClamp((now-d.start)/d.flight,0,1.08);
    const timing=p<1-KEMARI_CFG.goodWindow?"位置を合わせる":p<=1+KEMARI_CFG.saveWindow?"いま蹴る":"遅い";
    kmrSetText("kmrLaneCue",["左","中央","右"][d.lane+1]);
    kmrSetText("kmrTechniqueCue",KEMARI_CFG.techniques[d.technique].label);
    kmrSetText("kmrTimingCue",S.kickQueued?"構え済み":timing);
    if(timingFill)timingFill.style.width=`${kmrClamp(p,0,1)*100}%`;
    const ready=p>=1-KEMARI_CFG.goodWindow&&p<=1+KEMARI_CFG.saveWindow;
    if(readout)readout.classList.toggle("is-ready",ready);
    if(kick)kick.classList.toggle("is-ready",ready||S.kickQueued);
  }else{
    kmrSetText("kmrLaneCue","待機");kmrSetText("kmrTechniqueCue","―");kmrSetText("kmrTimingCue","次の鞠を待つ");
    if(timingFill)timingFill.style.width="0%";
    if(readout)readout.classList.remove("is-ready");
    if(kick)kick.classList.remove("is-ready");
  }
  const controls=kmr$("kmrControls");
  if(controls){controls.dataset.phase=S.phase;controls.setAttribute("aria-label",S.phase==="flight"?"鞠を蹴る":"鞠が来るのを待つ");}
  [["kmrReceive","receive"],["kmrHigh","high"],["kmrPass","pass"]].forEach(([id,tech])=>{
    const el=kmr$(id);if(!el)return;const selected=S.selected===tech;
    el.classList.toggle("selected",selected);el.setAttribute("aria-pressed",String(selected));
  });
}

/* 色を明暗に振る小ヘルパー(装束の陰影付け用) */
function kmrShade(hex,amt){
  const n=parseInt(hex.slice(1),16);
  const cl=v=>Math.max(0,Math.min(255,Math.round(v)));
  const r=cl(((n>>16)&255)+255*amt),g=cl(((n>>8)&255)+255*amt),b=cl((n&255)+255*amt);
  return `rgb(${r},${g},${b})`;
}
/* 懸(かかり)の木: 鞠庭の四隅に立つ松・桜・柳・楓。幹と枝を持たせ、樹種ごとに葉の付き方を描き分ける */
function kmrDrawTree(ctx,k,x,y,scale){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineCap="round";
  // 幹(根元を太く、上へ細く)＋枝
  ctx.strokeStyle="#4a3626";ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,38);ctx.quadraticCurveTo(-2,10,-1,-14);ctx.stroke();
  ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-1,-2);ctx.quadraticCurveTo(-9,-8,-15,-16);ctx.moveTo(-1,-6);ctx.quadraticCurveTo(8,-12,14,-19);ctx.stroke();
  const c=k.color,lo=kmrShade(c,-.10),hi=kmrShade(c,.10);
  if(k.kind==="pine"){                          // 松: 層になった枝葉
    for(let i=0;i<4;i++){
      const w=23-i*4.2,yy=-16-i*11;
      ctx.fillStyle=i%2?lo:c;ctx.beginPath();
      ctx.moveTo(0,yy-13);ctx.quadraticCurveTo(w*.75,yy-2,w,yy+7);
      ctx.quadraticCurveTo(w*.3,yy+3,0,yy+9);
      ctx.quadraticCurveTo(-w*.3,yy+3,-w,yy+7);ctx.quadraticCurveTo(-w*.75,yy-2,0,yy-13);
      ctx.closePath();ctx.fill();
    }
  }else if(k.kind==="willow"){                  // 柳: 細くしなだれる枝を疎らに
    ctx.fillStyle=lo;ctx.beginPath();ctx.ellipse(0,-26,17,8,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(-3,-29,12,6,0,0,Math.PI*2);ctx.fill();
    ctx.lineWidth=1.5;
    for(let i=-3;i<=3;i++){
      ctx.strokeStyle=i%2?c:hi;ctx.beginPath();
      const x0=i*5;ctx.moveTo(x0,-26);
      ctx.bezierCurveTo(x0+i*2.4,-14,x0+i*3.6,-2,x0+i*3.2+1.5,14+Math.abs(i)*3);ctx.stroke();
    }
  }else if(k.kind==="sakura"){                  // 桜: ふくらむ花叢＋散る花びら
    [[0,-34,17],[-15,-22,12],[15,-22,12],[-8,-12,10],[9,-11,10]].forEach(([bx,by,br],i)=>{
      ctx.fillStyle=i%2?hi:c;ctx.beginPath();ctx.arc(bx,by,br,0,Math.PI*2);ctx.fill();});
    ctx.fillStyle=kmrShade(c,.18);
    for(let i=0;i<9;i++){const a=i*2.1;ctx.beginPath();ctx.ellipse(Math.cos(a)*20,-24+Math.sin(a)*15,2.4,1.6,a,0,Math.PI*2);ctx.fill();}
  }else{                                        // 楓: 丸い葉叢に浅い切れ込みを入れ、紅葉の色を重ねる
    [[0,-33,16],[-14,-21,12],[14,-21,12],[-7,-11,10],[8,-10,10]].forEach(([bx,by,br],i)=>{
      ctx.fillStyle=i%2?lo:c;ctx.beginPath();
      for(let s=0;s<=18;s++){const a=s/18*Math.PI*2,rr=br*(1-.14*Math.abs(Math.sin(a*2.5)));
        const px=bx+Math.cos(a)*rr,py=by+Math.sin(a)*rr*.88;s===0?ctx.moveTo(px,py):ctx.lineTo(px,py);}
      ctx.closePath();ctx.fill();});
    ctx.fillStyle=kmrShade(c,.16);
    [[-6,-30,5],[7,-26,4.4],[-12,-16,3.8]].forEach(([bx,by,br])=>{ctx.beginPath();ctx.arc(bx,by,br,0,Math.PI*2);ctx.fill();});
  }
  ctx.restore();
}
/* 鞠庭(まりにわ): 空・遠景の築地塀・白砂の庭・懸の木。平面的な塗りをやめ、奥行きのある庭に */
function kmrDrawPaper(ctx){
  const {W,H,groundY,padTop,padBot}=KEMARI_CFG;
  const top=-padTop,bottom=H+padBot;      // 縦長画面で広げた空と白砂の端
  // 空(薄明の青緑→淡金)
  const sky=ctx.createLinearGradient(0,top,0,groundY);
  sky.addColorStop(0,"#33506b");sky.addColorStop(.55,"#7f9ea4");sky.addColorStop(1,"#e0cfa4");
  ctx.fillStyle=sky;ctx.fillRect(0,top,W,groundY-top);
  // 薄雲(空の余白を埋め、庭に空気感を出す)
  ctx.fillStyle="rgba(255,247,226,.14)";
  [[130,58,86,13],[330,36,64,10],[560,66,96,14],[240,92,58,9],[640,30,52,8]].forEach(([cx,cy,cw,ch])=>{
    ctx.beginPath();ctx.ellipse(cx,cy,cw,ch,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(cx+cw*.42,cy+ch*.4,cw*.6,ch*.75,0,0,Math.PI*2);ctx.fill();
  });
  const hz=groundY-38;                          // 地平線(白砂のはじまり)。建物も塀もここに足を着ける
  // 遠山のシルエット(寝殿の棟より高く出して、屋根の左右から覗かせる)
  ctx.fillStyle="rgba(58,74,74,.5)";ctx.beginPath();ctx.moveTo(0,hz-78);
  for(let i=0;i<=W;i+=40)ctx.lineTo(i,hz-78-Math.sin(i*.011)*30-Math.sin(i*.026)*13);
  ctx.lineTo(W,hz);ctx.lineTo(0,hz);ctx.closePath();ctx.fill();
  // 築地塀(ついじべい): 寝殿の左右にだけ覗かせ、邸内であることを示す
  ctx.fillStyle="#6d5c48";ctx.fillRect(0,hz-26,W,26);
  ctx.fillStyle="#4b3d2f";ctx.fillRect(0,hz-32,W,8);
  /* 寝殿(南面)。以前は屋根だけが宙に浮き、奥の鞠足がその上に立っているように見えていた。
     屋根→御簾の下がる廂→高欄つきの簀子→床下の柱、と地平まで積んで建物として立たせる。 */
  ctx.save();
  const cx0=W/2, bw=302;                        // 建物の半幅
  const flr=hz-12,          // 床下(柱)の下端は地平のすこし手前
        sun=hz-30,          // 簀子(えんがわ)の高さ
        wallT=hz-70,        // 廂の壁の上端(＝軒下)
        rB=hz-64, rT=hz-120;// 軒先 / 棟
  // 床下の柱と、その影
  ctx.fillStyle="rgba(38,28,20,.55)";ctx.fillRect(cx0-bw,sun,bw*2,flr-sun+12);
  ctx.fillStyle="#4a3b2c";
  for(let i=-5;i<=5;i++)ctx.fillRect(cx0+i*54-4,sun,8,flr-sun+12);
  // 簀子(縁)と高欄
  ctx.fillStyle="#8a7154";ctx.fillRect(cx0-bw-10,sun-9,bw*2+20,10);
  ctx.fillStyle="#6d5840";ctx.fillRect(cx0-bw-10,sun+1,bw*2+20,4);
  ctx.strokeStyle="#9d4a35";ctx.lineWidth=3;                        // 朱の高欄
  ctx.beginPath();ctx.moveTo(cx0-bw-6,sun-20);ctx.lineTo(cx0+bw+6,sun-20);ctx.stroke();
  ctx.lineWidth=2.4;
  for(let i=-10;i<=10;i++){ctx.beginPath();ctx.moveTo(cx0+i*29,sun-20);ctx.lineTo(cx0+i*29,sun-9);ctx.stroke();}
  // 廂の奥(暗がり)と、下がった御簾
  ctx.fillStyle="#241a12";ctx.fillRect(cx0-bw,wallT,bw*2,sun-20-wallT);
  ctx.fillStyle="#7d6a44";
  for(let i=-4;i<=4;i++)ctx.fillRect(cx0+i*66-27,wallT+3,54,sun-26-wallT);   // 御簾
  ctx.strokeStyle="rgba(30,22,12,.5)";ctx.lineWidth=1;
  for(let y=wallT+7;y<sun-24;y+=5){ctx.beginPath();ctx.moveTo(cx0-bw,y);ctx.lineTo(cx0+bw,y);ctx.stroke();}
  ctx.fillStyle="#4a3b2c";                                          // 柱
  for(let i=-4;i<=4;i++)ctx.fillRect(cx0+i*66+27,wallT,10,sun-20-wallT);
  // 檜皮葺の大屋根(反りのある軒)
  ctx.fillStyle="#4f3d2d";ctx.beginPath();
  ctx.moveTo(cx0-bw-52,rB);
  ctx.quadraticCurveTo(cx0-262,rB-14,cx0-168,rT+8);
  ctx.lineTo(cx0-150,rT);ctx.lineTo(cx0+150,rT);
  ctx.quadraticCurveTo(cx0+262,rB-14,cx0+bw+52,rB);
  ctx.closePath();ctx.fill();
  ctx.fillStyle="#3a2c20";ctx.fillRect(cx0-158,rT-6,316,7);          // 棟木
  ctx.strokeStyle="rgba(255,246,222,.08)";ctx.lineWidth=1;           // 檜皮の葺き足
  for(let i=1;i<4;i++){const t=i/4,y=rB-(rB-rT)*t,hw=(bw+52)-190*t;
    ctx.beginPath();ctx.moveTo(cx0-hw,y);ctx.lineTo(cx0+hw,y);ctx.stroke();}
  ctx.fillStyle="#7f6a51";ctx.fillRect(cx0-bw-34,rB-2,(bw+34)*2,8);  // 軒桁
  ctx.restore();
  // 白砂の庭(手前ほど明るく)
  const gnd=ctx.createLinearGradient(0,groundY-38,0,bottom);
  gnd.addColorStop(0,"#b3a984");gnd.addColorStop(.4,"#cdc2a0");gnd.addColorStop(1,"#ded3b2");
  ctx.fillStyle=gnd;ctx.fillRect(0,groundY-38,W,bottom-groundY+38);
  // 箒目(遠近に合わせて間隔を開く)
  ctx.strokeStyle="rgba(255,250,236,.30)";ctx.lineWidth=1.2;
  for(let i=0;i<22;i++){const yy=groundY-30+i*i*.9+i*3.4;if(yy>bottom)break;
    ctx.beginPath();ctx.moveTo(0,yy);ctx.bezierCurveTo(W*.3,yy-2,W*.7,yy+2,W,yy);ctx.stroke();}
  // 鞠の輪(懸の内側の見当)
  ctx.strokeStyle="rgba(120,96,58,.30)";ctx.lineWidth=1.6;
  ctx.beginPath();ctx.ellipse(W/2,groundY+30,268,60,0,0,Math.PI*2);ctx.stroke();
  // 四本懸: 奥2本は小さく、手前2本は大きく=遠近
  kmrDrawTree(ctx,KEMARI_KAKARI[0],58,groundY-18,.86);
  kmrDrawTree(ctx,KEMARI_KAKARI[1],W-58,groundY-18,.86);
  kmrDrawTree(ctx,KEMARI_KAKARI[2],34,groundY+52,1.18);
  kmrDrawTree(ctx,KEMARI_KAKARI[3],W-34,groundY+52,1.18);
}
function kmrDrawTrajectory(ctx,S,ball){
  const d=S.delivery;if(!d||!ball)return;
  const now=kmrNow(),p=kmrClamp((now-d.start)/d.flight,0,1);
  ctx.save();ctx.setLineDash([3,6]);ctx.strokeStyle="rgba(252,234,183,.48)";ctx.lineWidth=1.35;ctx.beginPath();
  for(let i=0;i<=30;i++){
    const t=kmrLerp(p,1,i/30),arc=Math.sin(t*Math.PI);
    const x=kmrLerp(KEMARI_CFG.W/2+d.fromX*158,KEMARI_CFG.W/2+d.landX*148,t)+Math.sin(t*Math.PI)*d.drift;
    const y=KEMARI_CFG.groundY-arc*d.peak;
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.stroke();ctx.setLineDash([]);
  const tx=KEMARI_CFG.W/2+d.landX*148;
  ctx.strokeStyle=KEMARI_CFG.techniques[d.technique].color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(tx,KEMARI_CFG.groundY,17+Math.abs(Math.sin(now*.006))*3,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}
/* 鞠(まり): 鹿革を八片に縫い合わせた白い鞠。縫い目と艶で革らしさを出す */
function kmrDrawBall(ctx,ball,S){
  if(!ball)return;
  const r=14+ball.arc*3;ctx.save();ctx.translate(ball.x,ball.y);
  const drop=KEMARI_CFG.groundY-ball.y;
  ctx.fillStyle=`rgba(96,80,48,${kmrClamp(.30-drop*.0007,.05,.30)})`;
  ctx.beginPath();ctx.ellipse(0,drop+10,18,4.6,0,0,Math.PI*2);ctx.fill();
  const grad=ctx.createRadialGradient(-r*.38,-r*.44,r*.1,0,0,r*1.06);
  grad.addColorStop(0,"#fffdf3");grad.addColorStop(.55,"#f0e2c1");grad.addColorStop(1,"#b99a68");
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle=grad;ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.clip();
  ctx.strokeStyle="rgba(120,88,48,.42)";ctx.lineWidth=1.15;   // 縦の縫い目(革の継ぎ)
  for(let i=0;i<3;i++){const o=(i-1)*r*.56;ctx.beginPath();ctx.ellipse(o,0,r*.34,r,0,0,Math.PI*2);ctx.stroke();}
  ctx.beginPath();ctx.ellipse(0,0,r,r*.3,0,0,Math.PI*2);ctx.stroke();  // 赤道の縫い目
  ctx.restore();
  ctx.strokeStyle="rgba(120,92,52,.55)";ctx.lineWidth=1.1;ctx.beginPath();ctx.arc(0,0,r-.4,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle="rgba(255,255,255,.5)";ctx.beginPath();ctx.ellipse(-r*.34,-r*.4,r*.24,r*.16,-.6,0,Math.PI*2);ctx.fill(); // 艶
  ctx.restore();
}
/* 鞠足(まりあし)の立ち姿。烏帽子・水干(菊綴・大袖)・指貫袴・鞠沓まで描く。
   原点は足元。robe=水干の色、kick>0で蹴り足が振り上がる。 */
function kmrDrawKemariFigure(ctx,o){
  const robe=o.robe||"#7d5e8e",hakama=o.hakama||kmrShade(robe,-.20),
        kick=o.kick||0,scale=o.scale||1,dim=o.dim||0;
  const lo=kmrShade(robe,-.13),hi=kmrShade(robe,.10),skin="#f0d9bd";
  ctx.save();ctx.scale(scale,scale);if(dim)ctx.globalAlpha=1-dim;
  ctx.fillStyle="rgba(92,76,46,.30)";ctx.beginPath();ctx.ellipse(0,2,19,5,0,0,Math.PI*2);ctx.fill(); // 影
  // 脚と鞠沓(蹴り足は前へ振り上げる)
  ctx.strokeStyle=hakama;ctx.lineCap="round";ctx.lineWidth=9;
  ctx.beginPath();ctx.moveTo(-6,-19);ctx.lineTo(-7,-2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(6,-19);ctx.lineTo(7+kick*.5,-2-kick*.9);ctx.stroke();
  ctx.fillStyle="#4a3b2c";
  ctx.beginPath();ctx.ellipse(-7,-1,6,3.4,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(7+kick*.5,-1-kick*.9,6,3.4,-kick*.03,0,Math.PI*2);ctx.fill();
  // 指貫袴(裾を絞ったふくらみのある袴)
  ctx.fillStyle=hakama;ctx.beginPath();
  ctx.moveTo(-13,-44);ctx.quadraticCurveTo(-20,-30,-12,-17);ctx.lineTo(-1,-17);
  ctx.lineTo(-1,-30);ctx.lineTo(1,-30);ctx.lineTo(1,-17);ctx.lineTo(12,-17);
  ctx.quadraticCurveTo(20,-30,13,-44);ctx.closePath();ctx.fill();
  ctx.fillStyle=kmrShade(hakama,-.08);ctx.fillRect(-13,-46,26,4); // 腰紐
  // 水干の身頃(肩から裾へ広がる)
  ctx.fillStyle=robe;ctx.beginPath();
  ctx.moveTo(-11,-72);ctx.quadraticCurveTo(0,-67,11,-72);
  ctx.lineTo(16,-42);ctx.quadraticCurveTo(0,-38,-16,-42);ctx.closePath();ctx.fill();
  // 大袖(左右へ垂れる袂)
  [-1,1].forEach(s=>{
    ctx.fillStyle=s<0?lo:robe;ctx.beginPath();
    ctx.moveTo(s*9,-70);ctx.quadraticCurveTo(s*23,-64,s*22,-48);
    ctx.quadraticCurveTo(s*17,-44,s*12,-46);ctx.quadraticCurveTo(s*13,-58,s*7,-66);
    ctx.closePath();ctx.fill();
    ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(s*19,-45,3.4,3,0,0,Math.PI*2);ctx.fill(); // 手
  });
  // 襟と菊綴(水干の胸紐)
  ctx.fillStyle=kmrShade(robe,.22);ctx.beginPath();
  ctx.moveTo(-6,-72);ctx.lineTo(0,-58);ctx.lineTo(6,-72);ctx.lineTo(3,-73);ctx.lineTo(0,-63);ctx.lineTo(-3,-73);ctx.closePath();ctx.fill();
  ctx.fillStyle="#f3e6c4";[[-5,-62],[5,-62],[0,-52]].forEach(([kx,ky])=>{ctx.beginPath();ctx.arc(kx,ky,1.9,0,Math.PI*2);ctx.fill();});
  ctx.fillStyle=hi;ctx.fillRect(-15,-45,30,3); // 裾の縁
  // 首・顔・髪
  ctx.fillStyle=kmrShade(skin,-.09);ctx.fillRect(-3,-77,6,6);
  ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(0,-84,7.4,8.6,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#241c18";ctx.beginPath();ctx.ellipse(0,-88,7.6,6.2,0,Math.PI,0);ctx.fill(); // 生え際
  ctx.fillStyle="rgba(40,30,24,.85)";
  ctx.beginPath();ctx.ellipse(-2.9,-84,1.25,.85,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(2.9,-84,1.25,.85,0,0,Math.PI*2);ctx.fill();
  // 烏帽子(えぼし): 黒漆の被り物。後ろへわずかに傾ぐ低めの立烏帽子
  ctx.fillStyle="#1b181d";ctx.beginPath();
  ctx.moveTo(-7.6,-89);ctx.quadraticCurveTo(-8.4,-96,-6.2,-101);
  ctx.quadraticCurveTo(-3.4,-104.5,0.4,-103.6);
  ctx.quadraticCurveTo(5.6,-102.6,7.4,-96);ctx.quadraticCurveTo(8.2,-91.5,7.6,-89);
  ctx.quadraticCurveTo(0,-85.4,-7.6,-89);ctx.closePath();ctx.fill();
  ctx.strokeStyle="rgba(255,255,255,.14)";ctx.lineWidth=.9;ctx.beginPath();
  ctx.moveTo(-4.2,-100);ctx.quadraticCurveTo(-6,-95,-5.2,-90);ctx.stroke();
  ctx.restore();
}
/* 仲間の鞠足。名札は小さく足元へ添える(画面の文字量を抑える) */
function kmrDrawFigure(ctx,x,y,label,active,accent,scale=1){
  ctx.save();ctx.translate(x,y);
  const sway=active&&!kmrReduced()?Math.sin(kmrNow()*.008+x)*2:0;
  ctx.translate(0,sway);
  kmrDrawKemariFigure(ctx,{robe:accent,scale,dim:active?0:.18});
  if(active&&!kmrReduced()){ // 手番の鞠足に淡い光輪
    ctx.strokeStyle="rgba(255,232,168,.5)";ctx.lineWidth=1.6;
    ctx.beginPath();ctx.ellipse(0,2,22*scale,6*scale,0,0,Math.PI*2);ctx.stroke();
  }
  ctx.fillStyle=active?"rgba(255,240,205,.92)":"rgba(238,228,205,.55)";
  ctx.font=`${9.5*kmrTextScale()}px serif`;ctx.textAlign="center";ctx.fillText(label,0,17);
  ctx.restore();
}
/* 自分。正面向きで、蹴りの瞬間に足が振り上がる */
function kmrDrawPlayer(ctx,S){
  const x=KEMARI_CFG.W/2+S.playerX*148,y=KEMARI_CFG.groundY+18;
  const kick=S.impact>0?Math.sin(S.impact*Math.PI)*13:0;
  ctx.save();ctx.translate(x,y);
  kmrDrawKemariFigure(ctx,{robe:"#6f5aa2",hakama:"#3c3160",kick,scale:1.16});
  ctx.restore();
}
function kmrDrawPrompt(ctx,S){
  if(!S.delivery||S.phase!=="flight")return;
  const d=S.delivery,tech=KEMARI_CFG.techniques[d.technique],ball=kmrBallAt(S,kmrNow()),ts=kmrTextScale();
  const lane=["左","中央","右"][d.lane+1];
  ctx.save();ctx.textAlign="center";ctx.font=`bold ${17*ts}px serif`;ctx.fillStyle=tech.color;
  ctx.shadowColor="rgba(12,16,10,.75)";ctx.shadowBlur=6;
  ctx.fillText(`${lane}へ　${tech.label}`,KEMARI_CFG.W/2,108);
  /* こつ(hint)は下段の一行が担当。ここでは構えの状態だけを補う */
  if(S.kickQueued){ctx.font=`${10*ts}px sans-serif`;ctx.fillStyle="#ffe9b4";ctx.fillText("蹴る構え済み・落下に合わせて自動で蹴る",KEMARI_CFG.W/2,124);}
  ctx.shadowBlur=0;
  if(ball){const remain=kmrClamp(1-ball.p,0,1),r=25+remain*28;ctx.strokeStyle=tech.color;ctx.lineWidth=2;ctx.globalAlpha=.2+.7*(1-remain);ctx.beginPath();ctx.arc(KEMARI_CFG.W/2+d.landX*148,KEMARI_CFG.groundY,r,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}
function kemariDrawScene(ctx,S){
  if(!ctx)return;const {W,H,padTop,padBot}=KEMARI_CFG;
  ctx.save();let dx=0,dy=0;if(S&&S.shake&&!kmrReduced()){dx=(Math.random()-.5)*S.shake;dy=(Math.random()-.5)*S.shake;}ctx.translate(dx,dy);
  ctx.translate(0,padTop);   // 以降は場面図(720×500)の座標系。上下の余白ぶんだけ原点を下げる
  kmrDrawPaper(ctx);
  if(S){
    /* [UI整理] 盤面内のメーター枠は上部HUDと完全に重複するため描かない(情報の三重表示を解消) */
    /* 八人の鞠足の立ち位置。全員が白砂(地平=groundY-38)より手前に足を着けるように置く。
       以前は奥の4人を地平より上のy(groundY-66〜-108)に描いていたため、寝殿の屋根の上に
       立っているように見えていた。奥ほど小さく・地平寄り、手前ほど大きく・下寄りにして遠近を出す。 */
    const gy=KEMARI_CFG.groundY;
    kmrDrawFigure(ctx,KEMARI_CFG.W/2,gy-26,"正面",S.delivery&&S.delivery.partner===1,"#9b694d",.68);
    kmrDrawFigure(ctx,236,gy-22,"鞠足",false,"#75654a",.64);
    kmrDrawFigure(ctx,W-236,gy-22,"鞠足",false,"#496b67",.64);
    kmrDrawFigure(ctx,138,gy+4,"鞠足",false,"#657b4d",.84);
    kmrDrawFigure(ctx,W-138,gy+4,"鞠足",false,"#76545c",.84);
    kmrDrawFigure(ctx,74,gy+34,"左の鞠足",S.delivery&&S.delivery.partner===0,"#7d5e8e",1.0);
    kmrDrawFigure(ctx,W-74,gy+34,"右の鞠足",S.delivery&&S.delivery.partner===2,"#426f7a",1.0);
    const ball=kmrBallAt(S,kmrNow());kmrDrawTrajectory(ctx,S,ball);kmrDrawBall(ctx,ball,S);kmrDrawPlayer(ctx,S);kmrDrawPrompt(ctx,S);
    S.particles.forEach(p=>{ctx.globalAlpha=kmrClamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,2.3,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;
    if(S.phase==="wait"||S.phase==="interlude"||S.phase==="recovery"){ctx.fillStyle="rgba(7,10,7,.38)";ctx.fillRect(0,-padTop,W,H+padTop+padBot-72);ctx.fillStyle="#f5e4b7";ctx.font=`bold ${16*kmrTextScale()}px serif`;ctx.textAlign="center";ctx.fillText(S.message,W/2,H*.47);}
  }
  ctx.restore();
}
/* 盤面の実寸に合わせて上下の余白を決める。
   スマホ縦画面では横幅が96vwで頭打ちになり、720×500のままだと画面の下半分が丸ごと余る。
   余ったぶんは空と白砂へ配って、場面を引き伸ばさずに画面を使い切る。 */
function kmrSyncPad(){
  const cv=kmr$("kemariCanvas");if(!cv)return;
  const r=cv.getBoundingClientRect();if(!r.width||!r.height)return;
  const want=kmrClamp(Math.round(KEMARI_CFG.W*r.height/r.width),KEMARI_CFG.H,KEMARI_CFG.H+KEMARI_CFG.maxPad);
  const extra=want-KEMARI_CFG.H,top=Math.round(extra*.45);
  KEMARI_CFG.padTop=top;KEMARI_CFG.padBot=extra-top;
}
function kemariRender(){
  const cv=kmr$("kemariCanvas");if(!cv)return;
  kmrSyncPad();
  const dpr=kmrLowPower()?1:Math.min(2,window.devicePixelRatio||1);
  const ch=KEMARI_CFG.H+KEMARI_CFG.padTop+KEMARI_CFG.padBot;
  if(!cv._kmrCtx||cv._kmrDpr!==dpr||cv._kmrH!==ch){
    cv.width=KEMARI_CFG.W*dpr;cv.height=ch*dpr;
    cv._kmrCtx=cv.getContext("2d",{alpha:false});cv._kmrDpr=dpr;cv._kmrH=ch;
  }
  const ctx=cv._kmrCtx;ctx.setTransform(dpr,0,0,dpr,0,0);kemariDrawScene(ctx,KMR);
}
function kemariLoop(ts){
  if(typeof APP==="undefined"||APP.mode!=="kemari"){kmrLoopActive=false;return;}
  requestAnimationFrame(kemariLoop);
  const low=kmrLowPower();if(low&&ts-_kmrLastTs<33)return;
  const dt=Math.min(.05,_kmrLastTs?(ts-_kmrLastTs)/1000:.016);_kmrLastTs=ts;
  kmrUpdate(dt);kmrUpdateHud(false);kemariRender();
}

/* 画面のどこを触っても「蹴る」。
   以前は鞠から62px以内をタップした時だけ蹴りになり、外すと移動になってしまうため、
   蹴りたいのに横へ動くという取り違えが起きていた。移動は左右ボタン(と A/D キー)が担当する。
   ボタン・カード・ヘルプの上は本来の操作を優先するので、ここでは拾わない。 */
function kmrIsControlTarget(t){
  // ボタン類と、下段の操作ストリップ・カード類だけは本来の操作を優先する。
  // 上部の得点欄や盤面の外の余白は「画面のどこでも」に含めて蹴りにする(✕はbuttonなので誤爆しない)。
  return !!(t&&t.closest&&t.closest("button,a,input,select,textarea,.kmr-controls,.kmr-card,#kemariGameOver,#kemariHelp"));
}
function kmrHandlePointer(ev){
  const S=KMR;if(!S||S.over||S.helpOpen)return;
  if(kmrIsControlTarget(ev.target))return;
  kemariAttemptKick();
}
function kmrBind(){
  if(_kmrBound)return;_kmrBound=true;
  const hud=kmr$("kemariHud");
  // 盤面だけでなくHUD全体で受ける(縦画面では盤の上下に余白が出るため)
  if(hud){hud.addEventListener("pointerdown",ev=>{
    if(typeof APP==="undefined"||APP.mode!=="kemari")return;
    if(kmrIsControlTarget(ev.target))return;
    ev.preventDefault();kmrHandlePointer(ev);
  });}
  if(hud){hud.addEventListener("contextmenu",ev=>{if(typeof APP!=="undefined"&&APP.mode==="kemari")ev.preventDefault();});}
  addEventListener("keydown",ev=>{
    if(typeof APP==="undefined"||APP.mode!=="kemari"||!KMR||KMR.helpOpen)return;
    const key=(ev.key||"").toLowerCase();
    if(key==="a"||ev.code==="ArrowLeft"){ev.preventDefault();kmrMovePlayer(-1);}
    else if(key==="d"||ev.code==="ArrowRight"){ev.preventDefault();kmrMovePlayer(1);}
    else if(key==="z"){ev.preventDefault();kmrSetTechnique("receive");}
    else if(key==="x"){ev.preventDefault();kmrSetTechnique("high");}
    else if(key==="c"){ev.preventDefault();kmrSetTechnique("pass");}
    else if(ev.code==="Space"||ev.key==="Enter"){ev.preventDefault();kemariAttemptKick();}
  });
  const quit=kmr$("kemariQuit"),helpStart=kmr$("kmrHelpStart"),retry=kmr$("kmrRetry"),title=kmr$("kmrToTitle"),launch=kmr$("btnKemari");
  if(launch)launch.onclick=()=>{if(typeof beep==="function")beep(600,.08);if(typeof initAudio==="function")initAudio();if(typeof hideSubPanel==="function")hideSubPanel("miniGameSubPanel");if(typeof enterMode==="function")enterMode("kemari");};
  if(quit)quit.onclick=()=>{if(typeof beep==="function")beep(400,.06);if(typeof enterMode==="function")enterMode("walk");};
  if(helpStart)helpStart.onclick=()=>{const help=kmr$("kemariHelp");if(help)help.classList.remove("show");kmrMarkHelpSeen();if(KMR){KMR.helpOpen=false;kmrStartRound(KMR);}if(typeof beep==="function")beep(520,.06);};
  if(retry)retry.onclick=()=>{if(typeof beep==="function")beep(600,.07);const go=kmr$("kemariGameOver");if(go)go.classList.remove("show");startKemari();};
  if(title)title.onclick=()=>location.reload();
  const controlActions=[
    ["kmrLeft",()=>kmrMovePlayer(-1)],
    ["kmrRight",()=>kmrMovePlayer(1)],
    ["kmrReceive",()=>kmrSetTechnique("receive")],
    ["kmrHigh",()=>kmrSetTechnique("high")],
    ["kmrPass",()=>kmrSetTechnique("pass")],
    ["kmrKick",()=>kemariAttemptKick()]
  ];
  controlActions.forEach(([id,action])=>{const el=kmr$(id);if(el)el.addEventListener("click",ev=>{
    if(typeof APP!=="undefined"&&APP.mode==="kemari"){ev.preventDefault();action();}
  });});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",kmrBind,{once:true});else kmrBind();

function kmrTestResolve(kind){
  const S=KMR;if(!S||S.over)return false;
  kmrClearTimers(S);
  if(!S.delivery)S.delivery=kmrCreateDelivery(S);
  S.phase="flight";kmrResolveKick(["perfect","good","save","miss"].includes(kind)?kind:"perfect",{kind,time:0,position:0,technique:true});
  kmrClearTimers(S);
  if(!S.over&&S.roundHits>=kmrRound().goal)kmrCompleteRound(S);
  kmrClearTimers(S);
  if(S.victory)kemariGameOver(true);
  else if(!S.over){S.delivery=kmrCreateDelivery(S);S.phase="flight";}
  kmrUpdateHud(true);kemariRender();return true;
}
function kmrTestDelivery(lane,technique,progress){
  const S=KMR;if(!S||S.over)return false;
  kmrClearTimers(S);
  const flight=1500;
  S.delivery={
    partner:1,technique:KEMARI_CFG.techniques[technique]?technique:"receive",
    lane:kmrClamp(Number(lane)||0,-1,1),fromX:0,drift:0,flight,peak:140,
    start:kmrNow()-flight*kmrClamp(Number(progress)||0,0,1),call:"アリ",landX:kmrClamp(Number(lane)||0,-1,1)
  };
  S.phase="flight";S.kickQueued=false;S.quickStep=false;kmrUpdateHud(true);return true;
}
function kmrTestAdvance(progress){
  const S=KMR;if(!S?.delivery)return false;
  S.delivery.start=kmrNow()-S.delivery.flight*kmrClamp(Number(progress)||0,0,1.05);
  kmrUpdate(.016);kmrUpdateHud(true);kemariRender();return true;
}

window.KEMARI_GAME={
  version:3,start:startKemari,stop:stopKemari,attempt:kemariAttemptKick,
  selectTechnique:kmrSetTechnique,move:kmrMovePlayer,moveTo:kmrMoveTo,beginFlight:kemariBeginFlight,testResolve:kmrTestResolve,
  __test:{setDelivery:kmrTestDelivery,advance:kmrTestAdvance},
  getState:()=>{const S=KMR;if(!S)return null;return{round:S.round+1,roundHits:S.roundHits,rally:S.rally,score:S.score,combo:S.combo,stamina:S.stamina,miyabi:S.miyabi,poise:S.poise,selected:S.selected,phase:S.phase,kickQueued:S.kickQueued,quickStep:S.quickStep,flowTurns:S.flowTurns,online:!!S.online,delivery:S.delivery&&{technique:S.delivery.technique,lane:S.delivery.lane,partner:S.delivery.partner},victory:S.victory};}
};
