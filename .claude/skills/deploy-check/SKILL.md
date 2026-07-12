---
name: deploy-check
description: 変更をmainへ反映した後、GitHub Pagesの公開確認までを行う標準手順。「公開して」「デプロイ確認」「公開されてるか見て」と言われた時に使用。
---

# deploy-check — 公開確認の標準手順

1. main へのマージ（またはpush）後、GitHub Actions の pages.yml の完了を確認する
   （Web版セッション: GitHub MCP の actions_list ツール / ローカル: `gh run watch`）。
2. `npm run verify:public` を実行して公開URLの内容を検証する。
3. ブラウザでの目視確認はキャッシュ回避パラメータ付きで行う:
   `https://sakadosoutan-boop.github.io/-3D-/?v=<タイムスタンプ>`
4. 音源・GLB等の大きいアセットを追加した場合は、該当アセットのURLへ直接アクセスして404でないことも確認する。
5. 公開に問題があれば、直前のPages実行ログ（deploy job）を確認してから再デプロイを判断する。
