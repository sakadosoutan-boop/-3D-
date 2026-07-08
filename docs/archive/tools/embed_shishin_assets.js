const fs=require("fs"),path=require("path");
const htmlFile=path.join(__dirname,"寝殿造り3D探訪_統合版.html");
const assets={
  SEIRYU:"seiryu_embed.webp",BYAKKO:"byakko_embed.webp",GENBU:"genbu_embed.webp",SUZAKU:"suzaku_embed.webp"
};
(async()=>{
  let html=fs.readFileSync(htmlFile,"utf8");
  for(const [key,file] of Object.entries(assets)){
    const buf=fs.readFileSync(path.join(__dirname,file));
    html=html.replace(`__${key}_DATA__`,`data:image/webp;base64,${buf.toString("base64")}`);
    console.log(key,buf.length);
  }
  fs.writeFileSync(htmlFile,html,"utf8");
})();
