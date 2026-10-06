import { demoStages } from '@/lib/contracts/sandbox-progress';
import { Mk, type Layer } from '@/components/strata/primitives';
import { Icon } from '@/components/strata/icons';
import type { ReactNode } from 'react';
import { prog, blurIn } from '../../components/anim';
import { RUN } from '../../data/production';
import { DONE_AT, RUN_AT } from '../stages';
import { useAbs } from '../time';

// Same layer per stage as the sandbox console (components/sandbox/SandboxConsole.tsx STAGE_LAYER).
const LAYER: Record<string, Layer> = { Detect: 'det', Understand: 'ai', Test: 'det', Trace: 'det', Contain: 'pol' };
const KEY: Record<string, keyof typeof DONE_AT> = { Detect: 'detect', Understand: 'understand', Test: 'test', Trace: 'trace', Contain: 'contain' };

/** What each stage recorded in the Production run (verified results only). */
const RESULT: Record<string, ReactNode> = {
  Detect: <><span className="mono">{RUN.field}</span> · 4 words removed</>,
  Understand: <>Advisory only · cannot lower policy</>,
  Test: <><b style={{ color: 'var(--co-ink)' }}>3</b> of 3 material</>,
  Trace: <>{RUN.blast.exposed} exposed · <span style={{ color: 'var(--co-ink)' }}>{RUN.blast.impacted} impacted</span> · {RUN.blast.stale} stale</>,
  Contain: <><span className="mono">{RUN.policy.code}</span> → {RUN.policy.action}</>,
};

export const PIPE = { w: 1240, plateTop: 64, pad: 24, cols: 6, gap: 12 };
/** World position (panel coords) of a stage marker centre, for carried objects. */
export const markerAt = (i: number) => {
  const col = (PIPE.w - 2 * PIPE.pad - (PIPE.cols - 1) * PIPE.gap) / PIPE.cols;
  return { x: PIPE.pad + i * (col + PIPE.gap) + 19, y: PIPE.plateTop + PIPE.pad + 12 };
};

/** The sandbox console's pipeline (`ol.flow.sbx-flow`, Step markup verbatim), driven by the run's clock. */
export function PipelinePanel() {
  const { t, frame } = useAbs();
  const state = (name: string) => {
    const k = KEY[name];
    return t >= DONE_AT[k] ? 'Done' : t >= RUN_AT[k as keyof typeof RUN_AT] ? 'Running' : 'Pending';
  };
  const allDone = t >= DONE_AT.contain;
  return (
    <div className="scr-overview scr-sandbox" style={{ width: PIPE.w }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, height: PIPE.plateTop - 16 }}>
        <h3 className="h3">Source update → human review</h3>
        <span className="meta" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <Icon name="history" size={14} />Production run · waiting time removed
        </span>
      </div>
      <div className="plate" style={{ margin: 0, paddingTop: PIPE.pad, paddingBottom: PIPE.pad }}>
        <ol className="flow sbx-flow">
          {demoStages.map((stg) => {
            const st = state(stg.name);
            return <Step key={stg.name} layer={LAYER[stg.name]} title={stg.name} sub={stg.description} state={st} now={st === 'Running'} />;
          })}
          <Step layer="hum" title="Human decision" sub={allDone ? 'AI advises · policy governs · humans decide' : 'The investigation is still running'}
            state={allDone ? 'Now' : 'Pending'} now={allDone} />
        </ol>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', columnGap: 12, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
          {demoStages.map((stg) => {
            const p = prog(frame, DONE_AT[KEY[stg.name]] + 0.1, 0.6);
            return <span key={stg.name} className="meta" style={{ color: 'var(--ink-2)', ...blurIn(p, 6, 6) }}>{RESULT[stg.name]}</span>;
          })}
          <span className="meta" style={{ ...blurIn(prog(frame, DONE_AT.contain + 0.3, 0.6), 6, 6) }}>Waiting for a reviewer</span>
        </div>
      </div>
    </div>
  );
}

function Step({ layer, title, sub, state, now }: { layer: Layer; title: string; sub: ReactNode; state: string; now?: boolean }) {
  return <li className={now ? 'now' : undefined} data-status={state}><span className="fs"><span className="fmk"><Mk layer={layer} /></span><b>{title}</b><span>{sub}</span><i>{state}</i></span></li>;
}
