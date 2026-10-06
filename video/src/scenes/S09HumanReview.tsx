import type { ReactNode } from 'react';
import { useCurrentFrame } from 'remotion';
import { C, F, LAYER, type Layer } from '../brand';
import { prog } from '../components/anim';
import { Mono } from '../components/Callout';
import { FootageScene } from '../components/FootageScene';
import { Icon, type IconName } from '../components/Icon';
import { SLOTS } from '../footage';
import { cueAt, scene, sentenceAt } from '../timing';

const ID = 's09-human-review' as const;

/**
 * 1:36–1:47 · REAL human-review capture. An index of the evidence layers the reviewer sees, built
 * as the narration lists them. The AI risk level varied between runs, so no severity is shown.
 */
export function S09HumanReview() {
  const frame = useCurrentFrame();
  const sc = scene(ID);
  const s0 = sentenceAt(ID, 0);
  const a = s0.start - sc.start, d = s0.end - s0.start + 0.4;
  const tAi = cueAt(ID, 'AI can raise concern');
  const tHum = cueAt(ID, 'or replace expert');
  const rows: { layer: Layer; icon?: IconName; k: string; v: ReactNode; hi?: number }[] = [
    { layer: 'src', k: 'Exact change', v: <><Mono>ar.grade</Mono> · 4 words removed</> },
    { layer: 'ai', k: 'AI advisory', v: <span style={{ color: C.puInk }}><Mono>EVIDENCE_DRIFT</Mono> · advisory, not a ruling</span>, hi: tAi },
    { layer: 'det', icon: 'flask-conical', k: 'Regression', v: <><span style={{ color: C.coInk }}>2 MATERIAL</span> · 1 NON-MATERIAL</> },
    { layer: 'det', icon: 'network', k: 'Blast Radius', v: <><span style={{ color: C.amInk }}>6 EXPOSED</span> · <span style={{ color: C.coInk }}>1 IMPACTED</span> · 0 STALE</> },
    { layer: 'pol', k: 'Policy', v: <><Mono>POL-002</Mono> → QUARANTINE</> },
    { layer: 'hum', k: 'Human decision', v: <span style={{ color: C.ink }}>Reviewer decides</span>, hi: tHum },
  ];
  const panelIn = prog(frame, a, 0.5);
  const W = 620;
  return (
    <FootageScene n="07" chapter="Human review" layer="hum" slot={SLOTS.review} frames={sc.frames}>
      <div style={{
        position: 'absolute', right: 48, top: 48, width: W, padding: '16px 20px 10px', borderRadius: 16, opacity: panelIn,
        background: 'rgba(18,20,24,.94)', border: `1px solid ${C.chipLine}`, boxShadow: C.floatShadow, backdropFilter: 'blur(18px)', fontFamily: F.sans,
      }}>
        <div style={{ font: `500 17px/22px ${F.sans}`, color: C.ink3, paddingBottom: 10, borderBottom: `1px solid ${C.line2}` }}>Evidence in one place</div>
        {rows.map((r, i) => {
          const p = prog(frame, a + (d * i) / rows.length, 0.4);
          const hi = r.hi != null ? prog(frame, r.hi, 0.4) : 0;
          return (
            <div key={r.k} style={{
              display: 'grid', gridTemplateColumns: '26px 140px 1fr', alignItems: 'center', gap: 10, padding: '11px 8px', margin: '0 -8px',
              borderRadius: 10, opacity: p, transform: `translateX(${(1 - p) * 10}px)`, background: `rgba(240,242,246,${0.07 * hi})`,
              borderBottom: i < rows.length - 1 ? `1px solid ${C.line}` : 'none',
            }}>
              <span style={{ display: 'flex', color: LAYER[r.layer].color }}><Icon name={r.icon ?? LAYER[r.layer].icon} size={20} /></span>
              <span style={{ font: `500 18px/22px ${F.sans}`, color: C.ink2 }}>{r.k}</span>
              <span style={{ font: `400 18px/22px ${F.sans}`, color: C.ink3 }}>{r.v}</span>
            </div>
          );
        })}
      </div>
      <div style={{
        position: 'absolute', right: 48, top: 48 + 420, width: W, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        borderRadius: 12, border: `1px solid ${C.puLine}`, background: 'rgba(18,20,24,.94)', font: `500 18px/24px ${F.sans}`, color: C.puInk,
        opacity: prog(frame, tAi + 0.4, 0.5),
      }}>
        <Icon name="sparkles" size={18} />AI can raise concern. It cannot promote knowledge.
      </div>
    </FootageScene>
  );
}
