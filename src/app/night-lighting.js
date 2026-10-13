/* A fixed light budget keeps time-of-day changes from rebuilding point-light shaders. */
var NIGHT_LIGHTING=(()=>{
  const pool=[],sources=[],known=new WeakSet(),visibility=new WeakMap();
  const point=new THREE.Vector3(),position=new THREE.Vector3();
  let budget=0,scanAt=-Infinity,lastMode=null,passthrough=false;
  const stats={budget:0,sources:0,candidates:0,selected:[],passthrough:false};
  function attached(o){let p=o;while(p?.parent)p=p.parent;return p===scene;}
  function parentsVisible(o){for(let p=o.parent;p&&p!==scene;p=p.parent)if(!p.visible)return false;return true;}
  function within(o,roots){for(let p=o;p;p=p.parent)if(roots.includes(p))return true;return false;}
  function remember(light){
    if(!light.isPointLight||light.userData.nightLightPool||known.has(light))return;
    const descriptor=Object.getOwnPropertyDescriptor(light,'visible');
    // Preserve the caller's visibility intent while source lamps are represented by the pool.
    // Object3D has an ordinary configurable data property; leave custom accessors alone.
    if(!descriptor?.configurable||!('value' in descriptor))return;
    const state={descriptor,desired:light.visible};visibility.set(light,state);
    Object.defineProperty(light,'visible',{configurable:true,enumerable:descriptor.enumerable,
      get(){return passthrough?state.desired:false;},set(value){state.desired=value;}});
    known.add(light);sources.push(light);
  }
  function release(light){const state=visibility.get(light);if(state){Object.defineProperty(light,'visible',{...state.descriptor,value:state.desired});visibility.delete(light);}known.delete(light);}
  function discover(){scene.traverse(remember);scanAt=performance.now();}
  const objectAdd=THREE.Object3D.prototype.add;
  // Catch late lamps added to already attached groups before their first rendered frame.
  // Detached construction costs nothing; attaching its root visits just that new subtree.
  THREE.Object3D.prototype.add=function(...nodes){const result=objectAdd.apply(this,nodes);if(this===scene||attached(this))for(const node of nodes)node.traverse(remember);return result;};
  function configure(count){
    while(pool.length<count){const light=new THREE.PointLight(0xffffff,0,12,2);light.name='nearby-lamp-light-'+pool.length;light.userData.nightLightPool=true;light.castShadow=false;objectAdd.call(scene,light);pool.push(light);}
    budget=count;stats.budget=count;
    pool.forEach((l,i)=>{l.visible=i<count;l.intensity=0;});
  }
  function originalSceneLighting(){
    passthrough=true;
    for(const l of pool){l.visible=false;l.intensity=0;}
    stats.passthrough=true;stats.selected=[];
  }
  function update(viewCamera=camera,force=false,roots=null){
    const now=performance.now();
    if(force||APP.mode!==lastMode||now-scanAt>1500){discover();lastMode=APP.mode;}
    for(let i=sources.length-1;i>=0;i--)if(!attached(sources[i])){release(sources[i]);sources.splice(i,1);}
    stats.sources=sources.length;
    // The separate Claude replay controls its own portrait and macro lighting.
    if(typeof SAIGEN_TSUREZURE!=='undefined'&&SAIGEN_TSUREZURE?.S.active){originalSceneLighting();return;}
    const eco=!!window.LOW_POWER?.active,level=typeof QUALITY!=='undefined'?QUALITY.level:0;
    const count=eco||level>=2?2:level===1?3:4;
    if(count!==budget||passthrough){configure(count);passthrough=false;}
    stats.passthrough=false;viewCamera.getWorldPosition(position);
    const candidates=[];
    for(const l of sources){
      if(!visibility.get(l).desired||!parentsVisible(l)||l.intensity<=.008||roots&&!within(l,roots))continue;
      l.getWorldPosition(point);
      const d2=point.distanceToSquared(position),range=l.distance||35;
      if(d2>Math.pow(range*1.35,2))continue;
      const score=l.intensity/(1+d2/Math.pow(Math.max(1.5,range*.28),2));
      candidates.push({light:l,score:score*(stats.selected.includes(l.id)?1.12:1)});
    }
    candidates.sort((a,b)=>b.score-a.score||a.light.id-b.light.id);stats.candidates=candidates.length;stats.selected=[];
    for(let i=0;i<budget;i++){
      const dest=pool[i],source=candidates[i]?.light;
      dest.visible=true; // Zero intensity slots still retain the same shader signature.
      if(!source){dest.intensity=0;continue;}
      source.getWorldPosition(dest.position);dest.color.copy(source.color);dest.intensity=source.intensity;
      dest.distance=source.distance;dest.decay=source.decay;stats.selected.push(source.id);
    }
  }
  discover();configure(4);update(camera,true);
  return {update,get stats(){return {...stats,selected:stats.selected.slice()};}};
})();
