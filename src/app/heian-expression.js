/* Head, eyes and held objects retain independent pivots before static parts are batched. */
var HEIAN_EXPRESSIONS=[],HEIAN_EXPRESSION_REGISTRY=new WeakMap(),HEIAN_FINGER_GEO;
function rigHeianExpression(g,detail,prop,standing,hime){
  const hy=standing?1.62:1.01,head=new THREE.Group(),face=new THREE.Group(),eyes=new THREE.Group();
  head.name="heian-head-pivot";head.position.set(0,hy,.02);head.add(face,eyes);eyes.position.set(0,.025,.155);
  const take=(o,target)=>{o.position.sub(head.position);if(target===eyes)o.position.sub(eyes.position);target.add(o);};
  for(const parent of [g,detail])for(const o of parent.children.slice()){
    if(!o.isMesh||o.position.y<hy-.13||Math.abs(o.position.x)>.21)continue;
    const eye=o.geometry===HEIAN_GEO.sphere&&o.position.z>.16&&
      (o.material===HEIAN_FACE||o.scale.x<.006);
    take(o,eye?eyes:o.userData.heianDetail?face:head);
  }
  mergeIndexedCharacterDetail(head,"heian-head-shell");
  mergeIndexedCharacterDetail(face,"heian-face");face.traverse(noTinyShadow);
  mergeIndexedCharacterDetail(eyes,"heian-eyes");eyes.traverse(noTinyShadow);g.add(head);
  let held=[...g.children,...detail.children].find(o=>o!==head&&o.isGroup&&o.children.some(m=>m.userData.characterBatch?.includes?.("fan")||m.userData.characterBatch?.includes?.("scroll")));
  // Groups keep their factory position, independent of a generated batch's tag format.
  if(!held)held=[...g.children,...detail.children].find(o=>o!==detail&&o!==head&&o.isGroup&&o.position.z>.35);
  if(prop==="fan"&&held){held.position.x=-.18;held.position.y=standing?.86:.55;held.position.z=standing?.43:.41;}
  HEIAN_FINGER_GEO=HEIAN_FINGER_GEO||new THREE.CylinderGeometry(.009,.008,.043,5);
  const fingers=new THREE.Group(),fy=standing?.86:prop==="scroll"?.61:.55,fz=standing?.445:prop==="scroll"?.455:.426;
  const sides=prop==="fan"?[-1]:[-1,1];
  for(const side of sides)for(let k=0;k<4;k++){
    const f=new THREE.Mesh(HEIAN_FINGER_GEO,HEIAN_SKIN);
    f.position.set(side*(.171+k*.008),fy+(prop==="scroll"?(k-1.5)*.014:.018),fz);
    f.rotation.set(prop==="scroll"?-.3:-1.12,0,side*.10);noTinyShadow(f);fingers.add(f);
  }
  mergeIndexedCharacterDetail(fingers,"heian-gripping-fingers");fingers.traverse(noTinyShadow);detail.add(fingers);
  const rig={g,head,face,eyes,detail,held,heldX:held?.rotation.x||0,heldZ:held?.rotation.z||0,phase:(g.id%19)*.37,prop};
  g.userData.expression=true;HEIAN_EXPRESSION_REGISTRY.set(g,rig);HEIAN_EXPRESSIONS.push(rig);return rig;
}
