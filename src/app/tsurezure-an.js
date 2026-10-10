/* =============================================================================
 tsurezure-an.js — 兼好法師の草庵（双ヶ岡・鎌倉末期 c.1330）と調度   →  const TSURE_AN
 依存: THREE (r128) のみ。テクスチャはすべて canvas で手続き生成、乱数はシード付き（毎回同じ見た目）。
 単位 m / +Y 上。草庵は「開いた正面（縁・庭側）= +Z（南）」。人物は +Z 向きに座る。

 ── API ──────────────────────────────────────────────────────────────────────
 TSURE_AN.makeAn({quality:"high"|"medium"|"low", seed?:number, groundShadow?:true}) -> THREE.Group
   草庵本体（地形なし）。原点 = 母屋（3.0m×2.7m）床面中心の真下の地面 (y=0)。
   母屋柱芯 x:-1.5..+1.5, z:-1.35..+1.35 / 床上端 y=0.50 / 桁上端 y=2.62 / 棟 y≈3.3
   竹簀子縁: 正面 z=+1.35..+2.26（奥行0.9）＋東(+X)側 x=+1.5..+2.26 に回る（上端 y=0.50）。
   板葺石置の切妻屋根（棟は X 方向）。軒先 z=+2.50 / 背面 z=-1.95 / 妻 x=-2.10..+2.55。
   正面は蔀戸（上下二枚・上は外へ吊り上げ）、東面は舞良戸＋明障子、西面は土壁＋連子窓、背面は横板壁。
   内部: 板敷＋置畳1枚、掛幅（阿弥陀）と経机、吊棚に冊子・巻子・皮籠。外: 閼伽棚＋懸樋、沓脱石、薪。
   userData.anchors（Object3D, 群ローカル座標。rotation.y も意味を持つ）:
     seat       (-0.25, 0.615, 1.04)  縁先の座（母屋正面際の畳の上・+Z向き）。y=円座上面（=腰を置く高さ）
                                       → 円座は (seat.x, seat.y-0.06, seat.z) に置く。
     desk       (-0.25, 0.50, 1.48)   その前の文机（簀子/敷居の上、床面 y）。makeFuzukue をここに置く。
     seatInside (-0.25, 0.615,-0.20)  室内奥の座（夜の燈火の場面。+Z向き）。y=円座上面。
     deskInside (-0.25, 0.555, 0.22)  室内の座の前の文机（畳の上）。
     lamp       (-0.92, 0.50, 0.02)   燈台を置く床の点（座の右手＝-X側）。炎の中心は lamp + (0.069,0.826,0)。
     armrest    ( 0.16, 0.555,-0.22)  脇息（座の左手）。rotation.y=π/2（脇息の長手を Z 方向に）。
     stepFront  ( 0.55, 0.22, 2.62)   沓脱石の上面中心。
     basin      (-2.04, 0.93, 1.86)   閼伽棚の上の閼伽桶の水面中心（懸樋の水が落ちる）。
   userData.setShutters(v)  0=閉 … 1=蔀を吊り上げて全開（下蔀は外す）。既定 1。
   userData.setSeason("spring"|"summer"|"autumn"|"winter")  冬=屋根・棟・軒・縁先・沓脱石・閼伽棚に雪と氷柱、懸樋は凍る。
                             秋=屋根と縁に紅葉の落葉、閼伽棚に菊と紅葉。春=縁に花びら。夏=東の簀子に簾を下ろす。既定 autumn。
   userData.setNight(v 0..1)  明障子・連子窓の紙が内側の灯で暖色に光る（燈台の点光源はシーン側で置く）。
   userData.update(dt,t)      懸樋の水・波紋・紙のかすかなゆらぎ・furnish した調度の更新。
   userData.furnish("veranda"|"inside"|"none") → {enza,fuzukue,toudai,kyousoku}  アンカーに調度を自動配置（任意）。
   userData.dispose()         作ったジオメトリ・マテリアル・テクスチャ（共有分は参照カウント）を解放。
   userData.groundShadow      足元の接地陰（透明メッシュ, y=0.004）。地形が平らでない時は visible=false に。
   userData.dims              主要寸法 {floorY, eaveFront, ...}
 TSURE_AN.makeFuzukue({quality}) -> Group  文机（天板 0.75×0.35、上面 y=0.315）。原点 = 机中心の床。
   書き手は -Z 側に座って +Z を向く（料紙の文字は書き手から正立・縦書き・書き手の右=-X 側の行から始まる）。
   卓上: 硯箱（蓋を下に敷く。硯=陸と海の墨池に艶、水滴=青白磁、墨）, 筆置と筆, 料紙3枚, 冊子3冊, 巻子。
   userData.paper (Mesh), userData.brush (Object3D), userData.brushTip (Vector3, ローカル: 今書いている位置),
   userData.setWritten(v 0..1) 料紙の仮名（徒然草第七段冒頭）を右の行から上→下へ順に現す。既定 1。dispose()。
 TSURE_AN.makeToudai({quality}) -> Group  燈台（高さ≈0.83m。黒漆・八花形の台・細い竿・受皿に土器・灯心）。原点=台の底中心。
   userData.flame (Object3D, 炎の中心 ローカル(0.069,0.826,0)), setLit(bool), setIntensity(v 0..1.5),
   update(dt,t) で炎がゆらぐ。userData.flicker (0..1, 現在値) を PointLight の強さに掛けて同期させる。dispose()。
 TSURE_AN.makeEnza({quality})     円座（径0.45、上面 y≈0.061、渦巻きの藁編み）。原点=底中心。
 TSURE_AN.makeKyousoku({quality}) 脇息（溜塗の赤茶、長手は X、高さ0.33）。原点=底中心。
 TSURE_AN.makeShibagaki({length=4,height=1.1,quality})  柴垣。x=0..length（+X 方向）, z=0 中心, 地面 y=0。
 TSURE_AN.makeAkadana({quality})  閼伽棚（棚上面 y=0.80, 0.62×0.48, 閼伽桶・樒）。原点=棚中心の地面。
     userData.anchors.basin = 閼伽桶の水面。※草庵には既に一基組み込み済み（anchors.basin）。
 TSURE_AN.makeKyoudai({quality})  経机（黒漆・筆返し付き、上に経巻・香炉・花瓶）。原点=机中心の床。
 すべて castShadow/receiveShadow 設定済み。描画コール: 草庵≈30、調度一式≈35。quality=low でテクスチャ・分割・数を削減。
============================================================================= */
const TSURE_AN=(()=>{
"use strict";
const T=THREE,PI=Math.PI,TAU=PI*2;

/* ---------------------------------------------------------------- utils */
function mulberry(a){a=a>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function RNG(seed){const f=mulberry((Math.imul(seed|0,0x9E3779B1)^0x5bd1e995)>>>0);const o=()=>f();
  o.r=(a,b)=>a+(b-a)*f();o.i=(a,b)=>a+Math.floor((b-a+1)*f());o.g=()=>(f()+f()+f()+f()-2)*1.7320508;
  o.pick=a=>a[Math.floor(f()*a.length)];o.c=p=>f()<p;return o;}
const ss=(a,b,x)=>{x=(x-a)/(b-a);x=x<0?0:x>1?1:x;return x*x*(3-2*x);};
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const lerp=(a,b,t)=>a+(b-a)*t;
function lattice(seed,gx,gy){const f=mulberry(seed*7919+13);const a=new Float32Array(gx*gy);for(let i=0;i<a.length;i++)a[i]=f();
  return (x,y)=>{let xi=Math.floor(x),yi=Math.floor(y);let tx=x-xi,ty=y-yi;tx=tx*tx*(3-2*tx);ty=ty*ty*(3-2*ty);
    xi%=gx;if(xi<0)xi+=gx;yi%=gy;if(yi<0)yi+=gy;const x1=xi+1===gx?0:xi+1,y1=yi+1===gy?0:yi+1;
    const a0=a[yi*gx+xi],a1=a[yi*gx+x1],b0=a[y1*gx+xi],b1=a[y1*gx+x1];const m0=a0+(a1-a0)*tx,m1=b0+(b1-b0)*tx;return m0+(m1-m0)*ty;};}
/* periodic fbm on the unit square: f(u,v), u,v in [0,1) (period 1) */
function fbm(seed,gx,gy,oct,gain){gain=gain||.5;const L=[];for(let i=0;i<oct;i++)L.push(lattice(seed+i*101,gx<<i,gy<<i));
  let nrm=0,a=1;for(let i=0;i<oct;i++){nrm+=a;a*=gain;}
  return (u,v)=>{let s=0,a=1;for(let i=0;i<oct;i++){s+=a*L[i](u*(gx<<i),v*(gy<<i));a*=gain;}return s/nrm;};}
const C=h=>new T.Color(h).convertSRGBToLinear();
function cv(w,h){const c=document.createElement("canvas");c.width=w;c.height=h;return c;}
function mkTex(c,o){o=o||{};const t=new T.CanvasTexture(c);if(o.srgb!==false)t.encoding=T.sRGBEncoding;
  const w=o.wrap===false?T.ClampToEdgeWrapping:T.RepeatWrapping;t.wrapS=t.wrapT=w;t.anisotropy=o.aniso||4;t.needsUpdate=true;return t;}
const WHITE=[1,1,1];
const mul3=(a,b)=>typeof b==="number"?[a[0]*b,a[1]*b,a[2]*b]:[a[0]*b[0],a[1]*b[1],a[2]*b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const vlen=a=>Math.hypot(a[0],a[1],a[2]);
const nrmz=a=>{const l=vlen(a)||1;return[a[0]/l,a[1]/l,a[2]/l];};
function tint(r,base,amt){const k=1+(r()-.5)*2*amt;const h=(r()-.5)*amt*.5;return[base[0]*k*(1+h),base[1]*k,base[2]*k*(1-h)];}

/* ---------------------------------------------------------------- shared (ref-counted) texture cache */
const CACHE=new Map();
function shared(key,build){let e=CACHE.get(key);if(!e){e={v:build(),n:0};CACHE.set(key,e);}e.n++;return e.v;}
function dispAny(x){if(!x)return;if(x.isTexture){x.dispose();return;}if(typeof x==="object")for(const k in x){const y=x[k];if(y&&y.isTexture)y.dispose();}}
function unshare(key){const e=CACHE.get(key);if(!e)return;if(--e.n<=0){CACHE.delete(key);dispAny(e.v);}}
function Res(){this.g=[];this.m=[];this.t=[];this.k=[];this.sub=[];}
Res.prototype.geo=function(g){this.g.push(g);return g;};
Res.prototype.mat=function(m){this.m.push(m);return m;};
Res.prototype.tex=function(t){this.t.push(t);return t;};
Res.prototype.sh=function(key,build){this.k.push(key);return shared(key,build);};
Res.prototype.dispose=function(){this.sub.forEach(s=>{try{s();}catch(e){}});this.g.forEach(g=>g.dispose());this.m.forEach(m=>m.dispose());this.t.forEach(t=>t.dispose());this.k.forEach(unshare);
  this.g=[];this.m=[];this.t=[];this.k=[];this.sub=[];};
function QL(o){const q=(o&&o.quality)||"high";const hi=q==="high",lo=q==="low";return{q,hi,lo,md:!hi&&!lo,ts:hi?1024:lo?256:512,k:hi?1:lo?.45:.7};}

/* ---------------------------------------------------------------- geometry builder (merges everything per material) */
const US=1/2.4,VS=1/1.2;            // wood atlas: 2.4m along grain x 1.2m across
function GB(){this.P=[];this.N=[];this.U=[];this.A=[];this.C=[];this.I=[];this.n=0;this.ao=null;this.cf=null;}
GB.prototype.vtx=function(p,nr,u,v,c){let r=c[0],g=c[1],b=c[2];
  if(this.cf){const m=this.cf(p,nr);r*=m[0];g*=m[1];b*=m[2];}
  const a=this.ao?this.ao(p,nr):1;
  this.P.push(p[0],p[1],p[2]);this.N.push(nr[0],nr[1],nr[2]);this.U.push(u,v);this.A.push(clamp(a,0,1)*.996+.002,.5);this.C.push(r,g,b);return this.n++;};
GB.prototype.face=function(pts,uvs,col,hint){const n=pts.length;let nx=0,ny=0,nz=0;
  for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n];nx+=(a[1]-b[1])*(a[2]+b[2]);ny+=(a[2]-b[2])*(a[0]+b[0]);nz+=(a[0]-b[0])*(a[1]+b[1]);}
  const l=Math.hypot(nx,ny,nz);if(l<1e-14)return;nx/=l;ny/=l;nz/=l;let rev=false;
  if(hint&&nx*hint[0]+ny*hint[1]+nz*hint[2]<0){rev=true;nx=-nx;ny=-ny;nz=-nz;}
  const nr=[nx,ny,nz],per=Array.isArray(col[0]),id=new Array(n);
  for(let i=0;i<n;i++)id[i]=this.vtx(pts[i],nr,uvs[i][0],uvs[i][1],per?col[i]:col);
  for(let i=1;i<n-1;i++){if(rev)this.I.push(id[0],id[i+1],id[i]);else this.I.push(id[0],id[i],id[i+1]);}};
const AXV={x:[1,0,0],y:[0,1,0],z:[0,0,1]};
function toW(ax,p,q,a){return ax==="x"?[a,q,p]:ax==="y"?[p,a,q]:[p,q,a];}
function isConvex(poly){let s=0;const n=poly.length;for(let i=0;i<n;i++){const a=poly[i],b=poly[(i+1)%n],c=poly[(i+2)%n];
  const cr=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(Math.abs(cr)<1e-12)continue;const sg=cr>0?1:-1;if(!s)s=sg;else if(s!==sg)return false;}return true;}
/* extrude polygon (in the plane ⟂ axis; x:(z,y) y:(x,z) z:(x,y)) from a0 to a1 along axis. grain (u) runs along the axis */
GB.prototype.prism=function(poly,ax,a0,a1,o){o=o||{};const seg=o.seg||1,us=o.us!=null?o.us:US,vs=o.vs!=null?o.vs:VS,uo=o.uo||0,vo=o.vo||0,col=o.col||WHITE,ek=o.ek!=null?o.ek:.74;
  const n=poly.length;let cp=0,cq=0;for(const t of poly){cp+=t[0];cq+=t[1];}cp/=n;cq/=n;let per=0;
  for(let i=0;i<n;i++){const A=poly[i],B=poly[(i+1)%n];const len=Math.hypot(B[0]-A[0],B[1]-A[1]);if(len<1e-7)continue;
    const hint=toW(ax,(A[0]+B[0])/2-cp,(A[1]+B[1])/2-cq,0);
    for(let s=0;s<seg;s++){const b0=a0+(a1-a0)*s/seg,b1=a0+(a1-a0)*(s+1)/seg;
      this.face([toW(ax,A[0],A[1],b0),toW(ax,B[0],B[1],b0),toW(ax,B[0],B[1],b1),toW(ax,A[0],A[1],b1)],
        [[b0*us+uo,per*vs+vo],[b0*us+uo,(per+len)*vs+vo],[b1*us+uo,(per+len)*vs+vo],[b1*us+uo,per*vs+vo]],col,hint);}
    per+=len;}
  if(!o.noCap){const ec=mul3(col,ek),av=AXV[ax];
    if(!o.noCap0)this.cap(poly,ax,Math.min(a0,a1),[-av[0],-av[1],-av[2]],ec,uo,vo);
    if(!o.noCap1)this.cap(poly,ax,Math.max(a0,a1),av,ec,uo,vo);}};
GB.prototype.cap=function(poly,ax,a,hint,col,uo,vo){const pts=poly.map(t=>toW(ax,t[0],t[1],a)),uvs=poly.map(t=>[t[0]*.04+uo,t[1]*.04+vo]);
  if(isConvex(poly)){this.face(pts,uvs,col,hint);return;}
  const tr=T.ShapeUtils.triangulateShape(poly.map(t=>new T.Vector2(t[0],t[1])),[]);
  for(const f of tr)this.face([pts[f[0]],pts[f[1]],pts[f[2]]],[uvs[f[0]],uvs[f[1]],uvs[f[2]]],col,hint);};
function rect(p,q,hp,hq,c){if(!c)return[[p-hp,q-hq],[p+hp,q-hq],[p+hp,q+hq],[p-hp,q+hq]];
  return[[p-hp+c,q-hq],[p+hp-c,q-hq],[p+hp,q-hq+c],[p+hp,q+hq-c],[p+hp-c,q+hq],[p-hp+c,q+hq],[p-hp,q+hq-c],[p-hp,q-hq+c]];}
/* axis-aligned box, grain along `ax` */
GB.prototype.box=function(cx,cy,cz,sx,sy,sz,ax,o){ax=ax||"x";o=o||{};const c=o.ch||0;
  if(ax==="x")this.prism(rect(cz,cy,sz/2,sy/2,c),"x",cx-sx/2,cx+sx/2,o);
  else if(ax==="y")this.prism(rect(cx,cz,sx/2,sz/2,c),"y",cy-sy/2,cy+sy/2,o);
  else this.prism(rect(cx,cy,sx/2,sy/2,c),"z",cz-sz/2,cz+sz/2,o);};
/* cylinder/tube between p0 and p1 (rings: t list). o: rf(t) radius mult, wob(t)->[a,b], cf(t)->color mult, cap0/cap1, hollow */
GB.prototype.cyl=function(p0,p1,r0,r1,seg,o){o=o||{};const d=sub(p1,p0),L=vlen(d);if(L<1e-6)return;const dn=[d[0]/L,d[1]/L,d[2]/L];
  const up=Math.abs(dn[1])<.95?[0,1,0]:[1,0,0];const e1=nrmz(cross(up,dn)),e2=cross(dn,e1);
  const rings=o.rings||[0,1],us=o.us!=null?o.us:US,vs=o.vs!=null?o.vs:VS,uo=o.uo||0,vo=o.vo||0,col=o.col||WHITE,base=this.n,rl=seg+1;
  const ctr=[],rad=[];
  for(let j=0;j<rings.length;j++){const t=rings[j];const r=lerp(r0,r1,t)*(o.rf?o.rf(t):1);
    const c=[p0[0]+d[0]*t,p0[1]+d[1]*t,p0[2]+d[2]*t];if(o.wob){const w=o.wob(t);for(let k=0;k<3;k++)c[k]+=e1[k]*w[0]+e2[k]*w[1];}
    ctr.push(c);rad.push(r);const cc=o.cf?mul3(col,o.cf(t)):col;
    for(let i=0;i<=seg;i++){const ph=i/seg*TAU+(o.ph||0),cs=Math.cos(ph),sn=Math.sin(ph);const nr=[e1[0]*cs+e2[0]*sn,e1[1]*cs+e2[1]*sn,e1[2]*cs+e2[2]*sn];
      this.vtx([c[0]+nr[0]*r,c[1]+nr[1]*r,c[2]+nr[2]*r],nr,t*L*us+uo,(i/seg)*TAU*Math.max(r0,r1)*vs+vo,cc);}}
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<seg;i++){const a=base+j*rl+i;this.I.push(a,a+1,a+rl+1,a,a+rl+1,a+rl);}
  const capf=(k,sgn)=>{const c=ctr[k],r=rad[k],nr=sgn>0?dn:[-dn[0],-dn[1],-dn[2]];const cc=o.capCol||mul3(col,.8);const CU=o.capUV;
    const ci=this.vtx(c,nr,CU?CU[0]:uo,CU?CU[1]:vo,o.hollow?mul3(cc,.25):cc);const ids=[];
    for(let i=0;i<=seg;i++){const ph=i/seg*TAU+(o.ph||0),cs=Math.cos(ph),sn=Math.sin(ph);
      ids.push(this.vtx([c[0]+(e1[0]*cs+e2[0]*sn)*r,c[1]+(e1[1]*cs+e2[1]*sn)*r,c[2]+(e1[2]*cs+e2[2]*sn)*r],nr,CU?CU[0]+cs*CU[2]:uo+cs*r*us,CU?CU[1]+sn*CU[3]:vo+sn*r*vs,cc));}
    for(let i=0;i<seg;i++){if(sgn>0)this.I.push(ci,ids[i],ids[i+1]);else this.I.push(ci,ids[i+1],ids[i]);}};
  if(o.cap0)capf(0,-1);if(o.cap1)capf(rings.length-1,1);};
/* lathe around +Y at (cx,cy,cz). prof [[r,y],..] bottom→top for outer surfaces. o.rm(ph,j) radial mult, o.cf(t,j) colour, o.uv(ph,j)->[u,v] */
GB.prototype.lathe=function(prof,seg,cx,cy,cz,o){o=o||{};const base=this.n,rl=seg+1,n=prof.length,col=o.col||WHITE;const nrm=[];
  for(let j=0;j<n;j++){const a=prof[Math.max(0,j-1)],b=prof[Math.min(n-1,j+1)];const dr=b[0]-a[0],dy=b[1]-a[1];const l=Math.hypot(dr,dy)||1;nrm.push([dy/l,-dr/l]);}
  for(let j=0;j<n;j++){const r=prof[j][0],y=prof[j][1];const cc=o.cf?mul3(col,o.cf(j/(n-1),j)):col;
    for(let i=0;i<=seg;i++){const ph=i/seg*TAU+(o.ph||0);const m=o.rm?o.rm(ph,j):1;const cs=Math.cos(ph),sn=Math.sin(ph);
      let nx=cs*nrm[j][0],ny=nrm[j][1],nz=sn*nrm[j][0];if(o.flipN){nx=-nx;ny=-ny;nz=-nz;}
      const uv=o.uv?o.uv(ph,j,r*m,y):[i/seg,j/(n-1)];this.vtx([cx+cs*r*m,cy+y,cz+sn*r*m],[nx,ny,nz],uv[0],uv[1],cc);}}
  for(let j=0;j<n-1;j++)for(let i=0;i<seg;i++){const a=base+j*rl+i,b=a+1,c=a+rl+1,d=a+rl;
    if(o.flipN)this.I.push(a,c,d,a,b,c);else this.I.push(a,d,c,a,c,b);}};
/* merge an arbitrary BufferGeometry with a Matrix4 */
GB.prototype.geom=function(g,m,o){o=o||{};const P=g.attributes.position,N=g.attributes.normal,UV=g.attributes.uv;const nm=new T.Matrix3().getNormalMatrix(m);
  const v=new T.Vector3(),w=new T.Vector3();const base=this.n,col=o.col||WHITE;
  for(let i=0;i<P.count;i++){v.fromBufferAttribute(P,i).applyMatrix4(m);if(N)w.fromBufferAttribute(N,i).applyMatrix3(nm).normalize();else w.set(0,1,0);
    const uu=UV?UV.getX(i)*(o.us||1)+(o.uo||0):0,vv=UV?UV.getY(i)*(o.vs||1)+(o.vo||0):0;
    this.vtx([v.x,v.y,v.z],[w.x,w.y,w.z],o.swap?vv:uu,o.swap?uu:vv,o.cf?mul3(col,o.cf([v.x,v.y,v.z])):col);}
  if(g.index){const I=g.index.array;for(let i=0;i<I.length;i++)this.I.push(base+I[i]);}else for(let i=0;i<P.count;i++)this.I.push(base+i);};
const ICO={};
function ico(det){if(ICO[det])return ICO[det];const t=(1+Math.sqrt(5))/2;
  let V=[-1,t,0,1,t,0,-1,-t,0,1,-t,0,0,-1,t,0,1,t,0,-1,-t,0,1,-t,t,0,-1,t,0,1,-t,0,-1,-t,0,1];
  let F=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];
  const nv=v=>{const l=Math.hypot(v[0],v[1],v[2]);return[v[0]/l,v[1]/l,v[2]/l];};
  let P=[];for(let i=0;i<V.length;i+=3)P.push(nv([V[i],V[i+1],V[i+2]]));
  for(let d=0;d<det;d++){const cache={},NF=[];const mid=(a,b)=>{const k=a<b?a+"_"+b:b+"_"+a;if(cache[k]!=null)return cache[k];
      const A=P[a],B=P[b];P.push(nv([(A[0]+B[0])/2,(A[1]+B[1])/2,(A[2]+B[2])/2]));return(cache[k]=P.length-1);};
    for(let i=0;i<F.length;i+=3){const a=F[i],b=F[i+1],c=F[i+2],ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);NF.push(a,ab,ca,b,bc,ab,c,ca,bc,ab,bc,ca);}F=NF;}
  return(ICO[det]={v:P,f:F});}
