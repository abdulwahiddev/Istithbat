import type { CSSProperties } from 'react';
import { edgePath, layoutGraph, typeLabel, type Placed } from '@/components/blast/layout';
import { EntityIcon, StateMark, type StateKey } from '@/components/strata/entity';
import { blurIn, mask, prog } from '../../components/anim';
import { GRAPH, RUN } from '../../data/production';
import { sentenceAt } from '../../timing';
import { cue } from '../stages';
import { useAbs } from '../time';

const S = 's07-blast-radius' as const;
// Column positions, layout options and markup are the Blast Radius instrument's own
// (components/blast/BlastInstrument.tsx XS / layoutGraph call / node buttons / tally).
const XS = [1.5, 13.5, 25.5, 37.5, 49.5, 64, 80];
export const TRACE = { w: 1400, graphTop: 118 };
const LAY = layoutGraph(GRAPH, { xs: XS, centre: 200, gap: 200, height: 400 });
const px = (x: number) => (x / 100) * TRACE.w;
/** Panel-space centre of a node's dot (for carried objects). */
export const nodeAt = (id: string) => {
  const n = LAY.nodes.find((x) => x.id === id)!;
  return n.app ? { x: px(n.x) + 28, y: TRACE.graphTop + 8 + n.y } : { x: px(n.x), y: TRACE.graphTop + 8 + n.y };
};

const stateOf = (n: Placed, impacted: boolean): { s: string; k: StateKey } =>
  n.assetType === 'SOURCE' ? { s: 'Unchanged', k: 'neutral' } : n.assetType === 'RECORD' ? { s: 'Changed', k: 'changed' }
    : n.impact === 'IMPACTED' && impacted ? { s: 'Impacted', k: 'impacted' } : { s: 'Exposed', k: 'exposed' };
const readsOf = (n: Placed) => (n.assetType === 'RECORD' ? `${RUN.versions.trusted} → ${RUN.versions.latest}` : n.servedVersionId ?? n.derivedFromVersionId ?? '—');

