# 引き継ぎ資料（最新） — 寝殿造り3D探訪

最終更新: 2026-10-17（今回の引き継ぎを追記、旧章は元の記録を保持）
正本: GitHub `origin/main`
現在の確認済み main: 公開直前に `git fetch origin` して更新すること

## 2026-10-14の継続作業

今回の専用ブランチは `codex/kamakura-experiences-20261013`。`origin/main` の `bafc839`（#16〜#18の目・黒帯・冒頭負荷・本文表示修正）を統合済み。2026-10-17、前回の夜景・造形改善 `dbc6b32` と今回の追加 `466ab63`、入口のキャッシュ更新を `60921d5` でmainへ反映し、Pages成功と公開サイトの起動・直接訪問・帰還まで確認した。公開後の追補では平安の行事案内の時代混入を抑止し、入口のキャッシュ識別子を `kamakura-20261017-v2` にする。詳細は [武家屋敷の暮らし・笠懸・草庵](../KAMAKURA_EXPERIENCES_2026-10-14.md)。

- 新ソース `kamakura-games.js` / `kamakura-customs.js/css` / `kenko-hermitage.js/css` はmanifestの末尾で登録。`install-kamakura-experiences.cjs` が登録・核心hook・別時代の演出guardを一度だけ挿入する。再生成は `build:app` → `build:story`。
- mapの最後に `KAMAKURA_WORLD={K,world,anchors,contentIds}`。最終起動前にgames/customsをinit。通常animateのカメラ補間後にゲームupdate、時刻取得直後に草庵専用frameへの早期分岐。mapのanimateラップも草庵中は後段を実行しない。
- `?map=kamakura` から生活仕事場と笠懸へ。`?map=kamakura&visit=kenko` は草庵へ直接訪問して元館へ帰還。再現ボタンだけ平安側の `?replay=tsurezure7` へ移る。鎌倉のstory/taiji gateを全解除していない。
- 矢場の `K.kyudoStart/Shoot/Stop` は世代を管理。新しいゲームは専用の入力・UI・停止・復元を持つ。書付の問題や施設配置は創作で、典拠の年代差を図鑑/資料へ記載。
- 夜の怪異・四神・昼の童/雀・平安側の来客にmap guard。鎌倉の新模型や選択アウトラインをまとめて隠す処理へ置き換えていない。
- `npm test` の最後に `test:kamakura-experiences` を追加。画像/生のreportはignored artifactsへ、統合結果はdocsへ記録。iPhone/iPad実機、第2ストーリー、新ボスは残存。
- `app.css` は再現中の読み込み幕を操作列の奥へ移し、低い横画面を本文・訳の2列にする。`test:saigen` に3画面57段の表示・実クリック検査を追加。詳しくは [低い画面の再現UI](../saigen-layout.md)。
- 2026-10-16、生成HTML 10,155,451 bytesで `npm test` 全体が終了コード0。専用判定は笠懸40・生活場面35・書付20・草庵CPU7、再現レイアウト57段。PC/ブラウザの結果であり実機結果ではない。[統合結果](../metrics/KAMAKURA_EXPERIENCES_2026-10-16.json) を参照。
- 公開後の追補: coreの `koyomiWalkAllowed()` をinstallerで登録。平安の散策・world可視・草庵でない条件を、行事の準備時と900ms後の案内時に確認する。平安表示維持/草庵抑止/帰還後の復帰/鎌倉抑止の実タイマー検査を草庵の既存検査へ追加。installerは既存guardの空白も書き換えず、再実行でHTML/manifestのbyteが一致することを確認。
- 2026-10-17、追補後の生成HTML 10,155,700 bytesでも `npm test` 一式が終了コード0。全専用判定と季節案内4条件を含めて成功。[再検証結果](../metrics/KAMAKURA_EXPERIENCES_2026-10-17.json) を参照。

## 最重要

- 作業前と push 前に必ず `git fetch origin` する。
- ローカルの古いHTMLや古い worktree を正本にしない。
- Claude/Codex が並行する場合、巨大HTMLを同時に main へ直接編集しない。専用ブランチで作業し、最新 `origin/main` を merge してから統合する。
- `src/app/*.js` と `story/*` に正本がある埋め込み範囲はHTML側を直接編集しない。`npm run build:app` の後に `npm run build:story` を直列実行し、並列実行しない。
- 公開URLは GitHub Pages: https://sakadosoutan-boop.github.io/-3D-/
- main push 後は Pages workflow の完了を待ち、キャッシュ回避パラメータ付きで確認する。

## 現行の検証

