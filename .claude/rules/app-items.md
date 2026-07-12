---
paths:
  - "src/app/items.js"
  - "scripts/build-app-items.js"
---

# ITEMS分離ビルドのルール

- src/app/items.js を変更したら `npm run build:app:items` で本体HTMLへ注入し、`npm run build:app:items:check` で同期を確認する。
- 本体HTML内の APP_ITEMS_EMBED マーカー間は自動生成領域。手編集しない。
- 反映後は `npm run verify:html` を通す。
