/* tsurezure-figures.js — 徒然草 第七段 人物（兼好・老人・孫） — API doc is finalized at the end of development. */
const TSURE_FIGURES=(()=>{
"use strict";
// =====================================================================================
//  0. small math / rng / noise
// =====================================================================================
const sq=Math.sqrt,mx=Math.max,mn=Math.min,ab=Math.abs,PI=Math.PI;
function clamp(v,a,b){return v<a?a:v>b?b:v;}
function sstep(a,b,v){const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);}
function lerp(a,b,t){return a+(b-a)*t;}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function makeNoise(seed){
  const rnd=mulberry32(seed);const P=new Uint16Array(512);const V=new Float32Array(256);
  const perm=[];for(let i=0;i<256;i++)perm.push(i);
  for(let i=255;i>0;i--){const j=(rnd()*(i+1))|0;const t=perm[i];perm[i]=perm[j];perm[j]=t;}
  for(let i=0;i<512;i++)P[i]=perm[i&255];for(let i=0;i<256;i++)V[i]=rnd()*2-1;
  return function(x,y,z){
    const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z);
    const xf=x-xi,yf=y-yi,zf=z-zi;
    const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),w=zf*zf*(3-2*zf);
    const X=xi&255,Y=yi&255,Z=zi&255;
    const a=P[X]+Y,aa=P[a]+Z,ab_=P[a+1]+Z,b=P[X+1]+Y,ba=P[b]+Z,bb=P[b+1]+Z;
    const c000=V[P[aa]],c100=V[P[ba]],c010=V[P[ab_]],c110=V[P[bb]],c001=V[P[aa+1]],c101=V[P[ba+1]],c011=V[P[ab_+1]],c111=V[P[bb+1]];
    const x00=c000+(c100-c000)*u,x10=c010+(c110-c010)*u,x01=c001+(c101-c001)*u,x11=c011+(c111-c011)*u;
    const y0=x00+(x10-x00)*v,y1=x01+(x11-x01)*v;
    return y0+(y1-y0)*w;
  };
}
const N1=makeNoise(1301),N2=makeNoise(7717),N3=makeNoise(4242);
function fbm(x,y,z,oct){let s=0,a=.5,f=1;for(let i=0;i<oct;i++){s+=a*N1(x*f,y*f,z*f);f*=2.03;a*=.5;}return s;}
// colors: sRGB hex -> linear [r,g,b]
function lin(hex){const r=((hex>>16)&255)/255,g=((hex>>8)&255)/255,b=(hex&255)/255;const f=c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);return[f(r),f(g),f(b)];}
function mixc(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
function mulc(a,s){return[a[0]*s,a[1]*s,a[2]*s];}

// =====================================================================================
//  1. SDF sculpting kit  (each node: {f(x,y,z)->signed distance, bs:[cx,cy,cz,R] bounding sphere, k?:blend})
// =====================================================================================
function smin(a,b,k){if(k<=0)return a<b?a:b;const h=k-ab(a-b);return h>0?(a<b?a:b)-h*h*.25/k:(a<b?a:b);}
function smax(a,b,k){return -smin(-a,-b,k);}
function sSphere(c,r){const cx=c[0],cy=c[1],cz=c[2];return{f:(x,y,z)=>{const dx=x-cx,dy=y-cy,dz=z-cz;return sq(dx*dx+dy*dy+dz*dz)-r;},bs:[cx,cy,cz,r],pt:1,pp:[cx,cy,cz,r]};}
// rotation matrix (local->world), Rz*Ry*Rx, row-major 3x3
function rotM(rx,ry,rz){const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
  return[cy*cz,cz*sx*sy-cx*sz,cx*cz*sy+sx*sz, cy*sz,cx*cz+sx*sy*sz,-cz*sx+cx*sy*sz, -sy,cy*sx,cx*cy];}
function mulM(A,B){const C=new Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++){C[i*3+j]=A[i*3]*B[j]+A[i*3+1]*B[3+j]+A[i*3+2]*B[6+j];}return C;}
function apM(M,v){return[M[0]*v[0]+M[1]*v[1]+M[2]*v[2],M[3]*v[0]+M[4]*v[1]+M[5]*v[2],M[6]*v[0]+M[7]*v[1]+M[8]*v[2]];}
function add3(a,b){return[a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function sub3(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function scl3(a,s){return[a[0]*s,a[1]*s,a[2]*s];}
function len3(a){return sq(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);}
function nrm3(a){const l=len3(a)||1;return[a[0]/l,a[1]/l,a[2]/l];}
function dot3(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function cross3(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function lerp3(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
// ellipsoid (IQ bound), optional rotation M (local->world)
function sEll(c,r,M){const cx=c[0],cy=c[1],cz=c[2],rx=r[0],ry=r[1],rz=r[2];
  const f=M?(x,y,z)=>{const px=x-cx,py=y-cy,pz=z-cz;
      const ax=(M[0]*px+M[3]*py+M[6]*pz)/rx,ay=(M[1]*px+M[4]*py+M[7]*pz)/ry,az=(M[2]*px+M[5]*py+M[8]*pz)/rz;
      const k0=sq(ax*ax+ay*ay+az*az),bx=ax/rx,by=ay/ry,bz=az/rz,k1=sq(bx*bx+by*by+bz*bz);return k1>1e-12?k0*(k0-1)/k1:-mn(rx,ry,rz);}
    :(x,y,z)=>{const ax=(x-cx)/rx,ay=(y-cy)/ry,az=(z-cz)/rz;
      const k0=sq(ax*ax+ay*ay+az*az),bx=ax/rx,by=ay/ry,bz=az/rz,k1=sq(bx*bx+by*by+bz*bz);return k1>1e-12?k0*(k0-1)/k1:-mn(rx,ry,rz);};
  return{f,bs:[cx,cy,cz,mx(rx,ry,rz)],pt:M?3:2,pp:M?[cx,cy,cz,rx,ry,rz,M[0],M[1],M[2],M[3],M[4],M[5],M[6],M[7],M[8]]:[cx,cy,cz,rx,ry,rz]};}
// round cone a(r1) -> b(r2)
function sCone(a,b,r1,r2){
  const ax=a[0],ay=a[1],az=a[2];const bax=b[0]-ax,bay=b[1]-ay,baz=b[2]-az;
  const l2=mx(bax*bax+bay*bay+baz*baz,1e-12),rr=r1-r2,a2=l2-rr*rr,il2=1/l2;
  const f=(x,y,z)=>{const pax=x-ax,pay=y-ay,paz=z-az;
    const yy=pax*bax+pay*bay+paz*baz,z_=yy-l2;
    const qx=pax*l2-bax*yy,qy=pay*l2-bay*yy,qz=paz*l2-baz*yy;const x2=qx*qx+qy*qy+qz*qz;
    const y2=yy*yy*l2,z2=z_*z_*l2;const k=(rr>0?1:rr<0?-1:0)*rr*rr*x2;
    if((z_>0?1:z_<0?-1:0)*a2*z2>k)return sq(x2+z2)*il2-r2;
    if((yy>0?1:yy<0?-1:0)*a2*y2<k)return sq(x2+y2)*il2-r1;
    return(sq(x2*a2*il2)+yy*rr)*il2-r1;};
  return{f,bs:[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,sq(l2)/2+mx(r1,r2)],pt:5,pp:[ax,ay,az,bax,bay,baz,l2,rr,a2,il2,r1,r2]};}
function sCap(a,b,r){const ax=a[0],ay=a[1],az=a[2],bx=b[0]-ax,by=b[1]-ay,bz=b[2]-az;const l2=mx(bx*bx+by*by+bz*bz,1e-12);
  return{f:(x,y,z)=>{const px=x-ax,py=y-ay,pz=z-az;let t=(px*bx+py*by+pz*bz)/l2;t=t<0?0:t>1?1:t;const dx=px-bx*t,dy=py-by*t,dz=pz-bz*t;return sq(dx*dx+dy*dy+dz*dz)-r;},
    bs:[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,sq(l2)/2+r],pt:4,pp:[ax,ay,az,bx,by,bz,l2,r]};}
// rounded box: center, half extents, M local->world, rounding radius
function sBox(c,h,M,rr){const cx=c[0],cy=c[1],cz=c[2],hx=h[0]-rr,hy=h[1]-rr,hz=h[2]-rr;
  const f=(x,y,z)=>{let px=x-cx,py=y-cy,pz=z-cz;
    if(M){const lx=M[0]*px+M[3]*py+M[6]*pz,ly=M[1]*px+M[4]*py+M[7]*pz,lz=M[2]*px+M[5]*py+M[8]*pz;px=lx;py=ly;pz=lz;}
    const qx=ab(px)-hx,qy=ab(py)-hy,qz=ab(pz)-hz;const ox=qx>0?qx:0,oy=qy>0?qy:0,oz=qz>0?qz:0;
    return sq(ox*ox+oy*oy+oz*oz)+mn(mx(qx,qy,qz),0)-rr;};
  return{f,bs:[cx,cy,cz,sq(h[0]*h[0]+h[1]*h[1]+h[2]*h[2])]};}
// polyline tube (round cones), smooth-joined with k
function sTube(pts,rad,k){const parts=[];for(let i=0;i<pts.length-1;i++)parts.push(sCone(pts[i],pts[i+1],rad[i],rad[i+1]));return U(parts,k||0);}
// ribbon: polyline pts with per-point outward normals nr; rounded-rectangle cross-section (halfW across, halfT along normal)
function sRibbon(pts,nr,halfW,halfT,rr){const segs=[];
  for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];const t=sub3(b,a);const L=len3(t);const tt=scl3(t,1/L);
    let n=nrm3(lerp3(nr[i],nr[i+1],.5));n=nrm3(sub3(n,scl3(tt,dot3(n,tt))));const w=cross3(tt,n);
    const hw=Array.isArray(halfW)?[halfW[i],halfW[i+1]]:[halfW,halfW];segs.push({a,tt,n,w,L,hw});}
  const f=(x,y,z)=>{let best=1e9;
    for(const g of segs){const px=x-g.a[0],py=y-g.a[1],pz=z-g.a[2];const u=px*g.tt[0]+py*g.tt[1]+pz*g.tt[2];
      const uc=u<0?u:u>g.L?u-g.L:0;const fr=clamp(u/g.L,0,1);const hw=g.hw[0]+(g.hw[1]-g.hw[0])*fr;
      const qa=ab(px*g.w[0]+py*g.w[1]+pz*g.w[2])-(hw-rr),qn=ab(px*g.n[0]+py*g.n[1]+pz*g.n[2])-(halfT-rr),qu=ab(uc);
      const ox=qa>0?qa:0,oy=qn>0?qn:0;const d=sq(ox*ox+oy*oy+qu*qu)+mn(mx(qa,qn),0)-rr;if(d<best)best=d;}
    return best;};
  const bb=encl(pts.map(p=>({bs:[p[0],p[1],p[2],0]})));bb[3]+=(Array.isArray(halfW)?mx(...halfW):halfW)+halfT;return{f,bs:bb};}
function encl(list){let x0=1e9,y0=1e9,z0=1e9,x1=-1e9,y1=-1e9,z1=-1e9;
  for(const c of list){const b=c.bs;x0=mn(x0,b[0]-b[3]);y0=mn(y0,b[1]-b[3]);z0=mn(z0,b[2]-b[3]);x1=mx(x1,b[0]+b[3]);y1=mx(y1,b[1]+b[3]);z1=mx(z1,b[2]+b[3]);}
  const cx=(x0+x1)/2,cy=(y0+y1)/2,cz=(z0+z1)/2;let R=0;
  for(const c of list){const b=c.bs;const d=sq((b[0]-cx)**2+(b[1]-cy)**2+(b[2]-cz)**2)+b[3];if(d>R)R=d;}
  return[cx,cy,cz,R];}
// monomorphic primitive evaluator (avoids megamorphic closure calls in hot loops)
function primEval(t,q,o,x,y,z){
  if(t===1){const dx=x-q[o],dy=y-q[o+1],dz=z-q[o+2];return sq(dx*dx+dy*dy+dz*dz)-q[o+3];}
  if(t===2){const rx=q[o+3],ry=q[o+4],rz=q[o+5];const ax=(x-q[o])/rx,ay=(y-q[o+1])/ry,az=(z-q[o+2])/rz;
    const k0=sq(ax*ax+ay*ay+az*az),bx=ax/rx,by=ay/ry,bz=az/rz,k1=sq(bx*bx+by*by+bz*bz);return k1>1e-12?k0*(k0-1)/k1:-mn(rx,ry,rz);}
  if(t===3){const px=x-q[o],py=y-q[o+1],pz=z-q[o+2],rx=q[o+3],ry=q[o+4],rz=q[o+5];
    const ax=(q[o+6]*px+q[o+9]*py+q[o+12]*pz)/rx,ay=(q[o+7]*px+q[o+10]*py+q[o+13]*pz)/ry,az=(q[o+8]*px+q[o+11]*py+q[o+14]*pz)/rz;
    const k0=sq(ax*ax+ay*ay+az*az),bx=ax/rx,by=ay/ry,bz=az/rz,k1=sq(bx*bx+by*by+bz*bz);return k1>1e-12?k0*(k0-1)/k1:-mn(rx,ry,rz);}
  if(t===4){const px=x-q[o],py=y-q[o+1],pz=z-q[o+2],bx=q[o+3],by=q[o+4],bz=q[o+5];let tt=(px*bx+py*by+pz*bz)/q[o+6];tt=tt<0?0:tt>1?1:tt;
    const dx=px-bx*tt,dy=py-by*tt,dz=pz-bz*tt;return sq(dx*dx+dy*dy+dz*dz)-q[o+7];}
  // t===5 round cone
  const pax=x-q[o],pay=y-q[o+1],paz=z-q[o+2],bax=q[o+3],bay=q[o+4],baz=q[o+5],l2=q[o+6],rr=q[o+7],a2=q[o+8],il2=q[o+9],r1=q[o+10],r2=q[o+11];
  const yy=pax*bax+pay*bay+paz*baz,z_=yy-l2;const qx=pax*l2-bax*yy,qy=pay*l2-bay*yy,qz=paz*l2-baz*yy;const x2=qx*qx+qy*qy+qz*qz;
  const y2=yy*yy*l2,z2=z_*z_*l2;const k=(rr>0?1:rr<0?-1:0)*rr*rr*x2;
  if((z_>0?1:z_<0?-1:0)*a2*z2>k)return sq(x2+z2)*il2-r2;
  if((yy>0?1:yy<0?-1:0)*a2*y2<k)return sq(x2+y2)*il2-r1;
  return(sq(x2*a2*il2)+yy*rr)*il2-r1;}
function packPrims(list){const n=list.length;const PT=new Int8Array(n),PO=new Int32Array(n);let tot=0;for(const c of list)tot+=c.pt?c.pp.length:0;const PQ=new Float64Array(mx(tot,1));let o=0;
  for(let i=0;i<n;i++){const c=list[i];if(c.pt){PT[i]=c.pt;PO[i]=o;PQ.set(c.pp,o);o+=c.pp.length;}else PT[i]=0;}return{PT,PO,PQ};}
// smooth union (child.k overrides k)
function U(list,k){list=list.filter(Boolean);const n=list.length;const K=new Float64Array(n),B=new Float64Array(n*4),F=[];
  for(let i=0;i<n;i++){K[i]=list[i].k!=null?list[i].k:(k||0);for(let j=0;j<4;j++)B[i*4+j]=list[i].bs[j];F.push(list[i].f);}
  const f=(x,y,z)=>{let d=1e9;
    for(let i=0;i<n;i++){const i4=i*4,dx=x-B[i4],dy=y-B[i4+1],dz=z-B[i4+2],kk=K[i];
      const lim=d+kk+B[i4+3];if(lim>0&&dx*dx+dy*dy+dz*dz>lim*lim)continue;
      const di=F[i](x,y,z);
      if(kk<=0){if(di<d)d=di;}else{const h=kk-ab(d-di);d=h>0?(d<di?d:di)-h*h*.25/kk:(d<di?d:di);}}
    return d;};
  return{f,bs:n?encl(list):[0,0,0,0]};}
// smooth subtraction
function S(base,cutters,k){cutters=cutters.filter(Boolean);const n=cutters.length;const K=cutters.map(c=>c.k!=null?c.k:(k||0));const bf=base.f;
  const f=(x,y,z)=>{let d=bf(x,y,z);
    for(let i=0;i<n;i++){const c=cutters[i],b=c.bs,kk=K[i];const dx=x-b[0],dy=y-b[1],dz=z-b[2];
      const lim=-d+kk+b[3];if(lim>0&&dx*dx+dy*dy+dz*dz>lim*lim)continue;
      d=smax(d,-c.f(x,y,z),kk);}
    return d;};
  return{f,bs:base.bs};}
function Isect(a,b,k){const fa=a.f,fb=b.f;return{f:(x,y,z)=>smax(fa(x,y,z),fb(x,y,z),k||0),bs:a.bs};}
// displacement (outward = positive disp)
function D(child,disp,amp){const cf=child.f;const lim=amp*1.6+.004;
  return{f:(x,y,z)=>{const d=cf(x,y,z);if(d>lim||d<-lim)return d;return d-disp(x,y,z,d)*sstep(lim,lim*.6,ab(d));},bs:[child.bs[0],child.bs[1],child.bs[2],child.bs[3]+amp]};}
// rigid transform: node defined in local frame; M local->world rotation, t world translation
function T(child,M,t){const cf=child.f;const tx=t[0],ty=t[1],tz=t[2];
  const f=(x,y,z)=>{const px=x-tx,py=y-ty,pz=z-tz;return cf(M[0]*px+M[3]*py+M[6]*pz,M[1]*px+M[4]*py+M[7]*pz,M[2]*px+M[5]*py+M[8]*pz);};
  const b=child.bs;const w=apM(M,b);return{f,bs:[w[0]+tx,w[1]+ty,w[2]+tz,b[3]],k:child.k};}
function K(node,k){node.k=k;return node;}
function mirrorX(node){const cf=node.f;const b=node.bs;return{f:(x,y,z)=>cf(-x,y,z),bs:[-b[0],b[1],b[2],b[3]],k:node.k};}

// =====================================================================================
//  2. polygonizer: hierarchical narrow band + surface nets (+ newton projection, gradient normals)
// =====================================================================================
const EDG=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
// edges as (axis, corner offsets) for neighbour tracking
const EDGA=[];for(let ax=0;ax<3;ax++)for(let o1=0;o1<2;o1++)for(let o2=0;o2<2;o2++)EDGA.push([ax,o1,o2]);
let POLY_STATS={evals:0};
function polygonize(F0,bmin,bmax,h,opt){opt=opt||{};
  let evals=0;const F=(x,y,z)=>{evals++;return F0(x,y,z);};
  const Lip=opt.lip||1.2,L=opt.levels!=null?opt.levels:3,ST=1<<L;
  const ncx=Math.ceil((bmax[0]-bmin[0])/h/ST),ncy=Math.ceil((bmax[1]-bmin[1])/h/ST),ncz=Math.ceil((bmax[2]-bmin[2])/h/ST);
  const NX=ncx*ST+1,NY=ncy*ST+1,NZ=ncz*ST+1;
  const ox=(bmin[0]+bmax[0])/2-(NX-1)*h/2,oy=(bmin[1]+bmax[1])/2-(NY-1)*h/2,oz=(bmin[2]+bmax[2])/2-(NZ-1)*h/2;
  const NXY=NX*NY;const val=new Float32Array(NX*NY*NZ).fill(NaN);
  const ev=(i,j,k)=>{const id=i+NX*j+NXY*k;let v=val[id];if(v!==v){v=F(ox+i*h,oy+j*h,oz+k*h);val[id]=v;}return v;};
  let cells=[];
  // a cell of size s contains surface only if some corner is within half-diagonal (exact SDF); Lip pads for inexact fields
  const testCell=(i,j,k,s,fin)=>{const thr=s*h*.8660254*Lip;let neg=false,pos=false,m=1e9;
    for(let c=0;c<8;c++){const v=ev(i+(c&1?s:0),j+(c&2?s:0),k+(c&4?s:0));if(v<0)neg=true;else pos=true;const a=v<0?-v:v;if(a<m)m=a;}
    return fin?(neg&&pos):((neg&&pos)||m<thr);};
  for(let k=0;k<NZ-1;k+=ST)for(let j=0;j<NY-1;j+=ST)for(let i=0;i<NX-1;i+=ST)if(testCell(i,j,k,ST,false))cells.push(i,j,k);
  const stopS=opt.seedS||2;
  for(let s=ST>>1;s>=stopS;s>>=1){const nc=[];
    for(let c=0;c<cells.length;c+=3){const i0=cells[c],j0=cells[c+1],k0=cells[c+2];
      for(let q=0;q<8;q++){const i=i0+(q&1?s:0),j=j0+(q&2?s:0),k=k0+(q&4?s:0);if(testCell(i,j,k,s,false))nc.push(i,j,k);}}
    cells=nc;}
  const CX=NX-1,CY=NY-1,CZ=NZ-1,CXY=CX*CY;const vid=new Int32Array(CX*CY*CZ).fill(-1);const vis=new Uint8Array(CX*CY*CZ);
  const P=[],VC=[],VF=[];let nv=0;const cv=new Float64Array(8);const queue=[];
  const makeVert=(i,j,k)=>{const cid=i+CX*j+CXY*k;if(vid[cid]>=0)return vid[cid];
    let neg=false,pos=false;
    for(let c=0;c<8;c++){const v=ev(i+(c&1),j+(c>>1&1),k+(c>>2&1));cv[c]=v;if(v<0)neg=true;else pos=true;}
    if(!(neg&&pos))return -1;
    let sx=0,sy=0,sz=0,cnt=0;
    for(let e=0;e<12;e++){const a=EDG[e][0],b=EDG[e][1];const va=cv[a],vb=cv[b];if((va<0)===(vb<0))continue;
      const t=va/(va-vb);sx+=(a&1)+((b&1)-(a&1))*t;sy+=(a>>1&1)+((b>>1&1)-(a>>1&1))*t;sz+=(a>>2&1)+((b>>2&1)-(a>>2&1))*t;cnt++;}
    P.push(ox+(i+sx/cnt)*h,oy+(j+sy/cnt)*h,oz+(k+sz/cnt)*h);VC.push(i,j,k);VF.push(sx/cnt,sy/cnt,sz/cnt);vid[cid]=nv;return nv++;};
  const visit=(i,j,k)=>{if(i<0||j<0||k<0||i>=CX||j>=CY||k>=CZ)return;const cid=i+CX*j+CXY*k;if(vis[cid])return;vis[cid]=1;
    if(makeVert(i,j,k)>=0)queue.push(i,j,k);};
  // seeds: along every edge (of active stopS-cells) whose end signs differ, locate the fine sign change and visit its 4 cells
  const S2=stopS;
  for(let c=0;c<cells.length;c+=3){const i0=cells[c],j0=cells[c+1],k0=cells[c+2];
    for(let e=0;e<12;e++){const ax=EDGA[e][0],o1=EDGA[e][1]*S2,o2=EDGA[e][2]*S2;
      let pi=i0,pj=j0,pk=k0;if(ax===0){pj+=o1;pk+=o2;}else if(ax===1){pi+=o1;pk+=o2;}else{pi+=o1;pj+=o2;}
      let prev=ev(pi,pj,pk);
      for(let t=1;t<=S2;t++){const qi=pi+(ax===0?t:0),qj=pj+(ax===1?t:0),qk=pk+(ax===2?t:0);const cur=ev(qi,qj,qk);
        if((prev<0)!==(cur<0)){const si=ax===0?qi-1:qi,sj=ax===1?qj-1:qj,sk=ax===2?qk-1:qk;
          for(let p1=-1;p1<=0;p1++)for(let p2=-1;p2<=0;p2++){if(ax===0)visit(si,sj+p1,sk+p2);else if(ax===1)visit(si+p1,sj,sk+p2);else visit(si+p1,sj+p2,sk);}
          break;}
        prev=cur;}}}
  // flood along sign-change edges
  const vcell=[];
  for(let qi=0;qi<queue.length;qi+=3){const i=queue[qi],j=queue[qi+1],k=queue[qi+2];vcell.push(i,j,k);
    for(let e=0;e<12;e++){const ax=EDGA[e][0],o1=EDGA[e][1],o2=EDGA[e][2];
      let a0,a1,b0,b1;// edge endpoints
      if(ax===0){a0=ev(i,j+o1,k+o2);a1=ev(i+1,j+o1,k+o2);}else if(ax===1){a0=ev(i+o1,j,k+o2);a1=ev(i+o1,j+1,k+o2);}else{a0=ev(i+o1,j+o2,k);a1=ev(i+o1,j+o2,k+1);}
      if((a0<0)===(a1<0))continue;
      for(let p1=-1;p1<=0;p1++)for(let p2=-1;p2<=0;p2++){
        if(ax===0)visit(i,j+o1+p1,k+o2+p2);else if(ax===1)visit(i+o1+p1,j,k+o2+p2);else visit(i+o1+p1,j+o2+p2,k);}}}
  const idx=[];
  const quad=(a,b,c,d,flip)=>{if(a<0||b<0||c<0||d<0)return;
    if(flip){const t=b;b=d;d=t;}
    const d1=(P[a*3]-P[c*3])**2+(P[a*3+1]-P[c*3+1])**2+(P[a*3+2]-P[c*3+2])**2,d2=(P[b*3]-P[d*3])**2+(P[b*3+1]-P[d*3+1])**2+(P[b*3+2]-P[d*3+2])**2;
    if(d1<=d2)idx.push(a,b,c,a,c,d);else idx.push(a,b,d,b,c,d);};
  const gv=(i,j,k)=>(i<0||j<0||k<0)?-1:vid[i+CX*j+CXY*k];
  for(let c=0;c<vcell.length;c+=3){const i=vcell[c],j=vcell[c+1],k=vcell[c+2];const v0=ev(i,j,k);
    if(j>0&&k>0){const v1=ev(i+1,j,k);if((v0<0)!==(v1<0))quad(gv(i,j,k),gv(i,j,k-1),gv(i,j-1,k-1),gv(i,j-1,k),v0<0);}
    if(i>0&&k>0){const v1=ev(i,j+1,k);if((v0<0)!==(v1<0))quad(gv(i,j,k),gv(i-1,j,k),gv(i-1,j,k-1),gv(i,j,k-1),v0<0);}
    if(i>0&&j>0){const v1=ev(i,j,k+1);if((v0<0)!==(v1<0))quad(gv(i,j,k),gv(i,j-1,k),gv(i-1,j-1,k),gv(i-1,j,k),v0<0);}}
  const n=P.length/3;const pos=new Float32Array(P);const nrm=new Float32Array(n*3);const e=h*.3,refine=opt.refine!=null?opt.refine:0;
  const nmode=opt.normals||"grid",meshN=nmode==="mesh"||nmode==="grid";
  if(nmode==="grid"){// central differences on the grid, trilinear at the vertex
    const gr=new Float64Array(24);const ci=(a,lo,hi)=>a<lo?lo:a>hi?hi:a;
    for(let v=0;v<n;v++){const i=VC[v*3],j=VC[v*3+1],k=VC[v*3+2],fx=VF[v*3],fy=VF[v*3+1],fz=VF[v*3+2];
      for(let c=0;c<8;c++){const a=i+(c&1),b=j+(c>>1&1),d=k+(c>>2&1);
        gr[c*3]=ev(ci(a+1,0,NX-1),b,d)-ev(ci(a-1,0,NX-1),b,d);gr[c*3+1]=ev(a,ci(b+1,0,NY-1),d)-ev(a,ci(b-1,0,NY-1),d);gr[c*3+2]=ev(a,b,ci(d+1,0,NZ-1))-ev(a,b,ci(d-1,0,NZ-1));}
      let gx=0,gy=0,gz=0;for(let c=0;c<8;c++){const w=(c&1?fx:1-fx)*(c>>1&1?fy:1-fy)*(c>>2&1?fz:1-fz);gx+=w*gr[c*3];gy+=w*gr[c*3+1];gz+=w*gr[c*3+2];}
      const l=sq(gx*gx+gy*gy+gz*gz)||1;nrm[v*3]=gx/l;nrm[v*3+1]=gy/l;nrm[v*3+2]=gz/l;}}
  for(let v=0;v<n&&(refine>0||nmode==="grad");v++){let x=pos[v*3],y=pos[v*3+1],z=pos[v*3+2];const x0=x,y0=y,z0=z;let gx=0,gy=1,gz=0;
    for(let it=0;it<=refine;it++){if(meshN&&it===refine)break;
      const a=F(x+e,y-e,z-e),b=F(x-e,y-e,z+e),c=F(x-e,y+e,z-e),d=F(x+e,y+e,z+e);
      gx=(a-b-c+d)/(4*e);gy=(-a-b+c+d)/(4*e);gz=(-a+b-c+d)/(4*e);const g2=gx*gx+gy*gy+gz*gz||1e-12;
      if(it===refine){const gl=sq(g2);gx/=gl;gy/=gl;gz/=gl;break;}
      const dv=(a+b+c+d)*.25/g2;x-=gx*dv;y-=gy*dv;z-=gz*dv;
      const ddx=x-x0,ddy=y-y0,ddz=z-z0,dl=sq(ddx*ddx+ddy*ddy+ddz*ddz);if(dl>h*.6){const s=h*.6/dl;x=x0+ddx*s;y=y0+ddy*s;z=z0+ddz*s;}}
    pos[v*3]=x;pos[v*3+1]=y;pos[v*3+2]=z;if(nmode==="grad"){nrm[v*3]=gx;nrm[v*3+1]=gy;nrm[v*3+2]=gz;}}
  if(nmode==="mesh"){nrm.fill(0);for(let i=0;i<idx.length;i+=3){const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3;
      const ux=pos[b]-pos[a],uy=pos[b+1]-pos[a+1],uz=pos[b+2]-pos[a+2],vx=pos[c]-pos[a],vy=pos[c+1]-pos[a+1],vz=pos[c+2]-pos[a+2];
      const cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;
      nrm[a]+=cx;nrm[a+1]+=cy;nrm[a+2]+=cz;nrm[b]+=cx;nrm[b+1]+=cy;nrm[b+2]+=cz;nrm[c]+=cx;nrm[c+1]+=cy;nrm[c+2]+=cz;}
    for(let v=0;v<n;v++){const l=sq(nrm[v*3]**2+nrm[v*3+1]**2+nrm[v*3+2]**2)||1;nrm[v*3]/=l;nrm[v*3+1]/=l;nrm[v*3+2]/=l;}}
  POLY_STATS.evals+=evals;
  return{pos,nrm,idx:n>65535?new Uint32Array(idx):new Uint16Array(idx),n,evals};
}
// ambient occlusion from an SDF (G = combined scene), per vertex
function bakeAO(poly,G,step,cnt,str){const n=poly.n,p=poly.pos,q=poly.nrm,ao=new Float32Array(n);
  for(let v=0;v<n;v++){const x=p[v*3],y=p[v*3+1],z=p[v*3+2],nx=q[v*3],ny=q[v*3+1],nz=q[v*3+2];let occ=0,w=1,ws=0;
    for(let i=1;i<=cnt;i++){const d=step*i;const s=G(x+nx*d,y+ny*d,z+nz*d);occ+=w*mx(0,d-s)/d;ws+=w;w*=.7;}
    ao[v]=clamp(1-str*occ/ws,0,1);}
  return ao;}
// per-vertex paint: fn(x,y,z,nx,ny,nz,i) -> [r,g,b] linear
function paint(poly,fn,ao,aoMin){const n=poly.n,p=poly.pos,q=poly.nrm,col=new Float32Array(n*3);aoMin=aoMin==null?0:aoMin;
  for(let v=0;v<n;v++){const c=fn(p[v*3],p[v*3+1],p[v*3+2],q[v*3],q[v*3+1],q[v*3+2],v);const a=ao?aoMin+(1-aoMin)*ao[v]:1;
    col[v*3]=c[0]*a;col[v*3+1]=c[1]*a;col[v*3+2]=c[2]*a;}
  poly.col=col;return col;}
function toGeom(poly){const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.BufferAttribute(poly.pos,3));g.setAttribute("normal",new THREE.BufferAttribute(poly.nrm,3));
  if(poly.col)g.setAttribute("color",new THREE.BufferAttribute(poly.col,3));
  if(poly.uv)g.setAttribute("uv",new THREE.BufferAttribute(poly.uv,2));
  g.setIndex(new THREE.BufferAttribute(poly.idx,1));g.computeBoundingSphere();return g;}

// =====================================================================================
//  3. resource tracking (per figure) & materials
// =====================================================================================
function Res(){const L=[];return{add(o){L.push(o);return o;},dispose(){for(const o of L){try{o.dispose();}catch(e){}}L.length=0;}};}
function canvasTex(R,w,h,draw,opts){const c=document.createElement("canvas");c.width=w;c.height=h;const g=c.getContext("2d");draw(g,w,h);
  const t=new THREE.CanvasTexture(c);t.encoding=opts&&opts.linear?THREE.LinearEncoding:THREE.sRGBEncoding;
  t.wrapS=t.wrapT=opts&&opts.clamp?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.anisotropy=4;t.needsUpdate=true;R.add(t);return t;}
function skinMat(R,o){o=o||{};const m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:o.rough!=null?o.rough:.62,metalness:0});R.add(m);return m;}
function eyeTexture(R,iris){return canvasTex(R,256,256,(g,w,h)=>{
  // polar layout: canvas y = angle from gaze axis (top=center of iris), x = azimuth
  const IR=.163,PU=.056,LIM=.19;// fractions of height (pi)
  for(let y=0;y<h;y++){const a=y/h;let col;
    if(a<PU)col=[8,6,6];
    else if(a<IR){const t=(a-PU)/(IR-PU);const base=iris;col=[base[0]*(0.75+0.5*t),base[1]*(0.75+0.45*t),base[2]*(0.8+0.3*t)];if(t>.82){const k=(t-.82)/.18;col=mixc(col,[20,14,12],k*.85);}}
    else if(a<LIM){const t=(a-IR)/(LIM-IR);col=mixc([120,104,96],[214,204,190],t);}
    else{const t=(a-LIM)/(1-LIM);col=mixc([206,196,184],[180,140,130],sstep(.0,.5,t));}
    g.fillStyle="rgb("+(col[0]|0)+","+(col[1]|0)+","+(col[2]|0)+")";g.fillRect(0,y,w,1);}
  // upper-lid shadow (azimuth 0.75 = up)
  const sg=g.createLinearGradient(0,0,w,0);sg.addColorStop(0,"rgba(40,25,20,0)");sg.addColorStop(.55,"rgba(40,25,20,0)");sg.addColorStop(.75,"rgba(40,25,20,.55)");sg.addColorStop(.95,"rgba(40,25,20,0)");sg.addColorStop(1,"rgba(40,25,20,0)");
  g.fillStyle=sg;g.fillRect(0,h*.10,w,h*.9);
  // iris fibres
  const rnd=mulberry32(99);g.globalAlpha=.25;
  for(let i=0;i<220;i++){const x=rnd()*w;g.strokeStyle=rnd()<.5?"rgba(30,18,10,1)":"rgba(150,105,60,1)";g.lineWidth=1+rnd()*1.5;g.beginPath();g.moveTo(x,h*PU);g.lineTo(x+(rnd()-.5)*4,h*IR*.98);g.stroke();}
  g.globalAlpha=.18;for(let i=0;i<60;i++){const x=rnd()*w;g.strokeStyle="rgba(170,60,50,1)";g.lineWidth=1;g.beginPath();g.moveTo(x,h*.98);g.lineTo(x+(rnd()-.5)*30,h*(LIM+.1+rnd()*.3));g.stroke();}
  g.globalAlpha=1;},{clamp:true});}

// =====================================================================================
//  4. HEAD  (head-local frame: origin = midpoint between ear canals, +Z face forward, +Y up; meters)
// =====================================================================================
// P: {seed, eyeOpenU/L, eyeTilt, gazePitch, gazeYaw, smile, age, thin, ...}
function gauss(d,w){const t=d/w;return t*t>16?0:Math.exp(-t*t);}
function dPoly2(u,v,pts){let best=1e9,bt=0,bs=0,acc=0,tot=0;for(let i=0;i<pts.length-1;i++)tot+=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);
  for(let i=0;i<pts.length-1;i++){const ax=pts[i][0],ay=pts[i][1],bx=pts[i+1][0]-ax,by=pts[i+1][1]-ay,l2=bx*bx+by*by,L=sq(l2);
    let t=((u-ax)*bx+(v-ay)*by)/l2;t=t<0?0:t>1?1:t;const dx=u-ax-bx*t,dy=v-ay-by*t,d=sq(dx*dx+dy*dy);
    if(d<best){best=d;bt=(acc+t*L)/tot;bs=bx*dy-by*dx>0?1:-1;}acc+=L;}
  return[best,bt,bs];}
