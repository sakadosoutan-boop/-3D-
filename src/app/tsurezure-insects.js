/* ==== TSURE_INSECTS (draft header; API doc written at the end) ==== */
const TSURE_INSECTS=(()=>{
"use strict";
/* ------------------------------------------------------------------
   0. small utilities
   ------------------------------------------------------------------ */
const V3=THREE.Vector3;
const PI=Math.PI,TAU=Math.PI*2;
const clamp=(x,a,b)=>x<a?a:(x>b?b:x);
const lerp=(a,b,t)=>a+(b-a)*t;
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function RNG(seed){let s=(seed>>>0)||1;const f=()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
  f.r=(a,b)=>a+(b-a)*f();f.s=()=>f()*2-1;return f;}
function qlevel(o){const q=o&&o.quality;return q==="low"?0:(q==="medium"?1:2);}
const QS=(ql,lo,me,hi)=>ql===0?lo:(ql===1?me:hi);

/* Catmull-Rom on 2D point lists */
function cr1(p0,p1,p2,p3,t){const t2=t*t,t3=t2*t;return .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3);}
function crPts(pts,closed,per){const out=[],n=pts.length,segs=closed?n:n-1;
  for(let i=0;i<segs;i++){const p0=pts[closed?(i-1+n)%n:Math.max(i-1,0)],p1=pts[i],p2=pts[(i+1)%n],p3=pts[closed?(i+2)%n:Math.min(i+2,n-1)];
    for(let k=0;k<per;k++){const t=k/per;out.push([cr1(p0[0],p1[0],p2[0],p3[0],t),cr1(p0[1],p1[1],p2[1],p3[1],t)]);}}
  if(!closed)out.push(pts[n-1].slice());return out;}
/* 1-D table (sorted keys) -> smooth interpolation of several columns */
function table(rows){const n=rows.length;return function(z){
  if(z<=rows[0][0])return rows[0].slice(1);if(z>=rows[n-1][0])return rows[n-1].slice(1);
  let i=0;while(i<n-2&&z>rows[i+1][0])i++;const a=rows[Math.max(i-1,0)],b=rows[i],c=rows[i+1],d=rows[Math.min(i+2,n-1)];
  const t=(z-b[0])/(c[0]-b[0]);const out=[];for(let k=1;k<b.length;k++){
    // monotone-ish: clamp CR result between neighbours to avoid overshoot
    let v=cr1(a[k],b[k],c[k],d[k],t);const lo=Math.min(b[k],c[k]),hi=Math.max(b[k],c[k]);const sl=(hi-lo)*.35;v=clamp(v,lo-sl,hi+sl);out.push(v);}return out;};}

/* ------------------------------------------------------------------
   1. geometry helpers (all built in millimetres, the factory root is scaled 0.001)
   ------------------------------------------------------------------ */
function mkGeo(pos,uv,idx,extra){const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
  if(extra)for(const k in extra)g.setAttribute(k,new THREE.Float32BufferAttribute(extra[k].a,extra[k].n));
  g.setIndex(idx);g.computeVertexNormals();return g;}
/* average normals of coincident vertices (closes loft/sweep seams and poles) */
function weld(g,eps){eps=eps||1e-4;const p=g.attributes.position.array,n=g.attributes.normal.array,c=p.length/3,inv=1/eps,map=new Map();
  for(let i=0;i<c;i++){const k=Math.round(p[3*i]*inv)+","+Math.round(p[3*i+1]*inv)+","+Math.round(p[3*i+2]*inv);let a=map.get(k);if(!a){a=[];map.set(k,a);}a.push(i);}
  map.forEach(a=>{if(a.length<2)return;let x=0,y=0,z=0;for(const i of a){x+=n[3*i];y+=n[3*i+1];z+=n[3*i+2];}const l=Math.hypot(x,y,z)||1;for(const i of a){n[3*i]=x/l;n[3*i+1]=y/l;n[3*i+2]=z/l;}});
  g.attributes.normal.needsUpdate=true;return g;}
function gridIdx(nI,nJ,flip){const idx=[];for(let i=0;i<nI;i++)for(let j=0;j<nJ;j++){const a=i*(nJ+1)+j,b=(i+1)*(nJ+1)+j;
  if(!flip){idx.push(a,a+1,b,a+1,b+1,b);}else{idx.push(a,b,a+1,a+1,b,b+1);}}return idx;}
function ensure(g,name,size,val){if(!g.attributes[name]){const c=g.attributes.position.count,a=new Float32Array(c*size);if(val)for(let i=0;i<c;i++)for(let k=0;k<size;k++)a[i*size+k]=val[k];g.setAttribute(name,new THREE.BufferAttribute(a,size));}return g;}
function merge(list,keys){keys=keys||["position","normal","uv"];let nv=0,ni=0;
  for(const g of list){nv+=g.attributes.position.count;ni+=g.index?g.index.count:g.attributes.position.count;}
  const out={},sz={};for(const k of keys){sz[k]=list[0].attributes[k].itemSize;out[k]=new Float32Array(nv*sz[k]);}
  const idx=nv>65535?new Uint32Array(ni):new Uint16Array(ni);let vo=0,io=0;
  for(const g of list){const c=g.attributes.position.count;for(const k of keys){const a=g.attributes[k];if(!a)throw new Error("merge: missing "+k);out[k].set(a.array.subarray?a.array.subarray(0,c*sz[k]):a.array,vo*sz[k]);}
    if(g.index){const ia=g.index.array;for(let i=0;i<ia.length;i++)idx[io+i]=ia[i]+vo;io+=ia.length;}else{for(let i=0;i<c;i++)idx[io+i]=vo+i;io+=c;}vo+=c;}
  const G=new THREE.BufferGeometry();for(const k of keys)G.setAttribute(k,new THREE.BufferAttribute(out[k],sz[k]));G.setIndex(new THREE.BufferAttribute(idx,1));G.computeBoundingSphere();
  for(const g of list)g.dispose();return G;}
/* mirror a geometry across x=0 (positions, normals) and fix winding */
function mirrorX(g){const h=g.clone();const p=h.attributes.position.array,n=h.attributes.normal.array;for(let i=0;i<p.length;i+=3){p[i]=-p[i];n[i]=-n[i];}
  const ix=h.index.array;for(let i=0;i<ix.length;i+=3){const t=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=t;}return h;}
function xformGeo(g,m){g.applyMatrix4(m);return g;}
/* remap uv (0..1) into atlas rect [u0,v0,u1,v1] */
function uvRect(g,r){const a=g.attributes.uv.array;for(let i=0;i<a.length;i+=2){a[i]=r[0]+a[i]*(r[2]-r[0]);a[i+1]=r[1]+a[i+1]*(r[3]-r[1]);}return g;}

/* Superellipse half-section point. S={cx,cy,w,ht,hb,pt,pb} th in [0,2pi): th=0 -> +x, pi/2 -> top */
function secPt(S,th){const c=Math.cos(th),s=Math.sin(th),top=s>=0,p=top?S.pt:S.pb,e=2/p;
  return[(S.cx||0)+S.w*Math.sign(c)*Math.pow(Math.abs(c),e),S.cy+(top?S.ht:S.hb)*Math.sign(s)*Math.pow(Math.abs(s),e)];}
/* Lofted body along +z. spec: {z0,z1,n,m,sec(z)->S, bump(x,y,z,top)->dy, uv(a,z,top)->[u,v], def(z)->float, zmap(s)->s} */
function loft(spec){const n=spec.n,m=spec.m,geos=[];
  for(const top of [true,false]){const pos=[],uv=[],def=[];
    for(let i=0;i<=n;i++){let s=i/n;if(spec.zmap)s=spec.zmap(s);const z=lerp(spec.z0,spec.z1,s);const S=spec.sec(z);
      const ring=[];for(let j=0;j<=m;j++){const th=top?j/m*PI:PI+j/m*PI;const p=secPt(S,th);let y=p[1];if(spec.bump)y+=spec.bump(p[0],y,z,top,th);ring.push([p[0],y]);}
      // arc length from the dorsal/ventral midline (j=m/2)
      const cum=[0];for(let j=1;j<=m;j++)cum.push(cum[j-1]+Math.hypot(ring[j][0]-ring[j-1][0],ring[j][1]-ring[j-1][1]));const mid=cum[m>>1];
      for(let j=0;j<=m;j++){pos.push(ring[j][0],ring[j][1],z);
        const a=top?(mid-cum[j]):(cum[j]-mid); // >0 on +x side (both halves)
        const t=spec.uv(a,z,top);uv.push(t[0],t[1]);def.push(spec.def?spec.def(z):0);}}
    geos.push(mkGeo(pos,uv,gridIdx(n,m,false),{aDef:{a:def,n:1}}));}
  const g=merge(geos,["position","normal","uv","aDef"]);return weld(g,1e-3);}
/* perimeter of the top half from the midline to the side at a given section (for painting) */
function quarterArc(S,top){let L=0,pr=secPt(S,top?PI/2:PI*1.5);for(let k=1;k<=48;k++){const th=top?PI/2-k/48*PI/2:PI*1.5+k/48*PI/2;const p=secPt(S,th);L+=Math.hypot(p[0]-pr[0],p[1]-pr[1]);pr=p;}return L;}

/* Sweep an (elliptic) tube along a 3D polyline. opts: {pts:[V3], m, r(t)->[rx,ry], up:V3, uv:[u0,v0,u1,v1], cap0,cap1, mod(t,phi)->scale, def:float, twist} */
function sweep(o){const P=o.pts,N=P.length,m=o.m||8;const T=[],Nn=[],B=[],L=[0];
  for(let i=0;i<N;i++){const a=P[Math.max(i-1,0)],b=P[Math.min(i+1,N-1)];T.push(new V3().subVectors(b,a).normalize());if(i)L.push(L[i-1]+P[i].distanceTo(P[i-1]));}
  const tot=L[N-1]||1;let up=(o.up||new V3(0,1,0)).clone();let n0=up.clone().sub(T[0].clone().multiplyScalar(up.dot(T[0])));if(n0.lengthSq()<1e-8)n0=new V3(1,0,0).sub(T[0].clone().multiplyScalar(T[0].x));n0.normalize();
  for(let i=0;i<N;i++){if(i>0){const nn=Nn[i-1].clone().sub(T[i].clone().multiplyScalar(Nn[i-1].dot(T[i])));if(nn.lengthSq()<1e-10)nn.copy(Nn[i-1]);Nn.push(nn.normalize());}else Nn.push(n0);B.push(new V3().crossVectors(T[i],Nn[i]).normalize());}
  const rings=[];// [center, n, b, rx, ry, v]
  const capR=(i,end)=>{};
  const rr=t=>{const r=o.r(t);return Array.isArray(r)?r:[r,r];};
  const c0=o.cap0||0,c1=o.cap1||0;
  if(c0){const r=rr(0);for(let k=c0;k>=1;k--){const al=k/(c0+0.0001)*PI/2*.98;const f=Math.cos(al);rings.push([P[0].clone().addScaledVector(T[0],-Math.sin(al)*Math.min(r[0],r[1])),Nn[0],B[0],r[0]*f,r[1]*f,-.0001*k,0]);}}
  for(let i=0;i<N;i++){const t=L[i]/tot;const r=rr(t);rings.push([P[i],Nn[i],B[i],r[0],r[1],t,t]);}
  if(c1){const r=rr(1);for(let k=1;k<=c1;k++){const al=k/(c1+0.0001)*PI/2*.98;const f=Math.cos(al);rings.push([P[N-1].clone().addScaledVector(T[N-1],Math.sin(al)*Math.min(r[0],r[1])),Nn[N-1],B[N-1],r[0]*f,r[1]*f,1+.0001*k,1]);}}
  const pos=[],uv=[],R=o.uv||[0,0,1,1];
  for(let i=0;i<rings.length;i++){const[c,n,b,rx,ry,v,tt]=rings[i];for(let j=0;j<=m;j++){const ph=j/m*TAU+(o.twist||0);let sx=Math.cos(ph)*rx,sy=Math.sin(ph)*ry;if(o.mod){const k=o.mod(tt,ph);sx*=k;sy*=k;}
    pos.push(c.x+b.x*sx+n.x*sy,c.y+b.y*sx+n.y*sy,c.z+b.z*sx+n.z*sy);uv.push(R[0]+(j/m)*(R[2]-R[0]),R[1]+clamp(v,0,1)*(R[3]-R[1]));}}
  const g=mkGeo(pos,uv,gridIdx(rings.length-1,m,true));weld(g,1e-4);
  if(o.def!==undefined)ensure(g,"aDef",1,[o.def]);return g;}
function curvePts(ctrl,n){const c=new THREE.CatmullRomCurve3(ctrl,false,"centripetal");return c.getPoints(n);}
/* deformed ellipsoid (sphere param) with uv rect */
function ellip(c,r,ws,hs,uvr,rot){const g=new THREE.SphereGeometry(1,ws,hs);g.scale(r[0],r[1],r[2]);if(rot)g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0],rot[1],rot[2])));g.translate(c[0],c[1],c[2]);if(uvr)uvRect(g,uvr);return g;}

/* ------------------------------------------------------------------
   2. canvas / texture helpers
   ------------------------------------------------------------------ */
const CTXO={willReadFrequently:true};// CPU-backed 2D canvases: we read pixels back, and GPU-emulated canvases are 10-25x slower for that
function mkCanvas(w,h){const c=document.createElement("canvas");c.width=w;c.height=h;return c;}
function cTex(c,srgb,aniso){const t=new THREE.CanvasTexture(c);if(srgb)t.encoding=THREE.sRGBEncoding;t.anisotropy=aniso||8;t.needsUpdate=true;return t;}
function mid2(a,b){return[(a[0]+b[0])/2,(a[1]+b[1])/2];}
function tracePath(ctx,pts,closed){const n=pts.length;ctx.beginPath();if(n<2)return;
  if(closed){const m=mid2(pts[n-1],pts[0]);ctx.moveTo(m[0],m[1]);for(let i=0;i<n;i++){const p=pts[i],q=mid2(p,pts[(i+1)%n]);ctx.quadraticCurveTo(p[0],p[1],q[0],q[1]);}ctx.closePath();}
  else{ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<n-1;i++){const p=pts[i],q=mid2(p,pts[i+1]);ctx.quadraticCurveTo(p[0],p[1],q[0],q[1]);}ctx.lineTo(pts[n-1][0],pts[n-1][1]);}}
/* fill a path with blurred edge (shadow trick, works without ctx.filter) */
function softFill(ctx,pts,color,blur,closed){ctx.save();if(blur>0.5){const OFF=20000;ctx.shadowColor=color;ctx.shadowBlur=blur;ctx.shadowOffsetX=OFF;ctx.fillStyle=color;
    tracePath(ctx,pts.map(p=>[p[0]-OFF,p[1]]),closed!==false);ctx.fill();}else{ctx.fillStyle=color;tracePath(ctx,pts,closed!==false);ctx.fill();}ctx.restore();}
function softStroke(ctx,pts,color,width,blur){ctx.save();ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=width;if(blur>0.5){const OFF=20000;ctx.shadowColor=color;ctx.shadowBlur=blur;ctx.shadowOffsetX=OFF;ctx.strokeStyle=color;
    tracePath(ctx,pts.map(p=>[p[0]-OFF,p[1]]),false);ctx.stroke();}else{ctx.strokeStyle=color;tracePath(ctx,pts,false);ctx.stroke();}ctx.restore();}
function softDot(ctx,x,y,r,color,blur){ctx.save();const OFF=20000;if(blur>0.5){ctx.shadowColor=color;ctx.shadowBlur=blur;ctx.shadowOffsetX=OFF;}ctx.fillStyle=color;ctx.beginPath();ctx.arc(x-(blur>0.5?OFF:0),y,Math.max(r,.3),0,TAU);ctx.fill();ctx.restore();}
/* seeded value-noise canvas */
function noiseCanvas(rng,n,mono){const c=mkCanvas(n,n),x=c.getContext("2d",CTXO),d=x.createImageData(n,n);for(let i=0;i<n*n;i++){const v=rng()*255|0;d.data[i*4]=v;d.data[i*4+1]=mono?v:rng()*255|0;d.data[i*4+2]=mono?v:rng()*255|0;d.data[i*4+3]=255;}x.putImageData(d,0,0);return c;}
function noiseLayer(ctx,nc,x,y,w,h,alpha,op){ctx.save();ctx.globalAlpha=alpha;if(op)ctx.globalCompositeOperation=op;ctx.imageSmoothingEnabled=true;ctx.drawImage(nc,x,y,w,h);ctx.restore();}
/* fast crisp polygon / polyline rasterisation (no shadow blur: shadow blur is very slow in software canvases) */
function fillPoly(ctx,pts,col){ctx.fillStyle=col;tracePath(ctx,pts,true);ctx.fill();}
function strokePoly(ctx,pts,col,w){ctx.strokeStyle=col;ctx.lineWidth=w;ctx.lineCap="round";ctx.lineJoin="round";tracePath(ctx,pts,false);ctx.stroke();}
function gdot(ctx,x,y,r,rgb,a){if(r<.4)r=.4;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,"rgba("+rgb+","+a+")");g.addColorStop(.55,"rgba("+rgb+","+(a*.6)+")");g.addColorStop(1,"rgba("+rgb+",0)");ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r);}
/* separable box blur of a single-channel Uint8Array (in place), 2 iterations ~ gaussian */
function boxBlur1(a,w,h,r,it){r=Math.round(r);if(r<1)return a;const t=new Float32Array(w*h),n=2*r+1;
  for(let k=0;k<(it||2);k++){for(let y=0;y<h;y++){const o=y*w;let acc=0;for(let x=-r;x<=r;x++)acc+=a[o+(x<0?0:(x>=w?w-1:x))];
      for(let x=0;x<w;x++){t[o+x]=acc/n;const xa=x+r+1,xb=x-r;acc+=a[o+(xa>=w?w-1:xa)]-a[o+(xb<0?0:xb)];}}
    for(let x=0;x<w;x++){let acc=0;for(let y=-r;y<=r;y++)acc+=t[(y<0?0:(y>=h?h-1:y))*w+x];
      for(let y=0;y<h;y++){a[y*w+x]=acc/n;const ya=y+r+1,yb=y-r;acc+=t[(ya>=h?h-1:ya)*w+x]-t[(yb<0?0:yb)*w+x];}}}
  return a;}
