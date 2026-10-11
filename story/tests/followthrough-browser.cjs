const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
(async()=>{
  let browser;
  for(const channel of [undefined,'chrome','msedge']){try{browser=await chromium.launch({headless:true,...(channel?{channel}:{})});break;}catch(e){if(channel==='msedge')throw e;}}
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://story.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ja"><meta name="viewport" content="width=device-width"><body style="margin:16px;background:#1c1712;color:white"><h2 id="resRank">恋、成就す</h2><div id="resDetail">三十日の文</div></body></html>'}));
    await page.goto('https://story.test/');
    await page.addStyleTag({path:path.join(root,'src/app/story-followthrough.css')});
    await page.addScriptTag({path:path.join(root,'src/app/story-followthrough.js')});
    for(const [index,title] of [[0,'言葉を預ける信頼'],[1,'友として続く文'],[2,'返事を求めない別れ']]){
      await page.evaluate(()=>StoryFollowthrough.mountRenaiEnding({targetId:'aoi',targetName:'葵の君',rank:'best',affection:70,stats:{modesty:12,poetry:20}}));
      assert.equal(await page.locator('#renaiClosure button').count(),3);
      await page.locator('#renaiClosure button').nth(index).click();
      assert.equal(await page.locator('#resRank').textContent(),title);
      assert.ok((await page.locator('#renaiClosure [role=status]').textContent()).length>30);
      assert.equal(await page.locator('#renaiClosure button').count(),0);
    }
    await page.evaluate(()=>StoryFollowthrough.mountRenaiEnding({targetId:'yuki',targetName:'雪の君',rank:'bad',affection:0,stats:{modesty:3,poetry:4}}));
    assert.equal(await page.locator('#renaiClosure button').count(),1);
    assert.ok(!(await page.locator('#resDetail').textContent()).includes('再び挑んで'));
    await page.locator('#renaiClosure button').click();
    assert.ok((await page.locator('#renaiClosure [role=status]').textContent()).includes('返事は、届かなかった'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.locator('#renaiClosure h4').evaluate(e=>document.activeElement===e),true);
    assert.deepEqual(errors,[]);
    console.log('PASS: mobile romance ending trust/friendship/farewell clicks, consent gate, focus, layout, no browser exceptions');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
