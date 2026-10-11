const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'}),page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};localStorage.setItem('shinden3d-onboard-v1','1');});
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../寝殿造り3D探訪_統合版.html')).href+'?adaptive=0&eco=off');await page.waitForFunction(()=>window.SELECTED_PERFORMANCE);
  const report=await page.evaluate(()=>{
   enterMode('walk');hideModeBrief(true);GFX.setPreset('high');GFX.setBloom('off');LOW_POWER.set(false,{persist:false,silent:true});
   camera.position.set(80,105,92);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);SELECTED_PERFORMANCE.update(1);renderer.render(scene,camera);
   const batched=renderer.info.render.calls,merged=[],sources=[];
   scene.traverse(o=>{if(o.userData.selectedBatch)merged.push(o);if(o.userData.selectedMergeSource)sources.push(o);});
   const visible=merged.map(o=>o.visible);merged.forEach(o=>o.visible=false);sources.forEach(o=>o.visible=true);renderer.render(scene,camera);const original=renderer.info.render.calls;
   sources.forEach(o=>o.visible=false);merged.forEach((o,i)=>o.visible=visible[i]);
   LOW_POWER.set(true,{persist:false,silent:true});GARDEN_POLISH.update(2);SELECTED_PERFORMANCE.update(2);renderer.render(scene,camera);const eco=SELECTED_PERFORMANCE.stats;
   codexUnlocked.add('michoudai');CODEX_VIEWER.open('michoudai');const inspecting=SELECTED_PERFORMANCE.stats;CODEX_VIEWER.close();SELECTED_PERFORMANCE.update(3);const restoredEco=SELECTED_PERFORMANCE.stats;
   LOW_POWER.set(false,{persist:false,silent:true});GARDEN_POLISH.update(4);SELECTED_PERFORMANCE.update(4);const high=SELECTED_PERFORMANCE.stats;
   const dynamicUntouched=[...gimmicks.shitomi.map(s=>s.pivot),...gimmicks.misu.map(s=>s.pivot),...gimmicks.tsumado.flatMap(s=>[s.L,s.R]),...gimmicks.karabitsu.map(s=>s.lid)].every(root=>{let intact=true;root.traverse(o=>{if(o.userData.selectedMergeSource)intact=false;});return intact;});
   const rayPickable=merged.every(o=>rayTargets.includes(o)&&o.userData.iid);
   return{originalCalls:original,batchedCalls:batched,savedCalls:original-batched,eco,inspecting,restoredEco,high,dynamicUntouched,rayPickable};
  });
  assert(report.savedCalls>100,'Static grouping must reduce actual draw calls');assert(report.eco.lodActive>10&&report.eco.trianglesSaved>1000,'Eco must reduce geometry');assert.equal(report.inspecting.lodActive,0);assert(report.restoredEco.lodActive>10);assert.equal(report.high.lodActive,0);assert(report.dynamicUntouched&&report.rayPickable);assert.deepEqual(errors,[]);
  fs.mkdirSync(path.resolve(__dirname,'../artifacts/review'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../artifacts/review/selected-performance-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:'ok',...report},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