/* box blur a rectangular region of an RGBA canvas */
function blurRegion(ctx,x0,y0,w,h,r){x0=Math.round(x0);y0=Math.round(y0);w=Math.round(w);h=Math.round(h);const im=ctx.getImageData(x0,y0,w,h),d=im.data,ch=new Uint8Array(w*h);
  for(let c=0;c<3;c++){for(let i=0;i<w*h;i++)ch[i]=d[i*4+c];boxBlur1(ch,w,h,r,2);for(let i=0;i<w*h;i++)d[i*4+c]=ch[i];}ctx.putImageData(im,x0,y0);}
/* random grain tile (fast per-pixel noise lookups) */
function grainTile(rng,n){const a=new Float32Array(n*n);for(let i=0;i<n*n;i++)a[i]=rng();return a;}
/* seeded 2D value noise (smooth) */
function vnoise(seed){const r=RNG(seed),P=new Uint8Array(512),Vv=new Float32Array(256);for(let i=0;i<256;i++){P[i]=i;Vv[i]=r();}
  for(let i=255;i>0;i--){const j=(r()*(i+1))|0;const t=P[i];P[i]=P[j];P[j]=t;}for(let i=0;i<256;i++)P[i+256]=P[i];
  return function(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,X=xi&255,Y=yi&255;
    const a=Vv[P[P[X]+Y]],b=Vv[P[P[X+1]+Y]],c=Vv[P[P[X]+Y+1]],d=Vv[P[P[X+1]+Y+1]];const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;};}
/* height canvas -> tangent-space normal map canvas */
function heightToNormal(hc,strength){const w=hc.width,h=hc.height,src=hc.getContext("2d",CTXO).getImageData(0,0,w,h).data,oc=mkCanvas(w,h),ox=oc.getContext("2d",CTXO),od=ox.createImageData(w,h),o=od.data;
  for(let y=0;y<h;y++){const yu=y>0?y-1:y,yd=y<h-1?y+1:y;for(let x=0;x<w;x++){const xl=x>0?x-1:x,xr=x<w-1?x+1:x;
    const dx=(src[(y*w+xr)*4]-src[(y*w+xl)*4])/255*strength,dy=(src[(yu*w+x)*4]-src[(yd*w+x)*4])/255*strength;
    let nx=-dx,ny=-dy,nz=1;const l=Math.hypot(nx,ny,nz);const i=(y*w+x)*4;o[i]=(nx/l*.5+.5)*255;o[i+1]=(ny/l*.5+.5)*255;o[i+2]=(nz/l*.5+.5)*255;o[i+3]=255;}}
  ox.putImageData(od,0,0);return oc;}

/* ------------------------------------------------------------------
   3. shader patches (shared by all materials)
   - fake sky reflection when scene.environment is absent (uses hemisphere light colours)
   - wing translucency (back-lit glow) and specular glint that raises alpha
   - abdomen deformation (aDef attribute) for singing/breathing
   ------------------------------------------------------------------ */
function patchMat(mat,o){o=o||{};const U={uTime:{value:0},uSing:{value:0},uBreath:{value:1},uJoint:{value:new V3()},uFakeEnv:{value:o.fakeEnv!=null?o.fakeEnv:1},
    uTransl:{value:o.transl||0},uGlint:{value:o.glint||0},uPupil:{value:o.pupil||0},uTint:{value:new THREE.Color(0,0,0)}};
  mat.userData.U=U;const key="tsureIns:"+(o.def?"d":"")+(o.transl?"t":"")+(o.glint?"g":"")+(o.pupil?"p":"")+(o.tint?"c":"")+(o.flapAttr?"f":"");
  mat.customProgramCacheKey=()=>key;
  mat.onBeforeCompile=(sh)=>{Object.assign(sh.uniforms,U);
    let vs=sh.vertexShader,fs=sh.fragmentShader;
    if(o.def){vs=vs.replace("#include <common>","#include <common>\nattribute float aDef;uniform float uTime;uniform float uSing;uniform float uBreath;uniform vec3 uJoint;\n"+
      "float tsPh(){return .5+.5*sin(uTime*6.2831*1.62);}\nfloat tsBz(){return .5*sin(uTime*6.2831*23.3)+.5*sin(uTime*6.2831*31.7+1.3);}\n"+
      "float tsAng(float w){float ph=tsPh();return (uSing*(.075+.065*ph+.012*tsBz())+uBreath*.006*sin(uTime*2.3))*pow(w,1.3);}\n"+
      "vec3 tsRotX(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x,p.y*c-p.z*s,p.y*s+p.z*c);}\n");
      vs=vs.replace("#include <beginnormal_vertex>","vec3 objectNormal = vec3( normal );\nif(aDef>0.0){objectNormal=tsRotX(objectNormal,tsAng(aDef));}\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif\n");
      vs=vs.replace("#include <begin_vertex>","vec3 transformed = vec3( position );\nif(aDef>0.0){float w=aDef;float ph=tsPh();float bz=tsBz();vec3 p=transformed-uJoint;\n"+
        "float ext=uSing*(.55*ph+.16*bz)*w+uBreath*.05*sin(uTime*2.3)*w;p.z-=ext;\n"+
        "float rs=1.+uSing*(.028*bz+.03*ph)*w*(1.-w*.4)+uBreath*.012*sin(uTime*2.3+.6)*w;p.xy*=rs;\n"+
        "p=tsRotX(p,tsAng(w));transformed=p+uJoint;}\n");}
    if(o.flapAttr){vs=vs.replace("#include <common>","#include <common>\n"+o.flapAttr.decl);vs=vs.replace("#include <beginnormal_vertex>",o.flapAttr.normal);vs=vs.replace("#include <begin_vertex>",o.flapAttr.pos);}
    fs=fs.replace("#include <common>","#include <common>\nuniform float uFakeEnv;uniform float uTransl;uniform float uGlint;uniform float uPupil;uniform vec3 uTint;\n");
    if(o.pupil){fs=fs.replace("#include <normal_fragment_maps>","#include <normal_fragment_maps>\n{float nv=dot(normal,normalize(vViewPosition));float pp=smoothstep(.93,.995,nv);diffuseColor.rgb*=1.-uPupil*pp;}\n");}
    // fake env: hemisphere-coloured reflection when no env map is bound
    fs=fs.replace("#include <lights_fragment_maps>","#include <lights_fragment_maps>\n#ifndef USE_ENVMAP\n#if NUM_HEMI_LIGHTS > 0\n#if defined( RE_IndirectSpecular )\n{vec3 rv=reflect(-geometry.viewDir,geometry.normal);float k=dot(rv,hemisphereLights[0].direction)*.5+.5;"+
      "vec3 sky=hemisphereLights[0].skyColor/PI;vec3 gnd=hemisphereLights[0].groundColor/PI;float rg=material.specularRoughness;"+
      "vec3 sharp=mix(gnd,sky*1.25,smoothstep(.42,.62,k));vec3 blur=mix(gnd,sky,k);radiance+=mix(sharp,blur,clamp(rg*1.4,0.,1.))*uFakeEnv;\n"+
      "#ifdef CLEARCOAT\n{vec3 rc=reflect(-geometry.viewDir,geometry.clearcoatNormal);float kc=dot(rc,hemisphereLights[0].direction)*.5+.5;clearcoatRadiance+=mix(gnd,sky*1.25,smoothstep(.4,.64,kc))*uFakeEnv;}\n#endif\n}\n#endif\n#endif\n#endif\n");
    if(o.transl||o.glint||o.tint){fs=fs.replace("#include <lights_fragment_end>","#include <lights_fragment_end>\n"+
      (o.transl?"#if NUM_DIR_LIGHTS > 0\n{vec3 tr=vec3(0.);for(int i=0;i<NUM_DIR_LIGHTS;i++){float bk=max(0.,-dot(geometry.normal,directionalLights[i].direction));float vw=max(0.,dot(-geometry.viewDir,directionalLights[i].direction));tr+=directionalLights[i].color*(bk*.55+pow(vw,6.)*.8);}reflectedLight.directDiffuse+=diffuseColor.rgb*tr*uTransl;}\n#endif\n":"")+
      (o.glint?"{float sl=dot(reflectedLight.directSpecular+reflectedLight.indirectSpecular,vec3(.3333));diffuseColor.a=clamp(diffuseColor.a+sl*uGlint,0.,1.);}\n":"")+
      (o.tint?"reflectedLight.directDiffuse+=uTint*diffuseColor.rgb;\n":""));}
    sh.vertexShader=vs;sh.fragmentShader=fs;};
  return U;}

/* ==================================================================
   4. MINMIN-ZEMI  (Hyalessa maculaticollis, adult male)
   body frame (mm): +z head, +y dorsal, origin = body-axis centre (head front z=+17.75, abdomen tip z=-17.7)
   ================================================================== */
const CIC={
  DA:11.5,VA:11.5,Z0:-18.4,Z1:18.6,
  head:table([// z, cy, w, ht, hb
    [11.3,.6,4.4,1.8,2.7],[12.3,.65,4.85,2.0,3.0],[13.4,.65,5.0,2.05,3.2],[14.5,.6,4.9,2.0,3.3],[15.4,.5,4.4,1.85,3.25],[16.1,.4,3.7,1.6,3.1],[16.5,.35,3.1,1.35,2.8]]),
  headZ:[11.3,16.6],
  thorax:table([// z, cy, w, top, bot (absolute y)
    [-3.3,.3,4.3,3.75,-3.7],[-2.4,.35,4.75,4.15,-4.0],[-.8,.45,5.35,4.7,-4.25],[1.4,.5,6.0,5.25,-4.4],[3.8,.55,6.45,5.6,-4.45],[5.5,.55,6.55,5.3,-4.4],
    [6.1,.55,7.05,5.3,-4.35],[6.8,.55,7.25,5.38,-4.3],[7.4,.55,7.0,5.1,-4.2],[9.0,.55,6.45,4.35,-3.85],[10.8,.55,5.6,3.45,-3.25],[12.2,.5,4.75,2.7,-2.6]]),
  thoraxZ:[-3.3,12.5],
  abd:table([// z, cy, w, top, bot
    [-17.7,.1,.25,.35,-.15],[-17.0,.05,1.55,.95,-.85],[-15.8,0,2.85,1.65,-1.75],[-14.2,-.05,3.95,2.25,-2.45],[-12.2,-.1,4.95,2.85,-3.05],
    [-9.8,-.1,5.75,3.3,-3.55],[-7.2,-.1,6.15,3.6,-3.85],[-4.7,-.1,6.2,3.72,-3.95],[-2.7,-.05,5.85,3.62,-3.85],[-1.3,0,5.2,3.3,-3.5]]),
  abdZ:[-17.75,-1.3],
  tergites:[-2.7,-4.65,-6.55,-8.35,-10.05,-11.65,-13.15,-14.55,-15.85],
  pitch:4.5*PI/180, lift:6.9
};
function capF(z,z0,z1,c0,c1){const f1=z>z1-c1?Math.sqrt(Math.max(0,1-Math.pow((z-(z1-c1))/c1,2))):1;const f0=z<z0+c0?Math.sqrt(Math.max(0,1-Math.pow((z0+c0-z)/c0,2))):1;return f0*f1;}
function cicSec(part,z){if(part==="head"){const r=CIC.head(z);const f=capF(z,CIC.headZ[0],CIC.headZ[1],.5,1.4);
    return{cy:r[0],w:r[1]*Math.sqrt(f),ht:r[2]*f,hb:r[3]*f,pt:2.5,pb:2.3};}
  if(part==="thorax"){const r=CIC.thorax(z);const f=capF(z,CIC.thoraxZ[0],CIC.thoraxZ[1],.5,.6);
    return{cy:r[0],w:r[1]*Math.sqrt(f),ht:(r[2]-r[0])*f,hb:(r[0]-r[3])*f,pt:2.35,pb:2.9};}
  const r=CIC.abd(z);let k=1;const T=CIC.tergites;
  for(let i=0;i<T.length-1;i++){if(z<=T[i]&&z>T[i+1]){const t=(T[i]-z)/(T[i]-T[i+1]);k=1+.045*Math.pow(t,1.7)*(1-sstep(.86,1,t))-.012*(1-sstep(0,.12,t));break;}}
  const f=capF(z,CIC.abdZ[0]-1,CIC.abdZ[1],.01,.5);
  return{cy:r[0],w:r[1]*k*Math.sqrt(f),ht:(r[2]-r[0])*k*f,hb:(r[0]-r[3])*k*f,pt:2.25,pb:2.55};}
function cicThoraxBump(x,y,z,top){if(!top)return 0;let d=0;
  d+=.22*Math.exp(-Math.pow((z-6.45)/.5,2))-.2*Math.exp(-Math.pow((z-7.35)/.22,2));
  d-=.28*Math.exp(-Math.pow((z-5.55)/.22,2));
  const cz=-1.1,u=x,v=z-cz;const a1=Math.abs((u+v)/1.414),b1=Math.abs((u-v)/1.414);const len=Math.hypot(u,v);
  const arm=Math.exp(-Math.pow(Math.min(a1,b1)/.55,2))*Math.exp(-Math.pow(len/2.6,4));d+=.62*arm+.35*Math.exp(-Math.pow(len/1.1,2));
  d-=.18*Math.exp(-(Math.pow((Math.abs(x)-1.9)/.7,2)+Math.pow((z-.6)/.8,2)));
  return d*Math.pow(Math.max(0,(y-.6))/5,.35);}
/* projected-fraction -> unrolled arc (so patterns can be read off dorsal photos) */
function projArcFn(part,top){const cache=new Map();return function(z,qp){const key=Math.round(z*20);let tb=cache.get(key);
  if(!tb){const S=cicSec(part,z);tb={xs:[],as:[],w:S.w};let a=0,pr=secPt(S,top?PI/2:PI*1.5);
    for(let k=0;k<=40;k++){const th=top?PI/2-k/40*PI/2:PI*1.5+k/40*PI/2;const p=secPt(S,th);if(k)a+=Math.hypot(p[0]-pr[0],p[1]-pr[1]);pr=p;tb.xs.push(S.w>1e-6?(p[0]-(S.cx||0))/S.w:k/40);tb.as.push(a);}cache.set(key,tb);}
  const s=qp<0?-1:1,q=Math.abs(qp);if(q>=1)return s*(tb.as[40]+(q-1)*Math.max(tb.w,1));
  let i=0;while(i<39&&tb.xs[i+1]<q)i++;const t=(q-tb.xs[i])/Math.max(1e-6,tb.xs[i+1]-tb.xs[i]);return s*lerp(tb.as[i],tb.as[i+1],clamp(t,0,1));};}