/* natural stone: displaced icosphere. o: det, flat (top plateau, unit), flatB, yaw, m (3x3 row-major rot), col, moss(0..1), mossCol */
GB.prototype.stone=function(cx,cy,cz,rx,ry,rz,rng,o){o=o||{};const S=ico(o.det==null?2:o.det),nv=S.v.length;
  const W=[];for(let k=0;k<4;k++){const th=rng()*TAU,ph=Math.acos(rng()*2-1);W.push([Math.sin(ph)*Math.cos(th),Math.cos(ph),Math.sin(ph)*Math.sin(th),rng.r(1.6,4.2),rng()*TAU,rng.r(.03,.085)*(o.rough||1)]);}
  const yaw=o.yaw!=null?o.yaw:rng()*TAU,cy_=Math.cos(yaw),sy_=Math.sin(yaw),M=o.m;const pos=[],loc=[];
  for(let i=0;i<nv;i++){let[x,y,z]=S.v[i];let d=1;for(const w of W)d+=w[5]*Math.sin((x*w[0]+y*w[1]+z*w[2])*w[3]+w[4]);x*=d;y*=d;z*=d;
    if(o.flat!=null&&y>o.flat)y=o.flat+(y-o.flat)*.1;if(o.flatB!=null&&y<-o.flatB)y=-o.flatB+(y+o.flatB)*.15;loc.push(y);
    x*=rx;y*=ry;z*=rz;let X=x*cy_-z*sy_,Z=x*sy_+z*cy_;x=X;z=Z;
    if(M){const a=M[0]*x+M[1]*y+M[2]*z,b=M[3]*x+M[4]*y+M[5]*z,c=M[6]*x+M[7]*y+M[8]*z;x=a;y=b;z=c;}pos.push([x+cx,y+cy,z+cz]);}
  const nor=pos.map(()=>[0,0,0]);
  for(let f=0;f<S.f.length;f+=3){const a=S.f[f],b=S.f[f+1],c=S.f[f+2];const n=cross(sub(pos[b],pos[a]),sub(pos[c],pos[a]));for(const k of[a,b,c]){nor[k][0]+=n[0];nor[k][1]+=n[1];nor[k][2]+=n[2];}}
  const base=this.n,col=o.col||[.6,.58,.55],mc=o.mossCol||[.30,.38,.16];const sc=1/.3;
  for(let i=0;i<nv;i++){const p=pos[i],n=nrmz(nor[i]);let c=mul3(col,.66+.34*ss(-1,.55,loc[i]));
    if(o.moss){const m=o.moss*ss(.45,.95,n[1])*(.55+.45*Math.sin(p[0]*31+p[2]*17+i));if(m>0)c=[lerp(c[0],mc[0],m),lerp(c[1],mc[1],m),lerp(c[2],mc[2],m)];}
    const ax=Math.abs(n[0]),ay=Math.abs(n[1]),az=Math.abs(n[2]);let u,v;if(ay>=ax&&ay>=az){u=p[0];v=p[2];}else if(ax>=az){u=p[2];v=p[1];}else{u=p[0];v=p[1];}
    this.vtx(p,n,u*sc+cx*3.1,v*sc+cz*2.3,c);}
  for(let f=0;f<S.f.length;f++)this.I.push(base+S.f[f]);};
GB.prototype.xform=function(from,fn){for(let i=from;i<this.n;i++){const r=fn([this.P[i*3],this.P[i*3+1],this.P[i*3+2]],[this.N[i*3],this.N[i*3+1],this.N[i*3+2]]);
  for(let k=0;k<3;k++){this.P[i*3+k]=r[0][k];this.N[i*3+k]=r[1][k];}if(this.ao)this.A[i*2]=clamp(this.ao(r[0],r[1]),0,1)*.996+.002;}};
GB.prototype.build=function(){if(!this.n)return null;const g=new T.BufferGeometry();
  g.setAttribute("position",new T.Float32BufferAttribute(this.P,3));g.setAttribute("normal",new T.Float32BufferAttribute(this.N,3));
  g.setAttribute("uv",new T.Float32BufferAttribute(this.U,2));g.setAttribute("uv2",new T.Float32BufferAttribute(this.A,2));
  g.setAttribute("color",new T.Float32BufferAttribute(this.C,3));g.setIndex(this.I);g.computeBoundingSphere();g.computeBoundingBox();return g;};

/* ---------------------------------------------------------------- procedural textures */
function imgLoop(W,H,fn){const c=cv(W,H),d=cv(W,H),cx=c.getContext("2d"),dx=d.getContext("2d");const ci=cx.createImageData(W,H),di=dx.createImageData(W,H);
  const A=ci.data,B=di.data,out=[0,0,0,0,0,0];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){fn(x/W,y/H,out,x,y);const i=(y*W+x)*4;A[i]=out[0];A[i+1]=out[1];A[i+2]=out[2];A[i+3]=255;B[i]=out[3];B[i+1]=out[4];B[i+2]=out[5];B[i+3]=255;}
  cx.putImageData(ci,0,0);dx.putImageData(di,0,0);return{c,d,cx,dx};}
/* weathered sugi/hinoki atlas (u along grain = 2.4 m, v across = 1.2 m). data: R=bump G=roughness */
function genWood(W){const H=W>>1,r=RNG(71);const wv=fbm(11,3,10,3),wv2=fbm(12,8,40,2),fib=fbm(13,6,160,2),blot=fbm(14,4,3,4),st=fbm(15,2,24,3),grit=fbm(16,96,48,1),tone=fbm(17,2,5,3);
  const NR=110;const lens=[];for(let i=0;i<10;i++)lens.push([r(),r(),r.r(.04,.12),r.r(.012,.032),r.r(2.5,8)*(r()<.5?1:-1)]);const kn=[];for(let i=0;i<3;i++)kn.push([r(),r(),r.r(.005,.011)]);
  const o=imgLoop(W,H,(u,v,out)=>{let ring=v*NR+6.4*(wv(u,v)-.5)+1.6*(wv2(u,v)-.5);let kk=0;
    for(let k=0;k<lens.length;k++){const L=lens[k];let du=u-L[0];du-=Math.round(du);let dv=v-L[1];dv-=Math.round(dv);const e=du*du/(L[2]*L[2])+dv*dv/(L[3]*L[3]);if(e<9)ring+=L[4]*Math.exp(-e);}
    for(let k=0;k<kn.length;k++){const K=kn[k];let du=u-K[0];du-=Math.round(du);let dw=v-K[1];dw-=Math.round(dw);const ex=du*2.4/(K[2]*2.2),ey=dw*1.2/K[2];const q=ex*ex+ey*ey;if(q<16){ring+=3*Math.exp(-q*.5);kk=Math.max(kk,1-ss(.4,1.2,q));}}
    const g=ring-Math.floor(ring);const late=ss(.7,.9,g)*(1-ss(.96,1,g));const f=fib(u,v),b=blot(u,v),s=st(u,v),gr=grit(u,v),tn=tone(u,v);
    let R=166+18*(tn-.5),G=151+15*(tn-.5),B=132+12*(tn-.5);const lk=1-.19*late;R*=lk;G*=lk;B*=lk;const fm=.95+.07*f+.04*(gr-.5);R*=fm;G*=fm;B*=fm;
    const pg=.3*ss(.4,.8,b);R+=(148-R)*pg;G+=(146-G)*pg;B+=(142-B)*pg;const dk=1-.12*ss(.55,.85,s);R*=dk;G*=dk;B*=dk;
    if(kk>0){R+=(96-R)*kk*.8;G+=(74-G)*kk*.8;B+=(56-B)*kk*.8;}
    out[0]=R;out[1]=G;out[2]=B;out[3]=255*(.42+.3*late+.12*(f-.5)-.2*kk);out[4]=255*(.93-.08*late-.03*f);out[5]=0;});
  return{map:mkTex(o.c,{aniso:8}),data:mkTex(o.d,{srgb:false,aniso:8})};}
/* split roof boards (u along grain/down-slope 1m, v across 1m), lichen & moss */
function genRoof(W){const r=RNG(31);const wA=fbm(21,2,8,3),fib=fbm(22,4,128,2),bl=fbm(23,4,4,4),moss=fbm(24,5,5,4),lich=fbm(25,10,10,2),st=fbm(26,2,30,3),gr=fbm(27,64,64,1);
  const o=imgLoop(W,W,(u,v,out)=>{const ring=v*120+4*wA(u,v);const g=ring-Math.floor(ring);const late=ss(.6,.86,g)*(1-ss(.93,1,g));
    const f=fib(u,v),b=bl(u,v),s=st(u,v),n=gr(u,v);let R=142-30*late,G=138-30*late,B=130-28*late;const fm=.92+.14*f+.05*(n-.5);R*=fm;G*=fm;B*=fm;
    const wet=.4*ss(.5,.85,b);R+=(100-R)*wet;G+=(97-G)*wet;B+=(92-B)*wet;const dk=1-.18*ss(.6,.9,s);R*=dk;G*=dk;B*=dk;
    const m=ss(.68,.8,moss(u,v));const l=ss(.72,.8,lich(u,v))*(1-m);
    if(m>0){const mm=.85+.3*n;R+=(78*mm-R)*m*.6;G+=(86*mm-G)*m*.6;B+=(54*mm-B)*m*.6;}
    if(l>0){R+=(140-R)*l*.35;G+=(142-G)*l*.35;B+=(128-B)*l*.35;}
    out[0]=R;out[1]=G;out[2]=B;out[3]=255*(.35+.28*late+.17*f+.3*m*n+.15*l);out[4]=255*(.98-.06*late);out[5]=0;});
  const {cx,dx}=o;for(let i=0;i<40;i++){const x=r()*W,y=r()*W,L=r.r(.05,.35)*W,w=r.r(.5,1.2);cx.strokeStyle=`rgba(50,46,42,${r.r(.25,.5)})`;cx.lineWidth=w;
    cx.beginPath();cx.moveTo(x,y);cx.bezierCurveTo(x+L*.3,y+r.r(-2,2),x+L*.7,y+r.r(-3,3),x+L,y+r.r(-2,2));cx.stroke();
    dx.strokeStyle="rgb(0,250,0)";dx.lineWidth=w+.5;dx.beginPath();dx.moveTo(x,y);dx.bezierCurveTo(x+L*.3,y,x+L*.7,y,x+L,y);dx.stroke();}
  for(let i=0;i<70;i++){const x=r()*W,y=r()*W,rad=r.r(1.2,4.5);const gg=cx.createRadialGradient(x,y,0,x,y,rad);gg.addColorStop(0,"rgba(150,152,138,.18)");gg.addColorStop(.75,"rgba(160,160,146,.24)");gg.addColorStop(1,"rgba(170,170,155,0)");cx.fillStyle=gg;cx.beginPath();cx.arc(x,y,rad,0,TAU);cx.fill();}
  return{map:mkTex(o.c,{aniso:8}),data:mkTex(o.d,{srgb:false,aniso:8})};}
function genBamboo(W){const H=W>>2;const st=fbm(41,2,64,2),sp=fbm(42,24,8,2),bl=fbm(43,3,2,3);
  const o=imgLoop(W,H,(u,v,out)=>{const s=st(u,v),p=sp(u,v),b=bl(u,v);let k=.9+.12*s+.05*(b-.5);if(p>.74)k*=.85;
    out[0]=230*k;out[1]=222*k;out[2]=196*k;out[3]=255*(.5+.3*s);out[4]=255*(.5+.12*s+.2*(p>.72?1:0));out[5]=0;});
  return{map:mkTex(o.c),data:mkTex(o.d,{srgb:false})};}
function genStone(W){const r=RNG(51);const a=fbm(51,6,6,4),b=fbm(52,32,32,2);
  const o=imgLoop(W,W,(u,v,out)=>{const A=a(u,v),B=b(u,v);let k=.74+.32*(A-.5)+.16*(B-.5);out[3]=255*(.3+.5*A+.2*B);
    out[0]=212*k;out[1]=208*k;out[2]=200*k;out[4]=255*(.86+.12*B);out[5]=0;});
  for(let i=0;i<W*W/40;i++){const x=r()*W,y=r()*W,d=r()<.55;o.cx.fillStyle=d?`rgba(40,38,36,${r.r(.2,.6)})`:`rgba(250,248,240,${r.r(.2,.5)})`;o.cx.fillRect(x,y,r.r(.6,1.8),r.r(.6,1.8));}
  return{map:mkTex(o.c),data:mkTex(o.d,{srgb:false})};}
function genTatami(){const W=256,r=RNG(61);const rv=[];for(let i=0;i<64;i++)rv.push(r.r(.94,1.05));const nz=fbm(62,8,64,2);
  const o=imgLoop(W,W,(u,v,out,x,y)=>{const k=(x>>2),fx=(x&3)/3;const prof=.9+.13*Math.sin(fx*PI);const ww=(y%16);const warp=ww<1.4?.94:1;
    const bump=((k+(y>>4))&1)?1.03:.97;let b=prof*rv[k]*warp*bump*(.95+.1*nz(u,v));
    out[0]=200*b;out[1]=184*b;out[2]=126*b;out[3]=255*(.25+.6*Math.sin(fx*PI))*warp;out[4]=255*.78;out[5]=0;});
  return{map:mkTex(o.c,{aniso:8}),data:mkTex(o.d,{srgb:false,aniso:8})};}
function genHeri(){const c=cv(64,32),x=c.getContext("2d");x.fillStyle="#1e1c1b";x.fillRect(0,0,64,32);
  for(let i=0;i<64;i+=2){x.fillStyle=`rgba(80,70,60,${.15+.1*Math.sin(i)})`;x.fillRect(i,0,1,32);}
  for(let j=0;j<32;j+=3){x.fillStyle="rgba(0,0,0,.25)";x.fillRect(0,j,64,1);}x.fillStyle="rgba(140,120,90,.25)";x.fillRect(0,1,64,1);x.fillRect(0,30,64,1);return mkTex(c);}
function genWashi(W){const r=RNG(81);const a=fbm(81,6,6,4);const o=imgLoop(W,W,(u,v,out)=>{const k=.965+.05*(a(u,v)-.5);out[0]=240*k;out[1]=235*k;out[2]=220*k;out[3]=128;out[4]=235;out[5]=0;});
  const x=o.cx;for(let i=0;i<W*1.2;i++){const sx=r()*W,sy=r()*W,L=r.r(8,40),an=r()*TAU;x.strokeStyle=r()<.7?`rgba(255,253,245,${r.r(.2,.45)})`:`rgba(190,180,160,${r.r(.08,.2)})`;
    x.lineWidth=r.r(.4,1.1);x.beginPath();x.moveTo(sx,sy);x.quadraticCurveTo(sx+Math.cos(an)*L*.5+r.r(-6,6),sy+Math.sin(an)*L*.5+r.r(-6,6),sx+Math.cos(an)*L,sy+Math.sin(an)*L);x.stroke();}
  return o;}
function genEarth(W){const r=RNG(91);const a=fbm(91,5,5,4),b=fbm(92,24,24,2),sp=fbm(93,8,8,3);
  const o=imgLoop(W,W,(u,v,out)=>{const A=a(u,v),B=b(u,v);let k=.94+.12*(A-.5)+.05*(B-.5);const s=sp(u,v);
    out[0]=170*k-6*s;out[1]=140*k-5*s;out[2]=100*k-4*s;out[3]=255*(.5+.2*B);out[4]=250;out[5]=0;});
  const x=o.cx,d=o.dx;for(let i=0;i<W*2.2;i++){const sx=r()*W,sy=r()*W,L=r.r(3,14)*W/512,an=r()*TAU;const g=r.r(.7,1.15);
    x.strokeStyle=`rgba(${205*g|0},${170*g|0},${96*g|0},${r.r(.45,.85)})`;x.lineWidth=r.r(.6,1.4)*W/512;x.beginPath();x.moveTo(sx,sy);x.lineTo(sx+Math.cos(an)*L,sy+Math.sin(an)*L);x.stroke();
    d.strokeStyle="rgb(210,250,0)";d.lineWidth=x.lineWidth;d.beginPath();d.moveTo(sx,sy);d.lineTo(sx+Math.cos(an)*L,sy+Math.sin(an)*L);d.stroke();}
  for(let i=0;i<W/4;i++){const sx=r()*W,sy=r()*W,rad=r.r(.5,1.4)*W/512;x.fillStyle=`rgba(${r.i(60,120)},${r.i(50,100)},${r.i(40,80)},.7)`;x.beginPath();x.arc(sx,sy,rad,0,TAU);x.fill();}
  for(let i=0;i<10;i++){let sx=r()*W,sy=r()*W;x.strokeStyle="rgba(70,52,34,.45)";d.strokeStyle="rgb(20,255,0)";x.lineWidth=d.lineWidth=.8*W/512;x.beginPath();d.beginPath();x.moveTo(sx,sy);d.moveTo(sx,sy);
    for(let k=0;k<12;k++){sx+=r.r(-6,6)*W/512;sy+=r.r(2,9)*W/512;x.lineTo(sx,sy);d.lineTo(sx,sy);}x.stroke();d.stroke();}
  return{map:mkTex(o.c),data:mkTex(o.d,{srgb:false})};}
/* 網代: diagonal checker of split cypress strips; tile = 0.5 m */
function genAjiro(W){const r=RNG(101);const n=fbm(101,8,8,3),fib=fbm(102,32,32,2);const cell=W/8/Math.SQRT2;const sv=[];for(let i=0;i<256;i++)sv.push(r.r(.82,1.12));
  const o=imgLoop(W,W,(u,v,out,x,y)=>{const a=(x+y)/Math.SQRT2,b=(x-y+W)/Math.SQRT2;const ia=Math.floor(a/cell),ib=Math.floor(b/cell);const dir=(ia+ib)&1;
    const along=dir?a:b,across=dir?b:a;const sw=cell/3;const si=Math.floor(across/sw);const f=(across/sw)-si;
    const prof=.72+.36*Math.sin(f*PI);const edge=f<.08||f>.92?.6:1;const k=prof*edge*sv[(si*7+ia*13+ib*3)&255]*(.94+.12*fib(u,v));
    const gl=.94+.06*Math.sin(along*.9+si*3.1);out[0]=182*k*gl;out[1]=146*k*gl;out[2]=100*k*gl;out[3]=255*(.3+.55*Math.sin(f*PI))*edge;out[4]=235;out[5]=0;});
  return{map:mkTex(o.c),data:mkTex(o.d,{srgb:false})};}
function genRamp(){const c=cv(256,2),x=c.getContext("2d");for(let i=0;i<256;i++){x.fillStyle=`rgb(${i},${i},${i})`;x.fillRect(i,0,1,2);}const t=mkTex(c,{srgb:false,wrap:false});t.minFilter=T.LinearFilter;t.generateMipmaps=false;return t;}
function genGlow(){const c=cv(64,64),x=c.getContext("2d");const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,"rgba(255,255,255,1)");g.addColorStop(.25,"rgba(255,255,255,.55)");g.addColorStop(.6,"rgba(255,255,255,.12)");g.addColorStop(1,"rgba(255,255,255,0)");x.fillStyle=g;x.fillRect(0,0,64,64);return mkTex(c,{wrap:false});}
function genLeaf(){const S=128,c=cv(S,S),x=c.getContext("2d");x.translate(S/2,S*.62);
  const lobe=(ang,len,wid)=>{x.save();x.rotate(ang);x.beginPath();x.moveTo(0,0);x.quadraticCurveTo(wid,-len*.45,0,-len);x.quadraticCurveTo(-wid,-len*.45,0,0);x.fill();x.restore();};
  x.fillStyle="#fff";const L=[[0,52,15],[.62,46,13],[-.62,46,13],[1.22,36,11],[-1.22,36,11],[1.8,22,8],[-1.8,22,8]];for(const l of L)lobe(l[0],l[1],l[2]);
  x.beginPath();x.arc(0,-6,12,0,TAU);x.fill();x.strokeStyle="rgba(120,110,100,.55)";x.lineWidth=1.2;for(const l of L){x.save();x.rotate(l[0]);x.beginPath();x.moveTo(0,0);x.lineTo(0,-l[1]*.85);x.stroke();x.restore();}
  x.strokeStyle="rgba(120,100,80,.9)";x.lineWidth=2.2;x.beginPath();x.moveTo(0,0);x.quadraticCurveTo(2,14,-3,26);x.stroke();
  const t=mkTex(c,{wrap:false});return t;}
function genPetal(){const c=cv(32,32),x=c.getContext("2d");x.fillStyle="#fff";x.beginPath();x.moveTo(16,30);x.bezierCurveTo(2,22,4,6,12,3);x.lineTo(16,7);x.lineTo(20,3);x.bezierCurveTo(28,6,30,22,16,30);x.fill();
  const g=x.createRadialGradient(16,28,0,16,28,16);g.addColorStop(0,"rgba(255,170,190,.6)");g.addColorStop(1,"rgba(255,255,255,0)");x.globalCompositeOperation="source-atop";x.fillStyle=g;x.fillRect(0,0,32,32);return mkTex(c,{wrap:false});}
function genAOdecal(){const S=256,c=cv(S,S),x=c.getContext("2d");/* maps x:-2.7..3.0 , z:-2.4..3.0 */
  const X=v=>(v+2.7)/5.7*S,Z=v=>(v+2.4)/5.4*S;
  const blob=(x0,z0,x1,z1,a,steps,grow)=>{for(let i=steps;i>=1;i--){const g=grow*i/steps;x.fillStyle=`rgba(0,0,0,${a/steps})`;
    const L=X(x0-g),R=X(x1+g),Tp=Z(z0-g),B=Z(z1+g),rad=Math.max(2,(X(g)-X(0))*1.1);x.beginPath();
    x.moveTo(L+rad,Tp);x.lineTo(R-rad,Tp);x.quadraticCurveTo(R,Tp,R,Tp+rad);x.lineTo(R,B-rad);x.quadraticCurveTo(R,B,R-rad,B);x.lineTo(L+rad,B);x.quadraticCurveTo(L,B,L,B-rad);x.lineTo(L,Tp+rad);x.quadraticCurveTo(L,Tp,L+rad,Tp);x.fill();}};
  blob(-1.5,-1.35,1.5,1.35,.62,14,.55);blob(-1.66,1.35,2.26,2.26,.32,10,.35);blob(1.5,-1.42,2.26,2.26,.28,10,.32);
  return mkTex(c,{wrap:false});}
