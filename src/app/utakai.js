/* ============================================================
   歌合(うたあわせ)モード — 集めた和歌短冊で左方として競う
   既存の WAKA_DATA(収集和歌) と codexUnlocked(収集状態) を再利用。
============================================================ */
const UTAKAI_PLACES=["南庭","釣殿","池泉庭園","寝殿","東の対","西の対"];
const UTAKAI_JUDGES=["藤原公任","紀貫之","清少納言","紫式部","安倍晴明"];
const UTAKAI_OPPONENTS=["右近の少将","橘の中将","源の少納言","藤原の典侍","小大君","伊勢の御","在原の朝臣","坂上の采女"];
const UTAKAI_HECKLES=["右方の方人「その題には浅いぞ」","ざわめき……","右方の女房がささやく","「いかにいかに」と声がかかる","御簾の奥がどよめく","右方「左方、心して詠め」","扇を鳴らす音、ひそやかに"];
const UTAKAI_STARTER_IDS=["waka_sp1","waka_su2","waka_au4","waka_wi8","waka_sp3"]; // 初心者でも遊べるスターター短冊
const UTAKAI_TOPICS=[
  {label:"春の夜の月", themes:["春","月","夜"],  season:"spring"},
  {label:"桜",         themes:["桜","花","春"],  season:"spring"},
  {label:"梅と鶯",     themes:["梅","鳥","春"],  season:"spring"},
  {label:"水辺の涼しさ",themes:["水","夏"],       season:"summer"},
  {label:"夏の夜",     themes:["夏","夜","月"],  season:"summer"},
  {label:"秋の夕暮れ", themes:["秋","夜"],       season:"autumn"},
  {label:"紅葉",       themes:["紅葉","秋","水"],season:"autumn"},
  {label:"雪",         themes:["雪","冬"],       season:"winter"},
  {label:"恋",         themes:["恋"],            season:"all"},
  {label:"忍ぶ恋",     themes:["恋","夜"],       season:"all"},
  {label:"旅と別れ",   themes:["旅","水"],       season:"all"},
];
const UTAKAI_THEME_KW={
  "桜":["桜","さくら","山桜","八重桜","花の色","花ぞ","花さそふ","落花","花の散","花のさかり"],
  "梅":["梅","うめ","梅が香"],
  "花":["花"],
  "月":["月","有明","月影","三日月"],
  "恋":["恋","逢","あは","思ひ","忍ぶ","君がため","手枕","袖","涙","黒髪","契り","つれなく","逢坂","身を尽","みをつくし","あふ坂","逢ふ"],
  "水":["川","水","滝","浦","波","池","泉","沢","海","瀬","潮","江","網代","川霧","遣水","舟","かぢ","澪","しづく"],
  "秋":["秋","鹿","稲","荻","露","女郎花","萩","稲葉"],
  "紅葉":["紅葉","もみぢ","竜田","錦"],
  "夜":["夜","夜半","宵","暁","明け","ぬばたま","小夜","よもすがら","ねや","夜ふけ"],
  "雪":["雪","白雪","白妙","氷","こほり","凍"],
  "鳥":["ほととぎす","郭公","鶯","千鳥","都鳥","雁","鳥"],
  "風":["風","嵐"],
  "春":["春","霞","若菜","東風","青柳","柳","木の芽"],
  "夏":["夏","五月雨","蛍","卯の花","禊","みそぎ","早苗"],
  "冬":["冬","霜","木枯","枯"],
  "旅":["旅","関","別れ","いなば","立ち別れ","須磨","明石","遠き","遠く","行方"],
};
const UTAKAI_KAKE={
  "ながめ":"「ながめ」＝〈眺め〉と〈長雨〉を一語に重ねる掛詞",
  "みをつくし":"「みをつくし」＝〈澪標(みおつくし)〉と〈身を尽くし〉の掛詞",
  "いなば":"「いなば」＝〈因幡〉と〈往(い)なば〉の掛詞",
  "逢坂":"「逢坂の関」＝〈逢ふ〉を掛けた歌枕",
  "まつほ":"「まつほの浦」＝〈待つ〉と〈松帆〉の掛詞",
  "あだ波":"「あだ波」＝心変わりを波の縁で暗示する語",
  "かれ":"「かれ」＝〈枯れ〉と〈離(か)れ〉の掛詞",
  "ふみ":"「ふみ」＝〈文〉と〈踏み〉の掛詞",
};
const _UK_SEASON_TH={spring:"春",summer:"夏",autumn:"秋",winter:"冬"};
const _UK_SEASON_JP={spring:"春",summer:"夏",autumn:"秋",winter:"冬",all:"通季"};
function _ukHash(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
const _wakaMetaCache={};
/* 和歌短冊の戦闘メタ情報を歌本文から導出(題・場・技法・希少度) */
function wakaMeta(w){
  if(_wakaMetaCache[w.id])return _wakaMetaCache[w.id];
  const text=w.poem+"／"+(w.interp||"");
  const themes=[];
  for(const th in UTAKAI_THEME_KW){if(UTAKAI_THEME_KW[th].some(k=>text.includes(k)))themes.push(th);}
  const st=_UK_SEASON_TH[w.season];if(st&&!themes.includes(st))themes.push(st);
  const tech=[];
  for(const kw in UTAKAI_KAKE){if(w.poem.includes(kw)){tech.push({name:"掛詞",note:UTAKAI_KAKE[kw]});break;}}
  const en=["波","水","川","瀬","流れ","滝","浦","潮","氷","遣水","澪","しづく"].filter(k=>w.poem.includes(k));
  if(en.length>=2)tech.push({name:"縁語",note:"水にまつわる語（"+en.slice(0,3).join("・")+"）が縁語として響き合う"});
  if(tech.length<2&&/(月|花|夕暮れ|山|風|声|波|雪|霧|錦|空|雲)$/.test(w.poem))tech.push({name:"体言止め",note:"末尾を名詞で結び、余情を残す技法"});
  const fame=["在原業平","小野小町","紀貫之","紫式部","清少納言","菅原道真","和泉式部","柿本人麻呂","天智天皇","持統天皇","紀友則","小式部内侍"];
  let rarity=1+(_ukHash(w.id)%4);
  if(fame.includes(w.auth))rarity=Math.min(5,rarity+1);
  const base=42+rarity*3;
  const places=new Set();const has=t=>themes.includes(t);
  if(has("桜")||has("梅")||has("花")||has("春")||has("秋")||has("紅葉"))places.add("南庭");
  if(has("水")||has("月")||has("夏")||has("旅"))places.add("釣殿"),places.add("池泉庭園");
  if(has("月")||has("恋")||has("夜"))places.add("寝殿");
  if(has("恋"))places.add("東の対"),places.add("西の対");
  const m={themes,tech:tech.slice(0,2),base,rarity,places:[...places]};
  _wakaMetaCache[w.id]=m;return m;
}
/* 現在地判定(ミニマップと共用) */
function getCurrentArea(px,pz){
  if(px===undefined){px=player.pos.x;pz=player.pos.z;}
  if(Math.abs(px)<=15&&pz>-11&&pz<8)return "寝殿";
  if(Math.abs(px-35)<12&&pz>-22&&pz<0)return "東の対";
  if(Math.abs(px+35)<12&&pz>-22&&pz<0)return "西の対";
  if(Math.abs(px)<14&&pz<-31)return "北の対";
  if((Math.abs(px-35)<8||Math.abs(px+35)<8)&&Math.abs(pz-34.5)<9)return "釣殿";
  if(typeof inPond==="function"&&inPond(px,pz))return "池泉庭園";
  if(pz>10)return "南庭";
  if(px>50)return "東門";
  if(px<-50)return "西門";
  if(pz<-50)return "北門";
  return "邸内";
}
/* 所持デッキ = 収集済み短冊 + スターター短冊 */
function getUtakaiDeck(){
  const map=new Map();
  // 波Z: 物語モードは図鑑の収集状況に関わらず全歌を使えるようにする(未収集だと手札が5枚固定で運ゲー化していた)
  if(APP.storyUtakaiFullDeck){WAKA_DATA.forEach(w=>map.set(w.id,w));return [...map.values()];}
  WAKA_DATA.forEach(w=>{if(codexUnlocked.has(w.id))map.set(w.id,w);});
  WAKA_DATA.forEach(w=>{if(UTAKAI_STARTER_IDS.includes(w.id))map.set(w.id,w);});
  return [...map.values()];
}
/* 題が決まったあと、初手に相応しい歌がない場合だけ一首を貸す。貸し札は収集扱いにしない。 */
function ukEnsureFairHand(u){
  if(!u?.hand?.length)return;
  const ctx={topic:u.topic,place:u.place,judge:u.judge,judgePref:u.judgePref,buff:0,collected:0,specialTech:u.specialTech};
  const value=w=>scoreWaka(w,ctx,null,"good","L").total;
  const best=Math.max(...u.hand.map(value));
  const meetsSpecial=w=>!u.specialTech||wakaMeta(w).tech.some(t=>t.name===u.specialTech);
  if(best>=70&&u.hand.some(meetsSpecial))return;
  const pool=WAKA_DATA.filter(w=>!u.used.has(w.id)&&meetsSpecial(w));
  if(!pool.length)return;
  const candidate=pool.reduce((a,w)=>!a||value(w)>value(a)?w:a,null);
  if(!candidate||u.hand.includes(candidate))return;
  const worst=u.hand.reduce((idx,w,i)=>value(w)<value(u.hand[idx])?i:idx,0);
  const removed=u.hand.splice(worst,1,candidate)[0];
  u.drawPile=u.drawPile.filter(w=>w.id!==candidate.id);
  if(removed)u.drawPile.push(removed);
  if(!u.deck.some(w=>w.id===candidate.id)){u.deck.push(candidate);u.loanedIds.add(candidate.id);}
}
/* 歌合の座(3D): 左方=青・右方=赤のモブ貴族、中央奥に判者。南庭の開けた場に常設(初回のみ生成) */
const UTAKAI_STAGE_CENTER=new THREE.Vector3(0,0,15);
function buildUtakaiStage(){
  if(window.UTAKAI_STAGE)return window.UTAKAI_STAGE;
  const cx=UTAKAI_STAGE_CENTER.x,cz=UTAKAI_STAGE_CENTER.z;
  const stage=new THREE.Group();stage.name="utakaiStage";
  const gY=groundH(cx,cz);
  // 敷物(むしろ)と朱の縁
  const edge=box(13.6,0.05,9.6,M({color:0x8a3b2c,roughness:.8}),cx,gY+0.03,cz,false);edge.receiveShadow=true;stage.add(edge);
  const mat=box(13,0.06,9,M({color:0xcabb8c,roughness:.92}),cx,gY+0.05,cz,false);mat.receiveShadow=true;stage.add(mat);
  const blue=[],red=[];
  const bluePal=[0x27407e,0x35589c,0xcbb36a],redPal=[0x7c241f,0x9c352c,0xcbb36a];
  const rowZ=[cz+3.6,cz+1.0,cz-1.6];
  rowZ.forEach((z,i)=>{
    const bx=cx-4.3,rx=cx+4.3;
    const bf=makeHeianFigure({role:"kikoshi",palette:bluePal,scale:1.0,prop:"shaku"});
    bf.position.set(bx,groundH(bx,z),z);bf.rotation.y=Math.PI/2; // 中央(+x=右方)を向く=向かい合わせ
    bf.userData.baseY=bf.position.y;bf.userData.baseScale=1.0;bf.userData.ph=i*1.3;stage.add(bf);blue.push(bf);
    const rf=makeHeianFigure({role:"kikoshi",palette:redPal,scale:1.0,prop:"shaku"});
    rf.position.set(rx,groundH(rx,z),z);rf.rotation.y=-Math.PI/2; // 中央(-x=左方)を向く=向かい合わせ
    rf.userData.baseY=rf.position.y;rf.userData.baseScale=1.0;rf.userData.ph=i*1.3+0.7;stage.add(rf);red.push(rf);
  });
  // 判者: 中央奥・一段高い台・紫白の装束で他と差をつける
  const jx=cx,jz=cz-3.6,dY=groundH(jx,jz);
  stage.add(box(2.6,0.34,2.1,M({color:0x6b4a2c,roughness:.8}),jx,dY+0.17,jz,false));
  stage.add(box(2.0,0.20,1.6,M({color:0x9a6a3c,roughness:.8}),jx,dY+0.44,jz,false));
  const judge=makeHeianFigure({role:"kikoshi",palette:[0x4b3a6e,0xece3cf,0xd8b85b],scale:1.22,prop:"shaku"});
  judge.position.set(jx,dY+0.54,jz);judge.rotation.y=0; // 南(+z=プレイヤー)を向く=こちら向き
  judge.userData.baseY=judge.position.y;judge.userData.baseScale=1.22;judge.userData.ph=0;stage.add(judge);
  // 判者の背後に白い衝立(標)
  stage.add(box(2.8,1.9,0.08,M({color:0xece3cf,roughness:.85}),jx,dY+1.5,jz-1.1,false));
  stage.add(box(3.0,0.13,0.18,M({color:0x8a3b2c}),jx,dY+2.5,jz-1.1,false));
  stage.visible=false;scene.add(stage);
  stage.userData.teams={blue,red,judge};
  window.UTAKAI_STAGE=stage;return stage;
}
function frameUtakaiCamera(){
  // 座の南側に着座し、北を向いて左方(青)=左・右方(赤)=右・判者=正面奥を望む
  APP.view="fp";
  player.pos.set(UTAKAI_STAGE_CENTER.x,1.68,UTAKAI_STAGE_CENTER.z+12);
  player.yaw=0;player.pitch=-0.12;
  camera.position.copy(player.pos);window.dummyCam=null;
  if(typeof updateControlUI==="function")updateControlUI();
}
function shuffled(arr){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
/* ===== 反応ふき出し(味方/相手/判者) — 3D図形の頭上に表示 ===== */
const _ukProjV=new THREE.Vector3();
function ukProject(x,y,z){_ukProjV.set(x,y,z);_ukProjV.project(camera);
  return {x:(_ukProjV.x*0.5+0.5)*innerWidth,y:(-_ukProjV.y*0.5+0.5)*innerHeight,vis:_ukProjV.z>-1&&_ukProjV.z<1};}
function spawnUtakaiBubble(figure,text,cls,dur){
  if(!figure||!APP.utakai)return;
  const el=document.createElement("div");el.className="uk-bub "+cls;el.textContent=text;
  $("ukBubbles").appendChild(el);
  (APP.utakai.bubbles||(APP.utakai.bubbles=[])).push({el,figure,until:performance.now()+dur});
}
function clearUtakaiBubbles(){const c=$("ukBubbles");if(c)c.innerHTML="";if(APP.utakai)APP.utakai.bubbles=[];}
const UK_REACT={
  allyGood:["見事なり","あはれ深し","をかし","読み上手","さすが左方","よくぞ詠めり"],
  allyBad:["いま一歩…","惜しや","つぎは頼む","ううむ"],
  oppLose:["浅し浅し","われらの勝","ぬるし","ふっ"],
  oppWin:["むむ…","やるものよ","侮れぬ","なんと"],
  oppDraw:["互角か","ほう"],
  judge:["ふむ","なるほど","いとよし","あはれなり"]
};
function showUtakaiReactions(pScore,oScore,outcome){
  const st=window.UTAKAI_STAGE;if(!st||!st.userData.teams)return;
  const tm=st.userData.teams,pick=a=>a[Math.floor(Math.random()*a.length)];
  const strong=pScore.total>=oScore.total;
  spawnUtakaiBubble(pick(tm.blue),strong?pick(UK_REACT.allyGood):pick(UK_REACT.allyBad),"ally",2700);
  spawnUtakaiBubble(pick(tm.red),outcome==="lose"?pick(UK_REACT.oppLose):outcome==="draw"?pick(UK_REACT.oppDraw):pick(UK_REACT.oppWin),"opp",2700);
  spawnUtakaiBubble(tm.judge,pick(UK_REACT.judge),"judge",2300);
}
/* ===== 改善: 判者の好み・連勝の勢い・段位(通算成績) ===== */
const UTAKAI_JUDGE_PREFS={
  "藤原公任":{tech:"掛詞",theme:null,note:"才知を愛で、ことに掛詞の冴えを好む"},
  "紀貫之":{tech:"縁語",theme:"桜",note:"花と詞の縁(えにし)、古今の調べを重んじる"},
  "清少納言":{tech:"体言止め",theme:"鳥",note:"機知と「をかし」、歯切れよき結びを好む"},
  "紫式部":{tech:null,theme:"恋",note:"もののあはれ、恋と月の歌を深く取る"},
  "安倍晴明":{tech:null,theme:"月",note:"夜と月、幽玄なる景を好む"}
};
const UTAKAI_STATS_KEY="shinden3d-utakai-v1";
function loadUtakaiStats(){try{const o=JSON.parse(localStorage.getItem(UTAKAI_STATS_KEY)||"{}");
  return {wins:o.wins|0,losses:o.losses|0,draws:o.draws|0,best:o.best|0};}catch(e){return {wins:0,losses:0,draws:0,best:0};}}
function saveUtakaiStats(s){try{localStorage.setItem(UTAKAI_STATS_KEY,JSON.stringify(s));}catch(e){}}
const UTAKAI_RANKS=[
  {w:0,t:"無位の詠み手"},{w:1,t:"六位の歌人"},{w:3,t:"五位の歌詠み"},
  {w:6,t:"殿上の歌人"},{w:10,t:"四位の歌仙"},{w:16,t:"撰者に並ぶ手"},
  {w:24,t:"勅撰の歌人"},{w:40,t:"歌聖と謳わる"}];
function utakaiRank(wins){let r=UTAKAI_RANKS[0];for(const x of UTAKAI_RANKS)if(wins>=x.w)r=x;return r;}
/* ===== 演出・効果音・エフェクト ===== */
function ukSE(name){ try{
  switch(name){
    case "select": beep(620,.05,"triangle",.13);break;
    case "focus": beep(340,.14,"sine",.11);setTimeout(()=>beep(510,.1,"sine",.08),70);break;
    case "perfect": beep(784,.1,"triangle",.16);setTimeout(()=>beep(1175,.16,"triangle",.15),85);setTimeout(()=>beep(1568,.22,"sine",.11),190);break;
    case "good": beep(660,.11,"triangle",.14);setTimeout(()=>beep(880,.13,"sine",.11),85);break;
    case "miss": beep(196,.22,"sawtooth",.13);break;
    case "roundwin": beep(659,.12,"triangle",.14);setTimeout(()=>beep(988,.18,"triangle",.13),110);break;
    case "win": [523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.24,"triangle",.15),i*125));break;
    case "lose": [466,392,311].forEach((f,i)=>setTimeout(()=>beep(f,.3,"sine",.12),i*160));break;
    case "promote": [659,784,988,1318,1568].forEach((f,i)=>setTimeout(()=>beep(f,.3,"triangle",.16),i*120));break;
    case "banner": beep(294,.5,"sine",.11);setTimeout(()=>beep(440,.42,"triangle",.09),70);break;
    case "recite": beep(523,.42,"sine",.10);setTimeout(()=>beep(392,.5,"sine",.07),120);break;
  }
}catch(e){} }
function ukFlash(color){const el=$("ukFlash");if(!el||REDUCED_MOTION)return;if(color)el.style.background=color;
  el.classList.remove("on");void el.offsetWidth;el.classList.add("on");}
