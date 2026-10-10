const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 const errors=[],page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});let navigations=0;page.on('framenavigated',f=>{if(f===page.mainFrame())navigations++;});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};localStorage.setItem('shinden3d-onboard-v1','1');});
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../寝殿造り3D探訪_統合版.html')).href+'?adaptive=0&eco=off');
  await page.waitForFunction(()=>window.SELECTED_UX&&window.SELECTED_PERFORMANCE);
  const startup=await page.evaluate(()=>({home:!document.getElementById('homeNext').hidden,stats:SELECTED_PERFORMANCE.stats}));assert(startup.home);
  fs.mkdirSync(path.resolve(__dirname,'../artifacts/review'),{recursive:true});
  await page.screenshot({path:path.resolve(__dirname,'../artifacts/review/selected-title-mobile.png')});
  await page.evaluate(()=>{document.querySelector('[data-target="btnWalk"]').click();});assert.deepEqual(await page.evaluate(()=>SELECTED_UX.preferences().favorites),['btnWalk']);
  const navigation=await page.evaluate(()=>{
   const count=performance.getEntriesByType('navigation').length;enterMode('walk');hideModeBrief(true);
   keys.w=true;openPauseMenu();returnToTitle();
   return{mode:APP.mode,home:!document.getElementById('homeNext').hidden,title:!document.getElementById('title').classList.contains('hide'),input:keyActive('forward'),pause:PAUSE_STATE.active,navigation:performance.getEntriesByType('navigation').length===count,blocked:gameplayInputBlocked()};
  });assert.deepEqual(navigation,{mode:'title',home:true,title:true,input:false,pause:false,navigation:true,blocked:true});
  const settings=await page.evaluate(()=>{
   enterMode('walk');hideModeBrief(true);document.getElementById('loadingScreen').classList.remove('show');
   const toggle=document.getElementById('toggleRunPreference');toggle.checked=true;toggle.dispatchEvent(new Event('change'));document.getElementById('runToggleButton').click();const on=keyActive('run');
   window.dispatchEvent(new Event('blur'));const reset=!keyActive('run');
   document.getElementById('editTouchLayout').click();const blocked=gameplayInputBlocked();const first=SELECTED_UX.preferences().positions;
   return{on,reset,blocked,first};
  });assert(settings.on&&settings.reset&&settings.blocked);
  await page.locator('#layout-interactBtn').focus();await page.keyboard.press('ArrowLeft');await page.locator('#touchLayoutSave').click();
  const saved=await page.evaluate(()=>({positions:SELECTED_UX.preferences().positions,blocked:gameplayInputBlocked()}));assert(saved.positions.interactBtn);assert.equal(saved.blocked,false);
  await page.evaluate(()=>{document.getElementById('gfx').style.display='flex';document.getElementById('editTouchLayout').click();});
  await page.screenshot({path:path.resolve(__dirname,'../artifacts/review/selected-touch-editor.png')});
  await page.locator('#touchLayoutCancel').click();await page.evaluate(()=>{document.getElementById('gfx').style.display='none';});
  const modal=await page.evaluate(()=>{SELECTED_WORLD.open('lost');enterMode('kemari');const closed=document.getElementById('selectedWorldPanel').hidden;returnToTitle();SELECTED_PERFORMANCE.open();document.getElementById('deviceMeasureClose').focus();return closed;});assert(modal);
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'deviceMeasureName');
  await page.evaluate(()=>document.getElementById('deviceMeasureClose').click());
  const guard=await page.evaluate(()=>{
   enterMode('taiji');hideModeBrief(true);document.getElementById('loadingScreen').classList.remove('show');
   const toggle=document.getElementById('toggleGuardPreference');toggle.checked=true;toggle.dispatchEvent(new Event('change'));
   keys.shift=true;const shift=keyActive('run');keys.shift=false;
   const debug={blocked:gameplayInputBlocked(),tutorial:APP.taiji.tutorialBlocked,preference:SELECTED_UX.preferences().guardToggle};
   const e=key=>new KeyboardEvent('keydown',{key,bubbles:true});document.body.dispatchEvent(e('f'));const first=APP.taiji.guarding;
   document.body.dispatchEvent(new KeyboardEvent('keyup',{key:'f',bubbles:true}));const held=APP.taiji.guarding;
   document.body.dispatchEvent(e('f'));const off=!APP.taiji.guarding;document.body.dispatchEvent(e('f'));returnToTitle();return{first,held,off,cleared:!APP.taiji,shift,debug};
  });assert(guard.first&&guard.held&&guard.off&&guard.cleared&&guard.shift);
  const titleButtons=await page.evaluate(()=>{enterMode('kaiawase');document.getElementById('kaiToTitle').click();const shell=APP.mode==='title';enterMode('kemari');document.getElementById('kmrToTitle').click();return{shell,kemari:APP.mode==='title'};});await page.waitForTimeout(200);assert(titleButtons.shell&&titleButtons.kemari);assert.equal(navigations,1);
  await page.evaluate(()=>{enterMode('taiji');hideModeBrief(true);APP.taiji.tutorialGraceUntil=0;APP.taiji.hp=1;taijiDamage(1000,{parryable:false,unguardable:true});if(!APP.taiji.done)throw Error('Death race must schedule a real failure');returnToTitle();enterMode('taiji');hideModeBrief(true);window.__newTaijiSession=APP.taiji;});await page.waitForTimeout(2200);
  assert(await page.evaluate(()=>APP.mode==='taiji'&&APP.taiji===__newTaijiSession&&!APP.taiji.done),'old death timer must not end a new fight');await page.evaluate(()=>returnToTitle());
  const device=await page.evaluate(()=>{SELECTED_PERFORMANCE.open();const blocked=gameplayInputBlocked();document.getElementById('deviceMeasureName').value='PC test';document.getElementById('deviceMeasureDuration').value='60';document.getElementById('deviceMeasureStart').click();SELECTED_PERFORMANCE.update(1);return{blocked,active:SELECTED_PERFORMANCE.active,mode:APP.mode};});assert(device.blocked&&device.active&&device.mode==='walk');
  await page.waitForTimeout(50);const measured=await page.evaluate(()=>{SELECTED_PERFORMANCE.update(2);const r=SELECTED_PERFORMANCE.finish();return{model:r.model,samples:r.samples,battery:r.batteryAfter,heat:r.heat,visible:!document.getElementById('deviceMeasurement').hidden};});assert(measured.samples>0&&measured.visible);assert.equal(measured.battery,null);assert.equal(measured.heat,'unknown');
  await page.screenshot({path:path.resolve(__dirname,'../artifacts/review/selected-device-screen.png')});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../寝殿造り3D探訪_統合版.html')).href+'?map=kamakura&adaptive=0&eco=off');await page.waitForFunction(()=>window.SELECTED_UX);
  const kamakura=await page.evaluate(()=>{const recommendation=document.getElementById('homeNextTitle').textContent;enterMode('walk');returnToTitle();return{recommendation,z:player.pos.z,map:APP.map,mode:APP.mode};});assert(kamakura.recommendation.includes('館を比べ'));assert.equal(kamakura.z,46);assert.equal(kamakura.mode,'title');
  assert.deepEqual(errors,[]);assert.equal(navigations,2);console.log(JSON.stringify({status:'ok',startup,navigation,settings,guard,titleButtons,device,measured,kamakura},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