function genClay(){const W=128;const a=fbm(121,6,6,3),b=fbm(122,32,32,1);const o=imgLoop(W,W,(u,v,out)=>{const k=.94+.12*(a(u,v)-.5)+.05*(b(u,v)-.5);out[0]=206*k;out[1]=164*k;out[2]=124*k;out[3]=255*b(u,v);out[4]=240;out[5]=0;});return{map:mkTex(o.c),data:mkTex(o.d,{srgb:false})};}
/* shoji panel paper (0.62 x 1.745) with the faint shadow of its own kumiko seen through the paper */
function genShoji(){const W=256,H=720;const base=genWashi(256).c;const c=cv(W,H),x=c.getContext("2d");
  for(let y=0;y<H;y+=256)x.drawImage(base,0,y);x.fillStyle="rgba(110,92,70,.22)";
  for(let i=1;i<4;i++){const px=i*W/4;x.fillRect(px-3,0,6,H);}for(let j=1;j<10;j++){const py=j*H/10;x.fillRect(0,py-2.5,W,5);}
  x.fillStyle="rgba(120,100,76,.12)";x.fillRect(0,0,W,6);x.fillRect(0,H-6,W,6);return mkTex(c,{wrap:false});}
/* simplified Amida raigō hanging scroll (mounting + painting) */
function genAmida(){const W=256,H=640,c=cv(W,H),x=c.getContext("2d"),r=RNG(131);
  x.fillStyle="#3b4a3e";x.fillRect(0,0,W,H);for(let i=0;i<500;i++){x.fillStyle=`rgba(200,170,90,${r.r(.15,.4)})`;x.fillRect(r()*W,r()*H,1.5,1.5);}
  x.fillStyle="#8a6d3a";x.fillRect(18,70,W-36,H-150);x.fillStyle="#2b2219";x.fillRect(26,82,W-52,H-174);
  for(let i=0;i<2500;i++){x.fillStyle=`rgba(${r.i(50,90)},${r.i(40,70)},${r.i(25,45)},.25)`;x.fillRect(26+r()*(W-52),82+r()*(H-174),2,2);}
  const cx=W/2;const g=x.createRadialGradient(cx,215,10,cx,215,92);g.addColorStop(0,"rgba(255,220,140,.35)");g.addColorStop(.7,"rgba(220,170,80,.18)");g.addColorStop(1,"rgba(0,0,0,0)");x.fillStyle=g;x.fillRect(0,100,W,260);
  x.strokeStyle="#d8b060";x.lineWidth=3;x.beginPath();x.arc(cx,180,46,0,TAU);x.stroke();x.lineWidth=1.5;x.beginPath();x.arc(cx,180,52,0,TAU);x.stroke();
  for(let k=0;k<36;k++){const a=k/36*TAU;x.beginPath();x.moveTo(cx+Math.cos(a)*56,300+Math.sin(a)*0);}
  x.fillStyle="#c9a050";x.beginPath();x.ellipse(cx,180,22,26,0,0,TAU);x.fill();x.fillStyle="#2a1e14";x.beginPath();x.ellipse(cx,160,20,12,0,PI,TAU);x.fill();
  x.fillStyle="#b07a3a";x.beginPath();x.moveTo(cx-30,212);x.quadraticCurveTo(cx-56,330,cx-44,420);x.lineTo(cx+44,420);x.quadraticCurveTo(cx+56,330,cx+30,212);x.quadraticCurveTo(cx,200,cx-30,212);x.fill();
  x.strokeStyle="#e6c070";x.lineWidth=1.6;for(let k=0;k<6;k++){x.beginPath();x.moveTo(cx-26+k*4,222+k*6);x.quadraticCurveTo(cx-10,300+k*12,cx-34+k*10,410);x.stroke();}
  x.fillStyle="#d9b470";x.beginPath();x.ellipse(cx-8,282,7,9,0,0,TAU);x.fill();x.beginPath();x.ellipse(cx+14,300,7,8,0,0,TAU);x.fill();
  x.fillStyle="#c7766a";for(let k=-3;k<=3;k++){x.beginPath();x.ellipse(cx+k*15,432,10,8,0,0,TAU);x.fill();}x.fillStyle="#8a5a3a";x.fillRect(cx-46,440,92,8);
  x.fillStyle="rgba(235,230,215,.7)";for(let k=0;k<7;k++){x.beginPath();x.ellipse(cx+r.r(-70,70),r.r(455,495),r.r(18,34),r.r(6,10),0,0,TAU);x.fill();}
  x.fillStyle="#2a2620";x.fillRect(0,0,W,10);x.fillStyle="rgba(220,200,150,.6)";x.fillRect(W*.3,0,3,70);x.fillRect(W*.7-3,0,3,70);return mkTex(c,{wrap:false});}
/* covers of bound books: 4 columns (indigo, tan, ochre, page-edges) */
function genBooks(){const W=640,H=256,c=cv(W,H),x=c.getContext("2d"),r=RNG(141);const cols=["#2c3a5c","#7a5634","#a7843f"];
  for(let k=0;k<3;k++){const X0=k*128;x.fillStyle=cols[k];x.fillRect(X0,0,128,H);for(let i=0;i<900;i++){x.fillStyle=`rgba(255,255,255,${r.r(0,.06)})`;x.fillRect(X0+r()*128,r()*H,1,1);}
    for(let i=0;i<40;i++){x.strokeStyle="rgba(0,0,0,.08)";x.beginPath();x.arc(X0+r()*128,r()*H,r.r(3,9),0,TAU);x.stroke();}
    x.fillStyle="#ece4cf";x.fillRect(X0+10,14,26,120);x.strokeStyle="rgba(60,40,20,.5)";x.strokeRect(X0+10.5,14.5,25,119);
    x.strokeStyle="#1a1410";x.lineWidth=2.2;x.lineCap="round";let yy=24;for(let s=0;s<4;s++){x.beginPath();x.moveTo(X0+23+r.r(-4,4),yy);x.quadraticCurveTo(X0+23+r.r(-7,7),yy+10,X0+23+r.r(-4,4),yy+r.r(14,22));x.stroke();yy+=r.r(20,27);}
    x.fillStyle="rgba(240,235,220,.9)";for(let s=0;s<4;s++){x.fillRect(X0+116,30+s*58,12,3);}x.fillRect(X0+117,0,2,H);}
  x.fillStyle="#e8dfc8";x.fillRect(384,0,128,H);for(let y=0;y<H;y+=2){x.fillStyle=`rgba(120,105,80,${r.r(.1,.35)})`;x.fillRect(384,y,128,1);}
  /* scroll: cover brocade (top half) + rolled-paper spiral end (bottom half) */
  x.fillStyle="#22284a";x.fillRect(512,0,128,128);x.fillStyle="rgba(200,160,70,.75)";
  for(let yy=6;yy<128;yy+=14)for(let xx=516+((yy/14)%2)*7;xx<640;xx+=14){x.beginPath();x.arc(xx,yy,2.2,0,TAU);x.fill();}
  x.fillStyle="#b89a5a";x.fillRect(512,0,128,5);x.fillRect(512,123,128,5);
  x.fillStyle="#d8ccae";x.fillRect(512,128,128,128);const cx0=576,cy0=192;
  for(let a=0;a<TAU*9;a+=.04){const rr=4+a*1.0;x.fillStyle="rgba(120,100,70,.55)";x.fillRect(cx0+Math.cos(a)*rr,cy0+Math.sin(a)*rr,1.2,1.2);}
  x.fillStyle="#2a2018";x.beginPath();x.arc(cx0,cy0,5,0,TAU);x.fill();
  return mkTex(c,{wrap:false});}
/* enza: spiral coil (top 512x512) + side coils (512x128 below) */
function genEnza(){const W=512,H=640,r=RNG(151);const n=fbm(151,16,16,2);
  const o=imgLoop(W,H,(u,v,out,x,y)=>{let k;if(y<512){const dx=x-256,dy=y-256;const rho=Math.hypot(dx,dy),phi=Math.atan2(dy,dx)+PI;const p=19;const w=rho/p-phi/TAU;const cidx=Math.floor(w),c=w-cidx;
      const s=(cidx+phi/TAU)*TAU*rho;const tw=(s/5.5+c*2.2)%1;const prof=.62+.45*Math.sin(c*PI);const stitch=(Math.floor(phi/TAU*18+.5)%1===0&&Math.abs(((phi/TAU*18)%1)-.5)>.46)?.7:1;
      k=prof*(.86+.18*(tw<.5?1:0))*stitch*(.92+.16*n(u,v*.8));if(rho>254)k*=.6;}
    else{const yy=y-512;const c=(yy%21)/21;const tw=((x/6+c*2)%1);k=(.6+.45*Math.sin(c*PI))*(.85+.2*(tw<.5?1:0))*(.92+.16*n(u,v));}
    out[0]=196*k;out[1]=168*k;out[2]=108*k;out[3]=255*clamp(k*.9,0,1);out[4]=240;out[5]=0;});
  return{map:mkTex(o.c,{wrap:false,aniso:8}),data:mkTex(o.d,{srgb:false,wrap:false})};}

/* ---------------------------------------------------------------- materials */
function stdMat(res,o){return res.mat(new T.MeshStandardMaterial(o));}
function woodMats(res,q){const W=res.sh("wood"+q.ts,()=>genWood(q.ts)),ramp=res.sh("ramp",genRamp);
  return{W,ramp,
    wood:stdMat(res,{map:W.map,bumpMap:W.data,bumpScale:.0016,roughnessMap:W.data,roughness:1,metalness:0,vertexColors:true,aoMap:ramp,aoMapIntensity:1}),
    floor:stdMat(res,{map:W.map,bumpMap:W.data,bumpScale:.0006,roughnessMap:W.data,roughness:.62,metalness:0,vertexColors:true,aoMap:ramp,aoMapIntensity:1})};}

/* ============================================================================ 草庵 */
const FL=.50,X0=-1.5,X1=1.5,Z0=-1.35,Z1=1.35,PS=.12,KY=2.62,VZ=2.26,VX=2.26,P=.36,EF=2.50,EB=-1.95,GW=-2.10,GE=2.55,RAFH=.065,RAFW=.055,NOJI=.016;
const SQ=Math.sqrt(1+P*P),SN=P/SQ,CSN=1/SQ;
const yb=z=>KY+P*(Z1-Math.abs(z));            // rafter underside line
const VT=t=>t*SQ;                              // vertical thickness of a slab of perpendicular thickness t
const yBase=z=>yb(z)+VT(RAFH+NOJI);            // top of sheathing (roof-board base)
const YB0=yBase(0),SF=EF*SQ,SB=-EB*SQ;
function sp(side,x,s,h){return[x,YB0-s*SN+h*CSN,side*(s*CSN+h*SN)];}   // roof slope frame: s from ridge down, h ⟂ above base
const slopeN=side=>[0,CSN,side*SN],slopeD=side=>[0,-SN,side*CSN];
const RAFX=[-2.025,-1.575,-1.125,-.675,-.225,.225,.675,1.125,1.575,2.025,2.475];

function hutAO(p,n){const x=p[0],y=p[1],z=p[2];
  if(y<FL-.012){if(x>-1.75&&x<2.32&&z>-1.5&&z<2.32){const d=Math.min(x+1.75,2.32-x,z+1.5,2.32-z);return .3+.55*(1-ss(0,.7,d))+.15*ss(.25,0,y);}return 1;}
  if(x>-1.47&&x<1.47&&z>-1.33&&z<1.34&&y<3.35){const open=ss(-1.3,1.45,z);let a=.36+.42*open*open;
    const dw=Math.min(x+1.47,1.47-x,z+1.33);a*=.74+.26*ss(0,.4,dw);a*=.8+.2*ss(0,.3,y-FL);if(y>2.3)a*=.8+.2*open;
    if(n[1]<-.5)a*=1.1;return a;}
  if(x>GW-.05&&x<GE+.05&&z>EB-.05&&z<EF+.05&&y<yb(z)+.02){const de=Math.min(x-GW,GE-x,z-EB,EF-z);const h=Math.max(.05,yb(z)-y);
    let a=.5+.5*clamp(h/(h+de*1.4),0,1);if(y>KY-.25)a=Math.min(a,.62+.3*ss(0,.6,EF-z<.6?.6-(EF-z):0));if(n[1]>.5)a*=.88;return a;}
  return 1;}

function buildHut(q,res,seed,opts){
  const rng=RNG(seed||1330);const M=woodMats(res,q);
  const RF=res.sh("roof"+Math.min(q.ts,512),()=>genRoof(Math.min(q.ts,512))),ST=res.sh("stone"+(q.lo?128:256),()=>genStone(q.lo?128:256)),
    BA=res.sh("bamboo"+(q.lo?256:512),()=>genBamboo(q.lo?256:512)),TA=res.sh("tatami",genTatami),HE=res.sh("heri",genHeri),
    EA=res.sh("earth"+(q.lo?256:512),()=>genEarth(q.lo?256:512)),AJ=res.sh("ajiro"+(q.lo?256:512),()=>genAjiro(q.lo?256:512)),
    SJ=res.sh("shoji",genShoji),AM=res.sh("amida",genAmida),BK=res.sh("books",genBooks),GL=res.sh("glow",genGlow),LF=res.sh("leaf",genLeaf),PT=res.sh("petal",genPetal),
    AD=res.sh("aodecal",genAOdecal);
  const ramp=M.ramp;
  const mat={wood:M.wood,floor:M.floor,
    roof:stdMat(res,{map:RF.map,bumpMap:RF.data,bumpScale:.003,roughnessMap:RF.data,roughness:1,vertexColors:true,aoMap:ramp}),
    stone:stdMat(res,{map:ST.map,bumpMap:ST.data,bumpScale:.0025,roughnessMap:ST.data,roughness:1,vertexColors:true,aoMap:ramp}),
    bamboo:stdMat(res,{map:BA.map,bumpMap:BA.data,bumpScale:.0006,roughnessMap:BA.data,roughness:1,vertexColors:true,aoMap:ramp}),
    tatami:stdMat(res,{map:TA.map,bumpMap:TA.data,bumpScale:.0008,roughness:.82,vertexColors:true,aoMap:ramp}),
    heri:stdMat(res,{map:HE,roughness:.7,vertexColors:true,aoMap:ramp}),
    earth:stdMat(res,{map:EA.map,bumpMap:EA.data,bumpScale:.0022,roughness:1,vertexColors:true,aoMap:ramp}),
    ajiro:stdMat(res,{map:AJ.map,bumpMap:AJ.data,bumpScale:.0015,roughness:.9,vertexColors:true,aoMap:ramp}),
    paper:stdMat(res,{map:SJ,roughness:.92,vertexColors:true,aoMap:ramp,emissive:C(0xffa75a),emissiveMap:SJ,emissiveIntensity:0,side:T.DoubleSide}),
    iron:stdMat(res,{color:C(0x2b2724),roughness:.62,metalness:.35,vertexColors:true}),
    lacq:res.mat(new T.MeshPhysicalMaterial({color:0xffffff,roughness:.32,clearcoat:.8,clearcoatRoughness:.22,vertexColors:true,aoMap:ramp})),
    amida:stdMat(res,{map:AM,roughness:.88,aoMap:ramp,vertexColors:true}),
    books:stdMat(res,{map:BK,roughness:.85,aoMap:ramp,vertexColors:true}),
    straw:stdMat(res,{map:BA.map,roughness:.95,vertexColors:true,aoMap:ramp,bumpMap:BA.data,bumpScale:.001}),
    snow:stdMat(res,{color:C(0xf3f6fa),roughness:.82,metalness:0,vertexColors:true}),
    ice:stdMat(res,{color:C(0xdfeaf2),roughness:.12,metalness:0,transparent:true,opacity:.78}),
    water:stdMat(res,{color:C(0x1d2a2c),roughness:.06,metalness:.1,transparent:true,opacity:.9}),
    leaf:stdMat(res,{map:LF,alphaTest:.5,side:T.DoubleSide,roughness:.75}),
    petal:stdMat(res,{map:PT,alphaTest:.4,side:T.DoubleSide,roughness:.6,color:C(0xffeef2)}),
    plant:stdMat(res,{color:0xffffff,roughness:.55,vertexColors:true,side:T.DoubleSide})};
  /* builders */
  const B={};["wood","floor","roof","stone","bamboo","tatami","heri","earth","ajiro","paper","iron","lacq","amida","books","straw","plant"].forEach(k=>{B[k]=new GB();B[k].ao=hutAO;});
  const K={B,rng,q,kakehi:!(opts&&opts.kakehi===false)};
  frameAndFloor(K);walls(K);roof(K);B.wood.cf=null;veranda(K);interior(K);exteriorProps(K);
  const root=new T.Group();root.name="TsureAn";
  const meshes={};const add=(k,m,cast=true,recv=true,parent)=>{const g=B[k].build();if(!g)return null;res.geo(g);const me=new T.Mesh(g,m);me.castShadow=cast;me.receiveShadow=recv;me.name="an_"+k;(parent||root).add(me);meshes[k]=me;return me;};
  add("wood",mat.wood);add("floor",mat.floor);add("roof",mat.roof);add("stone",mat.stone);add("bamboo",mat.bamboo);add("tatami",mat.tatami);add("heri",mat.heri);
  add("earth",mat.earth);add("ajiro",mat.ajiro);add("paper",mat.paper);add("iron",mat.iron);add("lacq",mat.lacq);add("amida",mat.amida);add("books",mat.books);add("straw",mat.straw);add("plant",mat.plant);
  /* shutters (蔀) */
  const sh=shutters(K,res,mat,root);
  /* seasons */
  const seas=seasonal(K,res,mat,root,{LF,PT});
  /* water (kakehi stream + bucket water) */
  const wat=waterFx(K,res,mat,root,GL);
  /* ground contact shadow */
  const gs=new T.Mesh(res.geo(new T.PlaneGeometry(5.7,5.4)),res.mat(new T.MeshBasicMaterial({map:AD,color:0x000000,transparent:true,depthWrite:false,opacity:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2})));
  gs.rotation.x=-PI/2;gs.position.set(.15,.004,.3);gs.renderOrder=-1;gs.name="an_groundShadow";root.add(gs);
  return{root,mat,meshes,sh,seas,wat,gs,K,GL};}

/* ---------- 床組・柱・足固め・床板 */
function woodSide(p,n){const x=p[0],y=p[1],z=p[2];if(!(x>-1.53&&x<1.53&&z>-1.43&&z<1.43&&y>FL-.03&&y<3.35))return[.97,.98,1.02];
  const d=-n[0]*x-n[2]*z+n[1]*(1.5-y);return d>0?[.8,.68,.58]:[.97,.98,1.02];}
function frameAndFloor(K){const{B,rng}=K,w=B.wood,f=B.floor,s=B.stone;w.cf=woodSide;
  const ext=()=>tint(rng,[.62,.6,.6],.06);
  const posts=[[X0,Z1],[X1,Z1],[X0,Z0],[X1,Z0],[0,Z0],[X0,0],[X1,0]];
  for(const[x,z]of posts){w.cf=(p,n)=>{const k=.66+.34*ss(.06,.6,p[1]),sd=woodSide(p,n);return[k*sd[0],k*.97*sd[1],k*.93*sd[2]];};
    w.prism(rect(x,z,PS/2,PS/2,.016),"y",.055,KY-.15,{seg:5,uo:rng(),vo:rng(),col:ext()});w.cf=null;
    w.cf=woodSide;s.stone(x+rng.r(-.02,.02),0,z+rng.r(-.02,.02),.2,.105,.19,rng,{flat:.55,col:tint(rng,[.5,.49,.47],.08),det:2});}
  /* sills / 地覆 & 足固め */
  w.box(0,.43,Z0,X1-X0+PS,.14,.10,"x",{uo:rng(),vo:rng(),col:ext(),ch:.008});
  w.box(X0,.43,0,.10,.14,Z1-Z0,"z",{uo:rng(),vo:rng(),col:ext(),ch:.008});
  w.box(X1,.43,0,.10,.14,Z1-Z0,"z",{uo:rng(),vo:rng(),col:ext(),ch:.008});
  w.box(0,.418,Z1,X1-X0+PS,.115,.12,"x",{uo:rng(),vo:rng(),col:ext(),ch:.008});
  w.box(0,.49,Z1+.02,X1-X0-PS,.03,.16,"x",{uo:rng(),vo:rng(),col:tint(rng,[.6,.5,.4],.04)});                     // 敷居
  for(const z of[-.45,.45]){w.box(0,.425,z,X1-X0,.10,.09,"x",{uo:rng(),vo:rng(),col:ext()});
    for(const x of[-.75,.75]){w.box(x,.2,z,.08,.36,.08,"y",{uo:rng(),vo:rng(),col:ext(),ch:.01});s.stone(x,.0,z,.11,.05,.1,rng,{flat:.4,col:tint(rng,[.46,.45,.43],.08),det:1});}}
  /* floor boards (板敷) along X */
  let z=Z0-.05;const zEnd=Z1-.06;
  while(z<zEnd-.01){let wd=rng.r(.22,.31);if(z+wd>zEnd-.12)wd=zEnd-z;const c=tint(rng,[.66,.46,.31],.07);
    f.box(0,FL-.0125+rng.r(-.0012,.0012),z+wd/2,X1-X0+.1,.025,wd-.003,"x",{seg:6,uo:rng(),vo:rng(),col:c});z+=wd;}
}

/* ---------- 壁: 背面横板 / 西 土壁+連子窓 / 東 網代+舞良戸+明障子 / 正面 小壁 / 妻 / 長押 */
function hBoardsX(K,x0,x1,zc,y0,y1,out){const{B,rng}=K;let y=y0;const t=.018;
  while(y<y1-.01){let h=rng.r(.22,.29);if(y+h>y1-.08)h=y1-y;const yt=Math.min(y1,y+h+.012),zb=zc+out*.008;const c=tint(rng,[.64,.6,.58],.08);
    B.wood.prism([[zb-t/2,y],[zb+t/2,y],[zc+t/2,yt],[zc-t/2,yt]],"x",x0,x1,{seg:3,uo:rng(),vo:rng(),col:c});y+=h;}}
function hBoardsZ(K,z0,z1,xc,y0,y1,out){const{B,rng}=K;let y=y0;const t=.018;
  while(y<y1-.01){let h=rng.r(.2,.25);if(y+h>y1-.07)h=y1-y;const yt=Math.min(y1,y+h+.012),xb=xc+out*.008;const c=tint(rng,[.64,.6,.58],.08);
    B.wood.prism([[xb-t/2,y],[xb+t/2,y],[xc+t/2,yt],[xc-t/2,yt]],"z",z0,z1,{seg:2,uo:rng(),vo:rng(),col:c});y+=h;}}
