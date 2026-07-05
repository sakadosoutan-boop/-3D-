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
  ED5_SPOOKY:{t:"ED5 Spooky End「百年の夢」", d:"見て見ぬふりを重ねた小さな過ちが、静かに積もっていた。名をなくした人は、物語にやさしく飼われます。<br><span style='color:#b9a5e6'>あなたの席は、まだ空いています。</span>"}
};
let SM=null,erosionFx=null;
function stEl(id){return document.getElementById(id);}
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
    /* 波Z: 名を呼ぶ選択肢の崩れ(常世が名を拒むような不穏なグリッチ) */
    "#storyHud .st-glitch{position:relative;display:inline-block}",
    "#storyHud .st-glitch::before,#storyHud .st-glitch::after{content:attr(data-text);position:absolute;left:0;top:0;width:100%;overflow:hidden;background:inherit}",
    "#storyHud .st-glitch::before{color:#ff3b5c;clip-path:inset(0 0 60% 0);animation:stGlitchA 2.6s infinite linear}",
    "#storyHud .st-glitch::after{color:#3bdcff;clip-path:inset(60% 0 0 0);animation:stGlitchB 3.1s infinite linear}",
    "@keyframes stGlitchA{0%,90%,100%{transform:translate(0,0)}91%{transform:translate(2px,-1px)}93%{transform:translate(-2px,1px)}95%{transform:translate(1px,1px)}}",
    "@keyframes stGlitchB{0%,88%,100%{transform:translate(0,0)}89%{transform:translate(-2px,1px)}92%{transform:translate(2px,-1px)}94%{transform:translate(-1px,-1px)}}",
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
    '<div class="st-vn"><button id="stAuto">オート</button><button id="stSkip">スキップ</button><button id="stLog">ログ</button></div>'+
    '<div class="st-spk" id="stSpk"></div><div class="st-text" id="stText"></div>'+
    '<div class="st-next" id="stNextWrap"><button id="stNext">つぎへ ▶</button></div><div class="st-opts" id="stOpts"></div></div>'+
    '<div class="st-panel" id="stPanel"><div class="st-card"><h3 id="stPanelTitle"></h3><div class="st-body" id="stPanelBody"></div><div class="st-btns" id="stPanelBtns"></div></div></div>';
  const fade=document.createElement("div");fade.id="storyFade";document.body.appendChild(fade);
  stEl("stQuit").onclick=()=>{beep(440,.06);stExitToTitle();};
  stEl("stMenuBtn").onclick=()=>{beep(560,.05);stVnStop();stChapterMenu();};
  stEl("stAuto").onclick=()=>{const v=APP.story&&APP.story.vn;if(!v)return;v.auto=!v.auto;v.skip=false;stVnButtons();
    if(v.auto&&v.curEv)stVnSchedule(v.curEv);else clearTimeout(window._stAutoT);beep(620,.04);};
  stEl("stSkip").onclick=()=>{const v=APP.story&&APP.story.vn;if(!v)return;v.skip=!v.skip;v.auto=false;stVnButtons();
    if(v.skip&&v.curEv){clearTimeout(window._stAutoT);window._stAutoT=setTimeout(()=>stVnAdvance(),90);}beep(620,.04);};
  stEl("stLog").onclick=()=>{stVnShowLog();beep(560,.04);};
}
/* ---- VN補助(オート/スキップ/ログ) ---- */
function stVnButtons(){
  const v=APP.story&&APP.story.vn;if(!v)return;
  stEl("stAuto").classList.toggle("on",!!v.auto);
  stEl("stSkip").classList.toggle("on",!!v.skip);
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
    // 波AA: オート/スキップ/縮小モーションでは全文が即表示されるため、遅延させず即再生する
    const instantText=(typeof REDUCED_MOTION!=="undefined"&&REDUCED_MOTION)||(APP.story&&APP.story.vn&&APP.story.vn.skip);
    if(ev.seDelayMs&&!instantText)setTimeout(()=>saigenSe(ev.se),ev.seDelayMs); // 台詞中の描写に合わせて音を少し遅らせる
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
const ST_SPK_COLOR={"小萩":"#c9a2d8","秀頼":"#8fb8e8","秀頼（心）":"#7fa0c8","右近":"#a8c88a","左大臣":"#d8b25a","判者":"#b8b0c8","栞":"#9ec8e0","大鬼":"#e07a6a","水底の声":"#5ad0a0","御簾の向こうの声":"#d8c090","？？？":"#c0c0c0"};
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
  const sp=stEl("stSpk");
  sp.textContent=spk?("— "+spk+" —"):"語り";
  sp.style.color=ST_SPK_COLOR[spk]||"var(--kin)";
  const te=stEl("stText");
  const full=text||"";
  te.style.fontSize=(full.length>130)?"12.5px":"14px"; // 長文は一段小さく(切れ防止)
  te.scrollTop=0;
  stSetFace(spk,ev); // 立ち絵
  const v=APP.story&&APP.story.vn;
  if(v){v.log.push({s:spk,t:full,ch:SM&&SM.chapter?SM.chapter.chapterId:0});if(v.log.length>300)v.log.shift();v.curEv=ev;}
  const actorKey=ST_SPEAKER_ACTOR[spk];
  if(actorKey&&APP.story&&APP.story.actors&&APP.story.actors[actorKey]){
    const a=APP.story.actors[actorKey];a.group.visible=true;
    if(a.pulse)a.pulse(); // 気配の間(小萩): 話す間だけ影が揺れ、紐が瞬く
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
  if(reduced||(v&&v.skip)){stRenderText(te,full,glitchWord);onRevealDone();}
  else{
    te.textContent="";let i=0,tick=0;
    const step=Math.max(1,Math.round(full.length/90)); // 長文は複数文字ずつで一定時間に収める
    window._stType=setInterval(()=>{
      i+=step;stRenderText(te,full.slice(0,i),glitchWord);
      if((tick++%3)===0&&typeof beep==="function")beep(1400,.006,"square",.008); // 微かな文字送り音
      if(i>=full.length){clearInterval(window._stType);onRevealDone();}
    },24);
  }
  // タップ: 表示中なら一括表示、表示済みなら次へ
  const tap=()=>{
    if(!revealed){clearInterval(window._stType);stRenderText(te,full,glitchWord);onRevealDone();return;}
    beep(600,.045,"triangle",.07);if(v)v.curEv=null;clearTimeout(window._stAutoT);clearInterval(window._stType);SM.goNext(ev.next);
  };
  te.onclick=tap;sp.onclick=tap;
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
  const host=stEl("stOpts");host.innerHTML="";
  options.forEach((o,i)=>{
    const b=document.createElement("button");b.className="st-opt";
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
}
/* 破魔の連札の3D演出(プレイヤー正面に三枚)。各問で新調する */
function stEnsureSeals(){
  const S=APP.story,SO=window.StoryObjects;if(!S||!SO)return;
  if(S.sealFx)SO.disposeGroup(S.sealFx.group);
  const api=SO.createFinalQuizThreeSeals();
  api.setLabels(["壱","弐","参"]);
  const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw); // 正面方向
  api.group.position.set(player.pos.x+fx*2.6,player.pos.y-0.25,player.pos.z+fz*2.6);
  api.group.rotation.y=player.yaw; // 札面をプレイヤーへ向ける
  scene.add(api.group);S.sealFx=api;
  // 波AB: 直前のcam_ch5_overhead(俯瞰)のまま固定され地面を向き続けるバグ修正。
  // 三問とも(呼び出しのたび)、正面の札を見る画へ必ず戻す
  if(typeof stCamRelative==="function")stCamRelative([0,0.3,0],[fx*2.6,-0.1,fz*2.6],52);
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
    // 発見用の光柱(遠くからでも札の在処が分かる)
    const pil=new THREE.Mesh(new THREE.CylinderGeometry(.22,.55,8,10,1,true),
      new THREE.MeshBasicMaterial({color:0xffe9a8,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));
    pil.position.y=3.4;api.group.add(pil);api.group.userData.pillar=pil;
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
    if(!S.oni){const api=SO.createGreatOniStoryObject();api.group.position.set(30,0,-48);scene.add(api.group);S.oni=api;}
  }else if(id==="yarimizu_dark_reflection"){
    // 波O/Z: 遣水が黒く濁り、水面に現代の教室(窓・机)が浮かぶ。「窓際の、二つの席」を具体的な形で見せる
    const g=new THREE.Group();
    const mkFlat=(w,h,color,x,z,y=.012)=>{const m=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,depthWrite:false});m.__ownedByStory=true;
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);g.add(mesh);return m;};
    const dark=mkFlat(2.7,2.7,0x0a1218,0,0,0.010);
    const roomMats=[];
    // 窓が二つ並ぶ列(桟の井桁つき)+その手前に机が二つ=「窓際の、二つの席」
    [-0.55,0.55].forEach(sx=>{
      roomMats.push(mkFlat(.78,.58,0xc7dcf0,sx,.45));                 // 窓ガラスの淡い光
      roomMats.push(mkFlat(.03,.58,0x1c2430,sx,.45,.013));            // 窓の桟(縦)
      roomMats.push(mkFlat(.78,.03,0x1c2430,sx,.45,.013));            // 窓の桟(横)
      roomMats.push(mkFlat(.40,.28,0x9a8560,sx,-.05,.011));           // 机の天板
      roomMats.push(mkFlat(.32,.05,0x76644a,sx,-.24,.011));           // 椅子の背
    });
    // 波X: ボス出現前の予兆——水底に赤く光る眼が二つ、遅れて浮かぶ
    const eyeMat1=mkFlat(.12,.12,0xff2010,-.14,.85,.014);
    const eyeMat2=mkFlat(.12,.12,0xff2010,.02,.85,.014);
    g.position.set(-11.5,0.16,27.0); // 池の北汀の水面に固定(直前のset_sceneでプレイヤーを汀へ移す)
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
  }else if(id==="ed5_world_break"){
    // 波AA: ED5(百年の夢)——世界が壊れていく感じを強化。チャイムを2倍速で鳴らし続け、雅楽と風を逆再生で流す
    if(!erosionFx&&window.StoryObjects)erosionFx=window.StoryObjects.createBrainErosionOverlay({}).mount();
    if(erosionFx){
      erosionFx.setLevel(100);
      clearInterval(S._ed5FlickerT);
      S._ed5FlickerT=setInterval(()=>erosionFx.flickerGlyph(),260); // 通常より高頻度で旧仮名が揺らぐ=崩壊感
    }
    if(typeof SFX!=="undefined"&&SFX.startEd5Chaos)SFX.startEd5Chaos();
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
/* 波W: 現実の病室セット(第6話 回想の間の枠)。cam_hospital_* が絶対座標で寄る */
function stEnsureHospital(){
  const S=APP.story,SO=window.StoryObjects;if(!S||!SO||S.hospital)return;
  S.hospital=SO.createHospitalRoomSet(); // 心電モニタ・点滴・薄紫紐のしおり付きノート
  scene.add(S.hospital.group);
}
/* 章をまたぐ大道具の一括後片付け(大鬼・連札・教室) */
function stCleanupSets(){
  const S=APP.story,SO=window.StoryObjects;if(!S||!SO)return;
  if(S._ed3HbTimers){S._ed3HbTimers.forEach(clearTimeout);S._ed3HbTimers=null;} // ED3の心音/心電音タイマー
  if(S._ed5FlickerT){clearInterval(S._ed5FlickerT);S._ed5FlickerT=null;} // ED5の崩壊フリッカー
  if(typeof SFX!=="undefined"&&SFX.stopEd5Chaos)SFX.stopEd5Chaos(); // ED5のチャイム2倍速/逆再生BGMを必ず止める
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
  if(typeof people==="undefined")return;
  people.forEach(p=>{
    if(!p||!p.g)return;
    if(on){if(p.__stVis==null)p.__stVis=p.g.visible;p.g.visible=false;}
    else if(p.__stVis!=null){p.g.visible=p.__stVis;delete p.__stVis;}
  });
}
/* ---- ミニゲーム接続 ---- */
function stMiniGame(info){
  const S=APP.story;S.mini=info;
  stVnStop();
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
  if(endingId==="ED3_GAMEOVER"){ // 波Z/AA: 初回到達時も火桶が消え、白む画面の中で心音が途絶えるところまで見せてからカードを出す
    stEffect({effectId:"ed3_fire_dies",payload:{}});
    setTimeout(showPanel,6200);
  }else{
    // 波AB: 最後の台詞から結末カードが同一フレームで唐突に出ていたのを解消。
    // 一呼吸(暗転/白転)を挟んでからエピローグとカードをつなげる
    stFade(endingId==="ED5_SPOOKY"?"black":"white");
    setTimeout(showPanel,780);
  }
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
  stCleanupSets(); // 章間で大道具(大鬼・連札・教室)を片付ける
  if(erosionFx)erosionFx.setLevel(0);
  const man=(window.STORY_EMBED&&STORY_EMBED.manifest&&STORY_EMBED.chapters)?STORY_EMBED.manifest.chapters:[];
  // 第6話(帰る朝＝回想の間)は本編の章リストから外し、別項目にする
  const btns=man.filter(c=>c.chapterId<=5).map(c=>["第"+c.chapterId+"話 「"+c.chapterTitle+"」",()=>stStartChapter(c.chapterId)]);
  const save=SM&&SM.load&&(function(){try{return JSON.parse(localStorage.getItem("shinden3d-story-save-v1"));}catch(e){return null;}})();
  if(save&&save.state&&save.state.chapterId&&save.state.chapterId<=5&&save.currentSequenceId&&save.currentSequenceId!=="chapter_complete"&&!save.state.endingId){
    btns.unshift(["▶ 続きから (第"+save.state.chapterId+"話)",()=>{
      SM.deserialize(save);stStartChapter(save.state.chapterId,save.currentSequenceId);}]);
  }
  btns.push(["🌸 結末の回想（回想の間）",()=>stStartChapter(6)]);
  btns.push(["タイトルへ戻る",()=>stExitToTitle()]);
  stPanel("御簾の向こうへ — 寝殿造り異聞","<small style='color:#9a8a6a'>試験版 / この画面は ?story=1 でのみ入れます</small>",btns);
}
function stStartChapter(id,resumeSeq){
  stEl("stPanel").style.display="none";
  stCleanupSets();
  SM.state.endingId=null;
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
    stHideWorldFigures(true);
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
  };
  stChapterMenu();
}
function stExitToTitle(){
  const S=APP.story;
  APP.storyTokoyoSky=false;APP.storyIndoor=false;
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
    if(p.kind==="tanzaku"&&p.falling){if(p.api.updateFall(dt,(typeof groundH==="function"?groundH(p.api.group.position.x,p.api.group.position.z):0)+0.10))p.falling=false;}
    else if(p.kind==="utakaistage"){if(p.api.update)p.api.update(t);} // 灯の揺らぎ
    else if(p.kind==="tokoyo"&&p.api.update)p.api.update(t,dt);
    else if(p.kind==="yarimizu"){ // 濁り→教室の窓と机が浮かぶ→赤い眼が灯って持続(ボス戦突入まで台詞のペース次第で消えないよう長く保つ)
      p.t+=dt;
      const a=p.t<1.2?p.t/1.2:1; // 一度濁ったら、プレイヤーが読み終わるまで消えない
      p.darkMat.opacity=.62*a;
      const shimmer=0.75+Math.sin(t*1.8)*.25;
      p.roomMats.forEach((m,i)=>{m.opacity=(i%5<3?.5:.4)*a*shimmer;}); // 窓ガラス/桟はやや明るく、机はやや控えめ
      if(p.eyeMats){ // ボスの予兆(河童の主): 濁りが十分深まってから灯り、以後は消えずボス戦突入まで残る
        const eyeA=p.t<1.8?0:Math.min(1,(p.t-1.8)/1.2);
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
  }
  // 収集: 近づくだけで手に入る(タップ不要・スマホ配慮)。目標行に残数と最寄りの方角・距離を出す
  if(S.collect){
    let remain=0,nearD=Infinity,nearDx=0,nearDz=0;
    S.collect.items.forEach(it=>{
      if(it.got)return;
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
    });
    if(remain>0){
      const dirs=["北","北東","東","南東","南","南西","西","北西"];
      const ang=(Math.atan2(nearDx,-nearDz)+Math.PI*2)%(Math.PI*2); // 北=-z基準の八方位
      const dir=dirs[Math.round(ang/(Math.PI/4))%8];
      const goalEl=stEl("stGoal");
      if(goalEl)goalEl.textContent="光る札 あと"+remain+"枚 ｜ 最寄り: "+dir+"へ "+Math.round(nearD)+"m(光の柱が目印)";
    }
    // 解決演出(縮んで消える)の後始末
    S.collect&&S.collect.items.forEach(it=>{if(it.got&&it.api.resolved&&it.api.group.parent)window.StoryObjects.disposeGroup(it.api.group);});
  }
  // 侵食20以上: 稀に旧仮名の揺らぎ
  // 侵食40以上のときだけ、ごく稀に旧仮名が一瞬揺らぐ(20台の通常プレイでは出さない)
  if(erosionFx&&SM&&SM.state.params.brainErosion>=40&&Math.random()<dt*.03)erosionFx.flickerGlyph();
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