// shared planar (x,y) facial curves — used by geometry relief AND face textures
function faceCurves(P){
  const smile=P.smile||0,MW=P.mouthW||.0235;
  const ys=x=>-.0481+(.0006+smile*.0016)*(x/MW)*(x/MW);
  const yU=x=>{const t=clamp(x/MW,-1,1);return ys(x)+(P.lipU||.0046)*Math.pow(mx(0,1-t*t),.45)-.0008*gauss(x,.0030)+.0003*gauss(ab(x)-.0042,.0022);};
  const yL=x=>{const t=clamp(x/(MW*.92),-1,1);return ys(x)-(P.lipL||.0062)*Math.pow(mx(0,1-t*t),.6);};
  const W=P.eyeW||.0142,aU=P.eyeOpenU!=null?P.eyeOpenU:.0046,aL=P.eyeOpenL!=null?P.eyeOpenL:.0029,tilt=P.eyeTilt!=null?P.eyeTilt:.10,yc=P.eyeApY||0;
  const EX=.0315,EY=.0245;
  // eye s (-1 right eye at -x, +1 left eye): returns [u (toward temple), yUpper, yLower] at planar x
  const eye=(s,x)=>{const u=(x-s*EX)*s,t=clamp(u/W,-1,1),q=mx(0,1-t*t);
    return[u,EY+yc+aU*Math.pow(q,.55)*(1-.22*t)+tilt*u,EY+yc-aL*Math.pow(q,.7)*(1+.1*t)+tilt*.55*u];};
  const nlf=[[.0195,-.0195],[.0262,-.0350],[.0300,-.0500],[.0335,-.0640]];
  const alar=[[.0098,-.0142],[.0172,-.0150],[.0216,-.0195],[.0210,-.0255],[.0172,-.0290]];
  const brow=t=>{// t 0..1 inner->outer ; returns [x(abs), y]
    const x=.0105+.047*t;return[x,.0425+.0062*Math.sin(clamp(t,0,1)*PI*.85)-(P.browDrop||.010)*t*t];};
  return{ys,yU,yL,MW,eye,W,EX,EY,nlf,alar,brow};
}
// geometric relief: only features >= ~4mm wide (finer detail lives in the face textures)
function faceRelief(P,C){
  const ag=clamp(((P.age!=null?P.age:50)-25)/45,0,1.2),MW=C.MW,kidK=1-.85*(P.kid||0);
  return(x,y,z)=>{const ax=ab(x);let d=-(P.thin||0)*(.0025*gauss(ax-.050,.012)*gauss(y+.036,.016)+.0018*gauss(ax-.068,.010)*gauss(y-.042,.014))*sstep(-.03,.0,z);
    if(z<.045)return d;
    const zw=sstep(.052,.074,z);
    if(y<-.026&&y>-.080&&ax<.05&&zw>0){
      const s=C.ys(x),a=C.yU(x),b=C.yL(x);const ef=sstep(MW+.0010,MW-.0045,ax)*zw;
      if(v_in(y,s-.0005,a+.002)){const t=clamp((y-s)/(a-s),0,1);d+=ef*(P.lipUvol||.0017)*Math.pow(Math.sin(PI*clamp(t*.8+.12,0,1)),.8)*sstep(a+.0022,a-.0006,y);}
      if(v_in(y,b-.002,s+.0005)){const t=clamp((s-y)/(s-b),0,1);d+=ef*(P.lipLvol||.0023)*Math.pow(Math.sin(PI*clamp(t*.75+.15,0,1)),.7)*sstep(b-.0022,b+.0006,y);}
      d-=.0009*gauss(y-s,.0011)*sstep(MW+.003,MW-.002,ax)*zw;
      d-=.0010*gauss(ax-MW-.0006,.0026)*gauss(y-s,.0030)*zw;
      if(y>a-.001&&y<-.0300){const vf=sstep(-.0300,-.0335,y)*sstep(a-.0004,a+.0020,y)*zw;d-=.0005*gauss(x,.0022)*vf;d+=.0003*gauss(ax-.0042,.0017)*vf;}
      d-=(.0009+.0007*ag)*gauss(y-(b-.0092),.0028)*gauss(x,.0125)*zw;
      if(ag>0){const q=dPoly2(ax,y,[[MW+.0008,s-.0015],[MW+.0035,-.067]]);d-=.0007*ag*gauss(q[0],.0022)*(1-q[1]*.6)*zw;}}
    if(y<-.010&&y>-.072&&ax>.008&&ax<.05&&zw>0){
      const q=dPoly2(ax,y,C.nlf);const fade=(1-sstep(.75,1,q[1]))*sstep(0,.1,q[1])*zw*sstep(.050,.040,ax)*sstep(-.072,-.064,y);
      d-=(.0006+.0010*ag)*kidK*gauss(q[0],.0021+.0004*ag)*fade;
      if(q[2]<0)d+=(.0004+.0008*ag)*kidK*gauss(q[0]-.0040,.0038)*fade;
      const r=dPoly2(ax,y,C.alar);d-=.0008*gauss(r[0],.0016)*zw*sstep(.006,.0105,ax)*sstep(-.010,-.013,y);}
    for(const s of[-1,1]){const e=C.eye(s,x);const u=e[0];if(ab(u)<.02&&y>.0&&y<.021&&zw>0){
      d-=(.0003+.0005*ag)*kidK*gauss(y-(e[2]-.0050-.0006*u/.014),.0019)*sstep(.016,.006,ab(u))*zw*sstep(.0,.004,y);
      d-=.0006*ag*gauss(y-(C.EY-.0128+.0035*(u/.014)*(u/.014)),.0022)*sstep(.018,.004,ab(u+.002))*zw*sstep(.0,.004,y)*sstep(.021,.016,y);}}
    return d;};
}
function v_in(v,a,b){return v>a&&v<b;}
function headSDF(P){
  const er=P.eyeR||.0118;const eyes=[[-.0315,.0245,.0735],[.0315,.0245,.0735]];
  const C=faceCurves(P);
  // shape multipliers: cran [sx,sy,sz] & cranOff, jaw, nose, brow, cheekFat, neckR
  const cr=P.cran||[1,1,1],co=P.cranOff||[0,0,0],jw=P.jaw||1,ns=P.nose||1,bw=P.browK||1,nk=P.neckR||1;// browK: brow-ridge size (P.brow is the eyebrow colour)
  const cE=(c,r)=>sEll([c[0]*cr[0]+co[0],c[1]*cr[1]+co[1],c[2]*cr[2]+co[2]],[r[0]*cr[0],r[1]*cr[1],r[2]*cr[2]]);
  const JC=[0,-.020,.050],J=p=>[JC[0]+(p[0]-JC[0])*jw,JC[1]+(p[1]-JC[1])*jw,JC[2]+(p[2]-JC[2])*(1-(1-jw)*.6)];
  const NC=[0,-.010,.092],N=p=>[NC[0]+(p[0]-NC[0])*ns,NC[1]+(p[1]-NC[1])*ns,NC[2]+(p[2]-NC[2])*ns];
  const cran=U([K(cE([0,.044,-.010],[.0765,.084,.095]),0),K(cE([0,.040,.030],[.064,.070,.066]),.035),K(cE([0,.020,-.045],[.068,.064,.058]),.035)]);
  const fp=[K(sEll([0,.004,.050],[.066,.044,.048]),0),K(sEll(J([0,-.047,.040]),[.047*jw,.046*jw,.051]),.03),
    K(sEll(J([0,-.044,.071]),[.030*jw,.022*jw,.031]),.02),K(sEll(J([0,-.080,.081]),[.018*jw,.016*jw,.016*jw]),.018),
    K(sEll(J([0,-.047,.0915]),[.022*jw,.0105,.0085]),.010)];
  for(const s of[-1,1]){
    fp.push(K(sCap(J([s*.0485,-.060,.0]),J([s*.019,-.089,.071]),.0100*jw),.025));
    fp.push(K(sCap(J([s*.0485,-.060,.0]),[s*.058,-.015,-.008],.010),.02));
    fp.push(K(sEll([s*.047,.007,.064],[.023,.013,.019],rotM(0,s*.45,0)),.02));
    fp.push(K(sCap([s*.058,.006,.050],[s*.070,.004,.008],.008),.02));
    fp.push(K(sCap([s*.050,.040,.074],[0,.042,.093],.0085*bw),.02));
    fp.push(K(sEll([s*.034,.001,.078],[.017,.012,.011]),.016));
    fp.push(K(sEll([s*.029,-.027,.081],[.012,.015,.010]),.013));
    if(P.cheekFat)fp.push(K(sEll([s*.036,-.022,.070],[.026*P.cheekFat,.026*P.cheekFat,.020*P.cheekFat]),.02));
  }
  let F=U([cran,K(U(fp),.025)]);
  F=S(F,[K(sEll([-.0185,.0255,.0885],[.0062,.0075,.0065]),.007),K(sEll([.0185,.0255,.0885],[.0062,.0075,.0065]),.007)]);
  const nose=U([K(sCone(N([0,.029,.0905]),N([0,-.007,.1035]),.0058*ns,.0070*ns),0),K(sEll(N([0,-.013,.0915]),[.0120*ns,.0130*ns,.0110*ns]),.008),
    K(sSphere(N([0,-.0165,.1030]),.0093*ns),.004),
    K(sEll(N([-.0140,-.0210,.0930]),[.0062*ns,.0058*ns,.0074*ns]),.0045),K(sEll(N([.0140,-.0210,.0930]),[.0062*ns,.0058*ns,.0074*ns]),.0045),
    K(sCap(N([0,-.0238,.1010]),N([0,-.0296,.0952]),.0033*ns),.0024)]);
  const lids=[];
  for(const ec of eyes){const s=ec[0]<0?-1:1;
    lids.push(K(sSphere(ec,er+.0021),0));
    lids.push(K(sEll([s*.0335,.0330,.0790],[.0140,.0042*(P.hood||1),.0070],rotM(0,0,s*-.08)),.006));
    lids.push(K(sEll([s*.0310,.0140,.0802],[.0105,.0030,.0050]),.004));}
  const neck=U([K(sCone([0,-.035,-.020],[0,-.165,-.008],.049*nk,.052*nk),0),
    K(sCap([-.050*nk,-.040,-.030],[-.012,-.160,.032],.010*nk),.018),K(sCap([.050*nk,-.040,-.030],[.012,-.160,.032],.010*nk),.018),
    K(sEll([0,-.108,.036],[.008,.011,.008*nk]),.012)]);
  F=U([F,K(nose,.006),K(U(lids),.0045),K(neck,.03)]);
  const cuts=[];
  for(const ec of eyes){const s=ec[0]<0?-1:1;
    cuts.push(K(eyeAperture(ec,s,C),.0011));
    cuts.push(K(sEll(N([s*.0080,-.0283,.0950]),[.0029*ns,.0021*ns,.0039*ns],rotM(-.15,s*.40,0)),.0012));}
  F=S(F,cuts);
  F=D(F,faceRelief(P,C),.0030);
  const ears=[];
  for(const s of[-1,1]){const e=earSDF(P);const M=mulM(rotM(0,-.42,0),rotM(-.12,0,0));
    let node=T(e,M,[.0715*cr[0]+co[0]*0,.004+co[1]*.3,-.006+co[2]*.5]);if(s<0)node=mirrorX(node);ears.push(node);}
  F=U([F,K(U(ears),.0035)]);
  return{F,eyes,er,C};
}
function eyeAperture(ec,s,C){const ex=ec[0],ez=ec[2],W=C.W;
  return{f:(x,y,z)=>{const e=C.eye(s,x);return mx(mx(y-e[1],e[2]-y,ab(e[0]+.0004)-W),-(z-ez-.002));},bs:[ex,ec[1],ez+.02,.03]};}
