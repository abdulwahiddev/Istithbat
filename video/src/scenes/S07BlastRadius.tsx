import { useCurrentFrame } from 'remotion';
import { C, F } from '../brand';
import { prog } from '../components/anim';
import { Callout, Status } from '../components/Callout';
import { FootageScene } from '../components/FootageScene';
import { Icon, type IconName } from '../components/Icon';
import { FRAME } from '../components/layout';
import { SLOTS } from '../footage';
import { cueAt, scene, sentenceAt } from '../timing';

const ID = 's07-blast-radius' as const;

/**
 * 1:10–1:23 · REAL Blast Radius capture. A path legend follows the camera across the dependency
 * trace; the verified tally lands when the narration states it. Tally order and colours follow the
 * product (BlastInstrument: impacted = coral, exposed = amber, stale = amber outline).
 */
export function S07BlastRadius() {
  const frame = useCurrentFrame();
  const sc = scene(ID);
  const s0 = sentenceAt(ID, 0);
  const a = s0.start - sc.start, d = s0.end - s0.start + 0.6;
  const tSix = cueAt(ID, 'Six downstream');
  const tOne = cueAt(ID, 'and one protected');
  const s = SLOTS.blast;
  const path: { label: string; icon: IconName }[] = [
    { label: 'record', icon: 'file-text' }, { label: 'dataset', icon: 'database' }, { label: 'chunk', icon: 'layers-2' },
    { label: 'index', icon: 'list-tree' }, { label: 'APIs', icon: 'braces' }, { label: 'applications', icon: 'app-window' },
  ];
  const tally = [C.co, C.am, C.am, C.am, C.am, C.am, C.am];
  return (
    <FootageScene n="05" chapter="Blast Radius" layer="det" slot={s} frames={sc.frames}>
      <div style={{
        position: 'absolute', top: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 4,
        padding: '8px 10px', borderRadius: 999, background: 'rgba(18,20,24,.92)', border: `1px solid ${C.glassLine}`, boxShadow: C.floatShadow,
        fontFamily: F.sans, whiteSpace: 'nowrap', opacity: prog(frame, 0.2, 0.5),
      }}>
        {path.map((n, i) => {
          const p = prog(frame, a + (d * i) / path.length, 0.4);
          return (
            <div key={n.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && <span style={{ display: 'flex', color: C.ink4, opacity: 0.35 + 0.65 * p }}><Icon name="arrow-right" size={16} /></span>}
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', font: `500 19px/1 ${F.sans}`, color: p > 0.5 ? C.ink : C.ink4 }}>
                <span style={{ display: 'flex', color: i === 0 ? C.ink2 : p > 0.5 ? C.amInk : C.ink4 }}><Icon name={n.icon} size={19} /></span>{n.label}
              </span>
            </div>
          );
        })}
      </div>
      <Callout at={tSix} x={48} y={FRAME.h - 48 - 158} w={540} layer="det" label="Blast Radius · deterministic trace">
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tally.length},1fr)`, gap: 5, margin: '8px 0 14px' }}>
          {tally.map((c, i) => <span key={i} style={{ height: 10, borderRadius: 3, background: c, opacity: prog(frame, tSix + 0.25 + i * 0.07, 0.25) }} />)}
        </div>
        <span style={{ display: 'flex', gap: 22, fontSize: 22 }}>
          <Status color={C.amInk}><b style={{ fontWeight: 600 }}>6</b> EXPOSED</Status>
          <Status color={C.coInk}><b style={{ fontWeight: 600 }}>1</b> IMPACTED</Status>
          <Status color={C.amInk} ring><b style={{ fontWeight: 600 }}>0</b> STALE</Status>
        </span>
      </Callout>
      <Callout at={tOne} x={FRAME.w - 48 - 380} y={FRAME.h - 48 - 110} w={380} anchor={s.anchors.qa} icon="app-window" iconColor={C.coInk} label="Islamic Q&A · protected app">
        <Status color={C.coInk}>IMPACTED</Status>
        <div style={{ font: `400 17px/23px ${F.sans}`, color: C.ink3, marginTop: 4 }}>Exposed + protected + material regression</div>
      </Callout>
    </FootageScene>
  );
}
