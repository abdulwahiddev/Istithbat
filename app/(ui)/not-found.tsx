import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main"><section style={{ padding: '72px 0 120px' }}><div className="wrap g">
      <div style={{ gridColumn: '1 / span 8', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h1 style={{ margin: 0, fontSize: 60, lineHeight: '64px', fontWeight: 600, letterSpacing: '-.034em' }}>Not on the record.</h1>
        <p className="meta" style={{ margin: 0, fontSize: 15 }}>Nothing exists at this address. Incidents, sources and bindings are linked from the overview.</p>
        <Link className="lnk" href="/overview" style={{ alignSelf: 'flex-start' }}>Back to the overview <span aria-hidden="true">→</span></Link>
      </div>
    </div></section></main>
  );
}
