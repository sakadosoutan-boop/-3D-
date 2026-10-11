/* Parent-owned core HTML patch. Run explicitly before build:app; leaves all generated app blocks alone. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),target=path.join(root,'寝殿造り3D探訪_統合版.html');
const snippet=fs.readFileSync(path.join(__dirname,'snippets/dispose-renai-sim-stage.js'),'utf8').trim();
new vm.Script(snippet);
const html=fs.readFileSync(target,'utf8'),start=html.indexOf('function disposeRenaiSimStage(){'),end=html.indexOf('function isDescendantOf(',start);
if(start<0||end<0||html.indexOf('function disposeRenaiSimStage(){',start+1)>=0)throw new Error('Expected exactly one core renai stage cleanup function followed by isDescendantOf');
fs.writeFileSync(target,html.slice(0,start)+snippet+'\n'+html.slice(end),'utf8');
console.log('Patched core disposeRenaiSimStage only; run build:app and verification next.');
