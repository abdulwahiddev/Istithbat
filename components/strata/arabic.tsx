import type { CSSProperties } from 'react';
import type { Seg } from './diff';

/** «old ← new» on one line, for the Overview incident row. */
export function InlineDiff({ oldSegs, newSegs, style, arabic = true }: { oldSegs: Seg[]; newSegs: Seg[]; style?: CSSProperties; arabic?: boolean }) {
  return (
    <span className={arabic ? 'ar' : undefined} lang={arabic ? 'ar' : undefined} dir={arabic ? 'rtl' : 'auto'} style={{ fontSize: arabic ? ([...oldSegs, ...newSegs].reduce((n, x) => n + x.text.length + 1, 0) > 48 ? 20 : 26) : 16, lineHeight: 1.6, alignSelf: 'flex-start', color: 'var(--ink-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: '100%', ...style }}>
      {oldSegs.map((s, i) => <span key={i}>{i > 0 && ' '}{s.kind === 'removed' ? <span style={{ color: 'var(--co-ink)' }}>{s.text}</span> : s.text}</span>)}
      {arabic ? ' ← ' : ' → '}
      {newSegs.map((s, i) => <span key={`n${i}`}>{i > 0 && ' '}{s.kind === 'added' ? <span style={{ color: 'var(--co-ink)' }}>{s.text}</span> : s.text}</span>)}
    </span>
  );
}
