/* Run against the integrated build. Production map API only; temporary arrow interception stays inside page.evaluate. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/kamakura-content'),passed=[],errors=[];
function check(ok,label){assert.ok(ok,label);passed.push(label);}
(async()=>{
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,pathname==='/'?'寝殿造り3D探訪_統合版.html':'.'+pathname);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|VALIDATE_STATUS|ERROR: 0:/.test(m.text()))errors.push(m.text());});
    await page.addInitScript(()=>{window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};localStorage.setItem('shinden3d-onboard-v1','1');});
    await page.goto(`http://127.0.0.1:${server.address().port}/?map=kamakura&adaptive=0&eco=off`,{waitUntil:'load'});
    await page.waitForFunction(()=>window.KAMAKURA_WORLD&&typeof SELECTED_WORLD!=='undefined');
    const result=await page.evaluate(()=>{
      enterMode('walk');hideModeBrief(true);onboardClose();AUTO_TIME._paused=true;setTime('day');
      APP_FPSCAP=0;clock.oldTime=performance.now()-16;window.__SHINDEN_BENCH_PAUSE=false;animate(performance.now()+100);window.__SHINDEN_BENCH_PAUSE=true;
      const {K,world,anchors,contentIds}=KAMAKURA_WORLD,ok={};world.updateMatrixWorld(true);
      const all=(root,n)=>{const a=[];root.traverse(o=>{if(o.name===n)a.push(o);});return a;};
      const bounds=o=>new THREE.Box3().setFromObject(o),touch=(a,b)=>bounds(a).clone().expandByScalar(.003).intersectsBox(bounds(b));
      ok.twelveDistinctItems=contentIds.length===12&&new Set(contentIds).size===12&&contentIds.every(id=>ITEMS[id]&&interactables[id]?.roots?.length);
      ok.registeredPickMeshes=K.contentEntries.every(([id,g])=>{const m=[];g.traverse(o=>{if(o.isMesh&&o.userData.iid===id)m.push(o);});return m.length>0&&m.every(o=>rayTargets.includes(o));});
      const facilities=[K.niuke,K.fumidokoro,K.haizendai];
      ok.threeConnectedFacilities=facilities.every(g=>{
        const posts=all(g,'work-post'),beams=all(g,'work-beam'),ties=all(g,'work-tie');
        return posts.length===4&&posts.every(p=>Math.abs(bounds(p).min.y)<.001&&beams.some(b=>touch(p,b)))&&beams.every(b=>ties.some(t=>touch(b,t)))&&!!g.getObjectByName('work-roof');
      });
      ok.tablesSupported=all(world,'work-table').every(g=>{const top=g.getObjectByName('table-top'),legs=all(g,'table-leg'),rails=all(g,'table-stretcher');return legs.length===4&&legs.every(l=>touch(l,top))&&rails.every(r=>legs.filter(l=>touch(l,r)).length===2);});
      ok.vesselsHaveSharedHollowProfiles=all(world,'bentwood-wall-and-base').length===3&&new Set(all(world,'bentwood-wall-and-base').map(m=>m.geometry)).size===1&&new Set(all(world,'lacquer-bowl').map(m=>m.geometry)).size===1&&K.magemono.getObjectByName('bentwood-wall-and-base').geometry.type==='LatheGeometry';
      const rack=K.magemono.parent,table=K.urushiwan.parent;
      ok.utensilsOnTable=Math.abs(bounds(K.magemono).min.y-bounds(rack.getObjectByName('table-top')).max.y)<.003&&all(K.urushiwan,'lacquer-bowl').every(b=>Math.abs(bounds(b).min.y-bounds(table.getObjectByName('table-top')).max.y)<.003);
      ok.cargoGrounded=Math.abs(bounds(K.niuke.getObjectByName('package-core')).min.y)<.001;
      ok.documentsRestOnDesk=Math.abs(bounds(K.shojo_k).min.y-bounds(K.fumizukue.getObjectByName('table-top')).max.y)<.006&&Math.abs(bounds(K.suzuri_k.getObjectByName('inkstone-base')).min.y-bounds(K.fumizukue.getObjectByName('table-top')).max.y)<.003;
      ok.brushTouchesPaper=touch(K.kakite_k.getObjectByName('brush-tip'),K.shojo_k.getObjectByName('letter-paper'))&&all(K.kakite_k,'hand').some(h=>touch(h,K.kakite_k.getObjectByName('held-brush')));
      ok.carriedObjectsAttached=['nihakobi_k','haizen_k','tsukai_k'].every((id,i)=>all(K[id],'hand').every(h=>touch(h,K[id].getObjectByName(['carried-box','carried-tray','folded-letter'][i]))));
      ok.seatedWriterCloth=all(K.kakite_k,'seated-hakama').length===2&&all(K.kakite_k,'seated-hakama').every(m=>m.material===K.kakite_k.getObjectByName('tailored-torso').material)&&Math.abs(bounds(K.kakite_k).min.y-.36)<.001;
      ok.seatedWriterKeepsHeadwear=K.kakite_k.userData.eboshi?.parent===K.kakite_k&&touch(K.kakite_k.userData.eboshi,K.kakite_k.getObjectByName('figure-head'))&&Math.abs(K.kakite_k.userData.eboshi.position.y+.46)<.001;
      ok.workGeometryShared=new Set(facilities.flatMap(g=>all(g,'work-post')).map(m=>m.geometry)).size===1;
      ok.actorRolesAndAnchors=Object.keys(anchors).length===4&&Object.values(anchors).every(a=>a.object.userData.contentRole===a.itemId&&interactables[a.itemId]);
      ok.noNewArcheryObstacles=facilities.every(g=>{const b=bounds(g);return b.max.z<0;});
      const oldY=groundH(-15,-4.1);ok.officeFloorAndStairs=oldY===.36&&groundH(-15,-3.05)>.1&&groundH(-15,-3.05)<.36;
      let x=0,z=7;const walk=points=>{for(const p of points){let c=0;while(Math.hypot(p[0]-x,p[1]-z)>.05&&c++<1600){const d=Math.hypot(p[0]-x,p[1]-z),s=Math.min(.1,d),r=walkMoveResolve(x,z,x+(p[0]-x)/d*s,z+(p[1]-z)/d*s);if(Math.hypot(r.x-x,r.z-z)<.00001)return false;x=r.x;z=r.z;}if(Math.hypot(p[0]-x,p[1]-z)>.1)return false;}return true;};
      ok.officeRoute=walk([[-12,7],[-12,-1],[-15,-1],[-15,-4.8]]);
      ok.kitchenRoute=walk([[-15,-1],[-12,-1],[-12,-13],[-7,-13],[-7,-16.6]]);
      ok.deliveryRoute=walk([[-7,-13],[10,-13],[20.5,-13],[20.5,-6.8],[24.3,-6.8]]);
      // The last route approaches the shed from its south: bypass the north back-wall.
      return ok;
    });
    for(const [name,ok]of Object.entries(result))check(ok,name);
    const lifecycle=await page.evaluate(async()=>{
      const {K}=KAMAKURA_WORLD,q=APP.kamaKyudo,ok={},original=spawnArrow,pending=[];
      spawnArrow=(from,to,onLand)=>pending.push(onLand);
      try{
        APP.view='orbit';K.kyudoStart();ok.practiceStartsFirstPerson=APP.view==='fp'&&Math.abs(camera.position.x-20)<.001&&Math.abs(camera.position.z-24.5)<.001;
        K.kyudoShoot();const old=pending.shift();K.kyudoStop(true);ok.previousViewRestored=APP.view==='orbit';K.kyudoStart();old();ok.oldArrowIgnored=q.score===0&&q.landed===0;
        for(let i=0;i<10;i++){q.cd=0;K.kyudoShoot();pending.shift()();}
        ok.tenShotsScheduleResult=q.landed===10&&q.resultTimer!==null;K.kyudoStop(true);K.kyudoStart();
        await new Promise(r=>setTimeout(r,710));ok.oldResultIgnored=q.active&&!q.resultOpen&&!K.isModalOpen()&&q.score===0;
        K.kyudoShoot();const late=pending.shift();enterMode('title');late();ok.modeExitCancels=!q.active&&q.landed===0&&q.resultTimer===null;
        enterMode('walk');K.kyudoStart();KAMAKURA_WORLD.world.visible=false;K.kyudoShoot();ok.hiddenWorldCannotShoot=q.fired===0;K.kyudoStop(true);KAMAKURA_WORLD.world.visible=true;
      }finally{spawnArrow=original;K.kyudoStop(true);KAMAKURA_WORLD.world.visible=true;}
      return ok;
    });
    for(const [name,ok]of Object.entries(lifecycle))check(ok,name);
    // Exercise production animate, not a blanket scene-root cleanup. Seed stale visible states so these checks cannot pass just because startup hid them.
    const isolation=await page.evaluate(()=>{
      const ok={},heian=[...creatures.oni.map(o=>o.g),...creatures.shiki.map(o=>o.g),...creatures.yokai.map(o=>o.g),creatures.seimei?.g].filter(Boolean);
      const spirits=typeof SHISHIN==='undefined'?[]:SHISHIN,originalPos=player.pos.clone(),originalView=APP.view;
      const runPhase=time=>{
        setTime(time);AUTO_TIME._paused=true;APP_FPSCAP=0;
        const target=TIMES[time];for(const k of ['sky','fog','sunC','ambC'])cur[k].set(target[k]);for(const k of ['sunI','hemi','amb','moon','exp','int'])cur[k]=target[k];cur.sunP.set(...target.sunP);
        for(let i=0;i<12;i++){clock.running=true;clock.oldTime=performance.now()-100;window.__kamaContentFrame=Math.max(window.__kamaContentFrame||0,performance.now())+100;window.__SHINDEN_BENCH_PAUSE=false;animate(window.__kamaContentFrame);window.__SHINDEN_BENCH_PAUSE=true;}
      };
      enterMode('walk');KAMAKURA_WORLD.K.kyudoStop(true);APP.view='fp';
      heian.forEach(g=>g.visible=true);
      const revealed=spirits.map(s=>s.revealed);spirits.forEach(s=>{s.base=.4;s.g.visible=true;if(s.shadow)s.shadow.visible=true;});
      if(spirits.length)player.pos.set(spirits[0].px,1.62,spirits[0].pz);
      runPhase('night');
      ok.nightForeignActorsStayHidden=heian.length>0&&heian.every(g=>!g.visible);
      ok.foreignSpiritsStayHidden=spirits.length>0&&spirits.every((s,i)=>!s.g.visible&&(!s.shadow||!s.shadow.visible)&&s.revealed===revealed[i]);
      if(sparrowChase.child)sparrowChase.child.visible=true;if(sparrowChase.flock)sparrowChase.flock.visible=true;
      runPhase('day');
      ok.dayChildAndFlockStayHidden=!!sparrowChase.child&&!!sparrowChase.flock&&!sparrowChase.child.visible&&!sparrowChase.flock.visible;
      const before=scene.children.filter(o=>o.userData.estateVisitor).length;
      ok.heianArrivalEntryRefused=!!window.LIVING_ESTATE&&['visitor','messenger','oxCart'].every(type=>LIVING_ESTATE.triggerArrival(type)===false);
      LIVING_ESTATE.update(.1,clock.elapsedTime+30);
      ok.noHeianVisitorSpawned=before===0&&scene.children.filter(o=>o.userData.estateVisitor).length===0&&!LIVING_ESTATE.status.activeArrival;
      ok.kamakuraRootsRemainVisible=KAMAKURA_WORLD.world.visible&&KAMAKURA_WORLD.contentIds.every(id=>interactables[id].roots.some(isObjVisible));
      player.pos.copy(originalPos);APP.view=originalView;return ok;
    });
    for(const [name,ok]of Object.entries(isolation))check(ok,name);
    // Read the visible codex, and verify that the role can lead to the integrated game through its actual dialog button.
    await page.evaluate(()=>{enterMode('walk');showInfo('magemono');});
    check((await page.locator('body').innerText()).includes('薄い木の板を曲げて'),'visible bentwood explanation');
    await page.evaluate(()=>{if(typeof closeInfo==='function')closeInfo();const m=KAMAKURA_WORLD.K.kakite_k.getObjectByName('tailored-torso');KAMAKURA_WORLD.K.pickHook({object:m});});
    if(await page.getByRole('button',{name:'書付を照合する',exact:true}).count()){
      await page.getByRole('button',{name:'書付を照合する',exact:true}).click();
      check(await page.locator('body').textContent().then(t=>t.includes('照合')),'role dialog opens correspondence activity');
      await page.keyboard.press('Escape');
    }else check(await page.getByRole('button',{name:'この人の仕事を見る',exact:true}).count()===1,'role dialog has codex fallback');
    await page.evaluate(()=>KAMAKURA_WORLD.K.closeModal());
    fs.mkdirSync(out,{recursive:true});
    const views=[['documents',[-12,2.5,-2.4],[-15.4,1,-6.2]],['writing-close',[-14.2,1.6,-4.8],[-15.55,.95,-6.65]],['deliveries',[21.5,2.5,-5.6],[24,1,-10]],['serving',[-4,2.4,-14.7],[-7,1,-19]],['life-overview',[-29,22,7],[0,0,-10]]];
    for(const [name,pos,target]of views){const png=await page.evaluate(({pos,target})=>{camera.position.set(...pos);camera.lookAt(...target);camera.updateMatrixWorld(true);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png').split(',')[1];},{pos,target});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(png,'base64'));}
    check(errors.length===0,'no browser or shader errors: '+errors.join(' | '));
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'ok',passed,views},null,2));console.log(JSON.stringify({status:'ok',passed},null,2));
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
