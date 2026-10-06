/* Shared animation field, bounded surface detail and reusable seasonal resources. */
var VISUAL_EXPERIENCE;
VISUAL_EXPERIENCE=(()=>{
  const wind={direction:new THREE.Vector2(.83,-.56),time:{value:0},strength:{value:0}};
  const amount={value:0},waterSources={value:Array.from({length:8},()=>new THREE.Vector4(999,999,0,0))};
  const pose=new THREE.Object3D(),point=new THREE.Vector3(),local=new THREE.Vector3();
  const detail=new THREE.Group();detail.name="estate-visual-experience";world.add(detail);
  let progress=.5,lastSeason=APP.season,active=true,lastLight="",lastRigRefresh=-Infinity;
  const foliage=[],flowers=[],litBays=[],fish=[],materials=new Set(),originals=new Map();
  function chain(mat,key,fn){
    if(!mat||materials.has(key+mat.id))return;
    materials.add(key+mat.id);const old=mat.onBeforeCompile,cache=mat.customProgramCacheKey();
    mat.onBeforeCompile=s=>{old.call(mat,s);fn(s);};mat.customProgramCacheKey=()=>cache+"-estate-"+key;mat.needsUpdate=true;
  }
  function worldShader(s){
    if(s.vertexShader.includes("varying vec3 vEstateWorld;"))return;
    s.vertexShader="varying vec3 vEstateWorld;\n"+s.vertexShader;
    s.fragmentShader="varying vec3 vEstateWorld;\n"+s.fragmentShader;
    s.vertexShader=s.vertexShader.replace("#include <worldpos_vertex>",`#include <worldpos_vertex>
      vec4 estateWorld=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
      estateWorld=instanceMatrix*estateWorld;
      #endif
      vEstateWorld=(modelMatrix*estateWorld).xyz;`);
  }
  function windy(mat,kind){
    chain(mat,"wind-"+kind,s=>{
      s.uniforms.uEstateWindTime=wind.time;s.uniforms.uEstateWindStrength=wind.strength;
      s.uniforms.uEstateWindDir={value:wind.direction};
      s.vertexShader="uniform float uEstateWindTime,uEstateWindStrength;\nuniform vec2 uEstateWindDir;\n"+s.vertexShader;
      const weight=kind==="cloth"?"(1.0-smoothstep(.20,.70,position.y))*.012":
        kind==="bamboo"?"pow(max(position.y-.3,0.0),2.0)*.0015":"max(position.y+.3,0.0)*.028";
      s.vertexShader=s.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
        vec4 estateWindPos=vec4(position,1.0);
        #ifdef USE_INSTANCING
        estateWindPos=instanceMatrix*estateWindPos;
        #endif
        vec2 estateWindXZ=(modelMatrix*estateWindPos).xz;
        float estateGust=.65+.35*sin(uEstateWindTime*.31);
        float estateWave=sin(dot(estateWindXZ,uEstateWindDir)*.075-uEstateWindTime*.82);
        vec3 estatePush=vec3(uEstateWindDir.x,0.0,uEstateWindDir.y)*(${weight})*estateGust*estateWave*uEstateWindStrength;
        estatePush=vec3(dot(modelMatrix[0].xyz,estatePush)/dot(modelMatrix[0].xyz,modelMatrix[0].xyz),dot(modelMatrix[1].xyz,estatePush)/dot(modelMatrix[1].xyz,modelMatrix[1].xyz),dot(modelMatrix[2].xyz,estatePush)/dot(modelMatrix[2].xyz,modelMatrix[2].xyz));
        #ifdef USE_INSTANCING
        estatePush=vec3(dot(instanceMatrix[0].xyz,estatePush)/max(.0001,dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz)),dot(instanceMatrix[1].xyz,estatePush)/max(.0001,dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz)),dot(instanceMatrix[2].xyz,estatePush)/max(.0001,dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz)));
        #endif
        transformed+=estatePush;`);
    });
  }
  function leafGeometry(maple){
    const p=[],uv=[],indices=[];
    for(let k=0;k<3;k++){
      const angle=(k-1)*.83,co=Math.cos(angle),si=Math.sin(angle),base=p.length/3;
      const pts=maple?[[0,0],[.025,.07],[.15,.05],[.10,.14],[.22,.18],[.13,.21],[.17,.34],[.07,.28],[0,.46],[-.07,.28],[-.17,.34],[-.13,.21],[-.22,.18],[-.10,.14],[-.15,.05],[-.025,.07]]:
        [[0,0],[.065,.06],[.115,.14],[.13,.23],[.09,.34],[0,.44],[-.09,.34],[-.13,.23],[-.115,.14],[-.065,.06]];
      // A folded central vein gives glossy evergreen leaves a visible change of normal.
      p.push(0,.18,.035);uv.push(.5,.45);
      pts.forEach(([x,y])=>{const z=.04+Math.sin(y*6)*.05;p.push(co*x+si*z,y,-si*x+co*z);uv.push(x*.9+.5,y*2.0);});
      for(let j=0;j<pts.length;j++)indices.push(base,base+1+j,base+1+(j+1)%pts.length);
    }
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(p,3));
    g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));g.setAttribute("color",new THREE.Float32BufferAttribute(new Float32Array(p.length).fill(1),3));
    g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();g.userData.estateLeaf=maple?"palmate":"elliptic";return g;
  }
  const mapleGeo=leafGeometry(true),camelliaGeo=leafGeometry(false);
  const leafMat=M({color:0x496337,roughness:.36,metalness:.01,side:THREE.DoubleSide,envMapIntensity:.35});
  const mapleMat=M({color:0x678c38,roughness:.78,side:THREE.DoubleSide});
  if(APP.map!=="kamakura"){
    const trees=[...SEASONAL.maples,...SEASONAL.tsubaki.map(t=>t.tree)];
    trees.forEach((r,i)=>{
      const maple=SEASONAL.maples.includes(r);r.userData.treeSpecies=maple?"maple":"camellia";
      if(i===0||i===SEASONAL.maples.length){r.getWorldPosition(point);register(r,maple?"kaede":"tsubaki",point.clone().add(new THREE.Vector3(0,2.4,0)));}
      const sprig=r.userData.foliage?.find(m=>m.geometry.index?.count===36);
      if(sprig){
        const tips=r.userData.crownTips||[],count=tips.length*(maple?28:24);
        const leaves=new THREE.InstancedMesh(maple?mapleGeo:camelliaGeo,maple?mapleMat:leafMat,count);
        let n=0;
        tips.forEach((tip,j)=>{for(let k=0;k<(maple?28:24);k++){
          const a=k*2.399+j*.73,v=1-2*(k+.5)/(maple?28:24),rad=Math.sqrt(1-v*v),reach=tip.radius*(.87+.15*(k%3));
          pose.position.set(tip.pos[0]+Math.cos(a)*rad*reach,tip.pos[1]+v*reach*.77,tip.pos[2]+Math.sin(a)*rad*reach);
          pose.rotation.set(.32*Math.sin(a),a,(k%3-1)*.28);pose.scale.setScalar(Math.max(.42,tip.radius*.71));pose.updateMatrix();leaves.setMatrixAt(n++,pose.matrix);
        }});
        leaves.instanceMatrix.needsUpdate=true;leaves.userData.estateLeaves=true;markFoliageNoShadow(leaves);fitDetailInstances(leaves);r.add(leaves);
        // Old private winter references remain harmless; the current crown uses this denser shared batch.
        sprig.count=0;sprig.visible=false;r.userData.foliage=r.userData.foliage.map(m=>m===sprig?leaves:m);
      }
      (r.userData.foliage||[]).forEach(m=>{
        if(!m.userData.estateLeaves&&m.isInstancedMesh)originals.set(m,m.instanceMatrix.array.slice());
        foliage.push({mesh:m,maple,index:i});windy(m.material,"leaf");
      });
    });
    // Shared leaf geometry needs a union of every owner's instance bounds in r128.
    for(const geo of [mapleGeo,camelliaGeo]){
      geo.computeBoundingBox();const base=geo.boundingBox.clone(),all=new THREE.Box3().makeEmpty(),part=new THREE.Box3(),matrix=new THREE.Matrix4();
      foliage.filter(f=>f.mesh.geometry===geo).forEach(({mesh})=>{for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);all.union(part.copy(base).applyMatrix4(matrix));}});
      if(!all.isEmpty())geo.boundingSphere=all.getBoundingSphere(new THREE.Sphere());
    }
    // Needles retain narrow paired blades at every branch tip instead of broad generic leaflets.
    scene.traverse(o=>{if(o.userData.pineNeedles){windy(o.material,"leaf");o.userData.estateLeaves=true;}});
    VISUAL_FINISH.batches.forEach(m=>{if(m.userData.finishBatch==="ground-sprigs")windy(m.material,"grass");});
    interactables.take?.roots.forEach(r=>r.traverse(m=>{if(m.isMesh&&m.material)windy(m.material,"bamboo");}));
    for(const mat of HEIAN_MATS.values())windy(mat,"cloth");
    for(const r of [...SEASONAL.sakura,...SEASONAL.ume,SEASONAL.tsubakiFlowers].filter(Boolean))r.traverse(m=>{
      if(!m.isInstancedMesh||!m.material)return;
      originals.set(m,m.instanceMatrix.array.slice());flowers.push(m);
    });
    for(let i=0;i<gimmicks.shitomi.length;i++){
      const st=gimmicks.shitomi[i],misu=gimmicks.misu[i];st.root.updateWorldMatrix(true,false);
      const box=new THREE.Box3().setFromObject(st.root),width=Math.min(4.6,box.getSize(new THREE.Vector3()).length());
      litBays.push({st,misu,width,index:i,matrix:st.root.matrixWorld.clone(),floor:SH.f2||1.3});
    }
  }
  const apertureTex=canv(128,128,(c,w,h)=>{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(255,255,255,.0)");g.addColorStop(.2,"rgba(255,255,255,.5)");g.addColorStop(.9,"rgba(255,255,255,.7)");g.addColorStop(1,"rgba(255,255,255,0)");c.fillStyle=g;c.fillRect(0,0,w,h);
    c.globalCompositeOperation="destination-out";for(let x=0;x<w;x+=19){c.fillStyle="rgba(0,0,0,.22)";c.fillRect(x,0,3,h);}
  });
  let floorLight,wallShade;
  if(litBays.length){
    floorLight=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:apertureTex,color:0xf4dba3,transparent:true,opacity:.38,depthWrite:false,blending:THREE.AdditiveBlending}),litBays.length);
    wallShade=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:apertureTex,color:0x19201d,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide}),litBays.length);
    [floorLight,wallShade].forEach(m=>{m.userData.noAutoShadow=true;m.frustumCulled=false;detail.add(m);});
  }
  function lightUpdate(){
    const daylight=APP.time==="day"?1:APP.time==="dawn"||APP.time==="dusk"?.42:0;
    const stamp=daylight+":"+litBays.map(b=>b.st.t.toFixed(2)+","+b.misu?.t.toFixed(2)).join(";");
    if(stamp===lastLight)return;lastLight=stamp;
    litBays.forEach((b,i)=>{
      const open=.08+.92*b.st.t*(.18+.82*(b.misu?.t||0));
      pose.position.set(0,b.floor+.018,-1.72);pose.rotation.set(-Math.PI/2,0,0);pose.scale.set(b.width*.72,3.3,1);pose.updateMatrix();
      floorLight.setMatrixAt(i,b.matrix.clone().multiply(pose.matrix));floorLight.setColorAt(i,new THREE.Color().setScalar(open*daylight));
      pose.position.set(0,b.floor+1.16,-2.22);pose.rotation.set(0,0,0);pose.scale.set(b.width*.72,1.6*(1-open),1);pose.updateMatrix();wallShade.setMatrixAt(i,b.matrix.clone().multiply(pose.matrix));
    });
    if(floorLight){floorLight.instanceMatrix.needsUpdate=true;floorLight.instanceColor.needsUpdate=true;wallShade.instanceMatrix.needsUpdate=true;floorLight.visible=active&&daylight>0;wallShade.visible=active&&daylight>0;}
  }
  // World coordinates keep procedural bottom stones and local wave rings identical on every pond patch.
  chain(MAT.water,"shallows",s=>{
    s.uniforms.uEstateWaterSources=waterSources;s.uniforms.uEstateWindTime=wind.time;s.uniforms.uEstateWindStrength=wind.strength;s.uniforms.uEstateWindDir={value:wind.direction};
    s.fragmentShader="uniform vec4 uEstateWaterSources[8];\nuniform float uEstateWindTime,uEstateWindStrength;\nuniform vec2 uEstateWindDir;\n"+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
      for(int estateI=0;estateI<8;estateI++){
        vec2 delta=vGardenWorld.xz-uEstateWaterSources[estateI].xy;float dist=length(delta);
        float wave=cos(dist*16.0-uEstateWindTime*2.7+uEstateWaterSources[estateI].w)*exp(-dist*2.7)*uEstateWaterSources[estateI].z;
        normal=normalize(normal+mat3(viewMatrix)*vec3(delta.x,0.0,delta.y)/(dist+.04)*wave*.025*uEstateWindStrength);
      }`);
    s.fragmentShader=s.fragmentShader.replace("vec2(.72,.46)","uEstateWindDir");
    s.fragmentShader=s.fragmentShader.replace("outgoingLight*=waterTone;",`outgoingLight*=waterTone;
      float shore=1.0-smoothstep(.60,.92,length((vGardenWorld.xz-vec2(-6.0,39.0))/vec2(31.0,19.0)));
      vec2 pebbleCell=vGardenWorld.xz*3.7;vec2 pebbleId=floor(pebbleCell);vec2 pebble=fract(pebbleCell)-.5;
      float pebbleTone=.5+.5*sin(dot(pebbleId,vec2(13.7,37.3)));
      float stone=smoothstep(.46,.27,length(pebble))*mix(.80,1.1,pebbleTone);
      outgoingLight=mix(outgoingLight,outgoingLight*vec3(.82+stone*.25,.88+stone*.13,.83+stone*.12),(1.0-shore)*.38);`);
  });
  for(const b of waterBirds.filter(b=>b.kind==="koi")){
    const body=b.g.children.find(m=>m.isMesh&&m.material.map&&m.material.alphaTest===.5);if(!body)continue;
    const depth={value:.25},phase={value:0};body.userData.waterDepth=.25;
    chain(body.material,"fish-depth",s=>{
      s.uniforms.uEstateFishDepth=depth;s.uniforms.uEstateFishTime=phase;
      s.fragmentShader="uniform float uEstateFishDepth,uEstateFishTime;\n"+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace("#include <map_fragment>",THREE.ShaderChunk.map_fragment.replace(/\bvUv\b/g,"(vUv+vec2(sin(vUv.y*12.0+uEstateFishTime)*.006,0.0))"));
      s.fragmentShader=s.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.21,.43,.41),.22+uEstateFishDepth*.48);
        diffuseColor.rgb*=.90-uEstateFishDepth*.23;`);
    });fish.push({b,body,depth,phase});
  }
  function snowShader(mat,roof){
    chain(mat,"seasonal-snow",s=>{
      worldShader(s);s.uniforms.uEstateSnow=amount;
      if(roof){
        s.vertexShader="uniform float uEstateSnow;\n"+s.vertexShader;
        s.vertexShader=s.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
          transformed+=normal*.035*uEstateSnow*smoothstep(.32,.85,normal.y);`);
      }
      s.fragmentShader="uniform float uEstateSnow;\n"+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
        float estateUp=smoothstep(.26,.80,dot(normalize(normal),normalize(mat3(viewMatrix)*vec3(0.0,1.0,0.0))));
        float estateShade=.84+.16*sin(vEstateWorld.z*.11);
        ${roof?"":"float estateShelter=(1.0-step(14.0,abs(vEstateWorld.x)))*(1.0-step(9.0,abs(vEstateWorld.z)));estateShade*=1.0-estateShelter;"}
        float estateSnow=estateUp*clamp(uEstateSnow*estateShade,0.0,1.0);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.90,.94),estateSnow);
        roughnessFactor=mix(roughnessFactor,1.0,estateSnow);`);
    });
  }
  snowShader(MAT.roof,true);snowShader(MAT.grass,false);snowShader(leafMat,true);if(MAT.grassGround)snowShader(MAT.grassGround,false);
  chain(MAT.roof,"bark-courses",s=>{
    s.fragmentShader=s.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
      float estateRoofNear=1.0-smoothstep(7.0,13.0,distance(cameraPosition,vEstateWorld));
      float estateRoofUp=abs(dot(normalize(normal),normalize(mat3(viewMatrix)*vec3(0.0,1.0,0.0))));
      float estateRoofCourse=mod(vEstateWorld.y/max(.20,sqrt(max(.0,1.0-estateRoofUp*estateRoofUp))),.16);
      float estateRoofSeam=1.0-smoothstep(.002,.010,estateRoofCourse);
      diffuseColor.rgb*=1.0-estateRoofSeam*.10*estateRoofNear;
      roughnessFactor=clamp(roughnessFactor+estateRoofSeam*.04*estateRoofNear,.08,1.0);`);
  });
  const surfaceMaterials=[MAT.wood,MAT.woodDark,MAT.floor,MAT.sunoko,MAT.kin,MAT.black].filter(Boolean);
  surfaceMaterials.forEach(mat=>chain(mat,"material-scale",s=>{
    worldShader(s);s.fragmentShader=s.fragmentShader.replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
      float estateNear=1.0-smoothstep(7.0,13.0,distance(cameraPosition,vEstateWorld));
      float estateFine=sin(vEstateWorld.x*65.0+sin(vEstateWorld.z*21.0))*sin(vEstateWorld.y*38.0);
      roughnessFactor=clamp(roughnessFactor+estateFine*.024*estateNear,.08,1.0);
      ${mat===MAT.kin?"float estateWear=.5+.5*sin(dot(vEstateWorld,vec3(27.0,31.0,19.0)));roughnessFactor+=estateWear*.09*estateNear;diffuseColor.rgb*=1.0-estateWear*.065*estateNear;":""}
      ${mat===MAT.floor||mat===MAT.sunoko?"float estateJoint=1.0-smoothstep(.0,.012,min(fract(vEstateWorld.z/.30),1.0-fract(vEstateWorld.z/.30))*.30);diffuseColor.rgb*=1.0-estateJoint*.08*estateNear;":""}`);
  }));
  if(MAT.black){MAT.black.roughness=.24;MAT.black.envMapIntensity=.85;}
  function season(key){lastSeason=key;progress=.5;setProgress(.5);}
  function setProgress(value){
    progress=THREE.MathUtils.clamp(Number(value)||0,0,1);
    const k=APP.season;
    amount.value=k==="winter"?THREE.MathUtils.smoothstep(progress,0,.25)*(1-.72*THREE.MathUtils.smoothstep(progress,.58,1)):0;
    if(VISUAL_FINISH.setSnowAmount)VISUAL_FINISH.setSnowAmount(amount.value);
    // Keep bark texture beneath the snow mask; neither season controls creates a new GPU resource.
    if(k==="winter"){MAT.roof.map=TEX.roof;MAT.roof.color.setHex(0xffffff);MAT.grass.map=TEX.grass;MAT.grass.color.setHex(SEASONS.summer.grass);}
    MAT.roof.needsUpdate=true;MAT.grass.needsUpdate=true;
    foliage.forEach(({mesh,maple,index})=>{
      if(!mesh.userData.estateLeaves&&originals.has(mesh)){
        const matrix=new THREE.Matrix4(),scale=new THREE.Vector3().setScalar(maple&&k==="winter"?.20:.76),original=originals.get(mesh);
        for(let i=0;i<mesh.count;i++){matrix.fromArray(original,i*16);matrix.scale(scale);mesh.setMatrixAt(i,matrix);}mesh.instanceMatrix.needsUpdate=true;
      }
      if(!maple){if(mesh.userData.estateLeaves)mesh.material=leafMat;return;}
      if(mesh.userData.estateLeaves){mesh.material=mapleMat;mesh.visible=k!=="winter";}
      const col=new THREE.Color(k==="autumn"?0x668d3c:(SEASONS[k].maple||SEASONS[k].leaf));
      if(k==="autumn")col.lerp(new THREE.Color(0xd74222),THREE.MathUtils.clamp(progress*1.2+.045*(index%3-1),0,1));
      mesh.material.color.copy(col);
      if(mesh.isInstancedMesh){for(let i=0;i<mesh.count;i++)mesh.setColorAt(i,new THREE.Color().setScalar(.87+.13*((i*7+index)%11)/10));mesh.instanceColor.needsUpdate=true;}
    });
    flowers.forEach(m=>{
      const original=originals.get(m),matrix=new THREE.Matrix4(),scale=new THREE.Vector3();
      for(let i=0;i<m.count;i++){
        const p=THREE.MathUtils.clamp(progress*1.7-(i%5)*.13,.08,1);
        matrix.fromArray(original,i*16);scale.setScalar(APP.season==="spring"?p:1);matrix.scale(scale);m.setMatrixAt(i,matrix);
      }m.instanceMatrix.needsUpdate=true;
    });
    const input=document.getElementById("seasonProgress");if(input)input.value=Math.round(progress*100);
    const label=document.getElementById("seasonProgressLabel");if(label)label.textContent=k==="winter"?(progress<.25?"降り始め":progress>.65?"融け残り":"積雪"):
      k==="autumn"?(progress<.3?"色付き始め":progress>.7?"紅葉の盛り":"色付き途中"):
      k==="spring"?(progress<.3?"咲き始め":progress>.7?"満開":"開花途中"):"葉が茂る頃";
  }
  function expressions(t,on){
    if(t-lastRigRefresh>.5||t<lastRigRefresh){
      const current=[];scene.traverse(o=>{if(o.userData.heianFigure){const rig=HEIAN_EXPRESSION_REGISTRY.get(o);if(rig)current.push(rig);}});
      HEIAN_EXPRESSIONS=current;lastRigRefresh=t;
    }
    for(let i=HEIAN_EXPRESSIONS.length-1;i>=0;i--){
      const r=HEIAN_EXPRESSIONS[i];
      let root=r.g;while(root.parent)root=root.parent;
      if(root!==scene){if(!r.g.parent)continue;continue;}
      const near=isObjVisible(r.g)&&r.g.getWorldPosition(point).distanceTo(camera.position)<14;
      r.face.visible=r.eyes.visible=near&&(r.detail.visible||APP.mode==="kaimami");
      const motion=on&&near;
      const blink=(t+r.phase)%5.4;const openness=motion&&blink<.19?Math.max(.10,Math.abs(blink-.095)/.095):1;r.eyes.scale.y=openness;
      r.g.worldToLocal(local.copy(camera.position));const front=local.z>0&&Math.abs(local.x)<5;
      r.head.rotation.y=motion&&front?THREE.MathUtils.clamp(Math.atan2(local.x,local.z)*.22,-.075,.075):0;
      const nod=Math.max(0,Math.sin(t*.71+r.phase)-.93);
      r.head.rotation.x=motion?nod*.42:0;r.eyes.position.x=motion&&front?THREE.MathUtils.clamp(local.x*.0025,-.006,.006):0;
      if(r.held){r.held.rotation.x=r.heldX+(motion?.018*Math.sin(t*.85+r.phase):0);r.held.rotation.z=r.heldZ+(motion?.012*Math.sin(t*.71+r.phase):0);}
    }
  }
  function update(t){
    active=APP.map!=="kamakura"&&GARDEN_POLISH.active;detail.visible=active;
    const motion=active&&!REDUCED_MOTION&&APP.mode!=="title";
    wind.time.value=motion?t:0;wind.strength.value=motion?1:0;
    if(APP.season!==lastSeason)season(APP.season);
    expressions(t,motion);lightUpdate();
    gimmicks.misu.forEach(st=>{const v=sample(st.root.position.x,st.root.position.z,t);st.pivot.rotation.x=st.up||!motion?0:v*.030;});
    (SEASONAL.fuji||[]).forEach(r=>{r.rotation.z=motion?sample(r.position.x,r.position.z,t)*.008:0;});
    const sources=waterSources.value;let used=0;
    for(const b of waterBirds){if(b.kind!=="duck"||!isObjVisible(b.g)||used>=3)continue;sources[used++].set(b.g.position.x,b.g.position.z,1,b.phase);}
    if(tourouGroup.visible)for(const l of tourouGroup.userData.lanterns){if(used>=8)break;sources[used++].set(l.lg.position.x,l.lg.position.z,.55,l.lg.userData.phase);}
    while(used<8)sources[used++].set(999,999,0,0);
    fish.forEach(({b,body,depth,phase},i)=>{
      const d=.24+.11*Math.sin((motion?t:0)*.34+i*1.6);depth.value=d;phase.value=motion?t:0;body.userData.waterDepth=d;
      // The opaque surface uses a depth-tinted refracted cutout, preserving pond-patch continuity.
      body.position.y=-.015;body.scale.set(1-d*.15,1-d*.15,1);body.position.x=motion?Math.sin(t*.82+i)*.008:0;
      if(b.g.userData.ripple)b.g.userData.ripple.visible=active;
    });
  }
  function sample(x,z,t){return Math.sin((x*wind.direction.x+z*wind.direction.y)*.075-t*.82)*(.65+.35*Math.sin(t*.31));}
  season(APP.season);update(0);
  return {update,season,setProgress,sample,wind,detail,foliage,flowers,fish,litBays,floorLight,wallShade,
    get progress(){return progress;},get snowAmount(){return amount.value;},get active(){return active;}};
})();
