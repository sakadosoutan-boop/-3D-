/* Kamakura archery extensions. Installed after map-kamakura has created KAMAKURA_WORLD. */
var KAMAKURA_GAMES=(function(){
  "use strict";
  const state={ready:false,active:false,phase:"idle",kind:"training",assist:false,leg:0,index:0,
    score:0,hits:0,shots:0,misses:0,drawStart:0,drawing:false,time:0,feedbackTime:0,projectiles:[],best:0};
  let K,world,horse,savedHorse,savedPlayer,savedCamera,ui,style,bow,targets=[],supply,startMarker,practiceHud,gaitLegs=[];
  let oldPickHook=null,ray=new THREE.Raycaster(),pointer={x:0,y:0},current=null,previousMode="walk",drawPointerId=null;
  let lastPracticeShot=0,cueWindow=false,hoofAccum=0;
  const V=(x,y,z)=>new THREE.Vector3(x,y,z);
  const mat=(color,roughness=.82)=>new THREE.MeshStandardMaterial({color,roughness,metalness:0});
  const wood=mat(0x5a3924),leather=mat(0x392b20),paper=mat(0xd9c59b,.93),red=mat(0xb54f35),gold=mat(0xc9ab69,.6);
  const shaftGeo=new THREE.CylinderGeometry(.012,.012,.76,6),tipGeo=new THREE.ConeGeometry(.033,.10,6),
    plumeGeo=new THREE.ConeGeometry(.055,.16,5),postGeo=new THREE.CylinderGeometry(.065,.08,1.25,7),
    ringGeo=new THREE.TorusGeometry(.50,.018,6,32),boltGeo=new THREE.BoxGeometry(.57,.41,.045);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function hermitageActive(){return !!(window.SAIGEN_TSUREZURE&&SAIGEN_TSUREZURE.S&&SAIGEN_TSUREZURE.S.active)||
    !!(window.KENKO_HERMITAGE&&KENKO_HERMITAGE.active);}
  function walk(){return APP&&APP.map==="kamakura"&&APP.mode==="walk"&&!hermitageActive();}
  function paused(){return document.hidden||typeof gameplayInputBlocked==="function"&&gameplayInputBlocked();}
  function near(x,z,r){return player&&Math.hypot(player.pos.x-x,player.pos.z-z)<=r;}
  function mesh(g,m,p){const o=new THREE.Mesh(g,m);if(p)o.position.copy(p);o.castShadow=true;return o;}
  function markTree(root,key){root.traverse(o=>{if(o.isMesh)o.userData[key]=true;});return root;}
  function makeSign(x,z,textColor,name,key){
    const g=new THREE.Group();g.name=name;g.position.set(x,0,z);
    g.add(mesh(postGeo,wood,V(0,.625,0)));
    const board=mesh(boltGeo,paper,V(0,1.26,.035));board.material=paper;g.add(board);
    const inset=mesh(new THREE.BoxGeometry(.46,.07,.05),textColor,V(0,1.32,.064));g.add(inset);
    const inset2=mesh(new THREE.BoxGeometry(.30,.035,.05),textColor,V(0,1.22,.064));g.add(inset2);
    const cap=mesh(new THREE.BoxGeometry(.67,.065,.15),wood,V(0,1.49,.02));g.add(cap);
    markTree(g,key);world.add(g);K.kamaExtra.push(...g.children.filter(o=>o.isMesh));return g;
  }
  function makeSupply(){
    // The original rack at (22,20) is decorative and not in kamaExtra. This marker has its own large hit area.
    const g=makeSign(22,20,red,"kamakura-arrow-supply","kamaArrowSupply");
    const quiver=mesh(new THREE.CylinderGeometry(.17,.13,.58,10),leather,V(.42,.43,.06));g.add(quiver);
    for(let i=0;i<4;i++){
      const a=mesh(shaftGeo,paper,V(.36+i*.038,1.0,.06));g.add(a);
      const f=mesh(plumeGeo,red,V(.36+i*.038,1.39,.06));f.rotation.z=Math.PI;g.add(f);
    }
    markTree(g,"kamaArrowSupply");K.kamaExtra.push(...g.children.filter(o=>o.isMesh));return g;
  }
  function makeTargets(){
    const cards=(K.kasagake_mato&&K.kasagake_mato.children||[]).filter(c=>{
      const p=c.geometry&&c.geometry.parameters;return p&&Math.abs((p.width||0)-.7)<.03&&Math.abs((p.height||0)-.7)<.03;
    }).sort((a,b)=>a.position.x-b.position.x);
    targets=cards.map((m,i)=>{
      const ring=mesh(ringGeo,new THREE.MeshBasicMaterial({color:0xf2db8e,transparent:true,opacity:.78,depthWrite:false}),V(0,0,.075));
      ring.visible=false;m.add(ring);return {mesh:m,ring,x:m.position.x,position:m.position.clone(),scale:m.scale.clone(),shot:false,flash:0,i};
    });
    return targets.length===3;
  }
  function prepareGait(){
    // Reparent the existing four rigid leg assemblies. No new leg meshes or per-frame geometry.
    const names=new Set(["horse-upper-leg","horse-knee","horse-shin","horse-hoof"]);
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const pivot=new THREE.Group();pivot.name="kasagake-gait-leg";pivot.position.set(sx*.24,.86,sz*.62);
      const parts=horse.children.filter(o=>names.has(o.name)&&Math.sign(o.position.x)===sx&&Math.sign(o.position.z)===sz);
      if(parts.length!==4)continue;
      for(const part of parts){part.position.sub(pivot.position);pivot.add(part);}
      horse.add(pivot);gaitLegs.push({pivot,phase:sx===sz?0:Math.PI});
    }
  }
  function resetGait(){for(const leg of gaitLegs)leg.pivot.rotation.x=0;
    if(horse&&horse.userData.head)horse.userData.head.rotation.x=0;hoofAccum=0;}
  function makeBow(){
    bow=new THREE.Group();bow.name="kasagake-view-bow";
    // Short lower limb, long upper limb, and a low grip echo the asymmetry of the map's bows.
    const curve=new THREE.CatmullRomCurve3([V(0,-.40,0),V(-.075,-.25,.045),V(-.16,-.08,.075),V(-.13,.24,.07),V(-.06,.56,.035),V(0,.88,0)]);
    const limb=mesh(new THREE.TubeGeometry(curve,24,.026,6,false),wood);bow.add(limb);bow.userData.limb=limb;
    const grip=mesh(new THREE.CylinderGeometry(.038,.038,.20,7),leather,V(-.16,-.08,.075));bow.add(grip);bow.userData.grip=grip;
    const positions=new Float32Array(9);const line=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xe8d5aa}));
    line.geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));bow.add(line);bow.userData.string=line;
    const nocked=mesh(shaftGeo,paper,V(-.13,0,-.35));nocked.rotation.x=Math.PI/2;bow.add(nocked);bow.userData.nocked=nocked;
    const tip=mesh(tipGeo,gold,V(-.13,0,-.76));tip.rotation.x=-Math.PI/2;bow.add(tip);bow.userData.tip=tip;
    const feather=mesh(plumeGeo,red,V(-.13,0,-.01));feather.rotation.x=Math.PI/2;bow.add(feather);bow.userData.feather=feather;
    bow.visible=false;world.add(bow);setDraw(0);
  }
  function setDraw(p){
    if(!bow)return;const a=bow.userData.string.geometry.attributes.position;const pull=.30*p;
    a.setXYZ(0,0,-.40,0);a.setXYZ(1,-.13,0,.03+pull);a.setXYZ(2,0,.88,0);a.needsUpdate=true;
    // Shaft center + half-length (.38) meets the string's moving nock point.
    bow.userData.nocked.position.z=-.35+pull;
    bow.userData.tip.position.z=-.76+pull;
    bow.userData.feather.position.z=-.01+pull;
  }
  function createUI(){
    style=document.createElement("style");style.textContent=`
      #kamaGamesHud{position:fixed;inset:0;z-index:61;pointer-events:none;color:#f5e8d0;font-family:var(--serif,serif);text-shadow:0 2px 5px #111;display:none}
      #kamaGamesHud .kg-top{position:absolute;top:max(12px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(92vw,560px);padding:10px 14px;background:#13212bda;border:1px solid #ad9369;border-radius:9px;text-align:center;line-height:1.5}
      body.kasagake-active #kamaGamesHud .kg-top{top:calc(var(--topbar-h,52px) + 8px)}
      body.kasagake-active #worldStatusBar,body.kasagake-active #minimapWrap,body.kasagake-active #joy,body.kasagake-active #interactBtn,body.kasagake-active #crosshair,body.kasagake-active #toast{display:none!important}
      body.kasagake-active #topbar #tbTitle,body.kasagake-active #topbar .brand,body.kasagake-active #topbar #modeTag,body.kasagake-active #topbar .tb-sep,body.kasagake-active #topbar #tbView,body.kasagake-active #topbar #tbHome,body.kasagake-active #topbar #tbMap,body.kasagake-active #topbar #tbEra{display:none!important}
      body.kasagake-active #topbar .spacer{flex:1!important}
      body.kasagake-active #topbar #tbPause,body.kasagake-active #topbar #tbMore,body.kasagake-active #topbar #tbCodex,body.kasagake-active #topbar #tbGfx,body.kasagake-active #topbar #tbHelp{display:inline-flex!important}
      body.kasagake-active #tbMoreMenu.open{z-index:65}
      #kamaGamesHud .kg-cross{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:36px/1 sans-serif;color:#eacb83;opacity:.88}
      #kamaGamesHud .kg-feedback{position:absolute;left:50%;bottom:155px;transform:translateX(-50%);display:none;min-width:130px;padding:7px 14px;border:1px solid #e3b971;border-radius:18px;background:#17232ee8;text-align:center;font-size:16px;pointer-events:none}
      #kamaGamesHud .kg-bottom{position:absolute;bottom:max(18px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:min(92vw,560px);text-align:center;padding:12px;background:#13212bda;border:1px solid #ad9369;border-radius:9px}
      #kamaGamesHud .kg-meter{height:8px;border-radius:8px;background:#594f43;overflow:hidden;margin:7px 0}.kg-meter>i{display:block;width:0;height:100%;background:linear-gradient(90deg,#b85a3a,#f5cf78)}
      #kamaGamesHud button{pointer-events:auto;color:#fff1d7;background:#57402a;border:1px solid #bc9863;border-radius:7px;min-height:40px;padding:6px 13px;font:inherit;cursor:pointer}
      #kamaGamesHud button:focus-visible{outline:3px solid #ffdf80}
      #kamaGamesHud .kg-result{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(90vw,370px);padding:20px;background:#17232ef2;border:1px solid #cfab70;border-radius:12px;text-align:center;pointer-events:auto;box-shadow:0 16px 46px #0009}
      #kamaGamesHud .kg-result button{margin:5px}
      #kamaGamesPrompt{position:fixed;right:12px;bottom:max(18px,env(safe-area-inset-bottom));z-index:510;display:none;max-width:220px;padding:8px 12px;border-radius:8px;background:#18303cdd;color:#f3dfae;border:1px solid #bc9863;font:14px var(--serif,serif);cursor:pointer}
      #kamaKyudoHud{position:fixed;inset:0;z-index:509;display:none;pointer-events:none;color:#f5e8d0;font-family:var(--serif,serif);text-shadow:0 2px 5px #111}
      #kamaKyudoHud .kk-top{position:absolute;top:max(12px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);padding:8px 13px;background:#172634db;border:1px solid #bc9863;border-radius:8px;text-align:center}
      #kamaKyudoHud .kk-cross{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:30px sans-serif;color:#f3cd72}
      #kamaKyudoHud .kk-controls{position:absolute;right:12px;bottom:max(16px,env(safe-area-inset-bottom));display:flex;gap:7px;pointer-events:auto}
      #kamaKyudoHud button{min-height:48px;padding:8px 14px;border-radius:9px;color:#fff3db;background:#614125;border:1px solid #d1a66e;font:15px var(--serif,serif);cursor:pointer}
      @media(max-width:600px){#kamaGamesHud .kg-top{font-size:12px}.kg-bottom{font-size:12px}}
    `;document.head.appendChild(style);
    ui=document.createElement("div");ui.id="kamaGamesHud";ui.innerHTML='<div class="kg-top"></div><div class="kg-cross">＋</div><div class="kg-feedback" aria-live="polite"></div><div class="kg-bottom"><div class="kg-note"></div><div class="kg-meter"><i></i></div><button class="kg-assist" type="button">照準補助 OFF</button> <button class="kg-exit" type="button">馬場を出る</button></div><div class="kg-result" hidden></div>';
    document.body.appendChild(ui);
    ui.querySelector(".kg-exit").onclick=e=>{e.stopPropagation();stop();};
    ui.querySelector(".kg-assist").onclick=e=>{e.stopPropagation();setAssist(!state.assist);};
    practiceHud=document.createElement("div");practiceHud.id="kamaKyudoHud";
    practiceHud.innerHTML='<div class="kk-top">弓稽古　<span class="kk-count">0 / 10 射</span><br><small>視点を動かして狙い、短くタップ または「射る」で発射</small></div><div class="kk-cross">＋</div><div class="kk-controls"><button type="button" class="kk-fire">射る</button><button type="button" class="kk-refill">矢を補充</button><button type="button" class="kk-exit">終了</button></div>';
    document.body.appendChild(practiceHud);
    practiceHud.querySelector(".kk-fire").onclick=e=>{e.preventDefault();e.stopPropagation();practiceShot(innerWidth/2,innerHeight/2);};
    practiceHud.querySelector(".kk-refill").onclick=e=>{e.preventDefault();e.stopPropagation();refill();};
    practiceHud.querySelector(".kk-exit").onclick=e=>{e.preventDefault();e.stopPropagation();if(K.kyudoStop)K.kyudoStop();else APP.kamaKyudo.active=false;practiceHud.style.display="none";};
    const prompt=document.createElement("button");prompt.id="kamaGamesPrompt";prompt.type="button";document.body.appendChild(prompt);
    prompt.onclick=e=>{e.stopPropagation();if(!walk())return;if(state.active)return;
      if(near(22,20,7))openSupply();else if(near(-27,50,7))openStart();};
  }
  function openSupply(){if(!walk()||state.active)return;K.modal({title:"矢立て・矢の補充",body:"予備の矢を受け取ります。弓稽古は新しい10射として始まり、前回の得点は自己ベストに残ります。",actions:[
    {label:"10射分を補充して稽古",primary:true,on:()=>refill()},
    {label:"戻る",on:()=>K.closeModal()}
  ]});}
  function refill(){if(!walk()||state.active)return false;K.closeModal();if(K.kyudoStop)K.kyudoStop(true);K.kyudoStart();return !!(APP.kamaKyudo&&APP.kamaKyudo.active);}
  function openStart(){if(!walk()||state.active)return;K.modal({title:"馬場・笠懸",body:"走る馬上から、進路の脇の的を射ます。往路と復路で的の大きさを変え、遠笠懸・小笠懸を手短に体験する遊びです。実際の馬場・的の寸法は再現していません。<br>画面を押し続けて弓を引き、離して射ます。",actions:[
    {label:"練習から始める",primary:true,on:()=>start("training")},
    {label:"本番に挑む",on:()=>start("challenge")},
    {label:"戻る",on:()=>K.closeModal()}
  ]});}
  function setAssist(v){state.assist=!!v;if(ui)ui.querySelector(".kg-assist").textContent="照準補助 "+(state.assist?"ON":"OFF");renderHUD();}
  function start(kind){
    if(!state.ready||!walk()||state.active)return false;
    if(K.kyudoStop)K.kyudoStop(true);
    K.closeModal();if(typeof hideModeBrief==="function")hideModeBrief(true);
    if(typeof resetInputState==="function")resetInputState();previousMode=APP.mode;
    savedHorse={position:horse.position.clone(),rotation:horse.rotation.clone(),visible:horse.visible};
    savedPlayer={position:player.pos.clone(),yaw:player.yaw,pitch:player.pitch,view:APP.view};
    savedCamera={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov};
    state.active=true;state.phase="running";state.kind=kind==="challenge"?"challenge":"training";
    state.leg=0;state.index=0;state.score=0;state.hits=0;state.shots=0;state.misses=0;state.drawing=false;state.time=0;state.feedbackTime=0;
    targets.forEach(t=>{t.shot=false;t.flash=0;t.ring.visible=false;t.mesh.scale.copy(t.scale);t.mesh.position.copy(t.position);});
    horse.position.set(-27,0,50);horse.rotation.y=Math.PI/2;horse.visible=true;resetGait();cueWindow=false;
    document.body.classList.add("kasagake-active");ui.style.display="block";ui.querySelector(".kg-result").hidden=true;ui.querySelector(".kg-feedback").style.display="none";document.getElementById("kamaGamesPrompt").style.display="none";
    pointer.x=0;pointer.y=0;drawPointerId=null;const sight=ui.querySelector(".kg-cross");sight.style.left="50%";sight.style.top="50%";
    bow.visible=true;renderHUD();return true;
  }
  function stop(modeChange){
    if(!state.active)return false;
    state.active=false;state.phase="idle";state.drawing=false;state.drawStart=0;state.feedbackTime=0;current=null;drawPointerId=null;pointer.x=0;pointer.y=0;
    document.body.classList.remove("kasagake-active");ui.querySelector(".kg-feedback").style.display="none";
    if(typeof resetInputState==="function")resetInputState();
    if(savedHorse){horse.position.copy(savedHorse.position);horse.rotation.copy(savedHorse.rotation);horse.visible=savedHorse.visible;}resetGait();
    targets.forEach(t=>{t.ring.visible=false;t.mesh.scale.copy(t.scale);t.mesh.position.copy(t.position);});bow.visible=false;setDraw(0);
    for(const p of state.projectiles)world.remove(p.mesh);state.projectiles.length=0;
    if(!modeChange&&savedPlayer){player.pos.copy(savedPlayer.position);player.yaw=savedPlayer.yaw;player.pitch=savedPlayer.pitch;APP.view=savedPlayer.view;
      camera.position.copy(savedCamera.position);camera.quaternion.copy(savedCamera.quaternion);camera.fov=savedCamera.fov;camera.updateProjectionMatrix();
      if(typeof dummyCam!=="undefined"&&dummyCam){dummyCam.position.copy(camera.position);dummyCam.quaternion.copy(camera.quaternion);}}
    const sight=ui.querySelector(".kg-cross");sight.style.left="50%";sight.style.top="50%";
    ui.style.display="none";return true;
  }
  function targetFor(leg,index){const order=leg===0?[0,1,2]:[2,1,0];return targets[order[index]];}
  function finish(){state.phase="result";state.drawing=false;setDraw(0);resetGait();targets.forEach(t=>t.ring.visible=false);
    let best=0;try{best=parseInt(localStorage.getItem("kamakura-kasagake-best")||"0",10)||0;if(state.score>best){best=state.score;localStorage.setItem("kamakura-kasagake-best",String(best));}}catch(_e){}state.best=best;
    const el=ui.querySelector(".kg-result");el.hidden=false;el.innerHTML='<h2>笠懸の結果</h2><p>'+state.score+' / 12 点　的中 '+state.hits+' / 6<br>自己ベスト '+best+' 点</p><p>往路と復路の小的を射終えました。</p><button type="button" data-go="training">練習をもう一度</button><button type="button" data-go="challenge">本番に再挑戦</button><button type="button" data-go="exit">馬場を出る</button>';
    el.querySelectorAll("button").forEach(b=>b.onclick=e=>{e.stopPropagation();const go=b.dataset.go;stop();if(go!=="exit")start(go);});
    renderHUD();
  }
  function renderHUD(){if(!ui||!state.active)return;const t=targetFor(state.leg,state.index),running=state.phase==="running";
    const label=state.kind==="training"?"練習":"本番";
    ui.querySelector(".kg-top").textContent="笠懸 "+label+" ｜ "+(state.leg===0?"往路・通常的":"復路・低い小的")+" ｜ "+Math.min(6,state.leg*3+state.index+1)+" / 6 的 ｜ "+state.score+" 点";
    const note=ui.querySelector(".kg-note");note.textContent=running?(t&&cueWindow&&!t.shot?"今だ。押し続けて引き、離して射る":"次の的へ。押し続けて弓を引く")+(state.assist?"　照準補助 ON":"　照準補助 OFF"):state.phase==="landing"?"矢の着弾を待つ":"走行終了";
    ui.querySelector(".kg-cross").style.opacity=state.assist?"1":".68";
  }
  function fire(){if(!state.active||state.phase!=="running")return false;
    const t=targetFor(state.leg,state.index);if(!t||t.shot||Math.abs(horse.position.x-t.x)>7)return false;
    const charge=clamp((performance.now()-state.drawStart)/750,0,1);state.drawing=false;setDraw(0);
    // A ray through the visible reticle determines the hit; assistance widens the outer scoring zone only.
    ray.setFromCamera(pointer,camera);const hit=ray.intersectObject(t.mesh,false)[0];
    let point,pts=0;
    if(hit){point=hit.point.clone();const center=t.mesh.getWorldPosition(V(0,0,0));const d=Math.hypot(point.x-center.x,point.y-center.y);
      pts=d<(state.leg===0?.13:.085)?2:1;
    }else{
      const planeZ=t.mesh.getWorldPosition(V(0,0,0)).z;
      const dist=(planeZ-ray.ray.origin.z)/ray.ray.direction.z;
      point=dist>0&&dist<100?ray.ray.at(dist,V(0,0,0)):ray.ray.at(25,V(0,0,0));
      const center=t.mesh.getWorldPosition(V(0,0,0));
      if(state.assist&&charge>.35&&Math.hypot(point.x-center.x,point.y-center.y)<.53){pts=1;point.copy(center);point.z+=.06;}
    }
    if(charge<.16)pts=0;
    t.shot=true;state.shots++;
    const from=bow.getWorldPosition(V(0,0,0));const arrowMesh=mesh(shaftGeo,paper);
    const projectile=new THREE.Group();projectile.add(arrowMesh);const head=mesh(tipGeo,gold,V(0,.43,0));projectile.add(head);
    projectile.position.copy(from);projectile.quaternion.setFromUnitVectors(V(0,1,0),point.clone().sub(from).normalize());world.add(projectile);
    state.projectiles.push({mesh:projectile,from,to:point,age:0,pts,target:t,resolved:false});
    if(typeof seArrowShot==="function")seArrowShot();
    renderHUD();return true;
  }
  function updateProjectiles(dt){for(let i=state.projectiles.length-1;i>=0;i--){const p=state.projectiles[i];p.age+=dt;
      const f=clamp(p.age/.22,0,1);p.mesh.position.copy(p.from).lerp(p.to,f);
      if(f>=1&&!p.resolved){p.resolved=true;if(p.pts){state.score+=p.pts;state.hits++;p.target.flash=.35;if(typeof seArrowHit==="function")seArrowHit();}else state.misses++;
        const feedback=ui.querySelector(".kg-feedback");feedback.textContent=p.pts===2?"中心！ 2点":p.pts===1?"的中！ 1点":"外れ";feedback.style.display="block";state.feedbackTime=.9;renderHUD();}
      if(p.age>.6){world.remove(p.mesh);state.projectiles.splice(i,1);}
    }if(state.phase==="landing"&&state.projectiles.every(p=>p.resolved))finish();}
  function update(dt,t){
    if(!state.ready)return;if(state.active&&!walk()){stop(true);return;}
    // The walk introduction is scheduled after mode entry. Keep it off the riding sight.
    if(state.active&&typeof hideModeBrief==="function"&&document.getElementById("modeBrief")?.classList.contains("show"))hideModeBrief(true);
    if(APP.kamaKyudo&&APP.kamaKyudo.active&&!walk()){
      if(K.kyudoStop)K.kyudoStop();else APP.kamaKyudo.active=false;
    }
    const prompt=document.getElementById("kamaGamesPrompt");if(!state.active){
      const available=walk()&&!paused(),practice=available&&!!(APP.kamaKyudo&&APP.kamaKyudo.active);
      // The map's kyudoStart now snaps the first-person camera exactly onto the target.
      const practiceDisplay=practice?"block":"none";if(practiceHud.style.display!==practiceDisplay)practiceHud.style.display=practiceDisplay;
      if(practice){const k=APP.kamaKyudo,count=k.fired+" / 10 射　"+k.score+" 点",counter=practiceHud.querySelector(".kk-count");
        if(counter.textContent!==count)counter.textContent=count;
        const refillDisplay=k.fired>=10?"block":"none",button=practiceHud.querySelector(".kk-refill");
        if(button.style.display!==refillDisplay)button.style.display=refillDisplay;}
      const isSupply=available&&near(22,20,7),isStart=available&&near(-27,50,7);
      const promptDisplay=!practice&&(isSupply||isStart)?"block":"none",promptText=isSupply?"矢立て：矢を補充する":"馬場：笠懸を始める";
      if(prompt.style.display!==promptDisplay)prompt.style.display=promptDisplay;
      if(prompt.style.display==="block"&&prompt.textContent!==promptText)prompt.textContent=promptText;return;
    }
    if(paused()){ui.style.visibility="hidden";drawPointerId=null;state.drawing=false;setDraw(0);return;}
    ui.style.visibility="visible";
    if(state.feedbackTime>0){state.feedbackTime=Math.max(0,state.feedbackTime-clamp(dt||0,0,.08));if(!state.feedbackTime)ui.querySelector(".kg-feedback").style.display="none";}
    if(state.phase==="running"){
      const step=clamp(dt||0,0,.08),speed=state.kind==="training"?4.6:7.2,dir=state.leg===0?1:-1;
      state.time+=step;horse.position.x+=dir*speed*step;horse.position.y=Math.sin(state.time*12)*.026;
      horse.rotation.y=dir>0?Math.PI/2:-Math.PI/2;
      for(const leg of gaitLegs)leg.pivot.rotation.x=Math.sin(state.time*11+leg.phase)*.20;
      if(horse.userData.head)horse.userData.head.rotation.x=Math.sin(state.time*11)*.025;
      hoofAccum+=step;if(hoofAccum>=.36){hoofAccum-=.36;if(typeof beep==="function")beep(145,.035,"triangle",.018);}
      const tgt=targetFor(state.leg,state.index);
      if(tgt){const dx=horse.position.x-tgt.x;
        if(dir*dx>7){if(!tgt.shot)state.misses++;state.index++;
          if(state.index>=3){if(state.leg===0){state.leg=1;state.index=0;horse.position.x=23;horse.rotation.y=-Math.PI/2;
            targets.forEach(x=>{x.shot=false;x.mesh.scale.copy(x.scale).multiplyScalar(.48);x.mesh.position.y=.62;});}
            else state.phase="landing";}
          cueWindow=false;
          renderHUD();}
      }
      current=state.phase==="running"?targetFor(state.leg,state.index):null;
      const nextCue=!!current&&!current.shot&&Math.abs(horse.position.x-current.x)<7;
      if(nextCue!==cueWindow){cueWindow=nextCue;renderHUD();}
      for(const tg of targets){tg.flash=Math.max(0,tg.flash-step);tg.ring.visible=(tg===current&&!tg.shot)||tg.flash>0;
        if(tg.ring.visible){tg.ring.material.opacity=tg.flash>0?.95:.58+.22*Math.sin(state.time*8);tg.ring.scale.setScalar(tg.flash>0?1.1:state.leg===0?1:.82);}}
    }
    // Camera moves with the horse before BLOOM.render. A controlled sight sway makes aiming active.
    const tgt=targetFor(state.leg,state.index)||targets[1],dir=state.leg===0?1:-1;
    player.pos.set(horse.position.x,2.15,horse.position.z);player.yaw=dir>0?Math.PI/2:-Math.PI/2;player.pitch=-.04;
    camera.position.set(horse.position.x-dir*1.35,2.42+Math.sin(state.time*12)*.02,horse.position.z+1.02);
    camera.lookAt(tgt.x+Math.sin(state.time*2.8)*.42,tgt.mesh.position.y+.05,45.8);
    camera.updateMatrixWorld();
    if(typeof dummyCam!=="undefined"&&dummyCam){dummyCam.position.copy(camera.position);dummyCam.quaternion.copy(camera.quaternion);}
    bow.position.copy(camera.position).add(V(camera.aspect<.7?.30:.55,-.34,-1.05).applyQuaternion(camera.quaternion));bow.quaternion.copy(camera.quaternion);
    if(state.drawing&&state.phase==="running")setDraw(clamp((performance.now()-state.drawStart)/750,0,1));
    ui.querySelector(".kg-meter i").style.width=(state.drawing?Math.round(clamp((performance.now()-state.drawStart)/750,0,1)*100):0)+"%";
    updateProjectiles(dt||0);
  }
  function onPointerMove(e){if(!state.active||e.target!==cv&&drawPointerId===null)return;pointer.x=clamp(e.clientX/innerWidth*2-1,-1,1);pointer.y=clamp(1-e.clientY/innerHeight*2,-1,1);
    const sight=ui.querySelector(".kg-cross");sight.style.left=e.clientX+"px";sight.style.top=e.clientY+"px";}
  function practiceShot(x,y){
    if(!walk()||state.active||paused()||!APP.kamaKyudo||!APP.kamaKyudo.active||K.isModalOpen&&K.isModalOpen())return false;
    const now=performance.now();if(now-lastPracticeShot<150)return false;lastPracticeShot=now;
    const sight=practiceHud.querySelector(".kk-cross");sight.style.left=x+"px";sight.style.top=y+"px";
    // map-kamakura owns ammunition, arrow effects and scoring. Call the same shoot path.
    if(typeof K.kyudoShoot==="function")K.kyudoShoot(x,y);else if(typeof pick==="function")pick(x,y);
    return true;
  }
  function onPointerDown(e){if(!state.active||state.phase!=="running"||paused()||e.target!==cv)return;
    onPointerMove(e);state.drawing=true;state.drawStart=performance.now();drawPointerId=e.pointerId;
    e.preventDefault();e.stopImmediatePropagation();}
  function onPointerUp(e){if(!state.active||drawPointerId!==e.pointerId)return;
    drawPointerId=null;if(e.target===cv&&!paused()){onPointerMove(e);if(state.drawing)fire();e.preventDefault();e.stopImmediatePropagation();}
    state.drawing=false;setDraw(0);}
  function onPointerCancel(){if(!state.active)return;drawPointerId=null;state.drawing=false;setDraw(0);}
  function onGameMouse(e){if(!state.active||e.target!==cv)return;e.preventDefault();e.stopImmediatePropagation();}
  function onGameTouch(e){if(!state.active||e.target!==cv)return;e.preventDefault();e.stopImmediatePropagation();}
  function onClick(e){if(!state.active||e.target!==cv)return;e.preventDefault();e.stopImmediatePropagation();}
  function onKeyDown(e){if(!state.active||paused()||e.target&&e.target.closest&&e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    if(e.key==="Escape"){stop();e.preventDefault();e.stopImmediatePropagation();return;}
    if(e.code==="Space"){if(!state.drawing&&state.phase==="running"){state.drawing=true;state.drawStart=performance.now();pointer.x=0;pointer.y=0;
      const sight=ui.querySelector(".kg-cross");sight.style.left="50%";sight.style.top="50%";}e.preventDefault();e.stopImmediatePropagation();return;}
    if(/^[wasd]$/i.test(e.key)||e.key.startsWith("Arrow")){e.preventDefault();e.stopImmediatePropagation();}
  }
  function onKeyUp(e){if(!state.active||paused()||e.target&&e.target.closest&&e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    if(e.code==="Space"){if(state.drawing)fire();state.drawing=false;setDraw(0);e.preventDefault();e.stopImmediatePropagation();}}
  function init(context){
    if(state.ready)return true;
    if(!context||!context.K||!(context.world||context.worldK))return false;
    K=context.K;world=context.world||context.worldK;
    if(!K.kamaExtra||!K.modal||!K.kyudoStart)return false;
    horse=world.children.find(o=>o.name==="kamakura-horse"&&Math.abs(o.position.z-50)<1);
    if(!horse||!makeTargets())return false;
    prepareGait();
    supply=makeSupply();startMarker=makeSign(-27,50,gold,"kamakura-kasagake-start","kamaKasagakeStart");
    makeBow();createUI();oldPickHook=K.pickHook;
    K.pickHook=function(hit){let o=hit&&hit.object;while(o&&o!==world){
      if(o.userData&&o.userData.kamaArrowSupply){if(walk()&&near(22,20,7))openSupply();return true;}
      if(o.userData&&o.userData.kamaKasagakeStart){if(walk()&&near(-27,50,7))openStart();return true;}
      o=o.parent;
    }return oldPickHook?oldPickHook(hit):false;};
    addEventListener("pointermove",onPointerMove,true);addEventListener("pointerdown",onPointerDown,true);
    addEventListener("pointerup",onPointerUp,true);addEventListener("pointercancel",onPointerCancel,true);addEventListener("click",onClick,true);
    addEventListener("keydown",onKeyDown,true);addEventListener("keyup",onKeyUp,true);
    cv.addEventListener("mousedown",onGameMouse,true);cv.addEventListener("touchstart",onGameTouch,{capture:true,passive:false});
    cv.addEventListener("touchend",onGameTouch,{capture:true,passive:false});
    state.ready=true;return true;
  }
  return {init,update,start,stop,refill,setAssist,openSupply,openStart,get state(){return state;},
    get supply(){return supply;},get startMarker(){return startMarker;},get horse(){return horse;},get targets(){return targets;}};
})();
