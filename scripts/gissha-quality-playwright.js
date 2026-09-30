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
    await page.waitForTimeout(700);
    const route=await page.evaluate(()=>{
      const p=Array.from({length:201},(_,i)=>gisshaCarryPath(i/200));
      const ds=p.slice(1).map((v,i)=>v.pos.distanceTo(p[i].pos));
      return {length:GISSHA_CARRY.length,start:p[0].pos.distanceTo(GISSHA_YARD.carryRoute[0]),
        end:p.at(-1).pos.distanceTo(GISSHA_YARD.carryRoute.at(-1)),ratio:Math.max(...ds)/Math.min(...ds),
        north:p.some(q=>q.pos.z< -51&&Math.abs(q.pos.x)<5),garage:GISSHA_YARD.carryRoute.at(-1).x< -52,
        east:GISSHA_YARD.carryRoute[0].x>50};
    });
    assert.ok(route.length>195&&route.start<.01&&route.end<.01&&route.ratio<1.06&&route.north&&route.garage&&route.east,JSON.stringify(route));
    passed.push('east-gate to west-shed route circles the northern passage for over 195 m');
    const motion=await page.evaluate(()=>{
      startGisshaCarry();const st=APP.gisshaCarry,start=GISSHA_YARD.cart.position.clone(),duplicate=startGisshaCarry();keys.w=true;
      let legSwing=0;for(let i=0;i<360;i++){updateGisshaCarry(1/60,i/60);legSwing=Math.max(legSwing,...GISSHA_YARD.cart.userData.drive.legs.map(l=>Math.abs(l.pivot.rotation.x)));}
      const rig=new THREE.Object3D();gisshaCarryCamera(rig);
      const dir=new THREE.Vector3(-Math.sin(st.heading),0,-Math.cos(st.heading));
      const result={distance:start.distanceTo(GISSHA_YARD.cart.position),progress:st.progress,
        wheels:GISSHA_YARD.cart.userData.drive.wheels.every(w=>Math.abs(w.rotation.x)>.2),legs:legSwing>.02,
        behind:rig.position.clone().sub(GISSHA_YARD.cart.position).setY(0).normalize().dot(dir)<-.75,duplicate};
      endGisshaCarry(false,true);return result;
    });
    assert.ok(motion.distance>10&&motion.progress>.04&&motion.wheels&&motion.legs&&motion.behind&&!motion.duplicate,JSON.stringify(motion));
    passed.push('the cart travels, animates and uses a rear chase camera');
    const frameRates=await page.evaluate(()=>[30,60,120].map(fps=>{
      startGisshaCarry();for(let i=0;i<8*fps;i++){keys.w=i<5*fps;keys.s=i>=5*fps;updateGisshaCarry(1/fps,i/fps);}
      const s=APP.gisshaCarry,result={progress:s.progress,x:GISSHA_YARD.cart.position.x,z:GISSHA_YARD.cart.position.z,elapsed:s.elapsed};
      endGisshaCarry(false,true);return result;
    }));
    for(const r of frameRates.slice(1))for(const field of ['progress','x','z','elapsed'])assert.ok(Math.abs(r[field]-frameRates[0][field])<1e-6,JSON.stringify(frameRates));
    passed.push('fixed-step movement agrees at 30, 60 and 120 fps');
    const contacts=await page.evaluate(()=>['a','d'].map(direction=>{
      startGisshaCarry();keys.w=true;keys[direction]=true;
      for(let i=0;i<1600&&!APP.gisshaCarry.contacts;i++)updateGisshaCarry(1/120,i/120);
      const st=APP.gisshaCarry,result={hits:st.contacts,lateral:st.lateral,limit:GISSHA_CARRY.laneHalf};endGisshaCarry(false,true);return result;
    }));
    assert.ok(contacts.every(c=>c.hits>0&&Math.abs(c.lateral)<=c.limit+1e-6),JSON.stringify(contacts));
    passed.push('both steering directions meet a bounded corridor and register contact');
    await page.evaluate(()=>startGisshaCarry());
    await page.dispatchEvent('#gcForward','pointerdown',{pointerId:4,pointerType:'touch',button:0,bubbles:true});
    assert.ok(await page.evaluate(()=>{updateGisshaCarry(.2,0);return APP.gisshaCarry.speed>0&&APP.gisshaCarry.touches.size===1;}));
    await page.dispatchEvent('#gcForward','pointercancel',{pointerId:4,pointerType:'touch',bubbles:true});
    assert.equal(await page.evaluate(()=>APP.gisshaCarry.touches.size),0);
    const pause=await page.evaluate(()=>{
      const s=APP.gisshaCarry,before=[s.progress,s.elapsed];openPauseMenu();updateGisshaCarry(.5,1);
      const result={frozen:before[0]===s.progress&&before[1]===s.elapsed,released:s.touches.size===0};
      closePauseMenu();keys.w=true;updateGisshaCarry(.1,2);result.resumed=s.progress>before[0];endGisshaCarry(false,true);return result;
    });
    assert.ok(Object.values(pause).every(Boolean),JSON.stringify(pause));
    passed.push('touch release and pause clear input');
    const delivery=await page.evaluate(()=>{
      startGisshaCarry();const trace=[];
      for(let i=0;i<18000&&APP.gisshaCarry;i++){
        const st=APP.gisshaCarry,remaining=(1-st.progress)*GISSHA_CARRY.length;
        keys.w=remaining>Math.max(2.4,st.speed*st.speed/6.6+1.1);keys.s=!keys.w;
        updateGisshaCarry(1/120,i/120);
        if(i%1200===0&&APP.gisshaCarry)trace.push({seconds:i/120,progress:st.progress,x:GISSHA_YARD.cart.position.x,z:GISSHA_YARD.cart.position.z,speed:st.speed,contacts:st.contacts});
      }
      const out={ended:!APP.gisshaCarry,result:GISSHA_CARRY.result,trace,
        last:[GISSHA_YARD.cart.position.x,GISSHA_YARD.cart.position.z],visible:document.getElementById('gisshaCarryResult').style.display==='flex'};
      if(APP.gisshaCarry)endGisshaCarry(false,true);return out;
    });
    assert.ok(delivery.ended&&delivery.visible&&delivery.result&&delivery.result.elapsed>30&&delivery.result.contacts<=3,JSON.stringify(delivery));
    assert.ok(Math.hypot(delivery.last[0]+53.2,delivery.last[1]-20.6)<1.2,JSON.stringify(delivery));
    passed.push('assisted delivery finishes only after controlled parking at the cart shed');
    await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'gcRetry');
    fs.mkdirSync('artifacts/review',{recursive:true});await page.screenshot({path:'artifacts/review/gissha-result.png'});
    await page.click('#gcRetry');assert.equal(await page.evaluate(()=>APP.gisshaCarry?.progress),0);
    await page.evaluate(()=>endGisshaCarry(false,true));
    const cleanup=await page.evaluate(()=>{
      APP.view='ov';player.pos.set(3,1.62,21);player.yaw=.7;const pos=player.pos.clone();startGisshaCarry();keys.w=true;updateGisshaCarry(.2,0);endGisshaCarry(false,true);
      const restored=APP.view==='ov'&&player.pos.equals(pos)&&player.yaw===.7&&!keys.w;
      startGisshaCarry();enterMode('quiz');const modeClean=!APP.gisshaCarry&&!GISSHA_YARD.guide.visible&&!document.body.classList.contains('gissha-carry-active');
      enterMode('walk');hideModeBrief(true);
      const resources=()=>{const ids=[];GISSHA_YARD.root.traverse(o=>{if(o.geometry)ids.push(o.geometry.id);});GISSHA_YARD.guide.traverse(o=>{if(o.geometry)ids.push(o.geometry.id);});return ids.join(',');};
      const before=resources();for(let i=0;i<4;i++){startGisshaCarry();endGisshaCarry(false,true);}return {restored,modeClean,reused:before===resources()};
    });
    assert.ok(Object.values(cleanup).every(Boolean),JSON.stringify(cleanup));
    passed.push('cancel restores walking and repeat starts reuse geometry');
    const guideDraws=await page.evaluate(()=>{
      startGisshaCarry();scene.updateMatrixWorld(true);renderer.info.reset();renderer.render(scene,camera);const withGuide=renderer.info.render.calls;
      GISSHA_YARD.guide.visible=false;renderer.info.reset();renderer.render(scene,camera);const withoutGuide=renderer.info.render.calls;
      endGisshaCarry(false,true);return withGuide-withoutGuide;
    });
    assert.ok(guideDraws>0&&guideDraws<=8,`guide costs ${guideDraws} draw calls`);
    passed.push(`route guide costs ${guideDraws} draw calls`);
    for(const [name,width,height] of [['desktop',1280,800],['portrait',390,844],['landscape',844,390]]){
      await page.setViewportSize({width,height});
      const fits=await page.evaluate(()=>{
        startGisshaCarry();APP.labelMode=0;const st=APP.gisshaCarry;
        st.progress=.48;gisshaCarrySetCart(.48,0);st.heading=GISSHA_YARD.cart.rotation.y;gisshaCarryUpdateHud(st);
        camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();gisshaCarryCamera(camera);scene.updateMatrixWorld(true);renderer.render(scene,camera);
        document.getElementById('toast').style.display='none';
        const r=document.getElementById('gisshaCarryHud').getBoundingClientRect();
        return r.left>=0&&r.right<=innerWidth&&r.top>=40&&r.bottom<=innerHeight&&['gcLeft','gcForward','gcBrake','gcRight','gcCamera','gcRestart','gcCancel'].every(id=>document.getElementById(id).getBoundingClientRect().height>=44);
      });
      assert.ok(fits,`${name} HUD fit`);
      await page.screenshot({path:`artifacts/review/gissha-${name}.png`});await page.evaluate(()=>endGisshaCarry(false,true));
      if(name==='desktop'){
        await page.evaluate(()=>{startGisshaCarry();document.getElementById('gcCamera').click();gisshaCarryCamera(camera);scene.updateMatrixWorld(true);renderer.render(scene,camera);});
        assert.equal(await page.evaluate(()=>APP.gisshaCarry.cameraMode),'wide');
        await page.screenshot({path:'artifacts/review/gissha-wide.png'});await page.evaluate(()=>endGisshaCarry(false,true));
      }
    }
    passed.push('desktop and phone controls fit with full-size touch targets');
    assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'ok',passed,route,motion,frameRates,delivery,errors},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
