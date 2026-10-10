/* Optional estate stories. Positions refer to this game's illustrative models, not a historical plan. */
(function(){
  "use strict";
  if(window.SELECTED_WORLD)return;
  const KEY="shinden3d-world-episodes-v1",RADIUS=3.3;
  const points={lost:{x:0,z:12,name:"寝殿の階段前の扇",hint:"南庭から北へ。寝殿の中央の階段の手前、白砂に落ちた扇を見てください。"},labels:{x:-6,z:14,name:"南庭西寄りの荷札",hint:"寝殿の階段の手前から西へ。白砂に並ぶ三つの荷札が目印です。"},packet:{x:43,z:20,name:"車寄の預かり文",hint:"南庭を東へ進み、中門廊の南端を通って車寄へ。牛車の近くに置いた包みです。"},heian:{x:0,z:10,name:"寝殿を望む場所",hint:"南庭の中央から北へ。中央の階段の手前で、寝殿と左右へのつながりを見渡せます。"},kamakura:{x:0,z:7,name:"主殿を望む場所",hint:"南の門から庭の中央を北へ。主殿の正面にある、開いた庭から眺めてください。"}};
  const roleNames={keishi:"家司",toneri:"舎人"};
  function initial(){return {lost:0,ledger:0,courier:0,visits:{heian:false,kamakura:false},comparison:false,nav:null};}
  let record=initial(),storageOK=true;
  try{const raw=JSON.parse(localStorage.getItem(KEY)||"null");if(raw&&typeof raw==="object"){
    for(const key of ["lost","ledger","courier"])if(Number.isInteger(raw[key])&&raw[key]>=0&&raw[key]<=4)record[key]=raw[key];
    for(const key of ["heian","kamakura"])record.visits[key]=!!(raw.visits&&raw.visits[key]===true);
    record.comparison=raw.comparison===true&&record.visits.heian&&record.visits.kamakura;
    if([...Object.keys(points),"keishi","toneri"].includes(raw.nav))record.nav=raw.nav;
  }}catch(e){storageOK=false;}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(record));storageOK=true;}catch(e){storageOK=false;}}
  const era=()=>APP.map==="kamakura"?"kamakura":"heian";
  const active=()=>APP.mode==="walk"&&!APP.gisshaCarry?.active&&!APP.tour?.active;
  const actor=id=>typeof householdPeople!=="undefined"?householdPeople.find(p=>p.userData.householdId===id):null;
  function point(key){const a=actor(key);if(roleNames[key])return era()==="heian"&&a?{x:a.position.x,z:a.position.z,name:roleNames[key],hint:key==="keishi"?"南庭の西寄り、寝殿の南で帳面を持つ家司です。" :"東の車寄と中門廊の南端のあいだで、荷を持つ舎人です。"}:null;return points[key]||null;}
  function distance(p){return p?Math.hypot(p.x-player.pos.x,p.z-player.pos.z):Infinity;}
  function near(key){return distance(point(key))<=RADIUS;}
  function direction(key){const p=point(key);if(!p)return"この人物は平安の邸で会えます。";const dx=p.x-player.pos.x,dz=p.z-player.pos.z,n=Math.round((Math.atan2(dx,-dz)+Math.PI*2)/(Math.PI/4))%8;return p.name+"まで "+["北","北東","東","南東","南","南西","西","北西"][n]+"・約"+Math.round(distance(p))+"m。"+p.hint;}
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  let open=false,tab="home",talkTo=null,message="",elapsed=0,lastMode=null,priorFocus=null;
  const panel=el("section",null,"sw-panel");panel.id="selectedWorldPanel";panel.hidden=true;panel.setAttribute("role","dialog");panel.setAttribute("aria-label","邸で交わす小さな約束");
  const header=el("header"),heading=el("h2","邸で交わす小さな約束"),closeButton=el("button","閉じる");closeButton.type="button";closeButton.onclick=close;header.append(heading,closeButton);
  const body=el("div",null,"sw-body"),status=el("p","","sw-status");status.setAttribute("role","status");panel.append(header,body,status);document.body.append(panel);
  const hud=el("button","小さな約束","sw-hud");hud.id="selectedWorldOpen";hud.type="button";hud.hidden=true;hud.onclick=()=>show();document.body.append(hud);
  const menu=document.getElementById("tbMoreMenu");if(menu){const b=el("button","小さな約束・時代を比べる","tbm-item");b.id="tbmWorld";b.type="button";b.onclick=()=>{if(typeof tbMoreClose==="function")tbMoreClose();show();};menu.append(b);}
  const props=new THREE.Group();props.name="selected-world-episode-props";scene.add(props);
  const paperGeometry=new THREE.BoxGeometry(.7,.04,.45),paperMaterial=new THREE.MeshStandardMaterial({color:0xf3dfb6,roughness:.94});
  const markers={};
  for(const key of ["lost","labels","packet"]){const g=new THREE.Group(),p=points[key];g.position.set(p.x,groundH(p.x,p.z)+.06,p.z);const count=key==="labels"?3:1;for(let i=0;i<count;i++){const mesh=new THREE.Mesh(paperGeometry,paperMaterial);mesh.position.x=(i-(count-1)/2)*.95;mesh.rotation.y=(i-1)*.12;g.add(mesh);}props.add(g);markers[key]=g;}
  // The lost fan has a distinct silhouette from the sealed delivery packet.
  markers.lost.clear();
  const fan=new THREE.Mesh(new THREE.CircleGeometry(.65,18,-Math.PI/3,Math.PI*2/3),new THREE.MeshStandardMaterial({color:0xc6a668,roughness:.9,side:THREE.DoubleSide}));
  fan.rotation.x=-Math.PI/2;markers.lost.add(fan);
  const ribs=new THREE.BufferGeometry(),ribPoints=[];
  for(let i=0;i<=6;i++){const a=-Math.PI/3+i*Math.PI/9;ribPoints.push(0,.015,0,.65*Math.cos(a),.015,-.65*Math.sin(a));}
  ribs.setAttribute("position",new THREE.Float32BufferAttribute(ribPoints,3));markers.lost.add(new THREE.LineSegments(ribs,new THREE.LineBasicMaterial({color:0x5d3f25})));
  function button(text,fn,disabled=false){const b=el("button",text);b.type="button";b.disabled=disabled;b.onclick=()=>{if(!active())return;fn();};body.append(b);return b;}
  function prose(text){body.append(el("p",text));}
  function nav(key){record.nav=key;save();message=direction(key);render();}
  function show(next="home",role=null){if(!active())return false;if(!open)priorFocus=document.activeElement;open=true;tab=next;talkTo=role;panel.hidden=false;if(typeof resetInputState==="function")resetInputState();if(typeof closeInfo==="function")closeInfo();render();closeButton.focus();return true;}
  function close(){open=false;panel.hidden=true;priorFocus?.focus?.();}
  function say(text){message=text;render();}
  function mutation(fn,text){fn();save();message=text;render();syncProps();}
  function speaker(id){return roleNames[id]+"「"+(window.LIVING_ESTATE?.status?.schedulePhases?.[id]?({ledger:"帳面を確かめているところです。",errand:"使いの段取りをしているところです。",receive:"届いた文を取り次いでいます。",message:"文や荷を運んでいます。",stable:"車寄を整えています。",rest:"今は休んでおります。"}[window.LIVING_ESTATE.status.schedulePhases[id]]||"持ち場を整えています。"):"お声がけをありがとうございます。")+"」";}
  function validTalk(){return era()==="heian"&&talkTo&&near(talkTo);}
  function render(){
    if(!open)return;body.replaceChildren();
    if(tab!=="home")button("約束の一覧へ",()=>{tab="home";message="";render();});
    if(tab==="home"){
      prose("人物のそばで声をかけ、庭で調べたことを持ち帰りましょう。任意の小事件と依頼は創作です。");
      if(era()==="heian"){
        for(const id of ["keishi","toneri"])button(roleNames[id]+"に話しかける",()=>{talkTo=id;tab="talk";message="";render();});
        button("落とし扇 — "+["庭で探す","家司に持主を尋ねる","舎人へ返す","返却済み","返却済み"][record.lost],()=>{tab="lost";message="";render();});
        button("家司の頼み — "+["本人に聞く","荷札を調べる","照合を報告","完了","完了"][record.ledger],()=>{tab="ledger";render();});
        button("舎人の頼み — "+["本人に聞く","文を預かる","家司へ届ける","舎人へ報告","完了"][record.courier],()=>{tab="courier";render();});
      }else prose("家司・舎人との小事件は平安の邸に保存されています。ここでは主殿との比較を続けられます。");
      button("平安と鎌倉を歩いて比べる",()=>{tab="compare";message="";render();});
    }else if(tab==="talk"){
      const live=validTalk();prose(direction(talkTo));
      if(!live)prose("声が届く距離（約3m）へ歩いてから、話しかけてください。");
      else prose(speaker(talkTo));
      button("この人への道順を手元に残す",()=>nav(talkTo));
      for(const key of ["heian","lost","labels","packet"])button(points[key].name+"への道を尋ねる",()=>{if(!validTalk())return say("先に、この人の近くへお越しください。");record.nav=key;save();say(roleNames[talkTo]+"「"+points[key].hint+"」");},!live);
      if(talkTo==="keishi"){
        if(record.lost===1)button("拾った扇の持主を尋ねる",()=>{if(validTalk())mutation(()=>{record.lost=2;record.nav="toneri";},"家司「この結び紐は、車寄の舎人が使うもの。紐をほどかず、本人に確かめてください」");},!live);
        if(record.ledger===0)button("日課を手伝う — 荷札の照合",()=>{if(validTalk()&&APP.time!=="night")mutation(()=>{record.ledger=1;record.nav="labels";},"家司「南庭の西に、米・布・薪の荷札を並べました。数だけでなく、何を運ぶかを確かめてください」");},!live||APP.time==="night");
        if(record.ledger===2)button("米・布・薪、三種の荷札を報告する",()=>{if(validTalk())mutation(()=>{record.ledger=3;},"家司「三枚、三種。これなら使い先を取り違えずに済みます。雅な宴も、こうした確かめがあってこそです」");},!live);
        if(record.courier===2)button("封を開けず、預かった文を届ける",()=>{if(validTalk())mutation(()=>{record.courier=3;record.nav="toneri";},"家司は封を確かめ、受け取った。「届いたと、舎人にもお伝えください」");},!live);
      }else if(talkTo==="toneri"){
        if(record.lost===2)button("落とし扇を返し、持主を確かめる",()=>{if(validTalk())mutation(()=>{record.lost=3;},"舎人「その結び目、確かにそれがしの扇です。家司にも確かめて、届けてくださったのですね」——持主の声で、小さな行き違いが終わった。");},!live);
        if(record.courier===0)button("日課を手伝う — 文を届ける",()=>{if(validTalk()&&APP.time!=="night")mutation(()=>{record.courier=1;record.nav="packet";},"舎人「車寄に置いた包みを、南庭の家司へ。中を読む用はございませぬ。お渡ししたら、受け取りの知らせをお願いします」");},!live||APP.time==="night");
        if(record.courier===3)button("家司が受け取ったと報告する",()=>{if(validTalk())mutation(()=>{record.courier=4;},"舎人「届けるだけでなく、届いたと知らせる。これで次の使いに出られます。ありがとうございました」");},!live);
      }
      if(APP.time==="night")prose("夜は新しい使いの依頼を受けません。進行中の返却と報告はできます。");
    }else if(tab==="lost"){
      const key=record.lost===0?"lost":record.lost===1?"keishi":"toneri";
      prose(record.lost>=3?"扇は持主へ戻りました。拾った物だけで持主を決めつけず、人に尋ねて確かめた記録です。":direction(key));
      if(record.lost===0)button("落ちた扇を調べ、拾う",()=>{if(near("lost"))mutation(()=>{record.lost=1;record.nav="keishi";},"扇の柄に、結び紐が残っている。これを手がかりに、家司へ持主を尋ねよう。");},!near("lost"));
      if(record.lost<3)button("道順を手元に残す",()=>nav(key));
    }else if(tab==="ledger"){
      if(record.ledger===0){prose("家司がいる場所まで歩き、日課を手伝うと申し出てください。");button("家司の道順",()=>nav("keishi"));}
      if(record.ledger===1){prose(direction("labels"));button("三つの荷札を調べる",()=>{if(!near("labels"))return;tab="labels";render();},!near("labels"));button("荷札への道順",()=>nav("labels"));}
      if(record.ledger===2){prose("米・布・薪の三種を確かめました。家司の近くで報告してください。");button("家司の道順",()=>nav("keishi"));}
      if(record.ledger>=3)prose("照合と報告が終わりました。使いの段取りを、家司と一緒に整えた記録です。");
    }else if(tab==="labels"){
      prose("一枚目『米』、二枚目『布』、三枚目『薪』。紐の形は同じでも、運ぶものが違います。家司へどう報告する？");
      button("同じ包みが三つ",()=>say("荷札の字をもう一度。包み方ではなく、運ぶものを確かめよう。"),!near("labels"));
      button("米・布・薪の三種",()=>{if(near("labels"))mutation(()=>{record.ledger=2;record.nav="keishi";tab="ledger";},"三種を照合した。家司のところへ戻って報告しよう。");},!near("labels"));
    }else if(tab==="courier"){
      const key=record.courier===0||record.courier===3?"toneri":record.courier===1?"packet":"keishi";
      prose(record.courier===4?"文の受け渡しと報告が終わりました。相手の返事を運ぶところまでが、今日の務めでした。":direction(key));
      if(record.courier===1)button("預かり文を持つ（封は開けない）",()=>{if(near("packet"))mutation(()=>{record.courier=2;record.nav="keishi";},"舎人に頼まれた包みを預かった。南庭の家司へ届けよう。");},!near("packet"));
      if(record.courier<4)button("道順を手元に残す",()=>nav(key));
    }else if(tab==="compare"){
      const here=era();prose("このゲームの二つの屋敷模型を比べる散策です。すべての貴族・武士の住居がこの形だった、という比較ではありません。");
      prose("訪問記録：寝殿前 "+(record.visits.heian?"観察済み":"未観察")+" ／ 主殿前 "+(record.visits.kamakura?"観察済み":"未観察"));
      prose(direction(here));
      button((here==="heian"?"寝殿と渡殿":"主殿と庭")+"をここで観察する",()=>{if(near(here))mutation(()=>{record.visits[here]=true;},here==="heian"?"寝殿を中心に、左右の対屋へ渡殿が延びている。建物どうしのつながりを記した。":"主殿の正面に庭がある。門や侍所との配置も、平安側の模型と見比べて記した。");},!near(here));
      button("観察地点への道順",()=>nav(here));
      button(here==="heian"?"記録して鎌倉へ移る":"記録して平安へ戻る",()=>{save();close();gotoEra(here==="heian"?"kamakura":"heian");});
      if(record.visits.heian&&record.visits.kamakura&&!record.comparison){
        prose("両方を歩いて気づいた違いは？");
        button("どちらも同じ建物配置だった",()=>say("寝殿から渡殿へのつながりと、主殿の正面の庭を思い返してみよう。"));
        button("この模型では、建物のつながり方と門まわりの配置が違う",()=>mutation(()=>{record.comparison=true;},"比較を記録しました。暮らしと役目に合わせた配置を見ると、屋根の形だけではない違いが見えてきます。"));
      }
      if(record.comparison)prose("比較の学び：寝殿と対屋を結ぶ構成／主殿と門・侍所の配置。二つの模型の観察として記録済み。");
    }
    status.textContent=message+(!storageOK?" この端末には保存できないため、今回の起動中だけ記録します。":"");
    updateButtons();
  }
  function updateButtons(){
    if(!open)return;
    // Re-render only on proximity boundary crossings; do not replace focused controls each frame.
    panel.dataset.near=APP.time+["keishi","toneri","lost","labels","packet",era()].map(k=>near(k)?1:0).join("");
  }
  function syncProps(){props.visible=active()&&era()==="heian";markers.lost.visible=record.lost===0;markers.labels.visible=record.ledger===1;markers.packet.visible=record.courier===1;}
  function update(dt){
    const isActive=active();if(lastMode!==isActive){lastMode=isActive;hud.hidden=!isActive;syncProps();if(!isActive)close();}
    elapsed+=Math.max(0,dt||0);if(elapsed<.3)return;elapsed=0;if(!isActive)return;
    if(record.nav){const valid=(era()==="heian"&&record.nav!=="kamakura")||(era()==="kamakura"&&record.nav==="kamakura");hud.textContent=valid?direction(record.nav):"時代の比較・約束の記録";}else hud.textContent="小さな約束 — 人物に道を尋ねる";
    if(open){const next=APP.time+["keishi","toneri","lost","labels","packet",era()].map(k=>near(k)?1:0).join("");if(panel.dataset.near!==next)render();}
  }
  const previousInfo=showInfo;
  showInfo=function(id){const result=previousInfo.apply(this,arguments);const old=document.getElementById("swInfoTalk");if(old)old.remove();if(active()&&era()==="heian"&&roleNames[id]){const host=document.querySelector("#info .info-body");if(host){const b=el("button",roleNames[id]+"に話しかける","sw-info-talk");b.id="swInfoTalk";b.type="button";b.onclick=()=>show("talk",id);host.append(b);}}return result;};
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&open){close();e.stopPropagation();}});
  window.SELECTED_WORLD={update,open:show,close,get state(){return JSON.parse(JSON.stringify(record));},direction};
  syncProps();
})();
