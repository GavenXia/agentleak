import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.venv', '__pycache__']);

export interface WalkOptions {
  maxDepth?: number;
  /** Return files (not dirs) matching this predicate. */
  match?: (file: string) => boolean;
  maxFiles?: number;
}

/** Recursive file walk with sane skips. Returns absolute file paths. */
export function walkFiles(root: string, opts: WalkOptions = {}): string[] {
  const { maxDepth = 8, match, maxFiles = 5000 } = opts;
  const out: string[] = [];
  if (!existsDir(root)) return out;

  const visit = (dir: string, depth: number) => {
    if (out.length >= maxFiles) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (out.length >= maxFiles) return;
      const full = path.join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (SKIP_DIRS.has(name)) continue;
        if (depth < maxDepth) visit(full, depth + 1);
      } else if (st.isFile()) {
        if (!match || match(full)) out.push(full);
      }
    }
  };
  visit(root, 0);
  return out;
}

export function existsDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function existsFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

export function isWindows(): boolean {
  return process.platform === 'win32';
}

/** Paths differ per OS for IDE-family tools. */
export function appSupportDirs(appName: string): string[] {
  const home = process.env.HOME ?? '';
  if (isWindows()) {
    return [path.join(home, 'AppData', 'Roaming', appName)];
  }
  if (process.platform === 'darwin') {
    return [path.join(home, 'Library', 'Application Support', appName)];
  }
  return [path.join(home, '.config', appName)];
}
