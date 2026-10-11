/* One-time byte-preserving extraction. Runtime order is unchanged. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),file=path.join(root,'寝殿造り3D探訪_統合版.html');
let html=fs.readFileSync(file,'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'app-manifest.json'),'utf8'));
const specs=[
 ['combat','   物の怪退治モード','function startKaimami(){'],
 ['utakai','   歌合(うたあわせ)モード','/* ===================== 再現モード'],
 ['kaiawase','   波7: 貝合わせ(かいあわせ)','/* APP_KEMARI_EMBED_BEGIN']
];
for(const [name,anchor,endAnchor] of specs){
 const tag=name.toUpperCase(),src=`src/app/${name}.js`;
 const begin=`/* APP_${tag}_EMBED_BEGIN (${src} から自動生成。ここを直接編集しない) */`,end=`/* APP_${tag}_EMBED_END */`;
 if(html.includes(begin))continue;
 const at=html.indexOf(anchor);assert(at>=0,anchor);
 const start=html.lastIndexOf('/*',at),stop=html.indexOf(endAnchor,at);assert(start>=0&&stop>at,name);
 const body=html.slice(start,stop),before=html;
 html=html.slice(0,start)+begin+'\n'+body+end+'\n'+html.slice(stop);
 assert.equal(html.replace(begin+'\n','').replace(end+'\n',''),before,'extraction changes runtime bytes');
 fs.writeFileSync(path.join(root,src),body);
 manifest.push({name,src,kind:'markers-exist',begin,end});
 console.log(name+': '+Buffer.byteLength(body)+' bytes extracted without runtime changes');
}
fs.writeFileSync(file,html);fs.writeFileSync(path.join(__dirname,'app-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
