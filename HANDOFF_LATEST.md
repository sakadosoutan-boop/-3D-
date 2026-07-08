# 引き継ぎ資料（最新） — 寝殿造り3D探訪

最終更新: 2026-07-08
正本: GitHub `origin/main`
現在の確認済み main: `eded4f1` (`feat: reapply Codex gissha and onmyo features on latest main`)

## 最重要

- 作業前と push 前に必ず `git fetch origin` する。
- ローカルの古いHTMLや古い worktree を正本にしない。
- Claude/Codex が並行する場合、巨大HTMLを同時に main へ直接編集しない。専用ブランチで作業し、最新 `origin/main` へ rebase/merge してから統合する。
- 公開URLは GitHub Pages: https://sakadosoutan-boop.github.io/-3D-/
- main push 後は Pages workflow の完了を待ち、キャッシュ回避パラメータ付きで確認する。

## 現行の検証

```bash
npm install
npm test
```

`npm test` の内訳:

- `npm run build:story:check`
- `npm run verify:html`
- `npm run verify:story`
- `npm run verify:routes`
- `npm run smoke`

2026-07-08 時点で、`eded4f1` は上記フル検証を通過済み。Playwright smoke では canvas、散策、図鑑、画質、垣間見、退治、物語、屋敷人物、絵巻机、車宿、牛車運び、太極六壬式盤を確認している。

## 現行 main の主な実装

- 寝殿造り3D探索、季節/時刻/天候、環境音、画質設定、ミニマップ、図鑑、クイズ、貴族の一日。
- 垣間見ミッションの3観察地点、巡回/警戒/危険度演出。
- 物の怪退治の戦闘化、季節ボス、破魔の矢/札、御神酒、ガード、回避、ボスBGM。
- 物語モード「御簾の向こうへ」6章、5ED、回想、手動記録、EDゲージ、章別BGM、専用演出。
- 屋敷人物の追加、図鑑/札、配置調整、歩行ルート。
- 姫君の御帳台内配置、母屋右畳の女房、絵巻断片の継ぎ台。
- 車宿 `kurumayadori`、牛車運びミニゲーム、太極六壬式盤 `onmyo_shikiban`。
- 恋愛/陰陽モードの基盤、香合わせ、牛車外出、占い補正。

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

## 未統合ブランチの扱い

- `origin/codex/story-priority-implementation`: 履歴上は未マージだが、ストーリー改善は main 側に同等/後続実装が入っている。丸ごとマージしない。
- `origin/claude/handoff-docs-publish-*`: 古い handoff/WIP 系。正本に戻さない。
- `origin/claude/codex-integration-*`, `origin/claude/design-app-builder-*`, `origin/claude/workflow-automation-*`: 本体ゲームとは別系統のツール/運用追加。必要時に個別レビュー。
- `origin/codex/saigen-fix`: 主に資料/シナリオパッケージ。必要箇所のみ確認。

## 次に触る時の短縮指示

```text
HANDOFF_LATEST.md と IMPLEMENTATION_STATUS.md を読む。
git fetch origin で最新 main を確認し、専用ブランチで作業。
単一HTMLの共有領域(ITEMS/register/pick/enterMode/animate/CSS/音声/StoryManager)に注意。
Three.js r128 旧APIを維持し、colorSpace APIを入れない。
実装後は npm test。公開時は main push 後に Pages の反映確認。
```
