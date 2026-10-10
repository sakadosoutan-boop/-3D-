const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts/review');

(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.__SHINDEN_BENCH_PAUSE=true;window.SHINDEN_ONLINE_CONFIG={enabled:false};
    localStorage.setItem('shinden3d-onboard-v1','1');
  });
  try{
    await page.goto(pathToFileURL(path.join(root,'寝殿造り3D探訪_統合版.html')).href+'?adaptive=0&eco=off',{waitUntil:'load'});
    await page.waitForFunction(()=>typeof HEIAN_EXPRESSIONS!=='undefined'&&typeof VISUAL_EXPERIENCE!=='undefined');
    if(!await page.evaluate(()=>typeof SELECTED_VISUALS!=='undefined')){
      await page.addStyleTag({path:path.join(root,'src/app/selected-visuals.css')});
      await page.addScriptTag({path:path.join(root,'src/app/selected-visuals.js')});
    }
    const checks=await page.evaluate(()=>{
      enterMode('walk');hideModeBrief(true);APP_FPSCAP=0;AUTO_TIME._paused=true;
      const result={},api=SELECTED_VISUALS;
      const rig=HEIAN_EXPRESSIONS.find(r=>r.prop==='scroll'&&r.grip&&r.g.parent),fan=HEIAN_EXPRESSIONS.find(r=>r.prop==='fan'&&r.grip),shaku=HEIAN_EXPRESSIONS.find(r=>r.prop==='shaku'&&r.grip);
      result.rigged=!!rig&&!!fan&&!!shaku&&[rig,fan,shaku].every(r=>r.held?.parent===r.grip&&r.grip.children.length>=2);
      if(!rig)return result;
      rig.g.getWorldPosition(camera.position);camera.position.z+=2;rig.detail.visible=true;
      api.update(.016,1);const scrollHead=rig.head.rotation.x,scrollHand=rig.grip.position.y-rig.gripBase.y;
      api.update(.016,1);result.headStable=Math.abs(rig.head.rotation.x-scrollHead)<.00001;
      fan.g.getWorldPosition(camera.position);camera.position.z+=2;api.update(.016,2);
      result.posture=scrollHead>.04&&scrollHand<0&&fan.grip.position.y-fan.gripBase.y>.015;
      const target=HEIAN_EXPRESSIONS.find(r=>{let node=r.g;while(node&&!(interactables.nyobo?.roots||[]).includes(node))node=node.parent;return !!node;});
      if(target){
        target.g.getWorldPosition(camera.position);camera.position.x+=1.4;camera.position.z+=1.2;
        player.pos.copy(camera.position);player.pos.y=groundH(player.pos.x,player.pos.z)+1.62;
        showNPCDialogue('nyobo');const start=target.g.rotation.y;
        for(let i=0;i<28;i++)api.update(.05,i*.05);
        const facing=target.g.rotation.y;
        document.getElementById('dialogueBubble').classList.remove('show');
        for(let i=0;i<28;i++)api.update(.05,2+i*.05);
        result.conversation=Math.abs(facing-start)>.08&&Math.abs(target.g.rotation.y-start)<.025&&!target.turnState;
      }
      rig.g.rotation.y=.31;api.update(.05,3.5);result.patrol=Math.abs(rig.g.rotation.y-.31)<.00001;
      for(let i=0;i<20;i++)api.update(.05,4+i*.05);
      result.water=api.stats.waterContact>=3&&api.rings.some(r=>r.visible&&r.material.opacity>0)&&
        waterBirds.filter(b=>b.kind==='duck').every(b=>Math.abs(b.g.position.y-.06)<.012)&&
        waterBirds.filter(b=>b.kind==='koi').every(b=>Math.abs(b.g.position.y+b.g.userData.ripple.position.y-.066)<.01);
      applySeason('autumn');player.pos.set(0,groundH(0,22)+1.62,22);rainFall.visible=true;
      const rainFigure=makeHeianFigure({role:'nyobo',palette:[0x415c35,0x7d3b36,0xb09a69,0xe9dfc8],prop:'scroll',pose:'standing'});
      rainFigure.position.set(0,groundH(0,22),22);scene.add(rainFigure);camera.position.set(0,2.5,24);
      const rainRig=HEIAN_EXPRESSION_REGISTRY.get(rainFigure);
      for(let i=0;i<36;i++)api.update(.05,7+i*.05);
      const outside=api.stats.wetness,glass=parseFloat(api.glass.style.opacity);
      result.wetCloth=rainRig.wetness>.8&&rainRig.wetCloth?.length>0&&rainRig.wetCloth[0].material.color.getHex()!==rainRig.wetCloth[0].base.getHex();
      player.pos.set(SH.cx,groundH(SH.cx,SH.cz)+1.62,SH.cz);
      for(let i=0;i<36;i++)api.update(.05,9+i*.05);
      result.rain=outside>.8&&glass>.5&&api.stats.sheltered&&api.stats.wetness<outside;
      rainFall.visible=false;applySeason('winter');VISUAL_EXPERIENCE.setProgress(.5);
      player.pos.set(0,groundH(0,22)+1.62,22);api.update(.05,11);
      player.pos.x+=.62;api.update(.05,11.05);const fresh=api.stats.footprints;
      for(let i=0;i<140;i++)api.update(.05,11.1+i*.05);
      result.snow=fresh===1&&api.stats.footprints===0;
      result.reuse=api.prints.length===16&&api.rings.length===3;
      LOW_POWER.set(true,{persist:false,silent:true});api.update(.05,18.1);
      result.eco=api.rings.every(r=>!r.visible)&&api.prints.every(p=>!p.visible)&&parseFloat(api.glass.style.opacity)===0;
      LOW_POWER.set(false,{persist:false,silent:true});
      applySeason('spring');rainFall.visible=false;
      return result;
    });
    for(const [name,ok] of Object.entries(checks))assert(ok,`${name} failed: ${JSON.stringify(checks)}`);
    assert.equal(errors.length,0,'browser errors: '+errors.join('; '));
    await page.evaluate(()=>{
      const trio=[['himegimi','fan',[10.65,0,25],[0x8f2438,0xc04a42,0xe28335,0x77863f]],
        ['nyobo','scroll',[12,0,25],[0x415c35,0x7d3b36,0xb09a69,0xe9dfc8]],
        ['kikoshi','shaku',[13.35,0,25],[0x6f2f3f,0x263f5c,0xd0ad58]]];
      trio.forEach(([role,prop,p,palette])=>{const figure=makeHeianFigure({role,palette,prop,pose:'standing'});figure.position.set(p[0],groundH(p[0],p[2]),p[2]);scene.add(figure);});
      camera.position.set(12,1.8,28.7);camera.lookAt(12,1.05,25);
    });
    const near=await page.evaluate(()=>{renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png').split(',')[1];});
    fs.writeFileSync(path.join(output,'selected-visuals-near.png'),Buffer.from(near,'base64'));
    const mid=await page.evaluate(()=>{camera.position.set(12,2.6,33);camera.lookAt(12,1.0,25);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png').split(',')[1];});
    fs.writeFileSync(path.join(output,'selected-visuals-mid.png'),Buffer.from(mid,'base64'));
    console.log('selected visuals: '+Object.keys(checks).join(', ')+'; near/mid screenshots saved');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
