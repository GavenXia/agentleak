import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { unzipSync } from 'fflate';
import type { TextChunk } from '../core/types.js';

/**
 * Official web-chat exports (ChatGPT "Export data" zip, claude.ai data export).
 * Accepts a .zip, a directory containing the export, or a raw conversations.json.
 */
export function parseExport(target: string): TextChunk[] {
  const tool = 'Web chat export';
  let jsonText: string | undefined;
  let origin = target;

  const st = statSync(target); // throws upstream if missing
  if (st.isFile() && target.endsWith('.zip')) {
    const files = unzipSync(readFileSync(target));
    for (const [name, data] of Object.entries(files)) {
      if (name === 'conversations.json' || /conversation/i.test(path.basename(name))) {
        jsonText = Buffer.from(data).toString('utf8');
        origin = name;
        break;
      }
    }
    if (!jsonText) throw new Error(`no conversations.json found inside ${target}`);
  } else if (st.isDirectory()) {
    for (const name of readdirSync(target)) {
      if (/conversation/i.test(name) && name.endsWith('.json')) {
        jsonText = readFileSync(path.join(target, name), 'utf8');
        origin = name;
        break;
      }
    }
    if (!jsonText) throw new Error(`no conversations JSON found inside ${target}`);
  } else if (st.isFile()) {
    jsonText = readFileSync(target, 'utf8');
  }

  const doc = JSON.parse(jsonText ?? '') as unknown;
  const chunks: TextChunk[] = [];

  if (Array.isArray(doc)) {
    for (const conv of doc as Record<string, unknown>[]) {
      const title = typeof conv.title === 'string' ? conv.title : undefined;
      const when = unixToIso(conv.create_time) ?? isoOf(conv.created_at) ?? isoOf(conv.updated_at);
      // ChatGPT shape: { mapping: { id: { message: { author, content } } } }
      const mapping = conv.mapping as Record<string, Record<string, unknown>> | undefined;
      if (mapping) {
        for (const node of Object.values(mapping)) {
          const message = node.message as
            { author?: { role?: string }; content?: { parts?: unknown[] } } | undefined;
          if (message?.author?.role !== 'user') continue;
          for (const part of message.content?.parts ?? []) {
            if (typeof part === 'string' && part.trim().length >= 8) {
              chunks.push({
                text: part,
                tool,
                sourceCategory: 'export',
                file: origin,
                when,
                sessionLabel: title,
              });
            }
          }
        }
        continue;
      }
      // claude.ai shape: { chat_messages: [{ sender: 'human', text }] }
      const messages = conv.chat_messages as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(messages)) {
        for (const msg of messages) {
          if (msg.sender !== 'human' && msg.sender !== 'user') continue;
          const text = msg.text ?? msg.content;
          if (typeof text === 'string' && text.trim().length >= 8) {
            chunks.push({
              text,
              tool,
              sourceCategory: 'export',
              file: origin,
              when,
              sessionLabel: title,
            });
          }
        }
      }
    }
  }

  if (chunks.length === 0) {
    // Unknown structure: scan the serialized document as a whole.
    const text = JSON.stringify(doc);
    if (text.length >= 8) {
      chunks.push({ text, tool, sourceCategory: 'export', file: origin });
    }
  }
  return chunks;
}

function unixToIso(v: unknown): string | undefined {
  return typeof v === 'number' ? new Date(v * 1000).toISOString() : undefined;
}

function isoOf(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
