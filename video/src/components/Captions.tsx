import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, F } from '../brand';
import { CAPTIONS, FPS } from '../timing';
import { BAND } from './layout';

/**
 * Burned-in phrase-level captions, timed by scripts/tts.py (src/narration.json). They live in the
 * caption band under the footage frame, so they never cover product UI.
 */
export function Captions() {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cue = CAPTIONS.find((c, i) => {
    const next = CAPTIONS[i + 1];
    // hold a phrase until the next one starts if the gap is short (avoids flicker between phrases)
    const holdUntil = next && next.start - c.end < 0.6 ? next.start : c.end + 0.25;
    return t >= c.start - 0.05 && t < holdUntil;
  });
  if (!cue) return null;
  const inP = interpolate(t, [cue.start - 0.05, cue.start + 0.12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: BAND.y, height: BAND.h, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          maxWidth: 1000, textAlign: 'center', font: `500 31px/40px ${F.sans}`, color: C.ink, letterSpacing: '-0.005em',
          padding: '6px 18px', borderRadius: 12, background: 'rgba(8,9,11,.55)', opacity: inP,
          textShadow: '0 1px 2px rgba(0,0,0,.6)', textWrap: 'balance' as never,
        }}>{cue.text}</div>
      </div>
    </AbsoluteFill>
  );
}
