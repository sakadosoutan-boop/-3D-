/* TSURE_NATURE — API doc is generated below (see bottom of file header written at finalisation). */
const TSURE_NATURE=(()=>{
"use strict";
const T=THREE, TAU=Math.PI*2;

/* =====================================================================
 * 0. small utilities (seeded RNG, CPU noise, colours, resource tracking)
 * ===================================================================== */
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function RNG(seed){const f=mulberry32((Math.imul((seed|0)+0x3c6ef372,2654435761)^0x5bd1e995)|0);
  return {f,r:(a,b)=>a+(b-a)*f(),i:(a,b)=>a+Math.floor(f()*(b-a+1)),pick:arr=>arr[Math.min(arr.length-1,Math.floor(f()*arr.length))],
    g:()=>{let u=f();while(u<1e-9)u=f();return Math.sqrt(-2*Math.log(u))*Math.cos(TAU*f());}};}
const clamp=(x,a,b)=>x<a?a:x>b?b:x, lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const fade=t=>t*t*t*(t*(t*6-15)+10);
function qlv(o){const q=o&&o.quality;return q==="low"?0:q==="medium"?1:2;}
function ih2(x,y,s){let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296;}
function ih3(x,y,z,s){let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(z|0,1103515245)+Math.imul(s|0,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296;}
const GTAB=new Map(),WTAB=new Map();
function gtab(P,s){const k=P*1000003+s;let t=GTAB.get(k);if(!t){t=new Float32Array(P*P*2);for(let y=0;y<P;y++)for(let x=0;x<P;x++){const a=ih2(x,y,s)*TAU;t[(y*P+x)*2]=Math.cos(a);t[(y*P+x)*2+1]=Math.sin(a);}GTAB.set(k,t);}return t;}
function pgrad2(x,y,P,s){let xi=Math.floor(x),yi=Math.floor(y);const xf=x-xi,yf=y-yi;
  if(P>256){const w=i=>((i%P)+P)%P,g=(ix,iy,dx,dy)=>{const a=ih2(w(ix),w(iy),s)*TAU;return Math.cos(a)*dx+Math.sin(a)*dy;};
    const u=fade(xf),v=fade(yf),a=g(xi,yi,xf,yf),b=g(xi+1,yi,xf-1,yf),c=g(xi,yi+1,xf,yf-1),d=g(xi+1,yi+1,xf-1,yf-1);return 1.4142*lerp(lerp(a,b,u),lerp(c,d,u),v);}
  const t=gtab(P,s);xi=((xi%P)+P)%P;yi=((yi%P)+P)%P;const x1=(xi+1)%P,y1=(yi+1)%P;
  const i00=(yi*P+xi)*2,i10=(yi*P+x1)*2,i01=(y1*P+xi)*2,i11=(y1*P+x1)*2;
  const a=t[i00]*xf+t[i00+1]*yf,b=t[i10]*(xf-1)+t[i10+1]*yf,c=t[i01]*xf+t[i01+1]*(yf-1),d=t[i11]*(xf-1)+t[i11+1]*(yf-1);
  const u=fade(xf),v=fade(yf),ab=a+(b-a)*u;return 1.4142*(ab+((c+(d-c)*u)-ab)*v);}
function pfbm2(x,y,P,oct,s,gain){gain=gain||0.5;let a=1,f=1,sum=0,n=0;for(let o=0;o<oct;o++){sum+=a*pgrad2(x*f,y*f,P*f,s+o*131);n+=a;a*=gain;f*=2;}return sum/n;}
function wtab(P,s){const k=P*1000003+s;let t=WTAB.get(k);if(!t){t=new Float32Array(P*P*2);for(let y=0;y<P;y++)for(let x=0;x<P;x++){t[(y*P+x)*2]=ih2(x,y,s);t[(y*P+x)*2+1]=ih2(x,y,s+7);}WTAB.set(k,t);}return t;}
let WF2=0;
function pworley1(x,y,P,s){const xi=Math.floor(x),yi=Math.floor(y),t=wtab(P,s);let f1=9,f2=9;
  for(let j=-1;j<=1;j++){const cy=yi+j,wy=((cy%P)+P)%P;for(let i=-1;i<=1;i++){const cx=xi+i,wx=((cx%P)+P)%P,o=(wy*P+wx)*2;
    const dx=cx+t[o]-x,dy=cy+t[o+1]-y,d=dx*dx+dy*dy;if(d<f1){f2=f1;f1=d;}else if(d<f2)f2=d;}}
  WF2=Math.sqrt(f2);return Math.sqrt(f1);}
function pworley(x,y,P,s){const f1=pworley1(x,y,P,s);return [f1,WF2];}
function noiseDone(){GTAB.clear();WTAB.clear();}
function vnoise1(x,s){const i=Math.floor(x),f=x-i,u=f*f*(3-2*f);return lerp(ih2(i,77,s),ih2(i+1,77,s),u);}
function fbm1(x,oct,s,gain){gain=gain||0.5;let a=1,f=1,sum=0,n=0;for(let o=0;o<oct;o++){sum+=a*vnoise1(x*f,s+o*17);n+=a;a*=gain;f*=2.03;}return sum/n;}
function vnoise3(x,y,z,s){const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=x-xi,yf=y-yi,zf=z-zi;
  const u=fade(xf),v=fade(yf),w=fade(zf),h=(a,b,c)=>ih3(xi+a,yi+b,zi+c,s);
  return lerp(lerp(lerp(h(0,0,0),h(1,0,0),u),lerp(h(0,1,0),h(1,1,0),u),v),lerp(lerp(h(0,0,1),h(1,0,1),u),lerp(h(0,1,1),h(1,1,1),u),v),w);}
function fbm3(x,y,z,oct,s){let a=1,f=1,sum=0,n=0;for(let o=0;o<oct;o++){sum+=a*vnoise3(x*f,y*f,z*f,s+o*31);n+=a;a*=0.5;f*=2.02;}return sum/n;}
function equalize(arr){const srt=Float32Array.from(arr).sort(),n=srt.length;
  for(let i=0;i<n;i++){let lo=0,hi=n-1;const v=arr[i];while(lo<hi){const m=(lo+hi)>>1;if(srt[m]<v)lo=m+1;else hi=m;}arr[i]=lo/(n-1);}return arr;}
function normalize01(arr){let mn=1e9,mx=-1e9;for(const v of arr){if(v<mn)mn=v;if(v>mx)mx=v;}const k=1/Math.max(1e-6,mx-mn);for(let i=0;i<arr.length;i++)arr[i]=(arr[i]-mn)*k;return arr;}

/* colours / vectors: accept hex number, "#rrggbb", [r,g,b] (scene-linear floats, may exceed 1), THREE.Color/Vector3 */
function C(v,d){if(v===undefined||v===null)v=d;if(v===undefined||v===null)return new T.Color(1,1,1);if(v.isColor)return v.clone();
  if(Array.isArray(v))return new T.Color(v[0],v[1],v[2]);if(v.isVector3)return new T.Color(v.x,v.y,v.z);return new T.Color(v);}
function setC(c,v){if(v===undefined||v===null)return;if(v.isColor)c.copy(v);else if(Array.isArray(v))c.setRGB(v[0],v[1],v[2]);else if(v.isVector3)c.setRGB(v.x,v.y,v.z);else c.set(v);}
function V3(v,d){if(!v)return d?d.clone():new T.Vector3();if(v.isVector3)return v.clone();if(Array.isArray(v))return new T.Vector3(v[0]||0,v[1]||0,v[2]||0);return d?d.clone():new T.Vector3();}
function setV(vec,v){if(!v)return;if(v.isVector3)vec.copy(v);else if(Array.isArray(v))vec.set(v[0]||0,v[1]||0,v[2]||0);}
function dirAzEl(azDeg,elDeg){const a=azDeg*Math.PI/180,e=elDeg*Math.PI/180;return [+(Math.sin(a)*Math.cos(e)).toFixed(4),+Math.sin(e).toFixed(4),+(-Math.cos(a)*Math.cos(e)).toFixed(4)];}

/* the renderer's display transform (ACES filmic as in r128 + sRGB) and its inverse — used to author presets in display colours */
const AIN=[0.59719,0.35458,0.04823,0.07600,0.90834,0.01566,0.02840,0.13383,0.83777];
const AOUT=[1.60475,-0.53108,-0.07367,-0.10208,1.10813,-0.00605,-0.00327,-0.07276,1.07602];
const m3=(M,v)=>[M[0]*v[0]+M[1]*v[1]+M[2]*v[2],M[3]*v[0]+M[4]*v[1]+M[5]*v[2],M[6]*v[0]+M[7]*v[1]+M[8]*v[2]];
const rrt=v=>(v*(v+0.0245786)-0.000090537)/(v*(0.983729*v+0.4329510)+0.238081);
function aces(c,E){let v=c.map(x=>x*E/0.6);v=m3(AIN,v).map(rrt);return m3(AOUT,v).map(x=>clamp(x,0,1));}
const toSRGB=x=>x<=0.0031308?x*12.92:1.055*Math.pow(x,1/2.4)-0.055, fromSRGB=x=>x<=0.04045?x/12.92:Math.pow((x+0.055)/1.055,2.4);
function hexRGB(h){if(typeof h==="string")h=parseInt(h.replace("#",""),16);return [((h>>16)&255)/255,((h>>8)&255)/255,(h&255)/255];}
function rgbHex(c){return (Math.round(clamp(c[0],0,1)*255)<<16)|(Math.round(clamp(c[1],0,1)*255)<<8)|Math.round(clamp(c[2],0,1)*255);}
function displayOf(lin,E){return aces(lin,E).map(toSRGB);}
function linearOf(hex,E){const t=hexRGB(hex).map(fromSRGB);let x=t.map(v=>Math.max(v,0.002));
  for(let it=0;it<60;it++){const y=aces(x,E),J=[];for(let k=0;k<3;k++){const d=[0,0,0];d[k]=1e-4;const y2=aces(x.map((v,i)=>v+d[i]),E);J.push(y2.map((v,i)=>(v-y[i])/1e-4));}
    // J[k] = column k ; solve J*dx = y-t (3x3 Cramer)
    const a=[[J[0][0],J[1][0],J[2][0]],[J[0][1],J[1][1],J[2][1]],[J[0][2],J[1][2],J[2][2]]],b=y.map((v,i)=>v-t[i]);
    const det=M=>M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1])-M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0])+M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]);
    const D=det(a);if(Math.abs(D)<1e-12)break;const dx=[0,1,2].map(k=>{const M=a.map((r,i)=>r.map((v,j)=>j===k?b[i]:v));return det(M)/D;});
    x=x.map((v,i)=>Math.max(1e-5,v-dx[i]*0.8));}
  return x.map(v=>+v.toFixed(4));}

/* resource tracking with ref-counted module-shared textures */
const SH=new Map();
function acq(key,make){let e=SH.get(key);if(!e){e={v:make(),n:0};SH.set(key,e);}e.n++;return e.v;}
function rel(key){const e=SH.get(key);if(!e)return;e.n--;if(e.n<=0){const v=e.v;(Array.isArray(v)?v:[v]).forEach(o=>{try{o&&o.dispose&&o.dispose();}catch(_){}});SH.delete(key);}}
function Res(){const own=[],keys=[];return {own(o){if(o)own.push(o);return o;},sh(key,make){keys.push(key);return acq(key,make);},
  dispose(){own.forEach(o=>{try{o&&o.dispose&&o.dispose();}catch(_){}});own.length=0;keys.forEach(rel);keys.length=0;}};}
function dtex(data,w,h,o){o=o||{};const t=new T.DataTexture(data,w,h,T.RGBAFormat);t.wrapS=t.wrapT=o.clamp?T.ClampToEdgeWrapping:T.RepeatWrapping;
  t.magFilter=T.LinearFilter;t.minFilter=o.nomip?T.LinearFilter:T.LinearMipmapLinearFilter;t.generateMipmaps=!o.nomip;t.anisotropy=o.aniso||1;
  if(o.srgb)t.encoding=T.sRGBEncoding;t.needsUpdate=true;return t;}
function mkCanvas(w,h){const c=document.createElement("canvas");c.width=w;c.height=h;return c;}

/* geometry merge (indexed), keeps the attributes present on the first geometry */
function mergeGeos(list){const geos=list.map(g=>g.index?g:(()=>{const n=g.attributes.position.count,idx=[];for(let i=0;i<n;i++)idx.push(i);g.setIndex(idx);return g;})());
  const names=Object.keys(geos[0].attributes);const out=new T.BufferGeometry();let vc=0,ic=0;
  geos.forEach(g=>{vc+=g.attributes.position.count;ic+=g.index.count;});
  names.forEach(n=>{const is=geos[0].attributes[n].itemSize;const arr=new Float32Array(vc*is);let o=0;
    geos.forEach(g=>{const a=g.attributes[n];if(a){for(let i=0;i<a.count*is;i++)arr[o+i]=a.array[i];}o+=g.attributes.position.count*is;});
    out.setAttribute(n,new T.BufferAttribute(arr,is));});
  const idx=(vc>65535)?new Uint32Array(ic):new Uint16Array(ic);let io=0,vo=0;
  geos.forEach(g=>{for(let i=0;i<g.index.count;i++)idx[io+i]=g.index.array[i]+vo;io+=g.index.count;vo+=g.attributes.position.count;});
  out.setIndex(new T.BufferAttribute(idx,1));return out;}

/* =====================================================================
 * 1. shared procedural textures
 * ===================================================================== */
// RGBA tileable noise 256²: R = equalized fbm (4 cells), G = worley "puffs", B = equalized fbm (8 cells), A = ridged fbm
function makeNoiseTex(){const N=256,n=N*N,R=new Float32Array(n),G=new Float32Array(n),B=new Float32Array(n),A=new Float32Array(n);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x/N,v=y/N,i=y*N+x;
    R[i]=pfbm2(u*4,v*4,4,6,11,0.5);B[i]=pfbm2(u*8,v*8,8,5,23,0.5);
    const w1=pworley1(u*8,v*8,8,37),w2=pworley1(u*16,v*16,16,41);
    G[i]=0.7*(1-smooth(0,0.8,w1))+0.3*(1-smooth(0,0.8,w2));
    let rr=0,am=1,nn=0;for(let o=0;o<4;o++){const f=1<<o;const q=1-Math.abs(pgrad2(u*6*f,v*6*f,6*f,57+o));rr+=am*q*q;nn+=am;am*=0.5;}A[i]=rr/nn;}
  equalize(R);equalize(B);normalize01(G);normalize01(A);
  const d=new Uint8Array(n*4);for(let i=0;i<n;i++){d[i*4]=R[i]*255;d[i*4+1]=G[i]*255;d[i*4+2]=B[i]*255;d[i*4+3]=A[i]*255;}
  return dtex(d,N,N,{aniso:4});}
function noiseTex(res){return res.sh("noise",makeNoiseTex);}
// water normal map 256² (tileable), RGB = normal, A = height
function makeWaterNormal(){const N=256,H=new Float32Array(N*N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x/N,v=y/N;H[y*N+x]=pfbm2(u*5,v*5,5,5,77,0.52)+0.45*pfbm2(u*13,v*13,13,3,91,0.5);}
  const d=new Uint8Array(N*N*4),k=2.6;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x,hx=H[y*N+(x+1)%N]-H[y*N+(x+N-1)%N],hy=H[((y+1)%N)*N+x]-H[((y+N-1)%N)*N+x];
    let nx=-hx*k,ny=-hy*k,nz=1;const l=Math.hypot(nx,ny,nz);nx/=l;ny/=l;nz/=l;
    d[i*4]=(nx*0.5+0.5)*255;d[i*4+1]=(ny*0.5+0.5)*255;d[i*4+2]=(nz*0.5+0.5)*255;d[i*4+3]=clamp(H[i]*0.5+0.5,0,1)*255;}
  return dtex(d,N,N,{aniso:4});}
// caustic network 256²
function makeCaustic(){const N=256,d=new Uint8Array(N*N*4);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x/N,v=y/N,i=(y*N+x)*4;
    const w=pworley(u*6+0.25*pgrad2(u*3,v*3,3,5),v*6+0.25*pgrad2(u*3+7,v*3,3,6),6,121);const w2=pworley(u*11,v*11,11,131);
    const c=Math.pow(1-smooth(0,0.22,w[1]-w[0]),2.2),c2=Math.pow(1-smooth(0,0.2,w2[1]-w2[0]),2.0);
    d[i]=c*255;d[i+1]=c2*255;d[i+2]=128;d[i+3]=255;}
  return dtex(d,N,N);}
// soft puff atlas 256² (2x2 variants) for smoke/mist: A = density, R = inner detail
function makePuffAtlas(){const N=256,h=N/2,d=new Uint8Array(N*N*4);
  for(let vy=0;vy<2;vy++)for(let vx=0;vx<2;vx++){const s=vy*2+vx;
    for(let y=0;y<h;y++)for(let x=0;x<h;x++){const u=(x+0.5)/h*2-1,v=(y+0.5)/h*2-1,r=Math.hypot(u,v);
      const n=pfbm2((x/h)*4+s*1.7,(y/h)*4,16,5,301+s*13,0.55),n2=pfbm2((x/h)*9,(y/h)*9,32,3,401+s*7,0.5);
      let a=1-smooth(0.12,1.0,r+n*0.42+n2*0.12);a=Math.pow(clamp(a,0,1),1.35)*(0.75+0.5*clamp(0.5+n*0.9,0,1));
      a*=smooth(1.0,0.82,Math.max(Math.abs(u),Math.abs(v)));
      const i=((vy*h+y)*N+vx*h+x)*4;d[i]=clamp(0.5+n2*1.2,0,1)*255;d[i+1]=clamp(0.5+n*1.1,0,1)*255;d[i+2]=255;d[i+3]=clamp(a,0,1)*255;}}
  const t=dtex(d,N,N,{clamp:true});return t;}

/* common GLSL */
const GL_HASH=`
float nh12(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float nh13(vec3 p3){p3=fract(p3*0.1031);p3+=dot(p3,p3.zyx+31.32);return fract((p3.x+p3.y)*p3.z);}
vec3 nh33(vec3 p3){p3=fract(p3*vec3(0.1031,0.1030,0.0973));p3+=dot(p3,p3.yxz+33.33);return fract((p3.xxy+p3.yxx)*p3.zyx);}
float nh11(float p){p=fract(p*0.1031);p*=p+33.33;p*=p+p;return fract(p);}
float nvn2(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);return mix(mix(nh12(i),nh12(i+vec2(1.0,0.0)),u.x),mix(nh12(i+vec2(0.0,1.0)),nh12(i+vec2(1.0,1.0)),u.x),u.y);}
float nhg(float c,float g){float g2=g*g;return (1.0-g2)/pow(max(1.0+g2-2.0*g*c,1e-4),1.5);}
`;
const GL_FOG_SCALED=`
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogF=1.0-exp(-fogDensity*fogDensity*fogDepth*fogDepth);
  #else
    float fogF=smoothstep(fogNear,fogFar,fogDepth);
  #endif
  gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,fogF*uFogScale);
#endif
`;

/* =====================================================================
 * 2. SKY
 * ===================================================================== */