function ukBurst(kind,n,ox,oy){
  if(REDUCED_MOTION)return;const fx=$("ukFx");if(!fx)return;
  n=n||(kind==="sakura"?20:14);ox=(ox==null?innerWidth/2:ox);oy=(oy==null?innerHeight*0.42:oy);
  for(let i=0;i<n;i++){const s=document.createElement("span");s.className="uk-pt "+kind;
    const a=Math.random()*Math.PI*2,d=50+Math.random()*230;
    s.style.left=ox+"px";s.style.top=oy+"px";
    s.style.setProperty("--dx",(Math.cos(a)*d).toFixed(0)+"px");
    s.style.setProperty("--dy",(Math.sin(a)*d-(kind==="sakura"?60:0)).toFixed(0)+"px");
    s.style.setProperty("--rot",(Math.random()*520-260).toFixed(0)+"deg");
    s.style.animationDelay=(Math.random()*0.12).toFixed(2)+"s";
    fx.appendChild(s);setTimeout(()=>{if(s.parentNode)s.parentNode.removeChild(s);},1500);}
}
function ukCamPunch(fov){const u=APP.utakai;if(!u||REDUCED_MOTION)return;
  u.fovTarget=fov;clearTimeout(u._fovT);u._fovT=setTimeout(()=>{if(APP.utakai)APP.utakai.fovTarget=62;},650);}