function paintCicada(S,seed){const rng=RNG(seed);
  const cc=mkCanvas(S,S),cx=cc.getContext("2d",CTXO),rc=mkCanvas(S,S),rx=rc.getContext("2d",CTXO),hc=mkCanvas(S,S),hx=hc.getContext("2d",CTXO);
  const k=S/2048;
  const R={D:[0,0,S/2,S],V:[S/2,0,S/2,S*.75],F:[S/2,S*.75,S/4,S/4],L:[S*.75,S*.75,S/4,S/4]};
  const DA=CIC.DA,Z0=CIC.Z0,Z1=CIC.Z1;
  const dX=a=>R.D[0]+(.5+a/(2*DA))*R.D[2],dY=z=>R.D[1]+(Z1-z)/(Z1-Z0)*R.D[3];
  const vX=a=>R.V[0]+(.5+a/(2*CIC.VA))*R.V[2],vY=z=>R.V[1]+(Z1-z)/(Z1-Z0)*R.V[3];
  const pxmm=R.D[2]/(2*DA);
  const PA={head:projArcFn("head",true),thorax:projArcFn("thorax",true),abd:projArcFn("abd",true)};
  const PV={head:projArcFn("head",false),thorax:projArcFn("thorax",false),abd:projArcFn("abd",false)};
  const D=(part,qp,z)=>[dX(PA[part](z,qp)),dY(z)];
  const Vv=(part,qp,z)=>[vX(PV[part](z,qp)),vY(z)];
  const gray=v=>"rgb("+v+","+v+","+v+")";
  cx.fillStyle="#0b0e0f";cx.fillRect(0,0,S,S);rx.fillStyle=gray(70);rx.fillRect(0,0,S,S);hx.fillStyle=gray(128);hx.fillRect(0,0,S,S);
  /* ===== dorsal pattern masks: G teal-green, O olive, W white pruinose, C collar, P pale cruciform, K black override ===== */
  const DW=Math.round(R.D[2]),DH=Math.round(R.D[3]);const MC=mkCanvas(DW,DH),mx=MC.getContext("2d",CTXO);
  const cmds={G:[],O:[],W:[],C:[],P:[],K:[]};const gv=v=>gray(Math.round(255*(v==null?1:v)));
  const ms=(ch,part,zf,pts,sym,v)=>{const L=[];for(const sg of (sym===false?[1]:[1,-1]))L.push(crPts(pts.map(p=>D(part,p[0]*sg,zf(p[1]))),true,5));cmds[ch].push(()=>{for(const P of L)fillPoly(mx,P,gv(v));});};
  const ml=(ch,part,zf,pts,w,sym,v)=>{const L=[];for(const sg of (sym===false?[1]:[1,-1]))L.push(crPts(pts.map(p=>D(part,p[0]*sg,zf(p[1]))),false,6));cmds[ch].push(()=>{for(const P of L)strokePoly(mx,P,gv(v),w*pxmm);});};
  const mdots=(ch,part,zf,n,q0,q1,t0,t1,r0,r1,v)=>{const L=[];for(let i=0;i<n;i++){const p=D(part,rng.r(q0,q1)*(rng()<.5?1:-1),zf(rng.r(t0,t1)));L.push([p[0],p[1],rng.r(r0,r1)*pxmm]);}
    cmds[ch].push(()=>{mx.fillStyle=gv(v);for(const d of L){mx.beginPath();mx.arc(d[0],d[1],Math.max(.6,d[2]),0,TAU);mx.fill();}});};
  // HEAD (vertex) t: 0 back(z12.1) -> 1 front(z16.4)
  const HZ=t=>12.1+t*4.3;
  ms("O","head",HZ,[[.3,.84],[.45,.86],[.52,.95],[.4,.99],[.29,.94]]);
  ms("G","head",HZ,[[0,.72],[.04,.77],[.045,.93],[0,.97]],false);ms("G","head",HZ,[[0,.72],[-.04,.77],[-.045,.93],[0,.97]],false);
  ms("G","head",HZ,[[.69,.12],[.78,.17],[.83,.5],[.79,.82],[.72,.86],[.7,.5]]);
  ms("G","head",HZ,[[.17,.16],[.29,.13],[.34,.28],[.25,.35],[.16,.28]],true,.8);
  ms("G","head",HZ,[[.5,.42],[.59,.44],[.61,.58],[.52,.6]],true,.8);
  ml("G","head",HZ,[[0,.04],[.35,.045],[.68,.07]],.12,true,.8);
  // PRONOTUM t: 0 front (z12.25) -> 1 back (z7.45)
  const PZ=t=>12.25-t*4.8;
  ms("G","thorax",PZ,[[0,.08],[.03,.15],[.045,.45],[.035,.8],[.015,.96],[0,.97]],false);ms("G","thorax",PZ,[[0,.08],[-.03,.15],[-.045,.45],[-.035,.8],[-.015,.96],[0,.97]],false);
  ms("G","thorax",PZ,[[.12,.06],[.24,.02],[.38,.1],[.46,.4],[.44,.72],[.34,.94],[.18,.92],[.12,.6],[.1,.3]]);
  ms("G","thorax",PZ,[[.53,.03],[.7,.05],[.84,.2],[.9,.5],[.86,.82],[.72,.96],[.57,.88],[.52,.55],[.51,.25]]);
  ms("G","thorax",PZ,[[.93,.12],[.99,.1],[1.01,.9],[.95,.92]],true,.75);
  ml("K","thorax",PZ,[[.24,.14],[.3,.34],[.315,.58],[.27,.82]],.22);
  ml("K","thorax",PZ,[[.645,.16],[.73,.36],[.765,.58],[.71,.82]],.24);
  for(let i=0;i<26;i++){const q0=rng.r(.12,.88),t0=rng.r(.08,.9);const pts=[[q0,t0]];let q=q0,t=t0;for(let j=0;j<3;j++){q+=rng.s()*.04;t+=rng.r(.04,.1);pts.push([q,t]);}ml("K","thorax",PZ,pts,rng.r(.05,.11),rng()<.5,.9);}
  mdots("K","thorax",PZ,70,.1,.9,.05,.95,.04,.14,.95);
  mdots("G","thorax",PZ,30,.06,.95,.05,.95,.03,.08,.6);
  ms("K","thorax",PZ,[[0,-.06],[1.1,-.06],[1.1,.035],[0,.03]],true,.9);
  // COLLAR (z 5.72 .. 7.42)
  { const bnd=[];for(let i=0;i<=24;i++){const q=i/24*1.12;bnd.push([q,7.42-.06*q]);}for(let i=24;i>=0;i--){const q=i/24*1.12;bnd.push([q,5.72-.14*q*q]);}
    ms("C","thorax",z=>z,bnd);ml("K","thorax",z=>z,[[0,7.33],[.5,7.31],[1.1,7.2]],.15,true,.7);ml("K","thorax",z=>z,[[0,5.76],[.5,5.73],[1.1,5.58]],.14,true,.6);}
  // MESONOTUM t: 0 front (z5.55) -> 1 back (z-2.65)
  const MZ=t=>5.55-t*8.2;
  ms("O","thorax",MZ,[[.065,.02],[.12,.02],[.115,.2],[.09,.33],[.07,.2]]);
  ms("O","thorax",MZ,[[.2,.03],[.3,.04],[.38,.22],[.41,.45],[.36,.62],[.27,.72],[.2,.74],[.22,.64],[.3,.5],[.31,.3],[.24,.12]]);
  ms("O","thorax",MZ,[[.56,.1],[.68,.1],[.76,.24],[.72,.34],[.62,.3],[.56,.2]]);
  ms("G","thorax",MZ,[[.7,.48],[.8,.47],[.85,.58],[.79,.66],[.71,.62]]);
  ms("G","thorax",MZ,[[.86,.08],[.95,.06],[.98,.3],[.9,.36]],true,.8);
  { const L=[];for(const sp of[[.48,.55,.032],[.13,.48,.022],[.6,.64,.02],[.45,.2,.02],[.62,.82,.02]])for(const sg of[1,-1]){const p=D("thorax",sp[0]*sg,MZ(sp[1]));L.push([p[0],p[1],sp[2]*7*pxmm]);}
    cmds.O.push(()=>{mx.fillStyle=gv(1);for(const d of L){mx.beginPath();mx.arc(d[0],d[1],d[2],0,TAU);mx.fill();}});}
  ms("W","thorax",MZ,[[.5,.8],[.78,.7],[1.02,.74],[1.06,.99],[.7,1.0],[.52,.92]],true,.8);
  { const P=[];const cz=-1.1;for(let i=0;i<72;i++){const a=i/72*TAU;const r=1.05+1.55*Math.pow(Math.abs(Math.cos(2*(a-PI/4))),3);P.push([dX(Math.cos(a)*r),dY(cz+Math.sin(a)*r*1.05)]);}
    cmds.P.push(()=>fillPoly(mx,P,gv(1)));const c0=[dX(0),dY(cz)];cmds.W.push(()=>{mx.fillStyle=gv(.5);mx.beginPath();mx.arc(c0[0],c0[1],1.0*pxmm,0,TAU);mx.fill();});}
  // ABDOMEN pruinose (dorsal)
  const mpru=(pts,v)=>ms("W","abd",z=>z,pts,true,v);
  mpru([[0,-2.55],[.5,-2.5],[1.1,-2.6],[1.15,-6.2],[.7,-5.6],[.35,-5.2],[0,-5.1]],.95);
  mpru([[.5,-5.2],[.8,-5.0],[1.1,-5.2],[1.12,-6.5],[.7,-6.4]],.5);
  const TG=CIC.tergites;
  for(let i=2;i<TG.length-2;i++){const za=TG[i],zb=TG[i+1];mpru([[.7,za-.15],[.9,za-.12],[1.15,za-.2],[1.15,zb+.45],[.85,zb+.5],[.74,(za+zb)/2]],.7-i*.08);}
  // rasterise each channel crisply, then blur (soft edges)
  const MK={};const br=Math.max(1,Math.round(.045*pxmm));
  for(const ch of["G","O","W","C","P","K"]){mx.globalCompositeOperation="source-over";mx.fillStyle="#000";mx.fillRect(0,0,DW,DH);mx.globalCompositeOperation="lighten";for(const f of cmds[ch])f();
    const d=mx.getImageData(0,0,DW,DH).data;const arr=new Uint8Array(DW*DH);for(let i=0,j=0;i<arr.length;i++,j+=4)arr[i]=d[j];MK[ch]=boxBlur1(arr,DW,DH,ch==="W"?br*3:br,2);}
  /* ===== per-pixel composite with domain warping (organic, marbled edges) ===== */
  { const nf=vnoise(seed*7+1),nf2=vnoise(seed*7+2),nf3=vnoise(seed*7+3);
    const ci=cx.getImageData(0,0,DW,DH),ri=rx.getImageData(0,0,DW,DH),hi=hx.getImageData(0,0,DW,DH);const cd=ci.data,rd=ri.data,hd=hi.data;
    const st=3,gw=Math.ceil(DW/st)+2,gh=Math.ceil(DH/st)+2,WX=new Float32Array(gw*gh),WY=new Float32Array(gw*gh),N1=new Float32Array(gw*gh);
    const fA=1/(1.3*pxmm),fB=1/(.42*pxmm),aA=.2*pxmm,aB=.07*pxmm,fC=1/(.9*pxmm);
    for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){const x=i*st,y=j*st,q=j*gw+i;WX[q]=(nf(x*fA,y*fA)-.5)*2*aA+(nf3(x*fB,y*fB)-.5)*2*aB;WY[q]=(nf2(x*fA+7.7,y*fA+3.1)-.5)*2*aA+(nf3(x*fB+31.3,y*fB+11.9)-.5)*2*aB;N1[q]=nf(x*fC+5.3,y*fC+2.9);}
    const GT=grainTile(rng,256),fD=1/(.18*pxmm);
    const MG=MK.G,MO=MK.O,MW=MK.W,MCo=MK.C,MP=MK.P,MKk=MK.K;
    for(let y=0;y<DH;y++){const gy=y/st,j0=gy|0,fy=gy-j0;for(let x=0;x<DW;x++){const gx=x/st,i0=gx|0,fx=gx-i0,q00=j0*gw+i0;
      const w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy;
      const wx=WX[q00]*w00+WX[q00+1]*w10+WX[q00+gw]*w01+WX[q00+gw+1]*w11,wy=WY[q00]*w00+WY[q00+1]*w10+WY[q00+gw]*w01+WY[q00+gw+1]*w11;
      let sx=(x+wx+.5)|0,sy=(y+wy+.5)|0;sx=sx<0?0:(sx>=DW?DW-1:sx);sy=sy<0?0:(sy>=DH?DH-1:sy);const m=sy*DW+sx,o=(y*DW+x)*4;
      const G=MG[m]/255,O=MO[m]/255,Wt=MW[m]/255,C=MCo[m]/255,P=MP[m]/255,K=MKk[m]/255;
      const n1=N1[q00]*w00+N1[q00+1]*w10+N1[q00+gw]*w01+N1[q00+gw+1]*w11;const n3=GT[((y*.37|0)&255)*256+((x*.37|0)&255)]*.5+GT[(y&255)*256+(x&255)]*.5;
      let r=11*(.85+.3*n3),g=14*(.85+.3*n3),b=15*(.85+.3*n3),ro=.27+.06*(n3-.5),hh=.5+.04*(n3-.5);
      if(G+O+Wt+C+P+K>.004){
        if(C>0){const t=n1;r=lerp(r,lerp(28,46,t),C);g=lerp(g,lerp(50,72,t),C);b=lerp(b,lerp(36,52,t),C);ro=lerp(ro,.34,C);hh+=.05*C;}
        const gwt=G*(1-K);if(gwt>0){const t=clamp(n1*1.35-.15+.12*(n3-.5),0,1);r=lerp(r,lerp(14,40,t),gwt);g=lerp(g,lerp(70,134,t),gwt);b=lerp(b,lerp(54,100,t),gwt);ro=lerp(ro,.36,gwt);hh+=.05*gwt;}
        const owt=O*(1-K*.8);if(owt>0){const t=clamp(n1*1.3-.1,0,1);r=lerp(r,lerp(86,128,t),owt);g=lerp(g,lerp(108,152,t),owt);b=lerp(b,lerp(62,90,t),owt);ro=lerp(ro,.42,owt);hh+=.04*owt;}
        if(P>0){r=lerp(r,lerp(142,176,n3),P);g=lerp(g,lerp(156,188,n3),P);b=lerp(b,lerp(132,160,n3),P);ro=lerp(ro,.62,P);}
        if(K>0){const kk=K*.92;r=lerp(r,9,kk);g=lerp(g,11,kk);b=lerp(b,12,kk);ro=lerp(ro,.26,kk);hh-=.1*K;}
        if(Wt>0){const pw=Wt*(.6+.4*sstep(.25,.8,n1*.55+n3*.45));r=lerp(r,226,pw);g=lerp(g,233,pw);b=lerp(b,236,pw);ro=lerp(ro,.9,pw);hh+=.03*pw;}}
      cd[o]=r;cd[o+1]=g;cd[o+2]=b;rd[o]=rd[o+1]=rd[o+2]=ro*255;hd[o]=hd[o+1]=hd[o+2]=clamp(hh,0,1)*255;}}
    cx.putImageData(ci,0,0);rx.putImageData(ri,0,0);hx.putImageData(hi,0,0);}
  /* ===== dorsal crisp overlays ===== */
  const line=(part,zf,pts,col,w,hcol)=>{const P=crPts(pts.map(p=>D(part,p[0],zf(p[1]))),false,6);strokePoly(cx,P,col,w*pxmm);if(hcol)strokePoly(hx,P,hcol,w*pxmm*1.6);};
  for(let i=0;i<Math.round(2600*k*k)+250;i++){const z=rng.r(-2.6,12.3),q=rng.r(-1,1);const p=D("thorax",q,z);const s2=Math.max(1,1.5*k);cx.fillStyle=rng()<.6?"rgba(205,170,90,.3)":"rgba(160,180,130,.26)";cx.fillRect(p[0],p[1],s2,s2);rx.fillStyle=gray(40);rx.fillRect(p[0],p[1],s2,s2);}
  for(let i=0;i<TG.length-1;i++){const zb=TG[i+1];for(const sg of[1,-1]){const L1=[],L2=[];for(let j=0;j<=20;j++){L1.push([sg*j/20*1.15,zb+.16]);L2.push([sg*j/20*1.15,zb+.02]);}
      line("abd",z=>z,L1,"rgba(128,100,62,.35)",.2,null);line("abd",z=>z,L2,"rgba(4,5,5,.85)",.1,"rgba(0,0,0,.6)");}}
  for(let i=0;i<Math.round(1500*k)+200;i++){const z=rng.r(-17,-2.6),q=rng.r(-1.15,1.15);const p=D("abd",q,z);cx.fillStyle=rng()<.5?"rgba(10,12,12,.3)":"rgba(236,240,242,.2)";const s2=Math.max(1,rng.r(1,3)*k);cx.fillRect(p[0],p[1],s2,s2);}
  for(let r=0;r<7;r++){const z=-2.85-r*.36;for(const sg of[1,-1])line("abd",z2=>z2,[[.74*sg,z],[.88*sg,z-.05],[1.05*sg,z-.08]],"rgba(240,244,246,.22)",.11,"rgba(255,255,255,.5)");}
  /* ===== VENTRAL region: crisp shapes then one blur pass ===== */
  { const T2="#23805f";
    const vs=(part,pts,col,rough,sg)=>{const P=crPts(pts.map(p=>Vv(part,p[0]*sg,p[1])),true,4);fillPoly(cx,P,col);if(rough!=null)fillPoly(rx,P,gray(rough));};
    const full=(z0,z1,col,rough)=>{cx.fillStyle=col;cx.fillRect(vX(-13),vY(z1),vX(13)-vX(-13),vY(z0)-vY(z1));if(rough!=null){rx.fillStyle=gray(rough);rx.fillRect(vX(-13),vY(z1),vX(13)-vX(-13),vY(z0)-vY(z1));}};
    full(-3.3,16.8,"#1c231c",80);
    for(const sg of[1,-1]){
      vs("thorax",[[0,12.0],[.55,11.6],[.62,4.0],[.55,-2.6],[0,-2.9]],"#6f7c69",150,sg);
      vs("thorax",[[.66,11.4],[.92,11.6],[1.08,10.0],[1.08,1.0],[.92,-2.4],[.7,-2.0],[.7,4]],"#141c16",80,sg);
      vs("thorax",[[.76,9.6],[.95,9.4],[1.0,6.8],[.8,6.6]],"#24735a",95,sg);
      vs("thorax",[[.74,5.6],[.98,5.4],[1.0,2.2],[.8,1.4],[.72,3]],"#d4dada",215,sg);
      vs("thorax",[[.75,.8],[.96,.6],[.98,-2.0],[.78,-1.8]],"#b8c0bf",205,sg);
      vs("head",[[.3,15.8],[.9,15.6],[1.05,13.0],[.4,12.6]],"#121813",80,sg);
      vs("head",[[.55,15.2],[.8,15.0],[.82,13.8],[.6,13.8]],"#24684e",95,sg);}
    full(-17.9,-1.3,"#1b1b17",120);
    for(const sg of[1,-1]){vs("abd",[[0,-1.6],[.7,-1.7],[.72,-15],[.4,-16.8],[0,-17]],"#564e40",120,sg);
      vs("abd",[[0,-1.6],[.5,-1.6],[.7,-2],[.7,-8.5],[.3,-8.6],[0,-8.4]],"#a9aca4",180,sg);vs("abd",[[.75,-2.2],[1.0,-2.2],[1.05,-7.5],[.8,-7.2]],"#c4cac9",200,sg);}
    const bx=R.V[0],by=R.V[1],bw=R.V[2],bh=R.V[3];blurRegion(cx,bx,by,bw,bh,.14*pxmm);blurRegion(rx,bx,by,bw,bh,.14*pxmm);
    for(let i=1;i<TG.length;i++){cx.fillStyle="rgba(150,128,92,.5)";cx.fillRect(vX(-13),vY(TG[i]+.4),vX(13)-vX(-13),.45*pxmm);strokePoly(hx,[[vX(-13),vY(TG[i])],[vX(13),vY(TG[i])]],"rgba(0,0,0,.6)",3*k);}}
  /* ===== FACE (postclypeus) region F ===== */
  { const [x0,y0,w,h]=R.F;cx.fillStyle="#101413";cx.fillRect(x0,y0,w,h);rx.fillStyle=gray(70);rx.fillRect(x0,y0,w,h);
    for(let i=0;i<12;i++){const yy=y0+h*(.1+i*.07);for(const sd of[0,1]){const xa=sd?x0+w*.57:x0+w*.07,xb=sd?x0+w*.93:x0+w*.43;
      strokePoly(cx,[[xa+w*.02,yy+h*.03],[xb-w*.02,yy+h*.04]],"rgba(92,118,84,.7)",3.2*k);strokePoly(cx,[[xa,yy],[xb,yy+h*.012]],"rgba(3,4,4,.95)",2.4*k);strokePoly(hx,[[xa,yy],[xb,yy+h*.012]],"rgba(0,0,0,.9)",4.5*k);}}
    fillPoly(cx,[[x0+w*.46,y0],[x0+w*.54,y0],[x0+w*.535,y0+h],[x0+w*.465,y0+h]],"#23805f");strokePoly(hx,[[x0+w*.5,y0],[x0+w*.5,y0+h]],"rgba(0,0,0,.55)",4*k);
    cx.fillStyle="#6c8450";cx.fillRect(x0,y0,w,h*.07);}
  /* ===== LEGS region L (8 columns: u around, v along proximal->distal) ===== */
  { const [x0,y0,w,h]=R.L;const cw=w/8;
    const col=(i,stops,stripe)=>{const xa=x0+i*cw;const g=cx.createLinearGradient(0,y0+h,0,y0);for(const s2 of stops)g.addColorStop(s2[0],s2[1]);cx.fillStyle=g;cx.fillRect(xa,y0,cw,h);
      if(stripe){cx.fillStyle=stripe;cx.fillRect(xa+cw*.4,y0,cw*.2,h);cx.fillRect(xa+cw*.9,y0,cw*.1,h);}};
    col(0,[[0,"#3c5236"],[.5,"#46603e"],[.8,"#2c3424"],[1,"#18130d"]],"rgba(20,16,10,.85)");
    col(1,[[0,"#211c13"],[.12,"#4a5a3a"],[.7,"#3e4a30"],[.9,"#221c13"],[1,"#15110b"]],"rgba(22,18,12,.65)");
    col(2,[[0,"#4e6a48"],[.6,"#465e40"],[.85,"#2e3826"],[1,"#1e1912"]],"rgba(24,20,13,.7)");
    col(3,[[0,"#4a3c28"],[.5,"#3a2e1e"],[1,"#22190f"]]);
    col(4,[[0,"#2a2a22"],[.3,"#16140f"],[1,"#0e0c0a"]]);
    col(5,[[0,"#2a2a22"],[1,"#141210"]],"rgba(110,104,84,.5)");
    col(6,[[0,"#5f7040"],[.35,"#4c5232"],[.7,"#3a2e1e"],[1,"#2a2014"]]);
    col(7,[[0,"#3a2c20"],[1,"#0a0807"]]);
    rx.fillStyle=gray(95);rx.fillRect(x0,y0,w,h);}
  /* ===== final grain pass on ventral/face/leg regions (dorsal already has it) ===== */
  { const x0=Math.round(S/2),w=S-x0;const ci=cx.getImageData(x0,0,w,S),ri=rx.getImageData(x0,0,w,S),hi=hx.getImageData(x0,0,w,S);const cd=ci.data,rd=ri.data,hd=hi.data;const GT=grainTile(rng,256);
    for(let y=0;y<S;y++)for(let x=0;x<w;x++){const o=(y*w+x)*4;const g1=GT[(y&255)*256+(x&255)],g2=GT[((y>>2)&255)*256+((x>>2)&255)];const f=.92+.1*g1+.06*g2;
      cd[o]*=f;cd[o+1]*=f;cd[o+2]*=f;rd[o]=rd[o+1]=rd[o+2]=clamp(rd[o]+28*(g2-.5)+14*(g1-.5),0,255);hd[o]=hd[o+1]=hd[o+2]=clamp(hd[o]+16*(g1-.5)+10*(g2-.5),0,255);}
    cx.putImageData(ci,x0,0);rx.putImageData(ri,x0,0);hx.putImageData(hi,x0,0);}
  const ncv=heightToNormal(hc,S/1024*3.0);
  return{color:cc,rough:rc,normal:ncv,R,S};}

