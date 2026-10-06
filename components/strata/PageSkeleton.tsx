/** Route skeleton: the page frame appears at once on navigation while the server reads; static, no spinner. */
export function PageSkeleton() {
  const bar = (w: string, h: number, extra?: React.CSSProperties) => <span style={{ display: 'block', width: w, height: h, borderRadius: 8, background: 'var(--well)', ...extra }} />;
  return (
    <main id="main" aria-busy="true">
      <span className="sr-only" role="status">Loading</span>
      <section className="phd">
        <div className="wrap g" style={{ rowGap: 14, alignItems: 'start' }}>
          <div style={{ gridColumn: '1 / -1' }}>{bar('180px', 14)}</div>
          <div className="ph-lead" style={{ gridColumn: '1 / span 8', display: 'flex', flexDirection: 'column', gap: 14 }}>{bar('72%', 44)}{bar('48%', 44)}{bar('60%', 16, { marginTop: 8 })}</div>
          <div className="plate in ph-status" style={{ gridColumn: '9 / span 4', margin: '0 -24px', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>{bar('100%', 16)}{bar('100%', 16)}{bar('100%', 16)}</div>
        </div>
      </section>
      <section className="band" style={{ paddingTop: 24 }}><div className="wrap g"><div className="main">{bar('220px', 22)}<div className="plate" style={{ height: 260 }} /></div></div></section>
    </main>
  );
}
