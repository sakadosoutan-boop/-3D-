/* ============================================================
   物の怪退治モード
============================================================ */
const YOKAI_IDS=new Set(["hitodama","kappa","chochin","kitsunebi","yukionna"]);
const TAIJI_BOSS_CODEX={
  kitsunebi:"九尾狐は追う狐火と地を焼く陣を使う。桃霞の狐火は弾き、赤い陣は輪の外へ避ける。本作の退治演出は狐火伝承から着想した創作。",
  kappa:"河童の主は水流で足を取ってから突進する。桃霞の水弾は弾き、泥水の輪を離れて太刀で隙を突く。皿の水を力の源とする河童伝承を踏まえた創作。",
  chochin:"提灯お化けは舌の横薙ぎと追尾する怪火を交互に使う。舌の赤い線を離れ、桃霞火は弾ける。道具が怪異になる付喪神の話を取り入れた創作。",
  hitodama:"人魂は群れで波打って寄り、地に怨念の火を立てる。桃霞の魂は弾き、赤い噴出から離れる。魂が体を離れるという伝承を戦闘に見立てた創作。",
  oni:"人魂の未練が大鬼となった姿。金棒の直線と広がる衝撃波を読み、赤い予兆から退く。本作独自の連戦演出。",
  yukionna:"雪女王は氷柱と凍る霧で足場を狭める。赤い影を避け、桃霞の氷刃は弾ける。雪の怪異の伝承を戦闘に見立てた創作。"
};
const TAIJI_BOSS_CODEX_KEY="shinden3d-boss-codex-v1";
function taijiBossCodexNotes(id){
  if(!TAIJI_BOSS_CODEX[id])return"";
  try{if(!JSON.parse(localStorage.getItem(TAIJI_BOSS_CODEX_KEY)||"[]").includes(id))return"";}catch(e){return"";}
  return `<div class="codex-boss-note"><b>討伐記・攻撃の読み方</b><br>${TAIJI_BOSS_CODEX[id]}</div>`;
}
function taijiRecordBossCodex(k){
  const ids=k.season==="spring"?["kitsunebi"]:k.season==="summer"?(k.storyKappa?["kappa"]:["kappa","chochin"]):k.season==="autumn"?["hitodama","oni"]:["yukionna"];
  let saved=[];try{saved=JSON.parse(localStorage.getItem(TAIJI_BOSS_CODEX_KEY)||"[]");if(!Array.isArray(saved))saved=[];}catch(e){}
  ids.forEach(id=>{if(!saved.includes(id))saved.push(id);if(typeof unlockCodex==="function")unlockCodex(id);});
  try{localStorage.setItem(TAIJI_BOSS_CODEX_KEY,JSON.stringify(saved));}catch(e){}
}
/* 死に覚えバランス調整卓 — ボス戦の「体感」に関わる数値をここに集約(波G/H)。
   実プレイの感想を受けて調整する時は、原則この中だけを触れば済むようにする */
