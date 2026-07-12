---
paths:
  - "story/**"
  - "scripts/build-story.js"
---

# 物語データ編集ルール

- story/chapters/*.json を変更したら、必ず `npm run build:story` で本体HTMLの STORY_EMBED を同期し、`npm run build:story:check` で確認する。
- 章データの構造は story/schema/ に従う。`npm run verify:story` と `npm run verify:routes` を通すこと。
- 本体HTML側の STORY_EMBED ブロックは手編集しない（ビルドで上書きされる）。