```bash
npm install
npm test
npm run verify:public
```

`npm test` の内訳:

- `npm run build:story:check`
- `npm run verify:html`
- `npm run verify:story`
- `npm run verify:routes`
- `npm run smoke`
- `npm run verify:public`（公開URL確認）

2026-08-03 時点のPlaywright smokeでは canvas、散策、図鑑、画質、軽量描画、独立香合わせ、蹴鞠、御前五番勝負、共同討伐の開始/共有ダメージ/決着、生活日課、来客、垣間見、退治、物語、手動セーブ移行、屋敷人物、絵巻机、車宿、牛車運び、太極六壬式盤、390px幅を確認する。

## 現行 main の主な実装

- 寝殿造り3D探索、季節/時刻/天候、環境音、画質設定、ミニマップ、図鑑、クイズ、貴族の一日。
- 垣間見ミッションの3観察地点、巡回/警戒/危険度演出。
- 物の怪退治の戦闘化、季節ボス、破魔の矢/札、御神酒、ガード、回避、ボスBGM。
- 物語モード「御簾の向こうへ」6章、5ED、回想、手動記録、EDゲージ、章別BGM、専用演出。
- 屋敷人物の追加、図鑑/札、配置調整、歩行ルート。
- 姫君の御帳台内配置、母屋右畳の女房、絵巻断片の継ぎ台。
- 車宿 `kurumayadori`、牛車運びミニゲーム、太極六壬式盤 `onmyo_shikiban`。
- 恋愛/陰陽モードの基盤、香合わせ、牛車外出、占い補正。
- 独立した香合わせ学習、低性能端末向け軽量描画モード。
- 7役の朝昼夕夜の日課、会話の聞き耳、使者/来客/牛車の到着イベント。
- 物語の章選択、3枠手動セーブ、旧保存形式の移行。
- オンライン御前試合、共有順位、御前五番勝負（名称当て/貝/香/歌/鞠、5000点制、共通シード、途中保存）。
- 共同討伐（四季ボス、通常/修羅、共有HP、サーバー算定ダメージ、行動重複排除、再接続、片方の戦闘不能継続、共同HUD/霊影）。相手座標とボスAIは同期しない。

実装済み一覧とブランチ棚卸しは [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) が正本。

## 高校生目線のUX改修（claude/game-improvement-points-rj8pmd）

初見の高校生が最初の5分で詰まる箇所を、実機計測（Playwright）で確認してから直した回。

- **音**: 表紙のメインテーマ（`悠久の伎楽.mp3`）は残す。既定で切にしたのは
  「散策中の楽の音レイヤー」だけ（設定「音」の〈楽の音〉／`?music=on` で入）。
  環境音・章BGM・ボスBGMは変更なし。
- **音源**: `scripts/optimize-sounds.sh` で再エンコード（38MB→18MB）。音源を差し替えたら必ず再実行する。
  楽曲扱い（96kbpsステレオ）にするファイルは同スクリプトの `is_music` に追記する。
- **先読み**: `SFX.load` を3段に分割。全部を一度に `preload="auto"` しない。
  **表紙のテーマは tier0（即時）に置くこと**——ここを待ち行列に入れると主題が遅れて追いかけてくる。
  新しい音を足したら `pools`/`beds`/`loops`/`se` のどれかに載せるだけでよい（tier分けは自動）。
- **表紙**: モードは5カテゴリ。物語は `#taikenSubPanel .t-modes` の先頭へ `stGate()` が差し込み、
  オンライン対戦は `#titleSubEntries` へ `injectEntry()` が差し込む。**どちらもDOM構造に依存する**ので、
  表紙のHTMLを触る時は `story/story_runtime.js` と `src/app/online-competition.js` の挿入先を必ず確認する。
- **ふりがな**: モード名に `<ruby>` が入るため、`textContent` でのラベル一致判定は壊れる
  （smokeの `storyButtonOk` は `rt` を除去してから比較している）。同様の判定を足す時は注意。
- **クイズ**: `src/app/quiz-pool.js` に全70項目＋難易度別プール。`QUIZ_POOL` は必ずファイル先頭に置く
  （verify-html が最初の `const QUIZ_POOL` を全体プールとして拾い、下位プールの部分集合検査に使う）。
  プールに足してよいのは「春夏秋冬×朝昼夕夜の全16通りで邸内に存在する」項目だけ。
