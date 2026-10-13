const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};
    localStorage.setItem('shinden3d-onboard-v1','1');
  });
  try{
    await page.goto(pathToFileURL(path.join(root,'寝殿造り3D探訪_統合版.html')).href+'?adaptive=0&eco=off',{waitUntil:'load'});
    await page.waitForFunction(()=>typeof waterBirds!=='undefined'&&typeof GISSHA_YARD!=='undefined'&&typeof creatures!=='undefined');
    if(!await page.evaluate(()=>typeof CREATURE_REFINEMENT!=='undefined'))
      await page.addScriptTag({path:path.join(root,'src/app/creature-refinement.js')});
    const result=await page.evaluate(()=>{
      const rayCount=rayTargets.length;
      const hair=HEIAN_GEO.templeLock,normal=hair.attributes.normal;
      const outwardHair=Array.from({length:4},(_,i)=>normal.getX(i*8)>0).every(Boolean);
      const first=CREATURE_REFINEMENT.applyWorld(),second=CREATURE_REFINEMENT.applyWorld();
      const birds=waterBirds.filter(b=>b.kind==='duck'||b.kind==='crane');
      const birdParts=birds.every(b=>b.g.userData.creatureRefined&&
        b.g.children.some(c=>c.name==='duck-beak-and-flight-feathers'||c.name==='crane-wing-tips-and-bill'));
      const drive=GISSHA_YARD.cart?.userData?.drive;
      const oxParts=!!drive?.ox?.userData.creatureRefined&&
        (drive.legs||[]).every(l=>l.pivot.children.some(c=>c.name==='ox-cloven-hoof'));
      const yokaiParts=creatures.yokai.filter(y=>['kappa','chochin','yukionna','hitodama','kitsunebi'].includes(y.type||y.g?.userData?.type))
        .every(y=>y.g.userData.creatureRefined&&y.g.children.some(c=>c.name==='yokai-facial-detail'));
      const kappa=creatures.yokai.filter(y=>(y.type||y.g?.userData?.type)==='kappa');
      const kappaConnected=kappa.length>0&&kappa.every(({g})=>{
        const arms=g.children.filter(o=>o.name==='kappa-connected-arm'),hands=g.children.filter(o=>o.name==='kappa-webbed-hand');
        const body=g.children.find(o=>o.isMesh&&Math.abs(o.geometry?.parameters?.radius-.32)<.001);
        if(arms.length!==2||hands.length!==2||!body)return false;
        g.updateWorldMatrix(true,true);
        const bodyBounds=new THREE.Box3().setFromObject(body);
        return arms.every(arm=>{
          const side=Math.sign(arm.position.x),hand=hands.find(h=>Math.sign(h.position.x)===side);
          const shoulder=arm.localToWorld(new THREE.Vector3(0,.22,0));
          const wrist=arm.localToWorld(new THREE.Vector3(0,-.22,0));
          return hand&&bodyBounds.distanceToPoint(shoulder)<.045&&
            wrist.distanceTo(hand.getWorldPosition(new THREE.Vector3()))<.055;
        });
      });
      const chochin=creatures.yokai.filter(y=>(y.type||y.g?.userData?.type)==='chochin');
      const chochinConnected=chochin.length>0&&chochin.every(({g})=>{
        const tongue=g.getObjectByName('chochin-connected-tongue');if(!tongue)return false;
        g.updateWorldMatrix(true,true);
        const tip=g.worldToLocal(tongue.localToWorld(new THREE.Vector3(0,.25,0)));
        return tip.y>-.38&&tip.y<-.30&&tip.z>.20&&tip.z<.25&&
          tongue.material.color.getHex()===0x9b302d;
      });
      const leg=drive?.legs?.[0]?.pivot,hoof=leg?.getObjectByName('ox-cloven-hoof');
      let followsPivot=false;
      const hoofMesh=hoof?.children.find(c=>c.isMesh&&c.geometry?.attributes?.position?.count);
      if(leg&&hoofMesh){
        const rest=leg.rotation.x;
        const vertex=new THREE.Vector3().fromBufferAttribute(hoofMesh.geometry.attributes.position,0);
        const worldVertex=()=>vertex.clone().applyMatrix4(hoofMesh.matrixWorld);
        leg.updateWorldMatrix(true,true);
        const before=worldVertex();
        try{
          leg.rotation.x=rest+.2;
          leg.updateWorldMatrix(true,true);
          const moved=worldVertex();
          followsPivot=hoof.parent===leg&&moved.distanceTo(before)>.005;
        }finally{
          leg.rotation.x=rest;
          leg.updateWorldMatrix(true,true);
        }
        followsPivot=followsPivot&&worldVertex().distanceTo(before)<1e-5;
      }
      const duck=birds.find(b=>b.kind==='duck'),fine=duck?.g.getObjectByName('duck-beak-and-flight-feathers');
      const originalCamera=camera.position.clone(),at=duck?.g.getWorldPosition(new THREE.Vector3());
      let lod=false;
      if(fine&&at){camera.position.copy(at).add(new THREE.Vector3(30,0,0));CREATURE_REFINEMENT.update(camera);const far=!fine.visible;
        camera.position.copy(at).add(new THREE.Vector3(2,0,0));CREATURE_REFINEMENT.update(camera);lod=far&&fine.visible;
        camera.position.copy(originalCamera);CREATURE_REFINEMENT.update(camera);}
      return {first,second,birdParts,oxParts,yokaiParts,kappaConnected,chochinConnected,followsPivot,lod,outwardHair,rayStable:rayCount===rayTargets.length,
        actorCounts:{ducks:birds.filter(b=>b.kind==='duck').length,cranes:birds.filter(b=>b.kind==='crane').length,
          yokai:creatures.yokai.length,legs:drive?.legs?.length||0}};
    });
    assert(result.actorCounts.ducks>0&&result.actorCounts.cranes>0&&result.actorCounts.yokai>0&&result.actorCounts.legs===4,
      'expected world actors were not built: '+JSON.stringify(result));
    assert(Object.values(result.second).every(n=>n===0),'refinement must be idempotent');
    for(const key of ['birdParts','oxParts','yokaiParts','kappaConnected','chochinConnected','followsPivot','lod','outwardHair','rayStable'])
      assert(result[key],key+' failed: '+JSON.stringify(result));
    assert.equal(errors.length,0,'browser errors: '+errors.join('; '));
    console.log('creature refinement: '+JSON.stringify(result.first)+'; pivots and ray targets stable');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
