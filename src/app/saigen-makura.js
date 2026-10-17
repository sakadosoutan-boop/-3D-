/* ============================================================
   再現モード「枕草子 第一段 春はあけぼの」（清少納言）
   ------------------------------------------------------------
   ■ 構成（設計の正本: docs/plans/MAKURA_SAIGEN_PLAN.md）
     - 本文は15場。各場(beat)に shots(カメラ割りの時系列)を持たせ、場の中でも遠景→寄り→接写とカットを重ねる。
       作りは徒然草 第七段(saigen-tsurezure.js)と同じ。
     - 舞台は寝殿造りの屋敷(原点)から遠く離れた「ゾーン」に組む(カメラの far=800 の外)。
         miya   … 中宮の御所の一角: 殿舎(簀子・廂・御簾・蔀)・渡殿・遣水・池・前栽・築地、築地の外の東山・西山・北山。
                  四季を通してこの一か所で撮る(季節・時刻・天候は場ごとに替える)
         hotaru … 接写: 夏の夜の葉にとまるゲンジボタル
         shimo  … 接写: 霜の草葉
         suzu   … 接写: 日没後の薄にとまって鳴く鈴虫
       接写セットは実寸で作って MACRO_SCALE 倍して撮る。
     - 空・光・霧は SAIGEN_ENV_HOOK(本体 animate から毎フレーム呼ばれる)で場ごとに上書きする。
     - 素材は TSURE_FIGURES(清少納言・女房) / TSURE_NATURE(空・山・雨・雪・雁・烏) / TSURE_INSECTS(蛍・鈴虫) /
       TSURE_FLORA(前栽・接写セット) / TSURE_TREES(木々) / TSURE_AN(殿舎・渡殿・築地・燈台) / MAKURA_PROPS(火桶・炭取・几帳)。
       無い/失敗した場合は簡易形状で代替し、場の進行は止めない。
   ■ 音: 実録音のループと一回鳴らし。出典とライセンスは sounds/CREDITS.md。
   ============================================================ */
