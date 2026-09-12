import { describe, expect, it } from 'vitest';
import { detectInChunk, fingerprintOf, loadRules } from '../src/core/detector.js';
import { maskSecret } from '../src/core/mask.js';
import { shannonEntropy } from '../src/core/entropy.js';
import { defaultRulesPath } from '../src/core/detector.js';
import type { TextChunk } from '../src/core/types.js';

const rules = loadRules(defaultRulesPath());

function scan(text: string) {
  const chunk: TextChunk = {
    text,
    tool: 'test',
    sourceCategory: 'session',
    file: 'fixture.txt',
    line: 1,
  };
  return detectInChunk(chunk, rules);
}

describe('detector: known token shapes', () => {
  it('finds an AWS access key', () => {
    const hits = scan(`deploy with AKIA${'IOSFODNN7EXAMPLE'}`);
    expect(hits.some((h) => h.ruleId === 'aws-access-key')).toBe(true);
  });

  it('finds an Anthropic key and not an OpenAI key', () => {
    const hits = scan(`ANTHROPIC_API_KEY=sk-ant-api03-${'ExampleKey1234567890abcdEF'}`);
    expect(hits.some((h) => h.ruleId === 'anthropic-api-key')).toBe(true);
    expect(hits.some((h) => h.ruleId === 'openai-api-key')).toBe(false);
  });

  it('finds an OpenAI key', () => {
    const hits = scan('key = "sk-proj-abc123ExampleExampleExample12"');
    expect(hits.some((h) => h.ruleId === 'openai-api-key')).toBe(true);
  });

  it('finds a DeepSeek key without also flagging it as OpenAI', () => {
    const hits = scan(`DEEPSEEK key: sk-${'0123456789abcdef'.repeat(2)}`);
    expect(hits.some((h) => h.ruleId === 'deepseek-api-key')).toBe(true);
    expect(hits.some((h) => h.ruleId === 'openai-api-key')).toBe(false);
  });

  it('finds GitHub / Slack / Stripe / npm tokens', () => {
    expect(
      scan(`ghp_${'16C7e42F292c6912E7710c53839122318D4ascz'}`).some((h) => h.ruleId === 'github-token'),
    ).toBe(true);
    expect(
      scan(`xoxb-${['123456789012', '1234567890123', 'AbCdEfGhIjKlMnOpQrStUvWx'].join('-')}`).some(
        (h) => h.ruleId === 'slack-token',
      ),
    ).toBe(true);
    expect(
      scan(`sk_live_51${'Example'.repeat(4)}12345`).some(
        (h) => h.ruleId === 'stripe-secret-key',
      ),
    ).toBe(true);
    expect(
      scan(`npm_${'0'.repeat(40)}`).some((h) => h.ruleId === 'npm-token'),
    ).toBe(true);
  });

  it('finds PEM private keys', () => {
    const pem =
      '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\n-----END OPENSSH PRIVATE KEY-----';
    expect(scan(pem).some((h) => h.ruleId === 'pem-private-key')).toBe(true);
  });

  it('finds entropy-gated credential assignments', () => {
    expect(
      scan('api_key = "j8Kp2mL9qR4vT7wX3zB1"').some(
        (h) => h.ruleId === 'generic-api-key-assignment',
      ),
    ).toBe(true);
  });

  it('does not flag low-entropy assignments', () => {
    expect(scan('password = "aaaaaaaaaaaaaaaaaaaa"')).toHaveLength(0);
    expect(scan('token: "abcabcabcabcabcabcabc"')).toHaveLength(0);
  });

  it('does not flag ordinary prose', () => {
    expect(scan('hey can you refactor the parser to handle edge cases? thanks!')).toHaveLength(0);
  });
});

describe('masking', () => {
  it('keeps only prefix and suffix', () => {
    expect(maskSecret('sk-ant-api03-VerySecretValueHere1111')).toBe('sk-ant-a…1111');
    expect(maskSecret('short')).toBe('shor…');
  });
});

describe('fingerprints', () => {
  it('is stable and rule-scoped', () => {
    expect(fingerprintOf('a', 'x')).toBe(fingerprintOf('a', 'x'));
    expect(fingerprintOf('a', 'x')).not.toBe(fingerprintOf('b', 'x'));
  });
});

describe('entropy', () => {
  it('ranks repetitive strings low', () => {
    expect(shannonEntropy('aaaaaaaa')).toBeLessThan(1);
    expect(shannonEntropy('aB3$xY9!zQ1@wE5&')).toBeGreaterThan(3);
  });
});
