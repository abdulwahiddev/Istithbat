import type { CSSProperties } from 'react';
import type { Seg } from './diff';

/** «old ← new» on one line, for the Overview incident row. */
export function InlineDiff({ oldSegs, newSegs, style }: { oldSegs: Seg[]; newSegs: Seg[]; style?: CSSProperties }) {
  return (
    <span className="ar" lang="ar" dir="rtl" style={{ fontSize: 26, lineHeight: 1.6, alignSelf: 'flex-start', color: 'var(--ink-2)', ...style }}>
      {oldSegs.map((s, i) => <span key={i}>{i > 0 && ' '}{s.kind === 'removed' ? <span style={{ color: 'var(--co-ink)' }}>{s.text}</span> : s.text}</span>)}
      {' ← '}
      {newSegs.map((s, i) => <span key={`n${i}`}>{i > 0 && ' '}{s.kind === 'added' ? <span style={{ color: 'var(--co-ink)' }}>{s.text}</span> : s.text}</span>)}
    </span>
  );
}
