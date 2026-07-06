# codex-bridge MCP server

Claude Code から OpenAI Codex CLI (`codex exec`) にタスクを委譲するための、ローカル stdio MCP サーバー。

## 前提

- `codex` CLI がこのマシンにインストール済み・ログイン/認証済みであること
  （PATH に無い場合は `CODEX_MCP_BIN` 環境変数に実行ファイルの絶対パスを指定）

## セットアップ

```bash
cd mcp/codex-bridge
npm install
```

プロジェクトルートの `.mcp.json` に登録済みなので、このディレクトリで `npm install` すれば
Claude Code 起動時に自動接続される。

## 提供ツール

- `codex_exec` — `prompt`（必須）で与えたタスクを `codex exec` に渡して非対話実行し、
  標準出力/終了コード/標準エラーを返す。呼び出しは完了かタイムアウト（既定10分、
  `CODEX_MCP_TIMEOUT_MS` で変更可）までブロックする。
  - `cwd`: 作業ディレクトリ
  - `sandbox`: `read-only` / `workspace-write` / `danger-full-access`
  - `full_auto`: `true` で `--full-auto`（承認プロンプト無し）
  - `model`: Codex側のモデル上書き指定

## 制限

- 現状は単発のリクエスト/レスポンスのみで、ストリーミングや中断は未対応。
- `codex` が長時間かかるタスクを投げるとブロックしたままになるため、
  委譲するタスクは小さく自己完結した粒度に分けること。
