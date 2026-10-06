/* 残件一覧の仕上げ。外部素材・追加レンダーパスを使わず、季節変更では資源を作り直さない。 */
VISUAL_FINISH=(()=>{
  if(APP.map==="kamakura")return {update(){},season(){},active:false};
  const detailRoot=new THREE.Group();detailRoot.name="estate-visual-finish";world.add(detailRoot);
  const batches=[],winterBatches=[],lampBatches=[],distantMaterials=[];
  const pose=new THREE.Object3D(),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  const snow={value:0};let active=null,lastSeason=null,lastTime=null;
  let seed=0x4f637406;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const range=(a,b)=>a+(b-a)*random();
  // Feathered mask is shared by moss and settled snow, avoiding hard circular ground decals.
  const edgeMask=canv(64,64,(ctx,w,h)=>{
    const g=ctx.createRadialGradient(w/2,h/2,w*.15,w/2,h/2,w*.5);
    g.addColorStop(0,"#fff");g.addColorStop(.65,"#ccc");g.addColorStop(1,"#000");
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  });

  function batch(geo,mat,items,tag,parent=detailRoot){
    if(!items.length){geo.dispose();return null;}
    const mesh=new THREE.InstancedMesh(geo,mat,items.length);
    items.forEach((item,i)=>{
      pose.position.set(...item.p);pose.rotation.set(...(item.r||[0,0,0]));pose.scale.set(...(item.s||[1,1,1]));pose.updateMatrix();
      mesh.setMatrixAt(i,item.matrix||pose.matrix);
      if(item.color)mesh.setColorAt(i,item.color);
    });
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    fitDetailInstances(mesh);mesh.receiveShadow=true;mesh.castShadow=false;
    mesh.userData.noAutoShadow=true;mesh.userData.finishBatch=tag;parent.add(mesh);batches.push(mesh);return mesh;
  }

  // Snow follows the world-space upward normal. Undersides, vertical bark and rock faces retain their material.
  function snowy(mat){
    if(!mat||mat.userData.finishSnow)return;
    const previous=mat.onBeforeCompile,previousKey=mat.customProgramCacheKey();
    mat.onBeforeCompile=shader=>{
      previous.call(mat,shader);shader.uniforms.uFinishSnow=snow;
      shader.fragmentShader="uniform float uFinishSnow;\n"+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
        float facingSnow=smoothstep(.34,.82,dot(normalize(normal),normalize(mat3(viewMatrix)*vec3(0.0,1.0,0.0))));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.85,.89,.94),facingSnow*uFinishSnow*.94);`);
    };
    mat.customProgramCacheKey=()=>previousKey+"-finish-snow-v1";
    mat.userData.finishSnow=true;mat.needsUpdate=true;
  }
  [MAT.trunk,MAT.stone,MAT.pine,MAT.pineDark,MAT.leaf,MAT.leaf2,MAT.momijiGreen,MAT.momijiRed].forEach(snowy);

  // Preserve the original matrix values so all four seasons round-trip exactly.
  const winterFoliage=[];
  SEASONAL.maples.forEach(root=>(root.userData.foliage||[]).forEach(mesh=>{
    if(!mesh.isInstancedMesh)return;
    const original=mesh.instanceMatrix.array.slice();winterFoliage.push({mesh,original,sprigs:mesh.geometry.index?.count===36});
  }));

  // A single batch for all hip seams, fitted to the same curved roof profile as the roof shell.
  scene.updateMatrixWorld(true);
  const hipItems=[];
  scene.traverse(mesh=>{
    const p=mesh.geometry?.userData.roofProfile;if(!p||mesh.material!==MAT.roof)return;
    const {w,d,h,sag,lift}=p,hw=w/2,hd=d/2;
    // The actual ridge endpoints are read from the geometry, retaining narrow-roof proportions.
    const positions=mesh.geometry.attributes.position;let ridge=0;
    for(let i=0;i<positions.count;i++)if(Math.abs(positions.getY(i)-h)<.0001)ridge=Math.max(ridge,Math.abs(positions.getX(i)));
    for(const sx of [-1,1])for(const sz of [-1,1])for(let part=0;part<4;part++){
      const at=t=>new THREE.Vector3(sx*(hw*(1-t)+ridge*t),h*t-sag*Math.sin(Math.PI*t)+lift*Math.pow(1-t,4)+.035,sz*hd*(1-t));
      const a=at(part/4),b=at((part+1)/4),dir=b.clone().sub(a);
      pose.position.copy(a).add(b).multiplyScalar(.5);pose.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir.clone().normalize());
      pose.scale.set(Math.min(.15,w*.018),.045,dir.length()+.025);pose.updateMatrix();
      hipItems.push({p:[0,0,0],matrix:mesh.matrixWorld.clone().multiply(pose.matrix)});
    }
  });
  const seamMat=M({map:TEX.roof,color:0x655040,roughness:.94});snowy(seamMat);
  batch(new THREE.BoxGeometry(1,1,1),seamMat,hipItems,"roof-hip-seams");

  // Broken-up planting pockets. The ritual white-sand court, carriage lane and bridge approaches stay open.
  const pockets=[[-22,16,3.3,2.2],[22,17,3.8,2.0],[-28,23,2.7,1.8],[27,25,3.0,1.8],
    [-46,-23,2.0,3.4],[47,-23,1.8,3.0],[-44,43,3.1,2.2],[26,43,2.4,2.0],[-15,-49,3.0,1.4],[17,-49,2.8,1.5]];
  function laneDistance(x,z){
    let distance=Infinity;
    const route=GISSHA_YARD.carryRoute||[];
    for(let i=1;i<route.length;i++){
      const a=route[i-1],b=route[i],dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
      const t=den?THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/den,0,1):0;
      distance=Math.min(distance,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));
    }return distance;
  }
  function placeClear(x,z){
    if(Math.abs(x)>56||Math.abs(z)>56||inPond(x,z)||groundH(x,z)>.15||laneDistance(x,z)<3.55)return false;
    if(Math.abs(x)<7&&z>6&&z<30)return false;
    return !BRIDGES.some(b=>Math.min(Math.hypot(x-b.x1,z-b.z1),Math.hypot(x-b.x2,z-b.z2))<3.3);
  }
  const grassItems=[],rockItems=[],mossItems=[],snowItems=[];
  pockets.forEach(([cx,cz,rx,rz],index)=>{
    for(let i=0;i<32;i++){
      const a=range(0,Math.PI*2),r=Math.sqrt(random()),x=cx+Math.cos(a)*rx*r,z=cz+Math.sin(a)*rz*r;
      if(!placeClear(x,z))continue;
      const h=range(.12,.42);
      grassItems.push({p:[x,.018,z],r:[0,range(0,6.28),range(-.13,.13)],s:[h*.50,h,h*.50]});
      if(i%8===0){const size=range(.18,.38);rockItems.push({p:[x,.019+size*.20,z],r:[0,range(0,6.28),0],s:[size,size*.36,size*.77]});}
      if(i%6===0)mossItems.push({p:[x,.014,z],r:[-Math.PI/2,0,range(0,6.28)],s:[range(.25,.59),range(.21,.48),1]});
    }
  });
  const grassMat=M({color:0x607349,roughness:.94,side:THREE.DoubleSide});snowy(grassMat);
  const grass=batch(BROADLEAF_SPRIG_GEO.clone(),grassMat,grassItems,"ground-sprigs");
  batch(gardenRockGeo(1,3),MAT.stone,rockItems,"ground-rocks");
  const mossMat=M({map:TEX.grass,alphaMap:edgeMask,color:0x6d7852,roughness:1,transparent:true,depthWrite:false,alphaTest:.04});snowy(mossMat);
  batch(new THREE.CircleGeometry(1,9),mossMat,mossItems,"moss-pockets");
  const roots=[...SEASONAL.miscTrees,...SEASONAL.maples,...SEASONAL.tsubaki.map(t=>t.tree)];
  roots.forEach((root,index)=>{
    const x=root.position.x,z=root.position.z;
    for(let i=0;i<3;i++){
      const px=x+Math.sin(index*1.7+i*2.1)*.52,pz=z+Math.cos(index*2.3+i*1.7)*.47;
      if(inPond(px,pz)||groundH(px,pz)>.15)continue;
      snowItems.push({p:[px,.027,pz],r:[-Math.PI/2,0,index+i],s:[.48+i*.13,.40+i*.09,1]});
    }
  });
  const snowMat=M({map:TEX.snowSurf,alphaMap:edgeMask,color:0xe5e9ee,roughness:1,transparent:true,depthWrite:false,alphaTest:.04});
  const rootSnow=batch(new THREE.CircleGeometry(1,11),snowMat,snowItems,"root-snow");if(rootSnow)winterBatches.push(rootSnow);

  // Texture and gentle bottom shading give plaster depth without extra geometry or lights.
  MAT.plaster.color.setHex(0xeae1cf);
  const plasterCompile=MAT.plaster.onBeforeCompile,plasterKey=MAT.plaster.customProgramCacheKey();
  MAT.plaster.onBeforeCompile=shader=>{
    plasterCompile.call(MAT.plaster,shader);
    shader.vertexShader="varying vec3 vFinishWallWorld;\n"+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace("#include <worldpos_vertex>",`#include <worldpos_vertex>
      vec4 finishWallPos=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
      finishWallPos=instanceMatrix*finishWallPos;
      #endif
      vFinishWallWorld=(modelMatrix*finishWallPos).xyz;`);
    shader.fragmentShader="varying vec3 vFinishWallWorld;\n"+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
      float wallShade=.87+.13*smoothstep(.9,3.5,vFinishWallWorld.y);
      diffuseColor.rgb*=vec3(wallShade,wallShade*.99,wallShade*.96);`);
  };
  MAT.plaster.customProgramCacheKey=()=>plasterKey+"-finish-wall-v1";MAT.plaster.needsUpdate=true;

  const poolTex=canv(96,96,(ctx,w,h)=>{
    const g=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
    g.addColorStop(0,"rgba(255,255,255,.65)");g.addColorStop(.35,"rgba(255,255,255,.25)");g.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  });
  const lampItems=[];gimmicks.lamps.forEach(l=>{
    const root=l.g||l.group||l.mesh;if(!root)return;
    root.getWorldPosition(point);lampItems.push({p:[point.x,groundH(point.x,point.z)+.016,point.z],r:[-Math.PI/2,0,0],s:[2.8,2.8,1],lamp:l});
  });
  const lampMat=new THREE.MeshBasicMaterial({map:poolTex,color:0xe6a34f,transparent:true,opacity:.24,depthWrite:false,blending:THREE.AdditiveBlending});
  const lampPool=batch(new THREE.PlaneGeometry(1,1),lampMat,lampItems,"lamp-floor-spill");if(lampPool)lampBatches.push(lampPool);
  const contactItems=[];
  [...people].forEach(({g})=>{g.getWorldPosition(point);contactItems.push({p:[point.x,point.y+.009,point.z-.12],r:[-Math.PI/2,0,0],s:[1.4,1.25,1]});});
  const contactMat=new THREE.MeshBasicMaterial({map:poolTex,color:0x312719,transparent:true,opacity:.37,depthWrite:false});
  batch(new THREE.PlaneGeometry(1,1),contactMat,contactItems,"seated-contact-shadows");
  const wheelContacts=GISSHA_YARD.cart.userData.drive.wheels.map(w=>({p:[w.position.x,.012,w.position.z],r:[-Math.PI/2,0,0],s:[.9,1.3,1]}));
  batch(new THREE.PlaneGeometry(1,1),contactMat,wheelContacts,"carriage-wheel-contact",GISSHA_YARD.cart);

  // Layered hills sit outside the boundary, with their own silhouettes and time-dependent haze colors.
  for(let layer=0;layer<3;layer++){
    const pos=[],indices=[],N=100,radius=104+layer*38;
    for(let i=0;i<=N;i++){
      const a=i/N*Math.PI*2,x=Math.cos(a)*radius,z=Math.sin(a)*radius;
      const peak=8+layer*5+7*Math.sin(a*3+layer*1.5)+3.1*Math.sin(a*7+layer*.8)+1.2*Math.sin(a*17+layer);
      pos.push(x,-4,z,x,Math.max(3,peak),z);
      if(i<N){const k=i*2;indices.push(k,k+1,k+2,k+2,k+1,k+3);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();
    const mat=new THREE.MeshBasicMaterial({color:0x9daeb3,side:THREE.DoubleSide,fog:true});distantMaterials.push(mat);
    const mesh=new THREE.Mesh(geo,mat);mesh.userData.noAutoShadow=true;mesh.userData.finishBatch="distant-hills";detailRoot.add(mesh);batches.push(mesh);
  }

  function season(key){
    const winter=key==="winter";snow.value=winter?1:0;lastSeason=key;
    // Keep living green needles beneath upward-facing snow rather than whitening every face.
    const pinePalette=key==="winter"||key==="autumn"?SEASONS.summer:SEASONS[key];
    MAT.pine.color.setHex(pinePalette.pine);MAT.pineDark.color.setHex(pinePalette.pineDark);
    MAT.pine.map=MAT.pineDark.map=TEX.leaves;paintPinePads("summer");
    MAT.leaf2.color.setHex(winter?0x536345:0x536d3d);
    winterFoliage.forEach(({mesh,original,sprigs})=>{
      mesh.instanceMatrix.array.set(original);mesh.visible=!winter||!sprigs;
      if(winter&&!sprigs){
        for(let i=0;i<mesh.count;i++){
          matrix.fromArray(original,i*16);matrix.scale(new THREE.Vector3(.24,.24,.24));mesh.setMatrixAt(i,matrix);
        }
      }mesh.instanceMatrix.needsUpdate=true;
    });
    grassMat.color.setHex({spring:0x6e8051,summer:0x526c3e,autumn:0x9b8459,winter:0x8e917f}[key]);
    winterBatches.forEach(m=>m.visible=active&&winter);
  }
  const hillColor=new THREE.Color(),fogColor=new THREE.Color();let lampState="";
  function update(t){
    const on=GARDEN_POLISH.active;
    if(on!==active){active=on;batches.forEach(m=>m.visible=on);lastTime=null;}
    if(APP.season!==lastSeason)season(APP.season);
    winterBatches.forEach(m=>m.visible=on&&APP.season==="winter");
    const night=APP.time==="night"||APP.time==="dusk";
    lampBatches.forEach(m=>m.visible=on&&night);
    const lit=lampItems.map(item=>item.lamp.lit?"1":"0").join("");
    if(lampPool&&lit!==lampState){
      lampState=lit;lampItems.forEach((item,i)=>{
        pose.position.set(...item.p);pose.rotation.set(...item.r);pose.scale.setScalar(item.lamp.lit?2.8:0);pose.updateMatrix();lampPool.setMatrixAt(i,pose.matrix);
      });lampPool.instanceMatrix.needsUpdate=true;
    }
    if(APP.time!==lastTime){
      const color={day:0x738878,dawn:0x9991a6,dusk:0x978177,night:0x243146}[APP.time]||0x738878;
      distantMaterials.forEach((mat,i)=>{hillColor.setHex(color);fogColor.setHex(TIMES[APP.time].fog);mat.color.copy(hillColor).lerp(fogColor,.30+i*.20);});
      lastTime=APP.time;
    }
  }
  season(APP.season);update(0);
  return {update,season,setSnowAmount(v){snow.value=THREE.MathUtils.clamp(v,0,1);},detailRoot,batches,winterBatches,lampBatches,grassItems,rockItems,placeClear,
    get active(){return active;},get snowStrength(){return snow.value;}};
})();
