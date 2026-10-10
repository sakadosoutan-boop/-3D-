/* =====================================================================================
 * tsurezure-trees.js  —  const TSURE_TREES   (API doc: see bottom-of-header block "API")
 * placeholder header — replaced at the end of development
 * ===================================================================================== */
const TSURE_TREES=(()=>{
"use strict";
const T=THREE,V3=T.Vector3,TAU=Math.PI*2,UP=new V3(0,1,0);
const clamp=(x,a,b)=>x<a?a:(x>b?b:x),lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

/* ------------------------------------------------------------------ seeded RNG / noise */
function hashStr(s){let h=0x811c9dc5;s=String(s);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}
  h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0;}
function RNG(seed){let a=hashStr(seed)||0x9e3779b9;
  const f=()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
  return{f,r:(lo,hi)=>lo+(hi-lo)*f(),i:(lo,hi)=>lo+Math.floor((hi-lo+1)*f()),g:()=>(f()+f()+f()-1.5)*2,sg:()=>(f()<.5?-1:1),
    v:(s)=>{const u=f()*2-1,t=f()*TAU,q=Math.sqrt(1-u*u);return new V3(q*Math.cos(t),u,q*Math.sin(t)).multiplyScalar(s==null?1:s);}};}
function makeNoise(seed,px,py){const r=RNG(seed),v=new Float32Array(px*py);for(let i=0;i<v.length;i++)v[i]=r.f();
  return(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi;const x0=((xi%px)+px)%px,y0=((yi%py)+py)%py,x1=(x0+1)%px,y1=(y0+1)%py;
    const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);const a=v[y0*px+x0],b=v[y0*px+x1],c=v[y1*px+x0],d=v[y1*px+x1];
    return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;};}
/* periodic fBm on the unit square: f(u,v), u,v in [0,1) */
function makeFbm(seed,px,py,oct){const ns=[];for(let o=0;o<oct;o++)ns.push(makeNoise(seed+":"+o,px<<o,py<<o));
  return(u,v)=>{let s=0,a=.5,n=0;for(let o=0;o<oct;o++){s+=a*ns[o](u*(px<<o),v*(py<<o));n+=a;a*=.5;}return s/n;};}
function QL(q){q=String(q||"high").toLowerCase();
  return q==="low"?{k:"low",n:.32,seg:.6}:q==="medium"?{k:"medium",n:.6,seg:.8}:{k:"high",n:1,seg:1};}
const LIN=(hex)=>{const c=new T.Color(hex);c.convertSRGBToLinear();return[c.r,c.g,c.b];};

/* ------------------------------------------------------------------ texture cache (ref-counted, shared by all trees) */
const TEXC=new Map();
function texAcquire(key,build){let e=TEXC.get(key);if(!e){e={v:build(),n:0};TEXC.set(key,e);}e.n++;return e.v;}
function texRelease(key){const e=TEXC.get(key);if(!e)return;if(--e.n<=0){const v=e.v;
  const list=(v&&v.isTexture)?[v]:Object.values(v||{});for(const t of list)if(t&&t.isTexture)t.dispose();TEXC.delete(key);}}

/* DataTexture with our own mip chain: alpha-weighted colour averaging (no dark fringes) and, for cut-out foliage,
   coverage-preserving alpha scaling (leaves do not thin out / vanish in the distance). */
function coverage(d,thr,s){let c=0;const t=thr*255;for(let k=3;k<d.length;k+=4)if(d[k]*s>t)c++;return c/(d.length/4);}
function buildMips(src,w,h,cut){const out=[{data:src,width:w,height:h}];const cov0=cut>0?coverage(src,cut,1):0;
  let cur=src,cw=w,ch=h;
  while(cw>1||ch>1){const nw=Math.max(1,cw>>1),nh=Math.max(1,ch>>1),d=new Uint8Array(nw*nh*4),sx=cw>1?2:1,sy=ch>1?2:1;
    for(let y=0;y<nh;y++)for(let x=0;x<nw;x++){let r=0,g=0,b=0,a=0,ur=0,ug=0,ub=0,n=0;
      for(let j=0;j<sy;j++)for(let i=0;i<sx;i++){const k=((y*sy+j)*cw+(x*sx+i))*4,al=cur[k+3];r+=cur[k]*al;g+=cur[k+1]*al;b+=cur[k+2]*al;a+=al;ur+=cur[k];ug+=cur[k+1];ub+=cur[k+2];n++;}
      const o=(y*nw+x)*4;if(a>0){d[o]=r/a;d[o+1]=g/a;d[o+2]=b/a;}else{d[o]=ur/n;d[o+1]=ug/n;d[o+2]=ub/n;}d[o+3]=a/n;}
    if(cut>0&&cov0>0&&nw*nh>=16){let lo=.5,hi=8;for(let it=0;it<12;it++){const m=(lo+hi)/2;if(coverage(d,cut,m)<cov0)lo=m;else hi=m;}
      const s=(lo+hi)/2;for(let k=3;k<d.length;k+=4)d[k]=Math.min(255,d[k]*s);}
    out.push({data:d,width:nw,height:nh});cur=d;cw=nw;ch=nh;}
  return out;}
function dataTex(data,w,h,o){o=o||{};const t=new T.DataTexture(data,w,h,T.RGBAFormat,T.UnsignedByteType);
  t.wrapS=t.wrapT=o.clamp?T.ClampToEdgeWrapping:T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;
  t.anisotropy=o.aniso||4;t.flipY=false;if(o.srgb)t.encoding=T.sRGBEncoding;
  t.mipmaps=buildMips(data,w,h,o.cut||0);t.generateMipmaps=false;t.needsUpdate=true;return t;}
/* bleed RGB into empty texels (canvas readback is already un-premultiplied) */
function fixEdges(d,w,h,passes){
  let filled=new Uint8Array(w*h);for(let i=0;i<w*h;i++)filled[i]=d[i*4+3]>2?1:0;
  for(let p=0;p<passes;p++){const nf=filled.slice();
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(filled[i])continue;let r=0,g=0,b=0,c=0;
      for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;const j=yy*w+xx;
        if(filled[j]){r+=d[j*4];g+=d[j*4+1];b+=d[j*4+2];c++;}}}
      if(c){d[i*4]=r/c;d[i*4+1]=g/c;d[i*4+2]=b/c;nf[i]=1;}}
    filled=nf;}}
function heightToNormal(hgt,w,h,str){const d=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const xl=(x-1+w)%w,xr=(x+1)%w,yu=(y-1+h)%h,yd=(y+1)%h;
    const dx=(hgt[y*w+xr]-hgt[y*w+xl])*str,dy=(hgt[yd*w+x]-hgt[yu*w+x])*str;const l=Math.hypot(dx,dy,1),k=(y*w+x)*4;
    d[k]=(-dx/l*.5+.5)*255;d[k+1]=(-dy/l*.5+.5)*255;d[k+2]=(1/l*.5+.5)*255;d[k+3]=255;}return d;}
const sRGBbyte=(v)=>Math.round(clamp(v,0,1)*255);

/* ------------------------------------------------------------------ bark / culm textures (tileable, sRGB colour + normal) */
function genPineBark(){const W=512,H=512,rng=RNG("pinebark");
  const vor=(gx,gy,seed)=>{const r=RNG(seed),P=[];for(let j=0;j<gy;j++)for(let i=0;i<gx;i++)P.push({x:(i+.08+.84*r.f())/gx,y:(j+.08+.84*r.f())/gy,a:r.f(),b:r.f(),c:r.f()});
    return(u,v,sy)=>{const ci=Math.floor(u*gx),cj=Math.floor(v*gy);let f1=9,f2=9,bp=P[0];
      for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const I=ci+di,J=cj+dj,iw=((I%gx)+gx)%gx,jw=((J%gy)+gy)%gy,p=P[jw*gx+iw];
        const dx=u-(p.x+(I-iw)/gx),dy=(v-(p.y+(J-jw)/gy))*sy,d=Math.sqrt(dx*dx+dy*dy);if(d<f1){f2=f1;f1=d;bp=p;}else if(d<f2)f2=d;}
      return{e:f2-f1,p:bp};};};
  const V1=vor(7,5,"pbv1"),V2=vor(18,16,"pbv2");
  const fb=makeFbm("pb1",6,6,5),fw=makeFbm("pb2",3,3,3),fl=makeFbm("pb3",2,2,4),fs=makeFbm("pb4",4,48,2);
  const hgt=new Float32Array(W*H),col=new Uint8Array(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=x/W,v=y/H;
    const wu=u+(fw(u,v)-.5)*.07,wv=v+(fw(u+.37,v+.71)-.5)*.07,n=fb(u,v);
    const A=V1(wu,wv,.62),B=V2(wu+.013,wv,.8);
    const plate=smooth(.004,.017,A.e+(n-.5)*.008),minor=smooth(.0015,.006,B.e),flake=smooth(.6,.68,fs(u,v));
    const rim=0;
    hgt[y*W+x]=plate*(.78+.14*minor-.10*flake+.18*(n-.5)+.10*(A.p.c-.5))+rim*plate*.06;
    let g0=.40+.11*(A.p.a-.5)+.12*(n-.5)+.06*rim;g0*=1-.20*(1-minor)*plate-.10*flake;
    let r=g0*1.02,g=g0*.995,b=g0*.965;if(A.p.b>.78){r*=1.06;b*=.93;}
    const deep=1-plate,fr=lerp(.075,.19,smooth(.4,.95,A.p.b)*(1-deep*.7)),fg=lerp(.065,.115,smooth(.4,.95,A.p.b)*(1-deep*.7)),fbb=lerp(.06,.08,A.p.b);
    r=lerp(fr,r,plate);g=lerp(fg,g,plate);b=lerp(fbb,b,plate);
    const li=smooth(.64,.72,fl(u,v))*plate;r=lerp(r,.50,li*.4);g=lerp(g,.54,li*.4);b=lerp(b,.46,li*.4);
    const k=(y*W+x)*4;col[k]=sRGBbyte(r);col[k+1]=sRGBbyte(g);col[k+2]=sRGBbyte(b);col[k+3]=255;}
  return{map:dataTex(col,W,H,{srgb:true,aniso:8}),normalMap:dataTex(heightToNormal(hgt,W,H,4.2),W,H,{aniso:8})};}

function genMapleBark(){const W=512,H=512;const fs=makeFbm("mb1",28,3,3),fb=makeFbm("mb2",5,5,5),fl=makeFbm("mb3",3,3,4),fm=makeFbm("mb4",4,30,2),fd=makeFbm("mb5",2,2,3);
  const hgt=new Float32Array(W*H),col=new Uint8Array(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=x/W,v=y/H,s=fs(u,v),n=fb(u,v),m=fm(u,v);
    const streak=(s-.5);let g0=.40+streak*.16+(n-.5)*.10;
    let r=g0*.97,g=g0*1.0,b=g0*.90;
    const mark=smooth(.64,.70,m)*.6;r=lerp(r,.58,mark*.5);g=lerp(g,.57,mark*.5);b=lerp(b,.50,mark*.5);
    const li=smooth(.60,.70,fl(u,v));r=lerp(r,.62,li*.55);g=lerp(g,.64,li*.55);b=lerp(b,.58,li*.55);
    const mo=smooth(.66,.74,fd(u+.3,v))*(1-li);r=lerp(r,.24,mo*.6);g=lerp(g,.30,mo*.6);b=lerp(b,.16,mo*.6);
    hgt[y*W+x]=streak*.5+(n-.5)*.35+mark*.25+li*.2;
    const k=(y*W+x)*4;col[k]=sRGBbyte(r);col[k+1]=sRGBbyte(g);col[k+2]=sRGBbyte(b);col[k+3]=255;}
  return{map:dataTex(col,W,H,{srgb:true,aniso:8}),normalMap:dataTex(heightToNormal(hgt,W,H,2.5),W,H,{aniso:8})};}

function genCherryBark(){const W=512,H=512,rng=RNG("cherrybark");
  const fb=makeFbm("cb1",5,5,5),fh=makeFbm("cb2",3,26,3),fr=makeFbm("cb3",3,3,4),fv=makeFbm("cb4",22,3,3),fl=makeFbm("cb5",3,3,3);
  const hgt=new Float32Array(W*H),C=new Float32Array(W*H*3);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=x/W,v=y/H,n=fb(u,v),hb=fh(u,v);
    let r=.33+(n-.5)*.08+(hb-.5)*.10,g=.25+(n-.5)*.06+(hb-.5)*.07,b=.24+(n-.5)*.05+(hb-.5)*.06;
    const sheen=smooth(.55,.75,hb);r+=sheen*.06;g+=sheen*.05;b+=sheen*.05;
    const rough=smooth(.58,.68,fr(u,v));const fis=smooth(.45,.7,fv(u,v));
    r=lerp(r,.23+fis*.05,rough*.85);g=lerp(g,.20+fis*.04,rough*.85);b=lerp(b,.19+fis*.04,rough*.85);
    const li=smooth(.66,.73,fl(u,v));r=lerp(r,.55,li*.45);g=lerp(g,.56,li*.45);b=lerp(b,.50,li*.45);
    const i=y*W+x;C[i*3]=r;C[i*3+1]=g;C[i*3+2]=b;hgt[i]=(hb-.5)*.3+rough*((fis-.5)*1.2+(n-.5)*.6);}
  /* horizontal lenticels (the yamazakura trademark) */
  for(let k=0;k<360;k++){const cx=rng.f()*W,cy=rng.f()*H,hl=rng.r(9,30),hh=rng.r(1.6,3.2),dark=rng.f()<.8;
    for(let yy=Math.floor(cy-hh-3);yy<=cy+hh+3;yy++)for(let xx=Math.floor(cx-hl-3);xx<=cx+hl+3;xx++){
      const dx=(xx-cx)/hl,dy=(yy-cy)/hh,d=dx*dx+dy*dy;if(d>2.2)continue;const X=((xx%W)+W)%W,Y=((yy%H)+H)%H,i=Y*W+X;
      if(d<1){const t=dark?.42:1.35;C[i*3]*=t;C[i*3+1]*=t*.95;C[i*3+2]*=t*.95;hgt[i]+=.25*(1-d);}
      else{const rim=(1-(d-1)/1.2)*.25;C[i*3]+=rim*.12;C[i*3+1]+=rim*.10;C[i*3+2]+=rim*.09;hgt[i]+=rim*.6;}}}
  const col=new Uint8Array(W*H*4);for(let i=0;i<W*H;i++){col[i*4]=sRGBbyte(C[i*3]);col[i*4+1]=sRGBbyte(C[i*3+1]);col[i*4+2]=sRGBbyte(C[i*3+2]);col[i*4+3]=255;}
  return{map:dataTex(col,W,H,{srgb:true,aniso:8}),normalMap:dataTex(heightToNormal(hgt,W,H,3.0),W,H,{aniso:8})};}

/* bamboo culm: u around the culm, v = one internode (node at v=0, next node at v=1) */
function genCulm(){const W=256,H=512;const ff=makeFbm("cu1",40,2,3),fn=makeFbm("cu2",4,4,4),fp=makeFbm("cu3",12,6,3),fs=makeFbm("cu4",6,6,3);
  const hgt=new Float32Array(W*H),col=new Uint8Array(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=x/W,v=y/H,fib=ff(u,v),n=fn(u,v);
    let r=.31+(fib-.5)*.05+(n-.5)*.05,g=.44+(fib-.5)*.07+(n-.5)*.06,b=.20+(fib-.5)*.03;
    let h=(fib-.5)*.12;
    const pow=.42*smooth(.80,.94,v)*(1-smooth(.972,.988,v))*(.6+.8*fp(u,v));     // white bloom below the node
    r=lerp(r,.70,pow);g=lerp(g,.75,pow);b=lerp(b,.66,pow);
    const scar=1-smooth(.004,.012,v);                                           // sheath scar ring
    r=lerp(r,.60,scar*.8);g=lerp(g,.56,scar*.8);b=lerp(b,.38,scar*.8);h-=scar*.2;
    const ridge=smooth(.010,.020,v)*(1-smooth(.026,.040,v));                    // node ridge
    r=lerp(r,.27,ridge*.7);g=lerp(g,.38,ridge*.7);b=lerp(b,.16,ridge*.7);h+=ridge*.9;
    const low=smooth(.982,.998,v);r=lerp(r,.24,low*.6);g=lerp(g,.33,low*.6);b=lerp(b,.15,low*.6);h+=low*.3;
    const sp=smooth(.74,.80,fs(u,v));r=lerp(r,.30,sp*.5);g=lerp(g,.30,sp*.5);b=lerp(b,.20,sp*.5);
    hgt[y*W+x]=h;const k=(y*W+x)*4;col[k]=sRGBbyte(r);col[k+1]=sRGBbyte(g);col[k+2]=sRGBbyte(b);col[k+3]=255;}
  return{map:dataTex(col,W,H,{srgb:true,aniso:8}),normalMap:dataTex(heightToNormal(hgt,W,H,4),W,H,{aniso:8})};}

/* ------------------------------------------------------------------ foliage atlases
   Data atlases (linear) painted in ONE canvas (single readback): R = shading detail (veins, folds), G = within-leaf gradient
   (0 base .. 1 tips), B = per-leaf random id (>=.1) or 0 for woody parts (petiole/twig), A = coverage. Colour comes from season palettes.
   Gradients only vary G; detail strokes touch only R (multiply / screen inside a clip). */
function newLayers(W,H){const c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d",{willReadFrequently:true});
  x.clearRect(0,0,W,H);x.lineCap="round";x.lineJoin="round";return{W,H,x};}
const RGB=(r,g,b)=>"rgb("+Math.round(clamp(r,0,1)*255)+","+Math.round(clamp(g,0,1)*255)+","+Math.round(clamp(b,0,1)*255)+")";
function chanStyle(x,r,g,b){if(typeof g==="number")return RGB(r,g,b);let gr;
  if(g.r1!=null)gr=x.createRadialGradient(g.cx,g.cy,g.r0||0,g.cx,g.cy,g.r1);else gr=x.createLinearGradient(g.x0,g.y0,g.x1,g.y1);
  for(const s of g.stops)gr.addColorStop(s[0],RGB(r,s[1],b));return gr;}
function fill4(L,path,r,g,b){const x=L.x;x.globalCompositeOperation="source-over";x.fillStyle=chanStyle(x,r,g,b);x.fill(path);}
function stroke4(L,path,w,r,g,b){const x=L.x;x.globalCompositeOperation="source-over";x.lineWidth=w;x.strokeStyle=chanStyle(x,r,g,b);x.stroke(path);}
function dark(L,a){L.x.globalCompositeOperation="multiply";return RGB(1-a,1,1);}
function light(L,a){L.x.globalCompositeOperation="screen";return RGB(a,0,0);}
function layersToTex(L,cut){const d=L.x.getImageData(0,0,L.W,L.H).data,out=new Uint8Array(d.length);out.set(d);fixEdges(out,L.W,L.H,2);
  return dataTex(out,L.W,L.H,{clamp:true,cut:cut||.4,aniso:4});}
function polyPath(pts,close){const p=new Path2D();p.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)p.lineTo(pts[i][0],pts[i][1]);if(close!==false)p.closePath();return p;}
/* tapered stroke drawn as a polygon (twigs, needles) */
function taperPath(pts,w0,w1){const n=pts.length,L=[],R=[];for(let i=0;i<n;i++){const a=pts[Math.max(0,i-1)],b=pts[Math.min(n-1,i+1)];
  let dx=b[0]-a[0],dy=b[1]-a[1];const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;const w=lerp(w0,w1,i/(n-1))/2;
  L.push([pts[i][0]-dy*w,pts[i][1]+dx*w]);R.push([pts[i][0]+dy*w,pts[i][1]-dx*w]);}
  return polyPath(L.concat(R.reverse()));}
function quadPts(x0,y0,cx,cy,x1,y1,n){const o=[];for(let i=0;i<=n;i++){const t=i/n,a=(1-t)*(1-t),b=2*(1-t)*t,c=t*t;o.push([a*x0+b*cx+c*x1,a*y0+b*cy+c*y1]);}return o;}
function speckle(L,rng,n,fn){const x=L.x;for(let k=0;k<n;k++){const p=fn();x.fillStyle=rng.f()<.5?dark(L,.10):light(L,.08);x.fillRect(p[0],p[1],rng.r(1,2.5),rng.r(1,2.5));}}

