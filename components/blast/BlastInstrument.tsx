'use client';
import { useMemo, useState } from 'react';
import type { BlastRadius } from '@/lib/contracts';
import { afterApproval, layoutGraph, type Placed } from './layout';
import { plural } from '@/components/strata/format';

type Impact = BlastRadius['nodes'][number]['impact'];
export type BlastLabels = {
  sourceName: string; candidate: string; previous: string; trustedLabel: string;
  versionLabel: Record<string, string>;
  /** regression run id → "batch 1a2b3c4d" */
  runBatch: Record<string, string>;
  changedWord: string | null; changedField: string | null;
  incidentHeld: boolean;
};

const XS = [0, 12.5, 25, 37.5, 50, 66, 82];
const C = { co: 'var(--co)', am: 'var(--am)', tq: 'var(--tq)', n: 'var(--ink-4)' };
const TYPE_SUB: Record<string, string> = { DATASET: 'Dataset', RAG_CHUNK: 'Chunk', KNOWLEDGE_INDEX: 'Lexical index', API: 'API', APPLICATION: 'Application' };

/**
 * The radius instrument (Blast Radius hero). Every state is the persisted graph's; "If approved"
 * applies the D-07 rule to the stored derivations (MATERIALIZED copies of the trusted version go
 * STALE) — a preview only.
 */
