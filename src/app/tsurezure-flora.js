/* TSURE_FLORA — header placeholder */
const TSURE_FLORA=(()=>{
"use strict";
/* ------------------------------------------------------------------
   0. utilities (seeded RNG, value noise, blur, textures, geometry)
   ------------------------------------------------------------------ */
const T=THREE,V3=THREE.Vector3;
const PI=Math.PI,TAU=Math.PI*2;
const clamp=(x,a,b)=>x<a?a:(x>b?b:x);
const lerp=(a,b,t)=>a+(b-a)*t;
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const fract=x=>x-Math.floor(x);
function RNG(seed){let s=(seed>>>0)||0x9e3779b9;const f=()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
  f.r=(a,b)=>a+(b-a)*f();f.s=()=>f()*2-1;f.i=n=>Math.floor(f()*n);f.pick=a=>a[Math.floor(f()*a.length)];
  f.g=()=>{let u=0;for(let i=0;i<4;i++)u+=f();return (u-2)*0.866;};return f;}
function qlevel(o){const q=o&&o.quality;return q==="low"?0:(q==="medium"?1:2);}
const QS=(ql,lo,me,hi)=>ql===0?lo:(ql===1?me:hi);
/* integer hash -> [0,1) */
function h2(ix,iy,seed){let h=(Math.imul(ix|0,374761393)+Math.imul(iy|0,668265263)+Math.imul(seed|0,1274126177))|0;
  h=Math.imul(h^(h>>>13),1103515245);h^=h>>>16;h=Math.imul(h,2246822519|0);h^=h>>>13;return (h>>>0)/4294967296;}
/* value noise (optionally periodic in x with period px, in y with py) */
function vn(x,y,seed,px,py){const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
  let x0=ix,x1=ix+1,y0=iy,y1=iy+1;if(px){x0=((x0%px)+px)%px;x1=((x1%px)+px)%px;}if(py){y0=((y0%py)+py)%py;y1=((y1%py)+py)%py;}
  const a=h2(x0,y0,seed),b=h2(x1,y0,seed),c=h2(x0,y1,seed),d=h2(x1,y1,seed);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;}
function fbm(x,y,seed,oct,px,py){let s=0,a=.5,f=1,n=0;for(let i=0;i<oct;i++){s+=a*vn(x*f,y*f,seed+i*131,px?px*f:0,py?py*f:0);n+=a;a*=.5;f*=2;}return s/n;}
/* separable box blur (3 passes ~ gaussian) on a Float32Array with ch interleaved channels */
function blurF(a,w,h,ch,r,passes,wrapX){r=Math.max(1,Math.round(r));passes=passes||3;const tmp=new Float32Array(Math.max(w,h)*ch);
  for(let p=0;p<passes;p++){
    for(let y=0;y<h;y++){const o=y*w*ch;for(let c=0;c<ch;c++){let acc=0;const inv=1/(2*r+1);
        for(let k=-r;k<=r;k++){const xx=wrapX?((k%w)+w)%w:clamp(k,0,w-1);acc+=a[o+xx*ch+c];}
        for(let x=0;x<w;x++){tmp[x*ch+c]=acc*inv;const xa=wrapX?(((x-r)%w)+w)%w:clamp(x-r,0,w-1),xb=wrapX?(x+r+1)%w:clamp(x+r+1,0,w-1);acc+=a[o+xb*ch+c]-a[o+xa*ch+c];}}
      a.set(tmp.subarray(0,w*ch),o);}
    for(let x=0;x<w;x++){for(let c=0;c<ch;c++){let acc=0;const inv=1/(2*r+1);
        for(let k=-r;k<=r;k++){const yy=clamp(k,0,h-1);acc+=a[(yy*w+x)*ch+c];}
        for(let y=0;y<h;y++){tmp[y*ch+c]=acc*inv;const ya=clamp(y-r,0,h-1),yb=clamp(y+r+1,0,h-1);acc+=a[(yb*w+x)*ch+c]-a[(ya*w+x)*ch+c];}}
      for(let y=0;y<h;y++)for(let c=0;c<ch;c++)a[(y*w+x)*ch+c]=tmp[y*ch+c];}}
  return a;}
function mkCanvas(w,h){const c=document.createElement("canvas");c.width=w;c.height=h;return c;}
/* DataTexture from RGBA Uint8Array (row 0 = v 0) */
function dataTex(u8,w,h,o){o=o||{};const t=new T.DataTexture(u8,w,h,T.RGBAFormat,T.UnsignedByteType);
  t.encoding=o.srgb===false?T.LinearEncoding:T.sRGBEncoding;
  t.wrapS=o.wrapS||T.ClampToEdgeWrapping;t.wrapT=o.wrapT||T.ClampToEdgeWrapping;
  t.magFilter=T.LinearFilter;t.minFilter=o.mips===false?T.LinearFilter:T.LinearMipmapLinearFilter;t.generateMipmaps=o.mips!==false;
  t.anisotropy=o.aniso||4;t.needsUpdate=true;return t;}
/* canvas (top row = v 1) -> RGBA bytes with row 0 = v 0 */
function canvasBytes(cv){const w=cv.width,h=cv.height,d=cv.getContext("2d").getImageData(0,0,w,h).data,o=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)o.set(d.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);return o;}
/* height field (Float32, row 0 = v 0) -> tangent space normal map bytes */
function normalBytes(hf,w,h,strength,wrapX,wrapY){const o=new Uint8Array(w*h*4);
  const H=(x,y)=>{x=wrapX?((x%w)+w)%w:clamp(x,0,w-1);y=wrapY?((y%h)+h)%h:clamp(y,0,h-1);return hf[y*w+x];};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(H(x+1,y)-H(x-1,y))*strength,dy=(H(x,y+1)-H(x,y-1))*strength;
    const l=Math.hypot(dx,dy,1),i=(y*w+x)*4;o[i]=(-dx/l*.5+.5)*255;o[i+1]=(-dy/l*.5+.5)*255;o[i+2]=(1/l*.5+.5)*255;o[i+3]=255;}
  return o;}
const lin=hex=>new T.Color(hex).convertSRGBToLinear();
const rgbCss=(c,a)=>"rgba("+(c[0]|0)+","+(c[1]|0)+","+(c[2]|0)+","+(a===undefined?1:clamp(a,0,1)).toFixed(4)+")";
function hexRgb(h){if(typeof h==="string"){h=h.replace("#","");return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)];}
  return [(h>>16)&255,(h>>8)&255,h&255];}
const PROF={t:0,on:false,mark(l){if(!this.on)return;const n=performance.now();if(l)console.log("[test] prof "+l+" "+Math.round(n-this.t)+"ms");this.t=n;}};
if(typeof window!=="undefined"&&window.location&&/flprof=1/.test(window.location.search))PROF.on=true;
/* dispose tracker */
function Bag(){const s=new Set();return {add(o){if(o)s.add(o);return o;},dispose(){s.forEach(o=>{try{o.dispose&&o.dispose();}catch(e){}});s.clear();}};}
/* simple geometry builder */
function geo(attrs,index){const g=new T.BufferGeometry();for(const k in attrs){const a=attrs[k];g.setAttribute(k,new T.BufferAttribute(a.a instanceof Float32Array?a.a:new Float32Array(a.a),a.n));}
  if(index){const n=attrs.position.a.length/3;g.setIndex(new T.BufferAttribute(n>65535?new Uint32Array(index):new Uint16Array(index),1));}return g;}
/* merge non-instanced geometries that share the same attribute set */
function mergeGeo(list){const keys=Object.keys(list[0].attributes);let nv=0,ni=0;
  for(const g of list){nv+=g.attributes.position.count;ni+=g.index?g.index.count:g.attributes.position.count;}
  const out={},sz={};for(const k of keys){sz[k]=list[0].attributes[k].itemSize;out[k]=new Float32Array(nv*sz[k]);}
  const idx=nv>65535?new Uint32Array(ni):new Uint16Array(ni);let vo=0,io=0;
  for(const g of list){const c=g.attributes.position.count;for(const k of keys){const a=g.attributes[k];out[k].set(a.array.subarray(0,c*sz[k]),vo*sz[k]);}
    if(g.index){const ia=g.index.array;for(let i=0;i<ia.length;i++)idx[io+i]=ia[i]+vo;io+=ia.length;}else{for(let i=0;i<c;i++)idx[io+i]=vo+i;io+=c;}vo+=c;}
  const G=new T.BufferGeometry();for(const k of keys)G.setAttribute(k,new T.BufferAttribute(out[k],sz[k]));G.setIndex(new T.BufferAttribute(idx,1));
  for(const g of list)g.dispose();return G;}
/* rotate vector v (array or V3) about unit axis by angle -> new V3 */
const _q=new T.Quaternion();
function rotAxis(v,axis,ang){return v.clone().applyQuaternion(_q.setFromAxisAngle(axis,ang));}

/* ---------------- shared GLSL ---------------- */
const GLSL_NOISE=`
/* hashes stay stable far from the origin (scene zones sit ~2.4 km out): wrap, then a sine-free hash */
float flH1(float n){return fract(sin(mod(n,6283.18530718))*43758.5453123);}
float flH2(vec2 p){p=mod(p,4096.0);vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float flN2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  float a=flH2(i),b=flH2(i+vec2(1.0,0.0)),c=flH2(i+vec2(0.0,1.0)),d=flH2(i+vec2(1.0,1.0));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
vec3 flLin(vec3 c){return pow(max(c,vec3(0.0)),vec3(2.2));}
`;
const GLSL_OUT=`
#include <tonemapping_fragment>
#include <encodings_fragment>
`;
/* ------------------------------------------------------------------
   1. painted out-of-focus backdrops (bokeh)
      soft base = small painted+blurred texture; bokeh discs = crisp analytic instanced quads
      (a second small texture with the discs painted in is kept for refraction look-ups in drops)
   ------------------------------------------------------------------ */
