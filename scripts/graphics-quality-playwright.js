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
    let seed=0x5eed1234;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    Object.defineProperty(navigator,'maxTouchPoints',{get:()=>0});
    Object.defineProperty(navigator,'webdriver',{get:()=>false});
    for(let p=window;p;p=Object.getPrototypeOf(p)){try{delete p.ontouchstart;}catch{}}
    localStorage.setItem('shinden3d-onboard-v1','1');
  });
  try {
    await page.goto(pathToFileURL(path.resolve('寝殿造り3D探訪_統合版.html')).href+'?adaptive=0&eco=off');
    await page.waitForFunction(()=>typeof GARDEN_POLISH!=='undefined' && !!GARDEN_POLISH);
    const surfaces=await page.evaluate(()=>{
      const plain=box(.42,3.8,.36,MAT.plaster).geometry;
      const original=Array.from(plain.attributes.uv.array);
      const wood=box(.42,3.8,.36,MAT.wood).geometry;
      const again=box(.42,3.8,.36,MAT.woodDark).geometry;
      const floor=box(8,.2,4,MAT.floor).geometry;
      const longFloor=box(16,.2,8,MAT.floor).geometry;
      const side=[];for(let i=0;i<wood.attributes.position.count;i++)if(wood.attributes.normal.getX(i)>.5)side.push(i);
      const atHeight=new Map();let vertical=true;
      for(const i of side){const y=wood.attributes.position.getY(i),u=wood.attributes.uv.getX(i);if(atHeight.has(y)&&atHeight.get(y)!==u)vertical=false;atHeight.set(y,u);}
      const maxV=g=>Math.max(...Array.from({length:g.attributes.uv.count},(_,i)=>g.attributes.normal.getY(i)>.5?g.attributes.uv.getY(i):0));
      return {
        isolated:plain!==wood && original.every((v,i)=>v===plain.attributes.uv.array[i]),
        shared:wood===again,
        vertical:vertical&&new Set(atHeight.values()).size===2,
        consistentPlankWidth:Math.abs(maxV(longFloor)/maxV(floor)-2)<.00001,
        aoAligned:floor.attributes.uv2===floor.attributes.uv
      };
    });
    assert.ok(Object.values(surfaces).every(Boolean),JSON.stringify(surfaces));
    passed.push('wood follows the post, floor scale is consistent, and shared UVs preserve other materials');
    const roofStructure=await page.evaluate(()=>{
      const roofs=[];scene.traverse(o=>{if(o.geometry?.userData.roofProfile)roofs.push(o);});
      const valid=roofs.every(mesh=>{
        const geo=mesh.geometry,p=geo.attributes.position,n=geo.attributes.normal,profile=geo.userData.roofProfile;
        if(![...p.array,...n.array,...geo.attributes.uv.array].every(Number.isFinite))return false;
        if(geo.boundingBox.min.y < -profile.thickness-.0001||Math.abs(geo.boundingBox.max.y-profile.h)>.0001)return false;
        const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*10000)).join(',');
        const edges=new Map();
        for(let i=0;i<geo.index.count;i+=3){
          const a=geo.index.getX(i),b=geo.index.getX(i+1),c=geo.index.getX(i+2),keys=[key(a),key(b),key(c)];
          if(new Set(keys).size!==3)return false;
          for(let j=0;j<3;j++){const pair=[keys[j],keys[(j+1)%3]].sort().join('/');edges.set(pair,(edges.get(pair)||0)+1);}
        }
        return [...edges.values()].every(count=>count===2)&&geo.attributes.uv===geo.attributes.uv2;
      });
      const identities=roofs.map(m=>m.geometry.id);applySeason('winter');const snow=MAT.roof.map===null;
      applySeason('spring');return {count:roofs.length,valid,snow,restored:MAT.roof.map===TEX.roof&&roofs.every((m,i)=>m.geometry.id===identities[i])};
    });
    assert.ok(roofStructure.count>10&&roofStructure.valid&&roofStructure.snow&&roofStructure.restored,JSON.stringify(roofStructure));
    passed.push('curved roofs form closed finite shells, keep ridge height, and reuse geometry through snow changes');
    const fittings=await page.evaluate(()=>{
      const cloths=[],lattices=[];
      scene.traverse(o=>{if(o.geometry?.userData.drapedCloth)cloths.push(o);if(o.geometry?.userData.latticePitch)lattices.push(o);});
      const finiteAndBounded=cloths.every(o=>{
        const g=o.geometry,p=g.attributes.position,b=g.boundingBox;
        return [...p.array,...g.attributes.normal.array].every(Number.isFinite)&&b.min.z>=-.056&&b.max.z<=.056&&b.max.z-b.min.z>.03;
      });
      const pitch=lattices.every(o=>{
        const g=o.geometry,p=g.attributes.position,uv=g.attributes.uv;
        return Math.abs((p.getX(1)-p.getX(0))/(uv.getX(1)-uv.getX(0))-1.92)<1e-5
          &&Math.abs((p.getY(0)-p.getY(2))/(uv.getY(0)-uv.getY(2))-1.44)<1e-5;
      });
      const geo=cloths.find(o=>o.material===MAT.kichou).geometry;
      const shared=geo===ARCH_DETAIL.cloth(1.86,1.55);
      scene.updateMatrixWorld(true);
      const mesh=rayTargets.find(o=>o.userData.iid==='kichou'&&o.geometry?.userData.drapedCloth);
      let discoverable=false;
      if(mesh){const center=mesh.localToWorld(new THREE.Vector3(0,0,0)),normal=new THREE.Vector3(0,0,1).transformDirection(mesh.matrixWorld);
        const ray=new THREE.Raycaster(center.clone().addScaledVector(normal,.3),normal.negate());
        discoverable=ray.intersectObject(mesh).length>0;
      }
      return {count:cloths.length,latticeCount:lattices.length,finiteAndBounded,pitch,shared,discoverable};
    });
    assert.ok(fittings.count>5&&fittings.latticeCount>10&&fittings.finiteAndBounded&&fittings.pitch&&fittings.shared&&fittings.discoverable,JSON.stringify(fittings));
    passed.push('curtain folds have finite bounded geometry, retain discovery, share meshes, and lattice spacing is consistent');
    const treeStructure=await page.evaluate(()=>{
      const trees=[];scene.traverse(o=>{if(o.geometry?.userData.connectedTree)trees.push(o);});
      const valid=trees.every(mesh=>{
        const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,b=g.boundingBox;
        const con=mesh.userData.crownConnections,targets=mesh.userData.crownTargets;
        const reaches=targets.every(t=>con.some(c=>c.end.every((v,i)=>Math.abs(v-t[i])<1e-6)));
        const finite=[...p.array,...n.array,...g.attributes.uv.array].every(Number.isFinite);
        const indexed=Array.from(g.index.array).every(i=>i<p.count);
        return reaches&&finite&&indexed&&b.min.y<0&&b.min.y>-.12&&mesh.material===MAT.trunk;
      });
      const identity=trees.map(t=>t.geometry.id);
      for(const season of ['summer','autumn','winter','spring'])applySeason(season);
      return {count:trees.length,valid,reused:trees.every((t,i)=>t.geometry.id===identity[i])};
    });
    assert.ok(treeStructure.count>5&&treeStructure.valid&&treeStructure.reused,JSON.stringify(treeStructure));
    passed.push('tree branches reach foliage centers, root tips meet the ground, and seasons reuse the same finite geometry');
    const botany=await page.evaluate(()=>{
      const matrix=new THREE.Matrix4(),point=new THREE.Vector3();let bounded=true,batches=0;
      scene.traverse(mesh=>{
        if(!mesh.userData.botanicalBatch)return;batches++;
        const geo=mesh.geometry,positions=geo.attributes.position,sphere=geo.boundingSphere;
        for(let i=0;i<mesh.count;i++){
          mesh.getMatrixAt(i,matrix);
          for(let j=0;j<positions.count;j++){
            point.fromBufferAttribute(positions,j).applyMatrix4(matrix);
            if(point.distanceTo(sphere.center)>sphere.radius+1e-5)bounded=false;
          }
        }
      });
      applySeason('summer');scene.updateMatrixWorld(true);
      const discoverable=['kakitsubata','nadesiko'].every(id=>{
        const mesh=rayTargets.find(m=>m.userData.iid===id&&m.userData.botanicalBatch&&m.material===GARDEN_BOTANY.bloom);
        if(!mesh)return false;
        mesh.getMatrixAt(0,matrix);matrix.premultiply(mesh.matrixWorld);
        const geo=mesh.geometry,offset=geo.index.count/2;
        const vertices=[0,1,2].map(i=>new THREE.Vector3().fromBufferAttribute(geo.attributes.position,geo.index.getX(offset+i)).applyMatrix4(matrix));
        const center=vertices[0].clone().add(vertices[1]).add(vertices[2]).multiplyScalar(1/3);
        const normal=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();
        const ray=new THREE.Raycaster(center.clone().addScaledVector(normal,.2),normal.negate());
        return ray.intersectObject(mesh).some(hit=>hit.object.userData.iid===id&&hit.instanceId===0);
      });
      const seasons={spring:[true,false,false],summer:[true,true,true],autumn:[false,true,false],winter:[false,false,false]};
      const seasonal=Object.entries(seasons).every(([season,expected])=>{
        applySeason(season);
        return [SEASONAL.kakitsubata.every(g=>g.visible),SEASONAL.nadesiko.every(g=>g.visible),SEASONAL.hasu.visible].every((v,i)=>v===expected[i]);
      });
      applySeason('spring');
      return {bounded,batches,discoverable,seasonal};
    });
    assert.ok(botany.batches>0&&botany.bounded&&botany.discoverable&&botany.seasonal,JSON.stringify(botany));
    passed.push('flower batches stay within culling bounds, can be discovered, and follow the seasons');
    await page.evaluate(()=>{
      GFX.setPreset('high');GFX.setBloom('off');enterMode('walk');hideModeBrief(true);
      AUTO_TIME._paused=true;APP.labelMode=0;
      window.graphicsResources=()=>{
        const geometries=new Set(),textures=new Set();
        scene.traverse(o=>{
          if(o.geometry)geometries.add(o.geometry.id);
          for(const mat of [].concat(o.material||[]))for(const value of Object.values(mat))if(value&&value.isTexture)textures.add(value.id);
        });
        FOLIAGE_DETAIL.forEach((detail,high)=>{geometries.add(high.id);if(detail.low)geometries.add(detail.low.id);});
        return {geometries:[...geometries].sort((a,b)=>a-b),textures:[...textures].sort((a,b)=>a-b)};
      };
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

    const waterContinuity=await page.evaluate(()=>{
      const testScene=new THREE.Scene(),testCamera=new THREE.OrthographicCamera(-4,4,4,-4,.1,20);
      testCamera.position.set(0,10,0);testCamera.up.set(0,0,-1);testCamera.lookAt(0,0,0);
      testScene.add(new THREE.AmbientLight(0xffffff,1));
      const shape=new THREE.Shape();shape.moveTo(-4,-4);shape.lineTo(4,-4);shape.lineTo(4,4);shape.lineTo(-4,4);shape.closePath();
      const plane=new THREE.Mesh(new THREE.PlaneGeometry(8,8),MAT.water),patch=new THREE.Mesh(new THREE.ShapeGeometry(shape),MAT.water);
      plane.rotation.x=patch.rotation.x=-Math.PI/2;testScene.add(plane,patch);
      const read=()=>{
        renderer.render(testScene,testCamera);const gl=renderer.getContext(),pixels=new Uint8Array(32*32*4);
        gl.readPixels(Math.floor(gl.drawingBufferWidth/2)-16,Math.floor(gl.drawingBufferHeight/2)-16,32,32,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;
      };
      patch.visible=false;const a=read();plane.visible=false;patch.visible=true;const b=read();plane.visible=true;const both=read();
      const maxDiff=p=>Math.max(...a.map((value,i)=>Math.abs(value-p[i])));
      const result={uvDifference:maxDiff(b),overlapDifference:maxDiff(both),rendered:a.some((v,i)=>i%4!==3&&v>0),ripplesAboveWater:waterBirds.filter(b=>b.kind==='koi').every(b=>.11+b.g.userData.ripple.position.y>.06)};
      plane.geometry.dispose();patch.geometry.dispose();graphicsDraw();return result;
    });
    assert.ok(waterContinuity.rendered&&waterContinuity.uvDifference<=2&&waterContinuity.overlapDifference<=2&&waterContinuity.ripplesAboveWater,JSON.stringify(waterContinuity));
    passed.push('water patches share their texture scale and overlapping surfaces keep the same color');

    const cycles=[];
    for(let cycle=0;cycle<3;cycle++){
      for(const season of ['spring','summer','autumn','winter']){
        cycles.push(await page.evaluate(season=>{
          LOW_POWER.set(false,{persist:false,silent:true});GFX.setPreset('high');applySeason(season);graphicsDraw();
          LOW_POWER.set(true,{persist:false,silent:true});graphicsDraw();
          LOW_POWER.set(false,{persist:false,silent:true});graphicsDraw();return graphicsResources();
        },season));
      }
    }
    // GPU upload counts can grow when an existing animated prop first becomes visible.
    // Compare actual resource identities, including the cached low-detail foliage.
    for(let i=0;i<4;i++)assert.deepEqual(cycles[8+i],cycles[4+i]);
    passed.push('season and eco round trips reuse scene geometries and textures');

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
