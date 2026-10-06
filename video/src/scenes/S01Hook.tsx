import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { C, F } from '../brand';
import { Icon } from '../components/Icon';
import { keyed, prog, rise } from '../components/anim';
import { cueAt } from '../timing';

/**
 * 0:00–0:08 · The landing's trust-stack plate (public/landing, the real hero asset) with the held
 * candidate sheet settling above it, and the hook line. Pure brand visual, no product claims.
 */
export function S01Hook() {
  const frame = useCurrentFrame();
  const push = keyed(frame, [{ t: 0, v: 1.0 }, { t: 8, v: 1.035 }]);
  const sheetIn = prog(frame, 1.2, 2.2);
  const tChange = cueAt('s01-hook', 'But what happens');
  const head = prog(frame, 0.5, 0.8);
  const sub = prog(frame, tChange, 0.7);
  const fadeIn = prog(frame, 0, 0.6);
  return (
    <AbsoluteFill style={{ background: C.ground, opacity: fadeIn }}>
      {/* plate + sheet share one media box, exactly as .lh-media / .lh-sheet place them */}
      <AbsoluteFill style={{ transform: `scale(${push}) translateX(${(1 - push) * 300}px)`, transformOrigin: '70% 60%' }}>
        <div style={{ position: 'absolute', left: 0, top: 4, width: 1920, height: 1072 }}>
          <Img src={staticFile('landing/e-plate-1920.jpg')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'lighten' }} />
          <Img src={staticFile('landing/e-sheet-layer.jpg')} style={{
            position: 'absolute', left: '37.43%', top: '31.25%', width: '57.05%', mixBlendMode: 'lighten',
            opacity: sheetIn, transform: `translateY(${(1 - sheetIn) * -70}px)`,
          }} />
        </div>
      </AbsoluteFill>
      {/* left-side legibility falloff, as on the landing */}
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(8,9,11,.92) 0%, rgba(8,9,11,.6) 38%, rgba(8,9,11,0) 60%)' }} />
      <div style={{ position: 'absolute', left: 160, top: 300, width: 700, display: 'flex', flexDirection: 'column', gap: 26, fontFamily: F.sans }}>
        <div style={{ ...rise(head), display: 'flex', alignItems: 'center', gap: 12, font: `500 22px/28px ${F.sans}`, color: C.ink3 }}>
          <span style={{ width: 20, height: 3, background: C.ink, borderRadius: 1 }} />Integrity infrastructure for Islamic knowledge
        </div>
        <div style={{ ...rise(head, 24), font: `600 72px/1.06 ${F.sans}`, letterSpacing: '-0.04em', color: C.ink }}>
          Trusted knowledge can change <span style={{ color: C.ink3 }}>after integration.</span>
        </div>
        <div style={{ ...rise(sub), display: 'flex', alignItems: 'center', gap: 12, font: `500 22px/28px ${F.sans}`, color: C.coInk }}>
          <span style={{ display: 'flex', color: C.co }}><Icon name="triangle-alert" size={22} /></span>
          A newer version arrives. Is it still trusted?
        </div>
      </div>
    </AbsoluteFill>
  );
}
