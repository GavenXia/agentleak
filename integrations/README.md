# Integrations

Ways to run agentleak from inside your AI agent. All of them call the same
offline CLI — no component here makes network requests.

## Claude Code plugin (marketplace)

```bash
claude plugin marketplace add agentleak/agentleak
claude plugin install agentleak@agentleak
```

This installs:

- a **skill** (`agentleak`) the agent can invoke to audit your sessions, and
- a **UserPromptSubmit hook** that pipes every prompt through `agentleak guard`
  and blocks it (exit 2) when it contains a secret.

Requires `agentleak` on `PATH` (`npm install -g agentleak`).

## Cursor rule

Copy `cursor/rules/agentleak.mdc` into your project's `.cursor/rules/` — the
agent will refuse to ask you for secrets and can run audits on request.

## Codex CLI

- Prompt guidance: append `codex/AGENTS.md` to `~/.codex/AGENTS.md`.
- Pre-send blocking: add the `UserPromptSubmit` hook (Codex CLI ≥ v0.117) shown
  in that file to `~/.codex/hooks.json`.

## Gemini CLI

- Prompt guidance: append `gemini/GEMINI.md` to `~/.gemini/GEMINI.md`.

## Generic agents (any SKILL.md-compatible runtime)

Copy `agents/skill/` into your skills directory (e.g. `~/.agents/skills/`).

## Manual hook (any tool that can run a command)

```bash
echo "<prompt text>" | agentleak guard   # exit 0 = clean, exit 2 = secret found
```
