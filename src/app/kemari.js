/*
 * 蹴鞠: 鞠の軌道を読み、位置取り・蹴り分け・仲間との連携で四つの懸を巡る協力型ゲーム。
 * 既存互換 API: startKemari / stopKemari / kemariAttemptKick / kemariBeginFlight。
 */
const KEMARI_CFG={
  W:720,H:500,groundY:350,
  baseFlight:1850,minFlight:1120,
  perfectWindow:0.075,goodWindow:0.16,saveWindow:0.245,
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
  return {
    version:2,seed:(Date.now()^Math.floor(Math.random()*0xffffffff))>>>0,
    startedAt:kmrNow(),onlineSubmitted:false,
    best,round:0,roundHits:0,rally:0,score:0,combo:0,maxCombo:0,
    stamina:100,miyabi:18,poise:3,teamSync:0,
    playerX:0,targetX:0,selected:"receive",phase:"intro",over:false,victory:false,
    delivery:null,nextPartner:1,impact:0,shake:0,particles:[],trails:[],
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
    S.delivery=kmrCreateDelivery(S);S.phase="flight";
    const cue=S.round<2?`　構え: ${KEMARI_CFG.techniques[S.delivery.technique].label}`:"　弧と仲間の位置を読め";
    S.message=`${S.delivery.call}${cue}`;
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
  const perfect=KEMARI_CFG.perfectWindow-tired,good=KEMARI_CFG.goodWindow-tired,save=KEMARI_CFG.saveWindow;
  if(time<=perfect&&position<=.27&&technique)return{kind:"perfect",time,position,technique};
  if(time<=good&&position<=.58&&technique)return{kind:"good",time,position,technique};
  if(time<=save&&position<=.86)return{kind:"save",time,position,technique};
  return{kind:"miss",time,position,technique};
}
function kemariAttemptKick(){
  const S=KMR;if(!S||S.over||S.phase!=="flight")return false;
  const result=kmrInputQuality(S,kmrNow());
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
  const multiplier=1+Math.min(1.5,S.combo*.08)+S.miyabi*.004;
  const earned=Math.round(scoreBase*multiplier+(correct?25:0));
  S.score+=earned;S.rally++;S.roundHits++;S.teamSync=kmrClamp(S.teamSync+(kind==="perfect"?15:kind==="good"?9:3),0,100);
  S.miyabi=kmrClamp(S.miyabi+(kind==="perfect"?8:kind==="good"?4:-4),0,100);
  const cost=d.technique==="high"?13:d.technique==="pass"?9:6;
  S.stamina=kmrClamp(S.stamina-cost-(Math.abs(S.targetX-S.playerX)>.42?3:0),0,100);
  S.impact=1;S.shake=kind==="perfect"?5:2;
  kmrBurst(S,kmrBallAt(S,kmrNow()),kind);
  const call=kmrPick(S,KEMARI_KAKEGOE);
  const label=kind==="perfect"?"見事":kind==="good"?"良し":"拾い鞠";
  const detail=correct?`${tech.label}で${call}`:`${tech.label}ではないが、仲間が拾った`;
  S.message=`${label}。${detail}　+${earned}`;
  kmrShowJudge(`${label}！ ${call}　+${earned}`,kind);
  kmrSound(kind);
  S.phase="return";
  S.nextPartner=kmrNextPartner(S,d,kind);
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
  const move=Math.abs(S.targetX-S.playerX);
  if(move>.004){
    const speed=(S.stamina<20?1.2:2.7)*dt;S.playerX=kmrLerp(S.playerX,S.targetX,Math.min(1,speed));
    S.stamina=kmrClamp(S.stamina-dt*4.4,0,100);
  }else S.stamina=kmrClamp(S.stamina+dt*2.25,0,100);
  S.impact=Math.max(0,S.impact-dt*3.8);S.shake=Math.max(0,S.shake-dt*13);
  S.particles=S.particles.filter(p=>{
    p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=125*dt;return p.life>0;
  });
  if(S.phase==="flight"&&S.delivery){
    const p=(kmrNow()-S.delivery.start)/S.delivery.flight;
    if(p>1+KEMARI_CFG.saveWindow)kmrDrop(S,{kind:"miss"});
  }
}
function kmrUpdateHud(force){
  const S=KMR;if(!S)return;
  const now=kmrNow();if(!force&&now-S.lastHud<130)return;S.lastHud=now;
  kmrSetText("kmrRally",S.rally);kmrSetText("kmrScore",S.score);
  kmrSetText("kmrRound",`${S.round+1}/${KEMARI_CFG.rounds.length}`);
  kmrSetText("kmrCombo",S.combo);kmrSetText("kmrStamina",Math.round(S.stamina));kmrSetText("kmrMiyabi",Math.round(S.miyabi));
  kmrSetText("kmrObjective",`${kmrRound().name} ${S.roundHits}/${kmrRound().goal}`);
  kmrSetText("kmrLives",`${"◈".repeat(S.poise)}${"◇".repeat(3-S.poise)}`);
  const flow=S.delivery&&S.phase==="flight"&&S.round<2?`構え: ${KEMARI_CFG.techniques[S.delivery.technique].label}　${S.message}`:S.message;
  kmrSetText("kmrFlow",flow);
  const controls=kmr$("kmrControls");
  if(controls){controls.dataset.phase=S.phase;controls.setAttribute("aria-label",S.phase==="flight"?"鞠を蹴る":"鞠が来るのを待つ");}
  [["kmrReceive","receive"],["kmrHigh","high"],["kmrPass","pass"]].forEach(([id,tech])=>{
    const el=kmr$(id);if(!el)return;const selected=S.selected===tech;
    el.classList.toggle("selected",selected);el.setAttribute("aria-pressed",String(selected));
  });
}

function kmrDrawTree(ctx,k,x,y,scale){
  ctx.save();ctx.translate(x,y);ctx.lineCap="round";
  ctx.strokeStyle="#493526";ctx.lineWidth=5*scale;ctx.beginPath();ctx.moveTo(0,36*scale);ctx.lineTo(0,-11*scale);ctx.stroke();
  if(k.kind==="pine"){
    ctx.fillStyle=k.color;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(0,(-34+i*14)*scale);ctx.lineTo((-19+i*3)*scale,(5+i*12)*scale);ctx.lineTo((19-i*3)*scale,(5+i*12)*scale);ctx.closePath();ctx.fill();}
  }else if(k.kind==="willow"){
    ctx.strokeStyle=k.color;ctx.lineWidth=3*scale;for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(i*4*scale,-20*scale);ctx.quadraticCurveTo(i*7*scale,2*scale,i*8*scale,22*scale);ctx.stroke();}
  }else{
    ctx.fillStyle=k.color;for(let i=0;i<14;i++){const a=i*2.4;ctx.beginPath();ctx.arc(Math.cos(a)*15*scale,(-18+Math.sin(a)*11)*scale,5*scale,0,Math.PI*2);ctx.fill();}
  }
  ctx.restore();
}
function kmrDrawPaper(ctx){
  const {W,H}=KEMARI_CFG;
  const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#263d3b");sky.addColorStop(.5,"#56725a");sky.addColorStop(.51,"#a59a70");sky.addColorStop(1,"#687043");
  ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  ctx.fillStyle="rgba(255,239,187,.06)";for(let y=0;y<H;y+=12){ctx.fillRect(0,y,W,1);}
  const light=ctx.createLinearGradient(0,0,W,0);light.addColorStop(0,"rgba(255,238,181,0)");light.addColorStop(.5,"rgba(255,238,181,.16)");light.addColorStop(1,"rgba(255,238,181,0)");ctx.fillStyle=light;ctx.fillRect(0,0,W,H*.55);
  ctx.fillStyle="rgba(27,52,32,.35)";ctx.fillRect(0,KEMARI_CFG.groundY+28,W,H-KEMARI_CFG.groundY);
  ctx.strokeStyle="rgba(255,232,171,.36)";ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(W/2,KEMARI_CFG.groundY+30,270,58,0,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle="rgba(57,73,38,.5)";for(let i=0;i<9;i++){ctx.beginPath();ctx.moveTo(0,KEMARI_CFG.groundY+34+i*8);ctx.lineTo(W,KEMARI_CFG.groundY+21+i*9);ctx.stroke();}
  kmrDrawTree(ctx,KEMARI_KAKARI[0],55,77,1.05);kmrDrawTree(ctx,KEMARI_KAKARI[1],W-55,77,1.05);kmrDrawTree(ctx,KEMARI_KAKARI[2],55,KEMARI_CFG.groundY-5,1.05);kmrDrawTree(ctx,KEMARI_KAKARI[3],W-55,KEMARI_CFG.groundY-5,1.05);
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
function kmrDrawBall(ctx,ball,S){
  if(!ball)return;
  const r=14+ball.arc*3;ctx.save();ctx.translate(ball.x,ball.y);
  ctx.fillStyle="rgba(13,10,6,.28)";ctx.beginPath();ctx.ellipse(0,KEMARI_CFG.groundY-ball.y+8,17,4,0,0,Math.PI*2);ctx.fill();
  const grad=ctx.createRadialGradient(-r*.35,-r*.42,2,0,0,r);grad.addColorStop(0,"#fff9db");grad.addColorStop(.6,"#e5c986");grad.addColorStop(1,"#9b7548");
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle=grad;ctx.fill();
  ctx.strokeStyle="rgba(93,61,34,.72)";ctx.lineWidth=1.35;
  for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(0,0,r,-.4+i*2.05,.95+i*2.05);ctx.stroke();}
  ctx.restore();
}
function kmrDrawFigure(ctx,x,y,label,active,accent,scale=1){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);const sway=active&&!kmrReduced()?Math.sin(kmrNow()*.008+x)*2:0;
  ctx.translate(0,sway);
  ctx.fillStyle="rgba(23,19,17,.88)";ctx.beginPath();ctx.arc(0,-34,9,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(-19,-22);ctx.quadraticCurveTo(0,-9,19,-22);ctx.lineTo(23,13);ctx.lineTo(-23,13);ctx.closePath();ctx.fill();
  ctx.fillStyle="rgba(255,243,218,.86)";ctx.font=`${10*kmrTextScale()}px serif`;ctx.textAlign="center";ctx.fillText(label,0,28);ctx.restore();
}
function kmrDrawPlayer(ctx,S){
  const x=KEMARI_CFG.W/2+S.playerX*148,y=KEMARI_CFG.groundY+18;
  ctx.save();ctx.translate(x,y);const kick=S.impact>0?Math.sin(S.impact*Math.PI)*11:0;
  ctx.fillStyle="rgba(22,16,12,.94)";ctx.beginPath();ctx.arc(0,-40,10,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#604e85";ctx.beginPath();ctx.moveTo(-22,-27);ctx.quadraticCurveTo(0,-9,22,-27);ctx.lineTo(27,13);ctx.lineTo(-27,13);ctx.closePath();ctx.fill();
  ctx.strokeStyle="#292018";ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-8,9);ctx.lineTo(-17-kick,23);ctx.moveTo(8,9);ctx.lineTo(17+kick,23);ctx.stroke();ctx.restore();
}
function kmrDrawMeters(ctx,S){
  const {W}=KEMARI_CFG;
  const ts=kmrTextScale();
  ctx.save();ctx.fillStyle="rgba(10,16,12,.72)";ctx.fillRect(12,12,W-24,70);
  ctx.strokeStyle="rgba(246,220,154,.35)";ctx.strokeRect(12,12,W-24,70);
  ctx.font=`bold ${11*ts}px serif`;ctx.fillStyle="#f4dfb0";ctx.textAlign="left";ctx.fillText(`${kmrRound().name}　${S.roundHits}/${kmrRound().goal}`,21,31);
  const bars=[{label:"体力",value:S.stamina,color:"#d68b68"},{label:"雅",value:S.miyabi,color:"#ddb865"},{label:"連携",value:S.teamSync,color:"#78c5ad"}];
  bars.forEach((bar,i)=>{const y=42+i*12;ctx.fillStyle="rgba(255,255,255,.12)";ctx.fillRect(56,y,122,6);ctx.fillStyle=bar.color;ctx.fillRect(56,y,122*bar.value/100,6);ctx.fillStyle="#e7dbc2";ctx.font=`${9*ts}px sans-serif`;ctx.fillText(bar.label,21,y+6);});
  ctx.textAlign="right";ctx.font=`bold ${11*ts}px serif`;ctx.fillStyle="#ffe5a9";ctx.fillText(`組 ${S.combo}　余裕 ${"◈".repeat(S.poise)}${"◇".repeat(3-S.poise)}`,W-20,31);ctx.restore();
}
function kmrDrawPrompt(ctx,S){
  if(!S.delivery||S.phase!=="flight")return;
  const d=S.delivery,tech=KEMARI_CFG.techniques[d.technique],ball=kmrBallAt(S,kmrNow()),ts=kmrTextScale();
  ctx.save();ctx.textAlign="center";ctx.font=`bold ${16*ts}px serif`;ctx.fillStyle=tech.color;ctx.fillText(S.round<2?`構え　${tech.label}`:"軌道を読む",KEMARI_CFG.W/2,111);
  ctx.font=`${10*ts}px sans-serif`;ctx.fillStyle="#f4e6c9";ctx.fillText(S.round<2?tech.hint:"色・高さ・仲間の位置から蹴り分ける",KEMARI_CFG.W/2,127);
  if(ball){const remain=kmrClamp(1-ball.p,0,1),r=25+remain*28;ctx.strokeStyle=tech.color;ctx.lineWidth=2;ctx.globalAlpha=.2+.7*(1-remain);ctx.beginPath();ctx.arc(KEMARI_CFG.W/2+S.playerX*148,KEMARI_CFG.groundY,r,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}
function kmrDrawControls(ctx,S){
  const {W,H}=KEMARI_CFG,y=H-54,techs=["receive","high","pass"],gap=8,chip=(W-36-gap*2)/3,ts=kmrTextScale();
  ctx.save();ctx.fillStyle="rgba(8,11,8,.79)";ctx.fillRect(0,H-72,W,72);ctx.strokeStyle="rgba(235,207,140,.28)";ctx.beginPath();ctx.moveTo(0,H-72);ctx.lineTo(W,H-72);ctx.stroke();
  ctx.fillStyle="#ddd2b7";ctx.font=`${10*ts}px sans-serif`;ctx.textAlign="center";ctx.fillText("A / D・左右で位置取り　Space / 鞠をタップで蹴る",W/2,H-59);
  techs.forEach((id,i)=>{const x=12+i*(chip+gap),active=S.selected===id,tech=KEMARI_CFG.techniques[id];ctx.fillStyle=active?"rgba(250,231,174,.22)":"rgba(255,255,255,.06)";ctx.fillRect(x,y,chip,42);ctx.strokeStyle=active?tech.color:"rgba(255,255,255,.18)";ctx.lineWidth=active?2:1;ctx.strokeRect(x,y,chip,42);ctx.fillStyle=tech.color;ctx.font=`bold ${14*ts}px serif`;ctx.fillText(`${tech.label}　${tech.key}`,x+chip/2,y+18);ctx.fillStyle="#d8c9ad";ctx.font=`${9*ts}px sans-serif`;ctx.fillText(tech.hint,x+chip/2,y+33);});
  ctx.restore();
}
function kemariDrawScene(ctx,S){
  if(!ctx)return;const {W,H}=KEMARI_CFG;
  ctx.save();let dx=0,dy=0;if(S&&S.shake&&!kmrReduced()){dx=(Math.random()-.5)*S.shake;dy=(Math.random()-.5)*S.shake;}ctx.translate(dx,dy);
  kmrDrawPaper(ctx);
  if(S){
    kmrDrawMeters(ctx,S);
    kmrDrawFigure(ctx,132,KEMARI_CFG.groundY-5,"左の鞠足",S.delivery&&S.delivery.partner===0,"#7d5e8e");
    kmrDrawFigure(ctx,KEMARI_CFG.W/2,KEMARI_CFG.groundY-52,"正面",S.delivery&&S.delivery.partner===1,"#9b694d");
    kmrDrawFigure(ctx,W-132,KEMARI_CFG.groundY-5,"右の鞠足",S.delivery&&S.delivery.partner===2,"#426f7a");
    kmrDrawFigure(ctx,190,226,"鞠足",false,"#657b4d",.72);
    kmrDrawFigure(ctx,280,205,"鞠足",false,"#75654a",.7);
    kmrDrawFigure(ctx,W-280,205,"鞠足",false,"#496b67",.7);
    kmrDrawFigure(ctx,W-190,226,"鞠足",false,"#76545c",.72);
    const ball=kmrBallAt(S,kmrNow());kmrDrawTrajectory(ctx,S,ball);kmrDrawBall(ctx,ball,S);kmrDrawPlayer(ctx,S);kmrDrawPrompt(ctx,S);
    S.particles.forEach(p=>{ctx.globalAlpha=kmrClamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,2.3,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;
    kmrDrawControls(ctx,S);
    if(S.phase==="wait"||S.phase==="interlude"||S.phase==="recovery"){ctx.fillStyle="rgba(7,10,7,.38)";ctx.fillRect(0,0,W,H-72);ctx.fillStyle="#f5e4b7";ctx.font=`bold ${16*kmrTextScale()}px serif`;ctx.textAlign="center";ctx.fillText(S.message,W/2,H*.47);}
  }
  ctx.restore();
}
function kemariRender(){
  const cv=kmr$("kemariCanvas");if(!cv)return;
  const dpr=kmrLowPower()?1:Math.min(2,window.devicePixelRatio||1);
  if(!cv._kmrCtx||cv._kmrDpr!==dpr){cv.width=KEMARI_CFG.W*dpr;cv.height=KEMARI_CFG.H*dpr;cv._kmrCtx=cv.getContext("2d",{alpha:false});cv._kmrDpr=dpr;}
  const ctx=cv._kmrCtx;ctx.setTransform(dpr,0,0,dpr,0,0);kemariDrawScene(ctx,KMR);
}
function kemariLoop(ts){
  if(typeof APP==="undefined"||APP.mode!=="kemari"){kmrLoopActive=false;return;}
  requestAnimationFrame(kemariLoop);
  const low=kmrLowPower();if(low&&ts-_kmrLastTs<33)return;
  const dt=Math.min(.05,_kmrLastTs?(ts-_kmrLastTs)/1000:.016);_kmrLastTs=ts;
  kmrUpdate(dt);kmrUpdateHud(false);kemariRender();
}

function kmrCanvasPoint(ev){
  const cv=kmr$("kemariCanvas");if(!cv)return null;const r=cv.getBoundingClientRect();
  return {x:(ev.clientX-r.left)*KEMARI_CFG.W/r.width,y:(ev.clientY-r.top)*KEMARI_CFG.H/r.height};
}
function kmrHandlePointer(ev){
  const S=KMR;if(!S||S.over||S.helpOpen)return;
  const p=kmrCanvasPoint(ev);if(!p)return;
  if(p.y>=KEMARI_CFG.H-54){const index=kmrClamp(Math.floor((p.x-12)/((KEMARI_CFG.W-20)/3)),0,2);kmrSetTechnique(["receive","high","pass"][index]);return;}
  kmrMoveTo((p.x-KEMARI_CFG.W/2)/(KEMARI_CFG.W*.205));kemariAttemptKick();
}
function kmrBind(){
  if(_kmrBound)return;_kmrBound=true;
  const hud=kmr$("kemariHud"),cv=kmr$("kemariCanvas");
  if(cv){cv.addEventListener("pointerdown",ev=>{if(typeof APP!=="undefined"&&APP.mode==="kemari"){ev.preventDefault();kmrHandlePointer(ev);}});}
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
    ["kmrKick",()=>kemariAttemptKick()],
    ["kmrControls",()=>kemariAttemptKick()]
  ];
  controlActions.forEach(([id,action])=>{const el=kmr$(id);if(el)el.addEventListener("click",ev=>{
    // kmrControls は個別ボタンを包む場合があるため、容器自身を押した時だけ蹴る。
    if(id==="kmrControls"&&ev.target!==el)return;
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

window.KEMARI_GAME={
  version:2,start:startKemari,stop:stopKemari,attempt:kemariAttemptKick,
  selectTechnique:kmrSetTechnique,move:kmrMovePlayer,beginFlight:kemariBeginFlight,testResolve:kmrTestResolve,
  getState:()=>{const S=KMR;if(!S)return null;return{round:S.round+1,roundHits:S.roundHits,rally:S.rally,score:S.score,combo:S.combo,stamina:S.stamina,miyabi:S.miyabi,poise:S.poise,selected:S.selected,phase:S.phase,delivery:S.delivery&&{technique:S.delivery.technique,lane:S.delivery.lane,partner:S.delivery.partner},victory:S.victory};}
};
