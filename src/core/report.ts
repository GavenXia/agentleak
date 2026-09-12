import pc from 'picocolors';
import type { DetectedOnly, Finding, ScanOptions, Severity } from './types.js';
import { SEVERITY_ORDER } from './types.js';
import { getVersion } from '../version.js';

export interface ReportContext {
  filesScanned: number;
  bytesScanned: number;
  sourceCount: number;
  detectedOnly: DetectedOnly[];
  skippedStores: string[];
  errors: Array<{ file: string; error: string }>;
  baselineFile: string;
  baselineUsed: boolean;
}

const SEVERITY_STYLE: Record<Severity, (s: string) => string> = {
  critical: (s) => pc.bgRed(pc.bold(s)),
  high: (s) => pc.red(pc.bold(s)),
  medium: (s) => pc.yellow(s),
  low: (s) => pc.blue(s),
  info: (s) => pc.dim(s),
};

export function humanizePath(p: string): string {
  const home = process.env.HOME;
  if (home && p.startsWith(home)) return `~${p.slice(home.length)}`;
  return p;
}

function whenShort(when?: string): string {
  if (!when) return '';
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) return when;
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

export function renderReport(findings: Finding[], ctx: ReportContext, opts: ScanOptions): string {
  const out: string[] = [];
  const visible = opts.showAll
    ? findings
    : findings.filter((f) => f.baselineStatus !== 'false-positive');

  out.push('');
  out.push(
    `${pc.bold('agentleak')} ${pc.dim(`v${VERSION}`)} — scanned ${ctx.filesScanned} files (${fmtBytes(ctx.bytesScanned)}) across ${ctx.sourceCount} sources`,
  );
  if (ctx.detectedOnly.length > 0) {
    const names = ctx.detectedOnly.map((d) => d.tool).join(', ');
    out.push(pc.dim(`detected but not yet supported: ${names}`));
  }
  if (ctx.skippedStores.length > 0) {
    out.push(
      pc.dim(
        `credential stores (expected locations, not reported): ${ctx.skippedStores.map(humanizePath).join(', ')}`,
      ),
    );
  }
  out.push('');

  if (visible.length === 0) {
    out.push(
      visible.length === findings.length
        ? pc.green('✔ No secrets found.')
        : pc.green('✔ No secrets found (hidden false-positives: use --all to show).'),
    );
    out.push('');
    return out.join('\n');
  }

  const newCount = visible.filter((f) => f.isNew).length;
  const counts = countBySeverity(visible);
  out.push(
    `${pc.bold(String(visible.length))} finding(s)${newCount > 0 ? pc.red(` · ${newCount} NEW`) : ''} · ` +
      (['critical', 'high', 'medium', 'low', 'info'] as Severity[])
        .filter((s) => counts[s])
        .map((s) => `${counts[s]} ${s}`)
        .join(', '),
  );
  out.push('');

  const sorted = [...visible].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.fingerprint.localeCompare(b.fingerprint),
  );
  for (const f of sorted) {
    const sev = SEVERITY_STYLE[f.severity](f.severity.toUpperCase().padEnd(8));
    const badges = [
      f.isNew ? pc.red(pc.bold('NEW')) : '',
      f.baselineStatus === 'rotated' ? pc.yellow('marked-rotated (still present!)') : '',
    ]
      .filter(Boolean)
      .join(' ');
    out.push(
      `  ${sev} ${pc.bold(f.ruleId)}  ${opts.reveal ? pc.bgRed(f.value) : f.masked} ${badges}`,
    );
    const bits = [f.chunk.when ? whenShort(f.chunk.when) : '', f.chunk.tool]
      .filter(Boolean)
      .join(' · ');
    out.push(`    ${pc.dim(`where:  ${bits}`)}`);
    const loc = `${humanizePath(f.chunk.file)}${f.chunk.line ? `:${f.chunk.line}` : ''}`;
    out.push(`    ${pc.dim(`        ${loc}`)}`);
    if (f.chunk.sessionLabel)
      out.push(`    ${pc.dim(`        session: ${truncate(f.chunk.sessionLabel, 60)}`)}`);
    if (providerOf(f)) out.push(`    ${pc.dim('rotate:')} ${providerOf(f)}`);
    out.push('');
  }

  const checklist = buildRotationChecklist(visible);
  if (checklist.length > 0) {
    out.push(pc.bold('Rotation checklist'));
    checklist.forEach((c, i) => out.push(`  ${i + 1}. ${c}`));
    out.push('');
  }

  if (ctx.errors.length > 0) {
    out.push(pc.yellow(`warnings: ${ctx.errors.length} file(s) could not be parsed`));
    for (const e of ctx.errors.slice(0, 3))
      out.push(pc.dim(`  - ${humanizePath(e.file)}: ${truncate(e.error, 100)}`));
    out.push('');
  }

  if (ctx.baselineUsed) {
    out.push(
      pc.dim(`baseline: ${humanizePath(ctx.baselineFile)} — mark with `) +
        pc.dim(`agentleak mark <fingerprint> --rotated|--false-positive`),
    );
    out.push('');
  }
  return out.join('\n');
}

