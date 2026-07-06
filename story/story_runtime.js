/* ============================================================
   波M: ストーリーモード「御簾の向こうへ」統合ランタイム(デモ版)
   ■ 入口: タイトルのメインメニュー最上段に「御簾の向こうへ（デモ版）」として常設。
     ?storyDebug=1 で隠しパラメータ表示。
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
  ED5_SPOOKY:{t:"ED5 Spooky End「百年の夢」", d:"見て見ぬふりを重ねた小さな過ちが、静かに積もっていた。名をなくした人は、物語にやさしく飼われます。<br><span style='color:#b9a5e6'>あなたの席は、まだ空いています。</span>"}
};
let SM=null,erosionFx=null;
function stEl(id){return document.getElementById(id);}
/* ---- 到達済みエンディングの永続化(回想の間のネタバレ防止に使う) ---- */
const ST_ENDINGS_KEY="shinden3d-story-endings-v1";
/* seq_603_select_ending の選択肢並び(ED1〜ED5)に対応する endingId */
const ST_ENDING_ORDER=["ED1_TRUE","ED2_NORMAL","ED3_GAMEOVER","ED4_SYNC","ED5_SPOOKY"];
function stLoadEndings(){try{const a=JSON.parse(localStorage.getItem(ST_ENDINGS_KEY));return Array.isArray(a)?a:[];}catch(e){return[];}}
function stSaveEnding(id){try{const a=stLoadEndings();if(id&&a.indexOf(id)<0){a.push(id);localStorage.setItem(ST_ENDINGS_KEY,JSON.stringify(a));}}catch(e){}}
/* ---- 波AG: テキスト速度(遅/普/速/瞬)。タイプライターのtick間隔msとして持つ(0=即時表示) ---- */
const ST_SPEED_KEY="shinden3d-story-textspeed-v1";
const ST_SPEEDS=[["遅",36],["普",24],["速",12],["瞬",0]];
let stSpeedIdx=1;
try{const s=parseInt(localStorage.getItem(ST_SPEED_KEY));if(s>=0&&s<ST_SPEEDS.length)stSpeedIdx=s;}catch(e){}
function stSpeedMs(){return ST_SPEEDS[stSpeedIdx][1];}
/* ---- 波AG: 既読管理。既読ノードではスキップ継続、未読到達でスキップ自動解除(市販VNの標準挙動) ---- */
const ST_READ_KEY="shinden3d-story-read-v1";
let stReadMap=null;
function stReadLoad(){if(stReadMap)return stReadMap;try{stReadMap=JSON.parse(localStorage.getItem(ST_READ_KEY))||{};}catch(e){stReadMap={};}return stReadMap;}
function stIsRead(ev){if(!ev||!ev.id||!SM)return false;return !!stReadLoad()[(SM.state.chapterId||0)+":"+ev.id];}
function stMarkRead(ev){if(!ev||!ev.id||!SM)return;const m=stReadLoad();const k=(SM.state.chapterId||0)+":"+ev.id;
  if(!m[k]){m[k]=1;try{localStorage.setItem(ST_READ_KEY,JSON.stringify(m));}catch(e){}}}
/* ---- 波AG: 話者ボイスブリップ。文字送り音を人物ごとの声色に(語り・心内は極小音) ---- */
const ST_VOICE={
  "小萩":[1560,"sine",.007],"小萩（独白）":[1500,"sine",.005],"栞":[1500,"sine",.007],"御簾の向こうの声":[1520,"sine",.006],
  "秀頼":[980,"triangle",.008],"秀頼（心）":[980,"triangle",.004],
  "右近":[1180,"square",.006],"左大臣":[620,"sine",.009],"判者":[700,"triangle",.008],
  "大鬼":[240,"square",.009],"水底の声":[300,"square",.008],"？？？":[1520,"sine",.005],
  "侍":[880,"square",.007],"姫君":[1440,"sine",.005],
  "語り":[1300,"square",.004]
};
/* ---- ED4「冠を深く被り直す」画面演出 ----
   一人称ゆえ冠そのものは映らない。画面上辺から降りる暗い翳り(#stCrownVeil)と、
   3D描画canvas(#c)のわずかな彩度低下で「外界の音が遠ざかる」感覚を表す。
   REDUCED_MOTION時はトランジションなしの即時適用。stCleanupSets/stExitToTitleで必ず解除。 */
function stSetCrownDeep(on){
  const reduced=(typeof REDUCED_MOTION!=="undefined"&&REDUCED_MOTION);
  const veil=stEl("stCrownVeil");if(veil)veil.style.transition=reduced?"none":"opacity 1.2s ease";
  const cv=document.getElementById("c");if(cv)cv.style.transition=reduced?"none":"filter 1.2s ease";
  document.body.classList.toggle("st-crown-deep",!!on);
}
/* ---- CSS/DOM 注入 ---- */
function stInject(){
  if(stEl("stBox"))return; // 注入済み(プレースホルダ#storyHudはHTMLに常設)
  const css=[
    "#storyHud{position:fixed;inset:0;z-index:55;pointer-events:none;display:none}",
    "#storyHud .st-chip{position:fixed;top:calc(env(safe-area-inset-top) + 6px);left:50%;transform:translateX(-50%);pointer-events:auto;",
    " background:linear-gradient(180deg,rgba(28,18,10,.94),rgba(16,10,6,.95));border:1px solid var(--kin);border-radius:7px;",
    " padding:4px 12px;color:#e6d9bb;font-size:12px;font-family:var(--serif);letter-spacing:.08em;white-space:nowrap}",
    "#storyHud .st-chip small{color:#9a8a6a;font-family:var(--sans);font-size:10px;margin-left:8px}",
    "#storyHud #stQuit{position:fixed;top:calc(env(safe-area-inset-top) + 6px);right:9px;pointer-events:auto;background:var(--urushi);",
    " color:var(--gofun);border:1px solid var(--kin);width:30px;height:30px;border-radius:50%;font-size:14px;line-height:1;cursor:pointer}",
    "#storyHud .st-box{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 10px);transform:translateX(-50%);",
    " width:min(720px,96vw);max-height:52vh;box-sizing:border-box;pointer-events:auto;background:linear-gradient(180deg,rgba(24,16,9,.96),rgba(13,9,5,.98));",
    " border:1px solid var(--kin);border-radius:11px;box-shadow:0 8px 30px rgba(0,0,0,.55);padding:10px 13px 12px;display:none}",
    "#storyHud .st-spk{font-size:11px;color:var(--kin);letter-spacing:.14em;margin-bottom:5px;font-family:var(--serif);padding-right:150px}",
    /* 本文をタップで送る(領域全体が送りボタン)。末尾に小さな▼ */
    "#storyHud .st-text{font-size:14px;line-height:1.82;color:#efe6cd;font-family:var(--serif);letter-spacing:.04em;overflow-y:auto;max-height:30vh;cursor:pointer}",
    "#storyHud .st-text.tapadv::after{content:'　▼';color:var(--kin);font-size:12px;animation:stBlink 1.1s infinite}",
    "@keyframes stBlink{0%,100%{opacity:.3}50%{opacity:1}}",
    /* VN操作(オート/スキップ/ログ) — 窓の右上に小さく */
    "#storyHud .st-vn{position:absolute;top:7px;right:9px;display:flex;gap:5px}",
    "#storyHud .st-vn button{pointer-events:auto;background:rgba(28,18,10,.92);border:1px solid rgba(201,162,63,.55);color:#cbb98f;",
    " font-size:9.5px;padding:3px 8px;border-radius:9px;cursor:pointer;font-family:var(--sans);letter-spacing:.08em;line-height:1}",
    "#storyHud .st-vn button.on{background:#5c4716;color:#ffe9a8;border-color:var(--kin)}",
    /* 立ち絵(Canvas描画の胸像)。表示中は本文を右へ寄せる */
    "#storyHud .st-box.with-face{padding-left:106px;min-height:104px}",
    "#stFace{position:absolute;left:10px;bottom:10px;width:86px;height:86px;border-radius:9px;border:1px solid var(--kin);",
    " background:#141009;display:none;box-shadow:0 3px 10px rgba(0,0,0,.5);object-fit:cover}",
    /* 波AH: 立ち絵リアクション(表情に応じた軽いCSS。次の台詞でクラスを外してリセット) */
    "#stFace.st-face-sad{filter:saturate(.8) brightness(.95)}",
    "#stFace.st-face-smile{filter:brightness(1.06)}",
    "#stFace.st-face-stern{filter:brightness(.94)}",
    "#stFace.st-face-surprise{animation:stFaceBounce .42s ease}",
    "@keyframes stFaceBounce{0%{transform:translateY(0)}30%{transform:translateY(-6px)}55%{transform:translateY(0)}74%{transform:translateY(-2px)}100%{transform:translateY(0)}}",
    /* 記録の間(手動セーブスロット): スロットごとに1行。情報+小さな操作ボタン群 */
    "#storyHud .st-slot-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;justify-content:space-between;",
    " border-bottom:1px solid rgba(201,162,63,.22);padding:8px 2px}",
    "#storyHud .st-slot-info{font-size:11.5px;color:#e0d4b4;flex:1 1 100%;line-height:1.55;text-align:left}",
    "#storyHud .st-slot-info b{color:var(--kin);margin-right:6px;letter-spacing:.06em}",
    "#storyHud .st-slot-empty{color:#9a8f7a}",
    "#storyHud .st-slot-acts{display:flex;gap:6px;flex:1 1 auto;justify-content:flex-end}",
    "#storyHud .st-slot-btn{min-height:0;padding:6px 12px;font-size:11.5px;flex:0 0 auto;text-align:center}",
    "#storyHud .st-slot-btn.dim{opacity:.5;filter:grayscale(.4)}", /* 保存不可の局面のヒント(押下時はtoastで説明) */
    "#storyHud .st-slot-btn.arm{background:linear-gradient(155deg,#6a1414,#3a0a0a);border-color:#e07a6a;color:#ffd9cf}",
    "#storyHud .st-slot-note{color:#c8a2a2;font-size:11px;margin-bottom:8px;text-align:left;line-height:1.5}",
    /* ログ一覧 */
    "#storyHud .st-log-item{text-align:left;border-bottom:1px solid rgba(201,162,63,.22);padding:7px 2px}",
    "#storyHud .st-log-item b{color:var(--kin);font-size:11px;display:block;margin-bottom:2px}",
    "#storyHud .st-log-item span{font-size:12.5px;color:#e0d4b4;line-height:1.7}",
    "#storyHud .st-next{display:none}", /* 次へボタンは廃止(本文タップで送る) */
    /* 選択肢: 縦画面ではみ出さないよう窓内でスクロール */
    "#storyHud .st-opts{display:flex;flex-direction:column;gap:7px;margin-top:9px;overflow-y:auto;max-height:34vh}",
    "#storyHud .st-opt{cursor:pointer;background:linear-gradient(155deg,#4a1f14,#311309);color:var(--gofun);",
    " border:1px solid var(--kin);padding:9px 13px;font-size:12.5px;border-radius:6px;letter-spacing:.04em;font-family:var(--serif);",
    " text-align:left;min-height:42px;line-height:1.45;flex:0 0 auto}",
    "#storyHud .st-opt:hover{filter:brightness(1.15)}",
    /* 回想の間: 未到達の結末は押せない伏せ札に(ネタバレ防止) */
    "#storyHud .st-opt.locked{opacity:.5;cursor:default;filter:grayscale(.7);color:#9a8f7a;",
    " background:linear-gradient(155deg,#2a2420,#1c1814);border-color:rgba(120,110,90,.5)}",
    "#storyHud .st-opt.locked:hover{filter:grayscale(.7)}",
    "#storyHud .st-opt.st-opt-back{background:linear-gradient(155deg,#2f2a20,#1c1810);color:#cbb98f;text-align:center}",
    /* ED4: 冠を深く被り直す翳り。上辺から降りる暗さ+canvasの彩度低下 */
    "#stCrownVeil{position:fixed;inset:0;z-index:45;pointer-events:none;opacity:0;",
    " background:linear-gradient(180deg,rgba(6,4,10,.82),rgba(6,4,10,.5) 26%,rgba(6,4,10,0) 58%)}",
    "body.st-crown-deep #stCrownVeil{opacity:1}",
    "body.st-crown-deep #c{filter:saturate(.72) brightness(.92)}",
    /* 波AG/AI: 章題カットイン(縦書き)。表示中はタップを吸い込み、下の台詞送りが誤爆しないようにする */
    "#stChCard{position:fixed;inset:0;z-index:58;pointer-events:none;display:flex;align-items:center;justify-content:center;",
    " background:rgba(8,5,3,.86);opacity:0;transition:opacity .55s ease}",
    "#stChCard.show{opacity:1;pointer-events:auto}",
    "#stChCard .st-ch-v{writing-mode:vertical-rl;font-family:var(--serif);color:#efe6cd;letter-spacing:.34em;",
    " display:flex;gap:26px;align-items:center}",
    "#stChCard .st-ch-no{font-size:15px;color:#cbb98f}",
    "#stChCard .st-ch-title{font-size:24px;text-shadow:0 0 18px rgba(201,162,63,.25)}",
    "#stChCard .st-ch-season{font-size:13px;color:#9a8a6a;border:1px solid rgba(201,162,63,.45);border-radius:50%;",
    " width:34px;height:34px;display:flex;align-items:center;justify-content:center;writing-mode:horizontal-tb}",
    /* 波AG: 既読マーク(話者名の横にさりげなく) */
    "#storyHud .st-read{color:#7a6a4a;font-size:9px;margin-left:7px;letter-spacing:0}",
    /* 波AG: ED1の朝光——画面右上からの柔らかい暖色光(白フェードとは別レイヤー) */
    "#stEd1Glow{position:fixed;inset:0;z-index:44;pointer-events:none;opacity:0;transition:opacity 2.4s ease;",
    " background:radial-gradient(ellipse 90% 70% at 84% 8%,rgba(255,238,196,.34),rgba(255,238,196,.10) 45%,transparent 72%)}",
    "body.st-ed1-glow #stEd1Glow{opacity:1}",
    /* 波AL: 2話——名がほどけ、渡殿や遣水の輪郭が陽炎のように滲む */
    "body.st-haze #c{animation:stHazePulse 2.6s ease-in-out infinite}",
    "@keyframes stHazePulse{0%,100%{filter:blur(1.4px) saturate(.94)}50%{filter:blur(3px) saturate(.88)}}",
    /* 波AJ: ED5——3Dの質感が剥がれ、世界が白黒の線画(教科書の挿絵)に潰されていく */
    "body.st-ed5-lineart #c{filter:grayscale(1) contrast(1.75) brightness(1.12);transition:filter 6s ease}",
    /* 波Z/AI: 名を呼ぶ選択肢/台詞の崩れ(常世が名を拒むような不穏なグリッチ)。
       波AI: 実機で文字が判読できてしまっていたため、強いぼかし+透過+ジッターで完全に読めなくする
       (以前の強化が埋め込みコピー側にだけ入っておりソース再埋め込みで消えていた——ソースへ正しく反映) */
    "#storyHud .st-glitch{position:relative;display:inline-block;filter:blur(7px) saturate(.55);opacity:.55;animation:stGlitchJitter 2.4s infinite steps(1)}",
    "#storyHud .st-glitch::before,#storyHud .st-glitch::after{content:attr(data-text);position:absolute;left:0;top:0;width:100%;overflow:hidden;background:inherit}",
    "#storyHud .st-glitch::before{color:#ff3b5c;clip-path:inset(0 0 60% 0);animation:stGlitchA 2.6s infinite linear}",
    "#storyHud .st-glitch::after{color:#3bdcff;clip-path:inset(60% 0 0 0);animation:stGlitchB 3.1s infinite linear}",
    "@keyframes stGlitchA{0%,90%,100%{transform:translate(0,0)}91%{transform:translate(2px,-1px)}93%{transform:translate(-2px,1px)}95%{transform:translate(1px,1px)}}",
    "@keyframes stGlitchB{0%,88%,100%{transform:translate(0,0)}89%{transform:translate(-2px,1px)}92%{transform:translate(2px,-1px)}94%{transform:translate(-1px,-1px)}}",
    "@keyframes stGlitchJitter{0%,100%{transform:translate(0,0) scaleX(1)}20%{transform:translate(-2px,1px) scaleX(1.05)}40%{transform:translate(2px,-1px) scaleX(.95)}60%{transform:translate(-1px,-1px) scaleX(1.04)}80%{transform:translate(1px,2px) scaleX(.97)}}",
    "#storyHud .st-box.choosing{max-height:70vh}", /* 選択肢表示中は窓を広げる */
    "#storyHud .st-panel{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;pointer-events:auto;",
    " background:radial-gradient(ellipse at center,rgba(10,7,4,.82),rgba(6,4,2,.96))}", /* 侵食演出(z52)より前面。ED5でも必ず読める */
    "#storyHud .st-card{width:min(460px,92vw);max-height:84vh;overflow-y:auto;background:linear-gradient(180deg,rgba(28,19,11,.98),rgba(15,10,6,.99));",
    " border:1px solid var(--kin);border-radius:14px;box-shadow:0 14px 50px rgba(0,0,0,.7);padding:22px 20px;text-align:center}",
    "#storyHud .st-card h3{margin:0 0 10px;color:var(--kin);font-family:var(--serif);font-size:18px;letter-spacing:.1em}",
    "#storyHud .st-card .st-body{font-size:12.5px;color:#e0d4b4;line-height:1.9;font-family:var(--serif);margin-bottom:14px}",
    "#storyHud .st-card .st-btns{display:flex;flex-direction:column;gap:8px}",
    "#storyFade{position:fixed;inset:0;z-index:46;pointer-events:none;opacity:0;background:#000;transition:opacity .9s ease .12s}",
    "#storyFade.white{background:#f2ead8}",
    "#storyFade.show{opacity:1;transition:opacity 0s}",
    "#storyFade.quick{transition:opacity .12s ease}",
    "body.story-mode #modeBrief{display:none}",
    /* 物語中は既存トップバーを隠し、章チップ+✕の専用バーだけにする(被り解消) */
    "body.story-mode #topbar{display:none!important}",
    "body.story-mode #worldStatusBar{display:none!important}",
    "#storyHud .st-chip{flex-direction:column;display:flex;align-items:center}",
    "#storyHud .st-chip .st-goal{display:block;font-size:10px;color:#b9a888;font-family:var(--sans);letter-spacing:.04em;margin-top:1px}"
  ].join("\n");
  const st=document.createElement("style");st.id="storyCss";st.textContent=css;document.head.appendChild(st);
  let hud=stEl("storyHud");
  if(!hud){hud=document.createElement("div");hud.id="storyHud";document.body.appendChild(hud);}
  hud.innerHTML=
    '<div class="st-chip"><span><span id="stChTitle">物語</span><small id="stDebug"></small><small id="stProg" style="color:#cbb98f;margin-left:8px"></small></span><span class="st-goal" id="stGoal"></span></div>'+
    '<button id="stMenuBtn" title="中断して章メニューへ(進行は自動保存)" style="position:fixed;top:calc(env(safe-area-inset-top) + 6px);right:46px;pointer-events:auto;background:var(--urushi);color:var(--gofun);border:1px solid var(--kin);width:30px;height:30px;border-radius:50%;font-size:13px;line-height:1;cursor:pointer">📑</button>'+
    '<button id="stQuit" title="物語を閉じる">✕</button>'+
    '<div class="st-box" id="stBox"><img id="stFace" alt="">'+
    '<div class="st-vn"><button id="stAuto">オート</button><button id="stSkip">スキップ</button><button id="stSpeed" title="文字送りの速さ">普</button><button id="stLog">ログ</button></div>'+
    '<div class="st-spk" id="stSpk"></div><div class="st-text" id="stText"></div>'+
    '<div class="st-next" id="stNextWrap"><button id="stNext">つぎへ ▶</button></div><div class="st-opts" id="stOpts"></div></div>'+
    '<div class="st-panel" id="stPanel"><div class="st-card"><h3 id="stPanelTitle"></h3><div class="st-body" id="stPanelBody"></div><div class="st-btns" id="stPanelBtns"></div></div></div>';
  const fade=document.createElement("div");fade.id="storyFade";document.body.appendChild(fade);
  const crownVeil=document.createElement("div");crownVeil.id="stCrownVeil";document.body.appendChild(crownVeil); // ED4の翳り
  const ed1Glow=document.createElement("div");ed1Glow.id="stEd1Glow";document.body.appendChild(ed1Glow); // ED1の朝光
  stEl("stQuit").onclick=()=>{beep(440,.06);stExitToTitle();};
  stEl("stMenuBtn").onclick=()=>{beep(560,.05);stVnStop();stChapterMenu();};
  stEl("stAuto").onclick=()=>{const v=APP.story&&APP.story.vn;if(!v)return;v.auto=!v.auto;v.skip=false;stVnButtons();
    if(v.auto&&v.curEv)stVnSchedule(v.curEv);else clearTimeout(window._stAutoT);beep(620,.04);};
  stEl("stSkip").onclick=()=>{const v=APP.story&&APP.story.vn;if(!v)return;v.skip=!v.skip;v.auto=false;stVnButtons();
    if(v.skip&&v.curEv){clearTimeout(window._stAutoT);window._stAutoT=setTimeout(()=>stVnAdvance(),90);}beep(620,.04);};
  stEl("stLog").onclick=()=>{stVnShowLog();beep(560,.04);};
  stEl("stSpeed").onclick=()=>{ // 波AG: 文字送り速度を4段階でサイクル(永続化)
    stSpeedIdx=(stSpeedIdx+1)%ST_SPEEDS.length;
    try{localStorage.setItem(ST_SPEED_KEY,String(stSpeedIdx));}catch(e){}
    stVnButtons();beep(700,.04);
  };
}
/* ---- VN補助(オート/スキップ/ログ) ---- */
function stVnButtons(){
  const v=APP.story&&APP.story.vn;if(!v)return;
  stEl("stAuto").classList.toggle("on",!!v.auto);
  stEl("stSkip").classList.toggle("on",!!v.skip);
  const sp=stEl("stSpeed");if(sp){sp.textContent=ST_SPEEDS[stSpeedIdx][0];sp.classList.toggle("on",stSpeedIdx!==1);} // 既定(普)以外は点灯
}
function stVnStop(){ // 選択肢・試練・パネルではスキップを解除
  const v=APP.story&&APP.story.vn;if(!v)return;
  v.skip=false;v.curEv=null;clearTimeout(window._stAutoT);stVnButtons();
}
function stVnAdvance(){
  const v=APP.story&&APP.story.vn;if(!v||!v.curEv)return;
  if(APP.mode!=="story"||stEl("stPanel").style.display==="flex")return;
  const ev=v.curEv;v.curEv=null;SM.goNext(ev.next);
}
function stVnSchedule(ev){
  const v=APP.story&&APP.story.vn;if(!v)return;
  clearTimeout(window._stAutoT);
  if(v.skip)window._stAutoT=setTimeout(()=>stVnAdvance(),90);
  else if(v.auto)window._stAutoT=setTimeout(()=>stVnAdvance(),1100+Math.min(6500,(ev.text||"").length*58));
}
function stVnShowLog(chId){
  const v=APP.story&&APP.story.vn;if(!v)return;
  clearTimeout(window._stAutoT);
  const curCh=(SM&&SM.chapter?SM.chapter.chapterId:0);
  const ch=(chId!=null)?chId:curCh;
  const man=(window.STORY_EMBED&&STORY_EMBED.manifest&&STORY_EMBED.manifest.chapters)||[];
  // 章タブ(この物語で語られた章のみ)
  const chapters=[...new Set(v.log.map(e=>e.ch||0))].filter(c=>c>0).sort((a,b)=>a-b);
  const tabs=chapters.map(c=>{
    const t=(man.find(m=>m.chapterId===c)||{}).chapterTitle||("第"+c+"話");
    return '<button class="st-opt" style="display:inline-block;width:auto;min-height:0;padding:5px 10px;margin:0 4px 6px 0;font-size:11px;'+
      (c===ch?'background:#5c4716;border-color:var(--kin)':'')+'" onclick="window.__stLog('+c+')">第'+c+'話</button>';
  }).join("");
  const items=v.log.filter(e=>(e.ch||0)===ch);
  const html=(items.length?items:[{s:"",t:"(この話ではまだ何も語られていません)"}])
    .map(e=>'<div class="st-log-item"><b>'+(e.s||"語り")+'</b><span>'+String(e.t).replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]))+'</span></div>').join("");
  stPanel("ログ — 第"+ch+"話",
    '<div style="text-align:left;margin-bottom:6px">'+(tabs||"")+'</div>'+
    '<div id="stLogScroll" style="max-height:48vh;overflow-y:auto;text-align:left">'+html+'</div>',
    [["とじる",()=>{const vv=APP.story&&APP.story.vn;if(vv&&vv.auto&&vv.curEv)stVnSchedule(vv.curEv);}]]);
  // 開いた瞬間に最後のメッセージまでスクロール
  requestAnimationFrame(()=>{const sc=stEl("stLogScroll");if(sc)sc.scrollTop=sc.scrollHeight;});
}
window.__stLog=function(c){stVnShowLog(c);};
/* ---- 物語モードの当たり判定(押し出し式・絶対に嵌まらない) ----
   本体の移動処理から毎フレーム window.storySolidResolve(x,z) と window.storyBoundClamp(x,z) が呼ばれる。
   ・storySolidResolve: 目標地点が障害物円 {x,z,r} の中なら、必ず円の外へ放射状に押し出す(双方向)。
     もし現在地が円内に埋まっていても、外へ向かう移動は許容されるため決して閉じ込めない。
   ・storyBoundClamp: 歩行可能域(円形)の外へ出ようとしたら内側へ引き戻す。高欄の外や敷地外への
     落下・迷子を根絶する。 */
