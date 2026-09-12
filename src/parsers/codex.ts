import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { TextChunk } from '../core/types.js';

interface CodexPayload {
  type?: string;
  role?: string;
  content?: Array<{ type?: string; text?: string }>;
}

/**
 * ~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<uuid>.jsonl
 * Envelope: { timestamp, type, payload }; user input lives in
 * response_item payloads of type "message" with role "user".
 */
export function parseCodexSessionJsonl(file: string): TextChunk[] {
  const tool = 'Codex CLI';
  const sessionLabel = path.basename(file, '.jsonl').replace(/^rollout-/, '');
  const chunks: TextChunk[] = [];
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw || !raw.trim()) continue;
    let obj: { timestamp?: string; type?: string; payload?: CodexPayload };
    try {
      obj = JSON.parse(raw) as typeof obj;
    } catch {
      continue;
    }
    const payload = obj.payload;
    if (obj.type !== 'response_item' || payload?.type !== 'message') continue;
    if (payload.role !== 'user') continue;
    for (const part of payload.content ?? []) {
      if (typeof part.text === 'string' && part.text.trim().length >= 8) {
        chunks.push({
          text: part.text,
          tool,
          sourceCategory: 'session',
          file,
          line: i + 1,
          when: obj.timestamp,
          sessionLabel,
        });
      }
    }
  }
  return chunks;
}
