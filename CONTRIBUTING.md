# Contributing to agentleak

Thanks for helping make agent sessions less leaky. This project is small on
purpose — read the boundaries before opening a PR.

## Ground rules (non-negotiable)

1. **The scanner stays offline.** No feature may add a network call at scan
   time. No telemetry. No “phone home”. Ever.
2. **No real secrets in the repo.** Tests and fixtures use example values
   (`AKIAIOSFODNN7EXAMPLE`, `ghp_…ascz`). CI will reject obvious real keys.
3. **No AGPL code.** We do not copy TruffleHog detectors or any AGPL-licensed
   rule sets. gitleaks (MIT) format compatibility is fine.
4. **Masked by default.** Any new output surface must mask secret values
   unless explicitly revealed.

## Development setup

```bash
git clone https://github.com/agentleak/agentleak
cd agentleak
npm install
npm test          # vitest
npm run dev -- scan   # run the CLI from source
```

Quality gates (all must pass locally and in CI):

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Architecture map

```
src/
  cli.ts               commander entry; thin, no logic
  commands/            one file per command (scan / guard / baseline)
  core/
    types.ts           shared types (TextChunk, Finding, RuleDef, …)
    discover.ts        auto-discovery of local session stores
    detector.ts        rule loading (TOML) + regex/entropy matching
    baseline.ts        local fingerprint store (~/.agentleak/baseline.json)
    report.ts          human + JSON rendering, rotation checklist
    entropy.ts mask.ts
  parsers/             one parser per storage format → TextChunk[]
rules/default.toml     detection rules (gitleaks-compatible superset)
integrations/          Claude Code plugin, Cursor rule, skills
test/                  vitest + fixtures
```

Adding a new agent = one entry in `discover.ts` + (if the format is structured)
one parser in `parsers/`. Keep parsers dumb: they emit `TextChunk`s and never
do detection.

## Adding detection rules

Edit `rules/default.toml` (gitleaks-style TOML with `severity` and a
`[rules.provider]` rotation table as our extensions). Every rule needs:

- a test in `test/detector.test.ts` with an example value,
- a **false-positive guard test** (something similar that must NOT match).

Entropy-gate generic rules (`minEntropy`) — precision beats recall for the
top-20; the generic fallbacks cover the tail.

## Commit messages (Conventional Commits)

We use [Conventional Commits](https://www.conventionalcommits.org/) enforced by
commitlint:

```
feat(parsers): add Windsurf cascade support
fix(detector): anchor OpenAI regex to avoid matching sk-ant keys
docs(readme): document --export flag in both languages
chore(ci): add windows to the test matrix
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`, `ci`.
Scopes: `parsers`, `detector`, `discover`, `baseline`, `report`, `cli`, `rules`,
`integrations`, `ci`, `docs`, `deps`.

Husky runs lint-staged on commit and commitlint on commit-msg. `npm run
format` before pushing if prettier complains.

## Pull requests

- Keep PRs single-purpose.
- User-facing changes update **both** `README.md` and `README.zh-CN.md`.
- New sources of secrets → add to the README support matrix.
- Follow the PR template checklist.

## Releasing (maintainers)

1. `npm run build && npm test`
2. bump `version` in `package.json`
3. update `CHANGELOG.md`
4. `git commit -m "chore(release): vX.Y.Z"` and tag `vX.Y.Z`
5. push — the release workflow publishes to npm with provenance
