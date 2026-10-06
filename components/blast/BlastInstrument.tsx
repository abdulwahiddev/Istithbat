'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BlastRadius } from '@/lib/contracts';
import { afterApproval, edgePath, layoutGraph, typeLabel, type Placed } from './layout';
import { FlowLayer, type FlowEdge } from './FlowLayer';
import { plural } from '@/components/strata/format';
import { EntityIcon, STATE_COLOR, StateMark, type StateKey } from '@/components/strata/entity';
import { Icon } from '@/components/strata/icons';

type Impact = BlastRadius['nodes'][number]['impact'];
export type BlastLabels = {
  sourceName: string; candidate: string; previous: string; trustedLabel: string;
  versionLabel: Record<string, string>;
  /** regression run id → "batch 1a2b3c4d" */
  runBatch: Record<string, string>;
  changedWord: string | null; changedField: string | null;
  incidentHeld: boolean;
};

const XS = [1.5, 13.5, 25.5, 37.5, 49.5, 64, 80];
const C = { co: 'var(--co)', am: 'var(--am)', tq: 'var(--tq)', n: 'var(--ink-4)' };
/** Columns longer than this fold their lowest-priority assets into one expandable summary. */
const MAX_PER_COLUMN = 6;

/**
 * The radius instrument (Blast Radius hero). Every state is the persisted graph's; "If approved"
 * applies the D-07 rule to the stored derivations (MATERIALIZED copies of the trusted version go
 * STALE) — a preview only.
 */
