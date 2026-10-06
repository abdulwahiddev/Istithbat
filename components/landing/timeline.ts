/**
 * The six-state story as one synchronized Web Animations timeline (no animation library).
 * Every element owns its own keyframes over the same loop, so the sequence is continuous motion of
 * the constituent parts, not a crossfade of states. All tracks start at F_ENTRY, which matches the
 * static server-rendered State F exactly: the first animated frame never jumps.
 *
 *   A healthy 0–0.9s · B change arrives 0.9–2.0 · C detect 2.0–3.3 · D understand/test 3.3–4.7
 *   E contain 4.7–5.8 · F continuity 5.8–7.0 · return 7.0–7.6 (v14 lifts away, readout rolls back)
 *
 * The serving path is deliberately NOT on this timeline: it is its own CSS animation, so nothing in
 * the story can ever pause it.
 */
export const LOOP = 7600;
export const F_ENTRY = 6100;
/** freeze points for ?st=a…f (stills and QA) */
export const FREEZE: Record<string, number> = { a: 450, b: 1750, c: 2950, d: 4150, e: 5550, f: 6500 };

type KF = [ms: number, frame: Keyframe];
export type Track = { sel: string; kf: KF[] };

const OUT = 'cubic-bezier(.16,1,.3,1)', INOUT = 'cubic-bezier(.65,0,.35,1)', IN = 'cubic-bezier(.55,0,.75,.2)';
const fade = (on: number, off: number, d = 6, inDur = 400, outDur = 400): KF[] => [
  [0, { opacity: 0, transform: `translateY(${d}px)` }],
  [on, { opacity: 0, transform: `translateY(${d}px)`, easing: OUT }],
  [on + inDur, { opacity: 1, transform: 'none' }],
  [off, { opacity: 1, transform: 'none', easing: INOUT }],
  [off + outDur, { opacity: 0, transform: `translateY(${-d / 2}px)` }],
  [LOOP, { opacity: 0, transform: `translateY(${d}px)` }],
];
const op = (pairs: [number, number][]): KF[] => pairs.map(([t, o]) => [t, { opacity: o, easing: INOUT }]);
const draw = (on: number, dur: number, off: number): KF[] => [
  [0, { strokeDashoffset: 1, opacity: 0 }], [on, { strokeDashoffset: 1, opacity: 1, easing: OUT }], [on + dur, { strokeDashoffset: 0, opacity: 1 }],
  [off, { strokeDashoffset: 0, opacity: 1 }], [off + 400, { strokeDashoffset: 0, opacity: 0 }], [LOOP, { strokeDashoffset: 1, opacity: 0 }],
];

