import Link from 'next/link';
import { Tx } from '@/components/strata/i18n/client';

export default function NotFound() {
  return (
    <main id="main"><section style={{ padding: '72px 0 120px' }}><div className="wrap g">
      <div style={{ gridColumn: '1 / span 8', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h1 style={{ margin: 0, fontSize: 60, lineHeight: '64px', fontWeight: 600, letterSpacing: '-.034em' }}><Tx>Not on the record.</Tx></h1>
        <p className="meta" style={{ margin: 0, fontSize: 15 }}><Tx>Nothing exists at this address. Incidents, sources and bindings are linked from the overview.</Tx></p>
        <Link className="lnk" href="/overview" style={{ alignSelf: 'flex-start' }}><Tx>Back to the overview</Tx> <span aria-hidden="true" className="flip-rtl">→</span></Link>
      </div>
    </div></section></main>
  );
}
