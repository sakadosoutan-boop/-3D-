/* CPU geometry checks use the bundled r128 and the game's actual broadleaf factory. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'寝殿造り3D探訪_統合版.html'),'utf8');
const source=fs.readFileSync(path.join(root,'src/app/visual-experience.js'),'utf8'),sandbox={console};
const scriptStart=html.indexOf('<script>')+8;vm.runInNewContext(html.slice(scriptStart,html.indexOf('</script>',scriptStart)),sandbox);
const T=sandbox.THREE;assert.equal(T.REVISION,'128');
vm.runInNewContext(source.slice(0,source.indexOf('var VISUAL_EXPERIENCE;')),sandbox);
const api=sandbox.ESTATE_FOLIAGE,passed=[];function check(value,label){assert(value,label);passed.push(label);}
function block(start,end){const i=html.indexOf(start);assert(i>=0,start);const j=html.indexOf(end,i);assert(j>i,end);return html.slice(i,j);}
Object.assign(sandbox,{FOLIAGE_DETAIL:new Map(),MAT:{trunk:new T.MeshStandardMaterial({color:0x68543d})},
  rnd:(a,b)=>a+(b-a)*.47,markFoliageNoShadow:m=>{m.castShadow=false;return m;},
  cyl:(r0,r1,h,mat,x,y,z,n)=>{const m=new T.Mesh(new T.CylinderGeometry(r0,r1,h,n),mat);m.position.set(x,y,z);return m;}});
vm.runInNewContext(block('function gardenFoliageGeo(','["leaf","leaf2"'),sandbox);
vm.runInNewContext(block('function fitDetailInstances(','function goldStud'),sandbox);
vm.runInNewContext(block('const LEAF_CLUMP_GEOS=','// A shallow, two-layer camellia'),sandbox);
const material=new T.MeshStandardMaterial(),woodMaterial=new T.MeshStandardMaterial(),handles=[];
for(const maple of [true,false])for(const size of [1.6,2.8]){
  const tree=sandbox.broadleaf(size,material),handle=api.attach(tree,{maple,material,woodMaterial});handles.push(handle);
  check(handle.capacity===32&&tree.userData.crownTips.length===8,'real broadleaf tips connect to 32 shoot instances '+maple+' '+size);
  assert.equal(api.attach(tree,{maple,material,woodMaterial}),handle,'attach must be idempotent');
  assert.deepEqual([...handle.leaves.instanceMatrix.array],[...handle.twigs.instanceMatrix.array],'blade and petiole matrices differ');
  for(let i=0;i<handle.capacity;i++){
    const matrix=new T.Matrix4();handle.leaves.getMatrixAt(i,matrix);
    assert(new T.Vector3().applyMatrix4(matrix).distanceTo(new T.Vector3(...handle.tips[i%8].pos))<1e-6,'shoot is detached from core branch tip');
  }
}
check(handles[0].leaves.geometry===handles[1].leaves.geometry&&handles[2].leaves.geometry===handles[3].leaves.geometry,'species geometry is shared across tree sizes');
for(const maple of [true,false]){
  const shape=api.build(maple),p=shape.leaf.attributes.position,wood=shape.wood.attributes.position;
  check(shape.leaf.userData.singleLeaf&&shape.leafCount===(maple?7:6),'single palmate/elliptic blades '+maple);
  for(const [i,joint] of shape.joints.entries()){
    const bladeRoot=new T.Vector3().fromBufferAttribute(p,joint.leafVertex),end=new T.Vector3(),start=new T.Vector3();
    for(let k=0;k<5;k++){end.add(new T.Vector3().fromBufferAttribute(wood,(i+1)*12+k));start.add(new T.Vector3().fromBufferAttribute(wood,(i+1)*12+6+k));}
    end.multiplyScalar(.2);start.multiplyScalar(.2);
    assert(end.distanceTo(bladeRoot)<1e-6&&start.distanceTo(new T.Vector3(...joint.branch))<1e-6,'branch → petiole → blade has a gap');
    assert(bladeRoot.distanceTo(new T.Vector3(...joint.petiole))<1e-6);
    const hinge=new T.Vector3().fromBufferAttribute(shape.leaf.attributes.estateLeafHinge,joint.leafVertex);
    assert(hinge.distanceTo(bladeRoot)<1e-6,'flutter pivot detaches the blade');
  }
  for(const g of [shape.leaf,shape.wood]){
    assert([...g.attributes.position.array,...g.attributes.normal.array].every(Number.isFinite),'non-finite shape');
    assert([...g.index.array].every(i=>i<g.attributes.position.count),'invalid shape index');
  }
  const triangles=(shape.leaf.index.count+shape.wood.index.count)/3*32,oldTriangles=8*(maple?28:24)*(maple?48:30);
  check(triangles<=oldTriangles,'connected shoots remain within previous leaf triangle budget '+maple+' '+triangles+'/'+oldTriangles);
}
api.fitBounds(handles);
for(const h of handles){
  const ids=[h.leaves.geometry.id,h.twigs.geometry.id],matrices=h.leaves.instanceMatrix.array.slice(),point=new T.Vector3(),matrix=new T.Matrix4();
  for(const mesh of [h.leaves,h.twigs])for(let i=0;i<h.capacity;i++){
    mesh.getMatrixAt(i,matrix);for(let j=0;j<mesh.geometry.attributes.position.count;j++){
      point.fromBufferAttribute(mesh.geometry.attributes.position,j).applyMatrix4(matrix);assert(mesh.geometry.boundingSphere.containsPoint(point),'shared bounds exclude an instance');
    }
  }
  for(let repeat=0;repeat<60;repeat++)for(const lod of ['near','middle','eco','far'])for(const winter of [false,true]){
    h.setLOD(lod,winter);assert.equal(h.leaves.count,h.twigs.count);
    assert.equal(h.leaves.visible,h.leaves.count>0&&!(h.maple&&winter));
    const coverage=new Set();for(let i=0;i<h.leaves.count;i++)coverage.add(i%8);
    assert(h.leaves.count===0||coverage.size===8,'LOD removes an entire crown side');
  }
  assert.deepEqual([...h.leaves.instanceMatrix.array],[...matrices],'LOD rewrites placement');
  assert.deepEqual([h.leaves.geometry.id,h.twigs.geometry.id],ids,'LOD allocates shape resources');
}
check(true,'bounds, winter shedding, evergreen retention and repeated LOD changes reuse finite resources');
assert.equal(api.selectLOD(10,false,0),'near');assert.equal(api.selectLOD(25,false,0),'middle');assert.equal(api.selectLOD(50,false,0),'far');
assert.equal(api.selectLOD(17,false,0,'near'),'near');assert.equal(api.selectLOD(17,false,0,'middle'),'middle');
assert.equal(api.selectLOD(41,false,0,'far'),'far');assert.equal(api.selectLOD(41,false,0,'middle'),'middle');
assert.equal(api.selectLOD(5,true,0),'eco');assert.equal(api.selectLOD(5,false,3),'eco');
check(true,'distance hysteresis and eco/quality budgets choose reversible LOD');
// Exercise the actual public function, including the inspector target filter.
Object.assign(sandbox,{foliageSprays:handles,point:new T.Vector3(),camera:new T.PerspectiveCamera(),
  window:{LOW_POWER:{active:true}},LOW_POWER:{active:true},QUALITY:{level:3},APP:{season:'summer'}});
const lodStart=source.indexOf('  function updateFoliageLOD('),lodEnd=source.indexOf('  season(APP.season);update(0);',lodStart);
assert(lodStart>0&&lodEnd>lodStart);vm.runInNewContext(source.slice(lodStart,lodEnd),sandbox);
const container=new T.Group();container.add(handles[0].root);handles.forEach(h=>h.setLOD('eco'));
handles[1].leaves.visible=false;handles[1].twigs.visible=false;
const state=h=>[h.leaves.count,h.twigs.count,h.leaves.visible,h.twigs.visible,h.lod],others=handles.slice(1).map(state);
sandbox.updateFoliageLOD(sandbox.camera,[container]);
assert.equal(handles[0].leaves.count,32);assert(handles[0].leaves.visible);
assert.deepEqual(handles.slice(1).map(state),others,'inspection breaks another model visibility mask');
sandbox.updateFoliageLOD(sandbox.camera,[handles[2].root]);assert.equal(handles[2].leaves.count,32);
const beforeEmpty=handles.map(state);sandbox.updateFoliageLOD(sandbox.camera,[]);assert.deepEqual(handles.map(state),beforeEmpty);
sandbox.APP.season='winter';sandbox.updateFoliageLOD(sandbox.camera,[handles[0].root]);
assert(!handles[0].leaves.visible&&handles[0].twigs.visible&&handles[0].twigs.count===32,'inspector loses seasonal shedding');
sandbox.updateFoliageLOD(sandbox.camera);assert(handles.every(h=>h.leaves.count<32),'normal camera does not restore eco distance LOD');
check(true,'inspector selects direct/descendant trees, overrides eco detail and preserves every unrelated mask/count');
check(source.includes('windy(twigMat,"shoot");windy(leafMat,"shoot");windy(mapleMat,"shoot")')&&source.includes('transformed=estateLeafHinge+estateBlade')&&source.includes('snowShader(leafMat,false)'),'shared shoot wind, blade-root flutter and non-displacing evergreen snow are connected');
console.log(JSON.stringify({checks:passed.length,passed,triangles:{maple:(api.build(true).leaf.index.count+api.build(true).wood.index.count)/3*32,camellia:(api.build(false).leaf.index.count+api.build(false).wood.index.count)/3*32}},null,2));
