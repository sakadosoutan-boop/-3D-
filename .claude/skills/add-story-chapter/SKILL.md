---
name: add-story-chapter
description: 物語モード「御簾の向こうへ」への章・シーン・選択肢の追加/変更の標準手順。物語・ストーリー・章・EDルートの作業を頼まれた時に使用。
---

# add-story-chapter — 章追加・変更の標準手順

1. story/STORY_SCENARIO_BIBLE.md と既存の story/chapters/*.json で文体・構造・世界観を確認する。
2. story/schema/ のスキーマに従って章JSONを作成/編集する。
3. `npm run build:story` で本体HTMLの STORY_EMBED へ埋め込み、`npm run build:story:check` で同期を確認する。
4. `npm run verify:story` と `npm run verify:routes`（ED到達性・ルートバランス）を通す。
5. 最後に `npm run smoke` まで実行してから commit する。
6. 本体HTML側の STORY_EMBED は手編集しない（ビルドが上書きする）。
