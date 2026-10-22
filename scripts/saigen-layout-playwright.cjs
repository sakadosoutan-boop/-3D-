/* Real replay text, warm-up overlay and button hit tests at phone viewports. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/review');
(async()=>{const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'}),errors=[];try{
  const page=await browser.newPage({viewport:{width:844,height:390}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};localStorage.setItem('shinden3d-onboard-v1','1');});
  await page.goto(pathToFileURL(path.join(root,'寝殿造り3D探訪_統合版.html')).href,{waitUntil:'load',timeout:180000});
  // Dismiss the intentional title cut exactly as the existing replay regression does.
  const warm=await page.evaluate(()=>{enterMode('saigen');document.getElementById('sgPicker').style.display='none';startSaigen('makura_haru');ukHideCut();showLoading();
    const ids=['sgQuit','sgMenu','sgView'];return ids.map(id=>{const o=document.getElementById(id),r=o.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id,hit:hit===o||o.contains(hit),actual:hit?.id||hit?.className};});});assert(warm.every(r=>r.hit),JSON.stringify(warm));
  await page.click('#sgView');assert(await page.evaluate(()=>document.getElementById('saigenHud').classList.contains('sg-view')));await page.click('#sgView');
  await page.click('#sgMenu');assert(await page.evaluate(()=>getComputedStyle(document.getElementById('sgPicker')).display==='flex'));
  await page.click('#sgPickerList .sg-pick-btn');await page.evaluate(()=>{ukHideCut();showLoading();});await page.click('#sgQuit');assert(await page.evaluate(()=>APP.mode==='title'));
  const records=[];
  for(const [width,height] of [[844,390],[568,320],[390,844]]){
    await page.setViewportSize({width,height});
    const data=await page.evaluate(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));enterMode('saigen');document.getElementById('sgPicker').style.display='none';hideLoadingSoon(0);const out=[];
      for(const id of ['makura_haru','chomon_uta']){startSaigen(id);for(let i=0;i<APP.saigen.scene.beats.length;i++){
        APP.saigen.i=i;renderSaigenBeat();await wait(60);ukHideCut();
        const bar=document.querySelector('#saigenHud .sg-top').getBoundingClientRect(),panel=document.querySelector('#saigenHud .sg-stage-cap').getBoundingClientRect(),hw=document.getElementById('sgHonbunWrap'),hb=document.getElementById('sgHonbun'),yk=document.getElementById('sgYaku'),wr=hw.getBoundingClientRect();
        let text=true;if(hb.classList.contains('sg-waka-text'))for(const l of hb.querySelectorAll('.sg-waka-line')){const r=l.getBoundingClientRect();text&&=r.bottom<=wr.bottom+1&&r.left>=wr.left-1&&r.right<=wr.right+1;}
        else if(hb.firstChild){const t=hb.firstChild,range=document.createRange();range.setStart(t,t.textContent.length-1);range.setEnd(t,t.textContent.length);const r=range.getBoundingClientRect();text=r.left>=wr.left-1&&r.right<=wr.right+1&&r.bottom<=wr.bottom+1;}
        const hits=['sgQuit','sgMenu','sgView'].every(id=>{const o=document.getElementById(id),r=o.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return h===o||o.contains(h);});
        out.push({id,beat:i+1,gap:+(panel.top-bar.bottom).toFixed(2),panelInside:panel.top>=bar.bottom&&panel.bottom<=innerHeight,text,translation:yk.scrollHeight<=yk.clientHeight+1,hits});
      }}return out;});
    for(const r of data)assert(r.panelInside&&r.text&&r.translation&&r.hits,`${width}x${height}: ${JSON.stringify(r)}`);records.push({width,height,beats:data});
    for(const [id,index] of [['makura_haru',0],['chomon_uta',9]]){
      await page.evaluate(async({id,index})=>{startSaigen(id);APP.saigen.i=index;renderSaigenBeat();await new Promise(r=>setTimeout(r,750));ukHideCut();window.__SHINDEN_BENCH_PAUSE=false;animate(performance.now());window.__SHINDEN_BENCH_PAUSE=true;}, {id,index});
      await page.screenshot({path:path.join(out,`saigen-layout-${width}x${height}-${id}-${index+1}.png`)});
    }
  }
  assert.deepEqual(errors,[]);const report={warm,records,errors};fs.writeFileSync(path.join(out,'saigen-layout-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({warm,viewports:records.map(r=>({width:r.width,height:r.height,beats:r.beats.length,minGap:Math.min(...r.beats.map(b=>b.gap))})),errors},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
