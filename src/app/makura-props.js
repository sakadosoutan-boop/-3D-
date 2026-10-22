/* =============================================================================
 makura-props.js — 枕草子 第一段「冬はつとめて」の調度（火桶・炭取・几帳）   →  const MAKURA_PROPS
 依存: THREE (r128) のみ。テクスチャはすべて canvas で手続き生成、乱数はシード付き（毎回同じ見た目）。
 単位 m / +Y 上。外部ファイル・画像は読まない。すべて castShadow / receiveShadow 設定済み。
 opts.quality = "high"|"medium"|"low"（low はテクスチャ解像度・分割・炭の本数・火の粉の数を減らす）。

 ── API ──────────────────────────────────────────────────────────────────────
 MAKURA_PROPS.makeHioke({quality, seed?, painted?:true, burn?:0}) -> THREE.Group      描画コール ≈ 9
   桐の丸火桶。外径 0.362m（胴の最大径）、高さ 0.274m（口縁上端）。原点 = 底面の中心（床に置く）。前後の向きは無い（回転対称、
   火箸だけ -X,-Z 寄りに挿してある＝カメラから見て奥左になるよう rotation.y で回してよい）。
   口縁は内へ巻き込み、内側に銅の落とし（口の銅の縁が見える）。灰の面 y≈0.208（中心がわずかに高い）に灰ならしの同心の筋。
   灰の中央に木炭 12 本（low 8 本: 丸・半割・四つ割り、樹皮の名残・放射状の割れ）。火箸一対。外側に控えめな作り絵（松の小枝）。
   userData.setBurn(v 0..1)  燃え具合。0=熾したて（割れ目と表面が橙〜黄に発光しゆらめく）→0.5=落ち着いた炭火（表面に白い灰がうっすら、
                             赤は奥と割れ目に）→1=「白き灰がち」（白い灰に覆われ、形が崩れて小さく沈み、わずかな赤みだけ）。連続的に動かしてよい
                             （毎フレーム呼んでも軽い: uniform とモーフの重みだけを更新）。userData.burn = 現在値。
   userData.setStoke(v 0..1)  熾す（吹く・あおぐ）強さ。発光と火の粉を一時的に強める（14場の「火など急ぎおこして」用）。既定 0。
   userData.emberLight = {position:Vector3(ローカル (0,0.30,0) = 口縁のすぐ上), color:THREE.Color, intensity:number, distance:2.2, decay:2}
                             update() と setBurn() のたびに更新。場面側で PointLight を作り、毎フレーム
                             light.position.copy(hioke.localToWorld(emberLight.position.clone())); light.color.copy(emberLight.color);
                             light.intensity = emberLight.intensity; で同期させる（intensity は burn=0 で ≈0.85、0.5 で ≈0.35、1 で ≈0.04。
                             physicallyCorrectLights=false 前提、distance 2.2 / decay 2 を推奨。火桶の胴の外の床まで照らさないよう light.castShadow=true（mapSize 256 で可）を推奨）。
   userData.anchors.coals (Object3D) 炭の山の中心（灰の面の上）。手元のカメラの注視点・火の粉の起点。
   userData.anchors.tongs  (Object3D) 火箸の上端（手で持つ所）。
   userData.update(dt,t)  炭火のゆらぎ（シェーダーのノイズ）・火の粉・発光ハローのちらつき・emberLight の強さ。
   userData.dispose()     作ったジオメトリ・マテリアル・テクスチャを解放（共有テクスチャは参照カウント）。
 MAKURA_PROPS.makeSumitori({quality, seed?, lit?:false}) -> THREE.Group      描画コール ≈ 6（lit で +2）
   炭取（炭斗）。煤竹の網代編みの角丸の籠（上端 0.35×0.27m、底 0.30×0.22m、縁の高さ 0.13m）、縁は黒漆の巻き縁、
   長手方向(X)に竹の提げ手（頂部 y≈0.29）。中に木炭の棒 15 本（low 10 本）。原点 = 籠の底の中心。長手 = X、+Z が持つ人の正面側。
   opts.lit=true: 上の 3 本が赤く熾り、薄い煙が立ちのぼる（update で揺らぐ）。userData.setLit(bool) でも切替。
   userData.anchors.handL ( -0.183, 0.085, 0 ) / handR ( +0.183, 0.085, 0 )  両手で捧げ持つときの手の位置（籠の両端の外側、縁の少し下）。
   userData.anchors.handle ( 0, 0.29, 0 )  提げ手の頂部（片手で提げる場合）。
   userData.emberLight（lit の時だけ intensity>0、形式は火桶と同じ）、update(dt,t)、dispose()。
 MAKURA_PROPS.makeKichou({quality, size?:"4shaku"|"3shaku", season?:"spring"|"summer"|"autumn"|"winter", wind?:0.35}) -> THREE.Group
   几帳。原点 = 中心の床（y=0）。帷（かたびら）は X 方向に並び、表 = +Z（帷は横木の +Z 側に垂れる）。描画コール ≈ 5。
   4shaku: 横木の上端 y=1.50、帷 5 幅（幅 0.30m×5 = 1.50m）、横木の長さ 1.62m、土居（台）は手（柱）の下に x=±0.71。
   3shaku: 横木の上端 y=1.20、帷 4 幅（0.26m×4 = 1.04m）、横木の長さ 1.16m、柱 x=±0.48。
   土居の奥行（Z）は 4shaku 0.36m / 3shaku 0.30m（z=-0.18..+0.18）。帷の裾は床に 0.12m ほど +Z 側へ引く（z ≈ +0.03..+0.17）。
   帷は上 45% だけ縫い合わせ、下は幅ごとに離れて（綻び）別々にかすかに揺れる。各縫い目に二色の野筋（のすじ）。
   season: spring=白→桜色の裾濃に桜, summer=生絹の薄物（透ける）に朽木形, autumn=朽葉→紅の裾濃に紅葉, winter=白に雪持笹。
   userData.setSeason(s)  帷・野筋の色と文様を差し替え（夏は半透明）。userData.setWind(v 0..1) 揺れの強さ（0 で静止）。
   userData.dims = {height, width, barLen, postX, depth}。update(dt,t)（布のかすかな揺れ: CPU で頂点を更新、影も一致）、dispose()。
============================================================================= */
const MAKURA_PROPS=(()=>{
"use strict";
const T=THREE,PI=Math.PI,TAU=PI*2;

/* ---------------------------------------------------------------- utils */
function mulberry(a){a=a>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function RNG(seed){const f=mulberry((Math.imul(seed|0,0x9E3779B1)^0x5bd1e995)>>>0);const o=()=>f();
  o.r=(a,b)=>a+(b-a)*f();o.i=(a,b)=>a+Math.floor((b-a+1)*f());o.pick=a=>a[Math.floor(f()*a.length)];o.c=p=>f()<p;return o;}
const ss=(a,b,x)=>{x=(x-a)/(b-a);x=x<0?0:x>1?1:x;return x*x*(3-2*x);};
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const lerp=(a,b,t)=>a+(b-a)*t;
function lattice(seed,gx,gy){const f=mulberry(seed*7919+13);const a=new Float32Array(gx*gy);for(let i=0;i<a.length;i++)a[i]=f();
  return (x,y)=>{let xi=Math.floor(x),yi=Math.floor(y);let tx=x-xi,ty=y-yi;tx=tx*tx*(3-2*tx);ty=ty*ty*(3-2*ty);
    xi%=gx;if(xi<0)xi+=gx;yi%=gy;if(yi<0)yi+=gy;const x1=xi+1===gx?0:xi+1,y1=yi+1===gy?0:yi+1;
    const a0=a[yi*gx+xi],a1=a[yi*gx+x1],b0=a[y1*gx+xi],b1=a[y1*gx+x1];const m0=a0+(a1-a0)*tx,m1=b0+(b1-b0)*tx;return m0+(m1-m0)*ty;};}
/* periodic fbm on the unit square (period 1 in u and v) */
function fbm(seed,gx,gy,oct,gain){gain=gain||.5;const L=[];for(let i=0;i<oct;i++)L.push(lattice(seed+i*101,gx<<i,gy<<i));
  let nrm=0,a=1;for(let i=0;i<oct;i++){nrm+=a;a*=gain;}
  return (u,v)=>{let s=0,a=1;for(let i=0;i<oct;i++){s+=a*L[i](u*(gx<<i),v*(gy<<i));a*=gain;}return s/nrm;};}
function h3(x,y,z){let n=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return n-Math.floor(n);}
function vn3(x,y,z){const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z);let fx=x-xi,fy=y-yi,fz=z-zi;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);
  const L=(a,b,t)=>a+(b-a)*t;const c=(i,j,k)=>h3(xi+i,yi+j,zi+k);
  return L(L(L(c(0,0,0),c(1,0,0),fx),L(c(0,1,0),c(1,1,0),fx),fy),L(L(c(0,0,1),c(1,0,1),fx),L(c(0,1,1),c(1,1,1),fx),fy),fz);}
const C=h=>new T.Color(h).convertSRGBToLinear();
function cv(w,h){const c=document.createElement("canvas");c.width=w;c.height=h;return c;}
function mkTex(c,o){o=o||{};const t=new T.CanvasTexture(c);if(o.srgb!==false)t.encoding=T.sRGBEncoding;
  const w=o.wrap===false?T.ClampToEdgeWrapping:T.RepeatWrapping;t.wrapS=t.wrapT=w;t.anisotropy=o.aniso||4;t.needsUpdate=true;return t;}
function imgLoop(W,H,fn){const c=cv(W,H),d=cv(W,H),cx=c.getContext("2d"),dx=d.getContext("2d");const ci=cx.createImageData(W,H),di=dx.createImageData(W,H);
  const A=ci.data,B=di.data,out=[0,0,0,0,0,0];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){fn(x/W,y/H,out,x,y);const i=(y*W+x)*4;A[i]=out[0];A[i+1]=out[1];A[i+2]=out[2];A[i+3]=255;B[i]=out[3];B[i+1]=out[4];B[i+2]=out[5];B[i+3]=255;}
  cx.putImageData(ci,0,0);dx.putImageData(di,0,0);return{c,d,cx,dx};}
const WHITE=[1,1,1];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const nrmz=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l];};

