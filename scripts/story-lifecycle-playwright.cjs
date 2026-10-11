/* Browser-only instrumentation captures the private manager for an ending race.
 * Production sources and the generated HTML never receive this testing global. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),passed=[],errors=[];
function check(value,label){assert.ok(value,label);passed.push(label);}
(async()=>{
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,pathname==='/'?'寝殿造り3D探訪_統合版.html':'.'+pathname);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    if(path.extname(file)==='.html'){
      let html=fs.readFileSync(file,'utf8');
      const marker='      this.resetRuntime();';
      assert.equal(html.split(marker).length,2,'private manager instrumentation has exactly one insertion point');
      html=html.replace(marker,marker+'\n      global.__lifecycleTestManager=this;');
      res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);
    }else{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
    const context=await browser.newContext({viewport:{width:1280,height:800}});
    await context.addInitScript(()=>{window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};localStorage.setItem('shinden3d-onboard-v1','1');});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?adaptive=0&eco=off`,{waitUntil:'load'});
    await page.waitForFunction(()=>typeof SELECTED_UX!=='undefined'&&SELECTED_UX&&window.StoryFollowthrough);
    const before=await page.evaluate(()=>{
      enterMode('story');window.__lifecycleTestManager.triggerEnding('ED1_TRUE');
      returnToTitle();enterMode('story');
      return{mode:APP.mode,title:document.getElementById('stPanelTitle').textContent};
    });
    await page.waitForTimeout(1000);
    const after=await page.evaluate(()=>({mode:APP.mode,title:document.getElementById('stPanelTitle').textContent}));
    check(after.mode==='story'&&after.title===before.title&&!after.title.includes('ED1 True End'),'previous-session ending timer cannot overwrite the newly opened chapter menu');
    await page.evaluate(()=>{window.__lifecycleTestManager.state.endingId=null;window.__lifecycleTestManager.triggerEnding('ED2_NORMAL');});
    await page.waitForTimeout(1000);
    check((await page.locator('#stPanelTitle').textContent()).includes('ED2 Normal End'),'an ending timer still opens its card while its owning session is active');
    await page.evaluate(()=>returnToTitle());
    for(const mode of ['kemari','kaiawase','ikaiSuika']){
      const hidden=await page.evaluate(mode=>{
        enterMode('walk');hideModeBrief(true);SELECTED_WORLD.open();
        enterMode(mode);
        return document.getElementById('selectedWorldPanel').hidden&&document.getElementById('selectedWorldOpen').hidden;
      },mode);
      check(hidden,'world UI closes synchronously on '+mode+' entry, without an animation frame');
    }
    await page.evaluate(()=>{
      enterMode('taiji');hideModeBrief(true);
      const control=document.getElementById('toggleRunPreference');control.checked=true;control.dispatchEvent(new Event('change'));
    });
    await page.keyboard.down('Shift');
    check(await page.evaluate(()=>keys.shift===true&&keyActive('run')===true),'run toggle preference preserves ordinary Shift running in taiji');
    await page.keyboard.up('Shift');
    check(await page.evaluate(()=>!keyActive('run')),'releasing Shift stops taiji running');
    await page.evaluate(()=>{returnToTitle();enterMode('walk');hideModeBrief(true);SELECTED_PERFORMANCE.open();document.getElementById('deviceMeasureClose').focus();});
    await page.keyboard.press('Tab');
    check(await page.evaluate(()=>document.activeElement.id==='deviceMeasureName'),'measurement Tab wraps from its last visible control to its first');
    await page.keyboard.press('Shift+Tab');
    check(await page.evaluate(()=>document.activeElement.id==='deviceMeasureClose'),'measurement Shift+Tab wraps in reverse and skips hidden result controls');
    await page.keyboard.press('Escape');
    check(await page.locator('#deviceMeasurement').isHidden(),'Escape closes the measurement dialog');
    // Exercise the genuine final-result function with a high-score completed state.
    // No start-mode picker is opened: only the endpoint state is supplied.
    for(const rank of ['best','good']){
      await page.evaluate(rank=>{
        returnToTitle();APP.mode='renaiSim';
        APP.renai={mode:'sim',affection:rank==='best'?70:40,stats:{miyabi:31,poetry:32,modesty:20,reputation:21,incense:33,fashion:34},target:RENAI_TARGETS[0]};
        renaiSimEnding();
      },rank);
      // Use the result's real UI event handler; rendering is intentionally paused in this harness.
      await page.locator('#renaiClosure button').filter({hasText:'友として'}).evaluate(button=>button.click());
      const result=await page.evaluate(()=>({rank:document.getElementById('resRank').textContent,text:document.getElementById('resDetail').textContent}));
      check(result.rank==='友として続く文'&&!result.text.includes('恋を実らせた')&&!result.text.includes('恋敵')&&!result.text.includes('心の距離は縮まり'),rank+' friendship replaces the earlier romantic conclusion');
      check(['雅 31','文才 32','慎み 20','評判 21','薫物 33','装束 34'].every(s=>result.text.includes(s)),rank+' relationship choice preserves all six final stats');
    }
    check(errors.length===0,'no browser exceptions: '+errors.join(' | '));
    console.log(JSON.stringify({status:'ok',passed},null,2));
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
