/* Contact, readable body language and weather traces. Loaded after the estate scene. */
var SELECTED_VISUALS=(()=>{
  const surfaceY=.06,point=new THREE.Vector3(),local=new THREE.Vector3(),dark=new THREE.Color(0x33404a);
  const prints=[],printGeo=new THREE.CircleGeometry(1,16),printMax=16;
  const printLayer=new THREE.Group();printLayer.name="short-lived-snow-footprints";scene.add(printLayer);
  for(let i=0;i<printMax;i++){
    const mesh=new THREE.Mesh(printGeo,new THREE.MeshBasicMaterial({color:0x536675,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
    mesh.rotation.x=-Math.PI/2;mesh.scale.set(.105,.20,1);mesh.visible=false;mesh.userData.age=0;mesh.userData.life=6.5;
    printLayer.add(mesh);prints.push(mesh);
  }
  const rings=[];
  if(APP.map!=="kamakura")for(const b of waterBirds){
    if(b.kind!=="duck")continue;
    const mesh=new THREE.Mesh(new THREE.RingGeometry(.31,.325,32),new THREE.MeshBasicMaterial({color:0xd8e9e1,transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false}));
    mesh.rotation.x=-Math.PI/2;mesh.position.y=surfaceY+.008;mesh.userData.bird=b;mesh.userData.offset=rings.length*1.7;
    scene.add(mesh);rings.push(mesh);
  }
  const glass=document.createElement("div");glass.className="selected-rain-glass";glass.setAttribute("aria-hidden","true");
  glass.innerHTML='<i></i><i></i><i></i><i></i><i></i><i></i>';document.body.appendChild(glass);
  const stats={conversation:null,wetness:0,sheltered:false,footprints:0,waterContact:0};
  let stepX=NaN,stepZ=NaN,stepSide=1,nextPrint=0,lastDialogue="",dialogueRig=null;
  function exposed(x,z){return !(_footstepSurface(x,z).indoor||inPond(x,z));}
  function activeConversation(){
    const bubble=document.getElementById("dialogueBubble");
    if(APP.mode!=="walk"||!bubble?.classList.contains("show"))return null;
    const name=document.getElementById("dialogueName")?.textContent||"";
    if(name!==lastDialogue){
      lastDialogue=name;dialogueRig=null;
      const id=Object.keys(NPC_DIALOGUES).find(key=>ITEMS[key]?.n===name),roots=interactables[id]?.roots||[];
      for(const r of HEIAN_EXPRESSIONS){
        let node=r.g;
        while(node&&!roots.includes(node))node=node.parent;
        if(node){dialogueRig=r;break;}
      }
    }
    return dialogueRig;
  }
  function prepareWetCloth(r){
    if(r.wetCloth)return;
    const candidates=[];r.g.traverse(o=>{
      if(!o.isMesh||Array.isArray(o.material)||!o.material?.color||!o.geometry?.attributes?.position)return;
      if([...HEIAN_MATS.values()].includes(o.material))candidates.push(o);
    });
    candidates.sort((a,b)=>b.geometry.attributes.position.count-a.geometry.attributes.position.count);
    r.wetCloth=candidates.slice(0,2).map(mesh=>{
      const original=mesh.material,material=original.clone();mesh.material=material;
      return {mesh,material,base:material.color.clone(),roughness:material.roughness};
    });
  }
  function animatePeople(dt,t,raining,conversation){
    let shown=0;
    for(const r of HEIAN_EXPRESSIONS){
      if(!r.g.parent||!r.g.visible)continue;
      r.g.getWorldPosition(point);const dist=point.distanceTo(camera.position);
      if(dist>18&&(r.wetness||0)<.001&&!r.turnState)continue;
      const near=dist<13,active=near&&!LOW_POWER.active&&!REDUCED_MOTION;
      const speaking=r===conversation;
      if(speaking){
        if(!r.turnState)r.turnState={base:r.g.rotation.y};
        r.g.parent.worldToLocal(local.copy(player.pos));
        const direction=Math.atan2(local.x-r.g.position.x,local.z-r.g.position.z);
        const delta=Math.atan2(Math.sin(direction-r.turnState.base),Math.cos(direction-r.turnState.base));
        const yaw=r.turnState.base+THREE.MathUtils.clamp(delta,-.62,.62);
        r.g.rotation.y+=THREE.MathUtils.clamp(yaw-r.g.rotation.y,-dt*2.4,dt*2.4);
        stats.conversation=r.role;
      }else if(r.turnState){
        const remaining=r.turnState.base-r.g.rotation.y;
        r.g.rotation.y+=THREE.MathUtils.clamp(remaining,-dt*2.4,dt*2.4);
        if(Math.abs(remaining)<.003){r.g.rotation.y=r.turnState.base;r.turnState=null;}
      }
      if(r.grip){
        const cycle=active?Math.sin(t*(r.prop==="fan"?2.0:.85)+r.phase):0;
        const lift=r.prop==="fan"?.065+.045*cycle:r.prop==="scroll"?-.018+.012*cycle:.020+.008*cycle;
        r.grip.position.y=r.gripBase.y+lift+(speaking?.025:0);
        r.grip.position.z=r.gripBase.z+(r.prop==="scroll"?.015:r.prop==="fan"?.01:0);
        r.grip.rotation.x=r.prop==="scroll"?.055:r.prop==="fan"?-.07*cycle:0;
      }
      r.head.rotation.x=(r.expressionHeadX||0)+(active?(r.prop==="scroll"?.09:r.prop==="fan"?-.025:.015):0)
        +(active&&speaking?.055*Math.sin(t*2+r.phase):0);
      const wetTarget=raining&&exposed(point.x,point.z)&&r.standing?1:0;
      r.wetness=THREE.MathUtils.lerp(r.wetness||0,wetTarget,Math.min(1,dt*(wetTarget?1.2:.30)));
      if(r.wetness>.01&&near&&!LOW_POWER.active)prepareWetCloth(r);
      for(const c of r.wetCloth||[]){c.material.color.copy(c.base).lerp(dark,r.wetness*.22);c.material.roughness=Math.max(.15,c.roughness-r.wetness*.13);}
      if(near)shown++;
    }
    return shown;
  }
  function updateWater(t){
    let n=0;
    for(const b of waterBirds){
      if(!b.g.visible||APP.map==="kamakura")continue;
      if(b.kind==="duck"){
        b.g.position.y=surfaceY+Math.sin(t*2+b.phase)*.008;
        if(inPond(b.g.position.x,b.g.position.z))n++;
      }else if(b.kind==="koi"){
        // The body and its ripple meet the water shader at y=.06, even when the base loop bobs it.
        b.g.position.y=surfaceY+.018+Math.sin(t*1.6+b.phase)*.003;
        const ripple=b.g.userData.ripple;if(ripple)ripple.position.y=-.012;
        if(inPond(b.g.position.x,b.g.position.z))n++;
      }
    }
    for(const ring of rings){
      const b=ring.userData.bird,ok=b.g.visible&&inPond(b.g.position.x,b.g.position.z);
      ring.visible=ok&&APP.mode!=="taiji"&&!LOW_POWER.active;if(!ring.visible)continue;
      const phase=(t*.35+ring.userData.offset)%1;
      ring.position.x=b.g.position.x;ring.position.z=b.g.position.z;ring.scale.setScalar(.8+phase*2.1);
      ring.material.opacity=(1-phase)*.24;
    }
    stats.waterContact=n;
  }
  function addPrint(x,z,t){
    const mesh=prints[nextPrint++%prints.length],y=groundH(x,z);
    mesh.position.set(x,y+.018,z);mesh.rotation.z=-player.yaw;mesh.userData.age=0;mesh.visible=true;
    mesh.material.opacity=.32;mesh.userData.spawn=t;
  }
  function updateFootprints(dt,t){
    const snow=APP.map!=="kamakura"&&APP.season==="winter"&&VISUAL_EXPERIENCE.snowAmount>.12&&APP.mode==="walk"&&!LOW_POWER.active;
    const x=player.pos.x,z=player.pos.z;
    if(snow&&exposed(x,z)){
      if(!Number.isFinite(stepX)){stepX=x;stepZ=z;}
      const dx=x-stepX,dz=z-stepZ,d=Math.hypot(dx,dz);
      if(d>.48&&d<4){
        const side=stepSide;stepSide=-side;
        addPrint(x+Math.cos(player.yaw)*side*.12,z-Math.sin(player.yaw)*side*.12,t);
        stepX=x;stepZ=z;
      }else if(d>=4){stepX=x;stepZ=z;}
    }else{stepX=NaN;stepZ=NaN;}
    let count=0;
    for(const mesh of prints){
      if(!mesh.visible)continue;
      mesh.userData.age+=Math.max(0,dt);
      const left=Math.max(0,1-mesh.userData.age/mesh.userData.life);
      mesh.material.opacity=.32*left*left;mesh.visible=left>0&&APP.season==="winter"&&APP.map!=="kamakura"&&!LOW_POWER.active;
      if(mesh.visible)count++;
    }
    stats.footprints=count;
  }
  function update(dt,t){
    dt=Math.min(.1,Math.max(0,Number(dt)||0));t=Number(t)||0;stats.conversation=null;
    const rain=APP.map!=="kamakura"&&!!rainFall.visible&&APP.mode!=="taiji";
    stats.sheltered=rain&&_footstepSurface(player.pos.x,player.pos.z).indoor;
    const target=rain&&!stats.sheltered?1:0;
    stats.wetness=THREE.MathUtils.lerp(stats.wetness,target,Math.min(1,dt*(target?1.5:.5)));
    glass.style.opacity=String(LOW_POWER.active||REDUCED_MOTION?0:stats.wetness*.75);
    glass.classList.toggle("sheltered",stats.sheltered);
    animatePeople(dt,t,rain,activeConversation());updateWater(t);updateFootprints(dt,t);
  }
  return {update,stats,prints,rings,glass,exposed};
})();