function paintEye(S,seed){const rng=RNG(seed),c=mkCanvas(S,S),x=c.getContext("2d",CTXO);
  const g=x.createLinearGradient(0,0,0,S);g.addColorStop(0,"#34352f");g.addColorStop(.45,"#2a2823");g.addColorStop(1,"#141310");x.fillStyle=g;x.fillRect(0,0,S,S);
  const n=noiseCanvas(rng,24,false);noiseLayer(x,n,0,0,S*.88,S,.16,"overlay");const n2=noiseCanvas(rng,128,true);noiseLayer(x,n2,0,0,S*.88,S,.14,"overlay");
  x.fillStyle="rgba(110,130,146,.2)";x.fillRect(0,S*.1,S*.88,S*.3);x.fillStyle="rgba(150,120,80,.12)";x.fillRect(0,S*.5,S*.88,S*.25);
  const rg=x.createLinearGradient(0,0,0,S);rg.addColorStop(0,"#ff7a66");rg.addColorStop(.55,"#d0301f");rg.addColorStop(1,"#80160e");x.fillStyle=rg;x.fillRect(S*.9,0,S*.1,S);
  return c;}

/* ---------------- cicada wings ---------------- */
const CW={
  fore:{L:46,W:15.6,
    outline:[[0,1.9],[1.0,1.0],[3.0,.45],[6,.15],[10,0],[16,-.05],[22,.1],[28,.42],[33,.95],[37.5,1.7],[41,2.8],[43.6,4.15],[45.3,5.8],[46,7.5],[45.7,9.2],[44.6,10.8],[42.6,12.3],[39.8,13.6],[36.4,14.6],[32.6,15.2],[28.6,15.45],[24.6,15.15],[20.8,14.4],[17.4,13.35],[14.6,12.15],[12,10.6],[9,8.7],[6,6.7],[3.4,4.9],[1.4,3.4],[.3,2.5]]},
  hind:{L:26.5,W:11.6,
    outline:[[0,1.2],[1.2,.5],[4,.15],[9,0],[14,.1],[18,.45],[21.5,1.2],[24.3,2.6],[26,4.4],[26.5,6.0],[25.8,7.4],[24,8.6],[21,9.5],[17.5,9.9],[14,9.7],[11,9.6],[8.6,10.2],[6.6,11.1],[4.4,11.5],[2.4,10.6],[1.0,8.4],[.3,5.4],[0,3.0]]}
};
function cicadaVeins(){const F=[],H=[];const V=(arr,pts,w,kind)=>arr.push({pts,w,kind:kind||"v"});
  V(F,[[.2,1.75],[1.2,.95],[3,.45],[6,.18],[10,.06],[16,.02],[22,.16],[25.6,.36]],.34,"costa");
  V(F,[[.5,2.15],[2.5,1.45],[6,1.05],[10,.85],[16,.78],[21,.7],[25.6,.45]],.18,"main");
  V(F,[[.7,2.55],[3,2.6],[6.5,2.72],[10.6,2.86]],.18,"main");
  V(F,[[10.5,.85],[10.6,2.86]],.13,"cross");
  V(F,[[10.5,.86],[14,1.55],[18,2.1],[22,2.6],[25.0,2.95]],.14,"main");
  V(F,[[10.6,2.86],[13.2,3.5],[16,4.05],[18.6,4.45]],.14,"main");
  V(F,[[18.6,4.45],[21.5,4.55],[24.6,4.62]],.12,"main");
  V(F,[[18.6,4.45],[21,5.4],[23.9,6.55]],.12,"main");
  V(F,[[10.6,2.86],[12.6,4.4],[14.8,6.4],[17,8.4],[18.2,9.4]],.14,"main");
  V(F,[[18.2,9.4],[20.4,9.5],[22.7,9.6]],.12,"main");
  V(F,[[18.2,9.4],[19.6,11.3],[20.9,13.2],[21.6,14.15]],.12,"main");
  V(F,[[.8,2.85],[4,4.4],[8,6.6],[11.6,8.9],[14.6,12.0]],.12,"main");
  V(F,[[1.0,3.3],[4,5.25],[8,7.6],[11.4,9.8]],.09,"main");
  V(F,[[1.3,3.7],[4.5,6.0],[8.2,8.3]],.075,"main");
  V(F,[[25.6,.4],[25.0,2.95]],.12,"cross");V(F,[[25.0,2.95],[24.6,4.62]],.11,"cross");V(F,[[24.6,4.62],[23.9,6.55]],.11,"cross");V(F,[[23.9,6.55],[22.7,9.6]],.11,"cross");
  V(F,[[16,4.05],[15.2,6.9]],.09,"cross");
  const amb=[[25.6,.4],[30,.92],[34,1.55],[37.6,2.35],[40.8,3.4],[43.2,4.7],[44.8,6.2],[45.25,7.6],[44.9,9.0],[43.9,10.4],[42.1,11.8],[39.5,13.0],[36.3,13.95],[32.6,14.5],[28.6,14.7],[24.8,14.45],[21.6,14.15],[18.0,13.1],[15.1,11.95]];
  V(F,amb,.11,"amb");
  const ap=[[[25.0,2.95],[30,2.6],[35,3.0],[39.2,3.85],[41.6,4.55]],[[25.0,2.95],[29,3.9],[34,5.0],[38.4,6.2],[42.4,7.6],[44.6,8.25]],
    [[24.6,4.62],[28.6,5.9],[33,7.45],[37.2,8.95],[41.4,10.6],[43.3,11.0]],[[24.6,4.62],[27.8,6.6],[31.8,8.75],[35.6,10.7],[39.6,12.65],[40.6,12.75]],
    [[23.9,6.55],[27.2,8.7],[30.8,10.9],[34.3,13.0],[35.2,14.05]],[[23.9,6.55],[26.2,9.6],[28.9,12.5],[30.4,14.6]],[[22.7,9.6],[24.6,12.1],[25.9,14.55]]];
  for(const p of ap)V(F,p,.11,"main");
  V(F,[[28.2,4.25],[28.0,5.75]],.09,"cross");V(F,[[27.4,6.85],[26.9,8.35]],.09,"cross");
  V(H,[[.2,1.1],[2,.35],[6,.08],[10,.02],[14,.12]],.2,"costa");
  V(H,[[.4,1.7],[3,1.2],[7,.95],[11,.9],[14,.8],[15.4,.75]],.13,"main");
  V(H,[[.5,2.3],[3,2.25],[6.2,2.4],[8.8,2.7]],.13,"main");
  V(H,[[8.8,2.7],[11.5,2.65],[14.8,2.6]],.11,"main");
  V(H,[[8.8,2.7],[11,4.2],[13.6,5.5]],.11,"main");
  V(H,[[.6,2.9],[4,4.6],[8,6.6],[11.3,8.3],[13.8,9.5]],.1,"main");
  V(H,[[.8,3.7],[3.5,6.8],[6.4,9.2],[8.6,10.0]],.085,"main");
  V(H,[[1.0,4.6],[2.6,8.0],[4.2,10.9]],.075,"main");
  V(H,[[15.4,.75],[14.8,2.6]],.1,"cross");V(H,[[14.8,2.6],[13.6,5.5]],.1,"cross");V(H,[[13.6,5.5],[13.0,8.0]],.09,"cross");
  const hamb=[[14,.12],[18,.55],[21.4,1.35],[24,2.7],[25.6,4.4],[25.9,6.0],[25.2,7.2],[23.6,8.2],[21,8.95],[17.5,9.3],[14.4,9.2],[13.8,9.5]];
  V(H,hamb,.09,"amb");
  const hap=[[[15.4,.75],[19,1.3],[22.4,2.4],[24.3,3.0]],[[14.8,2.6],[18.5,3.3],[22.4,4.3],[25.3,5.2]],[[14.8,2.6],[18.2,4.4],[21.8,6.0],[24.6,7.3]],
    [[13.6,5.5],[17,6.5],[20.4,7.7],[22.6,8.45]],[[13.6,5.5],[15.8,7.4],[18.2,9.1]],[[13.0,8.0],[14.6,9.0],[15.2,9.25]]];
  for(const p of hap)V(H,p,.09,"main");
  return{F,H};}

/* wing texture as RGBA DataTexture (colour canvas + separate alpha canvas => no dark fringes). fore = top half, hind = bottom half */
function paintCicadaWings(W,seed){const rng=RNG(seed);const Hh=W/2,k=W/2048;
  const cw=mkCanvas(W,Hh),cx=cw.getContext("2d",CTXO),aw=mkCanvas(W,Hh),ax=aw.getContext("2d",CTXO);
  const FR={x:4*k,y:4*k,sx:(W-8*k)/46.2,sy:(Hh/2-8*k)/15.9},HR={x:4*k,y:Hh/2+4*k,sx:(W-8*k)/46.2,sy:(Hh/2-8*k)/11.8};
  const VE=cicadaVeins();
  cx.fillStyle="#6a5634";cx.fillRect(0,0,W,Hh);ax.fillStyle="#000";ax.fillRect(0,0,W,Hh);
  const draw=(R,def,veins,isFore)=>{const P=p=>[R.x+p[0]*R.sx,R.y+(p[1]+.15)*R.sy];const ws=Math.sqrt(R.sx*R.sy);
    const out=crPts(def.outline,true,8).map(P);
    const gx=cx.createLinearGradient(R.x,0,R.x+def.L*R.sx*.4,0);gx.addColorStop(0,"#6e7a42");gx.addColorStop(1,"rgba(198,184,140,0)");cx.fillStyle=gx;cx.fillRect(R.x-4*k,R.y-4*k,def.L*R.sx*.45,Hh/2);
    ax.save();tracePath(ax,out,true);ax.fillStyle="rgb(58,58,58)";ax.fill();ax.clip();
    const ga=ax.createLinearGradient(R.x,0,R.x+def.L*R.sx*.28,0);ga.addColorStop(0,"rgba(200,200,200,1)");ga.addColorStop(.35,"rgba(90,90,90,.6)");ga.addColorStop(1,"rgba(58,58,58,0)");ax.fillStyle=ga;ax.fillRect(R.x-4*k,R.y-4*k,def.L*R.sx*.3,Hh/2);
    const nz=noiseCanvas(rng,256,true);noiseLayer(ax,nz,R.x,R.y,def.L*R.sx,Hh/2,.05,"overlay");ax.restore();
    noiseLayer(cx,nz,R.x,R.y,def.L*R.sx,Hh/2,.06,"overlay");
    if(isFore){// clavus slightly more opaque/brown
      const cl=crPts([[.6,2.7],[4,4.4],[8,6.6],[11.6,8.9],[14.6,12.0],[12,10.6],[9,8.7],[6,6.7],[3.4,4.9],[1.4,3.4]],true,4).map(P);softFill(ax,cl,"rgba(90,90,90,.5)",3*k);softFill(cx,cl,"rgba(140,120,80,.4)",3*k);
      const sm=[[25.0,2.6,1.0],[24.7,4.6,.9],[24.1,6.4,.85],[28.1,5.0,.75],[27.2,7.6,.7],[22.9,9.4,.7],[16.0,4.4,.5]];
      for(const s of sm){const p=P([s[0],s[1]]);softDot(cx,p[0],p[1],s[2]*ws*.5,"rgba(64,44,26,.95)",s[2]*ws*.55);softDot(ax,p[0],p[1],s[2]*ws*.42,"rgba(255,255,255,.5)",s[2]*ws*.55);}
      const tips=[[41.6,4.55],[44.6,8.25],[43.3,11.0],[40.6,12.75],[35.2,14.05],[30.4,14.6],[25.9,14.55],[21.6,14.15]];
      for(const s of tips){const p=P(s);softDot(cx,p[0],p[1],.32*ws,"rgba(56,38,22,.9)",.35*ws);softDot(ax,p[0],p[1],.26*ws,"rgba(255,255,255,.42)",.3*ws);}}
    for(const v of veins){const pts=crPts(v.pts.map(P),false,8);const w=Math.max(1.3,v.w*ws*1.25);
      const gc=cx.createLinearGradient(R.x,0,R.x+def.L*R.sx*.6,0);gc.addColorStop(0,"#4e6034");gc.addColorStop(.3,v.kind==="costa"?"#3a3c22":"#2e2618");gc.addColorStop(1,"#1a120a");
      cx.save();cx.lineCap="round";cx.lineJoin="round";cx.strokeStyle=gc;cx.lineWidth=w;tracePath(cx,pts,false);cx.stroke();cx.restore();
      ax.save();ax.lineCap="round";ax.lineJoin="round";ax.strokeStyle="rgb(246,246,246)";ax.lineWidth=w;tracePath(ax,pts,false);ax.stroke();ax.restore();}
    ax.save();ax.strokeStyle="rgba(200,200,200,.9)";ax.lineWidth=Math.max(1,.05*ws);tracePath(ax,out,true);ax.stroke();ax.restore();
    cx.save();cx.strokeStyle="rgba(60,44,26,.9)";cx.lineWidth=Math.max(1,.05*ws);tracePath(cx,out,true);cx.stroke();cx.restore();
    if(isFore){const cs=crPts([[.5,1.9],[3,.9],[8,.45],[14,.38],[20,.38],[25.4,.4]],false,6).map(P);const cs2=crPts([[25.4,.42],[20,.62],[14,.68],[8,.82],[3,1.28],[.6,2.12]],false,6).map(P);
      const poly=cs.concat(cs2);softFill(cx,poly,"#535c36",0);softFill(ax,poly,"rgb(238,238,238)",0);}
    else{const cs=crPts([[.4,1.2],[2,.5],[6,.3],[10,.25],[14,.3]],false,6).map(P);const cs2=crPts([[14,.4],[10,.5],[6,.6],[2,1.0],[.4,1.6]],false,6).map(P);softFill(cx,cs.concat(cs2),"#535c36",0);softFill(ax,cs.concat(cs2),"rgb(225,225,225)",0);}
  };
  draw(FR,CW.fore,VE.F,true);draw(HR,CW.hind,VE.H,false);
  const cd=cx.getImageData(0,0,W,Hh).data,ad=ax.getImageData(0,0,W,Hh).data;const data=new Uint8Array(W*Hh*4);
  for(let y=0;y<Hh;y++){const sy=(Hh-1-y);for(let x=0;x<W;x++){const i=(y*W+x)*4,j=(sy*W+x)*4;data[i]=cd[j];data[i+1]=cd[j+1];data[i+2]=cd[j+2];data[i+3]=ad[j];}}
  const tex=new THREE.DataTexture(data,W,Hh,THREE.RGBAFormat,THREE.UnsignedByteType);tex.encoding=THREE.sRGBEncoding;tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.anisotropy=8;tex.flipY=false;tex.needsUpdate=true;
  const uvF=(x,y)=>[(FR.x+x*FR.sx)/W,1-(FR.y+(y+.15)*FR.sy)/Hh];
  const uvH=(x,y)=>[(HR.x+x*HR.sx)/W,1-(HR.y+(y+.15)*HR.sy)/Hh];
  return{tex,uvF,uvH,canvas:cw,alpha:aw};}

