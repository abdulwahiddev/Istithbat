import { keyed } from '../components/anim';
import { FPS, scene } from '../timing';
import { cue, PRESS_AT, stage, type StageId } from './stages';

export type Cam = { x: number; y: number; s: number; blur: number };
type Key = { t: number; x: number; y: number; s: number };

/** Viewport (screen px) the world is projected into: under the HUD, above the evidence tray. */
export const VIEW = { cx: 960, cy: 490, top: 112, bottom: 868 };

const K: Key[] = [];
const hold = (id: StageId, t0: number, t1: number, o: { dx?: number; dy?: number; push?: number } = {}) => {
  const st = stage(id);
  K.push({ t: t0, x: st.x + (o.dx ?? 0), y: o.dy ?? 0, s: st.s });
  K.push({ t: t1, x: st.x + (o.dx ?? 0), y: o.dy ?? 0, s: st.s * (1 + (o.push ?? 0.022)) });
};
/** Travel to the next stage: pull back slightly mid-way so the move reads as moving through space. */
const travel = (from: StageId, to: StageId, t0: number, t1: number) => {
  const a = stage(from), b = stage(to);
  K.push({ t: (t0 + t1) / 2, x: (a.x + b.x) / 2, y: 0, s: Math.min(a.s, b.s) * 0.74 });
};
const focus = (id: StageId, t: number, dx: number, dy: number, s: number) => K.push({ t, x: stage(id).x + dx, y: dy, s });

const B = (id: Parameters<typeof scene>[0]) => scene(id).start;

// Publish (/sandbox operator console): settle, then lean toward the button as it is pressed
hold('publish', B('s03-publish'), PRESS_AT - 1.8, { push: 0.01 });
focus('publish', PRESS_AT + 0.2, -20, 110, 1.08);
focus('publish', B('s04-pipeline') - 0.75, 0, 110, 1.1);
travel('publish', 'pipeline', B('s04-pipeline') - 0.75, B('s04-pipeline') + 0.45);
// Pipeline overview (time-compressed Production run)
hold('pipeline', B('s04-pipeline') + 0.45, B('s05-exact-change') - 0.75);
travel('pipeline', 'detect', B('s05-exact-change') - 0.75, B('s05-exact-change') + 0.45);
// Detect: exact change, then push in on the Arabic when the grading field is named
hold('detect', B('s05-exact-change') + 0.45, cue('s05-exact-change', 'Only the grading field') - 0.1, { push: 0.01 });
focus('detect', cue('s05-exact-change', 'Only the grading field') + 0.9, 60, -40, 1.32);
focus('detect', B('s06-regression') - 0.75, 60, -40, 1.34);
travel('detect', 'test', B('s06-regression') - 0.75, B('s06-regression') + 0.45);
// Test: matched regression
hold('test', B('s06-regression') + 0.45, B('s07-blast-radius') - 0.75);
travel('test', 'trace', B('s07-blast-radius') - 0.75, B('s07-blast-radius') + 0.45);
// Trace: Blast Radius, then settle on Islamic Q&A
hold('trace', B('s07-blast-radius') + 0.45, cue('s07-blast-radius', 'and one protected') - 0.2, { push: 0.0 });
focus('trace', cue('s07-blast-radius', 'and one protected') + 0.8, 150, 0, 1.22);
focus('trace', B('s08-gateway') - 0.75, 160, 0, 1.24);
travel('trace', 'contain', B('s08-gateway') - 0.75, B('s08-gateway') + 0.45);
// Contain: Trust Gateway
hold('contain', B('s08-gateway') + 0.45, B('s09-human-review') - 0.75);
travel('contain', 'human', B('s09-human-review') - 0.75, B('s09-human-review') + 0.45);
// Human decision
hold('human', B('s09-human-review') + 0.45, scene('s09-human-review').end, { push: 0.02, dy: -36 });

K.sort((a, b) => a.t - b.t);
const sx = K.map((k) => ({ t: k.t, v: k.x })), sy = K.map((k) => ({ t: k.t, v: k.y })), ss = K.map((k) => ({ t: k.t, v: k.s }));

/** Camera at an absolute frame of the film. */
export function camAt(absFrame: number): Cam {
  const x = keyed(absFrame, sx), y = keyed(absFrame, sy), s = keyed(absFrame, ss);
  const v = Math.abs(keyed(absFrame + 1, sx) - keyed(absFrame - 1, sx)) * s / 2; // screen px per frame
  return { x, y, s, blur: Math.min(6, v / 45) };
}

/** World → screen. */
export const w2s = (c: Cam, wx: number, wy: number) => ({ x: VIEW.cx + (wx - c.x) * c.s, y: VIEW.cy + (wy - c.y) * c.s });
export const sec2f = (s: number) => Math.round(s * FPS);
