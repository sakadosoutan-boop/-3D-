/* Fine silhouettes for existing world animals. Call after the core world is built. */
var CREATURE_REFINEMENT=(()=>{
  const tracked=[],worldPos=new THREE.Vector3();
  const sphere=new THREE.SphereGeometry(1,8,6);
  const cone=new THREE.ConeGeometry(1,1,6),ribGeo=new THREE.TorusGeometry(1,.026,4,18);
  // The seventh-chapter figures use one shaped surface per readable part.
  // These low-resolution templates are built once and reused by every actor.
  const bill=(rings)=>{
    const p=[],ix=[],N=8;
    for(const [z,y,rx,ry] of rings)for(let j=0;j<N;j++){
      const a=j/N*Math.PI*2;p.push(Math.cos(a)*rx,y+Math.sin(a)*ry,z);
    }
    for(let i=0;i<rings.length-1;i++)for(let j=0;j<N;j++){
      const a=i*N+j,b=i*N+(j+1)%N,c=(i+1)*N+j,d=(i+1)*N+(j+1)%N;
      ix.push(a,b,c,b,d,c);
    }
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;
  };
  const wing=(kind,side)=>{
    const spec=kind==="duck"
      ?[[.12,.11],[.27,.11],[.35,.00],[.36,-.14],[.32,-.19],[.36,-.25],[.29,-.29],[.30,-.37],[.19,-.34],[.12,-.20]]
      :[[.20,.17],[.37,.16],[.46,-.04],[.54,-.25],[.49,-.30],[.55,-.37],[.46,-.43],[.49,-.52],[.30,-.48],[.20,-.19]];
    const shape=new THREE.Shape();spec.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
    const g=new THREE.ShapeGeometry(shape),p=g.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getY(i),y=kind==="duck"?.314-.042*Math.max(0,-z):1.112-.13*Math.max(0,-z);
      p.setXYZ(i,side*x,y,z);
    }
    if(side<0){const ix=g.index.array;for(let i=0;i<ix.length;i+=3){const t=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=t;}g.index.needsUpdate=true;}
    g.computeVertexNormals();return g;
  };
  const geo={duckBill:bill([[.485,.410,.050,.029],[.550,.407,.061,.019],[.635,.396,.041,.012],[.702,.394,.003,.002]]),
    craneBill:bill([[.55,2.14,.035,.026],[.65,2.134,.034,.020],[.78,2.115,.014,.010],[.855,2.10,.002,.002]]),
    duckWings:[wing("duck",-1),wing("duck",1)],craneWings:[wing("crane",-1),wing("crane",1)]};
  const mats={
    beak:new THREE.MeshStandardMaterial({color:0xc83828,roughness:.55}),
    duckFeather:new THREE.MeshStandardMaterial({color:0x713b29,roughness:.86,side:THREE.DoubleSide}),
    craneFeather:new THREE.MeshStandardMaterial({color:0x27282b,roughness:.86,side:THREE.DoubleSide}),
    craneBill:new THREE.MeshStandardMaterial({color:0x404038,roughness:.72}),
    oxHide:new THREE.MeshStandardMaterial({color:0x302622,roughness:.94}),
    oxMuzzle:new THREE.MeshStandardMaterial({color:0x756154,roughness:.90}),
    oxEar:new THREE.MeshStandardMaterial({color:0x8c6250,roughness:.9}),
    oxHoof:new THREE.MeshStandardMaterial({color:0x181515,roughness:.72}),
    kappaSkin:new THREE.MeshStandardMaterial({color:0x3d6b4a,roughness:.85}),
    kappaNose:new THREE.MeshStandardMaterial({color:0x2c5238,roughness:.85}),
    paperRib:new THREE.MeshStandardMaterial({color:0x613421,roughness:.9}),
    paperMouth:new THREE.MeshStandardMaterial({color:0x361b19,roughness:.88}),
    snowSkin:new THREE.MeshStandardMaterial({color:0xf7efe9,roughness:.55,emissive:0xead6d2,emissiveIntensity:.05}),
    soulFlame:new THREE.MeshBasicMaterial({color:0xb8a5ff,transparent:true,opacity:.8,depthWrite:false}),
    foxFlame:new THREE.MeshBasicMaterial({color:0x9ee9ff,transparent:true,opacity:.82,depthWrite:false})
  };
  const ball=(root,mat,x,y,z,sx,sy,sz,rz=0)=>{
    const m=new THREE.Mesh(sphere,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.z=rz;
    noTinyShadow(m);root.add(m);return m;
  };
  const flame=(root,mat,x,y,z,width,height,lean=0)=>{
    const m=new THREE.Mesh(cone,mat);m.position.set(x,y,z);m.scale.set(width,height,width);
    m.rotation.z=lean;noTinyShadow(m);root.add(m);
  };
  const finish=(parent,tag)=>{
    mergeIndexedCharacterDetail(parent,tag);
    parent.traverse(noTinyShadow);
  };
  const watch=(actor,detail)=>{
    detail.userData.creatureDetail=true;
    let item=tracked.find(entry=>entry.actor===actor);
    if(!item){item={actor,details:[],far:false};tracked.push(item);}
    item.details.push(detail);
  };
  function duck(g){
    if(!g||g.userData.creatureRefined)return false;
    const fine=new THREE.Group();fine.name="duck-beak-and-flight-feathers";
    // A single tapered bill enters the head; each wing is one scalloped sheet
    // tucked into the existing body and the standing orange sail.
    fine.add(new THREE.Mesh(geo.duckBill,mats.beak));
    geo.duckWings.forEach(part=>fine.add(new THREE.Mesh(part,mats.duckFeather)));
    finish(fine,"duck-fine-silhouette");g.add(fine);watch(g,fine);g.userData.creatureRefined=true;return true;
  }
  function crane(g){
    if(!g||g.userData.creatureRefined)return false;
    const fine=new THREE.Group();fine.name="crane-wing-tips-and-bill";
    geo.craneWings.forEach(part=>fine.add(new THREE.Mesh(part,mats.craneFeather)));
    fine.add(new THREE.Mesh(geo.craneBill,mats.craneBill));
    finish(fine,"crane-fine-silhouette");g.add(fine);watch(g,fine);g.userData.creatureRefined=true;return true;
  }
  function ox(cart){
    const drive=cart&&cart.userData&&cart.userData.drive,animal=drive&&drive.ox;
    if(!animal||animal.userData.creatureRefined)return false;
    const fine=new THREE.Group();fine.name="ox-face-and-hooves";
    // -Z faces the shafts: a broad brow, lower muzzle and inner ears make
    // the head legible from the wagon's side without changing horn pivots.
    ball(fine,mats.oxHide,0,1.65,-1.55,.285,.145,.18);
    ball(fine,mats.oxMuzzle,0,1.34,-1.82,.215,.075,.155);
    for(const side of [-1,1]){
      ball(fine,mats.oxEar,side*.354,1.705,-1.445,.145,.046,.058,side*.22);
      ball(fine,mats.oxHide,side*.205,1.49,-1.746,.065,.090,.065);
    }
    finish(fine,"ox-fine-face");animal.add(fine);watch(animal,fine);
    // Hooves stay on each animated leg pivot; the original foot boxes and
    // collision shape remain untouched.
    for(const leg of drive.legs||[]){
      const pivot=leg&&leg.pivot;if(!pivot)continue;
      const cleft=new THREE.Group();cleft.name="ox-cloven-hoof";
      for(const side of [-1,1])ball(cleft,mats.oxHoof,side*.053,-.914,-.145,.056,.055,.092);
      finish(cleft,"ox-cloven-hoof");pivot.add(cleft);watch(animal,cleft);
    }
    animal.userData.creatureRefined=true;return true;
  }
  function yokai(entry){
    const g=entry&&entry.g,type=entry&&(entry.type||entry.g?.userData?.type);
    if(!g||g.userData.creatureRefined)return false;
    const fine=new THREE.Group();fine.name="yokai-facial-detail";
    if(type==="kappa"){
      // The original dish, webbed hands and shell remain the identifying parts.
      for(const side of [-1,1]){
        const arm=g.children.find(o=>o.isMesh&&Math.abs(o.geometry?.parameters?.height-.44)<.001&&Math.abs(o.position.x-side*.41)<.001&&Math.abs(o.position.y-.68)<.001);
        const hand=g.children.find(o=>o.isMesh&&Math.abs(o.geometry?.parameters?.radius-.085)<.001&&Math.abs(o.position.x-side*.6)<.001&&Math.abs(o.position.y-.5)<.001);
        // Keep the original arm and webbed palm: the tilted cylinder now enters
        // the torso at its shoulder and overlaps the palm at its lower cap.
        if(arm){arm.name="kappa-connected-arm";arm.position.set(side*.405,.61,.025);arm.rotation.z=side*1.0;}
        if(hand){hand.name="kappa-webbed-hand";hand.position.set(side*.59,.50,.045);}
        ball(fine,mats.kappaSkin,side*.254,1.015,.045,.054,.029,.045);
        ball(fine,mats.kappaNose,side*.052,.910,.285,.015,.012,.007);
      }
    }else if(type==="chochin"){
      const tongue=g.children.find(o=>o.isMesh&&Math.abs(o.geometry?.parameters?.height-.50)<.001&&o.position.y<-.5);
      if(tongue){
        // The old stalk began below the mouth. Its upper cap now enters the
        // dark opening; flattening and darkening the same mesh reads as a tongue.
        tongue.name="chochin-connected-tongue";
        tongue.position.set(0,-.54,.225);tongue.scale.set(1.45,.86,.65);tongue.rotation.z=.10;
        tongue.material.color.setHex(0x9b302d);tongue.material.opacity=1;tongue.material.transparent=false;tongue.material.depthWrite=true;tongue.material.needsUpdate=true;
      }
      for(const [y,r] of [[-.30,.198],[-.15,.265],[0,.284],[.15,.265],[.30,.198]]){
        const rib=new THREE.Mesh(ribGeo,mats.paperRib);
        rib.position.y=y;rib.rotation.x=Math.PI/2;rib.scale.setScalar(r);noTinyShadow(rib);fine.add(rib);
      }
      ball(fine,mats.paperMouth,0,-.18,.266,.173,.047,.012);
      ball(fine,mats.paperMouth,0,-.305,.198,.070,.137,.012);
    }else if(type==="yukionna"){
      // Hands finish the sleeves while preserving the deliberate hidden feet.
      for(const side of [-1,1]){
        ball(fine,mats.snowSkin,side*.50,.916,.020,.057,.052,.046,-side*.20);
      }
    }else if(type==="hitodama"){
      flame(fine,mats.soulFlame,0,.24,0,.11,.48,.13);
    }else if(type==="kitsunebi"){
      flame(fine,mats.foxFlame,0,.24,0,.105,.47,-.10);
      flame(fine,mats.foxFlame,.22,.25,-.10,.066,.32,.16);
      flame(fine,mats.foxFlame,-.20,.26,.12,.063,.33,-.19);
    }else return false;
    finish(fine,"yokai-fine-detail");g.add(fine);
    if(type!=="hitodama"&&type!=="kitsunebi")watch(g,fine);
    g.userData.creatureRefined=true;return true;
  }
  function applyWorld(){
    const stats={ducks:0,cranes:0,oxen:0,yokai:0};
    if(typeof waterBirds!=="undefined")for(const bird of waterBirds){
      if(bird.kind==="duck"&&duck(bird.g))stats.ducks++;
      if(bird.kind==="crane"&&crane(bird.g))stats.cranes++;
    }
    if(typeof GISSHA_YARD!=="undefined"&&ox(GISSHA_YARD.cart))stats.oxen++;
    if(typeof creatures!=="undefined"&&creatures.yokai)for(const entry of creatures.yokai)if(yokai(entry))stats.yokai++;
    return stats;
  }
  function update(camera){
    if(!camera)return;
    const eco=typeof LOW_POWER!=="undefined"&&LOW_POWER.active,near=eco?9:13,far=eco?12:17;
    for(const item of tracked){
      item.actor.getWorldPosition(worldPos);
      const d2=camera.position.distanceToSquared(worldPos);
      if(item.far?d2<near*near:d2>far*far)item.far=!item.far;
      for(const detail of item.details)detail.visible=!item.far;
    }
  }
  return {applyWorld,update};
})();