/* --- Acer palmatum leaf: 7 deeply cut lanceolate lobes, serrate, palmate veins */
function mapleLeafPath(cx,cy,R,ang,rng,wid){const A7=[-2.05,-1.36,-.68,0,.68,1.36,2.05],L7=[.50,.80,.95,1,.95,.80,.50];
  const lob=A7.map((a,i)=>({a:ang+a+rng.r(-.05,.05),L:R*L7[i]*rng.r(.93,1.05)}));const rs=R*.27,back=ang+Math.PI,pts=[];
  pts.push([cx+Math.cos(back)*R*.06,cy+Math.sin(back)*R*.06]);
  for(let i=0;i<7;i++){const a=lob[i].a,L=lob[i].L,ux=Math.cos(a),uy=Math.sin(a),nx=-uy,ny=ux,W=L*(wid||.16)*(i===0||i===6?.85:1);
    const g1=i>0?a-lob[i-1].a:.9,g2=i<6?lob[i+1].a-a:.9,N=36;
    const edge=(g,side)=>{const arr=[];const tg=Math.tan(g/2);for(let k=0;k<=N;k++){const s=k/N,ax=rs+(L-rs)*s,w0=rs*tg*.92;
      let w=s<.38?lerp(w0,W,Math.sin(Math.PI/2*s/.38)):W*Math.pow(Math.cos(Math.PI/2*(s-.38)/.62),1.1);
      if(k%2===1&&s>.16&&s<.95)w+=W*(k%4===1?.10:.06)*(1-s*.4);w=Math.min(w,ax*tg*.97);
      arr.push([cx+ux*ax+nx*w*side,cy+uy*ax+ny*w*side]);}return arr;};
    const e1=edge(g1,-1),e2=edge(g2,1);for(const q of e1)pts.push(q);for(let k=e2.length-2;k>=0;k--)pts.push(e2[k]);
    if(i<6){const am=(a+lob[i+1].a)/2;pts.push([cx+Math.cos(am)*rs*.99,cy+Math.sin(am)*rs*.99]);}}
  return{path:polyPath(pts),lob,rs};}
function drawMapleLeaf(L,cx,cy,R,ang,rng,id,shade){const lf=mapleLeafPath(cx,cy,R,ang,rng);const base=shade==null?rng.r(.70,.80):shade;
  fill4(L,lf.path,base,{cx,cy,r0:R*.05,r1:R*1.02,stops:[[0,0],[.35,.12],[.75,.65],[1,1]]},id);
  const x=L.x;x.save();x.clip(lf.path);
  for(const l of lf.lob){const tx=cx+Math.cos(l.a)*l.L,ty=cy+Math.sin(l.a)*l.L,nx=-Math.sin(l.a),ny=Math.cos(l.a);
    x.fillStyle=dark(L,.12);x.beginPath();x.moveTo(cx,cy);x.lineTo(tx,ty);x.lineTo(cx+Math.cos(l.a)*l.L*.5+nx*l.L*.25,cy+Math.sin(l.a)*l.L*.5+ny*l.L*.25);x.closePath();x.fill();
    x.strokeStyle=light(L,.30);x.lineWidth=Math.max(1,R*.022);x.beginPath();x.moveTo(cx,cy);x.lineTo(tx,ty);x.stroke();
    x.strokeStyle=light(L,.12);x.lineWidth=Math.max(.7,R*.010);
    for(let s=.38;s<.9;s+=.12){const px=cx+Math.cos(l.a)*l.L*s,py=cy+Math.sin(l.a)*l.L*s;for(const sd of[-1,1]){x.beginPath();x.moveTo(px,py);
      x.lineTo(px+(Math.cos(l.a)*.6+nx*sd*.8)*l.L*.10,py+(Math.sin(l.a)*.6+ny*sd*.8)*l.L*.10);x.stroke();}}}
  speckle(L,rng,R*1.2,()=>{const a=rng.r(0,TAU),rr=rng.r(0,R*.9);return[cx+Math.cos(a)*rr,cy+Math.sin(a)*rr];});
  x.restore();return lf;}
/* spray seen from above: a twig with decussate pairs of long-petioled leaves held flat, filling most of the card */
function drawMapleSpray(L,ox,oy,S,rng,variant){const bx=ox+S*.5+rng.r(-.02,.02)*S,by=oy+S*.995;
  const topY=oy+S*(variant===2?.40:.46),bend=rng.r(-.05,.05)*S,tx=bx+rng.r(-.03,.03)*S;
  const twig=quadPts(bx,by,bx+bend,(by+topY)/2,tx,topY,12),leaves=[];
  const add=(t,ang,lp,R,sq)=>{const i=Math.round(t*12),p=twig[i],q=twig[Math.min(12,i+1)],da=Math.atan2(q[1]-p[1],q[0]-p[0]);
    for(const sd of[-1,1]){const a=da+sd*ang*rng.r(.9,1.1);leaves.push({p,a,lp:S*lp*rng.r(.88,1.12),R:S*R*rng.r(.9,1.08),la:a+sd*rng.r(-.25,.05),sq:sq||1});}};
  if(variant===0){add(.22,1.55,.13,.15);add(.58,.95,.11,.145);add(1,.42,.06,.135);add(.58,2.3,.05,.12,.75);}
  else if(variant===1){add(.30,1.35,.14,.16);add(1,.55,.07,.15);add(.30,2.45,.05,.13,.7);}
  else{add(.12,1.65,.12,.14);add(.42,1.15,.12,.14);add(.72,.80,.10,.135);add(1,.35,.06,.125);add(.42,2.5,.05,.115,.7);}
  fill4(L,taperPath(twig,S*.016,S*.008),.42,0,0);
  leaves.sort((a,b)=>b.sq-a.sq);
  for(const l of leaves){const ex=l.p[0]+Math.cos(l.a)*l.lp,ey=l.p[1]+Math.sin(l.a)*l.lp;
    stroke4(L,polyPath(quadPts(l.p[0],l.p[1],(l.p[0]+ex)/2+rng.r(-3,3),(l.p[1]+ey)/2-3,ex,ey,6),false),Math.max(1.5,S*.005),.55,0,0);}
  for(const l of leaves){const ex=l.p[0]+Math.cos(l.a)*l.lp,ey=l.p[1]+Math.sin(l.a)*l.lp;
    if(l.sq<1){const x=L.x;x.save();x.translate(ex,ey);x.rotate(l.la);x.scale(1,l.sq);x.rotate(-l.la);x.translate(-ex,-ey);drawMapleLeaf(L,ex,ey,l.R,l.la,rng,rng.r(.15,1),rng.r(.62,.72));x.restore();}
    else drawMapleLeaf(L,ex+Math.cos(l.la)*l.R*.05,ey+Math.sin(l.la)*l.R*.05,l.R,l.la,rng,rng.r(.15,1));}}
function genMapleAtlas(){const S=1024,C=512,L=newLayers(S,S),rng=RNG("mapleatlas");
  drawMapleSpray(L,0,0,C,rng,0);drawMapleSpray(L,C,0,C,rng,1);drawMapleSpray(L,0,C,C,rng,2);
  const cx=C+C*.5,cy=C+C*.47;stroke4(L,polyPath([[cx,cy+C*.05],[cx+4,C+C*.985]],false),5,.5,0,0);drawMapleLeaf(L,cx,cy,C*.37,-Math.PI/2,rng,.6,.78);
  return layersToTex(L,.4);}

/* --- Prunus jamasakura leaf: ovate-elliptic, acuminate, finely serrate, pinnate veins */
function cherryLeafPath(bx,by,len,ang,rng,wr){const W=len*(wr||rng.r(.20,.235)),N=40,ux=Math.cos(ang),uy=Math.sin(ang),nx=-uy,ny=ux,cv=rng.r(-.05,.05);
  const edge=(side)=>{const a=[];for(let k=0;k<=N;k++){const s=k/N;let w=W*Math.pow(Math.sin(Math.PI*Math.pow(s,.8)),.8);
      if(s>.78)w*=Math.pow((1-s)/.22,.45);if(k%2===1&&s>.06&&s<.94)w+=W*.045;const ax=s*len,off=cv*len*Math.sin(Math.PI*s);
      a.push([bx+ux*ax+nx*(w*side+off),by+uy*ax+ny*(w*side+off)]);}return a;};
  const e1=edge(-1),e2=edge(1);return{path:polyPath(e1.concat(e2.reverse())),W,cv};}
function drawCherryLeaf(L,bx,by,len,ang,rng,id){const lf=cherryLeafPath(bx,by,len,ang,rng);const ux=Math.cos(ang),uy=Math.sin(ang),nx=-uy,ny=ux;
  fill4(L,lf.path,rng.r(.70,.80),{x0:bx,y0:by,x1:bx+ux*len,y1:by+uy*len,stops:[[0,0],[.5,.25],[1,1]]},id);
  const x=L.x;x.save();x.clip(lf.path);x.fillStyle=dark(L,.12);x.beginPath();x.moveTo(bx,by);
  for(let k=0;k<=12;k++){const s=k/12,o=lf.cv*len*Math.sin(Math.PI*s);x.lineTo(bx+ux*s*len+nx*o,by+uy*s*len+ny*o);}x.lineTo(bx+nx*lf.W*2,by+ny*lf.W*2);x.closePath();x.fill();
  x.strokeStyle=light(L,.30);x.lineWidth=Math.max(1,len*.012);x.beginPath();
  for(let k=0;k<=12;k++){const s=k/12,o=lf.cv*len*Math.sin(Math.PI*s);const px=bx+ux*s*len+nx*o,py=by+uy*s*len+ny*o;if(k)x.lineTo(px,py);else x.moveTo(px,py);}x.stroke();
  x.strokeStyle=light(L,.14);x.lineWidth=Math.max(.7,len*.006);
  for(let s=.12;s<.85;s+=.085){const o=lf.cv*len*Math.sin(Math.PI*s),px=bx+ux*s*len+nx*o,py=by+uy*s*len+ny*o;for(const sd of[-1,1]){x.beginPath();x.moveTo(px,py);
    x.quadraticCurveTo(px+nx*sd*lf.W*.6+ux*len*.05,py+ny*sd*lf.W*.6+uy*len*.05,px+nx*sd*lf.W*.95+ux*len*.16,py+ny*sd*lf.W*.95+uy*len*.16);x.stroke();}}
  speckle(L,rng,len*.8,()=>{const s=rng.f(),w=rng.r(-1,1)*lf.W*.8;return[bx+ux*s*len+nx*w,by+uy*s*len+ny*w];});
  x.restore();}
function drawCherrySpray(L,ox,oy,S,rng,n){const bx=ox+S*.5,by=oy+S*.96;const sp=[[bx,by+S*.035],[bx,by]];
  fill4(L,taperPath(sp,S*.022,S*.016),.42,0,0);
  const angs=[];for(let i=0;i<n;i++)angs.push(-Math.PI/2+lerp(-1.15,1.15,n===1?.5:i/(n-1))+rng.r(-.12,.12));
  angs.sort((a,b)=>Math.abs(b+Math.PI/2)-Math.abs(a+Math.PI/2));
  for(const a of angs){const pl=S*rng.r(.05,.08),px=bx+Math.cos(a)*pl,py=by+Math.sin(a)*pl;
    stroke4(L,polyPath([[bx,by],[px,py]],false),Math.max(1.6,S*.006),.5,0,0);
    const len=S*rng.r(.40,.47)*(1-Math.abs(a+Math.PI/2)*.12);drawCherryLeaf(L,px,py,len,a+rng.r(-.06,.06),rng,rng.r(.15,1));}}
function genCherryLeafAtlas(){const S=1024,C=512,L=newLayers(S,S),rng=RNG("cherryatlas");
  drawCherrySpray(L,0,0,C,rng,4);drawCherrySpray(L,C,0,C,rng,3);drawCherrySpray(L,0,C,C,rng,5);
  stroke4(L,polyPath([[C*1.5,C*1.97],[C*1.5,C*1.86]],false),5,.5,0,0);drawCherryLeaf(L,C*1.5,C*1.86,C*.8,-Math.PI/2,rng,.6);
  return layersToTex(L,.4);}

/* --- Japanese black pine needle tufts: cell 0 = side fan (base at bottom-centre), cell 1 = top star (centre) */
function drawNeedle(L,pts,w0,id,r){fill4(L,taperPath(pts,w0,w0*.28),r,{x0:pts[0][0],y0:pts[0][1],x1:pts[pts.length-1][0],y1:pts[pts.length-1][1],stops:[[0,0],[1,1]]},id);}
function genPineAtlas(){const W=1024,H=512,C=512,L=newLayers(W,H),rng=RNG("pineatlas");
  const bx=C*.5,by=C*.985;const nd=[];
  for(let i=0;i<150;i++){const a=rng.g()*.42*(rng.f()<.25?1.5:1),len=C*rng.r(.50,.95)*(1-Math.abs(a)*.18),sx=bx+rng.r(-6,6),sy=by-rng.r(0,C*.20)*Math.pow(rng.f(),1.5);
    const dx=Math.sin(a),dy=-Math.cos(a),bend=rng.r(-.08,.08)*len;nd.push({sx,sy,ex:sx+dx*len,ey:sy+dy*len,cx:sx+dx*len*.5-dy*bend,cy:sy+dy*len*.5+dx*bend,dep:rng.f()});}
  nd.sort((a,b)=>a.dep-b.dep);
  fill4(L,taperPath([[bx,by],[bx,by-C*.25]],C*.03,C*.018),.40,0,0);
  for(const n of nd)drawNeedle(L,quadPts(n.sx,n.sy,n.cx,n.cy,n.ex,n.ey,8),rng.r(2.4,3.6),rng.r(.15,1),.55+.40*n.dep);
  const bud=new Path2D();bud.ellipse(bx,by-C*.26,C*.016,C*.035,0,0,TAU);fill4(L,bud,.95,0,0);
  const sx0=C+C*.5,sy0=C*.5,st=[];
  for(let i=0;i<190;i++){const a=rng.r(0,TAU),r0=rng.r(4,C*.06),len=C*rng.r(.24,.47),bend=rng.r(-.10,.10)*len;
    const ux=Math.cos(a),uy=Math.sin(a);const s0x=sx0+ux*r0,s0y=sy0+uy*r0;st.push({s0x,s0y,ex:s0x+ux*len,ey:s0y+uy*len,cx:s0x+ux*len*.5-uy*bend,cy:s0y+uy*len*.5+ux*bend,dep:rng.f()});}
  st.sort((a,b)=>a.dep-b.dep);
  for(const n of st)drawNeedle(L,quadPts(n.s0x,n.s0y,n.cx,n.cy,n.ex,n.ey,8),rng.r(2.4,3.4),rng.r(.15,1),.5+.45*n.dep);
  const sb=new Path2D();sb.arc(sx0,sy0,C*.03,0,TAU);fill4(L,sb,.9,0,0);
  return layersToTex(L,.35);}

/* --- madake leaf "hands": lanceolate leaves fanning from a twig tip */
function bambooLeafPath(bx,by,len,ang,curl,rng){const W=len*rng.r(.075,.09),N=30,pts1=[],pts2=[];
  for(let k=0;k<=N;k++){const s=k/N,a=ang+curl*s*s,ax=Math.cos(a),ay=Math.sin(a);
    let w=W*(s<.08?Math.sqrt(s/.08)*.55:s<.28?lerp(.55,1,(s-.08)/.2):Math.pow((1-s)/.72,.75));
    const px=bx+Math.cos(ang)*len*s+Math.cos(ang+Math.PI/2)*curl*len*s*s*.5,py=by+Math.sin(ang)*len*s+Math.sin(ang+Math.PI/2)*curl*len*s*s*.5;
    pts1.push([px-ay*w,py+ax*w]);pts2.push([px+ay*w,py-ax*w]);}
  return{path:polyPath(pts1.concat(pts2.slice().reverse())),mid:pts1.map((p,i)=>[(p[0]+pts2[i][0])/2,(p[1]+pts2[i][1])/2])};}
function drawBambooLeaf(L,px,py,len,a,curl,rng){const lf=bambooLeafPath(px,py,len,a,curl,rng);
  fill4(L,lf.path,rng.r(.72,.82),{x0:px,y0:py,x1:px+Math.cos(a)*len,y1:py+Math.sin(a)*len,stops:[[0,0],[.6,.3],[1,1]]},rng.r(.15,1));
  const x=L.x;x.save();x.clip(lf.path);x.strokeStyle=light(L,.28);x.lineWidth=1.5;x.beginPath();lf.mid.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.stroke();
  x.strokeStyle=dark(L,.09);x.lineWidth=.9;for(const off of[-3.5,3.5]){x.beginPath();lf.mid.forEach((p,i)=>i?x.lineTo(p[0]+off*(1-i/30),p[1]):x.moveTo(p[0]+off,p[1]));x.stroke();}
  x.fillStyle=dark(L,.10);x.beginPath();lf.mid.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.lineTo(px+Math.cos(a+1.57)*30,py+Math.sin(a+1.57)*30);x.closePath();x.fill();x.restore();}
/* leaf "hand": leaves fanning from the tip of a twiglet; dir = central direction (canvas angle), spread = half fan angle */
function bambooHand(L,tx,ty,dir,n,spread,len,rng){const lv=[];for(let i=0;i<n;i++){const t=n===1?.5:i/(n-1);lv.push({a:dir+lerp(-spread,spread,t)+rng.r(-.12,.12)});}
  lv.sort((a,b)=>Math.abs(b.a-dir)-Math.abs(a.a-dir));
  for(const l of lv){const ll=len*rng.r(.85,1.08)*(1-Math.abs(l.a-dir)*.12),curl=(l.a-dir)*.45+rng.r(-.1,.1);drawBambooLeaf(L,tx,ty,ll,l.a,curl,rng);}}
function genBambooAtlas(){const W=1024,H=512,C=512,L=newLayers(W,H),rng=RNG("bambooatlas");
  /* cell 0: twig with three hands */
  const tw=quadPts(C*.5,C*.99,C*.45,C*.66,C*.56,C*.40,12);fill4(L,taperPath(tw,C*.012,C*.006),.45,0,0);
  const at=(t)=>tw[Math.round(t*12)];
  let p=at(.40);bambooHand(L,p[0],p[1],-Math.PI/2-1.15,3,.42,C*.38,rng);
  p=at(.68);bambooHand(L,p[0],p[1],-Math.PI/2+1.05,3,.42,C*.38,rng);
  p=at(1);bambooHand(L,p[0],p[1],-Math.PI/2+.1,4,.85,C*.30,rng);
  /* cell 1: single hand of five */
  const t2=quadPts(C*1.5,C*.99,C*1.48,C*.8,C*1.5,C*.58,8);fill4(L,taperPath(t2,C*.012,C*.007),.45,0,0);
  bambooHand(L,C*1.5,C*.58,-Math.PI/2,5,.95,C*.48,rng);
  return layersToTex(L,.4);}
/* --- hagi (Lespedeza): trifoliate leaves; cell 0 = arching leafy twig, cell 1 = single trifoliate leaf */
function drawTrifoliate(L,x0,y0,ang,sz,rng,id){const pl=sz*.45,px=x0+Math.cos(ang)*pl,py=y0+Math.sin(ang)*pl;
  stroke4(L,polyPath([[x0,y0],[px,py]],false),Math.max(1.4,sz*.03),.5,0,0);
  const lt=[[0,1.0,.48],[-.95,.78,.46],[.95,.78,.46]];
  for(const q of lt){const a=ang+q[0]+rng.r(-.1,.1),len=sz*q[1]*rng.r(.9,1.08),w=len*q[2]*.5,sx=px+Math.cos(a)*(q[0]?0:sz*.08),sy=py+Math.sin(a)*(q[0]?0:sz*.08);
    const p=new Path2D();const mx=sx+Math.cos(a)*len*.5,my=sy+Math.sin(a)*len*.5;p.ellipse(mx,my,len*.5,w,a,0,TAU);
    fill4(L,p,rng.r(.70,.80),{cx:sx,cy:sy,r0:0,r1:len,stops:[[0,0],[.6,.3],[1,1]]},clamp(id*rng.r(.92,1.05),.12,1));
    const x=L.x;x.save();x.clip(p);x.strokeStyle=light(L,.25);x.lineWidth=1.3;x.beginPath();x.moveTo(sx,sy);x.lineTo(sx+Math.cos(a)*len,sy+Math.sin(a)*len);x.stroke();
    x.fillStyle=dark(L,.1);x.beginPath();x.moveTo(sx,sy);x.lineTo(sx+Math.cos(a)*len,sy+Math.sin(a)*len);x.lineTo(mx+Math.cos(a+1.57)*w,my+Math.sin(a+1.57)*w);x.closePath();x.fill();x.restore();}}
function genHagiAtlas(){const W=1024,H=512,C=512,L=newLayers(W,H),rng=RNG("hagiatlas");
  const tw=quadPts(C*.5,C*.99,C*.42,C*.5,C*.62,C*.08,14);fill4(L,taperPath(tw,C*.012,C*.005),.45,0,0);
  for(let i=2;i<=14;i+=2){const p=tw[i],q=tw[Math.min(14,i+1)],da=Math.atan2(q[1]-p[1],q[0]-p[0]),sd=(i/2)%2?1:-1;
    drawTrifoliate(L,p[0],p[1],da+sd*rng.r(.7,1.0),C*rng.r(.15,.19)*(1-i/40),rng,rng.r(.15,1));}
  drawTrifoliate(L,C*1.5,C*.97,-Math.PI/2,C*.42,rng,.6);
  return layersToTex(L,.4);}

