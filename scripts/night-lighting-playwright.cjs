const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),label=process.argv[2]||'after',html=fs.readFileSync(path.resolve(root,process.argv[3]||'寝殿造り3D探訪_統合版.html'));
const out=path.join(root,'artifacts/night-lighting');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);return;}
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  fs.createReadStream(file).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;const report={label,sourceBytes:html.length,errors:[],phases:[],passed:[]};
 try{
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
  await page.addInitScript(()=>{
   window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};
   localStorage.setItem('shinden3d-onboard-v1','1');
   let seed=0x5eed1234;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  });
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|VALIDATE_STATUS|ERROR: 0:/.test(m.text()))report.errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}/?adaptive=0&eco=off`,{waitUntil:'load'});
  await page.waitForFunction(()=>typeof GFX!=='undefined'&&typeof LOW_POWER!=='undefined');
  const optimized=await page.evaluate(()=>typeof NIGHT_LIGHTING!=='undefined');
  await page.evaluate(()=>{enterMode('walk');hideModeBrief(true);onboardClose();AUTO_TIME._paused=true;APP_FPSCAP=0;APP.labelMode=0;GFX.setPreset('high');GFX.setBloom('off');player.pos.set(0,1.62,26);player.yaw=0;});
  for(const eco of [false,true]){
   await page.evaluate(eco=>{LOW_POWER.set(eco,{persist:false,silent:true});APP_FPSCAP=0;},eco);
   for(let cycle=0;cycle<2;cycle++)for(const time of ['dawn','day','dusk','night']){
    const phase=await page.evaluate(time=>{
     setTime(time);AUTO_TIME._paused=true;const target=TIMES[time];
     for(const k of ['sky','fog','sunC','ambC'])cur[k].set(target[k]);
     for(const k of ['sunI','hemi','amb','moon','exp','int'])cur[k]=target[k];cur.sunP.set(...target.sunP);
     const gl=renderer.getContext(),first=[],steady=[],before=renderer.info.programs.length;
     for(let i=0;i<42;i++){
      clock.running=true;clock.oldTime=performance.now()-100;
      const start=performance.now();window.__nightFrameStamp=Math.max(window.__nightFrameStamp||0,performance.now())+100;window.__SHINDEN_BENCH_PAUSE=false;animate(window.__nightFrameStamp);window.__SHINDEN_BENCH_PAUSE=true;gl.finish();
      (i<12?first:steady).push(performance.now()-start);
     }
     let lights=0;scene.traverseVisible(o=>{if(o.isPointLight)lights++;});steady.sort((a,b)=>a-b);
     return {lights,programsBefore:before,programsAfter:renderer.info.programs.length,transitionMaxMs:+Math.max(...first).toFixed(2),medianMs:+steady[Math.floor(steady.length/2)].toFixed(2),stats:typeof NIGHT_LIGHTING!=='undefined'?NIGHT_LIGHTING.stats:null};
    },time);
    report.phases.push({eco,cycle,time,...phase});console.log(`${label}/${eco?'eco':'high'}/${cycle}/${time}: ${phase.lights} lights, ${phase.programsAfter} programs, transition ${phase.transitionMaxMs} ms`);
    if(optimized)assert.equal(phase.lights,eco?2:4,'same light budget in every time-of-day frame');
   }
  }
  if(optimized){
   report.passed.push('fixed light count survives all four times, repeated cycles and eco changes');
   const controls=await page.evaluate(()=>{
    LOW_POWER.set(false,{persist:false,silent:true});NIGHT_LIGHTING.update(camera,true);
    const before=NIGHT_LIGHTING.stats.sources,root=new THREE.Group(),light=new THREE.PointLight(0xffaa55,20,12,2);
    root.position.copy(camera.position).add(new THREE.Vector3(0,0,-1));root.add(light);scene.add(root);NIGHT_LIGHTING.update(camera,true);
    const chosen=NIGHT_LIGHTING.stats.selected.includes(light.id)&&!light.visible;
    light.intensity=0;NIGHT_LIGHTING.update(camera);const extinguished=!NIGHT_LIGHTING.stats.selected.includes(light.id);
    light.intensity=20;root.visible=false;NIGHT_LIGHTING.update(camera);const hidden=!NIGHT_LIGHTING.stats.selected.includes(light.id);
    root.visible=true;scene.remove(root);NIGHT_LIGHTING.update(camera,true);const released=NIGHT_LIGHTING.stats.sources===before;
    scene.add(root);NIGHT_LIGHTING.update(camera,true);const reattached=NIGHT_LIGHTING.stats.selected.includes(light.id);
    const late=new THREE.PointLight(0x55aaff,30,12,2);root.add(late);
    let visiblePoints=0;scene.traverseVisible(o=>{if(o.isPointLight)visiblePoints++;});
    const lateHiddenImmediately=!late.visible&&visiblePoints===4;
    NIGHT_LIGHTING.update(camera);const lateChosen=NIGHT_LIGHTING.stats.selected.includes(late.id);
    late.visible=false;NIGHT_LIGHTING.update(camera);const visibilityOff=!NIGHT_LIGHTING.stats.selected.includes(late.id);
    late.visible=true;NIGHT_LIGHTING.update(camera);const visibilityOn=NIGHT_LIGHTING.stats.selected.includes(late.id)&&!late.visible;
    const active=SAIGEN_TSUREZURE.S.active;
    SAIGEN_TSUREZURE.S.active=true;NIGHT_LIGHTING.update(camera);
    const replayRestored=late.visible&&light.visible&&NIGHT_LIGHTING.stats.passthrough;
    late.visible=false;NIGHT_LIGHTING.update(camera);const replayToggle=!late.visible;
    SAIGEN_TSUREZURE.S.active=active;NIGHT_LIGHTING.update(camera);
    const afterReplay=!NIGHT_LIGHTING.stats.passthrough&&!NIGHT_LIGHTING.stats.selected.includes(late.id);
    scene.remove(root);NIGHT_LIGHTING.update(camera,true);
    const descriptor=Object.getOwnPropertyDescriptor(late,'visible');
    const detachRestored=descriptor.value===false&&!descriptor.get;
    const initiallyHidden=new THREE.PointLight(0xffffff,30,12,2);initiallyHidden.visible=false;root.add(initiallyHidden);scene.add(root);
    initiallyHidden.visible=true;NIGHT_LIGHTING.update(camera);const initiallyHiddenCanEnable=NIGHT_LIGHTING.stats.selected.includes(initiallyHidden.id);
    scene.remove(root);NIGHT_LIGHTING.update(camera);
    const fan=scene.getObjectByName('lost-folding-fan');SELECTED_WORLD.update(.4);
    const fanParts=['pleated-fan-paper','fan-bamboo-ribs','fan-pivot-grip','fan-rivet','fan-owner-cord'].every(n=>fan?.getObjectByName(n));
    const grounded=fan&&Math.abs(fan.position.y-groundH(fan.position.x,fan.position.z)-.012)<1e-6;
    return {chosen,extinguished,hidden,released,reattached,lateHiddenImmediately,lateChosen,visibilityOff,visibilityOn,replayRestored,replayToggle,afterReplay,detachRestored,initiallyHiddenCanEnable,fanParts,grounded};
   });
   for(const [key,value]of Object.entries(controls)){assert.ok(value,key);report.passed.push(key);}
   const inspector=await page.evaluate(()=>{
    const ids=['toudai','kichou'],saved=ids.map(id=>({id,roots:interactables[id].roots,unlocked:codexUnlocked.has(id)}));
    const fixtures=ids.map((id,i)=>{const g=new THREE.Group();g.position.copy(camera.position).add(new THREE.Vector3(i*2,0,-1));
      const mesh=new THREE.Mesh(new THREE.SphereGeometry(.2,8,6),MAT.wood),lamp=new THREE.PointLight(0xffaa55,20,12,2);g.add(mesh,lamp);scene.add(g);
      interactables[id].roots=[g];codexUnlocked.add(id);return {g,lamp};});
    const neighbouring=new THREE.PointLight(0xffffff,100,30,2);neighbouring.position.copy(camera.position);scene.add(neighbouring);
    const render=renderer.render,panels=[];
    renderer.render=function(s,c){if(c===CODEX_VIEWER.camera)panels.push(NIGHT_LIGHTING.stats.selected.slice());return render.call(this,s,c);};
    try{
      CODEX_VIEWER.open(ids[0]);CODEX_VIEWER.compare(ids[1]);panels.length=0;CODEX_VIEWER.render();
      const scoped=panels.length===2&&panels.every((lights,i)=>lights.length===1&&lights[0]===fixtures[i].lamp.id);
      const beforeViewport=renderer.getViewport(new THREE.Vector4()).toArray(),beforeScissor=renderer.getScissor(new THREE.Vector4()).toArray(),beforeTest=renderer.getScissorTest(),update=NIGHT_LIGHTING.update;
      let restored=false;
      NIGHT_LIGHTING.update=function(c,...args){if(c===camera)throw Error('lighting-restoration-probe');return update(c,...args);};
      try{CODEX_VIEWER.render();}catch(e){restored=e.message==='lighting-restoration-probe'&&JSON.stringify(renderer.getViewport(new THREE.Vector4()).toArray())===JSON.stringify(beforeViewport)&&JSON.stringify(renderer.getScissor(new THREE.Vector4()).toArray())===JSON.stringify(beforeScissor)&&renderer.getScissorTest()===beforeTest;}
      finally{NIGHT_LIGHTING.update=update;}
      CODEX_VIEWER.close();return scoped&&restored;
    }finally{
      renderer.render=render;CODEX_VIEWER.close();for(const f of fixtures)scene.remove(f.g);scene.remove(neighbouring);
      for(const item of saved){interactables[item.id].roots=item.roots;if(!item.unlocked)codexUnlocked.delete(item.id);}NIGHT_LIGHTING.update(camera,true);
    }
   });
   assert.ok(inspector,'comparison light ownership and renderer state recovery after lighting exception');report.passed.push('comparison panel light ownership and exception recovery');
   await page.evaluate(()=>{player.pos.set(0,groundH(0,12)+1.62,12);SELECTED_WORLD.update(.4);});
   assert.match(await page.locator('#selectedWorldOpen').textContent(),/落とし扇/);
   await page.locator('#selectedWorldOpen').click();
   assert.ok(await page.getByRole('button',{name:'落ちた扇を調べ、拾う',exact:true}).isVisible());
   report.passed.push('nearby fan control names the prop and opens its investigation directly');
   await page.evaluate(()=>SELECTED_WORLD.close());
   await page.evaluate(()=>{camera.position.set(.82,.70,12.75);camera.lookAt(.08,.03,12);if(typeof NIGHT_LIGHTING!=='undefined')NIGHT_LIGHTING.update(camera,true);renderer.render(scene,camera);});
   const fanPng=await page.evaluate(()=>{renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png').split(',')[1];});
   fs.writeFileSync(path.join(out,'lost-fan.png'),Buffer.from(fanPng,'base64'));
  }
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.passed.push('no browser or shader exceptions');
  report.ok=true;fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:'ok',passed:report.passed},null,2));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
