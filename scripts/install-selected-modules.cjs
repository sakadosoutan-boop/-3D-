/* Idempotent registration of selected update modules; sources remain authoritative. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),file=path.join(root,'寝殿造り3D探訪_統合版.html'),mp=path.join(__dirname,'app-manifest.json');
let html=fs.readFileSync(file,'utf8'),manifest=JSON.parse(fs.readFileSync(mp,'utf8'));
function install(name,src,anchor){
 if(!fs.existsSync(path.join(root,src)))return;
 if(manifest.some(b=>b.name===name))return;
 const tag=name.replace(/-/g,'_').toUpperCase(),begin=`/* APP_${tag}_EMBED_BEGIN (${src} から自動生成。ここを直接編集しない) */`,end=`/* APP_${tag}_EMBED_END */`;
 assert.equal(html.split(anchor).length,2,anchor);
 html=html.replace(anchor,begin+'\n'+fs.readFileSync(path.join(root,src),'utf8')+'\n'+end+'\n'+anchor);
 manifest.push({name,src,kind:'markers-exist',begin,end});
}
for(const name of ['selected-ux','learning-extension','story-followthrough','combat-upgrade','selected-world','selected-visuals','selected-performance'])install(name+'-css','src/app/'+name+'.css','</style>');
install('story-followthrough','src/app/story-followthrough.js','/* ================== 波M: ストーリーモード同梱ここから ================== */');
const endAnchor='/* ============================================================\n   起動ローディングを閉じる';
// Preserve CRLF on old checkouts when locating the final initialization section.
const actualAnchor=html.includes(endAnchor)?endAnchor:endAnchor.replace(/\n/g,'\r\n');
for(const name of ['waka-notes','learning-extension','selected-ux','selected-world','selected-visuals','selected-performance'])install(name,'src/app/'+name+'.js',actualAnchor);
const updateAnchor='    if(VISUAL_EXPERIENCE)VISUAL_EXPERIENCE.update(t);';
if(!html.includes('SELECTED_PERFORMANCE.update(t)')){
 assert.equal(html.split(updateAnchor).length,2);
 html=html.replace(updateAnchor,updateAnchor+'\n    if(typeof SELECTED_WORLD!=="undefined"&&SELECTED_WORLD)SELECTED_WORLD.update(dt,t);\n    if(typeof SELECTED_VISUALS!=="undefined"&&SELECTED_VISUALS)SELECTED_VISUALS.update(dt,t);\n    if(typeof SELECTED_PERFORMANCE!=="undefined"&&SELECTED_PERFORMANCE)SELECTED_PERFORMANCE.update(t);');
}
// Return links outside generated app/story blocks use a common lifecycle cleanup.
const protectedBlocks=manifest.map(b=>[html.indexOf(b.begin),html.indexOf(b.end)+b.end.length]);
const storyStart=html.indexOf('/* ================== 波M: ストーリーモード同梱ここから'),storyEnd=html.indexOf('/* ================== 波M: ストーリーモード同梱ここまで');
protectedBlocks.push([storyStart,storyEnd]);
html=html.replace(/location\.reload\(\)/g,(s,offset)=>protectedBlocks.some(([a,b])=>offset>=a&&offset<=b)?s:'returnToTitle()');
const rstart=html.indexOf('function renaiSimEnding(){'),rend=html.indexOf('\nfunction ',rstart+1);
if(rstart>=0){let body=html.slice(rstart,rend);if(!body.includes('mountRenaiEnding')){body=body.replace('showResultPanel();','showResultPanel();\n  if(window.StoryFollowthrough)window.StoryFollowthrough.mountRenaiEnding({targetId:tgtId,targetName:tgtName,rank,affection:R.affection,stats:R.stats});');html=html.slice(0,rstart)+body+html.slice(rend);}}
fs.writeFileSync(file,html);fs.writeFileSync(mp,JSON.stringify(manifest,null,2)+'\n');
console.log('selected modules registered; run build:app and build:story');