/* --- colour atlas (sRGB, transparent canvas): cherry blossom clusters, hagi flower racemes, petal, azalea, snow flake */
function newColorLayers(W,H){const c=document.createElement("canvas");c.width=W;c.height=H;const C=c.getContext("2d",{willReadFrequently:true});
  C.lineCap="round";C.lineJoin="round";return{W,H,C};}
function colorToTex(L,cut){const d=L.C.getImageData(0,0,L.W,L.H).data,out=new Uint8Array(d.length);out.set(d);fixEdges(out,L.W,L.H,2);
  return dataTex(out,L.W,L.H,{clamp:true,srgb:true,cut:cut||.4});}
function cfill(L,path,style){L.C.fillStyle=style;L.C.fill(path);}
function cstroke(L,path,w,style){L.C.lineWidth=w;L.C.strokeStyle=style;L.C.stroke(path);}
function petalPath(R,rng){const p=new Path2D(),w=R*rng.r(.36,.42),nt=R*rng.r(.06,.11);
  p.moveTo(0,0);p.bezierCurveTo(R*.25,-w*.35,R*.55,-w*1.15,R*.92,-w*.75);p.quadraticCurveTo(R*1.02,-w*.3,R-nt,0);
  p.quadraticCurveTo(R*1.02,w*.3,R*.92,w*.75);p.bezierCurveTo(R*.55,w*1.15,R*.25,w*.35,0,0);p.closePath();return p;}
function drawCherryFlower(L,cx,cy,R,sq,rot,rng){const C=L.C;C.save();C.translate(cx,cy);C.rotate(rot);C.scale(1,sq);
  const a0=rng.r(0,TAU);
  for(let k=0;k<5;k++){const a=a0+k*TAU/5+rng.r(-.07,.07);C.save();C.rotate(a);
    const p=petalPath(R*rng.r(.92,1.04),rng);const gr=C.createRadialGradient(0,0,R*.04,0,0,R);
    gr.addColorStop(0,"#e9a3b6");gr.addColorStop(.28,"#f6d7e0");gr.addColorStop(.7,"#fdf2f5");gr.addColorStop(1,"#fffbfc");cfill(L,p,gr);
    C.save();C.clip(p);C.strokeStyle="rgba(214,170,184,0.55)";C.lineWidth=1.4;C.stroke(p);
    C.strokeStyle="rgba(232,196,206,0.45)";C.lineWidth=.8;for(let v=-2;v<=2;v++){C.beginPath();C.moveTo(R*.08,0);C.quadraticCurveTo(R*.5,v*R*.07,R*.86,v*R*.13);C.stroke();}
    C.restore();C.restore();}
  const cen=new Path2D();cen.arc(0,0,R*.15,0,TAU);cfill(L,cen,"#b9c25a");
  for(let k=0;k<(R>40?26:16);k++){const a=rng.r(0,TAU),l=R*rng.r(.30,.52),ex=Math.cos(a)*l,ey=Math.sin(a)*l;
    C.strokeStyle="rgba(250,246,240,0.95)";C.lineWidth=1.1;C.beginPath();C.moveTo(Math.cos(a)*R*.1,Math.sin(a)*R*.1);C.lineTo(ex,ey);C.stroke();
    const an=new Path2D();an.arc(ex,ey,R*.035+.8,0,TAU);cfill(L,an,k%3?"#e2b53c":"#c99a2c");}
  const sty=new Path2D();sty.arc(0,0,R*.05,0,TAU);cfill(L,sty,"#9cad46");C.restore();}
function drawBud(L,x0,y0,ang,len){const C=L.C;const p=new Path2D();const mx=x0+Math.cos(ang)*len*.5,my=y0+Math.sin(ang)*len*.5;p.ellipse(mx,my,len*.5,len*.27,ang,0,TAU);
  const gr=C.createLinearGradient(x0,y0,x0+Math.cos(ang)*len,y0+Math.sin(ang)*len);gr.addColorStop(0,"#d97f98");gr.addColorStop(1,"#f6cad6");cfill(L,p,gr);
  const s=new Path2D();s.ellipse(x0+Math.cos(ang)*len*.12,y0+Math.sin(ang)*len*.12,len*.16,len*.2,ang,0,TAU);cfill(L,s,"#7a3b2a");}
function drawYoungLeaf(L,x0,y0,len,ang,rng,col){const lf=cherryLeafPath(x0,y0,len,ang,rng,.17);const C=L.C;
  const gr=C.createLinearGradient(x0,y0,x0+Math.cos(ang)*len,y0+Math.sin(ang)*len);gr.addColorStop(0,col[0]);gr.addColorStop(1,col[1]);cfill(L,lf.path,gr);
  C.save();C.clip(lf.path);C.strokeStyle="rgba(255,220,190,0.35)";C.lineWidth=1.2;C.beginPath();C.moveTo(x0,y0);C.lineTo(x0+Math.cos(ang)*len*.9,y0+Math.sin(ang)*len*.9);C.stroke();C.restore();}
/* flowering twig section: 2-3 spurs, each a corymb of 3-4 flowers (+bud) on long pedicels; variant 1 adds bronze young leaves */
function drawCherryCluster(L,ox,oy,S,rng,variant){const x0=ox+S*.5,y0=oy+S*.99,x2=ox+S*(.5+rng.r(-.12,.12)),y2=oy+S*.30;
  const tw=quadPts(x0,y0,ox+S*(.5+rng.r(-.12,.12)),oy+S*.62,x2,y2,12);
  const spurs=(variant?[.38,.80]:[.25,.58,.92]).map((t)=>{const i=Math.round(t*12),p=tw[i],q=tw[Math.min(12,i+1)],da=Math.atan2(q[1]-p[1],q[0]-p[0]),sd=rng.sg();
    const a=da+sd*rng.r(.5,1.0),l=S*rng.r(.03,.05);return{x:p[0]+Math.cos(a)*l,y:p[1]+Math.sin(a)*l,px:p[0],py:p[1],out:da+sd*rng.r(.6,1.2)};});
  cfill(L,taperPath(tw,S*.022,S*.011),"#4e3a2c");
  for(const sp of spurs)cfill(L,taperPath([[sp.px,sp.py],[sp.x,sp.y]],S*.016,S*.012),"#5a4232");
  if(variant)for(const sp of spurs){drawYoungLeaf(L,sp.x,sp.y,S*.20,sp.out+1.0,rng,["#6e3222","#a35a38"]);drawYoungLeaf(L,sp.x,sp.y,S*.17,sp.out-1.1,rng,["#74361f","#a8603c"]);}
  const fl=[];
  for(const sp of spurs){const n=rng.i(3,4);for(let i=0;i<n;i++){const a=sp.out+lerp(-1.25,1.25,n===1?.5:i/(n-1))+rng.r(-.18,.18),l=S*rng.r(.09,.15);
    fl.push({sp,a,l,R:S*rng.r(.060,.072),sq:rng.r(.5,1),rot:rng.r(-.6,.6)});}
    if(rng.f()<.8)fl.push({sp,a:sp.out+rng.r(-.4,.4),l:S*rng.r(.06,.09),bud:true,sq:0});}
  fl.sort((a,b)=>a.sq-b.sq);
  for(const f of fl){const ex=f.sp.x+Math.cos(f.a)*f.l,ey=f.sp.y+Math.sin(f.a)*f.l;
    cstroke(L,polyPath(quadPts(f.sp.x,f.sp.y,(f.sp.x+ex)/2+rng.r(-4,4),(f.sp.y+ey)/2+5,ex,ey,8),false),1.7,"#6f7a3a");
    if(f.bud){drawBud(L,ex,ey,f.a,S*.05);continue;}
    const cal=new Path2D();cal.ellipse(ex-Math.cos(f.a)*f.R*.15,ey-Math.sin(f.a)*f.R*.15,f.R*.16,f.R*.11,f.a,0,TAU);cfill(L,cal,"#7e3e2c");
    drawCherryFlower(L,ex,ey,f.R,f.sq,f.rot,rng);}}
function drawPeaFlower(L,x,y,s,ang,rng,bud){const C=L.C;C.save();C.translate(x,y);C.rotate(ang);
  if(bud){const p=new Path2D();p.ellipse(0,0,s*.55,s*.32,0,0,TAU);cfill(L,p,rng.f()<.5?"#8e2a6e":"#a43a80");}
  else{const k=new Path2D();k.ellipse(s*.15,s*.18,s*.42,s*.22,.3,0,TAU);cfill(L,k,"#d986bd");
    const st=new Path2D();st.ellipse(-s*.05,-s*.12,s*.48,s*.40,-.2,0,TAU);const gr=C.createRadialGradient(-s*.25,0,0,-s*.1,-s*.1,s*.55);
    gr.addColorStop(0,"#6b1450");gr.addColorStop(.35,"#b52f86");gr.addColorStop(1,"#d659a6");cfill(L,st,gr);
    C.save();C.clip(st);C.strokeStyle="rgba(255,235,250,0.55)";C.lineWidth=1;C.beginPath();C.moveTo(-s*.32,-s*.05);C.lineTo(s*.12,-s*.3);C.stroke();C.restore();
    const cal=new Path2D();cal.ellipse(-s*.45,s*.05,s*.14,s*.10,0,0,TAU);cfill(L,cal,"#7d8a46");}
  C.restore();}
function drawHagiRaceme(L,ox,oy,S,rng){
  for(let r=0;r<3;r++){const x0=ox+S*(.5+(r-1)*.09),y0=oy+S*.99,x1=ox+S*(.5+(r-1)*.32+rng.r(-.04,.04)),y1=oy+S*rng.r(.10,.22);
    const ax=quadPts(x0,y0,ox+S*(.5+(r-1)*.05),oy+S*.45,x1,y1,24);cstroke(L,polyPath(ax,false),2,"#5d6a32");
    for(let i=4;i<=24;i++){if(i%2)continue;const p=ax[i],q=ax[Math.min(24,i+1)],da=Math.atan2(q[1]-p[1],q[0]-p[0]),sd=(i/2)%2?1:-1,t=i/24;
      const pl=S*.035,fx=p[0]+Math.cos(da+sd*1.1)*pl,fy=p[1]+Math.sin(da+sd*1.1)*pl;cstroke(L,polyPath([[p[0],p[1]],[fx,fy]],false),1.3,"#6d7038");
      drawPeaFlower(L,fx,fy,S*lerp(.075,.04,t),da+sd*1.3+Math.PI,rng,t>.8);}}}
function drawAzalea(L,cx,cy,R,rng){const C=L.C;for(let f=0;f<3;f++){const a=-Math.PI/2+(f-1)*1.1,fx=cx+Math.cos(a)*R*.55,fy=cy+Math.sin(a)*R*.55,r=R*.62;
  for(let k=0;k<5;k++){const pa=k*TAU/5+f;C.save();C.translate(fx,fy);C.rotate(pa);
    const p=new Path2D();p.ellipse(r*.48,0,r*.52,r*.34,0,0,TAU);const gr=C.createRadialGradient(0,0,0,0,0,r);gr.addColorStop(0,"#c83a22");gr.addColorStop(1,"#f06a3a");cfill(L,p,gr);
    if(k===0){C.fillStyle="#9a2414";for(let d=0;d<7;d++){C.beginPath();C.arc(r*rng.r(.15,.45),rng.r(-.12,.12)*r,1.6,0,TAU);C.fill();}}
    C.restore();}
  for(let k=0;k<5;k++){const a=rng.r(0,TAU);C.strokeStyle="#f6b08a";C.lineWidth=1;C.beginPath();C.moveTo(fx,fy);C.lineTo(fx+Math.cos(a)*r*.9,fy+Math.sin(a)*r*.9);C.stroke();}}}
function genFlowerAtlas(){const S=1024,C=512,L=newColorLayers(S,S),rng=RNG("floweratlas");const X=L.C;
  drawCherryCluster(L,0,0,C,rng,0);drawCherryCluster(L,C,0,C,rng,1);drawHagiRaceme(L,0,C,C,rng);
  /* quadrant 3 split in 4 (256): petal / azalea / snow flake / spare */
  const q=C/2,px=C+q*.5,py=C+q*.5;X.save();X.translate(px-q*.36,py);
  const pp=petalPath(q*.74,rng);const gr=X.createLinearGradient(0,0,q*.74,0);gr.addColorStop(0,"#eeb0c2");gr.addColorStop(.35,"#f9e0e8");gr.addColorStop(1,"#fff8fa");cfill(L,pp,gr);
  X.save();X.clip(pp);X.strokeStyle="rgba(230,190,204,0.5)";X.lineWidth=1;for(let v=-2;v<=2;v++){X.beginPath();X.moveTo(q*.05,0);X.quadraticCurveTo(q*.4,v*q*.05,q*.66,v*q*.09);X.stroke();}X.restore();
  X.restore();
  drawAzalea(L,C+q*1.5,C+q*.5,q*.45,rng);
  const sx=C+q*.5,sy=C+q*1.5;const sg=X.createRadialGradient(sx,sy,0,sx,sy,q*.45);sg.addColorStop(0,"rgba(255,255,255,1)");sg.addColorStop(.45,"rgba(250,252,255,0.85)");sg.addColorStop(1,"rgba(244,248,255,0)");
  X.fillStyle=sg;X.fillRect(C,C+q,q,q);
  return colorToTex(L,.4);}
/* atlas rectangles (u0,v0,du,dv) — v0 measured from the top of the canvas (DataTexture flipY=false) */
const CELL={q0:[0,0,.5,.5],q1:[.5,0,.5,.5],q2:[0,.5,.5,.5],q3:[.5,.5,.5,.5],h0:[0,0,.5,1],h1:[.5,0,.5,1],
  petal:[.5,.5,.25,.25],azalea:[.75,.5,.25,.25],snow:[.5,.75,.25,.25]};

/* ------------------------------------------------------------------ shaders (MeshStandardMaterial patches) */
const GL_WIND=`
uniform float uTime;
uniform float uWind;
uniform vec2 uWindDir;
uniform vec4 uWindAmp;
attribute vec4 aWind;
vec3 tsWind(vec3 p,vec4 w){
  float t=uTime,s=uWind,ft=uWindAmp.w;
  float gust=0.62+0.38*sin(t*0.27+w.z*0.21)*sin(t*0.61+1.3);
  vec3 dir=vec3(uWindDir.x,0.0,uWindDir.y),side=vec3(-uWindDir.y,0.0,uWindDir.x);
  float tr=(0.55+0.45*sin(t*0.93*ft+w.z)+0.16*sin(t*2.17*ft+w.z*1.7))*gust*s;
  vec3 o=(dir*tr+side*(0.22*s*sin(t*0.71*ft+w.z*1.3)))*(w.x*uWindAmp.x);
  float b=sin(t*1.85+w.w)*0.65+sin(t*3.27+w.w*1.71)*0.35;
  o+=(vec3(0.0,0.75,0.0)+dir*0.45+side*0.3)*(b*s*gust*w.y*uWindAmp.y);
  return o;
}`;
const GL_PROJ_V=`
vec4 tsP=vec4(transformed,1.0);
#ifdef USE_INSTANCING
tsP=instanceMatrix*tsP;
#endif
tsP.xyz+=tsWind(tsP.xyz,aWind);
vec4 mvPosition=modelViewMatrix*tsP;
gl_Position=projectionMatrix*mvPosition;`;
const GL_PROJ_I=`
vec4 tsP=instanceMatrix*vec4(transformed,1.0);
tsP.xyz+=tsWind(instanceMatrix[3].xyz,aWind);
vec4 mvPosition=modelViewMatrix*tsP;
gl_Position=projectionMatrix*mvPosition;`;
const GL_WORLDPOS=`
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP )
vec4 worldPosition=modelMatrix*tsP;
#endif`;
const LFB_TRANSL=T.ShaderChunk.lights_fragment_begin.split("RE_Direct( directLight, geometry, material, reflectedLight );")
  .join("RE_Direct( directLight, geometry, material, reflectedLight );\n\t\ttsTransl( directLight, geometry, material, reflectedLight );");

/* wood (bark tubes, culms): wind per vertex, snow on upward faces, seasonal crown occlusion */
function woodMaterial(o,W,S){const m=new T.MeshStandardMaterial({map:o.map,normalMap:o.normalMap,normalScale:new T.Vector2(o.ns||1,o.ns||1),
    roughness:o.rough==null?.9:o.rough,metalness:0,vertexColors:true});
  m.onBeforeCompile=(sh)=>{Object.assign(sh.uniforms,W,S);
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\n"+GL_WIND+"\nattribute float aAO;\nvarying vec3 vTsWN;\nvarying float vTsAO;")
      .replace("#include <defaultnormal_vertex>","#include <defaultnormal_vertex>\nvTsWN=normalize(mat3(modelMatrix)*objectNormal);\nvTsAO=aAO;")
      .replace("#include <project_vertex>",GL_PROJ_V).replace("#include <worldpos_vertex>",GL_WORLDPOS);
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nuniform float uSnow;\nuniform float uFoliage;\nuniform vec3 uSnowC;\nvarying vec3 vTsWN;\nvarying float vTsAO;")
      .replace("#include <color_fragment>",`#include <color_fragment>
float tsLum=dot(diffuseColor.rgb,vec3(0.33));
float tsSn=uSnow*smoothstep(0.42,0.80,vTsWN.y+(tsLum-0.06)*2.5);
diffuseColor.rgb=mix(diffuseColor.rgb,uSnowC,tsSn);`)
      .replace("#include <lights_fragment_end>","#include <lights_fragment_end>\nreflectedLight.indirectDiffuse*=mix(1.0,vTsAO,uFoliage);");};
  m.customProgramCacheKey=()=>"tsWood1";return m;}