const BOKEH_STYLES={
  meadowDawn:{
    grad:[[0,"#cfa182"],[.16,"#d9a670"],[.34,"#c08e4a"],[.5,"#94843c"],[.66,"#6a7230"],[.82,"#4c5a26"],[1,"#3a4820"]],
    blobs:["#e8b46e","#df9a6c","#b19a48","#7a8634","#46582a","#5c6a2e","#cc9058","#8f9a48"],
    sun:[.16,.14,.42,"#f7c27a"],disc:["#ffe2a8","#ffd08a","#ffeccc","#efe2b0","#ffcfa0","#ffdcb4"],
    band:[.28,.95],sunBias:.35,hex:.04,rim:.6,nd:70,shapes:"grass",bright:1},
  foliageSummer:{
    grad:[[0,"#bcd6d8"],[.14,"#a6c97a"],[.34,"#6a9a40"],[.56,"#3a6a2c"],[.8,"#22441c"],[1,"#142a12"]],
    blobs:["#cfe88e","#9ccb58","#5f9a3c","#2f6a2a","#1d401c","#e3f2f4","#eefbc4","#80b048"],
    sun:[.8,.1,.35,"#f4ffd8"],disc:["#f4fbff","#e2f4ff","#effccc","#fbffe8","#d8f2ff"],
    band:[.0,.85],sunBias:.25,hex:.2,rim:.35,nd:60,shapes:"foliage",bright:1},
  waterDusk:{
    grad:[[0,"#3a3624"],[.18,"#4c3f28"],[.34,"#7a5530"],[.48,"#a46a34"],[.6,"#7a4c28"],[.76,"#3a2e1e"],[1,"#17150f"]],
    blobs:["#ffa850","#e07e38","#ffc880","#3b4528","#232c1a","#6e5030","#c06c40","#1b2214"],
    sun:[.6,.36,.38,"#ffc47e"],disc:["#ffd27e","#ffb85c","#ffe2a8","#ffa24c","#ffecc4"],
    band:[.34,.74],sunBias:.3,hex:.15,rim:.4,nd:110,shapes:"water",bright:1.15},
  night:{
    grad:[[0,"#0b1224"],[.5,"#101a2e"],[1,"#05080f"]],
    blobs:["#1c2a48","#26385c","#0e1628","#2a2440"],
    sun:[.7,.15,.3,"#4a5a8a"],disc:["#b8c8ff","#dfe6ff","#9fb0e8"],
    band:[.1,.7],sunBias:.2,hex:.2,rim:.3,nd:24,shapes:"none",bright:.6}
};
function paintBokeh(o){
  const W=o.w,H=o.h,R=RNG((o.seed||7)*7919+13),st0=BOKEH_STYLES[o.style]||BOKEH_STYLES.meadowDawn;
  const st=Object.assign({},st0);if(o.sunPos)st.sun=[o.sunPos[0],o.sunPos[1],st0.sun[2],st0.sun[3]];
  const pal=(o.palette&&o.palette.length)?o.palette.map(c=>"#"+new T.Color(c).getHexString()):st.blobs;
  const cv=mkCanvas(W,H),x=cv.getContext("2d");
  const g=x.createLinearGradient(0,0,0,H);st.grad.forEach(s=>g.addColorStop(s[0],s[1]));x.fillStyle=g;x.fillRect(0,0,W,H);
  const blob=(cx,cy,r,col,a,mode)=>{x.globalCompositeOperation=mode||"source-over";const c=hexRgb(col);
    const gr=x.createRadialGradient(cx,cy,0,cx,cy,r);gr.addColorStop(0,rgbCss(c,a));gr.addColorStop(.5,rgbCss(c,a*.6));gr.addColorStop(1,rgbCss(c,0));
    x.fillStyle=gr;x.fillRect(cx-r,cy-r,2*r,2*r);x.globalCompositeOperation="source-over";};
  for(let i=0;i<30;i++){const cy=H*(st.band[0]+(st.band[1]-st.band[0])*R()*1.15-.12);blob(R()*W,cy,H*R.r(.12,.45),pal[i%pal.length],R.r(.12,.4));}
  const sx=st.sun[0]*W,sy=st.sun[1]*H;blob(sx,sy,H*st.sun[2]*1.9,st.sun[3],.28,"lighter");blob(sx,sy,H*st.sun[2]*.7,st.sun[3],.22,"lighter");
  x.lineCap="round";
  if(st.shapes==="grass"){
    for(let i=0;i<54;i++){const x0=R()*W*1.2-W*.1,y0=H*(1.05+R()*.1),len=H*R.r(.3,.95),ang=-PI/2+R.s()*.6,bend=R.s()*.5;
      const dark=R()<.68;x.strokeStyle=dark?rgbCss(hexRgb(R()<.5?"#26361a":"#3c5024"),R.r(.3,.6)):rgbCss(hexRgb(R()<.5?"#e0b868":"#c2b45a"),R.r(.2,.45));
      x.lineWidth=H*R.r(.01,.045);x.beginPath();x.moveTo(x0,y0);
      const x1=x0+Math.cos(ang)*len*.5,y1=y0+Math.sin(ang)*len*.5,x2=x0+Math.cos(ang+bend)*len,y2=y0+Math.sin(ang+bend)*len;
      x.quadraticCurveTo(x1,y1,x2,y2);x.stroke();}
    for(let i=0;i<8;i++)blob(R()*W,H*R.r(.6,1),H*R.r(.1,.24),R()<.5?"#1e2a12":"#2f4020",R.r(.3,.5));
  }else if(st.shapes==="foliage"){
    for(let i=0;i<80;i++){const cx=R()*W,cy=R()*H,rx=H*R.r(.03,.12),ry=rx*R.r(.35,.7),a=R()*PI;
      const c=hexRgb(R.pick(["#1d401c","#2f6a2a","#4f8a35","#89bd4f","#c8e67e","#12280f","#3a7a2c"]));
      x.save();x.translate(cx,cy);x.rotate(a);x.fillStyle=rgbCss(c,R.r(.35,.75));x.beginPath();x.ellipse(0,0,rx,ry,0,0,TAU);x.fill();x.restore();}
    for(let i=0;i<10;i++)blob(R()*W,R()*H*.6,H*R.r(.04,.12),"#e8f6fa",R.r(.35,.65),"lighter");
  }else if(st.shapes==="water"){
    for(let i=0;i<28;i++){const cx=R()*W,cy=H*R.r(-.05,.3),r=H*R.r(.06,.2);blob(cx,cy,r,R()<.6?"#141c10":"#26341c",R.r(.55,.9));}
    for(let i=0;i<6;i++)blob(R()*W,H*R.r(.02,.22),H*R.r(.04,.09),R()<.5?"#d98a58":"#eab076",R.r(.25,.5),"lighter");
    for(let i=0;i<46;i++){const cy=H*R.r(st.band[0],st.band[1]),cx=R()*W,ww=W*R.r(.06,.3),hh=H*R.r(.005,.02);
      x.fillStyle=rgbCss(hexRgb(R.pick(["#ffb460","#e08838","#ffd08c","#9a5a28"])),R.r(.15,.4));x.beginPath();x.ellipse(cx,cy,ww,hh,0,0,TAU);x.fill();}
    for(let i=0;i<10;i++)blob(R()*W,H*R.r(.82,1.0),H*R.r(.1,.25),"#100f0a",R.r(.4,.7));
  }
  /* blur */
  const fb=new Float32Array(W*H*3);{const d=x.getImageData(0,0,W,H).data;for(let i=0,j=0;i<d.length;i+=4,j+=3){fb[j]=d[i];fb[j+1]=d[i+1];fb[j+2]=d[i+2];}}
  blurF(fb,W,H,3,Math.max(2,H*.03),3);
  /* discs (uv: x right, y up; radius in units of H) */
  const discs=[],nd=o.highlights!==undefined?o.highlights:st.nd,rot=R()*PI;
  for(let i=0;i<nd;i++){
    const z=R();const r=z<.5?R.r(.007,.018):(z<.88?R.r(.018,.04):R.r(.04,.075));
    let cx,cy;if(R()<st.sunBias){const a=R()*TAU,d=Math.sqrt(R())*st.sun[2]*1.3;cx=st.sun[0]+Math.cos(a)*d*H/W*1.6;cy=st.sun[1]+Math.abs(Math.sin(a))*d*.8+.1;}
    else{cx=R();cy=st.band[0]+(st.band[1]-st.band[0])*Math.pow(R(),.8);}
    const c=hexRgb(st.disc[R.i(st.disc.length)]);const big=r>.045;
    const br=R();discs.push({x:cx,y:1-cy,r,c:[c[0]/255,c[1]/255,c[2]/255],a:(br<.75?R.r(.1,.3):R.r(.3,.65))*(big?.5:1)*st.bright,rim:R()<st.rim?R.r(.4,1):0,hex:R()<st.hex?1:0,rot,ph:R()*TAU});}
  for(let i=0;i<nd*1.4;i++){const c=hexRgb(st.disc[R.i(st.disc.length)]);
    discs.push({x:R(),y:1-(st.band[0]+(st.band[1]-st.band[0])*R()),r:R.r(.003,.0075),c:[c[0]/255,c[1]/255,c[2]/255],a:R.r(.12,.45)*st.bright,rim:0,hex:0,rot,ph:R()*TAU});}
  /* bytes: base (no discs) and full (discs painted in, HDR glow in alpha) */
  const base=new Uint8Array(W*H*4),full=new Uint8Array(W*H*4),glow=new Float32Array(W*H),add=new Float32Array(W*H*3);
  for(const d of discs){const cx=d.x*W,cy=d.y*H,rr=d.r*H+1.5;const x0=Math.max(0,Math.floor(cx-rr)),x1=Math.min(W-1,Math.ceil(cx+rr)),y0=Math.max(0,Math.floor(cy-rr)),y1=Math.min(H-1,Math.ceil(cy+rr));
    for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++){const dd=Math.hypot(xx+.5-cx,yy+.5-cy)/(d.r*H);if(dd>1.05)continue;
      const a=d.a*clamp((1.05-dd)/.12,0,1)*(.75+.35*d.rim*sstep(.7,.97,dd)),k=yy*W+xx;
      add[k*3]+=d.c[0]*a*255;add[k*3+1]+=d.c[1]*a*255;add[k*3+2]+=d.c[2]*a*255;glow[k]+=a;}}
  let sr=0,sg=0,sb=0,tr=0,tg=0,tb=0,mr=0,mg=0,mb=0;
  for(let y=0;y<H;y++){const sy=(H-1-y);for(let xx=0;xx<W;xx++){const s=(sy*W+xx)*3,k=y*W+xx,o4=k*4,n=(h2(xx,y,77)-.5)*1.6;
      const r=fb[s],gg=fb[s+1],b=fb[s+2];base[o4]=clamp(r+n,0,255);base[o4+1]=clamp(gg+n,0,255);base[o4+2]=clamp(b+n,0,255);base[o4+3]=0;
      full[o4]=clamp(r+add[k*3]+n,0,255);full[o4+1]=clamp(gg+add[k*3+1]+n,0,255);full[o4+2]=clamp(b+add[k*3+2]+n,0,255);full[o4+3]=clamp(glow[k]*255,0,255);
      if(y>H*.88){tr+=r;tg+=gg;tb+=b;}else if(y<H*.12){sr+=r;sg+=gg;sb+=b;}else if(y>H*.4&&y<H*.6){mr+=r;mg+=gg;mb+=b;}}}
  const nS=W*Math.floor(H*.12)||1,nM=W*Math.floor(H*.2)||1;
  return {w:W,h:H,base,full,discs,top:[tr/nS/255,tg/nS/255,tb/nS/255],bottom:[sr/nS/255,sg/nS/255,sb/nS/255],mid:[mr/nM/255,mg/nM/255,mb/nM/255]};
}
/* shader for the soft base: sRGB decode, gain/tint */
function bokehMaterial(tex,o){o=o||{};
  return new T.ShaderMaterial({uniforms:{map:{value:tex},uGain:{value:o.gain||1},uGlow:{value:o.glow!==undefined?o.glow:3.0},uTint:{value:new T.Color(1,1,1)},uTime:{value:0}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform sampler2D map;uniform float uGain,uGlow,uTime;uniform vec3 uTint;varying vec2 vUv;
      void main(){vec4 t=texture2D(map,vUv);vec3 c=pow(t.rgb,vec3(2.2))*uGain*uTint;gl_FragColor=vec4(c,1.0);
      ${GLSL_OUT}}`,fog:false,depthWrite:true});}
/* crisp bokeh discs: circle/hexagon aperture, bright rim, faint onion rings, cat's-eye vignetting, slow shimmer */
function bokehDiscMaterial(o){o=o||{};
  return new T.ShaderMaterial({uniforms:{uGain:{value:o.gain||1},uTint:{value:new T.Color(1,1,1)},uTime:{value:0},uTwinkle:{value:o.twinkle!==undefined?o.twinkle:.18}},
    transparent:true,depthWrite:false,fog:false,extensions:{derivatives:true},blending:T.CustomBlending,blendEquation:T.AddEquation,blendSrc:T.OneMinusDstColorFactor,blendDst:T.OneFactor,
    vertexShader:`attribute vec4 aDc;attribute vec4 aDs;uniform float uTime,uTwinkle;varying vec2 vQ;varying vec4 vC;varying vec4 vS;
      void main(){vQ=position.xy*2.0;float tw=1.0+uTwinkle*sin(uTime*(0.6+fract(aDs.w*7.3)*1.4)+aDs.w);vC=vec4(aDc.rgb,aDc.a*tw);vS=aDs;
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float uGain;uniform vec3 uTint;varying vec2 vQ;varying vec4 vC;varying vec4 vS;
      void main(){vec2 q=vQ;float c=cos(vS.z),s=sin(vS.z);vec2 r=vec2(c*q.x-s*q.y,s*q.x+c*q.y);
        float dc=length(q);vec2 h=abs(r);float dh=max(h.x*0.866025+h.y*0.5,h.y)/0.866025;
        float d=mix(dc,dh,vS.y);
        /* cat's eye: clip by an offset circle pointing to the frame centre (encoded in instance rotation) */
        float w=max(fwidth(d)*1.2,0.025);
        float a=1.0-smoothstep(1.0-w,1.0,d);
        float rim=1.0+vS.x*1.1*smoothstep(0.78,0.985,d)+0.012*sin(d*31.0);
        float core=mix(0.86+0.14*smoothstep(0.0,0.8,d),0.55+0.45*smoothstep(0.2,0.9,d),vS.x);
        vec3 col=pow(vC.rgb,vec3(2.2))*vC.a*a*rim*core*uGain*uTint;
        gl_FragColor=vec4(col,1.0);
        ${GLSL_OUT}
        gl_FragColor.rgb*=a;}`});}
function makeBokehBackdrop(opts){opts=opts||{};
  const ql=qlevel(opts),bag=Bag(),width=opts.width||1,height=opts.height||.5;
  const W=opts.texWidth||QS(ql,256,512,512),Hh=Math.round(W*height/width/2)*2||W/2;
  const p=paintBokeh({w:W,h:Hh,style:opts.style||"meadowDawn",palette:opts.palette,highlights:opts.highlights,seed:opts.seed||1,sunPos:opts.sunPos});
  const tex=bag.add(dataTex(p.base,p.w,p.h,{srgb:true})),texFull=bag.add(dataTex(p.full,p.w,p.h,{srgb:true,mips:false}));
  const mat=bag.add(bokehMaterial(tex,opts));
  const m=new T.Mesh(bag.add(new T.PlaneGeometry(width,height)),mat);m.name="flora_bokeh_backdrop";m.castShadow=false;m.receiveShadow=false;m.renderOrder=-10;
  /* discs */
  const n=p.discs.length,dg=bag.add(new T.PlaneGeometry(1,1)),dm=bag.add(bokehDiscMaterial(opts));
  const im=new T.InstancedMesh(dg,dm,n);const aDc=new Float32Array(n*4),aDs=new Float32Array(n*4),M=new T.Matrix4();
  p.discs.forEach((d,i)=>{const rr=d.r*height*2;M.makeScale(rr,rr,1);M.setPosition((d.x-.5)*width,(d.y-.5)*height,height*.0015);im.setMatrixAt(i,M);
    aDc.set([d.c[0],d.c[1],d.c[2],d.a*(opts.discGain||1)],i*4);aDs.set([d.rim,d.hex,d.rot,d.ph],i*4);});
  im.geometry=bag.add(new T.InstancedBufferGeometry().copy(dg));im.geometry.setAttribute("aDc",new T.InstancedBufferAttribute(aDc,4));im.geometry.setAttribute("aDs",new T.InstancedBufferAttribute(aDs,4));
  im.frustumCulled=false;im.renderOrder=-9;im.castShadow=im.receiveShadow=false;m.add(im);
  m.userData.texture=texFull;m.userData.baseTexture=tex;m.userData.size=[width,height];m.userData.discs=im;
  m.userData.colors={top:p.top,mid:p.mid,bottom:p.bottom};
  m.userData.setExposure=(g)=>{mat.uniforms.uGain.value=g;dm.uniforms.uGain.value=g;};
  m.userData.setTint=(r,g,b)=>{mat.uniforms.uTint.value.setRGB(r,g,b);dm.uniforms.uTint.value.setRGB(r,g,b);};
  m.userData.update=(dt,t)=>{dm.uniforms.uTime.value=t||0;};
  m.userData.dispose=()=>bag.dispose();
  return m;
}
/* ------------------------------------------------------------------
   2. macro-set machinery (studio lighting, blades, drops, decals, sprites)
   ------------------------------------------------------------------ */
/* lighting rig shared by every material of one macro set (uniform objects are shared, so one update drives all) */
function macroRig(o){
  return {
    uSunDir:{value:new V3(0,1,0)},uSunCol:{value:lin(o.sunCol||0xffd29a)},uSunI:{value:o.sunI!==undefined?o.sunI:3},
    uFillDir:{value:new V3(0,1,0)},uFillCol:{value:lin(o.fillCol||0xd8e6ff)},uFillI:{value:o.fillI!==undefined?o.fillI:.7},
    uSkyCol:{value:lin(o.sky||0xd9c7b0)},uHorCol:{value:lin(o.hor||0xc6a874)},uGndCol:{value:lin(o.gnd||0x2c3a1e)},uAmbI:{value:o.ambI!==undefined?o.ambI:1},
    uTime:{value:0},uEvap:{value:0},
    uBack:{value:null},uBackInv:{value:new T.Matrix4()},uBackSize:{value:new T.Vector2(1,1)},uBackGain:{value:1},uBackGlow:{value:3.2}
  };
}
const GLSL_RIG=`
uniform vec3 uSunDir,uSunCol,uFillDir,uFillCol,uSkyCol,uHorCol,uGndCol;
uniform float uSunI,uFillI,uAmbI,uTime;
vec3 mEnv(vec3 d){
  float y=d.y;
  vec3 c=y>0.0?mix(uHorCol,uSkyCol,pow(clamp(y,0.0,1.0),0.6)):mix(uHorCol*0.5,uGndCol,clamp(-y*2.5,0.0,1.0));
  float s=max(dot(d,uSunDir),0.0);
  c+=uSunCol*uSunI*(pow(s,8.0)*0.30+pow(s,60.0)*1.1);
  float f=max(dot(d,uFillDir),0.0);
  c+=uFillCol*uFillI*(smoothstep(0.82,0.97,f)*1.6+f*f*0.15);
  return c*uAmbI;
}`;
const GLSL_BACK=`
uniform sampler2D uBack;uniform mat4 uBackInv;uniform vec2 uBackSize;uniform float uBackGain,uBackGlow;
vec3 mBackTex(vec2 uv){vec4 t=texture2D(uBack,uv);return pow(t.rgb,vec3(2.2))*uBackGain*(1.0+t.a*t.a*uBackGlow);}
/* seamless: exact plane projection near the axis, stereographic beyond (never a hard switch) */
vec3 mBack(vec3 p,vec3 d){
  vec3 lp=(uBackInv*vec4(p,1.0)).xyz;vec3 ld=normalize((uBackInv*vec4(d,0.0)).xyz);
  vec2 q=lp.xy+2.0*ld.xy/max(1.0-ld.z,0.02)*lp.z;vec2 uv=q/uBackSize+0.5;
  return mBackTex(clamp(uv,0.003,0.997));
}`;
/* attach a backdrop mesh to the rig (its inverse world matrix is refreshed before every render) */
function rigBindBackdrop(U,bd,envK){U.uBack.value=bd.userData.texture;U.uBackSize.value.set(bd.userData.size[0],bd.userData.size[1]);
  U.uBackGain.value=bd.material.uniforms.uGain.value;U.uBackGlow.value=bd.material.uniforms.uGlow.value;
  if(envK){const c=bd.userData.colors,f=a=>new T.Color(a[0],a[1],a[2]).convertSRGBToLinear();
    U.uSkyCol.value.copy(f(c.top)).multiplyScalar(envK[0]);U.uHorCol.value.copy(f(c.mid)).multiplyScalar(envK[1]);U.uGndCol.value.copy(f(c.bottom)).multiplyScalar(envK[2]);}}
function rigRefresh(U,root,bd,sunLocal,fillLocal){root.updateMatrixWorld();
  U.uSunDir.value.copy(sunLocal).transformDirection(root.matrixWorld);U.uFillDir.value.copy(fillLocal).transformDirection(root.matrixWorld);
  if(bd)U.uBackInv.value.copy(bd.matrixWorld).invert();}

/* ---------- blade with thickness, fold, midrib groove, serrated margins ---------- */
function buildBlade(o){
  const pts=o.pts.map(p=>new V3(p[0],p[1],p[2]));const curve=new T.CatmullRomCurve3(pts,false,"centripetal",.5);
  const N=o.segs,nu=o.nu||9,P=curve.getSpacedPoints(N),len=curve.getLength();
  const Tg=[],Nm=[],Ax=[];
  for(let i=0;i<=N;i++){const a=P[Math.max(0,i-1)],b=P[Math.min(N,i+1)];Tg.push(b.clone().sub(a).normalize());}
  const up=new V3(...o.up).normalize();let n0=up.clone().sub(Tg[0].clone().multiplyScalar(up.dot(Tg[0]))).normalize();
  for(let i=0;i<=N;i++){if(i>0){const q=new T.Quaternion().setFromUnitVectors(Tg[i-1],Tg[i]);n0=n0.clone().applyQuaternion(q);
      n0.sub(Tg[i].clone().multiplyScalar(n0.dot(Tg[i]))).normalize();}
    const s=i/N,tw=o.twist?o.twist(s):0;const n=rotAxis(n0,Tg[i],tw);Nm.push(n);Ax.push(new V3().crossVectors(n,Tg[i]).normalize());}
  const W=s=>o.width(s),fold=o.fold||0,cup=o.cup||0,grv=o.groove||0,gw=o.grooveW||.09;
  const TH=(s,u)=>o.thick?o.thick(s,u):.00022*(1-.55*u*u);
  const hOf=(s,u)=>{const w=W(s)*.5;return Math.abs(u)*w*Math.tan(fold)+cup*u*u*(w/.003)-grv*Math.exp(-(u/gw)*(u/gw))*Math.min(1,w/.0015);};
  const serr=o.serr,ser=(s,side)=>{if(!serr)return 0;const x=s*len/serr.period+(side>0?.37:0);const f=fract(x);return serr.amp*(f<.78?f/.78:(1-f)/.22)*sstep(.0,.08,s)*sstep(1,.93,s);};
  const frame=(s)=>{const fi=clamp(s,0,1)*N,i0=Math.min(N-1,Math.floor(fi)),f=fi-i0;
    return {p:P[i0].clone().lerp(P[i0+1],f),t:Tg[i0].clone().lerp(Tg[i0+1],f).normalize(),n:Nm[i0].clone().lerp(Nm[i0+1],f).normalize(),a:Ax[i0].clone().lerp(Ax[i0+1],f).normalize()};};
  const posAt=(s,u,top)=>{const F=frame(s),w=W(s)*.5;const p=F.p.clone().addScaledVector(F.a,u*w).addScaledVector(F.n,hOf(s,u));
    if(!top)p.addScaledVector(F.n,-TH(s,u));return p;};
  const surf=(s,u)=>{const e=1e-3,p=posAt(s,u,true),ps=posAt(Math.min(1,s+e),u,true).sub(posAt(Math.max(0,s-e),u,true)),pu=posAt(s,Math.min(1,u+e),true).sub(posAt(s,Math.max(-1,u-e),true));
    const n=new V3().crossVectors(ps,pu).normalize();const F=frame(s);if(n.dot(F.n)<0)n.negate();return {p,n,t:F.t,a:F.a,w:W(s)};};
  /* vertices */
  const pos=[],uv=[],tan=[],am=[],col=[],idx=[];const uvLen=o.uvLen||.05;
  const arc=[0];for(let i=1;i<=N;i++)arc.push(arc[i-1]+P[i].distanceTo(P[i-1]));
  const push=(p,u,v,t,s,side,au)=>{pos.push(p.x,p.y,p.z);uv.push(u,v);tan.push(t.x,t.y,t.z,1);am.push(s,side,au,0);col.push(1,1,1);};
  for(const top of [true,false]){const base=pos.length/3;
    for(let i=0;i<=N;i++){const s=i/N,F={p:P[i],t:Tg[i],n:Nm[i],a:Ax[i]},w=W(s)*.5;
      for(let j=0;j<nu;j++){const u=-1+2*j/(nu-1);let lat=u*w;if(j===0)lat-=ser(s,-1);if(j===nu-1)lat+=ser(s,1);
        const p=F.p.clone().addScaledVector(F.a,lat).addScaledVector(F.n,hOf(s,u));if(!top)p.addScaledVector(F.n,-TH(s,u));
        push(p,j/(nu-1),arc[i]/uvLen,F.t,s,top?0:1,Math.abs(u));}}
    for(let i=0;i<N;i++)for(let j=0;j<nu-1;j++){const a=base+i*nu+j,b=base+(i+1)*nu+j;if(top)idx.push(a,b,a+1,a+1,b,b+1);else idx.push(a,a+1,b,a+1,b+1,b);}}
  /* rounded margins */
  for(const side of [-1,1]){const base=pos.length/3,u=side;
    for(let i=0;i<=N;i++){const s=i/N,F={p:P[i],t:Tg[i],n:Nm[i],a:Ax[i]},w=W(s)*.5,th=TH(s,u),lat=u*w+side*ser(s,side);
      const pt=F.p.clone().addScaledVector(F.a,lat).addScaledVector(F.n,hOf(s,u));
      const pm=pt.clone().addScaledVector(F.a,side*th*.45).addScaledVector(F.n,-th*.5),pb=pt.clone().addScaledVector(F.n,-th);
      push(pt,side>0?1:0,arc[i]/uvLen,F.t,s,.5,1);push(pm,side>0?1:0,arc[i]/uvLen,F.t,s,.5,1);push(pb,side>0?1:0,arc[i]/uvLen,F.t,s,.5,1);}
    for(let i=0;i<N;i++)for(let k=0;k<2;k++){const a=base+i*3+k,b=base+(i+1)*3+k;if(side>0)idx.push(a,a+1,b,a+1,b+1,b);else idx.push(a,b,a+1,a+1,b,b+1);}}
  const g=geo({position:{a:pos,n:3},uv:{a:uv,n:2},aTan:{a:tan,n:4},aM:{a:am,n:4},aCol:{a:col,n:3}},idx);g.computeVertexNormals();
  return {geometry:g,surf,frame,len,curve,P,Tg,Nm,Ax};
}
/* procedural leaf-blade textures: albedo(sRGB)+thickness(A), and normal map */
function bladeTextures(kind,ql,seed){
  const R=RNG(seed||3),w=QS(ql,64,128,128),h=QS(ql,256,512,1024);
  const alb=new Uint8Array(w*h*4),hf=new Float32Array(w*h);
  const K={susuki:{base:[92,124,52],mid:[222,228,192],veins:16,midW:.075,yel:.22,rust:.5},
    grass:{base:[88,130,50],mid:[112,150,64],veins:11,midW:.04,yel:.12,rust:.15},
    broad:{base:[100,128,56],mid:[210,218,176],veins:20,midW:.065,yel:.3,rust:.8},
    seed:{base:[170,160,140],mid:[180,170,150],veins:3,midW:.0,yel:0,rust:0}}[kind]||{base:[96,128,56],mid:[226,232,196],veins:9,midW:.085,yel:.25,rust:.4};
  const vpos=[];for(let i=1;i<=K.veins;i++){const f=i/(K.veins+.6);vpos.push(f,i%4===0?.8:.35);}
  const rust=[];for(let i=0;i<K.rust*40;i++)rust.push([R(),R(),R.r(.004,.018),R.r(.3,1)]);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=(x+.5)/w,v=(y+.5)/h,au=Math.abs(u*2-1);
    const mott=fbm(u*6,v*24,seed+5,4,0,24),streak=vn(u*w*.5,v*6,seed+9,0,6),fine=h2(x,y>>1,seed);
    let r=K.base[0],g=K.base[1],b=K.base[2];
    /* yellowish lengthwise streaks + mottling */
    const yl=K.yel*sstep(.45,.85,fbm(u*3,v*8,seed+21,3,0,8));r+=yl*70;g+=yl*40;b-=yl*10;
    const m=(mott-.5)*36;r+=m;g+=m*1.1;b+=m*.5;
    /* veins: thin lighter lines */
    let vein=0;for(let k=0;k<vpos.length;k+=2){const d=Math.abs(au-vpos[k])*w*.5;vein=Math.max(vein,vpos[k+1]*Math.exp(-d*d*2.2));}
    /* midrib */
    const mr=K.midW>0?sstep(K.midW,K.midW*.55,au):0;
    r=lerp(r,K.mid[0],mr*.92)+vein*8;g=lerp(g,K.mid[1],mr*.92)+vein*10;b=lerp(b,K.mid[2],mr*.92)+vein*5;
    /* margin slightly paler/yellower (thinner tissue) */
    const mg=sstep(.9,1,au);r+=mg*14;g+=mg*9;
    /* stomatal rows / micro-speckle */
    const sp=(streak-.5)*6+(fine-.5)*5;r+=sp;g+=sp;b+=sp*.6;
    const i=(y*w+x)*4;alb[i]=clamp(r,0,255);alb[i+1]=clamp(g,0,255);alb[i+2]=clamp(b,0,255);
    alb[i+3]=clamp((.5+vein*.35+mr*.45-mg*.25)*255,0,255);
    hf[y*w+x]=vein*.45+mr*(K.midW>0?.5:0)-sstep(K.midW*.5,0,au)*.35+(streak-.5)*.12+(fine-.5)*.05;}
  /* rust flecks (autumn leaf spots), stamped per spot (round in pixel space, radius q[2]*h/4 px) */
  for(const q of rust){const rp=Math.max(1,q[2]*h/4),cx=q[0]*w,cy=q[1]*h,ext=Math.ceil(rp*1.7);
    for(let yy=Math.floor(cy)-ext;yy<=Math.ceil(cy)+ext;yy++)for(let xx=Math.max(0,Math.floor(cx)-ext);xx<=Math.min(w-1,Math.ceil(cx)+ext);xx++){
      const y2=((yy%h)+h)%h,d=Math.hypot(xx+.5-cx,yy+.5-cy)/rp;if(d>1.6)continue;const k=sstep(1.6,.4,d)*q[3]*.65,i=(y2*w+xx)*4;
      alb[i]=lerp(alb[i],128,k);alb[i+1]=lerp(alb[i+1],82,k);alb[i+2]=lerp(alb[i+2],40,k);}}
  const nb=normalBytes(hf,w,h,.9,false,true);
  return {map:dataTex(alb,w,h,{srgb:true,wrapT:T.RepeatWrapping}),nrm:dataTex(nb,w,h,{srgb:false,wrapT:T.RepeatWrapping})};
}
/* lit, translucent macro surface (blades, stems, leaves) */
function surfMaterial(U,o){
  const uni=Object.assign({},U,{uMap:{value:o.map},uNrm:{value:o.nrm},uTint:{value:o.tint||new T.Color(1,1,1)},uTransCol:{value:o.transCol||lin(0xc8e060)},
    uHaze:{value:o.haze||0},uHazeCol:{value:o.hazeCol||lin(0x9a8a50)},uShin:{value:o.shin||70},uSpecK:{value:o.specK!==undefined?o.specK:1},uNrmK:{value:o.nrmK||1},uTransK:{value:o.transK!==undefined?o.transK:1},uTipCol:{value:o.tipCol||lin(0xb89a5a)},uTipK:{value:o.tipK||0}});
  return new T.ShaderMaterial({uniforms:uni,side:T.DoubleSide,fog:false,
    vertexShader:`attribute vec4 aTan;attribute vec4 aM;attribute vec3 aCol;
      varying vec3 vWP,vN,vT,vCol;varying vec2 vUv;varying vec4 vM;
      void main(){vec4 wp=modelMatrix*vec4(position,1.0);vWP=wp.xyz;vN=normalize(mat3(modelMatrix)*normal);vT=normalize(mat3(modelMatrix)*aTan.xyz);
        vUv=uv;vM=aM;vCol=aCol;gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader:`${GLSL_RIG}${GLSL_NOISE}
      uniform sampler2D uMap,uNrm;uniform vec3 uTint,uTransCol,uTipCol,uHazeCol;uniform float uShin,uSpecK,uNrmK,uTransK,uTipK,uHaze;
      varying vec3 vWP,vN,vT,vCol;varying vec2 vUv;varying vec4 vM;
      void main(){
        vec3 Ng=normalize(vN);vec3 V=normalize(cameraPosition-vWP);
        vec3 N=gl_FrontFacing?Ng:-Ng;
        vec3 Tg=normalize(vT-Ng*dot(vT,Ng));vec3 Ax=cross(Ng,Tg)*(vM.y>0.75?-1.0:1.0);
        vec3 tn=texture2D(uNrm,vUv).xyz*2.0-1.0;tn.xy*=uNrmK*(gl_FrontFacing?1.0:-1.0);
        vec3 Np=normalize(Ax*tn.x+Tg*tn.y+N*max(tn.z,0.2));
        vec4 tc=texture2D(uMap,vUv);vec3 alb=flLin(tc.rgb)*uTint*vCol;
        alb=mix(alb,uTipCol,uTipK*smoothstep(0.72,1.0,vM.x));
        float thick=tc.a;
        vec3 L=uSunDir;float NL=dot(Np,L),NLg=dot(N,L);
        vec3 col=alb*uSunCol*uSunI*max(NL,0.0)*smoothstep(-0.05,0.25,NLg)*0.95;
        col+=alb*mix(uGndCol,uSkyCol,Np.y*0.5+0.5)*uAmbI;
        col+=alb*uFillCol*uFillI*max(dot(Np,uFillDir),0.0)*0.6;
        float back=max(-NLg,0.0),fw=max(dot(-V,L),0.0);
        float edgeS=abs(vM.y-0.5)<0.1?1.0:0.0;
        /* diffuse transmission: saturated, darker than the front-lit face; veins (thick) block light */
        vec3 ta=mix(alb*alb*5.0,uTransCol,0.35)*(1.15-thick*0.9);
        col+=ta*uSunCol*uSunI*(back*0.5+pow(fw,5.0)*back*0.7)*uTransK*(1.0-edgeS*0.6);
        /* backlit rim: thin margins and the waxy surface scatter light forward -> glowing outline */
        float NV=max(dot(N,V),0.0);float marg=smoothstep(0.86,1.0,vM.z);
        float rimG=pow(fw,2.5)*(edgeS*1.4+marg*0.55+pow(1.0-NV,3.0)*0.5);
        col+=mix(uSunCol,vec3(1.0,0.95,0.8),0.3)*uSunI*rimG*0.55*uTransK;
        vec3 H=normalize(L+V);float NH=max(dot(Np,H),0.0),VH=max(dot(V,H),0.0);
        float fr=0.04+0.96*pow(1.0-VH,5.0);
        col+=uSunCol*uSunI*fr*(uShin+8.0)/25.0*pow(NH,uShin)*max(NL,0.0)*uSpecK;
        vec3 H2=normalize(uFillDir+V);col+=uFillCol*uFillI*fr*(uShin+8.0)/25.0*pow(max(dot(Np,H2),0.0),uShin)*0.5*uSpecK;
        float rim=pow(1.0-max(dot(N,V),0.0),4.0);col+=uSkyCol*uAmbI*rim*0.12;
        col=mix(col,uHazeCol,uHaze);
        gl_FragColor=vec4(col,1.0);
        ${GLSL_OUT}}`});
}
/* ---------- water drops ---------- */
function dropMaterial(U,o){o=o||{};
  const uni=Object.assign({},U,{uHC:{value:new V3()},uHR:{value:1},uHUp:{value:new V3(0,1,0)},uHCut:{value:-1e6},uHLeaf:{value:lin(0x6a8a3a)},
    uHaze:{value:o.haze||0},uHazeCol:{value:o.hazeCol||lin(0x9a8a50)},uLeafMap:{value:o.leafMap||null},uUvLen:{value:o.uvLen||.05},uLeafTint:{value:o.leafTint||new T.Color(1,1,1)},uTransCol2:{value:o.transCol||lin(0xc8e060)}});
  const defs={};if(o.dispersion)defs.DISPERSION=1;if(o.leafMap)defs.LEAFMAP=1;
  const m=new T.ShaderMaterial({uniforms:uni,fog:false,defines:defs,extensions:{derivatives:true},
    vertexShader:`
      #ifdef USE_INSTANCING
      attribute vec4 aDrop;attribute vec3 aLeaf;
      #endif
      uniform float uEvap;uniform vec3 uHC,uHUp,uHLeaf;uniform float uHR,uHCut;
      varying vec3 vWP,vN,vC,vUp,vLeaf,vX,vZ;varying float vR,vCut,vSeed;
      void main(){
      #ifdef USE_INSTANCING
        float k=clamp((aDrop.z-uEvap)/0.16,0.0,1.0);k=pow(k,0.45);
        vec3 cp=vec3(0.0,aDrop.x,0.0);vec3 p=cp+(position-cp)*k;
        mat4 M=modelMatrix*instanceMatrix;vec4 wp=M*vec4(p,1.0);
        vec3 cl=cp*(1.0-k);vC=(M*vec4(cl,1.0)).xyz;
        mat3 m3=mat3(M);vec3 sc=vec3(dot(m3[0],m3[0]),dot(m3[1],m3[1]),dot(m3[2],m3[2]));
        vN=normalize(m3*(normal/sc));vUp=normalize(m3[1]);vX=normalize(m3[0]);vZ=normalize(m3[2]);vR=sqrt(sc.x)*k;vCut=(aDrop.x-cl.y)*sqrt(sc.y);
        vLeaf=aLeaf;vSeed=aDrop.y;
        gl_Position=projectionMatrix*viewMatrix*wp;if(k<0.01)gl_Position=vec4(2.0,2.0,2.0,1.0);
      #else
        vec4 wp=modelMatrix*vec4(position,1.0);vC=uHC;vR=uHR;vUp=uHUp;vCut=uHCut;vLeaf=uHLeaf;vSeed=0.5;vX=vec3(1.0,0.0,0.0);vZ=vec3(0.0,0.0,1.0);
        vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*wp;
      #endif
        vWP=wp.xyz;}`,
    fragmentShader:`${GLSL_RIG}${GLSL_BACK}${GLSL_NOISE}
      uniform vec3 uTransCol2;
      varying vec3 vWP,vN,vC,vUp,vLeaf,vX,vZ;varying float vR,vCut,vSeed;
      uniform sampler2D uLeafMap;uniform float uUvLen,uHaze;uniform vec3 uLeafTint,uHazeCol;
      /* sun seen along d: tiny bright disc widened to the pixel footprint with energy conservation (no sub-pixel loss, no aliasing) */
      vec3 dSun(vec3 d,float fw){float s=clamp(dot(d,uSunDir),-1.0,1.0);float a2=max(1.0-s,0.0)*2.0;
        float th=max(0.022,fw*0.8);float spot=exp(-a2/(th*th))*(0.022*0.022)/(th*th);
        return uSunCol*uSunI*(spot*160.0+pow(max(s,0.0),60.0)*0.6+pow(max(s,0.0),8.0)*0.06);}
      vec3 leafSeen(vec3 PL){
        float nl=max(dot(vUp,uSunDir),0.0);
        vec3 Lt=uSunDir-vUp*dot(uSunDir,vUp);Lt=Lt/max(length(Lt),1e-5);
        vec3 Pc=vC+vUp*vCut;vec3 q=PL-(Pc-Lt*vR*0.55);
        float caus=exp(-dot(q,q)/(vR*vR*0.10));
        vec3 alb=vLeaf;
      #ifdef LEAFMAP
        /* the blade under the drop, magnified: vLeaf = (u at contact, v at contact, blade width) */
        vec2 luv=vec2(vLeaf.x+dot(PL-Pc,vZ)/max(vLeaf.z,1e-6),vLeaf.y+dot(PL-Pc,vX)/uUvLen);
        alb=flLin(texture2D(uLeafMap,luv).rgb)*uLeafTint;
      #endif
        float nls=dot(vUp,uSunDir);
        vec3 lit=alb*(mix(uGndCol,uSkyCol,0.5+0.5*vUp.y)*uAmbI+uSunCol*uSunI*max(nls,0.0)*0.7);
        lit+=mix(alb*1.15,uTransCol2,0.45)*0.6*uSunCol*uSunI*max(-nls,0.0)*0.75;
        return lit+alb*uSunCol*uSunI*caus*max(nls,0.0)*2.6;}
      vec3 through(vec3 P,vec3 N,vec3 V,float ior,out vec3 spk){
        spk=vec3(0.0);
        /* local ball-lens centre from the surface curvature (exact for spheres, sensible on the neck of a pendant) */
        vec3 Ce=P-N*vR;
        vec3 d1=refract(-V,N,1.0/ior);vec3 PC=P-Ce;float tch=max(-2.0*dot(d1,PC),0.0);vec3 P2=P+d1*tch;
        float h0=dot(P-vC,vUp),h2=dot(P2-vC,vUp);
        if(h2<vCut){float du=dot(d1,vUp);float tp=(vCut-h0)/min(du,-1e-5);return leafSeen(P+d1*tp);}
        vec3 N2=normalize(P2-Ce);vec3 d2=refract(d1,-N2,ior);
        if(dot(d2,d2)<0.01){return mBack(P2,reflect(d1,N2))*0.3;}
        float fw=length(fwidth(d2));
        vec3 c=mBack(P2,d2);spk=dSun(d2,fw);
        vec3 r2=reflect(d1,N2);float t3=max(-2.0*dot(r2,P2-Ce),0.0);vec3 P3=P2+r2*t3;
        if(dot(P3-vC,vUp)>vCut){vec3 N3=normalize(P3-Ce);vec3 d3=refract(r2,-N3,ior);if(dot(d3,d3)>0.01){spk+=dSun(d3,fw*2.0)*0.1;c+=mBack(P3,d3)*0.04;}}
        return c;}
      void main(){
        if(dot(vWP-vC,vUp)<vCut)discard;
        vec3 N=normalize(vN);vec3 V=normalize(cameraPosition-vWP);
        float NV=dot(N,V);if(NV<0.0){N=normalize(N-V*NV*1.02);NV=dot(N,V);}NV=clamp(NV,0.0,1.0);
        float F=0.02+0.98*pow(1.0-NV,5.0);
        vec3 R=reflect(-V,N);
        vec3 refl=mix(mEnv(R),mBack(vWP,R),0.7)+dSun(R,length(fwidth(R)))*0.6;
        vec3 spk,sR,sG,sB;
      #ifdef DISPERSION
        vec3 tr=vec3(through(vWP,N,V,1.329,sR).r,through(vWP,N,V,1.334,sG).g,through(vWP,N,V,1.341,sB).b);spk=vec3(sR.r,sG.g,sB.b);
      #else
        vec3 tr=through(vWP,N,V,1.333,spk);
      #endif
        vec3 col=tr*(1.0-F)+refl*F;
        float rf=max(dot(R,uFillDir),0.0);
        col+=uFillCol*uFillI*(pow(rf,500.0)*7.0+pow(rf,60.0)*0.45);
        col*=mix(0.1,1.0,smoothstep(0.02,0.5,NV));
        col+=spk*(1.0-F*0.6)*smoothstep(0.0,0.12,NV);
        col=mix(col,uHazeCol,uHaze);
        gl_FragColor=vec4(col,1.0);
        ${GLSL_OUT}}`});
  return m;
}
/* shadow + focused-light spot that a drop throws on the blade (premultiplied blend: out = caustic + dst*(1-shadow)) */
function decalMaterial(U){
  return new T.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,fog:false,
    blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:T.OneMinusSrcAlphaFactor,blendEquation:T.AddEquation,
    polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
    vertexShader:`attribute vec4 aDec;uniform float uEvap;varying vec2 vQ;varying float vK,vS;
      void main(){float k=clamp((aDec.z-uEvap)/0.16,0.0,1.0);vK=pow(k,0.45);vS=aDec.x;vQ=position.xy*2.0;
        vec3 p=position;p.xy*=vK;gl_Position=projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(p,1.0);if(vK<0.01)gl_Position=vec4(2.0,2.0,2.0,1.0);}`,
    fragmentShader:`${GLSL_RIG}varying vec2 vQ;varying float vK,vS;
      void main(){float e=dot(vQ,vQ);float sh=smoothstep(1.0,0.45,e)*0.55*vS;
        vec2 c=(vQ-vec2(0.4,0.0))/vec2(0.22,0.17);float spot=exp(-dot(c,c)*2.2);
        vec3 ca=uSunCol*uSunI*vec3(1.0,0.97,0.78)*spot*0.45*vS;
        gl_FragColor=vec4(ca,1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
        gl_FragColor=vec4(gl_FragColor.rgb*vK,sh*(1.0-spot*0.85)*vK);}`});
}
/* camera-facing additive sprites: soft bokeh discs (kind 0), glints/motes (kind 1) */
function spriteMaterial(U){
  return new T.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,fog:false,blending:T.AdditiveBlending,
    vertexShader:`uniform float uTime;attribute vec4 aSp;attribute vec4 aSc;varying vec2 vQ;varying vec4 vC;varying float vKind,vRim;
      void main(){mat4 M=modelMatrix*instanceMatrix;vec4 c=viewMatrix*M*vec4(0.0,0.0,0.0,1.0);float sz=length(mat3(M)[0]);
        float tw=0.5+0.5*sin(uTime*aSp.z+aSp.y);tw=mix(1.0,tw*tw*1.6,aSp.w);
        if(aSp.x>0.5){c.xyz+=vec3(sin(uTime*0.31+aSp.y*7.0),cos(uTime*0.23+aSp.y*3.0),0.0)*sz*1.4;}
        vC=vec4(aSc.rgb,aSc.a*tw);vKind=aSp.x;vRim=fract(aSp.y*13.7);vQ=position.xy*2.0;
        c.xy+=position.xy*sz;gl_Position=projectionMatrix*c;}`,
    fragmentShader:`varying vec2 vQ;varying vec4 vC;varying float vKind,vRim;
      void main(){float d=length(vQ);float a;
        if(vKind<0.5){a=smoothstep(1.0,0.9,d)*(0.62+0.38*smoothstep(0.55,0.93,d)*step(0.6,vRim));}
        else{a=exp(-d*d*6.0)+exp(-d*d*1.5)*0.12;}
        gl_FragColor=vec4(vC.rgb*vC.a*a,1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
        }`});
}
/* soft blurred foreground element (premultiplied RGBA texture) */
function blurPlaneTex(o){const w=o.w||256,h=o.h||128,R=RNG(o.seed||5),cv=mkCanvas(w,h),x=cv.getContext("2d");
  x.lineCap="round";
  for(const s of o.strokes){const c=hexRgb(s.col);x.strokeStyle=rgbCss(c,s.a||1);x.lineWidth=s.w*h;x.beginPath();
    x.moveTo(s.p[0]*w,s.p[1]*h);x.quadraticCurveTo(s.p[2]*w,s.p[3]*h,s.p[4]*w,s.p[5]*h);x.stroke();}
  for(const d of (o.discs||[])){const c=hexRgb(d.col),gr=x.createRadialGradient(d.x*w,d.y*h,0,d.x*w,d.y*h,d.r*h);
    gr.addColorStop(0,rgbCss(c,d.a*.8));gr.addColorStop(.85,rgbCss(c,d.a));gr.addColorStop(1,rgbCss(c,0));x.fillStyle=gr;x.beginPath();x.arc(d.x*w,d.y*h,d.r*h,0,TAU);x.fill();}
  const d=x.getImageData(0,0,w,h).data,f=new Float32Array(w*h*4);
  for(let i=0;i<w*h;i++){const px=(i%w+.5)/w,py=(Math.floor(i/w)+.5)/h,ef=sstep(0,.18,px)*sstep(0,.18,1-px)*sstep(0,.18,py)*sstep(0,.18,1-py);const a=d[i*4+3]/255*ef;f[i*4]=Math.pow(d[i*4]/255,2.2)*a;f[i*4+1]=Math.pow(d[i*4+1]/255,2.2)*a;f[i*4+2]=Math.pow(d[i*4+2]/255,2.2)*a;f[i*4+3]=a;}
  blurF(f,w,h,4,o.blur||h*.06,3);
  const u=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let xx=0;xx<w;xx++){const s=((h-1-y)*w+xx)*4,t=(y*w+xx)*4;
    for(let c=0;c<3;c++)u[t+c]=clamp(Math.pow(f[s+c],1/2.2)*255,0,255);u[t+3]=clamp(f[s+3]*255,0,255);}
  return dataTex(u,w,h,{srgb:true});}
