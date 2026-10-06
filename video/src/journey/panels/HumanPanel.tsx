import { DecisionDock } from '@/components/incident/DecisionDock';
import { Mk } from '@/components/strata/primitives';
import { blurIn, prog } from '../../components/anim';
import { ALLOWED, RUN } from '../../data/production';
import { sentenceAt } from '../../timing';
import { cue } from '../stages';
import { useAbs } from '../time';

const S = 's09-human-review' as const;
export const HUMAN = { w: 1560, colW: 380, dockX: 440 };
/** Panel-space landing points for the evidence carried along the path. */
export const evidenceAt = (i: number) => ({ x: 0, y: 92 + i * 74 });

/**
 * Human decision: the real DecisionDock in its signed-out state (exactly what the product shows
 * before a reviewer authenticates: every option previewable, nothing recordable). No decision is
 * made in the video; none was recorded in the Production run.
 */
export function HumanPanel() {
  const { frame } = useAbs();
  const f = (abs: number, d = 0.7) => prog(frame, abs, d);
  const s0 = sentenceAt(S, 0);
  const tAi = cue(S, 'AI can raise concern'), tJudge = cue(S, 'or replace expert');
  const judge = f(tJudge, 0.8);
  return (
    <div style={{ width: HUMAN.w, position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: HUMAN.colW, ...blurIn(f(s0.start - 0.6)) }}>
        <h3 className="h3">Evidence in one place</h3>
        <p className="meta" style={{ margin: '6px 0 0' }}>Carried from every stage of this run</p>
        <div style={{ position: 'absolute', top: 92 + 4 * 74, left: 0, right: 0, display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 14, border: '1px dashed var(--pu-line)', background: 'var(--pu-soft)', ...blurIn(f(tAi + 0.3)) }}>
          <Mk layer="ai" style={{ marginTop: 5 }} />
          <span style={{ fontSize: 15, lineHeight: '22px', color: 'var(--pu-ink)' }}>AI advises. It can raise concern; it cannot promote knowledge or lower the policy floor.</span>
        </div>
      </div>
      <div style={{ position: 'absolute', left: HUMAN.dockX, top: 0, width: HUMAN.w - HUMAN.dockX, ...blurIn(f(s0.start - 0.3, 0.9)),
        borderRadius: 22, boxShadow: `0 0 0 ${2 * judge}px rgba(243,245,250,${0.55 * judge})` }}>
        <DecisionDock incidentId="production" candidate={RUN.versions.latest} previous={RUN.versions.trusted} served={RUN.versions.served}
          appName={RUN.app} candidateState={RUN.candidateState} allowed={ALLOWED} aiPill={null} reviewer={null} recorded={null} resolved={false} />
      </div>
    </div>
  );
}
