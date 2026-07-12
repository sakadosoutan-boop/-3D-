---
paths:
  - "src/app/**"
  - "scripts/build-app-css.js"
---

# CSS分離ビルドのルール

- src/app/app.css を変更したら `npm run build:app:css` で本体HTMLへ注入し、`npm run build:app:css:check` で同期を確認する。
- 本体HTML内の APP_CSS_EMBED マーカー間は自動生成領域。手編集しない。
- 反映後は `npm run verify:html` を通す。
