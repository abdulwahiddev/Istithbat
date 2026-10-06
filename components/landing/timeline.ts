/**
 * The six-state story as one synchronized Web Animations timeline (no animation library).
 * Every element owns its own keyframes over the same loop, so the sequence is continuous motion of
 * the constituent parts, not a crossfade of states. All tracks start at F_ENTRY, which matches the
 * static server-rendered State F exactly: the first animated frame never jumps.
 *
 * Rhythm: quick reveal → stable reading hold → quick exit. Movement stays crisp; the time goes into
 * the holds, so every evidence card is fully visible and still long enough to read.
 *
 *   A healthy        0.0–1.3s  hold 1.3s  (v13 = v13 = v13, serving)
 *   A→B              1.3–2.1s  v14 descends in ~0.75s; readout rolls to v14 ≠
 *   B arrived        2.1–3.3s  hold 1.2s
 *   C exact change   3.3–6.2s  revealed by 3.9s, readable hold ~2.0s, exit 0.3s
 *   D advisory+test  6.1–9.9s  both cards complete by 6.9s, readable together ~2.7s, exit together 0.3s
 *   E contain        9.9–10.7s boundary resolves, POL-002 lock lands, "Reviewer decides"
 *   E/F hold        10.7–12.6s held state readable ~1.9s (F: the sheet hovers, nothing else moves)
 *   return          12.6–13.2s v14 lifts away, readout rolls back to A
 *
 * The serving path is deliberately NOT on this timeline: it is its own CSS animation, so nothing in
 * the story can ever pause it.
 */
export const LOOP = 13200;
export const F_ENTRY = 11300;
/** freeze points for ?st=a…f (stills and QA) */
export const FREEZE: Record<string, number> = { a: 700, b: 2900, c: 5000, d: 8300, e: 10900, f: 12300 };

type KF = [ms: number, frame: Keyframe];
export type Track = { sel: string; kf: KF[] };

const OUT = 'cubic-bezier(.16,1,.3,1)', INOUT = 'cubic-bezier(.65,0,.35,1)', IN = 'cubic-bezier(.55,0,.75,.2)';
/** reveal → hold → exit: short translation, no overshoot; once in, the element is still */
const fade = (on: number, off: number, d = 4, inDur = 400, outDur = 300): KF[] => [
  [0, { opacity: 0, transform: `translateY(${d}px)` }],
  [on, { opacity: 0, transform: `translateY(${d}px)`, easing: OUT }],
  [on + inDur, { opacity: 1, transform: 'none' }],
  [off, { opacity: 1, transform: 'none', easing: IN }],
  [off + outDur, { opacity: 0, transform: `translateY(${-d / 2}px)` }],
  [LOOP, { opacity: 0, transform: `translateY(${d}px)` }],
];
const op = (pairs: [number, number][]): KF[] => pairs.map(([t, o]) => [t, { opacity: o, easing: INOUT }]);
const draw = (on: number, dur: number, off: number, outDur = 300): KF[] => [
  [0, { strokeDashoffset: 1, opacity: 0 }], [on, { strokeDashoffset: 1, opacity: 1, easing: OUT }], [on + dur, { strokeDashoffset: 0, opacity: 1 }],
  [off, { strokeDashoffset: 0, opacity: 1 }], [off + outDur, { strokeDashoffset: 0, opacity: 0 }], [LOOP, { strokeDashoffset: 1, opacity: 0 }],
];

