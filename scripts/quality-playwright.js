const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  let browser,launchError;
  for(const channel of [process.env.PLAYWRIGHT_CHANNEL, 'chrome', 'msedge']){
    try{browser=await chromium.launch({headless:true,...(channel?{channel}:{})});break;}catch(error){launchError=error;}
  }
  if(!browser)throw launchError;
  const page = await browser.newPage({viewport:{width:1366,height:768}});
  const errors=[], passed=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{window.SHINDEN_ONLINE_CONFIG={enabled:false};localStorage.setItem('shinden3d-onboard-v1','1');});
  try {
    await page.goto(pathToFileURL(path.resolve('寝殿造り3D探訪_統合版.html')).href);
    await page.waitForFunction(()=>typeof APP!=='undefined'&&typeof PAUSE_STATE!=='undefined');
    await page.locator('#btnWalk').click();
    await page.waitForFunction(()=>!document.getElementById('loadingScreen').classList.contains('show'));

    // A double tap must consume exactly one quest step.
    const step=await page.evaluate(()=>{
      enterMode('quest');hideModeBrief(true);
      const i=APP.quest.steps.findIndex(s=>s.type==='click');questAdvance(i);
      player.pos.set(0,1.62,26);
      const id=APP.quest.steps[i].target;questNotifyClick(id);questNotifyClick(id);questNotifyClick(id);
      return i;
    });
    await page.waitForFunction(i=>APP.quest.i>i,step);
    assert.equal(await page.evaluate(()=>APP.quest.i),step+1);passed.push('quest triple tap advances exactly once');

    // Leaving an answered quiz must not mutate or finish the next session.
    await page.evaluate(()=>{
      enterMode('quiz');document.getElementById('quizDiffPicker').style.display='none';startQuiz();
      APP.quiz.i=APP.quiz.qs.length-1;quizAnswer(APP.quiz.qs[APP.quiz.i]);
      enterMode('quiz');document.getElementById('quizDiffPicker').style.display='none';startQuiz();
    });
    await page.waitForTimeout(1300);
    assert.deepEqual(await page.evaluate(()=>({index:APP.quiz.i,score:APP.quiz.score})),{index:0,score:0});
    passed.push('previous quiz callbacks cannot affect a new quiz');

    await page.evaluate(()=>{quizAnswer(APP.quiz.qs[0]);openPauseMenu();});
    const paused=await page.evaluate(()=>({i:APP.quiz.i,t:clock.elapsedTime,remaining:modeTasks[0].left}));
    assert.equal(await page.evaluate(()=>PAUSE_STATE.active),true);
    await page.waitForTimeout(1400);
    assert.equal(await page.evaluate(()=>APP.quiz.i),paused.i);
    assert.equal(await page.evaluate(()=>clock.elapsedTime),paused.t);
    await page.evaluate(()=>closePauseMenu());
    await page.waitForFunction(()=>APP.quiz.i===1);
    assert.ok((await page.evaluate(()=>clock.elapsedTime))-paused.t<1.4,'pause must not be included in the animation clock');
    passed.push('pause freezes quiz progression and animation clock; resume advances once');

    await page.evaluate(()=>{enterMode('quest');questAdvance(APP.quest.steps.findIndex(s=>s.type==='auto'));openPauseMenu();});
    const questIndex=await page.evaluate(()=>APP.quest.i);
    await page.waitForTimeout(2700);
    assert.equal(await page.evaluate(()=>APP.quest.i),questIndex);
    await page.evaluate(()=>{closePauseMenu();enterMode('walk');});
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(()=>APP.quest),null);
    passed.push('quest auto scene stays paused and is cancelled on exit');

    await page.evaluate(()=>{
      enterMode('quest');const i=APP.quest.steps.findIndex(s=>s.type==='click');questAdvance(i);
      questNotifyClick(APP.quest.steps[i].target);enterMode('quest');
    });
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(()=>APP.quest.i),0);
    passed.push('a previous quest cannot advance a restarted quest');
    await page.evaluate(()=>enterMode('walk'));

    // Reading and forms must not steer the camera/player behind the UI.
    await page.evaluate(()=>{document.getElementById('help').style.display='flex';player.pos.set(0,1.62,26);});
    await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');
    assert.equal(await page.evaluate(()=>player.pos.z),26);
    await page.evaluate(()=>{document.getElementById('help').style.display='none';openCodex();});
    await page.locator('#codexSearch').fill('wasd');
    await page.keyboard.press('w');
    assert.equal(await page.evaluate(()=>!!keys.w),false);
    await page.evaluate(()=>{closeCodex();joy.active=true;joy.vx=1;drag.on=true;cv.dispatchEvent(new Event('touchcancel'));});
    assert.deepEqual(await page.evaluate(()=>[joy.active,joy.vx,drag.on]),[false,0,false]);
    passed.push('help and text fields block movement; cancelled touch clears input');

    await page.evaluate(()=>{showInfo('shinden');showInfo('shinden');});
    await page.waitForTimeout(2500);
    assert.ok(await page.locator('#info').evaluate(el=>el.classList.contains('open')));
    await page.locator('#infoClose').click();
    assert.equal(await page.locator('#info').evaluate(el=>el.classList.contains('open')),false);
    passed.push('revisited explanations remain readable until explicitly closed');

    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({status:'ok',passed,errors},null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
