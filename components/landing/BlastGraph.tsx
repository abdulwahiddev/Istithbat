'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EntityIcon } from '@/components/strata/entity';
import { typeLabel } from '@/components/blast/layout';
import { FlowLayer, type FlowEdge } from '@/components/blast/FlowLayer';
import type { Derived } from './derive';

type G = Derived['radius']['graph'];
const HOP = 280; // ms per dependency hop while the radius draws outward
const START = 260;
const TONE: Record<string, string> = { neutral: 'var(--ink-3)', changed: 'var(--co)', exposed: 'var(--am)', pending: 'var(--am)', impacted: 'var(--co)' };

/**
 * Blast radius on the landing: the product's placement (components/blast/layout), the product's
 * edge geometry (edgePath) and, once the radius has drawn, the product's dependency signal
 * (components/blast/FlowLayer). Drawn at a fixed design width and scaled uniformly, so strokes can
 * be drawn by length. Nodes light in dependency order as their edge arrives.
 */
export function BlastGraph({ g, source, field, trusted, candidate }: { g: G; source: string; field: string; trusted: string; candidate: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [flow, setFlow] = useState(false);
  useEffect(() => {
    const el = host.current; if (!el) return;
    let t = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || t) return;
      // let the outward draw finish before the first signal travels
      t = window.setTimeout(() => setFlow(true), START + 7 * HOP + 600);
      io.disconnect();
    }, { threshold: 0.3 });
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);

  const edges: FlowEdge[] = useMemo(() => g.edges.map((e) => ({
    id: e.id, from: e.from, to: e.to, d: e.path, kind: e.kind, a: { x: 0, y: 0 }, b: { x: 0, y: 0 },
    path: e.path, tone: TONE[e.toState], fromDepth: e.fromDepth, toNode: e.to, strong: e.toState === 'impacted',
  })), [g]);

  const sub = (n: G['nodes'][number]) => n.type === 'SOURCE' ? `${candidate} seen · ${trusted} trusted`
    : n.type === 'RECORD' ? `${field} changed`
    : n.state === 'pending' ? 'Exposed · impact pending validation'
    : n.state === 'impacted' ? `Impacted · reads ${trusted}`
    : n.app ? `Exposed${n.protectedApp ? ` · reads ${trusted}` : ' · not protected'}`
    : `${typeLabel(n.type)} · ${n.mode === 'MATERIALIZED' ? 'frozen copy' : 'exposed'}`;

  return (
    <div className="bg" aria-hidden="true">
      <div ref={host} className="bg-stage" style={{ aspectRatio: `${g.w} / ${g.h}` }}>
        {g.headings.map((h) => <span key={h.depth} className="colh fx-fade" data-t={START + h.depth * HOP - 120} style={{ left: `${h.x}%` }}>{h.label}</span>)}
        <svg className="bg-edges" viewBox={`0 0 ${g.w} ${g.h}`}>
          {g.edges.map((e) => <path key={e.id} className={`e-${e.toState} k-${e.kind} fx-draw`} d={e.path} pathLength={1} data-t={START + e.fromDepth * HOP} />)}
        </svg>
        {flow && <FlowLayer edges={edges} width={g.w} height={g.h} host={host} cycleKey="landing" />}
        {g.nodes.map((n) => (
          <div key={n.id} data-node={n.id} className={`gn st-${n.state}${n.app ? ' card' : ''} fx-lit`} data-t={START + Math.max(0, n.depth - 1) * HOP + (n.depth ? HOP : 0)}
            style={{ left: `${n.x}%`, top: `${(n.y / g.h) * 100}%` }}>
            <span className="nd"><span className="ping" /><EntityIcon type={n.type} size={n.app ? 16 : 15} /></span>
            <span className="nl"><b className={n.type === 'RECORD' ? 'mono' : ''}>{n.type === 'RECORD' ? `${source}:${n.name}` : n.name}</b><span>{sub(n)}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
