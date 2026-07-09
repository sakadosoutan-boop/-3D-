# 実装済み棚卸し — main / branch status

最終更新: 2026-07-08
基準: `origin/main` = `69a5c68` (`docs: consolidate duplicate archive notes`)
検証: `npm test` / `npm run verify:public` 通過済み

## main に実装済み

### 基盤

- 単一HTMLアプリ本体、GitHub Pages 用 `index.html`、PWA/OGP/アイコン。
- Three.js r128、手続き生成モデル/テクスチャ、主要画像の data URI 内蔵、一部GLBモデル併用。
- 季節/時刻/名称札/画質/ブルーム/ジョイ設定の localStorage 永続化。
- `npm test` 系の検証基盤:
  - `build:story:check`
  - `verify:html`
  - `verify:story`
  - `verify:routes`
  - `smoke-playwright`
  - `verify-public-url`（公開URL確認）

### 3Dワールド

- 寝殿、対屋、渡殿、釣殿、築地、門、庭、池、小島、反り橋、遣水。
- 春夏秋冬、昼/夕/夜/夜明け、雨、朝靄、月映り、灯籠流し、桜吹雪、紅葉、雪、蛍。
- 桜の廊下干渉回避、藤棚の拡充/屋敷からの距離調整、竹藪追加。
- 畳、白砂、几帳、漆、朱漆、錦、樹皮、牛毛などの質感強化。
- 鯉、鴛鴦、鶴/雁表現、蝶、亀、河童、狐火、人魂、提灯、雪女、鬼、式神、四神。

### UI/操作

- PC/タブレット/スマホ操作、同時移動/視点操作、ジョイスティック、ダッシュ、ヘッドボブ、足音。
- 上部バー、ミニマップ、図鑑、画質設定、ヘルプ、結果画面、各モードHUD。
- WebGLコンテキスト喪失復帰、`prefers-reduced-motion`、safe-area 対応。

### 学習/図鑑

- 建築/建具/調度品/人物/怪異/生き物/霊獣/和歌の図鑑。
- カテゴリ別挿絵、未解放ヒント、解放状態の保存、コンプリート称号。
- 百人一首100首データ、和歌短冊収集、拡大当たり判定。
- 絵巻断片6点と、西の対の「絵巻の継ぎ台」導線。

### モード

- 自由散策。
- 名称当てクイズ、タイムアタック、難易度、ヒント、ローカル順位。
- 男性貴族/女性貴族の一日。
- 垣間見ミッション:
  - 東格子、北壁代、妻戸先の3観察地点。
  - 巡回警備、警戒、危険度ビネット、逃走後警戒。
- 物の怪退治:
  - 破魔の矢、破魔の札、ガード、回避、御神酒。
  - 雑魚怨霊、配置妖怪への攻撃、季節ボス、ボスバー、専用BGM/SE。
- 物語モード「御簾の向こうへ」:
  - 6章構成、章JSON、HTML埋め込み同期。
  - 選択肢、パラメータ、ミニゲーム連携、章別BGM、演出オブジェクト。
  - ED1-ED5、回想、未到達ロック、手動記録、オートセーブ。
  - ED分岐ゲージは結末到達後に解放。
- 恋愛/陰陽系:
  - 恋の母屋ハブ、香合わせ、牛車外出、30日イベント。
  - 陰陽寮の占い補正、散策中の占い通知。
- 車宿/牛車運び:
  - `kurumayadori` 図鑑/札/3Dモデル。
  - モード別表示制御。退治/物語/恋愛/歌合/再現では邪魔にならない。
  - 散策中に車宿/牛車を調べて牛車運びミニゲーム開始。
- 太極六壬式盤:
  - `onmyo_shikiban` 図鑑/札/3Dモデル。
  - 干支/西暦/十二天将/五行/天盤回転/占断結果のパネル。

### 人物/配置

- 姫君は御帳台内へ配置。
- 母屋右の畳に女房を追加。
- 既存の座位人物は座位のまま維持。
- 主人、北の方、子女、家司、乳母、命婦、下女、随身、舎人、下男/番人を図鑑/札/モデルとして追加。
- 歩ける屋敷人物に巡回ルートを付与。
- 主人モデルは貴公子とかぶらないよう色変更し、塗籠以外へ配置。
- 主人の立ち姿の裾を滑らかに調整。

## main に含まれる主要リモートブランチ

`git branch -r --merged origin/main` で確認済み。

- `origin/claude/story-mode-expansion-1kk3is`
- `origin/codex/main-safe-reapply-20260708`
- `origin/codex/stability-ci-docs`
- `origin/codex/kitsune-boss-rig`
- `origin/codex/handoff-quickwins`
- `origin/claude/heian-3d-balance-review-n4ckxf`
- `origin/claude/saigen-mode-dev-clespl`
- `origin/claude/busy-sagan-bg2t95`
- `origin/claude/friendly-albattani-9po8fx`
- `origin/claude/gifted-brahmagupta-mqbn1w`

## 未統合ブランチの扱い

`git branch -r --no-merged origin/main` で確認済み。

| ブランチ | 状態 | 扱い |
|---|---|---|
| `origin/codex/story-priority-implementation` | 履歴上は未マージ。ストーリーゲージ/スモーク等は main 側の新仕様に吸収済み | 丸ごとマージしない。必要な差分だけ確認 |
| `origin/codex/saigen-fix` | 資料/シナリオパッケージ系 | 必要な資料だけ個別確認 |
| `origin/claude/codex-integration-y7np8q` | Codex MCP 連携セットアップ | 本体ゲームとは別系統。必要時に個別レビュー |
| `origin/claude/continuation-alsfsk` | 上と同系統の継続ブランチ | 個別レビュー |
| `origin/claude/design-app-builder-opus-cg5jl4` | 設計図3Dビルダー | 大きな別機能。mainへ入れるなら別PRで検証 |
| `origin/claude/workflow-automation-strategy-jofjos` | SOP/自動化/運用キット | 本体外の運用系。個別判断 |
| `origin/claude/vercel-skills-integration-axr2kp` | `.gitignore` 系 | 必要なら小さく cherry-pick |
| `origin/claude/handoff-docs-publish-qbox12` | 古い起動修正/チュートリアル削除系 | main に後続実装あり。戻さない |
| `origin/claude/handoff-docs-publish-9lrfwo` | 和歌短冊リファクタ WIP | WIP。丸ごとマージ禁止 |

## 整理方針

- README は利用者/開発者の入口として、現行機能と検証コマンドだけを載せる。
- HANDOFF は次作業者が壊さないための短い正本にする。
- 古い長大な handoff やセッションメモは、必要な情報をこのファイルへ移してから整理する。
- 未統合ブランチは「機能が main にあるか」と「履歴上マージ済みか」を分けて判断する。