- **図鑑**: 分類別進捗・未解放札の個別ヒント・「未解放を隠す」。ヒント文は `ITEMS[id].d` の書き出しを流用。
- **省電力**: `src/app/low-power.js` に実測fpsによる自動提案（生涯1回）。
- **蹴鞠**: 場面図は 720×500 の固定縮尺のまま。画面が縦長のぶんは `KEMARI_CFG.padTop/padBot`
  （`kmrSyncPad`）で空と白砂を広げて埋める——**Canvasの縦横比を画面に合わせて変えてはいけない**
  （以前 `.kmr-board` が `flex:1 1 auto` で伸び、鞠足ごと縦に引き伸ばされていた）。
  操作の詳細は下の「蹴鞠・香合わせの遊びの作り」を参照（ジェスチャー方式に置き換え済み）。
- **空の雲**: `cloudDome` のUVは球のままだと天頂で1点に収束して放射状の筋になる。
  生成後に水平面(XZ)へ投影し直している（`PROJ` が小さいほど雲は細かい）。
  `TEX.clouds` は縦横どちらにも繋がる512×512。ジオメトリを差し替える時はUVの再投影も忘れないこと。

## 蹴鞠・香合わせの遊びの作り（2026-08-04 改修）

- **蹴鞠の操作**: 「技を選ぶ」と「蹴る」は統合済み。`kemariAttemptKick(tech,opt)` に技を渡すとその技で蹴り、
  `S.selected` にも残る。`opt.at` は**触れた時刻**（指を離した時刻ではない）＝払っても判定精度が落ちない。
  ジェスチャーは `kmrPointerDown/kmrPointerUp`（横=移動 / タップ=受け / 上=高蹴り / 下=渡し）。
  `#kmrKick` は廃止。札(`#kmrReceive` ほか)は押すとその技で蹴るボタンで、`.is-wanted` が要求技を示す。
  **`#kemariHud` の `touch-action:none` を外さないこと**（上下の払いが引っぱり更新に取られる）。
- **香合わせの局進行**: `motif → blend → heat → listen → review` の5段（`KOH_AWASE_STATUS.gameLoop`）。
  `submitBlend()` は炷く(heat)へ進むだけで、`finishHeat()` を経ないと聞香に入らない。
  `fanHeat()` が扇ぐ、`heatTimer` が 50ms 間隔で温度を下げる。**close() でタイマーを止めること**。
  香材は合計 `MAX_ME`(8) 目まで（`setBlend` が上限で頭打ちにする）。
  一局ごとに `round.rival.score` と比べて `round.won` が決まり、`session.wins/losses/draws` に積まれる。

## 衝突しやすい領域

- `寝殿造り3D探訪_統合版.html` は単一HTMLで巨大。行番号ではなく検索アンカーで位置を探す。
- 特に衝突しやすいシンボル:
  - `ITEMS`, `QUIZ_POOL`, `descShort`, `register`, `makeLabel`
  - `pick`, `enterMode`, `animate`, `APP`, `keys`, `player`
  - `makeHeianFigure`, `householdPeople`, `updateHouseholdWalk`
  - `StoryManager`, `STORY_EMBED`, `stChapterMenu`, `stStartChapter`
  - `GISSHA_YARD`, `startGisshaCarry`, `updateGisshaCarry`
  - `openOnmyoDivinationPanel`, `executeOnmyoDivination`
  - `SFX`, `AmbientAudio`, `ST_BGM`, `BLOOM`, `QUALITY`, `GFX`

今回追加した正本:

- `src/app/living-estate.js`: 日課、聞き耳、来訪イベント。`APP.gisshaCarry.active` 中は来訪を始めない。
- `src/app/koh-awase.js`: 独立香合わせ。恋愛日数を変更しない。
- `src/app/low-power.js`: 軽量描画。解除時の設定復元を維持する。
- `src/app/online-competition.js`: Supabase対戦部屋、共有順位、各ゲームへの明示的な対戦起動。
- `src/app/coop-hunt.js`: 共同討伐の同期、共有HUD、共闘者の霊影、退治モードとの限定フック。HTMLはmanifestから生成する。
- `src/app/gozen-five.js`: 御前五番勝負。対戦中の操作は端末内、各局終了時だけ進捗同期。
- `supabase/migrations/20260724_gozen_five.sql`: `gozen5` モード、各局1000点/合計5000点の整合検査、単調進捗、終了結果の凍結。
- `supabase/migrations/20260803_coop_hunt.sql`: `coop_hunt` モード、共有ボスラン/行動ログ、サーバー計算ダメージ、連番/重複排除/RLS。公開前に本番DBへ適用必須。
- `story/story_manager.js` / `story/story_runtime.js`: セーブ移行と `window.STORY_SLOTS` の限定API。

