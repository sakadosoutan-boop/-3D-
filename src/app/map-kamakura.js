/* ============================================================
   鎌倉武家屋敷マップ  ( ?map=kamakura で起動 )
   教材設計の正本: docs/plans/KAMAKURA_BUKE_YASHIKI_PLAN.md
   ------------------------------------------------------------
   方針:
   - 既定(寝殿造)マップの挙動は 1バイトも変えない。本ブロックは
     APP.map==="kamakura" のときだけ実行される自己完結コード。
   - 既存ヘルパー(building/hipRoof/hipRoofGeo/box/cyl/tree/canv/M/
     makeHeianFigure/MAT)を流用。図鑑登録(register)・SEASONAL登録・
     クイズ連携は一切行わない(P1スコープ外・オプトイン安全)。
   - 座標系: -z が北、+z が南。yaw=0 は -z(北)向き(forward=(0,0,-1))。
     郭(内郭)は概ね ±35、堀は ±37〜42、全体は ±54 以内(散策の ±57 クランプ内)。
   ============================================================ */
if(APP.map==="kamakura"){

  /* ---- 1. 寝殿ワールドと scene 直付けの装飾を隠す ----
     world配下(地面・全建物・塀・池・植栽)は world.visible=false でまとめて非表示。
     scene直付け(屋敷人物・鳥獣・季節効果 等)は個別に非表示化。ただし
     光源と天体(太陽/月)は残す。ラベルは isObjVisible() 連動で自動的に消える。 */
  world.visible=false;
  const _kamaKeep=new Set([sunMesh,moonMesh,moonHalo]);
  scene.children.slice().forEach(o=>{ if(o.isLight||_kamaKeep.has(o))return; o.visible=false; });

  const worldK=new THREE.Group(); scene.add(worldK);

  /* 屋敷人物(household 11名)は非同期生成され、本ブロック実行時点(パース時)にはまだ scene 直下に
     存在せず、上の一括非表示を免れて鎌倉の庭に露出する(計画§4「平安の人物は出さない」に反する)。
     読み込み完了を見込んで数回、worldK と光源・天体を除く scene 直下を再非表示にして静的な平安人物を消す。
     worldK配下(鎌倉の全造形・人物)は除外＝鎌倉側は無傷、本処理は kamakura 時のみ到達＝平安側は無影響。
     ※毎フレーム再表示される平安のアイドル系(童/雀/鳥・陰陽師トースト等)は本掃除では消えない。
       それらの遮断は各更新系を APP.map で分岐する別対応が必要(既存の課題・本Wave対象外)。 */
  function _kamaHideForeign(){
    scene.children.forEach(o=>{ if(o===worldK||o.isLight||_kamaKeep.has(o))return; o.visible=false; });
  }
  [80,500,1200,2500,4500].forEach(t=>setTimeout(_kamaHideForeign,t));

  /* ---- 2. UI(自己完結・CSS注入): ミニマップと非散策モードのボタンを隠す ----
     既存関数は書き換えない。!important でJSのインラインstyleにも勝つ。
     季節/時刻/画質/音量の操作(topbar)はそのまま残す。 */
  (function(){
    /* 本ブロックはページ読み込み時に一度だけ実行されるため、二重注入チェックは不要 */
    document.documentElement.classList.add("map-kamakura");
    const st=document.createElement("style");
    st.textContent="html.map-kamakura #minimapWrap,html.map-kamakura #btnQuizMode,"
      +"html.map-kamakura #btnTaikenMode,html.map-kamakura #btnMiniGameMode,"
      +"html.map-kamakura #btnRenaiMode,html.map-kamakura #btnStory,"
      +"html.map-kamakura #btnCodex,html.map-kamakura #btnCareer,"
      +"html.map-kamakura #tbCodex,html.map-kamakura #tbMap,"
      +"html.map-kamakura #onboardKamakuraLink{display:none!important;}";
    /* ---- 配色(計画§1): 平安=金×朱×暖色の雅 → 鎌倉=藍×鉄紺×柿渋の質実。
       まず :root変数(金/朱/漆黒/胡粉)を html.map-kamakura スコープで上書きし、
       ページ全体に散る金色・朱色を一掃(--kin64件/--shu16件/--gofun40件を一括で
       鎌倉トークンへ)。そのうえで、色をハードコードした主要素(タイトル背景・
       onboardカード・主ボタン・トップバー地・toast地)を個別に鉄紺/藍へ差し替える。
       すべて html.map-kamakura スコープ＝平安側は1宣言も変わらない。 ---- */
    st.textContent+=
      "html.map-kamakura{--urushi:#0f141b;--kin:#5f86ac;--shu:#a8552e;--shu-bright:#c06a3a;--gofun:#dfe3d6;--moegi:#6f8f7a;}"
      /* タイトル画面の背景(鉄紺)。暖色の紙テクスチャ(::before opacity.92)を
         沈め・脱色して鉄紺グラデを前に出し、副題の暖色タンも寒色へ(金/朱の残り一掃) */
      +"html.map-kamakura #title{background:radial-gradient(ellipse at 50% 28%,#223141 0%,#161d26 58%,#0b0f15 100%)!important;}"
      +"html.map-kamakura #title::before{opacity:.2!important;filter:grayscale(.72) brightness(.68)!important;}"
      +"html.map-kamakura .t-sub{color:#9aa89e!important;}"
      +"html.map-kamakura #titleAudioHint{background:rgba(18,25,34,.55)!important;border-color:rgba(63,109,158,.45)!important;color:#c9cdbd!important;}"
      /* トップバー地(鉄紺)＋ロゴ(銀鼠) */
      +"html.map-kamakura #topbar{background:linear-gradient(180deg,rgba(18,25,34,.94),rgba(13,18,26,.82))!important;border-bottom-color:rgba(63,109,158,.5)!important;}"
      +"html.map-kamakura #topbar .brand{color:#c9cdbd!important;}"
      /* トップバーの常設ボタン(季節/時刻/画質/音量)とモードタグ: 暖色地/朱/金縁を鉄紺・藍へ。
         .tb-btn.on の地は --shu 上書きで既に柿渋になるため金縁だけ直す */
      +"html.map-kamakura .tb-btn{background:rgba(26,34,44,.85)!important;border-color:rgba(63,109,158,.5)!important;}"
      +"html.map-kamakura .tb-btn:hover,html.map-kamakura .tb-btn:focus-visible{border-color:rgba(111,143,122,.85)!important;}"
      +"html.map-kamakura .tb-btn.on{border-color:rgba(200,150,110,.9)!important;}"
      +"html.map-kamakura #modeTag{background:rgba(63,109,158,.85)!important;}"
      +"html.map-kamakura #tbTitle{background:linear-gradient(180deg,rgba(26,34,44,.96),rgba(18,25,34,.96))!important;}"
      /* onboardカード地(鉄紺)＋内部の文字を銀鼠へ反転(暗地対応) */
      +"html.map-kamakura .onboard-card{background:linear-gradient(100deg,#12181f,#1b232e 12%,#212c39 50%,#1b232e 88%,#12181f)!important;border-left-color:#3f6d9e!important;border-right-color:#3f6d9e!important;color:#c9cdbd!important;box-shadow:0 18px 72px rgba(0,0,0,.72),0 0 0 1px rgba(120,150,180,.28) inset!important;}"
      +"html.map-kamakura .onboard-card::before,html.map-kamakura .onboard-card::after{background:linear-gradient(180deg,#2f4a66,#182839)!important;}"
      +"html.map-kamakura .onboard-title{color:#d5d9cb!important;text-shadow:0 1px 0 rgba(0,0,0,.5)!important;}"
      +"html.map-kamakura .onboard-lead{color:#bcc1b2!important;}"
      +"html.map-kamakura .onboard-route{color:#aeb4a4!important;background:rgba(63,109,158,.12)!important;border-color:rgba(63,109,158,.42)!important;}"
      +"html.map-kamakura .onboard-skip{color:#aeb4a4!important;border-color:rgba(111,143,122,.42)!important;}"
      +"html.map-kamakura .onboard-skip:hover{color:#e6e9dd!important;border-color:#a8552e!important;}"
      /* 主ボタン(gold系→藍系グラデ。文字色/縁は変数上書きで追随) */
      +"html.map-kamakura .t-btn{background:linear-gradient(155deg,#3f6d9e,#22405f)!important;border-color:#6f93b8!important;}"
      +"html.map-kamakura .t-btn.gold{background:linear-gradient(155deg,#3f6d9e,#22405f)!important;border-color:#8fb0d2!important;}"
      +"html.map-kamakura .t-btn:hover,html.map-kamakura .t-btn:active{box-shadow:0 6px 18px rgba(63,109,158,.5)!important;}"
      /* toast地(鉄紺・藍縁) */
      +"html.map-kamakura #toast{background:linear-gradient(180deg,rgba(22,29,38,.96),rgba(11,15,21,.95))!important;border-color:rgba(63,109,158,.7)!important;}";
    (document.head||document.documentElement).appendChild(st);

    /* トップバーのロゴと文書タイトルを鎌倉仕様へ(平安の静的DOMを本マップ時のみ差替え。
       document.title はJS設定箇所が他に無く、静的<title>を上書きするだけで競合しない) */
    const brand=document.querySelector("#topbar .brand");
    if(brand)brand.textContent="武家屋敷探訪";
    document.title="鎌倉武家屋敷3D探訪 〜東国御家人の館を歩く〜";

    /* タイトル画面を鎌倉仕様へ差替え。
       「自分で選ぶ」(onboardSkip)は、不可視の平安オブジェクトを対象とする
       クイズ/立身伝等へ入れてしまい詰むため、このマップでは封鎖する。 */
    const t=document.getElementById("onboardTitle");
    if(t)t.textContent="ようこそ、鎌倉の武家屋敷へ";
    /* タイトル画面の大ロゴ(h1.t-main)も鎌倉名へ */
    const h1=document.querySelector("h1.t-main");
    if(h1)h1.innerHTML='武家屋敷<span class="shu">探訪</span>';
    const tnote=document.querySelector(".t-note");
    if(tnote)tnote.textContent="推奨: タブレット横向き / PC　　鎌倉時代・東国御家人の館";
    const lead=document.querySelector("#onboardPanel .onboard-lead");
    if(lead)lead.innerHTML="あなたは東国の御家人の館を訪れた、都育ちの見習い。堀を渡り、矢倉門をくぐり、武士の暮らしを歩いて確かめよう。<br>「寝殿造りと、どこが違うか」を探すことが、そのまま学びになる。";
    const route=document.querySelector("#onboardPanel .onboard-route");
    if(route)route.textContent="🚶散策で館を歩く → 🐎厩・的場・持仏堂を見つける → 🏯寝殿造りの邸と見比べる";
    const skip=document.getElementById("onboardSkip");
    if(skip)skip.style.display="none";
    const acts=document.querySelector("#onboardPanel .onboard-actions");
    if(acts){
      const a=document.createElement("a");
      a.href=location.pathname;
      a.textContent="↩ 平安の邸(寝殿造り)にもどる";
      a.style.cssText="display:block;margin-top:10px;font-size:12.5px;color:#8fb0d2;text-align:center;text-decoration:underline;text-underline-offset:3px;";
      acts.appendChild(a);
    }
    /* 開始ボタンの案内トーストを鎌倉仕様へ差替え(元は図鑑/立身伝という平安専用システムの案内) */
    const sw=document.getElementById("onboardStartWalk");
    if(sw)sw.onclick=()=>{
      onboardClose();
      enterMode("walk");
      setTimeout(()=>toast("左下のスティックで歩き、画面ドラッグで見回そう",3200),0);
      setTimeout(()=>toast("堀・土塁・矢倉門——寝殿造りとの「違い」を探してみよう",3400),3800);
      setTimeout(()=>toast("厩(うまや)の馬、的場の垜(あずち)、持仏堂も見どころだ",3400),7800);
    };
  })();

  /* ---- 3. プレイヤー開始位置: 矢倉門の外(南)。門へ正対して入る動線 ----
     設計書は Math.PI と記すが、本コードベースでは yaw=0 が北(門)向き
     (Math.PI は南=門に背を向ける)。playable性を優先し yaw=0 を採用。 */
  player.pos.set(0,player.pos.y,46); player.yaw=0; player.pitch=-.02;

  /* ---- 4. マテリアル/テクスチャ(手続き生成。canv が sRGBEncoding を付与) ---- */
  const MK={};
  /* 横板張り(板塀・板壁) */
  MK.itabei=M({map:canv(128,128,(x,w,h)=>{ x.fillStyle="#8a6a45";x.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=16){ x.fillStyle=`rgba(${rnd(120,150)|0},${rnd(92,116)|0},${rnd(58,78)|0},.92)`;x.fillRect(0,y,w,15);
      x.strokeStyle="rgba(50,34,18,.55)";x.lineWidth=2;x.beginPath();x.moveTo(0,y+15);x.lineTo(w,y+15);x.stroke();
      for(let i=0;i<9;i++){x.strokeStyle="rgba(60,42,24,.22)";x.lineWidth=1;x.beginPath();const yy=y+rnd(2,13);x.moveTo(0,yy);x.lineTo(w,yy);x.stroke();}
    }}),roughness:.85});
  /* 板葺き屋根(横板+石置き) */
  MK.itabuki=M({map:canv(256,256,(x,w,h)=>{ x.fillStyle="#6b5f4c";x.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=20){ x.fillStyle=`rgba(${rnd(96,124)|0},${rnd(86,108)|0},${rnd(68,86)|0},.92)`;x.fillRect(0,y,w,19);
      x.strokeStyle="rgba(38,30,20,.5)";x.lineWidth=2;x.beginPath();x.moveTo(0,y+19);x.lineTo(w,y+19);x.stroke();}
    for(let i=0;i<24;i++){x.fillStyle="rgba(70,66,60,.7)";x.beginPath();x.ellipse(rnd(0,w),rnd(0,h),rnd(4,9),rnd(3,6),0,0,7);x.fill();}
    }),roughness:.95,side:THREE.DoubleSide});
  /* 舞良戸(横桟の引戸) */
  MK.mairado=M({map:canv(128,128,(x,w,h)=>{ x.fillStyle="#b98d5c";x.fillRect(0,0,w,h);
    x.strokeStyle="rgba(70,46,26,.6)";x.lineWidth=2.5;for(let y=6;y<h;y+=11){x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke();}
    x.strokeStyle="rgba(90,62,34,.5)";x.lineWidth=3;[4,w-4].forEach(xx=>{x.beginPath();x.moveTo(xx,0);x.lineTo(xx,h);x.stroke();});
    }),roughness:.8,side:THREE.DoubleSide});
  /* 明障子(白+格子) */
  MK.shoji=M({map:canv(128,128,(x,w,h)=>{ x.fillStyle="#efe9d6";x.fillRect(0,0,w,h);
    x.strokeStyle="rgba(120,100,70,.5)";x.lineWidth=2;for(let i=1;i<5;i++){x.beginPath();x.moveTo(i*w/5,0);x.lineTo(i*w/5,h);x.stroke();x.beginPath();x.moveTo(0,i*h/5);x.lineTo(w,i*h/5);x.stroke();}
    }),roughness:.9,side:THREE.DoubleSide});
  /* 土(土塁・土間・畦・あずち・土橋) */
  MK.dorui=M({color:0x7a6142,roughness:1});
  MK.tsuchi=M({color:0x8a7150,roughness:1});
  /* 校倉/丸太(板倉・井桁) */
  MK.log=M({color:0x6e5334,roughness:.9});
  /* 的(同心円) */
  MK.mato=M({map:canv(128,128,(x,w,h)=>{ const cx=w/2,cy=h/2,cols=["#efe7d2","#20140c","#efe7d2","#20140c","#c23a28"];
    for(let i=0;i<cols.length;i++){x.fillStyle=cols[i];x.beginPath();x.arc(cx,cy,(w/2)*(1-i*0.19),0,Math.PI*2);x.fill();}
    }),roughness:.8,side:THREE.DoubleSide});
  /* 稲(田) */
  MK.ine=M({color:0x7f8a3e,roughness:1});
  /* 藁葺き(下人小屋) */
  MK.wara=M({color:0xa8894e,roughness:1,side:THREE.DoubleSide});
  /* 煙・矢狭間 */
  MK.smoke=new THREE.MeshBasicMaterial({color:0x9a938a,transparent:true,opacity:.26,depthWrite:false});
  MK.slit=new THREE.MeshBasicMaterial({color:0x140f0a});
  /* 馬の毛(茶=鹿毛 / 黒鹿毛) */
  const _hide=canv(128,128,(x,w,h)=>{ x.fillStyle="#5a3c22";x.fillRect(0,0,w,h);
    for(let i=0;i<700;i++){x.strokeStyle=`rgba(${rnd(90,130)|0},${rnd(60,90)|0},${rnd(34,54)|0},${rnd(.1,.3)})`;x.lineWidth=.8;const sx=rnd(0,w),sy=rnd(0,h);x.beginPath();x.moveTo(sx,sy);x.lineTo(sx+rnd(2,6),sy+rnd(-1,1));x.stroke();}});
  MK.umaKage=M({map:_hide,color:0x8a5a30,roughness:.9});
  MK.umaKuro=M({map:_hide,color:0x3e2c1c,roughness:.9});
  /* 草地(タイル) */
  MK.grass=M({map:canv(128,128,(x,w,h)=>{ x.fillStyle="#5f7444";x.fillRect(0,0,w,h);
    for(let i=0;i<1600;i++){x.fillStyle=`rgba(${rnd(70,110)|0},${rnd(96,140)|0},${rnd(52,84)|0},.5)`;x.fillRect(rnd(0,w),rnd(0,h),1.5,rnd(2,4));}
    }),roughness:1}); MK.grass.map.repeat.set(30,30);

  /* ---- 5. 汎用ビルダー ---- */
  function plane(mat,w,d,cx,y,cz){ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);m.rotation.x=-Math.PI/2;m.position.set(cx,y,cz);m.receiveShadow=true;return m; }
  function boardRoof(w,d,h,ridge,y){ const m=new THREE.Mesh(hipRoofGeo(w,d,h,ridge),MK.itabuki);m.position.y=y;m.castShadow=true;m.receiveShadow=true;return m; }

  /* 土塁+板塀 の一区間(horizontal=true は x方向、false は z方向に走る) */
  function rampart(cx,cz,len,horizontal){
    const g=new THREE.Group(); g.position.set(cx,0,cz);
    const w=horizontal?len:3, d=horizontal?3:len;
    g.add(box(w,1.3,d,MK.dorui,0,.65,0));                                   // 土塁(台形状の盛土)
    g.add(box(horizontal?len:.32,2.0,horizontal?.32:len,MK.itabei,0,2.3,0)); // 板塀
    g.add(box(horizontal?len:.5,.18,horizontal?.5:len,MAT.woodDark,0,3.35,0));// 笠木
    worldK.add(g); return g;
  }

  /* 板壁の武家棟(building()の骨組=床/柱/桁/屋根を流用し屋根を板葺きへ差替え、
     四面を板壁で囲む。open に入れた面は開放) */
  function bukeHall(w,d,fh,ph,roofH,open){
    const g=new THREE.Group();
    const b=building({w:w,d:d,fh:fh,ph:ph,roofH:roofH,ridge:.5,wall:false,doors:[]});
    b.traverse(m=>{ if(m.isMesh&&m.material===MAT.roof)m.material=MK.itabuki; });
    g.add(b);
    const wh=ph-.2, wy=fh+wh/2;
    const faces={N:[0,-d/2+.08,w-.4,.12],S:[0,d/2-.08,w-.4,.12],E:[w/2-.08,0,.12,d-.4],W:[-w/2+.08,0,.12,d-.4]};
    Object.keys(faces).forEach(k=>{ if(open&&open.indexOf(k)>=0)return; const f=faces[k]; g.add(box(f[2],wh,f[3],MK.itabei,f[0],wy,f[1])); });
    return g;
  }

  /* 馬(静止立ちポーズ)。頭は +z 向き。coat=毛色マテリアル */
  function makeUma(coat){
    const g=new THREE.Group();
    const hoof=M({color:0x241c15,roughness:.8}), mane=M({color:0x2a1e14,roughness:.9});
    g.add(box(.62,.86,1.7,coat,0,1.15,0));                                        // 胴
    const chest=new THREE.Mesh(new THREE.SphereGeometry(.44,10,8),coat);chest.position.set(0,1.15,.8);chest.scale.set(1,1,.7);g.add(chest);
    const rump=new THREE.Mesh(new THREE.SphereGeometry(.46,10,8),coat);rump.position.set(0,1.2,-.82);rump.scale.set(1,1,.7);g.add(rump);
    const neck=box(.42,.9,.5,coat,0,1.6,1.0);neck.rotation.x=-.7;g.add(neck);      // 首
    const head=box(.34,.34,.7,coat,0,2.0,1.42);head.rotation.x=.35;g.add(head);    // 頭
    g.add(box(.28,.28,.3,coat,0,1.86,1.68));                                       // 鼻面
    [-1,1].forEach(s=>{const e=box(.08,.2,.1,coat,s*.12,2.18,1.28);e.rotation.x=-.2;g.add(e);});           // 耳
    [-1,1].forEach(s=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),new THREE.MeshBasicMaterial({color:0x0a0806}));e.position.set(s*.16,2.02,1.5);g.add(e);}); // 目
    for(let i=0;i<6;i++){const m=box(.1,.22,.14,mane,0,1.9-i*.02,1.15-i*.11);m.rotation.x=-.7;g.add(m);}    // 鬣
    [[.24,.62],[-.24,.62],[.24,-.6],[-.24,-.6]].forEach(p=>{                        // 4脚+蹄
      g.add(cyl(.1,.09,1.06,coat,p[0],.55,p[1],7)); g.add(cyl(.12,.12,.14,hoof,p[0],.07,p[1],7)); });
    const tail=cyl(.06,.14,.72,mane,0,1.15,-.95,6);tail.rotation.x=-.5;g.add(tail); // 尾
    g.traverse(o=>{ if(o.isMesh){o.castShadow=true;o.receiveShadow=true;} });
    return g;
  }

  /* 武士(直垂+袴+侍烏帽子)。前(顔)は +z 向き。makeLowRankPerson の円柱体型を参考にした新規実装 */
  function makeBushiFigure(o){
    o=o||{};
    const scale=o.scale||1,
      cloth=M({color:o.monk?0x3b3a36:(o.color||0x27506b),roughness:.85}),   // 僧は墨染めの灰黒
      hakama=M({color:o.monk?0x2f2e2a:(o.hakama||0x6b3a24),roughness:.85}),
      skin=M({color:0xe3c39c,roughness:.7}), black=M({color:0x14110d,roughness:.6});
    const g=new THREE.Group();
    const lower=new THREE.Mesh(new THREE.CylinderGeometry(.22,.34,.9,10),hakama);lower.position.y=.46;g.add(lower); // 袴
    [-1,1].forEach(s=>{ g.add(cyl(.06,.07,.28,black,s*.12,.14,.02,7)); g.add(box(.14,.06,.24,black,s*.12,.03,.08,false)); }); // 足首/足
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.21,.26,.62,10),cloth);body.position.y=1.0;g.add(body); // 直垂上衣(筒袖)
    g.add(box(.44,.05,.27,hakama,0,.74,.03)); // 胸紐
    if(o.pose==="draw"){                                                                                                     // 弓を引く静止ポーズ(腕の角度で表現)
      const la=new THREE.Mesh(new THREE.CylinderGeometry(.055,.08,.54,8),cloth);la.position.set(.26,1.08,.28);la.rotation.x=-1.15;g.add(la);   // 左腕(前方へ・弓を保持)
      const lh=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),skin);lh.position.set(.30,1.14,.54);g.add(lh);
      const ra=new THREE.Mesh(new THREE.CylinderGeometry(.055,.08,.42,8),cloth);ra.position.set(-.14,1.16,-.02);ra.rotation.z=.55;g.add(ra);   // 右腕(引き絞り)
      const rh=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),skin);rh.position.set(0,1.3,.06);g.add(rh);                                    // 右手(弦を頬へ)
      g.add(cyl(.02,.02,1.7,M({color:0x5b3a22,roughness:.7}),.30,1.14,.54,7));                                                                 // 弓(縦)
      const su=cyl(.006,.006,.9,new THREE.MeshBasicMaterial({color:0xece3cf}),.17,1.5,.34,4);su.rotation.z=-.5;su.rotation.x=.2;g.add(su);      // 弦(上)
      const sd=cyl(.006,.006,.9,new THREE.MeshBasicMaterial({color:0xece3cf}),.17,.78,.34,4);sd.rotation.z=.5;sd.rotation.x=-.2;g.add(sd);      // 弦(下)
      const ya=cyl(.012,.012,.95,M({color:0x8a7048,roughness:.7}),.16,1.2,.3,5);ya.rotation.x=Math.PI/2;g.add(ya);                             // 矢
    } else {
      [-1,1].forEach(s=>{
        const arm=new THREE.Mesh(new THREE.CylinderGeometry(.06,.085,.5,8),cloth);arm.position.set(s*.28,1.02,.05);arm.rotation.z=s*.28;g.add(arm);
        const hand=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),skin);hand.position.set(s*.37,.8,.12);g.add(hand);
      });
    }
    const head=new THREE.Mesh(new THREE.SphereGeometry(.135,12,10),skin);head.position.set(0,1.42,.02);head.scale.set(1,1.12,1);g.add(head);
    if(o.kasa){                                                                                                             // 円錐の笠(農夫)
      const kasa=new THREE.Mesh(new THREE.ConeGeometry(.32,.28,16),M({color:o.kasaColor||0xc7a867,roughness:.95}));kasa.position.set(0,1.60,0);kasa.castShadow=true;kasa.receiveShadow=true;g.add(kasa);
    } else if(!o.monk){                                                                                                     // 侍烏帽子(僧は剃髪＝被り物なし)
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(.09,.115,.2,10),black);cap.position.set(0,1.58,-.01);cap.rotation.x=-.12;g.add(cap);
      const capTop=box(.16,.1,.17,black,0,1.68,-.03);capTop.rotation.x=-.2;g.add(capTop);
    }
    [-1,1].forEach(s=>g.add(box(.03,.008,.008,new THREE.MeshBasicMaterial({color:0x201510}),s*.045,1.44,.14,false)));                          // 目
    if(o.monk){                                                                                                             // 数珠(小球の連なり)
      const bm=M({color:0x4a3a2c,roughness:.7});
      for(let i=0;i<14;i++){const a=i/14*Math.PI*2;const bd=new THREE.Mesh(new THREE.SphereGeometry(.02,6,5),bm);bd.position.set(Math.cos(a)*.15,.9,.12+Math.sin(a)*.05);g.add(bd);}
    }
    if(o.kuwa){                                                                                                             // 鍬(柄+刃)
      const sh=cyl(.022,.022,1.1,M({color:0x7a5a34,roughness:.8}),.30,.72,.34,6);sh.rotation.x=-.9;g.add(sh);
      g.add(box(.19,.04,.15,M({color:0x39332a,roughness:.55}),.30,.24,.74));
    }
    if(o.oke){                                                                                                              // 飼葉桶を抱える
      g.add(cyl(.16,.13,.2,M({color:0x8a6a45,roughness:.85}),0,.9,.3,10));
      g.add(cyl(.14,.12,.05,M({color:0xc7a867,roughness:1}),0,1.0,.3,10));
    }
    if(o.tachi){const sh=cyl(.03,.025,.85,M({color:0x2a2018,roughness:.45}),-.28,.72,-.03,8);sh.rotation.z=.5;sh.rotation.x=.12;g.add(sh);}     // 太刀(黒漆鞘)
    if(o.yumi&&o.pose!=="draw"){const bow=cyl(.02,.02,1.55,M({color:0x5b3a22,roughness:.7}),.42,.95,.06,7);bow.rotation.z=.14;g.add(bow);}      // 弓(携行)
    g.scale.setScalar(scale);
    g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} });
    return g;
  }

  /* ---- 6. 地形: 草地・堀・空堀・土橋 ---- */
  worldK.add(plane(MK.grass,140,140,0,-0.02,0));                               // 全体の草地
  const MOAT0=37,MOAT1=42;
  worldK.add(plane(MAT.water,2*MOAT1,MOAT1-MOAT0,0,.05,(MOAT0+MOAT1)/2));      // 南の水堀
  worldK.add(plane(MAT.water,MOAT1-MOAT0,MOAT0+MOAT1,(MOAT0+MOAT1)/2,.05,2.5));// 東の水堀
  worldK.add(plane(MAT.water,MOAT1-MOAT0,MOAT0+MOAT1,-(MOAT0+MOAT1)/2,.05,2.5));//西の水堀
  worldK.add(plane(MK.dorui,2*MOAT1,MOAT1-MOAT0,0,-.35,-(MOAT0+MOAT1)/2));     // 北の空堀(乾いた溝)
  worldK.add(plane(MK.grass,2*MOAT1,1.4,0,-.04,-MOAT0-.2));                    // 空堀の縁草
  worldK.add(box(6,.3,8.5,MK.dorui,0,.16,39.3));                              // 南の土橋(堀を渡る)
  worldK.add(box(5.4,.08,8.5,MAT.woodDark,0,.32,39.3));                       // 土橋の板張り天端

  /* ---- 7. 土塁+板塀(郭の四周。南=矢倉門・北=裏木戸の開口を空ける) ---- */
  const R=35;
  rampart(-19.5,R,31,true); rampart(19.5,R,31,true);      // 南辺(矢倉門の左右)
  rampart(-18.5,-R,33,true); rampart(18.5,-R,33,true);    // 北辺(裏木戸の左右)
  rampart(R,0,2*R,false); rampart(-R,0,2*R,false);        // 東辺・西辺

  /* ---- 8. 矢倉門(南辺中央)・裏木戸(北辺)・物見矢倉(南東隅) ---- */
  (function yaguraGate(){
    const g=new THREE.Group(); g.position.set(0,0,R);
    [[-3,-.9],[3,-.9],[-3,.9],[3,.9]].forEach(p=>g.add(box(.5,4.2,.5,MAT.woodDark,p[0],2.1,p[1]))); // 四本柱
    g.add(box(7.4,.45,.45,MAT.woodDark,0,4.1,-.9)); g.add(box(7.4,.45,.45,MAT.woodDark,0,4.1,.9));   // 梁
    g.add(box(7.6,2.0,2.6,MK.itabei,0,5.3,0));                                                        // 上層矢倉(板壁)
    for(let i=-2;i<=2;i++)g.add(box(.28,.5,.08,MK.slit,i*1.4,5.4,1.33,false));                        // 矢狭間(南面)
    g.add(boardRoof(9,4,1.4,.5,6.4));                                                                 // 板屋根
    [-1,1].forEach(s=>{const dr=box(1.5,3.4,.12,MK.itabei,s*1.7,1.7,-.05);dr.rotation.y=s*.32;g.add(dr);});// 門扉(半開)
    worldK.add(g);
  })();
  (function backGate(){
    const g=new THREE.Group(); g.position.set(0,0,-R);
    [-1.2,1.2].forEach(x=>g.add(box(.3,2.8,.3,MAT.woodDark,x,1.4,0)));
    g.add(box(2.7,.25,.4,MAT.woodDark,0,2.7,0));
    g.add(box(2.0,2.3,.1,MK.itabei,.2,1.25,0));            // 片開き板戸
    g.add(box(3.4,.2,1.2,MK.itabuki,0,2.98,0));            // 小屋根
    worldK.add(g);
  })();
  (function watchtower(){
    const g=new THREE.Group(); g.position.set(31,0,31);
    const P=[[-1.5,-1.5],[1.5,-1.5],[-1.5,1.5],[1.5,1.5]];
    P.forEach(p=>g.add(box(.35,4.5,.35,MAT.woodDark,p[0],2.25,p[1])));         // 4本柱
    g.add(box(3.7,.2,.2,MAT.woodDark,0,2.2,-1.5)); g.add(box(3.7,.2,.2,MAT.woodDark,0,2.2,1.5)); // 貫
    g.add(box(3.9,.3,3.9,MAT.floor,0,4.4,0));                                  // 高床
    [-1,1].forEach(s=>{ g.add(box(3.9,.5,.1,MAT.woodDark,0,4.85,s*1.9));g.add(box(.1,.5,3.9,MAT.woodDark,s*1.9,4.85,0)); }); // 手すり
    P.forEach(p=>g.add(box(.2,1.5,.2,MAT.woodDark,p[0],5.3,p[1])));            // 上部柱
    g.add(boardRoof(5.2,5.2,1.7,.5,6.05));                                     // 板屋根
    const lad=new THREE.Group(); lad.position.set(0,0,2.3); lad.rotation.x=.16;
    [-.5,.5].forEach(x=>lad.add(box(.1,4.7,.1,MAT.wood,x,2.35,0)));
    for(let i=0;i<7;i++)lad.add(box(1.1,.08,.08,MAT.wood,0,.6+i*.6,0));        // 梯子
    g.add(lad); worldK.add(g);
  })();

  /* ---- 9. 主殿(郭中央やや北・南面開放で内部を見せる) ---- */
  (function shuden(){
    const cx=0,cz=-5,w=17,d=11,fh=1.0,ph=2.8;
    const b=building({w:w,d:d,fh:fh,ph:ph,roofH:4.6,ridge:.5,wall:false,doors:[]});
    b.position.set(cx,0,cz); b.traverse(m=>{ if(m.isMesh&&m.material===MAT.roof)m.material=MK.itabuki; });
    worldK.add(b);
    const wy=fh+ (ph-.2)/2;
    worldK.add(box(w-.5,ph-.2,.14,MK.mairado,cx,wy,cz-d/2+.1));                // 北面: 舞良戸(蔀の差替え)
    worldK.add(box(.14,ph-.2,d*.62,MK.mairado,cx-w/2+.1,wy,cz-1.7));          // 西面: 舞良戸
    worldK.add(box(.14,ph-.2,d*.62,MK.shoji,cx+w/2-.1,wy,cz-1.7));           // 東面: 明障子
    worldK.add(box(6.2,ph-.2,.1,MK.shoji,cx+4.6,wy,cz+d/2-.1));              // 南面東寄り: 明障子(残り開放)
    /* 置き畳 2〜3枚 */
    [[cx-3,cz-1],[cx-3,cz-3.4],[cx+2.4,cz-2]].forEach(p=>worldK.add(box(1.8,.14,2.6,MAT.tatami,p[0],1.02,p[1])));
    /* 囲炉裏(炉+灰+炎+火光) */
    const ir=new THREE.Group(); ir.position.set(cx+2.0,0,cz-4.4);
    ir.add(box(1.4,.2,1.4,MAT.woodDark,0,.98,0)); ir.add(box(1.06,.1,1.06,MAT.ash,0,1.02,0));
    const f1=new THREE.Mesh(new THREE.ConeGeometry(.28,.62,8),MAT.flame);f1.position.y=1.32;ir.add(f1);
    const f2=new THREE.Mesh(new THREE.ConeGeometry(.15,.4,7),new THREE.MeshBasicMaterial({color:0xffe27a}));f2.position.y=1.42;ir.add(f2);
    const il=new THREE.PointLight(0xffa050,.7,9,2);il.position.set(0,1.7,0);ir.add(il);
    worldK.add(ir);
    /* 女房(妻)1名: makeHeianFigure を色数を落として流用。主殿内に着座 */
    const nyobo=makeHeianFigure({role:"nyoubou",palette:[0x6a6550,0x847d63,0x9c9377,0x5a5c48],scale:1,pose:"seated"});
    nyobo.position.set(cx-2.6,1.0,cz-1.4); nyobo.rotation.y=Math.PI*0.15; worldK.add(nyobo);
  })();

  /* ---- 10. 侍所・持仏堂・板倉・厩・竈屋・井戸・湯屋・厠 ---- */
  const samurai=bukeHall(9,6,.8,2.4,3.2,["S"]); samurai.position.set(-15,0,22); worldK.add(samurai); // 侍所(門内北西)

  (function jibutsudo(){                                                         // 持仏堂(北西・方一間+宝形板屋根+金小仏)
    const g=new THREE.Group(); g.position.set(-20,0,-18); const s=4.0;
    g.add(box(s,.3,s,MAT.floor,0,.6,0));
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(p=>g.add(box(.25,2.4,.25,MAT.woodDark,p[0]*s*.42,1.8,p[1]*s*.42)));
    g.add(box(s,2.2,.12,MK.itabei,0,1.75,-s/2+.1)); g.add(box(.12,2.2,s,MK.itabei,-s/2+.1,1.75,0)); g.add(box(.12,2.2,s,MK.itabei,s/2-.1,1.75,0));
    g.add(boardRoof(s+1.4,s+1.4,2.0,.02,3.0));                                   // 宝形(ridge≈0でピラミッド状)
    g.add(box(.3,.5,.3,MAT.kin,0,5.0,0));                                        // 露盤・宝珠(金)
    const bd=new THREE.Group(); bd.position.set(0,.75,-.5);
    bd.add(cyl(.36,.46,.16,MAT.kin,0,.08,0,12)); bd.add(new THREE.Mesh(new THREE.SphereGeometry(.4,12,10),MAT.kin));
    const bh=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8),MAT.kin);bh.position.y=.55;bd.add(bh);
    g.add(bd); g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} }); worldK.add(g);
  })();

  (function itakura(){                                                           // 板倉(北東・高床+校倉風井桁壁+妻入屋根)
    const g=new THREE.Group(); g.position.set(18,0,-20); const w=6,d=4.5,fh=1.6;
    [[-1,-1],[1,-1],[-1,1],[1,1],[0,0]].forEach(p=>g.add(cyl(.2,.24,fh,MAT.woodDark,p[0]*w*.35,fh/2,p[1]*d*.35,8))); // 床束
    g.add(box(w,.3,d,MAT.floor,0,fh,0));                                          // 高床
    const wallH=2.4,n=9,dy=wallH/n;
    for(let i=0;i<n;i++){ const y=fh+.3+i*dy+dy/2;
      const a=cyl(.14,.14,w,MK.log,0,y,-d/2,7);a.rotation.z=Math.PI/2;g.add(a);
      const b=cyl(.14,.14,w,MK.log,0,y,d/2,7);b.rotation.z=Math.PI/2;g.add(b);
      const c=cyl(.14,.14,d,MK.log,-w/2,y,0,7);c.rotation.x=Math.PI/2;g.add(c);
      const e=cyl(.14,.14,d,MK.log,w/2,y,0,7);e.rotation.x=Math.PI/2;g.add(e);
    }
    g.add(boardRoof(w+1.6,d+1.6,1.9,.6,fh+.3+wallH+.1));                          // 妻入り板屋根
    g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} }); worldK.add(g);
  })();

  (function umaya(){                                                             // 厩(主殿の東・三間吹き放ち+繋ぎ横木+馬2頭)
    const g=new THREE.Group(); g.position.set(18,0,0); const w=9,d=4,ph=2.6;
    for(let i=0;i<4;i++){ const x=-w/2+i*(w/3); g.add(box(.3,ph,.3,MAT.woodDark,x,ph/2,-d/2+.3)); g.add(box(.3,ph,.3,MAT.woodDark,x,ph/2,d/2-.3)); }
    g.add(box(w,.25,.25,MAT.woodDark,0,ph,-d/2+.3)); g.add(box(w,.25,.25,MAT.woodDark,0,ph,d/2-.3)); // 桁
    g.add(box(w,ph,.12,MK.itabei,0,ph/2,-d/2+.2));                                // 背面板壁
    g.add(box(w-1,.12,.12,MAT.wood,0,1.2,d/2-.6));                                // 繋ぎ横木
    for(let i=1;i<3;i++)g.add(box(.1,1.6,d-1,MK.itabei,-w/2+i*(w/3),.8,0));       // 仕切り
    g.add(box(w,.06,d,MK.dorui,0,.03,0));                                         // 土間
    g.add(boardRoof(w+1.5,d+2,1.5,.7,ph+.2));                                     // 板屋根
    g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} }); worldK.add(g);
    const h1=makeUma(MK.umaKage);h1.position.set(16,0,.2);worldK.add(h1);
    const h2=makeUma(MK.umaKuro);h2.position.set(20,0,.2);worldK.add(h2);
  })();

  (function kamaya(){                                                            // 竈屋(主殿の北・土間+竈+煙)
    const g=new THREE.Group(); g.position.set(0,0,-16); const w=6,d=4,ph=2.4;
    for(const px of[-w/2+.3,w/2-.3])for(const pz of[-d/2+.3,d/2-.3])g.add(box(.25,ph,.25,MAT.woodDark,px,ph/2,pz));
    g.add(box(w,.06,d,MK.dorui,0,.03,0));                                         // 土間
    g.add(box(w,ph,.12,MK.itabei,0,ph/2,-d/2+.15)); g.add(box(.12,ph,d,MK.itabei,-w/2+.15,ph/2,0));
    g.add(boardRoof(w+1.5,d+1.5,1.4,.6,ph+.15));
    const kama=box(1.6,.9,1.0,MK.tsuchi,-1,.45,-.6); g.add(kama);                 // 竈本体(土)
    g.add(cyl(.35,.4,.12,MK.tsuchi,-.8,.95,-.6,12));                              // 釜口
    const fk=new THREE.Mesh(new THREE.ConeGeometry(.16,.34,7),MAT.flame);fk.position.set(-1.4,.3,-.05);fk.rotation.x=.4;g.add(fk); // 焚口の火
    g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} }); worldK.add(g);
    for(let i=0;i<5;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(.3+i*.12,8,6),MK.smoke);s.position.set(-1+Math.sin(i)*.4,ph+.7+i*.75,-16-.6);worldK.add(s);} // 煙
  })();

  (function ido(){                                                               // 井戸(竈屋脇・井桁+屋根+桶)
    const g=new THREE.Group(); g.position.set(6,0,-16); const s=1.2;
    for(let i=0;i<3;i++){ const y=.3+i*.25;
      const a=cyl(.09,.09,s+.4,MK.log,0,y,-s/2,7);a.rotation.z=Math.PI/2;g.add(a);
      const b=cyl(.09,.09,s+.4,MK.log,0,y,s/2,7);b.rotation.z=Math.PI/2;g.add(b);
      const c=cyl(.09,.09,s+.4,MK.log,-s/2,y+.12,0,7);c.rotation.x=Math.PI/2;g.add(c);
      const e=cyl(.09,.09,s+.4,MK.log,s/2,y+.12,0,7);e.rotation.x=Math.PI/2;g.add(e);
    }
    [-s/2,s/2].forEach(x=>g.add(box(.12,2.3,.12,MAT.woodDark,x,1.4,0)));          // 支柱
    g.add(box(.14,.14,s+.6,MAT.woodDark,0,2.5,0));                                // 桁
    g.add(boardRoof(s+1.2,s+1.0,.8,.6,2.6));
    g.add(cyl(.18,.16,.28,MAT.wood,0,1.55,0,10));                                 // 桶
    g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} }); worldK.add(g);
  })();

  (function koya(cx,cz,w,d){ // 湯屋・厠(北辺際の小屋・外観のみ)
    [[-9,-31,3,2.6],[-5,-31,1.9,1.9]].forEach(a=>{
      const g=new THREE.Group(); g.position.set(a[0],0,a[1]); const ph=2.0;
      g.add(box(a[2],ph,a[3],MK.itabei,0,ph/2,0)); g.add(boardRoof(a[2]+.8,a[3]+.8,.9,.6,ph+.1));
      g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} }); worldK.add(g);
    });
  })();

  /* ---- 11. 武芸の場: 的場(郭内南東)・馬場(郭外南・笠懸+馬1頭) ---- */
  (function matoba(){
    const g=new THREE.Group(); g.position.set(20,0,18);
    g.add(box(4,1.6,1.6,MK.dorui,0,.8,-1.2));                                     // 垜(あずち・土盛り)
    [-.9,.9].forEach(x=>g.add(box(.15,1.6,.15,MAT.woodDark,x,.8,0)));             // 的の支柱
    const mato=new THREE.Mesh(new THREE.CylinderGeometry(.7,.7,.08,20),MK.mato);mato.rotation.x=Math.PI/2;mato.position.set(0,1.4,0);g.add(mato); // 丸的
    g.add(box(1.2,.05,1.8,MAT.tatami,0,.03,6));                                   // 射座
    g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} }); worldK.add(g);
  })();
  (function baba(){
    const cz=50;
    for(let x=-30;x<=30;x+=5){ worldK.add(box(.15,1.2,.15,MAT.wood,x,.6,cz-3.5)); worldK.add(box(.15,1.2,.15,MAT.wood,x,.6,cz+3.5)); } // 柵
    worldK.add(box(62,.1,.1,MAT.wood,0,1.0,cz-3.5)); worldK.add(box(62,.1,.1,MAT.wood,0,1.0,cz+3.5));                                   // 横木
    [-18,-2,14].forEach(x=>{ worldK.add(box(.12,2.6,.12,MAT.woodDark,x,1.3,cz-4.2)); worldK.add(box(.7,.7,.1,MK.mato,x,1.8,cz-4.2)); });// 笠懸の的
    const h=makeUma(MK.umaKage);h.position.set(-6,0,cz);h.rotation.y=Math.PI/2;worldK.add(h);                                          // 馬1頭
  })();

  /* ---- 12. 周辺(郭外西): 水田(畦+水面/稲面) と 下人小屋 ---- */
  (function ta(){
    const ox=-48,oz=0;
    for(let i=0;i<3;i++)for(let j=0;j<4;j++){
      const x=ox+i*7, z=oz-18+j*11, flooded=((i+j)%2===0);
      worldK.add(plane(flooded?MAT.water:MK.ine,6,10,x,flooded?.03:.05,z));       // 水田面 or 稲面
      worldK.add(box(6.4,.15,.3,MK.dorui,x,.08,z-5)); worldK.add(box(6.4,.15,.3,MK.dorui,x,.08,z+5)); // 畦
      worldK.add(box(.3,.15,10,MK.dorui,x-3,.08,z)); worldK.add(box(.3,.15,10,MK.dorui,x+3,.08,z));
    }
  })();
  (function genin(){                                                             // 下人小屋(田の際・藁葺き)
    [[-51,12],[-51,-6]].forEach(p=>{
      const g=new THREE.Group(); g.position.set(p[0],0,p[1]);
      g.add(box(3.4,1.8,2.8,MK.itabei,0,.9,0)); g.add(boardRoof(4.4,3.8,1.8,.4,1.9)); // ↓屋根は藁葺き色へ差替え
      g.children[g.children.length-1].material=MK.wara;
      g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} }); worldK.add(g);
    });
  })();

  /* ---- 13. 植栽(松・雑木。tree()流用。SEASONAL登録せず=常時表示) ---- */
  [[30,-30,3.4,"old"],[-30,-31,3.0,null],[32,10,3.2,"old"],[-28,29,2.8,null],[11,31,3.0,null],
   [-11,-29,3.2,"old"],[27,-9,2.6,null],[-46,26,3.0,null],[47,-24,3.2,"old"],[45,21,2.6,null],
   [-31,7,2.8,null],[24,-31,3.0,"old"]].forEach(p=>{
    const t=tree(p[2],p[3]); t.position.set(p[0],0,p[1]); worldK.add(t);
  });

  /* ---- 14. 人物(武士): あるじ1名(主殿前) + 郎党2名(侍所前・的場) ---- */
  const aruji=makeBushiFigure({color:0x27506b,hakama:0x6b3a24,tachi:true,scale:1.06}); // 藍の直垂・柿渋の袴
  aruji.position.set(2.5,0,4); aruji.rotation.y=0; worldK.add(aruji);                   // 主殿前・門(南)へ正対
  const rodo1=makeBushiFigure({color:0x4a4a3a,hakama:0x5a3a28,yumi:true});               // 侍所前
  rodo1.position.set(-15,0,26); rodo1.rotation.y=0; worldK.add(rodo1);
  const rodo2=makeBushiFigure({color:0x2f4f6b,hakama:0x4a3b2a,yumi:true});               // 的場
  rodo2.position.set(20,0,23); rodo2.rotation.y=Math.PI; worldK.add(rodo2);              // 的(北)へ向かう

  /* ---- 15. 全メッシュに影を付与(取りこぼし防止) ---- */
  worldK.traverse(o=>{ if(o.isMesh){ if(o.castShadow===undefined)o.castShadow=true; if(o.receiveShadow===undefined)o.receiveShadow=true; } });

  /* ---- 16. 旧マップ由来の不可視判定を無効化(関数上書き・本ガード内のみ到達) ----
     寝殿の池(inPond)と床段差(groundH/floorZones)は座標がこのマップと重なり、
     見えない進入ブロック/段差として誤発動する。function宣言は再代入可能なので
     kamakura時のみ置き換える(既定マップは本ブロック自体が実行されず影響ゼロ)。
     KAMA_ZONES: [cx,cz,w,d,床高] — 歩いて上がれる床(主殿/侍所/持仏堂/土橋)のみ登録。 */
  const KAMA_ZONES=[
    [0,39.3,6,8.5,.36],   // 土橋(堀渡り)
    [0,-5,17,11,1.0],     // 主殿の床
    [-15,22,9,6,.8],      // 侍所の床
    [-20,-18,4,4,.75]     // 持仏堂の床
  ];
  inPond=function(){ return false; };
  groundH=function(px,pz){
    let h=0;
    for(const z of KAMA_ZONES){ if(Math.abs(px-z[0])<=z[2]/2 && Math.abs(pz-z[1])<=z[3]/2 && z[4]>h) h=z[4]; }
    return h;
  };

  /* ---- 17. モード進入の入口ゲート(散策専用マップの根本保証) ----
     クイズ/立身伝/物語などは不可視の平安オブジェクトを対象とするため、
     どのUI経路(ボタン・メニュー・将来の導線)から呼ばれても enterMode で一括遮断する。
     モード紹介カード(modeBriefData)の散策文も鎌倉仕様に差し替える。 */
  const _enterMode=enterMode;
  enterMode=function(m){
    if(m!=="walk"&&m!=="title"){ toast("この館は散策専用です(クイズ等は平安の邸で)",2600); return; }
    return _enterMode(m);
  };
  const _modeBriefData=modeBriefData;
  modeBriefData=function(m){
    if(m==="walk")return {kicker:"KAMAKURA",title:"武家の館を歩く",
      lead:"鎌倉時代・東国御家人の館。寝殿造りの邸と「どこが違うか」を探しながら歩く散策モードです。",
      goals:["堀・土塁・矢倉門——「守りの構え」を見つける","主殿・厩・的場・持仏堂を見つける","寝殿造りとの違いを3つ、自分の言葉で言ってみる"],
      controls:["WASD / ジョイスティック:移動","画面ドラッグ:見回す","👁:俯瞰"]};
    return _modeBriefData(m);
  };

  /* ---- 18. 調度品・外構ディテール・人物増強(計画§2/§3) ----
     すべて worldK 配下の add-on。box/cyl/canv のプロシージャル生成で既存の造形密度に揃える。
     夜の篝火は炎コーン+PointLight を流用し、負荷配慮で火(PointLight)は2箇所まで。
     平安側は本ブロック自体が実行されないため無影響。 */
  (function detailsKama(){
    const straw=M({color:0xc7a867,roughness:1});                                    // 藁色(円座/飼葉)
    const strawTex=M({map:canv(64,64,(x,w,h)=>{ x.fillStyle="#c2a05f";x.fillRect(0,0,w,h);
      for(let i=0;i<240;i++){x.strokeStyle=`rgba(${rnd(150,195)|0},${rnd(120,165)|0},${rnd(70,105)|0},.55)`;const sx=rnd(0,w),sy=rnd(0,h);x.beginPath();x.moveTo(sx,sy);x.lineTo(sx+rnd(-2,2),sy+rnd(3,8));x.stroke();} }),roughness:1,side:THREE.DoubleSide});
    const kuroU=M({color:0x17130e,roughness:.35});                                  // 黒漆(鞘・火桶)
    const paper=M({color:0xe8e0cc,roughness:.9,side:THREE.DoubleSide});             // 巻紙・経巻
    const screen=M({color:0xd9d0b6,roughness:.95,side:THREE.DoubleSide});           // 屏風の地
    const iron=M({color:0x2f2a22,roughness:.5});                                    // 黒鉄(乳金物・半鐘台・鍬刃) ※金色を避ける
    const bronze=M({color:0x6a5c3a,roughness:.5});                                  // 青銅(香炉・半鐘)
    const charcoal=M({color:0x1c1712,roughness:.9});
    const rope=M({color:0x9a7b46,roughness:1});
    const rice=M({map:canv(64,64,(x,w,h)=>{ x.fillStyle="#b79a5c";x.fillRect(0,0,w,h);
      for(let y=0;y<h;y+=6){x.strokeStyle="rgba(88,66,32,.5)";x.lineWidth=2;x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke();} }),roughness:1}); // 俵の縄目
    const sand=M({color:0xd7d0be,roughness:1});
    const whiteCloth=M({color:0xe8e6dc,roughness:.9,side:THREE.DoubleSide});
    const packed=M({color:0x6b5a3f,roughness:1});                                   // 踏み固め土
    const dishMat=M({color:0x3a2f22,roughness:.6});
    const bowWood=M({color:0x5b3a22,roughness:.7});
    const emberBM=new THREE.MeshBasicMaterial({color:0xd8641e});
    const yFlame=new THREE.MeshBasicMaterial({color:0xffe27a});
    function sph(r,mat,x,y,z,seg){const m=new THREE.Mesh(new THREE.SphereGeometry(r,seg||10,(seg||10)-2),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;}
    function con(r,hh,mat,x,y,z,seg){const m=new THREE.Mesh(new THREE.ConeGeometry(r,hh,seg||10),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;}
    function flame(r,hh,mat,x,y,z){const m=new THREE.Mesh(new THREE.ConeGeometry(r,hh,7),mat);m.position.set(x,y,z);return m;} // 炎(emissive・影なし)
    function enza(x,z){worldK.add(cyl(.42,.42,.05,strawTex,x,1.04,z,16));worldK.add(cyl(.44,.4,.03,straw,x,1.07,z,16));}      // 円座
    function toudai(x,z){const g=new THREE.Group();g.position.set(x,1.0,z);g.add(cyl(.05,.07,.9,MAT.woodDark,0,.45,0,8));g.add(cyl(.17,.12,.05,dishMat,0,.92,0,12));g.add(flame(.07,.16,MAT.flame,0,1.02,0));g.add(flame(.035,.09,yFlame,0,1.06,0));worldK.add(g);} // 燈台(灯明皿)
    function tawara(x,y,z){const t=cyl(.32,.32,1.0,rice,x,y,z,12);t.rotation.z=Math.PI/2;worldK.add(t);
      [-.33,0,.33].forEach(o=>{const r=cyl(.325,.325,.03,rope,x+o,y,z,12);r.rotation.z=Math.PI/2;worldK.add(r);});}          // 米俵+縄目
    function oke(x,z,fy){worldK.add(cyl(.18,.15,.26,MAT.wood,x,fy+.13,z,10));worldK.add(cyl(.16,.16,.06,strawTex,x,fy+.27,z,10));} // 桶(飼葉入り)
    function bundle(x,z){const b=cyl(.16,.16,.72,strawTex,x,.16,z,9);b.rotation.z=Math.PI/2;worldK.add(b);worldK.add(cyl(.17,.17,.03,rope,x,.16,z,9));} // 藁束

    /* 主殿(0,-5, 床y=1.0): 莚・円座3・文机+巻紙・燈台2・火桶・弓掛け・太刀掛け・二枚折屏風・棚+高坏 */
    worldK.add(plane(strawTex,3.4,3.8,-5,1.03,-3));                                  // 莚
    enza(-5,-2.2); enza(-5,-3.9); enza(4.6,-6.6);                                    // 円座×3
    (function(){ const dx=-6.3,dz=-6.6,dy=1.0;                                       // 文机+巻紙
      worldK.add(box(1.05,.06,.52,MAT.woodDark,dx,dy+.34,dz));
      [[-.45,-.2],[.45,-.2],[-.45,.2],[.45,.2]].forEach(p=>worldK.add(box(.06,.34,.06,MAT.woodDark,dx+p[0],dy+.17,dz+p[1])));
      const roll=cyl(.05,.05,.7,paper,dx,dy+.4,dz,8);roll.rotation.z=Math.PI/2;worldK.add(roll); })();
    toudai(6.2,-2.6); toudai(-6.4,-8.0);                                            // 燈台×2
    (function(){ const x=4.9,z=-6.6,y=1.0;                                           // 火桶(丸胴+灰+炭火)
      worldK.add(cyl(.32,.35,.5,kuroU,x,y+.25,z,14)); worldK.add(cyl(.3,.3,.04,MAT.ash,x,y+.5,z,14));
      const em=new THREE.Mesh(new THREE.SphereGeometry(.09,7,6),emberBM);em.position.set(x,y+.52,z);worldK.add(em);
      worldK.add(flame(.06,.14,MAT.flame,x,y+.6,z)); })();
    (function(){ const z=-9.7;                                                       // 弓掛け(弓2張・北壁)
      worldK.add(box(3.0,.09,.12,MAT.woodDark,-3,2.3,z)); [-3.7,-2.3].forEach(x=>worldK.add(box(.12,.09,.4,MAT.woodDark,x,2.3,z+.2)));
      [-3.7,-2.3].forEach(x=>worldK.add(cyl(.02,.02,1.9,bowWood,x,1.95,z+.15,7))); })();
    (function(){ const x=6.5,z=-7.9,y=1.0;                                           // 太刀掛け(太刀1振・黒漆鞘)
      [-.45,.45].forEach(o=>{worldK.add(box(.08,.7,.08,MAT.woodDark,x,y+.35,z+o)); worldK.add(box(.14,.1,.1,MAT.woodDark,x,y+.66,z+o));});
      const t=cyl(.035,.028,.98,kuroU,x,y+.72,z,8);t.rotation.x=Math.PI/2;worldK.add(t); worldK.add(cyl(.045,.045,.16,MAT.black,x,y+.72,z+.5,8)); })();
    (function(){ const x=-6.7;                                                       // 二枚折屏風
      const p1=box(1.5,1.5,.05,screen,x,1.78,-2.5);p1.rotation.y=.32;worldK.add(p1);
      const p2=box(1.5,1.5,.05,screen,x-.1,1.78,-4.0);p2.rotation.y=-.32;worldK.add(p2); })();
    (function(){ const x=6.6,z=-4.2,y=1.0;                                           // 棚(横板)+高坏
      worldK.add(box(1.5,.05,.5,MAT.woodDark,x,y+.8,z)); [-.6,.6].forEach(o=>worldK.add(box(.06,.8,.06,MAT.woodDark,x,y+.4,z+o)));
      worldK.add(cyl(.06,.09,.2,MAT.woodDark,x,y+.9,z,8)); worldK.add(cyl(.17,.1,.05,dishMat,x,y+1.0,z,12)); })();

    /* 侍所(-15,22, 床y=.8, 南開放): 弓3張+箙・盾2・莚・囲炉裏(小)・木刀掛け */
    (function(){ const z=19.4,y=.8;                                                  // 弓3張(背壁)+箙(矢束)
      worldK.add(box(3.2,.08,.1,MAT.woodDark,-15,2.2,z));
      [-16.2,-15,-13.8].forEach(x=>worldK.add(cyl(.02,.02,1.8,bowWood,x,1.7,z+.12,7)));
      worldK.add(cyl(.13,.16,.8,MAT.woodDark,-12.4,1.2,z+.2,8)); for(let i=0;i<7;i++)worldK.add(cyl(.01,.01,.5,bowWood,-12.4+(i-3)*.03,1.75,z+.2,4)); })();
    [21.2,21.9].forEach((zz,i)=>{const s=box(.9,1.3,.07,MAT.woodDark,-19.2+i*.12,1.45,zz);s.rotation.z=.12;worldK.add(s);}); // 盾2枚立てかけ
    worldK.add(plane(strawTex,3.0,3.0,-15,.82,22));                                  // 莚
    (function(){ const x=-15,z=22,y=.8;                                              // 囲炉裏(小)
      worldK.add(box(.9,.18,.9,MAT.woodDark,x,y+.09,z)); worldK.add(box(.66,.08,.66,MAT.ash,x,y+.14,z)); worldK.add(flame(.14,.3,MAT.flame,x,y+.3,z)); })();
    (function(){ const z=24.4,y=.8;                                                  // 木刀掛け
      worldK.add(box(1.4,.08,.1,MAT.woodDark,-15,1.5,z)); [-.4,.4].forEach(o=>worldK.add(cyl(.02,.02,.9,MAT.wood,-15+o,1.1,z+.1,6))); })();

    /* 厩(18,0, 土間): 飼葉桶2・藁束3・鞍鐙掛け台・手綱・馬糞よけの筵 */
    oke(15,1.3,0); oke(19,1.3,0);                                                    // 飼葉桶×2
    bundle(14,-1.2); bundle(22,-1.0); bundle(21.2,1.4);                              // 藁束×3
    (function(){ const x=14.0,z=0,y=0;                                               // 鞍と鐙の掛け台
      [-.5,.5].forEach(o=>worldK.add(box(.08,1.0,.08,MAT.woodDark,x,y+.5,z+o))); worldK.add(box(.12,.1,1.2,MAT.woodDark,x,y+1.0,z));
      worldK.add(box(.5,.28,.7,MAT.woodDark,x,y+1.2,z)); [-.28,.28].forEach(o=>worldK.add(cyl(.02,.02,.3,iron,x+o,y+.95,z,6))); })();
    [-.4,0,.4].forEach(o=>worldK.add(cyl(.012,.012,.5,rope,18+o,1.0,1.4,4)));        // 手綱(繋ぎ横木から)
    worldK.add(plane(strawTex,7,2.4,18,.04,-.3));                                    // 馬糞よけの筵(厩内)

    /* 竈屋(0,-16, 土間): 水甕・桶2・俎板と包丁・薪の山・干し魚菜・筵 */
    worldK.add(cyl(.5,.38,.9,MK.tsuchi,2.0,.45,-15.0,14)); worldK.add(cyl(.42,.42,.05,MAT.water,2.0,.9,-15.0,14)); // 水甕(大)
    oke(1.2,-14.2,0); oke(2.0,-17.2,0);                                              // 桶×2
    (function(){ const x=-.2,z=-14.4;                                                // 俎板と包丁(低い台)
      worldK.add(box(.9,.5,.5,MAT.woodDark,x,.25,z)); worldK.add(box(.6,.05,.34,MAT.wood,x,.53,z));
      worldK.add(box(.24,.02,.06,iron,x+.1,.57,z+.05)); worldK.add(box(.1,.02,.05,MAT.woodDark,x+.28,.57,z+.05)); })();
    for(let i=0;i<6;i++){const l=cyl(.06,.06,1.0,MAT.woodDark,1.7+(i%2)*.02,.06+Math.floor(i/2)*.13,-17.7+(i%2)*.14,6);l.rotation.z=Math.PI/2;worldK.add(l);} // 薪の山
    (function(){ const bx=2.6,z=-14.2;                                               // 吊るした干し魚/菜
      worldK.add(box(.05,.05,1.6,MAT.woodDark,bx,2.0,z)); for(let i=0;i<4;i++){worldK.add(cyl(.008,.008,.4,rope,bx,1.8,z-.6+i*.4,4)); worldK.add(box(.05,.3,.12,M({color:i%2?0x8a9a52:0xb59066,roughness:.85}),bx,1.5,z-.6+i*.4));} })();
    worldK.add(plane(strawTex,3,2.4,-1.5,.04,-15.6));                                // 土間の筵

    /* 板倉(18,-20, 高床): 米俵4・木櫃2・梯子(前で積み降ろし) */
    tawara(15.6,.32,-17.6); tawara(15.6,.32,-16.6); tawara(16.4,.32,-17.1); tawara(15.6,.98,-17.1); // 米俵×4
    [[17.4,-16.2],[17.4,-15.1]].forEach(p=>{worldK.add(box(.9,.6,.6,MAT.woodDark,p[0],.3,p[1])); worldK.add(box(.94,.08,.64,MAT.wood,p[0],.63,p[1]));}); // 木櫃×2
    (function(){ const g=new THREE.Group();g.position.set(18,0,-17.6);g.rotation.x=.18;              // 梯子
      [-.35,.35].forEach(x=>g.add(box(.08,2.2,.08,MAT.wood,x,1.1,0))); for(let i=0;i<6;i++)g.add(box(.8,.06,.06,MAT.wood,0,.3+i*.35,0)); worldK.add(g); })();

    /* 持仏堂(-20,-18, 床y=.75): 香炉・花瓶一対・経机+経巻・座布 */
    (function(){ const x=-20,z=-16.6,y=.75;                                          // 香炉(小・三足)+香の火
      worldK.add(cyl(.14,.16,.12,bronze,x,y+.12,z,10)); [0,2.09,4.18].forEach(a=>worldK.add(cyl(.02,.02,.12,bronze,x+Math.cos(a)*.11,y+.06,z+Math.sin(a)*.11,5)));
      const hf=new THREE.Mesh(new THREE.SphereGeometry(.03,6,5),new THREE.MeshBasicMaterial({color:0xffb060}));hf.position.set(x,y+.2,z);worldK.add(hf); })();
    [-.7,.7].forEach(o=>{const x=-20+o,z=-17.0,y=.75;                                // 花瓶一対
      worldK.add(cyl(.09,.06,.28,MK.tsuchi,x,y+.14,z,10)); worldK.add(cyl(.02,.02,.24,M({color:0x6f8f5a,roughness:.8}),x,y+.4,z,4));});
    (function(){ const x=-21.0,z=-18.6,y=.75;                                        // 経机+経巻
      worldK.add(box(.9,.05,.4,MAT.woodDark,x,y+.3,z)); [[-.38,-.15],[.38,-.15],[-.38,.15],[.38,.15]].forEach(p=>worldK.add(box(.05,.3,.05,MAT.woodDark,x+p[0],y+.15,z+p[1])));
      const roll=cyl(.045,.045,.5,paper,x,y+.35,z,8);roll.rotation.z=Math.PI/2;worldK.add(roll); })();
    worldK.add(box(.6,.08,.6,strawTex,-20,.79,-15.6));                               // 座布(僧の座)

    /* 外構 */
    function kagaribi(x,z){ const g=new THREE.Group();g.position.set(x,0,z);         // 篝火台(夜は火・PointLight)
      [[-.2,-.12],[.2,-.12],[0,.22]].forEach(p=>{const l=cyl(.05,.05,1.6,MAT.woodDark,p[0],.8,p[1],6);l.rotation.x=p[1]>0?.14:-.14;g.add(l);});
      g.add(cyl(.34,.26,.32,iron,0,1.55,0,10)); g.add(cyl(.3,.24,.06,charcoal,0,1.45,0,10));
      g.add(flame(.26,.62,MAT.flame,0,1.92,0)); g.add(flame(.14,.36,yFlame,0,2.0,0));
      const pl=new THREE.PointLight(0xff9440,.95,11,2);pl.position.set(0,2.2,0);g.add(pl); worldK.add(g); }
    kagaribi(-4.2,33.6); kagaribi(4.2,33.6);                                         // 篝火台×2(門脇, PointLight2つ=上限)
    [[-1.7,-1.0],[1.0,1.7]].forEach(cols=>cols.forEach(x=>[1.1,1.6,2.1,2.5].forEach(y=>worldK.add(sph(.05,iron,x,y,34.86,6))))); // 矢倉門扉の乳金物風(黒鉄の点列)
    (function(){ const post=(x,z,ax,az)=>{const p=cyl(.12,.14,2.4,MAT.woodDark,x,1.2,z,6);p.rotation.z=ax;p.rotation.x=az;worldK.add(p);};
      for(let x=-28;x<=28;x+=14)post(x,33.4,0,.18); for(let z=-26;z<=26;z+=13){post(33.4,z,-.18,0);post(-33.4,z,.18,0);} })(); // 控柱(塀内側・等間隔)
    (function(){ const x=31,z=30.0;                                                  // 物見矢倉の半鐘(小鐘)
      worldK.add(box(.06,.06,1.0,MAT.woodDark,x,5.2,z)); worldK.add(cyl(.006,.006,.5,rope,x,4.95,z,4));
      worldK.add(cyl(.14,.18,.32,bronze,x,4.7,z,10)); worldK.add(cyl(.06,.02,.1,bronze,x,4.9,z,8)); })();
    (function(){ const x=22,z=20;                                                    // 的場の矢立て+予備の的
      worldK.add(cyl(.14,.16,.7,MAT.woodDark,x,.35,z,8)); for(let i=0;i<6;i++)worldK.add(cyl(.012,.012,.8,bowWood,x+(i-3)*.03,.9,z,4));
      const m=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,.06,18),MK.mato);m.rotation.z=.3;m.position.set(23.5,.7,17);m.castShadow=true;m.receiveShadow=true;worldK.add(m); })();
    worldK.add(box(62,.1,.1,MAT.wood,0,.5,46.5)); worldK.add(box(62,.1,.1,MAT.wood,0,.5,53.5)); // 馬場柵の補強横木(中段)
    (function(){ const x=6,z=-16;                                                    // 井戸の滑車と縄(桶吊り)
      worldK.add(cyl(.14,.14,.06,MAT.woodDark,x,2.35,z,10)); worldK.add(cyl(.008,.008,1.0,rope,x+.12,1.9,z,4)); worldK.add(cyl(.13,.11,.2,MAT.wood,x+.12,1.35,z,10)); })();
    (function(){ const x=-44,z=-4;                                                   // 案山子(田)
      worldK.add(box(.08,2.2,.08,MAT.wood,x,1.1,z)); worldK.add(box(1.4,.08,.08,MAT.wood,x,1.7,z));
      worldK.add(sph(.16,strawTex,x,2.15,z,8)); worldK.add(con(.34,.24,straw,x,2.32,z,10)); worldK.add(box(.7,.7,.12,M({color:0x7a6a4a,roughness:1}),x,1.4,z)); })();
    (function(){ const x=6.5,z=33;                                                   // 白の流れ旗(無紋・門脇)
      worldK.add(cyl(.05,.05,4.2,MAT.woodDark,x,2.1,z,6)); worldK.add(box(.05,2.4,1.0,whiteCloth,x+.03,2.8,z+.55)); })();

    /* 地面表情 */
    worldK.add(plane(packed,2.8,34,0,.015,18));                                      // 踏み固め土の帯(門→主殿)
    worldK.add(plane(strawTex,6,2.6,18,.035,3.4));                                   // 厩前に藁散らし
    worldK.add(plane(sand,2.4,8,20,.03,21));                                         // 的場に白砂帯

    /* 人物7名(計画§3)。makeBushiFigure/makeHeianFigure ＝内部で castShadow 設定済み */
    const mon=(x,rot)=>{const f=makeBushiFigure({color:0x3a4a5a,hakama:0x4a3b2a,yumi:true,scale:1.0});f.position.set(x,0,33);f.rotation.y=rot;worldK.add(f);};
    mon(-2.8,Math.PI); mon(2.8,Math.PI);                                            // 門番×2(矢倉門内側・門へ正対)
    const archer=makeBushiFigure({color:0x2f4f6b,hakama:0x4a3b2a,pose:"draw",scale:1.03}); archer.position.set(20,0,25.2); archer.rotation.y=0; worldK.add(archer); // 稽古の郎党(射座・弓構え)
    const umaban=makeBushiFigure({color:0xa08a5a,hakama:0x8a7048,oke:true,scale:.99}); umaban.position.set(14,0,2.6); umaban.rotation.y=0; worldK.add(umaban);        // 厩番(飼葉桶を持つ)
    const gejo=makeHeianFigure({role:"nyoubou",palette:[0x6a5c48,0x8a7a5c,0x9a8a68,0x5a5040],scale:.95,pose:"standing"}); gejo.position.set(-1,0,-14.2); gejo.rotation.y=Math.PI;
    gejo.add(box(.32,.5,.06,M({color:0xb8ae92,roughness:.9}),0,.55,.2)); worldK.add(gejo);   // 下女(小袖+前掛け・竈前)
    const sou=makeBushiFigure({monk:true,scale:1.0}); sou.position.set(-20,0,-15.2); sou.rotation.y=0; worldK.add(sou);   // 僧(持仏堂前・灰黒の衣+数珠)
    const nofu=makeBushiFigure({color:0x6b6a58,hakama:0x5a5240,kasa:true,kuwa:true,scale:1.0}); nofu.position.set(-45,0,3); nofu.rotation.y=Math.PI/2; worldK.add(nofu); // 農夫(田・円錐笠+鍬)
    const warabe=makeBushiFigure({color:0x9a4a38,hakama:0x4a5a6a,scale:.6}); warabe.position.set(-3,0,9); warabe.rotation.y=Math.PI; worldK.add(warabe);                // 童(庭・scale0.6の直垂)
  })();
}
