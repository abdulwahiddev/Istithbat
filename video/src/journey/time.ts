import { useCurrentFrame } from 'remotion';
import { FPS } from '../timing';
import { J0 } from './stages';

/** Absolute film time (seconds) and frame inside the journey Sequence (which starts at J0). */
export function useAbs() {
  const frame = useCurrentFrame();
  const absFrame = frame + Math.round(J0 * FPS);
  return { frame: absFrame, t: absFrame / FPS };
}
