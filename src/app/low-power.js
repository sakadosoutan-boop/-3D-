(function(){
"use strict";
const STORAGE_KEY="lowPowerMode";
let active=false,previous=null;

function prefGet(key,fallback){
  try{const value=PREFS.get(key);return value==null?fallback:value;}catch(e){return fallback;}
}
function prefSet(key,value){try{PREFS.set(key,value);}catch(e){}}
function fpsButtons(value){
  [["gfxFc_30",30],["gfxFc_60",60],["gfxFc_0",0]].forEach(([id,n])=>{
    const button=document.getElementById(id);if(button)button.classList.toggle("on",n===value);
  });
}
function setFps(value){APP_FPSCAP=value;fpsButtons(value);}
function particleGroups(){
  const groups=[];
  if(typeof petals!=="undefined"&&petals)groups.push(petals);
  if(typeof autumnLeaves!=="undefined"&&autumnLeaves)groups.push(autumnLeaves);
  if(typeof leaves!=="undefined"&&leaves&&leaves.isObject3D)groups.push(leaves);
  if(typeof snowFall!=="undefined"&&snowFall)groups.push(snowFall);
  if(typeof rainFall!=="undefined"&&rainFall)groups.push(rainFall);
  if(typeof fireflies!=="undefined"&&fireflies)groups.push(fireflies);
  if(typeof tourouGroup!=="undefined"&&tourouGroup)groups.push(tourouGroup);
  return groups;
}
function syncUi(){
  const on=document.getElementById("gfxEco_on"),off=document.getElementById("gfxEco_off");
  if(on)on.classList.toggle("on",active);
  if(off)off.classList.toggle("on",!active);
  ["gfxP_auto","gfxP_high","gfxP_medium","gfxP_low","gfxB_auto","gfxB_on","gfxB_off","gfxFc_30","gfxFc_60","gfxFc_0"].forEach(id=>{
    const button=document.getElementById(id);if(button)button.disabled=active;
  });
  const note=document.getElementById("gfxEcoNote");
  if(note)note.textContent=active?"30fps・影なし・発光と季節粒子を停止中":"通常設定を使用中";
}
function apply(on,{persist=true,silent=false}={}){
  on=!!on;
  if(on===active){syncUi();return active;}
  if(on){
    previous={
      quality:typeof GFX!=="undefined"?GFX.preset:"auto",
      bloom:typeof GFX!=="undefined"?GFX.bloom:"auto",
      fps:APP_FPSCAP,
      shadows:!!(renderer&&renderer.shadowMap&&renderer.shadowMap.enabled)
    };
    active=true;
    if(typeof QUALITY!=="undefined")QUALITY.setForced(3);
    if(typeof BLOOM!=="undefined")BLOOM.setMode("off");
    setFps(30);
    if(renderer&&renderer.shadowMap)renderer.shadowMap.enabled=false;
    particleGroups().forEach(group=>{group.visible=false;});
  }else{
    active=false;
    const restore=previous||{
      quality:prefGet("gfxPreset","auto"),bloom:prefGet("gfxBloom","auto"),
      fps:+prefGet("fpscap",IS_TOUCH?30:60),shadows:true
    };
    if(typeof GFX!=="undefined"){
      GFX.setPreset(restore.quality||"auto");
      GFX.setBloom(restore.bloom||"auto");
    }else{
      if(typeof QUALITY!=="undefined")QUALITY.setForced(null);
      if(typeof BLOOM!=="undefined")BLOOM.setMode(restore.bloom||"auto");
    }
    setFps(Number.isFinite(+restore.fps)?+restore.fps:(IS_TOUCH?30:60));
    if(renderer&&renderer.shadowMap){renderer.shadowMap.enabled=restore.shadows!==false;renderer.shadowMap.needsUpdate=true;}
    previous=null;
    if(typeof applySeason==="function"&&APP&&APP.season)applySeason(APP.season);
  }
  if(persist)prefSet(STORAGE_KEY,on?"1":"0");
  syncUi();
  if(!silent&&typeof beep==="function")beep(on?420:620,.05,"triangle",.05);
  if(!silent&&typeof toast==="function")toast(on?"省電力モードを開始しました":"通常描画へ戻しました",1800);
  return active;
}
function update(){
  if(!active)return;
  if(APP_FPSCAP!==30)setFps(30);
  if(renderer&&renderer.shadowMap&&renderer.shadowMap.enabled)renderer.shadowMap.enabled=false;
  particleGroups().forEach(group=>{if(group.visible)group.visible=false;});
}
function installUi(){
  if(document.getElementById("gfxEco_on"))return;
  const graphicsTitle=[...document.querySelectorAll("#gfx .gfx-section")].find(el=>el.textContent.includes("グラフィック"));
  const firstRow=graphicsTitle&&graphicsTitle.nextElementSibling;
  if(!firstRow||!firstRow.parentNode)return;
  const row=document.createElement("div");row.className="gfx-row";row.id="gfxEcoRow";
  row.innerHTML='<span class="gfx-lbl">省電力モード<small id="gfxEcoNote" style="display:block;color:#b9ab8c;line-height:1.45"></small></span>'+
    '<span class="gfx-opts"><button class="tb-btn" id="gfxEco_on" type="button">入</button><button class="tb-btn" id="gfxEco_off" type="button">切</button></span>';
  firstRow.parentNode.insertBefore(row,firstRow);
  document.getElementById("gfxEco_on").onclick=()=>apply(true);
  document.getElementById("gfxEco_off").onclick=()=>apply(false);
  syncUi();
}

installUi();
const saved=prefGet(STORAGE_KEY,"0")==="1";
if(saved)apply(true,{persist:false,silent:true});else syncUi();
window.LOW_POWER={version:1,get active(){return active;},enable:()=>apply(true),disable:()=>apply(false),set:apply,update,getStatus:()=>({active,fps:APP_FPSCAP,quality:QUALITY.forced,bloom:BLOOM.mode,shadows:renderer.shadowMap.enabled})};
window.LOW_POWER_STATUS={ready:true,storageKey:STORAGE_KEY,stops:["shadows","bloom","seasonal-particles"],fps:30};
})();
