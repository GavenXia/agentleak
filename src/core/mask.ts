/**
 * Mask a secret for display: keep a short prefix and suffix only.
 * Safe to paste into screenshots, issues and chats.
 */
export function maskSecret(value: string): string {
  if (value.length <= 12) return `${value.slice(0, 4)}…`;
  const prefix = value.slice(0, 8);
  const suffix = value.slice(-4);
  return `${prefix}…${suffix}`;
}
