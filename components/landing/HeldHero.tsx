'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { GEO, pts, type Geo, type Pt } from './geometry';
import { FREEZE, runHero } from './timeline';
import { Icon, type IconName } from '@/components/strata/icons';

/**
 * Landing hero · Direction E "Held". The page renders State F (the complete story) on the server:
 * v14 held above the trust boundary by POL-002, v13 trusted and serving Islamic Q&A. Motion is an
 * enhancement layered on top once the page is interactive, and is skipped under reduced motion.
 */
export function HeldHero() {
  const root = useRef<HTMLElement>(null);
  const plate = useRef<HTMLImageElement>(null);
  const [noMedia, setNoMedia] = useState(false);

  useEffect(() => {
    const el = root.current; if (!el) return;
    const q = new URLSearchParams(window.location.search);
    if (q.get('media') === 'off') setNoMedia(true);
    // The plate can fail before hydration attaches onError.
    const img = plate.current;
    if (img && img.complete && img.naturalWidth === 0) setNoMedia(true);
    const st = q.get('st');
    const freeze = st && st in FREEZE ? FREEZE[st] : undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let dispose: (() => void) | null = null;
    const start = () => { dispose?.(); dispose = null; if (freeze != null || !mq.matches) dispose = runHero(el, { freeze }); };
    start();
    mq.addEventListener('change', start);
    return () => { mq.removeEventListener('change', start); dispose?.(); };
  }, []);

  return (
    <section ref={root} className={`lh-hero${noMedia ? ' nomedia' : ''}`} aria-labelledby="lh-title">
      <div className="lh-stage">
        <div className="lh-copy">
          <p className="lh-eyebrow"><span className="lh-rule" aria-hidden="true" />Integrity infrastructure for Islamic knowledge</p>
          <h1 id="lh-title" className="lh-h1">Know when trusted knowledge changes.</h1>
          <p className="lh-lede">Istithbat detects source changes, tests their effect on AI answers, and keeps unreviewed knowledge out of production.</p>
          <p className="lh-principle">
            <span><Mark layer="ai" size={16} />AI advises.</span>
            <span><Mark layer="pol" size={16} />Policy governs.</span>
            <span><Mark layer="hum" size={16} />Humans decide.</span>
          </p>
          <div className="lh-ctas">
            <Link prefetch={false} className="lbtn lbtn-p" href="/overview">Open Istithbat <Icon name="arrow-up-right" size={16} /></Link>
            <Link prefetch={false} className="lbtn lbtn-g" href="/sandbox"><span className="live" aria-hidden="true" />Run live sandbox</Link>
          </div>
        </div>

        <div className="lh-media" role="img"
          aria-label="The trusted record history, v13, rests as a stack and keeps serving the Islamic Q&A app along a continuous path. A newer version, v14, is suspended above it at the trust boundary, held by policy POL-002 until a reviewer decides. During the sequence, one of its 11 fields is shown changed, AI flags evidence-scope drift as advisory, and 2 of 3 matched answers changed.">
          <picture>
            <source media="(max-width: 760px)" srcSet="/landing/e-plate-mobile.jpg" width={780} height={563} />
            <img ref={plate} className="lh-plate" src="/landing/e-plate-1920.jpg" alt="" width={1920} height={1072} fetchPriority="high" decoding="async" onError={() => setNoMedia(true)} />
          </picture>
          <div className="lh-sheet" data-a="sheet">
            <picture>
              <source media="(max-width: 760px)" srcSet="/landing/e-sheet-layer-mobile.jpg" width={681} height={104} />
              <img src="/landing/e-sheet-layer.jpg" alt="" width={1095} height={167} decoding="async" />
            </picture>
          </div>
          <Fallback g={GEO.desktop} cls="d" />
          <Fallback g={GEO.mobile} cls="m" />
          <Overlay g={GEO.desktop} mode="d" />
          <Overlay g={GEO.mobile} mode="m" />
        </div>

        <div className="lh-readout" role="group" aria-label="Serving state for islamic-qa-demo: latest seen v14, held and not served, is not the trusted version v13; trusted v13 equals served v13, serving production.">
          <div className="lh-rttl" aria-hidden="true"><Mark layer="det" />Serving state<span className="mono">islamic-qa-demo</span></div>
          <div className="lh-eqn" aria-hidden="true">
            <div className="cell seen">
              <span className="k">Latest seen</span>
              <span className="v roll"><span data-a="r14" className="co">v14</span><span data-a="r13" className="r13">v13</span></span>
              <span className="st" data-a="heldst"><i />Held · not served</span>
            </div>
            <span className="op roll"><span data-a="r14" className="co">≠</span><span data-a="r13" className="r13">=</span></span>
            <div className="pair">
              <div className="row">
                <div className="cell"><span className="k">Trusted</span><span className="v">v13</span></div>
                <span className="op">=</span>
                <div className="cell"><span className="k">Served</span><span className="v">v13</span></div>
              </div>
              <span className="bar"><i />Serving production</span>
            </div>
          </div>
        </div>

        <ul className="lh-mlist" aria-label="What Istithbat found">
          <li><Mark layer="src" /><span>«<bdi lang="ar" className="ar">إسناده</bdi>» removed · 1 of 11 fields</span></li>
          <li><Mark layer="ai" /><span className="pu">Evidence-scope drift · advisory, not a ruling</span></li>
          <li><Mark layer="det" /><span>2 of 3 matched answers changed</span></li>
        </ul>

        <p className="lh-syn"><i aria-hidden="true" />Controlled synthetic source — not real hadith data</p>
      </div>
    </section>
  );
}