/* ---------------------------------------------------------------- shared (ref-counted) cache + resource bag */
const CACHE=new Map();
function shared(key,build){let e=CACHE.get(key);if(!e){e={v:build(),n:0};CACHE.set(key,e);}e.n++;return e.v;}
function dispAny(x){if(!x)return;if(x.isTexture){x.dispose();return;}if(typeof x==="object")for(const k in x){const y=x[k];if(y&&y.isTexture)y.dispose();}}
function unshare(key){const e=CACHE.get(key);if(!e)return;if(--e.n<=0){CACHE.delete(key);dispAny(e.v);}}
function Res(){this.g=[];this.m=[];this.t=[];this.k=[];}
Res.prototype.geo=function(g){this.g.push(g);return g;};
Res.prototype.mat=function(m){this.m.push(m);return m;};
Res.prototype.tex=function(t){this.t.push(t);return t;};
Res.prototype.sh=function(key,build){this.k.push(key);return shared(key,build);};
Res.prototype.dispose=function(){this.g.forEach(g=>g.dispose());this.m.forEach(m=>m.dispose());this.t.forEach(t=>t.dispose());this.k.forEach(unshare);this.g=[];this.m=[];this.t=[];this.k=[];};
function QL(o){const q=(o&&o.quality)||"high";const hi=q==="high",lo=q==="low";return{q,hi,lo,md:!hi&&!lo,ts:hi?1024:lo?256:512};}

/* ---------------------------------------------------------------- geometry builder (merge per material; auto-oriented triangles) */
function GB(){this.P=[];this.N=[];this.U=[];this.C=[];this.I=[];this.X={};this.M=null;this.ex=null;this.n=0;}
GB.prototype.vtx=function(p,nr,u,v,c,mt){c=c||WHITE;this.P.push(p[0],p[1],p[2]);this.N.push(nr[0],nr[1],nr[2]);this.U.push(u,v);this.C.push(c[0],c[1],c[2]);
  if(this.ex)for(const k in this.ex)(this.X[k]||(this.X[k]=[])).push(this.ex[k]);if(this.M)this.M.push(...(mt||p));return this.n++;};
GB.prototype.tri=function(a,b,c){const P=this.P,N=this.N;const pa=[P[a*3],P[a*3+1],P[a*3+2]],pb=[P[b*3],P[b*3+1],P[b*3+2]],pc=[P[c*3],P[c*3+1],P[c*3+2]];
  const n=[N[a*3]+N[b*3]+N[c*3],N[a*3+1]+N[b*3+1]+N[c*3+1],N[a*3+2]+N[b*3+2]+N[c*3+2]];
  if(dot(cross(sub(pb,pa),sub(pc,pa)),n)<0)this.I.push(a,c,b);else this.I.push(a,b,c);};
GB.prototype.quad=function(a,b,c,d){this.tri(a,b,c);this.tri(a,c,d);};
/* lathe around +Y at (cx,cy,cz). prof [[r,y],..]. o.uv(ph,j,r,y)->[u,v], o.cf(j,ph,r,y)->color, o.rm(ph,j)->radius mult, o.flip */
GB.prototype.lathe=function(prof,seg,cx,cy,cz,o){o=o||{};const base=this.n,rl=seg+1,n=prof.length;const nr=[];
  for(let j=0;j<n;j++){const a=prof[Math.max(0,j-1)],b=prof[Math.min(n-1,j+1)];const dr=b[0]-a[0],dy=b[1]-a[1];const l=Math.hypot(dr,dy)||1;nr.push([dy/l,-dr/l]);}
  for(let j=0;j<n;j++){const r=prof[j][0],y=prof[j][1];
    for(let i=0;i<=seg;i++){const ph=i/seg*TAU;const m=o.rm?o.rm(ph,j):1;const cs=Math.cos(ph),sn=Math.sin(ph);
      let nx=cs*nr[j][0],ny=nr[j][1],nz=sn*nr[j][0];if(o.flip){nx=-nx;ny=-ny;nz=-nz;}
      const uv=o.uv?o.uv(ph,j,r*m,y):[i/seg,j/(n-1)];this.vtx([cx+cs*r*m,cy+y,cz+sn*r*m],[nx,ny,nz],uv[0],uv[1],o.cf?o.cf(j,ph,r,y):(o.col||WHITE));}}
  for(let j=0;j<n-1;j++)for(let i=0;i<seg;i++){const a=base+j*rl+i;this.quad(a,a+1,a+rl+1,a+rl);}};
/* merge an arbitrary BufferGeometry with a Matrix4 */
GB.prototype.geom=function(g,m,o){o=o||{};const P=g.attributes.position,N=g.attributes.normal,UV=g.attributes.uv;const nm=new T.Matrix3().getNormalMatrix(m);
  const v=new T.Vector3(),w=new T.Vector3();const base=this.n;
  for(let i=0;i<P.count;i++){v.fromBufferAttribute(P,i).applyMatrix4(m);if(N)w.fromBufferAttribute(N,i).applyMatrix3(nm).normalize();else w.set(0,1,0);
    this.vtx([v.x,v.y,v.z],[w.x,w.y,w.z],UV?UV.getX(i)*(o.us||1):0,UV?UV.getY(i)*(o.vs||1):0,o.cf?o.cf([v.x,v.y,v.z]):(o.col||WHITE));}
  if(g.index){const I=g.index.array;for(let i=0;i<I.length;i+=3)this.I.push(base+I[i],base+I[i+1],base+I[i+2]);}else for(let i=0;i<P.count;i++)this.I.push(base+i);};
GB.prototype.box=function(cx,cy,cz,sx,sy,sz,o){const g=new T.BoxGeometry(sx,sy,sz);this.geom(g,new T.Matrix4().makeTranslation(cx,cy,cz),o);g.dispose();};
GB.prototype.build=function(){if(!this.n)return null;const g=new T.BufferGeometry();
  g.setAttribute("position",new T.Float32BufferAttribute(this.P,3));g.setAttribute("normal",new T.Float32BufferAttribute(this.N,3));
  g.setAttribute("uv",new T.Float32BufferAttribute(this.U,2));g.setAttribute("color",new T.Float32BufferAttribute(this.C,3));
  for(const k in this.X)g.setAttribute(k,new T.Float32BufferAttribute(this.X[k],1));
  if(this.M){g.morphAttributes.position=[new T.Float32BufferAttribute(this.M,3)];}
  g.setIndex(this.I);g.computeBoundingSphere();g.computeBoundingBox();return g;};
function finish(me,cast,recv){me.castShadow=cast!==false;me.receiveShadow=recv!==false;return me;}

/* ---------------------------------------------------------------- GLSL helpers */
const GL_NOISE=`
float mpH(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float mpN(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(mpH(i),mpH(i+vec3(1.,0.,0.)),f.x),mix(mpH(i+vec3(0.,1.,0.)),mpH(i+vec3(1.,1.,0.)),f.x),f.y),
            mix(mix(mpH(i+vec3(0.,0.,1.)),mpH(i+vec3(1.,0.,1.)),f.x),mix(mpH(i+vec3(0.,1.,1.)),mpH(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}
vec3 mpRamp(float t){vec3 c=mix(vec3(0.),vec3(.30,.018,.0),smoothstep(.04,.26,t));
 c=mix(c,vec3(.95,.11,.01),smoothstep(.22,.52,t));c=mix(c,vec3(1.85,.5,.07),smoothstep(.5,.8,t));c=mix(c,vec3(2.6,1.35,.45),smoothstep(.84,1.,t));return c;}
`;
/* hemisphere-coloured fake reflection for metals when the scene has no environment map */
function fakeEnv(m,k){m.onBeforeCompile=sh=>{sh.uniforms.uEnvK={value:k};
  sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nuniform float uEnvK;").replace("#include <lights_fragment_maps>","#include <lights_fragment_maps>\n#ifndef USE_ENVMAP\n#if NUM_HEMI_LIGHTS > 0\n#if defined( RE_IndirectSpecular )\n"+
  "{vec3 rv=reflect(-geometry.viewDir,geometry.normal);float k=dot(rv,hemisphereLights[0].direction)*.5+.5;radiance+=mix(hemisphereLights[0].groundColor,hemisphereLights[0].skyColor,smoothstep(.25,.75,k))*uEnvK;}\n#endif\n#endif\n#endif\n");};
  m.customProgramCacheKey=()=>"mpFakeEnv";return m;}

/* ---------------------------------------------------------------- procedural textures */
/* paulownia (kiri): u = around (periodic), v = height. soft flame figure + fine vertical fibres; optional 作り絵 (pine sprigs) */
function genKiri(W,painted){const H=W>>1;const fA=fbm(201,3,2,4),fB=fbm(202,6,3,3),fib=fbm(203,96,3,2),pore=fbm(204,128,24,1),tone=fbm(205,2,2,3);
  const o=imgLoop(W,H,(u,v,out)=>{const ring=26*Math.cos(u*TAU-.6)+7*Math.cos(u*2*TAU+1.1)+3.2*fA(u,v*.3)+.8*fB(u,v*.5)+.4*v;const g=ring-Math.floor(ring);
    const late=ss(.8,.92,g)*(1-ss(.96,1,g));const f=fib(u,v),p=pore(u,v),tn=tone(u,v);
    let k=.97+.06*(tn-.5)+.06*(f-.5)-.02*late;const pr=p>.93?.97:1;
    out[0]=clamp(206*k*pr-20*late,0,255);out[1]=clamp(184*k*pr-24*late,0,255);out[2]=clamp(150*k*pr-26*late,0,255);
    out[3]=clamp(150+70*(f-.5)-60*late-(p>.93?15:0),0,255);out[4]=0;out[5]=0;});
  if(painted){const x=o.cx,r=RNG(207);x.lineCap="round";
    const sprig=(cx,cy,s,flip)=>{x.save();x.translate(cx,cy);x.scale(flip?-s:s,s);
      x.strokeStyle="rgba(92,64,40,.72)";x.lineWidth=2.6;x.beginPath();x.moveTo(-60,30);x.bezierCurveTo(-25,18,10,24,52,-6);x.stroke();
      x.lineWidth=1.6;x.beginPath();x.moveTo(-14,22);x.quadraticCurveTo(-4,4,8,-12);x.stroke();
      const tuft=(tx,ty,rad,n,a0,a1)=>{for(let i=0;i<n;i++){const a=a0+(a1-a0)*i/(n-1)+r.r(-.04,.04);const L=rad*r.r(.82,1.05);
        x.strokeStyle=i%3?"rgba(70,104,72,.78)":"rgba(150,128,70,.8)";x.lineWidth=1.3;x.beginPath();x.moveTo(tx,ty);x.lineTo(tx+Math.cos(a)*L,ty+Math.sin(a)*L);x.stroke();}};
      tuft(52,-6,26,17,-PI*.95,.15);tuft(8,-12,22,15,-PI*.9,-.05);tuft(-30,22,20,13,-PI*.85,-.1);
      x.restore();};
    const cloud=(cx,cy,s)=>{x.save();x.translate(cx,cy);x.scale(s,s);x.strokeStyle="rgba(168,136,74,.55)";x.lineWidth=2;
      for(let i=0;i<3;i++){x.beginPath();x.moveTo(-70+i*10,i*7);x.bezierCurveTo(-35,-10+i*7,0,10+i*7,60-i*14,i*7);x.stroke();}x.restore();};
    const sc=W/1024;for(let k=0;k<3;k++){const cx=(k+.35)/3*W,cy=H*(.42+.12*(k%2));sprig(cx,cy,sc*1.15,k%2===1);cloud(cx+W*.11*(k%2?-1:1),cy+H*.28,sc);}}
  return{map:mkTex(o.c,{aniso:8}),data:mkTex(o.d,{srgb:false,aniso:8})};}
