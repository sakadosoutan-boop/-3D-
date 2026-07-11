---
name: codex-connect
description: Set up and verify the OpenAI Codex CLI MCP integration (`mcp__codex__codex` / `mcp__codex__codex-reply`) for this repo. Use when the user asks to connect/set up/enable Codex, "Codexと連携して", "Codexを使えるようにして", or when a Codex tool call fails because the CLI is missing or not authenticated (common in a fresh container/session).
---

# Codex MCP Connect

Get from a fresh container to a working `mcp__codex__codex` tool call in one pass.
This repo's `.mcp.json` already configures `codex mcp-server` as an MCP server —
what's usually missing in a new session is the CLI binary and/or its auth token,
since both live only inside the (ephemeral) container filesystem.

Make a todo list for the steps below and work through them in order.

## 1. Check if it's already working

Try `ToolSearch` for `select:mcp__codex__codex`. If it loads and a quick test
call succeeds (step 5), you're done — report that and stop.

## 2. Confirm `.mcp.json`

Repo root must have:

```json
{
  "mcpServers": {
    "codex": {
      "type": "stdio",
      "command": "codex",
      "args": ["mcp-server"]
    }
  }
}
```

Create/fix it if missing (see `CODEX_MCP_SETUP.md` for background).

## 3. Ensure the CLI is installed

```bash
codex --version || npm install -g @openai/codex
```

## 4. Ensure it's authenticated

```bash
codex login status
```

If not logged in, this **requires the user's own OpenAI/ChatGPT account** —
you cannot complete it on their behalf. Run the device-auth flow and hand the
user the code:

```bash
codex login --device-auth &
```

Read the backgrounded process's output for the URL (`https://auth.openai.com/codex/device`)
and one-time code, relay both to the user, and wait for their confirmation
(e.g. via `AskUserQuestion`) before checking `codex login status` again. Do
not use a short `timeout` on the login command — it must stay alive while the
user completes the browser step, or the device code is wasted and you'll need
a fresh one.

Note network reachability first if login/status calls return 403/407 instead
of an auth prompt — that's an egress-policy block, not an auth problem; see
`/root/.ccr/README.md`. Do not work around it; report the blocked host.

## 5. Verify end-to-end

Call the tool directly:

```
mcp__codex__codex(prompt="Reply with exactly: CODEX_OK", sandbox="read-only", approval-policy="never")
```

Confirm the response content is exactly `CODEX_OK`.

## 6. Report

Tell the user what was missing and fixed (CLI install / login / nothing), and
that auth lives in `~/.codex/auth.json` inside this container — a brand-new
container/environment will need step 4 again, but the same running session
does not.
