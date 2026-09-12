import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defaultRulesPath, detectInChunk, loadRules } from '../core/detector.js';
import { maskSecret } from '../core/mask.js';
import type { TextChunk } from '../core/types.js';

/**
 * Hook/automation mode: read a prompt from stdin, fail closed if it contains secrets.
 * Accepts raw text or the hook JSON envelope ({ prompt: "..." }).
 * Exit codes: 0 = clean, 2 = secret detected (Claude Code / Codex hook "block" contract).
 */
export function runGuard(rulesFlag?: string): number {
  let raw: string;
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    console.error('[agentleak] guard: no input on stdin');
    return 2;
  }

  let text = raw;
  try {
    const parsed = JSON.parse(raw) as { prompt?: unknown };
    if (parsed && typeof parsed.prompt === 'string') text = parsed.prompt;
  } catch {
    // raw text — fine
  }

  const chunk: TextChunk = {
    text,
    tool: 'stdin',
    sourceCategory: 'session',
    file: '<stdin>',
  };
  const rules = loadRules(rulesFlag ? path.resolve(rulesFlag) : defaultRulesPath());
  const findings = detectInChunk(chunk, rules);
  if (findings.length === 0) return 0;

  const lines = findings.slice(0, 5).map((f) => `  - ${f.ruleId}: ${maskSecret(f.value)}`);
  console.error(
    `[agentleak] blocked: this prompt contains ${findings.length} secret(s):\n${lines.join('\n')}\n` +
      `Remove/redact them, or run \`agentleak scan\` to see where they came from.`,
  );
  return 2;
}
