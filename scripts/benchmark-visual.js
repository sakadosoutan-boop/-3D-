/* Fixed-seed, fixed-camera comparison. Includes GPU completion in frame timings. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/review');
const label=process.argv[2]||'after';
const html=fs.readFileSync(path.resolve(root,process.argv[3]||'寝殿造り3D探訪_統合版.html'));
const scenes=[
 {name:'front',time:'day',season:'spring',view:'fp',pos:[0,1.62,26],yaw:0},
 {name:'overview',time:'day',season:'spring',view:'ov',pos:[80,105,92]},
 {name:'interior',time:'day',season:'spring',view:'fp',pos:[0,2.8,-3],yaw:1.3},
 {name:'veranda',time:'day',season:'spring',view:'fp',pos:[-5,3.2,7],target:[4,1.6,4],yaw:1.3},
 {name:'garden',time:'dusk',season:'summer',view:'fp',pos:[8,1.62,19],yaw:3.1},
 {name:'pond',time:'day',season:'summer',view:'fp',pos:[2,3.2,23],target:[2,.02,34],yaw:Math.PI},
 {name:'iris',time:'day',season:'summer',view:'fp',pos:[-13,1.22,22.25],target:[-13,.55,24],yaw:Math.PI},
 {name:'lotus',time:'day',season:'summer',view:'fp',pos:[-25,1.5,39.4],target:[-26,.3,42],yaw:Math.PI},
 {name:'pink',time:'day',season:'summer',view:'fp',pos:[8,.9,15.8],target:[8,.30,17],yaw:Math.PI},
 {name:'night',time:'night',season:'summer',view:'fp',pos:[0,1.62,26],yaw:0}
];
const requested=process.env.VISUAL_SCENES&&process.env.VISUAL_SCENES.split(',');
if(requested&&requested.some(name=>!scenes.some(scene=>scene.name===name)))throw Error('Unknown VISUAL_SCENES entry');
const selectedScenes=requested?scenes.filter(scene=>requested.includes(scene.name)):scenes;
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  const types={'.mp3':'audio/mpeg','.glb':'model/gltf-binary','.webp':'image/webp','.js':'text/javascript','.json':'application/json'};
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 const report={label,sourceBytes:html.length,profiles:[],errors:[]};
 try{
  for(const eco of [false,true]){
   const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,hasTouch:eco});
   const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error'&&/THREE.WebGLProgram|VALIDATE_STATUS|ERROR: 0:/.test(m.text()))report.errors.push(m.text());});
   await page.addInitScript(eco=>{
    window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};
    let seed=0x5eed1234;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    if(!eco){
     for(let p=window;p;p=Object.getPrototypeOf(p)){try{delete p.ontouchstart;}catch{}}
     Object.defineProperty(navigator,'maxTouchPoints',{get:()=>0});
    }
    localStorage.setItem('shinden3d-onboard-v1','1');
   },eco);
   if(process.env.VISUAL_IBL==='1'&&!eco)await page.addInitScript(()=>Object.defineProperty(navigator,'webdriver',{get:()=>false}));
   const start=Date.now();await page.goto(`http://127.0.0.1:${server.address().port}/?adaptive=0&eco=off`,{waitUntil:'load'});
   await page.waitForFunction(()=>typeof GFX!=='undefined'&&typeof LOW_POWER!=='undefined');
   await page.evaluate(eco=>{GFX.setPreset('high');GFX.setBloom('off');if(eco)LOW_POWER.set(true,{persist:false,silent:true});enterMode('walk');APP_FPSCAP=0;AUTO_TIME._paused=true;APP.labelMode=0;},eco);
   if(!eco)await page.waitForFunction(()=>!IS_TOUCH&&!!MAT.tatami.aoMap&&!!MAT.tatami.normalMap,{timeout:25000});
   await page.waitForTimeout(1000);
   const profile={name:eco?'eco':'high',readyMs:Date.now()-start,scenes:[]};
   for(const shot of selectedScenes){
    await page.evaluate(s=>{
     hideModeBrief(true);document.getElementById('toast').style.display='none';document.getElementById('loadingScreen').classList.remove('show');
     APP.view=s.view;applySeason(s.season);setTime(s.time);AUTO_TIME._paused=true;APP_FPSCAP=0;
     document.getElementById('toast').style.display='none';
     const tg=TIMES[s.time];['sky','fog','sunC','ambC'].forEach(k=>cur[k].set(tg[k]));
     ['sunI','hemi','amb','moon','exp','int'].forEach(k=>cur[k]=tg[k]);cur.sunP.set(...tg.sunP);
     cur.cloudC.set(CLOUD_PAL[s.time].c);cur.cloudOp=CLOUD_PAL[s.time].op;
     const p=s.view==='ov'?[0,1.62,26]:s.pos;player.pos.set(...p);player.yaw=s.yaw||0;player.pitch=-.05;
     clock.running=true;clock.elapsedTime=12;clock.oldTime=performance.now()-16;
     window.__SHINDEN_BENCH_PAUSE=false;animate(performance.now());window.__SHINDEN_BENCH_PAUSE=true;
     camera.position.set(...s.pos);camera.rotation.order='YXZ';
     if(s.target)camera.lookAt(...s.target);else if(s.view==='ov')camera.lookAt(0,0,0);else camera.rotation.set(-.05,s.yaw||0,0,'YXZ');
     TEX.clouds.offset.set(.1,0);cloudDome.position.copy(camera.position);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
     updateControlUI();renderer.render(scene,camera);
    },shot);
    await page.waitForTimeout(60);
    const measurement=await page.evaluate(()=>{
     const gl=renderer.getContext(),samples=[];
     for(let i=0;i<32;i++){const t=performance.now();renderer.render(scene,camera);gl.finish();if(i>=8)samples.push(performance.now()-t);}
     samples.sort((a,b)=>a-b);
     const geos=new Set(),buffers=new Set(),textures=new Set(),instances=new Set();
     scene.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.instanceMatrix)instances.add(o.instanceMatrix.array);if(o.instanceColor)instances.add(o.instanceColor.array);for(const m of [].concat(o.material||[])){Object.values(m).forEach(v=>{if(v&&v.isTexture)textures.add(v);});}});
     geos.forEach(g=>{Object.values(g.attributes).forEach(a=>buffers.add(a.array));if(g.index)buffers.add(g.index.array);});
     const pixels=[...textures].reduce((sum,t)=>sum+(t.image&&t.image.width&&t.image.height?t.image.width*t.image.height:0),0);
     return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,
      geometryBytes:[...buffers].reduce((sum,b)=>sum+b.byteLength,0),instanceBytes:[...instances].reduce((sum,b)=>sum+b.byteLength,0),texturePixels:pixels,programs:renderer.info.programs.length,
      pixelRatio:renderer.getPixelRatio(),shadows:renderer.shadowMap.enabled,shadowSize:sun.shadow.mapSize.width,touch:IS_TOUCH,ibl:!!scene.environment,normal:!!MAT.sand.normalMap,ao:!!MAT.sand.aoMap,
      medianMs:+samples[Math.floor(samples.length*.5)].toFixed(2),p95Ms:+samples[Math.floor(samples.length*.95)].toFixed(2),fog:scene.fog.density};
    });
    profile.scenes.push({name:shot.name,...measurement});
    if(!eco&&!process.env.VISUAL_NO_SCREENSHOTS){
     await page.evaluate(()=>document.getElementById('toast').style.display='none');
     await page.screenshot({path:path.join(out,`visual-${label}-${shot.name}.png`)});
    }
    console.log(`${label}/${profile.name}/${shot.name}: ${measurement.calls} calls; ${measurement.medianMs} ms`);
   }
   report.profiles.push(profile);await context.close();
  }
  fs.writeFileSync(path.join(out,`visual-${label}.json`),JSON.stringify(report,null,2)+'\n');
  if(report.errors.length)throw Error(report.errors.join('\n'));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
