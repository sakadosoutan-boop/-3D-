/* ============================================================
   再現モード「徒然草 第七段 あだし野の露消ゆる時なく」（兼好法師）
   ------------------------------------------------------------
   ■ 構成
     - 本文は13場。各場(beat)に shots(カメラ割りの時系列)を持たせ、場の中でも
       遠景→接写のように自動でカットを重ねる(紙芝居の各コマ＝場、コマの中の映像＝shots)。
     - 舞台は寝殿造りの屋敷(原点)から遠く離れた「ゾーン」に組む。カメラの far(800m)の外なので
       屋敷・鳥・人物などは映り込まず、屋敷を隠す必要もない(光源数が変わらず再コンパイルも起きない)。
         adashi … あだし野(夜明けの露の野・卒塔婆)
         toribe … 鳥部山を望む夕暮れの野(火葬の煙・烏)
         an     … 双ヶ岡の草庵と庭・遣水(兼好)
         dew / semi / leaf / water … 接写用セット(実寸で作り MACRO_SCALE 倍して撮る)
         estate … 原点の寝殿造り(老人と孫の場)
     - 空・光・霧は SAIGEN_ENV_HOOK(本体 animate から毎フレーム呼ばれる)で場ごとに上書きする。
     - 素材は TSURE_INSECTS / TSURE_FIGURES / TSURE_AN / TSURE_NATURE / TSURE_FLORA / TSURE_TREES
       (src/app/tsurezure-*.js)。無い/失敗した場合は簡易形状で代替し、場の進行は止めない。
   ■ 音: 実録音のループ(semi_minmin=ミンミンゼミ, semi_chorus=遠い蝉時雨, kane_bonsho=梵鐘 ほか既存の環境音)。
     出典とライセンスは sounds/CREDITS.md。
   ============================================================ */