const VERSION = getVersion();

function providerOf(f: Finding): string | undefined {
  const provider = PROVIDERS[f.ruleId];
  if (!provider) return undefined;
  return `${provider.name} → ${provider.revokeUrl}`;
}

/** Provider/rotation table mirrors rules/default.toml (kept in sync there). */
const PROVIDERS: Record<string, { name: string; revokeUrl: string }> = {
  'aws-access-key': { name: 'AWS IAM', revokeUrl: 'https://console.aws.amazon.com/iam/' },
  'openai-api-key': { name: 'OpenAI', revokeUrl: 'https://platform.openai.com/api-keys' },
  'anthropic-api-key': {
    name: 'Anthropic',
    revokeUrl: 'https://console.anthropic.com/settings/keys',
  },
  'github-token': { name: 'GitHub', revokeUrl: 'https://github.com/settings/tokens' },
  'gitlab-token': {
    name: 'GitLab',
    revokeUrl: 'https://gitlab.com/-/user_settings/personal_access_tokens',
  },
  'slack-token': {
    name: 'Slack',
    revokeUrl: 'https://api.slack.com/authentication/rotating-and-invalidating-credentials',
  },
  'stripe-secret-key': { name: 'Stripe', revokeUrl: 'https://dashboard.stripe.com/apikeys' },
  'google-api-key': {
    name: 'Google Cloud',
    revokeUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  'npm-token': { name: 'npm', revokeUrl: 'https://www.npmjs.com/settings/~/tokens' },
  'pypi-token': { name: 'PyPI', revokeUrl: 'https://pypi.org/manage/account/token/' },
  'sendgrid-token': { name: 'SendGrid', revokeUrl: 'https://app.sendgrid.com/settings/api_keys' },
  'twilio-key': { name: 'Twilio', revokeUrl: 'https://console.twilio.com/us1/develop/sid' },
  'pem-private-key': {
    name: 'SSH/PGP',
    revokeUrl: 'https://github.com/agentleak/agentleak#rotating-ssh-keys',
  },
};

function buildRotationChecklist(findings: Finding[]): string[] {
  const byRule = new Map<
    string,
    { count: number; sev: Severity; provider?: { name: string; revokeUrl: string } }
  >();
  for (const f of findings) {
    if (f.baselineStatus === 'rotated') continue;
    const cur = byRule.get(f.ruleId) ?? { count: 0, sev: f.severity };
    cur.count += 1;
    byRule.set(f.ruleId, cur);
  }
  return [...byRule.entries()]
    .sort((a, b) => SEVERITY_ORDER[a[1].sev] - SEVERITY_ORDER[b[1].sev])
    .map(([ruleId, { count, sev }]) => {
      const provider = PROVIDERS[ruleId];
      const label = provider ? `${provider.name} (${count})` : `${ruleId} (${count})`;
      const url = provider ? ` → ${provider.revokeUrl}` : '';
      return `[${sev}] ${label}${url}`;
    });
}

function countBySeverity(findings: Finding[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  return counts;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export interface JsonReport {
  version: string;
  scanned: { files: number; bytes: number; sources: number };
  detectedOnly: DetectedOnly[];
  findings: Array<{
    ruleId: string;
    severity: string;
    fingerprint: string;
    isNew: boolean;
    baselineStatus: string | undefined;
    value: string;
    masked: string;
    tool: string;
    file: string;
    line: number | undefined;
    when: string | undefined;
    session: string | undefined;
    rotate: string | undefined;
  }>;
}

export function jsonReport(findings: Finding[], ctx: ReportContext, opts: ScanOptions): JsonReport {
  const visible = opts.showAll
    ? findings
    : findings.filter((f) => f.baselineStatus !== 'false-positive');
  return {
    version: VERSION,
    scanned: { files: ctx.filesScanned, bytes: ctx.bytesScanned, sources: ctx.sourceCount },
    detectedOnly: ctx.detectedOnly,
    findings: visible.map((f) => ({
      ruleId: f.ruleId,
      severity: f.severity,
      fingerprint: f.fingerprint,
      isNew: Boolean(f.isNew),
      baselineStatus: f.baselineStatus,
      value: opts.reveal ? f.value : f.masked,
      masked: f.masked,
      tool: f.chunk.tool,
      file: f.chunk.file,
      line: f.chunk.line,
      when: f.chunk.when,
      session: f.chunk.sessionLabel,
      rotate: providerOf(f),
    })),
  };
}
