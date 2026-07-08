# Claude/Codex Handoff 2026-07-08

このファイルは、Codex が旧 `codex/story-priority-implementation` で追加した直近変更を、最新 `origin/main` (`4025799`) ベースへ再適用した内容を Claude が読み取れるように残したメモです。

## 公開対象の追加変更

- `寝殿造り3D探訪_統合版.html`
  - 追加人物/屋敷人物の図鑑・札・配置調整。
  - 姫君を御帳台内へ移動、母屋右畳に女房を追加。
  - 歩行可能な屋敷人物の巡回アニメーションを追加。
  - 桜・藤棚・竹藪・主人の裾・絵巻断片集積机を調整。
  - 車宿 `kurumayadori` を追加し、散策/クイズ/一日/垣間見では表示、物の怪退治/物語/恋愛/歌合/再現では非表示。
  - 牛車運びミニゲームを追加。散策中に牛車または車宿を調べると開始し、W/A/S/D または画面ボタンで車寄まで運ぶ。
  - 添付 `gemini-code-1783439245130.html` の占い機能を「太極六壬式盤」として追加。散策中に式盤を調べると、干支選択・西暦反映・天盤回転・十二天将の占断を表示する。
- `scripts/smoke-playwright.js`
  - 追加人物/配置/絵巻机/車宿/牛車運び/太極六壬式盤のスモーク検査を追加。
  - Chromium の音声 `play()` 中断ログは、実害のない既知ノイズとして無視。

## Claude が競合解決時に守ること

- 旧ブランチのストーリー系差分は、最新 `origin/main` 側に同等以上の改善が入っていたため、巻き戻さないよう最新側を採用済み。
- 今後このブランチを公開/統合する時も、必ず直前に `git fetch origin` して `origin/main` が進んでいないか確認する。
- 巨大HTMLの競合では、Claude側の物語モード修正を消さず、Codex側の追加機能ブロックを移植する。
- 特に残すべきシンボル:
  - `GISSHA_YARD`, `updateGisshaYardVisibility`, `startGisshaCarry`, `updateGisshaCarry`, `endGisshaCarry`
  - `onmyo_shikiban`, `openOnmyoDivinationPanel`, `executeOnmyoDivination`, `ONMYO_DIVINATION_STATUS`
  - `emakiAssembly`, `HOUSEHOLD_WALK_READY`, `CHARACTER_LAYOUT_STATUS`
- 公開前に `npm test` を通す。現時点のローカル検証では `build:story:check`, `verify:html`, `verify:story`, `verify:routes`, `smoke` が成功済み。

## 公開URL

GitHub Pages は `main` push 後に `.github/workflows/pages.yml` で自動デプロイされる想定。
