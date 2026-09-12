import type { DiscoveredSource, TextChunk } from '../core/types.js';
import { parsePlainText } from './plaintext.js';
import { parseClaudeHistory, parseClaudeSessionJsonl } from './claude-code.js';
import { parseCodexSessionJsonl } from './codex.js';
import { parseSqliteDump } from './sqlite.js';
import { parseExport } from './exports.js';

export interface ParseOutcome {
  chunks: TextChunk[];
  errors: Array<{ file: string; error: string }>;
}

export function parseSource(source: DiscoveredSource): ParseOutcome {
  const chunks: TextChunk[] = [];
  const errors: Array<{ file: string; error: string }> = [];
  for (const file of source.files) {
    try {
      switch (source.parser) {
        case 'claude-jsonl':
          chunks.push(...parseClaudeSessionJsonl(file));
          break;
        case 'claude-history':
          chunks.push(...parseClaudeHistory(file));
          break;
        case 'codex-jsonl':
          chunks.push(...parseCodexSessionJsonl(file));
          break;
        case 'sqlite-dump':
          chunks.push(...parseSqliteDump(file, source.tool));
          break;
        case 'export-conversations':
          chunks.push(...parseExport(file));
          break;
        case 'plaintext':
        case 'generic-json':
        default:
          chunks.push(...parsePlainText(file, source.tool, source.category));
          break;
      }
    } catch (err) {
      errors.push({ file, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { chunks, errors };
}
