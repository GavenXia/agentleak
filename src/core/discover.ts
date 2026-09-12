import path from 'node:path';
import os from 'node:os';
import { statSync } from 'node:fs';
import { appSupportDirs, existsDir, existsFile, walkFiles } from '../util/fs.js';
import type { DetectedOnly, DiscoveredSource } from './types.js';

export interface DiscoveryResult {
  sources: DiscoveredSource[];
  detectedOnly: DetectedOnly[];
  /** Well-known credential stores we intentionally do NOT report as leaks. */
  skippedStores: string[];
}

const MAX_SESSION_FILE_BYTES = 64 * 1024 * 1024;

export function discover(cwd: string, exportPath?: string): DiscoveryResult {
  const home = os.homedir();
  const sources: DiscoveredSource[] = [];
  const detectedOnly: DetectedOnly[] = [];
  const skippedStores: string[] = [];

  // ---- Claude Code -------------------------------------------------------
  const claudeProjects = path.join(home, '.claude', 'projects');
  if (existsDir(claudeProjects)) {
    sources.push({
      tool: 'Claude Code',
      category: 'session',
      parser: 'claude-jsonl',
      files: walkFiles(claudeProjects, {
        maxDepth: 8,
        match: (f) => f.endsWith('.jsonl'),
      }).filter((f) => sizeOk(f)),
    });
    const history = path.join(home, '.claude', 'history.jsonl');
    if (existsFile(history)) {
      sources.push({
        tool: 'Claude Code',
        category: 'session',
        parser: 'claude-history',
        files: [history],
      });
    }
    const pasteCache = path.join(home, '.claude', 'paste-cache');
    if (existsDir(pasteCache)) {
      sources.push({
        tool: 'Claude Code',
        category: 'paste',
        parser: 'plaintext',
        files: walkFiles(pasteCache, { maxDepth: 2 }).filter((f) => sizeOk(f)),
      });
    }
    // MCP server keys etc. — these get read into agent context.
    for (const cfg of [
      path.join(home, '.claude.json'),
      path.join(home, '.claude', 'settings.json'),
    ]) {
      if (existsFile(cfg)) {
        sources.push({
          tool: 'Claude Code',
          category: 'config',
          parser: 'plaintext',
          files: [cfg],
        });
      }
    }
  }

  // ---- Codex CLI ---------------------------------------------------------
  const codex = path.join(home, '.codex');
  if (existsDir(codex)) {
    const sessionFiles: string[] = [];
    for (const sub of ['sessions', 'archived_sessions']) {
      const dir = path.join(codex, sub);
      if (existsDir(dir)) {
        sessionFiles.push(...walkFiles(dir, { maxDepth: 6, match: (f) => f.endsWith('.jsonl') }));
      }
    }
    sources.push({
      tool: 'Codex CLI',
      category: 'session',
      parser: 'codex-jsonl',
      files: sessionFiles.filter((f) => sizeOk(f)),
    });
    const codexHistory = path.join(codex, 'history.jsonl');
    if (existsFile(codexHistory)) {
      sources.push({
        tool: 'Codex CLI',
        category: 'session',
        parser: 'plaintext',
        files: [codexHistory],
      });
    }
    // auth.json is where the key is SUPPOSED to live — not a leak finding.
    const auth = path.join(codex, 'auth.json');
    if (existsFile(auth)) skippedStores.push(auth);
  }

  // ---- Cursor (best-effort: raw regex over sqlite dump) ------------------
  for (const base of appSupportDirs('Cursor')) {
    const db = path.join(base, 'User', 'globalStorage', 'state.vscdb');
    if (existsFile(db)) {
      sources.push({
        tool: 'Cursor',
        category: 'session',
        parser: 'sqlite-dump',
        bestEffort: true,
        files: [db],
      });
      break;
    }
  }

  // ---- GitHub Copilot CLI (best-effort plaintext) -------------------------
  const copilot = path.join(home, '.copilot');
  if (existsDir(copilot)) {
    const dir = path.join(copilot, 'session-state');
    if (existsDir(dir)) {
      sources.push({
        tool: 'GitHub Copilot CLI',
        category: 'session',
        parser: 'plaintext',
        bestEffort: true,
        files: walkFiles(dir, { maxDepth: 4, match: (f) => f.endsWith('.jsonl') }).filter((f) =>
          sizeOk(f),
        ),
      });
    }
  }

  // ---- aider (per-repo markdown transcripts) ------------------------------
  const aiderFiles = walkFiles(cwd, {
    maxDepth: 5,
    match: (f) => f.endsWith('.aider.chat.history.md') || f.endsWith('.aider.input.history'),
    maxFiles: 2000,
  });
  if (aiderFiles.length > 0) {
    sources.push({
      tool: 'aider',
      category: 'session',
      parser: 'plaintext',
      bestEffort: true,
      files: aiderFiles.filter((f) => sizeOk(f)),
    });
  }

  // ---- Project-local credential files (leak into agent context) ----------
  const projectEnvFiles = walkFiles(cwd, {
    maxDepth: 4,
    match: (f) => {
      const base = path.basename(f);
      if (base === '.env.example' || base.endsWith('.example')) return false;
      return base === '.env' || /^\.env\.[^.]+$/.test(base) || base === '.mcp.json';
    },
    maxFiles: 2000,
  });
  if (projectEnvFiles.length > 0) {
    sources.push({
      tool: 'project files',
      category: 'project',
      parser: 'plaintext',
      files: projectEnvFiles.filter((f) => sizeOk(f)),
    });
  }

  // ---- Detected but not yet supported -------------------------------------
  for (const base of appSupportDirs('Windsurf')) {
    if (existsDir(base)) detectedOnly.push({ tool: 'Windsurf', dir: base });
  }
  if (existsDir(path.join(home, '.continue'))) {
    detectedOnly.push({ tool: 'Continue', dir: path.join(home, '.continue') });
  }
  if (existsDir(path.join(home, '.gemini'))) {
    detectedOnly.push({ tool: 'Gemini CLI', dir: path.join(home, '.gemini') });
  }

  // ---- Official web-chat exports -----------------------------------------
  if (exportPath) {
    sources.push({
      tool: 'Web chat export',
      category: 'export',
      parser: 'export-conversations',
      files: [exportPath],
    });
  }

  return { sources: sources.filter((s) => s.files.length > 0), detectedOnly, skippedStores };
}

function sizeOk(f: string): boolean {
  try {
    return statSync(f).size <= MAX_SESSION_FILE_BYTES;
  } catch {
    return false;
  }
}
