/* Parent runs after the app build; exercises actual Claude assets, input, visits and replay. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/kenko-hermitage');
(async()=>{
  fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'}),errors=[];
  try{
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|VALIDATE_STATUS|ERROR: 0:/.test(m.text()))errors.push(m.text());});
    await page.addInitScript(()=>{window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};localStorage.setItem('shinden3d-onboard-v1','1');});
    const url=pathToFileURL(path.join(root,'寝殿造り3D探訪_統合版.html')).href;
    await page.goto(url+'?adaptive=0&eco=off',{waitUntil:'load',timeout:180000});
    assert(await page.evaluate(()=>typeof KENKO_HERMITAGE!=='undefined'&&!!SAIGEN_TSUREZURE.createHermitage),'Build the hermitage sources and frame hook first');
    await page.evaluate(()=>{enterMode('walk');hideModeBrief(true);GFX.setPreset('high');GFX.setBloom('off');AUTO_TIME._paused=true;});
    const setup=await page.evaluate(async()=>{
      window.__kenkoRenderer=renderer;window.__kenkoSnapshot={position:player.pos.toArray(),yaw:player.yaw,pitch:player.pitch,view:APP.view,near:camera.near,far:camera.far,fov:camera.fov,
        world:world.visible,il:interiorLight.position.toArray(),auto:AUTO_TIME._paused,bg:!!SFX._backgroundPaused,
        floors:floorZones.length,solids:WALK_SOLIDS.length,background:scene.background,environment:scene.environment,
        celestial:[cloudDome,sunMesh,moonMesh,moonHalo,moonPhaseShadow].map(o=>o.visible)};
      const started=await KENKO_HERMITAGE.open();hideModeBrief(true);document.getElementById('loadingScreen').classList.remove('show');
      const a=KENKO_HERMITAGE.assets;KENKO_HERMITAGE.frame(.016,12);
      return {started,active:KENKO_HERMITAGE.active,ready:!KENKO_HERMITAGE.loading,masked:!world.visible,hut:!!a.hut.userData.dims,figure:!!a.kenko.read.userData.head,
        sameRenderer:renderer===window.__kenkoRenderer,zones:Object.keys(SAIGEN_TSUREZURE.S.zones),jobs:Object.keys(SAIGEN_TSUREZURE.S.done),shots:SAIGEN_TSUREZURE.S.shots.length,
        floors:floorZones.length,solids:WALK_SOLIDS.length};
    });
    assert(setup.started&&setup.active&&setup.ready&&setup.masked&&setup.hut&&setup.figure&&setup.sameRenderer);assert.deepEqual(setup.zones,['an']);assert.equal(setup.shots,0);assert.deepEqual(setup.jobs,['sky','an','kenko-read']);
    const start=await page.evaluate(()=>player.pos.z);await page.keyboard.down('w');
    const walked=await page.evaluate(()=>{for(let i=0;i<110;i++)KENKO_HERMITAGE.frame(1/60,12+i/60);return {position:player.pos.toArray(),floor:KENKO_HERMITAGE.heightAt(player.pos.x,player.pos.z)};});await page.keyboard.up('w');
    assert(walked.position[2]<start-2.5);assert(Math.abs(walked.position[1]-walked.floor-1.62)<1e-6);assert(walked.floor>.5,'Real keyboard walk must reach the raised veranda through the step');
    await page.click('#kenkoVisitGuide');const freeze=await page.evaluate(()=>{const p=player.pos.toArray();KENKO_HERMITAGE.frame(.08,15);return JSON.stringify(p)===JSON.stringify(player.pos.toArray())&&document.querySelector('#kenkoVisitNoteBody a').href.includes('turedure007.htm');});assert(freeze);await page.click('#kenkoVisitNoteClose');
    await page.click('#kenkoVisitNight');const night=await page.evaluate(()=>{KENKO_HERMITAGE.frame(.016,16);return {lit:SAIGEN_TSUREZURE.S.lampCfg.on,intensity:interiorLight.intensity,finite:[...camera.position.toArray(),renderer.toneMappingExposure].every(Number.isFinite)};});assert(night.lit&&night.intensity>0&&night.finite);
    await page.screenshot({path:path.join(out,'interior-night.png')});
    const restore=await page.evaluate(()=>{
      const owned=[],materials=new Set(),textures=new Set();KENKO_HERMITAGE.stage.traverse(o=>{
        if(o.isMesh&&o.geometry)owned.push(o.geometry);
        for(const m of [].concat(o.material||[],o.customDepthMaterial||[])){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}
      });
      const disposed=new Set(),disposedMaterials=new Set(),disposedTextures=new Set();
      for(const g of new Set(owned))g.addEventListener('dispose',()=>disposed.add(g));
      for(const m of materials)m.addEventListener('dispose',()=>disposedMaterials.add(m));for(const t of textures)t.addEventListener('dispose',()=>disposedTextures.add(t));
      KENKO_HERMITAGE.leave();const s=window.__kenkoSnapshot;
      return {active:KENKO_HERMITAGE.active,stage:scene.children.some(o=>o.name==='kenko-hermitage-visit'),hook:window.SAIGEN_ENV_HOOK===null,world:world.visible===s.world,
        position:JSON.stringify(player.pos.toArray())===JSON.stringify(s.position),camera:camera.near===s.near&&camera.far===s.far&&camera.fov===s.fov,
        lighting:JSON.stringify(interiorLight.position.toArray())===JSON.stringify(s.il),auto:AUTO_TIME._paused===s.auto,bg:!!SFX._backgroundPaused===s.bg,
        celestial:JSON.stringify([cloudDome,sunMesh,moonMesh,moonHalo,moonPhaseShadow].map(o=>o.visible))===JSON.stringify(s.celestial),
        floors:floorZones.length===s.floors&&WALK_SOLIDS.length===s.solids,ownedReleased:disposed.size===new Set(owned).size,
        materialsReleased:disposedMaterials.size===materials.size,texturesReleased:disposedTextures.size===textures.size,
        ownedCounts:{geometries:new Set(owned).size,materials:materials.size,textures:textures.size},
        background:scene.background===s.background&&scene.environment===s.environment,hud:document.getElementById('kenkoVisitHud').hidden,loops:Object.keys(SAIGEN_TSUREZURE.S.loops).length};
    });
    assert(!restore.active&&!restore.stage&&restore.hook&&restore.world&&restore.position&&restore.camera&&restore.lighting&&restore.auto&&restore.bg&&restore.celestial&&restore.floors&&restore.ownedReleased&&restore.materialsReleased&&restore.texturesReleased&&restore.background&&restore.hud&&restore.loops===0,JSON.stringify(restore));
    const modes=await page.evaluate(async()=>{
      const results=[];
      for(const mode of ['title','quiz','walk']){await KENKO_HERMITAGE.open();enterMode(mode);results.push(!KENKO_HERMITAGE.active&&!SAIGEN_TSUREZURE.S.active&&!scene.children.some(o=>o.name==='kenko-hermitage-visit'));}
      enterMode('walk');const pending=KENKO_HERMITAGE.open();KENKO_HERMITAGE.leave();results.push(await pending===false&&!KENKO_HERMITAGE.active);
      await KENKO_HERMITAGE.open();document.getElementById('kenkoVisitReplay').click();
      results.push(APP.mode==='saigen'&&APP.saigen.scene.id==='tsurezure_adashino'&&!KENKO_HERMITAGE.active);
      const count=APP.saigen.scene.beats.length,shots=SAIGEN_TSUREZURE.BEAT_SHOTS.length;
      const T=SAIGEN_TSUREZURE.S;T.syncBuild=true;let finite=true,allShots=true;
      try{for(let i=0;i<count;i++){
        APP.saigen.i=i;renderSaigenBeat();const total=T.shots.reduce((n,s)=>n+(s.dur||8),0)+1;allShots&&=T.shots.length>0;
        for(let t=0;t<total;t+=.5){SAIGEN_STAGE.userData.props.update(.5,t);window.SAIGEN_ENV_HOOK(.5);}
        renderer.render(scene,camera);finite&&=[...camera.position.toArray(),camera.fov,sun.intensity,renderer.toneMappingExposure].every(Number.isFinite);
      }}finally{T.syncBuild=false;}
      enterMode('walk');results.push(count===13&&shots===13&&finite&&allShots&&!SAIGEN_TSUREZURE.S.active);
      return results;
    });assert(modes.every(Boolean));
    await page.goto(url+'?visit=kenko&map=kamakura&adaptive=0&eco=off',{waitUntil:'load',timeout:180000});
    await page.waitForFunction(()=>typeof KENKO_HERMITAGE!=='undefined'&&KENKO_HERMITAGE.active&&!KENKO_HERMITAGE.loading,null,{timeout:180000});
    await page.waitForTimeout(5100);
    const delayed=await page.evaluate(()=>{KENKO_HERMITAGE.frame(.016,20);return KENKO_HERMITAGE.stage.visible&&!world.visible&&!window.KAMAKURA_WORLD.world.visible;});assert(delayed,'Kamakura delayed foreign-world masking must preserve the visit stage');
    await page.setViewportSize({width:390,height:844});
    const mobile=await page.evaluate(()=>{
      player.pos.set(.55,KENKO_HERMITAGE.heightAt(.55,5)+1.62,5);player.yaw=0;player.pitch=-.12;KENKO_HERMITAGE.frame(.016,21);
      const hud=document.getElementById('kenkoVisitHud').getBoundingClientRect(),buttons=[...document.querySelectorAll('#kenkoVisitHud button')].map(b=>b.getBoundingClientRect());
      return hud.left>=0&&hud.right<=innerWidth&&buttons.every(r=>r.width>25&&r.height>=36&&r.left>=0&&r.right<=innerWidth)&&document.documentElement.scrollWidth<=innerWidth&&
        !document.getElementById('modeBrief').classList.contains('show')&&!gameplayInputBlocked();
    });assert(mobile,'Mobile HUD must remain readable and inside the viewport');await page.screenshot({path:path.join(out,'mobile-yard.png')});
    await page.click('#kenkoVisitGuide');await page.screenshot({path:path.join(out,'mobile-notes.png')});await page.click('#kenkoVisitNoteClose');
    const direct=await page.evaluate(()=>{const map=APP.map,visible=window.KAMAKURA_WORLD?.world?.visible;KENKO_HERMITAGE.leave();return map==='kamakura'&&visible===false&&!KENKO_HERMITAGE.active&&window.KAMAKURA_WORLD?.world?.visible===true;});assert(direct,'URL visit must restore the original Kamakura estate');
    await page.evaluate(()=>KENKO_HERMITAGE.open());
    await Promise.all([page.waitForURL(/replay=tsurezure7/,{timeout:180000}),page.click('#kenkoVisitReplay')]);
    await page.waitForFunction(()=>APP.mode==='saigen'&&APP.saigen?.scene.id==='tsurezure_adashino',null,{timeout:180000});await page.waitForTimeout(5100);
    const routed=await page.evaluate(()=>{
      window.__SHINDEN_BENCH_PAUSE=false;animate(performance.now());window.__SHINDEN_BENCH_PAUSE=true;
      const stage=window.SAIGEN_STAGE,finite=[...camera.position.toArray(),camera.fov,sun.intensity].every(Number.isFinite);
      return APP.map!=='kamakura'&&APP.mode==='saigen'&&!!stage?.visible&&APP.saigen.scene.beats.length===13&&finite&&document.getElementById('title').classList.contains('hide')&&
        !document.getElementById('modeBrief').classList.contains('show')&&getComputedStyle(document.getElementById('sgPicker')).display==='none';
    });assert(routed,'Kamakura replay must route to the Heian replay without stale title/brief overlays');await page.screenshot({path:path.join(out,'mobile-routed-replay.png')});
    assert.deepEqual(errors,[]);const report={setup,walked,freeze,night,restore,modes,direct,delayed,mobile,routed,errors};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