const SKY_VS=`
varying vec3 vWorldPos;
void main(){vec4 wp=modelMatrix*vec4(position,1.0);vWorldPos=wp.xyz;vec4 cp=projectionMatrix*viewMatrix*wp;cp.z=cp.w*0.99999;gl_Position=cp;}`;
const SKY_FS=`
uniform vec3 uZenith;uniform vec3 uHorizon;uniform vec3 uGround;uniform vec3 uHazeCol;uniform float uHaze;
uniform vec3 uSunDir;uniform vec3 uSunCol;uniform float uSunInt;uniform float uSunSize;uniform float uGlow;uniform float uShafts;
uniform vec3 uMoonDir;uniform vec3 uMoonCol;uniform float uMoonPhase;uniform float uMoonVis;uniform float uMoonSize;
uniform float uStars;uniform float uMilky;
uniform float uCover;uniform float uCScale;uniform float uCSpeed;uniform float uCirrus;uniform float uScales;uniform float uCOpacity;
uniform vec3 uCCol;uniform vec3 uCShade;uniform vec2 uWind;uniform vec3 uBeltCol;uniform float uBelt;uniform float uTime;
uniform sampler2D tNoise;
varying vec3 vWorldPos;
${GL_HASH}
vec3 starLayer(vec3 d,float sc,float dens,float px,float gain){
  vec3 p=d*sc;vec3 c=floor(p);vec3 f=p-c;vec3 r=nh33(c);
  vec3 sp=0.3+0.4*nh33(c+17.31);vec3 dv=f-sp;float r2=dot(dv,dv);
  float sz=0.035+0.045*r.y;float pxs=px*sc*0.55;float s=max(sz,pxs);
  float b=exp(-r2/(s*s))*(sz*sz)/(s*s);
  float mag=0.10+pow(r.z,9.0)*10.0;
  float tw=0.8+0.2*sin(uTime*(1.6+3.5*r.y)+r.z*61.0);
  vec3 tint=mix(vec3(0.70,0.80,1.0),vec3(1.0,0.84,0.62),nh13(c+5.17));
  return tint*b*mag*tw*gain*step(r.x,dens);
}
float mare(vec2 q,vec2 c,vec2 r){vec2 e=(q-c)/r;return exp(-dot(e,e)*1.8);}
float moonAlb(vec2 q){
  float m=0.0;
  m+=mare(q,vec2(0.70,0.30),vec2(0.11,0.09));m+=mare(q,vec2(0.60,-0.10),vec2(0.12,0.16));m+=mare(q,vec2(0.42,-0.26),vec2(0.09,0.09));
  m+=mare(q,vec2(0.40,0.12),vec2(0.17,0.13));m+=mare(q,vec2(0.24,0.40),vec2(0.14,0.13));m+=0.8*mare(q,vec2(0.05,0.24),vec2(0.08,0.07));
  m+=mare(q,vec2(-0.25,0.50),vec2(0.25,0.20));m+=0.7*mare(q,vec2(-0.02,0.78),vec2(0.42,0.06));m+=mare(q,vec2(-0.60,0.12),vec2(0.24,0.42));
  m+=0.9*mare(q,vec2(-0.20,-0.33),vec2(0.17,0.13));m+=0.7*mare(q,vec2(-0.36,-0.12),vec2(0.10,0.10));m+=0.9*mare(q,vec2(-0.55,-0.38),vec2(0.09,0.09));
  float n=nvn2(q*7.0)*0.55+nvn2(q*15.0)*0.3+nvn2(q*33.0)*0.15;
  m=clamp(m*(0.7+0.6*n),0.0,1.0);
  float a=mix(1.0,0.55,smoothstep(0.25,0.75,m));
  a*=0.9+0.2*nvn2(q*26.0+3.1);
  vec2 ty=q-vec2(-0.12,-0.72);a+=0.45*exp(-dot(ty,ty)/0.0012);
  vec2 co=q-vec2(-0.33,0.17);a+=0.25*exp(-dot(co,co)/0.0008);
  vec2 ar=q-vec2(-0.72,0.38);a+=0.35*exp(-dot(ar,ar)/0.0004);
  return a;
}
void main(){
  vec3 d=normalize(vWorldPos-cameraPosition);
  float pa=max(length(fwidth(d)),1e-5);
  float h=d.y;float hp=max(h,0.0);
  vec3 sd=normalize(uSunDir);
  vec3 sH=normalize(vec3(sd.x,0.0,sd.z)+vec3(1e-5,0.0,0.0));
  float azS=dot(d,sH);float cosS=dot(d,sd);
  /* elevation gradient + horizon haze */
  float k=mix(3.6,2.0,uHaze);
  float gt=(1.0-exp(-hp*k))/(1.0-exp(-k));
  vec3 col=mix(uHorizon,uZenith,gt);
  float hz=exp(-hp*mix(30.0,8.0,uHaze));
  vec3 hazeC=uHazeCol;
  col=mix(col,hazeC,hz*clamp(uHaze*1.15,0.0,1.0));
  /* twilight: Earth's shadow + Belt of Venus opposite the sun; warm horizon toward the sun */
  float sunVis=smoothstep(-0.20,0.0,sd.y);
  float low=1.0-smoothstep(0.0,0.45,sd.y);
  float twi=smoothstep(-0.22,-0.03,sd.y)*(1.0-smoothstep(0.06,0.24,sd.y));
  float anti=smoothstep(0.0,0.85,-azS);
  float belt=exp(-pow((hp-0.11)/0.075,2.0));
  float esh=1.0-smoothstep(0.0,0.08,hp);
  col=mix(col,col*vec3(0.56,0.60,0.86),esh*anti*twi*uBelt*0.85);
  col+=uBeltCol*belt*anti*twi*uBelt;
  float sw=pow(max(azS,0.0),2.5)*exp(-hp*3.2);
  col+=uSunCol*uSunInt*0.20*sw*low*sunVis;
  /* Mie glow */
  float hb=exp(-hp*4.0);
  col+=uSunCol*uSunInt*uGlow*(0.0075*nhg(cosS,0.88)+0.028*nhg(cosS,0.6)*(0.35+0.65*hb)+0.035*nhg(cosS,0.22)*hb)*sunVis;
  /* sun shafts (fake crepuscular rays) */
  if(uShafts>0.001){
    vec3 up2=abs(sd.y)>0.99?vec3(1.0,0.0,0.0):vec3(0.0,1.0,0.0);
    vec3 sx=normalize(cross(sd,up2));vec3 sy=cross(sx,sd);
    float ax=dot(d,sx),ay=dot(d,sy);float an=(abs(ax)+abs(ay)<1e-5)?0.0:atan(ay,ax);
    float rays=0.26*sin(an*7.0+1.3)+0.18*sin(an*13.0+4.1)+0.12*sin(an*23.0+2.2+uTime*0.01)+0.08*sin(an*41.0+0.7);
    float sdd=length(d-sd);
    float env=smoothstep(0.02,0.09,sdd)*exp(-sdd*1.5)*sunVis*smoothstep(-0.02,0.06,h)*step(0.0,cosS);
    col+=uSunCol*uSunInt*uShafts*0.45*rays*env*(0.4+0.6*hb);
    col=max(col,vec3(0.0));
  }
  /* stars (+ optional milky way) */
  vec3 st=vec3(0.0);
  if(uStars>0.001){
    st=starLayer(d,170.0,0.05,pa,1.0)+starLayer(d,380.0,0.04,pa,0.5);
    if(uMilky>0.001){
      vec3 gN=normalize(vec3(-0.35,0.55,0.76));float gb=dot(d,gN);float band=exp(-gb*gb/0.025);
      vec3 w=abs(d);w/=(w.x+w.y+w.z);
      float mn=texture2D(tNoise,d.yz*1.7).r*w.x+texture2D(tNoise,d.zx*1.7).r*w.y+texture2D(tNoise,d.xy*1.7).r*w.z;
      float dust=texture2D(tNoise,d.yz*4.1).b*w.x+texture2D(tNoise,d.zx*4.1).b*w.y+texture2D(tNoise,d.xy*4.1).b*w.z;
      st+=vec3(0.55,0.6,0.75)*band*(0.35+0.65*mn)*(1.0-0.7*smoothstep(0.45,0.8,dust)*exp(-gb*gb/0.006))*0.06*uMilky;
      st+=starLayer(d,620.0,0.10*band,pa,0.35*uMilky);
    }
    st*=smoothstep(0.0,0.2,h)*uStars;
  }
  /* moon */
  vec3 md=normalize(uMoonDir);
  float mdist=length(d-md);
  float illum=0.5-0.5*cos(uMoonPhase*6.2831853);
  float mUp=smoothstep(-0.04,0.02,md.y);
  col+=uMoonCol*uMoonVis*mUp*(0.4+0.6*illum)*illum*(0.05*exp(-mdist/(uMoonSize*2.6))+0.025*exp(-mdist/0.09)+0.012*exp(-mdist/0.35));
  float mDisc=0.0;vec3 mCol=vec3(0.0);
  if(uMoonVis>0.001){
    vec3 upm=abs(md.y)>0.999?vec3(0.0,0.0,1.0):vec3(0.0,1.0,0.0);
    vec3 mx=normalize(cross(md,upm));vec3 my=cross(mx,md);
    vec2 q=vec2(dot(d,mx),dot(d,my))/uMoonSize;float r=length(q);
    float maa=pa/uMoonSize*1.25;
    mDisc=(1.0-smoothstep(1.0-maa,1.0+maa,r))*step(0.0,dot(d,md))*uMoonVis*smoothstep(-0.002,0.004,h);
    vec3 n=vec3(q,sqrt(max(1.0-r*r,0.0)));
    vec2 s2=vec2(dot(sd,mx),dot(sd,my));float sl=length(s2);s2=sl>1e-3?s2/sl:vec2(1.0,0.0);
    float ph=uMoonPhase;float el=(ph<=0.5?ph:1.0-ph)*6.2831853;
    vec3 L=vec3(s2*sin(el),-cos(el));
    float lit=smoothstep(-0.035,0.085,dot(n,L));
    mCol=uMoonCol*moonAlb(q)*(lit*(0.84+0.16*n.z)+0.018);
  }
  /* sun disc */
  float sdist=length(d-sd);float saa=pa*1.4;
  float sdisc=1.0-smoothstep(uSunSize-saa,uSunSize+saa,sdist);
  float mu=sqrt(max(1.0-sdist*sdist/(uSunSize*uSunSize),0.0));
  vec3 sunC=uSunCol*uSunInt*26.0*sdisc*(0.55+0.45*pow(mu,0.45))*smoothstep(-0.0015,0.0025,h);
  col+=st*(1.0-mDisc);
  col+=mCol*mDisc;
  col+=sunC;
  /* clouds (projected on a curved layer) */
  if(uCover+uScales+uCirrus>0.001){
    float hk=h+0.1;
    vec2 p=d.xz/max(hk,0.02)*uCScale;
    vec2 q=p+uWind*uTime*uCSpeed;
    const mat2 R1=mat2(0.80,-0.60,0.60,0.80);const mat2 R2=mat2(-0.28,-0.96,0.96,-0.28);
    vec2 w=vec2(texture2D(tNoise,q*0.019+vec2(0.13,0.71)).b,texture2D(tNoise,q*0.019+vec2(0.57,0.29)).r)-0.5;
    vec2 qw=q+w*2.4;
    float f=texture2D(tNoise,qw*0.040).r*0.52+texture2D(tNoise,R1*qw*0.094+0.31).b*0.26;
    float fd=0.5;
#if SKYQ>0
    fd=texture2D(tNoise,R2*qw*0.215+0.67).r;
#endif
#if SKYQ>1
    fd=fd*0.68+texture2D(tNoise,R1*qw*0.49+0.11).b*0.32;
#endif
    f+=fd*0.22;
    float thr=mix(0.80,0.30,uCover);float on=step(0.001,uCover);
    float dens=smoothstep(thr,thr+0.16,f)*on;
    vec2 sdir=sd.xz;float sl2=length(sdir);sdir=sl2>1e-4?sdir/sl2:vec2(1.0,0.0);
    float lstep=mix(0.35,1.1,1.0-clamp(sd.y*1.6,0.0,1.0));
    vec2 ql=qw+sdir*lstep;
    float fl=texture2D(tNoise,ql*0.040).r*0.52+texture2D(tNoise,R1*ql*0.094+0.31).b*0.26+fd*0.22;
    float densL=smoothstep(thr-0.04,thr+0.2,fl)*on;
    float lightC=clamp(0.55+(dens-densL)*1.4,0.0,1.0)*mix(1.0,0.72,densL);
    float sc=0.0;float lightS=0.9;
    if(uScales>0.001){
      vec2 qs=(q+w*0.7)*vec2(2.7,3.5);
      float c1=texture2D(tNoise,qs).g;float c1L=texture2D(tNoise,qs+sdir*0.10).g;
      float rip=0.5+0.5*sin(dot(q,vec2(0.83,0.55))*6.5+f*6.0);
      float mask=smoothstep(0.36,0.70,texture2D(tNoise,q*0.045+vec2(0.5,0.1)).b)*smoothstep(0.28,0.62,texture2D(tNoise,q*0.016+vec2(0.2,0.6)).r);
      sc=smoothstep(0.20,0.78,c1*(0.72+0.28*rip))*mask*uScales;
      lightS=clamp(0.78+(c1-c1L)*2.2,0.45,1.0);
    }
    float ci=0.0;
    if(uCirrus>0.001){
      vec2 wd=normalize(uWind+vec2(1e-4,0.0));
      vec2 cq=vec2(dot(q,wd),dot(q,vec2(-wd.y,wd.x)))+w*vec2(1.6,3.4);
      float s1=texture2D(tNoise,vec2(cq.x*0.018,cq.y*0.15)).r;
      float s2c=texture2D(tNoise,vec2(cq.x*0.045,cq.y*0.40)+0.37).b;
      float s3=texture2D(tNoise,vec2(cq.x*0.11,cq.y*0.95)+0.71).r;
      float m=smoothstep(0.42,0.80,texture2D(tNoise,q*0.02+0.71).r);
      ci=smoothstep(0.56,0.86,s1*0.55+s2c*0.3+s3*0.15)*m*uCirrus*0.65;
    }
    float tau=dens*3.4+sc*2.3+ci*1.4;
    float D=clamp(dens+sc+ci,0.0,1.0);
    float lightT=(dens*lightC+sc*lightS+ci*0.95)/max(dens+sc+ci,1e-3);
    float thick=clamp(dens*densL*1.4,0.0,1.0);
    float side=0.5+0.5*azS;
    vec3 lit=uCCol*mix(0.80,1.15,side*side);
    vec3 cc=mix(uCShade,lit,lightT);
    cc=mix(cc,uCShade,thick*0.3);
    float edge=clamp(1.0-tau*0.5,0.0,1.0);
    cc+=uSunCol*uSunInt*(0.03*nhg(cosS,0.7)+0.006*nhg(cosS,0.92))*(0.25+0.75*edge)*sunVis;
    cc+=uMoonCol*uMoonVis*mUp*illum*0.04*nhg(dot(d,md),0.85)*(0.3+0.7*edge);
    vec3 horizonC=mix(uHorizon,hazeC,clamp(uHaze*1.15,0.0,1.0));
    cc=mix(cc,horizonC,exp(-hp*6.0)*0.72);
    float ca=(1.0-exp(-tau))*uCOpacity*smoothstep(0.0,0.085,h)*step(0.002,D);
    col=mix(col,cc,ca);
  }
  /* below the horizon */
  col=mix(col,uGround,1.0-exp(min(h,0.0)*16.0));
  gl_FragColor=vec4(max(col,vec3(0.0)),1.0);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
  gl_FragColor.rgb+=(nh12(gl_FragCoord.xy)-0.5)/255.0;
}`;

const SKY_DEFAULT={zenith:[0.06,0.15,0.42],horizon:[0.36,0.61,0.96],haze:0.4,hazeColor:[0.75,0.85,1.0],ground:[0.16,0.16,0.15],
  sunDir:[0.3,0.6,0.5],sunColor:[1.0,0.93,0.82],sunIntensity:1.2,sunSize:0.0115,glow:1.0,shafts:0.0,
  moonDir:[-0.4,0.5,-0.6],moonColor:[1.5,1.45,1.35],moonPhase:0.5,moonVisible:0,moonSize:0.022,
  stars:0,milkyWay:0,cloudCover:0.25,cloudColor:[1.1,1.1,1.12],cloudShade:[0.55,0.6,0.7],cloudScale:1.0,cloudSpeed:1.0,cloudOpacity:1.0,
  cirrus:0,scales:0,wind:[1.0,0.3],belt:1.0,beltColor:[0.35,0.18,0.25]};

function makeSky(opts){opts=opts||{};const q=qlv(opts),res=Res(),radius=opts.radius||700;
  const U={uZenith:{value:new T.Color()},uHorizon:{value:new T.Color()},uGround:{value:new T.Color()},uHazeCol:{value:new T.Color()},uHaze:{value:0.4},
    uSunDir:{value:new T.Vector3(0,1,0)},uSunCol:{value:new T.Color()},uSunInt:{value:1},uSunSize:{value:0.0115},uGlow:{value:1},uShafts:{value:0},
    uMoonDir:{value:new T.Vector3(0,1,0)},uMoonCol:{value:new T.Color()},uMoonPhase:{value:0.5},uMoonVis:{value:0},uMoonSize:{value:0.022},
    uStars:{value:0},uMilky:{value:0},uCover:{value:0},uCScale:{value:1},uCSpeed:{value:1},uCirrus:{value:0},uScales:{value:0},uCOpacity:{value:1},
    uCCol:{value:new T.Color()},uCShade:{value:new T.Color()},uWind:{value:new T.Vector2(1,0.3)},uBeltCol:{value:new T.Color()},uBelt:{value:1},
    uTime:{value:0},tNoise:{value:noiseTex(res)}};
  const mat=res.own(new T.ShaderMaterial({uniforms:U,vertexShader:SKY_VS,fragmentShader:"#define SKYQ "+q+"\n"+SKY_FS,side:T.BackSide,depthWrite:false,depthTest:true,fog:false}));
  mat.extensions={derivatives:true};
  const geo=res.own(new T.SphereGeometry(radius,48,24));
  const mesh=new T.Mesh(geo,mat);mesh.name="TSURE_sky";mesh.renderOrder=-10;mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;
  const state={};const _v=new T.Vector3();
  function setState(s){if(!s)return;
    const col=(k,u)=>{if(s[k]!==undefined){setC(U[u].value,s[k]);state[k]=s[k];}};
    const num=(k,u)=>{if(typeof s[k]==="number"){U[u].value=s[k];state[k]=s[k];}};
    col("zenith","uZenith");col("horizon","uHorizon");col("ground","uGround");col("hazeColor","uHazeCol");num("haze","uHaze");
    if(s.sunDir){setV(U.uSunDir.value,s.sunDir);U.uSunDir.value.normalize();state.sunDir=s.sunDir;}
    col("sunColor","uSunCol");num("sunIntensity","uSunInt");num("sunSize","uSunSize");num("glow","uGlow");num("shafts","uShafts");
    if(s.moonDir){setV(U.uMoonDir.value,s.moonDir);U.uMoonDir.value.normalize();state.moonDir=s.moonDir;}
    col("moonColor","uMoonCol");num("moonPhase","uMoonPhase");num("moonSize","uMoonSize");
    if(s.moonVisible!==undefined){U.uMoonVis.value=+s.moonVisible;state.moonVisible=+s.moonVisible;}
    num("stars","uStars");num("milkyWay","uMilky");num("cloudCover","uCover");num("cloudScale","uCScale");num("cloudSpeed","uCSpeed");
    num("cloudOpacity","uCOpacity");num("cirrus","uCirrus");num("scales","uScales");col("cloudColor","uCCol");col("cloudShade","uCShade");
    if(s.wind){if(s.wind.isVector2)U.uWind.value.copy(s.wind);else if(Array.isArray(s.wind))U.uWind.value.set(s.wind[0],s.wind[1]);state.wind=s.wind;}
    col("beltColor","uBeltCol");num("belt","uBelt");}
  setState(SKY_DEFAULT);if(opts.state)setState(opts.state);
  function center(cam){if(!cam)return;_v.setFromMatrixPosition(cam.matrixWorld);if(mesh.parent&&mesh.parent.type!=="Scene"){mesh.parent.updateMatrixWorld();mesh.parent.worldToLocal(_v);}
    mesh.position.copy(_v);mesh.updateMatrixWorld(true);}
  mesh.onBeforeRender=(r,s,cam)=>center(cam);
  let tAcc=0;
  mesh.userData={setState,getState:()=>Object.assign({},state),uniforms:U,
    update(dt,t,camera){if(typeof t==="number")tAcc=t;else tAcc+=dt||0;U.uTime.value=tAcc;center(camera);},
    dispose(){res.dispose();}};
  return mesh;}

/* =====================================================================
 * 2b. presets (authored in DISPLAY colours, converted to scene-linear at load)
 * ===================================================================== */