/* ash bed (planar over the disc): concentric 灰ならし grooves, fine grain, charcoal specks. data R = height */
function genAsh(S){const r=RNG(311);const gA=fbm(312,24,24,3),gB=fbm(313,96,96,2),wob=fbm(314,6,6,3),bl=fbm(315,5,5,3);
  const o=imgLoop(S,S,(u,v,out)=>{const dx=(u-.5)*.27,dz=(v-.5)*.27;const rr=Math.hypot(dx,dz);
    const rw=rr+.0024*(wob(u,v)-.5);const comb=ss(.072,.088,rr)*ss(.132,.122,rr);const gr=.5+.5*Math.cos(rw/.0062*TAU);
    const groove=comb*(1-Math.pow(gr,1.6));const ga=gA(u,v),gb=gB(u,v),b=bl(u,v);
    let k=.95+.07*(b-.5)+.1*(ga-.5)+.08*(gb-.5)-.12*groove;
    out[0]=clamp(170*k,0,255);out[1]=clamp(165*k,0,255);out[2]=clamp(158*k,0,255);
    out[3]=clamp(150-90*groove+40*(gb-.5)+25*(ga-.5),0,255);out[4]=0;out[5]=0;});
  const x=o.cx;for(let i=0;i<S*1.6;i++){const px=r()*S,py=r()*S,s=r.r(.4,1.4)*S/1024;x.fillStyle=r()<.8?`rgba(40,36,34,${r.r(.25,.6)})`:`rgba(250,248,244,${r.r(.4,.8)})`;x.fillRect(px,py,s,s);}
  return{map:mkTex(o.c,{wrap:false,aniso:8}),data:mkTex(o.d,{srgb:false,wrap:false})};}
/* charcoal side (bark side): u along the stick (period .12m), v around (period ≈.05m). R=crack G=variation B=bark remnant (data) */
function genCoalSide(S){const r=RNG(321);const gx=3,gy=3;const pts=[];for(let j=0;j<gy;j++)for(let i=0;i<gx;i++)pts.push([(i+r.r(.15,.85))/gx,(j+r.r(.15,.85))/gy]);
  const bk=fbm(322,4,4,3),vr=fbm(323,8,8,3),fis=fbm(324,3,12,2),fine=fbm(325,48,16,1);const lon=[];for(let k=0;k<4;k++)lon.push([r(),r.r(.0003,.0006)]);
  const o=imgLoop(S,S,(u,v,out)=>{let f1=9,f2=9;for(const p of pts)for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const du=(u-p[0]-ox)*.12,dv=(v-p[1]-oy)*.05;const d=Math.hypot(du,dv);if(d<f1){f2=f1;f1=d;}else if(d<f2)f2=d;}
    let cr=(1-ss(0,.0006,f2-f1))*ss(.38,.6,bk(u*2,v));cr*=.5+.5*fine(u,v);
    for(const L of lon){let dv=v-L[0]-.08*(fis(u,v)-.5);dv-=Math.round(dv);const d=Math.abs(dv)*.05;cr=Math.max(cr,(1-ss(0,L[1],d))*ss(.25,.6,fis(u*1.7,v)));}
    const b=ss(.55,.68,bk(u,v));out[3]=clamp(255*cr,0,255);out[4]=clamp(255*(.35*vr(u,v)+.65*fine(u,v)),0,255);out[5]=255*b;out[0]=out[3];out[1]=out[4];out[2]=out[5];});
  return mkTex(o.d,{srgb:false});}
/* charcoal cut end: polar around the log centre (uv .5,.5 = pith). radial checks + growth rings */
function genCoalEnd(S){const r=RNG(331);const N=9,cr=[];for(let k=0;k<N;k++)cr.push([k/N*TAU+r.r(-.25,.25),r.r(.4,1.02),r.r(.014,.03),r()*9]);const ring=fbm(332,6,6,2);
  const o=imgLoop(S,S,(u,v,out)=>{const x=(u-.5)*2,y=(v-.5)*2;const rr=Math.hypot(x,y),an=Math.atan2(y,x);let c=0;
    for(const k of cr){let d=an-k[0]-.06*Math.sin(rr*11+k[3]);d-=Math.round(d/TAU)*TAU;const w=k[2]*(1-rr/k[1])+.004;if(rr<k[1])c=Math.max(c,1-ss(w*.4,w,Math.abs(d)*Math.max(rr,.05)));}
    const rg=.5+.5*Math.sin(rr*46+3*ring(u,v));const arc=(rr>.55&&rr<.6&&Math.sin(an*3+1)>.6)?.8:0;c=Math.max(c,arc*(1-ss(.0,.02,Math.abs(rr-.575))));
    if(rr<.04)c=Math.max(c,.3);out[3]=255*c;out[4]=255*(.35+.4*rg);out[5]=255*ss(.9,.97,rr);out[0]=out[3];out[1]=out[4];out[2]=out[5];});
  return mkTex(o.d,{srgb:false,wrap:false});}
/* smoked-bamboo twill (網代) weave, tileable. data R = height */
function genWeave(S){const r=RNG(341);const n=fbm(342,8,8,3),fib=fbm(343,64,64,1);const w=S/24;const sv=[];for(let i=0;i<64;i++)sv.push(r.r(.82,1.12));
  const o=imgLoop(S,S,(u,v,out,x,y)=>{const i=Math.floor(y/w),j=Math.floor(x/w);const horiz=(((i-j)%4)+4)%4<2;const fx=horiz?(y%w)/w:(x%w)/w;const along=horiz?x:y;
    const prof=Math.sin(fx*PI);const gap=ss(0,.12,fx)*ss(1,.88,fx);const sid=horiz?sv[i&63]:sv[(j+32)&63];
    const ff=fib(u,v);const k=(.55+.45*prof)*gap*sid*(.9+.12*(n(u,v)-.5))*(.92+.1*ff)*(.96+.04*Math.sin(along*.9));
    out[0]=clamp(104*k,0,255);out[1]=clamp(74*k,0,255);out[2]=clamp(48*k,0,255);out[3]=clamp(255*(.2+.8*prof*gap),0,255);out[4]=0;out[5]=0;});
  return{map:mkTex(o.c),data:mkTex(o.d,{srgb:false})};}
function genGlow(){const c=cv(64,64),x=c.getContext("2d");const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,"rgba(255,255,255,1)");g.addColorStop(.3,"rgba(255,255,255,.45)");g.addColorStop(.65,"rgba(255,255,255,.1)");g.addColorStop(1,"rgba(255,255,255,0)");x.fillStyle=g;x.fillRect(0,0,64,64);return mkTex(c,{wrap:false});}

/* ---------------------------------------------------------------- charcoal (木炭) */
/* one stick merged into gS (sides) / gE (cut ends). o: type round|half|sector, R, L, pos, rot (Euler), heat(p)->h, seed, arc (sector angle) */
function coalPiece(gS,gE,rng,o,q){const R=o.R,L=o.L,type=o.type||"round",seed=o.seed!=null?o.seed:rng();
  const m=new T.Matrix4().makeRotationFromEuler(new T.Euler(o.rot[2],o.rot[1],o.rot[0],"YZX")).setPosition(o.pos[0],o.pos[1],o.pos[2]);const nm=new T.Matrix3().getNormalMatrix(m);
  const xf=(p)=>{const v=new T.Vector3(p[0],p[1],p[2]).applyMatrix4(m);return[v.x,v.y,v.z];};const xn=(n)=>{const v=new T.Vector3(n[0],n[1],n[2]).applyMatrix3(nm).normalize();return[v.x,v.y,v.z];};
  /* section in (a=z, b=y) with log centre at 0; points + sharp flags */
  const na=q.lo?12:22;const pts=[],sharp=[];const rn=(an)=>R*(1+.06*Math.sin(an*3+seed*20)+.035*Math.sin(an*7+seed*9)+.02*Math.sin(an*13+seed*3));
  if(type==="round"){for(let i=0;i<na;i++){const an=i/na*TAU;pts.push([Math.cos(an)*rn(an),Math.sin(an)*rn(an)]);sharp.push(false);}}
  else if(type==="half"){const k=Math.max(6,na>>1);for(let i=0;i<=k;i++){const an=i/k*PI;pts.push([Math.cos(an)*rn(an),Math.sin(an)*rn(an)]);sharp.push(i===0||i===k);}
    for(let i=1;i<4;i++){const a=-R+2*R*i/4;pts.push([-a*(.98),-.0015*Math.sin(i*2.1+seed*5)]);sharp.push(false);}pts.reverse();sharp.reverse();}
  else{const arc=o.arc||PI/2,k=Math.max(4,Math.round(na*arc/TAU)+2);const a0=PI/2-arc/2;for(let i=0;i<=k;i++){const an=a0+i/k*arc;pts.push([Math.cos(an)*rn(an),Math.sin(an)*rn(an)]);sharp.push(i===0||i===k);}
    pts.push([0,0]);sharp.push(true);pts.reverse();sharp.reverse();}
  const n=pts.length;let ca=0,cb=0;for(const p of pts){ca+=p[0];cb+=p[1];}ca/=n;cb/=n;
  const eN=[];for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n];let nx=b[1]-a[1],ny=-(b[0]-a[0]);const l=Math.hypot(nx,ny)||1;nx/=l;ny/=l;
    if(nx*((a[0]+b[0])/2-ca)+ny*((a[1]+b[1])/2-cb)<0){nx=-nx;ny=-ny;}eN.push([nx,ny]);}
  const vN=i=>{const a=eN[(i-1+n)%n],b=eN[i];const x=a[0]+b[0],y=a[1]+b[1],l=Math.hypot(x,y)||1;return[x/l,y/l];};
  let per=0;const pl=[0];for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n];per+=Math.hypot(b[0]-a[0],b[1]-a[1]);pl.push(per);}const rep=Math.max(1,Math.round(per/.05));
  const sl0=[rng.r(-.25,.25),rng.r(-.25,.25)],sl1=[rng.r(-.3,.3),rng.r(-.3,.3)];const nl=q.lo?3:6;const bend=rng.r(-.004,.004);
  const xAt=(t,a,b)=>-L/2+L*t+(t<.5?(1-2*t)*(sl0[0]*a+sl0[1]*b):(2*t-1)*(sl1[0]*a+sl1[1]*b));
  const tap=t=>1-.06*Math.pow(Math.abs(2*t-1),2);
  /* collapse target (white-ash state): radially eroded, shorter, slumped */
  const ero=(x,a,b)=>{const e=.3+.36*vn3(x*45+seed*40,a*45,b*45)+.12*vn3(x*120,a*120+seed*7,b*120);return e;};
  const tgt=(x,a,b)=>{const e=ero(x,a,b);const p=xf([x*.74,b*e-R*.45*(1-e),a*e]);p[1]-=R*.5;return p;};
  const H=(p)=>o.heat?o.heat(p):.5;
  gS.ex={aSeed:seed,aHeat:0};gE.ex={aSeed:seed,aHeat:0};
  for(let i=0;i<n;i++){const j=(i+1)%n;const A=pts[i],B=pts[j];const nA=sharp[i]?eN[i]:vN(i),nB=sharp[j]?eN[i]:vN(j);let prev=null;
    for(let s=0;s<=nl;s++){const t=s/nl,tp=tap(t),yb=bend*Math.sin(t*PI);
      const pa=[xAt(t,A[0],A[1]),A[1]*tp+yb,A[0]*tp],pb=[xAt(t,B[0],B[1]),B[1]*tp+yb,B[0]*tp];
      const wa=xf(pa),wb=xf(pb);gS.ex.aHeat=H(wa);const ia=gS.vtx(wa,xn([0,nA[1],nA[0]]),t*L/.12,pl[i]/per*rep,WHITE,tgt(pa[0],A[0]*tp,A[1]*tp));
      gS.ex.aHeat=H(wb);const ib=gS.vtx(wb,xn([0,nB[1],nB[0]]),t*L/.12,pl[i+1]/per*rep,WHITE,tgt(pb[0],B[0]*tp,B[1]*tp));
      if(prev)gS.quad(prev[0],prev[1],ib,ia);prev=[ia,ib];}}
  for(const end of[0,1]){const t=end,tp=tap(t),yb=0;const c3=[xAt(t,ca,cb)+(end?-1:1)*.0012,cb*tp,ca*tp];
    const p0=[xAt(t,pts[0][0],pts[0][1]),pts[0][1]*tp,pts[0][0]*tp],p1=[xAt(t,pts[n>>1][0],pts[n>>1][1]),pts[n>>1][1]*tp,pts[n>>1][0]*tp];
    let cn=nrmz(cross(sub(p0,c3),sub(p1,c3)));if((end?1:-1)*cn[0]<0)cn=[-cn[0],-cn[1],-cn[2]];const wn=xn(cn);const sc=1/(2*R*1.04);
    const wc=xf(c3);gE.ex.aHeat=H(wc);const ic=gE.vtx(wc,wn,.5+ca*sc,.5+cb*sc,WHITE,tgt(c3[0],ca*tp,cb*tp));const ids=[];
    for(let i=0;i<n;i++){const P=pts[i];const pp=[xAt(t,P[0],P[1]),P[1]*tp+yb,P[0]*tp];const w=xf(pp);gE.ex.aHeat=H(w);ids.push(gE.vtx(w,wn,.5+P[0]*sc,.5+P[1]*sc,WHITE,tgt(pp[0],P[0]*tp,P[1]*tp)));}
    for(let i=0;i<n;i++)gE.tri(ic,ids[i],ids[(i+1)%n]);}
  gS.ex=null;gE.ex=null;}