function woodDepth(W){const m=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
  m.onBeforeCompile=(sh)=>{Object.assign(sh.uniforms,W);sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\n"+GL_WIND).replace("#include <project_vertex>",GL_PROJ_V);};
  m.customProgramCacheKey=()=>"tsWoodD1";return m;}

/* foliage cards (InstancedMesh): presence/scale per season, flutter, rigid sway with the branch, canopy-normal shading,
   palette colouring (mode "pal") or straight colour texture (mode "tex"), translucency, crown AO, snow */
const GL_FOL_V=`
attribute vec4 aLeaf;
attribute vec3 aCN;
attribute vec4 aAtlas;
uniform float uPresence;
uniform float uLeafScale;
uniform float uSnow;
uniform float uAOMin;
uniform float uExpBias;
varying vec4 vTsPal;
varying vec3 vTsCN;`;
const GL_FOL_BEGIN=`
vec3 transformed=vec3(position);
float tsVis=smoothstep(aLeaf.z,aLeaf.z+0.06,uPresence*1.06);
transformed*=tsVis*uLeafScale;
float tsPh=aLeaf.w*43.0;
float tsF=uWind*uWindAmp.z*(sin(uTime*(3.6+2.4*aLeaf.w)+tsPh)*0.7+sin(uTime*(8.3+3.0*aLeaf.w)+tsPh*1.3)*0.3);
float tsC=cos(tsF),tsS=sin(tsF);
transformed.xz=mat2(tsC,tsS,-tsS,tsC)*transformed.xz;
float tsC2=cos(tsF*0.7),tsS2=sin(tsF*0.7);
transformed.yz=mat2(tsC2,tsS2,-tsS2,tsC2)*transformed.yz;
vec3 tsN=normalize(mat3(modelMatrix)*(mat3(instanceMatrix)*vec3(0.0,0.0,1.0)));
float tsSn=uSnow*smoothstep(0.25,0.85,abs(tsN.y)*0.55+aLeaf.y*0.6);
vTsPal=vec4(mix(aLeaf.x,aLeaf.y,uExpBias),0.55+0.45*fract(aLeaf.w*7.31),mix(uAOMin,1.0,aLeaf.y),tsSn);`;
const GL_FOL_N=`
vec3 transformedNormal=objectNormal;
mat3 tsM=mat3(instanceMatrix);
transformedNormal/=vec3(dot(tsM[0],tsM[0]),dot(tsM[1],tsM[1]),dot(tsM[2],tsM[2]));
transformedNormal=normalMatrix*(tsM*transformedNormal);
vTsCN=normalMatrix*aCN;`;
const GL_UV_ATLAS=`
#ifdef USE_UV
vUv=uv*aAtlas.zw+aAtlas.xy;
#endif`;
const GL_FOL_F=`
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uTipC;
uniform vec3 uTwigC;
uniform vec3 uSnowC;
uniform vec3 uTint;
uniform float uTipAmt;
uniform float uSpread;
uniform float uTransl;
uniform vec3 uTranslTint;
uniform float uCanopyN;
uniform float uSpec;
varying vec4 vTsPal;
varying vec3 vTsCN;
`;
const GL_FOL_FN=`
void tsTransl(const in IncidentLight dl,const in GeometricContext g,const in PhysicalMaterial m,inout ReflectedLight rl){
  float back=saturate(-dot(g.normal,dl.direction));
  float fwd=pow(saturate(dot(-g.viewDir,dl.direction)),5.0);
  rl.directDiffuse+=dl.color*m.diffuseColor*uTranslTint*(uTransl*(0.42*back+1.5*fwd*(0.35+0.65*back)));
}`;
const GL_FOL_MAP_PAL=`
vec4 tsTx=texture2D(map,vUv);
float tsLeafM=smoothstep(0.035,0.085,tsTx.b);
float tsT=clamp(vTsPal.x+(tsTx.b-0.55)*uSpread,0.0,1.0);
vec3 tsCol=mix(mix(uC0,uC1,smoothstep(0.0,0.5,tsT)),uC2,smoothstep(0.5,1.0,tsT));
tsCol=mix(tsCol,uTipC,clamp(tsTx.g*uTipAmt*vTsPal.y*1.6,0.0,1.0));
tsCol=mix(uTwigC,tsCol,tsLeafM);
tsCol*=tsTx.r*1.32;
tsCol=mix(tsCol,uSnowC,vTsPal.w*smoothstep(0.35,0.75,tsTx.r+(tsTx.b-0.5)*0.5)*tsLeafM);
diffuseColor.rgb=tsCol;
diffuseColor.a*=tsTx.a;`;
const GL_FOL_MAP_TEX=`
vec4 tsTx=texture2D(map,vUv);
tsTx=mapTexelToLinear(tsTx);
diffuseColor*=tsTx;
diffuseColor.rgb*=uTint;
diffuseColor.rgb=mix(diffuseColor.rgb,uSnowC,vTsPal.w);`;
const GL_FOL_NORMAL=`
float faceDirection=gl_FrontFacing?1.0:-1.0;
vec3 normal=normalize(vNormal)*faceDirection;
normal=normalize(mix(normal,normalize(vTsCN),uCanopyN));
vec3 tsVd=normalize(vViewPosition);
normal=normalize(normal+tsVd*max(0.0,0.3-dot(normal,tsVd)));
vec3 geometryNormal=normal;`;
function foliageMaterial(o,W,S){const m=new T.MeshStandardMaterial({map:o.map,roughness:o.rough==null?.62:o.rough,metalness:0,side:T.DoubleSide,
    alphaTest:o.alphaTest==null?.42:o.alphaTest,alphaToCoverage:true});
  const mode=o.mode||"pal";
  m.onBeforeCompile=(sh)=>{Object.assign(sh.uniforms,W,S);
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\n"+GL_WIND+GL_FOL_V)
      .replace("#include <uv_vertex>",GL_UV_ATLAS).replace("#include <defaultnormal_vertex>",GL_FOL_N)
      .replace("#include <begin_vertex>",GL_FOL_BEGIN).replace("#include <project_vertex>",GL_PROJ_I).replace("#include <worldpos_vertex>",GL_WORLDPOS);
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\n"+GL_FOL_F)
      .replace("#include <map_fragment>",mode==="pal"?GL_FOL_MAP_PAL:GL_FOL_MAP_TEX)
      .replace("#include <normal_fragment_begin>",GL_FOL_NORMAL)
      .replace("void main() {",GL_FOL_FN+"\nvoid main() {").replace("#include <lights_fragment_begin>",LFB_TRANSL)
      .replace("#include <lights_fragment_end>","#include <lights_fragment_end>\nreflectedLight.indirectDiffuse*=vTsPal.z;\nreflectedLight.directSpecular*=uSpec;\nreflectedLight.indirectSpecular*=uSpec*vTsPal.z;");};
  m.customProgramCacheKey=()=>"tsFol2"+mode;return m;}
function foliageDepth(map,W,S){const m=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map,alphaTest:.5});
  m.onBeforeCompile=(sh)=>{Object.assign(sh.uniforms,W,S);
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\n"+GL_WIND+GL_FOL_V)
      .replace("#include <uv_vertex>",GL_UV_ATLAS).replace("#include <begin_vertex>",GL_FOL_BEGIN).replace("#include <project_vertex>",GL_PROJ_I);};
  m.customProgramCacheKey=()=>"tsFolD1";return m;}
/* solid instanced bits (snow cushions on pine pads, spring candles): uniform scale by a season value */
function solidInstMaterial(o,W,S){const m=new T.MeshStandardMaterial({color:new T.Color().fromArray(LIN(o.color)),roughness:o.rough==null?.9:o.rough,metalness:0});
  m.onBeforeCompile=(sh)=>{Object.assign(sh.uniforms,W,S);
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\n"+GL_WIND+"\nuniform float uAmount;\nattribute vec4 aLeaf;")
      .replace("#include <begin_vertex>","vec3 transformed=vec3(position)*smoothstep(aLeaf.z,aLeaf.z+0.15,uAmount*1.15);")
      .replace("#include <project_vertex>",GL_PROJ_I).replace("#include <worldpos_vertex>",GL_WORLDPOS);};
  m.customProgramCacheKey=()=>"tsSolid1";return m;}
function solidInstDepth(W,S){const m=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
  m.onBeforeCompile=(sh)=>{Object.assign(sh.uniforms,W,S);
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\n"+GL_WIND+"\nuniform float uAmount;\nattribute vec4 aLeaf;")
      .replace("#include <begin_vertex>","vec3 transformed=vec3(position)*smoothstep(aLeaf.z,aLeaf.z+0.15,uAmount*1.15);").replace("#include <project_vertex>",GL_PROJ_I);};
  m.customProgramCacheKey=()=>"tsSolidD1";return m;}

/* uniform sets */
function windUniforms(amp){return{uTime:{value:0},uWind:{value:.3},uWindDir:{value:new T.Vector2(.92,.38).normalize()},
  uWindAmp:{value:new T.Vector4(amp[0],amp[1],amp[2],amp[3]||1)}};}
function foliageUniforms(){const c=()=>({value:new T.Color(1,1,1)});
  return{uPresence:{value:1},uLeafScale:{value:1},uSnow:{value:0},uAOMin:{value:.42},uExpBias:{value:.4},uC0:c(),uC1:c(),uC2:c(),uTipC:c(),uTwigC:c(),
    uSnowC:{value:new T.Color().fromArray(LIN("#e9eef5"))},uTint:c(),uTipAmt:{value:0},uSpread:{value:.3},uTransl:{value:.9},uTranslTint:c(),uCanopyN:{value:.5},uSpec:{value:.35}};}
function woodUniforms(){return{uSnow:{value:0},uFoliage:{value:1},uSnowC:{value:new T.Color().fromArray(LIN("#e6ebf2"))}};}

/* ------------------------------------------------------------------ branch skeleton + tube mesh */
function Br(level){return{level,pts:[],rad:[],wb:[],phT:0,phB:0,radial:6,cap:true,len:0,parent:null,tint:null};}
function perpOf(d){const a=Math.abs(d.y)<.92?UP:new V3(1,0,0);return new V3().crossVectors(d,a).normalize();}
function brAt(b,t){const n=b.pts.length-1,f=clamp(t,0,1)*n,i=Math.min(n-1,Math.floor(f)),u=f-i;
  return{p:b.pts[i].clone().lerp(b.pts[i+1],u),r:lerp(b.rad[i],b.rad[i+1],u),wb:lerp(b.wb[i],b.wb[i+1],u),d:b.pts[i+1].clone().sub(b.pts[i]).normalize()};}
function growBr(b,p0,d0,len,nSeg,r0,r1,trop,wb0,wbK,taper){let p=p0.clone(),d=d0.clone().normalize();const sl=len/nSeg;
  b.pts.push(p.clone());b.rad.push(r0);b.wb.push(wb0);
  for(let i=1;i<=nSeg;i++){const t=i/nSeg;if(trop)trop(d,t,p,i);d.normalize();p.addScaledVector(d,sl);
    b.pts.push(p.clone());b.rad.push(lerp(r0,r1,Math.pow(t,taper||1)));b.wb.push(wb0+wbK*sl*i);}
  b.len=len;return b;}
function radialFor(r,Q){const b=r>.16?16:r>.08?12:r>.04?9:r>.02?7:r>.009?5:r>.004?4:3;return Math.max(3,Math.round(b*(Q.seg<1?Q.seg*1.05:1)));}
/* o: {texU,texV, wT(p,b,i) trunk-bend weight, ao(p,b,i) crown occlusion 0..1, tint(b,i)->[r,g,b]} */
function buildTubes(brs,o){let nv=0,ni=0;
  for(const b of brs){const n=b.pts.length;if(n<2)continue;const R=b.radial;nv+=n*(R+1)+(b.cap?1:0);ni+=(n-1)*R*6+(b.cap?R*3:0);}
  const pos=new Float32Array(nv*3),nor=new Float32Array(nv*3),uv=new Float32Array(nv*2),col=new Float32Array(nv*3),wnd=new Float32Array(nv*4),ao=new Float32Array(nv);
  const idx=nv>65000?new Uint32Array(ni):new Uint16Array(ni);let v=0,ii=0;const Tn=[],Nn=[],Bn=[],S=[];
  for(const b of brs){const n=b.pts.length;if(n<2)continue;const R=b.radial,P=b.pts;
    for(let i=0;i<n;i++)Tn[i]=P[Math.min(n-1,i+1)].clone().sub(P[Math.max(0,i-1)]).normalize();
    Nn[0]=b.n0?b.n0.clone():perpOf(Tn[0]);
    for(let i=1;i<n;i++){const ax=new V3().crossVectors(Tn[i-1],Tn[i]),l=ax.length();const nn=Nn[i-1].clone();
      if(l>1e-6)nn.applyAxisAngle(ax.divideScalar(l),Math.asin(Math.min(1,l)));nn.addScaledVector(Tn[i],-nn.dot(Tn[i])).normalize();Nn[i]=nn;}
    for(let i=0;i<n;i++)Bn[i]=new V3().crossVectors(Tn[i],Nn[i]);
    S[0]=0;for(let i=1;i<n;i++)S[i]=S[i-1]+P[i].distanceTo(P[i-1]);
    const ts=b.texScale||1,uRep=Math.max(1,Math.round(TAU*b.rad[0]/(o.texU*ts))),v0=v,vOff=b.vOff!=null?b.vOff:(b.level*.37)%1;
    for(let i=0;i<n;i++){const p=P[i],r=b.rad[i],i0=Math.max(0,i-1),i1=Math.min(n-1,i+1);
      const dr=(b.rad[i1]-b.rad[i0])/Math.max(1e-4,S[i1]-S[i0]);const wT=o.wT(p,b,i),aoV=o.ao?o.ao(p,b,i):1,tc=o.tint?o.tint(b,i):[1,1,1];
      const vv=b.vMap?b.vMap(i,S[i]):S[i]/(o.texV*ts)+vOff;
      for(let k=0;k<=R;k++){const a=k/R*TAU,ca=Math.cos(a),sa=Math.sin(a);
        const dx=Nn[i].x*ca+Bn[i].x*sa,dy=Nn[i].y*ca+Bn[i].y*sa,dz=Nn[i].z*ca+Bn[i].z*sa;const rr=r*(b.rn?b.rn(i,a,p):1);
        pos[v*3]=p.x+dx*rr;pos[v*3+1]=p.y+dy*rr;pos[v*3+2]=p.z+dz*rr;
        let nx=dx-Tn[i].x*dr,ny=dy-Tn[i].y*dr,nz=dz-Tn[i].z*dr;const nl=Math.hypot(nx,ny,nz)||1;nor[v*3]=nx/nl;nor[v*3+1]=ny/nl;nor[v*3+2]=nz/nl;
        uv[v*2]=k/R*uRep;uv[v*2+1]=vv;col[v*3]=tc[0];col[v*3+1]=tc[1];col[v*3+2]=tc[2];
        wnd[v*4]=wT;wnd[v*4+1]=b.wb[i];wnd[v*4+2]=b.phT;wnd[v*4+3]=b.phB;ao[v]=aoV;v++;}}
    for(let i=0;i<n-1;i++)for(let k=0;k<R;k++){const a=v0+i*(R+1)+k,c=a+R+1;idx[ii++]=a;idx[ii++]=a+1;idx[ii++]=c;idx[ii++]=a+1;idx[ii++]=c+1;idx[ii++]=c;}
    if(b.cap){const p=P[n-1],r=b.rad[n-1],t=Tn[n-1];pos[v*3]=p.x+t.x*r*1.2;pos[v*3+1]=p.y+t.y*r*1.2;pos[v*3+2]=p.z+t.z*r*1.2;
      nor[v*3]=t.x;nor[v*3+1]=t.y;nor[v*3+2]=t.z;uv[v*2]=.5;uv[v*2+1]=S[n-1]/o.texV+vOff+.02;const tc=o.tint?o.tint(b,n-1):[1,1,1];
      col[v*3]=tc[0];col[v*3+1]=tc[1];col[v*3+2]=tc[2];wnd[v*4]=o.wT(p,b,n-1);wnd[v*4+1]=b.wb[n-1];wnd[v*4+2]=b.phT;wnd[v*4+3]=b.phB;ao[v]=o.ao?o.ao(p,b,n-1):1;
      const last=v0+(n-1)*(R+1);for(let k=0;k<R;k++){idx[ii++]=last+k;idx[ii++]=last+k+1;idx[ii++]=v;}v++;}}
  const g=new T.BufferGeometry();g.setAttribute("position",new T.BufferAttribute(pos,3));g.setAttribute("normal",new T.BufferAttribute(nor,3));
  g.setAttribute("uv",new T.BufferAttribute(uv,2));g.setAttribute("color",new T.BufferAttribute(col,3));g.setAttribute("aWind",new T.BufferAttribute(wnd,4));
  g.setAttribute("aAO",new T.BufferAttribute(ao,1));g.setIndex(new T.BufferAttribute(idx,1));g.computeBoundingSphere();g.computeBoundingBox();return g;}

/* ------------------------------------------------------------------ cards & instanced foliage */
/* card: x in [-w/2,w/2], y in [0,1] from attachment to tip, bent down (bend) and V-folded (fold); uv -> unit cell, base at v=1 */
function cardGeo(sx,sy,bend,fold,aspect){const g=new T.PlaneGeometry(1,1,sx,sy),p=g.attributes.position,u=g.attributes.uv;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i)+.5;p.setXYZ(i,x*(aspect||1),y,-bend*y*y+fold*Math.abs(x)*2);u.setXY(i,x+.5,1-y);}
  g.computeVertexNormals();return g;}
function centeredCard(sx,sy,bend,fold){const g=new T.PlaneGeometry(1,1,sx,sy),p=g.attributes.position,u=g.attributes.uv;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setXYZ(i,x,y,-bend*(x*x+y*y)+fold*Math.abs(x)*2);u.setXY(i,x+.5,.5-y);}g.computeVertexNormals();return g;}
/* pine tuft: two crossed side-fans (cell 0) + a star across the shoot (cell 1) */
function tuftGeo(){const P=[],N=[],U=[],I=[];let v=0;
  const quad=(c,ax,ay,uv0,uv1,nrm)=>{const q=[[-.5,0],[.5,0],[.5,1],[-.5,1]];for(const[a,b]of q){P.push(c[0]+ax[0]*a+ay[0]*b,c[1]+ax[1]*a+ay[1]*b,c[2]+ax[2]*a+ay[2]*b);N.push(...nrm);
    U.push(lerp(uv0[0],uv1[0],a+.5),lerp(uv0[1],uv1[1],b));}I.push(v,v+1,v+2,v,v+2,v+3);v+=4;};
  quad([0,0,0],[1,0,0],[0,1,0],[0,1],[.5,0],[0,0,1]);
  quad([0,0,0],[0,0,1],[0,1,0],[0,1],[.5,0],[1,0,0]);
  const s=.9;const q=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];for(const[a,b]of q){P.push(a*s,.5,b*s);N.push(0,1,0);U.push(.5+(a+.5)*.5,b+.5);}I.push(v,v+1,v+2,v,v+2,v+3);v+=4;
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(P,3));g.setAttribute("normal",new T.Float32BufferAttribute(N,3));
  g.setAttribute("uv",new T.Float32BufferAttribute(U,2));g.setIndex(I);return g;}
function blobGeo(seed,ws,hs){const g=new T.SphereGeometry(1,ws||20,hs||12),p=g.attributes.position,r=RNG(seed),ph=[];for(let i=0;i<9;i++)ph.push(r.r(0,TAU));
  for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const n=1+.13*Math.sin(3.1*x+ph[0])*Math.sin(2.7*z+ph[1])+.09*Math.sin(5.3*x+4.1*y+ph[2])+.07*Math.sin(6.7*z-3.3*x+ph[3])+.05*Math.sin(9.1*y+7.7*x+ph[4]);
    x*=n;z*=n;y=y>0?y*n:y*.3;p.setXYZ(i,x,y,z);}
  g.computeVertexNormals();return g;}
/* collects per-instance data then builds an InstancedMesh with attributes aLeaf/aCN/aWind/aAtlas */
function InstBuf(){return{m:[],leaf:[],cn:[],wind:[],atlas:[],p:[]};}
const _mtx=new T.Matrix4(),_xa=new V3(),_ya=new V3(),_za=new V3();
function addInst(B,pos,yDir,zHint,roll,sx,sy,sz,leaf,wind,atlas){_ya.copy(yDir).normalize();_za.copy(zHint).addScaledVector(_ya,-zHint.dot(_ya));
  if(_za.lengthSq()<1e-6)_za.copy(perpOf(_ya));_za.normalize();if(roll)_za.applyAxisAngle(_ya,roll);_xa.crossVectors(_ya,_za).normalize();
  _mtx.makeBasis(_xa.multiplyScalar(sx),_ya.multiplyScalar(sy),_za.multiplyScalar(sz));_mtx.setPosition(pos);
  B.m.push(..._mtx.elements);B.leaf.push(leaf[0],leaf[1],leaf[2],leaf[3]);B.cn.push(0,1,0);B.wind.push(wind[0],wind[1],wind[2],wind[3]);
  B.atlas.push(atlas[0],atlas[1],atlas[2],atlas[3]);B.p.push(pos.x,pos.y,pos.z);}
/* normal-first variant: the card faces nrm, its long axis follows yHint as far as possible */
function addInstN(B,pos,nrm,yHint,roll,sx,sy,sz,leaf,wind,atlas){_za.copy(nrm).normalize();_ya.copy(yHint).addScaledVector(_za,-yHint.dot(_za));
  if(_ya.lengthSq()<1e-6)_ya.copy(perpOf(_za));_ya.normalize();if(roll)_ya.applyAxisAngle(_za,roll);_xa.crossVectors(_ya,_za).normalize();
  _mtx.makeBasis(_xa.multiplyScalar(sx),_ya.multiplyScalar(sy),_za.multiplyScalar(sz));_mtx.setPosition(pos);
  B.m.push(..._mtx.elements);B.leaf.push(leaf[0],leaf[1],leaf[2],leaf[3]);B.cn.push(0,1,0);B.wind.push(wind[0],wind[1],wind[2],wind[3]);
  B.atlas.push(atlas[0],atlas[1],atlas[2],atlas[3]);B.p.push(pos.x,pos.y,pos.z);}
/* crown shading: exposure (0 inside .. 1 outer/top) and canopy normals from an ellipsoid fit; optional per-instance local cluster */
function crownShade(B,o){const n=B.p.length/3;if(!n)return;let cx=0,cy=0,cz=0;for(let i=0;i<n;i++){cx+=B.p[i*3];cy+=B.p[i*3+1];cz+=B.p[i*3+2];}cx/=n;cy/=n;cz/=n;
  if(o&&o.center){cx=o.center.x;cy=o.center.y;cz=o.center.z;}
  const ax=[],ay=[],az=[];for(let i=0;i<n;i++){ax.push(Math.abs(B.p[i*3]-cx));ay.push(Math.abs(B.p[i*3+1]-cy));az.push(Math.abs(B.p[i*3+2]-cz));}
  const pc=(a)=>{a.sort((x,y)=>x-y);return Math.max(.3,a[Math.floor(a.length*.92)]);};const rx=pc(ax),ry=pc(ay),rz=pc(az);
  for(let i=0;i<n;i++){const dx=(B.p[i*3]-cx)/rx,dy=(B.p[i*3+1]-cy)/ry,dz=(B.p[i*3+2]-cz)/rz,d=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-3;
    let nx=dx/rx,ny=dy/ry+.25/ry,nz=dz/rz;
    if(o&&o.local){const L=o.local(i);if(L){nx=nx*.45+L.n.x*.55*Math.max(Math.abs(nx),Math.abs(ny),Math.abs(nz))*1.5;ny=ny*.45+L.n.y*.55*Math.max(Math.abs(nx),Math.abs(ny),Math.abs(nz))*1.5;nz=nz*.45+L.n.z*.55*Math.max(Math.abs(nx),Math.abs(ny),Math.abs(nz))*1.5;}}
    const nl=Math.hypot(nx,ny,nz)||1;B.cn[i*3]=nx/nl;B.cn[i*3+1]=ny/nl;B.cn[i*3+2]=nz/nl;
    let e=smooth(.3,1.05,d)*.72+.28*clamp(dy*.5+.5,0,1);if(o&&o.local){const L=o.local(i);if(L)e=e*.45+L.e*.55;}
    B.leaf[i*4+1]=clamp(e*(o&&o.eMul||1),0,1);}}
