/* ============================================================
   波M: ストーリーモード「御簾の向こうへ」統合ランタイム(試験版)
   ■ 入口は隠しゲート: URLに ?story=1 が付いた時だけタイトルに入口ボタンが現れる。
     通常プレイヤーには一切見えない(実機確認用の非公開モード)。?storyDebug=1 で隠しパラメータ表示。
   ■ 章データ(STORY_EMBED)・StoryManager・StoryObjects は直前に同梱済み。
   ■ ミニゲーム接続は第1話クイズのみ本接続。他章の試練は試験版パネル(成功/失敗を選ぶ)で
     全章の物語・分岐・EDを通しで確認できる。
   ■ CSS/DOMはこのランタイムが起動時に注入する(本体HTMLの構造は変えない)。
============================================================ */
(function(){
"use strict";
const STORY_TIME_MAP={morning:"dawn",day:"day",dusk:"dusk",night:"night",dawn:"dawn"};
const STORY_ED_TEXT={
  ED1_TRUE:  {t:"ED1 True End「御簾を上げる朝」", d:"教室の机に、白い短冊が一枚。窓の外をカモメが横切る。<br>「御簾って、ただ隠すためのものじゃないんだな。今度、ちゃんと教えてくれないか。」"},
  ED2_NORMAL:{t:"ED2 Normal End「現の朝」", d:"古典の点は上がった。けれど小萩の声は、朝の光の中で薄れていく。<br>教科書の御簾の挿絵だけが、かすかに揺れている。"},
  ED3_GAMEOVER:{t:"ED3 Bad End「歌なき夜」", d:"灯火は消え、御簾の向こうの声は黒い線になった。<br>言葉と戦いの備えを整えて、もう一度。"},
  ED4_SYNC:  {t:"ED4 Bad End「常世の婿」", d:"帰る道を前に、あなたは振り返った。御簾の内は美しく、現代の音は遠ざかる。<br>——現実の教室では、隣の席だけが空いている。"},
  ED5_SPOOKY:{t:"ED5 Spooky End「百年の夢」", d:"名をなくした人は、物語にやさしく飼われます。<br><span style='color:#b9a5e6'>あなたの席は、まだ空いています。</span>"}
};
let SM=null,erosionFx=null;
function stEl(id){return document.getElementById(id);}
/* ---- CSS/DOM 注入 ---- */
function stInject(){
  if(stEl("stBox"))return; // 注入済み(プレースホルダ#storyHudはHTMLに常設)
  const css=[
    "#storyHud{position:fixed;inset:0;z-index:45;pointer-events:none;display:none}",
    "#storyHud .st-chip{position:fixed;top:calc(env(safe-area-inset-top) + 6px);left:50%;transform:translateX(-50%);pointer-events:auto;",
    " background:linear-gradient(180deg,rgba(28,18,10,.94),rgba(16,10,6,.95));border:1px solid var(--kin);border-radius:7px;",
    " padding:4px 12px;color:#e6d9bb;font-size:12px;font-family:var(--serif);letter-spacing:.08em;white-space:nowrap}",
    "#storyHud .st-chip small{color:#9a8a6a;font-family:var(--sans);font-size:10px;margin-left:8px}",
    "#storyHud #stQuit{position:fixed;top:calc(env(safe-area-inset-top) + 6px);right:9px;pointer-events:auto;background:var(--urushi);",
    " color:var(--gofun);border:1px solid var(--kin);width:30px;height:30px;border-radius:50%;font-size:14px;line-height:1;cursor:pointer}",
    "#storyHud .st-box{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 10px);transform:translateX(-50%);",
    " width:min(720px,96vw);max-height:35vh;pointer-events:auto;background:linear-gradient(180deg,rgba(24,16,9,.95),rgba(13,9,5,.97));",
    " border:1px solid var(--kin);border-radius:11px;box-shadow:0 8px 30px rgba(0,0,0,.55);padding:10px 13px 11px;display:none}",
    "#storyHud .st-spk{font-size:11px;color:var(--kin);letter-spacing:.14em;margin-bottom:5px;font-family:var(--serif)}",
    "#storyHud .st-text{font-size:14px;line-height:1.85;color:#efe6cd;font-family:var(--serif);letter-spacing:.04em;overflow-y:auto;max-height:20vh}",
    "#storyHud .st-next{margin-top:8px;text-align:right}",
    "#storyHud .st-next button,#storyHud .st-opt{cursor:pointer;background:linear-gradient(155deg,#4a1f14,#311309);color:var(--gofun);",
    " border:1px solid var(--kin);padding:9px 16px;font-size:12.5px;border-radius:6px;letter-spacing:.06em;font-family:var(--serif)}",
    "#storyHud .st-opts{display:flex;flex-direction:column;gap:8px;margin-top:8px}",
    "#storyHud .st-opt{text-align:left;min-height:44px;line-height:1.5}",
    "#storyHud .st-opt:hover{filter:brightness(1.15)}",
    "#storyHud .st-panel{position:fixed;inset:0;display:none;align-items:center;justify-content:center;pointer-events:auto;",
    " background:radial-gradient(ellipse at center,rgba(10,7,4,.75),rgba(6,4,2,.92))}",
    "#storyHud .st-card{width:min(460px,92vw);max-height:84vh;overflow-y:auto;background:linear-gradient(180deg,rgba(28,19,11,.98),rgba(15,10,6,.99));",
    " border:1px solid var(--kin);border-radius:14px;box-shadow:0 14px 50px rgba(0,0,0,.7);padding:22px 20px;text-align:center}",
    "#storyHud .st-card h3{margin:0 0 10px;color:var(--kin);font-family:var(--serif);font-size:18px;letter-spacing:.1em}",
    "#storyHud .st-card .st-body{font-size:12.5px;color:#e0d4b4;line-height:1.9;font-family:var(--serif);margin-bottom:14px}",
    "#storyHud .st-card .st-btns{display:flex;flex-direction:column;gap:8px}",
    "#storyFade{position:fixed;inset:0;z-index:46;pointer-events:none;opacity:0;background:#000;transition:opacity .9s ease .12s}",
    "#storyFade.white{background:#f2ead8}",
    "#storyFade.show{opacity:1;transition:opacity 0s}",
    "#storyFade.quick{transition:opacity .12s ease}",
    "body.story-mode #modeBrief{display:none}"
  ].join("\n");
  const st=document.createElement("style");st.id="storyCss";st.textContent=css;document.head.appendChild(st);
  let hud=stEl("storyHud");
  if(!hud){hud=document.createElement("div");hud.id="storyHud";document.body.appendChild(hud);}
  hud.innerHTML=
    '<div class="st-chip"><span id="stChTitle">物語</span><small id="stDebug"></small></div>'+
    '<button id="stQuit" title="物語を閉じる">✕</button>'+
    '<div class="st-box" id="stBox"><div class="st-spk" id="stSpk"></div><div class="st-text" id="stText"></div>'+
    '<div class="st-next" id="stNextWrap"><button id="stNext">つぎへ ▶</button></div><div class="st-opts" id="stOpts"></div></div>'+
    '<div class="st-panel" id="stPanel"><div class="st-card"><h3 id="stPanelTitle"></h3><div class="st-body" id="stPanelBody"></div><div class="st-btns" id="stPanelBtns"></div></div></div>';
  const fade=document.createElement("div");fade.id="storyFade";document.body.appendChild(fade);
  stEl("stQuit").onclick=()=>{beep(440,.06);stExitToTitle();};
}
/* ---- 転換演出(波L互換・story専用要素) ---- */
function stFade(color){
  const el=stEl("storyFade");if(!el)return;
  el.className=(color==="white"?"white":"");
  el.classList.add("show");void el.offsetWidth;
  clearTimeout(window._stFadeT);
  window._stFadeT=setTimeout(()=>el.classList.remove("show"),(typeof REDUCED_MOTION!=="undefined"&&REDUCED_MOTION)?60:340);
}
function stLightning(){
  const el=stEl("storyFade");if(!el)return;
  if(typeof REDUCED_MOTION!=="undefined"&&REDUCED_MOTION){if(typeof saigenSe==="function")saigenSe("thunder");return;}
  el.className="white quick";el.classList.add("show");
  clearTimeout(window._stFadeT);
  setTimeout(()=>el.classList.remove("show"),90);
  window._stFadeT=setTimeout(()=>{el.classList.add("show");setTimeout(()=>el.classList.remove("show"),70);},230);
  if(typeof saigenSe==="function")saigenSe("thunder");
}
/* ---- 登場人物(StoryObjects) ---- */
function stSpawnActors(){
  const S=APP.story;if(S.actors)return;
  const SO=window.StoryObjects;if(!SO)return;
  const mk=(api,x,y,z,yaw)=>{api.group.position.set(x,y,z);api.group.rotation.y=yaw;api.group.userData.baseY=y;
    api.group.visible=false;scene.add(api.group);return api;};
  S.actors={
    kohagi:  mk(SO.createStoryKohagiObject(), -0.6,1.30,-1.6, 0.40),
    ukon:    mk(SO.createStoryUkonObject(),    1.9,1.20, 4.3,-2.60),
    minister:mk(SO.createMinisterObject(),     2.0,1.30,-2.2, 0.15),
    judge:   mk(SO.createUtakaiJudgeObject(),  0.0,1.30,-1.9, 0.0)
  };
}
const ST_SPEAKER_ACTOR={ "小萩":"kohagi","右近":"ukon","左大臣":"minister","判者":"judge" };
/* ---- 演出フィールド適用(fade/fx/se/emotes/shioriGhost/stage/camera) ---- */
function stApplyPresentation(ev){
  if(!ev)return;
  if(ev.fade)stFade(ev.fade);
  else if(ev.fx==="lightning")stLightning();
  if(ev.se&&typeof saigenSe==="function")saigenSe(ev.se);
  const S=APP.story;
  if(S&&S.actors){
    if(ev.emotes)Object.entries(ev.emotes).forEach(([k,e])=>{
      const a=S.actors[k];if(!a)return;a.group.visible=true;
      if(a.setExpression&&["neutral","smile","stern","sad","surprise"].includes(e))a.setExpression(e);
    });
    if(ev.shioriGhost!=null&&S.actors.kohagi&&S.actors.kohagi.setShioriGhost){S.actors.kohagi.group.visible=true;S.actors.kohagi.setShioriGhost(ev.shioriGhost);}
    if(ev.stage){
      const st=ev.stage;
      if(st.judgeFanText&&S.actors.judge){S.actors.judge.group.visible=true;S.actors.judge.setFanText(st.judgeFanText);}
      if(st.ministerShadow!=null&&S.actors.minister){S.actors.minister.group.visible=true;S.actors.minister.setShadowReach(st.ministerShadow);}
      if(st.ministerPossessed!=null&&S.actors.minister)S.actors.minister.setPossessed(!!st.ministerPossessed);
      if(st.erosionLevel!=null&&erosionFx)erosionFx.setLevel(st.erosionLevel);
    }
  }
  if(ev.cameraAngleId)stCamera(ev.cameraAngleId);
}
function stCamera(id){
  const SO=window.StoryObjects;const ang=SO&&SO.STORY_CAMERA_ANGLES&&SO.STORY_CAMERA_ANGLES[id];
  if(!ang)return;
  APP.view="fp";
  if(typeof applySaigenCam==="function")applySaigenCam({pos:ang.pos,look:ang.look});
  if(ang.fov&&typeof camera!=="undefined"){camera.fov=ang.fov;camera.updateProjectionMatrix();}
  if(typeof snapSaigenCamera==="function")snapSaigenCamera();
  if(typeof updateControlUI==="function")updateControlUI();
}
/* ---- HUD描画 ---- */
function stShowDialogue(spk,text,ev){
  stEl("stBox").style.display="block";stEl("stOpts").innerHTML="";stEl("stNextWrap").style.display="";
  stEl("stSpk").textContent=spk?("— "+spk+" —"):"語り";
  stEl("stText").textContent=text||"";
  const actorKey=ST_SPEAKER_ACTOR[spk];
  if(actorKey&&APP.story&&APP.story.actors&&APP.story.actors[actorKey])APP.story.actors[actorKey].group.visible=true;
  stEl("stNext").onclick=()=>{beep(600,.045,"triangle",.07);SM.goNext(ev.next);};
}
function stShowChoice(text,options){
  stEl("stBox").style.display="block";stEl("stNextWrap").style.display="none";
  stEl("stSpk").textContent="選べ";
  stEl("stText").textContent=text||"";
  const host=stEl("stOpts");host.innerHTML="";
  options.forEach((o,i)=>{
    const b=document.createElement("button");b.className="st-opt";b.textContent=(i+1)+". "+o.text;
    b.onclick=()=>{beep(680,.05,"triangle",.08);host.innerHTML="";SM.choose(i);};
    host.appendChild(b);
  });
}
function stPanel(title,bodyHtml,btns){
  stEl("stPanelTitle").textContent=title;
  stEl("stPanelBody").innerHTML=bodyHtml;
  const host=stEl("stPanelBtns");host.innerHTML="";
  btns.forEach(([label,fn])=>{const b=document.createElement("button");b.className="st-opt";b.style.textAlign="center";
    b.textContent=label;b.onclick=()=>{beep(660,.05);stEl("stPanel").style.display="none";fn&&fn();};host.appendChild(b);});
  stEl("stPanel").style.display="flex";
}
function stDebugRefresh(snap){
  const el=stEl("stDebug");if(!el)return;
  if(!/[?&]storyDebug=1/.test(location.search)){el.textContent="";return;}
  const p=(snap&&snap.state&&snap.state.params)||{};
  el.textContent=`現${p.realityEgo|0}/雅${p.fantasySynchro|0}/蝕${p.brainErosion|0}`;
}
/* ---- 収集物 ---- */
function stSpawnCollectibles(info){
  const S=APP.story,SO=window.StoryObjects;if(!S||!SO)return;
  stClearCollectibles();
  const items=(info.positions||[]).map(p=>{
    const api=(info.kind==="waka_tanzaku")?SO.createWakaTanzakuObject(p.label||""):SO.createTermCardObject(p.label||"");
    const y=(typeof groundH==="function"?groundH(p.x,p.z):0)+1.05;
    api.group.position.set(p.x,y,p.z);api.group.userData.baseY=y;api.group.userData.ph=Math.random()*6;
    scene.add(api.group);
    return {id:p.id,api,got:false};
  });
  S.collect={groupId:info.groupId,items,onCollect:info.onCollect,kind:info.kind};
  toast("光る札を集めよう("+items.length+"枚)。近づけば手に入る",3200);
  stEl("stBox").style.display="none"; // 収集中は会話箱を畳み、歩かせる
}
function stClearCollectibles(){
  const S=APP.story;if(!S||!S.collect)return;
  S.collect.items.forEach(it=>{if(window.StoryObjects)window.StoryObjects.disposeGroup(it.api.group);});
  S.collect=null;
}
/* ---- 効果(effect)フック ---- */
function stEffect(info){
  const S=APP.story,SO=window.StoryObjects;
  const id=info.effectId||"";
  if(id==="white_tanzaku_from_seagull"&&SO){
    const api=SO.createWhiteTanzakuObject();
    api.setText(info.payload&&info.payload.text||"");
    api.group.position.set(player.pos.x+0.6,player.pos.y+4.5,player.pos.z-1.2);
    scene.add(api.group);S.props.push({kind:"tanzaku",api,falling:true});
    if(typeof saigenSe==="function")saigenSe("wind");
    if(info.payload&&info.payload.text)setTimeout(()=>toast("白い短冊「"+info.payload.text+"」",3600),900);
  }else if(id==="tokoyo_glitch"&&SO){
    const api=SO.createTokoyoGlitchProps(9);
    api.group.position.set(30,0.2,-48);scene.add(api.group);
    S.props.push({kind:"tokoyo",api});
  }else if(id==="oni_tears_misu"&&SO){
    stLightning();
    if(!S.oni){const api=SO.createGreatOniStoryObject();api.group.position.set(30,0,-48);scene.add(api.group);S.oni=api;}
  }
  // 他のeffectIdは現段階では演出なしで通過(effectはManager側で自動的にnextへ進む)
}
/* ---- ミニゲーム接続 ---- */
function stMiniGame(info){
  const S=APP.story;S.mini=info;
  stEl("stBox").style.display="none";
  if(info.gameMode==="quiz_beginner"){
    // 既存クイズへ本接続: 対象5札の復習モード。結果画面は出さず物語へ帰す
    APP.storyQuiz=(ok)=>{enterMode("story");info.complete({success:ok});};
    if(typeof camera!=="undefined"){camera.fov=62;camera.updateProjectionMatrix();} // 物語カメラのfovを戻す
    enterMode("quiz");
    const pk=stEl("quizDiffPicker");if(pk)pk.style.display="none";
    startQuiz(["hajitomi","misu","kichou","hisashi","moya"]);
    toast("小萩の試験——五つの名を当てよ",3000);
    return;
  }
  // 試験版プレースホルダ: 未接続の試練は成功/失敗を選んで通しの物語確認ができる
  const label={kaimami_story:"垣間見の試練",taiji_kappa_story:"河童の主との戦い",utakai_story:"歌合 三番勝負",taiji_oni_story_final:"大鬼との決戦"}[info.gameMode]||info.gameMode;
  stPanel("【試験版】"+label,
    "この試練のミニゲーム接続は次段階で実装します。<br>いまは結果を選んで物語を進められます。<br><small style='color:#9a8a6a'>「成功(高評価)」はTrue End条件のPerfect評価も付与します</small>",
    [["成功(高評価)として進む",()=>{if(S.oni&&info.gameMode==="taiji_oni_story_final"){window.StoryObjects.disposeGroup(S.oni.group);S.oni=null;}
        info.complete({success:true,flags:info.gameMode==="utakai_story"?{utakaiPerfect:true}:info.gameMode==="taiji_oni_story_final"?{oniPerfect:true}:{}});}],
     ["成功として進む",()=>{if(S.oni&&info.gameMode==="taiji_oni_story_final"){window.StoryObjects.disposeGroup(S.oni.group);S.oni=null;}
        info.complete({success:true});}],
     ["失敗として進む",()=>info.complete({success:false})]]);
}
/* ---- エンディング/章クリア ---- */
function stEnding(endingId){
  stClearCollectibles();
  const ed=STORY_ED_TEXT[endingId]||{t:endingId,d:""};
  if(endingId==="ED5_SPOOKY"&&erosionFx)erosionFx.setLevel(100);
  stPanel(ed.t,ed.d,[
    ["章をえらぶ",()=>{if(erosionFx)erosionFx.setLevel(0);SM.state.endingId=null;stChapterMenu();}],
    ["タイトルへ戻る",()=>{if(erosionFx)erosionFx.setLevel(0);stExitToTitle();}]
  ]);
}
function stChapterComplete(chapterId){
  stClearCollectibles();
  const next=chapterId+1,man=(window.STORY_EMBED&&STORY_EMBED.manifest&&STORY_EMBED.manifest.chapters)||[];
  const nx=man.find(c=>c.chapterId===next);
  const btns=[];
  if(nx)btns.push(["次の話へ 「"+nx.chapterTitle+"」",()=>stStartChapter(next)]);
  btns.push(["章をえらぶ",()=>stChapterMenu()],["タイトルへ戻る",()=>stExitToTitle()]);
  stPanel("第"+chapterId+"話　了","物語は、まだ御簾の向こうに続いています。",btns);
}
/* ---- 章メニュー ---- */
function stChapterMenu(){
  const man=(window.STORY_EMBED&&STORY_EMBED.manifest&&STORY_EMBED.chapters)?STORY_EMBED.manifest.chapters:[];
  const btns=man.map(c=>["第"+c.chapterId+"話 「"+c.chapterTitle+"」",()=>stStartChapter(c.chapterId)]);
  const save=SM&&SM.load&&(function(){try{return JSON.parse(localStorage.getItem("shinden3d-story-save-v1"));}catch(e){return null;}})();
  if(save&&save.state&&save.state.chapterId&&save.currentSequenceId&&save.currentSequenceId!=="chapter_complete"&&!save.state.endingId){
    btns.unshift(["続きから (第"+save.state.chapterId+"話)",()=>{
      SM.deserialize(save);stStartChapter(save.state.chapterId,save.currentSequenceId);}]);
  }
  btns.push(["タイトルへ戻る",()=>stExitToTitle()]);
  stPanel("御簾の向こうへ — 寝殿造り異聞","<small style='color:#9a8a6a'>試験版 / この画面は ?story=1 でのみ入れます</small>",btns);
}
function stStartChapter(id,resumeSeq){
  stEl("stPanel").style.display="none";
  SM.state.endingId=null;
  SM.startChapter(id).then(()=>{
    if(resumeSeq&&SM.sequenceMap.has(resumeSeq)){SM.currentSequenceId=resumeSeq;SM.runCurrent();}
  }).catch(e=>{console.error(e);toast("物語の読み込みに失敗しました",2600);});
}
/* ---- モード出入り ---- */
function startStory(){
  stInject();
  document.body.classList.add("story-mode");
  stEl("storyHud").style.display="block";
  if(APP.story){stDebugRefresh(SM&&SM.snapshot());return;} // ミニゲーム帰還: 再初期化しない
  APP.story={props:[],collect:null,actors:null,oni:null,
    prevSeason:APP.season,prevTime:APP.time,
    prevAutoPaused:(typeof AUTO_TIME!=="undefined")?AUTO_TIME._paused:false};
  if(typeof AUTO_TIME!=="undefined")AUTO_TIME._paused=true;
  stSpawnActors();
  if(!erosionFx&&window.StoryObjects)erosionFx=window.StoryObjects.createBrainErosionOverlay({}).mount();
  if(!SM){
    SM=new StoryManager({hooks:{
      onDialogue:(d)=>{stApplyPresentation(d.event);stShowDialogue(d.speaker,d.text,d.event);},
      onChoice:(c)=>{stApplyPresentation(c.event);stShowChoice(c.text,c.options);},
      onScene:(sc)=>{
        stApplyPresentation(sc.event);
        if(sc.season&&sc.season!=="tokoyo"&&typeof applySeason==="function"&&sc.season!==APP.season)applySeason(sc.season);
        const tm=STORY_TIME_MAP[sc.timeOfDay]||(sc.season==="tokoyo"?"night":null);
        if(sc.season==="tokoyo"&&typeof setTime==="function")setTime("night");
        else if(tm&&typeof setTime==="function"&&tm!==APP.time)setTime(tm);
        if(sc.playerStart){const p=sc.playerStart;
          player.pos.set(p.x,(typeof groundH==="function"?groundH(p.x,p.z):0)+1.62,p.z);
          if(p.yaw!=null)player.yaw=p.yaw;player.pitch=-.04;
          if(typeof camera!=="undefined")camera.position.copy(player.pos);window.dummyCam=null;}
      },
      onCamera:(id)=>stCamera(id),
      onEffect:(e)=>{stApplyPresentation(e.event);stEffect(e);},
      onCollectibles:(info)=>stSpawnCollectibles(info),
      onRequireCollectibles:()=>{},
      onMiniGameStart:(info)=>stMiniGame(info),
      onEnding:(id)=>stEnding(id),
      onChapterComplete:(cid)=>stChapterComplete(cid),
      onErosionWarning:(v)=>{if(erosionFx)erosionFx.setLevel(v);toast("⚠ 心が常世に呑まれかけている——次の過ちが最後になる",4200);if(typeof saigenSe==="function")saigenSe("gong");},
      onStateChanged:(snap)=>{stDebugRefresh(snap);
        const p=snap&&snap.state&&snap.state.params;
        if(p&&erosionFx)erosionFx.setLevel(p.brainErosion>=80?80:p.brainErosion>=60?60:p.brainErosion>=40?40:p.brainErosion>=20?20:0);},
      onError:(e)=>{console.error("[story]",e);}
    }});
  }
  const man=(window.STORY_EMBED&&STORY_EMBED.manifest&&STORY_EMBED.manifest.chapters&&STORY_EMBED.manifest.chapters[0])||null;
  stEl("stChTitle").textContent="御簾の向こうへ";
  SM.hooks.onChapterLoaded=(ch)=>{stEl("stChTitle").textContent="第"+ch.chapterId+"話 "+ch.chapterTitle;};
  stChapterMenu();
}
function stExitToTitle(){
  const S=APP.story;
  stClearCollectibles();
  if(S){
    (S.props||[]).forEach(p=>{if(window.StoryObjects)window.StoryObjects.disposeGroup(p.api.group);});
    if(S.oni&&window.StoryObjects){window.StoryObjects.disposeGroup(S.oni.group);S.oni=null;}
    if(S.actors)Object.values(S.actors).forEach(a=>{a.group.visible=false;});
    if(S.prevSeason&&typeof applySeason==="function"&&S.prevSeason!==APP.season)applySeason(S.prevSeason);
    if(S.prevTime&&typeof setTime==="function"&&S.prevTime!==APP.time)setTime(S.prevTime);
    if(typeof AUTO_TIME!=="undefined")AUTO_TIME._paused=!!S.prevAutoPaused;
  }
  if(erosionFx)erosionFx.setLevel(0);
  APP.story=null;APP.storyQuiz=null;
  document.body.classList.remove("story-mode");
  const hud=stEl("storyHud");if(hud){hud.style.display="none";stEl("stBox").style.display="none";stEl("stPanel").style.display="none";}
  const fd=stEl("storyFade");if(fd){clearTimeout(window._stFadeT);fd.className="";}
  if(typeof camera!=="undefined"){camera.fov=62;camera.updateProjectionMatrix();}
  APP.mode="title";
  const tb=stEl("topbar");if(tb)tb.style.display="none";
  const ttl=stEl("title");if(ttl)ttl.classList.remove("hide");
  if($("mainModes"))$("mainModes").style.display="block";
  if(typeof careerShowSenji==="function")careerShowSenji();
  if(typeof careerUpdateBadge==="function")careerUpdateBadge();
  if(typeof SFX!=="undefined"&&SFX.playTheme)SFX.playTheme();
  beep(560,.08,"sine",.1);
}
/* ---- 毎フレーム更新(animateから呼ばれる) ---- */
function storyUpdate(dt){
  const S=APP.story;if(!S)return;
  const t=performance.now()/1000;
  if(S.actors)Object.values(S.actors).forEach(a=>{if(a.group.visible&&a.update)a.update(t);});
  if(S.oni&&S.oni.update)S.oni.update(t);
  (S.props||[]).forEach(p=>{
    if(p.kind==="tanzaku"&&p.falling){if(p.api.updateFall(dt,(typeof groundH==="function"?groundH(p.api.group.position.x,p.api.group.position.z):0)+0.10))p.falling=false;}
    else if(p.kind==="tokoyo"&&p.api.update)p.api.update(t,dt);
  });
  // 収集: 近づくだけで手に入る(タップ不要・スマホ配慮)
  if(S.collect){
    let remain=0;
    S.collect.items.forEach(it=>{
      if(it.got)return;
      if(it.api.update)it.api.update(t,dt);
      const gp=it.api.group.position,d=Math.hypot(gp.x-player.pos.x,gp.z-player.pos.z);
      if(d<1.5){it.got=true;
        if(it.api.resolve)it.api.resolve();else it.api.group.visible=false;
        beep(880,.07,"triangle",.09);beep(1320,.09,"sine",.05);
        S.collect.onCollect(it.id);
        const left=S.collect?S.collect.items.filter(x=>!x.got).length:0;
        if(left>0)toast("あと "+left+" 枚",1400);
      }else remain++;
    });
    // 解決演出(縮んで消える)の後始末
    S.collect&&S.collect.items.forEach(it=>{if(it.got&&it.api.resolved&&it.api.group.parent)window.StoryObjects.disposeGroup(it.api.group);});
  }
  // 侵食20以上: 稀に旧仮名の揺らぎ
  if(erosionFx&&SM&&SM.state.params.brainErosion>=20&&Math.random()<dt*.08)erosionFx.flickerGlyph();
}
/* ---- 公開 ---- */
window.startStory=startStory;
window.storyUpdate=storyUpdate;
window.stExitToTitle=stExitToTitle;
/* ---- 隠しゲート: ?story=1 の時だけタイトルに入口を出す ---- */
function stGate(){
  let on=false;
  try{on=new URLSearchParams(location.search).get("story")==="1";}catch(e){}
  if(!on)return;
  const host=document.getElementById("mainModes");if(!host)return;
  const b=document.createElement("button");
  b.className="t-btn";b.id="btnStory";
  b.style.borderColor="rgba(185,165,230,.75)";
  b.innerHTML='<span class="mode-meta">物語 / 試験中</span><span>📖 御簾の向こうへ</span>';
  b.onclick=()=>{beep(700,.08);if(typeof initAudio==="function")initAudio();enterMode("story");};
  host.appendChild(b);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",stGate);
else stGate();
})();