/* charcoal material (shared uniforms U: uBurn,uTime,uStoke,uGain). side/end differ only in the data texture */
function coalMat(res,tex,U,end){const m=res.mat(new T.MeshStandardMaterial({color:0xffffff,roughness:.6,metalness:0,bumpMap:tex,bumpScale:end?-.0035:-.0028}));
  m.morphTargets=true;const Us={uBurn:U.uBurn,uTime:U.uTime,uStoke:U.uStoke,uGain:U.uGain,uTex:{value:tex}};m.userData.U=Us;
  m.customProgramCacheKey=()=>"mpCoal";
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,Us);
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nattribute float aSeed;attribute float aHeat;varying vec3 vLoc;varying float vSeed;varying float vHeat;varying float vUpN;")
      .replace("#include <begin_vertex>","#include <begin_vertex>\nvLoc=position;vSeed=aSeed;vHeat=aHeat;vUpN=normal.y;");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nuniform float uBurn;uniform float uTime;uniform float uStoke;uniform float uGain;uniform sampler2D uTex;varying vec3 vLoc;varying float vSeed;varying float vHeat;varying float vUpN;\n"+GL_NOISE)
      .replace("#include <map_fragment>",`
vec4 cdat=texture2D(uTex,vUv);float crack=cdat.r,vari=cdat.g,bark=cdat.b;float b=uBurn;
float nA=mpN(vLoc*70.+vSeed*31.),nB=mpN(vLoc*210.+vSeed*7.);float nAsh=nA*.72+nB*.28;
float up=clamp(vUpN,-1.,1.)*.5+.5;float hot=clamp(vHeat,0.,1.);float lit=step(-.5,vHeat);
float aa=b*1.36-.3+.6*(nAsh-.5)+.3*(up-.5)-.5*crack*(1.-.7*b)-.2*hot;float cover=smoothstep(-.05,.2,aa)*lit+(1.-lit)*smoothstep(.62,.8,nAsh)*.18;
float thick=smoothstep(.3,1.,b+.35*(nAsh-.5))*lit;
vec3 coal=vec3(.032,.030,.029)*(.7+.6*vari)+bark*vec3(.028,.022,.017);
vec3 ashC=mix(vec3(.30,.29,.28),vec3(.83,.81,.78),thick)*(.84+.3*nB);
vec3 alb=mix(coal,ashC,cover*mix(.62,1.,thick));alb*=1.-.55*crack*(1.-cover*.92);
diffuseColor.rgb=alb;float mpCover=cover,mpThick=thick,mpCrack=crack,mpHot=hot,mpLit=lit,mpNA=nAsh;`)
      .replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\nroughnessFactor=mix(.6+.25*vari,1.,mpCover);")
      .replace("#include <emissivemap_fragment>",`{
float b=uBurn;float fl=mpN(vLoc*26.+vec3(0.,-uTime*.6,uTime*.23)+vSeed*13.);float fl2=mpN(vLoc*8.+vec3(uTime*.19,uTime*.07,-uTime*.13)+vSeed*3.);
float cpat=smoothstep(.42,.72,mpN(vLoc*17.+vSeed*23.));
float tm=(1.-b*1.06)*(.34+.38*mpHot)-.4*cpat*(1.-mpCrack)*(1.-.4*mpHot)+.46*mpCrack*(1.-.5*b)+.22*(fl-.5)+.14*(fl2-.5)+uStoke*.3*(.6+.4*fl);
float grain=smoothstep(.22,.78,mpN(vLoc*240.+vSeed*9.))*.6+smoothstep(.3,.7,mpN(vLoc*90.+vSeed*4.))*.4;
tm-=.3*(1.-grain)*(1.-mpCrack)*(1.-.5*b);
float res=smoothstep(.62,.84,mpN(vLoc*48.+vSeed*3.)*.7+mpCrack*.38+mpHot*.12)*(.3+.6*mpHot)*smoothstep(.5,.95,b)*.62;
tm=clamp(max(tm,res),0.,1.)*mpLit;
float veil=mix(1.,mix(.5,.1,mpThick),mpCover);vec3 gc=mpRamp(tm);gc=mix(gc,gc*vec3(1.,.62,.55),mpCover*.6);
totalEmissiveRadiance=gc*veil*uGain;}`);};
  return m;}