function earSDF(P){
  // ear-local: x outward (thickness), y up, z forward. origin at attachment
  const L=P.earL||1;const sc=v=>[v[0],v[1]*L,v[2]*L];
  const parts=[];
  parts.push(K(sEll([.003,.004*L,-.006*L],[.0042,.031*L,.0165*L]),0));
  // helix rim
  parts.push(K(sTube([sc([.004,.022,.006]),sc([.0062,.031,.000]),sc([.0072,.034,-.010]),sc([.0072,.027,-.020]),sc([.0068,.012,-.0235]),sc([.0062,-.004,-.0215]),sc([.0055,-.016,-.014])],[.0026,.003,.0033,.0034,.0033,.003,.0028]),.0035));
  // lobe
  parts.push(K(sEll(sc([.0035,-.024,-.0055]),[.0042,.0105*L,.0082*L]),.006));
  // antihelix
  parts.push(K(sTube([sc([.0056,.024,-.012]),sc([.0062,.012,-.0145]),sc([.0058,-.002,-.0125]),sc([.005,-.010,-.008])],[.0018,.0024,.0024,.0018]),.003));
  // tragus
  parts.push(K(sEll(sc([.0055,-.005,.0055]),[.003,.0042,.0028]),.003));
  let F=U(parts);
  F=S(F,[K(sEll(sc([.0095,-.004,-.003]),[.0055,.0095*L,.0072*L]),.0028),K(sEll(sc([.0082,.019,-.006]),[.0035,.0055*L,.0065*L]),.002)]);
  return F;}

// ---- broad vertex paint (skin tone, redness, scalp stubble, AO); fine facial detail is in the face textures ----
function headPainter(P,H){
  const skin=lin(P.skin||0xcfa58a),skinR=lin(P.skinRed||0xc98a74),stub=lin(P.stubble||0x5d5f66);
  return(x,y,z,nx,ny,nz,i,fw)=>{
    let c=skin.slice();
    const cheek=Math.exp(-(((ab(x)-.040)/.020)**2+((y+.006)/.022)**2))*(z>.05?1:0);
    const nose=Math.exp(-((x/.012)**2+((y+.016)/.015)**2+((z-.106)/.012)**2));
    const ear=sstep(.062,.075,ab(x))*sstep(.0,.02,-z+.02);
    c=mixc(c,skinR,clamp(cheek*.30+nose*.40+ear*.35,0,1));
    const az=Math.atan2(x,z),aaz=ab(az);
    const yb=aaz<.6?lerp(.090,.074,aaz/.6):aaz<1.15?lerp(.074,.047,(aaz-.6)/.55):aaz<1.55?lerp(.047,.036,(aaz-1.15)/.4):aaz<2.0?lerp(.036,-.008,(aaz-1.55)/.45):lerp(-.008,-.052,(aaz-2.0)/(PI-2.0));
    let hair=sstep(yb-.005,yb+.006,y);if(ab(x)>.066&&y<.045&&y>-.04&&z>-.035&&z<.025)hair=0;
    if(P.scalp==="stubble"){const sp=.6+.4*N2(x*700,y*700,z*700);c=mixc(c,stub,hair*(P.stubAmt||.32)*sp);}
    else if(P.scalp==="hair"){const st=.80+.20*N2(x*90,y*900,z*90)+.08*N1(x*400,y*60,z*400);c=mixc(c,mulc(lin(P.hairC||0xd8d3ca),st),hair*.96);}
    else if(P.scalp==="dark"){c=mixc(c,lin(P.hairC||0x1c1714),hair*.85);}
    if(P.beard==="stubble"){// jaw sides (outside face texture)
      const jaw=sstep(.012,-.010,y)*sstep(-.115,-.092,y)*sstep(-.015,.01,z);const sp=.6+.4*N2(x*900,y*900,z*900);
      c=mixc(c,lin(0x8a8580),jaw*.22*sp*(1-fw));}
    const mo=1+.04*N1(x*260,y*260,z*260)+.03*N3(x*70,y*70,z*70);c=mulc(c,mo);
    return c;};
}
// ---- face textures: color detail (multiplicative, white = neutral) + bump, in planar face space ----
const FX0=-.08,FX1=.08,FY0=-.11,FY1=.08;
function faceTextures(R,P,C){
  const S=1024,X=x=>(x-FX0)/(FX1-FX0)*S,Y=y=>(FY1-y)/(FY1-FY0)*S,PX=S/(FX1-FX0);
  const skin=lin(P.skin||0xcfa58a);
  // ratio color string (target/skin) encoded sRGB, for multiplicative tinting
  const rel=(hex,k)=>{const t=lin(hex);const e=c=>{c=clamp(c,0,1);return Math.round(255*(c<=.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-.055));};
    const r=[t[0]/skin[0],t[1]/skin[1],t[2]/skin[2]].map(v=>1+(v-1)*(k==null?1:k));return"rgb("+e(r[0])+","+e(r[1])+","+e(r[2])+")";};
  const ag=clamp(((P.age!=null?P.age:50)-25)/45,0,1.2);
  const path=(g,f,x0,x1,n)=>{g.beginPath();for(let i=0;i<=n;i++){const x=x0+(x1-x0)*i/n;const y=f(x);if(i)g.lineTo(X(x),Y(y));else g.moveTo(X(x),Y(y));}};
  const soft=(g,draw,w,color,alpha,passes)=>{passes=passes||4;g.strokeStyle=color;g.lineCap="round";g.lineJoin="round";
    for(let i=passes-1;i>=0;i--){g.lineWidth=w*(1+i*.9);g.globalAlpha=alpha*(i===0?1:.28/i);draw();g.stroke();}g.globalAlpha=1;};
  const polyXY=(g,pts,sx)=>{g.beginPath();pts.forEach((p,i)=>{const x=X(p[0]*sx),y=Y(p[1]);if(i)g.lineTo(x,y);else g.moveTo(x,y);});};
  const draw=(g,mode)=>{// mode 0 = color, 1 = bump
    const rnd=mulberry32((P.seed||5)*31+mode);
    g.fillStyle=mode?"rgb(128,128,128)":"#fff";g.fillRect(0,0,S,S);
    // pores / mottling
    for(let i=0;i<(mode?26000:9000);i++){const x=rnd()*S,y=rnd()*S,r=mode?.8+rnd()*1.2:1.5+rnd()*5;
      g.fillStyle=mode?(rnd()<.5?"rgba(100,100,100,.35)":"rgba(160,160,160,.25)"):(rnd()<.6?"rgba(200,150,130,.05)":"rgba(255,235,220,.05)");g.beginPath();g.arc(x,y,r,0,7);g.fill();}
    // ---------- lips ----------
    const MW=C.MW;
    if(!mode){
      g.fillStyle=rel(P.lip||0x9c6156);
      g.save();g.globalAlpha=.9;
      // upper
      g.beginPath();for(let i=0;i<=60;i++){const x=-MW+2*MW*i/60;const y=C.yU(x);if(i)g.lineTo(X(x),Y(y));else g.moveTo(X(x),Y(y));}
      for(let i=60;i>=0;i--){const x=-MW+2*MW*i/60;g.lineTo(X(x),Y(C.ys(x)));}g.closePath();g.shadowColor=g.fillStyle;g.shadowBlur=3;g.fill();
      g.fillStyle=rel(P.lipColL||P.lip||0x9c6156,.85);
      g.beginPath();for(let i=0;i<=60;i++){const x=-MW*.97+2*MW*.97*i/60;const y=C.yL(x);if(i)g.lineTo(X(x),Y(y));else g.moveTo(X(x),Y(y));}
      for(let i=60;i>=0;i--){const x=-MW*.97+2*MW*.97*i/60;g.lineTo(X(x),Y(C.ys(x)));}g.closePath();g.fill();
      g.restore();g.shadowBlur=0;
      // stomion
      soft(g,()=>path(g,C.ys,-MW*1.02,MW*1.02,50),2.2,rel(0x3a201a),.9,3);
      // corners
      for(const sx of[-1,1]){g.fillStyle=rel(0x6a4034,.7);g.globalAlpha=.5;g.beginPath();g.arc(X(sx*MW),Y(C.ys(sx*MW)),5,0,7);g.fill();g.globalAlpha=1;}
    }
    // lip vertical lines (both maps)
    for(let i=0;i<70;i++){const x=(rnd()*2-1)*MW*.9;const up=rnd()<.45;const y0=C.ys(x),y1=up?C.yU(x):C.yL(x);
      g.strokeStyle=mode?"rgba(80,80,80,.5)":rel(0x7a4a40,.6);g.globalAlpha=mode?.6:.25;g.lineWidth=1;g.beginPath();g.moveTo(X(x),Y(lerp(y0,y1,.15)));g.lineTo(X(x+(rnd()-.5)*.001),Y(lerp(y0,y1,.85)));g.stroke();}
    g.globalAlpha=1;
    if(mode){soft(g,()=>path(g,C.ys,-MW,MW,50),2.5,"rgb(40,40,40)",.8,3);}
    // ---------- brows ----------
    for(const sx of[-1,1]){const n=P.browHairs||260;
      for(let i=0;i<n;i++){const t=Math.pow(rnd(),.85);const b=C.brow(t);const w=(.0032-.0016*t)*(P.browW||1);const off=(rnd()-.5)*w;
        const x=sx*b[0],y=b[1]+off;const ang=t<.15?1.2-t*3:.18-.15*t+(rnd()-.5)*.25;// flow up at inner end, then outward
        const L=(.0035+rnd()*.003)*PX;const dx=Math.cos(ang)*L*sx,dy=-Math.sin(ang)*L;
        g.strokeStyle=mode?"rgba(175,175,175,.5)":rel(P.brow||0x3a3431,.95);g.globalAlpha=mode?.5:(.35+.45*rnd())*(P.browAmt||1);g.lineWidth=mode?1.2:1+rnd()*.8;
        g.beginPath();g.moveTo(X(x),Y(y));g.quadraticCurveTo(X(x)+dx*.6,Y(y)+dy*.6-.8,X(x)+dx,Y(y)+dy+.6);g.stroke();}}
    g.globalAlpha=1;
    // ---------- eyes ----------
    for(const s of[-1,1]){
      const xi=s*C.EX-s*C.W,xo=s*C.EX+s*C.W;const x0=mn(xi,xo),x1=mx(xi,xo);
      const up=x=>C.eye(s,x)[1],lo=x=>C.eye(s,x)[2];
      if(!mode){
        // lid pigmentation
        g.save();g.globalAlpha=.16;g.fillStyle=rel(0x8e6a5a);g.beginPath();path(g,x=>up(x)+.0005,x0,x1,30);
        for(let i=30;i>=0;i--){const x=x0+(x1-x0)*i/30;g.lineTo(X(x),Y(up(x)+.0075+.002*Math.sin(PI*i/30)));}g.closePath();g.shadowColor=g.fillStyle;g.shadowBlur=6;g.fill();g.restore();
        // under eye
        g.save();g.globalAlpha=.18*(.5+ag);g.fillStyle=rel(0x8a6050);g.beginPath();path(g,x=>lo(x)-.0006,x0,x1,30);
        for(let i=30;i>=0;i--){const x=x0+(x1-x0)*i/30;g.lineTo(X(x),Y(lo(x)-.006*Math.sin(PI*i/30)-.0008));}g.closePath();g.shadowColor=g.fillStyle;g.shadowBlur=8;g.fill();g.restore();
      }
      // lash line upper (thicker toward outer corner) & lower
      const lash=mode?"rgb(150,150,150)":rel(0x1e1612);
      for(let i=0;i<40;i++){const t0=i/40,t1=(i+1)/40;const xa=lerp(xi,xo,t0),xb=lerp(xi,xo,t1);g.strokeStyle=lash;g.lineCap="round";
        g.globalAlpha=mode?.5:.95;g.lineWidth=(1.6+3.2*Math.sin(PI*clamp(t0*1.1,0,1))*(.55+.45*t0))*(P.lash||1);g.beginPath();g.moveTo(X(xa),Y(up(xa)+.0004));g.lineTo(X(xb),Y(up(xb)+.0004));g.stroke();}
      g.globalAlpha=mode?.3:.45;soft(g,()=>path(g,x=>lo(x)-.0003,x0,x1,24),1.2,lash,mode?.3:.4,2);
      // lid crease (softer at inner corner = epicanthic)
      soft(g,()=>path(g,x=>up(x)+.0052+.0012*Math.sin(PI*clamp((x-x0)/(x1-x0),0,1)),s<0?lerp(x0,x1,.0):lerp(x0,x1,.25),s<0?lerp(x0,x1,.75):x1,24),1.6,mode?"rgb(70,70,70)":rel(0x7a5444),mode?.5:.35,3);
      // crow's feet & under-eye lines
      if(ag>0)for(let k=0;k<4;k++){const ox=s*(C.EX+C.W+.0015),oy=C.EY+.0015;const a=(-.55+k*.38)+(rnd()-.5)*.15;const L=.006+rnd()*.006;
        g.beginPath();g.moveTo(X(ox),Y(oy+Math.sin(a)*.001));g.quadraticCurveTo(X(ox+s*Math.cos(a)*L*.5),Y(oy+Math.sin(a)*L*.5+.0005),X(ox+s*Math.cos(a)*L),Y(oy+Math.sin(a)*L));
        g.strokeStyle=mode?"rgb(70,70,70)":rel(0x8a6050);g.globalAlpha=(mode?.45:.14)*ag;g.lineWidth=mode?2.2:1.6;g.stroke();}
      if(ag>0){g.globalAlpha=1;soft(g,()=>path(g,x=>C.EY-.0115-.0012*Math.cos(PI*(x-s*C.EX)/.024),x0+s*.002,x1+s*.002,20),1.3,mode?"rgb(80,80,80)":rel(0x8a6050),(mode?.45:.30)*ag,3);}
      g.globalAlpha=1;
    }
    // ---------- forehead & glabella ----------
    if(ag>0){for(const ly of[.058,.066,.0745,.083]){const segs=2+((rnd()*2)|0);
        for(let k=0;k<segs;k++){const xa=-.044+rnd()*.03+k*.03,xb=xa+.02+rnd()*.025;
          soft(g,()=>path(g,x=>ly+.0028*Math.cos(x*52)+.0012*Math.sin(x*140+k),xa,mn(xb,.046),20),mode?3.2:2.2,mode?"rgb(70,70,70)":rel(0x8f6652),(mode?.45:.10)*ag,4);}}
      for(const sx of[-1,1])soft(g,()=>{g.beginPath();g.moveTo(X(sx*.0045),Y(.035));g.lineTo(X(sx*.0050),Y(.045));},mode?2.6:2,mode?"rgb(80,80,80)":rel(0x8f6652),(mode?.35:.08)*ag,4);}
    // ---------- nasolabial / marionette ----------
    for(const sx of[-1,1]){soft(g,()=>polyXY(g,C.nlf.slice(0,3),sx),3.5,mode?"rgb(90,90,90)":rel(0x8a5a48),(mode?.30:.10)*(.4+ag),4);
      if(ag>.3)soft(g,()=>{g.beginPath();g.moveTo(X(sx*(MW+.0008)),Y(C.ys(sx*MW)-.0015));g.lineTo(X(sx*(MW+.0035)),Y(-.067));},1.3,mode?"rgb(80,80,80)":rel(0x8a5a48),(mode?.4:.22)*ag,3);
      soft(g,()=>polyXY(g,C.alar,sx),3,mode?"rgb(90,90,90)":rel(0x7a5040),mode?.30:.12,3);}
    // ---------- beard stubble & whiskers ----------
    if(P.beard==="stubble"){
      const dens=(x,y)=>{const ax=ab(x);const mous=gauss(y-(C.yU(x)+.0045),.0035)*gauss(x,.020)*(y>C.yU(x)+.0008?1:0);
        const chin=gauss(y+.082,.014)*gauss(x,.020)*(y<C.yL(x)-.002?1:0);const jaw=sstep(-.06,-.085,y)*sstep(.03,.05,ax)*.7;const lowerlip=gauss(y-(C.yL(x)-.006),.004)*gauss(x,.012)*(y<C.yL(x)-.0015?1:0);
        return clamp(mous*.9+chin*1.0+jaw*.6+lowerlip*.7,0,1);};
      for(let i=0;i<26000;i++){const x=(rnd()*2-1)*.06,y=-.03-rnd()*.075;const d=dens(x,y);if(rnd()>d)continue;
        g.fillStyle=mode?"rgba(170,170,170,.6)":rel(P.stubbleFace||0x6c6762,.85);g.globalAlpha=mode?.5:.55;g.fillRect(X(x),Y(y),1.4,1.4);}
      // sparse whiskers (moustache down-outward, chin downward)
      for(let i=0;i<(P.whiskers||140);i++){const chin=rnd()<.55;let x,y,ang;
        if(chin){x=(rnd()*2-1)*.014;y=-.072-rnd()*.020;ang=-PI/2+(rnd()-.5)*.5+x*20;}else{const sx=rnd()<.5?-1:1;x=sx*(.002+rnd()*.016);y=C.yU(x)+.0015+rnd()*.0045;ang=-PI/2-sx*(.5+rnd()*.5);}
        const L=(.003+rnd()*.006)*PX;g.strokeStyle=mode?"rgba(190,190,190,.6)":rel(P.whiskerC||0x8a8580,.9);g.globalAlpha=mode?.5:.6;g.lineWidth=1;
        g.beginPath();g.moveTo(X(x),Y(y));g.lineTo(X(x)+Math.cos(ang)*L,Y(y)-Math.sin(ang)*L);g.stroke();}
      g.globalAlpha=1;}
    // ---------- age spots ----------
    if(!mode)for(let i=0;i<(P.spots||0);i++){const sx=rnd()<.5?-1:1;const x=sx*(.035+rnd()*.035),y=-.01+rnd()*.07;
      g.fillStyle=rel(0x9a6e52,.6);g.globalAlpha=.35;g.beginPath();g.ellipse(X(x),Y(y),2+rnd()*5,2+rnd()*4,rnd()*3,0,7);g.shadowColor=g.fillStyle;g.shadowBlur=4;g.fill();g.shadowBlur=0;}
    g.globalAlpha=1;
  };
  const map=canvasTex(R,S,S,(g)=>draw(g,0),{clamp:true});
  const bump=canvasTex(R,S,S,(g)=>draw(g,1),{clamp:true,linear:true});
  return{map,bump};
}
function faceSkinMat(R,map,bump,o){o=o||{};
  const m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:o.rough!=null?o.rough:.58,metalness:0,map,bumpMap:bump,bumpScale:o.bumpScale||.0009});
  m.onBeforeCompile=sh=>{
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nattribute float frontW;\nvarying float vFrontW;").replace("#include <begin_vertex>","#include <begin_vertex>\nvFrontW=frontW;");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nvarying float vFrontW;")
      .replace("#include <map_fragment>","#ifdef USE_MAP\n vec4 texelColor=mapTexelToLinear(texture2D(map,vUv));\n diffuseColor.rgb*=mix(vec3(1.0),texelColor.rgb,vFrontW);\n#endif")
      .replace("dHdxy_fwd(), faceDirection","dHdxy_fwd()*vFrontW, faceDirection");};
  m.customProgramCacheKey=()=>"tsureFaceSkin";R.add(m);return m;}
// ---- hair pieces (head-local): long white beard + moustache + bushy brows (roujin) ----
function beardSDF(P){const parts=[];const L=P.beardLen||.13;
  // chin beard: tapering flattened mass from chin downward
  parts.push(K(sEll([0,-.090,.080],[.026,.022,.016]),0));
  parts.push(K(sCone([0,-.095,.080],[0,-.095-L*.55,.084],.020,.014),.02));
  parts.push(K(sCone([0,-.095-L*.55,.084],[0,-.095-L,.080],.014,.004),.015));
  for(const s of[-1,1]){// jaw beard & sideburns
    parts.push(K(sCap([s*.050,-.040,.012],[s*.040,-.072,.050],.0075),.012));parts.push(K(sCap([s*.040,-.072,.050],[s*.016,-.092,.076],.0095),.012));
    // moustache tufts drooping past mouth corners
    parts.push(K(sTube([[s*.003,-.0345,.1005],[s*.014,-.0400,.0990],[s*.025,-.0490,.0920],[s*.030,-.0640,.0860],[s*.031,-.0760,.0840]],[.0040,.0042,.0036,.0026,.0014]),.004));
    // brows: thick, drooping outer ends
    parts.push(K(sTube([[s*.011,.0455,.0950],[s*.026,.0490,.0920],[s*.042,.0470,.0840],[s*.056,.0400,.0720],[s*.062,.0320,.0660]],[.0030,.0040,.0040,.0034,.0018]),.003));}
  let F=U(parts);
  // keep the mouth slit free
  F=S(F,[K(sEll([0,-.0505,.100],[.020,.0042,.012]),.003)]);
  const nz=makeNoise(55);
  F=D(F,(x,y,z)=>{const fl=y<-.07?Math.sin(x*780+nz(x*60,y*20,z*60)*2.2):Math.sin((x*.6+y)*720+nz(x*50,y*50,z*50)*2);return .0011*fl;},.0012);
  return F;}
// tate-eboshi (lacquered gauze cap), head-local
function eboshiSDF(P){const h=P.eboH||.27;
  const parts=[K(sEll([0,.090,-.006],[.0800,.060,.0985]),0),K(sEll([0,.150,-.016],[.066,.075,.088]),.05),K(sEll([0,.090+h*.55,-.032],[.046,h*.30,.076]),.07),
    K(sEll([0,.090+h*.86,-.046],[.032,h*.15,.058]),.05)];
  let F=U(parts);
  // base edge: lower at the back, above the ears
  const base={f:(x,y,z)=>{const a=Math.atan2(x,z),ca=Math.cos(a);const yb=lerp(.026,.074,(ca+1)/2)+.010*Math.sin(ab(a));return yb-y;},bs:[0,.05,0,.2]};
  F=Isect(F,base,.004);
  // front crease (mayu) & side dents
  F=D(F,(x,y,z)=>{let d=0;if(z>.03)d-=.0045*gauss(x,.0045)*sstep(.10,.16,y)*sstep(.36,.28,y);d-=.0025*gauss(ab(x)-.03,.010)*sstep(.20,.26,y)*(z>0?1:0);
      d+=.0007*N1(x*90,y*35,z*90);return d;},.005);
  return F;}
