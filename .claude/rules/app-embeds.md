---
paths:
  - "src/app/**"
  - "scripts/build-app.js"
  - "scripts/app-manifest.json"
  - "scripts/lib/**"
---

# 分離ソース（src/app/）編集ルール

- src/app/ 配下（app.css / items.js / waka.js / quiz-pool.js）を変更したら `npm run build:app` で本体HTMLへ注入し、`npm run build:app:check` で同期を確認する。
- 本体HTML内の `APP_*_EMBED` マーカー間は自動生成領域。手編集しない。
- ブロックの追加は scripts/app-manifest.json に定義を足し、初回のみ `node scripts/build-app.js --extract=<name>` で切り出す（バイト同一の往復検証が組み込まれている）。
- 反映後は `npm run verify:html` を通す。
