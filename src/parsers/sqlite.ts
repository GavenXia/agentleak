import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import type { TextChunk } from '../core/types.js';

/**
 * Best-effort scan of an SQLite store (e.g. Cursor state.vscdb):
 * dump the DB with the sqlite3 CLI and regex over the dump text.
 * The DB is copied to a temp dir first so we never touch a live file.
 */
export function parseSqliteDump(file: string, tool: string): TextChunk[] {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agentleak-'));
  try {
    const tmpDb = path.join(tmpDir, 'db.sqlite');
    copyFileSync(file, tmpDb);
    for (const suffix of ['-wal', '-shm']) {
      if (existsSync(file + suffix)) copyFileSync(file + suffix, tmpDb + suffix);
    }
    let dump: string;
    try {
      dump = execFileSync('sqlite3', [tmpDb, '.dump'], {
        encoding: 'utf8',
        maxBuffer: 512 * 1024 * 1024,
      });
    } catch {
      // sqlite3 CLI unavailable or DB unreadable: fall back to raw bytes.
      dump = readFileSync(tmpDb, 'utf8');
    }
    const lines = dump.split('\n');
    const chunks: TextChunk[] = [];
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i];
      if (!text || text.trim().length < 8) continue;
      chunks.push({
        text,
        tool,
        sourceCategory: 'session',
        file,
        line: i + 1,
        sessionLabel: path.basename(file),
      });
    }
    return chunks;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