function outlineBounds(outline){const P=crPts(outline,true,10);return function(x){let lo=1e9,hi=-1e9;
  for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];if((a[0]-x)*(b[0]-x)<=0&&a[0]!==b[0]){const t=(x-a[0])/(b[0]-a[0]);const y=a[1]+t*(b[1]-a[1]);lo=Math.min(lo,y);hi=Math.max(hi,y);}}
  if(lo>hi){lo=hi=0;}return[lo,hi];};}
function wingGeo(def,nu,nv,f,uvf,pad){const B=outlineBounds(def.outline);const pos=[],uv=[];pad=pad==null?.35:pad;
  for(let i=0;i<=nu;i++){const s=i/nu;const x=-pad+(def.L+2*pad)*s;const b=B(clamp(x,.05,def.L-.05));const y0=b[0]-pad,y1=b[1]+pad;
    for(let j=0;j<=nv;j++){const y=lerp(y0,y1,j/nv);const p=f(x,y);pos.push(p.x,p.y,p.z);const t=uvf(x,y);uv.push(t[0],t[1]);}}
  return mkGeo(pos,uv,gridIdx(nu,nv,false));}
/* resting forewing surface (+x side, body frame). For each station x_w (mm along the costa) the cross-section is a
   circular arc from the costa point C to the inner point I (reached at y_w=15.5) bulging outward by b: the wing wraps the
   abdomen over its width and flattens/spreads behind it, as in photos of cicadas resting on trunks. */
function cicWingSurface(){
  // x_w, Cx, Cy, Ix, Iy, bulge
  const T=table([[-1,5.5,3.7,1.1,6.7,2.4],[0,5.7,3.3,1.0,6.6,2.5],[7,7.05,.75,-2.2,5.9,3.0],[14.6,7.95,-1.6,-2.7,5.0,3.4],[20.8,10.6,-3.1,-1.3,4.1,3.0],
    [24,12.4,-3.9,-.9,2.4,2.0],[28,14.2,-4.5,-.5,.2,1.0],[36,15.0,-5.1,.4,-1.0,.6],[42,14.2,-5.4,2.4,-1.9,.5],[46,13.0,-5.5,4.4,-2.3,.45],[48,12.7,-5.55,5.0,-2.4,.4]]);
  const N=240,L=48,zc=[4.95];let prev=T(0);for(let i=1;i<=N;i++){const x=i/N*L,c=T(x),ds=L/N,dx=c[0]-prev[0],dy=c[1]-prev[1];zc.push(zc[i-1]-Math.sqrt(Math.max(.05*ds*ds,ds*ds-dx*dx-dy*dy)));prev=c;}
  const zAt=x=>{if(x<=0)return zc[0]-x*.97;const f=clamp(x/L*N,0,N-1e-6),i=Math.floor(f);return lerp(zc[i],zc[i+1],f-i);};
  return function(x,y,off){const r=T(clamp(x,-1,48));const Cx=r[0],Cy=r[1],Ix=r[2],Iy=r[3],b=Math.max(.05,r[4]);
    const dx=Ix-Cx,dy=Iy-Cy,c=Math.hypot(dx,dy);const nx=dy/c,ny=-dx/c;// outward normal of chord
    const R=(c*c/4+b*b)/(2*b);const mx=(Cx+Ix)/2,my=(Cy+Iy)/2;const Ox=mx-nx*(R-b),Oy=my-ny*(R-b);
    const a0=Math.atan2(Cy-Oy,Cx-Ox),a1=Math.atan2(Iy-Oy,Ix-Ox);let da=a1-a0;while(da>PI)da-=TAU;while(da<-PI)da+=TAU;
    const t=y/15.5,a=a0+da*t;const rr=R+(off||0);return new V3(Ox+Math.cos(a)*rr,Oy+Math.sin(a)*rr,zAt(x)-.05*y);};}

function makeMinminZemi(opts){opts=opts||{};const ql=qlevel(opts);const seed=(opts.seed|0)||7;const rng=RNG(seed*31+5);
  const group=new THREE.Group();group.name="minmin-zemi";
  const root=new THREE.Group();root.scale.setScalar(.001);group.add(root);
  const body=new THREE.Group();root.add(body);body.position.set(0,CIC.lift,0);body.rotation.x=-CIC.pitch;
  const disposables=[];
  const AS=QS(ql,512,1024,2048),WS=QS(ql,512,1024,2048);
  const atlas=paintCicada(AS,seed);
  const tMap=cTex(atlas.color,true),tRough=cTex(atlas.rough,false),tNorm=cTex(atlas.normal,false);disposables.push(tMap,tRough,tNorm);
  const R=atlas.R,S=AS;
  const rectUV=r=>[r[0]/S,1-(r[1]+r[3])/S,(r[0]+r[2])/S,1-r[1]/S];
  const RD=rectUV(R.D),RV=rectUV(R.V),RF=rectUV(R.F),RL=rectUV(R.L);
  const legCol=i=>[RL[0]+(RL[2]-RL[0])*i/8+.002,RL[1]+.002,RL[0]+(RL[2]-RL[0])*(i+1)/8-.002,RL[3]-.002];
  const uvBody=(a,z,top)=>{const r=top?RD:RV;const A=top?CIC.DA:CIC.VA;const u=.5+a/(2*A),v=(z-CIC.Z0)/(CIC.Z1-CIC.Z0);return[r[0]+u*(r[2]-r[0]),r[1]+v*(r[3]-r[1])];};
  const bodyMat=new THREE.MeshPhysicalMaterial({map:tMap,roughnessMap:tRough,normalMap:tNorm,normalScale:new THREE.Vector2(.8,.8),roughness:1,metalness:0,clearcoat:.3,clearcoatRoughness:.3});
  const UB=patchMat(bodyMat,{def:true});disposables.push(bodyMat);
  const seg=QS(ql,[26,12],[52,20],[90,30]);
  const parts=[];const zj=-1.6,yj=.6;UB.uJoint.value.set(0,yj,zj);
  parts.push(loft({z0:CIC.headZ[0],z1:CIC.headZ[1],n:Math.round(seg[0]*.6),m:seg[1],sec:z=>cicSec("head",z),uv:uvBody,
    bump:(x,y,z,top)=>top?(-.22*Math.exp(-Math.pow(x/1.7,2))*sstep(13.6,15.6,z)):0}));
  parts.push(loft({z0:CIC.thoraxZ[0],z1:CIC.thoraxZ[1],n:Math.round(seg[0]*1.6),m:seg[1],sec:z=>cicSec("thorax",z),uv:uvBody,bump:cicThoraxBump}));
  parts.push(loft({z0:CIC.abdZ[0],z1:CIC.abdZ[1],n:Math.round(seg[0]*1.7),m:seg[1],sec:z=>cicSec("abd",z),uv:uvBody,def:z=>clamp((zj-z)/(zj-CIC.abdZ[0]),0,1)}));
  { const ctrl=[new V3(0,1.7,15.3),new V3(0,1.5,16.4),new V3(0,.7,17.2),new V3(0,-.55,17.45),new V3(0,-1.9,17.15),new V3(0,-3.0,16.5),new V3(0,-3.55,15.8)];
    const pts=curvePts(ctrl,QS(ql,14,24,36));
    const g=sweep({pts,m:QS(ql,14,22,34),up:new V3(0,0,1),r:t=>[2.1+.4*Math.sin(t*PI)-.55*t,1.2+.45*Math.sin(t*PI)-.2*t],uv:RF,cap0:2,cap1:3,
      mod:(t,ph)=>{const lat=Math.abs(Math.cos(ph));return 1-.03*lat*Math.pow(Math.abs(Math.sin(t*PI*12)),3)-.045*Math.exp(-Math.pow((ph-PI/2)/.18,2));}});
    ensure(g,"aDef",1,[0]);parts.push(g);}
  { const g=ellip([0,-3.75,15.85],[1.0,.9,1.0],QS(ql,10,14,20),QS(ql,8,10,14),legCol(5));ensure(g,"aDef",1,[0]);parts.push(g);}
  { const pts=curvePts([new V3(0,-3.85,15.5),new V3(0,-4.4,13.6),new V3(0,-4.72,10.6),new V3(0,-4.82,7.2),new V3(0,-4.78,4.1)],QS(ql,10,16,24));
    const g=sweep({pts,m:QS(ql,6,8,10),r:t=>[.46-.16*t,.4-.12*t],uv:legCol(5),cap1:2});ensure(g,"aDef",1,[0]);parts.push(g);}
  for(const sg of[1,-1]){const g=new THREE.SphereGeometry(1,QS(ql,10,16,22),QS(ql,6,8,12));g.scale(2.35,.42,3.0);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-.08,sg*.12,sg*.04)));g.translate(sg*2.15,-4.25,-3.6);
    const p=g.attributes.position.array,uv=g.attributes.uv.array;for(let i=0;i<p.length/3;i++){const t=uvBody(p[3*i]*1.1,p[3*i+2],false);uv[2*i]=t[0];uv[2*i+1]=t[1];}
    const d=new Float32Array(p.length/3);for(let i=0;i<d.length;i++)d[i]=.18*clamp((zj-p[3*i+2])/6,0,1);g.setAttribute("aDef",new THREE.BufferAttribute(d,1));parts.push(g);}
  for(const sg of[1,-1]){const g=ellip([sg*5.6,3.25,4.9],[.95,.6,1.3],QS(ql,8,10,14),QS(ql,6,8,10),legCol(6),[0,sg*.3,0]);ensure(g,"aDef",1,[0]);parts.push(g);}
  /* ---------- wings ---------- */
  const WT=paintCicadaWings(WS,seed+3);disposables.push(WT.tex);
  const WF=cicWingSurface();
  const foreF=(off)=>(x,y)=>WF(x,y,off(y));
  const hindF=(x,y)=>WF(x*.97+1.1,y*.96+.55,-.6);
  const wsegs=QS(ql,[20,8],[36,12],[60,18]);
  const veinMat=new THREE.MeshStandardMaterial({map:WT.tex,alphaTest:.5,side:THREE.DoubleSide,roughness:.4,metalness:0});patchMat(veinMat,{transl:.3});
  const memMat=new THREE.MeshPhysicalMaterial({map:WT.tex,transparent:true,depthWrite:false,side:THREE.DoubleSide,roughness:.12,metalness:0,clearcoat:.3,clearcoatRoughness:.06});
  const UM=patchMat(memMat,{transl:.3,glint:.45});disposables.push(veinMat,memMat);
  const mkWing=(def,f,uvf,side,ro)=>{const g0=wingGeo(def,wsegs[0],wsegs[1],f,uvf);const g=side<0?mirrorX(g0):g0;if(side<0)g0.dispose();
    const vm=new THREE.Mesh(g,veinMat),mm=new THREE.Mesh(g,memMat);vm.castShadow=true;mm.castShadow=false;vm.receiveShadow=false;mm.receiveShadow=false;
    mm.renderOrder=ro;body.add(vm);body.add(mm);disposables.push(g);return[vm,mm];};
  mkWing(CW.hind,hindF,WT.uvH,1,2);mkWing(CW.hind,hindF,WT.uvH,-1,2);
  mkWing(CW.fore,foreF(y=>.32*sstep(8,13,y)),WT.uvF,1,4);mkWing(CW.fore,foreF(y=>0),WT.uvF,-1,3);
  // 3D costa / R+Sc stems along the forewing leading edge and hindwing costa
  for(const sg of[1,-1]){const lift=y=>(sg>0?.32*sstep(8,13,y):0)+.05;
    const tube=(pts2,f,r0,r1,m)=>{const p3=crPts(pts2,false,4).map(p=>{const v=f(p[0],p[1]);if(sg<0)v.x=-v.x;return v;});const g=sweep({pts:p3,m,r:t=>[lerp(r0,r1,t),lerp(r0,r1,t)*.8],uv:legCol(6),cap0:1,cap1:1});ensure(g,"aDef",1,[0]);parts.push(g);};
    tube([[.2,1.8],[1.2,.95],[3,.45],[6,.18],[10,.06],[16,.02],[22,.16],[25.6,.36],[30,.88],[34,1.5]],(x,y)=>WF(x,y,lift(y)+.06),.26,.1,QS(ql,5,6,8));
    tube([[.5,2.15],[2.5,1.45],[6,1.05],[10,.85],[14,.8]],(x,y)=>WF(x,y,lift(y)+.05),.15,.08,QS(ql,5,6,6));
    tube([[.7,2.55],[3,2.6],[6.5,2.72],[10.6,2.86]],(x,y)=>WF(x,y,lift(y)+.05),.14,.08,QS(ql,5,6,6));
    tube([[.2,1.1],[2,.35],[6,.08],[10,.02],[14,.12]],(x,y)=>hindF(x,y),.14,.07,QS(ql,4,5,6));}
  const bodyGeo=merge(parts,["position","normal","uv","aDef"]);disposables.push(bodyGeo);
  const bodyMesh=new THREE.Mesh(bodyGeo,bodyMat);bodyMesh.castShadow=true;bodyMesh.receiveShadow=true;body.add(bodyMesh);
  /* ---------- eyes + ocelli ---------- */
  const eyeTex=cTex(paintEye(QS(ql,64,128,256),seed+9),true);disposables.push(eyeTex);
  const eyeMat=new THREE.MeshPhysicalMaterial({map:eyeTex,roughness:.35,metalness:0,clearcoat:.75,clearcoatRoughness:.06});patchMat(eyeMat,{pupil:true,fakeEnv:.45});eyeMat.userData.U.uPupil.value=.45;disposables.push(eyeMat);
  const eyeParts=[];
  for(const sg of[1,-1]){eyeParts.push(ellip([sg*4.75,1.42,13.55],[1.6,1.82,1.88],QS(ql,16,28,44),QS(ql,12,20,30),[0,0,.88,1],[0,sg*.2,sg*.12]));}
  const vtop=(x,z)=>{const S2=cicSec("head",z);return S2.cy+S2.ht*Math.pow(Math.max(0,1-Math.pow(Math.abs(x)/S2.w,2.5)),1/2.5);};
  for(const o of[[0,14.7,.4],[1.12,13.8,.35],[-1.12,13.8,.35]]){const y=vtop(o[0],o[1])-.2*sstep(13.6,15.6,o[1]);eyeParts.push(ellip([o[0],y-.05,o[1]],[o[2],o[2]*.75,o[2]],QS(ql,8,10,14),QS(ql,6,8,10),[.9,0,1,1]));}
  const eyeGeo=merge(eyeParts);disposables.push(eyeGeo);const eyeMesh=new THREE.Mesh(eyeGeo,eyeMat);eyeMesh.castShadow=true;eyeMesh.receiveShadow=true;body.add(eyeMesh);
  /* ---------- antennae ---------- */
  const antennae=[];
  for(const sg of[1,-1]){const base=new V3(sg*2.95,.95,15.95);const pivot=new THREE.Group();pivot.position.copy(base);body.add(pivot);
    const pts=curvePts([new V3(0,0,0),new V3(sg*.45,.12,.32),new V3(sg*1.4,.4,.95),new V3(sg*2.4,.5,1.6),new V3(sg*3.2,.36,2.2)],QS(ql,8,12,18));
    const g=sweep({pts,m:QS(ql,4,6,6),r:t=>t<.18?.2-.1*t:.11-.08*t,uv:legCol(4),cap0:1,cap1:1});ensure(g,"aDef",1,[0]);
    const m=new THREE.Mesh(g,bodyMat);m.castShadow=true;pivot.add(m);antennae.push(pivot);disposables.push(g);}
  /* ---------- legs (canonical frame, 2-bone IK to the bark) ---------- */
  body.updateMatrix();const BM=body.matrix;const toRoot=v=>v.clone().applyMatrix4(BM);
  const legs=[];
  const LEG=[
    {n:"fore",c0:new V3(1.45,-2.7,11.6),c1:new V3(2.3,-4.3,12.6),fl:5.6,fr:[.9,.74],tl:5.0,tr:[.44,.36],ta:[.95,.7,1.25],foot:new V3(6.8,0,21.4),pole:new V3(.75,1,.55),fc:0,spines:true},
    {n:"mid",c0:new V3(2.4,-3.7,6.0),c1:new V3(3.3,-4.8,5.5),fl:5.4,fr:[.6,.52],tl:6.0,tr:[.38,.32],ta:[1.0,.8,1.25],foot:new V3(13.2,0,9.4),pole:new V3(1,.9,.15),fc:2},
    {n:"hind",c0:new V3(2.8,-3.7,2.1),c1:new V3(3.95,-4.85,1.25),fl:5.9,fr:[.64,.54],tl:8.3,tr:[.4,.33],ta:[1.2,.9,1.35],foot:new V3(14.0,0,-6.8),pole:new V3(.9,1,-.3),fc:2,tspines:true}];
  const ls=QS(ql,[6,10],[8,16],[10,24]);
  for(const L of LEG)for(const sg of[1,-1]){
    const sx=v=>new V3(v.x*sg,v.y,v.z);const c0=toRoot(sx(L.c0)),c1=toRoot(sx(L.c1));const foot=sx(L.foot);const pole=sx(L.pole).normalize();
    const tdir=new V3(foot.x-c1.x,0,foot.z-c1.z).normalize();const tarL=L.ta.reduce((a,b)=>a+b,0)*.92;
    const ankle=foot.clone().addScaledVector(tdir,-tarL);ankle.y=.42;
    const a=L.fl,b=L.tl;const d0=new V3().subVectors(ankle,c1);let d=Math.min(d0.length(),a+b-.05);const u=d0.clone().normalize();
    const x=(a*a-b*b+d*d)/(2*d);const hgt=Math.sqrt(Math.max(0,a*a-x*x));const w=pole.clone().sub(u.clone().multiplyScalar(pole.dot(u))).normalize();
    const knee=c1.clone().addScaledVector(u,x).addScaledVector(w,hgt);const ank=c1.clone().addScaledVector(u,d);
    const gl=[];const col=legCol;
    gl.push(sweep({pts:curvePts([c0,c0.clone().lerp(c1,.5).add(new V3(0,-.1,0)),c1],6),m:ls[0]+2,r:t=>[.95-.25*t,.8-.2*t],uv:col(2),cap0:2,cap1:2}));
    gl.push(ellip([c1.x,c1.y,c1.z],[.58,.52,.62],ls[0]+2,ls[0],col(2)));
    { const mid=c1.clone().lerp(knee,.5).addScaledVector(w,.18);const pts=curvePts([c1,mid,knee],ls[1]);
      gl.push(sweep({pts,m:ls[0]+2,up:w,r:t=>{const s=Math.sin(PI*Math.min(1,t*1.12));return[L.fr[0]*(.72+.28*s),L.fr[1]*(.72+.28*s)];},uv:col(L.fc),cap0:2,cap1:2}));
      if(L.spines){const fd=new V3().subVectors(knee,c1).normalize();const down=w.clone().negate();for(const sp of[[.42,.75],[.6,.58],[.76,.45]]){const p=c1.clone().lerp(knee,sp[0]).addScaledVector(down,L.fr[1]*.72);
          const tip=p.clone().addScaledVector(down,sp[1]).addScaledVector(fd,sp[1]*.35);gl.push(sweep({pts:[p,p.clone().lerp(tip,.5),tip],m:5,r:t=>.17*(1-t)+.02,uv:col(7),cap1:1}));}}}
    gl.push(ellip([knee.x,knee.y,knee.z],[L.tr[0]*1.18,L.tr[0]*1.18,L.tr[0]*1.18],ls[0]+2,ls[0],col(1)));
    { const mid=knee.clone().lerp(ank,.5).addScaledVector(w,.12);const pts=curvePts([knee,mid,ank],ls[1]);
      gl.push(sweep({pts,m:ls[0]+1,up:w,r:t=>[lerp(L.tr[0],L.tr[1],t),lerp(L.tr[0],L.tr[1],t)*.9],uv:col(1),cap0:1,cap1:2}));
      if(L.tspines){const td=new V3().subVectors(ank,knee).normalize();for(let s=0;s<5;s++){const tt=.35+s*.13;const p=knee.clone().lerp(ank,tt).addScaledVector(w,L.tr[0]*.7);const tip=p.clone().addScaledVector(w,.45).addScaledVector(td,.25);
          gl.push(sweep({pts:[p,p.clone().lerp(tip,.5),tip],m:4,r:t=>.09*(1-t)+.015,uv:col(7),cap1:1}));}}}
    { let p=ank.clone();const segs=L.ta;let acc=0;const tot=segs.reduce((x2,y2)=>x2+y2,0);
      for(let s=0;s<segs.length;s++){const q=p.clone().addScaledVector(tdir,segs[s]*.92);q.y=lerp(.42,.22,(acc+segs[s])/tot);const m2=p.clone().lerp(q,.5);m2.y+=.12;
        const r0=.27-.04*s,r1=.22-.04*s;gl.push(sweep({pts:curvePts([p,m2,q],6),m:ls[0],r:t=>[lerp(r0,r1,t),lerp(r0,r1,t)*.85],uv:col(3),cap0:1,cap1:1}));acc+=segs[s];p=q;}
      for(const cs of[-1,1]){const side=new V3(-tdir.z,0,tdir.x).multiplyScalar(cs*.12);const q0=p.clone().add(side);const q1=q0.clone().addScaledVector(tdir,.45).add(new V3(0,-.08,0));const q2=q1.clone().addScaledVector(tdir,.12).add(new V3(0,-.26,0));
        gl.push(sweep({pts:curvePts([q0,q1,q2],6),m:4,r:t=>.07*(1-t)+.012,uv:col(7),cap1:1}));}}
    const lg=merge(gl);ensure(lg,"aDef",1,[0]);
    const pivot=new THREE.Group();pivot.position.copy(c0);root.add(pivot);lg.translate(-c0.x,-c0.y,-c0.z);
    const lm=new THREE.Mesh(lg,bodyMat);lm.castShadow=true;lm.receiveShadow=true;pivot.add(lm);legs.push({pivot,name:L.n,side:sg});disposables.push(lg);}
  /* ---------- anchors (metres, group frame) ---------- */
  const A=v=>toRoot(v).multiplyScalar(.001);
  const anchors={head:A(new V3(0,1.5,15.5)),eyes:A(new V3(0,1.4,13.6)),thorax:A(new V3(0,4.6,4)),abdomen:A(new V3(0,2,-9)),wingTip:A(WF(46,7.5,0)),center:new V3(0,.0085,-.009)};
  let singT=0,sing=0,tAcc=0;const tw={ant:[0,0],antT:9,legI:-1,legT:0,next:2+rng()*3};
  group.userData={kind:"minmin-zemi",anchors,size:{length:.059,width:.026,height:.017},
    setSinging(v){singT=clamp(+v||0,0,1);},
    get singing(){return sing;},
    update(dt,t){dt=Math.min(Math.max(dt||0,0),.1);tAcc+=dt;const tt=(t!=null)?t:tAcc;sing+=(singT-sing)*Math.min(1,dt*5);
      UB.uTime.value=tt;UB.uSing.value=sing;UB.uBreath.value=1-sing*.6;
      tw.next-=dt;if(tw.next<=0){tw.next=2.5+rng()*5;if(rng()<.55){tw.ant=[rng.s()*.22,rng.s()*.22];tw.antT=0;}else{tw.legI=(rng()*legs.length)|0;tw.legT=0;}}
      tw.antT+=dt;const ak=Math.exp(-tw.antT*3);
      antennae.forEach((a2,i)=>{a2.rotation.y=tw.ant[i]*ak*Math.sin(tw.antT*9);a2.rotation.x=-tw.ant[i]*.6*ak*Math.sin(tw.antT*7);});
      legs.forEach((L,i)=>{let r=0;if(i===tw.legI){tw.legT+=dt;const kk=tw.legT/.7;r=kk<1?Math.sin(kk*PI)*.05:0;if(kk>=1)tw.legI=-1;}L.pivot.rotation.z=r*L.side;L.pivot.rotation.x=-r*.4;});},
    dispose(){disposables.forEach(d=>{try{d.dispose();}catch(e){}});}};
  return group;}
