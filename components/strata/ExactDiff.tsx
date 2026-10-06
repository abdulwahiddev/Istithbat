import type { CSSProperties, ReactNode } from 'react';
import { isArabic, valueText } from './diff';

/**
 * Exact change renderer. Generic over the stored values: any field role, Arabic or Latin, short or
 * long, single or multi-line, any number of insertions and deletions. The text shown is exactly the
 * stored value; it is only segmented. Word tokens keep their own trailing whitespace, so line breaks
 * and spacing are preserved byte for byte.
 */

type Piece = { text: string; kind: 'same' | 'removed' | 'added' };

/** Word tokens with their trailing whitespace; leading whitespace is kept as its own piece. */
export function wsTokens(s: string): string[] {
  const out: string[] = [];
  const lead = s.match(/^\s+/)?.[0];
  if (lead) out.push(lead);
  for (const m of s.slice(lead?.length ?? 0).matchAll(/\S+\s*/g)) out.push(m[0]);
  return out;
}

/** LCS on trimmed tokens; returns ordered ops carrying the original text (with whitespace). */
export function diffPieces(oldText: string, newText: string): { old: Piece[]; neu: Piece[]; ops: Piece[] } {
  const a = wsTokens(oldText), b = wsTokens(newText);
  const ka = a.map((t) => t.trim()), kb = b.map((t) => t.trim());
  const n = a.length, m = b.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = ka[i] === kb[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const old: Piece[] = [], neu: Piece[] = [], ops: Piece[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (ka[i] === kb[j]) { old.push({ text: a[i], kind: 'same' }); neu.push({ text: b[j], kind: 'same' }); ops.push({ text: b[j], kind: 'same' }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { old.push({ text: a[i], kind: 'removed' }); ops.push({ text: a[i++], kind: 'removed' }); }
    else { neu.push({ text: b[j], kind: 'added' }); ops.push({ text: b[j++], kind: 'added' }); }
  }
  while (i < n) { old.push({ text: a[i], kind: 'removed' }); ops.push({ text: a[i++], kind: 'removed' }); }
  while (j < m) { neu.push({ text: b[j], kind: 'added' }); ops.push({ text: b[j++], kind: 'added' }); }
  return { old, neu, ops };
}

export type DiffLayout = 'expressive' | 'split' | 'json';
export function chooseLayout(oldV: unknown, newV: unknown): DiffLayout {
  const o = typeof oldV === 'string' || oldV == null ? (oldV as string | null) : null;
  const n = typeof newV === 'string' || newV == null ? (newV as string | null) : null;
  if ((oldV != null && typeof oldV === 'object') || (newV != null && typeof newV === 'object')) return 'json';
  const longest = Math.max(o?.length ?? 0, n?.length ?? 0, valueText(oldV)?.length ?? 0, valueText(newV)?.length ?? 0);
  const multiline = /\n/.test(o ?? '') || /\n/.test(n ?? '');
  return longest <= 40 && !multiline ? 'expressive' : 'split';
}

/** Display size for the expressive layout: large for a few words, never the old fixed 96px. */
export function expressiveSize(text: string, arabic: boolean): number {
  const len = text.length;
  if (arabic) return len <= 12 ? 72 : len <= 24 ? 56 : 44;
  return len <= 12 ? 48 : len <= 24 ? 40 : 32;
}

const mark: CSSProperties = { color: 'var(--co-ink)', textDecoration: 'underline 2px var(--co)', textUnderlineOffset: '.35em', textDecorationSkipInk: 'none' };

function Text({ pieces, side, expressive }: { pieces: Piece[]; side: 'old' | 'new'; expressive: boolean }) {
  return (
    <>
      {pieces.map((p, i) =>
        p.kind === 'same' ? <span key={i}>{p.text}</span>
          : side === 'old' && p.kind === 'removed' ? <span key={i} className="dx-del"><span style={mark} title="Removed in the candidate">{p.text.trimEnd()}</span>{p.text.slice(p.text.trimEnd().length)}</span>
          : side === 'new' && p.kind === 'added' ? <span key={i} className="dx-add"><span style={mark} title="Added in the candidate">{p.text.trimEnd()}</span>{p.text.slice(p.text.trimEnd().length)}</span>
          : side === 'new' && p.kind === 'removed' && expressive ? <span key={i} role="img" aria-label={`removed: ${p.text.trim()}`} className="dx-gap" style={{ display: 'inline-block', width: `${Math.max(1, Math.min(3.2, p.text.trim().length * 0.37)).toFixed(2)}em`, height: '.06em', borderBottom: '2px dashed var(--co)', opacity: 0.7, verticalAlign: 'middle', marginInline: '.15em' }} />
          : null,
      )}
    </>
  );
}

const FLAG_NOTE: Record<string, string> = {
  HARAKAT_ONLY: 'Harakat-only change: the letters are the same, the vowel marks differ. Substantive by rule.',
  PUNCTUATION_ONLY: 'Punctuation-only change. Substantive by rule: punctuation can change how Arabic is read.',
  WHITESPACE_ONLY: 'Whitespace-only change: the word sequence is identical.',
  UNICODE_EQUIVALENT: 'Unicode-equivalent change: identical after NFC normalisation.',
};

export function ExactDiff({ oldValue, newValue, oldLabel, newLabel, oldChip, newChip, flags = [] }: {
  oldValue: unknown; newValue: unknown; oldLabel: string; newLabel: string; oldChip: ReactNode; newChip: ReactNode; flags?: string[];
}) {
  const layout = chooseLayout(oldValue, newValue);
  const o = valueText(oldValue), n = valueText(newValue);
  const ar = isArabic(`${o ?? ''} ${n ?? ''}`);
  const d = layout !== 'json' && o != null && n != null ? diffPieces(o, n) : null;
  const notes = flags.map((f) => FLAG_NOTE[f]).filter(Boolean);
  const textProps = ar ? { className: 'ar', lang: 'ar', dir: 'rtl' as const } : { dir: 'auto' as const };

  const head = (label: string, chip: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="mono" style={{ fontSize: 15 }}>{label}</span>{chip}</div>
  );

  let body: ReactNode;
  if (layout === 'json') {
    body = (
      <div className="sub" style={{ rowGap: 20, padding: '24px 0' }}>
        {[[oldLabel, oldChip, oldValue], [newLabel, newChip, newValue]].map(([l, c, v], i) => (
          <div key={i} className={i ? 'c6-10' : 'c1-5'} style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            {head(l as string, c as ReactNode)}
            <pre className="raw" style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{v == null ? '(absent)' : JSON.stringify(v, null, 2)}</pre>
          </div>
        ))}
      </div>
    );
  } else if (layout === 'expressive') {
    const size = expressiveSize((o ?? '').length >= (n ?? '').length ? (o ?? '') : (n ?? ''), ar);
    const row = (label: string, chip: ReactNode, side: 'old' | 'new', value: string | null, border?: boolean) => (
      <div className="sub" style={{ alignItems: 'center', padding: '28px 0', ...(border ? { borderTop: '1px solid var(--line)' } : {}) }}>
        <div className="c1-2" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span className="mono" style={{ fontSize: 16 }}>{label}</span><span style={{ alignSelf: 'flex-start' }}>{chip}</span></div>
        <p {...textProps} className={`c3-10 dx-line${ar ? ' ar' : ''}`} style={{ margin: 0, fontSize: size, lineHeight: ar ? 1.5 : 1.25, textAlign: ar ? 'right' : 'left', paddingInlineStart: ar ? 48 : 0, overflowWrap: 'anywhere' }}>
          {value == null ? <span style={{ color: 'var(--ink-3)', fontSize: 16 }}>{side === 'old' ? 'Not present' : 'Removed'}</span>
            : d ? <Text pieces={side === 'old' ? d.old : d.ops} side={side} expressive /> : value}
        </p>
      </div>
    );
    body = <>{row(oldLabel, oldChip, 'old', o)}{row(newLabel, newChip, 'new', n, true)}</>;
  } else {
    const col = (label: string, chip: ReactNode, side: 'old' | 'new', value: string | null, cls: string) => (
      <div className={cls} style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, padding: '24px 0' }}>
        {head(label, chip)}
        <p {...textProps} className={`dx-line${ar ? ' ar' : ''}`} style={{ margin: 0, fontSize: ar ? 24 : 17, lineHeight: ar ? 1.9 : 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--ink)' }}>
          {value == null ? <span style={{ color: 'var(--ink-3)' }}>{side === 'old' ? 'Not present' : 'Removed'}</span> : d ? <Text pieces={side === 'old' ? d.old : d.neu} side={side} expressive={false} /> : value}
        </p>
      </div>
    );
    body = (
      <div className="sub" style={{ columnGap: 32 }}>
        {col(oldLabel, oldChip, 'old', o, 'c1-5')}
        <div className="c6-10" style={{ position: 'relative' }}>
          <span aria-hidden="true" style={{ position: 'absolute', left: -16, top: 24, bottom: 24, width: 1, background: 'var(--line)' }} />
          {col(newLabel, newChip, 'new', n, '')}
        </div>
      </div>
    );
  }
  return (
    <div className="dx" data-layout={layout}>
      {body}
      {notes.length > 0 && <p className="meta" style={{ margin: 0, padding: '0 0 16px' }}>{notes.join(' ')}</p>}
    </div>
  );
}