/* シネマ風カットイン: title-card演出。タップで早送り可。soft-lock防止に必ずdoneを呼ぶ */
function ukCut(opts,done){
  const el=$("ukCut");if(!el){if(done)done();return;}
  $("ukCutEye").textContent=opts.eyebrow||"";
  const big=$("ukCutBig");big.className="uk-cut-big"+(opts.vertical?" vertical":"");
  if(opts.bigHtml)big.innerHTML=opts.bigHtml; else big.textContent=opts.big||"";
  $("ukCutSub").innerHTML=opts.sub||"";
  el.className="uk-cut show"+(opts.cls?(" "+opts.cls):"");el.style.display="flex";el._done=false;
  clearTimeout(el._t);clearTimeout(el._t2);
  const finish=()=>{if(el._done)return;el._done=true;el.onclick=null;
    el.classList.remove("show");el.classList.add("out");
    el._t2=setTimeout(()=>{el.style.display="none";el.classList.remove("out","left","opp");if(done)done();},REDUCED_MOTION?16:400);};
  el.onclick=finish;
  el._t=setTimeout(finish,REDUCED_MOTION?Math.min(opts.dur||1800,520):(opts.dur||1800));
}
function ukHideCut(){const el=$("ukCut");if(!el)return;clearTimeout(el._t);clearTimeout(el._t2);el.style.display="none";el.className="uk-cut";el.onclick=null;el._done=true;}
/* 波AM: 和歌が縦書きで句の途中に改行される不具合の根治。上句/下句(全角空白・改行)で分け、
   さらに長い句は小書き仮名を孤立させない範囲で7文字以内の縦カラムに割る。各カラムは nowrap で
   句の内部改行を禁じ、再現モードと同じ「短冊が並ぶ」見た目にする。 */