/* ==================================================================
   5. MON-KAGEROU (Ephemera strigata imago, male)
   body frame (mm): +z head, +y dorsal; spine from head front z=+9 to abdomen tip z=-9
   ================================================================== */
const MFY={
  rad:table([// z, rx, ry
    [-9.0,.3,.28],[-8.8,.45,.4],[-8.0,.56,.5],[-6,.68,.62],[-3,.76,.7],[1,.8,.76],[3.0,.86,.86],[3.6,.98,1.08],[4.3,1.1,1.36],[5.2,1.17,1.52],[6.2,1.12,1.42],
    [7.0,.94,1.08],[7.5,.74,.76],[7.95,.62,.6],[8.4,.72,.68],[8.8,.6,.56],[9.0,.32,.32]]),
  segs:[3.0,1.8,.6,-.6,-1.8,-3.0,-4.2,-5.4,-6.6,-7.8,-9.0]
};
function mfSpine(pose){const pts=[];const n=64;for(let i=0;i<=n;i++){const t=i/n,z=lerp(9,-9,t);const ab=Math.max(0,3.0-z);
    let y=pose==="rest"?.034*ab*ab:(pose==="fly"?.012*ab*ab:-.0015*ab*ab);
    y+=.32*Math.exp(-Math.pow((z-5.4)/1.3,2));if(z>7.6)y-=(z-7.6)*.28;pts.push(new V3(0,y,z));}return pts;}
function mfSegK(z){const S=MFY.segs;for(let i=0;i<S.length-1;i++){if(z<=S[i]&&z>S[i+1]){const t=(S[i]-z)/(S[i]-S[i+1]);return 1+.06*Math.pow(t,1.6)*(1-sstep(.85,1,t))-.02*(1-sstep(0,.15,t));}}return 1;}

/* body / legs atlas: body region x[0,.75] (u around, ventral seam), legs/tails columns x[.75,1] */
function paintMayflyBody(W,H,seed){const rng=RNG(seed);const c=mkCanvas(W,H),x=c.getContext("2d",CTXO);const k=W/512;
  const BW=W*.75;const P=(u,v)=>[u*BW,(1-v)*H];// u around (0 ventral,.25 +x side,.5 dorsal), v along (0 head .. 1 tip)
  const rect=(u0,u1,v0,v1,col)=>{const a=P(u0,v1),b=P(u1,v0);x.fillStyle=col;x.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);};
  const blob=(pts,col)=>fillPoly(x,crPts(pts.map(p=>P(p[0],p[1])),true,4),col);
  const vOf=z=>(9-z)/18;
  // base: cream / ochre
  const g=x.createLinearGradient(0,0,BW,0);g.addColorStop(0,"#e2cc96");g.addColorStop(.22,"#d2a858");g.addColorStop(.5,"#b8862e");g.addColorStop(.78,"#d2a858");g.addColorStop(1,"#e2cc96");x.fillStyle=g;x.fillRect(0,0,BW,H);
  // head: dark on top, between the eyes
  rect(.3,.7,vOf(9.1),vOf(7.9),"#3a2412");blob([[.42,vOf(9.0)],[.58,vOf(9.0)],[.6,vOf(8.2)],[.4,vOf(8.2)]],"#20140a");
  // pronotum: dark lateral bars + median pale line
  rect(.32,.47,vOf(7.9),vOf(7.0),"#4a2c14");rect(.53,.68,vOf(7.9),vOf(7.0),"#4a2c14");
  rect(.14,.26,vOf(7.8),vOf(7.1),"#5a3618");rect(.74,.86,vOf(7.8),vOf(7.1),"#5a3618");
  // mesonotum: brown shield with pale median suture and pale lateral sutures
  blob([[.3,vOf(7.0)],[.7,vOf(7.0)],[.74,vOf(5.6)],[.68,vOf(4.2)],[.5,vOf(3.9)],[.32,vOf(4.2)],[.26,vOf(5.6)]],"#6a4220");
  blob([[.36,vOf(6.8)],[.64,vOf(6.8)],[.66,vOf(5.4)],[.6,vOf(4.4)],[.5,vOf(4.2)],[.4,vOf(4.4)],[.34,vOf(5.4)]],"#4a2c14");
  rect(.493,.507,vOf(7.0),vOf(4.1),"#e8d3a0");
  blob([[.38,vOf(5.1)],[.46,vOf(5.0)],[.45,vOf(4.5)],[.38,vOf(4.6)]],"#d9bd82");blob([[.62,vOf(5.1)],[.54,vOf(5.0)],[.55,vOf(4.5)],[.62,vOf(4.6)]],"#d9bd82");
  // pleura: dark brown spots on cream
  for(const s of[.2,.8])for(const z of[6.4,5.0,3.8]){const p=P(s,vOf(z));gdot(x,p[0],p[1],(.06+rng()*.03)*BW,"62,36,16",.9);}
  // metanotum dark band
  rect(.32,.68,vOf(4.0),vOf(3.1),"#5a3618");
  // abdomen segments
  const S=MFY.segs;
  for(let i=0;i<S.length-1;i++){const va=vOf(S[i]),vb=vOf(S[i+1]),dv=vb-va;const dark=i>=7?"#3a2210":"#4c2c12";
    // dorsal dark band on the posterior 65% with paired pale streaks
    blob([[.29,va+dv*.18],[.5,va+dv*.12],[.71,va+dv*.18],[.73,vb-dv*.02],[.27,vb-dv*.02]],dark);
    rect(.44,.465,va+dv*.4,vb-dv*.12,"#b98a44");rect(.535,.56,va+dv*.4,vb-dv*.12,"#b98a44");
    // dark triangles toward the sides
    blob([[.24,va+dv*.5],[.29,va+dv*.4],[.3,vb-dv*.05],[.22,vb-dv*.08]],"#5a3416");blob([[.76,va+dv*.5],[.71,va+dv*.4],[.7,vb-dv*.05],[.78,vb-dv*.08]],"#5a3416");
    // ventral faint marks
    blob([[.06,va+dv*.4],[.1,va+dv*.35],[.11,vb-dv*.2],[.05,vb-dv*.2]],"rgba(120,80,40,.5)");blob([[.94,va+dv*.4],[.9,va+dv*.35],[.89,vb-dv*.2],[.95,vb-dv*.2]],"rgba(120,80,40,.5)");
    // intersegmental pale ring + dark posterior margin
    rect(0,1,vb-dv*.05,vb,"#3a2414");rect(.2,.8,va,va+dv*.045,"#e2c27e");}
  // tip darker
  rect(.2,.8,vOf(-8.4),vOf(-9.1),"#2e1a0c");
  // legs / tails columns (u around, v along proximal->distal)
  const L0=W*.75,cw=(W-L0)/4;const col=(i,stops,rings)=>{const xa=L0+i*cw;const gg=x.createLinearGradient(0,H,0,0);for(const s2 of stops)gg.addColorStop(s2[0],s2[1]);x.fillStyle=gg;x.fillRect(xa,0,cw,H);
    if(rings){for(let r=0;r<rings;r++){const yy=H-(r+.5)/rings*H;x.fillStyle="rgba(214,190,140,.55)";x.fillRect(xa,yy,cw,Math.max(1,H/rings*.22));}}};
  col(0,[[0,"#6a4a26"],[.25,"#3a2412"],[.6,"#2c1a0c"],[1,"#1e1208"]],18);// forelegs (dark)
  col(1,[[0,"#e8d8aa"],[.3,"#dcc58e"],[.55,"#8a6a3a"],[.6,"#dcc58e"],[.95,"#b89a62"],[1,"#5a3c1c"]]);// mid/hind legs (pale)
  col(2,[[0,"#4a2e16"],[.3,"#3a2412"],[1,"#2a1a0c"]],60);// tails with pale annulations
  col(3,[[0,"#2a1a0c"],[1,"#120a04"]]);// antennae / claws
  // grain
  const im=x.getImageData(0,0,W,H),d=im.data;const GT=grainTile(rng,256);for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++){const o=(yy*W+xx)*4;const f=.9+.16*GT[(yy&255)*256+(xx&255)];d[o]*=f;d[o+1]*=f;d[o+2]*=f;}x.putImageData(im,0,0);
  return c;}
function paintMayflyEye(S){const c=mkCanvas(S,S),x=c.getContext("2d",CTXO);const g=x.createLinearGradient(0,0,0,S);g.addColorStop(0,"#2a2622");g.addColorStop(.5,"#1a1714");g.addColorStop(1,"#0e0c0a");x.fillStyle=g;x.fillRect(0,0,S,S);
  x.fillStyle="rgba(90,70,50,.25)";x.fillRect(0,S*.55,S,S*.2);return c;}

/* ---- wing venation (Ephemeridae, dense network) ---- */
const MW={
  fore:{L:19,outline:[[0,.3],[1,-.05],[4,-.12],[8,-.12],[12,0],[15.5,.25],[17.6,.7],[18.7,1.4],[19.0,2.2],[18.7,3.2],[17.6,4.6],[16.0,6.0],[14.2,7.2],[12.4,8.1],[10.8,8.6],[9.3,8.6],[7.8,8.0],[6.0,6.8],[4.2,5.3],[2.6,3.7],[1.3,2.2],[.4,1.1]]},
  hind:{L:6.2,outline:[[0,.25],[.8,-.05],[2.0,-.32],[3.0,-.2],[4.6,.2],[5.7,.9],[6.2,1.9],[6.0,2.9],[5.2,3.7],[4.0,4.2],[2.7,4.1],[1.5,3.3],[.6,2.0],[.1,1.0]]}
};
function mayflyVeins(){
  const LV=[// longitudinal veins of the forewing (ordered from costa to anal margin); i: intercalary
    {p:[[.5,.3],[5,.24],[10,.3],[15,.45],[18.2,.92]],w:.085},
    {p:[[.6,.5],[5,.55],[10,.62],[15,.86],[18.9,1.75]],w:.08},
    {p:[[.8,.7],[5,.95],[10,1.3],[15,1.92],[18.85,2.65]],w:.07},
    {p:[[8.5,1.6],[13,2.3],[18.55,3.35]],w:.05,i:1},
    {p:[[2.5,1.0],[6,1.42],[10.5,2.12],[15,2.92],[18.2,3.95]],w:.065},
    {p:[[9,2.48],[13.5,3.32],[17.65,4.6]],w:.05,i:1},
    {p:[[2.2,1.22],[6,1.92],[10.5,2.92],[14.5,3.92],[17.05,5.2]],w:.065},
    {p:[[1.0,1.4],[5,2.42],[9.5,3.62],[13.5,4.82],[16.25,5.9]],w:.065},
    {p:[[8,3.62],[12,4.85],[15.35,6.5]],w:.05,i:1},
    {p:[[5,2.62],[9,3.92],[12.5,5.32],[14.45,6.95]],w:.06},
    {p:[[.9,1.72],[4.5,3.02],[8.5,4.62],[12,6.32],[13.45,7.5]],w:.065},
    {p:[[7,4.72],[10,6.22],[12.45,7.95]],w:.05,i:1},
    {p:[[4,3.42],[7.5,5.22],[10.2,6.82],[11.65,8.3]],w:.06},
    {p:[[.8,1.92],[3.5,3.42],[6.5,5.32],[9,7.02],[10.65,8.6]],w:.065},
    {p:[[5,5.02],[7.5,6.62],[9.25,8.6]],w:.045,i:1},
    {p:[[4,4.82],[6,6.32],[7.75,8.08]],w:.045,i:1},
    {p:[[.7,2.12],[2.5,3.62],[4.5,5.32],[6.35,7.0]],w:.06},
    {p:[[.5,1.62],[1.6,2.82],[3.2,4.42],[4.62,5.68]],w:.055},
    {p:[[.4,1.32],[1.2,2.22],[2.45,3.55]],w:.05}];
  const HV=[{p:[[.3,.35],[2.2,.05],[4.2,.15],[5.75,.95]],w:.06},{p:[[.4,.6],[2.6,.75],[4.6,1.25],[6.1,1.9]],w:.05},{p:[[.5,.85],[3,1.55],[5.2,2.6],[5.9,3.0]],w:.05},
    {p:[[.5,1.05],[2.8,2.25],[4.3,3.45],[4.8,3.85]],w:.045},{p:[[.4,1.25],[2.2,2.75],[3.3,3.95]],w:.045},{p:[[.3,1.45],[1.3,2.75],[2.2,3.75]],w:.04}];
  return{LV,HV};}
