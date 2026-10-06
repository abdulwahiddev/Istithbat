import { Easing, interpolate, spring } from 'remotion';
import { FPS } from '../timing';

/**
 * ONE motion language for the whole film:
 *  - expo-out for every reveal and camera move (restrained, decisive, no overshoot)
 *  - a critically-damped spring for objects that are carried between stages
 *  - masked reveals (clip-path) and blur crossfades; never bounces, flips or wipes-with-shapes
 */
export const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
export const EXPO_IN_OUT = Easing.bezier(0.83, 0, 0.17, 1);

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Eased 0→1 progress between two times (seconds, relative to the current Sequence). */
export const prog = (frame: number, startSec: number, durSec = 0.7, easing = EXPO) =>
  interpolate(frame, [startSec * FPS, (startSec + durSec) * FPS], [0, 1], { ...clamp, easing });

/** Critically damped spring progress (carried objects). */
export const carry = (frame: number, startSec: number, durSec = 1.1) =>
  spring({ frame: frame - startSec * FPS, fps: FPS, durationInFrames: Math.round(durSec * FPS), config: { damping: 200 } });

/** Piecewise keyframes (seconds → values), EXPO_IN_OUT between each pair (camera paths). */
export function keyed(frame: number, keys: { t: number; v: number }[], easing = EXPO_IN_OUT) {
  const t = frame / FPS;
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b.t) return a.v + (b.v - a.v) * easing((t - a.t) / Math.max(b.t - a.t, 1e-6));
  }
  return keys[keys.length - 1].v;
}

/** Blur crossfade in: opacity, a few px of blur and a short rise, all from one progress value. */
export const blurIn = (p: number, rise = 14, blur = 8) => ({
  opacity: p, filter: p < 1 ? `blur(${(1 - p) * blur}px)` : undefined, transform: `translateY(${(1 - p) * rise}px)`,
});
/** Same move, outgoing. */
export const blurOut = (p: number, blur = 8) => ({ opacity: 1 - p, filter: p > 0 ? `blur(${p * blur}px)` : undefined });

/** Masked reveal left→right (or right→left for RTL text). */
export const mask = (p: number, rtl = false) => ({ clipPath: rtl ? `inset(-20% 0 -20% ${(1 - p) * 100}%)` : `inset(-20% ${(1 - p) * 100}% -20% 0)` });

// Back-compat for the brand scenes (S01/S02/S10).
export const rise = (p: number, px = 18) => ({ opacity: p, transform: `translateY(${(1 - p) * px}px)` });
export const wipe = (p: number) => mask(p);
