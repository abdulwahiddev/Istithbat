import type { ReactNode } from 'react';
import { interpolate } from 'remotion';
import { StateMark } from '@/components/strata/entity';
import { EXPO_IN_OUT, prog } from '../components/anim';
import { RUN } from '../data/production';
import { scene } from '../timing';
import { camAt, w2s, type Cam } from './camera';
import { HUD } from './Hud';
import { candidateAt, GATE } from './panels/ContainPanel';
import { evidenceAt } from './panels/HumanPanel';
import { markerAt } from './panels/PipelinePanel';
import { nodeAt, TRACE } from './panels/TracePanel';
import { PUBLISH_BTN } from './panels/PublishPanel';
import { cue, DONE_AT, RUN_AT, stage, type StageId } from './stages';
import { useAbs } from './time';

type Pos = { w: [number, number] } | { s: [number, number] };
type WP = { t: number; at: Pos };
const toScreen = (c: Cam, p: Pos) => ('s' in p ? { x: p.s[0], y: p.s[1] } : w2s(c, p.w[0], p.w[1]));
/** Panel-space → world (panels are placed top-left at (x − w/2, −h/2)). */
const pw = (id: StageId, x: number, y: number): Pos => { const st = stage(id); return { w: [st.x - st.w / 2 + x, -st.h / 2 + y] }; };

export const TRAY = { y: 904, label: 160, slots: [250, 548, 818, 1078] };
const tray = (i: number): Pos => ({ s: [TRAY.slots[i], TRAY.y] });
const evid = (i: number): Pos => pw('human', evidenceAt(i).x, evidenceAt(i).y);
const S9 = scene('s09-human-review').start;

function place(c: Cam, t: number, path: WP[]) {
  if (t <= path[0].t) return toScreen(c, path[0].at);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (t <= b.t) {
      const k = EXPO_IN_OUT((t - a.t) / Math.max(1e-6, b.t - a.t));
      const A = toScreen(c, a.at), B = toScreen(c, b.at);
      // a soft arc so carried objects travel, rather than slide
      const lift = Math.sin(Math.PI * k) * Math.min(60, Math.hypot(B.x - A.x, B.y - A.y) * 0.12);
      return { x: A.x + (B.x - A.x) * k, y: A.y + (B.y - A.y) * k - lift, moving: k > 0 && k < 1 };
    }
  }
  return toScreen(c, path[path.length - 1].at);
}

type Item = { id: string; path: WP[]; show: [number, number][]; anchor: 'center' | 'left'; body: ReactNode };

const pubAnchor = pw('publish', PUBLISH_BTN.x, PUBLISH_BTN.y);
const marker = (i: number) => pw('pipeline', markerAt(i).x, markerAt(i).y);
const latest: Pos = { s: [HUD.latestX, HUD.latestY] };
const tPol = cue('s08-gateway', 'POL-002 quarantines');
const tOne = cue('s07-blast-radius', 'and one protected');

const chip = (children: ReactNode) => <span className="chip" style={{ fontSize: 14, padding: '5px 13px 5px 11px', boxShadow: 'var(--float-shadow)', background: 'var(--float-bg)' }}>{children}</span>;