window.STORY_SOLIDS=[];
window.STORY_BOUND={x:0,z:8,r:44}; // 舞台ごとに更新する歩行可能域(既定=南庭中心)
/* 障害物は円 {x,z,r} または矩形(壁・建物) {x,z,hw,hd} を混在可。
   矩形は最も近い辺の外へ押し出すので、建物の壁・柱をすり抜けられない。 */
window.storySolidResolve=function(x,z){
  const S=window.STORY_SOLIDS;if(!S||!S.length)return {x,z};
  for(let it=0;it<5;it++){
    let moved=false;
    for(let i=0;i<S.length;i++){
      const o=S[i];
      if(o.hw!=null){ // 矩形(壁)
        const ax=Math.abs(x-o.x),az=Math.abs(z-o.z);
        if(ax<o.hw-1e-4&&az<o.hd-1e-4){
          const px=o.hw-ax,pz=o.hd-az; // 各辺までの侵入深さ
          if(px<pz)x=o.x+Math.sign(x-o.x||1)*o.hw;
          else z=o.z+Math.sign(z-o.z||1)*o.hd;
          moved=true;
        }
      }else{ // 円
        const dx=x-o.x,dz=z-o.z,d2=dx*dx+dz*dz;
        if(d2<o.r*o.r-1e-4){
          if(d2<1e-6){x=o.x+o.r;z=o.z;} // ちょうど中心: 既定方向(+x)へ押し出す
          else{const d=Math.sqrt(d2);x=o.x+dx/d*o.r;z=o.z+dz/d*o.r;}
          moved=true;
        }
      }
    }
    if(!moved)break;
  }
  return {x,z};
};
window.storyBoundClamp=function(x,z){
  const B=window.STORY_BOUND;if(!B)return {x,z};
  const dx=x-B.x,dz=z-B.z,d=Math.hypot(dx,dz);
  if(d>B.r){x=B.x+dx/d*B.r;z=B.z+dz/d*B.r;}
  return {x,z};
};
/* 章開始時に、その舞台の主要な固形物を障害物として登録する。
   寝殿(母屋核)・三対屋・小萩の気配の間・南庭の主だった立木/灯籠 を円で覆う。
   歩行可能域(BOUND)は南庭を広くカバーし、池・敷地外への落下を防ぐ。 */
function stBuildSolids(){
  const S=[];
  // ── 建物本体を「壁」として矩形化。すり抜け不可。プレイヤーは南庭を歩き、建物を回り込む ──
  // 寝殿(母屋の核のみ)。南面の簀子・廂は開放し、南庭から出入りできるようにする
  // (旧: hd8.6で南端z6.6まで塞ぎ、playerStartや札の出現点を囲い込んで進行不能にしていた)
  S.push({x:0,z:-4.5,hw:13.6,hd:6.1});
  // 三つの対屋
  S.push({x:35,z:-12,hw:10,hd:7});S.push({x:-35,z:-12,hw:10,hd:7});S.push({x:0,z:-39,hw:11,hd:6.5});
  // 中門廊(南へ伸びる細い廊)
  S.push({x:24,z:12,hw:2.2,hd:9});S.push({x:-24,z:12,hw:2.2,hd:9});
  // 南庭の篝火・大石・主要な立木(円)。収集カード座標は避けてある
  [[9,9],[-10,11],[13,17],[-15,19],[7,23],[-7,27],[18,28],[-19,30]].forEach(p=>S.push({x:p[0],z:p[1],r:1.3}));
  window.STORY_SOLIDS=S;
  window.STORY_BOUND={x:0,z:12,r:46}; // 南庭中心・広め。池の外縁や築地の外へは出られない
}
/* 常世(第5話)は北の対エリアが舞台。障害物と歩行域を切り替える */
function stBuildSolidsTokoyo(){
  window.STORY_SOLIDS=[
    {x:35,z:-12,hw:9,hd:6.5},{x:-35,z:-12,hw:9,hd:6.5},{x:0,z:-39,hw:10,hd:6}
  ];
  window.STORY_BOUND={x:26,z:-42,r:28}; // 北の対〜ボス広場一帯
}
/* 教室など内装セット中は移動を極小域に閉じる(カメラは固定、歩き回らせない) */
function stBuildSolidsRoom(cx,cz){
  window.STORY_SOLIDS=[];
  window.STORY_BOUND={x:cx,z:cz,r:3.0};
}
/* ---- 立ち絵(Canvas描画・アセット不要) ----
   小萩だけは顔を見せない(御簾越しの影+薄紫の紐)。 */