const HEADT={};
function buildHead(R,P,q){
  const H=headSDF(P);
  const h=q==="low"?.0048:q==="medium"?.0036:.0028;
  const key="head|"+JSON.stringify(P)+"|"+q;
  let poly=GEO_CACHE.get(key);
  const tA=performance.now();
  if(!poly){poly=polygonize(H.F.f,[-.105,-.172,-.115],[.105,.140,.135],h,{levels:3,lip:1.2,seedS:4,refine:0,normals:"grid"});poly.fresh=true;}
  else poly={pos:poly.pos,nrm:poly.nrm,idx:poly.idx,n:poly.n,uv:poly.uv,col:poly.col,fw:poly.fw};
  HEADT.poly=performance.now()-tA;
  const n=poly.n,pp=poly.pos,nn=poly.nrm;
  if(poly.fresh){
  // front weight + planar UV
  const fw=new Float32Array(n),uv=new Float32Array(n*2);
  for(let v=0;v<n;v++){const x=pp[v*3],y=pp[v*3+1],z=pp[v*3+2],nz=nn[v*3+2];
    let w=sstep(.18,.45,nz)*sstep(.030,.052,z)*sstep(.078,.066,ab(x))*sstep(-.115,-.100,y);
    fw[v]=w;uv[v*2]=(x-FX0)/(FX1-FX0);uv[v*2+1]=(y-FY0)/(FY1-FY0);}
  poly.uv=uv;poly.fw=fw;
  const ao=bakeAO(poly,H.F.f,.0035,3,1.3);
  const pf=headPainter(P,H);
  paint(poly,(x,y,z,a,b,c,i)=>pf(x,y,z,a,b,c,i,fw[i]),ao,.30);
  GEO_CACHE.set(key,{pos:poly.pos,nrm:poly.nrm,idx:poly.idx,n:poly.n,uv:poly.uv,col:poly.col,fw:poly.fw});}
  const g=R.add(toGeom(poly));g.setAttribute("frontW",new THREE.BufferAttribute(poly.fw,1));
  HEADT.aopaint=performance.now()-tA;
  const tex=faceTextures(R,P,H.C);HEADT.tex=performance.now()-tA;
  const grp=new THREE.Group();
  const mesh=new THREE.Mesh(g,faceSkinMat(R,tex.map,tex.bump,{rough:P.rough}));mesh.castShadow=true;mesh.receiveShadow=true;grp.add(mesh);
  const etex=eyeTexture(R,P.iris||[70,46,30]);
  const em=R.add(new THREE.MeshStandardMaterial({map:etex,roughness:.10,metalness:0}));
  const eg=[];for(const e of H.eyes){const sg=new THREE.SphereGeometry(H.er,28,20);sg.rotateX(PI/2);
    sg.rotateX(-(P.gazePitch||0));sg.rotateY((P.gazeYaw||0));sg.translate(e[0],e[1],e[2]);eg.push(sg);}
  const emesh=new THREE.Mesh(mergeGeoms(R,eg),em);grp.add(emesh);
  const hq=q==="low"?.004:q==="medium"?.003:.0024;
  if(P.beard==="long"){const B=beardSDF(P);const hc=lin(P.hairC||0xd8d3ca);
    const bp=cachePoly("beard|"+q+"|"+(P.beardLen||.13),()=>{const pl=polygonize(B.f,[-.08,-.25,.0],[.08,.065,.125],hq,{levels:3,lip:1.4,seedS:2});
      const ao=bakeAO(pl,(x,y,z)=>mn(B.f(x,y,z),H.F.f(x,y,z)),.004,3,1.2);paint(pl,(x,y,z)=>mulc(hc,.86+.14*N2(x*300,y*80,z*300)-.10*sstep(-.11,-.2,y)),ao,.35);return pl;});
    const bm=new THREE.Mesh(R.add(toGeom(bp)),R.add(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.62,metalness:0})));bm.castShadow=true;bm.receiveShadow=true;grp.add(bm);}
  if(P.eboshi){const E=eboshiSDF(P);
    const ep=cachePoly("eboshi|"+q+"|"+(P.eboH||.27),()=>{const pl=polygonize(E.f,[-.10,0,-.13],[.10,.44,.12],q==="low"?.007:.0045,{levels:3,lip:1.4,seedS:2});
      const ao=bakeAO(pl,(x,y,z)=>mn(E.f(x,y,z),H.F.f(x,y,z)),.008,3,1.0);paint(pl,(x,y,z)=>mulc(lin(0x1a1816),.85+.3*N2(x*60,y*220,z*60)),ao,.4);return pl;});
    const emat=R.add(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.36,metalness:.08}));
    const eb=new THREE.Mesh(R.add(toGeom(ep)),emat);eb.castShadow=true;eb.receiveShadow=true;grp.add(eb);}
  return{group:grp,mesh,H,poly};
}
function mergeGeoms(R,list){let nv=0,ni=0;for(const g of list){nv+=g.attributes.position.count;ni+=g.index?g.index.count:g.attributes.position.count;}
  const pos=new Float32Array(nv*3),nor=new Float32Array(nv*3),uv=list[0].attributes.uv?new Float32Array(nv*2):null,col=list[0].attributes.color?new Float32Array(nv*3):null;
  const idx=nv>65535?new Uint32Array(ni):new Uint16Array(ni);let vo=0,io=0;
  for(const g of list){const n=g.attributes.position.count;pos.set(g.attributes.position.array,vo*3);nor.set(g.attributes.normal.array,vo*3);
    if(uv&&g.attributes.uv)uv.set(g.attributes.uv.array,vo*2);if(col&&g.attributes.color)col.set(g.attributes.color.array,vo*3);
    if(g.index){const a=g.index.array;for(let i=0;i<a.length;i++)idx[io+i]=a[i]+vo;io+=a.length;}else{for(let i=0;i<n;i++)idx[io+i]=vo+i;io+=n;}
    vo+=n;g.dispose();}
  const G=new THREE.BufferGeometry();G.setAttribute("position",new THREE.BufferAttribute(pos,3));G.setAttribute("normal",new THREE.BufferAttribute(nor,3));
  if(uv)G.setAttribute("uv",new THREE.BufferAttribute(uv,2));if(col)G.setAttribute("color",new THREE.BufferAttribute(col,3));
  G.setIndex(new THREE.BufferAttribute(idx,1));G.computeBoundingSphere();return R.add(G);}

// =====================================================================================
//  5. HANDS & FEET
// =====================================================================================
// two-bone IK: shoulder S, target T, lengths a,b, pole direction hint -> elbow
function ik2(S,T,a,b,pole){let d=sub3(T,S);let L=len3(d);const Lc=clamp(L,ab(a-b)+1e-4,a+b-1e-4);const dir=scl3(d,1/L);
  const ca=(a*a+Lc*Lc-b*b)/(2*a*Lc),sa=sq(mx(0,1-ca*ca));let pp=sub3(pole,scl3(dir,dot3(pole,dir)));pp=nrm3(pp);
  const E=add3(S,add3(scl3(dir,a*ca),scl3(pp,a*sa)));return{E,T:L>a+b?add3(S,scl3(dir,a+b-1e-4)):T};}
// basis matrix (local->world) from local Y axis (fwd) and local Z axis hint (dorsal)
function basisYZ(Y,Zh){Y=nrm3(Y);let Z=sub3(Zh,scl3(Y,dot3(Zh,Y)));Z=nrm3(Z);const X=cross3(Y,Z);return[X[0],Y[0],Z[0],X[1],Y[1],Z[1],X[2],Y[2],Z[2]];}
function basisZY(Zf,Yh){Zf=nrm3(Zf);let Y=sub3(Yh,scl3(Zf,dot3(Yh,Zf)));Y=nrm3(Y);const X=cross3(Y,Zf);return[X[0],Y[0],Zf[0],X[1],Y[1],Zf[1],X[2],Y[2],Zf[2]];}
// RIGHT hand, local: origin wrist, +Y fingers, +Z dorsal, thumb toward -X. pose:{curl:[i,m,r,l], spread, thumb:[abd,flex,opp], fl:[[mcp,pip,dip]x4] optional}
const FING=[{m:[-.0238,.092,.002],L:[.040,.024,.019],r:[.0080,.0070,.0060],sp:-.10},{m:[-.0075,.095,.002],L:[.045,.027,.020],r:[.0083,.0073,.0062],sp:-.02},
  {m:[.0088,.091,.001],L:[.042,.026,.019],r:[.0078,.0068,.0058],sp:.06},{m:[.0232,.083,-.001],L:[.033,.020,.017],r:[.0069,.0061,.0053],sp:.15}];
function fingerPts(f,flex,spread){const pts=[f.m];let a=0,p=f.m;const sp=f.sp*(1+spread)+(spread*.06);
  for(let i=0;i<3;i++){a+=flex[i];const dir=[Math.sin(sp)*Math.cos(a),Math.cos(sp)*Math.cos(a),-Math.sin(a)];p=add3(p,scl3(dir,f.L[i]));pts.push(p);}
  return pts;}
function handData(pose){const curl=pose.curl||[.25,.3,.35,.4],spread=pose.spread||0;const fings=[];
  for(let i=0;i<4;i++){const c=curl[i];const fl=pose.fl&&pose.fl[i]?pose.fl[i]:[.20+c*1.25,.25+c*1.55,.12+c*.95];fings.push(fingerPts(FING[i],fl,spread));}
  const th=pose.thumb||[.35,.3,.4];const abd=th[0],fx=th[1],opp=th[2];
  const cmc=[-.020,.020,-.008];
  // metacarpal direction: out (−x) & forward (+y), rotated toward palm (−z) by abd
  let d0=nrm3([-.78*Math.cos(abd),.62,-Math.sin(abd)*.9-.1]);
  const mcp=add3(cmc,scl3(d0,.044));
  // phalanges bend toward palm/fingers: rotate direction toward +x & −z
  const bend=(d,a)=>nrm3([d[0]*Math.cos(a)+Math.sin(a)*(.55+.45*opp),d[1]*Math.cos(a)+.1*Math.sin(a),d[2]*Math.cos(a)-Math.sin(a)*(.6+.3*opp)]);
  const d1=bend(d0,.25+fx*.6),ip=add3(mcp,scl3(d1,.032)),d2=bend(d1,.15+fx*.7),tip=add3(ip,scl3(d2,.025));
  return{fings,thumb:[cmc,mcp,ip,tip]};}
function handSDF(pose,o){o=o||{};const hd=handData(pose);const bony=o.bony||0;
  const parts=[K(sBox([-.001,.052,-.001],[.0315,.043,.0098],null,.0090),0),K(sEll([-.0175,.030,-.0080],[.015,.023,.0108]),.012),
    K(sEll([.0215,.040,-.006],[.0115,.032,.0095]),.010),K(sEll([0,.003,-.001],[.0275,.026,.0175]),.014),K(sCap([0,-.005,0],[0,-.06,0],.0235),.012)];
  for(let i=0;i<4;i++){const P=hd.fings[i],f=FING[i];
    parts.push(K(sTube(P,[f.r[0]*1.06,f.r[0],f.r[1],f.r[2]*.92],.003),.0065));
    parts.push(K(sSphere(add3(P[0],[0,0,.0045]),f.r[0]*.82),.004));
    parts.push(K(sSphere(P[1],f.r[0]*.93+bony*.0006),.002));parts.push(K(sSphere(P[2],f.r[1]*.92+bony*.0005),.002));}
  const T_=hd.thumb;parts.push(K(sTube(T_,[.0125,.0110,.0094,.0080],.003),.010));
  let F=U(parts);
  return{F,hd};}
function nailPaint(hd){// returns fn(x,y,z)-> nail weight (local coords)
  const tips=hd.fings.map((P,i)=>[P[3],nrm3(sub3(P[3],P[2])),FING[i].r[2]]);tips.push([hd.thumb[3],nrm3(sub3(hd.thumb[3],hd.thumb[2])),.0078]);
  return(x,y,z,nx,ny,nz)=>{let w=0;for(const t of tips){const c=sub3(t[0],scl3(t[1],t[2]*1.1));const dx=x-c[0],dy=y-c[1],dz=z-c[2];const d=sq(dx*dx+dy*dy+dz*dz);
      if(d<t[2]*1.6){// dorsal side: normal pointing +z-ish relative to finger
        w=mx(w,sstep(t[2]*1.55,t[2]*1.0,d)*sstep(.2,.6,nz*1.0));}}return w;};}
// RIGHT bare foot, local: origin ankle joint, +Z toes, +Y up, big toe toward +X (medial)
function footSDF(o){o=o||{};const sc=o.scale||1;const parts=[
  K(sEll([0,-.046,-.030],[.030,.027,.034]),0),K(sEll([.004,-.044,.045],[.038,.026,.058]),.03),K(sEll([.008,-.054,.116],[.045,.017,.030]),.025),
  K(sCap([0,-.012,.0],[.006,-.040,.105],.021),.025),K(sCone([0,.0,-.004],[0,.14,-.012],.031,.036),.02),
  K(sSphere([-.027,-.002,-.006],.012),.012),K(sSphere([.024,.004,-.002],.011),.012)];
  const toes=[[.025,.150,.191,.0125],[.007,.146,.176,.0085],[-.008,.140,.168,.0078],[-.021,.133,.158,.0072],[-.033,.124,.146,.0068]];
  for(const t of toes)parts.push(K(sCap([t[0],-.052,t[1]],[t[0]*1.06,-.054,t[2]],t[3]),.004));
  let F=U(parts);F=S(F,[K(sEll([.035,-.074,.050],[.016,.016,.040]),.012)]);
  return F;}

// =====================================================================================
//  6. CLOTH helpers: folds, materials
// =====================================================================================
// hanging folds on a sheet: s = coordinate across folds, y = height; returns displacement
function foldProfile(ph){const s=Math.sin(ph);return s>0?Math.pow(s,.75):-Math.pow(-s,1.5);}
function clothMat(R,o){o=o||{};const m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:o.rough!=null?o.rough:.9,metalness:0});
  if(o.sheen&&THREE.MeshPhysicalMaterial){}R.add(m);return m;}
// ---- fold fields ----
// "fan": folds radiating from apex o in plane (u,v); "hang": vertical folds; each def has bounding sphere (c,R)
function foldField(defs,seed){const nz=makeNoise(seed||17);
  for(const f of defs){if(!f.c){f.c=f.o;f.R=f.r2||f.R||.5;}}
  return(x,y,z)=>{let d=0;
    for(const f of defs){const cx=x-f.c[0],cy=y-f.c[1],cz=z-f.c[2];if(cx*cx+cy*cy+cz*cz>f.R*f.R)continue;
      const w=f.w?f.w(x,y,z):1;if(w<=1e-4)continue;
      const px=x-f.o[0],py=y-f.o[1],pz=z-f.o[2];
      if(f.t==="fan"){const s=px*f.u[0]+py*f.u[1]+pz*f.u[2],t=px*f.v[0]+py*f.v[1]+pz*f.v[2];const r=sq(s*s+t*t);if(r<f.r0||r>f.r2)continue;
        const a=Math.atan2(s,-t);if(f.amin!=null&&(a<f.amin||a>f.amax))continue;
        const A=f.amp*sstep(f.r0,f.r1,r)*sstep(f.r2,f.r2-(f.r2-f.r1)*.5,r)*(f.amin!=null?sstep(f.amin,f.amin+.25,a)*sstep(f.amax,f.amax-.25,a):1);
        const ph=a*f.cnt+(f.pn!=null?f.pn:.45)*nz(a*.9+f.o[0]*3,r*2.2,f.o[2]*4)+r*(f.tw||0);d+=w*A*foldProfile(ph)*(1+.25*nz(a*3,r*6,1.3));}
      else if(f.t==="hang"){const s=px*f.u[0]+py*f.u[1]+pz*f.u[2];const hgt=f.top-y;if(hgt<=0)continue;const A=f.amp*sstep(0,f.full,hgt);
        const ph=2*PI*(s/f.lam+(f.pn!=null?f.pn:.25)*nz(s*3,y*1.2,f.o[0]*3));d+=w*A*foldProfile(ph);}}
    return d;};}
function foldProfile(ph){const s=Math.sin(ph);return s>0?Math.pow(s,.9):-Math.pow(-s,1.25);}
function fanDef(o,u,v,cnt,r0,r1,r2,amp,o2){o2=o2||{};return Object.assign({t:"fan",o,u:nrm3(u),v:nrm3(v),cnt,r0,r1,r2,amp,c:o,R:r2},o2);}
function gw(c,r){return(x,y,z)=>{const dx=x-c[0],dy=y-c[1],dz=z-c[2];return Math.exp(-(dx*dx+dy*dy+dz*dz)/(r*r));};}
// thin cloth sheet: frame o (origin), u (across), v (up-ish), n=u×v; region u∈[ua,ub], v∈[vb(u),vt(u)];
// mid-plane displaced by fold(u,v) along n (bends the sheet, uniform thickness 2*t)
function sSheet(o,u,v,ua,ub,vt,vb,t,fold,rc){u=nrm3(u);v=nrm3(sub3(v,scl3(u,dot3(v,u))));const n=cross3(u,v);rc=rc||.03;
  const f=(x,y,z)=>{const px=x-o[0],py=y-o[1],pz=z-o[2];const uu=px*u[0]+py*u[1]+pz*u[2],vv=px*v[0]+py*v[1]+pz*v[2];
    const ww=px*n[0]+py*n[1]+pz*n[2]-(fold?fold(uu,vv):0);
    const top=vt(uu),bot=vb(uu);const dx=mx(ua-uu,uu-ub)+rc,dy=mx(bot-vv,vv-top)+rc;
    const d2=sq(mx(dx,0)**2+mx(dy,0)**2)+mn(mx(dx,dy),0)-rc;const dw=ab(ww)-t;
    return sq(mx(d2,0)**2+mx(dw,0)**2)+mn(mx(d2,dw),0)-.003;};
  const cu=(ua+ub)/2;const cv=(vt(cu)+vb(cu))/2;const c=add3(o,add3(scl3(u,cu),scl3(v,cv)));
  return{f,bs:[c[0],c[1],c[2],sq((ub-ua)**2+(vt(cu)-vb(cu)+.3)**2)/2+.12],u,v,n};}
// draped heightfield over support capsules (legs), with radial folds and a wavy hem boundary on the floor
// sup: [{a,b,r}] ; o: {floor, th, k, hem:{c:[x,z],rx,rz,waves,wamp,seed}, folds: fn(x,z,h)->dh}
function lapHF(sup,o){const k=o.k||.05,fl=o.floor||0,th=o.th||.012,hm=o.hem,nzh=makeNoise(hm.seed||9);
  const S_=sup.map(q=>{const dx=q.b[0]-q.a[0],dz=q.b[2]-q.a[2];return{ax:q.a[0],az:q.a[2],ay:q.a[1],by:q.b[1],dx,dz,l2:mx(dx*dx+dz*dz,1e-8),r:q.r,sl:q.sl||1.25};});
  const H0=(x,z)=>{let h=fl+th;
    for(const q of S_){let t=((x-q.ax)*q.dx+(z-q.az)*q.dz)/q.l2;t=t<0?0:t>1?1:t;const ex=x-q.ax-q.dx*t,ez=z-q.az-q.dz*t;const d=sq(ex*ex+ez*ez)/q.r;
      const ys=q.ay+(q.by-q.ay)*t;const tent=d<.75?ys+q.r*sq(1-d*d):ys+q.r*(.6614-(d-.75)*q.sl);
      const hh=k-ab(h-tent);h=hh>0?mx(h,tent)+hh*hh*.25/k:mx(h,tent);}
    return h;};
  const hemD=(x,z)=>{const dx=x-hm.c[0],dz=z-hm.c[1];const a=Math.atan2(dz/hm.rz,dx/hm.rx);const q=sq((dx/hm.rx)**2+(dz/hm.rz)**2);
    const wv=hm.wamp*(Math.sin(a*hm.waves+2*nzh(a*1.5,1,2))*.65+.35*nzh(a*4,2,3));return(q-1-wv)*mn(hm.rx,hm.rz)*.85;};
  const e=.004;
  const f=(x,y,z)=>{const dh=hemD(x,z);if(dh>.03)return mx(dh,y-fl-.3);
    const h0=H0(x,z);if(y-h0>.08)return mx(y-h0-.02,dh);
    const gx=(H0(x+e,z)-h0)/e,gz=(H0(x,z+e)-h0)/e;let h=h0+(o.folds?o.folds(x,z,h0):0);
    // hem: cloth lies on the floor near the boundary
    h=lerp(h,fl+th,sstep(-.05,0,dh));
    const dt=(y-h)/sq(1+gx*gx+gz*gz);const db=fl-.002-y;
    const m=mx(dt,db);const rr=.007;const ex=dh+rr,ey=m+rr;return sq(mx(ex,0)**2+mx(ey,0)**2)+mn(mx(ex,ey),0)-rr;};
  return{f,bs:[hm.c[0],.15,hm.c[1],mx(hm.rx,hm.rz)*1.3+.2],H0};}
// wavy hem disc on the floor
function sHem(c,rx,rz,th,waves,wamp,seed){const nz=makeNoise(seed||5);
  return{f:(x,y,z)=>{const dx=x-c[0],dz=z-c[2];const a=Math.atan2(dz/rz,dx/rx);const q=sq((dx/rx)**2+(dz/rz)**2);
      const wv=wamp*(Math.sin(a*waves+2*nz(a*2,1,seed))*.7+.3*nz(a*5,2,3));
      const d2=(q-1-wv)*mn(rx,rz)*.9;const dy=ab(y-c[1])-th*(1-.5*sstep(.85,1.05,q));
      const ox=d2>0?d2:0,oy=dy>0?dy:0;return sq(ox*ox+oy*oy)+mn(mx(d2,dy),0)-.004;},bs:[c[0],c[1],c[2],mx(rx,rz)*(1+wamp)+.05]};}