function makeInstanced(B,geo,mat,depth,bounds){const n=B.m.length/16,g=geo.clone();
  g.setAttribute("aLeaf",new T.InstancedBufferAttribute(new Float32Array(B.leaf),4));g.setAttribute("aCN",new T.InstancedBufferAttribute(new Float32Array(B.cn),3));
  g.setAttribute("aWind",new T.InstancedBufferAttribute(new Float32Array(B.wind),4));g.setAttribute("aAtlas",new T.InstancedBufferAttribute(new Float32Array(B.atlas),4));
  const mesh=new T.InstancedMesh(g,mat,Math.max(1,n));mesh.instanceMatrix.array.set(B.m.length?B.m:new T.Matrix4().elements);mesh.count=n;mesh.instanceMatrix.needsUpdate=true;
  if(depth)mesh.customDepthMaterial=depth;
  let mn=new V3(1e9,1e9,1e9),mx=new V3(-1e9,-1e9,-1e9);for(let i=0;i<B.p.length;i+=3){mn.min(new V3(B.p[i],B.p[i+1],B.p[i+2]));mx.max(new V3(B.p[i],B.p[i+1],B.p[i+2]));}
  if(!n){mn.set(0,0,0);mx.set(0,0,0);}const pad=bounds||1;mn.subScalar(pad);mx.addScalar(pad);
  g.boundingBox=new T.Box3(mn,mx);g.boundingSphere=new T.Sphere(mn.clone().add(mx).multiplyScalar(.5),mn.distanceTo(mx)*.5);
  mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}

/* ------------------------------------------------------------------ seasons */
const SEASON_ALIAS={spring:"spring",haru:"spring","春":"spring",earlysummer:"earlysummer",early_summer:"earlysummer",shoka:"earlysummer","初夏":"earlysummer",
  summer:"summer",natsu:"summer","夏":"summer",autumn:"autumn",fall:"autumn",aki:"autumn","秋":"autumn",lateautumn:"lateautumn",late_autumn:"lateautumn",
  "晩秋":"lateautumn",winter:"winter",fuyu:"winter","冬":"winter"};
function normSeason(k){return SEASON_ALIAS[String(k||"summer").toLowerCase()]||SEASON_ALIAS[String(k)]||"summer";}
function tbl(spec){const out={};for(const s in spec){out[s]={};for(const n in spec[s]){const v=spec[s][n];out[s][n]=typeof v==="string"?LIN(v):v;}}return out;}
function blendVals(a,b,t){const o={};for(const n in b){const x=a[n],y=b[n];if(x===undefined){o[n]=y;continue;}
  o[n]=typeof y==="number"?x+(y-x)*t:[x[0]+(y[0]-x[0])*t,x[1]+(y[1]-x[1])*t,x[2]+(y[2]-x[2])*t];}return o;}
function seasonVals(t,k){if(t[k])return t[k];if(k==="earlysummer")return blendVals(t.spring,t.summer,.6);if(k==="lateautumn")return blendVals(t.autumn,t.winter,.4);return t.summer;}
/* reg: {"ns.uName": uniform}; namespaces with a ".uPresence" hold their colours while leaves drop out / snap them when leaves appear */
function SeasonCtl(reg,table){let from=null,to=null,k=1,dur=0,cur="summer";
  const snap=()=>{const o={};for(const n in reg){const v=reg[n].value;o[n]=typeof v==="number"?v:[v.r,v.g,v.b];}return o;};
  const apply=(vals)=>{for(const n in vals){const u=reg[n];if(!u)continue;const v=vals[n];if(typeof v==="number")u.value=v;else u.value.setRGB(v[0],v[1],v[2]);}};
  const ns=(n)=>n.slice(0,n.indexOf("."));
  return{get key(){return cur;},
    set(key,sec){key=normSeason(key);const tgt=seasonVals(table,key);cur=key;
      if(!(sec>0)){apply(tgt);to=null;return;}
      from=snap();to=Object.assign({},tgt);k=0;dur=sec;
      for(const n in to){if(Array.isArray(to[n])){const pn=ns(n)+".uPresence";if(from[pn]!==undefined&&from[pn]<.02){from[n]=to[n];}}}
      this._hold={};for(const n in to){if(Array.isArray(to[n])){const pn=ns(n)+".uPresence";if(to[pn]!==undefined&&to[pn]<.02&&from[pn]>=.02)this._hold[n]=1;}}},
    update(dt){if(!to)return;k=Math.min(1,k+dt/dur);const e=k*k*(3-2*k),o={};
      for(const n in to){if(this._hold&&this._hold[n]&&k<1)continue;const x=from[n],y=to[n];o[n]=x===undefined?y:typeof y==="number"?x+(y-x)*e:[x[0]+(y[0]-x[0])*e,x[1]+(y[1]-x[1])*e,x[2]+(y[2]-x[2])*e];}
      apply(o);if(k>=1)to=null;}};}

/* ------------------------------------------------------------------ assembly helpers */
function finishTree(group,parts){const ud=group.userData;const W=parts.W;let windV=.3;
  ud.setWind=(v,dx,dz)=>{windV=Math.max(0,+v||0);W.uWind.value=windV;if(dx!=null&&dz!=null&&(dx||dz)){W.uWindDir.value.set(dx,dz).normalize();}};
  ud.setSeason=(key,sec)=>{parts.ctl.set(key,sec||0);ud.season=parts.ctl.key;};
  ud.update=(dt,t)=>{dt=Math.min(.1,Math.max(0,+dt||0));W.uTime.value+=dt;parts.ctl.update(dt);if(parts.onUpdate)parts.onUpdate(dt,t);};
  ud.dispose=()=>{group.traverse((o)=>{if(o.isMesh){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach((m)=>m.dispose());if(o.customDepthMaterial)o.customDepthMaterial.dispose();}});
    for(const k of parts.keys)texRelease(k);parts.keys.length=0;};
  let dc=0;group.traverse((o)=>{if(o.isMesh)dc++;});ud.drawCalls=dc;ud.uniforms=parts.reg||{};
  ud.setSeason(parts.season||"summer");ud.setWind(.3);return group;}
function woodMesh(geo,tex,W,WS,o){const m=new T.Mesh(geo,woodMaterial(Object.assign({map:tex.map,normalMap:tex.normalMap},o||{}),W,WS));m.customDepthMaterial=woodDepth(W);
  m.castShadow=true;m.receiveShadow=true;m.name="wood";return m;}

/* ============================================================================================== PINE */
function makePine(opts){const o=Object.assign({height:7,lean:.25,seed:1,quality:"high",overhang:1,padScale:1,season:"summer"},opts||{});
  const H=o.height,Q=QL(o.quality),rng=RNG("pine|"+o.seed),brs=[],pads=[];
  /* trunk: crooked, leaning toward +X, root flare with buttress lobes */
  const tl=Math.tan(clamp(o.lean,-1,1)),z=()=>H*rng.r(-.035,.035);
  const ctrl=[new V3(0,0,0),new V3(H*.025*Math.sign(tl||1),H*.11,z()*.4),new V3(H*tl*.28+H*rng.r(-.03,.03),H*.30,z()),
    new V3(H*tl*.58+H*rng.r(-.04,.02),H*.49,z()),new V3(H*tl*.80+H*rng.r(-.02,.03),H*.66,z()),new V3(H*tl*.86+H*rng.r(-.05,.02),H*.80,z()),new V3(H*tl*.84+H*rng.r(-.04,.04),H*.90,z())];
  const curve=new T.CatmullRomCurve3(ctrl,false,"centripetal",.5);
  const trunk=Br(0),NT=Math.round(30*Q.seg),R0=H*.031,ph=[rng.r(0,TAU),rng.r(0,TAU),rng.r(0,TAU)];
  for(let i=0;i<=NT;i++){const t=i/NT,p=curve.getPoint(t);trunk.pts.push(p);let r=R0*(1-.70*Math.pow(t,.85));r*=1+.6*Math.exp(-p.y/(.09*H));
    r*=1+.05*Math.sin(t*23+ph[0]);trunk.rad.push(r);trunk.wb.push(0);}
  trunk.radial=Math.round(18*Q.seg);trunk.rn=(i,a,p)=>1+.16*Math.exp(-p.y/(.05*H))*Math.cos(3*a+ph[1])+.07*Math.exp(-p.y/(.07*H))*Math.cos(5*a+ph[2])+.025*Math.cos(7*a+i*.4);
  trunk.cap=true;brs.push(trunk);
  /* main limbs: tiers of long sinuous near-horizontal limbs; one long limb overhangs toward +X (lean side) */
  const specs=[{t:.47,az:rng.r(-.10,.10),len:H*.56*o.overhang,el:-.02,over:true}],nLimb=Q.k==="low"?6:8;let az=2.2+rng.r(-.3,.3);
  for(let k=0;k<nLimb-1;k++){const t=lerp(.30,.90,(k+rng.r(.15,.85))/(nLimb-1));az+=2.399+rng.r(-.45,.45);
    let a=((az%TAU)+TAU)%TAU;if(t<.62&&(a<.55||a>TAU-.55))a+=1.1;
    specs.push({t,az:a,len:H*lerp(.40,.15,(t-.3)/.6)*rng.r(.85,1.15),el:lerp(-.12,.28,(t-.3)/.6)+rng.r(-.08,.08)});}
  const padOf=(b,big,scale)=>{const at=brAt(b,1),dh=new V3(at.d.x,0,at.d.z);if(dh.lengthSq()<1e-4)dh.set(1,0,0);dh.normalize();
    const sz=clamp(.55+b.len*.22,.6,1.15)*(big?1.3:1)*(scale||1)*o.padScale;
    pads.push({c:at.p.clone().addScaledVector(dh,sz*.32).add(new V3(0,sz*.26,0)),rx:sz*rng.r(.92,1.1),rz:sz*rng.r(.72,.9),ry:sz*rng.r(.40,.50),dir:dh,end:at.p.clone(),wb:at.wb,ph:b.phB,id:rng.f(),big,r:at.r});};
  let overhangPad=null;
  for(const s of specs){const at=brAt(trunk,s.t),b=Br(1);b.phB=rng.r(0,TAU);
    const d=new V3(Math.cos(s.az)*Math.cos(s.el),Math.sin(s.el),Math.sin(s.az)*Math.cos(s.el)),r0=at.r*rng.r(.48,.6);
    growBr(b,at.p,d,s.len,Math.max(6,Math.round(11*Q.seg)),r0,r0*.34,(dd,t)=>{dd.y+=t<.55?-.04:.06;if(rng.f()<.3)dd.applyAxisAngle(UP,rng.r(-.4,.4));dd.x+=rng.g()*.03;dd.z+=rng.g()*.03;},0,.95/s.len);
    b.radial=radialFor(r0,Q);brs.push(b);padOf(b,!!s.over,1);if(s.over)overhangPad=pads[pads.length-1];
    const nSub=s.len>1.8?rng.i(3,4):s.len>1.0?rng.i(2,3):rng.i(1,2);
    for(let j=0;j<nSub;j++){const tt=lerp(.30,.82,(j+rng.r(.2,.8))/nSub),a2=brAt(b,tt),sd=(j%2?1:-1)*(rng.f()<.15?-1:1);
      const d2=a2.d.clone().applyAxisAngle(UP,sd*rng.r(.6,1.15));d2.y=a2.d.y*.3+rng.r(-.04,.12);d2.normalize();
      const len2=Math.max(.45,s.len*rng.r(.28,.42)*(1.12-tt*.4)),c=Br(2);c.phB=b.phB+rng.r(-.3,.3);
      growBr(c,a2.p,d2,len2,Math.max(3,Math.round(5*Q.seg)),a2.r*.62,a2.r*.30,(dd,t)=>{dd.y+=t<.5?-.035:.07;dd.x+=rng.g()*.05;dd.z+=rng.g()*.05;},a2.wb,.9/s.len);
      c.radial=radialFor(a2.r*.62,Q);brs.push(c);padOf(c,false,s.over?1.05:.95);}}
  /* apex: 2-3 short leaders, each topped by a pad */
  const top=brAt(trunk,1);for(let k=0;k<3;k++){const a=k*2.1+rng.r(-.4,.4),d=new V3(Math.cos(a)*.7,1,Math.sin(a)*.7),b=Br(1);b.phB=rng.r(0,TAU);
    growBr(b,top.p,d,H*rng.r(.07,.12),3,top.r*.7,top.r*.35,(dd)=>{dd.x+=rng.g()*.08;dd.z+=rng.g()*.08;},0,.9/(H*.12));b.radial=radialFor(top.r*.7,Q);brs.push(b);padOf(b,false,k?.85:1.05);}
  /* dead stubs for character */
  for(let k=0;k<4;k++){const at=brAt(trunk,rng.r(.16,.42)),a=rng.r(0,TAU),b=Br(1);growBr(b,at.p,new V3(Math.cos(a),rng.r(-.2,.3),Math.sin(a)),rng.r(.10,.30),2,at.r*rng.r(.16,.26),at.r*.13,null,0,0);b.radial=radialFor(at.r*.2,Q);brs.push(b);}
  /* pads: a fan of branchlets from the limb end, a domed cushion of needle tufts over it (dense top/rim, sparser flat underside) */
  const TB=InstBuf(),SB=InstBuf(),padIdx=[];const tuftK=Q.k==="low"?.3:Q.k==="medium"?.6:1;
  pads.forEach((pd,pi)=>{const side=new V3().crossVectors(UP,pd.dir).normalize(),blp=[];
    /* big pads are multi-lobed clouds */
    const nLo=pd.rx>.82?rng.i(2,3):1,lobes=[];
    for(let l=0;l<nLo;l++){const off=nLo>1?(l/(nLo-1)-.5)*pd.rx*.95:0;
      lobes.push({c:pd.c.clone().addScaledVector(pd.dir,off).addScaledVector(side,nLo>1?rng.r(-.3,.3)*pd.rz:0).add(new V3(0,nLo>1?rng.r(-.10,.12):0,0)),
        rx:pd.rx*(nLo>1?rng.r(.56,.72):1),rz:pd.rz*(nLo>1?rng.r(.75,.95):1),ry:pd.ry*rng.r(.88,1.12)});}
    pd.lobes=lobes;
    /* crooked branchlet fan with sub-twigs */
    const twigs=(from,dir,L,r0,wb,depth)=>{const tw=Br(3);tw.phB=pd.ph;
      growBr(tw,from,dir,L,3,r0,r0*.4,(dd,t)=>{dd.y+=.02-.08*t;dd.applyAxisAngle(UP,rng.g()*.28);},wb,.35/Math.max(.2,L));
      tw.radial=Q.k==="low"?3:4;brs.push(tw);for(let i=1;i<tw.pts.length;i++)blp.push({p:tw.pts[i],wb:tw.wb[i]});
      if(depth>0){const ns=rng.i(1,3);for(let k=0;k<ns;k++){const at=brAt(tw,rng.r(.35,.85)),d2=at.d.clone().applyAxisAngle(UP,rng.sg()*rng.r(.5,1.1));d2.y+=rng.r(.05,.3);
        twigs(at.p,d2,L*rng.r(.35,.55),at.r*.7,at.wb,depth-1);}}};
    for(const lb of lobes){const toC=lb.c.clone().sub(pd.end);toC.y*=.4;const base=toC.length()>.05?toC.normalize():pd.dir.clone();
      const nB=Math.max(2,Math.round(lerp(2,4,clamp((lb.rx-.4)/.6,0,1))));
      for(let k=0;k<nB;k++){const a=(nB>1?k/(nB-1)-.5:0)*rng.r(2.0,2.8)+rng.r(-.25,.25),dirB=base.clone().applyAxisAngle(UP,a);dirB.y=rng.r(.1,.35);
        twigs(pd.end,dirB,(lb.c.distanceTo(pd.end)+lb.rx*.6)*rng.r(.6,.9),Math.min(pd.r*.75,.022),pd.wb,1);}}
    for(const lb of lobes){const nT=Math.max(8,Math.round(Math.PI*lb.rx*lb.rz*58*tuftK));
      for(let i=0;i<nT;i++){const u=rng.v(1);const top=u.y>0;u.y=top?u.y:u.y*.3-.04;const rr=.6+.4*Math.pow(rng.f(),.4);
        const lx=u.x*lb.rx*rr,ly=top?u.y*lb.ry*rr:u.y*lb.ry*.6,lz=u.z*lb.rz*rr;
        const pos=lb.c.clone().addScaledVector(pd.dir,lx).addScaledVector(side,lz).add(new V3(0,ly,0));
        const nrm=pd.dir.clone().multiplyScalar(u.x/lb.rx).addScaledVector(side,u.z/lb.rz).add(new V3(0,u.y/lb.ry,0)).normalize();
        const axis=nrm.clone().multiplyScalar(.7).add(new V3(0,top?.8:.2,0)).add(rng.v(.3)).normalize();
        const L=rng.r(.26,.36)*(pd.big?1.04:1)/Math.sqrt(tuftK*.8+.2);
        if(rng.f()<(top?.18:.6)){let best=null,bd=1e9;for(const q of blp){const dd=q.p.distanceToSquared(pos);if(dd<bd){bd=dd;best=q;}}
          if(best&&bd<.6){const sh=Br(4);sh.phB=pd.ph;const dv=pos.clone().sub(best.p),dl=dv.length();if(dl>.02){growBr(sh,best.p,dv,dl,2,.0065,.0038,(dd)=>{dd.y+=.06;dd.x+=rng.g()*.1;dd.z+=rng.g()*.1;},best.wb,0);sh.radial=3;sh.cap=false;brs.push(sh);}}}
        addInst(TB,pos.clone().addScaledVector(axis,-L*.22),axis,UP,rng.r(0,TAU),L,L,L,[clamp(pd.id*.65+rng.r(0,.35),0,1),0,rng.f(),rng.f()],[0,pd.wb+.3,0,pd.ph],[0,0,1,1]);padIdx.push(pi);}}
    /* winter snow cushion per lobe, resting on the dome */
    for(const lb of lobes){const cp=lb.c.clone().add(new V3(0,lb.ry*.62,0));
      addInst(SB,cp,UP,pd.dir,rng.r(-.3,.3),lb.rz*.80,lb.ry*.5,lb.rx*.78,[0,1,rng.r(0,.35),rng.f()],[0,pd.wb+.3,0,pd.ph],[0,0,1,1]);}});
  /* exposure: pad-local (top of pad = bright) mixed with crown-global */
  const tW=[];for(let i=0;i<TB.p.length/3;i++){const pd=pads[padIdx[i]],p=new V3(TB.p[i*3],TB.p[i*3+1],TB.p[i*3+2]);
    let lb=pd.lobes[0],bd=1e9;for(const q of pd.lobes){const d=q.c.distanceToSquared(p);if(d<bd){bd=d;lb=q;}}const rel=p.clone().sub(lb.c);
    const n=new V3(rel.x/(lb.rx*lb.rx),rel.y/(lb.ry*lb.ry)+.8/lb.ry,rel.z/(lb.rx*lb.rx)).normalize();tW.push({n,e:clamp(.45+rel.y/lb.ry*.6,0,1)});}
  crownShade(TB,{local:(i)=>tW[i]});
  /* wood */
  const keys=[];const bark=texAcquire("pinebark",genPineBark);keys.push("pinebark");const atlas=texAcquire("pineatlas",genPineAtlas);keys.push("pineatlas");
  for(const b of brs)b.texScale=clamp(b.rad[0]/(R0*1.1),.3,1);
  const W=windUniforms([.07*H/7,.09,.12,.8]),WS=woodUniforms();
  const geo=buildTubes(brs,{texU:.42,texV:.42,wT:(p)=>Math.pow(clamp(p.y/H,0,1.3),2),
    ao:(p)=>{let a=1;for(const pd of pads){const dx=(p.x-pd.c.x)/(pd.rx*1.1),dy=(p.y-pd.c.y)/(pd.ry*2.2),dz=(p.z-pd.c.z)/(pd.rx*1.1);const d=dx*dx+dy*dy+dz*dz;if(d<1)a=Math.min(a,lerp(.35,1,d));}return a;},
    tint:(b)=>b.level>=3?[.82,.74,.66]:b.level===2?[.95,.92,.9]:[1,1,1]});
  const group=new T.Group();group.name="TsurePine";
  group.add(woodMesh(geo,bark,W,WS,{ns:1.35,rough:.94}));
  const FS=foliageUniforms();FS.uCanopyN.value=.42;FS.uAOMin.value=.36;
  const needles=makeInstanced(TB,tuftGeo(),foliageMaterial({map:atlas,rough:.58,alphaTest:.38},W,FS),foliageDepth(atlas,W,FS),.4);needles.name="needles";group.add(needles);
  const CS={uAmount:{value:0}};const caps=makeInstanced(SB,blobGeo("snowcap",18,10),solidInstMaterial({color:"#eef2f8",rough:.86},W,CS),solidInstDepth(W,CS),.5);caps.name="snow";group.add(caps);
  const reg={"W.uSnow":WS.uSnow,"W.uFoliage":WS.uFoliage,"S.uAmount":CS.uAmount};for(const n in FS)reg["N."+n]=FS[n];
  const table=tbl({
    spring:{"N.uC0":"#26401f","N.uC1":"#36552c","N.uC2":"#4d6b35","N.uTipC":"#8fa84f","N.uTipAmt":.45,"N.uTwigC":"#6a5038","N.uSpread":.35,"N.uExpBias":.45,"N.uTransl":.55,"N.uTranslTint":[.9,1.1,.5],"N.uSnow":0,"W.uSnow":0,"S.uAmount":0,"W.uFoliage":1},
    summer:{"N.uC0":"#1c331c","N.uC1":"#2a4429","N.uC2":"#3b5634","N.uTipC":"#5a7638","N.uTipAmt":.12,"N.uTwigC":"#5e4632","N.uSpread":.3,"N.uExpBias":.5,"N.uTransl":.5,"N.uTranslTint":[.85,1.05,.45],"N.uSnow":0,"W.uSnow":0,"S.uAmount":0,"W.uFoliage":1},
    autumn:{"N.uC0":"#22391d","N.uC1":"#314b28","N.uC2":"#465c31","N.uTipC":"#6e7438","N.uTipAmt":.1,"N.uTwigC":"#5e4632","N.uSpread":.35,"N.uExpBias":.5,"N.uTransl":.5,"N.uTranslTint":[.95,1.0,.45],"N.uSnow":0,"W.uSnow":0,"S.uAmount":0,"W.uFoliage":1},
    winter:{"N.uC0":"#1f331c","N.uC1":"#2b4126","N.uC2":"#3b5030","N.uTipC":"#5d6a36","N.uTipAmt":.05,"N.uTwigC":"#5a4632","N.uSpread":.3,"N.uExpBias":.5,"N.uTransl":.35,"N.uTranslTint":[.9,1,.5],"N.uSnow":.75,"W.uSnow":1,"S.uAmount":1,"W.uFoliage":1}});
  const ctl=SeasonCtl(reg,table);
  const ud=group.userData;ud.height=H;ud.trunkRadius=R0;ud.kind="pine";
  const op=overhangPad||pads[0];ud.canopyAnchor=op.c.clone().add(new V3(0,-op.ry*1.15,0));ud.canopyAnchorDir=op.dir.clone();
  ud.crownRadius=Math.max(...pads.map((p)=>Math.hypot(p.c.x,p.c.z)+p.rx));
  ud.surfaceAt=(y,azm)=>surfaceOn(trunk,y,azm);ud.instanceCounts={needleTufts:TB.m.length/16,snowCaps:SB.m.length/16};
  return finishTree(group,{W,ctl,keys,reg,season:o.season});}