const ST_FACE_CACHE={};
function stFaceUrl(key){
  if(ST_FACE_CACHE[key]!==undefined)return ST_FACE_CACHE[key];
  const c=document.createElement("canvas");c.width=172;c.height=172;const x=c.getContext("2d");
  const bg=(g1,g2)=>{const gr=x.createLinearGradient(0,0,0,172);gr.addColorStop(0,g1);gr.addColorStop(1,g2);x.fillStyle=gr;x.fillRect(0,0,172,172);};
  const face=(fx,fy,r,skin="#f0d5bd")=>{x.fillStyle=skin;x.beginPath();x.ellipse(fx,fy,r*.82,r,0,0,7);x.fill();};
  const eyes=(fx,fy,w,open=1,dy=0)=>{x.strokeStyle="#241a14";x.lineWidth=3;x.lineCap="round";
    [-1,1].forEach(s=>{x.beginPath();
      if(open>0.5){x.ellipse(fx+s*w,fy+dy,5.5,4*open,0,0,7);x.fillStyle="#241a14";x.fill();}
      else{x.moveTo(fx+s*w-6,fy+dy);x.quadraticCurveTo(fx+s*w,fy+dy+4,fx+s*w+6,fy+dy);x.stroke();}});};
  const brows=(fx,fy,w,tilt=0)=>{x.strokeStyle="#2a1c12";x.lineWidth=3.4;
    [-1,1].forEach(s=>{x.beginPath();x.moveTo(fx+s*w-7,fy-14+s*tilt);x.quadraticCurveTo(fx+s*w,fy-18,fx+s*w+7,fy-14-s*tilt);x.stroke();});};
  const mouth=(fx,fy,w,smile=0)=>{x.strokeStyle="#8a4038";x.lineWidth=2.6;x.beginPath();
    x.moveTo(fx-w,fy);x.quadraticCurveTo(fx,fy+smile*7,fx+w,fy);x.stroke();};
  if(key==="kohagi"){ // 御簾越しの影(顔は決して描かない)
    bg("#2a1f2e","#171019");
    x.fillStyle="rgba(46,30,44,.9)";x.beginPath();x.ellipse(86,150,52,58,0,Math.PI,0);x.fill(); // 肩
    x.beginPath();x.ellipse(86,86,30,36,0,0,7);x.fill();                                          // 頭影
    x.fillStyle="rgba(20,12,20,.85)";x.fillRect(52,96,68,60);                                     // 垂髪影
    x.strokeStyle="rgba(185,165,230,.9)";x.lineWidth=3;                                            // 薄紫の紐
    x.beginPath();x.moveTo(120,132);x.quadraticCurveTo(126,146,120,160);x.stroke();
    x.beginPath();x.arc(120,130,4,0,7);x.fillStyle="#b9a5e6";x.fill();
    x.strokeStyle="rgba(201,180,120,.5)";x.lineWidth=2.4;                                          // 御簾の簾線
    for(let i=0;i<=8;i++){x.beginPath();x.moveTo(6+i*20,0);x.lineTo(6+i*20,172);x.stroke();}
    x.fillStyle="rgba(240,228,190,.10)";x.fillRect(0,0,172,172);
  }else if(key==="hidetora"){
    bg("#31425e","#1a2334");
    x.fillStyle="#4a6fa8";x.beginPath();x.ellipse(86,168,62,44,0,Math.PI,0);x.fill();             // 直衣の肩
    x.fillStyle="#e9dfc8";x.fillRect(80,128,12,14);                                                // 襟
    face(86,92,42);
    x.fillStyle="#14100e";x.beginPath();x.ellipse(86,64,40,26,0,Math.PI,0);x.fill();              // 前髪
    x.fillStyle="#17130f";x.save();x.translate(86,42);x.rotate(-.14);x.fillRect(-20,-16,40,20);x.restore(); // ずれた冠
    x.fillRect(78,18,8,16);
    brows(86,86,17,2);eyes(86,90,17,1);mouth(86,118,10,-1);
  }else if(key==="ukon"){
    bg("#3c4a30","#1d2417");
    x.fillStyle="#55633f";x.beginPath();x.ellipse(86,168,62,42,0,Math.PI,0);x.fill();
    face(86,94,41,"#e8c9a4");
    x.fillStyle="#191512";x.beginPath();x.ellipse(86,66,38,24,0,Math.PI,0);x.fill();
    x.fillStyle="#17130f";x.beginPath();x.moveTo(66,44);x.lineTo(106,44);x.lineTo(96,10);x.lineTo(76,12);x.closePath();x.fill(); // 烏帽子
    brows(86,88,17,-3);eyes(86,92,17,1);mouth(86,118,13,6);                                       // にやり
    x.strokeStyle="#2a1c12";x.lineWidth=2;x.beginPath();x.moveTo(74,128);x.lineTo(98,128);x.stroke(); // あごの影
  }else if(key==="minister"){
    bg("#3a2a52","#1c1330");
    x.fillStyle="#432a66";x.beginPath();x.ellipse(86,170,66,46,0,Math.PI,0);x.fill();
    x.fillStyle="#c9a23f";x.fillRect(80,132,12,12);
    face(86,94,43,"#e6c6a0");
    x.fillStyle="#26201a";x.beginPath();x.ellipse(86,64,40,24,0,Math.PI,0);x.fill();
    x.fillStyle="#17130f";x.fillRect(66,26,40,20);x.fillRect(80,6,10,22);                          // 冠+巾子
    brows(86,86,18,4);eyes(86,92,18,1);
    x.fillStyle="#3a2c20";x.beginPath();x.ellipse(86,124,16,10,0,0,7);x.fill();                    // 髭
    mouth(86,120,9,2);
  }else if(key==="judge"){
    bg("#3c3a46","#1c1a24");
    x.fillStyle="#4c4a55";x.beginPath();x.ellipse(86,170,62,44,0,Math.PI,0);x.fill();
    face(86,90,41,"#ecd2b0");
    x.fillStyle="#1c1712";x.beginPath();x.ellipse(86,62,38,23,0,Math.PI,0);x.fill();
    x.fillStyle="#17130f";x.fillRect(70,26,32,18);
    brows(86,84,17,0);eyes(86,88,17,1);
    x.fillStyle="#efe4c6";x.strokeStyle="#8a6a40";x.lineWidth=2;                                    // 檜扇(口元を隠す)
    x.beginPath();x.moveTo(36,150);x.lineTo(86,102);x.lineTo(140,144);x.quadraticCurveTo(90,168,36,150);x.closePath();x.fill();x.stroke();
    for(let i=0;i<5;i++){x.beginPath();x.moveTo(86,104);x.lineTo(48+i*22,150);x.stroke();}
  }else if(key==="shiori"){
    // 波Z: セーラー服ではなくブレザー(紺・白シャツ襟・臙脂のリボン)。実際は icons/shiori.webp を使うため、
    // これは画像読込に失敗した時のみのフォールバック。
    bg("#4a5a70","#232d3c");
    x.fillStyle="#20304a";x.beginPath();x.ellipse(86,170,58,42,0,Math.PI,0);x.fill();             // 紺のブレザー
    x.fillStyle="#f2f5f8";x.beginPath();x.moveTo(58,150);x.lineTo(86,138);x.lineTo(114,150);x.lineTo(104,172);x.lineTo(68,172);x.closePath();x.fill(); // 白いシャツの襟
    x.fillStyle="#8a2030";x.fillRect(83,146,6,14);                                                 // 臙脂のリボン
    face(86,94,40,"#f4ddc4");
    x.fillStyle="#241f22";x.beginPath();x.ellipse(86,66,38,26,0,Math.PI,0);x.fill();              // 前髪
    x.fillRect(48,66,12,52);x.fillRect(112,66,12,52);                                              // ボブ
    brows(86,88,16,-2);eyes(86,92,16,1);mouth(86,116,9,4);
  }else if(key==="oni"){
    bg("#3a1210","#16060a");
    x.fillStyle="#7c1f1a";x.beginPath();x.ellipse(86,100,54,60,0,0,7);x.fill();
    x.fillStyle="#3a0f0e";[-1,1].forEach(s=>{x.beginPath();x.moveTo(86+s*30,44);x.lineTo(86+s*46,4);x.lineTo(86+s*16,36);x.closePath();x.fill();});
    x.fillStyle="#ffd23f";[-1,1].forEach(s=>{x.beginPath();x.ellipse(86+s*22,88,10,7,0,0,7);x.fill();});
    x.fillStyle="#16060a";[-1,1].forEach(s=>{x.beginPath();x.arc(86+s*22,88,3.4,0,7);x.fill();});
    x.strokeStyle="#2a0c0a";x.lineWidth=4;x.beginPath();x.moveTo(58,124);x.quadraticCurveTo(86,136,114,124);x.stroke();
    x.fillStyle="#eadbb8";[-1,1].forEach(s=>{x.beginPath();x.moveTo(86+s*14,126);x.lineTo(86+s*20,140);x.lineTo(86+s*8,128);x.closePath();x.fill();});
  }else{ST_FACE_CACHE[key]=null;return null;}
  ST_FACE_CACHE[key]=c.toDataURL("image/png");
  return ST_FACE_CACHE[key];
}
const ST_FACE_KEY={"小萩":"kohagi","秀頼":"hidetora","秀頼（心）":"hidetora","右近":"ukon","左大臣":"minister","判者":"judge","栞":"shiori","大鬼":"oni"};
/* 波Y: 描き下ろしアイコン(軽量WebP・相対パス参照。単一HTMLは肥大化させない) */
const ST_ICON_FILES={
  kohagi:"icons/kohagi_silhouette.webp",
  oni:"icons/hitodama_concept.webp", // 波AI: 大鬼=四季モード秋ボス(人魂→大鬼)のコンセプト画をアイコンに
  ukon:"icons/ukon.webp",
  minister:"icons/sadaijin_full.webp", // 波Z: 左大臣は素顔を通常アイコンに
  judge:"icons/sadaijin_fan.webp",     // 波Z: 判者は「扇で顔を隠す」役どころに合わせて扇の絵を専用に割当て
  shiori:"icons/shiori.webp",
  hidetora_neutral:"icons/hidetora_neutral.webp",
  hidetora_worried:"icons/hidetora_worried.webp",
  hidetora_blush:"icons/hidetora_blush.webp",
  hidetora_modern:"icons/hidetora_modern.webp"
};
function stHidetoraIcon(ev){
  const e=ev&&ev.emotes&&ev.emotes.hidetora;
  if(e&&ST_ICON_FILES["hidetora_"+e])return "hidetora_"+e;
  const S=APP.story;
  if(S&&S.classroom)return "hidetora_modern"; // 現代の教室シーンでは現在の彼の姿
  return "hidetora_neutral";
}
function stSetFace(spk,ev){
  const img=stEl("stFace"),box=stEl("stBox");if(!img)return;
  const key=ST_FACE_KEY[spk];
  let iconKey=key==="hidetora"?stHidetoraIcon(ev):key;
  const iconFile=iconKey?ST_ICON_FILES[iconKey]:null;
  const url=iconFile||(key?stFaceUrl(key):null); // 描き下ろしが無い話者(判者・大鬼)はCanvas影絵で代用
  if(url){img.src=url;img.style.display="block";box.classList.add("with-face");}
  else{img.style.display="none";box.classList.remove("with-face");}
  stFaceReact(spk,ev,img); // 立ち絵の軽いリアクション(表情に応じたCSS。次の台詞で必ずリセット)
}
/* 波AH: 立ち絵リアクション——dialogueノードの emotes に、話者に対応するアクターの表情が
   指定されている場合、立ち絵(#stFace)へ軽いCSSリアクションを添える。
   surprise=一瞬の小バウンス / sad=彩度を落とす / smile=ごく僅かに明るく / stern=僅かに暗く。
   話者→アクターは ST_SPEAKER_ACTOR(小萩→kohagi 等)、無ければ ST_FACE_KEY(秀頼→hidetora 等)で解決。
   REDUCED_MOTION 時はバウンスなし(色の変化のみ)。呼び出しのたび前回分を必ず外して次の台詞へ持ち越さない。 */
