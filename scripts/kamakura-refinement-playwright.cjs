/* Run after build:app. Only the served response exposes private map references. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts/kamakura-refinement'),passed=[],errors=[];
function check(ok,label){assert.ok(ok,label);passed.push(label);}
(async()=>{
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,pathname==='/'?'寝殿造り3D探訪_統合版.html':'.'+pathname);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    if(path.extname(file)==='.html'){
      let html=fs.readFileSync(file,'utf8');const marker='  /* ---- 19. 図鑑登録・名称札';
      assert.equal(html.split(marker).length,2,'one private map instrumentation point');
      html=html.replace(marker,'  window.__kamaGeometryAudit={K,worldK,KAMA_ZONES};\n'+marker);
      res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);
    }else{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
    const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|VALIDATE_STATUS|ERROR: 0:/.test(m.text()))errors.push(m.text());});
    await page.addInitScript(()=>{window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};localStorage.setItem('shinden3d-onboard-v1','1');});
    await page.goto(`http://127.0.0.1:${server.address().port}/?map=kamakura&adaptive=0&eco=off`,{waitUntil:'load'});
    await page.waitForFunction(()=>window.__kamaGeometryAudit&&typeof SELECTED_WORLD!=='undefined');
    const result=await page.evaluate(()=>{
      enterMode('walk');hideModeBrief(true);onboardClose();AUTO_TIME._paused=true;setTime('day');
      const {K,worldK}=window.__kamaGeometryAudit,ok={};worldK.updateMatrixWorld(true);
      const all=(root,name)=>{const out=[];root.traverse(o=>{if(o.name===name)out.push(o);});return out;};
      const buddha=K.amidabutsu,boxOf=o=>new THREE.Box3().setFromObject(o);
      ok.sculpture=['face','nose','closed-mouth','robed-torso','lotus-seat','halo'].every(n=>buddha.getObjectByName(n))&&all(buddha,'meditation-palm').length===2&&all(buddha,'folded-knee').length===2;
      ok.statueAboveFloor=boxOf(buddha).min.y>=.749&&boxOf(buddha).max.y<3;
      ok.sculptureNotBlack=buddha.getObjectByName('face').material.metalness<.5&&buddha.getObjectByName('face').material.roughness>.5;
      ok.statuePick=all(buddha,'face').every(o=>o.userData.iid==='amidabutsu'&&rayTargets.includes(o));
      const doors=all(K.yaguramon,'hinged-door');
      ok.attachedGate=doors.length===2&&doors.every(o=>Math.abs(Math.abs(o.position.x)-2.74)<.001&&all(o,'door-stud').length===4&&all(o,'door-hinge').length===2);
      const centerRay=new THREE.Raycaster(new THREE.Vector3(0,1.62,31),new THREE.Vector3(0,0,1),0,7);
      ok.clearGate=centerRay.intersectObject(worldK,true).filter(h=>h.object.isMesh&&!h.object.isSprite).length===0;
      ok.hallDoors=all(K.jibutsudo,'hinged-door').length===2&&all(K.jibutsudo,'approach-step').length===4;
      const heights=[groundH(-20,-14.75),groundH(-20,-15.10),groundH(-20,-15.45),groundH(-20,-15.80),groundH(-20,-16.1)];
      ok.stairHeights=heights[0]>.1&&heights.every((h,i)=>!i||h>=heights[i-1])&&heights[4]===.75;
      ok.well=all(K.tsurubeido,'well-bucket').length===1&&!!K.tsurubeido.getObjectByName('bucket-rope')&&!!K.tsurubeido.getObjectByName('bucket-handle');
      ok.wellRopeVisible=boxOf(K.tsurubeido.getObjectByName('bucket-rope')).getSize(new THREE.Vector3()).x>=.025;
      const horses=all(worldK,'kamakura-horse');
      ok.horseShape=horses.length===3&&horses.every(h=>['horse-neck','horse-cranium','horse-nasal-bridge','horse-muzzle','horse-mane','horse-tail'].every(n=>h.getObjectByName(n)?.geometry?.type!=='BoxGeometry')&&all(h,'horse-ear').length===2&&all(h,'horse-hoof').length===4);
      ok.horseSharedGeometry=['horse-neck','horse-mane','horse-tail','horse-hoof'].every(n=>new Set(horses.map(h=>h.getObjectByName(n).geometry)).size===1);
      ok.horseConnected=horses.every(h=>{
        const head=h.userData.head,neck=h.getObjectByName('horse-neck'),chest=h.getObjectByName('horse-chest');
        const resting=boxOf(neck).intersectsBox(boxOf(chest));head.position.set(0,-.46,.28);h.updateMatrixWorld(true);
        const lowered=boxOf(neck).intersectsBox(boxOf(chest));head.position.set(0,0,0);h.updateMatrixWorld(true);
        const muzzleContact=boxOf(h.getObjectByName('horse-muzzle')).intersectsBox(boxOf(h.getObjectByName('horse-nasal-bridge')));
        return resting&&lowered&&muzzleContact&&all(h,'horse-hoof').every(foot=>Math.abs(boxOf(foot).min.y)<.001);
      });
      ok.saddle=all(K.kura_saddle,'saddle-arch').length===2&&all(K.kura_saddle,'stirrup-ring').length===2;
      ok.bow=all(K.archer,'bow-limb').length===1&&all(K.archer,'drawn-string').length===1&&Math.abs(K.archer.rotation.y-Math.PI)<.01;
      const hitatare=[];worldK.traverse(o=>{if(o.userData.kamakuraAttire==='hitatare')hitatare.push(o);});
      ok.matchingHitatare=hitatare.length>=5&&hitatare.every(o=>{const upper=o.getObjectByName('tailored-torso'),legs=all(o,'hakama-leg').concat(all(o,'seated-hakama'));return upper&&legs.length===2&&legs.every(leg=>leg.material===upper.material);});
      ok.roleColorsRemain=new Set(hitatare.map(o=>o.getObjectByName('tailored-torso').material.color.getHex())).size>=3;
      ok.codex=['hori','karabori','dorui','itabei','dobashi','yaguramon','urakido','monomiyagura','shuden_k','mairado','akarishoji','okidatami','irori','samuraidokoro','umaya','uma','kaibaoke','kura_saddle','matoba','azuchi','kasagake_mato','baba','jibutsudo','amidabutsu','itakura','tawara','kamado','tsurubeido','hitatare','samuraieboshi'].every(id=>interactables[id]?.roots?.length);
      // Sweep the production collision resolver with small steps, no teleport across obstacles.
      let x=0,z=46;const walk=(points)=>{for(const p of points){let count=0;while(Math.hypot(p[0]-x,p[1]-z)>.05&&count++<2200){const d=Math.hypot(p[0]-x,p[1]-z),step=Math.min(.10,d),r=walkMoveResolve(x,z,x+(p[0]-x)/d*step,z+(p[1]-z)/d*step);if(Math.hypot(r.x-x,r.z-z)<.00001)return false;x=r.x;z=r.z;}if(Math.hypot(p[0]-x,p[1]-z)>.1)return false;}return true;};
      ok.entryRoute=walk([[0,32],[0,7],[0,0]]);
      ok.shrineRoute=walk([[0,7],[-12,7],[-12,-13],[-20,-13],[-20,-16.8]]);
      ok.stableRoute=walk([[-20,-13],[-12,-13],[-12,7],[12,7],[18,4]]);
      const stopped=walkMoveResolve(33,8,35,8);ok.wallStops=stopped.x<33.4;
      const moat=walkMoveResolve(3.4,43,3.4,41);ok.moatStops=moat.z>=42.2;
      ok.dryMoat=new THREE.Raycaster(new THREE.Vector3(10,2,-39.5),new THREE.Vector3(0,-1,0)).intersectObject(worldK,true)[0]?.point.y<-.2;
      const old=APP.mode;enterMode('story');ok.modeGate=APP.mode===old;
      return ok;
    });
    for(const [label,ok]of Object.entries(result))check(ok,label);
    fs.mkdirSync(output,{recursive:true});
    const views=[
      ['gate-inside',[0,1.8,29],[0,2.2,35]],
      ['buddha-front',[-20,2.10,-15.9],[-20,1.95,-18.55]],
      ['buddha-three-quarter',[-18.75,2.25,-16.5],[-20,1.8,-18.55]],
      ['shrine-approach',[-17,2.5,-11.5],[-20,1.9,-18]],
      ['well',[9,2.7,-12.4],[6,1.4,-16]],
      ['stable',[11,2.6,6],[18,1.3,0]],
      ['horse-close',[14.2,2.15,3.8],[16,1.85,1.5]],
      ['main-hall',[0,3.0,7],[0,2,-5]],
      ['compound-overview',[49,57,61],[0,0,0]]
    ];
    for(const [name,pos,target]of views){
      const data=await page.evaluate(({pos,target})=>{camera.position.set(...pos);camera.lookAt(...target);camera.updateMatrixWorld(true);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png').split(',')[1];},{pos,target});
      fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(data,'base64'));
    }
    for(const eco of [false,true]){
      const phase=await page.evaluate(eco=>{
        GFX.setPreset('high');GFX.setBloom('off');LOW_POWER.set(eco,{persist:false,silent:true});APP_FPSCAP=0;setTime('night');AUTO_TIME._paused=true;
        const target=TIMES.night;for(const k of ['sky','fog','sunC','ambC'])cur[k].set(target[k]);for(const k of ['sunI','hemi','amb','moon','exp','int'])cur[k]=target[k];cur.sunP.set(...target.sunP);
        for(let i=0;i<12;i++){clock.running=true;clock.oldTime=performance.now()-100;window.__kamaFrameStamp=Math.max(window.__kamaFrameStamp||0,performance.now())+100;window.__SHINDEN_BENCH_PAUSE=false;animate(window.__kamaFrameStamp);window.__SHINDEN_BENCH_PAUSE=true;}
        camera.position.set(-17,2.5,-11.5);camera.lookAt(-20,1.9,-18);NIGHT_LIGHTING.update(camera,true);renderer.render(scene,camera);
        let lights=0;scene.traverseVisible(o=>{if(o.isPointLight)lights++;});return {lights,png:renderer.domElement.toDataURL('image/png').split(',')[1]};
      },eco);
      check(phase.lights===(eco?2:4),'night light budget '+(eco?'eco':'high'));
      fs.writeFileSync(path.join(output,'shrine-night-'+(eco?'eco':'high')+'.png'),Buffer.from(phase.png,'base64'));
    }
    check(errors.length===0,'no browser exceptions: '+errors.join(' | '));
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({status:'ok',passed,views},null,2));console.log(JSON.stringify({status:'ok',passed},null,2));
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