function surfaceOn(b,y,azm){let i=0;while(i<b.pts.length-2&&b.pts[i+1].y<y)i++;const a=b.pts[i],c=b.pts[i+1],u=clamp((y-a.y)/Math.max(1e-4,c.y-a.y),0,1);
  const p=a.clone().lerp(c,u),t=c.clone().sub(a).normalize(),r=lerp(b.rad[i],b.rad[i+1],u);const d=new V3(Math.cos(azm||0),0,Math.sin(azm||0));
  d.addScaledVector(t,-d.dot(t)).normalize();return{position:p.addScaledVector(d,r*(b.rn?b.rn(i,Math.atan2(d.z,d.x),p):1)),normal:d,radius:r};}

/* ============================================================================================== DECIDUOUS (maple / cherry / generic) */
/* recursive growth inside a crown envelope; opposite (maple) or alternate (cherry) branching */
function growDeciduous(rng,Q,cfg){const brs=[],tips=[];const C=cfg.crownC,R=cfg.crownR;
  const inside=(p,k)=>{const x=(p.x-C.x)/R.x,y=(p.y-C.y)/R.y,z=(p.z-C.z)/R.z;return x*x+y*y+z*z<=k*k;};
  const branchOn=(P,lev)=>{const sp=cfg.levels[lev];if(!sp||lev>cfg.maxLev)return;let rot=rng.r(0,TAU);const step=sp.step/Math.sqrt(Q.n*.7+.3);
    for(let s=sp.t0*P.len;s<sp.t1*P.len;s+=step*rng.r(.8,1.25)){const t=s/P.len,at=brAt(P,t);rot+=cfg.opposite?Math.PI/2+rng.r(-.3,.3):2.4+rng.r(-.4,.4);
      const pa=perpOf(at.d).applyAxisAngle(at.d,rot);const sides=cfg.opposite?[1,-1]:[1];
      for(const sd of sides){if(rng.f()<sp.skip)continue;let d=at.d.clone().multiplyScalar(Math.cos(sp.ang)).addScaledVector(pa,sd*Math.sin(sp.ang));
        d.y=d.y*sp.flat+sp.lift;d.normalize();const ov=new V3(at.p.x-C.x,0,at.p.z-C.z);
        if(ov.lengthSq()>1e-3){ov.normalize();if(d.dot(ov)<-.25&&rng.f()<.65)continue;d.addScaledVector(ov,sp.out).normalize();}
        let len=sp.len(t)*cfg.sH*rng.r(.75,1.2),tip=at.p.clone().addScaledVector(d,len),g=0;
        while(!inside(tip,1.03)&&len>.06&&g<10){len*=.82;tip=at.p.clone().addScaledVector(d,len);g++;}
        if(len<sp.minLen*cfg.sH)continue;const c=Br(lev);c.phB=P.phB+rng.r(-.25,.25);c.parent=P;
        const r0=Math.min(at.r*.78,cfg.rOf(len,lev));
        growBr(c,at.p,d,len,sp.nSeg,r0,Math.max(.0018,r0*.32),(dd,tt)=>{dd.y+=sp.droop(tt);dd.x+=rng.g()*sp.wig;dd.z+=rng.g()*sp.wig;},at.wb,.35);
        c.radial=radialFor(r0,Q);brs.push(c);if(lev<cfg.maxLev&&cfg.levels[lev+1])branchOn(c,lev+1);
        if(lev>=cfg.leafLev)tips.push(c);}}};
  return{brs,tips,branchOn,inside};}
/* foliage cards along terminal branches: o.per(b) cards per branch (first at the tip), each facing up/outward from the crown */
function leafSprays(rng,tips,FB,o){const C=o.crownC,R=o.crownR;
  for(const b of tips){const reps=o.per(b);
    for(let r=0;r<reps;r++){const t=r===0?1:rng.r(o.tMin||.35,.92),a=brAt(b,t);
      const ov=new V3((a.p.x-C.x)/R.x,(a.p.y-C.y)/R.y,(a.p.z-C.z)/R.z),dd=ov.length();ov.normalize();
      const nrm=new V3(0,o.up||1,0).addScaledVector(ov,(o.out||.8)*smooth(.2,.9,dd)).add(rng.v(o.jit||.45)).normalize();
      let yh=a.d.clone();if(r>0)yh.applyAxisAngle(UP,rng.sg()*rng.r(.5,1.3));
      const sz=o.size*rng.r(.82,1.15)*(r?.92:1);const pos=a.p.clone().addScaledVector(yh,-sz*.1);
      addInstN(FB,pos,nrm,yh,rng.r(-.35,.35),sz*o.aspect,sz,sz,[rng.f(),0,rng.f(),rng.f()],[0,a.wb+.25,0,b.phB],o.atlas(rng));}}}
function makeMaple(opts){const o=Object.assign({height:4.5,seed:1,quality:"high",lean:0,spread:1,season:"summer"},opts||{});
  const H=o.height,Q=QL(o.quality),rng=RNG("maple|"+o.seed),sH=H/4.5;
  const crownC=new V3(H*Math.sin(o.lean)*.55,H*.58,0),crownR=new V3(H*.70*o.spread,H*.44,H*.68*o.spread);
  const cfg={crownC,crownR,sH,opposite:true,maxLev:Q.k==="low"?3:4,leafLev:3,rOf:(len)=>.0012+.015*Math.pow(len,1.2),
    levels:{2:{t0:.16,t1:.97,step:.36*sH,ang:1.05,flat:.38,lift:.05,out:.42,len:(t)=>1.35-.85*t,skip:.12,minLen:.25,nSeg:6,droop:(t)=>t<.5?.015:-.03,wig:.08},
      3:{t0:.16,t1:.97,step:.17*sH,ang:1.0,flat:.25,lift:.03,out:.15,len:(t)=>.58-.30*t,skip:.15,minLen:.09,nSeg:4,droop:()=>-.02,wig:.10},
      4:{t0:.25,t1:1.0,step:.09*sH,ang:.9,flat:.25,lift:.05,out:.04,len:(t)=>.22-.09*t,skip:.22,minLen:.05,nSeg:2,droop:()=>0,wig:.12}}};
  const G=growDeciduous(rng,Q,cfg);const brs=G.brs;
  const trunk=Br(0),forkH=H*rng.r(.17,.24),R0=.027*H;trunk.phB=0;
  growBr(trunk,new V3(0,0,0),new V3(Math.sin(o.lean)*.9+rng.r(-.1,.1),1,rng.r(-.1,.1)),forkH*1.05,Math.max(4,Math.round(7*Q.seg)),R0,R0*.84,(d)=>{d.x+=rng.g()*.07;d.z+=rng.g()*.07;},0,0);
  const fp=[rng.r(0,TAU),rng.r(0,TAU)];trunk.rn=(i,a,p)=>1+.25*Math.exp(-p.y/.18)*(1+.6*Math.cos(3*a+fp[0]))+.05*Math.cos(2*a+fp[1]);trunk.radial=Math.round(13*Q.seg);brs.push(trunk);
  const nL=rng.i(4,5);let az=rng.r(0,TAU);
  for(let j=0;j<=nL;j++){const central=j===nL;az+=TAU/nL+rng.r(-.3,.3);
    const tilt=central?rng.r(.08,.2):rng.r(.42,.78)+o.lean*.35*Math.cos(az),d=new V3(Math.sin(tilt)*Math.cos(az),Math.cos(tilt),Math.sin(tilt)*Math.sin(az));
    const st=brAt(trunk,rng.r(.78,1));let len=(H-forkH)*(central?rng.r(.75,.85):rng.r(.95,1.12)/Math.cos(tilt*.75));const L=Br(1);L.phB=rng.r(0,TAU);const out=new V3(Math.cos(az),0,Math.sin(az));
    growBr(L,st.p,d,len,Math.max(7,Math.round(12*Q.seg)),R0*.84*Math.sqrt(1/nL)*(central?.85:1.2),R0*.10,(dd,t)=>{if(!central)dd.addScaledVector(out,t<.6?.05:.0);dd.y+=t<.6?-.03:.05;
      if(rng.f()<.25)dd.applyAxisAngle(UP,rng.r(-.3,.3));dd.x+=rng.g()*.07;dd.z+=rng.g()*.07;},0,.3);
    /* clip to the crown envelope */
    let k=L.pts.length-1;while(k>3&&!G.inside(L.pts[k],.98))k--;if(k<L.pts.length-1){L.pts.length=k+1;L.rad.length=k+1;L.wb.length=k+1;L.len*=k/(L.pts.length-1+ (L.pts.length-1-k));}
    L.len=0;for(let i=1;i<L.pts.length;i++)L.len+=L.pts[i].distanceTo(L.pts[i-1]);
    L.radial=radialFor(L.rad[0],Q);brs.push(L);G.branchOn(L,2);G.tips.push(L);}
  for(const b of brs)if(b.level===2)G.tips.push(b);
  const FB=InstBuf();const per=Q.k==="low"?(b)=>b.level>=3?1:(b.level>=1?1:0):Q.k==="medium"?(b)=>b.level>=4?2:(b.level>=1?1:0):(b)=>b.level>=4?3:(b.level===3?2:(b.level>=1?2:0));
  const sprayK=Q.k==="low"?1.6:Q.k==="medium"?1.2:1;
  leafSprays(rng,G.tips,FB,{crownC,crownR,per,size:.27*Math.pow(sH,.3)*sprayK,aspect:1,up:1,out:.75,jit:.45,tMin:.3,atlas:(r)=>{const c=r.f();return c<.4?CELL.q0:c<.72?CELL.q1:CELL.q2;}});
  crownShade(FB,{});
  const keys=[];const bark=texAcquire("maplebark",genMapleBark);keys.push("maplebark");const atlas=texAcquire("mapleatlas",genMapleAtlas);keys.push("mapleatlas");
  const W=windUniforms([.05*sH,.07,.38,1]),WS=woodUniforms();
  const geo=buildTubes(brs,{texU:.32,texV:.32,wT:(p)=>Math.pow(clamp(p.y/H,0,1.3),2),
    ao:(p)=>{const x=(p.x-crownC.x)/crownR.x,y=(p.y-crownC.y)/crownR.y,z=(p.z-crownC.z)/crownR.z;return lerp(.45,1,smooth(.2,1,Math.sqrt(x*x+y*y+z*z)));},
    tint:(b)=>b.level>=4?[.95,.72,.62]:b.level===3?[.95,.86,.8]:[1,1,1]});
  const group=new T.Group();group.name="TsureMaple";group.add(woodMesh(geo,bark,W,WS,{ns:.8,rough:.8}));
  const FS=foliageUniforms();FS.uCanopyN.value=.5;
  const leaves=makeInstanced(FB,cardGeo(2,2,.10,.05),foliageMaterial({map:atlas,rough:.6},W,FS),foliageDepth(atlas,W,FS),.4);leaves.name="leaves";group.add(leaves);
  const reg={"W.uSnow":WS.uSnow,"W.uFoliage":WS.uFoliage};for(const n in FS)reg["L."+n]=FS[n];
  const table=tbl({
    spring:{"L.uPresence":1,"L.uLeafScale":.74,"L.uC0":"#5b8a30","L.uC1":"#86b443","L.uC2":"#a6c95a","L.uTipC":"#b8492c","L.uTipAmt":.5,"L.uSpread":.35,"L.uExpBias":.45,"L.uTransl":1.0,"L.uTranslTint":[1.0,1.15,.55],"L.uTwigC":"#8a3a2a","L.uSnow":0,"W.uSnow":0,"W.uFoliage":.75},
    earlysummer:{"L.uPresence":1,"L.uLeafScale":.92,"L.uC0":"#3f6a24","L.uC1":"#5f8f30","L.uC2":"#82ad42","L.uTipC":"#8a8a34","L.uTipAmt":.1,"L.uSpread":.3,"L.uExpBias":.5,"L.uTransl":.95,"L.uTranslTint":[.95,1.15,.5],"L.uTwigC":"#6a4a2a","L.uSnow":0,"W.uSnow":0,"W.uFoliage":.95},
    summer:{"L.uPresence":1,"L.uLeafScale":1,"L.uC0":"#2c4a1b","L.uC1":"#406627","L.uC2":"#5a8233","L.uTipC":"#6b8a2e","L.uTipAmt":0,"L.uSpread":.3,"L.uExpBias":.5,"L.uTransl":.85,"L.uTranslTint":[.9,1.1,.45],"L.uTwigC":"#5a4a2a","L.uSnow":0,"W.uSnow":0,"W.uFoliage":1},
    autumn:{"L.uPresence":1,"L.uLeafScale":1,"L.uC0":"#e3a624","L.uC1":"#e2601b","L.uC2":"#bb1d15","L.uTipC":"#8a1010","L.uTipAmt":.32,"L.uSpread":.55,"L.uExpBias":.6,"L.uTransl":1.25,"L.uTranslTint":[1.2,.78,.45],"L.uTwigC":"#6a3020","L.uSnow":0,"W.uSnow":0,"W.uFoliage":.95},
    lateautumn:{"L.uPresence":.5,"L.uLeafScale":.97,"L.uC0":"#cc6a1c","L.uC1":"#b5321a","L.uC2":"#8c1814","L.uTipC":"#5a1a10","L.uTipAmt":.4,"L.uSpread":.5,"L.uExpBias":.6,"L.uTransl":1.2,"L.uTranslTint":[1.2,.75,.45],"L.uTwigC":"#5a2a1a","L.uSnow":0,"W.uSnow":0,"W.uFoliage":.6},
    winter:{"L.uPresence":0,"L.uLeafScale":1,"L.uC0":"#8a5a2a","L.uC1":"#7a3a1e","L.uC2":"#5a2a18","L.uTipC":"#4a2a18","L.uTipAmt":.2,"L.uSpread":.4,"L.uExpBias":.5,"L.uTransl":1,"L.uTranslTint":[1.1,.8,.5],"L.uTwigC":"#5a3a2a","L.uSnow":0,"W.uSnow":.75,"W.uFoliage":0}});
  const ctl=SeasonCtl(reg,table);const ud=group.userData;ud.kind="maple";ud.height=H;ud.trunkRadius=R0;ud.crownRadius=crownR.x;ud.surfaceAt=(y,a)=>surfaceOn(trunk,y,a);
  ud.instanceCounts={leafSprays:FB.m.length/16};return finishTree(group,{W,ctl,keys,reg,season:o.season});}

