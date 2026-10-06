import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { C, F, LAYER, type Layer } from '../brand';
import { prog, rise } from '../components/anim';
import { Icon } from '../components/Icon';
import { scene } from '../timing';

/** 1:47–1:54 · Brand close: the official lockup (symbol + bilingual wordmark), principle, links. */
export function S10Close() {
  const frame = useCurrentFrame();
  const sc = scene('s10-close');
  const lock = prog(frame, 0.15, 0.9);
  const principle: { layer: Layer; text: string }[] = [
    { layer: 'ai', text: 'AI advises.' }, { layer: 'pol', text: 'Policy governs.' }, { layer: 'hum', text: 'Humans decide.' },
  ];
  const links = prog(frame, 3.6, 0.7);
  const out = 1 - prog(frame, sc.end - sc.start - 0.5, 0.5);
  return (
    <AbsoluteFill style={{ background: C.ground, fontFamily: F.sans, opacity: out }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 50% 45% at 50% 40%, rgba(34,211,197,.045), transparent 70%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 34, ...rise(lock, 16), filter: `blur(${(1 - lock) * 6}px)` }}>
          <Img src={staticFile('brand/istithbat-symbol-on-dark.png')} style={{ height: 150, width: 'auto' }} />
          <Img src={staticFile('brand/istithbat-wordmark-on-dark.png')} style={{ height: 150, width: 'auto' }} />
        </div>
        <div style={{ display: 'flex', gap: 44, font: `500 34px/1 ${F.sans}`, color: C.ink2 }}>
          {principle.map((p, i) => {
            const q = prog(frame, 1.1 + i * 0.55, 0.6);
            return (
              <span key={p.text} style={{ display: 'flex', alignItems: 'center', gap: 14, ...rise(q, 12) }}>
                <span style={{ display: 'flex', color: LAYER[p.layer].color }}><Icon name={LAYER[p.layer].icon} size={32} /></span>{p.text}
              </span>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 40, font: `400 26px/1 ${F.mono}`, color: C.ink3, marginTop: 18, ...rise(links, 10) }}>
          <span>istithbat.vercel.app</span>
          <span style={{ color: C.ink4 }}>·</span>
          <span>github.com/abdulwahiddev/Istithbat</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}
