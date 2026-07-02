# Story Mode Scaffold

このフォルダは大規模ストーリーモードの一括実装に向けた準備領域です。

現時点では本体HTMLへ接続していません。次回以降、`story/story_manager.js` の内容を
`寝殿造り3D探訪_統合版.html` へ統合するか、外部JSとして読み込むかを決めてから実装します。

## 構成
- `STORY_SCENARIO_BIBLE.md`: 作品コンセプト、人物、全6話詳細、分岐、ED、演出方針。
- `STORY_BEAT_SHEET.md`: 各話をイベントID、演出、選択肢、パラメータ効果へ落とした実装用メモ。
- `STORY_IMPLEMENTATION_QA.md`: 実装後の自己レビュー、修正済みの問題、次回改善候補。
- `story_manager.js`: 外部JSONをfetchして進行するStoryManager骨子。
- `chapters/chapter_manifest.json`: 全6話の目録。
- `chapters/chapter1.json`: 第1話サンプルJSON。
- `schema/story.schema.json`: JSON構造の簡易仕様。

## シナリオ作成の起点
本文JSONを増やす場合は、まず `STORY_SCENARIO_BIBLE.md` の章別設計を読み、次に `STORY_BEAT_SHEET.md` のイベントID案を参照してください。
小萩/栞の二重存在、`realityEgo` / `fantasySynchro` / `brainErosion` の意味、ED1-ED5の感情線が物語全体の芯です。

## 注意
ブラウザのセキュリティ仕様により、`file://` で直接開いた場合は `fetch()` が失敗する環境があります。
GitHub Pages、またはローカルHTTPサーバーでの実行を前提にしてください。
