# Codex MCP連携セットアップ

`.mcp.json` はOpenAI Codex CLIをネイティブのMCPサーバーモード（`codex mcp-server`）で
起動するよう設定済み。Claude Codeからは `codex` / `codex-reply` の2ツールとして使える。

## 前提

- `codex` CLIがインストール・PATHに通っていること
  ```bash
  npm install -g @openai/codex
  ```
- 認証済みであること（いずれか）
  ```bash
  codex login                                  # ブラウザでOpenAI/ChatGPTアカウント認証
  printenv OPENAI_API_KEY | codex login --with-api-key   # APIキー方式
  ```
- 状態確認: `codex doctor`

## 提供ツール（`codex mcp-server` がネイティブに公開）

- `codex` — 新規セッションを開始。`prompt`（必須）、`cwd`, `model`, `sandbox`
  (`read-only`/`workspace-write`/`danger-full-access`), `approval-policy`
  (`untrusted`/`on-failure`/`on-request`/`never`) 等を指定可能。`threadId` を返す。
- `codex-reply` — `threadId` を指定して会話を継続。

## 注意

- ネットワークがプロキシ/allowlist制限下にある環境では `api.openai.com` への到達が
  許可されている必要がある（許可されていない場合、ツール呼び出しは
  `403 Forbidden: Host not in allowlist` を返す）。
- 以前試作していた自作ラッパー（`codex exec` をシェル経由で叩くカスタムMCPサーバー）は
  `codex mcp-server` のネイティブ機能で完全に代替できるため削除した。