/* spark points (火の粉) */
function sparkMat(res,U){return res.mat(new T.ShaderMaterial({uniforms:{uTime:U.uTime,uAmt:{value:0},uScale:{value:700},uCol:{value:new T.Color(1,.62,.22)}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,fog:false,
  vertexShader:`attribute float aSeed;uniform float uTime;uniform float uAmt;uniform float uScale;varying float vA;
float h(float n){return fract(sin(n)*43758.5453);}
void main(){float rate=.45+.6*h(aSeed*3.1);float cyc=uTime*rate+h(aSeed*7.7)*10.;float ph=fract(cyc);float id=floor(cyc);
float on=step(1.-uAmt,h(id*1.37+aSeed*11.3));float ang=h(id+aSeed)*6.2832;vec3 dir=vec3(cos(ang)*.3,1.,sin(ang)*.3);
vec3 p=position+dir*ph*(.1+.22*h(id*2.1+aSeed))+vec3(sin(ph*9.+aSeed)*.012,-ph*ph*.04,cos(ph*7.+aSeed)*.012);
vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;vA=on*(1.-ph)*smoothstep(0.,.06,ph);
gl_PointSize=max(1.,uScale*(.004+.003*h(aSeed*5.))/max(.05,-mv.z));}`,
  fragmentShader:`uniform vec3 uCol;varying float vA;void main(){vec2 c=gl_PointCoord-.5;float d=length(c);float a=smoothstep(.5,.05,d)*vA;if(a<.01)discard;gl_FragColor=vec4(uCol*a*1.6+vec3(.3,.2,.1)*a*smoothstep(.2,0.,d),a);}`}));}
/* thin smoke wisps (points, normal blending) */
function smokeMat(res,U){return res.mat(new T.ShaderMaterial({uniforms:{uTime:U.uTime,uAmt:{value:1},uScale:{value:700}},transparent:true,depthWrite:false,fog:false,
  vertexShader:`attribute float aSeed;uniform float uTime;uniform float uScale;varying float vA;varying float vS;
float h(float n){return fract(sin(n)*43758.5453);}
void main(){float ph=fract(uTime*.11+h(aSeed*3.3));vec3 p=position;p.y+=ph*.42;p.x+=sin(ph*5.+aSeed*6.)*.03*ph+ph*.05;p.z+=cos(ph*4.+aSeed*2.)*.025*ph;
vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;vA=smoothstep(0.,.15,ph)*(1.-ph);vS=aSeed;
gl_PointSize=uScale*(.035+.11*ph)/max(.05,-mv.z);}`,
  fragmentShader:`uniform float uAmt;uniform float uTime;varying float vA;varying float vS;
float hh(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hh(i),hh(i+vec2(1.,0.)),f.x),mix(hh(i+vec2(0.,1.)),hh(i+vec2(1.,1.)),f.x),f.y);}
void main(){vec2 c=gl_PointCoord-.5;float d=length(c);float n=vn(c*5.+vS*17.+vec2(0.,uTime*.3))*.6+vn(c*11.-vS*5.)*.4;
float a=smoothstep(.5,.0,d)*smoothstep(.25,.75,n)*vA*.16*uAmt;if(a<.004)discard;gl_FragColor=vec4(vec3(.78,.77,.76),a);}`}));}

/* ================================================================ 1. 火桶 */
function makeHioke(opts){opts=opts||{};const q=QL(opts),res=new Res(),rng=RNG(opts.seed!=null?opts.seed:1001);const g=new T.Group();g.name="MakuraHioke";
  const ASHY=.214,PILE=[0,ASHY,0];
  const U={uBurn:{value:0},uTime:{value:0},uStoke:{value:0},uGain:{value:1}};
  /* --- body (kiri) --- */
  const KI=res.sh("kiri"+q.ts+(opts.painted===false?"p":""),()=>genKiri(q.ts,opts.painted!==false));
  const mWood=res.mat(new T.MeshStandardMaterial({map:KI.map,bumpMap:KI.data,bumpScale:.0016,roughness:.66,vertexColors:true}));
  const seg=q.lo?40:q.md?64:96;const gw=new GB();
  const prof=[[.150,.0],[.165,.0005],[.172,.004],[.1765,.012],[.179,.04],[.181,.09],[.1812,.14],[.18,.185],[.178,.222],[.174,.245],[.168,.259],[.1615,.2675],[.1555,.2718],[.1505,.2732],[.1462,.2716],[.1438,.2675],[.1425,.258],[.142,.24]];
  gw.lathe(prof,seg,0,0,0,{uv:(ph,j,r,y)=>[ph/TAU,clamp(y/.274,0,1)*.98+.01],cf:(j,ph,r,y)=>{const k=y<.012?.72+.28*ss(0,.012,y):1;const lip=j>=12?.93:1;return[k*lip,k*lip,k*lip];}});
  gw.lathe([[0,0],[.150,0]],seg,0,0,0,{uv:(ph,j,r)=>[.5+Math.cos(ph)*r,.5+Math.sin(ph)*r],col:[.6,.6,.6]});
  const body=finish(new T.Mesh(res.geo(gw.build()),mWood));body.name="hioke_body";g.add(body);
  /* --- copper liner (落とし): rolled lip over the wood and the wall above the ash --- */
  const mCu=res.mat(fakeEnv(new T.MeshStandardMaterial({color:0xffffff,roughness:.4,metalness:.75,vertexColors:true}),.5));
  const gc=new GB();const cuP=[[.1478,.2722],[.1462,.2748],[.1425,.2762],[.1385,.2755],[.1355,.273],[.1342,.268],[.1336,.258],[.1334,.235],[.1332,.21],[.133,.18]];
  const cuC=C(0x8a6a40),dark=C(0x33281a),ashT=C(0x8d8780);
  gc.lathe(cuP,seg,0,0,0,{cf:(j,ph,r,y)=>{const v=.85+.15*Math.sin(ph*5+1.3)*Math.sin(ph*3);let c=[cuC.r*v,cuC.g*v,cuC.b*v];
    const pat=ss(.26,.215,y)*.7;c=[lerp(c[0],dark.r,pat),lerp(c[1],dark.g,pat),lerp(c[2],dark.b,pat)];const as=ss(ASHY+.012,ASHY,y);return[lerp(c[0],ashT.r,as),lerp(c[1],ashT.g,as),lerp(c[2],ashT.b,as)];}});
  const liner=finish(new T.Mesh(res.geo(gc.build()),mCu));liner.name="hioke_liner";g.add(liner);
  /* --- ash bed --- */
  const AS=res.sh("ash"+(q.hi?1024:512),()=>genAsh(q.hi?1024:512));
  const mAsh=res.mat(new T.MeshStandardMaterial({map:AS.map,bumpMap:AS.data,bumpScale:.0045,roughness:1,metalness:0}));
  const AU={uBurn:U.uBurn,uGlow:{value:0},uGlowCol:{value:new T.Color(1,.35,.08)}};
  mAsh.customProgramCacheKey=()=>"mpAsh";
  mAsh.onBeforeCompile=sh=>{Object.assign(sh.uniforms,AU);
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nuniform float uBurn;uniform float uGlow;uniform vec3 uGlowCol;\n"+GL_NOISE)
      .replace("#include <map_fragment>",`#include <map_fragment>
float mpR=length((vUv-.5)*.27);float mpFall=0.;{float nz=mpN(vec3(vUv*150.,1.7))*.6+mpN(vec3(vUv*480.,3.1))*.4;
mpFall=smoothstep(.115,.06,mpR+.03*(nz-.5))*smoothstep(.2,.95,uBurn+.3*(nz-.5));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.83,.81,.78)*(.9+.2*nz),mpFall*.9);}`)
      .replace("#include <emissivemap_fragment>","#include <emissivemap_fragment>\ntotalEmissiveRadiance+=uGlowCol*uGlow*exp(-mpR*mpR/.0035)*(1.-.5*mpFall);");};
  const ga=new GB();const rings=q.lo?14:28,aseg=q.lo?40:80;const ah=(r,ph)=>ASHY+.0065*(1-Math.pow(r/.1332,2))+.0025*ss(.122,.1332,r)+.0008*Math.sin(ph*3+r*80)*(r/.13);
  for(let j=0;j<=rings;j++){const r=.1332*Math.pow(j/rings,.85);for(let i=0;i<=aseg;i++){const ph=i/aseg*TAU;const x=Math.cos(ph)*r,z=Math.sin(ph)*r;
      const e=.002;const dx=(ah(r+e,ph)-ah(Math.max(0,r-e),ph))/(2*e);ga.vtx([x,ah(r,ph),z],nrmz([-dx*Math.cos(ph),1,-dx*Math.sin(ph)]),.5+x/.27,.5-z/.27);}}
  for(let j=0;j<rings;j++)for(let i=0;i<aseg;i++){const a=j*(aseg+1)+i;ga.quad(a,a+1,a+aseg+2,a+aseg+1);}
  const ash=finish(new T.Mesh(res.geo(ga.build()),mAsh),false,true);ash.name="hioke_ash";g.add(ash);
  /* --- charcoal pile --- */
  const TS=res.sh("coalS"+(q.lo?128:256),()=>genCoalSide(q.lo?128:256)),TE=res.sh("coalE"+(q.lo?128:256),()=>genCoalEnd(q.lo?128:256));
  const gS=new GB(),gE=new GB();gS.M=[];gE.M=[];
  const heat=p=>clamp(1-Math.hypot(p[0]-PILE[0],p[2]-PILE[2])/.11,0,1)*.62+clamp(1-(p[1]-ASHY)/.07,0,1)*.38;
  const D=PI/180;
  const L=[ // type,R,L,x,yAboveAsh,z,yaw,tilt,spin,arc
    ["round",.021,.105,-.004,.011,.03,10,0,0],["round",.019,.095,.04,.009,-.012,75,3,0],["half",.023,.1,-.044,-.002,-.02,115,0,0],
    ["sector",.027,.085,.008,.0,-.05,160,0,0,100],["round",.016,.08,.058,.008,.045,-40,0,0],
    ["round",.019,.1,.0,.036,-.004,52,7,40],["half",.02,.09,-.022,.033,.034,-70,-9,18],["round",.017,.085,.034,.031,.02,140,10,0],
    ["sector",.024,.08,-.03,.03,-.032,22,-6,180,80],["round",.014,.06,.016,.057,.004,100,-12,0],["round",.012,.034,-.076,.006,.042,30,0,0],["half",.013,.038,.075,-.001,-.04,200,0,0]];
  const use=q.lo?[0,1,2,3,5,6,7,9]:L.map((_,i)=>i);
  for(const i of use){const e=L[i];coalPiece(gS,gE,rng,{type:e[0],R:e[1],L:e[2],pos:[e[3],ASHY+e[4],e[5]],rot:[e[7]*D,e[6]*D,e[8]*D],arc:e[9]?e[9]*D:0,heat,seed:i*.0831+.05},q);}
  const mS=coalMat(res,TS,U,false),mE=coalMat(res,TE,U,true);
  const coalS=finish(new T.Mesh(res.geo(gS.build()),mS)),coalE=finish(new T.Mesh(res.geo(gE.build()),mE));coalS.name="hioke_coal";coalE.name="hioke_coalEnds";g.add(coalS,coalE);
  /* --- 火箸 (pair of tongs) leaning on the rim --- */
  const mTong=res.mat(fakeEnv(new T.MeshStandardMaterial({color:C(0x6b5536),roughness:.38,metalness:.8}),.5));const gt=new GB();
  const tp=[];const tl=q.lo?8:14;for(let i=0;i<=tl;i++){const t=i/tl;tp.push(new T.Vector2(t<.06?.0016+.03*t:t>.9?.0034+.0012*Math.sin((t-.9)/.1*PI):.0034-.0014*(1-t),t*.29));}
  tp.unshift(new T.Vector2(0,0));tp.push(new T.Vector2(.0022,.2915),new T.Vector2(0,.292));
  const lg=new T.LatheGeometry(tp,q.lo?6:10);let tongTop=null;
  for(const[an,off]of[[2.95,0],[3.07,.006]]){const base=new T.Vector3(Math.cos(an)*.045,ASHY-.03,Math.sin(an)*.045);const rimP=new T.Vector3(Math.cos(an+off)*.1445,.2762+.0042,Math.sin(an+off)*.1445);
    const dir=rimP.clone().sub(base).normalize();const qq=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir);const mm=new T.Matrix4().compose(base,qq,new T.Vector3(1,1,1));gt.geom(lg,mm);
    if(!tongTop)tongTop=base.clone().add(dir.multiplyScalar(.29));}
  lg.dispose();const tongs=finish(new T.Mesh(res.geo(gt.build()),mTong));tongs.name="hioke_tongs";g.add(tongs);
  /* --- glow halo (soft scatter around the embers; stands in for bloom) --- */
  const GLW=res.sh("glow",genGlow);const halo=new T.Sprite(res.mat(new T.SpriteMaterial({map:GLW,color:new T.Color(1,.42,.12),transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,fog:false})));
  halo.scale.set(.34,.22,1);halo.position.set(0,ASHY+.045,0);halo.renderOrder=12;g.add(halo);
  /* --- sparks --- */
  const ns=q.lo?14:q.md?24:36;const sp=new Float32Array(ns*3),sd=new Float32Array(ns);for(let i=0;i<ns;i++){const a=rng()*TAU,r=rng()*.045;sp[i*3]=Math.cos(a)*r;sp[i*3+1]=ASHY+.03+rng()*.04;sp[i*3+2]=Math.sin(a)*r;sd[i]=rng()*100;}
  const sg=new T.BufferGeometry();sg.setAttribute("position",new T.BufferAttribute(sp,3));sg.setAttribute("aSeed",new T.BufferAttribute(sd,1));sg.boundingSphere=new T.Sphere(new T.Vector3(0,.35,0),.4);
  const sMat=sparkMat(res,U);const sparks=new T.Points(res.geo(sg),sMat);sparks.renderOrder=13;sparks.frustumCulled=false;g.add(sparks);
  /* --- anchors / state --- */
  const aC=new T.Object3D();aC.name="coals";aC.position.set(0,ASHY+.04,0);g.add(aC);const aT=new T.Object3D();aT.name="tongs";aT.position.copy(tongTop);g.add(aT);
  const emberLight={position:new T.Vector3(0,.30,0),color:new T.Color(1,.45,.15),intensity:1.6,distance:2.2,decay:2};
  let burn=0,stoke=0,flk=1,tt=0;const n1=(t)=>Math.sin(t*2.3)*.5+Math.sin(t*5.7+1.3)*.3+Math.sin(t*11.1+.4)*.2;
  function apply(){const b=burn;U.uBurn.value=b;U.uStoke.value=stoke;
    const inf=ss(.32,1,b)*.92;coalS.morphTargetInfluences[0]=inf;coalE.morphTargetInfluences[0]=inf;
    const glow=Math.pow(1-b,1.5)*(1+stoke*.7)+.035*ss(.6,1,b);
    AU.uGlow.value=glow*.22*flk;halo.material.opacity=clamp(glow*.3*flk,0,.6);halo.scale.set(.30+.06*glow,.2+.05*glow,1);
    sMat.uniforms.uAmt.value=clamp(Math.pow(1-b,3)*.3+stoke*.85,0,1);
    const tc=clamp((1-b)*.9+stoke*.2,0,1);emberLight.color.setRGB(1,.25+.25*tc,.06+.1*tc);emberLight.intensity=(.85*Math.pow(1-b,1.35)+.04)*(1+.5*stoke)*flk;}
  function setBurn(v){burn=clamp(+v||0,0,1);g.userData.burn=burn;apply();}
  function update(dt,t){if(t==null){tt+=dt||0;t=tt;}const tm=t%600;U.uTime.value=tm;flk=1+.07*n1(tm*1.1)*(1-burn*.5);apply();}
  g.traverse(o=>{if(o.isMesh&&o.material&&o.material.transparent){o.castShadow=false;}});
  g.userData={burn:0,setBurn,setStoke(v){stoke=clamp(+v||0,0,1);apply();},emberLight,anchors:{coals:aC,tongs:aT},update,dispose(){res.dispose();}};
  setBurn(opts.burn||0);update(0,0);return g;}

