/* Static architecture batching, reversible detail LOD, and local device measurements. */
var SELECTED_PERFORMANCE;
SELECTED_PERFORMANCE=(()=>{
  const fixed=new Set(['tsuiji','shikyakumon','tai_e','tai_w','tai_n','watadono','sukiwatadono','chumonro','chumon','tsuridono','sunoko','hisashi','moya','kouran','kizahashi','nurigome','shinden','iko','kyoudai','koto','biwa','sho','ryuteki','kurumayadori','michoudai','shitone','tatami','kichou','byoubu','kabeshiro','nikaizushi','kyousoku','takatsuki','kyouzukue','fubako','takimono','kame','fusego','emaki_desk','onmyo_shikiban','monban']);
  const merged=[],lod=[],sources=[],lowCache=new Map();let batched=false,lastLOD=-10,session=null,lastFrame=null;
  const point=new THREE.Vector3(),inv=new THREE.Matrix4(),transform=new THREE.Matrix4();
  const vertices=g=>g.index?g.index.count:g.attributes.position.count;
  function reducedPrimitive(g){
    if(lowCache.has(g))return lowCache.get(g);
    if(Object.values(HEIAN_GEO).includes(g)&&g!==HEIAN_GEO.sphere){lowCache.set(g,g);return g;}
    const p=g.parameters;let low=null;
    // Only unmodified factory primitives are eligible; textile, foliage and roof profiles keep their own LOD.
    if(p&&g.type==='CylinderGeometry'&&p.radialSegments>7)low=new THREE.CylinderGeometry(p.radiusTop,p.radiusBottom,p.height,6,p.heightSegments,p.openEnded,p.thetaStart,p.thetaLength);
    if(p&&g.type==='SphereGeometry'&&p.widthSegments>10&&p.heightSegments>7)low=new THREE.SphereGeometry(p.radius,8,6,p.phiStart,p.phiLength,p.thetaStart,p.thetaLength);
    if(low){for(const name of Object.keys(g.attributes))if(!low.attributes[name]){if(name==='uv2')low.setAttribute('uv2',low.attributes.uv);else if(name==='color'&&g.attributes[name].array.every(v=>v===1))low.setAttribute('color',new THREE.BufferAttribute(new Float32Array(low.attributes.position.count*3).fill(1),3));else{low.dispose();low=null;break;}}}
    lowCache.set(g,low||g);return low||g;
  }
  function combine(b,reduced){
    inv.copy(b.root.matrixWorld).invert();const geometries=[],instance=new THREE.Matrix4();
    for(const o of b.items){const base=reduced?reducedPrimitive(o.geometry):o.geometry;const n=o.isInstancedMesh?o.count:1;
      for(let i=0;i<n;i++){const g=base.index?base.toNonIndexed():base.clone();transform.multiplyMatrices(inv,o.matrixWorld);if(o.isInstancedMesh){o.getMatrixAt(i,instance);transform.multiply(instance);}g.applyMatrix4(transform);geometries.push(g);}}
    const geo=new THREE.BufferGeometry();
    for(const name of b.attributes.split(',')){const size=geometries[0].attributes[name].itemSize,total=geometries.reduce((n,g)=>n+g.attributes[name].array.length,0),data=new Float32Array(total);let offset=0;for(const g of geometries){data.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;}geo.setAttribute(name,new THREE.BufferAttribute(data,size));}
    geometries.forEach(g=>g.dispose());geo.computeBoundingBox();geo.computeBoundingSphere();return geo;
  }
  function mergeStatic(){
    if(batched||APP.map==='kamakura'||/[?&]nobatch=1/.test(location.search))return;
    batched=true;scene.updateMatrixWorld(true);const groups=new Map();
    scene.traverse(o=>{
      if(!o.isMesh||!o.visible||o.instanceColor||o.userData.staticBatchSource||o.userData.noStaticBatch||!fixed.has(o.userData.iid)||!o.geometry||Array.isArray(o.material)||o.material.transparent)return;
      if(o.userData.architecturalDetail)return;
      if(o.geometry.userData.roofProfile||o.geometry.morphAttributes.position||o.geometry.attributes.skinIndex)return;
      const names=Object.keys(o.geometry.attributes).sort(),attributes=names.join(',');if(!names.includes('position')||!names.includes('normal')||names.some(n=>!['normal','position','uv','uv2','color'].includes(n)))return;
      let root=o.parent;const roots=interactables[o.userData.iid]?.roots||[];
      while(root&&root!==scene&&!roots.includes(root))root=root.parent;root=root||scene;
      // A moving hinge or seasonal ancestor remains an independent object.
      for(let p=o;p;p=p.parent){
        if(p.userData.noStaticBatch||p.userData.gim||p.userData.heianFigure)return;
        const data=p.userData,moving=[data.head,data.body,...(data.arms||[]),...(data.legs||[])].filter(Boolean);
        for(let q=o;q&&q!==p;q=q.parent)if(moving.includes(q))return;
        if(p===root)break;
      }
      o.getWorldPosition(point);const cell=`${Math.floor(point.x/20)},${Math.floor(point.z/20)}`;
      const key=[root.uuid,o.userData.iid,o.material.uuid,attributes,+o.castShadow,+o.receiveShadow,cell].join('|');
      if(!groups.has(key))groups.set(key,{root,id:o.userData.iid,material:o.material,cast:o.castShadow,receive:o.receiveShadow,items:[],attributes});groups.get(key).items.push(o);
    });
    groups.forEach(b=>{
      if(b.items.length<3)return;const geo=combine(b,false);
      const m=new THREE.Mesh(geo,b.material);m.name='architecture-merged-'+b.id;m.userData.iid=b.id;m.userData.staticBatch=true;m.userData.selectedBatch=true;m.castShadow=b.cast;m.receiveShadow=b.receive;b.root.add(m);rayTargets.push(m);merged.push(m);
      b.items.forEach(o=>{o.visible=false;o.userData.staticBatchSource=true;o.userData.selectedMergeSource=true;sources.push(o);});
      if(b.items.some(o=>reducedPrimitive(o.geometry)!==o.geometry))lod.push({mesh:m,high:geo,low:combine(b,true)});
    });
    // Geometry is immutable; far detail can be reduced without destroying full-quality meshes.
    scene.traverse(o=>{
      if(!o.isMesh||!o.visible||o.userData.staticBatchSource||!o.userData.iid||o.userData.noStaticBatch||!fixed.has(o.userData.iid))return;
      if(o.geometry.userData.roofProfile||o.userData.architecturalDetail)return;
      const low=reducedPrimitive(o.geometry);if(low!==o.geometry)lod.push({mesh:o,high:o.geometry,low});
    });
  }
  function update(t){
    const now=performance.now();
    if(session){
      if(document.hidden){lastFrame=null;session.interruptions++;return;}
      if(lastFrame!==null){const elapsed=now-lastFrame;if(elapsed>0&&elapsed<1500){session.times.push(elapsed);session.calls.push(renderer.info.render.calls);session.geometries.push(renderer.info.memory.geometries);session.textures.push(renderer.info.memory.textures);}}
      lastFrame=now;
      if(now-session.start>=session.duration)finish();
      else if(now-session.uiAt>500){session.uiAt=now;document.getElementById('deviceMeasureStatus').textContent=`測定中 ${Math.floor((now-session.start)/1000)} / ${session.duration/1000}秒。いつものように操作してください。`;}
    }
    if(t-lastLOD<.6&&t>=lastLOD)return;lastLOD=t;
    const eco=!!window.LOW_POWER?.active;
    for(const r of lod){r.mesh.getWorldPosition(point);r.mesh.geometry=eco&&!window.CODEX_VIEWER?.active&&point.distanceToSquared(camera.position)>144?r.low:r.high;}
  }
  const panel=document.createElement('section');panel.id='deviceMeasurement';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','端末の測定');
  panel.innerHTML='<div><h2>この端末の動作を測る</h2><p>iPhone / iPadではSafariで開き、普段の操作を続けてください。結果は端末内だけで保存します。</p><label>機種名 <input id="deviceMeasureName" placeholder="例：iPhone 13 / iPad 第9世代"></label><label>測定時間 <select id="deviceMeasureDuration"><option value="60">1分（短い確認）</option><option value="300" selected>5分</option><option value="900">15分（長時間）</option></select></label><label>開始時の電池 (%) <input id="deviceBatteryBefore" type="number" min="0" max="100"></label><button id="deviceMeasureStart">測定して散策する</button><button id="deviceMeasureClose">閉じる</button><p id="deviceMeasureStatus" aria-live="polite">測定前です。描画FPSと描画回数、メモリの変化を記録します。</p><div id="deviceMeasureResult" hidden><label>終了時の電池 (%) <input id="deviceBatteryAfter" type="number" min="0" max="100"></label><label>触れたときの熱 <select id="deviceMeasureHeat"><option value="unknown">未確認</option><option value="none">気にならない</option><option value="warm">少し温かい</option><option value="hot">熱く感じる</option></select></label><pre id="deviceMeasureSummary"></pre><button id="deviceMeasureDownload">結果を保存 (JSON)</button></div></div>';
  document.body.append(panel);const button=document.createElement('button');button.className='tb-btn';button.id='deviceMeasureOpen';button.textContent='iPhone / iPad・端末の測定';document.getElementById('gfxClose').before(button);
  let result=null,priorFocus=null;
  function open(){priorFocus=document.activeElement;panel.hidden=false;document.getElementById('deviceMeasureStart').focus();}
  function close(){panel.hidden=true;priorFocus?.focus();}
  const median=a=>{const b=a.slice().sort((x,y)=>x-y);return b.length?b[Math.floor(b.length/2)]:null;};
  function finish(){
    if(!session)return null;const s=session;session=null;lastFrame=null;
    const percentile=(a,p)=>{const b=a.slice().sort((x,y)=>x-y);return b.length?b[Math.floor((b.length-1)*p)]:null;};
    result={version:1,measuredAt:new Date().toISOString(),model:s.model,userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight,devicePixelRatio],durationSeconds:(performance.now()-s.start)/1000,samples:s.times.length,
      fpsMedian:s.times.length?+(1000/median(s.times)).toFixed(1):null,frameMs95:percentile(s.times,.95),drawCallsMedian:median(s.calls),geometriesFirst:s.geometries[0]??null,geometriesLast:s.geometries.at(-1)??null,texturesFirst:s.textures[0]??null,texturesLast:s.textures.at(-1)??null,hiddenInterruptions:s.interruptions,
      batteryBefore:s.batteryBefore,batteryAfter:null,heat:'unknown',quality:typeof GFX!=='undefined'?GFX.preset:null,heapBytes:performance.memory?.usedJSHeapSize??null,note:'端末表面温度・電池は手入力。描画資源数はGPUメモリのバイト数ではありません。'};
    document.getElementById('deviceMeasureResult').hidden=false;document.getElementById('deviceMeasureStatus').textContent='測定が終わりました。電池と熱の状態を記入して保存できます。';document.getElementById('deviceMeasureSummary').textContent=`中央値 ${result.fpsMedian??'未計測'} FPS\n遅いフレーム (95%) ${result.frameMs95?.toFixed(1)??'未計測'} ms\n描画回数 中央値 ${result.drawCallsMedian??'未計測'}\n形状 ${result.geometriesFirst} → ${result.geometriesLast}\nテクスチャ ${result.texturesFirst} → ${result.texturesLast}`;open();return result;
  }
  function number(id){const value=document.getElementById(id).value;if(value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=100?n:null;}
  button.onclick=open;document.getElementById('deviceMeasureClose').onclick=close;
  document.getElementById('deviceMeasureStart').onclick=()=>{const seconds=Number(document.getElementById('deviceMeasureDuration').value);session={start:performance.now(),duration:[60,300,900].includes(seconds)?seconds*1000:300000,model:document.getElementById('deviceMeasureName').value.trim().slice(0,100),batteryBefore:number('deviceBatteryBefore'),times:[],calls:[],geometries:[],textures:[],interruptions:0,uiAt:0};result=null;lastFrame=null;document.getElementById('deviceMeasureResult').hidden=true;close();document.getElementById('gfx').style.display='none';closePauseMenu();if(APP.mode==='title')enterMode('walk');toast('端末の測定を始めました。終了すると結果が開きます',2600);};
  document.getElementById('deviceMeasureDownload').onclick=()=>{if(!result)return;result.batteryAfter=number('deviceBatteryAfter');result.heat=document.getElementById('deviceMeasureHeat').value;const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='shinden-device-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  panel.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}
    if(e.key==='Tab'){const list=[...panel.querySelectorAll('button,input,select')].filter(el=>!el.disabled&&el.getClientRects().length);const index=list.indexOf(document.activeElement),next=(index+(e.shiftKey?-1:1)+list.length)%list.length;e.preventDefault();list[next]?.focus();}
  },true);
  document.addEventListener('visibilitychange',()=>{lastFrame=null;if(session&&document.hidden)session.interruptions++;});
  mergeStatic();
  if(window.CODEX_VIEWER)for(const method of ['open','openQuestion','compare']){const original=CODEX_VIEWER[method];if(original)CODEX_VIEWER[method]=function(...args){for(const r of lod)r.mesh.geometry=r.high;return original.apply(this,args);};}
  return{update,finish,open,get active(){return !!session;},get result(){return result;},get batches(){return merged;},get stats(){const active=lod.filter(r=>r.mesh.geometry===r.low);return {batches:merged.length,sources:sources.length,lod:lod.length,lodActive:active.length,trianglesSaved:active.reduce((n,r)=>n+(vertices(r.high)-vertices(r.low))/3,0)};}};
})();