// =====================================================================================
//  7. KENKO rig / robe
// =====================================================================================
const ARM_U=.285,ARM_F=.245;
// hand pose presets (right-hand local frame)
const HANDP={
  relax:{curl:[.30,.36,.42,.48],spread:.05,thumb:[.35,.35,.35]},
  rest:{curl:[.18,.22,.28,.34],spread:.10,thumb:[.25,.2,.2]},
  brush:{curl:[.45,.62,.95,1.05],spread:-.05,thumb:[.65,.55,.9],fl:[[.55,.55,.35],[.75,.9,.5],[1.3,1.6,.9],[1.4,1.7,.9]]},
  book:{curl:[.15,.12,.15,.2],spread:.18,thumb:[.05,.15,.1]},
  lap:{curl:[.25,.3,.38,.45],spread:.05,thumb:[.3,.3,.3]},
  grasp:{curl:[.75,.85,.9,.95],spread:-.05,thumb:[.6,.6,.8]},
  fan:{curl:[.8,.9,.95,1.0],spread:-.08,thumb:[.55,.45,.85]},
  hold:{curl:[.35,.4,.45,.5],spread:.12,thumb:[.4,.25,.3]},
  reach:{curl:[.08,.06,.08,.1],spread:.35,thumb:[.25,.1,.05]},
};
// colliders the robe must drape over (placed by other modules; approximate)
const DESK={x:.40,top:.315,z0:.255,z1:.60},ARMREST={x0:-.41,x1:-.29,top:.322,z0:-.21,z1:.31};
function kenkoRig(pose,sY){
  const R={pose,sY:pose==="kneel"?0:sY};sY=R.sY;
  let hip=[0,sY+.09,-.03],lean=.05,roll=0,twist=0,hP=.0,hY=0,hR=0,gP=.12;
  if(pose==="write"){lean=.28;hP=.46;gP=.30;}
  else if(pose==="read"){lean=.07;roll=.12;hP=.42;hR=-.07;gP=.30;}
  else if(pose==="gaze"){lean=-.03;hP=-.20;gP=-.06;}
  else if(pose==="kneel"){hip=[0,.29,-.05];lean=.52;hP=.55;gP=.30;}
  const TM=rotM(lean,twist,roll);R.TM=TM;R.hip=hip;
  const tp=v=>add3(hip,apM(TM,v));R.tp=tp;
  R.sh={L:tp([.170,.468,-.030]),R:tp([-.170,.468,-.030])};
  R.pivot=tp([0,.645,.004]);R.headM=mulM(TM,rotM(hP,hY,hR));R.gazeP=gP;
  if(pose==="kneel"){
    R.knee={L:[.105,.055,.235],R:[-.105,.055,.235]};R.ankle={L:[.085,.050,-.135],R:[-.085,.050,-.135]};
    R.hipJ={L:tp([.085,-.005,.02]),R:tp([-.085,-.005,.02])};
  }else{
    R.knee={L:[.300,sY+.025,.235],R:[-.300,sY+.025,.235]};
    R.ankle={L:[-.090,.060,.212],R:[.075,.050,.105]};
    R.hipJ={L:tp([.088,-.005,.02]),R:tp([-.088,-.005,.02])};}
  const A={};
  if(pose==="read"){
    A.L={W:[.080,sY+.330,.205],fwd:[-.55,.35,.76],dor:[.30,-.90,.25],hp:"book",pole:[.7,-.6,-.3]};
    A.R={W:[-.345,ARMREST.top+.040,.190],fwd:[.02,-.30,1],dor:[0,1,.3],hp:"rest",pole:[-.3,-1,-.5]};}
  else if(pose==="write"){
    A.R={W:null,fwd:[.25,-.55,.80],dor:[-.60,.55,.40],hp:"brush",pole:[-.8,-.5,-.2],tip:[-.045,DESK.top+.001,.425]};
    A.L={W:[.180,DESK.top+.026,.330],fwd:[-.35,-.12,.93],dor:[.05,1,.12],hp:"rest",pole:[.8,-.5,-.2]};}
  else if(pose==="gaze"){
    A.R={W:[-.175,sY+.105,.180],fwd:[-.30,-.40,.87],dor:[-.15,1,.35],hp:"lap",pole:[-.6,-.6,-.4]};
    A.L={W:[.175,sY+.105,.180],fwd:[.30,-.40,.87],dor:[.15,1,.35],hp:"lap",pole:[.6,-.6,-.4]};}
  else{
    A.R={W:[-.120,.220,.125],fwd:[-.1,-.55,.83],dor:[-.15,.85,.5],hp:"rest",pole:[-.6,-.4,-.6]};
    A.L={W:[.120,.220,.125],fwd:[.1,-.55,.83],dor:[.15,.85,.5],hp:"rest",pole:[.6,-.4,-.6]};}
  R.armT=A;R.arm={};
  for(const k of["L","R"]){const a=A[k];const S=R.sh[k];
    let Wt=a.W;if(!Wt){// brush: place wrist so the brush tip lands on target (grip point & brush length from hand model)
      const hdat=handData(HANDP[a.hp]);const M=basisYZ(a.fwd,a.dor);const grip=lerp3(hdat.thumb[3],hdat.fings[0][2],.5);
      Wt=sub3(add3(a.tip,[0,.083,0]),apM(M,grip));R.brushGrip=grip;}
    const ik=ik2(S,Wt,ARM_U,ARM_F,a.pole);
    R.arm[k]={S,E:ik.E,W:ik.T,fwd:a.fwd,dor:a.dor,hp:a.hp};}
  return R;}
// ---- Kenko robe: outer robe (with collar band), inner white collars, sleeves, lap ----
function kenkoRobe(R,P){
  const sY=R.sY,pose=R.pose;
  // torso union (local, upright)
  const torsoL=U([K(sEll([0,.040,-.030],[.205,.090,.178]),0),K(sEll([0,.165,-.015],[.168,.115,.138]),.07),K(sEll([0,.300,-.010],[.160,.135,.126]),.07),
    K(sEll([0,.410,-.032],[.158,.090,.118]),.06),K(sCap([.050,.508,-.032],[.162,.458,-.032],.044),.05),K(sCap([-.050,.508,-.032],[-.162,.458,-.032],.044),.05),
    K(sEll([0,.496,-.036],[.088,.040,.066]),.04)]);
  const tf=torsoL.f;
  // nested V edges (frontal x,y in torso-local)
  const V=(x0,y0,yc)=>{const L=y=>lerp(x0,-.004,(y0-y)/(y0-yc)),Rr=y=>lerp(-x0,-.004,(y0-y)/(y0-yc));const c=(y0-yc)/sq((y0-yc)**2+x0*x0);return{L,R:Rr,c,y0,yc};};
  const Vo=V(.047,.548,.415),V1=V(.035,.556,.447),V2=V(.026,.563,.474);
  const inV=(v,x,y)=>mx((v.R(y)-x)*v.c,(x-v.L(y))*v.c,(v.yc-y)*.92);// <0 inside V (above crossing)
  const bw=.044;
  const robeTorso={f:(x,y,z)=>{const d0=tf(x,y,z);let d=d0;
      if(z>-.04&&y>.30&&y<.62){const fr=sstep(-.04,.0,z);
        d=smax(d,-(inV(Vo,x,y)-(1-fr)*.05),.004);
        // left panel band (on top) — continues below the crossing
        const xl=(x-Vo.L(y))*Vo.c;const bL=mx(mx(-xl,xl-bw),mx(d0-.0125,-d0-.010),mx(y-.556,.27-y));
        // right panel band — ends under the left band
        const xr=(Vo.R(y)-x)*Vo.c;const bR=mx(mx(-xr,xr-bw),mx(d0-.0085,-d0-.010),mx(y-.556,Vo.yc-.012-y));
        d=smin(d,mn(bL,bR),.003);}
      return d;},bs:torsoL.bs};
  const neckRing=[[.068,.546,.040],[.077,.553,-.004],[.058,.562,-.050],[0,.569,-.072],[-.058,.562,-.050],[-.077,.553,-.004],[-.068,.546,.040]];
  const ringN=neckRing.map(p=>nrm3([p[0],0,p[2]+.004]));
  const backBand=sRibbon(neckRing,ringN,.022,.0085,.006);
  let robeT=U([robeTorso,K(backBand,.006)]);
  robeT=S(robeT,[K(sCone([0,.47,-.012],[0,.70,.025],.057,.061),.010)]);
  // inner white collars: two stepped layers within the outer V, throat open inside V2
  const whiteF={f:(x,y,z)=>{if(z<-.03||y<.33||y>.62)return .05;const d0=tf(x,y,z);
      const o=inV(Vo,x,y),i1=inV(V1,x,y),i2=inV(V2,x,y);
      const off=lerp(-.0005,.0050,sstep(.0012,-.0012,i1));
      let d=mx(d0+off,o-.016);d=mx(d,-(i2+.0006));return mx(d,-(z+.02));},bs:[0,.47,.05,.16]};
  const ringW=neckRing.map(p=>[p[0]*.86,p[1]+.008,p[2]*.86+.004]);
  const whiteBack=sRibbon(ringW,ringN,.020,.006,.004);
  const collarL=U([whiteF,K(whiteBack,.004)]);
  let robe=T(robeT,R.TM,R.hip),collar=T(collarL,R.TM,R.hip);
  const bandLocal={f:(x,y,z)=>{if(z<-.12||y<.25||y>.62)return 1;const d0=tf(x,y,z);
      const xl=(x-Vo.L(y))*Vo.c,xr=(Vo.R(y)-x)*Vo.c;const sL=mx(-xl,xl-bw),sR=mx(-xr,xr-bw);const yr=mx(y-.556,.27-y);
      return mn(mx(sL,yr,-d0-.02,d0-.02),mx(sR,mx(y-.556,Vo.yc-.012-y),-d0-.02,d0-.02),backBand.f(x,y,z));},bs:[0,.45,0,.3]};
  const bandW=T(bandLocal,R.TM,R.hip);
  // ---- colliders ----
  const col=[];
  if(pose==="write")col.push(K(sBox([0,DESK.top/2,(DESK.z0+DESK.z1)/2],[DESK.x,DESK.top/2,(DESK.z1-DESK.z0)/2],null,.002),.006));
  if(pose==="read")col.push(K(sBox([(ARMREST.x0+ARMREST.x1)/2,ARMREST.top/2,(ARMREST.z0+ARMREST.z1)/2],[(ARMREST.x1-ARMREST.x0)/2,ARMREST.top/2,(ARMREST.z1-ARMREST.z0)/2],null,.01),.010));
  // ---- lap: draped heightfield over legs ----
  const sup=[];
  for(const k of["L","R"]){sup.push({a:R.hipJ[k],b:R.knee[k],r:.074});sup.push({a:R.knee[k],b:R.ankle[k],r:pose==="kneel"?.050:.056,sl:1.1});}
  const torsoC=R.tp([0,.30,0]);
  let lap;
  if(pose==="kneel"){sup.push({a:[-.10,.21,-.09],b:[.10,.21,-.09],r:.09});
    lap=lapHF(sup,{floor:0,th:.016,k:.05,hem:{c:[0,.04],rx:.33,rz:.37,waves:8,wamp:.035,seed:4},folds:lapFolds(R,.0)});}
  else{sup.push({a:[-.12,sY+.10,-.06],b:[.12,sY+.10,-.06],r:.10});for(const k of["L","R"])sup.push({a:R.ankle[k],b:add3(R.ankle[k],[k==="L"?-.08:.08,0,.0]),r:.040});
    lap=lapHF(sup,{floor:0,th:.016,k:.05,hem:{c:[0,.075],rx:.46,rz:.345,waves:9,wamp:.035,seed:7},folds:lapFolds(R,sY)});}
  let body=U([robe,K(lap,.035)]);
  // ---- sleeves (separate pieces: crisp overlap with lap & torso) ----
  const sleeves=[];const SI={};
  for(const k of["L","R"]){const A=R.arm[k];const arm=k==="R"&&pose==="read";
    const sp=sleevePiece(A,{rU:.058,rE:.056,rC:.066,len:.50,hang:arm?.34:.22,center:torsoC,seed:k==="L"?3:8,drape:arm?{y:ARMREST.top,amt:.095}:null});
    sleeves.push(sp.F);SI[k]=sp.info;}
  body=S(U([body,K(sleeves[0],.012),K(sleeves[1],.012)]),col);
  return{body,sleeves:[],collar,SI,band:bandW.f};
}
// lap fold field (heights) radiating from the knees
function lapFolds(R,sY){const nz=makeNoise(31);const kn=[R.knee.L,R.knee.R];
  return(x,z,h)=>{let d=0;for(const q of kn){const dx=x-q[0],dz=z-q[2];const r=sq(dx*dx+dz*dz);if(r>.42||r<.04)continue;
      const a=Math.atan2(dz,dx);const A=.010*sstep(.05,.14,r)*sstep(.42,.26,r)*sstep(.012,.05,h-.0);
      const ph=a*3.4+.45*nz(a*.9+q[0]*3,r*2.2,q[2]*4);d+=A*foldProfile(ph)*(1+.25*nz(a*3,r*6,1.3));}
    return d;};}
// sleeve: upper-arm & forearm tubes + bent hanging sheet (tamoto) attached from the shoulder along the arm + cuff cavity
// o: {rU,rE,rC, len (sleeve length below shoulder), hang (min drop below lowest arm point), off, center, seed, t}
function sleevePiece(A,o){const S0=A.S,E=A.E,W=A.W;const fd=nrm3(sub3(W,E)),ud=nrm3(sub3(E,S0));
  const cuff=sub3(W,scl3(fd,.010)),Sx=add3(S0,scl3(ud,-.035));
  const tubes=U([K(sCone(Sx,E,o.rU,o.rE),0),K(sCone(E,cuff,o.rE,o.rC),.03)]);
  let hz=[cuff[0]-E[0],0,cuff[2]-E[2]];if(len3(hz)<.06)hz=[cuff[0]-S0[0],0,cuff[2]-S0[2]];if(len3(hz)<.04)hz=[0,0,1];hz=nrm3(hz);
  const o0=add3(E,o.off||[0,0,0]);
  const uS=dot3(sub3(S0,E),hz),uC=dot3(sub3(cuff,E),hz);
  let n=cross3(hz,[0,1,0]);const out=sub3(o0,o.center||[0,.4,0]);const sg=dot3(n,out)>0?1:-1;
  const lowY=mn(E[1],cuff[1]);
  const yBot=mn(S0[1]-(o.len||.50),lowY-(o.hang||.22));
  const kp=[[uS,S0[1]-.050-E[1]],[0,-.040],[uC,cuff[1]-.032-E[1]]].sort((p,q)=>p[0]-q[0]);
  const vt=u=>{if(u<=kp[0][0])return kp[0][1];if(u>=kp[2][0])return kp[2][1];const i=u<kp[1][0]?0:1;const t=(u-kp[i][0])/mx(1e-4,kp[i+1][0]-kp[i][0]);return lerp(kp[i][1],kp[i+1][1],t);};
  const vb=u=>yBot-E[1];
  const ua=mn(uS,0)-.06,ub=uC+.014;const nzs=makeNoise(o.seed||3);const T_=o.t||.0105;
  const fold=(u,v)=>{const dep=vt(u)-v;const A_=.0130*sstep(.0,.14,dep);const lam=.055+.20*clamp(dep,0,.45);
    const ph=2*PI*(u-uC*.35)/lam+1.0*nzs(u*3,v*2.5,1.1);const belly=.024*Math.sin(PI*clamp((u-ua)/(ub-ua),0,1))*sstep(.04,.26,dep);
    const dr=o.drape?o.drape.amt*sstep(o.drape.y+.035-E[1],o.drape.y-.03-E[1],v):0;
    return sg*(A_*Math.sin(ph)*(1-.5*(dr>0?1:0))+belly+dr);};
  const sheet=sSheet(o0,hz,[0,1,0],ua,ub,vt,vb,T_,fold,.075);
  let F=U([tubes,K(sheet,.03)]);
  F=S(F,[K(sEll(add3(cuff,scl3(fd,-.026)),[.044,.041,.046],basisZY(fd,[0,1,0])),.006)]);
  const pts=[S0,Sx,E,W,cuff];for(const u of[ua,ub])for(const v of[vt(u),vb(u)])pts.push(add3(o0,add3(scl3(hz,u),[0,v,0])));
  const b0=[1e9,1e9,1e9],b1=[-1e9,-1e9,-1e9];for(const q of pts)for(let i=0;i<3;i++){b0[i]=mn(b0[i],q[i]);b1[i]=mx(b1[i],q[i]);}
  for(let i=0;i<3;i++){b0[i]-=.11;b1[i]+=.11;}b0[1]=mx(b0[1],-.03);
  return{F,info:{E,cuff,fd,hz,lowY,yBot,bb:[b0,b1]}};}
// ---- woven pattern textures & triplanar cloth material ----
function drawRoundel(g,cx,cy,R0,col,col2){g.save();g.translate(cx,cy);
  for(let k=0;k<4;k++){g.save();g.rotate(k*PI/2+PI/4);
    // curved vine
    g.strokeStyle=col;g.lineWidth=R0*.07;g.beginPath();g.arc(0,0,R0*.78,-.55,.55);g.stroke();
    // leaves
    for(const a of[-.42,.42]){g.save();g.rotate(a);g.translate(R0*.80,0);g.rotate(a>0?.9:-.9);g.fillStyle=col;g.beginPath();g.ellipse(0,0,R0*.20,R0*.085,0,0,7);g.fill();g.restore();}
    // hanging wisteria cluster (teardrop of florets)
    g.fillStyle=col2;for(let i=0;i<9;i++){const t=i/8;const rx=R0*(.66-.42*t),w=R0*(.11-.07*t);for(const sx of[-1,0,1]){if(sx&&i>6)continue;g.beginPath();g.arc(rx,sx*w*.9,R0*.052*(1-.4*t),0,7);g.fill();}}
    g.restore();}
  g.strokeStyle=col;g.lineWidth=R0*.045;g.beginPath();g.arc(0,0,R0*1.02,0,7);g.stroke();
  g.fillStyle=col2;for(let k=0;k<4;k++){g.save();g.rotate(k*PI/2);g.beginPath();g.ellipse(R0*.13,0,R0*.12,R0*.06,0,0,7);g.fill();g.restore();}
  g.fillStyle=col;g.beginPath();g.arc(0,0,R0*.06,0,7);g.fill();g.restore();}
function patternTex(R,o){const S=o.px||512;return canvasTex(R,S,S,(g,w,h)=>{g.fillStyle=o.ground;g.fillRect(0,0,w,h);
  const rnd=mulberry32(o.seed||9);
  // twill / weave texture
  g.globalAlpha=.10;for(let i=-h;i<w;i+=3){g.strokeStyle=(i/3)%2?"#000":"#fff";g.lineWidth=1;g.beginPath();g.moveTo(i,0);g.lineTo(i+h,h);g.stroke();}
  g.globalAlpha=.06;for(let i=0;i<1600;i++){g.fillStyle=rnd()<.5?"#000":"#fff";g.fillRect(rnd()*w,rnd()*h,1+rnd()*3,1);}
  g.globalAlpha=o.alpha||.92;
  const R0=w*(o.r||.20);
  for(const c of[[.25,.25],[.75,.75]])for(const dx of[-1,0,1])for(const dy of[-1,0,1])drawRoundel(g,(c[0]+dx)*w,(c[1]+dy)*h,R0,o.fig,o.fig2||o.fig);
  g.globalAlpha=1;});}
function triMat(R,map,o){o=o||{};const sc=o.scale||4;
  const m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,map,roughness:o.rough!=null?o.rough:.82,metalness:0});
  if(o.skinning)m.skinning=true;
  m.onBeforeCompile=sh=>{sh.uniforms.triS={value:sc};
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vTriP;varying vec3 vTriN;").replace("#include <begin_vertex>","#include <begin_vertex>\nvTriP=position;vTriN=normal;");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nvarying vec3 vTriP;varying vec3 vTriN;uniform float triS;")
      .replace("#include <map_fragment>","vec3 tw=pow(abs(normalize(vTriN)),vec3(6.0));tw/=(tw.x+tw.y+tw.z);\nvec4 tc=texture2D(map,vTriP.zy*triS)*tw.x+texture2D(map,vTriP.xz*triS)*tw.y+texture2D(map,vTriP.xy*triS)*tw.z;\ndiffuseColor*=mapTexelToLinear(tc);");};
  m.customProgramCacheKey=()=>"tsureTri"+sc+(o.skinning?"s":"");R.add(m);return m;}

// =====================================================================================
//  8. assembly helpers
// =====================================================================================
function m4(M,t){const m=new THREE.Matrix4();m.set(M[0],M[1],M[2],t[0],M[3],M[4],M[5],t[1],M[6],M[7],M[8],t[2],0,0,0,1);return m;}
function placeObj(o,M,t){const m=m4(M,t);m.decompose(o.position,o.quaternion,o.scale);}
// polygonize a local-space SDF part, AO against world SDF G through (M,t)
const GEO_CACHE=new Map();// key -> poly typed arrays (CPU only; GPU resources are created per figure)
function cachePoly(key,make){if(key&&GEO_CACHE.has(key))return GEO_CACHE.get(key);const p=make();if(key){GEO_CACHE.set(key,p);if(GEO_CACHE.size>40)GEO_CACHE.delete(GEO_CACHE.keys().next().value);}return p;}
function buildPart(F,bmin,bmax,h,M,t,G,aoStep,aoStr,painter,opt){opt=opt||{};
  const key=opt.key?opt.key+"|"+h:null;
  if(key&&GEO_CACHE.has(key)){const c=GEO_CACHE.get(key);return{pos:c.pos,nrm:c.nrm,idx:c.idx,n:c.n,col:c.col};}
  const poly=polygonize(F.f,bmin,bmax,h,{levels:opt.levels!=null?opt.levels:3,lip:1.25,seedS:opt.seedS||4,refine:opt.refine||0,normals:opt.normals||"grid"});
  const n=poly.n,p=poly.pos,q=poly.nrm;let ao=null;
  if(G){ao=new Float32Array(n);const I=M||[1,0,0,0,1,0,0,0,1],T_=t||[0,0,0];
    for(let v=0;v<n;v++){const lx=p[v*3],ly=p[v*3+1],lz=p[v*3+2],nx=q[v*3],ny=q[v*3+1],nz=q[v*3+2];
      const x=I[0]*lx+I[1]*ly+I[2]*lz+T_[0],y=I[3]*lx+I[4]*ly+I[5]*lz+T_[1],z=I[6]*lx+I[7]*ly+I[8]*lz+T_[2];
      const wx=I[0]*nx+I[1]*ny+I[2]*nz,wy=I[3]*nx+I[4]*ny+I[5]*nz,wz=I[6]*nx+I[7]*ny+I[8]*nz;
      let occ=0,w=1,ws=0;const ns=opt.aoN||4;for(let i=1;i<=ns;i++){const d=aoStep*i;const sd=G(x+wx*d,y+wy*d,z+wz*d);occ+=w*mx(0,d-sd)/d;ws+=w;w*=.7;}
      ao[v]=clamp(1-aoStr*occ/ws,0,1);}}
  paint(poly,painter,ao,opt.aoMin!=null?opt.aoMin:.18);
  if(key)GEO_CACHE.set(key,{pos:poly.pos,nrm:poly.nrm,idx:poly.idx,n:poly.n,col:poly.col});
  return poly;}
function mergePolys(list){let n=0,ni=0;for(const p of list){n+=p.n;ni+=p.idx.length;}
  const pos=new Float32Array(n*3),nrm=new Float32Array(n*3),col=new Float32Array(n*3),idx=n>65535?new Uint32Array(ni):new Uint16Array(ni);let vo=0,io=0;
  for(const p of list){pos.set(p.pos,vo*3);nrm.set(p.nrm,vo*3);if(p.col)col.set(p.col,vo*3);for(let i=0;i<p.idx.length;i++)idx[io+i]=p.idx[i]+vo;io+=p.idx.length;vo+=p.n;}
  return{pos,nrm,col,idx,n};}
function meshOf(R,poly,mat,cast){const g=R.add(toGeom(poly));const m=new THREE.Mesh(g,mat);m.castShadow=cast!==false;m.receiveShadow=true;return m;}
function skinPainter(P,kind,hd){const skin=lin(P.skin||0xc49a78),red=lin(P.skinRed||0xbd7b64),light=lin(P.skinLight||0xd8b498),nail=lin(0xd9b4a2);
  const nw=hd?nailPaint(hd):null;
  return(x,y,z,nx,ny,nz)=>{let c=skin.slice();
    if(kind==="hand"){c=mixc(c,light,sstep(.1,-.6,nz)*.55);// palm side lighter
      c=mixc(c,red,.25*sstep(.3,.9,nz)*sstep(.07,.10,y));if(nw){const w=nw(x,y,z,nx,ny,nz);c=mixc(c,nail,w*.85);}}
    if(kind==="foot"){c=mixc(c,light,sstep(-.2,-.7,ny)*.6);c=mixc(c,red,.25*sstep(.15,.19,z));}
    const mo=1+.05*N1(x*200,y*200,z*200);return mulc(c,mo);};}
function brushGeom(R,len){// along -Y from grip at origin: shaft up to +Y*(len-.05), tip down
  const parts=[];const sh=new THREE.CylinderGeometry(.0042,.0046,len,10,1);sh.translate(0,len/2-.055,0);
  const tip=new THREE.CylinderGeometry(.0048,.0002,.028,10,2);tip.translate(0,-.055-.014,0);
  const ring=new THREE.CylinderGeometry(.0050,.0050,.006,10,1);ring.translate(0,-.055+.003,0);
  const col=(g,c)=>{const n=g.attributes.position.count;const a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=c[0];a[i*3+1]=c[1];a[i*3+2]=c[2];}g.setAttribute("color",new THREE.BufferAttribute(a,3));return g;};
  col(sh,lin(0xb59a64));col(tip,lin(0x141210));col(ring,lin(0x3a2a1a));
  return mergeGeoms(R,[sh.toNonIndexed?sh:sh,tip,ring]);}