function walls(K){const{B,rng}=K,w=B.wood;const ext=()=>tint(rng,[.62,.6,.6],.06),inn=()=>tint(rng,[.56,.45,.36],.05);
  /* back wall: horizontal boards between posts, battens outside */
  for(const[a,b]of[[X0+PS/2,-PS/2],[PS/2,X1-PS/2]]){hBoardsX(K,a,b,Z0-.024,FL,KY-.15,-1);
    for(let x=a+.42;x<b-.2;x+=.46)w.box(x,(FL+KY-.15)/2,Z0-.053,.036,KY-.15-FL,.018,"y",{uo:rng(),vo:rng(),col:ext()});}
  /* 内法 (head beams) + 長押 inside all round, outside on front/east */
  w.box(0,2.29,Z1,X1-X0,.08,.10,"x",{uo:rng(),vo:rng(),col:inn()});
  w.box(X0,2.29,0,.10,.08,Z1-Z0,"z",{uo:rng(),vo:rng(),col:inn()});
  w.box(X1,2.29,0,.10,.08,Z1-Z0,"z",{uo:rng(),vo:rng(),col:inn()});
  const nage=(poly,ax,a0,a1)=>w.prism(poly,ax,a0,a1,{uo:rng(),vo:rng(),col:inn(),seg:2});
  nage([[Z1+.06,2.245],[Z1+.092,2.255],[Z1+.092,2.335],[Z1+.06,2.335]],"x",X0-.075,X1+.075);   // front outer
  nage([[Z1-.06,2.245],[Z1-.092,2.255],[Z1-.092,2.335],[Z1-.06,2.335]],"x",X0+.06,X1-.06);    // front inner
  nage([[Z0+.06,2.245],[Z0+.092,2.255],[Z0+.092,2.335],[Z0+.06,2.335]],"x",X0+.06,X1-.06);    // back inner
  nage([[X0+.06,2.245],[X0+.092,2.255],[X0+.092,2.335],[X0+.06,2.335]],"z",Z0+.06,Z1-.06);    // west inner
  nage([[X1-.06,2.245],[X1-.092,2.255],[X1-.092,2.335],[X1-.06,2.335]],"z",Z0+.06,Z1-.06);    // east inner
  nage([[X1+.06,2.245],[X1+.092,2.255],[X1+.092,2.335],[X1+.06,2.335]],"z",Z0-.075,Z1+.075);   // east outer
  /* front 小壁 (網代) & east 小壁 */
  B.ajiro.box(0,2.40,Z1,X1-X0-PS,.14,.02,"z",{us:2,vs:2,uo:rng(),vo:rng(),col:[.95,.92,.88]});
  B.ajiro.box(X1,2.40,0,.02,.14,Z1-Z0-PS,"z",{us:2,vs:2,uo:rng(),vo:rng(),col:[.95,.92,.88]});
  /* east wall north bay: 網代 panel in a frame with a waist rail */
  B.ajiro.box(X1,1.38,(Z0+PS/2-PS/2)/2,.018,1.74,-Z0-PS,"z",{us:2,vs:2,uo:rng(),vo:rng(),col:[.93,.9,.86]});
  w.box(X1+.012,1.12,(Z0)/2,.03,.05,-Z0-PS,"z",{uo:rng(),vo:rng(),col:ext()});w.box(X1-.012,1.12,(Z0)/2,.03,.05,-Z0-PS,"z",{uo:rng(),vo:rng(),col:inn()});
  /* west wall: 腰板 + 土壁 with a 連子窓 in the south bay */
  const E=B.earth,eo=()=>({us:1,vs:1,uo:rng(),vo:rng(),col:tint(rng,[.95,.93,.9],.03)});
  for(const[a,b]of[[Z0+PS/2,-PS/2],[PS/2,Z1-PS/2]]){hBoardsZ(K,a,b,X0-.01,FL,1.16,-1);w.box(X0,1.17,(a+b)/2,.075,.03,b-a,"z",{uo:rng(),vo:rng(),col:ext()});}
  E.box(X0,(1.185+2.245)/2,(Z0+PS/2-PS/2)/2,.06,2.245-1.185,-Z0-PS,"z",eo());
  const wz0=.36,wz1=.98,wy0=1.36,wy1=1.84;
  E.box(X0,(1.185+wy0)/2,(PS/2+Z1-PS/2)/2,.06,wy0-1.185,Z1-PS,"z",eo());E.box(X0,(wy1+2.245)/2,(PS/2+Z1-PS/2)/2,.06,2.245-wy1,Z1-PS,"z",eo());
  E.box(X0,(wy0+wy1)/2,(PS/2+wz0)/2,.06,wy1-wy0,wz0-PS/2,"z",eo());E.box(X0,(wy0+wy1)/2,(wz1+Z1-PS/2)/2,.06,wy1-wy0,Z1-PS/2-wz1,"z",eo());
  E.box(X0,2.40,0,.06,.14,Z1-Z0-PS,"z",eo());
  /* window: frame, bamboo bars (連子) outside, shoji inside */
  w.box(X0-.035,wy0-.02,(wz0+wz1)/2,.03,.04,wz1-wz0+.08,"z",{uo:rng(),vo:rng(),col:ext()});w.box(X0-.035,wy1+.02,(wz0+wz1)/2,.03,.04,wz1-wz0+.08,"z",{uo:rng(),vo:rng(),col:ext()});
  w.box(X0-.035,(wy0+wy1)/2,wz0-.02,.03,wy1-wy0,.04,"y",{uo:rng(),vo:rng(),col:ext()});w.box(X0-.035,(wy0+wy1)/2,wz1+.02,.03,wy1-wy0,.04,"y",{uo:rng(),vo:rng(),col:ext()});
  for(let i=1;i<=6;i++){const zz=wz0+(wz1-wz0)*i/7;B.bamboo.cyl([X0-.04,wy0-.01,zz],[X0-.04,wy1+.01,zz],.011,.011,8,{col:tint(rng,[.5,.38,.2],.06),us:1,vs:4,uo:rng(),vo:rng()});}
  const sj=B.paper;sj.face([[X0+.04,wy0,wz0],[X0+.04,wy0,wz1],[X0+.04,wy1,wz1],[X0+.04,wy1,wz0]],[[0,.3],[1,.3],[1,.58],[0,.58]],[.98,.97,.95],[1,0,0]);
  sj.face([[X0+.04,wy0,wz0],[X0+.04,wy0,wz1],[X0+.04,wy1,wz1],[X0+.04,wy1,wz0]],[[0,.3],[1,.3],[1,.58],[0,.58]],[.98,.97,.95],[-1,0,0]);
  for(let i=0;i<=4;i++){const zz=wz0+(wz1-wz0)*i/4;w.box(X0+.05,(wy0+wy1)/2,zz,.012,wy1-wy0,i%4?.012:.025,"y",{uo:rng(),vo:rng(),col:inn()});}
  for(let j=0;j<=3;j++){const yy=wy0+(wy1-wy0)*j/3;w.box(X0+.05,yy,(wz0+wz1)/2,.012,j%3?.012:.025,wz1-wz0,"z",{uo:rng(),vo:rng(),col:inn()});}
  /* east south bay: 敷居/鴨居 tracks, two 舞良戸 stacked north, one 明障子 closed south */
  w.box(X1,.488,(PS/2+Z1-PS/2)/2,.16,.03,Z1-PS,"z",{uo:rng(),vo:rng(),col:inn()});
  const maira=(xc,z0,z1)=>{const y0=.505,y1=2.245,t=.028,c=ext();w.box(xc,(y0+y1)/2,z0+.025,t,y1-y0,.05,"y",{uo:rng(),vo:rng(),col:c});w.box(xc,(y0+y1)/2,z1-.025,t,y1-y0,.05,"y",{uo:rng(),vo:rng(),col:c});
    w.box(xc,y0+.03,(z0+z1)/2,t,.06,z1-z0-.1,"z",{uo:rng(),vo:rng(),col:c});w.box(xc,y1-.03,(z0+z1)/2,t,.06,z1-z0-.1,"z",{uo:rng(),vo:rng(),col:c});
    w.box(xc,(y0+y1)/2,(z0+z1)/2,.012,y1-y0-.1,z1-z0-.1,"y",{uo:rng(),vo:rng(),col:tint(rng,[.6,.55,.5],.05)});
    for(let y=y0+.1;y<y1-.08;y+=.056)w.box(xc+.012,y,(z0+z1)/2,.012,.014,z1-z0-.1,"z",{uo:rng(),vo:rng(),col:c});};
  maira(X1+.06,.06,.685);maira(X1+.03,.10,.725);
  /* 明障子 (paper outside face toward veranda, kumiko inside) */
  const sz0=.665,sz1=1.29,sy0=.505,sy1=2.245,sx=X1-.035;const fc=inn();
  w.box(sx,(sy0+sy1)/2,sz0+.016,.03,sy1-sy0,.032,"y",{uo:rng(),vo:rng(),col:fc});w.box(sx,(sy0+sy1)/2,sz1-.016,.03,sy1-sy0,.032,"y",{uo:rng(),vo:rng(),col:fc});
  w.box(sx,sy0+.03,(sz0+sz1)/2,.03,.06,sz1-sz0-.064,"z",{uo:rng(),vo:rng(),col:fc});w.box(sx,sy1-.02,(sz0+sz1)/2,.03,.04,sz1-sz0-.064,"z",{uo:rng(),vo:rng(),col:fc});
  for(let i=1;i<4;i++){const zz=sz0+.032+(sz1-sz0-.064)*i/4;w.box(sx-.004,(sy0+sy1)/2,zz,.016,sy1-sy0-.1,.012,"y",{uo:rng(),vo:rng(),col:fc});}
  for(let j=1;j<10;j++){const yy=sy0+.06+(sy1-sy0-.1)*j/10;w.box(sx-.004,yy,(sz0+sz1)/2,.016,.012,sz1-sz0-.064,"z",{uo:rng(),vo:rng(),col:fc});}
  sj.face([[sx+.012,sy0+.06,sz0+.032],[sx+.012,sy0+.06,sz1-.032],[sx+.012,sy1-.04,sz1-.032],[sx+.012,sy1-.04,sz0+.032]],[[0,0],[1,0],[1,1],[0,1]],[1,1,1],[1,0,0]);
  sj.face([[sx+.011,sy0+.06,sz0+.032],[sx+.011,sy0+.06,sz1-.032],[sx+.011,sy1-.04,sz1-.032],[sx+.011,sy1-.04,sz0+.032]],[[0,0],[1,0],[1,1],[0,1]],[.92,.9,.86],[-1,0,0]);
  /* gable boards (妻) with battens */
  for(const xs of[X0,X1]){const out=xs<0?-1:1,xc=xs+out*.01;let z=-1.42;const top=zz=>yb(zz)+VT(RAFH)-.004;
    while(z<1.42){const wd=Math.min(rng.r(.18,.24),1.42-z),za=z,zb=z+wd;const poly=[[za,KY],[zb,KY]];
      if(za<0&&zb>0)poly.push([zb,top(zb)],[0,top(0)],[za,top(za)]);else poly.push([zb,top(zb)],[za,top(za)]);
      w.prism(poly,"x",xc-.009,xc+.009,{uo:rng(),vo:rng(),col:tint(rng,[.6,.58,.57],.07),us:VS,vs:US});z=zb;}
    for(let zz=-1.2;zz<1.3;zz+=.4){const t1=top(zz)-.01;w.box(xc+out*.017,(KY+t1)/2,zz,.016,t1-KY,.035,"y",{uo:rng(),vo:rng(),col:ext()});}}
}

/* ---------- 小屋組・垂木・野地・板葺・押縁・置石・棟・破風 */
function roof(K){const{B,rng,q}=K,w=B.wood,R=B.roof,S=B.stone;const ext=()=>tint(rng,[.58,.55,.53],.06),sof=()=>tint(rng,[.44,.37,.32],.06);
  const XL=GW+.035,XR=GE-.035;
  /* 桁, 梁, 束, 棟木, 母屋 */
  for(const z of[Z0,Z1])w.box((XL+XR)/2,KY-.075,z,XR-XL,.15,.13,"x",{seg:4,uo:rng(),vo:rng(),col:ext(),ch:.01});
  for(const x of[X0,X1])w.box(x,KY-.08,0,.12,.16,Z1-Z0+.14,"z",{seg:3,uo:rng(),vo:rng(),col:sof(),ch:.01});
  w.box(0,2.58,0,.13,.16,Z1-Z0+.14,"z",{seg:3,uo:rng(),vo:rng(),col:sof(),ch:.012});
  const rbot=yb(0)-.13;
  for(const x of[X0,0,X1]){const yt=x===0?2.66:KY;w.box(x,(yt+rbot)/2,0,.10,rbot-yt,.10,"y",{uo:rng(),vo:rng(),col:sof(),ch:.01});
    for(const z of[-.68,.68]){const pb=yb(.68)-.11;w.box(x,(yt+pb)/2,z,.09,pb-yt,.09,"y",{uo:rng(),vo:rng(),col:sof(),ch:.01});}}
  w.box((XL+XR)/2,yb(0)-.065,0,XR-XL,.13,.12,"x",{seg:4,uo:rng(),vo:rng(),col:sof(),ch:.01});
  for(const z of[-.68,.68])w.prism([[z-.05,yb(.68)-.11],[z+.05,yb(.68)-.11],[z+.05,yb(Math.abs(z)+(z>0?.05:-.05))],[z-.05,yb(Math.abs(z)-(z>0?.05:-.05))]].map((p,i)=>i<2?p:[p[0],yb(p[0])]),"x",XL,XR,{seg:4,uo:rng(),vo:rng(),col:sof()});
  /* rafters */
  for(const x of RAFX){const c=sof();
    w.prism([[0,yb(0)],[EF,yb(EF)],[EF,yb(EF)+VT(RAFH)],[0,yb(0)+VT(RAFH)]],"x",x-RAFW/2,x+RAFW/2,{seg:2,uo:rng(),vo:rng(),col:c,us:VS,vs:US,ek:.95});
    w.prism([[EB,yb(EB)],[0,yb(0)],[0,yb(0)+VT(RAFH)],[EB,yb(EB)+VT(RAFH)]],"x",x-RAFW/2,x+RAFW/2,{seg:2,uo:rng(),vo:rng(),col:c,us:VS,vs:US,ek:.95});}
  /* sheathing boards (野地板) */
  const noji=(za,zb)=>w.prism([[za,yb(za)+VT(RAFH)],[zb,yb(zb)+VT(RAFH)],[zb,yb(zb)+VT(RAFH+NOJI)],[za,yb(za)+VT(RAFH+NOJI)]],"x",XL,XR,{seg:4,uo:rng(),vo:rng(),col:sof()});
  for(let z=0;z<EF+.01;z+=.235)noji(z,Math.min(EF+.012,z+.235));for(let z=0;z>EB-.01;z-=.235)noji(Math.max(EB-.012,z-.235),z);
  /* barge boards (破風) */
  const top=z=>yBase(z)+.006;
  for(const[x0,x1]of[[GW,GW+.035],[GE-.035,GE]]){const c=ext();
    w.prism([[0,top(0)],[EF+.035,top(EF+.035)],[EF+.035,top(EF+.035)-VT(.19)],[0,top(0)-VT(.19)]],"x",x0,x1,{seg:3,uo:rng(),vo:rng(),col:c,us:VS,vs:US});
    w.prism([[EB-.035,top(EB-.035)],[0,top(0)],[0,top(0)-VT(.19)],[EB-.035,top(EB-.035)-VT(.19)]],"x",x0,x1,{seg:3,uo:rng(),vo:rng(),col:c,us:VS,vs:US});}
  /* board shingles in overlapping courses */
  const e=.27,L=.62,t0=.012,hb0=.004,hb1=hb0+t0*L/e;const USR=1,VSR=1;
  const stonesOn=[];
  for(const side of[1,-1]){const Smax=(side>0?SF:SB)+.04;const n=slopeN(side),dd=slopeD(side);let k=0;
    for(let sBot=Smax;sBot>.06;sBot-=e,k++){const sTop=Math.max(-.012,sBot-L);let x=GW-.03-(k%2?rng.r(.05,.14):0);
      while(x<GE+.02){const wd=rng.r(.15,.30),x0=x,x1=Math.min(x+wd,GE+.03),xm=(x0+x1)/2;const t=t0*rng.r(.85,1.2),cup=rng.r(-.004,.0035);
        const sL=sBot+rng.r(-.012,.012),sR=sBot+rng.r(-.012,.012),sM=(sL+sR)/2+rng.r(-.004,.004);
        const lum=rng.r(.66,.9);let c=[lum,lum,lum];const roll=rng();if(roll<.12)c=mul3(c,.72);else if(roll<.18)c=[lum*1.1,lum*1.02,lum*.9];else if(roll<.32)c=[lum*.9,lum*1.0,lum*.8];
        const cl=mul3(c,.86);const uo=rng(),vo=rng();
        const B0=sp(side,x0,sTop,hb0),B1=sp(side,x1,sTop,hb0),B2=sp(side,x1,sR,hb1),B3=sp(side,x0,sL,hb1);
        const T0=sp(side,x0,sTop,hb0+t),Tm0=sp(side,xm,sTop,hb0+t+cup),T1=sp(side,x1,sTop,hb0+t),T3=sp(side,x0,sL,hb1+t),Tm3=sp(side,xm,sM,hb1+t+cup),T2=sp(side,x1,sR,hb1+t);
        const u=s=>(s-sTop)*USR+uo,v=xx=>(xx-x0)*VSR+vo;
        R.face([T3,Tm3,Tm0,T0],[[u(sL),v(x0)],[u(sM),v(xm)],[u(sTop),v(xm)],[u(sTop),v(x0)]],[cl,cl,c,c],n);
        R.face([Tm3,T2,T1,Tm0],[[u(sM),v(xm)],[u(sR),v(x1)],[u(sTop),v(x1)],[u(sTop),v(xm)]],[cl,cl,c,c],n);
        R.face([B3,B2,T2,Tm3,T3],[[uo,vo],[uo,vo+.02],[uo+.01,vo+.02],[uo+.01,vo+.01],[uo+.01,vo]],mul3(c,.62),dd);
        R.face([B0,B3,T3,T0],[[uo,vo],[uo+.3,vo],[uo+.3,vo+.01],[uo,vo+.01]],mul3(c,.7),[-1,0,0]);
        R.face([B2,B1,T1,T2],[[uo,vo],[uo+.3,vo],[uo+.3,vo+.01],[uo,vo+.01]],mul3(c,.7),[1,0,0]);
        R.face([B0,B1,B2,B3],[[uo,vo],[uo,vo+.2],[uo+.5,vo+.2],[uo+.5,vo]],mul3(c,.55),[-n[0],-n[1],-n[2]]);
        x=x1+rng.r(0,.006);}}
    /* 押縁 battens + 置石 stones */
    const bs=side>0?[.6,1.28,1.96,Smax-.16]:[.6,1.3,Smax-.16];const hB=hb1+t0+.004;
    for(const s0 of bs){const r=rng.r(.021,.026),c=tint(rng,[.42,.38,.33],.08);const pa=sp(side,GW-.05-rng.r(0,.05),s0,hB+r),pb=sp(side,GE+.05+rng.r(0,.06),s0,hB+r);
      const nr=q.lo?6:8;const rings=[];for(let i=0;i<=8;i++)rings.push(i/8);const wa=rng()*TAU,wb=rng()*TAU;
      w.cyl(pa,pb,r,r*.9,nr,{rings,wob:t=>[.006*Math.sin(t*7+wa),.004*Math.sin(t*5+wb)],col:c,cap0:true,cap1:true,us:US,vs:VS,uo:rng(),vo:rng()});
      for(let x=GW+.2+rng.r(0,.25);x<GE-.12;x+=rng.r(.42,.86)){const big=rng()<.25,rx=big?rng.r(.11,.14):rng.r(.06,.11),ry=rx*rng.r(.55,.75),rz=rx*rng.r(.75,1.0);const ds=rng.r(-.035,.02);
        const c0=sp(side,x,s0-.02+ds,hB+ry*.62);const a=side*Math.atan(P);const ca=Math.cos(a),sa=Math.sin(a);
        S.stone(c0[0],c0[1],c0[2],rx,ry,rz,rng,{det:q.lo?1:2,m:[1,0,0,0,ca,-sa,0,sa,ca],col:tint(rng,[.36,.35,.33],.14),moss:.35,mossCol:[.3,.33,.2],flatB:.45,rough:.55});
        stonesOn.push({side,x,s:s0-.02+ds,h:hB+ry*1.25,rx});}}}
  K.roofStones=stonesOn;K.battens=null;
  /* ridge: cap boards, half-log, stones */
  for(const side of[1,-1]){let x=GW-.04;while(x<GE+.04){const x1=Math.min(x+rng.r(.7,1.2),GE+.045);const n=slopeN(side);const h0=hb1+t0+.002,t=.02;
      const c=tint(rng,[.9,.88,.85],.08),pa=sp(side,0,-.012,h0),pb=sp(side,0,.27,h0),pc=sp(side,0,.27,h0+t),pd=sp(side,0,-.012,h0+t);
      R.prism([[pa[2],pa[1]],[pb[2],pb[1]],[pc[2],pc[1]],[pd[2],pd[1]]],"x",x,x1,{uo:rng(),vo:rng(),col:c,us:VS,vs:US,seg:2});x=x1;}}
  const ry0=YB0+hb1+t0+.022+.05;
  w.cyl([GW-.07,ry0,0],[GE+.07,ry0,0],.058,.054,q.lo?7:10,{rings:[0,.2,.4,.6,.8,1],wob:t=>[.005*Math.sin(t*9),.004*Math.sin(t*6)],col:[.42,.37,.32],cap0:true,cap1:true,uo:rng(),vo:rng()});
  for(const side of[1,-1])for(let x=GW+.3+rng.r(0,.2);x<GE-.2;x+=rng.r(.75,1.0)){const rx=rng.r(.08,.11),ry=rng.r(.055,.07);const c0=sp(side,x,.17,hb1+t0+.025+ry*.55);
    const a=side*Math.atan(P);const ca=Math.cos(a),sa=Math.sin(a);S.stone(c0[0],c0[1],c0[2],rx,ry,rng.r(.07,.09),rng,{det:q.lo?1:2,m:[1,0,0,0,ca,-sa,0,sa,ca],col:tint(rng,[.36,.35,.33],.1),moss:.3,mossCol:[.3,.33,.2],flatB:.45,rough:.55});
    stonesOn.push({side,x,s:.17,h:hb1+t0+.025+ry*1.2,rx});}
  K.ridgeY=ry0;}

