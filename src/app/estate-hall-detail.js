/* =============================================================================
 estate-hall-detail.js — 散策モードの屋敷に、枕草子の殿舎（TSURE_AN.makeDensha）の細部を流用する  → ESTATE_HALL_DETAIL
 既存の建物の位置・寸法・当たり判定・調べる対象は変えない。材質と小さな部材だけを足す。
   ・屋根: TEX.roof の画像を殿舎の檜皮葺（genHiwada）に差し替え（MAT.roof/TEX.roof の同一性は保つ＝雪の切替はそのまま）。
           軒先に厚い軒付（genNoki の層）と白木の茅負を一続きに巡らせる（全屋根で2描画）。大棟・鬼端は檜皮の小口に。
   ・柱・桁・垂木: 殿舎と同じ素木（genWood）の材質へ（殿舎・対屋・廊・中門・釣殿の構造材だけ。調度は従来のまま）。
   ・寝殿の正面と東西に内法長押（1描画）。
   ・御簾: 竹ひご（misuImage）＋帽額（genMokou の窠紋）＋縁。ひごの隙が透け、夜は内の灯で暖かく光る。鉤丸緒と房（紫）。
   ・蔀: 黒漆の格子に白い裏板の画像へ（格子の刻みは従来と同じ）。
   ・高欄: 擬宝珠を殿舎の断面（GIBO）に、架木を丸材に。斗束と地覆を足す（高・中画質のみ）。階の親柱にも擬宝珠。
   ・簀子: 素木の板を継いだ画像（板の隙と継ぎ目）。
   ・築地: 殿舎の築地の土壁（版築・雨だれ・裾の汚れ）と本瓦葺の笠。
 画質: 画像の差し替え・軒付・長押は全画質（描画+3）。鉤丸緒・斗束・地覆・階の擬宝珠は GARDEN_POLISH.active の時だけ（低画質・省電力では隠す）。
 季節・時刻の切替では資源を作らない（uniform と emissiveIntensity・visible だけを変える）。鎌倉マップでは何もしない。
============================================================================= */
var ESTATE_HALL_DETAIL=(()=>{
  const off={update(){},active:false};
  if(APP.map==="kamakura"||/[?&]halldetail=0/.test(location.search)||typeof TSURE_AN==="undefined"||!TSURE_AN.parts)return off;
  const P=TSURE_AN.parts,root=new THREE.Group();root.name="estate-hall-detail";world.add(root);
  const gated=[],stats={};const t0=performance.now();
  scene.updateMatrixWorld(true);
  const toWorld=new THREE.Matrix4().copy(world.matrixWorld).invert();
  const rootsOf=ids=>ids.flatMap(id=>(interactables[id]&&interactables[id].roots)||[]);
  const HALL_IDS=["shinden","tai_e","tai_w","tai_n","watadono","sukiwatadono","chumonro","chumon","tsuridono"];
  const halls=rootsOf(HALL_IDS),tsuijiRoots=rootsOf(["tsuiji"]);
  const skipRoots=new Set([...tsuijiRoots,GISSHA_YARD&&GISSHA_YARD.root].filter(Boolean));
  const cloneTex=(t,rx,ry,srgb=true)=>{const c=t.clone();c.wrapS=c.wrapT=THREE.RepeatWrapping;c.repeat.set(rx,ry);if(srgb)c.encoding=THREE.sRGBEncoding;c.anisotropy=8;c.needsUpdate=true;return c;};
  const snow={value:0};
  // 本体は起動時に同じ形・材質の建物部材を static_batch_* の InstancedMesh にまとめて元を隠している。
  // 元の部材に施した差し替え（材質・形）を記録し、最後に同じ鍵のまとめ描画にも当てる。
  const changes=new Map();
  function swap(o,mat,geo){const k=o.userData.iid+"|"+o.geometry.uuid+"|"+o.material.uuid;if(!changes.has(k))changes.set(k,{mat:mat||o.material,geo:geo||o.geometry});
    if(mat)o.material=mat;if(geo)o.geometry=geo;}
  function snowy(mat){
    mat.onBeforeCompile=s=>{
      s.uniforms.uHallSnow=snow;
      s.fragmentShader="uniform float uHallSnow;\n"+s.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
        float hallUp=smoothstep(.30,.80,dot(normalize(normal),normalize(mat3(viewMatrix)*vec3(0.0,1.0,0.0))));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.90,.94),hallUp*uHallSnow);`);
    };return mat;
  }
  function geometry(B,uv2=true){
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute(B.P,3));g.setAttribute("normal",new THREE.Float32BufferAttribute(B.N,3));
    g.setAttribute("uv",new THREE.Float32BufferAttribute(B.U,2));if(uv2)g.setAttribute("uv2",g.attributes.uv);
    if(B.C)g.setAttribute("color",new THREE.Float32BufferAttribute(B.C,3));
    g.setIndex(B.I);g.computeBoundingBox();g.computeBoundingSphere();return g;
  }
  const builder=color=>({P:[],N:[],U:[],C:color?[]:null,I:[],quad(a,b,c,d,n,ua,ub,uc,ud,col){const o=this.P.length/3;
    for(const [p,u] of [[a,ua],[b,ub],[c,uc],[d,ud]]){this.P.push(p.x,p.y,p.z);this.N.push(n.x,n.y,n.z);this.U.push(u[0],u[1]);if(this.C)this.C.push(col,col,col);}
    this.I.push(o,o+1,o+2,o,o+2,o+3);}});
  function finishMesh(geo,mat,tag,gate){
    const m=new THREE.Mesh(geo,mat);m.castShadow=false;m.receiveShadow=true;m.userData.noAutoShadow=true;m.userData.hallDetail=tag;root.add(m);
    if(gate)gated.push(m);return m;
  }

  /* ---------- 素木（柱・桁・垂木・茅負・長押） */
  const WD=P.tex("wood",512);
  // 本体の木目UVは「長手8m×幅1.35m」で1枚。殿舎の木目画像は2.4m×1.2mなので繰り返しで実寸に合わせる。
  const shiraki=M({map:cloneTex(WD.map,8/2.4,1.35/1.2),bumpMap:WD.data,bumpScale:.0016,roughnessMap:WD.data,roughness:1,metalness:0,color:new THREE.Color(.82,.70,.56)});
  shiraki.name="hall-shiraki";

  /* ---------- 檜皮葺・軒付・棟 */
  const HW=P.tex("hiwada",512),NK=P.tex("noki",256);
  TEX.roof.image=HW.map.image;TEX.roof.repeat.set(4,4);TEX.roof.anisotropy=8;TEX.roof.needsUpdate=true;
  MAT.roof.bumpMap=HW.data;MAT.roof.bumpScale=.004;MAT.roof.roughness=.95;MAT.roof.needsUpdate=true;
  const nokiMat=M({map:cloneTex(NK.map,1,1),bumpMap:NK.data,bumpScale:.003,roughness:.95,vertexColors:true});nokiMat.name="hall-noki";
  // 箱棟・鬼端（木目UV: 長手8m×1.35m）に檜皮の層（1m×0.32m）を合わせる
  const ridgeMat=snowy(M({map:cloneTex(NK.map,8,1.35/.32),color:new THREE.Color(.9,.86,.84),roughness:.95}));ridgeMat.name="hall-ridge";
  const roofs=[];
  world.traverse(o=>{
    if(!o.isMesh||o.material!==MAT.roof||!o.geometry.userData.roofProfile)return;
    for(let p=o.parent;p;p=p.parent)if(skipRoots.has(p))return;
    roofs.push(o);
  });
  const band=builder(true),strip=builder(false),V=THREE.Vector3;
  const nm=new THREE.Matrix3(),mw=new THREE.Matrix4();
  roofs.forEach(roof=>{
    const g=roof.parent;
    // 大棟・鬼端（hipRoof の箱）は檜皮の小口に
    g.children.forEach(c=>{if(c.isMesh&&c.material===MAT.woodDark)swap(c,ridgeMat);});
    const prof=roof.geometry.userData.roofProfile,{w,d,thickness,lift}=prof,span=Math.min(w,d);
    if(span<3.8)return;
    mw.multiplyMatrices(toWorld,roof.matrixWorld);nm.getNormalMatrix(mw);
    const hw=w/2,hd=d/2,drop=THREE.MathUtils.clamp(span*.012,.08,.2),out=.014,inner=Math.min(.34,.1+span*.012);
    const sides=[[[-hw,hd],[hw,hd],[0,1]],[[hw,-hd],[-hw,-hd],[0,-1]],[[-hw,-hd],[-hw,hd],[-1,0]],[[hw,hd],[hw,-hd],[1,0]]];
    let arc=0;
    for(const [a,b,n] of sides){
      const L=Math.hypot(b[0]-a[0],b[1]-a[1]),dir=[(b[0]-a[0])/L,(b[1]-a[1])/L],N=10,us=k=>.5-.5*Math.cos(Math.PI*k/N); // 軒の反りは隅だけなので隅に寄せて刻む
      const pt=(u,o,i,y)=>{ // o: 外への出, i: 内への入り（隅は留め）
        const e=u===0?-1:u===1?1:0,x=a[0]+(b[0]-a[0])*u+n[0]*(o-i)+dir[0]*e*(o-i),z=a[1]+(b[1]-a[1])*u+n[1]*(o-i)+dir[1]*e*(o-i);
        return new V(x,y,z).applyMatrix4(mw);};
      const nOut=new V(n[0],0,n[1]).applyMatrix3(nm).normalize(),nIn=nOut.clone().negate(),nDown=new V(0,-1,0).applyMatrix3(nm).normalize();
      for(let k=0;k<N;k++){
        const u0=us(k),u1=us(k+1),y0=lift*Math.pow(2*u0-1,6),y1=lift*Math.pow(2*u1-1,6),s0=arc+L*u0,s1=arc+L*u1;
        const top0=y0+.006,top1=y1+.006,bot0=y0-thickness-drop,bot1=y1-thickness-drop,slab0=y0-thickness,slab1=y1-thickness;
        // 軒付の前面（厚い檜皮の層）・下端・内側
        band.quad(pt(u0,out,0,bot0),pt(u1,out,0,bot1),pt(u1,out,0,top1),pt(u0,out,0,top0),nOut,[s0,0],[s1,0],[s1,(top1-bot1)/.32],[s0,(top0-bot0)/.32],1);
        band.quad(pt(u0,0,inner,bot0),pt(u1,0,inner,bot1),pt(u1,out,0,bot1),pt(u0,out,0,bot0),nDown,[s0,.1],[s1,.1],[s1,.1+inner/.32],[s0,.1+inner/.32],.74);
        band.quad(pt(u1,0,inner,bot1),pt(u0,0,inner,bot0),pt(u0,0,inner,slab0),pt(u1,0,inner,slab1),nIn,[s1,0],[s0,0],[s0,drop/.32],[s1,drop/.32],.58);
        // 茅負（軒付の下の白木の横材）
        const sb0=bot0-.075,sb1=bot1-.075,si=.035,sd=.15;
        strip.quad(pt(u0,0,si,sb0),pt(u1,0,si,sb1),pt(u1,0,si,bot1),pt(u0,0,si,bot0),nOut,[s0/8,0],[s1/8,0],[s1/8,.075/1.35],[s0/8,.075/1.35]);
        strip.quad(pt(u0,0,si+sd,sb0),pt(u1,0,si+sd,sb1),pt(u1,0,si,sb1),pt(u0,0,si,sb0),nDown,[s0/8,.1],[s1/8,.1],[s1/8,.1+sd/1.35],[s0/8,.1+sd/1.35]);
      }
      arc+=L;
    }
  });
  if(band.P.length){finishMesh(geometry(band),nokiMat,"noki");finishMesh(geometry(strip),shiraki,"kayaoi");}
  stats.roofs=roofs.length;

  /* ---------- 構造材を素木へ（調度・建具は従来のまま） */
  const STRUCT_IID=new Set([...HALL_IDS,"nurigome","sunoko","hisashi","moya","tsumado","misu"]);let swapped=0;
  halls.forEach(r=>r.traverse(o=>{
    if(!o.isMesh||!(o.material===MAT.woodDark||(o.isInstancedMesh&&o.userData.staticDetail==="rafters")))return;
    if(!STRUCT_IID.has(o.userData.iid))return;
    swap(o,shiraki);swapped++;
  }));
  stats.shiraki=swapped;

  /* ---------- 寝殿の内法長押（南面と東西。柱の外面に打つ） */
  {
    const S=SH,nb=builder(false),shin=interactables.shinden&&interactables.shinden.roots[0];
    if(shin){
      const Mx=new THREE.Matrix4().multiplyMatrices(toWorld,shin.matrixWorld),Nx=new THREE.Matrix3().getNormalMatrix(Mx);
      const yb=S.f2+2.33,yt=yb+.15,face=.235,dep=.09;
      const run=(p0,p1,n)=>{ // p0→p1 は廂の柱筋、n は外向き
        const L=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]);const at=(s,o,y)=>new V(p0[0]+(p1[0]-p0[0])*s/L+n[0]*o,y,p0[1]+(p1[1]-p0[1])*s/L+n[1]*o).applyMatrix4(Mx);
        const no=new V(n[0],0,n[1]).applyMatrix3(Nx).normalize(),up=new V(0,1,0).applyMatrix3(Nx).normalize(),dn=up.clone().negate();
        nb.quad(at(0,face+dep,yb),at(L,face+dep,yb),at(L,face+dep,yt),at(0,face+dep,yt),no,[0,0],[L/8,0],[L/8,.15/1.35],[0,.15/1.35]);
        nb.quad(at(0,face,yt),at(0,face+dep,yt),at(L,face+dep,yt),at(L,face,yt),up,[0,0],[0,.07],[L/8,.07],[L/8,0]);
        nb.quad(at(0,face,yb),at(L,face,yb),at(L,face+dep,yb),at(0,face+dep,yb),dn,[0,0],[L/8,0],[L/8,.07],[0,.07]);
      };
      const hw=S.hw/2,hd=S.hd/2,e=face+dep;
      run([-hw-e,hd],[hw+e,hd],[0,1]);run([hw,hd+e],[hw,-hd+2.6],[1,0]);run([-hw,-hd+2.6],[-hw,hd+e],[-1,0]);
      finishMesh(geometry(nb),shiraki,"uchinori-nageshi");
    }
  }

  /* ---------- 御簾: 竹ひご＋帽額＋縁（1枚=幅約2.3m×高さ約2.05m） */
  const misuCanvas=(()=>{
    const W=512,H=1024,c=P.misuImage(W,H,231),x=c.getContext("2d"),pxm=W/2.3,pym=H/2.05;
    const mk=P.tex("mokou").image,bandH=Math.round(.19*pym),mw2=Math.round(1.28*pxm);
    for(let px=0;px<W;px+=mw2)x.drawImage(mk,px,0,mw2,bandH);
    x.fillStyle="rgba(60,52,30,.55)";x.fillRect(0,bandH,W,2);
    const silk=(cx,w,col)=>{x.fillStyle=col;x.fillRect(cx-w/2,bandH,w,H-bandH);x.fillStyle="rgba(255,255,255,.18)";x.fillRect(cx-w/2,bandH,1,H-bandH);};
    const edge=Math.round(.044*pxm),inn=Math.max(3,Math.round(.02*pxm));
    silk(edge/2,edge,"#c6d2c0");silk(W-edge/2,edge,"#c6d2c0");[.25,.5,.75].forEach(f=>silk(W*f,inn,"#d6ddd2"));
    x.fillStyle="#b8c4b0";x.fillRect(0,H-Math.round(.05*pym),W,Math.round(.05*pym));
    return c;
  })();
  const misuTex=new THREE.CanvasTexture(misuCanvas);misuTex.encoding=THREE.sRGBEncoding;misuTex.wrapS=THREE.RepeatWrapping;misuTex.wrapT=THREE.ClampToEdgeWrapping;misuTex.anisotropy=8;
  Object.assign(MAT.misu,{map:misuTex,emissiveMap:misuTex,transparent:true,opacity:1,depthWrite:false,roughness:.72});
  MAT.misu.emissive.setHex(0xffa860);MAT.misu.emissiveIntensity=0;MAT.misu.needsUpdate=true;
  const fusa=[],pose=new THREE.Object3D();
  gimmicks.misu.forEach(st=>{
    const plane=st.pivot.children.find(c=>c.isMesh&&c.material===MAT.misu);if(!plane)return;
    const W=plane.geometry.parameters.width,H=plane.geometry.parameters.height,tiles=Math.max(1,Math.round(W/2.0)),uv=plane.geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setX(i,uv.getX(i)>.5?tiles:0);uv.needsUpdate=true;
    plane.renderOrder=2;
    st.root.updateWorldMatrix(true,false);
    for(let k=0;k<tiles;k++)for(const f of [.25,.75]){
      const lx=-W/2+W*(k+f)/tiles;
      pose.position.set(lx,st.pivot.position.y-.2,st.pivot.position.z+.035);pose.rotation.set(0,0,0);pose.scale.set(1,1,1);pose.updateMatrix();
      fusa.push(new THREE.Matrix4().multiplyMatrices(toWorld,st.root.matrixWorld).multiply(pose.matrix));
    }
  });
  if(fusa.length){
    // 鉤丸緒（紅の緒 0.5m）＋結び＋房（紫）。頂点色で一つの形にまとめ、全御簾で1描画。
    const parts=[],cord=new THREE.CylinderGeometry(.006,.006,.5,5);cord.translate(0,-.25,0);parts.push([cord,[.62,.14,.17]]);
    const knot=new THREE.SphereGeometry(.016,8,6);knot.translate(0,-.5,0);parts.push([knot,[.7,.22,.2]]);
    const tas=new THREE.LatheGeometry(P.MISU_FUSA.map(p=>new THREE.Vector2(p[0],p[1])),10);tas.translate(0,-.51,0);parts.push([tas,[.46,.32,.62]]);
    const B={P:[],N:[],U:[],C:[],I:[]};
    parts.forEach(([g,col])=>{const ng=g.index?g.toNonIndexed():g,o=B.P.length/3,p=ng.attributes.position,n=ng.attributes.normal;
      for(let i=0;i<p.count;i++){B.P.push(p.getX(i),p.getY(i),p.getZ(i));B.N.push(n.getX(i),n.getY(i),n.getZ(i));B.U.push(0,0);B.C.push(...col);B.I.push(o+i);}
      ng.dispose();if(ng!==g)g.dispose();});
    const mesh=new THREE.InstancedMesh(geometry(B),M({vertexColors:true,roughness:.7}),fusa.length);
    fusa.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;fitDetailInstances(mesh);
    mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData.noAutoShadow=true;mesh.userData.hallDetail="kagi-maruo";root.add(mesh);gated.push(mesh);
  }
  stats.misu=gimmicks.misu.length;stats.fusa=fusa.length;

  /* ---------- 蔀: 黒漆の格子＋白い裏板（従来と同じ 8×8 の刻み） */
  {
    const c=TEX.koushi.image,x=c.getContext("2d"),w=c.width,h=c.height,step=w/8;
    x.clearRect(0,0,w,h);x.fillStyle="#ddd7c8";x.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=step)for(let xx=0;xx<w;xx+=step){
      const g=x.createLinearGradient(xx,y,xx+step*.6,y+step*.6);g.addColorStop(0,"#9c968a");g.addColorStop(.3,"#d6d0c1");g.addColorStop(1,"#e9e4d6");
      x.fillStyle=g;x.fillRect(xx+3,y+3,step-6,step-6);
    }
    for(let i=0;i<=w;i+=step){
      x.fillStyle="#161311";x.fillRect(i-3.5,0,7,h);x.fillRect(0,i-3.5,w,7);
      x.fillStyle="rgba(120,108,92,.55)";x.fillRect(i-3,0,1,h);x.fillRect(0,i-3,w,1);
      x.fillStyle="rgba(0,0,0,.6)";x.fillRect(i+3,0,1,h);x.fillRect(0,i+3,w,1);
    }
    TEX.koushi.needsUpdate=true;MAT.koushi.roughness=.55;
  }

  /* ---------- 簀子: 素木の板（幅約26cm）を継ぎ、板の隙を黒く残す（本体のUVは 6m×5.2m で1枚） */
  {
    const c=TEX.sunoko.image,x=c.getContext("2d"),w=c.width,h=c.height,wood=WD.map.image,rows=20,rh=h/rows,piece=w/2;
    let seed=0x51c0;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    x.fillStyle="#241b14";x.fillRect(0,0,w,h);
    for(let r=0;r<rows;r++){
      const ox=rnd()*piece,sy=rnd()*(wood.height-52);
      for(let k=-1;k<=2;k++){const px=ox+k*piece;x.drawImage(wood,0,sy,wood.width,52,px+1,r*rh+1.2,piece-2,rh-2.6);}
    }
    x.globalCompositeOperation="multiply";x.fillStyle="rgb(214,190,156)";x.fillRect(0,0,w,h);x.globalCompositeOperation="source-over";
    for(let r=0;r<rows;r++){x.fillStyle="rgba(255,240,214,.10)";x.fillRect(0,r*rh+1.2,w,1);}
    TEX.sunoko.needsUpdate=true;
  }

  /* ---------- 高欄: 擬宝珠・丸い架木・斗束・地覆 */
  {
    // 散策では数百本並ぶので、断面を間引き周方向8分割にする（三角形数を抑える）
    const gibo=new THREE.LatheGeometry(P.GIBO.filter((p,i)=>[0,1,3,5,6,7,9,11,13].includes(i)).map(p=>new THREE.Vector2(p[0]*1.05,p[1]*1.05)),8);gibo.translate(0,-.04,0);gibo.setAttribute("uv2",gibo.attributes.uv);
    gibo.computeBoundingBox();gibo.computeBoundingSphere();
    const kasagi=new Map(),tsuka=[],jifuku=[],m4=new THREE.Matrix4();let rails=0;
    world.traverse(o=>{
      if(!o.isInstancedMesh||o.geometry!==RAIL_CAP_GEO)return;
      for(let p=o.parent;p;p=p.parent)if(skipRoots.has(p))return;
      o.geometry=gibo;o.castShadow=false;o.userData.noAutoShadow=true;rails++;
      const g=o.parent,top=g.children.find(c=>c.isMesh&&!c.isInstancedMesh&&c.material===MAT.shu&&Math.abs(c.position.y-.78)<.01);
      if(!top)return;
      const L=top.geometry.parameters.width;
      if(!kasagi.has(L)){const cg=new THREE.CylinderGeometry(.043,.043,L,10);cg.rotateZ(Math.PI/2);cg.setAttribute("uv2",cg.attributes.uv);kasagi.set(L,cg);}
      swap(top,null,kasagi.get(L));
      g.updateWorldMatrix(true,false);const gm=new THREE.Matrix4().multiplyMatrices(toWorld,g.matrixWorld);
      const n=Math.max(2,Math.round(L/1.8)),seg=L/n;
      for(let i=0;i<n;i++){const k=Math.max(1,Math.round(seg/.9));for(let j=1;j<k;j++){const x=-L/2+seg*(i+j/k);tsuka.push(gm.clone().multiply(m4.makeTranslation(x,0,0)));}}
      jifuku.push(gm.clone().multiply(m4.compose(new V(0,.035,0),new THREE.Quaternion(),new V(L,1,1))));
    });
    const kiz=interactables.kizahashi&&interactables.kizahashi.roots[0];
    if(kiz){kiz.updateWorldMatrix(true,true);kiz.children.forEach(c=>{
      if(!c.isMesh||c.material!==MAT.shuDark)return;const hgt=c.geometry.parameters.height;
      const p=new V(0,hgt/2+.04,0).applyMatrix4(new THREE.Matrix4().multiplyMatrices(toWorld,c.matrixWorld));
      (kiz.userData.hallGibo||(kiz.userData.hallGibo=[])).push(new THREE.Matrix4().makeTranslation(p.x,p.y,p.z));
    });}
    const inst=(geo,mat,list,tag)=>{if(!list.length){geo.dispose();return;}const m=new THREE.InstancedMesh(geo,mat,list.length);list.forEach((x,i)=>m.setMatrixAt(i,x));
      m.instanceMatrix.needsUpdate=true;fitDetailInstances(m);m.castShadow=false;m.receiveShadow=true;m.userData.noAutoShadow=true;m.userData.hallDetail=tag;root.add(m);gated.push(m);};
    // 斗束（平桁の上の短い束＋斗）
    const tb={P:[],N:[],U:[],I:[]};
    [[.05,.26,.05,.61],[.11,.045,.09,.758]].forEach(([bx,by,bz,cy])=>{const b=new THREE.BoxGeometry(bx,by,bz);b.translate(0,cy,0);const o=tb.P.length/3,p=b.attributes.position,n=b.attributes.normal,u=b.attributes.uv;
      for(let i=0;i<p.count;i++){tb.P.push(p.getX(i),p.getY(i),p.getZ(i));tb.N.push(n.getX(i),n.getY(i),n.getZ(i));tb.U.push(u.getX(i),u.getY(i));}
      for(let i=0;i<b.index.count;i++)tb.I.push(o+b.index.getX(i));b.dispose();});
    inst(geometry(tb),MAT.shuDark,tsuka,"kouran-tsuka");
    const jg=new THREE.BoxGeometry(1,.07,.12);jg.setAttribute("uv2",jg.attributes.uv);inst(jg,MAT.shuDark,jifuku,"kouran-jifuku");
    if(kiz&&kiz.userData.hallGibo){const kg=gibo.clone();inst(kg,MAT.kin,kiz.userData.hallGibo,"kizahashi-giboshi");}
    stats.rails=rails;stats.tsuka=tsuka.length;
  }

  /* ---------- 築地: 土壁（版築の層・雨だれ・裾の汚れ）と本瓦葺の笠 */
  {
    const TS=P.tex("tsuiji",512),KW=P.tex("kawara",256);
    TEX.tsuiji.image=TS.map.image;TEX.tsuiji.repeat.set(1,1);TEX.tsuiji.needsUpdate=true;
    MAT.tsuiji.bumpMap=TS.data;MAT.tsuiji.bumpScale=.005;MAT.tsuiji.color.setHex(0xffffff);MAT.tsuiji.needsUpdate=true;
    const kawara=snowy(M({map:cloneTex(KW.map,4/1.2,4/.6),bumpMap:KW.data,bumpScale:.006,roughness:.72,vertexColors:true}));kawara.name="hall-kawara";
    const noshi=snowy(M({color:0x55575b,roughness:.7}));noshi.name="hall-noshi";
    const remap=new Map();let caps=0;
    tsuijiRoots.forEach(r=>r.traverse(o=>{
      if(!o.isMesh)return;
      if(o.material===MAT.tsuiji&&o.geometry.parameters){
        const {width:len,height:H,depth:D}=o.geometry.parameters,key=[len,H,D].join(":");
        if(!remap.has(key)){const g=o.geometry.clone(),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
          for(let i=0;i<p.count;i++){const X=p.getX(i),Y=p.getY(i),Z=p.getZ(i);
            if(Math.abs(n.getZ(i))>.5)uv.setXY(i,(X+len/2)/4*Math.sign(n.getZ(i)),1-(H/2-Y)/2.4);
            else if(Math.abs(n.getX(i))>.5)uv.setXY(i,(Z+D/2)/4,1-(H/2-Y)/2.4);
            else uv.setXY(i,X/4,Z/4);}
          uv.needsUpdate=true;remap.set(key,g);}
        swap(o,null,remap.get(key));
      }else if(o.material===MAT.roof&&o.geometry.userData.roofProfile){
        swap(o,kawara);caps++;o.parent.children.forEach(c=>{if(c.isMesh&&c.material===MAT.woodDark)swap(c,noshi);});
      }
    }));
    // 笠の隅に付いた檜皮色の継ぎ目（VISUAL_FINISH の隅棟）は瓦の笠では隠す
    const seams=VISUAL_FINISH&&VISUAL_FINISH.batches&&VISUAL_FINISH.batches.find(m=>m.userData.finishBatch==="roof-hip-seams");
    if(seams&&caps){const mm=new THREE.Matrix4(),pp=new V(),qq=new THREE.Quaternion(),ss=new V();let hidden=0;
      for(let i=0;i<seams.count;i++){seams.getMatrixAt(i,mm);mm.decompose(pp,qq,ss);
        if(pp.y<3.7&&Math.max(Math.abs(pp.x),Math.abs(pp.z))>58){mm.compose(pp,qq,ss.set(0,0,0));seams.setMatrixAt(i,mm);hidden++;}}
      seams.instanceMatrix.needsUpdate=true;stats.capSeams=hidden;}
    stats.caps=caps;
  }

  let batched=0;
  scene.traverse(o=>{if(!o.isInstancedMesh||!o.userData.staticBatch)return;const c=changes.get(o.userData.iid+"|"+o.geometry.uuid+"|"+o.material.uuid);if(!c)return;o.material=c.mat;o.geometry=c.geo;batched++;});
  stats.batched=batched;

  let detailOn=null,lastTime=null;
  function update(){
    const on=!!(GARDEN_POLISH&&GARDEN_POLISH.active);
    if(on!==detailOn){detailOn=on;gated.forEach(m=>m.visible=on);}
    if(APP.time!==lastTime){lastTime=APP.time;MAT.misu.emissiveIntensity={night:.5,dusk:.2,dawn:.06}[APP.time]||0;}
    snow.value=MAT.roof.map===null?1:((typeof VISUAL_EXPERIENCE!=="undefined"&&VISUAL_EXPERIENCE&&VISUAL_EXPERIENCE.snowAmount)||0);
  }
  update();stats.ms=Math.round(performance.now()-t0);
  return {update,root,gated,stats,materials:{shiraki,nokiMat,ridgeMat},get active(){return true;},get detail(){return detailOn;}};
})();
