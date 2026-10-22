/* Run after the parent build. Uses actual game trees/mode/season/quality controls. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/foliage-refinement');
(async()=>{
  fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'}),errors=[];
  try{
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|VALIDATE_STATUS|ERROR: 0:/.test(m.text()))errors.push(m.text());});
    await page.addInitScript(()=>{window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};localStorage.setItem('shinden3d-onboard-v1','1');});
    await page.goto(pathToFileURL(path.join(root,'寝殿造り3D探訪_統合版.html')).href+'?adaptive=0&eco=off',{waitUntil:'load'});
    assert(await page.evaluate(()=>typeof ESTATE_FOLIAGE!=='undefined'&&!!VISUAL_EXPERIENCE.foliageSprays?.length),'Build the updated visual-experience source before this check');
    await page.evaluate(()=>{enterMode('walk');hideModeBrief(true);AUTO_TIME._paused=true;APP_FPSCAP=0;GFX.setPreset('high');GFX.setBloom('off');LOW_POWER.set(false,{persist:false,silent:true});});
    const geometry=await page.evaluate(()=>{
      const result={sharing:new Set(),branches:true,single:true,finite:true,leaves:[]},matrix=new THREE.Matrix4(),p=new THREE.Vector3();
      for(const h of VISUAL_EXPERIENCE.foliageSprays){
        result.sharing.add(h.leaves.geometry.id);result.sharing.add(h.twigs.geometry.id);result.single&&=!!h.leaves.geometry.userData.singleLeaf;
        result.leaves.push({kind:h.maple?'maple':'camellia',capacity:h.capacity,leaves:h.leaves.userData.leafCount});
        for(let i=0;i<h.capacity;i++){h.leaves.getMatrixAt(i,matrix);p.set(0,0,0).applyMatrix4(matrix);result.branches&&=p.distanceTo(new THREE.Vector3(...h.tips[i%h.tips.length].pos))<1e-6;}
        result.finite&&=[...h.leaves.instanceMatrix.array,...h.twigs.instanceMatrix.array].every(Number.isFinite);
      }return{...result,sharing:result.sharing.size};
    });
    assert(geometry.branches&&geometry.single&&geometry.finite&&geometry.sharing===4);
    async function closeView(maple,season,name){
      const report=await page.evaluate(({maple,season})=>{
        applySeason(season);GFX.setPreset('high');GARDEN_POLISH.update(1);VISUAL_FINISH.update(1);
        const h=VISUAL_EXPERIENCE.foliageSprays.find(h=>h.maple===maple),target=new THREE.Vector3();
        for(const tip of h.tips)target.add(new THREE.Vector3(...tip.pos));target.multiplyScalar(1/h.tips.length);h.root.localToWorld(target);
        camera.position.copy(target).add(new THREE.Vector3(.9,.2,1.5));camera.fov=45;camera.updateProjectionMatrix();camera.lookAt(target);
        VISUAL_EXPERIENCE.update(1.7);renderer.render(scene,camera);
        const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
        h.leaves.material.onBeforeCompile(shader);const wood={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};h.twigs.material.onBeforeCompile(wood);
        return{lod:h.lod,count:h.leaves.count,visible:h.leaves.visible,twigs:h.twigs.visible,wind:VISUAL_EXPERIENCE.wind.strength.value,
          sharedWind:shader.uniforms.uEstateWindTime===wood.uniforms.uEstateWindTime&&shader.uniforms.uEstateWindStrength===wood.uniforms.uEstateWindStrength,
          flutterHinge:shader.vertexShader.includes('transformed=estateLeafHinge+estateBlade'),snowDoesNotDisplace:!shader.vertexShader.includes('transformed+=normal*.035*uEstateSnow')};
      },{maple,season});
      const png=await page.evaluate(()=>{renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png').split(',')[1];});
      fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(png,'base64'));return report;
    }
    const maple=await closeView(true,'summer','maple-connected-close'),camellia=await closeView(false,'winter','camellia-winter-connected-close');
    for(const check of [maple,camellia])assert(check.lod==='near'&&check.count===32&&check.visible&&check.twigs&&check.wind===1&&check.sharedWind&&check.flutterHinge&&check.snowDoesNotDisplace);
    const lifecycle=await page.evaluate(()=>{
      const h=VISUAL_EXPERIENCE.foliageSprays.find(h=>h.maple),base=new THREE.Vector3();h.root.getWorldPosition(base);
      const ownIds=()=>VISUAL_EXPERIENCE.foliageSprays.map(h=>[h.leaves.geometry.id,h.twigs.geometry.id,h.leaves.material.id,h.twigs.material.id]).flat().join(','),ids=ownIds();
      applySeason('winter');const flower=SEASONAL.tsubakiFlowers,flowerIds=[flower.geometry.id,flower.material.id],flowerMatrices=Array.from(flower.instanceMatrix.array);
      let winter=true,evergreen=true,finite=true;
      for(let repeat=0;repeat<20;repeat++)for(const season of ['spring','summer','autumn','winter']){
        applySeason(season);for(const distance of [4,25,60]){
          camera.position.copy(base).add(new THREE.Vector3(0,2,distance));GARDEN_POLISH.update(repeat);VISUAL_FINISH.update(repeat);VISUAL_EXPERIENCE.update(repeat);
          renderer.render(scene,camera);
          for(const spray of VISUAL_EXPERIENCE.foliageSprays){
            finite&&=[...spray.leaves.instanceMatrix.array,...spray.twigs.instanceMatrix.array].every(Number.isFinite);
            if(season==='winter'&&spray.maple)winter&&=!spray.leaves.visible&&(spray.root.userData.foliage||[]).filter(m=>!m.userData.estateLeaves).every(m=>!m.visible);
          }
        }
      }
      camera.position.copy(base).add(new THREE.Vector3(0,2,4));applySeason('summer');VISUAL_EXPERIENCE.update(40);const near=h.leaves.count;
      camera.position.copy(base).add(new THREE.Vector3(0,2,25));VISUAL_EXPERIENCE.update(41);const middle=h.leaves.count;
      camera.position.copy(base).add(new THREE.Vector3(0,2,60));VISUAL_EXPERIENCE.update(42);const far=h.leaves.count;
      camera.position.copy(base).add(new THREE.Vector3(0,2,4));LOW_POWER.set(true,{persist:false,silent:true});GARDEN_POLISH.update(43);VISUAL_EXPERIENCE.update(43);const eco=h.leaves.count,ecoWind=VISUAL_EXPERIENCE.wind.strength.value;
      LOW_POWER.set(false,{persist:false,silent:true});GFX.setPreset('high');GARDEN_POLISH.update(44);VISUAL_EXPERIENCE.update(44);const restored=h.leaves.count;
      camera.position.copy(base).add(new THREE.Vector3(0,0,17.5));VISUAL_EXPERIENCE.update(44.1);const boundaryCount=h.leaves.count;
      GFX.setPreset('low');VISUAL_EXPERIENCE.update(44.2);GFX.setPreset('high');VISUAL_EXPERIENCE.update(44.3);const qualityBoundaryRestored=h.leaves.count===boundaryCount;
      LOW_POWER.set(true,{persist:false,silent:true});VISUAL_EXPERIENCE.update(44.4);LOW_POWER.set(false,{persist:false,silent:true});VISUAL_EXPERIENCE.update(44.5);const ecoBoundaryRestored=h.leaves.count===boundaryCount;
      applySeason('winter');const c=VISUAL_EXPERIENCE.foliageSprays.find(h=>!h.maple);c.root.getWorldPosition(camera.position);camera.position.z+=4;VISUAL_EXPERIENCE.update(45);evergreen=c.leaves.visible;
      return{winter,evergreen,finite,near,middle,far,eco,ecoWind,restored,qualityBoundaryRestored,ecoBoundaryRestored,reuse:ownIds()===ids,
        flowers:flower.visible&&flower.geometry.id===flowerIds[0]&&flower.material.id===flowerIds[1]&&flowerMatrices.every((v,i)=>v===flower.instanceMatrix.array[i])};
    });
    assert(lifecycle.winter&&lifecycle.evergreen&&lifecycle.finite&&lifecycle.flowers&&lifecycle.reuse&&lifecycle.qualityBoundaryRestored&&lifecycle.ecoBoundaryRestored);
    assert.deepEqual([lifecycle.near,lifecycle.middle,lifecycle.far,lifecycle.eco,lifecycle.restored],[32,16,0,8,32]);assert.equal(lifecycle.ecoWind,0);
    const inspection=await page.evaluate(()=>{
      applySeason('summer');LOW_POWER.set(true,{persist:false,silent:true});VISUAL_EXPERIENCE.update(50);
      const list=VISUAL_EXPERIENCE.foliageSprays,target=list[0],state=h=>[h.leaves.count,h.twigs.count,h.leaves.visible,h.twigs.visible];
      list.slice(1).forEach(h=>{h.leaves.visible=false;h.twigs.visible=false;});
      const masked=list.slice(1).map(state);VISUAL_EXPERIENCE.updateFoliageLOD(camera,[target.root]);
      const result={detail:target.leaves.count===32&&target.twigs.count===32&&target.leaves.visible,
        maskPreserved:JSON.stringify(masked)===JSON.stringify(list.slice(1).map(state))};
      const selected=state(target);VISUAL_EXPERIENCE.updateFoliageLOD(camera,[]);result.emptyPreserved=JSON.stringify(selected)===JSON.stringify(state(target));
      VISUAL_EXPERIENCE.updateFoliageLOD(camera);result.normalRestored=target.leaves.count<32;
      LOW_POWER.set(false,{persist:false,silent:true});return result;
    });
    assert(inspection.detail&&inspection.maskPreserved&&inspection.emptyPreserved&&inspection.normalRestored);
    const flowerInspection=await page.evaluate(()=>{
      applySeason('winter');VISUAL_EXPERIENCE.update(55);
      const batch=SEASONAL.tsubakiFlowers,original=Array.from(batch.instanceMatrix.array),originalCount=batch.count,
        originalVisible=batch.visible,ids=[batch.geometry.id,batch.material.id],instanceAttribute=batch.instanceMatrix,render=renderer.render,
        entry=interactables.tsubaki,registeredRoots=entry.roots,unlocked=new Set(codexUnlocked),draws=[];
      const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
      const restored=()=>batch.count===originalCount&&equal(Array.from(batch.instanceMatrix.array),original);
      const closed=()=>restored()&&batch.visible===originalVisible;
      const matching=(draw,index)=>draw.visible&&draw.count===15&&equal(draw.matrices.slice(0,15*16),original.slice(index*15*16,(index+1)*15*16));
      renderer.render=function(...args){draws.push({count:batch.count,visible:batch.visible,matrices:Array.from(batch.instanceMatrix.array)});return render.apply(this,args);};
      const result={single:true,comparison:true,context:true,photo:true,close:true,exception:false,season:true,reuse:true};
      try{
        codexUnlocked.add('tsubaki');codexUnlocked.add('kaede');
        // Use all three actual world trees in turn, including nonzero batch offsets.
        for(let repeat=0;repeat<6;repeat++)for(let index=0;index<SEASONAL.tsubaki.length;index++){
          entry.roots=[SEASONAL.tsubaki[index].tree];draws.length=0;
          CODEX_VIEWER.open('tsubaki','game');result.single&&=matching(draws.at(-1),index)&&restored();
          draws.length=0;CODEX_VIEWER.compare('kaede');
          result.comparison&&=draws.length===2&&matching(draws[0],index)&&!draws[1].visible&&restored();
          CODEX_VIEWER.compare(null);draws.length=0;document.getElementById('viewerContext').click();
          result.context&&=draws.at(-1).visible&&draws.at(-1).count===45&&equal(draws.at(-1).matrices,original)&&restored();
          document.getElementById('viewerContext').click();CODEX_VIEWER.setTab('photo');result.photo&&=restored();
          CODEX_VIEWER.close();result.close&&=closed();
          draws.length=0;CODEX_VIEWER.open('kaede','game');draws.length=0;CODEX_VIEWER.compare('tsubaki');
          result.comparison&&=draws.length===2&&!draws[0].visible&&matching(draws[1],index)&&restored();
          CODEX_VIEWER.close();result.close&&=closed();
        }
        CODEX_VIEWER.open('tsubaki','game');const maskedVisible=batch.visible;
        renderer.render=function(){throw new Error('flower-render-restoration-probe');};
        try{CODEX_VIEWER.render();}catch(e){result.exception=e.message==='flower-render-restoration-probe'&&restored()&&batch.visible===maskedVisible;}
        renderer.render=render;CODEX_VIEWER.close();result.exception&&=closed();
        applySeason('summer');VISUAL_EXPERIENCE.update(56);draws.length=0;
        renderer.render=function(...args){draws.push({visible:batch.visible});return render.apply(this,args);};
        CODEX_VIEWER.open('tsubaki','game');result.season=!draws.at(-1).visible;CODEX_VIEWER.close();result.season&&=!batch.visible;
        result.reuse=equal([batch.geometry.id,batch.material.id],ids)&&batch.instanceMatrix===instanceAttribute&&restored();
        return result;
      }finally{
        renderer.render=render;CODEX_VIEWER.close();entry.roots=registeredRoots;
        codexUnlocked.clear();for(const id of unlocked)codexUnlocked.add(id);applySeason('winter');VISUAL_EXPERIENCE.update(57);
      }
    });
    assert(Object.values(flowerInspection).every(Boolean),JSON.stringify(flowerInspection));
    assert.deepEqual(errors,[]);const report={ranAt:new Date().toISOString(),geometry,maple,camellia,lifecycle,inspection,flowerInspection,errors};
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
