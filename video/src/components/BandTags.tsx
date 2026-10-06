import { useCurrentFrame } from 'remotion';
import { C, F, LAYER, type Layer } from '../brand';
import { prog } from './anim';
import { Icon } from './Icon';
import { BAND, FRAME } from './layout';

/**
 * Chapter marker (left) and the standing disclosure (right) in the caption band. The disclosure is
 * required: the 10618 candidate was created by Istithbat for testing, not published by HadeethEnc.
 */
export function BandTags({ n, chapter, layer }: { n: string; chapter: string; layer: Layer }) {
  const frame = useCurrentFrame();
  const p = prog(frame, 0.1, 0.5);
  const L = LAYER[layer];
  const base = { position: 'absolute' as const, top: BAND.y, height: BAND.h, display: 'flex', alignItems: 'center', opacity: p, fontFamily: F.sans };
  return (
    <>
      <div style={{ ...base, left: FRAME.x, width: 250, gap: 10, font: `500 17px/22px ${F.sans}`, color: C.ink3 }}>
        <span style={{ fontFamily: F.mono, color: C.ink4, fontSize: 15 }}>{n}</span>
        <span style={{ color: L.color, display: 'flex' }}><Icon name={L.icon} size={18} /></span>
        <span style={{ color: C.ink2 }}>{chapter}</span>
      </div>
      <div style={{ ...base, right: 1920 - FRAME.x - FRAME.w, width: 300, justifyContent: 'flex-end', textAlign: 'right', font: `500 14px/19px ${F.sans}`, color: C.ink4 }}>
        Controlled candidate created by Istithbat for testing. Not published by HadeethEnc.
      </div>
    </>
  );
}