/* ---------- 竹簀子縁（正面＋東）と縁束、沓脱石 */
function veranda(K){const{B,rng,q}=K,w=B.wood,S=B.stone,bb=B.bamboo;const ext=()=>tint(rng,[.6,.58,.57],.07);
  const br=.021,bp=.0465,bseg=q.hi?8:q.md?7:6;
  const bambooPole=(p0,p1)=>{const L=vlen(sub(p1,p0));const nodes=[];let t=rng.r(.05,.3);while(t<L){nodes.push(t/L);t+=rng.r(.3,.42);}
    const rings=[0];for(const tn of nodes){if(q.lo){rings.push(tn);continue;}rings.push(tn-.012/L,tn,tn+.012/L);}rings.push(1);
    const c=rng()<.25?tint(rng,[.52,.43,.28],.05):tint(rng,[.46,.38,.25],.07);
    bb.cyl(p0,p1,br*rng.r(.95,1.05),br*rng.r(.92,1.02),bseg,{rings,rf:t=>{let m=1;for(const tn of nodes){const d=Math.abs(t-tn)*L;if(d<.012)m+=.09*(1-d/.012);}return m;},
      cf:t=>{let m=1;for(const tn of nodes){const d=Math.abs(t-tn)*L;if(d<.01)m*=.72+.28*d/.01;}return[m,m,m*.95];},col:c,cap0:true,cap1:true,hollow:true,us:1,vs:4,uo:rng(),vo:rng()});};
  /* front: frame */
  const xw=-1.66,xe=VX;
  w.box((xw+xe)/2,.41,1.45,xe-xw,.095,.08,"x",{seg:4,uo:rng(),vo:rng(),col:ext(),ch:.008});
  w.box((xw+xe)/2,.45,VZ-.045,xe-xw+.09,.10,.09,"x",{seg:4,uo:rng(),vo:rng(),col:tint(rng,[.66,.62,.58],.04),ch:.012});
  for(const x of[-1.62,-.8,0,.8,1.5,2.2])w.box(x,.41,(1.45+VZ)/2,.07,.09,VZ-1.45,"z",{uo:rng(),vo:rng(),col:ext()});
  {const z0=1.49,z1=VZ-.09,n=Math.floor((z1-z0)/bp),pp=(z1-z0)/n;for(let i=0;i<n;i++){const z=z0+i*pp+pp/2;bambooPole([xw+.04,FL-br,z],[xe-.09,FL-br,z]);}}
  /* east side */
  w.box(VX-.045,.45,(Z0-.08+VZ)/2,.09,.10,VZ-Z0+.08,"z",{seg:4,uo:rng(),vo:rng(),col:tint(rng,[.66,.62,.58],.04),ch:.012});
  for(const z of[Z0-.04,-.45,.45])w.box((X1+VX)/2,.41,z,VX-X1,.09,.07,"x",{uo:rng(),vo:rng(),col:ext()});
  {const x0=1.56,x1=VX-.09,n=Math.floor((x1-x0)/bp),pp=(x1-x0)/n;for(let i=0;i<n;i++){const x=x0+i*pp+pp/2;bambooPole([x,FL-br,Z0-.07],[x,FL-br,1.49]);}}
  /* 縁束 + 貫 + stones */
  const tsuka=[[-1.62,VZ-.045],[-.8,VZ-.045],[0,VZ-.045],[.8,VZ-.045],[1.5,VZ-.045],[VX-.045,VZ-.045],[VX-.045,1.4],[VX-.045,.45],[VX-.045,-.45],[VX-.045,Z0-.04]];
  for(const[x,z]of tsuka){w.box(x,.215,z,.085,.37,.085,"y",{uo:rng(),vo:rng(),col:ext(),ch:.012});S.stone(x,0,z,.12,.06,.11,rng,{flat:.5,col:tint(rng,[.48,.47,.45],.1),det:1});}
  w.box((-1.62+VX)/2,.2,VZ-.045,VX+1.62,.06,.02,"x",{seg:3,uo:rng(),vo:rng(),col:ext()});w.box(VX-.045,.2,(Z0+VZ)/2,.02,.06,VZ-Z0,"z",{seg:3,uo:rng(),vo:rng(),col:ext()});
  /* 沓脱石 & 飛石 */
  S.stone(.55,.10,2.62,.38,.20,.25,rng,{flat:.55,flatB:.5,col:[.42,.41,.39],det:q.lo?2:3,yaw:.08,rough:.7});
  S.stone(.82,-.01,3.28,.25,.07,.19,rng,{flat:.5,col:[.36,.35,.33],det:2,yaw:-.3,rough:.7});
  S.stone(1.05,-.02,3.85,.22,.06,.17,rng,{flat:.5,col:[.37,.36,.34],det:2,yaw:.4,rough:.7});
  /* straw sandals (草鞋) on the step */
  const sw=B.straw;for(const[dx,dz,an]of[[-.075,0,.08],[.075,.025,-.06]]){const cx=.55+dx,cz=2.6+dz,y=.222,m0=sw.n;
    sw.lathe([[0,0],[.038,0],[.042,.006],[.036,.011],[0,.012]],q.lo?8:14,0,0,0,{col:[.57,.47,.26],uv:(ph,j,r)=>[Math.cos(ph)*r*3,Math.sin(ph)*r*8]});
    const ca=Math.cos(an),sa=Math.sin(an);sw.xform(m0,(p,n)=>{const z=p[2]*2.7,nz=n[2]/2.7;const l=Math.hypot(n[0],n[1],nz)||1;
      return[[cx+p[0]*ca+z*sa,y+p[1],cz-p[0]*sa+z*ca],[(n[0]*ca+nz*sa)/l,n[1]/l,(-n[0]*sa+nz*ca)/l]];});
    sw.cyl([cx-.03*ca,y+.012,cz+.03*sa+.04],[cx+.03*ca,y+.012,cz-.03*sa+.04],.004,.004,5,{col:[.45,.37,.22]});}
}

/* ---------- 室内: 置畳、掛幅（阿弥陀）、経机、吊棚（冊子・巻子・皮籠） */
function interior(K){const{B,rng,q}=K,w=B.wood;
  /* tatami 0.95 x 1.90 along Z, top y=0.555 */
  const tx0=-.725,tx1=.225,tz0=-.60,tz1=1.30,ty=FL+.055,hw=.03;
  B.tatami.face([[tx0+hw,ty,tz1],[tx1-hw,ty,tz1],[tx1-hw,ty,tz0],[tx0+hw,ty,tz0]],[[0,0],[3.7,0],[3.7,7.9],[0,7.9]].map(u=>[u[1],u[0]]),[.74,.7,.6],[0,1,0]);
  B.tatami.face([[tx0+hw,FL,tz1],[tx1-hw,FL,tz1],[tx1-hw,ty,tz1],[tx0+hw,ty,tz1]],[[0,0],[3.7,0],[3.7,.2],[0,.2]],[.7,.66,.6],[0,0,1]);
  B.tatami.face([[tx0+hw,FL,tz0],[tx1-hw,FL,tz0],[tx1-hw,ty,tz0],[tx0+hw,ty,tz0]],[[0,0],[3.7,0],[3.7,.2],[0,.2]],[.7,.66,.6],[0,0,-1]);
  for(const xs of[tx0,tx1]){const xi=xs<0?xs+hw:xs-hw;B.heri.box((xs+xi)/2,(FL+ty)/2,(tz0+tz1)/2,hw,ty-FL,tz1-tz0,"z",{us:1/.25,vs:1/.06,col:[1,1,1],ek:.8});}
  /* 掛幅 Amida on back wall west bay */
  const sx=-.82,sw=.36,sy0=1.28,sy1=2.16,sz=Z0+.025;
  B.amida.face([[sx-sw/2,sy0,sz],[sx+sw/2,sy0,sz],[sx+sw/2,sy1,sz],[sx-sw/2,sy1,sz]],[[0,0],[1,0],[1,1],[0,1]],[1,1,1],[0,0,1]);
  B.lacq.cyl([sx-sw/2-.025,sy0-.005,sz+.012],[sx+sw/2+.025,sy0-.005,sz+.012],.011,.011,8,{col:[.05,.04,.035],cap0:true,cap1:true});
  w.box(sx,sy1+.005,sz+.008,sw+.01,.012,.012,"x",{uo:rng(),vo:rng(),col:[.3,.22,.16]});
  B.iron.cyl([sx-.1,sy1+.01,sz+.01],[sx,2.27,Z0+.075],.0015,.0015,4,{});B.iron.cyl([sx+.1,sy1+.01,sz+.01],[sx,2.27,Z0+.075],.0015,.0015,4,{});
  /* 経机 under it */
  kyoudaiInto(K,sx,FL,-1.05,0);
  /* 吊棚 (hanging bamboo shelf) in back-east bay with books, scrolls, leather boxes */
  const hx0=.24,hx1=1.30,hz0=Z0+.03,hz1=Z0+.31;const lv=[1.52,1.95];
  for(const y of lv){w.box((hx0+hx1)/2,y,(hz0+hz1)/2,hx1-hx0,.022,hz1-hz0,"x",{uo:rng(),vo:rng(),col:tint(rng,[.56,.46,.36],.05)});
    B.bamboo.cyl([hx0-.02,y-.02,hz1-.01],[hx1+.02,y-.02,hz1-.01],.012,.012,7,{col:[.48,.38,.2],cap0:true,cap1:true,us:1,vs:4});}
  for(const x of[hx0+.02,hx1-.02]){B.bamboo.cyl([x,lv[0]-.06,hz1-.01],[x,KY-.16,hz1-.01],.011,.011,7,{col:[.48,.38,.2],cap0:true,cap1:true,us:1,vs:4});}
  /* books stacks on lower shelf */
  const bookStack=(cx,cz,n,y0,rot)=>{let y=y0;for(let i=0;i<n;i++){const th=rng.r(.009,.016),bw=rng.r(.15,.17),bd=rng.r(.21,.235),a=rot+rng.r(-.06,.06),col=rng.i(0,2);
      bookInto(B.books,cx+rng.r(-.008,.008),y,cz+rng.r(-.008,.008),bw,th,bd,a,col);y+=th;}return y;};
  bookStack(.42,hz0+.15,5,lv[0]+.011,0);bookStack(.64,hz0+.15,3,lv[0]+.011,.04);
  for(let i=0;i<5;i++){const r=rng.r(.016,.022),x0=.80+rng.r(0,.04),y=lv[0]+.011+r+(i>2?r*1.7:0),z=hz0+.06+(i%3)*.05+(i>2?.025:0);
    scrollInto(B,[x0,y,z],[x0+rng.r(.30,.36),y,z+rng.r(-.02,.02)],r,rng);}
  /* 皮籠 (black lacquered leather boxes) on upper shelf */
  for(let i=0;i<3;i++){const cx=.42+i*.3,cz=hz0+.14,y=lv[1]+.011;const bw=.26,bd=.22,bh=.13;const c=[.035,.03,.028];
    B.lacq.box(cx,y+bh/2-.012,cz,bw,bh-.024,bd,"y",{col:c,us:1,vs:1});B.lacq.box(cx,y+bh-.012,cz,bw+.012,.026,bd+.012,"x",{col:[.05,.042,.036],us:1,vs:1,ch:.006});
    B.iron.box(cx,y+bh*.55,cz+bd/2+.003,.03,.03,.004,"x",{col:[.55,.42,.22]});}
}
function bookInto(gb,cx,y,cz,w,th,d,a,col){const ca=Math.cos(a),sa=Math.sin(a);const P=(x,yy,z)=>[cx+x*ca+z*sa,y+yy,cz-x*sa+z*ca];
  const u0=col*.2,u1=u0+.2;const hx=w/2,hz=d/2;const tc=[1,1,1];
  gb.face([P(-hx,th,-hz),P(hx,th,-hz),P(hx,th,hz),P(-hx,th,hz)],[[u1,0],[u0,0],[u0,1],[u1,1]],tc,[0,1,0]);
  gb.face([P(-hx,0,-hz),P(hx,0,-hz),P(hx,0,hz),P(-hx,0,hz)],[[u0,0],[u1,0],[u1,1],[u0,1]],[.8,.8,.8],[0,-1,0]);
  const pe=[[.61,0],[.79,0],[.79,1],[.61,1]];
  gb.face([P(-hx,0,hz),P(hx,0,hz),P(hx,th,hz),P(-hx,th,hz)],pe,[.95,.93,.9],[sa,0,ca]);gb.face([P(-hx,0,-hz),P(hx,0,-hz),P(hx,th,-hz),P(-hx,th,-hz)],pe,[.95,.93,.9],[-sa,0,-ca]);
  gb.face([P(-hx,0,-hz),P(-hx,0,hz),P(-hx,th,hz),P(-hx,th,-hz)],[[u0+.185,0],[u0+.185,1],[u0+.195,1],[u0+.195,0]],[.9,.9,.9],[-ca,0,sa]);
  gb.face([P(hx,0,-hz),P(hx,0,hz),P(hx,th,hz),P(hx,th,-hz)],pe,[.95,.93,.9],[ca,0,-sa]);}
function scrollInto(B,p0,p1,r,rng){const c=rng.pick([[1,1,1],[.85,.9,1],[1,.85,.8],[.9,1,.9]]);const L=vlen(sub(p1,p0));
  B.books.cyl(p0,p1,r,r,12,{col:c,rings:[0,.5,1],us:.17/L,vs:.44/(TAU*r),uo:.815,vo:.53,cap0:true,cap1:true,capCol:[1,1,1],capUV:[.9,.25,.085,.21]});
  const d=sub(p1,p0),dn=[d[0]/L,d[1]/L,d[2]/L];const e0=[p0[0]-dn[0]*.012,p0[1]-dn[1]*.012,p0[2]-dn[2]*.012],e1=[p1[0]+dn[0]*.012,p1[1]+dn[1]*.012,p1[2]+dn[2]*.012];
  B.lacq.cyl(e0,p0,r*.38,r*.38,8,{col:[.06,.045,.035],cap0:true});B.lacq.cyl(p1,e1,r*.38,r*.38,8,{col:[.06,.045,.035],cap1:true});
  const m=[(p0[0]+p1[0])/2,(p0[1]+p1[1])/2,(p0[2]+p1[2])/2];B.lacq.cyl([m[0]-dn[0]*.003,m[1]-dn[1]*.003,m[2]-dn[2]*.003],[m[0]+dn[0]*.003,m[1]+dn[1]*.003,m[2]+dn[2]*.003],r*1.07,r*1.07,10,{col:[.28,.08,.26]});}
/* 経机: top with 筆返し, two curved panel legs; sutra scroll, incense burner, vase with shikimi sprig */
function kyoudaiInto(K,cx,y0,cz,rot){const{B,rng}=K;const L=.5,D=.26,H=.27;const col=[.04,.032,.028];const lc=B.lacq;
  lc.box(cx,y0+H-.01,cz,L,.02,D,"x",{col,us:1,vs:1,ch:.004});
  for(const s of[-1,1]){lc.box(cx+s*(L/2-.012),y0+H+.008,cz,.024,.022,D,"z",{col,us:1,vs:1,ch:.004});
    const x=cx+s*(L/2-.06);const poly=[[-D/2+.02,0],[-D/2+.05,0],[-.05,.06],[.05,.06],[D/2-.05,0],[D/2-.02,0],[D/2-.035,H-.02],[-D/2+.035,H-.02]].map(p=>[cz+p[0],y0+p[1]]);
    lc.prism(poly,"x",x-.012,x+.012,{col,us:1,vs:1});}
  /* items */
  scrollInto(B,[cx+.06,y0+H+.016,cz-.02],[cx+.21,y0+H+.016,cz-.02],.016,rng);
  B.iron.lathe([[0,0],[.03,0],[.036,.012],[.04,.03],[.035,.045],[.038,.05],[.0,.05]],12,cx-.02,y0+H,cz+.03,{col:[1.2,.95,.6]});
  B.iron.lathe([[0,0],[.022,0],[.03,.04],[.02,.08],[.012,.11],[.016,.13],[0,.13]],10,cx-.17,y0+H,cz+.02,{col:[.9,.75,.5]});
  sprigInto(B.plant,[cx-.17,y0+H+.125,cz+.02],rng,8,[.12,.24,.1],.06,1);}
function sprigInto(gb,base,rng,n,col,len,spread){for(let i=0;i<n;i++){const a=rng()*TAU,el=rng.r(.3,1.2)*spread,l=len*rng.r(.7,1.2);
  const d=[Math.cos(a)*Math.sin(el),Math.cos(el),Math.sin(a)*Math.sin(el)];const tip=[base[0]+d[0]*l,base[1]+d[1]*l,base[2]+d[2]*l];
  const side=nrmz(cross(d,[0,1,0].map((v,k)=>k===1?1:v+.001)));const wv=l*.22;const mid=[(base[0]+tip[0])/2,(base[1]+tip[1])/2,(base[2]+tip[2])/2];
  const c=mul3(col,rng.r(.8,1.25));gb.face([base,[mid[0]+side[0]*wv,mid[1]+side[1]*wv,mid[2]+side[2]*wv],tip,[mid[0]-side[0]*wv,mid[1]-side[1]*wv,mid[2]-side[2]*wv]],[[0,0],[1,0],[1,1],[0,1]],c,[0,1,0]);}}

/* ---------- 外: 閼伽棚・懸樋・薪・笠 */
function akadanaInto(K,ox,oz,withKakehi){const{B,rng,q}=K,w=B.wood,bb=B.bamboo,S=B.stone;const top=.80,hx=.31,hz=.24;
  for(const[dx,dz]of[[-hx+.03,-hz+.03],[-hx+.03,hz-.03],[hx-.03,-hz+.03],[hx-.03,hz-.03]]){bb.cyl([ox+dx,0,oz+dz],[ox+dx,top-.02,oz+dz],.022,.02,q.lo?6:8,{col:tint(rng,[.42,.36,.24],.06),cap1:true,us:1,vs:4,uo:rng()});
    S.stone(ox+dx,0,oz+dz,.06,.03,.055,rng,{flat:.4,det:1,col:[.56,.55,.52]});}
  w.box(ox,top-.03,oz-hz+.03,hx*2,.035,.04,"x",{uo:rng(),vo:rng(),col:[.6,.57,.54]});w.box(ox,top-.03,oz+hz-.03,hx*2,.035,.04,"x",{uo:rng(),vo:rng(),col:[.6,.57,.54]});
  w.box(ox-hx+.03,top-.03,oz,.04,.035,hz*2-.08,"z",{uo:rng(),vo:rng(),col:[.6,.57,.54]});w.box(ox+hx-.03,top-.03,oz,.04,.035,hz*2-.08,"z",{uo:rng(),vo:rng(),col:[.6,.57,.54]});
  for(let x=-hx+.06;x<hx-.04;x+=.034)bb.cyl([ox+x,top-.006,oz-hz+.01],[ox+x,top-.006,oz+hz-.01],.012,.012,6,{col:tint(rng,[.46,.38,.25],.06),cap0:true,cap1:true,us:1,vs:4,uo:rng()});
  w.box(ox,.3,oz-hz+.03,hx*2-.02,.03,.02,"x",{uo:rng(),vo:rng(),col:[.58,.55,.52]});
  /* 閼伽桶 (staved bucket w/ handle) */
  const bx=ox+.04,bz=oz+.02,by=top;const nst=q.lo?10:16;
  w.lathe([[.075,0],[.08,.005],[.086,.15],[.08,.15],[.074,.015],[0,.015]],nst,bx,by,bz,{col:[.62,.52,.4],uv:(ph,j)=>[ph/TAU*1.5,j*.04]});
  bb.lathe([[.083,.03],[.084,.05],[.0835,.05],[.082,.03]].map(p=>p),nst,bx,by,bz,{col:[.3,.24,.12]});bb.lathe([[.0865,.11],[.087,.13],[.086,.13],[.085,.11]],nst,bx,by,bz,{col:[.3,.24,.12]});
  w.box(bx,by+.19,bz-.07,.03,.14,.025,"y",{col:[.6,.52,.4],uo:rng()});w.box(bx,by+.19,bz+.07,.03,.14,.025,"y",{col:[.6,.52,.4],uo:rng()});w.box(bx,by+.25,bz,.032,.025,.165,"z",{col:[.6,.52,.4],uo:rng()});
  /* bamboo vase with shikimi */
  const vx=ox-.2,vz=oz-.14;bb.cyl([vx,top,vz],[vx,top+.17,vz],.026,.025,q.lo?6:9,{col:[.4,.42,.18],cap1:true,hollow:true,rings:[0,.5,.52,1],us:1,vs:4});
  sprigInto(B.plant,[vx,top+.16,vz],rng,q.lo?6:11,[.07,.16,.06],.11,1.1);
  const basin=[bx,by+.135,bz];
  if(withKakehi){/* 懸樋: bamboo pipe on forked sticks from the hillside (west/back) to above the bucket */
    const pts=[[-2.62,1.40,-2.7],[-2.5,1.30,-.6],[-2.36,1.21,.9],[bx-.035,1.135,bz-.03]];const r=.03;
    for(let i=0;i<pts.length-1;i++)bb.cyl(pts[i],pts[i+1],r,r,q.lo?7:10,{col:tint(rng,[.38,.4,.17],.05),rings:[0,.5,.51,1],cap1:i===pts.length-2,hollow:true,us:1,vs:4,uo:rng()});
    for(const p of[pts[0],pts[1],pts[2]]){const y=p[1]-r;w.cyl([p[0]+.01,0,p[2]],[p[0],y-.02,p[2]],.02,.017,6,{col:[.4,.34,.28],cap1:true,uo:rng()});
      w.cyl([p[0],y-.04,p[2]],[p[0]-.06,y+.05,p[2]],.011,.009,5,{col:[.4,.34,.28],cap1:true});w.cyl([p[0],y-.04,p[2]],[p[0]+.06,y+.05,p[2]],.011,.009,5,{col:[.4,.34,.28],cap1:true});}
    K.kakehiEnd=pts[3];K.kakehiDir=nrmz(sub(pts[3],pts[2]));K.kakehiPts=pts;}
  return basin;}
function exteriorProps(K){const{B,rng,q}=K,w=B.wood;
  K.basin=akadanaInto(K,-2.0,1.86-.02,K.kakehi);
  /* firewood stack under west eave */
  const n=q.lo?16:30;w.box(-1.80,.05,-.45,.06,.06,1.5,"z",{col:[.36,.32,.27]});w.box(-1.68,.05,-.45,.06,.06,1.5,"z",{col:[.36,.32,.27]});
  let k=0;for(let row=0;row<5&&k<n;row++)for(let i=0;i<6&&k<n;i++,k++){const r=rng.r(.035,.05),y=.08+r+row*.085,x=-1.92+i*.065+(row%2)*.03,z0=-1.15+rng.r(-.04,.04),z1=.25+rng.r(-.04,.04);
    if(x>-1.6)continue;w.cyl([x,y,z0],[x,y,z1],r,r*.95,q.lo?6:8,{col:tint(rng,[.34,.27,.2],.12),cap0:true,cap1:true,capCol:[.85,.72,.52],rings:[0,.5,1],wob:t=>[.004*Math.sin(t*5+i),.003*Math.sin(t*4+row)],uo:rng(),vo:rng()});}
  /* 網代笠 hung on the east wall + staff leaning on the corner post */
  const hx=X1+.075,hy=1.72,hz=-.62,m0=B.straw.n;B.straw.lathe([[.24,0],[.2,.03],[.12,.075],[.04,.1],[0,.105]],q.lo?10:18,0,0,0,{col:[.62,.52,.32],uv:(ph,j,r)=>[Math.cos(ph)*r*2,Math.sin(ph)*r*2]});
  B.straw.xform(m0,(p,n)=>[[hx+p[1],hy-p[0],hz+p[2]],[n[1],-n[0],n[2]]]);
  w.cyl([X1+.07,1.94,hz],[X1+.13,1.94,hz],.008,.008,5,{col:[.5,.4,.3],cap1:true});
  w.cyl([1.80,FL,1.18],[1.565,1.86,1.30],.014,.012,6,{col:[.45,.35,.24],cap0:true,cap1:true});}