export function BlastInstrument({ br, labels: L }: { br: BlastRadius; labels: BlastLabels }) {
  const [view, setView] = useState<'now' | 'after'>('now');
  const after = view === 'after';
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set());
  const lay = useMemo(() => layoutGraph(br, { xs: XS, centre: 200, gap: 200, height: 400, maxPerColumn: MAX_PER_COLUMN, expanded }), [br, expanded]);
  const full = useMemo(() => layoutGraph(br, { xs: XS, centre: 200, gap: 200, height: 400 }), [br]);
  const def = lay.nodes.find((n) => n.protectedApp && n.impact === 'IMPACTED') ?? lay.nodes.find((n) => n.protectedApp) ?? lay.nodes.find((n) => n.impact === 'IMPACTED') ?? lay.nodes.at(-1);
  const [selId, setSelId] = useState(def?.id ?? '');
  const byId = new Map(full.nodes.map((n) => [n.id, n]));
  const sel = (byId.get(selId) && !byId.get(selId)!.summary ? byId.get(selId) : undefined) ?? def;
  const impactOf = (n: Placed): Impact => (after ? afterApproval(n, br) : n.impact);
  const host = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  useEffect(() => {
    const el = host.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const vl = (id: string | null) => (id ? L.versionLabel[id] ?? '—' : '—');

  const stateOf = (n: Placed): { s: string; c: string; k: StateKey; stale?: boolean } => {
    if (n.assetType === 'SOURCE') return { s: 'Unchanged', c: C.n, k: 'neutral' };
    if (n.assetType === 'RECORD') return { s: 'Changed', c: C.co, k: 'changed' };
    const i = impactOf(n);
    return i === 'IMPACTED' ? { s: 'Impacted', c: C.co, k: 'impacted' } : i === 'STALE' ? { s: 'Stale', c: C.am, k: 'stale', stale: true } : i === 'HEALTHY' ? { s: 'Healthy', c: C.tq, k: 'healthy' } : { s: 'Exposed', c: C.am, k: 'exposed' };
  };
  /** A folded group's members, in the current view. */
  const memberCounts = (n: Placed) => {
    const out: Partial<Record<string, number>> = {};
    for (const id of n.summary?.ids ?? []) { const m = byId.get(id); if (m) { const s = stateOf(m).s; out[s] = (out[s] ?? 0) + 1; } }
    return Object.entries(out).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(' · ');
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

  const down = full.nodes.filter((n) => n.assetType !== 'SOURCE' && n.assetType !== 'RECORD');
  const imp = down.filter((n) => impactOf(n) === 'IMPACTED').length, stl = down.filter((n) => impactOf(n) === 'STALE').length, exp = down.length - imp - stl;
  const tally = down.map((n) => stateOf(n)).sort((a, b) => (a.s === 'Impacted' ? -1 : b.s === 'Impacted' ? 1 : Number(!!a.stale) - Number(!!b.stale)));
  const ss = sel ? stateOf(sel) : null;
  const path = sel ? (sel.dependencyPaths[0] ?? [sel.id]) : [];
  const short = (n: Placed | undefined) => (!n ? '' : n.assetType === 'SOURCE' ? L.sourceName : n.name);
  // Flow signals in pixel space (edges are re-drawn in px once the instrument is measured).
  const px = (x: number) => (x / 100) * W;
  const flow: FlowEdge[] = W ? lay.edges.map((e) => {
    const to = lay.nodes.find((n) => n.id === e.to)!, from = lay.nodes.find((n) => n.id === e.from)!;
    const k = to.summary ? 'exposed' : stateOf(to).k;
    const tone = from.assetType === 'SOURCE' ? 'var(--ink-3)' : STATE_COLOR[k === 'neutral' ? 'exposed' : k];
    return { ...e, path: edgePath({ x: px(e.a.x), y: e.a.y }, { x: px(e.b.x), y: e.b.y }), tone, fromDepth: from.depth, toNode: e.to, strong: k === 'impacted' && to.app };
  }) : [];
  const toggleColumn = (d: number) => setExpanded((cur) => { const n = new Set(cur); if (n.has(d)) n.delete(d); else n.add(d); return n; });

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
        <h3 className="h3">{after ? 'Dependency graph · after approval' : 'Dependency graph'}</h3>
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
              {tally.map((s, i) => <span key={i} style={s.stale ? { background: 'transparent', boxShadow: 'inset 0 0 0 2px var(--am)' } : { background: s.c }} />)}
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
          <div ref={host} className={`graph${after ? ' after' : ''}`} style={{ height: lay.height }} role="group" aria-label="Dependency graph. Select an asset to inspect it.">
            {lay.headings.map((h) => {
              const foldable = full.headings.find((x) => x.depth === h.depth) && full.nodes.filter((n) => n.depth === h.depth).length > MAX_PER_COLUMN;
              return <span key={h.depth} className="colh" style={{ left: `${h.x}%` }}>{h.label}{foldable && expanded.has(h.depth) && <button type="button" className="colx" onClick={() => toggleColumn(h.depth)}>Show fewer</button>}</span>;
            })}
            {W ? (
              <svg className="edges" viewBox={`0 0 ${W} ${lay.height}`} aria-hidden="true">
                {lay.edges.map((e) => <path key={e.id} className={`e-${e.kind}`} d={edgePath({ x: px(e.a.x), y: e.a.y }, { x: px(e.b.x), y: e.b.y })} />)}
              </svg>
            ) : (
              <svg className="edges" viewBox={`0 0 100 ${lay.height}`} preserveAspectRatio="none" aria-hidden="true">
                {lay.edges.map((e) => <path key={e.id} className={`e-${e.kind}`} d={e.d} />)}
              </svg>
            )}
            {W > 0 && <FlowLayer edges={flow} width={W} height={lay.height} host={host} cycleKey={`${view}|${[...expanded].join(',')}`} />}
            {[...lay.nodes].sort((a, b) => a.depth - b.depth || a.y - b.y).map((n) => { // DOM order = reading order, so Tab follows the trace
              if (n.summary) {
                const card = n.app || n.summary.types.includes('APPLICATION');
                const what = n.summary.types.length === 1 ? typeLabel(n.summary.types[0]).toLowerCase() + (n.summary.ids.length === 1 ? '' : 's') : 'assets';
                return (
                  <button key={n.id} type="button" data-node={n.id} className={`node sum${card ? ' card' : ''}`} style={{ ...(card ? { left: `${n.x}%`, right: 0, top: n.y - 28 } : { left: `${n.x}%`, top: n.y - 14 }), ['--d' as string]: n.depth }}
                    aria-expanded={false} onClick={() => toggleColumn(n.depth)} aria-label={`${n.summary.ids.length} more ${what}: ${memberCounts(n)}. Show all.`}>
                    <span className="ping" aria-hidden="true" />
                    <span className="nd nd-sum">+{n.summary.ids.length}</span>
                    <span className="nl"><b>{n.summary.ids.length} more {what}</b><span>{memberCounts(n)}</span></span>
                    {card && <Icon name="chevron-right" size={16} style={{ marginLeft: 'auto', color: 'var(--ink-3)' }} />}
                  </button>
                );
              }
              const st = stateOf(n), on = n.id === sel?.id, card = n.app;
              const cls = `node${card ? ' card' : ''} st-${st.k}${on ? ' on' : ''}${after && impactOf(n) !== n.impact ? ' changed' : ''}`;
              const pos: React.CSSProperties = { ...(card ? { left: `${n.x}%`, right: 0, top: n.y - 28 } : { left: `${n.x}%`, top: n.y - 14 }), ['--d' as string]: n.depth };
              const name = n.assetType === 'SOURCE' ? short(n).split(' — ')[0] : n.name;
              return (
                <button key={n.id} type="button" data-node={n.id} className={cls} style={pos} aria-pressed={on} onClick={() => setSelId(n.id)} aria-label={`${typeLabel(n.assetType)} ${short(n)}, ${st.s}`}>
                  <span className="ping" aria-hidden="true" />
                  <span className="nd"><EntityIcon type={n.assetType} size={card ? 16 : 15} /></span>
                  <span className="nl"><b className={n.assetType === 'RECORD' ? 'mono' : ''} dir="auto" title={name}>{name}</b>
                    <span>{card ? `${st.s} · ${readsOf(n)}` : n.assetType === 'RECORD' ? `${L.changedField ?? 'Record'} changed` : `${typeLabel(n.assetType)} · ${st.s}`}</span></span>
                </button>
              );
            })}
          </div>
        </div>
        {sel && ss && (
          <div className="insp" aria-live="polite">
            <div className="sub fade" key={`${sel.id}-${view}`} style={{ rowGap: 20 }}>
              <div className="c1-5" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span className="cap" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><EntityIcon type={sel.assetType} size={14} />{typeLabel(sel.assetType)} · selected</span>
                <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}><b style={{ fontSize: 20, lineHeight: '28px', fontWeight: 600 }}>{sel.assetType === 'SOURCE' ? L.sourceName : sel.name}</b><span className="chip"><StateMark s={ss.k} />{ss.s}</span></span>
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
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><EntityIcon type={r.type} size={15} style={{ color: 'var(--ink-3)', flex: 'none' }} /><b style={{ fontWeight: 600 }} dir="auto">{r.name}</b></span></td>
                    <td><span className="mono" style={{ fontSize: 13, color: 'var(--ink-2)' }}>{r.type}</span></td>
                    <td><span className="mono" style={{ fontSize: 13, color: 'var(--ink-2)' }}>{r.mode}</span></td>
                    <td><span className="mono" style={{ fontSize: 13 }}>{r.reads}</span></td>
                    <td><span className="chip"><StateMark s={r.st.k} />{r.st.s}</span></td>
                    <td style={{ textAlign: 'right', color: 'var(--ink-3)' }}>{r.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sub" style={{ rowGap: 24 }}>
            <div className="c1-5" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="chip" style={{ padding: '1px 9px 1px 7px', fontSize: 12 }}><StateMark s="impacted" />Impacted</span><span className="meta">Only a protected app, only with proof</span></span>
              <p className="body">An asset is impacted when it is exposed, it is a protected app, and a regression run against it found a material change.{protectedNames.length ? ` ${listNames(protectedNames)} ${protectedNames.length === 1 ? 'is the only protected app' : `are the ${protectedNames.length} protected apps`} here.` : ' No protected app is in this radius.'}</p>
            </div>
            <div className="c6-10" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="chip" style={{ padding: '1px 9px 1px 7px', fontSize: 12 }}><StateMark s="stale" />Stale</span><span className="meta">Only frozen copies, only after promotion</span></span>
              <p className="body">{frozen.length ? <>{listNames(frozen)} {frozen.length === 1 ? 'keeps' : 'keep'} a materialized copy of <span className="mono">{L.trustedLabel}</span>. If <span className="mono">{L.candidate}</span> is approved {frozen.length === 1 ? 'it keeps' : 'they keep'} reading the superseded version until rebuilt.</> : 'No asset in this radius keeps a materialized copy, so none can go stale.'}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}

/** "A and B", "A, B and C", "A, B and 9 others". */
function listNames(xs: string[]) {
  if (xs.length <= 2) return xs.join(' and ');
  if (xs.length <= 4) return `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
  return `${xs.slice(0, 3).join(', ')} and ${xs.length - 3} others`;
}
