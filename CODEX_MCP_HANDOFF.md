# 引継ぎ（次セッションへ） — Codex MCP連携

最終更新: 2026-07-06 / 作成: Claude Code セッション

## 0. これは何の作業か

`寝殿造り3D探訪` 本体（ゲームコンテンツ）とは無関係の**開発ツール連携**作業。
Claude CodeからOpenAI Codex CLIをMCP経由で呼び出せるようにする。

- ブランチ: `claude/codex-integration-y7np8q`
- PR: https://github.com/sakadosoutan-boop/-3D-/pull/1 （`main` ← このブランチ）
- 直近コミット: `288f324`（`06ed146` を上書きする形で自作ブリッジを撤去し、ネイティブ方式へ一本化済み）

## 1. これまでの経緯

1. 最初、`codex exec` をシェル経由で叩く自作MCPサーバー（`mcp/codex-bridge/`）を実装 → 動作確認OK
2. その後、`codex` CLI自体に **`codex mcp-server`** というネイティブMCPサーバーモードがあると判明
   （`codex` / `codex-reply` の2ツールを標準搭載、承認ポリシー・サンドボックス・model指定も可能）
3. 自作ブリッジより公式で高機能なため、自作コードを削除し `.mcp.json` を
   `codex mcp-server` 直起動に一本化（コミット `288f324`）
4. 実機で `codex` ツールを呼び出す試験をしたところ、**認証未設定**かつ
   **このリモート実行環境のネットワークポリシーが `api.openai.com` 等への到達を拒否**していることが判明
   （`403 Forbidden: Host not in allowlist` / プロキシの `connect_rejected`）
5. ユーザーが環境設定の「許可されたドメイン」に `api.openai.com` / `auth.openai.com` / `chatgpt.com` を追加
6. ただし環境設定ダイアログに **「環境への変更は新しいセッションに適用されます」** と明記されており、
   このセッション（コンテナ）は変更前に起動済みのため反映されない。実際に再テストしても
   `auth.openai.com`/`chatgpt.com`は403のまま、`api.openai.com`だけ403→421に変化（過渡的な状態の可能性）

## 2. 次セッションでやること

1. **必ず新しいセッションをこの環境（`Canva`という名前の環境）で開始する**
   （このドキュメントを読んでいる時点でそれは満たされているはず）
2. ネットワーク到達確認:
   ```bash
   curl -sS "$HTTPS_PROXY/__agentproxy/status"
   curl -sS -o /dev/null -w "%{http_code}\n" https://api.openai.com
   curl -sS -o /dev/null -w "%{http_code}\n" https://auth.openai.com
   curl -sS -o /dev/null -w "%{http_code}\n" https://chatgpt.com
   ```
   200番台/302等（403でなければ）まで到達すればOK。403が続く場合は許可ドメイン設定を再確認。
3. `codex` CLIのインストール確認（前セッションでグローバルインストール済みだが、
   新セッションのコンテナには残っていない可能性があるので再確認・必要なら再インストール）:
   ```bash
   codex --version || npm install -g @openai/codex
   codex doctor
   ```
4. 認証:
   ```bash
   codex login --device-auth   # まずこちらを試す（ヘッドレス向け）
   # だめなら
   codex login                 # ブラウザOAuth
   ```
5. 認証成功後、実際にMCP経由で`codex`ツールを呼び出して動作確認（`mcp/`配下は削除済みなので、
   一時テストスクリプトを作るなら `/tmp` 等リポジトリ外に置くこと）。
   Claude Code自体からも、このリポジトリを開けば`.mcp.json`経由で`codex`/`codex-reply`
   ツールが使えるようになっているはずなので、直接ツール呼び出しで確認してもよい。
6. 動作確認が取れたら `CODEX_MCP_SETUP.md` に「認証・実行確認済み（日付）」を追記し、
   このブランチにコミット・プッシュ、PR #1 に反映。
7. 本タスクが完了したら、この `CODEX_MCP_HANDOFF.md` は削除してよい（引継ぎ専用の一時ファイル）。

## 3. 注意点

- ネットワークの403/407は**回避しない**（プロキシREADME `/root/.ccr/README.md` の方針通り）。
  許可ドメインの設定不備が疑われる場合はユーザーに確認する。
- `codex mcp-server` はWebSocketも使う場面があり、プロキシがWebSocketアップグレード非対応な点は
  `/root/.ccr/README.md` に明記されている（"Not supported through the proxy" 参照）。
  もしAPI疎通はできてもWebSocket部分だけ失敗する場合はこれが原因の可能性がある。
