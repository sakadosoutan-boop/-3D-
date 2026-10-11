/* Selected improvements 1/2/8/113/114. Loaded after the core mode implementations. */
var SELECTED_UX;
SELECTED_UX=(()=>{
  const $id=id=>document.getElementById(id),KEY='shinden3d-selected-ux-v1';
  const entries=[['btnStory','御簾の向こうへ'],['btnWalk','散策'],['btnQuiz','名称当て'],['btnQuizTA','タイムアタック'],['btnQuizTeacher','力だめし小テスト'],['btnUtakai','歌合'],['btnTaiji','物の怪退治'],['btnQuestEntry','貴族の一日'],['btnSaigen','古文の再現'],['btnKaimami','垣間見'],['btnIkaiSuika','位階出世'],['btnKaiawase','貝合わせ'],['btnKemari','蹴鞠'],['kohAwaseEntry','香合わせ'],['btnRenaiShort','恋文'],['btnRenaiSim','恋の母屋'],['btnCodex','図鑑']].filter(([id])=>$id(id)||id==='btnStory');
  const ids=new Set(entries.map(([id])=>id)),labels=Object.fromEntries(entries);
  let prefs={favorites:[],positions:{},guardToggle:false,runToggle:false},running=false;
  try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');prefs.favorites=Array.isArray(v.favorites)?v.favorites.filter(id=>ids.has(id)).slice(0,4):[];prefs.guardToggle=v.guardToggle===true;prefs.runToggle=v.runToggle===true;
    if(v.positions&&typeof v.positions==='object')for(const [id,p] of Object.entries(v.positions))if(Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=1))prefs.positions[id]=p;
  }catch(_){}
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch(_){toast('設定を保存できませんでした。この画面では引き続き使えます',3000);}}
  const controls=[['joy','移動',118],['interactBtn','調べる',76],['tjFire','攻撃',86],['tjGuardBtn','ガード',64],['tjDodgeBtn','回避',64],['tjLockBtn','ロック',64]];
  const home=document.createElement('section');home.id='homeNext';home.setAttribute('aria-label','次の遊びとお気に入り');
  home.innerHTML='<div class="home-next-copy"><span>次のひとつ</span><b id="homeNextTitle"></b><p id="homeNextReason"></p></div><button id="homeNextStart" class="t-btn"></button><div id="homeFavorites"></div><button id="homeFavoriteEdit" class="tb-btn">☆ お気に入りを選ぶ</button><div id="homeFavoriteChoices" hidden></div>';
  $id('mainModes').before(home);
  function due(){return window.LEARNING_EXTENSION?.dueIds?.()||[];}
  function refresh(){
    home.hidden=APP.mode!=='title';
    const count=due().length,found=typeof codexUnlocked!=='undefined'?codexUnlocked.size:0;
    const first=typeof EMAKI_FRAGMENT_IDS!=='undefined'&&EMAKI_FRAGMENT_IDS.filter(id=>codexUnlocked.has(id)).length;
    let title,reason,label,action;
    if(APP.map==='kamakura'){title='館を比べて歩く';reason='主殿前で配置を観察し、寝殿造りとの違いを記録しましょう。';label='比較の散策を始める';action=()=>{$id('btnWalk').click();window.SELECTED_WORLD?.open('compare');};}
    else if(count){title=`覚え直すころの札が ${count} 枚`;reason='前に取り組んだ札を短く確かめましょう。';label='復習する';action=()=>window.LEARNING_EXTENSION.startReview();}
    else if(found<3){title='邸内で三つの発見';reason='まず建物や調度を調べて、図鑑を開いてみましょう。';label='散策を始める';action=()=>$id('btnWalk').click();}
    else if(first<6){title=`絵巻を一続きに（${first}/6）`;reason='邸内の断片を集め、西の対の継ぎ台へ。';label='絵巻の続きを探す';action=()=>typeof startFirstRoute==='function'?startFirstRoute():$id('btnWalk').click();}
    else{title='覚えたものを違う角度から';reason='置かれた場所に頼らず、形を見て見分けてみましょう。';label='見分ける練習';action=()=>window.LEARNING_EXTENSION?window.LEARNING_EXTENSION.startIdentification():$id('btnQuiz').click();}
    $id('homeNextTitle').textContent=title;$id('homeNextReason').textContent=reason;$id('homeNextStart').textContent=label;$id('homeNextStart').onclick=action;
    const favorites=$id('homeFavorites');favorites.replaceChildren();
    for(const id of prefs.favorites){const b=document.createElement('button');b.className='tb-btn';b.textContent='★ '+labels[id];b.disabled=APP.map==='kamakura'&&!['btnWalk','btnQuiz','btnQuizTA','btnCodex'].includes(id);if(b.disabled)b.title='平安へ戻ると使えます';b.onclick=()=>$id(id).click();favorites.append(b);}
    $id('homeFavoriteChoices').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(prefs.favorites.includes(b.dataset.target))));
  }
  const choices=$id('homeFavoriteChoices');
  for(const [id,label]of entries){const b=document.createElement('button');b.className='tb-btn';b.dataset.target=id;b.textContent=label;b.onclick=()=>{const i=prefs.favorites.indexOf(id);if(i>=0)prefs.favorites.splice(i,1);else if(prefs.favorites.length<4)prefs.favorites.push(id);else{toast('お気に入りは四つまで。選択済みのものを外してください',2400);return;}persist();refresh();};choices.append(b);}
  $id('homeFavoriteEdit').onclick=()=>{choices.hidden=!choices.hidden;$id('homeFavoriteEdit').setAttribute('aria-expanded',String(!choices.hidden));};
  function clearMovement(){running=false;resetInputState();if(typeof taijiSetGuard==='function')taijiSetGuard(false);$id('runToggleButton')?.setAttribute('aria-pressed','false');}
  function returnHome(){
    if(window.CODEX_VIEWER?.active)CODEX_VIEWER.close();
    if(typeof setPhotoMode==='function'&&document.body.classList.contains('photo-mode'))setPhotoMode(false);
    if(APP.mode==='renaiSim'&&APP.renai&&typeof renaiSimSave==='function')renaiSimSave();
    if(APP.taiji&&typeof taijiQuit==='function')taijiQuit();
    if(APP.kaimami){kaimamiRestoreActors(APP.kaimami);APP.kaimami=null;}
    if(APP.story&&typeof stExitToTitle==='function')stExitToTitle();
    closePauseMenu();closeResultPanel();clearMovement();
    enterMode('title');APP.utakai=null;APP.storyQuiz=null;APP.storyTaiji=null;APP.storyUtakai=null;
    modeTasks.length=0;hideModeBrief(true);clearTimeout(_loadTimer);
    document.body.classList.remove('paused','photo-mode');
    $id('title').classList.remove('hide');home.hidden=false;choices.hidden=true;
    for(const id of ['topbar','worldStatusBar','crosshair','joy','interactBtn','minimapWrap','gfx','help','credits','result','quizDiffPicker','questRolePicker','saigenHud','renaiHud','bossBar','bossBar2']){const e=$id(id);if(e)e.style.display='none';}
    for(const id of ['loadingScreen','pauseMenu','historyPanel','careerPanel','koyomiPanel','onboardPanel'])$id(id)?.classList.remove('show','open');
    if(APP.map==='kamakura')player.pos.set(0,groundH(0,46)+1.62,46);else player.pos.copy(START_POS);player.yaw=0;player.pitch=-.02;APP.view='fp';
    if(typeof statsFlush==='function')statsFlush();
    if(typeof updateCodexProgress==='function')updateCodexProgress();
    if(typeof careerUpdateBadge==='function')careerUpdateBadge();
    if(typeof SFX!=='undefined'){SFX.setBackgroundPaused(false);SFX.stopBossBgm();SFX.playTheme();}
    refresh();$id('homeNextStart').focus({preventScroll:true});
  }
  window.returnToTitle=returnHome;
  const enter=enterMode;
  enterMode=function(m){clearMovement();home.hidden=m!=='title';const result=enter(m);window.SELECTED_WORLD?.update(0);if(m==='title')refresh();applyPositions();return result;};
  const activeKey=keyActive;keyActive=function(action){return action==='run'&&prefs.runToggle&&['walk','quiz','quest','kaimami'].includes(APP.mode)?running:activeKey(action);};
  const settings=document.createElement('section');settings.className='selected-settings';settings.innerHTML='<h4>手に合わせた操作</h4><button id="editTouchLayout" class="tb-btn">タッチボタンの位置を調整</button><button id="resetTouchLayout" class="tb-btn">位置を戻す</button><label><input id="toggleGuardPreference" type="checkbox"> ガードを押すたびに切り替える</label><label><input id="toggleRunPreference" type="checkbox"> 早歩きを押すたびに切り替える</label><p>切り替え式でも、中断・画面切替・タブを離れると解除します。</p>';
  $id('gfxClose').before(settings);
  const run=document.createElement('button');run.id='runToggleButton';run.className='tb-btn';run.textContent='早歩き';run.setAttribute('aria-pressed','false');document.body.append(run);
  function sync(){for(const [id,key]of [['toggleGuardPreference','guardToggle'],['toggleRunPreference','runToggle']])$id(id).checked=prefs[key];document.body.classList.toggle('run-toggle-enabled',prefs.runToggle);run.hidden=!prefs.runToggle||!['walk','quiz','quest','kaimami'].includes(APP.mode);}
  for(const [id,key]of [['toggleGuardPreference','guardToggle'],['toggleRunPreference','runToggle']])$id(id).onchange=e=>{prefs[key]=e.target.checked;clearMovement();persist();sync();};
  function flipRun(){if(gameplayInputBlocked()||APP.mode==='taiji')return;running=!running;run.setAttribute('aria-pressed',String(running));}
  run.onclick=flipRun;
  addEventListener('keydown',e=>{if(!prefs.runToggle||APP.mode==='taiji'||e.repeat||gameplayInputBlocked())return;if(KEYBIND.run.includes(e.key.toLowerCase())){flipRun();e.preventDefault();}},true);
  const guard=$id('tjGuardBtn');
  function flipGuard(e){if(!prefs.guardToggle||APP.mode!=='taiji'||gameplayInputBlocked())return;e.preventDefault();e.stopImmediatePropagation();taijiSetGuard(!APP.taiji?.guarding);}
  guard?.addEventListener('touchstart',flipGuard,{capture:true,passive:false});guard?.addEventListener('mousedown',flipGuard,{capture:true});
  for(const type of ['touchend','mouseup','mouseleave'])guard?.addEventListener(type,e=>{if(prefs.guardToggle){e.preventDefault();e.stopImmediatePropagation();}},{capture:true,passive:false});
  guard?.addEventListener('touchcancel',()=>taijiSetGuard(false),{passive:true});
  addEventListener('keydown',e=>{if(prefs.guardToggle&&APP.mode==='taiji'&&TAIJI_CONTROLS_PC.guard.has(e.key.toLowerCase())&&!gameplayInputBlocked()){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)taijiSetGuard(!APP.taiji?.guarding);}},true);
  addEventListener('keyup',e=>{if(prefs.guardToggle&&APP.mode==='taiji'&&TAIJI_CONTROLS_PC.guard.has(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();}},true);
  addEventListener('blur',clearMovement);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearMovement();});
  const originalReset=resetInputState;resetInputState=function(){running=false;run.setAttribute('aria-pressed','false');return originalReset();};
  function positionStyle(el,p,size){const x=Math.max(size/2+8,Math.min(innerWidth-size/2-8,p[0]*innerWidth)),y=Math.max(84+size/2,Math.min(innerHeight-size/2-12,p[1]*innerHeight));el.style.setProperty('position','fixed','important');el.style.setProperty('left',(x-size/2)+'px','important');el.style.setProperty('top',(y-size/2)+'px','important');el.style.setProperty('right','auto','important');el.style.setProperty('bottom','auto','important');}
  function applyPositions(){for(const[id,,size]of controls){const el=$id(id);if(!el)continue;const p=prefs.positions[id];if(p&&!(id==='joy'&&joy.dynamic))positionStyle(el,p,id==='joy'?el.offsetWidth||size:size);}sync();}
  const editor=document.createElement('section');editor.id='touchLayoutEditor';editor.hidden=true;editor.setAttribute('role','dialog');editor.setAttribute('aria-modal','true');editor.setAttribute('aria-label','タッチ位置の調整');editor.innerHTML='<header><p>丸い札を動かして配置。選択した札は矢印キーでも動かせます。</p><button id="touchLayoutSave">保存</button><button id="touchLayoutCancel">取り消す</button></header><div id="touchLayoutPreview"></div>';document.body.append(editor);
  const baseBlocking=pauseBlockingOverlayOpen;pauseBlockingOverlayOpen=function(){const measurement=document.getElementById('deviceMeasurement');return !editor.hidden||(measurement&&!measurement.hidden)||baseBlocking();};
  let draft={},held=null,previousFocus=null;
  function paint(){for(const[id,label,size]of controls){let el=$id('layout-'+id);if(!el){el=document.createElement('button');el.id='layout-'+id;el.className='layout-handle';el.textContent=label;el.dataset.control=id;el.style.width=el.style.height=size+'px';$id('touchLayoutPreview').append(el);el.onpointerdown=e=>{held=id;el.setPointerCapture(e.pointerId);e.preventDefault();};el.onpointermove=e=>{if(held!==id)return;draft[id]=[e.clientX/innerWidth,e.clientY/innerHeight];positionStyle(el,draft[id],size);};el.onpointerup=el.onpointercancel=()=>{held=null;};el.onkeydown=e=>{const delta={ArrowLeft:[-.015,0],ArrowRight:[.015,0],ArrowUp:[0,-.015],ArrowDown:[0,.015]}[e.key];if(!delta)return;e.preventDefault();draft[id]=draft[id].map((v,i)=>Math.max(0,Math.min(1,v+delta[i])));paint();};}positionStyle(el,draft[id],size);}}
  function closeEditor(save){if(save){prefs.positions=Object.fromEntries(Object.entries(draft).map(([id,p])=>[id,p.map(n=>Math.max(0,Math.min(1,n)))]));persist();}editor.hidden=true;held=null;applyPositions();previousFocus?.focus();}
  $id('editTouchLayout').onclick=()=>{previousFocus=document.activeElement;draft={};const defaults=[[.17,.84],[.83,.84],[.60,.64],[.84,.64],[.60,.49],[.84,.49]];controls.forEach(([id,,size],i)=>{const el=$id(id),r=el?.getBoundingClientRect();draft[id]=prefs.positions[id]?.slice()||(r&&r.width&&r.height?[(r.left+r.width/2)/innerWidth,(r.top+r.height/2)/innerHeight]:defaults[i].slice());});editor.hidden=false;paint();$id('touchLayoutSave').focus();};
  $id('touchLayoutSave').onclick=()=>closeEditor(true);$id('touchLayoutCancel').onclick=()=>closeEditor(false);
  $id('resetTouchLayout').onclick=()=>{prefs.positions={};for(const[id]of controls){const el=$id(id);if(el)for(const prop of ['position','left','top','right','bottom'])el.style.removeProperty(prop);}persist();updateControlUI();};
  editor.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeEditor(false);}if(e.key==='Tab'){const list=[...editor.querySelectorAll('button')];let n=list.indexOf(document.activeElement);n=(n+(e.shiftKey?-1:1)+list.length)%list.length;e.preventDefault();list[n].focus();}},true);
  addEventListener('resize',()=>{applyPositions();if(!editor.hidden)paint();});
  for(const id of ['tbTitle','pauseTitleBtn','ikaiToTitle','kaiToTitle','kmToTitle'])if($id(id))$id(id).onclick=returnHome;
  const baseControl=updateControlUI;updateControlUI=function(){baseControl();applyPositions();};
  refresh();applyPositions();
  return{refresh,returnHome,applyPositions,preferences:()=>JSON.parse(JSON.stringify(prefs)),clearMovement};
})();
