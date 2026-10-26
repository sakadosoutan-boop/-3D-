/* Direct visit reuses the Claude replay's garden, hut, furniture and disposal path. */
var KENKO_HERMITAGE=(()=>{
  const $=id=>document.getElementById(id),ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let stage=null,visit=null,saved=null,loading=false,generation=0,night=false,lastFocus=null;
  const hud=document.createElement('section');hud.id='kenkoVisitHud';hud.hidden=true;
  hud.innerHTML='<header><div><small>徒然草を歩く</small><h2>兼好の草庵</h2></div><button id="kenkoVisitBack">元の屋敷へ戻る</button></header><p id="kenkoVisitStatus" role="status" aria-live="polite">庭から沓脱石を通って、縁と室内へ。いつもの移動・視点操作で歩けます。</p><nav aria-label="草庵の操作"><button id="kenkoVisitInspect">目の前を調べる</button><button id="kenkoVisitGuide">原文と模型の案内</button><button id="kenkoVisitNight" aria-pressed="false">夜の灯を見る</button><button id="kenkoVisitReplay">第七段の再現を見る</button></nav>';
  const note=document.createElement('section');note.id='kenkoVisitNote';note.hidden=true;note.setAttribute('role','dialog');note.setAttribute('aria-modal','true');note.setAttribute('aria-labelledby','kenkoVisitNoteTitle');
  note.innerHTML='<header><h2 id="kenkoVisitNoteTitle"></h2><button id="kenkoVisitNoteClose" aria-label="解説を閉じる">閉じる</button></header><div id="kenkoVisitNoteBody"></div>';
  document.body.append(hud,note);
  const source=n=>'https://www2.yamanashi-ken.ac.jp/~itoyo/tsuredure/turedure000_049/turedure'+String(n).padStart(3,'0')+'.htm';
  const notes={
    hut:['草庵と住まい','床を少し上げた母屋、竹の簀子縁、吊り上げた蔀戸を観察できます。第十段では、住まいに庭の草木や調度がなじむ様子を語っています。これは兼好の実際の庵の実測復元ではありません。',10],
    desk:['文机と硯','料紙、筆、硯、冊子、巻子を載せた文机です。序段の「硯にむかひて」という言葉から、書く営みを考える入口にしています。机や道具の具体的な形・配置を序段が記しているわけではありません。',0],
    lamp:['燈台の小さな灯','油皿と灯心を持つ燈台の模型です。「夜の灯を見る」で紙の窓と室内の明かりを観察できます。第七段の原文はこの燈台を描写しておらず、夜の生活を考えるための調度です。',7],
    garden:['庭の草・木立・遣水','草、松、楓、竹、流れを近くから見てください。第十段の「わざとならぬ庭の草」は、草木が自然に見える住まいの趣に結び付きます。この庭の地形・樹種・水路は模型の構成です。',10],
    kenko:['兼好と第七段','第七段は「世は定めなきこそいみじけれ」と語り、限りある時間へ目を向けます。草庵を歩いた後は、既存の十三場の再現で露・煙・四季の場面を続けて見られます。ここに座る人物も学習用の表現です。',7],
    guide:['原文と模型の案内','この草庵は既存の徒然草再現モードと同じ模型です。第七段は人の命と無常、第十段は住まいと庭の趣、序段は書く営みを読む入口になります。双ヶ岡は兼好ゆかりの地とされますが、建物の寸法・配置・調度は本文から特定できません。模型を手がかりに、原文の言葉へ戻ってください。',7]
  };
  function showNote(key){
    if(!visit?.ready)return;const data=notes[key]||notes.guide;lastFocus=document.activeElement;resetInputState();
    $('kenkoVisitNoteTitle').textContent=data[0];$('kenkoVisitNoteBody').innerHTML='<p>'+data[1]+'</p><p><a href="'+source(data[2])+'" target="_blank" rel="noopener noreferrer">原文：徒然草 '+(data[2]===0?'序段':'第'+data[2]+'段')+'（山梨県立大学公開本文）</a></p>'+(key==='guide'?'<p><a href="https://www.pref.kyoto.jp/select200/historical28.html" target="_blank" rel="noopener noreferrer">兼好ゆかりの雙ヶ岡（京都府）</a></p>':'');
    note.hidden=false;$('kenkoVisitNoteClose').focus();
  }
  function closeNote(){note.hidden=true;resetInputState();if(lastFocus?.isConnected)lastFocus.focus();}
  function snapshot(){
    const lights=[];scene.traverse(o=>{if(o.isLight)lights.push({o,color:o.color.clone(),ground:o.groundColor?.clone(),intensity:o.intensity,position:o.position.clone(),quaternion:o.quaternion.clone(),distance:o.distance,decay:o.decay});});
    return {player:player.pos.clone(),yaw:player.yaw,pitch:player.pitch,view:APP.view,labelMode:APP.labelMode,
      camera:{position:camera.position.clone(),quaternion:camera.quaternion.clone(),near:camera.near,far:camera.far,fov:camera.fov},dummy:window.dummyCam,
      visible:new Map(scene.children.filter(o=>!o.isLight).map(o=>[o,o.visible])),lights,
      celestial:new Map([cloudDome,sunMesh,moonMesh,moonHalo,moonPhaseShadow].filter(Boolean).map(o=>[o,o.visible])),
      background:scene.background,environment:scene.environment,fog:scene.fog?{color:scene.fog.color.clone(),density:scene.fog.density}:null,
      exposure:renderer.toneMappingExposure,autoPaused:AUTO_TIME._paused,backgroundPaused:!!SFX._backgroundPaused,
      rain:{season:rainFall.userData.rainSeason,on:rainFall.userData.rainOn,visible:rainFall.visible},focus:document.activeElement};
  }
  function restore(){
    const s=saved;if(!s)return;
    for(const [o,v] of s.visible)if(o.parent===scene)o.visible=v;
    for(const [o,v] of s.celestial)o.visible=v;
    for(const l of s.lights){l.o.color.copy(l.color);if(l.ground)l.o.groundColor.copy(l.ground);l.o.intensity=l.intensity;l.o.position.copy(l.position);l.o.quaternion.copy(l.quaternion);if(l.distance!==undefined)l.o.distance=l.distance;if(l.decay!==undefined)l.o.decay=l.decay;}
    scene.background=s.background;scene.environment=s.environment;if(s.fog&&scene.fog){scene.fog.color.copy(s.fog.color);scene.fog.density=s.fog.density;}
    renderer.toneMappingExposure=s.exposure;player.pos.copy(s.player);player.yaw=s.yaw;player.pitch=s.pitch;APP.view=s.view;APP.labelMode=s.labelMode;
    camera.position.copy(s.camera.position);camera.quaternion.copy(s.camera.quaternion);camera.near=s.camera.near;camera.far=s.camera.far;camera.fov=s.camera.fov;camera.updateProjectionMatrix();window.dummyCam=s.dummy;
    AUTO_TIME._paused=s.autoPaused;SFX.setBackgroundPaused(s.backgroundPaused);if(typeof ambientAudio!=='undefined'&&ambientAudio?.syncSynthLevels)ambientAudio.syncSynthLevels();
    rainFall.userData.rainSeason=s.rain.season;rainFall.userData.rainOn=s.rain.on;rainFall.visible=s.rain.visible;
    renderer.shadowMap.needsUpdate=true;clock.oldTime=performance.now();resetInputState();
    if(typeof NIGHT_LIGHTING!=='undefined')NIGHT_LIGHTING.update(camera,true);s.focus?.focus?.({preventScroll:true});saved=null;
  }
  function leave(){
    if(!stage&&!saved)return;generation++;loading=false;note.hidden=true;hud.hidden=true;document.body.classList.remove('kenko-hermitage-mode');
    try{visit?.dispose();}finally{if(stage?.parent)stage.parent.remove(stage);stage=null;visit=null;restore();}
  }
  async function open(){
    if(stage)return false;
    if(typeof SAIGEN_TSUREZURE==='undefined'||!SAIGEN_TSUREZURE.createHermitage){toast('草庵の素材を読み込めませんでした',2400);return false;}
    window.KAMAKURA_GAMES?.stop();window.KAMAKURA_WORLD?.K?.closeModal?.();
    window.KAMAKURA_WORLD?.K?.kyudoStop?.();window.KAMAKURA_CUSTOMS?.close?.();
    window.SELECTED_WORLD?.close?.();if(typeof tbMoreClose==='function')tbMoreClose();
    if(typeof CODEX_VIEWER!=='undefined'&&CODEX_VIEWER.active)CODEX_VIEWER.close(false,false);
    if(typeof setPhotoMode==='function'&&document.body.classList.contains('photo-mode'))setPhotoMode(false);
    if(typeof closeCodex==='function')closeCodex();if(typeof closeInfo==='function')closeInfo();
    closePauseMenu();closeResultPanel();
    if(APP.mode!=='walk')enterMode('walk');
    hideModeBrief(true);clearTimeout(_loadTimer);$('loadingScreen')?.classList.remove('show');
    if(APP.tour?.active&&typeof endTour==='function')endTour(true,true);
    if(APP.gisshaCarry?.active){toast('牛車を車宿へ戻してから草庵を訪ねてください',2400);return false;}
    const owner=++generation;saved=snapshot();loading=true;night=false;stage=new THREE.Group();stage.name='kenko-hermitage-visit';stage.visible=false;
    for(const [o] of saved.visible)o.visible=false;scene.add(stage);APP.view='fp';APP.labelMode=0;AUTO_TIME._paused=true;window.dummyCam=null;resetInputState();SFX.setBackgroundPaused(true);
    document.body.classList.add('kenko-hermitage-mode');hud.hidden=false;$('kenkoVisitStatus').textContent='草庵の庭・建物・人物を順に整えています…';$('kenkoVisitNight').setAttribute('aria-pressed','false');$('kenkoVisitNight').textContent='夜の灯を見る';$('kenkoVisitBack').focus();
    try{
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(owner!==generation)return false;
      visit=SAIGEN_TSUREZURE.createHermitage(stage);
      for(let step=0;step<3;step++){
        if(owner!==generation)return false;visit.prepare();stage.visible=false;
        $('kenkoVisitStatus').textContent=['空を整えました。庭と建物を用意しています…','庭と建物を整えました。調度と兼好を用意しています…','草庵へ入ります…'][step];
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      if(owner!==generation)return false;
      if(!visit.ready||!visit.assets.hut?.userData.dims)throw new Error('草庵の建物を用意できませんでした');
      stage.visible=true;loading=false;camera.near=.08;camera.far=800;camera.fov=62;camera.updateProjectionMatrix();
      player.pos.set(.55,heightAt(.55,5)+1.62,5);player.yaw=0;player.pitch=-.12;camera.position.copy(player.pos);camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
      renderer.shadowMap.needsUpdate=true;$('kenkoVisitStatus').textContent='庭から沓脱石を通って、縁と室内へ。いつもの移動・視点操作で歩けます。'+(APP.map==='kamakura'?' 第七段の再現は平安の屋敷へ移って見ます。':'');
      $('kenkoVisitReplay').textContent=APP.map==='kamakura'?'平安の屋敷で再現を見る':'第七段の再現を見る';frame(0,clock.elapsedTime);return true;
    }catch(e){if(owner===generation){leave();toast('草庵を開けませんでした。'+e.message,4000);}return false;}
  }
  function heightAt(x,z){
    if(!visit)return 0;const hut=visit.assets.hut,d=hut?.userData.dims;if(!d)return visit.heightAt(x,z);
    const [x0,x1]=d.postsX,[z0,z1]=d.postsZ;
    if((x>=x0&&x<=x1&&z>=z0&&z<=d.verandaFront)||(x>=x1&&x<=d.verandaEast&&z>=z0&&z<=d.verandaFront))return hut.position.y+d.floorY;
    const p=hut.userData.anchors.stepFront.position;
    if(Math.pow((x-p.x)/.56,2)+Math.pow((z-p.z)/.47,2)<=1)return hut.position.y+p.y;
    return visit.heightAt(x,z);
  }
  function blocked(x,z){
    if(!visit?.ready)return true;
    if(x< -20||x>20||z< -14||z>18||Math.abs(z-visit.streamZ(x))<1.15)return true;
    const d=visit.assets.hut.userData.dims,[x0,x1]=d.postsX,[z0,z1]=d.postsZ,r=.17;
    if((Math.abs(x-x0)<r||Math.abs(x-x1)<r)&&z>=z0-r&&z<=z1+r)return true;
    if(Math.abs(z-z0)<r&&x>=x0-r&&x<=x1+r)return true;
    for(const [px,pz] of [[x0,z1],[x1,z1],[x0,z0],[x1,z0],[0,z0],[x0,0],[x1,0]])if(Math.hypot(x-px,z-pz)<.24)return true;
    if(x>-.80&&x<.30&&z>-.04&&z<.59)return true; // document table, seated figure and lamp share the inside furniture area
    if(Math.hypot(x+.25,z+.20)<.42||Math.hypot(x+.92,z-.02)<.25)return true;
    if(Math.abs(x+7.2)<.20&&z>-7.2&&z<-.8)return true;
    for(const tree of visit.assets.trees||[])if(Math.hypot(x-tree.position.x,z-tree.position.z)<(tree===visit.assets.pine?.55:.26))return true;
    return false;
  }
  function resolveMove(fromX,fromZ,toX,toZ){
    let x=fromX,z=fromZ;const steps=Math.max(1,Math.ceil(Math.hypot(toX-fromX,toZ-fromZ)/.06)),dx=(toX-fromX)/steps,dz=(toZ-fromZ)/steps;
    const allowed=(nx,nz)=>!blocked(nx,nz)&&heightAt(nx,nz)-heightAt(x,z)<=.301;
    for(let i=0;i<steps;i++){
      if(allowed(x+dx,z+dz)){x+=dx;z+=dz;}
      else if(allowed(x+dx,z))x+=dx;else if(allowed(x,z+dz))z+=dz;
    }return {x,z};
  }
  function frame(dt,t){
    if(!stage)return;if($('modeBrief')?.classList.contains('show'))hideModeBrief(true);if(loading){renderer.clear();return;}
    if(GAMEPAD.active)gamepadPoll();
    if(!gameplayInputBlocked()){
      let mx=(keyActive('right')?1:0)-(keyActive('left')?1:0)+joy.vx,mz=(keyActive('back')?1:0)-(keyActive('forward')?1:0)+joy.vy;
      if(GAMEPAD.active){mx+=GAMEPAD.mx;mz+=GAMEPAD.mz;const sensitivity=(APP_SENS||5)/5;player.yaw-=GAMEPAD.lookX*dt*2.2*sensitivity;player.pitch=THREE.MathUtils.clamp(player.pitch-GAMEPAD.lookY*dt*1.8*sensitivity*(APP_INV_Y?-1:1),-1.25,1.25);}
      const length=Math.max(1,Math.hypot(mx,mz)),speed=(keyActive('run')?4.2:2.4)*Math.min(dt,.08),s=Math.sin(player.yaw),c=Math.cos(player.yaw);
      const p=resolveMove(player.pos.x,player.pos.z,player.pos.x+(mz*s+mx*c)/length*speed,player.pos.z+(mz*c-mx*s)/length*speed);
      player.pos.x=p.x;player.pos.z=p.z;player.pos.y=heightAt(p.x,p.z)+1.62;
    }
    camera.position.copy(player.pos);camera.rotation.set(player.pitch,player.yaw,0,'YXZ');camera.updateMatrixWorld(true);visit.update(dt,t);
    if(typeof NIGHT_LIGHTING!=='undefined')NIGHT_LIGHTING.update(camera);renderer.render(scene,camera);
  }
  function inspect(x=innerWidth/2,y=innerHeight/2){
    if(!visit?.ready||gameplayInputBlocked())return;pointer.set(x/innerWidth*2-1,1-y/innerHeight*2);ray.setFromCamera(pointer,camera);
    const assets=visit.assets,hits=ray.intersectObjects([assets.hut,...(assets.trees||[]),assets.stream,assets.anGrass].filter(Boolean),true);
    const hit=hits.find(h=>h.distance<9);if(!hit){showNote('guide');return;}
    const within=root=>{for(let p=hit.object;p;p=p.parent)if(p===root)return true;return false;};
    const key=within(assets.desk)?'desk':within(assets.lamp)?'lamp':within(assets.kenko?.read)?'kenko':within(assets.hut)?'hut':'garden';showNote(key);
  }
  $('kenkoVisitBack').onclick=leave;$('kenkoVisitGuide').onclick=()=>showNote('guide');$('kenkoVisitInspect').onclick=()=>inspect();$('kenkoVisitNoteClose').onclick=closeNote;
  $('kenkoVisitNight').onclick=()=>{if(!visit?.ready)return;night=!night;visit.setNight(night);renderer.shadowMap.needsUpdate=true;$('kenkoVisitNight').setAttribute('aria-pressed',String(night));$('kenkoVisitNight').textContent=night?'昼の庭を見る':'夜の灯を見る';};
  function startReplay(){
    if(loading)return;leave();
    if(APP.map==='kamakura'){
      const url=new URL(location.href);url.searchParams.delete('map');url.searchParams.delete('visit');url.searchParams.set('replay','tsurezure7');location.assign(url.href);return;
    }
    enterMode('saigen');if(APP.mode!=='saigen')return;$('sgPicker').style.display='none';startSaigen('tsurezure_adashino');hideModeBrief(true);
  }
  $('kenkoVisitReplay').onclick=startReplay;
  const baseEnter=enterMode;enterMode=function(...args){if(stage)leave();return baseEnter.apply(this,args);};
  const basePick=pick;pick=function(...args){if(stage)return inspect(...args);return basePick.apply(this,args);};
  const baseBlocking=pauseBlockingOverlayOpen;pauseBlockingOverlayOpen=function(){return !note.hidden||loading||baseBlocking();};
  note.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeNote();}if(e.key==='Tab'){const list=[...note.querySelectorAll('button,a[href]')];let index=list.indexOf(document.activeElement);index=(index+(e.shiftKey?-1:1)+list.length)%list.length;e.preventDefault();list[index].focus();}},true);
  // 表紙では「物語・古典」の一枚として並べる(サブ選択が無い旧構成では表紙の推薦欄へ)。
  const entry=document.createElement('button');entry.id='kenkoVisitEntry';entry.type='button';
  const entryHost=document.querySelector('#taikenSubPanel .t-modes');
  if(entryHost){entry.className='t-btn';entry.innerHTML='<span class="mode-tags"><span class="mode-meta">徒然草 / 散策</span></span><span class="mode-name">兼好の草庵を訪ねる</span><small>徒然草の庵を歩き、原文と模型を見比べる</small>';entry.onclick=()=>{if(typeof hideSubPanel==='function')hideSubPanel('taikenSubPanel');open();};entryHost.append(entry);}
  else{entry.className='tb-btn';entry.textContent='兼好の草庵を訪ねる';entry.onclick=open;($('homeNext')||$('mainModes')||$('title')).append(entry);}
  const walkMenu=$('tbmTour')?.parentNode;
  if(walkMenu){const button=document.createElement('button');button.id='kenkoVisitWalkEntry';button.className=$('tbmTour').className;button.textContent='兼好の草庵を訪ねる';button.onclick=open;walkMenu.append(button);}
  // Parse the route once; returning to the title must not reopen it.
  const route=new URLSearchParams(location.search);
  if(route.get('visit')==='kenko')setTimeout(open,0);
  else if(route.get('replay')==='tsurezure7')setTimeout(startReplay,0);
  return {open,leave,frame,inspect,showNote,heightAt,resolveMove,get active(){return !!stage;},get loading(){return loading;},get stage(){return stage;},get assets(){return visit?.assets||null;}};
})();