const TAIJI_TUNING={
  parryWindowMs:230,       // パリィ受付: ガードを構えた瞬間からこの時間内の被弾を弾く
  parryCdMs:460,           // パリィの再受付までの間隔(連打防止)
  parryCounterDmg:16,      // パリィ成功時の反撃ダメージ(最寄りボス)
  parryCounterStunMs:1500, // パリィ反撃後、ボスの次攻撃を遅らせる時間
  goldSignWindowMs:950,    // 桃霞予兆(✦): この時間内の弾きで「見切り」成立
  mikiriStaggerMs:2600,    // 見切り成功: ボスの体勢崩れ継続時間
  mikiriDmgMul:1.5,        // 体勢崩れ中にボスへ与えるダメージ倍率
  mikiriBonusDmg:10,       // 見切り成立時の即時ダメージ
  patSkipProb:.35,         // 攻撃パターンを1〜2歩ランダムスキップする確率(読み切り防止)
  chainProb:.30,           // 攻撃後に間髪入れず連携チェーンする確率
  chainProbRage:.50,       // 荒魂(HP50%以下)中のチェーン確率
  chainDelayMs:650,        // チェーン攻撃までの最短待ち
  chainDelayRangeMs:250,   // 〃に加わるランダム幅
  rageIntervalMul:.75,     // 荒魂中の攻撃間隔倍率
  atkIntervalMs:2300,      // 通常ボスの攻撃間隔
  atkIntervalSoulsMs:2700, // 人魂ボスの攻撃間隔
  dashDelayProb:.4,        // 突進の溜めが延びる確率(早回避を釣るディレイ)
  dashDelayMs:400,         // 〃の延び幅
};
function startTaiji(){
  if(APP.time!=="night"){setTime("night");PREFS.set("time","night");}
  AUTO_TIME._paused=true;AUTO_TIME._last=performance.now();
  document.body.classList.add("taiji-mode");
  // 戦闘中はジョイスティックを「どこでも方式」に固定し、左下を武器アイテム枠に空ける
  APP._prevJoyDyn=joy.dynamic;joy.dynamic=true;joyRelease();if(typeof updateControlUI==="function")updateControlUI();
  // [軽量化] 退治中は影マップの毎フレーム更新を止める(夜で影はほぼ不可視)
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  // 波AN/AO: ボス戦はモバイルで最も重い(実機FB)。タッチ端末では戦闘の間だけ描画解像度を
  // 最下段まで落として発熱・フレーム落ちを予防し、終了時に元設定へ確実に戻す。
  // ・適応的品質は数秒のウォームアップ後に反応するため、重い戦闘は開幕から間に合わない
  // ・レベル最下段(pr約0.56/影512)にすると塗り面積が約半分になり、ブルームも自動停止(level>1)
  // ・戦闘は動きが速く、解像度の柔らかさは目立ちにくい
  if(IS_TOUCH&&typeof QUALITY!=="undefined"){
    APP._prevGfxForced=QUALITY.forced; // null=オート / 数値=ユーザープリセット
    QUALITY.setForced(3); // 最下段(可読性の床)。戦闘中のみ・終了で復元
  }
  taijiSetLightScene(true);
  if($("tjCoolFill"))$("tjCoolFill").style.width="0%";
  const diffKey=APP.taijiDifficulty||"normal",diff=TAIJI_DIFF[diffKey]||TAIJI_DIFF.normal;
  const bossRush=!!APP.taijiBossRush;
  // ボスラッシュは雑魚なし。通常は難易度に応じた結界霊を配置
  const spots=bossRush?[]:taijiBuildSpots(diffKey);
  // 結界霊を配置(種類別に生成)
  const spirits=spots.map((sp,i)=>{
    const g=makeTaijiKekkai(sp.type||"normal");
    g.position.set(sp.x,sp.y,sp.z);scene.add(g);
    g.userData.inner.userData.iid="__kekkai__";
    g.userData.inner.userData.kekkai_idx=i;
    rayTargets.push(g.userData.inner);
    const baseHp=sp.type==="strong"?2:1;
    const hp=Math.max(1,Math.ceil(baseHp*diff.hpMul));
    const hpbar=makeHpBar();hpbar.position.y=(sp.type==="strong"?1.2:0.95);g.add(hpbar);
    const wander=sp.type==="wander"?{tx:sp.x,tz:sp.z,nextMs:performance.now()+3000}:null;
    return {g,sp,alive:true,idx:i,hp,maxHp:hp,wander,nextHit:0,hpbar};
  });
  const rushQueue=(APP.storyTaiji&&APP.storyTaiji.rush)?APP.storyTaiji.rush.slice():["spring","summer","autumn","winter"]; // 波O: ストーリー戦は単独ボス
  const staminaMax=Math.round(100*(diff.stamMul||1));
  APP.taiji={spirits,shot:0,miss:0,weapon:"bow",tStart:performance.now(),done:false,hp:100,maxHp:100,bonus:0,slowUntil:0,fudaCd:0,
    season:(bossRush?rushQueue[0]:(APP.taijiSeason||APP.season||"spring")),bossSpawned:false,boss:null,total:bossRush?rushQueue.length:spots.length,diffKey,diff,dodgeCd:0,dodgeUntil:0,
    seimeiHealUsed:false,fudaBurst:false,fudaChain:1,arrowCd:0,
    swordCd:0,swordCombo:0,swordAt:0,sake:3,sakeCd:0,sakeUsed:0,
    kotodamaCharges:(diff.kotodama||3),kotodama:null,
    stamina:staminaMax,staminaMax,staminaDelay:0,exhausted:false,posture:0,postureMax:Math.round(100*(diff.postureMul||1)),
    guarding:false,guardMeter:100,rollUntil:0,rollDir:null,
    lockOn:false,lockTarget:null,lockPitch:0,
    combo:0,bestCombo:0,parries:0,guards:0,hitsTaken:0,comboAt:0,comboUiUntil:0,
    bossRush,rushQueue,rushIndex:0,rushCleared:0};
  creatures.oni.forEach(o=>{o.taijiHp=Math.ceil(32*diff.hpMul);o.taijiAlive=true;o.dispelledUntil=0;});
  $("taijiRemain").textContent=bossRush?"ボス":spirits.length;
  $("taijiHud").style.display="block";
  /* 波Q: 河童戦は「太刀のみ」。弓は右近が受け持つ設定に合わせ、弓・札を封じる */
  const swordOnly=!!(APP.storyTaiji&&APP.storyTaiji.swordOnly);
  APP.taiji.swordOnly=swordOnly;
  taijiSetWeapon(swordOnly?"sword":"bow",{silent:true});
  if(swordOnly){
    ["twBow","twSeal"].forEach(id=>{const e=$(id);if(e){e.style.display="none";}});
    APP.taiji.ukonNext=performance.now()+4500; // 右近の援護射撃タイマー
  }else{["twBow","twSeal"].forEach(id=>{const e=$(id);if(e)e.style.display="";});}
  updateTaijiHp();
  updateTaijiStaminaUi();
  updateTaijiFudaUi();
  updateTaijiSakeUi();
  updateTaijiControlsUi();
  if(bossRush){
    /* 波P: ストーリー戦は単独ボスの見出しにする */
    const stBoss=APP.storyTaiji?((APP.storyTaiji.rush&&APP.storyTaiji.rush[0]==="autumn")?"大鬼":"河童の主"):null;
    $("taijiMsg").textContent=stBoss?("⚔ "+stBoss+"が立ちはだかる！ 回避・ガード・三種の得物で祓え"):"⚔ ボスラッシュ — 四季の主が次々と襲い来る！ 回避と札の連射で討て";
    taijiCine(stBoss||"ボスラッシュ", stBoss?"物語の試練 — 祓い給え":"四季の主を連続で祓え", 1900);
    const K=APP.taiji;
    setTimeout(()=>{if(APP.mode==="taiji"&&APP.taiji===K&&!K.done&&!K.boss)taijiPrepareBossGate(K,true);},1000);
  }else{
    $("taijiMsg").textContent="弓・札・太刀を切替えて祓え。お神酒は3つ、晴明の加護は一度だけ";
    taijiCine("物の怪退治", taijiStageLabel(APP.taiji), 1700);
  }
  const owner=APP.taiji;
  setTimeout(()=>{if(APP.taiji===owner&&$("taijiMsg"))$("taijiMsg").textContent="";},3500);
  /* 波I: 開幕シネ演出の後に任務カード(桃霞/赤予兆・弾き・回避のルール提示)を出す */
  setTimeout(()=>{if(APP.mode==="taiji"&&APP.taiji===owner&&!owner.done)showModeBrief("taiji");},2300);
}
function taijiSetLightScene(on){
  if(typeof SEASONAL==="undefined")return;
  if(on){
    SEASONAL._taijiHidden=[
      ...SEASONAL.maples,...(SEASONAL.miscTrees||[]),...SEASONAL.sakura,...SEASONAL.ume,...(SEASONAL.tsubaki||[]).map(o=>o.tree),
      SEASONAL.hasu,SEASONAL.susuki,SEASONAL.senzaiFlowers,SEASONAL.fallenLeaves,SEASONAL.snow,SEASONAL.petalDrift,
      ...(SEASONAL.chou||[]),...(SEASONAL.tonbo||[]),...(SEASONAL.fuji||[]),...(SEASONAL.nadesiko||[]),...(SEASONAL.kakitsubata||[]),...(SEASONAL.kame||[]),
      ...Object.values(flyingLife||{}),petals,leavesFall,snowFall,rainFall,fireflies,tourouGroup
    ].filter(Boolean).map(g=>({g,visible:g.visible}));
    SEASONAL._taijiHidden.forEach(o=>o.g.visible=false);
    waterBirds.forEach(b=>{b._tjVis=b.g.visible;b.g.visible=false;});
    butterflies.forEach(b=>{b._tjVis=b.g.visible;b.g.visible=false;});
    dragonflies.forEach(d=>{d._tjVis=d.g.visible;d.g.visible=false;});
  }else if(SEASONAL._taijiHidden){
    SEASONAL._taijiHidden.forEach(o=>{o.g.visible=o.visible;});
    SEASONAL._taijiHidden=null;
    waterBirds.forEach(b=>{if(b._tjVis!==undefined)b.g.visible=b._tjVis;});
    butterflies.forEach(b=>{if(b._tjVis!==undefined)b.g.visible=b._tjVis;});
    dragonflies.forEach(d=>{if(d._tjVis!==undefined)d.g.visible=d._tjVis;});
    applySeason(APP.season);
  }
}
function updateTaijiHp(){
  const k=APP.taiji;if(!k)return;
  const p=Math.max(0,Math.min(100,k.hp/k.maxHp*100));
  const f=$("tjHpFill");if(f)f.style.width=p+"%";
  const l=$("tjHpLabel");if(l)l.textContent="体力 "+Math.ceil(k.hp);
}
function updateTaijiStaminaUi(){
  const k=APP.taiji;if(!k)return;
  const p=Math.max(0,Math.min(100,(k.stamina||0)/Math.max(1,k.staminaMax||100)*100));
  const f=$("tjStaminaFill");if(f)f.style.width=p+"%";
  const w=$("tjStaminaWrap");if(w)w.classList.toggle("low",p<28||!!k.exhausted);
  const l=$("tjStaminaLabel");if(l)l.textContent=k.exhausted?"気力切れ":"気力";
  const bp=Math.max(0,Math.min(100,(k.posture||0)/Math.max(1,k.postureMax||100)*100));
  const pf=$("tjPostureFill");if(pf)pf.style.width=bp+"%";
  const pw=$("tjPostureWrap");if(pw)pw.classList.toggle("break",bp>78);
}
function taijiSpendStamina(cost,label="行動"){
  const k=APP.taiji;if(!k||k.done)return false;
  if(k.exhausted||k.stamina<cost){
    taijiMsg("気力が足りない - "+label,650);
    beep(170,.07,"square",.045);
    return false;
  }
  k.stamina=Math.max(0,k.stamina-cost);
  k.staminaDelay=0.68;
  if(k.stamina<=0){k.exhausted=true;taijiMsg("気力切れ！ 少し距離を取れ",900);}
  updateTaijiStaminaUi();
  return true;
}
function taijiIsDrinking(k){return !!(k&&performance.now()<(k.sakeDrinkUntil||0));}
function taijiRegenStamina(dt){
  const k=APP.taiji;if(!k||k.done)return;
  if(k.staminaDelay>0){k.staminaDelay=Math.max(0,k.staminaDelay-dt);return;}
  const rate=k.exhausted?20:34;
  k.stamina=Math.min(k.staminaMax||100,(k.stamina||0)+rate*dt);
  if(k.exhausted&&k.stamina>=(k.staminaMax||100)*.55)k.exhausted=false;
  updateTaijiStaminaUi();
}
function taijiAddBossPosture(b,amt){
  const k=APP.taiji,now=performance.now();if(!k||!b||b.dead)return;
  if(now<(b.staggerUntil||0))return;
  k.posture=Math.min(k.postureMax||100,(k.posture||0)+amt);
  if(k.posture>=(k.postureMax||100)){
    k.posture=0;b.staggerUntil=now+2100;b.nextAtk=now+2600;b.state=null;b.invulnUntil=0;
    taijiMsg((b.cfg&&b.cfg.name||"ボス")+"の体勢を崩した！",1200);
    taijiWorldFloat(taijiBossAimPoint(b)||b.g.position,"体勢崩し","guard");
    beep(190,.12,"square",.075);setTimeout(()=>beep(980,.08,"triangle",.06),40);
  }
  updateTaijiStaminaUi();
}
function taijiTriggerHealPunish(k){
  if(!k||k.done)return;
  const b=typeof taijiNearestBossTarget==="function"?taijiNearestBossTarget(k):null;
  if(!b||b.dead)return;
  const now=performance.now(),aim=player.pos.clone();
  taijiMsg("回復を見て、"+(b.cfg&&b.cfg.name||"ボス")+"が踏み込む！",1200);
  b.nextAtk=now+1600;
  setTimeout(()=>{if(APP.mode==="taiji"&&APP.taiji===k&&!k.done&&!b.dead)bossStartDash(b,aim,performance.now(),{tele:760,dur:330,dmg:14,width:1.65,fx:"smash"});},420);
}
function taijiSourceLabel(src){
  if(!src)return "不明な攻撃";
  if(typeof src==="string")return src;
  if(src.label)return src.label;
  const fx={pillar:"氷柱",mist:"氷霧",iceBeam:"凍てつく吐息",waterCut:"水の突進",smash:"叩きつけ",spiritBand:"霊帯",tongue:"長い舌",pool:"水流",geyser:"泥水",flame:"怪火",sigil:"術陣",wave:"衝撃波"}[src.fx];
  const shape={fox:"狐火",flame:"怪火",ice:"氷刃",water:"水弾",soul:"人魂",rock:"岩弾"}[src.shape];
  return fx||shape||src.kind||"攻撃";
}
function taijiShowHitSource(src,guarded,dealt){
  const el=$("taijiHitSource");if(!el)return;
  const label=taijiSourceLabel(src);
  el.textContent=(guarded?"受け止めた: ":"被弾: ")+label+"  -"+dealt;
  el.classList.toggle("guard",!!guarded);
  el.style.display="block";
  clearTimeout(window._tjHitSourceT);
  window._tjHitSourceT=setTimeout(()=>{if(el)el.style.display="none";},guarded?760:1100);
}
function taijiClearCombatUi(){
  ["taijiRangeBadge","taijiHitSource","tjf2LockMark","tjf3Sign"].forEach(id=>{const el=$(id);if(el)el.style.display="none";});
  const dv=$("dangerVignette");if(dv)dv.style.opacity=0;
}
function taijiUpdateRangeBadge(k){
  const el=$("taijiRangeBadge");if(!el||!k||k.done){if(el)el.style.display="none";return;}
  const b=typeof taijiNearestBossTarget==="function"?taijiNearestBossTarget(k):null;
  if(!b||!b.g||b.dead){el.style.display="none";return;}
  const d=Math.hypot(b.g.position.x-player.pos.x,b.g.position.z-player.pos.z);
  const kind=d<5.2?["near","近すぎる"]:d<10.5?["mid","有効間合い"]:["far","遠距離"];
  el.className=kind[0];
  el.textContent="間合い "+Math.round(d)+"m / "+kind[1];
  el.style.display="block";
}
/* 敵の接触ダメージ */
function taijiDamage(amt,src){
  const k=APP.taiji;if(!k||k.done)return;
  const now=performance.now();
  if(taijiTutorialBlocked(k)||now<(k.tutorialGraceUntil||0))return;
  if(now<(k.dodgeUntil||0)){taijiMsg("回避！(無敵)",500);taijiFloat("回避", "guard",50,58);return;} // ローリング回避の無敵時間
  if(k.guarding&&now<(k.parryUntil||0)&&!(src&&src.parryable===false)){taijiParry();k.parryUntil=0;return;} // 赤予兆は弾けない
  let dmg=amt*(k.diff?k.diff.dmgMul:1);
  if(now<(k.vulnerableUntil||0))dmg*=1.28;
  let guarded=false;
  if(k.guarding&&!(src&&src.unguardable)&&(k.guardMeter||0)>0){ // 赤予兆はガード不可
    guarded=true;k.guards=(k.guards||0)+1;dmg*=0.22;k.guardMeter=Math.max(0,k.guardMeter-(amt*3.4+8));
    taijiMsg("ガード！",450);beep(300,.05,"square",.06);
    taijiFloat("ガード", "guard",50,58);
    const gf=$("dodgeFlash");if(gf){gf.classList.remove("show");}
    if(k.guardMeter<=0){k.guarding=false;taijiMsg("ガードが崩れた！",950);beep(170,.14,"square",.09);}
  }
  k.hp=Math.max(0,k.hp-dmg);updateTaijiHp();
  if(!guarded)juiceShake(); // 波B: 被弾の衝撃(ガード時は揺らさずガードの価値を出す)
  k.hitsTaken=(k.hitsTaken||0)+1;
  const dealt=Math.max(1,Math.ceil(dmg));
  taijiShowHitSource(src,guarded,dealt);
  taijiFloat((guarded?"軽減 -":"-")+dealt, guarded?"guard":"bad",50,54);
  if(!guarded)taijiResetCombo();
  const dv=$("dangerVignette");if(dv){dv.style.opacity=0.55;clearTimeout(window._tjDmgT);window._tjDmgT=setTimeout(()=>{if(APP.mode==="taiji")dv.style.opacity=0;},180);}
  beep(135,.2,"sawtooth",.12);
  if(k.hp<=0){k.done=true;$("taijiMsg").textContent="気を失った…";tjfxDied();setTimeout(()=>{if(APP.mode==="taiji"&&APP.taiji===k)endTaiji(true);},2100);}
}
function taijiDodge(flickDir){
  const k=APP.taiji,now=performance.now();if(!k||k.done)return;
  if(taijiTutorialBlocked(k))return;
  if(taijiIsDrinking(k)){taijiMsg("飲み終えるまで動けない",520);return;}
  if(now<(k.dodgeCd||0)){taijiMsg("回避の体勢が整わない",600);beep(200,.06,"square",.05);return;}
  if(!taijiSpendStamina(32,"回避"))return;
  // 回避方向: フリック方向 > 移動入力 > 後方(画面手前)。screen: x=右, z=下=手前
  let dx=0,dz=0;
  if(flickDir){dx=flickDir.x;dz=flickDir.z;}
  else{
    if(keys.w||keys.arrowup)dz-=1;if(keys.s||keys.arrowdown)dz+=1;
    if(keys.a||keys.arrowleft)dx-=1;if(keys.d||keys.arrowright)dx+=1;
    dx+=joy.vx;dz+=joy.vy;
  }
  const mm=Math.hypot(dx,dz);
  if(mm>0.2){dx/=mm;dz/=mm;}else{dx=0;dz=1;}
  const sy=Math.sin(player.yaw),cy=Math.cos(player.yaw);
  // ローリングの移動はフレーム更新側で滑らかに適用(rollUntilの間)。無敵はdodgeUntil。
  k.rollDir={x:(dz*sy+dx*cy),z:(dz*cy-dx*sy)};
  k.rollStart=now;k.rollUntil=now+360;k.dodgeUntil=now+480;k.dodgeCd=now+820;k.guarding=false;
  taijiMsg("回避！",520);beep(720,.05,"triangle",.05);beep(430,.06,"sine",.04);
  const df=$("dodgeFlash");if(df){df.classList.remove("show");void df.offsetWidth;df.classList.add("show");}
  updateTaijiControlsUi();
}
const TAIJI_PARRY_WINDOW=TAIJI_TUNING.parryWindowMs; // パリィ受付(ms): ガードを押した瞬間からこの時間内の被弾を弾く
function taijiSetGuard(on){
  const k=APP.taiji,now=performance.now();if(!k)return;
  if(k.done){if(!on){k.guarding=false;updateTaijiControlsUi();}return;}
  if(taijiTutorialBlocked(k)){k.guarding=false;updateTaijiControlsUi();return;}
  if(on){
    if(taijiIsDrinking(k)){taijiMsg("飲み終えるまで構えられない",520);return;}
    if((k.guardMeter||0)<=4){beep(180,.08,"square",.06);return;} // メーター切れでは構えられない
    if(now_within_roll(k))return; // ローリング中は不可
    if(!k.guarding&&!taijiSpendStamina(8,"受け"))return;
    const wasGuarding=k.guarding;k.guarding=true;
    // パリィ受付窓は「構え始めた瞬間」のみ開く(長押し/キーリピートでの連続パリィを防止)
    if(!wasGuarding){if(now>=(k.parryCd||0)){k.parryUntil=now+TAIJI_PARRY_WINDOW;k.parryCd=now+TAIJI_TUNING.parryCdMs;}beep(360,.04,"triangle",.05);}
  }else{
    k.guarding=false;
  }
  updateTaijiControlsUi();
}
function now_within_roll(k){return performance.now()<(k.rollUntil||0);}
// ジャストガード(パリィ)成功: ダメージ無効＋反撃ダメージ＋演出
function taijiParry(reflectProj=null){
  const k=APP.taiji;if(!k)return;
  k.parries=(k.parries||0)+1;
  k.guardMeter=Math.min(100,(k.guardMeter||0)+24); // パリィ成功で受けが回復
  k.stamina=Math.min(k.staminaMax||100,(k.stamina||0)+18);k.exhausted=false;updateTaijiStaminaUi();
  // 演出: 閃光フラッシュ＋「パリィ！」の大きな文字＋火花リング
  const pf=$("parryFlash");if(pf){pf.classList.remove("show");void pf.offsetWidth;pf.classList.add("show");}
  const pt=$("parryText");if(pt){pt.classList.remove("show");void pt.offsetWidth;pt.classList.add("show");}
  taijiMsg("",1); // 中央メッセージは大文字演出に任せる
  // 効果音: 金属的な弾き「キィン!」＋反撃の刃
  if(!(typeof SFX!=="undefined"&&SFX.playSe&&SFX.playSe("slash",.6))){beep(300,.05,"square",.07);}
  beep(1650,.045,"square",.085);
  setTimeout(()=>beep(2150,.05,"triangle",.07),28);
  setTimeout(()=>beep(1280,.14,"triangle",.055),95);
  taijiFloat("PARRY", "guard",50,42);
  if(reflectProj)taijiReflectBossProjectile(k,reflectProj);
  // 最寄りのボスへ反撃ダメージ＋ひるみ
  if(!reflectProj&&typeof taijiBossList==="function"){let nb=null,nd=Infinity;taijiBossList(k).forEach(b=>{if(!b.dead){const dd=b.g.position.distanceTo(player.pos);if(dd<nd){nd=dd;nb=b;}}});
    if(nb&&nd<16){damageBoss(nb,TAIJI_TUNING.parryCounterDmg,"parry");nb.nextAtk=performance.now()+TAIJI_TUNING.parryCounterStunMs;}}
  const dv=$("dangerVignette");if(dv){dv.style.opacity=0;} // 被弾ビネットは出さない
  const gb=$("tjGuardBtn");if(gb){gb.classList.add("parry");setTimeout(()=>{if(!APP.taiji||performance.now()>=(APP.taiji.parryUntil||0))gb.classList.remove("parry");},300);}
  /* 波G: 桃霞予兆中の弾き=見切り。体勢を崩して火力チャンスを作る */
  const nowMK=performance.now();
  if(APP.taiji)taijiBossList(APP.taiji).forEach(bb=>{
    if(!bb.dead&&nowMK<(bb._tjf3SignUntil||0)){
      bb._tjf3SignUntil=0;bb._tjf3Stagger=nowMK+TAIJI_TUNING.mikiriStaggerMs;
      damageBoss(bb,TAIJI_TUNING.mikiriBonusDmg,"parry");
      taijiWorldFloat(taijiBossAimPoint(bb)||bb.g.position,"見切った！","guard");
      taijiMsg("体勢を崩した！ 今が好機",1400);
      beep(1480,.09,"triangle",.1);
    }
  });
}
function taijiReflectBossProjectile(k,p){
  if(!p||p.reflected)return;
  const b=(k.lockOn&&k.lockTarget&&!k.lockTarget.dead)?k.lockTarget:taijiNearestBossTarget(k);
  const target=taijiBossAimPoint(b);
  if(!target)return;
  const dir=target.clone().sub(p.m.position);if(dir.lengthSq()<.01)dir.set(0,0,-1);dir.normalize();
  p.dir.copy(dir);p.spd=Math.max(12,(p.spd||7)*1.45);p.dmg=Math.max(12,Math.ceil((p.dmg||6)*1.8));p.slow=0;
  p.homing=Math.max(p.homing||0,.045);p.reflected=true;p.target=b;p.born=performance.now();p.lifetime=3600;
  if(p.m&&p.m.material&&p.m.material.color)p.m.material.color.setHex(0xfff1a6);
  if(p.m)p.m.scale.multiplyScalar(1.18);
}
function updateTaijiControlsUi(){
  const k=APP.taiji;if(!k)return;const now=performance.now();
  const cd=Math.max(0,Math.min(1,((k.dodgeCd||0)-now)/820));
  if($("tjCoolFill"))$("tjCoolFill").style.width=(cd*100)+"%";
  const ready=now>=(k.dodgeCd||0);
  if($("twDodge"))$("twDodge").classList.toggle("ready",ready);
  if($("tjDodgeBtn"))$("tjDodgeBtn").classList.toggle("cooling",!ready);
  if($("tjGuardFill"))$("tjGuardFill").style.width=(k.guardMeter==null?100:k.guardMeter)+"%";
  updateTaijiStaminaUi();
  updateTaijiSakeUi();
  updateKotodamaButtonUi();
  const gb=$("tjGuardBtn");if(gb){gb.classList.toggle("on",!!k.guarding);gb.classList.toggle("parry",!!k.guarding&&now<(k.parryUntil||0));}
  document.body.classList.toggle("guarding-now",!!k.guarding);
  document.body.classList.toggle("taiji-lock",!!k.lockOn);
  document.body.classList.toggle("taiji-weapon-bow",k.weapon==="bow");
  document.body.classList.toggle("taiji-weapon-seal",k.weapon==="seal");
  document.body.classList.toggle("taiji-weapon-sword",k.weapon==="sword");
}
function angleDelta(a,b){let d=((a-b+Math.PI)%(Math.PI*2))-Math.PI;if(d<-Math.PI)d+=Math.PI*2;return d;}
function taijiBossAimPoint(b){
  if(!b||!b.g)return null;
  if(b.faceLocal)return b.g.localToWorld(b.faceLocal.clone());
  if(b.g.userData.faceLocal)return b.g.localToWorld(b.g.userData.faceLocal.clone());
  const v=new THREE.Vector3();b.g.getWorldPosition(v);
  v.y+=(b.role==="chochin")?1.3:(b.cfg&&b.cfg.attack==="blizzard"?2.35:b.phase2?2.6:1.75);
  return v;
}
function taijiBossAtScreen(sx,sy){
  const k=APP.taiji;if(!k||typeof taijiBossList!=="function")return null;
  const mouse={x:sx/innerWidth*2-1,y:-(sy/innerHeight)*2+1};
  raycaster.setFromCamera(mouse,camera);
  let best=null,bestD=Infinity;
  taijiBossList(k).forEach(b=>{
    if(!b||b.dead||!b.g)return;
    const meshes=[];b.g.updateMatrixWorld(true);b.g.traverse(o=>{if(o.isMesh&&o.visible)meshes.push(o);});
    const hit=meshes.length?raycaster.intersectObjects(meshes,true)[0]:null;
    if(hit&&hit.distance<bestD){best=b;bestD=hit.distance;}
  });
  return best;
}
function taijiToggleLockAtScreen(sx,sy){
  const k=APP.taiji;if(!k||k.done)return false;
  const b=taijiBossAtScreen(sx,sy);
  if(!b)return false;
  if(k.lockOn&&k.lockTarget===b){k.lockOn=false;k.lockTarget=null;taijiRestoreLockCamera(k);taijiMsg("ロック解除",650);beep(420,.045,"triangle",.055);}
  else{k.lockOn=true;k.lockTarget=b;taijiMsg("ロックオン",650);beep(760,.045,"triangle",.055);}
  updateTaijiControlsUi();
  return true;
}
function taijiNearestBossTarget(k){
  if(!k||typeof taijiBossList!=="function")return null;
  const list=taijiBossList(k).filter(b=>b&&!b.dead&&b.g);
  if(!list.length)return null;
  if(k.lockTarget&&list.includes(k.lockTarget))return k.lockTarget;
  let best=list[0],bestScore=Infinity;
  for(const b of list){
    const p=taijiBossAimPoint(b);if(!p)continue;
    const dx=p.x-player.pos.x,dz=p.z-player.pos.z,d=Math.hypot(dx,dz);
    const yaw=Math.atan2(-dx,-dz),off=Math.abs(angleDelta(yaw,player.yaw));
    const score=d+off*8;
    if(score<bestScore){best=b;bestScore=score;}
  }
  k.lockTarget=best;return best;
}
function taijiSetLockOn(on){
  const k=APP.taiji;if(!k)return;
  if(on&&!taijiNearestBossTarget(k)){taijiMsg("ロックオン対象がいない",650);beep(180,.06,"square",.05);return;}
  k.lockOn=!!on;if(!k.lockOn){k.lockTarget=null;taijiRestoreLockCamera(k);const m=$("tjf2LockMark");if(m)m.style.display="none";}
  updateTaijiControlsUi();
  taijiMsg(k.lockOn?"ロックオン":"ロック解除",620);
  beep(k.lockOn?760:420,.045,"triangle",.055);
}
function taijiAutoLockBoss(k){
  if(!k)return;
  k.lockOn=true;k.lockTarget=null;
  taijiNearestBossTarget(k);
  updateTaijiControlsUi();
}
function taijiRestoreLockCamera(k){
  if(k&&k._lockPrevFov!=null&&camera){camera.fov=k._lockPrevFov;camera.updateProjectionMatrix();k._lockPrevFov=null;}
}
function taijiUpdateLockOn(dt){
  if(!APP.taiji||!APP.taiji.lockOn||APP.taiji.done){const m=$("tjf2LockMark");if(m)m.style.display="none";if(APP.taiji)taijiRestoreLockCamera(APP.taiji);}
  const k=APP.taiji;if(!k||!k.lockOn||k.done)return;
  const b=taijiNearestBossTarget(k),target=taijiBossAimPoint(b);
  if(!target){taijiSetLockOn(false);return;}
  const large=b.cfg.attack==="oni"||b.cfg.attack==="souls"||b.phase2;
  const focusY=large?b.g.position.y+(target.y-b.g.position.y)*.56:target.y;
  const dx=target.x-player.pos.x,dz=target.z-player.pos.z,dy=focusY-(player.pos.y+.12);
  const flat=Math.max(.001,Math.hypot(dx,dz));
  const wantYaw=Math.atan2(-dx,-dz);
  const wantPitch=Math.max(-.84,Math.min(.52,Math.atan2(dy,flat)));
  const yawRate=Math.min(1,dt*4.1),pitchRate=Math.min(1,dt*3.2);
  player.yaw+=angleDelta(wantYaw,player.yaw)*yawRate;
  player.pitch+=((wantPitch-player.pitch)*pitchRate);
  if(large){if(k._lockPrevFov==null)k._lockPrevFov=camera.fov;camera.fov+=(Math.min(90,k._lockPrevFov+9)-camera.fov)*Math.min(1,dt*3);camera.updateProjectionMatrix();}
  else taijiRestoreLockCamera(k);
  const mark=$("tjf2LockMark");
  if(mark&&b&&camera){
    const p=target.clone();p.project(camera);
    if(p.z<-1||p.z>1){mark.style.display="none";}
    else{mark.style.display="block";mark.style.left=((p.x*.5+.5)*100)+"%";mark.style.top=((-p.y*.5+.5)*100)+"%";}
  }
}
function taijiTrySeimeiHeal(sx,sy){
  const k=APP.taiji,sei=creatures&&creatures.seimei&&creatures.seimei.g;if(!k||!sei||!sei.visible||k.seimeiHealUsed)return false;
  if(player.pos.distanceTo(sei.position)>9)return false;
  const meshes=[];sei.traverse(o=>{if(o.isMesh)meshes.push(o);});
  raycaster.setFromCamera({x:sx/innerWidth*2-1,y:-(sy/innerHeight)*2+1},camera);
  if(!raycaster.intersectObjects(meshes,false).length)return false;
  k.seimeiHealUsed=true;k.hp=k.maxHp;updateTaijiHp();taijiMsg("晴明の祈祷で体力が戻った。一度きりの加護だ",2600);toast("安倍晴明が傷を癒やした",2200);
  if(!(typeof SFX!=="undefined"&&SFX.playSe("heal",.6)))beep(528,.22,"sine",.08);
  if(k.bossSpawned)taijiTriggerHealPunish(k);
  return true;
}
function taijiQuit(){
  const k=APP.taiji;if(!k)return;k.done=true;
  taijiRestoreLockCamera(k);
  kotodamaForceClose();
  hideModeBrief(true);
  k.spirits.forEach(sp=>{const i=rayTargets.indexOf(sp.g.userData.inner);if(i>=0)rayTargets.splice(i,1);taijiDisposeSpirit(sp);});
  taijiBossList(k).forEach(b=>{if(b.g)scene.remove(b.g);});
  _clearTaijiFx();
  taijiClearCombatUi();
  creatures.oni.forEach(o=>{o.taijiAlive=true;o.dispelledUntil=0;});
  taijiClearBossGate(k);
  taijiSetLightScene(false);AUTO_TIME._paused=false;AUTO_TIME._last=performance.now();
  document.body.classList.remove("taiji-mode","taiji-lock","taiji-brief-blocked");
  renderer.shadowMap.autoUpdate=true;renderer.shadowMap.needsUpdate=true;
  $("bossBar").style.display="none";$("bossBar2").style.display="none";$("taijiHud").style.display="none";
  document.body.classList.remove("guarding-now","taiji-lock","taiji-weapon-bow","taiji-weapon-seal","taiji-weapon-sword");
  if(APP._prevJoyDyn!==undefined){joy.dynamic=APP._prevJoyDyn;joyRelease();if(typeof updateControlUI==="function")updateControlUI();}
  resetInputState();
  APP.taiji=null;APP.mode="walk";$("modeTag").textContent="自由散策";
}
function taijiBossList(k){return (k&&k.bosses)?k.bosses:(k&&k.boss?[k.boss]:[]);}
function _clearTaijiFx(){
  if(typeof bossProjs!=="undefined"){bossProjs.forEach(p=>taijiDisposeFx(p.m));bossProjs.length=0;}
  if(typeof bossHazards!=="undefined"){bossHazards.forEach(h=>{taijiDisposeFx(h.m);if(h.guide)taijiDisposeFx(h.guide);});bossHazards.length=0;}
  if(typeof taijiArrows!=="undefined"){taijiArrows.forEach(a=>taijiDisposeFx(a.g));taijiArrows.length=0;}
  if(typeof taijiWaves!=="undefined"){taijiWaves.forEach(w=>taijiDisposeFx(w.g));taijiWaves.length=0;}
  taijiClearPolish();
  if(typeof SFX!=="undefined")SFX.stopBossBgm();
}
function endTaiji(failed){
  const k=APP.taiji;if(!k)return;
  taijiRestoreLockCamera(k);
  kotodamaForceClose();
  hideModeBrief(true);
  renderer.shadowMap.autoUpdate=true;renderer.shadowMap.needsUpdate=true;
  // 波AN: ボス戦で一時的に下げた描画品質を、戦闘前の設定(オート/ユーザープリセット)へ復元
  if(IS_TOUCH&&typeof QUALITY!=="undefined"&&APP._prevGfxForced!==undefined){
    QUALITY.setForced(APP._prevGfxForced);APP._prevGfxForced=undefined;
  }
  $("bossBar").style.display="none";$("bossBar2").style.display="none";
  taijiClearCombatUi();
  $("bossBar").classList.remove("tjf2-rage");$("bossBar2").classList.remove("tjf2-rage");
  taijiBossList(k).forEach(b=>{if(b.g)scene.remove(b.g);});
  _clearTaijiFx();
  creatures.oni.forEach(o=>{o.taijiAlive=true;o.dispelledUntil=0;});
  taijiClearBossGate(k);
  taijiSetLightScene(false);AUTO_TIME._paused=false;AUTO_TIME._last=performance.now();
  k.spirits.forEach(sp=>{
    if(sp.alive){const idx=rayTargets.indexOf(sp.g.userData.inner);if(idx>=0)rayTargets.splice(idx,1);}
    taijiDisposeSpirit(sp);
  });
  document.body.classList.remove("taiji-mode","guarding-now","taiji-lock","taiji-brief-blocked","taiji-weapon-bow","taiji-weapon-seal","taiji-weapon-sword");
  if(APP._prevJoyDyn!==undefined){joy.dynamic=APP._prevJoyDyn;joyRelease();if(typeof updateControlUI==="function")updateControlUI();}
  resetInputState();
  const elapsed=(performance.now()-k.tStart)/1000,total=k.total||TAIJI_SPOTS.length,hit=k.shot;
  /* 波O: ストーリー内ボス戦は結果画面を出さず、勝敗と被弾数だけ物語へ返す */
  if(APP.storyTaiji){
    const cb=APP.storyTaiji;APP.storyTaiji=null;
    const hits=k.hitsTaken||0;
    APP.taiji=null;$("taijiHud").style.display="none";
    if(cb.done)cb.done(!failed,hits);
    return;
  }
  if(k.bossRush){
    const cleared=k.rushCleared||0,all=(k.rushQueue&&k.rushQueue.length)||4;
    $("resTitle").textContent="⚔ ボスラッシュ 結果";
    if(failed){
      $("resRank").textContent="敗北";
      $("resDetail").innerHTML=`四鬼夜行に挑むも力尽きた…<br>撃破: <b>${cleared}/${all}体</b>　時間: <b>${elapsed.toFixed(1)}秒</b>${taijiResultPolish(k)}<br><br><span style="font-size:11px;color:#aa88cc">回避で被弾を避け、破魔の札の連射でボスのHPを削ろう。</span>`;
      seNG();
    }else{
      const rank=elapsed<150?["四神を統べる者","ししんをすべるもの — 全ボス撃破・神速の除霊！"]:
                 elapsed<240?["陰陽師頭","おんみょうじのかしら — 四季の主すべてを討ち取った！"]:
                             ["除霊の達人","じょれいのたつじん — ボスラッシュ完全制覇！"];
      $("resRank").textContent=rank[0];
      $("resDetail").innerHTML=`難易度: <b>${(k.diff&&k.diff.label)||"通常"}</b>　撃破: <b>${cleared}/${all}体</b>　残り体力: <b>${Math.ceil(k.hp)}</b>　時間: <b>${elapsed.toFixed(1)}秒</b><br>${rank[1]}${taijiResultPolish(k)}<br><br><span style="font-size:11px;color:#aa88cc">春→夏→秋→冬、四季の主を連続で撃破！</span>`;
      juiceCelebrate(); // 波B: ボスラッシュ制覇は紙吹雪
      markDailyMission("taiji");
      recordProgress("taiji",1);gainParam("action",5);gainParam("focus",2);
      seOK();
    }
    setTaijiResultActions();
    showResultPanel();
    APP.taiji=null;APP.mode="walk";$("taijiHud").style.display="none";$("modeTag").textContent="自由散策";
    return;
  }
  if(failed){
    $("resTitle").textContent="物の怪退治 結果";
    $("resRank").textContent="敗北";
    $("resDetail").innerHTML=`物の怪に襲われ気を失った…<br>退散: <b>${hit}/${total}体</b>　残り体力: <b>0</b>${taijiResultPolish(k)}<br><br><span style="font-size:11px;color:#aa88cc">逃げながら破魔の矢を当てよう。破魔の札(衝撃波)で囲まれた敵を薙ぎ払える。</span>`;
    setTaijiResultActions();
    showResultPanel();seNG();
    APP.taiji=null;APP.mode="walk";$("taijiHud").style.display="none";$("modeTag").textContent="自由散策";
    return;
  }
  const rank=hit>=total&&elapsed<60?["陰陽師頭","おんみょうじのかしら — 完全退散！神速の呪!"]:
             hit>=total&&elapsed<120?["安倍晴明","あべのせいめい — 見事な除霊の腕前！"]:
             hit>=total-2?["式神使い","しきがみつかい — あと少しで完全退散！"]:
             hit>=4?["下級法師","かきゅうほうし — 修行次第で陰陽師の道も開けるかも"]:
                    ["俗人","ぞくじん — 霊力が足りなかった…弓矢の稽古から！"];
  $("resTitle").textContent="物の怪退治 結果";
  $("resRank").textContent=rank[0];
  $("resDetail").innerHTML=`難易度: <b>${(k.diff&&k.diff.label)||"通常"}</b>　退散: <b>${hit}/${total}体</b>　追い祓い: <b>${k.bonus||0}</b>　外れ: <b>${k.miss}回</b>　時間: <b>${elapsed.toFixed(1)}秒</b><br>${rank[1]}${taijiResultPolish(k)}<br><br><span style="font-size:11px;color:#aa88cc">武器: ${k.weapon==="bow"?"🏹破魔の矢（単体）":"🔮破魔の札（衝撃波）"}</span>`;
  if(hit>=total&&elapsed<120)juiceCelebrate(); // 波B: 陰陽師頭・安倍晴明は紙吹雪
  markDailyMission("taiji");
  recordProgress("taiji",1);gainParam("action",4);gainParam("focus",1);
  setTaijiResultActions();
  showResultPanel();seOK();
  APP.taiji=null;APP.mode="walk";$("taijiHud").style.display="none";
  $("modeTag").textContent="自由散策";
}
const YOKAI_NAME={hitodama:"人魂",kappa:"河童",chochin:"提灯お化け",kitsunebi:"狐火",yukionna:"雪女"};
function taijiMsg(s,ms){$("taijiMsg").textContent=s;clearTimeout(window._tjMsgT);window._tjMsgT=setTimeout(()=>{if($("taijiMsg"))$("taijiMsg").textContent="";},ms||1300);}
const TAIJI_STAGE_NAME={spring:"九尾狐",summer:"河童の主・提灯お化け",autumn:"巨大人魂",winter:"雪女王"};
function taijiStageLabel(k){
  if(!k)return "物の怪退治";
  if(k.bossRush)return "四季の主を連続討伐";
  const n=TAIJI_STAGE_NAME[k.season]||"物の怪";
  return `${n} 討伐`;
}
function taijiCine(title,sub,ms=1700){
  const box=$("taijiCine");if(!box)return;
  $("taijiCineTitle").textContent=title||"物の怪退治";
  $("taijiCineSub").textContent=sub||"霧の結界が閉じる";
  box.classList.remove("show");void box.offsetWidth;box.classList.add("show");
  clearTimeout(window._tjCineT);window._tjCineT=setTimeout(()=>{if(box)box.classList.remove("show");},REDUCED_MOTION?Math.min(ms,900):ms);
}
/* 波E: ボス戦三大演出(見参ネームカード・祓討の金文字・力尽きの赤文字) */
function tjfxBossIntro(name,iconUrl){
  const card=$("tjfxNameCard");if(!card)return;
  const nameEl=card.querySelector(".tjfx-nc-name");if(nameEl)nameEl.innerHTML=taijiNameRuby(name||"");
  const iconEl=card.querySelector(".tjfx-nc-icon");
  if(iconEl){if(iconUrl){iconEl.src=iconUrl;iconEl.style.display="block";}else iconEl.style.display="none";}
  clearTimeout(window._tjfxNameT);clearTimeout(window._tjfxNameT2);
  card.classList.remove("show","hide");void card.offsetWidth;
  card.style.display="block";card.classList.add("show");
  const holdMs=REDUCED_MOTION?1500:2400;
  window._tjfxNameT=setTimeout(()=>{
    card.classList.remove("show");card.classList.add("hide");
    window._tjfxNameT2=setTimeout(()=>{card.style.display="none";card.classList.remove("hide");},REDUCED_MOTION?0:520);
  },holdMs);
  beep(98,.5,"sine",.22);beep(147,.4,"sine",.12);
  setTimeout(()=>beep(196,.3,"sine",.1),400);
  const fill=$("bossHpFill");
  if(fill){
    if(REDUCED_MOTION){fill.style.width="100%";}
    else{
      fill.style.transition="width 1.1s cubic-bezier(.2,.6,.3,1)";
      fill.style.width="0%";
      requestAnimationFrame(()=>requestAnimationFrame(()=>{fill.style.width="100%";}));
      clearTimeout(window._tjfxHpSweepT);
      window._tjfxHpSweepT=setTimeout(()=>{fill.style.transition="";},1300);
    }
  }
}
function tjfxFelled(text){
  const box=$("tjfxFelled");if(!box)return;
  const t=box.querySelector(".tjfx-band-text");if(t)t.textContent=text||"";
  const band=box.querySelector(".tjfx-band");
  clearTimeout(window._tjfxFelledT);clearTimeout(window._tjfxFelledT2);
  box.classList.remove("show");box.style.display="flex";
  if(REDUCED_MOTION){
    if(band){band.style.transition="none";band.style.opacity="1";}
    box.classList.add("show");
    window._tjfxFelledT=setTimeout(()=>{box.classList.remove("show");box.style.display="none";},1600);
  }else{
    if(band){band.style.transition="opacity .35s ease";band.style.opacity="0";void band.offsetWidth;band.style.opacity="1";}
    box.classList.add("show");
    window._tjfxFelledT=setTimeout(()=>{
      if(band){band.style.transition="opacity .6s ease";band.style.opacity="0";}
      window._tjfxFelledT2=setTimeout(()=>{box.classList.remove("show");box.style.display="none";},600);
    },2200);
  }
  if(typeof juiceShake==="function")juiceShake();
  beep(660,.12);setTimeout(()=>beep(495,.18),140);setTimeout(()=>beep(330,.5,"sine",.18),300);
}
function tjfxDied(){
  const box=$("tjfxDied");if(!box)return;
  const band=box.querySelector(".tjfx-band");
  const t=box.querySelector(".tjfx-band-text");if(t)t.textContent="力尽キタリ"; // 敗北の赤文字(YOU DIED相当)
  clearTimeout(window._tjfxDiedT);clearTimeout(window._tjfxDiedT2);
  box.classList.remove("show");box.style.display="flex";
  if(REDUCED_MOTION){
    if(band){band.style.transition="none";band.style.opacity="1";}
    box.classList.add("show");
    window._tjfxDiedT=setTimeout(()=>{box.classList.remove("show");box.style.display="none";},1800);
  }else{
    if(band){band.style.transition="opacity .5s ease";band.style.opacity="0";void band.offsetWidth;band.style.opacity="1";}
    box.classList.add("show");
    window._tjfxDiedT=setTimeout(()=>{
      if(band){band.style.transition="opacity .5s ease";band.style.opacity="0";}
      window._tjfxDiedT2=setTimeout(()=>{box.classList.remove("show");box.style.display="none";},500);
    },1800);
  }
  beep(220,.6,"sine",.2);setTimeout(()=>beep(165,.9,"sine",.16),250);
}
function taijiFloat(text,kind="good",x=50,y=50){
  const layer=$("taijiDmgLayer");if(!layer)return;
  while(layer.children.length>14)layer.removeChild(layer.firstChild);
  const el=document.createElement("div");
  el.className="tj-dmg "+kind;
  el.textContent=text;
  const jx=(Math.random()-.5)*7,jy=(Math.random()-.5)*5;
  el.style.left=Math.max(7,Math.min(93,x+jx))+"%";
  el.style.top=Math.max(12,Math.min(86,y+jy))+"%";
  layer.appendChild(el);
  setTimeout(()=>{if(el.parentNode)el.parentNode.removeChild(el);},940);
}
function taijiWorldFloat(pos,text,kind="good"){
  if(!pos||!camera){taijiFloat(text,kind);return;}
  const p=pos.clone();p.project(camera);
  if(p.z<-1||p.z>1){taijiFloat(text,kind);return;}
  taijiFloat(text,kind,(p.x*.5+.5)*100,(-p.y*.5+.5)*100);
}
function taijiComboHit(kind,amount,b){
  const k=APP.taiji;if(!k)return;
  const now=performance.now();
  if(now-(k.comboAt||0)>2400)k.combo=0;
  k.combo=(k.combo||0)+1;k.comboAt=now;k.bestCombo=Math.max(k.bestCombo||0,k.combo);
  const label=k.combo>=16?"神楽の連撃":k.combo>=10?"破魔連舞":k.combo>=5?"追い祓い":kind==="parry"||kind==="reflect"?"返し祓い":"手応え";
  const el=$("taijiCombatRank");if(el){el.textContent=`${label}  ${k.combo}連撃`;el.classList.add("show");k.comboUiUntil=now+1300;}
  if((kind==="parry"||kind==="reflect")&&b)taijiWorldFloat(taijiBossAimPoint(b)||b.g.position,"返し祓い","guard");
}
function taijiResetCombo(){
  const k=APP.taiji;if(!k)return;
  if((k.combo||0)>=5)taijiFloat(`${k.combo}連撃途切れ`, "mute",50,45);
  k.combo=0;k.comboAt=0;
  const el=$("taijiCombatRank");if(el)el.classList.remove("show");
}
function taijiBossTone(b){
  if(!b||!b.cfg)return "気配";
  if(b.role==="kappa")return "水圧";
  if(b.role==="chochin")return "怪火";
  const at=b.cfg.attack;
  return at==="dart"?"狐火":at==="blizzard"?"氷気":at==="oni"?"鬼気":at==="souls"?"怨念":"気配";
}
function taijiUpdatePolish(k,now){
  if(!k)return;
  document.body.classList.toggle("taiji-lowhp",APP.mode==="taiji"&&!k.done&&(k.hp/k.maxHp)<.28);
  const rank=$("taijiCombatRank");if(rank&&k.comboUiUntil&&now>k.comboUiUntil)rank.classList.remove("show");
  const chips=$("bossStatusChips");if(chips){chips.style.display="none";chips.textContent="";chips.dataset.sig="";}
}
function taijiClearPolish(){
  document.body.classList.remove("taiji-lowhp");
  const ids=["taijiCine","taijiCombatRank","bossStatusChips"];
  ids.forEach(id=>{const el=$(id);if(el){el.classList.remove("show");if(id==="bossStatusChips"){el.style.display="none";el.textContent="";el.dataset.sig="";}}});
  const layer=$("taijiDmgLayer");if(layer)layer.textContent="";
}
function taijiResultPolish(k){
  if(!k)return "";
  const best=k.bestCombo||0,par=k.parries||0,hit=k.hitsTaken||0,guard=k.guards||0;
  const title=best>=16?"祓いの型: 神楽":best>=9?"祓いの型: 連舞":par>=3?"祓いの型: 返し札":"祓いの型: 堅実";
  return `<br><span style="font-size:11px;color:#aa88cc">${title} / 最大連撃: <b>${best}</b>　弾き: <b>${par}</b>　受け: <b>${guard}</b>　お神酒: <b>${k.sakeUsed||0}</b>　被弾: <b>${hit}</b></span>`;
}
function updateTaijiFudaUi(){
  const k=APP.taiji,btn=$("twSeal");if(!btn||!k)return;
  const small=btn.querySelector("small"),badge=btn.querySelector(".er-badge");
  const chain=k.fudaBurst?Math.max(0,k.fudaChain||0):0;
  btn.classList.toggle("charged",!!k.fudaBurst);
  btn.classList.toggle("waiting",!k.fudaBurst);
  if(small)small.textContent=k.fudaBurst?`連札 ${chain}/2 / 2`:"2 / タップ右上";
  if(badge)badge.textContent=k.fudaBurst?`連札 ${chain}/2`:"待機";
}
/* 効果音 */
function seArrowShot(){if(typeof SFX!=="undefined"&&SFX.playSe("arrowShot",.62))return;beep(900,.05,"square",.07);setTimeout(()=>beep(560,.06,"square",.06),38);}
function seArrowHit(){if(typeof SFX!=="undefined"&&SFX.playSe("arrowHit",.6))return;beep(320,.1,"square",.10);}
function seFuda(){if(typeof SFX!=="undefined"&&SFX.playSe("fuda",.6))return;beep(190,.30,"sine",.13);setTimeout(()=>beep(95,.42,"sine",.10),28);}
function seMagic(key){if(typeof SFX!=="undefined")SFX.playSe(key,.55);}
/* 飛翔する破魔の矢・破魔の札の衝撃波(描画ループで更新) */
const taijiArrows=[],taijiWaves=[];
/* 戦闘fx(矢・弾・危険地帯・衝撃波)の破棄。全fxは毎回新規のgeometry/materialを持つ(共有なし)ため、
   sceneから外すだけではGPU側に蓄積し、長期戦・ボスラッシュでモバイルが不安定になる。
   除去は必ずこれを通す(material.disposeはテクスチャを触らないのでmap共有があっても安全) */