function makeCherry(opts){const o=Object.assign({height:6,seed:1,quality:"high",lean:0,spread:1,season:"summer"},opts||{});
  const H=o.height,Q=QL(o.quality),rng=RNG("cherry|"+o.seed),sH=H/6;
  const crownC=new V3(H*Math.sin(o.lean)*.5,H*.60,0),crownR=new V3(H*.74*o.spread,H*.43,H*.72*o.spread);
  const cfg={crownC,crownR,sH,opposite:false,maxLev:Q.k==="low"?3:4,leafLev:3,rOf:(len)=>.0016+.013*Math.pow(len,1.2),
    levels:{2:{t0:.16,t1:.96,step:.30*sH,ang:.80,flat:.6,lift:.10,out:.32,len:(t)=>1.7-1.0*t,skip:.05,minLen:.3,nSeg:6,droop:(t)=>t<.45?.02:-.03,wig:.08},
      3:{t0:.14,t1:.97,step:.17*sH,ang:.78,flat:.55,lift:.06,out:.12,len:(t)=>.72-.36*t,skip:.10,minLen:.1,nSeg:4,droop:()=>-.02,wig:.11},
      4:{t0:.12,t1:1.0,step:.065*sH,ang:.95,flat:.6,lift:.18,out:.02,len:(t)=>.10-.03*t,skip:.15,minLen:.025,nSeg:1,droop:()=>0,wig:.1}}};
  const G=growDeciduous(rng,Q,cfg),brs=G.brs;
  const trunk=Br(0),forkH=H*rng.r(.22,.28),R0=.034*H;
  growBr(trunk,new V3(0,0,0),new V3(Math.sin(o.lean)*.9+rng.r(-.06,.06),1,rng.r(-.06,.06)),forkH*1.04,Math.max(4,Math.round(8*Q.seg)),R0,R0*.86,(d)=>{d.x+=rng.g()*.05;d.z+=rng.g()*.05;},0,0);
  const fp=[rng.r(0,TAU),rng.r(0,TAU)];trunk.rn=(i,a,p)=>1+.28*Math.exp(-p.y/.25)*(1+.7*Math.cos(4*a+fp[0]))+.05*Math.cos(2*a+fp[1]);trunk.radial=Math.round(15*Q.seg);brs.push(trunk);
  const nS=rng.i(5,6);let az=rng.r(0,TAU);
  for(let j=0;j<nS;j++){az+=TAU/nS+rng.r(-.25,.25);const tilt=rng.r(.62,1.0)+o.lean*.3*Math.cos(az),d=new V3(Math.sin(tilt)*Math.cos(az),Math.cos(tilt),Math.sin(tilt)*Math.sin(az));
    const st=brAt(trunk,rng.r(.72,1)),len=H*rng.r(.70,.85),L=Br(1);L.phB=rng.r(0,TAU);const out=new V3(Math.cos(az),0,Math.sin(az));
    growBr(L,st.p,d,len,Math.max(7,Math.round(12*Q.seg)),R0*.86*Math.sqrt(1/nS)*1.35,R0*.09,(dd,t)=>{dd.addScaledVector(out,t<.5?.035:.0);dd.y+=t<.5?-.01:.025;
      if(rng.f()<.2)dd.applyAxisAngle(UP,rng.r(-.25,.25));dd.x+=rng.g()*.05;dd.z+=rng.g()*.05;},0,.28);
    let k=L.pts.length-1;while(k>3&&!G.inside(L.pts[k],.97))k--;L.pts.length=k+1;L.rad.length=k+1;L.wb.length=k+1;
    L.len=0;for(let i=1;i<L.pts.length;i++)L.len+=L.pts[i].distanceTo(L.pts[i-1]);
    L.radial=radialFor(L.rad[0],Q);brs.push(L);G.branchOn(L,2);G.tips.push(L);}
  for(const b of brs)if(b.level===2)G.tips.push(b);
  const FB=InstBuf(),BB=InstBuf();const lowK=Q.k==="low"?1.55:Q.k==="medium"?1.2:1;
  const per=Q.k==="low"?(b)=>b.level>=3?2:1:Q.k==="medium"?(b)=>b.level>=4?1:(b.level===3?2:1):(b)=>b.level>=4?1:(b.level===3?3:2);
  leafSprays(rng,G.tips,FB,{crownC,crownR,per,size:.27*Math.pow(sH,.25)*lowK,aspect:1,up:1,out:.85,jit:.5,tMin:.3,atlas:(r)=>{const c=r.f();return c<.4?CELL.q0:c<.7?CELL.q1:CELL.q2;}});
  const perB=Q.k==="low"?(b)=>b.level>=3?3:2:Q.k==="medium"?(b)=>b.level>=4?2:(b.level===3?4:2):(b)=>b.level>=4?3:(b.level===3?5:3);
  leafSprays(rng,G.tips,BB,{crownC,crownR,per:perB,size:.33*lowK,aspect:1,up:.8,out:1.1,jit:.6,tMin:.15,atlas:(r)=>r.f()<.6?CELL.q0:CELL.q1});
  crownShade(FB,{center:crownC});crownShade(BB,{center:crownC});
  const keys=[];const bark=texAcquire("cherrybark",genCherryBark);keys.push("cherrybark");const atlas=texAcquire("cherryatlas",genCherryLeafAtlas);keys.push("cherryatlas");
  const fatl=texAcquire("floweratlas",genFlowerAtlas);keys.push("floweratlas");
  const W=windUniforms([.06*sH,.08,.32,.9]),WS=woodUniforms();
  const geo=buildTubes(brs,{texU:.34,texV:.34,wT:(p)=>Math.pow(clamp(p.y/H,0,1.3),2),
    ao:(p)=>{const x=(p.x-crownC.x)/crownR.x,y=(p.y-crownC.y)/crownR.y,z=(p.z-crownC.z)/crownR.z;return lerp(.45,1,smooth(.2,1,Math.sqrt(x*x+y*y+z*z)));},
    tint:(b)=>b.level>=4?[.9,.78,.74]:b.level===3?[.95,.88,.86]:[1,1,1]});
  const group=new T.Group();group.name="TsureCherry";group.add(woodMesh(geo,bark,W,WS,{ns:.9,rough:.72}));
  const FS=foliageUniforms(),BS=foliageUniforms();FS.uCanopyN.value=.5;BS.uCanopyN.value=.45;BS.uAOMin.value=.62;
  const leaves=makeInstanced(FB,cardGeo(2,2,.08,.04),foliageMaterial({map:atlas,rough:.5},W,FS),foliageDepth(atlas,W,FS),.4);leaves.name="leaves";group.add(leaves);
  const bloom=makeInstanced(BB,cardGeo(2,2,.05,.03),foliageMaterial({map:fatl,mode:"tex",rough:.7},W,BS),foliageDepth(fatl,W,BS),.4);bloom.name="blossoms";group.add(bloom);
  const reg={"W.uSnow":WS.uSnow,"W.uFoliage":WS.uFoliage};for(const n in FS)reg["L."+n]=FS[n];for(const n in BS)reg["B."+n]=BS[n];
  const table=tbl({
    spring:{"L.uPresence":.72,"L.uLeafScale":.5,"L.uC0":"#5e2a1c","L.uC1":"#7c3a24","L.uC2":"#985030","L.uTipC":"#6e7a30","L.uTipAmt":.12,"L.uSpread":.35,"L.uExpBias":.4,"L.uTransl":1.1,"L.uTranslTint":[1.2,.85,.5],"L.uTwigC":"#6a3a28","W.uSnow":0,"W.uFoliage":.55,
      "B.uPresence":1,"B.uLeafScale":1,"B.uTint":[1,1,1],"B.uTransl":1.2,"B.uTranslTint":[1.0,.9,.92]},
    earlysummer:{"L.uPresence":1,"L.uLeafScale":.95,"L.uC0":"#3f6a24","L.uC1":"#56862e","L.uC2":"#74a03e","L.uTipC":"#7a8a34","L.uTipAmt":.05,"L.uSpread":.3,"L.uExpBias":.5,"L.uTransl":.9,"L.uTranslTint":[.95,1.15,.5],"L.uTwigC":"#5a3a28","W.uSnow":0,"W.uFoliage":.95,"B.uPresence":0,"B.uLeafScale":1,"B.uTint":[1,1,1],"B.uTransl":1,"B.uTranslTint":[1,1,1]},
    summer:{"L.uPresence":1,"L.uLeafScale":1,"L.uC0":"#283f1a","L.uC1":"#3a5a24","L.uC2":"#4e722e","L.uTipC":"#5a6a2a","L.uTipAmt":0,"L.uSpread":.3,"L.uExpBias":.5,"L.uTransl":.75,"L.uTranslTint":[.9,1.1,.45],"L.uTwigC":"#5a3a28","W.uSnow":0,"W.uFoliage":1,"B.uPresence":0,"B.uLeafScale":1,"B.uTint":[1,1,1],"B.uTransl":1,"B.uTranslTint":[1,1,1]},
    autumn:{"L.uPresence":.9,"L.uLeafScale":1,"L.uC0":"#d9a332","L.uC1":"#d2621e","L.uC2":"#a8281c","L.uTipC":"#6a3a1e","L.uTipAmt":.28,"L.uSpread":.6,"L.uExpBias":.45,"L.uTransl":1.15,"L.uTranslTint":[1.2,.8,.45],"L.uTwigC":"#5a3a28","W.uSnow":0,"W.uFoliage":.9,"B.uPresence":0,"B.uLeafScale":1,"B.uTint":[1,1,1],"B.uTransl":1,"B.uTranslTint":[1,1,1]},
    winter:{"L.uPresence":0,"L.uLeafScale":1,"L.uC0":"#8a5a2a","L.uC1":"#7a3a1e","L.uC2":"#5a2a18","L.uTipC":"#4a2a18","L.uTipAmt":.2,"L.uSpread":.4,"L.uExpBias":.5,"L.uTransl":1,"L.uTranslTint":[1.1,.8,.5],"L.uTwigC":"#5a3a2a","W.uSnow":.75,"W.uFoliage":0,"B.uPresence":0,"B.uLeafScale":1,"B.uTint":[1,1,1],"B.uTransl":1,"B.uTranslTint":[1,1,1]}});
  const ctl=SeasonCtl(reg,table);const ud=group.userData;ud.kind="cherry";ud.height=H;ud.trunkRadius=R0;ud.crownRadius=crownR.x;ud.surfaceAt=(y,a)=>surfaceOn(trunk,y,a);
  ud.instanceCounts={leafSprays:FB.m.length/16,blossomClusters:BB.m.length/16};return finishTree(group,{W,ctl,keys,reg,season:o.season});}

/* ============================================================================================== BAMBOO GROVE (madake) */
function makeBambooGrove(opts){const o=Object.assign({width:8,depth:4,height:9,seed:1,quality:"high",season:"summer"},opts||{});
  const Q=QL(o.quality),rng=RNG("bamboo|"+o.seed),Hh=o.height;
  const count=o.count||Math.max(4,Math.round(o.width*o.depth*(Q.k==="low"?.8:Q.k==="medium"?1.35:2.0)));
  const pts=[];let guard=0;const minD=Math.max(.16,Math.min(.4,Math.sqrt(o.width*o.depth/count)*.55));
  while(pts.length<count&&guard++<count*80){const x=rng.r(-.5,.5)*o.width,z=rng.r(-.5,.5)*o.depth;if(pts.every((p)=>Math.hypot(p[0]-x,p[1]-z)>minD))pts.push([x,z]);}
  const brs=[],FB=InstBuf(),culms=[];const brK=Q.k==="low"?.45:Q.k==="medium"?.7:1,handK=Q.k==="low"?1.45:Q.k==="medium"?1.18:1;
  pts.forEach(([x,z],ci)=>{const D=rng.r(.05,.10),Hc=Hh*rng.r(.78,1.06)*Math.pow(D/.075,.22),ph=rng.r(0,TAU),age=rng.f();
    const lean=new V3(x/o.width*.06+rng.r(-.035,.035),0,z/o.depth*.05+rng.r(-.035,.035)),b=Br(0);b.phT=ph;b.phB=ph;b.radial=Math.max(6,Math.round(12*Q.seg));
    let h=0;const nodes=[];while(h<Hc){const t=h/Hc,il=lerp(.12,.40,smooth(0,.3,t))*lerp(1,.72,smooth(.65,1,t))*rng.r(.94,1.06)*Math.sqrt(Hc/9);nodes.push(h);h+=il;}
    const R0=D/2,nodeV=[];const pathAt=(hh)=>{const t=hh/Hc,arch=Math.pow(smooth(.7,1,t),2);return new V3(x+lean.x*hh+lean.x*arch*Hc*.35,hh*(1-arch*.02),z+lean.z*hh+lean.z*arch*Hc*.35);};
    for(let k=0;k<nodes.length;k++){const h0=nodes[k],h1=k+1<nodes.length?nodes[k+1]:Hc,segs=Q.k==="high"?[0,.035,.5]:[0,.5];
      for(const f of segs){const hh=lerp(h0,h1,f),t=hh/Hc;b.pts.push(pathAt(hh));b.rad.push(R0*(1-.6*Math.pow(t,1.6))*(f===.035?1.04:1)+.0012);b.wb.push(0);nodeV.push(k+f);}}
    b.pts.push(pathAt(Hc));b.rad.push(.004);b.wb.push(0);nodeV.push(nodes.length);b.vMap=(i)=>nodeV[i];b.cap=true;b.age=age;b.ci=ci;b.Hc=Hc;brs.push(b);
    culms.push({base:new V3(x,0,z),radius:R0,height:Hc});
    const wT=(p)=>Math.pow(clamp(p.y/Hc,0,1.2),2);
    /* branches from the upper nodes, alternating sides; two per node (one smaller) */
    let side=rng.r(0,TAU);
    for(let k=0;k<nodes.length;k++){const t=nodes[k]/Hc;if(t<.38||t>.97)continue;side+=Math.PI+rng.r(-.35,.35);if(rng.f()>brK*.97)continue;
      for(const pair of[0,1]){if(pair&&rng.f()<.35)continue;const pa=pathAt(nodes[k]),az=side+pair*rng.r(.35,.7);const d=new V3(Math.cos(az),rng.r(.7,1.2),Math.sin(az)).normalize();
        const len=lerp(1.5,.6,smooth(.38,1,t))*rng.r(.8,1.15)*(pair?.7:1),bb=Br(1);bb.phT=ph;bb.phB=ph+rng.r(-.3,.3);
        growBr(bb,pa,d,len,3,.006,.0022,(dd,tt)=>{dd.y-=.22*tt;dd.x+=rng.g()*.08;dd.z+=rng.g()*.08;},0,.6);bb.radial=Q.k==="low"?3:4;bb.wTf=wT;brs.push(bb);
        const subs=[bb];const nsub=Math.round(rng.i(1,3)*brK);
        for(let j=0;j<nsub;j++){const at=brAt(bb,rng.r(.3,.85)),d2=at.d.clone().applyAxisAngle(UP,rng.sg()*rng.r(.5,1.1));d2.y-=.15;d2.normalize();
          const sb=Br(2);sb.phT=ph;sb.phB=bb.phB;growBr(sb,at.p,d2,len*rng.r(.35,.55),2,.003,.0015,(dd)=>{dd.y-=.12;},at.wb,.6);sb.radial=3;sb.wTf=wT;brs.push(sb);subs.push(sb);}
        for(const sb of subs){const nh=Math.max(1,Math.round((sb===bb?rng.i(4,7):rng.i(2,4))*brK/Math.sqrt(handK)));
          for(let j=0;j<nh;j++){const a=brAt(sb,j===0?1:rng.r(.25,.95));const ha=Math.atan2(a.d.z,a.d.x)+rng.r(-1.3,1.3);
            const dd=new V3(Math.cos(ha),-rng.r(.35,1.3),Math.sin(ha)).normalize();
            const sz=rng.r(.30,.38)*handK;const nrm=new V3(Math.cos(ha+rng.sg()*Math.PI/2),rng.r(.1,.9),Math.sin(ha+rng.sg()*Math.PI/2)).normalize();
            addInstN(FB,a.p.clone().addScaledVector(dd,-sz*.05),nrm,dd,rng.r(-.35,.35),sz*.9,sz,sz,[rng.f(),0,rng.f(),rng.f()],[wT(a.p),a.wb+.3,ph,bb.phB],rng.f()<.6?CELL.h0:CELL.h1);}}}}
    /* tip tuft */
    for(let j=0;j<Math.round(7*brK);j++){const pp=pathAt(Hc*rng.r(.88,1));const dd=new V3(rng.r(-1,1),rng.r(-.7,.2),rng.r(-1,1)).normalize();const sz=rng.r(.22,.28)*handK;
      addInst(FB,pp,dd,UP,rng.r(-.6,.6),sz*.9,sz,sz,[rng.f(),0,rng.f(),rng.f()],[wT(pp),.3,ph,ph],rng.f()<.6?CELL.h0:CELL.h1);}});
  crownShade(FB,{});
  const keys=[];const culm=texAcquire("culm",genCulm);keys.push("culm");const atlas=texAcquire("bambooatlas",genBambooAtlas);keys.push("bambooatlas");
  const W=windUniforms([.55*Hh/9,.10,.30,.75]),WS=woodUniforms();
  const geo=buildTubes(brs,{texU:.6,texV:.09,wT:(p,b)=>b.level===0?Math.pow(clamp(p.y/b.Hc,0,1.2),2):(b.wTf?b.wTf(p):0),
    ao:(p)=>lerp(.5,1,smooth(.2,.9,p.y/Hh)),tint:(b)=>{if(b.level>0)return[.85,.8,.6];const a=b.age;return a>.88?[1.25,1.1,.62]:[lerp(.95,1.1,a),lerp(1.05,.9,a),lerp(1,.75,a)];}});
  const group=new T.Group();group.name="TsureBamboo";group.add(woodMesh(geo,culm,W,WS,{ns:1,rough:.55}));
  const FS=foliageUniforms();FS.uCanopyN.value=.45;FS.uAOMin.value=.4;
  const leaves=makeInstanced(FB,cardGeo(2,3,.18,.03),foliageMaterial({map:atlas,rough:.5},W,FS),foliageDepth(atlas,W,FS),.6);leaves.name="leaves";group.add(leaves);
  const reg={"W.uSnow":WS.uSnow,"W.uFoliage":WS.uFoliage};for(const n in FS)reg["L."+n]=FS[n];
  const table=tbl({
    spring:{"L.uC0":"#4a5e24","L.uC1":"#8a8a3a","L.uC2":"#b8a64c","L.uTipC":"#a89448","L.uTipAmt":.35,"L.uSpread":.7,"L.uExpBias":.3,"L.uTransl":.95,"L.uTranslTint":[1.1,1.1,.5],"L.uTwigC":"#7a7a40","L.uSnow":0,"W.uSnow":0},
    summer:{"L.uC0":"#2d4a1c","L.uC1":"#436a27","L.uC2":"#5d8532","L.uTipC":"#7a8a3a","L.uTipAmt":.08,"L.uSpread":.35,"L.uExpBias":.45,"L.uTransl":.85,"L.uTranslTint":[.9,1.12,.45],"L.uTwigC":"#6a7a3a","L.uSnow":0,"W.uSnow":0},
    autumn:{"L.uC0":"#34561f","L.uC1":"#4f7a2b","L.uC2":"#6c9636","L.uTipC":"#8a9a40","L.uTipAmt":.06,"L.uSpread":.35,"L.uExpBias":.45,"L.uTransl":.9,"L.uTranslTint":[.95,1.12,.48],"L.uTwigC":"#6a7a3a","L.uSnow":0,"W.uSnow":0},
    winter:{"L.uC0":"#30441e","L.uC1":"#465f28","L.uC2":"#5c7432","L.uTipC":"#8a8a4a","L.uTipAmt":.15,"L.uSpread":.4,"L.uExpBias":.45,"L.uTransl":.7,"L.uTranslTint":[.9,1.05,.5],"L.uTwigC":"#6a6a3a","L.uSnow":.55,"W.uSnow":.5}});
  const ctl=SeasonCtl(reg,table);const ud=group.userData;ud.kind="bamboo";ud.height=Hh;ud.culms=culms;ud.instanceCounts={culms:pts.length,leafHands:FB.m.length/16};
  return finishTree(group,{W,ctl,keys,reg,season:o.season});}

/* ============================================================================================== HAGI (bush clover) */
function makeHagi(opts){const o=Object.assign({height:1.3,width:1.8,seed:1,quality:"high",season:"autumn"},opts||{});
  const Q=QL(o.quality),rng=RNG("hagi|"+o.seed),brs=[],FB=InstBuf(),BB=InstBuf();const nSt=Math.max(8,Math.round(30*(Q.k==="low"?.5:Q.k==="medium"?.75:1)));
  for(let s=0;s<nSt;s++){const a=rng.r(0,TAU),r0=rng.r(0,.14),base=new V3(Math.cos(a)*r0,0,Math.sin(a)*r0),tilt=rng.r(.15,.65),out=new V3(Math.cos(a),0,Math.sin(a));
    const d=new V3(out.x*Math.sin(tilt),Math.cos(tilt),out.z*Math.sin(tilt)),len=o.height*rng.r(1.0,1.6),b=Br(1);b.phB=rng.r(0,TAU);
    growBr(b,base,d,len,8,rng.r(.004,.006),.0015,(dd,t)=>{dd.addScaledVector(out,.05);dd.y-=.09*t*t*(o.width/1.8);},0,.9/len);b.radial=Q.k==="low"?3:4;brs.push(b);
    const nTw=Math.round(rng.i(4,7)*(Q.k==="low"?.6:1));
    for(let k=0;k<nTw;k++){const t=rng.r(.35,.95),at=brAt(b,t),sd=rng.sg();const dd=at.d.clone().applyAxisAngle(UP,sd*rng.r(.5,1.1));dd.y-=.2;dd.normalize();
      const tw=Br(2);tw.phB=b.phB;growBr(tw,at.p,dd,rng.r(.12,.3),3,.0018,.001,(q,tt)=>{q.y-=.12*tt;},at.wb,.9);tw.radial=3;brs.push(tw);
      const tip=brAt(tw,1);addInst(BB,tip.p,tip.d.clone().add(new V3(0,-.6,0)),UP,rng.r(-.5,.5),.17,.2,.2,[rng.f(),0,rng.f(),rng.f()],[0,tip.wb+.3,0,b.phB],CELL.q2);}
    const nl=Math.round(rng.i(9,14)*(Q.k==="low"?.55:Q.k==="medium"?.8:1));
    for(let k=0;k<nl;k++){const t=rng.r(.2,1),at=brAt(b,t);const dd=at.d.clone().applyAxisAngle(UP,rng.sg()*rng.r(.6,1.4));dd.y=dd.y*.3+rng.r(-.2,.1);dd.normalize();
      const sz=rng.r(.17,.24)*(Q.k==="low"?1.3:1);addInst(FB,at.p,dd,new V3(rng.r(-.3,.3),1,rng.r(-.3,.3)),rng.r(-.4,.4),sz,sz,sz,[rng.f(),0,rng.f(),rng.f()],[0,at.wb+.3,0,b.phB],rng.f()<.7?CELL.h0:CELL.h1);}
    const end=brAt(b,1);addInst(BB,end.p,end.d,UP,rng.r(-.5,.5),.19,.22,.22,[rng.f(),0,rng.f(),rng.f()],[0,end.wb+.3,0,b.phB],CELL.q2);}
  crownShade(FB,{});crownShade(BB,{});
  const keys=[];const bark=texAcquire("maplebark",genMapleBark);keys.push("maplebark");const atlas=texAcquire("hagiatlas",genHagiAtlas);keys.push("hagiatlas");
  const fatl=texAcquire("floweratlas",genFlowerAtlas);keys.push("floweratlas");
  const W=windUniforms([0,.12,.4,1]),WS=woodUniforms();
  const geo=buildTubes(brs,{texU:.1,texV:.3,wT:()=>0,tint:()=>[.78,.62,.5]});
  const group=new T.Group();group.name="TsureHagi";group.add(woodMesh(geo,bark,W,WS,{ns:.5,rough:.8}));
  const FS=foliageUniforms(),BS=foliageUniforms();BS.uAOMin.value=.6;
  const leaves=makeInstanced(FB,cardGeo(2,2,.06,.04),foliageMaterial({map:atlas,rough:.6},W,FS),foliageDepth(atlas,W,FS),.3);leaves.name="leaves";group.add(leaves);
  const fl=makeInstanced(BB,cardGeo(2,2,.04,.02),foliageMaterial({map:fatl,mode:"tex",rough:.7},W,BS),foliageDepth(fatl,W,BS),.3);fl.name="flowers";group.add(fl);
  const reg={"W.uSnow":WS.uSnow,"W.uFoliage":WS.uFoliage};for(const n in FS)reg["L."+n]=FS[n];for(const n in BS)reg["F."+n]=BS[n];
  const table=tbl({
    spring:{"L.uPresence":.85,"L.uLeafScale":.6,"L.uC0":"#5f9436","L.uC1":"#80b047","L.uC2":"#9cc45a","L.uTipC":"#a8c060","L.uTipAmt":.2,"L.uSpread":.3,"L.uExpBias":.4,"L.uTransl":1,"L.uTranslTint":[1,1.15,.5],"L.uTwigC":"#6a5a3a","F.uPresence":0,"F.uLeafScale":1,"F.uTint":[1,1,1],"W.uSnow":0},
    summer:{"L.uPresence":1,"L.uLeafScale":1,"L.uC0":"#35561f","L.uC1":"#4c722b","L.uC2":"#668e36","L.uTipC":"#7a9a3a","L.uTipAmt":0,"L.uSpread":.3,"L.uExpBias":.45,"L.uTransl":.85,"L.uTranslTint":[.9,1.1,.45],"L.uTwigC":"#5a4a32","F.uPresence":0,"F.uLeafScale":1,"F.uTint":[1,1,1],"W.uSnow":0},
    autumn:{"L.uPresence":1,"L.uLeafScale":1,"L.uC0":"#46652a","L.uC1":"#6a8432","L.uC2":"#a2a142","L.uTipC":"#b09a40","L.uTipAmt":.25,"L.uSpread":.45,"L.uExpBias":.4,"L.uTransl":.95,"L.uTranslTint":[1.05,1.05,.5],"L.uTwigC":"#5a4a32","F.uPresence":1,"F.uLeafScale":1,"F.uTint":[1,1,1],"W.uSnow":0},
    winter:{"L.uPresence":0,"L.uLeafScale":1,"L.uC0":"#7a6a3a","L.uC1":"#8a7a40","L.uC2":"#9a8a48","L.uTipC":"#6a5a30","L.uTipAmt":.2,"L.uSpread":.4,"L.uExpBias":.4,"L.uTransl":.8,"L.uTranslTint":[1,1,.5],"L.uTwigC":"#5a4a32","F.uPresence":0,"F.uLeafScale":1,"F.uTint":[1,1,1],"W.uSnow":.4}});
  const ctl=SeasonCtl(reg,table);const ud=group.userData;ud.kind="hagi";ud.height=o.height;ud.instanceCounts={leaves:FB.m.length/16,flowerSprays:BB.m.length/16};
  return finishTree(group,{W,ctl,keys,reg,season:o.season});}

