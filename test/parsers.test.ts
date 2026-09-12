import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseClaudeSessionJsonl, parseClaudeHistory } from '../src/parsers/claude-code.js';
import { parseCodexSessionJsonl } from '../src/parsers/codex.js';
import { parseExport } from '../src/parsers/exports.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, 'fixtures');

describe('Claude Code session parser', () => {
  it('extracts user prompts with metadata', () => {
    const chunks = parseClaudeSessionJsonl(path.join(fixtures, 'claude-session.jsonl'));
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const withKey = chunks.find((c) => c.text.includes('AKIAIOSFODNN7EXAMPLE'));
    expect(withKey).toBeTruthy();
    expect(withKey?.line).toBe(3);
    expect(withKey?.when).toBe('2026-09-01T10:00:00.000Z');
  });

  it('ignores assistant messages', () => {
    const chunks = parseClaudeSessionJsonl(path.join(fixtures, 'claude-session.jsonl'));
    expect(chunks.every((c) => !c.text.includes('I will help you with that'))).toBe(true);
  });
});

describe('Claude Code history parser', () => {
  it('extracts display and pastedContents', () => {
    const chunks = parseClaudeHistory(path.join(fixtures, 'claude-history.jsonl'));
    expect(chunks.some((c) => c.text.includes('deploy this'))).toBe(true);
    expect(
      chunks.some((c) => c.sourceCategory === 'paste' && c.text.includes('AKIAIOSFODNN7EXAMPLE')),
    ).toBe(true);
  });
});

describe('Codex CLI session parser', () => {
  it('extracts user messages from response_item payloads', () => {
    const chunks = parseCodexSessionJsonl(path.join(fixtures, 'codex-session.jsonl'));
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]?.text).toContain('AKIAIOSFODNN7EXAMPLE');
  });
});

describe('web-chat exports', () => {
  it('parses ChatGPT conversations.json shape', () => {
    const chunks = parseExport(path.join(fixtures, 'chatgpt-conversations.json'));
    const withKey = chunks.find((c) =>
      c.text.includes('ghp_16C7e42F292c6912E7710c53839122318D4ascz'),
    );
    expect(withKey).toBeTruthy();
    expect(withKey?.sessionLabel).toBe('deploy help');
  });

  it('parses claude.ai export shape', () => {
    const chunks = parseExport(path.join(fixtures, 'claude-export.json'));
    expect(chunks.some((c) => c.text.includes('sk-ant-api03-ExampleKey1234567890abcdEF'))).toBe(
      true,
    );
  });
});
