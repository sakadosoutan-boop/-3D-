/* Actual world models, one existing WebGL renderer and a separate inspection camera. */
var CODEX_VIEWER;
CODEX_VIEWER=(()=>{
  const dialog=document.createElement("section");dialog.id="codexViewer";dialog.hidden=true;dialog.setAttribute("role","dialog");dialog.setAttribute("aria-modal","true");dialog.setAttribute("aria-labelledby","codexViewerTitle");
  dialog.innerHTML=`<header><div><span class="viewer-eyebrow">図鑑 · 見比べる</span><h2 id="codexViewerTitle"></h2></div><button type="button" id="viewerClose" aria-label="閲覧モードを閉じる">閉じる ×</button></header>
    <div class="viewer-tabs" role="tablist" aria-label="閲覧内容"><button type="button" role="tab" id="viewerGameTab" aria-controls="viewerGamePanel">ゲーム内の姿</button><button type="button" role="tab" id="viewerPhotoTab" aria-controls="viewerPhotoPanel">実物・資料の写真</button></div>
    <div id="viewerGamePanel" role="tabpanel" aria-labelledby="viewerGameTab"><div id="viewerStage" tabindex="0" role="img" aria-label="ゲームの3Dモデル。ドラッグまたは矢印キーで回転、ホイールまたはプラスとマイナスで拡大縮小"></div><div class="viewer-tools"><button type="button" id="viewerLeft" aria-label="左へ回転">↶ 回転</button><button type="button" id="viewerRight" aria-label="右へ回転">回転 ↷</button><button type="button" id="viewerZoomIn" aria-label="拡大">＋</button><button type="button" id="viewerZoomOut" aria-label="縮小">−</button><button type="button" id="viewerReset">正面に戻す</button><button type="button" id="viewerContext" aria-pressed="false">周囲も表示</button></div><p id="viewerGameNote"></p></div>
    <div id="viewerPhotoPanel" role="tabpanel" aria-labelledby="viewerPhotoTab" hidden><div id="viewerPhotoArea"><img id="viewerPhoto" alt=""><p id="viewerPhotoError" hidden>画像を読み込めませんでした。下の出典ページから確認できます。</p></div><div class="viewer-tools"><button type="button" id="viewerPreviousPhoto">前の写真</button><span id="viewerPhotoCount"></span><button type="button" id="viewerNextPhoto">次の写真</button><button type="button" id="viewerPhotoZoom" aria-pressed="false">写真を拡大</button></div><div id="viewerPhotoCaption"></div></div>`;
  document.body.appendChild(dialog);
  const stage=document.getElementById("viewerStage"),viewCamera=new THREE.PerspectiveCamera(42,1,.015,500);
  const target=new THREE.Vector3(),size=new THREE.Vector3(),box=new THREE.Box3(),viewport=new THREE.Vector4(),scissor=new THREE.Vector4();
  const visibility=new Map(),pointers=new Map(),media=CODEX_MEDIA;
  let active=false,id=null,tab="game",roots=[],photos=[],photoIndex=0,isolated=true,azimuth=.25,elevation=.18,distance=3,baseDistance=3,previousFocus=null,oldLabelMode=0,oldCodexOpen=false,pinch=0;
  let comparison=null,question=null;
  const compareBar=document.createElement("div");compareBar.id="viewerCompareBar";compareBar.className="viewer-tools";
  compareBar.innerHTML='<label for="viewerCompareSelect">模型を並べて比べる</label><select id="viewerCompareSelect"><option value="">単体表示</option></select><span>回転・拡大は両方に反映／表示寸法はそれぞれに合わせます</span>';
  document.getElementById("viewerGamePanel").insertBefore(compareBar,stage);
  const stageLabels=document.createElement("div");stageLabels.id="viewerCompareLabels";stageLabels.hidden=true;stage.appendChild(stageLabels);
  const questionPanel=document.createElement("div");questionPanel.id="viewerQuestion";questionPanel.hidden=true;dialog.appendChild(questionPanel);
  function escape(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
  function modelRoots(item){
    const data=interactables[item];let list=(data?.roots||[]).filter(r=>r.parent);
    if(item==="matsu"){
      const near=data?.labelPos||new THREE.Vector3(-46,4.5,48);
      const candidates=SEASONAL.miscTrees.filter(r=>r.userData.treeSpecies==="pine");
      const nearest=candidates.slice().sort((a,b)=>a.position.distanceToSquared(near)-b.position.distanceToSquared(near))[0];list=nearest?[nearest]:[];
    }
    // Repeated objects use one representative, retaining its original pose and placement.
    return list.length?[list.find(isObjVisible)||list[0]]:[];
  }
  function buttons(item){
    const model=modelRoots(item).length>0,hasPhoto=media.some(m=>m.items.includes(item));if(!model&&!hasPhoto)return"";
    return `<div class="codex-view-actions">${model?`<button type="button" data-codex-view="${escape(item)}" data-view-tab="game">3Dで見る</button>`:""}${hasPhoto?`<button type="button" data-codex-view="${escape(item)}" data-view-tab="photo">実物・資料の写真</button>`:""}</div>`;
  }
  function restoreVisibility(){for(const [o,v] of visibility)o.visible=v;visibility.clear();}
  function setVisible(o,v){if(!visibility.has(o))visibility.set(o,o.visible);o.visible=v;}
  function isPart(o){return roots.some(root=>{let p=o;while(p){if(p===root)return true;p=p.parent;}return false;});}
  function mask(){
    restoreVisibility();
    if(isolated){scene.traverse(o=>{if((o.isMesh||o.isSprite||o.isPoints||o.isLine)&&!isPart(o))setVisible(o,false);});}
    labels.forEach(l=>setVisible(l.sp,false));renderer.shadowMap.needsUpdate=true;
    roots.forEach(root=>{
      let p=root;while(p&&p!==scene){setVisible(p,true);p=p.parent;}
      root.traverse(o=>{if(o.userData.heianDetail||o.userData.expression||o.userData.detail)setVisible(o,true);});
    });
    // Face groups are distance LODs; an inspection camera should always expose close details.
    for(const rig of HEIAN_EXPRESSIONS)if(isPart(rig.g))for(const node of [rig.detail,rig.face,rig.eyes])setVisible(node,true);
    const context=document.getElementById("viewerContext");context.textContent=isolated?"周囲も表示":"被写体だけ";context.setAttribute("aria-pressed",String(!isolated));
  }
  function fit(){
    box.makeEmpty();scene.updateMatrixWorld(true);
    const part=new THREE.Box3(),matrix=new THREE.Matrix4(),instance=new THREE.Matrix4();
    roots.forEach(root=>root.traverse(o=>{
      if(!o.geometry)return;o.geometry.computeBoundingBox();const bounds=o.geometry.boundingBox;
      if(o.isInstancedMesh){for(let i=0;i<o.count;i++){o.getMatrixAt(i,instance);matrix.multiplyMatrices(o.matrixWorld,instance);box.union(part.copy(bounds).applyMatrix4(matrix));}}
      else box.union(part.copy(bounds).applyMatrix4(o.matrixWorld));
    }));
    if(box.isEmpty()){target.set(0,1,0);size.set(1,1,1);}else{box.getCenter(target);box.getSize(size);}
    const radius=Math.max(.28,size.length()*.5);baseDistance=Math.max(.7,radius/Math.tan(THREE.MathUtils.degToRad(viewCamera.fov*.5))*1.12);
    distance=baseDistance;azimuth=.25;elevation=.18;viewCamera.far=Math.max(250,baseDistance*8);viewCamera.updateProjectionMatrix();
  }
  function open(item,initial="game"){
    if(!ITEMS[item]||!codexUnlocked.has(item))return false;
    if(active)close(false,false);resetInputState();active=true;id=item;roots=modelRoots(item);photos=media.filter(m=>m.items.includes(item));photoIndex=0;
    previousFocus=document.activeElement;oldLabelMode=APP.labelMode;oldCodexOpen=APP.codexOpen;APP.labelMode=0;APP.codexOpen=true;
    comparison=null;question=null;questionPanel.hidden=true;dialog.classList.remove("identification");stageLabels.hidden=true;compareBar.hidden=false;
    document.getElementById("viewerContext").disabled=false;stage.setAttribute("aria-label","ゲームの3Dモデル。ドラッグまたは矢印キーで回転、ホイールまたはプラスとマイナスで拡大縮小");
    const select=document.getElementById("viewerCompareSelect");select.innerHTML='<option value="">単体表示</option>'+Object.keys(ITEMS).filter(other=>other!==item&&codexUnlocked.has(other)&&modelRoots(other).length).map(other=>`<option value="${escape(other)}">${escape(ITEMS[other].n)}</option>`).join("");
    isolated=ITEMS[item].cat!=="b";dialog.hidden=false;document.body.classList.add("codex-viewing");document.getElementById("codexViewerTitle").textContent=ITEMS[item].n;
    document.getElementById("viewerGameTab").disabled=!roots.length;
    const hidden=roots.some(r=>!isObjVisible(r));mask();fit();
    document.getElementById("viewerGameNote").textContent="ゲームで使うモデルと材質を表示しています。ドラッグで回転、ホイール・2本指で拡大縮小。"+(hidden?" 現在の季節・時刻では邸内に現れない被写体を単体で表示しています。":" 季節と光は現在のゲームの状態です。");
    setTab(initial==="game"&&roots.length?"game":"photo");document.getElementById("viewerClose").focus();return true;
  }
  function close(restoreFocus=true,notifyCancel=true){
    if(!active)return;const abandoned=notifyCancel?question?.cancel:null;active=false;question=null;comparison=null;restoreVisibility();pointers.clear();pinch=0;dialog.hidden=true;document.body.classList.remove("codex-viewing");
    APP.labelMode=oldLabelMode;APP.codexOpen=oldCodexOpen;resetInputState();clock.oldTime=performance.now();
    renderer.shadowMap.needsUpdate=true;renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);if(restoreFocus&&previousFocus?.isConnected)previousFocus.focus();
    if(abandoned)abandoned();
  }
  function setTab(which){
    if(question&&which!=="game")return;
    tab=which;const game=tab==="game";document.getElementById("viewerGamePanel").hidden=!game;document.getElementById("viewerPhotoPanel").hidden=game;
    dialog.classList.toggle("photo-tab",!game);
    for(const [name,selected] of [["Game",game],["Photo",!game]]){const el=document.getElementById("viewer"+name+"Tab");el.setAttribute("aria-selected",String(selected));el.tabIndex=selected?0:-1;}
    pointers.clear();pinch=0;if(!game)photo();else render();
  }
  function photo(){
    const m=photos[photoIndex],image=document.getElementById("viewerPhoto"),caption=document.getElementById("viewerPhotoCaption"),error=document.getElementById("viewerPhotoError");error.hidden=true;
    image.classList.remove("zoomed");document.getElementById("viewerPhotoZoom").setAttribute("aria-pressed","false");
    if(!m){image.hidden=true;image.removeAttribute("src");caption.textContent="この項目の写真はまだ同梱していません。ゲーム内のモデルは「ゲーム内の姿」から閲覧できます。";}else{
      image.hidden=false;image.alt=m.caption;image.src=location.protocol==="file:"?m.dataUrl:m.src;image.dataset.inlineFallback="0";
      caption.innerHTML=`<h3>${escape(m.caption)}</h3><p>${escape(m.note)}</p><p class="viewer-credit">作者・所蔵: ${escape(m.author)} · <a href="${escape(m.source)}" target="_blank" rel="noopener noreferrer">出典ページ</a>${m.collectionSource?` · <a href="${escape(m.collectionSource)}" target="_blank" rel="noopener noreferrer">所蔵館の資料情報</a>`:""} · <a href="${escape(m.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escape(m.license)}</a></p><p class="viewer-credit">${escape(m.changes)}</p>`;
    }
    document.getElementById("viewerPhotoCount").textContent=m?`${photoIndex+1} / ${photos.length}`:"0 / 0";
    for(const button of ["viewerPreviousPhoto","viewerNextPhoto"])document.getElementById(button).disabled=photos.length<2;
    document.getElementById("viewerPhotoZoom").disabled=!m;
  }
  document.getElementById("viewerPhoto").onerror=()=>{
    const image=document.getElementById("viewerPhoto"),m=photos[photoIndex];
    if(m?.dataUrl&&image.dataset.inlineFallback!=="1"){image.dataset.inlineFallback="1";image.src=m.dataUrl;return;}
    document.getElementById("viewerPhotoError").hidden=false;
  };
  function render(){
    if(!active||tab!=="game"||!roots.length)return;
    const r=stage.getBoundingClientRect();if(r.width<1||r.height<1)return;
    renderer.getViewport(viewport);renderer.getScissor(scissor);const wasScissor=renderer.getScissorTest();
    try{
      renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.clear();
      const originalRoots=roots;
      const panels=comparison?[{roots:originalRoots,target:target.clone(),base:baseDistance},{roots:comparison.roots,target:comparison.target,base:comparison.base}]:[{roots:originalRoots,target:target.clone(),base:baseDistance}];
      try{panels.forEach((panel,index)=>{
        if(comparison){roots=panel.roots;mask();}
        const width=r.width/panels.length,left=r.left+index*width;
        const safeDistance=panel.base*(distance/baseDistance)/Math.min(1,width/r.height);
        viewCamera.aspect=width/r.height;viewCamera.position.set(panel.target.x+Math.sin(azimuth)*Math.cos(elevation)*safeDistance,panel.target.y+Math.sin(elevation)*safeDistance,panel.target.z+Math.cos(azimuth)*Math.cos(elevation)*safeDistance);
        viewCamera.lookAt(panel.target);viewCamera.updateProjectionMatrix();viewCamera.updateMatrixWorld(true);
        renderer.setViewport(left,innerHeight-r.bottom,width,r.height);renderer.setScissor(left,innerHeight-r.bottom,width,r.height);renderer.setScissorTest(true);renderer.render(scene,viewCamera);
      });}finally{roots=originalRoots;if(comparison)mask();}
    }finally{renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(wasScissor);}
  }
  // Render original world models in two scissored views. No clones, owned GPU resources or world transforms.
  function compare(other){
    if(!active||question||other===id)return false;
    if(other&&(!ITEMS[other]||!codexUnlocked.has(other)||!modelRoots(other).length))return false;
    comparison=null;stageLabels.hidden=!other;
    if(other){
      const saved={roots,target:target.clone(),size:size.clone(),baseDistance,distance,azimuth,elevation,far:viewCamera.far};
      roots=modelRoots(other);fit();comparison={id:other,roots,target:target.clone(),base:baseDistance};
      roots=saved.roots;target.copy(saved.target);size.copy(saved.size);baseDistance=saved.baseDistance;distance=saved.distance;azimuth=saved.azimuth;elevation=saved.elevation;viewCamera.far=Math.max(saved.far,viewCamera.far);
      isolated=true;stageLabels.innerHTML=`<span>${escape(ITEMS[id].n)}</span><span>${escape(ITEMS[other].n)}</span>`;
    }
    document.getElementById("viewerCompareSelect").value=other||"";document.getElementById("viewerContext").disabled=!!comparison;mask();render();return true;
  }
  function openQuestion(item,options,onAnswer,onCancel,caption){
    if(!options.includes(item)||options.some(option=>!ITEMS[option]||!codexUnlocked.has(option)))return false;
    if(!open(item,"game")||!roots.length){close();return false;}
    question={answer:onAnswer,cancel:onCancel};isolated=true;mask();azimuth=Math.random()*Math.PI*2;elevation=.12+Math.random()*.3;
    dialog.classList.add("identification");compareBar.hidden=true;document.getElementById("codexViewerTitle").textContent=caption||"模型の形を見て答えよう";
    stage.setAttribute("aria-label","識別問題の模型。ドラッグまたは矢印キーで回転できます");
    document.getElementById("viewerGameNote").textContent="場所・札・周囲を隠しています。回転して形や構造を確かめ、名前を選んでください。";
    questionPanel.hidden=false;questionPanel.innerHTML='<p id="viewerQuestionFeedback" role="status" aria-live="polite"></p><div class="learning-answers">'+options.map(option=>`<button type="button" data-model-answer="${escape(option)}">${escape(ITEMS[option].n)}</button>`).join("")+"</div>";render();return true;
  }
  function questionFeedback(correct){
    const status=document.getElementById("viewerQuestionFeedback");if(status)status.textContent=correct?"正解。次の問題へ進みます。":"形をもう一度確かめて選びましょう。";
    if(correct){questionPanel.querySelectorAll("button").forEach(b=>b.disabled=true);if(question)question.cancel=null;}
  }
  questionPanel.onclick=e=>{const b=e.target.closest("[data-model-answer]");if(b&&!b.disabled&&question)question.answer(b.dataset.modelAnswer);};
  document.getElementById("viewerCompareSelect").onchange=e=>compare(e.target.value);
  function zoom(factor){distance=THREE.MathUtils.clamp(distance*factor,baseDistance*.27,baseDistance*3.8);render();}
  function rotate(x,y=0){azimuth+=x;elevation=THREE.MathUtils.clamp(elevation+y,-.65,1.20);render();}
  stage.addEventListener("pointerdown",e=>{e.preventDefault();stage.focus();stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}});
  stage.addEventListener("pointermove",e=>{
    const previous=pointers.get(e.pointerId);if(!previous)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch>0&&d>0)zoom(pinch/d);pinch=d;}else rotate(-(e.clientX-previous.x)*.008,(e.clientY-previous.y)*.007);
  });
  for(const type of ["pointerup","pointercancel","lostpointercapture"])stage.addEventListener(type,e=>{pointers.delete(e.pointerId);pinch=0;});
  stage.addEventListener("wheel",e=>{e.preventDefault();zoom(Math.exp(Math.sign(e.deltaY)*.12));},{passive:false});
  document.getElementById("viewerClose").onclick=()=>close();
  document.getElementById("viewerGameTab").onclick=()=>setTab("game");document.getElementById("viewerPhotoTab").onclick=()=>setTab("photo");
  document.getElementById("viewerLeft").onclick=()=>rotate(-.3);document.getElementById("viewerRight").onclick=()=>rotate(.3);
  document.getElementById("viewerZoomIn").onclick=()=>zoom(.82);document.getElementById("viewerZoomOut").onclick=()=>zoom(1.22);
  document.getElementById("viewerReset").onclick=()=>{fit();render();};document.getElementById("viewerContext").onclick=()=>{isolated=!isolated;mask();render();};
  document.getElementById("viewerPreviousPhoto").onclick=()=>{photoIndex=(photoIndex+photos.length-1)%photos.length;photo();};document.getElementById("viewerNextPhoto").onclick=()=>{photoIndex=(photoIndex+1)%photos.length;photo();};
  document.getElementById("viewerPhotoZoom").onclick=e=>{const on=document.getElementById("viewerPhoto").classList.toggle("zoomed");e.currentTarget.setAttribute("aria-pressed",String(on));};
  document.getElementById("codexDetail").addEventListener("click",e=>{const b=e.target.closest("[data-codex-view]");if(b)open(b.dataset.codexView,b.dataset.viewTab);});
  addEventListener("keydown",e=>{
    if(!active)return;e.stopImmediatePropagation();
    if(e.key==="Escape"){e.preventDefault();close();return;}
    if(e.key==="Tab"){
      const all=[...dialog.querySelectorAll("button:not(:disabled),select:not(:disabled),summary,a[href],[tabindex='0']")].filter(el=>el.getClientRects().length);
      const first=all[0],last=all[all.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;
    }
    if(e.target.getAttribute("role")==="tab"&&["ArrowLeft","ArrowRight"].includes(e.key)){e.preventDefault();if(roots.length){setTab(tab==="game"?"photo":"game");document.getElementById(tab==="game"?"viewerGameTab":"viewerPhotoTab").focus();}return;}
    if(e.target===stage){const actions={ArrowLeft:()=>rotate(-.12),ArrowRight:()=>rotate(.12),ArrowUp:()=>rotate(0,.08),ArrowDown:()=>rotate(0,-.08),"+":()=>zoom(.88),"=":()=>zoom(.88),"-":()=>zoom(1.12)};if(actions[e.key]){e.preventDefault();actions[e.key]();}}
  },true);
  addEventListener("resize",()=>{if(active)render();});
  return {open,close,render,buttons,modelRoots,setTab,zoom,rotate,compare,openQuestion,questionFeedback,get active(){return active;},get item(){return id;},get tab(){return tab;},get camera(){return viewCamera;},get distance(){return distance;},get comparison(){return comparison?.id||null;},get question(){return !!question;}};
})();
