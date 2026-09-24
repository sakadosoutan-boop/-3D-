const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],passed=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/THREE.WebGLProgram|Computed radius is NaN/.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{
   window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};
   localStorage.setItem('shinden3d-onboard-v1','1');
   let seed=0x5eed1234;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 });
 try{
  await page.goto(pathToFileURL(path.resolve('寝殿造り3D探訪_統合版.html')).href+'?adaptive=0');
  await page.waitForFunction(()=>typeof GISSHA_CARRY!=='undefined'&&typeof GARDEN_POLISH!=='undefined');
  await page.evaluate(()=>{enterMode('walk');hideModeBrief(true);AUTO_TIME._paused=true;document.getElementById('loadingScreen').classList.remove('show');});
  await page.waitForTimeout(850); // Let the title transition finish before visual checks.
  const route=await page.evaluate(()=>{
    const samples=Array.from({length:101},(_,i)=>gisshaCarryPath(i/100)),dist=[];
    for(let i=1;i<samples.length;i++)dist.push(samples[i].pos.distanceTo(samples[i-1].pos));
    return {start:samples[0].pos.distanceTo(GISSHA_YARD.carryRoute[0]),end:samples[100].pos.distanceTo(GISSHA_YARD.carryRoute[3]),
      speedRatio:Math.max(...dist)/Math.min(...dist),smooth:samples.slice(1).every((s,i)=>s.tangent.dot(samples[i].tangent)>.985),
      facing:samples[100].tangent.x>.99&&Math.abs(samples[100].tangent.z)<.01};
  });
  assert.ok(route.start<1e-8&&route.end<1e-8&&route.speedRatio<1.03&&route.smooth&&route.facing,JSON.stringify(route));
  passed.push('route has even distance, smooth turns, exact endpoints and faces the gate');
  const motion=await page.evaluate(()=>{
    startGisshaCarry();const original=APP.gisshaCarry;const duplicate=startGisshaCarry();
    keys.w=true;let maxLegSwing=0;
    for(let i=0;i<300;i++){
      updateGisshaCarry(1/60,i/60);
      maxLegSwing=Math.max(maxLegSwing,...GISSHA_YARD.cart.userData.drive.legs.map(l=>Math.abs(l.pivot.rotation.x)));
    }
    const st=APP.gisshaCarry,drive=GISSHA_YARD.cart.userData.drive;
    const result={progress:st.progress,fast:st.speed>.13&&st.bumps>0,wheels:drive.wheels.every(w=>Math.abs(w.rotation.x)>.2),
      legs:maxLegSwing>.02,sameSession:!duplicate&&original===st};
    keys.w=false;endGisshaCarry(false,true);return result;
  });
  assert.ok(motion.progress>.3&&motion.fast&&motion.wheels&&motion.legs&&motion.sameSession,JSON.stringify(motion));
  passed.push('normal input can reach the caution speed, moves wheels and legs, and cannot restart an active run');
  const frameRates=await page.evaluate(()=>[30,60,120].map(fps=>{
    startGisshaCarry();for(let i=0;i<6*fps;i++){keys.w=i<4*fps;keys.s=i>=4*fps;updateGisshaCarry(1/fps,i/fps);}
    const s=APP.gisshaCarry,result={progress:s.progress,speed:s.speed,bumps:s.bumps,elapsed:s.elapsed};endGisshaCarry(false,true);return result;
  }));
  for(const r of frameRates.slice(1)){assert.ok(Math.abs(r.progress-frameRates[0].progress)<1e-8);assert.equal(r.bumps,frameRates[0].bumps);assert.ok(Math.abs(r.elapsed-frameRates[0].elapsed)<1e-8);}
  passed.push('the same six-second input gives the same movement at 30, 60 and 120 fps');
  await page.evaluate(()=>{startGisshaCarry();});
  await page.dispatchEvent('#gcForward','pointerdown',{pointerId:4,pointerType:'touch',button:0,bubbles:true});
  const touching=await page.evaluate(()=>{updateGisshaCarry(.2,0);return APP.gisshaCarry.speed>0&&APP.gisshaCarry.touches.size===1;});assert.ok(touching);
  await page.dispatchEvent('#gcForward','pointercancel',{pointerId:4,pointerType:'touch',bubbles:true});
  assert.equal(await page.evaluate(()=>APP.gisshaCarry.touches.size),0);
  await page.dispatchEvent('#gcForward','pointerdown',{pointerId:5,pointerType:'touch',button:0,bubbles:true});
  const pause=await page.evaluate(()=>{
    const s=APP.gisshaCarry,before=[s.progress,s.elapsed];openPauseMenu();updateGisshaCarry(.5,1);
    const result={paused:PAUSE_STATE.active,frozen:before[0]===s.progress&&before[1]===s.elapsed,released:s.touches.size===0};closePauseMenu();
    keys.w=true;updateGisshaCarry(.1,2);result.resumed=s.progress>before[0];endGisshaCarry(false,true);return result;
  });
  assert.ok(Object.values(pause).every(Boolean),JSON.stringify(pause));
  passed.push('touch cancellation releases throttle, pause clears held input and freezes movement, resume continues');
  const finish=await page.evaluate(()=>{
    player.pos.set(-3,1.62,24);player.yaw=.4;player.pitch=-.1;APP.view='fp';
    const original=player.pos.clone();startGisshaCarry();const s=APP.gisshaCarry;s.progress=.999;s.speed=.1;updateGisshaCarry(.1,1);
    const stillActive=APP.gisshaCarry===s&&s.progress===1;
    const realGain=gainParam,rewards=[];gainParam=(...args)=>{rewards.push(args);return realGain(...args);};
    try{keys.s=true;for(let i=0;i<120;i++)updateGisshaCarry(1/60,2+i/60);for(let i=0;i<30;i++)updateGisshaCarry(1/60,5+i/60);}
    finally{gainParam=realGain;}
    return {stillActive,ended:!APP.gisshaCarry,rewards,result:GISSHA_CARRY.result,
      restored:player.pos.distanceTo(original)<1e-8,blocked:gameplayInputBlocked(),visible:document.getElementById('gisshaCarryResult').style.display==='flex'};
  });
  assert.ok(finish.stillActive&&finish.ended&&finish.restored&&finish.blocked&&finish.visible,JSON.stringify(finish));
  assert.equal(finish.rewards.filter(([key,value])=>key==='miyabi'&&value===1).length,1);
  assert.equal(finish.rewards.filter(([key,value])=>key==='knowledge'&&value===2).length,1);
  assert.equal(finish.result.score,100);
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'gcRetry');
  await page.evaluate(()=>{
    camera.position.set(-52,15,32);camera.lookAt(-49.4,1.3,18.5);
    scene.updateMatrixWorld(true);renderer.render(scene,camera);
  });
  fs.mkdirSync('artifacts/review',{recursive:true});await page.screenshot({path:'artifacts/review/gissha-result.png'});
  await page.click('#gcRetry');assert.equal(await page.evaluate(()=>APP.gisshaCarry?.progress),0);
  await page.evaluate(()=>{endGisshaCarry(false,true);});
  passed.push('reaching the gate requires a stop, completion rewards once, results trap focus and retry starts fresh');
  const cleanup=await page.evaluate(()=>{
    APP.view='ov';player.pos.set(3,1.62,21);player.yaw=.7;const pos=player.pos.clone();startGisshaCarry();keys.w=true;updateGisshaCarry(.2,0);endGisshaCarry(false,true);
    const restored=APP.view==='ov'&&player.pos.equals(pos)&&player.yaw===.7&&!keys.w;
    startGisshaCarry();enterMode('quiz');const modeClean=!APP.gisshaCarry&&!GISSHA_YARD.guide.visible&&!document.body.classList.contains('gissha-carry-active');
    enterMode('walk');hideModeBrief(true);
    const resources=()=>{const ids=[];GISSHA_YARD.root.traverse(o=>{if(o.geometry)ids.push(o.geometry.id);});GISSHA_YARD.guide.traverse(o=>{if(o.geometry)ids.push(o.geometry.id);});return ids.join(',');};
    const before=resources();for(let i=0;i<5;i++){startGisshaCarry();endGisshaCarry(false,true);}return {restored,modeClean,reused:before===resources()};
  });
  assert.ok(Object.values(cleanup).every(Boolean),JSON.stringify(cleanup));
  passed.push('cancel restores the walking view, mode changes clean up and repeated starts reuse geometry');
  for(const [name,width,height] of [['desktop',1280,800],['portrait',390,844],['landscape',844,390]]){
    await page.setViewportSize({width,height});
    const fits=await page.evaluate(()=>{
      startGisshaCarry();APP.labelMode=0;APP.gisshaCarry.progress=.48;gisshaCarrySetCart(.48,0);gisshaCarryUpdateHud(APP.gisshaCarry);
      document.getElementById('loadingScreen').classList.remove('show');
      camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();gisshaCarryCamera(camera);scene.updateMatrixWorld(true);renderer.render(scene,camera);
      document.getElementById('toast').style.display='none';
      const r=document.getElementById('gisshaCarryHud').getBoundingClientRect();
      return r.left>=0&&r.right<=innerWidth&&r.top>=50&&r.bottom<=innerHeight&&['gcLeft','gcForward','gcBrake','gcRight'].every(id=>document.getElementById(id).getBoundingClientRect().height>=44);
    });assert.ok(fits,`${name} HUD must fit with 44px controls`);
    await page.screenshot({path:`artifacts/review/gissha-${name}.png`});await page.evaluate(()=>endGisshaCarry(false,true));
    if(name==='desktop'){
      await page.evaluate(()=>{
        startGisshaCarry();APP.gisshaCarry.progress=.48;gisshaCarrySetCart(.48,0);
        document.getElementById('gcCamera').click();gisshaCarryCamera(camera);
        scene.updateMatrixWorld(true);renderer.render(scene,camera);
      });
      assert.equal(await page.evaluate(()=>APP.gisshaCarry.cameraMode),'wide');
      await page.screenshot({path:'artifacts/review/gissha-wide.png'});
      await page.evaluate(()=>endGisshaCarry(false,true));
    }
  }
  passed.push('desktop, portrait and landscape controls fit the viewport and remain at least 44px high');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'ok',passed,frameRates,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