function bookGroup(R,o){o=o||{};const g=new THREE.Group();const W=o.w||.115,H=o.h||.165,open=o.open||.42;
  const tex=canvasTex(R,256,384,(c,w,h)=>{c.fillStyle="#efe6cf";c.fillRect(0,0,w,h);const rnd=mulberry32(77);
    c.fillStyle="rgba(40,30,20,.85)";for(let col=0;col<8;col++){const x=w-22-col*28;let y=26;while(y<h-30){const L=6+rnd()*14;c.fillRect(x+(rnd()-.5)*3,y,3+rnd()*2,L);y+=L+4+rnd()*8;if(rnd()<.06)y+=20;}}
    c.strokeStyle="rgba(120,90,60,.35)";c.lineWidth=2;c.strokeRect(10,14,w-20,h-28);});
  const pm=R.add(new THREE.MeshStandardMaterial({map:tex,roughness:.88,metalness:0}));
  const cm=R.add(new THREE.MeshStandardMaterial({color:new THREE.Color().setRGB(...lin(o.cover||0x2b3a4a)),roughness:.75}));
  for(const sgn of[-1,1]){// two halves; spine along Y at x=0
    const page=R.add(new THREE.BoxGeometry(W,H,.007,6,1,1));const pa=page.attributes.position;
    for(let i=0;i<pa.count;i++){const x=pa.getX(i)+W/2;pa.setX(i,x*sgn);pa.setZ(i,pa.getZ(i)+.004+.010*Math.sin(PI*clamp(x/W,0,1))*.6-x*.02);}
    page.computeVertexNormals();
    const pg=new THREE.Mesh(page,pm);const piv=new THREE.Object3D();piv.rotation.y=-sgn*open*.5;piv.add(pg);g.add(piv);
    const cov=R.add(new THREE.BoxGeometry(W+.006,H+.006,.002));cov.translate(sgn*(W/2+.003),0,-.002);const cv=new THREE.Mesh(cov,cm);const p2=new THREE.Object3D();p2.rotation.y=-sgn*open*.5;p2.add(cv);g.add(p2);
    pg.castShadow=cv.castShadow=true;pg.receiveShadow=cv.receiveShadow=true;}
  return g;}

// =====================================================================================
//  9. KENKO factory
// =====================================================================================
const KENKO_HEAD={seed:11,age:52,thin:.6,smile:.25,lipU:.0040,lipL:.0052,lipUvol:.0014,lipLvol:.0019,scalp:"stubble",stubAmt:.30,beard:"stubble",skin:0xc49a78,skinRed:0xbd7b64,lip:0x94645a,lipColL:0x9a6a60,brow:0x3e3834,iris:[46,32,24],wrinkles:1,spots:5,eyeOpenU:.0040,eyeOpenL:.0027,gazePitch:.18};
const HEAD_PIV=[0,-.032,-.018];// pivot (atlas) in head-local coords
function makeKenko(opts){opts=opts||{};const R=Res();const q=opts.quality||"high";const pose=["write","read","gaze","kneel"].includes(opts.pose)?opts.pose:"read";
  const sY=opts.seatY!=null?opts.seatY:.06;const t0=performance.now();const T_={};
  const g=new THREE.Group();g.name="kenko_"+pose;
  const rig=kenkoRig(pose,sY);
  const HP=Object.assign({},KENKO_HEAD,{gazePitch:rig.gazeP},opts.headParams||{});
  // ---- head ----
  const hd=buildHead(R,HP,q);T_.head=performance.now()-t0;
  const pivot=new THREE.Object3D();placeObj(pivot,rig.headM,rig.pivot);g.add(pivot);
  hd.group.position.set(-HEAD_PIV[0],-HEAD_PIV[1],-HEAD_PIV[2]);pivot.add(hd.group);
  const headOrigin=add3(rig.pivot,apM(rig.headM,scl3(HEAD_PIV,-1)));
  // ---- robe ----
  const RB=kenkoRobe(rig,HP);
  // ---- hands / feet SDFs ----
  const hands={};
  for(const k of["L","R"]){const A=rig.arm[k];const hs=handSDF(HANDP[A.hp]||HANDP.relax,{});let F=hs.F;if(k==="L")F=mirrorX(F);
    hands[k]={F,M:basisYZ(A.fwd,A.dor),W:A.W,hd:hs.hd,hp:A.hp};}
  const feet={};
  const TOE=pose==="kneel"?{L:[0,-.20,-1],R:[0,-.20,-1]}:{L:[-.75,-.15,.62],R:[.80,-.25,-.50]};
  for(const k of["L","R"]){let F=footSDF();if(k==="L")F=mirrorX(F);const shin=nrm3(sub3(rig.knee[k],rig.ankle[k]));
    feet[k]={F,M:basisYZ(shin,TOE[k]),A:rig.ankle[k]};}
  // ---- cheap proxy scene for cross-part AO ----
  const prox=[T(U([sEll([0,.03,.0],[.078,.10,.095]),sCap([0,-.03,-.015],[0,-.16,-.005],.05)]),rig.headM,headOrigin)];
  for(const k of["L","R"]){const H_=hands[k];prox.push(T(U([sCap([0,-.04,0],[0,.08,0],.03),sCap([0,.08,0],[0,.15,-.02],.022)]),H_.M,H_.W));
    prox.push(T(sEll([0,-.04,.06],[.045,.035,.11]),feet[k].M,feet[k].A));}
  const proxU=U(prox,0);
  const bodyF=RB.body.f,colF=RB.collar.f;
  const robeAll=bodyF;
  const Grobe=(x,y,z)=>mn(robeAll(x,y,z),proxU.f(x,y,z),y,colF(x,y,z));
  const Gpart=(x,y,z)=>mn(robeAll(x,y,z),y,colF(x,y,z));
  // ---- robe & collar ----
  const hR=q==="low"?.020:q==="medium"?.015:.012;
  const robeC=lin(HP.robe||0x56524a),bandC=lin(HP.robeBand||0x3a3833);const bandF=RB.band;
  const robePainter=(x,y,z)=>{const n=1+.09*N1(x*9,y*9,z*9)+.04*N2(x*40,y*40,z*40);let c=mulc(robeC,n);
    c=mixc(c,mulc(robeC,1.12),.35*sstep(.2,.6,N3(x*4,y*4,z*4)));
    if(bandF){const bd=bandF(x,y,z);if(bd<.006)c=mixc(c,bandC,sstep(.006,-.002,bd));}return c;};
  const bb=pose==="kneel"?[[-.42,-.02,-.36],[.42,.86,.50]]:[[-.62,-.02,-.45],[.55,sY+.80,.62]];
  const rkey="kenkoRobe|"+pose+"|"+sY+"|"+q+"|"+JSON.stringify(opts.headParams||{});
  for(const k of["L","R"]){const b=RB.SI[k].bb;for(let i=0;i<3;i++){bb[0][i]=mn(bb[0][i],b[0][i]);bb[1][i]=mx(bb[1][i],b[1][i]);}}
  const robePoly=buildPart(RB.body,bb[0],bb[1],hR,null,null,Grobe,.016,1.35,robePainter,{aoN:3,aoMin:.10,key:rkey+"|b"});T_.robe=performance.now()-t0;
  const robeMesh=meshOf(R,robePoly,clothMat(R,{rough:.93}));g.add(robeMesh);
  const colC=lin(0xe6e2d7);
  const collarPoly=buildPart(RB.collar,[-.17,sY+.30,-.22],[.17,sY+.82,.26],q==="low"?.0075:.005,null,null,Grobe,.010,1.0,(x,y,z)=>colC,{aoMin:.30,aoN:3,key:rkey+"|col"});
  const collarMesh=meshOf(R,collarPoly,clothMat(R,{rough:.85}));g.add(collarMesh);
  // ---- hands / feet meshes ----
  const skinM=skinMat(R,{rough:.6});
  const hh=q==="low"?.0058:q==="medium"?.0042:.0032;
  const handPiv={};
  for(const k of["L","R"]){const H_=hands[k];
    const poly=buildPart(H_.F,[-.065,-.07,-.06],[.065,.20,.06],hh,H_.M,H_.W,Gpart,.008,1.0,skinPainter(HP,"hand",null),{aoMin:.35,key:"kenkoHand|"+pose+k});
    const mesh=meshOf(R,poly,skinM);const piv=new THREE.Object3D();placeObj(piv,H_.M,H_.W);piv.add(mesh);g.add(piv);handPiv[k]=piv;}
  for(const k of["L","R"]){const Fd=feet[k];
    const poly=buildPart(Fd.F,[-.06,-.09,-.09],[.06,.16,.22],q==="low"?.006:.0042,Fd.M,Fd.A,Gpart,.01,1.0,skinPainter(HP,"foot"),{aoMin:.35,key:"kenkoFoot|"+pose+k});
    const mesh=meshOf(R,poly,skinM);placeObj(mesh,Fd.M,Fd.A);g.add(mesh);}
  T_.parts=performance.now()-t0;
  // ---- anchors & props ----
  const anchors={};
  const headTop=new THREE.Object3D();headTop.position.set(0,.128,0);hd.group.add(headTop);anchors.headTop=headTop;
  const eyes=new THREE.Object3D();eyes.position.set(0,.0245,.085);hd.group.add(eyes);anchors.eyes=eyes;
  const chest=new THREE.Object3D();chest.position.set(...rig.tp([0,.36,.12]));g.add(chest);anchors.chest=chest;
  let writeBase=null;
  if(pose==="write"){const bm=R.add(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:0}));const brush=new THREE.Mesh(brushGeom(R,.19),bm);brush.castShadow=true;
    const Mi=hands.R.M;const upLocal=new THREE.Vector3(Mi[3],Mi[4],Mi[5]).normalize();
    brush.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),upLocal);brush.position.set(...rig.brushGrip);handPiv.R.add(brush);
    const tip=new THREE.Object3D();tip.position.set(0,-.083,0);brush.add(tip);anchors.brushTip=tip;writeBase=handPiv.R.position.clone();}
  if(pose==="read"){const bk=bookGroup(R,{});const HL=hands.L;
    const hold=add3(HL.W,apM(HL.M,[.004,.080,-.036]));// palm centre (left hand local is mirrored: x sign irrelevant here)
    const eyeW=add3(headOrigin,apM(rig.headM,[0,.0245,.08]));
    const bc=add3(hold,[0,.065,.0]);const nrmB=nrm3(sub3(eyeW,bc));let upB=sub3([0,1,0],scl3(nrmB,dot3([0,1,0],nrmB)));upB=nrm3(add3(upB,[.25,0,0]));
    const BM=basisYZ(upB,nrmB);const wm=m4(BM,add3(hold,scl3(upB,.060)));const hm=m4(HL.M,HL.W);const lm=new THREE.Matrix4().copy(hm).invert().multiply(wm);
    lm.decompose(bk.position,bk.quaternion,bk.scale);handPiv.L.add(bk);const ba=new THREE.Object3D();bk.add(ba);anchors.book=ba;}
  g.userData.anchors=anchors;g.userData.head=pivot;g.userData.writing=false;T_.headDetail=Object.assign({},HEADT);g.userData.timings=T_;
  const pivotRest=pivot.quaternion.clone(),pivotPos=pivot.position.clone();const sw=new THREE.Quaternion(),eu=new THREE.Euler();
  g.userData.update=function(dt,t){const br=Math.sin(t*1.3);
    pivot.position.set(pivotPos.x,pivotPos.y+br*.0012,pivotPos.z);
    eu.set(Math.sin(t*.37)*.010+br*.004,Math.sin(t*.23)*.016,0);sw.setFromEuler(eu);pivot.quaternion.copy(pivotRest).multiply(sw);
    if(writeBase){if(g.userData.writing){const ph=t*.85,col=Math.floor(ph/6)%5,k=(ph%6)/6;const st=(k*7)%1,lift=sstep(.80,.92,st)*sstep(1,.97,st);
        handPiv.R.position.set(writeBase.x-col*.012+.024+Math.sin(t*7.3)*.0025,writeBase.y+lift*.009,writeBase.z+.035-k*.075);}
      else handPiv.R.position.copy(writeBase);}};
  g.userData.dispose=function(){R.dispose();};
  let tris=0,meshes=0;g.traverse(o=>{if(o.isMesh){meshes++;const gg=o.geometry;tris+=(gg.index?gg.index.count:gg.attributes.position.count)/3;}});
  g.userData.stats={ms:performance.now()-t0,tris,meshes};
  return g;}
// =====================================================================================
//  10. ROUJIN (elderly noble in karaginu, sashinuki, tate-eboshi)
// =====================================================================================
const ROUJIN_HEAD={seed:23,age:72,thin:.85,smile:.15,lipU:.0036,lipL:.0046,lipUvol:.0011,lipLvol:.0015,scalp:"hair",hairC:0xd9d4cb,beard:"long",beardLen:.13,eboshi:true,
  skin:0xc29a7c,skinRed:0xb97862,lip:0x9a6a60,lipColL:0x9e7064,browHairs:0,iris:[44,32,26],wrinkles:1.3,spots:9,eyeOpenU:.0038,eyeOpenL:.0026,eyeTilt:.02,browDrop:.016,
  nose:1.06,jaw:.96,browK:1.1,hood:1.35,earL:1.12,neckR:.94,gazePitch:.05,whiskers:0};
const ARM_U2=.272,ARM_F2=.232;
function roujinRig(pose,sY){const R={pose,sY};
  let hip,lean,hP,hY=0,hR=0,gP;
  if(pose==="walk"){hip=[0,.845,-.010];lean=.11;hP=-.13;gP=.02;}
  else if(pose==="hold"){hip=[0,sY+.085,-.03];lean=.20;hP=.40;hR=.05;gP=.32;}
  else{hip=[0,sY+.085,-.03];lean=.40;hP=.42;gP=.36;}
  const TM=rotM(lean,0,0);R.TM=TM;R.hip=hip;const tp=v=>add3(hip,apM(TM,v));R.tp=tp;
  const st=pose==="walk";
  R.sh={L:tp([.158,st?.390:.462,-.028]),R:tp([-.158,st?.390:.462,-.028])};
  R.pivot=tp([0,st?.538:.618,.004]);R.headM=mulM(TM,rotM(hP,hY,hR));R.gazeP=gP;
  if(st){R.hipJ={L:[.085,.835,.0],R:[-.085,.835,.0]};R.knee={L:[.092,.455,.035],R:[-.092,.455,.035]};R.ankle={L:[.090,.078,-.012],R:[-.090,.078,-.012]};}
  else{R.hipJ={L:tp([.088,-.005,.02]),R:tp([-.088,-.005,.02])};R.knee={L:[.290,sY+.035,.225],R:[-.290,sY+.035,.225]};R.ankle={L:[-.085,sY+.060,.200],R:[.075,sY+.050,.100]};}
  const A={};
  if(pose==="walk"){A.R={W:[-.050,.935,.205],fwd:[.25,.30,.92],dor:[-.85,.30,.05],hp:"fan",pole:[-.8,-.4,-.5]};
    A.L={W:[.080,.905,.185],fwd:[-.30,-.55,.78],dor:[.85,-.1,.35],hp:"relax",pole:[.8,-.4,-.5]};}
  else if(pose==="hold"){A.R={W:[-.085,sY+.295,.305],fwd:[.88,-.10,.45],dor:[.05,.25,.95],hp:"hold",pole:[-.7,-.5,-.4]};
    A.L={W:[.095,sY+.275,.295],fwd:[-.85,-.12,.50],dor:[-.05,.30,.95],hp:"hold",pole:[.7,-.5,-.4]};}
  else{A.R={W:[-.075,sY+.265,.395],fwd:[.25,-.75,.60],dor:[-.25,.55,.80],hp:"grasp",pole:[-.7,-.4,-.5]};
    A.L={W:[.150,sY+.240,.360],fwd:[-.20,-.55,.80],dor:[.15,.85,.50],hp:"rest",pole:[.7,-.4,-.5]};}
  R.arm={};for(const k of["L","R"]){const a=A[k];const ik=ik2(R.sh[k],a.W,ARM_U2,ARM_F2,a.pole);R.arm[k]={S:R.sh[k],E:ik.E,W:ik.T,fwd:a.fwd,dor:a.dor,hp:a.hp};}
  return R;}
// karaginu & inner layers; returns world-space SDF pieces
function roujinGarments(R){const st=R.pose==="walk",sY=R.sY;
  // torso (local, upright, slimmer than the monk robe)
  const tl=st?[K(sEll([0,.030,-.012],[.168,.100,.128]),0),K(sEll([0,.150,-.012],[.158,.110,.124]),.06),K(sEll([0,.262,-.012],[.152,.110,.118]),.06),
      K(sEll([0,.338,-.030],[.150,.075,.110]),.05),K(sCap([.050,.420,-.032],[.150,.382,-.032],.040),.045),K(sCap([-.050,.420,-.032],[-.150,.382,-.032],.040),.045)]
    :[K(sEll([0,.050,-.030],[.185,.085,.160]),0),K(sEll([0,.165,-.015],[.160,.110,.132]),.06),K(sEll([0,.300,-.012],[.152,.130,.120]),.06),
      K(sEll([0,.405,-.030],[.150,.085,.112]),.05),K(sCap([.050,.495,-.032],[.150,.455,-.032],.040),.045),K(sCap([-.050,.495,-.032],[-.150,.455,-.032],.040),.045)];
  const torsoL=U(tl);const yN=st?.430:.505;// collar height (local)
  let tor=S(torsoL,[K(sCone([0,yN-.06,-.010],[0,yN+.20,.020],.054,.058),.010)]);
  // side slits (show inner white)
  const slit=sx=>sBox([sx*.150,st?.210:.285,-.015],[.030,st?.085:.090,.10],null,.012);
  tor=S(tor,[K(slit(-1),.01),K(slit(1),.01)]);
  // agekubi round collar + toggle, belt
  const ring=[];const nr=[];for(let i=0;i<=16;i++){const a=i/16*2*PI;const x=Math.sin(a)*.071,z=Math.cos(a)*.068-.008;ring.push([x,yN+.012-.014*Math.cos(a),z]);nr.push([Math.sin(a),0,Math.cos(a)]);}
  const collar=sRibbon(ring,nr,.019,.0085,.006);const toggle=sSphere([-.066,yN-.004,.036],.009);
  const bY=st?.105:.175;const belt=[],bn=[];for(let i=0;i<=20;i++){const a=i/20*2*PI;belt.push([Math.sin(a)*(st?.162:.170),bY,Math.cos(a)*(st?.130:.140)-.012]);bn.push([Math.sin(a),0,Math.cos(a)]);}
  const beltR=sRibbon(belt,bn,.024,.008,.006);
  const upperL=U([tor,K(collar,.006),K(toggle,.004),K(beltR,.006)]);
  const up=T(upperL,R.TM,R.hip);
  // inner white: torso slightly inside + collar of inner robe
  const innerL=U([S(U(tl.map(n=>n)),[]),K(sCone([0,yN-.08,-.01],[0,yN+.035,.0],.064,.061),.01)]);
  const inner=T({f:(x,y,z)=>torsoL.f(x,y,z)+.007,bs:torsoL.bs},R.TM,R.hip);
  // sleeves
  const center=R.tp([0,.25,0]);const sl=[],SI={};
  for(const k of["L","R"]){const sp=sleevePiece(R.arm[k],{rU:.066,rE:.064,rC:.100,len:st?.60:.58,hang:st?.30:.26,center,seed:k==="L"?13:17,t:.0115});sl.push(sp.F);SI[k]=sp.info;}
  // inner sleeve cuffs (white rims inside karaginu cuffs)
  const innerCuffs=[];for(const k of["L","R"]){const A=R.arm[k];const fd=nrm3(sub3(A.W,A.E));innerCuffs.push(sCone(add3(A.W,scl3(fd,-.15)),add3(A.W,scl3(fd,-.030)),.050,.058));}
  // front/back panels
  const bw=R.tp([0,bY,0]);let panels=null;
  if(st){const fz=bw[2]+.135,bz=bw[2]-.150;const nzp=makeNoise(61);
    const fF=(u,v)=>.010*Math.sin(u*48+nzp(u*5,v*2,1)*1.6)*sstep(0,.18,-v)+.022*sstep(-.10,-.32,v);
    const front=sSheet([0,bw[1]+.02,fz],[1,0,0],[0,1,0],-.175,.175,u=>.0,u=>-.47-.02*Math.cos(u*9),.0085,fF,.03);
    const bF=(u,v)=>-.012*Math.sin(u*40+nzp(u*5,v*2,5)*1.6)*sstep(0,.20,-v)-.035*sstep(-.08,-.30,v)*(1-sstep(-.30,-.55,v)*.6);
    const back=sSheet([0,bw[1]+.02,bz],[1,0,0],[0,1,0],-.195,.195,u=>.0,u=>-.66-.03*Math.cos(u*8),.0085,bF,.03);
    panels=U([front,back]);}
  return{up,inner,sleeves:sl,SI,innerCuffs:U(innerCuffs),panels,beltY:bw[1]};}
// sashinuki (baggy trousers): standing legs or seated lap
function sashinukiSDF(R){const st=R.pose==="walk";const parts=[];const nz=makeNoise(71);
  if(st){for(const k of["L","R"]){const h=R.hipJ[k],kn=R.knee[k],an=R.ankle[k];
      parts.push(K(sCone(add3(h,[0,.08,0]),kn,.118,.124),0));parts.push(K(sCone(kn,add3(an,[0,.10,.01]),.124,.112),.05));
      parts.push(K(sEll(add3(an,[0,.038,.022]),[.106,.072,.128]),.05));}
    parts.push(K(sEll([0,.86,-.02],[.165,.11,.13]),.06));
    let F=U(parts);
    F=D(F,(x,y,z)=>{const s=x>0?1:-1;const kn=R.knee[s>0?"L":"R"];const a=Math.atan2(x-kn[0],z-kn[2]);
      return .0065*foldProfile(a*7+nz(a*2,y*4,s)*1.6)*sstep(.92,.70,y)*(1-.5*sstep(.18,.06,y));},.007);
    return F;}
  for(const k of["L","R"]){parts.push(K(sCap(R.hipJ[k],R.knee[k],.098),.05));parts.push(K(sSphere(R.knee[k],.098),.04));parts.push(K(sCap(R.knee[k],R.ankle[k],.082),.05));
    parts.push(K(sEll(R.ankle[k],[.080,.060,.080]),.04));}
  parts.push(K(sEll([0,R.sY+.08,-.04],[.20,.09,.17]),.06));
  let F=U(parts);
  F=D(F,(x,y,z)=>{let d=0;for(const kn of[R.knee.L,R.knee.R]){const dx=x-kn[0],dz=z-kn[2];const r=sq(dx*dx+dz*dz);if(r>.35)continue;
      const a=Math.atan2(dz,dx);d+=.0075*foldProfile(a*3.6+nz(a,r*3,2)*.8)*sstep(.05,.13,r)*sstep(.35,.22,r);}return d;},.008);
  return F;}
