---
name: agentleak
description: Scan the user's local AI agent chat sessions for leaked secrets (API keys, SSH keys, tokens) and produce a masked rotation checklist. Use when the user asks whether they leaked keys into chats, wants to audit session history, or mentions relay/proxy (中转站) key-leak concerns.
---

# agentleak — session secret audit

`agentleak` is a fully offline CLI that discovers and scans local AI agent session
stores (Claude Code, Codex CLI, Cursor, aider, Copilot CLI, web-chat exports) for
secrets pasted into conversations, and maintains a local baseline so repeated
scans only report NEW findings.

## When to use

- The user asks "did I leak any keys into chats/sessions?"
- The user used an API relay (中转站) or untrusted endpoint and wants an audit.
- The user wants a rotation checklist for exposed credentials.
- Periodic hygiene check requested.

## Commands

```bash
# 1. Scan everything (masked by default; exit 1 if findings exist)
agentleak scan

# 2. Include an official ChatGPT / claude.ai data export
agentleak scan --export ~/Downloads/chatgpt-export.zip

# 3. Machine-readable output for reports
agentleak scan --json

# 4. After the user rotates a credential
agentleak mark <fingerprint> --rotated

# 5. Suppress a false positive
agentleak mark <fingerprint> --false-positive
```

## Rules for you (the agent)

- NEVER ask the user to paste a secret into this chat to "check" it — that is
  the exact behavior this tool exists to prevent.
- Report findings using the masked values (`sk-ant-a…9f2Q`) from the output.
- Guide the user through the printed rotation checklist, most severe first.
- `--reveal` exists but do not run it unless the user explicitly asks; prefer
  pointing them to the file:line shown in the report instead.
- The tool never makes network requests; findings are heuristic (regex +
  entropy). Say so when presenting results.
