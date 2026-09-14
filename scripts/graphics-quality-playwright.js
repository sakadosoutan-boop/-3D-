const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
  const page = await browser.newPage({viewport:{width:1280,height:800},hasTouch:false});
  const errors = [], passed = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if(message.type()==='error' && /THREE.WebGLProgram|VALIDATE_STATUS|ERROR: 0:/.test(message.text())) errors.push(message.text());
  });
  await page.addInitScript(() => {
    window.__SHINDEN_BENCH_PAUSE=true;
    window.SHINDEN_ONLINE_CONFIG={enabled:false};
    Object.defineProperty(navigator,'maxTouchPoints',{get:()=>0});
    Object.defineProperty(navigator,'webdriver',{get:()=>false});
    for(let p=window;p;p=Object.getPrototypeOf(p)){try{delete p.ontouchstart;}catch{}}
    localStorage.setItem('shinden3d-onboard-v1','1');
  });
  try {
    await page.goto(pathToFileURL(path.resolve('寝殿造り3D探訪_統合版.html')).href+'?adaptive=0&eco=off');
    await page.waitForFunction(()=>typeof GARDEN_POLISH!=='undefined' && !!GARDEN_POLISH);
    await page.evaluate(()=>{
      GFX.setPreset('high');GFX.setBloom('off');enterMode('walk');hideModeBrief(true);
      AUTO_TIME._paused=true;APP.labelMode=0;
      window.graphicsDraw=()=>{
        APP_FPSCAP=0;clock.running=true;clock.oldTime=performance.now()-16;
        window.__SHINDEN_BENCH_PAUSE=false;animate(performance.now());window.__SHINDEN_BENCH_PAUSE=true;
        camera.position.set(2,3.2,23);camera.lookAt(2,.02,34);cloudDome.position.copy(camera.position);
        scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);renderer.render(scene,camera);renderer.getContext().finish();
        return {active:GARDEN_POLISH.active,waves:GARDEN_POLISH.waterStrength,
          triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};
      };
    });
    await page.waitForFunction(()=>!!MAT.tatami.aoMap && !!MAT.tatami.normalMap,{timeout:25000});
    const high=await page.evaluate(()=>graphicsDraw());
    assert.equal(high.active,true);assert.equal(high.waves,1);
    const low=await page.evaluate(()=>{GFX.setPreset('low');return graphicsDraw();});
    assert.equal(low.active,false);assert.equal(low.waves,0);
    assert.ok(low.triangles<high.triangles,'lower quality must reduce foliage geometry');
    const restored=await page.evaluate(()=>{GFX.setPreset('high');return graphicsDraw();});
    assert.equal(restored.active,true);assert.equal(restored.triangles,high.triangles);
    passed.push('high and low quality compile and restore the expected detail');

    // Changing only the wave phase must change rendered pixels; eco mode freezes that effect.
    await page.evaluate(()=>{
      applySeason('summer');setTime('day');graphicsDraw();
      window.graphicsHash=t=>{
        GARDEN_POLISH.update(t);renderer.render(scene,camera);
        const gl=renderer.getContext(),pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
        gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let hash=0;for(let i=0;i<pixels.length;i+=37)hash=(Math.imul(hash,31)+pixels[i])|0;return hash;
      };
    });
    const animated=await page.evaluate(()=>[graphicsHash(12),graphicsHash(17)]);
    assert.notEqual(animated[0],animated[1],'water phase must affect the actual render');
    const eco=await page.evaluate(()=>{LOW_POWER.set(true,{persist:false,silent:true});return graphicsDraw();});
    assert.equal(eco.active,false);assert.equal(eco.waves,0);
    const frozen=await page.evaluate(()=>[graphicsHash(12),graphicsHash(17)]);
    assert.equal(frozen[0],frozen[1],'eco rendering must not animate the extra water effect');
    passed.push('water motion affects pixels and is disabled in eco mode');

    const cycles=[];
    for(let cycle=0;cycle<3;cycle++){
      for(const season of ['spring','summer','autumn','winter']){
        cycles.push(await page.evaluate(season=>{
          LOW_POWER.set(false,{persist:false,silent:true});GFX.setPreset('high');applySeason(season);graphicsDraw();
          LOW_POWER.set(true,{persist:false,silent:true});graphicsDraw();
          LOW_POWER.set(false,{persist:false,silent:true});return graphicsDraw();
        },season));
      }
    }
    for(let i=0;i<4;i++)for(const key of ['geometries','textures'])assert.equal(cycles[8+i][key],cycles[4+i][key]);
    passed.push('season and eco round trips reuse rendering resources');

    await page.evaluate(()=>{applySeason('summer');graphicsDraw();window.__SHINDEN_BENCH_PAUSE=false;});
    await page.waitForTimeout(150);
    await page.evaluate(()=>openPauseMenu());
    const time=await page.evaluate(()=>GARDEN_POLISH.waterTime);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(()=>GARDEN_POLISH.waterTime),time);
    await page.evaluate(()=>closePauseMenu());
    await page.waitForFunction(t=>GARDEN_POLISH.waterTime>t,time);
    await page.evaluate(()=>{window.__SHINDEN_BENCH_PAUSE=true;graphicsDraw();document.getElementById('toast').style.display='none';});
    passed.push('pause freezes the water clock and resume continues it');

    fs.mkdirSync('artifacts/review',{recursive:true});
    await page.screenshot({path:'artifacts/review/graphics-quality-pond.png'});
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({status:'ok',passed,errors},null,2));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
