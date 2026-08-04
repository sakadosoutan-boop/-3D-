# 引き継ぎ資料（最新） — 寝殿造り3D探訪

最終更新: 2026-08-03
正本: GitHub `origin/main`
現在の確認済み main: 公開直前に `git fetch origin` して更新すること

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
