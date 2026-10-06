import { Img, staticFile } from 'remotion';
import { Mk } from '@/components/strata/primitives';
import { Icon } from '@/components/strata/icons';
import { blurIn, prog } from '../components/anim';
import { RUN } from '../data/production';
import { scene } from '../timing';
import { DONE_AT, RAIL, RUN_AT } from './stages';
import { useAbs } from './time';

export const HUD = { y: 30, h: 60, latestX: 1556, latestY: 60 };

/** Which rail item the viewer is looking at. */
function focusAt(t: number): string {
  if (t < scene('s04-pipeline').start) return 'publish';
  if (t < scene('s05-exact-change').start) {
    const order = ['contain', 'trace', 'test', 'understand', 'detect'] as const;
    return order.find((k) => t >= RUN_AT[k]) ?? 'detect';
  }
  if (t < scene('s06-regression').start) return 'detect';
  if (t < scene('s07-blast-radius').start) return 'test';
  if (t < scene('s08-gateway').start) return 'trace';
  if (t < scene('s09-human-review').start) return 'contain';
  return 'human';
}

/**
 * Persistent heads-up rail: where we are on the path, what has completed in the run, and the live
 * serving state (Latest seen · Trusted · Served) — the same three facts the Trust Gateway enforces.
 */
export function Hud() {
  const { frame, t } = useAbs();
  const inP = prog(frame, scene('s03-publish').start + 0.2, 0.8);
  const focus = focusAt(t);
  const seenV14 = t >= RUN_AT.detect;
  const held = t >= DONE_AT.contain;
  const flip = prog(frame, RUN_AT.detect, 0.6);
  return (
    <div style={{ position: 'absolute', left: 160, right: 160, top: HUD.y, height: HUD.h, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, ...blurIn(inP, -8) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 250 }}>
        <Img src={staticFile('brand/istithbat-symbol-on-dark.png')} style={{ height: 26, width: 'auto' }} />
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '17px' }}>
          <b style={{ fontSize: 14, fontWeight: 600 }}>Production run</b>
          <span className="meta mono" style={{ fontSize: 12, lineHeight: '16px' }}>{RUN.provider} {RUN.recordId}</span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 4, borderRadius: 999, background: 'var(--glass)', border: '1px solid var(--glass-line)', boxShadow: 'var(--glass-hi),var(--glass-shadow)' }}>
        {RAIL.map((r, i) => {
          const done = r.key === 'human' ? false : t >= DONE_AT[r.key as keyof typeof DONE_AT];
          const on = r.key === focus;
          return (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <span style={{ width: 10, height: 1, background: 'var(--line-2)' }} />}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, height: 34, padding: '0 13px', borderRadius: 999, fontSize: 13.5, fontWeight: 500,
                color: on ? 'var(--ink)' : done ? 'var(--ink-2)' : 'var(--ink-4)',
                background: on ? 'var(--glass-sel)' : 'transparent', boxShadow: on ? 'var(--glass-sel-shadow)' : 'none',
              }}>
                {done ? <Icon name="check" size={13} stroke={2.4} style={{ color: 'var(--tq)' }} /> : <Mk layer={r.layer} style={{ opacity: on ? 1 : 0.55 }} />}
                {r.label}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: 250, justifyContent: 'flex-end', fontSize: 12, color: 'var(--ink-3)' }}>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <span>Latest</span>
          <span className="mono" style={{ fontSize: 17, color: seenV14 ? 'var(--co-ink)' : 'var(--ink)', ...blurIn(seenV14 ? flip : 1, 4, 4) }}>{seenV14 ? RUN.versions.latest : RUN.versions.trusted}</span>
        </span>
        <span className="mono" style={{ fontSize: 16, color: seenV14 ? 'var(--co)' : 'var(--ink-4)', marginTop: 14 }}>{seenV14 ? '≠' : '='}</span>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}><span>Trusted</span><span className="mono" style={{ fontSize: 17, color: 'var(--ink)' }}>{RUN.versions.trusted}</span></span>
        <span className="mono" style={{ fontSize: 16, color: 'var(--ink-4)', marginTop: 14 }}>=</span>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="dot" style={{ background: 'var(--tq)' }} />Served</span><span className="mono" style={{ fontSize: 17, color: 'var(--tq)' }}>{RUN.versions.served}</span></span>
        {held && <span style={{ position: 'absolute', right: 0, top: HUD.h + 2, fontSize: 11.5, color: 'var(--co-ink)', ...blurIn(prog(frame, DONE_AT.contain, 0.6), 4, 4) }}>{RUN.versions.latest} {RUN.candidateState.toLowerCase()} · not served</span>}
      </div>
    </div>
  );
}
