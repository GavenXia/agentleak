export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

/** Where a piece of text came from. */
export interface TextChunk {
  text: string;
  /** Human-readable agent/tool name, e.g. "Claude Code". */
  tool: string;
  sourceCategory: 'session' | 'paste' | 'config' | 'export' | 'project';
  /** Absolute path of the file the text was extracted from. */
  file: string;
  /** 1-based line number, when known. */
  line?: number;
  /** ISO timestamp of the message, when known. */
  when?: string;
  /** Session id / conversation title, when known. */
  sessionLabel?: string;
}

export interface ProviderInfo {
  name: string;
  revokeUrl: string;
}

export interface RuleDef {
  id: string;
  description: string;
  regex: RegExp;
  keywords: string[];
  minEntropy?: number;
  severity: Severity;
  provider?: ProviderInfo;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  description: string;
  /** Full secret value. Never printed unless --reveal. */
  value: string;
  masked: string;
  /** sha256(ruleId + ':' + value) — stable id used by the baseline. */
  fingerprint: string;
  chunk: TextChunk;
  /** True when this fingerprint is not in the baseline yet. */
  isNew?: boolean;
  /** Status recorded in the baseline for this fingerprint. */
  baselineStatus?: 'open' | 'rotated' | 'false-positive';
}

export type ParserId =
  | 'plaintext'
  | 'claude-jsonl'
  | 'claude-history'
  | 'codex-jsonl'
  | 'sqlite-dump'
  | 'export-conversations'
  | 'generic-json';

export interface DiscoveredSource {
  tool: string;
  category: TextChunk['sourceCategory'];
  files: string[];
  parser: ParserId;
  /** Best-effort sources are flagged in the report. */
  bestEffort?: boolean;
}

export interface DetectedOnly {
  tool: string;
  dir: string;
}

export interface ScanOptions {
  cwd: string;
  exportPath?: string;
  rulesPath?: string;
  reveal: boolean;
  useBaseline: boolean;
  showAll: boolean;
}
