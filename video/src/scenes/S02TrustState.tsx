import type { ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, F } from '../brand';
import { Icon } from '../components/Icon';
import { prog, rise } from '../components/anim';
import { cueAt, scene, sentenceAt } from '../timing';

/**
 * 0:08–0:17 · The landing readout (.lh-readout / .lh-eqn) scaled up to a full-frame statement:
 * Latest seen ≠ Trusted = Served · v14 ≠ v13 = v13. Values appear with the words that name them.
 */
export function S02TrustState() {
  const frame = useCurrentFrame();
  const sc = scene('s02-trust-state');
  const s = sentenceAt('s02-trust-state', 0);
  const tServe = cueAt('s02-trust-state', 'and what applications');
  const tLatest = s.start - sc.start + 0.4;
  const tTrusted = tLatest + (tServe - tLatest) * 0.55;
  const pL = prog(frame, tLatest, 0.6), pT = prog(frame, tTrusted, 0.6), pS = prog(frame, tServe + 0.5, 0.6), pBar = prog(frame, tServe + 1.4, 0.7);
  const title = prog(frame, 0.1, 0.6);
  const out = 1 - prog(frame, sc.end - sc.start - 0.35, 0.35);
  return (
    <AbsoluteFill style={{ background: C.ground, fontFamily: F.sans, opacity: out }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 46%, rgba(240,242,246,.035), transparent 70%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 300, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ ...rise(title), display: 'flex', alignItems: 'center', gap: 14, font: `500 24px/30px ${F.sans}`, color: C.ink3, paddingBottom: 22, borderBottom: `1px solid ${C.line2}`, width: 1240 }}>
          <span style={{ color: C.tq, display: 'flex' }}><Icon name="fingerprint-pattern" size={24} /></span>
          Serving state
          <span style={{ fontFamily: F.mono, fontSize: 22, color: C.ink2 }}>islamic-qa-demo</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 44, paddingTop: 40, width: 1240 }}>
          <Cell k="Latest seen" v="v14" vColor={C.coInk} p={pL}
            foot={<span style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.coInk }}><i style={{ width: 11, height: 11, borderRadius: '50%', background: C.co }} />Held · not served</span>} />
          <Op p={pT} color={C.co}>≠</Op>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 44 }}>
              <Cell k="Trusted" v="v13" p={pT} />
              <Op p={pS} color={C.ink4}>=</Op>
              <Cell k="Served" v="v13" p={pS} />
            </div>
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: `2px solid ${C.tq}`, display: 'flex', alignItems: 'center', gap: 12, font: `500 22px/28px ${F.sans}`, color: C.tq,
              clipPath: `inset(-20px ${(1 - pBar) * 100}% -20px 0)` }}>
              <i style={{ width: 11, height: 11, borderRadius: '50%', background: C.tq, boxShadow: `0 0 0 5px ${C.tqSoft}` }} />Serving production
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Cell({ k, v, vColor = C.ink, p, foot }: { k: string; v: string; vColor?: string; p: number; foot?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...rise(p, 26) }}>
      <span style={{ font: `500 26px/32px ${F.sans}`, color: C.ink3 }}>{k}</span>
      <span style={{ font: `400 150px/1 ${F.mono}`, letterSpacing: '-0.03em', color: vColor }}>{v}</span>
      {foot && <span style={{ marginTop: 16, font: `500 22px/28px ${F.sans}` }}>{foot}</span>}
    </div>
  );
}
const Op = ({ children, p, color }: { children: ReactNode; p: number; color: string }) =>
  <span style={{ font: `300 110px/1 ${F.sans}`, color, marginTop: 52, opacity: p }}>{children}</span>;
