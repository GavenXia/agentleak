import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { TextChunk } from '../core/types.js';

interface ClaudeBlock {
  type?: string;
  text?: string;
}

/** ~/.claude/projects/<munged-cwd>/<session>.jsonl — one JSON event per line. */
export function parseClaudeSessionJsonl(file: string): TextChunk[] {
  const tool = 'Claude Code';
  const sessionLabel = path.basename(file, '.jsonl');
  const chunks: TextChunk[] = [];
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw || !raw.trim()) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (obj.type !== 'user') continue;
    const message = obj.message as { content?: string | ClaudeBlock[] } | undefined;
    const when = typeof obj.timestamp === 'string' ? obj.timestamp : undefined;
    const texts: string[] = [];
    const content = message?.content;
    if (typeof content === 'string') {
      texts.push(content);
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === 'text' && typeof block.text === 'string') texts.push(block.text);
      }
    }
    for (const text of texts) {
      if (text.trim().length < 8) continue;
      chunks.push({
        text,
        tool,
        sourceCategory: 'session',
        file,
        line: i + 1,
        when,
        sessionLabel,
      });
    }
  }
  return chunks;
}

/** ~/.claude/history.jsonl — cross-project prompt history incl. pasted bodies. */
export function parseClaudeHistory(file: string): TextChunk[] {
  const tool = 'Claude Code';
  const chunks: TextChunk[] = [];
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw || !raw.trim()) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      continue;
    }
    const when = typeof obj.timestamp === 'string' ? obj.timestamp : undefined;
    const project = typeof obj.project === 'string' ? obj.project : undefined;
    if (typeof obj.display === 'string' && obj.display.trim().length >= 8) {
      chunks.push({
        text: obj.display,
        tool,
        sourceCategory: 'session',
        file,
        line: i + 1,
        when,
        sessionLabel: project,
      });
    }
    const pasted = obj.pastedContents;
    if (pasted && typeof pasted === 'object') {
      const text = JSON.stringify(pasted);
      if (text.length >= 8) {
        chunks.push({
          text,
          tool,
          sourceCategory: 'paste',
          file,
          line: i + 1,
          when,
          sessionLabel: project,
        });
      }
    }
  }
  return chunks;
}
