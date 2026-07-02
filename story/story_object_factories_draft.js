/*
 * ストーリーモード用 Three.js オブジェクトファクトリ（ドラフト）
 * 対象: 寝殿造り3D探訪_統合版.html（Three.js r128 / スマホ優先 / 低ポリ和風）
 *
 * ■ このファイルはまだ本体HTMLに読み込まない（Codex依頼書の通り）。
 * ■ 統合時の作法:
 *   - ここでは自前の素材(mat)を使うが、本体統合時は heianTextile()/MAT.* に差し替えられるよう
 *     すべて STORY_MATS 経由で参照している。STORY_MATS を上書きすれば衣装が本体品質になる。
 *   - 人物は本体の makeHeianFigure 派生(SAIGEN_CHARS)に置き換えてもよい。その場合も
 *     各 api(表情・冠・影・扇文字)はアタッチ部品として流用できる構造にしてある。
 *   - すべて Group/Mesh/基本ジオメトリのみ。SkinnedMesh・重いパーティクル・テクスチャ画像なし。
 *     文字はCanvasTexture(小さめ)で描く。生成は章頭のみ、毎フレームは update(t) の軽い揺れだけ。
 *   - r128準拠: tex.encoding=THREE.sRGBEncoding / material.emissive を使用。colorSpaceは使わない。
 *
 * ■ 公開API: window.StoryObjects.{create...} / STORY_CAMERA_ANGLES / disposeGroup / makePool
 */