/* ---------- 蔀戸 */
function shutterLeaf(gb,rng,x0,x1,y0,y1,zc,col){const t=.035,fw=.05,w=x1-x0,h=y1-y0;const c=col;
  gb.box((x0+x1)/2,y0+fw/2,zc,w,fw,t,"x",{uo:rng(),vo:rng(),col:c,ch:.004});gb.box((x0+x1)/2,y1-fw/2,zc,w,fw,t,"x",{uo:rng(),vo:rng(),col:c,ch:.004});
  gb.box(x0+fw/2,(y0+y1)/2,zc,fw,h-2*fw,t,"y",{uo:rng(),vo:rng(),col:c,ch:.004});gb.box(x1-fw/2,(y0+y1)/2,zc,fw,h-2*fw,t,"y",{uo:rng(),vo:rng(),col:c,ch:.004});
  gb.box((x0+x1)/2,(y0+y1)/2,zc-.008,w-2*fw+.01,h-2*fw+.01,.012,"y",{uo:rng(),vo:rng(),col:tint(rng,[.62,.56,.5],.04)});
  const nx=Math.max(3,Math.round((w-2*fw)/.105)),ny=Math.max(3,Math.round((h-2*fw)/.105));
  for(let i=1;i<nx;i++){const x=x0+fw+(w-2*fw)*i/nx;gb.box(x,(y0+y1)/2,zc+.006,.017,h-2*fw,.021,"y",{uo:rng(),vo:rng(),col:c});}
  for(let j=1;j<ny;j++){const y=y0+fw+(h-2*fw)*j/ny;gb.box((x0+x1)/2,y,zc+.0075,w-2*fw,.017,.018,"x",{uo:rng(),vo:rng(),col:c});}}
function shutters(K,res,mat,root){const{rng}=K;const zc=Z1+.06+.019,hy=2.245,mid=1.37;
  const up=new GB(),lo=new GB();up.ao=(p,n)=>hutAO([p[0],p[1]+hy,p[2]+zc],n);lo.ao=hutAO;const c=tint(rng,[.6,.58,.57],.03);
  shutterLeaf(up,rng,X0+PS/2,0,mid-hy,0,0,c);shutterLeaf(up,rng,0,X1-PS/2,mid-hy,0,0,c);
  for(const x of[-1.05,-.35,.35,1.05])up.box(x,-.02,-.02,.05,.03,.012,"x",{col:[.25,.22,.2]});
  shutterLeaf(lo,rng,X0+PS/2,0,FL+.005,mid-.005,zc,c);shutterLeaf(lo,rng,0,X1-PS/2,FL+.005,mid-.005,zc,c);
  const pivot=new T.Group();pivot.position.set(0,hy,zc);root.add(pivot);
  const gU=res.geo(up.build()),gL=res.geo(lo.build());const mU=new T.Mesh(gU,mat.wood),mL=new T.Mesh(gL,mat.wood);
  [mU,mL].forEach(m=>{m.castShadow=m.receiveShadow=true;});mU.name="an_shitomiUpper";mL.name="an_shitomiLower";pivot.add(mU);root.add(mL);
  /* iron hooks hanging from rafters, engaged when fully open */
  const hk=new GB();const OPEN=1.36;const tipY=hy-(hy-mid)*Math.cos(OPEN),tipZ=zc+(hy-mid)*Math.sin(OPEN);
  for(const x of[-.675,.675]){hk.cyl([x,yb(tipZ)-.002,tipZ-.03],[x,tipY+.02,tipZ-.03],.004,.004,5,{col:[.3,.27,.25]});hk.cyl([x,tipY+.02,tipZ-.03],[x,tipY-.01,tipZ-.0],.004,.004,5,{col:[.3,.27,.25]});}
  const mH=new T.Mesh(res.geo(hk.build()),mat.iron);mH.castShadow=true;root.add(mH);
  let cur=-1;
  function set(v){v=clamp(+v||0,0,1);if(v===cur)return;cur=v;const up=ss(.12,1,v);pivot.rotation.x=-OPEN*up;
    const l=ss(0,.18,v);mL.visible=l<.999;mL.position.set(0,.03*l,.22*l);mH.visible=v>.985;}
  set(1);return{set,pivot,get:()=>cur};}

/* ---------- 季節（雪・氷柱・落葉・花びら・簾・閼伽棚の菊紅葉） */
function snowSlab(gb,side,x0,x1,s0,s1,hFn,nx,ns,rng){const Sv=[],idx=(i,j)=>j*(nx+1)+i;const base=gb.n;const n=slopeN(side);
  const top=[];for(let j=0;j<=ns;j++)for(let i=0;i<=nx;i++){const x=x0+(x1-x0)*i/nx,s=s0+(s1-s0)*j/ns;top.push(sp(side,x,s,hFn(x,s,i/nx,j/ns)));}
  const nor=top.map(()=>[0,0,0]);const tri=[];for(let j=0;j<ns;j++)for(let i=0;i<nx;i++){const a=idx(i,j),b=idx(i+1,j),c=idx(i+1,j+1),d=idx(i,j+1);tri.push([a,b,c],[a,c,d]);}
  for(const t of tri){let nn=cross(sub(top[t[1]],top[t[0]]),sub(top[t[2]],top[t[0]]));if(nn[0]*n[0]+nn[1]*n[1]+nn[2]*n[2]<0){nn=[-nn[0],-nn[1],-nn[2]];const tmp=t[1];t[1]=t[2];t[2]=tmp;}for(const k of t){nor[k][0]+=nn[0];nor[k][1]+=nn[1];nor[k][2]+=nn[2];}}
  for(let k=0;k<top.length;k++){const c=.93+.07*rng();gb.vtx(top[k],nrmz(nor[k]),0,0,[c,c,c*1.02]);}for(const t of tri)gb.I.push(base+t[0],base+t[1],base+t[2]);
  /* skirt at the eave (rounded front edge) */
  const sk=[];for(let i=0;i<=nx;i++){const x=x0+(x1-x0)*i/nx;const h=hFn(x,s1,i/nx,1);sk.push(sp(side,x,s1+.03,h*.55),sp(side,x,s1+.035,h*.05));}
  const b2=gb.n;const dd=slopeD(side);for(let i=0;i<=nx;i++){gb.vtx(sk[i*2],nrmz([dd[0]+n[0],dd[1]+n[1],dd[2]+n[2]]),0,0,[.95,.95,.97]);gb.vtx(sk[i*2+1],dd,0,0,[.9,.9,.93]);}
  for(let i=0;i<nx;i++){const t0=base+idx(i,ns),t1=base+idx(i+1,ns),a=b2+i*2,b=b2+i*2+1,c=b2+i*2+2,d=b2+i*2+3;
    const pa=top[idx(i,ns)],pb=top[idx(i+1,ns)],pc=sk[i*2];let nn=cross(sub(pb,pa),sub(pc,pa));const flip=nn[0]*dd[0]+nn[1]*dd[1]+nn[2]*dd[2]<0;
    if(!flip)gb.I.push(t0,t1,c,t0,c,a);else gb.I.push(t0,c,t1,t0,a,c);
    let mm=cross(sub(sk[i*2+2],sk[i*2]),sub(sk[i*2+1],sk[i*2]));const fl2=mm[0]*dd[0]+mm[1]*dd[1]+mm[2]*dd[2]<0;
    if(!fl2)gb.I.push(a,c,d,a,d,b);else gb.I.push(a,d,c,a,b,d);}}
function seasonal(K,res,mat,root,tx){const{rng,q}=K;const G={spring:new T.Group(),summer:new T.Group(),autumn:new T.Group(),winter:new T.Group()};
  for(const k in G){G[k].name="an_"+k;root.add(G[k]);}
  /* ---- winter: roof snow slabs */
  const sn=new GB();const stones=K.roofStones||[];const nb=n0=>{const a=lattice(n0,9,9);return(x,s)=>a((x+3)*1.7,s*3.1);};const N1=nb(5),N2=nb(9);
  for(const side of[1,-1]){const Smax=(side>0?SF:SB)+.04;const nx=q.hi?46:q.md?30:18,ns=q.hi?22:q.md?14:9;const NN=side>0?N1:N2;
    const bat=side>0?[.6,1.28,1.96,Smax-.16]:[.6,1.3,Smax-.16];
    snowSlab(sn,side,GW-.03,GE+.03,-.02,Smax+.005,(x,s,u,v)=>{let h=.072+.03*(NN(x,s)-.5);for(const b of bat)h+=.028*Math.exp(-((s-b)*(s-b))/.004);
      for(const st of stones)if(st.side===side){const dx=x-st.x,ds=s-st.s;const d2=dx*dx/(st.rx*st.rx*1.6)+ds*ds/.008;if(d2<6)h=Math.max(h,st.h+.03*Math.exp(-d2)-.02*Math.min(1,d2));}
      const eg=Math.min(x-(GW-.03),(GE+.03)-x);h*=.35+.65*ss(0,.12,eg);if(s<.15)h+=.02;return h;},nx,ns,rng);}
  /* ridge cap */
  sn.cyl([GW-.08,K.ridgeY+.035,0],[GE+.08,K.ridgeY+.035,0],.075,.075,10,{rings:[0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1],rf:t=>.85+.3*Math.abs(Math.sin(t*23)),col:[.96,.96,.98],cap0:true,cap1:true,us:0,vs:0});
  /* veranda outer edge strip, step stone cap, akadana, kakehi */
  const strip=(x0,x1,z0,z1,y,along)=>{const nx=24;for(let i=0;i<nx;i++){const a=i/nx,b=(i+1)/nx;const h1=.018+.014*Math.sin(a*37),h2=.018+.014*Math.sin(b*37);
      if(along==="x"){const xa=lerp(x0,x1,a),xb=lerp(x0,x1,b);sn.prism([[z0,y],[z1,y],[z1,y+h1*.4],[(z0+z1)/2,y+h1],[z0+.01,y+h1*.7]],"x",xa,xb+.002,{col:[.95,.95,.97],us:0,vs:0});}
      else{const za=lerp(z0,z1,a),zb=lerp(z0,z1,b);sn.prism([[x0,y],[x1,y],[x1,y+h1*.4],[(x0+x1)/2,y+h2],[x0+.01,y+h1*.7]],"z",za,zb+.002,{col:[.95,.95,.97],us:0,vs:0});}}};
  strip(-1.66,VX+.045,VZ-.17,VZ+.045,FL,"x");strip(VX-.12,VX+.045,-1.0,VZ-.17,FL,"z");
  sn.stone(.55,.215,2.62,.36,.045,.235,rng,{flat:.2,flatB:.0,det:2,col:[.95,.95,.97],rough:.5,yaw:.08});
  sn.stone(.82,.055,3.28,.23,.03,.17,rng,{flatB:.0,det:2,col:[.95,.95,.97],rough:.5});sn.stone(1.05,.04,3.85,.2,.03,.15,rng,{flatB:.0,det:2,col:[.95,.95,.97],rough:.5});
  sn.box(-2.0,.81,1.84,.62,.022,.48,"x",{col:[.95,.95,.97],us:0,vs:0,ch:.008});
  if(K.kakehiPts){const p=K.kakehiPts;for(let i=0;i<p.length-1;i++)sn.cyl([p[i][0],p[i][1]+.027,p[i][2]],[p[i+1][0],p[i+1][1]+.027,p[i+1][2]],.016,.016,6,{col:[.95,.95,.97],us:0,vs:0});}
  const gS=sn.build();const mS=new T.Mesh(res.geo(gS),mat.snow);mS.castShadow=true;mS.receiveShadow=true;G.winter.add(mS);
  /* icicles */
  const ic=new GB();for(let i=0;i<(q.lo?8:16);i++){const x=rng.r(GW+.2,GE-.2),l=rng.r(.05,.26)*(rng()<.3?.4:1),y=yb(EF)-.005;ic.cyl([x,y,EF-.012],[x,y-l,EF-.012],.012*rng.r(.7,1.2),.0008,6,{rings:[0,.3,.7,1],wob:t=>[.003*t,.002*t*t],col:[1,1,1],cap0:true});}
  const mI=new T.Mesh(res.geo(ic.build()),mat.ice);mI.castShadow=false;G.winter.add(mI);
  /* ---- autumn leaves (instanced) */
  const leafGeo=res.geo(new T.PlaneGeometry(.075,.075));leafGeo.rotateX(-PI/2);
  const nl=q.hi?140:q.md?90:45;const lm=new T.InstancedMesh(leafGeo,mat.leaf,nl);const dm=new T.Object3D(),col=new T.Color();
  const lcols=[0xb5311c,0xc8471c,0xd96a1e,0xd8a02a,0x9c2a1a,0x8a5a2a,0xc23a2a];
  for(let i=0;i<nl;i++){let p,nrm=[0,1,0];const r=rng();
    if(r<.55){const side=rng()<.6?1:-1;const s=rng.r(.3,(side>0?SF:SB)),x=rng.r(GW,GE);p=sp(side,x,s,.05+.01*rng());nrm=slopeN(side);
      for(const st of stones){if(st.side===side&&Math.abs(st.x-x)<st.rx&&Math.abs(st.s-s)<.08){p=sp(side,x,s,st.h+.005);}}}
    else if(r<.85){const fx=rng();if(fx<.7)p=[rng.r(-1.6,2.2),FL+.004,rng.r(1.5,2.25)];else p=[rng.r(1.6,2.25),FL+.004,rng.r(-1.3,2.2)];}
    else if(r<.93)p=[.55+rng.r(-.3,.3),.225,2.62+rng.r(-.18,.18)];else p=[-2.0+rng.r(-.25,.25),.81,1.84+rng.r(-.2,.2)];
    dm.position.set(p[0],p[1],p[2]);dm.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(nrm[0],nrm[1],nrm[2]));
    dm.rotateY(rng()*TAU);dm.rotateX(rng.r(-.25,.25));dm.rotateZ(rng.r(-.25,.25));const s=rng.r(.65,1.25);dm.scale.set(s,s,s);dm.updateMatrix();lm.setMatrixAt(i,dm.matrix);
    col.set(rng.pick(lcols)).convertSRGBToLinear().multiplyScalar(rng.r(.7,1.1));lm.setColorAt(i,col);}
  lm.instanceMatrix.needsUpdate=true;if(lm.instanceColor)lm.instanceColor.needsUpdate=true;lm.receiveShadow=true;lm.castShadow=false;G.autumn.add(lm);
  /* chrysanthemums & maple on the akadana (第十一段) */
  const ak=new GB();for(let i=0;i<6;i++){const cx=-2.0+rng.r(-.2,.18),cz=1.84+rng.r(-.15,.15);const c=rng()<.5?[1,.82,.2]:[.95,.93,.85];
    ak.lathe([[0,0],[.018,.004],[.02,.008],[.012,.012],[0,.014]],10,cx,.81,cz,{col:c,rm:(ph)=>.75+.25*Math.abs(Math.cos(ph*8))});
    ak.cyl([cx,.812,cz],[cx+rng.r(-.12,.12),.806,cz+rng.r(-.12,.12)],.002,.002,4,{col:[.2,.3,.1]});}
  const mA=new T.Mesh(res.geo(ak.build()),mat.plant);mA.castShadow=true;G.autumn.add(mA);
  /* ---- spring petals */
  const np=q.hi?90:q.md?60:30;const pm=new T.InstancedMesh(res.geo(new T.PlaneGeometry(.014,.016).rotateX(-PI/2)),mat.petal,np);
  for(let i=0;i<np;i++){let p;const r=rng();if(r<.6)p=[rng.r(-1.6,2.2),FL+.003,rng.r(1.45,2.25)];else if(r<.8)p=[.55+rng.r(-.3,.3),.224,2.62+rng.r(-.18,.18)];else p=[rng.r(-1.4,1.4),FL+.002,rng.r(.9,1.3)];
    dm.position.set(p[0],p[1],p[2]);dm.rotation.set(rng.r(-.2,.2),rng()*TAU,rng.r(-.2,.2));dm.scale.setScalar(rng.r(.8,1.2));dm.updateMatrix();pm.setMatrixAt(i,dm.matrix);}
  pm.instanceMatrix.needsUpdate=true;pm.receiveShadow=true;G.spring.add(pm);
  /* ---- summer: 簾 lowered on the east side opening (rolled up in other seasons) */
  const su=new GB(),ru=new GB();const sx=X1+.115,z0=-1.2,z1=1.3;const yTop=2.235,yLow=1.25;
  for(let y=yLow;y<yTop;y+=.012){su.box(sx,y,(z0+z1)/2,.004,.008,z1-z0,"z",{col:tint(rng,[.52,.42,.24],.05),us:1,vs:4,uo:rng(),vo:rng()});}
  for(const z of[z0+.25,(z0+z1)/2,z1-.25])su.cyl([sx+.004,yTop,z],[sx+.004,yLow-.01,z],.0018,.0018,4,{col:[.25,.18,.12]});
  su.box(sx,yLow-.006,(z0+z1)/2,.012,.014,z1-z0+.02,"z",{col:[.5,.42,.3]});su.box(sx,yTop+.01,(z0+z1)/2,.014,.02,z1-z0+.04,"z",{col:[.5,.42,.3]});
  ru.cyl([sx,yTop-.03,z0-.01],[sx,yTop-.03,z1+.01],.032,.032,10,{col:[.5,.4,.22],cap0:true,cap1:true,us:.01,vs:4});
  for(const z of[z0+.25,z1-.25])ru.cyl([sx-.04,yTop+.01,z],[sx+.04,yTop-.07,z],.003,.003,4,{col:[.4,.2,.15]});
  const mSu=new T.Mesh(res.geo(su.build()),mat.bamboo);mSu.castShadow=true;mSu.receiveShadow=true;G.summer.add(mSu);
  const mRu=new T.Mesh(res.geo(ru.build()),mat.bamboo);mRu.castShadow=true;root.add(mRu);
  let cur=null;
  function set(k){if(!G[k])k="autumn";cur=k;for(const n in G)G[n].visible=(n===k);mRu.visible=k!=="summer";
    const m=mat.roof;m.color.copy(k==="winter"?C(0xb4b2ae):k==="summer"?C(0xf2fff0):k==="spring"?C(0xfafff6):C(0xfff8f0));}
  return{set,get:()=>cur,G};}

/* ---------- 懸樋の水・閼伽桶の水面 */
function waterFx(K,res,mat,root,GL){const g=new T.Group();g.name="an_water";root.add(g);
  const b=K.basin;const wm=new T.Mesh(res.geo(new T.CircleGeometry(.079,24).rotateX(-PI/2)),mat.water);wm.position.set(b[0],b[1],b[2]);wm.receiveShadow=true;g.add(wm);
  const c=cv(16,64),x=c.getContext("2d");for(let i=0;i<64;i++){x.fillStyle=`rgba(255,255,255,${.25+.45*Math.abs(Math.sin(i*.7))})`;x.fillRect(0,i,16,1);}
  const st=res.tex(mkTex(c,{srgb:true}));st.wrapT=T.RepeatWrapping;
  const sm=res.mat(new T.MeshStandardMaterial({color:C(0xd6e6ee),map:st,transparent:true,opacity:.6,roughness:.1,depthWrite:false}));
  const e=K.kakehiEnd||[b[0]-.02,b[1]+.12,b[2]],dr=K.kakehiDir||[.3,0,.95];const top=[e[0]+dr[0]*.006,e[1]-.02,e[2]+dr[2]*.006];
  const curve=new T.QuadraticBezierCurve3(new T.Vector3(...top),new T.Vector3(top[0]+dr[0]*.03,top[1]-.03,top[2]+dr[2]*.03),new T.Vector3(top[0]+dr[0]*.045,b[1],top[2]+dr[2]*.045));
  K.dropAt=[top[0]+dr[0]*.045,b[1],top[2]+dr[2]*.045];
  const tube=new T.Mesh(res.geo(new T.TubeGeometry(curve,10,.0035,6,false)),sm);g.add(tube);
  const rp=new T.Mesh(res.geo(new T.RingGeometry(.006,.012,20).rotateX(-PI/2)),res.mat(new T.MeshBasicMaterial({color:0xcfe0e8,transparent:true,opacity:.5,depthWrite:false})));
  rp.position.set(K.dropAt[0],b[1]+.002,K.dropAt[2]);g.add(rp);
  function update(dt,t){st.offset.y=-(t*2.2)%1;const ph=(t*1.6)%1;rp.scale.setScalar(1+ph*4.5);rp.material.opacity=.45*(1-ph);}
  return{update,stream:tube,ripple:rp,water:wm};}

/* ---------------------------------------------------------------- makeAn */
function makeAn(opts){opts=opts||{};const q=QL(opts),res=new Res();const H=buildHut(q,res,opts.seed,opts);const root=H.root;
  const A={};const anc=(n,x,y,z,ry)=>{const o=new T.Object3D();o.name="anchor_"+n;o.position.set(x,y,z);o.rotation.y=ry||0;root.add(o);A[n]=o;};
  anc("seat",-.25,.615,1.04);anc("desk",-.25,FL,1.48);anc("seatInside",-.25,.615,-.20);anc("deskInside",-.25,.555,.22);
  anc("lamp",-.92,FL,.02);anc("armrest",.16,.555,-.22,PI/2);anc("stepFront",.55,.22,2.62);anc("basin",H.K.basin[0],H.K.basin[1],H.K.basin[2]);
  let night=0,season="autumn",furn=null;
  function setNight(v){night=clamp(+v||0,0,1);H.mat.paper.emissiveIntensity=night*1.1;}
  function setSeason(k){H.seas.set(k);season=H.seas.get();const w=season==="winter"||!H.K.kakehi;H.wat.stream.visible=!w;H.wat.ripple.visible=!w;}
  function clearFurn(){if(!furn)return;for(const k in furn){const o=furn[k];if(o){root.remove(o);o.userData.dispose&&o.userData.dispose();}}furn=null;}
  function furnish(set){clearFurn();if(!set||set==="none")return null;furn={};const put=(o,a,dy)=>{o.position.copy(a.position);o.position.y+=dy||0;o.rotation.y=a.rotation.y;root.add(o);return o;};
    if(set==="veranda"){furn.enza=put(makeEnza(opts),A.seat,-.061);furn.fuzukue=put(makeFuzukue(opts),A.desk);}
    else{furn.enza=put(makeEnza(opts),A.seatInside,-.061);furn.toudai=put(makeToudai(opts),A.lamp);furn.kyousoku=put(makeKyousoku(opts),A.armrest);}
    return furn;}
  let tAcc=0;
  root.userData={anchors:A,setShutters:H.sh.set,setSeason,setNight,furnish,groundShadow:H.gs,kakehiStart:H.K.kakehiPts?new T.Vector3(...H.K.kakehiPts[0]):null,
    dims:{floorY:FL,eaveFront:EF,eaveBack:EB,gableW:GW,gableE:GE,ridgeY:H.K.ridgeY,verandaFront:VZ,verandaEast:VX,postsX:[X0,X1],postsZ:[Z0,Z1],ketaY:KY},
    update(dt,t){tAcc=t!=null?t:tAcc+(dt||0);H.wat.update(dt,tAcc);if(night>0)H.mat.paper.emissiveIntensity=night*(1.02+.08*Math.sin(tAcc*7.3)*Math.sin(tAcc*2.1));
      if(furn)for(const k in furn){const o=furn[k];o&&o.userData.update&&o.userData.update(dt,tAcc);}},
    dispose(){clearFurn();res.dispose();}};
  setSeason(opts.season||"autumn");setNight(0);return root;}

