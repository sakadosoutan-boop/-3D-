/* Head, eyes and held objects retain independent pivots before static parts are batched. */
var HEIAN_EXPRESSIONS=[],HEIAN_EXPRESSION_REGISTRY=new WeakMap(),HEIAN_FINGER_GEO,HEIAN_SHAKU_GEO,HEIAN_SHAKU_MAT;
function refineHeianHeadTemplate(){
  const geo=HEIAN_GEO.head;if(geo.userData.softJaw)return;
  const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    if(z<.16)continue;
    // A continuous cheek-to-chin relief, scaled by the existing head mesh.
    const cheek=Math.exp(-Math.pow((Math.abs(x)-.46)/.25,2)-Math.pow((y+.08)/.30,2));
    const chin=Math.exp(-Math.pow(x/.36,2)-Math.pow((y+.68)/.24,2));
    pos.setZ(i,z+Math.max(0,z)*(.055*cheek+.045*chin));
  }
  pos.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();geo.userData.softJaw=true;
}
function heianTempleLockGeometry(){
  const rings=[[.100,.110,.019],[.022,.135,.029],[-.105,.104,.026],[-.246,.030,.007]],N=8,p=[],ix=[];
  for(const [y,z,r] of rings)for(let j=0;j<N;j++){
    const a=j/N*Math.PI*2;p.push(Math.cos(a)*r,y,z+Math.sin(a)*r);
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<N;j++){
    const a=i*N+j,b=i*N+(j+1)%N,c=(i+1)*N+j,d=(i+1)*N+(j+1)%N;
    ix.push(a,b,c,b,d,c);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(p,3));geo.setIndex(ix);
  geo.computeVertexNormals();return geo;
}
function rigHeianExpression(g,detail,prop,standing,hime){
  refineHeianHeadTemplate();
  const hy=standing?1.62:1.01,head=new THREE.Group(),face=new THREE.Group(),eyes=new THREE.Group();
  head.name="heian-head-pivot";head.position.set(0,hy,.02);head.add(face,eyes);eyes.position.set(0,.025,.155);
  const take=(o,target)=>{o.position.sub(head.position);if(target===eyes)o.position.sub(eyes.position);target.add(o);};
  for(const parent of [g,detail])for(const o of parent.children.slice()){
    if(!o.isMesh||o.position.y<hy-.13||Math.abs(o.position.x)>.21)continue;
    const eye=o.geometry===HEIAN_GEO.sphere&&o.position.z>.16&&
      (o.material===HEIAN_FACE||o.scale.x<.006);
    take(o,eye?eyes:o.userData.heianDetail?face:head);
  }
  // A tapered neck overlaps both head and collar; the long back hair stays on
  // the torso while these short temple locks move with the conversation pivot.
  HEIAN_GEO.neck=HEIAN_GEO.neck||new THREE.LatheGeometry([
    new THREE.Vector2(.058,-.302),new THREE.Vector2(.073,-.265),
    new THREE.Vector2(.075,-.190),new THREE.Vector2(.064,-.130)],12);
  const neck=new THREE.Mesh(HEIAN_GEO.neck,HEIAN_SKIN);neck.position.z=.018;noTinyShadow(neck);head.add(neck);
  if(prop!=="shaku"){
    HEIAN_GEO.templeLock=HEIAN_GEO.templeLock||heianTempleLockGeometry();
    for(const side of [-1,1]){
      const lock=new THREE.Mesh(HEIAN_GEO.templeLock,HEIAN_HAIR);
      lock.position.x=side*.151;lock.rotation.z=-side*.045;noTinyShadow(lock);head.add(lock);
    }
  }
  mergeIndexedCharacterDetail(head,"heian-head-shell");
  mergeIndexedCharacterDetail(face,"heian-face");face.traverse(noTinyShadow);
  mergeIndexedCharacterDetail(eyes,"heian-eyes");eyes.traverse(noTinyShadow);g.add(head);
  let held=[...g.children,...detail.children].find(o=>o!==head&&o.isGroup&&o.children.some(m=>m.userData.characterBatch?.includes?.("fan")||m.userData.characterBatch?.includes?.("scroll")));
  // Groups keep their factory position, independent of a generated batch's tag format.
  if(!held)held=[...g.children,...detail.children].find(o=>o!==detail&&o!==head&&o.isGroup&&o.position.z>.35);
  if(prop==="shaku")held=[...g.children].find(o=>o.isMesh&&Math.abs(o.position.x+.12)<.01&&Math.abs(o.position.y-(standing?.98:.67))<.01&&o.position.z>.4)||held;
  if(prop==="shaku"&&!held){
    // The seated factory creates a shaku mesh but does not attach it to the figure.
    HEIAN_SHAKU_GEO=HEIAN_SHAKU_GEO||new THREE.BoxGeometry(.075,.45,.035);
    HEIAN_SHAKU_MAT=HEIAN_SHAKU_MAT||M({color:0x9b7146,roughness:.7});
    held=new THREE.Mesh(HEIAN_SHAKU_GEO,HEIAN_SHAKU_MAT);
    held.position.set(-.12,standing?.98:.67,.43);held.rotation.z=-.08;noTinyShadow(held);g.add(held);
  }
  const fy=standing?.86:prop==="scroll"?.61:.55;
  const grip=new THREE.Group();grip.name="heian-hand-object-grip";grip.position.set(0,fy,.43);
  const handParts=new THREE.Group(),ownedFingerGeometry=[],sides=prop==="scroll"?[-1,1]:[-1];
  for(const parent of [g,detail])for(const o of parent.children.slice()){
    if(!o.isMesh||o.material!==HEIAN_SKIN||!sides.includes(Math.sign(o.position.x))||
       Math.abs(o.position.x)<.15||Math.abs(o.position.x)>.27||Math.abs(o.position.y-fy)>.075||o.position.z<.31||o.position.z>.51)continue;
    if(o.geometry.type==="CylinderGeometry"&&o.geometry!==HEIAN_FINGER_GEO)ownedFingerGeometry.push(o.geometry);
    o.position.sub(grip.position);handParts.add(o);
  }
  // Keep a fan's rivet, both scroll ends, or the shaku shaft in the same moving frame as the fingers.
  if(held){
    if(prop==="fan")held.position.set(-.18,fy+.025,.43);
    if(prop==="shaku")held.position.x=-.17;
    held.position.sub(grip.position);grip.add(held);
  }
  HEIAN_FINGER_GEO=HEIAN_FINGER_GEO||new THREE.CylinderGeometry(.009,.008,.043,5);
  const fingers=new THREE.Group(),fz=prop==="scroll"?.455:.426;
  for(const side of sides)for(let k=0;k<4;k++){
    const f=new THREE.Mesh(HEIAN_FINGER_GEO,HEIAN_SKIN);
    f.position.set(side*(.171+k*.008),fy+(prop==="scroll"?(k-1.5)*.014:.018),fz);f.position.sub(grip.position);
    f.rotation.set(prop==="scroll"?-.3:-1.12,0,side*.10);noTinyShadow(f);fingers.add(f);
  }
  mergeIndexedCharacterDetail(fingers,"heian-gripping-fingers");fingers.traverse(noTinyShadow);
  mergeIndexedCharacterDetail(handParts,"heian-held-hands");handParts.traverse(noTinyShadow);
  ownedFingerGeometry.forEach(geo=>{if(!handParts.children.some(mesh=>mesh.geometry===geo))geo.dispose();});
  grip.add(handParts,fingers);g.add(grip);
  if(prop!=="shaku")for(const o of g.children){
    if(!o.isMesh||o.geometry!==HEIAN_GEO.robe||o.position.z>-.42||o.position.y>.31)continue;
    // The leading figure's train is broad; attendants' rear hems stay nearer the body.
    o.scale.z*=hime?1.10:.86;o.position.z+=hime?-.04:.045;
  }
  // Very low hems can intersect the floor when a character is placed on a raised deck.
  for(const o of g.children){
    if(!o.isMesh||o===held||o.position.y>.35||o.position.y<.07)continue;
    if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
    const bottom=o.position.y+o.geometry.boundingBox.min.y*o.scale.y;
    if(bottom<.012&&bottom>-.15)o.position.y+=.012-bottom;
  }
  const rig={g,head,face,eyes,detail,held,grip,gripBase:grip.position.clone(),heldX:held?.rotation.x||0,heldZ:held?.rotation.z||0,
    phase:(g.id%19)*.37,prop,standing,role:hime?"himegimi":prop==="shaku"?"kikoshi":"nyobo"};
  g.userData.expression=true;HEIAN_EXPRESSION_REGISTRY.set(g,rig);HEIAN_EXPRESSIONS.push(rig);return rig;
}