/* ================================================================ 2. 炭取 */
function rrect(ax,az,cr,ph){/* rounded rectangle (half extents ax,az, corner radius cr) param by angle-ish ph 0..TAU → point & outward normal */
  const sx=ax-cr,sz=az-cr;const c=Math.cos(ph),s=Math.sin(ph);const k=1/Math.max(Math.abs(c)/(ax),Math.abs(s)/(az));let x=c*k,z=s*k;
  const qx=clamp(x,-sx,sx),qz=clamp(z,-sz,sz);let dx=x-qx,dz=z-qz;const l=Math.hypot(dx,dz);if(l<1e-6){return{p:[x,z],n:Math.abs(c)*az>Math.abs(s)*ax?[Math.sign(c),0]:[0,Math.sign(s)]};}
  dx/=l;dz/=l;return{p:[qx+dx*cr,qz+dz*cr],n:[dx,dz]};}
function makeSumitori(opts){opts=opts||{};const q=QL(opts),res=new Res(),rng=RNG(opts.seed!=null?opts.seed:2002);const g=new T.Group();g.name="MakuraSumitori";
  const U={uBurn:{value:.22},uTime:{value:0},uStoke:{value:0},uGain:{value:.75}};
  const WV=res.sh("weave"+(q.lo?128:256),()=>genWeave(q.lo?128:256));
  const mW=res.mat(new T.MeshStandardMaterial({map:WV.map,bumpMap:WV.data,bumpScale:.0022,roughness:.62,vertexColors:true}));
  const mL=res.mat(new T.MeshPhysicalMaterial({color:0xffffff,roughness:.45,clearcoat:.5,clearcoatRoughness:.3,vertexColors:true}));
  const mB=res.mat(new T.MeshStandardMaterial({color:0xffffff,roughness:.5,vertexColors:true}));
  const HB=.13,seg=q.lo?40:72,ny=q.lo?3:6;const ext=(y)=>{const t=y/HB;return[.15+.025*t,.11+.025*t];};const cr=(y)=>.05+.012*y/HB;
  const gw=new GB(),gl=new GB(),gb=new GB();
  /* wall: outer and inner surfaces (thickness 6mm), u along perimeter */
  for(const side of[1,-1]){const base=gw.n;const per=[];
    for(let j=0;j<=ny;j++){const y=.006+(HB-.006-.004)*j/ny;const[ax,az]=ext(y);let acc=0,prev=null;
      for(let i=0;i<=seg;i++){const ph=i/seg*TAU;const R=rrect(ax-(side<0?.006:0),az-(side<0?.006:0),cr(y),ph);if(prev)acc+=Math.hypot(R.p[0]-prev[0],R.p[1]-prev[1]);prev=R.p;
        const tl=.3;const nn=nrmz([R.n[0]*side,side*-.18,R.n[1]*side]);const k=side<0?.55:1;gw.vtx([R.p[0],y,R.p[1]],nn,acc/.16,y/.08,[k,k,k]);}}
    for(let j=0;j<ny;j++)for(let i=0;i<seg;i++){const a=base+j*(seg+1)+i;gw.quad(a,a+1,a+seg+2,a+seg+1);}}
  /* bottom (outer underside + inner floor) */
  for(const[y,s]of[[0,-1],[.006,1]]){const[ax,az]=ext(y);const c0=gw.vtx([0,y,0],[0,s,0],0,0,[.5,.5,.5]);const ids=[];for(let i=0;i<=seg;i++){const R=rrect(ax-(s>0?.006:0),az-(s>0?.006:0),cr(y),i/seg*TAU);ids.push(gw.vtx([R.p[0],y,R.p[1]],[0,s,0],R.p[0]/.16,R.p[1]/.16,s>0?[.5,.5,.5]:[.7,.7,.7]));}
    for(let i=0;i<seg;i++)gw.tri(c0,ids[i],ids[i+1]);}
  /* lacquered rim (巻き縁) and foot band: tube around the rounded rect */
  const band=(y,rad,col,flat)=>{const[ax,az]=ext(y);const ring=[];for(let i=0;i<=seg;i++){const R=rrect(ax-.003,az-.003,cr(y),i/seg*TAU);ring.push(R);}
    const m=q.lo?6:10;const base=gl.n;for(let i=0;i<=seg;i++){const R=ring[i];for(let k=0;k<=m;k++){const a=k/m*TAU;const ca=Math.cos(a),sa=Math.sin(a);
        const nx=R.n[0]*ca,ny2=sa,nz=R.n[1]*ca;gl.vtx([R.p[0]+nx*rad,y+ny2*rad*(flat||1),R.p[1]+nz*rad],[nx,ny2,nz],0,0,col);}}
    for(let i=0;i<seg;i++)for(let k=0;k<m;k++){const a=base+i*(m+1)+k;gl.quad(a,a+1,a+m+2,a+m+1);}};
  band(HB,.0048,[.05,.035,.03]);band(.004,.005,[.05,.04,.035],.8);
  /* bamboo bail handle along X with bindings */
  const curve=new T.CatmullRomCurve3([new T.Vector3(-.172,HB-.03,0),new T.Vector3(-.17,HB+.06,0),new T.Vector3(-.12,HB+.14,0),new T.Vector3(0,HB+.162,0),new T.Vector3(.12,HB+.14,0),new T.Vector3(.17,HB+.06,0),new T.Vector3(.172,HB-.03,0)]);
  const tg=new T.TubeGeometry(curve,q.lo?24:48,.0068,q.lo?6:10,false);gb.geom(tg,new T.Matrix4(),{cf:()=> [.06,.036,.018]});tg.dispose();
  for(const s of[-1,1])for(const y of[HB-.022,HB+.004]){const cg=new T.CylinderGeometry(.0092,.0092,.009,10);gb.geom(cg,new T.Matrix4().makeTranslation(s*.1715,y,0),{col:[.2,.13,.08]});cg.dispose();}
  for(const s of[-1,1]){const t=new T.TorusGeometry(.0085,.0018,6,12);gb.geom(t,new T.Matrix4().makeRotationX(PI/2).setPosition(s*(-.118),HB+.141,0),{col:[.2,.13,.08]});t.dispose();}
  g.add(finish(new T.Mesh(res.geo(gw.build()),mW)),finish(new T.Mesh(res.geo(gl.build()),mL)),finish(new T.Mesh(res.geo(gb.build()),mB)));
  /* charcoal sticks */
  const TS=res.sh("coalS"+(q.lo?128:256),()=>genCoalSide(q.lo?128:256)),TE=res.sh("coalE"+(q.lo?128:256),()=>genCoalEnd(q.lo?128:256));
  const gS=new GB(),gE=new GB();gS.M=[];gE.M=[];const litIdx=new Set();let lit=!!opts.lit;
  const list=[];const nRow=q.lo?5:7;for(let layer=0;layer<2;layer++)for(let i=0;i<nRow;i++){if(layer===1&&(i===0||i===nRow-1))continue;
    const R=rng.r(.014,.019);const z=-.085+.17*i/(nRow-1)+rng.r(-.006,.006)+(layer?.012:0);list.push({type:rng()<.7?"round":"half",R,L:rng.r(.2,.25),x:rng.r(-.02,.02),y:.008+R+layer*.031,z,yaw:rng.r(-.12,.12),roll:rng()*TAU,pitch:rng.r(-.05,.05)});}
  if(!q.lo){list.push({type:"round",R:.016,L:.12,x:-.05,y:.08,z:.01,yaw:.9,roll:1,pitch:.12});list.push({type:"sector",R:.026,L:.11,x:.055,y:.079,z:-.02,yaw:-.7,roll:PI,pitch:-.1,arc:PI/2});}
  const topIdx=list.map((e,i)=>[e.y,i]).sort((a,b)=>b[0]-a[0]).slice(0,3).map(e=>e[1]);topIdx.forEach(i=>litIdx.add(i));
  const pieceHeat=[];
  list.forEach((e,i)=>{const hot=litIdx.has(i);const h=hot?rng.r(.45,.8):-1;pieceHeat.push(h);
    coalPiece(gS,gE,rng,{type:e.type,R:e.R,L:e.L,pos:[e.x,e.y,e.z],rot:[e.pitch,e.yaw,e.roll],arc:e.arc,seed:i*.0731+.3,heat:()=>h},q);});
  const geoS=res.geo(gS.build()),geoE=res.geo(gE.build());const hotS=geoS.attributes.aHeat.array.slice(),hotE=geoE.attributes.aHeat.array.slice();
  const mS=coalMat(res,TS,U,false),mE=coalMat(res,TE,U,true);const cS=finish(new T.Mesh(geoS,mS)),cE=finish(new T.Mesh(geoE,mE));cS.morphTargetInfluences[0]=0;cE.morphTargetInfluences[0]=0;g.add(cS,cE);
  /* smoke + glow */
  const nsm=q.lo?6:12;const sp=new Float32Array(nsm*3),sd=new Float32Array(nsm);for(let i=0;i<nsm;i++){sp[i*3]=rng.r(-.04,.04);sp[i*3+1]=HB+.02;sp[i*3+2]=rng.r(-.03,.03);sd[i]=i/nsm+rng()*.05;}
  const sg=new T.BufferGeometry();sg.setAttribute("position",new T.BufferAttribute(sp,3));sg.setAttribute("aSeed",new T.BufferAttribute(sd,1));
  const smoke=new T.Points(res.geo(sg),smokeMat(res,U));smoke.frustumCulled=false;smoke.renderOrder=14;g.add(smoke);
  const halo=new T.Sprite(res.mat(new T.SpriteMaterial({map:res.sh("glow",genGlow),color:new T.Color(1,.38,.1),transparent:true,opacity:.3,blending:T.AdditiveBlending,depthWrite:false,fog:false})));
  halo.scale.set(.2,.12,1);halo.position.set(0,HB-.01,0);halo.renderOrder=12;g.add(halo);
  const emberLight={position:new T.Vector3(0,HB+.04,0),color:new T.Color(1,.38,.1),intensity:0,distance:2.2,decay:2};
  const anchors={};for(const[k,p]of[["handL",[-.183,.085,0]],["handR",[.183,.085,0]],["handle",[0,HB+.162,0]]]){const o=new T.Object3D();o.name=k;o.position.set(...p);g.add(o);anchors[k]=o;}
  function setLit(b){lit=!!b;const a=geoS.attributes.aHeat,e=geoE.attributes.aHeat;for(let i=0;i<a.count;i++)a.array[i]=lit?hotS[i]:-1;for(let i=0;i<e.count;i++)e.array[i]=lit?hotE[i]:-1;a.needsUpdate=true;e.needsUpdate=true;
    smoke.visible=lit;halo.visible=lit;emberLight.intensity=lit?.45:0;}
  let tt=0;function update(dt,t){if(t==null){tt+=dt||0;t=tt;}U.uTime.value=t%600;if(lit){const f=1+.08*Math.sin(t*2.7)+.05*Math.sin(t*6.1);emberLight.intensity=.45*f;halo.material.opacity=.3*f;}}
  setLit(lit);g.userData={anchors,emberLight,setLit,update,dispose(){res.dispose();}};update(0,0);return g;}