const PRESET_SRC={
  autumnDawnMist:{E:1.0,zenith:"#7d90b3",horizon:"#e7cfc0",hazeColor:"#efdccf",haze:0.75,ground:"#8d8a86",
    sun:[100,2.6],sunColor:"#ffa45a",sunIntensity:2.2,glow:1.15,cloudCover:0.0,cirrus:0.45,scales:0.0,cloudColor:"#f3cdbf",cloudShade:"#8e8fae",wind:[0.6,0.2],
    beltColor:"#3a2a36",belt:0.6,
    rim:{color:0xffd2b0,intensity:0.28},sunLight:{color:0xffd2a2,intensity:0.85},hemi:{sky:0xc9cfe2,ground:0x7c7464,intensity:0.55},ambient:{color:0xb4b6cc,intensity:0.18},
    fogDensity:0.012,hills:{near:"#6d7385",far:"#b9b9c6",light:"#f6c79e"},mist:{color:"#e9e2dc",glow:"#ffd9b0"}},
  autumnDuskToribe:{E:0.97,zenith:"#2d3567",horizon:"#cf8f86",hazeColor:"#e59b77",haze:0.55,ground:"#3c3446",
    sun:[252,1.4],sunColor:"#ff6a24",sunIntensity:3.0,glow:1.25,shafts:0.25,cloudCover:0.18,cirrus:0.35,scales:0.3,cloudColor:"#ffa77d",cloudShade:"#5e4f73",wind:[0.8,0.25],
    beltColor:"#5d3346",belt:1.0,
    rim:{color:0xffb07a,intensity:0.34},sunLight:{color:0xff9a52,intensity:0.95},hemi:{sky:0x9a8fb8,ground:0x5c4636,intensity:0.38},ambient:{color:0x8f88b8,intensity:0.14},
    fogDensity:0.004,hills:{near:"#3b3550",far:"#9a7f9c",light:"#ffb070"},mist:{color:"#b49aa4",glow:"#ffb27a"},smoke:{light:0xffa35c,ambient:0x6f6a8e}},
  autumnDay:{E:1.05,zenith:"#3f6fb4",horizon:"#b9cddb",hazeColor:"#d6dee2",haze:0.4,ground:"#77786a",
    sun:[205,38],sunColor:"#fff2e2",sunIntensity:1.3,glow:0.9,cloudCover:0.12,scales:0.75,cirrus:0.2,cloudColor:"#fbfbfb",cloudShade:"#a9b4c4",wind:[1.0,0.35],
    beltColor:"#000000",belt:0.0,
    rim:{color:0xcfe3ff,intensity:0.22},sunLight:{color:0xfff0dc,intensity:1.3},hemi:{sky:0xbcd3ea,ground:0x8a7a5c,intensity:0.55},ambient:{color:0xf1edff,intensity:0.17},
    fogDensity:0.0035,hills:{near:"#4f5e4c",far:"#a5b4c4",light:"#fff1d6"},mist:{color:"#dfe6ea",glow:"#ffffff"}},
  earlySummerDay:{E:1.06,zenith:"#3e78c6",horizon:"#c2d6e2",hazeColor:"#dbe4e8",haze:0.45,ground:"#6f7562",
    sun:[150,62],sunColor:"#fff6ea",sunIntensity:1.35,glow:0.85,cloudCover:0.32,scales:0.0,cirrus:0.1,cloudColor:"#ffffff",cloudShade:"#9eabbe",wind:[1.2,0.5],
    beltColor:"#000000",belt:0.0,
    rim:{color:0xcfe3ff,intensity:0.22},sunLight:{color:0xfff4e2,intensity:1.32},hemi:{sky:0xbfd6e8,ground:0x7d7a52,intensity:0.56},ambient:{color:0xf1edff,intensity:0.18},
    fogDensity:0.004,hills:{near:"#3e5a3a",far:"#a3b8c8",light:"#fff4dc"},mist:{color:"#e4ecf0",glow:"#ffffff"}},
  earlySummerDusk:{E:1.0,zenith:"#5579ab",horizon:"#f0c48a",hazeColor:"#f6cf92",haze:0.6,ground:"#5c5446",
    sun:[292,4.5],sunColor:"#ffa448",sunIntensity:2.6,glow:1.3,shafts:0.3,cloudCover:0.14,cirrus:0.3,scales:0.0,cloudColor:"#ffd08a",cloudShade:"#8a7f8e",wind:[0.6,0.4],
    beltColor:"#3a2c3a",belt:0.5,
    rim:{color:0xffc890,intensity:0.32},sunLight:{color:0xffc27a,intensity:1.05},hemi:{sky:0xc6c2c8,ground:0x6a5a40,intensity:0.42},ambient:{color:0xc0b4b0,intensity:0.15},
    fogDensity:0.006,hills:{near:"#4b4a46",far:"#c9a98e",light:"#ffcf8a"},mist:{color:"#e8d6b8",glow:"#ffd28a"}},
  summerNoon:{E:1.04,zenith:"#356fc0",horizon:"#c9dbe6",hazeColor:"#e2eaee",haze:0.5,ground:"#6c725c",
    sun:[180,76],sunColor:"#fffaf2",sunIntensity:1.45,glow:0.8,cloudCover:0.36,scales:0.0,cirrus:0.0,cloudColor:"#ffffff",cloudShade:"#98a6bb",wind:[1.4,0.2],
    beltColor:"#000000",belt:0.0,
    rim:{color:0xd8e8ff,intensity:0.2},sunLight:{color:0xfff6e8,intensity:1.4},hemi:{sky:0xc2d8ec,ground:0x7a7650,intensity:0.58},ambient:{color:0xf1edff,intensity:0.18},
    fogDensity:0.0035,hills:{near:"#355232",far:"#a8bccb",light:"#fffbe8"},mist:{color:"#e6edf1",glow:"#ffffff"}},
  nightMoon:{E:1.0,zenith:"#0a1530",horizon:"#24324f",hazeColor:"#2e3c58",haze:0.35,ground:"#0d1018",
    sun:[0,-32],sunColor:"#ffffff",sunIntensity:0.0,glow:0.0,moon:[128,32],moonPhase:0.5,moonVisible:1,moonColor:"#fff4dc",moonBoost:2.0,
    stars:0.75,milkyWay:0.0,cloudCover:0.1,cirrus:0.25,scales:0.0,cloudColor:"#4c5874",cloudShade:"#141b2c",wind:[0.5,0.2],beltColor:"#000000",belt:0.0,
    rim:{color:0x8fb0ff,intensity:0.45},sunLight:{color:0x9fb3df,intensity:0.38,dirFrom:"moon"},hemi:{sky:0x2d3d63,ground:0x0d0f16,intensity:0.22},ambient:{color:0x6c7ca8,intensity:0.07},
    fogDensity:0.006,hills:{near:"#0f1424",far:"#26314a",light:"#8090b8"},mist:{color:"#4a5772",glow:"#a8b4d4"}},
  predawnBlue:{E:1.0,zenith:"#15214a",horizon:"#7b7795",hazeColor:"#a28e98",haze:0.55,ground:"#2a2a38",
    sun:[82,-6.5],sunColor:"#ff7a44",sunIntensity:1.6,glow:1.0,moon:[105,17],moonPhase:0.88,moonVisible:1,moonColor:"#ffe9c8",moonBoost:1.6,
    stars:0.45,milkyWay:0.25,cloudCover:0.0,cirrus:0.3,scales:0.0,cloudColor:"#c69aa2",cloudShade:"#3e3f5e",wind:[0.5,0.1],beltColor:"#000000",belt:0.0,
    rim:{color:0xa8b8ff,intensity:0.35},sunLight:{color:0xb0b8e0,intensity:0.22},hemi:{sky:0x4a5684,ground:0x1c1a22,intensity:0.32},ambient:{color:0x7a84b0,intensity:0.10},
    fogDensity:0.01,hills:{near:"#1d2238",far:"#5b5874",light:"#d49a8e"},mist:{color:"#6f7390",glow:"#c99a9a"}},
  winterDay:{E:1.04,zenith:"#7591b6",horizon:"#d4d9dd",hazeColor:"#dfe2e4",haze:0.6,ground:"#9a9a98",
    sun:[190,27],sunColor:"#fff0e2",sunIntensity:0.9,glow:0.7,cloudCover:0.55,scales:0.0,cirrus:0.2,cloudColor:"#eceef1",cloudShade:"#9ca3ae",wind:[1.0,-0.4],
    beltColor:"#000000",belt:0.0,
    rim:{color:0xdde8ff,intensity:0.24},sunLight:{color:0xfff0e0,intensity:0.95},hemi:{sky:0xd2dae6,ground:0x8c8a86,intensity:0.62},ambient:{color:0xe8ecf6,intensity:0.2},
    fogDensity:0.006,hills:{near:"#5c6168",far:"#c3c9d0",light:"#fff0dc"},mist:{color:"#e6e8ea",glow:"#ffffff"}},
  springDay:{E:1.06,zenith:"#6a95cc",horizon:"#d9e1e5",hazeColor:"#e7eaea",haze:0.75,ground:"#82816e",
    sun:[160,55],sunColor:"#fff4e6",sunIntensity:1.25,glow:0.95,cloudCover:0.16,scales:0.0,cirrus:0.35,cloudColor:"#ffffff",cloudShade:"#b2bccb",wind:[0.8,0.3],
    beltColor:"#000000",belt:0.0,
    rim:{color:0xd6e6ff,intensity:0.22},sunLight:{color:0xfff4e2,intensity:1.22},hemi:{sky:0xc8dcec,ground:0x8a845e,intensity:0.58},ambient:{color:0xf4f0ff,intensity:0.18},
    fogDensity:0.006,hills:{near:"#6a7a62",far:"#c4ccd2",light:"#fff6e2"},mist:{color:"#e8ecee",glow:"#ffffff"}}
};
function buildPreset(name,s){const E=s.E;const L=h=>linearOf(h,E);
  const sunDir=dirAzEl(s.sun[0],s.sun[1]);const moonDir=s.moon?dirAzEl(s.moon[0],s.moon[1]):dirAzEl((s.sun[0]+180)%360,-20);
  const hz=L(s.horizon),hc=L(s.hazeColor),zen=L(s.zenith);
  const hzEff=hz.map((v,i)=>lerp(v,hc[i],clamp(s.haze*1.15,0,1)));
  const fogHex=rgbHex(displayOf(hzEff,E));
  const sc=hexRGB(s.sunColor),mc=s.moonColor?hexRGB(s.moonColor).map(v=>+(v*(s.moonBoost||1.5)).toFixed(4)):[1.5,1.45,1.35];
  const LC=h=>{const c=hexRGB(h),m=Math.max(...c),k=m>0.93?0.93/m:1;return linearOf(rgbHex(c.map(v=>v*k)),E);};
  const p={name,zenith:zen,horizon:hz,haze:s.haze,hazeColor:hc,ground:L(s.ground),sunDir,sunColor:sc,sunIntensity:s.sunIntensity,sunSize:0.0115,glow:s.glow,shafts:s.shafts||0,
    moonDir,moonColor:mc,moonPhase:s.moonPhase!==undefined?s.moonPhase:0.5,moonVisible:s.moonVisible||0,moonSize:0.022,
    stars:s.stars||0,milkyWay:s.milkyWay||0,cloudCover:s.cloudCover,cloudColor:LC(s.cloudColor),cloudShade:LC(s.cloudShade),cloudScale:1.0,cloudSpeed:1.0,cloudOpacity:1.0,
    cirrus:s.cirrus||0,scales:s.scales||0,wind:s.wind,belt:s.belt,beltColor:L(s.beltColor),
    sunLight:{color:s.sunLight.color,intensity:s.sunLight.intensity,dir:s.sunLight.dirFrom==="moon"?moonDir.slice():(s.sun[1]<3?dirAzEl(s.sun[0],Math.max(s.sun[1],0)+(s.sun[1]<0?22:3)):sunDir.slice())},
    hemi:Object.assign({},s.hemi),ambient:Object.assign({},s.ambient),fog:{color:fogHex,density:s.fogDensity},exposure:E,
    rim:{color:s.rim.color,intensity:s.rim.intensity,dir:(s.sunLight.dirFrom==="moon"?moonDir:sunDir).map((v,i)=>i===1?Math.abs(v)*0.6+0.35:-v)},
    hills:{near:parseInt(s.hills.near.slice(1),16),far:parseInt(s.hills.far.slice(1),16),light:parseInt(s.hills.light.slice(1),16)},
    mist:{color:parseInt(s.mist.color.slice(1),16),glow:parseInt(s.mist.glow.slice(1),16)},
    smoke:s.smoke?Object.assign({},s.smoke):{light:s.sunLight.color,ambient:s.hemi.sky},
    water:{zenith:zen,horizon:hzEff,sunDir,sunColor:sc,sunIntensity:s.sunIntensity}};
  return p;}
const SKY_PRESETS={};
Object.keys(PRESET_SRC).forEach(k=>{SKY_PRESETS[k]=buildPreset(k,PRESET_SRC[k]);});

const COLOR_KEYS=new Set(["color","sky","ground","near","far","light","ambient","glow"]);
function blendVal(a,b,t,key){
  if(typeof a==="number"&&typeof b==="number"){if(COLOR_KEYS.has(key)){const A=hexRGB(a),B=hexRGB(b);return rgbHex(A.map((v,i)=>lerp(v,B[i],t)));}return lerp(a,b,t);}
  if(Array.isArray(a)&&Array.isArray(b))return a.map((v,i)=>lerp(v,b[i]!==undefined?b[i]:v,t));
  if(a&&b&&typeof a==="object"&&typeof b==="object"){const o={};new Set([...Object.keys(a),...Object.keys(b)]).forEach(k=>{o[k]=(k in a&&k in b)?blendVal(a[k],b[k],t,k):(k in a?a[k]:b[k]);});return o;}
  return t<0.5?a:b;}
function blendPresets(a,b,t){if(typeof a==="string")a=SKY_PRESETS[a];if(typeof b==="string")b=SKY_PRESETS[b];const o=blendVal(a,b,clamp(t,0,1),"");
  ["sunDir","moonDir"].forEach(k=>{if(o[k]){const l=Math.hypot(o[k][0],o[k][1],o[k][2])||1;o[k]=o[k].map(v=>v/l);}});return o;}
function rotYArr(v,yaw){if(!v)return v;const c=Math.cos(yaw),s=Math.sin(yaw);return [v[0]*c+v[2]*s,v[1],-v[0]*s+v[2]*c];}
function applyPreset(p,o){if(typeof p==="string")p=SKY_PRESETS[p];if(!p)return null;o=o||{};const yaw=o.yaw||0;
  const st=Object.assign({},p);if(yaw){st.sunDir=rotYArr(p.sunDir,yaw);st.moonDir=rotYArr(p.moonDir,yaw);
    if(p.wind){const r=rotYArr([p.wind[0],0,p.wind[1]],yaw);st.wind=[r[0],r[2]];}}
  if(o.sky&&o.sky.userData.setState)o.sky.userData.setState(st);
  if(o.sun&&p.sunLight){o.sun.color.set(p.sunLight.color);o.sun.intensity=p.sunLight.intensity;const d=V3(yaw?rotYArr(p.sunLight.dir,yaw):p.sunLight.dir).normalize();
    const tg=o.sun.target?o.sun.target.position:new T.Vector3();o.sun.position.copy(tg).addScaledVector(d,o.sunDistance||80);}
  if(o.hemi&&p.hemi){o.hemi.color.set(p.hemi.sky);o.hemi.groundColor.set(p.hemi.ground);o.hemi.intensity=p.hemi.intensity;}
  if(o.ambient&&p.ambient){o.ambient.color.set(p.ambient.color);o.ambient.intensity=p.ambient.intensity;}
  if(o.rim&&p.rim){o.rim.color.set(p.rim.color);o.rim.intensity=p.rim.intensity;const d=V3(yaw?rotYArr(p.rim.dir,yaw):p.rim.dir).normalize();const tg=o.rim.target?o.rim.target.position:new T.Vector3();o.rim.position.copy(tg).addScaledVector(d,o.sunDistance||80);}
  if(o.scene&&p.fog){if(o.scene.fog){o.scene.fog.color.set(p.fog.color);if(o.scene.fog.density!==undefined)o.scene.fog.density=p.fog.density;}
    if(o.background!==false&&o.scene.background&&o.scene.background.isColor)o.scene.background.set(p.fog.color);}
  if(o.renderer&&p.exposure)o.renderer.toneMappingExposure=p.exposure;
  const list=x=>x?(Array.isArray(x)?x:[x]):[];
  list(o.hills).forEach(h=>h.userData.setTint&&h.userData.setTint(Object.assign({sunDir:st.sunDir},p.hills)));
  list(o.water).forEach(w=>w.userData.setSky&&w.userData.setSky(Object.assign({},p.water,{sunDir:st.sunDir})));
  list(o.smoke).forEach(s=>s.userData.setLight&&s.userData.setLight({dir:st.sunDir,color:p.smoke.light,ambient:p.smoke.ambient}));
  list(o.mist).forEach(m=>{m.userData.setColor&&m.userData.setColor(p.mist.color);m.userData.setLight&&m.userData.setLight({dir:st.sunDir,color:p.mist.glow});});
  return st;}

/* =====================================================================
 * 3. TERRAIN
 * ===================================================================== */
/* tiny anti-aliased rasterisers into Float32 planes (wrap-around, tileable) */
function rasterSeg(N,x0,y0,x1,y1,w,cb){const minx=Math.floor(Math.min(x0,x1)-w-1),maxx=Math.ceil(Math.max(x0,x1)+w+1),miny=Math.floor(Math.min(y0,y1)-w-1),maxy=Math.ceil(Math.max(y0,y1)+w+1);
  const dx=x1-x0,dy=y1-y0,l2=dx*dx+dy*dy||1e-6;
  for(let y=miny;y<=maxy;y++){const wy=((y%N)+N)%N;for(let x=minx;x<=maxx;x++){const px=x+0.5-x0,py=y+0.5-y0;const t=clamp((px*dx+py*dy)/l2,0,1);const ex=px-dx*t,ey=py-dy*t;
      const d=Math.sqrt(ex*ex+ey*ey);const cov=clamp(w*0.5+0.5-d,0,1);if(cov>0)cb(wy*N+(((x%N)+N)%N),cov,t);}}}
function rasterShape(N,cx,cy,R,rot,sy,fr,cb){// fr(theta)-> radius factor (0..1); shape in local frame scaled by (1,sy)
  const ext=R+2,ca=Math.cos(rot),sa=Math.sin(rot);
  for(let y=Math.floor(cy-ext);y<=Math.ceil(cy+ext);y++){const wy=((y%N)+N)%N;for(let x=Math.floor(cx-ext);x<=Math.ceil(cx+ext);x++){
      const px=x+0.5-cx,py=y+0.5-cy;const lx=px*ca+py*sa,ly=(-px*sa+py*ca)/sy;const d=Math.sqrt(lx*lx+ly*ly);if(d>R+1.5)continue;
      const th=Math.atan2(ly,lx),rr=R*fr(th);const cov=clamp(rr-d+0.5,0,1);if(cov>0)cb(wy*N+(((x%N)+N)%N),cov,d/Math.max(rr,1e-3),lx/R,ly/R);}}}
function makeGrassTex(N){const rng=RNG(101),sc=N/512,n=N*N;const Lm=new Float32Array(n).fill(58),Hu=new Float32Array(n).fill(128),Ht=new Float32Array(n);
  const clumps=Math.round(n/70);
  for(let c=0;c<clumps;c++){const cx=rng.r(0,N),cy=rng.r(0,N),hue=rng.r(30,225),nb=rng.i(5,10),L=rng.r(5,11)*sc;
    for(let b=0;b<nb;b++){const a=rng.r(0,TAU),len=L*rng.r(0.55,1.35),lum=rng.r(85,255),w=rng.r(0.9,2.0)*sc,bend=rng.r(-0.5,0.5);
      const x0=cx+Math.cos(a)*rng.r(0,L*0.25),y0=cy+Math.sin(a)*rng.r(0,L*0.25);
      const xm=x0+Math.cos(a)*len*0.5,ym=y0+Math.sin(a)*len*0.5,x1=xm+Math.cos(a+bend)*len*0.5,y1=ym+Math.sin(a+bend)*len*0.5;
      const f=(seg)=>(i,cov,t)=>{const tt=(seg+t)*0.5;Lm[i]+=(lum*(0.8+0.2*tt)-Lm[i])*cov;Hu[i]+=(hue-Hu[i])*cov;Ht[i]=Math.max(Ht[i]*(1-cov*0.5),cov*(0.45+0.55*tt));};
      rasterSeg(N,x0,y0,xm,ym,w,f(0));rasterSeg(N,xm,ym,x1,y1,w*0.8,f(1));}}
  const d=new Uint8Array(n*4);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x,u=x/N,v=y/N;
    d[i*4]=clamp(Lm[i],0,255);d[i*4+1]=clamp(Hu[i],0,255);d[i*4+2]=clamp(128+pfbm2(u*6,v*6,6,4,303)*230,0,255);
    d[i*4+3]=clamp(Ht[i]*170+Lm[i]*0.25+50*pfbm2(u*14,v*14,14,3,404)+20,0,255);}
  noiseDone();return dtex(d,N,N,{aniso:8});}
function makeSoilTex(N){const rng=RNG(202),sc=N/512,n=N*N;const R=new Float32Array(n),G=new Float32Array(n),B=new Float32Array(n),Hh=new Float32Array(n);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x/N,v=y/N,i=y*N+x;const nn=pfbm2(u*5,v*5,5,5,211),n2=pfbm2(u*24,v*24,24,3,212);
    const t=clamp(0.5+nn*0.9,0,1),b=0.9+0.22*n2;R[i]=lerp(84,140,t)*b;G[i]=lerp(64,112,t)*b;B[i]=lerp(46,84,t)*b;Hh[i]=40+n2*40+nn*30;}
  const peb=Math.round(n/600);
  for(let k=0;k<peb;k++){const x=rng.r(0,N),y=rng.r(0,N),r=rng.r(1.2,5.5)*sc,e=rng.r(0.6,1),rot=rng.r(0,TAU),tone=rng.r(0.7,1.25);
    const base=[rng.r(120,160)*tone,rng.r(108,140)*tone,rng.r(92,120)*tone];
    rasterShape(N,x+r*0.25,y+r*0.3,r*1.1,rot,e,()=>1,(i,cov)=>{const k2=cov*0.4;R[i]*=1-k2;G[i]*=1-k2;B[i]*=1-k2;});
    rasterShape(N,x,y,r,rot,e,()=>1,(i,cov,dn,lx,ly)=>{const nz=Math.sqrt(Math.max(0,1-dn*dn));const sh=0.62+0.5*clamp(nz*0.7-lx*0.35-ly*0.35,0,1);
      R[i]=lerp(R[i],base[0]*sh,cov);G[i]=lerp(G[i],base[1]*sh,cov);B[i]=lerp(B[i],base[2]*sh,cov);Hh[i]=lerp(Hh[i],120+nz*130,cov);});}
  for(let k=0;k<Math.round(n/900);k++){const x=rng.r(0,N),y=rng.r(0,N),a=rng.r(0,TAU),l=rng.r(2,7)*sc,cr=rng.r(40,70);
    rasterSeg(N,x,y,x+Math.cos(a)*l,y+Math.sin(a)*l,rng.r(0.5,1.2)*sc,(i,cov)=>{const k2=cov*0.6;R[i]=lerp(R[i],cr,k2);G[i]=lerp(G[i],cr*0.7,k2);B[i]=lerp(B[i],20,k2);});}
  const d=new Uint8Array(n*4);for(let i=0;i<n;i++){d[i*4]=clamp(R[i],0,255);d[i*4+1]=clamp(G[i],0,255);d[i*4+2]=clamp(B[i],0,255);d[i*4+3]=clamp(Hh[i],0,255);}
  noiseDone();return dtex(d,N,N,{aniso:8});}
function makeRockTex(N,seed,warm){seed=seed||303;const d=new Uint8Array(N*N*4);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x/N,v=y/N,i=(y*N+x)*4;
    const n=pfbm2(u*4,v*4,4,6,seed,0.55),n2=pfbm2(u*16,v*16,16,4,seed+1,0.5);const w1=pworley1(u*7+n*0.6,v*7+n2*0.3,7,seed+2);
    const crack=1-smooth(0.0,0.06,WF2-w1),spk=ih2(x,y,seed+3);
    let t=clamp(0.52+n*0.55+n2*0.18,0,1);let r=lerp(92,170,t),gg=lerp(90,164,t),b=lerp(86,152,t);
    if(warm){r*=1.06;gg*=1.0;b*=0.9;}
    if(spk>0.93){r*=0.55;gg*=0.55;b*=0.55;}else if(spk<0.05){r=Math.min(255,r*1.25);gg=Math.min(255,gg*1.25);b=Math.min(255,b*1.22);}
    r*=1-crack*0.45;gg*=1-crack*0.45;b*=1-crack*0.42;
    const lic=pfbm2(u*9,v*9,9,3,seed+5)>0.32?1:0;
    if(lic){r=lerp(r,178,0.45);gg=lerp(gg,182,0.45);b=lerp(b,160,0.45);}
    d[i]=clamp(r,0,255);d[i+1]=clamp(gg,0,255);d[i+2]=clamp(b,0,255);d[i+3]=clamp(150+n2*160-crack*150,0,255);}
  return dtex(d,N,N,{aniso:8});}
function makeLeafTex(N){const rng=RNG(404),sc=N/512,n=N*N;const R=new Float32Array(n).fill(118),G=new Float32Array(n).fill(76),B=new Float32Array(n).fill(42),A=new Float32Array(n);
  const pal=[[168,36,22],[196,64,26],[214,112,30],[210,160,46],[150,88,40],[120,74,40],[98,62,36],[182,48,30],[226,180,60]];
  const maple=(th)=>{const a=((th+Math.PI*0.5)%TAU+TAU)%TAU;if(a>TAU*0.9||a<TAU*0.1)return 0.35+0.6*smooth(0.1,0.0,Math.min(a,TAU-a)/TAU*10)*0;const lob=Math.abs(Math.cos(3.5*(a-Math.PI)));return 0.36+0.64*Math.pow(lob,2.2);};
  const lens=(th)=>{const c=Math.abs(Math.cos(th)),s2=Math.abs(Math.sin(th));return 1/Math.sqrt(c*c+s2*s2*5.5)*(0.92+0.08*c);};
  const cnt=Math.round(n/330);
  for(let k=0;k<cnt;k++){const x=rng.r(0,N),y=rng.r(0,N);if(pfbm2(x/N*3,y/N*3,3,3,405)<-0.15&&rng.f()<0.7)continue;
    const s=rng.r(7,13)*sc,kind=rng.f()<0.55?0:1,col=rng.pick(pal),rot=rng.r(0,TAU),tone=rng.r(0.8,1.12);
    rasterShape(N,x+s*0.18,y+s*0.22,s,rot,1,kind?lens:maple,(i,cov)=>{const k2=cov*0.35;R[i]*=1-k2;G[i]*=1-k2;B[i]*=1-k2;A[i]=Math.max(A[i],cov*0.5);});
    rasterShape(N,x,y,s,rot,1,kind?lens:maple,(i,cov,dn,lx,ly)=>{const vein=Math.abs(ly)<0.05&&lx>-0.1?0.75:1;const sh=(0.85+0.25*(1-dn))*tone*vein;
      R[i]=lerp(R[i],col[0]*sh,cov);G[i]=lerp(G[i],col[1]*sh,cov);B[i]=lerp(B[i],col[2]*sh,cov);A[i]=Math.max(A[i],cov);});}
  const d=new Uint8Array(n*4);for(let i=0;i<n;i++){d[i*4]=clamp(R[i],0,255);d[i*4+1]=clamp(G[i],0,255);d[i*4+2]=clamp(B[i],0,255);d[i*4+3]=clamp(A[i]*255,0,255);}
  noiseDone();return dtex(d,N,N,{aniso:8});}

const SEASONS={
  spring:{grassA:0x5d723a,grassB:0x6c8442,grassC:0x55703a,grassDry:0x7a7550,dry:0.2,variety:0.5,leaves:0.05,leafTint:0xb89a94,snow:0,soilTint:0xffffff},
  summer:{grassA:0x45582a,grassB:0x566b34,grassC:0x3b4f26,grassDry:0x6c6a40,dry:0.12,variety:0.55,leaves:0.04,leafTint:0x7a6650,snow:0,soilTint:0xf2f2f2},
  autumn:{grassA:0x6c6040,grassB:0x7d6c46,grassC:0x6a5239,grassDry:0x8a7a52,dry:0.5,variety:0.7,leaves:0.5,leafTint:0xd8d0c8,snow:0,soilTint:0xffffff},
  winter:{grassA:0x5a5244,grassB:0x625a4a,grassC:0x504838,grassDry:0x6a604c,dry:0.5,variety:0.5,leaves:0.2,leafTint:0x8a7a68,snow:0.55,soilTint:0xd8d4d0}};