/**
 * Strata layer marks, from the product's own icon set (components/strata/icons.tsx, Lucide):
 * source = database, deterministic = fingerprint, AI = sparkles, policy = scale, human = user-check.
 */
const LAYER = { src: 'database', det: 'fingerprint-pattern', ai: 'sparkles', pol: 'scale', hum: 'user-check' } as const satisfies Record<string, IconName>;
function Mark({ layer, size = 14 }: { layer: keyof typeof LAYER; size?: number }) {
  return <Icon name={LAYER[layer]} size={size} className={`lm lm-${layer}`} />;
}

/** A label pinned to a point of the media box; the inner element is what animates. */
function Pin({ at, tf, cls = '', a, children, right }: { at: Pt; tf?: string; cls?: string; a?: string; children: ReactNode; right?: boolean }) {
  const style: CSSProperties = right ? { right: `${100 - at[0]}%`, top: `${at[1]}%` } : { left: `${at[0]}%`, top: `${at[1]}%`, transform: tf };
  return <div className={`lh-pin ${cls}`} style={style}><div data-a={a}>{children}</div></div>;
}

function Overlay({ g, mode }: { g: Geo; mode: 'd' | 'm' }) {
  const ns = { vectorEffect: 'non-scaling-stroke' as const };
  const T = g.stackTop, P = g.plane;
  const desk = mode === 'd';
  return (
    <div className={`lh-ov ${mode}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* trust boundary: open (dashed) until policy holds, then a double rule with a firmer stopped edge */}
        <polygon data-a="open" className="b-open" points={pts(P)} {...ns} />
        <g data-a="shut" className="b-shut">
          <polygon points={pts(P)} className="b-outer" {...ns} />
          <polygon points={pts(g.inner)} className="b-inner" {...ns} />
        </g>
        <polyline data-a="stop" className="b-stop" points={pts(g.stopEdge)} {...ns} />
        {/* the serving path: v13's trusted edge into Islamic Q&A — runs in every state */}
        <polyline className="sv-edge" points={pts(g.serveTop)} {...ns} />
        <polyline className="sv-down" points={pts(g.serveDown)} {...ns} />
        <polyline className="sv-flow" points={pts(g.serve)} {...ns} />
        {/* fingerprint scan across the candidate (C) */}
        {/* Drawn strokes use pathLength, which non-scaling strokes ignore; widths are in viewBox units. */}
        <line data-a="scan" className="scan" x1={g.scan[0][0]} y1={g.scan[0][1]} x2={g.scan[1][0]} y2={g.scan[1][1]} pathLength={1} />
        {desk && <>
          <line data-a="ldiff" className="lead" x1={56} y1={23.5} x2={60} y2={36} pathLength={1} />
          <line data-a="lai" className="lead ai" x1={85} y1={17} x2={84} y2={36.5} pathLength={1} />
        </>}
      </svg>

      <Pin at={desk ? [g.sheet[0][0], g.sheet[0][1] - 4] : [4, 4]} tf={desk ? 'translateY(-100%)' : undefined} cls="c14" a="c14">
        <span className="vchip"><span className="ver co">v14</span><span className="vt"><span className="lbl">Latest seen</span><span data-a="heldword" className="co"> · held</span>
          {desk && <small><span data-a="fields">1 of 11 fields changed</span><span data-a="tested"> · tested</span></small>}</span></span>
      </Pin>
      <Pin at={desk ? T[0] : [4, 84]} tf={desk ? 'translate(calc(-100% - 16px),-50%)' : undefined} cls="c13">
        <span className="vchip"><span className="ver tq">v13</span><span className="vt"><span className="lbl">Trusted · </span><span className="tq">serving</span></span></span>
      </Pin>
      {desk && <Pin at={P[0]} tf="translate(calc(-100% - 14px),calc(-100% - 22px))" cls="bnd"><span className="bnd-l"><Icon name="shield" size={14} />Trust boundary</span></Pin>}
      <Pin at={desk ? P[0] : [96, 4]} right={!desk} tf={desk ? 'translate(calc(-100% - 14px),-17px)' : undefined} cls="held">
        <span className="held-in">
          <span className="lock" data-a="lock"><Icon name="lock" size={14} stroke={2} />Held · <span className="mono">POL-002</span></span>
          <span className="rev" data-a="rev"><Mark layer="hum" />Reviewer decides</span>
        </span>
      </Pin>
      <Pin at={g.card} tf="translateX(-50%)" cls="app">
        <div className="app-card"><div className="row"><b>Islamic Q&amp;A</b><span className="chip tq"><i />Serving</span></div><p>Reads <span className="mono">v13</span> · uninterrupted</p></div>
      </Pin>
      {desk && <>
        <Pin at={[44, 3.5]} cls="tag" a="tdiff">
          <span className="tag-in"><span className="k"><Mark layer="src" />Exact change · 1 of 11 fields</span>
            <span className="ar-diff"><bdi lang="ar" className="ar"><span className="rm">إسناده</span> صحيح</bdi><span className="arrow" aria-hidden="true">→</span><bdi lang="ar" className="ar">صحيح</bdi></span>
            <span className="k"><Mark layer="det" /><span className="mono hash">3f9a1c0e → b81e47d2</span></span></span>
        </Pin>
        <Pin at={[74, 2]} cls="tag" a="tai">
          <span className="tag-in adv"><span className="k"><Mark layer="ai" />AI advisory</span><span className="v pu">Evidence-scope drift</span><small className="pu">Advisory. Not a ruling.</small></span>
        </Pin>
        <Pin at={[74, 17]} cls="tag" a="treg">
          <span className="tag-in"><span className="k"><Mark layer="det" />Matched regression</span><span className="v"><span className="co">2 of 3</span> answers changed</span><small>Same model and settings</small></span>
        </Pin>
      </>}
    </div>
  );
}

/** Coded fallback with the same measured geometry: the story survives a failed image. */
function Fallback({ g, cls }: { g: Geo; cls: 'd' | 'm' }) {
  const T = g.stackTop;
  return (
    <svg className={`lh-fb ${cls}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polygon points={pts([T[0], T[3], g.stackFB, g.stackLB])} fill="#C8C4BC" />
      <polygon points={pts([T[3], T[2], g.stackRB, g.stackFB])} fill="#8E8B85" />
      <polygon points={pts(T)} fill="#E6E3DD" />
      <polyline points={pts([T[0], T[3], T[2]])} fill="none" stroke="#22D3C5" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <g data-a="fbsheet"><polygon points={pts(g.sheet)} fill="#EEECE7" stroke="#FF6B5E" strokeWidth={1.5} vectorEffect="non-scaling-stroke" /></g>
    </svg>
  );
}
