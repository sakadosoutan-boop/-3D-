function disposeRenaiSimStage(){
  const stage=window.RENAI_SIM_STAGE;if(!stage)return;
  const nodes=new Set(),geometries=new Set(),materials=new Set(),textures=new Set();
  const sharedGeometries=new Set(),sharedMaterials=new Set(),sharedTextures=new Set();
  const addGeometry=value=>{if(value?.isBufferGeometry)sharedGeometries.add(value);};
  const addMaterial=value=>{if(value?.isMaterial){sharedMaterials.add(value);for(const v of Object.values(value))if(v?.isTexture)sharedTextures.add(v);}};
  // Constructor caches may contain resources that currently have no visible/live scene reference.
  if(typeof HEIAN_GEO!=="undefined")Object.values(HEIAN_GEO).forEach(addGeometry);
  if(typeof HEIAN_FINGER_GEO!=="undefined")addGeometry(HEIAN_FINGER_GEO);
  if(typeof HEIAN_SHAKU_GEO!=="undefined")addGeometry(HEIAN_SHAKU_GEO);
  if(typeof HEIAN_SHAKU_MAT!=="undefined")addMaterial(HEIAN_SHAKU_MAT);
  if(typeof GEO_CACHE!=="undefined")for(const cache of Object.values(GEO_CACHE))if(cache?.values)for(const value of cache.values())addGeometry(value);
  if(typeof MAT!=="undefined")Object.values(MAT).forEach(addMaterial);
  if(typeof HEIAN_MATS!=="undefined")for(const material of HEIAN_MATS.values())addMaterial(material);
  for(const material of [HEIAN_SKIN,HEIAN_HAIR,HEIAN_HAIRLIT,HEIAN_FACE,HEIAN_EYE,HEIAN_CHEEK])addMaterial(material);
  if(typeof _labelTexCache!=="undefined")for(const value of _labelTexCache.values())if(value?.tex?.isTexture)sharedTextures.add(value.tex);
  stage.traverse(o=>{
    nodes.add(o);
    // A Three.js Sprite's geometry is global, so only mesh geometry can be individually owned.
    if(o.isMesh&&o.geometry)geometries.add(o.geometry);
    for(const material of [].concat(o.material||[])){
      if(!material)continue;materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
    }
  });
  // The live world can share meshes, geometry and material beyond the named constructor caches.
  scene.traverse(o=>{if(nodes.has(o))return;addGeometry(o.geometry);[].concat(o.material||[]).forEach(addMaterial);});
  for(let i=rayTargets.length-1;i>=0;i--)if(nodes.has(rayTargets[i]))rayTargets.splice(i,1);
  for(let i=floorZones.length-1;i>=0;i--)if(floorZones[i].renaiHub)floorZones.splice(i,1);
  // Detached rigs must not keep a full figure alive in the animation registries.
  if(typeof HEIAN_EXPRESSIONS!=="undefined")for(let i=HEIAN_EXPRESSIONS.length-1;i>=0;i--){
    const rig=HEIAN_EXPRESSIONS[i];if(!nodes.has(rig.g))continue;
    if(typeof HEIAN_EXPRESSION_REGISTRY!=="undefined")HEIAN_EXPRESSION_REGISTRY.delete(rig.g);
    HEIAN_EXPRESSIONS.splice(i,1);
  }
  if(stage.parent)stage.parent.remove(stage);window.RENAI_SIM_STAGE=null;
  for(const geometry of geometries)if(!sharedGeometries.has(geometry))geometry.dispose();
  for(const texture of textures)if(!sharedTextures.has(texture))texture.dispose();
  for(const material of materials)if(!sharedMaterials.has(material))material.dispose();
}
