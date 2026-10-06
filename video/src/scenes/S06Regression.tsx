import { useCurrentFrame } from 'remotion';
import { C, F } from '../brand';
import { prog } from '../components/anim';
import { Callout, Mono, Status } from '../components/Callout';
import { FootageScene } from '../components/FootageScene';
import { Icon, type IconName } from '../components/Icon';
import { FRAME } from '../components/layout';
import { SLOTS } from '../footage';
import { cueAt, scene, sentenceAt } from '../timing';

const ID = 's06-regression' as const;

/** 0:57–1:10 · REAL matched-regression capture: trusted vs candidate answers, then the verdict. */
export function S06Regression() {
  const frame = useCurrentFrame();
  const sc = scene(ID);
  const s0 = sentenceAt(ID, 0), s1 = sentenceAt(ID, 1);
  const t0 = s0.start - sc.start, d0 = s0.end - s0.start;
  const tOnly = s1.start - sc.start;
  const tVerdict = cueAt(ID, 'Two of three');
  const s = SLOTS.regression;
  const chips: { label: string; icon: IconName; t: number; hi?: boolean }[] = [
    { label: 'Same model', icon: 'check', t: t0 + d0 * 0.15 },
    { label: 'Same prompt', icon: 'check', t: t0 + d0 * 0.45 },
    { label: 'Same settings', icon: 'check', t: t0 + d0 * 0.75 },
    { label: 'Only knowledge changes', icon: 'git-compare-arrows', t: tOnly, hi: true },
  ];
  return (
    <FootageScene n="04" chapter="Matched regression" layer="det" slot={s} frames={sc.frames}>
      <div style={{ position: 'absolute', top: 32, left: 0, width: FRAME.w, display: 'flex', justifyContent: 'center', gap: 10 }}>
        {chips.map((c) => {
          const p = prog(frame, c.t, 0.45);
          return (
            <div key={c.label} style={{
              display: 'flex', alignItems: 'center', gap: 9, height: 48, padding: '0 18px', borderRadius: 999, opacity: p,
              transform: `translateY(${(1 - p) * 10}px)`, background: 'rgba(18,20,24,.94)', border: `1px solid ${c.hi ? 'rgba(34,211,197,.45)' : C.chipLine}`,
              boxShadow: C.floatShadow, font: `500 20px/1 ${F.sans}`, color: C.ink,
            }}>
              <span style={{ display: 'flex', color: c.hi ? C.tq : C.ink3 }}><Icon name={c.icon} size={19} /></span>
              {c.label}{c.hi && <Mono color={C.ink3}>&nbsp;v13 → v14</Mono>}
            </div>
          );
        })}
      </div>
      <Callout at={0.6} until={tVerdict - 0.3} x={48} y={FRAME.h - 48 - 80} w={300} anchor={s.anchors.trusted} icon="shield-check" iconColor={C.tq} label="Trusted answer">
        Knowledge <Mono color={C.tq}>v13</Mono>
      </Callout>
      <Callout at={4.6} until={tVerdict - 0.3} x={FRAME.w - 48 - 300} y={FRAME.h - 48 - 80} w={300} anchor={s.anchors.candidate} icon="flask-conical" iconColor={C.coInk} label="Candidate answer">
        Knowledge <Mono color={C.coInk}>v14</Mono>
      </Callout>
      <Callout at={tVerdict} x={(FRAME.w - 560) / 2} y={FRAME.h - 48 - 150} w={560} layer="det" label="Matched regression · 3 comparisons">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, margin: '8px 0 12px' }}>
          {[C.co, C.co, C.ink4].map((c, i) => <span key={i} style={{ height: 10, borderRadius: 3, background: c, opacity: prog(frame, tVerdict + 0.3 + i * 0.15, 0.3) }} />)}
        </div>
        <span style={{ display: 'flex', gap: 26 }}>
          <Status color={C.coInk}><b style={{ fontWeight: 600 }}>2</b> MATERIAL</Status>
          <Status color={C.ink3}><b style={{ fontWeight: 600 }}>1</b> NON-MATERIAL</Status>
        </span>
      </Callout>
    </FootageScene>
  );
}
