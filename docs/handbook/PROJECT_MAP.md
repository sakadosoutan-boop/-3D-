# 寝殿造り3D探訪 — プロジェクトマップ & 編集規約

最終更新: 2026-07-08

このプロジェクトは、単一HTML `寝殿造り3D探訪_統合版.html` を中心にしたオフライン対応の3D学習ゲームです。大きなファイルなので、編集時は行番号ではなく検索アンカーとシンボル名で位置を特定してください。

## 基本方針

- 正本は `origin/main`。
- Three.js は r128。`outputEncoding` / `sRGBEncoding` / `texture.encoding` を維持する。
- 単一HTML方針を維持する。外部CDNや実行時必須の外部アセット追加は慎重に判断する。
- 本体HTMLの大改修前後は `npm test` を通す。
- Claude/Codex 並行時は専用ブランチを使い、古い worktree から直接 main へ戻さない。

## 主要ファイル

| パス | 役割 |
|---|---|
| `寝殿造り3D探訪_統合版.html` | アプリ本体。3D、UI、モード、図鑑、物語、恋愛/陰陽、ミニゲームを含む |
| `index.html` | GitHub Pages 用入口 |
| `package.json` | 検証コマンド |
| `scripts/build-story.js` | 章JSONからHTML内 `STORY_EMBED` を同期/確認 |
| `scripts/verify-html.js` | DOM/JS/ITEMS/WAKA/音源/r128 API 静的検証 |
| `scripts/verify-story.js` | 物語章データ検証 |
| `scripts/verify-story-routes.js` | EDルート検証 |
| `scripts/smoke-playwright.js` | Playwright 起動スモーク |
| `story/chapters/*.json` | 物語モードの章データ |
| `sounds/` | BGM/環境音/SE |
| `assets/bosses/` | 退治ボス用GLB |
| `IMPLEMENTATION_STATUS.md` | main/ブランチの実装済み棚卸し |
| `docs/handbook/HANDOFF_LATEST.md` | 次作業者向けの最新引き継ぎ |

## HTML内の検索アンカー

| 検索語/シンボル | 内容 | 注意 |
|---|---|---|
| `<style>` | 全UI、HUD、モード別表示 | モバイルCSSと z-index 競合に注意 |
| `const ITEMS` | 図鑑/説明データ | 追加時は `register`, `makeLabel`, スモークも確認 |
| `QUIZ_POOL` | クイズ対象 | ITEMS追加と同期 |
| `const APP` | アプリ状態 | 新モード追加時の初期値をここへ |
| `function enterMode` | モード切替 | HUD/音/可視性/移動制限の中心 |
| `function pick` | クリック/タップの相互作用 | 新規インタラクトの入口 |
| `function animate` | 毎フレーム更新 | 重い処理を入れない |
| `makeHeianFigure` | 平安人物モデル | 座位/立位/衣装裾の共通基盤 |
| `householdPeople` / `updateHouseholdWalk` | 屋敷人物と巡回 | 座っている既存人物を歩行化しない |
| `GISSHA_YARD` | 車宿/牛車運び | 退治/物語/恋愛等では邪魔にならない表示制御 |
| `onmyo_shikiban` | 太極六壬式盤 | パネルDOM/CSS/図鑑/札と連動 |
| `StoryManager` | 物語実行 | `story/chapters` と `build:story` で同期 |
| `stChapterMenu` / `stStartChapter` | 物語章メニュー/開始 | EDゲージは結末到達後に解放 |
| `SFX` / `AmbientAudio` / `ST_BGM` | 音響 | autoplay制約とミュート追従に注意 |
| `QUALITY` / `BLOOM` / `GFX` | 画質/ブルーム | モバイル負荷に注意 |

## 検証コマンド

```bash
npm run build:story:check
npm run verify:html
npm run verify:story
npm run verify:routes
npm run smoke
npm test
```

Playwright が無い環境では `npm install` を先に実行する。

## 編集規約

1. 変更前に `git fetch origin`。
2. 本体HTMLと `story/chapters/*.json` を同時に触ったら `npm run build:story:check` を必ず確認する。
3. `ITEMS` に項目を増やしたら、図鑑、札、クイズ対象、スモークのいずれが必要か確認する。
4. モード追加時は `enterMode`, `pick`, `animate`, HUD表示、Escapeキー、移動制限、音の停止を確認する。
5. 既存の座位人物を誤って立位/歩行に変えない。歩ける人物は `walkReady` 付きの屋敷人物に限定する。
6. 物語モードの古いブランチ差分を丸ごと戻さない。現行 main のED導線/ゲージ/回想/記録仕様を優先する。
7. 大きな変更後は `npm test` を通し、失敗ログを修正してから commit/push する。

## 現在の優先バックログ

- 公開後の Pages 反映確認を自動/手動で確実にする。
- 絵巻断片の完成ビュー/並べ替え演出を強化する。
- 牛車運びを恋愛/貴族の一日導線へ自然につなげる。
- 太極六壬式盤の占断結果を恋愛/外出/物語サブイベントへ反映する。
- 屋敷人物の巡回を増やす場合は、座位人物・物語演出・垣間見警備と干渉しないようルートを分ける。
- `HANDOFF_*` 系の古い資料は、必要に応じて `IMPLEMENTATION_STATUS.md` に統合してから整理する。
