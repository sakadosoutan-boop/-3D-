/*
 * Living estate: embedded after household people and updateHouseholdWalk.
 * It only orchestrates the figures already placed in the scene.
 */
(function livingEstateSystem(){
  "use strict";

  if(typeof window==="undefined"||window.LIVING_ESTATE)return;

  const VERSION="1.0.0";
  const STORAGE_KEY="shinden3d-estate-life-v1";
  const TIMES=["dawn","day","dusk","night"];
  const ROLES=["keishi","menoto","myobu","gejo","zuishin","toneri","genan"];
  const ROLE_NAMES={
    keishi:"家司",menoto:"乳母",myobu:"女房",gejo:"下女",
    zuishin:"随身",toneri:"舎人",genan:"下男・番人"
  };
  const ACTIVITY_NAMES={
    ledger:"政所で帳簿を整える",errand:"使いの段取りをする",receive:"文を取り次ぐ",
    childCare:"子女の世話をする",meal:"食事の支度をする",letter:"文を代筆する",
    prepare:"装いと調度を整える",clean:"掃除をする",wash:"洗い物をする",
    guard:"門と車寄を警護する",patrol:"外周を見回る",escort:"来客を先導する",
    message:"文や荷を届ける",stable:"牛車まわりを整える",garden:"庭を手入れする",
    rest:"持ち場で休む"
  };

  // Existing routes are used as the safety envelope.  Reversing or pausing them
  // changes the day's rhythm without sending people through walls or the pond.
  const SCHEDULES={
    keishi:{
      dawn:{activity:"ledger",route:"base",speed:.068},day:{activity:"errand",route:"reverse",speed:.096},
      dusk:{activity:"receive",route:"base",speed:.074},night:{activity:"rest",route:"home",speed:0}
    },
    menoto:{
      dawn:{activity:"childCare",route:"base",speed:.064},day:{activity:"meal",route:"reverse",speed:.078},
      dusk:{activity:"childCare",route:"base",speed:.066},night:{activity:"rest",route:"home",speed:0}
    },
    myobu:{
      dawn:{activity:"letter",route:"base",speed:.066},day:{activity:"prepare",route:"reverse",speed:.072},
      dusk:{activity:"letter",route:"base",speed:.062},night:{activity:"rest",route:"home",speed:0}
    },
    gejo:{
      dawn:{activity:"clean",route:"base",speed:.080},day:{activity:"wash",route:"reverse",speed:.086},
      dusk:{activity:"clean",route:"base",speed:.070},night:{activity:"rest",route:"home",speed:0}
    },
    zuishin:{
      dawn:{activity:"guard",route:"base",speed:.074},day:{activity:"escort",route:"reverse",speed:.090},
      dusk:{activity:"patrol",route:"base",speed:.084},night:{activity:"guard",route:"reverse",speed:.062}
    },
    toneri:{
      dawn:{activity:"stable",route:"base",speed:.082},day:{activity:"message",route:"reverse",speed:.104},
      dusk:{activity:"message",route:"base",speed:.090},night:{activity:"rest",route:"home",speed:0}
    },
    genan:{
      dawn:{activity:"garden",route:"base",speed:.078},day:{activity:"patrol",route:"reverse",speed:.088},
      dusk:{activity:"garden",route:"base",speed:.072},night:{activity:"guard",route:"home",speed:0}
    }
  };

  const OVERHEARD=[
    {id:"keishi-ledger",time:"dawn",roles:["keishi","myobu"],anchor:{x:-8,z:18,r:7},cooldown:76000,name:"家司と女房",text:"政所では、荘園から届く米や布の記録も確かめます。屋敷の運営を支える大切な仕事なのです。"},
    {id:"menoto-care",time:"day",roles:["menoto","myobu"],anchor:{x:8,z:2,r:7},cooldown:76000,name:"乳母と女房",text:"乳母は授乳だけでなく、子の成長後も後見役として深い結びつきを持ちました。"},
    {id:"myobu-letter",time:"dusk",roles:["myobu","keishi"],anchor:{x:1,z:-3,r:7},cooldown:76000,name:"女房と家司",text:"女房は和歌や手紙の教養を生かし、御簾の内と外を結ぶ文の取次も担いました。"},
    {id:"gejo-water",time:"dawn",roles:["gejo","genan"],anchor:{x:15,z:5,r:8},cooldown:76000,name:"下女と下男",text:"炊事、洗濯、掃除には多くの水と薪が要ります。屋敷の暮らしは見えない仕事で成り立ちます。"},
    {id:"zuishin-guard",time:"dusk",roles:["zuishin","toneri"],anchor:{x:45,z:15,r:9},cooldown:76000,name:"随身と舎人",text:"随身は弓矢を携え主人を守り、舎人は使者や荷運び、牛を引く役目を果たしました。"},
    {id:"genan-gate",time:"night",roles:["genan","zuishin"],anchor:{x:-51,z:3,r:9},cooldown:76000,name:"番人と随身",text:"門と築地は屋敷の境です。夜の見回りは、内と外を分けるためにも欠かせません。"},
    {id:"toneri-cart",time:"day",roles:["toneri","zuishin"],anchor:{x:45,z:18,r:9},cooldown:76000,name:"舎人と随身",text:"牛車を使う外出では、牛を引く者、先導する者、警護する者が役割を分けて付き従いました。"}
  ];
  const ARRIVALS={
    messenger:{label:"使者の到着",hint:"門の近くで、舎人が文を受け取っている。",actor:"toneri",duration:18000,anchor:{x:43,z:18}},
    visitor:{label:"来客の到着",hint:"東門で、随身が来客を迎えている。",actor:"zuishin",duration:20000,anchor:{x:49,z:11}},
    oxCart:{label:"牛車の到着",hint:"車宿の方から、牛車がゆっくり近づいてくる。",actor:"toneri",duration:22000,anchor:{x:46,z:17}}
  };
  const ARRIVAL_BY_TIME={dawn:"messenger",day:"visitor",dusk:"oxCart",night:"messenger"};

  const state={
    ready:false,actors:Object.create(null),base:Object.create(null),phase:"day",cycle:0,
    lastTime:null,lastUpdate:0,lastWalkMode:null,lastStatusAt:0,panel:null,panelOpen:false,button:null,overlay:null,overlayTimer:0,
    heardCycle:Object.create(null),heardLast:Object.create(null),storage:{heard:Object.create(null)},
    arrival:null,nextArrival:null,autoArrivalAt:0,lastArrival:null,destroyed:false
  };

  function safeStoreLoad(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY),parsed=raw?JSON.parse(raw):null;
      if(parsed&&typeof parsed==="object")state.storage={heard:parsed.heard||Object.create(null)};
    }catch(e){state.storage={heard:Object.create(null)};}
  }
  function safeStoreSave(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state.storage));}catch(e){}
  }
  function say(message,ms){if(typeof toast==="function")toast(message,ms||2400);}
  function sound(f){if(typeof beep==="function")beep(f,.045,"sine",.055);}
  function walkMode(){return !!(APP&&APP.mode==="walk");}
  function blocked(){return !walkMode()||!!(APP&&APP.gisshaCarry&&APP.gisshaCarry.active);}
  function actorFor(id){return state.actors[id]||null;}
  function actorDistance(root){
    if(!root||!player||!player.pos)return Infinity;
    return Math.hypot(root.position.x-player.pos.x,root.position.z-player.pos.z);
  }
  function near(point,radius){
    if(!point||!player||!player.pos)return false;
    return Math.hypot(player.pos.x-point.x,player.pos.z-point.z)<=radius;
  }
  function cloneRoute(route){return route.map(p=>({x:p.x,z:p.z}));}

  function rememberActors(){
    if(!Array.isArray(householdPeople))return false;
    householdPeople.forEach(root=>{
      const id=root&&root.userData&&root.userData.householdId;
      if(!id||ROLES.indexOf(id)<0)return;
      state.actors[id]=root;
      if(!state.base[id]){
        const current=root.userData.walkRoute||[];
        state.base[id]={
          route:cloneRoute(current),walkReady:!!root.userData.walkReady,
          speed:root.userData.walkSpeed||.08,phase:root.userData.walkPhase||0,
          home:root.userData.home?{x:root.userData.home.x,z:root.userData.home.z,yaw:root.userData.home.yaw}:null
        };
      }
    });
    return Object.keys(state.actors).length>0;
  }
  function routeFor(id,kind){
    const base=state.base[id];
    if(!base)return [];
    if(kind==="home"&&base.home)return [{x:base.home.x,z:base.home.z}];
    const route=cloneRoute(base.route);
    return kind==="reverse"?route.reverse():route;
  }
  function applyActorSchedule(id,time){
    const root=actorFor(id),spec=SCHEDULES[id]&&SCHEDULES[id][time];
    if(!root||!spec)return;
    const route=routeFor(id,spec.route);
    root.userData.walkRoute=route;
    root.userData.walkReady=walkMode()&&route.length>1&&spec.speed>0;
    root.userData.walkSpeed=spec.speed;
    root.userData.estateActivity=spec.activity;
    root.userData.estateActivityName=ACTIVITY_NAMES[spec.activity]||spec.activity;
    root.userData.estateScheduleTime=time;
    if(spec.route==="home"&&state.base[id]&&state.base[id].home){
      const home=state.base[id].home;
      root.position.set(home.x,groundH(home.x,home.z),home.z);
      root.rotation.y=home.yaw||0;
    }
  }
  function applySchedule(time,reason){
    const next=TIMES.indexOf(time)>=0?time:"day";
    state.phase=next;
    ROLES.forEach(id=>applyActorSchedule(id,next));
    if(reason==="time"){
      state.cycle++;
      state.nextArrival=ARRIVAL_BY_TIME[next]||null;
      state.autoArrivalAt=performance.now()+17000;
    }
    refreshPanel();
    refreshStatus();
  }
  function pauseActors(){
    ROLES.forEach(id=>{
      const root=actorFor(id);
      if(root)root.userData.walkReady=false;
    });
  }

  function createUi(){
    if(!document||state.destroyed)return;
    if(!document.querySelector("#estateLifeStyles")){
      const css=document.createElement("style");
      css.id="estateLifeStyles";
      css.textContent="\n#estateLifePanel{position:fixed;z-index:58;right:12px;top:calc(var(--topbar-h,52px) + 10px);width:min(350px,calc(100vw - 24px));max-height:min(72vh,610px);overflow:auto;display:none;padding:12px;background:rgba(35,25,17,.96);border:1px solid rgba(207,170,93,.72);border-radius:7px;color:#f4e8ce;font-family:var(--sans,system-ui);box-shadow:0 10px 30px rgba(0,0,0,.38)}\n#estateLifePanel.open{display:block}#estateLifePanel .el-head{display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(222,193,126,.28);padding-bottom:8px;margin-bottom:8px}#estateLifePanel h2{font:600 17px var(--serif,serif);margin:0;color:#f1d782}#estateLifePanel .el-close{margin-left:auto;min-width:34px;min-height:32px;border:1px solid rgba(207,170,93,.55);border-radius:5px;background:#4d3422;color:#fff;font-size:18px}#estateLifePanel .el-time{font-size:12px;color:#d9c68e;margin:0 0 8px}#estateLifePanel .el-row{display:flex;justify-content:space-between;gap:10px;padding:7px 2px;border-bottom:1px solid rgba(255,255,255,.08);font-size:12px;line-height:1.35}#estateLifePanel .el-row strong{font-family:var(--serif,serif);white-space:nowrap;color:#f4e8ce}#estateLifePanel .el-row span{text-align:right;color:#d7c7a7}#estateLifePanel .el-section{font:600 12px var(--serif,serif);color:#e2c673;margin:13px 0 5px}#estateLifePanel .el-event{width:100%;margin:4px 0;min-height:35px;display:flex;justify-content:space-between;align-items:center;gap:8px;border:1px solid rgba(207,170,93,.38);border-radius:5px;background:#473223;color:#f8edcf;padding:6px 8px;font:12px var(--sans,system-ui);text-align:left}#estateLifePanel .el-event small{color:#d5ba78;font-size:10px}#estateLifePanel .el-event:disabled{opacity:.52}#estateLifeHeard{position:fixed;z-index:55;left:50%;bottom:94px;transform:translateX(-50%);width:min(430px,calc(100vw - 28px));display:none;padding:11px 13px;background:rgba(31,23,16,.94);border-left:3px solid #d0a848;border-radius:5px;color:#f4e8ce;box-shadow:0 8px 20px rgba(0,0,0,.3);font-family:var(--sans,system-ui);pointer-events:none}#estateLifeHeard.show{display:block}#estateLifeHeard b{display:block;margin-bottom:3px;color:#e5c66e;font-family:var(--serif,serif);font-size:14px}#estateLifeHeard span{font-size:12px;line-height:1.55}@media(max-width:640px){#estateLifePanel{right:10px;top:calc(var(--topbar-h,52px) + 7px);max-height:64vh;padding:10px}#estateLifePanel .el-row{font-size:11.5px}#estateLifeHeard{bottom:84px}}\n";
      document.head.appendChild(css);
    }
    const topbar=document.getElementById("topbar");
    if(topbar&&!state.button){
      const button=document.createElement("button");
      button.type="button";button.id="tbEstateLife";button.className="tb-btn";
      button.setAttribute("aria-label","屋敷の一日の日課を開く");button.title="屋敷の一日";button.textContent="日課";
      button.addEventListener("click",()=>state.panelOpen?closeSchedule():openSchedule());
      const spacer=topbar.querySelector(".spacer");
      topbar.insertBefore(button,spacer||null);state.button=button;
    }
    if(!state.panel){
      const panel=document.createElement("section");
      panel.id="estateLifePanel";panel.setAttribute("role","dialog");panel.setAttribute("aria-label","屋敷の一日");
      document.body.appendChild(panel);state.panel=panel;
    }
    if(!state.overlay){
      const overlay=document.createElement("div");overlay.id="estateLifeHeard";overlay.setAttribute("aria-live","polite");
      document.body.appendChild(overlay);state.overlay=overlay;
    }
  }
  function element(tag,className,text){
    const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node;
  }
  function refreshPanel(){
    const panel=state.panel;if(!panel)return;
    const fragment=document.createDocumentFragment();
    const head=element("div","el-head"),title=element("h2","","屋敷の一日");
    const close=element("button","el-close","×");close.type="button";close.setAttribute("aria-label","日課を閉じる");close.onclick=closeSchedule;
    head.append(title,close);fragment.appendChild(head);
    fragment.appendChild(element("p","el-time",({dawn:"朝",day:"昼",dusk:"夕",night:"夜"}[state.phase]||state.phase)+"の務め"));
    ROLES.forEach(id=>{
      const root=actorFor(id),name=ROLE_NAMES[id]||id,activity=root&&root.userData&&root.userData.estateActivityName||"持ち場を整える";
      const row=element("div","el-row");row.append(element("strong","",name),element("span","",activity));fragment.appendChild(row);
    });
    fragment.appendChild(element("div","el-section","来訪の気配"));
    Object.keys(ARRIVALS).forEach(type=>{
      const def=ARRIVALS[type],button=element("button","el-event");button.type="button";
      button.setAttribute("aria-label",def.label+"を始める");
      const stateText=state.arrival&&state.arrival.type===type?"進行中":state.nextArrival===type?"まもなく":"散策中に開始";
      button.append(element("span","",def.label),element("small","",stateText));
      button.disabled=!!state.arrival||!walkMode();button.onclick=()=>triggerArrival(type);
      fragment.appendChild(button);
    });
    fragment.appendChild(element("div","el-section","聞き耳"));
    const heard=Object.keys(state.storage.heard||{}).length;
    fragment.appendChild(element("p","el-time","屋敷を歩くと、役目にまつわる会話が聞こえることがあります。記録済み: "+heard+" / "+OVERHEARD.length));
    panel.replaceChildren(fragment);
  }
  function openSchedule(){createUi();if(!state.panel)return false;state.panelOpen=true;state.panel.classList.add("open");refreshPanel();sound(520);return true;}
  function closeSchedule(){if(!state.panel)return;state.panelOpen=false;state.panel.classList.remove("open");}

  function canShowHeard(){
    if(blocked()||!state.overlay)return false;
    const standard=document.getElementById("dialogueBubble");
    if(standard&&standard.classList.contains("show"))return false;
    return !(state.arrival&&state.arrival.minimized===false);
  }
  function showHeard(entry){
    if(!canShowHeard())return;
    state.overlay.replaceChildren(element("b","",entry.name),element("span","",entry.text));
    state.overlay.classList.add("show");clearTimeout(state.overlayTimer);
    state.overlayTimer=setTimeout(()=>{if(state.overlay)state.overlay.classList.remove("show");},5600);
    state.heardLast[entry.id]=performance.now();state.heardCycle[entry.id]=state.cycle;
    if(!state.storage.heard[entry.id]){
      state.storage.heard[entry.id]=true;safeStoreSave();
      if(typeof recordProgress==="function")recordProgress("estateLife",1);
      if(typeof gainParam==="function")gainParam("knowledge",1);
    }
    sound(660);refreshPanel();
  }
  function updateOverheard(now){
    if(!walkMode()||state.arrival||!player||!player.pos)return;
    for(let i=0;i<OVERHEARD.length;i++){
      const entry=OVERHEARD[i];
      if(entry.time!==state.phase||state.heardCycle[entry.id]===state.cycle)continue;
      if(now-(state.heardLast[entry.id]||0)<entry.cooldown)continue;
      if(!near(entry.anchor,entry.anchor.r))continue;
      let rolesReady=true;
      for(let r=0;r<entry.roles.length;r++){
        const actor=actorFor(entry.roles[r]);
        if(!actor||!actor.userData.estateActivity){rolesReady=false;break;}
      }
      if(rolesReady){showHeard(entry);break;}
    }
  }

  function saveArrivalActors(event){
    event.actorState=[];
    const ids=event.type==="visitor"?["zuishin","toneri"]:["toneri",event.type==="oxCart"?"zuishin":null];
    ids.forEach(id=>{
      if(!id)return;const root=actorFor(id);if(!root)return;
      event.actorState.push({id,route:cloneRoute(root.userData.walkRoute||[]),ready:!!root.userData.walkReady,speed:root.userData.walkSpeed||.08});
    });
  }
  function applyArrivalActors(event){
    event.actorState.forEach(saved=>{
      const root=actorFor(saved.id),base=state.base[saved.id];if(!root||!base)return;
      const forward=cloneRoute(base.route),route=saved.id==="zuishin"?forward.slice().reverse():forward;
      root.userData.walkRoute=route;root.userData.walkReady=route.length>1;root.userData.walkSpeed=saved.id==="toneri"?.11:.092;
      root.userData.estateActivity="arrival";root.userData.estateActivityName=event.type==="messenger"?"使者を迎える":event.type==="visitor"?"来客を先導する":"牛車を整える";
    });
  }
  function rememberCart(event){
    const cart=GISSHA_YARD&&GISSHA_YARD.cart;if(!cart)return;
    event.cart={position:cart.position.clone(),rotation:cart.rotation.clone(),visible:cart.visible};
  }
  function restoreCart(event){
    const cart=GISSHA_YARD&&GISSHA_YARD.cart;
    if(cart&&event&&event.cart){cart.position.copy(event.cart.position);cart.rotation.copy(event.cart.rotation);cart.visible=event.cart.visible;}
  }
  function createVisitor(event){
    if(event.type!=="visitor"||typeof makeHeianFigure!=="function"||typeof THREE==="undefined"||!scene)return;
    try{
      const root=new THREE.Group();
      const figure=makeHeianFigure({role:"kikoshi",palette:[0x33495b,0x74523b,0xc6a15b],scale:.98,prop:"shaku",pose:"standing"});
      root.add(figure);root.position.set(55,groundH(55,12),12);root.rotation.y=-Math.PI/2;
      root.userData.estateVisitor=true;root.userData.householdId="estate_visitor";
      scene.add(root);event.visitor=root;
    }catch(e){event.visitor=null;}
  }
  function removeVisitor(event){
    if(event&&event.visitor&&event.visitor.parent)event.visitor.parent.remove(event.visitor);
    if(event)event.visitor=null;
  }
  function triggerArrival(type){
    const def=ARRIVALS[type];
    if(!def||!walkMode())return false;
    if(state.arrival)return false;
    if(APP&&APP.gisshaCarry&&APP.gisshaCarry.active){say("牛車運びが終わってから来客を迎えよう",2200);return false;}
    if(type==="oxCart"&&(!GISSHA_YARD||!GISSHA_YARD.cart||typeof gisshaCarrySetCart!=="function"))return false;
    const event={type,def,started:performance.now(),duration:def.duration,actorState:[],notified:false,minimized:false,cart:null,visitor:null};
    saveArrivalActors(event);applyArrivalActors(event);rememberCart(event);
    createVisitor(event);
    if(type==="oxCart")gisshaCarrySetCart(.88,0);
    state.arrival=event;state.lastArrival=type;state.nextArrival=null;say(def.label+"。"+def.hint,3100);sound(600);refreshPanel();refreshStatus();return true;
  }
  function finishArrival(silent){
    const event=state.arrival;if(!event)return;
    restoreCart(event);removeVisitor(event);state.arrival=null;applySchedule(state.phase,"arrival");
    if(!silent)say("来客の対応がひと段落した",2200);
    refreshPanel();refreshStatus();
  }
  function updateArrival(now){
    const event=state.arrival;
    if(!event){
      if(walkMode()&&state.nextArrival&&state.autoArrivalAt&&now>=state.autoArrivalAt)triggerArrival(state.nextArrival);
      return;
    }
    if(!walkMode()||(APP&&APP.gisshaCarry&&APP.gisshaCarry.active)){finishArrival(true);return;}
    const elapsed=now-event.started;
    if(event.type==="visitor"&&event.visitor){
      const u=Math.min(1,elapsed/Math.max(1,event.duration*.42)),smooth=u*u*(3-2*u);
      const x=55+(49-55)*smooth,z=12+(11.5-12)*smooth;
      event.visitor.position.set(x,groundH(x,z),z);
    }
    if(event.type==="oxCart"&&typeof gisshaCarrySetCart==="function"){
      const u=Math.min(1,elapsed/event.duration),smooth=u*u*(3-2*u);
      gisshaCarrySetCart(.88-.68*smooth,0);
    }
    if(!event.notified&&near(event.def.anchor,9)){event.notified=true;say(event.def.hint,2500);}
    if(elapsed>=event.duration)finishArrival(false);
  }

  function refreshStatus(){
    const phases={};ROLES.forEach(id=>{const root=actorFor(id);phases[id]=root&&root.userData&&root.userData.estateActivity||null;});
    window.LIVING_ESTATE_STATUS={
      version:VERSION,ready:state.ready,actorCount:Object.keys(state.actors).length,phase:state.phase,
      schedulePhases:phases,overheardCount:OVERHEARD.length,heardCount:Object.keys(state.storage.heard||{}).length,
      arrivalTypes:Object.keys(ARRIVALS),activeArrival:state.arrival&&state.arrival.type||null,nextArrival:state.nextArrival
    };
  }
  function update(dt,t){
    if(state.destroyed)return;
    if(!state.ready){init();if(!state.ready)return;}
    const now=performance.now(),time=APP&&APP.time||"day",isWalk=walkMode();
    if(time!==state.lastTime){state.lastTime=time;applySchedule(time,"time");}
    if(isWalk!==state.lastWalkMode){
      state.lastWalkMode=isWalk;
      if(isWalk)applySchedule(time,"mode");else pauseActors();
    }else if(!isWalk)pauseActors();
    updateArrival(now);
    if(isWalk)updateOverheard(now);
    state.lastUpdate=now;
    if(now-state.lastStatusAt>=500){state.lastStatusAt=now;refreshStatus();}
  }
  function setTimeForTest(time){
    if(TIMES.indexOf(time)<0)return false;
    if(APP)APP.time=time;state.lastTime=time;applySchedule(time,"time");return true;
  }
  function reset(options){
    finishArrival(true);state.heardCycle=Object.create(null);state.heardLast=Object.create(null);
    if(options&&options.clearProgress){state.storage={heard:Object.create(null)};safeStoreSave();}
    state.lastTime=null;state.lastWalkMode=null;applySchedule((APP&&APP.time)||"day","reset");refreshStatus();
  }
  function destroy(){
    if(state.destroyed)return;
    finishArrival(true);clearTimeout(state.overlayTimer);
    ROLES.forEach(id=>{
      const root=actorFor(id),base=state.base[id];if(!root||!base)return;
      root.userData.walkRoute=cloneRoute(base.route);root.userData.walkReady=base.walkReady;root.userData.walkSpeed=base.speed;root.userData.walkPhase=base.phase;
    });
    if(state.panel&&state.panel.parentNode)state.panel.parentNode.removeChild(state.panel);
    if(state.button&&state.button.parentNode)state.button.parentNode.removeChild(state.button);
    if(state.overlay&&state.overlay.parentNode)state.overlay.parentNode.removeChild(state.overlay);
    state.destroyed=true;state.ready=false;refreshStatus();
  }
  function init(){
    if(state.ready||state.destroyed)return state.ready;
    safeStoreLoad();rememberActors();createUi();
    state.lastTime=APP&&APP.time||"day";applySchedule(state.lastTime,"init");
    state.nextArrival=ARRIVAL_BY_TIME[state.phase]||null;
    state.autoArrivalAt=performance.now()+17000;
    state.ready=Object.keys(state.actors).length>0;refreshStatus();return state.ready;
  }

  window.LIVING_ESTATE={
    version:VERSION,get ready(){return state.ready;},schedules:SCHEDULES,
    get status(){return window.LIVING_ESTATE_STATUS;},update,setTimeForTest,triggerArrival,
    openSchedule,closeSchedule,reset,destroy,init
  };
  // This file is embedded before APP is declared in the single-file build.
  // Deferring initialization lets the enclosing script finish its declarations.
  if(typeof queueMicrotask==="function")queueMicrotask(init);
  else setTimeout(init,0);
})();
