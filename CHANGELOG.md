# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-12

### Added

- `scan` command: auto-discovery of local AI agent session stores — Claude
  Code (`projects/`, `history.jsonl`, `paste-cache/`), Codex CLI
  (`sessions/`, `history.jsonl`), Cursor (`state.vscdb`, best-effort),
  aider, GitHub Copilot CLI, project `.env*` / `.mcp.json`, Claude config
  files, plus ChatGPT / claude.ai exports via `--export`.
- Detection rules: 20 gitleaks-compatible TOML rules (cloud / LLM providers /
  code hosting / SaaS / PEM & JWT / entropy-gated generics) with severity and
  provider rotation links.
- Local baseline (`~/.agentleak/baseline.json`): fingerprint dedupe, NEW
  badge for first sightings, `mark --rotated|--false-positive|--open`,
  `list`.
- Masked-by-default reporting (human + `--json`), rotation checklist,
  `--reveal` opt-in for full values.
- `guard` command for agent hooks (stdin → exit 2 on secret) with Claude Code
  plugin (marketplace), Cursor rule, Codex/Gemini snippets and a generic
  agent skill.
- CI (macOS/Linux/Windows × Node 20/22/24), commitlint + husky, release
  workflow with provenance.

[Unreleased]: https://github.com/agentleak/agentleak/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/agentleak/agentleak/releases/tag/v0.1.0
