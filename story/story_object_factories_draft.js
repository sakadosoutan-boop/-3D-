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
    judgeRobe: M({color:0x2c3050,roughness:.78}), // 波AA: 描き下ろしアイコン(紺の袍)に寄せた色
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
  /* ノートを破いた紙片のような不揃いな上端を持つ形状(短冊ではなく「切れ端」らしく見せる) */
  function tornPaperShape(w,h){
    const shp=new THREE.Shape(),hw=w/2,hh=h/2;
    shp.moveTo(-hw,-hh);shp.lineTo(hw,-hh);shp.lineTo(hw,hh*.5);
    const teeth=5;
    for(let i=1;i<=teeth;i++){const x=hw-(w*i/teeth);const y=(i%2===1)?hh*.98:hh*.58;shp.lineTo(x,y);}
    shp.lineTo(-hw,-hh);
    return shp;
  }
  function tornPaperMesh(w,h,mat){const g=new THREE.ShapeGeometry(tornPaperShape(w,h));return new THREE.Mesh(g,mat);}

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

     ⚠️ 使用禁止(旧ドラフト): この関数は小萩の「顔」を持つ全身モデルを作る。
        設計原則「小萩は決して姿を見せない」に反するため、本編では一切呼ばない。
        実際の小萩は story_runtime.js の stKohagiStation()(御簾越しの影＋薄紫の紐
        のみ、表情は非表示)で表現する。将来の統合でこちらを接続しないこと。
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
    const W=.30,H=.36; // 短冊ではなく、破いたノートの切れ端らしい比率(縦長すぎない)
    const front=tornPaperMesh(W,H,M({color:0xf6f0dd,roughness:.92}));front.position.z=.002;g.add(front);
    // 裏面: ノート(青い罫線+薄紫の細いマージン線+几帳面な手書き文字)。同じ破れ形状に描く
    const c=document.createElement("canvas");c.width=128;c.height=160;const x=c.getContext("2d");
    const backTex=new THREE.CanvasTexture(c);backTex.encoding=THREE.sRGBEncoding;
    const drawBack=(text)=>{
      x.clearRect(0,0,128,160);
      x.fillStyle="#f4f6f8";x.fillRect(0,0,128,160);
      x.strokeStyle="rgba(150,178,212,.6)";x.lineWidth=1; // 青い罫線(淡く・細く)
      for(let i=1;i<8;i++){x.beginPath();x.moveTo(10,i*19);x.lineTo(120,i*19);x.stroke();}
      x.strokeStyle="rgba(185,165,230,.85)";x.lineWidth=1; // 薄紫の"細い"マージン線(罫線より太くしない)
      x.beginPath();x.moveTo(20,0);x.lineTo(20,160);x.stroke();
      if(text){
        x.fillStyle="#3a3230";x.font="italic 12px 'Hiragino Mincho ProN',serif";x.textBaseline="alphabetic";
        const perLine=Math.max(4,Math.floor((128-30)/12.5));
        for(let i=0;i*perLine<text.length&&i<7;i++)x.fillText(text.slice(i*perLine,(i+1)*perLine),26,17+i*19);
      }
      backTex.needsUpdate=true;
    };
    drawBack(null);
    const back=tornPaperMesh(W,H,new THREE.MeshStandardMaterial({map:backTex,roughness:.92}));
    back.position.z=-.002;back.rotation.y=Math.PI;g.add(back);
    let inkTex=null;const inkMat=new THREE.MeshBasicMaterial({transparent:true});inkMat.__ownedByStory=true;
    const ink=plane(W*.8,H*.7,inkMat,0,-H*.04,.004);ink.visible=false;g.add(noShadow(ink));
    g.userData.fallT=0;
    const api={
      group:g,
      setText(s){if(inkTex)inkTex.dispose();
        inkTex=textTexture(s,{w:64,h:224,fontSize:15,color:"#3a3230"});
        inkMat.map=inkTex;inkMat.needsUpdate=true;ink.visible=!!s;},
      setBackText(s){drawBack(s);}, // 波AA: 裏面に「見覚えのある、几帳面な小さな字」を実際に描く
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
  function createTokoyoGlitchProps(radius=22){
    const g=new THREE.Group();
    // 反転した御簾(天地逆に宙吊り)×3、広い空間の各所に
    const misus=[];
    [[-.45,-.3,3.4],[.55,.25,4.6],[-.15,.65,5.6]].forEach(p=>{
      const mi=createMisuBoundaryEffect(2.6,1.8);mi.group.rotation.z=Math.PI;
      mi.group.position.set(radius*p[0],p[2],radius*p[1]);g.add(mi.group);misus.push(mi);
    });
    // 浮遊する札の環(広範囲・多重)
    const cards=[];
    for(let i=0;i<14;i++){
      const card=box(.02,.34,.11,STORY_MATS.ofuda,0,0,0);
      card.userData.a=i*Math.PI*2/14;card.userData.r=radius*.35+((i%5)*radius*.13);card.userData.h=1.2+(i%5)*.9;
      cards.push(card);g.add(card);
    }
    // 壊れた建具(格子の破片)を広く散らす
    for(let i=0;i<7;i++){
      const frag=new THREE.Group();
      frag.add(box(.06,1.3-((i%4)*.15),.06,STORY_MATS.woodDark,0,0,0));
      for(let k=0;k<3;k++)frag.add(box(.5,.022,.03,STORY_MATS.woodDark,0,-.3+k*.3,0));
      frag.position.set(Math.cos(i*1.9)*radius*(.35+(i%3)*.2),.4+(i%2)*.8,Math.sin(i*1.9)*radius*(.35+(i%3)*.2));
      frag.rotation.z=.5+i*.35;frag.rotation.y=i*1.2;g.add(frag);
    }
    // 浮遊する調度品(几帳・屏風・唐櫃・火桶・文机・高坏) — 邸の記憶が漂う
    const furn=[];
    function addFurn(builder,i,rMul,h){
      const f=builder();f.userData.a=i*1.05;f.userData.r=radius*rMul;f.userData.h=h;f.userData.sp=.06+(i%4)*.03;
      furn.push(f);g.add(f);
    }
    const mkKicho=()=>{const f=new THREE.Group();
      f.add(cyl(.04,.04,1.7,STORY_MATS.woodDark,0,.85,0,6));
      f.add(box(1.7,.06,.06,STORY_MATS.woodDark,0,1.66,0));
      const cloth=plane(1.6,1.25,M({color:0x8a3a50,roughness:.85,side:THREE.DoubleSide}),0,1.0,0);f.add(cloth);return f;};
    const mkByobu=()=>{const f=new THREE.Group();
      for(let k=0;k<3;k++){const pnl=box(.62,1.35,.03,M({color:0xd9c9a2,roughness:.85}),(k-1)*.58,.7,(k%2)*.18);
        pnl.rotation.y=(k-1)*.5;f.add(pnl);}return f;};
    const mkKarabitsu=()=>{const f=new THREE.Group();
      f.add(box(.9,.5,.6,M({color:0x2e1d12,roughness:.7}),0,.45,0));
      f.add(box(.96,.1,.66,M({color:0x3a2818,roughness:.7}),0,.72,0));
      [[-.35,-.22],[-.35,.22],[.35,-.22],[.35,.22]].forEach(p=>f.add(cyl(.04,.05,.24,STORY_MATS.woodDark,p[0],.12,p[1],6)));return f;};
    const mkHioke=()=>{const f=new THREE.Group();
      f.add(cyl(.32,.26,.32,STORY_MATS.wood,0,.16,0,12));
      f.add(sph(.08,new THREE.MeshStandardMaterial({color:0x30140a,roughness:.9,emissive:0xff5a22,emissiveIntensity:.7}),0,.33,0,8,6));return f;};
    const mkTsukue=()=>{const f=new THREE.Group();
      f.add(box(.9,.05,.4,M({color:0x4a3722,roughness:.75}),0,.32,0));
      [[-.38],[.38]].forEach(p=>f.add(box(.06,.3,.36,STORY_MATS.woodDark,p[0],.15,0)));
      f.add(box(.3,.02,.22,STORY_MATS.paper,0,.36,0));return f;};
    const mkTakatsuki=()=>{const f=new THREE.Group();
      f.add(cyl(.22,.06,.08,M({color:0xa03a28,roughness:.6}),0,.3,0,10));
      f.add(cyl(.05,.09,.26,M({color:0xa03a28,roughness:.6}),0,.13,0,8));return f;};
    [mkKicho,mkByobu,mkKarabitsu,mkHioke,mkTsukue,mkTakatsuki,mkKicho,mkByobu,mkKarabitsu,mkHioke].forEach((b,i)=>{
      addFurn(b,i,.3+(i%4)*.17,1.0+(i%5)*1.1);
    });
    // 低負荷の霧リング(2枚を逆回転)
    const rings=[];
    for(let i=0;i<2;i++){
      const rm=STORY_MATS.fog.clone();rm.__ownedByStory=true;rm.opacity=.13+i*.05;
      const ring=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,2.2+i,28,1,true),rm);
      ring.position.y=1.2+i*.9;rings.push(ring);g.add(noShadow(ring));
    }
    let inten=1;
    const api={group:g,
      setIntensity(v){inten=Math.max(0,Math.min(1,v));g.visible=inten>0.02;},
      update(t,dt){
        cards.forEach((c,i)=>{const a=c.userData.a+t*(.18+(i%3)*.05);
          c.position.set(Math.cos(a)*c.userData.r,c.userData.h+Math.sin(t*1.3+i)*.3*inten,Math.sin(a)*c.userData.r);
          c.rotation.y=a+Math.PI/2;c.rotation.z=Math.sin(t*2+i)*.3*inten;});
        furn.forEach((f,i)=>{const a=f.userData.a+t*f.userData.sp;
          f.position.set(Math.cos(a)*f.userData.r,f.userData.h+Math.sin(t*.9+i*1.7)*.45*inten,Math.sin(a)*f.userData.r);
          f.rotation.y=a+i;f.rotation.z=Math.sin(t*.7+i)*.14*inten;f.rotation.x=Math.cos(t*.5+i*2)*.1*inten;});
        rings[0].rotation.y=t*.09;rings[1].rotation.y=-t*.06;
        misus.forEach(mi=>mi.update(t));
      }
    };
    g.userData.api=api;return api;
  }

  /* ============================================================
     C-2b. 常世の禍々しい空(波AB) — 通常のfog/sky色上書きだけでは弱いという
     実機FBを受け、赤黒いグラデーション+ひび割れ状のメッシュ模様をCanvasTextureで
     描き、プレイヤーを覆う巨大な逆向き球(スカイドーム)として追加する。
     api: update(camPos,elapsedT) — 毎フレーム、カメラ位置に追従させ、ごく緩慢に回転
  ============================================================ */
  function createTokoyoSkyDome(){
    const cv=document.createElement("canvas");cv.width=512;cv.height=512;
    const cx=cv.getContext("2d");
    const grad=cx.createLinearGradient(0,0,0,512); // 天頂=漆黒 → 地平寄り=禍々しい赤
    grad.addColorStop(0,"#020000");
    grad.addColorStop(0.40,"#170203");
    grad.addColorStop(0.72,"#4d0608");
    grad.addColorStop(1,"#8a0c0c");
    cx.fillStyle=grad;cx.fillRect(0,0,512,512);
    cx.strokeStyle="rgba(0,0,0,.55)"; // 黒いひび割れメッシュ(天頂側)
    cx.lineWidth=1.4;
    for(let i=0;i<26;i++){
      let x=Math.random()*512,y=Math.random()*260;cx.beginPath();cx.moveTo(x,y);
      const segs=3+((Math.random()*3)|0);
      for(let s=0;s<segs;s++){x+=(Math.random()-.5)*90;y+=Math.random()*60+10;cx.lineTo(x,y);}
      cx.stroke();
    }
    cx.strokeStyle="rgba(255,40,20,.30)"; // 赤い脈動状メッシュ(地平側)
    cx.lineWidth=2;
    for(let i=0;i<18;i++){
      let x=Math.random()*512,y=300+Math.random()*200;cx.beginPath();cx.moveTo(x,y);
      const segs=3+((Math.random()*3)|0);
      for(let s=0;s<segs;s++){x+=(Math.random()-.5)*110;y+=(Math.random()-.5)*50;cx.lineTo(x,y);}
      cx.stroke();
    }
    const tex=new THREE.CanvasTexture(cv);tex.encoding=THREE.sRGBEncoding;
    const mat=new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide,fog:false,depthWrite:false,transparent:true,opacity:0});
    mat.__ownedByStory=true;
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(700,24,16),mat);
    const g=new THREE.Group();g.add(mesh);g.renderOrder=-9000;
    let age=0;
    const api={group:g,
      update(camPos,t){
        g.position.copy(camPos);
        age=Math.min(1,age+0.02); // ふわっと出現
        mat.opacity=0.85*age;
        mesh.rotation.y=t*0.006; // ごく緩慢な回転で「生きている」不穏さを出す
      }
    };
    return api;
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
      /* lv20の旧仮名は常時表示しない(flickerGlyph()が一瞬だけ色を入れる) */
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
     E. 別ロケーション(現代)セット — 病院・教室など「寝殿の外」の場面。
     ■ 方式: 寝殿から十分離れた座標(STORY_OFFSTAGE)に密閉された内装セットを建てる。
       部屋は内向きBoxGeometry(BackSide)なので外界は一切映らず、フォグ・空も見えない。
       専用のPointLightを持ち、寝殿側の昼夜設定に依存しない。
     ■ 転換手順(推奨): saigenFade("black") → プレイヤー/カメラをセットのカメラ台帳へsnap
       → 章の終わりに disposeGroup で撤去。生成は章頭のみ。
  ============================================================ */
  const STORY_OFFSTAGE={
    hospital: {x:-260,y:0,z:240},
    classroom:{x:-260,y:0,z:300},
    spare1:   {x:-260,y:0,z:360},
    spare2:   {x:-200,y:0,z:360}
  };

  /* 内向きの部屋シェル。floor/wall/ceilingを別色にできる6面BackSide箱+天井灯 */
  function createModernRoomShell(opt={}){
    const w=opt.w||6.5,h=opt.h||3.0,d=opt.d||5.2;
    const g=new THREE.Group();
    const mk=c=>{const m=M({color:c,roughness:.92,side:THREE.BackSide});m.__ownedByStory=true;return m;};
    const wall=mk(opt.wallColor!=null?opt.wallColor:0xe8ecea);
    const mats=[wall,wall,mk(opt.ceilColor!=null?opt.ceilColor:0xf2f4f2),
                mk(opt.floorColor!=null?opt.floorColor:0xd8d2c4),wall,wall]; // +x,-x,+y,-y,+z,-z
    const room=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mats);
    room.position.y=h/2;room.receiveShadow=true;g.add(room);
    // 幅木(壁と床の境の締め)
    const skirt=M({color:0xb9b2a2,roughness:.85});skirt.__ownedByStory=true;
    [[0,-d/2+.02,w-.08,0],[0,d/2-.02,w-.08,0],[-w/2+.02,0,d-.08,Math.PI/2],[w/2-.02,0,d-.08,Math.PI/2]].forEach(p=>{
      const b=box(p[2],.10,.03,skirt,p[0],.05,p[1]);b.rotation.y=p[3];g.add(b);});
    // 天井灯(発光パネル+PointLight)。窓は各セット側で壁に貼る
    const lm=new THREE.MeshBasicMaterial({color:opt.lightTint||0xf6f4ea});lm.__ownedByStory=true;
    const panel=plane(w*.34,d*.22,lm,0,h-.02,0);panel.rotation.x=Math.PI/2;g.add(noShadow(panel));
    const light=new THREE.PointLight(opt.lightTint||0xfff4e0,opt.lightPower!=null?opt.lightPower:.95,Math.max(w,d)*1.6,2);
    light.position.set(0,h-.5,0);g.add(light);
    g.userData.size={w,h,d};
    return g;
  }

  /* 壁の窓: 淡い外光の発光板+桟。timeTint で朝/昼/夕の光色を変えられる */
  function windowPane(w,h,tint){
    const g=new THREE.Group();
    const glow=new THREE.MeshBasicMaterial({color:tint||0xdfe9f4});glow.__ownedByStory=true;
    g.add(noShadow(plane(w,h,glow,0,0,0)));
    const frame=M({color:0x9aa2a8,roughness:.6});frame.__ownedByStory=true;
    g.add(box(w+.06,.05,.04,frame,0,h/2,0));g.add(box(w+.06,.05,.04,frame,0,-h/2,0));
    g.add(box(.05,h,.04,frame,-w/2,0,0));g.add(box(.05,h,.04,frame,w/2,0,0));
    g.add(box(.035,h,.03,frame,0,0,0));g.add(box(w,.035,.03,frame,0,0,0));
    return g;
  }

  /* ---- E-1. 病院の個室 ----
     栞の現実側の真相シーン用。ベッド・点滴・心電モニタ・カーテン・
     サイドテーブルの上に「薄紫の紐のしおり付きノート」(常世との接続)。
     api: update(t) / setCurtain(0..1) / monitor(点滅・波形スクロール) */
  function createHospitalRoomSet(){
    const anchor=STORY_OFFSTAGE.hospital;
    const g=new THREE.Group();g.position.set(anchor.x,anchor.y,anchor.z);
    const shell=createModernRoomShell({w:6.4,h:3.0,d:5.2,wallColor:0xd6e6dc,floorColor:0xc7bfa8,lightTint:0xf0ecd8,lightPower:.8});
    g.add(shell);
    // 窓(淡い朝光)+ブラインド
    const win=windowPane(2.0,1.3,0xe9f2fb);win.position.set(-3.17,1.7,-.6);win.rotation.y=Math.PI/2;g.add(win);
    const blind=M({color:0xf0f2ee,roughness:.9});blind.__ownedByStory=true;
    for(let i=0;i<5;i++)g.add(noShadow(box(.02,.10,2.0,blind,-3.13,2.30-i*.13,-.6,false)));
    // ベッド(枠・マット・毛布・枕・柵)
    const bed=new THREE.Group();
    const steel=M({color:0xcfd6da,roughness:.4,metalness:.5});steel.__ownedByStory=true;
    bed.add(box(2.15,.09,1.05,steel,0,.42,0));
    [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(p=>bed.add(cyl(.035,.035,.42,steel,p[0]*1.0,.21,p[1]*.48,8)));
    bed.add(box(2.05,.16,.98,M({color:0xf4f2ec,roughness:.95}),0,.545,0));                    // マット
    const blanket=box(1.45,.10,1.00,M({color:0xbcd4c8,roughness:.9}),-.28,.665,0);bed.add(blanket); // 毛布
    bed.add(box(.42,.09,.60,M({color:0xffffff,roughness:.95}),.78,.645,0));                   // 枕
    [[-1],[1]].forEach(s=>{const rail=box(1.1,.05,.04,steel,-.35,.86,s[0]*.52);bed.add(rail);
      bed.add(cyl(.02,.02,.26,steel,-.85,.72,s[0]*.52,6));bed.add(cyl(.02,.02,.26,steel,.15,.72,s[0]*.52,6));});
    bed.add(box(.9,.5,.05,steel,1.08,.75,0));                                                 // ヘッドボード
    bed.position.set(1.2,0,-1.3);bed.rotation.y=Math.PI/2;g.add(bed);
    // 点滴スタンド(ポール・フック・バッグ・チューブ)
    const iv=new THREE.Group();
    iv.add(cyl(.018,.018,1.8,steel,0,.9,0,8));
    iv.add(cyl(.22,.22,.02,steel,0,.03,0,10));
    [[.16,0],[-.16,0],[0,.16],[0,-.16]].forEach(p=>iv.add(cyl(.015,.02,.05,steel,p[0],.05,p[1],6)));
    const hook=box(.30,.02,.02,steel,0,1.80,0);iv.add(hook);
    const bagMat=new THREE.MeshStandardMaterial({color:0xeef4f8,transparent:true,opacity:.75,roughness:.3});bagMat.__ownedByStory=true;
    iv.add(box(.16,.26,.05,bagMat,.13,1.62,0));
    iv.add(noShadow(box(.13,.16,.03,new THREE.MeshBasicMaterial({color:0xcfe4f0}),.13,1.58,.027)));  // 液面
    const tube=cyl(.006,.006,.9,bagMat,.16,1.05,.10,6);tube.rotation.x=.35;iv.add(tube);
    iv.position.set(.35,0,-2.15);g.add(iv);
    // 心電モニタ(波形はCanvasTextureをスクロール)
    const mon=new THREE.Group();
    mon.add(box(.44,.34,.30,M({color:0xdfe3e6,roughness:.6}),0,1.18,0));
    const mc=document.createElement("canvas");mc.width=128;mc.height=64;
    const mx=mc.getContext("2d");
    mx.fillStyle="#0c1a14";mx.fillRect(0,0,128,64);
    mx.strokeStyle="#39e6a0";mx.lineWidth=2;mx.beginPath();
    for(let x=0;x<=128;x++){const beat=(x%64);let y=40;
      if(beat>26&&beat<30)y=40-(beat-26)*9;else if(beat>=30&&beat<34)y=4+(beat-30)*11;
      else y=40+Math.sin(x*.4)*2;
      x===0?mx.moveTo(x,y):mx.lineTo(x,y);}
    mx.stroke();
    const monTex=new THREE.CanvasTexture(mc);monTex.wrapS=THREE.RepeatWrapping;monTex.encoding=THREE.sRGBEncoding;
    const monMat=new THREE.MeshBasicMaterial({map:monTex});monMat.__ownedByStory=true;
    mon.add(noShadow(plane(.36,.24,monMat,0,1.20,.155)));
    const dot=noShadow(sph(.014,new THREE.MeshBasicMaterial({color:0x51ffb2}),.14,1.30,.16,6,5));mon.add(dot);
    mon.add(cyl(.03,.03,1.0,steel,0,.5,0,8));mon.add(cyl(.18,.18,.02,steel,0,.02,0,10));
    mon.position.set(.35,0,-.35);g.add(mon);
    // 間仕切りカーテン(レール+ヒダ=波板)。setCurtainで開閉
    const railY=2.55;
    const rail=cyl(.015,.015,3.4,steel,0,railY,.9,8);rail.rotation.z=Math.PI/2;g.add(rail);
    const curtainMat=M({color:0xc3d8c8,roughness:.95,side:THREE.DoubleSide});curtainMat.__ownedByStory=true;
    const curtain=new THREE.Group();
    for(let i=0;i<7;i++){const fold=plane(.24,railY-.35,curtainMat,0,0,0);
      fold.position.set(-.72+i*.24,(railY-.35)/2+.05,.9+((i%2)?.03:-.03));fold.rotation.y=(i%2?1:-1)*.18;curtain.add(fold);}
    g.add(curtain);
    // サイドテーブル: ノート(青い罫線+寝殿造りの間取り略図)+薄紫の紐のしおり
    const table=new THREE.Group();
    table.add(box(.55,.04,.42,M({color:0xcfc4ae,roughness:.8}),0,.62,0));
    table.add(box(.50,.58,.38,M({color:0xe3ddd0,roughness:.85}),0,.31,0));
    const note=box(.26,.03,.34,M({color:0xf4f6f8,roughness:.95}),-.06,.66,0);note.rotation.y=.18;table.add(note);
    // ノートの見開きページ: 青い罫線+薄紫のマージン線+寝殿造りの間取り略図(手書き風)
    const nc=document.createElement("canvas");nc.width=104;nc.height=136;const nx=nc.getContext("2d");
    nx.fillStyle="#f4f6f8";nx.fillRect(0,0,104,136);
    nx.strokeStyle="rgba(150,178,212,.55)";nx.lineWidth=1;
    for(let i=1;i<7;i++){nx.beginPath();nx.moveTo(8,i*18);nx.lineTo(98,i*18);nx.stroke();}
    nx.strokeStyle="rgba(185,165,230,.8)";nx.lineWidth=1;nx.beginPath();nx.moveTo(16,4);nx.lineTo(16,132);nx.stroke();
    nx.strokeStyle="#5a4a3a";nx.lineWidth=1.1; // 寝殿造りの間取り略図(母屋・廂・対屋を簡略に)
    nx.strokeRect(38,22,44,26);nx.strokeRect(30,16,60,38);
    nx.strokeRect(20,26,10,16);nx.strokeRect(88,26,10,16);
    nx.beginPath();nx.moveTo(20,34);nx.lineTo(30,34);nx.moveTo(88,34);nx.lineTo(98,34);nx.stroke();
    nx.font="italic 7px 'Hiragino Mincho ProN',serif";nx.fillStyle="#5a4a3a";
    nx.fillText("寝殿造り",34,66);
    const noteTex=new THREE.CanvasTexture(nc);noteTex.encoding=THREE.sRGBEncoding;
    const noteTexMat=new THREE.MeshBasicMaterial({map:noteTex});noteTexMat.__ownedByStory=true;
    const notePage=plane(.24,.31,noteTexMat,0,.017,0);notePage.rotation.x=-Math.PI/2;note.add(noShadow(notePage));
    // 波AL: 「枕に突き刺さって見える」FB対応——直立していた紐を、ノートの頁の上に
    // 平らに寝かせ、栞紐らしく机上へ置き直す(結び目と房が頁の縁から覗く姿)
    const cordMark=createPurpleCordMotif();cordMark.attachTo(table,{x:.12,y:.700,z:.03},.55);
    cordMark.group.rotation.x=-Math.PI/2; // 頁に沿わせて寝かせる(垂れは奥へ流れる)
    table.position.set(0.55,0,-1.55);g.add(table); // 波AA: 枕元(ベッド寄り)に置き直し、主なカメラでも見えるように
    // 丸椅子とスリッパ(誰かが見舞いに来ている気配)
    g.add(cyl(.19,.19,.05,M({color:0xd8cfc0,roughness:.85}),2.35,.44,-1.0,12));
    g.add(cyl(.03,.03,.42,steel,2.35,.21,-1.0,8));
    [[-.02],[.14]].forEach((s,i)=>g.add(box(.11,.03,.26,M({color:0x3a6b4a,roughness:.9}),2.0+s[0],.02,.4+i*.02))); // 波AA: 緑のスリッパ
    // 春の朝の光——窓から斜めに差す光条(加算合成でふわりと明るむ)。「そっと差している」を視覚化
    const shaftMat=new THREE.MeshBasicMaterial({color:0xfff4dc,transparent:true,opacity:.08,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});shaftMat.__ownedByStory=true;
    const shafts=new THREE.Group();
    [[-2.05,1.25,-.72,.52,.09],[-1.72,1.12,-.50,.42,.07]].forEach(p=>{
      shaftMat.opacity=p[4]; // 二条それぞれ濃さを変える(共有matだが最後の値でまとめて描かれるのは可)
      const beam=plane(p[3],3.7,shaftMat,p[0],p[1],p[2]);beam.rotation.z=-.55;shafts.add(noShadow(beam));
    });
    shaftMat.opacity=.085;
    g.add(shafts);
    // 光条の中を漂う塵(小さな加算プレーンをゆっくり上下)
    const moteMat=new THREE.MeshBasicMaterial({color:0xfff2d4,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false});moteMat.__ownedByStory=true;
    const motes=[];
    for(let i=0;i<6;i++){
      const mo=plane(.022,.022,moteMat,-2.3+Math.random()*1.05,.7+Math.random()*1.5,-.78+Math.random()*.4);
      mo.userData={y0:mo.position.y,ph:Math.random()*6,sp:.4+Math.random()*.5};motes.push(noShadow(mo));shafts.add(mo);
    }
    let curtainOpen=1,beepUp=false;
    const api={group:g,anchor,
      setCurtain(v){curtainOpen=Math.max(0,Math.min(1,v));
        curtain.children.forEach((f,i)=>{f.position.x=-.72*curtainOpen+i*.24*curtainOpen; f.visible=curtainOpen>.05;});},
      update(t){monTex.offset.x=(t*.14)%1;                                    // 波形が流れる
        const up=Math.sin(t*6)>0;
        dot.material.color.setHex(up?0x51ffb2:0x0c3a28);                     // 心拍の点滅
        if(up&&!beepUp&&typeof beep==="function")beep(880,.05,"sine",.05);   // 波AA: 心電図の電子音
        beepUp=up;
        curtain.children.forEach((f,i)=>f.rotation.y=(i%2?1:-1)*(.18+Math.sin(t*.8+i)*.02));
        if(!(typeof REDUCED_MOTION!=="undefined"&&REDUCED_MOTION))    // 塵はゆっくり上下に漂う(REDUCED_MOTION時は静止)
          motes.forEach(mo=>{const u=mo.userData;mo.position.y=u.y0+Math.sin(t*u.sp+u.ph)*.14;mo.material.opacity=.35+Math.sin(t*u.sp*1.7+u.ph)*.2;});
        cordMark.update(t);}
    };
    g.userData.api=api;return api;
  }

  /* ---- E-2. 現代の教室 ----
     第1話冒頭とEDの舞台。黒板には寝殿造りの平面図(Canvas描画)。
     栞の席=窓際後方。机上のノートとシャーペンに薄紫の紐。
     api: update(t) / setBoard("plan"|"waka") / shioriSeat(グループ参照) */
  function createClassroomSet(){
    const anchor=STORY_OFFSTAGE.classroom;
    const g=new THREE.Group();g.position.set(anchor.x,anchor.y,anchor.z);
    const shell=createModernRoomShell({w:8.2,h:3.1,d:6.6,wallColor:0xe6dcb8,floorColor:0xb89a68,ceilColor:0xece6d4,lightTint:0xf5ecd2,lightPower:1.0});
    g.add(shell);
    // 腰壁(和製教室の定番=淡い緑青の帯)。白すぎる箱を教室らしい色味にする
    const waMat=M({color:0x7f9c8f,roughness:.88});waMat.__ownedByStory=true;
    const waH=1.0,waY=waH/2;
    [[0,-3.28,8.12,0],[0,3.28,8.12,0],[-4.08,0,6.52,Math.PI/2],[4.08,0,6.52,Math.PI/2]].forEach(p=>{
      const b=box(p[2],waH,.03,waMat,p[0],waY,p[1]);b.rotation.y=p[3];g.add(b);});
    // 黒板(寝殿造り平面図をCanvasで描く)
    const bc=document.createElement("canvas");bc.width=512;bc.height=192;
    const bx=bc.getContext("2d");
    bx.fillStyle="#274236";bx.fillRect(0,0,512,192);
    bx.strokeStyle="#e8e2ce";bx.lineWidth=2;bx.font="14px 'Hiragino Mincho ProN',serif";bx.fillStyle="#e8e2ce";
    const rect=(x,y,w,h,label)=>{bx.strokeRect(x,y,w,h);if(label)bx.fillText(label,x+w/2-14,y+h/2+5);};
    rect(200,45,110,64,"母屋");
    bx.strokeRect(184,29,142,96);bx.fillText("廂",192,44);
    rect(60,45,70,64,"対屋");rect(382,45,70,64,"対屋");
    bx.beginPath();bx.moveTo(130,77);bx.lineTo(184,77);bx.stroke();bx.fillText("渡殿",138,70);
    bx.beginPath();bx.moveTo(326,77);bx.lineTo(382,77);bx.stroke();
    bx.beginPath();bx.moveTo(95,109);bx.lineTo(95,160);bx.lineTo(240,168);bx.stroke();bx.fillText("遣水",100,150);
    bx.beginPath();bx.ellipse(300,160,60,18,0,0,Math.PI*2);bx.stroke();bx.fillText("池",292,165);
    bx.fillText("寝殿造り",228,22);
    const boardTex=new THREE.CanvasTexture(bc);boardTex.encoding=THREE.sRGBEncoding;
    const boardMat=new THREE.MeshBasicMaterial({map:boardTex});boardMat.__ownedByStory=true;
    const board=new THREE.Group();
    board.add(box(3.6,1.45,.06,M({color:0x6b5a42,roughness:.8}),0,1.75,0));
    board.add(noShadow(plane(3.4,1.28,boardMat,0,1.75,.035)));
    board.add(box(3.5,.05,.10,M({color:0x9a8a6a,roughness:.7}),0,1.06,.05)); // チョーク受け
    board.add(box(.08,.025,.025,M({color:0xffffff,roughness:.9}),-.6,1.09,.05));
    board.position.set(0,0,-3.25);g.add(board);
    // 教卓
    g.add(box(1.1,.75,.55,M({color:0xc8b088,roughness:.8}),0,.375,-2.4));
    // 生徒机×6(2列×3)+椅子。窓際後方の1つが「栞の席」
    const deskMat=M({color:0xd8c9a0,roughness:.85});deskMat.__ownedByStory=true;
    const legMat=M({color:0x8e9499,roughness:.5,metalness:.4});legMat.__ownedByStory=true;
    let shioriSeat=null;
    for(let r=0;r<3;r++)for(let c=0;c<2;c++){
      const desk=new THREE.Group();
      desk.add(box(.62,.035,.44,deskMat,0,.70,0));
      [[-.27,-.18],[-.27,.18],[.27,-.18],[.27,.18]].forEach(p=>desk.add(cyl(.015,.015,.70,legMat,p[0],.35,p[1],6)));
      const chair=box(.36,.03,.34,deskMat,0,.42,.44);desk.add(chair);
      [[-.15,.30],[-.15,.58],[.15,.30],[.15,.58]].forEach(p=>desk.add(cyl(.013,.013,.42,legMat,p[0],.21,p[1],6)));
      desk.add(box(.36,.34,.03,deskMat,0,.62,.60));
      desk.position.set(-1.0+c*2.0,0,-1.1+r*1.35);
      g.add(desk);
      if(r===2&&c===1){ // 窓際(x+側)最後列=栞の席
        shioriSeat=desk;
        const note=box(.24,.02,.32,M({color:0xf6f8fa,roughness:.95}),-.08,.725,-.02);note.rotation.y=-.12;desk.add(note);
        const pen=cyl(.008,.008,.16,M({color:0x8a7ab8,roughness:.5}),.10,.725,.04,6);pen.rotation.z=Math.PI/2;pen.rotation.y=.5;desk.add(pen);
        const cord=createPurpleCordMotif();cord.attachTo(desk,{x:.16,y:.735,z:.06},.65);   // シャーペンの紐飾り
        desk.userData.cord=cord;
      }
    }
    // 窓列(x+側の壁に3枚、外は白く飛んだ春の光)
    for(let i=0;i<3;i++){const win=windowPane(1.5,1.35,0xf3f7fb);win.position.set(4.07,1.8,-1.8+i*1.9);win.rotation.y=-Math.PI/2;g.add(win);}
    // 蛍光灯2本
    for(let i=0;i<2;i++){const fl=new THREE.MeshBasicMaterial({color:0xf2f4ee});fl.__ownedByStory=true;
      g.add(noShadow(box(1.8,.04,.12,fl,-1.2+i*2.4,3.02,0,false)));}
    // 窓の外を舞う桜(ED1の春の朝)。薄桃色の小さな花びらが緩やかに落ちてループする
    const petalMat=new THREE.MeshBasicMaterial({color:0xf7cdd8,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false});petalMat.__ownedByStory=true;
    const petals=[];
    for(let i=0;i<8;i++){
      const pt=plane(.09,.06,petalMat,0,0,0);
      pt.userData={x0:4.28+Math.random()*.5,ph:Math.random()*6,fall:.16+Math.random()*.14,sw:.2+Math.random()*.3};
      pt.position.set(pt.userData.x0,2.4-Math.random()*3,-1.9+Math.random()*3.8);
      petals.push(noShadow(pt));g.add(pt);
    }
    let wakaTex=null;
    const api={group:g,anchor,shioriSeat,
      /* 黒板を平面図/和歌の板書に切替(EDの「御簾=隔てる/つなぐ」の書き足し等) */
      setBoard(mode,extraText){
        if(mode==="waka"||extraText){
          bx.fillStyle="rgba(39,66,54,.92)";bx.fillRect(330,120,178,66);
          bx.fillStyle="#f2ecd8";bx.font="16px 'Hiragino Mincho ProN',serif";
          bx.fillText(extraText||"御簾=隔てる/つなぐ",338,155);
          boardTex.needsUpdate=true;
        }
      },
      update(t){
        if(shioriSeat&&shioriSeat.userData.cord)shioriSeat.userData.cord.update(t);
        if(typeof REDUCED_MOTION!=="undefined"&&REDUCED_MOTION)return; // 静止配置のまま(初期位置)
        petals.forEach(pt=>{const u=pt.userData;
          pt.position.y=2.6-((t*u.fall+u.ph)%3.2);                    // 上端2.6→下端-0.6を落ち続けてループ
          pt.position.x=u.x0+Math.sin(t*u.sw+u.ph)*.13;              // 横にゆらめきながら舞う
          pt.rotation.z=t*u.sw+u.ph;pt.rotation.y=t*.6+u.ph;});
      }
    };
    g.userData.api=api;return api;
  }

  /* ============================================================
     E-3. ED5「ほどけた文字」の漂流 — 世界崩壊(ed5_world_break)の3D側の強化。
     崩し字風の縦線・かな断片を描いた板ポリを空間に散らし、逆さのままゆっくり漂わせる。
     生成のみここで担い、回転・上昇は runtime の storyUpdate が行う(userData を参照)。
     api: group / children[].userData={spin,rise,ph} を持つ
  ============================================================ */
  function createEd5GlyphDebris(count){
    count=count||12;
    const g=new THREE.Group();
    const frags=["いろは","ちりぬる","をわかよ","たれそつ","ねならむ","うゐのお"]; // ほどけていく手習い歌
    // CanvasTextureは数種を使い回す(枚数ぶん生成しない=低負荷)
    const mats=[];
    for(let k=0;k<3;k++){
      const c=document.createElement("canvas");c.width=64;c.height=168;const x=c.getContext("2d");
      x.clearRect(0,0,64,168);
      x.strokeStyle="rgba(38,26,20,.68)";x.lineWidth=2.2;x.lineCap="round";
      for(let i=0;i<3;i++){const bx=16+i*17;x.beginPath();x.moveTo(bx+(Math.random()-.5)*6,12); // ほどけた縦線(崩し字の名残)
        for(let y=22;y<156;y+=17)x.lineTo(bx+(Math.random()-.5)*13,y);x.stroke();}
      x.fillStyle="rgba(30,22,18,.82)";x.font="21px 'Hiragino Mincho ProN',serif";x.textAlign="center";x.textBaseline="middle";
      const frag=frags[(Math.random()*frags.length)|0];
      for(let i=0;i<frag.length&&i<4;i++)x.fillText(frag[i],32,30+i*36);
      const tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;
      const m=new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:.82,side:THREE.DoubleSide,depthWrite:false});m.__ownedByStory=true;mats.push(m);
    }
    for(let i=0;i<count;i++){
      const pl=new THREE.Mesh(new THREE.PlaneGeometry(.34,.86),mats[i%mats.length]);
      const a=i*Math.PI*2/count+Math.random()*.5,r=2.2+Math.random()*2.8;
      pl.position.set(Math.cos(a)*r,.4+Math.random()*2.7,Math.sin(a)*r);
      pl.rotation.z=Math.PI+(Math.random()-.5)*.6;      // 逆さに漂う
      pl.rotation.y=Math.random()*Math.PI*2;
      pl.userData={spin:(Math.random()-.5)*.5,rise:.12+Math.random()*.18,ph:Math.random()*6};
      noShadow(pl);g.add(pl);
    }
    const api={group:g};g.userData.api=api;return api;
  }

  /* ロケーション一括生成: kind→セット。story側は
     createStoryLocation("hospital") だけで部屋+カメラが揃う */
  function createStoryLocation(kind){
    if(kind==="hospital")return createHospitalRoomSet();
    if(kind==="classroom")return createClassroomSet();
    return null;
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
    cam_ch3_pond_dark:       {pos:[-6.5,1.7 ,22.5],look:[-12.0,0.2,28.5],fov:56}, // 池の汀・濁った水面を見下ろす
    cam_ch3_pond_moon:       {pos:[-7.0,1.35,23.5],look:[-14.0,3.2,34.0],fov:62}, // 澄んだ水面ごしに月の空へ
    /* 第4話: 正面性=儀式。判者の扇を画面中心に */
    cam_winter_utakai_hisashi:{pos:[ 0.0,1.75, 7.4],look:[ 0.0,1.5,-1.8],fov:48},
    cam_ch4_judge_close:     {pos:[ 0.8,1.6 , 1.2],look:[ 0.0,1.5,-1.8],fov:40},
    /* 第5話: 広角+俯瞰=邸全体が敵になる */
    cam_tokoyo_north_tainoya:{pos:[22.0,3.4 ,-38.0],look:[30.0,1.8,-48.0],fov:66},
    cam_ch5_oni_reveal:      {pos:[27.0,1.3 ,-42.0],look:[30.0,3.0,-48.0],fov:70},
    cam_ch5_overhead:        {pos:[30.0,14.0,-40.0],look:[30.0,0.0,-48.0],fov:60},
    /* 第6話: 静止画に近い長い間 */
    cam_ending_morning:      {pos:[ 0.2,1.6 , 8.8],look:[ 0.0,1.9,-2.0],fov:50},
    /* 別ロケーション(STORY_OFFSTAGE基準の絶対座標) */
    cam_hospital_bed:        {pos:[-257.6,1.50,240.6],look:[-258.8,0.95,238.7],fov:52}, // ベッドの栞を見下ろす
    cam_hospital_window:     {pos:[-258.2,1.30,237.8],look:[-263.0,1.70,239.4],fov:58}, // 朝光の窓へ
    cam_hospital_table:      {pos:[-259.0,1.05,239.0],look:[-259.5,0.68,238.45],fov:40}, // 波AA: 枕元のノートと薄紫の紐を寄って映す
    cam_hospital_door_pov:   {pos:[-257.2,1.55,242.2],look:[-258.8,1.00,238.7],fov:60}, // 入口から一望(秀頼の視点)
    cam_classroom_board:     {pos:[-260.0,1.50,301.8],look:[-260.0,1.60,296.8],fov:55}, // 黒板の平面図
    cam_classroom_shiori:    {pos:[-259.8,1.35,302.6],look:[-259.0,0.75,301.6],fov:50}, // 栞の席(肩越し)
    cam_classroom_tanzaku:   {pos:[-258.75,1.12,302.15],look:[-259.05,0.72,301.58],fov:38}, // ED1: 机上の白い短冊と薄紫の紐へ寄る
    cam_classroom_sleepy:    {pos:[-261.2,0.95,300.2],look:[-260.0,1.30,296.8],fov:62}  // 机に伏せた低い目線(1話冒頭)
  };

  /* ============ 公開 ============ */
  global.StoryObjects={
    MATS:STORY_MATS,
    textTexture,disposeGroup,makePool,
    createStoryKohagiObject,createStoryHidetoraObject,createStoryUkonObject,
    createMinisterObject,createUtakaiJudgeObject,
    createWhiteTanzakuObject,createTermCardObject,createWakaTanzakuObject,createPurpleCordMotif,
    createMisuBoundaryEffect,createTokoyoGlitchProps,createTokoyoSkyDome,createBrainErosionOverlay,createUtakaiStageProps,
    createGreatOniStoryObject,createNameSealEffect,createFinalQuizThreeSeals,
    createModernRoomShell,createHospitalRoomSet,createClassroomSet,createStoryLocation,createEd5GlyphDebris,
    STORY_OFFSTAGE,STORY_CAMERA_ANGLES
  };
})(typeof window!=="undefined"?window:globalThis);
