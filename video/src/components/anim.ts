import { Easing, interpolate } from 'remotion';
import { EASE, } from '../brand';
import { FPS } from '../timing';

const bez = Easing.bezier(...EASE);

/** Eased 0→1 progress between two scene-relative times in seconds. */
export const prog = (frame: number, startSec: number, durSec = 0.6) =>
  interpolate(frame, [startSec * FPS, (startSec + durSec) * FPS], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: bez });

/** Piecewise keyframes (seconds → values) with the landing ease between each pair. */
export function keyed(frame: number, keys: { t: number; v: number }[]) {
  const t = frame / FPS;
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b.t) return a.v + (b.v - a.v) * bez((t - a.t) / Math.max(b.t - a.t, 1e-6));
  }
  return keys[keys.length - 1].v;
}

/** Masked upward reveal: returns style for an element that slides up from behind a clip edge. */
export const rise = (p: number, px = 18) => ({ opacity: p, transform: `translateY(${(1 - p) * px}px)` });

/** Clip-path reveal left→right. */
export const wipe = (p: number) => ({ clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` });
