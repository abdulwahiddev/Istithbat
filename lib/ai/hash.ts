import { createHash } from 'node:crypto';

/**
 * Key-sorted JSON used only to fingerprint AI inputs (inputHash, mock/replay keys).
 * This is NOT the integrity canonicalizer (that is lib/hashing, Codex-owned, D-14).
 * Strings are never normalised.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (value === undefined) return 'null';
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function hashInput(input: unknown): string {
  return sha256Hex(stableStringify(input));
}