const ST_FACE_REACT_CLASSES=["st-face-surprise","st-face-sad","st-face-smile","st-face-stern"];
function stFaceReact(spk,ev,img){
  img=img||stEl("stFace");if(!img)return;
  ST_FACE_REACT_CLASSES.forEach(c=>img.classList.remove(c)); // 前の台詞のリアクションを必ずリセット
  if(!spk||!ev||!ev.emotes)return;
  const actorKey=ST_SPEAKER_ACTOR[spk]||ST_FACE_KEY[spk];
  const emote=actorKey&&ev.emotes[actorKey];
  if(!emote)return;
  const reduced=(typeof REDUCED_MOTION!=="undefined"&&REDUCED_MOTION);
  if(emote==="surprise"){ if(!reduced){void img.offsetWidth;img.classList.add("st-face-surprise");} } // リフロー強制で連続surpriseも再発火
  else if(emote==="sad")img.classList.add("st-face-sad");
  else if(emote==="smile")img.classList.add("st-face-smile");
  else if(emote==="stern")img.classList.add("st-face-stern");
  // neutral(や worried/blush 等の対象外表情)は変化なし
}
/* ---- 転換演出(波L互換・story専用要素) ---- */
function stFade(color){
  const el=stEl("storyFade");if(!el)return;
  el.style.transition="";el.style.opacity=""; // stSlowFadeToWhite等の一時的な直接指定を必ず解除
  el.className=(color==="white"?"white":"");
  el.classList.add("show");void el.offsetWidth;
  clearTimeout(window._stFadeT);
  window._stFadeT=setTimeout(()=>el.classList.remove("show"),(typeof REDUCED_MOTION!=="undefined"&&REDUCED_MOTION)?60:340);
}
/* 波Z: バッドエンド演出用——一瞬の切替でなく、ゆっくり白んでいく(ms=所要時間) */
function stSlowFadeToWhite(ms){
  const el=stEl("storyFade");if(!el)return;
  clearTimeout(window._stFadeT);
  el.className="white";el.classList.remove("show");
  el.style.transition="none";el.style.opacity="0";
  void el.offsetWidth;
  el.style.transition="opacity "+(ms/1000)+"s ease";
  el.style.opacity="1";
}
/* 波AA: ED3等——台詞だけを残し、トップバー/章メニュー/終了ボタンを一時的に隠す */
function stSetMinimalUi(on){
  ["stMenuBtn","stQuit"].forEach(id=>{const el=stEl(id);if(el)el.style.display=on?"none":"";});
  const chip=document.querySelector("#storyHud .st-chip");if(chip)chip.style.display=on?"none":"";
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
/* ---- 登場人物(StoryObjects) ----
   ■ 小萩は「決して姿を見せない」。立ち姿モデルは置かず、母屋南端に
     御簾+三方几帳の「気配の間」を建て、簾越しの座り影と薄紫の紐の光だけで存在を示す。
     背面・側面は不透明の几帳なので、どの角度から回り込んでも中は見えない。 */
function stKohagiStation(){
  const g=new THREE.Group();
  const kichoMat=new THREE.MeshStandardMaterial({color:0x6e3348,roughness:.86,side:THREE.DoubleSide});
  const kichoTop=new THREE.MeshStandardMaterial({color:0x4a3722,roughness:.8});
  // 前面: 御簾(既製の境界エフェクトを流用。connectで裾がほのかに光る)
  const misu=window.StoryObjects.createMisuBoundaryEffect(4.2,2.25);misu.setMood("veil");
  misu.group.position.z=1.18;g.add(misu.group);
  // 背面+側面: 不透明の几帳(回り込み対策)。上に横木
  const back=new THREE.Mesh(new THREE.PlaneGeometry(4.2,2.2),kichoMat);back.position.set(0,1.1,-0.62);g.add(back);
  [-1,1].forEach(s=>{const side=new THREE.Mesh(new THREE.PlaneGeometry(1.9,2.2),kichoMat);
    side.rotation.y=Math.PI/2;side.position.set(s*2.08,1.1,0.28);g.add(side);
    const bar=new THREE.Mesh(new THREE.BoxGeometry(.08,.1,1.95),kichoTop);bar.position.set(s*2.08,2.22,0.28);g.add(bar);});
  const backBar=new THREE.Mesh(new THREE.BoxGeometry(4.3,.1,.08),kichoTop);backBar.position.set(0,2.22,-0.62);g.add(backBar);
  // 簾越しの座り影(黒に近い、輪郭だけの人形)。misuの奥 z=0.3
  const silMat=new THREE.MeshBasicMaterial({color:0x1d1420,transparent:true,opacity:.5});
  const sil=new THREE.Group();
  const skirt=new THREE.Mesh(new THREE.CylinderGeometry(.34,.58,.62,12),silMat);skirt.position.y=.31;sil.add(skirt);
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.24,.33,.62,10),silMat);torso.position.y=.82;sil.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),silMat);head.position.y=1.28;sil.add(head);
  const hair=new THREE.Mesh(new THREE.BoxGeometry(.26,.72,.08),silMat);hair.position.set(0,.92,-.14);sil.add(hair);
  sil.position.set(0,0,0.30);g.add(sil);
  // 袖口の薄紫の紐(簾越しにこれだけ、ほんのり見える)
  const cordMat=new THREE.MeshBasicMaterial({color:0xb9a5e6,transparent:true,opacity:.85});
  const cord=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),cordMat);cord.position.set(.42,.72,.55);g.add(cord);
  g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
  g.position.set(0.6,1.30,0.55); // 母屋南端の内側(南縁z=1.8のすぐ内)
  g.visible=false;scene.add(g);
  let ghost=0,pulseT=0;
  return {
    group:g,
    /* 話す時のさざめき(影がわずかに揺れ、紐が瞬く) */
    pulse(){pulseT=performance.now()+1600;},
    /* 0=小萩 → 1=栞(影が青白く、制服の淡色へ)。shioriGhostフィールド互換名 */
    setShioriGhost(v){ghost=Math.max(0,Math.min(1,v));
      silMat.color.setHex(ghost>0.15?0x5a6478:0x1d1420);
      silMat.opacity=.5-ghost*.12;
      cordMat.opacity=.85;cord.scale.setScalar(1+ghost*.8);},
    update(t){
      const talking=performance.now()<pulseT;
      sil.position.y=Math.sin(t*1.05)*.012+(talking?Math.abs(Math.sin(t*7))*.015:0);
      sil.rotation.z=Math.sin(t*.7)*.012;
      cordMat.opacity=.6+Math.sin(t*(talking?6:1.6))*.3;
      misu.update(t);
    },
    setExpression(){}, // 互換(表情は影ゆえ持たない)
    setMood(m){misu.setMood(m);}
  };
}
function stSpawnActors(){
  const S=APP.story;if(S.actors)return;
  const SO=window.StoryObjects;if(!SO)return;
  const mk=(api,x,y,z,yaw)=>{api.group.position.set(x,y,z);api.group.rotation.y=yaw;api.group.userData.baseY=y;
    api.group.visible=false;scene.add(api.group);return api;};
  S.actors={
    kohagi:  stKohagiStation(), // 気配の間(姿は決して見せない)
    ukon:    mk(SO.createStoryUkonObject(),    1.9,1.20, 4.3,-2.60),
    minister:mk(SO.createMinisterObject(),     2.6,1.30,-2.2, 0.15),
    judge:   mk(SO.createUtakaiJudgeObject(),  -0.4,1.30,-1.85, 0.0) // 波AA: カメラ正面寄りへ(旧位置は画角の端で見切れがちだった)
  };
}
const ST_SPEAKER_ACTOR={ "小萩":"kohagi","右近":"ukon","左大臣":"minister","判者":"judge" };
/* ---- 演出フィールド適用(fade/fx/se/emotes/shioriGhost/stage/camera) ---- */
function stApplyPresentation(ev){
  if(!ev)return;
  if(ev.fade)stFade(ev.fade);
  if(ev.fx==="lightning")stLightning();
  if(ev.se&&typeof saigenSe==="function"){
    // 波AA/AG: スキップ/縮小モーション/速度「瞬」では全文が即表示されるため遅延させず即再生。
    // seDelayMsは24ms tick基準で調律されているので、速度設定に応じて遅延を比例伸縮する
    const iv=stSpeedMs();
    const instantText=(typeof REDUCED_MOTION!=="undefined"&&REDUCED_MOTION)||(APP.story&&APP.story.vn&&APP.story.vn.skip)||iv===0;
    if(ev.seDelayMs&&!instantText)setTimeout(()=>saigenSe(ev.se),Math.round(ev.seDelayMs*iv/24));
    else saigenSe(ev.se);
  }
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
      if(st.silence&&typeof SFX!=="undefined"&&SFX.duckAmbient)SFX.duckAmbient(4200); // 波AE: 破魔の連札直前の静寂(第5話)
      if(st.location==="classroom"||st.location==="hospital")APP.storyIndoor=true; // 波AA: 屋内では鳥・虫の環境音を止める
      else if(st.location)APP.storyIndoor=false;
      if(st.location==="classroom"){stEnsureClassroom(); // 波O: 現代教室セット(ED演出)
        if(typeof stBuildSolidsRoom==="function")stBuildSolidsRoom(player.pos.x,player.pos.z);} // 教室は移動を極小域に閉じる
      if(st.location==="hospital"){stEnsureHospital(); // 波W: 現実の病室(第6話 回想の間の枠)
        if(typeof stBuildSolidsRoom==="function")stBuildSolidsRoom(player.pos.x,player.pos.z);}
      if(st.location==="mansion"&&S.classroom){ // 教室→邸への帰還(第1話の転移)
        window.StoryObjects.disposeGroup(S.classroom.group);S.classroom=null;
      }
      if((st.location==="mansion"||st.location==="classroom")&&S.hospital){ // 病室→他所へ移ったら畳む
        window.StoryObjects.disposeGroup(S.hospital.group);S.hospital=null;
      }
      // ED4: 冠を深く被り直す=画面上辺からの翳り+彩度低下(一人称ゆえ冠は映さず、感覚で示す)
      if(st.crownState==="deep")stSetCrownDeep(true);
      else if(st.crownState!=null)stSetCrownDeep(false);
      // ED1: 机上に白い短冊と、添えられた薄紫の紐を実際に置いて寄る
      if(st.purpleCord)stPlaceEd1Tanzaku();
    }
  }
  if(ev.cameraAngleId)stCamera(ev.cameraAngleId);
  // 波AA: dialogue/choice/set_sceneノードからも直接エフェクトを起こせるようにする(専用effectノードを挟まず済む)。
  // カメラ切替の後に発火させ、カメラを使う演出(例:黒板への吸い込み)が新しい位置から正しく始まるようにする。
  // type:"effect"は既存のonEffectフックがstEffectを呼ぶため、二重発火を避けてここでは対象外にする。
  if(ev.effectId&&ev.type!=="effect"&&typeof stEffect==="function")stEffect({effectId:ev.effectId,payload:ev.effectPayload||{},event:ev});
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
/* 波Z: プレイヤー位置基準のカメラ切替(場所を問わないカット用。座標は現在地からの相対オフセット) */
function stCamRelative(posOff,lookOff,fov){
  const base=player.pos.clone();
  stCamAt([base.x+posOff[0],base.y+posOff[1],base.z+posOff[2]],
          [base.x+lookOff[0],base.y+lookOff[1],base.z+lookOff[2]],fov);
}
/* 波AA: 絶対座標を直接指定するカメラ切替(player.posが直前のカット移動で既にずれている場合の連鎖誤差を避ける) */
function stCamAt(pos,look,fov){
  APP.view="fp";
  if(typeof applySaigenCam==="function")applySaigenCam({pos,look});
  if(fov&&typeof camera!=="undefined"){camera.fov=fov;camera.updateProjectionMatrix();}
  if(typeof snapSaigenCamera==="function")snapSaigenCamera();
  if(typeof updateControlUI==="function")updateControlUI();
}
/* 波Z: カモメが上空を横切り、翼の下から白い紙が零れ落ちる一連の演出。onDrop(位置)は落下開始の合図 */
function stSeagullFlyover(anchor,onDrop){
  const S=APP.story;if(!S)return;
  if(typeof makeSeagull!=="function"){onDrop(new THREE.Vector3(anchor.x+0.6,anchor.y+4.5,anchor.z-1.2));return;}
  const base=anchor; // 波AA: カメラ移動で動くplayer.posではなく、演出開始時点の固定点を基準にする
  const startX=base.x-9,endX=base.x+9,flyY=base.y+6.8,flyZ=base.z-4;
  const g=makeSeagull(1.3);g.rotation.y=Math.PI/2;g.position.set(startX,flyY,flyZ);
  scene.add(g);
  let t=0;const dur=3.0;let dropped=false;
  S.seagullFly={
    group:g,
    update(dt){
      t+=dt;const p=Math.min(1,t/dur);
      g.position.x=startX+(endX-startX)*p;
      g.position.y=flyY+Math.sin(p*Math.PI)*1.1;
      const flap=Math.abs(Math.sin(t*7));
      g.children.forEach(ch=>{if(ch.userData&&ch.userData.wingSide)ch.rotation.z=ch.userData.wingSide*(.15+flap*.4);});
      if(!dropped&&p>=0.5){dropped=true;onDrop(g.position.clone());}
      if(p>=1){if(g.parent)scene.remove(g);S.seagullFly=null;}
    }
  };
}
/* ---- HUD描画 ---- */
/* 話者ごとの名札色(市販ノベル風のキャラ識別) */
const ST_SPK_COLOR={"小萩":"#c9a2d8","小萩（独白）":"#b9a5e6","秀頼":"#8fb8e8","秀頼（心）":"#7fa0c8","右近":"#a8c88a","左大臣":"#d8b25a","判者":"#b8b0c8","栞":"#9ec8e0","大鬼":"#e07a6a","水底の声":"#5ad0a0","御簾の向こうの声":"#d8c090","？？？":"#c0c0c0","侍":"#a0a890","姫君":"#e0b8c8"};
/* 波AA: 台詞中の特定の語だけをグリッチ表示にする(例: 名の秘密が思わず漏れる場面) */
function stEscapeHtml(s){return String(s).replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));}
function stRenderText(te,revealed,glitchWord){
  if(!glitchWord){te.textContent=revealed;return;}
  const idx=revealed.indexOf(glitchWord);
  if(idx<0){te.textContent=revealed;return;}
  const before=stEscapeHtml(revealed.slice(0,idx));
  const word=stEscapeHtml(glitchWord);
  const after=stEscapeHtml(revealed.slice(idx+glitchWord.length));
  te.innerHTML=before+'<span class="st-glitch" data-text="'+word+'">'+word+'</span>'+after;
}
function stShowDialogue(spk,text,ev){
  const box=stEl("stBox");box.style.display="block";box.classList.remove("choosing");
  stEl("stOpts").innerHTML="";
  const v=APP.story&&APP.story.vn;
  // 波AG: 既読管理——未読ノードに到達したらスキップを自動解除(市販VNの標準挙動)
  const wasRead=stIsRead(ev);
  if(v&&v.skip&&!wasRead){v.skip=false;stVnButtons();toast("未読の場面——スキップを解除しました",1500);}
  stMarkRead(ev);
  const sp=stEl("stSpk");
  sp.innerHTML="";
  sp.appendChild(document.createTextNode(spk?("— "+spk+" —"):"語り"));
  if(wasRead){const rm=document.createElement("span");rm.className="st-read";rm.textContent="✓";sp.appendChild(rm);} // 既読はさりげなく✓
  sp.style.color=ST_SPK_COLOR[spk]||"var(--kin)";
  const te=stEl("stText");
  const full=text||"";
  te.style.fontSize=(full.length>130)?"12.5px":"14px"; // 長文は一段小さく(切れ防止)
  te.scrollTop=0;
  stSetFace(spk,ev); // 立ち絵
  if(v){v.log.push({s:spk,t:full,ch:SM&&SM.chapter?SM.chapter.chapterId:0});if(v.log.length>300)v.log.shift();v.curEv=ev;}
  const actorKey=ST_SPEAKER_ACTOR[spk];
  if(actorKey&&APP.story&&APP.story.actors&&APP.story.actors[actorKey]){
    const a=APP.story.actors[actorKey];a.group.visible=true;
    if(a.pulse)a.pulse(); // 気配の間(小萩): 話す間だけ影が揺れ、紐が瞬く
    // 波AG: 小萩の台詞開始時、ごく小さな衣擦れの気配(スキップ中は鳴らさない)
    if(actorKey==="kohagi"&&!(v&&v.skip)&&typeof beep==="function"){
      beep(300,.22,"sine",.011);setTimeout(()=>beep(214,.28,"sine",.008),110);
    }
  }
  stProgRefresh();
  // ── タイプライター表示(市販ノベル風) ──
  clearInterval(window._stType);clearTimeout(window._stAutoT);
  te.classList.remove("tapadv");
  const reduced=(typeof REDUCED_MOTION!=="undefined"&&REDUCED_MOTION);
  let revealed=false;
  const onRevealDone=()=>{
    revealed=true;te.classList.add("tapadv");
    if(v&&v.skip)window._stAutoT=setTimeout(()=>stVnAdvance(),120);
    else if(v&&v.auto)window._stAutoT=setTimeout(()=>stVnAdvance(),900+Math.min(4200,full.length*45));
  };
  const glitchWord=ev&&ev.glitchWord;
  const iv=stSpeedMs(); // 波AG: テキスト速度設定(0=瞬時)
  if(reduced||(v&&v.skip)||iv===0){stRenderText(te,full,glitchWord);onRevealDone();}
  else{
    te.textContent="";let i=0,tick=0;
    const step=Math.max(1,Math.round(full.length/90)); // 長文は複数文字ずつで一定時間に収める
    const voice=ST_VOICE[spk]||[1400,"square",.008]; // 波AG: 話者ごとの声色(文字送り音)
    window._stType=setInterval(()=>{
      i+=step;stRenderText(te,full.slice(0,i),glitchWord);
      if((tick++%3)===0&&typeof beep==="function"&&voice[2]>0)beep(voice[0]*(0.97+Math.random()*.06),.006,voice[1],voice[2]);
      if(i>=full.length){clearInterval(window._stType);onRevealDone();}
    },iv);
  }
  // タップ: 表示中なら一括表示、表示済みなら次へ
  const tap=()=>{
    if(!revealed){clearInterval(window._stType);stRenderText(te,full,glitchWord);onRevealDone();return;}
    beep(600,.045,"triangle",.07);if(v)v.curEv=null;clearTimeout(window._stAutoT);clearInterval(window._stType);SM.goNext(ev.next);
  };
  te.onclick=tap;sp.onclick=tap;
}
/* 波AG: 章題カットイン——章開始時に縦書きの章題カードを約2.6秒。REDUCED_MOTIONは短く簡素に */
const ST_CH_NO=["","一","二","三","四","五","六"];
const ST_CH_SEASON={1:"春",2:"夏",3:"秋",4:"冬",5:"常",6:"朝"};
function stChapterCard(id){
  const man=(window.STORY_EMBED&&STORY_EMBED.manifest&&STORY_EMBED.manifest.chapters)||[];
  const ent=man.find(c=>c.chapterId===id);if(!ent)return;
  const reduced=(typeof REDUCED_MOTION!=="undefined"&&REDUCED_MOTION);
  let card=stEl("stChCard");
  if(!card){card=document.createElement("div");card.id="stChCard";document.body.appendChild(card);}
  card.innerHTML='<div class="st-ch-v">'+
    '<span class="st-ch-season">'+(ST_CH_SEASON[id]||"")+'</span>'+
    '<span class="st-ch-title">'+String(ent.chapterTitle).replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]))+'</span>'+
    '<span class="st-ch-no">第'+(ST_CH_NO[id]||id)+'話</span>'+
    '</div>';
  if(reduced)card.style.transition="none";
  clearTimeout(window._stChCardT);clearTimeout(window._stChCardT2);
  card.classList.add("show");
  card.onclick=()=>{clearTimeout(window._stChCardT);card.classList.remove("show");}; // 波AI: タップは「カードを早めに閉じる」だけ。下の台詞へは絶対に透過させない
  if(typeof saigenSe==="function")saigenSe("koto");
  window._stChCardT=setTimeout(()=>card.classList.remove("show"),reduced?1100:2600);
}
/* 章内の現在位置(場 x/y)をチップに出す */
function stProgRefresh(){
  const el=stEl("stProg");if(!el||!SM||!SM.chapter)return;
  const seq=SM.chapter.startSequence,idx=seq.findIndex(e=>e.id===SM.currentSequenceId);
  el.textContent=idx>=0?("場 "+(idx+1)+"/"+seq.length):"";
}
function stShowChoice(text,options,ev){
  stVnStop(); // 選択肢ではオート/スキップを止める
  const box=stEl("stBox");box.style.display="block";box.classList.add("choosing");
  stEl("stSpk").textContent="選べ";
  stSetFace(null);
  const v=APP.story&&APP.story.vn;if(v)v.log.push({s:"選択",t:text,ch:SM&&SM.chapter?SM.chapter.chapterId:0});
  stProgRefresh();
  const te=stEl("stText");te.textContent=text||"";te.classList.remove("tapadv");te.onclick=null;
  // 波O: 破魔の連札(第5話最終3問)は3D札を眼前に浮かべ、選択と連動して光る/割れる/燃える
  const isSeal=ev&&/^seq_(508|509|510)_final_quiz/.test(ev.id||"");
  if(isSeal)stEnsureSeals();
  // 回想の間(seq_603_select_ending): 未到達の結末はネタバレ防止のため伏せ札にして押せなくする
  const gating=ev&&ev.id==="seq_603_select_ending";
  const reached=gating?stLoadEndings():null;
  // 波AI: 最終の名づけ(seq_510_final_quiz_3)——心の傾きが、呼べる名を狭める。
  // 雅(fantasySynchro)が現(realityEgo)を大きく上回ると「栞」の名がグリッチして選べず、
  // 現が雅を大きく上回ると「小萩」の名が選べない。均衡した者だけが三つ全てを選べる
  let nameLock=-1;
  if(ev&&ev.id==="seq_510_final_quiz_3"&&SM&&SM.state&&SM.state.params){
    const p=SM.state.params;
    if((p.fantasySynchro|0)-(p.realityEgo|0)>=25)nameLock=1;      // 選択肢2「栞」が読めない
    else if((p.realityEgo|0)-(p.fantasySynchro|0)>=25)nameLock=0; // 選択肢1「小萩」が読めない
  }
  const host=stEl("stOpts");host.innerHTML="";
  options.forEach((o,i)=>{
    const b=document.createElement("button");b.className="st-opt";
    if(gating&&reached&&reached.indexOf(ST_ENDING_ORDER[i])<0){ // 未到達=伏せ札(onclick無し)
      b.classList.add("locked");b.textContent=(i+1)+". ？？？（未到達）";host.appendChild(b);return;
    }
    if(i===nameLock){ // 波AI: 傾いた心では、その名がもう読めない(グリッチ+選択不可)
      const safe=String(o.text).replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));
      b.classList.add("locked");
      b.innerHTML=(i+1)+'. <span class="st-glitch" data-text="'+safe+'">'+safe+'</span>';
      host.appendChild(b);return;
    }
    if(o.glitchText){ // 波Z: 名を呼ぶ選択肢が崩れて見える(常世が名を拒むような不穏さ)
      const label=(i+1)+". ";
      const safe=String(o.text).replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));
      b.innerHTML=label+'<span class="st-glitch" data-text="'+safe+'">'+safe+'</span>';
    }else b.textContent=(i+1)+". "+o.text;
    b.onclick=()=>{
      beep(680,.05,"triangle",.08);host.innerHTML="";
      if(isSeal&&APP.story&&APP.story.sealFx){
        const fail=/fail/.test(o.next||"");
        APP.story.sealFx.resolve(i,fail?"burn":"correct");
        if(!fail){for(let k=0;k<3;k++)if(k!==i)APP.story.sealFx.resolve(k,"crack");} // 選ばれなかった札は砕ける
        setTimeout(()=>SM.choose(i),fail?900:750); // 札の演出を見せてから進む
        return;
      }
      SM.choose(i);
    };
    host.appendChild(b);
  });
  if(gating){ // 全ての結末が未到達でも「章をえらぶ」へ戻れる導線を必ず用意する
    const back=document.createElement("button");back.className="st-opt st-opt-back";
    back.textContent="（章をえらぶへ戻る）";
    back.onclick=()=>{beep(520,.05);stChapterMenu();};
    host.appendChild(back);
  }
}
/* 波AI: 物語の見せ大鬼を、四季モード秋ボスと同じGLB(oni_boss_2048)の姿に差し替える。
   読み込みは非同期・キャッシュ共有(taijiLoadSimpleGlb)。失敗時は従来の手続き生成モデルのまま。 */