(function(global){
  "use strict";
  if(typeof THREE==="undefined"){console.warn("[StoryObjects] THREE not loaded");return;}

  /* ============ 素材(統合時は heianTextile/MAT.* に差し替え) ============ */
  function M(o){return new THREE.MeshStandardMaterial(o);}
  const STORY_MATS={
    skin:      M({color:0xf0d5bd,roughness:.72}),
    hair:      M({color:0x0a0a0c,roughness:.5,metalness:.04}),
    // 小萩: 萩色(紫がかった紅)の袿に薄紫の単衣
    kohagiOuter:M({color:0x8a4a68,roughness:.8}),
    kohagiMid:  M({color:0xb07a92,roughness:.82}),
    kohagiInner:M({color:0xcabce0,roughness:.85}),
    murasakiCord:M({color:0xb9a5e6,roughness:.55,emissive:0x30245c,emissiveIntensity:.25}), // 薄紫の紐(小萩/栞/True短冊 共通)
    // 秀頼: 若い男の縹(はなだ)の直衣。少し明るすぎる=場に馴染んでいない色
    hidetoraNoshi:M({color:0x4a6fa8,roughness:.78}),
    hidetoraSashinuki:M({color:0x39496b,roughness:.85}),
    // 右近: 侍の麻色
    ukonRobe:  M({color:0x55633f,roughness:.85}),
    ukonUnder: M({color:0x3a4a30,roughness:.85}),
    // 左大臣: 濃紫の袍
    ministerRobe:M({color:0x432a66,roughness:.75}),
    // 判者: 鈍色(にびいろ)の落ち着いた袍
    judgeRobe: M({color:0x4c4a55,roughness:.8}),
    gold:      M({color:0xc9a23f,roughness:.5,metalness:.35}),
    black:     M({color:0x17130f,roughness:.7}),
    wood:      M({color:0x6b4a2c,roughness:.85}),
    woodDark:  M({color:0x4a3722,roughness:.8}),
    paper:     M({color:0xf2ead6,roughness:.92}),
    ink:       M({color:0x2a201a,roughness:.85}),
    ofuda:     M({color:0xe9e0c4,roughness:.9,emissive:0x8a6a20,emissiveIntensity:.12}),
    oniSkin:   M({color:0x7c1f1a,roughness:.68}),
    oniDark:   M({color:0x3a0f0e,roughness:.75}),
    shadowFlat:new THREE.MeshBasicMaterial({color:0x05030a,transparent:true,opacity:.55,depthWrite:false}),
    ghostUniform:new THREE.MeshBasicMaterial({color:0xcfd8ea,transparent:true,opacity:0,depthWrite:false}), // 栞の制服シルエット
    misu:      M({color:0x8a7d52,roughness:.9,transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false}),
    fog:       new THREE.MeshBasicMaterial({color:0xaebedd,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false})
  };

  /* ============ 汎用ヘルパー ============ */
  function box(w,h,d,mat,x=0,y=0,z=0,shadow=true){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=shadow;return m;}
  function cyl(rt,rb,h,mat,x=0,y=0,z=0,seg=10){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;}
  function sph(r,mat,x=0,y=0,z=0,w=8,h=6){const m=new THREE.Mesh(new THREE.SphereGeometry(r,w,h),mat);m.position.set(x,y,z);m.castShadow=true;return m;}
  function plane(w,h,mat,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);m.position.set(x,y,z);return m;}
  function noShadow(o){o.castShadow=false;o.receiveShadow=false;return o;}

  /* 縦書き/横書きテキストのCanvasTexture(小さく生成し、にじみ防止に2x) */
  function textTexture(text,opt={}){
    const vertical=opt.vertical!==false, W=opt.w||96, H=opt.h||256, fs=opt.fontSize||44;
    const c=document.createElement("canvas");c.width=W*2;c.height=H*2;
    const x=c.getContext("2d");x.scale(2,2);
    x.fillStyle=opt.bg||"rgba(0,0,0,0)";x.fillRect(0,0,W,H);
    x.fillStyle=opt.color||"#2a201a";
    x.font=(opt.bold?"700 ":"")+fs+"px 'Hiragino Mincho ProN','Yu Mincho',serif";
    x.textAlign="center";x.textBaseline="middle";
    const chars=String(text).split("");
    if(vertical){const total=chars.length*fs*1.12,y0=H/2-total/2+fs*.62;
      chars.forEach((ch,i)=>x.fillText(ch,W/2,y0+i*fs*1.12));}
    else x.fillText(String(text),W/2,H/2);
    const tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;tex.anisotropy=2;
    return tex;
  }

  /* グループ配下のgeometry/material/textureを破棄(章の出入りでのリーク防止) */
  function disposeGroup(g){
    if(!g)return;
    g.traverse(o=>{
      if(o.isMesh){
        if(o.geometry)o.geometry.dispose();
        const mats=Array.isArray(o.material)?o.material:[o.material];
        mats.forEach(m=>{if(!m)return;if(m.map&&m.map.dispose)m.map.dispose();if(m.__ownedByStory&&m.dispose)m.dispose();});
      }
    });
    if(g.parent)g.parent.remove(g);
  }

  /* 簡易オブジェクトプール(短冊・札など生成破棄を繰り返すもの用) */
  function makePool(factory){
    const free=[];
    return {
      get(...a){const o=free.pop()||factory(...a);o.visible=true;return o;},
      put(o){if(!o)return;o.visible=false;free.push(o);},
      drain(){while(free.length)disposeGroup(free.pop());}
    };
  }

  /* ============================================================
     A-0. 人物共通の土台
     本体の makeHeianFigure と同じ「座位の量感」を primitives で再現。
     standing=true で立位(裾を伸ばし、脚部を作る)。
  ============================================================ */
  function baseFigure({outer,mid,inner,scale=1,standing=false,female=true}){
    const g=new THREE.Group();
    if(standing){
      g.add(cyl(.24,.40,.92,mid,0,.48,0,12));                  // 袴・裾
      g.add(cyl(.25,.335,.72,outer,0,1.16,0,12));              // 胴(袍)
      [-1,1].forEach(s=>{g.add(cyl(.07,.09,.46,mid,s*.13,.20,.01,8));
        g.add(box(.16,.08,.27,STORY_MATS.black,s*.13,.045,.07));});
    }else{
      g.add(cyl(.30,.52,.60,outer,0,.30,0,14));                // 打袴の裾ぐるみ(座位)
      g.add(cyl(.26,.36,.62,mid,0,.78,0,12));                  // 重ね
      g.add(cyl(.235,.315,.60,outer,0,1.10,0,12));             // 上体
    }
    const neckY=standing?1.55:1.42;
    [-1,1].forEach(s=>{
      g.add(sph(.115,outer,s*.245,neckY-.13,.01));             // 肩
      const arm=cyl(.065,.09,.50,inner,s*.30,neckY-.34,.06,8);arm.rotation.z=s*.17;g.add(arm);
      g.add(sph(.052,STORY_MATS.skin,s*.35,neckY-.60,.12,8,6));// 手
      const cuff=cyl(.10,.13,.10,inner,s*.335,neckY-.545,.10,8);cuff.rotation.z=s*.2;g.add(cuff); // 袖口の重ね色
    });
    const head=sph(.155,STORY_MATS.skin,0,neckY+.17,.01,10,8);head.scale.set(.95,1.12,.92);g.add(head);
    g.userData.head=head;g.userData.neckY=neckY;
    if(female){
      const cap=sph(.163,STORY_MATS.hair,0,neckY+.245,-.015,10,8);cap.scale.set(1,.82,1);g.add(cap);
      g.add(box(.25,standing?1.15:.85,.07,STORY_MATS.hair,0,neckY-.28,-.135));   // 垂髪
      [-1,1].forEach(s=>g.add(box(.05,.34,.05,STORY_MATS.hair,s*.13,neckY+.02,.10))); // 鬢そぎ
    }else{
      const cap=sph(.160,STORY_MATS.hair,0,neckY+.235,-.01,10,8);cap.scale.set(1,.72,1);g.add(cap);
    }
    // 顔(目・眉・口は差し替え可能な独立メッシュにしておく=表情API用)
    const face={};
    const mkEye=(s,shape)=>{const e=noShadow(box(shape==="smile"?.040:.036,shape==="stern"?.006:.010,.006,STORY_MATS.ink,s*.055,neckY+.185,.148));return e;};
    [-1,1].forEach(s=>{
      face["eye"+(s<0?"L":"R")]=mkEye(s);g.add(face["eye"+(s<0?"L":"R")]);
      const brow=noShadow(box(.052,.008,.006,STORY_MATS.ink,s*.056,neckY+.235,.143));brow.rotation.z=s*.06;g.add(brow);
      face["brow"+(s<0?"L":"R")]=brow;
    });
    const nose=noShadow(new THREE.Mesh(new THREE.ConeGeometry(.013,.05,6),STORY_MATS.skin));
    nose.position.set(0,neckY+.155,.160);nose.rotation.x=Math.PI/2;g.add(nose);
    const mouth=noShadow(box(.05,.008,.006,new THREE.MeshBasicMaterial({color:0x8a4038}),0,neckY+.108,.152));g.add(mouth);
    face.mouth=mouth;g.userData.face=face;
    g.scale.setScalar(scale);
    return g;
  }
  /* 表情API: 目の細さ・眉の角度・口の形だけで喜/静/厳/哀を出す(低負荷) */
  function makeExpressionApi(g){
    const f=g.userData.face,ny=g.userData.neckY;
    return function setExpression(name){
      const L=f.eyeL,R=f.eyeR,bl=f.browL,br=f.browR,m=f.mouth;
      if(!L)return;
      if(name==="smile"){L.scale.set(1,.55,1);R.scale.set(1,.55,1);L.rotation.z=.18;R.rotation.z=-.18;bl.rotation.z=-.10;br.rotation.z=.10;m.scale.set(1.15,1,1);m.position.y=ny+.112;}
      else if(name==="stern"){L.scale.set(1,.7,1);R.scale.set(1,.7,1);L.rotation.z=-.14;R.rotation.z=.14;bl.rotation.z=.16;br.rotation.z=-.16;m.scale.set(.8,1,1);m.position.y=ny+.104;}
      else if(name==="sad"){L.scale.set(1,.6,1);R.scale.set(1,.6,1);L.rotation.z=.10;R.rotation.z=-.10;bl.rotation.z=-.18;br.rotation.z=.18;m.scale.set(.85,1,1);m.position.y=ny+.102;}
      else if(name==="surprise"){L.scale.set(1,1.6,1);R.scale.set(1,1.6,1);L.rotation.z=0;R.rotation.z=0;bl.position.y=ny+.25;br.position.y=ny+.25;m.scale.set(.7,1.6,1);}
      else{L.scale.set(1,1,1);R.scale.set(1,1,1);L.rotation.z=0;R.rotation.z=0;bl.rotation.z=.06;br.rotation.z=-.06;m.scale.set(1,1,1);m.position.y=ny+.108;}
    };
  }

  /* ============================================================
     A-1. 小萩 — 若い女房。薄紫の紐飾り(栞との接続)を袖に必ず付ける。
     api: setExpression / setShioriGhost(0..1) / setFan(deg) / update(t)
  ============================================================ */
  function createStoryKohagiObject(){
    const g=baseFigure({outer:STORY_MATS.kohagiOuter,mid:STORY_MATS.kohagiMid,inner:STORY_MATS.kohagiInner,female:true});
    const ny=g.userData.neckY;
    // 薄紫の紐飾り: 右袖口に結び、二本の垂れと小さな結び玉
    const cord=new THREE.Group();
    cord.add(sph(.030,STORY_MATS.murasakiCord,0,0,0,8,6));
    const t1=cyl(.008,.008,.16,STORY_MATS.murasakiCord,-.015,-.09,0,6);t1.rotation.z=.18;cord.add(t1);
    const t2=cyl(.008,.008,.13,STORY_MATS.murasakiCord,.018,-.075,0,6);t2.rotation.z=-.14;cord.add(t2);
    cord.position.set(.345,ny-.52,.13);g.add(cord);g.userData.cord=cord;
    // 檜扇(表情差分の一部: 口元を隠す角度を変えられる)
    const fan=new THREE.Group();
    for(let i=0;i<6;i++){const blade=box(.028,.20,.006,i%2?STORY_MATS.paper:STORY_MATS.kohagiInner,0,.10,0,false);
      blade.rotation.z=(i-2.5)*.16;blade.position.x=(i-2.5)*.016;fan.add(noShadow(blade));}
    fan.position.set(-.30,ny-.42,.16);fan.rotation.z=.35;g.add(fan);g.userData.fan=fan;
    // 栞の制服シルエット(半透明・通常opacity0)。小萩の輪郭に重なる簡素な形。
    const ghostMat=STORY_MATS.ghostUniform.clone();ghostMat.__ownedByStory=true;
    const ghost=new THREE.Group();
    ghost.add(noShadow(cyl(.26,.30,.62,ghostMat,0,.55,0,10)));           // スカート
    ghost.add(noShadow(cyl(.24,.28,.55,ghostMat,0,1.12,0,10)));          // 上衣
    ghost.add(noShadow(box(.34,.16,.02,ghostMat,0,1.36,.14)));           // セーラー襟
    ghost.add(noShadow(sph(.15,ghostMat,0,ny+.17,.01,8,6)));             // 頭
    ghost.add(noShadow(box(.05,.30,.03,ghostMat,.20,1.0,.05)));          // 提げ鞄の帯
    ghost.visible=false;g.add(ghost);
    const api={
      group:g,
      setExpression:makeExpressionApi(g),
      /* 0=小萩のみ / 1=栞が強く透ける。0.15以上でghost表示 */
      setShioriGhost(v){const o=Math.max(0,Math.min(1,v));ghost.visible=o>0.15;ghostMat.opacity=o*.5;
        STORY_MATS.murasakiCord.emissiveIntensity=.25+o*.6;},
      setFan(cover){ // 0=下げる / 1=口元まで上げる
        fan.position.y=ny-.42+cover*.30;fan.position.x=-.30+cover*.13;fan.rotation.z=.35+cover*.55;},
      update(t){g.position.y=(g.userData.baseY||0)+Math.sin(t*1.05)*.012; // 呼吸
        cord.rotation.z=Math.sin(t*1.6)*.12;}                             // 紐が風に揺れる
    };
    g.userData.api=api;return api;
  }

  /* ============================================================
     A-2. 秀頼 — 平安装束を着せられた現代高校生。
     冠が「ずれている」ことが違和感と成長の記号。
     api: setCrownState("tilted"|"straight"|"deep") / setExpression / update
  ============================================================ */
  function createStoryHidetoraObject(){
    const g=baseFigure({outer:STORY_MATS.hidetoraNoshi,mid:STORY_MATS.hidetoraSashinuki,inner:STORY_MATS.hidetoraNoshi,female:false,standing:true});
    const ny=g.userData.neckY;
    // 冠(纓つき)。ピボットで傾け/深被りを切替
    const crown=new THREE.Group();
    crown.add(cyl(.085,.105,.14,STORY_MATS.black,0,.07,0,10));
    crown.add(box(.03,.16,.012,STORY_MATS.black,0,.20,-.03));  // 巾子
    const ei=box(.026,.22,.008,STORY_MATS.black,0,.10,-.10);ei.rotation.x=.75;crown.add(ei); // 纓
    crown.position.set(0,ny+.30,0);g.add(crown);
    // 現代の名残: 左手首に腕時計(袖口の奥、注視しないと見えない大きさ)
    const watch=new THREE.Group();
    watch.add(cyl(.020,.020,.016,new THREE.MeshBasicMaterial({color:0x222831}),0,0,0,10));
    watch.add(noShadow(cyl(.012,.012,.018,new THREE.MeshBasicMaterial({color:0xd8e2f0}),0,.001,0,8)));
    watch.rotation.z=Math.PI/2;watch.position.set(.352,ny-.575,.115);g.add(watch);
    // 沓の代わりに白い靴下風(僅かな現代感)
    g.children.forEach(o=>{if(o.geometry&&o.geometry.type==="BoxGeometry"&&o.position.y<.06)o.material=M({color:0xdfe3e8,roughness:.9});});
    const api={
      group:g,
      setExpression:makeExpressionApi(g),
      setCrownState(state){
        if(state==="straight"){crown.rotation.set(0,0,0);crown.position.y=ny+.30;}
        else if(state==="deep"){crown.rotation.set(.14,0,0);crown.position.y=ny+.265;} // ED4: 自ら深く被る
        else {crown.rotation.set(.06,0,-.18);crown.position.y=ny+.295;}                 // 序盤: ずれ
      },
      update(t){g.position.y=(g.userData.baseY||0)+Math.sin(t*1.15+1.3)*.010;}
    };
    api.setCrownState("tilted");
    g.userData.api=api;return api;
  }

  /* ============================================================
     A-3. 右近 — 軽口の随身。立位、弓・矢筒・太刀。
     api: setPose("ease"|"alert") / update
  ============================================================ */
  function createStoryUkonObject(){
    const g=baseFigure({outer:STORY_MATS.ukonRobe,mid:STORY_MATS.ukonUnder,inner:STORY_MATS.ukonUnder,female:false,standing:true});
    const ny=g.userData.neckY;
    g.add(cyl(.088,.108,.13,STORY_MATS.black,0,ny+.30,0,10)); // 折烏帽子(簡易)
    // 弓(背負い)
    const bow=new THREE.Group();
    const arc=cyl(.012,.012,1.35,STORY_MATS.wood,0,0,0,6);arc.rotation.z=.06;bow.add(arc);
    bow.add(noShadow(box(.004,1.28,.004,STORY_MATS.black,-.035,0,0)));
    bow.rotation.z=.28;bow.position.set(-.16,1.10,-.16);g.add(bow);
    // 矢筒(靫)と矢羽
    const quiver=new THREE.Group();
    quiver.add(cyl(.055,.065,.42,STORY_MATS.woodDark,0,0,0,8));
    for(let i=0;i<3;i++){const a=cyl(.006,.006,.30,STORY_MATS.wood,(i-1)*.028,.30,0,5);quiver.add(a);
      quiver.add(noShadow(box(.03,.05,.008,M({color:0xd8d2c2,roughness:.9}),(i-1)*.028,.44,0)));}
    quiver.rotation.z=-.20;quiver.position.set(.17,1.15,-.17);g.add(quiver);
    // 簡易太刀(腰)
    const tachi=box(.06,.62,.035,STORY_MATS.woodDark,-.24,.86,.02);tachi.rotation.z=-.28;g.add(tachi);
    g.add(box(.05,.10,.045,STORY_MATS.gold,-.115,1.075,.02));
    const api={
      group:g,setExpression:makeExpressionApi(g),
      setPose(p){g.rotation.x=p==="alert"?-.03:0;g.userData._sway=p==="alert"?.004:.012;},
      update(t){g.position.y=(g.userData.baseY||0)+Math.sin(t*1.3+2.1)*(g.userData._sway||.012);
        g.rotation.z=Math.sin(t*.9+1)*.015;}
    };
    api.setExpression("smile");api.setPose("ease");
    g.userData.api=api;return api;
  }

  /* ============================================================
     A-4. 左大臣 — 威厳とコミカルさ。第5話で影が伸び大鬼に接続。
     api: setShadowReach(0..1) / setPossessed(bool) / update
  ============================================================ */
  function createMinisterObject(){
    const g=baseFigure({outer:STORY_MATS.ministerRobe,mid:STORY_MATS.ministerRobe,inner:STORY_MATS.gold,female:false});
    g.scale.setScalar(1.18);
    const ny=g.userData.neckY;
    g.add(cyl(.09,.11,.15,STORY_MATS.black,0,ny+.30,0,10));
    const ei=box(.028,.24,.008,STORY_MATS.black,0,ny+.40,-.09);ei.rotation.x=.85;g.add(ei);
    const shaku=box(.045,.30,.014,M({color:0xe7ddc4,roughness:.8}),.30,ny-.42,.17);shaku.rotation.z=-.12;g.add(shaku);
    // ひげ(コミカルさの記号)
    g.add(noShadow(box(.10,.016,.008,STORY_MATS.ink,0,ny+.085,.150)));
    // 背後の影メッシュ(床に伸びる)。setShadowReachで長さ/濃さが変わり、大鬼の輪郭が滲む
    const shMat=STORY_MATS.shadowFlat.clone();shMat.__ownedByStory=true;shMat.opacity=0;
    const shadow=new THREE.Group();
    const body=plane(1.0,2.2,shMat,0,0,-1.4);body.rotation.x=-Math.PI/2;shadow.add(noShadow(body));
    const hornL=plane(.16,.5,shMat,-.28,.001,-2.35);hornL.rotation.x=-Math.PI/2;hornL.rotation.z=.3;shadow.add(noShadow(hornL));
    const hornR=plane(.16,.5,shMat,.28,.001,-2.35);hornR.rotation.x=-Math.PI/2;hornR.rotation.z=-.3;shadow.add(noShadow(hornR));
    shadow.position.y=.012;g.add(shadow);
    // 憑依時の目(赤く光る差分)
    const eyeGlowL=noShadow(sph(.016,new THREE.MeshBasicMaterial({color:0xff4030}),-.055,ny+.185,.15,6,5));
    const eyeGlowR=noShadow(sph(.016,new THREE.MeshBasicMaterial({color:0xff4030}),.055,ny+.185,.15,6,5));
    eyeGlowL.visible=eyeGlowR.visible=false;g.add(eyeGlowL);g.add(eyeGlowR);
    const api={
      group:g,setExpression:makeExpressionApi(g),
      setShadowReach(v){const o=Math.max(0,Math.min(1,v));shMat.opacity=o*.6;shadow.scale.set(1,1,1+o*2.2);},
      setPossessed(on){eyeGlowL.visible=eyeGlowR.visible=!!on;api.setExpression(on?"stern":"neutral");},
      update(t){g.position.y=(g.userData.baseY||0)+Math.sin(t*.85)*.012;}
    };
    g.userData.api=api;return api;
  }

  /* ============================================================
     A-5. 判者 — 扇で顔半分を隠す。扇面の文字を差し替え可能。
     api: setFanText("題 雪"|"勝"|"負"|"") / setFanOpen(bool) / update
  ============================================================ */
  function createUtakaiJudgeObject(){
    const g=baseFigure({outer:STORY_MATS.judgeRobe,mid:STORY_MATS.judgeRobe,inner:STORY_MATS.paper,female:false});
    const ny=g.userData.neckY;
    g.add(cyl(.088,.106,.14,STORY_MATS.black,0,ny+.295,0,10));
    // 大きめの檜扇: 開閉2状態 + 文字プレーン(CanvasTexture差し替え)
    const fan=new THREE.Group();
    const fanFace=plane(.34,.22,M({color:0xf4edd8,roughness:.9,side:THREE.DoubleSide}),0,.11,0);
    fan.add(fanFace);
    for(let i=0;i<7;i++){const rib=box(.006,.24,.004,STORY_MATS.wood,(i-3)*.052,.10,-.004,false);rib.rotation.z=(i-3)*.10;fan.add(noShadow(rib));}
    const txtMat=new THREE.MeshBasicMaterial({transparent:true,opacity:.95});txtMat.__ownedByStory=true;
    const txt=plane(.26,.17,txtMat,0,.115,.004);fan.add(noShadow(txt));txt.visible=false;
    fan.position.set(.10,ny+.02,.19);fan.rotation.z=-.10;g.add(fan);
    let curTex=null;
    const api={
      group:g,setExpression:makeExpressionApi(g),
      setFanText(s){
        if(curTex){curTex.dispose();curTex=null;}
        if(!s){txt.visible=false;return;}
        curTex=textTexture(s,{vertical:s.length<=1,w:128,h:96,fontSize:s.length<=1?64:30,color:"#7a2417",bold:true});
        txtMat.map=curTex;txtMat.needsUpdate=true;txt.visible=true;
      },
      setFanOpen(open){ // 開=顔を隠す(通常) / 閉=判定の瞬間だけ顔を出す
        fan.visible=true;fan.position.y=ny+(open?.02:-.42);fan.rotation.z=open?-.10:.65;},
      update(t){g.position.y=(g.userData.baseY||0)+Math.sin(t*.95+.6)*.010;
        fan.rotation.z+=Math.sin(t*1.4)*.0015;}
    };
    api.setFanOpen(true);
    g.userData.api=api;return api;
  }

  /* ============================================================
     B-1. 白い短冊 — カモメが落とす。表=平安の料紙 / 裏=現代ノート片。
     api: setText(str) / flipTo("heian"|"modern") / update(t)=ひらひら落下
  ============================================================ */
  function createWhiteTanzakuObject(){
    const g=new THREE.Group();
    const front=plane(.16,.55,M({color:0xf6f0dd,roughness:.92}),0,0,.002);g.add(front);
    // 裏面: ノート(青い罫線+薄紫のマージン線=栞の記号)
    const c=document.createElement("canvas");c.width=64;c.height=192;const x=c.getContext("2d");
    x.fillStyle="#f4f6f8";x.fillRect(0,0,64,192);
    x.strokeStyle="#b8c9de";x.lineWidth=1;
    for(let i=1;i<10;i++){x.beginPath();x.moveTo(6,i*19);x.lineTo(60,i*19);x.stroke();}
    x.strokeStyle="#b9a5e6";x.beginPath();x.moveTo(10,0);x.lineTo(10,192);x.stroke();
    const backTex=new THREE.CanvasTexture(c);backTex.encoding=THREE.sRGBEncoding;
    const back=plane(.16,.55,new THREE.MeshStandardMaterial({map:backTex,roughness:.92}),0,0,-.002);
    back.rotation.y=Math.PI;g.add(back);
    let inkTex=null;const inkMat=new THREE.MeshBasicMaterial({transparent:true});inkMat.__ownedByStory=true;
    const ink=plane(.13,.5,inkMat,0,0,.004);ink.visible=false;g.add(noShadow(ink));
    g.userData.fallT=0;
    const api={
      group:g,
      setText(s){if(inkTex)inkTex.dispose();
        inkTex=textTexture(s,{w:64,h:224,fontSize:15,color:"#3a3230"});
        inkMat.map=inkTex;inkMat.needsUpdate=true;ink.visible=!!s;},
      flipTo(side){g.rotation.y=(side==="modern")?Math.PI:0;},
      /* ひらひら落下(fromY→toY)。返り値true=着地 */
      updateFall(dt,toY=0.06){
        g.userData.fallT+=dt;const t=g.userData.fallT;
        if(g.position.y>toY){g.position.y-=dt*.55;
          g.rotation.z=Math.sin(t*3.1)*.6;g.rotation.x=Math.sin(t*2.3)*.35;
          g.position.x+=Math.sin(t*2.6)*dt*.35;return false;}
        g.rotation.x=-Math.PI/2;g.rotation.z*=0.9;return true;
      }
    };
    g.userData.api=api;return api;
  }

  /* ============================================================
     B-2. 用語カード — 第2話の光る札。正しい場所に置くと淡く光って消える。
     api: setPlacedTarget({x,z,r}) / tryPlace(pos)→bool / resolve() / update(t)
  ============================================================ */
  function createTermCardObject(label){
    const g=new THREE.Group();
    const bodyMat=M({color:0xefe6cc,roughness:.85,emissive:0x8a6a20,emissiveIntensity:.28});bodyMat.__ownedByStory=true;
    g.add(box(.02,.46,.15,bodyMat,0,0,0));
    const tex=textTexture(label,{w:64,h:192,fontSize:34,color:"#4a3722",bold:true});
    const txtMat=new THREE.MeshBasicMaterial({map:tex,transparent:true});txtMat.__ownedByStory=true;
    const t1=plane(.13,.42,txtMat,.012,0,0);t1.rotation.y=Math.PI/2;g.add(noShadow(t1));
    const t2=plane(.13,.42,txtMat,-.012,0,0);t2.rotation.y=-Math.PI/2;g.add(noShadow(t2));
    const ringMat=new THREE.MeshBasicMaterial({color:0xffe9a8,transparent:true,opacity:.0,depthWrite:false});ringMat.__ownedByStory=true;
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.30,.02,8,22),ringMat);ring.rotation.x=Math.PI/2;ring.position.y=-.26;g.add(noShadow(ring));
    let target=null,resolving=0;
    const api={
      group:g,label,
      setPlacedTarget(t){target=t;},
      tryPlace(pos){if(!target)return false;
        const ok=Math.hypot(pos.x-target.x,pos.z-target.z)<=(target.r||1.2);
        if(ok)api.resolve();return ok;},
      resolve(){resolving=1;},
      get resolved(){return resolving>=2;},
      update(t,dt){
        if(resolving===0){
          g.position.y=(g.userData.baseY||1.0)+Math.sin(t*1.8+(g.userData.ph||0))*.05;
          g.rotation.y=t*.6;bodyMat.emissiveIntensity=.28+Math.sin(t*2.6)*.12;
        }else if(resolving===1){ // 正置: 輪が広がり、札が淡く溶ける
          ringMat.opacity=Math.min(.8,ringMat.opacity+dt*2.2);ring.scale.multiplyScalar(1+dt*2.4);
          bodyMat.emissiveIntensity+=dt*3;g.scale.multiplyScalar(Math.max(.0,1-dt*1.6));
          if(g.scale.x<.05){g.visible=false;resolving=2;}
        }
      }
    };
    g.userData.api=api;return api;
  }

  /* ============================================================
     B-3. 和歌短冊 — 第3話。「秋」「霧」「待つ」「袖」「月」を縦書き表示。
  ============================================================ */
  function createWakaTanzakuObject(word){
    const g=new THREE.Group();
    const paperMat=M({color:0xf2e7cf,roughness:.9,emissive:0x6a5420,emissiveIntensity:.15});paperMat.__ownedByStory=true;
    g.add(box(.012,.52,.13,paperMat,0,0,0));
    g.add(box(.014,.03,.135,STORY_MATS.gold,0,.245,0)); // 天の飾り
    const tex=textTexture(word,{w:64,h:224,fontSize:38,color:"#2a201a"});
    const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true});mat.__ownedByStory=true;
    [1,-1].forEach(s=>{const p=plane(.115,.48,mat,s*.008,0,0);p.rotation.y=s*Math.PI/2;g.add(noShadow(p));});
    const api={group:g,word,
      update(t){g.position.y=(g.userData.baseY||.9)+Math.sin(t*1.5+(g.userData.ph||0))*.06;
        g.rotation.y=Math.sin(t*.8+(g.userData.ph||0))*.5;
        g.rotation.z=Math.sin(t*2.2+(g.userData.ph||0))*.08;} // 風に舞う
    };
    g.userData.api=api;return api;
  }

  /* ============================================================
     B-4. 薄紫の紐モチーフ — 小萩の袖/栞のノート/True End短冊に共通。
     単体でも置ける(結び目+二本の垂れ+房)。attachTo(parent,pos,scale)
  ============================================================ */
  function createPurpleCordMotif(){
    const g=new THREE.Group();
    g.add(sph(.035,STORY_MATS.murasakiCord,0,0,0,8,6));
    g.add(sph(.022,STORY_MATS.murasakiCord,-.045,.012,0,8,6));
    g.add(sph(.022,STORY_MATS.murasakiCord,.045,.012,0,8,6)); // 蝶結びの輪
    const s1=cyl(.009,.009,.20,STORY_MATS.murasakiCord,-.02,-.11,0,6);s1.rotation.z=.15;g.add(s1);
    const s2=cyl(.009,.009,.16,STORY_MATS.murasakiCord,.024,-.09,0,6);s2.rotation.z=-.12;g.add(s2);
    [-.02,.024].forEach((x,i)=>{const tas=cyl(.016,.020,.05,STORY_MATS.murasakiCord,x+(i?-.006:.008),i? -.19:-.235,0,6);g.add(tas);});
    const api={group:g,
      attachTo(parent,pos,scale=1){g.position.set(pos.x||0,pos.y||0,pos.z||0);g.scale.setScalar(scale);parent.add(g);},
      update(t){g.rotation.z=Math.sin(t*1.7)*.10;}
    };
    g.userData.api=api;return api;
  }

  /* ============================================================
     C-1. 御簾境界エフェクト — 「隔てる/つなぐ」を示す半透明の揺れ。
     api: setMood("veil"=隔て/"connect"=つなぎ) / update(t)
  ============================================================ */
  function createMisuBoundaryEffect(width=3.2,height=2.2){
    const g=new THREE.Group();
    const mat=STORY_MATS.misu.clone();mat.__ownedByStory=true;
    const sheet=plane(width,height,mat,0,height/2,0);g.add(noShadow(sheet));
    for(let i=0;i<=8;i++)g.add(noShadow(box(.018,height-.06,.008,STORY_MATS.woodDark,-width/2+i*(width/8),height/2,.012,false)));
    g.add(box(width+.2,.09,.10,STORY_MATS.woodDark,0,height+.05,0));
    const glowMat=new THREE.MeshBasicMaterial({color:0xffe9b0,transparent:true,opacity:0,depthWrite:false});glowMat.__ownedByStory=true;
    const glow=plane(width,.18,glowMat,0,.10,.02);g.add(noShadow(glow)); // 裾の光=「つなぐ」時だけ
    let mood="veil";
    const api={group:g,
      setMood(m){mood=m;mat.opacity=(m==="connect")?.30:.46;},
      update(t){ // 風のない揺れ。connect時は裾が呼吸するように光る
        sheet.rotation.x=Math.sin(t*.9)*.02;sheet.position.z=Math.sin(t*.7)*.012;
        glowMat.opacity=(mood==="connect")?(.22+Math.sin(t*1.6)*.14):Math.max(0,glowMat.opacity-.02);}
    };
    g.userData.api=api;return api;
  }

  /* ============================================================
     C-2. 常世グリッチ小道具 — 第5話。反転御簾・浮遊札・壊れた建具・霧リング。
     api: update(t) / setIntensity(0..1)
  ============================================================ */
  function createTokoyoGlitchProps(radius=9){
    const g=new THREE.Group();
    // 反転した御簾(天地逆に宙吊り)
    const mi=createMisuBoundaryEffect(2.6,1.8);mi.group.rotation.z=Math.PI;mi.group.position.set(-radius*.45,3.4,-radius*.3);g.add(mi.group);
    // 浮遊する札の環
    const cards=[];
    for(let i=0;i<8;i++){
      const card=box(.02,.34,.11,STORY_MATS.ofuda,0,0,0);
      card.userData.a=i*Math.PI/4;card.userData.r=radius*.55+((i%3)*.5);card.userData.h=1.2+(i%4)*.5;
      cards.push(card);g.add(card);
    }
    // 壊れた建具(格子の破片が斜めに刺さる)
    for(let i=0;i<4;i++){
      const frag=new THREE.Group();
      frag.add(box(.06,1.3-(i*.15),.06,STORY_MATS.woodDark,0,0,0));
      for(let k=0;k<3;k++)frag.add(box(.5,.022,.03,STORY_MATS.woodDark,0,-.3+k*.3,0));
      frag.position.set(Math.cos(i*1.9)*radius*.7,.4,Math.sin(i*1.9)*radius*.7);
      frag.rotation.z=.5+i*.35;frag.rotation.y=i*1.2;g.add(frag);
    }
    // 低負荷の霧リング(2枚の大きな透明リング板を逆回転)
    const rings=[];
    for(let i=0;i<2;i++){
      const rm=STORY_MATS.fog.clone();rm.__ownedByStory=true;rm.opacity=.13+i*.05;
      const ring=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,1.6+i,24,1,true),rm);
      ring.position.y=1.0+i*.7;rings.push(ring);g.add(noShadow(ring));
    }
    let inten=1;
    const api={group:g,
      setIntensity(v){inten=Math.max(0,Math.min(1,v));g.visible=inten>0.02;},
      update(t,dt){
        cards.forEach((c,i)=>{const a=c.userData.a+t*(.25+(i%3)*.07);
          c.position.set(Math.cos(a)*c.userData.r,c.userData.h+Math.sin(t*1.3+i)*.25*inten,Math.sin(a)*c.userData.r);
          c.rotation.y=a+Math.PI/2;c.rotation.z=Math.sin(t*2+i)*.3*inten;});
        rings[0].rotation.y=t*.11;rings[1].rotation.y=-t*.08;
        mi.update(t);
      }
    };
    g.userData.api=api;return api;
  }

  /* ============================================================
     C-3. 脳侵食オーバーレイ — DOM/CSSで段階演出(20/40/60/80/100)。
     Three.js側の負荷ゼロ。REDUCED_MOTION尊重。
     api: mount() / setLevel(0-100) / dispose()
     ※音(チャイム/逆和琴)は本体beep/SFXに接続する想定でhookだけ用意。
  ============================================================ */
  function createBrainErosionOverlay(opt={}){
    const reduced=!!(global.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);
    const css=[
      "#stErosion{position:fixed;inset:0;pointer-events:none;z-index:52}",
      "#stErosion .st-er-vig{position:absolute;inset:0;opacity:0;transition:opacity .8s;",
      " background:radial-gradient(ellipse at center,transparent 55%,rgba(60,20,80,.35) 100%)}",
      "#stErosion .st-er-glyph{position:absolute;font-family:serif;color:rgba(120,80,160,.0);font-size:15px;",
      " writing-mode:vertical-rl;letter-spacing:.3em;transition:color .5s}",
      "#stErosion .st-er-noise{position:absolute;inset:0;opacity:0;mix-blend-mode:overlay;",
      " background:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px)}",
      "#stErosion.lv20 .st-er-glyph{color:rgba(120,80,160,.5)}",
      "#stErosion.lv40 .st-er-noise{opacity:.5}",
      "#stErosion.lv60{filter:none}",
      "#stErosion.lv60 .st-er-vig{opacity:.6}",
      "#stErosion.lv80 .st-er-vig{opacity:1}",
      reduced?"":"#stErosion.lv80{animation:stErPulse 2.4s ease-in-out infinite}",
      "@keyframes stErPulse{0%,100%{opacity:1}50%{opacity:.75}}",
      /* 選択肢の黒塗り(80以上): ストーリーUI側が .st-er-blackout を選択肢spanに付ける */
      ".st-er-blackout{background:#0a0708!important;color:#0a0708!important;border-radius:3px;",
      " text-shadow:none!important;transition:none}",
      "body.st-erosion-max #stErosion .st-er-vig{opacity:1;background:rgba(8,4,10,.88)}"
    ].join("\n");
    let host=null,styleEl=null,glyphTimer=0;
    const GLYPHS=["みすゐ","ひさしを","わたどのへ","もやのうち","たれかある"]; // 旧仮名の揺らぎ
    const api={
      mount(){
        if(host)return api;
        styleEl=document.createElement("style");styleEl.textContent=css;document.head.appendChild(styleEl);
        host=document.createElement("div");host.id="stErosion";
        host.innerHTML='<div class="st-er-vig"></div><div class="st-er-noise"></div>';
        for(let i=0;i<4;i++){const s=document.createElement("span");s.className="st-er-glyph";
          s.style.left=(8+i*24)+"%";s.style.top=(12+(i%2)*55)+"%";s.textContent=GLYPHS[i];host.appendChild(s);}
        document.body.appendChild(host);return api;
      },
      /* 20:旧仮名の揺らぎ 40:ノイズ 60:ビネット 80:警告脈動 100:全画面侵食 */
      setLevel(v){
        if(!host)api.mount();
        host.className=v>=80?"lv20 lv40 lv60 lv80":v>=60?"lv20 lv40 lv60":v>=40?"lv20 lv40":v>=20?"lv20":"";
        document.body.classList.toggle("st-erosion-max",v>=100);
        if(opt.onStage)opt.onStage(v); // 音や小萩ノイズ等は本体側hookで
      },
      /* 20段階の「一瞬だけ」揺らぎ: 呼び出し側のループから稀に叩く */
      flickerGlyph(){
        if(!host||reduced)return;
        const gs=host.querySelectorAll(".st-er-glyph");if(!gs.length)return;
        const el=gs[(Math.random()*gs.length)|0];
        el.style.color="rgba(150,100,190,.85)";setTimeout(()=>{el.style.color="";},420);
      },
      dispose(){if(host&&host.parentNode)host.parentNode.removeChild(host);
        if(styleEl&&styleEl.parentNode)styleEl.parentNode.removeChild(styleEl);
        document.body.classList.remove("st-erosion-max");host=null;styleEl=null;}
    };
    return api;
  }

  /* ============================================================
     C-4. 歌合会場(冬夜) — 火桶・灯台・雪・判者席・題札。静物中心。
     api: setTopic("雪") / update(t)=灯の揺らぎのみ
  ============================================================ */
  function createUtakaiStageProps(){
    const g=new THREE.Group();
    // 判者席(一段高い畳台+茵)
    const dais=new THREE.Group();
    dais.add(box(1.6,.16,1.2,STORY_MATS.wood,0,.08,0));
    dais.add(box(1.4,.05,1.0,M({color:0xd9cba0,roughness:.9}),0,.19,0));
    dais.add(box(.9,.04,.8,M({color:0x8a3a30,roughness:.85}),0,.23,0));
    dais.position.set(0,0,-1.8);g.add(dais);
    // 火桶×2(灰の中の熾火=emissive)
    const embers=[];
    [-1.6,1.6].forEach(x=>{
      const h=new THREE.Group();
      h.add(cyl(.34,.28,.34,STORY_MATS.wood,0,.17,0,12));
      h.add(cyl(.30,.30,.05,M({color:0xcfc3a6,roughness:.95}),0,.335,0,12));
      const em=M({color:0x30140a,roughness:.9,emissive:0xff5a22,emissiveIntensity:.8});em.__ownedByStory=true;
      h.add(sph(.09,em,0,.36,0,8,6));embers.push(em);
      h.position.set(x,0,-.6);g.add(h);
    });
    // 灯台×4(高灯台: 柱+皿+炎)
    const flames=[];
    [[-2.6,-2.4],[2.6,-2.4],[-2.6,.9],[2.6,.9]].forEach(p=>{
      const d=new THREE.Group();
      d.add(cyl(.03,.045,1.5,STORY_MATS.black,0,.75,0,8));
      d.add(cyl(.14,.10,.03,STORY_MATS.black,0,1.52,0,10));
      const fm=new THREE.MeshBasicMaterial({color:0xffc873,transparent:true,opacity:.95});fm.__ownedByStory=true;
      const fl=new THREE.Mesh(new THREE.ConeGeometry(.045,.16,7),fm);fl.position.y=1.62;flames.push(fl);d.add(noShadow(fl));
      d.position.set(p[0],0,p[1]);g.add(d);
    });
    // 題札(判者席の脇の立て札。setTopicで文字差し替え)
    const board=new THREE.Group();
    board.add(box(.05,1.1,.05,STORY_MATS.woodDark,0,.55,0));
    board.add(box(.42,.62,.03,STORY_MATS.paper,0,1.15,0));
    const tMat=new THREE.MeshBasicMaterial({transparent:true});tMat.__ownedByStory=true;
    const tPlane=plane(.34,.54,tMat,0,1.15,.017);board.add(noShadow(tPlane));tPlane.visible=false;
    board.position.set(1.15,0,-1.75);board.rotation.y=-.2;g.add(board);
    // 雪(静的な白い薄片を高欄際に数枚。動く雪は本体snowFallに任せる)
    for(let i=0;i<7;i++){const s=plane(.5+Math.random()*.6,.35,M({color:0xf4f6fa,roughness:.95}),-3.2+i*1.1,.015,1.9);
      s.rotation.x=-Math.PI/2;g.add(noShadow(s));}
    let topicTex=null;
    const api={group:g,
      setTopic(s){if(topicTex)topicTex.dispose();
        if(!s){tPlane.visible=false;return;}
        topicTex=textTexture("題 "+s,{w:64,h:128,fontSize:26,color:"#2a201a",bold:true});
        tMat.map=topicTex;tMat.needsUpdate=true;tPlane.visible=true;},
      update(t){flames.forEach((f,i)=>{f.scale.y=1+Math.sin(t*9+i*2.1)*.18;f.material.opacity=.85+Math.sin(t*11+i)*.1;});
        embers.forEach((e,i)=>e.emissiveIntensity=.65+Math.sin(t*2.2+i*3)*.25);}
    };
    g.userData.api=api;return api;
  }

  /* ============================================================
     D-1. 大鬼(物語版) — 既存鬼と差別化: 建具を破壊する物語ボス。
     胸に「小萩の短冊」を封じた琥珀色の窓を持つ。
     api: setPhase(1|2|3) / chestSealPulse(t) / update(t)
  ============================================================ */
  function createGreatOniStoryObject(){
    const g=new THREE.Group();
    // 体躯(既存鬼より大きく、前傾)
    g.add(cyl(.62,.95,1.7,STORY_MATS.oniSkin,0,1.30,0,12));
    g.add(sph(.66,STORY_MATS.oniSkin,0,2.55,.06,12,9));
    // 二本角(左右非対称=歪みの記号)
    const hL=new THREE.Mesh(new THREE.ConeGeometry(.14,.62,7),STORY_MATS.oniDark);hL.position.set(-.30,3.15,.02);hL.rotation.z=.22;g.add(hL);
    const hR=new THREE.Mesh(new THREE.ConeGeometry(.11,.48,7),STORY_MATS.oniDark);hR.position.set(.33,3.10,.02);hR.rotation.z=-.14;g.add(hR);
    // 目(黄金)と牙
    [-1,1].forEach(s=>{g.add(noShadow(sph(.07,new THREE.MeshBasicMaterial({color:0xffd23f}),s*.24,2.62,.52,7,5)));
      const fang=new THREE.Mesh(new THREE.ConeGeometry(.05,.16,5),STORY_MATS.paper);fang.position.set(s*.16,2.28,.55);fang.rotation.x=Math.PI;g.add(fang);});
    // 腕と金棒
    [-1,1].forEach(s=>{const arm=cyl(.16,.22,1.25,STORY_MATS.oniSkin,s*.80,1.75,.1,9);arm.rotation.z=s*.5;g.add(arm);
      g.add(sph(.20,STORY_MATS.oniSkin,s*1.18,1.16,.22,8,6));});
    const club=new THREE.Group();
    club.add(cyl(.09,.13,1.9,STORY_MATS.woodDark,0,.95,0,9));
    for(let i=0;i<8;i++){const stud=sph(.045,STORY_MATS.gold,Math.cos(i*.78)*.14,1.45+((i%3)*.2),Math.sin(i*.78)*.14,6,5);club.add(stud);}
    club.position.set(1.30,1.05,.30);club.rotation.z=-.5;g.add(club);
    // 肩に裂いた御簾を纏う(物語ボスの記号)
    const torn=plane(1.5,.9,STORY_MATS.misu.clone(),-.55,2.35,-.1);torn.material.__ownedByStory=true;torn.material.opacity=.5;
    torn.rotation.z=.6;torn.rotation.y=.3;g.add(noShadow(torn));
    // 胸の封印窓: 琥珀色の板の奥に小萩の短冊シルエット
    const chest=new THREE.Group();
    const amberMat=new THREE.MeshStandardMaterial({color:0xd9903a,transparent:true,opacity:.55,roughness:.35,emissive:0xa85f16,emissiveIntensity:.5});amberMat.__ownedByStory=true;
    chest.add(box(.44,.60,.06,amberMat,0,0,0));
    chest.add(box(.50,.66,.03,STORY_MATS.oniDark,0,0,-.045));
    const silh=noShadow(box(.10,.42,.012,new THREE.MeshBasicMaterial({color:0x5a3f6e}),0,0,.033));chest.add(silh); // 短冊影
    const cordDot=noShadow(sph(.028,STORY_MATS.murasakiCord,0,.16,.045,7,5));chest.add(cordDot);                    // 薄紫の結び=小萩の証
    chest.position.set(0,1.95,.62);g.add(chest);
    // フェーズ2: 逆さ文字の札(周回)
    const invCards=[];
    for(let i=0;i<5;i++){
      const tex=textTexture(["すみ","しさひ","やも","のどたわ","こすの"][i],{w:48,h:128,fontSize:26,color:"#c03028"});
      const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true});mat.__ownedByStory=true;
      const card=plane(.20,.5,mat,0,0,0);card.rotation.z=Math.PI; // 逆さに表示
      card.visible=false;invCards.push(card);g.add(noShadow(card));
    }
    let phase=1;
    const api={group:g,chestSeal:chest,
      setPhase(p){phase=p;
        invCards.forEach(c=>c.visible=p>=2);
        amberMat.emissiveIntensity=p>=3?1.2:.5;silh.visible=p>=3||p===1;
        torn.material.opacity=p>=2?.7:.5;},
      update(t){
        g.position.y=Math.abs(Math.sin(t*1.1))*.10;g.rotation.z=Math.sin(t*.9)*.03;
        if(phase>=2)invCards.forEach((c,i)=>{const a=t*.8+i*1.256;
          c.position.set(Math.cos(a)*1.5,1.7+Math.sin(t*1.7+i)*.4,Math.sin(a)*1.5);c.rotation.y=a+Math.PI/2;});
        if(phase>=3)amberMat.emissiveIntensity=1.0+Math.sin(t*5)*.4;
      }
    };
    g.userData.api=api;return api;
  }

  /* ============================================================
     D-2. 名前の札(ネームシール) — 正しい名を呼ぶと光り、邸を再構築する。
     api: trigger()=点灯+浮上+光輪 / update(t,dt)
  ============================================================ */
  function createNameSealEffect(label){
    const g=new THREE.Group();
    const mat=M({color:0xf0e7cc,roughness:.85,emissive:0x8a6a20,emissiveIntensity:.1});mat.__ownedByStory=true;
    g.add(box(.03,.42,.16,mat,0,0,0));
    const tex=textTexture(label,{w:64,h:160,fontSize:32,color:"#2a201a",bold:true});
    const tm=new THREE.MeshBasicMaterial({map:tex,transparent:true});tm.__ownedByStory=true;
    [1,-1].forEach(s=>{const p=plane(.13,.38,tm,s*.017,0,0);p.rotation.y=s*Math.PI/2;g.add(noShadow(p));});
    const haloMat=new THREE.MeshBasicMaterial({color:0xffe9a8,transparent:true,opacity:0,depthWrite:false});haloMat.__ownedByStory=true;
    const halo=new THREE.Mesh(new THREE.RingGeometry(.24,.34,20),haloMat);halo.rotation.x=Math.PI/2;halo.position.y=-.24;g.add(noShadow(halo));
    let fired=0;
    const api={group:g,label,
      trigger(){fired=0.0001;},
      get done(){return fired>=1.4;},
      update(t,dt){
        if(!fired){g.rotation.y=t*.4;mat.emissiveIntensity=.1+Math.sin(t*2)*.06;return;}
        fired+=dt;
        mat.emissiveIntensity=Math.min(2.2,mat.emissiveIntensity+dt*4);
        g.position.y+=dt*.9;                      // 名を得て浮上
        haloMat.opacity=Math.max(0,.85-fired*.6);halo.scale.multiplyScalar(1+dt*2.6);
        if(fired>1.1)g.traverse(o=>{if(o.material&&o.material.transparent)o.material.opacity=Math.max(0,(o.material.opacity||1)-dt*2);});
      }
    };
    g.userData.api=api;return api;
  }

  /* ============================================================
     D-3. 破魔の連札(最終3問用の三枚札) — 光る/割れる/燃える。
     api: setLabels([a,b,c]) / resolve(idx,"correct"|"crack"|"burn") / update
  ============================================================ */
  function createFinalQuizThreeSeals(){
    const g=new THREE.Group();
    const seals=[];
    for(let i=0;i<3;i++){
      const s=new THREE.Group();
      const mat=M({color:0xefe4c6,roughness:.85,emissive:0x6a5420,emissiveIntensity:.18});mat.__ownedByStory=true;
      const bodyL=box(.02,.56,.095,mat,0,0,-.05);const bodyR=box(.02,.56,.095,mat,0,0,.05); // 縦割れ用に2枚構成
      s.add(bodyL);s.add(bodyR);
      const tm=new THREE.MeshBasicMaterial({transparent:true});tm.__ownedByStory=true;
      const txt=plane(.16,.5,tm,.013,0,0);txt.rotation.y=Math.PI/2;s.add(noShadow(txt));
      s.position.set((i-1)*.9,0,0);s.userData={mat,tm,txt,bodyL,bodyR,state:"idle",t:0};
      seals.push(s);g.add(s);
    }
    const api={group:g,seals,
      setLabels(list){seals.forEach((s,i)=>{
        if(s.userData.tex)s.userData.tex.dispose();
        s.userData.tex=textTexture(list[i]||"",{w:64,h:192,fontSize:26,color:"#3a2a1a",bold:true});
        s.userData.tm.map=s.userData.tex;s.userData.tm.needsUpdate=true;});},
      resolve(idx,mode){const s=seals[idx];if(s)Object.assign(s.userData,{state:mode||"correct",t:0});},
      update(t,dt){seals.forEach((s,i)=>{
        const u=s.userData;
        if(u.state==="idle"){s.position.y=Math.sin(t*1.6+i*2.1)*.05;s.rotation.y=Math.sin(t*.7+i)*.15;u.mat.emissiveIntensity=.18+Math.sin(t*2.4+i)*.08;return;}
        u.t+=dt;
        if(u.state==="correct"){u.mat.emissiveIntensity=Math.min(2.4,u.mat.emissiveIntensity+dt*5);
          s.position.y+=dt*.8;s.rotation.y+=dt*2.2;
          if(u.t>.9)s.visible=false;}
        else if(u.state==="crack"){ // 縦に割れて左右に倒れる
          u.bodyL.position.z-=dt*.25;u.bodyR.position.z+=dt*.25;
          u.bodyL.rotation.x-=dt*2.4;u.bodyR.rotation.x+=dt*2.4;
          s.position.y-=dt*.5;u.txt.visible=false;
          if(u.t>.8)s.visible=false;}
        else if(u.state==="burn"){ // 焦げて縮む
          u.mat.color.lerp(new THREE.Color(0x18100a),Math.min(1,dt*4));
          u.mat.emissive.setHex(0xff5a22);u.mat.emissiveIntensity=Math.max(0,1.2-u.t*1.4);
          s.scale.multiplyScalar(Math.max(.01,1-dt*1.3));
          if(u.t>1.0)s.visible=false;}
      });}
    };
    g.userData.api=api;return api;
  }

  /* ============================================================
     カメラ台帳 — chapterN.json の cameraAngleId に対応する実座標。
     寝殿の実寸(SH: cx=0,cz=-2, 母屋±8.8/z-5.8〜1.8, 廂z〜4.8, 簀子z〜5.5,
     東の対x=35, ボス広場x=30,z=-48)に基づく。統合時は applySaigenCam 互換の
     {pos,look} をそのまま渡せる。fovは章の演出方針(バイブル§カメラ)に従う。
  ============================================================ */
  const STORY_CAMERA_ANGLES={
    /* 第1話: 低い目線=場違いさ。床すれすれから小萩を見上げる */
    cam_main_house_inside:   {pos:[ 1.6,1.45, 3.6],look:[-0.6,1.7,-1.6],fov:58},
    cam_ch1_low_floor:       {pos:[ 0.9,0.9 , 4.2],look:[-0.4,1.5,-1.2],fov:62},
    cam_ch1_misu_gap:        {pos:[ 0.4,1.5 , 2.6],look:[ 0.4,1.4,-2.6],fov:50},
    /* 第2話: 横移動と奥行き=邸を理解する気持ちよさ */
    cam_summer_sunoko:       {pos:[-6.5,1.9 , 6.2],look:[ 3.0,1.4, 2.0],fov:60},
    cam_ch2_watadono:        {pos:[12.0,2.1 , 0.5],look:[24.0,1.6,-6.0],fov:58},
    cam_ch2_yarimizu:        {pos:[ 5.2,1.6 ,-6.0],look:[ 8.5,0.6,-9.5],fov:55},
    /* 第3話: 遮蔽物越し=見える/見えないの緊張 */
    cam_autumn_south_garden: {pos:[-4.6,1.7 , 8.5],look:[ 4.0,1.6, 0.5],fov:52},
    cam_ch3_kaimami_gap:     {pos:[10.8,1.55, 0.2],look:[ 0.5,1.5,-1.5],fov:44},
    cam_ch3_yarimizu_dark:   {pos:[ 6.0,1.4 ,-7.2],look:[ 9.0,0.4,-10.0],fov:58},
    /* 第4話: 正面性=儀式。判者の扇を画面中心に */
    cam_winter_utakai_hisashi:{pos:[ 0.0,1.75, 7.4],look:[ 0.0,1.5,-1.8],fov:48},
    cam_ch4_judge_close:     {pos:[ 0.8,1.6 , 1.2],look:[ 0.0,1.5,-1.8],fov:40},
    /* 第5話: 広角+俯瞰=邸全体が敵になる */
    cam_tokoyo_north_tainoya:{pos:[22.0,3.4 ,-38.0],look:[30.0,1.8,-48.0],fov:66},
    cam_ch5_oni_reveal:      {pos:[27.0,1.3 ,-42.0],look:[30.0,3.0,-48.0],fov:70},
    cam_ch5_overhead:        {pos:[30.0,14.0,-40.0],look:[30.0,0.0,-48.0],fov:60},
    /* 第6話: 静止画に近い長い間 */
    cam_ending_morning:      {pos:[ 0.2,1.6 , 8.8],look:[ 0.0,1.9,-2.0],fov:50}
  };

  /* ============ 公開 ============ */
  global.StoryObjects={
    MATS:STORY_MATS,
    textTexture,disposeGroup,makePool,
    createStoryKohagiObject,createStoryHidetoraObject,createStoryUkonObject,
    createMinisterObject,createUtakaiJudgeObject,
    createWhiteTanzakuObject,createTermCardObject,createWakaTanzakuObject,createPurpleCordMotif,
    createMisuBoundaryEffect,createTokoyoGlitchProps,createBrainErosionOverlay,createUtakaiStageProps,
    createGreatOniStoryObject,createNameSealEffect,createFinalQuizThreeSeals,
    STORY_CAMERA_ANGLES
  };
})(typeof window!=="undefined"?window:globalThis);
