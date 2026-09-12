# agentleak

**Find the secrets you already leaked into AI chat sessions — before someone else does.**

`agentleak` discovers every local AI-agent conversation store on your machine
(Claude Code, Codex CLI, Cursor, aider, Copilot CLI, web-chat exports), scans it
for API keys / SSH keys / tokens, and turns the findings into a **rotation
checklist** with a local baseline so you only ever see _new_ leaks.

It is **100% offline**: no telemetry, no network calls, no accounts. The rules
are regex + entropy — the same approach as gitleaks, applied to the chat logs
nobody else scans.

[![CI](https://github.com/agentleak/agentleak/actions/workflows/ci.yml/badge.svg)](https://github.com/agentleak/agentleak/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/agentleak)](https://www.npmjs.com/package/agentleak)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

[中文文档](README.zh-CN.md)

## Why

- Relay services (“API 中转站”) resell conversation logs; a key pasted into one
  chat has been observed propagating to 1,100+ public datasets (Truffle Security).
- Agent CLIs store full transcripts on disk, unencrypted, forever: prompts,
  pasted files, tool outputs.
- Existing secret scanners target git repos. Enterprise AI-DLP targets gateway
  traffic. **Nobody inventories what already sits in your local sessions** —
  that is the entire job of this tool.

## Install

```bash
npm install -g agentleak
# or run once:
npx agentleak scan
```

Requires Node ≥ 20. Works on macOS, Linux, Windows.

## Quick start

```bash
$ agentleak scan

agentleak v0.1.0 — scanned 412 files (81.3 MB) across 7 sources

5 finding(s) · 2 NEW · 1 critical, 3 high, 1 medium

  CRITICAL aws-access-key   AKIAIOSF…7EXAMPLE  NEW
    where:  2026-08-14 14:02 · Claude Code
            ~/.claude/projects/-home-dev-api/session-3f9c.jsonl:412
    rotate: AWS IAM → https://console.aws.amazon.com/iam/

Rotation checklist
  1. [critical] AWS IAM (1) → https://console.aws.amazon.com/iam/
  2. [high] Anthropic (2) → https://console.anthropic.com/settings/keys
  ...
```

After rotating a credential: `agentleak mark <fingerprint> --rotated`.
False positive: `agentleak mark <fingerprint> --false-positive` (hidden from
future scans; `--all` shows everything).

## What it scans

| Source                           | Where                                                    | Mode        |
| -------------------------------- | -------------------------------------------------------- | ----------- |
| Claude Code                      | `~/.claude/projects/**`, `history.jsonl`, `paste-cache/` | precise     |
| Codex CLI                        | `~/.codex/sessions/**`, `history.jsonl`                  | precise     |
| ChatGPT export                   | `--export export.zip` → `conversations.json`             | precise     |
| claude.ai export                 | `--export export.json`                                   | precise     |
| Cursor                           | `state.vscdb` (SQLite)                                   | best-effort |
| aider                            | `.aider.chat.history.md` in the project                  | best-effort |
| GitHub Copilot CLI               | `~/.copilot/session-state/**`                            | best-effort |
| Project files                    | `.env*`, `.mcp.json` (they get read into context)        | precise     |
| Claude config                    | `~/.claude.json`, `~/.claude/settings.json` (MCP keys)   | precise     |
| Windsurf / Continue / Gemini CLI | detected, parser on the roadmap                          | report-only |

Well-known credential stores (`~/.codex/auth.json`) are **not** reported as
leaks — that is where keys are supposed to live.

## Commands

```
agentleak scan [--reveal] [--json] [--export <path>] [--path <dir>]
               [--rules <file>] [--no-baseline] [--all] [--exit-zero]
agentleak mark <fingerprint> --rotated|--false-positive|--open
agentleak list [--json]
agentleak guard [--rules <file>]   # stdin → exit 2 if a secret is found
```

`scan` exits `1` when findings exist (cron/CI friendly); `--exit-zero` disables
that. Output is **masked by default** — safe to screenshot. `--reveal` prints
full values.

## Agent integrations

See [integrations/](integrations/README.md):

- **Claude Code plugin** (marketplace): skill + `UserPromptSubmit` hook that
  blocks prompts containing secrets before they are sent.
- **Cursor rule**, **Codex CLI hook**, **Gemini CLI** snippets.
- A generic `SKILL.md` for any agent runtime that loads skills.

## Security promises

1. **Never online.** The tool makes zero network requests. There is no
   telemetry, no update check, no “verification API”.
2. **No third-party rules.** Rules are hand-curated here (MIT). We do not
   import AGPL-licensed detector sets.
3. **Masked by default.** Full secret values appear only with an explicit
   `--reveal`.
4. Verification of keys against providers, if ever added, will be opt-in,
   local, direct-to-provider, and default-off.

If you find a security issue in agentleak itself, see [SECURITY.md](SECURITY.md).

## Limitations (honest ones)

- Detection is heuristic (regex + Shannon entropy). Expect some false
  positives — mark them; expect rare false negatives — rotate anything that
  ever touched a chat.
- Cursor support reads a raw SQLite dump; file-level locations only.
- Encrypted stores, enterprise gateway logs and cloud-hosted sessions are out
  of scope by design — local forensics only.

## Roadmap

- [ ] Windsurf / Continue / Gemini CLI parsers
- [ ] Clipboard watcher (opt-in) to warn before pasting secrets into web chats
- [ ] Rule-pack imports from gitleaks-format TOML
- Not planned: browser extension, cloud sync, key verification by default

## Acknowledgements

- [DidILeak](https://github.com/frangelbarrera/DidILeak) — the closest prior
  tool; agentleak adds auto-discovery, a baseline and agent integrations.
- [gitleaks](https://github.com/gitleaks/gitleaks) — rules file format
  compatibility (MIT).
- [Truffle Security](https://trufflesecurity.com/blog/scanning-7-6-petabytes-of-ai-training-data-for-secrets)
  — research quantifying secrets leaking through AI chats.

## License

[MIT](LICENSE)