function stOniGlbSkin(api){
  if(typeof taijiLoadSimpleGlb!=="function"||!api||!api.group)return;
  taijiLoadSimpleGlb("assets/bosses/oni_boss_2048.glb").then(root=>{
    if(!api.group.parent)return; // 読み込み完了前に片付けられていたら何もしない
    const skin=root.clone();
    skin.scale.setScalar(4.45);skin.rotation.x=Math.PI/2;skin.rotation.y=0;skin.position.y=.04; // 四季モードの実戦と同じ姿勢
    api.group.traverse(o=>{if(o.isMesh)o.visible=false;}); // 手続き生成の体は隠す(オーラ等の透明素材も含め、GLBに一本化)
    api.group.add(skin);
  }).catch(()=>{});
}
/* 破魔の連札の3D演出(プレイヤー正面に三枚)。各問で新調する */
function stEnsureSeals(){
  const S=APP.story,SO=window.StoryObjects;if(!S||!SO)return;
  if(S.sealFx)SO.disposeGroup(S.sealFx.group);
  const api=SO.createFinalQuizThreeSeals();
  api.setLabels(["壱","弐","参"]);
  // 波AI: 直前のカットで player.pos が俯瞰などの空中へ動かされていても破綻しないよう、
  // 基準点を検査する。地に足がついていなければ、大鬼の正面(常世アリーナの固定点)へ立て直す
  let bx=player.pos.x,by=player.pos.y,bz=player.pos.z,yaw=player.yaw;
  const groundY=(typeof groundH==="function"?groundH(bx,bz):0)+1.62;
  if(by>groundY+2.5||by<groundY-2.5){ // 俯瞰カメラ等の名残り=空中
    bx=30;bz=-42;by=(typeof groundH==="function"?groundH(bx,bz):0)+1.62;yaw=Math.PI; // 大鬼(30,-48)を望む位置
  }
  const fx=-Math.sin(yaw),fz=-Math.cos(yaw); // 正面方向
  api.group.position.set(bx+fx*2.6,by-0.25,bz+fz*2.6);
  api.group.rotation.y=yaw; // 札面をプレイヤーへ向ける
  scene.add(api.group);S.sealFx=api;
  // 波AB/AI: 三問とも(呼び出しのたび)、正面の札を見る画へ必ず絶対座標で戻す
  if(typeof stCamAt==="function")stCamAt([bx,by+0.3,bz],[bx+fx*2.6,by+0.2,bz+fz*2.6],52);
}
function stPanel(title,bodyHtml,btns){
  if(!/^ログ/.test(title))stVnStop(); // パネル(章メニュー/結末等)ではスキップ解除。ログは例外
  stEl("stPanelTitle").textContent=title;
  stEl("stPanelBody").innerHTML=bodyHtml;
  const host=stEl("stPanelBtns");host.innerHTML="";
  btns.forEach(([label,fn])=>{const b=document.createElement("button");b.className="st-opt";b.style.textAlign="center";
    b.textContent=label;b.onclick=()=>{beep(660,.05);stEl("stPanel").style.display="none";fn&&fn();};host.appendChild(b);});
  stEl("stPanel").style.display="flex";
}
function stDebugRefresh(snap){
  const el=stEl("stDebug");if(!el)return;
  // 波AL: いずれかの結末に一度でも到達した後は、隠しパラメータを常時HUDに明示する
  // (「蝕がたまってED5行きになった後、どう戻すか分からない」への回答——まず見えるように)
  const unlocked=/[?&]storyDebug=1/.test(location.search)||stLoadEndings().length>0;
  if(!unlocked){el.textContent="";return;}
  const p=(snap&&snap.state&&snap.state.params)||{};
  el.textContent=`現${p.realityEgo|0}/雅${p.fantasySynchro|0}/蝕${p.brainErosion|0}`;
}
/* ---- 収集物 ---- */
function stSpawnCollectibles(info){
  const S=APP.story,SO=window.StoryObjects;if(!S||!SO)return;
  stClearCollectibles();
  const placing=info.kind==="term_card_place";
  // 波AJ: セーブ復帰などで再スポーンする際、取得済みの札は再出現させない(二重取得防止)
  const got=(SM&&SM.state&&SM.state.collected&&SM.state.collected[info.groupId])||{};
  const items=(info.positions||[]).filter(p=>!got[p.id]).map(p=>{
    const api=(info.kind==="waka_tanzaku")?SO.createWakaTanzakuObject(p.label||""):SO.createTermCardObject(p.label||"");
    const y=(typeof groundH==="function"?groundH(p.x,p.z):0)+1.05;
    api.group.position.set(p.x,y,p.z);api.group.userData.baseY=y;api.group.userData.ph=Math.random()*6;
    if(placing&&p.placeTarget&&api.setPlacedTarget)api.setPlacedTarget(p.placeTarget);
    // 発見用の光柱(遠くからでも札の在処が分かる)
    const pil=new THREE.Mesh(new THREE.CylinderGeometry(.22,.55,8,10,1,true),
      new THREE.MeshBasicMaterial({color:0xffe9a8,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));
    pil.material.__ownedByStory=true;
    pil.position.y=3.4;api.group.add(pil);api.group.userData.pillar=pil;
    let targetMarker=null;
    if(placing&&p.placeTarget){
      targetMarker=new THREE.Group();
      const ringMat=new THREE.MeshBasicMaterial({color:0x9dd7ff,transparent:true,opacity:.30,side:THREE.DoubleSide,depthWrite:false});
      ringMat.__ownedByStory=true;
      const ring=new THREE.Mesh(new THREE.TorusGeometry(p.placeTarget.r||1.2,.035,8,42),ringMat);
      ring.rotation.x=Math.PI/2;
      targetMarker.add(ring);
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(.10,.32,3.2,10,1,true),
        new THREE.MeshBasicMaterial({color:0x9dd7ff,transparent:true,opacity:.10,side:THREE.DoubleSide,depthWrite:false}));
      beam.material.__ownedByStory=true;
      beam.position.y=1.55;targetMarker.add(beam);
      targetMarker.position.set(p.placeTarget.x,(typeof groundH==="function"?groundH(p.placeTarget.x,p.placeTarget.z):0)+.035,p.placeTarget.z);
      targetMarker.visible=false;
      scene.add(targetMarker);
    }
    scene.add(api.group);
    return {id:p.id,label:p.label||"",api,got:false,carrying:false,target:p.placeTarget||null,targetMarker};
  });
  S.collect={groupId:info.groupId,items,onCollect:info.onCollect,kind:info.kind,placing,held:null};
  toast(placing?"札を拾い、青い光の正しい場所へ戻そう("+items.length+"枚)":"光る札を集めよう("+items.length+"枚)。近づけば手に入る",3600);
  stEl("stBox").style.display="none"; // 収集中は会話箱を畳み、歩かせる
}
function stClearCollectibles(){
  const S=APP.story;if(!S||!S.collect)return;
  S.collect.items.forEach(it=>{
    if(window.StoryObjects)window.StoryObjects.disposeGroup(it.api.group);
    if(it.targetMarker&&window.StoryObjects)window.StoryObjects.disposeGroup(it.targetMarker);
  });
  S.collect=null;
}
/* ---- 効果(effect)フック ---- */
function stEffect(info){
  const S=APP.story,SO=window.StoryObjects;
  const id=info.effectId||"";
  if(id==="tactile_learning_highlight"&&SO){
    const g=new THREE.Group();
    const labels=(info.payload&&info.payload.targets)||["半蔀","几帳","廂"];
    labels.forEach((label,i)=>{
      const api=SO.createTermCardObject(label);
      const a=-.75+i*.75,fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw),rx=Math.cos(player.yaw),rz=-Math.sin(player.yaw);
      api.group.position.set(player.pos.x+fx*1.9+rx*a,player.pos.y-.55,player.pos.z+fz*1.9+rz*a);
      api.group.scale.setScalar(.72);
      g.add(api.group);
    });
    const api={group:g,t:0,update(t,dt){this.t+=dt;g.children.forEach((c,i)=>{c.position.y+=Math.sin(t*2+i)*.003;c.rotation.y=t*.8+i;});return this.t>3.2;}};
    scene.add(g);S.props.push({kind:"storyfx",api});
    if(typeof saigenSe==="function")saigenSe("koto");
  }else if(id==="term_cards_return_home"&&SO){
    const g=new THREE.Group();
    const pts=[
      ["御簾",0.8,5.4],["廂",-1.8,7.0],["簀子",-3.6,10.8],["渡殿",11.8,-3.8],["遣水",-11.5,27.0]
    ];
    pts.forEach(([label,x,z],i)=>{
      const api=SO.createTermCardObject(label);
      api.group.position.set(x,(typeof groundH==="function"?groundH(x,z):0)+1.05,z);
      api.group.scale.setScalar(.62);
      g.add(api.group);
      if(api.resolve)setTimeout(()=>api.resolve(),450+i*120);
    });
    const api={group:g,t:0,update(t,dt){this.t+=dt;g.children.forEach((c,i)=>{
      const a=c.userData&&c.userData.api;if(a&&a.update)a.update(t,dt); // resolve後の溶滅演出を進める
      if(!a||!a.resolved)c.rotation.y=t*1.1+i;
    });return this.t>2.4;}};
    scene.add(g);S.props.push({kind:"storyfx",api});
    if(typeof saigenSe==="function")saigenSe("koto");
  }else if(id==="inverted_memory_corridor"&&SO){
    const g=new THREE.Group();
    const labels=(info.payload&&info.payload.floatingTerms)||["御簾","廂","待つ","帰る"];
    labels.forEach((label,i)=>{
      const api=SO.createTermCardObject(label);
      const ang=i/labels.length*Math.PI*2;
      api.group.position.set(Math.cos(ang)*2.7,.15+i*.05,Math.sin(ang)*2.7);
      api.group.rotation.z=Math.PI;
      api.group.scale.setScalar(.68);
      g.add(api.group);
    });
    const shadowMat=new THREE.MeshBasicMaterial({color:0x1b0b0b,transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false});
    shadowMat.__ownedByStory=true;
    for(let i=0;i<8;i++){
      const wall=new THREE.Mesh(new THREE.PlaneGeometry(1.4,2.4),shadowMat.clone());
      wall.material.__ownedByStory=true;
      const ang=i/8*Math.PI*2;
      wall.position.set(Math.cos(ang)*3.2,1.2,Math.sin(ang)*3.2);
      wall.lookAt(0,1.2,0);
      g.add(wall);
    }
    g.position.set(player.pos.x,player.pos.y-1.15,player.pos.z);
    const api={group:g,t:0,update(t,dt){
      this.t+=dt;
      g.rotation.y-=dt*.28;
      g.children.forEach((c,i)=>{if(c.userData&&c.userData.api&&c.userData.api.update)c.userData.api.update(t,dt);c.position.y+=Math.sin(t*1.6+i)*.002;});
      return this.t>9.5;
    }};
    scene.add(g);S.props.push({kind:"memorycorridor",api});
    if(typeof saigenSe==="function")saigenSe("wind");
  }else if(id==="white_tanzaku_from_seagull"&&SO){
    // 波AA: カモメが上空を横切る様子をまず見せ(見上げるカメラ)、翼の下から紙片が
    // こぼれた瞬間に、実際に紙片が落ちてくる場所を見上げる画へ切り替える。
    // 一連の計算は演出開始時点のプレイヤー位置(anchor)を基準に固定し、カメラ移動による誤差を防ぐ。
    const anchor=player.pos.clone();
    stCamAt([anchor.x,anchor.y-0.2,anchor.z+1.4],[anchor.x,anchor.y+7,anchor.z-4],54); // 見上げる画
    stSeagullFlyover(anchor,(dropPos)=>{
      const groundY=anchor.y-1.6,midY=(dropPos.y+groundY)/2;
      stCamAt([anchor.x+2.6,anchor.y+0.5,anchor.z+2.0],[dropPos.x,midY,dropPos.z],48); // 紙片が落ちてくる先を見る画
      const api=SO.createWhiteTanzakuObject();
      api.setText(info.payload&&info.payload.text||"");
      if(api.setBackText)api.setBackText(info.payload&&info.payload.backText||"");
      api.group.position.copy(dropPos);
      scene.add(api.group);S.props.push({kind:"tanzaku",api,falling:true});
      if(typeof saigenSe==="function")saigenSe("wind");
      if(info.payload&&info.payload.text)setTimeout(()=>toast("白い短冊「"+info.payload.text+"」",3600),900);
    });
  }else if(id==="tokoyo_glitch"&&SO){
    const api=SO.createTokoyoGlitchProps(24); // 常世は北の対一帯を覆う広さで
    api.group.position.set(26,0.2,-44);scene.add(api.group);
    S.props.push({kind:"tokoyo",api});
  }else if(id==="oni_tears_misu"&&SO){
    stLightning();
    if(!S.oni){const api=SO.createGreatOniStoryObject();api.group.position.set(30,0,-48);scene.add(api.group);S.oni=api;stOniGlbSkin(api);}
  }else if(id==="yarimizu_dark_reflection"){
    // 波O/Z: 遣水が黒く濁り、水面に現代の教室(窓・机)が浮かぶ。「窓際の、二つの席」を具体的な形で見せる
    const g=new THREE.Group();
    const mkFlat=(w,h,color,x,z,y=.012)=>{const m=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,depthWrite:false});m.__ownedByStory=true;
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);g.add(mesh);return m;};
    const dark=mkFlat(2.7,2.7,0x0a1218,0,0,0.010);
    const roomMats=[];
    // 窓が二つ並ぶ列(桟の井桁つき)+その手前に机が二つ=「窓際の、二つの席」
    // 波AI: 実機で「机が一つに見える」FBを受け、席の間隔を広げ天板を大きくして二席を明確に
    [-0.75,0.75].forEach(sx=>{
      roomMats.push(mkFlat(.78,.58,0xc7dcf0,sx,.45));                 // 窓ガラスの淡い光
      roomMats.push(mkFlat(.03,.58,0x1c2430,sx,.45,.013));            // 窓の桟(縦)
      roomMats.push(mkFlat(.78,.03,0x1c2430,sx,.45,.013));            // 窓の桟(横)
      roomMats.push(mkFlat(.54,.36,0x9a8560,sx,-.10,.011));           // 机の天板(大きく)
      roomMats.push(mkFlat(.44,.06,0x76644a,sx,-.34,.011));           // 椅子の背
    });
    // 波X/AI: ボス出現前の予兆——水底に赤く光る眼。FBを受け大きく、出現は机の描写を読み終えた頃に
    const eyeMat1=mkFlat(.30,.30,0xff2010,-.22,.85,.014);
    const eyeMat2=mkFlat(.30,.30,0xff2010,.18,.85,.014);
    g.position.set(-11.5,0.16,27.0); // 池の北汀の水面に固定(直前のset_sceneでプレイヤーを汀へ移す)
    g.scale.set(2.4,1,2.4); // 波AL: 反射は水面いっぱいに大きく映す(実機FB)
    g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
    scene.add(g);
    S.props.push({kind:"yarimizu",api:{group:g},t:0,darkMat:dark,roomMats,eyeMats:[eyeMat1,eyeMat2]});
    if(typeof saigenSe==="function")saigenSe("wind");
  }else if(id==="shiori_reflection"){
    // 波Z: 制服アイコンを低解像度化して意図的にぼかし、水面に揺らめく記憶として見せる
    const g=new THREE.Group();
    const glow=new THREE.Mesh(new THREE.PlaneGeometry(2.6,2.6),
      new THREE.MeshBasicMaterial({color:0xaec4dd,transparent:true,opacity:0,depthWrite:false}));
    glow.rotation.x=-Math.PI/2;glow.material.userData={max:.18};g.add(glow); // 月光の水明かり
    const img=new Image();
    img.onload=()=>{
      const small=document.createElement("canvas");small.width=28;small.height=28;
      const sx=small.getContext("2d");sx.imageSmoothingEnabled=true;sx.imageSmoothingQuality="high";
      sx.drawImage(img,0,0,28,28); // 低解像度に落として引き伸ばすことで「ぼやけ」を作る(GPUのブラーなし)
      const tex=new THREE.CanvasTexture(small);tex.encoding=THREE.sRGBEncoding;
      const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:0,depthWrite:false});
      mat.__ownedByStory=true;mat.userData={max:.5};
      const portrait=new THREE.Mesh(new THREE.PlaneGeometry(.9,.9),mat);
      portrait.rotation.x=-Math.PI/2;portrait.position.set(.08,.013,0);g.add(portrait);
    };
    img.src="icons/shiori.webp";
    g.position.set(-11.2,0.17,27.4);
    g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
    scene.add(g);
    S.props.push({kind:"shiorimirror",api:{group:g},t:0});
    if(typeof saigenSe==="function")saigenSe("koto");
  }else if(id==="winter_lamp_dim"&&SO){
    // 波AA: このシーンは判者との稽古問答(台詞のみ)になったため、舞台大道具(題札等の
    // 唐突な白い物体)は出さず、雅楽の気配(音)のみ残す
    if(typeof saigenSe==="function")saigenSe("koto"); // 楽の音、床を這うように
  }else if(id==="classroom_board_pull"&&SO){
    // 波AA: 黒板の図に吸い込まれるようなズームイン+わずかな歪み
    const ang=SO.STORY_CAMERA_ANGLES&&SO.STORY_CAMERA_ANGLES.cam_classroom_board;
    if(ang&&typeof camera!=="undefined"){
      const startPos=player.pos.clone();
      const lookV=new THREE.Vector3(ang.look[0],ang.look[1],ang.look[2]);
      const posV=new THREE.Vector3(ang.pos[0],ang.pos[1],ang.pos[2]);
      const targetPos=posV.clone().lerp(lookV,0.6); // 黒板へぐっと踏み込む
      S.boardPull={t:0,dur:1.7,startPos,targetPos,startFov:camera.fov,startPitch:player.pitch};
    }
  }else if(id==="ed3_fire_dies"){
    // 波AA: ED3(歌なき夜)——台詞だけを残し、既存の火桶の火だけを大きく映して消える。心音/心電音で死を暗示
    stSetMinimalUi(true);
    if(S&&S.actors)Object.values(S.actors).forEach(a=>{a.group.visible=false;}); // 判者・小萩の気配等、火桶以外の姿を消す
    const g=new THREE.Group();
    const potMat=new THREE.MeshStandardMaterial({color:0x4a3722,roughness:.85});potMat.__ownedByStory=true;
    const pot=new THREE.Mesh(new THREE.CylinderGeometry(.34,.28,.34,12),potMat);pot.position.y=.17;g.add(pot);
    const ashMat=new THREE.MeshStandardMaterial({color:0xcfc3a6,roughness:.95});ashMat.__ownedByStory=true;
    const ash=new THREE.Mesh(new THREE.CylinderGeometry(.30,.30,.05,12),ashMat);ash.position.y=.335;g.add(ash);
    const emberMat=new THREE.MeshBasicMaterial({color:0xff5a22,transparent:true,opacity:1});emberMat.__ownedByStory=true;
    const ember=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),emberMat);ember.position.y=.36;g.add(ember);
    const emberLight=new THREE.PointLight(0xff6a30,1.2,3,2);emberLight.position.set(0,.4,0);g.add(emberLight);
    g.position.set(player.pos.x+0.35,0,player.pos.z-1.0);
    g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
    scene.add(g);
    stCamAt([player.pos.x+0.10,player.pos.y+0.42,player.pos.z+0.30],[player.pos.x+0.35,player.pos.y+0.34,player.pos.z-1.0],30); // 火桶だけを大きく画面いっぱいに
    S.props.push({kind:"ed3fire",api:{group:g},t:0,emberMat,emberLight});
    if(typeof saigenSe==="function")saigenSe("wind");
    // 心音/心電音: はじめは落ち着いた鼓動、次第に間遠くなり、最後にフラットライン(一音の伸び)で途絶える=死を暗示
    const hbBeat=()=>{beep(84,.09,"sine",.11);setTimeout(()=>beep(64,.12,"sine",.06),130);};
    S._ed3HbTimers=[900,1650,2500,3450,4550].map(ms=>setTimeout(hbBeat,ms));
    S._ed3HbTimers.push(setTimeout(()=>beep(50,2.8,"sine",.09),5600)); // フラットライン
    setTimeout(()=>stSlowFadeToWhite(3400),1400); // 火が弱まり始めた頃から、ゆっくり画面が白む
  }else if(id==="names_melt_pan"){
    // 波AL: 2話「輪郭がほどけている」——渡殿のあたり→遣水の流れへ、陽炎のぼかしの中を
    // ゆっくり視線が渡る。カメラ位置は動かさず、向き(yaw/pitch)だけを補間する
    const reduced=(typeof REDUCED_MOTION!=="undefined"&&REDUCED_MOTION);
    const anchor=player.pos.clone();
    S.namePan={t:0,dur:reduced?0.01:6.5,anchor,
      from:new THREE.Vector3(15.5,1.6,-8.0),  // 渡殿のあたり
      to:new THREE.Vector3(-12.0,0.6,23.0)};  // 遣水の流れ
    document.body.classList.add("st-haze");
    clearTimeout(window._stHazeT);
    window._stHazeT=setTimeout(()=>document.body.classList.remove("st-haze"),reduced?2600:8000); // 台詞を読み終える頃に晴れる
  }else if(id==="ed5_world_break"){
    // 波AA: ED5(百年の夢)——世界が壊れていく感じを強化。チャイムを2倍速で鳴らし続け、雅楽と風を逆再生で流す
    if(!erosionFx&&window.StoryObjects)erosionFx=window.StoryObjects.createBrainErosionOverlay({}).mount();
    if(erosionFx){
      erosionFx.setLevel(100);
      clearInterval(S._ed5FlickerT);
      S._ed5FlickerT=setInterval(()=>erosionFx.flickerGlyph(),260); // 通常より高頻度で旧仮名が揺らぐ=崩壊感
    }
    if(typeof SFX!=="undefined"&&SFX.startEd5Chaos)SFX.startEd5Chaos();
    document.body.classList.add("st-ed5-lineart"); // 波AJ: 3D質感が剥がれ、白黒の線画=教科書のページへ潰されていく
    // 3D空間側の崩壊感: プレイヤー周囲に「ほどけた文字」の板ポリを漂わせる
    if(SO&&SO.createEd5GlyphDebris&&!S.props.some(p=>p&&p.kind==="ed5debris")){
      const reduced=(typeof REDUCED_MOTION!=="undefined"&&REDUCED_MOTION);
      const api=SO.createEd5GlyphDebris(reduced?10:13);
      api.group.position.set(player.pos.x,player.pos.y-1.6,player.pos.z); // 足元基準に空間へ散らす
      scene.add(api.group);
      S.props.push({kind:"ed5debris",api,reduced});
    }
  }
  // summer_heat_haze / ending_gallery_ready は世界側の夏演出・回想UIがそのまま担う(追加なし)
}
/* 現代教室セット(ED1/ED2/ED4)。カメラ台帳 cam_classroom_* が絶対座標で寄る */
function stEnsureClassroom(){
  const S=APP.story,SO=window.StoryObjects;if(!S||!SO||S.classroom)return;
  S.classroom=SO.createClassroomSet();
  scene.add(S.classroom.group);
  S.classroom.setBoard("waka","御簾=隔てる/つなぐ"); // 黒板に平面図+書き足し
  if(typeof saigenSe==="function")saigenSe("chalk"); // 波Y: チョークの音で黒板の気配を添える
}
/* ED1(御簾を上げる朝): 栞の机の上に、白い短冊(表は無地)と、添えられた薄紫の紐を置いて寄る。
   短冊+紐は S.props に kind:"ed1tanzaku" で積み、章転換の stCleanupSets で破棄される。 */
