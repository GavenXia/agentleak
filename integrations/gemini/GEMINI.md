# agentleak integration for Gemini CLI

Append this to `~/.gemini/GEMINI.md`:

```markdown
## Secret hygiene

- Never ask the user to paste API keys, SSH keys or tokens into the prompt.
- If you notice a secret in the conversation, warn the user and suggest rotation.
- Audit local agent sessions with: `npx agentleak scan` (offline, masked).
```

For pre-send blocking, wire `agentleak guard` into a `BeforeAgent` hook in
`~/.gemini/settings.json` (see the Gemini CLI hooks documentation); the command
reads the prompt on stdin and exits non-zero when a secret is detected.
