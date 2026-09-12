import { beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  applyBaseline,
  loadBaseline,
  markFingerprint,
  saveBaseline,
} from '../src/core/baseline.js';
import { fingerprintOf } from '../src/core/detector.js';
import type { Finding } from '../src/core/types.js';

function fakeFinding(ruleId: string, value: string): Finding {
  return {
    ruleId,
    severity: 'high',
    description: ruleId,
    value,
    masked: 'xxx…xxx',
    fingerprint: fingerprintOf(ruleId, value),
    chunk: {
      text: '',
      tool: 'test',
      sourceCategory: 'session',
      file: '/tmp/x',
    },
  };
}

beforeEach(() => {
  process.env.AGENTLEAK_HOME = mkdtempSync(path.join(os.tmpdir(), 'agentleak-test-'));
});

describe('baseline', () => {
  it('marks first sightings as new and repeats as known', () => {
    const baseline = loadBaseline();
    const first = applyBaseline([fakeFinding('aws-access-key', 'AKIAIOSFODNN7EXAMPLE')], baseline);
    expect(first[0]?.isNew).toBe(true);

    const second = applyBaseline([fakeFinding('aws-access-key', 'AKIAIOSFODNN7EXAMPLE')], baseline);
    expect(second[0]?.isNew).toBe(false);
    expect(second[0]?.baselineStatus).toBe('open');
  });

  it('persists mark --rotated', () => {
    const baseline = loadBaseline();
    const f = fakeFinding('github-token', 'ghp_abc');
    applyBaseline([f], baseline);
    saveBaseline(baseline);

    const marked = markFingerprint(f.fingerprint, 'rotated');
    expect(marked?.status).toBe('rotated');

    const reloaded = loadBaseline();
    expect(reloaded.entries[f.fingerprint]?.status).toBe('rotated');
  });

  it('keeps rotated flag visible when secret is still present', () => {
    const baseline = loadBaseline();
    const f = fakeFinding('npm-token', 'npm_x');
    applyBaseline([f], baseline);
    baseline.entries[f.fingerprint]!.status = 'rotated';
    const again = applyBaseline([f], baseline);
    expect(again[0]?.baselineStatus).toBe('rotated');
  });
});
