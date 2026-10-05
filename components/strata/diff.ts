/**
 * Deterministic word diff for display. Tokens are whitespace-separated and compared byte for byte
 * (no normalisation): the text shown is exactly the stored value, only segmented.
 */

export type Seg = { text: string; kind: 'same' | 'removed' | 'added' };

export function tokens(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

/** LCS over word tokens. Returns old-side and new-side segments. */
export function wordDiff(oldText: string, newText: string): { old: Seg[]; new: Seg[]; ops: Seg[]; removed: string[]; added: string[] } {
  const a = tokens(oldText), b = tokens(newText);
  const n = a.length, m = b.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const old: Seg[] = [], neu: Seg[] = [], ops: Seg[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { old.push({ text: a[i], kind: 'same' }); neu.push({ text: b[j], kind: 'same' }); ops.push({ text: a[i], kind: 'same' }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { old.push({ text: a[i], kind: 'removed' }); ops.push({ text: a[i++], kind: 'removed' }); }
    else { neu.push({ text: b[j], kind: 'added' }); ops.push({ text: b[j++], kind: 'added' }); }
  }
  while (i < n) { old.push({ text: a[i], kind: 'removed' }); ops.push({ text: a[i++], kind: 'removed' }); }
  while (j < m) { neu.push({ text: b[j], kind: 'added' }); ops.push({ text: b[j++], kind: 'added' }); }
  return { old, new: neu, ops, removed: old.filter((s) => s.kind === 'removed').map((s) => s.text), added: neu.filter((s) => s.kind === 'added').map((s) => s.text) };
}

/** Value at a declared field path ("reference.book", "ar.hadeeth", "narrators[]"). */
export function atPath(obj: unknown, path: string): unknown {
  return path.replace(/\[\]$/, '').split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

/** Byte-level equality of two JSON values (key order independent, string content untouched). */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object).sort(), kb = Object.keys(b as object).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && sameJson((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export const valueText = (v: unknown): string | null =>
  typeof v === 'string' ? v : v == null ? null : typeof v === 'number' || typeof v === 'boolean' ? String(v) : JSON.stringify(v);

/** True when the text is predominantly Arabic script (used to pick the Amiri instrument). */
export const isArabic = (s: string) => /[؀-ۿ]/.test(s) && (s.match(/[؀-ۿ]/g)?.length ?? 0) > s.replace(/\s/g, '').length / 2;