const SAIGEN_TSUREZURE=(()=>{
  if(typeof SAIGEN_SCENES==="undefined"||typeof SAIGEN_PROP_BUILDERS==="undefined"||typeof THREE==="undefined")return null;
  const SCENE_ID="tsurezure_adashino";
  const MACRO_SCALE=20;
  // ゾーンの原点(ワールド座標)。互いに2400m離し、far=800 の外に置く。
  const ZONES={
    estate:[0,0,0],
    adashi:[2400,0,0],
    toribe:[2400,0,2400],
    an:[0,0,2400],
    dew:[-2400,0,0],
    semi:[-2400,0,2400],
    leaf:[-2400,0,-2400],
    water:[0,0,-2400]
  };
  const V=(a)=>new THREE.Vector3(a[0],a[1],a[2]);
  const clamp01=(v)=>Math.max(0,Math.min(1,v));
  const ease=(u)=>{u=clamp01(u);return u*u*(3-2*u);};
  const lerp=(a,b,u)=>a+(b-a)*u;
  // const 宣言の素材モジュールは window に載らないため、名前で直接参照する
  const MODS=()=>({
    INS:(typeof TSURE_INSECTS!=="undefined")?TSURE_INSECTS:null,
    FIG:(typeof TSURE_FIGURES!=="undefined")?TSURE_FIGURES:null,
    AN:(typeof TSURE_AN!=="undefined")?TSURE_AN:null,
    NAT:(typeof TSURE_NATURE!=="undefined")?TSURE_NATURE:null,
    FLO:(typeof TSURE_FLORA!=="undefined")?TSURE_FLORA:null,
    TRE:(typeof TSURE_TREES!=="undefined")?TSURE_TREES:null
  });

  /* ---------- 品質 ---------- */
  function qualityKey(){
    try{
      if(window.LOW_POWER&&window.LOW_POWER.active)return "low";
      const lv=(typeof QUALITY!=="undefined"&&QUALITY&&QUALITY.level!=null)?QUALITY.level:0;
      if(lv>=2)return "low";
      if(lv===1||(typeof IS_TOUCH!=="undefined"&&IS_TOUCH))return "medium";
    }catch(e){}
    return "high";
  }

  /* ---------- 簡易代替(素材が無い時だけ使う) ---------- */
  const _fallbackMats=[];
  function fbMat(color,opts){const m=new THREE.MeshStandardMaterial(Object.assign({color,roughness:.85},opts||{}));_fallbackMats.push(m);return m;}
  function fbBox(w,h,d,color){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),fbMat(color));m.castShadow=true;m.receiveShadow=true;return m;}
  function fbGroup(label){const g=new THREE.Group();g.name="tsure-fallback-"+label;g.userData.dispose=()=>{g.traverse(o=>{if(o.geometry)o.geometry.dispose();});};return g;}
  function safeMake(label,fn,fallback){
    const t0=performance.now();
    try{const g=fn();if(g){const ms=performance.now()-t0;if(S.timing)S.timing[label]=(S.timing[label]||0)+ms;return g;}}catch(e){console.error("[tsurezure] "+label+" build failed:",e);}
    try{return fallback?fallback():fbGroup(label);}catch(e){return fbGroup(label);}
  }
  function fbFigure(color,h){const g=fbGroup("figure");const b=fbBox(.5,h*.55,.4,color);b.position.y=h*.28;g.add(b);
    const hd=new THREE.Mesh(new THREE.SphereGeometry(.12,16,12),fbMat(0xe3c39c));hd.position.y=h*.62;hd.castShadow=true;g.add(hd);return g;}

  /* ---------- 状態 ---------- */
  const S={
    active:false,stage:null,quality:"high",zones:{},zoneUpdaters:{},actors:{},assets:{},
    sky:null,beat:-1,shots:[],shotIdx:0,shotT:0,beatT:0,curZone:null,
    light:null,lightFrom:null,lightTo:null,lightU:1,lightDur:0,
    lamp:null,saved:null,loops:{},once:[],fovFrom:62,fovTo:62,
    shadowHalf:40,shadowCenter:new THREE.Vector3(),seasonAn:"autumn",timelapse:null,
    tmpV:new THREE.Vector3(),tmpV2:new THREE.Vector3(),tmpC:new THREE.Color()
  };

  /* ============================================================
     光の状態(場ごと)。形は TSURE_NATURE.SKY_PRESETS に合わせる:
       空シェーダーの値(zenith/horizon/hazeColor/ground=線形RGB配列, sunDir=[x,y,z] ほか)
       + sunLight{color,intensity,dir} hemi{sky,ground,intensity} ambient{color,intensity}
       + fog{color,density} exposure rim{color,intensity,dir} + hills/mist/smoke/water(各素材の色合い)
     自然モジュールが無い時だけ内蔵表(BUILTIN_LIGHT)から同じ形を作る。
  ============================================================ */
  const BUILTIN_LIGHT={
    autumnDawnMist:{sun:{color:0xffc896,intensity:1.05,dir:[.82,.16,.3]},hemi:{sky:0xc9c6d8,ground:0x6a5c48,intensity:.5},ambient:{color:0xb6b4cc,intensity:.16},fog:{color:0xe7d6c8,density:.010},exposure:1.0,horizon:0xf2cdb0},
    autumnDuskToribe:{sun:{color:0xff9a52,intensity:.9,dir:[-.95,.1,.12]},hemi:{sky:0x9a8fb8,ground:0x4a3a2e,intensity:.42},ambient:{color:0x8f88b8,intensity:.14},fog:{color:0xb59aa4,density:.0026},exposure:1.0,horizon:0xe7a989},
    autumnDay:{sun:{color:0xfff0d8,intensity:1.25,dir:[.5,.62,.6]},hemi:{sky:0xbfd2e6,ground:0x7a6a4e,intensity:.55},ambient:{color:0xf2ede4,intensity:.17},fog:{color:0xd8dfe4,density:.006},exposure:1.04,horizon:0xdbe6ec},
    earlySummerDay:{sun:{color:0xfff6e4,intensity:1.3,dir:[.4,.75,.5]},hemi:{sky:0xbcd9ee,ground:0x60704a,intensity:.58},ambient:{color:0xf1f2ea,intensity:.17},fog:{color:0xd4e2ea,density:.006},exposure:1.05,horizon:0xd7e7f0},
    earlySummerDusk:{sun:{color:0xffa04a,intensity:1.0,dir:[-.9,.12,.4]},hemi:{sky:0xd9a68a,ground:0x4c4030,intensity:.38},ambient:{color:0xc49478,intensity:.14},fog:{color:0xe0a878,density:.008},exposure:1.0,horizon:0xf3b06e},
    summerNoon:{sun:{color:0xfff8ee,intensity:1.4,dir:[.25,.9,.35]},hemi:{sky:0xb8d8f2,ground:0x5a6a3e,intensity:.6},ambient:{color:0xf4f4ee,intensity:.18},fog:{color:0xd6e6f0,density:.005},exposure:1.05,horizon:0xd2e6f2},
    nightMoon:{sun:{color:0x9fb4e8,intensity:.32,dir:[-.35,.62,.55]},hemi:{sky:0x3a4a78,ground:0x141820,intensity:.16},ambient:{color:0x7f90c0,intensity:.07},fog:{color:0x111a2e,density:.008},exposure:1.0,horizon:0x1d2a4a},
    predawnBlue:{sun:{color:0xc8b4d8,intensity:.45,dir:[.85,.08,.3]},hemi:{sky:0x8f9fc8,ground:0x2e2c34,intensity:.3},ambient:{color:0x9aa2c8,intensity:.1},fog:{color:0x9aa4c4,density:.008},exposure:1.0,horizon:0xd8b4b0},
    winterDay:{sun:{color:0xf4f2f0,intensity:1.0,dir:[.5,.45,.6]},hemi:{sky:0xcfd8e6,ground:0x8a8a8a,intensity:.6},ambient:{color:0xe6eaf2,intensity:.2},fog:{color:0xdfe4ea,density:.010},exposure:1.04,horizon:0xe4e8ee},
    springDay:{sun:{color:0xfff2e0,intensity:1.2,dir:[.45,.6,.6]},hemi:{sky:0xc8dcef,ground:0x6f7550,intensity:.56},ambient:{color:0xf6efe8,intensity:.18},fog:{color:0xe2e6ec,density:.007},exposure:1.05,horizon:0xe6e8ee}
  };
  function cloneDeep(o){
    if(Array.isArray(o))return o.map(cloneDeep);
    if(o&&typeof o==="object"){if(o.isVector3||o.isColor)return o.clone();const r={};Object.keys(o).forEach(k=>{r[k]=cloneDeep(o[k]);});return r;}
    return o;
  }
  const arr3=(d)=>Array.isArray(d)?d.slice(0,3):(d&&d.isVector3?[d.x,d.y,d.z]:[0,1,0]);
  function presetState(name,over){
    const NAT=MODS().NAT;
    let st;
    if(NAT&&NAT.SKY_PRESETS&&NAT.SKY_PRESETS[name])st=cloneDeep(NAT.SKY_PRESETS[name]);
    else{
      const b=BUILTIN_LIGHT[name]||BUILTIN_LIGHT.autumnDay;
      st={horizon:b.horizon,sunDir:b.sun.dir.slice(),sunLight:{color:b.sun.color,intensity:b.sun.intensity,dir:b.sun.dir.slice()},
        hemi:Object.assign({},b.hemi),ambient:Object.assign({},b.ambient),fog:Object.assign({},b.fog),exposure:b.exposure,rim:{color:0xd8e4ff,intensity:.12}};
    }
    if(!st.sunLight)st.sunLight={color:0xffffff,intensity:1,dir:arr3(st.sunDir)};
    if(!st.sunDir)st.sunDir=arr3(st.sunLight.dir);
    if(over){
      if(over.sun){
        if(over.sun.color!=null)st.sunLight.color=over.sun.color;
        if(over.sun.intensity!=null)st.sunLight.intensity=over.sun.intensity;
        if(over.sun.dir){const d=V(arr3(over.sun.dir)).normalize();st.sunLight.dir=[d.x,d.y,d.z];st.sunDir=[d.x,d.y,d.z];}
      }
      ["hemi","ambient","fog","rim"].forEach(k=>{if(over[k])st[k]=Object.assign({},st[k]||{},over[k]);});
      if(over.exposure!=null)st.exposure=over.exposure;
      if(over.sky)Object.keys(over.sky).forEach(k=>{st[k]=cloneDeep(over.sky[k]);});
    }
    return st;
  }
  // 内蔵表どうしの補間(自然モジュールがある時は NAT.blendPresets を使う)
  const COLOR_KEY=/^(color|sky|ground|near|far|light|glow|horizon|zenith)$/;
  const _mc1=new THREE.Color(),_mc2=new THREE.Color();
  function mixState(a,b,u,key){
    if(typeof a==="number"&&typeof b==="number"){
      if(key&&COLOR_KEY.test(key))return _mc1.setHex(a).lerp(_mc2.setHex(b),u).getHex();
      return lerp(a,b,u);
    }
    if(Array.isArray(a)&&Array.isArray(b))return a.map((v,i)=>lerp(v,b[i]!==undefined?b[i]:v,u));
    if(a&&b&&typeof a==="object"&&typeof b==="object"){const o={};new Set([...Object.keys(a),...Object.keys(b)]).forEach(k=>{o[k]=(k in a&&k in b)?mixState(a[k],b[k],u,k):(k in a?a[k]:b[k]);});return o;}
    return u<.5?a:b;
  }
  function blendState(a,b,u){
    const NAT=MODS().NAT;
    if(NAT&&typeof NAT.blendPresets==="function"){try{const o=NAT.blendPresets(a,b,u);
      // 補間後の方向ベクトルは正規化(sunLight.dir/rim.dir も)
      ["sunLight","rim"].forEach(k=>{if(o[k]&&o[k].dir){const d=V(o[k].dir).normalize();o[k].dir=[d.x,d.y,d.z];}});
      return o;}catch(e){}}
    const o=mixState(a,b,u);
    if(o.sunDir){const d=V(o.sunDir).normalize();o.sunDir=[d.x,d.y,d.z];}
    return o;
  }
  function setLight(state,dur){
    S.lightDirty=true;
    if(!dur||!S.light){S.light=state;S.lightFrom=null;S.lightTo=null;S.lightU=1;return;}
    S.lightFrom=S.light;S.lightTo=state;S.lightU=0;S.lightDur=dur;
  }

  /* ============================================================
     ゾーンの組み立て
  ============================================================ */
  function zoneGroup(name){
    const g=new THREE.Group();g.name="tsure-zone-"+name;const o=ZONES[name];g.position.set(o[0],o[1],o[2]);
    g.visible=false;S.stage.add(g);S.zones[name]=g;S.zoneUpdaters[name]=[];return g;
  }
  function track(zone,obj){if(obj&&obj.userData&&typeof obj.userData.update==="function")S.zoneUpdaters[zone].push(obj);return obj;}
  function own(obj){if(obj)(S.assets.list||(S.assets.list=[])).push(obj);return obj;}

  // 地形の高さ関数(ゾーン局所座標)
  function hAdashi(x,z){return .55*Math.sin(x*.045+.6)*Math.cos(z*.038)+.35*Math.sin((x+z)*.09)+(z<-60?Math.pow((-z-60)*.06,1.6):0);}
  function hToribe(x,z){return .4*Math.sin(x*.05)*Math.cos(z*.04)+(x>40?Math.pow((x-40)*.03,1.4):0)-(x<-30?0:0);}
  const AN_STREAM=[[-34,0,10.5],[-22,0,9.0],[-12,0,10.2],[-4,0,8.6],[4,0,9.4],[12,0,8.2],[22,0,9.6],[34,0,8.8]];
  function anStreamZ(x){ // 遣水の中心線(z)を x から近似
    for(let i=0;i<AN_STREAM.length-1;i++){const a=AN_STREAM[i],b=AN_STREAM[i+1];if(x>=a[0]&&x<=b[0]){const u=(x-a[0])/(b[0]-a[0]);return lerp(a[2],b[2],ease(u));}}
    return x<AN_STREAM[0][0]?AN_STREAM[0][2]:AN_STREAM[AN_STREAM.length-1][2];
  }
  // 草庵の敷地は平らに均す(床下・縁・沓脱石が地面に正しく接するように)
  const AN_PAD_Y=0.05;
  function anPadWeight(x,z){
    const dx=Math.max(0,Math.abs(x-.25)-2.9),dz=Math.max(0,Math.abs(z-.35)-2.9);
    const d=Math.hypot(dx,dz);return d<=0?1:Math.max(0,1-d/2.2);
  }
  function hAn(x,z){
    const w=anPadWeight(x,z);
    const raw=hAnRaw(x,z);
    return raw+(AN_PAD_Y-raw)*(w*w*(3-2*w));
  }
  function hAnRaw(x,z){
    let h=0;
    if(z<-6)h+=Math.pow((-z-6)*.11,1.35);           // 北(背後)は双ヶ岡の斜面
    h+=.18*Math.sin(x*.21)*Math.cos(z*.17)+.12*Math.sin(x*.07+z*.05);
    if(z>2)h-=Math.min(.35,(z-2)*.05);               // 南へゆるく下る
    const dz=z-anStreamZ(x),w=Math.abs(dz);           // 遣水の溝
    if(w<2.6)h-=.62*Math.pow(1-w/2.6,1.6);
    return h;
  }
  const STREAM_Y=-0.42; // 遣水の水面(局所)

  function buildSky(){
    const NAT=MODS().NAT;
    S.sky=safeMake("sky",()=>NAT&&NAT.makeSky?NAT.makeSky({radius:700,quality:S.quality}):null,()=>{
      const m=new THREE.Mesh(new THREE.SphereGeometry(700,32,16),new THREE.MeshBasicMaterial({color:0x9fb8d8,side:THREE.BackSide,fog:false,depthWrite:false}));
      m.renderOrder=-10;m.frustumCulled=false;m.userData.setState=(st)=>{if(st&&typeof st.horizon==="number")m.material.color.setHex(st.horizon);else if(st&&st.fog)m.material.color.setHex(st.fog.color);};
      m.userData.update=(dt,t,cam)=>{if(cam)m.position.copy(cam.position);};m.userData.dispose=()=>{m.geometry.dispose();m.material.dispose();};return m;});
    S.sky.name="tsure-sky";S.sky.visible=false;S.stage.add(S.sky);own(S.sky);
  }

  function buildAdashi(){
    const z=zoneGroup("adashi"),M=MODS(),q=S.quality;
    const terrain=safeMake("adashi-terrain",()=>M.NAT&&M.NAT.makeTerrain?M.NAT.makeTerrain({size:320,segments:q==="low"?96:q==="medium"?160:220,heightAt:hAdashi,quality:q}):null,
      ()=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(320,320,1,1),fbMat(0x6d6a48));m.rotation.x=-Math.PI/2;m.receiveShadow=true;const g=fbGroup("terrain");g.add(m);return g;});
    if(terrain.userData&&terrain.userData.setSeason)terrain.userData.setSeason("autumn");
    z.add(own(terrain));
    const grass=safeMake("adashi-grass",()=>M.FLO&&M.FLO.makeGrassField?M.FLO.makeGrassField({width:150,depth:150,center:[0,-10],heightAt:hAdashi,season:"autumn",dew:true,quality:q}):null,()=>fbGroup("grass"));
    if(grass.userData&&grass.userData.setDew)grass.userData.setDew(1);
    z.add(own(track("adashi",grass)));S.assets.adashiGrass=grass;
    const mist=safeMake("adashi-mist",()=>M.NAT&&M.NAT.makeMist?M.NAT.makeMist({width:170,depth:170,height:1.6,density:.7,color:0xf3e0cf,quality:q}):null,()=>fbGroup("mist"));
    z.add(own(track("adashi",mist)));S.assets.adashiMist=mist;
    // 卒塔婆と五輪塔(葬送の野。遺骸は描かない)
    const graves=[
      ["sotoba",-3.2,-16,1.7,.15,1],["sotoba",-2.4,-16.6,1.45,.25,2],["sotoba",-1.6,-15.8,1.9,.6,3],["sotoba",2.6,-21,1.6,.4,4],
      ["sotoba",3.4,-21.5,1.3,.8,5],["sotoba",-8.5,-27,1.8,.5,6],["sotoba",9.2,-31,1.5,.7,7],["sotoba",-14,-38,1.6,.6,8],
      ["gorin",.4,-18.6,.95,.6,11],["gorin",5.4,-24,.8,.8,12],["gorin",-6.8,-25.2,.7,.9,13],
      ["pile",-.6,-14.2,0,0,21],["pile",1.8,-17.8,0,0,22],["pile",-4.6,-20.2,0,0,23],["pile",6.6,-27.5,0,0,24]
    ];
    graves.forEach(gr=>{
      const [kind,x,zz,h,age,seed]=gr;let o=null;
      if(kind==="sotoba")o=safeMake("sotoba",()=>M.NAT&&M.NAT.makeSotoba?M.NAT.makeSotoba({height:h,age,seed,quality:"low"}):null,()=>{const g=fbGroup("sotoba");const b=fbBox(.12,h,.02,0x8a7a62);b.position.y=h/2;g.add(b);return g;});
      else if(kind==="gorin")o=safeMake("gorin",()=>M.NAT&&M.NAT.makeGorintou?M.NAT.makeGorintou({height:h,moss:age,seed}):null,()=>{const g=fbGroup("gorin");const b=fbBox(.35,h,.35,0x8a8a84);b.position.y=h/2;g.add(b);return g;});
      else o=safeMake("pile",()=>M.NAT&&M.NAT.makeStonePile?M.NAT.makeStonePile({seed}):null,()=>fbGroup("pile"));
      o.position.set(x,hAdashi(x,zz)-.02,zz);o.rotation.y=(seed*1.37)%(Math.PI*2)*.25-.4;
      if(kind==="sotoba"){o.rotation.z=((seed*7)%5-2)*.025;o.rotation.x=((seed*3)%5-2)*.02;}
      z.add(own(o));
    });
    // 遠山(愛宕山・小倉山・東山の連なり)
    const hills=safeMake("adashi-hills",()=>M.NAT&&M.NAT.makeHills?M.NAT.makeHills({center:[0,0],quality:q,ridges:[
      {distance:260,height:36,arcStart:-2.6,arcEnd:-0.4,color:0x5b6a74,seed:3,roughness:.6,forest:true},
      {distance:420,height:70,arcStart:-3.0,arcEnd:0.3,color:0x7f8fa4,seed:7,roughness:.5,forest:true},
      {distance:560,height:110,arcStart:-2.4,arcEnd:-0.9,color:0x9aa8bc,seed:11,roughness:.45,forest:false},
      {distance:520,height:46,arcStart:0.3,arcEnd:3.0,color:0x9eabbd,seed:17,roughness:.5,forest:false}]}):null,()=>fbGroup("hills"));
    z.add(own(track("adashi",hills)));S.assets.adashiHills=hills;
    // 野の松(点景)
    const pines=[[-26,-44,7.5,.2,31],[31,-58,9,.1,32],[-48,-70,8,.15,33]];
    pines.forEach((p,pi)=>{const t=safeMake("adashi-pine",()=>M.TRE&&M.TRE.makePine?M.TRE.makePine({height:p[2],lean:p[3],seed:p[4],quality:(q==="high"&&pi===0)?"medium":"low"}):null,()=>fbGroup("pine"));
      t.position.set(p[0],hAdashi(p[0],p[1]),p[1]);if(t.userData&&t.userData.setSeason)t.userData.setSeason("autumn");z.add(own(track("adashi",t)));});
  }

  function buildToribe(){
    const z=zoneGroup("toribe"),M=MODS(),q=S.quality;
    const terrain=safeMake("toribe-terrain",()=>M.NAT&&M.NAT.makeTerrain?M.NAT.makeTerrain({size:300,segments:q==="low"?80:q==="medium"?130:180,heightAt:hToribe,quality:q}):null,
      ()=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(300,300),fbMat(0x5a5a40));m.rotation.x=-Math.PI/2;const g=fbGroup("terrain");g.add(m);return g;});
    if(terrain.userData&&terrain.userData.setSeason)terrain.userData.setSeason("autumn");
    z.add(own(terrain));
    const grass=safeMake("toribe-grass",()=>M.FLO&&M.FLO.makeGrassField?M.FLO.makeGrassField({width:70,depth:60,center:[-6,0],heightAt:hToribe,season:"autumn",dew:false,quality:q==="high"?"medium":"low"}):null,()=>fbGroup("grass"));
    z.add(own(track("toribe",grass)));
    [[3,-2,1.6,.5,41],[4.1,-1.3,1.35,.7,42],[2.2,-3.1,1.8,.3,43]].forEach(s=>{
      const o=safeMake("sotoba",()=>M.NAT&&M.NAT.makeSotoba?M.NAT.makeSotoba({height:s[2],age:s[3],seed:s[4],quality:"medium"}):null,()=>{const g=fbGroup("sotoba");const b=fbBox(.12,s[2],.02,0x6a5a48);b.position.y=s[2]/2;g.add(b);return g;});
      o.position.set(s[0],hToribe(s[0],s[1]),s[1]);o.rotation.y=.4+s[4]*.1;o.rotation.z=(s[4]%3-1)*.04;z.add(own(o));});
    // 東山(鳥部山)の稜線: カメラは西から東(+x)を望む
    const hills=safeMake("toribe-hills",()=>M.NAT&&M.NAT.makeHills?M.NAT.makeHills({center:[0,0],quality:q,ridges:[
      {distance:230,height:42,arcStart:-0.75,arcEnd:0.75,color:0x4c4a62,seed:21,roughness:.55,forest:true},
      {distance:380,height:78,arcStart:-0.95,arcEnd:0.6,color:0x6f6a8a,seed:23,roughness:.5,forest:true},
      {distance:560,height:120,arcStart:-1.2,arcEnd:-0.2,color:0x8f88a8,seed:29,roughness:.42,forest:false}]}):null,()=>fbGroup("hills"));
    hills.rotation.y=-Math.PI/2; // 弧の中心(-z)を +x(東)へ向ける
    z.add(own(track("toribe",hills)));S.assets.toribeHills=hills;
    const smoke=safeMake("toribe-smoke",()=>M.NAT&&M.NAT.makeSmokePlume?M.NAT.makeSmokePlume({height:52,wind:[-.15,.55],color:0xb8b0b4,quality:q}):null,()=>fbGroup("smoke"));
    smoke.position.set(224,15,-10); // 稜線(x≈230 の山影)の手前の斜面から立ち、稜線を越えて空へなびく
    z.add(own(track("toribe",smoke)));S.assets.smoke=smoke;
    const crows=safeMake("toribe-crows",()=>M.NAT&&M.NAT.makeCrows?M.NAT.makeCrows({count:q==="low"?5:8,center:[70,34,-30],dir:[.92,.38],spread:22,speed:9,quality:q}):null,()=>fbGroup("crows"));
    z.add(own(track("toribe",crows)));S.assets.crows=crows;
    // 野中の一本松(中景の点景。遠景の稜線との距離感を出す。望遠の画角には入らない位置)
    const tree=safeMake("toribe-pine",()=>M.TRE&&M.TRE.makePine?M.TRE.makePine({height:8.5,lean:.32,seed:51,quality:"low"}):null,()=>fbGroup("pine"));
    tree.position.set(58,hToribe(58,20),20);tree.rotation.y=2.2;if(tree.userData&&tree.userData.setSeason)tree.userData.setSeason("autumn");z.add(own(track("toribe",tree)));
  }

  function buildAn(){
    const z=zoneGroup("an"),M=MODS(),q=S.quality;
    const terrain=safeMake("an-terrain",()=>M.NAT&&M.NAT.makeTerrain?M.NAT.makeTerrain({size:260,segments:q==="low"?100:q==="medium"?150:190,heightAt:hAn,quality:q}):null,
      ()=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(260,260),fbMat(0x5f6a40));m.rotation.x=-Math.PI/2;const g=fbGroup("terrain");g.add(m);return g;});
    z.add(own(terrain));S.assets.anTerrain=terrain;
    const hutY=AN_PAD_Y;
    const hut=safeMake("an-hut",()=>M.AN&&M.AN.makeAn?M.AN.makeAn({quality:q}):null,()=>{const g=fbGroup("hut");const f=fbBox(3.2,.5,3.4,0x7a6a52);f.position.y=.25;g.add(f);const r=fbBox(4.6,.3,4.6,0x5a4e40);r.position.y=2.8;g.add(r);
      g.userData.anchors={};return g;});
    hut.position.set(0,hutY,0);z.add(own(track("an",hut)));S.assets.hut=hut;
    const A=(hut.userData&&hut.userData.anchors)||{};
    const anc=(k,def)=>{const a=A[k];if(a&&a.position){const p=a.position.clone();return {pos:p,rotY:(a.rotation?a.rotation.y:0)};}return {pos:V(def),rotY:0};};
    S.assets.anc={seat:anc("seat",[0,.56,1.2]),seatInside:anc("seatInside",[-.3,.56,-.2]),desk:anc("desk",[0,.5,1.62]),deskInside:anc("deskInside",[-.3,.5,.25]),
      lamp:anc("lamp",[-.95,.5,-.1]),armrest:anc("armrest",[.08,.5,-.2]),stepFront:anc("stepFront",[0,0,2.4]),basin:anc("basin",[1.4,.5,1.9])};
    // 遣水と水鏡
    const pts=AN_STREAM.map(p=>[p[0],STREAM_Y,anStreamZ(p[0])]);
    const stream=safeMake("an-stream",()=>M.NAT&&M.NAT.makeStream?M.NAT.makeStream({points:pts,width:1.7,quality:q==="high"?"medium":"low"}):null,()=>{const g=fbGroup("stream");return g;});
    z.add(own(track("an",stream)));S.assets.stream=stream;
    const pool=safeMake("an-mirror",()=>M.NAT&&M.NAT.makeMirrorWater?M.NAT.makeMirrorWater({width:2.6,depth:1.8,resolution:q==="low"?256:512,quality:q}):null,()=>fbGroup("mirror"));
    const poolX=7.5,poolZ=anStreamZ(7.5)-.2;
    pool.position.set(poolX,STREAM_Y+.015,poolZ);z.add(own(track("an",pool)));S.assets.pool=pool;
    S.assets.poolInfo={x:poolX,z:poolZ,y:STREAM_Y};
    // 庭の草
    const grass=safeMake("an-grass",()=>M.FLO&&M.FLO.makeGrassField?M.FLO.makeGrassField({width:90,depth:70,center:[0,6],heightAt:hAn,season:"autumn",dew:true,quality:q==="high"?"medium":"low",
      mask:(x,zz)=>{const nearHut=Math.abs(x)<3.4&&zz>-3.2&&zz<3.6;if(nearHut)return 0;const w=Math.abs(zz-anStreamZ(x));if(w<1.1)return 0;if(Math.abs(x-poolX)<2.2&&Math.abs(zz-poolZ)<1.6)return 0;return w<2.2?.55:1;}}):null,()=>fbGroup("grass"));
    z.add(own(track("an",grass)));S.assets.anGrass=grass;
    // 木々: 庵に覆いかぶさる松・遣水の楓・山桜・背後の竹林・萩
    const T=(label,fn,x,zz,season)=>{const t=safeMake(label,fn,()=>fbGroup(label));t.position.set(x,hAn(x,zz),zz);if(t.userData&&t.userData.setSeason)t.userData.setSeason(season||"autumn");z.add(own(track("an",t)));(S.assets.trees||(S.assets.trees=[])).push(t);return t;};
    S.assets.pine=T("an-pine",()=>M.TRE&&M.TRE.makePine?M.TRE.makePine({height:7.5,lean:.32,seed:61,quality:q}):null,3.6,-1.2);
    if(S.assets.pine)S.assets.pine.rotation.y=-2.3;
    T("an-maple1",()=>M.TRE&&M.TRE.makeMaple?M.TRE.makeMaple({height:4.6,seed:62,quality:q==="high"?"medium":"low"}):null,-6.2,6.4);
    T("an-maple2",()=>M.TRE&&M.TRE.makeMaple?M.TRE.makeMaple({height:3.8,seed:63,quality:q==="high"?"medium":"low"}):null,9.6,6.0);
    T("an-maple3",()=>M.TRE&&M.TRE.makeMaple?M.TRE.makeMaple({height:5.2,seed:64,quality:"low"}):null,-15,12.5);
    T("an-cherry",()=>M.TRE&&M.TRE.makeCherry?M.TRE.makeCherry({height:6.4,seed:65,quality:q==="high"?"medium":"low"}):null,-10.5,-3.5);
    T("an-bamboo",()=>M.TRE&&M.TRE.makeBambooGrove?M.TRE.makeBambooGrove({width:18,depth:4.5,height:9.5,seed:66,quality:"low"}):null,1,-11.5);
    T("an-hagi1",()=>M.TRE&&M.TRE.makeHagi?M.TRE.makeHagi({seed:67,quality:q}):null,-3.4,3.6);
    T("an-hagi2",()=>M.TRE&&M.TRE.makeHagi?M.TRE.makeHagi({seed:68,quality:q}):null,4.6,4.4);
    // 遠景の木立(双ヶ岡の森)
    [[-24,-14,7],[18,-16,8],[-32,2,7.5],[36,10,7]].forEach((p,i)=>T("an-bgpine"+i,()=>M.TRE&&M.TRE.makePine?M.TRE.makePine({height:p[2],lean:.12,seed:70+i,quality:"low"}):null,p[0],p[1]));
    // 柴垣
    const fence=safeMake("an-fence",()=>M.AN&&M.AN.makeShibagaki?M.AN.makeShibagaki({length:6,height:1.1}):null,()=>fbGroup("fence"));
    fence.position.set(-7.2,hAn(-7.2,-1),-1);fence.rotation.y=Math.PI/2;z.add(own(fence));
    // 遠山(嵐山・愛宕山)
    const hills=safeMake("an-hills",()=>M.NAT&&M.NAT.makeHills?M.NAT.makeHills({center:[0,0],quality:q,ridges:[
      {distance:300,height:48,arcStart:-0.9,arcEnd:0.9,color:0x6d7e86,seed:81,roughness:.55,forest:true},
      {distance:470,height:96,arcStart:-1.6,arcEnd:0.2,color:0x93a2b2,seed:83,roughness:.5,forest:true},
      {distance:420,height:58,arcStart:2.2,arcEnd:4.0,color:0x8a9aaa,seed:87,roughness:.5,forest:true}]}):null,()=>fbGroup("hills"));
    hills.rotation.y=Math.PI; // 弧を南(+z)側へ
    z.add(own(track("an",hills)));S.assets.anHills=hills;
    // 調度: 文机・燈台・円座・脇息
    const desk=safeMake("an-desk",()=>M.AN&&M.AN.makeFuzukue?M.AN.makeFuzukue({quality:q}):null,()=>{const g=fbGroup("desk");const b=fbBox(.75,.04,.36,0x5a3e28);b.position.y=.31;g.add(b);return g;});
    const lamp=safeMake("an-lamp",()=>M.AN&&M.AN.makeToudai?M.AN.makeToudai({quality:q}):null,()=>{const g=fbGroup("lamp");const b=fbBox(.05,.8,.05,0x111111);b.position.y=.4;g.add(b);const f=new THREE.Object3D();f.position.y=.86;g.add(f);g.userData.flame=f;return g;});
    const enza=safeMake("an-enza",()=>M.AN&&M.AN.makeEnza?M.AN.makeEnza():null,()=>fbGroup("enza"));
    const enza2=safeMake("an-enza2",()=>M.AN&&M.AN.makeEnza?M.AN.makeEnza():null,()=>fbGroup("enza"));
    const arm=safeMake("an-armrest",()=>M.AN&&M.AN.makeKyousoku?M.AN.makeKyousoku():null,()=>fbGroup("armrest"));
    [desk,lamp,enza,enza2,arm].forEach(o=>{hut.add(own(o));track("an",o);});
    S.assets.desk=desk;S.assets.lamp=lamp;S.assets.enza=enza;S.assets.enza2=enza2;S.assets.armrest=arm;
    // 季節の粒子(紅葉・花びら・雪)
    const P=(kind)=>{const p=safeMake("an-"+kind,()=>M.TRE&&M.TRE.makeFallingParticles?M.TRE.makeFallingParticles({kind,width:26,height:12,depth:22,quality:q}):null,()=>fbGroup(kind));
      p.position.set(0,hAn(0,3),3);p.visible=false;if(p.userData&&p.userData.setActive)p.userData.setActive(false);z.add(own(track("an",p)));return p;};
    S.assets.leaves=P("maple");S.assets.petals=P("petals");S.assets.snow=P("snow");
    S.assets.kenko={}; // 兼好の姿勢は場で必要になった時に作る(buildKenko)
  }
  // 兼好(姿勢ごとに用意し、場ごとに一体だけ見せる)
  function buildKenko(pose){
    const M=MODS(),q=S.quality,z=S.zones.an;if(!z)return;
    const f=safeMake("kenko-"+pose,()=>M.FIG&&M.FIG.makeKenko?M.FIG.makeKenko({pose,seatY:.06,quality:q}):null,()=>fbFigure(0x2c2a28,.95));
    f.visible=false;f.userData.saigenCustom=true;f.userData.cname="兼好法師";f.userData.label="兼好法師";f.userData.labelY=(pose==="kneel")?1.25:1.35;f.userData.bubbleY=1.1;f.userData.hideLabel=true;
    track("an",f);own(f);z.add(f);S.assets.kenko[pose]=f;
  }

  // 接写セット(実寸で作って MACRO_SCALE 倍)。虫は止まり場所(perch: +Y=面の法線, +Z=幹の上/葉先/頭の向き)に載せる
  function macroSet(zone,label,fn){const z=zoneGroup(zone);const set=safeMake(label,fn,()=>{const g=fbGroup(label);const b=fbBox(.1,.01,.02,0x5a7a3a);g.add(b);return g;});
    set.scale.setScalar(MACRO_SCALE);z.add(own(track(zone,set)));return set;}
  const perchOn=(set,obj)=>{const p=set.userData&&set.userData.perch;(p||set).add(obj);return obj;};
  function buildDewSet(){const M=MODS();S.assets.dewSet=macroSet("dew","dew-set",()=>M.FLO&&M.FLO.makeDewMacroSet?M.FLO.makeDewMacroSet({style:"dawn",quality:S.quality}):null);}
  function buildSemiSet(){const M=MODS(),q=S.quality;
    S.assets.barkSet=macroSet("semi","bark-set",()=>M.FLO&&M.FLO.makeBarkMacroSet?M.FLO.makeBarkMacroSet({species:"sakura",quality:q}):null);
    S.assets.cicada=perchOn(S.assets.barkSet,own(track("semi",safeMake("cicada",()=>M.INS&&M.INS.makeMinminZemi?M.INS.makeMinminZemi({quality:q==="high"?"medium":q}):null,
      ()=>{const g=fbGroup("cicada");const b=fbBox(.012,.012,.035,0x1a2a20);b.position.y=.008;g.add(b);return g;}))));}
  function buildLeafSet(){const M=MODS(),q=S.quality;
    S.assets.leafSet=macroSet("leaf","leaf-set",()=>M.FLO&&M.FLO.makeLeafMacroSet?M.FLO.makeLeafMacroSet({style:"dusk",quality:q}):null);
    S.assets.mayflyRest=perchOn(S.assets.leafSet,own(track("leaf",safeMake("mayfly-rest",()=>M.INS&&M.INS.makeMonKagerou?M.INS.makeMonKagerou({pose:"rest",quality:q}):null,
      ()=>{const g=fbGroup("mayfly");const b=fbBox(.003,.003,.018,0xa08050);b.position.y=.004;g.add(b);return g;}))));}
  function buildWaterSet(){const M=MODS(),q=S.quality;
    S.assets.waterSet=macroSet("water","water-set",()=>M.FLO&&M.FLO.makeWaterMacroSet?M.FLO.makeWaterMacroSet({quality:q}):null);
    S.assets.mayflySpent=perchOn(S.assets.waterSet,own(track("water",safeMake("mayfly-spent",()=>M.INS&&M.INS.makeMonKagerou?M.INS.makeMonKagerou({pose:"spent",quality:q}):null,()=>fbGroup("mayfly")))));
    // 奥の水面にも力尽きたカゲロウ(ぼけて見える)
    ((S.assets.waterSet.userData&&S.assets.waterSet.userData.perches)||[]).slice(1).forEach((p,i)=>{
      const m=safeMake("mayfly-far",()=>M.INS&&M.INS.makeMonKagerou?M.INS.makeMonKagerou({pose:"spent",quality:"low",seed:31+i}):null,()=>fbGroup("mayfly"));p.add(own(track("water",m)));});}
  // 夕暮れの流れの上で群れ舞うカゲロウ(草庵の遣水)
  function buildSwarm(){const M=MODS(),q=S.quality;if(!S.zones.an)return;
    const sw=safeMake("mayfly-swarm",()=>M.INS&&M.INS.makeMayflySwarm?M.INS.makeMayflySwarm({count:q==="low"?24:q==="medium"?40:60,radius:2.2,height:2.6,quality:q}):null,()=>fbGroup("swarm"));
    sw.position.set(-3.6,STREAM_Y+.35,anStreamZ(-3.6));S.zones.an.add(own(track("an",sw)));S.assets.swarm=sw;sw.visible=false;}

  function buildEstateBase(){
    const z=zoneGroup("estate"),M=MODS(),q=S.quality;
    z.visible=true; // 原点の屋敷そのもの。自前の人物と灯だけを置く
    const gy=(x,zz)=>(typeof groundH==="function")?groundH(x,zz):0;
    S.assets.roujin={};
    // 外出を待つ従者(既存の平安人物モデル。遠景の点景として)
    S.assets.attendants=[];
    if(typeof makeHeianFigure==="function"){
      [[[-0.9,0,9.6],2.7,[0x6b5a3a,0x8a7652,0xb9a77a]],[[0.7,0,10.1],-2.9,[0x3f4a3a,0x5b6650,0xa89a6a]]].forEach(a=>{
        try{const f=makeHeianFigure({role:"kikoshi",pose:"standing",palette:a[2],scale:.94,prop:null});
          f.position.set(a[0][0],gy(a[0][0],a[0][2]),a[0][2]);f.rotation.y=a[1];f.visible=false;z.add(f);S.assets.attendants.push(f);}catch(e){console.error("[tsurezure] attendant:",e);}
      });
    }
    // 屋敷の場の灯(宝を数える夜)
    const lamp=safeMake("estate-lamp",()=>M.AN&&M.AN.makeToudai?M.AN.makeToudai({quality:q}):null,()=>{const g=fbGroup("lamp");const f=new THREE.Object3D();f.position.y=.86;g.add(f);g.userData.flame=f;return g;});
    lamp.visible=false;z.add(own(track("estate",lamp)));S.assets.estateLamp=lamp;
    // 配置(寝殿の南の簀子・廂。座標は屋敷のワールド座標=ゾーン原点)
    S.assets.estatePos={
      walkFrom:[-6.2,gy(-6.2,5.4),5.4],walkTo:[1.8,gy(1.8,5.4),5.4],
      hold:[2.6,gy(2.6,5.2),5.2],play:[3.5,gy(3.5,5.7),5.7],
      count:[-1.2,gy(-1.2,0.6),0.6],lamp:[-0.35,gy(-0.35,0.2),0.2]
    };
  }
  function buildRoujin(pose){
    const M=MODS(),q=S.quality,z=S.zones.estate;if(!z)return;
    const f=safeMake("roujin-"+pose,()=>M.FIG&&M.FIG.makeRoujin?M.FIG.makeRoujin({pose,quality:q}):null,()=>fbFigure(0x5a3a6a,pose==="walk"?1.6:1.0));
    f.visible=false;f.userData.saigenCustom=true;f.userData.cname="老人";f.userData.label="老いた貴族";f.userData.labelY=(pose==="walk")?2.05:1.45;f.userData.bubbleY=1.6;f.userData.hideLabel=true;
    z.add(own(track("estate",f)));S.assets.roujin[pose]=f;
    if(pose==="hold"){ // 膝に抱かれた孫娘
      const c=makeMagoFig("held","girl",3,"孫");const lap=f.userData&&f.userData.lapAnchor;(lap||f).add(c);c.visible=true;S.assets.magoHeld=c;
      c.position.set(.075,-.035,.03);c.rotation.y=-.18; // 祖父の左膝寄りに座らせ、祖父の顔が見えるように
    }
  }
  function makeMagoFig(pose,sex,age,label){const M=MODS(),q=S.quality;
    const f=safeMake("mago-"+pose,()=>M.FIG&&M.FIG.makeMago?M.FIG.makeMago({pose,sex,age,quality:q}):null,()=>fbFigure(0xa04040,.8));
    f.visible=false;f.userData.saigenCustom=true;f.userData.cname="孫";f.userData.label=label||"孫";f.userData.labelY=(pose==="play"||pose==="stand")?1.25:.95;f.userData.hideLabel=true;
    track("estate",f);return own(f);}
  function buildMagoPlay(){const z=S.zones.estate;if(!z)return;S.assets.magoPlay=makeMagoFig("play","boy",6,"孫");z.add(S.assets.magoPlay);}

  /* ============================================================
     段階的な組み立て: 重い素材(人物・樹木・接写セット)は、いま見る場に要るものだけを先に作り、
     残りは場面の順に少しずつ作る(見ている間に一件ずつ)。場を飛ばした時は、その場で作る。
  ============================================================ */
  const JOB_DEFS={
    sky:buildSky,adashi:buildAdashi,dew:buildDewSet,toribe:buildToribe,an:buildAn,
    "kenko-gaze":()=>buildKenko("gaze"),"kenko-read":()=>buildKenko("read"),"kenko-write":()=>buildKenko("write"),"kenko-kneel":()=>buildKenko("kneel"),
    swarm:buildSwarm,leaf:buildLeafSet,water:buildWaterSet,semi:buildSemiSet,
    estate:buildEstateBase,"roujin-walk":()=>buildRoujin("walk"),"roujin-hold":()=>buildRoujin("hold"),"mago-play":buildMagoPlay,"roujin-count":()=>buildRoujin("count")
  };
  const JOB_ORDER=["sky","adashi","dew","toribe","an","kenko-gaze","kenko-read","swarm","leaf","water","semi","kenko-write","kenko-kneel","estate","roujin-walk","roujin-hold","mago-play","roujin-count"];
  const BEAT_JOBS=[["sky","adashi","dew"],["sky","toribe"],["sky","an","kenko-gaze"],["sky","an","kenko-read"],["sky","an","swarm","leaf","water"],["sky","an","semi"],
    ["sky","an","kenko-write"],["sky","an","kenko-read"],["sky","an","kenko-kneel"],["sky","an","kenko-write"],["estate","roujin-walk"],["estate","roujin-hold","mago-play"],
    ["estate","roujin-count","sky","an","kenko-gaze"]];
  function runJob(name){
    if(!S.active||S.done[name])return;S.done[name]=true;
    const before=new Set(Object.keys(S.zones));const t0=performance.now();
    try{JOB_DEFS[name]();}catch(e){console.error("[tsurezure] job "+name+":",e);}
    // 新しく出来たゾーン(または既存ゾーンへ足した物)のシェーダーを先に用意する
    try{const zs=Object.keys(S.zones).filter(k=>!before.has(k)||name.indexOf("kenko")===0||name==="swarm");
      const vis={};Object.keys(S.zones).forEach(k=>{vis[k]=S.zones[k].visible;S.zones[k].visible=zs.indexOf(k)>=0||vis[k];});
      const sv=S.sky?S.sky.visible:false;if(S.sky)S.sky.visible=true;
      const added=S.stage&&!S.stage.parent;if(added)scene.add(S.stage);
      if(S.stage)S.stage.visible=true;
      if(renderer&&renderer.compile)renderer.compile(scene,camera);
      if(added)scene.remove(S.stage);
      Object.keys(S.zones).forEach(k=>{S.zones[k].visible=vis[k];});if(S.sky)S.sky.visible=sv;
    }catch(e){}
    S.jobMs[name]=Math.round(performance.now()-t0);
  }
  function ensureBeat(i){(BEAT_JOBS[i]||[]).forEach(runJob);}
  // 見ている間に、次に要る素材を一件ずつ作る(ショットが落ち着いてから)
  function pumpJobs(){
    if(!S.active||S.pumpTimer)return;
    S.pumpTimer=setTimeout(()=>{S.pumpTimer=null;if(!S.active)return;
      const next=JOB_ORDER.find(n=>!S.done[n]);if(!next)return;
      if(S.shotT<1.5||document.hidden){pumpJobs();return;}
      runJob(next);pumpJobs();},700);
  }

  /* ============================================================
     カメラ割り(各場の shots)
       zone   : ゾーン名
       cam/to : {pos:[x,y,z], look:[x,y,z]} ゾーン局所座標(macro:true のときはセット局所の実寸座標)
       dur    : 秒(最後のショットは終わっても保持し、ゆっくり動き続ける)
       fov/fovTo, light(プリセット名 or {preset,over}), lightTo{preset,over,dur,delay}
       shadow : {center:[x,y,z](局所), half}
       fade   : 前のショットから切り替える時の暗転/白転
       enter(ctx)/tick(ctx,u,t): 演出の差し込み
  ============================================================ */
  const KENKO_POSES=["gaze","read","write","kneel"];
  function showKenko(pose,anchorKey,rotY,extra){
    const K=S.assets.kenko;if(!K)return null;
    KENKO_POSES.forEach(p=>{if(K[p])K[p].visible=(p===pose);});
    const f=K[pose];if(!f)return null;
    const hut=S.assets.hut;const a=S.assets.anc&&S.assets.anc[anchorKey];
    if(anchorKey==="pool"){
      const pi=S.assets.poolInfo;const x=pi.x-.15,z=pi.z-1.25;f.position.set(x,hAn(x,z),z);f.rotation.y=rotY!=null?rotY:0;
      if(f.parent!==S.zones.an)S.zones.an.add(f);
    }else if(a&&hut){
      if(f.parent!==hut)hut.add(f);
      f.position.copy(a.pos);f.position.y=a.pos.y-(anchorKey==="seat"||anchorKey==="seatInside"?.06:0);f.rotation.y=rotY!=null?rotY:a.rotY;
    }
    if(extra&&extra.writing!=null)f.userData.writing=extra.writing;
    S.labelFig.kenko=f;
    return f;
  }
  function placeDesk(anchorKey,rotY){const d=S.assets.desk,a=S.assets.anc&&S.assets.anc[anchorKey];if(!d||!a)return;d.visible=true;d.position.copy(a.pos);d.position.y=a.pos.y;d.rotation.y=rotY!=null?rotY:a.rotY;}
  function placeOn(obj,anchorKey,dy,rotY){const a=S.assets.anc&&S.assets.anc[anchorKey];if(!obj||!a)return;obj.visible=true;obj.position.copy(a.pos);obj.position.y=a.pos.y+(dy||0);obj.rotation.y=rotY!=null?rotY:a.rotY;}
  function placeBeside(obj,anchorKey,dx,dz,rotY){const a=S.assets.anc&&S.assets.anc[anchorKey];if(!obj||!a)return;obj.visible=true;
    const c=Math.cos(a.rotY),sn=Math.sin(a.rotY);obj.position.set(a.pos.x+dx*c+dz*sn,a.pos.y-(anchorKey==="seat"||anchorKey==="seatInside"?.06:0),a.pos.z-dx*sn+dz*c);obj.rotation.y=a.rotY+(rotY||0);}
  function hideAnProps(){["desk","lamp","enza","enza2","armrest"].forEach(k=>{if(S.assets[k])S.assets[k].visible=false;});}
  function anSeason(key){
    S.seasonAn=key;
    const set=(o)=>{if(o&&o.userData&&o.userData.setSeason)try{o.userData.setSeason(key);}catch(e){}};
    set(S.assets.anTerrain);set(S.assets.anGrass);set(S.assets.hut);(S.assets.trees||[]).forEach(set);
    const act=(p,on)=>{if(!p)return;p.visible=on;if(p.userData&&p.userData.setActive)p.userData.setActive(on);};
    act(S.assets.leaves,key==="autumn");act(S.assets.petals,key==="spring");act(S.assets.snow,key==="winter");
  }
  const ANSEASON_LIGHT={spring:"springDay",summer:"earlySummerDay",autumn:"autumnDay",winter:"winterDay"};

  const BEAT_SHOTS=[
    /* 1 あだし野の露消ゆる時なく */
    [{zone:"adashi",light:"autumnDawnMist",sunRel:[.42,.1,1],fov:46,cam:{pos:[-1.2,1.35,9],look:[4,1.8,-40]},to:{pos:[-.4,1.15,1],look:[3,1.5,-40]},dur:6.5,shadow:{center:[0,0,-14],half:40},
      enter(){if(S.assets.adashiGrass&&S.assets.adashiGrass.userData.setDew)S.assets.adashiGrass.userData.setDew(1);playOnce("kane_bonsho.mp3",.42,.6);}},
     {zone:"dew",macro:true,light:"autumnDawnMist",sunRel:[.35,.22,1],fade:"white",fov:30,useHint:true,drift:[.004,-.002,-.006],dur:9,shadow:{center:[0,0,0],half:4},
      enter(){S._dewFell=false;},tick(ctx,u,t){if(!S._dewFell&&t>3.2){S._dewFell=true;const d=S.assets.dewSet;if(d&&d.userData.triggerFall)d.userData.triggerFall();}}}],
    /* 2 鳥部山の煙立ち去らでのみ… */
    [{zone:"toribe",light:"autumnDuskToribe",fov:44,cam:{pos:[-8,2.0,4],look:[224,30,-8]},to:{pos:[-6,2.1,2.5],look:[224,36,-6]},dur:7,shadow:{center:[0,0,0],half:30},
      enter(){playOnce("kane_bonsho.mp3",.5,1.2);}},
     {zone:"toribe",light:"autumnDuskToribe",fade:"black",fov:16,fovTo:12.5,cam:{pos:[-6,2.2,2.5],look:[222,30,-5]},to:{pos:[-6,2.2,2.5],look:[221,44,-1]},dur:12,shadow:{center:[0,0,0],half:30}}],
    /* 3 世は定めなきこそいみじけれ */
    [{zone:"an",light:{preset:"autumnDay",over:{sun:{dir:[-.55,.42,.72],color:0xffe2b8,intensity:1.15},exposure:1.02}},fov:40,cam:{pos:[3.6,1.45,8.4],look:[0,1.1,1.0]},to:{pos:[2.8,1.35,6.6],look:[0,1.05,1.1]},dur:10,shadow:{center:[0,0,2],half:14},
      enter(){anSeason("autumn");hideAnProps();showKenko("gaze","seat",0);placeOn(S.assets.enza,"seat",-.06);placeDesk("desk");S.assets.kenko.gaze.userData.hideLabel=false;}}],
    /* 4 命あるものを見るに、人ばかり久しきはなし */
    [{zone:"an",light:"earlySummerDay",fov:50,cam:{pos:[-.9,1.5,-.3],look:[2,.6,9]},to:{pos:[-1.2,1.55,-.6],look:[3.5,.7,9.5]},dur:11,shadow:{center:[0,0,4],half:16},
      enter(){anSeason("summer");hideAnProps();showKenko("read","seat",0);placeOn(S.assets.enza,"seat",-.06);
        placeBeside(S.assets.armrest,"seat",-.35,.05,Math.PI/2);
        S.assets.kenko.read.userData.hideLabel=true;playOnce("hototogisu.mp3",.32,2.5);}}],
    /* 5 かげろふの夕べを待ち */
    [{zone:"an",light:"earlySummerDusk",fov:42,cam:{pos:[-7.4,.55,anStreamZ(-7.4)+2.6],look:[-3.6,1.4,anStreamZ(-3.6)]},to:{pos:[-6.6,.5,anStreamZ(-6.6)+2.2],look:[-3.4,1.5,anStreamZ(-3.4)]},dur:6.5,shadow:{center:[-4,0,8],half:14},
      enter(){anSeason("summer");hideAnProps();KENKO_POSES.forEach(p=>{if(S.assets.kenko[p])S.assets.kenko[p].visible=false;});if(S.assets.swarm)S.assets.swarm.visible=true;}},
     {zone:"leaf",macro:true,light:"earlySummerDusk",sunRel:[-.25,.14,1],fade:"black",fov:28,useHint:true,drift:[.003,.001,-.004],dur:7,shadow:{center:[0,0,0],half:3}},
     {zone:"water",macro:true,light:"earlySummerDusk",sunRel:[.3,.12,1],fade:"black",fov:30,useHint:true,drift:[0,-.002,-.003],dur:9,shadow:{center:[0,0,0],half:3},
      enter(){const w=S.assets.waterSet;if(w&&w.userData.ripple)w.userData.ripple(1);}}],
    /* 6 夏の蝉の春秋を知らぬもあるぞかし */
    [{zone:"semi",macro:true,light:"summerNoon",sunRel:[.75,.65,.05],fov:32,useHint:true,drift:[-.003,.002,-.004],dur:11,shadow:{center:[0,0,0],half:3},
      enter(){const c=S.assets.cicada;if(c&&c.userData.setSinging)c.userData.setSinging(1);}},
     {zone:"an",light:{preset:"summerNoon",over:{sun:{dir:[.3,.85,.4]}}},fade:"black",fov:58,cam:{pos:[6.2,1.1,4.8],look:[3.4,6.5,-1.0]},to:{pos:[5.8,1.1,4.4],look:[3.0,6.8,-1.4]},dur:10,shadow:{center:[2,0,0],half:14},
      enter(){anSeason("summer");}}],
    /* 7 つくづくと一年を暮らすほどだにも、こよなうのどけしや */
    [{zone:"an",light:"springDay",fov:46,cam:{pos:[13,4.2,17],look:[0,1.4,0]},to:{pos:[10.5,3.6,15.2],look:[0,1.3,0]},dur:12,shadow:{center:[0,0,2],half:22},
      enter(){hideAnProps();showKenko("write","seat",0,{writing:true});placeOn(S.assets.enza,"seat",-.06);placeDesk("desk");S.timelapse={t:0,seq:["spring","summer","autumn","winter"],step:2.6,idx:-1};},
      tick(ctx,u,t){const L=S.timelapse;if(!L)return;const i=Math.min(L.seq.length-1,Math.floor(t/L.step));if(i!==L.idx){L.idx=i;const k=L.seq[i];anSeason(k);setLight(presetState(ANSEASON_LIGHT[k]),i===0?0:1.1);}}}],
    /* 8 飽かず、惜しと思はば、千年を過ぐすとも、一夜の夢の心地こそせめ */
    [{zone:"an",light:"nightMoon",fov:38,cam:{pos:[1.12,1.3,1.62],look:[-.14,1.08,-.04]},to:{pos:[.92,1.26,1.42],look:[-.16,1.06,-.06]},dur:8,shadow:{center:[0,.6,0],half:4},lamp:{on:true,intensity:1.35},
      enter(){anSeason("autumn");hideAnProps();showKenko("read","seatInside");placeOn(S.assets.enza2,"seatInside",-.06);placeBeside(S.assets.armrest,"seatInside",-.35,.05,Math.PI/2);placeBeside(S.assets.lamp,"seatInside",.42,.38,0);
        if(S.assets.hut&&S.assets.hut.userData.setNight)S.assets.hut.userData.setNight(1);if(S.assets.hut&&S.assets.hut.userData.setShutters)S.assets.hut.userData.setShutters(1);}},
     {zone:"an",light:"nightMoon",lightTo:{preset:"predawnBlue",dur:7,delay:1.5},fov:44,cam:{pos:[4.8,1.6,7.2],look:[0,1.0,0]},to:{pos:[4.2,1.5,6.2],look:[0,1.0,0]},dur:12,shadow:{center:[0,0,1],half:12},lamp:{on:true,intensity:1.2,fadeTo:.25,fadeDur:8},
      tick(ctx,u,t){if(S.assets.hut&&S.assets.hut.userData.setNight)S.assets.hut.userData.setNight(Math.max(.25,1-t/9));}}],
    /* 9 住み果てぬ世に、みにくき姿を待ちえて、何かはせん。命長ければ辱多し */
    [{zone:"an",light:{preset:"autumnDay",over:{sun:{dir:[-.3,.55,-.75],intensity:1.0},exposure:1.0}},fov:40,cam:{pos:[9.2,1.1,poolCamZ(1.4)],look:[7.4,.1,poolCamZ(-.6)]},to:{pos:[8.9,1.0,poolCamZ(1.1)],look:[7.4,.05,poolCamZ(-.6)]},dur:6,shadow:{center:[7,0,8],half:8},
      enter(){anSeason("autumn");hideAnProps();showKenko("kneel","pool",Math.PI);const p=S.assets.pool;if(p&&p.userData.setRipple)p.userData.setRipple(.15);if(S.assets.hut&&S.assets.hut.userData.setNight)S.assets.hut.userData.setNight(0);}},
     {zone:"an",light:{preset:"autumnDay",over:{sun:{dir:[-.3,.55,-.75],intensity:1.0},exposure:1.0}},fade:"black",fov:34,cam:{pos:[7.4,1.0,poolCamZ(.55)],look:[7.35,-.4,poolCamZ(-.35)]},to:{pos:[7.4,.95,poolCamZ(.45)],look:[7.35,-.4,poolCamZ(-.35)]},dur:10,shadow:{center:[7,0,8],half:6},
      tick(ctx,u,t){const p=S.assets.pool;if(p&&p.userData.setRipple)p.userData.setRipple(t>4.5&&t<7?.85:.18);}}],
    /* 10 長くとも、四十に足らぬほどにて死なんこそ、めやすかるべけれ */
    [{zone:"an",light:{preset:"autumnDay",over:{sun:{dir:[-.4,.5,.75],intensity:1.1}}},fov:30,frameUp:.15,cam:{pos:[.06,1.46,1.98],look:[-.27,.93,1.48]},to:{pos:[.02,1.40,1.92],look:[-.27,.93,1.48]},dur:7,shadow:{center:[-.25,.9,1.4],half:1.5},
      enter(){anSeason("autumn");hideAnProps();showKenko("write","seat",0,{writing:true});placeOn(S.assets.enza,"seat",-.06);placeDesk("desk");
        const d=S.assets.desk;if(d&&d.userData.setWritten)d.userData.setWritten(.15);S._writeT=0;},
      tick(ctx,u,t){const d=S.assets.desk;if(d&&d.userData.setWritten)d.userData.setWritten(Math.min(1,.15+t*.11));}},
     {zone:"an",light:{preset:"autumnDay",over:{sun:{dir:[-.4,.5,.75],intensity:1.1}}},fade:"black",fov:42,cam:{pos:[2.6,1.3,5.4],look:[0,.95,1.2]},to:{pos:[2.2,1.25,4.8],look:[0,.95,1.2]},dur:10,shadow:{center:[0,0,1.5],half:10},
      tick(ctx,u,t){const d=S.assets.desk;if(d&&d.userData.setWritten)d.userData.setWritten(Math.min(1,.9+t*.02));}}],
    /* 11 そのほど過ぎぬれば、かたちを恥づる心もなく、人に出でまじらはんことを思ひ */
    [{zone:"estate",fov:48,estateCam:true,cam:{pos:[4.5,2.4,13.5],look:[-2.5,1.8,5.4]},to:{pos:[5.2,2.4,12.6],look:[0.5,1.8,5.4]},dur:12,
      enter(){showRoujin("walk");(S.assets.attendants||[]).forEach(f=>{f.visible=true;});const r=S.assets.roujin.walk,P=S.assets.estatePos;r.position.set(...P.walkFrom);r.rotation.y=Math.PI/2;r.userData.walking=true;r.userData.walkSpeed=.55;r.userData.hideLabel=false;S._walk={t:0};},
      tick(ctx,u,t){const r=S.assets.roujin.walk,P=S.assets.estatePos;const k=Math.min(1,t/12);r.position.x=lerp(P.walkFrom[0],P.walkTo[0],k);r.position.y=(typeof groundH==="function")?groundH(r.position.x,r.position.z):r.position.y;r.userData.walking=k<1;}}],
    /* 12 夕べの日に子孫を愛して、栄ゆく末を見んまでの命をあらまし */
    [{zone:"estate",fov:40,estateCam:true,cam:{pos:[6.8,1.9,11.2],look:[2.8,1.6,5.3]},to:{pos:[6.2,1.85,10.4],look:[2.8,1.6,5.3]},dur:12,
      enter(){showRoujin("hold");const P=S.assets.estatePos,r=S.assets.roujin.hold;r.position.set(...P.hold);r.rotation.y=.25;r.userData.hideLabel=true;
        const m=S.assets.magoPlay;if(m){m.visible=true;m.position.set(...P.play);m.rotation.y=-.9;m.userData.hideLabel=false;S.labelFig.mago=m;}}}],
    /* 13 ひたすら世をむさぼる心のみ深く、もののあはれも知らずなりゆくなん、あさましき */
    [{zone:"estate",fov:40,estateCam:true,cam:{pos:[1.6,2.0,4.4],look:[-1.2,1.55,0.7]},to:{pos:[1.3,1.95,3.8],look:[-1.2,1.5,0.7]},dur:9,lamp:{on:true,intensity:1.1,estate:true},
      enter(){showRoujin("count");const P=S.assets.estatePos,r=S.assets.roujin.count;r.position.set(...P.count);r.rotation.y=.35;r.userData.hideLabel=true;S.assets.magoPlay.visible=false;
        const l=S.assets.estateLamp;l.visible=true;l.position.set(...P.lamp);}},
     {zone:"an",light:"nightMoon",fade:"black",fov:40,cam:{pos:[2.8,1.25,6.9],look:[0,1.15,1.2]},to:{pos:[2.4,1.3,6.2],look:[0,1.2,1.1]},dur:12,shadow:{center:[0,0,2],half:12},
      enter(){S.assets.estateLamp.visible=false;anSeason("autumn");hideAnProps();showKenko("gaze","seat",0);placeOn(S.assets.enza,"seat",-.06);
        if(S.assets.hut&&S.assets.hut.userData.setNight)S.assets.hut.userData.setNight(.15);if(S.assets.anGrass&&S.assets.anGrass.userData.setDew)S.assets.anGrass.userData.setDew(1);}}]
  ];
  function poolCamZ(dz){return (S.assets.poolInfo?S.assets.poolInfo.z:anStreamZ(7.5)-.2)+dz;}
  function showRoujin(pose){
    const R=S.assets.roujin;if(!R)return;
    Object.keys(R).forEach(k=>{if(R[k])R[k].visible=(k===pose);});
    S.labelFig.roujin=R[pose];
  }

  /* ============================================================
     音(実録音のループと一回鳴らし)
  ============================================================ */
  const BEAT_AUDIO=[
    {"night_wind2.mp3":.16,"suzumushi.mp3":.05},                       // 1 夜明けの野: 風と残りの虫
    {"night_wind2.mp3":.22},                                            // 2 鳥部山の夕暮れ(梵鐘は一回鳴らし)
    {"spring_water_on_Mt2.mp3":.12,"night_wind2.mp3":.06},              // 3 秋の草庵
    {"spring_water_on_Mt2.mp3":.16},                                    // 4 初夏の庭(時鳥は一回鳴らし)
    {"spring_water_on_Mt2.mp3":.2,"frogs2.mp3":.05},                    // 5 夕暮れの流れ
    {"semi_minmin.mp3":.62,"semi_chorus.mp3":.16},                      // 6 蝉(実録音)
    {"spring_water_on_Mt2.mp3":.1,"night_wind2.mp3":.05},               // 7 一年
    {"matumsuhi.mp3":.09,"koorogi.mp3":.06},                            // 8 秋の夜(虫の音)
    {"spring_water_on_Mt2.mp3":.22},                                    // 9 水鏡
    {"spring_water_on_Mt2.mp3":.08},                                    // 10 筆
    {},                                                                 // 11 屋敷(既存の環境音は止めたまま)
    {"night_wind2.mp3":.05},                                            // 12 夕日の簀子
    {"koorogi.mp3":.06,"suzumushi.mp3":.05}                             // 13 夜
  ];
  function audioOn(){try{return (typeof APP_SE==="undefined"||APP_SE)&&!(typeof SFX!=="undefined"&&SFX._muted)&&!document.hidden;}catch(e){return true;}}
  function mediaFor(file){
    if(typeof SFX==="undefined")return null;
    let m=SFX.media&&SFX.media[file];
    if(!m&&SFX._ensure)m=SFX._ensure(file,true);
    return m||null;
  }
  function setLoops(map){
    const want=map||{};
    Object.keys(S.loops).forEach(f=>{if(!(f in want))S.loops[f].target=0;});
    Object.keys(want).forEach(f=>{
      let L=S.loops[f];
      if(!L){const m=mediaFor(f);if(!m)return;let el;try{el=m.cloneNode(true);}catch(e){return;}
        el.loop=true;el.volume=0;S.loops[f]=L={el,vol:0,target:0,playing:false};}
      L.target=want[f];
    });
  }
  function playOnce(file,vol,delay){
    const fire=()=>{if(!S.active||!audioOn())return;const m=mediaFor(file);if(!m)return;
      try{const el=m.cloneNode(true);el.volume=Math.max(0,Math.min(1,vol));el.play().catch(()=>{});S.once.push(el);
        el.onended=()=>{const i=S.once.indexOf(el);if(i>=0)S.once.splice(i,1);try{el.removeAttribute("src");el.load();}catch(e){}};}catch(e){}};
    if(delay){const id=setTimeout(fire,delay*1000);(S.timers||(S.timers=[])).push(id);}else fire();
  }
  function updateAudio(dt){
    const on=audioOn();
    Object.keys(S.loops).forEach(f=>{
      const L=S.loops[f];const tgt=on?L.target:0;
      L.vol+=(tgt-L.vol)*Math.min(1,dt*1.6);
      if(Math.abs(L.vol-tgt)<.002)L.vol=tgt;
      try{L.el.volume=Math.max(0,Math.min(1,L.vol));}catch(e){}
      if(L.vol>.001&&!L.playing){L.playing=true;try{L.el.play().catch(()=>{L.playing=false;});}catch(e){L.playing=false;}}
      else if(L.vol<=.001&&L.playing&&tgt===0){L.playing=false;try{L.el.pause();}catch(e){}}
    });
    if(!on)S.once.forEach(el=>{try{el.pause();}catch(e){}});
  }
  function stopAudio(){
    Object.keys(S.loops).forEach(f=>{const L=S.loops[f];try{L.el.pause();L.el.removeAttribute("src");L.el.load();}catch(e){}});
    S.loops={};
    S.once.forEach(el=>{try{el.pause();el.removeAttribute("src");el.load();}catch(e){}});S.once=[];
    (S.timers||[]).forEach(id=>clearTimeout(id));S.timers=[];
  }
  document.addEventListener("visibilitychange",()=>{if(document.hidden)Object.values(S.loops).forEach(L=>{try{L.el.pause();}catch(e){}L.playing=false;});});

  /* ============================================================
     ショットの進行
  ============================================================ */
  function zoneWorld(zone,p,macro){
    const o=ZONES[zone]||[0,0,0];const k=macro?MACRO_SCALE:1;
    return new THREE.Vector3(o[0]+p[0]*k,o[1]+p[1]*k,o[2]+p[2]*k);
  }
  // frameUp: 主役を画面のやや上に置く(下半分は本文パネルが覆うため)。注視点は画面中央から上へ frameUp×(半画角) ずれる
  function setCamera(pos,look,frameUp,fovDeg){
    player.pos.copy(pos);
    const dx=look.x-pos.x,dy=look.y-pos.y,dz=look.z-pos.z,len=Math.hypot(dx,dy,dz)||1;
    player.yaw=Math.atan2(-dx,-dz);
    let pitch=Math.asin(Math.max(-1,Math.min(1,dy/len)));
    if(frameUp){const half=((fovDeg||(typeof camera!=="undefined"&&camera?camera.fov:50))*Math.PI/180)/2;pitch-=Math.atan(frameUp*Math.tan(half));}
    player.pitch=Math.max(-1.45,Math.min(1.45,pitch));
  }
  const FRAME_UP_DEFAULT=.3;
  function frameUpOf(sh){return sh.frameUp!=null?sh.frameUp:FRAME_UP_DEFAULT;}
  function shotCam(sh){
    if(sh.useHint){
      const set={dew:S.assets.dewSet,semi:S.assets.barkSet,leaf:S.assets.leafSet,water:S.assets.waterSet}[sh.zone];
      const h=set&&set.userData&&set.userData.cameraHint;
      const pos=h&&h.position?h.position:[.12,.04,.18],target=h&&h.target?h.target:[0,0,0];
      const d=sh.drift||[0,0,0];
      return {from:{pos:zoneWorld(sh.zone,pos,true),look:zoneWorld(sh.zone,target,true)},
        to:{pos:zoneWorld(sh.zone,[pos[0]+d[0],pos[1]+d[1],pos[2]+d[2]],true),look:zoneWorld(sh.zone,target,true)},fov:(h&&h.fov)||sh.fov};
    }
    const f=sh.cam,t=sh.to||sh.cam;
    return {from:{pos:zoneWorld(sh.zone,f.pos,sh.macro),look:zoneWorld(sh.zone,f.look,sh.macro)},to:{pos:zoneWorld(sh.zone,t.pos,sh.macro),look:zoneWorld(sh.zone,t.look,sh.macro)},fov:sh.fov};
  }
  function activateZone(zone){
    Object.keys(S.zones).forEach(k=>{if(k==="estate")return;S.zones[k].visible=(k===zone);});
    const wasEstate=(S.curZone==="estate");
    S.curZone=zone;
    if(S.sky)S.sky.visible=(zone!=="estate");
    // 屋敷の場は本体の通常の空・光に任せる(老人と孫の場)。自前で書き換えた値(本体が毎フレームは戻さない分)を戻す
    if(zone==="estate"&&!wasEstate)restoreEstateLighting();
  }
  function restoreEstateLighting(){
    const s=S.saved;if(!s)return;
    hemi.color.setHex(s.hemiSky);hemi.groundColor.setHex(s.hemiGround);
    sun.target.position.copy(s.sunTarget);sun.target.updateMatrixWorld();
    const c=sun.shadow.camera;c.left=s.shadow.l;c.right=s.shadow.r;c.top=s.shadow.t;c.bottom=s.shadow.b;c.near=s.shadow.n;c.far=s.shadow.f;c.updateProjectionMatrix();
    if(rim.target&&s.rimTarget){rim.target.position.copy(s.rimTarget);rim.target.updateMatrixWorld();}
    if(!(S.lampCfg&&S.lampCfg.on)){interiorLight.position.copy(s.il.pos);interiorLight.color.setHex(s.il.color);interiorLight.distance=s.il.distance;interiorLight.decay=s.il.decay;}
  }
  function startShot(i,first){
    const sh=S.shots[i];if(!sh)return;
    S.shotIdx=i;S.shotT=0;
    if(sh.fade&&!first&&typeof saigenFade==="function")saigenFade(sh.fade);
    activateZone(sh.zone);
    const c=shotCam(sh);S.camPath=c;
    S.fovFrom=sh.fov||c.fov||50;S.fovTo=sh.fovTo||S.fovFrom;
    if(sh.light){const L=typeof sh.light==="string"?presetState(sh.light):presetState(sh.light.preset,sh.light.over);
      // sunRel=[右,上,奥]: カメラから見た太陽の向き(接写で逆光・横光を確実に作る)。奥>0 は被写体の向こう側=逆光
      if(sh.sunRel){const f=c.from.look.clone().sub(c.from.pos).normalize(),up=new THREE.Vector3(0,1,0),r=new THREE.Vector3().crossVectors(f,up).normalize(),u=new THREE.Vector3().crossVectors(r,f).normalize();
        const d=r.multiplyScalar(sh.sunRel[0]).add(u.multiplyScalar(sh.sunRel[1])).add(f.multiplyScalar(sh.sunRel[2])).normalize();
        L.sunLight.dir=[d.x,Math.max(d.y,.06),d.z];L.sunDir=[d.x,d.y,d.z];
        if(L.rim)L.rim.dir=[-d.x,Math.abs(d.y)*.6+.35,-d.z];}
      setLight(L,0);}
    S.lightTo2=sh.lightTo||null;
    if(sh.shadow){S.shadowHalf=sh.shadow.half||20;S.shadowCenter.copy(zoneWorld(sh.zone,sh.shadow.center||[0,0,0],sh.macro));}
    S.lampCfg=sh.lamp||null;
    if(sh.enter)try{sh.enter({S});}catch(e){console.error("[tsurezure] shot enter:",e);}
    setCamera(c.from.pos,c.from.look,frameUpOf(sh),S.fovFrom);
    if(typeof camera!=="undefined"&&camera){camera.fov=S.fovFrom;camera.near=sh.macro?.05:.1;camera.updateProjectionMatrix();}
    if(typeof snapSaigenCamera==="function")snapSaigenCamera();
  }
  function tickShot(dt){
    const sh=S.shots[S.shotIdx];if(!sh)return;
    S.shotT+=dt;
    const u=ease(S.shotT/Math.max(.1,sh.dur||8));
    const c=S.camPath;
    if(c){
      const pos=S.tmpV.copy(c.from.pos).lerp(c.to.pos,u),look=S.tmpV2.copy(c.from.look).lerp(c.to.look,u);
      setCamera(pos,look,frameUpOf(sh),lerp(S.fovFrom,S.fovTo,u));
    }
    if(typeof camera!=="undefined"&&camera&&S.fovTo!==S.fovFrom){camera.fov=lerp(S.fovFrom,S.fovTo,u);camera.updateProjectionMatrix();}
    if(S.lightTo2&&S.shotT>=(S.lightTo2.delay||0)){const L=S.lightTo2;setLight(presetState(L.preset,L.over),L.dur||4);S.lightTo2=null;}
    if(sh.tick)try{sh.tick({S},u,S.shotT);}catch(e){console.error("[tsurezure] shot tick:",e);}
    if(S.shotT>=(sh.dur||8)&&S.shotIdx<S.shots.length-1)startShot(S.shotIdx+1,false);
  }

  /* ============================================================
     本体から呼ばれる口(props.onBeat / update / dispose, SAIGEN_ENV_HOOK)
  ============================================================ */
  function onBeat(b,sc,st){
    if(!S.active)return;
    const i=(APP.saigen&&APP.saigen.i!=null)?APP.saigen.i:0;
    S.beat=i;S.shots=BEAT_SHOTS[i]||[];S.timelapse=null;
    const tb=performance.now();ensureBeat(i);
    if(performance.now()-tb>50&&typeof console!=="undefined")console.log("[tsurezure] beat "+(i+1)+" assets ready in "+Math.round(performance.now()-tb)+"ms (quality "+S.quality+")");
    // 前の場の残り(群舞・虫の声・老人の歩み)をリセット
    if(S.assets.swarm)S.assets.swarm.visible=false;
    const c=S.assets.cicada;if(c&&c.userData.setSinging)c.userData.setSinging(0);
    Object.values(S.assets.roujin||{}).forEach(r=>{if(r){r.visible=false;r.userData.walking=false;}});
    if(S.assets.magoPlay)S.assets.magoPlay.visible=false;
    if(S.assets.estateLamp)S.assets.estateLamp.visible=false;
    (S.assets.attendants||[]).forEach(f=>{f.visible=false;});
    // 名札は場ごとに明示したものだけ
    S.labelFig={};
    Object.values(S.assets.kenko||{}).concat(Object.values(S.assets.roujin||{}),[S.assets.magoPlay,S.assets.magoHeld]).forEach(f=>{if(f&&f.userData)f.userData.hideLabel=true;});
    // 本体は場の頭で全人物を visible=true にするので、いったん兼好も隠し、各ショットの enter で必要な姿だけ出す
    KENKO_POSES.forEach(p=>{const f=S.assets.kenko&&S.assets.kenko[p];if(f)f.visible=false;});
    if(S.zones.estate){const sh0=S.shots[0];if(sh0&&sh0.zone==="estate")snapEstateTime(b.time);}
    startShot(0,true);
    setLoops(BEAT_AUDIO[i]||{});
    pumpJobs();
  }
  // 屋敷の場へのハードカットでは、時刻の補間(約1秒)を待たずに光を目標値へ合わせる
  function snapEstateTime(t){
    try{const tg=TIMES[t||APP.time];if(!tg)return;
      cur.sky.setHex(tg.sky);cur.fog.setHex(tg.fog);cur.sunC.setHex(tg.sunC);cur.ambC.setHex(tg.ambC);
      cur.sunI=tg.sunI;cur.hemi=tg.hemi;cur.amb=tg.amb;cur.moon=tg.moon;cur.exp=tg.exp;cur.int=tg.int;cur.sunP.set(tg.sunP[0],tg.sunP[1],tg.sunP[2]);
    }catch(e){}
  }
  let _lastT=0;
  function update(dt,t){
    if(!S.active)return;
    _lastT=t;
    tickShot(dt);
    // 光の補間
    if(S.lightTo){S.lightU=Math.min(1,S.lightU+dt/Math.max(.1,S.lightDur));S.light=blendState(S.lightFrom,S.lightTo,ease(S.lightU));S.lightDirty=true;
      if(S.lightU>=1){S.light=S.lightTo;S.lightTo=null;S.lightFrom=null;}}
    const L=S.light;
    // 空(カメラに追従)と、場の色合いを受ける素材(山・水・煙・霧)
    if(S.sky&&S.sky.visible&&L){
      if(S.lightDirty&&S.sky.userData.setState)S.sky.userData.setState(L);
      if(S.sky.userData.update)S.sky.userData.update(dt,t,camera);
    }
    if(L&&S.lightDirty){applyTints(L);S.lightDirty=false;}
    // 素材のアニメ(今のゾーンだけ)
    const ups=S.zoneUpdaters[S.curZone]||[];
    const sunDir=L&&L.sunDir?V(L.sunDir).normalize():null;
    const sunC=L&&L.sunLight?L.sunLight.color:0xffffff,sunI=L&&L.sunLight?L.sunLight.intensity:1;
    for(let k=0;k<ups.length;k++){const o=ups[k];if(!o.visible&&o!==S.assets.leaves&&o!==S.assets.petals&&o!==S.assets.snow)continue;
      try{if(sunDir&&o.userData.setSun)o.userData.setSun(sunDir,sunC,sunI);o.userData.update(dt,t,camera);}catch(e){if(!o.userData._warned){o.userData._warned=true;console.error("[tsurezure] asset update:",e);}}}
    syncLabelProxies();
    updateAudio(dt);
  }
  // 名札・吹き出しの代理点を、いま見えている人物の頭上へ
  function syncLabelProxies(){
    if(!S.proxy)return;
    Object.keys(S.proxy).forEach(k=>{const o=S.proxy[k],f=S.labelFig&&S.labelFig[k];
      let vis=!!f;for(let p=f;vis&&p;p=p.parent){if(p.visible===false)vis=false;if(p===S.stage)break;}
      o.visible=vis;if(!vis){o.userData.hideLabel=true;return;}
      f.getWorldPosition(o.position);o.userData.labelY=f.userData.labelY||1.3;o.userData.bubbleY=f.userData.bubbleY||1.1;o.userData.hideLabel=!!f.userData.hideLabel;});
  }
  // 山・遣水・煙・霧へ、場の光の色合いを渡す(自然モジュールの applyPreset と同じ受け渡し)
  function applyTints(L){
    const sd=L.sunDir;
    const each=(list,fn)=>list.forEach(o=>{if(o&&o.userData)try{fn(o.userData);}catch(e){}});
    if(L.hills)each([S.assets.adashiHills,S.assets.toribeHills,S.assets.anHills],u=>{if(u.setTint)u.setTint(Object.assign({sunDir:sd},L.hills));});
    if(L.water)each([S.assets.stream,S.assets.pool],u=>{if(u.setSky)u.setSky(Object.assign({},L.water,{sunDir:sd}));});
    if(L.smoke)each([S.assets.smoke],u=>{if(u.setLight)u.setLight({dir:sd,color:L.smoke.light,ambient:L.smoke.ambient});});
    if(L.mist)each([S.assets.adashiMist],u=>{if(u.setColor)u.setColor(L.mist.color);if(u.setLight)u.setLight({dir:sd,color:L.mist.glow});});
  }
  // 灯(燈台)の位置と揺らぎ → interiorLight
  function lampWorldPos(){
    const lamp=(S.lampCfg&&S.lampCfg.estate)?S.assets.estateLamp:S.assets.lamp;if(!lamp)return null;
    const f=lamp.userData&&lamp.userData.flame;const o=f||lamp;
    o.updateMatrixWorld(true);return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
  }
  function envHook(dt){
    if(!S.active)return;
    const L=S.light;
    // 灯(屋敷の場でも使う)
    if(S.lampCfg&&S.lampCfg.on){
      const p=lampWorldPos();
      if(p){interiorLight.position.copy(p);interiorLight.position.y+=.05;}
      const lamp=(S.lampCfg.estate)?S.assets.estateLamp:S.assets.lamp;
      if(lamp&&lamp.userData.setLit)lamp.userData.setLit(true);
      let k=S.lampCfg.intensity||1.2;
      if(S.lampCfg.fadeTo!=null){const u=clamp01(S.shotT/(S.lampCfg.fadeDur||8));k=lerp(k,S.lampCfg.fadeTo,u);if(lamp&&lamp.userData.setIntensity)lamp.userData.setIntensity(lerp(1,.45,u));}
      const fl=(lamp&&lamp.userData&&lamp.userData.flicker!=null)?lamp.userData.flicker:1;
      interiorLight.color.setHex(0xffa858);interiorLight.distance=9;interiorLight.decay=1.7;
      interiorLight.intensity=k*(.82+.18*fl);
    }else if(S.curZone!=="estate"){
      interiorLight.intensity=0;
    }
    if(S.curZone==="estate"||!L)return;
    // ここからは自前のゾーン: 空・霧・光を場の状態で上書き
    if(typeof cloudDome!=="undefined"&&cloudDome)cloudDome.visible=false;
    if(typeof sunMesh!=="undefined"&&sunMesh)sunMesh.visible=false;
    if(typeof moonMesh!=="undefined"&&moonMesh)moonMesh.visible=false;
    if(typeof moonHalo!=="undefined"&&moonHalo)moonHalo.visible=false;
    if(typeof moonPhaseShadow!=="undefined"&&moonPhaseShadow)moonPhaseShadow.visible=false;
    if(!S.bg)S.bg=new THREE.Color();
    S.bg.setHex(L.fog.color);scene.background=S.bg;
    if(scene.fog){scene.fog.color.setHex(L.fog.color);scene.fog.density=(S.shots[S.shotIdx]&&S.shots[S.shotIdx].macro)?0:L.fog.density;}
    const SL=L.sunLight||{color:0xffffff,intensity:1,dir:[0,1,0]};
    sun.color.setHex(SL.color);sun.intensity=SL.intensity;
    const d=V(arr3(SL.dir)).normalize();
    sun.target.position.copy(S.shadowCenter);sun.target.updateMatrixWorld();
    sun.position.copy(S.shadowCenter).addScaledVector(d,Math.max(40,S.shadowHalf*2.2));
    const scm=sun.shadow.camera,hh=S.shadowHalf;
    if(scm.left!==-hh||scm.top!==hh){scm.left=-hh;scm.right=hh;scm.top=hh;scm.bottom=-hh;scm.near=.5;scm.far=Math.max(120,hh*5);scm.updateProjectionMatrix();}
    hemi.color.setHex(L.hemi.sky);hemi.groundColor.setHex(L.hemi.ground);hemi.intensity=L.hemi.intensity;
    ambient.color.setHex(L.ambient.color);ambient.intensity=L.ambient.intensity;
    moon.intensity=0;
    rim.color.setHex(L.rim?L.rim.color:0xd8e4ff);rim.intensity=L.rim?L.rim.intensity:.12;
    const rd=(L.rim&&L.rim.dir)?V(arr3(L.rim.dir)).normalize():d.clone().multiplyScalar(-1).setY(.6).normalize();
    rim.position.copy(S.shadowCenter).addScaledVector(rd,60);if(rim.target){rim.target.position.copy(S.shadowCenter);rim.target.updateMatrixWorld();}
    renderer.toneMappingExposure=L.exposure;
    // 雨は止める(場の情景を守る)
    if(typeof rainFall!=="undefined"&&rainFall&&rainFall.userData){rainFall.userData.rainSeason=false;rainFall.userData.rainOn=false;rainFall.visible=false;}
  }

  /* ---------- 退避と復元 ---------- */
  function saveGlobals(){
    S.saved={
      hemiSky:hemi.color.getHex(),hemiGround:hemi.groundColor.getHex(),
      sunTarget:sun.target.position.clone(),
      shadow:{l:sun.shadow.camera.left,r:sun.shadow.camera.right,t:sun.shadow.camera.top,b:sun.shadow.camera.bottom,n:sun.shadow.camera.near,f:sun.shadow.camera.far},
      il:{pos:interiorLight.position.clone(),color:interiorLight.color.getHex(),distance:interiorLight.distance,decay:interiorLight.decay},
      rimTarget:rim.target?rim.target.position.clone():null,
      camNear:camera.near,camFov:camera.fov
    };
  }
  function restoreGlobals(){
    const s=S.saved;if(!s)return;
    hemi.color.setHex(s.hemiSky);hemi.groundColor.setHex(s.hemiGround);
    sun.target.position.copy(s.sunTarget);sun.target.updateMatrixWorld();
    const c=sun.shadow.camera;c.left=s.shadow.l;c.right=s.shadow.r;c.top=s.shadow.t;c.bottom=s.shadow.b;c.near=s.shadow.n;c.far=s.shadow.f;c.updateProjectionMatrix();
    interiorLight.position.copy(s.il.pos);interiorLight.color.setHex(s.il.color);interiorLight.distance=s.il.distance;interiorLight.decay=s.il.decay;
    if(rim.target&&s.rimTarget){rim.target.position.copy(s.rimTarget);rim.target.updateMatrixWorld();}
    camera.near=s.camNear;camera.fov=62;camera.updateProjectionMatrix();
    if(typeof cloudDome!=="undefined"&&cloudDome)cloudDome.visible=true;
    S.saved=null;
  }

  function dispose(){
    if(!S.active&&!S.stage)return;
    S.active=false;
    if(S.pumpTimer){clearTimeout(S.pumpTimer);S.pumpTimer=null;}
    S.done={};S.proxy=null;S.labelFig={};
    stopAudio();
    restoreGlobals();
    (S.assets.list||[]).forEach(o=>{try{if(o&&o.userData&&typeof o.userData.dispose==="function")o.userData.dispose();}catch(e){console.error("[tsurezure] dispose:",e);}});
    _fallbackMats.forEach(m=>{try{m.dispose();}catch(e){}});_fallbackMats.length=0;
    S.assets={};S.zones={};S.zoneUpdaters={};S.actors={};S.sky=null;S.stage=null;S.shots=[];S.light=null;S.lightTo=null;S.lampCfg=null;
    if(window.SAIGEN_ENV_HOOK===envHook)window.SAIGEN_ENV_HOOK=null;
  }

  /* ---------- 舞台の組み立て(本体の buildSaigenStage から) ---------- */
  function build(stage){
    dispose();
    S.stage=stage;S.active=true;S.quality=qualityKey();S.assets={};S.actors={};S.done={};S.jobMs={};S.timing=S.timing||null;
    saveGlobals();
    // 名札・吹き出しの代理点(本体の名札は figure.position をワールド座標として扱うため、ゾーンや庵の子になった人物の
    // 頭上位置を毎フレームここへ写す)
    S.proxy={};S.labelFig={};
    [["kenko","兼好法師"],["roujin","老いた貴族"],["mago","孫"]].forEach(([k,name])=>{const o=new THREE.Object3D();o.name="tsure-label-"+k;
      o.userData={saigenCustom:true,label:name,cname:name,labelY:0,bubbleY:0,hideLabel:true};o.visible=false;stage.add(o);S.proxy[k]=o;S.actors[k]=o;});
    // 最初に見る場の光を仮置き(素材は onBeat で場ごとに作る)
    setLight(presetState("autumnDawnMist"),0);
    window.SAIGEN_ENV_HOOK=envHook;
    return {actors:S.actors,onBeat,update,dispose,tsurezure:true};
  }
  SAIGEN_PROP_BUILDERS.tsurezure=build;
  if(typeof SAIGEN_CHARS!=="undefined")SAIGEN_CHARS.kenko=SAIGEN_CHARS.kenko||{name:"兼好法師",role:"kikoshi",palette:[0x2c2a28,0x3a3734,0xd8d4cc],scale:1,prop:null};

  /* ============================================================
     本文(13場)
  ============================================================ */
  const BEATS=[
    {time:"dawn",season:"autumn",fade:"black",
     honbun:"あだし野の露消ゆる時なく、",
     yaku:"あだし野の露が消える時がなく、",
     note:"あだし野＝京都・嵯峨の奥にあった葬送の地／露＝はかなく消えるもののたとえ"},
    {time:"dusk",fade:"black",
     honbun:"鳥部山の煙立ち去らでのみ住み果つるならひならば、いかにもののあはれもなからん。",
     yaku:"鳥部山の（火葬の）煙が消え去ることもないように、人がいつまでもこの世に住み続けるのが定めであるならば、どんなにか、しみじみとした情趣もないことだろう。",
     note:"鳥部山＝京都・東山の火葬の地／立ち去らで＝消え去らないで（「で」は打消の接続）／住み果つ＝最後まで住み通す／ならひ＝世の定め／いかに〜なからん＝どんなに〜がないだろう"},
    {time:"day",fade:"black",
     honbun:"世は定めなきこそいみじけれ。",
     yaku:"この世は無常であるからこそ、すばらしいのだ。",
     note:"定めなし＝無常である／こそ〜いみじけれ＝係り結び（已然形）／いみじ＝程度がはなはだしい（ここでは、すばらしい）"},
    {time:"day",fade:"white",
     honbun:"命あるものを見るに、人ばかり久しきはなし。",
     yaku:"命あるものを見ると、人間ほど長生きするものはない。",
     note:"ばかり＝〜ほど（程度）／久し＝長い（時間が長く続く）"},
    {time:"dusk",fade:"black",
     honbun:"かげろふの夕べを待ち、",
     yaku:"かげろうが（朝に生まれて）夕方を待って死に、",
     note:"かげろふ＝蜉蝣（カゲロウ）。朝に生まれ、夕方には死ぬとされた（『淮南子』）"},
    {time:"day",fade:"white",
     honbun:"夏の蝉の春秋を知らぬもあるぞかし。",
     yaku:"夏の蝉が春や秋を知らない（で死ぬ）ようなものもあるのだよ。",
     note:"春秋を知らぬ＝『荘子』の「蟪蛄（けいこ）は春秋を知らず」による／ぞかし＝念押し（〜なのだよ）"},
    {time:"day",fade:"white",
     honbun:"つくづくと一年を暮らすほどだにも、こよなうのどけしや。",
     yaku:"（それらに比べれば）しみじみと一年を暮らす間でさえ、この上なくゆったりとしていることよ。",
     note:"つくづくと＝しみじみと／だに＝〜さえ／こよなう＝「こよなく」のウ音便。格別に／のどけし＝のんびりとしている"},
    {time:"night",fade:"black",
     honbun:"飽かず、惜しと思はば、千年を過ぐすとも、一夜の夢の心地こそせめ。",
     yaku:"満ち足りることなく、（命を）惜しいと思うならば、千年を過ごしたとしても、一夜の夢のように（短く）感じられることだろう。",
     note:"飽かず＝満ち足りず／とも＝逆接の仮定（たとえ〜ても）／こそ〜め＝係り結び（推量「む」の已然形）"},
    {time:"day",fade:"white",
     honbun:"住み果てぬ世に、みにくき姿を待ちえて、何かはせん。命長ければ辱多し。",
     yaku:"いつまでも住み通すことのできないこの世に、（老いて）醜い姿になるのを待ち迎えて、何になろうか（いや、何にもならない）。命が長いと恥をかくことも多い。",
     note:"何かはせん＝反語（何になろうか、いや何にもならない）／辱多し＝『荘子』の「寿（いのちなが）ければ則ち辱多し」による"},
    {time:"day",fade:"black",
     honbun:"長くとも、四十に足らぬほどにて死なんこそ、めやすかるべけれ。",
     yaku:"長くても、四十歳に満たないくらいで死ぬのが、見苦しくないだろう。",
     note:"四十（よそぢ）＝四十歳／死なん＝死ぬようなこと（「ん」は婉曲）／めやすし＝見苦しくない、感じがよい"},
    {time:"day",fade:"black",
     honbun:"そのほど過ぎぬれば、かたちを恥づる心もなく、人に出でまじらはんことを思ひ、",
     yaku:"その年頃を過ぎてしまうと、（老いた）容貌を恥じる心もなくなり、人の中に出て交際しようとばかり思い、",
     note:"ぬれ＝完了「ぬ」の已然形（「ば」が付いて確定条件）／かたち＝容貌／まじらふ＝人と交わる、交際する"},
    {time:"dusk",fade:"black",
     honbun:"夕べの日に子孫を愛して、栄ゆく末を見んまでの命をあらまし、",
     yaku:"夕日が沈みかけるような老いの身で子や孫をかわいがり、（その子孫が）栄えていく将来を見届けるまでの命を願い、",
     note:"夕べの日＝夕日。人生の晩年のたとえ／あらます＝前もってあれこれ期待する、願う"},
    {time:"night",fade:"black",
     honbun:"ひたすら世をむさぼる心のみ深く、もののあはれも知らずなりゆくなん、あさましき。",
     yaku:"ひたすら俗世の名誉や利益に執着する心ばかりが深くなり、しみじみとした情趣もわからなくなっていくのは、情けないことだ。",
     note:"むさぼる＝欲深く執着する／なん〜あさましき＝係り結び（連体形）／あさまし＝あきれるほどだ、情けない"}
  ];
  BEATS.forEach(b=>{b.speaker="kenko";});
  if(!SAIGEN_SCENES.some(s=>s.id===SCENE_ID)){
    SAIGEN_SCENES.push({id:SCENE_ID,work:"徒然草",title:"第七段 あだし野の露消ゆる時なく",author:"兼好法師",unit:"場",
      env:"tsurezure",buildProps:"tsurezure",quietBg:true,quietUi:true,cast:[],beats:BEATS});
  }
  return {S,ZONES,BEAT_SHOTS,BEATS,presetState,MACRO_SCALE,hAn,hAdashi,hToribe,anStreamZ};
})();
