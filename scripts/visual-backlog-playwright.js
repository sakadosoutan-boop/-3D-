const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],passed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/THREE.WebGLProgram|VALIDATE_STATUS|Computed radius is NaN/.test(m.text()))errors.push(m.text());});
  await page.addInitScript(()=>{
    window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};
    localStorage.setItem('shinden3d-onboard-v1','1');
    let seed=0x5eed1234;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  });
  try{
    await page.goto(pathToFileURL(path.resolve('寝殿造り3D探訪_統合版.html')).href+'?adaptive=0&eco=off');
    await page.waitForFunction(()=>!!window.THREE&&typeof VISUAL_FINISH!=='undefined'&&!!VISUAL_FINISH);
    await page.evaluate(()=>{
      enterMode('walk');hideModeBrief(true);AUTO_TIME._paused=true;GFX.setPreset('high');GFX.setBloom('off');
      window.backlogDraw=()=>{
        GARDEN_POLISH.update(12);VISUAL_FINISH.update(12);
        scene.updateMatrixWorld(true);camera.position.set(0,2.2,26);camera.lookAt(0,3,-2);camera.updateMatrixWorld(true);
        renderer.render(scene,camera);return renderer.info.render.calls;
      };
      window.backlogResources=()=>{
        const geos=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geos.add(o.geometry.id);
          for(const m of [].concat(o.material||[]))for(const value of Object.values(m))if(value?.isTexture)textures.add(value.id);});
        return {geos:[...geos].sort((a,b)=>a-b),textures:[...textures].sort((a,b)=>a-b)};
      };
      backlogDraw();
    });
    const placement=await page.evaluate(()=>{
      const matrix=new THREE.Matrix4(),point=new THREE.Vector3();let bounded=true,finite=true;
      VISUAL_FINISH.batches.filter(o=>o.isInstancedMesh).forEach(mesh=>{
        const geo=mesh.geometry,p=geo.attributes.position;
        for(let i=0;i<mesh.count;i++){
          mesh.getMatrixAt(i,matrix);finite&&=matrix.elements.every(Number.isFinite);
          for(let j=0;j<p.count;j++){
            point.fromBufferAttribute(p,j).applyMatrix4(matrix);
            bounded&&=point.distanceTo(geo.boundingSphere.center)<=geo.boundingSphere.radius+.0001;
          }
        }
      });
      return {bounded,finite,grass:VISUAL_FINISH.grassItems.length,rocks:VISUAL_FINISH.rockItems.length,
        clear:[...VISUAL_FINISH.grassItems,...VISUAL_FINISH.rockItems].every(item=>VISUAL_FINISH.placeClear(item.p[0],item.p[2])),
        needles:SEASONAL.miscTrees.some(root=>root.children.some(o=>o.userData.pineNeedles)),
        shoreline:(()=>{let count=0;scene.traverse(o=>{if(o.geometry?.userData.pondShore)count=o.geometry.attributes.position.count;});return count;})(),
        hipSeams:VISUAL_FINISH.batches.find(o=>o.userData.finishBatch==='roof-hip-seams')?.count||0};
    });
    assert.ok(placement.bounded&&placement.finite&&placement.clear&&placement.needles&&placement.grass>80&&placement.rocks>8&&placement.shoreline>=480&&placement.hipSeams>50,JSON.stringify(placement));
    passed.push('added garden detail has finite bounds and leaves the walking, bridge and carriage routes clear');

    // Test rendered output: snow must brighten upward faces while retaining vertical rock material.
    const snowFaces=await page.evaluate(()=>{
      const testScene=new THREE.Scene();testScene.add(new THREE.AmbientLight(0xffffff,1));
      const geometry=new THREE.BoxGeometry(2,2,2);
      geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(1),3));
      const box=new THREE.Mesh(geometry,MAT.stone);testScene.add(box);
      const cam=new THREE.OrthographicCamera(-1.5,1.5,1.5,-1.5,.1,20);
      const mean=(season,top)=>{
        applySeason(season);cam.position.set(0,top?5:0,top?0:5);cam.up.set(0,top?0:1,top?-1:0);cam.lookAt(0,0,0);
        renderer.render(testScene,cam);const gl=renderer.getContext(),pixels=new Uint8Array(24*24*4);
        gl.readPixels(Math.floor(gl.drawingBufferWidth/2)-12,Math.floor(gl.drawingBufferHeight/2)-12,24,24,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=(pixels[i]+pixels[i+1]+pixels[i+2])/3;return sum/(24*24);
      };
      const top=mean('winter',true)-mean('summer',true),side=mean('winter',false)-mean('summer',false);
      box.geometry.dispose();applySeason('spring');backlogDraw();return {top,side};
    });
    assert.ok(snowFaces.top>25&&Math.abs(snowFaces.side)<4,JSON.stringify(snowFaces));
    passed.push('rendered snow brightens upward rock faces and leaves vertical faces unchanged');

    const seasons=await page.evaluate(()=>{
      const mesh=SEASONAL.maples[0].userData.foliage.find(o=>o.isInstancedMesh),original=mesh.instanceMatrix.array.slice();
      applySeason('winter');backlogDraw();const sparse=mesh.instanceMatrix.array.some((v,i)=>v!==original[i]);
      const snow=VISUAL_FINISH.snowStrength===1&&VISUAL_FINISH.winterBatches.every(m=>m.visible);
      applySeason('summer');backlogDraw();const restored=mesh.instanceMatrix.array.every((v,i)=>v===original[i]);
      return {sparse,snow,restored,noSnow:VISUAL_FINISH.snowStrength===0&&VISUAL_FINISH.winterBatches.every(m=>!m.visible)};
    });
    assert.ok(Object.values(seasons).every(Boolean),JSON.stringify(seasons));passed.push('deciduous foliage and settled snow restore correctly through season changes');

    const lights=await page.evaluate(()=>{
      setTime('night');gimmicks.lamps.forEach(l=>l.lit=false);backlogDraw();
      const mesh=VISUAL_FINISH.lampBatches[0],matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);const unlit=matrix.elements[0]===0;
      gimmicks.lamps[0].lit=true;backlogDraw();mesh.getMatrixAt(0,matrix);const lit=Math.abs(matrix.elements[0])>1;
      mesh.getMatrixAt(1,matrix);const otherUnlit=matrix.elements[0]===0;
      gimmicks.lamps[0].lit=false;setTime('day');backlogDraw();return {unlit,lit,otherUnlit,day:!mesh.visible};
    });
    assert.ok(Object.values(lights).every(Boolean),JSON.stringify(lights));passed.push('floor light spill follows each lamp and disappears during daylight');

    const quality=await page.evaluate(()=>{
      GFX.setPreset('high');backlogDraw();const high=VISUAL_FINISH.active&&VISUAL_FINISH.batches.some(m=>m.visible);
      LOW_POWER.set(true,{persist:false,silent:true});backlogDraw();const eco=!VISUAL_FINISH.active&&VISUAL_FINISH.batches.every(m=>!m.visible);
      LOW_POWER.set(false,{persist:false,silent:true});GFX.setPreset('high');backlogDraw();return {high,eco,restored:VISUAL_FINISH.active};
    });
    assert.ok(Object.values(quality).every(Boolean),JSON.stringify(quality));passed.push('eco hides added detail and high quality restores it');

    const resources=[];
    for(let cycle=0;cycle<2;cycle++)for(const season of ['spring','summer','autumn','winter']){
      resources.push(await page.evaluate(season=>{applySeason(season);for(const time of ['dawn','day','dusk','night']){setTime(time);backlogDraw();}
        GFX.setPreset('low');backlogDraw();GFX.setPreset('high');backlogDraw();return backlogResources();},season));
    }
    for(let i=0;i<4;i++)assert.deepEqual(resources[i+4],resources[i]);passed.push('four seasons and four times of day reuse scene geometry and textures');

    const cabin=await page.evaluate(()=>{
      gisshaCarryAnimate(.15,3);const drive=GISSHA_YARD.cart.userData.drive;
      const motion=Math.abs(drive.cabin.position.y)>0&&Math.abs(drive.cabin.rotation.z)>0;
      const wheelGround=drive.wheels.every(w=>Math.abs(w.position.y-1.05)<.001);
      gisshaCarryAnimate(0,0);return {motion,wheelGround,reset:drive.cabin.position.y===0&&drive.cabin.rotation.z===0};
    });
    assert.ok(Object.values(cabin).every(Boolean),JSON.stringify(cabin));passed.push('carriage cabin sways without raising the wheel axle and rests when stopped');

    assert.deepEqual(errors,[]);
    const report={status:'ok',passed,placement,snowFaces,seasons,lights,quality,cabin,errors};
    fs.mkdirSync('artifacts/review',{recursive:true});fs.writeFileSync('artifacts/review/visual-backlog-checks.json',JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