/* ============================================================================================== SHRUB (tsutsuji / generic evergreen) */
function makeShrub(opts){const o=Object.assign({kind:"generic",height:1.0,width:1.4,seed:1,quality:"high",season:"summer"},opts||{});
  const Q=QL(o.quality),rng=RNG("shrub|"+o.kind+"|"+o.seed),brs=[],FB=InstBuf(),BB=InstBuf(),azal=o.kind==="tsutsuji";
  const nSt=Math.max(6,Math.round(16*(Q.k==="low"?.5:1))),C=new V3(0,o.height*.52,0),Rr=new V3(o.width*.5,o.height*.5,o.width*.5);
  for(let s=0;s<nSt;s++){const a=rng.r(0,TAU),tilt=rng.r(.2,.8),out=new V3(Math.cos(a),0,Math.sin(a)),d=new V3(out.x*Math.sin(tilt),Math.cos(tilt),out.z*Math.sin(tilt)),b=Br(1);b.phB=rng.r(0,TAU);
    growBr(b,new V3(Math.cos(a)*.05,0,Math.sin(a)*.05),d,o.height*rng.r(.6,1.0),5,.012,.004,(dd)=>{dd.x+=rng.g()*.12;dd.z+=rng.g()*.12;},0,1);b.radial=Q.k==="low"?3:5;brs.push(b);
    for(let k=0;k<5;k++){const at=brAt(b,rng.r(.4,1)),dd=at.d.clone().add(rng.v(.9)).normalize(),tw=Br(2);tw.phB=b.phB;growBr(tw,at.p,dd,rng.r(.15,.35),2,.005,.002,null,at.wb,1);tw.radial=3;brs.push(tw);}}
  const nLeaf=Math.round((azal?520:620)*Q.n);
  for(let i=0;i<nLeaf;i++){const u=rng.v(1);if(u.y<-.3)u.y*=-.5;u.normalize();const rr=Math.pow(rng.f(),.35);const p=new V3(C.x+u.x*Rr.x*rr,C.y+u.y*Rr.y*rr,C.z+u.z*Rr.z*rr);if(p.y<.05)p.y=.05+rng.f()*.1;
    const dd=u.clone().add(rng.v(.6)).normalize();const sz=rng.r(.12,.17)*(Q.k==="low"?1.4:1);
    addInst(FB,p,dd,UP,rng.r(-.6,.6),sz,sz,sz,[rng.f(),0,rng.f(),rng.f()],[0,.5,0,rng.r(0,TAU)],rng.f()<.5?CELL.q0:CELL.q1);
    if(azal&&rr>.7&&rng.f()<.45)addInst(BB,p.clone().addScaledVector(u,.02),u,UP,rng.r(0,TAU),.11,.11,.11,[rng.f(),0,rng.f(),rng.f()],[0,.5,0,0],CELL.azalea);}
  crownShade(FB,{center:C});crownShade(BB,{center:C});
  const keys=[];const bark=texAcquire("maplebark",genMapleBark);keys.push("maplebark");const atlas=texAcquire("cherryatlas",genCherryLeafAtlas);keys.push("cherryatlas");
  const fatl=texAcquire("floweratlas",genFlowerAtlas);keys.push("floweratlas");const W=windUniforms([0,.05,.25,1]),WS=woodUniforms();
  const geo=buildTubes(brs,{texU:.1,texV:.2,wT:()=>0,tint:()=>[.7,.6,.5]});
  const group=new T.Group();group.name="TsureShrub";group.add(woodMesh(geo,bark,W,WS,{ns:.5}));
  const FS=foliageUniforms(),BS=foliageUniforms();FS.uCanopyN.value=.65;BS.uCanopyN.value=.5;
  const leaves=makeInstanced(FB,cardGeo(2,2,.08,.04),foliageMaterial({map:atlas,rough:.45},W,FS),foliageDepth(atlas,W,FS),.3);group.add(leaves);
  const meshes=[leaves];if(azal){const f=makeInstanced(BB,centeredCard(2,2,.05,.04),foliageMaterial({map:fatl,mode:"tex",rough:.7},W,BS),foliageDepth(fatl,W,BS),.3);group.add(f);meshes.push(f);}
  const reg={"W.uSnow":WS.uSnow};for(const n in FS)reg["L."+n]=FS[n];for(const n in BS)reg["F."+n]=BS[n];
  const ev=(c0,c1,c2,snow,fl)=>({"L.uPresence":1,"L.uLeafScale":1,"L.uC0":c0,"L.uC1":c1,"L.uC2":c2,"L.uTipC":c2,"L.uTipAmt":0,"L.uSpread":.3,"L.uExpBias":.5,"L.uTransl":.6,"L.uTranslTint":[.9,1.1,.5],"L.uTwigC":"#5a4a32","L.uSnow":snow,"W.uSnow":snow,"F.uPresence":fl,"F.uLeafScale":1,"F.uTint":[1,1,1],"F.uTransl":1,"F.uTranslTint":[1,.9,.8]});
  const table=tbl(azal?{spring:ev("#3e6224","#55802e","#6e9a3a",0,1),summer:ev("#2a461c","#3a5e24","#4c722c",0,0),autumn:ev("#4a3a1c","#6a3a1e","#8a4a22",0,0),winter:ev("#3a3a1e","#4a3a20","#5a4426",.6,0)}
    :{spring:ev("#2f4f1f","#43692a","#5a8434",0,0),summer:ev("#223d18","#305020","#41662a",0,0),autumn:ev("#263f19","#344f20","#46622a",0,0),winter:ev("#22381a","#2f4820","#3d5a28",.6,0)});
  const ctl=SeasonCtl(reg,table);group.userData.kind="shrub-"+o.kind;group.userData.height=o.height;group.userData.instanceCounts={leaves:FB.m.length/16,flowers:BB.m.length/16};
  return finishTree(group,{W,ctl,keys,reg,season:o.season});}

/* ============================================================================================== FALLING PARTICLES */
const GL_PART_V=`
attribute vec4 aP0;
attribute vec4 aP1;
attribute vec4 aP2;
attribute vec4 aLeaf;
attribute vec4 aAtlas;
uniform float uPT;
uniform vec3 uVol;
uniform vec2 uWVel;
uniform float uOnT;
uniform float uOffT;
uniform float uFade;
uniform float uRest;
uniform float uExpBias;
varying vec4 vTsPal;
varying vec3 vTsCN;
mat3 tsRot(vec3 a,float g){float c=cos(g),s=sin(g),t=1.0-c;
  return mat3(t*a.x*a.x+c,t*a.x*a.y+s*a.z,t*a.x*a.z-s*a.y, t*a.x*a.y-s*a.z,t*a.y*a.y+c,t*a.y*a.z+s*a.x, t*a.x*a.z+s*a.y,t*a.y*a.z-s*a.x,t*a.z*a.z+c);}`;
const GL_PART_CORE=`
float tsFall=uVol.y/aP0.w;
float tsCyc=tsFall+uRest*(0.6+0.8*aLeaf.w);
float tsAge=mod(uPT+aP0.z*tsCyc,tsCyc);
float tsSpawn=uPT-tsAge;
float tsVis=step(uOnT,tsSpawn)*step(tsSpawn,uOffT)*smoothstep(aLeaf.z,aLeaf.z+0.12,uFade*1.12);
tsVis*=smoothstep(0.0,0.5,tsAge)*(1.0-smoothstep(tsCyc-0.7,tsCyc,tsAge));
float tsTT=min(tsAge,tsFall);
float tsRestK=step(tsFall,tsAge);
float tsPh=tsTT*aP1.x+aP0.z*6.2831;
vec3 tsC=vec3(aP0.x*uVol.x,max(0.012+aLeaf.w*0.01,uVol.y-tsTT*aP0.w),aP0.y*uVol.z);
vec3 tsAx=normalize(aP2.xyz);
vec3 tsSw=normalize(cross(tsAx,vec3(0.0,1.0,0.0))+vec3(1e-4));
tsC+=tsSw*sin(tsPh)*aP1.y+vec3(cos(tsPh*0.5),0.0,sin(tsPh*0.5))*aP1.y*0.35;
tsC.xz+=uWVel*tsTT*aP2.w;
tsC.x=(fract(tsC.x/uVol.x+0.5)-0.5)*uVol.x;
tsC.z=(fract(tsC.z/uVol.z+0.5)-0.5)*uVol.z;
mat3 tsR=tsRot(vec3(0.0,1.0,0.0),tsTT*0.6*aP1.z+aLeaf.w*6.2831)*tsRot(tsAx,sin(tsPh)*0.95+tsTT*aP1.z);
mat3 tsRest=tsRot(vec3(0.0,1.0,0.0),aLeaf.w*6.2831)*mat3(1.0,0.0,0.0, 0.0,0.0,-1.0, 0.0,1.0,0.0);
if(tsRestK>0.5)tsR=tsRest;
vTsPal=vec4(aLeaf.x,0.8,1.0,0.0);
vTsCN=normalMatrix*vec3(0.0,1.0,0.0);`;
function particleMaterial(kind,map,U,S){const snow=kind==="snow";
  const m=new T.MeshStandardMaterial({map,roughness:snow?1:.6,metalness:0,side:T.DoubleSide,transparent:snow,depthWrite:!snow,alphaTest:snow?.02:.4,alphaToCoverage:!snow});
  m.onBeforeCompile=(sh)=>{Object.assign(sh.uniforms,U,S);
    let vs=sh.vertexShader.replace("#include <common>","#include <common>\n"+GL_PART_V)
      .replace("#include <uv_vertex>",GL_UV_ATLAS)
      .replace("#include <beginnormal_vertex>",GL_PART_CORE+(snow?"\nvec3 objectNormal=vec3(0.0,1.0,0.0);":"\nvec3 objectNormal=tsR*normal;"))
      .replace("#include <defaultnormal_vertex>","vec3 transformedNormal=normalMatrix*objectNormal;")
      .replace("#include <begin_vertex>",snow?"vec3 transformed=vec3(0.0);":"vec3 transformed=tsR*(position*aP1.w*tsVis);")
      .replace("#include <project_vertex>",snow?`vec4 tsP=vec4(tsC,1.0);vec4 mvPosition=modelViewMatrix*tsP;mvPosition.xy+=position.xy*aP1.w*tsVis;gl_Position=projectionMatrix*mvPosition;`
        :`vec4 tsP=vec4(transformed+tsC,1.0);vec4 mvPosition=modelViewMatrix*tsP;gl_Position=projectionMatrix*mvPosition;`)
      .replace("#include <worldpos_vertex>",`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP )
vec4 worldPosition=modelMatrix*tsP;
#endif`);
    sh.vertexShader=vs;
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\n"+GL_FOL_F)
      .replace("#include <map_fragment>",kind==="maple"?GL_FOL_MAP_PAL:"vec4 tsTx=mapTexelToLinear(texture2D(map,vUv));diffuseColor*=tsTx;diffuseColor.rgb*=uTint;")
      .replace("#include <normal_fragment_begin>",snow?"vec3 normal=normalize(vNormal);vec3 geometryNormal=normal;":GL_FOL_NORMAL)
      .replace("void main() {",GL_FOL_FN+"\nvoid main() {").replace("#include <lights_fragment_begin>",LFB_TRANSL)
      .replace("#include <lights_fragment_end>","#include <lights_fragment_end>\nreflectedLight.directSpecular*=uSpec;");};
  m.customProgramCacheKey=()=>"tsPart2"+kind;return m;}
function makeFallingParticles(opts){const o=Object.assign({kind:"maple",width:20,height:10,depth:20,quality:"high",active:true},opts||{});
  const kind=o.kind==="petals"||o.kind==="petal"||o.kind==="sakura"?"petals":o.kind==="snow"?"snow":"maple";const Q=QL(o.quality),rng=RNG("fall|"+kind+"|"+(o.seed||1));
  const area=o.width*o.depth/400*(o.height/10);const base=kind==="maple"?320:kind==="petals"?650:2600;
  const n=Math.max(8,Math.round(o.count||base*area*(Q.k==="low"?.35:Q.k==="medium"?.65:1)));
  const keys=[];let map,geo,atl;
  if(kind==="maple"){map=texAcquire("mapleatlas",genMapleAtlas);keys.push("mapleatlas");geo=centeredCard(3,3,.12,.06);atl=CELL.q3;}
  else if(kind==="petals"){map=texAcquire("floweratlas",genFlowerAtlas);keys.push("floweratlas");geo=centeredCard(2,2,.18,.05);atl=CELL.petal;}
  else{map=texAcquire("floweratlas",genFlowerAtlas);keys.push("floweratlas");geo=new T.PlaneGeometry(1,1);const u=geo.attributes.uv;for(let i=0;i<u.count;i++)u.setXY(i,u.getX(i),1-u.getY(i));atl=CELL.snow;}
  const a0=[],a1=[],a2=[],al=[],aa=[];
  for(let i=0;i<n;i++){const fs=kind==="maple"?rng.r(.9,1.6):kind==="petals"?rng.r(.55,1.0):rng.r(.55,1.05);
    a0.push(rng.r(-.5,.5),rng.r(-.5,.5),rng.f(),fs);
    const sz=kind==="maple"?rng.r(.055,.085):kind==="petals"?rng.r(.016,.022):rng.r(.012,.028);
    a1.push(kind==="snow"?rng.r(.4,1.0):rng.r(1.4,3.2),kind==="snow"?rng.r(.05,.25):rng.r(.12,.45),kind==="maple"?(rng.f()<.35?rng.r(2,5):rng.r(0,.6)):rng.r(1,4),sz);
    const ax=new V3(rng.r(-1,1),rng.r(-.25,.25),rng.r(-1,1)).normalize();a2.push(ax.x,ax.y,ax.z,rng.r(.6,1.0));
    al.push(rng.f(),0,rng.f(),rng.f());aa.push(...atl);}
  const g=geo.clone();geo.dispose();
  g.setAttribute("aP0",new T.InstancedBufferAttribute(new Float32Array(a0),4));g.setAttribute("aP1",new T.InstancedBufferAttribute(new Float32Array(a1),4));
  g.setAttribute("aP2",new T.InstancedBufferAttribute(new Float32Array(a2),4));g.setAttribute("aLeaf",new T.InstancedBufferAttribute(new Float32Array(al),4));
  g.setAttribute("aAtlas",new T.InstancedBufferAttribute(new Float32Array(aa),4));
  const U={uPT:{value:0},uVol:{value:new V3(o.width,o.height,o.depth)},uWVel:{value:new T.Vector2(0,0)},uOnT:{value:-1e6},uOffT:{value:o.active?1e9:-1e6},
    uFade:{value:o.active?1:0},uRest:{value:o.rest!=null?o.rest:(kind==="maple"?3:kind==="petals"?2:0)},uExpBias:{value:0}};
  const S=foliageUniforms();S.uCanopyN.value=.35;S.uTransl.value=kind==="snow"?0:1.1;
  const c=(k,h)=>S[k].value.fromArray(LIN(h));
  if(kind==="maple"){c("uC0","#e0a02a");c("uC1","#d9531a");c("uC2","#a8181a");c("uTipC","#7a1010");S.uTipAmt.value=.3;S.uSpread.value=.6;c("uTranslTint","#ffb070");c("uTwigC","#6a3020");}
  else if(kind==="petals"){S.uTranslTint.value.setRGB(1,.92,.94);}else{S.uTranslTint.value.setRGB(1,1,1);}
  const mat=particleMaterial(kind,map,U,S);const mesh=new T.InstancedMesh(g,mat,n);const id=new T.Matrix4();for(let i=0;i<n;i++)mesh.setMatrixAt(i,id);
  mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=kind!=="snow";mesh.renderOrder=kind==="snow"?2:0;mesh.name="falling-"+kind;
  const group=new T.Group();group.name="TsureFalling_"+kind;group.add(mesh);const ud=group.userData;let wx=0,wz=0,fadeT=o.active?1:0,act=!!o.active;
  ud.kind=kind;ud.count=n;ud.drawCalls=1;
  ud.setWind=(x,z)=>{wx=+x||0;wz=+z||0;};
  ud.setActive=(on,mode)=>{on=!!on;if(on===act)return;act=on;const t=U.uPT.value;
    if(mode==="natural"){if(on){U.uOnT.value=t;U.uOffT.value=1e9;fadeT=1;U.uFade.value=1;}else{U.uOffT.value=t;}}
    else{fadeT=on?1:0;if(on){if(U.uOffT.value<1e8){U.uOffT.value=1e9;U.uOnT.value=-1e6;}}}};
  ud.update=(dt)=>{dt=Math.min(.1,Math.max(0,+dt||0));U.uPT.value+=dt;const k=1-Math.exp(-dt/1.5);U.uWVel.value.x+=(wx-U.uWVel.value.x)*k;U.uWVel.value.y+=(wz-U.uWVel.value.y)*k;
    const f=U.uFade.value,ft=fadeT;U.uFade.value=f+clamp(ft-f,-dt/(o.fadeTime||1.2),dt/(o.fadeTime||1.2));};
  ud.isActive=()=>act;
  ud.dispose=()=>{g.dispose();mat.dispose();for(const k of keys)texRelease(k);keys.length=0;};
  return group;}

return{_gen:{genPineBark,genMapleBark,genCherryBark,genCulm,genMapleAtlas,genCherryLeafAtlas,genPineAtlas,genBambooAtlas,genHagiAtlas,genFlowerAtlas},makePine,makeMaple,makeCherry,makeBambooGrove,makeHagi,makeShrub,makeFallingParticles,
  SEASONS:["spring","earlysummer","summer","autumn","lateautumn","winter"],normSeason};
})();
