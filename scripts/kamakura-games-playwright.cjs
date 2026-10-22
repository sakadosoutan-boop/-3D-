/* Run after build:app. Tests real input, ray hits and round lifecycle in the browser. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/kamakura-games');
const errors=[],passed=[];
function check(ok,label){assert.ok(ok,label);passed.push(label);}
(async()=>{
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,pathname==='/'?'寝殿造り3D探訪_統合版.html':'.'+pathname);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
      res.writeHead(404);res.end();return;
    }
    if(path.extname(file)==='.html')res.setHeader('Content-Type','text/html;charset=utf-8');
    else if(path.extname(file)==='.js')res.setHeader('Content-Type','text/javascript');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|VALIDATE_STATUS|ERROR: 0:/.test(m.text()))errors.push(m.text());});
    await page.addInitScript(()=>{window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};localStorage.setItem('shinden3d-onboard-v1','1');});
    await page.goto(`http://127.0.0.1:${server.address().port}/?map=kamakura&adaptive=0&eco=off`,{waitUntil:'load'});
    try{await page.waitForFunction(()=>window.KAMAKURA_GAMES?.state.ready&&window.KAMAKURA_WORLD?.K?.kyudoStart,undefined,{timeout:45000});}
    catch(e){const diag=await page.evaluate(()=>({game:typeof KAMAKURA_GAMES!=='undefined'?KAMAKURA_GAMES.state:null,
      context:!!window.KAMAKURA_WORLD,map:typeof APP!=='undefined'?APP.map:null,three:typeof THREE,mode:typeof APP!=='undefined'?APP.mode:null}));
      throw new Error('Kamakura games init failed: '+JSON.stringify({diag,errors}));}
    const result=await page.evaluate(async()=>{
      enterMode('walk');hideModeBrief(true);onboardClose();AUTO_TIME._paused=true;setTime('day');
      const game=window.KAMAKURA_GAMES,{K,world}=window.KAMAKURA_WORLD,ok={};
      const project=m=>{world.updateMatrixWorld(true);camera.updateMatrixWorld(true);
        const p=m.getWorldPosition(new THREE.Vector3()).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,inside:Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1};};
      const mouse=(type,x,y)=>{const node=type==='mousedown'?cv:window;node.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y}));};
      const pointer=(type,x,y)=>cv.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:3,pointerType:'mouse',clientX:x,clientY:y}));
      ok.module=contextual();function contextual(){return game.state.ready&&game.targets.length===3&&game.supply.parent===world&&game.startMarker.parent===world;}
      ok.pickable=K.kamaExtra.includes(game.supply.children[1])&&K.kamaExtra.includes(game.startMarker.children[1]);
      const originalHorse=game.horse.position.clone(),originalView=APP.view;
      K.kyudoStart();game.update(.016,0);const target=APP.kamaKyudo.targets[0].m,p=project(target);
      ok.practiceTargetVisible=p.inside;
      mouse('mousedown',p.x,p.y);mouse('mouseup',p.x,p.y);
      ok.mouseTapShot=APP.kamaKyudo.fired===1;
      updateTaijiFx(performance.now()+1000);
      ok.mouseTapHit=APP.kamaKyudo.landed===1&&APP.kamaKyudo.score>=1;
      ok.refill=game.refill()&&APP.kamaKyudo.fired===0&&APP.kamaKyudo.landed===0;
      game.update(.016,0);
      const yaw0=player.yaw;mouse('mousedown',p.x,p.y);mouse('mousemove',p.x+20,p.y);
      const movedYaw=player.yaw;mouse('mousemove',p.x,p.y);mouse('mouseup',p.x,p.y);
      ok.dragAimsWithoutShot=Math.abs(movedYaw-yaw0)>.05&&Math.abs(player.yaw-yaw0)<.005&&APP.kamaKyudo.fired===0;
      document.querySelector('#kamaKyudoHud .kk-fire').click();ok.buttonShot=APP.kamaKyudo.fired===1;
      updateTaijiFx(performance.now()+1000);
      ok.buttonHit=APP.kamaKyudo.landed===1&&APP.kamaKyudo.score>=1;
      ok.practiceHud=document.getElementById('kamaKyudoHud').style.display==='block';
      ok.secondRefill=game.refill()&&APP.kamaKyudo.fired===0&&APP.kamaKyudo.landed===0;
      PAUSE_STATE.active=true;document.querySelector('#kamaKyudoHud .kk-fire').click();
      ok.practicePauseBlocked=APP.kamaKyudo.fired===0;PAUSE_STATE.active=false;
      await new Promise(resolve=>setTimeout(resolve,190));
      game.update(.016,0);const p2=project(target);const touch=new Touch({identifier:4,target:cv,clientX:p2.x,clientY:p2.y});
      cv.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[touch],targetTouches:[touch],changedTouches:[touch]}));
      cv.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[touch]}));
      ok.touchShot=APP.kamaKyudo.fired===1;
      updateTaijiFx(performance.now()+1000);
      if(K.kyudoStop)K.kyudoStop();else APP.kamaKyudo.active=false;game.update(.016,0);
      ok.practiceClean=!APP.kamaKyudo.active&&document.getElementById('kamaKyudoHud').style.display==='none';
      keys.w=true;joy.active=true;const begun=game.start('training');game.update(.016,0);
      ok.start=begun&&game.state.active&&game.horse.position.x<-26.5&&document.getElementById('kamaGamesHud').style.display==='block';
      ok.startClearsInput=!keys.w&&!joy.active;
      ok.rideChrome=document.body.classList.contains('kasagake-active')&&
        ['worldStatusBar','minimapWrap','joy','interactBtn','toast'].every(id=>getComputedStyle(document.getElementById(id)).display==='none')&&
        getComputedStyle(document.getElementById('tbPause')).display!=='none';
      const viewBow=world.getObjectByName('kasagake-view-bow');ok.bow=!!viewBow?.visible;
      const stringPos=viewBow.userData.string.geometry.attributes.position,limb=viewBow.userData.limb,grip=viewBow.userData.grip;
      limb.geometry.computeBoundingBox();const limbBox=limb.geometry.boundingBox;
      ok.asymmetricBow=stringPos.getY(2)>.8&&stringPos.getY(0)>-.5&&
        stringPos.getY(2)>Math.abs(stringPos.getY(0))*1.8&&
        Math.abs(limbBox.max.y-stringPos.getY(2))<.04&&Math.abs(limbBox.min.y-stringPos.getY(0))<.04&&
        grip.position.y<0&&Math.abs(grip.rotation.z)<.01&&
        Math.abs(stringPos.getZ(1)-(viewBow.userData.nocked.position.z+.38))<.01;
      pointer('pointerdown',innerWidth/2,innerHeight/2);game.state.drawStart=performance.now()-800;game.update(.016,0);
      ok.drawnStringContact=stringPos.getZ(1)>.25&&
        Math.abs(stringPos.getX(1)-viewBow.userData.nocked.position.x)<.01&&
        Math.abs(stringPos.getZ(1)-(viewBow.userData.nocked.position.z+.38))<.01;
      pointer('pointercancel',innerWidth/2,innerHeight/2);
      const toolbar=document.getElementById('tbPause');let toolbarReached=false;
      toolbar.addEventListener('pointerdown',()=>{toolbarReached=true;},{once:true});
      toolbar.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:9,pointerType:'mouse'}));
      ok.toolbarInputPass=toolbarReached;
      const frozenX=game.horse.position.x;PAUSE_STATE.active=true;game.update(.8,0);
      ok.pauseFreezes=Math.abs(game.horse.position.x-frozenX)<.001&&document.getElementById('kamaGamesHud').style.visibility==='hidden';
      PAUSE_STATE.active=false;game.update(.016,0);ok.pauseRestores=document.getElementById('kamaGamesHud').style.visibility==='visible';
      let attempts=0,lowSeen=false,gaitSeen=false,sightSeen=false,impactSeen=false;
      while(game.state.phase!=='result'&&attempts++<800){
        game.update(.08,attempts*.08);
        impactSeen=impactSeen||document.querySelector('#kamaGamesHud .kg-feedback').style.display==='block';
        const s=game.state,t=game.targets[s.leg===0?s.index:2-s.index];
        if(s.leg===1)lowSeen=game.targets.every(x=>Math.abs(x.mesh.position.y-.62)<.001&&Math.abs(x.mesh.scale.x-x.scale.x*.48)<.001);
        gaitSeen=gaitSeen||Math.abs(game.horse.getObjectByName('kasagake-gait-leg')?.rotation.x||0)>.05;
        if(t&&!t.shot&&Math.abs(game.horse.position.x-t.x)<1.2){
          const pt=project(t.mesh);if(pt.inside){pointer('pointerdown',pt.x,pt.y);s.drawStart=performance.now()-900;pointer('pointerup',pt.x,pt.y);
            sightSeen=sightSeen||Math.abs(parseFloat(document.querySelector('#kamaGamesHud .kg-cross').style.left)-pt.x)<1;}
        }
      }
      ok.routeComplete=game.state.phase==='result'&&game.state.leg===1&&game.state.index===3&&attempts<800;
      ok.sixShots=game.state.shots===6&&game.state.hits===6&&game.state.score>=6;
      ok.lowReturn=lowSeen;ok.gait=gaitSeen;ok.sightFollowsPointer=sightSeen;
      ok.impactFeedback=impactSeen;
      ok.result=document.querySelector('#kamaGamesHud .kg-result').hidden===false;
      const finalScore=game.state.score;keys.w=true;joy.active=true;game.stop();
      ok.stopClearsInput=!keys.w&&!joy.active;
      ok.chromeRestored=!document.body.classList.contains('kasagake-active')&&
        getComputedStyle(document.getElementById('worldStatusBar')).display!=='none'&&
        getComputedStyle(document.getElementById('tbTitle')).display!=='none';
      ok.restore=!game.state.active&&game.horse.position.distanceTo(originalHorse)<.001&&
        game.targets.every(t=>t.mesh.scale.distanceTo(t.scale)<.001)&&APP.view===originalView&&document.getElementById('kamaGamesHud').style.display==='none';
      ok.sightCleanup=document.querySelector('#kamaGamesHud .kg-cross').style.left==='50%'&&game.state.drawing===false;
      game.start('challenge');APP.mode='saigen';game.update(.016,0);
      ok.modeExit=!game.state.active&&game.horse.position.distanceTo(originalHorse)<.001;
      APP.mode='walk';return {ok,score:finalScore,attempts};
    });
    for(const [label,ok]of Object.entries(result.ok))check(ok,label);
    check(errors.length===0,'no browser exceptions: '+errors.join(' | '));
    fs.mkdirSync(out,{recursive:true});
    await page.evaluate(()=>{KAMAKURA_GAMES.start('training');KAMAKURA_GAMES.update(.016,0);renderer.render(scene,camera);});
    // The core schedules its walk-introduction card 520 ms after entering walk.
    await page.waitForTimeout(900);
    const cleanSight=await page.evaluate(()=>{KAMAKURA_GAMES.update(.016,0);renderer.render(scene,camera);
      return !document.getElementById('modeBrief').classList.contains('show')&&
        Number(getComputedStyle(document.getElementById('title')).opacity)<.05;});
    check(cleanSight,'unobstructed riding sight after delayed walk introduction');
    await page.waitForTimeout(450); // let the core introduction's opacity transition finish
    check(await page.evaluate(()=>Number(getComputedStyle(document.getElementById('modeBrief')).opacity)<.05),'walk card fully faded during riding');
    await page.screenshot({path:path.join(out,'ride-outbound.png')});
    await page.evaluate(()=>{let n=0;while(KAMAKURA_GAMES.state.leg===0&&n++<170)KAMAKURA_GAMES.update(.08,n*.08);
      KAMAKURA_GAMES.update(.016,n*.08);renderer.render(scene,camera);});
    await page.screenshot({path:path.join(out,'ride-low-target.png')});
    await page.setViewportSize({width:390,height:844});
    const mobileChrome=await page.evaluate(()=>{KAMAKURA_GAMES.update(.016,14);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.render(scene,camera);
      return getComputedStyle(document.getElementById('tbMore')).display!=='none'&&
        document.querySelector('#kamaGamesHud .kg-top').getBoundingClientRect().top>=document.getElementById('topbar').getBoundingClientRect().bottom;});
    check(mobileChrome,'mobile toolbar separated from riding HUD');
    await page.screenshot({path:path.join(out,'ride-mobile-hud.png')});
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>{
      KAMAKURA_GAMES.stop();setTime('night');AUTO_TIME._paused=true;
      const target=TIMES.night;for(const k of ['sky','fog','sunC','ambC'])cur[k].set(target[k]);
      for(const k of ['sunI','hemi','amb','moon','exp','int'])cur[k]=target[k];cur.sunP.set(...target.sunP);
      KAMAKURA_GAMES.start('challenge');KAMAKURA_GAMES.update(.016,0);
      camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
      // The real frame applies cur to sun/hemi/ambient/exposure and updates the light pool.
      window.__SHINDEN_BENCH_PAUSE=false;clock.oldTime=performance.now()-100;
      try{animate(performance.now()+1000);}finally{window.__SHINDEN_BENCH_PAUSE=true;}
      renderer.render(scene,camera);
    });
    check(await page.evaluate(()=>sun.intensity<.01&&Math.abs(ambient.intensity-TIMES.night.amb)<.01&&
      Math.abs(renderer.toneMappingExposure-TIMES.night.exp)<.01),'night frame applied to actual lights');
    await page.screenshot({path:path.join(out,'ride-night.png')});
    await page.evaluate(()=>KAMAKURA_GAMES.stop());
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'ok',passed,...result},null,2));
    console.log(JSON.stringify({status:'ok',passed,score:result.score,attempts:result.attempts},null,2));
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