/** Trace: the Production dependency graph laid out by the product's layout engine, traced by depth. */
export function TracePanel() {
  const { frame, t } = useAbs();
  const f = (abs: number, d = 0.6) => prog(frame, abs, d);
  const s0 = sentenceAt(S, 0);
  const depthAt = (d: number) => s0.start + 0.1 + (d * (s0.end - s0.start + 0.4)) / 7;
  const tSix = cue(S, 'Six downstream'), tOne = cue(S, 'and one protected');
  const imp = f(tOne + 0.2, 0.6);
  // the trace mask follows the deepest revealed column (the product's `trace` clip, frame-driven)
  const reach = Math.max(0, ...XS.map((x, d) => (t >= depthAt(d) ? x + 12 * f(depthAt(d), 0.9) : 0)));
  const down = LAY.nodes.filter((n) => n.assetType !== 'SOURCE' && n.assetType !== 'RECORD');
  const tally = [...down].sort((a, b) => Number(b.impact === 'IMPACTED') - Number(a.impact === 'IMPACTED'));
  return (
    <div className="scr-blast" style={{ width: TRACE.w }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, ...blurIn(f(s0.start - 0.8)) }}>
        <h3 className="h3">Dependency graph</h3>
        <span className="meta">Exposure is a dependency fact · impact needs proof</span>
      </div>
      <div className="plate" style={{ margin: '16px 0 0', paddingTop: 22, paddingBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 18, borderBottom: '1px solid var(--line)', ...blurIn(f(tSix - 0.1)) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 560 }}>
            <div className="radius" style={{ gridTemplateColumns: `repeat(${down.length},minmax(0,1fr))` }}>
              {tally.map((n, i) => {
                const red = n.impact === 'IMPACTED' && imp > 0.5;
                return <span key={n.id} style={{ background: red ? 'var(--co)' : 'var(--am)', opacity: f(tSix + 0.1 + i * 0.06, 0.4) }} />;
              })}
            </div>
            <span className="cap">Blast radius · {down.length} downstream assets</span>
          </div>
          <div style={{ display: 'flex', gap: 32 }}>
            <span className="cnt"><b style={{ color: imp > 0.5 ? 'var(--co-ink)' : 'var(--ink-3)', ...blurIn(imp, 4, 4), opacity: 0.35 + 0.65 * imp }}>{RUN.blast.impacted}</b><span className="cap">Impacted</span></span>
            <span className="cnt"><b style={{ color: 'var(--am-ink)' }}>{RUN.blast.exposed}</b><span className="cap">Exposed</span></span>
            <span className="cnt"><b style={{ color: 'var(--ink-3)' }}>{RUN.blast.stale}</b><span className="cap">Stale</span></span>
          </div>
        </div>
        <div className="graph" style={{ height: LAY.height }}>
          {LAY.headings.map((h) => <span key={h.depth} className="colh" style={{ left: `${h.x}%`, opacity: f(depthAt(h.depth), 0.5) }}>{h.label}</span>)}
          <svg className="edges" viewBox={`0 0 ${TRACE.w} ${LAY.height}`} style={mask(reach / 100)}>
            {LAY.edges.map((e) => <path key={e.id} className={`e-${e.kind === 'imp' && imp < 0.5 ? 'exp' : e.kind}`} d={edgePath({ x: px(e.a.x), y: e.a.y }, { x: px(e.b.x), y: e.b.y })} />)}
          </svg>
          {[...LAY.nodes].sort((a, b) => a.depth - b.depth || a.y - b.y).map((n) => {
            const p = f(depthAt(n.depth), 0.5);
            const card = n.app;
            const pos: CSSProperties = card ? { left: `${n.x}%`, right: 0, top: n.y - 28 } : { left: `${n.x}%`, top: n.y - 14 };
            const anim: CSSProperties = { opacity: p, translate: `${(1 - p) * -14}px ${(1 - p) * 4}px`, scale: `${0.96 + 0.04 * p}` };
            const name = n.assetType === 'SOURCE' ? n.name.split(' — ')[0] : n.name;
            const view = (impacted: boolean, o = 1) => {
              const st = stateOf(n, impacted);
              return (
                <div key={String(impacted)} className={`node${card ? ' card' : ''} st-${st.k}${impacted && n.impact === 'IMPACTED' ? ' on' : ''}`}
                  style={{ ...pos, ...anim, opacity: p * o, ...(card && n.impact === 'IMPACTED' && impacted ? { borderColor: 'var(--co)', boxShadow: '0 0 0 1px var(--co),var(--float-shadow)' } : {}) }}>
                  <span className="nd"><EntityIcon type={n.assetType} size={card ? 16 : 15} /></span>
                  <span className="nl"><b className={n.assetType === 'RECORD' ? 'mono' : ''} dir="auto">{name}</b>
                    <span>{card ? `${st.s} · ${readsOf(n)}` : n.assetType === 'RECORD' ? `${RUN.field} changed` : `${typeLabel(n.assetType)} · ${st.s}`}</span></span>
                </div>
              );
            };
            return n.impact === 'IMPACTED' ? <div key={n.id}>{view(false, 1 - imp)}{view(true, imp)}</div> : view(false);
          })}
        </div>
        <div className="insp" style={{ display: 'flex', alignItems: 'center', gap: 14, ...blurIn(f(tOne + 1.1)) }}>
          <span className="chip"><StateMark s="impacted" />Impacted</span>
          <b style={{ fontSize: 17 }}>{RUN.app}</b>
          <span className="body" style={{ color: 'var(--ink-2)', fontSize: 15 }}>Exposed, a protected app, and a matched regression run found a material change. All three conditions hold, so it is impacted.</span>
        </div>
      </div>
    </div>
  );
}
