import type { BlastRadius } from '@/lib/contracts';
import { layoutGraph } from '@/components/blast/layout';
import { Tx } from '@/components/strata/i18n/client';

const STATE_COL: Record<string, string> = { IMPACTED: 'var(--co)', EXPOSED: 'var(--am)', STALE: 'var(--am)', HEALTHY: 'var(--tq)' };
const XS = [1, 17, 33, 49, 65, 79];
const text = (impact: string) => impact.charAt(0) + impact.slice(1).toLowerCase();

/** Exposure track (Incident Review §05): record → protected surfaces, from the persisted graph. */
export function ExposureTrack({ br }: { br: BlastRadius }) {
  const { nodes, edges, height, headings } = layoutGraph(br, { xs: XS, centre: 124, gap: 120, height: 248, skipSource: true, minGap: 104 });
  const apps = nodes.filter((n) => n.app && n.depth >= 6);
  const stations = nodes.filter((n) => !(n.app && n.depth >= 6));
  const aria = `${nodes.find((n) => n.assetType === 'RECORD')?.name ?? 'The changed record'} propagates to ${stations.filter((n) => n.assetType !== 'RECORD').map((n) => n.name).join(', ')}, then to ${apps.map((a) => `${a.name} (${text(a.impact).toLowerCase()}${a.protectedApp ? '' : ', not a protected app'})`).join(' and ')}.`;
  return (
    <div className="track" style={{ height }} role="img" aria-label={aria}>
      {headings.map((h) => <span key={h.depth} className="colh" style={{ insetInlineStart: `${h.x}%` }}><Tx>{h.depth >= 6 ? 'Protected surface' : h.label}</Tx></span>)}
      <svg className="mirror-rtl" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {edges.map((e) => <path key={e.id} d={e.d} stroke={e.kind === 'origin' || e.kind === 'imp' ? 'var(--co)' : 'var(--am)'} strokeWidth={e.kind === 'origin' || e.kind === 'imp' ? 3 : 2} fill="none" vectorEffect="non-scaling-stroke" />)}
      </svg>
      {stations.map((n) => (
        <div key={n.id} className="stn" style={{ insetInlineStart: `${n.x}%`, top: n.y, ['--d' as string]: n.depth - 1 }}>
          {n.assetType === 'RECORD'
            ? <><span className="n" style={{ background: 'var(--co)', borderRadius: 3 }} /><b className="mono" style={{ fontSize: 14 }}>{n.name}</b><i><Tx>Changed record</Tx></i></>
            : <><span className="n" style={{ border: `2px solid ${STATE_COL[n.impact]}`, background: 'var(--ground)' }} /><b style={{ whiteSpace: 'normal', maxWidth: 136 }} dir="auto">{n.name}</b><i><Tx>{text(n.impact)}</Tx></i></>}
        </div>
      ))}
      {apps.map((a) => (
        <div key={a.id} className="float app" style={{ ['--d' as string]: a.depth - 1, position: 'absolute', insetInlineStart: '79%', insetInlineEnd: 0, top: a.y + 8, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 16px 14px', borderRadius: 16, ...(a.impact === 'IMPACTED' ? { borderColor: 'var(--co)', boxShadow: '0 0 0 1px var(--co),var(--float-shadow)' } : {}) }}>
          <b style={{ fontSize: 16, lineHeight: '22px', fontWeight: 600 }} dir="auto">{a.name}</b>
          <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px', fontSize: 13, color: 'var(--ink-3)' }}><span className="chip" style={{ padding: '1px 9px 1px 7px', fontSize: 12 }}><span className="dot" style={{ background: STATE_COL[a.impact] }} /><Tx>{text(a.impact)}</Tx></span>{a.protectedApp ? <span style={{ whiteSpace: 'nowrap' }}>{a.regressionRunIds.length ? <><Tx>Protected</Tx> · <Tx>{`${a.regressionRunIds.length} material ${a.regressionRunIds.length === 1 ? 'run' : 'runs'}`}</Tx></> : <Tx>Protected app</Tx>}</span> : <Tx>Not a protected app</Tx>}</span>
        </div>
      ))}
    </div>
  );
}

/** Policy gate (Incident Review §06). */
export function GateMini({ candidate, trusted, appName, policyCode, heldText }: { candidate: string; trusted: string; appName: string; policyCode: string | null; heldText: string }) {
  return (
    <div className="gate-box" role="img" aria-label={`${candidate} is stopped at the Trust Gateway${policyCode ? ` by ${policyCode}` : ''}. ${trusted} passes through and is served to ${appName}.`}>
      <div className="lane" style={{ insetInlineStart: '15%', width: '39%', top: 74, background: 'var(--co-soft)', boxShadow: 'inset 0 0 0 1px var(--co)' }} />
      <div style={{ position: 'absolute', insetInlineStart: 'calc(54% - 4px)', top: 62, width: 4, height: 36, borderRadius: 2, background: 'var(--co)' }} />
      <div className="lane flow" style={{ zIndex: 2, insetInlineStart: '15%', width: '59%', top: 194, backgroundColor: 'var(--tq-soft)', boxShadow: 'inset 0 0 0 1px var(--tq-line)' }}><span className="pkt" /><span className="pkt" style={{ animationDelay: '-1.2s' }} /><span className="pkt" style={{ animationDelay: '-2.4s' }} /></div>
      <div className="vchip" style={{ insetInlineStart: 0, top: 80, color: 'var(--co-ink)' }}><span className="v">{candidate}</span><span className="t"><span style={{ color: 'var(--ink)' }}><Tx>Latest seen</Tx></span><span><Tx>{heldText}</Tx></span></span></div>
      <div className="vchip" style={{ insetInlineStart: 0, top: 200, color: 'var(--ink)' }}><span className="v" style={{ borderColor: 'var(--tq)' }}>{trusted}</span><span className="t"><span style={{ color: 'var(--ink)' }}><Tx>Trusted</Tx></span><span style={{ color: 'var(--ink-3)' }}><Tx>Served</Tx></span></span></div>
      <span style={{ position: 'absolute', insetInlineStart: '36%', top: 44, fontSize: 13, color: 'var(--co-ink)' }}><Tx>Stopped at the gate</Tx></span>
      <div style={{ position: 'absolute', insetInlineStart: '57%', top: 28, bottom: 28, width: 10, marginInlineStart: -5, borderRadius: 5, background: 'var(--gate)', boxShadow: '0 0 0 6px var(--ground),0 0 0 7px var(--line-2)' }} />
      <div className="ctr-rtl" style={{ position: 'absolute', insetInlineStart: '57%', top: 138, transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 8px 10px', borderRadius: 12, background: 'var(--gate)', color: 'var(--on-solid)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', boxShadow: '0 8px 20px -10px rgba(0,0,0,.6)' }}>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="2" /><path d="M7 9V6.5a3 3 0 016 0V9" /></svg>
        {policyCode ? <span className="mono">{policyCode}</span> : <span><Tx>Held</Tx></span>}
      </div>
      <div className="float" style={{ position: 'absolute', insetInlineStart: '76%', insetInlineEnd: 0, top: 200, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 16px 14px', borderRadius: 16 }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><b style={{ fontSize: 16, fontWeight: 600 }} dir="auto">{appName}</b><span className="chip" style={{ padding: '1px 9px 1px 7px', fontSize: 12 }}><span className="dot" style={{ background: 'var(--tq)' }} /><Tx>Serving</Tx></span></span>
        <span style={{ fontSize: 13, color: 'var(--ink-3)' }}><Tx>Protected app · reads</Tx> <span className="mono">{trusted}</span></span>
      </div>
      <div style={{ position: 'absolute', insetInlineStart: '76%', insetInlineEnd: 0, top: 80, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 16px 14px', borderRadius: 16, border: '1px dashed var(--line-2)' }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><b style={{ fontSize: 16, fontWeight: 600 }} className="mono">{candidate}</b><span className="chip" style={{ padding: '1px 9px 1px 7px', fontSize: 12 }}><span className="dot" style={{ background: 'var(--co)' }} /><Tx>Not served</Tx></span></span>
        <span style={{ fontSize: 13, color: 'var(--ink-3)' }}><Tx>Candidate · bound to no app</Tx></span>
      </div>
    </div>
  );
}
