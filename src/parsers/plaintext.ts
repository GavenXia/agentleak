import { readFileSync } from 'node:fs';
import type { TextChunk } from '../core/types.js';

/** Line-by-line scan. Used for paste caches, best-effort stores and config files. */
export function parsePlainText(
  file: string,
  tool: string,
  category: TextChunk['sourceCategory'],
  sessionLabel?: string,
): TextChunk[] {
  const raw = readFileSync(file, 'utf8');
  const lines = raw.split('\n');
  const chunks: TextChunk[] = [];
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    if (!text || text.trim().length < 8) continue;
    chunks.push({ text, tool, sourceCategory: category, file, line: i + 1, sessionLabel });
  }
  return chunks;
}
