'use client';
import { Tx } from '@/components/strata/i18n/client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main"><section style={{ padding: '72px 0 120px' }}><div className="wrap g">
      <div style={{ gridColumn: '1 / span 8', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h1 style={{ margin: 0, fontSize: 60, lineHeight: '64px', fontWeight: 600, letterSpacing: '-.034em' }}><Tx>This view could not load.</Tx></h1>
        <p className="meta" style={{ margin: 0, fontSize: 15 }}><Tx>Nothing was changed. Production keeps serving its trusted versions; only this page failed to render.</Tx></p>
        <button type="button" className="lnk" onClick={reset} style={{ alignSelf: 'flex-start', font: 'inherit', fontSize: 14, fontWeight: 600, background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--ink)' }}><Tx>Try again</Tx> <span aria-hidden="true" className="flip-rtl">→</span></button>
      </div>
    </div></section></main>
  );
}
