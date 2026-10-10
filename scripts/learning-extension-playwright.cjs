/* End-to-end learning checks. Serves current learning sources in memory; never writes application HTML. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/learning');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
let html=read('寝殿造り3D探訪_統合版.html');
const sourceFiles=['codex-media','codex-viewer','waka-notes','learning-extension'];
const manifest=JSON.parse(read('scripts/app-manifest.json')),missing=[];
for(const name of sourceFiles){
  const m=manifest.find(m=>m.name===name),source=read(`src/app/${name}.js`);
  if(m&&html.includes(m.begin)&&html.includes(m.end)){
    const begin=html.indexOf(m.begin)+m.begin.length,end=html.indexOf(m.end,begin);html=html.slice(0,begin)+'\n'+source+'\n'+html.slice(end);
  }else missing.push(source);
}
const endViewer='/* APP_CODEX_VIEWER_EMBED_END */';
assert(html.includes(endViewer));html=html.replace(endViewer,endViewer+'\n'+missing.join('\n'));
html=html.replace('</style>',read('src/app/learning-extension.css')+'\n</style>');
const notes=require('../src/app/waka-notes.js');
assert.equal(notes.length,11);assert(notes.every(n=>n.verified?.source.startsWith('https://lapis.nichibun.ac.jp/waka/')&&n.verified.scope));
assert(!notes.find(n=>n.id==='waka_au10').gihō.some(r=>r.type==='係り結び'));
assert(!notes.find(n=>n.id==='waka_au1').haikei.includes('六歌仙'));
const inline=vm.runInNewContext(read('src/app/codex-media.js')+';CODEX_MEDIA'),credits=JSON.parse(read('assets/codex/credits.json'));
assert.equal(inline.length,13);assert.equal(new Set(inline.flatMap(m=>m.items)).size,14);
for(const m of inline){const bytes=fs.readFileSync(path.join(root,m.src));assert.deepEqual(Buffer.from(m.dataUrl.split(',')[1],'base64'),bytes);assert.equal(m.bytes,bytes.length);assert.equal(bytes.readUInt16BE(0),0xffd8);assert(credits.some(c=>c.id===m.id&&c.caption===m.caption));}
assert(inline.find(m=>m.id==='byoubu').caption.includes('右端二面'));assert(inline.find(m=>m.id==='ryuteki').caption.includes('下段'));
const errors=[],passed=['eleven annotations have field-scoped primary text references and known annotation errors are corrected','thirteen photographs cover fourteen items and match their offline data URLs byte for byte'];
function check(ok,text){assert(ok,text);passed.push(text);console.log('PASS',text);}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);return;}
    const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',path.extname(file)==='.jpg'?'image/jpeg':'application/octet-stream');fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
    const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER',e.message);});
    await page.addInitScript(()=>{window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};localStorage.setItem('shinden3d-onboard-v1','1');});
    await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load',timeout:120000});
    await page.waitForFunction(()=>typeof LEARNING_EXTENSION!=='undefined'&&typeof CODEX_VIEWER!=='undefined',{timeout:120000});
    await page.evaluate(()=>{window.__SHINDEN_BENCH_PAUSE=true;enterMode('walk');for(const id of ['kichou','byoubu','koto','biwa','ryuteki','misu','waka_au10','waka_sp3'])codexUnlocked.add(id);LEARNING_EXTENSION.refresh();});
    const denied=await page.evaluate(()=>{
      const set=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Test storage unavailable','QuotaExceededError');};
      try{LEARNING_EXTENSION.recordAnswer('byoubu',true,'byoubu');return{memory:LEARNING_EXTENSION.records.byoubu.correct===1,warning:!LEARNING_EXTENSION.storageOK&&document.getElementById('learningReviewStatus').textContent.includes('今回の起動中')};}
      finally{Storage.prototype.setItem=set;}
    });
    check(denied.memory&&denied.warning,'unavailable storage retains this-session answers and tells the user their save is unavailable');
    const dates=await page.evaluate(()=>{
      const L=LEARNING_EXTENSION,n=new Date(2026,11,31,23,30).getTime(),tomorrow=new Date(2027,0,1,12).getTime();
      L.recordAnswer('kichou',true,'kichou',false,n);const first=L.records.kichou;
      L.recordAnswer('kichou',true,'kichou',false,n);const same=L.records.kichou;
      L.recordAnswer('kichou',true,'kichou',false,tomorrow);const next=L.records.kichou;
      L.recordAnswer('kichou',false,'byoubu',false,tomorrow);const wrong=L.records.kichou;
      const corrupt=L.sanitize({kichou:{...wrong,due:'2027-02-31'},missing:wrong,byoubu:{...wrong,lastAnswered:NaN}});
      return{first,same,next,wrong,corrupt:Object.keys(corrupt),rollover:L.addDays(new Date(2028,1,28),1)};
    });
    check(dates.first.due==='2027-01-01'&&dates.first.streak===1&&dates.same.streak===1&&dates.next.due==='2027-01-04'&&dates.next.streak===2&&dates.wrong.due==='2027-01-02'&&dates.wrong.streak===0&&dates.corrupt.length===0&&dates.rollover==='2028-02-29','calendar-day spacing crosses year and leap-day boundaries, resists same-day farming and corrupt records, resets on an error');
    const restore=await page.evaluate(()=>{
      openCodex();CODEX_VIEWER.open('kichou');CODEX_VIEWER.compare('byoubu');CODEX_VIEWER.render();CODEX_VIEWER.close();
      const vis=new Map(),transforms=new Map();scene.traverse(o=>{vis.set(o,o.visible);transforms.set(o,JSON.stringify([o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()]));});
      const memory=renderer.info.memory.geometries,viewport=renderer.getViewport(new THREE.Vector4()).toArray();
      CODEX_VIEWER.open('kichou');const comparison=CODEX_VIEWER.compare('byoubu');CODEX_VIEWER.rotate(.4);CODEX_VIEWER.zoom(.8);CODEX_VIEWER.render();
      const selects=[...document.querySelectorAll('#viewerCompareSelect option')].map(o=>o.value).filter(Boolean),label=document.getElementById('viewerCompareLabels').textContent;
      CODEX_VIEWER.close();let original=true;scene.traverse(o=>{original=original&&vis.get(o)===o.visible&&transforms.get(o)===JSON.stringify([o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()]);});
      return{comparison,label,original,sameMemory:renderer.info.memory.geometries===memory,oneCanvas:document.querySelectorAll('#c').length===1,viewport:JSON.stringify(renderer.getViewport(new THREE.Vector4()).toArray())===JSON.stringify(viewport),locked:!selects.includes('gissha')&&!CODEX_VIEWER.open('gissha'),active:CODEX_VIEWER.active,codex:APP.codexOpen};
    });
    console.log('RESTORE',JSON.stringify(restore));
    check(restore.comparison&&restore.label.includes('几帳')&&restore.label.includes('屏風')&&restore.original&&restore.sameMemory&&restore.oneCanvas&&restore.viewport&&restore.locked&&!restore.active&&restore.codex,'two original models share one renderer without allocation, restore every visibility and transform, and exclude undiscovered choices');
    await page.evaluate(()=>{CODEX_VIEWER.open('kichou');CODEX_VIEWER.compare('byoubu');});
    await page.screenshot({path:path.join(out,'two-model-comparison.png')});
    await page.evaluate(()=>{CODEX_VIEWER.close();codexShowDetail('waka_au10');});
    await page.locator('#codexDetail .waka-deep-notes summary').click();
    check(await page.locator('#codexDetail .waka-deep-notes').count()===1&&await page.locator('#codexDetail').innerText().then(t=>t.includes('推量と詠嘆')&&t.includes('国際日本文化研究センター')),'discovered waka detail exposes the connected layered notes and primary text source');
    const waka=await page.evaluate(()=>{setCodexTab('waka');const list=document.getElementById('wakaList');return{notes:list.querySelectorAll('.waka-deep-notes').length,locked:[...list.querySelectorAll('.waka-row.locked')].every(row=>!row.querySelector('.waka-deep-notes')&&!row.querySelector('[data-rel]:not(:disabled)'))};});
    check(waka.notes===2&&waka.locked,'waka collection attaches notes to collected poems and does not disclose locked poem details');
    await page.evaluate(()=>{setCodexTab('main');CODEX_VIEWER.open('byoubu','photo');});
    await page.waitForFunction(()=>document.getElementById('viewerPhoto').complete&&document.getElementById('viewerPhoto').naturalWidth>0);
    check(await page.locator('#viewerPhotoCaption').innerText().then(t=>t.includes('右端二面')&&t.includes('CC0')),'new screen photo loads from local assets with the correct partial-image caption and rights');
    await page.click('#viewerPhotoZoom');
    check(await page.evaluate(()=>document.getElementById('viewerPhoto').getBoundingClientRect().width>=1100&&document.getElementById('viewerPhotoZoom').getAttribute('aria-pressed')==='true'),'photo zoom exposes a scrollable enlarged image and its pressed state');
    await page.evaluate(()=>{CODEX_VIEWER.close();CODEX_VIEWER.open('ryuteki','photo');document.getElementById('viewerPhoto').src='missing-test-file.jpg';});
    await page.waitForFunction(()=>document.getElementById('viewerPhoto').src.startsWith('data:image/jpeg')&&document.getElementById('viewerPhoto').complete&&document.getElementById('viewerPhoto').naturalWidth>0);
    check(await page.locator('#viewerPhotoCaption').innerText().then(t=>t.includes('下段')&&t.includes('CC BY-SA 2.0')),'new flute photo uses its embedded offline fallback and distinguishes the flute from the other displayed instrument');
    await page.evaluate(()=>{document.getElementById('viewerLearningContext').open=true;});
    const links=await page.evaluate(()=>{
      const id='ryuteki',related=document.getElementById('viewerLearningRelated'),difference=document.getElementById('viewerLearningDifference').textContent;
      const koto=related.querySelector('[data-rel="koto"]'),locked=related.querySelector('[data-rel="sho"]');return{found:!!koto&&!koto.disabled,locked:!!locked&&locked.disabled&&!locked.textContent.includes('笙'),difference:difference.includes('高麗笛')&&difference.includes('19世紀')};
    });
    await page.locator('#viewerLearningRelated [data-rel="koto"]').click();
    check(links.found&&links.locked&&links.difference&&await page.evaluate(()=>!CODEX_VIEWER.active&&document.getElementById('codexDetail').textContent.includes('箏')),'comparison caveats distinguish the pictured species/era and related-item links navigate while locked names remain concealed');
    const review=await page.evaluate(()=>{
      CODEX_VIEWER.close();const now=new Date();now.setDate(now.getDate()-5);LEARNING_EXTENSION.recordAnswer('kichou',false,'byoubu',false,now.getTime());const due=LEARNING_EXTENSION.dueIds();
      const start=LEARNING_EXTENSION.startReview(),q=APP.quiz,want=q.qs[q.i],before=LEARNING_EXTENSION.records[want];quizAnswer('byoubu'===want?'biwa':'byoubu');const afterWrong=LEARNING_EXTENSION.records[want];quizAnswer(want);const after=LEARNING_EXTENSION.records[want];
      return{due,start,review:q.review,after,before,afterWrong,target:want};
    });
    check(review.due.includes('kichou')&&review.start&&review.review&&review.after.incorrect===review.before.incorrect+1&&review.after.correct===review.before.correct+1&&review.after.streak===0&&review.afterWrong.lastChosen==='byoubu','due review starts the actual quiz and records wrong and correct submissions with next-day rescheduling');
    const identify=await page.evaluate(()=>{
      enterMode('walk');const start=LEARNING_EXTENSION.startIdentification(['kichou','byoubu']);const q=APP.quiz,want=q.qs[q.i];
      const texts=[document.getElementById('codexViewerTitle').textContent,document.getElementById('viewerGameNote').textContent,document.getElementById('quizTarget').textContent];
      const hidden=!document.getElementById('viewerLearningContext').getClientRects().length&&!document.getElementById('viewerCompareBar').getClientRects().length&&!document.getElementById('viewerGameTab').getClientRects().length;
      const choices=[...document.querySelectorAll('#viewerQuestion [data-model-answer]')].map(b=>b.dataset.modelAnswer);quizAnswer(choices.find(id=>id!==want));const wrong=CODEX_VIEWER.question&&document.getElementById('viewerQuestionFeedback').textContent.includes('形');quizAnswer(want);
      return{start,hidden,texts,choices,want,wrong,locked:q.lock,closed:!CODEX_VIEWER.active,codex:APP.codexOpen,scored:q.score>0};
    });
    check(identify.start&&identify.hidden&&identify.choices.includes(identify.want)&&!identify.texts.join('').includes('几帳')&&!identify.texts.join('').includes('屏風')&&identify.wrong&&identify.locked&&identify.closed&&!identify.codex&&identify.scored,'identification hides location and answer disclosures, uses shuffled discovered names, and drives the real quiz scoring');
    await page.evaluate(()=>{updateModeTasks(960);});
    check(await page.evaluate(()=>CODEX_VIEWER.question&&APP.quiz.i===1),'answer completion advances through the real mode scheduler into the next model question');
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'model-identification-mobile.png')});
    const mobile=await page.evaluate(()=>{const d=document.getElementById('codexViewer').getBoundingClientRect(),buttons=[...document.querySelectorAll('#viewerQuestion button')];return{fits:d.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth,targets:buttons.every(b=>b.getBoundingClientRect().height>=44),answer:APP.quiz.qs[APP.quiz.i]};});
    check(mobile.fits&&mobile.targets,'mobile identification fits the viewport and maintains 44-pixel answer targets');
    await page.keyboard.press('Escape');check(await page.evaluate(()=>!CODEX_VIEWER.active&&APP.mode==='walk'&&!APP.quiz&&!APP.codexOpen),'Escape cancels model identification and restores playable walk mode');
    const beforeReload=await page.evaluate(()=>LEARNING_EXTENSION.records.kichou);
    await page.reload({waitUntil:'load',timeout:120000});await page.waitForFunction(()=>typeof LEARNING_EXTENSION!=='undefined');
    check(await page.evaluate(value=>JSON.stringify(LEARNING_EXTENSION.records.kichou)===JSON.stringify(value),beforeReload),'answer counts and review date survive reload on the same origin');
    check(errors.length===0,'no browser JavaScript exceptions');
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed,errors},null,2));console.log(`${passed.length} learning checks passed`);
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
