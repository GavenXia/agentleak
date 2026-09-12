import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Finding } from './types.js';

export type BaselineStatus = 'open' | 'rotated' | 'false-positive';

export interface BaselineEntry {
  ruleId: string;
  severity: string;
  firstSeen: string;
  lastSeen: string;
  count: number;
  status: BaselineStatus;
}

export interface BaselineFile {
  version: 1;
  entries: Record<string, BaselineEntry>;
}

export function agentleakHome(): string {
  return process.env.AGENTLEAK_HOME ?? path.join(os.homedir(), '.agentleak');
}

export function baselinePath(): string {
  return path.join(agentleakHome(), 'baseline.json');
}

export function loadBaseline(): BaselineFile {
  const p = baselinePath();
  if (!existsSync(p)) return { version: 1, entries: {} };
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf8')) as BaselineFile;
    if (parsed && typeof parsed === 'object' && parsed.entries) return parsed;
  } catch {
    // corrupted baseline — start over rather than crash
  }
  return { version: 1, entries: {} };
}

export function saveBaseline(baseline: BaselineFile): void {
  const dir = agentleakHome();
  mkdirSync(dir, { recursive: true });
  writeFileSync(baselinePath(), JSON.stringify(baseline, null, 2) + '\n', 'utf8');
}

/** Annotate findings with new/known status and update the baseline in place. */
export function applyBaseline(findings: Finding[], baseline: BaselineFile): Finding[] {
  const now = new Date().toISOString();
  for (const f of findings) {
    const existing = baseline.entries[f.fingerprint];
    if (!existing) {
      f.isNew = true;
      f.baselineStatus = 'open';
      baseline.entries[f.fingerprint] = {
        ruleId: f.ruleId,
        severity: f.severity,
        firstSeen: now,
        lastSeen: now,
        count: 1,
        status: 'open',
      };
    } else {
      f.isNew = false;
      f.baselineStatus = existing.status;
      existing.lastSeen = now;
      existing.count += 1;
    }
  }
  return findings;
}

export function markFingerprint(
  fingerprint: string,
  status: BaselineStatus,
): BaselineEntry | undefined {
  const baseline = loadBaseline();
  const entry = baseline.entries[fingerprint];
  if (!entry) return undefined;
  entry.status = status;
  saveBaseline(baseline);
  return entry;
}