function blurPlaneMaterial(tex,gain){
  return new T.ShaderMaterial({uniforms:{map:{value:tex},uGain:{value:gain||1}},transparent:true,depthWrite:false,fog:false,
    blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:T.OneMinusSrcAlphaFactor,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform sampler2D map;uniform float uGain;varying vec2 vUv;
      void main(){vec4 t=texture2D(map,vUv);gl_FragColor=vec4(pow(t.rgb,vec3(2.2))*uGain,1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
        gl_FragColor=vec4(gl_FragColor.rgb*t.a,t.a);}`});}
/* lathe with explicit normals (profile: array of [r,y], ordered bottom -> top) */
function latheGeo(prof,segs){const n=prof.length,pos=new Float32Array(n*(segs+1)*3),nor=new Float32Array(n*(segs+1)*3),uv=new Float32Array(n*(segs+1)*2),idx=[];
  const g=new T.BufferGeometry();g.setAttribute("position",new T.BufferAttribute(pos,3));g.setAttribute("normal",new T.BufferAttribute(nor,3));g.setAttribute("uv",new T.BufferAttribute(uv,2));
  for(let i=0;i<n-1;i++)for(let j=0;j<segs;j++){const a=i*(segs+1)+j,b=(i+1)*(segs+1)+j;idx.push(a,b,a+1,a+1,b,b+1);}
  g.setIndex(idx);g.userData.segs=segs;g.userData.n=n;latheUpdate(g,prof);return g;}
function latheUpdate(g,prof){const segs=g.userData.segs,n=g.userData.n,pos=g.attributes.position.array,nor=g.attributes.normal.array,uv=g.attributes.uv.array;
  for(let i=0;i<n;i++){const a=prof[Math.max(0,i-1)],b=prof[Math.min(n-1,i+1)];let dr=b[0]-a[0],dy=b[1]-a[1];const l=Math.hypot(dr,dy)||1;
    let nr=dy/l,ny=-dr/l;if(i===0&&prof[0][0]<1e-9){nr=0;ny=-1;}if(i===n-1&&prof[n-1][0]<1e-9){nr=0;ny=1;}
    for(let j=0;j<=segs;j++){const th=j/segs*TAU,c=Math.cos(th),s=Math.sin(th),k=(i*(segs+1)+j);
      pos[k*3]=prof[i][0]*c;pos[k*3+1]=prof[i][1];pos[k*3+2]=prof[i][0]*s;nor[k*3]=nr*c;nor[k*3+1]=ny;nor[k*3+2]=nr*s;uv[k*2]=j/segs;uv[k*2+1]=i/(n-1);}}
  g.attributes.position.needsUpdate=true;g.attributes.normal.needsUpdate=true;g.computeBoundingSphere();}

/* diffraction star for a sun sparkle (6 rays from a hexagonal aperture + soft core) */
function starMaterial(){
  return new T.ShaderMaterial({uniforms:{uCol:{value:new T.Color(1,.95,.85)},uI:{value:1},uRot:{value:0}},transparent:true,depthWrite:false,depthTest:true,fog:false,blending:T.AdditiveBlending,
    vertexShader:`varying vec2 vQ;void main(){vQ=position.xy*2.0;vec4 c=modelViewMatrix*vec4(0.0,0.0,0.0,1.0);float sz=length(modelMatrix[0].xyz);c.xy+=position.xy*sz;gl_Position=projectionMatrix*c;}`,
    fragmentShader:`uniform vec3 uCol;uniform float uI,uRot;varying vec2 vQ;
      void main(){float r=length(vQ);float a=atan(vQ.y,vQ.x)+uRot;
        float rays=pow(abs(cos(a*3.0)),180.0)*exp(-r*5.5)*0.9+pow(abs(cos(a*3.0+1.5708)),400.0)*exp(-r*9.0)*0.25;
        float core=exp(-r*r*900.0)*6.0+exp(-r*r*120.0)*0.8+exp(-r*r*14.0)*0.07;
        vec3 c=uCol*uI*(core+rays*(1.0-smoothstep(0.6,1.0,r)));
        gl_FragColor=vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`});}
/* locate the refracted-sun sparkle on a sphere (centre C, radius R) seen from E, sun direction L (all same space) */
function sparklePoint(C,R,E,L){const w=E.clone().sub(C).normalize(),up=Math.abs(w.y)<.95?new V3(0,1,0):new V3(1,0,0),u=new V3().crossVectors(up,w).normalize(),v=new V3().crossVectors(w,u);
  const P=new V3(),N=new V3(),I=new V3(),d1=new V3(),P2=new V3(),N2=new V3();
  const refr=(I,N,eta,out)=>{const d=N.dot(I),k=1-eta*eta*(1-d*d);if(k<0)return null;return out.copy(I).multiplyScalar(eta).addScaledVector(N,-(eta*d+Math.sqrt(k)));};
  const score=(x,y)=>{const zz=1-x*x-y*y;if(zz<=0)return -2;N.copy(u).multiplyScalar(x).addScaledVector(v,y).addScaledVector(w,Math.sqrt(zz));P.copy(C).addScaledVector(N,R);
    I.copy(P).sub(E).normalize();if(!refr(I,N,1/1.333,d1))return -2;const t=-2*R*d1.dot(N);P2.copy(P).addScaledVector(d1,t);N2.copy(P2).sub(C).normalize().negate();
    const d2=refr(d1,N2,1.333,new V3());if(!d2)return -2;return d2.normalize().dot(L);};
  let bx=0,by=0,bs=-3,step=.08;for(let y=-1;y<=1;y+=step)for(let x=-1;x<=1;x+=step){const s=score(x,y);if(s>bs){bs=s;bx=x;by=y;}}
  for(let k=0;k<3;k++){const st=step;step/=4;const cx=bx,cy=by;for(let y=cy-st;y<=cy+st;y+=step)for(let x=cx-st;x<=cx+st;x+=step){const s=score(x,y);if(s>bs){bs=s;bx=x;by=y;}}}
  const zz=Math.max(0,1-bx*bx-by*by);N.copy(u).multiplyScalar(bx).addScaledVector(v,by).addScaledVector(w,Math.sqrt(zz));
  return {p:C.clone().addScaledVector(N,R),cos:bs,edge:Math.hypot(bx,by)};}
/* ------------------------------------------------------------------
   3. makeDewMacroSet — dew on susuki/grass blades at sunrise (REAL scale, metres)
   ------------------------------------------------------------------ */
/* pendant (hanging) drop profile, y=0 at the attachment, bottom -> top. a: attachment 0..1 (0 = free drop) */
/* pendant (hanging) drop profile [r,y], bottom -> top, smooth everywhere.
   el: prolate stretch, neckL: neck length (pinch stretch), pinch 0..1 narrows the upper half into a neck. Origin = bulb centre. */
function pendantProfile(Rb,el,neckL,pinch,n){const out=[],ry=Rb*(1+el),rx=Rb*(1-el*.25);
  for(let i=0;i<=n;i++){const t=PI*i/n,s=Math.sin(t),c=Math.cos(t),up=sstep(PI*.45,PI,t);
    out.push([Math.max(0,rx*s*(1-pinch*up*up*.8)),-ry*c+neckL*up*up]);}
  out[0][0]=0;out[n][0]=0;return out;}
function tubeGeo(pts,radius,rs,o){o=o||{};const curve=new T.CatmullRomCurve3(pts.map(p=>p.isVector3?p:new V3(...p)),false,"centripetal");
  const n=o.segs||24,P=curve.getSpacedPoints(n),pos=[],uv=[],tan=[],am=[],col=[],idx=[];let nr=null;
  const c0=o.col0||[1,1,1],c1=o.col1||c0;
  for(let i=0;i<=n;i++){const s=i/n,t=P[Math.min(n,i+1)].clone().sub(P[Math.max(0,i-1)]).normalize();
    if(!nr){nr=Math.abs(t.y)<.9?new V3(0,1,0):new V3(1,0,0);nr.sub(t.clone().multiplyScalar(nr.dot(t))).normalize();}
    else{nr.sub(t.clone().multiplyScalar(nr.dot(t))).normalize();}
    const bn=new V3().crossVectors(t,nr),r=typeof radius==="function"?radius(s):radius;
    for(let j=0;j<=rs;j++){const a=j/rs*TAU,d=nr.clone().multiplyScalar(Math.cos(a)).addScaledVector(bn,Math.sin(a));
      const p=P[i].clone().addScaledVector(d,r);pos.push(p.x,p.y,p.z);uv.push(j/rs,s*(o.vRep||1));tan.push(t.x,t.y,t.z,1);am.push(s,0,0,0);
      col.push(lerp(c0[0],c1[0],s),lerp(c0[1],c1[1],s),lerp(c0[2],c1[2],s));}}
  for(let i=0;i<n;i++)for(let j=0;j<rs;j++){const a=i*(rs+1)+j,b=(i+1)*(rs+1)+j;idx.push(a,b,a+1,a+1,b,b+1);}
  const g=geo({position:{a:pos,n:3},uv:{a:uv,n:2},aTan:{a:tan,n:4},aM:{a:am,n:4},aCol:{a:col,n:3}},idx);g.computeVertexNormals();
  return {geometry:g,curve,P};}
/* spindle (spikelet) oriented along dir */
function spindleGeo(base,dir,len,rad,rs,ls,c0,c1){const prof=[];for(let i=0;i<=ls;i++){const t=i/ls;prof.push([rad*Math.pow(Math.sin(PI*Math.pow(t,.8)),.8)+1e-6,t*len]);}
  prof[0][0]=0;prof[ls][0]=0;const g=latheGeo(prof,rs);const q=new T.Quaternion().setFromUnitVectors(new V3(0,1,0),dir.clone().normalize());
  g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(q));g.translate(base.x,base.y,base.z);const n=g.attributes.position.count,tan=[],am=[],col=[];const d=dir.clone().normalize();
  for(let i=0;i<n;i++){const v=g.attributes.uv.array[i*2+1];tan.push(d.x,d.y,d.z,1);am.push(1,0,0,0);col.push(lerp(c0[0],c1[0],v),lerp(c0[1],c1[1],v),lerp(c0[2],c1[2],v));}
  g.setAttribute("aTan",new T.Float32BufferAttribute(tan,4));g.setAttribute("aM",new T.Float32BufferAttribute(am,4));g.setAttribute("aCol",new T.Float32BufferAttribute(col,3));return g;}
function setDropInstance(m,i,p,n,t,r,f,c){const X=t.clone().sub(n.clone().multiplyScalar(t.dot(n))).normalize(),Y=n.clone().normalize(),Z=new V3().crossVectors(X,Y);
  const M=new T.Matrix4().makeBasis(X.multiplyScalar(r),Y.multiplyScalar(r*f),Z.multiplyScalar(r));const pc=p.clone().addScaledVector(n,c*r*f);M.setPosition(pc);m.setMatrixAt(i,M);return M;}

function makeDewMacroSet(opts){
  opts=opts||{};const ql=qlevel(opts),dusk=opts.style==="dusk",bag=Bag(),R=RNG((opts.seed||11)*31+7);
  const root=new T.Group();root.name="flora_dew_macro";PROF.mark();
  const U=macroRig(dusk?{sunCol:0xff9a55,sunI:3.0,fillCol:0xc4c4ff,fillI:.5,sky:0xd9a684,hor:0xc78150,gnd:0x2b2a1c,ambI:.75}
                      :{sunCol:0xffcf98,sunI:3.2,fillCol:0xe2ebff,fillI:.6,sky:0xe4d3bf,hor:0xd3b27c,gnd:0x34462a,ambI:.85});
  const sunLocal=new V3(-.25,.31,-.92).normalize(),fillLocal=new V3(-.32,.78,.54).normalize();
  /* ---- backdrop (out-of-focus dawn meadow) ---- */
  /* where the light direction pierces the backdrop (seen from the hero drop) -> painted sun glow there */
  const bdZ=-.2,bdY=.002,hp=new V3(.0085,.011,0),tS=(hp.z-bdZ)/-sunLocal.z,sp=hp.clone().addScaledVector(sunLocal,tS);
  const sunUV=[clamp((sp.x+.2)/.4,-.2,1.2),clamp((.1-(sp.y-bdY))/.2,-.3,1.2)];
  const bd=makeBokehBackdrop({width:.40,height:.20,style:"meadowDawn",seed:(opts.seed||11)+3,quality:opts.quality,sunPos:sunUV,
    palette:dusk?["#ffb05a","#e9824a","#ffd08a","#6b5a2c","#3a3a1e","#c86a48","#8a6a3a"]:undefined,highlights:QS(ql,34,42,48)});
  PROF.mark("backdrop");bd.position.set(0,bdY,bdZ);root.add(bd);rigBindBackdrop(U,bd,[1.15,1.1,1.6]);
  if(dusk)bd.userData.setTint(1.08,.86,.7);
  /* ---- blade textures/materials ---- */
  const texS=bladeTextures("susuki",ql,21),texG=bladeTextures("grass",ql,33),texB=bladeTextures("broad",ql,45),texSeed=bladeTextures("seed",ql,57);
  [texS,texG,texB,texSeed].forEach(t=>{bag.add(t.map);bag.add(t.nrm);});PROF.mark("bladeTex");
  const mk=(tex,tint,trans,o)=>bag.add(surfMaterial(U,Object.assign({map:tex.map,nrm:tex.nrm,tint:new T.Color(...tint),transCol:lin(trans)},o||{})));
  const dropMat=bag.add(dropMaterial(U,{dispersion:false})),decMat=bag.add(decalMaterial(U));
  const dropGeo=bag.add(new T.SphereGeometry(1,QS(ql,20,30,40),QS(ql,14,20,28)));
  const decGeo=bag.add(new T.PlaneGeometry(1,1));
  /* ---- blade layout (set-local, metres) ---- */
  const W=(w0,p,q)=>s=>w0*Math.pow(Math.max(0,1-Math.pow(s,p||1.7)),q||.8);
  const segsHi=QS(ql,90,150,230);
  const B=[
    {id:"hero",tex:texS,tint:[1,1.02,.98],trans:0xd6e86a,pts:[[-.056,-.010,-.014],[-.034,.004,-.007],[-.015,.0138,-.002],[-.002,.0166,.0005],[.0068,.0150,.0012],[.0102,.0118,.0012]],
      up:[0,1,.5],w:W(.0064,1.5,.85),tw:s=>.30*s,fold:.13,cup:.00008,groove:.00006,segs:segsHi,nd:QS(ql,18,28,38),smin:.06,smax:.93,serr:{amp:.00004,period:.0005}},
    {id:"broad",tex:texB,tint:[.62,.68,.55],trans:0x8ea048,pts:[[-.07,-.05,-.05],[-.055,-.026,-.044],[-.043,-.004,-.04],[-.035,.016,-.037],[-.031,.036,-.035]],
      up:[.5,.1,1],w:W(.0085,2.4,.6),transK:.6,haze:.42,tw:s=>-.2*s,fold:.09,cup:.00012,groove:.00009,segs:segsHi,nd:QS(ql,20,32,44),smin:.25,smax:.98,serr:{amp:.00005,period:.0006}},
    {id:"thin",tex:texG,tint:[1.02,1.04,.95],trans:0xd8f070,pts:[[.036,-.040,.004],[.027,-.016,.0055],[.0215,.002,.006],[.0222,.0122,.0058],[.0262,.0172,.0050]],
      up:[-.45,.15,1],w:W(.0034,1.3,.9),tw:s=>.5*s,fold:.18,cup:.00004,groove:.00004,segs:Math.round(segsHi*.8),nd:QS(ql,8,12,16),smin:.35,smax:.9,serr:{amp:.00003,period:.0004}},
    {id:"low",tex:texG,tint:[.92,.98,.9],trans:0xc8e060,pts:[[-.036,-.030,-.006],[-.012,-.0175,-.005],[.006,-.0112,-.004],[.022,-.0098,-.0055],[.036,-.0118,-.008]],
      up:[0,1,.65],w:W(.0047,1.8,.7),haze:.12,tw:s=>-.25*s,fold:.15,cup:.00006,groove:.00005,segs:Math.round(segsHi*.8),nd:QS(ql,10,16,22),smin:.15,smax:.94,serr:{amp:.00003,period:.00045}}
  ];
  const sunL=sunLocal.clone();const blades=[];const allDecals=[];
  for(const b of B){
    const piv=new T.Group();piv.name="blade_"+b.id;const p0=new V3(...b.pts[0]);piv.position.copy(p0);root.add(piv);
    const bl=buildBlade({pts:b.pts.map(p=>[p[0]-p0.x,p[1]-p0.y,p[2]-p0.z]),up:b.up,segs:b.segs,nu:QS(ql,7,9,11),width:b.w,twist:b.tw,fold:b.fold,cup:b.cup,groove:b.groove,
      serr:ql>0?b.serr:null,uvLen:.05,thick:(s,u)=>(.00026-.00012*u*u)*(1-.5*s)});
    bag.add(bl.geometry);
    const hazeCol=new T.Color().fromArray(bd.userData.colors.mid).convertSRGBToLinear();
    const mat=mk(b.tex,b.tint,b.trans,{tipCol:lin(0xb59a5c),tipK:b.id==="hero"?.0:.25,transK:b.transK!==undefined?b.transK:1,haze:b.haze||0,hazeCol});
    const mesh=new T.Mesh(bl.geometry,mat);mesh.castShadow=false;mesh.receiveShadow=false;piv.add(mesh);
    /* dew drops on the upper surface (non-overlapping, sizes 0.4-3.5 mm) */
    const drops=[];let tries=0;
    while(drops.length<b.nd&&tries<b.nd*60){tries++;
      const z=R();const r=z<.58?R.r(.0002,.00048):(z<.88?R.r(.00048,.00095):R.r(.00095,.00165));
      const s=R.r(b.smin,b.smax),S=bl.surf(s,0),hw=S.w*.5;const rc=r*.86;
      const edge=R()<.3&&r<.0008;if(!edge&&rc>hw*.8)continue;
      const umax=Math.max(0,(hw-rc*1.05)/hw),u=edge?(R()<.5?-1:1):R.s()*umax;const P=bl.surf(s,u);
      if(edge){/* bead clinging to the margin: centre pushed outward, no contact cut (full sphere around the edge) */
        const out=P.a.clone().multiplyScalar(u>0?1:-1);P.p.addScaledVector(out,r*.55).addScaledVector(P.n,-r*.25);P.n.lerp(out,.35).normalize();}
      let ok=true;for(const d of drops){if(d.p.distanceTo(P.p)<(d.r+r)*1.08+.00012){ok=false;break;}}if(!ok)continue;
      const th=R.r(1.95,2.35),c=-Math.cos(th),f=1-.2*sstep(.0006,.0017,r);
      drops.push({s,u,p:P.p,n:P.n,t:P.t,a:P.a,w:P.w,r,c:edge?.98:c,f:edge?.97:f,edge,thr:clamp(.22+.78*Math.pow(r/.0017,.7)*R.r(.75,1.05),.1,1)});}
    const bMat=bag.add(dropMaterial(U,{leafMap:b.tex.map,uvLen:.05,leafTint:new T.Color(...b.tint),transCol:lin(b.trans),haze:b.haze||0,hazeCol}));
    const dm=new T.InstancedMesh(dropGeo,bMat,Math.max(1,drops.length));dm.count=drops.length;
    const aD=new Float32Array(Math.max(1,drops.length)*4),aL=new Float32Array(Math.max(1,drops.length)*3);const leafC=lin(b.id==="broad"?0x6e8a40:0x6a8c3c);
    drops.forEach((d,i)=>{d.M=setDropInstance(dm,i,d.p,d.n,d.t,d.r,d.f,d.edge?0:d.c);aD.set([d.edge?-1.6:-d.c,R(),d.thr,0],i*4);aL.set([(d.u+1)/2,d.s*bl.len/.05,-d.w],i*3);});
    dm.geometry=dropGeo;dm.instanceMatrix.needsUpdate=true;
    const ig=new T.InstancedBufferGeometry();ig.index=dropGeo.index;for(const k in dropGeo.attributes)ig.setAttribute(k,dropGeo.attributes[k]);
    ig.setAttribute("aDrop",new T.InstancedBufferAttribute(aD,4));ig.setAttribute("aLeaf",new T.InstancedBufferAttribute(aL,3));
    dm.geometry=bag.add(ig);dm.frustumCulled=false;dm.castShadow=false;dm.receiveShadow=false;piv.add(dm);
    /* decals (drop shadow + caustic) */
    const dc=new T.InstancedMesh(decGeo,decMat,Math.max(1,drops.length));dc.count=drops.length;
    const ag=new T.InstancedBufferGeometry();ag.index=decGeo.index;for(const k in decGeo.attributes)ag.setAttribute(k,decGeo.attributes[k]);
    const aDec=new Float32Array(Math.max(1,drops.length)*4);drops.forEach((d,i)=>aDec.set([1,R(),d.thr,0],i*4));
    ag.setAttribute("aDec",new T.InstancedBufferAttribute(aDec,4));dc.geometry=bag.add(ag);dc.frustumCulled=false;dc.renderOrder=2;piv.add(dc);
    const entry={b,piv,mesh,bl,drops,dm,dc,aDec,p0,ph:R()*TAU,ph2:R()*TAU};blades.push(entry);allDecals.push(entry);
  }
  PROF.mark("blades");
  /* decal layout depends on the sun direction (set-local) */
  function layoutDecals(){const L=sunL;for(const e of allDecals){
      e.drops.forEach((d,i)=>{const nl=L.dot(d.n);const M=new T.Matrix4();
        if(nl<.06||d.edge){e.aDec[i*4]=0;M.makeScale(1e-9,1e-9,1e-9);e.dc.setMatrixAt(i,M);return;}
        const Lt=L.clone().sub(d.n.clone().multiplyScalar(nl)).normalize(),dir=Lt.clone().negate(),el=Math.asin(clamp(nl,-1,1));
        const hw=d.w*.5,lat=d.u*hw,dA=dir.dot(d.a);let room=Math.abs(dA)>1e-4?(dA>0?(hw-lat-d.r*.95)/dA:(hw+lat-d.r*.95)/(-dA)):1;room=Math.max(0,room);
        const hc=(1+d.c)*d.r*d.f,len=Math.min(hc/Math.tan(el),d.r*4.5,room),X=dir.clone().multiplyScalar(len+d.r*1.5),Y=new V3().crossVectors(d.n,dir).normalize().multiplyScalar(d.r*1.85);
        M.makeBasis(X,Y,d.n.clone());M.setPosition(d.p.clone().addScaledVector(dir,len*.5).addScaledVector(d.n,.000004));
        e.aDec[i*4]=sstep(.06,.3,nl);e.dc.setMatrixAt(i,M);d.D=M.clone();});
      e.dc.instanceMatrix.needsUpdate=true;e.dc.geometry.attributes.aDec.needsUpdate=true;}}
  layoutDecals();
  /* ---- seed-head stem (fine raceme with awns and beaded dew) ---- */
  const seedPiv=new T.Group();seedPiv.position.set(.018,-.034,-.02);root.add(seedPiv);
  const sp0=seedPiv.position;const stemPts=[[.018,-.034,-.02],[.011,-.012,-.019],[.003,.004,-.0175],[-.006,.0158,-.0158],[-.0135,.0232,-.0142],[-.0168,.0262,-.0136]].map(p=>new V3(p[0]-sp0.x,p[1]-sp0.y,p[2]-sp0.z));
  const sgeos=[];const beads=[];const stemC=[.30,.33,.17],stemC2=[.40,.30,.27];
  const stem=tubeGeo(stemPts,s=>.00031*(1-.45*s),QS(ql,5,6,8),{segs:QS(ql,40,60,90),col0:stemC,col1:stemC2,vRep:4});sgeos.push(stem.geometry);
  const nSpk=QS(ql,9,13,17);
  for(let k=0;k<nSpk;k++){const s=.42+.56*k/(nSpk-1),P=stem.curve.getPointAt(s),Tt=stem.curve.getTangentAt(s);
    const side=(k%2?1:-1),az=new V3(0,0,1).cross(Tt).normalize().multiplyScalar(side).add(new V3(0,0,R.r(-.3,.6))).normalize();
    const dir=Tt.clone().multiplyScalar(.75).addScaledVector(az,.66).normalize();
    const ped=R.r(.0005,.0012),base=P.clone().addScaledVector(dir,ped);
    sgeos.push(tubeGeo([P,P.clone().lerp(base,.5).addScaledVector(az,.0001),base],.00009,3,{segs:4,col0:stemC,col1:stemC}).geometry);
    const sl=R.r(.0021,.0029);const sdir=dir.clone().lerp(Tt,.35).normalize();
    sgeos.push(spindleGeo(base,sdir,sl,R.r(.0003,.0004),QS(ql,6,8,10),QS(ql,6,8,10),[.3,.22,.3],[.52,.46,.42]));
    /* awn */
    const tip=base.clone().addScaledVector(sdir,sl),al=R.r(.004,.0075),bend=az.clone().multiplyScalar(R.r(-.25,.25)).add(new V3(0,-.15,0));
    const a1=tip.clone().addScaledVector(sdir,al*.5).addScaledVector(bend,al*.15),a2=tip.clone().addScaledVector(sdir.clone().add(bend).normalize(),al);
    const awn=tubeGeo([tip,a1,a2],s=>.00004*(1-.6*s),3,{segs:QS(ql,6,9,12),col0:[.42,.3,.28],col1:[.62,.56,.46]});sgeos.push(awn.geometry);
    for(let q=0,sp=R.r(.0005,.001);sp<al*.95&&q<8;q++,sp+=R.r(.0007,.0016)){const p=awn.curve.getPointAt(clamp(sp/al,0,1));beads.push({p,r:R.r(.00013,.00034)*(1-.4*sp/al),t:awn.curve.getTangentAt(clamp(sp/al,0,1))});}
    /* silky hairs at the base of the spikelet */
    for(let hh=0;hh<QS(ql,1,3,4);hh++){const hd=sdir.clone().addScaledVector(az,R.r(.2,.8)).add(new V3(R.s()*.3,R.s()*.3,R.s()*.3)).normalize(),hl=R.r(.0018,.0034);
      const hc=tubeGeo([base,base.clone().addScaledVector(hd,hl*.5).add(new V3(0,-hl*.08,0)),base.clone().addScaledVector(hd,hl).add(new V3(0,-hl*.2,0))],.000016,3,{segs:5,col0:[.85,.8,.75],col1:[.95,.92,.88]});
      sgeos.push(hc.geometry);if(R()<.6)beads.push({p:hc.curve.getPointAt(R.r(.5,.95)),r:R.r(.0001,.00022),t:hc.curve.getTangentAt(.7)});}
    if(R()<.7)beads.push({p:base.clone().addScaledVector(sdir,sl*R.r(.3,.7)).addScaledVector(az,.00042),r:R.r(.00022,.0004),t:sdir.clone()});
  }
  const seedGeo=bag.add(mergeGeo(sgeos));const seedMat=mk(texSeed,[1,1,1],0x9a8a84,{shin:40,specK:.6,nrmK:.4,transK:.45,haze:.18,hazeCol:new T.Color().fromArray(bd.userData.colors.mid).convertSRGBToLinear()});
  const seedMesh=new T.Mesh(seedGeo,seedMat);seedMesh.castShadow=false;seedMesh.receiveShadow=false;seedPiv.add(seedMesh);
  {const bm=new T.InstancedMesh(dropGeo,dropMat,beads.length);const aD=new Float32Array(beads.length*4),aL=new Float32Array(beads.length*3);
    beads.forEach((d,i)=>{const n=new V3(0,1,0);const M=new T.Matrix4().makeScale(d.r,d.r*1.06,d.r);M.setPosition(d.p);bm.setMatrixAt(i,M);aD.set([-1.6,R(),clamp(.15+.8*d.r/.0004*R.r(.6,1),.1,1),1],i*4);aL.set([.5,.4,.3],i*3);});
    const ig=new T.InstancedBufferGeometry();ig.index=dropGeo.index;for(const k in dropGeo.attributes)ig.setAttribute(k,dropGeo.attributes[k]);
    ig.setAttribute("aDrop",new T.InstancedBufferAttribute(aD,4));ig.setAttribute("aLeaf",new T.InstancedBufferAttribute(aL,3));bm.geometry=bag.add(ig);bm.frustumCulled=false;
    bm.castShadow=false;bm.receiveShadow=false;seedPiv.add(bm);}
  PROF.mark("seed");
  /* ---- hero pendant drop at the tip of the drooping blade ---- */
  const heroE=blades[0],tipS=1.0;
  const heroR0=.00165;const nProf=QS(ql,24,36,48),nSeg=QS(ql,32,48,72);
  const mkHero=()=>{const g=bag.add(latheGeo(pendantProfile(heroR0,0,0,0,nProf),nSeg));const m=new T.Mesh(g,bag.add(dropMaterial(U,{dispersion:ql>0})));
    m.castShadow=false;m.receiveShadow=false;m.frustumCulled=false;m.userData.c=new V3();m.userData.r=heroR0;root.add(m);return m;};
  const heroA=mkHero(),heroB=mkHero();heroB.visible=false;
  const heroAnchor=new T.Object3D();heroAnchor.name="hero_drop_centre";root.add(heroAnchor);
  /* rest data of the hero blade for the CPU rebound bend */
  const hb=heroE.bl,hg=heroE.mesh.geometry,restPos=hg.attributes.position.array.slice(),restNor=hg.attributes.normal.array.slice(),sAttr=hg.attributes.aM.array;
  const s0=.5,pivF=hb.frame(s0),pivP=pivF.p.clone(),pivAx=pivF.a.clone();
  heroE.drops.forEach(d=>{d.M0=d.M.clone();d.D0=d.D?d.D.clone():null;});
  let bendAng=0,bendVel=0;const tipLocal=()=>{const f=hb.frame(tipS);return f.p.clone();};
  const _m=new T.Matrix4(),_v=new V3();
  function applyBend(a){const n=restPos.length/3,pos=hg.attributes.position.array,nor=hg.attributes.normal.array;
    for(let i=0;i<n;i++){const s=sAttr[i*4],w=sstep(s0,1,s)*a;if(w===0){pos[i*3]=restPos[i*3];pos[i*3+1]=restPos[i*3+1];pos[i*3+2]=restPos[i*3+2];nor[i*3]=restNor[i*3];nor[i*3+1]=restNor[i*3+1];nor[i*3+2]=restNor[i*3+2];continue;}
      _q.setFromAxisAngle(pivAx,w);_v.set(restPos[i*3]-pivP.x,restPos[i*3+1]-pivP.y,restPos[i*3+2]-pivP.z).applyQuaternion(_q).add(pivP);pos[i*3]=_v.x;pos[i*3+1]=_v.y;pos[i*3+2]=_v.z;
      _v.set(restNor[i*3],restNor[i*3+1],restNor[i*3+2]).applyQuaternion(_q);nor[i*3]=_v.x;nor[i*3+1]=_v.y;nor[i*3+2]=_v.z;}
    hg.attributes.position.needsUpdate=true;hg.attributes.normal.needsUpdate=true;
    heroE.drops.forEach((d,i)=>{const w=sstep(s0,1,d.s)*a;_q.setFromAxisAngle(pivAx,w);
      const rot=new T.Matrix4().makeRotationFromQuaternion(_q),tr=new T.Matrix4().makeTranslation(pivP.x,pivP.y,pivP.z),tr2=new T.Matrix4().makeTranslation(-pivP.x,-pivP.y,-pivP.z);
      _m.copy(tr).multiply(rot).multiply(tr2);heroE.dm.setMatrixAt(i,_m.clone().multiply(d.M0));if(d.D0)heroE.dc.setMatrixAt(i,_m.clone().multiply(d.D0));});
    heroE.dm.instanceMatrix.needsUpdate=true;heroE.dc.instanceMatrix.needsUpdate=true;}
  /* hero state machine */
  const tipDir=(()=>{const f0=hb.frame(.97),f1=hb.frame(1);return f1.p.clone().sub(f0.p).normalize();})();
  const H={phase:"hang",t:0,grow:1,fallY:0,fallV:0,el:0,cur:heroA,spare:heroB,fallMesh:null,slow:.16,reform:true,evap:0};
  const tipRest=tipLocal();
  function tipNow(){const p=tipRest.clone();p.sub(pivP).applyQuaternion(_q.setFromAxisAngle(pivAx,bendAng)).add(pivP);heroE.piv.updateMatrix();return p.applyMatrix4(heroE.piv.matrix);}
  function shapeHero(m,Rb,el,neckL,pinch){latheUpdate(m.geometry,pendantProfile(Rb,el,neckL,pinch,nProf));}
  /* ---- foreground blur and bokeh sprites ---- */
  const fgTexA=bag.add(blurPlaneTex({w:QS(ql,128,256,256),h:QS(ql,64,128,128),seed:5,blur:QS(ql,5,9,10),
    strokes:[{col:"#8fa846",a:.95,w:.42,p:[-.05,1.05,.45,.55,1.08,.12]},{col:"#d9d27c",a:.55,w:.12,p:[.02,.82,.48,.36,1.05,.0]}],
    discs:[{x:.38,y:.52,r:.13,col:"#fff1c8",a:.85},{x:.62,y:.38,r:.09,col:"#fff6dc",a:.7},{x:.2,y:.75,r:.07,col:"#ffe9b0",a:.6}]}));
  const fgA=new T.Mesh(bag.add(new T.PlaneGeometry(.056,.028)),bag.add(blurPlaneMaterial(fgTexA,1.0)));fgA.position.set(-.024,-.013,.03);fgA.rotation.z=.18;fgA.renderOrder=20;fgA.castShadow=fgA.receiveShadow=false;root.add(fgA);
  const fgTexB=bag.add(blurPlaneTex({w:QS(ql,64,128,128),h:QS(ql,128,256,256),seed:8,blur:QS(ql,6,10,12),
    strokes:[{col:"#71913c",a:.9,w:.16,p:[.62,1.05,.42,.5,.55,-.05]}],discs:[{x:.5,y:.35,r:.06,col:"#fff2cc",a:.7}]}));
  const fgB=new T.Mesh(bag.add(new T.PlaneGeometry(.022,.044)),bag.add(blurPlaneMaterial(fgTexB,.95)));fgB.position.set(.034,-.006,.032);fgB.renderOrder=21;fgB.castShadow=fgB.receiveShadow=false;root.add(fgB);
  const nSp=QS(ql,6,10,14);const spr=new T.InstancedMesh(bag.add(new T.PlaneGeometry(1,1)),bag.add(spriteMaterial(U)),nSp);
  {const aSp=new Float32Array(nSp*4),aSc=new Float32Array(nSp*4);const warm=[lin(0xfff1d0),lin(0xffe2a8),lin(0xf4f8d8),lin(0xffd8c8)];
    for(let i=0;i<nSp;i++){const M=new T.Matrix4();const mote=true;
      if(!mote){M.makeScale(1e-9,1e-9,1e-9);aSp.set([0,0,0,0],i*4);aSc.set([0,0,0,0],i*4);}
      else{const sz=R.r(.00012,.00026);M.makeScale(sz,sz,sz);M.setPosition(R.r(-.03,.03),R.r(-.005,.024),R.r(-.03,.012));aSp.set([1,R()*TAU,R.r(1,3),.6],i*4);aSc.set([1,.9,.7,R.r(1.2,3.5)],i*4);}
      spr.setMatrixAt(i,M);}
    spr.geometry.setAttribute("aSp",new T.InstancedBufferAttribute(aSp,4));spr.geometry.setAttribute("aSc",new T.InstancedBufferAttribute(aSc,4));}
  spr.frustumCulled=false;spr.renderOrder=15;spr.castShadow=spr.receiveShadow=false;root.add(spr);
  PROF.mark("hero+fg");
  /* sun sparkle star on the hero drop (position ray-traced on the CPU from the real camera) */
  const star=new T.Mesh(bag.add(new T.PlaneGeometry(1,1)),bag.add(starMaterial()));star.renderOrder=30;star.frustumCulled=false;star.castShadow=star.receiveShadow=false;root.add(star);
  const _E=new V3(),_inv=new T.Matrix4();let lastCam=null;
  function placeStar(camera){if(camera)lastCam=camera;const cam=lastCam;const m=H.cur;if(!cam||!m.visible){star.visible=false;return;}
    root.updateMatrixWorld();_inv.copy(root.matrixWorld).invert();_E.setFromMatrixPosition(cam.matrixWorld).applyMatrix4(_inv);
    const C=m.userData.c,Rr=m.userData.r;const sp=sparklePoint(C,Rr,_E,sunL);
    const vis=sstep(.985,.9995,sp.cos)*(1-sstep(.93,.99,sp.edge)*.6)*(1-sstep(.5,1,H.evap));
    star.visible=vis>.01;star.position.copy(sp.p).addScaledVector(_E.clone().sub(sp.p).normalize(),Rr*.3);
    star.scale.setScalar(Rr*(2.6+1.2*Math.sin(time*1.7))*(.6+.4*H.grow));star.material.uniforms.uI.value=vis*U.uSunI.value*.55*(.8+.2*Math.sin(time*5.3));
    star.material.uniforms.uCol.value.copy(U.uSunCol.value).lerp(new T.Color(1,1,1),.5);star.material.uniforms.uRot.value=.35;}
  /* ---- per-frame ---- */
  let time=0;
  bd.onBeforeRender=()=>{rigRefresh(U,root,bd,sunL,fillLocal);heroUniforms();};
  function placeHero(){
    const tip=tipNow();const m=H.cur;
    const Rb=heroR0*H.grow*(1-sstep(.75,1,H.evap)*.85),el=H.el+.06,neckL=Rb*.9*H.swell,pinch=.85*H.swell;
    shapeHero(m,Rb,el,neckL,pinch);
    /* the blade tip pierces the upper part of the drop: bulb centre a little ahead of and below the tip */
    m.position.copy(tip).addScaledVector(tipDir,Rb*.15).add(new V3(0,-Rb*(1+el)*.55-neckL*.8,0));
    heroAnchor.position.copy(m.position);
    m.userData.c.copy(heroAnchor.position);m.userData.r=Rb*(1+el*.3);
    m.visible=Rb>.00005;}
  function heroUniforms(){root.updateMatrixWorld();const ws=root.matrixWorld.getMaxScaleOnAxis();
    for(const m of [heroA,heroB]){const u=m.material.uniforms;u.uHC.value.copy(m.userData.c).applyMatrix4(root.matrixWorld);u.uHR.value=m.userData.r*ws;}}
  H.swell=0;
  function update(dt,t,camera){if(t===undefined){time+=dt||0;t=time;}else time=t;dt=clamp(dt||1/60,0,.1);U.uTime.value=t;bd.userData.update(dt,t);
    /* gentle sway */
    for(const e of blades){const a=.0045*Math.sin(t*.9+e.ph)+.0025*Math.sin(t*1.7+e.ph2);e.piv.rotation.set(a*.6,a*.3,a);}
    seedPiv.rotation.set(.004*Math.sin(t*1.1+1.3),0,.006*Math.sin(t*.8+.4));
    /* hero blade spring */
    const k=55,c=2.2;bendVel+=(-k*bendAng-c*bendVel)*dt;bendAng+=bendVel*dt;if(Math.abs(bendAng)>1e-5||Math.abs(bendVel)>1e-4)applyBend(bendAng);
    /* hero drop state */
    H.t+=dt;
    if(H.phase==="swell"){H.swell=sstep(0,1,H.t/1.1);H.grow=1+.18*H.swell;H.el=.38*H.swell;
      if(H.t>1.1){/* pinch off */H.phase="fall";H.t=0;H.fallMesh=H.cur;H.fallY=0;H.fallV=0;H.fallStart=H.cur.position.clone();
        H.cur=H.spare;H.spare=H.fallMesh;H.cur.visible=true;H.grow=.22;H.swell=0;H.el=0;bendVel+=1.6;}}
    if(H.fallMesh){const g=9.81*H.slow*H.slow;H.fallV+=g*dt;H.fallY+=H.fallV*dt;const ft=H.t;
      const el=.32*Math.exp(-ft/.5)*Math.cos(ft*TAU*1.6);const Rb=heroR0*1.18;
      shapeHero(H.fallMesh,Rb,el,0,0);H.fallMesh.position.copy(H.fallStart).add(new V3(0,-H.fallY,0));
      H.fallMesh.userData.c.copy(H.fallMesh.position);H.fallMesh.userData.r=Rb;
      if(H.fallY>.06){H.fallMesh.visible=false;H.fallMesh=null;}}
    if(H.phase==="fall"&&!H.fallMesh){H.phase=H.reform?"reform":"hang";H.t=0;}
    if(H.phase==="reform"){const RT=opts.reformTime||7;H.grow=lerp(.22,1,sstep(0,1,H.t/RT));if(H.t>RT){H.phase="hang";H.grow=1;}}
    if(H.phase==="hang"){H.el=.03*Math.sin(t*1.3);}
    placeHero();
    rigRefresh(U,root,bd,sunL,fillLocal);heroUniforms();placeStar(camera);
  }
  update(0,0);
  root.userData={
    hero:heroAnchor,
    cameraHint:{position:[.0058,.0118,.071],target:[.0012,.0062,0],fov:25},
    update,
    triggerFall(o){o=o||{};if(H.phase!=="hang"&&H.phase!=="reform")return false;H.slow=o.slowmo!==undefined?o.slowmo:.16;H.reform=o.reform!==false;H.phase="swell";H.t=0;H.grow=Math.max(H.grow,.9);return true;},
    setEvaporate(v){H.evap=clamp(v,0,1);U.uEvap.value=H.evap;},
    setSun(dir,color,intensity){if(dir){const d=dir.isVector3?dir.clone():new V3(dir[0],dir[1],dir[2]);if(d.lengthSq()>0){sunL.copy(d.normalize());layoutDecals();}}
      if(color!==undefined&&color!==null)U.uSunCol.value.copy(lin(color));if(intensity!==undefined)U.uSunI.value=3.1*intensity;},
    dispose(){bag.dispose();bd.userData.dispose();}
  };
  return root;
}
/* ------------------------------------------------------------------
   4. makeGrassField — the autumn field of Adashino: instanced tufts, susuki/ogi clumps, plumes (obana),
      foxtails, a few autumn flowers, dew glints and a turf base layer. World-space, metres.
   ------------------------------------------------------------------ */
const FIELD_PAL={/* sRGB; per kind: slots [base,tip,dry] */
  spring:{tuft:[[0x3c6420,0x8fc052,0xa89c66],[0x45702a,0xa0c862,0xd8ceb0],[0x3a6420,0x84b24a,0xaa9c5e]],
    clump:[[0x3e6424,0x8cba52,0xb4a46e],[0x44702a,0x96c25a,0xc4b27c]],
    plume:[[0xa49884,0xc8bea8,0x8a7c62],[0xb0a690,0xd2c8b4,0x948468],[0x6e8c3a,0xa0b45c,0x8c7c4c]],
    stem:0x8a8a5a,turf:[0x30521a,0x75a240],dry:.14,plumeV:.3,flowerV:0,frost:0,midrib:.5},
  summer:{tuft:[[0x2c5418,0x5e9434,0x9a8c58],[0x34601e,0x6a9c3a,0xb4a676],[0x2e5a1a,0x669a36,0xa0905a]],
    clump:[[0x2c5a1c,0x67993a,0xa49462],[0x325e20,0x70a240,0xb09e6a]],
    plume:[[0x7a4a4c,0xb08078,0x806050],[0x9a8a80,0xc4b8a8,0x8a7a64],[0x5e7e2e,0x9ab04e,0x7e7040]],
    stem:0x5e7a34,turf:[0x24461a,0x5a8a30],dry:.05,plumeV:.45,flowerV:.45,frost:0,midrib:.6},
  autumn:{tuft:[[0x46552a,0x9e9a4a,0xbca472],[0x5a4c2a,0x9a6040,0xc69264],[0x4e5e2a,0xa69a4e,0xc2a46a]],
    clump:[[0x4a682c,0xaaa45c,0xc6ac7a],[0x546e2e,0xb2aa64,0xccb480]],
    plume:[[0xc4b394,0xf2e8d2,0xa89070],[0xd6cebe,0xfcf8ee,0xb4a284],[0x8a8648,0xcab66c,0x9c8452]],
    stem:0xa89a66,turf:[0x3e4a22,0x8e8c46],dry:.32,plumeV:1,flowerV:1,frost:0,midrib:.75},
  winter:{tuft:[[0x6e6244,0xb4a27a,0xbaa680],[0x6a5a3e,0xa88a64,0xb89a74],[0x6c6040,0xb09c72,0xb8a07a]],
    clump:[[0x7a6c4a,0xc8b48a,0xcdb88e],[0x80704e,0xcab890,0xd0bc94]],
    plume:[[0xb0a894,0xe2dccc,0x9a8e76],[0xc4bcac,0xece6da,0xa69a84],[0x8a7a56,0xb4a070,0x8a7650]],
    stem:0xb0a07a,turf:[0x5a5236,0x9a8c62],dry:.95,plumeV:.85,flowerV:0,frost:.6,midrib:.2}
};
function palArray(season,kind){const P=FIELD_PAL[season]||FIELD_PAL.autumn,a=[];
  if(kind==="turf"){a.push(lin(P.turf[0]),lin(P.turf[1]));return a;}
  for(const s of P[kind])for(const c of s)a.push(lin(c));while(a.length<9)a.push(lin(0x808060));return a;}
/* --- blade geometry builders (unit height; instance matrix scales to metres) --- */
function bladeSpine(R,o){/* returns {pts:[V3],T:[V3],A:[V3],N:[V3],w:[]} */
  const az=o.az!==undefined?o.az:R()*TAU,dir=new V3(Math.cos(az),0,Math.sin(az)),segs=o.segs,len=o.len;
  const pts=[],Ts=[],As=[],Ns=[],ws=[];let p=new V3(o.bx||0,0,o.bz||0);
  const tw=o.twist||0;
  for(let i=0;i<=segs;i++){const t=i/segs,th=o.lean+o.arch*Math.pow(t,o.archP||1.6);
    const T_=new V3(Math.sin(th)*dir.x,Math.cos(th),Math.sin(th)*dir.z).normalize();
    if(i>0){/* integrate with the mid angle */const tm=(i-.5)/segs,thm=o.lean+o.arch*Math.pow(tm,o.archP||1.6);
      p=p.clone().add(new V3(Math.sin(thm)*dir.x,Math.cos(thm),Math.sin(thm)*dir.z).multiplyScalar(len/segs));}
    const A0=new V3(-dir.z,0,dir.x),N0=new V3().crossVectors(T_,A0).normalize();
    const a=tw*t,A=A0.clone().multiplyScalar(Math.cos(a)).addScaledVector(N0,Math.sin(a)).normalize(),N=new V3().crossVectors(T_,A).normalize();
    pts.push(p.clone());Ts.push(T_);As.push(A);Ns.push(N);ws.push(o.w*Math.pow(Math.max(0,1-Math.pow(t,o.wP||2.2)),o.wQ||.6));}
  return {pts,T:Ts,A:As,N:Ns,w:ws};}
/* append a blade (3 verts across + tip) to arrays */
function pushBlade(G,sp,rnd,aoBase,part,keel){const segs=sp.pts.length-1,base=G.pos.length/3;
  for(let i=0;i<segs;i++){const t=i/segs,p=sp.pts[i],A=sp.A[i],N=sp.N[i],w=sp.w[i]*.5,ao=aoBase+(1-aoBase)*Math.pow(t,.6);
    for(let j=0;j<3;j++){const u=j-1,q=p.clone().addScaledVector(A,u*w).addScaledVector(N,(j===1?keel*w:0));
      const n=N.clone().addScaledVector(A,u*.55).normalize();G.pos.push(q.x,q.y,q.z);G.nor.push(n.x,n.y,n.z);G.uv.push(j*.5,t);G.av.push(rnd,ao,part,j*.5);}}
  const tp=sp.pts[segs],tn=sp.N[segs];G.pos.push(tp.x,tp.y,tp.z);G.nor.push(tn.x,tn.y,tn.z);G.uv.push(.5,1);G.av.push(rnd,1,part,.5);
  for(let i=0;i<segs-1;i++){const a=base+i*3,b=base+(i+1)*3;G.idx.push(a,b,a+1,a+1,b,b+1,a+1,b+1,a+2,a+2,b+1,b+2);}
  const a=base+(segs-1)*3,tip=base+segs*3;G.idx.push(a,tip,a+1,a+1,tip,a+2);}
/* append a textured ribbon (2 verts across) */
function pushRibbon(G,sp,rnd,part,u0,u1,vRep){const segs=sp.pts.length-1,base=G.pos.length/3;
  for(let i=0;i<=segs;i++){const t=i/segs,p=sp.pts[i],A=sp.A[i],N=sp.N[i],w=sp.w[i]*.5;
    for(let j=0;j<2;j++){const q=p.clone().addScaledVector(A,(j?1:-1)*w);G.pos.push(q.x,q.y,q.z);G.nor.push(N.x,N.y,N.z);G.uv.push(j?u1:u0,t*(vRep||1));G.av.push(rnd,1,part,j);}}
  for(let i=0;i<segs;i++){const a=base+i*2,b=base+(i+1)*2;G.idx.push(a,b,a+1,a+1,b,b+1);}}
function newG(){return {pos:[],nor:[],uv:[],av:[],idx:[],glint:[]};}
function finishG(G){const g=geo({position:{a:G.pos,n:3},normal:{a:G.nor,n:3},uv:{a:G.uv,n:2},aV:{a:G.av,n:4}},G.idx);g.computeBoundingSphere();return g;}
function tuftGeometry(R,nb,segs,ng){const G=newG();
  for(let b=0;b<nb;b++){const rnd=R(),h=R.r(.5,1),sp=bladeSpine(R,{segs,len:h,lean:R.r(.04,.32),arch:R.r(.15,.9),archP:1.8,w:R.r(.024,.04),wP:2.4,wQ:.55,bx:R.s()*.06,bz:R.s()*.06,twist:R.s()*.9});
    pushBlade(G,sp,rnd,.3,0,.12);
    const nG=b<ng?1:0;for(let k=0;k<nG;k++){const ti=Math.min(segs-1,1+Math.floor(R()*(segs-1)));G.glint.push(sp.pts[ti].clone().addScaledVector(sp.N[ti],sp.w[ti]*.15));}}
  return G;}
function clumpGeometry(R,nb,segs,ng){const G=newG();
  for(let b=0;b<nb;b++){const rnd=R(),dead=b<2,len=dead?R.r(.35,.6):R.r(.75,1.15);
    const sp=bladeSpine(R,{segs,len,lean:R.r(.05,.32),arch:dead?R.r(1.4,2.2):R.r(.9,2.1),archP:1.7,w:R.r(.011,.017)*(dead?.8:1),wP:3,wQ:.5,bx:R.s()*.07,bz:R.s()*.07,twist:R.s()*.7});
    pushBlade(G,sp,rnd,.25,dead?2:0,.1);
    for(let k=0;k<(b<ng?1:0);k++){const ti=Math.min(segs-1,1+Math.floor(R()*(segs-1)));G.glint.push(sp.pts[ti].clone().addScaledVector(sp.N[ti],sp.w[ti]*.12));}}
  return G;}
function plumeGeometry(R,ql,kind,nRac){const G=newG();
  if(kind==="foxtail"){const h=1,sp=bladeSpine(R,{segs:3,len:h*.78,lean:R.r(.02,.12),arch:R.r(.2,.5),w:.006,wP:8,wQ:.2});
    pushRibbon(G,sp,R(),0,.248,.252,1);const top=sp.pts[sp.pts.length-1],dir=sp.T[sp.T.length-1];
    for(let k=0;k<3;k++){const az=Math.atan2(dir.z,dir.x)+k*PI/3;const ss=bladeSpine(R,{segs:2,len:.24,lean:Math.acos(clamp(dir.y,-1,1)),arch:.9,archP:1.3,w:.075,wP:6,wQ:.4,az:Math.atan2(dir.z,dir.x),twist:0});
      for(const p of ss.pts)p.add(top);const A=new V3(Math.cos(az),0,Math.sin(az));for(let i=0;i<ss.A.length;i++){const T_=ss.T[i];const a=A.clone().sub(T_.clone().multiplyScalar(A.dot(T_))).normalize();ss.A[i]=a;ss.N[i]=new V3().crossVectors(T_,a).normalize();}
      pushRibbon(G,ss,R(),1,.5,1,1);}
    return G;}
  /* susuki / ogi culm with a panicle of racemes */
  const lean=R.r(.0,.1),sp=bladeSpine(R,{segs:2,len:.84,lean,arch:R.r(.05,.25),w:.0028,wP:9,wQ:.2,twist:R.s()});
  pushRibbon(G,sp,R(),0,.248,.252,1);
  const top=sp.pts[sp.pts.length-1],ax=sp.T[sp.T.length-1],nr=nRac||6,lazy=R()*TAU;
  for(let k=0;k<nr;k++){const f=k/(nr-1),at=top.clone().addScaledVector(ax,-.12*(1-f)),az=lazy+k*2.39996;
    const ss=bladeSpine(R,{segs:2,len:R.r(.13,.2)*(1-.3*f),lean:R.r(.25,.6),arch:R.r(.5,1.2),archP:1.4,w:R.r(.05,.07),wP:2.5,wQ:.35,az,twist:PI*.5*(R()<.5?1:-1)});
    for(const p of ss.pts)p.add(at);pushRibbon(G,ss,R(),1,0,.5,1);}
  /* main rachis tip */
  const ss=bladeSpine(R,{segs:2,len:.17,lean:lean*.5,arch:.3,w:.05,wP:2,wQ:.4,az:lazy,twist:PI*.5});for(const p of ss.pts)p.add(top.clone().addScaledVector(ax,-.02));pushRibbon(G,ss,R(),1,0,.5,1);
  return G;}
/* autumn flowers: three variants in one geometry (aV.z = 10+variant); the instance chooses one, the others collapse */
function flowerGeometry(R,ql){const G=newG();
  /* 0: ominaeshi (Patrinia) - tall stem, flat-topped yellow corymb */
  {const sp=bladeSpine(R,{segs:4,len:1,lean:.04,arch:.12,w:.012,wP:9,wQ:.2});pushRibbon(G,sp,R(),10,.745,.755,1);const top=sp.pts[4];
    for(let k=0;k<4;k++){const c=top.clone().add(new V3(R.s()*.05,-k*.015,R.s()*.05)),s=R.r(.045,.07);const base=G.pos.length/3;
      for(const [x,z] of [[-1,-1],[1,-1],[1,1],[-1,1]]){G.pos.push(c.x+x*s,c.y,c.z+z*s);G.nor.push(0,1,0);G.uv.push(x>0?.5:0,z>0?1:.5);G.av.push(R(),1,10,0);}
      G.idx.push(base,base+1,base+2,base,base+2,base+3);}}
  /* 1: kikyo (Platycodon) - stem with leaves and two blue-violet star flowers */
  {const sp=bladeSpine(R,{segs:4,len:.62,lean:.1,arch:.3,w:.01,wP:9,wQ:.2});pushRibbon(G,sp,R(),11,.745,.755,1);
    for(let f=0;f<2;f++){const c=sp.pts[4-f].clone().add(new V3(R.s()*.02,.02-f*.06,R.s()*.02)),s=.03,base=G.pos.length/3;const up=new V3(R.s()*.4,1,R.s()*.4).normalize();
      const X=new V3(1,0,0).sub(up.clone().multiplyScalar(up.x)).normalize(),Z=new V3().crossVectors(X,up);
      G.pos.push(c.x,c.y-.006,c.z);G.nor.push(up.x,up.y,up.z);G.uv.push(.25,.25);G.av.push(R(),1,11,0);
      for(let i=0;i<=10;i++){const a=i/10*TAU,r=s*(i%2?.45:1),p=c.clone().addScaledVector(X,Math.cos(a)*r).addScaledVector(Z,Math.sin(a)*r).addScaledVector(up,r*.25);
        G.pos.push(p.x,p.y,p.z);G.nor.push(up.x,up.y,up.z);G.uv.push(.25+Math.cos(a)*.22*(r/s),.25+Math.sin(a)*.22*(r/s));G.av.push(R(),1,11,1);}
      for(let i=0;i<10;i++)G.idx.push(base,base+1+i,base+2+i);}}
  /* 2: hagi (bush clover) sprays - arching twigs with pink flower racemes */
  for(let k=0;k<3;k++){const sp=bladeSpine(R,{segs:4,len:R.r(.6,.85),lean:R.r(.3,.6),arch:R.r(.6,1.1),w:.05,wP:1.2,wQ:.5,twist:PI*.5});pushRibbon(G,sp,R(),12,.5,1,1);}
  return G;}
function fieldAtlas(ql){const W=QS(ql,128,256,256),Hh=W*2,cv=mkCanvas(W,Hh),x=cv.getContext("2d"),R=RNG(91);
  x.clearRect(0,0,W,Hh);const sx=W/256,sy=Hh/512;x.lineCap="round";
  /* left half: susuki raceme (rachis, spikelets, silky hairs pointing to the tip = top of texture) */
  for(let rep=0;rep<1;rep++){const cx=64*sx;
    x.strokeStyle="rgba(170,150,120,1)";x.lineWidth=2*sx;x.beginPath();x.moveTo(cx,Hh);x.lineTo(cx,4*sy);x.stroke();
    for(let y=Hh-8*sy;y>8*sy;y-=R.r(7,10)*sy){const side=R()<.5?-1:1,px=cx+side*R.r(1.5,4)*sx;
      for(let h=0;h<12;h++){const a=-PI/2+side*R.r(.08,.62)+R.s()*.1,L=R.r(26,48)*sy;x.strokeStyle="rgba(255,252,246,"+R.r(.45,.95).toFixed(3)+")";x.lineWidth=R.r(.7,1.25)*sx;
        x.beginPath();x.moveTo(px,y);x.quadraticCurveTo(px+Math.cos(a)*L*.5,y+Math.sin(a)*L*.5,px+Math.cos(a+side*.15)*L,y+Math.sin(a+side*.15)*L);x.stroke();}
      x.fillStyle="rgba(150,118,96,1)";x.beginPath();x.ellipse(px,y,2.2*sx,5*sy,side*.3,0,TAU);x.fill();}}
  /* right half: foxtail spike (dense seeds + bristles) */
  {const cx=192*sx;for(let y=Hh-6*sy;y>6*sy;y-=2.2*sy){for(const side of [-1,1]){const a=-PI/2+side*R.r(.5,1.2),L=R.r(14,28)*sx;
        x.strokeStyle="rgba(250,248,230,"+R.r(.5,.95).toFixed(3)+")";x.lineWidth=R.r(.7,1.1)*sx;x.beginPath();x.moveTo(cx+side*4*sx,y);x.lineTo(cx+side*4*sx+Math.cos(a)*L,y+Math.sin(a)*L);x.stroke();}
      x.fillStyle="rgba(200,200,150,1)";x.beginPath();x.ellipse(cx+R.s()*4*sx,y,3*sx,2.4*sy,0,0,TAU);x.fill();}}
  const t=new T.CanvasTexture(cv);t.encoding=T.sRGBEncoding;t.anisotropy=4;t.wrapS=t.wrapT=T.ClampToEdgeWrapping;return t;}
function flowerAtlas(){const W=128,cv=mkCanvas(W,W),x=cv.getContext("2d"),R=RNG(37);x.clearRect(0,0,W,W);
  /* top-left (uv 0..0.5, 0.5..1 in GL = canvas top-left): ominaeshi florets */
  for(let i=0;i<70;i++){const a=R()*TAU,d=Math.sqrt(R())*28;x.fillStyle=R()<.7?"#f2d23a":"#e8c020";x.beginPath();x.arc(32+Math.cos(a)*d,32+Math.sin(a)*d,R.r(1.6,3),0,TAU);x.fill();}
  /* bottom-left: kikyo petal colour (radial blue-violet with veins) */
  const g=x.createRadialGradient(32,96,2,32,96,30);g.addColorStop(0,"#efeaff");g.addColorStop(.25,"#8a78d8");g.addColorStop(1,"#5a4ab8");x.fillStyle=g;x.fillRect(0,64,64,64);
  x.strokeStyle="rgba(60,40,140,.6)";x.lineWidth=1;for(let i=0;i<10;i++){const a=i/10*TAU;x.beginPath();x.moveTo(32,96);x.lineTo(32+Math.cos(a)*30,96+Math.sin(a)*30);x.stroke();}
  /* right half: hagi twig with leaves and pink pea flowers */
  x.strokeStyle="#6a5a3a";x.lineWidth=1.4;x.beginPath();x.moveTo(96,128);x.lineTo(96,0);x.stroke();
  for(let y=124;y>4;y-=7){const s=R()<.5?-1:1;if(y>50){x.fillStyle=R()<.5?"#58782e":"#6a8a3a";x.beginPath();x.ellipse(96+s*9,y,7,3.4,s*.4,0,TAU);x.fill();}
    else{for(let k=0;k<3;k++){x.fillStyle=R()<.6?"#c8508c":"#a83a7a";x.beginPath();x.ellipse(96+s*R.r(3,9),y-k*2,3.4,2.2,s*.5,0,TAU);x.fill();}}}
  const t=new T.CanvasTexture(cv);t.encoding=T.sRGBEncoding;t.anisotropy=4;return t;}
/* far LOD: two crossed textured quads (a "card" holding many painted blades) */
function cardGeometry(R,segs,u0,u1,ng){const G=newG();
  for(let q=0;q<2;q++){const a=q*PI/2+R()*.3,ax=Math.cos(a),az=Math.sin(a),nx=-az,nz=ax,base=G.pos.length/3;
    for(let i=0;i<=segs;i++){const t=i/segs;for(let j=0;j<2;j++){const x=(j?.5:-.5);G.pos.push(ax*x,t,az*x);const n=new V3(nx*.45,1,nz*.45).normalize();
        G.nor.push(n.x,n.y,n.z);G.uv.push(j?u1:u0,t);G.av.push(R(),.45+.55*t,3,j);}}
    for(let i=0;i<segs;i++){const b=base+i*2,c=base+(i+1)*2;G.idx.push(b,c,b+1,b+1,c,c+1);}
    for(let k=0;k<ng;k++){const t=R.r(.35,.85),x=R.s()*.3;G.glint.push(new V3(ax*x,t,az*x));}}
  return G;}
function cardAtlas(ql){const W=QS(ql,256,512,512),Hh=W/2,cv=mkCanvas(W,Hh),x=cv.getContext("2d"),R=RNG(57);x.clearRect(0,0,W,Hh);
  const blade=(x0,y0,len,ang,bend,w0,lum,mid)=>{const pts=[];const n=10;for(let i=0;i<=n;i++){const t=i/n,a=ang+bend*t*t;pts.push([x0+Math.sin(a)*len*t,y0-Math.cos(a)*len*t]);}
    /* tapered polygon */x.beginPath();for(let i=0;i<=n;i++){const t=i/n,w=w0*(1-Math.pow(t,1.6))+.3;const p=pts[i],q=pts[Math.min(n,i+1)],dx=q[0]-p[0]||1e-3,dy=q[1]-p[1];const l=Math.hypot(dx,dy)||1;
      x.lineTo(p[0]-dy/l*w*.5,p[1]+dx/l*w*.5);}for(let i=n;i>=0;i--){const t=i/n,w=w0*(1-Math.pow(t,1.6))+.3;const p=pts[i],q=pts[Math.min(n,i+1)],dx=q[0]-p[0]||1e-3,dy=q[1]-p[1];const l=Math.hypot(dx,dy)||1;
      x.lineTo(p[0]+dy/l*w*.5,p[1]-dx/l*w*.5);}x.closePath();const L=Math.round(lum*255);
    const g=x.createLinearGradient(x0,y0,pts[n][0],pts[n][1]);g.addColorStop(0,"rgb("+Math.round(L*.55)+","+Math.round(L*.55)+","+Math.round(L*.55)+")");g.addColorStop(1,"rgb("+L+","+L+","+L+")");
    x.fillStyle=g;x.fill();if(mid){x.strokeStyle="rgba(255,255,255,.55)";x.lineWidth=Math.max(.6,w0*.18);x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.stroke();}};
  const hw=W/2;
  /* left: dense low-grass tuft */
  for(let i=0;i<QS(ql,30,40,44);i++){const x0=hw*.5+R.g()*hw*.16,len=Hh*R.r(.3,.97)*(R()<.3?.6:1),ang=R.g()*.5,bend=R.s()*1.1;blade(x0,Hh,len,ang,bend,R.r(2,3.6)*W/512,R.r(.62,1),false);}
  /* right: susuki clump with arching leaves (midrib) */
  for(let i=0;i<QS(ql,16,20,22);i++){const x0=hw*1.5+R.s()*hw*.06,len=Hh*R.r(.6,1.2),side=R()<.5?-1:1,ang=side*R.r(.03,.4),bend=side*R.r(.8,2.2);blade(x0,Hh,len,ang,bend,R.r(2.6,4.4)*W/512,R.r(.7,1),true);}
  const t=new T.CanvasTexture(cv);t.encoding=T.sRGBEncoding;t.anisotropy=4;t.wrapS=t.wrapT=T.ClampToEdgeWrapping;return t;}
function glintGeometry(cands,R){/* one camera-facing quad per candidate */
  const n=cands.length,pos=new Float32Array(n*12),cor=new Float32Array(n*8),ag=new Float32Array(n*16),idx=[];
  cands.forEach((p,i)=>{const r1=R(),r2=R(),sz=Math.pow(R(),2.2);const C=[[-1,-1],[1,-1],[1,1],[-1,1]];
    for(let k=0;k<4;k++){pos.set([p.x,p.y,p.z],(i*4+k)*3);cor.set(C[k],(i*4+k)*2);ag.set([r1,r2,sz,0],(i*4+k)*4);}
    const b=i*4;idx.push(b,b+1,b+2,b,b+2,b+3);});
  const g=new T.BufferGeometry();g.setAttribute("position",new T.BufferAttribute(pos,3));g.setAttribute("aCorner",new T.BufferAttribute(cor,2));
  g.setAttribute("aG",new T.BufferAttribute(ag,4));g.setIndex(idx);return g;}

/* shared GLSL for the field */
const GLSL_FIELD_V=`
uniform float uTime;uniform vec4 uWind;uniform vec4 uLod;uniform float uShow;
attribute vec4 aInst;
${GLSL_NOISE}
float flGust;
vec3 flWind(vec3 b,float h,float ph,float H,float flex){
  vec2 wd=uWind.yz;float st=uWind.x;
  float al=dot(b.xz,wd),ac=dot(b.xz,vec2(-wd.y,wd.x));
  float g1=flN2(vec2(al*0.055-uTime*uWind.w*0.30,ac*0.045));
  float g2=flN2(vec2(al*0.2-uTime*uWind.w*1.0,ac*0.18+7.3));
  flGust=smoothstep(0.32,0.92,g1)*0.85+g2*0.3;
  float sw=sin(uTime*1.7+ph*6.2832+al*0.45)*0.5+sin(uTime*2.9+ph*13.0)*0.22;
  float bend=st*(0.16+0.95*flGust+0.3*sw*(0.4+flGust));
  float fl=st*(0.4+flGust)*0.06*sin(uTime*7.0+ph*21.0+h*5.0)*flex;
  vec2 d=wd*bend+vec2(-wd.y,wd.x)*(fl+st*0.07*sin(uTime*1.2+ph*9.0));
  vec3 disp=vec3(d.x,0.0,d.y)*h*h*H*0.5*flex;
  disp.y=-dot(disp.xz,disp.xz)/max(H*max(h,0.15),0.05)*0.5;
  return disp;
}
mat3 flM;vec3 flBase;float flH;float flVis;float flWiden;
void flInst(){
  flM=mat3(modelMatrix)*mat3(instanceMatrix);flBase=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;flH=length(flM[1]);
  float dist=length(cameraPosition.xz-flBase.xz);
  float keep=clamp(pow(uLod.x/max(dist,uLod.x),uLod.y),uLod.z,1.0);
  flVis=clamp((keep-aInst.w)/(0.15*keep+0.002),0.0,1.0);
  flWiden=min(inversesqrt(keep),uLod.w);
}
vec3 flLocal(vec3 wd){return vec3(dot(flM[0],wd)/dot(flM[0],flM[0]),dot(flM[1],wd)/dot(flM[1],flM[1]),dot(flM[2],wd)/dot(flM[2],flM[2]));}
`;
function fieldMaterial(kind,ql,FU,o){o=o||{};
  const lambert=ql===0&&!o.standard;
  const M=lambert?new T.MeshLambertMaterial({side:T.DoubleSide,color:0xffffff}):new T.MeshStandardMaterial({side:T.DoubleSide,color:0xffffff,roughness:o.rough||.62,metalness:0});
  if(o.map){M.map=o.map;M.alphaTest=o.alphaTest||.2;M.alphaToCoverage=true;}
  M.onBeforeCompile=(sh)=>{
    for(const k in FU)sh.uniforms[k]=FU[k];if(o.uniforms)for(const k in o.uniforms)sh.uniforms[k]=o.uniforms[k];
    sh.vertexShader=sh.vertexShader.replace("#include <common>",`#include <common>
${GLSL_FIELD_V}
attribute vec4 aV;uniform vec3 uPal[9];uniform float uDry,uMidrib,uFrost;
varying vec3 vGCol;varying vec3 vGW;varying float vGH;varying float vGGust;varying float vGPart;varying vec2 vGUv;
${o.vDecl||""}`).replace("#include <begin_vertex>",`
  flInst();
  vec3 transformed=vec3(position);
  float sp=floor(aInst.y+0.5);
  ${o.vPre||""}
  transformed.xz*=flWiden;transformed.y*=flVis*uShow;
  float gh=clamp(position.y,0.0,1.6);
  vec3 gD=flWind(flBase,gh,aInst.z,flH,${o.flex||"1.0"});
  transformed+=flLocal(gD);
  vGW=flBase+flM*transformed;vGH=gh;vGGust=flGust;vGPart=aV.z;vGUv=uv;
  /* colour: species palette, blade randomness, seasonal dryness, AO */
  int si=int(sp);vec3 cb=uPal[0],ct=uPal[1],cd=uPal[2];
  if(si==1){cb=uPal[3];ct=uPal[4];cd=uPal[5];}else if(si>=2){cb=uPal[6];ct=uPal[7];cd=uPal[8];}
  float rnd=fract(aV.x*7.31+aInst.x*3.7);
  vec3 col=mix(cb,ct,smoothstep(0.0,1.0,gh*0.9+rnd*0.2));
  float dry=step(rnd,uDry)+step(1.5,aV.z)*0.85;dry=clamp(dry,0.0,1.0);
  col=mix(col,cd*(0.85+0.3*rnd),dry*smoothstep(-0.2,0.6,gh+rnd*0.3));
  ${o.vCol||""}
  col*=(0.82+0.36*fract(aInst.x*13.17))*aV.y;
  vGCol=col;
`);
    if(o.cardA2C)sh.fragmentShader=sh.fragmentShader.replace("#include <alphatest_fragment>",`{float tl=max(0.0,log2(max(length(fwidth(vUv))*uTexW,1.0)));diffuseColor.a*=1.0+min(tl,4.0)*0.12;
      diffuseColor.a=clamp((diffuseColor.a-0.5)/max(fwidth(diffuseColor.a),1e-4)+0.5,0.0,1.0);}
#include <alphatest_fragment>`).replace("#include <common>","#include <common>\nuniform float uTexW;");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>",`#include <common>
uniform vec3 uSunDir,uSunCol;uniform float uSunI,uDew,uTime,uFrost;
varying vec3 vGCol;varying vec3 vGW;varying float vGH;varying float vGGust;varying float vGPart;varying vec2 vGUv;
${GLSL_NOISE}`).replace("#include <color_fragment>",`#include <color_fragment>
  diffuseColor.rgb*=vGCol${o.fCol||""};`);
    if(!lambert){
      const lb=T.ShaderChunk.lights_fragment_begin,key="RE_Direct( directLight, geometry, material, reflectedLight );",i0=lb.indexOf("getDirectionalDirectLightIrradiance"),i1=lb.indexOf(key,i0);
      const lb2=lb.slice(0,i1)+`{float gdd=dot(directLight.direction,gSunV);if(gdd>gBest){gBest=gdd;gSunVis=dot(directLight.color,vec3(1.0))/max(dot(directionalLight.color,vec3(1.0)),1e-5);}}
`+lb.slice(i1);
      sh.fragmentShader=sh.fragmentShader.replace("#include <lights_fragment_begin>",`vec3 gSunV=normalize((viewMatrix*vec4(uSunDir,0.0)).xyz);float gBest=-2.0;float gSunVis=1.0;
`+lb2);
    }else{
      sh.fragmentShader=sh.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\n vec3 gSunV=normalize((viewMatrix*vec4(uSunDir,0.0)).xyz);float gSunVis=getShadowMask();");
    }
    sh.fragmentShader=sh.fragmentShader.replace("gl_FragColor = vec4( outgoingLight, diffuseColor.a );",`
  {vec3 gV=normalize(cameraPosition-vGW);float fwd=max(dot(-gV,uSunDir),0.0);
   vec3 nV=normalize(vNormalFL)*(gl_FrontFacing?1.0:-1.0);float back=max(-dot(nV,gSunV),0.0);
   float sv=gSunVis*step(0.0,uSunDir.y+0.05);
   /* translucency (back-lit blades glow) */
   vec3 tc=mix(diffuseColor.rgb*diffuseColor.rgb*4.0,diffuseColor.rgb,0.4);
   outgoingLight+=tc*uSunCol*uSunI*(back*${o.transBack||"0.45"}+pow(fwd,5.0)*${o.transFwd||"0.9"})*sv*(0.3+0.7*vGH);
   /* dew: wet sheen that whitens the field toward the sun, frost in winter */
   float dewS=uDew*(0.02+0.55*pow(fwd,7.0)+0.18*pow(fwd,2.0))*(0.45+0.55*vGH);
   outgoingLight+=uSunCol*uSunI*dewS*sv*vec3(0.92,0.95,1.0)*${o.dewK||"0.6"};
   outgoingLight=mix(outgoingLight,vec3(0.75,0.8,0.86)*(0.35+0.5*uSunI),uFrost*0.35*smoothstep(0.2,1.0,vGH));
   /* gusts flatten the blades: brighter sheen travelling across the field */
   outgoingLight*=1.0+vGGust*0.12;
   ${o.fExtra||""}
  }
  gl_FragColor = vec4( outgoingLight, diffuseColor.a );`);
    sh.vertexShader=sh.vertexShader.replace("void main() {","varying vec3 vNormalFL;\nvoid main() {").replace("#include <defaultnormal_vertex>","#include <defaultnormal_vertex>\n vNormalFL=transformedNormal;");
    sh.fragmentShader=sh.fragmentShader.replace("void main() {","varying vec3 vNormalFL;\nvoid main() {");
    if(o.onShader)o.onShader(sh);
  };
  if(o.cardA2C)M.extensions={derivatives:true};
  M.customProgramCacheKey=()=>"flora_field_"+kind+"_"+ql+"_"+(lambert?"L":"S");
  return M;
}
/* dew glints on blades: tiny camera-facing gaussians, size never below ~1.4 px (energy conserving), twinkle with view & wind */
function glintMaterial(FU){
  return new T.ShaderMaterial({uniforms:Object.assign({},FU,T.UniformsUtils.clone(T.UniformsLib.fog)),transparent:true,depthWrite:false,fog:true,blending:T.AdditiveBlending,
    vertexShader:`${GLSL_FIELD_V}
      uniform vec3 uSunDir,uSunCol;uniform float uSunI,uDew,uPixK,uGlintK;
      attribute vec2 aCorner;attribute vec4 aG;varying vec2 vC;varying vec3 vCol;
      #include <fog_pars_vertex>
      void main(){flInst();
        vec3 lp=position;lp.xz*=flWiden;lp.y*=flVis*uShow;
        float gh=clamp(position.y,0.0,1.6);vec3 gD=flWind(flBase,gh,aInst.z,flH,1.0);
        vec3 wp=flBase+flM*(lp)+gD;
        vec3 toC=cameraPosition-wp;float dist=length(toC);vec3 V=toC/dist;
        float fwd=dot(-V,uSunDir);
        float ph=0.05+1.3*pow(max(fwd,0.0),4.0)+7.0*pow(max(fwd,0.0),30.0)+0.9*pow(max(-fwd,0.0),50.0);
        float tw=sin(aG.x*628.3+dot(V,vec3(31.0,47.0,23.0))*(3.0+aG.y*7.0)+uTime*(1.1+aG.y*2.6)+flGust*6.0);
        tw=pow(0.5+0.5*tw,5.0);
        float r=mix(0.0008,0.0024,aG.z);
        float pix=dist*uPixK;float sz=max(r*1.6,pix*1.45);float en=(r*1.6)/sz;en*=en;
        float I=uDew*uSunI*ph*(0.12+2.8*tw)*en*uGlintK*step(0.0,uSunDir.y+0.03)*flVis*uShow;
        I*=smoothstep(85.0,30.0,dist);
        vCol=mix(uSunCol,vec3(1.0),0.6)*I*mix(vec3(1.0),vec3(1.0,0.9,0.8),aG.y*0.5);
        vec4 mv=viewMatrix*vec4(wp,1.0);mv.xyz+=normalize(-mv.xyz)*min(0.04,dist*0.012);
        if(I<0.004){gl_Position=vec4(2.0,2.0,2.0,1.0);vC=vec2(0.0);return;}
        mv.xy+=aCorner*sz;vC=aCorner;gl_Position=projectionMatrix*mv;
        vec4 mvPosition=mv;
        #include <fog_vertex>
      }`,
    fragmentShader:`varying vec2 vC;varying vec3 vCol;
      #include <fog_pars_fragment>
      void main(){float d2=dot(vC,vC);float a=exp(-d2*5.5)+exp(-d2*1.6)*0.06;
        gl_FragColor=vec4(vCol*a,1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            float fogFactor=1.0-exp(-fogDensity*fogDensity*fogDepth*fogDepth);
          #else
            float fogFactor=smoothstep(fogNear,fogFar,fogDepth);
          #endif
          gl_FragColor.rgb*=1.0-fogFactor;
        #endif
      }`});
}
function makeGrassField(opts){opts=opts||{};
  const ql=qlevel(opts),bag=Bag(),seed=opts.seed||1234,R=RNG(seed*13+5);
  const width=opts.width||120,depth=opts.depth||120,c0=opts.center||[0,0],cx=c0[0],cz=c0[1];
  const heightAt=opts.heightAt||(()=>0),mask=opts.mask||null,season0=FIELD_PAL[opts.season]?opts.season:"autumn";
  const mixW=Object.assign({susuki:.24,ogi:.05,chigaya:.12,enokoro:.12,low:.52,flowers:.025},opts.species||{});
  const focus=new V3(...(opts.focus?[opts.focus[0],0,opts.focus[1]]:[cx,0,cz]));
  const root=new T.Group();root.name="flora_grass_field";
  /* ---- shared uniforms ---- */
  const FU={uTime:{value:0},uWind:{value:new T.Vector4(.5,.8,.6,1)},uLod:{value:new T.Vector4(QS(ql,9,12,15),QS(ql,1.35,1.2,1.1),.06,QS(ql,3.2,2.8,2.6))},uShow:{value:1},
    uSunDir:{value:new V3(.95,.25,.17).normalize()},uSunCol:{value:lin(0xffcf9a)},uSunI:{value:1},uDew:{value:opts.dew===false?0:1},uPixK:{value:.0013},uGlintK:{value:QS(ql,6,6.5,7)},uFrost:{value:0}};
  {const w=FU.uWind.value,l=Math.hypot(w.y,w.z);w.y/=l;w.z/=l;}
  const pals={tuft:{value:palArray(season0,"tuft")},clump:{value:palArray(season0,"clump")},plume:{value:palArray(season0,"plume")},flower:{value:palArray(season0,"tuft")}};
  const target={};for(const k in pals)target[k]=pals[k].value.map(c=>c.clone());
  const P0=FIELD_PAL[season0];
  const S={dry:{value:P0.dry},mid:{value:P0.midrib},plume:{value:P0.plumeV},flower:{value:P0.flowerV}};const Sgoal={dry:P0.dry,mid:P0.midrib,plume:P0.plumeV,flower:P0.flowerV,frost:P0.frost};
  FU.uFrost.value=P0.frost;
  const stemCol={value:lin(P0.stem)},stemGoal=lin(P0.stem);
  /* ---- budgets (instances per call; triangles stay under high 450k / medium 220k / low 90k) ---- */
  const BUD=QS(ql,{nearT:900,farT:3000,nearC:110,farC:300,plume:420,fox:80,flower:50,turf:40,tBl:3,tSeg:3,tG:1,cBl:7,cSeg:3,cG:2,rac:4,cardSeg:1,cardG:0,rN:7},
                 {nearT:1800,farT:5000,nearC:240,farC:600,plume:900,fox:180,flower:100,turf:64,tBl:4,tSeg:3,tG:2,cBl:9,cSeg:3,cG:3,rac:5,cardSeg:2,cardG:1,rN:9},
                 {nearT:3000,farT:9000,nearC:440,farC:1000,plume:1500,fox:380,flower:150,turf:96,tBl:5,tSeg:3,tG:3,cBl:11,cSeg:4,cG:4,rac:6,cardSeg:2,cardG:1,rN:11});
  if(opts.budget)Object.assign(BUD,opts.budget);
  if(opts.count){const k=opts.count/(BUD.nearT+BUD.farT);for(const key of ["nearT","farT","nearC","farC","plume","fox","flower"])BUD[key]=Math.max(1,Math.round(BUD[key]*Math.min(1,k)));}
  const rN=opts.nearRadius||BUD.rN;
  const inField=(x,z)=>Math.abs(x-cx)<=width/2&&Math.abs(z-cz)<=depth/2;
  const mk=(x,z)=>mask?clamp(mask(x,z),0,1):1;
  const patch=(x,z,s)=>fbm(x*.045+s,z*.045-s,seed+s*7,3);
  const M4=new T.Matrix4(),Q=new T.Quaternion(),E=new T.Euler(),SC=new V3(),PS=new V3();
  function mat(x,z,yaw,sx,sy,tilt,tiltDir,sink){const y=heightAt(x,z)-(sink||.02);E.set(Math.cos(tiltDir)*tilt,yaw,Math.sin(tiltDir)*tilt,"YXZ");Q.setFromEuler(E);
    PS.set(x,y,z);SC.set(sx,sy,sx);M4.compose(PS,Q,SC);return M4.clone();}
  /* deterministic low-discrepancy sampler around the focus: radial density ~ 1/(1+(r/r0)^2) inside [rIn,rOut] */
  function sampleDisc(n,rIn,rOut,r0,salt,accept,emit){let k=0,i=0;const lo=Math.log(1+(rIn/r0)*(rIn/r0)),hi=Math.log(1+(rOut/r0)*(rOut/r0));
    while(k<n&&i<n*8){i++;const u1=fract(i*.6180339887+salt*.137),u2=fract(i*.7548776662+salt*.311),u3=h2(i,salt,seed);
      const r=r0*Math.sqrt(Math.exp(lo+(hi-lo)*u1)-1),a=u2*TAU,x=focus.x+Math.cos(a)*r,z=focus.z+Math.sin(a)*r;
      if(!inField(x,z))continue;if(u3>mk(x,z)*(accept?accept(x,z,r):1))continue;emit(x,z,r,h2(i,salt+1,seed),h2(i,salt+2,seed),h2(i,salt+3,seed));k++;}return k;}
  /* stratified sampler over the whole field (far tier), density ramps in beyond rIn */
  function sampleField(n,rIn,salt,accept,emit){const cells=Math.ceil(Math.sqrt(n*2.2)),cw=width/cells,cd=depth/cells,cand=[];
    for(let i=0;i<cells;i++)for(let j=0;j<cells;j++){const x=cx-width/2+(i+h2(i,j,salt))*cw,z=cz-depth/2+(j+h2(i,j,salt+5))*cd,r=Math.hypot(x-focus.x,z-focus.z);
      let w=mk(x,z)*sstep(rIn*.75,rIn*1.1,r)*(.35+.65/(1+Math.pow(r/(rIn*3.2),2)));if(accept)w*=accept(x,z,r);if(w<=0)continue;cand.push([h2(i,j,salt+9)/w,x,z,r,h2(i,j,salt+13),h2(i,j,salt+17)]);}
    cand.sort((a,b)=>a[0]-b[0]);const m=Math.min(n,cand.length);for(let k=0;k<m;k++){const c=cand[k];emit(c[1],c[2],c[3],c[4],c[5],h2(k,salt,seed));}return m;}
  const wT=mixW.low+mixW.chigaya+mixW.enokoro,wl=mixW.low/wT,wc=mixW.chigaya/wT,wsus=mixW.susuki+mixW.ogi;
  const pickSp=(x,z,a)=>{const pc=patch(x,z,1.7),v=a*(1+(pc-.5)*1.2);return v>wl?(v>wl+wc*(1+(pc-.5))?2:1):0;};
  const susPatch=(x,z)=>sstep(.3,.6,patch(x,z,4.1))*1.5+.15;
  /* near tufts (geometric blades) */
  const tufts=[],cards=[],clumps=[],ccards=[],plumes=[],foxes=[],flowers=[];
  sampleDisc(BUD.nearT,0,rN,rN*.5,11,null,(x,z,r,a,b,c)=>{const sp=pickSp(x,z,a),pc=patch(x,z,1.7);
    const H=(sp===1?R.r(.3,.58):sp===2?R.r(.32,.55):R.r(.24,.5))*(.85+.3*pc),grow=1+.6*sstep(rN*.5,rN,r);
    tufts.push({m:mat(x,z,b*TAU,H*R.r(.8,1.2)*grow,H,R()*.12,R()*TAU),i:[c,sp,R(),R()],sp});});
  /* far grass cards */
  sampleField(BUD.farT,rN,21,null,(x,z,r,a,b,c)=>{const sp=pickSp(x,z,a),pc=patch(x,z,1.7);const H=R.r(.3,.62)*(.85+.3*pc)*(1+.25*sstep(rN,rN*5,r));
    cards.push({m:mat(x,z,b*TAU,H*R.r(1.2,1.7),H,R()*.08,R()*TAU),i:[c,sp,R(),R()]});});
  /* susuki / ogi clumps: near (geometric) and far (cards), patchy */
  if(wsus>0){const kS=Math.min(1.6,wsus/.29);
    sampleDisc(Math.round(BUD.nearC*kS),0,rN*1.5,rN*.8,31,susPatch,(x,z,r,a,b,c)=>{const sp=a<mixW.ogi/wsus?1:0,H=sp?R.r(1.2,1.65):R.r(.9,1.3);
      clumps.push({m:mat(x,z,b*TAU,H*R.r(.85,1.2),H,R()*.08,R()*TAU,.03),i:[c,sp,R(),R()],x,z,H,sp,near:true});});
    sampleField(Math.round(BUD.farC*kS),rN*1.4,41,susPatch,(x,z,r,a,b,c)=>{const sp=a<mixW.ogi/wsus?1:0,H=sp?R.r(1.2,1.65):R.r(.9,1.3);
      ccards.push({m:mat(x,z,b*TAU,H*R.r(1.1,1.5),H,R()*.06,R()*TAU,.03),i:[c,sp,R(),R()],x,z,H,sp,near:false});});}
  /* plumes: near clumps get 2-4 culms, far clumps 1-2 (silver plumes define the susuki field from afar) */
  {const all=clumps.concat(ccards);let guard=0;
    for(let pass=0;pass<4&&plumes.length<BUD.plume&&guard<1e5;pass++)for(const cl of all){if(plumes.length>=BUD.plume)break;guard++;
      const want=cl.near?(cl.sp?2:4):(cl.sp?1:2);if(pass>=want)continue;
      const a=R()*TAU,d=R.r(.02,.18)*cl.H,x=cl.x+Math.cos(a)*d,z=cl.z+Math.sin(a)*d,H=cl.H*R.r(1.25,1.6)*(cl.sp?1.15:1);
      plumes.push({m:mat(x,z,R()*TAU,H*R.r(.9,1.1),H,R.r(.03,.16),a,.03),i:[R(),cl.sp,R(),cl.i[3]]});}}
  /* foxtails near the focus with enokoro tufts */
  for(const t of tufts){if(foxes.length>=BUD.fox)break;if(t.sp!==2||R()>.55)continue;const p=new V3().setFromMatrixPosition(t.m);
    const a=R()*TAU,d=R.r(.02,.08),H=R.r(.38,.7);foxes.push({m:mat(p.x+Math.cos(a)*d,p.z+Math.sin(a)*d,R()*TAU,H,H,R.r(.05,.2),a),i:[R(),2,R(),t.i[3]]});}
  /* autumn flowers (accents, patchy, within ~2.5 near radii) */
  if(mixW.flowers>0)sampleDisc(Math.round(BUD.flower*Math.min(2,mixW.flowers/.025)),0,rN*2.6,rN*1.2,51,(x,z)=>sstep(.42,.68,patch(x,z,8.3))*1.4+.1,(x,z,r,a,b,c)=>{
    const v=a<.4?0:(a<.72?1:2),H=v===0?R.r(.75,1.05):v===1?R.r(.5,.75):R.r(.6,.9);flowers.push({m:mat(x,z,b*TAU,H,H,R()*.1,R()*TAU),i:[c,v,R(),R()]});});
  /* sort near-to-far from the focus (front-to-back helps early-z) */
  const byDist=(a,b)=>{const pa=a.m.elements,pb=b.m.elements;return Math.hypot(pa[12]-focus.x,pa[14]-focus.z)-Math.hypot(pb[12]-focus.x,pb[14]-focus.z);};
  tufts.sort(byDist);cards.sort(byDist);clumps.sort(byDist);ccards.sort(byDist);plumes.sort(byDist);
  /* ---- meshes ---- */
  const GR=RNG(seed+99);let triTotal=0;const tri={};
  function build(list,G,matl,name,glints){if(!list.length)return null;const g=bag.add(finishG(G));const n=list.length;
    const im=new T.InstancedMesh(g,matl,n);const ai=new Float32Array(n*4);
    list.forEach((e,i)=>{im.setMatrixAt(i,e.m);ai.set(e.i,i*4);});
    const aInst=new T.InstancedBufferAttribute(ai,4);g.setAttribute("aInst",aInst);
    im.instanceMatrix.needsUpdate=true;im.frustumCulled=false;im.name=name;im.receiveShadow=true;im.castShadow=false;root.add(im);
    tri[name]=n*g.index.count/3;triTotal+=tri[name];
    if(glints&&G.glint.length){const gg=bag.add(glintGeometry(G.glint,GR));gg.setAttribute("aInst",aInst);
      const gm=new T.InstancedMesh(gg,glintMat,n);gm.instanceMatrix=im.instanceMatrix;gm.frustumCulled=false;gm.renderOrder=5;gm.name=name+"_glints";gm.castShadow=gm.receiveShadow=false;
      gm.onBeforeRender=onGlint;root.add(gm);im.userData.glints=gm;tri[name+"_glints"]=n*gg.index.count/3;triTotal+=tri[name+"_glints"];}
    return im;}
  const glintMat=bag.add(glintMaterial(FU));
  const _sz=new T.Vector2();const onGlint=(renderer,scene,camera)=>{renderer.getDrawingBufferSize(_sz);const f=camera.isPerspectiveCamera?2*Math.tan(camera.fov*PI/360)/Math.max(1,camera.zoom):.002;FU.uPixK.value=f/Math.max(1,_sz.y);};
  const noLod={value:new T.Vector4(1e4,1,1,1)},farLod={value:new T.Vector4(QS(ql,16,22,28),1.0,QS(ql,.3,.35,.4),1.7)};
  /* near tufts */
  const tG=tuftGeometry(RNG(seed+1),BUD.tBl,BUD.tSeg,BUD.tG);
  const tuftMat=bag.add(fieldMaterial("tuft",ql,FU,{uniforms:{uPal:pals.tuft,uDry:S.dry,uMidrib:S.mid,uLod:noLod},transBack:"0.4",transFwd:"0.85"}));
  const tuftMesh=build(tufts,tG,tuftMat,"tufts",true);
  /* far cards (grass + susuki clumps share the atlas and material) */
  const cAtlas=bag.add(cardAtlas(ql));
  const cardOpts=(pal)=>({map:cAtlas,alphaTest:.02,uniforms:{uPal:pal,uDry:S.dry,uMidrib:S.mid,uLod:farLod,uTexW:{value:cAtlas.image.width}},
    vCol:"col*=1.08;",transBack:"0.45",transFwd:"0.9",cardA2C:true});
  const cardMat=bag.add(fieldMaterial("card",ql,FU,cardOpts(pals.tuft)));
  const cardMesh=build(cards,cardGeometry(RNG(seed+6),BUD.cardSeg,0,.5,BUD.cardG),cardMat,"cards",BUD.cardG>0);
  const ccardMat=bag.add(fieldMaterial("ccard",ql,FU,cardOpts(pals.clump)));
  const ccardMesh=build(ccards,cardGeometry(RNG(seed+7),BUD.cardSeg,.5,1,0),ccardMat,"clumpCards",false);
  /* near susuki clumps */
  const cG=clumpGeometry(RNG(seed+2),BUD.cBl,BUD.cSeg,BUD.cG);
  const clumpMat=bag.add(fieldMaterial("clump",ql,FU,{uniforms:{uPal:pals.clump,uDry:S.dry,uMidrib:S.mid,uLod:noLod},
    vCol:"col=mix(col,vec3(0.85,0.86,0.78)*(0.6+0.4*col.g/max(col.r,0.01)),uMidrib*0.55*(1.0-smoothstep(0.08,0.2,abs(uv.x-0.5)))*step(aV.z,0.5));",transBack:"0.5",transFwd:"0.9"}));
  const clumpMesh=build(clumps,cG,clumpMat,"clumps",true);
  if(clumpMesh&&ql===2&&opts.shadows!==false){clumpMesh.castShadow=true;clumpMesh.customDepthMaterial=bag.add(depthMat(FU,"1.0",null));}
  const atlas=bag.add(fieldAtlas(ql));
  const pG=plumeGeometry(RNG(seed+3),ql,"susuki",BUD.rac);
  const plumeVis=`if(aV.z>0.5){vec3 pv=vec3(0.0,0.84,0.0);transformed=pv+(transformed-pv)*mix(0.15,1.0,uPlume);}
    if(uPlume<0.02)transformed*=0.0;`;
  const plumeMat=bag.add(fieldMaterial("plume",ql,FU,{map:atlas,alphaTest:.18,standard:true,rough:.5,uniforms:{uPal:pals.plume,uDry:S.dry,uMidrib:S.mid,uPlume:S.plume,uStem:stemCol,uLod:noLod},
    vDecl:"uniform float uPlume;uniform vec3 uStem;",vPre:plumeVis,flex:"1.25",
    vCol:"if(aV.z<0.5)col=uStem*(0.7+0.5*gh);",transBack:"0.9",transFwd:"2.2",dewK:"0.9",
    fExtra:"outgoingLight+=uSunCol*uSunI*pow(fwd,3.0)*0.5*sv*vGCol*step(0.5,vGPart);"}));
  const plumeMesh=build(plumes,pG,plumeMat,"plumes",false);
  const fG=plumeGeometry(RNG(seed+4),ql,"foxtail");
  const foxMat=bag.add(fieldMaterial("fox",ql,FU,{map:atlas,alphaTest:.2,standard:true,uniforms:{uPal:pals.plume,uDry:S.dry,uMidrib:S.mid,uStem:stemCol,uLod:noLod},vDecl:"uniform vec3 uStem;",flex:"1.2",
    vCol:"if(aV.z<0.5)col=mix(uPal[6],uStem,0.4)*(0.7+0.4*gh);",transBack:"0.8",transFwd:"1.6"}));
  const foxMesh=build(foxes,fG,foxMat,"foxtails",false);
  const flAtlas=bag.add(flowerAtlas());
  const flG=flowerGeometry(RNG(seed+5),ql);
  const flMat=bag.add(fieldMaterial("flower",ql,FU,{map:flAtlas,alphaTest:.3,standard:true,uniforms:{uPal:pals.tuft,uDry:S.dry,uMidrib:S.mid,uFlower:S.flower,uLod:noLod},
    vDecl:"uniform float uFlower;",vPre:"float fv=floor(aV.z-9.5+0.5);if(abs(fv-sp)>0.5||uFlower<0.02)transformed*=0.0;else transformed*=mix(0.3,1.0,uFlower);",
    vCol:"col=(uv.x>0.7&&uv.x<0.8&&fv<1.5)?vec3(0.9,1.25,0.6):vec3(1.0);",transBack:"0.5",transFwd:"0.7"}));
  const flMesh=build(flowers,flG,flMat,"flowers",false);
  /* ---- turf: a ground-hugging layer that carries colour, sheen and the far-field shimmer ---- */
  let turf=null;if(opts.turf!==false){const nx=BUD.turf,nz=Math.max(8,Math.round(nx*depth/width));
    const tg=new T.PlaneGeometry(width,depth,nx,nz);tg.rotateX(-PI/2);tg.translate(cx,0,cz);
    const pa=tg.attributes.position.array,am=new Float32Array(pa.length/3);
    for(let i=0;i<pa.length;i+=3){pa[i+1]=heightAt(pa[i],pa[i+2])+.012;am[i/3]=mask?clamp(mask(pa[i],pa[i+2]),0,1):1;}
    tg.setAttribute("aMask",new T.BufferAttribute(am,1));tg.computeVertexNormals();bag.add(tg);
    const turfPal={value:palArray(season0,"turf")};pals.turf=turfPal;target.turf=turfPal.value.map(c=>c.clone());
    const tm=ql===0?new T.MeshLambertMaterial({color:0xffffff}):new T.MeshStandardMaterial({color:0xffffff,roughness:.9,metalness:0});
    tm.polygonOffset=true;tm.polygonOffsetFactor=-1;tm.polygonOffsetUnits=-1;
    tm.onBeforeCompile=(sh)=>{for(const k in FU)sh.uniforms[k]=FU[k];sh.uniforms.uTurf=turfPal;
      sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nattribute float aMask;varying float vMask;varying vec3 vTW;").replace("#include <begin_vertex>","#include <begin_vertex>\nvMask=aMask;vTW=(modelMatrix*vec4(position,1.0)).xyz;");
      sh.fragmentShader=sh.fragmentShader.replace("#include <common>",`#include <common>
uniform vec3 uTurf[2];uniform vec3 uSunDir,uSunCol;uniform float uSunI,uDew,uTime,uFrost;varying float vMask;varying vec3 vTW;
${GLSL_NOISE}`).replace("#include <color_fragment>",`#include <color_fragment>
  if(vMask<0.5+0.4*(flN2(vTW.xz*2.2)-0.5)+0.18*(flH2(floor(vTW.xz*45.0))-0.5))discard;
  float tn=flN2(vTW.xz*0.35)*0.55+flN2(vTW.xz*1.7)*0.3+flN2(vTW.xz*7.0)*0.15;
  float tdist=length(cameraPosition-vTW);
  vec3 tcol=mix(uTurf[0],uTurf[1],smoothstep(0.25,0.85,tn));
  tcol=mix(tcol*0.62,tcol,smoothstep(3.0,25.0,tdist));
  diffuseColor.rgb=tcol;`).replace("gl_FragColor = vec4( outgoingLight, diffuseColor.a );",`
  {vec3 gV=normalize(cameraPosition-vTW);float fwd=max(dot(-gV,uSunDir),0.0);float sv=step(0.0,uSunDir.y+0.05);
   float far=smoothstep(6.0,40.0,tdist);
   outgoingLight+=diffuseColor.rgb*diffuseColor.rgb*3.0*uSunCol*uSunI*pow(fwd,5.0)*0.6*far*sv;
   /* far-field dew shimmer: sub-pixel drops averaged analytically, resolved drops twinkle (no aliasing) */
   vec2 cw=vTW.xz/0.05;vec2 ci=floor(cw);vec2 cf=fract(cw);float hh=flH2(ci);vec2 cc=vec2(flH2(ci+3.1),flH2(ci+7.7))*0.6+0.2;
   float px=length(fwidth(cw));float rr=0.045;float sg=max(rr,px*0.6);
   float gl=exp(-dot(cf-cc,cf-cc)/(2.0*sg*sg))*(rr*rr)/(sg*sg)*step(0.72,hh);
   float tw=pow(0.5+0.5*sin(hh*400.0+uTime*(1.0+hh*2.0)+dot(gV,vec3(37.0,41.0,29.0))*4.0),6.0);
   float avg=0.28*6.2832*rr*rr*0.4;
   float g=mix(gl*(0.2+2.6*tw),avg*1.1,smoothstep(0.35,1.2,px));
   float ph=0.04+1.2*pow(fwd,4.0)+6.0*pow(fwd,30.0);
   outgoingLight+=uSunCol*uSunI*uDew*g*ph*sv*2.2;
   outgoingLight+=uSunCol*uSunI*uDew*(0.02+0.5*pow(fwd,7.0))*sv*0.5*far;
   outgoingLight=mix(outgoingLight,vec3(0.75,0.8,0.86)*(0.35+0.5*uSunI),uFrost*0.3);}
  gl_FragColor = vec4( outgoingLight, diffuseColor.a );`);};
    tm.customProgramCacheKey=()=>"flora_turf_"+ql;tm.extensions={derivatives:true};
    turf=new T.Mesh(tg,bag.add(tm));turf.receiveShadow=true;turf.castShadow=false;turf.name="turf";turf.renderOrder=-1;root.add(turf);
    tri.turf=tg.index.count/3;triTotal+=tri.turf;}
  /* ---- API ---- */
  let time=0,seasonKey=season0;
  root.userData={
    focus,
    counts:{tufts:tufts.length,cards:cards.length,clumps:clumps.length,clumpCards:ccards.length,plumes:plumes.length,foxtails:foxes.length,flowers:flowers.length},
    stats:{triangles:Math.round(triTotal),perMesh:tri,drawCalls:root.children.length},
    update(dt,t,camera){if(t===undefined){time+=dt||0;t=time;}else time=t;FU.uTime.value=t;dt=clamp(dt||1/60,0,.25);
      const k=1-Math.exp(-dt*1.6);for(const key in pals){const a=pals[key].value,b=target[key];if(!b)continue;for(let i=0;i<a.length;i++)a[i].lerp(b[i],k);}
      S.dry.value=lerp(S.dry.value,Sgoal.dry,k);S.mid.value=lerp(S.mid.value,Sgoal.mid,k);S.plume.value=lerp(S.plume.value,Sgoal.plume,k);S.flower.value=lerp(S.flower.value,Sgoal.flower,k);
      FU.uFrost.value=lerp(FU.uFrost.value,Sgoal.frost,k);stemCol.value.lerp(stemGoal,k);},
    setSeason(key,instant){if(!FIELD_PAL[key])return;seasonKey=key;const P=FIELD_PAL[key];
      for(const kk of ["tuft","clump","plume"])target[kk]=palArray(key,kk);target.flower=palArray(key,"tuft");if(pals.turf)target.turf=palArray(key,"turf");
      Object.assign(Sgoal,{dry:P.dry,mid:P.midrib,plume:P.plumeV,flower:P.flowerV,frost:P.frost});stemGoal.copy(lin(P.stem));
      if(instant){for(const k in pals)if(target[k])pals[k].value.forEach((c,i)=>c.copy(target[k][i]));S.dry.value=P.dry;S.mid.value=P.midrib;S.plume.value=P.plumeV;S.flower.value=P.flowerV;FU.uFrost.value=P.frost;stemCol.value.copy(stemGoal);}},
    getSeason(){return seasonKey;},
    setSun(dir,color,intensity){if(dir){const d=dir.isVector3?dir.clone():new V3(dir[0],dir[1],dir[2]);if(d.lengthSq()>0)FU.uSunDir.value.copy(d.normalize());}
      if(color!==undefined&&color!==null)FU.uSunCol.value.copy(lin(color));if(intensity!==undefined)FU.uSunI.value=intensity;},
    setDew(v){FU.uDew.value=clamp(v,0,1.5);},
    setWind(strength,dx,dz){const w=FU.uWind.value;w.x=clamp(strength,0,2);if(dx!==undefined&&dz!==undefined){const l=Math.hypot(dx,dz)||1;w.y=dx/l;w.z=dz/l;}w.w=.7+.6*Math.min(1,strength);},
    setVisible(v){FU.uShow.value=clamp(v,0,1);},
    meshes:{turf,tufts:tuftMesh,cards:cardMesh,clumps:clumpMesh,clumpCards:ccardMesh,plumes:plumeMesh,foxtails:foxMesh,flowers:flMesh},
    dispose(){bag.dispose();}
  };
  root.userData.setSeason(season0,true);
  return root;
}
/* depth material for wind-animated shadows */
function depthMat(FU,flex,map){const m=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});if(map){m.map=map;m.alphaTest=.3;}
  m.onBeforeCompile=(sh)=>{for(const k in FU)sh.uniforms[k]=FU[k];
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\n"+GLSL_FIELD_V).replace("#include <begin_vertex>",`flInst();vec3 transformed=vec3(position);transformed.xz*=flWiden;transformed.y*=flVis*uShow;
      transformed+=flLocal(flWind(flBase,clamp(position.y,0.0,1.6),aInst.z,flH,${flex}));`);};
  m.customProgramCacheKey=()=>"flora_depth_"+flex+(map?"m":"");return m;}
/* ------------------------------------------------------------------
   8. perch macro sets: bark (singing cicada), reed leaf (resting mayfly), water film (spent mayfly)
      Set-local metres (the game scales a set x20). userData.perch is an Object3D whose +Y is the
      surface normal and +Z the forward direction (up the branch / toward the leaf tip / head on the
      water); the insects are modelled with +Z = head and +Y = up, so they are simply added to it.
      userData: perch, cameraHint {position,target,fov}, setSun(dir,color,intensity),
      update(dt,t,camera) (camera drives the depth-of-field focus), dispose().
   ------------------------------------------------------------------ */
function perchFrame(p,n,f,name){const o=new T.Object3D();o.name=name||"perch";const Y=n.clone().normalize(),Z=f.clone().addScaledVector(Y,-f.dot(Y)).normalize(),X=new V3().crossVectors(Y,Z);
  o.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(X,Y,Z));o.position.copy(p);return o;}
/* depth of field for lit standard materials: texture detail melts with distance from the focus plane (mip bias) */
function dofStandard(mat,D,key){
  mat.onBeforeCompile=(sh)=>{sh.uniforms.uFocusD=D.uFocusD;sh.uniforms.uDofK=D.uDofK;
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nvarying float vDofZ;").replace("#include <project_vertex>","#include <project_vertex>\nvDofZ=-mvPosition.z;");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nuniform float uFocusD,uDofK;varying float vDofZ;")
      .replace("#include <map_fragment>","float dofB=clamp(uDofK*abs(vDofZ-uFocusD)/max(uFocusD,1e-4),0.0,7.0);\n#ifdef USE_MAP\nvec4 texelColor=texture2D(map,vUv,dofB);texelColor=mapTexelToLinear(texelColor);diffuseColor*=texelColor;\n#endif")
      .replace("#include <roughnessmap_fragment>",T.ShaderChunk.roughnessmap_fragment.replace("texture2D( roughnessMap, vUv )","texture2D( roughnessMap, vUv, dofB )"))
      .replace("#include <normal_fragment_maps>",T.ShaderChunk.normal_fragment_maps.replace("texture2D( normalMap, vUv )","texture2D( normalMap, vUv, dofB )"));};
  mat.customProgramCacheKey=()=>"flora_dof_"+key;return mat;}
/* view-space focus distance of an object (for the depth-of-field uniforms) */
const _fv=new V3();
function focusOf(obj,camera){if(!camera||!obj)return null;obj.updateMatrixWorld();_fv.setFromMatrixPosition(obj.matrixWorld).applyMatrix4(camera.matrixWorldInverse);return Math.max(1e-4,-_fv.z);}
/* camera-relative placement for out-of-focus foreground pieces: offsets in the hinted camera's frame */
function camPlace(hint,d,x,y){const P=new V3(...hint.position),F=new V3(...hint.target).sub(P).normalize(),Rr=new V3().crossVectors(F,new V3(0,1,0)).normalize(),Uu=new V3().crossVectors(Rr,F);
  const k=Math.tan(hint.fov*PI/360)*d;return P.clone().addScaledVector(F,d).addScaledVector(Rr,x*k*1.78).addScaledVector(Uu,y*k);}
function faceTo(mesh,pos){mesh.lookAt(pos);}

/* ---------- cherry (sakura) bark: glossy purplish-brown periderm, horizontal lenticels, peeling bands, crustose lichen ---------- */
function barkTextures(ql,seed){
  const W=QS(ql,256,512,512),H=W*2,R=RNG(seed*977+13),n=W*H;
  const col=new Float32Array(n*3),hf=new Float32Array(n),ro=new Float32Array(n);
  const purple=[70,50,52],warm=[96,68,60],grey=[104,98,96],alga=[78,86,62];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=x/W,v=y/H,i=y*W+x;
    const a=fbm(u*3,v*6,seed+1,3,3,6),b=fbm(u*10,v*20,seed+7,2,10,20),c=fbm(u*2,v*4,seed+3,2,2,4),st=fbm(u*3,v*160,seed+11,2,3,160);
    let r=lerp(purple[0],warm[0],a),g=lerp(purple[1],warm[1],a),bb=lerp(purple[2],warm[2],a);
    const gr=sstep(.52,.78,c)*.6;r=lerp(r,grey[0],gr);g=lerp(g,grey[1],gr);bb=lerp(bb,grey[2],gr);
    const al=sstep(.6,.85,fbm(u*2,v*3,seed+5,2,2,3))*.35;r=lerp(r,alga[0],al);g=lerp(g,alga[1],al);bb=lerp(bb,alga[2],al);
    const sh=(b-.5)*16+(st-.5)*7;r+=sh;g+=sh*.92;bb+=sh*.88;
    col[i*3]=r;col[i*3+1]=g;col[i*3+2]=bb;hf[i]=(st-.5)*.12+(b-.5)*.22+(a-.5)*.35;ro[i]=.34+(b-.5)*.1+gr*.22+al*.3;}
  const W2=(x)=>((x%W)+W)%W,H2=(y)=>((y%H)+H)%H;
  /* peeling bands: thin circumferential strips, slightly lifted, light upper lip and a dark shadow line below */
  const nStrip=Math.round(H/40);
  for(let k=0;k<nStrip;k++){const v0=R()*H,len=R.r(.2,.95)*W,u0=R()*W,th=R.r(1.6,5.5)*(W/512),lift=R.r(.08,.18),tone=R.r(12,24);
    for(let dx=0;dx<len;dx++){const fx=dx/len,taper=sstep(0,.12,fx)*sstep(1,.88,fx),wob=Math.sin(fx*9+k)*1.2;
      for(let dy=-Math.ceil(th)-2;dy<=Math.ceil(th)+2;dy++){const x=W2(Math.floor(u0+dx)),y=H2(Math.floor(v0+wob+dy)),i=y*W+x;const yy=dy/th;
        if(Math.abs(yy)<=1){const k2=taper*(1-yy*yy);hf[i]+=lift*k2;col[i*3]+=tone*.9*k2;col[i*3+1]+=tone*.88*k2;col[i*3+2]+=tone*.9*k2;ro[i]-=.08*k2;}
        else if(yy>1&&yy<1+1.6/th){const k2=taper*.55;col[i*3]*=1-.18*k2;col[i*3+1]*=1-.18*k2;col[i*3+2]*=1-.16*k2;hf[i]-=.12*k2;}
        else if(yy<-1&&yy>-1-1.2/th){const k2=taper*.6;col[i*3]+=12*k2;col[i*3+1]+=10*k2;col[i*3+2]+=8*k2;}}}}
  /* lenticels: elongated around the branch, arranged in loose bands */
  const nBand=Math.round(H/44),nLen=Math.round(W*H/4200);
  const bands=[];for(let k=0;k<nBand;k++)bands.push(R()*H);
  for(let k=0;k<nLen;k++){const cy=bands[Math.floor(R()*bands.length)]+R.g()*H*.01,cx=R()*W,L=R.r(9,34)*(W/512)*(R()<.18?1.7:1),hh=R.r(1.8,3.6)*(W/512),fresh=R()<.4;
    const ext=Math.ceil(L+3),eyy=Math.ceil(hh*2.5+2);
    for(let dy=-eyy;dy<=eyy;dy++)for(let dx=-ext;dx<=ext;dx++){const qx=dx/L,qy=dy/hh;const e=Math.pow(Math.abs(qx),2.6)+Math.pow(Math.abs(qy),2);
      if(e>2.4)continue;const x=W2(Math.floor(cx+dx)),y=H2(Math.floor(cy+dy)),i=y*W+x;
      const rim=Math.exp(-Math.pow((e-.95)/.38,2))*.55,core=sstep(.95,.35,e),slit=Math.exp(-qy*qy*2.2)*sstep(1,.55,Math.abs(qx));
      const cr=fresh?[176,110,70]:[150,122,100];
      col[i*3]=lerp(col[i*3],cr[0],rim*.6);col[i*3+1]=lerp(col[i*3+1],cr[1],rim*.6);col[i*3+2]=lerp(col[i*3+2],cr[2],rim*.6);
      const dk=fresh?[96,52,34]:[58,40,34];
      col[i*3]=lerp(col[i*3],dk[0],core*.88);col[i*3+1]=lerp(col[i*3+1],dk[1],core*.88);col[i*3+2]=lerp(col[i*3+2],dk[2],core*.88);
      col[i*3]=lerp(col[i*3],34,slit*core*.6);col[i*3+1]=lerp(col[i*3+1],24,slit*core*.6);col[i*3+2]=lerp(col[i*3+2],22,slit*core*.6);
      hf[i]+=core*.55+rim*.25-slit*core*.45;ro[i]=lerp(ro[i],.85,core*.9);}}
  /* crustose lichen: pale grey-green patches with dark fruiting dots, plus scattered round thalli */
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=x/W,v=y/H,i=y*W+x;
    const l=fbm(u*4,v*8,seed+21,4,4,8)+.16*(fbm(u*24,v*48,seed+23,2,24,48)-.5);const m=sstep(.68,.72,l)*(.45+.25*h2(x,y,seed+29));
    if(m<=0)continue;const tone=fbm(u*30,v*60,seed+27,2,30,60);
    const lc=[lerp(120,160,tone),lerp(132,164,tone),lerp(112,138,tone)];
    const gm=m*(.55+.35*tone);col[i*3]=lerp(col[i*3],lc[0],gm);col[i*3+1]=lerp(col[i*3+1],lc[1],gm);col[i*3+2]=lerp(col[i*3+2],lc[2],gm);
    const edge=sstep(.64,.68,l)*(1-sstep(.68,.72,l));col[i*3]-=edge*16;col[i*3+1]-=edge*14;col[i*3+2]-=edge*14;
    hf[i]+=m*.18;ro[i]=lerp(ro[i],.92,m);
    if(h2(x>>1,y>>1,seed+31)>.985&&m>.5){col[i*3]=58;col[i*3+1]=50;col[i*3+2]=40;hf[i]+=.25;}}
  for(let k=0;k<Math.round(W*H/22000);k++){const cx=R()*W,cy=R()*H,rr=R.r(2,6)*(W/512);const ext=Math.ceil(rr+2);
    for(let dy=-ext;dy<=ext;dy++)for(let dx=-ext;dx<=ext;dx++){const d=Math.hypot(dx,dy)/rr;if(d>1.15)continue;const x=W2(Math.floor(cx+dx)),y=H2(Math.floor(cy+dy)),i=y*W+x;
      const m=sstep(1.15,.85,d);col[i*3]=lerp(col[i*3],140,m*.6);col[i*3+1]=lerp(col[i*3+1],146,m*.6);col[i*3+2]=lerp(col[i*3+2],126,m*.6);ro[i]=lerp(ro[i],.9,m);hf[i]+=m*.12;}}
  const alb=new Uint8Array(n*4),rgh=new Uint8Array(n*4);
  for(let i=0;i<n;i++){alb[i*4]=clamp(col[i*3],0,255);alb[i*4+1]=clamp(col[i*3+1],0,255);alb[i*4+2]=clamp(col[i*3+2],0,255);alb[i*4+3]=255;
    const r=clamp(ro[i],.05,1)*255;rgh[i*4]=255;rgh[i*4+1]=r;rgh[i*4+2]=0;rgh[i*4+3]=255;}
  const nb=normalBytes(hf,W,H,QS(ql,1.3,1.7,1.7),true,true);
  const o={wrapS:T.RepeatWrapping,wrapT:T.RepeatWrapping,aniso:8};
  return {map:dataTex(alb,W,H,o),nrm:dataTex(nb,W,H,Object.assign({srgb:false},o)),rough:dataTex(rgh,W,H,Object.assign({srgb:false},o))};
}
/* tube along a curve with parallel-transport frames; uv u wraps repU times around, v = arc/tileV */
function branchGeo(curve,radius,ns,nr,repU,tileV,wob){
  const pos=[],nor=[],uv=[],idx=[];const len=curve.getLength();
  let t=curve.getTangentAt(0),nm=new V3(0,1,0).addScaledVector(t,-t.y).normalize();
  for(let i=0;i<=ns;i++){const s=i/ns,p=curve.getPointAt(s),tn=curve.getTangentAt(s);
    const q=new T.Quaternion().setFromUnitVectors(t,tn);nm.applyQuaternion(q).addScaledVector(tn,-nm.dot(tn)).normalize();t=tn;
    const bn=new V3().crossVectors(tn,nm),r0=radius(s);
    for(let j=0;j<=nr;j++){const th=j/nr*TAU,d=nm.clone().multiplyScalar(Math.cos(th)).addScaledVector(bn,Math.sin(th));
      const r=r0*(1+(wob?wob(s,th):0));const pp=p.clone().addScaledVector(d,r);
      pos.push(pp.x,pp.y,pp.z);nor.push(d.x,d.y,d.z);uv.push(j/nr*repU,s*len/tileV);}}
  for(let i=0;i<ns;i++)for(let j=0;j<nr;j++){const a=i*(nr+1)+j,b=(i+1)*(nr+1)+j;idx.push(a,b,a+1,a+1,b,b+1);}
  const g=geo({position:{a:pos,n:3},normal:{a:nor,n:3},uv:{a:uv,n:2}},idx);g.computeBoundingSphere();return g;}

function makeBarkMacroSet(opts){
  opts=opts||{};const ql=qlevel(opts),bag=Bag(),seed=opts.seed||17,R=RNG(seed*53+11);
  const root=new T.Group();root.name="flora_bark_macro";
  const D={uFocusD:{value:.2},uDofK:{value:QS(ql,0,30,34)}};
  /* branch of a cherry tree, rising ~30 deg to the right through the origin */
  const curve=new T.CatmullRomCurve3([[-.42,-.245,-.075],[-.21,-.122,-.03],[0,0,0],[.19,.108,.012],[.36,.212,-.008],[.5,.3,-.055]].map(p=>new V3(...p)),false,"centripetal",.5);
  const rad=s=>lerp(.036,.027,s)*(1+.05*Math.sin(s*7.3+.6));
  const tex=barkTextures(ql,seed);bag.add(tex.map);bag.add(tex.nrm);bag.add(tex.rough);
  const circ=TAU*.032,repU=2,tileV=circ/repU*2;
  const wob=(s,th)=>.035*Math.sin(th*2+s*5)+.02*Math.sin(th*3+1.7+s*9)+.012*Math.sin(th*5+s*13);
  const bg=bag.add(branchGeo(curve,rad,QS(ql,70,110,150),QS(ql,28,40,56),repU,tileV,wob));
  const bm=bag.add(dofStandard(new T.MeshStandardMaterial({map:tex.map,normalMap:tex.nrm,roughnessMap:tex.rough,roughness:1,metalness:0,normalScale:new T.Vector2(.9,.9)}),D,"bark"+ql));
  const branch=new T.Mesh(bg,bm);branch.name="bark_branch";branch.castShadow=true;branch.receiveShadow=true;root.add(branch);
  /* a cut stub (old pruned twig) on the far side for a little silhouette interest */
  {const s1=.72,p=curve.getPointAt(s1),tn=curve.getTangentAt(s1),up=new V3(0,1,0).addScaledVector(tn,-tn.y).normalize(),dir=up.clone().multiplyScalar(.8).add(new V3(0,0,-.6)).normalize();
    const c2=new T.CatmullRomCurve3([p.clone().addScaledVector(dir,-.01),p.clone().addScaledVector(dir,.04),p.clone().addScaledVector(dir,.075).add(new V3(.004,.004,0))]);
    const sg=bag.add(branchGeo(c2,s=>lerp(.011,.008,s),QS(ql,10,14,18),QS(ql,12,16,24),1,circ/repU*2));
    const stub=new T.Mesh(sg,bm);stub.castShadow=true;stub.receiveShadow=true;root.add(stub);
    const capG=bag.add(new T.CircleGeometry(.0082,QS(ql,12,16,24)));const cm=bag.add(new T.MeshStandardMaterial({color:0x6b5040,roughness:.9}));
    const cap=new T.Mesh(capG,cm);cap.position.copy(c2.getPointAt(1));cap.lookAt(cap.position.clone().add(c2.getTangentAt(1)));cap.castShadow=true;root.add(cap);}
  /* perch on the upper surface at the origin, turned a little toward the viewer */
  let s0=.5,best=1e9;for(let i=0;i<=400;i++){const s=i/400,d=curve.getPointAt(s).length();if(d<best){best=d;s0=s;}}
  const P0=curve.getPointAt(s0),T0=curve.getTangentAt(s0);
  let N0=new V3(0,1,0).addScaledVector(T0,-T0.y).normalize();N0=rotAxis(N0,T0,.12);if(N0.z<0)N0=rotAxis(N0,T0,-.24);
  const perch=perchFrame(P0.clone().addScaledVector(N0,rad(s0)*.985),N0,T0,"perch");root.add(perch);
  const tgt=perch.position.clone().addScaledVector(N0,.008).addScaledVector(T0,-.004);
  const camDir=new V3(-.28,.42,1).normalize();const camPos=tgt.clone().addScaledVector(camDir,.16);
  const cameraHint={position:camPos.toArray(),target:tgt.toArray(),fov:32};
  /* out-of-focus summer foliage behind (sun from the upper right) */
  const bd=makeBokehBackdrop({width:1.25,height:.7,style:"foliageSummer",seed:seed+5,quality:opts.quality,sunPos:[.82,.16]});
  const bdP=tgt.clone().addScaledVector(camDir,-.5);bd.position.copy(bdP);faceTo(bd,camPos);root.add(bd);
  /* blurred foreground leaves (sakura), hugging two frame corners */
  const fgT=bag.add(blurPlaneTex({w:QS(ql,128,256,256),h:QS(ql,64,128,128),seed:seed+9,blur:QS(ql,5,8,9),
    strokes:[{col:"#3f6a2c",a:.95,w:.5,p:[-.05,1.1,.35,.5,1.05,.2]},{col:"#86ad4c",a:.6,w:.16,p:[.05,.95,.45,.45,1.0,.15]},{col:"#c8dc78",a:.35,w:.06,p:[.1,.9,.5,.42,.98,.12]}],
    discs:[{x:.72,y:.3,r:.09,col:"#f6ffe0",a:.65}]}));
  const fgA=new T.Mesh(bag.add(new T.PlaneGeometry(.07,.035)),bag.add(blurPlaneMaterial(fgT,.85)));fgA.position.copy(camPlace(cameraHint,.075,-.82,-.62));faceTo(fgA,camPos);fgA.rotateZ(.35);
  fgA.renderOrder=20;fgA.castShadow=fgA.receiveShadow=false;root.add(fgA);
  const fgB=new T.Mesh(bag.add(new T.PlaneGeometry(.05,.026)),bag.add(blurPlaneMaterial(fgT,.75)));fgB.position.copy(camPlace(cameraHint,.09,-.86,.78));faceTo(fgB,camPos);fgB.rotateZ(-2.6);
  fgB.renderOrder=21;fgB.castShadow=fgB.receiveShadow=false;root.add(fgB);
  let time=0;
  function update(dt,t,camera){if(t===undefined){time+=dt||0;t=time;}else time=t;bd.userData.update(dt,t);
    const f=focusOf(perch,camera);if(f)D.uFocusD.value=f;}
  root.userData={perch,cameraHint,update,
    setSun(){/* lit by the scene's sun / sky lights (standard materials) */},
    dispose(){bag.dispose();bd.userData.dispose();}};
  return root;
}

/* ---------- reed blade at dusk (mayfly perch) ---------- */
function makeLeafMacroSet(opts){
  opts=opts||{};const ql=qlevel(opts),bag=Bag(),seed=opts.seed||5,R=RNG(seed*131+3);
  const root=new T.Group();root.name="flora_leaf_macro";
  const U=macroRig({sunCol:0xffa05c,sunI:3.0,fillCol:0xa4b2e6,fillI:.42,sky:0xd8a272,hor:0xc77c4a,gnd:0x262719,ambI:.72});
  const sunL=new V3(-.22,.14,-.97).normalize(),fillL=new V3(.32,.8,.5).normalize();
  const bd=makeBokehBackdrop({width:1.0,height:.62,style:"waterDusk",seed:seed+7,quality:opts.quality,sunPos:[.36,.42]});
  root.add(bd);
  const texB=bladeTextures("broad",ql,71),texG=bladeTextures("grass",ql,83);[texB,texG].forEach(t=>{bag.add(t.map);bag.add(t.nrm);});
  const hazeCol=new T.Color().fromArray(bd.userData.colors.mid).convertSRGBToLinear();
  const mk=(tx,tint,trans,o)=>bag.add(surfMaterial(U,Object.assign({map:tx.map,nrm:tx.nrm,tint:new T.Color(...tint),transCol:lin(trans)},o||{})));
  const W=(w0,p,q)=>s=>w0*Math.min(1,Math.pow(Math.max(s,0)/.05,.5))*Math.pow(Math.max(0,1-Math.pow(s,p)),q);
  const segs=QS(ql,80,130,190);
  const blades=[];
  const addBlade=(pts,o)=>{const p0=new V3(...pts[0]);const piv=new T.Group();piv.position.copy(p0);root.add(piv);
    const bl=buildBlade({pts:pts.map(p=>[p[0]-p0.x,p[1]-p0.y,p[2]-p0.z]),up:o.up||[0,1,.35],segs:o.segs||segs,nu:QS(ql,7,9,11),width:o.width,twist:o.twist||(s=>.1*s),fold:o.fold||.1,cup:.0001,groove:.00008,
      serr:ql>0?{amp:.00003,period:.0005}:null,uvLen:.06,thick:(s,u)=>(.0003-.00014*u*u)*(1-.5*s)});
    bag.add(bl.geometry);const m=new T.Mesh(bl.geometry,mk(o.tex||texB,o.tint||[.95,1.0,.86],o.trans||0xb8d050,{tipCol:lin(0xa88a4a),tipK:o.tipK!=null?o.tipK:.3,transK:o.transK||1.15,shin:60,haze:o.haze||0,hazeCol}));
    m.castShadow=false;m.receiveShadow=false;piv.add(m);const e={piv,bl,m,ph:R()*TAU,amp:o.amp||1};blades.push(e);return e;};
  /* hero reed blade: leaves the culm on the left, arches across and droops to a long point */
  const hero=addBlade([[-.13,-.052,-.03],[-.085,-.014,-.018],[-.035,.006,-.008],[.015,.011,0],[.065,.004,.005],[.11,-.013,.008],[.15,-.038,.008]],{width:W(.021,1.9,.75),amp:.6});
  /* out-of-focus companions: one behind, one rising in front-right */
  addBlade([[-.16,-.11,-.085],[-.06,-.04,-.09],[.03,-.006,-.095],[.11,.002,-.1],[.2,-.025,-.105]],{width:W(.017,1.8,.8),haze:.55,tint:[.85,.9,.78],amp:1.4});
  /* culm with a leaf sheath where the hero blade leaves it */
  const culm=tubeGeo([[-.136,-.26,-.034],[-.134,-.13,-.032],[-.133,-.05,-.031],[-.131,.06,-.031],[-.129,.18,-.032]],s=>.0043*(1-.18*s),QS(ql,8,10,14),{segs:QS(ql,24,36,48),col0:[.6,.64,.36],col1:[.68,.66,.4],vRep:6});
  const sheath=tubeGeo([[-.134,-.135,-.032],[-.1335,-.1,-.0315],[-.133,-.06,-.031],[-.1325,-.048,-.031]],s=>.0053*(1-.12*s),QS(ql,8,10,14),{segs:QS(ql,10,14,18),col0:[.66,.7,.4],col1:[.72,.7,.42],vRep:2});
  const cm=mk(texG,[1,1,.92],0xc8d878,{transK:.5,shin:80,haze:.2,hazeCol});
  [culm,sheath].forEach(c=>{bag.add(c.geometry);const m=new T.Mesh(c.geometry,cm);m.castShadow=m.receiveShadow=false;root.add(m);});
  /* perch on the hero blade (upper surface, facing the tip) */
  const s0=.4,S0=hero.bl.surf(s0,.04);
  const perch=perchFrame(S0.p,S0.n,S0.t,"perch");hero.piv.add(perch);
  hero.piv.updateMatrixWorld(true);const pw=perch.position.clone().applyMatrix4(hero.piv.matrix),nw=S0.n.clone();
  const tgt=pw.clone().addScaledVector(nw,.008);const camPos=tgt.clone().add(new V3(.026,.03,.102));
  const cameraHint={position:camPos.toArray(),target:tgt.toArray(),fov:28};
  {const vd=tgt.clone().sub(camPos).normalize();bd.position.copy(tgt).addScaledVector(vd,.34).add(new V3(0,-.03,0));faceTo(bd,camPos);rigBindBackdrop(U,bd,[1.1,1.05,1.35]);}
  /* backlit motes (midges) drifting over the water */
  const nSp=QS(ql,8,14,20);const spr=new T.InstancedMesh(bag.add(new T.PlaneGeometry(1,1)),bag.add(spriteMaterial(U)),nSp);
  {const aSp=new Float32Array(nSp*4),aSc=new Float32Array(nSp*4);
    for(let i=0;i<nSp;i++){const M=new T.Matrix4(),sz=R.r(.00025,.0006);M.makeScale(sz,sz,sz);M.setPosition(R.r(-.12,.12),R.r(-.02,.07),R.r(-.25,-.06));spr.setMatrixAt(i,M);
      aSp.set([1,R()*TAU,R.r(1.5,4),.7],i*4);aSc.set([1,.82,.55,R.r(1.5,4)],i*4);}
    spr.geometry.setAttribute("aSp",new T.InstancedBufferAttribute(aSp,4));spr.geometry.setAttribute("aSc",new T.InstancedBufferAttribute(aSc,4));}
  spr.frustumCulled=false;spr.renderOrder=15;spr.castShadow=spr.receiveShadow=false;root.add(spr);
  /* soft foreground reed stroke at the lower right */
  const fgT=bag.add(blurPlaneTex({w:QS(ql,64,128,128),h:QS(ql,128,256,256),seed:seed+3,blur:QS(ql,6,10,12),
    strokes:[{col:"#55602c",a:.9,w:.2,p:[.7,1.05,.45,.5,.38,-.05]},{col:"#d8a050",a:.45,w:.05,p:[.62,1.0,.4,.5,.33,-.05]}],discs:[{x:.4,y:.3,r:.07,col:"#ffd08a",a:.55}]}));
  const fg=new T.Mesh(bag.add(new T.PlaneGeometry(.022,.044)),bag.add(blurPlaneMaterial(fgT,.85)));fg.position.copy(camPlace(cameraHint,.06,.86,-.55));faceTo(fg,camPos);
  fg.renderOrder=20;fg.castShadow=fg.receiveShadow=false;root.add(fg);
  let time=0;
  bd.onBeforeRender=()=>rigRefresh(U,root,bd,sunL,fillL);
  function update(dt,t,camera){if(t===undefined){time+=dt||0;t=time;}else time=t;U.uTime.value=t;bd.userData.update(dt,t);
    for(const e of blades){const a=.004*e.amp*Math.sin(t*.7+e.ph)+.002*e.amp*Math.sin(t*1.9+e.ph*2);e.piv.rotation.set(a*.5,a*.2,a);}
    rigRefresh(U,root,bd,sunL,fillL);}
  update(0,0);
  root.userData={perch,cameraHint,update,
    setSun(dir,color,intensity){if(dir){const d=dir.isVector3?dir.clone():new V3(dir[0],dir[1],dir[2]);if(d.lengthSq()>0)sunL.copy(d.normalize());}
      if(color!==undefined&&color!==null)U.uSunCol.value.copy(lin(color));if(intensity!==undefined)U.uSunI.value=3.0*intensity;},
    dispose(){bag.dispose();bd.userData.dispose();}};
  return root;
}

/* ---------- still water at dusk with surface-film dimples (spent mayfly) ---------- */
function makeWaterMacroSet(opts){
  opts=opts||{};const ql=qlevel(opts),bag=Bag(),seed=opts.seed||9,R=RNG(seed*71+5);
  const root=new T.Group();root.name="flora_water_macro";
  const U=macroRig({sunCol:0xff9c52,sunI:3.0,fillCol:0x9fb0e8,fillI:.38,sky:0xcf9262,hor:0xc47444,gnd:0x1b1a12,ambI:.7});
  const sunL=new V3(.2,.12,-.97).normalize(),fillL=new V3(-.3,.8,.5).normalize();
  const bd=makeBokehBackdrop({width:1.2,height:.44,style:"waterDusk",seed:seed+3,quality:opts.quality,sunPos:[.62,.4]});
  bd.position.set(0,.18,-.62);root.add(bd);rigBindBackdrop(U,bd,[1.0,1.0,1.15]);
  /* perches: the hero (spent mayfly, head to the right and a little toward the viewer) + two far ones for extra insects */
  const perch=perchFrame(new V3(0,0,0),new V3(0,1,0),new V3(1,0,.42),"perch");root.add(perch);
  const far=[perchFrame(new V3(-.1,0,-.2),new V3(0,1,0),new V3(-.3,0,1),"perchFar1"),perchFrame(new V3(.15,0,-.34),new V3(0,1,0),new V3(1,0,-.6),"perchFar2")];
  far.forEach(p=>root.add(p));
  /* surface-tension dimples under the spent mayfly (perch-local x,z,radius) */
  const CL=[[0,.004,.0042],[0,-.007,.0038],[.011,.001,.0045],[-.011,.001,.0045],[.017,-.004,.0038],[-.017,-.004,.0038],[.008,-.009,.0033],[-.008,-.009,.0033],
    [.004,-.032,.0021],[-.004,-.032,.0021],[.0035,.013,.002],[-.0035,.013,.002]];
  perch.updateMatrix();const cont=CL.map(c=>{const p=new V3(c[0],0,c[1]).applyMatrix4(perch.matrix);return new V3(p.x,p.z,c[2]);});
  const rings=[0,1,2,3].map(()=>new T.Vector4(0,0,-99,0));
  const WU=Object.assign({},U,{uRing:{value:rings},uCont:{value:cont},uFocusD:{value:.15},uDofK:{value:QS(ql,0,26,30)},uWaterCol:{value:lin(0x1d2216)},uSpeck:{value:QS(ql,0,1,1)}});
  const wm=bag.add(new T.ShaderMaterial({uniforms:WU,fog:false,
    vertexShader:`varying vec3 vWP,vLP,vAx,vAy,vAz;varying float vZ;
      void main(){vLP=position;vec4 wp=modelMatrix*vec4(position,1.0);vWP=wp.xyz;vec4 mv=viewMatrix*wp;vZ=-mv.z;
        vAx=normalize(mat3(modelMatrix)[0]);vAy=normalize(mat3(modelMatrix)[1]);vAz=normalize(mat3(modelMatrix)[2]);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`${GLSL_RIG}${GLSL_BACK}${GLSL_NOISE}
      uniform vec4 uRing[4];uniform vec3 uCont[12];uniform float uFocusD,uDofK,uSpeck;uniform vec3 uWaterCol;
      varying vec3 vWP,vLP,vAx,vAy,vAz;varying float vZ;
      float wN(vec2 p,float blur){float t=uTime;
        float h=0.00030*(flN2(p*11.0+vec2(-t*0.06,t*0.04))-0.5)+0.00020*(flN2(p*36.0+vec2(t*0.28,t*0.10))-0.5);
        h+=0.00009*(1.0-blur)*(flN2(p*92.0-vec2(t*0.42,-t*0.17))-0.5);return h;}
      vec3 wBack(vec3 P,vec3 d){vec3 lp=(uBackInv*vec4(P,1.0)).xyz;vec3 ld=normalize((uBackInv*vec4(d,0.0)).xyz);
        vec3 env=mEnv(d);
        if(ld.z<-1e-3){float tt=-lp.z/ld.z;vec2 q=lp.xy+ld.xy*tt;vec2 uv=q/uBackSize+0.5;
          float inb=smoothstep(0.0,0.04,uv.x)*smoothstep(1.0,0.96,uv.x)*smoothstep(1.0,0.9,uv.y);
          return mix(env,mBackTex(clamp(uv,0.003,0.997)),inb);}
        return env;}
      void main(){
        vec2 p=vLP.xz;float blur=clamp(uDofK*abs(vZ-uFocusD)/max(uFocusD,1e-4),0.0,1.0);
        float e=0.0004;float h0=wN(p,blur);vec2 g=vec2(wN(p+vec2(e,0.0),blur)-h0,wN(p+vec2(0.0,e),blur)-h0)/e;
        for(int i=0;i<4;i++){vec4 r=uRing[i];float age=uTime-r.z;if(age<0.0||age>4.5||r.w<=0.0)continue;
          vec2 dv=p-r.xy;float d=length(dv)+1e-5;float Rr=0.006+age*0.05;float w=0.003+age*0.0035;
          float qd=(d-Rr)/w;float env=exp(-qd*qd)*exp(-age*0.85)/(1.0+d*14.0);
          g+=r.w*0.00022*env*(-760.0)*sin((d-Rr)*760.0)*(dv/d)*(1.0-0.6*blur);}
        for(int i=0;i<12;i++){vec3 c=uCont[i];if(c.z<=0.0)continue;vec2 dv=p-c.xy;float ex=exp(-dot(dv,dv)/(c.z*c.z));
          g+=2.0*0.00016*dv/(c.z*c.z)*ex;}
        vec3 N=normalize(vAx*(-g.x)+vAy+vAz*(-g.y));
        vec3 V=normalize(cameraPosition-vWP);vec3 Rd=reflect(-V,N);if(Rd.y<0.02)Rd=normalize(vec3(Rd.x,0.02,Rd.z));
        float NV=max(dot(N,V),0.0);float F=0.02+0.98*pow(1.0-NV,5.0);
        vec3 refl=wBack(vWP,Rd);
        float bed=flN2(p*5.0+3.0)*0.65+flN2(p*15.0)*0.35;
        vec3 body=uWaterCol*(0.55+0.9*bed)*(mix(uGndCol,uSkyCol,0.5)*uAmbI*1.8+uSunCol*uSunI*0.035);
        vec3 col=mix(body,refl,F);
        float sp=max(dot(Rd,uSunDir),0.0);float shin=mix(3000.0,220.0,blur);
        col+=uSunCol*uSunI*pow(sp,shin)*mix(10.0,1.6,blur)*(0.35+0.65*F);
        col+=uSunCol*uSunI*pow(sp,40.0)*0.06*F;
        if(uSpeck>0.5){vec2 cw=p/0.0032;vec2 ci=floor(cw),cf=fract(cw);float hh=flH2(ci+17.0);
          if(hh>0.955){vec2 cc=vec2(flH2(ci+3.1),flH2(ci+7.7))*0.6+0.2;float d=length(cf-cc)*0.0032;float r=0.00012+0.00022*flH2(ci+9.3);
            float a=smoothstep(r,r*0.55,d)*(1.0-blur);col=mix(col,vec3(0.025,0.02,0.014)+refl*0.05,a*0.85);}}
        gl_FragColor=vec4(col,1.0);
        ${GLSL_OUT}}`}));
  const plane=new T.Mesh(bag.add(new T.PlaneGeometry(1.2,.9,1,1).rotateX(-PI/2).translate(0,0,-.2)),wm);plane.name="water_film";plane.castShadow=false;plane.receiveShadow=false;plane.renderOrder=-5;root.add(plane);
  const tgt=new V3(0,.003,-.002);const camPos=new V3(.024,.026,.108);
  const cameraHint={position:camPos.toArray(),target:tgt.toArray(),fov:30};
  let time=0,nextTw=2.5,ri=0;
  function ripple(k){rings[ri].set(perch.position.x+R.s()*.002,perch.position.z+R.s()*.002,time,clamp(k==null?1:k,0,2));ri=(ri+1)%rings.length;}
  bd.onBeforeRender=()=>rigRefresh(U,root,bd,sunL,fillL);
  function update(dt,t,camera){if(t===undefined){time+=dt||0;t=time;}else time=t;U.uTime.value=t;bd.userData.update(dt,t);
    nextTw-=Math.min(Math.max(dt||0,0),.1);if(nextTw<=0){nextTw=R.r(3.5,6.5);ripple(R.r(.18,.32));}
    const f=focusOf(perch,camera);if(f)WU.uFocusD.value=f;rigRefresh(U,root,bd,sunL,fillL);}
  update(0,0);
  root.userData={perch,perches:[perch].concat(far),cameraHint,update,ripple,
    setSun(dir,color,intensity){if(dir){const d=dir.isVector3?dir.clone():new V3(dir[0],dir[1],dir[2]);if(d.lengthSq()>0)sunL.copy(d.normalize());}
      if(color!==undefined&&color!==null)U.uSunCol.value.copy(lin(color));if(intensity!==undefined)U.uSunI.value=3.0*intensity;},
    dispose(){bag.dispose();bd.userData.dispose();}};
  return root;
}
return {makeGrassField:(typeof makeGrassField!=="undefined"?makeGrassField:null),makeDewMacroSet,makeBarkMacroSet:(typeof makeBarkMacroSet!=="undefined"?makeBarkMacroSet:null),
  makeLeafMacroSet:(typeof makeLeafMacroSet!=="undefined"?makeLeafMacroSet:null),makeWaterMacroSet:(typeof makeWaterMacroSet!=="undefined"?makeWaterMacroSet:null),makeBokehBackdrop};
})();