const SAIGEN_MAKURA=(()=>{
  if(typeof SAIGEN_SCENES==="undefined"||typeof SAIGEN_PROP_BUILDERS==="undefined"||typeof THREE==="undefined")return null;
  const SCENE_ID="makura_haru";
  const MACRO_SCALE=20;
  // ゾーンの原点(ワールド座標)。屋敷(原点)からも互いにも 2400m 以上離し、far=800 の外に置く。
  // (徒然草のゾーンと同じ格子を使うが、二つの再現が同時に組まれることはない)
  const ZONES={miya:[2400,0,0],hotaru:[-2400,0,0],shimo:[-2400,0,2400],suzu:[-2400,0,-2400]};
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
    TRE:(typeof TSURE_TREES!=="undefined")?TSURE_TREES:null,
    PRO:(typeof MAKURA_PROPS!=="undefined")?MAKURA_PROPS:null
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
  const down=(q)=>q==="high"?"medium":"low";

  /* ---------- 簡易代替(素材が無い時だけ使う) ---------- */
  const _fallbackMats=[];
  function fbMat(color,opts){const m=new THREE.MeshStandardMaterial(Object.assign({color,roughness:.85},opts||{}));_fallbackMats.push(m);return m;}
  function fbBox(w,h,d,color){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),fbMat(color));m.castShadow=true;m.receiveShadow=true;return m;}
  function fbGroup(label){const g=new THREE.Group();g.name="makura-fallback-"+label;g.userData.dispose=()=>{g.traverse(o=>{if(o.geometry)o.geometry.dispose();});};return g;}
  function safeMake(label,fn,fallback){
    const t0=performance.now();
    try{const g=fn();if(g){const ms=performance.now()-t0;if(S.timing)S.timing[label]=(S.timing[label]||0)+ms;return g;}}catch(e){console.error("[makura] "+label+" build failed:",e);}
    try{const g=fallback?fallback():fbGroup(label);if(g)g.userData.fallback=true;return g;}catch(e){const g=fbGroup(label);g.userData.fallback=true;return g;}
  }
  function fbFigure(color,h){const g=fbGroup("figure");const b=fbBox(.62,h*.5,.55,color);b.position.y=h*.25;g.add(b);
    const hd=new THREE.Mesh(new THREE.SphereGeometry(.1,16,12),fbMat(0xe8c9a8));hd.position.y=h*.58;hd.castShadow=true;g.add(hd);
    const hair=fbBox(.2,h*.55,.06,0x111111);hair.position.set(0,h*.3,-.2);g.add(hair);return g;}

  /* ---------- 状態 ---------- */
  const S={
    active:false,stage:null,quality:"high",zones:{},zoneUpdaters:{},actors:{},assets:{},
    sky:null,beat:-1,shots:[],shotIdx:0,shotT:0,curZone:null,
    light:null,lightFrom:null,lightTo:null,lightU:1,lightDur:0,
    saved:null,loops:{},once:[],fovFrom:50,fovTo:50,
    shadowHalf:30,shadowCenter:new THREE.Vector3(),season:"spring",
    tmpV:new THREE.Vector3(),tmpV2:new THREE.Vector3()
  };

  /* ============================================================
     光の状態(場ごと)。形は TSURE_NATURE.SKY_PRESETS に合わせる。
     枕草子のための空(akebono* / natsu* / aki* / fuyu*)が自然モジュールに無い時は、近い既存の空で代える。
  ============================================================ */
  const PRESET_FALLBACK={
    akebonoDark:"predawnBlue",akebonoWhite:"predawnBlue",akebonoAkari:"autumnDawnMist",akebonoRise:"autumnDawnMist",
    natsuTsukiyo:"nightMoon",natsuYami:"nightMoon",natsuAmeYoru:"nightMoon",
    akiYuhi:"autumnDuskToribe",akiHiiri:"autumnDuskToribe",
    fuyuYukiAsa:"winterDay",fuyuShimoAsa:"winterDay",fuyuHiru:"winterDay"
  };
  const BUILTIN_LIGHT={
    predawnBlue:{sun:{color:0xc8b4d8,intensity:.45,dir:[.85,.08,.3]},hemi:{sky:0x8f9fc8,ground:0x2e2c34,intensity:.3},ambient:{color:0x9aa2c8,intensity:.1},fog:{color:0x9aa4c4,density:.008},exposure:1.0,horizon:0xd8b4b0},
    autumnDawnMist:{sun:{color:0xffc896,intensity:1.05,dir:[.82,.16,.3]},hemi:{sky:0xc9c6d8,ground:0x6a5c48,intensity:.5},ambient:{color:0xb6b4cc,intensity:.16},fog:{color:0xe7d6c8,density:.010},exposure:1.0,horizon:0xf2cdb0},
    nightMoon:{sun:{color:0x9fb4e8,intensity:.32,dir:[-.35,.62,.55]},hemi:{sky:0x3a4a78,ground:0x141820,intensity:.16},ambient:{color:0x7f90c0,intensity:.07},fog:{color:0x111a2e,density:.008},exposure:1.0,horizon:0x1d2a4a},
    autumnDuskToribe:{sun:{color:0xff9a52,intensity:.9,dir:[-.95,.1,.12]},hemi:{sky:0x9a8fb8,ground:0x4a3a2e,intensity:.42},ambient:{color:0x8f88b8,intensity:.14},fog:{color:0xb59aa4,density:.0026},exposure:1.0,horizon:0xe7a989},
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
    let st=null;
    const P=NAT&&NAT.SKY_PRESETS;
    if(P&&P[name])st=cloneDeep(P[name]);
    else if(P&&PRESET_FALLBACK[name]&&P[PRESET_FALLBACK[name]])st=cloneDeep(P[PRESET_FALLBACK[name]]);
    else{
      const b=BUILTIN_LIGHT[name]||BUILTIN_LIGHT[PRESET_FALLBACK[name]]||BUILTIN_LIGHT.springDay;
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
    const g=new THREE.Group();g.name="makura-zone-"+name;const o=ZONES[name];g.position.set(o[0],o[1],o[2]);
    g.visible=false;S.stage.add(g);S.zones[name]=g;S.zoneUpdaters[name]=[];return g;
  }
  function track(zone,obj){if(obj&&obj.userData&&typeof obj.userData.update==="function"&&S.zoneUpdaters[zone])S.zoneUpdaters[zone].push(obj);return obj;}
  function own(obj){if(obj)(S.assets.list||(S.assets.list=[])).push(obj);return obj;}

  /* ---- 御所の一角(miya)の地割り(ゾーン局所: +X=東, +Z=南, 地面 y=0) ----
     殿舎: 簀子の外縁の東端の真下が原点。建物は西(-X)へ4間、正面(庭)は南(+Z)。
     渡殿: 殿舎の北東の角から東へ延び、遣水の上を渡る。
     遣水: 北東の築地の際から湧き、渡殿の下をくぐって南西へ流れ、南の池に注ぐ。
     築地: 東 x=30、南 z=46、西 x=-46、北 z=-34。その外に松の木立、遠くに東山・西山・北山。 */
  const MIYA={
    densha:[0,0,0],
    watadono:{from:[1.6,-8.4],to:[15.6,-8.4]},
    stream:[[23,-30],[19.5,-20],[15.2,-12.5],[12.6,-7.6],[10.4,-2.4],[8.2,3.2],[5.6,8.4],[1.6,12.6],[-3.6,16.2],[-8.4,19.4]],
    pond:{c:[-14,24.5],r:[10.5,6.8]},
    island:{c:[-16.5,26.2],r:2.6},
    tsuiji:[[30,-34],[30,46],[-46,46],[-46,-34],[30,-34]],
    sand:{x0:-15.5,x1:3.0,z0:.2,z1:10.4}
  };
  const STREAM_Y=-.28; // 遣水の水面(局所)
  const POND_Y=-.36;   // 池の水面
  // 折れ線への距離と、線に沿った位置
  function polyDist(pts,x,z){let best=1e9;for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];const dx=b[0]-a[0],dz=b[1]-a[1];const l2=dx*dx+dz*dz||1;
    let t=((x-a[0])*dx+(z-a[1])*dz)/l2;t=t<0?0:t>1?1:t;const px=a[0]+dx*t,pz=a[1]+dz*t;const d=Math.hypot(x-px,z-pz);if(d<best)best=d;}return best;}
  function pondField(x,z){ // <1 で池の中(縁は少し波打つ)
    const P=MIYA.pond;const a=Math.atan2(z-P.c[1],x-P.c[0]);const k=1+.13*Math.sin(a*3+.7)+.08*Math.sin(a*5+2.1);
    return Math.hypot((x-P.c[0])/P.r[0],(z-P.c[1])/P.r[1])/k;}
  function hMiya(x,z){
    let h=.05*Math.sin(x*.21)*Math.cos(z*.17)+.04*Math.sin(x*.07+z*.05);
    // 築地の外はゆるく起伏する野
    const out=Math.max(0,x-31)+Math.max(0,z-47)+Math.max(0,-47-x)+Math.max(0,-35-z);
    if(out>0)h+=Math.min(1.6,out*.025)*(.6+.4*Math.sin(x*.03+z*.02));
    // 遣水の溝
    const d=polyDist(MIYA.stream,x,z);
    if(d<1.9)h-=.52*Math.pow(1-d/1.9,1.5);
    // 池
    const f=pondField(x,z);
    if(f<1.35){const u=clamp01((1.35-f)/.55);h=lerp(h,-.9,u*u*(3-2*u));
      const I=MIYA.island,di=Math.hypot(x-I.c[0],z-I.c[1])/I.r;if(di<1.6)h=lerp(h,.35,ease(clamp01((1.6-di)/.9)));}
    // 殿舎・渡殿の下と前は平らに
    if(x>-16&&x<17&&z>-11&&z<6.2){const w=clamp01(Math.min(x+16,17-x,z+11,6.2-z)/1.5);h*=1-w;}
    return h;
  }

  function buildSky(){
    const NAT=MODS().NAT;
    S.sky=safeMake("sky",()=>NAT&&NAT.makeSky?NAT.makeSky({radius:700,quality:S.quality}):null,()=>{
      const m=new THREE.Mesh(new THREE.SphereGeometry(700,32,16),new THREE.MeshBasicMaterial({color:0x9fb8d8,side:THREE.BackSide,fog:false,depthWrite:false}));
      m.renderOrder=-10;m.frustumCulled=false;m.userData.setState=(st)=>{if(st&&typeof st.horizon==="number")m.material.color.setHex(st.horizon);else if(st&&st.fog)m.material.color.setHex(st.fog.color);};
      m.userData.update=(dt,t,cam)=>{if(cam)m.position.copy(cam.position);};m.userData.dispose=()=>{m.geometry.dispose();m.material.dispose();};return m;});
    S.sky.name="makura-sky";S.sky.visible=false;S.stage.add(S.sky);own(S.sky);
  }

  // 白砂(南庭の階の前): 細かな粒と箒目の手続きテクスチャ
  function makeSandPatch(w,d){
    const c=document.createElement("canvas");c.width=512;c.height=512;const x=c.getContext("2d");
    x.fillStyle="#d9d4c8";x.fillRect(0,0,512,512);
    let s=91;const r=()=>{s=(s*16807)%2147483647;return s/2147483647;};
    for(let i=0;i<26000;i++){const v=200+Math.floor(r()*50);x.fillStyle="rgba("+v+","+(v-3)+","+(v-12)+","+(.25+r()*.35)+")";x.fillRect(r()*512,r()*512,1+r()*1.6,1+r()*1.6);}
    for(let y=0;y<512;y+=9){x.strokeStyle="rgba(120,112,98,.16)";x.lineWidth=2;x.beginPath();for(let xx=0;xx<=512;xx+=16)x.lineTo(xx,y+Math.sin(xx*.02+y)*1.2);x.stroke();
      x.strokeStyle="rgba(255,255,250,.22)";x.lineWidth=1;x.beginPath();for(let xx=0;xx<=512;xx+=16)x.lineTo(xx,y+2+Math.sin(xx*.02+y)*1.2);x.stroke();}
    const tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(w/3,d/3);tex.anisotropy=4;
    const mat=new THREE.MeshStandardMaterial({map:tex,roughness:.96,metalness:0,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    const geo=new THREE.PlaneGeometry(w,d,1,1);geo.rotateX(-Math.PI/2);
    const m=new THREE.Mesh(geo,mat);m.receiveShadow=true;m.name="makura-sand";
    m.userData.setSeason=(k)=>{mat.color.setHex(k==="winter"?0xf4f6fa:0xffffff);};
    m.userData.dispose=()=>{geo.dispose();mat.dispose();tex.dispose();};
    return m;
  }

  function buildMiya(){
    const z=zoneGroup("miya"),M=MODS(),q=S.quality;
    // 地面
    const terrain=safeMake("miya-terrain",()=>M.NAT&&M.NAT.makeTerrain?M.NAT.makeTerrain({size:300,segments:q==="low"?110:q==="medium"?170:230,heightAt:hMiya,quality:q,soilPatches:.12}):null,
      ()=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(300,300),fbMat(0x5f6a40));m.rotation.x=-Math.PI/2;m.receiveShadow=true;const g=fbGroup("terrain");g.add(m);return g;});
    z.add(own(terrain));S.assets.terrain=terrain;
    const sd=MIYA.sand,sand=makeSandPatch(sd.x1-sd.x0,sd.z1-sd.z0);sand.position.set((sd.x0+sd.x1)/2,.012,(sd.z0+sd.z1)/2);z.add(own(sand));S.assets.sand=sand;
    // 殿舎
    const den=safeMake("miya-densha",()=>M.AN&&M.AN.makeDensha?M.AN.makeDensha({bays:4,quality:q,kizahashi:true}):null,()=>{
      const g=fbGroup("densha");const fl=fbBox(12.4,.12,7.4,0x8a7458);fl.position.set(-6.2,1.2,-3.7);g.add(fl);
      const rf=fbBox(14.6,.5,10.2,0x4a3a30);rf.position.set(-6.2,4.6,-3.4);g.add(rf);
      [-12,-9,-6,-3,0].forEach(px=>{const p=fbBox(.3,3.2,.3,0x9a8466);p.position.set(px,2.8,-1.4);g.add(p);});
      const sa=new THREE.Object3D();sa.position.set(-1.6,1.26,-2.1);g.userData.anchors={seatHashi:sa,lamp:Object.assign(new THREE.Object3D(),{position:V([-2.6,1.26,-3.2])})};g.add(sa);return g;});
    den.position.set(...MIYA.densha);z.add(own(track("miya",den)));S.assets.densha=den;
    // 渡殿(遣水の上を渡る)
    const W=MIYA.watadono,wl=Math.hypot(W.to[0]-W.from[0],W.to[1]-W.from[1]);
    const wata=safeMake("miya-watadono",()=>M.AN&&M.AN.makeWatadono?M.AN.makeWatadono({length:wl,quality:q}):null,()=>{
      const g=fbGroup("watadono");const fl=fbBox(wl,.1,2.6,0x8a7458);fl.position.set(wl/2,1.05,0);g.add(fl);const rf=fbBox(wl+1,.3,3.8,0x4a3a30);rf.position.set(wl/2,3.6,0);g.add(rf);return g;});
    wata.position.set(W.from[0],0,W.from[1]);wata.rotation.y=-Math.atan2(W.to[1]-W.from[1],W.to[0]-W.from[0]);
    z.add(own(track("miya",wata)));S.assets.watadono=wata;
    // 築地
    const tsuiji=safeMake("miya-tsuiji",()=>M.AN&&M.AN.makeTsuiji?M.AN.makeTsuiji({points:MIYA.tsuiji,quality:down(q)}):null,()=>{
      const g=fbGroup("tsuiji");for(let i=0;i<MIYA.tsuiji.length-1;i++){const a=MIYA.tsuiji[i],b=MIYA.tsuiji[i+1];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);
        const w=fbBox(L,2.4,1,0xb8ab8c);w.position.set((a[0]+b[0])/2,1.2,(a[1]+b[1])/2);w.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);g.add(w);}return g;});
    z.add(own(track("miya",tsuiji)));S.assets.tsuiji=tsuiji;
    // 遣水と池
    const pts=MIYA.stream.map(p=>[p[0],STREAM_Y,p[1]]);
    const stream=safeMake("miya-stream",()=>M.NAT&&M.NAT.makeStream?M.NAT.makeStream({points:pts,width:1.5,quality:down(q)}):null,()=>fbGroup("stream"));
    z.add(own(track("miya",stream)));S.assets.stream=stream;
    const P=MIYA.pond;
    const pond=safeMake("miya-pond",()=>M.NAT&&M.NAT.makeMirrorWater?M.NAT.makeMirrorWater({width:P.r[0]*2.9,depth:P.r[1]*2.9,resolution:q==="low"?256:512,maxDistance:150,quality:q}):null,()=>{
      const g=fbGroup("pond");const m=new THREE.Mesh(new THREE.PlaneGeometry(P.r[0]*2.9,P.r[1]*2.9),fbMat(0x1d2a2c,{roughness:.08,metalness:.2}));m.rotation.x=-Math.PI/2;g.add(m);return g;});
    pond.position.set(P.c[0],POND_Y,P.c[1]);z.add(own(track("miya",pond)));S.assets.pond=pond;
    // 前栽(遣水のほとりの草。殿舎の前の白砂・流れ・池・渡殿の下には生やさない)
    const grass=safeMake("miya-grass",()=>M.FLO&&M.FLO.makeGrassField?M.FLO.makeGrassField({width:96,depth:92,center:[-6,4],focus:[4,4],heightAt:hMiya,season:"spring",dew:true,quality:down(q),
      mask:(x,zz)=>{const sd=MIYA.sand;if(x>-16&&x<3.4&&zz>-9.6&&zz<.4)return 0;if(x>sd.x0-.4&&x<sd.x1+.4&&zz>sd.z0-.4&&zz<sd.z1+.4)return 0;
        if(x>0&&x<17&&zz>-10.4&&zz<-6.4)return .2;
        const d=polyDist(MIYA.stream,x,zz);if(d<.95)return 0;const pf=pondField(x,zz);
        const I=MIYA.island,di=Math.hypot(x-I.c[0],zz-I.c[1])/I.r;if(di<1)return .7;if(pf<1.12)return 0;
        if(x>29.4||zz>45.4||x<-45.4||zz<-33.4)return (x>31||zz>47||x<-47||zz<-35)?.35:0;
        if(d<2.7)return .95;if(pf<1.5)return .8;return .04;}}):null,()=>fbGroup("grass"));
    z.add(own(track("miya",grass)));S.assets.grass=grass;
    // 石(遣水と池の汀)
    const rocks=[[13.6,-6.2,.7,1],[11.2,-1.2,.55,2],[9.4,3.8,.8,3],[6.8,8.9,.6,4],[2.4,11.6,.75,5],[-2.8,16.9,.9,6],[-5.6,18.4,.65,7],[-9.4,17.4,1.1,8],[-21.5,21.6,1.0,9],[-17.8,30.2,.8,10],[-6.2,28.4,.7,11]];
    rocks.forEach(r=>{const o=safeMake("miya-rock",()=>M.NAT&&M.NAT.makeRock?M.NAT.makeRock({size:r[2],seed:r[3],quality:"low"}):null,()=>{const g=fbGroup("rock");const b=fbBox(r[2],r[2]*.5,r[2]*.8,0x6a6660);b.position.y=r[2]*.2;g.add(b);return g;});
      o.position.set(r[0],hMiya(r[0],r[1])-.05,r[1]);o.rotation.y=r[3]*1.3;z.add(own(o));});
    // 木々: 階の脇の桜、池の汀の松、遣水の楓、萩。築地の外の木立
    const Tr=(label,fn,x,zz,rot)=>{const t=safeMake(label,fn,()=>{const g=fbGroup(label);const b=fbBox(.3,4,.3,0x4a3a2a);b.position.y=2;g.add(b);return g;});
      t.position.set(x,hMiya(x,zz),zz);if(rot)t.rotation.y=rot;z.add(own(track("miya",t)));(S.assets.trees||(S.assets.trees=[])).push(t);return t;};
    S.assets.cherry=Tr("miya-cherry",()=>M.TRE&&M.TRE.makeCherry?M.TRE.makeCherry({height:6.2,seed:301,quality:down(q)}):null,5.4,4.6,.6);
    Tr("miya-pine1",()=>M.TRE&&M.TRE.makePine?M.TRE.makePine({height:7.2,lean:.35,seed:302,quality:down(q)}):null,-9.6,15.6,2.4);
    Tr("miya-pine2",()=>M.TRE&&M.TRE.makePine?M.TRE.makePine({height:6.0,lean:.22,seed:303,quality:"low"}):null,-24.5,21,1.2);
    Tr("miya-pine3",()=>M.TRE&&M.TRE.makePine?M.TRE.makePine({height:4.6,lean:.4,seed:308,quality:"low"}):null,MIYA.island.c[0]+.4,MIYA.island.c[1]-.3,.7);
    Tr("miya-maple1",()=>M.TRE&&M.TRE.makeMaple?M.TRE.makeMaple({height:4.8,seed:304,quality:down(q)}):null,12.6,5.4); // 夜明けの視線(東北東)を遮らない所
    Tr("miya-maple2",()=>M.TRE&&M.TRE.makeMaple?M.TRE.makeMaple({height:4.0,seed:305,quality:"low"}):null,3.6,14.6);
    Tr("miya-hagi1",()=>M.TRE&&M.TRE.makeHagi?M.TRE.makeHagi({seed:306,quality:down(q)}):null,8.6,7.2);
    Tr("miya-hagi2",()=>M.TRE&&M.TRE.makeHagi?M.TRE.makeHagi({seed:307,quality:"low"}):null,-.6,12.8);
    [[36,-22,8.5],[38.5,-6,9.5],[35.5,9,8],[41,22,10],[36.5,36,8.5],[44,-12,11],[47,4,9.5],[45,30,10.5],[52,16,12],[50,-28,10],
     [-54,8,9],[-55,30,8],[-52,-14,10],[-58,42,9.5],[2,55,8.5],[-22,55,9],[22,53,8],[-38,57,10],[12,60,11],[34,58,9]].forEach((p,i)=>
      Tr("miya-bgpine"+i,()=>M.TRE&&M.TRE.makePine?M.TRE.makePine({height:p[2],lean:.1,seed:320+i,quality:"low"}):null,p[0],p[1],i*.9));
    S.assets.bamboo=Tr("miya-bamboo",()=>M.TRE&&M.TRE.makeBambooGrove?M.TRE.makeBambooGrove({width:14,depth:4,height:9,seed:340,quality:"low"}):null,22,-27);
    // 京の山並み(東山・西山・北山)
    const ridges=safeMake("miya-ridges",()=>{
      if(M.NAT&&M.NAT.makeKyotoRidges)return M.NAT.makeKyotoRidges({center:[0,0],sides:["east","west","north"],quality:q});
      if(M.NAT&&M.NAT.makeHills){const h=M.NAT.makeHills({center:[0,0],quality:q,ridges:[
        {distance:520,height:62,arcStart:.65,arcEnd:2.45,color:0x6f7f8c,seed:401,roughness:.45,forest:true},   // 東山
        {distance:640,height:96,arcStart:.25,arcEnd:.95,color:0x8392a2,seed:403,roughness:.5,forest:true},     // 比叡山
        {distance:620,height:78,arcStart:3.95,arcEnd:5.6,color:0x7d8b9a,seed:405,roughness:.5,forest:true},    // 西山・愛宕山
        {distance:600,height:42,arcStart:5.6,arcEnd:6.9,color:0x8796a6,seed:407,roughness:.5,forest:true}]});  // 北山
        return h;}
      return null;},()=>fbGroup("ridges"));
    z.add(own(track("miya",ridges)));S.assets.ridges=ridges;
    // 調度: 燈台(廂の奥)・几帳
    const lamp=safeMake("miya-lamp",()=>M.AN&&M.AN.makeToudai?M.AN.makeToudai({quality:q}):null,()=>{const g=fbGroup("lamp");const b=fbBox(.05,.8,.05,0x111111);b.position.y=.4;g.add(b);const f=new THREE.Object3D();f.position.y=.86;g.add(f);g.userData.flame=f;return g;});
    const la=anchorPos("lamp",[-2.6,1.26,-3.2]);lamp.position.copy(la.pos);lamp.visible=false;z.add(own(track("miya",lamp)));S.assets.lamp=lamp;
    const kichou=safeMake("miya-kichou",()=>M.PRO&&M.PRO.makeKichou?M.PRO.makeKichou({size:"4shaku",season:"spring",quality:down(q)}):null,()=>{const g=fbGroup("kichou");const b=fbBox(1.4,1.5,.04,0xb06070);b.position.y=.75;g.add(b);return g;});
    const ka=anchorPos("kichou",[-3.4,1.26,-3.0]);kichou.position.copy(ka.pos);kichou.rotation.y=ka.rotY;z.add(own(track("miya",kichou)));S.assets.kichou=kichou;
    // 季節の粒子(花びら・紅葉)
    const Pa=(kind,cx,cz)=>{const p=safeMake("miya-"+kind,()=>M.TRE&&M.TRE.makeFallingParticles?M.TRE.makeFallingParticles({kind,width:24,height:10,depth:20,quality:down(q)}):null,()=>fbGroup(kind));
      p.position.set(cx,0,cz);p.visible=false;if(p.userData&&p.userData.setActive)p.userData.setActive(false);z.add(own(track("miya",p)));return p;};
    S.assets.petals=Pa("petals",3,4);S.assets.leaves=Pa("maple",6,2);
  }
  // 殿舎のアンカー(殿舎の局所座標→ゾーン局所座標)
  function anchorPos(key,def){
    const den=S.assets.densha;const A=den&&den.userData&&den.userData.anchors;const a=A&&A[key];
    if(a&&a.isObject3D){den.updateMatrixWorld(true);const zg=S.zones.miya;const p=new THREE.Vector3();a.getWorldPosition(p);if(zg)zg.worldToLocal(p);
      const q=new THREE.Quaternion();a.getWorldQuaternion(q);const e=new THREE.Euler().setFromQuaternion(q,"YXZ");return {pos:p,rotY:e.y};}
    if(a&&a.position)return {pos:a.position.clone().add(den.position),rotY:a.rotation?a.rotation.y:0};
    return {pos:V(def),rotY:0};
  }
  function seasonMiya(key){
    S.season=key;
    const set=(o)=>{if(o&&o.userData&&o.userData.setSeason)try{o.userData.setSeason(key);}catch(e){}};
    [S.assets.terrain,S.assets.grass,S.assets.densha,S.assets.watadono,S.assets.tsuiji,S.assets.ridges,S.assets.sand,S.assets.kichou].forEach(set);
    (S.assets.trees||[]).forEach(set);
    const t=S.assets.terrain;if(t&&t.userData&&t.userData.setSnow)try{t.userData.setSnow(key==="winter"?(S.snowCover!=null?S.snowCover:1):0);}catch(e){}
    if(t&&t.userData&&t.userData.setLeaves)try{t.userData.setLeaves(key==="autumn"?.35:0);}catch(e){}
    const act=(p,on)=>{if(!p)return;p.visible=on;if(p.userData&&p.userData.setActive)p.userData.setActive(on);};
    act(S.assets.petals,key==="spring");act(S.assets.leaves,key==="autumn");
  }
  function setNight(v){
    [S.assets.densha,S.assets.watadono].forEach(o=>{if(o&&o.userData&&o.userData.setNight)try{o.userData.setNight(v);}catch(e){}});
  }
  function setMisu(v){const d=S.assets.densha;if(d&&d.userData&&d.userData.setMisu)try{d.userData.setMisu(v);}catch(e){}}
  function setShitomi(v){const d=S.assets.densha;if(d&&d.userData&&d.userData.setShitomi)try{d.userData.setShitomi(v);}catch(e){}}

  /* ---------- 人物 ---------- */
  const KASANE={spring:"sakura",summer:"unohana",autumn:"momiji",winter:"yukinoshita"};
  function buildSei(){
    const M=MODS(),q=S.quality,z=S.zones.miya;if(!z)return;
    const f=safeMake("sei",()=>M.FIG&&M.FIG.makeNyobo?M.FIG.makeNyobo({attire:"karaginu",pose:"gaze",kasane:KASANE[S.season]||"sakura",quality:q}):null,()=>fbFigure(0x8a3048,.86));
    f.visible=false;f.userData.saigenCustom=true;f.userData.cname="清少納言";f.userData.label="清少納言";f.userData.labelY=1.12;f.userData.bubbleY=1.0;f.userData.hideLabel=true;
    z.add(own(track("miya",f)));S.assets.sei=f;S.assets.seiKasane=KASANE[S.season]||"sakura";
  }
  function showSei(season,rotY){
    const f=S.assets.sei;if(!f)return null;
    const k=KASANE[season]||"sakura";
    if(k!==S.assets.seiKasane&&f.userData.setKasane){try{f.userData.setKasane(k);}catch(e){}S.assets.seiKasane=k;}
    const a=anchorPos("seatHashi",[-1.6,1.26,-2.1]);f.position.copy(a.pos);f.rotation.y=(rotY!=null?rotY:a.rotY);f.visible=true;
    S.labelFig.sei=f;return f;
  }
  function buildNyoboCarry(){
    const M=MODS(),q=S.quality,z=S.zones.miya;if(!z)return;
    const f=safeMake("nyobo-carry",()=>M.FIG&&M.FIG.makeNyobo?M.FIG.makeNyobo({attire:"uchiki",pose:"carry",kasane:"matsugasane",quality:q}):null,()=>fbFigure(0x3a5a48,1.5));
    f.visible=false;f.userData.saigenCustom=true;f.userData.cname="女房";f.userData.label="女房";f.userData.labelY=1.75;f.userData.hideLabel=true;
    const sumi=safeMake("sumitori",()=>M.PRO&&M.PRO.makeSumitori?M.PRO.makeSumitori({lit:true,quality:q}):null,()=>{const g=fbGroup("sumitori");const b=fbBox(.34,.14,.26,0x3a2a1c);b.position.y=.07;g.add(b);return g;});
    const ca=f.userData&&f.userData.anchors&&f.userData.anchors.carry;
    if(ca)ca.add(sumi);else{sumi.position.set(0,.95,.32);f.add(sumi);}
    track("miya",sumi);own(sumi);S.assets.sumitori=sumi;
    z.add(own(track("miya",f)));S.assets.nyoboCarry=f;
  }
  function buildNyoboTend(){
    const M=MODS(),q=S.quality,z=S.zones.miya;if(!z)return;
    const f=safeMake("nyobo-tend",()=>M.FIG&&M.FIG.makeNyobo?M.FIG.makeNyobo({attire:"uchiki",pose:"tend",kasane:"yukinoshita",quality:q}):null,()=>fbFigure(0x7a3a3a,.86));
    f.visible=false;f.userData.saigenCustom=true;f.userData.cname="女房";f.userData.label="女房";f.userData.labelY=1.12;f.userData.hideLabel=true;
    z.add(own(track("miya",f)));S.assets.nyoboTend=f;
  }
  function buildHioke(){
    const M=MODS(),q=S.quality,z=S.zones.miya;if(!z)return;
    const h=safeMake("hioke",()=>M.PRO&&M.PRO.makeHioke?M.PRO.makeHioke({quality:q}):null,()=>{const g=fbGroup("hioke");const b=new THREE.Mesh(new THREE.CylinderGeometry(.18,.16,.27,24),fbMat(0x8a7a66));b.position.y=.135;g.add(b);
      const e=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,.02,24),fbMat(0xff5a20,{emissive:0xff4010,emissiveIntensity:1}));e.position.y=.25;g.add(e);
      g.userData.setBurn=(v)=>{e.material.emissiveIntensity=1-v*.9;e.material.color.setHex(v>.7?0xd8d4cc:0xff5a20);};return g;});
    h.visible=false;z.add(own(track("miya",h)));S.assets.hioke=h;
  }
  // 冬の場の配置: 火桶は廂の端近、女房はその前に座る
  function placeHiokeScene(){
    const h=S.assets.hioke,t=S.assets.nyoboTend;const a=anchorPos("seatHashi",[-1.6,1.26,-2.1]);
    const base=a.pos.clone();base.x-=1.6;
    if(t){t.position.copy(base);t.rotation.y=Math.PI*.5;t.visible=true;
      const ha=t.userData&&t.userData.anchors&&t.userData.anchors.hioke;
      if(h){if(ha&&ha.isObject3D){t.updateMatrixWorld(true);const p=new THREE.Vector3();ha.getWorldPosition(p);S.zones.miya.worldToLocal(p);h.position.copy(p);}else h.position.set(base.x+.55,base.y,base.z);h.visible=true;}}
    else if(h){h.position.set(base.x+.55,base.y,base.z);h.visible=true;}
  }

  /* ---------- 夏の夜・秋の空・冬の天候 ---------- */
  function buildSwarm(){
    const M=MODS(),q=S.quality,z=S.zones.miya;if(!z)return;
    const path=MIYA.stream.slice(1,9).map(p=>[p[0],STREAM_Y,p[1]]);
    const sw=safeMake("hotaru-swarm",()=>M.INS&&M.INS.makeFireflySwarm?M.INS.makeFireflySwarm({count:q==="low"?40:q==="medium"?70:110,path,heightAt:hMiya,water:{y:STREAM_Y},restingFrac:.25,sync:.25,quality:q}):null,
      ()=>{const g=fbGroup("swarm");const geo=new THREE.BufferGeometry();const n=60,pos=new Float32Array(n*3);
        for(let i=0;i<n;i++){const p=path[i%path.length];pos[i*3]=p[0]+(Math.random()-.5)*4;pos[i*3+1]=.4+Math.random()*1.8;pos[i*3+2]=p[2]+(Math.random()-.5)*4;}
        geo.setAttribute("position",new THREE.BufferAttribute(pos,3));const m=new THREE.PointsMaterial({color:0xc6ff5a,size:.08,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
        const pts=new THREE.Points(geo,m);g.add(pts);g.userData.dispose=()=>{geo.dispose();m.dispose();};return g;});
    sw.visible=false;z.add(own(track("miya",sw)));S.assets.swarm=sw;
  }
  function buildRain(){
    const M=MODS(),q=S.quality,z=S.zones.miya;if(!z)return;
    const den=S.assets.densha;const drips=[];
    const ed=den&&den.userData&&den.userData.eaveDrips;
    if(Array.isArray(ed))ed.forEach(p=>{const v=(p&&p.isVector3)?p.clone():V(p);drips.push([v.x+den.position.x,v.y+den.position.y,v.z+den.position.z]);});
    const P=MIYA.pond;
    const rain=safeMake("miya-rain",()=>M.NAT&&M.NAT.makeRain?M.NAT.makeRain({area:{width:44,depth:44,height:18},follow:true,drips,
      water:{y:POND_Y+ZONES.miya[1],bounds:[P.c[0]-P.r[0],P.c[1]-P.r[1],P.c[0]+P.r[0],P.c[1]+P.r[1]]},quality:q}):null,()=>fbGroup("rain"));
    rain.visible=false;z.add(own(track("miya",rain)));S.assets.rain=rain;
  }
  function buildSnow(){
    const M=MODS(),q=S.quality,z=S.zones.miya;if(!z)return;
    const sn=safeMake("miya-snowfall",()=>{if(M.NAT&&M.NAT.makeSnowfall)return M.NAT.makeSnowfall({area:{width:50,depth:50,height:22},follow:true,quality:q});
      if(M.TRE&&M.TRE.makeFallingParticles)return M.TRE.makeFallingParticles({kind:"snow",width:40,height:16,depth:36,quality:down(q)});return null;},()=>fbGroup("snow"));
    sn.visible=false;if(sn.userData&&sn.userData.setActive)sn.userData.setActive(false);z.add(own(track("miya",sn)));S.assets.snowfall=sn;
  }
  function buildCrows(){
    const M=MODS(),q=S.quality,z=S.zones.miya;if(!z)return;
    // 夕焼けの西の空を、ねぐら(北西の山)へ急ぐ三、四羽と二、三羽
    const groups=[{count:4,center:[34,26,-30],dir:[-1,-.32],speed:9.5,delay:0},{count:3,center:[46,22,-14],dir:[-1,-.28],speed:10.5,delay:3.2}];
    const cr=safeMake("miya-crows",()=>{if(M.NAT&&M.NAT.makeCrowFlock)return M.NAT.makeCrowFlock({groups,quality:q});
      if(M.NAT&&M.NAT.makeCrows){const g=new THREE.Group();g.name="crow-groups";const subs=groups.map(G=>{const c=M.NAT.makeCrows({count:G.count,center:G.center,dir:G.dir,spread:3.5,speed:G.speed,quality:q});g.add(c);return c;});
        g.userData.update=(dt,t)=>subs.forEach(s=>{if(s.userData.update)s.userData.update(dt,t);});g.userData.dispose=()=>subs.forEach(s=>{if(s.userData.dispose)s.userData.dispose();});return g;}
      return null;},()=>fbGroup("crows"));
    cr.visible=false;z.add(own(track("miya",cr)));S.assets.crows=cr;
  }
  function buildGeese(){
    const M=MODS(),q=S.quality,z=S.zones.miya;if(!z)return;
    const ge=safeMake("miya-geese",()=>M.NAT&&M.NAT.makeGeese?M.NAT.makeGeese({count:11,formation:"hook",center:[30,92,-120],dir:[-1,.18],speed:13,spacing:2.6,quality:q}):null,()=>fbGroup("geese"));
    ge.visible=false;z.add(own(track("miya",ge)));S.assets.geese=ge;
  }

  /* ---------- 接写セット(実寸で作って MACRO_SCALE 倍) ---------- */
  function macroSet(zone,label,fn){const z=zoneGroup(zone);const set=safeMake(label,fn,()=>{const g=fbGroup(label);const b=fbBox(.12,.004,.02,0x4a6a3a);g.add(b);return g;});
    set.scale.setScalar(MACRO_SCALE);z.add(own(track(zone,set)));return set;}
  const perchOn=(set,obj)=>{const p=set.userData&&set.userData.perch;(p||set).add(obj);return obj;};
  function buildHotaruSet(){const M=MODS(),q=S.quality;
    S.assets.hotaruSet=macroSet("hotaru","hotaru-set",()=>M.FLO&&M.FLO.makeNightLeafMacroSet?M.FLO.makeNightLeafMacroSet({quality:q}):null);
    S.assets.hotaru=perchOn(S.assets.hotaruSet,own(track("hotaru",safeMake("genji-botaru",()=>M.INS&&M.INS.makeGenjiBotaru?M.INS.makeGenjiBotaru({pose:"rest",quality:q}):null,
      ()=>{const g=fbGroup("hotaru");const b=fbBox(.005,.004,.015,0x1a1a18);b.position.y=.002;g.add(b);const l=fbBox(.004,.002,.004,0xc6ff5a);l.material.emissive=new THREE.Color(0xc6ff5a);l.position.set(0,.001,-.006);g.add(l);return g;}))));
    // 蛍自身の光(発光器のそば)
    const pl=new THREE.PointLight(0xc6ff5a,0,.06,2);pl.name="hotaru-glow";const anc=S.assets.hotaru.userData&&S.assets.hotaru.userData.lightAnchor;(anc||S.assets.hotaru).add(pl);S.assets.hotaruLight=pl;
  }
  function buildShimoSet(){const M=MODS(),q=S.quality;
    S.assets.shimoSet=macroSet("shimo","shimo-set",()=>M.FLO&&M.FLO.makeFrostMacroSet?M.FLO.makeFrostMacroSet({quality:q}):null);}
  function buildSuzuSet(){const M=MODS(),q=S.quality;
    S.assets.suzuSet=macroSet("suzu","suzu-set",()=>M.FLO&&M.FLO.makeStalkMacroSet?M.FLO.makeStalkMacroSet({quality:q}):null);
    S.assets.suzumushi=perchOn(S.assets.suzuSet,own(track("suzu",safeMake("suzumushi",()=>M.INS&&M.INS.makeSuzumushi?M.INS.makeSuzumushi({quality:q}):null,
      ()=>{const g=fbGroup("suzumushi");const b=fbBox(.008,.005,.02,0x111111);b.position.y=.003;g.add(b);return g;}))));}

  /* ============================================================
     段階的な組み立て(徒然草と同じ): いま見る場に要る素材だけを先に作り、残りは見ている間に一件ずつ作る。
     素材作りは一件で数百ms〜数秒の同期処理なので、カメラが止まっている間(本文を読んでいる間)にだけ作る。
  ============================================================ */
  const JOB_DEFS={sky:buildSky,miya:buildMiya,sei:buildSei,swarm:buildSwarm,hotaru:buildHotaruSet,rain:buildRain,crows:buildCrows,geese:buildGeese,
    suzu:buildSuzuSet,snow:buildSnow,shimo:buildShimoSet,"nyobo-carry":buildNyoboCarry,"nyobo-tend":buildNyoboTend,hioke:buildHioke};
  const JOB_ORDER=["sky","miya","sei","swarm","hotaru","rain","crows","geese","suzu","snow","shimo","nyobo-carry","hioke","nyobo-tend"];
  const BEAT_JOBS=[
    ["sky","miya","sei"],["sky","miya","sei"],["sky","miya","sei"],                 // 1〜3 春の夜明け
    ["sky","miya","sei"],["sky","miya","swarm"],["hotaru","sky","miya","swarm"],["sky","miya","rain","sei"], // 4〜7 夏の夜
    ["sky","miya","sei"],["sky","miya","crows"],["sky","miya","geese"],["sky","miya","suzu"],                // 8〜11 秋の夕暮れ
    ["sky","miya","sei","snow"],["shimo","sky","miya"],["sky","miya","nyobo-carry","hioke","nyobo-tend","snow"],["sky","miya","hioke","nyobo-tend"] // 12〜15 冬の早朝
  ];
  function runJob(name){
    if(!S.active||S.done[name])return;S.done[name]=true;
    const before=new Set(Object.keys(S.zones));const t0=performance.now();
    try{JOB_DEFS[name]();}catch(e){console.error("[makura] job "+name+":",e);}
    // 新しく出来たゾーン(または既存ゾーンへ足した物)のシェーダーを先に用意する
    try{const zs=Object.keys(S.zones).filter(k=>!before.has(k)||k==="miya");
      const vis={};Object.keys(S.zones).forEach(k=>{vis[k]=S.zones[k].visible;S.zones[k].visible=zs.indexOf(k)>=0||vis[k];});
      const hidden=[];if(name!=="miya")["swarm","rain","snowfall","crows","geese","hioke","sei","nyoboCarry","nyoboTend"].forEach(k=>{const o=S.assets[k];if(o&&!o.visible){o.visible=true;hidden.push(o);}});
      const sv=S.sky?S.sky.visible:false;if(S.sky)S.sky.visible=true;
      const added=S.stage&&!S.stage.parent;if(added)scene.add(S.stage);
      if(S.stage)S.stage.visible=true;
      if(typeof renderer!=="undefined"&&renderer&&renderer.compile)renderer.compile(scene,camera);
      if(added)scene.remove(S.stage);
      hidden.forEach(o=>{o.visible=false;});
      Object.keys(S.zones).forEach(k=>{S.zones[k].visible=vis[k];});if(S.sky)S.sky.visible=sv;
    }catch(e){}
    S.jobMs[name]=Math.round(performance.now()-t0);
  }
  function ensureBeat(i){(BEAT_JOBS[i]||[]).forEach(runJob);}
  function pumpJobs(){
    if(!S.active||S.pumpTimer)return;
    S.pumpTimer=setTimeout(()=>{S.pumpTimer=null;if(!S.active)return;
      const next=JOB_ORDER.find(n=>!S.done[n]);if(!next)return;
      if(!cameraAtRest()||document.hidden||S.pendingBeat){pumpJobs();return;}
      runJob(next);pumpJobs();},700);
  }
  function cameraAtRest(){const n=S.shots.length;if(!n)return false;const sh=S.shots[S.shotIdx];
    return S.shotIdx>=n-1&&!!sh&&S.shotT>=(sh.dur||8)+.8;}

  /* ============================================================
     カメラ割り(各場の shots)
       zone   : ゾーン名
       cam/to : {pos:[x,y,z], look:[x,y,z]} ゾーン局所座標(macro:true のときはセット局所の実寸座標)
       camFn(): 素材のアンカー(座の位置など)から cam/to を計算して返す
       dur    : 秒(最後のショットは動き終えるとその構図で止まる)
       fov/fovTo, light(プリセット名 or {preset,over}), lightTo{preset,over,dur,delay}
       shadow : {center:[x,y,z](局所), half}
       fade   : 前のショットから切り替える時の暗転/白転
       lamp   : 燈台の灯 {on,intensity,distance,decay}
       enter(ctx)/tick(ctx,u,t): 演出の差し込み
  ============================================================ */
  // 清少納言の頭のまわりから撮る(座の位置が殿舎のアンカーで決まるため、場の頭で計算する)
  function seiCam(dx,dy,dz,lx,ly,lz){const a=anchorPos("seatHashi",[-1.6,1.26,-2.1]).pos;return {pos:[a.x+dx,a.y+dy,a.z+dz],look:[a.x+lx,a.y+ly,a.z+lz]};}
  function seiShot(from,to){return ()=>({cam:seiCam(...from),to:seiCam(...to)});}
  function resetDynamic(){
    ["swarm","rain","crows","geese"].forEach(k=>{const o=S.assets[k];if(o)o.visible=false;});
    const sn=S.assets.snowfall;if(sn){sn.visible=false;if(sn.userData.setActive)sn.userData.setActive(false);}
    ["sei","nyoboCarry","nyoboTend","hioke"].forEach(k=>{const o=S.assets[k];if(o)o.visible=false;});
    if(S.assets.lamp)S.assets.lamp.visible=false;
    const nc=S.assets.nyoboCarry;if(nc)nc.userData.walking=false;
  }
  function act(o,on){if(!o)return;o.visible=on;if(o.userData&&o.userData.setActive)try{o.userData.setActive(on?1:0);}catch(e){}}
  function setIntensity(o,v){if(o&&o.userData&&o.userData.setIntensity)try{o.userData.setIntensity(v);}catch(e){}}

  const BEAT_SHOTS=[
    /* 1 春はあけぼの。 */
    [{zone:"miya",light:"akebonoDark",fov:42,camFn:seiShot([7.5,1.2,9.5,-1.2,.25,-.6],[6.4,1.15,8.2,-1.2,.25,-.6]),dur:7,shadow:{center:[-2,0,-1],half:16},lamp:{on:true,intensity:.9,distance:5,decay:2},
      enter(){seasonMiya("spring");setNight(.55);setMisu(.55);setShitomi(1);showSei("spring",Math.PI*.42);S.assets.lamp.visible=true;S.labelFig.sei=S.assets.sei;S.assets.sei.userData.hideLabel=false;playOnce(SND.kane,.32,1.2);}},
     {zone:"miya",light:"akebonoDark",fade:"black",fov:30,frameUp:.18,camFn:seiShot([1.15,.95,.85,0,.78,0],[1.0,.93,.75,0,.78,0]),dur:6,shadow:{center:[-1.6,1.2,-2],half:4},lamp:{on:true,intensity:.8,distance:5,decay:2},
      enter(){S.labelFig={};}}],
    /* 2 やうやう白くなりゆく山ぎは、すこしあかりて、 */
    [{zone:"miya",light:"akebonoDark",lightTo:{preset:"akebonoWhite",dur:9,delay:.8},fov:44,camFn:seiShot([-.9,1.0,-.6,40,6,-10],[-.7,1.0,-.5,40,6.5,-10]),dur:11,shadow:{center:[2,0,0],half:22},lamp:{on:true,intensity:.6,fadeTo:.35,fadeDur:10,distance:5,decay:2},
      enter(){seasonMiya("spring");setNight(.4);setMisu(.55);showSei("spring",Math.PI*.42);S.assets.lamp.visible=true;}}],
    /* 3 紫だちたる雲のほそくたなびきたる。 */
    // 望遠: 東山の稜線の上(方位およそ 72°→88°、仰角 7〜8°)にたなびく紫の雲
    [{zone:"miya",light:"akebonoWhite",lightTo:{preset:"akebonoAkari",dur:7,delay:.3},fov:15,fovTo:13.5,frameUp:0,cam:{pos:[2,2.2,0],look:[382,56,-123]},to:{pos:[2,2.2,0],look:[402,56,-14]},dur:9,shadow:{center:[0,0,0],half:22},
      enter(){seasonMiya("spring");setNight(.2);}},
     {zone:"miya",light:"akebonoAkari",fade:"black",fov:28,frameUp:.15,camFn:seiShot([1.0,.92,.55,0,.8,0],[.92,.9,.5,0,.8,0]),dur:7,shadow:{center:[-1.6,1.2,-2],half:4},
      enter(){showSei("spring",Math.PI*.42);setMisu(.55);playOnce(SND.uguisu,.34,1.4);}}],
    /* 4 夏は夜。月のころはさらなり、 */
    [{zone:"miya",light:"natsuTsukiyo",fov:46,cam:{pos:[6.5,1.6,24],look:[-12,1,8]},to:{pos:[5.5,1.5,22],look:[-12,1,8]},dur:9,shadow:{center:[-8,0,14],half:26},lamp:{on:true,intensity:.7,distance:5,decay:2},
      enter(){seasonMiya("summer");setNight(.7);setMisu(.35);setShitomi(1);showSei("summer",Math.PI*.15);S.assets.lamp.visible=true;}},
     {zone:"miya",light:"natsuTsukiyo",fade:"black",fov:34,frameUp:.2,camFn:seiShot([1.4,.6,2.2,0,.75,0],[1.25,.6,1.95,0,.75,0]),dur:7,shadow:{center:[-1.6,1.2,-2],half:5},lamp:{on:true,intensity:.7,distance:5,decay:2}}],
    /* 5 闇もなほ、蛍の多く飛びちがひたる。 */
    [{zone:"miya",light:"natsuYami",fov:48,cam:{pos:[4.8,.9,11.2],look:[12.4,.6,-4.5]},to:{pos:[5.6,.85,9.8],look:[12.2,.6,-5.2]},dur:11,shadow:{center:[9,0,2],half:16},lamp:{on:true,intensity:.45,distance:5,decay:2},
      enter(){seasonMiya("summer");setNight(.85);setMisu(.2);act(S.assets.swarm,true);S.assets.lamp.visible=true;}},
     {zone:"miya",light:"natsuYami",fade:"black",fov:52,cam:{pos:[18,2.4,4],look:[6,1.2,-7]},to:{pos:[17,2.3,3],look:[6,1.2,-7.5]},dur:8,shadow:{center:[10,0,-4],half:16},lamp:{on:true,intensity:.45,distance:5,decay:2},
      enter(){act(S.assets.swarm,true);}}],
    /* 6 また、ただ一つ二つなど、ほのかにうち光りて行くもをかし。 */
    [{zone:"hotaru",macro:true,light:{preset:"natsuYami",over:{hemi:{intensity:.06},ambient:{intensity:.03}}},fov:30,useHint:true,drift:[.003,.0015,-.004],dur:11,shadow:{center:[0,0,0],half:3},
      enter(){const h=S.assets.hotaru;if(h&&h.userData){h.userData.flashing=true;if(h.userData.setGlow)h.userData.setGlow(1);}S._flew=false;},
      tick(ctx,u,t){const h=S.assets.hotaru,L=S.assets.hotaruLight;const g=(h&&h.userData&&h.userData.glow!=null)?h.userData.glow:(.5+.5*Math.sin(t*3.1));if(L)L.intensity=.9*g;
        if(!S._flew&&t>7.2&&h&&h.userData&&h.userData.takeOff){S._flew=true;try{h.userData.takeOff(2.5);}catch(e){}}}},
     {zone:"miya",light:"natsuYami",fade:"black",fov:40,cam:{pos:[3.6,1.9,4.6],look:[-1.2,1.4,-1.2]},to:{pos:[3.2,1.85,4.2],look:[-1.2,1.4,-1.2]},dur:7,shadow:{center:[-1,0,0],half:10},lamp:{on:true,intensity:.55,distance:5,decay:2},
      enter(){setNight(.85);const sw=S.assets.swarm;act(sw,true);if(sw&&sw.userData.setActive)sw.userData.setActive(.08);S.assets.lamp.visible=true;}}],
    /* 7 雨など降るもをかし。 */
    [{zone:"miya",light:"natsuAmeYoru",fov:44,cam:{pos:[-6,1.2,15.5],look:[-13,-.2,24]},to:{pos:[-6.4,1.15,15.9],look:[-13,-.25,24]},dur:8,shadow:{center:[-12,0,22],half:16},
      enter(){seasonMiya("summer");setNight(.9);setMisu(0);act(S.assets.rain,true);setIntensity(S.assets.rain,1);const p=S.assets.pond;if(p&&p.userData.setRipple)p.userData.setRipple(.9);}},
     {zone:"miya",light:"natsuAmeYoru",fade:"black",fov:40,frameUp:.1,camFn:seiShot([1.6,.35,3.4,0,1.0,-.2],[1.45,.35,3.15,0,1.0,-.2]),dur:8,shadow:{center:[-1.6,1.2,-2],half:6},lamp:{on:true,intensity:1.0,distance:6,decay:2},
      enter(){act(S.assets.rain,true);setIntensity(S.assets.rain,1);showSei("summer",Math.PI*.1);setMisu(0);S.assets.lamp.visible=true;}}],
    /* 8 秋は夕暮れ。夕日のさして山の端いと近うなりたるに、 */
    [{zone:"miya",light:"akiYuhi",fov:46,cam:{pos:[6,1.5,20],look:[-60,9,-4]},to:{pos:[5,1.5,19],look:[-60,7,-4]},dur:10,shadow:{center:[-4,0,8],half:28},
      enter(){seasonMiya("autumn");setNight(0);setMisu(.6);setShitomi(1);showSei("autumn",-Math.PI*.35);const p=S.assets.pond;if(p&&p.userData.setRipple)p.userData.setRipple(.1);}},
     {zone:"miya",light:"akiYuhi",fade:"black",fov:30,frameUp:.15,camFn:seiShot([.6,.88,1.15,0,.78,0],[.52,.86,1.02,0,.78,0]),dur:7,shadow:{center:[-1.6,1.2,-2],half:4}}],
    /* 9 烏の寝どころへ行くとて、三つ四つ、二つ三つなど飛びいそぐさへあはれなり。 */
    [{zone:"miya",light:"akiYuhi",fov:52,cam:{pos:[4,1.4,14],look:[-30,22,-30]},to:{pos:[4,1.4,14],look:[-36,20,-34]},dur:11,shadow:{center:[0,0,4],half:24},
      enter(){seasonMiya("autumn");act(S.assets.crows,true);if(S.assets.crows.userData.reset)S.assets.crows.userData.reset();playOnce(SND.karasu,.5,.8);}},
     {zone:"miya",light:"akiYuhi",fade:"black",fov:20,cam:{pos:[4,1.4,14],look:[-10,24,-30]},to:{pos:[4,1.4,14],look:[-24,23,-36]},dur:7,shadow:{center:[0,0,4],half:24},
      enter(){act(S.assets.crows,true);}}],
    /* 10 まいて雁などの連ねたるが、いと小さく見ゆるは、いとをかし。 */
    [{zone:"miya",light:{preset:"akiYuhi",over:{sun:{intensity:.8}}},lightTo:{preset:"akiHiiri",dur:14,delay:1},fov:54,cam:{pos:[2,1.4,12],look:[-10,60,-90]},to:{pos:[2,1.4,12],look:[-26,58,-90]},dur:9,shadow:{center:[0,0,4],half:24},
      enter(){seasonMiya("autumn");act(S.assets.geese,true);if(S.assets.geese.userData.reset)S.assets.geese.userData.reset();playOnce(SND.kari,.42,.6);}},
     {zone:"miya",light:"akiHiiri",fade:"black",fov:16,cam:{pos:[2,1.4,12],look:[-24,86,-118]},to:{pos:[2,1.4,12],look:[-44,86,-118]},dur:7,shadow:{center:[0,0,4],half:24},
      enter(){act(S.assets.geese,true);}}],
    /* 11 日入り果てて、風の音、虫の音など、はた言ふべきにあらず。 */
    [{zone:"miya",light:"akiHiiri",fov:44,cam:{pos:[9.5,.9,9.8],look:[2,1.6,-1.5]},to:{pos:[8.8,.9,9.0],look:[2,1.6,-1.5]},dur:9,shadow:{center:[2,0,2],half:14},lamp:{on:true,intensity:.8,distance:6,decay:2},
      enter(){seasonMiya("autumn");setNight(.6);setMisu(.3);S.assets.lamp.visible=true;const g=S.assets.grass;if(g&&g.userData.setWind)g.userData.setWind(1);}},
     {zone:"suzu",macro:true,light:"akiHiiri",fade:"black",fov:30,useHint:true,drift:[.002,.001,-.003],dur:10,shadow:{center:[0,0,0],half:3},
      enter(){const s=S.assets.suzumushi;if(s&&s.userData.setSinging)s.userData.setSinging(1);}}],
    /* 12 冬はつとめて。雪の降りたるは言ふべきにもあらず、 */
    [{zone:"miya",light:"fuyuYukiAsa",fov:46,cam:{pos:[8.5,2.0,18],look:[-4,2.2,-2]},to:{pos:[7.6,1.9,16.6],look:[-4,2.2,-2]},dur:10,shadow:{center:[-2,0,4],half:22},
      enter(){S.snowCover=1;seasonMiya("winter");setNight(.15);setMisu(.4);setShitomi(1);act(S.assets.snowfall,true);setIntensity(S.assets.snowfall,1);showSei("winter",Math.PI*.2);}},
     {zone:"miya",light:"fuyuYukiAsa",fade:"black",fov:30,frameUp:.15,camFn:seiShot([1.2,.85,.9,0,.8,0],[1.08,.84,.8,0,.8,0]),dur:7,shadow:{center:[-1.6,1.2,-2],half:4},
      enter(){act(S.assets.snowfall,true);}}],
    /* 13 霜のいと白きも、またさらでもいと寒きに、 */
    [{zone:"shimo",macro:true,light:"fuyuShimoAsa",fov:30,useHint:true,drift:[.003,.001,-.004],dur:10,shadow:{center:[0,0,0],half:3}},
     {zone:"miya",light:"fuyuShimoAsa",fade:"white",fov:48,cam:{pos:[12,1.1,12],look:[-2,1.2,-2]},to:{pos:[11,1.05,11],look:[-2,1.2,-2]},dur:8,shadow:{center:[2,0,2],half:20},
      enter(){S.snowCover=.35;seasonMiya("winter");setNight(0);setMisu(.4);}}],
    /* 14 火など急ぎおこして、炭持て渡るも、いとつきづきし。 */
    [{zone:"miya",light:{preset:"fuyuShimoAsa",over:{exposure:1.0}},fov:42,cam:{pos:[9.5,2.0,-3.2],look:[6,1.8,-8.4]},to:{pos:[9.0,2.0,-3.6],look:[3.5,1.8,-8.4]},dur:10,shadow:{center:[8,0,-8],half:12},
      enter(){S.snowCover=1;seasonMiya("winter");setNight(0);setMisu(.4);const f=S.assets.nyoboCarry;if(f){f.visible=true;f.userData.walking=true;f.userData.walkSpeed=.55;S._walk={t:0};S.labelFig.nyobo=f;f.userData.hideLabel=false;}playOnce(SND.kinuzure,.35,.4);},
      tick(ctx,u,t){const f=S.assets.nyoboCarry,W=MIYA.watadono;if(!f)return;const k=Math.min(1,t/10);
        const wa=S.assets.watadono,path=wa&&wa.userData&&wa.userData.anchors&&wa.userData.anchors.walkPath;
        const fy=(path&&path.isObject3D)?null:1.0;
        const x=lerp(W.to[0]-1.2,W.from[0]+1.0,k),zz=lerp(W.to[1],W.from[1],k);
        f.position.set(x,fy!=null?(wa&&wa.userData&&wa.userData.floorY!=null?wa.userData.floorY:1.0):1.0,zz);f.rotation.y=-Math.PI/2;f.userData.walking=k<1;}},
     {zone:"miya",light:{preset:"fuyuShimoAsa",over:{exposure:1.0}},fade:"black",fov:34,frameUp:.1,camFn(){const a=anchorPos("seatHashi",[-1.6,1.26,-2.1]).pos;const x=a.x-1.6;
        return {cam:{pos:[x+1.25,a.y+.95,a.z+1.15],look:[x+.55,a.y+.2,a.z]},to:{pos:[x+1.12,a.y+.9,a.z+1.0],look:[x+.55,a.y+.2,a.z]}};},dur:8,shadow:{center:[-3.2,1.2,-2],half:4},
      enter(){placeHiokeScene();const h=S.assets.hioke;if(h&&h.userData.setBurn)h.userData.setBurn(.05);S.labelFig={};playOnce(SND.sumi,.4,.3);},
      tick(ctx,u,t){const h=S.assets.hioke;if(h&&h.userData.setBurn)h.userData.setBurn(.05+.08*u);}}],
    /* 15 昼になりて、ぬるくゆるびもていけば、火桶の火も白き灰がちになりてわろし。 */
    [{zone:"miya",light:"fuyuShimoAsa",lightTo:{preset:"fuyuHiru",dur:12,delay:.5},fov:24,frameUp:0,camFn(){const a=anchorPos("seatHashi",[-1.6,1.26,-2.1]).pos;const x=a.x-1.6+.55;
        return {cam:{pos:[x+.42,a.y+.62,a.z+.36],look:[x,a.y+.2,a.z]},to:{pos:[x+.36,a.y+.55,a.z+.30],look:[x,a.y+.2,a.z]}};},dur:13,shadow:{center:[-2.6,1.2,-2],half:3},
      enter(){S.snowCover=.6;seasonMiya("winter");setNight(0);placeHiokeScene();const t=S.assets.nyoboTend;if(t)t.visible=false;const h=S.assets.hioke;if(h&&h.userData.setBurn)h.userData.setBurn(.2);},
      tick(ctx,u,t){const h=S.assets.hioke;if(h&&h.userData.setBurn)h.userData.setBurn(lerp(.2,1,clamp01(t/11)));}}]
  ];

  /* ============================================================
     音(実録音のループと一回鳴らし)
  ============================================================ */
  // 環境音(仮): 枕草子用の実録音(CC0/CC BY)が揃うまで、収録済みの環境音で代える。差し替える時は sounds/CREDITS.md も更新する
  const SND={yoake:"night_wind2.mp3",uguisu:"ani_ge_uguisu01.mp3",natsuYoru:"frogs2.mp3",water:"spring_water_on_Mt2.mp3",ame:null,
    kaze:"night_wind2.mp3",karasu:null,kari:"kari.mp3",mushi:"suzumushi.mp3",mushi2:"matumsuhi.mp3",fuyu:"night_wind2.mp3",kinuzure:null,sumi:"takibi.mp3",kane:"kane_bonsho.mp3"};
  const mix=(o)=>{const r={};Object.keys(o).forEach(k=>{const f=SND[k];if(f)r[f]=Math.max(r[f]||0,o[k]);});return r;};
  const BEAT_AUDIO=[
    mix({yoake:.06}),                       // 1 夜明け前の静けさ(暁の鐘は一回鳴らし)
    mix({uguisu:.18,yoake:.05}),            // 2 山ぎわが白む
    mix({uguisu:.22}),                      // 3 紫の雲
    mix({natsuYoru:.16,water:.10}),         // 4 夏の月夜(蛙・せせらぎ)
    mix({natsuYoru:.20,water:.14}),         // 5 闇の蛍
    mix({water:.12,natsuYoru:.06}),         // 6 ひとつふたつ
    mix({ame:.42,natsuYoru:.06,water:.08}), // 7 夜の雨
    mix({kaze:.14}),                        // 8 夕日
    mix({kaze:.10}),                        // 9 烏(鳴き声は一回鳴らし)
    mix({kaze:.08}),                        // 10 雁(鳴き声は一回鳴らし)
    mix({kaze:.18,mushi:.20,mushi2:.10}),   // 11 風の音・虫の音
    mix({fuyu:.08}),                        // 12 雪の朝
    mix({fuyu:.06}),                        // 13 霜
    mix({fuyu:.05,sumi:.14}),               // 14 炭持て渡る
    mix({sumi:.08})                         // 15 白き灰がち
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
    if(!file)return;
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
  // frameUp: 主役を画面のやや上に置く(下半分は本文パネルが覆うため)
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
      const set={hotaru:S.assets.hotaruSet,shimo:S.assets.shimoSet,suzu:S.assets.suzuSet}[sh.zone];
      const h=set&&set.userData&&set.userData.cameraHint;
      const pos=h&&h.position?arr3(h.position):[.1,.04,.16],target=h&&h.target?arr3(h.target):[0,0,0];
      const d=sh.drift||[0,0,0];
      return {from:{pos:zoneWorld(sh.zone,pos,true),look:zoneWorld(sh.zone,target,true)},
        to:{pos:zoneWorld(sh.zone,[pos[0]+d[0],pos[1]+d[1],pos[2]+d[2]],true),look:zoneWorld(sh.zone,target,true)},fov:(h&&h.fov)||sh.fov};
    }
    const f=sh.cam,t=sh.to||sh.cam;
    return {from:{pos:zoneWorld(sh.zone,f.pos,sh.macro),look:zoneWorld(sh.zone,f.look,sh.macro)},to:{pos:zoneWorld(sh.zone,t.pos,sh.macro),look:zoneWorld(sh.zone,t.look,sh.macro)},fov:sh.fov};
  }
  function activateZone(zone){
    Object.keys(S.zones).forEach(k=>{S.zones[k].visible=(k===zone);});
    S.curZone=zone;
    if(S.sky)S.sky.visible=true;
  }
  function startShot(i,first){
    const sh=S.shots[i];if(!sh)return;
    S.shotIdx=i;S.shotT=0;
    if(sh.fade&&!first&&typeof saigenFade==="function")saigenFade(sh.fade);
    activateZone(sh.zone);
    // enter を先に(季節・人物の配置を決めてから、それに合わせたカメラを計算する)
    S.lampCfg=sh.lamp||null;
    if(sh.enter)try{sh.enter({S});}catch(e){console.error("[makura] shot enter:",e);}
    if(sh.camFn){try{const cf=sh.camFn();sh.cam=cf.cam;sh.to=cf.to;}catch(e){console.error("[makura] camFn:",e);}}
    if(!sh.cam&&!sh.useHint)sh.cam={pos:[6,1.6,10],look:[0,1.4,0]};
    const c=shotCam(sh);S.camPath=c;
    S.fovFrom=sh.fov||c.fov||50;S.fovTo=sh.fovTo||S.fovFrom;
    if(sh.light){const L=typeof sh.light==="string"?presetState(sh.light):presetState(sh.light.preset,sh.light.over);
      if(sh.sunRel){const f=c.from.look.clone().sub(c.from.pos).normalize(),up=new THREE.Vector3(0,1,0),r=new THREE.Vector3().crossVectors(f,up).normalize(),u=new THREE.Vector3().crossVectors(r,f).normalize();
        const d=r.multiplyScalar(sh.sunRel[0]).add(u.multiplyScalar(sh.sunRel[1])).add(f.multiplyScalar(sh.sunRel[2])).normalize();
        L.sunLight.dir=[d.x,Math.max(d.y,.06),d.z];L.sunDir=[d.x,d.y,d.z];
        if(L.rim)L.rim.dir=[-d.x,Math.abs(d.y)*.6+.35,-d.z];}
      setLight(L,0);}
    S.lightTo2=sh.lightTo||null;
    if(sh.shadow){S.shadowHalf=sh.shadow.half||20;S.shadowCenter.copy(zoneWorld(sh.zone,sh.shadow.center||[0,0,0],sh.macro));}
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
    if(sh.tick)try{sh.tick({S},u,S.shotT);}catch(e){console.error("[makura] shot tick:",e);}
    if(S.shotT>=(sh.dur||8)&&S.shotIdx<S.shots.length-1)startShot(S.shotIdx+1,false);
  }

  /* ============================================================
     本体から呼ばれる口(props.onBeat / update / dispose, SAIGEN_ENV_HOOK)
  ============================================================ */
  function onBeat(b,sc,st){
    if(!S.active)return;
    const i=(APP.saigen&&APP.saigen.i!=null)?APP.saigen.i:0;
    S.beat=i;
    // まだ作っていない素材がある場へ進んだ時(開幕の場を除く)は、先に暗幕と「絵を整えています」を描かせてから作る
    const missing=(BEAT_JOBS[i]||[]).filter(n=>!S.done[n]);
    if(missing.length&&S.started&&!S.syncBuild){
      S.shots=[];S.labelFig={};S.pendingBeat={i};showPrep(true);
      const go=()=>{const pb=S.pendingBeat;if(!S.active||!pb||pb.i!==i)return;S.pendingBeat=null;setupBeat(b,i);showPrep(false);};
      requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(go,0)));
      return;
    }
    S.pendingBeat=null;showPrep(false);setupBeat(b,i);
  }
  function showPrep(on){
    let el=document.getElementById("sgPrep");
    if(!el){if(!on)return;el=document.createElement("div");el.id="sgPrep";el.setAttribute("aria-live","polite");el.innerHTML="<span>絵を整えています…</span>";document.body.appendChild(el);}
    el.classList.toggle("show",!!on);
  }
  function setupBeat(b,i){
    S.shots=BEAT_SHOTS[i]||[];
    const tb=performance.now();ensureBeat(i);
    if(performance.now()-tb>50&&typeof console!=="undefined")console.log("[makura] beat "+(i+1)+" assets ready in "+Math.round(performance.now()-tb)+"ms (quality "+S.quality+")");
    // 前の場の残り(蛍・雨・雪・鳥・人物・灯)をいったん片付け、各ショットの enter で必要なものだけ出す
    resetDynamic();
    S.labelFig={};
    [S.assets.sei,S.assets.nyoboCarry,S.assets.nyoboTend].forEach(f=>{if(f&&f.userData)f.userData.hideLabel=true;});
    const s=S.assets.suzumushi;if(s&&s.userData.setSinging)s.userData.setSinging(0);
    startShot(0,true);
    setLoops(BEAT_AUDIO[i]||{});
    S.started=true;
    pumpJobs();
  }
  let _lastT=0;
  function update(dt,t){
    if(!S.active)return;
    _lastT=t;
    tickShot(dt);
    if(S.lightTo){S.lightU=Math.min(1,S.lightU+dt/Math.max(.1,S.lightDur));S.light=blendState(S.lightFrom,S.lightTo,ease(S.lightU));S.lightDirty=true;
      if(S.lightU>=1){S.light=S.lightTo;S.lightTo=null;S.lightFrom=null;}}
    const L=S.light;
    if(S.sky&&S.sky.visible&&L){
      if(S.lightDirty&&S.sky.userData.setState)S.sky.userData.setState(L);
      if(S.sky.userData.update)S.sky.userData.update(dt,t,camera);
    }
    if(L&&S.lightDirty){applyTints(L);S.lightDirty=false;}
    const ups=S.zoneUpdaters[S.curZone]||[];
    const sunDir=L&&L.sunDir?V(L.sunDir).normalize():null;
    const sunC=L&&L.sunLight?L.sunLight.color:0xffffff,sunI=L&&L.sunLight?L.sunLight.intensity:1;
    for(let k=0;k<ups.length;k++){const o=ups[k];if(!o.visible)continue;
      try{if(sunDir&&o.userData.setSun)o.userData.setSun(sunDir,sunC,sunI);o.userData.update(dt,t,camera);}catch(e){if(!o.userData._warned){o.userData._warned=true;console.error("[makura] asset update:",e);}}}
    syncLabelProxies();
    updateAudio(dt);
  }
  function syncLabelProxies(){
    if(!S.proxy)return;
    Object.keys(S.proxy).forEach(k=>{const o=S.proxy[k],f=S.labelFig&&S.labelFig[k];
      let vis=!!f;for(let p=f;vis&&p;p=p.parent){if(p.visible===false)vis=false;if(p===S.stage)break;}
      o.visible=vis;if(!vis){o.userData.hideLabel=true;return;}
      f.getWorldPosition(o.position);o.userData.labelY=f.userData.labelY||1.3;o.userData.bubbleY=f.userData.bubbleY||1.1;o.userData.hideLabel=!!f.userData.hideLabel;});
  }
  // 山・遣水・池へ、場の光の色合いを渡す
  function applyTints(L){
    const sd=L.sunDir;
    const each=(list,fn)=>list.forEach(o=>{if(o&&o.userData)try{fn(o.userData);}catch(e){}});
    if(L.hills)each([S.assets.ridges],u=>{if(u.setTint)u.setTint(Object.assign({sunDir:sd},L.hills));});
    if(L.water)each([S.assets.stream,S.assets.pond],u=>{if(u.setSky)u.setSky(Object.assign({},L.water,{sunDir:sd}));});
  }
  function lampWorldPos(){
    const lamp=S.assets.lamp;if(!lamp)return null;
    const f=lamp.userData&&lamp.userData.flame;const o=f||lamp;
    o.updateMatrixWorld(true);return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
  }
  function envHook(dt){
    if(!S.active)return;
    const L=S.light;
    const sh=S.shots[S.shotIdx];
    // 灯: 燈台(廂の奥)か、火桶の炭火
    const h=S.assets.hioke;
    if(S.lampCfg&&S.lampCfg.on&&S.assets.lamp&&S.assets.lamp.visible){
      const p=lampWorldPos();
      if(p){interiorLight.position.copy(p);interiorLight.position.y+=.05;}
      const lamp=S.assets.lamp;
      if(lamp.userData.setLit)lamp.userData.setLit(true);
      let k=S.lampCfg.intensity||1.0;
      if(S.lampCfg.fadeTo!=null){const u=clamp01(S.shotT/(S.lampCfg.fadeDur||8));k=lerp(k,S.lampCfg.fadeTo,u);if(lamp.userData.setIntensity)lamp.userData.setIntensity(lerp(1,.5,u));}
      const fl=(lamp.userData&&lamp.userData.flicker!=null)?lamp.userData.flicker:1;
      interiorLight.color.setHex(0xffa858);interiorLight.distance=S.lampCfg.distance||6;interiorLight.decay=S.lampCfg.decay||2;
      interiorLight.intensity=k*(.82+.18*fl);
    }else if(h&&h.visible&&h.userData&&h.userData.emberLight){
      const E=h.userData.emberLight;const p=(E.position&&E.position.isVector3)?E.position.clone():V(arr3(E.position||[0,.25,0]));
      h.localToWorld(p);interiorLight.position.copy(p);interiorLight.color.setHex(E.color!=null?E.color:0xff7a30);
      interiorLight.distance=E.distance||2.4;interiorLight.decay=2;interiorLight.intensity=(E.intensity!=null?E.intensity:1);
    }else interiorLight.intensity=0;
    if(!L)return;
    // 自前のゾーン: 空・霧・光を場の状態で上書き
    if(typeof cloudDome!=="undefined"&&cloudDome)cloudDome.visible=false;
    if(typeof sunMesh!=="undefined"&&sunMesh)sunMesh.visible=false;
    if(typeof moonMesh!=="undefined"&&moonMesh)moonMesh.visible=false;
    if(typeof moonHalo!=="undefined"&&moonHalo)moonHalo.visible=false;
    if(typeof moonPhaseShadow!=="undefined"&&moonPhaseShadow)moonPhaseShadow.visible=false;
    if(!S.bg)S.bg=new THREE.Color();
    S.bg.setHex(L.fog.color);scene.background=S.bg;
    if(scene.fog){scene.fog.color.setHex(L.fog.color);scene.fog.density=(sh&&sh.macro)?0:L.fog.density;}
    const SL=L.sunLight||{color:0xffffff,intensity:1,dir:[0,1,0]};
    sun.color.setHex(SL.color);sun.intensity=SL.intensity;
    const d=V(arr3(SL.dir)).normalize();
    sun.target.position.copy(S.shadowCenter);sun.target.updateMatrixWorld();
    sun.position.copy(S.shadowCenter).addScaledVector(d,Math.max(40,S.shadowHalf*2.2));
    const scm=sun.shadow.camera,hh=S.shadowHalf;
    if(scm.left!==-hh||scm.top!==hh){scm.left=-hh;scm.right=hh;scm.top=hh;scm.bottom=-hh;scm.near=.5;scm.far=Math.max(120,hh*5);scm.updateProjectionMatrix();}
    hemi.color.setHex(L.hemi.sky);hemi.groundColor.setHex(L.hemi.ground);hemi.intensity=L.hemi.intensity;
    ambient.color.setHex(L.ambient.color);ambient.intensity=L.ambient.intensity;
    if(typeof moon!=="undefined"&&moon)moon.intensity=0;
    rim.color.setHex(L.rim?L.rim.color:0xd8e4ff);rim.intensity=L.rim?L.rim.intensity:.12;
    const rd=(L.rim&&L.rim.dir)?V(arr3(L.rim.dir)).normalize():d.clone().multiplyScalar(-1).setY(.6).normalize();
    rim.position.copy(S.shadowCenter).addScaledVector(rd,60);if(rim.target){rim.target.position.copy(S.shadowCenter);rim.target.updateMatrixWorld();}
    renderer.toneMappingExposure=L.exposure;
    // 本編の雨は止める(場の雨は自前で降らせる)
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
    interiorLight.position.copy(s.il.pos);interiorLight.color.setHex(s.il.color);interiorLight.distance=s.il.distance;interiorLight.decay=s.il.decay;interiorLight.intensity=0;
    if(rim.target&&s.rimTarget){rim.target.position.copy(s.rimTarget);rim.target.updateMatrixWorld();}
    camera.near=s.camNear;camera.fov=62;camera.updateProjectionMatrix();
    if(typeof cloudDome!=="undefined"&&cloudDome)cloudDome.visible=true;
    S.saved=null;
  }

  function dispose(){
    if(!S.active&&!S.stage)return;
    S.active=false;
    if(S.pumpTimer){clearTimeout(S.pumpTimer);S.pumpTimer=null;}
    S.done={};S.proxy=null;S.labelFig={};S.started=false;S.pendingBeat=null;
    {const el=document.getElementById("sgPrep");if(el&&el.parentNode)el.parentNode.removeChild(el);}
    stopAudio();
    restoreGlobals();
    (S.assets.list||[]).forEach(o=>{try{if(o&&o.userData&&typeof o.userData.dispose==="function")o.userData.dispose();}catch(e){console.error("[makura] dispose:",e);}});
    if(S.assets.hotaruLight&&S.assets.hotaruLight.parent)S.assets.hotaruLight.parent.remove(S.assets.hotaruLight);
    _fallbackMats.forEach(m=>{try{m.dispose();}catch(e){}});_fallbackMats.length=0;
    S.assets={};S.zones={};S.zoneUpdaters={};S.actors={};S.sky=null;S.stage=null;S.shots=[];S.light=null;S.lightTo=null;S.lampCfg=null;S.snowCover=null;
    if(window.SAIGEN_ENV_HOOK===envHook)window.SAIGEN_ENV_HOOK=null;
  }

  /* ---------- 舞台の組み立て(本体の buildSaigenStage から) ---------- */
  function build(stage){
    dispose();
    S.stage=stage;S.active=true;S.quality=qualityKey();S.assets={};S.actors={};S.done={};S.jobMs={};S.timing=S.timing||null;S.started=false;S.pendingBeat=null;S.season="spring";
    saveGlobals();
    // 名札の代理点(本体の名札は figure.position をワールド座標として扱うため、ゾーンの子になった人物の頭上位置を毎フレームここへ写す)
    S.proxy={};S.labelFig={};
    [["sei","清少納言"],["nyobo","女房"]].forEach(([k,name])=>{const o=new THREE.Object3D();o.name="makura-label-"+k;
      o.userData={saigenCustom:true,label:name,cname:name,labelY:0,bubbleY:0,hideLabel:true};o.visible=false;stage.add(o);S.proxy[k]=o;S.actors[k]=o;});
    setLight(presetState("akebonoDark"),0);
    window.SAIGEN_ENV_HOOK=envHook;
    return {actors:S.actors,onBeat,update,dispose,makura:true};
  }
  SAIGEN_PROP_BUILDERS.makura=build;

  /* ============================================================
     本文(15場)。既存の4段の現代語訳を句で分けたもの
  ============================================================ */
  const BEATS=[
    {time:"dawn",fade:"black",
     honbun:"春はあけぼの。",
     yaku:"春は明け方（がよい）。",
     note:"あけぼの＝夜がほのぼのと明けはじめる頃（「あかつき」の終わりから「朝ぼらけ」の前まで）"},
    {time:"dawn",fade:"black",
     honbun:"やうやう白くなりゆく山ぎは、すこしあかりて、",
     yaku:"だんだんと白んでいく山の稜線のあたりの空が、少し明るくなって、",
     note:"やうやう＝だんだん／山ぎは＝山の稜線に接するあたりの空（「山の端」は稜線そのもの）／あかる＝明るくなる（赤みを帯びる、とする説もある）"},
    {time:"dawn",fade:"black",
     honbun:"紫だちたる雲のほそくたなびきたる。",
     yaku:"紫がかった雲が細く横に長く引いている（のは趣がある）。",
     note:"紫だつ＝紫色を帯びる／たなびく＝雲や霞が横に長く引く／「たる」で止めて、あとの「をかし」を言わずに余韻を残す（連体止め）"},
    {time:"night",fade:"black",
     honbun:"夏は夜。月のころはさらなり、",
     yaku:"夏は夜（がよい）。月の出ている頃は言うまでもない。",
     note:"さらなり＝言うまでもない（「言へばさらなり」の略）"},
    {time:"night",fade:"black",
     honbun:"闇もなほ、蛍の多く飛びちがひたる。",
     yaku:"（月の無い）闇夜もやはり、蛍がたくさん飛び交っている（のはよい）。",
     note:"なほ＝やはり／飛びちがふ＝入り乱れて飛ぶ"},
    {time:"night",fade:"black",
     honbun:"また、ただ一つ二つなど、ほのかにうち光りて行くもをかし。",
     yaku:"また、ほんの一匹二匹などが、ほのかに光って飛んでいくのも趣がある。",
     note:"うち光る＝「うち」は軽く添える接頭語／をかし＝明るく知的な趣がある"},
    {time:"night",fade:"black",
     honbun:"雨など降るもをかし。",
     yaku:"雨などが降るのも趣がある。",
     note:"など＝例を挙げて、ほかにもあることを含ませる"},
    {time:"dusk",fade:"black",
     honbun:"秋は夕暮れ。夕日のさして山の端いと近うなりたるに、",
     yaku:"秋は夕暮れ（がよい）。夕日が差して山の稜線にたいそう近くなった頃に、",
     note:"山の端＝空と接する山の稜線／近う＝「近く」のウ音便"},
    {time:"dusk",fade:"black",
     honbun:"烏の寝どころへ行くとて、三つ四つ、二つ三つなど飛びいそぐさへあはれなり。",
     yaku:"烏がねぐらへ帰ろうとして、三羽四羽、二羽三羽と急いで飛んでいく様子までもが、しみじみと心を打つ。",
     note:"寝どころ＝ねぐら／さへ＝〜までも（添加）／あはれなり＝しみじみと心を打たれる"},
    {time:"dusk",fade:"black",
     honbun:"まいて雁などの連ねたるが、いと小さく見ゆるは、いとをかし。",
     yaku:"まして雁などが列をなして飛んでいるのが、とても小さく見えるのは、たいそう趣がある。",
     note:"まいて＝「まして」のイ音便／連ぬ＝列をなす"},
    {time:"dusk",fade:"black",
     honbun:"日入り果てて、風の音、虫の音など、はた言ふべきにあらず。",
     yaku:"日がすっかり沈んでしまって、風の音や虫の声などが聞こえるのは、これもまた言いようもない（ほどよい）。",
     note:"入り果つ＝すっかり沈む／はた＝これもまた／言ふべきにあらず＝言葉では言い尽くせない"},
    {time:"dawn",fade:"white",
     honbun:"冬はつとめて。雪の降りたるは言ふべきにもあらず、",
     yaku:"冬は早朝（がよい）。雪が降っている朝は言うまでもなく、",
     note:"つとめて＝早朝／言ふべきにもあらず＝言うまでもない"},
    {time:"dawn",fade:"white",
     honbun:"霜のいと白きも、またさらでもいと寒きに、",
     yaku:"霜がたいそう白く降りている朝も、またそうでなくてもとても寒い朝に、",
     note:"さらでも＝そうでなくても（「さあらでも」の約）"},
    {time:"dawn",fade:"black",
     honbun:"火など急ぎおこして、炭持て渡るも、いとつきづきし。",
     yaku:"火などを急いでおこして、炭を持って（廊下などを）通っていくのも、たいそう（冬の朝に）似つかわしい。",
     note:"おこす＝炭火を盛んにする／持て渡る＝持って通っていく／つきづきし＝似つかわしい"},
    {time:"day",fade:"white",
     honbun:"昼になりて、ぬるくゆるびもていけば、火桶の火も白き灰がちになりてわろし。",
     yaku:"昼になって、（寒さが）だんだんゆるんでいくと、火桶の火も白い灰ばかりになって、よくない。",
     note:"ぬるし＝（寒さが）和らぐ／ゆるぶ＝ゆるむ／もていく＝だんだん〜していく／がち＝〜が多い／わろし＝よくない、感心しない"}
  ];
  BEATS.forEach(b=>{b.speaker="seishonagon";});
  {
    const def={id:SCENE_ID,work:"枕草子",title:"第一段 春はあけぼの",author:"清少納言",unit:"場",
      env:"makura",buildProps:"makura",quietBg:true,quietUi:true,cast:[],beats:BEATS};
    const i=SAIGEN_SCENES.findIndex(s=>s.id===SCENE_ID);
    if(i>=0)SAIGEN_SCENES[i]=def;else SAIGEN_SCENES.unshift(def);
  }
  return {S,ZONES,MIYA,BEAT_SHOTS,BEATS,presetState,MACRO_SCALE,hMiya,anchorPos};
})();