const TERRAIN_HEAD=`
uniform sampler2D tGrass;uniform sampler2D tSoil;uniform sampler2D tRock;uniform sampler2D tLeaf;uniform sampler2D tMacro;
uniform vec3 uGrassA;uniform vec3 uGrassB;uniform vec3 uGrassC;uniform vec3 uGrassDry;uniform float uDry;uniform float uVar;
uniform float uLeaves;uniform vec3 uLeafTint;uniform float uSnow;uniform vec3 uSoilTint;uniform float uBump;
uniform float uRockSlope;uniform float uSoilSlope;uniform float uSoilPatch;uniform float uTexScale;
varying vec3 vTPos;varying vec3 vTNrm;
vec3 tnPerturb(vec3 surf_pos,vec3 surf_norm,vec2 dHdxy,float fd){
  vec3 vSigmaX=vec3(dFdx(surf_pos.x),dFdx(surf_pos.y),dFdx(surf_pos.z));vec3 vSigmaY=vec3(dFdy(surf_pos.x),dFdy(surf_pos.y),dFdy(surf_pos.z));
  vec3 R1=cross(vSigmaY,surf_norm);vec3 R2=cross(surf_norm,vSigmaX);float fDet=dot(vSigmaX,R1)*fd;
  vec3 vGrad=sign(fDet)*(dHdxy.x*R1+dHdxy.y*R2);return normalize(abs(fDet)*surf_norm-vGrad);}
`;
const TERRAIN_BLEND=`
  vec3 tN=normalize(vTNrm);vec2 wp=vTPos.xz*uTexScale;
  vec4 mac=texture2D(tMacro,vTPos.xz*0.0071);vec4 mac2=texture2D(tMacro,vTPos.xz*0.029+0.37);
  float slope=1.0-clamp(tN.y,0.0,1.0);
  mat2 rotA=mat2(0.8,-0.6,0.6,0.8);
  float mixT=smoothstep(0.3,0.7,mac2.r);
  vec4 gr=mix(texture2D(tGrass,wp*0.42),texture2D(tGrass,rotA*wp*0.29+0.31),mixT);
  vec4 so=mix(texture2D(tSoil,wp*0.37),texture2D(tSoil,rotA*wp*0.23+0.53),mixT);
#if TQ>1
  vec3 bw=pow(abs(tN),vec3(4.0));bw/=(bw.x+bw.y+bw.z);
  vec4 rk=texture2D(tRock,vTPos.zy*uTexScale*0.21)*bw.x+texture2D(tRock,wp*0.21)*bw.y+texture2D(tRock,vTPos.xy*uTexScale*0.21)*bw.z;
#else
  vec4 rk=texture2D(tRock,wp*0.21);
#endif
  vec4 lf=mix(texture2D(tLeaf,wp*0.55),texture2D(tLeaf,rotA*wp*0.41+0.2),mixT);
  vec3 gcol=mix(uGrassA,uGrassB,gr.g);
  gcol=mix(gcol,uGrassC,smoothstep(0.42,0.86,mac.g)*uVar);
  float dry=smoothstep(0.45,0.85,gr.b*0.55+mac2.b*0.65-0.1)*uDry;
  gcol=mix(gcol,uGrassDry,dry);
  gcol*=0.55+0.85*gr.r;gcol*=mix(0.84,1.14,mac.b);
  vec3 scol=pow(so.rgb,vec3(2.2))*0.75*uSoilTint*mix(0.86,1.1,mac.r);
  vec3 rcol=pow(rk.rgb,vec3(2.2))*0.68*mix(0.9,1.08,mac2.g);
  float nb=mac2.a-0.5;
  float wR=smoothstep(uRockSlope-0.07,uRockSlope+0.07,slope+nb*0.16);
  float patchS=smoothstep(0.62,0.80,mac.r*0.65+mac2.g*0.35)*uSoilPatch;
  float wS=clamp(smoothstep(uSoilSlope-0.08,uSoilSlope+0.08,slope+nb*0.2)+patchS,0.0,1.0)*(1.0-wR);
  float wG=max(1.0-wR-wS,0.0);
  float hG=gr.a+wG*1.2,hS=so.a+wS*1.2,hR=rk.a+wR*1.2;float hm=max(max(hG,hS),hR)-0.3;
  float bG=max(hG-hm,0.0),bS=max(hS-hm,0.0),bR=max(hR-hm,0.0);float bs=bG+bS+bR+1e-4;bG/=bs;bS/=bs;bR/=bs;
  vec3 tcol=gcol*bG+scol*bS+rcol*bR;
  float tRough=0.94*bG+0.97*bS+0.86*bR;
  float tHeight=gr.a*bG+so.a*bS+rk.a*bR;
  float lm=lf.a*smoothstep(0.15,0.55,uLeaves*1.25-(1.0-mac.g)*0.55+(mac2.b-0.5)*0.4)*(1.0-bR*0.85);
  tcol=mix(tcol,pow(lf.rgb,vec3(2.2))*0.62*uLeafTint,lm);tRough=mix(tRough,0.82,lm);tHeight=mix(tHeight,0.75,lm*0.6);
  float sf=mac2.r*0.5+mac.g*0.3+(tN.y-0.95)*2.2-gr.a*0.32+(gr.r-0.5)*0.12+0.1;
  float sn=smoothstep(1.0-uSnow-0.05,1.0-uSnow+0.05,sf)*step(0.001,uSnow);
  vec3 snowC=vec3(0.70,0.73,0.80)*mix(0.9,1.0,mac.b);
  tcol=mix(tcol,snowC,sn);tRough=mix(tRough,0.6,sn);tHeight=mix(tHeight,0.5+mac.b*0.2,sn);
  diffuseColor.rgb*=tcol;
`;
function makeTerrain(opts){opts=opts||{};const q=qlv(opts),res=Res();
  const size=opts.size||200;let seg=opts.segments||200;seg=Math.max(16,Math.round(seg*[0.5,0.75,1][q]));
  const seed=opts.seed||1;
  const heightAt=opts.heightAt||((x,z)=>1.6*(fbm1(x*0.011+3.1,3,seed)-0.5)*2+1.2*(fbm1(z*0.013+7.7,3,seed+9)-0.5)*2+0.35*(fbm1((x+z)*0.05,3,seed+3)-0.5));
  const cx=opts.center?opts.center[0]:0,cz=opts.center?opts.center[1]:0;
  const geo=res.own(new T.PlaneGeometry(size,size,seg,seg));geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position,nrm=geo.attributes.normal,e=size/seg;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i)+cx,z=pos.getZ(i)+cz;pos.setXYZ(i,x,heightAt(x,z),z);
    const hx=heightAt(x+e,z)-heightAt(x-e,z),hz=heightAt(x,z+e)-heightAt(x,z-e);const l=Math.hypot(hx,2*e,hz);nrm.setXYZ(i,-hx/l,2*e/l,-hz/l);}
  geo.computeBoundingSphere();geo.computeBoundingBox();
  const N=[256,512,512][q];
  const tG=res.sh("grass"+N,()=>makeGrassTex(N)),tS=res.sh("soil"+N,()=>makeSoilTex(N)),tR=res.sh("rock"+N,()=>makeRockTex(N,303,true)),tL=res.sh("leaf"+N,()=>makeLeafTex(N));
  const U={tGrass:{value:tG},tSoil:{value:tS},tRock:{value:tR},tLeaf:{value:tL},tMacro:{value:noiseTex(res)},
    uGrassA:{value:new T.Color()},uGrassB:{value:new T.Color()},uGrassC:{value:new T.Color()},uGrassDry:{value:new T.Color()},uDry:{value:0},uVar:{value:0.5},
    uLeaves:{value:0},uLeafTint:{value:new T.Color()},uSnow:{value:0},uSoilTint:{value:new T.Color(1,1,1)},uBump:{value:opts.bump!==undefined?opts.bump:1.0},
    uRockSlope:{value:opts.rockSlope!==undefined?opts.rockSlope:0.42},uSoilSlope:{value:opts.soilSlope!==undefined?opts.soilSlope:0.24},
    uSoilPatch:{value:opts.soilPatches!==undefined?opts.soilPatches:0.6},uTexScale:{value:opts.texScale||1}};
  const mat=res.own(new T.MeshStandardMaterial({color:0xffffff,roughness:0.95,metalness:0}));
  mat.extensions={derivatives:true};
  mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
    sh.vertexShader="varying vec3 vTPos;varying vec3 vTNrm;\n"+sh.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvTPos=(modelMatrix*vec4(transformed,1.0)).xyz;vTNrm=normalize(mat3(modelMatrix)*objectNormal);");
    sh.fragmentShader="#define TQ "+q+"\n"+sh.fragmentShader.replace("#include <common>","#include <common>\n"+TERRAIN_HEAD)
      .replace("#include <map_fragment>",TERRAIN_BLEND)
      .replace("#include <roughnessmap_fragment>","float roughnessFactor=tRough;")
      .replace("#include <normal_fragment_maps>","#include <normal_fragment_maps>\n  float tFoot=length(fwidth(vTPos.xz));normal=tnPerturb(-vViewPosition,normal,vec2(dFdx(tHeight),dFdy(tHeight))*0.012*uBump*(1.0-smoothstep(0.006,0.03,tFoot)),faceDirection);");};
  mat.customProgramCacheKey=()=>"tsure_terrain_"+q;
  const mesh=new T.Mesh(geo,mat);mesh.name="TSURE_terrain";mesh.receiveShadow=true;mesh.castShadow=!!opts.castShadow;
  let season="summer";
  function setSeason(k,amt){const s=SEASONS[k]||SEASONS.summer;season=k;
    U.uGrassA.value.set(s.grassA).convertSRGBToLinear();U.uGrassB.value.set(s.grassB).convertSRGBToLinear();U.uGrassC.value.set(s.grassC).convertSRGBToLinear();U.uGrassDry.value.set(s.grassDry).convertSRGBToLinear();
    U.uDry.value=s.dry;U.uVar.value=s.variety;U.uLeaves.value=s.leaves;U.uLeafTint.value.set(s.leafTint).convertSRGBToLinear();U.uSnow.value=(amt!==undefined&&k==="winter")?amt:s.snow;U.uSoilTint.value.set(s.soilTint).convertSRGBToLinear();}
  setSeason(opts.season||"summer");
  mesh.userData={heightAt,setSeason,getSeason:()=>season,uniforms:U,
    setSnow(v){U.uSnow.value=clamp(v,0,1);},setLeaves(v){U.uLeaves.value=clamp(v,0,1);},
    dispose(){res.dispose();}};
  return mesh;}

/* channel carving helper: returns heightAt'(x,z) with a smooth channel below the stream's water level */
function carveStream(baseHeightAt,o){o=o||{};const pts=(o.points||[]).map(p=>new T.Vector3(p[0],p[1],p[2]));if(pts.length<2)return baseHeightAt;
  const width=o.width||1.6,depth=o.depth!==undefined?o.depth:0.35,bank=o.bank!==undefined?o.bank:3.2;
  const curve=new T.CatmullRomCurve3(pts,false,"centripetal");const L=curve.getLength();const n=Math.max(8,Math.ceil(L/0.25));
  const sp=[];for(let i=0;i<=n;i++){const p=curve.getPointAt(i/n);sp.push([p.x,p.y,p.z,i/n*L]);}
  const cell=2.0,grid=new Map();sp.forEach((p,i)=>{const k=Math.floor(p[0]/cell)+","+Math.floor(p[2]/cell);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);});
  const wv=s=>width*(1+0.22*(fbm1(s*0.12,3,o.seed||7)-0.5)*2);
  return function(x,z){const b=baseHeightAt(x,z);const gx=Math.floor(x/cell),gz=Math.floor(z/cell);let best=1e9,bi=-1;
    const R=Math.ceil((width*1.5+bank)/cell)+1;
    for(let a=-R;a<=R;a++)for(let c=-R;c<=R;c++){const l=grid.get((gx+a)+","+(gz+c));if(!l)continue;for(const i of l){const p=sp[i];const d=(p[0]-x)*(p[0]-x)+(p[2]-z)*(p[2]-z);if(d<best){best=d;bi=i;}}}
    if(bi<0)return b;const dist=Math.sqrt(best),p=sp[bi],hw=wv(p[3])*0.5;
    const bed=p[1]-depth*Math.pow(clamp(1-(dist/hw)*(dist/hw),0,1),0.7)-0.02;
    if(dist<hw)return Math.min(b,bed);
    const t=smooth(0,1,(dist-hw)/bank);const bankY=p[1]+0.05+(dist-hw)*0.18+0.08*Math.sqrt(dist-hw);return Math.min(b,lerp(Math.min(bankY,b),b,t*t*(3-2*t)));};}

/* =====================================================================
 * 4. STONE material (granite / river rock, triplanar, moss, lichen, wet line)
 * ===================================================================== */
function makeGraniteTex(N){const d=new Uint8Array(N*N*4);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x/N,v=y/N,i=(y*N+x)*4;
    const n=pfbm2(u*5,v*5,5,5,511,0.55),n2=pfbm2(u*20,v*20,20,3,512,0.5),s=ih2(x,y,513),s2=ih2(x>>1,y>>1,514);
    let t=clamp(0.55+n*0.5+n2*0.15,0,1);let r=lerp(118,172,t),g=lerp(116,168,t),b=lerp(110,160,t);
    if(s2>0.9){r*=0.42;g*=0.42;b*=0.44;}else if(s>0.965){r*=0.6;g*=0.6;b*=0.62;}else if(s2<0.06){r=Math.min(255,r*1.22);g=Math.min(255,g*1.2);b=Math.min(255,b*1.18);}
    else if(s<0.02){r=Math.min(255,r*1.12);g*=1.02;b*=0.98;}
    d[i]=clamp(r,0,255);d[i+1]=clamp(g,0,255);d[i+2]=clamp(b,0,255);d[i+3]=clamp(128+n2*200+(s2>0.9?-40:0),0,255);}
  return dtex(d,N,N,{aniso:4});}