export function BlastInstrument({ br, labels: L }: { br: BlastRadius; labels: BlastLabels }) {
  const [view, setView] = useState<'now' | 'after'>('now');
  const after = view === 'after';
  const lay = useMemo(() => layoutGraph(br, { xs: XS, centre: 200, gap: 200, height: 400 }), [br]);
  const def = lay.nodes.find((n) => n.protectedApp) ?? lay.nodes.find((n) => n.impact === 'IMPACTED') ?? lay.nodes.at(-1);
  const [selId, setSelId] = useState(def?.id ?? '');
  const byId = new Map(lay.nodes.map((n) => [n.id, n]));
  const sel = byId.get(selId) ?? def;
  const impactOf = (n: Placed): Impact => (after ? afterApproval(n, br) : n.impact);
  const vl = (id: string | null) => (id ? L.versionLabel[id] ?? '—' : '—');

  const stateOf = (n: Placed): { s: string; c: string; stale?: boolean } => {
    if (n.assetType === 'SOURCE') return { s: 'Unchanged source', c: C.n };
    if (n.assetType === 'RECORD') return { s: 'Changed', c: C.co };
    const i = impactOf(n);
    return i === 'IMPACTED' ? { s: 'Impacted', c: C.co } : i === 'STALE' ? { s: 'Stale', c: C.am, stale: true } : i === 'HEALTHY' ? { s: 'Healthy', c: C.tq } : { s: 'Exposed', c: C.am };
  };
  const readsOf = (n: Placed) => {
    if (n.assetType === 'SOURCE') return after ? `${L.candidate} trusted` : `${L.candidate} seen · ${L.trustedLabel} trusted`;
    if (n.assetType === 'RECORD') return `${L.previous} → ${L.candidate}`;
    if (n.derivationMode === 'MATERIALIZED') return after && impactOf(n) === 'STALE' ? `${vl(n.derivedFromVersionId)} (superseded)` : vl(n.derivedFromVersionId);
    if (n.protectedApp) return after ? L.candidate : vl(n.servedVersionId);
    return after ? L.candidate : vl(n.derivedFromVersionId);
  };
  const whyOf = (n: Placed) => {
    if (n.assetType === 'SOURCE') return L.incidentHeld ? 'The upstream source. Its newest version is held; its trusted version is unchanged.' : 'The upstream source of the changed record.';
    if (n.assetType === 'RECORD') return `The record that changed${L.changedWord ? `: «${L.changedWord}» left the ${L.changedField ?? ''} field` : L.changedField ? ` in its ${L.changedField} field` : ''}. Every edge in the radius starts here.`;
    const i = impactOf(n);
    if (i === 'IMPACTED') return 'Exposed, a protected app, and a matched regression run found a material change. All three conditions hold, so it is impacted.';
    if (n.app && !n.protectedApp) return i === 'STALE' ? `Its frozen copy still holds ${vl(n.derivedFromVersionId)}, which would be superseded. It needs a rebuild.` : 'It depends on the changed record, but it is not a protected app, so no regression runs here and it can never be marked impacted.';
    if (n.protectedApp) return 'A protected app that depends on the changed record. No material regression is recorded against it, so it is exposed, not impacted.';
    if (n.derivationMode === 'MATERIALIZED') return i === 'STALE' ? `A materialized copy of ${vl(n.derivedFromVersionId)}. After promotion it keeps the superseded version until rebuilt.` : 'It depends on the changed record. Its copy is materialized, so it would go stale after promotion.';
    return after ? `Reads through the gateway, so it switches to ${L.candidate} in the same transaction as the binding.` : 'It depends on the changed record. Exposure is a dependency fact; behavior is not tested at this layer.';
  };
  /** Material runs grouped by batch and baseline, so repeated runs read as a count rather than a list. */
  const groupEvidence = (n: Placed) => {
    const out = new Map<string, { batch: string; oldVersionId: string; matches: boolean; runs: number }>();
    for (const r of n.regressionEvidence) {
      const batch = L.runBatch[r.id] ?? `run ${r.id.slice(0, 8)}`;
      const k = `${batch}|${r.oldVersionId}|${r.baselineMatchesIncident}`;
      const g = out.get(k); if (g) g.runs++; else out.set(k, { batch, oldVersionId: r.oldVersionId, matches: r.baselineMatchesIncident, runs: 1 });
    }
    return [...out.values()];
  };
  const evidenceOf = (n: Placed) => {
    if (n.regressionEvidence.length) return groupEvidence(n).map((g) => `${plural(g.runs, 'material run')} · ${g.batch} · baseline ${vl(g.oldVersionId)}${g.matches ? '' : ' (not the incident baseline)'}`).join('; ');
    if (n.assetType === 'SOURCE' || n.assetType === 'RECORD') return '—';
    if (n.app && !n.protectedApp) return 'None possible: not protected';
    if (n.protectedApp) return 'No material run recorded';
    return 'Not tested at this layer';
  };

  const down = lay.nodes.filter((n) => n.assetType !== 'SOURCE' && n.assetType !== 'RECORD');
  const imp = down.filter((n) => impactOf(n) === 'IMPACTED').length, stl = down.filter((n) => impactOf(n) === 'STALE').length, exp = down.length - imp - stl;
  const tally = down.map((n) => stateOf(n)).sort((a, b) => (a.s === 'Impacted' ? -1 : b.s === 'Impacted' ? 1 : Number(!!a.stale) - Number(!!b.stale)));
  const ss = sel ? stateOf(sel) : null;
  const path = sel ? (sel.dependencyPaths[0] ?? [sel.id]) : [];
  const short = (n: Placed | undefined) => (!n ? '' : n.assetType === 'SOURCE' ? L.sourceName : n.name);
  const dotStyle = (s: { s: string; c: string; stale?: boolean }): React.CSSProperties => (s.stale ? { border: '1.5px dashed var(--am)', background: 'transparent', width: 8, height: 8, boxSizing: 'border-box' } : { background: s.c });

  const rows = down.map((n) => ({ id: n.id, name: n.name, type: n.assetType, mode: n.derivationMode ?? '—', reads: readsOf(n), st: stateOf(n),
    evidence: n.regressionEvidence.length ? groupEvidence(n).map((g) => `${plural(g.runs, 'material run')} · ${g.batch}`).join('; ') : n.app && !n.protectedApp ? 'Not protected' : '—' }));
  const protectedNames = down.filter((n) => n.protectedApp).map((n) => n.name);
  const frozen = down.filter((n) => n.derivationMode === 'MATERIALIZED').map((n) => n.name);
  return (
    <>
    <section id="radius" className="band" aria-labelledby="h-radius" style={{ paddingTop: 0 }}>
      <div className="wrap g">
        <div className="rail"><span className="mk mk-det" /><h2 id="h-radius">Exposure</h2><p>Every asset downstream of the changed record.</p></div>
        <div className="main">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <h3 className="h3">{after ? `Dependency graph · if ${L.candidate} is approved` : 'Dependency graph'}</h3>
        {L.incidentHeld && (
          <div className="mseg" role="group" aria-label="Radius view" style={{ marginTop: -7 }}>
            <button type="button" aria-pressed={!after} onClick={() => setView('now')}>Now</button>
            <button type="button" aria-pressed={after} onClick={() => setView('after')}>If approved</button>
          </div>
        )}
      </div>
      <div className="plate" style={{ paddingTop: 28, paddingBottom: 0 }}>
        <div className="sub" style={{ alignItems: 'center', rowGap: 16, paddingBottom: 24, borderBottom: '1px solid var(--line)' }}>
          <div className="c1-6" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="radius" role="img" aria-label={`Blast radius: ${imp} impacted, ${exp} exposed, ${stl} stale`} style={{ gridTemplateColumns: `repeat(${Math.max(1, down.length)},minmax(0,1fr))` }}>
              {tally.map((s, i) => <span key={i} style={s.stale ? { background: 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--am)' } : { background: s.c }} />)}
            </div>
            <span className="cap">Blast radius · {down.length} downstream {down.length === 1 ? 'asset' : 'assets'}</span>
          </div>
          <div className="c7-10" style={{ display: 'flex', justifyContent: 'flex-end', gap: 32 }}>
            <span className="cnt"><b style={{ color: 'var(--co-ink)' }}>{imp}</b><span className="cap">Impacted</span></span>
            <span className="cnt"><b style={{ color: 'var(--am-ink)' }}>{exp}</b><span className="cap">Exposed</span></span>
            <span className="cnt"><b style={{ color: stl ? 'var(--am-ink)' : 'var(--ink-3)' }}>{stl}</b><span className="cap">Stale</span></span>
          </div>
        </div>
        <div style={{ overflowX: 'auto', margin: '0 -8px', padding: '0 8px' }}>
          <div className={`graph${after ? ' after' : ''}`} style={{ height: lay.height }} role="group" aria-label="Dependency graph. Select an asset to inspect it.">
            {lay.headings.map((h) => <span key={h.depth} className="colh" style={{ left: `${h.x}%` }}>{h.label}</span>)}
            <svg className="edges" viewBox={`0 0 100 ${lay.height}`} preserveAspectRatio="none" aria-hidden="true">
              {lay.edges.map((e) => <path key={e.id} className={`e-${e.kind}`} d={e.d} />)}
            </svg>
            {[...lay.nodes].sort((a, b) => a.depth - b.depth || a.y - b.y).map((n) => { // DOM order = reading order, so Tab follows the trace
              const st = stateOf(n), on = n.id === sel?.id, card = n.app;
              const cls = `node${card ? ' card' : ''}${n.assetType === 'SOURCE' ? ' src' : n.assetType === 'RECORD' ? ' rec' : ''}${on ? ' on' : ''}${st.stale ? ' stale' : ''}${impactOf(n) === 'IMPACTED' ? ' imp' : ''}${after && impactOf(n) !== n.impact ? ' changed' : ''}`;
              const pos: React.CSSProperties = { ...(card ? { left: `${n.x}%`, right: 0, top: n.y - 30 } : { left: `${n.x}%`, top: n.y - 7 }), ['--d' as string]: n.depth };
              const dot: React.CSSProperties = n.assetType === 'RECORD' ? { background: st.c, borderRadius: 3 }
                : n.assetType === 'SOURCE' || impactOf(n) === 'IMPACTED' ? { background: st.c }
                : st.stale ? { border: `2px dashed ${st.c}`, background: 'transparent' } : { border: `2px solid ${st.c}`, background: 'var(--plate-a)' };
              return (
                <button key={n.id} type="button" className={cls} style={pos} aria-pressed={on} onClick={() => setSelId(n.id)} aria-label={`${short(n)}, ${st.s}`}>
                  <span className="nd" style={dot} />
                  <span className="nl"><b className={n.assetType === 'RECORD' ? 'mono' : ''}>{n.assetType === 'SOURCE' ? short(n).split(' — ')[0] : n.name}</b>
                    <span>{card ? `${st.s} · ${readsOf(n)}` : n.assetType === 'SOURCE' ? 'Source' : n.assetType === 'RECORD' ? `${L.changedField ?? 'record'} changed` : TYPE_SUB[n.assetType] ?? n.assetType}</span></span>
                </button>
              );
            })}
          </div>
        </div>
        {sel && ss && (
          <div className="insp" aria-live="polite">
            <div className="sub fade" key={`${sel.id}-${view}`} style={{ rowGap: 20 }}>
              <div className="c1-5" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span className="cap">Selected asset</span>
                <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}><b style={{ fontSize: 20, lineHeight: '28px', fontWeight: 600 }}>{sel.assetType === 'SOURCE' ? L.sourceName : sel.name}</b><span className="chip"><span className="dot" style={dotStyle(ss)} />{ss.s}</span></span>
                <p className="body">{whyOf(sel)}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 8px', fontSize: 13, color: 'var(--ink-3)' }}>
                  <span className="cap" style={{ marginRight: 4 }}>Path</span>
                  {path.map((id, i) => <span key={id} style={{ display: 'contents' }}><span className="crumb">{short(byId.get(id)).split(' — ')[0]}</span>{i < path.length - 1 && <span aria-hidden="true" style={{ color: 'var(--ink-4)' }}>→</span>}</span>)}
                </div>
              </div>
              <div className="c6-10">
                <div className="kv"><span>Asset type</span><span className="mono">{sel.assetType}</span></div>
                <div className="kv"><span>Derivation</span><span className="mono">{sel.derivationMode ?? '—'}</span></div>
                <div className="kv"><span>Reads</span><span className="mono">{readsOf(sel)}</span></div>
                <div className="kv"><span>Impact evidence</span><span>{evidenceOf(sel)}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
      {after
        ? <p className="body fade" style={{ display: 'flex', gap: 10, alignItems: 'baseline', color: 'var(--ink-3)' }}><span className="mk mk-hum" style={{ width: 8, height: 8, background: 'var(--ink-3)' }} />Preview only. Computed with the same rules after promotion; nothing changes until a reviewer signs.</p>
        : <p className="body" style={{ color: 'var(--ink-3)' }}>Exposure comes from the dependency graph. Impact needs proof: a material regression run against a protected app. Stale applies only to frozen copies after a promotion.</p>}
        </div>
      </div>
    </section>

    <section id="assets" className="band" aria-labelledby="h-assets">
      <div className="wrap g">
        <div className="rail"><span className="mk mk-det" /><h2 id="h-assets">Assets</h2><p>How each asset reads the source.</p></div>
        <div className="main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}><h3 className="h3">Downstream assets · {rows.length}</h3><span className="meta mono">incident_asset_impacts</span></div>
          <div className="plate tight" style={{ overflowX: 'auto' }}>
            <table className="tb">
              <caption className="sr-only">Downstream assets{after ? ' if the candidate is approved (preview)' : ''}</caption>
              <thead><tr><th scope="col">Asset</th><th scope="col">Type</th><th scope="col">Derivation</th><th scope="col">Reads</th><th scope="col">State</th><th scope="col" style={{ textAlign: 'right' }}>Evidence</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><b style={{ fontWeight: 600 }}>{r.name}</b></td>
                    <td><span className="mono" style={{ fontSize: 13, color: 'var(--ink-2)' }}>{r.type}</span></td>
                    <td><span className="mono" style={{ fontSize: 13, color: 'var(--ink-2)' }}>{r.mode}</span></td>
                    <td><span className="mono" style={{ fontSize: 13 }}>{r.reads}</span></td>
                    <td><span className="chip"><span className="dot" style={dotStyle(r.st)} />{r.st.s}</span></td>
                    <td style={{ textAlign: 'right', color: 'var(--ink-3)' }}>{r.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sub" style={{ rowGap: 24 }}>
            <div className="c1-5" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="chip" style={{ padding: '1px 9px 1px 7px', fontSize: 12 }}><span className="dot" style={{ background: 'var(--co)' }} />Impacted</span><span className="meta">Only a protected app, only with proof</span></span>
              <p className="body">An asset is impacted when it is exposed, it is a protected app, and a regression run against it found a material change.{protectedNames.length ? ` ${protectedNames.join(' and ')} ${protectedNames.length === 1 ? 'is the only protected app' : 'are the protected apps'} here.` : ' No protected app is in this radius.'}</p>
            </div>
            <div className="c6-10" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="chip" style={{ padding: '1px 9px 1px 7px', fontSize: 12 }}><span className="dot" style={{ border: '1.5px dashed var(--am)', background: 'transparent', width: 8, height: 8, boxSizing: 'border-box' }} />Stale</span><span className="meta">Only frozen copies, only after promotion</span></span>
              <p className="body">{frozen.length ? <>{frozen.join(' and ')} keep a materialized copy of <span className="mono">{L.trustedLabel}</span>. If <span className="mono">{L.candidate}</span> is approved they keep reading the superseded version until rebuilt.</> : 'No asset in this radius keeps a materialized copy, so none can go stale.'}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