/* ============================================================================ 調度 */
/* ---------- kana calligraphy (徒然草 第七段 冒頭) */
const KANA={"し":[[[.45,.04],[.43,.35],[.44,.66],[.56,.86],[.72,.8],[.84,.6]]],"く":[[[.7,.05],[.38,.45],[.72,.95]]],
 "の":[[[.55,.22],[.42,.6],[.28,.86],[.16,.68],[.2,.38],[.46,.18],[.76,.28],[.86,.58],[.6,.92]]],"つ":[[[.08,.36],[.55,.24],[.86,.42],[.74,.72],[.42,.88]]],
 "て":[[[.1,.2],[.86,.14],[.5,.36],[.34,.6],[.5,.86],[.78,.88]]],"る":[[[.2,.1],[.75,.1],[.28,.52],[.7,.44],[.82,.7],[.55,.9],[.34,.82],[.46,.7],[.62,.82]]],
 "ら":[[[.42,.04],[.56,.14]],[[.3,.24],[.26,.6],[.52,.44],[.76,.6],[.7,.86],[.38,.95]]],
 "ゆ":[[[.15,.3],[.12,.7],[.26,.76],[.46,.34],[.76,.3],[.86,.56],[.66,.76],[.4,.64]],[[.56,.04],[.56,.6],[.44,.96]]],
 "き":[[[.2,.22],[.75,.18]],[[.15,.42],[.82,.38]],[[.42,.04],[.62,.7]],[[.3,.68],[.36,.9],[.76,.92]]],
 "な":[[[.1,.25],[.5,.2]],[[.36,.04],[.2,.6]],[[.74,.24],[.86,.36]],[[.6,.44],[.56,.76],[.34,.8],[.46,.64],[.76,.86],[.86,.96]]],
 "あ":[[[.15,.25],[.8,.2]],[[.42,.04],[.5,.9]],[[.62,.4],[.3,.8],[.14,.6],[.5,.44],[.86,.56],[.76,.9],[.54,.96]]],
 "か":[[[.1,.35],[.65,.3],[.7,.55],[.45,.9]],[[.4,.05],[.25,.8]],[[.8,.25],[.9,.5]]],
 "を":[[[.2,.15],[.75,.12]],[[.5,.02],[.3,.5],[.55,.4],[.7,.45]],[[.75,.5],[.3,.75],[.45,.95],[.85,.9]]],
 "に":[[[.2,.08],[.14,.86],[.22,.7]],[[.5,.25],[.85,.2]],[[.5,.62],[.6,.8],[.86,.8]]],
 "は":[[[.2,.08],[.15,.9]],[[.45,.3],[.85,.25]],[[.65,.05],[.65,.75],[.45,.85],[.5,.7],[.8,.9]]],
 "と":[[[.36,.04],[.46,.4]],[[.76,.24],[.3,.55],[.3,.86],[.8,.9]]],"こ":[[[.25,.2],[.75,.15],[.64,.3]],[[.25,.7],[.4,.86],[.8,.8]]],
 "い":[[[.25,.15],[.2,.6],[.3,.86],[.38,.7]],[[.7,.3],[.8,.65]]],"り":[[[.3,.1],[.25,.55],[.32,.6]],[[.7,.05],[.72,.6],[.5,.96]]],
 "よ":[[[.55,.3],[.8,.3]],[[.5,.05],[.5,.75],[.25,.8],[.35,.65],[.76,.9]]],"ふ":[[[.45,.1],[.55,.2]],[[.5,.3],[.4,.6],[.56,.8],[.45,.9]],[[.2,.6],[.12,.76]],[[.75,.6],[.88,.76]]],
 "ん":[[[.55,.05],[.25,.86],[.5,.5],[.65,.6],[.7,.86],[.9,.76]]],"も":[[[.45,.04],[.35,.6],[.45,.86],[.65,.86],[.76,.6]],[[.2,.3],[.7,.28]],[[.18,.5],[.68,.48]]],
 "ま":[[[.15,.2],[.85,.18]],[[.15,.45],[.85,.42]],[[.5,.02],[.5,.7],[.3,.8],[.35,.65],[.7,.9]]],
 "け":[[[.2,.1],[.15,.86]],[[.45,.3],[.88,.28]],[[.7,.08],[.72,.7],[.55,.96]]],
 "た":[[[.1,.3],[.5,.25]],[[.35,.05],[.2,.86]],[[.6,.45],[.85,.42]],[[.55,.7],[.65,.86],[.9,.86]]],
 "ち":[[[.15,.3],[.8,.25]],[[.45,.05],[.3,.6],[.65,.5],[.8,.7],[.5,.92]]],"さ":[[[.15,.3],[.85,.25]],[[.4,.05],[.7,.6],[.5,.55]],[[.3,.7],[.4,.88],[.75,.9]]],
 "へ":[[[.08,.62],[.35,.3],[.92,.76]]],"や":[[[.15,.4],[.75,.25],[.85,.45],[.7,.55]],[[.4,.1],[.5,.2]],[[.3,.05],[.55,.96]]],
 "み":[[[.2,.15],[.6,.12],[.25,.65],[.4,.75],[.6,.45],[.85,.65]],[[.72,.3],[.55,.9]]],"す":[[[.1,.3],[.9,.25]],[[.55,.05],[.55,.55],[.4,.6],[.45,.45],[.6,.55],[.5,.96]]],
 "ひ":[[[.15,.25],[.4,.3],[.25,.75],[.5,.9],[.75,.6],[.8,.25],[.9,.4]]],"ゝ":[[[.36,.3],[.66,.64],[.4,.86]]],
 "れ":[[[.25,.05],[.2,.9]],[[.05,.35],[.4,.3],[.25,.6],[.55,.35],[.7,.4],[.65,.75],[.9,.8]]],"そ":[[[.25,.15],[.7,.1],[.2,.45],[.8,.4],[.45,.6],[.45,.85],[.75,.9]]],
 "ろ":[[[.2,.1],[.75,.1],[.3,.5],[.7,.45],[.8,.7],[.5,.9],[.3,.85]]],"ぬ":[[[.25,.2],[.45,.8]],[[.65,.15],[.4,.55],[.18,.8],[.15,.55],[.5,.35],[.85,.5],[.75,.85],[.55,.85],[.62,.72],[.82,.88]]],
 "ほ":[[[.2,.08],[.15,.9]],[[.45,.12],[.85,.1]],[[.45,.35],[.85,.32]],[[.65,.12],[.65,.75],[.45,.85],[.5,.7],[.8,.9]]],"め":[[[.3,.2],[.55,.8]],[[.7,.15],[.45,.55],[.2,.8],[.15,.55],[.5,.35],[.85,.5],[.75,.85],[.55,.9]]],"う":[[[.4,.08],[.6,.15]],[[.25,.4],[.6,.3],[.75,.5],[.6,.8],[.35,.95]]]};
const KTEXT="あたしのゝつゆきゆるときなくとりへやまのけふりたちさらてのみすみはつるならひならはいかにもののあはれもなからんよはさためなきこそいみしけれいのちあるものをみるにひとはかりひさしきはなしかけろふのゆふへをまちなつのせみのはるあきをしらぬもあるそかしつくつくとひとゝせをくらすほとたにもこよなうのとけしや";
function catmull(pts,steps){const out=[];const n=pts.length;if(n===1)return[pts[0]];
  for(let i=0;i<n-1;i++){const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(n-1,i+2)];
    for(let s=0;s<steps;s++){const t=s/steps,t2=t*t,t3=t2*t;out.push([.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
      .5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)]);}}out.push(pts[n-1]);return out;}
function genCalligraphy(W,H){const r=RNG(1330);const ink=cv(W,H),x=ink.getContext("2d");const sc=W/1024;
  const cols=[];const colW=80*sc,glyph=58*sc,top=56*sc,bottom=H-46*sc;let cx=W-62*sc,cy=top;let prevEnd=null,load=1;
  const stamp=(px,py,rad,a)=>{x.globalAlpha=a;x.beginPath();x.ellipse(px,py,rad,rad*.8,-.55,0,TAU);x.fill();};
  const dryStamp=(px,py,rad,a,ang)=>{const n=4;for(let k=0;k<n;k++){if(r()<.35)continue;const o=(k/(n-1)-.5)*rad*1.7;stamp(px+Math.cos(ang)*o,py+Math.sin(ang)*o,rad*.32,a*.85);}};
  x.fillStyle="#120d09";let colDrift=0;
  for(const ch of KTEXT){const G=KANA[ch];if(!G)continue;const s=glyph*r.r(.78,1.16),sw=s*r.r(.82,1.06);
    if(cy+s>bottom){cols.push({x:cx,y0:top-10*sc,y1:cy});cx-=colW;cy=top+r.r(-6,10)*sc;colDrift=0;if(load<.6||r()<.5)load=1;prevEnd=null;if(cx<40*sc)break;}
    colDrift+=r.r(-2.5,2.5)*sc;colDrift*=.85;const ox=cx-sw/2+colDrift+r.r(-3,3)*sc,oy=cy;const sl=r.r(-.07,.09);
    const map=p=>[ox+(p[0]+(p[1]-.5)*sl)*sw,oy+p[1]*s];
    if(prevEnd&&r()<.7){const st=map(G[0][0]);const d=Math.hypot(st[0]-prevEnd[0],st[1]-prevEnd[1]);const path=catmull([prevEnd,[(prevEnd[0]+st[0])/2+r.r(-6,6)*sc,(prevEnd[1]+st[1])/2],st],Math.max(12,Math.round(d/1.2)));
      for(const p of path)stamp(p[0],p[1],.75*sc,.42+.3*load);}
    for(const stroke of G){const pts=stroke.map(map);let plen=0;for(let i=1;i<pts.length;i++)plen+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
      const path=catmull(pts,Math.max(8,Math.round(plen/1.1/Math.max(1,pts.length-1))));const n=path.length;
      for(let i=0;i<n;i++){const t=i/(n-1);const p=path[i];const q=path[Math.min(n-1,i+1)],pp=path[Math.max(0,i-1)];const dx=q[0]-pp[0],dy=q[1]-pp[1];const vert=Math.abs(dy)/(Math.hypot(dx,dy)+1e-6);
        const press=(.42+.58*ss(0,.1,t)+.35*(1-ss(0,.06,t)))*(1-.72*ss(.68,1,t))*(.42+.78*vert*vert);const rad=(.9+2.9*press*(.5+.5*load))*sc;
        const dry=load<.5&&r()<(.5-load)*1.8;const al=.55+.4*load;
        if(!dry)stamp(p[0],p[1],rad,al);else dryStamp(p[0],p[1],rad,al,Math.atan2(dy,dx)+PI/2);}
      prevEnd=pts[pts.length-1];}
    load=Math.max(.28,load-r.r(.025,.055));if(r()<.07)load=1;cy+=s*r.r(.93,1.1);}
  cols.push({x:cx,y0:top-10*sc,y1:cy});x.globalAlpha=1;return{ink,cols,colW};}
function genPaper(W,H){const base=genWashi(256).c,c=cv(W,H),x=c.getContext("2d");for(let yy=0;yy<H;yy+=256)for(let xx=0;xx<W;xx+=256)x.drawImage(base,xx,yy);x.fillStyle="rgba(196,170,120,.13)";x.fillRect(0,0,W,H);
  const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,"rgba(255,245,220,.0)");g.addColorStop(1,"rgba(200,180,140,.10)");x.fillStyle=g;x.fillRect(0,0,W,H);return c;}

function makeFuzukue(opts){opts=opts||{};const q=QL(opts),res=new Res(),rng=RNG(77);const g=new T.Group();g.name="TsureFuzukue";
  const W0=res.sh("wood"+q.ts,()=>genWood(q.ts)),ramp=res.sh("ramp",genRamp);
  const mDesk=res.mat(new T.MeshPhysicalMaterial({map:W0.map,bumpMap:W0.data,bumpScale:.0003,color:C(0x8a5a38),roughness:.5,clearcoat:.55,clearcoatRoughness:.35,vertexColors:true}));
  const mLac=res.mat(new T.MeshPhysicalMaterial({color:0xffffff,roughness:.3,clearcoat:1,clearcoatRoughness:.12,vertexColors:true}));
  const mStone=res.mat(new T.MeshStandardMaterial({color:C(0x3e3438),roughness:.6,metalness:0,vertexColors:true}));const mWet=res.mat(new T.MeshStandardMaterial({color:C(0x3a3236),roughness:.22,metalness:0,vertexColors:true}));
  const ic=cv(64,64),ix=ic.getContext("2d");ix.fillStyle="#000";ix.fillRect(0,0,64,64);const hg=ix.createRadialGradient(42,30,0,42,30,9);hg.addColorStop(0,"rgba(255,250,240,.8)");hg.addColorStop(.5,"rgba(255,250,240,.25)");hg.addColorStop(1,"rgba(255,255,255,0)");
  ix.save();ix.scale(1,.55);ix.fillStyle=hg;ix.fillRect(0,0,64,64/.55);ix.restore();const it=res.tex(mkTex(ic,{wrap:false}));
  const mInk=res.mat(new T.MeshStandardMaterial({color:C(0x060505),roughness:.06,metalness:.05,emissive:0xffffff,emissiveMap:it,emissiveIntensity:.42}));
  const mCel=res.mat(new T.MeshPhysicalMaterial({color:C(0x9fbcae),roughness:.18,clearcoat:1,clearcoatRoughness:.08}));
  const BK=res.sh("books",genBooks);const mBooks=res.mat(new T.MeshStandardMaterial({map:BK,roughness:.85,vertexColors:true}));
  const BA=res.sh("bamboo"+(q.lo?256:512),()=>genBamboo(q.lo?256:512));const mBam=res.mat(new T.MeshStandardMaterial({map:BA.map,roughness:.45,vertexColors:true}));
  const gd=new GB(),gk=new GB(),gc=new GB(),gs=new GB(),gi=new GB(),gw=new GB();
  /* desk: top + 2 panel legs with arch & 猪目 cut-outs + stretchers */
  const TY=.315,TT=.025,L=.75,D=.35;gd.box(0,TY-TT/2,0,L,TT,D,"x",{uo:.3,vo:.2,col:[1,1,1],ch:.004,seg:3});
  const legShape=()=>{const s=new T.Shape();const hz=.15,h=TY-TT;s.moveTo(-hz,0);s.lineTo(-hz+.05,0);s.quadraticCurveTo(-.05,.075,0,.078);s.quadraticCurveTo(.05,.075,hz-.05,0);s.lineTo(hz,0);s.lineTo(hz-.012,h);s.lineTo(-hz+.012,h);s.lineTo(-hz,0);
    const ho=new T.Path();const cy=.17;ho.moveTo(0,cy-.035);ho.bezierCurveTo(.03,cy-.005,.038,cy+.03,.016,cy+.036);ho.bezierCurveTo(.006,cy+.038,.001,cy+.03,0,cy+.022);ho.bezierCurveTo(-.001,cy+.03,-.006,cy+.038,-.016,cy+.036);ho.bezierCurveTo(-.038,cy+.03,-.03,cy-.005,0,cy-.035);s.holes.push(ho);return s;};
  const lg=new T.ExtrudeGeometry(legShape(),{depth:.026,bevelEnabled:true,bevelThickness:.002,bevelSize:.002,bevelSegments:1,curveSegments:q.lo?6:12});
  for(const s of[-1,1]){const m=new T.Matrix4().makeRotationY(PI/2).setPosition(s*.315-.013,0,0);gd.geom(lg,m,{us:1/1.2,vs:1/2.4,swap:true,uo:.1+s*.2,vo:.5});}lg.dispose();
  for(const z of[-.12,.12])gd.box(0,.255,z,.6,.022,.02,"x",{uo:.6,vo:.1,col:[.95,.95,.95]});
  /* 硯箱 (black lacquer, vermilion inside) sitting on its lid */
  const bx=-.245,bz=.01,y0=TY;gk.box(bx,y0+.006,bz,.205,.012,.245,"x",{col:[.035,.03,.028],ch:.004,us:1,vs:1});
  const by=y0+.012,bh=.042,bw=.2,bd=.24,wt=.008;
  gk.box(bx,by+.003,bz,bw,.006,bd,"x",{col:[.035,.03,.028],us:1,vs:1});
  gk.box(bx,by+bh/2,bz-bd/2+wt/2,bw,bh,wt,"x",{col:[.035,.03,.028],us:1,vs:1,ch:.002});gk.box(bx,by+bh/2,bz+bd/2-wt/2,bw,bh,wt,"x",{col:[.035,.03,.028],us:1,vs:1,ch:.002});
  gk.box(bx-bw/2+wt/2,by+bh/2,bz,wt,bh,bd-2*wt,"z",{col:[.035,.03,.028],us:1,vs:1});gk.box(bx+bw/2-wt/2,by+bh/2,bz,wt,bh,bd-2*wt,"z",{col:[.035,.03,.028],us:1,vs:1});
  gk.box(bx,by+.0065,bz,bw-2*wt,.001,bd-2*wt,"x",{col:[.32,.06,.03],us:1,vs:1});
  for(const[px,pz,ww,dd]of[[bx,bz-bd/2+wt+.001,bw-2*wt,.002],[bx,bz+bd/2-wt-.001,bw-2*wt,.002]])gk.box(px,by+bh/2,pz,ww,bh-.008,dd,"x",{col:[.3,.055,.03],us:1,vs:1});
  gk.box(bx-bw/2+wt+.001,by+bh/2,bz,.002,bh-.008,bd-2*wt,"z",{col:[.3,.055,.03],us:1,vs:1});gk.box(bx+bw/2-wt-.001,by+bh/2,bz,.002,bh-.008,bd-2*wt,"z",{col:[.3,.055,.03],us:1,vs:1});
  gk.box(bx-.035,by+bh/2,bz,.004,bh-.01,bd-2*wt,"z",{col:[.3,.055,.03],us:1,vs:1});
  /* inkstone: body, rim, 陸 (wet), 海 (ink pool) */
  const sx=bx+.035,sz=bz,sw=.085,sd=.17,sb=by+.007;const RC=[1.15,1.15,1.15];gs.box(sx,sb+.004,sz,sw,.008,sd,"x",{col:[1,1,1],us:1,vs:1,ch:.002});
  gs.box(sx,sb+.0135,sz-sd/2+.004,sw,.011,.008,"x",{col:RC});gs.box(sx-sw/2+.004,sb+.0135,sz,.008,.011,sd-.016,"z",{col:RC});gs.box(sx+sw/2-.004,sb+.0135,sz,.008,.011,sd-.016,"z",{col:RC});gs.box(sx,sb+.0135,sz+sd/2-.004,sw,.011,.008,"x",{col:RC});
  const seaZ0=sz+.03,seaZ1=sz+sd/2-.008;
  gw.face([[sx-sw/2+.008,sb+.0155,sz-sd/2+.008],[sx+sw/2-.008,sb+.0155,sz-sd/2+.008],[sx+sw/2-.008,sb+.0125,seaZ0],[sx-sw/2+.008,sb+.0125,seaZ0]],[[0,0],[1,0],[1,1],[0,1]],[[1,1,1],[1,1,1],[.18,.16,.17],[.18,.16,.17]],[0,1,0]);
  gw.face([[sx-sw/2+.008,sb+.0125,seaZ0],[sx+sw/2-.008,sb+.0125,seaZ0],[sx+sw/2-.008,sb+.0085,seaZ0],[sx-sw/2+.008,sb+.0085,seaZ0]],[[0,0],[1,0],[1,1],[0,1]],[.8,.8,.8],[0,0,1]);
  const inkMesh=new T.Mesh(res.geo(new T.PlaneGeometry(sw-.016,seaZ1-seaZ0).rotateX(-PI/2)),mInk);inkMesh.position.set(sx,sb+.0095,(seaZ0+seaZ1)/2);g.add(inkMesh);
  /* 水滴 (celadon) & 墨 */
  gc.lathe([[0,0],[.012,0],[.02,.006],[.023,.013],[.018,.022],[.006,.026],[.004,.029],[0,.029]],16,bx-.05,by+.007,bz+.06,{});
  gc.cyl([bx-.05+.018,by+.02,bz+.06],[bx-.05+.032,by+.026,bz+.06],.003,.0022,6,{cap1:true});
  gk.box(bx-.055,by+.013,bz-.035,.018,.012,.075,"z",{col:[.06,.06,.065],us:1,vs:1,ch:.002});gk.box(bx-.055,by+.0195,bz-.035,.012,.0015,.03,"z",{col:[.5,.4,.15],us:1,vs:1});
  /* 筆置 (celadon three-peak rest) & 筆 */
  const rx=-.124,rz=.07;const prof=[[-.03,0],[.03,0],[.03,.006],[.022,.016],[.014,.008],[.0,.018],[-.014,.008],[-.022,.016],[-.03,.006]].map(p=>[rx+p[0],TY+p[1]]);gc.prism(prof,"z",rz-.007,rz+.007,{us:1,vs:1});
  const brush=new T.Group();brush.name="fude";g.add(brush);const fb=new GB();const p0=[rx+.004,TY+.004,-.13],p1=[rx+.004,TY+.019,rz+.002];
  fb.cyl(p0,p1,.0045,.0042,8,{col:[.86,.7,.42],cap0:true,rings:[0,.3,.31,.7,.71,1],cf:t=>Math.abs(t-.3)<.015||Math.abs(t-.7)<.015?[.6,.6,.6]:[1,1,1],us:1,vs:4});
  const dn=nrmz(sub(p1,p0));const tipBase=[p1[0]+dn[0]*.004,p1[1]+dn[1]*.004,p1[2]+dn[2]*.004];
  fb.cyl(p1,tipBase,.0048,.0048,8,{col:[.05,.04,.03]});
  fb.cyl(tipBase,[tipBase[0]+dn[0]*.032,tipBase[1]+dn[1]*.032-.002,tipBase[2]+dn[2]*.032],.0052,.0002,10,{rings:[0,.15,.35,.6,.85,1],rf:t=>1+.25*Math.sin(t*PI)*(1-t),cf:t=>t<.25?[.8,.72,.6]:[.04,.035,.03]});
  const mBr=new T.Mesh(res.geo(fb.build()),mBam);mBr.castShadow=true;brush.add(mBr);
  /* papers */
  const PW=.29,PD=.235,pcx=.043,pcz=-.045;const ps=q.lo?768:1024;const PH=Math.round(ps*PD/PW);
  const paperBase=genPaper(ps,PH);const cal=genCalligraphy(ps,PH);const pc=cv(ps,PH),px=pc.getContext("2d");const ptex=res.tex(mkTex(pc,{wrap:false,aniso:8}));
  const blankTex=res.tex(mkTex(paperBase,{wrap:false}));const mBlank=res.mat(new T.MeshStandardMaterial({map:blankTex,roughness:.9}));
  for(const[dx,dz,a,dy]of[[.012,.01,.05,.0005],[-.008,-.006,-.035,.0013]]){const m=new T.Mesh(res.geo(new T.PlaneGeometry(PW,PD).rotateX(-PI/2)),mBlank);m.position.set(pcx+dx,TY+dy,pcz+dz);m.rotation.y=a;m.receiveShadow=true;g.add(m);}
  const pg=new T.PlaneGeometry(PW,PD,12,8);pg.rotateX(-PI/2);{const pa=pg.attributes.position,uv=pg.attributes.uv;for(let i=0;i<pa.count;i++){const x=pa.getX(i),z=pa.getZ(i);
      const curl=.0025*Math.pow(Math.max(0,(Math.abs(x)-PW*.38)/(PW*.12)),2)+.0005*(1+Math.sin(x*40+z*25));pa.setY(i,curl);uv.setXY(i,.5-x/PW,.5+z/PD);}pg.computeVertexNormals();}
  const mPaper=res.mat(new T.MeshStandardMaterial({map:ptex,roughness:.88,side:T.DoubleSide}));const paper=new T.Mesh(res.geo(pg),mPaper);paper.position.set(pcx,TY+.0026,pcz);paper.receiveShadow=true;paper.name="ryoushi";g.add(paper);
  const tot=cal.cols.reduce((s,c)=>s+(c.y1-c.y0),0);const tip=new T.Vector3();let wv=-1;
  function setWritten(v){v=clamp(+v||0,0,1);const q=Math.round(v*400)/400;if(q===wv)return;wv=q;px.clearRect(0,0,ps,PH);px.drawImage(paperBase,0,0);let rem=q*tot;let tx=null,ty=null;
    for(const c of cal.cols){const h=c.y1-c.y0;if(rem<=0)break;const show=Math.min(h,rem);const x0=c.x-cal.colW/2;
      px.drawImage(cal.ink,x0,c.y0,cal.colW,show,x0,c.y0,cal.colW,show);tx=c.x;ty=c.y0+show;rem-=h;}
    ptex.needsUpdate=true;if(tx!=null){const u=tx/ps,vv=ty/PH;tip.set(pcx+(.5-u)*PW,TY+.002,pcz+(.5-vv)*PD);}else tip.set(pcx-PW*.4,TY+.002,pcz+PD*.4);}
  setWritten(1);
  /* books (3) & scroll */
  let yb2=TY;for(let i=0;i<3;i++){const th=[.012,.015,.01][i];bookInto(gi,.274+rng.r(-.004,.004),yb2,.022+rng.r(-.006,.006),.145,th,.21,rng.r(-.05,.05),i%3);yb2+=th;}
  const sc={books:gi,lacq:gk};scrollInto(sc,[-.095,TY+.017,.135],[.165,TY+.017,.128],.017,rng);
  const add=(gbx,m,cast)=>{const gg=gbx.build();if(!gg)return;const me=new T.Mesh(res.geo(gg),m);me.castShadow=cast!==false;me.receiveShadow=true;g.add(me);return me;};
  add(gd,mDesk);add(gk,mLac);add(gs,mStone);add(gw,mWet);add(gc,mCel);add(gi,mBooks);
  g.traverse(o=>{if(o.isMesh&&o!==paper){o.castShadow=true;o.receiveShadow=true;}});inkMesh.castShadow=false;
  g.userData={paper,brush,brushTip:tip,setWritten,update(){},dispose(){res.dispose();}};return g;}

