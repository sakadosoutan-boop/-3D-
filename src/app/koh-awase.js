/*
 * 薫物合（香合わせ）: standalone, no external assets.
 * A fictionalised learning game inspired by Heian kneaded incense culture.
 * It intentionally does not claim a single historical recipe is correct.
 */
(function(){
  "use strict";

  const STORAGE_KEY="shinden3d-koh-awase-v1";
  const MODAL_ID="kohAwaseModal";
  const ENTRY_ID="kohAwaseEntry";
  const ROUNDS=3;
  const reducedMotion=()=>window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MATERIALS=[
    {id:"byakudan",name:"白檀",reading:"びゃくだん",tone:"やわらかな基調",note:"温かく丸い土台。香りの輪郭を結ぶ。",vector:[3,1,0,1],color:"#d8ac62"},
    {id:"jinko",name:"沈香",reading:"じんこう",tone:"深い余韻",note:"奥行きとあらたまった気配を添える。",vector:[1,0,0,4],color:"#5f4030"},
    {id:"choji",name:"丁子",reading:"ちょうじ",tone:"冴えた辛み",note:"立ち上がりを強める。多すぎると前に出る。",vector:[2,1,0,1],color:"#b5673c"},
    {id:"koko",name:"甲香",reading:"こうこう",tone:"結びの甘さ",note:"香りをまとめ、残り香を落ち着かせる。",vector:[2,0,0,2],color:"#937252"},
    {id:"kanso",name:"甘松",reading:"かんしょう",tone:"花の陰影",note:"やわらかな花の気配を足す。",vector:[0,4,1,0],color:"#b37698"},
    {id:"kakkou",name:"藿香",reading:"かっこう",tone:"青い気配",note:"水辺や葉の瑞々しさを思わせる。",vector:[0,0,4,0],color:"#648c70"}
  ];
  const TITLES=[
    {id:"baika",name:"梅花",season:"春",vector:[3,4,1,1],memory:"ほころぶ花に、朝の冷たさが残る",fact:"梅花は春の景を重ねて味わう代表的な名の一つ。名・季節・相手を響かせること自体が遊びでした。"},
    {id:"kayo",name:"荷葉",season:"夏",vector:[1,1,4,1],memory:"水面を渡る風と、濡れた葉の青さ",fact:"荷葉は蓮の葉と水辺を思わせる代表名。ここでは香りそのものではなく、景や名を結ぶ感覚を扱います。"},
    {id:"jiju",name:"侍従",season:"秋",vector:[2,1,1,3],memory:"衣の袖に残る、静かで端正な余韻",fact:"侍従は人名由来の名として知られる代表名。香の名が人・場の教養を含むことを想像させます。"},
    {id:"kikka",name:"菊花",season:"秋",vector:[2,3,1,2],memory:"澄んだ夕べ、花の輪郭が凛と立つ",fact:"菊花は秋の花を重ねる代表名。花そのものの再現より、場にふさわしい趣を競いました。"},
    {id:"rakuyo",name:"落葉",season:"冬",vector:[2,1,1,4],memory:"乾いた葉が重なり、夕暮れが深くなる",fact:"落葉は秋から冬へ移る景を思わせる代表名。季節の移ろいを言葉と香で扱う見立てです。"},
    {id:"kurobo",name:"黒方",season:"冬",vector:[3,0,0,5],memory:"灯のそばで沈む、重く晴れやかな残り香",fact:"黒方は重厚で格式ある趣と結ばれる代表名。伝わる処方には家や時代による幅があります。"}
  ];
  const SCENARIOS=[
    {id:"spring-letter",season:"春",patron:"北の方",occasion:"初めての文に添える薫物",intent:"ほころぶ花の気配を、朝の清さとともに",title:"baika",heat:"soft",clue:"白い花を見たあとの、冷たい空気",risk:"丁子を強くしすぎると、花の繊細さが隠れます。"},
    {id:"summer-pond",season:"夏",patron:"姫君",occasion:"池のほとりで開く歌会",intent:"水辺の青さを、暑さの中でも軽やかに",title:"kayo",heat:"clear",clue:"葉の上で弾む水と、風の通り道",risk:"火を強くすると、青い気配より煙が先に立ちます。"},
    {id:"autumn-sleeve",season:"秋",patron:"女房",occasion:"客人を迎える衣の袖",intent:"端正で、近づいてから深くなる余韻",title:"jiju",heat:"clear",clue:"袖の端に残る、きちんとした静けさ",risk:"沈香だけに寄せると、相手との距離が遠くなります。"},
    {id:"chrysanthemum",season:"秋",patron:"家司",occasion:"菊の宴の座敷",intent:"花の輪郭を立て、夕刻に沈むように",title:"kikka",heat:"clear",clue:"秋の空気の中で、花びらの縁だけが明るい",risk:"甘松を足しすぎると、宴の香が甘く曖昧になります。"},
    {id:"fallen-leaves",season:"冬",patron:"乳母",occasion:"夜の語らいに焚く香",intent:"葉の重なりと、冬の夕べの奥行き",title:"rakuyo",heat:"deep",clue:"乾いた葉を踏んだあと、灯の熱が残る",risk:"火を急ぐと、深さが焦げた印象へ変わります。"},
    {id:"formal-guest",season:"冬",patron:"主人",occasion:"大切な来客を通す座敷",intent:"あらたまった場を支える、重く澄んだ余韻",title:"kurobo",heat:"deep",clue:"夜の帳と灯のそばに、まっすぐ残る影",risk:"香料を重ねすぎると、格式より重たさが勝ちます。"},
    {id:"spring-lesson",season:"春",patron:"乳母",occasion:"姫君の手習いの座",intent:"花の陰影を添えつつ、やさしく近い気配",title:"baika",heat:"soft",clue:"紙を開いたとき、窓から花の気配が入る",risk:"強い火は、静かな手習いの場に似合いません。"},
    {id:"summer-visitor",season:"夏",patron:"随身",occasion:"遠来の使者を迎える縁",intent:"水辺の風のように、涼やかで失礼のない香",title:"kayo",heat:"clear",clue:"風が衣の間を抜け、葉の影が揺れる",risk:"軽さを急ぐあまり、土台まで薄くしないように。"},
    {id:"autumn-poem",season:"秋",patron:"女房",occasion:"歌を書き継ぐ夜",intent:"花の気配と、言葉のあとに残る深み",title:"kikka",heat:"deep",clue:"書き終えた墨のそばに、花の影だけが残る",risk:"熱を上げるほど点は伸びますが、香が乱れる危険も増します。"},
    {id:"winter-counsel",season:"冬",patron:"家司",occasion:"政所での夜の相談",intent:"言葉を邪魔せず、座を支える確かな重み",title:"kurobo",heat:"deep",clue:"灯の下で、紙と衣の音だけが聞こえる",risk:"重みを求めても、すべてを沈香に任せる必要はありません。"},
    {id:"late-autumn",season:"冬",patron:"下女",occasion:"庭の掃き清めのあと",intent:"散り葉の景を、かすかな温かさで結ぶ",title:"rakuyo",heat:"soft",clue:"掃き寄せた葉のそば、日が低く差している",risk:"甘さを重ねすぎると、葉の乾いた輪郭が消えます。"},
    {id:"autumn-guest",season:"秋",patron:"舎人",occasion:"牛車を待つ客の控え",intent:"品よく整い、遠くからでも場を感じる香",title:"jiju",heat:"clear",clue:"門の外で衣擦れがして、座敷は静かに待つ",risk:"輪郭だけを急ぐと、残り香の品が足りなくなります。"},
    {id:"six-names",season:"春",patron:"女房",occasion:"六種の名を語る小さな集い",intent:"春の名に寄せ、軽い花の余韻を残す",title:"baika",heat:"clear",clue:"名を聞いた人が、それぞれの春を思い出す",risk:"このゲームの配合は学習用の見立てで、史料上の唯一の処方ではありません。"},
    {id:"screen-limits",season:"夏",patron:"童",occasion:"香の話を聞く午後",intent:"画面にない香りを、言葉と景から想像する",title:"kayo",heat:"soft",clue:"香りを見せるのではなく、景を心に浮かべる",risk:"画面は実物の匂いを再現できません。処方を唯一の正解として扱わないでください。"}
  ];
  const MEMORY_OPTIONS=[
    {id:"flower-morning",text:"花がほころぶ朝の冷たさ",vector:[3,5,1,1],titles:["baika","kikka"]},
    {id:"water-breeze",text:"水面を渡る青い風",vector:[1,1,5,1],titles:["kayo"]},
    {id:"lamp-depth",text:"灯のそばに沈む深い余韻",vector:[2,0,0,5],titles:["kurobo","rakuyo"]},
    {id:"fallen-evening",text:"乾いた葉が重なる夕暮れ",vector:[2,1,1,4],titles:["rakuyo","jiju"]},
    {id:"formal-sleeve",text:"袖の端に残る端正な気配",vector:[2,1,1,3],titles:["jiju","kurobo"]},
    {id:"clear-petal",text:"澄んだ花の輪郭",vector:[2,4,1,2],titles:["kikka","baika"]},
    {id:"quiet-seat",text:"重く晴れやかな座の静けさ",vector:[3,0,0,5],titles:["kurobo","jiju"]},
    {id:"paper-window",text:"紙を開いたあとのやわらかな空気",vector:[3,3,1,1],titles:["baika","kayo"]}
  ];

  let stored=readState();
  let session=null;
  let modal=null;
  let priorFocus=null;
  let animationFrame=0;
  let canvasState=null;

  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function text(value){return String(value==null?"":value);}
  function create(tag,className,content){const node=document.createElement(tag);if(className)node.className=className;if(content!==undefined)node.textContent=text(content);return node;}
  function uniqueStrings(value){return Array.from(new Set(Array.isArray(value)?value.filter(item=>typeof item==="string"):[]));}
  function safeCall(fn,args){try{if(typeof fn==="function")fn.apply(null,args||[]);}catch(error){}}
  function signal(kind){try{if(typeof window.beep==="function")window.beep(kind==="good"?740:kind==="risk"?180:400,kind==="good"?.08:.12,kind==="good"?"sine":"triangle",.05);}catch(error){}}
  function shuffle(items,seed){
    const copy=items.slice();let value=Number.isFinite(seed)?seed>>>0:Math.floor(Math.random()*0xffffffff);
    const next=()=>{value=(value*1664525+1013904223)>>>0;return value/0x100000000;};
    for(let index=copy.length-1;index>0;index-=1){const swap=Math.floor(next()*(index+1));const temp=copy[index];copy[index]=copy[swap];copy[swap]=temp;}
    return copy;
  }
  function byId(list,id){return list.find(item=>item.id===id)||null;}
  function readState(){
    try{
      const raw=window.localStorage&&window.localStorage.getItem(STORAGE_KEY);if(!raw)return defaultStore();
      const parsed=JSON.parse(raw)||{};
      return {version:2,bestScore:Math.max(0,Number(parsed.bestScore)||0),plays:Math.max(0,Number(parsed.plays)||0),masteredQuestionIds:uniqueStrings(parsed.masteredQuestionIds||parsed.masteredScenarioIds),bestRank:typeof parsed.bestRank==="string"?parsed.bestRank:"",roundsPlayed:Math.max(0,Number(parsed.roundsPlayed)||0)};
    }catch(error){return defaultStore();}
  }
  function defaultStore(){return {version:2,bestScore:0,plays:0,masteredQuestionIds:[],bestRank:"",roundsPlayed:0};}
  function writeState(){try{if(window.localStorage)window.localStorage.setItem(STORAGE_KEY,JSON.stringify(stored));}catch(error){}}
  function materialMap(){const map={};MATERIALS.forEach(item=>{map[item.id]=item;});return map;}
  const materialById=materialMap();
  function scenarioTitle(){return session&&byId(TITLES,session.rounds[session.index].title);}
  function currentScenario(){return session&&session.rounds[session.index]||null;}
  function defaultBlend(){return {byakudan:1,jinko:1,choji:0,koko:0,kanso:0,kakkou:0};}
  function blendTotal(blend){return Object.values(blend).reduce((sum,value)=>sum+(Number(value)||0),0);}
  function blendVector(blend){
    const vector=[0,0,0,0];MATERIALS.forEach(item=>{const amount=Number(blend[item.id])||0;item.vector.forEach((value,index)=>{vector[index]+=value*amount;});});return vector;
  }
  function totalTarget(vector){return vector.reduce((sum,value)=>sum+value,0);}
  function makeRound(scenario){
    const title=byId(TITLES,scenario.title);
    let memoryChoices=shuffle(MEMORY_OPTIONS,Math.floor(Math.random()*0xffffffff)).slice(0,4);
    const resonant=MEMORY_OPTIONS.find(item=>item.titles.includes(title.id));
    if(resonant&&!memoryChoices.some(item=>item.id===resonant.id))memoryChoices[0]=resonant;
    memoryChoices=shuffle(memoryChoices,Math.floor(Math.random()*0xffffffff));
    return {scenario,title,memoryChoices,blend:defaultBlend(),selectedTitle:null,heat:null,blendResult:null,memoryBonus:0,memoryChoice:null,feedback:""};
  }
  function gradeFor(score){if(score>=330)return {rank:"雅匠",line:"三つの座を、景と香名で見事に結びました。"};if(score>=255)return {rank:"香の聞き手",line:"趣を見失わず、よい加減を探れています。"};if(score>=180)return {rank:"香帳見習い",line:"香材と景のつながりが、少しずつ見えてきました。"};return {rank:"炉辺の学び手",line:"講評を手がかりに、もう一度香を練ってみましょう。"};}
  function statLabel(value){if(value>=84)return "見事";if(value>=64)return "よく合う";if(value>=42)return "あと一歩";return "要調整";}
  function calculateBlend(round){
    const title=round.title,scenario=round.scenario,vector=blendVector(round.blend),amount=blendTotal(round.blend),target=title.vector;
    const targetScale=Math.max(1,totalTarget(target));const actualScale=Math.max(1,totalTarget(vector));
    const normalized=vector.map(value=>value/actualScale);const wanted=target.map(value=>value/targetScale);
    const distance=normalized.reduce((sum,value,index)=>sum+Math.abs(value-wanted[index]),0);
    const balance=clamp(Math.round(100-distance*88-Math.abs(amount-6)*5),0,100);
    const selectedIndex=TITLES.findIndex(item=>item.id===round.selectedTitle),targetIndex=TITLES.findIndex(item=>item.id===title.id);
    const titleFit=round.selectedTitle===title.id?100:selectedIndex<0?20:clamp(54-Math.abs(selectedIndex-targetIndex)*9,16,54);
    const expectedHeat=scenario.heat;const heatFit=round.heat===expectedHeat?100:round.heat==="deep"&&expectedHeat==="soft"?38:63;
    const spice=round.blend.choji||0;const risk=clamp(Math.round((amount>7?(amount-7)*10:0)+(round.heat==="deep"?15:round.heat==="clear"?7:2)+(spice>2?(spice-2)*11:0)+(round.blend.jinko>3?8:0)),3,72);
    const roll=Math.random()*100;const mishap=roll<risk;
    const daring=round.heat==="deep"&&!mishap?7:0;
    const score=clamp(Math.round(balance*.56+titleFit*.23+heatFit*.17+daring-(mishap?24:0)),0,100);
    const note=mishap?"火が少し強く、煙が先に立ちました。":score>=82?"香材が重なり、依頼の景がよく立ち上がりました。":score>=58?"狙いは届いています。次は香名か火加減をもう少し寄せられそうです。":"香りの向きが散りました。依頼の景から、基調を一つ決めてみましょう。";
    return {balance,titleFit,heatFit,risk,mishap,score,note,vector,amount};
  }
  function calculateMemoryFit(round,choice){
    const actual=round.blendResult.vector,target=choice.vector;
    const actualScale=Math.max(1,totalTarget(actual)),targetScale=Math.max(1,totalTarget(target));
    const distance=actual.reduce((sum,value,index)=>sum+Math.abs(value/actualScale-target[index]/targetScale),0);
    const scentFit=clamp(Math.round(100-distance*86),0,100);
    const titleEcho=choice.titles.includes(round.selectedTitle)?100:choice.titles.includes(round.scenario.title)?72:38;
    const score=clamp(Math.round(scentFit*.19+titleEcho*.06),4,25);
    return {score,scentFit,titleEcho};
  }
  function awardMastery(scenario){
    if(stored.masteredQuestionIds.includes(scenario.id))return;
    stored.masteredQuestionIds.push(scenario.id);writeState();
    safeCall(window.recordProgress,["kohAwase",1]);safeCall(window.gainParam,["knowledge",1]);safeCall(window.gainParam,["miyabi",1]);safeCall(window.markDailyMission,["quiz"]);
  }

  function injectStyle(){
    if(document.querySelector("#kohAwaseStyle"))return;
    const style=document.createElement("style");style.id="kohAwaseStyle";
    style.textContent=`
      .koh-awase-entry{background:#1d4b48!important;border-color:#8cbdab!important;color:#fff9e9!important}.koh-awase-entry:hover,.koh-awase-entry:focus-visible{filter:brightness(1.14);outline:2px solid #f1d176;outline-offset:2px}
      .koh-awase-modal{position:fixed;inset:0;z-index:10090;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(10,15,16,.88);font-family:serif}.koh-awase-modal.is-open{display:flex}.koh-awase-sheet{width:min(960px,100%);max-height:calc(100vh - 36px);overflow:auto;box-sizing:border-box;background:#f4eedf;color:#28271f;border:2px solid #b28b43;border-radius:7px;box-shadow:0 22px 70px rgba(0,0,0,.55)}
      .koh-awase-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;background:#183c39;color:#fff8e8;border-bottom:3px solid #b28b43}.koh-awase-kicker{margin:0;color:#dec886;font-size:12px}.koh-awase-title{margin:2px 0 0;font-size:25px;line-height:1.16}.koh-awase-close{width:38px;height:38px;border:1px solid #d9c07a;border-radius:4px;background:transparent;color:#fff8e8;font:24px/1 sans-serif;cursor:pointer}.koh-awase-close:hover,.koh-awase-close:focus-visible{background:#28534e;outline:2px solid #f2d37c;outline-offset:2px}
      .koh-awase-body{padding:18px;display:grid;gap:15px}.koh-awase-topline{display:flex;justify-content:space-between;gap:10px;color:#66552b;font-size:14px}.koh-awase-progress{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.koh-awase-progress i{height:5px;background:#d6c6a2;border-radius:2px}.koh-awase-progress i.is-done{background:#3e7d6a}.koh-awase-progress i.is-current{background:#bf8833}
      .koh-awase-stage{display:grid;grid-template-columns:minmax(240px,.86fr) minmax(330px,1.14fr);gap:16px;align-items:start}.koh-awase-hearth{position:relative;width:100%;min-width:0;min-height:280px;overflow:hidden;border:1px solid #73572c;background:#151c1b;box-shadow:inset 0 0 0 8px #2c2920, inset 0 0 30px #000;box-sizing:border-box}.koh-awase-canvas{display:block!important;width:100%!important;height:280px}.koh-awase-hearth-label{position:absolute;left:13px;bottom:11px;color:#f6e4b1;font-size:13px;text-shadow:0 1px 2px #000}.koh-awase-panel{display:grid;min-width:0;gap:12px}.koh-awase-request{padding:14px 15px;border-left:4px solid #ad7930;background:#e9ddbf;line-height:1.55}.koh-awase-request strong{display:block;font-size:19px}.koh-awase-request-meta{margin-top:6px;color:#695527;font-size:13px}.koh-awase-note{margin:0;padding:10px 12px;border-left:4px solid #8c7651;background:#fbf5e8;font-size:14px;line-height:1.55}.koh-awase-section-title{margin:0;font-size:18px;line-height:1.35}.koh-awase-section-sub{margin:-6px 0 0;color:#70633f;font-size:13px;line-height:1.45}
      .koh-awase-brief-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.koh-awase-brief-item{padding:10px;border-top:4px solid #97713b;background:#fff8e8;text-align:center}.koh-awase-brief-item span{display:block;color:#74613a;font-size:12px}.koh-awase-brief-item b{display:block;margin-top:3px;font-size:15px}.koh-awase-options{display:grid;grid-template-columns:1fr 1fr;gap:9px}.koh-awase-option{min-height:76px;padding:11px;border:1px solid #947946;border-radius:4px;background:#fffaf0;color:#28271f;text-align:left;font:inherit;cursor:pointer}.koh-awase-option b{display:block;font-size:17px}.koh-awase-option small{display:block;margin-top:4px;color:#71603b;font-size:12px}.koh-awase-option:hover,.koh-awase-option:focus-visible{border-color:#2f7668;background:#edf6ee;outline:2px solid #4c9b89;outline-offset:1px}.koh-awase-option.is-selected{border-color:#2f7552;background:#d7eadb;box-shadow:inset 0 0 0 2px #2f7552}.koh-awase-option:disabled{cursor:default;opacity:1}
      .koh-awase-materials{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.koh-awase-material{display:grid;grid-template-columns:12px 1fr auto;gap:9px;align-items:center;min-height:68px;padding:8px;border:1px solid #b59a64;background:#fffaf0}.koh-awase-material-dot{width:9px;height:42px;background:var(--mat);border-radius:2px}.koh-awase-material b{font-size:16px}.koh-awase-material small{display:block;margin-top:2px;color:#766844;font-size:12px;line-height:1.25}.koh-awase-stepper{display:grid;grid-template-columns:32px 27px 32px;gap:2px;align-items:center}.koh-awase-stepper button{width:32px;height:32px;border:1px solid #81682f;border-radius:3px;background:#efe1bd;color:#47391c;font:20px/1 sans-serif;cursor:pointer}.koh-awase-stepper button:hover,.koh-awase-stepper button:focus-visible{background:#d9bc76;outline:2px solid #526d52;outline-offset:1px}.koh-awase-stepper span{text-align:center;font-weight:bold}
      .koh-awase-profile{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:10px;border:1px solid #c4ad78;background:#f8f0dc}.koh-awase-profile-item{display:grid;gap:4px;color:#594923;font-size:12px}.koh-awase-profile-track{height:8px;overflow:hidden;background:#d8ccb0}.koh-awase-profile-fill{display:block;height:100%;background:#2f7668}.koh-awase-title-grid,.koh-awase-heat{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.koh-awase-chip{min-height:43px;border:1px solid #9d8450;border-radius:3px;background:#fff9ec;color:#342b1b;font:inherit;cursor:pointer}.koh-awase-chip:hover,.koh-awase-chip:focus-visible,.koh-awase-chip.is-selected{border-color:#276c61;background:#dceee4;outline:2px solid transparent}.koh-awase-chip.is-selected{box-shadow:inset 0 0 0 2px #276c61}.koh-awase-heat{grid-template-columns:repeat(3,1fr)}.koh-awase-risk{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border:1px solid #c4ad78;background:#f8f0dc;color:#5d4a22;font-size:14px}.koh-awase-risk meter{width:130px;accent-color:#a06030}.koh-awase-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.koh-awase-action{min-height:44px;padding:9px 16px;border:1px solid #70531f;border-radius:4px;background:#996b1f;color:#fffbea;font:inherit;font-weight:bold;cursor:pointer}.koh-awase-action.is-quiet{background:#e8dcc0;color:#4c3a1b}.koh-awase-action:hover,.koh-awase-action:focus-visible{filter:brightness(1.08);outline:2px solid #cbad5c;outline-offset:2px}
      .koh-awase-feedback{padding:12px;border:1px solid #b9a16d;background:#fff9eb;line-height:1.55}.koh-awase-feedback[hidden]{display:none}.koh-awase-evaluation{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.koh-awase-eval{padding:9px;border-top:4px solid #9c7b36;background:#fbf5e8;text-align:center}.koh-awase-eval b{display:block;margin-top:3px;font-size:17px}.koh-awase-review{display:grid;gap:9px}.koh-awase-review-item{padding:11px;border-left:4px solid #a37838;background:#fff9ec;line-height:1.5}.koh-awase-complete{margin:0;font-size:21px;line-height:1.45}.koh-awase-facts{margin:0;color:#66552a;font-size:14px}.koh-awase-book{margin-top:4px;padding-top:12px;border-top:1px solid #c6b17d}.koh-awase-book summary{cursor:pointer;font-weight:bold}.koh-awase-book-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:9px}.koh-awase-book-grid div{padding:8px;background:#fbf5e8;border-left:3px solid #8c7651;font-size:13px;line-height:1.45}
      @media(max-width:650px){.koh-awase-modal{padding:8px}.koh-awase-sheet{max-height:calc(100vh - 16px)}.koh-awase-head{padding:12px}.koh-awase-title{font-size:21px}.koh-awase-body{padding:12px;gap:11px}.koh-awase-stage{grid-template-columns:1fr}.koh-awase-hearth,.koh-awase-canvas{min-height:185px;height:185px}.koh-awase-materials{grid-template-columns:1fr}.koh-awase-title-grid{grid-template-columns:repeat(2,1fr)}.koh-awase-actions{display:grid;grid-template-columns:1fr}.koh-awase-action{width:100%}}
      @media(max-width:390px){.koh-awase-body{padding:10px}.koh-awase-options{grid-template-columns:1fr}.koh-awase-hearth,.koh-awase-canvas{min-height:166px;height:166px}.koh-awase-material{min-height:60px}.koh-awase-title-grid{grid-template-columns:repeat(3,1fr)}.koh-awase-chip{font-size:13px}.koh-awase-note,.koh-awase-request{font-size:13px}}
      @media(prefers-reduced-motion:reduce){.koh-awase-modal,.koh-awase-sheet,*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
    `;document.head.appendChild(style);
  }
  function ensureModal(){
    if(modal)return modal;injectStyle();modal=create("div","koh-awase-modal");modal.id=MODAL_ID;modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-labelledby","kohAwaseTitle");modal.addEventListener("mousedown",event=>{if(event.target===modal)close();});modal.addEventListener("keydown",handleKeydown);document.body.appendChild(modal);return modal;
  }
  function renderFrame(){
    const root=ensureModal();root.replaceChildren();const sheet=create("section","koh-awase-sheet");const head=create("header","koh-awase-head");const words=create("div");words.append(create("p","koh-awase-kicker","平安の練香を、景・名・火加減から読み解く"));const heading=create("h2","koh-awase-title","薫物合 香合わせ");heading.id="kohAwaseTitle";words.append(heading);const closeButton=create("button","koh-awase-close","×");closeButton.type="button";closeButton.title="閉じる（Esc）";closeButton.setAttribute("aria-label","香合わせを閉じる");closeButton.addEventListener("click",close);head.append(words,closeButton);sheet.append(head);root.append(sheet);return sheet;
  }
  function makeProgress(round){
    const bar=create("div","koh-awase-progress");for(let index=0;index<ROUNDS;index+=1){const mark=create("i");if(index<session.index)mark.className="is-done";else if(index===session.index)mark.className="is-current";bar.append(mark);}return bar;
  }
  function appendTop(body,round){const line=create("div","koh-awase-topline");line.append(create("span",null,`第 ${session.index+1} 局 / ${ROUNDS}`),create("span",null,`総合 ${session.score} 点`));body.append(line,makeProgress(round));}
  function appendHearth(body,round){
    const stage=create("div","koh-awase-stage");const hearth=create("div","koh-awase-hearth");const canvas=create("canvas","koh-awase-canvas");canvas.setAttribute("aria-label","香炉と立ちのぼる香の視覚表現");canvas.setAttribute("role","img");const chosen=byId(TITLES,round.selectedTitle);hearth.append(canvas,create("span","koh-awase-hearth-label",chosen?chosen.name+" の香炉":"香名を待つ香炉"));const panel=create("div","koh-awase-panel");const request=create("article","koh-awase-request");request.append(create("strong",null,`${round.scenario.patron}からの依頼`),create("span",null,round.scenario.intent),create("div","koh-awase-request-meta",`${round.scenario.season} / ${round.scenario.occasion}`));panel.append(request);stage.append(hearth,panel);body.append(stage);startCanvas(canvas,round);return panel;
  }
  function startCanvas(canvas,round){
    if(animationFrame)window.cancelAnimationFrame(animationFrame);canvasState={canvas,round,started:performance.now()};
    const paint=now=>{
      if(!canvasState||canvasState.canvas!==canvas)return;const rect=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2),width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      const chosen=byId(TITLES,round.selectedTitle),chosenId=chosen?chosen.id:"",context=canvas.getContext("2d"),w=width,h=height,t=reducedMotion()?0:(now-canvasState.started)/1000,blend=round.blend||defaultBlend(),vector=blendVector(blend),titleColor=chosenId==="kayo"?"#759d8d":chosenId==="baika"?"#c28e9c":chosenId==="kurobo"?"#947253":"#c69359";
      context.clearRect(0,0,w,h);context.fillStyle="#121a19";context.fillRect(0,0,w,h);for(let index=0;index<16;index+=1){context.strokeStyle=`rgba(235,219,173,${.025+(index%3)*.01})`;context.beginPath();context.moveTo(0,(index*h)/16);context.lineTo(w,(index*h)/16+Math.sin(index*4)*ratio);context.stroke();}
      const bowlY=h*.72,bowlR=Math.min(w*.29,h*.32);context.beginPath();context.ellipse(w*.5,bowlY,bowlR,bowlR*.34,0,0,Math.PI*2);context.fillStyle="#39291f";context.fill();context.strokeStyle="#b28b4b";context.lineWidth=2*ratio;context.stroke();const ember=context.createRadialGradient(w*.5,bowlY,bowlR*.08,w*.5,bowlY,bowlR*.85);ember.addColorStop(0,"#ffd778");ember.addColorStop(.22,"#ba6332");ember.addColorStop(1,"#34231c");context.fillStyle=ember;context.beginPath();context.ellipse(w*.5,bowlY,bowlR*.76,bowlR*.19,0,0,Math.PI*2);context.fill();
      const density=clamp(blendTotal(blend),2,10);for(let stream=0;stream<4;stream+=1){context.beginPath();for(let step=0;step<=28;step+=1){const y=bowlY-step*h*.025;const x=w*.5+(stream-1.5)*w*.035+Math.sin(step*.33+stream*1.9+t*1.2)*(w*.025+step*w*.003)+((vector[2]-vector[3])*step*w*.0003);if(step===0)context.moveTo(x,y);else context.lineTo(x,y);}context.strokeStyle=stream%2?"rgba(223,235,214,.32)":titleColor.replace("#","rgba(")+",.28)";if(stream%2===0){const hex=titleColor;const red=parseInt(hex.slice(1,3),16),green=parseInt(hex.slice(3,5),16),blue=parseInt(hex.slice(5,7),16);context.strokeStyle=`rgba(${red},${green},${blue},.32)`;}context.lineWidth=(1.1+stream*.3)*ratio;context.stroke();}
      context.fillStyle="rgba(244,226,174,.84)";context.font=`${Math.round(13*ratio)}px serif`;context.fillText("香炉",w*.5-14*ratio,bowlY+5*ratio);if(!reducedMotion())animationFrame=window.requestAnimationFrame(paint);else animationFrame=0;
    };animationFrame=window.requestAnimationFrame(paint);
  }
  function appendBook(body){const book=create("details","koh-awase-book");book.append(create("summary",null,"香帳をひらく：六種の薫物"));const grid=create("div","koh-awase-book-grid");TITLES.forEach(title=>{const cell=create("div");cell.append(create("strong",null,`${title.name} / ${title.season}`),create("span",null,title.fact));grid.append(cell);});book.append(grid);body.append(book);}
  function appendProfile(panel,round){
    const profile=create("div","koh-awase-profile"),vector=blendVector(round.blend),max=Math.max(1,...vector);
    ["温","花","青","深"].forEach((label,index)=>{const item=create("div","koh-awase-profile-item");item.append(create("span",null,label));const track=create("span","koh-awase-profile-track"),fill=create("i","koh-awase-profile-fill");fill.style.width=`${Math.round(vector[index]/max*100)}%`;track.append(fill);item.append(track);profile.append(item);});
    panel.append(profile);
  }
  function renderMotif(){
    const round=session.rounds[session.index],sheet=renderFrame(),body=create("main","koh-awase-body");appendTop(body,round);const panel=appendHearth(body,round);panel.append(create("h3","koh-awase-section-title","依頼状を読み、香の方針を立てる"),create("p","koh-awase-section-sub","正解札を当てるのではなく、相手・場・季節を手がかりに一つの薫物を仕立てます。"));const focus=create("div","koh-awase-brief-grid");[["季節",round.scenario.season],["相手",round.scenario.patron],["場",round.scenario.occasion]].forEach(([label,value])=>{const item=create("div","koh-awase-brief-item");item.append(create("span",null,label),create("b",null,value));focus.append(item);});panel.append(focus,create("p","koh-awase-note",`聞きどころ：${round.scenario.clue}`));const actions=create("div","koh-awase-actions");const nextButton=create("button","koh-awase-action","調香を始める");nextButton.type="button";nextButton.addEventListener("click",()=>{session.phase="blend";render();});actions.append(nextButton);panel.append(actions);appendBook(body);sheet.append(body);
  }
  function renderBlend(){
    const round=session.rounds[session.index],sheet=renderFrame(),body=create("main","koh-awase-body");appendTop(body,round);const panel=appendHearth(body,round);panel.append(create("h3","koh-awase-section-title","練り合わせる"),create("p","koh-awase-section-sub","香材を 4〜8 目安で選び、香名と火加減を決めます。合計を増やすほど、香は豊かにも乱れやすくもなります。"));const materials=create("div","koh-awase-materials");MATERIALS.forEach(material=>{const row=create("div","koh-awase-material");row.style.setProperty("--mat",material.color);row.append(create("span","koh-awase-material-dot"));const info=create("div");info.append(create("b",null,material.name),create("small",null,`${material.tone}：${material.note}`));const stepper=create("div","koh-awase-stepper");const minus=create("button",null,"−");minus.type="button";minus.title=`${material.name}を減らす`;minus.setAttribute("aria-label",`${material.name}を減らす`);minus.addEventListener("click",()=>setBlend(material.id,(round.blend[material.id]||0)-1));const amount=create("span",null,String(round.blend[material.id]||0));amount.setAttribute("aria-label",`${material.name} ${round.blend[material.id]||0} 目`);const plus=create("button",null,"+");plus.type="button";plus.title=`${material.name}を増やす`;plus.setAttribute("aria-label",`${material.name}を増やす`);plus.addEventListener("click",()=>setBlend(material.id,(round.blend[material.id]||0)+1));stepper.append(minus,amount,plus);row.append(info,stepper);materials.append(row);});panel.append(materials);appendProfile(panel,round);
    panel.append(create("h4","koh-awase-section-title","香名を掲げる"));const titleGrid=create("div","koh-awase-title-grid");TITLES.forEach(title=>{const button=create("button","koh-awase-chip",title.name);button.type="button";button.classList.toggle("is-selected",round.selectedTitle===title.id);button.setAttribute("aria-pressed",String(round.selectedTitle===title.id));button.addEventListener("click",()=>setTitle(title.id));titleGrid.append(button);});panel.append(titleGrid);
    panel.append(create("h4","koh-awase-section-title","火加減"));const heat=create("div","koh-awase-heat");[{id:"soft",name:"やわらかく"},{id:"clear",name:"澄ませる"},{id:"deep",name:"深く攻める"}].forEach(item=>{const button=create("button","koh-awase-chip",item.name);button.type="button";button.classList.toggle("is-selected",round.heat===item.id);button.setAttribute("aria-pressed",String(round.heat===item.id));button.addEventListener("click",()=>setHeat(item.id));heat.append(button);});panel.append(heat);const estimate=calculateBlend(Object.assign({},round,{blendResult:null}));const risk=create("div","koh-awase-risk");risk.append(create("span",null,`香材 ${blendTotal(round.blend)} 目 / 予想される乱れ`));const meter=create("meter");meter.min=0;meter.max=72;meter.value=estimate.risk;meter.setAttribute("aria-label",`乱れの危険 ${estimate.risk}`);risk.append(meter,create("strong",null,`${estimate.risk}%`));panel.append(risk);panel.append(create("p","koh-awase-note",round.scenario.risk));const actions=create("div","koh-awase-actions");const back=create("button","koh-awase-action is-quiet","見立てに戻る");back.type="button";back.addEventListener("click",()=>{session.phase="motif";render();});const submit=create("button","koh-awase-action","香炉にくべる");submit.type="button";submit.addEventListener("click",submitBlend);actions.append(back,submit);panel.append(actions);appendBook(body);sheet.append(body);
  }
  function renderListen(){
    const round=session.rounds[session.index],result=round.blendResult,sheet=renderFrame(),body=create("main","koh-awase-body");appendTop(body,round);const panel=appendHearth(body,round);panel.append(create("h3","koh-awase-section-title","鑑香：立ちのぼった気配を言葉にする"),create("p","koh-awase-section-sub","完成した香の輪郭に、もっとも響く聞書きを一つ残します。固定の正解ではなく、配合と香名との重なりで評価されます。"));const evaluation=create("div","koh-awase-evaluation");[["配合",result.balance],["香名",result.titleFit],["火加減",result.heatFit]].forEach(item=>{const box=create("div","koh-awase-eval");box.append(create("span",null,item[0]),create("b",null,statLabel(item[1])));evaluation.append(box);});panel.append(evaluation);const options=create("div","koh-awase-options");options.setAttribute("role","group");options.setAttribute("aria-label","残り香の聞書き");round.memoryChoices.forEach((choice,index)=>{const button=create("button","koh-awase-option",`${index+1}. ${choice.text}`);button.type="button";button.dataset.index=String(index);button.addEventListener("click",()=>answer(index));options.append(button);});panel.append(options);const feedback=create("div","koh-awase-feedback");feedback.id="kohAwaseFeedback";feedback.hidden=true;feedback.setAttribute("aria-live","polite");panel.append(feedback);const actions=create("div","koh-awase-actions");const nextButton=create("button","koh-awase-action","講評を見る");nextButton.type="button";nextButton.hidden=true;nextButton.addEventListener("click",finishRound);actions.append(nextButton);panel.append(actions);appendBook(body);sheet.append(body);
  }
  function renderRoundReview(){
    const round=session.rounds[session.index],result=round.blendResult,chosenTitle=byId(TITLES,round.selectedTitle)||round.title,earned=result.score+round.memoryBonus,sheet=renderFrame(),body=create("main","koh-awase-body");appendTop(body,round);const panel=appendHearth(body,round);panel.append(create("h3","koh-awase-section-title",`${chosenTitle.name} の講評：${earned} 点`),create("p","koh-awase-note",result.note));const feedback=create("div","koh-awase-feedback");feedback.append(create("strong",null,"学びの余白"),create("div",null,chosenTitle.fact),create("div",null,"このゲームの香材の役割や得点は、歴史上の処方を再現・断定するものではありません。家や人、時代による違いを考える入口です。"));panel.append(feedback);const actions=create("div","koh-awase-actions");const nextButton=create("button","koh-awase-action",session.index===ROUNDS-1?"薫物合の結果へ":"次の依頼へ");nextButton.type="button";nextButton.addEventListener("click",()=>{if(session.index===ROUNDS-1){session.complete=true;renderComplete();}else{session.index+=1;session.phase="motif";session.answered=false;render();}});actions.append(nextButton);panel.append(actions);appendBook(body);sheet.append(body);
  }
  function renderComplete(){
    const grade=gradeFor(session.score);session.complete=true;stored.bestScore=Math.max(stored.bestScore,session.score);if(stored.bestScore===session.score)stored.bestRank=grade.rank;stored.roundsPlayed+=ROUNDS;writeState();
    if(!session.onlineSubmitted&&window.ONLINE_COMPETITION){
      session.onlineSubmitted=true;
      const duration=Math.max(0,Date.now()-session.startedAt),meta={grade:grade.rank,rounds:ROUNDS};
      window.ONLINE_COMPETITION.finishChallenge("koh_awase",session.score,duration,meta)
        .then(handled=>{if(!handled)window.ONLINE_COMPETITION.submitScore("koh_awase",session.score,duration,meta);})
        .catch(()=>window.ONLINE_COMPETITION.submitScore("koh_awase",session.score,duration,meta));
    }
    const sheet=renderFrame(),body=create("main","koh-awase-body");body.append(create("p","koh-awase-complete",`${grade.rank}：${session.score} 点`),create("p","koh-awase-facts",grade.line),create("p","koh-awase-note",`最高記録 ${stored.bestScore} 点 ${stored.bestRank?`/ ${stored.bestRank}`:""}・香帳に残した依頼 ${stored.masteredQuestionIds.length} / ${SCENARIOS.length}`));const review=create("section","koh-awase-review");review.append(create("h3","koh-awase-section-title","三局の聞書き"));session.rounds.forEach(round=>{const score=(round.blendResult?round.blendResult.score:0)+round.memoryBonus,chosenTitle=byId(TITLES,round.selectedTitle)||round.title;const item=create("div","koh-awase-review-item");item.append(create("strong",null,`${chosenTitle.name} / ${score} 点`),create("div",null,`${round.scenario.occasion}。${round.memoryChoice?round.memoryChoice.text:chosenTitle.memory}`));review.append(item);});body.append(review);const actions=create("div","koh-awase-actions");const again=create("button","koh-awase-action","別の依頼で合せる");again.type="button";again.addEventListener("click",()=>start());actions.append(again);body.append(actions);appendBook(body);sheet.append(body);again.focus();
  }
  function render(){if(!session)return;if(session.complete){renderComplete();return;}if(session.phase==="motif")renderMotif();else if(session.phase==="blend")renderBlend();else if(session.phase==="listen")renderListen();else if(session.phase==="review")renderRoundReview();}
  function showChoiceState(message,nextLabel){
    if(!modal)return;modal.querySelectorAll(".koh-awase-option").forEach((button,index)=>{button.disabled=true;if(index===session.selectedIndex)button.classList.add("is-selected");});const feedback=modal.querySelector("#kohAwaseFeedback");if(feedback){feedback.hidden=false;feedback.textContent=message;}const nextButton=modal.querySelector(".koh-awase-actions .koh-awase-action");if(nextButton){nextButton.hidden=false;nextButton.textContent=nextLabel;nextButton.focus();}}
  function answer(index){
    if(!session||session.complete||session.answered)return false;const round=session.rounds[session.index];if(!Number.isInteger(index)||index<0||index>3)return false;session.selectedIndex=index;
    if(session.phase==="listen"){
      const choice=round.memoryChoices[index],fit=calculateMemoryFit(round,choice);session.answer=null;session.answered=true;round.memoryChoice=choice;round.memoryBonus=fit.score;signal(fit.score>=20?"good":fit.score>=12?"risk":"bad");const message=`「${choice.text}」を聞書きに残しました。香の輪郭との響き ${fit.score} / 25 点。${round.blendResult.note}`;showChoiceState(message,"講評を見る");return fit.score;
    }
    return false;
  }
  function setBlend(id,amount){if(!session||session.phase!=="blend"||!materialById[id])return false;const round=session.rounds[session.index];round.blend[id]=clamp(Math.round(Number(amount)||0),0,4);render();return true;}
  function setTitle(id){if(!session||session.phase!=="blend"||!byId(TITLES,id))return false;session.rounds[session.index].selectedTitle=id;render();return true;}
  function setHeat(id){if(!session||session.phase!=="blend"||!["soft","clear","deep"].includes(id))return false;session.rounds[session.index].heat=id;render();return true;}
  function submitBlend(){if(!session||session.phase!=="blend")return false;const round=session.rounds[session.index],total=blendTotal(round.blend),notice=modal&&modal.querySelector(".koh-awase-note");if(total<3){if(notice)notice.textContent="香材がまだ少なすぎます。少なくとも 3 目を練り合わせて、基調をつくりましょう。";signal("bad");return false;}if(!round.selectedTitle){if(notice)notice.textContent="この薫物に掲げる香名を一つ選びましょう。";signal("bad");return false;}if(!round.heat){if(notice)notice.textContent="香炉の火加減を決めてから、香をくべましょう。";signal("bad");return false;}round.blendResult=calculateBlend(round);session.phase="listen";session.answered=false;session.selectedIndex=null;session.answer=null;render();return true;}
  function finishRound(){if(!session||session.phase!=="listen"||!session.answered)return false;const round=session.rounds[session.index];session.phase="review";session.score+=round.blendResult.score+round.memoryBonus;if(round.blendResult.score+round.memoryBonus>=82)awardMastery(round.scenario);render();return true;}
  function next(){
    if(!session)return false;if(session.phase==="motif"){session.phase="blend";session.answered=false;render();return true;}if(session.phase==="listen"&&session.answered)return finishRound();if(session.phase==="review"){if(session.index===ROUNDS-1){session.complete=true;renderComplete();}else{session.index+=1;session.phase="motif";session.answered=false;render();}return true;}return false;
  }
  function start(options){
    stored=readState();const config=options&&typeof options==="object"?options:{};let candidates=SCENARIOS.slice();if(config.scenarioId){const forced=byId(SCENARIOS,config.scenarioId);if(forced)candidates=[forced].concat(candidates.filter(item=>item.id!==forced.id));}const rounds=shuffle(candidates,config.seed).slice(0,ROUNDS).map(makeRound);session={rounds,index:0,score:0,phase:"motif",answered:false,selectedIndex:null,answer:null,complete:false,startedAt:Date.now(),onlineSubmitted:false};stored.plays+=1;writeState();if(modal&&modal.classList.contains("is-open"))render();return getState();
  }
  function open(){priorFocus=document.activeElement;const root=ensureModal();root.classList.add("is-open");if(!session)start();else render();const focusable=root.querySelector("button:not([disabled])");if(focusable)focusable.focus();}
  function close(){if(animationFrame)window.cancelAnimationFrame(animationFrame);animationFrame=0;if(!modal)return;modal.classList.remove("is-open");if(priorFocus&&typeof priorFocus.focus==="function")try{priorFocus.focus();}catch(error){}}
  function handleKeydown(event){
    if(!modal||!modal.classList.contains("is-open"))return;if(event.key==="Escape"){event.preventDefault();close();return;}if(!session)return;
    if(session.phase==="listen"){const number=Number(event.key);if(number>=1&&number<=4&&!session.answered){event.preventDefault();answer(number-1);return;}}
    if(session.phase==="listen"&&!session.answered&&(event.key==="ArrowDown"||event.key==="ArrowUp"||event.key==="ArrowRight"||event.key==="ArrowLeft")){
      const choices=Array.from(modal.querySelectorAll(".koh-awase-option:not([disabled])"));if(choices.length){event.preventDefault();const current=choices.indexOf(document.activeElement);const delta=(event.key==="ArrowDown"||event.key==="ArrowRight")?1:-1;choices[(current+delta+choices.length)%choices.length].focus();}return;
    }
    if(event.key==="Enter"&&session.answered){const action=modal.querySelector(".koh-awase-actions .koh-awase-action:not([hidden])");if(action&&document.activeElement===modal)action.click();}
  }
  function getState(){
    const round=session&&!session.complete?session.rounds[session.index]:null;return {bestScore:stored.bestScore,plays:stored.plays,masteredQuestionIds:stored.masteredQuestionIds.slice(),session:session?{index:session.index,score:session.score,answered:session.answered,complete:session.complete,phase:session.phase,questionId:round?round.scenario.id:null,answer:session?session.answer:null,rounds:session.rounds.map(item=>({scenarioId:item.scenario.id,titleId:item.selectedTitle,heat:item.heat,blend:Object.assign({},item.blend),blendResult:item.blendResult&&Object.assign({},item.blendResult)}))}:null};}
  function getTestState(){const state=getState();return {ready:true,phase:state.session&&state.session.phase,round:state.session&&state.session.index,answer:state.session&&state.session.answer,modalOpen:!!(modal&&modal.classList.contains("is-open")),scenarioCount:SCENARIOS.length,materialCount:MATERIALS.length,rounds:state.session&&state.session.rounds};}
  function reset(){stored=defaultStore();session=null;try{if(window.localStorage)window.localStorage.removeItem(STORAGE_KEY);}catch(error){}return getState();}
  function injectEntry(){const host=document.querySelector("#taikenSubPanel .t-modes");if(!host||document.getElementById(ENTRY_ID))return !!host;const button=create("button","t-btn koh-awase-entry");button.id=ENTRY_ID;button.type="button";button.title="薫物合を学ぶ";button.setAttribute("aria-label","薫物合 香合わせを開く");button.append(create("span","mode-meta","香文化 / 調香"),create("span","cat-icon","香"),create("span","mode-name","香合わせ"),create("small",null,"景を読み、香材と火加減を調える三局勝負"));button.addEventListener("click",open);host.append(button);return true;}
  function boot(){stored=readState();injectStyle();if(injectEntry())return;let attempts=0;const timer=window.setInterval(()=>{attempts+=1;if(injectEntry()||attempts>=40)window.clearInterval(timer);},250);}

  window.KOH_AWASE={open,close,start,answer,next,getState,getTestState,setBlend,setTitle,setHeat,submitBlend,finishRound,questionBank:SCENARIOS.slice(),scenarioBank:SCENARIOS.slice(),materials:MATERIALS.slice(),titles:TITLES.slice(),reset};
  window.KOH_AWASE_STATUS={ready:true,questions:SCENARIOS.length,storageKey:STORAGE_KEY,version:3,gameLoop:"brief-blend-listen-review"};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
