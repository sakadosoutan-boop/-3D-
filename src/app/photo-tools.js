var PHOTO_TOOLS;
PHOTO_TOOLS=(()=>{
  const KEY="shinden3d-photo-positions-v1";
  const panel=document.createElement("div");panel.id="photoTools";panel.setAttribute("aria-label","撮影の構図");
  panel.innerHTML=`<div class="photo-tool-row"><label>画角 <input id="photoFov" type="range" min="28" max="90" value="62"><output id="photoFovValue">62°</output></label><button type="button" id="photoGrid" aria-pressed="false">三分割線</button></div>
    <div class="photo-tool-row"><label class="photo-subject-label">被写体 <select id="photoSubject"><option value="">選んで注目</option></select></label><button type="button" id="photoFocus">注目</button></div>
    <div class="photo-tool-row"><button type="button" id="photoSave">撮影位置を保存</button><select id="photoPositions" aria-label="保存した撮影位置"><option value="">保存した位置</option></select><button type="button" id="photoRestore">戻る</button><button type="button" id="photoDelete">削除</button></div><p id="photoStatus" role="status">移動と視点操作は散策と同じです。位置は5件まで保存できます。</p>`;
  document.body.appendChild(panel);
  const grid=document.createElement("div");grid.id="photoCompositionGrid";grid.setAttribute("aria-hidden","true");document.body.appendChild(grid);
  const seasonRow=document.createElement("div");seasonRow.className="gfx-row";
  seasonRow.innerHTML=`<label for="seasonProgress">季節の進み <output id="seasonProgressLabel">開花途中</output></label><input id="seasonProgress" type="range" min="0" max="100" value="50" aria-label="季節の進み"><small>春は開花、秋は色付き、冬は積雪と融け残りを調整できます。</small>`;
  const gfxPhoto=document.getElementById("gfxPhoto");gfxPhoto?.closest(".gfx-row")?.after(seasonRow);
  document.getElementById("seasonProgress").addEventListener("input",e=>VISUAL_EXPERIENCE?.setProgress(+e.target.value/100));
  let active=false,originalFov=62,fov=62,saved=[];
  function valid(s){return s&&s.version===1&&["heian","kamakura"].includes(s.map)&&["fp","ov"].includes(s.view)&&
    Array.isArray(s.pos)&&s.pos.length===3&&s.pos.every(Number.isFinite)&&Math.abs(s.pos[0])<200&&Math.abs(s.pos[2])<200&&s.pos[1]>=0&&s.pos[1]<150&&
    Number.isFinite(s.yaw)&&Number.isFinite(s.pitch)&&s.pitch>=-1.5&&s.pitch<=1.5&&Number.isFinite(s.fov)&&s.fov>=28&&s.fov<=90&&["spring","summer","autumn","winter"].includes(s.season)&&["day","dawn","dusk","night"].includes(s.time)&&typeof s.name==="string"&&s.name.length<80;}
  try{const v=JSON.parse(localStorage.getItem(KEY)||"[]");if(Array.isArray(v))saved=v.filter(valid).slice(0,5);}catch(e){}
  function status(s){document.getElementById("photoStatus").textContent=s;}
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(saved));return true;}catch(e){status("保存容量が不足しています。今の画面はそのまま撮影できます。");return false;}}
  function options(){
    const select=document.getElementById("photoPositions"),old=select.value;select.replaceChildren(new Option("保存した位置",""));
    saved.forEach((s,i)=>{const option=new Option(s.name+" · "+SEASONS[s.season].name,String(i));option.disabled=s.map!==(APP.map||"heian");select.add(option);});select.value=old;
  }
  function set(on){
    if(on===active)return;active=on;resetInputState();
    if(on){
      originalFov=camera.fov;fov=THREE.MathUtils.clamp(camera.fov,28,90);document.getElementById("photoFov").value=fov;
      document.getElementById("photoFovValue").textContent=Math.round(fov)+"°";
      const select=document.getElementById("photoSubject");select.replaceChildren(new Option("選んで注目",""));
      for(const id of codexUnlocked){const it=ITEMS[id],root=interactables[id]?.roots.find(isObjVisible);if(it&&root)select.add(new Option(it.n,id));}
      options();document.getElementById("photoSave").disabled=APP.mode!=="walk";
      status(APP.mode==="walk"?"移動と視点操作は散策と同じです。位置は5件まで保存できます。":"画角と構図線を調整できます。位置の保存は自由散策で使えます。");
    }else{camera.fov=originalFov;camera.updateProjectionMatrix();grid.classList.remove("show");document.getElementById("photoGrid").setAttribute("aria-pressed","false");}
  }
  document.getElementById("photoFov").oninput=e=>{fov=+e.target.value;document.getElementById("photoFovValue").textContent=fov+"°";update();};
  document.getElementById("photoGrid").onclick=e=>{const on=grid.classList.toggle("show");e.currentTarget.setAttribute("aria-pressed",String(on));};
  function focus(id){
    if(!codexUnlocked.has(id))return false;
    const root=interactables[id]?.roots.find(isObjVisible);if(!root){status("この季節・時刻では被写体が見えません。");return false;}
    const bounds=new THREE.Box3().setFromObject(root),target=bounds.getCenter(new THREE.Vector3());
    if(!Number.isFinite(target.x))return false;
    const direction=target.sub(player.pos);player.yaw=Math.atan2(-direction.x,-direction.z);player.pitch=THREE.MathUtils.clamp(Math.atan2(direction.y,Math.hypot(direction.x,direction.z)),-1.45,1.45);APP.view="fp";
    status(ITEMS[id].n+"へ視点を向けました。");resetInputState();return true;
  }
  document.getElementById("photoFocus").onclick=()=>focus(document.getElementById("photoSubject").value);
  function save(){
    if(APP.mode!=="walk")return false;if(saved.length>=5){status("5件保存済みです。不要な位置を選び、削除してから保存してください。");return false;}
    const id=document.getElementById("photoSubject").value;
    const snapshot={version:1,map:APP.map||"heian",view:APP.view==="ov"?"ov":"fp",pos:player.pos.toArray(),yaw:player.yaw,pitch:player.pitch,fov,season:APP.season,time:APP.time,name:(ITEMS[id]?.n||"撮影位置")+" "+(saved.length+1)};
    if(!valid(snapshot))return false;saved.push(snapshot);if(!persist()){saved.pop();return false;}options();document.getElementById("photoPositions").value=String(saved.length-1);status("今の位置・画角・季節・時刻を保存しました。");return true;
  }
  function restore(index){
    const s=saved[index];if(!active||APP.mode!=="walk"||!valid(s)||s.map!==(APP.map||"heian"))return false;
    resetInputState();player.pos.fromArray(s.pos);player.yaw=s.yaw;player.pitch=s.pitch;APP.view=s.view;fov=s.fov;
    applySeason(s.season);setTime(s.time);document.getElementById("photoFov").value=fov;document.getElementById("photoFovValue").textContent=fov+"°";status(s.name+"の構図を復元しました。");update();return true;
  }
  document.getElementById("photoSave").onclick=save;
  document.getElementById("photoRestore").onclick=()=>{const v=document.getElementById("photoPositions").value;if(v!=="")restore(+v);};
  document.getElementById("photoDelete").onclick=()=>{const v=document.getElementById("photoPositions").value;if(v==="")return;const backup=saved.slice();saved.splice(+v,1);if(!persist())saved=backup;options();status("選んだ撮影位置を削除しました。");};
  function update(){if(active&&camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}}
  options();return {set,update,save,restore,focus,valid,get active(){return active;},get saved(){return saved.map(s=>({...s,pos:s.pos.slice()}));}};
})();
