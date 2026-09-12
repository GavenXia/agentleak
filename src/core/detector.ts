import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'smol-toml';
import type { Finding, RuleDef, Severity, TextChunk } from './types.js';
import { maskSecret } from './mask.js';
import { looksRandom, shannonEntropy } from './entropy.js';

export function fingerprintOf(ruleId: string, value: string): string {
  return createHash('sha256').update(`${ruleId}:${value}`).digest('hex').slice(0, 16);
}

export function defaultRulesPath(): string {
  // dist/core/detector.js -> <pkg>/rules/default.toml
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', 'rules', 'default.toml');
}

function toSeverity(v: unknown): Severity {
  const s = String(v ?? 'medium').toLowerCase();
  if (s === 'critical' || s === 'high' || s === 'medium' || s === 'low' || s === 'info') {
    return s;
  }
  return 'medium';
}

export function loadRules(rulesPath: string): RuleDef[] {
  const raw = parse(readFileSync(rulesPath, 'utf8')) as Record<string, unknown>;
  const rulesRaw = (raw.rules ?? []) as Array<Record<string, unknown>>;
  return rulesRaw.map((r) => {
    const providerRaw = r.provider as { name?: string; revokeUrl?: string } | undefined;
    // JS RegExp has no inline flags; convert RE2-style (?i) to the 'i' flag.
    let pattern = String(r.regex);
    let flags = 'g';
    if (pattern.includes('(?i)')) {
      pattern = pattern.replaceAll('(?i)', '');
      flags += 'i';
    }
    return {
      id: String(r.id),
      description: String(r.description ?? r.id),
      regex: new RegExp(pattern, flags),
      keywords: ((r.keywords as string[] | undefined) ?? []).map((k) => k.toLowerCase()),
      minEntropy: typeof r.minEntropy === 'number' ? r.minEntropy : undefined,
      severity: toSeverity(r.severity),
      provider:
        providerRaw?.name && providerRaw.revokeUrl
          ? { name: providerRaw.name, revokeUrl: providerRaw.revokeUrl }
          : undefined,
    } satisfies RuleDef;
  });
}

/** Scan one chunk of text against all rules. */
export function detectInChunk(chunk: TextChunk, rules: RuleDef[]): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  const lowerText = rules.some((r) => r.keywords.length > 0) ? chunk.text.toLowerCase() : undefined;

  for (const rule of rules) {
    if (
      rule.keywords.length > 0 &&
      lowerText &&
      !rule.keywords.some((k) => lowerText.includes(k))
    ) {
      continue;
    }
    for (const m of chunk.text.matchAll(rule.regex)) {
      const value = m[0];
      if (!value || value.length < 8) continue;
      if (rule.minEntropy !== undefined) {
        if (shannonEntropy(value) < rule.minEntropy || !looksRandom(value)) continue;
      }
      const fingerprint = fingerprintOf(rule.id, value);
      const key = `${fingerprint}:${chunk.file}:${chunk.line ?? 0}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        description: rule.description,
        value,
        masked: maskSecret(value),
        fingerprint,
        chunk,
      });
    }
  }
  return findings;
}
