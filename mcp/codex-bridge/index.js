#!/usr/bin/env node
import { spawn } from "node:child_process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEFAULT_TIMEOUT_MS = Number(process.env.CODEX_MCP_TIMEOUT_MS || 10 * 60 * 1000);
const CODEX_BIN = process.env.CODEX_MCP_BIN || "codex";

function runCodex({ prompt, cwd, sandbox, fullAuto, model, timeoutMs }) {
  return new Promise((resolve) => {
    const args = ["exec"];
    if (fullAuto) args.push("--full-auto");
    if (sandbox) args.push("--sandbox", sandbox);
    if (model) args.push("--model", model);
    args.push(prompt);

    let child;
    try {
      child = spawn(CODEX_BIN, args, {
        cwd: cwd || process.cwd(),
        env: process.env,
        shell: false,
      });
    } catch (err) {
      resolve({ ok: false, spawnError: err.message });
      return;
    }

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, spawnError: err.message });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0 && !timedOut, code, timedOut, stdout, stderr });
    });
  });
}

const server = new McpServer({ name: "codex-bridge", version: "0.1.0" });

server.registerTool(
  "codex_exec",
  {
    title: "Run OpenAI Codex CLI",
    description:
      "自己完結した具体的なコーディングタスクを、ローカルにインストールされたOpenAI Codex CLI(`codex exec`)へ委譲して実行し、結果を返す。" +
      "このマシンに `codex` がインストール済みでログイン/認証済みであることが前提。呼び出しは完了かタイムアウトまでブロックする。",
    inputSchema: {
      prompt: z
        .string()
        .describe("Codexに実行させるタスクの指示文。曖昧さを避け、対象ファイルや期待する変更を具体的に書く"),
      cwd: z
        .string()
        .optional()
        .describe("作業ディレクトリの絶対パス（省略時はMCPサーバー起動時のディレクトリ）"),
      sandbox: z
        .enum(["read-only", "workspace-write", "danger-full-access"])
        .optional()
        .describe("Codexのサンドボックスモード（省略時はcodexのデフォルト設定に従う）"),
      full_auto: z
        .boolean()
        .optional()
        .describe("trueの場合 --full-auto を付与し、承認プロンプト無しで自動実行させる"),
      model: z
        .string()
        .optional()
        .describe("Codexに使わせるモデル名の上書き指定（省略時はcodexの既定モデル）"),
    },
  },
  async ({ prompt, cwd, sandbox, full_auto, model }) => {
    const result = await runCodex({
      prompt,
      cwd,
      sandbox,
      fullAuto: full_auto,
      model,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (result.spawnError) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              `codex CLIの起動に失敗しました: ${result.spawnError}\n` +
              `"${CODEX_BIN}" がPATHに通っているか、CODEX_MCP_BIN環境変数で正しい実行パスを指定しているか確認してください。`,
          },
        ],
      };
    }

    const parts = [];
    if (result.timedOut) parts.push(`[タイムアウト: ${DEFAULT_TIMEOUT_MS}msで強制終了しました]`);
    if (result.stdout.trim()) parts.push(result.stdout.trim());
    if (result.code !== 0) parts.push(`[exit code: ${result.code}]`);
    if (result.stderr.trim()) parts.push(`--- stderr ---\n${result.stderr.trim()}`);

    return {
      isError: !result.ok,
      content: [{ type: "text", text: parts.join("\n\n") || "(出力なし)" }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