function polyAt(pts){const P=crPts(pts,false,10);return function(x){if(x<=P[0][0])return P[0][1];for(let i=0;i<P.length-1;i++){if(x<=P[i+1][0]){const t=(x-P[i][0])/Math.max(1e-6,P[i+1][0]-P[i][0]);return lerp(P[i][1],P[i+1][1],t);}}return P[P.length-1][1];};}
function paintMayflyWings(W,seed){const rng=RNG(seed);const Hh=W/2,k=W/2048;
  const cw=mkCanvas(W,Hh),cx=cw.getContext("2d",CTXO),aw=mkCanvas(W,Hh),ax=aw.getContext("2d",CTXO);
  const FR={x:6*k,y:6*k,s:(W*.74)/19.2},HR={x:W*.77,y:6*k,s:(W*.22)/6.3};
  cx.fillStyle="#bdb46c";cx.fillRect(0,0,W,Hh);ax.fillStyle="#000";ax.fillRect(0,0,W,Hh);
  const VE=mayflyVeins();
  const draw=(R,def,LV,isFore)=>{const P=p=>[R.x+p[0]*R.s,R.y+(p[1]+.35)*R.s];const s=R.s;
    const out=crPts(def.outline,true,8).map(P);
    // membrane alpha + tint (amber costal fields, greenish disc, darker towards the base)
    ax.save();tracePath(ax,out,true);ax.fillStyle="rgb(78,78,78)";ax.fill();ax.clip();
    const ga=ax.createLinearGradient(R.x,0,R.x+def.L*s*.22,0);ga.addColorStop(0,"rgba(170,170,170,1)");ga.addColorStop(1,"rgba(78,78,78,0)");ax.fillStyle=ga;ax.fillRect(R.x-6*k,0,def.L*s*.25,Hh);ax.restore();
    cx.save();tracePath(cx,out,true);cx.clip();
    const gc=cx.createLinearGradient(0,R.y,0,R.y+9*s);gc.addColorStop(0,"#c99a40");gc.addColorStop(.12,"#c6b45e");gc.addColorStop(.5,"#b8b46a");gc.addColorStop(1,"#a8a46a");cx.fillStyle=gc;cx.fillRect(R.x-6*k,R.y-6*k,def.L*s+12*k,Hh);
    if(isFore){// E. strigata markings: dark oblique band through the middle + spots + smoky stigma
      const band=[[8.2,-.1],[9.6,-.1],[11.4,2.6],[11.9,4.8],[10.9,5.4],[9.8,3.4]].map(P);fillPoly(cx,crPts(band,true,4),"rgba(70,46,20,.55)");
      const band2=[[6.6,1.6],[7.6,1.5],[8.6,3.6],[8.4,5.6],[7.4,5.0],[7.0,3.2]].map(P);fillPoly(cx,crPts(band2,true,4),"rgba(70,46,20,.38)");
      for(const sp of[[2.4,1.0,.45],[4.4,1.9,.4],[12.6,3.0,.4],[13.6,4.6,.35],[14.6,2.2,.35],[15.8,5.8,.3],[11.2,6.6,.35],[5.6,4.2,.35]]){const p=P([sp[0],sp[1]]);gdot(cx,p[0],p[1],sp[2]*s,"60,40,18",.75);gdot(ax,p[0],p[1],sp[2]*s*.8,"255,255,255",.35);}
      const st=[[12.5,-.1],[18.2,.5],[18.2,1.1],[12.5,.45]].map(P);fillPoly(cx,crPts(st,true,3),"rgba(150,110,50,.45)");
      fillPoly(ax,crPts(band.map(p=>p),true,4),"rgba(255,255,255,.12)");}
    cx.restore();
    // vein helpers
    const vline=(pts,w,colC,colA,shade)=>{const Q=crPts(pts.map(P),false,6);if(shade){strokePoly(cx,Q,"rgba(80,56,26,.35)",Math.max(1.5,w*s*3.2));}strokePoly(cx,Q,colC,Math.max(1,w*s));strokePoly(ax,Q,colA,Math.max(1,w*s));};
    const top=outlineBounds(def.outline);
    // longitudinal
    const fns=LV.map(v=>({f:polyAt(v.p),x0:v.p[0][0],x1:v.p[v.p.length-1][0],v}));
    for(const v of LV)vline(v.p,v.w*1.15,"#140d06","rgb(245,245,245)",false);
    // crossveins between neighbouring veins
    const cross=(A,B,sp,w,shade)=>{const xa=Math.max(A.x0,B.x0)+.25,xb=Math.min(A.x1,B.x1)-.15;if(xb<=xa)return;let xx=xa+rng()*sp*.6;
      while(xx<xb){const ya=A.f(xx),yb=B.f(xx);const sl=(B.f(xx+.3)-yb)/.3;const x2=xx-sl*(yb-ya)*.5;
        if(yb-ya>.12)vline([[xx,ya],[(xx+x2)/2+rng.s()*.05,(ya+yb)/2],[x2,yb]],w,"#1a1209","rgb(238,238,238)",shade);xx+=sp*(.75+.5*rng());}};
    if(isFore){
      // costal field: from costa (outline top) to Sc
      const sc=fns[0];let xx=1.2;while(xx<18.4){const yc=top(xx)[0]+.04,ys=sc.f(xx);if(ys-yc>.08)vline([[xx,yc],[xx+.08,ys]],.035,"#1a1209","rgb(235,235,235)",xx>12&&xx<18);xx+=xx>12.2&&xx<18?.3:(xx<3?.8:.48);}
      cross(fns[0],fns[1],.62,.035,false);
      for(let i=1;i<fns.length-1;i++){cross(fns[i],fns[i+1],.55,.038,i>3&&i<12);}
      // marginal intercalaries along the termen
      for(let i=1;i<fns.length-1;i++){const A=fns[i],B=fns[i+1];if(A.x1<5||B.x1<5)continue;const ex=(A.x1+B.x1)/2,ey=(A.f(A.x1)+B.f(B.x1))/2;vline([[ex-.9,ey-.45],[ex,ey]],.03,"#1a1209","rgb(230,230,230)",false);}
      // cubital intercalaries to the anal margin
      for(const cv of[[[3.0,3.1],[3.6,4.4],[4.3,5.2]],[[2.4,2.6],[2.6,3.4],[2.9,3.95]],[[5.2,5.4],[5.5,6.4],[5.9,6.85]]])vline(cv,.035,"#1a1209","rgb(235,235,235)",false);}
    else{for(let i=0;i<fns.length-1;i++)cross(fns[i],fns[i+1],.45,.03,false);}
    // costal margin (thick) and outline
    const cst=crPts(def.outline.filter(p=>p[1]<(isFore?1.0:.6)&&p[0]<def.L*.97),false,6).map(P);
    strokePoly(cx,out,"#1a1209",Math.max(1,.05*s));strokePoly(ax,out,"rgb(225,225,225)",Math.max(1,.05*s));
    strokePoly(cx,cst,"#24180a",Math.max(1.5,.12*s));strokePoly(ax,cst,"rgb(250,250,250)",Math.max(1.5,.12*s));};
  draw(FR,MW.fore,VE.LV,true);draw(HR,MW.hind,VE.HV,false);
  const cd=cx.getImageData(0,0,W,Hh).data,ad=ax.getImageData(0,0,W,Hh).data;const data=new Uint8Array(W*Hh*4);const GT=grainTile(rng,128);
  for(let y=0;y<Hh;y++){const sy=Hh-1-y;for(let x=0;x<W;x++){const i=(y*W+x)*4,j=(sy*W+x)*4;const gr=.93+.1*GT[(y&127)*128+(x&127)];data[i]=cd[j]*gr;data[i+1]=cd[j+1]*gr;data[i+2]=cd[j+2]*gr;data[i+3]=ad[j];}}
  const tex=new THREE.DataTexture(data,W,Hh,THREE.RGBAFormat,THREE.UnsignedByteType);tex.encoding=THREE.sRGBEncoding;tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.anisotropy=8;tex.needsUpdate=true;
  const uvF=(x,y)=>[(FR.x+x*FR.s)/W,1-(FR.y+(y+.35)*FR.s)/Hh],uvH=(x,y)=>[(HR.x+x*HR.s)/W,1-(HR.y+(y+.35)*HR.s)/Hh];
  return{tex,uvF,uvH};}

function makeMonKagerou(opts){opts=opts||{};const ql=qlevel(opts);const pose=(opts.pose==="fly"||opts.pose==="spent")?opts.pose:"rest";const seed=(opts.seed|0)||11;const rng=RNG(seed*13+3);
  const group=new THREE.Group();group.name="mon-kagerou-"+pose;
  const root=new THREE.Group();root.scale.setScalar(.001);group.add(root);
  const body=new THREE.Group();root.add(body);
  // placement of the body frame in the canonical frame
  if(pose==="rest"){body.position.set(0,3.35,0);body.rotation.x=-.03;}
  else if(pose==="spent"){body.position.set(0,.62,0);body.rotation.z=.04;}
  const disposables=[];
  const TW=QS(ql,128,256,512),TH=TW*2;
  const tBody=cTex(paintMayflyBody(TW,TH,seed),true);disposables.push(tBody);
  const bodyMat=new THREE.MeshPhysicalMaterial({map:tBody,roughness:.5,metalness:0,clearcoat:.35,clearcoatRoughness:.35,side:THREE.FrontSide});patchMat(bodyMat,{transl:.25});disposables.push(bodyMat);
  const colU=i=>[.75+.25*i/4+.004,0,.75+.25*(i+1)/4-.004,1];
  const parts=[];
  const spine=mfSpine(pose);
  const m=QS(ql,8,12,18);
  { const g=sweep({pts:spine,m,up:new V3(0,1,0),twist:-PI/2,r:t=>{const z=lerp(9,-9,t);const r=MFY.rad(z);const kk=z<3?mfSegK(z):1;return[r[0]*kk,r[1]*kk];},uv:[0,0,.75,1],cap0:3,cap1:3});parts.push(g);}
  const spAt=z=>{let best=spine[0];for(const p of spine)if(Math.abs(p.z-z)<Math.abs(best.z-z))best=p;return best.clone();};
  // antennae (tiny bristles)
  for(const sg of[1,-1]){const b=spAt(8.7).add(new V3(sg*.25,.35,0));const pts=[b,b.clone().add(new V3(sg*.25,.25,.3)),b.clone().add(new V3(sg*.45,.4,.75))];
    parts.push(sweep({pts:curvePts(pts,6),m:4,r:t=>.05-.03*t,uv:colU(3),cap1:1}));}
  // legs: mid/hind (merged into body), forelegs (own meshes for animation)
  body.updateMatrix();const BM=body.matrix.clone(),BMi=BM.clone().invert();
  const toRoot=v=>v.clone().applyMatrix4(BM),toBody=v=>v.clone().applyMatrix4(BMi);
  const ls=QS(ql,[4,6],[6,10],[6,14]);
  const legTube=(pts,r0,r1,col,list)=>{list.push(sweep({pts:curvePts(pts,ls[1]),m:ls[0],r:t=>lerp(r0,r1,t),uv:colU(col),cap0:1,cap1:1}));};
  const legSpec=[{c:new V3(.6,-1.15,5.4),fl:2.7,tl:2.9,ta:2.2,foot:new V3(3.2,0,7.8),pole:new V3(.6,1,.4)},{c:new V3(.6,-1.0,3.9),fl:3.1,tl:3.2,ta:2.5,foot:new V3(3.4,0,.8),pole:new V3(.6,1,-.4)}];
  for(const L of legSpec)for(const sg of[1,-1]){const c0b=new V3(L.c.x*sg,L.c.y+spAt(L.c.z).y,L.c.z);const lst=[];
    if(pose==="rest"){const c0=toRoot(c0b);const foot=new V3(L.foot.x*sg,0,L.foot.z);const tdir=new V3(foot.x-c0.x,0,foot.z-c0.z).normalize();const ank=foot.clone().addScaledVector(tdir,-L.ta*.85);ank.y=.18;
      const a=L.fl,b=L.tl;const d0=new V3().subVectors(ank,c0);const d=Math.min(d0.length(),a+b-.05);const u=d0.clone().normalize();const xx=(a*a-b*b+d*d)/(2*d);const hh=Math.sqrt(Math.max(0,a*a-xx*xx));const pole=new V3(L.pole.x*sg,L.pole.y,L.pole.z).normalize();
      const w=pole.clone().sub(u.clone().multiplyScalar(pole.dot(u))).normalize();const knee=c0.clone().addScaledVector(u,xx).addScaledVector(w,hh);const a2=c0.clone().addScaledVector(u,d);
      const pts=[c0,knee,a2,foot.clone().setY(.08)].map(toBody);legTube([pts[0],pts[0].clone().lerp(pts[1],.5),pts[1]],.17,.13,1,lst);legTube([pts[1],pts[1].clone().lerp(pts[2],.5),pts[2]],.11,.08,1,lst);legTube([pts[2],pts[2].clone().lerp(pts[3],.5).add(new V3(0,.12,0)),pts[3]],.07,.04,1,lst);}
    else if(pose==="fly"){const back=L.c.z<4.5?1:0;const p1=c0b.clone().add(new V3(sg*.9,-.6,-.6-back*.4)),p2=p1.clone().add(new V3(sg*.5,-.5,-2.2)),p3=p2.clone().add(new V3(sg*.15,-.2,-1.8));
      legTube([c0b,c0b.clone().lerp(p1,.5),p1],.17,.13,1,lst);legTube([p1,p1.clone().lerp(p2,.5),p2],.11,.08,1,lst);legTube([p2,p2.clone().lerp(p3,.5),p3],.07,.04,1,lst);}
    else{const hind=L.c.z<4.5;const dir=new V3(sg*(hind?.5:.55),0,hind?-.85:.83).normalize();const side=new V3(sg,0,0);const p1=c0b.clone().addScaledVector(side,1.5).addScaledVector(dir,.4).setY(-.42);
      const p2=p1.clone().addScaledVector(side,1.1).addScaledVector(dir,1.9).setY(-.55);const p3=p2.clone().addScaledVector(side,.4).addScaledVector(dir,1.9).setY(-.57);
      legTube([c0b,c0b.clone().lerp(p1,.5),p1],.17,.13,1,lst);legTube([p1,p1.clone().lerp(p2,.5),p2],.11,.08,1,lst);legTube([p2,p2.clone().lerp(p3,.5),p3],.07,.04,1,lst);}
    parts.push(...lst);}
  const bodyGeo=merge(parts);disposables.push(bodyGeo);const bodyMesh=new THREE.Mesh(bodyGeo,bodyMat);bodyMesh.castShadow=true;bodyMesh.receiveShadow=true;body.add(bodyMesh);
  // eyes (male: large, dark, dorsal)
  const eyeMat=new THREE.MeshPhysicalMaterial({map:cTex(paintMayflyEye(32),true),roughness:.3,metalness:0,clearcoat:.9,clearcoatRoughness:.08});patchMat(eyeMat,{pupil:true,fakeEnv:.6});eyeMat.userData.U.uPupil.value=.3;disposables.push(eyeMat,eyeMat.map);
  { const h=spAt(8.45);const eg=[ellip([.44,h.y+.55,8.4],[.62,.6,.64],QS(ql,10,14,20),QS(ql,8,10,14),null),ellip([-.44,h.y+.55,8.4],[.62,.6,.64],QS(ql,10,14,20),QS(ql,8,10,14),null),
      ellip([.6,h.y-.05,8.55],[.3,.3,.32],8,6,null),ellip([-.6,h.y-.05,8.55],[.3,.3,.32],8,6,null)];const g=merge(eg);disposables.push(g);const em=new THREE.Mesh(g,eyeMat);em.castShadow=true;body.add(em);}
  // forelegs (long, dark, held forward)
  const forelegs=[];
  for(const sg of[1,-1]){const c0=new V3(.45*sg,-.55+spAt(7.5).y,7.5);const piv=new THREE.Group();piv.position.copy(c0);body.add(piv);let dirs;
    if(pose==="rest")dirs=[new V3(.16*sg,.6,.78),new V3(.12*sg,.86,.5),new V3(.13*sg,.9,.42)];
    else if(pose==="fly")dirs=[new V3(.12*sg,.2,.97),new V3(.1*sg,.12,.99),new V3(.14*sg,.06,.99)];
    else dirs=[new V3(.45*sg,-.15,.88),new V3(.32*sg,-.02,.95),new V3(.3*sg,0,.95)];
    const lens=[3.2,5.0,5.6];let p=new V3();const pts=[p.clone()];for(let i=0;i<3;i++){p=p.clone().addScaledVector(dirs[i].clone().normalize(),lens[i]);if(pose==="spent")p.y=Math.max(p.y,-.5-c0.y);pts.push(p);}
    const lst=[];legTube([pts[0],pts[0].clone().lerp(pts[1],.5),pts[1]],.16,.12,0,lst);legTube([pts[1],pts[1].clone().lerp(pts[2],.5),pts[2]],.1,.08,0,lst);legTube([pts[2],pts[2].clone().lerp(pts[3],.5),pts[3]],.07,.035,0,lst);
    const g=merge(lst);disposables.push(g);const fm=new THREE.Mesh(g,bodyMat);fm.castShadow=true;piv.add(fm);forelegs.push({piv,sg});}
  // tails (2 cerci + median filament)
  const tailPiv=new THREE.Group();const tip=spine[spine.length-1];tailPiv.position.copy(tip);body.add(tailPiv);
  { const lst=[];const tl=[32,28,32],nT=QS(ql,10,16,24);
    for(let i=0;i<3;i++){const sp=(i-1);let dir,droop;
      if(pose==="rest"){dir=new V3(sp*.045,.14,-1);droop=-.0009;}else if(pose==="fly"){dir=new V3(sp*.16,-.02,-1);droop=-.004;}else{dir=new V3(sp*.42,0,-1);droop=0;}
      dir.normalize();const pts=[];for(let j=0;j<=nT;j++){const s=j/nT*tl[i];const q=new V3().addScaledVector(dir,s);q.y+=droop*s*s;if(pose==="spent"){q.y=-.4*(1-Math.exp(-s*.6));q.x+=sp*.02*s*s/10;}pts.push(q);}
      lst.push(sweep({pts,m:QS(ql,3,4,5),r:t=>.11*(1-t)+.03,uv:colU(2),cap1:1}));}
    const g=merge(lst);disposables.push(g);const tm=new THREE.Mesh(g,bodyMat);tm.castShadow=true;tailPiv.add(tm);}
  /* ---------- wings ---------- */
  const WT=paintMayflyWings(QS(ql,512,1024,2048),seed+5);disposables.push(WT.tex);
  const veinMat=new THREE.MeshStandardMaterial({map:WT.tex,alphaTest:.5,side:THREE.DoubleSide,roughness:.45,metalness:0});patchMat(veinMat,{transl:.25});
  const memMat=new THREE.MeshPhysicalMaterial({map:WT.tex,transparent:true,depthWrite:false,side:THREE.DoubleSide,roughness:.16,metalness:0,clearcoat:.3,clearcoatRoughness:.1});patchMat(memMat,{transl:.65,glint:.35});
  disposables.push(veinMat,memMat);
  const elev=pose==="rest"?60*PI/180:74*PI/180;
  const wingSegs=QS(ql,[10,5],[18,8],[28,12]);
  const wings=[];
  const mkW=(def,uvf,hinge,el,sg,ro)=>{const Dx=new V3(0,Math.sin(el),-Math.cos(el)),Dy=new V3(0,-Math.cos(el),-Math.sin(el));
    const f=(x,y)=>{const camber=.22*Math.sin(PI*clamp(y/8.8,0,1))*clamp(x/def.L,0,1);return new V3(sg*(.1+camber+.012*y),0,0).addScaledVector(Dx,x).addScaledVector(Dy,y);};
    const g0=wingGeo(def,wingSegs[0],wingSegs[1],f,uvf,.2);const g=g0;disposables.push(g);
    const piv=new THREE.Group();piv.position.copy(hinge);body.add(piv);const vm=new THREE.Mesh(g,veinMat),mm=new THREE.Mesh(g,memMat);vm.castShadow=true;mm.castShadow=false;mm.renderOrder=ro;piv.add(vm);piv.add(mm);
    wings.push({piv,sg});return piv;};
  const hy=spAt(5.6).y;
  for(const sg of[1,-1]){mkW(MW.hind,WT.uvH,new V3(.2*sg,hy+1.05,4.5),elev-.42,sg,2);mkW(MW.fore,WT.uvF,new V3(.22*sg,hy+1.2,5.6),elev,sg,3);}
  const spentJit=[rng.s()*.04,rng.s()*.04];
  const setWing=(theta)=>{wings.forEach((w,i)=>{const th=theta+(pose==="spent"?spentJit[w.sg>0?0:1]:0);w.piv.rotation.z=-w.sg*th;});};
  setWing(pose==="rest"?0:(pose==="spent"?PI/2+.095:PI/2));
  let ph=rng()*TAU,tAcc=0;
  const anchors={head:toRoot(new V3(0,0,8.5)).multiplyScalar(.001),thorax:toRoot(new V3(0,0,5.4)).multiplyScalar(.001),wingTip:toRoot(new V3(0,15,-7.5)).multiplyScalar(.001),center:new V3(0,pose==="rest"?.006:(pose==="spent"?.001:0),-.002)};
  group.userData={kind:"mon-kagerou",pose,anchors,flap:pose==="fly"?.6:0,size:{length:.05,body:.018,wing:.019},
    update(dt,t){dt=Math.min(Math.max(dt||0,0),.1);tAcc+=dt;const tt=(t!=null)?t:tAcc;
      if(pose==="fly"){const fl=clamp(group.userData.flap,0,1);ph+=dt*TAU*lerp(3,15,fl);const th=PI/2-.15-(.55+.25*fl)*Math.sin(ph);setWing(th);body.position.y=.35*Math.sin(ph+1.2)*fl;body.rotation.x=-.05+.03*Math.sin(ph+.6);
        tailPiv.rotation.x=.04*Math.sin(tt*2.1);forelegs.forEach(f=>{f.piv.rotation.x=.03*Math.sin(tt*3+f.sg);});}
      else if(pose==="rest"){setWing(.012*Math.sin(tt*1.7)+.006*Math.sin(tt*5.3));forelegs.forEach(f=>{f.piv.rotation.x=-.06*(.5+.5*Math.sin(tt*.9+f.sg*.7));f.piv.rotation.y=.03*f.sg*Math.sin(tt*.6);});
        tailPiv.rotation.y=.02*Math.sin(tt*.8);tailPiv.rotation.x=.012*Math.sin(tt*1.3);}
      else{const tw=Math.max(0,Math.sin(tt*.7))*Math.pow(Math.max(0,Math.sin(tt*3.1)),8);setWing(PI/2+.095-.05*tw);forelegs.forEach(f=>{f.piv.rotation.y=.02*f.sg*Math.sin(tt*.5+f.sg);});tailPiv.rotation.y=.01*Math.sin(tt*.4);}},
    dispose(){disposables.forEach(d=>{try{d.dispose();}catch(e){}});}};
  group.userData.update(0,0);
  return group;}

