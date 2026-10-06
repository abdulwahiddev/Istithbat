import { Img, staticFile } from 'remotion';
import type { ReactNode } from 'react';
import { Icon } from '@/components/strata/icons';
import { Chip, Mono, type Tone } from '@/components/strata/primitives';
import { blurIn, EXPO_IN_OUT, prog } from '../../components/anim';
import { RUN } from '../../data/production';
import { DONE_AT, PRESS_AT } from '../stages';
import { useAbs } from '../time';

/** Panel-space centre of the "Publish controlled candidate" button (pointer target, v14 origin). */
export const PUBLISH_BTN = { x: 584, y: 596 };
const FLOW = 'Detect → Understand → Test → Trace → Contain → Human decision';
const STEPS = ['Unlock demo control', 'Ensure clean baseline', 'Publish controlled candidate', 'Watch Istithbat process it', 'Open incident'];

/**
 * Publish: the /sandbox operator console (components/sandbox/SandboxConsole.tsx + SandboxBar),
 * markup and copy verbatim, driven by the run's clock instead of fetches: the verified baseline
 * (Latest v13 · Trusted v13 · Served v13, Ready to run, demo control active), the operator pressing
 * "Publish controlled candidate", the console's busy state, then "Processing". No Production call.
 */
export function PublishPanel() {
  const { frame, t } = useAbs();
  const busy = t >= PRESS_AT + 0.22 && t < DONE_AT.publish;
  const running = t >= DONE_AT.publish;
  const press = Math.max(0, 1 - Math.abs(t - (PRESS_AT + 0.08)) / 0.14); // the :active dip, ~0.3 s
  type P = { tone: Tone; chip: string; title: string; body: ReactNode; primary: ReactNode };
  const ready: P = {
    tone: 'tq', chip: 'Ready to run', title: 'Ready to run',
    body: <>Clean baseline: upstream, trusted and served are all <span className="mono">{RUN.versions.trusted}</span>. Publishing sends one signed source update with the prepared <span className="mono">{RUN.versions.latest}</span> candidate.</>,
    primary: <button type="button" className="btn btn-go sbx-cta" disabled={busy}
      style={{ translate: `0 ${press}px`, scale: `${1 - 0.01 * press}`, filter: press ? `brightness(${1 + 0.08 * press})` : undefined,
        boxShadow: t > PRESS_AT - 0.6 && !busy ? '0 0 0 3px var(--ground), 0 0 0 5px var(--tq)' : undefined }}>
      <Icon name="arrow-up-right" size={18} />{busy ? 'Publishing…' : 'Publish controlled candidate'}</button>,
  };
  const processing: P = {
    tone: 'am', chip: 'Processing', title: 'Processing controlled candidate…',
    body: <>Istithbat is working through the pipeline below. Publishing again is disabled until it finishes.</>,
    primary: <a className="btn btn-ghost sbx-btn-s">Watch progress<Icon name="arrow-right" size={15} style={{ transform: 'rotate(90deg)' }} /></a>,
  };
  const P = running ? processing : ready;
  const step = (n: number) => (running ? (n <= 3 ? 'done' : n === 4 ? 'now' : 'todo') : n <= 2 ? 'done' : n === 3 ? 'now' : 'todo');
  const swap = running ? prog(frame, DONE_AT.publish, 0.5) : 1;
  return (
    <div style={{ width: 1280, height: 780, position: 'relative', borderRadius: 16, overflow: 'hidden', background: 'var(--ground)', border: '1px solid var(--line-2)', boxShadow: '0 30px 60px -30px rgba(0,0,0,.9)' }}>
      {/* SandboxBar */}
      <header className="sbx-bar" style={{ position: 'relative' }}>
        <div className="wrap sbx-bar-in" style={{ maxWidth: 'none' }}>
          <span className="sbx-bar-l">
            <span className="brand" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Img src={staticFile('brand/istithbat-symbol-on-dark.png')} style={{ height: 30 }} />
              <Img src={staticFile('brand/istithbat-wordmark-on-dark.png')} style={{ height: 30 }} />
            </span>
            <span className="sbx-env"><Icon name="flask-conical" size={14} />Demo sandbox<span className="sbx-env-sub"> · Controlled test environment</span></span>
          </span>
          <span className="sbx-bar-r"><span className="btn btn-ghost sbx-btn-s">Back to Istithbat<Icon name="arrow-up-right" size={16} /></span></span>
        </div>
      </header>
      <section className="sbx-top" style={{ paddingTop: 30 }}>
        <div className="wrap" style={{ maxWidth: 'none' }}>
          <p className="sbx-kicker"><Icon name="flask-conical" size={15} />Controlled Istithbat demo</p>
          <h1 className="sbx-h1">Trigger one known source change and watch Istithbat respond.</h1>
          <p className="sbx-flowline">{FLOW.split(' → ').map((x, i) => <span key={x}>{i > 0 && <i aria-hidden="true">→</i>}{x}</span>)}</p>
          <p className="sbx-disclosure top"><Icon name="info" size={14} />{RUN.disclosure}</p>
          <div className="plate sbx-run" style={{ margin: 0 }}>
            <ol className="sbx-steps">
              {STEPS.map((s, i) => { const st = step(i + 1); return <li key={s} data-st={st}><span className="sbx-n">{st === 'done' ? <Icon name="check" size={13} stroke={2.4} /> : i + 1}</span><span>{s}</span></li>; })}
            </ol>
            <div className="sbx-now" style={{ opacity: swap }}>
              <span className="sbx-now-h"><Chip tone={P.tone}>{P.chip}</Chip>
                <span className="meta">Latest <Mono>{RUN.versions.trusted}</Mono> · Trusted <Mono>{RUN.versions.trusted}</Mono> · Served <Mono>{RUN.versions.served}</Mono></span></span>
              <h2 className="sbx-now-t">{P.title}</h2>
              <p className="body">{P.body}</p>
              <div className="sbx-primary">{P.primary}</div>
              <p className="meta sbx-session"><Chip tone="tq" small>Demo control active</Chip>Not a reviewer permission. <span className="sbx-textbtn">Sign out of demo control</span></p>
            </div>
          </div>
          <div className="sbx-msgs" style={{ ...blurIn(prog(frame, DONE_AT.publish + 0.2, 0.6), 6, 6) }}>
            <p className="sbx-msg ok" role="status"><Icon name="check" size={16} />Published in the controlled simulator. Test source update sent to Istithbat.</p>
          </div>
        </div>
      </section>
      <Pointer />
    </div>
  );
}

/** A neutral system pointer: approaches the button, presses, then rests. */
function Pointer() {
  const { t } = useAbs();
  const a = { x: 900, y: 650 }, b = { x: PUBLISH_BTN.x + 30, y: PUBLISH_BTN.y + 10 };
  const k = EXPO_IN_OUT(Math.min(1, Math.max(0, (t - (PRESS_AT - 1.6)) / 1.4)));
  const vis = Math.min(1, Math.max(0, (t - (PRESS_AT - 1.9)) / 0.3)) * (1 - Math.min(1, Math.max(0, (t - (DONE_AT.publish + 1.2)) / 0.5)));
  const down = Math.max(0, 1 - Math.abs(t - (PRESS_AT + 0.08)) / 0.14);
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" style={{ position: 'absolute', left: a.x + (b.x - a.x) * k, top: a.y + (b.y - a.y) * k, opacity: vis, scale: `${1 - 0.12 * down}`, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.6))' }}>
      <path d="M4 2.5l14.5 10.2-6.6 1.1 3.9 7.2-2.7 1.4-3.9-7.3-4.9 4.6z" fill="#F4F5F7" stroke="#08090B" strokeWidth={1.2} strokeLinejoin="round" />
    </svg>
  );
}