function taijiDisposeFx(o){
  if(!o)return;
  o.traverse(n=>{
    if(!n.isMesh)return;
    if(n.geometry)n.geometry.dispose();
    (Array.isArray(n.material)?n.material:[n.material]).forEach(m=>{if(m&&m.dispose)m.dispose();});
  });
  if(o.parent)o.parent.remove(o);
}
function spawnArrow(from,to,onHit){
  const dir=to.clone().sub(from),arrow=new THREE.Group();
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.55,5),new THREE.MeshBasicMaterial({color:0xf3e6c0}));arrow.add(shaft);
  const head=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.14,6),new THREE.MeshBasicMaterial({color:0xd8d0e8}));head.position.y=0.34;arrow.add(head);
  arrow.position.copy(from);arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize());arrow.renderOrder=8;
  arrow.traverse(o=>{if(o.material)o.material.depthTest=false;});scene.add(arrow);
  taijiArrows.push({g:arrow,from:from.clone(),to:to.clone(),t0:performance.now(),dur:Math.min(280,Math.max(90,dir.length()*11)),onHit,done:false});
}
function spawnShockwave(center){
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.4,0.62,40),new THREE.MeshBasicMaterial({color:0xbb88ff,transparent:true,opacity:0.75,side:THREE.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.set(center.x,0.14,center.z);ring.renderOrder=8;scene.add(ring);
  taijiWaves.push({g:ring,t0:performance.now(),dur:480,done:false});
}
function spawnSwordArc(){
  const f=taijiForwardVec(),p=player.pos.clone().add(f.clone().multiplyScalar(1.55));
  const mat=new THREE.MeshBasicMaterial({color:0xfff0c0,transparent:true,opacity:.82,depthWrite:false,depthTest:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  const arc=new THREE.Mesh(new THREE.TorusGeometry(1.05,.035,6,36,Math.PI*1.25),mat);
  arc.position.set(p.x,player.pos.y-.55,p.z);
  arc.rotation.x=Math.PI/2;arc.rotation.z=player.yaw+Math.PI*.18;arc.renderOrder=10;scene.add(arc);
  taijiWaves.push({g:arc,t0:performance.now(),dur:260,done:false,sword:true});
}
function updateTaijiFx(now){
  for(const a of taijiArrows){if(a.done)continue;const u=(now-a.t0)/a.dur;
    if(u>=1){a.g.position.copy(a.to);taijiDisposeFx(a.g);a.done=true;if(a.onHit)a.onHit();}else a.g.position.lerpVectors(a.from,a.to,u);}
  for(let i=taijiArrows.length-1;i>=0;i--)if(taijiArrows[i].done)taijiArrows.splice(i,1);
  for(const w of taijiWaves){if(w.done)continue;const u=(now-w.t0)/w.dur;
    if(u>=1){taijiDisposeFx(w.g);w.done=true;}else if(w.sword){const sc=1+u*.42;w.g.scale.set(sc,sc,sc);w.g.material.opacity=0.82*(1-u);}
    else{const sc=1+u*16;w.g.scale.set(sc,sc,sc);w.g.material.opacity=0.75*(1-u);}}
  for(let i=taijiWaves.length-1;i>=0;i--)if(taijiWaves[i].done)taijiWaves.splice(i,1);
}
/* 敵HPバー(ビルボード) */
function makeHpBar(){
  const c=document.createElement('canvas');c.width=64;c.height=12;const x=c.getContext('2d');
  const tex=new THREE.CanvasTexture(c);
  const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false}));
  spr.userData.taijiOwnedTexture=tex; // Sprite geometry is Three.js-shared; the canvas map belongs to this HP bar.
  spr.scale.set(0.95,0.18,1);spr.renderOrder=9;
  spr.userData.draw=function(frac){x.clearRect(0,0,64,12);x.fillStyle="rgba(0,0,0,.62)";x.fillRect(0,0,64,12);
    x.fillStyle=frac>0.5?"#6de08a":frac>0.25?"#e0c04a":"#e05a5a";x.fillRect(2,2,(60)*Math.max(0,frac),8);
    x.strokeStyle="rgba(255,255,255,.55)";x.lineWidth=1;x.strokeRect(0.5,0.5,63,11);tex.needsUpdate=true;};
  spr.userData.draw(1);return spr;
}
function taijiDisposeSpirit(sp){
  const root=sp?.g;if(!root)return;
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(o=>{
    // makeTaijiKekkai creates two unique sphere geometries and materials per spirit.
    if(o.isMesh&&o.geometry)geometries.add(o.geometry);
    if(o.isMesh||o.isSprite)for(const material of [].concat(o.material||[]))materials.add(material);
    if(o.userData.taijiOwnedTexture)textures.add(o.userData.taijiOwnedTexture);
  });
  if(root.parent)root.parent.remove(root);
  for(const geometry of geometries)geometry.dispose();
  for(const texture of textures)texture.dispose();
  for(const material of materials)material.dispose();
  if(sp.hpbar)sp.hpbar.userData.draw=null;
}
function updateSpiritHp(sp){if(sp.hpbar)sp.hpbar.userData.draw(Math.max(0,sp.hp/(sp.maxHp||1)));}
/* 配置妖怪の特徴的な攻撃 */
function taijiYokaiAttack(type){
  const k=APP.taiji;if(!k)return;
  if(type==="yukionna"){seMagic("ice");k.slowUntil=performance.now()+1700;taijiDamage(6,"雪女の冷気");taijiMsg("雪女の冷気！動きが鈍る");}
  else if(type==="kitsunebi"){seMagic("fire");taijiDamage(8,"狐火");taijiMsg("狐火に焼かれた！");}
  else if(type==="kappa"){seMagic("blunt");taijiDamage(12,"河童の引き込み");taijiMsg("河童に水へ引き込まれた！");}
  else if(type==="chochin"){seMagic("fire");taijiDamage(7,"提灯お化けの怪火");taijiMsg("提灯お化けの怪火！");}
  else {seMagic("thunder");taijiDamage(5,"人魂");taijiMsg("人魂に憑かれた…");}
}
function _killSpirit(k,s){s.alive=false;s.g.visible=false;k.shot++;
  juiceShake(); // 波B: 撃破の手応え
  taijiWorldFloat(s.g.position,"祓い", "good");taijiComboHit("spirit",1,null);
  const i=rayTargets.indexOf(s.g.userData.inner);if(i>=0)rayTargets.splice(i,1);}
function _spiritWinCheck(k){const remain=k.spirits.filter(s=>s.alive).length;if(!k.bossSpawned)$("taijiRemain").textContent=remain;
  if(remain<=0&&!k.bossSpawned){taijiPrepareBossGate(k,false);} // 雑魚を一掃したら北の対に霧門出現
  return remain;}
