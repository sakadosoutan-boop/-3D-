/* Idempotent module registration; source bodies remain owned by build-app. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),file=path.join(root,'寝殿造り3D探訪_統合版.html'),mp=path.join(__dirname,'app-manifest.json');
let html=fs.readFileSync(file,'utf8'),manifest=JSON.parse(fs.readFileSync(mp,'utf8'));
const initAnchor='/* ============================================================\n   起動ローディングを閉じる';
function unique(anchor){const text=html.includes(anchor)?anchor:anchor.replace(/\n/g,'\r\n');assert.equal(html.split(text).length,2,'unique anchor: '+anchor);return text;}
for(const [name,ext]of [['kamakura-customs-css','css'],['kenko-hermitage-css','css'],['kamakura-games','js'],['kamakura-customs','js'],['kenko-hermitage','js']]){
  const old=manifest.find(b=>b.name===name);
  if(old){assert.equal(html.split(old.begin).length,2,'begin '+name);assert.equal(html.split(old.end).length,2,'end '+name);continue;}
  const src='src/app/'+name.replace(/-css$/,'')+'.'+ext,tag=name.replace(/-/g,'_').toUpperCase();
  const begin='/* APP_'+tag+'_EMBED_BEGIN ('+src+' から自動生成。ここを直接編集しない) */',end='/* APP_'+tag+'_EMBED_END */';
  const content=begin+'\n'+fs.readFileSync(path.join(root,src),'utf8')+'\n'+end+'\n';
  const anchor=unique(ext==='css'?'</head>':initAnchor);
  html=html.replace(anchor,(ext==='css'?'<style>\n'+content+'</style>\n':content)+anchor);
  manifest.push({name,src,kind:'markers-exist',begin,end});
}
const early='  if(typeof KENKO_HERMITAGE!=="undefined"&&KENKO_HERMITAGE.active){KENKO_HERMITAGE.frame(dt,t);return;}';
if(!html.includes(early)){const anchor=unique('  const t=clock.elapsedTime;');html=html.replace(anchor,anchor+'\n'+early);}
const hooks='    if(typeof KAMAKURA_GAMES!=="undefined")KAMAKURA_GAMES.update(dt,t);\n    if(typeof KAMAKURA_CUSTOMS!=="undefined")KAMAKURA_CUSTOMS.update();';
if(!html.includes('KAMAKURA_CUSTOMS.update();')){const anchor=unique('    if(typeof SELECTED_PERFORMANCE!=="undefined"&&SELECTED_PERFORMANCE)SELECTED_PERFORMANCE.update(t);');html=html.replace(anchor,anchor+'\n'+hooks);}
const init='KAMAKURA_GAMES.init(window.KAMAKURA_WORLD);\nKAMAKURA_CUSTOMS.init(window.KAMAKURA_WORLD);\n';
if(!html.includes('KAMAKURA_GAMES.init(window.KAMAKURA_WORLD);')){const anchor=unique(initAnchor);html=html.replace(anchor,init+anchor);}
// Heian-only ambient figures must not reappear over the Kamakura simulation.
for(const [before,after]of [
  ['const nightFade=Math.max(0,Math.min(1,(cur.moon-0.05)/0.3));','const nightFade=APP.map==="kamakura"?0:Math.max(0,Math.min(1,(cur.moon-0.05)/0.3));'],
  ['const day=(APP.time==="day");','const day=APP.map!=="kamakura"&&(APP.time==="day");'],
  ['const spiritBlocked=!!APP.gisshaCarry?.active||','const spiritBlocked=APP.map==="kamakura"||!!APP.gisshaCarry?.active||']
]){
  if(html.includes(after)){assert.equal(html.split(after).length,2,'one era guard');html=html.replace(after+' ',after);continue;}
  const anchor=unique(before);html=html.replace(anchor,after);
}
fs.writeFileSync(file,html);fs.writeFileSync(mp,JSON.stringify(manifest,null,2)+'\n');
console.log('Kamakura experiences and hermitage hooks registered');