/* ==================================================================
   6. MAYFLY SWARM (InstancedMesh, nuptial dance)
   ================================================================== */
function makeMayflySwarm(opts){opts=opts||{};const ql=qlevel(opts);const count=Math.max(1,(opts.count|0)||40),radius=opts.radius!=null?+opts.radius:1.2,height=opts.height!=null?+opts.height:2.0;const rng=RNG(((opts.seed|0)||23)*7+1);
  const group=new THREE.Group();group.name="mayfly-swarm";const disposables=[];
  // ---- one simplified mayfly (metres): body, 2 forewings, 2 hindwings, 3 tails, 2 forelegs; aWing = +-1 on wing vertices ----
  const pos=[],col=[],wing=[],idx=[];const S=.001;
  const vtx=(p,c,w)=>{pos.push(p[0]*S,p[1]*S,p[2]*S);col.push(c[0],c[1],c[2]);wing.push(w);return pos.length/3-1;};
  const cBody=[.42,.28,.14],cWing=[1.0,.86,.52],cWing2=[.92,.8,.5],cTail=[.3,.2,.1];
  // body: tapered octagonal tube along z
  const segs=[[8.8,.45],[7.4,.7],[5.4,1.1],[3.4,.85],[0,.78],[-4,.68],[-7.5,.55],[-9,.32]];const nr=QS(ql,4,5,6);const ringIdx=[];
  for(const s of segs){const r=[];const yc=s[0]<3?.012*(3-s[0])*(3-s[0]):0;for(let j=0;j<nr;j++){const a=j/nr*TAU;r.push(vtx([Math.cos(a)*s[1],yc+Math.sin(a)*s[1]*1.05,s[0]],cBody,0));}ringIdx.push(r);}
  for(let i=0;i<ringIdx.length-1;i++)for(let j=0;j<nr;j++){const a=ringIdx[i][j],b=ringIdx[i][(j+1)%nr],c=ringIdx[i+1][j],d=ringIdx[i+1][(j+1)%nr];idx.push(a,c,b,b,c,d);}
  // wings (vertical "closed" pose in the YZ plane, hinge at y=1.2, z=5.6); rotated in the vertex shader about z by -aWing*theta
  const el=70*PI/180,Dx=[0,Math.sin(el),-Math.cos(el)],Dy=[0,-Math.cos(el),-Math.sin(el)];
  const wp=(x,y,h,sg)=>[sg*.1,h[1]+Dx[1]*x+Dy[1]*y,h[2]+Dx[2]*x+Dy[2]*y];
  for(const sg of[1,-1]){const h=[0,1.2,5.6];const F=[[0,.3],[10,-.1],[19,2.2],[15,6.4],[10.8,8.6],[1.3,2.2]];const fi=F.map(p=>vtx(wp(p[0],p[1],h,sg),cWing,sg));for(let i=1;i<F.length-1;i++)idx.push(fi[0],fi[i],fi[i+1]);
    const h2=[0,1.0,4.4];const Hh=[[0,.2],[3,-.3],[6.2,1.9],[4,4.2],[.6,2]];const hi=Hh.map(p=>vtx(wp(p[0],p[1],h2,sg),cWing2,sg));for(let i=1;i<Hh.length-1;i++)idx.push(hi[0],hi[i],hi[i+1]);}
  // tails and forelegs as thin crossed ribbons
  const ribbon=(a,b,w,c)=>{for(const d of[[w,0,0],[0,w,0]]){const i0=vtx([a[0]-d[0],a[1]-d[1],a[2]],c,0),i1=vtx([a[0]+d[0],a[1]+d[1],a[2]],c,0),i2=vtx([b[0]-d[0]*.4,b[1]-d[1]*.4,b[2]],c,0),i3=vtx([b[0]+d[0]*.4,b[1]+d[1]*.4,b[2]],c,0);idx.push(i0,i2,i1,i1,i2,i3);}};
  for(const sx of[-1,0,1])ribbon([0,.1,-9],[sx*9,4,-38],.14,cTail);
  for(const sx of[-1,1])ribbon([sx*.45,-.4,7.6],[sx*2.2,1.4,21],.11,cTail);
  const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));geo.setAttribute("color",new THREE.Float32BufferAttribute(col,3));geo.setAttribute("aWing",new THREE.Float32BufferAttribute(wing,1));geo.setIndex(idx);geo.computeVertexNormals();
  const aTheta=new THREE.InstancedBufferAttribute(new Float32Array(count),1);aTheta.setUsage(THREE.DynamicDrawUsage);geo.setAttribute("aTheta",aTheta);disposables.push(geo);
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,metalness:0,side:THREE.DoubleSide});
  const flapAttr={decl:"attribute float aWing;attribute float aTheta;\nvec3 tsWingRot(vec3 p,float a){vec3 q=p-vec3(0.,.0012,.0056);float c=cos(a),s=sin(a);q=vec3(q.x*c-q.y*s,q.x*s+q.y*c,q.z);return q+vec3(0.,.0012,.0056);}\n",
    normal:"vec3 objectNormal = vec3( normal );\nif(aWing!=0.){float a=-aWing*aTheta;float c=cos(a),s=sin(a);objectNormal=vec3(objectNormal.x*c-objectNormal.y*s,objectNormal.x*s+objectNormal.y*c,objectNormal.z);}\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif\n",
    pos:"vec3 transformed = vec3( position );\nif(aWing!=0.){transformed=tsWingRot(transformed,-aWing*aTheta);}\n"};
  const UM=patchMat(mat,{flapAttr,transl:1.1,tint:true});disposables.push(mat);
  const mesh=new THREE.InstancedMesh(geo,mat,count);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;group.add(mesh);
  // soft glints (backlit wings read as small bright specks at 4-15 m)
  const gc=mkCanvas(64,64),gx=gc.getContext("2d",CTXO);const gg=gx.createRadialGradient(32,32,0,32,32,32);gg.addColorStop(0,"rgba(255,248,225,1)");gg.addColorStop(.12,"rgba(255,236,190,.95)");gg.addColorStop(.35,"rgba(255,200,130,.4)");gg.addColorStop(1,"rgba(255,180,100,0)");gx.fillStyle=gg;gx.fillRect(0,0,64,64);
  const gtex=cTex(gc,true,1);disposables.push(gtex);
  const gpos=new Float32Array(count*3);const pgeo=new THREE.BufferGeometry();pgeo.setAttribute("position",new THREE.BufferAttribute(gpos,3).setUsage(THREE.DynamicDrawUsage));disposables.push(pgeo);
  const glowBase=opts.glow!=null?+opts.glow:.9;
  const pmat=new THREE.PointsMaterial({map:gtex,size:.062,sizeAttenuation:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:glowBase,color:new THREE.Color(1,.82,.55)});disposables.push(pmat);
  const pts=new THREE.Points(pgeo,pmat);pts.frustumCulled=false;pts.renderOrder=6;group.add(pts);
  // ---- dance state ----
  const F=[];for(let i=0;i<count;i++){const r=radius*Math.sqrt(rng()),a=rng()*TAU;const y=height*(.12+.75*rng());
    F.push({x:Math.cos(a)*r,z:Math.sin(a)*r,y,vy:0,mode:rng()<.35?0:1,top:Math.min(height,y+.5+rng()),bot:Math.max(.05,y-.5-rng()*.8),head:rng()*TAU,ph:rng()*TAU,sw:rng()*TAU,fl:0,flT:rng()*2,spd:.8+.4*rng()});}
  const m4=new THREE.Matrix4(),q4=new THREE.Quaternion(),e4=new THREE.Euler(0,0,0,"YXZ"),v4=new V3(),s4=new V3(1,1,1);
  const step=(dt)=>{for(let i=0;i<count;i++){const f=F[i];
      if(f.mode===0){// rapid rise with fast wing beats
        f.vy+=(1.45*f.spd-f.vy)*Math.min(1,dt*6);f.y+=f.vy*dt;f.ph+=dt*TAU*13;f.th=1.0+.62*Math.sin(f.ph);f.pitch=lerp(f.pitch||0,-1.0,Math.min(1,dt*8));
        const hs=.18;f.x+=Math.cos(f.head)*hs*dt;f.z+=Math.sin(f.head)*hs*dt;
        if(f.y>=f.top){f.mode=1;f.bot=Math.max(.04,f.y-(.5+rng()*1.0));}}
      else{// parachute down, wings raised in a V, occasional flutter
        f.vy+=(-.42*f.spd-f.vy)*Math.min(1,dt*3);f.y+=f.vy*dt;f.sw+=dt*1.6;f.flT-=dt;if(f.flT<=0){f.fl=.35;f.flT=.8+rng()*1.6;}
        if(f.fl>0){f.fl-=dt;f.ph+=dt*TAU*11;f.th=.62+.4*Math.sin(f.ph);}else f.th=lerp(f.th==null?.42:f.th,.42+.05*Math.sin(f.sw*2.3),Math.min(1,dt*6));
        f.pitch=lerp(f.pitch||0,-.22,Math.min(1,dt*4));f.x+=Math.cos(f.sw)*.05*dt+Math.cos(f.head)*.04*dt;f.z+=Math.sin(f.sw*.8)*.05*dt+Math.sin(f.head)*.04*dt;
        if(f.y<=f.bot){f.mode=0;f.top=Math.min(height,f.y+.5+rng()*1.0);if(f.top-f.y<.35){f.top=height;}f.head+=rng.s()*.8;}}
      const rr=Math.hypot(f.x,f.z);if(rr>radius){const tgt=Math.atan2(-f.z,-f.x);f.head=lerp(f.head,tgt,Math.min(1,dt*2));f.x*=radius/rr;f.z*=radius/rr;}
      if(f.y<0){f.y=0;f.mode=0;}if(f.y>height){f.y=height;f.mode=1;}
      e4.set(f.pitch,-f.head+PI/2,Math.sin(f.sw*1.3)*.08);q4.setFromEuler(e4);v4.set(f.x,f.y,f.z);m4.compose(v4,q4,s4);mesh.setMatrixAt(i,m4);aTheta.array[i]=f.th;
      gpos[i*3]=f.x;gpos[i*3+1]=f.y+.002;gpos[i*3+2]=f.z;}
    mesh.instanceMatrix.needsUpdate=true;aTheta.needsUpdate=true;pgeo.attributes.position.needsUpdate=true;};
  let tAcc=0;
  group.userData={kind:"mayfly-swarm",count,radius,height,
    update(dt,t){dt=Math.min(Math.max(dt||0,0),.25);tAcc+=dt;let n=Math.ceil(dt/.04);const h=dt/Math.max(1,n);for(let i=0;i<n;i++)step(h);UM.uTime.value=(t!=null)?t:tAcc;},
    setTint(color,strength){const c=new THREE.Color(color==null?0xffb070:color);const s=strength==null?1:+strength;UM.uTint.value.copy(c).multiplyScalar(.9*s);pmat.color.copy(c).lerp(new THREE.Color(1,1,1),.45);pmat.opacity=Math.min(1,glowBase*(.7+.4*s));},
    setGlow(v){pmat.opacity=+v;pts.visible=v>0;},
    dispose(){disposables.forEach(d=>{try{d.dispose();}catch(e){}});}};
  step(0);for(let i=0;i<20;i++)step(.05);
  return group;}

return{makeMinminZemi,makeMonKagerou,makeMayflySwarm};
})();
