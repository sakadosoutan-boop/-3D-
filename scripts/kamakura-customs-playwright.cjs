const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts/kamakura-customs'),checks=[],errors=[];
function check(ok,name){assert.ok(ok,name);checks.push(name);}
(async()=>{
  const server=http.createServer((req,res)=>{
    const name=decodeURIComponent(new URL(req.url,'http://local').pathname),file=path.resolve(root,name==='/'?'寝殿造り3D探訪_統合版.html':'.'+name);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
    const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};localStorage.setItem('shinden3d-onboard-v1','1');});
    await page.goto(`http://127.0.0.1:${server.address().port}/?map=kamakura&adaptive=0`,{waitUntil:'load'});
    await page.waitForFunction(()=>typeof KAMAKURA_CUSTOMS!=='undefined'&&KAMAKURA_CUSTOMS.state.ready);
    await page.evaluate(()=>{enterMode('walk');hideModeBrief(true);onboardClose();player.pos.set(-15,1.98,-4.8);KAMAKURA_CUSTOMS.update();});
    await page.locator('#kamaLettersPrompt').click();
    check(await page.evaluate(()=>KAMAKURA_CUSTOMS.state.active&&gameplayInputBlocked()),'nearby entry opens and blocks estate input');
    check(await page.locator('#kamaLetters').innerText().then(t=>t.includes('創作文')&&t.includes('史料')),'fiction and evidence explained');
    const deal=await page.evaluate(()=>KAMAKURA_CUSTOMS.state.rounds);
    check(deal.length===6&&deal.filter(r=>r.field).length===3&&new Set(deal.filter(r=>r.field).map(r=>r.field)).size===3,'six letters exercise all three comparison skills');
    for(let i=0;i<6;i++){
      await page.locator('#kamaLetters [data-action="'+(deal[i].field?'return':'accept')+'"]').click();
      check(await page.locator('.kc-feedback').innerText().then(s=>s.includes('よく確かめました')),'practice explanation '+(i+1));
      await page.locator('#kamaLetters [data-action="next"]').click();
    }
    check(await page.locator('.kc-result').innerText().then(t=>t.includes('6 / 6')),'complete practice review');
    await page.locator('#kamaLetters [data-action="retry"]').click();
    const main=await page.evaluate(()=>KAMAKURA_CUSTOMS.state.rounds);
    check(await page.evaluate(()=>!KAMAKURA_CUSTOMS.state.practice)&&await page.locator('.kc-different').count()===0,'main exercise removes guide');
    for(let i=0;i<6;i++){
      const accept=i===0?!!main[i].field:!main[i].field;
      await page.locator('#kamaLetters [data-action="'+(accept?'accept':'return')+'"]').click();
      if(i===0)check(await page.locator('.kc-feedback').innerText().then(s=>s.includes('読み違い')),'wrong answer gives exact discrepancy');
      await page.locator('#kamaLetters [data-action="next"]').click();
    }
    check(await page.evaluate(()=>KAMAKURA_CUSTOMS.state.score===5&&localStorage.getItem('kamakura-letter-best')==='5'),'score and best persist');
    await page.locator('#kamaLetters [data-action="close"]').last().click();
    check(await page.evaluate(()=>!KAMAKURA_CUSTOMS.state.active&&!document.body.classList.contains('kamakura-customs-mode')&&!gameplayInputBlocked()),'close restores input');
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>KAMAKURA_CUSTOMS.open(false));
    check(await page.evaluate(()=>document.querySelector('#kamaLetters .kc-frame').scrollWidth<=document.querySelector('#kamaLetters .kc-frame').clientWidth+1),'390px no horizontal overflow');
    await page.keyboard.press('Shift+Tab');
    check(await page.evaluate(()=>document.querySelector('#kamaLetters').contains(document.activeElement)),'keyboard focus remains in dialogue');
    fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'letters-mobile.png')});
    await page.keyboard.press('Escape');check(await page.evaluate(()=>!KAMAKURA_CUSTOMS.state.active),'Escape closes');
    await page.evaluate(()=>{KAMAKURA_CUSTOMS.open(false);enterMode('title');});
    check(await page.evaluate(()=>!KAMAKURA_CUSTOMS.state.active&&APP.mode==='title'),'mode transition closes');
    await page.evaluate(()=>{enterMode('walk');KAMAKURA_CUSTOMS.open(false);APP.kamaKyudo.active=true;KAMAKURA_CUSTOMS.update();APP.kamaKyudo.active=false;});
    check(await page.evaluate(()=>!KAMAKURA_CUSTOMS.state.active),'archery ownership excludes document game');
    check(!errors.length,'no browser exceptions: '+errors.join(' | '));
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({status:'ok',checks},null,2));console.log(JSON.stringify({status:'ok',checks},null,2));
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
