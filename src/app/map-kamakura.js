/* ============================================================
   鎌倉武家屋敷マップ  ( ?map=kamakura で起動 )
   教材設計の正本: docs/plans/KAMAKURA_BUKE_YASHIKI_PLAN.md
   ------------------------------------------------------------
   方針:
   - 既定(寝殿造)マップの挙動は 1バイトも変えない。本ブロックは
     APP.map==="kamakura" のときだけ実行される自己完結コード。
   - 既存ヘルパーを流用し、武家30項目の図鑑・名称クイズへ接続。
     他時代の物語/戦闘モードを開放せず、季節登録も追加しない。
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

  /* 図鑑登録用オブジェクト参照(セクション19で register+makeLabel に使う)。
     各造形の生成時にここへ代表グループ/メッシュを控える。平安側は本ブロック非実行=無影響。 */
  const K={};

  /* 屋敷人物(household 11名)は非同期生成され、本ブロック実行時点(パース時)にはまだ scene 直下に
     存在せず、上の一括非表示を免れて鎌倉の庭に露出する(計画§4「平安の人物は出さない」に反する)。
     読み込み完了を見込んで数回、worldK と光源・天体を除く scene 直下を再非表示にして静的な平安人物を消す。
     worldK配下(鎌倉の全造形・人物)は除外＝鎌倉側は無傷、本処理は kamakura 時のみ到達＝平安側は無影響。
     ※毎フレーム再表示される平安のアイドル系(童/雀/鳥・陰陽師トースト等)は本掃除では消えない。
       それらの遮断は各更新系を APP.map で分岐する別対応が必要(既存の課題・本Wave対象外)。 */
  function _kamaHideForeign(){
    const visitStage=window.KENKO_HERMITAGE?.stage;
    scene.children.forEach(o=>{ if(o===worldK||o===visitStage||o.isLight||_kamaKeep.has(o))return; o.visible=false; });
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
      +"html.map-kamakura #btnCareer,"
      +"html.map-kamakura #btnHistory,"
      +"html.map-kamakura #tbMap,"
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
  MK.itabei=M({map:canv(128,128,(x,w,h)=>{ x.fillStyle="#806b50";x.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=16){const shade=Math.round(Math.sin(y*.61)*5);x.fillStyle=`rgb(${127+shade},${105+shade},${77+shade})`;x.fillRect(0,y,w,15);
      x.strokeStyle="rgba(50,39,25,.32)";x.lineWidth=1;x.beginPath();x.moveTo(0,y+15);x.lineTo(w,y+15);x.stroke();
      for(let i=0;i<5;i++){x.strokeStyle="rgba(60,47,31,.11)";x.lineWidth=.6;x.beginPath();const yy=y+2+i*2.5;x.moveTo(0,yy);x.bezierCurveTo(w*.3,yy+1,w*.7,yy-1,w,yy);x.stroke();}
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
  const _hide=canv(128,128,(x,w,h)=>{ x.fillStyle="#c6bcae";x.fillRect(0,0,w,h);
    for(let i=0;i<700;i++){x.strokeStyle=`rgba(${rnd(90,130)|0},${rnd(60,90)|0},${rnd(34,54)|0},${rnd(.1,.3)})`;x.lineWidth=.8;const sx=rnd(0,w),sy=rnd(0,h);x.beginPath();x.moveTo(sx,sy);x.lineTo(sx+rnd(2,6),sy+rnd(-1,1));x.stroke();}});
  MK.umaKage=M({map:_hide,color:0x9a6945,roughness:.96});
  MK.umaKuro=M({map:_hide,color:0x66503e,roughness:.96});
  /* 草地(タイル) */
  MK.grass=M({map:canv(128,128,(x,w,h)=>{ x.fillStyle="#5f7444";x.fillRect(0,0,w,h);
    for(let i=0;i<1600;i++){x.fillStyle=`rgba(${rnd(70,110)|0},${rnd(96,140)|0},${rnd(52,84)|0},.5)`;x.fillRect(rnd(0,w),rnd(0,h),1.5,rnd(2,4));}
    }),roughness:1}); MK.grass.map.repeat.set(30,30);

  /* ---- 5. 汎用ビルダー ---- */
  function plane(mat,w,d,cx,y,cz){ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);m.rotation.x=-Math.PI/2;m.position.set(cx,y,cz);m.receiveShadow=true;return m; }
  function boardRoof(w,d,h,ridge,y){
    const m=new THREE.Mesh(hipRoofGeo(w,d,h,ridge),MK.itabuki);m.position.y=y;m.castShadow=true;m.receiveShadow=true;
    // 徒然草草庵と同じく、屋根面だけでなく厚みと荷重を受ける端部を見せる。
    [-1,1].forEach(s=>{m.add(box(w,.12,.10,MAT.woodDark,0,-.01,s*d/2));m.add(box(.10,.12,d,MAT.woodDark,s*w/2,-.01,0));});
    [-1,1].forEach(x=>[-1,1].forEach(z=>kBeam(m,[x*w*.48,-.06,z*d*.48],[0,h-.08,0],.10,.10,MAT.woodDark,"hip-rafter")));
    return m;
  }

  // 接合位置を共有する部材。名前は図鑑モデルと造形検査でも使う（新しい項目IDではない）。
  const kSphereGeo=new THREE.SphereGeometry(1,16,10);
  function kPart(parent,obj,name){obj.name=name||"";parent.add(obj);return obj;}
  function kOval(parent,mat,x,y,z,sx,sy,sz,name){
    const m=new THREE.Mesh(kSphereGeo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;return kPart(parent,m,name);
  }
  function kBeam(parent,a,b,width,depth,mat,name){
    const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av);
    const m=box(width,v.length(),depth,mat,0,0,0);m.position.copy(av).add(bv).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return kPart(parent,m,name);
  }
  function kCurve(parent,pts,r,mat,name){
    const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));
    const m=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(8,pts.length*3),r,5,false),mat);m.castShadow=true;m.receiveShadow=true;return kPart(parent,m,name);
  }
  // 襞を別の棒で貼らず、衣の断面へ織り込む。SDF人物の輪郭/接地の考えを軽い輪断面へ適用。
  const kGarmentGeometries=new Map();
  function kGarment(parent,mat,rings,name){
    const key=JSON.stringify(rings);let geo=kGarmentGeometries.get(key);
    if(!geo){
    const pos=[],uv=[],index=[],n=20;
    for(let j=0;j<rings.length;j++){const [y,rx,rz]=rings[j];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,fold=1+.045*Math.cos(a*8)*(1-j/rings.length);pos.push(Math.cos(a)*rx*fold,y,Math.sin(a)*rz*fold);uv.push(i/n,j/(rings.length-1));}}
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;index.push(a,b,a+1,a+1,b,b+1);}
    // 上下の開口は手/足や襟の内部へ重ねる。底を床へ突き抜ける球で塞がない。
    geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));geo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));geo.setIndex(index);geo.computeVertexNormals();kGarmentGeometries.set(key,geo);
    }
    const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;return kPart(parent,mesh,name);
  }
  const kClothMap=canv(64,64,(ctx,w,h)=>{ctx.fillStyle="#e3dfd5";ctx.fillRect(0,0,w,h);for(let i=0;i<w;i+=4){ctx.fillStyle="rgba(78,71,59,.07)";ctx.fillRect(i,0,1,h);ctx.fillRect(0,i,w,1);}});
  const kIron=M({color:0x39342c,roughness:.68}),kRope=M({color:0xbaa071,roughness:.92});
  function kDoor(parent,x,y,z,w,h,side,angle){
    const pivot=new THREE.Group();pivot.position.set(x,y,z);pivot.rotation.y=side*angle;pivot.name="hinged-door";
    kPart(pivot,box(w,h,.10,MK.itabei,side*w/2,h/2,0),"door-leaf");
    [.17,h-.17].forEach(yy=>kPart(pivot,box(w,.13,.15,MAT.woodDark,side*w/2,yy,0),"door-crossrail"));
    [.27,h-.27].forEach(yy=>{kPart(pivot,cyl(.075,.075,.22,kIron,0,yy,0,8),"door-hinge");
      [.23,w-.2].forEach(xx=>kOval(pivot,kIron,side*xx,yy,.08,.045,.045,.025,"door-stud"));});
    parent.add(pivot);return pivot;
  }
  function kPanel(parent,w,h,x,y,z,yaw,paper){
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=yaw||0;parent.add(g);
    g.add(box(w,h,.055,paper?MK.shoji:MK.mairado,0,h/2,0));
    [-1,1].forEach(s=>g.add(box(.065,h,.09,MAT.woodDark,s*(w/2-.033),h/2,0)));
    [0,h].forEach(yy=>g.add(box(w,.065,.09,MAT.woodDark,0,yy,0)));
    if(paper){for(let i=1;i<4;i++)g.add(box(.028,h,.072,MAT.wood,(-.5+i/4)*w,h/2,.008));}
    for(let yy=.25;yy<h;yy+=paper?.43:.22)g.add(box(w,.025,.073,MAT.wood,0,yy,.008));
    return g;
  }
  function kBow(){
    const g=new THREE.Group();g.name="strung-bow";
    kCurve(g,[[0,-.70,0],[0,-.50,.12],[0,0,.18],[0,.58,.13],[0,1.10,0]],.024,MK.log,"bow-limb");
    kBeam(g,[0,-.70,0],[0,1.10,0],.008,.008,kRope,"bow-string");
    kPart(g,box(.055,.19,.055,kIron,0,0,.18),"bow-grip");return g;
  }
  const kStepZones=[];
  function kSteps(parent,x,z,width,top,run){
    const count=Math.ceil(top/.20),depth=run/count;
    for(let i=0;i<count;i++){const h=top*(i+1)/count,cz=z+run-depth*(i+.5);
      kPart(parent,box(width,h,depth+.02,MAT.woodDark,x,h/2,cz),"approach-step");
      kStepZones.push([parent.position.x+x,parent.position.z+cz,width,depth+.02,h]);
    }
  }

  /* 土塁+板塀 の一区間(horizontal=true は x方向、false は z方向に走る) */
  function rampart(cx,cz,len,horizontal){
    const g=new THREE.Group(); g.position.set(cx,0,cz);
    const w=horizontal?len:3, d=horizontal?3:len;
    const earth=new THREE.BoxGeometry(w,1.3,d),ep=earth.attributes.position;
    for(let i=0;i<ep.count;i++)if(ep.getY(i)>0){if(horizontal)ep.setZ(i,ep.getZ(i)*.48);else ep.setX(i,ep.getX(i)*.48);}earth.computeVertexNormals();
    const bank=new THREE.Mesh(earth,MK.dorui);bank.position.y=.65;g.add(bank); // 台形断面。下端3m・上端1.44m
    g.add(box(horizontal?len:.32,2.0,horizontal?.32:len,MK.itabei,0,2.3,0)); // 板塀
    g.add(box(horizontal?len:.5,.18,horizontal?.5:len,MAT.woodDark,0,3.35,0));// 笠木
    for(let q=-len/2+.8;q<len/2;q+=3.5)g.add(box(.18,2.18,.18,MAT.woodDark,horizontal?q:0,2.26,horizontal?0:q));
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

  // 馬3頭は首・尾・鬣・蹄の少頂点geometryを共有。全てローカル支点で組む。
  const kHorseNeckGeo=(()=>{
    const rings=[[.95,.61,.31,.35],[1.12,.69,.305,.325],[1.32,.81,.275,.29],[1.53,.94,.245,.26],[1.72,1.055,.21,.235],[1.90,1.14,.18,.205],[2.08,1.19,.145,.17]],p=[],uv=[],ix=[],n=18;
    rings.forEach(([y,z,rx,rz],j)=>{for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;p.push(Math.cos(a)*rx,y,z+Math.sin(a)*rz);uv.push(i/n,j/(rings.length-1));}});
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;ix.push(a,b,a+1,a+1,b,b+1);}
    const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(p,3));geo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ix);geo.computeVertexNormals();return geo;
  })();
  function kTaperedHair(points,radii){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments=18,radial=8;
    const geo=new THREE.TubeGeometry(curve,segments,1,radial,false),p=geo.attributes.position,v=new THREE.Vector3();
    for(let j=0;j<=segments;j++){const t=j/segments,a=t*(radii.length-1),lo=Math.min(radii.length-2,Math.floor(a)),r=THREE.MathUtils.lerp(radii[lo],radii[lo+1],a-lo),c=curve.getPointAt(t);
      for(let i=0;i<=radial;i++){const k=j*(radial+1)+i;v.fromBufferAttribute(p,k).sub(c).multiplyScalar(r).add(c);p.setXYZ(k,v.x,v.y,v.z);}}
    geo.computeVertexNormals();return geo;
  }
  const kHorseTailGeo=kTaperedHair([[0,1.34,-.99],[0,1.10,-1.15],[.02,.70,-1.26],[.06,.30,-1.26]],[.075,.085,.11,.018]);
  const kHorseManeGeo=kTaperedHair([[0,2.21,1.11],[0,1.93,.95],[0,1.63,.76],[0,1.32,.54]],[.055,.075,.07,.02]);
  const kHorseHoofGeo=new THREE.CylinderGeometry(.105,.13,.18,10),kHorseShinGeo=new THREE.CylinderGeometry(.072,.056,.48,10);
  const kHorseHoof=M({color:0x40392f,roughness:.87}),kHorseMane=M({color:0x30271f,roughness:.97}),kHorseEye=M({color:0x17140f,roughness:.34}),kHorseInnerEar=M({color:0x796454,roughness:.96});
  const kHorseLeather=M({color:0x49331f,roughness:.86}),kHorseBitGeo=new THREE.TorusGeometry(.026,.007,5,10);
  const kHorseMuzzles=new Map();
  /* 馬(静止立ちポーズ)。頭は +z 向き。coat=毛色マテリアル */
  function makeUma(coat){
    const g=new THREE.Group();g.name="kamakura-horse";
    const hoof=kHorseHoof,mane=kHorseMane;
    if(!kHorseMuzzles.has(coat)){const mat=coat.clone();mat.color.lerp(new THREE.Color(0xc8aa87),.27);kHorseMuzzles.set(coat,mat);}const muzzle=kHorseMuzzles.get(coat);
    kOval(g,coat,0,1.15,0,.38,.46,.93,"horse-barrel");                           // 胴の腹と肩を連続させる
    kOval(g,coat,0,1.18,.65,.38,.47,.42,"horse-chest");
    kOval(g,coat,0,1.17,-.72,.40,.44,.38,"horse-rump");
    const headG=new THREE.Group();g.userData.head=headG;headG.name="horse-head-pivot"; // 既存の頷きはこの群だけを動かす
    kPart(headG,new THREE.Mesh(kHorseNeckGeo,coat),"horse-neck");
    kOval(headG,coat,0,2.06,1.28,.19,.23,.23,"horse-cranium");
    kOval(headG,coat,0,1.98,1.39,.19,.19,.24,"horse-cheek-and-poll");
    const nasal=kOval(headG,coat,0,1.93,1.50,.145,.18,.33,"horse-nasal-bridge");nasal.rotation.x=.50;
    kOval(headG,coat,0,1.91,1.28,.175,.16,.22,"horse-jaw");
    kOval(headG,muzzle,0,1.78,1.76,.155,.125,.18,"horse-muzzle");
    [-1,1].forEach(s=>{
      const ear=kOval(headG,coat,s*.12,2.30,1.17,.055,.14,.035,"horse-ear");ear.rotation.z=-s*.2;
      const inside=kOval(headG,kHorseInnerEar,s*.12,2.31,1.199,.03,.091,.014,"horse-inner-ear");inside.rotation.z=-s*.2;
      kOval(headG,muzzle,s*.174,2.078,1.411,.022,.044,.054,"horse-eye-rim");
      kOval(headG,kHorseEye,s*.189,2.078,1.419,.015,.028,.037,"horse-eye");
      kOval(headG,hoof,s*.105,1.80,1.883,.035,.027,.018,"nostril");
      kCurve(headG,[[s*.17,2.17,1.34],[s*.175,2.08,1.38],[s*.16,1.94,1.58],[s*.14,1.82,1.79]],.018,kHorseLeather,"halter-cheek");
      const bit=kPart(headG,new THREE.Mesh(kHorseBitGeo,kIron),"halter-bit-ring");bit.position.set(s*.14,1.81,1.79);bit.rotation.y=Math.PI/2;
    });
    kCurve(headG,[[-.11,1.73,1.876],[0,1.714,1.912],[.11,1.73,1.876]],.009,hoof,"horse-mouth");
    kCurve(headG,[[-.17,2.17,1.34],[0,2.19,1.49],[.17,2.17,1.34]],.018,kHorseLeather,"halter-browband");
    kCurve(headG,[[-.14,1.82,1.79],[0,1.88,1.87],[.14,1.82,1.79]],.019,kHorseLeather,"halter-noseband");
    kPart(headG,new THREE.Mesh(kHorseManeGeo,mane),"horse-mane");
    g.add(headG);
    [[.24,.62],[-.24,.62],[.24,-.6],[-.24,-.6]].forEach(p=>{
      kOval(g,coat,p[0],.86,p[1],.11,.34,.12,"horse-upper-leg");
      kOval(g,coat,p[0],.56,p[1],.082,.09,.085,"horse-knee");
      const shin=kPart(g,new THREE.Mesh(kHorseShinGeo,coat),"horse-shin");shin.position.set(p[0],.36,p[1]);
      const foot=kPart(g,new THREE.Mesh(kHorseHoofGeo,hoof),"horse-hoof");foot.position.set(p[0],.09,p[1]+.012);foot.scale.z=1.12;
    });
    kPart(g,new THREE.Mesh(kHorseTailGeo,mane),"horse-tail");
    g.traverse(o=>{ if(o.isMesh){o.castShadow=true;o.receiveShadow=true;} });
    return g;
  }

  /* 武士(直垂+袴+侍烏帽子)。前(顔)は +z 向き。makeLowRankPerson の円柱体型を参考にした新規実装 */
  function makeBushiFigure(o){
    o=o||{};
    const isHitatare=!o.monk&&!o.nohat&&!o.kasa;
    const scale=o.scale||1,
      cloth=M({color:o.monk?0x3b3a36:(o.color||0x27506b),map:kClothMap,roughness:.93,side:THREE.DoubleSide}),
      hakama=isHitatare?cloth:M({color:o.monk?0x2f2e2a:(o.hakama||0x6b3a24),map:kClothMap,roughness:.93,side:THREE.DoubleSide}),
      skin=M({color:0xe3c39c,roughness:.7}), black=M({color:0x14110d,roughness:.6});
    const g=new THREE.Group();
    g.name=o.monk?"kamakura-monk":"kamakura-person";
    g.userData.kamakuraAttire=isHitatare?"hitatare":o.monk?"monk":o.child?"child":"work-clothes";
    if(o.monk)kGarment(g,hakama,[[.075,.31,.21],[.20,.30,.20],[.48,.245,.16],[.78,.205,.145]],"monk-robe-hem");
    else [-1,1].forEach(s=>{const leg=kGarment(g,hakama,[[.07,.135,.13],[.19,.16,.15],[.40,.155,.15],[.65,.13,.125],[.77,.105,.10]],"hakama-leg");leg.position.x=s*.13;});
    [-1,1].forEach(s=>{ kPart(g,cyl(.06,.07,.28,black,s*.12,.14,.02,7),'figure-ankle'); kPart(g,box(.14,.06,.24,black,s*.12,.03,.08,false),'figure-foot'); }); // 足首/足
    kGarment(g,cloth,[[.74,.215,.145],[.89,.255,.155],[1.09,.25,.16],[1.23,.21,.135],[1.31,.10,.085]],"tailored-torso");
    const collar=M({color:o.monk?0x6d6759:0xd8c7a3,roughness:.9});
    kBeam(g,[-.10,1.30,.10],[.14,.94,.15],.055,.028,collar,"crossed-collar");
    kBeam(g,[.10,1.30,.10],[-.08,1.06,.16],.048,.028,cloth,"overlapping-collar");
    g.add(box(.45,.07,.31,hakama,0,.77,.01));
    if(!o.monk){
      kCurve(g,[[-.12,1.13,.145],[0,1.09,.17],[.12,1.13,.145]],.012,kRope,"chest-cord");
    }else kCurve(g,[[-.20,1.27,.11],[.16,1.03,.18],[.20,.76,.16]],.032,collar,"monk-kesa-edge");
    if(o.pose==="draw"){                                                                                                     // 弓を引く静止ポーズ(腕の角度で表現)
      kBeam(g,[.19,1.21,0],[.25,1.22,.50],.16,.16,cloth,"bow-arm");
      kBeam(g,[-.2,1.23,0],[-.38,1.25,-.10],.16,.16,cloth,"drawing-elbow");
      kBeam(g,[-.38,1.25,-.10],[0,1.28,.15],.13,.13,cloth,"drawing-forearm");
      kOval(g,skin,.25,1.22,.57,.065,.055,.05,"bow-hand");kOval(g,skin,0,1.28,.15,.055,.055,.05,"drawing-hand");
      const bow=kBow();bow.position.set(.25,1.22,.39);g.add(bow);bow.remove(bow.getObjectByName("bow-string"));
      kCurve(g,[[.25,.52,.39],[0,1.28,.15],[.25,2.32,.39]],.007,kRope,"drawn-string");
      kBeam(g,[0,1.28,.15],[.34,1.20,.91],.016,.016,MK.log,"nocked-arrow");
    } else {
      [-1,1].forEach(s=>{
        const hand=o.workHands?o.workHands[s===-1?0:1]:o.oke?[s*.17,.96,.31]:o.monk?[s*.07,.96,.24]:o.kuwa&&s===1?[.30,.80,.28]:o.yumi&&s===1?[.35,.96,.14]:[s*.33,.80,.10];
        kBeam(g,[s*.20,1.22,0],[s*.30,1.00,.06],.20,.19,cloth,"sleeve-upper");
        kBeam(g,[s*.30,1.00,.06],hand,.14,.14,cloth,"sleeve-lower");
        kOval(g,skin,...hand,.055,.065,.05,"hand");
      });
    }
    const head=new THREE.Mesh(new THREE.SphereGeometry(.135,12,10),skin);head.position.set(0,1.42,.02);head.scale.set(1,1.12,1);kPart(g,head,'figure-head');
    if(o.kasa){                                                                                                             // 円錐の笠(農夫)
      const kasa=new THREE.Mesh(new THREE.ConeGeometry(.32,.28,16),M({color:o.kasaColor||0xc7a867,roughness:.95}));kasa.position.set(0,1.60,0);kasa.castShadow=true;kasa.receiveShadow=true;g.add(kasa);
    } else if(o.nohat){
      const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.141,14,9,0,Math.PI*2,0,Math.PI*.53),black);hairCap.position.set(0,1.48,.01);g.add(hairCap);
      kOval(g,black,0,1.40,-.085,.12,o.child?.10:.17,.08,"tied-hair");
    } else if(!o.monk){                                                                                                     // 侍烏帽子(僧は剃髪＝被り物なし)
      const eb=new THREE.Group();                                                                                          // 図鑑「侍烏帽子」を頭部だけで別クリック対象にするため小グループ化
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(.09,.115,.2,10),black);cap.position.set(0,1.58,-.01);cap.rotation.x=-.12;eb.add(cap);
      const capTop=box(.16,.1,.17,black,0,1.68,-.03);capTop.rotation.x=-.2;eb.add(capTop);
      g.add(eb); g.userData.eboshi=eb;
    }
    [-1,1].forEach(s=>g.add(box(.03,.008,.008,new THREE.MeshBasicMaterial({color:0x201510}),s*.045,1.44,.14,false)));                          // 目
    [-1,1].forEach(s=>kOval(g,skin,s*.128,1.42,.02,.028,.048,.025,"ear"));
    kOval(g,skin,0,1.415,.153,.022,.040,.030,"nose");
    kBeam(g,[-.025,1.375,.146],[.025,1.375,.146],.008,.008,black,"mouth");
    if(o.monk){                                                                                                             // 数珠(小球の連なり)
      const bm=M({color:0x4a3a2c,roughness:.7});
      for(let i=0;i<14;i++){const a=i/14*Math.PI*2;const bd=new THREE.Mesh(new THREE.SphereGeometry(.018,6,5),bm);bd.position.set(Math.cos(a)*.10,.88+Math.sin(a)*.075,.26);g.add(bd);}
    }
    if(o.kuwa){                                                                                                             // 鍬(柄+刃)
      const sh=cyl(.022,.022,1.1,M({color:0x7a5a34,roughness:.8}),.30,.72,.34,6);sh.rotation.x=-.9;g.add(sh);
      g.add(box(.19,.04,.15,M({color:0x39332a,roughness:.55}),.30,.24,.74));
    }
    if(o.oke){                                                                                                              // 飼葉桶を抱える
      g.add(cyl(.16,.13,.2,M({color:0x8a6a45,roughness:.85}),0,.9,.3,10));
      g.add(cyl(.14,.12,.05,M({color:0xc7a867,roughness:1}),0,1.0,.3,10));
    }
    if(o.tachi){kCurve(g,[[-.31,.89,.30],[-.34,.66,0],[-.36,.30,-.35]],.035,black,"tachi-scabbard");kBeam(g,[-.31,.89,.30],[-.29,1.03,.44],.045,.045,kRope,"tachi-hilt");g.add(box(.14,.025,.10,kIron,-.31,.89,.30));}
    if(o.yumi&&o.pose!=="draw"){const bow=kBow();bow.position.set(.35,.96,-.04);g.add(bow);}
    g.scale.setScalar(scale);
    g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} });
    return g;
  }

  /* ---- 6. 地形: 草地・堀・空堀・土橋 ---- */
  // 北の空堀を草地で塞がない。水堀は草面より高い水面、空堀は露出した溝底を持つ。
  worldK.add(plane(MK.grass,140,107,0,-.02,16.5));
  worldK.add(plane(MK.grass,140,28,0,-.02,-56));
  [-56,56].forEach(x=>worldK.add(plane(MK.grass,28,5,x,-.02,-39.5)));
  const MOAT0=37,MOAT1=42;
  K.hori=plane(MAT.water,2*MOAT1,MOAT1-MOAT0,0,.05,(MOAT0+MOAT1)/2);worldK.add(K.hori);      // 南の水堀
  worldK.add(plane(MAT.water,MOAT1-MOAT0,MOAT0+MOAT1,(MOAT0+MOAT1)/2,.05,2.5));// 東の水堀
  worldK.add(plane(MAT.water,MOAT1-MOAT0,MOAT0+MOAT1,-(MOAT0+MOAT1)/2,.05,2.5));//西の水堀
  K.karabori=plane(MK.dorui,2*MOAT1,MOAT1-MOAT0,0,-.35,-(MOAT0+MOAT1)/2);worldK.add(K.karabori);     // 北の空堀(乾いた溝)
  [-37.3,-41.7].forEach(z=>worldK.add(box(84,.35,.6,MK.dorui,0,-.18,z)));
  worldK.add(plane(MK.grass,2*MOAT1,1.4,0,-.04,-MOAT0-.2));                    // 空堀の縁草
  K.dobashi=box(6,.3,8.5,MK.dorui,0,.16,39.3);worldK.add(K.dobashi);                              // 南の土橋(堀を渡る)
  worldK.add(box(5.4,.08,8.5,MAT.woodDark,0,.32,39.3));                       // 土橋の板張り天端

  /* ---- 7. 土塁+板塀(郭の四周。南=矢倉門・北=裏木戸の開口を空ける) ---- */
  const R=35;
  /* 図鑑「土塁」「板塀」は各区間の子メッシュ([0]=土塁 / [1]=板塀)を登録するため配列に控える */
  K.ramparts=[
    rampart(-19.5,R,31,true), rampart(19.5,R,31,true),    // 南辺(矢倉門の左右)
    rampart(-18.5,-R,33,true), rampart(18.5,-R,33,true),  // 北辺(裏木戸の左右)
    rampart(R,0,2*R,false), rampart(-R,0,2*R,false)       // 東辺・西辺
  ];

  /* ---- 8. 矢倉門(南辺中央)・裏木戸(北辺)・物見矢倉(南東隅) ---- */
  K.yaguramon=(function yaguraGate(){
    const g=new THREE.Group(); g.position.set(0,0,R);
    [[-3,-.9],[3,-.9],[-3,.9],[3,.9]].forEach(p=>g.add(box(.5,4.2,.5,MAT.woodDark,p[0],2.1,p[1]))); // 四本柱
    g.add(box(7.4,.45,.45,MAT.woodDark,0,4.1,-.9)); g.add(box(7.4,.45,.45,MAT.woodDark,0,4.1,.9));   // 梁
    g.add(box(7.6,2.0,2.6,MK.itabei,0,5.3,0));                                                        // 上層矢倉(板壁)
    for(let i=-2;i<=2;i++)g.add(box(.28,.5,.08,MK.slit,i*1.4,5.4,1.33,false));                        // 矢狭間(南面)
    g.add(boardRoof(9,4,1.4,.5,6.4));                                                                 // 板屋根
    [-1,1].forEach(s=>kDoor(g,s*2.74,.03,.9,2.55,3.5,-s,1.18)); // 柱の際の軸で開く。金物も戸に所属
    worldK.add(g); return g;
  })();
  K.urakido=(function backGate(){
    const g=new THREE.Group(); g.position.set(0,0,-R);
    [-1.2,1.2].forEach(x=>g.add(box(.3,2.8,.3,MAT.woodDark,x,1.4,0)));
    g.add(box(2.7,.25,.4,MAT.woodDark,0,2.7,0));
    g.add(box(2.0,2.3,.1,MK.itabei,.2,1.25,0));            // 片開き板戸
    g.add(box(3.4,.2,1.2,MK.itabuki,0,2.98,0));            // 小屋根
    worldK.add(g); return g;
  })();
  K.monomiyagura=(function watchtower(){
    const g=new THREE.Group(); g.position.set(31,0,31);
    const P=[[-1.5,-1.5],[1.5,-1.5],[-1.5,1.5],[1.5,1.5]];
    P.forEach(p=>g.add(box(.35,4.5,.35,MAT.woodDark,p[0],2.25,p[1])));         // 4本柱
    [-1,1].forEach(s=>kBeam(g,[-1.5,.4,s*1.5],[1.5,4.15,s*1.5],.16,.16,MAT.woodDark,"tower-brace"));
    g.add(box(3.7,.2,.2,MAT.woodDark,0,2.2,-1.5)); g.add(box(3.7,.2,.2,MAT.woodDark,0,2.2,1.5)); // 貫
    g.add(box(3.9,.3,3.9,MAT.floor,0,4.4,0));                                  // 高床
    [-1,1].forEach(s=>{ g.add(box(3.9,.5,.1,MAT.woodDark,0,4.85,s*1.9));g.add(box(.1,.5,3.9,MAT.woodDark,s*1.9,4.85,0)); }); // 手すり
    P.forEach(p=>g.add(box(.2,1.5,.2,MAT.woodDark,p[0],5.3,p[1])));            // 上部柱
    g.add(boardRoof(5.2,5.2,1.7,.5,6.05));                                     // 板屋根
    const lad=new THREE.Group(); lad.position.set(0,0,3.0); lad.rotation.x=-.24;
    [-.5,.5].forEach(x=>lad.add(box(.1,4.7,.1,MAT.wood,x,2.35,0)));
    for(let i=0;i<7;i++)lad.add(box(1.1,.08,.08,MAT.wood,0,.6+i*.6,0));        // 梯子
    g.add(lad); worldK.add(g); return g;
  })();

  /* ---- 9. 主殿(郭中央やや北・南面開放で内部を見せる) ---- */
  (function shuden(){
    const cx=0,cz=-5,w=17,d=11,fh=1.0,ph=2.8;
    const b=building({w:w,d:d,fh:fh,ph:ph,roofH:4.6,ridge:.5,wall:false,doors:[]});
    b.position.set(cx,0,cz); b.traverse(m=>{ if(m.isMesh&&m.material===MAT.roof)m.material=MK.itabuki; });
    const entryPosts=[];b.traverse(m=>{const p=m.geometry&&m.geometry.parameters;if(p&&p.width===.3&&p.height===ph&&Math.abs(m.position.x)<.01&&Math.abs(m.position.z-d/2)<.01)entryPosts.push(m);});entryPosts.forEach(m=>m.parent.remove(m));
    worldK.add(b); K.shuden=b;                                                 // 図鑑「主殿」
    kSteps(b,0,d/2,2.8,fh,1.7);
    const wy=fh+ (ph-.2)/2;
    const maira=new THREE.Group(); worldK.add(maira); K.mairado=maira;         // 図鑑「舞良戸」
    for(let i=0;i<6;i++)kPanel(maira,(w-.5)/6,ph-.2,cx-(w-.5)/2+(i+.5)*(w-.5)/6,fh,cz-d/2+.1,0,false);
    for(let i=0;i<3;i++)kPanel(maira,d*.62/3,ph-.2,cx-w/2+.1,fh,cz-1.7-d*.31+(i+.5)*d*.62/3,Math.PI/2,false);
    const shoji=new THREE.Group(); worldK.add(shoji); K.akarishoji=shoji;      // 図鑑「明障子」
    for(let i=0;i<3;i++)kPanel(shoji,d*.62/3,ph-.2,cx+w/2-.1,fh,cz-1.7-d*.31+(i+.5)*d*.62/3,Math.PI/2,true);
    for(let i=0;i<3;i++)kPanel(shoji,6.2/3,ph-.2,cx+1.5+(i+.5)*6.2/3,fh,cz+d/2-.1,0,true);
    /* 置き畳 2〜3枚 */
    const oki=new THREE.Group(); worldK.add(oki); K.okidatami=oki;             // 図鑑「置き畳」
    [[cx-3,cz-1],[cx-3,cz-3.4],[cx+2.4,cz-2]].forEach(p=>{oki.add(box(1.8,.14,2.6,MAT.tatami,p[0],1.075,p[1]));[-.86,.86].forEach(x=>oki.add(box(.08,.145,2.6,MAT.woodDark,p[0]+x,1.075,p[1])));});
    /* 囲炉裏(炉+灰+炎+火光) */
    const ir=new THREE.Group(); ir.position.set(cx+2.0,0,cz-4.4); K.irori=ir;  // 図鑑「囲炉裏」
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
  const samurai=bukeHall(9,6,.8,2.4,3.2,["S"]); samurai.position.set(-15,0,22); worldK.add(samurai); K.samuraidokoro=samurai; // 侍所(門内北西)
  kSteps(samurai,0,3,2.4,.8,1.35);

  (function jibutsudo(){                                                         // 持仏堂(北西・方一間+宝形板屋根+金小仏)
    const g=new THREE.Group(); g.position.set(-20,0,-18); const s=4.0;
    g.name="kamakura-jibutsudo";
    g.add(box(s,.3,s,MAT.floor,0,.6,0));
    [-1.68,1.68].forEach(x=>[-1.68,1.68].forEach(z=>{g.add(box(.38,.45,.38,MAT.woodDark,x,.225,z));g.add(cyl(.28,.31,.12,MK.dorui,x,.06,z,8));}));
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(p=>g.add(box(.25,2.4,.25,MAT.woodDark,p[0]*s*.42,1.8,p[1]*s*.42)));
    g.add(box(s,2.2,.12,MK.itabei,0,1.75,-s/2+.1)); g.add(box(.12,2.2,s,MK.itabei,-s/2+.1,1.75,0)); g.add(box(.12,2.2,s,MK.itabei,s/2-.1,1.75,0));
    [-1.68,1.68].forEach(z=>g.add(box(3.8,.22,.24,MAT.woodDark,0,2.91,z)));
    [-1.68,1.68].forEach(x=>g.add(box(.24,.22,3.8,MAT.woodDark,x,2.91,0)));
    kPart(g,box(3.6,.12,.28,MAT.woodDark,0,.79,1.68),"hall-threshold");
    [-1,1].forEach(sgn=>kDoor(g,sgn*1.54,.85,1.68,1.47,1.95,-sgn,1.40));
    kSteps(g,0,2.0,2.2,.75,1.35);
    g.add(boardRoof(s+1.4,s+1.4,2.0,.02,3.0));                                   // 宝形(ridge≈0でピラミッド状)
    g.add(box(.3,.5,.3,MAT.kin,0,5.0,0));                                        // 露盤・宝珠(金)
    // 木造漆箔の小坐像を読みやすく簡略化。実在像の縮尺複製ではない。
    const bd=new THREE.Group(); bd.position.set(0,.75,-.55);bd.name="kamakura-amida";
    const gold=M({color:0xc59b56,metalness:.28,roughness:.61}),fold=M({color:0x8f672f,metalness:.20,roughness:.72}),hair=M({color:0x453f32,roughness:.85}),eye=M({color:0x433222,roughness:.9});
    kPart(bd,cyl(.55,.59,.12,fold,0,.06,0,24),"lotus-foot");
    kPart(bd,cyl(.48,.54,.14,gold,0,.18,0,24),"lotus-seat");
    const petals=new THREE.InstancedMesh(kSphereGeo.clone().scale(.11,.14,.055),gold,14),pose=new THREE.Object3D();petals.position.y=.20;petals.frustumCulled=false;
    for(let i=0;i<14;i++){const a=i/14*Math.PI*2;pose.position.set(Math.cos(a)*.48,0,Math.sin(a)*.48);pose.rotation.set(0,-a+Math.PI/2,.25);pose.updateMatrix();petals.setMatrixAt(i,pose.matrix);}kPart(bd,petals,"lotus-petals");
    [-1,1].forEach(sgn=>kOval(bd,gold,sgn*.25,.40,.07,.33,.17,.29,"folded-knee"));
    kOval(bd,gold,0,.80,-.035,.29,.44,.20,"robed-torso");
    kOval(bd,gold,0,1.20,0,.105,.12,.105,"neck");
    kOval(bd,gold,0,1.40,.01,.19,.235,.18,"face");
    [-1,1].forEach(sgn=>{
      kOval(bd,gold,sgn*.187,1.36,.012,.052,.12,.043,"long-ear");
      kCurve(bd,[[sgn*.21,1.09,0],[sgn*.34,.88,.02],[sgn*.22,.66,.20]],.105,gold,"robe-sleeve");
      kOval(bd,gold,sgn*.09,.645,.255,.12,.047,.073,"meditation-palm");
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.035,.012,5,12),gold);ring.position.set(sgn*.036,.70,.30);bd.add(ring);
      kCurve(bd,[[sgn*.035,1.445,.177],[sgn*.08,1.46,.170],[sgn*.133,1.44,.145]],.013,fold,"brow");
      kCurve(bd,[[sgn*.034,1.414,.180],[sgn*.075,1.403,.180],[sgn*.116,1.409,.163]],.008,eye,"lowered-eye");
      kCurve(bd,[[sgn*.15,.94,.15],[sgn*.21,.77,.18],[sgn*.30,.53,.25],[sgn*.46,.41,.20]],.012,fold,"robe-fold");
    });
    kOval(bd,gold,0,1.385,.191,.031,.068,.044,"nose");
    kCurve(bd,[[-.051,1.312,.163],[0,1.305,.183],[.051,1.312,.163]],.009,eye,"closed-mouth");
    kOval(bd,gold,0,1.495,.183,.014,.014,.009,"urna");
    const cap=new THREE.Mesh(new THREE.SphereGeometry(.195,20,12,0,Math.PI*2,0,Math.PI*.56),hair);cap.position.set(0,1.47,0);bd.add(cap);
    kOval(bd,hair,0,1.67,-.01,.09,.07,.085,"ushnisha");
    const curls=new THREE.InstancedMesh(kSphereGeo.clone().scale(.028,.026,.028),hair,48);curls.position.y=1.47;curls.frustumCulled=false;pose.rotation.set(0,0,0);
    for(let row=0;row<4;row++){const theta=.28+row*.35,rr=Math.sin(theta)*.20;for(let i=0;i<12;i++){const a=(i+row%2*.5)/12*Math.PI*2;pose.position.set(Math.cos(a)*rr,Math.cos(theta)*.20,Math.sin(a)*rr);pose.updateMatrix();curls.setMatrixAt(row*12+i,pose.matrix);}}kPart(bd,curls,"hair-curls");
    kCurve(bd,[[-.22,1.11,.12],[-.12,.92,.20],[.08,.73,.21],[.26,.60,.21]],.024,fold,"robe-lapel");
    for(let i=0;i<3;i++)kCurve(bd,[[-.38,.39+i*.035,.25],[0,.32+i*.045,.32],[.38,.39+i*.035,.25]],.010,fold,"lap-fold");
    const halo=new THREE.Mesh(new THREE.TorusGeometry(.49,.027,6,40),gold);halo.position.set(0,1.21,-.29);halo.scale.y=1.24;halo.name="halo";bd.add(halo);
    kBeam(bd,[0,.12,-.29],[0,.64,-.29],.07,.06,fold,"halo-support");
    g.add(bd); g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} }); worldK.add(g);
    K.jibutsudo=g; K.amidabutsu=bd;                                              // 図鑑「持仏堂」「阿弥陀仏」
  })();

  K.itakura=(function itakura(){                                                 // 板倉(北東・高床+校倉風井桁壁+妻入屋根)
    const g=new THREE.Group(); g.position.set(18,0,-20); const w=6,d=4.5,fh=1.6;
    [[-1,-1],[1,-1],[-1,1],[1,1],[0,0]].forEach(p=>g.add(cyl(.2,.24,fh,MAT.woodDark,p[0]*w*.35,fh/2,p[1]*d*.35,8))); // 床束
    g.add(box(w,.3,d,MAT.floor,0,fh,0));                                          // 高床
    const wallH=2.4;
    g.add(box(w,wallH,.16,MK.itabei,0,fh+.15+wallH/2,-d/2));
    [-1,1].forEach(sgn=>{g.add(box(.16,wallH,d,MK.itabei,sgn*w/2,fh+.15+wallH/2,0));
      g.add(box(2.25,wallH,.16,MK.itabei,sgn*1.875,fh+.15+wallH/2,d/2));
      g.add(box(.23,wallH+.18,.23,MAT.woodDark,sgn*.78,fh+.15+wallH/2,d/2+.03));});
    kPart(g,box(1.4,2.05,.15,MK.mairado,0,fh+.15+1.025,d/2+.035),"store-door");
    g.add(box(1.7,.16,.22,MAT.woodDark,0,fh+.15+2.10,d/2));
    g.add(box(w+.2,.24,d+.2,MAT.woodDark,0,fh+.25+wallH,0));
    g.add(boardRoof(w+1.6,d+1.6,1.9,.6,fh+.3+wallH+.1));                          // 妻入り板屋根
    g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} }); worldK.add(g); return g;
  })();

  K.umaya=(function umaya(){                                                     // 厩(主殿の東・三間吹き放ち+繋ぎ横木+馬2頭)
    const g=new THREE.Group(); g.position.set(18,0,0); const w=9,d=4,ph=2.6;
    for(let i=0;i<4;i++){ const x=-w/2+i*(w/3); g.add(box(.3,ph,.3,MAT.woodDark,x,ph/2,-d/2+.3)); g.add(box(.3,ph,.3,MAT.woodDark,x,ph/2,d/2-.3)); }
    g.add(box(w,.25,.25,MAT.woodDark,0,ph,-d/2+.3)); g.add(box(w,.25,.25,MAT.woodDark,0,ph,d/2-.3)); // 桁
    for(let i=0;i<4;i++)g.add(box(.20,.22,d,MAT.woodDark,-w/2+i*w/3,ph+.10,0));
    g.add(box(w,ph,.12,MK.itabei,0,ph/2,-d/2+.2));                                // 背面板壁
    g.add(box(w-1,.12,.12,MAT.wood,0,1.2,d/2-.6));                                // 繋ぎ横木
    for(let i=1;i<3;i++)g.add(box(.1,1.6,d-1,MK.itabei,-w/2+i*(w/3),.8,0));       // 仕切り
    g.add(box(w,.06,d,MK.dorui,0,.03,0));                                         // 土間
    g.add(boardRoof(w+1.5,d+2,1.5,.7,ph+.2));                                     // 板屋根
    g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} }); worldK.add(g);
    const h1=makeUma(MK.umaKage);h1.position.set(16,0,.2);worldK.add(h1); K.uma=h1;   // 図鑑「馬」(鹿毛)
    const h2=makeUma(MK.umaKuro);h2.position.set(20,0,.2);worldK.add(h2);
    return g;
  })();

  (function kamaya(){                                                            // 竈屋(主殿の北・土間+竈+煙)
    const g=new THREE.Group(); g.position.set(0,0,-16); const w=6,d=4,ph=2.4;
    for(const px of[-w/2+.3,w/2-.3])for(const pz of[-d/2+.3,d/2-.3])g.add(box(.25,ph,.25,MAT.woodDark,px,ph/2,pz));
    g.add(box(w,.06,d,MK.dorui,0,.03,0));                                         // 土間
    g.add(box(w,ph,.12,MK.itabei,0,ph/2,-d/2+.15)); g.add(box(.12,ph,d,MK.itabei,-w/2+.15,ph/2,0));
    g.add(boardRoof(w+1.5,d+1.5,1.4,.6,ph+.15));
    const stove=new THREE.Group();g.add(stove);K.kamado=stove;
    stove.add(box(1.6,.9,1.0,MK.tsuchi,-1,.45,-.6));
    stove.add(cyl(.35,.4,.12,MK.tsuchi,-.8,.95,-.6,12));
    kPart(stove,box(.55,.42,.015,MK.slit,-1.15,.29,-.09),"stove-fire-mouth");
    kOval(stove,kIron,-.8,1.02,-.6,.34,.24,.34,"cooking-pot");
    stove.add(cyl(.36,.36,.045,MAT.wood,-.8,1.245,-.6,16));stove.add(box(.20,.055,.07,MAT.woodDark,-.8,1.285,-.6));
    const fk=new THREE.Mesh(new THREE.ConeGeometry(.16,.34,7),MAT.flame);fk.position.set(-1.15,.3,-.05);fk.rotation.x=.4;stove.add(fk); // 焚口の火
    g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} }); worldK.add(g);
    for(let i=0;i<5;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(.3+i*.12,8,6),MK.smoke);s.position.set(-1+Math.sin(i)*.4,ph+.7+i*.75,-16-.6);worldK.add(s);} // 煙
  })();

  K.tsurubeido=(function ido(){                                                  // 井戸(竈屋脇・井桁+屋根+桶)
    const g=new THREE.Group(); g.position.set(6,0,-16); const s=1.2;
    for(let i=0;i<3;i++){ const y=.3+i*.25;
      const a=cyl(.09,.09,s+.4,MK.log,0,y,-s/2,7);a.rotation.z=Math.PI/2;g.add(a);
      const b=cyl(.09,.09,s+.4,MK.log,0,y,s/2,7);b.rotation.z=Math.PI/2;g.add(b);
      const c=cyl(.09,.09,s+.4,MK.log,-s/2,y+.12,0,7);c.rotation.x=Math.PI/2;g.add(c);
      const e=cyl(.09,.09,s+.4,MK.log,s/2,y+.12,0,7);e.rotation.x=Math.PI/2;g.add(e);
    }
    [-s/2,s/2].forEach(x=>g.add(box(.12,2.5,.12,MAT.woodDark,x,1.25,0)));          // 支柱は地面から桁へ接続
    g.add(box(s+.6,.14,.14,MAT.woodDark,0,2.5,0));                                // 二本の支柱を結ぶ桁
    g.add(boardRoof(s+1.2,s+1.0,.8,.6,2.6));
    kPart(g,plane(MK.slit,1,1,0,.02,0),"well-dark-opening");
    const pulley=cyl(.15,.15,.07,MAT.woodDark,0,2.32,0,16);pulley.rotation.z=Math.PI/2;g.add(pulley);
    kBeam(g,[0,2.50,0],[0,2.31,0],.08,.08,kIron,"pulley-hanger");
    const wellRope=M({color:0xb99b6b,roughness:1});
    kCurve(g,[[0,2.32,.15],[0,2.03,.205],[0,1.72,.14]],.027,wellRope,"bucket-rope");
    kPart(g,cyl(.18,.16,.28,MAT.wood,0,1.48,.14,12),"well-bucket");
    kCurve(g,[[-.14,1.59,.14],[-.14,1.72,.14],[.14,1.72,.14],[.14,1.59,.14]],.017,kIron,"bucket-handle");
    kPart(g,cyl(.148,.148,.012,MK.slit,0,1.625,.14,12),"bucket-opening");
    g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} }); worldK.add(g); return g;
  })();

  (function koya(cx,cz,w,d){ // 湯屋・厠(北辺際の小屋・外観のみ)
    [[-9,-31,3,2.6],[-5,-31,1.9,1.9]].forEach(a=>{
      const g=new THREE.Group(); g.position.set(a[0],0,a[1]); const ph=2.0;
      g.add(box(a[2],ph,a[3],MK.itabei,0,ph/2,0)); g.add(boardRoof(a[2]+.8,a[3]+.8,.9,.6,ph+.1));
      g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} }); worldK.add(g);
    });
  })();

  /* ---- 11. 武芸の場: 的場(郭内南東)・馬場(郭外南・笠懸+馬1頭) ---- */
  K.matoba=(function matoba(){
    const g=new THREE.Group(); g.position.set(20,0,18);
    const azu=box(4,1.6,1.6,MK.dorui,0,.8,-1.2); g.add(azu); K.azuchi=azu;        // 垜(あずち・土盛り)図鑑「垜」
    [-.9,.9].forEach(x=>g.add(box(.15,1.6,.15,MAT.woodDark,x,.8,0)));             // 的の支柱
    const mato=new THREE.Mesh(new THREE.CylinderGeometry(.7,.7,.08,20),MK.mato);mato.rotation.x=Math.PI/2;mato.position.set(0,1.4,0);g.add(mato); K.mato_main=mato; // 丸的(弓稽古の的1)
    g.add(box(1.2,.05,1.8,MAT.tatami,0,.03,6));                                   // 射座
    g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} }); worldK.add(g); return g;
  })();
  (function baba(){
    const cz=50;
    const babaG=new THREE.Group(); worldK.add(babaG); K.baba=babaG;               // 図鑑「馬場」(柵+横木)
    for(let x=-30;x<=30;x+=5)if(Math.abs(x)>=3){ babaG.add(box(.15,1.2,.15,MAT.wood,x,.6,cz-3.5)); babaG.add(box(.15,1.2,.15,MAT.wood,x,.6,cz+3.5)); }
    [-17,17].forEach(x=>[-3.5,3.5].forEach(z=>babaG.add(box(28,.1,.1,MAT.wood,x,1.0,cz+z)))); // 中央幅6mは門と馬場への出入口
    const matoG=new THREE.Group(); worldK.add(matoG); K.kasagake_mato=matoG;      // 図鑑「笠懸の的」
    [-18,-2,14].forEach(x=>{ matoG.add(box(.12,2.6,.12,MAT.woodDark,x,1.3,cz-4.2)); matoG.add(box(.7,.7,.1,MK.mato,x,1.8,cz-4.2)); });// 笠懸の的
    const h=makeUma(MK.umaKage);h.position.set(-6,0,cz);h.rotation.y=Math.PI/2;worldK.add(h);                                          // 馬1頭
  })();

  /* ---- 12. 周辺(郭外西): 水田(畦+水面/稲面) と 下人小屋 ---- */
  (function ta(){
    const ox=-48,oz=0;
    for(let i=0;i<2;i++)for(let j=0;j<4;j++){
      const x=-52+i*7, z=-22+j*11, flooded=((i+j)%2===0);
      worldK.add(plane(flooded?MAT.water:MK.ine,5.2,9.4,x,flooded?.03:.05,z));
      worldK.add(box(5.6,.15,.3,MK.dorui,x,.08,z-4.8)); worldK.add(box(5.6,.15,.3,MK.dorui,x,.08,z+4.8));
      worldK.add(box(.3,.15,9.8,MK.dorui,x-2.7,.08,z)); worldK.add(box(.3,.15,9.8,MK.dorui,x+2.7,.08,z));
    }
  })();
  (function genin(){                                                             // 下人小屋(田の際・藁葺き)
    [[-51,26],[-51,-31]].forEach(p=>{
      const g=new THREE.Group(); g.position.set(p[0],0,p[1]);
      g.add(box(3.4,1.8,2.8,MK.itabei,0,.9,0)); g.add(boardRoof(4.4,3.8,1.8,.4,1.9)); // ↓屋根は藁葺き色へ差替え
      g.children[g.children.length-1].material=MK.wara;
      g.add(box(.86,1.45,.08,MAT.woodDark,0,.73,1.44));g.add(box(.70,1.30,.07,MK.mairado,0,.68,1.50));
      g.traverse(m=>{ if(m.isMesh){m.castShadow=true;m.receiveShadow=true;} }); worldK.add(g);
    });
  })();

  /* ---- 13. 植栽(松・雑木。tree()流用。SEASONAL登録せず=常時表示) ---- */
  [[30,-30,3.4,"old"],[-30,-31,3.0,null],[32,10,3.2,"old"],[-28,29,2.8,null],[11,31,3.0,null],
   [-11,-29,3.2,"old"],[29,-9,2.6,null],[-46,26,3.0,null],[47,-24,3.2,"old"],[45,21,2.6,null],
   [-31,7,2.8,null],[24,-31,3.0,"old"]].forEach(p=>{
    const t=tree(p[2],p[3]); t.position.set(p[0],0,p[1]); worldK.add(t);
  });

  /* ---- 14. 人物(武士): あるじ1名(主殿前) + 郎党2名(侍所前・的場) ---- */
  const aruji=makeBushiFigure({color:0x27506b,tachi:true,scale:1.06}); // 藍の上下そろいの直垂
  aruji.position.set(2.5,0,4); aruji.rotation.y=0; worldK.add(aruji);                   // 主殿前・門(南)へ正対
  K.hitatare=aruji; K.samuraieboshi=aruji.userData.eboshi;                              // 図鑑「直垂」(全身)「侍烏帽子」(頭部)
  const rodo1=makeBushiFigure({color:0x4a4a3a,yumi:true});               // 侍所前
  rodo1.position.set(-15,0,26); rodo1.rotation.y=0; worldK.add(rodo1);
  const rodo2=makeBushiFigure({color:0x2f4f6b,yumi:true});               // 的場
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
  KAMA_ZONES.push(...kStepZones);
  // 非表示の寝殿の柱を残さず、見えている鎌倉の境界へ置き換える。
  // WALK_SOLIDS は共有の掃引/押出し処理を使う。寸法には歩行者の半径.22mを含める。
  WALK_SOLIDS=[];
  function kSolid(x,z,w,d){WALK_SOLIDS.push({x,z,hw:w/2+.22,hd:d/2+.22});}
  [[-19.5,35,31,3],[19.5,35,31,3],[-18.5,-35,33,3],[18.5,-35,33,3],[35,0,3,70],[-35,0,3,70]].forEach(a=>kSolid(...a));
  [[-22.5,39.5,39,5],[22.5,39.5,39,5],[-39.5,0,5,79],[39.5,0,5,79],[0,-39.5,84,5]].forEach(a=>kSolid(...a));
  function kHallPosts(cx,cz,w,d){
    const nx=Math.max(2,Math.round(w/3)),nz=Math.max(1,Math.round(d/3));
    for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++)if(ix===0||ix===nx||iz===0||iz===nz){if(cx===0&&iz===nz&&ix===nx/2)continue;kSolid(cx-w/2+w*ix/nx,cz-d/2+d*iz/nz,.30,.30);}
  }
  kHallPosts(0,-5,17,11);kHallPosts(-15,22,9,6);
  [[0,-10.4,16.5,.14],[-8.4,-6.7,.14,6.82],[8.4,-6.7,.14,6.82],[4.6,.4,6.2,.1],
    [-15,19.08,8.6,.12],[-19.42,22,.12,5.6],[-10.58,22,.12,5.6],
    [-20,-19.9,4,.12],[-21.9,-18,.12,4],[-18.1,-18,.12,4],
    [18,-20,6,4.5],[0,-17.85,6,.12],[-2.85,-16,.12,4],[-1,-16.6,1.6,1],
    [6,-16,1.5,1.5],[-9,-31,3,2.6],[-5,-31,1.9,1.9],[.2,-35,2,.1],
    [-51,26,3.4,2.8],[-51,-31,3.4,2.8],[20,16.8,4,1.6]].forEach(a=>kSolid(...a));
  // 開き戸のAABBは固定した開角に一致。各扉の板だけを取り、柱と一体の通路を残す。
  worldK.updateMatrixWorld(true);
  worldK.traverse(o=>{if(o.name==="door-leaf"){const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new THREE.Vector3()),s=b.getSize(new THREE.Vector3());kSolid(c.x,c.z,s.x,s.z);}});
  [[-3,34.1],[3,34.1],[-3,35.9],[3,35.9],[-21.68,-16.32],[-18.32,-16.32],[-21.68,-19.68],[-18.32,-19.68],
    [29.5,29.5],[32.5,29.5],[29.5,32.5],[32.5,32.5]].forEach(p=>kSolid(p[0],p[1],.35,.35));
  for(let i=0;i<4;i++)[-1.7,1.7].forEach(z=>kSolid(13.5+i*3,z,.3,.3));
  kSolid(18,-1.8,9,.12);[16.5,19.5].forEach(x=>kSolid(x,0,.1,3));
  // 馬場南北柵にも門への幅6mの通り道を設ける。
  [-17,17].forEach(x=>[46.5,53.5].forEach(z=>kSolid(x,z,28,.15)));
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
    if(m!=="walk"&&m!=="title"&&m!=="quiz"){ toast("この館は散策と名称当てクイズのみ楽しめます",2600); return; }
    if(m!=="walk"&&K.kyudoStop)K.kyudoStop(true);
    return _enterMode(m);
  };
  const _modeBriefData=modeBriefData;
  modeBriefData=function(m){
    if(m==="walk")return {kicker:"KAMAKURA",title:"武家の館を歩く",
      lead:"絵巻などを参考に構成した、鎌倉時代の東国武士の館の模型です。特定の遺構の復元ではありません。寝殿造りの模型との配置の違いを歩いて確かめます。",
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
    function tawara(x,y,z){const tg=new THREE.Group();worldK.add(tg);const t=cyl(.32,.32,1.0,rice,x,y,z,12);t.rotation.z=Math.PI/2;tg.add(t);
      [-.33,0,.33].forEach(o=>{const r=cyl(.325,.325,.03,rope,x+o,y,z,12);r.rotation.z=Math.PI/2;tg.add(r);});return tg;}    // 米俵+縄目
    function oke(x,z,fy){const og=new THREE.Group();worldK.add(og);og.add(cyl(.18,.15,.26,MAT.wood,x,fy+.13,z,10));og.add(cyl(.16,.16,.06,strawTex,x,fy+.27,z,10));return og;} // 桶(飼葉入り)
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
      [-3.7,-2.3].forEach(x=>{const bow=kBow();bow.position.set(x,1.9,z+.15);worldK.add(bow);}); })();
    (function(){ const x=6.5,z=-7.9,y=1.0;                                           // 太刀掛け(太刀1振・黒漆鞘)
      [-.45,.45].forEach(o=>{worldK.add(box(.08,.7,.08,MAT.woodDark,x,y+.35,z+o)); worldK.add(box(.14,.1,.1,MAT.woodDark,x,y+.66,z+o));});
      kCurve(worldK,[[x,y+.72,z-.55],[x+.05,y+.72,z],[x+.12,y+.74,z+.45]],.034,kuroU,"tachi-on-rack");
      kBeam(worldK,[x+.12,y+.74,z+.45],[x+.15,y+.75,z+.67],.05,.05,kRope,"rack-sword-hilt");worldK.add(box(.14,.10,.025,iron,x+.12,y+.74,z+.45)); })();
    (function(){ const x=-6.7;                                                       // 二枚折屏風
      const joint=new THREE.Group();joint.position.set(x,1.01,-3.4);joint.name="joined-screen";worldK.add(joint);
      [-1,1].forEach(s=>{const leaf=new THREE.Group();leaf.rotation.y=s*.62;
        leaf.add(box(1.5,1.5,.05,screen,s*.75,.75,0));
        [0,1.5].forEach(y=>leaf.add(box(1.5,.04,.065,MAT.woodDark,s*.75,y,0)));
        leaf.add(box(.04,1.5,.065,MAT.woodDark,s*1.5,.75,0));joint.add(leaf);});
      joint.add(cyl(.025,.025,1.5,MAT.woodDark,0,.75,0,8)); })();
    (function(){ const x=6.6,z=-4.2,y=1.0;                                           // 棚(横板)+高坏
      worldK.add(box(1.5,.05,.5,MAT.woodDark,x,y+.8,z)); [-.6,.6].forEach(o=>[-.18,.18].forEach(zz=>worldK.add(box(.06,.8,.06,MAT.woodDark,x+o,y+.4,z+zz))));
      worldK.add(cyl(.06,.09,.2,MAT.woodDark,x,y+.9,z,8)); worldK.add(cyl(.17,.1,.05,dishMat,x,y+1.0,z,12)); })();

    /* 侍所(-15,22, 床y=.8, 南開放): 弓3張+箙・盾2・莚・囲炉裏(小)・木刀掛け */
    (function(){ const z=19.4,y=.8;                                                  // 弓3張(背壁)+箙(矢束)
      worldK.add(box(3.2,.08,.1,MAT.woodDark,-15,2.2,z));
      [-16.2,-15,-13.8].forEach(x=>{const bow=kBow();bow.position.set(x,1.6,z+.12);worldK.add(bow);});
      worldK.add(cyl(.13,.16,.8,MAT.woodDark,-12.4,1.2,z+.2,8)); for(let i=0;i<7;i++)worldK.add(cyl(.01,.01,.5,bowWood,-12.4+(i-3)*.03,1.75,z+.2,4)); })();
    [21.2,21.9].forEach((zz,i)=>{const s=box(.9,1.3,.07,MAT.woodDark,-19.2+i*.12,1.45,zz);s.rotation.z=.12;worldK.add(s);}); // 盾2枚立てかけ
    worldK.add(plane(strawTex,3.0,3.0,-15,.82,22));                                  // 莚
    (function(){ const x=-15,z=22,y=.8;                                              // 囲炉裏(小)
      worldK.add(box(.9,.18,.9,MAT.woodDark,x,y+.09,z)); worldK.add(box(.66,.08,.66,MAT.ash,x,y+.14,z)); worldK.add(flame(.14,.3,MAT.flame,x,y+.3,z)); })();
    (function(){ const z=24.4,y=.8;                                                  // 木刀掛け
      worldK.add(box(1.4,.08,.1,MAT.woodDark,-15,1.5,z)); [-.4,.4].forEach(o=>worldK.add(cyl(.02,.02,.9,MAT.wood,-15+o,1.1,z+.1,6))); })();

    /* 厩(18,0, 土間): 飼葉桶2・藁束3・鞍鐙掛け台・手綱・馬糞よけの筵 */
    K.kaibaoke=oke(15,1.3,0); oke(19,1.3,0);                                         // 飼葉桶×2 図鑑「飼葉桶」
    bundle(14,-1.2); bundle(22,-1.0); bundle(21.2,1.4);                              // 藁束×3
    (function(){ const x=14.0,z=0,y=0;                                               // 鞍と鐙の掛け台 図鑑「鞍」
      const kg=new THREE.Group(); worldK.add(kg); K.kura_saddle=kg;
      [-.5,.5].forEach(o=>kg.add(box(.08,1.0,.08,MAT.woodDark,x,y+.5,z+o))); kg.add(box(.12,.1,1.2,MAT.woodDark,x,y+1.0,z));
      kg.add(box(.52,.11,.68,kuroU,x,y+1.14,z));
      [-.35,.35].forEach(zz=>kCurve(kg,[[x-.30,1.16,z+zz],[x-.23,1.43,z+zz],[x,1.51,z+zz],[x+.23,1.43,z+zz],[x+.30,1.16,z+zz]],.055,MAT.wood,"saddle-arch"));
      [-1,1].forEach(s=>{kBeam(kg,[x+s*.25,1.15,z],[x+s*.34,.72,z],.04,.025,kuroU,"stirrup-strap");
        kCurve(kg,[[x+s*.34,.75,z],[x+s*.34,.57,z-.10],[x+s*.34,.46,z],[x+s*.34,.57,z+.10],[x+s*.34,.75,z]],.022,iron,"stirrup-ring");}); })();
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
    K.tawara=tawara(15.6,.32,-17.6); tawara(15.6,.32,-16.6); tawara(16.4,.32,-17.1); tawara(15.6,.98,-17.1); // 米俵×4 図鑑「俵」
    [[17.4,-16.2],[17.4,-15.1]].forEach(p=>{worldK.add(box(.9,.6,.6,MAT.woodDark,p[0],.3,p[1])); worldK.add(box(.94,.08,.64,MAT.wood,p[0],.63,p[1]));}); // 木櫃×2
    (function(){ const g=new THREE.Group();g.position.set(18,0,-17.28);g.rotation.x=-.27;g.name="store-ladder";
      [-.35,.35].forEach(x=>g.add(box(.08,1.9,.08,MAT.wood,x,.95,0))); for(let i=0;i<6;i++)g.add(box(.8,.06,.06,MAT.wood,0,.25+i*.29,0)); worldK.add(g); })();

    /* 持仏堂(-20,-18, 床y=.75): 香炉・花瓶一対・経机+経巻・座布 */
    (function(){ const x=-20,z=-16.6,y=.75;                                          // 香炉(小・三足)+香の火
      worldK.add(cyl(.14,.16,.12,bronze,x,y+.12,z,10)); [0,2.09,4.18].forEach(a=>worldK.add(cyl(.02,.02,.12,bronze,x+Math.cos(a)*.11,y+.06,z+Math.sin(a)*.11,5)));
      const hf=new THREE.Mesh(new THREE.SphereGeometry(.03,6,5),new THREE.MeshBasicMaterial({color:0xffb060}));hf.position.set(x,y+.2,z);worldK.add(hf); })();
    [-.7,.7].forEach(o=>{const x=-20+o,z=-17.0,y=.75;                                // 花瓶一対
      worldK.add(cyl(.09,.06,.28,MK.tsuchi,x,y+.14,z,10)); worldK.add(cyl(.02,.02,.24,M({color:0x6f8f5a,roughness:.8}),x,y+.4,z,4));});
    (function(){ const x=-21.0,z=-18.6,y=.75;                                        // 経机+経巻
      worldK.add(box(.9,.05,.4,MAT.woodDark,x,y+.3,z)); [[-.38,-.15],[.38,-.15],[-.38,.15],[.38,.15]].forEach(p=>worldK.add(box(.05,.3,.05,MAT.woodDark,x+p[0],y+.15,z+p[1])));
      const roll=cyl(.045,.045,.5,paper,x,y+.35,z,8);roll.rotation.z=Math.PI/2;worldK.add(roll); })();
    worldK.add(box(.6,.08,.6,strawTex,-20,.79,-16.4));                               // 座具は床上、階段外へ浮かせない

    /* 外構 */
    function kagaribi(x,z){ const g=new THREE.Group();g.position.set(x,0,z);         // 篝火台(夜は火・PointLight)
      [[-.2,-.12],[.2,-.12],[0,.22]].forEach(p=>{const l=cyl(.05,.05,1.6,MAT.woodDark,p[0],.8,p[1],6);l.rotation.x=p[1]>0?.14:-.14;g.add(l);});
      g.add(cyl(.34,.26,.32,iron,0,1.55,0,10)); g.add(cyl(.3,.24,.06,charcoal,0,1.45,0,10));
      g.add(flame(.26,.62,MAT.flame,0,1.92,0)); g.add(flame(.14,.36,yFlame,0,2.0,0));
      const pl=new THREE.PointLight(0xff9440,.95,11,2);pl.position.set(0,2.2,0);g.add(pl); worldK.add(g); }
    kagaribi(-4.2,33.6); kagaribi(4.2,33.6);                                         // 篝火台×2(門脇, PointLight2つ=上限)
    (function(){ const post=(x,z,ax,az)=>{const p=cyl(.12,.14,2.4,MAT.woodDark,x,1.2,z,6);p.rotation.z=ax;p.rotation.x=az;worldK.add(p);};
      for(let x=-28;x<=28;x+=14)if(Math.abs(x)>4)post(x,33.4,0,.18); for(let z=-26;z<=26;z+=13){post(33.4,z,-.18,0);post(-33.4,z,.18,0);} })(); // 門の開口内に控柱を置かない
    (function(){ const x=31,z=30.0;                                                  // 物見矢倉の半鐘(小鐘)
      worldK.add(box(.06,.06,1.0,MAT.woodDark,x,5.2,z)); worldK.add(cyl(.006,.006,.5,rope,x,4.95,z,4));
      worldK.add(cyl(.14,.18,.32,bronze,x,4.7,z,10)); worldK.add(cyl(.06,.02,.1,bronze,x,4.9,z,8)); })();
    (function(){ const x=22,z=20;                                                    // 的場の矢立て+予備の的
      worldK.add(cyl(.14,.16,.7,MAT.woodDark,x,.35,z,8)); for(let i=0;i<6;i++)worldK.add(cyl(.012,.012,.8,bowWood,x+(i-3)*.03,.9,z,4));
      const m=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,.06,18),MK.mato);m.rotation.x=Math.PI/2;m.rotation.z=.18;m.position.set(23.5,.7,17);m.castShadow=true;m.receiveShadow=true;worldK.add(m); K.mato_spare=m;
      kBeam(worldK,[23.5,0,16.75],[23.5,1.05,17],.09,.09,MAT.wood,"spare-target-prop"); })(); // 的面を射座へ向ける
    [-17,17].forEach(x=>[46.5,53.5].forEach(z=>K.baba.add(box(28,.1,.1,MAT.wood,x,.5,z)))); // 柵の中段も出入口を空ける
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
    const mon=(x,rot)=>{const f=makeBushiFigure({color:0x3a4a5a,yumi:true,scale:1.0});f.position.set(x,0,33);f.rotation.y=rot;worldK.add(f);};
    mon(-2.8,Math.PI); mon(2.8,Math.PI);                                            // 門番×2(矢倉門内側・門へ正対)
    const archer=makeBushiFigure({color:0x2f4f6b,pose:"draw",scale:1.03}); archer.position.set(18.5,0,25.2); archer.rotation.y=Math.PI; worldK.add(archer); K.archer=archer;
    const umaban=makeBushiFigure({color:0xa08a5a,oke:true,scale:.99}); umaban.position.set(14,0,2.6); umaban.rotation.y=0; worldK.add(umaban);
    const gejo=makeBushiFigure({color:0x7e715d,hakama:0x675d4d,nohat:true,scale:.95}); gejo.position.set(-1,0,-14.2); gejo.rotation.y=Math.PI;
    gejo.add(box(.32,.5,.06,M({color:0xb8ae92,roughness:.9}),0,.55,.2)); worldK.add(gejo);   // 下女(小袖+前掛け・竈前)
    const sou=makeBushiFigure({monk:true,scale:1.0}); sou.position.set(-22.3,0,-14.7); sou.rotation.y=.6; worldK.add(sou);   // 参道と階段を空ける
    const nofu=makeBushiFigure({color:0x6b6a58,hakama:0x5a5240,kasa:true,kuwa:true,scale:1.0}); nofu.position.set(-45,0,3); nofu.rotation.y=Math.PI/2; worldK.add(nofu); // 農夫(田・円錐笠+鍬)
    const warabe=makeBushiFigure({color:0x9a4a38,hakama:0x4a5a6a,nohat:true,child:true,scale:.6}); warabe.position.set(-3,0,9); warabe.rotation.y=Math.PI; worldK.add(warabe);
  })();

  /* ---- 18b. 荷・文書・食器を扱う生活の場（創作配置、典拠と年代は専用docs） ----
     建物の外形と小道具を同じ親へ置き、床/台の上面を接合の基準にする。
     新しい毎フレーム処理はない。ゲームは末尾の明示APIから別モジュールへ接続する。 */
  const kLifeRoots=[],kLifeColliders=[],kLifeAnchors={};
  const kLifeBoxGeo=new THREE.BoxGeometry(1,1,1),kLifeStone=M({color:0x77786c,roughness:1});
  function kLifeBox(g,name,w,h,d,x,y,z,mat){
    const m=new THREE.Mesh(kLifeBoxGeo,mat||MAT.wood);m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return kPart(g,m,name);
  }
  function kLifeGroup(name,x,y,z,parent){const g=new THREE.Group();g.name=name;g.position.set(x,y,z);(parent||worldK).add(g);return g;}
  function kLifeSolid(x,z,w,d){kSolid(x,z,w,d);kLifeColliders.push({x,z,w,d});}
  function kLifeShelter(name,x,z,w,d,floor){
    const g=kLifeGroup(name,x,0,z),postY=floor+2.35,postX=w/2-.18,postZ=d/2-.18;
    kLifeRoots.push(g);g.userData.contentFacility=true;
    if(floor){
      kLifeBox(g,'work-floor',w,.18,d,0,floor-.09,0,MK.itabei);
      KAMA_ZONES.push([x,z,w,d,floor]);
      // 三段の上面と歩行高を同時生成。中央1.9mの入口を保つ。
      for(let i=0;i<3;i++){const h=floor*(i+1)/3,zz=d/2+(2-i)*.38+.19;kLifeBox(g,'work-step',1.9,h,.40,0,h/2,zz);KAMA_ZONES.push([x,z+zz,1.9,.4,h]);}
    }
    for(const xx of[-postX,postX])for(const zz of[-postZ,postZ]){
      kLifeBox(g,'work-post',.20,postY,.20,xx,postY/2,zz,MAT.woodDark);kLifeSolid(x+xx,z+zz,.20,.20);
      kLifeBox(g,'post-stone',.32,.08,.32,xx,.04,zz,kLifeStone);
    }
    for(const zz of[-postZ,postZ])kLifeBox(g,'work-beam',w,.20,.22,0,postY,zz,MAT.woodDark);
    for(const xx of[-postX,postX])kLifeBox(g,'work-tie',.18,.20,d,xx,postY,0,MAT.woodDark);
    const roof=boardRoof(w+.9,d+1.0,1.0,.6,postY+.10);roof.name='work-roof';g.add(roof);
    // 北壁のみ板で囲い、正面と両側から見通せる。柱→桁→屋根が連続。
    kLifeBox(g,'work-back-wall',w-.35,2.15,.09,0,floor+1.075,-postZ,MK.itabei);kLifeSolid(x,z-postZ,w-.35,.09);
    return g;
  }
  function kLifeTable(parent,x,y,z,w,d,h){
    const t=kLifeGroup('work-table',x,y,z,parent);kLifeBox(t,'table-top',w,.07,d,0,h-.035,0,MK.itabei);
    for(const xx of[-w/2+.10,w/2-.10])for(const zz of[-d/2+.10,d/2-.10])kLifeBox(t,'table-leg',.09,h-.06,.09,xx,(h-.06)/2,zz,MAT.woodDark);
    for(const zz of[-d/2+.10,d/2-.10])kLifeBox(t,'table-stretcher',w-.2,.06,.06,0,.16,zz,MAT.woodDark);return t;
  }
  const kBentwoodGeo=new THREE.LatheGeometry([[0,0],[.30,0],[.32,.03],[.32,.34],[.291,.34],[.291,.045],[0,.045]].map(p=>new THREE.Vector2(...p)),20);
  const kBowlGeo=new THREE.LatheGeometry([[0,0],[.07,0],[.075,.035],[.13,.07],[.18,.16],[.182,.185],[.164,.185],[.15,.12],[.105,.065],[0,.052]].map(p=>new THREE.Vector2(...p)),20);
  const kBowlMat=M({color:0x54271e,roughness:.47}),kPaperMat=M({color:0xe8dfbd,roughness:1}),kInkMat=M({color:0x343532,roughness:.78});
  function kBentwood(parent,x,y,z){
    const g=kLifeGroup('bentwood-vessel',x,y,z,parent);kPart(g,new THREE.Mesh(kBentwoodGeo,MAT.wood),'bentwood-wall-and-base');
    // 薄板の継ぎ目を縫い留める。桶の縦板/箍と取り違えない。
    for(const yy of[.09,.17,.25])kLifeBox(g,'bentwood-stitch',.055,.015,.018,.02,yy,.320,MAT.woodDark);
    return g;
  }
  function kBowl(parent,x,y,z){const m=new THREE.Mesh(kBowlGeo,kBowlMat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return kPart(parent,m,'lacquer-bowl');}
  function kLifePerson(id,x,y,z,options){
    const g=makeBushiFigure(options);g.name=id;g.position.set(x,y,z);g.userData.contentRole=id;worldK.add(g);K[id]=g;return g;
  }
  (function dailyWork(){
    // 荷受けは倉南側。厩と東の松の間に接近路を残す。
    const load=kLifeShelter('delivery-shelter',24,-10,5.2,3.8,0);K.niuke=load;
    const rack=kLifeTable(load,-1.1,0,-.60,1.65,.90,.42);kLifeSolid(22.9,-10.6,1.65,.90);
    K.magemono=kBentwood(rack,-.35,.42,0);kBentwood(rack,.38,.42,0);
    const tied=kLifeGroup('tied-package',1.05,0,-.65,load);
    kLifeBox(tied,'package-core',.90,.60,.72,0,.30,0,MK.wara);
    for(const xx of[-.26,.26])kCurve(tied,[[xx,.05,-.37],[xx,.62,-.37],[xx,.63,.37],[xx,.05,.37]],.018,kRope,'package-lashing');
    kLifeSolid(25.05,-10.65,.94,.78);
    K.nifuda=kLifeGroup('cargo-tag',0,.44,.39,tied);
    kLifeBox(K.nifuda,'tag-board',.18,.29,.025,0,0,0,MAT.wood);
    kCurve(K.nifuda,[[0,.11,.012],[0,.23,-.03],[0,.20,-.08]],.012,kRope,'tag-string');
    [-.045,0,.045].forEach((xx,i)=>kLifeBox(K.nifuda,'tag-ink',.012,.10+i*.015,.003,xx,-.015,.014,kInkMat));
    const porter=kLifePerson('nihakobi_k',24.3,0,-8.25,{nohat:true,color:0x7e7456,hakama:0x665641,workHands:[[-.25,.99,.35],[.25,.99,.35]]});
    kLifeBox(porter,'carried-box',.55,.30,.43,0,1.10,.36,MK.wara);
    kLifeBox(porter,'carried-tie',.57,.025,.025,0,1.10,.59,kRope);
    kLifeAnchors.deliveries={object:porter,position:{x:24.3,y:0,z:-6.8},itemId:'nihakobi_k'};

    // 文書を扱う小部屋。主殿に隣接する創作の事務空間で、幕府の政所の復元ではない。
    const office=kLifeShelter('document-room',-15,-6,4.8,4.0,.36);K.fumidokoro=office;
    const desk=kLifeTable(office,-.55,.36,-.35,1.90,.80,.46);K.fumizukue=desk;kLifeSolid(-15.55,-6.35,1.9,.8);
    K.suzuri_k=kLifeGroup('writing-kit',.47,.46,0,desk);
    kLifeBox(K.suzuri_k,'inkstone-base',.28,.045,.42,0,.0225,0,kInkMat);
    kLifeBox(K.suzuri_k,'inkstone-sea',.205,.004,.13,0,.047,-.10,MK.slit);
    const waterMat=M({color:0x967846,metalness:.38,roughness:.58});
    kOval(K.suzuri_k,waterMat,.33,.09,-.06,.09,.09,.085,'water-dropper');
    kBeam(K.suzuri_k,[.32,.10,0],[.32,.12,.06],.032,.032,waterMat,'water-dropper-spout');
    kLifeBox(K.suzuri_k,'ink-stick',.035,.025,.14,-.19,.013,-.07,kInkMat);
    K.shojo_k=kLifeGroup('letter-sheet',-.32,.465,.04,desk);
    kLifeBox(K.shojo_k,'letter-paper',.58,.009,.38,0,.0045,0,kPaperMat);
    for(let col=0;col<5;col++)for(let row=0;row<5;row++)kLifeBox(K.shojo_k,'letter-ink',.012+(row%2)*.012,.001,.018,.20-col*.09,.0097,-.13+row*.046,kInkMat);
    const writer=kLifePerson('kakite_k',-15.55,.36,-7.05,{color:0x655274,workHands:[[-.22,1.00,.33],[-.12,1.00,.42]]});
    // 跪坐：元の立脚だけを外し、上半身を膝上へ下げる。机と筆・掌が同じ高さになる。
    writer.children.slice().forEach(o=>{if(o.name==='hakama-leg'||o.name==='figure-ankle'||o.name==='figure-foot')writer.remove(o);else o.position.y-=.46;});
    const cloth=writer.getObjectByName('tailored-torso').material;
    [-1,1].forEach(s=>kOval(writer,cloth,s*.16,.16,.09,.18,.16,.30,'seated-hakama'));
    kBeam(writer,[-.12,.54,.42],[-.12,.486,.59],.018,.018,MAT.woodDark,'held-brush');
    kOval(writer,kInkMat,-.12,.478,.606,.011,.015,.02,'brush-tip');
    // 手紙を運ぶ役は机正面の開口から離し、入口と既存の西回廊を空ける。
    const messenger=kLifePerson('tsukai_k',-17.0,0,-2.35,{color:0x54705e,workHands:[[-.17,.96,.31],[.17,.96,.31]]});
    kLifeBox(messenger,'folded-letter',.36,.20,.035,0,1.03,.33,kPaperMat);
    kLifeBox(messenger,'letter-tie',.018,.21,.038,0,1.03,.33,kRope);
    kLifeAnchors.documents={object:writer,position:{x:-15,y:.36,z:-4.8},itemId:'kakite_k'};
    kLifeAnchors.messenger={object:messenger,position:{x:-17,y:0,z:-.9},itemId:'tsukai_k'};

    // 配膳仕事場は竈屋の西北。水を汲む・炊く・器を整える場を区別する。
    const serving=kLifeShelter('serving-shelter',-7,-19,4.7,3.2,0);K.haizendai=serving;
    const table=kLifeTable(serving,0,0,-.55,2.9,.9,.79);kLifeSolid(-7,-19.55,2.9,.9);
    K.urushiwan=kLifeGroup('serving-bowls',-.66,.79,0,table);
    kBowl(K.urushiwan,-.30,0,0);kBowl(K.urushiwan,.20,0,0);kBowl(table,.7,.79,.07);
    const vessel=kBentwood(table,1.05,.79,-.12);vessel.scale.setScalar(.64);
    K.hashi_k=kLifeGroup('chopsticks',-.24,.80,.29,table);
    [-.028,.028].forEach(zz=>kLifeBox(K.hashi_k,'chopstick',.30,.012,.012,0,0,zz,MAT.wood));
    const server=kLifePerson('haizen_k',-7,0,-17.90,{nohat:true,color:0x99795b,hakama:0x545f59,workHands:[[-.28,.97,.34],[.28,.97,.34]]});
    kLifeBox(server,'carried-tray',.62,.035,.42,0,.99,.35,MAT.woodDark);kBowl(server,0,1.0075,.35);
    kLifeAnchors.serving={object:server,position:{x:-7,y:0,z:-16.6},itemId:'haizen_k'};
    // 登録根とラベル位置を一つの表へ。後で子を先に図鑑登録する。
    K.contentEntries=[['magemono',K.magemono,[22.55,1.1,-10.6]],['nifuda',K.nifuda,[25.05,1.1,-10.3]],
      ['suzuri_k',K.suzuri_k,[-15.08,1.15,-6.35]],['shojo_k',K.shojo_k,[-15.87,1.08,-6.31]],
      ['urushiwan',K.urushiwan,[-7.66,1.35,-19.55]],['hashi_k',K.hashi_k,[-7.24,1.10,-19.26]],
      ['niuke',K.niuke,[24,3.4,-10]],['haizendai',K.haizendai,[-7,3.1,-19]],
      ['kakite_k',writer,[-15.55,1.75,-7.05]],['tsukai_k',messenger,[-17,2.1,-2.35]],
      ['nihakobi_k',porter,[24.3,2.1,-8.25]],['haizen_k',server,[-7,2.1,-17.90]]];
    kLifeRoots.forEach(g=>g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}}));
  })();

  /* ---- 19. 図鑑登録・名称札・クイズ鎌倉編(計画§4/§5, Wave2) ----
     register() でクリック対象化(rayTargets)＋interactables登録、makeLabel() で名称札を生成。
     本ブロックは本体の自動ラベル付与ループ(約8346行)より後に実行されるため makeLabel を手動で呼ぶ。
     前提: ITEMS に武家30項目(cat:"k")が登録済み(items.js, コミット①)。平安側は本ブロック非実行=無影響。
     親子で別項目にするもの(垜⊂的場 / 阿弥陀仏⊂持仏堂 / 侍烏帽子⊂直垂)は、
     子を先に register して iid を確定させてから親を register する(register は未マーク面のみ付与)。 */
  (function codexKama(){
    const V=(x,y,z)=>new THREE.Vector3(x,y,z);
    const done={};
    function reg(root,id,lp){ if(!root||!ITEMS[id])return; register(root,id,lp); if(!done[id]){done[id]=true; makeLabel(id);} }

    K.contentEntries.forEach(([id,root,p])=>reg(root,id,V(...p)));

    /* 地形・外構 */
    reg(K.hori,"hori",V(8,1.1,39.5));
    reg(K.karabori,"karabori",V(0,.9,-39));
    reg(K.dobashi,"dobashi",V(0,.75,39.3));
    /* 土塁・板塀: 各区間の子メッシュ([0]=土塁 / [1]=板塀)を全区間登録し、札は代表位置に1枚 */
    (K.ramparts||[]).forEach(g=>{ if(g.children[0])register(g.children[0],"dorui"); if(g.children[1])register(g.children[1],"itabei"); });
    if(ITEMS.dorui&&interactables.dorui){interactables.dorui.labelPos=V(35,1.9,6); if(!done.dorui){done.dorui=true;makeLabel("dorui");}}
    if(ITEMS.itabei&&interactables.itabei){interactables.itabei.labelPos=V(-35,2.7,6); if(!done.itabei){done.itabei=true;makeLabel("itabei");}}
    reg(K.yaguramon,"yaguramon",V(0,4.6,34));
    reg(K.urakido,"urakido",V(0,2.4,-35));
    reg(K.monomiyagura,"monomiyagura",V(31,5.2,31));

    /* 主殿まわり */
    reg(K.shuden,"shuden_k",V(-7,3.4,-5));
    reg(K.mairado,"mairado",V(-8.4,2.7,-6.7));
    reg(K.akarishoji,"akarishoji",V(8.4,2.7,-6.7));
    reg(K.okidatami,"okidatami",V(-3,1.5,-6));
    reg(K.irori,"irori",V(2,1.9,-9.4));

    /* 侍所・厩・馬具・持仏堂・板倉・竈・井戸 */
    reg(K.samuraidokoro,"samuraidokoro",V(-15,3.4,22));
    reg(K.umaya,"umaya",V(18,3.4,0));
    reg(K.uma,"uma",V(16,2.4,.2));
    reg(K.kaibaoke,"kaibaoke",V(15,1.9,0));
    reg(K.kura_saddle,"kura_saddle",V(14,2.1,0));
    reg(K.amidabutsu,"amidabutsu",V(-20,1.8,-18.5)); reg(K.jibutsudo,"jibutsudo",V(-20,3.6,-18)); // 子(阿弥陀仏)を先に
    reg(K.itakura,"itakura",V(18,3.8,-20));
    reg(K.tawara,"tawara",V(15.6,1.1,-17.6));
    reg(K.kamado,"kamado",V(-1,1.6,-16.6));
    reg(K.tsurubeido,"tsurubeido",V(6,3.0,-16));

    /* 武芸の場 */
    reg(K.azuchi,"azuchi",V(20,1.9,16.8)); reg(K.matoba,"matoba",V(20,2.4,19));       // 子(垜)を先に
    reg(K.kasagake_mato,"kasagake_mato",V(-2,2.9,45.8));
    reg(K.baba,"baba",V(0,1.7,46.5));

    /* 人物(あるじ): 頭部(侍烏帽子)を先に、全身(直垂)を後に */
    reg(K.samuraieboshi,"samuraieboshi",V(2.5,2.05,4)); reg(K.hitatare,"hitatare",V(2.5,1.35,4));

    /* クイズ鎌倉編の出題プール(計画§5の14項目)。本体の startQuiz が APP.map==="kamakura" 時に参照する。 */
    window._kamaQuizPool=["hori","dorui","itabei","yaguramon","monomiyagura","shuden_k","mairado","okidatami","irori","umaya","matoba","azuchi","jibutsudo","itakura"];

    /* クイズ出題札のカテゴリ表記(本体のハードコード表に "k" が無く空になるため、鎌倉時のみ補う) */
    if(typeof showQuizQ==="function"){ const _sqq=showQuizQ; showQuizQ=function(){ const r=_sqq.apply(this,arguments);
      try{ const q=APP.quiz,it=q&&ITEMS[q.qs[q.i]]; if(it&&it.cat==="k"){ const el=document.getElementById("quizHint"); if(el)el.textContent="〔武家〕"; } }catch(e){}
      return r; }; }
  })();

  /* ---- 20. 遊び: 的場の弓稽古ミニゲーム(計画§6, Wave3-①) ----
     既存 taiji の破魔の矢機構(spawnArrow/updateTaijiFx/seArrowShot/seArrowHit)を
     walk内オーバーレイとして流用する。専用モードは新設せず(enterModeゲートと衝突するため)、
     APP.kamaKyudo の自前状態＋animate相乗り(kamaFrame)で駆動。平安側は本ブロック非実行=無影響。
     - 射座(専用の畳マット K.kyudoSeat・register外)クリック→確認→開始
     - 的3枚(丸的/掛け替え的/笠懸の的)へ10射。中心=2点/的中=1点。10射で結果・自己ベスト。
     - 稽古中は移動を射座に固定、Escで中断(自前keydown・active時のみ作用)。 */
  (function kamaPlay(){
    /* 共有モーダル(確認/結果/世話panel等。DOMはcreateElementのみ＝verify-htmlのid静的検査に無影響) */
    let _modalEl=null;
    function closeModal(){ if(_modalEl){ if(_modalEl.parentNode)_modalEl.parentNode.removeChild(_modalEl); _modalEl=null; } }
    function modal(opt){
      closeModal();
      const ov=document.createElement("div");
      ov.style.cssText="position:fixed;inset:0;z-index:520;display:flex;align-items:center;justify-content:center;background:rgba(6,9,13,.62);padding:20px;";
      const card=document.createElement("div");
      card.style.cssText="max-width:340px;width:100%;background:linear-gradient(180deg,#1b232e,#12181f);border:1px solid rgba(63,109,158,.55);border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.72);padding:20px 20px 16px;color:#c9cdbd;font-family:var(--serif,serif);";
      const h=document.createElement("div"); h.textContent=opt.title||""; h.style.cssText="font-size:18px;color:#d5d9cb;margin-bottom:8px;letter-spacing:.06em;";
      const b=document.createElement("div"); b.innerHTML=opt.body||""; b.style.cssText="font-size:13.5px;line-height:1.75;color:#bcc1b2;margin-bottom:16px;";
      card.appendChild(h); card.appendChild(b);
      const row=document.createElement("div"); row.style.cssText="display:flex;flex-direction:column;gap:8px;";
      (opt.actions||[]).forEach(a=>{
        const btn=document.createElement("button"); btn.type="button"; btn.textContent=a.label;
        btn.style.cssText="min-height:44px;border-radius:8px;font-size:14px;cursor:pointer;font-family:inherit;border:1px solid "+(a.primary?"#8fb0d2":"rgba(111,143,122,.5)")+";background:"+(a.primary?"linear-gradient(155deg,#3f6d9e,#22405f)":"rgba(26,34,44,.9)")+";color:"+(a.primary?"#eef3f8":"#c9cdbd")+";";
        btn.onclick=function(e){ e.stopPropagation(); if(typeof beep==="function")beep(a.primary?680:520,.06); if(a.on)a.on(); };
        row.appendChild(btn);
      });
      card.appendChild(row);
      ov.appendChild(card);
      ov.addEventListener("click",function(e){ if(e.target===ov&&opt.dismissable!==false)closeModal(); });
      document.body.appendChild(ov); _modalEl=ov; return ov;
    }
    /* 他セクション(Wave3-②)から使えるよう控える */
    K.modal=modal; K.closeModal=closeModal; K.isModalOpen=function(){ return !!_modalEl; };

    /* 射座マット(藍の縁取り＝「ここで射る」の合図。register外＝図鑑と非衝突) */
    K.kyudoSeat=(function(){
      const mat=M({map:canv(64,64,(x,w,h)=>{ x.fillStyle="#233241";x.fillRect(0,0,w,h);
        for(let i=8;i<w;i+=8){x.strokeStyle="rgba(96,126,158,.45)";x.lineWidth=1;x.beginPath();x.moveTo(i,0);x.lineTo(i,h);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(w,i);x.stroke();}
        x.strokeStyle="rgba(168,196,224,.85)";x.lineWidth=5;x.strokeRect(3,3,w-6,h-6); }),roughness:.9});
      const m=new THREE.Mesh(new THREE.PlaneGeometry(1.4,2.0),mat); m.rotation.x=-Math.PI/2; m.position.set(20,.09,24.5); m.receiveShadow=true; m.userData.kamaSeat=true;
      worldK.add(m); return m;
    })();

    /* 稽古状態と的リスト(丸的/掛け替え的/笠懸の的×3) */
    const kyudo={active:false,fired:0,landed:0,score:0,cd:0,generation:0,resultTimer:null,resultOpen:false,savedView:null,stance:{x:20,z:24.5},stuck:[],targets:[]};
    APP.kamaKyudo=kyudo;
    if(K.mato_main)kyudo.targets.push({m:K.mato_main,r:.7});
    if(K.mato_spare)kyudo.targets.push({m:K.mato_spare,r:.6});
    if(K.kasagake_mato)K.kasagake_mato.children.forEach(c=>{ const p=c.geometry&&c.geometry.parameters; if(p&&Math.abs((p.width||0)-.7)<.02&&Math.abs((p.height||0)-.7)<.02)kyudo.targets.push({m:c,r:.36}); });

    function clearStuck(){ if(kyudo.stuck.length){ kyudo.stuck.forEach(g=>taijiDisposeFx(g)); kyudo.stuck=[]; } }
    function addStuck(from,to){
      const dir=to.clone().sub(from); if(dir.lengthSq()<1e-6)return; dir.normalize();
      const g=new THREE.Group();
      const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.5,5),new THREE.MeshBasicMaterial({color:0xe8d9b0})); shaft.rotation.x=Math.PI/2; g.add(shaft);
      const tip=new THREE.Mesh(new THREE.ConeGeometry(.04,.12,6),new THREE.MeshBasicMaterial({color:0x2c2318})); tip.rotation.x=Math.PI/2; tip.position.z=.28; g.add(tip);
      const fl=new THREE.Mesh(new THREE.PlaneGeometry(.11,.11),new THREE.MeshBasicMaterial({color:0xb85a3a,side:THREE.DoubleSide})); fl.position.z=-.22; g.add(fl);
      g.position.copy(to).addScaledVector(dir,-.14);
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir);
      worldK.add(g); kyudo.stuck.push(g);
    }

    function start(){
      if(APP.map!=="kamakura"||APP.mode!=="walk"||!worldK.visible)return;
      if((window.KAMAKURA_GAMES&&window.KAMAKURA_GAMES.state.active)||(window.KENKO_HERMITAGE&&window.KENKO_HERMITAGE.active)||(window.KAMAKURA_CUSTOMS&&window.KAMAKURA_CUSTOMS.state.active))return;
      if(kyudo.savedView===null)kyudo.savedView=APP.view;
      kyudo.generation++;clearTimeout(kyudo.resultTimer);kyudo.resultTimer=null;kyudo.resultOpen=false;closeModal();APP.view="fp";
      kyudo.active=true; kyudo.fired=0; kyudo.landed=0; kyudo.score=0; kyudo.cd=0;
      clearStuck();
      player.pos.x=kyudo.stance.x; player.pos.z=kyudo.stance.z; player.yaw=0; player.pitch=-0.02;
      player.pos.y=groundH(player.pos.x,player.pos.z)+1.62;
      camera.position.copy(player.pos);camera.lookAt(player.pos.x,player.pos.y-.13,18);camera.updateMatrixWorld(true);worldK.updateMatrixWorld(true);
      if(typeof dummyCam!=="undefined"&&dummyCam){dummyCam.position.copy(camera.position);dummyCam.quaternion.copy(camera.quaternion);}
      toast("弓の稽古。画面タップで射る。振り向けば馬場の的も。Escで中断",4200);
    }
    function restoreView(){if(kyudo.savedView!==null){APP.view=kyudo.savedView;kyudo.savedView=null;}}
    function validSession(token){return token===kyudo.generation&&kyudo.active&&APP.map==="kamakura"&&APP.mode==="walk"&&worldK.visible;}
    function stop(silent){
      const hadSession=kyudo.active||kyudo.resultTimer!==null||kyudo.resultOpen;
      kyudo.generation++;clearTimeout(kyudo.resultTimer);kyudo.resultTimer=null;kyudo.active=false;kyudo.resultOpen=false;restoreView();
      if(hadSession){closeModal();clearStuck();if(!silent)toast("弓の稽古を切り上げた",1600);}
    }
    function confirmStart(){
      modal({title:"的場・射座",body:"射座に立った。<br>弓の稽古を始めますか？",actions:[
        {label:"始める",primary:true,on:()=>{ closeModal(); start(); }},
        {label:"やめる",on:()=>closeModal()}
      ]});
    }
    function result(token){
      if(!validSession(token))return;
      kyudo.resultTimer=null;kyudo.active=false;kyudo.resultOpen=true;restoreView();
      let best=parseInt(localStorage.getItem("kamakura-kyudo-best")||"0",10); if(!(best>=0))best=0;
      const isNew=kyudo.score>best; if(isNew){ best=kyudo.score; try{ localStorage.setItem("kamakura-kyudo-best",String(best)); }catch(_e){} }
      const rating=kyudo.score>=16?"見事":kyudo.score>=9?"なかなか":"まだまだ";
      const phrase=kyudo.score>=16?"百発百中とは言わぬが、見事な腕前。":kyudo.score>=9?"なかなかの手練れ。稽古を続けよ。":"弓は毎日の稽古がものを言う。また挑もう。";
      modal({title:"弓稽古 結果",
        body:"得点 <b style='color:#e6d9b0'>"+kyudo.score+"</b> / 20　（10射）<br>評: <b style='color:#8fb0d2'>"+rating+"</b><br>"+phrase+"<br><br>自己ベスト "+best+" 点"+(isNew?"　<b style='color:#c06a3a'>（自己ベスト更新!）</b>":""),
        actions:[
          {label:"もう一度",primary:true,on:()=>{ closeModal(); start(); }},
          {label:"やめる",on:()=>{ closeModal(); stop(); }}
        ]});
    }
    function land(token,pts,from,to,stuck){
      if(!validSession(token))return;
      if(stuck){ seArrowHit(); addStuck(from,to); }
      kyudo.score+=pts; kyudo.landed++;
      toast((pts===2?"中心! +2":pts===1?"的中 +1":"外れ…")+"　(計 "+kyudo.score+"点 / "+kyudo.landed+"射)",1500);
      if(kyudo.landed>=10){clearTimeout(kyudo.resultTimer);kyudo.resultTimer=setTimeout(()=>result(token),650);}
    }
    function shoot(sx,sy){
      const token=kyudo.generation;if(!validSession(token))return; const now=performance.now();
      if(kyudo.fired>=10)return; if(now<(kyudo.cd||0))return; kyudo.cd=now+260;
      if(!Number.isFinite(sx))sx=innerWidth/2;if(!Number.isFinite(sy))sy=innerHeight/2;
      camera.updateMatrixWorld(true);worldK.updateMatrixWorld(true);
      raycaster.setFromCamera({x:sx/innerWidth*2-1,y:-(sy/innerHeight)*2+1},camera);
      const meshes=kyudo.targets.map(t=>t.m);
      const hits=raycaster.intersectObjects(meshes,false);
      let to,pts=0,stuck=false;
      if(hits.length){ const hit=hits[0]; to=hit.point.clone();
        const tt=kyudo.targets.find(t=>t.m===hit.object);
        const c=hit.object.getWorldPosition(new THREE.Vector3()); const d=to.distanceTo(c);
        pts=(tt&&d<tt.r*0.34)?2:1; stuck=true; }
      else { to=raycaster.ray.at(30,new THREE.Vector3()); }
      const from=camera.position.clone().add(raycaster.ray.direction.clone().multiplyScalar(.6));
      kyudo.fired++; seArrowShot();
      spawnArrow(from,to,()=>land(token,pts,from,to,stuck));
    }
    K.kyudoStart=start; // Wave3-②(郎党「弓稽古の話を聞く」)から呼ぶ
    K.kyudoShoot=shoot;K.kyudoStop=stop;

    /* pick相乗り(function宣言＝本ガード内で再代入可。射座と稽古中の射撃のみ横取りし他は元pickへ委譲) */
    const kamaExtra=[]; if(K.kyudoSeat)kamaExtra.push(K.kyudoSeat);
    K.kamaExtra=kamaExtra; // Wave3-②で郎党メッシュ等を追加
    const _pick=pick;
    pick=function(sx,sy){
      if(kyudo.active){ shoot(sx,sy); return; }
      raycaster.setFromCamera({x:sx/innerWidth*2-1,y:-(sy/innerHeight)*2+1},camera);
      /* 射座は地面のマット＝真下を見た時だけ当たる専用レイキャストで先取り(図鑑の的/畳に隠れない) */
      if(K.kyudoSeat){ const sh=raycaster.intersectObject(K.kyudoSeat,false);
        if(sh.length&&sh[0].distance<=14){ confirmStart(); return; } }
      /* その他の相互作用: rayTargets＋kamaExtra(郎党等)を1回で判定し、専用分岐か元pickへ委譲 */
      const hits=raycaster.intersectObjects(rayTargets.concat(kamaExtra),true);
      let hit=null; for(const hh of hits){ if(isObjVisible(hh.object)){ hit=hh; break; } }
      /* KAMA_PICK_HOOK: Wave3-②(馬の世話・郎党クイズ)分岐 */
      if(hit&&typeof K.pickHook==="function"&&K.pickHook(hit))return;
      return _pick(sx,sy);
    };

    /* animate相乗り(function宣言を再代入。稽古中の移動固定＋矢の飛翔更新＋射座近接ヒント) */
    const _animate=animate;
    animate=function(now){ _animate(now); if(window.KENKO_HERMITAGE&&window.KENKO_HERMITAGE.active){if(kyudo.active)stop(true);return;} try{ kamaFrame(now); }catch(_e){} };
    function kamaFrame(now){
      if(kyudo.active&&!validSession(kyudo.generation))stop(true);
      if(kyudo.active){ player.pos.x=kyudo.stance.x; player.pos.z=kyudo.stance.z; }
      if(taijiArrows.length)updateTaijiFx(performance.now());
      if(!kyudo.active&&APP.mode==="walk"&&!K._seatHinted&&K.kyudoSeat){
        const dx=player.pos.x-20,dz=player.pos.z-24.5;
        if(dx*dx+dz*dz<9){ K._seatHinted=true; toast("射座だ。タップすると弓の稽古を始められる",3000); }
      }
      if(typeof K.frameHook==="function")K.frameHook(now); // Wave3-②(馬の頭アニメ)
    }

    /* 自前Escハンドラ(capture=coreのEscより先に処理。稽古中/本マップのモーダル表示中のみ作用) */
    addEventListener("keydown",function(e){
      if(e.key!=="Escape")return;
      if(kyudo.active){ stop(); e.preventDefault(); e.stopImmediatePropagation(); return; }
      if(_modalEl){ closeModal(); e.preventDefault(); e.stopImmediatePropagation(); return; }
    },true);
  })();

  /* ---- 21. 厩の馬の世話・クイズ導線・図鑑見出し等の磨き込み(計画§6, Wave3-②) ----
     ①の kamaPlay が公開した K.modal / K.kyudoStart / K.pickHook / K.frameHook / K.kamaExtra を用いる。
     pick/animate は①で一度だけラップ済み。ここではフックへ差し込むのみ(二重ラップ回避)。平安側は非実行=無影響。 */
  (function kamaCarePolish(){

    /* (C-2) 図鑑パネル見出しを鎌倉仕様へ(静的DOM。setCodexTabは見出しを書き換えないため一度で足りる) */
    (function(){
      const ct=document.getElementById("codexTitle"); if(ct)ct.textContent="武家ものしり図鑑";
      const bc=document.getElementById("btnCodex");
      if(bc){ for(const node of bc.childNodes){ if(node.nodeType===3&&node.textContent.indexOf("平安ものしり図鑑")>=0){ node.textContent=node.textContent.replace("平安ものしり図鑑","武家ものしり図鑑"); } } }
    })();

    /* (C-3) showInfoラップ: cat"k"(武家)はカテゴリチップが空になるため、呼出後に「武家」を注入 */
    const _showInfo=showInfo;
    showInfo=function(id){ const r=_showInfo(id);
      try{ const it=ITEMS[id]; if(it&&it.cat==="k"){ const el=document.getElementById("infoCat"); if(el){ el.textContent="武家"; el.className="info-cat b"; } } }catch(_e){}
      return r; };

    /* (B) 馬の世話。頷きアニメは K.frameHook(①のanimate相乗り)で駆動。3回で「慣れた」フラグ保存 */
    let umaCare=0; let nareta=(localStorage.getItem("kamakura-uma-nareta")==="1");
    function doCare(kind){
      const head=K.uma&&K.uma.userData?K.uma.userData.head:null;
      if(head)K.umaNod={head:head,t0:performance.now(),dur:600,dy:kind==="feed"?0.46:0.22,dz:kind==="feed"?0.28:0.10};
      toast(kind==="feed"?"馬は飼葉に鼻を寄せた":"馬は目を細めた",1800);
      if(typeof beep==="function")beep(430,.07,"sine",.05);
      umaCare++;
      if(umaCare>=3&&!nareta){ nareta=true; try{ localStorage.setItem("kamakura-uma-nareta","1"); }catch(_e){}
        setTimeout(()=>toast("馬があなたに慣れてきた（いつか馬に乗れる日が来るかもしれない）",4200),900); }
    }
    K.frameHook=function(now){
      const n=K.umaNod; if(!n||!n.head)return;
      const u=(now-n.t0)/n.dur;
      if(u>=1){ n.head.position.set(0,0,0); K.umaNod=null; return; }
      const s=Math.sin(u*Math.PI);
      n.head.position.y=-n.dy*s; n.head.position.z=n.dz*s;
    };
    function openCarePanel(){
      K.modal({title:"厩の馬",body:"鹿毛の馬が、あなたをじっと見ている。",actions:[
        {label:"なでる",primary:true,on:()=>{ K.closeModal(); doCare("pet"); }},
        {label:"飼葉をやる",on:()=>{ K.closeModal(); doCare("feed"); }},
        {label:"図鑑を見る",on:()=>{ K.closeModal(); showInfo("uma"); }}
      ]});
    }

    /* (C-1) 稽古の郎党クイズ導線。「名を当ててみよ」→Wave2ゲート許可済みのクイズ開始(goAchievementTarget("quiz")相当) */
    function startKamaQuiz(){
      if(typeof initAudio==="function")initAudio();
      APP.quizTA=false; APP.quizDiff="easy";
      enterMode("quiz");
      const pk=document.getElementById("quizDiffPicker"); if(pk)pk.style.display="none";
      if(typeof startQuiz==="function")startQuiz();
    }
    function openArcherPanel(){
      K.modal({title:"稽古の郎党",body:"弓を構えた郎党が、あなたに気づいた。",actions:[
        {label:"名を当ててみよ（名称当てクイズ）",primary:true,on:()=>{ K.closeModal(); startKamaQuiz(); }},
        {label:"弓稽古の話を聞く",on:()=>{ K.closeModal(); if(typeof beep==="function")beep(600,.06);
          toast("「弓馬の道こそ武士の本分。あの射座に立てば、稽古を始められる」",4200);
          if(K.kyudoStart)K.kyudoStart(); }}
      ]});
    }

    /* 稽古の郎党メッシュを pick 判定対象(kamaExtra)へ追加し、グループにマーク */
    if(K.archer&&K.kamaExtra){ K.archer.userData.kamaArcher=true; K.archer.traverse(o=>{ if(o.isMesh)K.kamaExtra.push(o); }); }

    /* ①の pick 相乗りへ分岐を差し込む(郎党→クイズ選択 / 馬→世話panel)。他は元pickへ委譲 */
    K.pickHook=function(hit){
      let o=hit.object; while(o&&o!==scene){ if(o.userData&&o.userData.kamaArcher){ openArcherPanel(); return true; } o=o.parent; }
      if(APP.mode==="walk"&&worldK.visible&&hit.object.userData&&hit.object.userData.iid==="kakite_k"){
        const actions=[];
        if(window.KAMAKURA_CUSTOMS&&typeof window.KAMAKURA_CUSTOMS.open==="function")actions.push({label:"書付を照合する",primary:true,on:()=>{K.closeModal();window.KAMAKURA_CUSTOMS.open(true);}});
        actions.push({label:"この人の仕事を見る",on:()=>{K.closeModal();showInfo("kakite_k");}},{label:"戻る",on:()=>K.closeModal()});
        K.modal({title:"書付を扱う人",body:"「紙に記したことと、持参した控えを確かめましょう。」<br>人物と照合の内容は、この館のために作ったものです。",actions});return true;
      }
      if(hit.object.userData&&hit.object.userData.iid==="uma"){ openCarePanel(); return true; }
      return false;
    };
  })();
  // 別モジュールが人物/用具に体験を結ぶための小さな公開面。保存/移動/イベントをここでは追加しない。
  window.KAMAKURA_WORLD={K,world:worldK,anchors:kLifeAnchors,contentIds:K.contentEntries.map(e=>e[0])};
}