function makeToudai(opts){opts=opts||{};const q=QL(opts),res=new Res();const g=new T.Group();g.name="TsureToudai";
  const mL=res.mat(new T.MeshPhysicalMaterial({color:0xffffff,roughness:.34,clearcoat:1,clearcoatRoughness:.16,vertexColors:true}));
  const CL=res.sh("clay",genClay);const mClay=res.mat(new T.MeshStandardMaterial({map:CL.map,bumpMap:CL.data,bumpScale:.0004,roughness:.88,vertexColors:true}));
  const mOil=res.mat(new T.MeshStandardMaterial({color:C(0x2a1606),roughness:.05,metalness:.0,emissive:C(0x6a3008),emissiveIntensity:.0}));
  const mWick=res.mat(new T.MeshStandardMaterial({color:0xffffff,roughness:.9,vertexColors:true}));
  const gl=new GB(),gc=new GB(),gw=new GB();const seg=q.lo?16:32;const blk=[.028,.024,.022],red=[.42,.05,.03];
  /* lobed (八花) base with a vermilion rim line */
  const bp=[[.124,0],[.125,.004],[.124,.009],[.118,.02],[.104,.033],[.082,.046],[.056,.057],[.036,.064],[.024,.069],[.02,.072]];
  gl.lathe(bp,seg*2,0,0,0,{rm:(ph,j)=>{const f=1-j/(bp.length-1);return 1-.085*f*(1-Math.pow(Math.abs(Math.cos(ph*4)),.55));},cf:(t,j)=>j<=1?red:blk});
  gl.lathe([[0,.0005],[.12,.0005]],seg,0,0,0,{col:blk});
  gl.cyl([0,.068,0],[0,.112,0],.019,.016,seg/2,{col:blk,cap1:true});gl.lathe([[.016,.106],[.022,.109],[.022,.114],[.014,.118]],seg/2,0,0,0,{col:blk});
  gl.cyl([0,.11,0],[0,.75,0],.0085,.0078,12,{col:blk,rings:[0,.25,.5,.75,1]});
  gl.lathe([[.009,.7],[.0135,.704],[.0135,.712],[.009,.716]],16,0,0,0,{col:blk});
  /* top holder (受) */
  gl.lathe([[.008,.744],[.014,.75],[.03,.763],[.046,.777],[.05,.782],[.047,.784],[.03,.776],[.012,.77],[0,.77]],seg,0,0,0,{col:blk,cf:(t,j)=>j>=4&&j<=5?[.12,.05,.03]:blk});
  for(let i=0;i<3;i++){const a=i/3*TAU+.3;gl.cyl([Math.cos(a)*.048,.779,Math.sin(a)*.048],[Math.cos(a)*.0625,.796,Math.sin(a)*.0625],.0028,.0024,5,{col:blk,cap1:true});}
  /* 土器 dish */
  const dy=.782;gc.lathe([[0,0],[.028,0],[.034,.002],[.05,.011],[.058,.018],[.0595,.0205],[.057,.021],[.05,.015],[.034,.007],[.028,.005],[0,.005]],seg,0,dy,0,
    {uv:(ph,j,r)=>[.5+Math.cos(ph)*r*6,.5+Math.sin(ph)*r*6],cf:(t,j)=>j>=7?[.42,.3,.2]:j===6?[.7,.58,.48]:[1,1,1]});
  const oil=new T.Mesh(res.geo(new T.CircleGeometry(.045,seg).rotateX(-PI/2)),mOil);oil.position.set(0,dy+.0115,0);g.add(oil);
  /* wick (灯心): three pith strands from centre to rim (+X), charred tip */
  for(let i=0;i<3;i++){const dz=(i-1)*.0026;gw.cyl([-.01,dy+.0118,dz*.6],[.05,dy+.0135,dz],.0013,.0013,5,{col:[.96,.94,.88]});
    gw.cyl([.05,dy+.0135,dz],[.0665,dy+.0215,dz*1.1],.0013,.0011,5,{col:[.96,.94,.88],rings:[0,.6,1],cf:t=>t>.55?[.12,.08,.06]:[.95,.9,.8],cap1:true});}
  const add=(b,m)=>{const gg=b.build();const me=new T.Mesh(res.geo(gg),m);me.castShadow=true;me.receiveShadow=true;g.add(me);return me;};add(gl,mL);add(gc,mClay);add(gw,mWick);
  /* flame */
  const fl=new T.Group();fl.name="flame";fl.position.set(.068,dy+.022,0);g.add(fl);const center=new T.Object3D();center.name="flameCenter";center.position.set(.001,.022,0);fl.add(center);
  const teardrop=(h,r,cols)=>{const b=new GB();const pr=[[0,0],[r*.55,h*.04],[r*.92,h*.15],[r,h*.3],[r*.86,h*.5],[r*.55,h*.72],[r*.22,h*.9],[0,h]];
    b.lathe(pr,q.lo?10:16,0,0,0,{cf:(t,j)=>cols(j/(pr.length-1))});return res.geo(b.build());};
  const addMat=(c,o)=>res.mat(new T.MeshBasicMaterial({color:c,vertexColors:true,transparent:true,opacity:o,blending:T.AdditiveBlending,depthWrite:false,fog:false,toneMapped:true}));
  const body=new T.Mesh(teardrop(.044,.0072,t=>t<.08?[.08,.1,.5]:t<.25?[.9,.38,.08]:t<.7?[1,.55,.14]:[.5*(1-t)*3,.2*(1-t)*3,.02]),addMat(new T.Color(1.15,.9,.75),.9));
  const core=new T.Mesh(teardrop(.026,.0036,t=>t<.1?[.3,.3,.6]:[1,.9,.65]),addMat(new T.Color(2.2,2.0,1.6),1));core.position.y=.003;
  const blue=new T.Mesh(teardrop(.012,.0052,t=>[.15,.25,.9]),addMat(new T.Color(1,1,1),.55));blue.position.y=-.002;
  [body,core,blue].forEach(m=>{m.renderOrder=10;fl.add(m);});
  const sm=o=>res.mat(new T.SpriteMaterial({map:res.sh("glow",genGlow),color:new T.Color(1,.62,.28),transparent:true,opacity:o,blending:T.AdditiveBlending,depthWrite:false,fog:false}));
  const halo=new T.Sprite(sm(.4));halo.scale.set(.11,.13,1);halo.position.y=.02;halo.renderOrder=11;fl.add(halo);
  const halo2=new T.Sprite(sm(.1));halo2.scale.set(.42,.42,1);halo2.position.y=.02;halo2.renderOrder=11;fl.add(halo2);
  let lit=true,inten=1,fv=1;const nz=lattice(7,64,1);
  function apply(){const s=lit?inten:0;fl.visible=lit&&inten>0.01;const k=.55+.45*Math.min(1.2,s);fl.scale.set(k*(.9+.1*fv),k*(.82+.3*fv),k*(.9+.1*fv));
    halo.material.opacity=.4*fv*Math.min(1,s);halo2.material.opacity=.1*fv*Math.min(1,s);mOil.emissiveIntensity=lit?.25*s*fv:0;}
  function update(dt,t){if(t==null)t=0;const n=nz(t*6.3,0)*.6+nz(t*17.1+9,0)*.4;fv=clamp(.78+.3*(n-.5)*2*.5+.06*Math.sin(t*11.3),0,1);
    fl.rotation.z=.12*(nz(t*2.1+3,0)-.5);fl.rotation.x=.08*(nz(t*1.7+7,0)-.5);g.userData.flicker=lit?fv*Math.min(1,inten):0;apply();}
  g.userData={flame:center,flameGroup:fl,flicker:1,setLit(b){lit=!!b;apply();g.userData.flicker=lit?fv*Math.min(1,inten):0;},setIntensity(v){inten=clamp(+v,0,1.5);apply();},update,dispose(){res.dispose();}};
  update(0,0);return g;}

function makeEnza(opts){opts=opts||{};const q=QL(opts),res=new Res();const g=new T.Group();g.name="TsureEnza";const EN=res.sh("enza",genEnza);
  const m=res.mat(new T.MeshStandardMaterial({map:EN.map,bumpMap:EN.data,bumpScale:.0025,roughness:.95,vertexColors:true}));const b=new GB();const seg=q.lo?24:48;
  const top=[[0,.061],[.06,.0612],[.12,.0605],[.17,.0592],[.2,.057],[.215,.054]];const rimP=[[.215,.054],[.222,.049],[.226,.04],[.226,.026],[.222,.014],[.212,.005],[.198,.001],[.1,0],[0,0]];
  const topUV=(ph,j,r)=>[.5+Math.cos(ph)*r*2.307,.2+.8*(.5+Math.sin(ph)*r*2.307)];
  b.lathe(top.slice().reverse(),seg,0,0,0,{uv:topUV});
  b.lathe(rimP.slice().reverse(),seg,0,0,0,{uv:(ph,j,r,y)=>[ph/TAU*6,.2*clamp(y/.06,0,1)]});EN.map.wrapS=T.RepeatWrapping;
  const me=new T.Mesh(res.geo(b.build()),m);me.castShadow=true;me.receiveShadow=true;g.add(me);
  g.userData={update(){},dispose(){res.dispose();}};return g;}

function makeKyousoku(opts){opts=opts||{};const q=QL(opts),res=new Res();const g=new T.Group();g.name="TsureKyousoku";
  const m=res.mat(new T.MeshPhysicalMaterial({color:C(0x5e2a1a),roughness:.5,clearcoat:.5,clearcoatRoughness:.3,vertexColors:true}));const b=new GB();
  const ts=new T.Shape();const L=.27,Wd=.058;ts.moveTo(-L+Wd,-Wd);ts.lineTo(L-Wd,-Wd);ts.absarc(L-Wd,0,Wd,-PI/2,PI/2,false);ts.lineTo(-L+Wd,Wd);ts.absarc(-L+Wd,0,Wd,PI/2,3*PI/2,false);
  const tg=new T.ExtrudeGeometry(ts,{depth:.022,bevelEnabled:true,bevelThickness:.006,bevelSize:.006,bevelSegments:q.lo?1:3,curveSegments:q.lo?8:16});
  b.geom(tg,new T.Matrix4().makeRotationX(-PI/2).setPosition(0,.302,0),{col:[1,1,1]});tg.dispose();
  const leg=new T.Shape();const H=.302;leg.moveTo(-.125,0);leg.lineTo(-.07,0);leg.quadraticCurveTo(-.035,.06,0,.064);leg.quadraticCurveTo(.035,.06,.07,0);leg.lineTo(.125,0);leg.lineTo(.13,.016);
  leg.bezierCurveTo(.105,.03,.07,.06,.05,.12);leg.bezierCurveTo(.035,.17,.028,.22,.036,H);leg.lineTo(-.036,H);leg.bezierCurveTo(-.028,.22,-.035,.17,-.05,.12);leg.bezierCurveTo(-.07,.06,-.105,.03,-.13,.016);leg.lineTo(-.125,0);
  const lgg=new T.ExtrudeGeometry(leg,{depth:.026,bevelEnabled:true,bevelThickness:.003,bevelSize:.003,bevelSegments:q.lo?1:2,curveSegments:q.lo?8:14});
  for(const s of[-1,1])b.geom(lgg,new T.Matrix4().makeRotationY(PI/2).setPosition(s*.19-.013,0,0),{col:[.86,.84,.84]});lgg.dispose();
  b.box(0,.012,0,.4,.016,.03,"x",{col:[.8,.78,.78],us:1,vs:1,ch:.004});
  const me=new T.Mesh(res.geo(b.build()),m);me.castShadow=true;me.receiveShadow=true;g.add(me);g.userData={update(){},dispose(){res.dispose();}};return g;}

function makeShibagaki(opts){opts=opts||{};const q=QL(opts),res=new Res(),rng=RNG(901+Math.round((opts.length||4)*10));const Lx=opts.length!=null?opts.length:4,Hy=opts.height!=null?opts.height:1.1;
  const g=new T.Group();g.name="TsureShibagaki";const W0=res.sh("wood"+q.ts,()=>genWood(q.ts)),BA=res.sh("bamboo"+(q.lo?256:512),()=>genBamboo(q.lo?256:512));
  const mT=res.mat(new T.MeshStandardMaterial({map:W0.map,roughness:.95,vertexColors:true}));const mB=res.mat(new T.MeshStandardMaterial({map:BA.map,roughness:.6,vertexColors:true}));
  /* brush texture (alpha) for the dense core */
  const tc=cv(256,256),tx=tc.getContext("2d");for(let i=0;i<420;i++){const x=rng()*256,w=rng.r(.8,2.6),c=rng.r(.45,.85);tx.strokeStyle=`rgba(${110*c|0},${88*c|0},${64*c|0},1)`;tx.lineWidth=w;
    tx.beginPath();tx.moveTo(x,256);let xx=x;for(let y=256;y>-10;y-=rng.r(20,50)){xx+=rng.r(-3,3);tx.lineTo(xx,y);}tx.stroke();if(rng()<.4){tx.lineWidth=w*.6;tx.beginPath();tx.moveTo(xx,rng()*200);tx.lineTo(xx+rng.r(-20,20),rng()*200);tx.stroke();}}
  const tt=res.tex(mkTex(tc));const mC=res.mat(new T.MeshStandardMaterial({map:tt,alphaTest:.45,side:T.DoubleSide,roughness:.95,color:C(0xd2c2a8)}));
  const cg=new T.PlaneGeometry(Lx,Hy*.96);cg.translate(Lx/2,Hy*.48,0);{const uv=cg.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*Lx/.6,uv.getY(i)*Hy/.6);}
  for(const dz of[-.025,.025]){const m=new T.Mesh(res.geo(dz<0?cg:cg.clone()),mC);m.position.z=dz;m.castShadow=true;m.receiveShadow=true;
    m.customDepthMaterial=res.mat(new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map:tt,alphaTest:.45}));g.add(m);}
  const tw=new GB(),bm=new GB();const n=Math.round(Lx*(q.hi?150:q.md?90:45));
  for(let i=0;i<n;i++){const x=rng()*Lx,z=rng.r(-.05,.05),h=Hy*rng.r(.92,1.1),r=rng.r(.003,.007),lean=rng.r(-.06,.06);const c=tint(rng,[.5,.4,.3],.18);
    const p0=[x,0,z],p1=[x+lean,h,z+rng.r(-.02,.02)];tw.cyl(p0,p1,r,r*.4,q.lo?3:4,{rings:q.lo?[0,1]:[0,.35,.7,1],wob:t=>[.01*Math.sin(t*9+i),.008*Math.sin(t*7+i*.3)],col:c,uo:rng(),vo:rng()});
    if(rng()<.3&&!q.lo){const t=rng.r(.6,.95);const b0=[x+lean*t,h*t,z];tw.cyl(b0,[b0[0]+rng.r(-.12,.12),b0[1]+rng.r(.05,.18),b0[2]+rng.r(-.04,.04)],r*.6,r*.2,3,{col:c});}}
  const nP=Math.max(2,Math.round(Lx/1.8)+1);for(let i=0;i<nP;i++){const x=Lx*i/(nP-1);tw.cyl([x,-.05,0],[x,Hy+.06,0],.04,.036,8,{col:[.4,.34,.28],cap1:true,uo:rng()});}
  for(const y of[.28,.72,Hy-.12])for(const dz of[-.06,.06]){bm.cyl([-.02,y,dz],[Lx+.02,y,dz],.016,.016,8,{col:tint(rng,[.5,.4,.22],.05),cap0:true,cap1:true,us:1,vs:4,uo:rng()});
    for(let x=.15;x<Lx;x+=.45){bm.cyl([x,y-.012,dz*1.15],[x,y+.012,dz*1.15],.02,.02,6,{col:[.2,.15,.1],us:0});}}
  const a=(b,m)=>{const me=new T.Mesh(res.geo(b.build()),m);me.castShadow=true;me.receiveShadow=true;g.add(me);};a(tw,mT);a(bm,mB);
  g.userData={update(){},dispose(){res.dispose();}};return g;}

function makeAkadana(opts){opts=opts||{};const q=QL(opts),res=new Res();const g=new T.Group();g.name="TsureAkadana";const M=woodMats(res,q);
  const BA=res.sh("bamboo"+(q.lo?256:512),()=>genBamboo(q.lo?256:512)),ST=res.sh("stone"+(q.lo?128:256),()=>genStone(q.lo?128:256));
  const B={wood:new GB(),bamboo:new GB(),stone:new GB(),plant:new GB()};const K={B,rng:RNG(511),q};const basin=akadanaInto(K,0,0,false);
  const mats={wood:M.wood,bamboo:res.mat(new T.MeshStandardMaterial({map:BA.map,bumpMap:BA.data,bumpScale:.0006,roughness:.55,vertexColors:true})),
    stone:res.mat(new T.MeshStandardMaterial({map:ST.map,roughness:.95,vertexColors:true})),plant:res.mat(new T.MeshStandardMaterial({roughness:.5,vertexColors:true,side:T.DoubleSide}))};
  for(const k in B){const gg=B[k].build();if(!gg)continue;const me=new T.Mesh(res.geo(gg),mats[k]);me.castShadow=true;me.receiveShadow=true;g.add(me);}
  const wm=new T.Mesh(res.geo(new T.CircleGeometry(.079,24).rotateX(-PI/2)),res.mat(new T.MeshStandardMaterial({color:C(0x1d2a2c),roughness:.06,metalness:.1})));wm.position.set(basin[0],basin[1],basin[2]);g.add(wm);
  const an=new T.Object3D();an.position.set(basin[0],basin[1],basin[2]);g.add(an);g.userData={anchors:{basin:an},update(){},dispose(){res.dispose();}};return g;}

function makeKyoudai(opts){opts=opts||{};const q=QL(opts),res=new Res();const g=new T.Group();g.name="TsureKyoudai";const ramp=res.sh("ramp",genRamp),BK=res.sh("books",genBooks);
  const B={lacq:new GB(),iron:new GB(),plant:new GB(),books:new GB()};const K={B,rng:RNG(611),q};kyoudaiInto(K,0,0,0,0);
  const mats={lacq:res.mat(new T.MeshPhysicalMaterial({color:0xffffff,roughness:.3,clearcoat:.9,clearcoatRoughness:.15,vertexColors:true})),iron:res.mat(new T.MeshStandardMaterial({color:C(0x6a5434),roughness:.5,metalness:.45,vertexColors:true})),
    plant:res.mat(new T.MeshStandardMaterial({roughness:.5,vertexColors:true,side:T.DoubleSide})),books:res.mat(new T.MeshStandardMaterial({map:BK,roughness:.85,vertexColors:true}))};
  for(const k in B){const gg=B[k].build();if(!gg)continue;const me=new T.Mesh(res.geo(gg),mats[k]);me.castShadow=true;me.receiveShadow=true;g.add(me);}
  g.userData={update(){},dispose(){res.dispose();}};return g;}

/* internal: texture preview for tuning (not part of the scene API) */
function _tex(name,size){const f={wood:()=>genWood(size||512),roof:()=>genRoof(size||512),bamboo:()=>genBamboo(size||512),stone:()=>genStone(size||256),tatami:genTatami,earth:()=>genEarth(size||512),
  ajiro:()=>genAjiro(size||512),shoji:genShoji,kana:()=>{const c=genCalligraphy(1024,832);const p=genPaper(1024,832);p.getContext('2d').drawImage(c.ink,0,0);return{c:p};},amida:genAmida,books:genBooks,enza:genEnza,clay:genClay,leaf:genLeaf}[name];if(!f)return null;const v=f();const o={};
  if(v.isTexture)o.map=v.image;else{if(v.map)o.map=v.map.image;if(v.data)o.data=v.data.image;if(v.c)o.map=v.c;}return o;}
return{makeAn,makeFuzukue,makeToudai,makeEnza,makeKyousoku,makeShibagaki,makeAkadana,makeKyoudai,_tex};
})();
