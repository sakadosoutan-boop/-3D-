/* CPU checks execute the visit's actual collision/floor functions with source-owned hut dimensions. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),src=read('src/app/kenko-hermitage.js'),an=read('src/app/tsurezure-an.js'),replay=read('src/app/saigen-tsurezure.js');
const constants=an.match(/const FL=\.50,[^;]+;/)[0];
const terrain=replay.slice(replay.indexOf('  const AN_STREAM='),replay.indexOf('  const STREAM_Y='));
const physics=src.slice(src.indexOf('  function heightAt('),src.indexOf('  function frame('));
const context={Math};vm.createContext(context);
vm.runInContext(constants+'\nconst lerp=(a,b,t)=>a+(b-a)*t,ease=t=>t*t*(3-2*t);\n'+terrain+
  '\nconst visit={ready:true,heightAt:hAn,streamZ:anStreamZ,assets:{hut:{position:{y:AN_PAD_Y},userData:{dims:{floorY:FL,postsX:[X0,X1],postsZ:[Z0,Z1],verandaFront:VZ,verandaEast:VX},anchors:{stepFront:{position:{x:.55,y:.22,z:2.62}}}}},trees:[]}};\n'+physics,context);
const run=code=>vm.runInContext(code,context),checks=[];
function check(name,fn){fn();checks.push(name);}
check('floor matches actual hut dimension metadata',()=>{assert.equal(run('heightAt(0,1)'),.55);assert.equal(run('heightAt(1.9,1)'),.55);assert.equal(run('heightAt(.55,2.62)'),.27);assert.equal(run('heightAt(4,4)'),run('hAn(4,4)'));});
check('front stepping stone permits yard to veranda passage',()=>{const p=run('resolveMove(.55,3.5,.55,1.6)');assert(Math.abs(p.x-.55)<1e-6&&Math.abs(p.z-1.6)<1e-6);});
check('floor cannot be climbed through a veranda edge',()=>{const p=run('resolveMove(2.7,1,1.9,1)');assert(p.x>2.26);});
check('swept rear and side walls block long moves',()=>{assert(run('resolveMove(.55,-.9,.55,-2.2).z')> -1.35);assert(run('resolveMove(-1.1,.8,-2.3,.8).x')> -1.5);assert(run('resolveMove(1.1,.8,2.3,.8).x')<1.5);});
check('front opening remains passable beside posts',()=>{assert(run('resolveMove(.55,1.8,.55,.8).z')<1.0);assert(run('blocked(-1.5,1.35)'));});
check('furniture, stream and garden boundaries remain solid',()=>{assert(run('blocked(-.25,.22)'));assert(run('blocked(0,anStreamZ(0))'));assert(run('resolveMove(19.9,4,25,4).x')<=20);});
check('repeated collision resolution remains finite',()=>{for(let i=0;i<100;i++){const p=run(`resolveMove(.55,5,${Math.sin(i)*22},${Math.cos(i)*20})`);assert(Number.isFinite(p.x)&&Number.isFinite(p.z));}});
console.log(JSON.stringify({checks:checks.length,passed:checks},null,2));
