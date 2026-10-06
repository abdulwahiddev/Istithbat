import { useCurrentFrame } from 'remotion';
import { C, F } from '../brand';
import { prog } from '../components/anim';
import { FootageScene } from '../components/FootageScene';
import { Icon, type IconName } from '../components/Icon';
import { SLOTS } from '../footage';
import { FPS, cueAt, scene } from '../timing';

const ID = 's04-pipeline' as const;

/**
 * 0:30–0:46 · REAL pipeline capture. A stage rail (labels only) lights each stage as the narration
 * names it; the footage itself is the proof of execution.
 */
export function S04Pipeline() {
  const frame = useCurrentFrame();
  const sc = scene(ID);
  const stages: { label: string; sub: string; icon: IconName; color: string; t: number }[] = [
    { label: 'Detect', sub: 'snapshot · fingerprint · exact change', icon: 'fingerprint-pattern', color: C.tq, t: cueAt(ID, 'snapshots and fingerprints') },
    { label: 'Understand', sub: 'semantic significance', icon: 'sparkles', color: C.puInk, t: cueAt(ID, 'analyzes its semantic') },
    { label: 'Test', sub: 'matched regression', icon: 'flask-conical', color: C.tq, t: cueAt(ID, 'runs matched') },
    { label: 'Trace', sub: 'downstream exposure', icon: 'network', color: C.amInk, t: cueAt(ID, 'traces downstream') },
    { label: 'Contain', sub: 'deterministic policy', icon: 'scale', color: C.ink2, t: cueAt(ID, 'evaluates deterministic') },
  ];
  const t = frame / FPS;
  const railIn = prog(frame, 0.3, 0.6);
  return (
    <FootageScene n="02" chapter="Pipeline" layer="det" slot={SLOTS.pipeline} frames={sc.frames}>
      <div style={{
        position: 'absolute', left: '50%', bottom: 40, transform: `translateX(-50%) translateY(${(1 - railIn) * 14}px)`, opacity: railIn,
        display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', borderRadius: 999,
        background: 'rgba(18,20,24,.92)', border: `1px solid ${C.glassLine}`, boxShadow: `${C.glassHi}, 0 18px 40px -18px rgba(0,0,0,.9)`, backdropFilter: 'blur(24px)',
        fontFamily: F.sans, whiteSpace: 'nowrap',
      }}>
        {stages.map((s, i) => {
          const on = prog(frame, s.t, 0.35);
          const active = t >= s.t && (i === stages.length - 1 || t < stages[i + 1].t);
          return (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span style={{ color: on > 0.5 ? C.ink3 : C.ink4, opacity: 0.4 + on * 0.6, display: 'flex' }}><Icon name="arrow-right" size={18} /></span>}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 999,
                background: active ? 'rgba(240,242,246,.08)' : 'transparent', boxShadow: active ? `inset 0 0 0 1px ${C.line2}` : 'none',
              }}>
                <span style={{ display: 'flex', color: on > 0 ? s.color : C.ink4, opacity: 0.45 + on * 0.55 }}><Icon name={s.icon} size={22} /></span>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ font: `600 22px/26px ${F.sans}`, color: on > 0 ? C.ink : C.ink4 }}>{s.label}</span>
                  <span style={{ font: `400 14px/18px ${F.sans}`, color: C.ink3, maxHeight: active ? 18 : 0, opacity: active ? 1 : 0, overflow: 'hidden' }}>{s.sub}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </FootageScene>
  );
}
