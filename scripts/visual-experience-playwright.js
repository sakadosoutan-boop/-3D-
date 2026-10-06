const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/review');
const entries=vm.runInNewContext(fs.readFileSync(path.join(root,'src/app/items.js'),'utf8')+';ITEMS');
const media=JSON.parse(fs.readFileSync(path.join(root,'assets/codex/credits.json')));
const inline=vm.runInNewContext(fs.readFileSync(path.join(root,'src/app/codex-media.js'),'utf8')+';CODEX_MEDIA');
for(const m of media){
 assert(m.items.every(id=>entries[id]),'unknown media item '+m.id);assert(m.author&&m.license&&/^https?:/.test(m.licenseUrl));
 assert(m.source.startsWith('https://commons.wikimedia.org/wiki/File:'));const b=fs.readFileSync(path.join(root,m.src));assert.equal(b.length,m.bytes);assert.equal(b.readUInt16BE(),0xffd8);assert(m.width>0&&m.height>0&&m.kind==='photo');
 assert.deepEqual(Buffer.from(inline.find(i=>i.id===m.id).dataUrl.split(',')[1],'base64'),b,'single HTML photograph differs from licensed asset');
}
assert.equal(media.length,11);assert(/Jidai_matsuri/.test(media.find(m=>m.id==='gissha').source),'gissha must be a photographed replica, not a painting');
const passed=['bundled photographs map to existing entries and retain source, author, license and original dimensions'],errors=[];
function check(ok,message){assert(ok,message);passed.push(message);}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,pathname==='/'?'寝殿造り3D探訪_統合版.html':'.'+pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  const types={'.html':'text/html;charset=utf-8','.jpg':'image/jpeg','.js':'text/javascript','.json':'application/json','.mp3':'audio/mpeg'};
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
  await context.addInitScript(()=>{window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};localStorage.setItem('shinden3d-onboard-v1','1');});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE.WebGLProgram|VALIDATE_STATUS|ERROR: 0:/.test(m.text()))errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}/?adaptive=0&eco=off`,{waitUntil:'load'});
  await page.waitForFunction(()=>typeof CODEX_VIEWER!=='undefined'&&CODEX_VIEWER&&PHOTO_TOOLS&&VISUAL_EXPERIENCE);
  await page.evaluate(()=>{GFX.setPreset('high');GFX.setBloom('off');enterMode('walk');hideModeBrief(true);APP_FPSCAP=0;AUTO_TIME._paused=true;document.getElementById('toast').style.display='none';});
  const expressions=await page.evaluate(()=>{
   const rig=HEIAN_EXPRESSIONS.find(r=>r.g.userData.pose!=='standing'),standing=HEIAN_EXPRESSIONS.find(r=>r.g.userData.pose==='standing');
   rig.g.getWorldPosition(camera.position);camera.position.z+=2;rig.detail.visible=true;
   const seatedY=rig.g.position.y,standingY=standing.g.position.y;
   VISUAL_EXPERIENCE.update(.095-rig.phase);const blink=rig.eyes.scale.y;
   VISUAL_EXPERIENCE.update(.45-rig.phase);const open=rig.eyes.scale.y;
   return{blink,open,held:!!rig.held,seatedStable:rig.g.position.y===seatedY,standingStable:standing.g.position.y===standingY,face:rig.face.visible};
  });
  check(expressions.blink<.2&&expressions.open===1&&expressions.held&&expressions.seatedStable&&expressions.standingStable&&expressions.face,'blinking and held props animate close-up while seated and standing roots stay grounded');
  const vegetation=await page.evaluate(()=>{
   applySeason('summer');const a=VISUAL_EXPERIENCE.foliage.filter(f=>f.mesh.userData.estateLeaves);
   return{maple:a.filter(f=>f.maple).every(f=>f.mesh.geometry.userData.estateLeaf==='palmate'&&f.mesh.count>=100),camellia:a.filter(f=>!f.maple).every(f=>f.mesh.geometry.userData.estateLeaf==='elliptic'&&f.mesh.material.roughness<.5),both:a.some(f=>f.maple)&&a.some(f=>!f.maple),registered:!!interactables.kaede&&!!interactables.tsubaki};
  });
  check(vegetation.maple&&vegetation.camellia&&vegetation.both&&vegetation.registered,'maples and camellias have distinct dense leaf shapes and discoverable encyclopedia entries');
  const bounds=await page.evaluate(()=>{
    const matrix=new THREE.Matrix4(),point=new THREE.Vector3();return VISUAL_EXPERIENCE.foliage.filter(f=>f.mesh.userData.estateLeaves).every(({mesh})=>{
      const p=mesh.geometry.attributes.position,s=mesh.geometry.boundingSphere;
      for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);for(let j=0;j<p.count;j++){point.fromBufferAttribute(p,j).applyMatrix4(matrix);if(point.distanceTo(s.center)>s.radius+.0001)return false;}}return true;
    });
  });
  check(bounds,'shared leaf bounds contain every instance across all tree sizes');
  const light=await page.evaluate(()=>{
   setTime('day');const b=VISUAL_EXPERIENCE.litBays[0],c=new THREE.Color();b.st.t=0;b.misu.t=0;VISUAL_EXPERIENCE.update(1);VISUAL_EXPERIENCE.floorLight.getColorAt(0,c);const closed=c.r;
   b.st.t=1;b.misu.t=1;VISUAL_EXPERIENCE.update(2);VISUAL_EXPERIENCE.floorLight.getColorAt(0,c);return{closed,open:c.r,wallFinite:[...VISUAL_EXPERIENCE.wallShade.instanceMatrix.array].every(Number.isFinite)};
  });
  check(light.open>light.closed*8&&light.wallFinite,'floor light and wall shading respond to both shutter and bamboo blind opening');
  const seasons=await page.evaluate(()=>{
   const ids=()=>{const g=new Set(),m=new Set();scene.traverse(o=>{if(o.geometry)g.add(o.geometry.id);[].concat(o.material||[]).forEach(v=>m.add(v.id));});return JSON.stringify([[...g].sort(),[...m].sort()]);};
   applySeason('winter');const before=ids();VISUAL_EXPERIENCE.setProgress(.04);const early=VISUAL_EXPERIENCE.snowAmount;VISUAL_EXPERIENCE.setProgress(.5);const mid=VISUAL_EXPERIENCE.snowAmount;VISUAL_EXPERIENCE.setProgress(.95);const late=VISUAL_EXPERIENCE.snowAmount;
   let finite=true;for(const s of ['spring','summer','autumn','winter']){applySeason(s);for(const p of [.08,.5,.95]){VISUAL_EXPERIENCE.setProgress(p);VISUAL_EXPERIENCE.update(p*10);renderer.render(scene,camera);}}
   scene.traverse(o=>{if(o.isInstancedMesh)finite=finite&&[...o.instanceMatrix.array].every(Number.isFinite);});
   return{early,mid,late,reuse:ids()===before,finite,fish:VISUAL_EXPERIENCE.fish.every(f=>f.body.userData.waterDepth>.1&&f.body.userData.waterDepth<.5),wind:VISUAL_EXPERIENCE.wind.strength.value};
  });
  check(seasons.early<seasons.mid&&seasons.late<seasons.mid&&seasons.finite&&seasons.reuse&&seasons.fish&&seasons.wind===1,'season progress, submerged fish tint and shared wind retain finite reusable resources across four seasons');
  const snowPixels=await page.evaluate(()=>{
    applySeason('winter');const test=new THREE.Scene();test.add(new THREE.AmbientLight(0xffffff,1));
    const geo=new THREE.PlaneGeometry(2,2);geo.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(12).fill(1),3));
    const roof=new THREE.Mesh(geo,MAT.roof);roof.rotation.x=-Math.PI/2;roof.position.y=5;test.add(roof);
    const cam=new THREE.OrthographicCamera(-1.2,1.2,1.2,-1.2,.1,20);cam.position.set(0,10,0);cam.up.set(0,0,-1);cam.lookAt(0,5,0);
    function mean(p){VISUAL_EXPERIENCE.setProgress(p);renderer.render(test,cam);const gl=renderer.getContext(),pixels=new Uint8Array(32*32*4);gl.readPixels(gl.drawingBufferWidth/2-16,gl.drawingBufferHeight/2-16,32,32,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=pixels[i]+pixels[i+1]+pixels[i+2];return sum/(32*32*3);}
    const result={early:mean(.04),mid:mean(.5),late:mean(.95)};geo.dispose();VISUAL_EXPERIENCE.setProgress(.5);return result;
  });
  check(snowPixels.mid>snowPixels.early+15&&snowPixels.late<snowPixels.mid-5,'rendered roof snow grows and melts as the season slider advances');
  const eco=await page.evaluate(()=>{LOW_POWER.set(true,{persist:false,silent:true});GARDEN_POLISH.update(1);VISUAL_EXPERIENCE.update(1);const off=VISUAL_EXPERIENCE.wind.strength.value===0&&!VISUAL_EXPERIENCE.detail.visible;LOW_POWER.set(false,{persist:false,silent:true});GARDEN_POLISH.update(2);VISUAL_EXPERIENCE.update(2);return{off,on:VISUAL_EXPERIENCE.wind.strength.value===1&&VISUAL_EXPERIENCE.detail.visible};});
  check(eco.off&&eco.on,'eco stops shared wind and hides added lighting, then restores high quality');
  const photo=await page.evaluate(()=>{
   applySeason('spring');setTime('day');player.pos.set(0,1.62,26);player.yaw=.35;player.pitch=.1;APP.view='fp';const old=camera.fov;setPhotoMode(true);document.getElementById('photoFov').value=43;document.getElementById('photoFov').dispatchEvent(new Event('input'));
   const pos=player.pos.toArray();const save=PHOTO_TOOLS.save();player.pos.x+=4;player.yaw=1.1;const restore=PHOTO_TOOLS.restore(0);
   const restored=player.pos.toArray().every((v,i)=>v===pos[i])&&camera.fov===43&&player.yaw===.35;
   const bad=PHOTO_TOOLS.valid({version:1,pos:[NaN,0,0]});setPhotoMode(false);return{save,restore,restored,bad,fov:camera.fov===old};
  });
  check(photo.save&&photo.restore&&photo.restored&&!photo.bad&&photo.fov,'photography restores position, angle and field of view, rejects corrupt records and restores the normal camera on exit');
  const viewer=await page.evaluate(()=>{
   const locked=!codexUnlocked.has('biwa')&&!CODEX_VIEWER.open('biwa');unlockCodex('kichou');openCodex();codexShowDetail('kichou');
   const visible=new Map();scene.traverse(o=>visible.set(o,o.visible));window.__viewerVisibility=visible;
   window.__viewerBefore={pos:player.pos.toArray(),cam:camera.position.toArray(),time:clock.elapsedTime,geometries:renderer.info.memory.geometries};
   const open=CODEX_VIEWER.open('kichou');CODEX_VIEWER.render();const vp=renderer.getViewport(new THREE.Vector4()).toArray();const calls=renderer.info.render.calls;CODEX_VIEWER.rotate(.4);CODEX_VIEWER.zoom(.8);
   window.__SHINDEN_BENCH_PAUSE=false;animate(performance.now()+100);window.__SHINDEN_BENCH_PAUSE=true;
   return{locked,open,vp,calls,clockFrozen:clock.elapsedTime===window.__viewerBefore.time,position:player.pos.toArray().every((v,i)=>v===window.__viewerBefore.pos[i]),canvas:document.querySelectorAll('canvas#c').length};
  });
  check(viewer.locked&&viewer.open&&viewer.calls>0&&viewer.clockFrozen&&viewer.position&&viewer.canvas===1,'3D inspection uses the actual model and existing canvas, preserves discovery locks and freezes play time and movement');
  await page.screenshot({path:path.join(out,'codex-viewer-desktop.png')});
  await page.click('#viewerPhotoTab');await page.waitForFunction(()=>document.getElementById('viewerPhoto').complete&&document.getElementById('viewerPhoto').naturalWidth>0);
  await page.screenshot({path:path.join(out,'codex-photo-desktop.png')});
  const credit=await page.locator('#viewerPhotoCaption').textContent();check(/Wikiwikiyarou/.test(credit)&&/Public domain/.test(credit),'photograph loads from bundled assets with visible attribution and reuse terms');
  await page.route('**/assets/codex/*.jpg',route=>route.abort());
  await page.evaluate(()=>{CODEX_VIEWER.close();unlockCodex('koto');CODEX_VIEWER.open('koto','photo');});
  await page.waitForFunction(()=>document.getElementById('viewerPhoto').src.startsWith('data:image/jpeg;')&&document.getElementById('viewerPhoto').naturalWidth>0);
  check(await page.locator('#viewerPhotoError').isHidden(),'photographs fall back to the embedded copy when the external file cannot load');
  await page.unroute('**/assets/codex/*.jpg');
  await page.evaluate(()=>{CODEX_VIEWER.close();CODEX_VIEWER.open('kichou','photo');});
  await page.keyboard.press('Escape');
  const restored=await page.evaluate(()=>{let same=true;for(const [o,v] of window.__viewerVisibility)same=same&&o.visible===v;return{same,closed:!CODEX_VIEWER.active,cam:camera.position.toArray().every((v,i)=>v===window.__viewerBefore.cam[i]),scissor:!renderer.getScissorTest(),codex:APP.codexOpen};});
  check(restored.same&&restored.closed&&restored.cam&&restored.scissor&&restored.codex,'closing the viewer restores every object visibility and render state and returns to the encyclopedia');
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>CODEX_VIEWER.open('kichou'));
  const fits=await page.evaluate(()=>{const r=document.getElementById('viewerStage').getBoundingClientRect();return{stage:r.width>250&&r.height>200,buttons:[...document.querySelectorAll('#viewerGamePanel button')].every(b=>b.getBoundingClientRect().height>=44),overflow:document.documentElement.scrollWidth<=innerWidth};});
  check(fits.stage&&fits.buttons&&fits.overflow,'phone inspection retains a usable stage, 44-pixel controls and no horizontal overflow');await page.screenshot({path:path.join(out,'codex-viewer-phone.png')});
  await page.click('#viewerPhotoTab');await page.waitForFunction(()=>document.getElementById('viewerPhoto').naturalWidth>0);await page.screenshot({path:path.join(out,'codex-photo-phone.png')});await page.evaluate(()=>CODEX_VIEWER.close());
  const reduced=await browser.newContext({viewport:{width:900,height:650},reducedMotion:'reduce'});await reduced.addInitScript(()=>{window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};localStorage.setItem('shinden3d-onboard-v1','1');});
  const quiet=await reduced.newPage();quiet.on('pageerror',e=>errors.push(e.message));await quiet.goto(`http://127.0.0.1:${server.address().port}/?eco=off&adaptive=0`);await quiet.waitForFunction(()=>typeof VISUAL_EXPERIENCE!=='undefined'&&VISUAL_EXPERIENCE);
  const motion=await quiet.evaluate(()=>{enterMode('walk');GFX.setPreset('high');GARDEN_POLISH.update(1);VISUAL_EXPERIENCE.update(1);const a=gimmicks.misu.map(s=>s.pivot.rotation.x);VISUAL_EXPERIENCE.update(10);return REDUCED_MOTION&&VISUAL_EXPERIENCE.wind.strength.value===0&&GARDEN_POLISH.waterStrength===0&&a.every((v,i)=>gimmicks.misu[i].pivot.rotation.x===v);});
  check(motion,'reduced-motion mode stops foliage, curtains and water motion');
  await quiet.goto(pathToFileURL(path.join(root,'寝殿造り3D探訪_統合版.html')).href+'?eco=off');await quiet.waitForFunction(()=>typeof CODEX_VIEWER!=='undefined'&&CODEX_VIEWER);
  await quiet.evaluate(()=>{unlockCodex('gissha');openCodex();CODEX_VIEWER.open('gissha','photo');});
  await quiet.waitForFunction(()=>document.getElementById('viewerPhoto').naturalWidth>0);
  check(await quiet.evaluate(()=>document.getElementById('viewerPhoto').src.startsWith('data:image/jpeg;')),'the standalone HTML displays licensed photographs without an adjacent assets folder');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'ok',passed,errors},null,2));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
