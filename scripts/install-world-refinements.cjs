/* Register authoritative refinement sources and the two render hooks once. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),file=path.join(root,'寝殿造り3D探訪_統合版.html'),mp=path.join(__dirname,'app-manifest.json');
let html=fs.readFileSync(file,'utf8'),manifest=JSON.parse(fs.readFileSync(mp,'utf8'));
const anchor='/* ============================================================\n   起動ローディングを閉じる',actual=html.includes(anchor)?anchor:anchor.replace(/\n/g,'\r\n');
for(const name of ['creature-refinement','night-lighting']){
  const existing=manifest.find(b=>b.name===name);
  if(existing){assert.equal(html.split(existing.begin).length,2,'registered begin marker '+name);assert.equal(html.split(existing.end).length,2,'registered end marker '+name);continue;}
  const src=`src/app/${name}.js`,tag=name.replace(/-/g,'_').toUpperCase(),begin=`/* APP_${tag}_EMBED_BEGIN (${src} から自動生成。ここを直接編集しない) */`,end=`/* APP_${tag}_EMBED_END */`;
  assert.equal(html.split(actual).length,2,'unique final initialization anchor');
  const call=name==='creature-refinement'?'\nCREATURE_REFINEMENT.applyWorld();':'';
  html=html.replace(actual,begin+'\n'+fs.readFileSync(path.join(root,src),'utf8')+'\n'+end+call+'\n'+actual);
  manifest.push({name,src,kind:'markers-exist',begin,end});
}
const hook='    if(typeof SELECTED_PERFORMANCE!=="undefined"&&SELECTED_PERFORMANCE)SELECTED_PERFORMANCE.update(t);';
const nightHook='    if(typeof NIGHT_LIGHTING!=="undefined"&&NIGHT_LIGHTING)NIGHT_LIGHTING.update(camera);';
if(!html.includes(nightHook)){assert.equal(html.split(hook).length,2);html=html.replace(hook,hook+'\n'+nightHook);}
const creatureHook='    if(typeof CREATURE_REFINEMENT!=="undefined"&&CREATURE_REFINEMENT)CREATURE_REFINEMENT.update(camera);';
if(!html.includes(creatureHook)){assert.equal(html.split(hook).length,2);html=html.replace(hook,hook+'\n'+creatureHook);}
fs.writeFileSync(file,html);fs.writeFileSync(mp,JSON.stringify(manifest,null,2)+'\n');
console.log('world refinement modules and render hook registered');
