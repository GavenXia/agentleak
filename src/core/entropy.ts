const CHARSET = /[A-Za-z0-9_\-+/=.]/;

/** Shannon entropy in bits per character (log2 base). */
export function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/** Heuristic: enough "random-looking" characters to be a candidate secret. */
export function looksRandom(s: string): boolean {
  let randomish = 0;
  for (const ch of s) if (CHARSET.test(ch)) randomish++;
  return randomish / s.length > 0.6;
}