function stPlaceEd1Tanzaku(){
  const S=APP.story,SO=window.StoryObjects;if(!S||!SO)return;
  stEnsureClassroom(); // 直前のノートで生成済みだが保険
  if(!S.props.some(p=>p&&p.kind==="ed1tanzaku")){
    const a=(S.classroom&&S.classroom.anchor)||{x:-260,y:0,z:300};
    const dx=a.x+1.0,dz=a.z+1.6,topY=a.y+0.73; // 栞の席(窓際最後列)の机上
    const wrap=new THREE.Group();
    const tan=SO.createWhiteTanzakuObject();tan.setText(""); // 表には、もう何も書かれていない
    tan.group.position.set(dx-0.05,topY+0.006,dz-0.03);
    tan.group.rotation.set(-Math.PI/2,0,0.16);              // 机に伏せて置く
    wrap.add(tan.group);
    const cord=SO.createPurpleCordMotif();
    cord.group.position.set(dx+0.12,topY+0.012,dz+0.05);
    cord.group.rotation.set(-Math.PI/2,0,0.5);              // 結ばれた跡のように、短冊に添える
    cord.group.scale.setScalar(0.9);
    wrap.add(cord.group);
    wrap.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
    scene.add(wrap);
    S.props.push({kind:"ed1tanzaku",api:{group:wrap},cord});
    if(typeof saigenSe==="function")saigenSe("chalk");
  }
  // 机上の短冊へ寄る。ノードの cameraAngleId(cam_classroom_shiori)より後に効かせたいので次tickで上書き
  setTimeout(()=>{if(APP.mode==="story"&&APP.story&&APP.story.props.some(p=>p&&p.kind==="ed1tanzaku"))stCamera("cam_classroom_tanzaku");},0);
}
/* 波W: 現実の病室セット(第6話 回想の間の枠)。cam_hospital_* が絶対座標で寄る */
function stEnsureHospital(){
  const S=APP.story,SO=window.StoryObjects;if(!S||!SO||S.hospital)return;
  S.hospital=SO.createHospitalRoomSet(); // 心電モニタ・点滴・薄紫紐のしおり付きノート
  scene.add(S.hospital.group);
}
/* 波AL: モード切替でWキー等が押しっぱなし判定のまま残り、壁ぎわでヘッドボブが
   揺れ続ける不具合の根治。物語⇄試練の出入りで移動キーの状態を必ずリセットする */