## 再現モード「徒然草 第七段」

- 場面は `src/app/saigen-tsurezure.js`、素材は `src/app/tsurezure-*.js`（各ファイル先頭に API）。本体HTMLは manifest で自動生成。
- 舞台は屋敷から 2.4km 離れたゾーン（あだし野・鳥部山・草庵・接写セット4種）＋屋敷の場（老人と孫・従者）。
  本体の `animate` から `SAIGEN_ENV_HOOK` を毎フレーム呼び、自前ゾーンだけ空・霧・光を上書きする（屋敷の場は本体の光のまま）。
- 素材の生成は重い（人物1体1〜4秒、全部で数十秒）。`BEAT_JOBS` で場ごとに必要な仕事だけを `onBeat` で作り、
  残りは `pumpJobs` が一件ずつ作る。一件で数百ms〜数秒の同期処理で画面が止まるため、カメラが動いている間は作らず、
  その場の最後のショットが動き終えて止まってから作る（`cameraAtRest`）。新しい素材を足す時は JOB_DEFS / JOB_ORDER / BEAT_JOBS に登録する。
- まだ素材の出来ていない場へ飛んだ時は、`onBeat` が暗幕 `#sgPrep`（「絵を整えています…」）を先に描かせてから作り、出来たら場を始める
  （`S.pendingBeat` が立っている間は場が始まっていない）。テストや撮影で同期的に作らせたい時は `SAIGEN_TSUREZURE.S.syncBuild=true`。
- 屋敷の場（老人・孫・従者）の間は、本編の人物（`people` の女房たち・`householdPeople`）を隠し、ゾーンを離れる時と後片付けで戻す（`hideEstateFolk`）。
  再現モード中は月齢の告知トーストも出さない（散策へ戻ってから一度だけ出る）。
- 孫（`makeMago`）の顔は「怖い」との指摘で作り直した。青白い肌・切りそろえた前髪のおかっぱ・見開いた目は市松人形に見えるので避け、
  暖かい肌と頬の赤み・真ん中分けの振分髪・笑みで細めた目（瞳は明るい茶、描き込みのキャッチライト）にしている。
  頭部パラメータの `gazePitch` は正が下向き（`gazeYaw` は正が人物の左）。まぶたは視線に合わせて上下する（上まぶたは全量、
  下まぶたは半分。`faceCurves` の `sDn`）。以前は回転の符号が逆で、下を見せるつもりの姿勢で瞳がまぶたの裏へ回り「目がない」顔になっていた。
- 再現モードの上下の黒帯（`.letterbox-bar`）は本文パネル・上端のボタン（`#saigenHud`）の奥に置く（`z-index:44`）。
  手前のままだと縦長の画面で「次の場」「絵を見る/本文を表示」「✕」が黒帯に隠れて押せなくなる。
- 再現モード（全作品）の本文: 場面転換の暗転・白転・稲光（`#sgFade`、`#saigenHud` 内）は場面の絵だけを覆い、本文パネルは
  その手前（`z-index:47`）、上端のボタン列と✕はさらに手前（`z-index:48`。本文を選ぶ画面 `#sgPicker` は 49 でボタン列を覆う）。
  `fitSaigenHonbun`（場の切替と画面サイズの変更で呼ぶ）がパネルの大きさを整える。
  - 本文が枠に収まらない時は枠を縦に広げ、なお足りなければ文字を小さくする（最小12px）。
  - 現代語訳があふれる時は、パネルの上の余白の範囲で訳の枠を伸ばす。縦長のスマホで訳の後半が隠れていた。
  - 背の低い画面（横向きのスマホ）でパネルが上端のボタン列に食い込む時は、本文の枠を縮める。和歌は句の途中で折らないので、
    文字を11pxまで小さくして収める。
- 本編の通知（`#toast`、`z-index:50`）は `#saigenHud` より手前に出る。再現モード中は季節替わりの「○の庭になりました」を出さない
  （`applySeason`）。枕草子は毎場季節が変わるので、この通知が現代語訳の行に重なっていた。ほかの通知も、再現モード中は上端のボタン列の下へ出す
  （`body.saigen-mode #toast`）。
- 名札・吹き出しは本体が `figure.position` をワールド座標として使うため、ゾーンや庵の子になった人物には代理点（`S.proxy`）を
  頭上へ毎フレーム写している。
- 検証は `npm run test:saigen`（全13場の早送り・終了の後始末・既存2作品・縦長390×844と横向き844×390での本文パネルの見え方）。
  撮影確認は Playwright で各場のショットを早送りして撮る。
