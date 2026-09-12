---
name: agentleak
description: Audit local AI agent chat sessions for leaked secrets (API keys, SSH keys, tokens) and produce a rotation checklist. Fully offline. Use when the user worries about keys leaked via chats or API relays (中转站).
---

# agentleak

A generic agent skill — works with any agent runtime that loads `SKILL.md`
files (drop this directory into your skills folder, e.g. `~/.agents/skills/`).

## What it does

Runs the `agentleak` CLI to discover and scan local AI agent session stores for
secrets pasted into conversations:

- Claude Code (`~/.claude/projects`, `history.jsonl`, `paste-cache`)
- Codex CLI (`~/.codex/sessions`)
- Cursor (`state.vscdb`, best-effort)
- aider, GitHub Copilot CLI, project `.env` / `.mcp.json`
- ChatGPT / claude.ai official data exports via `--export`

## Usage

```bash
npx agentleak scan                 # masked report + rotation checklist
npx agentleak scan --json          # machine-readable
npx agentleak mark <fp> --rotated  # after rotating a credential
```

## Agent instructions

- Never ask the user to paste a secret into the chat to verify it.
- Present findings with masked values only.
- Walk the user through the rotation checklist, most severe first.
- The scanner is offline and heuristic — say so when presenting results.
