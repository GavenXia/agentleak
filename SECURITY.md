# Security Policy

## The short version

agentleak is an **offline** secret scanner. It never makes network requests,
never sends your data anywhere, and stores its baseline (SHA-256 fingerprints
of _your_ findings) only in `~/.agentleak/`.

## Trust boundaries

- **What the tool reads**: local agent session files, agent config files, and
  `.env`-style project files you point it at (via discovery from your cwd).
- **What the tool writes**: `~/.agentleak/baseline.json` and stdout/stderr.
- **What the tool sends**: nothing. There is no code path to the network.

## Reporting a vulnerability

If you find a security issue in agentleak itself (e.g. a malicious session
file that exploits a parser, path traversal in discovery, output that leaks
secrets despite masking), please report it privately:

1. Open a GitHub Security Advisory (“Report a vulnerability” tab), or
2. email the maintainers (see the CODEOWNERS/README for contact).

Please do **not** open a public issue with exploit details. We aim to respond
within 72 hours.

**Never paste real secrets into issues, even to demonstrate a bug.** Use the
masked output — that is what it is for.

## Handling of secrets

- Full secret values exist in process memory only for the duration of a scan.
- `--json` output masks values unless `--reveal` is passed, the same as the
  human report.
- The baseline stores only truncated SHA-256 fingerprints + rule metadata —
  not the secret values themselves.

## Scope / non-goals

- We do not verify keys against providers (no network). Findings are
  heuristics: treat them as “rotate and check”, not proof of compromise.
- Files with weak permissions on `~/.agentleak/` are your OS's concern; we
  create the directory with default perms only.
