'use client';
import { useEffect, useRef } from 'react';
import type { PlacedEdge } from './layout';

export type FlowEdge = PlacedEdge & { path: string; tone: string; fromDepth: number; toNode: string; strong: boolean };

const HOP = 620; // ms per dependency hop
const ARRIVE = 900; // let the last arrival land before the pause
const PAUSE = 1700;
const STREAK = 56; // px of lit path behind the signal head
const ease = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2;

/**
 * Dependency flow: a short signal leaves the source, crosses each hop in order, branches at the
 * APIs and lands on every asset it reaches; the protected app that is proven impacted receives a
 * coral signal. Then a pause, and it repeats. Purely presentational over the persisted graph:
 * pointer-events none, transform/opacity only, paused when off-screen or the tab is hidden, and
 * absent under prefers-reduced-motion (the static graph is the final state).
 */
export function FlowLayer({ edges, width, height, host, cycleKey }: { edges: FlowEdge[]; width: number; height: number; host: React.RefObject<HTMLDivElement | null>; cycleKey: string }) {
  const g = useRef<SVGGElement>(null);

  useEffect(() => {
    const root = g.current, el = host.current;
    if (!root || !el || !edges.length || !width) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const paths = new Map<string, SVGPathElement>();
    root.querySelectorAll<SVGPathElement>('path[data-e]').forEach((p) => paths.set(p.dataset.e!, p));
    const parts = new Map<string, { streak: SVGPathElement; core: SVGPathElement; halo: SVGCircleElement; head: SVGCircleElement }>();
    root.querySelectorAll<SVGGElement>('g[data-e]').forEach((x) => parts.set(x.dataset.e!, { streak: x.querySelector('.streak')!, core: x.querySelector('.core')!, halo: x.querySelector('.halo')!, head: x.querySelector('.head')! }));
    const lengths = new Map([...paths].map(([k, p]) => [k, p.getTotalLength()]));
    const depths = [...new Set(edges.map((e) => e.fromDepth))].sort((a, b) => a - b);
    const startOf = new Map(edges.map((e) => [e.id, depths.indexOf(e.fromDepth) * HOP]));
    const cycle = depths.length * HOP + ARRIVE + PAUSE;

    let raf = 0, t0 = performance.now(), lastCycle = -1, visible = true;
    const landed = new Set<string>();
    const hideAll = () => parts.forEach((x) => { x.streak.style.opacity = '0'; x.core.style.opacity = '0'; x.halo.setAttribute('opacity', '0'); x.head.setAttribute('opacity', '0'); });
    const ping = (e: FlowEdge) => {
      const node = el.querySelector<HTMLElement>(`[data-node="${CSS.escape(e.toNode)}"] .ping`);
      const card = !!node?.closest('.card');
      node?.animate(e.strong
        ? [{ opacity: 0.9, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.05)' }]
        : card ? [{ opacity: 0.55, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.03)' }]
        : [{ opacity: 0.6, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(2.1)' }],
      { duration: e.strong ? 1300 : 750, easing: 'cubic-bezier(.2,.7,.3,1)', iterations: e.strong ? 2 : 1 });
    };
    const frame = (now: number) => {
      const t = (now - t0) % cycle, c = Math.floor((now - t0) / cycle);
      if (c !== lastCycle) { lastCycle = c; landed.clear(); }
      for (const e of edges) {
        const p = paths.get(e.id), x = parts.get(e.id), len = lengths.get(e.id);
        if (!p || !x || !len) continue;
        const q = (t - startOf.get(e.id)!) / HOP;
        if (q <= 0 || q >= 1.25) { x.streak.style.opacity = '0'; x.core.style.opacity = '0'; x.halo.setAttribute('opacity', '0'); x.head.setAttribute('opacity', '0'); }
        else {
          const at = ease(Math.min(1, q)) * len;
          const fade = q < 1 ? Math.min(1, q * 6) : Math.max(0, 1 - (q - 1) * 4);
          const seg = Math.min(STREAK, at);
          x.streak.style.strokeDasharray = `${seg.toFixed(1)} ${(len + STREAK).toFixed(1)}`;
          x.streak.style.strokeDashoffset = (-(at - seg)).toFixed(1);
          x.streak.style.opacity = String(0.95 * fade);
          const cseg = seg * 0.55;
          x.core.style.strokeDasharray = `${cseg.toFixed(1)} ${(len + STREAK).toFixed(1)}`;
          x.core.style.strokeDashoffset = (-(at - cseg)).toFixed(1);
          x.core.style.opacity = String(0.85 * fade);
          const pt = p.getPointAtLength(at);
          x.head.setAttribute('cx', pt.x.toFixed(1)); x.head.setAttribute('cy', pt.y.toFixed(1)); x.head.setAttribute('opacity', String(q < 1 ? fade : 0));
          x.halo.setAttribute('cx', pt.x.toFixed(1)); x.halo.setAttribute('cy', pt.y.toFixed(1)); x.halo.setAttribute('opacity', String(q < 1 ? 0.22 * fade : 0));
        }
        if (q >= 1 && !landed.has(e.id)) { landed.add(e.id); ping(e); }
      }
      raf = requestAnimationFrame(frame);
    };
    // While signals run, the static edges step back so the flow reads; they return to full strength when it stops.
    const start = () => { if (!raf && visible && !document.hidden && !mq.matches) { t0 = performance.now(); lastCycle = -1; el.dataset.flow = ''; raf = requestAnimationFrame(frame); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; hideAll(); delete el.dataset.flow; };
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); else stop(); }, { threshold: 0.15 });
    io.observe(el);
    const onVis = () => (document.hidden ? stop() : start());
    const onMq = () => (mq.matches ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    mq.addEventListener('change', onMq);
    start();
    return () => { stop(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); mq.removeEventListener('change', onMq); };
  }, [edges, width, host, cycleKey]);

  return (
    <svg className="flow" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <g ref={g}>
        {edges.map((e) => (
          <g key={e.id} data-e={e.id}>
            <path data-e={e.id} d={e.path} fill="none" stroke="none" />
            <path className="streak" d={e.path} fill="none" stroke={e.tone} strokeWidth={e.strong ? 4 : 3.2} strokeLinecap="round" style={{ opacity: 0 }} />
            <path className="core" d={e.path} fill="none" stroke="var(--plate-a)" strokeWidth={1.2} strokeLinecap="round" style={{ opacity: 0 }} />
            <circle className="halo" r={e.strong ? 11 : 9} cx={-20} cy={-20} opacity={0} fill={e.tone} />
            <circle className="head" r={e.strong ? 4.6 : 4} cx={-20} cy={-20} opacity={0} fill={e.tone} stroke="var(--plate-a)" strokeWidth={1.5} />
          </g>
        ))}
      </g>
    </svg>
  );
}
