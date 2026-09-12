import { statSync } from 'node:fs';
import path from 'node:path';
import { discover } from '../core/discover.js';
import { parseSource } from '../parsers/index.js';
import { defaultRulesPath, detectInChunk, loadRules } from '../core/detector.js';
import { applyBaseline, baselinePath, loadBaseline, saveBaseline } from '../core/baseline.js';
import { renderReport, jsonReport } from '../core/report.js';
import type { ReportContext } from '../core/report.js';
import type { Finding, ScanOptions } from '../core/types.js';

export interface ScanCliFlags {
  reveal: boolean;
  json: boolean;
  export?: string;
  path?: string;
  rules?: string;
  baseline: boolean;
  all: boolean;
  exitZero: boolean;
}

export function runScan(flags: ScanCliFlags): number {
  const cwd = flags.path ? path.resolve(flags.path) : process.cwd();
  if (flags.export && !exists(flags.export)) {
    console.error(`--export path not found: ${flags.export}`);
    return 2;
  }

  const rules = loadRules(flags.rules ? path.resolve(flags.rules) : defaultRulesPath());
  const { sources, detectedOnly, skippedStores } = discover(cwd, flags.export);

  const chunks = [];
  const errors: Array<{ file: string; error: string }> = [];
  let filesScanned = 0;
  let bytesScanned = 0;
  for (const source of sources) {
    const outcome = parseSource(source);
    chunks.push(...outcome.chunks);
    errors.push(...outcome.errors);
    filesScanned += source.files.length;
    bytesScanned += source.files.reduce((n, f) => n + sizeOf(f), 0);
  }

  const findings: Finding[] = [];
  for (const chunk of chunks) {
    findings.push(...detectInChunk(chunk, rules));
  }

  const opts: ScanOptions = {
    cwd,
    exportPath: flags.export,
    rulesPath: flags.rules,
    reveal: flags.reveal,
    useBaseline: flags.baseline,
    showAll: flags.all,
  };

  const baseline = flags.baseline ? loadBaseline() : undefined;
  if (baseline) applyBaseline(findings, baseline);

  const ctx: ReportContext = {
    filesScanned,
    bytesScanned,
    sourceCount: sources.length,
    detectedOnly,
    skippedStores,
    errors,
    baselineFile: baselinePath(),
    baselineUsed: flags.baseline,
  };

  if (flags.json) {
    const report = jsonReport(findings, ctx, opts);
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderReport(findings, ctx, opts));
  }

  if (baseline) saveBaseline(baseline);

  const hasVisible =
    (flags.all ? findings : findings.filter((f) => f.baselineStatus !== 'false-positive')).length >
    0;
  if (flags.exitZero) return 0;
  return hasVisible ? 1 : 0;
}

function exists(p: string): boolean {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

function sizeOf(f: string): number {
  try {
    return statSync(f).size;
  } catch {
    return 0;
  }
}