function stResetMoveKeys(){
  if(typeof keys==="undefined")return;
  ["w","a","s","d","shift","arrowup","arrowdown","arrowleft","arrowright"].forEach(k=>{keys[k]=false;});
}
/* 章をまたぐ大道具の一括後片付け(大鬼・連札・教室) */
function stCleanupSets(){
  const S=APP.story,SO=window.StoryObjects;if(!S||!SO)return;
  if(S.actors)Object.values(S.actors).forEach(a=>{if(a&&a.group)a.group.visible=false;}); // 波AL: 章をまたいで役者が立ち残らないように(台詞で再登場する)
  document.body.classList.remove("st-haze");S.namePan=null; // 波AL: 陽炎パンの後片付け
  if(S._ed3HbTimers){S._ed3HbTimers.forEach(clearTimeout);S._ed3HbTimers=null;} // ED3の心音/心電音タイマー
  if(S._ed5FlickerT){clearInterval(S._ed5FlickerT);S._ed5FlickerT=null;} // ED5の崩壊フリッカー
  if(typeof SFX!=="undefined"&&SFX.stopEd5Chaos)SFX.stopEd5Chaos(); // ED5のチャイム2倍速/逆再生BGMを必ず止める
  if(typeof camera!=="undefined")camera.rotation.z=0; // ED5の微ロールを必ず0へ戻す
  stSetCrownDeep(false); // ED4の翳りを必ず解除
  document.body.classList.remove("st-ed1-glow");clearTimeout(window._stEd1GlowT); // ED1の朝光も畳む
  document.body.classList.remove("st-ed5-lineart"); // ED5の線画化も解除
  stSetMinimalUi(false); // ED3で隠したトップバー等を必ず復元
  if(S.oni){SO.disposeGroup(S.oni.group);S.oni=null;}
  if(S.sealFx){SO.disposeGroup(S.sealFx.group);S.sealFx=null;}
  if(S.classroom){SO.disposeGroup(S.classroom.group);S.classroom=null;}
  if(S.hospital){SO.disposeGroup(S.hospital.group);S.hospital=null;}
  if(S.seagullFly){if(S.seagullFly.group&&S.seagullFly.group.parent)SO.disposeGroup(S.seagullFly.group);S.seagullFly=null;}
  if(S.skyDome){SO.disposeGroup(S.skyDome.group);S.skyDome=null;} // 波AB: 常世スカイドームの後片付け
  if(S.props&&S.props.length){ // 章転換で残留した大道具(着地後の短冊等)を確実に破棄しリーク防止
    S.props.forEach(p=>{if(p&&p.api&&p.api.group)SO.disposeGroup(p.api.group);});
    S.props=[];
  }
}
/* ---- 世界の住人(姫君・女房・貴公子)を物語中は隠す ---- */
function stHideWorldFigures(on){
  if(typeof people!=="undefined")people.forEach(p=>{
    if(!p||!p.g)return;
    if(on){if(p.__stVis==null)p.__stVis=p.g.visible;p.g.visible=false;}
    else if(p.__stVis!=null){p.g.visible=p.__stVis;delete p.__stVis;}
  });
  // 波AI: 絵巻断片(探索モードの収集物)は物語の書割りに不要なので隠す。復帰時は収集状況に応じた表示へ戻す
  if(typeof emakiFragments!=="undefined")emakiFragments.forEach(g=>{
    if(!g)return;
    if(on){if(g.__stVis==null)g.__stVis=g.visible;g.visible=false;}
    else if(g.__stVis!=null){g.visible=g.__stVis;delete g.__stVis;}
  });
}
/* ---- ミニゲーム接続 ---- */
function stMiniGame(info){
  const S=APP.story;S.mini=info;
  stVnStop();
  if(typeof ST_BGM!=="undefined")ST_BGM.stop(); // 章BGMを止める(歌合はUK_BGM、退治はボスBGMが鳴るため)。復帰時にstartStoryで再開
  stResetMoveKeys(); // 波AL: 試練へ入る際も移動キー状態を拭う
  stEl("stBox").style.display="none";
  {const hud=stEl("storyHud");if(hud)hud.style.display="none";} // ミニゲーム中は章メニュー📑/終了✕を隠して状態破壊を防止
  if(info.gameMode==="quiz_beginner"){
    // 既存クイズへ本接続: 対象5札の復習モード。結果画面は出さず物語へ帰す
    APP.storyQuiz=(ok)=>{enterMode("story");info.complete({success:ok});};
    if(typeof camera!=="undefined"){camera.fov=62;camera.updateProjectionMatrix();} // 物語カメラのfovを戻す
    enterMode("quiz");
    const pk=stEl("quizDiffPicker");if(pk)pk.style.display="none";
    startQuiz(["hajitomi","misu","kichou","hisashi","moya"]);
    toast("小萩の試験——五つの名を当てよ",1600); // 短めに(誤タップ誤答を避ける)
    return;
  }
  // ---- 波O: 全試練を実モードへ本接続 ----
  if(info.gameMode==="kaimami_story"){
    // 垣間見ミッション本体を起動。達成のみで復帰(警戒回数が多いほど侵食が進む)
    APP.storyKaimami=(ok,caught)=>{
      enterMode("story");
      info.complete({success:ok,effects:caught>0?{brainErosion:Math.min(12,caught*3)}:{brainErosion:-2}});
      if(caught>0)toast("見つかった回数 "+caught+"回——気配が心を削った",2600);
    };
    if(typeof camera!=="undefined"){camera.fov=62;camera.updateProjectionMatrix();}
    enterMode("kaimami");
    toast("垣間見の試練——巡回を避け、三つの観察地点から姫君を捉えよ",3600);
    return;
  }
  if(info.gameMode==="taiji_kappa_story"||info.gameMode==="taiji_oni_story_final"){
    const oniFinal=info.gameMode==="taiji_oni_story_final";
    if(S.oni){window.StoryObjects.disposeGroup(S.oni.group);S.oni=null;} // 見せ大鬼は実戦と交代
    if(S.props&&S.props.length){ // 波Z: 池の反射演出(赤い眼等)がボス戦アリーナへ持ち越されないよう片付ける
      S.props.forEach(p=>{if(p&&p.api&&p.api.group)window.StoryObjects.disposeGroup(p.api.group);});
      S.props=[];
    }
    const prevDiff=APP.taijiDifficulty;
    if(oniFinal)APP.taijiDifficulty="hard"; // 決戦は歯応え重視(通常戦より攻撃頻度・弾数増)
    else if(SM&&SM.state&&SM.state.routeFlags&&SM.state.routeFlags.tabooFaceObserved){ // 波AJ: 「顔立ちを覚えた」と言い張った者には水底の主が牙を剥く(禁忌の代償)
      APP.taijiDifficulty="hard";
      setTimeout(()=>toast("……「見た」と言い張った口を、水底の主が憶えている。水が、重い",3200),1200);
    }
    APP.storyTaiji={
      rush:[oniFinal?"autumn":"summer"], // 夏=河童の主 / 秋=大鬼(第2形態あり)
      kappaOnly:!oniFinal,               // 波Q: 第3話は河童単体(提灯お化けを出さない)
      swordOnly:!oniFinal,               // 波Q: 第3話は太刀限定(弓は右近が受け持つ)
      done:(ok,hits)=>{
        APP.taijiDifficulty=prevDiff||"normal";
        enterMode("story");
        if(ok&&oniFinal){ // 決戦後の連札の場: 封印の大鬼を見せ直す
          const api=window.StoryObjects.createGreatOniStoryObject();
          api.group.position.set(30,0,-48);api.setPhase(3);scene.add(api.group);S.oni=api;
          stOniGlbSkin(api); // 波AI: 四季モード秋ボスと同じGLBの姿に
        }
        const flags=(ok&&oniFinal&&hits<=5)?{oniPerfect:true}:undefined;
        info.complete({success:ok,flags});
        if(ok&&oniFinal&&hits<=5)toast("✨ 無傷に近い勝利——完璧な祓いだった",2800);
      }
    };
    APP.taijiBossRush=true;
    if(!APP.taijiDifficulty)APP.taijiDifficulty="normal";
    if(typeof camera!=="undefined"){camera.fov=62;camera.updateProjectionMatrix();}
    enterMode("taiji");
    return;
  }
  if(info.gameMode==="utakai_story"){
    APP.storyUtakaiFullDeck=true; // 波Z: 手札を全歌から引けるようにし、運ゲー感を緩和
    APP.storyUtakai=(ok,wins)=>{
      APP.storyUtakaiFullDeck=false;
      enterMode("story");
      info.complete({success:ok,flags:(ok&&wins>=3)?{utakaiPerfect:true}:undefined});
      if(ok&&wins>=3)toast("✨ 三番全勝——判者も舌を巻く完勝だった",2800);
    };
    if(typeof camera!=="undefined"){camera.fov=62;camera.updateProjectionMatrix();}
    enterMode("utakai");
    return;
  }
  // 未知のモードだけ従来のパネル(保険)
  stPanel("【試験版】"+info.gameMode,"この試練は未接続です。結果を選んで進めます。",
    [["成功として進む",()=>info.complete({success:true})],
     ["失敗として進む",()=>info.complete({success:false})]]);
}
/* ---- エンディング/章クリア ---- */
function stEnding(endingId){
  stClearCollectibles();stVnStop();
  if(typeof ST_BGM!=="undefined")ST_BGM.stop(); // 結末では章BGMを畳む(結末カードは静かに見せる)
  stSaveEnding(endingId); // 到達を永続化(回想の間のネタバレ防止に使う)
  if(endingId==="ED1_TRUE"){ // 波AG: 朝光——結末カードの背後に、右上から柔らかい暖色光を差し込ませる
    document.body.classList.add("st-ed1-glow");
    clearTimeout(window._stEd1GlowT);
    window._stEd1GlowT=setTimeout(()=>document.body.classList.remove("st-ed1-glow"),9000);
  }
  // ED5の漂流とカメラの微ロールをここで止める(結末カードは静かに見せる)
  if(APP.story&&APP.story.props){for(let i=APP.story.props.length-1;i>=0;i--){
    const p=APP.story.props[i];if(p&&p.kind==="ed5debris"){window.StoryObjects.disposeGroup(p.api.group);APP.story.props.splice(i,1);}}}
  if(typeof camera!=="undefined")camera.rotation.z=0;
  if(APP.story&&APP.story.sealFx){window.StoryObjects.disposeGroup(APP.story.sealFx.group);APP.story.sealFx=null;}
  const ed=STORY_ED_TEXT[endingId]||{t:endingId,d:""};
  // 結末カードは必ず読めるよう、侵食演出はここで解除(前段の演出で役目は果たしている)
  if(erosionFx)erosionFx.setLevel(0);
  const showPanel=()=>stPanel("《 "+ed.t+" 》",ed.d,[
    ["結末の回想へ（他の結末を見る）",()=>{SM.state.endingId=null;stStartChapter(6);}],
    ["章をえらぶ",()=>{SM.state.endingId=null;stChapterMenu();}],
    ["タイトルへ戻る",()=>{stExitToTitle();}]
  ]);
  if(typeof SFX!=="undefined"&&SFX.stopEd5Chaos)SFX.stopEd5Chaos(); // 波AA: どの結末に着地してもED5の混沌演出を必ず止める
  // 波AB: ED3は今やseq_630_ed3_fire(章6の自然な流れ)で火桶が消える演出を既に見せ終えているため、
  // ここで再度エフェクトを発火させない(二重発火防止)。全結末共通で一呼吸(暗転/白転)を挟んでからカードを出す
  stFade(endingId==="ED5_SPOOKY"?"black":"white");
  setTimeout(showPanel,780);
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
/* ---- 記録の間(手動セーブスロット3つ) ----
   オートセーブ(shinden3d-story-save-v1)とは別に、任意の局面を手で保存/再開できる3枠。
   キー: shinden3d-story-slot1-v1 〜 slot3-v1。中身は {data:SM.serialize()(文字列), meta:{ch,seq,params,savedAt}}。
   全ての読み書きは try/catch で保護し、失敗してもスロットや進行を壊さない。 */
const ST_SLOT_N=[1,2,3];
function stSlotKey(n){return "shinden3d-story-slot"+n+"-v1";}
function stSlotLoad(n){try{const r=JSON.parse(localStorage.getItem(stSlotKey(n)));return (r&&r.meta&&r.data)?r:null;}catch(e){return null;}}
function stSlotSave(n){
  try{
    if(!SM||!SM.state||!stStoryInProgress())return false;
    const st=SM.state;
    const rec={data:SM.serialize(), // SM.serialize()は文字列(JSON)を返す
      meta:{ch:st.chapterId,seq:SM.currentSequenceId,params:Object.assign({},st.params||{}),savedAt:Date.now()}};
    localStorage.setItem(stSlotKey(n),JSON.stringify(rec));
    return true;
  }catch(e){return false;}
}
function stSlotDelete(n){try{localStorage.removeItem(stSlotKey(n));return true;}catch(e){return false;}}
/* 物語が「途中」か(章1〜5を進行中で、結末にも章クリアにも達していない)。保存可否の判定に使う */
function stStoryInProgress(){
  return !!(SM&&SM.state&&SM.state.chapterId>=1&&SM.state.chapterId<=5&&
    SM.currentSequenceId&&SM.currentSequenceId!=="chapter_complete"&&!SM.state.endingId);
}
function stFmtSaveTime(ms){
  try{const d=new Date(ms),p=n=>String(n).padStart(2,"0");
    return p(d.getMonth()+1)+"/"+p(d.getDate())+" "+p(d.getHours())+":"+p(d.getMinutes());
  }catch(e){return "";}
}
let stSlotArmed=0; // 削除の二度押し待機中スロット(0=なし)
function stRecordRoom(){
  const inProg=stStoryInProgress();
  const esc=s=>String(s).replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));
  const rows=ST_SLOT_N.map(n=>{
    const rec=stSlotLoad(n);
    let info;
    if(!rec){info='<span class="st-slot-empty">（空き）</span>';}
    else{const m=rec.meta,p=m.params||{};
      info='第'+esc(m.ch||"?")+'話 ｜ 現'+(p.realityEgo|0)+'/雅'+(p.fantasySynchro|0)+'/蝕'+(p.brainErosion|0)+
           ' ｜ '+esc(stFmtSaveTime(m.savedAt));}
    const acts=[];
    // 保存ボタンは無効化せず常に押せる。進行中でない時に押すと理由をtoastで説明する(stSlotAction参照)
    acts.push('<button class="st-opt st-slot-btn'+(inProg?'':' dim')+'" data-act="save" data-n="'+n+'">ここに保存</button>');
    if(rec){
      acts.push('<button class="st-opt st-slot-btn" data-act="load" data-n="'+n+'">ここから再開</button>');
      acts.push('<button class="st-opt st-slot-btn'+(stSlotArmed===n?' arm':'')+'" data-act="del" data-n="'+n+'">'+(stSlotArmed===n?'本当に消す':'消す')+'</button>');
    }
    return '<div class="st-slot-row"><div class="st-slot-info"><b>記録 '+n+'</b>'+info+'</div>'+
           '<div class="st-slot-acts">'+acts.join("")+'</div></div>';
  }).join("");
  const note=inProg?"":'<div class="st-slot-note">保存できるのは物語の途中だけです。（章メニューから開いた時は「ここから再開」「消す」のみ使えます）</div>';
  stPanel("📜 記録の間",note+rows,[["章をえらぶへ戻る",()=>{stSlotArmed=0;stChapterMenu();}]]);
  // stPanelがbodyHtmlを差し込んだ後、埋め込みボタンへ挙動を配線する
  const host=stEl("stPanelBody");
  if(host)host.querySelectorAll(".st-slot-btn").forEach(b=>{
    b.onclick=()=>stSlotAction(b.getAttribute("data-act"),+b.getAttribute("data-n"));
  });
}
function stSlotAction(act,n){
  try{
    if(act==="save"){
      beep(700,.05,"triangle",.07);
      if(!stStoryInProgress()){toast("保存できるのは物語の途中だけです",2200);return;}
      if(stSlotSave(n))toast("記録 "+n+" に保存しました",1800);
      else toast("保存に失敗しました",2200);
      stSlotArmed=0;stRecordRoom();
    }else if(act==="load"){
      const rec=stSlotLoad(n);
      if(!rec){toast("この記録は空です",1800);return;}
      let ok=false;
      try{SM.deserialize(rec.data);ok=true;}catch(e){toast("記録の読み込みに失敗しました",2600);} // 失敗時はスロットを壊さない
      if(!ok)return;
      beep(660,.05);
      const m=rec.meta||{};
      stSlotArmed=0;stEl("stPanel").style.display="none";
      stStartChapter(m.ch!=null?m.ch:SM.state.chapterId, m.seq!=null?m.seq:SM.currentSequenceId);
    }else if(act==="del"){
      if(stSlotArmed!==n){stSlotArmed=n;stRecordRoom();toast("もう一度押すと消えます",1800);return;} // 二度押しで誤操作を防ぐ
      stSlotDelete(n);stSlotArmed=0;beep(320,.08,"square",.06);toast("記録 "+n+" を消しました",1600);stRecordRoom();
    }
  }catch(e){toast("操作に失敗しました",2000);}
}
/* ---- 章メニュー ---- */
function stChapterMenu(){
  stCleanupSets(); // 章間で大道具(大鬼・連札・教室)を片付ける
  if(typeof ST_BGM!=="undefined")ST_BGM.stop(); // 章メニューでは章BGMを止める
  if(erosionFx)erosionFx.setLevel(0);
  const man=(window.STORY_EMBED&&STORY_EMBED.manifest&&STORY_EMBED.chapters)?STORY_EMBED.manifest.chapters:[];
  const save=SM&&SM.load&&(function(){try{return JSON.parse(localStorage.getItem("shinden3d-story-save-v1"));}catch(e){return null;}})();
  // 波AG: 進捗表示——読了章にはしるしを、続きからには現在の心の在り処(現/雅/蝕)を添える
  const done=(save&&save.state&&save.state.completedChapters)||{};
  // 第6話(帰る朝＝回想の間)は本編の章リストから外し、別項目にする
  const btns=man.filter(c=>c.chapterId<=5).map(c=>[
    (done[c.chapterId]?"✓ ":"")+"第"+c.chapterId+"話 「"+c.chapterTitle+"」",()=>stStartChapter(c.chapterId)]);
  if(save&&save.state&&save.state.chapterId&&save.state.chapterId<=5&&save.currentSequenceId&&save.currentSequenceId!=="chapter_complete"&&!save.state.endingId){
    const p=save.state.params||{};
    btns.unshift(["▶ 続きから (第"+save.state.chapterId+"話 ｜ 現"+(p.realityEgo|0)+"/雅"+(p.fantasySynchro|0)+"/蝕"+(p.brainErosion|0)+")",()=>{
      SM.deserialize(save);stStartChapter(save.state.chapterId,save.currentSequenceId);}]);
  }
  const edN=stLoadEndings().length;
  btns.push(["🌸 結末の回想（回想の間） 結末 "+edN+"/5",()=>stStartChapter(6)]);
  btns.push(["📜 記録の間（手動セーブ/ロード）",()=>{stSlotArmed=0;stRecordRoom();}]);
  // 波AL: 蝕がたまってED5圏へ入った後の「戻し方」——禊。結末到達後(パラメータ可視化後)かつ蝕60以上で現れる
  const pNow=(SM&&SM.state&&SM.state.params)||{};
  if(edN>0&&(pNow.brainErosion|0)>=60){
    btns.push(["⛩ 禊（みそぎ）——心の蝕れを清める（蝕→0）",()=>{
      SM.state.params.brainErosion=0;SM.save();
      if(erosionFx)erosionFx.setLevel(0);
      toast("川の水で身を清めた。……胸の内の靄が、引いていく（蝕 0）",3200);
      if(typeof saigenSe==="function")saigenSe("koto");
      stChapterMenu();
    }]);
  }
  btns.push(["タイトルへ戻る",()=>stExitToTitle()]);
  const doneN=[1,2,3,4,5].filter(i=>done[i]).length;
  // 波AL: 一度でも結末に到達したら、章メニューにも現在の心の在り処を常時明示する
  const paramLine=edN>0?("<br>現在の心 — 現"+(pNow.realityEgo|0)+" / 雅"+(pNow.fantasySynchro|0)+" / 蝕"+(pNow.brainErosion|0)):"";
  stPanel("御簾の向こうへ — 寝殿造り異聞",
    "<small style='color:#9a8a6a'>読了 "+doneN+"/5話 ｜ 結末 "+edN+"/5 ｜ デモ版"+paramLine+"</small>",btns);
}
function stStartChapter(id,resumeSeq){
  stEl("stPanel").style.display="none";
  stCleanupSets();
  SM.state.endingId=null;
  // 波AI: 敗北フラグの残留バグ修正——一度負けてED3を見た後に再挑戦して勝っても、
  // chapter4Lost/chapter5Lost が routeFlags に残り続け、determineEnding が永遠にED3を
  // 返してしまっていた(勝ったのにやり直しED行き)。章の再開時に該当章の敗北フラグを拭う
  if(SM.state.routeFlags){
    if(id<=4)delete SM.state.routeFlags.chapter4Lost;
    if(id<=5)delete SM.state.routeFlags.chapter5Lost;
    if(id<=4)delete SM.state.routeFlags.utakaiPrepScore; // 波AL: 加算式になった稽古スコアを再走時に持ち越さない
  }
  if(typeof ST_BGM!=="undefined")ST_BGM.start(id); // 章別プロシージャルBGM(ch5常世/ch6現実は無音)。ST_BGM側で二重start/章替えを処理
  if(id<=5)stChapterCard(id); // 波AG: 章題カットイン(第6話=回想の間とED直行では出さない)
  if(typeof taijiLoadSimpleGlb==="function"){ // 波AL: ボスGLBを章の冒頭で温めておく(戦闘直前の読み込みヒッチ=一瞬固まる対策)
    if(id===3)taijiLoadSimpleGlb("assets/bosses/kappa_boss_2048.glb").catch(()=>{});
    if(id===5){taijiLoadSimpleGlb("assets/bosses/hitodama_boss_2048.glb").catch(()=>{});taijiLoadSimpleGlb("assets/bosses/oni_boss_2048.glb").catch(()=>{});}
  }
  SM.startChapter(id).then(()=>{
    if(resumeSeq&&SM.sequenceMap.has(resumeSeq)){SM.currentSequenceId=resumeSeq;SM.runCurrent();}
    // 波Z: 第5話開始時、侵食が高いまま進むとED5に繋がることを明示し、唐突感をなくす
    if(id===5&&!resumeSeq){
      const ero=SM.state&&SM.state.params&&SM.state.params.brainErosion||0;
      if(ero>=60)setTimeout(()=>{toast(ero>=80?"⚠ このまま心が保てねば、常世の夢に沈んだまま戻れなくなる":"⚠ 積み重ねた過ちが、まだ胸の奥でくすぶっている",4400);if(typeof saigenSe==="function")saigenSe("gong");},2200);
    }
  }).catch(e=>{console.error(e);toast("物語の読み込みに失敗しました",2600);});
}
/* ---- モード出入り ---- */
function startStory(){
  stInject();
  document.body.classList.add("story-mode");
  stEl("storyHud").style.display="block";
  if(APP.story){ // ミニゲーム帰還: 再初期化せず、隠し直しだけ行う(垣間見等が住人の表示を戻すため)
    APP.story.mini=null; // ミニゲーム終了——中断/終了ボタンを再び有効化
    if(typeof AUTO_TIME!=="undefined")AUTO_TIME._paused=true; // 波Z: endTaiji等が解除した時刻自動進行を物語復帰時に再固定
    stResetMoveKeys(); // 波AL: 戦闘中に押しっぱなしのまま残った移動キーを拭う(カメラ揺れの根治)
    stHideWorldFigures(true);
    if(typeof ST_BGM!=="undefined"&&SM&&SM.state)ST_BGM.start(SM.state.chapterId); // ミニゲームから物語へ復帰: 章BGMを再開
    stDebugRefresh(SM&&SM.snapshot());
    return;
  }
  APP.story={props:[],collect:null,actors:null,oni:null,
    vn:{auto:false,skip:false,log:[],curEv:null},
    prevSeason:APP.season,prevTime:APP.time,
    prevLabelMode:APP.labelMode,
    prevAutoPaused:(typeof AUTO_TIME!=="undefined")?AUTO_TIME._paused:false};
  if(typeof AUTO_TIME!=="undefined")AUTO_TIME._paused=true;
  if(typeof setLabelMode==="function")setLabelMode(0,false,true); // 名前タグは物語中は非表示
  if(typeof beacon!=="undefined")beacon.visible=false;             // 世界側の誘導・収集表示も消す
  stHideWorldFigures(true);                                        // 姫君・女房・貴公子は物語の配役ではないので隠す
  stBuildSolids();                                                 // 物語モードの障害物コリジョンを有効化
  stVnButtons();
  stSpawnActors();
  if(!erosionFx&&window.StoryObjects)erosionFx=window.StoryObjects.createBrainErosionOverlay({}).mount();
  if(!SM){
    SM=new StoryManager({hooks:{
      onDialogue:(d)=>{stApplyPresentation(d.event);stShowDialogue(d.speaker,d.text,d.event);},
      onChoice:(c)=>{stApplyPresentation(c.event);stShowChoice(c.text,c.options,c.event);},
      onScene:(sc)=>{
        stApplyPresentation(sc.event);
        if(sc.season&&sc.season!=="tokoyo"&&typeof applySeason==="function"&&sc.season!==APP.season)applySeason(sc.season);
        const wasTokoyoSky=APP.storyTokoyoSky;
        APP.storyTokoyoSky=(sc.season==="tokoyo"); // 波Z: 常世は赤黒く禍々しい空(通常季節の空色を上書き)
        if(APP.storyTokoyoSky&&!wasTokoyoSky){ // 波AB: 赤黒いグラデーション+ひび割れメッシュのスカイドームを追加
          const S2=APP.story;
          if(S2&&!S2.skyDome&&window.StoryObjects&&window.StoryObjects.createTokoyoSkyDome){
            S2.skyDome=window.StoryObjects.createTokoyoSkyDome();scene.add(S2.skyDome.group);
          }
        }else if(!APP.storyTokoyoSky&&wasTokoyoSky){
          const S2=APP.story;
          if(S2&&S2.skyDome){window.StoryObjects.disposeGroup(S2.skyDome.group);S2.skyDome=null;}
        }
        if(sc.season==="tokoyo"&&typeof snowFall!=="undefined"&&typeof petals!=="undefined"){snowFall.visible=true;petals.visible=true;} // 雪と桜が同時に降る
        const tm=STORY_TIME_MAP[sc.timeOfDay]||(sc.season==="tokoyo"?"night":null);
        if(sc.season==="tokoyo"&&typeof setTime==="function")setTime("night");
        else if(tm&&typeof setTime==="function"&&tm!==APP.time)setTime(tm);
        if(sc.playerStart){const p=sc.playerStart;
          player.pos.set(p.x,(typeof groundH==="function"?groundH(p.x,p.z):0)+1.62,p.z);
          if(p.yaw!=null)player.yaw=p.yaw;player.pitch=-.04;
          if(typeof camera!=="undefined")camera.position.copy(player.pos);window.dummyCam=null;}
        // 舞台に応じて当たり判定セットを切替
        const loc=sc.event&&sc.event.stage&&sc.event.stage.location;
        if(loc==="classroom"){
          // 教室の移動可能域はテレポート後の実座標を中心に張り直す(旧位置中心バグ修正)
          if(typeof stBuildSolidsRoom==="function")stBuildSolidsRoom(player.pos.x,player.pos.z);
        }else if(sc.season==="tokoyo")stBuildSolidsTokoyo();else stBuildSolids();
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
  stEl("stChTitle").textContent="御簾の向こうへ";
  SM.hooks.onChapterLoaded=(ch)=>{
    stEl("stChTitle").textContent="第"+ch.chapterId+"話 "+ch.chapterTitle;
    const man=(window.STORY_EMBED&&STORY_EMBED.manifest&&STORY_EMBED.manifest.chapters)||[];
    const ent=man.find(c=>c.chapterId===ch.chapterId);
    const goalEl=stEl("stGoal");if(goalEl)goalEl.textContent=ent&&ent.clearCondition?("目標: "+ent.clearCondition):"";
    // 波AH: 第6話はED直行(continueToEndingEpilogue)でもここを必ず通る。前章のBGMをエピローグへ持ち越さない
    if(ch.chapterId===6&&typeof ST_BGM!=="undefined")ST_BGM.stop();
  };
  stChapterMenu();
}
function stExitToTitle(){
  const S=APP.story;
  APP.storyTokoyoSky=false;APP.storyIndoor=false;
  if(typeof ST_BGM!=="undefined")ST_BGM.stop(); // 物語を閉じる際は章BGMを必ず畳む
  stClearCollectibles();stCleanupSets();
  if(S){
    (S.props||[]).forEach(p=>{if(window.StoryObjects)window.StoryObjects.disposeGroup(p.api.group);});
    if(S.actors)Object.values(S.actors).forEach(a=>{a.group.visible=false;});
    if(S.prevSeason&&typeof applySeason==="function"&&S.prevSeason!==APP.season)applySeason(S.prevSeason);
    if(S.prevTime&&typeof setTime==="function"&&S.prevTime!==APP.time)setTime(S.prevTime);
    if(typeof AUTO_TIME!=="undefined")AUTO_TIME._paused=!!S.prevAutoPaused;
    if(S.prevLabelMode!=null&&typeof setLabelMode==="function")setLabelMode(S.prevLabelMode,false,true); // 名前タグ復元
  }
  stHideWorldFigures(false); // 姫君たちを邸へ返す
  window.STORY_SOLIDS=[];     // 障害物コリジョン解除
  clearTimeout(window._stAutoT);
  if(erosionFx)erosionFx.setLevel(0);
  stSetCrownDeep(false); // ED4の翳り・彩度低下を必ず解除
  document.body.classList.remove("st-ed1-glow");clearTimeout(window._stEd1GlowT); // ED1の朝光も畳む
  document.body.classList.remove("st-ed5-lineart"); // ED5の線画化も解除
  const chc=stEl("stChCard");if(chc)chc.classList.remove("show"); // 章題カードの残留防止
  if(typeof camera!=="undefined")camera.rotation.z=0; // ED5のロールを必ず戻す
  APP.story=null;APP.storyQuiz=null;
  document.body.classList.remove("story-mode");
  const hud=stEl("storyHud");if(hud){hud.style.display="none";stEl("stBox").style.display="none";stEl("stPanel").style.display="none";}
  const fd=stEl("storyFade");if(fd){clearTimeout(window._stFadeT);fd.className="";}
  if(typeof camera!=="undefined"){camera.fov=62;camera.updateProjectionMatrix();}
  if(typeof START_POS!=="undefined"){player.pos.copy(START_POS);player.yaw=0;player.pitch=-.02;} // 教室等の別地点から邸へ戻す
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
  if(S.sealFx&&S.sealFx.update)S.sealFx.update(t,dt);
  if(S.classroom&&S.classroom.update)S.classroom.update(t);
  if(S.hospital&&S.hospital.update)S.hospital.update(t); // 心電波形・見舞いの気配
  if(S.seagullFly&&S.seagullFly.update)S.seagullFly.update(dt); // 波Z: カモメの飛来演出
  if(S.skyDome&&S.skyDome.update&&typeof camera!=="undefined")S.skyDome.update(camera.position,t); // 波AB: 常世の禍々しいスカイドーム
  if(S.namePan){ // 波AL: 渡殿→遣水へ、向きだけをゆっくり渡す(位置は固定)
    const np=S.namePan;np.t+=dt;const p=Math.min(1,np.t/np.dur);
    const e=p*p*(3-2*p);
    const tx=np.from.x+(np.to.x-np.from.x)*e,ty=np.from.y+(np.to.y-np.from.y)*e,tz=np.from.z+(np.to.z-np.from.z)*e;
    player.pos.copy(np.anchor); // 押しっぱなしキー等での位置ずれを許さない
    const dx=tx-np.anchor.x,dy=ty-np.anchor.y,dz=tz-np.anchor.z,len=Math.hypot(dx,dy,dz)||1;
    player.yaw=Math.atan2(-dx,-dz);
    player.pitch=Math.max(-1.2,Math.min(1.2,Math.asin(dy/len)));
    if(p>=1)S.namePan=null;
  }
  if(S.boardPull){ // 波AA: 黒板に吸い込まれるズーム
    const bp=S.boardPull;bp.t+=dt;const p=Math.min(1,bp.t/bp.dur);
    const e=p*p*(3-2*p); // smoothstep
    player.pos.lerpVectors(bp.startPos,bp.targetPos,e);
    if(typeof camera!=="undefined"){camera.fov=bp.startFov-(bp.startFov-30)*e;camera.updateProjectionMatrix();}
    player.pitch=bp.startPitch+Math.sin(p*Math.PI*7)*0.007*(1-p);
    if(p>=1)S.boardPull=null;
  }
  for(let i=(S.props||[]).length-1;i>=0;i--){
    const p=S.props[i];
    if(p.kind==="storyfx"&&p.api&&p.api.update){
      if(p.api.update(t,dt)){window.StoryObjects.disposeGroup(p.api.group);S.props.splice(i,1);}
    }
    else if(p.kind==="memorycorridor"&&p.api&&p.api.update){
      if(p.api.update(t,dt)){window.StoryObjects.disposeGroup(p.api.group);S.props.splice(i,1);}
    }
    else if(p.kind==="tanzaku"&&p.falling){if(p.api.updateFall(dt,(typeof groundH==="function"?groundH(p.api.group.position.x,p.api.group.position.z):0)+0.10))p.falling=false;}
    else if(p.kind==="utakaistage"){if(p.api.update)p.api.update(t);} // 灯の揺らぎ
    else if(p.kind==="tokoyo"&&p.api.update)p.api.update(t,dt);
    else if(p.kind==="yarimizu"){ // 濁り→教室の窓と机が浮かぶ→赤い眼が灯って持続(ボス戦突入まで台詞のペース次第で消えないよう長く保つ)
      p.t+=dt;
      const a=p.t<1.2?p.t/1.2:1; // 一度濁ったら、プレイヤーが読み終わるまで消えない
      p.darkMat.opacity=.62*a;
      const shimmer=0.75+Math.sin(t*1.8)*.25;
      p.roomMats.forEach((m,i)=>{m.opacity=(i%5<3?.5:.4)*a*shimmer;}); // 窓ガラス/桟はやや明るく、机はやや控えめ
      if(p.eyeMats){ // ボスの予兆(河童の主): 濁りが十分深まってから灯り、以後は消えずボス戦突入まで残る
        const eyeA=p.t<6.5?0:Math.min(1,(p.t-6.5)/1.4); // 波AI: 机の描写を読み終えた頃に、初めて灯る
        const pulse=0.7+Math.sin(t*3.4)*.3;
        p.eyeMats.forEach(m=>{m.opacity=eyeA*pulse;});
      }
      if(p.t>30){window.StoryObjects.disposeGroup(p.api.group);S.props.splice(i,1);} // 安全弁(通常はボス戦開始/章転換のstCleanupSetsで片付く)
    }
    else if(p.kind==="shiorimirror"){ // 水底から浮かびあがり、揺らめいて、沈む(約10秒)
      p.t+=dt;
      const a=p.t<2.2?p.t/2.2:p.t<7.5?1:Math.max(0,1-(p.t-7.5)/2.5);
      p.api.group.traverse(o=>{if(o.isMesh&&o.material.userData&&o.material.userData.max!=null)
        o.material.opacity=o.material.userData.max*a*(0.82+Math.sin(t*1.4+o.position.x*7)*.18);});
      p.api.group.position.y=0.17+Math.sin(t*.9)*.008; // 水面の揺らぎ
      if(p.t>10){window.StoryObjects.disposeGroup(p.api.group);S.props.splice(i,1);}
    }
    else if(p.kind==="ed3fire"){ // ED3: 火桶の熾火が消えていく(約4秒)
      p.t+=dt;
      const a=Math.max(0,1-p.t/3.2);
      p.emberMat.opacity=a;p.emberMat.color.setHex(a>0.4?0xff5a22:0x662410);
      p.emberLight.intensity=1.2*a;
      if(p.t>4.2){window.StoryObjects.disposeGroup(p.api.group);S.props.splice(i,1);}
    }
    else if(p.kind==="ed1tanzaku"){ // ED1: 添えられた薄紫の紐だけが、そっと揺れる
      if(p.cord&&p.cord.update)p.cord.update(t);
    }
    else if(p.kind==="ed5debris"){ // ED5: ほどけた文字が逆さのまま漂い上昇する+カメラの微ロール
      if(!p.reduced){
        p.api.group.children.forEach(pl=>{const u=pl.userData;if(!u)return;
          pl.rotation.y+=dt*u.spin;
          pl.rotation.z=Math.PI+Math.sin(t*.6+u.ph)*.25;       // 逆さのまま揺らぐ
          pl.position.y+=dt*u.rise;if(pl.position.y>3.6)pl.position.y=0.2; // ゆっくり上昇してループ
        });
        if(typeof camera!=="undefined")camera.rotation.z=Math.sin(t*.7)*.02; // 世界が傾ぐ微ロール
      }
    }
  }
  // 収集: 近づくだけで手に入る(タップ不要・スマホ配慮)。目標行に残数と最寄りの方角・距離を出す
  if(S.collect){
    let remain=0,nearD=Infinity,nearDx=0,nearDz=0;
    S.collect.items.forEach(it=>{
      if(it.got){if(!it.api.resolved&&it.api.update)it.api.update(t,dt);return;} // 解決演出(溶けて消える)を最後まで進める
      if(S.collect.placing){
        if(it.carrying){
          const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);
          it.api.group.position.set(player.pos.x+fx*.95,player.pos.y-.35,player.pos.z+fz*.95);
          it.api.group.rotation.y=t*1.2;
          if(it.targetMarker){
            it.targetMarker.visible=true;
            it.targetMarker.rotation.y=t*.35;
            it.targetMarker.scale.setScalar(1+Math.sin(t*2.2)*.035);
          }
          const td=it.target?Math.hypot(player.pos.x-it.target.x,player.pos.z-it.target.z):Infinity;
          if(it.target&&td<=(it.target.r||1.2)){
            if(it.api.tryPlace)it.api.tryPlace({x:player.pos.x,z:player.pos.z});
            it.got=true;it.carrying=false;S.collect.held=null;
            if(it.targetMarker)it.targetMarker.visible=false;
            beep(880,.07,"triangle",.09);beep(1320,.09,"sine",.05);
            S.collect.onCollect(it.id);
            const left=S.collect?S.collect.items.filter(x=>!x.got).length:0;
            toast(left>0?("「"+it.label+"」を戻した。あと "+left+" 枚"):"すべての名が、あるべき場所へ戻った",2200);
          }else{
            remain++;
            if(td<nearD){nearD=td;nearDx=(it.target?it.target.x:player.pos.x)-player.pos.x;nearDz=(it.target?it.target.z:player.pos.z)-player.pos.z;}
          }
        }else{
          if(it.api.update)it.api.update(t,dt);
          const gp=it.api.group.position,d=Math.hypot(gp.x-player.pos.x,gp.z-player.pos.z);
          if(!S.collect.held&&d<2.2){
            it.carrying=true;S.collect.held=it.id;
            if(it.api.group.userData.pillar)it.api.group.userData.pillar.visible=false;
            beep(720,.06,"triangle",.08);
            toast("「"+it.label+"」を預かった。青い光の戻し先へ運ぼう",2200);
          }else{
            remain++;
            if(!S.collect.held&&d<nearD){nearD=d;nearDx=gp.x-player.pos.x;nearDz=gp.z-player.pos.z;}
          }
        }
      }else{
        if(it.api.update)it.api.update(t,dt);
        const gp=it.api.group.position,d=Math.hypot(gp.x-player.pos.x,gp.z-player.pos.z);
        if(d<2.2){it.got=true;
          if(it.api.group.userData.pillar)it.api.group.userData.pillar.visible=false;
          if(it.api.resolve)it.api.resolve();else it.api.group.visible=false;
          beep(880,.07,"triangle",.09);beep(1320,.09,"sine",.05);
          S.collect.onCollect(it.id);
          const left=S.collect?S.collect.items.filter(x=>!x.got).length:0;
          if(left>0)toast("あと "+left+" 枚",1400);
        }else{remain++;
          if(d<nearD){nearD=d;nearDx=gp.x-player.pos.x;nearDz=gp.z-player.pos.z;}
        }
      }
    });
    if(remain>0){
      const dirs=["北","北東","東","南東","南","南西","西","北西"];
      const ang=(Math.atan2(nearDx,-nearDz)+Math.PI*2)%(Math.PI*2); // 北=-z基準の八方位
      const dir=dirs[Math.round(ang/(Math.PI/4))%8];
      const goalEl=stEl("stGoal");
      if(goalEl)goalEl.textContent=S.collect.placing
        ?(S.collect.held?"戻し先: "+dir+"へ "+Math.round(nearD)+"m(青い光)":"名札 あと"+remain+"枚 ｜ 最寄り: "+dir+"へ "+Math.round(nearD)+"m")
        :"光る札 あと"+remain+"枚 ｜ 最寄り: "+dir+"へ "+Math.round(nearD)+"m(光の柱が目印)";
    }
    // 解決演出(縮んで消える)の後始末
    S.collect&&S.collect.items.forEach(it=>{if(it.got&&it.api.resolved&&it.api.group.parent)window.StoryObjects.disposeGroup(it.api.group);});
  }
  // 波AG: 章の空気(環境楽音レイヤー)——章の気分に合う楽の音を、ごく稀に小さく流す。
  // ch5(常世)/ch6(現実)は無音の緊張を保つため鳴らさない。屋内・試練中・スキップ中も鳴らさない。
  // ※ 章別プロシージャルBGM(ST_BGM)が鳴っている間(1〜4章)は、二重に音が重ならないよう発音をスキップする。
  //   STORY_AIRのプールも1〜4章のみで、ST_BGMの対象章と完全に一致するため、BGM稼働中は実質全スキップになる。
  if(!S.air)S.air={wait:24+Math.random()*36};
  S.air.wait-=dt;
  if(S.air.wait<=0){
    S.air.wait=60+Math.random()*60;
    const ch=SM&&SM.state?SM.state.chapterId:0;
    const pools={1:["koto"],2:["sho"],3:["biwa"],4:["koto","sho"]}[ch];
    const vn=S.vn;
    const bgmOn=(typeof ST_BGM!=="undefined"&&ST_BGM.on); // ST_BGM稼働中は環境楽音を鳴らさない(併存させない)
    if(pools&&!bgmOn&&!APP.storyIndoor&&!S.mini&&!(vn&&vn.skip)&&typeof SFX!=="undefined"&&SFX.playCall){
      SFX.playCall(pools[(Math.random()*pools.length)|0],.14); // 遠くの対屋から、微かに(ST_BGMが鳴らせない環境でのフォールバック)
    }
  }
  // 侵食20以上: 稀に旧仮名の揺らぎ
  // 侵食40以上のときだけ、ごく稀に旧仮名が一瞬揺らぐ(20台の通常プレイでは出さない)
  if(erosionFx&&SM&&SM.state.params.brainErosion>=40&&Math.random()<dt*.03)erosionFx.flickerGlyph();
}
/* ---- 公開 ---- */
window.startStory=startStory;
window.storyUpdate=storyUpdate;
window.stExitToTitle=stExitToTitle;
/* ---- タイトル入口: メインメニュー最上段に常設(デモ版表記) ---- */
function stGate(){
  const host=document.querySelector("#mainModes .t-modes");if(!host)return;
  const b=document.createElement("button");
  b.className="t-btn t-cat-btn gold recommended";b.id="btnStory";
  b.style.borderColor="rgba(185,165,230,.9)";
  b.innerHTML='<span class="mode-meta">物語 / 新機能</span>'
    +'<div class="cat-icon">📖</div><span class="mode-name">御簾の向こうへ（デモ版）</span>'
    +'<small>平安と現代をつなぐ、隠された物語を読む</small>';
  b.onclick=()=>{beep(700,.08);if(typeof initAudio==="function")initAudio();enterMode("story");};
  host.insertBefore(b,host.firstChild);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",stGate);
else stGate();
})();