function ukWakaColumns(poem){
  const parts=String(poem).split(/[\s　]+/).filter(Boolean);
  const small="ゃゅょぁぃぅぇぉっゎゕゖャュョァィゥェォッ";
  const cols=[],MAX=7;
  parts.forEach(p=>{
    if(p.length<=MAX){cols.push(p);return;}
    let i=0;
    while(i<p.length){
      let n=Math.min(MAX,p.length-i);
      while(n>1&&i+n<p.length&&small.indexOf(p[i+n])>=0)n++; // 次が小書き仮名ならカラムに含める
      cols.push(p.slice(i,i+n));i+=n;
    }
  });
  return cols.length?cols:[String(poem)];
}
function ukRecite(card,side,done){
  if(!card){if(done)done();return;}
  ukSE("recite");
  const esc=s=>String(s).replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));
  const html=ukWakaColumns(card.poem).map(s=>'<span class="sg-waka-line">'+esc(s)+'</span>').join("");
  ukCut({eyebrow:(side==="left"?"左方 詠進":"右方 詠進"),bigHtml:html,sub:"— "+card.auth+" —",vertical:true,dur:2500,cls:(side==="left"?"left":"opp")+" saigen-waka-cut"},done);
}
const UTAKAI_HELP_KEY="shinden3d-utakai-help-v1";
function ukPresentIntro(){
  const u=APP.utakai;if(!u)return;
  const seen=(()=>{try{return localStorage.getItem(UTAKAI_HELP_KEY)==="1";}catch(e){return false;}})();
  const intro=()=>{ukSE("banner");
    ukCut({eyebrow:"歌 合 ・ うたあわせ",big:"題　"+u.topic.label,
      sub:u.place+"　／　判者 "+u.judge+(u.judgePref?"（"+(u.judgePref.theme||u.judgePref.tech)+"を好む）":"")+"　／　右方 "+u.opponent,dur:2600});};
  if(!seen){const ob=$("ukOnboard");ob.classList.add("on");
    $("ukObStart").onclick=()=>{ob.classList.remove("on");try{localStorage.setItem(UTAKAI_HELP_KEY,"1");}catch(e){}intro();};
  }else intro();
}
function startUtakai(options={}){
  const deck=getUtakaiDeck();
  const topic=UTAKAI_TOPICS[Math.floor(Math.random()*UTAKAI_TOPICS.length)];
  const area=getCurrentArea();
  const place=UTAKAI_PLACES.includes(area)?area:UTAKAI_PLACES[Math.floor(Math.random()*UTAKAI_PLACES.length)];
  const judge=UTAKAI_JUDGES[Math.floor(Math.random()*UTAKAI_JUDGES.length)];
  const opponent=UTAKAI_OPPONENTS[Math.floor(Math.random()*UTAKAI_OPPONENTS.length)];
  const collected=WAKA_DATA.filter(w=>codexUnlocked.has(w.id)).length;
  const buff=Math.min(8,Math.floor(collected/4))+Math.min(4,Math.floor(codexUnlocked.size/30));
  const drawPile=shuffled(deck);const hand=drawPile.splice(0,Math.min(5,drawPile.length));
  // 波AA: 物語モードは手札に必ず一枚、題・場・判者の好みに強く合う札を確保する(運ゲー回避)
  if(APP.storyUtakaiFullDeck&&hand.length){
    const evalCtx={topic,place,judgePref:UTAKAI_JUDGE_PREFS[judge]||null,buff:0,collected:0,judge};
    const evalScore=w=>scoreWaka(w,evalCtx,null,"good","L").total;
    const handScores=hand.map(evalScore);
    const bestHandScore=Math.max(...handScores);
    if(bestHandScore<45){
      let best=null,bestS=-1e9;
      drawPile.forEach(w=>{const s=evalScore(w);if(s>bestS){bestS=s;best=w;}});
      if(best&&bestS>bestHandScore){
        const worstIdx=handScores.indexOf(Math.min(...handScores));
        const removed=hand.splice(worstIdx,1,best)[0];
        const dpIdx=drawPile.indexOf(best);if(dpIdx>=0)drawPile.splice(dpIdx,1);
        drawPile.push(removed);
      }
    }
  }
  const availableTech=["掛詞","縁語","体言止め"].filter(t=>WAKA_DATA.some(w=>wakaMeta(w).tech.some(v=>v.name===t)));
  const specialTech=options.special&&availableTech.length?availableTech[Math.floor(Math.random()*availableTech.length)]:null;
  APP.utakai={topic,place,judge,judgePref:UTAKAI_JUDGE_PREFS[judge]||null,opponent,deck,drawPile,hand,collected,buff,specialTech,loanedIds:new Set(),
    round:1,scoreL:0,scoreR:0,totalL:0,totalR:0,streakL:0,streakR:0,bestStreak:0,mulliganUsed:false,
    redrawsLeft:3, // 波AL: 物語モードの番ごと引き直し回数(通常モードでは未使用)
    selectedId:null,prevPlayer:null,prevOpp:null,used:new Set(),rounds:[],phase:"select",
    focus:{active:false,pos:0,dir:1,speed:0,zoneC:50,zoneW:16,coreW:6,jitter:0,noiseT:0},
    bubbles:[],focusResult:null,_finished:false};
  ukEnsureFairHand(APP.utakai);
  buildUtakaiStage();window.UTAKAI_STAGE.visible=true;frameUtakaiCamera();clearUtakaiBubbles();
  if(typeof camera!=="undefined"&&camera){camera.fov=62;camera.updateProjectionMatrix();}
  renderUtakaiHud();
  if(typeof UK_BGM!=="undefined")UK_BGM.start(); // 雅楽風BGMを流す
  ukPresentIntro(); // 開会のカットイン(初回は遊び方を表示)
}
function renderUtakaiHud(){
  const u=APP.utakai;if(!u)return;
  $("ukTopic").textContent=u.topic.label+(u.specialTech?" ・ 技法「"+u.specialTech+"」":"");
  const phaseTxt={select:"歌を選ぶ",focus:"精神統一",reveal:"採点"}[u.phase]||"";
  const streakTxt=u.streakL>=2?' ・ <span style="color:#ffb060">🔥'+u.streakL+'連勝</span>':'';
  $("ukTurn").innerHTML='<b>第'+Math.min(u.round,3)+'番</b> / 3 ・ '+phaseTxt+streakTxt;
  const tot=u.totalL+u.totalR;const lp=tot>0?Math.round(u.totalL/tot*100):50;
  $("ukGaugeL").style.width=lp+"%";$("ukGaugeR").style.width=(100-lp)+"%";
  $("ukScore").innerHTML='左 <b class="'+(u.scoreL>u.scoreR?'win':'')+'">'+u.scoreL+'</b> － <b class="'+(u.scoreR>u.scoreL?'lose':'')+'">'+u.scoreR+'</b> 右';
  renderUtakaiLog();
  // 手札: 和歌の短冊(縦書き)を弧状に。文字は切らない
  const cardsEl=$("ukCards");
  cardsEl.className="uk-cards"+(u.phase!=="select"?" disabled":"");
  const hand=u.hand||[];const n=hand.length;const mid=(n-1)/2;
  let html='<div class="uk-hand-label">― 手 札 ―</div>';
  html+=hand.map((w,i)=>{
    const m=wakaMeta(w);
    const sel=u.selectedId===w.id;
    const ang=(i-mid)*6;            // 扇の開き角(短冊は背が高いので控えめ)
    const tx=(i-mid)*40;            // 横の広がり
    const ty=Math.abs(i-mid)*7-(sel?20:0); // 弧の沈み込み・選択札は持ち上げ
    const z=sel?50:10+i;
    const style='transform:translate(calc(-50% + '+tx+'px),'+ty+'px) rotate('+ang+'deg)'+(sel?' scale(1.08)':'')+';z-index:'+z+';';
    return '<div class="uk-card'+(sel?' sel':'')+'" data-id="'+w.id+'" style="'+style+'">'+
      (u.loanedIds.has(w.id)?'<div class="uk-loan-mark">貸し札</div>':'')+
      '<div class="uk-c-rar">'+'★'.repeat(m.rarity)+'</div>'+
      '<div class="uk-c-poem">'+w.poem+'</div></div>';
  }).join("");
  cardsEl.innerHTML=html;
  [...cardsEl.querySelectorAll(".uk-card")].forEach(el=>el.onclick=()=>selectUtakaiCard(el.dataset.id));
  renderUtakaiDetail();
  $("ukFocus").classList.toggle("on",u.phase==="focus");
  renderUtakaiActions();
}
function renderUtakaiDetail(){
  const u=APP.utakai;const el=$("ukDetail");
  if(u.phase==="select"&&!u.selectedId){el.textContent=u.specialTech?`特別戦：${u.specialTech}を使った歌を選ぼう。一致なら加点、違えば減点。貸し札はこの歌合だけ使える。`:"題と場に適う歌を選ぼう。手札が偏ったときの貸し札は、この歌合だけ使える。";return;}
  const w=u.deck.find(x=>x.id===u.selectedId)||u.prevPlayer;if(!w){el.textContent="";return;}
  const m=wakaMeta(w);
  let h='<div class="uk-poem">'+w.poem+'</div>';
  h+='<div style="font-size:10px;color:#bdae8c;margin:2px 0 4px">'+w.auth+'　—　'+(w.interp||"")+'</div>';
  m.themes.forEach(t=>h+='<span class="uk-tag">'+t+'</span>');
  m.tech.forEach(t=>h+='<span class="uk-tag" style="border-color:rgba(212,80,47,.6);color:#f0b89a">'+t.name+'</span>');
  if(u.loanedIds.has(w.id))h+='<span class="uk-tag">貸し札・未収集</span>';
  el.innerHTML=h;
}
function renderUtakaiLog(){
  const u=APP.utakai;const el=$("ukLog");
  const prefHint=u.judgePref?'<span style="color:#caa84a">（'+(u.judgePref.theme?u.judgePref.theme:u.judgePref.tech)+'を好む）</span>':'';
  const meta='<div class="uk-log-meta">場 '+u.place+' ・ 判者 '+u.judge+prefHint+' ・ 右方 '+u.opponent+(u.specialTech?' ・ 特別戦「'+u.specialTech+'」':'')+'</div>';
  if(!u.rounds.length){el.innerHTML=meta+'<span style="color:#9a8a6a">歌を選び、精神統一して詠進すると、採点の内訳がここに記される。</span>';return;}
  const fmt=sc=>sc.parts.map(p=>'<span class="'+(p.pts>=0?'uk-pos':'uk-neg')+'">'+p.label+(p.pts>=0?" +":" ")+p.pts+'</span>').join("、");
  el.innerHTML=meta+u.rounds.map(r=>{
    const res=r.outcome==="win"?'<span class="uk-pos">左方の勝</span>':r.outcome==="lose"?'<span class="uk-neg">右方の勝</span>':'持（引き分け）';
    return '<div style="margin-bottom:7px">'+
      '<div class="uk-rd-head">第'+r.n+'番　'+res+'</div>'+
      '<div><b>左方</b> '+r.pCard.auth+'「'+r.pCard.poem.slice(0,13)+'…」<span class="uk-pts"> '+r.pScore.total+'点</span></div>'+
      '<div style="font-size:10px">'+fmt(r.pScore)+'</div>'+
      '<div style="margin-top:2px"><b>右方</b> '+(r.oCard?r.oCard.auth+'「'+r.oCard.poem.slice(0,13)+'…」':'(歌なし)')+'<span class="uk-pts"> '+r.oScore.total+'点</span></div>'+
      '<div style="font-size:10px">'+fmt(r.oScore)+'</div></div>';
  }).join("");
}
function renderUtakaiActions(){
  const u=APP.utakai;const el=$("ukActions");el.innerHTML="";
  const mk=(label,cls,fn,dis)=>{const b=document.createElement("button");b.className="uk-btn"+(cls?" "+cls:"");b.textContent=label;if(dis)b.disabled=true;b.onclick=fn;el.appendChild(b);};
  if(u.phase==="select"){
    mk("この歌で精神統一","gold",()=>startFocusAction(),!u.selectedId);
    if(!APP.storyUtakai&&u.round===1&&!u.rounds.length&&!u.specialTech)mk("技法指定の特別戦へ","",()=>startUtakai({special:true}));
    if(APP.storyUtakaiFullDeck){ // 波AL: 物語モードは各番3回まで引き直せる(難しさ緩和)
      if(u.redrawsLeft>0)mk("手札を引き直す（残"+u.redrawsLeft+"回）","",()=>mulliganUtakai());
    }else if(u.round===1&&!u.rounds.length&&!u.mulliganUsed&&u.drawPile&&u.deck.length>5)
      mk("手札を引き直す（1度）","",()=>mulliganUtakai());
  }else if(u.phase==="focus"){
    mk("止める","gold",()=>finishFocusAction());
  }else if(u.phase==="reveal"){
    const finished=(u.scoreL>=2||u.scoreR>=2||u.rounds.length>=3);
    if(finished)mk("判詞（結果）を見る","gold",()=>endUtakai());
    else mk("次の番へ","gold",()=>nextUtakaiRound());
  }
}
function selectUtakaiCard(id){
  const u=APP.utakai;if(!u||u.phase!=="select")return;
  if(u.hand&&!u.hand.some(w=>w.id===id))return; // 手札にある札のみ選べる
  u.selectedId=id;ukSE("select");renderUtakaiHud();
}
/* 手札の引き直し。通常モード=初番に一度だけ / 物語モード(波AL)=各番3回まで */
function mulliganUtakai(){
  const u=APP.utakai;if(!u||u.phase!=="select")return;
  if(APP.storyUtakaiFullDeck){
    if(!(u.redrawsLeft>0))return;
    u.redrawsLeft--;
    const n=Math.max(1,u.hand?u.hand.length:5);
    const pool=shuffled((u.drawPile||[]).concat(u.hand||[]).filter(w=>!u.used.has(w.id)));
    u.hand=pool.splice(0,Math.min(n,pool.length));u.drawPile=pool;u.selectedId=null;
    // 初手保証と同じ補償: 引き直し後の最良札が弱ければ、山から最良の一枚を差し込む
    const ctx={topic:u.topic,place:u.place,judgePref:u.judgePref,buff:u.buff,collected:u.collected,judge:u.judge};
    const ev=w=>scoreWaka(w,ctx,u.prevOpp||null,"good","L").total;
    if(u.hand.length&&u.drawPile.length){
      const hs=u.hand.map(ev),bh=Math.max(...hs);
      if(bh<45){let b=null,bi=-1,bs=-1e9;
        u.drawPile.forEach((w,i)=>{const s=ev(w);if(s>bs){bs=s;b=w;bi=i;}});
        if(b&&bs>bh){const wi=hs.indexOf(Math.min(...hs));const rm=u.hand.splice(wi,1,b)[0];u.drawPile.splice(bi,1);u.drawPile.push(rm);}}
    }
    if(u.round===1)ukEnsureFairHand(u);
    beep(560,.07);toast("手札を引き直した（この番、あと"+u.redrawsLeft+"回）",1700);renderUtakaiHud();return;
  }
  if(u.mulliganUsed||u.round!==1||u.rounds.length)return;
  u.mulliganUsed=true;
  const pile=shuffled(u.deck);
  u.hand=pile.splice(0,Math.min(5,pile.length));u.drawPile=pile;u.selectedId=null;
  ukEnsureFairHand(u);
  beep(560,.07);toast("手札を引き直した",1600);renderUtakaiHud();
}
function startFocusAction(){
  const u=APP.utakai;if(!u||!u.selectedId)return;
  u.phase="focus";const f=u.focus;
  f.active=true;f.pos=Math.random()*18;f.dir=1;
  f.speed=64+Math.random()*46;
  f.zoneW=16;f.coreW=6;f.zoneC=34+Math.random()*32;
  f.jitter=0;f.noiseT=0;$("ukNoise").textContent="";
  ukSE("focus");renderUtakaiHud();
}
function utakaiUpdate(dt){
 try{
  const u=APP.utakai;if(!u)return;
  // カメラの画角を目標へ寄せる(詠進・勝利でのプッシュイン演出)
  if(typeof camera!=="undefined"&&camera){const ft=u.fovTarget||62;
    if(Math.abs(camera.fov-ft)>0.08){camera.fov+=(ft-camera.fov)*Math.min(1,dt*7);camera.updateProjectionMatrix();}}
  // 座のモブ貴族・判者の所作(微かな上下動／勝った側は歓喜の弾み)
  const st=window.UTAKAI_STAGE;
  if(st&&st.visible&&st.userData.teams){
    const t=performance.now()/1000,now=performance.now();
    const anim=arr=>arr.forEach(fig=>{
      fig.position.y=fig.userData.baseY+Math.sin(t*1.5+fig.userData.ph)*0.012;
      const pulse=(fig.userData.cheerUntil&&now<fig.userData.cheerUntil)?(1+Math.abs(Math.sin(t*9))*0.07):1;
      fig.scale.setScalar(fig.userData.baseScale*pulse);
    });
    anim(st.userData.teams.blue);anim(st.userData.teams.red);
    const j=st.userData.teams.judge;j.position.y=j.userData.baseY+Math.sin(t*1.05)*0.008;
  }
  // 反応ふき出しを図形の頭上へ追従させ、寿命が来たら消す
  if(u.bubbles&&u.bubbles.length){
    const now=performance.now();
    u.bubbles=u.bubbles.filter(b=>{
      if(now>b.until){if(b.el&&b.el.parentNode)b.el.parentNode.removeChild(b.el);return false;}
      const f2=b.figure,hy=f2.userData.baseY+1.95*(f2.userData.baseScale||1);
      const p=ukProject(f2.position.x,hy,f2.position.z);
      if(p.vis){b.el.style.left=p.x+"px";b.el.style.top=(p.y-6)+"px";b.el.classList.add("show");}
      else b.el.classList.remove("show");
      return true;
    });
  }
  const f=u.focus;if(!f.active)return;
  f.jitter+=(Math.random()-0.5)*dt*3;f.jitter=Math.max(-0.35,Math.min(0.35,f.jitter*0.95));
  f.pos+=f.dir*f.speed*(1+f.jitter)*dt;
  if(f.pos>=100){f.pos=100;f.dir=-1;}else if(f.pos<=0){f.pos=0;f.dir=1;}
  const mk=$("ukFocusMarker");if(mk)mk.style.left=f.pos+"%";
  const z=$("ukFocusZone");if(z){z.style.left=(f.zoneC-f.zoneW)+"%";z.style.width=(f.zoneW*2)+"%";}
  const c=$("ukFocusCore");if(c){c.style.left=(f.zoneC-f.coreW)+"%";c.style.width=(f.coreW*2)+"%";}
  f.noiseT-=dt;
  if(f.noiseT<=0){f.noiseT=0.6+Math.random()*0.7;
    $("ukNoise").textContent=Math.random()<0.7?UTAKAI_HECKLES[Math.floor(Math.random()*UTAKAI_HECKLES.length)]:"";}
 }catch(err){if(!utakaiUpdate._warned){utakaiUpdate._warned=true;console.error("utakaiUpdate:",err);}}
}
function finishFocusAction(){
  const u=APP.utakai;if(!u||!u.focus.active)return;
  const f=u.focus;f.active=false;
  const d=Math.abs(f.pos-f.zoneC);let result;
  if(d<=f.coreW){result="perfect";ukSE("perfect");ukFlash("rgba(255,236,180,.5)");ukBurst("gold",16);ukCamPunch(55);toast("静心。完璧な間合い",1400);}
  else if(d<=f.zoneW){result="good";ukSE("good");toast("気迫がこもった",1300);}
  else{result="miss";ukSE("miss");toast("方人のヤジに心が乱れた",1500);}
  u.focusResult=result;$("ukNoise").textContent="";
  // 自分の歌を中央で「詠進」してから採点へ(歌合の見せ場)
  u.phase="recite";renderUtakaiHud();
  const pCard=u.deck.find(w=>w.id===u.selectedId);
  ukRecite(pCard,"left",()=>{if(APP.mode==="utakai"&&APP.utakai===u&&!u._finished)resolveUtakaiRound();});
}
/* 評価ロジック(純粋関数) — 内訳は必ずUIに表示する */
function scoreWaka(card,ctx,prevOpp,focus,side){
  const m=wakaMeta(card);const parts=[];let total=0;
  const add=(label,pts,note)=>{parts.push({label,pts,note:note||""});total+=pts;};
  add("基本点",m.base,card.auth+"の歌の格");
  const hits=ctx.topic.themes.filter(t=>m.themes.includes(t));
  if(hits.length)add("題「"+ctx.topic.label+"」適合",Math.min(25,9+hits.length*8),"題の心〔"+hits.join("・")+"〕を捉えた");
  else add("題との隔たり",-4,"題の景がやや薄い");
  if(ctx.topic.season!=="all"&&card.season===ctx.topic.season)add("季節の一致",12,"題の季節に適う");
  if(m.places.includes(ctx.place)){
    const sp={"釣殿":["水","月","夏"],"池泉庭園":["水","月","夏"],"南庭":["桜","梅","春","秋","花","紅葉"],"寝殿":["月","恋","夜"],"東の対":["恋"],"西の対":["恋"]};
    const strong=sp[ctx.place]&&sp[ctx.place].some(t=>m.themes.includes(t));
    add("場「"+ctx.place+"」適合",strong?20:11,strong?"その場の景物とよく響く":"場にふさわしい");
  }
  m.tech.forEach(t=>add("技法・"+t.name,t.name==="掛詞"?16:t.name==="縁語"?13:10,t.note));
  if(ctx.specialTech){
    const hit=m.tech.find(t=>t.name===ctx.specialTech);
    add("特別戦・"+ctx.specialTech,hit?24:-8,hit?hit.note:"指定技法を含む歌を探そう");
  }
  if(prevOpp){const sh=wakaMeta(prevOpp).themes.filter(t=>m.themes.includes(t));
    if(sh.length)add("返歌（本歌取り風）",Math.min(25,11+sh.length*6),"右方の〔"+sh.join("・")+"〕を受けて返した");}
  // 判者の好み: 好む題材・技法に当たれば加点(判者の歌風を学べる)
  if(ctx.judgePref){const jp=ctx.judgePref;let pref=0;const why=[];
    if(jp.theme&&m.themes.includes(jp.theme)){pref+=10;why.push("題材「"+jp.theme+"」");}
    if(jp.tech&&m.tech.some(t=>t.name===jp.tech)){pref+=12;why.push("技法「"+jp.tech+"」");}
    if(pref)add("判者("+ctx.judge+")の好み",pref,jp.note+"——"+why.join("・")+"が響いた");}
  // 連勝の勢い: 場の流れを掴むと加点
  const mom=side==="L"?(ctx.momL||0):(ctx.momR||0);
  if(mom>0)add("勢い（"+mom+"連勝）",Math.min(12,mom*6),"場の流れを掴んでいる");
  if(focus==="perfect")add("精神統一・静心",11,"完璧な間合い");
  else if(focus==="good")add("精神統一・気迫",6,"良い間合い");
  else if(focus==="miss")add("精神統一・乱れ",-3,"心が乱れた");
  if(side==="L"&&ctx.buff>0)add("左方の方人の声援",ctx.buff,"集めた短冊 "+ctx.collected+" 枚の縁");
  return {total,parts,card};
}
/* 右方NPCは題・場に合う歌をある程度賢く選ぶ(完璧ではない) */
function chooseOpponentCard(ctx,prevPlayer,used){
  const pool=WAKA_DATA.filter(w=>!used.has(w.id));if(!pool.length)return null;
  const sample=[];const tmp=pool.slice();
  for(let i=0;i<7&&tmp.length;i++)sample.push(tmp.splice(Math.floor(Math.random()*tmp.length),1)[0]);
  pool.filter(w=>w.season===ctx.topic.season).slice(0,3).forEach(w=>{if(!sample.includes(w))sample.push(w);});
  let best=pool[0],bestS=-1e9;
  sample.forEach(w=>{const s=scoreWaka(w,ctx,prevPlayer,"good","R").total+(Math.random()*9-2);
    if(s>bestS){bestS=s;best=w;}});
  return best;
}
function resolveUtakaiRound(){
  const u=APP.utakai;
  const ctx={topic:u.topic,place:u.place,buff:u.buff,collected:u.collected,specialTech:u.specialTech,
    judge:u.judge,judgePref:u.judgePref,momL:u.streakL,momR:u.streakR};
  const pCard=u.deck.find(w=>w.id===u.selectedId);if(!pCard)return;
  const oCard=chooseOpponentCard(ctx,u.prevPlayer,u.used);
  u.used.add(pCard.id);if(oCard)u.used.add(oCard.id);
  const of=Math.random()<0.15?"perfect":(Math.random()<0.9?"good":"miss"); // 波Z: 相手の運要素を弱め、題・場・技法選びの実力差が勝敗を決めやすくする
  const pScore=scoreWaka(pCard,ctx,u.prevOpp,u.focusResult||"good","L");
  const oScore=oCard?scoreWaka(oCard,ctx,u.prevPlayer,of,"R"):{total:0,parts:[],card:null};
  let outcome;
  if(pScore.total>oScore.total){u.scoreL++;outcome="win";}
  else if(oScore.total>pScore.total){u.scoreR++;outcome="lose";}
  else outcome="draw";
  // 連勝の勢いを更新(次の番の加点に反映)
  if(outcome==="win"){u.streakL++;u.streakR=0;u.bestStreak=Math.max(u.bestStreak,u.streakL);}
  else if(outcome==="lose"){u.streakR++;u.streakL=0;}
  else{u.streakL=0;u.streakR=0;}
  u.totalL+=pScore.total;u.totalR+=oScore.total;
  u.rounds.push({n:u.round,pCard,oCard,pScore,oScore,pf:u.focusResult||"good",of,outcome});
  u.prevPlayer=pCard;u.prevOpp=oCard;u.phase="reveal";
  // 詠み終えた札を手札から外し、山があれば一枚引いて手札を補充
  if(u.hand){const hi=u.hand.findIndex(w=>w.id===pCard.id);if(hi>=0)u.hand.splice(hi,1);
    if(u.drawPile&&u.drawPile.length){
      // 波AA: 物語モードは補充札も題・場・判者の好みに合う一枚を優先して引く(運ゲー回避)
      if(APP.storyUtakaiFullDeck){
        let best=null,bestI=-1,bestS=-1e9;
        u.drawPile.forEach((w,i)=>{const s=scoreWaka(w,ctx,u.prevOpp,"good","L").total;if(s>bestS){bestS=s;best=w;bestI=i;}});
        if(best){u.drawPile.splice(bestI,1);u.hand.push(best);}else u.hand.push(u.drawPile.shift());
      }else u.hand.push(u.drawPile.shift());
    }}
  // 勝った側の方人が3D空間で歓喜する
  const st=window.UTAKAI_STAGE;
  if(st&&st.userData.teams){
    const team=outcome==="win"?st.userData.teams.blue:outcome==="lose"?st.userData.teams.red:[];
    team.forEach(f=>f.userData.cheerUntil=performance.now()+1500);
  }
  // 出した歌に応じて味方・相手・判者がふき出しで反応
  showUtakaiReactions(pScore,oScore,outcome);
  // 波AL: 勝敗が一目で分かるよう、番ごとの結果を中央カットインで明示(点差つき)
  if(typeof ukCut==="function"){
    ukCut({eyebrow:"第 "+u.round+" 番　勝敗",
      big:outcome==="win"?"左方の勝":outcome==="lose"?"右方の勝":"持（引き分け）",
      sub:"左方 "+pScore.total+"点　—　右方 "+oScore.total+"点",dur:2600});
  }
  if(outcome==="win"){ukSE("roundwin");ukBurst("sakura",14);ukCamPunch(57);}
  else if(outcome==="lose"){ukSE("miss");}
  else{beep(540,.14,"sine",.12);}
  renderUtakaiHud();
  const lg=$("ukLog");if(lg)lg.scrollTop=lg.scrollHeight;
}
function nextUtakaiRound(){
  const u=APP.utakai;if(!u)return;
  u.round++;u.selectedId=null;u.focusResult=null;u.phase="select";
  if(u.specialTech)ukEnsureFairHand(u);
  if(APP.storyUtakaiFullDeck)u.redrawsLeft=3; // 波AL: 引き直しは番ごとに3回まで回復
  renderUtakaiHud();
  ukSE("banner");
  ukCut({eyebrow:"第 "+Math.min(u.round,3)+" 番 / 3",big:"題　"+u.topic.label,sub:"場: "+u.place+(u.specialTech?"　—　指定技法: "+u.specialTech:"　—　歌を選びなさい"),dur:2600}); // 波AL: 題を大きく長めに明示
}
function utakaiVerdict(u,playerWon,draw){
  let best=null;
  u.rounds.forEach(r=>r.pScore.parts.forEach(p=>{if(p.label!=="基本点"&&p.pts>0&&(!best||p.pts>best.pts))best=p;}));
  let s=u.judge+"、判ず。題「"+u.topic.label+"」、"+u.place+"の歌合なり。";
  if(playerWon){
    s+="左方、よく題と場を捉えたり。";
    if(best)s+="ことに〔"+best.label+"〕が冴え、"+best.note+"。これにて左方の勝とする。";
  }else if(draw){
    s+="左右の歌いづれも捨て難く、持(ぢ・引き分け)とする。";
    if(best)s+="左方の〔"+best.label+"〕は見どころ。次は精神統一と場の一致を重ねよ。";
  }else{
    s+="左方、心ばへは見ゆれど、題か場への適合、または技法に一歩及ばず。";
    s+="題語・季節・場の景物・掛詞や縁語・右方への返歌、そして精神統一——これらを重ねれば評価は伸びる。右方の勝とする。";
  }
  return s;
}
function endUtakai(){
  const u=APP.utakai;if(!u)return;u._finished=true;
  /* 波O: ストーリー内歌合は判詞画面を出さず、勝ち数だけ物語へ返す */
  if(APP.storyUtakai){
    const cb=APP.storyUtakai;APP.storyUtakai=null;
    const wins=(u.rounds||[]).filter(r=>r.outcome==="win").length;
    ukHideCut();if(typeof UK_BGM!=="undefined")UK_BGM.stop();
    APP.utakai=null;$("utakaiHud").style.display="none";document.body.classList.remove("utakai-mode");
    if(window.UTAKAI_STAGE)window.UTAKAI_STAGE.visible=false;
    cb(wins>=2,wins);
    return;
  }
  const playerWon=u.scoreL>u.scoreR,draw=u.scoreL===u.scoreR;
  // 通算成績・段位を更新して保存
  const st=loadUtakaiStats();const prevRank=utakaiRank(st.wins);
  if(playerWon)st.wins++;else if(draw)st.draws++;else st.losses++;
  st.best=Math.max(st.best,u.bestStreak||0);
  saveUtakaiStats(st);
  const newRank=utakaiRank(st.wins);
  const promoted=newRank.t!==prevRank.t&&playerWon;
  // 終幕の演出
  ukHideCut();
  if(playerWon){ukSE("win");ukFlash("rgba(255,236,180,.45)");
    ukBurst("sakura",34);setTimeout(()=>ukBurst("gold",18),260);setTimeout(()=>ukBurst("sakura",24),520);}
  else if(draw){beep(523,.3,"sine",.12);}
  else{ukSE("lose");}
  if(promoted){setTimeout(()=>{ukSE("promote");ukBurst("gold",28);},900);
    setTimeout(()=>toast("✨ 段位が上がった —「"+newRank.t+"」",5200),900);}
  $("resTitle").textContent="歌合　判詞";
  $("resRank").textContent=playerWon?"左方の勝":draw?"持（引き分け）":"右方の勝";
  let h='<div style="font-family:var(--serif);font-size:14px;color:#5a4030;line-height:1.95;margin-bottom:10px">'+utakaiVerdict(u,playerWon,draw)+'</div>';
  h+='<div style="font-size:12px;color:#6a5436;margin-bottom:8px">段位 <b style="color:#b3402a">'+newRank.t+'</b>　／　通算 <b>'+st.wins+'</b>勝 '+st.losses+'敗 '+st.draws+'分　最多連勝 '+st.best+'</div>';
  h+='<div style="border-top:1px solid #b89b56;padding-top:8px;text-align:left;font-size:12px">';
  u.rounds.forEach(r=>{
    h+='<div style="margin-bottom:9px">';
    h+='<b style="color:#b3402a">第'+r.n+'番</b>　'+(r.outcome==="win"?"左方の勝":r.outcome==="lose"?"右方の勝":"持")+'<br>';
    h+='<span style="color:#3a6ea5">左方</span> '+r.pCard.poem+'（'+r.pCard.auth+'）<b> '+r.pScore.total+'点</b><br>';
    h+='<span style="color:#a8412a">右方</span> '+(r.oCard?r.oCard.poem+'（'+r.oCard.auth+'）':'(なし)')+'<b> '+r.oScore.total+'点</b>';
    h+='</div>';
  });
  h+='</div>';
  $("resDetail").innerHTML=h;
  markDailyMission("utakai");
  recordProgress("utakai",1);gainParam("miyabi",4);gainParam("focus",1);
  setResultActions({
    retryText:"もう一度 歌合",
    walkText:"散策へ戻る",
    nextGoal:"<b>次のおすすめ:</b> 今日の題と場に合う別の和歌を選び、判者の判詞の変化を見よう",
    onRetry:()=>{closeResultPanel();enterMode("utakai");},
    onWalk:()=>{closeResultPanel();enterMode("walk");}
  });
  $("utakaiHud").style.display="none";showResultPanel();
  if(playerWon&&typeof seOK==="function")seOK();
}
$("ukQuit").onclick=()=>{beep(440,.06);
  const u=APP.utakai;
  if(u&&u.rounds.length&&!u._finished)endUtakai();else enterMode("walk");};
// 精神統一の帯はパネルのどこをタップしても止められる(取りこぼし防止)
$("ukFocus").onclick=()=>{if(APP.mode==="utakai"&&APP.utakai&&APP.utakai.focus.active)finishFocusAction();};
addEventListener("keydown",e=>{
  if(APP.mode!=="utakai"||!APP.utakai)return;
  const t=e.target;if(t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))return;
  if(e.code==="Space"||e.key==="Enter"){
    const u=APP.utakai;
    if(u.focus.active){e.preventDefault();finishFocusAction();}
    else if(u.phase==="select"&&u.selectedId){e.preventDefault();startFocusAction();}
    else if(u.phase==="reveal"){e.preventDefault();
      if(u.scoreL>=2||u.scoreR>=2||u.rounds.length>=3)endUtakai();else nextUtakaiRound();}
  }
});
