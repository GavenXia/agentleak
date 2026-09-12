# agentleak integration for Codex CLI

Append this to `~/.codex/AGENTS.md` (global) or a project `AGENTS.md`:

```markdown
## Secret hygiene

- Never ask the user to paste API keys, SSH keys or tokens into the prompt.
- If you notice a secret in the conversation, warn the user and suggest rotation.
- Audit local agent sessions with: `npx agentleak scan` (offline, masked).
```

## Prompt guard hook (Codex CLI ≥ v0.117)

Add to `~/.codex/hooks.json` so prompts containing secrets are blocked before
being sent:

```json
{
  "UserPromptSubmit": [
    {
      "command": "agentleak guard"
    }
  ]
}
```

`agentleak guard` reads the prompt on stdin and exits `2` (block) when it
detects a secret.
