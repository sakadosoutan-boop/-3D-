# 引き継ぎ資料（最新） — 寝殿造り3D探訪

最終更新: 2026-07-22
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

2026-07-22 時点のPlaywright smokeでは canvas、散策、図鑑、画質、軽量描画、独立香合わせ、生活日課、来客、垣間見、退治、物語、手動セーブ移行、屋敷人物、絵巻机、車宿、牛車運び、太極六壬式盤を確認している。

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

実装済み一覧とブランチ棚卸しは [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) が正本。

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