- 既知: この種のコンテナではページの load が30秒を超えることがあり、`test:quality` などの既定30秒の goto が時間切れになる。
  `test:visual-backlog` の「四季×四時刻でジオメトリを再利用」は origin/main でも同じく失敗する（今回の変更とは無関係）。

## 再現モード「枕草子 第一段 春はあけぼの」

- 場面は `src/app/saigen-makura.js`（`SAIGEN_MAKURA`。徒然草と同じ骨組み: ゾーン・`BEAT_SHOTS`・`JOB_DEFS`/`BEAT_JOBS`・`syncBuild`・暗幕）。
  作品一覧の先頭に登録する（`makura_haru`、15場、話者は全場 `seishonagon`）。設計は docs/plans/MAKURA_SAIGEN_PLAN.md。
- 舞台は中宮の御所の庭（`miya` ゾーン: 殿舎の一角・渡殿・築地・遣水・池・中島・桜・松・竹・京の山並み）と接写セット3種
  （`hotaru` 夜の葉の蛍・`shimo` 霜・`suzu` 薄の鈴虫。実寸で作り×20で置く）。
- 素材（各ファイル先頭に API）:
  - 建物 `TSURE_AN.makeDensha / makeWatadono / makeTsuiji`（原点＝簀子の外縁の南東角の地面。`setMisu`・`setShitomi`・`setNight`・`setSeason`。
    座の位置は `anchors.seatHashi`。東の妻は閉じているので、座から東の山ぎはは見えない＝第2・3場は簀子や庭から撮る）。
  - 人物 `TSURE_FIGURES.makeNyobo`（十二単の清少納言・袿の女房。姿勢 gaze/fan/carry/tend、`setKasane`）。顔は「アニメ調すぎる」
    「大人っぽく写実寄りに」との指摘で写実の頭（`softFace`・`shadeAcc`）が既定。`headParams:{anime:true}` で旧の様式化した顔。
  - 調度 `MAKURA_PROPS.makeHioke`（`setBurn(0..1)` で炭火→白い灰、`emberLight` を場面の `interiorLight` に写す）・`makeSumitori`・`makeKichou`。
  - 生き物 `TSURE_INSECTS.makeFireflySwarm / makeGenjiBotaru / makeSuzumushi`、接写セット `TSURE_FLORA.makeNightLeafMacroSet / makeFrostMacroSet / makeStalkMacroSet`。
  - 空と天候 `TSURE_NATURE`（たなびく雲の空・12プリセット・`makeKyotoRidges`・`makeRain`・`makeSnowfall`・`makeGeese`・`makeCrowFlock`）。
    山並みは線形色で書いて出力時に変換する（夜・高画質の UnrealBloom 経路で暗部が持ち上がり白く見えていた）。
- 音は `SND` 表（`sounds/makura_*.mp3` 13本＋既存の梵鐘）。出典は sounds/CREDITS.md（CC0 と CC BY 4.0。衣擦れ・炭火・冬の風・
  烏・雁は近似の録音）。場ごとの音量は `BEAT_AUDIO`。
- 検証は `npm run test:saigen-makura`（15場の早送り・素材が代替の箱に落ちていないか・終了の後始末）。`test:saigen`（徒然草）は
  このコンテナで約11分かかる。
- 既知: ゲーム全体でブルームの最後の写しに色調補正が二重にかかっている（夜の場面が少し暗く潰れる）。直すなら本体側で
  `bp.basic.toneMapped=false` だが全体に効くので未対応。

## 未統合ブランチの扱い

- `git fetch origin --prune` 後に `git branch -r --no-merged origin/main` で毎回確認する。固定リストは古くなるので正本にしない。
- 2026-07-22時点でClaudeの位階すいか作業は `origin/claude/heian-3d-balance-review-n4ckxf`。`src/app/app.css` と巨大HTMLを触るため、統合後は埋め込みビルドと `npm test` を必ずやり直す。
- `origin/codex/story-priority-implementation` や古い handoff/WIP 系はmain側に後続実装がある。丸ごとマージしない。

## 次に触る時の短縮指示

```text
docs/handbook/HANDOFF_LATEST.md と IMPLEMENTATION_STATUS.md を読む。
git fetch origin で最新 main を確認し、専用ブランチで作業。
単一HTMLの共有領域(ITEMS/register/pick/enterMode/animate/CSS/音声/StoryManager)に注意。
Three.js r128 旧APIを維持し、colorSpace APIを入れない。
実装後は npm test。公開時は main push 後に Pages の反映確認。
```