const ITEMS: Item[] = [
  {
    id: 'v14', anchor: 'center',
    body: <span className="mono" style={{ display: 'inline-block', fontSize: 20, lineHeight: 1, padding: '10px 14px', borderRadius: 12, border: '1.5px solid var(--co)', background: 'var(--plate-a)', color: 'var(--ink)', boxShadow: 'var(--float-shadow)' }}>{RUN.versions.latest}</span>,
    path: [
      { t: DONE_AT.publish, at: pubAnchor }, { t: DONE_AT.publish + 0.9, at: pw('publish', 1010, 560) }, { t: scene('s04-pipeline').start - 0.6, at: pw('publish', 1010, 560) },
      { t: RUN_AT.detect + 0.4, at: marker(0) }, { t: RUN_AT.understand, at: marker(0) }, { t: RUN_AT.understand + 0.7, at: marker(1) },
      { t: RUN_AT.test, at: marker(1) }, { t: RUN_AT.test + 0.7, at: marker(2) }, { t: RUN_AT.trace, at: marker(2) }, { t: RUN_AT.trace + 0.7, at: marker(3) },
      { t: RUN_AT.contain, at: marker(3) }, { t: RUN_AT.contain + 0.7, at: marker(4) }, { t: DONE_AT.contain + 0.2, at: marker(4) },
      { t: scene('s05-exact-change').start - 0.2, at: latest },
      { t: tPol - 2.0, at: latest }, { t: tPol - 1.15, at: pw('contain', candidateAt.x, candidateAt.y) },
    ],
    show: [[DONE_AT.publish, scene('s05-exact-change').start - 0.1], [tPol - 2.0, tPol - 1.1]],
  },
  {
    id: 'removed', anchor: 'left',
    body: chip(<><span className="mono" style={{ color: 'var(--ink)' }}>{RUN.field}</span><span style={{ color: 'var(--co-ink)' }}>−4 words</span><span className="ar" dir="rtl" lang="ar" style={{ fontSize: 17, color: 'var(--co-ink)', textDecoration: 'line-through 1.5px var(--co)' }}>{RUN.removedText}</span></>),
    path: [{ t: scene('s06-regression').start - 1.3, at: pw('detect', 520, 250) }, { t: scene('s06-regression').start - 0.2, at: tray(0) }, { t: S9 + 0.5, at: tray(0) }, { t: S9 + 1.4, at: evid(0) }],
    show: [[scene('s06-regression').start - 1.3, 999]],
  },
  {
    id: 'regression', anchor: 'left',
    body: chip(<><StateMark s="impacted" /><span><b style={{ color: 'var(--co-ink)' }}>{RUN.regression.material}</b> of {RUN.regression.comparisons} material</span><span style={{ color: 'var(--ink-3)' }}>· {RUN.regression.nonMaterial} non-material</span></>),
    path: [{ t: scene('s07-blast-radius').start - 1.3, at: pw('test', 760, 520) }, { t: scene('s07-blast-radius').start - 0.2, at: tray(1) }, { t: S9 + 0.9, at: tray(1) }, { t: S9 + 1.8, at: evid(1) }],
    show: [[scene('s07-blast-radius').start - 1.3, 999]],
  },
  {
    id: 'blast', anchor: 'left',
    body: chip(<><span style={{ color: 'var(--am-ink)' }}>{RUN.blast.exposed} exposed</span>·<span style={{ color: 'var(--co-ink)' }}>{RUN.blast.impacted} impacted</span>·<span style={{ color: 'var(--ink-3)' }}>{RUN.blast.stale} stale</span></>),
    path: [{ t: scene('s08-gateway').start - 1.3, at: pw('trace', 300, 70) }, { t: scene('s08-gateway').start - 0.2, at: tray(2) }, { t: S9 + 1.3, at: tray(2) }, { t: S9 + 2.2, at: evid(2) }],
    show: [[scene('s08-gateway').start - 1.3, 999]],
  },
  {
    id: 'policy', anchor: 'left',
    body: chip(<><span className="mono" style={{ color: 'var(--ink)' }}>{RUN.policy.code}</span>→<span style={{ color: 'var(--co-ink)', fontWeight: 600 }}>{RUN.policy.action}</span></>),
    path: [{ t: S9 - 1.3, at: pw('contain', GATE.gwLeft + 0.58 * (GATE.w - 48), GATE.gwTop + 190) }, { t: S9 - 0.2, at: tray(3) }, { t: S9 + 1.7, at: tray(3) }, { t: S9 + 2.6, at: evid(3) }],
    show: [[S9 - 1.3, 999]],
  },
];

/** Objects carried along the path: the v14 candidate and each stage's verified result. */
export function Carry() {
  const { frame, t } = useAbs();
  const c = camAt(frame);
  const firstTray = Math.min(...ITEMS.slice(1).map((i) => i.path[1].t));
  const trayLabel = prog(frame, firstTray - 0.2, 0.5) * (1 - prog(frame, S9 + 0.4, 0.5));
  // S7: the regression evidence links to the protected app it impacts
  const qa = w2s(c, stage('trace').x - TRACE.w / 2 + nodeAt('sandbox-qa-app').x, -stage('trace').h / 2 + nodeAt('sandbox-qa-app').y);
  const link = prog(frame, tOne - 0.5, 0.8) * (1 - prog(frame, tOne + 2.2, 0.5));
  const from = { x: TRAY.slots[1] + 90, y: TRAY.y - 16 };
  return (
    <>
      <span className="cap" style={{ position: 'absolute', left: TRAY.label, top: TRAY.y - 9, opacity: trayLabel }}>Evidence</span>
      {link > 0 && (
        <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }} width={1920} height={1080}>
          <path d={`M${from.x} ${from.y} C${from.x} ${from.y - 160} ${qa.x - 120} ${qa.y + 120} ${qa.x} ${qa.y}`} fill="none" stroke="var(--co)" strokeWidth={2}
            pathLength={1} strokeDasharray={1} strokeDashoffset={1 - link} opacity={0.85} />
          <circle cx={qa.x} cy={qa.y} r={22 * link} fill="none" stroke="var(--co)" strokeOpacity={0.5 * link} strokeWidth={2} />
        </svg>
      )}
      {ITEMS.map((it) => {
        const vis = Math.max(...it.show.map(([a, b]) => Math.min(prog(frame, a, 0.4), 1 - prog(frame, b, 0.3))));
        if (vis <= 0.001) return null;
        const p = place(c, t, it.path) as { x: number; y: number; moving?: boolean };
        return (
          <div key={it.id} style={{
            position: 'absolute', left: p.x, top: p.y, translate: it.anchor === 'center' ? '-50% -50%' : '0 -50%', opacity: vis,
            filter: p.moving ? 'blur(0.6px)' : vis < 1 ? `blur(${(1 - vis) * 6}px)` : undefined,
            scale: `${interpolate(vis, [0, 1], [0.94, 1])}`, whiteSpace: 'nowrap',
          }}>{it.body}</div>
        );
      })}
    </>
  );
}
