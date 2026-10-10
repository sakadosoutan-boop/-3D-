/* Actual mode round-trips without navigation/reload. Warm-up samples are separate from leak measurements. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/selected-memory');
const cycles=Math.max(20,Number(process.env.MEMORY_CYCLES)||24),warmups=Math.max(3,Number(process.env.MEMORY_WARMUPS)||4);
const errors=[],samples=[],events=[];
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,pathname==='/'?'寝殿造り3D探訪_統合版.html':'.'+pathname);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    const types={'.html':'text/html;charset=utf-8','.jpg':'image/jpeg','.glb':'model/gltf-binary','.js':'text/javascript','.mp3':'audio/mpeg'};
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--enable-precise-memory-info']});
    const page=await browser.newPage({viewport:{width:960,height:640}}),cdp=await page.context().newCDPSession(page);
    await cdp.send('HeapProfiler.enable');
    await page.addInitScript(()=>{window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};localStorage.setItem('shinden3d-onboard-v1','1');localStorage.setItem('shinden3d-kaiawase-help','1');});
    page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER',e.message);});
    let navigations=0;page.on('framenavigated',f=>{if(f===page.mainFrame())navigations++;});
    await page.goto(`http://127.0.0.1:${server.address().port}/?adaptive=0&eco=off`,{waitUntil:'load',timeout:120000});
    await page.waitForFunction(()=>typeof window.returnToTitle==='function'&&typeof CODEX_VIEWER!=='undefined'&&typeof SELECTED_PERFORMANCE!=='undefined');
    await page.evaluate(()=>{
      GFX.setPreset('low');GFX.setBloom('off');APP_FPSCAP=0;AUTO_TIME._paused=true;
      for(const id of ['kichou','byoubu','ryuteki'])codexUnlocked.add(id);
      window.__memoryDisposals={geometries:0,textures:0,materials:0};
      window.__memoryGPU={geometries:new Map(),textures:new Map()};window.__memoryResourceOrigins={geometries:new Map(),textures:new Map()};
      // r128 registers a GPU resource by attaching its dispose listener. Track IDs and metadata, not objects.
      for(const [prototype,key]of [[THREE.BufferGeometry.prototype,'geometries'],[THREE.Texture.prototype,'textures']]){
        const add=prototype.addEventListener;prototype.addEventListener=function(type,listener){if(type==='dispose'&&!__memoryGPU[key].has(this.id))__memoryGPU[key].set(this.id,__memoryResourceOrigins[key].get(this.id)||{owner:'world-or-cache',type:this.type||'Texture'});return add.apply(this,arguments);};
      }
      for(const [prototype,key]of [[THREE.BufferGeometry.prototype,'geometries'],[THREE.Texture.prototype,'textures'],[THREE.Material.prototype,'materials']]){
        const dispose=prototype.dispose;prototype.dispose=function(){window.__memoryDisposals[key]++;if(__memoryGPU[key])__memoryGPU[key].delete(this.id);return dispose.apply(this,arguments);};
      }
      window.__memoryTrackOwners=()=>{
        const sharedG=new Set(Object.values(HEIAN_GEO));if(HEIAN_FINGER_GEO)sharedG.add(HEIAN_FINGER_GEO);if(typeof HEIAN_SHAKU_GEO!=='undefined'&&HEIAN_SHAKU_GEO)sharedG.add(HEIAN_SHAKU_GEO);
        for(const cache of Object.values(GEO_CACHE))for(const g of cache.values())sharedG.add(g);
        const sharedT=new Set();for(const m of [...Object.values(MAT),...HEIAN_MATS.values()])for(const v of Object.values(m))if(v?.isTexture)sharedT.add(v);
        for(const label of _labelTexCache.values())sharedT.add(label.tex);
        const spirits=new Set(APP.taiji?.spirits?.map(s=>s.g)||[]);
        scene.traverse(o=>{
          let owner='world-or-cache';for(let p=o;p;p=p.parent){if(p===window.RENAI_SIM_STAGE){owner='renai';break;}if(spirits.has(p)){owner='taiji';break;}}
          if(o.geometry)__memoryResourceOrigins.geometries.set(o.geometry.id,{owner:sharedG.has(o.geometry)||o.isSprite?'world-or-cache':owner,type:o.geometry.type,node:o.name||o.type});
          for(const m of [].concat(o.material||[]))for(const t of Object.values(m))if(t?.isTexture)__memoryResourceOrigins.textures.set(t.id,{owner:sharedT.has(t)?'world-or-cache':owner,type:t.type||'Texture',node:o.name||o.type});
        });
      };
      window.__memoryStep=()=>{__memoryTrackOwners();window.__SHINDEN_BENCH_PAUSE=false;animate(performance.now());window.__SHINDEN_BENCH_PAUSE=true;};
      window.__memorySnapshot=()=>{
        let sceneObjects=0;const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{sceneObjects++;if(o.geometry)geometries.add(o.geometry);for(const m of [].concat(o.material||[])){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
        const gpu={};for(const [key,map]of Object.entries(__memoryGPU)){gpu[key]={world:[...map].filter(([,meta])=>meta.owner==='world-or-cache').map(([id])=>id),dynamic:[...map].filter(([,meta])=>meta.owner!=='world-or-cache').map(([id,meta])=>({id,...meta}))};}
        const domContainers={};for(const id of ['kaiBoard','rnChoices','renaiTargetPicker','ukHand','codex','codexViewer','homeNext'])domContainers[id]=document.getElementById(id)?.querySelectorAll('*').length||0;
        return{mode:APP.mode,webglGeometries:renderer.info.memory.geometries,webglTextures:renderer.info.memory.textures,gpu,sceneObjects,liveSceneGeometries:geometries.size,liveSceneMaterials:materials.size,liveSceneTextures:textures.size,rayTargets:rayTargets.length,floorZones:floorZones.length,expressions:HEIAN_EXPRESSIONS.length,dom:document.querySelectorAll('*').length,domContainers,kaiawaseDOMCards:document.querySelectorAll('#kaiBoard .kai-card').length,disposals:{...window.__memoryDisposals},renaiStage:!!window.RENAI_SIM_STAGE,utakaiStage:!!window.UTAKAI_STAGE,kaiawaseTimer:!!KAI_TIMER,taiji:!!APP.taiji,codex:APP.codexOpen,viewer:CODEX_VIEWER.active};
      };
      window.returnToTitle();__memoryStep();
    });
    const snapshot=async(label,index)=>{await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage');const s=await page.evaluate(()=>__memorySnapshot());const sample={label,index,heapBytes:heap.usedSize,...s};samples.push(sample);return sample;};
    await snapshot('cold',-1);
    for(let index=0;index<warmups+cycles;index++){
      const event=await page.evaluate(async(index)=>{
        const ok={},oldDisposals={...__memoryDisposals},stages=[],marks=[];
        const condition={difficulty:index%2?'normal':'easy',target:RENAI_TARGETS[index%RENAI_TARGETS.length].id};
        const mark=label=>{const s=__memorySnapshot();marks.push({label,geom:s.webglGeometries,tex:s.webglTextures,objects:s.sceneObjects,expressions:s.expressions,disposals:s.disposals});};mark('before');
        enterMode('walk');hideModeBrief(true);__memoryStep();ok.walk=APP.mode==='walk';mark('walk');
        enterMode('taiji');hideModeBrief(true);__memoryStep();ok.taiji=!!APP.taiji&&APP.taiji.spirits.length>0;
        stages.push(...APP.taiji.spirits.map(sp=>sp.g));mark('taiji');
        // Execute the actual quit handler before choosing the next mode, as the topbar does.
        document.getElementById('tjQuit').click();ok.taijiRemoved=stages.every(g=>!g.parent)&&!APP.taiji;mark('taiji-exit');
        enterMode('renaiSim');renaiPickTarget(RENAI_TARGETS[index%RENAI_TARGETS.length],'sim');
        if(!window.RENAI_SIM_STAGE){const newButton=[...document.querySelectorAll('#rnChoices button')].find(b=>b.textContent.includes('最初から'));if(newButton)newButton.click();}
        __memoryStep();const renai=window.RENAI_SIM_STAGE;ok.renai=!!renai&&APP.renai?.phase==='hub';mark('renai');
        enterMode('kaiawase');kaiChooseDifficulty(condition.difficulty);condition.cards=KAI?.cards.length||0;ok.renaiRemoved=!!renai&&!renai.parent&&!window.RENAI_SIM_STAGE;
        ok.kaiawase=!!KAI&&KAI.cards.length>0&&!!KAI_TIMER;mark('renai-exit-kaiawase');
        document.querySelector('#kaiBoard .kai-card')?.click();
        enterMode('utakai');hideModeBrief(true);if(typeof ukHideCut==='function')ukHideCut();__memoryStep();ok.kaiawaseStopped=!KAI&&!KAI_TIMER;ok.utakai=!!APP.utakai&&!!window.UTAKAI_STAGE;mark('utakai');
        enterMode('walk');hideModeBrief(true);openCodex();CODEX_VIEWER.open('kichou');CODEX_VIEWER.compare('byoubu');CODEX_VIEWER.render();ok.codexModel=CODEX_VIEWER.active&&CODEX_VIEWER.comparison==='byoubu';
        mark('codex-model');CODEX_VIEWER.setTab('photo');const img=document.getElementById('viewerPhoto');
        await new Promise(resolve=>{if(img.complete)resolve();else{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});}});ok.codexPhoto=img.naturalWidth>0;
        window.returnToTitle();__memoryStep();mark('title');
        ok.title=APP.mode==='title'&&!document.getElementById('title').classList.contains('hide');
        ok.closed=!CODEX_VIEWER.active&&!APP.codexOpen&&!document.getElementById('codex').classList.contains('open');
        ok.states=!APP.taiji&&!APP.renai&&!APP.utakai&&!KAI&&!KAI_TIMER&&!window.RENAI_SIM_STAGE&&!window.UTAKAI_STAGE?.visible;
        return{index,condition,ok,marks,disposals:{geometries:__memoryDisposals.geometries-oldDisposals.geometries,textures:__memoryDisposals.textures-oldDisposals.textures,materials:__memoryDisposals.materials-oldDisposals.materials}};
      },index);
      events.push(event);await page.waitForTimeout(300);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const sample=await snapshot(index<warmups?'warmup':'measured',index);sample.condition=event.condition;
      console.log(`${sample.label} ${index+1}/${warmups+cycles}: objects=${sample.sceneObjects} geom=${sample.webglGeometries} tex=${sample.webglTextures} heap=${(sample.heapBytes/1048576).toFixed(1)}MiB disposeG=${event.disposals.geometries} init/cleanup=${Object.values(event.ok).every(Boolean)}`);
    }
    await page.screenshot({path:path.join(out,'round-trips-title.png')});
    const measured=samples.filter(s=>s.label==='measured'),first=measured[0],last=measured[measured.length-1],metrics={};
    for(const key of ['webglGeometries','webglTextures','sceneObjects','liveSceneGeometries','liveSceneMaterials','liveSceneTextures','rayTargets','floorZones','expressions','dom','heapBytes']){
      const values=measured.map(s=>s[key]);metrics[key]={first:first[key],last:last[key],growth:last[key]-first[key],range:Math.max(...values)-Math.min(...values)};
    }
    const lazyWorld={};for(const key of ['geometries','textures']){const initial=new Set(first.gpu[key].world);lazyWorld[key]={newWorldIds:last.gpu[key].world.filter(id=>!initial.has(id)),dynamicRetained:measured.flatMap(s=>s.gpu[key].dynamic)};}
    const groups=new Map();for(const sample of measured){const key=sample.condition.difficulty+'|'+sample.condition.target;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(sample);}
    const domConditions=[...groups].map(([condition,rows])=>{
      const dom=rows.map(r=>r.dom),containerMetrics={};for(const id of Object.keys(rows[0].domContainers)){const values=rows.map(r=>r.domContainers[id]);containerMetrics[id]={first:values[0],last:values[values.length-1],range:Math.max(...values)-Math.min(...values)};}
      return{condition,samples:rows.length,cards:rows[0].condition.cards,dom:{first:dom[0],last:dom[dom.length-1],growth:dom[dom.length-1]-dom[0],range:Math.max(...dom)-Math.min(...dom)},containerMetrics};
    });
    const easyBoards=measured.filter(s=>s.condition.difficulty==='easy').map(s=>s.domContainers.kaiBoard),normalBoards=measured.filter(s=>s.condition.difficulty==='normal').map(s=>s.domContainers.kaiBoard);
    const domExplanation={easyCards:12,normalCards:16,easyBoardNodes:[...new Set(easyBoards)],normalBoardNodes:[...new Set(normalBoards)],nodesPerExtraCard:(normalBoards[0]-easyBoards[0])/4};
    const checks={noReload:navigations===1,noExceptions:errors.length===0,allInitializationAndCleanup:events.every(e=>Object.values(e.ok).every(Boolean)),geometryStable:metrics.webglGeometries.growth<=lazyWorld.geometries.newWorldIds.length&&lazyWorld.geometries.dynamicRetained.length===0,textureStable:metrics.webglTextures.growth<=lazyWorld.textures.newWorldIds.length&&lazyWorld.textures.dynamicRetained.length===0,sceneStable:metrics.sceneObjects.growth<=2&&metrics.sceneObjects.range<=5,registriesStable:metrics.rayTargets.growth===0&&metrics.floorZones.growth===0&&metrics.expressions.growth===0,heapStable:metrics.heapBytes.growth<=8*1048576,domStablePerCondition:domConditions.length>=2&&domConditions.every(g=>g.samples>=2&&g.dom.growth===0&&g.dom.range===0&&Object.values(g.containerMetrics).every(m=>m.range===0)),domBoardMatchesDifficulty:measured.every(s=>s.kaiawaseDOMCards===s.condition.cards)&&new Set(easyBoards).size===1&&new Set(normalBoards).size===1&&normalBoards[0]-easyBoards[0]===metrics.dom.range};
    const report={ranAt:new Date().toISOString(),warmups,cycles,navigations,checks,metrics,lazyWorld,domConditions,domExplanation,samples,events,errors,notes:'GC-assisted JS heap is Chromium retained heap, not total process/GPU memory. First render warm-up is excluded; late world/cache GPU registrations are identified by resource ID. DOM is compared after 300ms and two animation frames within identical difficulty/target conditions, with zero range required.'};
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks,metrics,domConditions,domExplanation},null,2));
    assert(Object.values(checks).every(Boolean),'Memory or cleanup regression; see artifacts/selected-memory/report.json');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
