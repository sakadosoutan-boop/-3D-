/* Loaded after the application and CODEX_VIEWER. Uses the real quiz scoring and discovery locks. */
var LEARNING_EXTENSION=(()=>{
  "use strict";
  const KEY="shinden3d-spaced-review-v1",INTERVALS=[1,3,7,14,30];
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dayKey=(value=Date.now())=>{const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
  function addDays(value,days){const d=new Date(value);d.setDate(d.getDate()+days);return dayKey(d);}
  const validDay=value=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&dayKey(new Date(value+"T12:00:00"))===value;
  const known=id=>Object.prototype.hasOwnProperty.call(ITEMS,id)&&QUIZ_POOL.includes(id);
  function sanitize(raw){
    const clean=Object.create(null);if(!raw||typeof raw!=="object"||Array.isArray(raw))return clean;
    for(const [id,r] of Object.entries(raw)){
      if(!known(id)||!r||typeof r!=="object"||!validDay(r.due)||!validDay(r.lastDay))continue;
      if(![r.correct,r.incorrect,r.streak,r.lastAnswered].every(n=>Number.isFinite(n)&&n>=0))continue;
      clean[id]={correct:Math.min(100000,Math.floor(r.correct)),incorrect:Math.min(100000,Math.floor(r.incorrect)),streak:Math.min(INTERVALS.length,Math.floor(r.streak)),lastAnswered:r.lastAnswered,lastDay:r.lastDay,due:r.due,lastResult:r.lastResult===true,lastChosen:known(r.lastChosen)?r.lastChosen:null};
    }
    return clean;
  }
  let records=Object.create(null),storageOK=true,pendingIdentification=false;
  try{records=sanitize(JSON.parse(localStorage.getItem(KEY)||"{}"));}catch(e){storageOK=false;}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(records));storageOK=true;}catch(e){storageOK=false;}}
  function recordAnswer(id,correct,chosen,assisted=false,now=Date.now()){
    if(!known(id))return;
    const today=dayKey(now),old=records[id],r=old||{correct:0,incorrect:0,streak:0};
    if(correct)r.correct++;else r.incorrect++;
    // Repeating the same successful question on one day cannot fast-forward the spacing schedule.
    if(!correct||assisted)r.streak=0;
    else if(!old||r.lastDay!==today||r.lastResult!==true)r.streak=Math.min(INTERVALS.length,r.streak+1);
    const interval=correct&&!assisted?INTERVALS[Math.max(0,r.streak-1)]:1;
    r.lastDay=today;r.lastAnswered=now;r.due=addDays(now,interval);r.lastResult=correct&&!assisted;r.lastChosen=known(chosen)?chosen:null;records[id]=r;save();refresh();
  }
  function dueIds(now=Date.now()){return Object.keys(records).filter(id=>known(id)&&codexUnlocked.has(id)&&records[id].due<=dayKey(now)).sort((a,b)=>records[a].due.localeCompare(records[b].due)||records[a].lastAnswered-records[b].lastAnswered);}
  function eligible(){return QUIZ_POOL.filter(id=>codexUnlocked.has(id)&&["c","g"].includes(ITEMS[id].cat)&&CODEX_VIEWER.modelRoots(id).length);}
  function choices(id){
    const others=eligible().filter(other=>other!==id),same=others.filter(other=>ITEMS[other].cat===ITEMS[id].cat),rest=others.filter(other=>ITEMS[other].cat!==ITEMS[id].cat);
    return shuffle([id,...shuffle(same).concat(shuffle(rest)).slice(0,3)]);
  }
  function begin(ids,identification){
    ids=[...new Set(ids)].filter(id=>known(id)&&codexUnlocked.has(id)&&(!identification||eligible().includes(id))).slice(0,12);
    if(!ids.length||(identification&&eligible().length<2))return false;
    closeCodex();closeResultPanel();enterMode("quiz");document.getElementById("quizDiffPicker").style.display="none";APP.quizTA=false;
    pendingIdentification=identification;try{startQuiz(ids);}finally{pendingIdentification=false;}return true;
  }
  function startReview(){return begin(dueIds(),false);}
  function startIdentification(ids){return begin(Array.isArray(ids)?ids:shuffle(eligible().slice()).slice(0,8),true);}
  function recordHTML(id){
    const r=records[id];if(!known(id))return"";
    if(!r)return'<p class="learning-record">クイズの解答後に、この端末へ次の復習日を記録します。</p>';
    return `<p class="learning-record">解答記録: 正解 ${r.correct} 回 / 誤答 ${r.incorrect} 回 · 最終 ${escape(r.lastDay)} · 次の復習 ${escape(r.due)}${r.due<=dayKey()?"（今日の復習対象）":""}</p>`;
  }
  const tools=document.createElement("div");tools.id="learningStudyTools";tools.className="learning-tools";
  tools.innerHTML='<strong>日を置いて学び直す</strong><p id="learningReviewStatus" role="status"></p><div><button type="button" id="learningReviewStart">今日の復習</button><button type="button" id="learningIdentificationStart">模型の識別問題</button></div><small>正解は翌日 → 3日 → 7日 → 14日 → 30日後。誤答やヒントを使った項目は翌日に戻ります。</small>';
  const main=document.getElementById("codexMainPage");if(main)main.insertBefore(tools,document.getElementById("codexGrid"));
  document.getElementById("learningReviewStart").onclick=startReview;document.getElementById("learningIdentificationStart").onclick=()=>startIdentification();
  function refresh(){
    const due=dueIds(),count=eligible().length,status=document.getElementById("learningReviewStatus");
    if(status)status.textContent=`今日までの復習 ${due.length} 項目 · 識別に使える発見済み模型 ${count} 項目`+(!storageOK?" · 端末に保存できないため、今回の起動中だけ記録します。":"");
    document.getElementById("learningReviewStart").disabled=!due.length;document.getElementById("learningIdentificationStart").disabled=count<2;
  }
  const baseShow=showQuizQ;
  showQuizQ=function(){
    baseShow.apply(this,arguments);const q=APP.quiz;
    if(pendingIdentification)q.learningIdentification=true;
    if(!q.learningIdentification)return;
    const id=q.qs[q.i];document.getElementById("quizTarget").textContent="模型の名前を選ぶ";
    document.getElementById("quizHint").textContent="形・構造から見分けよう";
    const ok=CODEX_VIEWER.openQuestion(id,choices(id),answer=>quizAnswer(answer),()=>{if(APP.quiz===q){enterMode("walk");toast("識別問題を終了しました。ここまでの解答は記録されています。",2800);}},`${q.i+1} / ${q.qs.length} · 模型の識別問題`);
    if(!ok){q.learningIdentification=false;toast("この模型を表示できないため、散策で答える問題に戻します。",3000);baseShow.apply(this,arguments);}
  };
  const baseAnswer=quizAnswer;
  quizAnswer=function(id){
    const q=APP.quiz;if(!q||q.lock||APP.mode!=="quiz"||PAUSE_STATE.active)return baseAnswer.apply(this,arguments);
    const want=q.qs[q.i],beforeMiss=q.miss,assisted=!!(q.missCur||q.hint1||q.hint2);
    const result=baseAnswer.apply(this,arguments),accepted=id===want&&q.lock||q.miss>beforeMiss;
    if(accepted){recordAnswer(want,id===want,id,assisted);if(q.learningIdentification){CODEX_VIEWER.questionFeedback(id===want);if(id===want)CODEX_VIEWER.close();}}
    return result;
  };
  const baseUpdate=quizUpdate;
  quizUpdate=function(){if(APP.quiz?.learningIdentification)return;return baseUpdate.apply(this,arguments);};
  const baseStart=startQuiz;
  startQuiz=function(){if(CODEX_VIEWER.question)CODEX_VIEWER.close(false,false);return baseStart.apply(this,arguments);};
  const baseEnter=enterMode;
  enterMode=function(){if(CODEX_VIEWER.active)CODEX_VIEWER.close(false,false);return baseEnter.apply(this,arguments);};
  const baseOpen=openCodex;
  openCodex=function(){const result=baseOpen.apply(this,arguments);refresh();return result;};
  const baseDetail=codexDetailHTML;
  codexDetailHTML=function(id){if(!ITEMS[id]||!codexUnlocked.has(id))return"";return baseDetail.apply(this,arguments)+recordHTML(id)+wakaHTML(id)+(typeof taijiBossCodexNotes==="function"?taijiBossCodexNotes(id):"");};
  const baseInfo=showInfo;
  showInfo=function(id){
    const result=baseInfo.apply(this,arguments),body=document.querySelector("#info .info-body");
    if(!body)return result;
    let notes=document.getElementById("infoBossCodexNotes");if(!notes){notes=document.createElement("div");notes.id="infoBossCodexNotes";body.appendChild(notes);}
    notes.innerHTML=codexUnlocked.has(id)&&typeof taijiBossCodexNotes==="function"?taijiBossCodexNotes(id):"";notes.hidden=!notes.innerHTML;return result;
  };
  function wakaHTML(id){
    const note=typeof WAKA_NOTES!=="undefined"?WAKA_NOTES.find(n=>n.id===id):null;if(!note||!codexUnlocked.has(id))return"";
    const rows=(title,list,key1,key2)=>list?.length?`<h4>${title}</h4><dl>${list.map(r=>`<dt>${escape(r[key1])}</dt><dd>${escape(r[key2])}</dd>`).join("")}</dl>`:"";
    // Source verification is field-specific: a digitized poem is not evidence for a biography or every interpretation.
    const verified=note.verified||{};
    return `<details class="waka-deep-notes"><summary>和歌を深く読む · 語釈と修辞</summary><p class="learning-note">語釈・修辞・鑑賞は教材編集者の読みです。歌の解釈には幅があります。</p>${rows("語釈",note.goshaku,"word","gloss")}${rows("修辞・表現",note.gihō,"type","detail")}<h4>鑑賞の一例</h4><p>${escape(note.kanshō)}</p>${verified.background?`<h4>資料で確認した背景</h4><p>${escape(verified.background)}</p>`:""}${verified.source?`<h4>照合した資料</h4><p>${escape(verified.scope)} · <a href="${escape(verified.source)}" target="_blank" rel="noopener noreferrer">${escape(verified.title)}</a></p>`:'<p class="learning-note">成立事情・出典番号は原資料との照合中です。この画面では断定を控えています。</p>'}</details>`;
  }
  const extraRelated={
    kaede:["matsu","tsubaki","waka_au2","waka_au5"],tsubaki:["kaede","matsu"],sakura:["waka_sp1","waka_sp2","waka_sp3"],
    byoubu:["kichou","misu","kabeshiro"],kichou:["byoubu","misu","kabeshiro"],misu:["hajitomi","kichou","byoubu"],
    koto:["biwa","sho","ryuteki"],biwa:["koto","sho","ryuteki"],sho:["ryuteki","koto","biwa"],ryuteki:["sho","koto","biwa"],
    waka_sp1:["sakura","waka_sp2","waka_sp3"],waka_sp2:["sakura","waka_sp1"],waka_sp3:["sakura","waka_sp1"],
    waka_au2:["kaede","waka_au5"],waka_au5:["kaede","waka_au2"],waka_au10:["waka_au1"],waka_au1:["waka_au10"]
  };
  for(const [id,list] of Object.entries(extraRelated)){if(!ITEMS[id])continue;CODEX_RELATED[id]=[...new Set([...(CODEX_RELATED[id]||[]),...list.filter(other=>ITEMS[other])])];}
  const baseWaka=renderWakaPage;
  renderWakaPage=function(){
    const result=baseWaka.apply(this,arguments),list=document.getElementById("wakaList"),rows=list?.querySelectorAll(".waka-row"),ordered=["spring","summer","autumn","winter"].flatMap(season=>WAKA_DATA.filter(w=>w.season===season));
    rows?.forEach((row,i)=>{const id=ordered[i]?.id;if(!codexUnlocked.has(id))return;const html=wakaHTML(id);if(html)row.insertAdjacentHTML("beforeend",html);row.insertAdjacentHTML("beforeend",codexRelatedChipsHTML(id));});return result;
  };
  document.getElementById("wakaList")?.addEventListener("click",e=>{const b=e.target.closest("[data-rel]");if(b&&!b.disabled&&codexUnlocked.has(b.dataset.rel)){setCodexTab("main");codexShowDetail(b.dataset.rel);}});
  const viewer=document.getElementById("codexViewer"),context=document.createElement("details");context.id="viewerLearningContext";context.innerHTML='<summary>模型の簡略化と関連資料</summary><div id="viewerLearningDifference"></div><div id="viewerLearningRelated"></div>';viewer.appendChild(context);
  const difference={
    shinden:"模型は貴族邸宅の空間構成を学ぶ再現です。写真の京都御所・紫宸殿は宮殿の建築で、現在の建物は後世の再建です。用途・年代・規模を同一視せず、柱や屋根、縁の構造を比べてください。",
    kichou:"ゲームでは支柱と垂れ布が見分けやすい形に整理されています。写真の展示例では布の折り目・厚み・透け方を確かめられます。展示品の年代を平安期と断定していません。",
    byoubu:"ゲームの屏風は折り目と間仕切りの働きを見せる模型です。写真は17世紀初頭の六曲屏風の右端二面で、絵柄・寸法・材質はこの邸の模型と異なります。全六面の形状や平安期の絵柄を復元する資料としては扱いません。",
    ryuteki:"ゲームは横笛の長い管と指孔を識別しやすく示しています。写真下段のケースにある龍笛は19世紀の所蔵品で、管の一部はケースに隠れています。上段は別種の高麗笛なので、二本とも龍笛とは読みません。",
    koto:"模型では弦と柱の構造を簡単な形で示しています。写真は後世の装飾を持つ実物資料で、平安期の個体ではありません。材の質感、弦の細さ、細かな金具の違いを比べてください。",
    biwa:"ゲームの楽琵琶に対し、写真は平家琵琶です。異なる種類なので、胴の形・柱・撥の違いを比べる資料です。写真の意匠をそのまま平安宮廷の琵琶と見なすことはできません。",
    gissha:"写真は現代の時代祭の復元牛車です。模型では移動や当たり判定のために部材・車輪・牛の動きを簡略化しています。現代の祭礼写真は、平安期の車の細部をすべて証明する資料ではありません。",
    himegimi:"写真は現代の復元衣装の実演です。模型では重ねた衣の輪郭を示すため、織り・縫い目・布のしわを整理しています。写真は平安時代の人の姿を直接記録したものではありません。",
    nyobo:"写真は現代の復元衣装の実演です。女房それぞれの身分・場面による衣装の差まで、同じ写真一枚で示すことはできません。模型の袖・裾と実演の布の重なりを比べてください。"
  };
  function updateViewerContext(){
    const id=CODEX_VIEWER.item;context.hidden=!CODEX_VIEWER.active||CODEX_VIEWER.question;if(context.hidden)return;
    const data=CODEX_MEDIA.find(m=>m.items.includes(id));document.getElementById("viewerLearningDifference").textContent=difference[id]||`模型では形を見分けやすくするため、細かな表面・動き・材質を簡略化しています。${data?data.note:"この項目の実物写真はまだ同梱していません。"}`;
    document.getElementById("viewerLearningRelated").innerHTML=codexRelatedChipsHTML(id);
  }
  const baseViewerOpen=CODEX_VIEWER.open;
  CODEX_VIEWER.open=function(){const result=baseViewerOpen.apply(this,arguments);updateViewerContext();return result;};
  // openQuestion uses the viewer's private open; observe visibility after it has concealed the answer.
  const baseQuestion=CODEX_VIEWER.openQuestion;
  CODEX_VIEWER.openQuestion=function(){const result=baseQuestion.apply(this,arguments);updateViewerContext();return result;};
  document.getElementById("viewerLearningRelated").onclick=e=>{const b=e.target.closest("[data-rel]");if(b&&!b.disabled&&codexUnlocked.has(b.dataset.rel)){CODEX_VIEWER.close();openCodex("main");codexShowDetail(b.dataset.rel);}};
  refresh();
  return {startReview,startIdentification,dueIds,eligible,recordAnswer,refresh,dayKey,addDays,sanitize,storageKey:KEY,get records(){return sanitize(records);},get storageOK(){return storageOK;}};
})();
if(typeof window!=="undefined")window.LEARNING_EXTENSION=LEARNING_EXTENSION;
