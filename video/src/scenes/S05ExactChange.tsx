import { interpolate, useCurrentFrame } from 'remotion';
import { C, F } from '../brand';
import { prog, rise } from '../components/anim';
import { Callout, Mono } from '../components/Callout';
import { FootageScene } from '../components/FootageScene';
import { Icon } from '../components/Icon';
import { FRAME } from '../components/layout';
import { SLOTS } from '../footage';
import { cueAt, scene } from '../timing';

const ID = 's05-exact-change' as const;
// Verified 10618 values (ar.grade). The removed span is exactly 4 words.
const KEPT = 'صحيح';
const REMOVED = 'دون قوله: (ولم يستدر)';

/**
 * 0:46–0:57 · REAL exact-change capture, punched in on the diff; beside it the same strings set
 * large in Amiri (typography of the verified values, not a recreation of the product panel).
 */
export function S05ExactChange() {
  const frame = useCurrentFrame();
  const sc = scene(ID);
  const tField = cueAt(ID, 'Only the grading field');
  const tGone = cueAt(ID, 'an explicit exception');
  const split = prog(frame, tField - 0.2, 0.8);
  const small = { x: FRAME.x, w: 900, h: 506 };
  const rect = {
    x: FRAME.x, y: interpolate(split, [0, 1], [FRAME.y, FRAME.y + (FRAME.h - small.h) / 2]),
    w: interpolate(split, [0, 1], [FRAME.w, small.w]), h: interpolate(split, [0, 1], [FRAME.h, small.h]),
  };
  const ex = prog(frame, tField + 0.3, 0.7);
  const strike = prog(frame, tGone, 0.7);
  const after = prog(frame, tGone + 0.7, 0.6);
  const facts = prog(frame, tGone + 1.6, 0.6);
  return (
    <FootageScene n="03" chapter="Exact change" layer="src" slot={SLOTS.exact} frames={sc.frames} rect={rect}
      overlay={
        <div style={{ position: 'absolute', left: FRAME.x + small.w + 64, top: 190, width: 1760 - (FRAME.x + small.w + 64), fontFamily: F.sans, ...rise(ex, 20) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, font: `500 21px/28px ${F.sans}`, color: C.ink3 }}>
            <span style={{ color: C.ink2, display: 'flex' }}><Icon name="database" size={20} /></span>
            Exact change · <Mono color={C.ink2}>ar.grade</Mono>
          </div>
          <div dir="rtl" lang="ar" style={{ marginTop: 26, font: `400 54px/1.45 ${F.ar}`, color: C.ink2, textAlign: 'right', whiteSpace: 'nowrap' }}>
            <span>{KEPT} </span>
            <span style={{ position: 'relative', color: strike > 0.5 ? C.coInk : C.ink2, background: `rgba(255,107,94,${0.13 * strike})`, borderRadius: 8, padding: '0 6px' }}>
              {REMOVED}
              <span style={{ position: 'absolute', right: 0, top: '54%', height: 3, width: `${strike * 100}%`, background: C.co, borderRadius: 2 }} />
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', color: C.ink4, margin: '6px 0', opacity: after }}><Icon name="arrow-up" size={30} style={{ transform: 'rotate(180deg)' }} /></div>
          <div dir="rtl" lang="ar" style={{ font: `700 76px/1.3 ${F.ar}`, color: C.ink, textAlign: 'right', ...rise(after, 14) }}>{KEPT}</div>
          <div style={{ marginTop: 26, paddingTop: 20, borderTop: `1px solid ${C.line2}`, display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 12, columnGap: 22, font: `500 21px/28px ${F.sans}`, opacity: facts }}>
            <span style={{ color: C.ink3 }}>Removed</span><span style={{ color: C.coInk }}>4 words</span>
            <span style={{ color: C.ink3 }}>Field role</span><Mono color={C.ink}>SCHOLAR_JUDGMENT</Mono>
            <span style={{ color: C.ink3 }}>Fingerprint</span><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ color: C.tq, display: 'flex' }}><Icon name="fingerprint-pattern" size={20} /></span><Mono color={C.ink2}>449efbaf → d3908502</Mono></span>
          </div>
        </div>
      }>
      <Callout at={0.5} until={tField - 0.3} x={48} y={48} w={420} icon="check" iconColor={C.tq} label="Hadith text">
        Unchanged · only <Mono>ar.grade</Mono> changed
      </Callout>
    </FootageScene>
  );
}
