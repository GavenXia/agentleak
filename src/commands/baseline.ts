import pc from 'picocolors';
import {
  baselinePath,
  loadBaseline,
  markFingerprint,
  type BaselineStatus,
} from '../core/baseline.js';
import { humanizePath } from '../core/report.js';

export function runMark(fingerprint: string, status: BaselineStatus): number {
  const entry = markFingerprint(fingerprint, status);
  if (!entry) {
    console.error(`fingerprint not found in baseline: ${fingerprint}`);
    console.error(`run \`agentleak list\` to see known fingerprints`);
    return 2;
  }
  console.log(`marked ${fingerprint} (${entry.ruleId}) as ${pc.bold(status)}`);
  return 0;
}

export function runList(json: boolean): number {
  const baseline = loadBaseline();
  const entries = Object.entries(baseline.entries).sort((a, b) =>
    a[1].lastSeen < b[1].lastSeen ? 1 : -1,
  );
  if (json) {
    console.log(JSON.stringify({ baseline: baselinePath(), entries }, null, 2));
    return 0;
  }
  if (entries.length === 0) {
    console.log(
      `baseline is empty — run \`agentleak scan\` first (${humanizePath(baselinePath())})`,
    );
    return 0;
  }
  for (const [fp, e] of entries) {
    const status =
      e.status === 'rotated'
        ? pc.green('rotated')
        : e.status === 'false-positive'
          ? pc.dim('false-positive')
          : pc.red('open');
    console.log(
      `${fp}  ${status.padEnd(14)} ${e.ruleId}  ${e.count}×  last:${e.lastSeen.slice(0, 10)}`,
    );
  }
  return 0;
}