function taijiForwardVec(){
  return new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw)).normalize();
}
function taijiSwordConeHit(pos,range=4.0,cosHalf=.42){
  const f=taijiForwardVec(),v=pos.clone().sub(player.pos).setY(0),d=v.length();
  if(d<.01||d>range)return false;
  v.normalize();
  return f.dot(v)>=cosHalf;
}
function taijiSwordStep(combo){
  const f=taijiForwardVec(),step=combo>=3?.82:.48;
  let cx=Math.max(-57,Math.min(57,player.pos.x+f.x*step)),cz=Math.max(-57,Math.min(57,player.pos.z+f.z*step));
  if(typeof taijiClampBossArena==="function"){const bc=taijiClampBossArena(cx,cz);cx=bc.x;cz=bc.z;}
  player.pos.x=cx;player.pos.z=cz;player.pos.y=groundH(cx,cz)+1.62;
}
function taijiUseSake(){
  const k=APP.taiji,now=performance.now();if(!k||k.done)return;
  if(taijiTutorialBlocked(k))return;
  if((k.sake||0)<=0){taijiMsg("お神酒はもう残っていない",850);beep(140,.08,"square",.05);return;}
  if(now<(k.sakeCd||0)){taijiMsg("まだ飲めない",620);return;}
  k.sake--;k.sakeUsed=(k.sakeUsed||0)+1;k.sakeCd=now+2600;k.sakeDrinkUntil=now+560;k.vulnerableUntil=now+980;k.guarding=false;k.staminaDelay=.95;
  const heal=(k.diff&&k.diff.sakeHeal)||36;
  const before=k.hp;k.hp=Math.min(k.maxHp,k.hp+heal);k.slowUntil=Math.max(k.slowUntil||0,now+260);updateTaijiHp();updateTaijiSakeUi();
  taijiFloat(before>=k.maxHp-1?"お神酒 構え直し":"お神酒 +"+(k.hp-before),"guard",50,52);
  taijiMsg("お神酒で息を整えた",1000);toast("お神酒: 残り "+k.sake,1200);
  if(!(typeof SFX!=="undefined"&&SFX.playSe("heal",.52)))beep(620,.18,"sine",.07);
  if(k.bossSpawned)taijiTriggerHealPunish(k);
}
/* ============================================================
   言霊祓い — 体勢崩し(チャンス)専用の連鎖詠唱アタック(波AI)
   隣接するかな札をなぞって枕詞/祝詞を紡ぐと、繋いだ数だけ倍率が伸びる大ダメージになる。
   使用回数(kotodamaCharges)制限あり。開始と同時に体勢崩しを詠唱時間ぶん延長し、
   通常の連続攻撃と「同じ好機をどう使うか」の選択にする。
============================================================ */
function kotodamaTargetBoss(k){
  if(!k||(k.kotodamaCharges||0)<=0)return null;
  const now=performance.now();
  const list=typeof taijiBossList==="function"?taijiBossList(k):[];
  return list.find(b=>b&&!b.dead&&(now<(b.staggerUntil||0)||now<(b._tjf3Stagger||0)))||null;
}
function updateKotodamaButtonUi(){
  const k=APP.taiji,btn=$("twKotodama"),badge=$("tjKotodamaCount");if(!btn||!k)return;
  const n=Math.max(0,k.kotodamaCharges||0);
  if(badge)badge.textContent=String(n);
  btn.classList.toggle("empty",n<=0);
  btn.classList.toggle("ready",!(k.kotodama&&k.kotodama.active)&&!!kotodamaTargetBoss(k));
  if(k.kotodama&&k.kotodama.active)kotodamaTick(performance.now());
}
function kotodamaAdjacent(a,b,cols){
  const ar=Math.floor(a/cols),ac=a%cols,br=Math.floor(b/cols),bc=b%cols;
  return a!==b&&Math.abs(ar-br)<=1&&Math.abs(ac-bc)<=1;
}
const KOTODAMA_FILLER="あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろ";
function kotodamaBuildBoard(diffKey){
  const cols=KOTODAMA_TUNING.gridCols,rows=KOTODAMA_TUNING.gridRows,total=cols*rows;
  const wordCount=diffKey==="normal"?2:3;
  const byTier=t=>KOTODAMA_WORDS.filter(w=>w.tier===t);
  const t1=byTier(1),t2=byTier(2),t3=byTier(3);
  const candidates=[];
  if(t1.length)candidates.push(t1[Math.floor(Math.random()*t1.length)]);
  if(wordCount>=2&&t2.length)candidates.push(t2[Math.floor(Math.random()*t2.length)]);
  if(wordCount>=3&&t3.length)candidates.push(t3[Math.floor(Math.random()*t3.length)]);
  const cells=new Array(total).fill(null),used=new Array(total).fill(false);
  function tryPlace(word){
    const chars=Array.from(word.word);
    for(let attempt=0;attempt<80;attempt++){
      const startCands=[];for(let i=0;i<total;i++)if(!used[i])startCands.push(i);
      if(!startCands.length)return null;
      const path=[startCands[Math.floor(Math.random()*startCands.length)]];
      const visited=new Set(path);let ok=true;
      for(let i=1;i<chars.length;i++){
        const last=path[i-1],cands=[];
        for(let d=0;d<total;d++){if(!visited.has(d)&&!used[d]&&kotodamaAdjacent(last,d,cols))cands.push(d);}
        if(!cands.length){ok=false;break;}
        const next=cands[Math.floor(Math.random()*cands.length)];
        path.push(next);visited.add(next);
      }
      if(ok&&path.length===chars.length)return path;
    }
    return null;
  }
  const words=[];
  candidates.forEach(w=>{
    const path=tryPlace(w);
    if(path){const chars=Array.from(w.word);path.forEach((idx,i)=>{cells[idx]=chars[i];used[idx]=true;});words.push(w);}
  });
  for(let i=0;i<total;i++){if(!cells[i])cells[i]=KOTODAMA_FILLER[Math.floor(Math.random()*KOTODAMA_FILLER.length)];}
  return {cols,rows,cells,words};
}
function taijiOpenKotodama(){
  const k=APP.taiji;if(!k||k.done)return;
  if(taijiTutorialBlocked(k))return;
  if(k.kotodama&&k.kotodama.active)return;
  if((k.kotodamaCharges||0)<=0){taijiMsg("言霊の力を使い果たした",850);beep(140,.08,"square",.05);return;}
  const boss=kotodamaTargetBoss(k);
  if(!boss){taijiMsg("体勢を崩した好機にのみ使える",900);beep(160,.08,"square",.05);return;}
  k.kotodamaCharges--;
  const now=performance.now(),dur=KOTODAMA_TUNING.sessionMs;
  boss.staggerUntil=Math.max(boss.staggerUntil||0,now+dur); // 詠唱時間ぶん体勢崩しを縫い止める
  if(boss._tjf3Stagger)boss._tjf3Stagger=Math.max(boss._tjf3Stagger,now+dur);
  const board=kotodamaBuildBoard(k.diffKey);
  k.kotodama={active:true,boss,board,trace:[],consumed:new Set(),doneWords:new Set(),chainCount:0,totalDmg:0,startAt:now,endAt:now+dur};
  kotodamaRenderBoard();
  $("kotodamaOverlay").classList.add("show");
  taijiMsg("言霊祓い―かなを繋いで唱えよ！",1200);
  beep(520,.06,"triangle",.06);
  updateKotodamaButtonUi();
}
function kotodamaRenderBoard(){
  const k=APP.taiji;if(!k||!k.kotodama)return;
  const {board}=k.kotodama;
  const targetsEl=$("kdTargets");
  if(targetsEl)targetsEl.innerHTML=board.words.map((w,i)=>`<span class="kd-target" data-i="${i}">${w.word}</span>`).join("");
  const gridEl=$("kdGrid");
  if(gridEl){
    gridEl.innerHTML=board.cells.map((ch,i)=>`<div class="kd-tile" data-idx="${i}">${ch}</div>`).join("");
    gridEl.querySelectorAll(".kd-tile").forEach(el=>{
      const idx=+el.dataset.idx;
      el.addEventListener("pointerdown",e=>{e.preventDefault();kotodamaPointerDown(idx);});
      el.addEventListener("pointerenter",()=>kotodamaPointerEnter(idx));
    });
  }
  const linesEl=$("kdLines");if(linesEl)linesEl.innerHTML="";
  const chainEl=$("kdChainLabel");if(chainEl)chainEl.textContent="";
  const fill=$("kdTimerFill");if(fill)fill.style.width="100%";
}
function kotodamaPointerDown(idx){
  const k=APP.taiji;if(!k||!k.kotodama||!k.kotodama.active)return;
  const kd=k.kotodama;if(kd.consumed.has(idx))return;
  kd.trace=[idx];kotodamaRefreshTiles();
}
function kotodamaPointerEnter(idx){
  const k=APP.taiji;if(!k||!k.kotodama||!k.kotodama.active)return;
  const kd=k.kotodama;if(!kd.trace.length)return;
  const last=kd.trace[kd.trace.length-1];
  if(idx===last)return;
  if(kd.trace.length>=2&&kd.trace[kd.trace.length-2]===idx){kd.trace.pop();kotodamaRefreshTiles();return;} // 1つ戻ると取り消し
  if(kd.trace.includes(idx)||kd.consumed.has(idx))return;
  if(!kotodamaAdjacent(last,idx,kd.board.cols))return;
  kd.trace.push(idx);kotodamaRefreshTiles();
}
function kotodamaRefreshTiles(){
  const k=APP.taiji;if(!k||!k.kotodama)return;
  const kd=k.kotodama;
  document.querySelectorAll("#kdGrid .kd-tile").forEach(el=>{
    const idx=+el.dataset.idx;
    el.classList.toggle("active",kd.trace.includes(idx));
    el.classList.toggle("used",kd.consumed.has(idx));
  });
  kotodamaDrawLines();
}
function kotodamaDrawLines(){
  const k=APP.taiji;if(!k||!k.kotodama)return;
  const kd=k.kotodama,svg=$("kdLines"),grid=$("kdGrid");if(!svg||!grid)return;
  const gr=grid.getBoundingClientRect();
  svg.setAttribute("width",gr.width);svg.setAttribute("height",gr.height);
  let html="";
  for(let i=1;i<kd.trace.length;i++){
    const a=grid.querySelector(`.kd-tile[data-idx="${kd.trace[i-1]}"]`),b=grid.querySelector(`.kd-tile[data-idx="${kd.trace[i]}"]`);
    if(!a||!b)continue;
    const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();
    html+=`<line x1="${ar.left+ar.width/2-gr.left}" y1="${ar.top+ar.height/2-gr.top}" x2="${br.left+br.width/2-gr.left}" y2="${br.top+br.height/2-gr.top}"/>`;
  }
  svg.innerHTML=html;
}
function kotodamaPointerUp(){
  const k=APP.taiji;if(!k||!k.kotodama||!k.kotodama.active)return;
  const kd=k.kotodama;
  if(kd.trace.length>=2){
    const chars=kd.trace.map(i=>kd.board.cells[i]).join("");
    const hitIdx=kd.board.words.findIndex((w,i)=>!kd.doneWords.has(i)&&w.word===chars);
    if(hitIdx>=0){
      const hit=kd.board.words[hitIdx];
      kd.doneWords.add(hitIdx);
      kd.trace.forEach(idx=>kd.consumed.add(idx));
      const mulArr=KOTODAMA_TUNING.chainMul,mul=mulArr[Math.min(kd.chainCount,mulArr.length-1)];
      const dmg=Math.round((KOTODAMA_TUNING.tierDmg[hit.tier]||10)*mul);
      kd.chainCount++;kd.totalDmg+=dmg;
      const chip=document.querySelector(`.kd-target[data-i="${hitIdx}"]`);if(chip)chip.classList.add("done");
      const chainEl=$("kdChainLabel");if(chainEl)chainEl.textContent=hit.word+"「"+hit.mean+"」 連鎖"+kd.chainCount+"！ +"+dmg;
      beep(520+kd.chainCount*90,.09,"triangle",.08);
      if(kd.doneWords.size>=kd.board.words.length){kd.trace=[];kotodamaCloseSession(true);return;}
    }else{
      document.querySelectorAll("#kdGrid .kd-tile.active").forEach(el=>el.classList.add("fail"));
      setTimeout(()=>document.querySelectorAll("#kdGrid .kd-tile.fail").forEach(el=>el.classList.remove("fail")),300);
      beep(180,.07,"square",.06);
    }
  }
  kd.trace=[];kotodamaRefreshTiles();
}
function kotodamaTick(now){
  const k=APP.taiji;if(!k||!k.kotodama||!k.kotodama.active)return;
  const kd=k.kotodama,remain=Math.max(0,kd.endAt-now);
  const fill=$("kdTimerFill");if(fill)fill.style.width=(remain/KOTODAMA_TUNING.sessionMs*100)+"%";
  if(remain<=0||kd.boss.dead)kotodamaCloseSession(false);
}
function kotodamaCloseSession(fullClear){
  const k=APP.taiji;if(!k||!k.kotodama)return;
  const kd=k.kotodama;kd.active=false;
  let dmg=kd.totalDmg;
  if(fullClear&&dmg>0)dmg=Math.round(dmg*KOTODAMA_TUNING.fullClearMul);
  $("kotodamaOverlay").classList.remove("show");
  if(dmg>0&&kd.boss&&!kd.boss.dead){
    damageBoss(kd.boss,dmg,"kotodama");
    const el=$("kdResult");
    if(el){el.textContent=(fullClear?"皆伝・言霊 -":"言霊 -")+dmg;el.classList.remove("show");void el.offsetWidth;el.classList.add("show");}
    beep(760,.16,"sawtooth",.1);setTimeout(()=>beep(1020,.14,"triangle",.08),90);
    if(typeof juiceShake==="function"&&dmg>=20)juiceShake();
  }else{
    taijiMsg("言霊は届かなかった…",900);
  }
  k.kotodama=null;
  updateKotodamaButtonUi();
}
function kotodamaForceClose(){
  const k=APP.taiji;if(!k||!k.kotodama)return;
  const el=$("kotodamaOverlay");if(el)el.classList.remove("show");
  k.kotodama=null;
}
addEventListener("pointerup",kotodamaPointerUp);
bindTaijiTap($("twKotodama"),()=>taijiOpenKotodama());
if($("kdCancel"))$("kdCancel").addEventListener("click",()=>kotodamaCloseSession(false));
function taijiShoot(sx,sy){
  const k=APP.taiji;if(!k||k.done)return;
  if(taijiTutorialBlocked(k))return;
  if(taijiTrySeimeiHeal(sx,sy))return;
  if(sy<innerHeight*0.13){taijiSetWeapon(sx<innerWidth/3?"bow":sx<innerWidth*2/3?"seal":"sword");return;} // 上部隅タップで武器切替(スマホ/タブレット)
  if(k.weapon==="seal")taijiFuda();else if(k.weapon==="sword")taijiSword();else taijiArrow(sx,sy);
}
/* 太刀: 近距離・前方扇形。危険だが体幹を大きく削る */
function taijiSword(){
  const k=APP.taiji,now=performance.now();if(!k||k.done)return;
  if(taijiTutorialBlocked(k))return;
  if(taijiIsDrinking(k)){taijiMsg("飲み終えるまで斬れない",520);return;}
  if(now<(k.swordCd||0)){taijiMsg("太刀の構えが戻らない",520);return;}
  const combo=(now-(k.swordAt||0)<900)?Math.min(3,(k.swordCombo||0)+1):1;
  const cost=combo>=3?23:16;
  if(!taijiSpendStamina(cost,"太刀"))return;
  k.swordCombo=combo;k.swordAt=now;k.swordCd=now+(combo>=3?720:500);k.guarding=false;
  taijiSwordStep(combo);spawnSwordArc();
  if(typeof SFX!=="undefined"&&SFX.playSe)SFX.playSe("slash",.54);else{beep(760,.045,"triangle",.07);setTimeout(()=>beep(420,.055,"square",.05),45);}
  const range=combo>=3?4.65:4.15,cosHalf=combo>=3?.28:.38;
  let hits=0;
  k.spirits.forEach(s=>{
    if(!s.alive||!taijiSwordConeHit(s.g.position,range,cosHalf))return;
    s.hp-=combo>=3?2:1;updateSpiritHp(s);hits++;
    if(s.hp<=0){_killSpirit(k,s);}else taijiWorldFloat(s.g.position,"斬撃","good");
  });
  creatures.yokai.forEach(yk=>{if(yk.g.visible&&taijiSwordConeHit(yk.g.position,range,cosHalf)){yk.dispelledUntil=now+9000;yk.g.visible=false;k.bonus=(k.bonus||0)+1;hits++;taijiWorldFloat(yk.g.position,"祓い斬り","good");}});
  creatures.oni.forEach(o=>{if(o.g.visible&&o.taijiAlive!==false&&taijiSwordConeHit(o.g.position,range+.35,cosHalf)){taijiHitOni(o,combo>=3?13:9);hits++;}});
  taijiBossList(k).forEach(b=>{if(!b.dead&&taijiSwordConeHit(b.g.position,range+.7,cosHalf)){
    if(damageBoss(b,combo>=3?11:8,"sword")&&now>=(b._summerOpeningFrom||Infinity)&&now<(b._summerOpeningUntil||0)){
      taijiAddBossPosture(b,8);taijiWorldFloat(taijiBossAimPoint(b)||b.g.position,"隙を斬った","good");
    }
    hits++;
  }});
  if(hits){if(combo>=3){taijiFloat("三段", "guard",50,48);beep(980,.055,"triangle",.06);}taijiMsg(combo>=3?"太刀三段！ 体勢を崩せ":"太刀で斬り込んだ",760);_spiritWinCheck(k);}
  else{taijiMsg("間合いが遠い",620);k.miss++;}
}
/* 破魔の矢: 矢が飛んで着弾時に判定 */
function taijiArrow(sx,sy){
  const k=APP.taiji,now=performance.now();
  if(taijiIsDrinking(k)){taijiMsg("飲み終えるまで射てない",520);return;}
  if(taijiTutorialBlocked(k))return;
  if(now<(k.arrowCd||0)){taijiMsg("弦を引き絞っている…",520);return;}
  if(!taijiSpendStamina(12,"破魔の矢"))return;
  k.arrowCd=now+720;
  raycaster.setFromCamera({x:sx/innerWidth*2-1,y:-(sy/innerHeight)*2+1},camera);
  const inner=k.spirits.filter(s=>s.alive).map(s=>s.g.userData.inner);
  const sh=raycaster.intersectObjects(inner,false);let to;
  let bh=[];taijiBossList(k).forEach(b=>{if(!b.dead){const h=raycaster.intersectObject(b.g,true);if(h.length&&(!bh.length||h[0].distance<bh[0].distance))bh=h;}});
  if(bh.length)to=bh[0].point.clone();
  else if(sh.length)to=sh[0].point.clone();
  else{const om=[];creatures.oni.forEach(on=>{if(on.g.visible&&on.taijiAlive!==false)on.g.traverse(o=>{if(o.isMesh)om.push(o);});});
    const oh=raycaster.intersectObjects(om,false);if(oh.length)to=oh[0].point.clone();
    else{const ym=[];creatures.yokai.forEach(yk=>{if(yk.g.visible)yk.g.traverse(o=>{if(o.isMesh)ym.push(o);});});
    const yh=raycaster.intersectObjects(ym,false);to=yh.length?yh[0].point.clone():raycaster.ray.at(28,new THREE.Vector3());}
  }
  const from=camera.position.clone().add(raycaster.ray.direction.clone().multiplyScalar(0.6));
  seArrowShot();spawnArrow(from,to,()=>applyArrowHit(sx,sy));
}
function applyArrowHit(sx,sy){
  const k=APP.taiji;if(!k||k.done)return;
  raycaster.setFromCamera({x:sx/innerWidth*2-1,y:-(sy/innerHeight)*2+1},camera);
  {let tb=null,td=Infinity,hitPoint=null;taijiBossList(k).forEach(b=>{if(!b.dead){const h=raycaster.intersectObject(b.g,true);if(h.length&&h[0].distance<td){td=h[0].distance;tb=b;hitPoint=h[0].point;}}});
    if(tb){if(damageBoss(tb,10,"arrow")&&hitPoint&&hitPoint.distanceTo(taijiBossAimPoint(tb))<1.1){
      taijiAddBossPosture(tb,8);taijiWorldFloat(hitPoint,"急所を射た","good");
    }taijiMsg(tb.cfg.name+"に命中！");return;}}
  const oniMeshes=[];creatures.oni.forEach(o=>{if(o.g.visible&&o.taijiAlive!==false)o.g.traverse(m=>{if(m.isMesh){m.userData._oniRef=o;oniMeshes.push(m);}});});
  const oh=raycaster.intersectObjects(oniMeshes,false);
  if(oh.length){taijiHitOni(oh[0].object.userData._oniRef,10);return;}
  const targets=k.spirits.filter(s=>s.alive).map(s=>s.g.userData.inner);
  const hits=raycaster.intersectObjects(targets,false);
  if(hits.length){
    const sp=k.spirits[hits[0].object.userData.kekkai_idx];
    if(sp&&sp.alive){
      sp.hp--;updateSpiritHp(sp);
      if(sp.hp>0){const mat=sp.g.userData.inner.material,o=mat.opacity;mat.opacity=1;setTimeout(()=>{if(mat)mat.opacity=o;},120);
        seArrowHit();taijiMsg(sp.sp.label+"の怨霊はまだ消えない…");return;}
      _killSpirit(k,sp);seArrowHit();taijiMsg(sp.sp.label+"の物の怪を退散！");_spiritWinCheck(k);return;
    }
  }
  const ym=[];creatures.yokai.forEach(yk=>{if(yk.g.visible)yk.g.traverse(o=>{if(o.isMesh){o.userData._ykRef=yk;ym.push(o);}});});
  const yh=raycaster.intersectObjects(ym,false);
  if(yh.length){const yk=yh[0].object.userData._ykRef;
    if(yk&&yk.g.visible){yk.dispelledUntil=performance.now()+9000;yk.g.visible=false;k.bonus=(k.bonus||0)+1;
      seArrowHit();taijiMsg((YOKAI_NAME[yk.def.type]||"妖怪")+"を祓った！(追い祓い "+k.bonus+")");return;}}
  k.miss++;beep(220,.08,"sawtooth",.05);taijiMsg("外れ…",700);
}
function taijiHitOni(o,dmg){
  const k=APP.taiji;if(!k||!o||o.taijiAlive===false)return;
  o.taijiHp=(o.taijiHp||32)-dmg;seArrowHit();
  if(o.g.userData.body){const mat=o.g.userData.body.material,old=mat.color.getHex();mat.color.setHex(0xff7766);setTimeout(()=>{if(mat)mat.color.setHex(old);},120);}
  if(o.taijiHp<=0){o.taijiAlive=false;o.g.visible=false;o.dispelledUntil=performance.now()+16000;k.bonus=(k.bonus||0)+1;k.fudaBurst=true;k.fudaChain=2;k.fudaCd=0;updateTaijiFudaUi();taijiMsg("鬼を討った！ 以後、破魔の札は常に二連続で使える",2900);toast("鬼退治: 連札 2/2 が永続解放",2600);}
  else taijiMsg("鬼に命中。まだ迫ってくる…");
}
/* 破魔の札: 自分中心の衝撃波(クールタイムあり) */
function taijiFuda(){
  const k=APP.taiji;const now=performance.now();
  if(taijiTutorialBlocked(k))return;
  if(taijiIsDrinking(k)){taijiMsg("飲み終えるまで札を切れない",520);return;}
  if(k.fudaBurst&&now>=(k.fudaCd||0)&&(!k.fudaChain||k.fudaChain<=0))k.fudaChain=2;
  const charged=k.fudaBurst&&(k.fudaChain||0)>0;
  if(!charged&&now<(k.fudaCd||0)){taijiMsg("破魔の札は まだ整わない("+((k.fudaCd-now)/1000).toFixed(1)+"s)",700);return;}
  if(!taijiSpendStamina(charged?18:24,"破魔の札"))return;
  if(charged){k.fudaChain--;if(k.fudaChain<=0)k.fudaCd=now+4000;}else k.fudaCd=now+4000;
  updateTaijiFudaUi();
  seFuda();spawnShockwave(player.pos);
  const R=9;let n=0;
  let banished=0;
  for(let i=bossProjs.length-1;i>=0;i--){const p=bossProjs[i];
    if(!p.reflected&&p.m.position.distanceTo(player.pos)<R){taijiDisposeFx(p.m);bossProjs.splice(i,1);banished++;}
  }
  k.spirits.forEach(s=>{if(s.alive&&s.g.position.distanceTo(player.pos)<R){s.hp--;updateSpiritHp(s);
    if(s.hp<=0){_killSpirit(k,s);n++;}else{const mat=s.g.userData.inner.material,o=mat.opacity;mat.opacity=1;setTimeout(()=>{if(mat)mat.opacity=o;},120);}}});
  creatures.yokai.forEach(yk=>{if(yk.g.visible&&yk.g.position.distanceTo(player.pos)<R){yk.dispelledUntil=now+9000;yk.g.visible=false;k.bonus=(k.bonus||0)+1;}});
  creatures.oni.forEach(o=>{if(o.g.visible&&o.taijiAlive!==false&&o.g.position.distanceTo(player.pos)<R+1)taijiHitOni(o,12);});
  taijiMsg("破魔の札！ 周囲を祓った"+(n?"("+n+"体)":"")+(banished?`・飛び道具${banished}発を消した`:""));
  taijiBossList(k).forEach(b=>{if(!b.dead&&b.g.position.distanceTo(player.pos)<R){damageBoss(b,8,"fuda");}});
  _spiritWinCheck(k);
}
/* ===== ボス戦 ===== */
/* ボス戦アリーナ: 北の対に挟まれた狭い窪地を避け、東の奥の開けた庭へ移動(建物に当たらない広い円) */
const TAIJI_BOSS_ARENA={x:30,z:-48,r:18,gateZ:-30};
const TAIJI_BOSS_ASSETS={
  spring:{file:"assets/bosses/kitsune_boss_balanced.glb",scale:4.2,y:.04,groundY:.035,rotY:Math.PI*1.5,liteRig:false},
  winter:{file:"assets/bosses/yuki_boss_balanced.glb",scale:3.8,y:.04,groundY:.035,rotY:Math.PI/2}
};
const TAIJI_ROLE_BOSS_ASSETS={
  kappa:{file:"assets/bosses/kappa_boss_2048.glb",scale:4.15,y:.03,groundY:.035,rotX:Math.PI/2,rotY:0,hideProcedural:true},
  chochin:{file:"assets/bosses/chochin_boss_2048.glb",scale:4.35,y:.16,groundY:.035,rotX:Math.PI/2,rotY:0,hideProcedural:true},
  autumn:{file:"assets/bosses/hitodama_boss_2048.glb",scale:4.25,y:.14,groundY:.035,rotY:Math.PI,rotZ:Math.PI,hideProcedural:true,whiteKey:true},
  oni:{file:"assets/bosses/oni_boss_2048.glb",scale:4.45,y:.04,groundY:.035,rotX:Math.PI/2,rotY:0,hideProcedural:true}
};
const TAIJI_BOSS_FACE={
  spring:new THREE.Vector3(0,2.0,.95),
  winter:new THREE.Vector3(0,3.05,.42),
  autumn:new THREE.Vector3(0,2.15,.78),
  oni:new THREE.Vector3(0,2.65,.48),
  kappa:new THREE.Vector3(-.82,2.2,.92),
  chochin:new THREE.Vector3(0,1.6,.72)
};
const taijiGlbCache={};
const TAIJI_KITSUNE_LITE_RIG=/[?&]kitsuneLite=1(?:&|$)/.test(location.search);
const TAIJI_EXTRA_BOSS_GLB=!/[?&]bossGlb=0(?:&|$)/.test(location.search);
function taijiBossAssetOption(season){
  if(TAIJI_ROLE_BOSS_ASSETS[season]&&!TAIJI_EXTRA_BOSS_GLB)return null;
  return TAIJI_ROLE_BOSS_ASSETS[season]||TAIJI_BOSS_ASSETS[season]||null;
}
function taijiCompArray(t){return t===5126?Float32Array:t===5125?Uint32Array:t===5123?Uint16Array:t===5121?Uint8Array:Int16Array;}
function taijiItemSize(t){return t==="SCALAR"?1:t==="VEC2"?2:t==="VEC3"?3:t==="VEC4"?4:1;}
function taijiReadAccessor(json,bin,i){
  const a=json.accessors[i],bv=json.bufferViews[a.bufferView],Arr=taijiCompArray(a.componentType);
  const off=(bv.byteOffset||0)+(a.byteOffset||0),n=a.count*taijiItemSize(a.type);
  return new Arr(bin,off,n);
}
function taijiTextureFromGlb(json,bin,idx){
  const texDef=json.textures&&json.textures[idx||0],webp=texDef&&texDef.extensions&&texDef.extensions.EXT_texture_webp;
  const source=texDef&&(texDef.source!=null?texDef.source:(webp&&webp.source));
  const imgDef=source!=null&&json.images&&json.images[source];
  if(!imgDef||imgDef.bufferView==null)return Promise.resolve(null);
  const bv=json.bufferViews[imgDef.bufferView],blob=new Blob([bin.slice(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength)],{type:imgDef.mimeType||"image/jpeg"});
  const url=URL.createObjectURL(blob);
  return new Promise(resolve=>{
    new THREE.TextureLoader().load(url,t=>{URL.revokeObjectURL(url);t.flipY=false;t.encoding=THREE.sRGBEncoding;t.anisotropy=4;resolve(t);},undefined,()=>{URL.revokeObjectURL(url);resolve(null);});
  });
}
async function taijiLoadSimpleGlb(url){
  if(taijiGlbCache[url])return taijiGlbCache[url];
  taijiGlbCache[url]=(async()=>{
    const buf=await fetch(url).then(r=>{if(!r.ok)throw new Error("GLB "+r.status);return r.arrayBuffer();});
    const dv=new DataView(buf);let off=12,json=null,bin=null;
    while(off<buf.byteLength){const len=dv.getUint32(off,true),type=String.fromCharCode(...new Uint8Array(buf,off+4,4));off+=8;
      if(type==="JSON")json=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,off,len)));
      else if(type==="BIN\0")bin=buf.slice(off,off+len);
      off+=len;
    }
    const prim=json.meshes[0].primitives[0],geo=new THREE.BufferGeometry();
    const pos=taijiReadAccessor(json,bin,prim.attributes.POSITION),uv=taijiReadAccessor(json,bin,prim.attributes.TEXCOORD_0),nor=taijiReadAccessor(json,bin,prim.attributes.NORMAL);
    geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
    if(nor)geo.setAttribute("normal",new THREE.BufferAttribute(nor,3));
    if(uv)geo.setAttribute("uv",new THREE.BufferAttribute(uv,2));
    if(prim.indices!=null){const ind=taijiReadAccessor(json,bin,prim.indices);geo.setIndex(new THREE.BufferAttribute(ind,1));}
    geo.computeBoundingSphere();geo.computeBoundingBox();
    const matDef=(json.materials&&json.materials[prim.material])||null;
    const baseTexIdx=matDef&&matDef.pbrMetallicRoughness&&matDef.pbrMetallicRoughness.baseColorTexture?matDef.pbrMetallicRoughness.baseColorTexture.index:0;
    const tex=await taijiTextureFromGlb(json,bin,baseTexIdx);
    const mat=new THREE.MeshBasicMaterial({map:tex||null,color:tex?0xffffff:0xf2e8df,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(geo,mat);mesh.name=url;mesh.frustumCulled=true;
    const root=new THREE.Group();root.add(mesh);return root;
  })();
  return taijiGlbCache[url];
}
function taijiApplyKitsuneLiteRig(model){
  if(!model||model.userData.kitsuneLiteRig)return;
  const uniforms=[];
  model.traverse(o=>{
    if(!o.isMesh||!o.geometry||!o.material)return;
    if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox;
    const mn=bb.min.clone(),sz=bb.max.clone().sub(bb.min);
    const uTime={value:0};
    const uOmen={value:0};
    const mat=o.material.clone();
    mat.onBeforeCompile=shader=>{
      shader.uniforms.uKitsuneTime=uTime;
      shader.uniforms.uKitsuneOmen=uOmen;
      shader.uniforms.uKitsuneMin={value:mn};
      shader.uniforms.uKitsuneSize={value:sz};
      shader.vertexShader=shader.vertexShader.replace(
        "#include <common>",
        "#include <common>\nuniform float uKitsuneTime;\nuniform float uKitsuneOmen;\nuniform vec3 uKitsuneMin;\nuniform vec3 uKitsuneSize;"
      ).replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec3 kp=(position-uKitsuneMin)/max(uKitsuneSize,vec3(0.0001));
        float side=step(0.5,kp.x)*2.0-1.0;
        float tailMask=smoothstep(0.38,0.72,kp.y)*(1.0-smoothstep(0.46,0.72,kp.z));
        float legMask=(1.0-smoothstep(0.16,0.34,kp.y))*smoothstep(0.16,0.36,abs(kp.x-0.5));
        float headMask=smoothstep(0.70,0.84,kp.z)*smoothstep(0.50,0.64,kp.y);
        float tailWave=sin(uKitsuneTime*3.4+kp.x*10.5+kp.y*4.0);
        float stepWave=sin(uKitsuneTime*6.8+side*1.5708+kp.z*3.0);
        transformed.x+=tailMask*tailWave*0.022;
        transformed.y+=tailMask*cos(uKitsuneTime*2.7+kp.x*8.0)*0.006;
        transformed.y+=legMask*max(stepWave,0.0)*0.010;
        transformed.z+=legMask*stepWave*0.020;
        transformed.y+=headMask*uKitsuneOmen*(0.010+sin(uKitsuneTime*12.0)*0.004);
        transformed.z+=headMask*uKitsuneOmen*(0.030+cos(uKitsuneTime*10.0)*0.006);`
      );
    };
    mat.customProgramCacheKey=()=>"taiji-kitsune-lite-rig-v2";
    mat.needsUpdate=true;
    o.material=mat;
    uniforms.push({time:uTime,omen:uOmen});
  });
  model.userData.kitsuneLiteRig={uniforms};
}
function taijiUpdateKitsuneLiteRig(g,t){
  const model=g&&g.userData&&g.userData.assetModel;
  const rig=model&&model.userData&&model.userData.kitsuneLiteRig;
  if(!rig)return;
  const now=performance.now(),until=(g.userData&&g.userData.kitsuneOmenUntil)||0;
  const omen=until>now?Math.max(0,Math.min(1,(until-now)/520)):0;
  rig.uniforms.forEach(u=>{u.time.value=t;u.omen.value=omen;});
}
function taijiPlaceBossAssetModel(model,opt){
  model.position.set(opt.x||0,0,opt.z||0);
  model.rotation.set(opt.rotX||0,opt.rotY||0,opt.rotZ||0);
  model.scale.setScalar(opt.scale||3.5);
  model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model);
  if(isFinite(box.min.y)&&isFinite(box.max.y)){
    const ground=(opt.groundY==null ? .035 : opt.groundY),extra=opt.y||0;
    model.position.y+=(ground-box.min.y)+extra;
    model.updateMatrixWorld(true);
  }else{
    model.position.y=opt.y||0;
  }
}
function taijiApplyBossAssetMaterial(model,opt){
  if(!model||!opt)return;
  model.traverse(o=>{
    if(!o.isMesh||!o.material)return;
    const mat=o.material.clone();
    if(opt.whiteKey){
      mat.transparent=true;mat.depthWrite=false;mat.alphaTest=Math.max(mat.alphaTest||0,.02);
      mat.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace(
          "#include <alphatest_fragment>",
          "if(diffuseColor.r>0.965&&diffuseColor.g>0.965&&diffuseColor.b>0.965) discard;\n#include <alphatest_fragment>"
        );
      };
      mat.customProgramCacheKey=()=>"taiji-boss-white-key-v1";
    }
    o.material=mat;
  });
}
function taijiAttachBossAsset(season,g){
  const opt=taijiBossAssetOption(season);if(!opt||!g||!g.userData||g.userData.assetReady||g.userData.assetLoading)return;
  const fallback=g.children.slice();
  g.userData.assetFallback=fallback;g.userData.assetLoading=true;
  taijiLoadSimpleGlb(opt.file).then(src=>{
    if(!g.userData||g.userData.assetReady||!g.parent)return;
    const model=src.clone(true);model.name="taiji-glb-"+season;
    taijiPlaceBossAssetModel(model,opt);
    taijiApplyBossAssetMaterial(model,opt);
    model.traverse(o=>{if(o.isMesh){o.renderOrder=6;o.castShadow=false;o.receiveShadow=false;}});
    if(opt.liteRig&&TAIJI_KITSUNE_LITE_RIG)taijiApplyKitsuneLiteRig(model);
    fallback.forEach(o=>{o.visible=!!(opt.keepAura&&o===g.userData.aura);});
    if(opt.keepAura&&g.userData.aura){g.userData.aura.visible=true;if(g.userData.aura.material)g.userData.aura.material.opacity=Math.min(g.userData.aura.material.opacity||.12,.08);}
    g.add(model);g.userData.assetModel=model;if(season==="spring"||season==="winter")taijiAddBossPresence(season,g);g.userData.assetReady=true;g.userData.assetLoading=false;
  }).catch(()=>{g.userData.assetLoading=false;});
}
function taijiFxMat(color,opacity,additive=true){
  return new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,depthTest:false,side:THREE.DoubleSide,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending});
}
function taijiAddBossPresence(season,g){
  if(g.userData.bossPresence)return;
  const fx={roots:[],rings:[],wisps:[],tailTips:[],snow:[],paws:[]};
  const root=new THREE.Group();root.name="taiji-boss-presence-"+season;root.renderOrder=9;g.add(root);fx.roots.push(root);
  if(season==="spring"){
    const aura=taijiFxMat(0xff7aa8,.30),red=taijiFxMat(0xff5c8e,.72),gold=taijiFxMat(0xff9fc8,.44),blue=taijiFxMat(0x79d8ff,.58);
    const halo=new THREE.Mesh(new THREE.TorusGeometry(1.78,.030,7,72),gold);halo.rotation.x=Math.PI/2;halo.position.y=1.48;root.add(halo);fx.rings.push(halo);
    const crown=new THREE.Mesh(new THREE.TorusGeometry(1.24,.022,6,58),taijiFxMat(0x9ce7ff,.34));crown.position.y=2.75;crown.rotation.x=Math.PI/2;root.add(crown);fx.rings.push(crown);
    for(let i=0;i<9;i++){
      const a=-1.15+i*(2.30/8),r=1.45+Math.abs(i-4)*.18;
      const tip=new THREE.Group();tip.userData.base=new THREE.Vector3(Math.sin(a)*r,2.45+Math.cos(a)*.72,-2.05-Math.abs(i-4)*.15);tip.position.copy(tip.userData.base);
      const flame=new THREE.Mesh(new THREE.SphereGeometry(.16,10,7),red);flame.scale.set(1.0,1.45,.72);flame.renderOrder=12;tip.add(flame);
      const barb=new THREE.Mesh(new THREE.ConeGeometry(.13,.46,7),taijiFxMat(0xffb1c4,.62));barb.position.z=-.18;barb.rotation.x=-Math.PI/2;tip.add(barb);
      const core=new THREE.Mesh(new THREE.SphereGeometry(.055,8,6),taijiFxMat(0xfff0d8,.88));core.position.y=.04;tip.add(core);
      root.add(tip);fx.tailTips.push(tip);
    }
    for(let i=0;i<12;i++){
      const w=new THREE.Group();w.userData={phase:i*.73,rad:1.35+(i%4)*.24,high:1.10+(i%3)*.34};
      const isBlue=i%2===0,body=new THREE.Mesh(new THREE.SphereGeometry(.12+(i%3)*.022,10,7),isBlue?blue:red);body.scale.set(.82,1.32,.82);body.renderOrder=11;w.add(body);
      const tail=new THREE.Mesh(new THREE.ConeGeometry(.075,.32,6),taijiFxMat(isBlue?0x64dfff:0xff5d8f,.38));tail.position.y=-.20;tail.rotation.x=Math.PI;w.add(tail);
      root.add(w);fx.wisps.push(w);
    }
    const key=new THREE.PointLight(0xff9a55,1.15,7,2);key.position.set(0,2.6,1.5);root.add(key);
  }else if(season==="winter"){
    const cold=taijiFxMat(0xbcecff,.30),veilMat=taijiFxMat(0xbcecff,.16,false),pale=taijiFxMat(0xf8fbff,.48),blue=taijiFxMat(0x68b8ff,.34);
    const veil=new THREE.Mesh(new THREE.CylinderGeometry(1.28,1.88,3.9,18,1,true),veilMat);veil.position.y=1.95;veil.userData.uprightAura=true;root.add(veil);fx.rings.push(veil);
    for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.28+i*.36,.018,5,54),i%2?pale:blue);ring.position.y=.55+i*.82;ring.rotation.x=Math.PI/2;ring.userData.spin=(i%2?-1:1)*(.45+i*.12);root.add(ring);fx.rings.push(ring);}
    for(let i=0;i<34;i++){
      const flake=new THREE.Mesh(new THREE.OctahedronGeometry(.045+(i%3)*.018,0),i%2?pale:cold);
      flake.userData={phase:i*.41,rad:.55+(i%8)*.22,high:.65+(i%7)*.38,spin:(i%2?-1:1)*(.7+i*.015)};
      root.add(flake);fx.snow.push(flake);
    }
    const key=new THREE.PointLight(0x9ddcff,.9,6,2);key.position.set(0,2.8,.7);root.add(key);
  }
  g.userData.bossPresence=fx;
}
function taijiUpdateBossPresence(g,t){
  const fx=g&&g.userData&&g.userData.bossPresence;if(!fx)return;
  fx.rings.forEach((r,i)=>{if(!r.userData.uprightAura)r.rotation.x=Math.PI/2;r.rotation.z+=.002*((i%2)?-1:1);if(r.material){const base=r.userData.uprightAura?.12:(i===0?.22:.28);r.material.opacity=base+Math.sin(t*1.7+i)*.04;}});
  fx.tailTips.forEach((tip,i)=>{const b=tip.userData.base;if(b){tip.position.set(b.x+Math.sin(t*1.6+i)*.045,b.y+Math.sin(t*2.2+i*.4)*.08,b.z+Math.cos(t*1.3+i)*.035);}tip.scale.setScalar(1+Math.sin(t*3.1+i)*.12);});
  fx.wisps.forEach((w,i)=>{const u=w.userData,a=t*(.62+i*.012)+u.phase;w.position.set(Math.cos(a)*u.rad,u.high+Math.sin(t*1.9+u.phase)*.42,Math.sin(a)*u.rad);w.scale.setScalar(.88+Math.sin(t*2.7+u.phase)*.18);w.rotation.y=-a;if(w.children[0]&&w.children[0].material)w.children[0].material.opacity=.42+Math.sin(t*3+u.phase)*.18;});
  fx.snow.forEach((s,i)=>{const u=s.userData,a=t*(.35+i*.004)+u.phase;s.position.set(Math.cos(a)*u.rad,u.high+Math.sin(t*1.25+u.phase)*.24,Math.sin(a)*u.rad);s.rotation.y+=.02*u.spin;s.rotation.x+=.013*u.spin;if(s.material)s.material.opacity=.30+Math.sin(t*2.4+u.phase)*.14;});
  taijiUpdateKitsuneLiteRig(g,t);
}
function taijiPreloadBossAsset(season){
  const keys=[season];
  if(season==="summer")keys.push("kappa","chochin");
  if(season==="autumn")keys.push("autumn","oni");
  const loads=keys.map(k=>taijiBossAssetOption(k)).filter(Boolean).map(opt=>taijiLoadSimpleGlb(opt.file).catch(()=>null));
  return loads.length?Promise.all(loads).then(()=>null):Promise.resolve(null);
}
function taijiPreloadBossEncounter(k){
  const season=k&&k.season;
  const asset=taijiPreloadBossAsset(season);
  const audio=(typeof SFX!=="undefined"&&SFX.preloadBossAudio)?SFX.preloadBossAudio(season).catch(()=>null):Promise.resolve(null);
  return Promise.all([asset,audio]).then(()=>null);
}
const taijiBossWarmPromises={};
function taijiWarmBossSeason(season){
  if(!season)return Promise.resolve(null);
  if(!taijiBossWarmPromises[season])taijiBossWarmPromises[season]=taijiPreloadBossEncounter({season}).catch(()=>null);
  return taijiBossWarmPromises[season];
}
function taijiWarmBossSet(seasons){
  const list=[...new Set((seasons||[]).filter(Boolean))];
  return list.reduce((p,s)=>p.then(()=>taijiWarmBossSeason(s)),Promise.resolve(null));
}
function taijiWarmInitialBossAssets(){
  const run=()=>taijiWarmBossSet(["spring","summer"]).then(()=>taijiWarmBossSet(["autumn","winter"]));
  if("requestIdleCallback" in window)requestIdleCallback(run,{timeout:1800});
  else setTimeout(run,900);
}
function taijiClearBossGate(k){
  const gate=k&&k.bossGate;if(gate&&gate.g){scene.remove(gate.g);}
  if(k)k.bossGate=null;
  const ov=$("bossLoad");if(ov)ov.classList.remove("show");
}
function taijiMakeBossGate(k){
  taijiClearBossGate(k);
  const G=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color:0xd9c7ff,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide});
  for(let i=-3;i<=3;i++){
    const p=new THREE.Mesh(new THREE.PlaneGeometry(4.2,5.2),mat.clone());p.position.set(TAIJI_BOSS_ARENA.x+i*3.2,2.45,TAIJI_BOSS_ARENA.gateZ);G.add(p);
  }
  for(let i=0;i<22;i++){
    const s=new THREE.Mesh(new THREE.SphereGeometry(rnd(.08,.22),6,4),new THREE.MeshBasicMaterial({color:0xf2e8ff,transparent:true,opacity:rnd(.18,.42),depthWrite:false}));
    s.position.set(TAIJI_BOSS_ARENA.x+rnd(-12,12),rnd(.35,4.6),TAIJI_BOSS_ARENA.gateZ+rnd(-.35,.35));s.userData.phase=rnd(0,9);G.add(s);
  }
  scene.add(G);k.bossGate={g:G,triggered:false,locked:false,gateZ:TAIJI_BOSS_ARENA.gateZ};
}
function taijiPrepareBossGate(k,instant){
  if(!k||k.done||k.boss)return;
  taijiMakeBossGate(k);k.bossSpawned=true;
  $("taijiRemain").textContent="霧門";
  taijiMsg(instant?"霧の奥から強大な気配が満ちる…":"東の奥の庭に霧の門が開いた。越えれば戻れない",3200);
  if(instant)setTimeout(()=>taijiTriggerBossGate(k),260);
}
function taijiTriggerBossGate(k){
  if(!k||k.done||k.boss||!k.bossGate||k.bossGate.triggered)return;
  k.bossGate.triggered=true;k.bossGate.locked=true;k.bossLoading=true;
  if(player.pos.z>TAIJI_BOSS_ARENA.gateZ-1)player.pos.z=TAIJI_BOSS_ARENA.gateZ-1;
  const ov=$("bossLoad");if(ov)ov.classList.add("show");
  taijiMsg("霧を越えた。退路は閉ざされた…",1400);seFuda();
  const waitAsset=taijiWarmBossSeason(k.season);
  const minWait=new Promise(r=>setTimeout(r,360));
  Promise.all([waitAsset,minWait]).then(()=>{if(APP.mode==="taiji"&&APP.taiji===k&&!k.done&&!k.boss){taijiPlacePlayerAtBossApproach();if(ov)ov.classList.remove("show");k.bossLoading=false;spawnBoss(k);}});
}
function taijiPlacePlayerAtBossApproach(){
  const A=TAIJI_BOSS_ARENA;
  player.pos.x=A.x;player.pos.z=A.z+10.8;player.pos.y=groundH(player.pos.x,player.pos.z)+1.62;
  player.yaw=Math.atan2(-(A.x-player.pos.x),-(A.z-player.pos.z));
}
function taijiUpdateBossGate(k,t){
  const gate=k&&k.bossGate;if(!gate||!gate.g)return;
  gate.g.children.forEach((o,i)=>{if(o.material&&o.material.opacity!=null)o.material.opacity=(o.geometry&&o.geometry.type==="PlaneGeometry")?(.20+.08*Math.sin(t*2+i)):(.22+.18*Math.sin(t*1.7+(o.userData.phase||0)));});
  if(!gate.triggered&&Math.abs(player.pos.x-TAIJI_BOSS_ARENA.x)<15&&player.pos.z<TAIJI_BOSS_ARENA.gateZ+.8)taijiTriggerBossGate(k);
}
function taijiClampBossArena(x,z){
  const k=APP.taiji,gate=k&&k.bossGate;if(!gate||!gate.locked)return{x,z};
  if(z>TAIJI_BOSS_ARENA.gateZ-.65){z=TAIJI_BOSS_ARENA.gateZ-.65;if(performance.now()>(k.gateMsgAt||0)){k.gateMsgAt=performance.now()+1200;taijiMsg("霧に阻まれて戻れない",700);}}
  const dx=x-TAIJI_BOSS_ARENA.x,dz=z-TAIJI_BOSS_ARENA.z,d=Math.hypot(dx,dz);
  if(d>TAIJI_BOSS_ARENA.r){x=TAIJI_BOSS_ARENA.x+dx/d*TAIJI_BOSS_ARENA.r;z=TAIJI_BOSS_ARENA.z+dz/d*TAIJI_BOSS_ARENA.r;}
  return{x,z};
}
const BOSS_CFG={
  spring:{name:"九尾の狐",hp:86,col:0xff7a1e,attack:"dart"},
  summer:{name:"河童の主と提灯お化け",hp:118,col:0x33b866,attack:"duo"},
  autumn:{name:"合体人魂 (がったいひとだま)",hp:88,col:0x7a66ff,attack:"souls"},
  winter:{name:"雪女王 (ゆきおんな)",hp:104,col:0xbfe0ff,attack:"blizzard"}
};
// 立体パーツ用素材: 陰影を受けつつ、emissiveで「妖しく光る」印象を保つ(MeshStandardMaterial)。
// 光の玉・オーラ・霊気エフェクト等の非実体パーツは従来通りmb()=MeshBasicMaterialのままとする。
function bossMat(color,opacity=1,opt={}){
  const o={color,roughness:opt.rough!=null?opt.rough:.6,metalness:opt.metal!=null?opt.metal:.04,transparent:opacity<1,opacity,side:THREE.DoubleSide};
  o.emissive=opt.emissive!=null?opt.emissive:color;o.emissiveIntensity=opt.ei!=null?opt.ei:.22;
  return new THREE.MeshStandardMaterial(o);
}
function makeBoss(season){
  const g=new THREE.Group();const C=BOSS_CFG[season].col;
  g.userData.faceLocal=(TAIJI_BOSS_FACE[season]||new THREE.Vector3(0,2,.8)).clone();
  // core=各季節の「本体」となる主要な塊。立体として陰影を受けるようMeshStandardMaterial化しつつ、
  // emissiveで霊的な発光を残す(userData.core.material.opacity は演出/被弾フラッシュが参照するため維持)。
  const core=new THREE.Mesh(new THREE.SphereGeometry(1.0,16,12),bossMat(C,0.92,{rough:.55,ei:.30}));core.position.y=2.0;core.castShadow=true;g.add(core);
  // aura=外周を包む半透明の霊気。実体を持たない光の層なのでMeshBasicMaterialのまま。
  const aura=new THREE.Mesh(new THREE.SphereGeometry(1.7,14,10),new THREE.MeshBasicMaterial({color:C,transparent:true,opacity:0.16,depthWrite:false,side:THREE.DoubleSide}));aura.position.y=2.0;g.add(aura);
  g.userData.core=core;g.userData.aura=aura;
  const mb=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,side:THREE.DoubleSide});
  if(season==="spring"){
    // std=trueで実体のある胴体・脚・尾を、falseで髭やハイライト等の付帯線をmb()のまま出し分ける。
    const seg=(a,b,r1,r2,col,op=.96,std=false)=>{const d=b.clone().sub(a),len=d.length(),m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,len,7),std?bossMat(col,op,{rough:.55,ei:.14}):mb(col,op));m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());if(std)m.castShadow=true;g.add(m);return m;};
    core.material.color.setHex(0xfffbf2);core.material.emissive.setHex(0xfffbf2);core.material.emissiveIntensity=.16;core.scale.set(.72,.36,.70);core.position.set(0,1.12,.03);
    aura.material.color.setHex(0xffc7d8);aura.material.opacity=.07;aura.position.set(0,1.55,-.62);aura.scale.set(1.04,.72,.46);
    const chest=new THREE.Mesh(new THREE.SphereGeometry(.55,10,8),bossMat(0xfffbf2,.94,{rough:.58,ei:.16}));chest.position.set(0,1.18,.36);chest.scale.set(.78,.46,.68);g.add(chest);
    const mane=new THREE.Mesh(new THREE.ConeGeometry(.34,.78,8),bossMat(0xfff8ee,.60,{rough:.62,ei:.12}));mane.position.set(0,1.42,.52);mane.rotation.x=Math.PI;mane.scale.set(.68,.66,.72);g.add(mane);
    seg(new THREE.Vector3(0,1.32,.55),new THREE.Vector3(0,1.52,.88),.18,.24,0xfffbf2,.96,true);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.36,10,8),bossMat(0xfffbf2,1,{rough:.55,ei:.16}));head.position.set(0,1.63,1.12);head.scale.set(.60,.74,1.20);head.castShadow=true;g.add(head);
    const mask=new THREE.Mesh(new THREE.ConeGeometry(.16,.74,5),bossMat(0xfffbf2,1,{rough:.55,ei:.16}));mask.rotation.x=Math.PI/2;mask.position.set(0,1.55,1.52);mask.scale.set(.66,.76,1.24);g.add(mask);
    const nose=new THREE.Mesh(new THREE.SphereGeometry(.055,7,5),bossMat(0x1d1210,1,{rough:.25,metal:.05,ei:.03}));nose.position.set(0,1.48,1.82);nose.scale.set(1.25,.62,.82);g.add(nose);
    seg(new THREE.Vector3(0,1.43,1.69),new THREE.Vector3(-.055,1.37,1.70),.011,.011,0x27100e,.92);
    seg(new THREE.Vector3(0,1.43,1.69),new THREE.Vector3(.055,1.37,1.70),.011,.011,0x27100e,.92);
    seg(new THREE.Vector3(0,1.47,1.77),new THREE.Vector3(0,1.41,1.70),.010,.010,0x27100e,.88);
    const crest=new THREE.Mesh(new THREE.ConeGeometry(.045,.42,4),bossMat(0xd7a23a,.94,{rough:.35,metal:.6,ei:.10}));crest.position.set(0,1.91,1.30);crest.rotation.x=.1;g.add(crest);
    const gem=new THREE.Mesh(new THREE.SphereGeometry(.038,7,5),bossMat(0xffe0a8,.9,{rough:.25,metal:.15,ei:.35}));gem.position.set(0,1.76,1.42);gem.scale.set(.75,1.15,.5);g.add(gem);
    [-1,1].forEach(s=>{const ear=new THREE.Mesh(new THREE.ConeGeometry(.16,.68,5),bossMat(0xfffbf2,1,{rough:.58,ei:.14}));ear.position.set(s*.30,2.06,1.02);ear.rotation.z=-s*.42;ear.rotation.x=.10;g.add(ear);
      const inner=new THREE.Mesh(new THREE.ConeGeometry(.095,.45,5),bossMat(0xeaa48d,.72,{rough:.55,ei:.06}));inner.position.set(s*.30,2.03,1.08);inner.rotation.z=-s*.42;inner.rotation.x=.10;g.add(inner);
      const cheek=new THREE.Mesh(new THREE.ConeGeometry(.052,.36,4),bossMat(0xfffbf2,.88,{rough:.58,ei:.14}));cheek.position.set(s*.30,1.43,1.22);cheek.rotation.z=s*1.02;cheek.rotation.x=.32;g.add(cheek);
      const eyeShape=new THREE.Shape();eyeShape.moveTo(-.105,0);eyeShape.quadraticCurveTo(-.015,.082,.145,.035);eyeShape.quadraticCurveTo(.020,-.056,-.105,0);
      const eyeOuter=new THREE.Mesh(new THREE.ShapeGeometry(eyeShape),bossMat(0xa80c13,.98,{rough:.4,ei:.32}));eyeOuter.position.set(s*.126,1.642,1.592);eyeOuter.rotation.z=-s*.02;eyeOuter.scale.x=s;g.add(eyeOuter);
      const eyeInner=new THREE.Mesh(new THREE.SphereGeometry(.026,8,5),mb(0xfff8f2,.96));eyeInner.position.set(s*.166,1.648,1.617);eyeInner.scale.set(1.62,.22,.38);g.add(eyeInner);
      const upperMark=new THREE.Mesh(new THREE.ConeGeometry(.030,.21,4),mb(0xc84228,.72));upperMark.position.set(s*.190,1.720,1.565);upperMark.rotation.z=-s*.78;upperMark.scale.set(.52,1,.18);g.add(upperMark);
      const lowerMark=new THREE.Mesh(new THREE.ConeGeometry(.024,.18,4),mb(0xc84228,.58));lowerMark.position.set(s*.196,1.570,1.580);lowerMark.rotation.z=s*.48;lowerMark.scale.set(.44,1,.16);g.add(lowerMark);
      const templeMark=new THREE.Mesh(new THREE.BoxGeometry(.15,.026,.022),mb(0x6e100b,.76));templeMark.position.set(s*.205,1.695,1.575);templeMark.rotation.z=-s*.32;g.add(templeMark);
      seg(new THREE.Vector3(s*.11,1.43,1.66),new THREE.Vector3(s*.27,1.47,1.65),.005,.004,0x8a766c,.36);
      seg(new THREE.Vector3(s*.11,1.39,1.67),new THREE.Vector3(s*.26,1.36,1.65),.005,.004,0x8a766c,.32);
      const fang=new THREE.Mesh(new THREE.ConeGeometry(.023,.18,4),bossMat(0xffffff,1,{rough:.3,ei:.04}));fang.position.set(s*.052,1.27,1.70);fang.rotation.x=Math.PI;g.add(fang);
      seg(new THREE.Vector3(s*.30,1.02,.48),new THREE.Vector3(s*.36,.38,.84),.075,.115,0xf5eee5,.96,true);
      seg(new THREE.Vector3(s*.40,1.00,-.28),new THREE.Vector3(s*.48,.36,-.02),.105,.145,0xf3e9df,.96,true);
      const paw1=new THREE.Mesh(new THREE.SphereGeometry(.12,7,5),bossMat(0xfffbf2,1,{rough:.58,ei:.14}));paw1.position.set(s*.38,.35,.94);paw1.scale.set(1.42,.32,.76);g.add(paw1);
      const paw2=new THREE.Mesh(new THREE.SphereGeometry(.13,7,5),bossMat(0xfffbf2,1,{rough:.58,ei:.14}));paw2.position.set(s*.50,.35,.04);paw2.scale.set(1.44,.34,.8);g.add(paw2);
      for(let j=0;j<3;j++){const claw1=new THREE.Mesh(new THREE.ConeGeometry(.022,.15,4),bossMat(0x201412,1,{rough:.35,metal:.1,ei:.02}));claw1.position.set(s*(.30+j*.045),.30,1.08);claw1.rotation.z=-s*.78;g.add(claw1);
        const claw2=new THREE.Mesh(new THREE.ConeGeometry(.024,.16,4),bossMat(0x201412,1,{rough:.35,metal:.1,ei:.02}));claw2.position.set(s*(.42+j*.045),.30,.18);claw2.rotation.z=-s*.70;g.add(claw2);}});
    for(let i=0;i<9;i++){const off=i-4,abs=Math.abs(off),base=new THREE.Vector3(off*.035,1.08,-.44);
      const p1=new THREE.Vector3(off*.18,1.52+.05*(4-abs),-.78-abs*.02);
      const p2=new THREE.Vector3(off*.38,2.18-abs*.04,-1.18-abs*.04);
      const p3=new THREE.Vector3(off*.55,2.78-abs*.08,-1.38-abs*.07);
      seg(base,p1,.16,.26,0xf6efe4,.95,true);seg(p1,p2,.26,.32,0xfffbf2,.96,true);seg(p2,p3,.30,.12,0xffb8c8,.92,true);
      const shine=new THREE.Mesh(new THREE.CylinderGeometry(.010,.016,p1.distanceTo(p2),5),mb(0xffffff,.38));shine.position.copy(p1).add(p2).multiplyScalar(.5);shine.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),p2.clone().sub(p1).normalize());shine.position.x+=off*.012;g.add(shine);}
  }else if(season==="summer"){
    core.position.set(-.95,1.38,0);core.scale.set(.56,1.0,.50);core.material.color.setHex(0x2d8d52);core.material.emissive.setHex(0x2d8d52);
    const shell=new THREE.Mesh(new THREE.SphereGeometry(1.0,12,8,0,Math.PI*2,0,Math.PI/1.35),bossMat(0x473021,1,{rough:.82,ei:.05}));shell.position.set(-1.22,1.76,-.42);shell.scale.set(1.0,.96,.48);shell.rotation.x=-.36;shell.castShadow=true;g.add(shell);
    for(let i=0;i<6;i++){const plate=new THREE.Mesh(new THREE.BoxGeometry(.42,.05,.34),bossMat(i%2?0x7d4a30:0x4f2d1f,.86,{rough:.78,ei:.04}));plate.position.set(-1.18+(i%3-1)*.35,2.06-Math.floor(i/3)*.36,-.92);plate.rotation.x=-.4;g.add(plate);}
    const head=new THREE.Mesh(new THREE.SphereGeometry(.46,10,8),bossMat(0x4db864,1,{rough:.65,ei:.14}));head.position.set(-.82,2.18,.50);head.scale.set(.72,.92,1.02);head.castShadow=true;g.add(head);
    const dish=new THREE.Mesh(new THREE.TorusGeometry(.26,.050,8,18),bossMat(0xded7a6,1,{rough:.35,metal:.1,ei:.05}));dish.rotation.x=Math.PI/2;dish.position.set(-.82,2.72,.40);g.add(dish);
    for(let i=0;i<18;i++){const hair=new THREE.Mesh(new THREE.ConeGeometry(.035,.78,4),bossMat(0x050a07,1,{rough:.9,ei:0}));hair.position.set(-1.25+i*.052,2.66,.10+rnd(-.04,.04));hair.rotation.x=1.1+rnd(-.20,.20);hair.rotation.z=(i-9)*.06;g.add(hair);}
    [-1,1].forEach(s=>{const eye=new THREE.Mesh(new THREE.SphereGeometry(.060,8,6),mb(0xffe36b));eye.position.set(-.82+s*.18,2.22,.93);eye.scale.set(1.75,.34,.8);g.add(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(.020,6,4),mb(0x080808));pupil.position.set(-.82+s*.19,2.20,1.02);pupil.scale.set(.65,1.7,.65);g.add(pupil);
      const brow=new THREE.Mesh(new THREE.BoxGeometry(.24,.045,.040),bossMat(0x07100b,1,{rough:.75,ei:0}));brow.position.set(-.82+s*.18,2.38,.93);brow.rotation.z=-s*.54;g.add(brow);
      const arm=new THREE.Mesh(new THREE.CylinderGeometry(.055,.15,1.06,6),bossMat(0x459b59,1,{rough:.68,ei:.10}));arm.position.set(-.82+s*.70,1.42,.36);arm.rotation.z=s*1.04;g.add(arm);
      const shin=new THREE.Mesh(new THREE.CylinderGeometry(.09,.17,.62,6),bossMat(0x459b59,1,{rough:.68,ei:.10}));shin.position.set(-.82+s*.34,.67,.10);shin.rotation.z=s*.16;g.add(shin);
      for(let j=0;j<4;j++){const claw=new THREE.Mesh(new THREE.ConeGeometry(.040,.26,4),bossMat(0xf2f0d2,1,{rough:.4,ei:.03}));claw.position.set(-.82+s*(1.05+j*.07),.94-j*.025,.55);claw.rotation.z=-s*1.12;g.add(claw);}});
    const snout=new THREE.Mesh(new THREE.ConeGeometry(.13,.64,5),bossMat(0xcbd963,1,{rough:.6,ei:.10}));snout.rotation.x=Math.PI/2;snout.position.set(-.82,2.02,1.08);g.add(snout);
    const maw=new THREE.Mesh(new THREE.BoxGeometry(.34,.06,.06),mb(0x270b0b));maw.position.set(-.82,1.89,1.16);g.add(maw);
    [-.18,-.07,.07,.18].forEach(x=>{const fang=new THREE.Mesh(new THREE.ConeGeometry(.030,.25,4),bossMat(0xffffff,1,{rough:.3,ei:.04}));fang.position.set(-.82+x,1.80,1.15);fang.rotation.x=Math.PI;g.add(fang);});
    for(let i=0;i<7;i++){const wart=new THREE.Mesh(new THREE.SphereGeometry(.035,6,4),bossMat(0x1f6f42,.72,{rough:.7,ei:.05}));wart.position.set(-1.06+i*.08,1.62+rnd(-.15,.24),.58+rnd(-.02,.08));g.add(wart);}
    const ch=new THREE.Group();ch.position.set(.92,1.82,.22);
    const paper=new THREE.Mesh(new THREE.CylinderGeometry(.43,.50,1.18,12),bossMat(0x8f4d2b,.96,{rough:.82,ei:.16}));ch.add(paper);
    for(let i=-4;i<=4;i++){const rib=new THREE.Mesh(new THREE.TorusGeometry(.48,.014,5,18),bossMat(0x2c1710,.86,{rough:.75,ei:.02}));rib.rotation.x=Math.PI/2;rib.position.y=i*.13;rib.scale.y=.86;ch.add(rib);}
    const eyeW=new THREE.Mesh(new THREE.SphereGeometry(.34,12,8),mb(0xfff5ef));eyeW.position.set(0,.08,.50);eyeW.scale.set(1.2,.72,.35);ch.add(eyeW);
    const iris=new THREE.Mesh(new THREE.SphereGeometry(.18,10,7),mb(0x8f1016));iris.position.set(.02,.08,.72);ch.add(iris);
    const pupil=new THREE.Mesh(new THREE.SphereGeometry(.082,8,5),mb(0x17100c));pupil.position.set(.04,.08,.84);ch.add(pupil);
    [-1,1].forEach(s=>{const lid=new THREE.Mesh(new THREE.ConeGeometry(.14,.65,4),mb(0x2a0c0a,.82));lid.position.set(s*.42,.26,.44);lid.rotation.z=s*.98;ch.add(lid);
      const smoke=new THREE.Mesh(new THREE.ConeGeometry(.05,.48,5),mb(0x2a1515,.38));smoke.position.set(s*.52,.05,.12);smoke.rotation.z=s*.8;ch.add(smoke);});
    const tongue=new THREE.Mesh(new THREE.CylinderGeometry(.11,.27,1.34,8),mb(0xb9232c));tongue.position.set(0,-.94,.42);tongue.scale.set(1,.96,.52);ch.add(tongue);
    const cap1=new THREE.Mesh(new THREE.CylinderGeometry(.42,.45,.12,12),bossMat(0x2a1610,1,{rough:.75,ei:.02}));cap1.position.y=.67;ch.add(cap1);const cap2=cap1.clone();cap2.position.y=-.67;ch.add(cap2);
    const hook=new THREE.Mesh(new THREE.TorusGeometry(.22,.035,6,14),bossMat(0x2a1610,1,{rough:.4,metal:.5,ei:0}));hook.position.y=.97;hook.scale.y=1.35;ch.add(hook);
    const glow=new THREE.Mesh(new THREE.SphereGeometry(.75,12,8),mb(0xff8c3a,.16));ch.add(glow);g.add(ch);g.userData.chochin=ch;
  }else if(season==="autumn"){
    core.scale.set(.92,1.18,.92);core.material.color.setHex(0x5d48e6);core.material.emissive.setHex(0x5d48e6);core.material.emissiveIntensity=.30;
    const coreFace=new THREE.Mesh(new THREE.SphereGeometry(.62,12,8),mb(0x7b61ff,.72));coreFace.position.y=2.0;g.add(coreFace);
    for(let i=0;i<26;i++){const a=Math.random()*Math.PI*2,r=.45+Math.random()*1.38;const col=i%4===0?0xffb25a:i%3?0x8fa0ff:0xd0b0ff;
      const o=new THREE.Mesh(new THREE.SphereGeometry(0.16+Math.random()*.16,8,6),mb(col,.68));o.position.set(Math.cos(a)*r,2.0+Math.sin(a*1.7)*1.04,Math.sin(a)*r);g.add(o);}
    [-.18,.18].forEach(x=>{const eye=new THREE.Mesh(new THREE.SphereGeometry(.05,7,5),mb(0xffe080));eye.position.set(x,2.12,.76);eye.scale.set(1.6,.45,.8);g.add(eye);});
    for(let i=0;i<8;i++){const a=i*Math.PI*2/8;const seal=new THREE.Mesh(new THREE.PlaneGeometry(.16,.86),mb(0xf4e6b8,.9));seal.position.set(Math.cos(a)*1.28,2.1+Math.sin(i)*.58,Math.sin(a)*1.28);seal.rotation.y=-a;seal.rotation.z=Math.sin(i)*.35;g.add(seal);}
    for(let i=0;i<6;i++){const spike=new THREE.Mesh(new THREE.ConeGeometry(.08,.46,5),mb(0xff9b44,.66));spike.position.set(Math.cos(i)*1.15,1.9+Math.sin(i*1.4)*.7,Math.sin(i)*1.15);spike.rotation.x=.8;g.add(spike);}
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.08,.025,6,34),mb(0xffb65a,.45));ring.rotation.x=Math.PI/2;ring.position.y=2.0;g.add(ring);
  }else{
    core.visible=false;
    const robe=new THREE.Mesh(new THREE.CylinderGeometry(.25,.58,2.9,8),bossMat(0xe5f6ff,.90,{rough:.72,ei:.10}));robe.position.y=1.46;robe.scale.set(.56,1,.42);robe.castShadow=true;g.add(robe);
    const blueHem=new THREE.Mesh(new THREE.CylinderGeometry(.36,.72,.30,8),bossMat(0x184e78,.86,{rough:.58,ei:.04}));blueHem.position.y=.06;blueHem.scale.set(.64,1,.50);g.add(blueHem);
    const orangeUnder=new THREE.Mesh(new THREE.PlaneGeometry(.22,1.26),bossMat(0xe56b2d,.9,{rough:.7,ei:.06}));orangeUnder.position.set(.13,.56,.38);orangeUnder.rotation.z=-.025;g.add(orangeUnder);
    const obi=new THREE.Mesh(new THREE.BoxGeometry(.66,.17,.12),bossMat(0xf0782f,1,{rough:.6,ei:.05}));obi.position.set(0,1.52,.42);g.add(obi);
    [-1,1].forEach(s=>{const knot=new THREE.Mesh(new THREE.ConeGeometry(.12,.50,5),bossMat(0xf0782f,1,{rough:.6,ei:.05}));knot.position.set(s*.32,1.49,.55);knot.rotation.z=s*1.22;g.add(knot);
      const sleeve=new THREE.Mesh(new THREE.ConeGeometry(.16,1.82,6),bossMat(0xd4efff,.74,{rough:.68,ei:.08}));sleeve.position.set(s*.58,1.58,.02);sleeve.rotation.z=s*.70;sleeve.rotation.x=.10;g.add(sleeve);
      const cuff=new THREE.Mesh(new THREE.ConeGeometry(.14,.68,6),bossMat(0x0f5f91,.58,{rough:.5,ei:.05}));cuff.position.set(s*1.03,1.02,.08);cuff.rotation.z=s*.93;g.add(cuff);});
    const head=new THREE.Mesh(new THREE.SphereGeometry(.25,10,8),bossMat(0xf7f3ee,1,{rough:.5,ei:.12}));head.position.y=2.96;head.scale.set(.55,1.18,.60);head.castShadow=true;g.add(head);
    const lips=new THREE.Mesh(new THREE.BoxGeometry(.08,.018,.018),bossMat(0x8e1f35,1,{rough:.4,ei:.03}));lips.position.set(0,2.74,.23);g.add(lips);
    [-.068,.068].forEach(x=>{const eye=new THREE.Mesh(new THREE.SphereGeometry(.021,6,4),mb(0x0f2e55));eye.position.set(x,2.99,.24);eye.scale.set(1.9,.34,.8);g.add(eye);
      const brow=new THREE.Mesh(new THREE.BoxGeometry(.10,.018,.018),bossMat(0x122b48,1,{rough:.6,ei:.02}));brow.position.set(x,3.08,.22);brow.rotation.z=-Math.sign(x)*.28;g.add(brow);});
    const hairBack=new THREE.Mesh(new THREE.CylinderGeometry(.22,.68,3.18,9),bossMat(0x092a52,.92,{rough:.5,ei:.05}));hairBack.position.set(0,2.02,-.22);hairBack.rotation.x=.10;g.add(hairBack);
    const faceGlow=new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),mb(0xf9f5ef,.78));faceGlow.position.set(0,2.92,.26);faceGlow.scale.set(.58,1.10,.18);g.add(faceGlow);
    const hairFront=new THREE.Mesh(new THREE.ConeGeometry(.14,.88,5),bossMat(0x0f3e70,.84,{rough:.5,ei:.05}));hairFront.position.set(-.16,2.82,.08);hairFront.rotation.z=.26;g.add(hairFront);
    for(let i=0;i<21;i++){const s=(i-10)/10;const strand=new THREE.Mesh(new THREE.ConeGeometry(.027,1.05+Math.abs(s)*1.05,4),bossMat(0x14508b,.9,{rough:.45,ei:.05}));strand.position.set(s*.72,2.78-Math.abs(s)*.13,-.05-Math.abs(s)*.08);strand.rotation.z=-s*.86;strand.rotation.x=.48+Math.abs(s)*.40;g.add(strand);}
    for(let i=0;i<9;i++){const shard=new THREE.Mesh(new THREE.ConeGeometry(.050,.56,5),mb(0xe9fbff,.72));shard.position.set(Math.cos(i)*1.08,1.30+Math.sin(i*1.7)*.78,Math.sin(i)*1.08);g.add(shard);}
  }
  taijiAttachBossAsset(season,g);
  return g;
}
function autumnBossPhase2(b){
  if(!b||b.phase2)return;b.phase2=true;b.cfg.name="大鬼と化した人魂";taijiSetBossName("bossName",b.cfg.name);
  const g=b.g;g.scale.setScalar(1.28);b.baseScale=g.scale.clone();b.hp=Math.ceil(b.maxHp*.82);b.maxHp=Math.ceil(b.maxHp*1.18);updateBossBar(b);
  b._tjf2Rage=false;const rw=$(b&&b.wrapId?b.wrapId:"bossBar");if(rw)rw.classList.remove("tjf2-rage");
  b._tjf3Stagger=0;b._tjf3SignUntil=0; // 波G: 第2形態移行で見切り状態をリセット
  while(g.children.length)g.remove(g.children[0]);
  g.userData.core=null;g.userData.aura=null;
  g.userData.assetReady=false;g.userData.assetLoading=false;g.userData.assetModel=null;g.userData.assetFallback=null;g.userData.bossPresence=null;
  g.userData.faceLocal=TAIJI_BOSS_FACE.oni.clone();
  const mb2=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,side:THREE.DoubleSide});
  const wrath=new THREE.Mesh(new THREE.SphereGeometry(1.55,12,8),mb2(0x8f1010,.16));wrath.position.y=1.72;g.add(wrath);
  const body=new THREE.Mesh(new THREE.SphereGeometry(.78,10,8),bossMat(0xe64a4a,.96,{rough:.7,ei:.14}));body.position.y=1.58;body.scale.set(1.0,1.36,.68);body.castShadow=true;g.add(body);
  const chest=new THREE.Mesh(new THREE.SphereGeometry(.42,8,6),bossMat(0xff7b70,.8,{rough:.65,ei:.12}));chest.position.set(0,1.82,.48);chest.scale.set(1.45,.8,.25);g.add(chest);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.48,10,8),bossMat(0xe64a4a,.98,{rough:.68,ei:.16}));head.position.y=2.58;head.scale.set(1.0,.85,.78);head.castShadow=true;g.add(head);
  [-1,1].forEach(s=>{const horn=new THREE.Mesh(new THREE.ConeGeometry(0.13,0.68,5),bossMat(0xf2dfb0,1,{rough:.4,ei:.05}));horn.position.set(s*.28,3.06,.02);horn.rotation.z=-s*.55;g.add(horn);
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.055,7,5),mb2(0xfff06b));eye.position.set(s*.17,2.62,.43);g.add(eye);
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(.10,.19,1.08,6),bossMat(0xe64a4a,1,{rough:.7,ei:.12}));arm.position.set(s*.74,1.68,.16);arm.rotation.z=s*.88;g.add(arm);
    for(let j=0;j<3;j++){const claw=new THREE.Mesh(new THREE.ConeGeometry(.045,.26,5),bossMat(0xf5d2b6,1,{rough:.4,ei:.04}));claw.position.set(s*(1.09+j*.07),1.16-j*.025,.25);claw.rotation.z=-s*.82;g.add(claw);}
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.14,.22,.75,6),bossMat(0xd83d3d,1,{rough:.7,ei:.12}));leg.position.set(s*.36,.64,.16);leg.rotation.z=s*.18;g.add(leg);});
  {const NH=IS_TOUCH?6:9;for(let i=0;i<NH;i++){const hair=new THREE.Mesh(new THREE.ConeGeometry(.06,.75,4),bossMat(0x050505,1,{rough:.85,ei:0}));hair.position.set((i-NH/2)*.10,2.96,-.03);hair.rotation.x=.75;hair.rotation.z=(i-NH/2)*-.09;g.add(hair);}}
  const cloth=new THREE.Mesh(new THREE.CylinderGeometry(.62,.72,.34,8),bossMat(0xf2d56b,1,{rough:.82,ei:.03}));cloth.position.y=1.02;cloth.scale.set(1,.8,.65);g.add(cloth);
  [-.42,-.18,.08,.34].forEach(x=>{const stripe=new THREE.Mesh(new THREE.BoxGeometry(.08,.37,.06),bossMat(0x151008,1,{rough:.9,ei:0}));stripe.position.set(x,1.03,.48);stripe.rotation.z=.5;g.add(stripe);});
  const club=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.17,2.35,7),bossMat(0x2a1914,1,{rough:.55,metal:.35,ei:0}));club.position.set(.98,1.8,.12);club.rotation.z=-.58;g.add(club);
  for(let i=0;i<6;i++){const spike=new THREE.Mesh(new THREE.ConeGeometry(.045,.16,4),bossMat(0x1a0d09,1,{rough:.4,metal:.3,ei:0}));spike.position.set(.98+Math.sin(i)*.13,1.05+i*.22,.18);spike.rotation.x=Math.PI/2;g.add(spike);}
  {const NS=IS_TOUCH?5:10;for(let i=0;i<NS;i++){const a=i*Math.PI*2/NS;const spark=new THREE.Mesh(new THREE.SphereGeometry(.12,7,5),mb2(0xff8a3c,.6));spark.position.set(Math.cos(a)*1.45,1.8+Math.sin(i)*.9,Math.sin(a)*1.45);g.add(spark);}} // 波AN: モバイルは装飾スパーク数を半減
  taijiAttachBossAsset("oni",g);
  b.cfg.attack="oni";
  if(APP.storyTaiji){ // 波AI: 物語第5話——人魂を祓った直後、大鬼自身の言葉で連戦へ繋ぐ
    taijiCine("大鬼","「ヨクゾ祓ッタ、ワタシノ人魂タチヲ。——ダガ未練ハ、斬ルホド固マル。次ハ、コノ身デ問オウ」",3400);
    taijiMsg("散った人魂の未練が凝り固まり、大鬼が立ち上がった！",3000);
  }else{
    taijiCine("第2形態", "怨念が肉を得て大鬼となる", 2100);taijiMsg("人魂が一度散り、怨念をまとった大鬼として復活した！",3000);
  }
  seFuda();
}
function spawnBoss(k){
  k.bossSpawned=true;k._bossCleared=false;const cfg=BOSS_CFG[k.season]||BOSS_CFG.spring;
  const mul=(k.diff&&k.diff.bossMul)||1,A=TAIJI_BOSS_ARENA,now=performance.now();
  const storyKappa=!!(APP.storyTaiji&&APP.storyTaiji.kappaOnly)&&k.season==="summer"; // 波Q: 物語第3話は河童単体戦
  k.storyKappa=storyKappa; // 波X: 撃破後メッセージでも単体討伐と分かるよう保持
  if(storyKappa){
    // 河童の主のみ。提灯お化けは出さず、1本のHPバーで戦う
    const combined=makeBoss("summer");const ch=combined.userData.chochin;if(ch)combined.remove(ch);
    combined.position.set(A.x,0,A.z);scene.add(combined);
    combined.userData.faceLocal=TAIJI_BOSS_FACE.kappa.clone();
    taijiAttachBossAsset("kappa",combined);
    const kHp=Math.ceil(104*mul); // 単体なのでHPを厚めに
    const kappa={g:combined,cfg:{name:"河童の主",col:0x33c884,attack:"kappa"},hp:kHp,maxHp:kHp,nextAtk:now+3600,dead:false,movePhase:Math.random()*9,role:"kappa",faceLocal:TAIJI_BOSS_FACE.kappa.clone(),barId:"bossHpFill",nameId:"bossName",wrapId:"bossBar",baseScale:combined.scale.clone()};
    k.bosses=[kappa];
    taijiSetBossName("bossName",kappa.cfg.name);$("bossHpFill").style.width="100%";$("bossBar").style.display="block";
    $("bossBar").classList.remove("boss-low");$("bossBar2").classList.remove("boss-low");$("bossBar2").style.display="none";
  }else if(k.season==="summer"){
    // 河童の主と提灯お化けを「別個体」に分離(別HPバー・別の動き・別の攻撃)
    const combined=makeBoss("summer");                 // 河童本体＋提灯(ch)を含む
    const ch=combined.userData.chochin; if(ch)combined.remove(ch);
    combined.position.set(A.x-7.5,0,A.z+3.6);scene.add(combined);
    const kHp=Math.ceil(78*mul);
    combined.userData.faceLocal=TAIJI_BOSS_FACE.kappa.clone();
    const kappa={g:combined,cfg:{name:"河童の主",col:0x33c884,attack:"kappa"},hp:kHp,maxHp:kHp,nextAtk:now+2200,dead:false,movePhase:Math.random()*9,role:"kappa",faceLocal:TAIJI_BOSS_FACE.kappa.clone(),barId:"bossHpFill",nameId:"bossName",wrapId:"bossBar",baseScale:combined.scale.clone()};
    taijiAttachBossAsset("kappa",combined);
    const cg=new THREE.Group();
    if(ch){ch.position.set(0,1.5,0);cg.add(ch);cg.userData.core=ch.children.find(o=>o.geometry&&o.geometry.type==="CylinderGeometry")||null;}
    cg.userData.faceLocal=TAIJI_BOSS_FACE.chochin.clone();
    cg.position.set(A.x+8.5,0,A.z-4.4);scene.add(cg);
    const cHp=Math.ceil(62*mul);
    const chochin={g:cg,cfg:{name:"提灯お化け",col:0xff7a33,attack:"chochin"},hp:cHp,maxHp:cHp,nextAtk:now+3000,dead:false,movePhase:Math.random()*9+3,role:"chochin",faceLocal:TAIJI_BOSS_FACE.chochin.clone(),barId:"bossHpFill2",nameId:"bossName2",wrapId:"bossBar2",baseScale:cg.scale.clone()};
    taijiAttachBossAsset("chochin",cg);
    k.bosses=[kappa,chochin];
    taijiSetBossName("bossName",kappa.cfg.name);$("bossHpFill").style.width="100%";$("bossBar").style.display="block";
    taijiSetBossName("bossName2",chochin.cfg.name);$("bossHpFill2").style.width="100%";$("bossBar2").style.display="block";
    $("bossBar").classList.remove("boss-low");$("bossBar2").classList.remove("boss-low");
  }else{
    const g=makeBoss(k.season);g.position.set(A.x,0,A.z);scene.add(g);
    const hp=Math.ceil(cfg.hp*mul);
    k.bosses=[{g,cfg:Object.assign({},cfg),hp,maxHp:hp,nextAtk:now+2400,dead:false,movePhase:Math.random()*9,faceLocal:(TAIJI_BOSS_FACE[k.season]||new THREE.Vector3(0,2,.8)).clone(),barId:"bossHpFill",nameId:"bossName",wrapId:"bossBar",baseScale:g.scale.clone()}];
    taijiSetBossName("bossName",cfg.name);$("bossHpFill").style.width="100%";$("bossBar").style.display="block";
    $("bossBar").classList.remove("boss-low");$("bossBar2").classList.remove("boss-low");$("bossBar2").style.display="none";
  }
  k.boss=k.bosses[0];
  taijiAutoLockBoss(k);
  $("taijiRemain").textContent="ボス";taijiMsg(storyKappa?"遣水の底から、水底の主が姿を現す…！":"東の奥に強大な気配…！ ボス戦へ",2800);seFuda();
  taijiCine("開戦", "霧の結界が閉じた。退く道はない", 1500);
  // 波Y: 描き下ろしボスアイコン(軽量WebP)。夏=河童単体は専用絵、夏=通常戦は提灯お化け側、秋=巨大人魂
  const bossIcon=storyKappa?"icons/kappa_icon.webp":(k.season==="summer"?"icons/chochin_concept.webp":k.season==="autumn"?"icons/hitodama_concept.webp":null);
  tjfxBossIntro(storyKappa?"河童の主":(k.season==="summer"?"河童の主と提灯お化け":(k.bosses[0].cfg&&k.bosses[0].cfg.name)||"ボス"),bossIcon); // 波E: 見参ネームカード
  if(typeof SFX!=="undefined")SFX.playBossBgm(k.season); // 季節別ボス戦BGM
}
function updateBossBar(b){
  const el=$(b&&b.barId?b.barId:"bossHpFill");if(el)el.style.width=Math.max(0,b.hp/b.maxHp*100)+"%";
  const chip=$((b&&b.barId?b.barId:"bossHpFill")+"Chip");if(chip)chip.style.width=Math.max(0,b.hp/b.maxHp*100)+"%";
  const wrap=$(b&&b.wrapId?b.wrapId:"bossBar");if(wrap)wrap.classList.toggle("boss-low",!!b&&b.hp/Math.max(1,b.maxHp)<.28);
}
function damageBoss(b,dmg,kind="hit"){
  const now=performance.now();if(!b||b.dead)return false;
  if(now<(b.invulnUntil||0)){taijiMsg((b.cfg&&b.cfg.name||"ボス")+"には通らない…",620);taijiWorldFloat(taijiBossAimPoint(b)||b.g.position,"無効","mute");return false;}
  let amount=dmg;
  if(now<(b._tjf3Stagger||0))amount=Math.ceil(amount*TAIJI_TUNING.mikiriDmgMul); // 波G: 見切りで体勢崩し中は倍率アップ
  if(now<(b.defenseUntil||0))amount=Math.max(1,Math.ceil(amount*.28));
  if(now<(b.staggerUntil||0))amount=Math.ceil(amount*1.35);
  if(kind==="fuda")amount=Math.ceil(amount*1.05);
  b.hp=Math.max(0,b.hp-amount);updateBossBar(b);
  if(kind!=="silent")seArrowHit();
  const m=b.g&&b.g.userData&&b.g.userData.core&&b.g.userData.core.material;if(m){const o=m.opacity;m.opacity=1;setTimeout(()=>{if(m)m.opacity=o;},110);}
  if(kind!=="silent"){taijiWorldFloat(taijiBossAimPoint(b)||b.g.position,"-"+amount,(kind==="parry"||kind==="reflect")?"guard":"good");taijiComboHit(kind,amount,b);}
  if(b.hp>0&&b.hp/b.maxHp<.5&&!b._tjf2Rage){b._tjf2Rage=true;
    taijiCine("荒魂",(b.cfg&&b.cfg.name||"ボス")+"の霊気が猛る",1500);
    const wrap=$(b&&b.wrapId?b.wrapId:"bossBar");if(wrap){wrap.classList.add("tjf2-rage");}
    beep(110,.4,"sawtooth",.14);setTimeout(()=>beep(82,.5,"sawtooth",.12),200);
    if(typeof juiceShake==="function")juiceShake();
  }
  if(kind!=="silent"&&kind!=="dot"){
    const gain={parry:38,reflect:30,sword:20,fuda:13,arrow:7,hit:5}[kind]||6;
    taijiAddBossPosture(b,gain);
  }
  if(b.hp>0&&b.hp/b.maxHp<.28&&!b._lowHpWarned){b._lowHpWarned=true;taijiCine("追い詰めた", (b.cfg&&b.cfg.name||"ボス")+"が荒ぶっている", 1300);}
  if(now<(b.defenseUntil||0))taijiMsg("甲羅に阻まれた。効きが浅い！",760);
  return true;
}
function bossStartDash(b,pp,now,opt={}){
  const g=b.g,from=g.position.clone(),dir=pp.clone().sub(from).setY(0);if(dir.lengthSq()<.01)dir.set(0,0,1);dir.normalize();
  const len=opt.len||Math.min(12,Math.max(6,from.distanceTo(pp)+2.5)),end=bossArenaClampVec(from.clone().add(dir.clone().multiplyScalar(len)),1.8);
  b.state="dash";b.stateStart=now;b.stateUntil=now+(opt.tele||620)+(opt.dur||280);b.dashTele=opt.tele||620;b.dashDur=opt.dur||280;b.dashFrom=from;b.dashTo=end;b.dashHit=false;b.dashSource=opt.label||{waterCut:"水の突進",spiritBand:"霊帯突進",smash:"叩きつけ"}[opt.fx]||"突進";b.invulnUntil=now+(opt.tele||620)+(opt.dur||280)+120;
  taijiWorldFloat(taijiBossAimPoint(b)||g.position,"突進", "bad");
  bossLine(from,end,opt.width||1.45,opt.col||b.cfg.col,opt.dmg||12,opt.tele||620,opt.dur||280,{fx:opt.fx||"smash",slow:opt.slow||0,label:b.dashSource});
}
function bossStartDefense(b,now){
  b.state="defense";b.stateStart=now;b.stateUntil=now+2200;b.defenseUntil=b.stateUntil;b.invulnUntil=now+260;
  taijiWorldFloat(taijiBossAimPoint(b)||b.g.position,"甲羅防御", "guard");
  taijiMsg("河童が甲羅にこもった。守りが固い！",1200);seBossCast("blunt");
}
function bossStartBlind(K,b,now){
  b.state="blind";b.stateStart=now;b.stateUntil=now+1850;b.invulnUntil=now+650;
  K.blindUntil=now+2400;const el=$("taijiBlind");if(el)el.style.opacity=.82;
  taijiCine("視界封じ", "提灯お化けが間合いを奪う", 1200);
  taijiMsg("提灯お化けが視界を塞ぐ！",1200);seBossCast("fire");
}
function bossUpdateAction(K,b,now,dt){
  if(!b.state)return false;
  const g=b.g,age=now-(b.stateStart||now);
  if(b.state==="dash"){
    bossTurnToward(g,b.dashTo||player.pos,dt,0,8.5);
    if(age>=b.dashTele){
      const u=Math.min(1,(age-b.dashTele)/Math.max(1,b.dashDur));g.position.lerpVectors(b.dashFrom,b.dashTo,u);
      /* 接触の別判定は設けない。地面に示した直線の危険域だけが当たる。 */
    }else{g.position.y=.012;g.userData.kitsuneStepBoost=.75;}
    if(now>=b.stateUntil){b.state=null;g.position.y=0;g.userData.kitsuneStepBoost=0;
      if(APP.taiji?.season==="summer"&&!APP.taiji.storyKappa)taijiWorldFloat(taijiBossAimPoint(b)||g.position,"突進後の隙","good");
      return false;}
    return true;
  }
  if(b.state==="defense"){
    const u=Math.min(1,age/260);g.scale.y=1-(.42*Math.sin(Math.min(1,u)*Math.PI*.5));
    if(now>=b.stateUntil){b.state=null;g.scale.y=1;return false;}
    return true;
  }
  if(b.state==="blind"){
    const front=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
    g.position.lerp(camera.position.clone().add(front.multiplyScalar(3.2)).setY(1.7),Math.min(1,dt*4.4));
    bossTurnToward(g,camera.position,dt,Math.PI,7);
    if(now>=b.stateUntil){b.state=null;return false;}
    return true;
  }
  return false;
}
const bossProjs=[],bossHazards=[],BOSS_PROJ_UP=new THREE.Vector3(0,1,0);
const TAIJI_PARRY_PINK=0xff2f9f;
function bossFxMat(col,op){
  const parry=col===TAIJI_PARRY_PINK;
  return new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:parry?Math.max(op||0,.98):op,side:THREE.DoubleSide,depthWrite:false,depthTest:false,blending:parry?THREE.NormalBlending:THREE.AdditiveBlending});
}
function bossSetFxOpacity(o,op){
  if(!o)return;
  if(o.material)o.material.opacity=op;
  if(o.traverse)o.traverse(c=>{if(c.material)c.material.opacity=op;});
}
function bossProjMesh(col,opt={}){
  const parry=col===TAIJI_PARRY_PINK,s=(opt.size||0.3)*(parry?1.14:1),shape=opt.shape||(opt.cone?"rock":"orb"),mat=bossFxMat(col,parry?Math.max(opt.opacity||0,.98):(opt.opacity||.92));
  let geo,alignY=false;
  if(shape==="fox"||shape==="flame"){geo=new THREE.ConeGeometry(s*.72,s*2.85,7);alignY=true;}
  else if(shape==="ice"){geo=new THREE.ConeGeometry(s*.36,s*3.65,5);alignY=true;}
  else if(shape==="water"){geo=new THREE.ConeGeometry(s*.68,s*2.25,7);alignY=true;}
  else if(shape==="soul"){geo=new THREE.TetrahedronGeometry(s*1.28,0);}
  else if(shape==="rock"){geo=new THREE.DodecahedronGeometry(s*1.12,0);}
  else{geo=new THREE.SphereGeometry(s,8,6);}
  const m=new THREE.Mesh(geo,mat);m.userData.alignY=alignY;m.userData.fxShape=shape;return m;
}
function bossHazardMesh(r,col,opt={}){
  const fx=opt.fx||opt.kind||"ring",mat=bossFxMat(col,opt.opacity||.56);let m;
  if(fx==="pillar"){m=new THREE.Mesh(new THREE.CylinderGeometry(.18,.30,3.2,7),mat);m.position.y=1.55;m.scale.set(r,.04,r);}
  else if(fx==="geyser"){m=new THREE.Mesh(new THREE.CylinderGeometry(.10,.36,2.55,8),mat);m.position.y=1.28;m.scale.set(r,.05,r);}
  else if(fx==="flame"){m=new THREE.Mesh(new THREE.ConeGeometry(.40,2.75,7),mat);m.position.y=1.34;m.scale.set(r,.05,r);}
  else if(fx==="pool"||fx==="mist"){m=new THREE.Mesh(new THREE.CircleGeometry(1,34),mat);m.rotation.x=-Math.PI/2;m.position.y=.13;m.scale.setScalar(Math.max(.2,r));}
  else if(fx==="sigil"){const g=new THREE.Group(),ring=new THREE.Mesh(new THREE.RingGeometry(.62,1,36),mat),bar1=new THREE.Mesh(new THREE.BoxGeometry(1.55,.035,.075),mat),bar2=new THREE.Mesh(new THREE.BoxGeometry(1.55,.035,.075),mat);ring.rotation.x=-Math.PI/2;bar1.position.y=.03;bar2.position.y=.035;bar2.rotation.y=Math.PI/2;g.add(ring,bar1,bar2);g.position.y=.16;g.scale.setScalar(Math.max(.2,r));m=g;}
  else{m=new THREE.Mesh(new THREE.RingGeometry(.72,1,40),mat);m.rotation.x=-Math.PI/2;m.position.y=.16;m.scale.setScalar(Math.max(.2,r));}
  m.userData.fx=fx;return m;
}
function bossLineMesh(len,width,col,opt={}){
  const fx=opt.fx||"line",mat=bossFxMat(col,opt.opacity||.58);let m;
  if(fx==="tongue"){m=new THREE.Mesh(new THREE.CylinderGeometry(width*.17,width*.30,len,8),mat);m.userData.alignY=true;}
  else if(fx==="iceBeam"){m=new THREE.Mesh(new THREE.BoxGeometry(len,.07,width*.72),mat);}
  else if(fx==="waterCut"){m=new THREE.Mesh(new THREE.BoxGeometry(len,.055,width),mat);}
  else if(fx==="smash"){m=new THREE.Mesh(new THREE.BoxGeometry(len,.11,width),mat);}
  else if(fx==="spiritBand"){m=new THREE.Mesh(new THREE.BoxGeometry(len,.055,width*.82),mat);}
  else{m=new THREE.Mesh(new THREE.BoxGeometry(len,.06,width),mat);}
  m.userData.fx=fx;return m;
}
function bossTelegraphDelay(delay){return Math.max(delay||0,(APP.taiji&&APP.taiji.diffKey==="hard")?760:920);}
function bossLiteCount(n){return Math.max(1,Math.round(n*(IS_TOUCH?0.72:1)));}
function bossTrimFx(arr,limit){
  while(arr.length>limit){
    const old=arr.shift();
    if(old&&old.m)taijiDisposeFx(old.m);
    if(old&&old.guide)taijiDisposeFx(old.guide);
  }
}
/* 足元の薄い塗り面を判定値から直接生成し、装飾形状に頼らず危険域を示す。 */
function bossAreaGuide(pos,r,col){
  const mat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false,depthTest:false});
  const m=new THREE.Mesh(new THREE.CircleGeometry(r,32),mat);
  m.rotation.x=-Math.PI/2;m.position.set(pos.x,.12,pos.z);m.renderOrder=7;scene.add(m);return m;
}
function bossLineGuide(a,b,width,col){
  const len=Math.max(.1,a.distanceTo(b));
  const mat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false,depthTest:false});
  const m=new THREE.Mesh(new THREE.BoxGeometry(len,.018,width*1.1),mat);
  m.position.copy(a).lerp(b,.5).setY(.13);m.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);m.renderOrder=7;scene.add(m);return m;
}
function bossFan(bp,pp,col,dmg,count,spread,spd,opt={}){
  const base=Math.atan2(pp.z-bp.z,pp.x-bp.x),n=bossLiteCount(count);
  for(let i=0;i<n;i++){const a=base-spread/2+(n===1?0:spread*i/(n-1));spawnBossProjDir(bp.clone(),new THREE.Vector3(Math.cos(a),0,Math.sin(a)),col,dmg,spd,opt);}
}
function bossCircleRing(center,count,radius,areaR,col,dmg,delayStep=90,opt={}){
  const n=bossLiteCount(count);
  for(let i=0;i<n;i++){const a=i*Math.PI*2/n;bossCircle(center.clone().add(new THREE.Vector3(Math.cos(a)*radius,0,Math.sin(a)*radius)),areaR,col,dmg,760+i*delayStep,260,opt);}
}
function seBossCast(key){
  seMagic(key);
  if(key==="ice"){beep(720,.06,"sine",.035);setTimeout(()=>beep(980,.08,"sine",.03),55);}
  else if(key==="fire"){beep(190,.07,"sawtooth",.035);setTimeout(()=>beep(420,.05,"triangle",.028),45);}
  else if(key==="blunt"||key==="slash"){beep(96,.08,"square",.045);setTimeout(()=>beep(64,.10,"square",.035),70);}
  else beep(330,.07,"triangle",.035);
}
function spawnBossProj(from,to,col,dmg,spd,opt={}){
  bossTrimFx(bossProjs,IS_TOUCH?26:42);
  const m=bossProjMesh(col,opt);
  const src=from.clone(),dst=to.clone();
  if(opt.height!=null){src.y=opt.height;dst.y=opt.height;}
  m.position.copy(src);m.renderOrder=8;scene.add(m);
  const dir=dst.clone().sub(src);if(dir.lengthSq()<0.01)dir.set(0,0,1);dir.normalize();
  if(m.userData.alignY)m.quaternion.setFromUnitVectors(BOSS_PROJ_UP,dir.clone());
  bossProjs.push({m,dir,spd:spd||9,born:performance.now(),dmg,lifetime:opt.lifetime||4500,homing:opt.homing||0,slow:opt.slow||0,wobble:opt.wobble||0,pulse:opt.pulse||0,phase:Math.random()*9,hit2d:!!opt.hit2d,hitR:opt.hitR||1.7,parryable:opt.parryable===true||col===TAIJI_PARRY_PINK,label:opt.label,shape:opt.shape});
}
function spawnBossProjDir(from,dir,col,dmg,spd,opt={}){
  const to=from.clone().add(dir.clone().normalize().multiplyScalar(10));
  spawnBossProj(from,to,col,dmg,spd,opt);
}
function bossCircle(pos,r,col,dmg,delay=700,dur=260,opt={}){
  bossTrimFx(bossHazards,IS_TOUCH?14:24);
  delay=bossTelegraphDelay(delay);
  const m=bossHazardMesh(r,col,opt);
  m.position.x=pos.x;m.position.z=pos.z;m.renderOrder=9;scene.add(m);
  const guide=bossAreaGuide(pos,r,col);
  bossHazards.push({kind:opt.kind||"circle",fx:opt.fx||opt.kind||"ring",label:opt.label,m,guide,pos:pos.clone(),r,dmg,born:performance.now(),delay,dur,hit:false,slow:opt.slow||0,pull:opt.pull||0,tick:opt.tick||0,nextTick:0,parryable:col===TAIJI_PARRY_PINK,unguardable:col!==TAIJI_PARRY_PINK});
}
function bossLine(from,to,width,col,dmg,delay=420,dur=280,opt={}){
  bossTrimFx(bossHazards,IS_TOUCH?14:24);
  delay=bossTelegraphDelay(delay);
  const a=new THREE.Vector3(from.x,.22,from.z),b=new THREE.Vector3(to.x,.22,to.z),len=Math.max(.1,a.distanceTo(b));
  const m=bossLineMesh(len,width,col,opt);
  m.position.copy(a).lerp(b,.5);
  if(m.userData.alignY)m.quaternion.setFromUnitVectors(BOSS_PROJ_UP,b.clone().sub(a).normalize());
  else m.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);
  m.renderOrder=9;scene.add(m);
  const guide=bossLineGuide(a,b,width,col);
  bossHazards.push({kind:"line",fx:opt.fx||"line",label:opt.label,m,guide,a,b,width,dmg,born:performance.now(),delay,dur,hit:false,slow:opt.slow||0,parryable:col===TAIJI_PARRY_PINK,unguardable:col!==TAIJI_PARRY_PINK});
}
function bossWave(center,col,dmg,maxR=13,delay=900){
  bossTrimFx(bossHazards,IS_TOUCH?14:24);
  delay=bossTelegraphDelay(delay);
  const m=new THREE.Mesh(new THREE.RingGeometry(.88,1.08,54),bossFxMat(col,.72));
  m.rotation.x=-Math.PI/2;m.position.set(center.x,.18,center.z);m.renderOrder=9;scene.add(m);
  bossHazards.push({kind:"wave",fx:"wave",m,pos:center.clone(),r:0,maxR,dmg,born:performance.now(),delay,dur:980,hit:false,parryable:false,unguardable:true});
}
function distSeg2D(px,pz,a,b){
  const vx=b.x-a.x,vz=b.z-a.z,wx=px-a.x,wz=pz-a.z,c1=vx*wx+vz*wz,c2=vx*vx+vz*vz,t=c2?Math.max(0,Math.min(1,c1/c2)):0;
  const x=a.x+vx*t,z=a.z+vz*t;return Math.hypot(px-x,pz-z);
}
function updateBossHazards(K,now,dt){
  const pp=player.pos;
  for(let i=bossHazards.length-1;i>=0;i--){
    const h=bossHazards[i],age=now-h.born,active=age>=h.delay,life=h.delay+h.dur;
    if(h.kind==="wave"){
      const u=active?Math.min(1,(age-h.delay)/h.dur):0;h.r=active?h.maxR*u:.82+Math.sin(age*.018)*.08;h.m.scale.setScalar(Math.max(.1,h.r));bossSetFxOpacity(h.m,active ? .72*(1-u) : .42+Math.sin(age*.018)*.12);
      const d=Math.hypot(pp.x-h.pos.x,pp.z-h.pos.z);if(!h.hit&&active&&d>=h.r*.88&&d<=h.r*1.08){h.hit=true;taijiDamage(h.dmg,h);taijiMsg("大鬼の衝撃波！",900);seBossCast("blunt");}
    }else if(h.kind==="line"){
      bossSetFxOpacity(h.m,active ? .78 : .34+Math.sin(age*.02)*.18);
      if(active&&(h.fx==="tongue"||h.fx==="waterCut"||h.fx==="smash"))h.m.scale.z=1+Math.sin(age*.032)*.035;
      if(!h.hit&&active&&distSeg2D(pp.x,pp.z,h.a,h.b)<h.width*.55){h.hit=true;if(h.slow)K.slowUntil=now+h.slow;taijiDamage(h.dmg,h);}
    }else{
      const bornU=active?Math.min(1,(age-h.delay)/Math.max(1,h.dur*.42)):0;
      if(h.fx==="pillar"||h.fx==="geyser"||h.fx==="flame"){
        h.m.scale.y=active?(.16+bornU*.94):(.035+Math.sin(age*.018)*.015);
        h.m.position.y=(h.fx==="pillar"?1.55:h.fx==="geyser"?1.26:1.34)*Math.max(.12,h.m.scale.y);
        bossSetFxOpacity(h.m,active?(.58*(1-Math.max(0,(age-h.delay-h.dur*.45)/(h.dur*.55)))):(.20+Math.sin(age*.02)*.14));
      }else{
        bossSetFxOpacity(h.m,active?(.34+Math.sin(age*.012)*.12):(.18+Math.sin(age*.02)*.18));
        h.m.rotation.z+=dt*(active?1.6:.7);
      }
      const d=Math.hypot(pp.x-h.pos.x,pp.z-h.pos.z);
      if(active&&d<h.r){
        if(h.tick){if(now>h.nextTick){h.nextTick=now+h.tick;if(h.slow)K.slowUntil=now+h.slow;if(h.pull){const dir=h.pos.clone().sub(pp).setY(0);if(dir.lengthSq()>0.01){dir.normalize();player.pos.x+=dir.x*h.pull;player.pos.z+=dir.z*h.pull;}}taijiDamage(h.dmg,h);}}
        else if(!h.hit){h.hit=true;if(h.slow)K.slowUntil=now+h.slow;taijiDamage(h.dmg,h);}
      }
    }
    if(h.guide)bossSetFxOpacity(h.guide,active?.28:.20);
    if(age>life){taijiDisposeFx(h.m);if(h.guide)taijiDisposeFx(h.guide);bossHazards.splice(i,1);}
  }
}
function clearBossBattleFx(){bossProjs.forEach(p=>taijiDisposeFx(p.m));bossProjs.length=0;bossHazards.forEach(h=>{taijiDisposeFx(h.m);if(h.guide)taijiDisposeFx(h.guide);});bossHazards.length=0;const blind=$("taijiBlind");if(blind)blind.style.opacity=0;}
function bossArenaClampVec(v,margin=2){
  const cx=TAIJI_BOSS_ARENA.x,cz=TAIJI_BOSS_ARENA.z,r=TAIJI_BOSS_ARENA.r-margin;
  const dx=v.x-cx,dz=v.z-cz,d=Math.hypot(dx,dz);
  if(d>r){v.x=cx+dx/d*r;v.z=cz+dz/d*r;}
  if(v.z>TAIJI_BOSS_ARENA.gateZ-1.4)v.z=TAIJI_BOSS_ARENA.gateZ-1.4;
  return v;
}
function bossTurnToward(g,target,dt,offset=0,rate=5.5){
  const origin=(g.userData&&g.userData.faceLocal)?g.localToWorld(g.userData.faceLocal.clone()):g.position;
  const dx=target.x-origin.x,dz=target.z-origin.z;
  if(Math.abs(dx)+Math.abs(dz)<.001)return;
  const want=Math.atan2(dx,dz)+offset;
  let diff=((want-g.rotation.y+Math.PI)%(Math.PI*2))-Math.PI;if(diff<-Math.PI)diff+=Math.PI*2;
  g.rotation.y+=diff*Math.min(1,dt*rate);
}
function bossMoveToward(g,goal,dt,speed,accel=4.8){
  const v=new THREE.Vector3(goal.x-g.position.x,0,goal.z-g.position.z),d=v.length();
  if(!g.userData.motionVel)g.userData.motionVel=new THREE.Vector3();
  const vel=g.userData.motionVel;
  if(d>.08){
    v.normalize();
    const brake=Math.min(1,d/3.2);
    const desired=v.multiplyScalar(speed*brake);
    vel.lerp(desired,Math.min(1,dt*accel));
  }else{
    vel.multiplyScalar(Math.max(0,1-dt*7));
  }
  const beforeX=g.position.x,beforeZ=g.position.z;
  g.position.x+=vel.x*dt;g.position.z+=vel.z*dt;
  bossArenaClampVec(g.position);
  if(Math.abs(g.position.x-beforeX)<Math.abs(vel.x*dt)*.35)vel.x*=.25;
  if(Math.abs(g.position.z-beforeZ)<Math.abs(vel.z*dt)*.35)vel.z*=.25;
}
function taijiBossSeparationGoal(K,b,goal,min=7.2,push=4.4){
  if(!K||!b||!goal||typeof taijiBossList!=="function")return goal;
  taijiBossList(K).forEach(o=>{
    if(!o||o===b||o.dead||!o.g||!b.g)return;
    const dx=b.g.position.x-o.g.position.x,dz=b.g.position.z-o.g.position.z,d=Math.hypot(dx,dz);
    if(d>.01&&d<min){
      const f=(min-d)/min*push;
      goal.x+=(dx/d)*f;goal.z+=(dz/d)*f;
    }
  });
  return goal;
}
function updateBossMotion(K,b,t,now,dt){
  const g=b.g,pp=player.pos,phase=1-b.hp/Math.max(1,b.maxHp),p=b.movePhase||0,dist=Math.hypot(pp.x-g.position.x,pp.z-g.position.z);
  const bs=b.baseScale||g.scale,cue=Math.max(0,Math.min(1,((b._motionCueUntil||0)-now)/720));
  const toP=new THREE.Vector3(pp.x-g.position.x,0,pp.z-g.position.z);if(toP.lengthSq()<.01)toP.set(0,0,1);toP.normalize();
  const side=new THREE.Vector3(-toP.z,0,toP.x);
  if(K.season==="spring"){
    const strafe=Math.sin(t*.62+p)>0?1:-1,ideal=9.8-phase*2.4;
    const goal=new THREE.Vector3(pp.x-toP.x*ideal+side.x*strafe*(3.2+Math.sin(t*1.7+p)*1.3),0,pp.z-toP.z*ideal+side.z*strafe*(3.2+Math.sin(t*1.7+p)*1.3));
    if(dist<6.2){goal.x=g.position.x-toP.x*5.0;goal.z=g.position.z-toP.z*5.0;}
    const step=Math.max(0,Math.sin(t*7.1+p)),stepDrive=.36+step*.64;
    bossMoveToward(g,bossArenaClampVec(goal),dt,(2.05+phase*.58)*stepDrive,7.2);
    bossTurnToward(g,pp,dt,0,5.4);
    g.userData.kitsuneStepBoost=.18+step*.48;
    g.position.y=.006+step*.010;
    g.rotation.x=-cue*.035;g.rotation.z=Math.sin(t*2.4+p)*.014+cue*.018;
    g.scale.set(bs.x*(1+step*.012+cue*.026),bs.y*(1-step*.018-cue*.055),bs.z*(1+step*.008+cue*.018));
    if(g.userData.assetModel)g.userData.assetModel.rotation.x=Math.sin(t*5.2+p)*.006-cue*.035;
  }else if(K.season==="winter"){
    const ideal=11.5,orbit=Math.sin(t*.38+p);
    const goal=new THREE.Vector3(pp.x-toP.x*ideal+side.x*orbit*5.2,0,pp.z-toP.z*ideal+side.z*orbit*5.2);
    bossMoveToward(g,bossArenaClampVec(goal),dt,1.35+phase*.45,3.1);
    bossTurnToward(g,pp,dt,0,4.2);
    g.position.y=.34+Math.sin(t*1.55+p)*.28+cue*.16;
    g.rotation.z=Math.sin(t*.95+p)*.055+cue*.035;g.rotation.x=Math.sin(t*.72+p)*.018+cue*.045;
    g.scale.set(bs.x*(1+cue*.025),bs.y*(1+cue*.045),bs.z*(1+cue*.025));
  }else if(K.season==="summer"){
    if(b.role==="chochin"){
      // 提灯お化けは浮遊して距離を取りながら旋回(遠隔・撹乱役)
      const ideal=12.5,orbit=Math.sin(t*.5+p);
      const goal=new THREE.Vector3(pp.x-toP.x*ideal+side.x*orbit*5.6,0,pp.z-toP.z*ideal+side.z*orbit*5.6);
      taijiBossSeparationGoal(K,b,goal,7.8,5.2);
      bossMoveToward(g,bossArenaClampVec(goal),dt,1.65+phase*.55,3.5);
      bossTurnToward(g,pp,dt,0,4.0);
      g.position.y=1.05+Math.sin(t*1.6+p)*.42;g.rotation.z=Math.sin(t*1.2+p)*.09;
      g.rotation.x=cue*.05;g.scale.set(bs.x*(1+cue*.075),bs.y*(1-cue*.04),bs.z*(1+cue*.075));
    }else{
      // 河童の主は積極的に間合いを詰める(突進・接近役)
      const surge=Math.max(0,Math.sin(t*1.25+p)),ideal=surge>.72?4.6:9.0;
      const goal=new THREE.Vector3(pp.x-toP.x*ideal+side.x*Math.sin(t*.9+p)*3.2,0,pp.z-toP.z*ideal+side.z*Math.sin(t*.9+p)*3.2);
      taijiBossSeparationGoal(K,b,goal,7.8,5.2);
      bossMoveToward(g,bossArenaClampVec(goal),dt,2.05+surge*1.15+phase*.45,4.2);
      bossTurnToward(g,pp,dt,0,5.2);
      g.position.y=Math.max(.025,.08+Math.sin(t*2.2+p)*.11-cue*.035);g.rotation.x=-cue*.08;g.rotation.z=Math.sin(t*3.1+p)*.06;
      g.scale.set(bs.x*(1+cue*.045),bs.y*(1-cue*.07),bs.z*(1+cue*.035));
    }
  }else if(K.season==="autumn"&&b.phase2){
    const goal=new THREE.Vector3(pp.x-toP.x*4.7,0,pp.z-toP.z*4.7);
    bossMoveToward(g,bossArenaClampVec(goal),dt,1.9+phase*.8,3.9);
    bossTurnToward(g,pp,dt,0,5.0);
    const stomp=Math.max(0,Math.sin(t*2.9+p));g.position.y=stomp*.18+cue*.07;g.rotation.x=-stomp*.08-cue*.06;g.rotation.z=Math.sin(t*1.8+p)*.04;
    g.scale.set(bs.x*(1+cue*.055),bs.y*(1-cue*.045),bs.z*(1+cue*.04));
  }else{
    const goal=new THREE.Vector3(TAIJI_BOSS_ARENA.x+Math.sin(t*.55+p)*8,0,TAIJI_BOSS_ARENA.z+Math.cos(t*.42+p)*5);
    bossMoveToward(g,bossArenaClampVec(goal),dt,1.55+phase*.55,3.4);
    bossTurnToward(g,pp,dt,0,4.4);
    const pulse=(K.season==="autumn"?.03*Math.sin(t*4+p):0)+cue*.055;
    g.position.y=.24+Math.sin(t*2.4+p)*.22+cue*.04;g.rotation.x=-cue*.035;g.rotation.z=Math.sin(t*1.7+p)*.08+cue*.025;
    g.scale.set(bs.x*(1+pulse),bs.y*(1+pulse*.55),bs.z*(1+pulse));
  }
}
/* 波I: 桃霞/赤予兆の初回教示 — 各色とも最初の3回だけ意味をトーストで示す(以後は消音)。localStorageで永続 */
const TJ_OMEN_HINT_KEY="shinden3d-tjomen-v1";
let _tjOmenSeen=null;
function tjOmenHint(kind){
  if(!_tjOmenSeen){try{_tjOmenSeen=JSON.parse(localStorage.getItem(TJ_OMEN_HINT_KEY)||"{}");}catch(e){_tjOmenSeen={};}}
  if((_tjOmenSeen[kind]||0)>=3)return;
  _tjOmenSeen[kind]=(_tjOmenSeen[kind]||0)+1;
  try{localStorage.setItem(TJ_OMEN_HINT_KEY,JSON.stringify(_tjOmenSeen));}catch(e){}
  toast(kind==="gold"?"✦ 桃霞の閃き＝見切りの好機！ 閃きに合わせてガード(Shift/構え)を短く押せ":"✸ 赤の閃光＝ガード不能！ 回避(Space/フリック)でかわせ",3400);
}
/* 波G: ボス攻撃の光予兆。桃霞=ジャストガードで見切り好機、赤=回避専用 */
function tjf3Sign(b,kind,now){
  const el=$("tjf3Sign");if(!el||!b||!b.g)return;
  if(TAIJI_KITSUNE_LITE_RIG&&b.cfg&&b.cfg.attack==="dart"&&b.g.userData)b.g.userData.kitsuneOmenUntil=now+720;
  b._motionCueUntil=now+720;b._motionCueKind=kind;
  const pos=(typeof taijiBossAimPoint==="function"&&taijiBossAimPoint(b))||b.g.position;
  const p=pos.clone();p.project(camera);
  if(p.z<-1||p.z>1)return; // 画面外は出さない(音だけ鳴らすと混乱するので何もしない)
  el.textContent=kind==="gold"?"✦ 弾く":"✸ 避ける";
  el.className=(kind==="gold"?"tjf3-gold":"tjf3-red")+" tjf3-anim";
  el.style.left=((p.x*.5+.5)*100)+"%";el.style.top=((-p.y*.5+.5)*100)+"%";
  el.style.display="block";
  clearTimeout(window._tjf3SignT);
  window._tjf3SignT=setTimeout(()=>{el.style.display="none";el.className="";},REDUCED_MOTION?420:620);
  tjOmenHint(kind); // 波I: 初見期のみ意味を教示(表示された予兆に対してだけ出す)
  if(kind==="gold"){
    b._tjf3SignUntil=now+TAIJI_TUNING.goldSignWindowMs; // この間にパリィが成立すると「見切り」
    beep(1240,.07,"triangle",.09);
    const gb=$("tjGuardBtn");if(gb){gb.classList.add("tjf3-hint");setTimeout(()=>gb.classList.remove("tjf3-hint"),620);}
  }else{
    beep(200,.1,"sawtooth",.1);
  }
}
function bossAttack(K,b,now){
  const bp=b.g.position.clone();bp.y=2.0;const pp=player.pos.clone();const d=bp.distanceTo(pp),at=b.cfg.attack;
  /* 波H: 死に覚え化 — patは35%で1〜2歩スキップし固定循環を崩す。荒魂中は流れ弾が全難易度で+1 */
  const phase=1-b.hp/Math.max(1,b.maxHp),pat=(b.pattern=(b.pattern||0)+1+(Math.random()<TAIJI_TUNING.patSkipProb?1+Math.floor(Math.random()*2):0)),hard=(K.diff&&K.diff.burst||0)+(b._tjf2Rage?1:0);
  if(at==="dart"){
    if(pat%6===0){tjf3Sign(b,"gold",now);seBossCast("slash");taijiMsg("九尾が姿をかすませ、一直線に駆ける！",1200);bossStartDash(b,pp,now,{col:TAIJI_PARRY_PINK,fx:"spiritBand",width:1.25,dmg:13,tele:680+(Math.random()<TAIJI_TUNING.dashDelayProb?TAIJI_TUNING.dashDelayMs:0),dur:240,len:13});return;} /* 波H: 溜めが一定確率で延び、早回避を釣る */
    if(pat%5===1){tjf3Sign(b,"gold",now);seBossCast("fire");taijiMsg("九尾が狐火を放つ。火が追ってくる！",1300);
      const aim=pp.clone();aim.y=.78;const n=bossLiteCount(5+(phase>.45?2:0)+hard);for(let i=0;i<n;i++){const a=i*Math.PI*2/n;const from=bp.clone().add(new THREE.Vector3(Math.cos(a)*1.45,.58+Math.sin(i)*.05,Math.sin(a)*1.45));spawnBossProj(from,aim,TAIJI_PARRY_PINK,7,5.2,{shape:"fox",homing:.045,wobble:.35,pulse:.2,size:.24,lifetime:5600,height:.78,hit2d:true,hitR:1.25});}}
    else if(pat%5===2){tjf3Sign(b,"gold",now);seBossCast("fire");taijiMsg("九尾扇状弾。尻尾の間を抜けろ！",1200);
      bossFan(bp.clone(),pp,TAIJI_PARRY_PINK,6,9,phase>.55?1.00:1.32,10.8,{shape:"flame",size:.20,pulse:.12,height:.72,hit2d:true,hitR:1.18});}
    else if(pat%5===3){tjf3Sign(b,"red",now);seBossCast("thunder");taijiMsg("狐火陣が足元に浮かぶ！",1200);bossCircle(pp,2.4,0xff6f92,12,820,260,{fx:"sigil",slow:700});bossCircleRing(pp,phase>.5?4:3,4.2,1.35,0xffb15a,8,120,{fx:"flame",slow:500});}
    else if(pat%5===4){tjf3Sign(b,"red",now);seBossCast("fire");taijiMsg("九尾が十字の狐火を刻む！",1200);const dir=pp.clone().sub(bp).setY(0).normalize();const side=new THREE.Vector3(-dir.z,0,dir.x);bossLine(bp,pp.clone().add(dir.clone().multiplyScalar(5)),.95,0xff8048,10,760,360,{fx:"spiritBand"});bossLine(pp.clone().add(side.clone().multiplyScalar(-5)),pp.clone().add(side.clone().multiplyScalar(5)),.78,0xffc06a,8,980,320,{fx:"spiritBand"});}
    else{tjf3Sign(b,"gold",now);seBossCast("fire");taijiMsg("薄紅の狐弾が低く追いすがる！",1200);const aim=pp.clone();aim.y=.78;for(let i=0,n=bossLiteCount(3+hard);i<n;i++){const off=new THREE.Vector3((Math.random()-.5)*4,.70+i*.03,(Math.random()-.5)*4);spawnBossProj(bp.clone().add(off),aim,TAIJI_PARRY_PINK,7,6.8,{shape:"fox",homing:.055,wobble:.28,size:.22,lifetime:5800,height:.78,hit2d:true,hitR:1.25});}}
  }else if(at==="blizzard"){
    if(d<5.4&&pat%3===0){tjf3Sign(b,"red",now);seBossCast("ice");taijiMsg("雪女王の足元から氷のトゲが走る！",1200);bossCircleRing(b.g.position,6,2.7,1.15,0xdff8ff,10,80,{fx:"pillar",slow:1200});const kb=pp.clone().sub(b.g.position).setY(0);if(kb.lengthSq()>0.01){kb.normalize();player.pos.x+=kb.x*2.2;player.pos.z+=kb.z*2.2;}return;}
    if(pat%5===1){tjf3Sign(b,"red",now);seBossCast("ice");taijiMsg("氷柱が落ちる。影から離れろ！",1300);const n=bossLiteCount(4+(phase>.45?2:0)+hard);for(let i=0;i<n;i++)bossCircle(pp.clone().add(new THREE.Vector3((Math.random()-.5)*8,0,(Math.random()-.5)*8)),1.35,0xbfeeff,8,720+i*90,220,{fx:"pillar",slow:1100});}
    else if(pat%5===2){tjf3Sign(b,"red",now);seBossCast("ice");taijiMsg("雪女王の氷霧。踏み込むと凍える！",1300);bossCircle(pp,3.1,0x9edcff,3,260,2600,{fx:"mist",kind:"mist",tick:560,slow:1200,opacity:.34});}
    else if(pat%5===3){tjf3Sign(b,"red",now);seBossCast("ice");taijiMsg("凍てつく吐息が一直線に走る！",1100);bossLine(bp.clone().add(new THREE.Vector3(0,.2,0)),pp.clone().add(pp.clone().sub(bp).setY(0).normalize().multiplyScalar(5)),1.25,0xdff8ff,11,520,360,{fx:"iceBeam",slow:1700});}
    else if(pat%5===4){tjf3Sign(b,"gold",now);seBossCast("ice");taijiMsg("桃霞の氷刃が低く走る！",1200);bossFan(bp.clone(),pp,TAIJI_PARRY_PINK,7,7,1.05,9.2,{shape:"ice",size:.18,slow:900,height:.72,hit2d:true,hitR:1.18});}
    else{tjf3Sign(b,"red",now);seBossCast("ice");taijiMsg("凍結の輪が広がる！",1200);bossWave(b.g.position,0xbfeeff,10,9+(phase>.55?3:0),900);}
  }else if(at==="kappa"){
    // 河童の主: 水流・引き寄せ・水弾(接近戦)
    if((K.storyKappa||taijiBossList(K).length<2)&&phase>.42&&pat%5===0){bossStartDefense(b,now);return;}
    if(pat%4===1){tjf3Sign(b,"red",now);seBossCast("blunt");taijiMsg("河童の水流が足を取る！",1200);bossCircle(pp,3.0,0x37c884,3,220,2200,{fx:"pool",kind:"pool",tick:520,pull:.45,slow:850,opacity:.32});if(d<15){const dir=bp.clone().sub(pp).setY(0).normalize();player.pos.x+=dir.x*1.5;player.pos.z+=dir.z*1.5;}}
    else if(pat%4===2){tjf3Sign(b,"gold",now);seBossCast("blunt");taijiMsg("河童が桃霞の水弾を連射！",1100);for(let i=0,n=bossLiteCount(2+(phase>.5?1:0)+hard);i<n;i++){const aim=pp.clone();aim.y=.76;spawnBossProj(bp.clone().add(new THREE.Vector3((Math.random()-.5)*1.2,.45,(Math.random()-.5)*1.2)),aim,TAIJI_PARRY_PINK,7,9.6,{shape:"water",slow:700,size:.25,height:.76,hit2d:true,hitR:1.22});}}
    else if(pat%4===3){tjf3Sign(b,"red",now);seBossCast("blunt");taijiMsg("河童が泥水を噴き上げる！",1200);bossCircleRing(pp,4,3.4,1.25,0x52d89a,7,110,{fx:"geyser",slow:900});}
    else{tjf3Sign(b,"gold",now);seBossCast("blunt");taijiMsg("河童が低く構えて突進する！",1100);bossStartDash(b,pp,now,{col:TAIJI_PARRY_PINK,fx:"waterCut",width:1.45,dmg:14,slow:1000,tele:760+(Math.random()<TAIJI_TUNING.dashDelayProb?TAIJI_TUNING.dashDelayMs:0),dur:320,len:11});return;} /* 波H: 溜めディレイで釣る */
  }else if(at==="chochin"){
    // 提灯お化け: 長い舌の薙ぎ払い・怪火の追尾弾(遠隔)
    if(taijiBossList(K).length<2&&pat%5===0){bossStartBlind(K,b,now);return;}
    if(pat%4===1){tjf3Sign(b,"red",now);seBossCast("fire");taijiMsg("提灯の長い舌が薙ぎ払う！",1200);bossLine(bp.clone().add(new THREE.Vector3(0,.2,0)),pp,1.1,0xff553d,9,360,320,{fx:"tongue"});}
    else if(pat%4===2){tjf3Sign(b,"gold",now);seBossCast("fire");taijiMsg("提灯お化けの桃霞火が追ってくる！",1100);for(let i=0,n=bossLiteCount(1+(phase>.5?1:0)+hard);i<n;i++){const aim=pp.clone();aim.y=.78;spawnBossProj(bp.clone().add(new THREE.Vector3((Math.random()-.5)*1.2,.58,(Math.random()-.5)*1.2)),aim,TAIJI_PARRY_PINK,7,7.2,{shape:"flame",homing:.045,wobble:.55,size:.24,lifetime:5200,height:.78,hit2d:true,hitR:1.22});}}
    else if(pat%4===3){tjf3Sign(b,"red",now);seBossCast("fire");taijiMsg("提灯が怪火をばら撒く！",1100);bossCircleRing(pp,3+(phase>.5?1:0),3.8,1.15,0xff7a33,7,100,{fx:"flame"});}
    else{tjf3Sign(b,"red",now);seBossCast("fire");taijiMsg("提灯の舌が横一文字に伸びる！",1100);const dir=pp.clone().sub(bp).setY(0).normalize();const side=new THREE.Vector3(-dir.z,0,dir.x);bossLine(pp.clone().add(side.clone().multiplyScalar(-5)),pp.clone().add(side.clone().multiplyScalar(5)),.86,0xff553d,10,820,340,{fx:"tongue"});}
  }else if(at==="duo"){
    if(pat%4===1){tjf3Sign(b,"red",now);seBossCast("blunt");taijiMsg("河童の水流が足を取る！",1200);bossCircle(pp,3.0,0x37c884,3,220,2200,{fx:"pool",kind:"pool",tick:520,pull:.45,slow:850,opacity:.32});if(d<15){const dir=bp.clone().sub(pp).setY(0).normalize();player.pos.x+=dir.x*1.5;player.pos.z+=dir.z*1.5;}}
    else if(pat%4===2){tjf3Sign(b,"gold",now);seBossCast("fire");taijiMsg("提灯の舌と桃霞火が同時に伸びる！",1200);bossLine(bp.clone().add(new THREE.Vector3(1.0,.2,0)),pp,1.05,TAIJI_PARRY_PINK,10,360,300,{fx:"tongue"});const aim=pp.clone();aim.y=.78;spawnBossProj(bp.clone().add(new THREE.Vector3(-1,.55,0)),aim,TAIJI_PARRY_PINK,7,7.2,{shape:"flame",homing:.035,wobble:.5,size:.24,lifetime:5200,height:.78,hit2d:true,hitR:1.22});}
    else if(pat%4===3){tjf3Sign(b,"gold",now);seBossCast("fire");taijiMsg("桃霞の水弾と怪火が挟み撃ち！",1200);const aim=pp.clone();aim.y=.78;spawnBossProj(bp.clone().add(new THREE.Vector3(-1,.45,0)),aim,TAIJI_PARRY_PINK,7,9.5,{shape:"water",slow:900,size:.25,height:.78,hit2d:true,hitR:1.22});spawnBossProj(bp.clone().add(new THREE.Vector3(1.1,.58,0)),aim.clone().add(new THREE.Vector3((Math.random()-.5)*3,0,(Math.random()-.5)*3)),TAIJI_PARRY_PINK,7,11.5,{shape:"flame",homing:.025,size:.22,height:.78,hit2d:true,hitR:1.18});}
    else{tjf3Sign(b,"red",now);seBossCast("fire");taijiMsg("水場に怪火が灯る。足元を見ろ！",1200);bossCircle(pp,2.8,0x37c884,3,760,1800,{fx:"pool",kind:"pool",tick:560,pull:.25,slow:700,opacity:.32});bossCircleRing(pp,3,4.0,1.15,0xff7a33,7,140,{fx:"flame"});}
  }else if(at==="souls"){
    seBossCast("thunder");if(pat%4===1){tjf3Sign(b,"gold",now);taijiMsg("桃霞の人魂が波打って襲いかかる！",1100);for(let i=0,n=bossLiteCount(4+hard);i<n;i++){const aim=pp.clone();aim.y=.82;const off=new THREE.Vector3((i-1.5)*.8,.62+Math.random()*.32,(Math.random()-.5)*1.2);spawnBossProj(bp.clone().add(off),aim,TAIJI_PARRY_PINK,7,7.8,{shape:"soul",homing:.025,wobble:.65,pulse:.2,lifetime:5200,height:.82,hit2d:true,hitR:1.24});}}
    else if(pat%4===2){tjf3Sign(b,"red",now);taijiMsg("怨念の火種が地面から噴き上がる！",1200);for(let i=0,n=bossLiteCount(3+(phase>.45?2:0));i<n;i++)bossCircle(pp.clone().add(new THREE.Vector3((Math.random()-.5)*7,0,(Math.random()-.5)*7)),1.5,0xaa66ff,8,760+i*120,260,{fx:"pillar",slow:800});}
    else if(pat%4===3){tjf3Sign(b,"red",now);taijiMsg("人魂が輪になって迫る！",1200);bossCircleRing(pp,5,4.4,1.25,0xbb88ff,8,100,{fx:"sigil",slow:700});}
    else{tjf3Sign(b,"red",now);taijiMsg("怨念の帯が横切る！",1100);bossLine(bp.clone().add(new THREE.Vector3(-3,.2,0)),pp.clone().add(new THREE.Vector3(3,0,0)),1.15,0xaa66ff,10,840,360,{fx:"spiritBand",slow:1000});}
  }else if(at==="oni"){
    if(pat%4===1){tjf3Sign(b,"red",now);seBossCast("blunt");taijiMsg("大鬼が地を踏み割る！ 衝撃波を避けろ",1200);bossWave(b.g.position,0xff6a33,13,12+(phase>.5?4:0));}
    else if(pat%4===2){tjf3Sign(b,"red",now);seBossCast("slash");taijiMsg("金棒の叩きつけ！ 正面から外れろ",1100);bossLine(bp,pp.clone().add(pp.clone().sub(bp).setY(0).normalize().multiplyScalar(4)),1.75,0xff3d2e,14,500,340,{fx:"smash"});}
    else if(pat%4===3){tjf3Sign(b,"gold",now);seBossCast("blunt");taijiMsg("大鬼が桃霞の岩を投げつける！",1000);for(let i=0,n=bossLiteCount(2+(phase>.4?1:0));i<n;i++){const aim=pp.clone().add(new THREE.Vector3((Math.random()-.5)*2,0,(Math.random()-.5)*2));aim.y=.86;spawnBossProj(bp.clone().add(new THREE.Vector3((Math.random()-.5)*1.2,.72,(Math.random()-.5)*1.2)),aim,TAIJI_PARRY_PINK,10,8.8,{shape:"rock",size:.34,height:.86,hit2d:true,hitR:1.32});}}
    else{tjf3Sign(b,"red",now);seBossCast("slash");taijiMsg("大鬼の二連叩きつけ！",1200);const f=pp.clone().sub(bp).setY(0).normalize();const side=new THREE.Vector3(-f.z,0,f.x);bossLine(bp.clone().add(side.clone().multiplyScalar(-1.2)),pp.clone().add(f.clone().multiplyScalar(3)),1.35,0xff6a33,11,760,320,{fx:"smash"});bossLine(bp.clone().add(side.clone().multiplyScalar(1.2)),pp.clone().add(f.clone().multiplyScalar(4)),1.35,0xff3d2e,12,1080,320,{fx:"smash"});}
  }else{ tjf3Sign(b,"gold",now); seBossCast("fire"); const aim=pp.clone();aim.y=.8;spawnBossProj(bp,aim,TAIJI_PARRY_PINK,9,13,{height:.8,hit2d:true,hitR:1.22}); }
  for(let i=0;i<hard;i++){const off=new THREE.Vector3((Math.random()-.5)*5,Math.random()*1.5,(Math.random()-.5)*5);spawnBossProj(bp.clone().add(off),pp,b.cfg.col,6,8+Math.random()*4,{shape:at==="blizzard"?"ice":at==="oni"?"rock":at==="kappa"?"water":at==="souls"?"soul":"flame",homing:.015,size:.18});}
  /* 波H: 連携チェーン — 一定確率(荒魂中は増)で間髪入れず次撃が来る。連鎖は1回まで。荒魂中は通常間隔も短縮 */
  if(!b._tjhChain&&Math.random()<(b._tjf2Rage?TAIJI_TUNING.chainProbRage:TAIJI_TUNING.chainProb)){b._tjhChain=true;b.nextAtk=now+TAIJI_TUNING.chainDelayMs+Math.random()*TAIJI_TUNING.chainDelayRangeMs;}
  else{b._tjhChain=false;if(b._tjf2Rage)b.nextAtk=now+Math.round((at==="souls"?TAIJI_TUNING.atkIntervalSoulsMs:TAIJI_TUNING.atkIntervalMs)*TAIJI_TUNING.rageIntervalMul);}
}
function updateBoss(K,t,now,dt){
  const list=taijiBossList(K);if(!list.length)return;
  if(typeof SFX!=="undefined"&&now>(K._bossBgmCheck||0)){K._bossBgmCheck=now+3500;if(!SFX._bossMedia||SFX._bossMedia.paused)SFX.playBossBgm(K.season);}
  /* 波Q: 河童戦は太刀限定だが、右近がときどき弓で援護し河童に小ダメージ＋ひるみを与える */
  if(K.swordOnly&&now>(K.ukonNext||0)){
    K.ukonNext=now+5000+Math.random()*3500;
    const tb=list.find(b=>!b.dead);
    if(tb){const aim=(typeof taijiBossAimPoint==="function"&&taijiBossAimPoint(tb))||tb.g.position.clone();
      const from=aim.clone().add(new THREE.Vector3(-8,2.2,7)); // 庭先の右近の位置あたりから
      if(typeof spawnArrow==="function")spawnArrow(from,aim.clone(),()=>{if(!tb.dead){damageBoss(tb,6,"ukon");taijiMsg("右近の援護の矢！",900);if(typeof seArrowHit==="function")seArrowHit();}});
      else{damageBoss(tb,6,"ukon");taijiMsg("右近の援護の矢！",900);}
    }
  }
  const blind=$("taijiBlind");if(blind)blind.style.opacity=(K.blindUntil&&now<K.blindUntil)?0.82:0;
  for(const b of list){
    if(b.dead)continue;
    if(b.g.userData.core&&b.g.userData.core.material)b.g.userData.core.material.opacity=0.78+Math.sin(t*3)*0.16;
    if(b.g.userData.aura)b.g.userData.aura.scale.setScalar(1+Math.sin(t*2)*0.07);
    taijiUpdateBossPresence(b.g,t);
    if(b.hp>0&&now<(b.staggerUntil||0)){
      const bs=b.baseScale||b.g.scale;b.state=null;b.g.rotation.z=Math.sin(t*18)*.035;b.g.scale.set(bs.x,bs.y*(0.94+Math.sin(t*14)*.02),bs.z);
      continue;
    }else if(b.staggerUntil&&now>=b.staggerUntil){const bs=b.baseScale||new THREE.Vector3(1,1,1);b.staggerUntil=0;b.g.rotation.z=0;b.g.scale.copy(bs);}
    const busy=bossUpdateAction(K,b,now,dt);
    if(!busy)updateBossMotion(K,b,t,now,dt);
    if(K.season==="autumn"&&!b.phase2&&b.hp<=0){autumnBossPhase2(b);continue;}
    if(!busy&&now>b.nextAtk&&!K.done&&b.hp>0){
      const duet=K.season==="summer"&&!K.storyKappa&&list.filter(x=>!x.dead).length>1;
      if(duet){
        if(!K.summerTurn)K.summerTurn="kappa";
      }
      if(!duet||(now>=(K.summerReadyAt||0)&&b.role===K.summerTurn)){
        b.nextAtk=now+(b.cfg.attack==="souls"?TAIJI_TUNING.atkIntervalSoulsMs:TAIJI_TUNING.atkIntervalMs)*(K.diff&&K.diff.bossRate||1);
        bossAttack(K,b,now);
        if(duet){
          K.summerTurn=b.role==="kappa"?"chochin":"kappa";
          const openingFrom=b.state==="dash"?b.stateUntil:now+420;
          K.summerReadyAt=Math.max(now+2000,openingFrom+900);
          b._summerOpeningFrom=openingFrom;b._summerOpeningUntil=K.summerReadyAt;
          if(b.state!=="dash")taijiWorldFloat(taijiBossAimPoint(b)||b.g.position,"攻めの隙","good");
        }
      }
    }
    if(b.hp<=0){
      b.dead=true;scene.remove(b.g);if(b.wrapId&&$(b.wrapId))$(b.wrapId).style.display="none";
      juiceShake(); // 波B: ボス撃破の衝撃
      if(typeof hitStop==="function")hitStop(90); // 波AF: 退治モードの決定打(ボス撃破)に一瞬の間を作る
      if(K.lockTarget===b)K.lockTarget=null;
      if(list.length>1&&list.some(x=>!x.dead)){taijiMsg(b.cfg.name+"を退けた！",1700);if(typeof seArrowHit!=="undefined")seArrowHit();}
    }
  }
  // 全ボス撃破で決着(夏は河童＋提灯の両方を倒す)
  if(list.every(b=>b.dead)&&!K._bossCleared){
    K._bossCleared=true;
    taijiRecordBossCodex(K);
    const lastName=(K.season==="summer"&&!K.storyKappa)?"河童の主と提灯お化け":list[0].cfg.name;
    taijiClearBossGate(K);clearBossBattleFx();
    if(typeof SFX!=="undefined"){SFX.stopBossBgm();SFX.playSe("heal",.5);}
    if(K.bossRush&&K.rushIndex<K.rushQueue.length-1){
      // ボスラッシュ: 次の季節の主へ。残弾を消し、体力を少し回復して連戦
      K.rushCleared=(K.rushCleared||0)+1;K.rushIndex++;K.boss=null;K.bosses=null;
      K.hp=Math.min(K.maxHp,K.hp+20);updateTaijiHp();
      tjfxFelled("一体、祓ヒタリ"); // 波E: 祓討の金文字(ラッシュ中間)
      taijiMsg(lastName+"を討ち取った！ 次なる怪異が迫る…("+K.rushCleared+"/"+K.rushQueue.length+")",2400);
      setTimeout(()=>{if(APP.mode==="taiji"&&APP.taiji===K&&!K.done){K.season=K.rushQueue[K.rushIndex];K.bossSpawned=false;K._bossCleared=false;taijiPrepareBossGate(K,true);}},2100);
    }else{
      K.done=true;if(K.bossRush)K.rushCleared=(K.rushCleared||0)+1;
      tjfxFelled(APP.storyTaiji?"物ノ怪ヲ祓ヒタリ":(K.bossRush?"四季ノ主、悉ク祓ヒタリ":"物ノ怪ヲ祓ヒタリ")); // 波P: ストーリー戦は単独討伐の文言
      taijiMsg(lastName+"を討ち取った！",2200);setTimeout(()=>{if(APP.mode==="taiji"&&APP.taiji===K)endTaiji(false);},2000);
    }
  }
  updateBossHazards(K,now,dt);
  for(let i=bossProjs.length-1;i>=0;i--){const p=bossProjs[i];
    if(p.reflected){
      const tb=(p.target&&!p.target.dead)?p.target:((K.lockOn&&K.lockTarget&&!K.lockTarget.dead)?K.lockTarget:taijiNearestBossTarget(K));
      const aim=taijiBossAimPoint(tb);
      if(aim&&p.homing){const want=aim.clone().sub(p.m.position);if(want.lengthSq()>0.01){want.normalize();p.dir.lerp(want,p.homing).normalize();}}
      if(aim&&p.m.position.distanceTo(aim)<1.65){
        if(tb&&!tb.dead){damageBoss(tb,p.dmg||12,"reflect");tb.nextAtk=Math.max(tb.nextAtk||0,now+900);taijiMsg("弾き返し！",620);}
        taijiDisposeFx(p.m);bossProjs.splice(i,1);continue;
      }
    }else if(p.homing){const want=new THREE.Vector3(player.pos.x,player.pos.y,player.pos.z).sub(p.m.position);if(want.lengthSq()>0.01){want.normalize();p.dir.lerp(want,p.homing).normalize();}}
    if(p.m.userData&&p.m.userData.alignY)p.m.quaternion.setFromUnitVectors(BOSS_PROJ_UP,p.dir.clone());
    p.m.position.addScaledVector(p.dir,p.spd*dt);
    if(p.wobble){p.m.position.x+=Math.sin((now-p.born)*.006+p.phase)*p.wobble*dt;p.m.position.z+=Math.cos((now-p.born)*.005+p.phase)*p.wobble*dt;}
    if(p.pulse)p.m.scale.setScalar(1+Math.sin((now-p.born)*.012+p.phase)*p.pulse);
    const dd=p.hit2d?Math.hypot(p.m.position.x-player.pos.x,p.m.position.z-player.pos.z):p.m.position.distanceTo(new THREE.Vector3(player.pos.x,player.pos.y,player.pos.z));
    if(!p.reflected&&dd<(p.hitR||1.7)){
      if(p.parryable&&K.guarding&&now<(K.parryUntil||0)){taijiParry(p);K.parryUntil=0;continue;}
      if(p.slow)K.slowUntil=now+p.slow;taijiDamage(p.dmg,p);taijiDisposeFx(p.m);bossProjs.splice(i,1);continue;
    }
    if(now-p.born>p.lifetime){taijiDisposeFx(p.m);bossProjs.splice(i,1);}}
}