export const TRACKS: Track[] = [
  // A→B: v14 descends from above as its own sheet (~0.75s), settles held above the boundary,
  // hovers in F (never lands), lifts away on return.
  { sel: '[data-a=sheet]', kf: [
    [0, { opacity: 0, transform: 'translateY(-150%)' }],
    [1300, { opacity: 0, transform: 'translateY(-150%)', easing: 'cubic-bezier(.33,0,.2,1)' }],
    [1700, { opacity: 0.95, transform: 'translateY(-55%)', easing: OUT }],
    [2100, { opacity: 1, transform: 'translateY(0)' }],
    [10900, { opacity: 1, transform: 'translateY(0)', easing: 'ease-in-out' }],
    [11700, { opacity: 1, transform: 'translateY(-3%)', easing: 'ease-in-out' }],
    [12600, { opacity: 1, transform: 'translateY(0)', easing: IN }],
    [13150, { opacity: 0, transform: 'translateY(-150%)' }],
    [LOOP, { opacity: 0, transform: 'translateY(-150%)' }],
  ] },
  { sel: '[data-a=fbsheet]', kf: [
    [0, { opacity: 0, transform: 'translateY(-12%)' }], [1300, { opacity: 0, transform: 'translateY(-12%)', easing: OUT }],
    [2100, { opacity: 1, transform: 'none' }], [12600, { opacity: 1, transform: 'none', easing: IN }], [13150, { opacity: 0, transform: 'translateY(-12%)' }],
    [LOOP, { opacity: 0, transform: 'translateY(-12%)' }],
  ] },
  // B: the v14 chip, then its progressive facts (C adds "1 of 11 fields changed", D adds "tested", E adds "held")
  { sel: '[data-a=c14]', kf: fade(1650, 12650, 4, 400, 250) },
  { sel: '[data-a=fields]', kf: op([[0, 0], [3600, 0], [3900, 1], [12600, 1], [12800, 0], [LOOP, 0]]) },
  { sel: '[data-a=tested]', kf: op([[0, 0], [6600, 0], [6900, 1], [12600, 1], [12800, 0], [LOOP, 0]]) },
  { sel: '[data-a=heldword]', kf: op([[0, 0], [10050, 0], [10350, 1], [12600, 1], [12800, 0], [LOOP, 0]]) },
  // C: fingerprint scan, then the exact change attaches by its leader; held readable ~2.0s
  { sel: '[data-a=scan]', kf: [
    [0, { strokeDashoffset: 0.2, opacity: 0 }], [3300, { strokeDashoffset: 0.2, opacity: 0 }], [3380, { opacity: 1, strokeDashoffset: 0.2 }],
    [4000, { opacity: 1, strokeDashoffset: -1.05 }], [4150, { opacity: 0, strokeDashoffset: -1.05 }], [LOOP, { opacity: 0, strokeDashoffset: -1.05 }],
  ] },
  { sel: '[data-a=ldiff]', kf: draw(3350, 350, 5900) },
  { sel: '[data-a=tdiff]', kf: fade(3500, 5900, 4, 420, 300) },
  // D: AI advisory, then the matched regression; both complete by 6.9s, read together ~2.7s, leave together
  { sel: '[data-a=lai]', kf: draw(6050, 350, 9600) },
  { sel: '[data-a=tai]', kf: fade(6150, 9600, 4, 400, 300) },
  { sel: '[data-a=treg]', kf: fade(6500, 9600, 4, 400, 300) },
  // E: the boundary resolves from open (dashed) to a held double rule; the stopped edge firms; the lock lands
  { sel: '[data-a=open]', kf: op([[0, 0.45], [9850, 0.45], [10250, 0], [12600, 0], [13000, 0.45], [LOOP, 0.45]]) },
  { sel: '[data-a=shut]', kf: op([[0, 0], [9850, 0], [10250, 1], [12600, 1], [13000, 0], [LOOP, 0]]) },
  { sel: '[data-a=stop]', kf: op([[0, 0], [9950, 0], [10350, 1], [12600, 1], [12950, 0], [LOOP, 0]]) },
  { sel: '[data-a=lock]', kf: fade(10000, 12500, -6, 380, 250) },
  { sel: '[data-a=rev]', kf: fade(10300, 12500, 4, 350, 250) },
  // readout: v13 = v13 = v13 rolls to v14 ≠ v13 = v13 as v14 arrives, and back on return.
  // Clipped roll (the container hides overflow): the old value leaves before the new one lands.
  { sel: '[data-a=r13]', kf: [
    [0, { opacity: 1, transform: 'none' }], [1550, { opacity: 1, transform: 'none', easing: IN }], [1730, { opacity: 0, transform: 'translateY(-70%)' }],
    [12950, { opacity: 0, transform: 'translateY(70%)', easing: OUT }], [13180, { opacity: 1, transform: 'none' }], [LOOP, { opacity: 1, transform: 'none' }],
  ] },
  { sel: '[data-a=r14]', kf: [
    [0, { opacity: 0, transform: 'translateY(70%)' }], [1700, { opacity: 0, transform: 'translateY(70%)', easing: OUT }], [1920, { opacity: 1, transform: 'none' }],
    [12800, { opacity: 1, transform: 'none', easing: IN }], [12980, { opacity: 0, transform: 'translateY(-70%)' }], [LOOP, { opacity: 0, transform: 'translateY(70%)' }],
  ] },
  { sel: '[data-a=heldst]', kf: op([[0, 0], [1850, 0], [2150, 1], [12750, 1], [12950, 0], [LOOP, 0]]) },
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
