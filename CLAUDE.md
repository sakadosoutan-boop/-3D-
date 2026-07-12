# 寝殿造り3D探訪 — CLAUDE.md

平安貴族の邸宅様式「寝殿造り」を3D空間で学べるブラウザ完結型の学習ゲーム。本体は単一HTML。

## 最重要ルール

- 正本は GitHub `origin/main`。作業前・push前に必ず `git fetch origin`。古いローカルHTMLやworktreeを正本にしない。
- 本体 `寝殿造り3D探訪_統合版.html`（約23,000行・5.2MB）は**全文Readしない**。
  位置特定は docs/handbook/PROJECT_MAP.md の検索アンカー表を使い、部分Readのみ。
  本体HTML内の調査は html-scout サブエージェント（.claude/agents/html-scout.md）に委譲する。
- 変更後は `npm test` を通す。story/ を触ったら `npm run build:story:check` 必須（.claude/rules/story.md 参照）。
- CSSの編集は `src/app/app.css` で行い `npm run build:app:css` で本体へ反映。本体HTML内の `<style>` を直接編集しない。
- Claude/Codex 並行時は専用ブランチ（claude/○○ / codex/○○）で作業し、main へ直接編集しない。マージ済みブランチは統合後に削除する。

## 検証コマンド

| コマンド | 内容 |
|---|---|
| `npm test` | 一式実行（build:app:css:check → build:story:check → verify:html → verify:story → verify:routes → smoke） |
| `npm run verify:html` | DOM/JS/ITEMS/WAKA/音源/Three.js r128 API の静的検証 |
| `npm run smoke` | Playwright起動スモーク（起動・全モード開始・音ON/OFF・季節時刻切替） |
| `npm run verify:public` | 公開URLの内容検証（デプロイ後に実行） |

## 公開

- URL: https://sakadosoutan-boop.github.io/-3D-/（pages.yml が main push でリポジトリ全体を公開）
- 公開確認の手順は .claude/skills/deploy-check/ を参照（Pages完了待ち→キャッシュバスト付き確認）。

## モデル/トークン運用（標準指示）

- オーケストレーター本体のトークン消費を抑えるため、次を標準とする:
  - 大規模なコード探索・調査 → Sonnet のサブエージェントに委譲（本体HTML内は html-scout を使う）
  - 大きめの実装・リファクタ → Opus のサブエージェントに委譲
  - 本体（上位モデル）は方針決定・レビュー・統合のみを担う
- 手順の詳細は .claude/skills/delegate/ を参照。

## Codex MCP

- `.mcp.json` は codex CLI 前提。未インストール環境では起動時に接続失敗と表示されるが無害。
- セットアップは CODEX_MCP_SETUP.md（または /codex-connect スキル）を参照。

## コミット規約

- `feat:` / `fix:` / `docs:` / `chore:` / `perf:` ＋日本語要約。

## 詳細ドキュメント

- docs/handbook/PROJECT_MAP.md — 構造・検索アンカー表・編集規約（本体HTML編集前に必読）
- docs/handbook/HANDOFF_LATEST.md — 最新の引き継ぎ・衝突しやすい領域
- IMPLEMENTATION_STATUS.md — main/ブランチの実装棚卸し
- docs/handbook/REPO_CLEANUP_RUNBOOK.md — ブランチ掃除・履歴スリム化の手順書（要ローカル実行）