// props
function fanGeom(R){// closed bat-fan, local: grip at origin, extends along +Y
  const g=new THREE.BoxGeometry(.022,.30,.010,1,8,1);const pa=g.attributes.position;
  for(let i=0;i<pa.count;i++){const y=pa.getY(i)+.15;const w=lerp(.55,1.25,clamp(y/.3,0,1));pa.setX(i,pa.getX(i)*w);pa.setZ(i,pa.getZ(i)*lerp(1.0,.8,y/.3));pa.setY(i,y-.06);}
  g.computeVertexNormals();const n=pa.count,col=new Float32Array(n*3);
  for(let i=0;i<n;i++){const y=pa.getY(i)+.06,top=y>.285;const c=top?lin(0xe8dcc0):(ab(pa.getZ(i))>.0035?lin(0x2a1a12):lin(0xd8c8a0));col.set(c,i*3);}
  g.setAttribute("color",new THREE.BufferAttribute(col,3));R.add(g);return g;}
function coinBoxGroup(R,q){const g=new THREE.Group();const lac=R.add(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.30,metalness:.05}));
  // lacquered karabitsu-like box: black outside, vermilion inside, gold trims; legs
  const parts=[];const BX=.25,BZ=.17,BH=.17,TH=.012;const add=(w,h,d,x,y,z,c)=>{const b=new THREE.BoxGeometry(w,h,d);b.translate(x,y,z);const n=b.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++)a.set(c,i*3);b.setAttribute("color",new THREE.BufferAttribute(a,3));parts.push(b);};
  const blk=lin(0x0f0d0c),red=lin(0x8c2414),gold=lin(0xb08a3a);
  add(BX*2,TH,BZ*2,0,.045,0,blk);add(BX*2,BH,TH,0,.045+BH/2,BZ-TH/2,blk);add(BX*2,BH,TH,0,.045+BH/2,-BZ+TH/2,blk);add(TH,BH,BZ*2,BX-TH/2,.045+BH/2,0,blk);add(TH,BH,BZ*2,-BX+TH/2,.045+BH/2,0,blk);
  add(BX*2-2*TH-.002,.004,BZ*2-2*TH-.002,0,.053,0,red);add(BX*2-2*TH,BH-.02,.003,0,.06+BH/2-.01,BZ-TH-.0015,red);add(BX*2-2*TH,BH-.02,.003,0,.06+BH/2-.01,-BZ+TH+.0015,red);
  add(.003,BH-.02,BZ*2-2*TH,BX-TH-.0015,.06+BH/2-.01,0,red);add(.003,BH-.02,BZ*2-2*TH,-BX+TH+.0015,.06+BH/2-.01,0,red);
  for(const sx of[-1,1])for(const sz of[-1,1]){add(.030,.050,.022,sx*(BX-.04),.025,sz*(BZ-.02),blk);}
  add(BX*2+.004,.008,.006,0,.045+BH,BZ-TH/2,gold);add(BX*2+.004,.008,.006,0,.045+BH,-BZ+TH/2,gold);add(.006,.008,BZ*2,BX-TH/2,.045+BH,0,gold);add(.006,.008,BZ*2,-BX+TH/2,.045+BH,0,gold);
  const box=new THREE.Mesh(mergeGeoms(R,parts),lac);box.castShadow=box.receiveShadow=true;g.add(box);
  // coin strings (sashi-zeni): ridged bronze cylinders piled in the box and over the rim
  const ct=canvasTex(R,64,256,(c,w,h)=>{for(let y=0;y<h;y+=4){const v=120+((y*37)%23)*3;c.fillStyle="rgb("+(v+40)+","+(v-5)+","+(v-60)+")";c.fillRect(0,y,w,3);c.fillStyle="rgb(40,30,18)";c.fillRect(0,y+3,w,1);}});
  ct.wrapS=ct.wrapT=THREE.RepeatWrapping;
  const cm=R.add(new THREE.MeshStandardMaterial({map:ct,color:0xffffff,roughness:.42,metalness:.55}));
  const rnd=mulberry32(5);const cg=[];
  const string=(p0,p1,bend)=>{const pts=[];for(let i=0;i<=8;i++){const t=i/8;pts.push(new THREE.Vector3(lerp(p0[0],p1[0],t),lerp(p0[1],p1[1],t)+Math.sin(t*PI)*bend,lerp(p0[2],p1[2],t)));}
    const tg=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,.0118,q==="low"?6:10,false);const uv=tg.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,uv.getX(i)*len3(sub3(p1,p0))*30);cg.push(tg);};
  for(let i=0;i<13;i++){const y=.075+.024*(i%4)+rnd()*.01,x=(rnd()-.5)*.36,z=(rnd()-.5)*.20;const a=rnd()*PI;const L=.12+rnd()*.10;
    string([x-Math.cos(a)*L/2,y,z-Math.sin(a)*L/2],[x+Math.cos(a)*L/2,y+(rnd()-.5)*.02,z+Math.sin(a)*L/2],.01+rnd()*.03);}
  string([.20,.20,.05],[.30,.04,.20],.03);string([-.18,.21,-.06],[-.32,.03,.10],.02);
  const coins=new THREE.Mesh(mergeGeoms(R,cg.map(t=>{const n=t.attributes.position.count;return t;})),cm);coins.castShadow=coins.receiveShadow=true;g.add(coins);
  // loose coins (merged discs) and silk bolts
  const lc=[];for(let i=0;i<22;i++){const d=new THREE.CylinderGeometry(.012,.012,.0016,q==="low"?8:14);const r2=rnd();d.rotateX((rnd()-.5)*.5);d.rotateY(rnd()*PI);
    if(r2<.55)d.translate((rnd()-.5)*.40,.18+rnd()*.02,(rnd()-.5)*.24);else d.translate((rnd()-.5)*.6,.002,.20+rnd()*.12);lc.push(d);}
  const lcm=new THREE.Mesh(mergeGeoms(R,lc),cm);lcm.castShadow=true;g.add(lcm);
  const sk=[];const sc=[lin(0xf0ebe0),lin(0xa8202a),lin(0x2c3f72),lin(0xd9b64a)];
  for(let i=0;i<4;i++){const c=new THREE.CylinderGeometry(.040,.040,.30,q==="low"?10:18);c.rotateZ(PI/2);c.rotateY(.15*(i-1.5));c.translate(-.02+i*.012,.235+.035*(i%2),-.07+i*.045-(i>1?.02:0));
    const n=c.attributes.position.count,a=new Float32Array(n*3);for(let j=0;j<n;j++)a.set(sc[i],j*3);c.setAttribute("color",new THREE.BufferAttribute(a,3));sk.push(c);}
  const silk=new THREE.Mesh(mergeGeoms(R,sk),R.add(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.45,metalness:0})));silk.castShadow=silk.receiveShadow=true;g.add(silk);
  return g;}
// skinned helper: weights fn(x,y,z)->[[boneIndex,w],...]
function makeSkinned(R,poly,mat,bones,wfn){const g=R.add(toGeom(poly));const n=poly.n,si=new Uint16Array(n*4),sw=new Float32Array(n*4);const p=poly.pos;
  for(let v=0;v<n;v++){let ws=wfn(p[v*3],p[v*3+1],p[v*3+2]).filter(q=>q[1]>1e-3).sort((a,b)=>b[1]-a[1]).slice(0,4);const t=ws.reduce((a,q)=>a+q[1],0)||1;
    ws.forEach((q,i)=>{si[v*4+i]=q[0];sw[v*4+i]=q[1]/t;});}
  g.setAttribute("skinIndex",new THREE.BufferAttribute(si,4));g.setAttribute("skinWeight",new THREE.BufferAttribute(sw,4));
  const m=new THREE.SkinnedMesh(g,mat);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;return m;}
function makeRoujin(opts){opts=opts||{};const R=Res();const q=opts.quality||"high";const pose=["walk","hold","count"].includes(opts.pose)?opts.pose:"walk";
  const sY=opts.seatY!=null?opts.seatY:0;const t0=performance.now();const T_={};
  const g=new THREE.Group();g.name="roujin_"+pose;const st=pose==="walk";
  const rig=roujinRig(pose,sY);
  const smile=pose==="hold"?.85:pose==="count"?-.15:.18;
  const HP=Object.assign({},ROUJIN_HEAD,{gazePitch:rig.gazeP,smile},opts.headParams||{});
  const hd=buildHead(R,HP,q);T_.head=performance.now()-t0;
  const G=roujinGarments(rig);const SZ=sashinukiSDF(rig);
  // hands
  const hands={};for(const k of["L","R"]){const A=rig.arm[k];const hs=handSDF(HANDP[A.hp]||HANDP.relax,{bony:1});let F=hs.F;if(k==="L")F=mirrorX(F);hands[k]={F,M:basisYZ(A.fwd,A.dor),W:A.W,hd:hs.hd};}
  // socks (feet)
  const feet={};for(const k of["L","R"]){let F=sockSDF();if(k==="L")F=mirrorX(F);
    const M=st?basisZY([0,0,1],[0,1,0]):basisYZ(nrm3(sub3(rig.knee[k],rig.ankle[k])),k==="L"?[-.75,-.15,.62]:[.80,-.25,-.50]);feet[k]={F,M,A:rig.ankle[k]};}
  const headOrigin=add3(rig.pivot,apM(rig.headM,scl3(HEAD_PIV,-1)));
  const prox=U([T(U([sEll([0,.03,0],[.078,.10,.095]),sCap([0,-.03,-.015],[0,-.16,-.005],.05)]),rig.headM,headOrigin)].concat(["L","R"].map(k=>T(sCap([0,-.04,0],[0,.12,0],.03),hands[k].M,hands[k].W))),0);
  const upF=G.up.f,slF=G.sleeves.map(x=>x.f),szF=SZ.f,inF=G.inner.f,pnF=G.panels?G.panels.f:null;
  // seated: front panel draped over the lap & back panel on the floor
  let lapPanel=null;
  if(!st){const front={f:(x,y,z)=>{const d=szF(x,y,z);const sh=mx(d-.016,-d-.002);const bz=rig.hip[2]+.08;return mx(sh,mx(ab(x)-.17,mx(bz-z,z-(bz+.36))));},bs:[0,sY+.15,.2,.4]};
    const back={f:(x,y,z)=>{const bz=rig.hip[2]-.135;const v=mx(ab(x)-.19,mx(y-(G.beltY+.02),-y-.002));const wall=mx(v,ab(z-bz+.04*sstep(sY+.25,sY+.03,y))-.012);
        const floor=mx(ab(x)-.21,mx(y-.014,mx(-y-.002,mx(z-bz,(bz-.30)-z))));return mn(wall,floor);},bs:[0,.2,-.3,.45]};
    lapPanel=U([K(front,.006),K(back,.02)]);}
  const kAll=(x,y,z)=>{let d=mn(upF(x,y,z),slF[0](x,y,z),slF[1](x,y,z));if(pnF)d=mn(d,pnF(x,y,z));if(lapPanel)d=mn(d,lapPanel.f(x,y,z));return d;};
  const Gall=(x,y,z)=>mn(kAll(x,y,z),szF(x,y,z),prox.f(x,y,z),y-sY*0,inF(x,y,z));
  const hR=q==="low"?.022:q==="medium"?.018:.015;
  const key="roujin|"+pose+"|"+sY+"|"+q;
  // karaginu upper (rigid) — torso + sleeves (+ seated panels)
  const kUpper=U([G.up,K(G.sleeves[0],.012),K(G.sleeves[1],.012)].concat(lapPanel?[K(lapPanel,.01)]:[]));
  const bb0=[-.75,st?.18:-.02,-.60],bb1=[.75,st?1.48:sY+.95,.75];
  const greyAO=(x,y,z)=>[1,1,1];
  const pK=buildPart(kUpper,bb0,bb1,hR,null,null,Gall,.016,1.3,greyAO,{aoN:3,aoMin:.12,key:key+"|kU"});
  const kTex=patternTex(R,{ground:"#4a2140",fig:"#b89ac0",fig2:"#d8c48a",r:.20,seed:3});
  const kMat=triMat(R,kTex,{scale:2.9,rough:.62});
  const sTex=patternTex(R,{ground:"#a99ab8",fig:"#e8e2ee",fig2:"#f4efe6",r:.17,px:256,alpha:.85,seed:5});
  // inner white layer
  const pI=buildPart({f:(x,y,z)=>mx(inF(x,y,z),-mn(upF(x,y,z)+.002,1)),bs:G.inner.bs},bb0,bb1,q==="low"?.012:.009,null,null,Gall,.012,1.2,(x,y,z)=>lin(0xe9e5dc),{aoN:3,aoMin:.2,key:key+"|in"});
  const pC=buildPart(G.innerCuffs,bb0,bb1,.006,null,null,Gall,.01,1.0,(x,y,z)=>lin(0xece8df),{aoN:3,aoMin:.2,key:key+"|cf"});
  const whiteMat=clothMat(R,{rough:.8});
  const root=new THREE.Group();g.add(root);// upper-body root (bobs while walking)
  const kUM=meshOf(R,pK,kMat);
  const inM=meshOf(R,mergePolys([pI,pC]),whiteMat);
  // hands & socks
  const skinM=skinMat(R,{rough:.58});const hh=q==="low"?.0058:q==="medium"?.0042:.0032;
  const handPiv={};for(const k of["L","R"]){const H_=hands[k];const poly=buildPart(H_.F,[-.065,-.07,-.06],[.065,.20,.06],hh,H_.M,H_.W,(x,y,z)=>mn(kAll(x,y,z),szF(x,y,z)),.008,1.0,skinPainter(HP,"hand",null),{aoMin:.35,key:key+"|h"+k});
    const piv=new THREE.Object3D();placeObj(piv,H_.M,H_.W);piv.add(meshOf(R,poly,skinM));handPiv[k]=piv;}
  const sockM=clothMat(R,{rough:.85});const sockPolys={};
  for(const k of["L","R"]){const Fd=feet[k];sockPolys[k]=buildPart(Fd.F,[-.065,-.09,-.10],[.065,.16,.22],q==="low"?.007:.0048,Fd.M,Fd.A,(x,y,z)=>mn(szF(x,y,z),y),.01,1.0,(x,y,z)=>lin(0xf1eee6),{aoMin:.35,key:key+"|f"+k});}
  // head pivot
  const pivot=new THREE.Object3D();placeObj(pivot,rig.headM,rig.pivot);hd.group.position.set(-HEAD_PIV[0],-HEAD_PIV[1],-HEAD_PIV[2]);pivot.add(hd.group);
  const anchors={};const headTop=new THREE.Object3D();headTop.position.set(0,.128+(HP.eboH||.27)*.92,-.04);hd.group.add(headTop);anchors.headTop=headTop;
  const eyesA=new THREE.Object3D();eyesA.position.set(0,.0245,.085);hd.group.add(eyesA);anchors.eyes=eyesA;
  const chest=new THREE.Object3D();chest.position.set(...rig.tp([0,st?.30:.36,.12]));anchors.chest=chest;
  let walkRig=null;
  if(st){// skeleton: pelvis -> thigh -> shin ; upper body attached to pelvis
    const B=(n,p)=>{const b=new THREE.Bone();b.name=n;b.position.set(...p);return b;};
    const pel=B("pelvis",[0,.84,-.01]);const thL=B("thighL",sub3(rig.hipJ.L,[0,.84,-.01])),thR=B("thighR",sub3(rig.hipJ.R,[0,.84,-.01]));
    const shL=B("shinL",sub3(rig.knee.L,rig.hipJ.L)),shR=B("shinR",sub3(rig.knee.R,rig.hipJ.R));pel.add(thL,thR);thL.add(shL);thR.add(shR);
    const bones=[pel,thL,shL,thR,shR];
    const wLeg=(x,y,z)=>{const wp=sstep(.74,.88,y),sl=sstep(-.03,.03,x),kn=R_KNEE(y);const wl=1-wp;
      return[[0,wp],[1,wl*kn*sl],[2,wl*(1-kn)*sl],[3,wl*kn*(1-sl)],[4,wl*(1-kn)*(1-sl)]];};
    const R_KNEE=y=>sstep(.40,.52,y);
    const pS=buildPart(SZ,[-.30,-.02,-.30],[.30,1.0,.32],hR*.95,null,null,Gall,.016,1.3,greyAO,{aoN:3,aoMin:.12,key:key+"|sz"});
    const szM=makeSkinned(R,pS,triMat(R,sTex,{scale:9,rough:.7,skinning:true}),bones,wLeg);
    const pP=buildPart(G.panels,[-.30,.12,-.35],[.30,1.0,.35],hR,null,null,Gall,.016,1.3,greyAO,{aoN:3,aoMin:.12,key:key+"|pn"});
    const pnM=makeSkinned(R,pP,triMat(R,kTex,{scale:2.9,rough:.62,skinning:true}),bones,(x,y,z)=>{const wp=sstep(.55,.92,y);const sl=clamp(.5+x/.36,0,1);return[[0,wp],[1,(1-wp)*sl],[3,(1-wp)*(1-sl)]];});
    szM.add(pel);g.add(szM);g.add(pnM);g.updateMatrixWorld(true);const sk=new THREE.Skeleton(bones);szM.bind(sk);pnM.bind(sk);
    // upper body follows pelvis
    pel.add(root);root.position.set(0,-.84,.01);
    for(const k of["L","R"]){const sm=meshOf(R,sockPolys[k],sockM);const sh=k==="L"?shL:shR;const kn=rig.knee[k];sm.position.set(-kn[0],-kn[1],-kn[2]);placeObj(sm,feet[k].M,sub3(feet[k].A,kn));sh.add(sm);}
    walkRig={pel,thL,thR,shL,shR,phase:0};}
  else{const pS=buildPart(SZ,[-.50,-.02,-.35],[.50,sY+.36,.45],hR,null,null,Gall,.016,1.3,greyAO,{aoN:3,aoMin:.12,key:key+"|sz"});
    g.add(meshOf(R,pS,triMat(R,sTex,{scale:9,rough:.7})));
    for(const k of["L","R"]){const sm=meshOf(R,sockPolys[k],sockM);placeObj(sm,feet[k].M,feet[k].A);g.add(sm);}}
  root.add(kUM,inM,pivot,handPiv.L,handPiv.R,chest);
  // props
  if(pose==="walk"){const fan=new THREE.Mesh(fanGeom(R),R.add(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5})));fan.castShadow=true;
    fan.position.set(-.006,.050,-.012);fan.rotation.set(0,0,PI/2+.15);handPiv.R.add(fan);anchors.fan=fan;}
  if(pose==="count"){const box=coinBoxGroup(R,q);box.position.set(0,0,.50);g.add(box);anchors.box=box;
    const cs=new THREE.Mesh(new THREE.CylinderGeometry(.0118,.0118,.13,10),R.add(new THREE.MeshStandardMaterial({color:0xb08850,roughness:.42,metalness:.55})));R.add(cs.geometry);
    cs.position.set(-.004,.075,-.034);cs.rotation.set(0,0,PI/2);cs.castShadow=true;handPiv.R.add(cs);}
  let lap=null;if(pose==="hold"){lap=new THREE.Object3D();lap.position.set(0,sY+.135,.165);lap.name="lapAnchor";g.add(lap);anchors.lap=lap;}
  g.userData.lapAnchor=lap;g.userData.anchors=anchors;g.userData.head=pivot;g.userData.walking=false;g.userData.walkSpeed=.6;
  const pivR=pivot.quaternion.clone(),pivP=pivot.position.clone(),eu=new THREE.Euler(),qq=new THREE.Quaternion();
  const hR0=handPiv.R.position.clone(),hL0=handPiv.L.position.clone();
  g.userData.update=function(dt,t){dt=Math.min(dt||0,.1);const br=Math.sin(t*1.2);
    let bob=0,sway=0;
    if(walkRig){const W=walkRig;const on=!!g.userData.walking;const sp=g.userData.walkSpeed||.6;
      W.amp=lerp(W.amp||0,on?1:0,1-Math.exp(-dt*5));if(on)W.phase+=dt*2*PI*sp/.84;const ph=W.phase,a=W.amp;
      const hipA=.27*a,knA=.55*a;
      W.thL.rotation.x=-hipA*Math.sin(ph);W.thR.rotation.x=hipA*Math.sin(ph);
      W.shL.rotation.x=.05+knA*Math.pow(mx(0,Math.sin(ph+1.3)),1.4);W.shR.rotation.x=.05+knA*Math.pow(mx(0,Math.sin(ph+1.3+PI)),1.4);
      W.pel.position.y=.84+a*(.012*Math.cos(2*ph)-.010);W.pel.position.x=a*.010*Math.sin(ph);W.pel.rotation.y=a*.06*Math.sin(ph);W.pel.rotation.z=a*.02*Math.sin(ph);
      root.rotation.y=-a*.05*Math.sin(ph);root.rotation.x=a*.02*Math.sin(2*ph);bob=a*Math.sin(2*ph);sway=a*Math.sin(ph);}
    pivot.position.set(pivP.x,pivP.y+br*.001,pivP.z);eu.set(Math.sin(t*.4)*.012+bob*.01,Math.sin(t*.27)*.02-sway*.03,0);qq.setFromEuler(eu);pivot.quaternion.copy(pivR).multiply(qq);
    if(pose==="count"){const c=t*.55,k=(c%1);const lift=sstep(0,.25,k)*sstep(.65,.4,k);handPiv.R.position.set(hR0.x+.02*Math.sin(c*2*PI*.5),hR0.y+.035*lift,hR0.z-.01*lift);
      handPiv.L.position.set(hL0.x+.006*Math.sin(t*.9),hL0.y,hL0.z);}
    if(pose==="hold"){handPiv.R.position.set(hR0.x+.004*Math.sin(t*.8),hR0.y+.003*Math.sin(t*1.6),hR0.z);handPiv.L.position.set(hL0.x-.004*Math.sin(t*.8+1),hL0.y,hL0.z);}};
  g.userData.dispose=function(){R.dispose();};
  let tris=0,meshes=0;g.traverse(o=>{if(o.isMesh){meshes++;const gg=o.geometry;tris+=(gg.index?gg.index.count:gg.attributes.position.count)/3;}});
  T_.total=performance.now()-t0;g.userData.timings=T_;g.userData.stats={ms:T_.total,tris,meshes};
  return g;}
// white sock (shitouzu): foot without separate toes
function sockSDF(){const parts=[K(sEll([0,-.046,-.030],[.032,.029,.036]),0),K(sEll([.004,-.044,.045],[.040,.028,.060]),.03),K(sEll([.008,-.052,.120],[.046,.020,.042]),.03),
  K(sEll([.012,-.054,.168],[.036,.017,.026]),.025),K(sCap([0,-.012,.0],[.006,-.040,.105],.023),.025),K(sCone([0,.0,-.004],[0,.13,-.012],.034,.040),.02)];
  return U(parts);}
// =====================================================================================
//  CHILDREN (grandchildren of the old noble): makeMago({pose:"held"|"play",sex,age,quality})
//  Modelled at "head scale" (the shared head SDF with child proportions: big cranium, small jaw and
//  nose, full cheeks), then the whole figure is scaled so the head is ~0.19 m tall.
//  held: girl of ~3 sitting on a lap, holding a little paper doll (hiina). Origin = the sitting plane
//        under her buttocks (put it on makeRoujin({pose:"hold"}).userData.lapAnchor). +Z = front.
//  play: boy of ~6 standing with a gicchou mallet (and the ball at his feet). Origin = ground. +Z = front.
//  Hair: furiwake / amasogi bob (centre parting, cut straight at the shoulders / jaw).
// =====================================================================================
const MAGO_HEAD={seed:41,age:20,thin:0,kid:1,smile:.5,lipU:.0040,lipL:.0052,lipUvol:.0012,lipLvol:.0017,mouthW:.0172,scalp:"none",hairC:0x17120f,beard:"none",
  skin:0xeccaae,skinRed:0xe6a694,skinLight:0xf5dcc8,lip:0xc8786e,lipColL:0xd08478,iris:[34,24,18],wrinkles:0,spots:0,eyeW:.0164,eyeOpenU:.0062,eyeOpenL:.0038,eyeTilt:.03,
  browDrop:.003,brow:0x2c2520,browHairs:90,browW:.7,cran:[1.10,1.16,1.10],cranOff:[0,.016,-.006],jaw:.78,nose:.62,browK:.55,cheekFat:1.12,hood:.5,earL:.86,neckR:.74,eyeR:.0134,gazePitch:.06,rough:.5};
