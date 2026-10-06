import { GateInstrument } from '@/components/gateway/GateInstrument';
import { blurIn, mask, prog } from '../../components/anim';
import { RUN } from '../../data/production';
import { sentenceAt } from '../../timing';
import { cue } from '../stages';
import { useAbs } from '../time';

const S = 's08-gateway' as const;
export const GATE = { w: 1240, gwTop: 24 + 32 + 28, gwLeft: 24 };
/** Panel-space point where the held candidate chip sits (GateInstrument .vchip at left 0, top 120). */
export const candidateAt = { x: GATE.gwLeft + 30, y: GATE.gwTop + 120 };

/**
 * Contain: the real Trust Gateway instrument with the run's serving state. Its parts are revealed in
 * story order by addressing the component's own children (no re-implementation), and the trusted
 * lane's packets are clocked by the frame instead of a CSS animation.
 */
export function ContainPanel() {
  const { frame, t } = useAbs();
  const f = (abs: number, d = 0.6) => prog(frame, abs, d);
  const s0 = sentenceAt(S, 0);
  const tPol = cue(S, 'POL-002 quarantines'), tServe = cue(S, 'while the previous trusted');
  const lane = f(tPol - 1.1, 1.0), stop = f(tPol, 0.4), lock = f(tPol + 0.1, 0.5), held = f(tPol + 0.7), inv = f(tServe + 0.4, 0.8);
  // GateInstrument children in its "now + candidate" branch, in DOM order (components/gateway/GateInstrument.tsx)
  const kids: Record<number, string> = {
    1: `opacity:${lane};${css(mask(lane))}`, 2: `opacity:${stop}`, 3: `opacity:${held}`, 4: `opacity:${t >= tPol - 1.15 ? 1 : 0}`, 5: `opacity:${held}`,
    6: 'opacity:1', 7: 'opacity:1', 8: 'opacity:1', 9: `opacity:${0.25 + 0.75 * lock}`, 10: 'opacity:1',
  };
  const pk = (k: number) => (((t - s0.start) / 3.6 + k / 3) % 1 + 1) % 1 * 100;
  return (
    <div className="scr-gateway contain" style={{ width: GATE.w, ...blurIn(f(s0.start - 0.9, 0.8)) }}>
      <style>{`
        ${Object.entries(kids).map(([i, s]) => `.contain .gw>.fade>:nth-child(${i}){${s}}`).join('\n')}
        ${[1, 2, 3].map((k) => `.contain .pkt:nth-child(${k}){left:calc(${pk(k)}% - 6px)}`).join('\n')}
        .contain .inv{opacity:${0.15 + 0.85 * inv}}
        .contain .plate{margin:0}
      `}</style>
      <GateInstrument appName={RUN.app} trusted={RUN.versions.trusted} served={RUN.versions.served}
        candidate={{ label: RUN.versions.latest, state: RUN.candidateState, policyCode: RUN.policy.code }} />
    </div>
  );
}
const css = (o: Record<string, string | number | undefined>) => Object.entries(o).filter(([, v]) => v != null).map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v}`).join(';');
