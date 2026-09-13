<div align="center">

# agentleak

**Find the secrets you already leaked into AI chat sessions — before someone else does.**

[![CI](https://github.com/GavenXia/agentleak/actions/workflows/ci.yml/badge.svg)](https://github.com/GavenXia/agentleak/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/agentleak)](https://www.npmjs.com/package/agentleak)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A520-339933)](package.json)
[![offline](https://img.shields.io/badge/network-0%20calls-2ea44f)](SECURITY.md)

An offline, local-first CLI that discovers **every AI-agent conversation store on your
machine**, scans it for API keys / SSH keys / tokens, and turns the findings into a
**rotation checklist** — with a persistent baseline so you only ever see _new_ leaks.

[Quick start](#-quick-start) · [How it works](#-how-it-works) · [Agent integrations](#-install-per-agent) · [Security promises](#️-security--trust)

[中文文档](README.zh-CN.md)

</div>

---

## 🚨 The problem

**Your AI agent chats are a credential leak you have never audited.**

Every time you (or a teammate) pasted an API key into a chat — "here, use this token
to deploy" — that secret was written to disk in plaintext, unencrypted, often forever:

```text
~/.claude/projects/**/session-*.jsonl    # full Claude Code transcripts
~/.codex/sessions/**/*.jsonl             # full Codex CLI transcripts
~/Library/Application Support/Cursor/    # chat bodies in SQLite
~/.claude/paste-cache/*.txt              # raw pasted blobs
```

Meanwhile, the blast radius of any single paste keeps growing:

| Fact                                                                                                                                                                                                                             | Source                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| One Infura key pasted into **a single ChatGPT conversation** was captured by WildChat and propagated to **1,131 public datasets**                                                                                                | [Truffle Security, scanning 7.6 PB of AI training data](https://trufflesecurity.com/blog/scanning-7-6-petabytes-of-ai-training-data-for-secrets) |
| 221,303 **live** credentials found in 6,003 public AI datasets                                                                                                                                                                   | same research                                                                                                                                    |
| A researcher bought **6 TB of LLM-relay invocation logs** and found SSH keys, VPN configs, Alibaba Cloud keys and GitLab tokens — claiming access to 19 major companies (Huawei, Xiaomi, NIO…) and 7 government-related agencies | [Chaofan Shou (Fuzzland), Sept 2026](https://x.com/shoucccc/status/2098169782541631871) (reported claim)                                         |
| China state media & the Ministry of State Security publicly warned that API relay services (“中转站”) leak and resell user conversations                                                                                         | [Xinhua / MSS advisories, 2026](https://app.xinhuanet.com/news/article.html?articleId=20260608081c2c78593d4394b46b0cf31bec0a4f)                  |
| Academic measurement of 400+ relay sites: 45% swap in fake models, **17% steal test credentials**, 9 inject malware                                                                                                              | [relay-risk study](https://getgptplus.app/blog/api-relay-risks)                                                                                  |
| Stolen AI keys are resold at 97.8% off ($3,333 of credit for $0.13) on a shadow market                                                                                                                                           | [CSA research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-llm-api-relay-market-shadow-risk-20260729/)                |
| Leaked AI credentials are exploited **within minutes** of public exposure                                                                                                                                                        | Lasso Security                                                                                                                                   |
| Agent vendors still ship no built-in secret redaction for stored conversations                                                                                                                                                   | [claude-code#29434](https://github.com/anthropics/claude-code/issues/29434) (open)                                                               |

Existing tools don't cover this surface: secret scanners (gitleaks & co.) target git
repos; enterprise AI-DLP targets gateway traffic. **Nobody inventories what already
sits in your local sessions.** That is agentleak's entire job.

## 🔍 How it works

```text
 ┌──────────┐   ┌────────────┐   ┌──────────────┐   ┌──────────┐   ┌───────────────┐
 │ DISCOVER │ → │   PARSE    │ → │   DETECT     │ → │ BASELINE │ → │     REPORT    │
 │ walk all │   │ per-format │   │ 20 rules:    │   │ SHA-256  │   │ masked values │
 │ agent    │   │ parsers →  │   │ regex +      │   │ finger-  │   │ + rotation    │
 │ session  │   │ text       │   │ Shannon      │   │ prints → │   │ checklist +   │
 │ stores   │   │ chunks     │   │ entropy      │   │ NEW only │   │ --json        │
 └──────────┘   └────────────┘   └──────────────┘   └──────────┘   └───────────────┘
                       everything runs offline, in one process, in seconds
```

- **Discovery** knows where each agent keeps its transcripts (paths per OS), so you
  never point it at files manually.
- **Parsers** understand the actual formats (Claude JSONL, Codex envelopes, Cursor
  SQLite, ChatGPT export trees…), so findings point at _the message that leaked_,
  not just a file.
- **Detection** uses gitleaks-compatible TOML rules (regex + entropy gating), each
  carrying a severity and a provider **rotation link**. Precision is tuned to keep
  false positives low; anything marked `--false-positive` disappears from future runs.
- **Baseline** stores truncated SHA-256 fingerprints (never the secrets) in
  `~/.agentleak/baseline.json`, so a re-scan prints only what changed.
- **Reporting** masks every value (`sk-ant-a…9f2Q`) so output is safe to paste into
  issues, chats and screenshots. `--reveal` shows full values when you need them.

> Why not just run gitleaks over your home directory? You can — if you enumerate the
> right paths, parse the formats yourself, dedupe across re-scans, and look up every
> rotation URL by hand. agentleak is that workflow, done once, properly.

## ⚡ Quick start

Zero config, one command, nothing to install permanently:

```bash
npx agentleak scan
```

Real first-run output (values masked by default):

```text
agentleak v0.1.0 — scanned 477 files (1745.7 MB) across 8 sources
credential stores (expected locations, not reported): ~/.codex/auth.json

93 finding(s) · 31 NEW · 6 high, 1 medium, 86 low

  HIGH     github-token  ghp_1fPh…xghU NEW
    where:  2026-08-25 09:22 · Claude Code
            ~/.claude/projects/…/fbe5b217-….jsonl:198
    rotate: GitHub → https://github.com/settings/tokens

Rotation checklist
  1. [high] GitHub (2) → https://github.com/settings/tokens
  ...
```

Then act on it:

```bash
agentleak mark <fingerprint> --rotated          # after you rotate a credential
agentleak mark <fingerprint> --false-positive   # silence a false hit
agentleak list                                  # audit what's known
```

`scan` exits `1` when findings exist — cron/CI friendly (`--exit-zero` to disable).
Add web-chat history with `agentleak scan --export ~/Downloads/chatgpt-export.zip`.

## 📦 What it scans

| Source                           | Location                                                 | Mode                    |
| -------------------------------- | -------------------------------------------------------- | ----------------------- |
| Claude Code                      | `~/.claude/projects/**`, `history.jsonl`, `paste-cache/` | precise (message-level) |
| Codex CLI                        | `~/.codex/sessions/**`, `history.jsonl`                  | precise                 |
| ChatGPT export                   | `--export export.zip` → `conversations.json`             | precise                 |
| claude.ai export                 | `--export export.json`                                   | precise                 |
| Cursor                           | `state.vscdb` SQLite (read-only copy)                    | best-effort             |
| aider                            | `.aider.chat.history.md` in the project                  | best-effort             |
| GitHub Copilot CLI               | `~/.copilot/session-state/**`                            | best-effort             |
| Project files                    | `.env*`, `.mcp.json` (they get read into context)        | precise                 |
| Claude config                    | `~/.claude.json`, `~/.claude/settings.json` (MCP keys)   | precise                 |
| Windsurf / Continue / Gemini CLI | detected → reported as “not yet supported”               | report-only             |

Well-known credential stores (`~/.codex/auth.json`) are **never** reported as leaks —
that is where keys are supposed to live.

## 🤖 Install per agent

The same offline binary powers every integration. Install it once:

```bash
npm install -g agentleak
```

### Claude Code

```bash
# from the plugin marketplace (skill + UserPromptSubmit guard hook)
claude plugin marketplace add GavenXia/agentleak
claude plugin install agentleak@agentleak
```

Or wire the guard hook manually in `~/.claude/settings.json` — every prompt is
checked _before_ it is sent; prompts containing secrets are blocked (exit 2):

```json
{
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "agentleak guard" }] }]
  }
}
```

### Cursor

```bash
cp integrations/cursor/rules/agentleak.mdc  <your-project>/.cursor/rules/
```

The rule teaches the agent to never ask you for secrets and to run audits on
request. (Cursor has no official prompt hook yet — the rule is advisory.)

### Codex CLI

```bash
# prompt guidance
cat integrations/codex/AGENTS.md >> ~/.codex/AGENTS.md

# pre-send blocking (Codex CLI ≥ v0.117): ~/.codex/hooks.json
# { "UserPromptSubmit": [{ "command": "agentleak guard" }] }
```

### Gemini CLI

```bash
cat integrations/gemini/GEMINI.md >> ~/.gemini/GEMINI.md
```

### Any other agent

- Generic skill: copy `integrations/agents/skill/` into your skills directory.
- Any tool that can run a command before sending:

```bash
echo "<prompt>" | agentleak guard   # exit 0 = clean · exit 2 = secret found
```

## 📖 CLI reference

```
agentleak scan [--reveal] [--json] [--export <path>] [--path <dir>]
               [--rules <file>] [--no-baseline] [--all] [--exit-zero]
agentleak mark <fingerprint> --rotated|--false-positive|--open
agentleak list [--json]
agentleak guard [--rules <file>]
```

| Exit code | Meaning                                  |
| --------- | ---------------------------------------- |
| `0`       | clean (guard: prompt contains no secret) |
| `1`       | scan found findings                      |
| `2`       | error · guard: prompt contains a secret  |

Custom rules: any gitleaks-style TOML, plus our `severity` and `[rules.provider]`
rotation extensions — see [rules/default.toml](rules/default.toml).

## 🛡️ Security & trust

A secret scanner is only useful if you can trust it with your secrets. Four
non-negotiable promises (enforced in code review, details in
[SECURITY.md](SECURITY.md)):

1. **Never online.** Zero network calls — no telemetry, no update checks, no
   “verification API”. Nothing in `dist/` can emit a request.
2. **No third-party rule sets.** Rules are hand-curated in this repo (MIT). We do
   not import AGPL-licensed detector collections.
3. **Masked by default.** Full secret values only ever appear behind an explicit
   `--reveal`. The baseline stores SHA-256 fingerprints, never values.
4. **Reads are scoped.** It reads agent session/config stores and `.env`-style
   files under your working directory; it writes exactly one file
   (`~/.agentleak/baseline.json`).

Found a security issue in agentleak itself? Please use private vulnerability
reporting — never paste real secrets into issues.

## ⚠️ Honest limitations

- Detection is heuristic (regex + entropy): expect occasional false positives
  (mark them) and rare false negatives (rotate anything that ever touched a chat).
- Cursor findings are file-level, not message-level (raw SQLite dump).
- Encrypted stores, enterprise gateway logs and cloud-hosted sessions are out of
  scope — local forensics only.

## 🗺️ Roadmap

- [ ] Windsurf / Continue / Gemini CLI parsers
- [ ] Opt-in clipboard watcher to warn before pasting secrets into web chats
- [ ] Rule-pack import from any gitleaks-format TOML
- **Not planned**: browser extension, cloud sync, online key verification by default

## 🙏 Acknowledgements

- [DidILeak](https://github.com/frangelbarrera/DidILeak) — closest prior tool;
  agentleak adds auto-discovery, a baseline and agent integrations.
- [gitleaks](https://github.com/gitleaks/gitleaks) — rule format compatibility (MIT).
- [Truffle Security](https://trufflesecurity.com/blog/scanning-7-6-petabytes-of-ai-training-data-for-secrets) —
  the research that quantified secrets leaking through AI chats.

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=GavenXia/agentleak&type=Date)](https://star-history.com/#GavenXia/agentleak&Date)

## License

[MIT](LICENSE)