/* ================================================================ 3. 几帳 */
const SEASONS={
  spring:{top:"#f6e6e8",hem:"#d8738d",nos:["#a8344e","#f3ebe6"],motif:"sakura",loop:"#e9c8cf"},
  summer:{top:"#e9f0f0",hem:"#9fbcc8",nos:["#5a6a8e","#dde6ec"],motif:"kuchiki",loop:"#c9d6db",sheer:true},
  autumn:{top:"#efcf8e",hem:"#a8381a",nos:["#7b2416","#c88a2a"],motif:"momiji",loop:"#d79b52"},
  winter:{top:"#f4f4f1",hem:"#a9bcb4",nos:["#3d5a47","#ecebe4"],motif:"sasa",loop:"#d9ddd8"}};
function genKatabira(season,S){const P=SEASONS[season]||SEASONS.winter;const W=S,H=S*2;const c=cv(W,H),x=c.getContext("2d");const r=RNG(401+season.length*7);
  const gr=x.createLinearGradient(0,0,0,H);gr.addColorStop(0,P.top);gr.addColorStop(.3,P.top);gr.addColorStop(1,P.hem);x.fillStyle=gr;x.fillRect(0,0,W,H);
  const k=W/512;
  /* silk weave sheen */
  for(let y=0;y<H;y+=2){x.fillStyle=`rgba(255,255,255,${(r()*.05).toFixed(3)})`;x.fillRect(0,y,W,1);}
  for(let i=0;i<W*3;i++){x.fillStyle=`rgba(${r()<.5?255:120},${r()<.5?255:110},${r()<.5?250:100},${r.r(.02,.06).toFixed(3)})`;x.fillRect(r()*W,r()*H,r.r(1,3)*k,1);}
  const each=(n,fn)=>{for(let s=0;s<2;s++)for(let i=0;i<n;i++){const px=s*W/2+r.r(.1,.9)*W/2,py=r.r(.02,.98)*H;fn(px,py,s);}};
  if(P.motif==="sakura"){const flower=(px,py,sz,rot,a)=>{x.save();x.translate(px,py);x.rotate(rot);x.globalAlpha=a;
      for(let i=0;i<5;i++){x.save();x.rotate(i*TAU/5);x.beginPath();x.moveTo(0,0);x.bezierCurveTo(-sz*.55,-sz*.35,-sz*.45,-sz*1.0,-sz*.12,-sz*1.02);x.lineTo(0,-sz*.86);x.lineTo(sz*.12,-sz*1.02);x.bezierCurveTo(sz*.45,-sz*1.0,sz*.55,-sz*.35,0,0);
        x.fillStyle="rgba(255,250,250,.95)";x.fill();x.strokeStyle="rgba(205,120,140,.7)";x.lineWidth=1.1*k;x.stroke();x.restore();}
      x.fillStyle="rgba(200,70,100,.9)";x.beginPath();x.arc(0,0,sz*.18,0,TAU);x.fill();for(let i=0;i<5;i++){x.fillStyle="rgba(190,120,40,.9)";const a2=i*TAU/5+.6;x.fillRect(Math.cos(a2)*sz*.32,Math.sin(a2)*sz*.32,1.5*k,1.5*k);}
      x.restore();x.globalAlpha=1;};
    each(9,(px,py)=>flower(px,py,r.r(14,24)*k,r()*TAU,r.r(.75,1)));for(let i=0;i<40;i++){x.fillStyle="rgba(240,180,195,.6)";x.beginPath();x.ellipse(r()*W,r()*H,4*k,2.5*k,r()*PI,0,TAU);x.fill();}}
  else if(P.motif==="momiji"){const leaf=(px,py,sz,rot,col)=>{x.save();x.translate(px,py);x.rotate(rot);x.beginPath();const n=7;
      for(let i=0;i<=n*2;i++){const a=-PI/2+(i/(n*2))*TAU*.86-TAU*.43+PI/2-PI/2;const rr=i%2===0?sz*(i===n?1:.78+.2*Math.cos((i-n)/n*PI*.5)):sz*.36;const aa=-PI*.93+i/(n*2)*PI*1.86-PI/2;x.lineTo(Math.cos(aa)*rr,Math.sin(aa)*rr);}
      x.closePath();x.fillStyle=col;x.fill();x.strokeStyle="rgba(90,20,10,.5)";x.lineWidth=1*k;for(let i=0;i<n;i++){const aa=-PI*.93+(2*i+1)/(n*2)*PI*1.86-PI/2;x.beginPath();x.moveTo(0,0);x.lineTo(Math.cos(aa)*sz*.8,Math.sin(aa)*sz*.8);x.stroke();}
      x.beginPath();x.moveTo(0,0);x.lineTo(0,sz*.55);x.stroke();x.restore();};
    each(8,(px,py)=>leaf(px,py,r.r(18,30)*k,r.r(-.6,.6)+PI,r.pick(["rgba(196,52,26,.92)","rgba(214,120,30,.92)","rgba(170,30,30,.9)","rgba(226,170,60,.9)"])));}
  else if(P.motif==="sasa"){const sasa=(px,py,sz,rot)=>{x.save();x.translate(px,py);x.rotate(rot);x.strokeStyle="rgba(70,88,52,.9)";x.lineWidth=2*k;x.beginPath();x.moveTo(0,sz*.9);x.quadraticCurveTo(sz*.1,0,0,-sz*.2);x.stroke();
      for(let i=0;i<5;i++){const a=-1.1+i*.55+r.r(-.15,.15);x.save();x.translate(0,sz*.1*i-sz*.1);x.rotate(a);const L=sz*r.r(.8,1.05),Wd=L*.2;
        x.beginPath();x.moveTo(0,0);x.quadraticCurveTo(Wd,-L*.45,0,-L);x.quadraticCurveTo(-Wd,-L*.45,0,0);x.fillStyle=i%2?"rgba(64,98,62,.92)":"rgba(48,80,56,.92)";x.fill();
        x.strokeStyle="rgba(200,215,190,.5)";x.lineWidth=.8*k;x.beginPath();x.moveTo(0,-L*.05);x.lineTo(0,-L*.92);x.stroke();
        x.fillStyle="rgba(255,255,255,.97)";x.beginPath();x.moveTo(-Wd*.6,-L*.3);x.quadraticCurveTo(-Wd*.9,-L*.62,-Wd*.1,-L*.86);x.quadraticCurveTo(-Wd*.15,-L*.55,Wd*.2,-L*.32);x.closePath();x.fill();x.restore();}
      x.fillStyle="rgba(255,255,255,.95)";x.beginPath();x.ellipse(0,-sz*.25,sz*.18,sz*.09,0,0,TAU);x.fill();x.restore();};
    each(5,(px,py)=>sasa(px,py,r.r(34,48)*k,r.r(-.4,.4)));}
  else{/* 朽木形 kuchiki-gata: decayed-wood grain bands */
    x.lineCap="round";for(let s=0;s<2;s++)for(let b=0;b<3;b++){const bx=s*W/2+W/2*(.18+.32*b)+r.r(-8,8)*k;const y0=r.r(-.1,.5)*H,y1=y0+r.r(.4,.8)*H;
      for(let l=0;l<5;l++){x.strokeStyle=`rgba(${120+r.i(-10,10)},${104+r.i(-10,10)},${82},${r.r(.35,.6).toFixed(2)})`;x.lineWidth=r.r(1.2,2.6)*k;x.beginPath();
        const ox=(l-2)*6*k;x.moveTo(bx+ox,y0);for(let y=y0;y<y1;y+=14*k){x.lineTo(bx+ox+Math.sin(y*.012+b+l*.3)*10*k+Math.sin(y*.05+l)*3*k,y);}x.stroke();}
      const ky=r.r(y0,y1);x.strokeStyle="rgba(110,92,70,.55)";x.lineWidth=1.5*k;for(let e=0;e<3;e++){x.beginPath();x.ellipse(bx,ky,(6+e*6)*k,(16+e*12)*k,0,0,TAU);x.stroke();}}}
  /* hem/edge stitching lines at each strip border */
  x.fillStyle="rgba(90,70,60,.18)";for(const ex of[0,W/2-2*k,W/2,W-2*k])x.fillRect(ex,0,2*k,H);
  return mkTex(c,{aniso:8,wrap:false});}
