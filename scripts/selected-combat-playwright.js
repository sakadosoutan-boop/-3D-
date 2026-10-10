const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};
    localStorage.setItem('shinden3d-onboard-v1','1');
    localStorage.setItem('shinden3d-utakai-help-v1','1');
    localStorage.setItem('shinden3d-kaiawase-help','1');
  });
  try{
    const url=pathToFileURL(path.resolve(__dirname,'../寝殿造り3D探訪_統合版.html')).href+'?adaptive=0&eco=off';
    await page.goto(url,{waitUntil:'load'});
    await page.waitForFunction(()=>typeof taijiBossCodexNotes==='function'&&typeof ukEnsureFairHand==='function'&&typeof kmrFailureReason==='function');
    const result=await page.evaluate(()=>{
      const checks={};
      const dummy=i=>({id:'test_loan_'+i,poem:'山の道を歩く',interp:'',auth:'無名',season:'spring'});
      const initial=Array.from({length:5},(_,i)=>dummy(i));
      const fair={topic:{label:'雪',themes:['雪','冬'],season:'winter'},place:'東の対',judge:'紀貫之',judgePref:null,
        specialTech:null,hand:initial.slice(),deck:initial.slice(),drawPile:[],used:new Set(),loanedIds:new Set()};
      const unlocked=codexUnlocked.size;ukEnsureFairHand(fair);
      checks.loan=fair.loanedIds.size===1&&fair.hand.length===5&&fair.deck.length===6&&codexUnlocked.size===unlocked;
      const specialCard=WAKA_DATA.find(w=>wakaMeta(w).tech.some(t=>t.name==='掛詞'));
      const plain=WAKA_DATA.find(w=>!wakaMeta(w).tech.some(t=>t.name==='掛詞'));
      const ctx={topic:{label:'恋',themes:['恋'],season:'all'},place:'南庭',judge:'紀貫之',judgePref:null,buff:0,collected:0,specialTech:'掛詞'};
      checks.technique=!!specialCard&&!!plain&&scoreWaka(specialCard,ctx,null,'good','L').parts.some(p=>p.label==='特別戦・掛詞'&&p.pts===24)
        &&scoreWaka(plain,ctx,null,'good','L').parts.some(p=>p.label==='特別戦・掛詞'&&p.pts===-8);
      enterMode('utakai');hideModeBrief(true);startUtakai({special:true});
      const u=APP.utakai;
      checks.specialBattle=!!u.specialTech&&u.hand.some(w=>wakaMeta(w).tech.some(t=>t.name===u.specialTech))&&
        document.getElementById('ukTopic').textContent.includes(u.specialTech);
      enterMode('walk');
      KAI={learned:[]};kaiShowLore(KAI_THEMES[0]);
      checks.shell=KAI.learned.length===1&&!!kaiWakaForTheme(KAI_THEMES[0])&&document.getElementById('kaiLoreBanner').textContent.includes('和歌の景物');
      KAI=null;
      const flight=1000,now=performance.now();
      const s={delivery:{lane:1,technique:'high',start:now-flight*.5,flight},playerX:-1,selected:'receive'};
      checks.kemariPosition=kmrFailureReason(s,{time:.5,position:2,technique:false}).includes('右へ寄ろう');
      s.playerX=1;s.delivery.start=now-flight*1.3;
      checks.kemariTiming=kmrFailureReason(s,{time:.3,position:0,technique:true}).includes('遅い');
      checks.kemariTechnique=kmrFailureReason(s,{time:.1,position:0,technique:false}).includes('高蹴り');
      enterMode('taiji');hideModeBrief(true);
      const k=APP.taiji;k.tutorialGraceUntil=0;k.guarding=true;k.parryUntil=performance.now()+3000;k.hp=100;
      const center=player.pos.clone();bossCircle(center,2,0xff553d,8,920,260);
      const red=bossHazards.at(-1),redGuide=red.guide.geometry.parameters.radius===red.r;
      red.born=performance.now()-red.delay-1;updateBossHazards(k,performance.now(),.016);
      checks.red=redGuide&&k.hp<100&&k.parries===0;
      k.hp=100;k.guarding=true;k.parryUntil=performance.now()+3000;
      bossLine(center.clone().add(new THREE.Vector3(-2,0,0)),center.clone().add(new THREE.Vector3(2,0,0)),1.2,TAIJI_PARRY_PINK,8,920,260);
      const gold=bossHazards.at(-1),lineGuide=Math.abs(gold.guide.geometry.parameters.depth-gold.width*1.1)<.001;
      gold.born=performance.now()-gold.delay-1;updateBossHazards(k,performance.now(),.016);
      checks.gold=lineGuide&&k.hp===100&&k.parries>0;
      clearBossBattleFx();
      spawnBossProj(center.clone().add(new THREE.Vector3(2,0,0)),center.clone(),TAIJI_PARRY_PINK,6,6,{hit2d:true,height:center.y});
      k.fudaCd=0;k.stamina=100;k.guarding=false;taijiFuda();
      checks.sealPurges= bossProjs.length===0;
      const oldMotion=updateBossMotion,oldAttack=bossAttack;
      const calls=[];updateBossMotion=()=>{};bossAttack=(_K,target)=>calls.push(target.role);
      const makeDuet=role=>({g:new THREE.Group(),cfg:{attack:role,name:role},role,hp:100,maxHp:100,dead:false,nextAtk:0,baseScale:new THREE.Vector3(1,1,1)});
      const kappa=makeDuet('kappa'),chochin=makeDuet('chochin');
      k.season='summer';k.storyKappa=false;k.bosses=[kappa,chochin];k.boss=kappa;k._bossBgmCheck=Infinity;
      updateBoss(k,10,10000,.016);updateBoss(k,11,11000,.016);updateBoss(k,12.5,12500,.016);
      checks.duet=calls.join(',')==='kappa,chochin'&&kappa._summerOpeningFrom<kappa._summerOpeningUntil;
      updateBossMotion=oldMotion;bossAttack=oldAttack;
      const g=new THREE.Group();g.position.set(player.pos.x+8,0,player.pos.z-8);scene.add(g);
      const b={g,cfg:{attack:'oni',name:'大鬼'},hp:100,maxHp:100,dead:false,faceLocal:new THREE.Vector3(0,3,0)};
      k.bosses=[b];k.boss=b;k.lockTarget=b;k.lockOn=true;
      const oldFov=camera.fov;taijiUpdateLockOn(.5);checks.largeLock=camera.fov>oldFov&&player.pitch<.5;
      taijiSetLockOn(false);checks.cameraRestore=camera.fov===oldFov;
      k.lockTarget=b;k.lockOn=true;taijiUpdateLockOn(.5);
      taijiQuit();checks.cameraModeRestore=camera.fov===oldFov;
      localStorage.removeItem(TAIJI_BOSS_CODEX_KEY);
      checks.codexBefore=taijiBossCodexNotes('kappa')==='';
      taijiRecordBossCodex({season:'summer',storyKappa:true});
      checks.codexAfter=taijiBossCodexNotes('kappa').includes('水流')&&taijiBossCodexNotes('chochin')==='';
      openCodex('main');codexShowDetail('kappa');
      checks.codexVisible=!!document.querySelector('.codex-boss-note')?.textContent.includes('攻撃の読み方');
      closeCodex();
      return checks;
    });
    for(const [name,ok] of Object.entries(result))assert.ok(ok,`${name}: ${JSON.stringify(result)}`);
    assert.deepEqual(errors,[]);
    console.log(`selected combat and minigames: ${Object.keys(result).length} checks passed`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