function Sc(node,s){const f=node.f,b=node.bs;return{f:(x,y,z)=>s*f(x/s,y/s,z/s),bs:[b[0]*s,b[1]*s,b[2]*s,b[3]*s],k:node.k};}
function magoRig(pose){const R={pose};
  const held=pose==="held";let A;
  if(held){R.hip=[0,.075,-.02];R.TM=rotM(-.10,0,0);
    const tp=v=>add3(R.hip,apM(R.TM,v));R.tp=tp;
    R.sh={L:tp([.132,.335,-.012]),R:tp([-.132,.335,-.012])};R.pivot=tp([0,.405,.0]);R.headM=mulM(R.TM,rotM(.16,.08,0));R.gazeP=.22;
    R.hipJ={L:[.062,.055,0],R:[-.062,.055,0]};R.knee={L:[.088,.085,.25],R:[-.082,.08,.245]};R.ankle={L:[.08,-.13,.33],R:[-.074,-.135,.32]};
    R.UA=.165;R.FA=.145;
    A={L:{W:[.050,.215,.180],fwd:[-.45,-.05,.89],dor:[.85,.35,.3],hp:"hold",pole:[.8,-.5,-.3]},R:{W:[-.050,.215,.180],fwd:[.45,-.05,.89],dor:[-.85,.35,.3],hp:"hold",pole:[-.8,-.5,-.3]}};}
  else{R.hip=[0,.70,0];R.TM=rotM(.07,0,0);
    const tp=v=>add3(R.hip,apM(R.TM,v));R.tp=tp;
    R.sh={L:tp([.148,.42,-.012]),R:tp([-.148,.42,-.012])};R.pivot=tp([0,.53,.008]);R.headM=mulM(R.TM,rotM(.20,-.10,.03));R.gazeP=.12;
    R.hipJ={L:[.072,.69,0],R:[-.072,.69,0]};R.knee={L:[.095,.37,.035],R:[-.085,.37,.005]};R.ankle={L:[.105,.065,.0],R:[-.095,.065,-.035]};
    R.UA=.20;R.FA=.17;
    A={R:{W:[-.185,.76,.12],fwd:[.10,-.95,.30],dor:[-.95,.05,.10],hp:"grasp",pole:[-.6,-.2,-.8]},L:{W:[.17,.80,.20],fwd:[.05,-.55,.83],dor:[.75,.45,-.2],hp:"relax",pole:[.7,-.4,-.6]}};}
  R.arm={};for(const k of["L","R"]){const a=A[k];const ik=ik2(R.sh[k],a.W,R.UA,R.FA,a.pole);R.arm[k]={S:R.sh[k],E:ik.E,W:ik.T,fwd:a.fwd,dor:a.dor,hp:a.hp};}
  return R;}
// akome (girl, seated) / suikan + kukuri-bakama (boy, standing); world-space SDF pieces in head-scale units
function magoGarments(R){const held=R.pose==="held";
  const tl=held?[K(sEll([0,.050,-.020],[.150,.080,.125]),0),K(sEll([0,.150,-.012],[.135,.095,.108]),.05),K(sEll([0,.250,-.010],[.130,.085,.100]),.05),
      K(sEll([0,.310,-.020],[.128,.060,.094]),.04),K(sCap([.040,.345,-.022],[.125,.322,-.020],.036),.04),K(sCap([-.040,.345,-.022],[-.125,.322,-.020],.036),.04)]
    :[K(sEll([0,.040,-.012],[.140,.090,.110]),0),K(sEll([0,.150,-.010],[.132,.100,.104]),.05),K(sEll([0,.260,-.010],[.128,.095,.100]),.05),
      K(sEll([0,.335,-.024],[.128,.065,.094]),.04),K(sCap([.044,.405,-.026],[.135,.372,-.026],.036),.04),K(sCap([-.044,.405,-.026],[-.135,.372,-.026],.036),.04)];
  const torsoL=U(tl);const yN=held?.352:.415;
  let tor=S(torsoL,[K(sCone([0,yN-.05,-.008],[0,yN+.18,.016],.047,.050),.010)]);
  const parts=[tor];
  if(held){// overlapping V collar of the akome (left over right), white inner collar is the inner layer
    const v1=sRibbon([[.050,yN+.004,.040],[.020,yN-.050,.090],[-.030,yN-.120,.105]],[[.6,.3,.75],[.3,.2,.93],[0,.1,1]],.016,.006,.005);
    const v2=sRibbon([[-.050,yN+.004,.040],[-.018,yN-.040,.088],[.012,yN-.085,.098]],[[-.6,.3,.75],[-.3,.2,.93],[0,.1,1]],.014,.005,.005);
    parts.push(K(v1,.006),K(v2,.006));}
  else{// round agekubi collar + toggle; kikutoji tufts on the chest
    const ring=[],nr=[];for(let i=0;i<=16;i++){const a=i/16*2*PI;ring.push([Math.sin(a)*.064,yN+.010-.012*Math.cos(a),Math.cos(a)*.062-.008]);nr.push([Math.sin(a),0,Math.cos(a)]);}
    parts.push(K(sRibbon(ring,nr,.017,.008,.005),.005),K(sSphere([-.060,yN-.004,.032],.008),.004));
    for(const sx of[-1,1])parts.push(K(sSphere([sx*.045,yN-.11,.095],.011),.004),K(sSphere([sx*.045,yN-.155,.098],.010),.004));}
  const upperL=U(parts);const up=T(upperL,R.TM,R.hip);
  const inner=T({f:(x,y,z)=>torsoL.f(x,y,z)+.006,bs:torsoL.bs},R.TM,R.hip);
  const center=R.tp([0,.22,0]);const sl=[];
  for(const k of["L","R"]){const sp=sleevePiece(R.arm[k],held?{rU:.056,rE:.055,rC:.085,len:.36,hang:.15,center,seed:k==="L"?23:27,t:.010}:{rU:.060,rE:.058,rC:.092,len:.42,hang:.19,center,seed:k==="L"?33:37,t:.0105});sl.push(sp.F);}
  const cuffs=[];for(const k of["L","R"]){const A=R.arm[k];const fd=nrm3(sub3(A.W,A.E));cuffs.push(sCone(add3(A.W,scl3(fd,-.12)),add3(A.W,scl3(fd,-.026)),.042,.050));}
  // lower garments
  const low=[];const nz=makeNoise(91);
  if(held){// akome skirt over the lap + crimson hakama legs
    for(const k of["L","R"]){low.push(K(sCap(R.hipJ[k],R.knee[k],.078),.04),K(sSphere(R.knee[k],.074),.03),K(sCap(R.knee[k],R.ankle[k],.062),.04),K(sEll(R.ankle[k],[.058,.05,.06]),.03));}
    low.push(K(sEll([0,.07,-.01],[.17,.08,.15]),.05));}
  else{// kukuri-bakama: baggy to the knee, gathered with a tie just below it
    for(const k of["L","R"]){const h=R.hipJ[k],kn=R.knee[k];low.push(K(sCone(add3(h,[0,.07,0]),kn,.098,.104),0),K(sEll(add3(kn,[0,-.02,.008]),[.098,.075,.10]),.04));}
    low.push(K(sEll([0,.73,-.012],[.145,.10,.115]),.05));}
  let L=U(low);
  L=D(L,(x,y,z)=>{let d=0;for(const kn of[R.knee.L,R.knee.R]){const dx=x-kn[0],dz=z-kn[2];const r=sq(dx*dx+dz*dz);if(r>.3)continue;
      const a=Math.atan2(dz,dx);d+=.006*foldProfile(a*4+nz(a,r*3,y*4)*.9)*sstep(.03,.10,r)*sstep(.30,.18,r);}return d;},.007);
  const ties=[];if(!held)for(const k of["L","R"]){const kn=R.knee[k];ties.push(K(sCap(add3(kn,[0,-.085,.005]),add3(kn,[0,-.085,.006]),.052),0));}
  return{up,inner,sleeves:sl,cuffs:U(cuffs),lower:L,ties:ties.length?U(ties):null};}
// child hair: centre-parted bob, cut straight (head-local SDF)
function childHairSDF(P,cut){const cr=P.cran||[1,1,1],co=P.cranOff||[0,0,0];
  const cap=U([sEll([0,.044*cr[1]+co[1],-.010*cr[2]+co[2]],[.0815*cr[0],.0905*cr[1],.1005*cr[2]]),K(sEll([0,.080*cr[1]+co[1],.040],[.068*cr[0],.050,.060]),.03)]);
  const fall=U([K(sCap([.052,.020,-.028],[.060,cut+.012,-.040],.040),0),K(sCap([-.052,.020,-.028],[-.060,cut+.012,-.040],.040),.03),
    K(sCap([0,.030,-.058],[0,cut+.012,-.068],.050),.04)]);
  let F=U([cap,K(fall,.035)]);
  // open the face: forehead hairline and the cheeks stay clear; trim the ends straight
  F=S(F,[K({f:(x,y,z)=>mx(mx(ab(x)-.058,y-(.074-.012*sstep(.02,.055,ab(x)))),-.004-z),bs:[0,-.03,.06,.15]},.010),K({f:(x,y,z)=>cut-y,bs:[0,cut-.05,0,.2]},.004)]);
  const nz=makeNoise(57);
  F=D(F,(x,y,z)=>{const top=sstep(.05,.09,y);const part=-.0016*Math.exp(-(x*x)/(.0035*.0035))*top*sstep(-.06,.02,z);
    const a=Math.atan2(x,-z+.02);const strands=.00055*Math.sin(a*120+nz(x*40,y*12,z*40)*2.4)*(1-top*.6);
    const ends=.0012*Math.sin(x*260+nz(x*90,1,z*90)*3)*sstep(cut+.02,cut,y);return part+strands+ends;},.002);
  return F;}
function hiinaGroup(R,q){// little paper doll held by the girl (~6 cm): conical robes, white face, black hair
  const g=new THREE.Group();const mat=c=>R.add(new THREE.MeshStandardMaterial({color:c,roughness:.75,metalness:0}));
  const robe=new THREE.Mesh(R.add(new THREE.LatheGeometry([[0,0],[.018,0],[.016,.012],[.012,.03],[.006,.04],[0,.041]].map(p=>new THREE.Vector2(p[0],p[1])),q==="low"?10:18)),mat(0xb8323a));
  const inner=new THREE.Mesh(R.add(new THREE.LatheGeometry([[0,.026],[.009,.026],[.007,.036],[0,.039]].map(p=>new THREE.Vector2(p[0],p[1])),q==="low"?8:14)),mat(0xf2ead8));inner.position.z=.003;
  const head=new THREE.Mesh(R.add(new THREE.SphereGeometry(.0068,14,10)),mat(0xf6efe4));head.position.y=.047;
  const hair=new THREE.Mesh(R.add(new THREE.SphereGeometry(.0074,14,10,0,PI*2,0,PI*.62)),mat(0x111111));hair.position.y=.0485;hair.rotation.x=-.35;
  const tail=new THREE.Mesh(R.add(new THREE.CylinderGeometry(.0035,.002,.022,8)),mat(0x111111));tail.position.set(0,.036,-.006);tail.rotation.x=.15;
  [robe,inner,head,hair,tail].forEach(m=>{m.castShadow=true;m.receiveShadow=true;g.add(m);});return g;}
function gicchouGroup(R,q,len){// gicchou mallet: thin bamboo stick + barrel head; along -Y from the grip at the origin
  const g=new THREE.Group();const st=R.add(new THREE.MeshStandardMaterial({color:0xb79a62,roughness:.55}));const hd=R.add(new THREE.MeshStandardMaterial({color:0x8a5a34,roughness:.6}));
  const stick=new THREE.Mesh(R.add(new THREE.CylinderGeometry(.0085,.0095,len,q==="low"?6:10)),st);stick.position.y=-len*.42;g.add(stick);
  const head=new THREE.Mesh(R.add(new THREE.CylinderGeometry(.026,.026,.105,q==="low"?10:18)),hd);head.rotation.z=PI/2;head.position.y=-len*.92;g.add(head);
  for(const sx of[-1,1]){const band=new THREE.Mesh(R.add(new THREE.CylinderGeometry(.0275,.0275,.010,q==="low"?10:18)),R.add(new THREE.MeshStandardMaterial({color:0x7a2a24,roughness:.5})));
    band.rotation.z=PI/2;band.position.set(sx*.040,-len*.92,0);g.add(band);}
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return g;}
function makeMago(opts){opts=opts||{};const R=Res();const q=opts.quality||"high";const pose=opts.pose==="play"?"play":"held";const held=pose==="held";
  const sex=opts.sex||(held?"girl":"boy");const t0=performance.now();
  const g=new THREE.Group();g.name="mago_"+pose;const body=new THREE.Group();g.add(body);
  const k=opts.scale||(held?.76:.80);body.scale.setScalar(k);
  const rig=magoRig(pose);
  const HP=Object.assign({},MAGO_HEAD,{gazePitch:rig.gazeP,smile:held?.55:.4,seed:held?41:43},opts.headParams||{});
  const hd=buildHead(R,HP,q);
  const G=magoGarments(rig);
  // hands (child size) & socks
  const hands={};for(const kk of["L","R"]){const A=rig.arm[kk];const hs=handSDF(HANDP[A.hp]||HANDP.relax,{});let F=Sc(hs.F,.74);if(kk==="L")F=mirrorX(F);hands[kk]={F,M:basisYZ(A.fwd,A.dor),W:A.W};}
  const feet={};for(const kk of["L","R"]){let F=Sc(sockSDF(),.78);if(kk==="L")F=mirrorX(F);
    const M=held?basisYZ(nrm3(sub3(rig.knee[kk],rig.ankle[kk])),[0,-.2,1]):basisZY([kk==="L"?.12:-.08,0,1],[0,1,0]);feet[kk]={F,M,A:rig.ankle[kk]};}
  const headOrigin=add3(rig.pivot,apM(rig.headM,scl3(HEAD_PIV,-1)));
  const prox=U([T(U([sEll([0,.03,0],[.078,.10,.095]),sCap([0,-.03,-.015],[0,-.15,-.005],.045)]),rig.headM,headOrigin)].concat(["L","R"].map(kk=>T(sCap([0,-.03,0],[0,.09,0],.024),hands[kk].M,hands[kk].W))),0);
  const upF=G.up.f,slF=G.sleeves.map(x=>x.f),loF=G.lower.f,inF=G.inner.f;
  const Gall=(x,y,z)=>mn(upF(x,y,z),slF[0](x,y,z),slF[1](x,y,z),loF(x,y,z),prox.f(x,y,z),inF(x,y,z),held?y+.2:y);
  const hR=q==="low"?.020:q==="medium"?.016:.013;const key="mago|"+pose+"|"+q;
  const bb0=held?[-.42,-.25,-.32]:[-.55,.40,-.40],bb1=held?[.42,.62,.52]:[.55,1.32,.55];
  const greyAO=()=>[1,1,1];
  const pU=buildPart(U([G.up,K(G.sleeves[0],.010),K(G.sleeves[1],.010)]),bb0,bb1,hR,null,null,Gall,.014,1.3,greyAO,{aoN:3,aoMin:.14,key:key+"|up"});
  const pI=buildPart({f:(x,y,z)=>mx(inF(x,y,z),-mn(upF(x,y,z)+.002,1)),bs:G.inner.bs},bb0,bb1,q==="low"?.011:.008,null,null,Gall,.010,1.2,()=>lin(0xf0ebe0),{aoN:3,aoMin:.22,key:key+"|in"});
  const pC=buildPart(G.cuffs,bb0,bb1,.006,null,null,Gall,.009,1.0,()=>lin(held?0xf3e4e2:0xf0ebe0),{aoN:3,aoMin:.22,key:key+"|cf"});
  const pL=buildPart(G.lower,held?[-.30,-.30,-.30]:[-.32,.20,-.30],held?[.30,.20,.48]:[.32,.90,.32],hR,null,null,Gall,.014,1.3,greyAO,{aoN:3,aoMin:.14,key:key+"|lo"});
  // colours: girl = kobai (plum-red) akome with small roundels over deep crimson hakama; boy = moegi suikan with white roundels over purple bakama
  const upTex=held?patternTex(R,{ground:"#b4334a",fig:"#f2c7cf",fig2:"#f7e0b0",r:.16,px:256,seed:7}):patternTex(R,{ground:"#7d9a3a",fig:"#eef2dc",fig2:"#f7ecc0",r:.17,px:256,seed:9});
  const loTex=held?patternTex(R,{ground:"#6a1c2c",fig:"#7a2636",fig2:"#82303e",r:.12,px:128,alpha:.25,seed:11}):patternTex(R,{ground:"#5d3d72",fig:"#c9b4dc",fig2:"#e8dcf0",r:.14,px:256,alpha:.75,seed:13});
  const whiteMat=clothMat(R,{rough:.8});
  body.add(meshOf(R,pU,triMat(R,upTex,{scale:held?4.2:3.6,rough:.66})));
  body.add(meshOf(R,mergePolys([pI,pC]),whiteMat));
  body.add(meshOf(R,pL,triMat(R,loTex,{scale:held?6:4.5,rough:.7})));
  if(G.ties){const pT=buildPart(G.ties,[-.3,.15,-.2],[.3,.4,.2],.006,null,null,Gall,.009,1.0,()=>lin(0xe8e2d4),{aoN:2,aoMin:.3,key:key+"|tie"});body.add(meshOf(R,pT,whiteMat));
    // bare shins below the ties
    const skinM0=skinMat(R,{rough:.55});
    for(const kk of["L","R"]){const kn=rig.knee[kk],an=rig.ankle[kk];const F=sCone(add3(kn,[0,-.09,.006]),add3(an,[0,.03,0]),.036,.031);
      const pS=buildPart(F,[-.3,0,-.2],[.3,.4,.2],.007,null,null,null,0,0,skinPainter(HP,"foot",null),{key:key+"|shin"+kk});body.add(meshOf(R,pS,skinM0));}}
  const skinM=skinMat(R,{rough:.55});const hh=q==="low"?.0055:q==="medium"?.004:.003;
  const handPiv={};for(const kk of["L","R"]){const H_=hands[kk];const poly=buildPart(H_.F,[-.05,-.055,-.045],[.05,.15,.045],hh,H_.M,H_.W,(x,y,z)=>mn(upF(x,y,z),slF[0](x,y,z),slF[1](x,y,z),loF(x,y,z)),.007,1.0,skinPainter(HP,"hand",null),{aoMin:.38,key:key+"|h"+kk});
    const piv=new THREE.Object3D();placeObj(piv,H_.M,H_.W);piv.add(meshOf(R,poly,skinM));handPiv[kk]=piv;body.add(piv);}
  const sockM=clothMat(R,{rough:.85});
  for(const kk of["L","R"]){const Fd=feet[kk];const poly=buildPart(Fd.F,[-.055,-.075,-.085],[.055,.13,.18],q==="low"?.0065:.0045,Fd.M,Fd.A,(x,y,z)=>mn(loF(x,y,z),held?1:y),.009,1.0,()=>lin(0xf2efe8),{aoMin:.38,key:key+"|f"+kk});
    const sm=meshOf(R,poly,sockM);placeObj(sm,Fd.M,Fd.A);body.add(sm);}
  // head + hair
  const pivot=new THREE.Object3D();placeObj(pivot,rig.headM,rig.pivot);hd.group.position.set(-HEAD_PIV[0],-HEAD_PIV[1],-HEAD_PIV[2]);pivot.add(hd.group);body.add(pivot);
  const hs=held?1.13:1.1;pivot.scale.setScalar(hs);
  {const cut=held?-.150:-.112;const HF=childHairSDF(HP,cut);const hc=lin(HP.hairC);const hq=q==="low"?.0042:q==="medium"?.0032:.0026;
    const hp=cachePoly("mhair|"+q+"|"+cut+"|"+HP.seed,()=>{const pl=polygonize(HF.f,[-.115,cut-.02,-.135],[.115,.165,.12],hq,{levels:3,lip:1.4,seedS:2});
      const ao=bakeAO(pl,(x,y,z)=>mn(HF.f(x,y,z),hd.H.F.f(x,y,z)),.004,3,1.2);
      paint(pl,(x,y,z,nx,ny,nz)=>{const sheen=.82+.35*Math.pow(mx(0,ny*.6+nz*.5),3)+.08*N2(x*300,y*60,z*300);return mulc(hc,sheen);},ao,.35);return pl;});
    const hm=new THREE.Mesh(R.add(toGeom(hp)),R.add(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.56,metalness:0})));hm.castShadow=true;hm.receiveShadow=true;hd.group.add(hm);}
  const anchors={};const eyesA=new THREE.Object3D();eyesA.position.set(0,.0245,.085);hd.group.add(eyesA);anchors.eyes=eyesA;
  // props
  if(held){const doll=hiinaGroup(R,q);doll.scale.setScalar(1/k);doll.position.set(0,.215,.215);doll.rotation.x=-.15;body.add(doll);anchors.doll=doll;}
  else{const len=.72/k;const mallet=gicchouGroup(R,q,len);const grip=add3(rig.arm.R.W,[0,.0,.0]);
    const tip=[-.24,.03,.50];const dir=nrm3(sub3(tip,grip));mallet.position.set(grip[0],grip[1],grip[2]);
    mallet.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),new THREE.Vector3(dir[0],dir[1],dir[2]));mallet.position.add(new THREE.Vector3(dir[0],dir[1],dir[2]).multiplyScalar(-.08));
    body.add(mallet);anchors.mallet=mallet;
    const ball=new THREE.Mesh(R.add(new THREE.SphereGeometry(.036/k,18,14)),R.add(new THREE.MeshStandardMaterial({color:0x9a6a3c,roughness:.5})));
    ball.position.set(-.10,.036/k,.62);ball.castShadow=true;ball.receiveShadow=true;body.add(ball);anchors.ball=ball;}
  g.userData.anchors=anchors;g.userData.head=pivot;
  const pivR=pivot.quaternion.clone(),eu=new THREE.Euler(),qq=new THREE.Quaternion();const hR0=handPiv.R.position.clone(),hL0=handPiv.L.position.clone();
  g.userData.update=function(dt,t){const br=Math.sin(t*1.9);
    eu.set(Math.sin(t*.6)*.025,Math.sin(t*.37)*.05,Math.sin(t*.5)*.02);qq.setFromEuler(eu);pivot.quaternion.copy(pivR).multiply(qq);
    body.position.y=br*.002;
    if(held){handPiv.R.position.set(hR0.x,hR0.y+.004*Math.sin(t*1.3),hR0.z);handPiv.L.position.set(hL0.x,hL0.y+.004*Math.sin(t*1.3+.4),hL0.z);
      if(anchors.doll){anchors.doll.rotation.z=.08*Math.sin(t*1.1);anchors.doll.position.y=.215+.004*Math.sin(t*1.3);}}};
  g.userData.dispose=function(){R.dispose();};
  let tris=0,meshes=0;g.traverse(o=>{if(o.isMesh){meshes++;const gg=o.geometry;tris+=(gg.index?gg.index.count:gg.attributes.position.count)/3;}});
  g.userData.stats={ms:performance.now()-t0,tris,meshes};
  return g;}
return{makeKenko,makeRoujin,makeMago,_dev:{headSDF,polygonize,bakeAO,POLY_STATS,kenkoRig,kenkoRobe,handSDF,footSDF,HANDP,T,U}};
})();