function makeKichou(opts){opts=opts||{};const q=QL(opts),res=new Res(),rng=RNG(3003);const g=new T.Group();g.name="MakuraKichou";
  const big=opts.size!=="3shaku";const H=big?1.5:1.2,nW=big?5:4,ww=big?.30:.26,Wc=nW*ww,postX=big?.71:.48,barHalf=Wc/2+.06,dep=big?.36:.30;
  const mLq=res.mat(new T.MeshPhysicalMaterial({color:0xffffff,roughness:.3,clearcoat:.9,clearcoatRoughness:.16,vertexColors:true}));
  const mMt=res.mat(fakeEnv(new T.MeshStandardMaterial({color:C(0xb08a48),roughness:.35,metalness:.85}),.6));
  const gf=new GB(),gm=new GB();const blk=[.03,.026,.024];
  for(const s of[-1,1]){const X=s*postX;
    gf.box(X,.035,0,.08,.07,dep,{col:blk});gf.box(X,.075,0,.05,.012,dep*.62,{col:blk});
    gf.box(X,(.08+H-.036)/2,0,.03,H-.036-.08,.03,{col:blk});
    gm.box(X,.07+.004,0,.056,.006,.06,{});gm.box(X,H-.05,0,.036,.02,.036,{});
    for(const z of[-dep/2+.012,dep/2-.012])gm.box(X,.035,z,.084,.072,.012,{});}
  gf.box(0,H-.018,0,barHalf*2,.034,.03,{col:blk});for(const s of[-1,1])gm.box(s*(barHalf+.004),H-.018,0,.012,.04,.036,{});
  g.add(finish(new T.Mesh(res.geo(gf.build()),mLq)),finish(new T.Mesh(res.geo(gm.build()),mMt)));
  /* cloth: nW strips, each (nx+1)x(ny+1), joined (same displacement) above the seam line */
  const nx=q.lo?6:10,ny=q.lo?28:52;const top=H-.035,Z0=.026,pool=.12,Lc=top+pool;const vpS=(nx+1)*(ny+1);
  const cg=new T.BufferGeometry();const pos=new Float32Array(nW*vpS*3),uv=new Float32Array(nW*vpS*2),idx=[];
  for(let s=0;s<nW;s++)for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const k=s*vpS+j*(nx+1)+i;uv[k*2]=(s%2)*.5+(.004+.992*i/nx)*.5;uv[k*2+1]=1-j/ny;
    if(i<nx&&j<ny){const a=k,b=k+1,c=k+nx+2,d=k+nx+1;idx.push(a,d,b,b,d,c);}}
  cg.setAttribute("position",new T.BufferAttribute(pos,3));cg.setAttribute("uv",new T.BufferAttribute(uv,2));cg.setIndex(idx);
  const ph=[],amp=[];for(let s=0;s<nW;s++){ph.push(rng()*TAU);amp.push(rng.r(.7,1.25)*(s%2?1:-1));}
  let wind=opts.wind!=null?opts.wind:.35;
  const clothAt=(s,u,sv,t,out)=>{const x0=-Wc/2+s*ww;const x=x0+u*ww;const hs=Math.min(sv,top);const fr=hs/top;
    let z=(.01+.03*fr)*(Math.sin(u*TAU)*amp[s]+.35*Math.sin(u*2*TAU+ph[s]*.2)*(s%2?-1:1));
    const free=ss(.45,1,fr);const sw=(Math.sin(t*.9+ph[s])*.6+Math.sin(t*2.3+ph[s]*1.7)*.4)*wind;z+=free*free*.03*sw+free*.006*Math.pow(Math.abs(2*u-1),3);
    let xx=x+free*.004*sw*(u-.5);
    /* top scallops between the loops */
    let y=top-sv;const sc=(1-ss(0,.05,sv))*.006*Math.abs(Math.sin(u*TAU));y-=sc;
    const rr=.045;let zf=0;if(sv>top-rr){const a=Math.min((sv-(top-rr))/rr,PI/2);if(sv<top-rr+rr*PI/2){y=rr-rr*Math.sin(a);zf=rr-rr*Math.cos(a);}else{y=0;zf=rr+(sv-(top-rr+rr*PI/2));}y+=.004;}
    out[0]=xx;out[1]=y;out[2]=Z0+z+zf;};
  const tmp=[0,0,0];
  function layCloth(t){for(let s=0;s<nW;s++)for(let j=0;j<=ny;j++){const sv=Lc*j/ny;for(let i=0;i<=nx;i++){clothAt(s,i/nx,sv,t,tmp);const k=(s*vpS+j*(nx+1)+i)*3;pos[k]=tmp[0];pos[k+1]=tmp[1];pos[k+2]=tmp[2];}}
    cg.attributes.position.needsUpdate=true;cg.computeVertexNormals();}
  layCloth(0);cg.computeBoundingSphere();res.geo(cg);
  let ctex=null;const mCl=res.mat(new T.MeshStandardMaterial({color:0xffffff,roughness:.66,side:T.DoubleSide}));
  const cloth=finish(new T.Mesh(cg,mCl));cloth.name="katabira";g.add(cloth);
  /* 野筋 (two-tone bands at each seam) + 乳 (loops over the bar) */
  const nb=q.lo?24:44,bands=[];for(let s=1;s<nW;s++)for(const d of[-1,1])bands.push({s,dx:d*.017,col:d<0?0:1,len:Lc+.1+rng.r(0,.05)});
  const bg=new T.BufferGeometry();const bp=new Float32Array(bands.length*(nb+3)*2*3),bc=new Float32Array(bands.length*(nb+3)*2*3),bi=[];
  bands.forEach((b,bi0)=>{for(let j=0;j<nb+3;j++)for(let e=0;e<2;e++){const k=bi0*(nb+3)*2+j*2+e;if(j<nb+2&&e===0){bi.push(k,k+2,k+1,k+1,k+2,k+3);}}});
  bg.setAttribute("position",new T.BufferAttribute(bp,3));bg.setAttribute("color",new T.BufferAttribute(bc,3));bg.setIndex(bi);
  const mNo=res.mat(new T.MeshStandardMaterial({color:0xffffff,roughness:.6,vertexColors:true,side:T.DoubleSide}));
  function layBands(t){bands.forEach((b,i0)=>{const base=i0*(nb+3)*2;const hw=.016;
      for(let j=0;j<nb+3;j++){let p0,p1;if(j===0){/* over the bar */const xx=-Wc/2+b.s*ww+b.dx;p0=[xx-hw,H+.003,-.02];p1=[xx+hw,H+.003,-.02];}
        else if(j===1){const xx=-Wc/2+b.s*ww+b.dx;p0=[xx-hw,H+.002,.02];p1=[xx+hw,H+.002,.02];}
        else{const sv=Math.min(b.len,(j-2)/nb*b.len);const s=b.s,u=0;/* seam: right edge of strip s-1 = left edge of strip s */
          const L2=Math.min(sv,Lc);clothAt(s,u,L2,t,tmp);let x=tmp[0]+b.dx,y=tmp[1],z=tmp[2]+.005;if(sv>Lc){z+=sv-Lc;y=.006;}if(sv<.03){y=Math.min(y,top+.012);z=Math.max(Z0+.006,z);}
          p0=[x-hw,y,z];p1=[x+hw,y,z];}
        for(const[e,p]of[[0,p0],[1,p1]]){const k=(base+j*2+e)*3;bp[k]=p[0];bp[k+1]=p[1];bp[k+2]=p[2];}}});
    bg.attributes.position.needsUpdate=true;bg.computeVertexNormals();}
  layBands(0);bg.computeBoundingSphere();res.geo(bg);const nosuji=finish(new T.Mesh(bg,mNo));nosuji.name="nosuji";g.add(nosuji);
  const gL=new GB();const loopsPer=2;let lc=[1,1,1];
  const lg=res.geo(new T.BufferGeometry());const loops=finish(new T.Mesh(lg,mNo));g.add(loops);
  function buildLoops(col){const b=new GB();for(let s=0;s<nW;s++)for(let l=0;l<loopsPer;l++){const x=-Wc/2+s*ww+ww*(l+.5)/loopsPer;const tg=new T.TorusGeometry(.024,.0055,5,10,PI);
      b.geom(tg,new T.Matrix4().makeRotationY(PI/2).setPosition(x,H-.018,.0),{col});tg.dispose();}
    const ng=b.build();loops.geometry.dispose();loops.geometry=ng;res.geo(ng);}
  let season=null;
  function setSeason(sn){sn=SEASONS[sn]?sn:"winter";if(sn===season)return;season=sn;const P=SEASONS[sn];
    if(ctex)ctex.dispose();ctex=genKatabira(sn,q.hi?512:q.md?384:256);mCl.map=ctex;
    mCl.transparent=!!P.sheer;mCl.opacity=P.sheer?.52:1;mCl.depthWrite=!P.sheer;mCl.needsUpdate=true;cloth.renderOrder=P.sheer?5:0;cloth.castShadow=!P.sheer;
    const c0=C(P.nos[0]),c1=C(P.nos[1]);bands.forEach((b,i0)=>{const c=b.col?c1:c0;for(let j=0;j<(nb+3)*2;j++){const k=(i0*(nb+3)*2+j)*3;bc[k]=c.r;bc[k+1]=c.g;bc[k+2]=c.b;}});bg.attributes.color.needsUpdate=true;
    const lcC=C(P.loop);buildLoops([lcC.r,lcC.g,lcC.b]);}
  setSeason(opts.season||"winter");
  let tt=0,last=-1;function update(dt,t){if(t==null){tt+=dt||0;t=tt;}if(wind<=0&&last>=0)return;if(Math.abs(t-last)<1/40)return;last=t;layCloth(t);layBands(t);}
  g.userData={dims:{height:H,width:Wc,barLen:barHalf*2,postX,depth:dep},setSeason,setWind(v){wind=clamp(+v||0,0,1);layCloth(last<0?0:last);layBands(last<0?0:last);},update,
    dispose(){if(ctex)ctex.dispose();res.dispose();}};
  return g;}

return{makeHioke,makeSumitori,makeKichou};
})();
