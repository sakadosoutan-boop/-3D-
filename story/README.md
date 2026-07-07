# Story Mode（御簾の向こうへ — 寝殿造り異聞）

平安×現代を行き来する全6話のストーリーモード。本体 `寝殿造り3D探訪_統合版.html` に
**同梱済み**で、タイトルのメインメニュー先頭「御簾の向こうへ（デモ版）」から遊べます。
本番: https://sakadosoutan-boop.github.io/-3D-/

## 本体HTMLへの同梱（重要）
`story/*.js` と `story/chapters/*.json` は、本体HTMLの同梱マーカー
`/* … ストーリーモード同梱ここから … */` 〜 `… ここまで …` の間へ、
ビルドスクリプトで自動的に埋め込みます。**手で貼り付けないでください。**

```bash
npm run build:story          # story/ の変更を統合HTMLへ再同梱
npm run build:story:check    # 同梱が最新か検査（ズレていれば失敗。CIでも実行）
```

`window.STORY_EMBED = {manifest, chapters:{1..6}}` として全章JSONが流し込まれ、
`StoryManager` は fetch せずこの同梱データから章を読みます（単一HTML主義との両立）。

## 検証（すべて `npm test` に含まれる）
- `npm run build:story:check` — 同梱が story/ ソースと一致しているか
- `npm run verify:story` — 章グラフ・ミニゲーム・ED定義の構造検証
- `npm run verify:routes` — StoryManager を全章走破し ED 到達バランスを検証
  （理想ルート→ED1 True End、雅偏重→ED4、敗北→ED3 など）
- `npm run verify:html` — 単一HTMLの整合（DOM id 参照、スクリプト構文ほか）
- `npm run smoke` — Playwright で起動〜物語モード〜各ミニゲームの実機スモーク

## 構成
- `STORY_SCENARIO_BIBLE.md`: 作品コンセプト、人物、全6話詳細、分岐、ED、演出方針。
- `STORY_BEAT_SHEET.md`: 各話をイベントID・演出・選択肢・パラメータ効果へ落とした実装メモ。
- `STORY_IMPLEMENTATION_QA.md`: 実装後の自己レビュー、修正済みの問題、次回改善候補。
- `story_manager.js`: 章JSONを進行させる StoryManager（同梱 `STORY_EMBED` 優先、HTTP時はfetch）。
- `story_object_factories_draft.js`: 物語専用の3Dオブジェクト工房（御簾・短冊・栞・大鬼ほか）。
- `story_runtime.js`: HUD/演出/カメラ/ミニゲーム接続など物語モードのランタイム。
- `chapters/chapter_manifest.json` + `chapters/chapter{1..6}.json`: 全6話の目録と本文。
- `schema/story.schema.json`: JSON構造の簡易仕様。

## シナリオ作成の起点
本文JSONを増やす場合は、まず `STORY_SCENARIO_BIBLE.md` の章別設計、次に
`STORY_BEAT_SHEET.md` のイベントID案を参照してください。小萩/栞の二重存在、
`realityEgo` / `fantasySynchro` / `brainErosion` の意味、ED1-ED5 の感情線が物語の芯です。
章JSONを編集したら **必ず `npm run build:story`** で同梱を更新してください。

## パラメータとEnding（要点）
- `realityEgo`（現）: 現実へ帰る自我。`fantasySynchro`（雅）: 平安世界への同調。`brainErosion`（蝕）: 侵食。
- True End(ED1) 条件: 現≥60 かつ 雅≥60 かつ 蝕≤20 かつ 歌合・大鬼祓いを完勝（`utakaiPerfect`/`oniPerfect`）。
- 最終問で相手を「あなた」と呼べた者（`calledYou`）は理想化を脱し、雅が高くても ED4 に落ちない。
- 詳細な到達条件は `verify-story-routes.js` が実データで検証している。

## 注意
`file://` で直接開くと `fetch()` が失敗する環境がありますが、本モードは同梱 `STORY_EMBED`
を使うため単一HTMLのまま動きます（GitHub Pages / ローカルHTTPでも当然動作）。