const STONE_HEAD=`
uniform sampler2D tStone;uniform sampler2D tSNoise;uniform float uSScale;uniform float uMoss;uniform vec3 uMossCol;uniform float uLichen;
uniform vec3 uSTint;uniform float uWetY;uniform float uDirtH;uniform float uSBump;
varying vec3 vSObj;varying vec3 vSNo;varying vec3 vSW;varying vec3 vSWN;varying float vSWet;varying vec3 vSCol;
vec3 snPerturb(vec3 surf_pos,vec3 surf_norm,vec2 dHdxy,float fd){
  vec3 vSigmaX=vec3(dFdx(surf_pos.x),dFdx(surf_pos.y),dFdx(surf_pos.z));vec3 vSigmaY=vec3(dFdy(surf_pos.x),dFdy(surf_pos.y),dFdy(surf_pos.z));
  vec3 R1=cross(vSigmaY,surf_norm);vec3 R2=cross(surf_norm,vSigmaX);float fDet=dot(vSigmaX,R1)*fd;
  vec3 vGrad=sign(fDet)*(dHdxy.x*R1+dHdxy.y*R2);return normalize(abs(fDet)*surf_norm-vGrad);}
`;
const STONE_FRAG=`
  vec3 bw=pow(abs(normalize(vSNo)),vec3(4.0));bw/=(bw.x+bw.y+bw.z);
  vec3 sp=vSObj*uSScale;
  vec4 sx=texture2D(tStone,sp.zy),sy=texture2D(tStone,sp.xz),sz=texture2D(tStone,sp.xy);
  vec4 st=sx*bw.x+sy*bw.y+sz*bw.z;
  vec3 sc=pow(st.rgb,vec3(2.2))*1.15*uSTint*vSCol;
  float mn=texture2D(tSNoise,sp.xz*0.11+sp.y*0.05).r;
  sc*=0.84+0.32*mn;
  vec3 wn=normalize(vSWN);
  float mossN=texture2D(tSNoise,vSW.xz*0.9+vSW.y*0.35).b;
  float mossF=texture2D(tSNoise,vSW.xz*6.0+vSW.y*3.0).g;
  float moss=smoothstep(0.32,0.62,wn.y*0.75+(mossN-0.5)*0.9+uMoss*0.55-0.3+(mossF-0.5)*0.2)*uMoss;
  vec3 mossC=uMossCol*(0.6+0.7*mossF);
  float lic=smoothstep(0.80,0.88,texture2D(tSNoise,sp.xy*0.8+sp.z*0.33).g)*uLichen;
  float lic2=smoothstep(0.84,0.9,texture2D(tSNoise,sp.zy*1.3+0.5).g)*uLichen;
  sc=mix(sc,vec3(0.62,0.64,0.56),lic*0.75);sc=mix(sc,vec3(0.62,0.42,0.12),lic2*0.55);
  sc*=mix(0.62,1.0,smoothstep(0.0,uDirtH,vSObj.y));
  sc=mix(sc,mossC,moss);
  float wet=1.0-smoothstep(vSWet-0.015,vSWet+0.05,vSW.y);
  sc*=mix(1.0,0.48,wet*(1.0-moss*0.5));
  diffuseColor.rgb*=sc;
  float sRough=mix(mix(0.86,0.97,moss),0.32,wet*(1.0-moss));
  float sH=dot(st.rgb,vec3(0.33))*(1.0-moss)+moss*mossF*0.6;
`;
function stoneMaterial(res,o){o=o||{};const q=o.q!==undefined?o.q:2;
  const tex=o.river?res.sh("rivertex",()=>makeRockTex(512,707,false)):res.sh("granite",()=>makeGraniteTex(512));
  const U={tStone:{value:tex},tSNoise:{value:noiseTex(res)},uSScale:{value:o.scale||1.6},uMoss:{value:o.moss||0},uMossCol:{value:C(o.mossColor,0x4d5a26)},
    uLichen:{value:o.lichen!==undefined?o.lichen:0.5},uSTint:{value:C(o.tint,0xffffff)},uWetY:{value:o.wetY!==undefined?o.wetY:-1e5},uDirtH:{value:o.dirtH||0.12},uSBump:{value:o.bump!==undefined?o.bump:1}};
  const m=new T.MeshStandardMaterial({color:0xffffff,roughness:0.9,metalness:0,vertexColors:!!o.vertexColors});
  m.extensions={derivatives:true};
  const inst=!!o.instanced,instWet=!!o.instWet;
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
    sh.vertexShader=(instWet?"attribute float aWetY;\n":"")+"varying vec3 vSObj;varying vec3 vSNo;varying vec3 vSW;varying vec3 vSWN;varying float vSWet;varying vec3 vSCol;\nuniform float uWetY;\n"+
      sh.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
  vSObj=transformed;vSNo=objectNormal;vSCol=vec3(1.0);
  #ifdef USE_COLOR
  vSCol=color;
  #endif
  mat4 sM=modelMatrix;
  #ifdef USE_INSTANCING
  sM=modelMatrix*instanceMatrix;vSObj+=vec3(instanceMatrix[3][0],instanceMatrix[3][1],instanceMatrix[3][2])*1.37;
  #endif
  vSW=(sM*vec4(transformed,1.0)).xyz;vSWN=normalize(mat3(sM)*objectNormal);
  vSWet=${instWet?"aWetY":"uWetY"};`);
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\n"+STONE_HEAD)
      .replace("#include <map_fragment>",STONE_FRAG).replace("#include <color_fragment>","")
      .replace("#include <roughnessmap_fragment>","float roughnessFactor=sRough;")
      .replace("#include <normal_fragment_maps>","#include <normal_fragment_maps>\n  float sFoot=length(fwidth(vSW));normal=snPerturb(-vViewPosition,normal,vec2(dFdx(sH),dFdy(sH))*0.006*uSBump*(1.0-smoothstep(0.004,0.02,sFoot)),faceDirection);");};
  m.customProgramCacheKey=()=>"tsure_stone_"+(inst?1:0)+(instWet?1:0)+(o.vertexColors?1:0);
  m.userData.U=U;return m;}

/* rock geometry: indexed icosphere, displaced */
function icoSphere(detail){const t=(1+Math.sqrt(5))/2;let v=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(p=>{const l=Math.hypot(...p);return p.map(c=>c/l);});
  let f=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  for(let d=0;d<detail;d++){const cache=new Map(),nf=[];const mid=(a,b)=>{const k=a<b?a+"_"+b:b+"_"+a;if(cache.has(k))return cache.get(k);const p=v[a].map((c,i)=>(c+v[b][i])/2),l=Math.hypot(...p);v.push(p.map(c=>c/l));cache.set(k,v.length-1);return v.length-1;};
    f.forEach(([a,b,c])=>{const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);nf.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);});f=nf;}
  return {v,f};}
function rockGeometry(o){o=o||{};const seed=o.seed||1,rng=RNG(seed),det=o.detail!==undefined?o.detail:3;const {v,f}=icoSphere(det);
  const sx=o.sx||rng.r(0.9,1.25),sy=o.sy||rng.r(0.5,0.78),sz=o.sz||rng.r(0.8,1.1);const type=o.type||"angular";
  const planes=[];const np=type==="angular"?rng.i(5,8):0;for(let i=0;i<np;i++){const n=[rng.g(),rng.g()*0.6+0.25,rng.g()];const l=Math.hypot(...n);planes.push([n[0]/l,n[1]/l,n[2]/l,rng.r(0.62,0.85)]);}
  const pos=new Float32Array(v.length*3),col=new Float32Array(v.length*3);
  v.forEach((p,i)=>{let r=1+0.16*(fbm3(p[0]*1.6+seed,p[1]*1.6,p[2]*1.6,4,seed)-0.5)*2+0.05*(fbm3(p[0]*5,p[1]*5,p[2]*5,3,seed+5)-0.5)*2;
    let x=p[0]*r,y=p[1]*r,z=p[2]*r;
    for(const pl of planes){const dd=x*pl[0]+y*pl[1]+z*pl[2];if(dd>pl[3]){const k=dd-pl[3];const soft=k*0.82;x-=pl[0]*soft;y-=pl[1]*soft;z-=pl[2]*soft;}}
    if(type==="river"){const l=Math.hypot(x,y,z);const k=0.7;x=lerp(x,p[0]*l,k*0.3);y=lerp(y,p[1]*l,k*0.3);z=lerp(z,p[2]*l,k*0.3);}
    y=y<-0.35?-0.35+(y+0.35)*0.25:y;
    pos[i*3]=x*sx;pos[i*3+1]=y*sy;pos[i*3+2]=z*sz;
    const ao=clamp(0.55+0.45*(r-0.85)/0.3,0.45,1);col[i*3]=col[i*3+1]=col[i*3+2]=ao;});
  const g=new T.BufferGeometry();g.setAttribute("position",new T.BufferAttribute(pos,3));g.setAttribute("color",new T.BufferAttribute(col,3));
  const idx=[];f.forEach(t=>idx.push(t[0],t[1],t[2]));g.setIndex(idx);g.computeVertexNormals();
  g.translate(0,0.35*sy*0.75,0);g.computeBoundingSphere();return g;}

function makeRock(opts){opts=opts||{};const q=qlv(opts),res=Res();const size=opts.size||0.6,seed=opts.seed||1;
  const geo=res.own(rockGeometry({seed,detail:[2,3,4][q]-(size<0.3?1:0),type:opts.type||(opts.river?"river":"angular")}));geo.scale(size,size,size);
  const mat=res.own(stoneMaterial(res,{moss:opts.mossy?(typeof opts.mossy==="number"?opts.mossy:0.75):0,river:!!opts.river,vertexColors:true,tint:opts.tint,lichen:opts.lichen,wetY:opts.wetY,scale:1.4,dirtH:size*0.35}));
  const mesh=new T.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;const g=new T.Group();g.add(mesh);g.name="TSURE_rock";
  g.userData={dispose(){res.dispose();},setMoss(v){mat.userData.U.uMoss.value=v;},setWetLevel(y){mat.userData.U.uWetY.value=y;}};return g;}

function makeStonePile(opts){opts=opts||{};const q=qlv(opts),res=Res(),seed=opts.seed||3,rng=RNG(seed);const sc=opts.scale||1;
  const n=opts.count||rng.i(5,8);const geos=[];let y=0;
  // a ring of base stones, then a stack
  const nb=Math.max(2,Math.min(4,n-3));for(let i=0;i<nb;i++){const a=i/nb*TAU+rng.r(-0.3,0.3),r=rng.r(0.12,0.2)*sc,s=rng.r(0.13,0.19)*sc;
    const g=rockGeometry({seed:seed*7+i,detail:[1,2,2][q],type:"river",sy:rng.r(0.45,0.6)});g.scale(s,s,s);g.rotateY(rng.r(0,TAU));g.translate(Math.cos(a)*r,-0.02*sc,Math.sin(a)*r);geos.push(g);}
  y=0.07*sc;let s=0.2*sc;
  for(let i=0;i<n-nb;i++){const g=rockGeometry({seed:seed*13+i,detail:[1,2,2][q],type:"river",sy:rng.r(0.42,0.58),sx:rng.r(0.95,1.2),sz:rng.r(0.85,1.05)});
    g.scale(s,s,s);g.rotateY(rng.r(0,TAU));g.rotateX(rng.r(-0.12,0.12));g.rotateZ(rng.r(-0.12,0.12));g.translate(rng.r(-0.02,0.02)*sc,y,rng.r(-0.02,0.02)*sc);geos.push(g);
    y+=s*rng.r(0.42,0.55);s*=rng.r(0.72,0.86);}
  const geo=res.own(mergeGeos(geos));geos.forEach(g=>g.dispose());geo.computeBoundingSphere();
  const mat=res.own(stoneMaterial(res,{moss:opts.moss!==undefined?opts.moss:0.25,river:true,vertexColors:true,lichen:0.6,dirtH:0.1*sc,scale:2.2}));
  const mesh=new T.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;const grp=new T.Group();grp.add(mesh);grp.name="TSURE_stonePile";
  grp.userData={dispose(){res.dispose();}};return grp;}

/* =====================================================================
 * 5. GORINTOU (五輪塔)
 * ===================================================================== */
function roundedBox(w,h,d,r,seg){const g=new T.BoxGeometry(w,h,d,seg,seg,seg);const p=g.attributes.position;const iw=w/2-r,ih=h/2-r,id=d/2-r;const v=new T.Vector3(),c=new T.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);c.set(clamp(v.x,-iw,iw),clamp(v.y,-ih,ih),clamp(v.z,-id,id));const dlt=v.clone().sub(c);if(dlt.lengthSq()>1e-12){dlt.normalize().multiplyScalar(r);v.copy(c).add(dlt);}p.setXYZ(i,v.x,v.y,v.z);}
  // merge duplicated face vertices so normals are smooth
  const m=new Map(),idx=[],np=[];const ia=g.index.array;const remap=new Int32Array(p.count);
  for(let i=0;i<p.count;i++){const k=Math.round(p.getX(i)*1e4)+"_"+Math.round(p.getY(i)*1e4)+"_"+Math.round(p.getZ(i)*1e4);if(m.has(k))remap[i]=m.get(k);else{m.set(k,np.length/3);remap[i]=np.length/3;np.push(p.getX(i),p.getY(i),p.getZ(i));}}
  for(let i=0;i<ia.length;i++)idx.push(remap[ia[i]]);g.dispose();
  const o=new T.BufferGeometry();o.setAttribute("position",new T.Float32BufferAttribute(np,3));o.setIndex(idx);o.computeVertexNormals();return o;}
function latheY(profile,segs){// profile: [[r,y],...] bottom→top, returns indexed geometry with closed seam & smooth normals
  const n=profile.length,pos=[],idx=[];for(let i=0;i<n;i++)for(let j=0;j<segs;j++){const a=j/segs*TAU;pos.push(Math.cos(a)*profile[i][0],profile[i][1],Math.sin(a)*profile[i][0]);}
  for(let i=0;i<n-1;i++)for(let j=0;j<segs;j++){const a=i*segs+j,b=i*segs+(j+1)%segs,c=(i+1)*segs+j,d=(i+1)*segs+(j+1)%segs;idx.push(a,c,b,b,c,d);}
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;}
function roofGeo(W,H,eave,lift,topW,segs,curve){// 火輪: square roof with concave slopes and upturned corners
  const prof=[];// [s (fraction of half width), y, liftWeight, crease]
  prof.push([0,0,0]);prof.push([0.98,0,0]);prof.push([1.0,0.004,1]);prof.push([1.0,eave*0.5,1]);prof.push([0.99,eave,1]);
  const steps=10;for(let i=1;i<=steps;i++){const t=i/steps;const s=lerp(0.99,topW,1-Math.pow(1-t,curve));const y=lerp(eave,H,t);prof.push([s,y,Math.pow(1-t,2.2)]);}
  prof.push([topW*0.6,H,0]);prof.push([0,H,0]);
  const pos=[],idx=[],n=prof.length;
  for(let i=0;i<n;i++)for(let j=0;j<segs;j++){const a=j/segs*TAU;const ca=Math.cos(a),sa=Math.sin(a);const sq=1/Math.pow(Math.pow(Math.abs(ca),8)+Math.pow(Math.abs(sa),8),1/8);
    const corner=Math.pow(Math.abs(Math.sin(2*a)),6);const r=prof[i][0]*W*0.5*sq;pos.push(ca*r,prof[i][1]+lift*corner*prof[i][2],sa*r);}
  for(let i=0;i<n-1;i++)for(let j=0;j<segs;j++){const a=i*segs+j,b=i*segs+(j+1)%segs,c=(i+1)*segs+j,d=(i+1)*segs+(j+1)%segs;idx.push(a,c,b,b,c,d);}
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;}
function aoColor(g,y0,y1,k){const p=g.attributes.position,c=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const y=p.getY(i);const t=Math.min(Math.abs(y-y0),Math.abs(y-y1));const a=1-k*Math.exp(-t*40);c[i*3]=c[i*3+1]=c[i*3+2]=a;}g.setAttribute("color",new T.BufferAttribute(c,3));return g;}
function makeGorintou(opts){opts=opts||{};const q=qlv(opts),res=Res(),H=opts.height||0.9,seed=opts.seed||1,rng=RNG(seed),moss=opts.moss!==undefined?opts.moss:0.4;
  const segs=[16,24,36][q],geos=[];let y=0;const jitter=()=>rng.r(-0.012,0.012)*H;
  // 地輪
  const w0=0.44*H,h0=0.24*H;{const g=roundedBox(w0,h0,w0*rng.r(0.97,1.02),0.022*H,[2,3,4][q]);g.translate(0,h0/2,0);aoColor(g,0,h0,0.35);geos.push(g);}y=h0;
  // 水輪
  const d1=0.41*H,h1=0.235*H;{const pr=[];const n=[8,12,16][q];pr.push([0,0]);for(let i=0;i<=n;i++){const t=i/n;const r=d1*0.5*Math.pow(Math.sin(Math.PI*(0.06+0.88*t)),0.85)*(1-0.06*t);pr.push([Math.max(r,d1*0.16),t*h1]);}pr.push([0,h1]);
    const g=latheY(pr,segs);g.rotateY(rng.r(0,TAU));g.translate(jitter(),y,jitter());aoColor(g,y,y+h1,0.4);geos.push(g);}y+=h1;
  // 火輪
  const w2=0.45*H,h2=0.205*H;{const g=roofGeo(w2,h2,0.075*H,0.022*H,0.26,[16,32,48][q],1.7);g.rotateY(rng.r(-0.06,0.06));g.translate(jitter(),y,jitter());aoColor(g,y,y+h2,0.35);geos.push(g);}y+=h2;
  // 風輪 (bowl) + 空輪 (jewel) carved as one stone
  const d3=0.235*H,h3=0.1*H,d4=0.22*H,h4=0.2*H;{const pr=[[0,0]];const n=[6,9,12][q];
    for(let i=0;i<=n;i++){const t=i/n;pr.push([Math.max(d3*0.5*Math.sqrt(Math.max(0,1-Math.pow(1-t,2))),d3*0.18),t*h3]);}
    pr.push([d4*0.24,h3+0.005*H]);
    for(let i=1;i<=n+4;i++){const t=i/(n+4);let r=d4*0.5*Math.pow(Math.sin(Math.PI*Math.min(1,0.18+t*0.9)),0.9);if(t>0.7){r*=1-Math.pow((t-0.7)/0.3,1.6)*0.82;}pr.push([Math.max(r,0.002),h3+0.005*H+t*h4]);}
    pr.push([0,h3+h4+0.012*H]);
    const g=latheY(pr,segs);g.translate(jitter(),y,jitter());aoColor(g,y,y+h3,0.4);geos.push(g);}
  const geo=res.own(mergeGeos(geos));geos.forEach(g=>g.dispose());
  // weathered lean
  const lean=(opts.lean!==undefined?opts.lean:rng.r(0,0.05));geo.rotateZ(lean*(rng.f()<0.5?-1:1));geo.rotateX(rng.r(-0.02,0.02));geo.computeBoundingSphere();
  const mat=res.own(stoneMaterial(res,{moss,lichen:opts.lichen!==undefined?opts.lichen:0.7,vertexColors:true,tint:opts.tint||0xf4f2ee,scale:2.4/H*0.9,dirtH:0.18*H,mossColor:opts.mossColor||0x4a5626}));
  const mesh=new T.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;
  const grp=new T.Group();grp.add(mesh);grp.name="TSURE_gorintou";
  if(opts.base!==false){const bg=res.own(roundedBox(w0*1.35,0.06*H,w0*1.35,0.012*H,2));bg.translate(0,0.0,0);const bmat=mat;const bm=new T.Mesh(bg,bmat);bm.position.y=-0.01*H;bm.castShadow=true;bm.receiveShadow=true;grp.add(bm);mesh.position.y=0.02*H;}
  grp.userData={dispose(){res.dispose();},setMoss(v){mat.userData.U.uMoss.value=v;}};return grp;}

/* =====================================================================
 * 6. SOTOBA (板塔婆)
 * ===================================================================== */
function sotobaOutline(w,H){const hw=w/2,n=0.17*w,pts=[];
  // right side top→bottom, then mirrored; y measured from the ground (plank bottom at y=-0.12H buried)
  const R=[];let y=H;
  const tipH=0.95*w;for(let i=0;i<=8;i++){const t=i/8;const x=hw*Math.pow(Math.sin(t*Math.PI/2),0.75);R.push([x,y-tipH*Math.pow(t,1.15)]);}
  y-=tipH;
  const notch=(yy)=>{R.push([hw,yy]);R.push([hw-n,yy-0.055*w]);R.push([hw,yy-0.11*w]);return yy-0.11*w;};
  y-=0.04*w;R.push([hw,y]);y=notch(y);y-=0.42*w;y=notch(y);y-=0.52*w;y=notch(y);y-=0.6*w;y=notch(y);
  R.push([hw,-0.12*H]);
  const L=R.slice().reverse().map(p=>[-p[0],p[1]]);
  R.forEach(p=>pts.push(p));L.forEach(p=>{if(p[0]!==0)pts.push(p);});return pts;}
function brushStroke(g,pts,w0,w1,col){// variable-width stroke along a polyline
  g.fillStyle=col;for(let i=0;i<pts.length-1;i++){const t=i/(pts.length-1),w=lerp(w0,w1,t);const [x0,y0]=pts[i],[x1,y1]=pts[i+1];const steps=6;
    for(let s=0;s<steps;s++){const u=s/steps;g.beginPath();g.arc(lerp(x0,x1,u),lerp(y0,y1,u),Math.max(0.3,w*(1-0.15*u)),0,TAU);g.fill();}}}
function bonji(g,cx,cy,s,k,col){// stylised Siddham-like glyphs (five elements: kha / ha / ra / va / a)
  const P=(a)=>a.map(p=>[cx+p[0]*s,cy+p[1]*s]);
  const glyphs=[
    [[[-0.45,-0.55],[0.35,-0.6]],[[0.0,-0.55],[0.05,-0.1],[-0.25,0.15],[-0.3,0.45]],[[0.05,-0.1],[0.35,0.1],[0.3,0.5],[0.1,0.6]]],
    [[[-0.4,-0.55],[0.4,-0.58]],[[-0.1,-0.55],[-0.3,-0.1],[0.1,0.05],[0.3,0.35],[0.0,0.6]],[[0.25,-0.3],[0.45,-0.05]]],
    [[[-0.4,-0.55],[0.4,-0.55]],[[0.0,-0.55],[0.0,0.3],[-0.25,0.55]],[[0.0,-0.05],[0.35,0.15]]],
    [[[-0.42,-0.55],[0.42,-0.58]],[[0.05,-0.55],[-0.35,-0.05],[0.0,0.25],[0.35,-0.05],[0.05,-0.55]],[[0.0,0.25],[0.0,0.62]]],
    [[[-0.45,-0.55],[0.4,-0.58]],[[-0.3,-0.55],[-0.4,0.0],[-0.1,0.2],[0.15,0.0]],[[0.3,-0.58],[0.3,0.6]],[[-0.1,0.2],[0.0,0.55]]]];
  glyphs[k%5].forEach((st,i)=>brushStroke(g,P(st),s*(i===0?0.085:0.11),s*0.05,col));}
function makeSotobaTex(variant,age,W,H){const cv=mkCanvas(W,H),g=cv.getContext("2d"),rng=RNG(900+variant*31+Math.round(age*10));
  const im=g.createImageData(W,H);const tone=lerp(0,1,age);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=x/W,v=y/H,i=(y*W+x)*4;
    const gx=u*W+3.0*Math.sin(v*14+variant)+2*pfbm2(u*2,v*6,64,2,variant+5);const grain=0.5+0.5*Math.sin(gx*1.9+pfbm2(u*3,v*20,64,3,variant+9)*4);
    const n=pfbm2(u*4,v*16,32,4,variant+13);
    const fresh=[218-grain*26+n*20,192-grain*26+n*16,150-grain*22+n*12];
    const streak=pfbm2(u*14,v*2.5,64,3,variant+21);
    const old=[132-grain*20+n*26-streak*30,126-grain*18+n*24-streak*28,116-grain*16+n*20-streak*24];
    let c=fresh.map((f,k)=>lerp(f,old[k],tone));
    const bottom=smooth(0.22,0.0,v);const dirt=bottom*(0.5+0.5*age);c=[c[0]*(1-dirt*0.45),c[1]*(1-dirt*0.5),c[2]*(1-dirt*0.55)];
    const mold=ih2(x,y,variant+7)>0.985-0.03*age*smooth(0.4,0,v)?0.6:1;c=c.map(z=>z*mold);
    im.data[i]=clamp(c[0],0,255);im.data[i+1]=clamp(c[1],0,255);im.data[i+2]=clamp(c[2],0,255);im.data[i+3]=255;}
  g.putImageData(im,0,0);
  // ink
  const inkA=lerp(0.92,0.22,age);const ink="rgba(18,15,12,"+inkA.toFixed(3)+")";
  const w=W,ringC=[0.05,0.125,0.19,0.26,0.345];// v-centres of the five rings (from top), roughly
  const tipH=0.95*w,secs=[tipH*0.55,tipH+0.04*w+0.11*w+0.21*w,tipH+0.04*w+0.22*w+0.42*w+0.26*w,tipH+0.04*w+0.33*w+0.94*w+0.3*w,tipH+0.04*w+0.44*w+1.54*w+0.34*w];
  const pxPerM=H/1.0;// texture spans plank height (normalised later)
  g.save();
  secs.forEach((yy,k)=>bonji(g,W/2,yy,W*0.28,k,ink));
  // main inscription (vertical)
  const startY=tipH+0.04*w+0.44*w+1.54*w+0.75*w;const chars=["南","無","阿","弥","陀","仏"];const fs=Math.floor(W*0.5);
  g.font=fs+"px 'Yu Mincho','YuMincho','Hiragino Mincho ProN','Noto Serif CJK JP','Noto Serif JP','MS Mincho','IPAMincho','IPAexMincho',serif";g.textAlign="center";g.textBaseline="middle";g.fillStyle=ink;
  chars.forEach((ch,i)=>{g.fillText(ch,W/2+rng.r(-0.6,0.6),startY+i*fs*1.12);});
  g.restore();
  // weathering: erode the ink & add cracks, lichen
  const id=g.getImageData(0,0,W,H),dd=id.data;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;const n=pfbm2(x/W*6,y/H*40,64,3,variant+33);
    if(n>0.18-age*0.35){const k=smooth(0.18-age*0.35,0.45-age*0.35,n)*0.85;const base=[lerp(218,132,tone),lerp(192,126,tone),lerp(150,116,tone)];dd[i]=lerp(dd[i],base[0]*0.95,k*smooth(60,10,dd[i]));dd[i+1]=lerp(dd[i+1],base[1]*0.95,k*smooth(60,10,dd[i+1]));dd[i+2]=lerp(dd[i+2],base[2]*0.95,k*smooth(60,10,dd[i+2]));}}
  g.putImageData(id,0,0);
  const ncr=Math.round(1+age*5);g.lineCap="round";
  for(let k=0;k<ncr;k++){let x=rng.r(W*0.15,W*0.85),y=rng.r(H*0.0,H*0.5);const len=rng.r(0.15,0.55)*H*(0.4+age);g.strokeStyle="rgba(28,22,18,"+(0.35+age*0.4).toFixed(2)+")";g.lineWidth=rng.r(0.6,1.6)*W/128;g.beginPath();g.moveTo(x,y);
    for(let s=0;s<20;s++){x+=rng.r(-1,1)*W*0.012;y+=len/20;g.lineTo(x,y);}g.stroke();}
  const nl=Math.round(age*14);for(let k=0;k<nl;k++){const x=rng.r(0,W),y=rng.r(H*0.3,H*0.95),r=rng.r(1.5,5)*W/128;g.fillStyle="rgba("+Math.floor(rng.r(150,185))+","+Math.floor(rng.r(160,190))+","+Math.floor(rng.r(130,160))+",0.55)";g.beginPath();g.arc(x,y,r,0,TAU);g.fill();}
  const t=new T.CanvasTexture(cv);t.encoding=T.sRGBEncoding;t.anisotropy=4;return t;}
function makeSotoba(opts){opts=opts||{};const q=qlv(opts),res=Res(),Hh=opts.height||1.6,seed=opts.seed||1,rng=RNG(seed);const age=clamp(opts.age!==undefined?opts.age:0.5,0,1);
  const w=Hh*0.085,th=w*0.09;const pts=sotobaOutline(w,Hh);
  const shape=new T.Shape();pts.forEach((p,i)=>i?shape.lineTo(p[0],p[1]):shape.moveTo(p[0],p[1]));shape.closePath();
  const geo=res.own(new T.ExtrudeGeometry(shape,{depth:th,bevelEnabled:true,bevelThickness:th*0.18,bevelSize:th*0.18,bevelSegments:1,curveSegments:4,steps:1}));
  geo.translate(0,0,-th/2);
  // UV remap: u across width, v along height (texture covers [-0.12H .. H])
  const p=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<p.count;i++){uv.setXY(i,(p.getX(i)+w/2)/w,(p.getY(i)+0.12*Hh)/(1.12*Hh));}
  geo.computeVertexNormals();
  const variant=seed%4,ab=Math.round(age*3)/3;const TW=[64,96,128][q],TH=TW*8;
  const key="sotoba_"+variant+"_"+ab+"_"+TW;
  const tex=res.sh(key,()=>makeSotobaTexFull(variant,ab,TW,TH,w,Hh));
  const mat=res.own(new T.MeshStandardMaterial({map:tex,roughness:0.92,metalness:0,bumpMap:tex,bumpScale:0.0012*(0.4+age)}));
  const mesh=new T.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;
  const grp=new T.Group();grp.add(mesh);grp.name="TSURE_sotoba";
  const lean=(opts.lean!==undefined?opts.lean:(rng.f()<0.35+age*0.4?rng.r(0.02,0.07+age*0.1):rng.r(0,0.02)));
  mesh.rotation.z=lean*(rng.f()<0.5?-1:1);mesh.rotation.x=rng.r(-0.03,0.03)*(0.3+age);mesh.rotation.y=rng.r(-0.15,0.15);
  grp.userData={dispose(){res.dispose();},age};return grp;}
function makeSotobaTexFull(variant,age,TW,TH,w,Hh){// map the texture so ring positions match geometry (texture v covers [-0.12H..H])
  const cv=mkCanvas(TW,TH),g=cv.getContext("2d");const src=makeSotobaTex(variant,age,TW,Math.round(TW*(1.12*Hh)/w));
  // src canvas is in plank-width units (1 width = TW px); stretch to TH height
  g.drawImage(src.image,0,0,TW,TH);src.dispose();const t=new T.CanvasTexture(cv);t.encoding=T.sRGBEncoding;t.anisotropy=4;return t;}

/* =====================================================================
 * 7. STREAM (遣水 / mountain stream)
 * ===================================================================== */
const STREAM_VS=`
attribute vec3 aTan;attribute float aDepth;attribute float aFoam;attribute float aEdge;
varying vec3 vW;varying vec2 vUv2;varying vec3 vTan;varying float vDepth;varying float vFoam;varying float vEdge;
#include <fog_pars_vertex>
void main(){vec4 wp=modelMatrix*vec4(position,1.0);vW=wp.xyz;vUv2=uv;vTan=normalize(mat3(modelMatrix)*aTan);vDepth=aDepth;vFoam=aFoam;vEdge=aEdge;
  vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`;
const STREAM_FS=`
uniform sampler2D tNormal;uniform sampler2D tNoise;uniform float uTime;uniform float uSpeed;
uniform vec3 uZenith;uniform vec3 uHorizon;uniform vec3 uSunDir;uniform vec3 uSunCol;uniform float uSunInt;
uniform vec3 uBank;uniform float uBankAmt;uniform float uWidth;uniform vec3 uShallow;uniform vec3 uDeep;uniform float uClarity;uniform float uFogScale;uniform float uRippleAmt;
varying vec3 vW;varying vec2 vUv2;varying vec3 vTan;varying float vDepth;varying float vFoam;varying float vEdge;
#include <fog_pars_fragment>
${GL_HASH}
vec3 flowN(vec2 uv,float spd,float sc,float P,float ph){
  float t0=fract(uTime/P+ph),t1=fract(uTime/P+ph+0.5);float w0=1.0-abs(2.0*t0-1.0);
  vec3 a=texture2D(tNormal,(uv-vec2(0.0,spd*t0*P))*sc).xyz*2.0-1.0;
  vec3 b=texture2D(tNormal,(uv-vec2(0.0,spd*t1*P))*sc+vec2(0.37,0.61)).xyz*2.0-1.0;
  return a*w0+b*(1.0-w0);}
void main(){
  vec3 V=normalize(cameraPosition-vW);
  vec3 Tn=normalize(vec3(vTan.x,0.0,vTan.z)+vec3(1e-5,0.0,0.0));vec3 Bn=vec3(-Tn.z,0.0,Tn.x);
  float spd=uSpeed*(0.3+0.7*vDepth)*(1.0+vFoam*0.6);
  vec2 uv=vec2(vUv2.x,vUv2.y);
  vec3 n1=flowN(uv,spd,0.55,2.6,0.0);vec3 n2=flowN(uv*vec2(1.0,0.7),spd*1.3,1.6,1.7,0.25);
  float amp=(0.30+vFoam*0.8)*uRippleAmt;
  vec2 dn=(n1.xy*0.65+n2.xy*0.45)*amp;
  vec3 N=normalize(vec3(0.0,1.0,0.0)+Bn*dn.x+Tn*dn.y);
  vec3 R=reflect(-V,N);R.y=abs(R.y);
  float ry=clamp(R.y,0.0,1.0);
  vec3 sky=mix(uHorizon,uZenith,pow(ry,0.55));
  /* reflections of the banks/vegetation: low reflected rays, stronger near the banks */
  float bankSide=smoothstep(0.35,0.95,abs(vUv2.x)/max(0.5*uWidth,0.1));
  float bank=clamp(smoothstep(0.30,0.03,ry)*uBankAmt+bankSide*0.35*uBankAmt,0.0,1.0);
  vec3 refl=mix(sky,uBank,bank);
  float sp=max(dot(R,normalize(uSunDir)),0.0);
  float vdist=length(cameraPosition-vW);float gl=smoothstep(4.0,45.0,vdist);
  float shin=mix(800.0,55.0,gl);
  float spark=smoothstep(0.80,0.97,texture2D(tNoise,vec2(uv.x*2.3,(uv.y-uTime*spd*1.2)*0.9)*1.7).g);
  vec3 glint=uSunCol*uSunInt*(pow(sp,shin)*(2.0+shin*0.045)*(0.35+2.2*spark)+pow(sp,18.0)*0.08)*smoothstep(-0.02,0.04,uSunDir.y)*(1.0-bank*0.7);
  float cv=max(dot(N,V),0.0);
  float F=0.02+0.98*pow(1.0-cv,5.0);
  vec3 body=mix(uShallow,uDeep,smoothstep(0.0,1.0,vDepth));
  float trans=mix(uClarity,uClarity*0.35,vDepth);
  /* foam: streaks along the flow, only where it is choppy */
  vec2 fuv=vec2(vUv2.x*2.4,(vUv2.y-uTime*uSpeed*0.9)*0.38);
  float fn=texture2D(tNoise,fuv*0.5).a*0.55+texture2D(tNoise,fuv*1.4+0.3).r*0.45;
  float foam=smoothstep(0.74-vFoam*0.2,0.96-vFoam*0.12,fn)*smoothstep(0.3,0.7,vFoam);
  vec3 foamC=(uZenith*0.3+uHorizon*0.4+uSunCol*uSunInt*0.35*max(uSunDir.y+0.1,0.0))*0.8;
  vec3 prem=body*(1.0-trans)*(1.0-F)+refl*F+glint;
  float a=1.0-trans*(1.0-F);
  prem=mix(prem,foamC,foam*0.7);a=mix(a,1.0,foam*0.7);
  a*=vEdge;
  gl_FragColor=vec4(prem/max(a,0.02)*vEdge,a);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
  ${GL_FOG_SCALED}
}`;
function makePebbleTex(N){const cv=mkCanvas(N,N),g=cv.getContext("2d"),rng=RNG(606),sc=N/512;
  const im=g.createImageData(N,N);for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x/N,v=y/N,i=(y*N+x)*4;const n=pfbm2(u*8,v*8,8,4,611);
    im.data[i]=86+n*34;im.data[i+1]=78+n*30;im.data[i+2]=64+n*24;im.data[i+3]=255;}g.putImageData(im,0,0);
  const cnt=Math.round(N*N/240);
  for(let k=0;k<cnt;k++){const x=rng.r(0,N),y=rng.r(0,N),r=rng.r(3,13)*sc*(rng.f()<0.1?1.6:1),e=rng.r(0.55,0.95),rot=rng.r(0,TAU);
    const hue=rng.f();const t=rng.r(0.65,1.2);let base;if(hue<0.45)base=[118,114,106];else if(hue<0.7)base=[104,94,80];else if(hue<0.85)base=[84,88,92];else base=[134,118,92];base=base.map(v=>clamp(v*t,0,235));
    for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++){const px=x+ox*N,py=y+oy*N;if(px<-30||px>N+30||py<-30||py>N+30)continue;
      g.save();g.translate(px,py);g.rotate(rot);g.scale(1,e);
      g.fillStyle="rgba(24,20,16,0.5)";g.beginPath();g.arc(r*0.12,r*0.2,r*1.08,0,TAU);g.fill();
      const gr=g.createRadialGradient(-r*0.3,-r*0.35,r*0.05,0,0,r);gr.addColorStop(0,"rgb("+Math.min(255,base[0]+40)+","+Math.min(255,base[1]+38)+","+Math.min(255,base[2]+34)+")");
      gr.addColorStop(0.7,"rgb("+base[0]+","+base[1]+","+base[2]+")");gr.addColorStop(1,"rgb("+(base[0]-40)+","+(base[1]-38)+","+(base[2]-34)+")");
      g.fillStyle=gr;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();g.restore();}}
  const t=new T.CanvasTexture(cv);t.wrapS=t.wrapT=T.RepeatWrapping;t.encoding=T.sRGBEncoding;t.anisotropy=8;return t;}
function makeStream(opts){opts=opts||{};const q=qlv(opts),res=Res(),seed=opts.seed||7,rng=RNG(seed);
  const pts=(opts.points||[[-12,0,0],[-4,0,1.5],[4,0,-1],[12,0,0.5]]).map(p=>new T.Vector3(p[0],p[1],p[2]));
  const width=opts.width||1.6,depth=opts.depth!==undefined?opts.depth:0.35,heightAt=opts.heightAt||null;
  const curve=new T.CatmullRomCurve3(pts,false,"centripetal");const L=curve.getLength();
  const step=[0.6,0.35,0.22][q],nS=Math.max(8,Math.ceil(L/step)),nA=[8,12,16][q];
  const wv=s=>width*(1+0.22*(fbm1(s*0.12,3,seed)-0.5)*2);
  const fr=[];for(let i=0;i<=nS;i++){const u=i/nS,c=curve.getPointAt(u),t=curve.getTangentAt(u);t.y=0;t.normalize();fr.push({c,t,s:new T.Vector3(t.z,0,-t.x),arc:u*L,w:wv(u*L)});}
  // in-stream rocks (decide first; they drive foam)
  const inRocks=[];const nIn=Math.max(1,Math.round(L/(opts.rockSpacing||3.2)*(opts.rocks===false?0:1)));
  for(let k=0;k<nIn;k++){const i=Math.floor(rng.r(0.05,0.95)*nS),f=fr[i];const a=rng.r(-0.55,0.55);const s=rng.r(0.12,0.32)*(width/1.6);
    inRocks.push({p:f.c.clone().addScaledVector(f.s,a*f.w*0.5),arc:f.arc,a,s,wy:f.c.y});}
  // water ribbon
  const ext=1.18,wpos=[],wuv=[],wtan=[],wdep=[],wfoam=[],wedge=[],idx=[];
  for(let i=0;i<=nS;i++){const f=fr[i];const narrow=smooth(1.0,0.78,f.w/width);
    for(let j=0;j<=nA;j++){const a=(j/nA*2-1)*ext;const p=f.c.clone().addScaledVector(f.s,a*f.w*0.5);wpos.push(p.x,f.c.y,p.z);
      wuv.push(a*f.w*0.5,f.arc);wtan.push(f.t.x,0,f.t.z);const rel=Math.abs(a);wdep.push(Math.pow(clamp(1-rel*rel,0,1),0.7));
      let foam=narrow*0.3*clamp(1-rel*rel,0,1);
      for(const r of inRocks){const ds=f.arc-r.arc,dx=p.x-r.p.x,dz=p.z-r.p.z,d=Math.hypot(dx,dz);const lat=Math.abs((a-r.a)*f.w*0.5);
        const trail=ds>0?Math.exp(-ds/(1.4+r.s*4))*Math.exp(-lat/(r.s*1.2+0.08)):0;foam=Math.max(foam,Math.exp(-Math.max(0,d-r.s*0.9)/0.12)*0.9,trail*0.8);}
      wfoam.push(clamp(foam,0,1));const endF=opts.fadeEnds===false?1:smooth(0,Math.min(3,L*0.08),f.arc)*smooth(L,L-Math.min(3,L*0.08),f.arc);wedge.push(smooth(ext,ext*0.86,rel)*endF);}}
  for(let i=0;i<nS;i++)for(let j=0;j<nA;j++){const a=i*(nA+1)+j,b=a+1,c=a+nA+1,d=c+1;idx.push(a,c,b,b,c,d);}
  const wg=res.own(new T.BufferGeometry());wg.setAttribute("position",new T.Float32BufferAttribute(wpos,3));wg.setAttribute("uv",new T.Float32BufferAttribute(wuv,2));
  wg.setAttribute("aTan",new T.Float32BufferAttribute(wtan,3));wg.setAttribute("aDepth",new T.Float32BufferAttribute(wdep,1));wg.setAttribute("aFoam",new T.Float32BufferAttribute(wfoam,1));
  wg.setAttribute("aEdge",new T.Float32BufferAttribute(wedge,1));wg.setIndex(idx);wg.computeVertexNormals();wg.computeBoundingSphere();
  const U=Object.assign(T.UniformsUtils.clone(T.UniformsLib.fog),{tNormal:{value:res.sh("waternormal",makeWaterNormal)},tNoise:{value:noiseTex(res)},uTime:{value:0},uSpeed:{value:opts.speed||0.55},
    uZenith:{value:new T.Color(0.1,0.22,0.5)},uHorizon:{value:new T.Color(0.6,0.75,0.9)},uSunDir:{value:new T.Vector3(0.3,0.7,0.4).normalize()},uSunCol:{value:new T.Color(1,0.95,0.85)},uSunInt:{value:1.2},
    uBank:{value:C(opts.bankColor,[0.05,0.07,0.04])},uBankAmt:{value:opts.bankReflect!==undefined?opts.bankReflect:0.75},uWidth:{value:width},uShallow:{value:C(opts.shallowColor,[0.12,0.16,0.11])},uDeep:{value:C(opts.deepColor,[0.025,0.06,0.055])},
    uClarity:{value:opts.clarity!==undefined?opts.clarity:0.78},uFogScale:{value:1},uRippleAmt:{value:1}});
  const wm=res.own(new T.ShaderMaterial({uniforms:U,vertexShader:STREAM_VS,fragmentShader:STREAM_FS,transparent:true,depthWrite:false,fog:true}));wm.extensions={derivatives:true};
  const water=new T.Mesh(wg,wm);water.renderOrder=2;water.name="TSURE_streamWater";water.receiveShadow=false;water.castShadow=false;
  // bed ribbon (pebbles, wet bank), draped on heightAt if given
  const bext=1.22,bpos=[],buv=[],balpha=[],bwet=[],bidx=[];
  for(let i=0;i<=nS;i++){const f=fr[i];for(let j=0;j<=nA+4;j++){const a=(j/(nA+4)*2-1)*bext;const p=f.c.clone().addScaledVector(f.s,a*f.w*0.5);const rel=Math.abs(a);
      let y=f.c.y-depth*Math.pow(clamp(1-rel*rel,0,1),0.7)-0.02+(rel>1?(rel-1)*f.w*0.5*0.35:0);if(heightAt)y=heightAt(p.x,p.z)+0.012;
      bpos.push(p.x,y,p.z);buv.push(a*f.w*0.5*0.9,f.arc*0.9);balpha.push(smooth(bext,0.92,rel)*(opts.fadeEnds===false?1:smooth(0,Math.min(3,L*0.08),f.arc)*smooth(L,L-Math.min(3,L*0.08),f.arc)));bwet.push(f.c.y);}}
  const nb=nA+4;for(let i=0;i<nS;i++)for(let j=0;j<nb;j++){const a=i*(nb+1)+j,b=a+1,c=a+nb+1,d=c+1;bidx.push(a,c,b,b,c,d);}
  const bg=res.own(new T.BufferGeometry());bg.setAttribute("position",new T.Float32BufferAttribute(bpos,3));bg.setAttribute("uv",new T.Float32BufferAttribute(buv,2));
  bg.setAttribute("aAlpha",new T.Float32BufferAttribute(balpha,1));bg.setAttribute("aWater",new T.Float32BufferAttribute(bwet,1));bg.setIndex(bidx);bg.computeVertexNormals();bg.computeBoundingSphere();
  const pebN=[256,512,512][q];const peb=res.sh("pebble"+pebN,()=>makePebbleTex(pebN));
  const BU={tCaus:{value:res.sh("caustic",makeCaustic)},uTime:U.uTime,uCaus:{value:0.6},uSunCol:U.uSunCol,uSpeed:U.uSpeed};
  const bm=res.own(new T.MeshStandardMaterial({map:peb,roughness:0.85,metalness:0,transparent:true,depthWrite:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));
  bm.onBeforeCompile=sh=>{Object.assign(sh.uniforms,BU);
    sh.vertexShader="attribute float aAlpha;attribute float aWater;varying float vAlpha;varying float vWaterY;varying vec3 vBW;\n"+sh.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvAlpha=aAlpha;vWaterY=aWater;vBW=(modelMatrix*vec4(transformed,1.0)).xyz;");
    sh.fragmentShader="uniform sampler2D tCaus;uniform float uTime;uniform float uCaus;uniform vec3 uSunCol;uniform float uSpeed;varying float vAlpha;varying float vWaterY;varying vec3 vBW;\n"+
      sh.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
  float uw=smoothstep(0.0,0.05,vWaterY-vBW.y);float wetB=1.0-smoothstep(vWaterY+0.0,vWaterY+0.07,vBW.y);
  float dep=clamp((vWaterY-vBW.y)/0.35,0.0,1.0);diffuseColor.rgb*=mix(1.0,0.58,wetB);diffuseColor.rgb*=mix(vec3(1.0),vec3(0.62,0.74,0.66),uw)*mix(1.0,0.5,dep);diffuseColor.a*=vAlpha;`)
      .replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
  vec2 cuv=vBW.xz*0.55;float c1=texture2D(tCaus,cuv+vec2(uTime*0.03,uTime*0.05)).r;float c2=texture2D(tCaus,cuv*1.31-vec2(uTime*0.04,-uTime*0.02)).g;
  totalEmissiveRadiance+=diffuseColor.rgb*uSunCol*min(c1,c2)*uCaus*1.6*uw*(1.0-dep*0.5);`)
      .replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\n  roughnessFactor=mix(roughnessFactor,0.35,wetB);");};
  bm.customProgramCacheKey=()=>"tsure_bed";
  const bed=new T.Mesh(bg,bm);bed.renderOrder=1;bed.receiveShadow=true;bed.castShadow=false;bed.name="TSURE_streamBed";
  // rocks (instanced, 4 variants)
  const grp=new T.Group();grp.name="TSURE_stream";grp.add(bed);grp.add(water);
  const rockSet=[];
  if(opts.rocks!==false){const bankStep=opts.bankRockSpacing||0.9;
    const all=inRocks.map(r=>({p:r.p,s:r.s,wy:r.wy,sub:0.45}));
    for(let i=0;i<nS;i++){const f=fr[i];if(rng.f()>step/bankStep)continue;const side=rng.f()<0.5?-1:1;const off=f.w*0.5*side*rng.r(0.92,1.25);
      const p=f.c.clone().addScaledVector(f.s,off);const s=rng.r(0.1,0.42)*(rng.f()<0.15?1.6:1);all.push({p,s,wy:f.c.y,sub:rng.r(0.2,0.45),bank:true});}
    const variants=4;const geos=[];for(let v=0;v<variants;v++)geos.push(res.own(rockGeometry({seed:seed*31+v,detail:[1,2,3][q],type:v%2?"river":"angular"})));
    const rm=res.own(stoneMaterial(res,{river:true,moss:opts.moss!==undefined?opts.moss:0.55,instanced:true,instWet:true,vertexColors:true,scale:1.3,lichen:0.25,dirtH:0.02}));
    const buckets=[[],[],[],[]];all.forEach((r,i)=>buckets[i%variants].push(r));
    const m4=new T.Matrix4(),qq=new T.Quaternion(),e=new T.Euler(),sc=new T.Vector3();
    buckets.forEach((b,v)=>{if(!b.length)return;const im=new T.InstancedMesh(geos[v],rm,b.length);const wa=new Float32Array(b.length);
      b.forEach((r,k)=>{e.set(rng.r(-0.15,0.15),rng.r(0,TAU),rng.r(-0.15,0.15));qq.setFromEuler(e);sc.set(r.s*rng.r(0.9,1.3),r.s*rng.r(0.8,1.1),r.s*rng.r(0.9,1.2));
        let y=r.wy-r.s*r.sub;if(r.bank&&heightAt)y=Math.min(heightAt(r.p.x,r.p.z)-r.s*0.18,y+r.s*0.25);
        m4.compose(new T.Vector3(r.p.x,y,r.p.z),qq,sc);im.setMatrixAt(k,m4);wa[k]=r.wy;});
      geos[v].setAttribute("aWetY",new T.InstancedBufferAttribute(wa,1));
      im.castShadow=true;im.receiveShadow=true;im.instanceMatrix.needsUpdate=true;grp.add(im);rockSet.push(im);});}
  let tAcc=0;
  grp.userData={curve,length:L,water,bed,rocks:rockSet,uniforms:U,
    update(dt,t){tAcc=(typeof t==="number")?t:tAcc+(dt||0);U.uTime.value=tAcc;},
    setSky(s){if(!s)return;if(s.zenith!==undefined)setC(U.uZenith.value,s.zenith);if(s.horizon!==undefined)setC(U.uHorizon.value,s.horizon);
      if(s.sunDir){setV(U.uSunDir.value,s.sunDir);U.uSunDir.value.normalize();}if(s.sunColor!==undefined)setC(U.uSunCol.value,s.sunColor);
      if(typeof s.sunIntensity==="number")U.uSunInt.value=s.sunIntensity;if(s.bank!==undefined)setC(U.uBank.value,s.bank);
      const el=U.uSunDir.value.y;BU.uCaus.value=clamp(el*1.4,0,0.9)*Math.min(1.2,U.uSunInt.value);},
    setFlow(v){U.uSpeed.value=v;},setFogScale(v){U.uFogScale.value=v;},
    dispose(){res.dispose();}};
  grp.userData.setSky({});
  return grp;}

/* =====================================================================
 * 8. MIRROR WATER (planar reflection)
 * ===================================================================== */
const MIRROR_VS=`
uniform mat4 uTexMat;varying vec4 vProj;varying vec3 vW;varying vec2 vUv;
#include <fog_pars_vertex>
void main(){vUv=uv;vec4 wp=modelMatrix*vec4(position,1.0);vW=wp.xyz;vProj=uTexMat*vec4(position,1.0);vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`;
const MIRROR_FS=`
uniform sampler2D tRefl;uniform sampler2D tNormal;uniform float uTime;uniform float uRipple;uniform float uReflectivity;uniform float uHasRefl;
uniform vec3 uTint;uniform vec3 uFallback;uniform vec2 uSize;uniform float uShape;uniform float uEdge;uniform vec4 uRing[4];uniform float uFogScale;uniform float uDistort;
varying vec4 vProj;varying vec3 vW;varying vec2 vUv;
#include <fog_pars_fragment>
void main(){
  vec2 p=(vUv-0.5)*uSize;
  vec2 nuv=vW.xz;
  vec3 n1=texture2D(tNormal,nuv*0.55+vec2(uTime*0.012,uTime*0.008)).xyz*2.0-1.0;
  vec3 n2=texture2D(tNormal,nuv*1.25-vec2(uTime*0.010,-uTime*0.015)).xyz*2.0-1.0;
  vec2 dn=(n1.xy+n2.xy*0.6)*uRipple*0.6;
  for(int i=0;i<4;i++){vec4 r=uRing[i];if(r.w>0.0){vec2 dv=p-r.xy;float dd=length(dv);float front=r.z*0.32;float k=dd-front;
      float env=exp(-k*k*30.0)*exp(-r.z*0.9)*r.w*smoothstep(0.0,0.15,r.z);dn+=(dv/max(dd,1e-3))*sin(k*55.0)*env*0.6;}}
  vec2 ruv=vProj.xy/vProj.w+dn*uDistort;
  vec3 refl=texture2D(tRefl,ruv).rgb;
  refl=mix(uFallback,refl,uHasRefl);
  vec3 V=normalize(cameraPosition-vW);vec3 N=normalize(vec3(dn.x*0.5,1.0,dn.y*0.5));
  float cv=max(dot(N,V),0.0);float F=0.02+0.98*pow(1.0-cv,5.0);
  float R=mix(uReflectivity,1.0,F);
  vec3 col=mix(uTint,refl,R);
  vec2 e=abs(vUv-0.5)*2.0;float m=uShape>0.5?length(e):max(e.x,e.y);
  float en=texture2D(tNormal,vW.xz*0.35+3.1).w;
  float alpha=1.0-smoothstep(1.0-uEdge,1.0,m+(en-0.5)*uEdge*0.8);
  gl_FragColor=vec4(col,alpha);
  ${GL_FOG_SCALED}
}`;
let REFLECTING=false;
function makeMirrorWater(opts){opts=opts||{};const q=qlv(opts),res=Res();const W=opts.width||2.5,D=opts.depth||1.6;const RES=opts.resolution||[256,384,512][q];
  const geo=res.own(new T.PlaneGeometry(W,D,1,1));geo.rotateX(-Math.PI/2);
  const rt=res.own(new T.WebGLRenderTarget(RES,RES,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,format:T.RGBAFormat}));rt.texture.generateMipmaps=false;
  const rings=[new T.Vector4(),new T.Vector4(),new T.Vector4(),new T.Vector4()];
  const U=Object.assign(T.UniformsUtils.clone(T.UniformsLib.fog),{tRefl:{value:rt.texture},tNormal:{value:res.sh("waternormal",makeWaterNormal)},uTexMat:{value:new T.Matrix4()},uTime:{value:0},
    uRipple:{value:opts.ripple!==undefined?opts.ripple:0.25},uReflectivity:{value:opts.reflectivity!==undefined?opts.reflectivity:0.62},uHasRefl:{value:1},
    uTint:{value:C(opts.tint,0x1b231d)},uFallback:{value:C(opts.fallbackColor,0x7d8c96)},uSize:{value:new T.Vector2(W,D)},uShape:{value:opts.shape==="rect"?0:1},uEdge:{value:opts.edgeSoftness!==undefined?opts.edgeSoftness:0.22},
    uRing:{value:rings},uFogScale:{value:1},uDistort:{value:opts.distortion!==undefined?opts.distortion:0.03}});
  const mat=res.own(new T.ShaderMaterial({uniforms:U,vertexShader:MIRROR_VS,fragmentShader:MIRROR_FS,transparent:true,depthWrite:false,fog:true,toneMapped:false}));
  const mesh=new T.Mesh(geo,mat);mesh.name="TSURE_mirrorWater";mesh.renderOrder=3;mesh.receiveShadow=false;mesh.castShadow=false;
  const plane=new T.Plane(),normal=new T.Vector3(),rwp=new T.Vector3(),cwp=new T.Vector3(),rot=new T.Matrix4(),look=new T.Vector3(),view=new T.Vector3(),target=new T.Vector3(),
    clip=new T.Vector4(),qv=new T.Vector4(),vcam=new T.PerspectiveCamera();
  let enabled=true,failed=false,lastFrame=-1,frameCount=0;const every=Math.max(1,opts.every||1),maxDist=opts.maxDistance||60,exclude=opts.exclude||[];const clipBias=opts.clipBias!==undefined?opts.clipBias:0.002;
  mesh.onBeforeRender=function(renderer,scene,camera){
    if(!enabled||failed||REFLECTING)return;
    for(let o=mesh;o;o=o.parent){if(o.visible===false)return;}
    const fid=renderer.info.render.frame;if(fid===lastFrame)return;lastFrame=fid;frameCount++;if((frameCount%every)!==0)return;
    rwp.setFromMatrixPosition(mesh.matrixWorld);cwp.setFromMatrixPosition(camera.matrixWorld);if(cwp.distanceTo(rwp)>maxDist)return;
    rot.extractRotation(mesh.matrixWorld);normal.set(0,1,0).applyMatrix4(rot);
    view.subVectors(rwp,cwp);if(view.dot(normal)>0)return;
    view.reflect(normal).negate();view.add(rwp);
    rot.extractRotation(camera.matrixWorld);look.set(0,0,-1).applyMatrix4(rot).add(cwp);
    target.subVectors(rwp,look);target.reflect(normal).negate();target.add(rwp);
    vcam.position.copy(view);vcam.up.set(0,1,0).applyMatrix4(rot).reflect(normal);vcam.lookAt(target);vcam.far=camera.far;vcam.near=camera.near;
    vcam.updateMatrixWorld();vcam.projectionMatrix.copy(camera.projectionMatrix);
    const tm=U.uTexMat.value;tm.set(0.5,0,0,0.5,0,0.5,0,0.5,0,0,0.5,0.5,0,0,0,1);tm.multiply(vcam.projectionMatrix);tm.multiply(vcam.matrixWorldInverse);tm.multiply(mesh.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(normal,rwp);plane.applyMatrix4(vcam.matrixWorldInverse);
    clip.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);const pm=vcam.projectionMatrix;
    qv.x=(Math.sign(clip.x)+pm.elements[8])/pm.elements[0];qv.y=(Math.sign(clip.y)+pm.elements[9])/pm.elements[5];qv.z=-1.0;qv.w=(1.0+pm.elements[10])/pm.elements[14];
    clip.multiplyScalar(2.0/clip.dot(qv));pm.elements[2]=clip.x;pm.elements[6]=clip.y;pm.elements[10]=clip.z+1.0-clipBias;pm.elements[14]=clip.w;
    const prevRT=renderer.getRenderTarget(),prevXR=renderer.xr.enabled,prevSh=renderer.shadowMap.autoUpdate;const hidden=[];
    try{REFLECTING=true;rt.texture.encoding=renderer.outputEncoding;mesh.visible=false;exclude.forEach(o=>{if(o&&o.visible){o.visible=false;hidden.push(o);}});
      renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.setRenderTarget(rt);renderer.state.buffers.depth.setMask(true);
      if(renderer.autoClear===false)renderer.clear();renderer.render(scene,vcam);U.uHasRefl.value=1;}
    catch(err){failed=true;U.uHasRefl.value=0;if(typeof console!=="undefined")console.warn("[TSURE_NATURE] mirror reflection disabled:",err);}
    finally{REFLECTING=false;mesh.visible=true;hidden.forEach(o=>o.visible=true);renderer.xr.enabled=prevXR;renderer.shadowMap.autoUpdate=prevSh;renderer.setRenderTarget(prevRT);
      if(camera.viewport!==undefined)renderer.state.viewport(camera.viewport);}};
  let tAcc=0;const ringAge=[9,9,9,9];let ringNext=0;
  mesh.userData={renderTarget:rt,uniforms:U,
    setRipple(v){U.uRipple.value=clamp(v,0,1);},
    addRipple(x,z,strength){const i=ringNext++%4;rings[i].set(x,z,0,strength!==undefined?strength:1);ringAge[i]=0;},
    setEnabled(v){enabled=!!v;if(!v)U.uHasRefl.value=0;else if(!failed)U.uHasRefl.value=1;},
    setTint(c){setC(U.uTint.value,c);},setFallback(c){setC(U.uFallback.value,c);},setSky(s){if(s&&s.horizon!==undefined){const h=C(s.horizon);U.uFallback.value.setRGB(...displayOf([h.r,h.g,h.b],1).map(v=>v));}},
    setExclude(list){exclude.length=0;(list||[]).forEach(o=>exclude.push(o));},
    update(dt,t){tAcc=(typeof t==="number")?t:tAcc+(dt||0);U.uTime.value=tAcc;for(let i=0;i<4;i++){if(rings[i].w>0){ringAge[i]+=dt||0;rings[i].z=ringAge[i];if(ringAge[i]>6)rings[i].w=0;}}},
    dispose(){res.dispose();}};
  return mesh;}

/* =====================================================================
 * 9. DISTANT HILLS
 * ===================================================================== */
const HILL_VS=`
attribute float aArc;attribute float aTop;attribute float aSlope;attribute vec3 aTang;attribute float aEnd;uniform vec3 uCenter;
varying float vArc;varying float vY;varying float vTop;varying float vSlope;varying vec3 vW;varying vec3 vTang;varying vec3 vRad;varying float vEnd;
void main(){vEnd=aEnd;vArc=aArc;vY=position.y;vTop=aTop;vSlope=aSlope;vTang=normalize(mat3(modelMatrix)*aTang);
  vRad=mat3(modelMatrix)*vec3(position.x-uCenter.x,0.0,position.z-uCenter.z);
  vec4 wp=modelMatrix*vec4(position,1.0);vW=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`;
const HILL_FS=`
uniform vec3 uCol;uniform vec3 uFar;uniform vec3 uLight;uniform vec3 uSunDir;uniform vec3 uCenter;uniform float uAerial;uniform float uMist;uniform float uMistH;
uniform float uForest;uniform float uCrown;uniform float uSeed;uniform float uBase;uniform float uRim;uniform float uFront;uniform float uDetail;uniform vec3 uAutumn;uniform float uAutumnAmt;
uniform sampler2D tNoise;
varying float vArc;varying float vY;varying float vTop;varying float vSlope;varying vec3 vW;varying vec3 vTang;varying vec3 vRad;varying float vEnd;
uniform float uGround;
${GL_HASH}
float crowns(float x,float w,float sd){float cell=floor(x/w);float best=-1e3;
  for(int k=-1;k<=1;k++){float c=cell+float(k);float h1=nh11(c*1.37+sd);float cx=(c+0.2+0.6*nh11(c*7.13+sd))*w;float r=w*(0.55+0.5*h1);float dx=x-cx;
    float y=sqrt(max(r*r-dx*dx,0.0))*0.85+(nh11(c*3.1+sd)-0.5)*w*0.5;best=max(best,y);}
  return best;}
void main(){
  float top=vTop;
  if(uForest>0.5){top+=crowns(vArc,uCrown,uSeed)*0.55+crowns(vArc+17.3,uCrown*0.47,uSeed+5.0)*0.35-uCrown*0.45;}
  float aa=max(fwidth(vY),1e-3)*0.9;
  float alpha=1.0-smoothstep(top-aa,top+aa,vY);
  alpha*=vEnd*smoothstep(uBase,mix(uBase,uGround,0.7),vY);
  if(alpha<0.003)discard;
  float below=max(top-vY,0.0);
  float rel=clamp((vY-uBase)/max(vTop-uBase,1.0),0.0,1.0);
  vec3 col=uCol;
  /* spurs and gullies running down from the crest (diagonal), canopy texture */
  float sp1=texture2D(tNoise,vec2((vArc+below*0.85)/(uCrown*34.0),below/(uCrown*60.0)+uSeed*0.01)).r;
  float sp2=texture2D(tNoise,vec2((vArc-below*0.6)/(uCrown*21.0),below/(uCrown*40.0)+0.37)).b;
  float relief=(sp1-0.5)*0.65+(sp2-0.5)*0.45;
  float tc=texture2D(tNoise,vec2(vArc,vY*1.3)/(uCrown*7.5)).g;
  float tc2=texture2D(tNoise,vec2(vArc,vY*1.2)/(uCrown*3.1)+0.5).g;
  col*=1.0+((tc-0.5)*0.26+(tc2-0.5)*0.12)*uDetail+relief*0.28*(0.4+0.6*uDetail);
  float am=smoothstep(0.58,0.78,texture2D(tNoise,vec2(vArc,vY)/(uCrown*16.0)+0.41).b*0.6+tc2*0.4)*uAutumnAmt*smoothstep(0.15,0.6,rel);
  col=mix(col,uAutumn*(0.75+0.5*tc),am*0.8);
  /* sun: front light on faces turned to the sun (profile slope + spurs), rim light when backlit */
  vec3 radial=normalize(vec3(vRad.x,0.0,vRad.z)+vec3(1e-4,0.0,0.0));
  vec3 sH=normalize(vec3(uSunDir.x,0.0,uSunDir.z)+vec3(1e-4,0.0,0.0));
  float sunUp=smoothstep(-0.06,0.04,uSunDir.y);
  float nearCrest=exp(-below/(max(vTop-uBase,1.0)*0.35));
  vec3 fn=normalize(-radial*1.2-normalize(vTang)*(vSlope*1.6*nearCrest+relief*0.9));
  float lam=max(dot(fn,sH),0.0);
  float front=lam*sunUp*uFront*(0.25+0.75*smoothstep(0.2,1.0,rel));
  col=mix(col,col*uLight*1.75,clamp(front,0.0,1.0));
  float back=max(dot(radial,sH),0.0);
  float edge=exp(-below/(uCrown*0.45));
  col+=uLight*pow(back,3.0)*edge*sunUp*uRim;
  /* aerial perspective and valley mist */
  col=mix(col,uFar,uAerial);
  float mist=(1.0-smoothstep(0.0,uMistH,rel))*uMist;
  col=mix(col,uFar,mist);
  gl_FragColor=vec4(col,alpha);
}`;
function makeHills(opts){opts=opts||{};const q=qlv(opts),res=Res();const center=opts.center||[0,0];
  const ridges=(opts.ridges&&opts.ridges.length)?opts.ridges:[{distance:620,height:95,arcStart:-1.2,arcEnd:1.2,seed:3,roughness:0.5},{distance:470,height:70,arcStart:-0.9,arcEnd:0.8,seed:7,roughness:0.6},{distance:340,height:42,arcStart:-0.6,arcEnd:0.5,seed:11,roughness:0.7}];
  const grp=new T.Group();grp.name="TSURE_hills";const noise=noiseTex(res);
  const order=ridges.map((r,i)=>({r,i})).sort((a,b)=>(b.r.distance||500)-(a.r.distance||500));
  const dists=ridges.map(r=>r.distance||500),dmin=Math.min(...dists),dmax=Math.max(...dists);
  const items=[];const baseY=opts.baseY!==undefined?opts.baseY:0;
  const tint={near:C(opts.near,0x3f4a44),far:C(opts.far,0xa9b5c4),light:C(opts.light,0xfff0d8),sunDir:new T.Vector3(0.3,0.5,0.4).normalize()};
  order.forEach(({r,i},rank)=>{const dist=r.distance||500,H=r.height||60,a0=r.arcStart!==undefined?r.arcStart:-1,a1=r.arcEnd!==undefined?r.arcEnd:1,seed=r.seed!==undefined?r.seed:i*17+3;
    const rough=r.roughness!==undefined?r.roughness:0.35,forest=r.forest!==false,crown=r.crown||Math.max(3,dist*0.009);
    const nSeg=Math.max(24,Math.round([90,170,280][q]*Math.min(2.5,Math.abs(a1-a0)/1.5+0.4)));
    const bottom=r.base!==undefined?r.base:baseY-Math.max(30,H*0.8);
    const pos=[],arc=[],tops=[],idx=[],slp=[],tng=[],hs=[],ends=[];
    for(let k=0;k<=nSeg;k++){const t=k/nSeg,a=lerp(a0,a1,t),x=dist*(a-a0);
      let h=H*(0.58+0.42*(fbm1(x/(dist*0.32)+seed*3.1,3,seed)-0.35)*1.4);
      h+=rough*H*0.16*(fbm1(x/(dist*0.07)+seed,3,seed+5)-0.5)*2;
      if(r.peaks)r.peaks.forEach(pk=>{const w=pk.width||0.15,g=Math.exp(-Math.pow((a-pk.at)/w,2));h=h*(1-g)+Math.max(h,(pk.height||H*1.3))*g;});
      h=Math.max(h,H*0.08);
      if(r.taper!==false){const e=Math.min(a-a0,a1-a)/Math.max(1e-3,(a1-a0)*0.14);h*=smooth(0,1,e);}
      hs.push(h);}
    for(let k=0;k<=nSeg;k++){const t=k/nSeg,a=lerp(a0,a1,t),x=dist*(a-a0),h=hs[k];
      const dxm=dist*(a1-a0)/nSeg;const sl=(hs[Math.min(nSeg,k+1)]-hs[Math.max(0,k-1)])/(dxm*(k>0&&k<nSeg?2:1));
      const dx=Math.sin(a)*dist+center[0],dz=-Math.cos(a)*dist+center[1];
      const topY=baseY+h,ext=forest?crown*1.25:2;
      pos.push(dx,bottom,dz,dx,topY+ext,dz);arc.push(x,x);tops.push(topY,topY);slp.push(sl,sl);const ef=r.taper===false?1:smooth(0,0.06,Math.min(t,1-t));ends.push(ef,ef);tng.push(Math.cos(a),0,Math.sin(a),Math.cos(a),0,Math.sin(a));}
    for(let k=0;k<nSeg;k++){const a=k*2,b=a+1,c=a+2,d=a+3;idx.push(a,c,b,b,c,d);}
    const g=res.own(new T.BufferGeometry());g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setAttribute("aArc",new T.Float32BufferAttribute(arc,1));g.setAttribute("aTop",new T.Float32BufferAttribute(tops,1));g.setAttribute("aSlope",new T.Float32BufferAttribute(slp,1));g.setAttribute("aTang",new T.Float32BufferAttribute(tng,3));g.setAttribute("aEnd",new T.Float32BufferAttribute(ends,1));g.setIndex(idx);g.computeBoundingSphere();
    const tr=dmax>dmin?(dist-dmin)/(dmax-dmin):0.5;
    const Uh={uCol:{value:new T.Color()},uFar:{value:new T.Color()},uLight:{value:new T.Color()},uSunDir:{value:tint.sunDir},uCenter:{value:new T.Vector3(center[0],0,center[1])},
      uAerial:{value:0},uMist:{value:r.mist!==undefined?r.mist:0.55},uMistH:{value:r.mistHeight!==undefined?r.mistHeight:0.55},uForest:{value:forest?1:0},uCrown:{value:crown},uSeed:{value:seed*1.618},
      uBase:{value:bottom},uGround:{value:baseY},uRim:{value:r.rim!==undefined?r.rim:0.55},uFront:{value:r.front!==undefined?r.front:0.6},uDetail:{value:clamp(1.25-dist/700,0.15,1)},
      uAutumn:{value:C(r.autumnColor,0xa04a28)},uAutumnAmt:{value:r.autumn||0},tNoise:{value:noise}};
    const m=res.own(new T.ShaderMaterial({uniforms:Uh,vertexShader:HILL_VS,fragmentShader:HILL_FS,transparent:true,depthWrite:true,depthTest:true,fog:false,toneMapped:false,side:T.DoubleSide}));
    m.extensions={derivatives:true};
    const mesh=new T.Mesh(g,m);mesh.renderOrder=-9+rank*0.01;mesh.frustumCulled=false;mesh.name="TSURE_ridge_"+i;grp.add(mesh);
    items.push({U:Uh,r,tr});});
  function setTint(t){if(!t)return;if(t.near!==undefined)setC(tint.near,t.near);if(t.far!==undefined)setC(tint.far,t.far);if(t.light!==undefined)setC(tint.light,t.light);
    if(t.sunDir){setV(tint.sunDir,t.sunDir);tint.sunDir.normalize();}
    items.forEach(it=>{const base=it.r.color!==undefined?C(it.r.color):tint.near.clone().lerp(tint.far,it.tr*0.55);
      it.U.uCol.value.copy(base);it.U.uFar.value.copy(tint.far);it.U.uLight.value.copy(tint.light);it.U.uAerial.value=it.r.aerial!==undefined?it.r.aerial:(0.12+it.tr*0.5);});}
  setTint({});
  grp.userData={setTint,ridges:items.map(i=>i.U),dispose(){res.dispose();}};return grp;}

/* =====================================================================
 * 10. SMOKE PLUME (CPU-sorted soft billboards)
 * ===================================================================== */
const PART_VS=`
attribute vec3 iPos;attribute vec4 iPar;attribute vec4 iPar2;
varying vec2 vUv;varying vec2 vCorner;varying float vAlpha;varying float vLit;varying float vVar;varying float vSeed;varying vec3 vWdir;varying float vWY;varying float vGround;
#include <fog_pars_vertex>
void main(){
  vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);vec3 up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
  float c=cos(iPar.z),s=sin(iPar.z);vec2 cr=vec2(c*position.x-s*position.y,s*position.x+c*position.y);
  vec3 wc=(modelMatrix*vec4(iPos,1.0)).xyz;
  vec3 wp=wc+right*cr.x*iPar.x+up*cr.y*iPar.x*iPar2.z;
  vWY=wp.y;vGround=iPar2.w;vUv=position.xy+0.5;vCorner=cr;vAlpha=iPar.y;vLit=iPar2.x;vVar=iPar.w;vSeed=iPar2.y;vWdir=normalize(wp-cameraPosition);
  vec4 mvPosition=viewMatrix*vec4(wp,1.0);gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`;
const SMOKE_FS=`
uniform sampler2D tPuff;uniform sampler2D tNoise;uniform vec3 uSunV;uniform vec3 uSunW;uniform vec3 uSunCol;uniform vec3 uAmb;uniform vec3 uSmoke;uniform float uTime;uniform float uFogScale;uniform float uOpacity;
varying vec2 vUv;varying vec2 vCorner;varying float vAlpha;varying float vLit;varying float vVar;varying float vSeed;varying vec3 vWdir;varying float vWY;varying float vGround;
#include <fog_pars_fragment>
${GL_HASH}
void main(){
  vec2 dn=(texture2D(tNoise,vUv*0.45+vec2(vSeed*7.1,vSeed*3.3-uTime*0.012)).rb-0.5)*0.16;
  vec2 uv=clamp(vUv+dn,0.01,0.99);
  vec2 cell=vec2(mod(vVar,2.0),floor(vVar/2.0));
  vec4 pf=texture2D(tPuff,(uv+cell)*0.5);
  float dens=pf.a;
  float det=texture2D(tNoise,vUv*0.9+vec2(vSeed*5.0,-uTime*0.02)).r;
  dens*=0.7+0.6*det;
  float a=dens*vAlpha*uOpacity;
  if(a<0.002)discard;
  vec2 cc=vCorner*2.0;float r2=dot(cc,cc);
  vec3 n=normalize(vec3(cc*0.85+(pf.rg-0.5)*0.6,sqrt(max(1.0-r2,0.08))));
  float ndl=dot(n,uSunV);float wrap=clamp((ndl+0.5)/1.5,0.0,1.0);
  float fwd=nhg(dot(vWdir,uSunW),0.6)*0.08*(1.0-dens*0.6);
  vec3 col=uSmoke*(uAmb*0.8+uSunCol*(wrap*0.75+fwd)*vLit*0.8);
  gl_FragColor=vec4(col,a);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
  ${GL_FOG_SCALED}
}`;
function quadGeo(){const g=new T.InstancedBufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute([-0.5,-0.5,0,0.5,-0.5,0,0.5,0.5,0,-0.5,0.5,0],3));g.setIndex([0,1,2,0,2,3]);return g;}
function particleSystem(res,N,fs,U){const g=res.own(quadGeo());const P=new Float32Array(N*3),A=new Float32Array(N*4),B=new Float32Array(N*4);
  const aP=new T.InstancedBufferAttribute(P,3),aA=new T.InstancedBufferAttribute(A,4),aB=new T.InstancedBufferAttribute(B,4);
  aP.setUsage(T.DynamicDrawUsage);aA.setUsage(T.DynamicDrawUsage);aB.setUsage(T.DynamicDrawUsage);
  g.setAttribute("iPos",aP);g.setAttribute("iPar",aA);g.setAttribute("iPar2",aB);g.instanceCount=N;
  const m=res.own(new T.ShaderMaterial({uniforms:U,vertexShader:PART_VS,fragmentShader:fs,transparent:true,depthWrite:false,depthTest:true,fog:true}));
  const mesh=new T.Mesh(g,m);mesh.frustumCulled=false;return {mesh,P,A,B,aP,aA,aB,g};}
function makeSmokePlume(opts){opts=opts||{};const q=qlv(opts),res=Res(),seed=opts.seed||5,rng=RNG(seed);const H=opts.height||45;
  const N=opts.count||[46,80,130][q];
  const U=Object.assign(T.UniformsUtils.clone(T.UniformsLib.fog),{tPuff:{value:res.sh("puff",makePuffAtlas)},tNoise:{value:noiseTex(res)},uSunV:{value:new T.Vector3(0,0,1)},uSunW:{value:new T.Vector3(-1,0.1,0).normalize()},
    uSunCol:{value:C(opts.lightColor,0xffa35c)},uAmb:{value:C(opts.ambient,0x6f6a8e)},uSmoke:{value:C(opts.color,0xa9a7aa)},uTime:{value:0},uFogScale:{value:opts.fogScale!==undefined?opts.fogScale:0.35},uOpacity:{value:opts.opacity!==undefined?opts.opacity:1}});
  const ps=particleSystem(res,N,SMOKE_FS,U);ps.mesh.renderOrder=opts.renderOrder!==undefined?opts.renderOrder:5;ps.mesh.name="TSURE_smoke";
  const grp=new T.Group();grp.name="TSURE_smokePlume";grp.add(ps.mesh);
  let wind=new T.Vector2(opts.wind?opts.wind[0]:1.6,opts.wind?opts.wind[1]:0.3);const sunW=U.uSunW.value;let shadowH=opts.shadowHeight!==undefined?opts.shadowHeight:0;
  const life=opts.life||Math.max(22,H*0.85);const NP=160;const path=new Float32Array((NP+1)*3);
  function buildPath(){let x=0,z=0;const k=2.0;for(let i=0;i<=NP;i++){const t=i/NP;const y=H*(1-Math.exp(-t*k*1.6))/(1-Math.exp(-k*1.6));
      if(i>0){const yy=path[(i-1)*3+1];const wf=0.12+0.88*Math.pow(smooth(0,H,yy),0.75);x+=wind.x*wf*life/NP;z+=wind.y*wf*life/NP;}path[i*3]=x;path[i*3+1]=y;path[i*3+2]=z;}}
  buildPath();
  const parts=[];for(let i=0;i<N;i++){parts.push({age:rng.r(0,life),life:life*rng.r(0.85,1.15),ox:rng.g(),oz:rng.g(),oy:rng.g(),var:rng.i(0,3),rot:rng.r(0,TAU),rs:rng.r(-0.06,0.06),seed:rng.f(),ph:rng.r(0,TAU)});}
  const order=new Array(N).fill(0).map((_,i)=>i),dz=new Float32Array(N),tmp=new T.Vector3(),camP=new T.Vector3(),camF=new T.Vector3();let tAcc=0;
  const wq=new T.Vector3();
  function step(dt,cam){for(let i=0;i<N;i++){const p=parts[i];p.age+=dt;if(p.age>p.life){p.age-=p.life;p.ox=rng.g();p.oz=rng.g();p.oy=rng.g();p.var=rng.i(0,3);p.seed=rng.f();}}
    if(cam){camP.setFromMatrixPosition(cam.matrixWorld);cam.getWorldDirection(camF);}
    grp.updateMatrixWorld();
    for(let i=0;i<N;i++){const p=parts[i],t=clamp(p.age/p.life,0,1);const fi=t*NP,i0=Math.min(NP-1,Math.floor(fi)),fr=fi-i0;
      let x=lerp(path[i0*3],path[i0*3+3],fr),y=lerp(path[i0*3+1],path[i0*3+4],fr),z=lerp(path[i0*3+2],path[i0*3+5],fr);
      const spread=0.25+t*H*0.07+Math.pow(t,2.4)*H*0.3;const wob=Math.sin(tAcc*0.35+p.ph+t*5.0)*(0.2+t*H*0.06);
      x+=p.ox*spread*0.55+wob;z+=p.oz*spread*0.55+Math.cos(tAcc*0.29+p.ph)*(0.3+t*H*0.04);y+=p.oy*spread*0.18*(0.3+t);
      const size=(0.9+H*0.022)+(H*0.30)*Math.pow(t,1.6);
      let a=smooth(0,0.035,t)*(1-smooth(0.45,1.0,t))*lerp(0.42,0.05,Math.pow(t,0.55));
      const lit=shadowH>0?smooth(shadowH*0.7,shadowH*1.15,y):1;
      p.x=x;p.y=y;p.z=z;p.size=size;p.a=a;p.lit=lit;p.rot+=p.rs*dt;
      tmp.set(x,y,z).applyMatrix4(grp.matrixWorld);dz[i]=cam?tmp.sub(camP).dot(camF):-y;}
    order.sort((a,b)=>dz[b]-dz[a]);
    for(let k=0;k<N;k++){const p=parts[order[k]];ps.P[k*3]=p.x;ps.P[k*3+1]=p.y;ps.P[k*3+2]=p.z;ps.A[k*4]=p.size;ps.A[k*4+1]=p.a;ps.A[k*4+2]=p.rot;ps.A[k*4+3]=p.var;
      ps.B[k*4]=p.lit;ps.B[k*4+1]=p.seed;ps.B[k*4+2]=1;ps.B[k*4+3]=-1e4;}
    ps.aP.needsUpdate=true;ps.aA.needsUpdate=true;ps.aB.needsUpdate=true;}
  ps.mesh.onBeforeRender=(r,s,cam)=>{U.uSunV.value.copy(sunW).transformDirection(cam.matrixWorldInverse);};
  step(0,null);
  grp.userData={uniforms:U,
    update(dt,t,camera){const d=Math.min(0.1,dt||0);tAcc+=d;U.uTime.value=tAcc;step(d,camera);},
    warm(seconds){const n=Math.ceil(seconds/0.1);for(let i=0;i<n;i++){tAcc+=0.1;step(0.1,null);}},
    setLight(o){if(!o)return;if(o.dir){setV(sunW,o.dir);sunW.normalize();}if(o.color!==undefined)setC(U.uSunCol.value,o.color);if(o.ambient!==undefined)setC(U.uAmb.value,o.ambient);
      if(typeof o.shadowHeight==="number")shadowH=o.shadowHeight;},
    setWind(w){wind.set(w[0],w[1]);buildPath();},setColor(c){setC(U.uSmoke.value,c);},setOpacity(v){U.uOpacity.value=v;},setFogScale(v){U.uFogScale.value=v;},
    dispose(){res.dispose();}};
  return grp;}

/* =====================================================================
 * 11. GROUND MIST
 * ===================================================================== */
const MIST_VS=`
attribute float aGround;uniform float uTime;uniform float uTop;uniform float uIsTop;uniform float uWave;
varying vec3 vW;varying float vG;
#include <fog_pars_vertex>
void main(){vec3 p=position;vG=aGround;
  if(uIsTop>0.5){p.y+=uWave*(sin(p.x*0.21+uTime*0.13)*0.55+sin(p.z*0.17-uTime*0.11+1.3)*0.45);}
  vec4 wp=modelMatrix*vec4(p,1.0);vW=wp.xyz;vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`;
const MIST_FS=`
uniform sampler2D tNoise;uniform vec3 uMist;uniform vec3 uGlow;uniform vec3 uSunW;uniform float uTime;uniform float uDensity;uniform float uFogScale;
uniform float uHs;uniform float uIsTop;uniform float uCamIn;uniform vec2 uWindV;uniform vec4 uRect;uniform float uEdge;uniform float uMaxPath;uniform float uCamG;
varying vec3 vW;varying float vG;
#include <fog_pars_fragment>
float odExp(float ya,float yb,float len){float a=ya/uHs,b=yb/uHs;float d=a-b;return len*(abs(d)>1e-3?(exp(-b)-exp(-a))/d:exp(-a));}
void main(){
  vec3 dv=vW-cameraPosition;float dist=length(dv);vec3 rd=dv/max(dist,1e-4);
  /* heights above local ground (exponential density profile, scale height uHs) */
  float yc=max(cameraPosition.y-uCamG,0.0);float yp=max(vW.y-vG,0.0);
  float tau;
  if(uIsTop>0.5){
    /* camera outside(above): from this entry point down to the ground; camera inside: from camera to this point */
    float down=max(-rd.y,0.012);float len=min(yp/down,uMaxPath);
    float tOut=odExp(yp,0.0,len)*step(0.0,-rd.y+0.012);
    float tIn=odExp(yc,yp,min(dist,uMaxPath));
    tau=mix(tOut,tIn,uCamIn);
  }else{
    tau=odExp(yc,yp,min(dist,uMaxPath))*uCamIn;
  }
  vec2 wp=vW.xz*0.05-uWindV*uTime*0.05;
  float n1=texture2D(tNoise,wp).r;float n2=texture2D(tNoise,wp*2.6+vec2(0.31,0.77)+uWindV*uTime*0.03).b;float n3=texture2D(tNoise,wp*0.29+0.5).r;
  float wisp=clamp(n1*0.5+n2*0.32+n3*0.55-0.18,0.05,1.3);
  wisp=mix(wisp,0.62+0.35*(n3-0.5),smoothstep(25.0,70.0,dist));
  tau*=uDensity*mix(0.35,1.45,wisp);
  float a=1.0-exp(-tau);
  vec2 e=min(vW.xz-uRect.xy,uRect.zw-vW.xz);a*=smoothstep(0.0,uEdge,min(e.x,e.y));
  a*=smoothstep(0.2,2.0,dist);
  if(a<0.002)discard;
  float g=pow(max(dot(rd,normalize(uSunW)),0.0),5.0);
  vec3 col=uMist+uGlow*g*0.55*(0.4+0.6*a);
  gl_FragColor=vec4(col,min(a,0.985));
  ${GL_FOG_SCALED}
}`;
function makeMist(opts){opts=opts||{};const q=qlv(opts),res=Res();
  const W=opts.width||60,D=opts.depth||60,Hm=opts.height||1.2,heightAt=opts.heightAt||null;
  const cs=Math.max(0.8,[3.0,2.0,1.4][q]*Math.max(W,D)/80);const nx=Math.max(4,Math.round(W/cs)),nz=Math.max(4,Math.round(D/cs));
  const grp=new T.Group();grp.name="TSURE_mist";
  const U=Object.assign(T.UniformsUtils.clone(T.UniformsLib.fog),{tNoise:{value:noiseTex(res)},uMist:{value:C(opts.color,0xe6e4e2)},uGlow:{value:C(opts.glow,0xffd9b0)},
    uSunW:{value:new T.Vector3(1,0.1,0)},uTime:{value:0},uDensity:{value:(opts.density!==undefined?opts.density:0.5)*0.25},uFogScale:{value:opts.fogScale!==undefined?opts.fogScale:0.5},
    uHs:{value:Hm*0.6},uIsTop:{value:1},uCamIn:{value:0},uCamG:{value:0},uWindV:{value:new T.Vector2(opts.wind?opts.wind[0]:0.25,opts.wind?opts.wind[1]:0.08)},uRect:{value:new T.Vector4()},
    uEdge:{value:Math.min(W,D)*0.18},uMaxPath:{value:opts.maxPath||90},uWave:{value:Hm*0.25},uTop:{value:Hm*2.6}});
  // two draped grids: top surface and a ground-hugging surface
  function grid(off,isTop){const pos=[],gnd=[],idx=[];
    for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=-W/2+W*i/nx,z=-D/2+D*j/nz;pos.push(x,off,z);gnd.push(0);}
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;idx.push(a,c,b,b,c,d);}
    const g=res.own(new T.BufferGeometry());g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setAttribute("aGround",new T.Float32BufferAttribute(gnd,1));g.setIndex(idx);
    const u=Object.assign({},U,{uIsTop:{value:isTop?1:0}});
    const m=res.own(new T.ShaderMaterial({uniforms:u,vertexShader:MIST_VS,fragmentShader:MIST_FS,transparent:true,depthWrite:false,fog:true,toneMapped:false,side:T.DoubleSide,
      polygonOffset:!isTop,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));
    const mesh=new T.Mesh(g,m);mesh.frustumCulled=false;mesh.renderOrder=opts.renderOrder!==undefined?opts.renderOrder:6;return {mesh,g,off};}
  const top=grid(Hm*2.6,true),bot=grid(0.035,false);grp.add(bot.mesh);grp.add(top.mesh);
  let draped=false;
  function drape(){grp.updateMatrixWorld(true);const e=grp.matrixWorld.elements;const ox=e[12],oy=e[13],oz=e[14];
    [top,bot].forEach(L=>{const p=L.g.attributes.position,gA=L.g.attributes.aGround;
      for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);const gy=heightAt?heightAt(x+ox,z+oz)-oy:0;p.setY(i,gy+L.off);gA.setX(i,gy);}
      p.needsUpdate=true;gA.needsUpdate=true;L.g.computeBoundingSphere();});
    U.uRect.value.set(ox-W/2,oz-D/2,ox+W/2,oz+D/2);draped=true;}
  const camP=new T.Vector3();let tAcc=0;
  grp.userData={uniforms:U,
    update(dt,t,camera){tAcc=(typeof t==="number")?t:tAcc+(dt||0);U.uTime.value=tAcc;if(!draped)drape();
      if(camera){camP.setFromMatrixPosition(camera.matrixWorld);const oy=grp.matrixWorld.elements[13];const gy=(heightAt?heightAt(camP.x,camP.z):oy);
        const inside=(camP.x>U.uRect.value.x&&camP.x<U.uRect.value.z&&camP.z>U.uRect.value.y&&camP.z<U.uRect.value.w)?1:0;
        U.uCamG.value=gy;U.uCamIn.value=inside*smooth(Hm*2.6,Hm*2.3,camP.y-gy);}},
    redrape(){draped=false;},
    setColor(c){setC(U.uMist.value,c);},setDensity(v){U.uDensity.value=v*0.25;},setLight(o){if(!o)return;if(o.dir)setV(U.uSunW.value,o.dir);if(o.color!==undefined)setC(U.uGlow.value,o.color);},
    setWind(w){U.uWindV.value.set(w[0],w[1]);},setFogScale(v){U.uFogScale.value=v;},
    dispose(){res.dispose();}};
  return grp;}

/* =====================================================================
 * 12. CROWS
 * ===================================================================== */
function crowGeometry(q){const geos=[];const segs=[6,8,10][q];
  const tag=(g,w)=>{const n=g.attributes.position.count;g.setAttribute("aWing",new T.Float32BufferAttribute(new Float32Array(n).fill(w),1));if(g.attributes.uv)g.deleteAttribute("uv");return g;};
  // body: lathe along Z
  {const pr=[];const n=10;for(let i=0;i<=n;i++){const t=i/n;const z=lerp(-0.13,0.13,t);const r=0.058*Math.pow(Math.sin(Math.PI*clamp(t*0.92+0.06,0,1)),0.75)*(t<0.3?lerp(0.55,1,t/0.3):1);pr.push(new T.Vector2(Math.max(r,0.004),z));}
    const g=new T.LatheGeometry(pr,segs);g.rotateX(Math.PI/2);g.scale(1,1.08,1);g.translate(0,0,0);geos.push(tag(g,0));}
  // head
  {const g=new T.SphereGeometry(0.044,segs,Math.max(4,segs-2));g.scale(0.92,0.95,1.05);g.translate(0,0.016,0.155);geos.push(tag(g,0));}
  // thick arched bill
  {const pos=[],idx=[];const sec=[[0.18,0.030,0.024,0.006],[0.205,0.026,0.020,0.009],[0.232,0.019,0.014,0.010],[0.255,0.011,0.008,0.008],[0.272,0.003,0.002,0.004]];
    sec.forEach(([z,hh,ww,yo])=>{for(let j=0;j<8;j++){const a=j/8*TAU;pos.push(Math.cos(a)*ww*0.5,yo+Math.sin(a)*hh*0.5-(z-0.18)*0.12,z);}});
    for(let i=0;i<sec.length-1;i++)for(let j=0;j<8;j++){const a=i*8+j,b=i*8+(j+1)%8,c=(i+1)*8+j,d=(i+1)*8+(j+1)%8;idx.push(a,b,c,b,d,c);}
    const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();geos.push(tag(g,0));}
  // tail (slightly wedge-rounded fan)
  {const s=new T.Shape();s.moveTo(-0.026,-0.10);s.lineTo(-0.062,-0.30);s.quadraticCurveTo(-0.03,-0.335,0,-0.345);s.quadraticCurveTo(0.03,-0.335,0.062,-0.30);s.lineTo(0.026,-0.10);s.closePath();
    const g=new T.ShapeGeometry(s,6);g.rotateX(Math.PI/2);g.scale(1,1,-1);g.translate(0,0.004,0);
    // ShapeGeometry in XY with y = forward; after rotateX(+90°) y→z ; fix sign so tail is at -z
    const p=g.attributes.position;for(let i=0;i<p.count;i++){p.setZ(i,-Math.abs(p.getZ(i)));}g.computeVertexNormals();geos.push(tag(g,0));}
  // wings (right, then mirrored left); outline in (x span, z forward)
  const W=[[0.035,0.05],[0.12,0.072],[0.22,0.078],[0.30,0.068],[0.37,0.05],[0.46,0.03],[0.50,0.018],[0.495,0.006],[0.415,-0.002],[0.50,-0.012],[0.522,-0.022],[0.515,-0.034],[0.425,-0.036],
    [0.505,-0.048],[0.515,-0.058],[0.505,-0.068],[0.42,-0.068],[0.49,-0.08],[0.495,-0.09],[0.485,-0.099],[0.405,-0.095],[0.46,-0.108],[0.462,-0.117],[0.45,-0.123],[0.36,-0.12],[0.28,-0.13],[0.18,-0.14],[0.10,-0.138],[0.035,-0.11]];
  [1,-1].forEach(side=>{const s=new T.Shape();W.forEach((p,i)=>{const x=p[0]*side,y=p[1];if(i)s.lineTo(x,y);else s.moveTo(x,y);});s.closePath();
    const g=new T.ShapeGeometry(s,1);const p=g.attributes.position;const pos=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){pos[i*3]=p.getX(i);pos[i*3+1]=0.018;pos[i*3+2]=p.getY(i);}
    const ng=new T.BufferGeometry();ng.setAttribute("position",new T.BufferAttribute(pos,3));const id=Array.from(g.index.array);if(side<0){for(let i=0;i<id.length;i+=3){const t=id[i+1];id[i+1]=id[i+2];id[i+2]=t;}}
    ng.setIndex(id);ng.computeVertexNormals();
    // make sure normals point up
    const nn=ng.attributes.normal;for(let i=0;i<nn.count;i++)nn.setXYZ(i,0,1,0);
    g.dispose();geos.push(tag(ng,1));});
  const out=mergeGeos(geos);geos.forEach(g=>g.dispose());out.computeBoundingSphere();return out;}
function makeCrows(opts){opts=opts||{};const q=qlv(opts),res=Res(),seed=opts.seed||11,rng=RNG(seed);const count=opts.count||7;
  const center=V3(opts.center,new T.Vector3(0,40,0)),dir2=new T.Vector2(opts.dir?opts.dir[0]:1,opts.dir?opts.dir[1]:0).normalize();
  const spread=opts.spread||18,speed=opts.speed||10.5,range=opts.range||Math.max(260,spread*8),scale=opts.scale||1;
  const geo=res.own(crowGeometry(q));const flap=new Float32Array(count*2);const fa=new T.InstancedBufferAttribute(flap,2);fa.setUsage(T.DynamicDrawUsage);geo.setAttribute("iFlap",fa);
  const U={uFogScale:{value:opts.fogScale!==undefined?opts.fogScale:0.45}};
  const mat=res.own(new T.MeshStandardMaterial({color:opts.color!==undefined?opts.color:0x0e0f12,roughness:0.5,metalness:0.0,side:T.DoubleSide}));
  mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
    sh.vertexShader="attribute float aWing;attribute vec2 iFlap;\n"+sh.vertexShader
      .replace("#include <beginnormal_vertex>",`#include <beginnormal_vertex>
  float cwSide=sign(position.x+1e-6);float cwS=abs(position.x);float cwA1=iFlap.x;float cwA2=iFlap.y;
  if(aWing>0.5&&cwS>0.035){float ang=cwS>0.25?cwA1+cwA2:cwA1;float ca=cos(ang*cwSide),sa=sin(ang*cwSide);objectNormal=vec3(ca*objectNormal.x-sa*objectNormal.y,sa*objectNormal.x+ca*objectNormal.y,objectNormal.z);}`)
      .replace("#include <begin_vertex>",`#include <begin_vertex>
  if(aWing>0.5&&cwS>0.035){float inner=clamp(cwS,0.035,0.25)-0.035;float outer=max(cwS-0.25,0.0);
    vec2 qq=vec2(0.035,0.0)+vec2(cos(cwA1),sin(cwA1))*inner+vec2(cos(cwA1+cwA2),sin(cwA1+cwA2))*outer;
    transformed.x=cwSide*qq.x;transformed.y=position.y+qq.y;transformed.z=position.z-outer*0.25*max(sin(cwA1),0.0);}`);
    sh.fragmentShader="uniform float uFogScale;\n"+sh.fragmentShader.replace("#include <fog_fragment>",GL_FOG_SCALED);};
  mat.customProgramCacheKey=()=>"tsure_crow";
  const im=new T.InstancedMesh(geo,mat,count);im.instanceMatrix.setUsage(T.DynamicDrawUsage);im.frustumCulled=false;im.castShadow=false;im.receiveShadow=false;im.name="TSURE_crows";
  // groups "三つ四つ、二つ三つ"
  const birds=[];let left=count,gi=0,gOff=0;
  while(left>0){let n=Math.min(left,rng.i(2,4));if(left-n===1)n=left<=4?left:n-1;left-=n;const gLat=rng.r(-spread*0.5,spread*0.5),gUp=rng.r(-spread*0.18,spread*0.18);
    for(let k=0;k<n;k++){birds.push({s0:gOff+rng.r(-4,4)-k*rng.r(1.5,3.5),lat:gLat+rng.r(-3.2,3.2),up:gUp+rng.r(-1.6,1.6),f:rng.r(3.0,3.8),ph:rng.r(0,TAU),
      sp:speed*rng.r(0.95,1.05),glideT:rng.r(0,6),glide:0,wv:rng.r(0.2,0.45),wph:rng.r(0,TAU),bank:0});}
    gOff-=rng.r(22,42);gi++;}
  const grp=new T.Group();grp.name="TSURE_crows";grp.add(im);
  const m4=new T.Matrix4(),qq=new T.Quaternion(),e=new T.Euler(0,0,0,"YXZ"),pv=new T.Vector3(),sv=new T.Vector3();let tAcc=0;
  const yaw0=Math.atan2(dir2.x,dir2.y);
  function step(dt){tAcc+=dt;birds.forEach((b,i)=>{
      b.glideT-=dt;if(b.glideT<0){if(b.glide>0){b.glide=0;b.glideT=rng.r(2.5,6);}else{b.glide=1;b.glideT=rng.r(0.6,1.6);}}
      b.gl=lerp(b.gl||0,b.glide,Math.min(1,dt*3));
      b.ph+=dt*TAU*b.f*(1-b.gl*0.85);
      const s=Math.sin(b.ph);let a1=0.10+0.62*s,a2=0.06+0.38*Math.sin(b.ph-0.7);
      a1=lerp(a1,0.09,b.gl);a2=lerp(a2,-0.04,b.gl);flap[i*2]=a1;flap[i*2+1]=a2;
      let along=b.s0+b.sp*tAcc;along=((along+range/2)%range+range)%range-range/2;
      const lat=b.lat+Math.sin(tAcc*b.wv+b.wph)*2.2,yb=b.up-0.06*s*(1-b.gl)+Math.sin(tAcc*0.37+b.wph)*0.6;
      pv.set(center.x+dir2.x*along-dir2.y*lat,center.y+yb,center.z+dir2.y*along+dir2.x*lat);
      const turn=Math.cos(tAcc*b.wv+b.wph)*b.wv*2.2/b.sp;
      e.set(-0.05+0.03*s*(1-b.gl),yaw0+turn*0.6,-turn*1.2);qq.setFromEuler(e);
      const endF=smooth(range*0.5,range*0.44,Math.abs(along));sv.setScalar(scale*endF+1e-4);m4.compose(pv,qq,sv);im.setMatrixAt(i,m4);});
    im.instanceMatrix.needsUpdate=true;fa.needsUpdate=true;}
  step(0);
  grp.userData={update(dt,t){step(Math.min(0.1,dt||0));},setFogScale(v){U.uFogScale.value=v;},birds,dispose(){res.dispose();}};
  return grp;}

/* =====================================================================
 * exports
 * ===================================================================== */
return {_dev:{makeGrassTex,makeSoilTex,makeRockTex,makeLeafTex,makePebbleTex,makeNoiseTex,makeSotobaTex,makeGraniteTex},makeSky,SKY_PRESETS,applyPreset,blendPresets,makeTerrain,carveStream,makeStream,makeMirrorWater,makeHills,makeSmokePlume,makeMist,
  makeSotoba,makeGorintou,makeStonePile,makeRock,makeCrows,SEASONS,util:{displayOf,linearOf,dirAzEl}};
})();
