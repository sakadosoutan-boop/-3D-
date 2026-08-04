/* 名称当てクイズの出題プール。
   載せてよいのは「季節・時刻を問わず邸内に必ずあり、タップで調べられる」項目だけ。
   (春夏秋冬×朝昼夕夜の全16通りで表示されることを実機確認して選定した。
    夜だけの怪異・季節の生き物・鎌倉マップの品は、探しても居ない場合があるので入れない)

   難易度で出題範囲を変える:
     初級 QUIZ_POOL_EASY   … 建物と大きな目印。まず邸の骨格を覚える
     中級 QUIZ_POOL_NORMAL … 初級＋室内の調度と主要な人物
     上級 QUIZ_POOL        … 全項目(細かな調度・下働きの人々まで)

   QUIZ_POOL は先頭に置くこと。scripts/verify-html.js が最初の `const QUIZ_POOL` を
   全体プールとして拾い、ITEMS 側との整合と、下位プールが全体の部分集合かを検査する。 */
const QUIZ_POOL=[
  /* 建築 */
  "shinden","moya","hisashi","sunoko","kouran","kizahashi","nurigome","niwa","tsuiji","shikyakumon",
  "tai_e","tai_w","tai_n","watadono","sukiwatadono","chumonro","chumon","tsuridono","kurumayadori",
  /* 建具 */
  "misu","hajitomi","tsumado",
  /* 調度品 */
  "michoudai","tatami","shitone","kichou","byoubu","kabeshiro","toudai","kagaribi","hioke","subitsu",
  "iko","kyoudai","nikaizushi","karabitsu","kyousoku","takatsuki","kyouzukue","fusego","fubako","takimono",
  "gissha","onmyo_shikiban","koto","biwa","sho","ryuteki",
  /* 人物 */
  "himegimi","nyobo","kikoshi","aruji","kita_no_kata","kodomo_e","kodomo_w","keishi","menoto","myobu",
  "gejo","zuishin","toneri","genan","monban",
  /* 庭の生き物・植栽(通年で居るものだけ) */
  "matsu","take","fuji","koi","oshidori","neko","karasu"
];
/* 初級: 建物の骨格と、誰でも指させる大きな目印 */
const QUIZ_POOL_EASY=[
  "shinden","moya","hisashi","sunoko","kouran","kizahashi","niwa","tsuiji",
  "tai_e","tai_w","tai_n","watadono","chumon","tsuridono",
  "misu","hajitomi","tsumado",
  "michoudai","tatami","kichou","byoubu","toudai","kagaribi","gissha",
  "koto","biwa","himegimi","nyobo","matsu","koi"
];
/* 中級: 初級＋室内の調度と、邸に仕える主だった人々 */
const QUIZ_POOL_NORMAL=QUIZ_POOL_EASY.concat([
  "shikyakumon","sukiwatadono","chumonro","nurigome","kurumayadori",
  "shitone","kabeshiro","hioke","subitsu","iko","kyoudai","nikaizushi","karabitsu",
  "kyousoku","takatsuki","kyouzukue","fusego","fubako","takimono","onmyo_shikiban","sho","ryuteki",
  "aruji","kita_no_kata","kikoshi","keishi","menoto","take","fuji","neko"
]);
const QUIZ_POOL_BY_DIFF={easy:QUIZ_POOL_EASY,normal:QUIZ_POOL_NORMAL,hard:QUIZ_POOL};
