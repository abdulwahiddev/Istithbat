import type { ReactNode } from 'react';
import { useCurrentFrame } from 'remotion';
import { C, F } from '../brand';
import { prog } from '../components/anim';
import { Callout, Mono } from '../components/Callout';
import { FootageScene } from '../components/FootageScene';
import { Icon } from '../components/Icon';
import { FRAME } from '../components/layout';
import { SLOTS } from '../footage';
import { cueAt, scene } from '../timing';

const ID = 's08-gateway' as const;

/** 1:23–1:36 · REAL Trust Gateway capture: quarantine holds v14 while v13 keeps serving. */
export function S08Gateway() {
  const frame = useCurrentFrame();
  const sc = scene(ID);
  const tPol = cueAt(ID, 'POL-002 quarantines');
  const tServe = cueAt(ID, 'while the previous trusted');
  const s = SLOTS.gateway;
  const lockP = prog(frame, tPol, 0.5);
  return (
    <FootageScene n="06" chapter="Trust Gateway" layer="pol" slot={s} frames={sc.frames}>
      <Callout at={0.4} x={48} y={48} w={560} icon="fingerprint-pattern" iconColor={C.tq} label={<>Serving state <Mono color={C.ink2}>islamic-qa-demo</Mono></>}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 6 }}>
          <Cell k="Latest" v="v14" c={C.coInk} />
          <Op c={C.co}>≠</Op>
          <Cell k="Trusted" v="v13" />
          <Op c={C.ink4}>=</Op>
          <Cell k="Served" v="v13" />
        </div>
        <div style={{ marginTop: 12, paddingTop: 9, borderTop: `2px solid ${C.tq}`, display: 'flex', alignItems: 'center', gap: 10, font: `500 18px/22px ${F.sans}`, color: C.tq,
          clipPath: `inset(-12px ${(1 - prog(frame, tServe, 0.8)) * 100}% -12px 0)` }}>
          <i style={{ width: 9, height: 9, borderRadius: '50%', background: C.tq, boxShadow: `0 0 0 4px ${C.tqSoft}` }} />Previous trusted version serving · uninterrupted
        </div>
      </Callout>
      {/* the landing's held lock (.lock): solid light chip, dark ink */}
      <div style={{
        position: 'absolute', left: s.anchors.gate.x * FRAME.w, top: s.anchors.gate.y * FRAME.h, transform: `translate(-50%,-50%) scale(${0.94 + 0.06 * lockP})`, opacity: lockP,
        display: 'flex', alignItems: 'center', gap: 12, height: 58, padding: '0 22px', borderRadius: 14, background: C.ink, color: C.ground,
        font: `600 23px/1 ${F.sans}`, boxShadow: '0 16px 36px -14px rgba(0,0,0,.9)', whiteSpace: 'nowrap',
      }}>
        <Icon name="lock" size={22} stroke={2} />
        <Mono>POL-002</Mono>
        <span style={{ display: 'flex', opacity: 0.6 }}><Icon name="arrow-right" size={20} /></span>
        <span style={{ color: '#C4392E', letterSpacing: '0.02em' }}>QUARANTINE</span>
      </div>
      <Callout at={tPol + 0.6} x={FRAME.w - 48 - 400} y={FRAME.h - 48 - 110} w={400} layer="pol" label="Deterministic policy">
        <span style={{ fontSize: 21, lineHeight: '28px', color: C.ink2 }}>Candidate <Mono color={C.coInk}>v14</Mono> held · not served</span>
      </Callout>
    </FootageScene>
  );
}

const Cell = ({ k, v, c = C.ink }: { k: string; v: string; c?: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <span style={{ font: `500 16px/20px ${F.sans}`, color: C.ink3 }}>{k}</span>
    <span style={{ font: `400 44px/1 ${F.mono}`, color: c, letterSpacing: '-0.02em' }}>{v}</span>
  </div>
);
const Op = ({ children, c }: { children: ReactNode; c: string }) => <span style={{ font: `300 38px/1 ${F.sans}`, color: c, paddingBottom: 2 }}>{children}</span>;
