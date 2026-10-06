import type { ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import { Icon } from '@/components/strata/icons';
import { blurIn, prog } from '../components/anim';
import { FootageSlot } from '../components/FootageSlot';
import { C, F } from '../brand';
import { RUN } from '../data/production';
import { SANDBOX } from '../footage';
import { ProductRoot } from '../product/ProductRoot';
import { scene } from '../timing';
import { camAt, VIEW } from './camera';
import { Carry } from './Carry';
import { Hud } from './Hud';
import { ContainPanel } from './panels/ContainPanel';
import { DetectPanel } from './panels/DetectPanel';
import { HumanPanel } from './panels/HumanPanel';
import { PipelinePanel } from './panels/PipelinePanel';
import { TestPanel } from './panels/TestPanel';
import { TracePanel } from './panels/TracePanel';
import { STAGES, J0, type StageId } from './stages';
import { useAbs } from './time';

const PANELS: Record<Exclude<StageId, 'publish'>, () => ReactNode> = {
  pipeline: PipelinePanel, detect: DetectPanel, test: TestPanel, trace: TracePanel, contain: ContainPanel, human: HumanPanel,
};

/**
 * 0:17–1:47 · one continuous camera through the product: the real /sandbox recording, then the
 * verified Production run choreographed on the product's own components. Stages sit along one
 * world; the camera travels between them; the candidate and each stage's result are carried along.
 */
export function Journey() {
  const { frame } = useAbs();
  const cam = camAt(frame);
  const end = scene('s09-human-review').end;
  const vis = Math.min(prog(frame, J0, 0.6), 1 - prog(frame, end - 0.45, 0.45));
  return (
    <AbsoluteFill style={{ background: C.ground, opacity: vis, filter: vis < 1 ? `blur(${(1 - vis) * 10}px)` : undefined }}>
      <ProductRoot style={{ position: 'absolute', inset: 0 }}>
        {/* the world, clipped to the viewport with soft edges so nothing collides with the HUD or tray */}
        <div style={{
          position: 'absolute', inset: 0,
          WebkitMaskImage: `linear-gradient(180deg, transparent ${VIEW.top - 12}px, #000 ${VIEW.top + 24}px, #000 ${VIEW.bottom - 24}px, transparent ${VIEW.bottom + 6}px)`,
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, width: 0, height: 0, transformOrigin: '0 0',
            transform: `translate(${VIEW.cx - cam.x * cam.s}px, ${VIEW.cy - cam.y * cam.s}px) scale(${cam.s})`,
            filter: cam.blur > 0.3 ? `blur(${cam.blur}px)` : undefined,
          }}>
            {/* the path itself: one hairline joining every stage */}
            <div style={{ position: 'absolute', left: -900, width: STAGES.at(-1)!.x + 1800, top: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--line-2) 4%, var(--line-2) 96%, transparent)' }} />
            {STAGES.map((st) => (
              <div key={st.id} style={{ position: 'absolute', left: st.x - st.w / 2, top: -st.h / 2, width: st.w }}>
                {st.id === 'publish' ? <PublishStage /> : PANELS[st.id]()}
              </div>
            ))}
          </div>
        </div>
        <Hud />
        <Carry />
        <div style={{ position: 'absolute', right: 160, top: 944, height: 112, width: 300, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', textAlign: 'right', font: `500 13.5px/19px ${F.sans}`, color: C.ink4 }}>
          {RUN.disclosure}
        </div>
      </ProductRoot>
    </AbsoluteFill>
  );

}

/** The one literal recording: Production /sandbox, baseline → Publish controlled candidate. */
function PublishStage() {
  const { frame } = useAbs();
  const sc = scene('s03-publish');
  return (
    <div style={{ position: 'relative', width: 1280, height: 720 }}>
      <div className="meta" style={{ position: 'absolute', top: -34, left: 2, display: 'flex', alignItems: 'center', gap: 8, ...blurIn(prog(frame, sc.start + 0.4)) }}>
        <span className="dot" style={{ background: 'var(--co)' }} />Screen recording · Production <span className="mono">/sandbox</span>
        <Icon name="arrow-right" size={13} /> real operator action
      </div>
      <FootageSlot slot={SANDBOX} frames={Math.round((sc.end - sc.start) * 30)} rect={{ x: 0, y: 0, w: 1280, h: 720, r: 16 }} />
    </div>
  );
}
