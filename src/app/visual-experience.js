/* Single leaves share a shoot origin with their petioles and branch. No detached leaf shell. */
var ESTATE_FOLIAGE;
ESTATE_FOLIAGE=(()=>{
  const geometries=new Map(),up=new THREE.Vector3(0,1,0);
  // TSURE_TREES' terminal sprays are the model: opposite maple leaves with deep,
  // lanceolate lobes, growing from a twig rather than a spherical sampling shell.
  const mapleAngles=[-2.05,-1.36,-.68,0,.68,1.36,2.05],mapleLengths=[.50,.80,.95,1,.95,.80,.50];
  const mapleOutline=[[0,0]];
  mapleAngles.forEach((a,i)=>{
    const length=.46*mapleLengths[i],sx=Math.sin(a),sy=Math.cos(a),width=length*.12;
    mapleOutline.push([sx*length*.62-sy*width,.095+sy*length*.62+sx*width],
      [sx*length,.095+sy*length],[sx*length*.62+sy*width,.095+sy*length*.62-sx*width]);
    if(i<6){const gap=(a+mapleAngles[i+1])*.5;mapleOutline.push([Math.sin(gap)*.105,.095+Math.cos(gap)*.105]);}
  });
  const outlines={
    palmate:mapleOutline,
    elliptic:[[0,0],[.05,.035],[.09,.095],[.12,.19],[.095,.30],[.035,.40],[0,.44],[-.035,.40],[-.095,.30],[-.12,.19],[-.09,.095],[-.05,.035]]
  };
  function build(maple){
    const key=maple?"palmate":"elliptic";if(geometries.has(key))return geometries.get(key);
    const leafCount=maple?7:6,positions=[],uv=[],colors=[],indices=[],hinges=[],flex=[],joints=[];
    const woodPositions=[],woodUV=[],woodIndices=[],v=new THREE.Vector3(),q=new THREE.Quaternion();
    const unit=new THREE.CylinderGeometry(.008,.012,1,5,1,true);unit.translate(0,.5,0);
    function segment(a,b){
      const delta=b.clone().sub(a),length=delta.length(),base=woodPositions.length/3;
      q.setFromUnitVectors(up,delta.normalize());
      for(let i=0;i<unit.attributes.position.count;i++){
        v.fromBufferAttribute(unit.attributes.position,i);v.y*=length;v.applyQuaternion(q).add(a);woodPositions.push(v.x,v.y,v.z);
        woodUV.push(unit.attributes.uv.getX(i),unit.attributes.uv.getY(i));
      }
      for(const index of unit.index.array)woodIndices.push(base+index);
    }
    segment(new THREE.Vector3(),new THREE.Vector3(0,1,0));
    for(let i=0;i<leafCount;i++){
      const terminal=maple&&i===6,side=terminal?0:i%2?1:-1,t=maple?(terminal?.97:.26+Math.floor(i/2)*.25):.22+i*.13;
      const node=new THREE.Vector3(0,t,0),base=new THREE.Vector3(side*(.135+.012*(i%3)),t+(terminal?.06:.035),.035*Math.sin(i*1.7));
      segment(node,base);
      const direction=new THREE.Vector3(terminal?.12:side*.82,terminal?1:.28,.12*Math.cos(i*1.7)).normalize();
      q.setFromUnitVectors(up,direction);const first=positions.length/3;
      const fold=(x,y)=>.032*Math.sin(y*Math.PI/.56)*(1-Math.min(1,Math.abs(x)/.40));
      function vertex(x,y,z,vein=false){
        v.set(x,y,z).multiplyScalar(.70+(i%3)*.045).applyQuaternion(q).add(base);positions.push(v.x,v.y,v.z);
        uv.push(x*1.2+.5,y*1.7);const tone=(vein?.94:.76)+.18*Math.min(1,y/.56);colors.push(tone,tone,tone*.97);
        hinges.push(base.x,base.y,base.z);flex.push(1);return positions.length/3-1;
      }
      outlines[key].forEach(([x,y])=>vertex(x,y,fold(x,y)));
      for(const triangle of THREE.ShapeUtils.triangulateShape(outlines[key].map(p=>new THREE.Vector2(...p)),[]))indices.push(...triangle.map(n=>first+n));
      // Fine palmate veins follow the folded surface and share its material/draw call.
      const veins=maple?mapleAngles.map((a,j)=>[Math.sin(a)*.46*mapleLengths[j]*.84,.095+Math.cos(a)*.46*mapleLengths[j]*.84]):[[0,.40]];
      veins.forEach(([x,y])=>{const width=.0025,a=vertex(-width,.095,fold(-width,.095)+.001,true),b=vertex(width,.095,fold(width,.095)+.001,true),c=vertex(x,y,fold(x,y)+.001,true);indices.push(a,b,c);});
      joints.push({branch:node.toArray(),petiole:base.toArray(),leafVertex:first});
    }
    function geometry(p,u,index,c){
      const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(p,3));g.setAttribute("uv",new THREE.Float32BufferAttribute(u,2));
      g.setAttribute("color",new THREE.Float32BufferAttribute(c||new Float32Array(p.length).fill(1),3));g.setIndex(index);
      g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
    }
    const leaf=geometry(positions,uv,indices,colors),wood=geometry(woodPositions,woodUV,woodIndices);
    leaf.setAttribute("estateLeafHinge",new THREE.Float32BufferAttribute(hinges,3));leaf.setAttribute("estateLeafFlex",new THREE.Float32BufferAttribute(flex,1));
    wood.setAttribute("estateLeafHinge",new THREE.Float32BufferAttribute(new Float32Array(woodPositions.length),3));
    wood.setAttribute("estateLeafFlex",new THREE.Float32BufferAttribute(new Float32Array(woodPositions.length/3),1));
    leaf.userData.estateLeaf=key;leaf.userData.singleLeaf=true;leaf.userData.leavesPerShoot=leafCount;
    wood.userData.connectedLeafWood=true;unit.dispose();
    const result={leaf,wood,joints,leafCount};geometries.set(key,result);return result;
  }
  function attach(root,{maple=false,material,woodMaterial}={}){
    if(root.userData.connectedLeafSprays)return root.userData.connectedLeafSprays;
    const tips=root.userData.crownTips;if(!tips?.length)return null;
    const shape=build(maple),count=tips.length*4,leaves=new THREE.InstancedMesh(shape.leaf,material,count),twigs=new THREE.InstancedMesh(shape.wood,woodMaterial,count);
    const pose=new THREE.Object3D(),direction=new THREE.Vector3();
    // Each prefix includes every crown tip, so LOD never removes an entire side of a tree.
    for(let layer=0;layer<4;layer++)tips.forEach((tip,j)=>{
      const a=Math.atan2(tip.pos[2],tip.pos[0])+(layer-1.5)*.58+.13*Math.sin(j*2.4);
      direction.set(Math.cos(a),.20+.16*((layer+j)%3),Math.sin(a)).normalize();
      pose.position.set(...tip.pos);pose.quaternion.setFromUnitVectors(up,direction);pose.scale.setScalar(tip.radius*(.88+.035*(layer%2)));pose.updateMatrix();
      const n=layer*tips.length+j;leaves.setMatrixAt(n,pose.matrix);twigs.setMatrixAt(n,pose.matrix);
    });
    for(const mesh of [leaves,twigs]){mesh.instanceMatrix.needsUpdate=true;mesh.userData.noAutoShadow=true;mesh.castShadow=false;mesh.receiveShadow=true;root.add(mesh);}
    leaves.userData.estateLeaves=true;leaves.userData.leafCount=count*shape.leafCount;twigs.userData.estateLeafTwigs=true;
    const handle={root,leaves,twigs,maple,tips,shape,capacity:count,lod:"near",normalLOD:"near",setLOD(lod,winter=false){
      const layers=lod==="far"?0:lod==="eco"?1:lod==="middle"?2:4,n=layers*tips.length;
      this.lod=lod;twigs.count=n;twigs.visible=n>0;leaves.count=n;leaves.visible=n>0&&!(maple&&winter);
    }};
    root.userData.connectedLeafSprays=handle;return handle;
  }
  function fitBounds(handles){
    // r128 tests the geometry sphere before instance raycasts; shared owners need a union.
    for(const g of new Set(handles.flatMap(h=>[h.leaves.geometry,h.twigs.geometry]))){
      g.computeBoundingBox();const base=g.boundingBox.clone(),all=new THREE.Box3().makeEmpty(),part=new THREE.Box3(),matrix=new THREE.Matrix4();
      for(const h of handles)for(const mesh of [h.leaves,h.twigs])if(mesh.geometry===g){for(let i=0;i<h.capacity;i++){mesh.getMatrixAt(i,matrix);all.union(part.copy(base).applyMatrix4(matrix));}}
      if(!all.isEmpty()){g.boundingSphere=all.getBoundingSphere(new THREE.Sphere());g.boundingSphere.radius+=.075;}
    }
  }
  function selectLOD(distance,eco=false,quality=0,previous="near"){
    if(eco||quality>1)return distance<30?"eco":"far";
    // Hysteresis prevents flickering leaf clusters at distance boundaries.
    if(distance>(previous==="far"?39:43))return "far";
    if(distance>(previous==="near"?19:16))return "middle";
    return "near";
  }
  return {attach,fitBounds,build,selectLOD};
})();
/* Shared animation field, bounded surface detail and reusable seasonal resources. */
var VISUAL_EXPERIENCE;
VISUAL_EXPERIENCE=(()=>{
  const wind={direction:new THREE.Vector2(.83,-.56),time:{value:0},strength:{value:0}};
  const amount={value:0},waterSources={value:Array.from({length:8},()=>new THREE.Vector4(999,999,0,0))};
  const pose=new THREE.Object3D(),point=new THREE.Vector3(),local=new THREE.Vector3();
  const detail=new THREE.Group();detail.name="estate-visual-experience";world.add(detail);
  let progress=.5,lastSeason=APP.season,active=true,lastLight="",lastRigRefresh=-Infinity;
  const foliage=[],foliageSprays=[],flowers=[],litBays=[],fish=[],materials=new Set(),originals=new Map();
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
      if(kind==="shoot")s.vertexShader="attribute vec3 estateLeafHinge;\nattribute float estateLeafFlex;\n"+s.vertexShader;
      const weight=kind==="shoot"?"smoothstep(0.0,.24,max(position.y,0.0))*.020":kind==="cloth"?"(1.0-smoothstep(.20,.70,position.y))*.012":
        kind==="bamboo"?"pow(max(position.y-.3,0.0),2.0)*.0015":"max(position.y+.3,0.0)*.028";
      s.vertexShader=s.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
        ${kind==="shoot"?`vec3 estateBlade=transformed-estateLeafHinge;
        float estateFlutter=sin(uEstateWindTime*2.7+estateLeafHinge.y*13.0+estateLeafHinge.x*17.0)*.055*estateLeafFlex*uEstateWindStrength;
        float estateC=cos(estateFlutter),estateS=sin(estateFlutter);
        estateBlade.yz=mat2(estateC,estateS,-estateS,estateC)*estateBlade.yz;
        transformed=estateLeafHinge+estateBlade;`:""}
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
  const leafMat=M({color:0x496337,roughness:.36,metalness:.01,vertexColors:true,side:THREE.DoubleSide,envMapIntensity:.35});
  const mapleMat=M({color:0x678c38,roughness:.78,vertexColors:true,side:THREE.DoubleSide});
  const twigMat=M({color:0x65503b,roughness:.94,vertexColors:true});
  windy(twigMat,"shoot");windy(leafMat,"shoot");windy(mapleMat,"shoot");
  if(APP.map!=="kamakura"){
    const trees=[...SEASONAL.maples,...SEASONAL.tsubaki.map(t=>t.tree)];
    trees.forEach((r,i)=>{
      const maple=SEASONAL.maples.includes(r);r.userData.treeSpecies=maple?"maple":"camellia";
      if(i===0||i===SEASONAL.maples.length){r.getWorldPosition(point);register(r,maple?"kaede":"tsubaki",point.clone().add(new THREE.Vector3(0,2.4,0)));}
      const sprig=r.userData.foliage?.find(m=>m.geometry.index?.count===36);
      if(sprig){
        const spray=ESTATE_FOLIAGE.attach(r,{maple,material:maple?mapleMat:leafMat,woodMaterial:twigMat});
        if(!spray)return;const leaves=spray.leaves;foliageSprays.push(spray);
        // Old private winter references remain harmless; the current crown uses this denser shared batch.
        sprig.count=0;sprig.visible=false;r.userData.foliage=r.userData.foliage.map(m=>m===sprig?leaves:m);
      }
      (r.userData.foliage||[]).forEach(m=>{
        if(!m.userData.estateLeaves&&m.isInstancedMesh)originals.set(m,m.instanceMatrix.array.slice());
        foliage.push({mesh:m,maple,index:i});if(!m.userData.estateLeaves)windy(m.material,"leaf");
      });
    });
    ESTATE_FOLIAGE.fitBounds(foliageSprays);
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
  // Snow colours upward surfaces. Displacing blade bases independently would break petiole joints.
  snowShader(MAT.roof,true);snowShader(MAT.grass,false);snowShader(leafMat,false);snowShader(twigMat,false);if(MAT.grassGround)snowShader(MAT.grassGround,false);
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
        const matrix=new THREE.Matrix4(),scale=new THREE.Vector3().setScalar(.65),original=originals.get(mesh);
        for(let i=0;i<mesh.count;i++){matrix.fromArray(original,i*16);matrix.scale(scale);mesh.setMatrixAt(i,matrix);}mesh.instanceMatrix.needsUpdate=true;
        mesh.visible=!(maple&&k==="winter");
      }
      if(!maple){if(mesh.userData.estateLeaves)mesh.material=leafMat;return;}
      if(mesh.userData.estateLeaves){mesh.material=mapleMat;mesh.visible=k!=="winter";}
      const col=new THREE.Color(k==="autumn"?0x668d3c:(SEASONS[k].maple||SEASONS[k].leaf));
      if(k==="autumn")col.lerp(new THREE.Color(0xd74222),THREE.MathUtils.clamp(progress*1.2+.045*(index%3-1),0,1));
      mesh.material.color.copy(col);
      if(mesh.isInstancedMesh){for(let i=0;i<mesh.instanceMatrix.count;i++)mesh.setColorAt(i,new THREE.Color().setScalar(.87+.13*((i*7+index)%11)/10));mesh.instanceColor.needsUpdate=true;}
    });
    updateFoliageLOD();
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
       r.expressionHeadX=motion?nod*.42:0;r.head.rotation.x=r.expressionHeadX;
       r.eyes.position.x=motion&&front?THREE.MathUtils.clamp(local.x*.0025,-.006,.006):0;
      if(r.held){r.held.rotation.x=r.heldX+(motion?.018*Math.sin(t*.85+r.phase):0);r.held.rotation.z=r.heldZ+(motion?.012*Math.sin(t*.71+r.phase):0);}
    }
  }
  function update(t){
    active=APP.map!=="kamakura"&&GARDEN_POLISH.active;detail.visible=active;
    const motion=active&&!REDUCED_MOTION&&APP.mode!=="title";
    wind.time.value=motion?t:0;wind.strength.value=motion?1:0;
    if(APP.season!==lastSeason)season(APP.season);
    updateFoliageLOD();
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
  function updateFoliageLOD(viewCamera=camera,roots=null){
    const inspection=roots!==null;
    if(inspection&&!Array.isArray(roots))return;
    const eco=!!(window.LOW_POWER&&LOW_POWER.active),quality=typeof QUALITY!=="undefined"?QUALITY.level:0;
    for(const spray of foliageSprays){
      if(inspection){
        // The viewer masks every other model. Never change a non-target's visible/count.
        let node=spray.root,selected=false;
        while(node){if(roots.includes(node)){selected=true;break;}node=node.parent;}
        if(!selected)continue;
        spray.setLOD("near",APP.season==="winter");continue;
      }
      spray.root.getWorldPosition(point);const distance=point.distanceTo(viewCamera.position);
      const lod=ESTATE_FOLIAGE.selectLOD(distance,eco,quality,spray.normalLOD);
      // Temporary low-power/inspection detail must not erase normal hysteresis history.
      if(!eco&&quality<=1)spray.normalLOD=lod;
      spray.setLOD(lod,APP.season==="winter");
    }
  }
  season(APP.season);update(0);
  return {update,season,setProgress,sample,wind,detail,foliage,foliageSprays,updateFoliageLOD,flowers,fish,litBays,floorLight,wallShade,
    get progress(){return progress;},get snowAmount(){return amount.value;},get active(){return active;}};
})();
