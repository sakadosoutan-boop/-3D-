/* Letters attest to medieval written administration; the exercises below are fictional. */
var KAMAKURA_CUSTOMS=(()=>{
  'use strict';
  const fields=[['to','届け先'],['goods','品目'],['count','数量']];
  const models=[
    {to:'竈屋',goods:'米',count:'三俵'},
    {to:'厩',goods:'馬の飼葉',count:'二束'},
    {to:'主殿',goods:'料紙',count:'十枚'},
    {to:'荷受けの庇',goods:'曲物',count:'四つ'},
    {to:'配膳仕事場',goods:'漆椀',count:'五口'},
    {to:'書付の間',goods:'筆',count:'二本'}
  ];
  const S={ready:false,active:false,practice:true,index:0,score:0,answers:[],rounds:[],answered:false};
  let world=null,focus=null,panel=null,prompt=null;
  const qs=sel=>panel.querySelector(sel);
  function eligible(){return S.ready&&APP.map==='kamakura'&&APP.mode==='walk'&&!(typeof KENKO_HERMITAGE!=='undefined'&&KENKO_HERMITAGE.active)&&!(typeof KAMAKURA_GAMES!=='undefined'&&KAMAKURA_GAMES.state.active)&&!APP.kamaKyudo?.active;}
  function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function deal(){
    const cards=models.map(m=>({...m}));
    for(let i=cards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}
    // Exactly three matching letters and three discrepancies, shuffled independently.
    const mismatches=[null,'to',null,'goods',null,'count'];
    for(let i=mismatches.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[mismatches[i],mismatches[j]]=[mismatches[j],mismatches[i]];}
    return cards.map((order,i)=>{
      const receipt={...order},field=mismatches[i];
      if(field)receipt[field]=models.filter(m=>m[field]!==order[field])[Math.floor(Math.random()*5)][field];
      return {order,receipt,field};
    });
  }
  function open(practice=true){
    if(!eligible()||S.active)return false;
    world.K.closeModal?.();focus=document.activeElement;resetInputState();
    S.active=true;S.practice=practice!==false;S.index=0;S.score=0;S.answers=[];S.rounds=deal();S.answered=false;
    document.body.classList.add('kamakura-customs-mode');panel.hidden=false;prompt.hidden=true;
    render();return true;
  }
  function close(){if(!S.active)return;S.active=false;panel.hidden=true;document.body.classList.remove('kamakura-customs-mode');resetInputState();if(focus?.isConnected)focus.focus({preventScroll:true});}
  function textCard(title,data,other,guide){
    return '<article class="kc-letter"><h3>'+title+'</h3><dl>'+fields.map(([key,label])=>'<div'+(guide&&data[key]!==other[key]?' class="kc-different"':'')+'><dt>'+label+'</dt><dd>'+escapeHTML(data[key])+'</dd></div>').join('')+'</dl><p class="kc-letter-foot">この書付は体験用の創作文です</p></article>';
  }
  function render(){
    const finished=S.index>=S.rounds.length;
    qs('.kc-progress').textContent=finished?'照合を終えました':(S.practice?'手ほどき':'稽古')+'　'+(S.index+1)+' / '+S.rounds.length;
    if(finished){
      const correct=S.answers.filter(a=>a.correct).length;
      qs('.kc-content').innerHTML='<div class="kc-result"><h3>'+correct+' / '+S.rounds.length+' 件を正しく照合</h3><p>書く人、運ぶ人、受け取る人が、同じ内容を確かめる仕事です。速さより、違う箇所を見つけることを大切にしましょう。</p><ol>'+S.answers.map(a=>'<li>'+escapeHTML(a.to)+'：'+(a.correct?'確認できました':'もう一度読み比べましょう')+' — '+escapeHTML(a.reason)+'</li>').join('')+'</ol></div>';
      qs('.kc-feedback').textContent='';qs('.kc-actions').innerHTML='<button data-action="retry">'+(S.practice?'今度は手がかりなしで':'もう一度稽古する')+'</button><button data-action="close">屋敷に戻る</button>';
      if(!S.practice){try{const best=Number(localStorage.getItem('kamakura-letter-best')||0);if(correct>best)localStorage.setItem('kamakura-letter-best',String(correct));}catch(_){}}
    }else{
      const r=S.rounds[S.index];S.answered=false;
      qs('.kc-content').innerHTML=textCard('書付役の指示',r.order,r.receipt,S.practice)+textCard('使者の持参控え',r.receipt,r.order,S.practice);
      qs('.kc-feedback').textContent=S.practice?(r.field?'色のついた行が違います。内容を確かめてから返しましょう。':'三つの欄が一致しています。受け取りを選びましょう。'):'届け先・品目・数量を、一つずつ読み比べてください。';
      qs('.kc-actions').innerHTML='<button data-action="accept">受け取る</button><button data-action="return">確かめるため差し戻す</button>';
    }
    qs('.kc-actions button')?.focus();
  }
  function answer(accept){
    if(!S.active||S.answered||S.index>=S.rounds.length)return false;
    const r=S.rounds[S.index],correct=accept===!r.field;
    const label=fields.find(f=>f[0]===r.field)?.[1];
    const reason=r.field?label+'が「'+r.order[r.field]+'」と「'+r.receipt[r.field]+'」で違います。':'届け先・品目・数量がすべて一致しています。';
    S.answered=true;S.score+=correct?1:0;S.answers.push({correct,to:r.order.to,reason});
    if(r.field)panel.querySelectorAll('.kc-letter dl>div:nth-child('+(fields.findIndex(f=>f[0]===r.field)+1)+')').forEach(o=>o.classList.add('kc-different'));
    qs('.kc-feedback').textContent=(correct?'よく確かめました。':'読み違いがありました。')+reason;
    qs('.kc-actions').innerHTML='<button data-action="next">'+(S.index===S.rounds.length-1?'照合の振り返り':'次の書付')+'</button>';
    qs('.kc-actions button').focus();return correct;
  }
  function update(){
    if(!S.ready)return;
    if(S.active&&!eligible()){close();return;}
    const p=world.anchors.documents?.position;
    prompt.hidden=!eligible()||S.active||!p||Math.hypot(player.pos.x-p.x,player.pos.z-p.z)>4.5||gameplayInputBlocked();
  }
  function init(ref){
    if(S.ready||!ref?.K)return false;world=ref;
    panel=document.createElement('section');panel.id='kamaLetters';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','kcTitle');
    panel.innerHTML='<div class="kc-frame"><header><div><small>武家屋敷の仕事</small><h2 id="kcTitle">使者の書付照合</h2></div><button data-action="close" aria-label="書付照合を閉じる">閉じる</button></header><p class="kc-intro">書付役の指示と、使者の持参控えを読み比べます。中世の書状や出土した筆記具を手がかりにした学習ゲームです。実際の文書手続や書式を再現したものではありません。</p><p class="kc-progress"></p><div class="kc-content"></div><p class="kc-feedback" role="status" aria-live="polite"></p><div class="kc-actions"></div><details><summary>史料から分かること</summary><p>鎌倉からは硯や水滴が出土し、武家の書状も伝わります。北条義時の書状は寺領の訴えへの処理を伝えるものです。この遊びの届け先・品目・数量や照合手続は創作です。</p><p><a href="https://www.city.kamakura.kanagawa.jp/rekibun/documents/list-2018-2.pdf" target="_blank" rel="noopener noreferrer">鎌倉歴史文化交流館：出土品の展示資料</a></p><p><a href="https://www.bunka.pref.mie.lg.jp/rekishi/kenshi/asp/shijyo/detail551.html" target="_blank" rel="noopener noreferrer">三重県：北条義時の書状</a></p></details></div>';
    prompt=document.createElement('button');prompt.id='kamaLettersPrompt';prompt.textContent='書付役の仕事を体験';prompt.hidden=true;
    document.body.append(panel,prompt);prompt.onclick=()=>open(true);
    panel.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='close')close();else if(action==='accept')answer(true);else if(action==='return')answer(false);else if(action==='next'&&S.answered){S.index++;render();}else if(action==='retry'){const practice=false;close();open(practice);}});
    panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}else if(e.key==='Tab'){const buttons=[...panel.querySelectorAll('button,a,summary')].filter(o=>o.getClientRects().length);let i=buttons.indexOf(document.activeElement);i=(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length;e.preventDefault();buttons[i]?.focus();}},true);
    const beforeBlock=pauseBlockingOverlayOpen;pauseBlockingOverlayOpen=function(){return S.active||beforeBlock();};
    const beforeEnter=enterMode;enterMode=function(...args){close();return beforeEnter.apply(this,args);};
    S.ready=true;return true;
  }
  return {init,open,close,update,answer,state:S};
})();
