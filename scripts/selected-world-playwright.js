const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const errors=[],passed=[];
function check(ok,text){assert.ok(ok,text);passed.push(text);}
(async()=>{
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,pathname==='/'?'寝殿造り3D探訪_統合版.html':'.'+pathname);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
    const context=await browser.newContext({viewport:{width:1280,height:800}});
    await context.addInitScript(()=>{window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};localStorage.setItem('shinden3d-onboard-v1','1');});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    async function prepare(){
      await page.waitForFunction(()=>typeof APP!=='undefined'&&typeof enterMode==='function'&&typeof householdPeople!=='undefined');
      if(!await page.evaluate(()=>!!window.SELECTED_WORLD)){await page.addStyleTag({path:path.join(root,'src/app/selected-world.css')});await page.addScriptTag({path:path.join(root,'src/app/selected-world.js')});}
      await page.evaluate(()=>{enterMode('walk');if(typeof hideModeBrief==='function')hideModeBrief(true);if(typeof onboardClose==='function')onboardClose();AUTO_TIME._paused=true;setTime('day');SELECTED_WORLD.update(.4);});
    }
    const ui=()=>page.locator('#selectedWorldPanel');
    const click=text=>ui().getByRole('button',{name:text,exact:true}).click();
    async function home(){if(await ui().isVisible()){const back=ui().getByRole('button',{name:'約束の一覧へ',exact:true});if(await back.count())await back.click();}else await page.locator('#selectedWorldOpen').click();}
    // Exercise original collision resolution in short strides, never teleport through barriers.
    async function walk(points){const result=await page.evaluate(points=>{
      for(const target of points){for(let i=0;i<2400;i++){const dx=target[0]-player.pos.x,dz=target[1]-player.pos.z,d=Math.hypot(dx,dz);if(d<.08)break;const step=Math.min(.12,d),r=walkMoveResolve(player.pos.x,player.pos.z,player.pos.x+dx/d*step,player.pos.z+dz/d*step);if(Math.hypot(r.x-player.pos.x,r.z-player.pos.z)<.0001)return {ok:false,at:[player.pos.x,player.pos.z],target};player.pos.set(r.x,groundH(r.x,r.z)+1.62,r.z);}if(Math.hypot(target[0]-player.pos.x,target[1]-player.pos.z)>.3)return{ok:false,at:[player.pos.x,player.pos.z],target};}
      camera.position.copy(player.pos);SELECTED_WORLD.update(.4);return{ok:true};
    },points);assert.ok(result.ok,JSON.stringify(result));}
    async function approach(id,via=[]){const p=await page.evaluate(id=>{const a=householdPeople.find(p=>p.userData.householdId===id);return[a.position.x,a.position.z+2];},id);await walk([...via,p]);await home();await click((id==='keishi'?'家司':'舎人')+'に話しかける');}
    await page.goto(`http://127.0.0.1:${server.address().port}/?adaptive=0&eco=off`,{waitUntil:'load'});await prepare();
    await home();await click('家司に話しかける');
    check(await ui().getByRole('button',{name:'寝殿を望む場所への道を尋ねる',exact:true}).isDisabled(),'distant NPC cannot be queried remotely');
    await click('約束の一覧へ');await click('落とし扇 — 庭で探す');
    check(await ui().getByRole('button',{name:'落ちた扇を調べ、拾う',exact:true}).isDisabled(),'lost item must be reached in the world');
    await walk([[0,18],[0,12]]);await click('落ちた扇を調べ、拾う');
    check((await page.evaluate(()=>SELECTED_WORLD.state)).lost===1,'lost fan is picked up through its nearby UI');
    await page.reload({waitUntil:'load'});await prepare();
    check((await page.evaluate(()=>SELECTED_WORLD.state)).lost===1,'unfinished incident survives reload');
    await approach('keishi',[[0,19]]);
    await click('寝殿を望む場所への道を尋ねる');
    check((await ui().locator('[role=status]').textContent()).includes('階段'),'NPC directions describe a building and route');
    check(/北|南|東|西/.test(await page.locator('#selectedWorldOpen').textContent()),'persistent guidance includes a compass direction');
    await click('拾った扇の持主を尋ねる');await click('日課を手伝う — 荷札の照合');
    await walk([[-6,14]]);await home();await click('家司の頼み — 荷札を調べる');await click('三つの荷札を調べる');await click('同じ包みが三つ');
    check((await page.evaluate(()=>SELECTED_WORLD.state)).ledger===1,'incorrect observation does not complete the task');
    await click('米・布・薪の三種');await approach('keishi');await click('米・布・薪、三種の荷札を報告する');
    check((await page.evaluate(()=>SELECTED_WORLD.state)).ledger===3,'first daily task requires inspection and reporting');
    await approach('toneri',[[0,19],[29,19],[35,21],[42,21]]);await click('落とし扇を返し、持主を確かめる');await click('日課を手伝う — 文を届ける');
    check((await page.evaluate(()=>SELECTED_WORLD.state)).lost===3,'lost fan incident ends with its owner');
    await walk([[43,20]]);await home();await click('舎人の頼み — 文を預かる');await click('預かり文を持つ（封は開けない）');
    await approach('keishi',[[42,21],[35,21],[29,19],[0,19]]);await click('封を開けず、預かった文を届ける');
    await approach('toneri',[[0,19],[29,19],[35,21],[42,21]]);await click('家司が受け取ったと報告する');
    check((await page.evaluate(()=>SELECTED_WORLD.state)).courier===4,'second daily task includes collection, delivery and acknowledgement');
    await walk([[42,21],[35,21],[29,19],[0,19],[0,10]]);await home();await click('平安と鎌倉を歩いて比べる');await click('寝殿と渡殿をここで観察する');
    await Promise.all([page.waitForURL(/map=kamakura/),click('記録して鎌倉へ移る')]);await prepare();
    check((await page.evaluate(()=>SELECTED_WORLD.state)).visits.heian,'era navigation retains first visit');
    await home();await click('平安と鎌倉を歩いて比べる');
    check(await ui().getByRole('button',{name:'主殿と庭をここで観察する',exact:true}).isDisabled(),'second era requires a real visit');
    await walk([[0,32],[0,20],[0,7]]);await click('主殿と庭をここで観察する');await click('どちらも同じ建物配置だった');
    check(!(await page.evaluate(()=>SELECTED_WORLD.state)).comparison,'comparison is not a free completion');
    await click('この模型では、建物のつながり方と門まわりの配置が違う');
    check((await page.evaluate(()=>SELECTED_WORLD.state)).comparison,'both visits and comparison learning are saved');
    await Promise.all([page.waitForURL(url=>!url.searchParams.has('map')),click('記録して平安へ戻る')]);await prepare();
    check((await page.evaluate(()=>SELECTED_WORLD.state)).courier===4,'return journey retains completed estate tasks');
    await page.setViewportSize({width:390,height:844});await home();
    check(await page.evaluate(()=>{const p=document.getElementById('selectedWorldPanel').getBoundingClientRect();return p.left>=0&&p.right<=innerWidth&&p.bottom<=innerHeight;}),'mobile panel remains within the viewport');
    await page.evaluate(()=>{APP.mode='story';SELECTED_WORLD.update(.4);});
    check(await ui().isHidden()&&await page.locator('#selectedWorldOpen').isHidden(),'story mode closes and hides optional events');
    check(errors.length===0,'no browser exceptions: '+errors.join(' | '));
    console.log(JSON.stringify({status:'ok',passed},null,2));
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