export const TRACKS: Track[] = [
  // B: v14 descends from above as its own sheet, settles held above the boundary, hovers in F (never lands), lifts away.
  { sel: '[data-a=sheet]', kf: [
    [0, { opacity: 0, transform: 'translateY(-150%)' }],
    [900, { opacity: 0, transform: 'translateY(-150%)', easing: 'cubic-bezier(.33,0,.2,1)' }],
    [1450, { opacity: 0.95, transform: 'translateY(-60%)', easing: OUT }],
    [2250, { opacity: 1, transform: 'translateY(0)' }],
    [5800, { opacity: 1, transform: 'translateY(0)', easing: 'ease-in-out' }],
    [6450, { opacity: 1, transform: 'translateY(-3%)', easing: 'ease-in-out' }],
    [7050, { opacity: 1, transform: 'translateY(0)', easing: IN }],
    [LOOP, { opacity: 0, transform: 'translateY(-150%)' }],
  ] },
  // fallback sheet (no media) follows the same arrival
  { sel: '[data-a=fbsheet]', kf: [
    [0, { opacity: 0, transform: 'translateY(-12%)' }], [900, { opacity: 0, transform: 'translateY(-12%)', easing: OUT }],
    [2250, { opacity: 1, transform: 'none' }], [7050, { opacity: 1, transform: 'none', easing: IN }], [LOOP, { opacity: 0, transform: 'translateY(-12%)' }],
  ] },
  // v14 chip and its progressive facts
  { sel: '[data-a=c14]', kf: fade(1150, 7050, 6, 450) },
  { sel: '[data-a=fields]', kf: op([[0, 0], [2600, 0], [3000, 1], [7000, 1], [7300, 0], [LOOP, 0]]) },
  { sel: '[data-a=tested]', kf: op([[0, 0], [4300, 0], [4700, 1], [7000, 1], [7300, 0], [LOOP, 0]]) },
  { sel: '[data-a=heldword]', kf: op([[0, 0], [5000, 0], [5400, 1], [7000, 1], [7300, 0], [LOOP, 0]]) },
  // C: fingerprint scan sweeps the candidate; the exact change attaches by a drawn leader
  { sel: '[data-a=scan]', kf: [
    [0, { strokeDashoffset: 0.2, opacity: 0 }], [2250, { strokeDashoffset: 0.2, opacity: 0 }], [2350, { opacity: 1, strokeDashoffset: 0.2 }],
    [3150, { opacity: 1, strokeDashoffset: -1.05 }], [3300, { opacity: 0, strokeDashoffset: -1.05 }], [LOOP, { opacity: 0, strokeDashoffset: -1.05 }],
  ] },
  { sel: '[data-a=ldiff]', kf: draw(2350, 450, 4450) },
  { sel: '[data-a=tdiff]', kf: fade(2600, 4500, 6, 450, 450) },
  // D: AI advisory and matched regression, each attached, then they recede
  { sel: '[data-a=lai]', kf: draw(3350, 450, 5250) },
  { sel: '[data-a=tai]', kf: fade(3600, 5300, 6, 450, 450) },
  { sel: '[data-a=treg]', kf: fade(3950, 5400, 6, 450, 450) },
  // E: the boundary resolves from open (dashed) to a held double rule; the stopped edge draws; the lock lands
  { sel: '[data-a=open]', kf: op([[0, 0.45], [4900, 0.45], [5300, 0], [7050, 0], [7500, 0.45], [LOOP, 0.45]]) },
  { sel: '[data-a=shut]', kf: op([[0, 0], [4900, 0], [5300, 1], [7050, 1], [7500, 0], [LOOP, 0]]) },
  { sel: '[data-a=stop]', kf: op([[0, 0], [5000, 0], [5500, 1], [7050, 1], [7450, 0], [LOOP, 0]]) },
  { sel: '[data-a=lock]', kf: [
    [0, { opacity: 0, transform: 'translateY(-8px)' }], [5050, { opacity: 0, transform: 'translateY(-8px)', easing: 'cubic-bezier(.2,1.25,.4,1)' }],
    [5450, { opacity: 1, transform: 'none' }], [7050, { opacity: 1, transform: 'none', easing: INOUT }], [7400, { opacity: 0, transform: 'translateY(-4px)' }],
    [LOOP, { opacity: 0, transform: 'translateY(-8px)' }],
  ] },
  // F: the human decision is pending
  { sel: '[data-a=rev]', kf: fade(5900, 7000, 4, 450, 300) },
  // readout: v13 = v13 = v13 rolls to v14 ≠ v13 = v13 in B, and back on return
  // Clipped roll (the container hides overflow): the old value leaves before the new one lands.
  { sel: '[data-a=r13]', kf: [
    [0, { opacity: 1, transform: 'none' }], [1150, { opacity: 1, transform: 'none', easing: IN }], [1350, { opacity: 0, transform: 'translateY(-70%)' }],
    [7280, { opacity: 0, transform: 'translateY(70%)', easing: OUT }], [7520, { opacity: 1, transform: 'none' }], [LOOP, { opacity: 1, transform: 'none' }],
  ] },
  { sel: '[data-a=r14]', kf: [
    [0, { opacity: 0, transform: 'translateY(70%)' }], [1300, { opacity: 0, transform: 'translateY(70%)', easing: OUT }], [1540, { opacity: 1, transform: 'none' }],
    [7100, { opacity: 1, transform: 'none', easing: IN }], [7300, { opacity: 0, transform: 'translateY(-70%)' }], [LOOP, { opacity: 0, transform: 'translateY(70%)' }],
  ] },
  { sel: '[data-a=heldst]', kf: op([[0, 0], [1450, 0], [1800, 1], [7100, 1], [7400, 0], [LOOP, 0]]) },
];

/** Freeze/visibility-aware controller. Returns a disposer. */
export function runHero(root: HTMLElement, opts: { freeze?: number } = {}): () => void {
  const anims: Animation[] = [];
  for (const t of TRACKS) {
    const frames = t.kf.map(([ms, f]) => ({ ...f, offset: ms / LOOP }));
    root.querySelectorAll<HTMLElement | SVGElement>(t.sel).forEach((el) => {
      anims.push(el.animate(frames, { duration: LOOP, iterations: Infinity, fill: 'both' }));
    });
  }
  const at = opts.freeze ?? F_ENTRY;
  for (const a of anims) a.currentTime = at;
  if (opts.freeze != null) { for (const a of anims) a.pause(); root.dataset.paused = ''; return () => anims.forEach((a) => a.cancel()); }

  let onScreen = true;
  const sync = () => {
    const run = onScreen && !document.hidden;
    for (const a of anims) if (run) a.play(); else a.pause();
    if (run) delete root.dataset.paused; else root.dataset.paused = '';
  };
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }, { threshold: 0.15 });
  io.observe(root);
  document.addEventListener('visibilitychange', sync);
  sync();
  return () => { io.disconnect(); document.removeEventListener('visibilitychange', sync); anims.forEach((a) => a.cancel()); };
}
