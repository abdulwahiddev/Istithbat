'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { PipelineRunState, SandboxConsoleState, type SandboxConsoleState as State } from '@/lib/contracts';
import { demoStages, pipelineFingerprint, stageStatus } from '@/lib/contracts/sandbox-progress';
import { ExactDiff } from '@/components/strata/ExactDiff';
import { Icon } from '@/components/strata/icons';
import { dayTime, versionHint, versionText } from '@/components/strata/format';
import { Band, Chip, HeadRow, Kv, Mk, Mono, Rail, SyntheticRow, type Layer, type Tone } from '@/components/strata/primitives';
import type { SandboxScenario } from '@/app/(sandbox)/sandbox/scenario';

/**
 * Demo sandbox: the operator console for the controlled test. One flow, always stated:
 * unlock demo control → clean baseline → publish the controlled candidate → watch Istithbat → open
 * the incident. The data flow is unchanged: state is read from /api/sandbox/status, the pipeline is
 * polled from /api/pipeline/{id}, and publish/reset require the demo-control session. Scenario
 * facts (fixtures, versions, the changed field and its exact values) come from the server.
 */
function signalDemoChange(runId: string | null) {
  // Notify other open Istithbat tabs to re-read; never manufacture a backend state.
  try { localStorage.setItem('istithbat-demo-change', JSON.stringify({ at: Date.now(), runId })); } catch { /* Browser storage may be disabled. */ }
  window.dispatchEvent(new Event('istithbat-demo-change'));
}
async function readJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(init?.method === 'POST' ? 75_000 : 20_000), ...init });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? 'The request failed. Try again.');
  return body;
}

type Version = State['trusted'];
const ver = (v: Version) => (v ? versionText(v.label, v.revision) : 'Not recorded');
/** HEALTHY → Healthy, SERVING_TRUSTED → Serving trusted */
const human = (s: string | null | undefined) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : 'Unknown');
const statusTone = (s: string | null | undefined): Tone =>
  !s ? 'n4' : /QUARANTINED|REJECTED|FAILED/.test(s) ? 'co' : /TRUSTED|HEALTHY|SERVING/.test(s) ? 'tq' : /ANALYZING|NEEDS|DEGRADED|PENDING/.test(s) ? 'am' : 'n4';
const STAGE_LAYER: Record<string, Layer> = { Detect: 'det', Understand: 'ai', Test: 'det', Trace: 'det', Contain: 'pol' };
const STAGE_HREF: Record<string, string> = { Detect: '#source', Understand: '#advisory', Test: '#behavior', Trace: '/blast-radius', Contain: '#containment' };
const vlab = (v: Version) => (v ? versionText(v.label, v.revision, 'label') : '—');
const FLOW = 'Detect → Understand → Test → Trace → Contain → Human decision';

type Stage = 'loading' | 'locked' | 'ready' | 'published' | 'off-baseline' | 'running';

export function SandboxConsole({ scenario: sc }: { scenario: SandboxScenario }) {
  const [state, setState] = useState<State | null>(null);
  const [auth, setAuth] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pollEpoch, setPollEpoch] = useState(0);
  const alive = useRef(true);
  const readState = useCallback(async () => {
    const result = SandboxConsoleState.parse(await readJson('/api/sandbox/status'));
    if (alive.current) setState(result);
    return result;
  }, []);
  useEffect(() => {
    alive.current = true;
    void Promise.all([readState(), readJson('/api/demo/control').then((v) => { if (alive.current) { setAuth(v.authenticated); setConfigured(v.configured); } })])
      .catch((e) => { if (alive.current) setError(e.message); });
    return () => { alive.current = false; };
  }, [readState]);
  const runId = state?.pipeline?.id;
  const running = state?.pipeline?.status === 'RUNNING';
  useEffect(() => {
    if (!runId || !running) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let previous = pipelineFingerprint(state.pipeline);
    const deadline = Date.now() + 10 * 60_000;
    let failures = 0;
    setPaused(false);
    async function poll() {
      if (cancelled) return;
      if (Date.now() > deadline) { setPaused(true); return; }
      if (document.visibilityState === 'visible') {
        try {
          const run = PipelineRunState.parse(await readJson(`/api/pipeline/${runId}`));
          if (cancelled) return;
          const fingerprint = pipelineFingerprint(run);
          if (fingerprint !== previous || run.status !== 'RUNNING') { await readState(); previous = fingerprint; }
          failures = 0;
          if (run.status !== 'RUNNING') return;
        } catch { if (++failures >= 5) { if (!cancelled) { setError('Progress could not be refreshed. The persisted run is unchanged. Check again to reconnect.'); setPaused(true); } return; } }
      }
      if (!cancelled) timer = setTimeout(poll, 1500);
    }
    timer = setTimeout(poll, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
    // The run identity and terminal state own the polling lifecycle, not every step update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, running, readState, pollEpoch]);
  async function login(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await readJson('/api/demo/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) }); setAuth(true); }
    catch (err) { setError((err as Error).message); }
    finally { setPassword(''); setBusy(false); }
  }
  async function signOut() {
    try { await readJson('/api/demo/control', { method: 'DELETE' }); setAuth(false); setConfirmReset(false); } catch (err) { setError((err as Error).message); }
  }
  async function action(kind: 'publish' | 'reset') {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await readJson(kind === 'publish' ? '/api/sandbox/publish' : '/api/demo/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: kind === 'publish' ? JSON.stringify({ fixture: sc.candidateFixture }) : '{}' });
      setNotice(kind === 'reset' ? 'Demo reset to v13. Audit history is retained.' : result.status === 'NO_CHANGE' ? 'Already published: the existing observation and pipeline are reused.' : 'Published upstream. Source update sent to Istithbat.');
      await readState(); signalDemoChange(result.runId ?? null); setPollEpoch((n) => n + 1); setConfirmReset(false);
    } catch (err) { setError((err as Error).message); await readState().catch(() => {}); }
    finally { setBusy(false); }
  }
  async function refresh() { setError(''); try { await readState(); setPollEpoch((n) => n + 1); setPaused(false); } catch (err) { setError((err as Error).message); } }

  const record = state?.payload.records[0];
  const judgment = sc.field ? String(record?.content[sc.field] ?? '') : '';
  const run = state?.pipeline;
  const incidentHref = run?.incidentId ? `/incidents/${run.incidentId}` : null;
  const atBaseline = state?.fixture === sc.baselineFixture;
  const published = state?.fixture === sc.candidateFixture;
  const stage: Stage = !state ? 'loading' : running ? 'running' : published ? 'published' : !atBaseline ? 'off-baseline' : auth ? 'ready' : 'locked';
  const served = state?.served[0];
  const versions = state ? <>Latest <Mono>{vlab(state.latestSeen)}</Mono> · Trusted <Mono>{vlab(state.trusted)}</Mono> · Served <Mono>{vlab(served?.version ?? null)}</Mono></> : null;

  const unlockForm = (quiet = false) => (
    <form onSubmit={login} className="sbx-unlock">
      <label htmlFor="control-password">Demo-control credential</label>
      <div className="sbx-row">
        <input id="control-password" className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={busy || !configured} />
        <button type="submit" className={`btn ${quiet ? 'btn-ghost' : 'btn-go'} sbx-btn-s`} disabled={busy || !configured}><Icon name="lock-open" size={16} />{busy ? 'Checking…' : 'Unlock demo control'}</button>
      </div>
      {!configured && <p className="meta" role="note">Demo control is not configured on this server.</p>}
    </form>
  );
  const resetControl = (label: string) => confirmReset ? (
    <div className="sbx-confirm" role="alertdialog" aria-label="Confirm demo reset">
      <p><b>This clears the current sandbox investigation.</b> Return upstream, trusted and served to <span className="mono">{sc.baselineLabel}</span>? Audit history is retained.</p>
      <div className="sbx-row">
        <button type="button" className="btn btn-go sbx-btn-s" disabled={busy || !auth || running} onClick={() => action('reset')}>{busy ? 'Resetting…' : `Confirm reset to ${sc.baselineLabel}`}</button>
        <button type="button" className="btn btn-ghost sbx-btn-s" disabled={busy} onClick={() => setConfirmReset(false)}>Cancel</button>
      </div>
    </div>
  ) : <button type="button" className="btn btn-ghost sbx-btn-s" disabled={!auth || busy || running} onClick={() => setConfirmReset(true)}><Icon name="refresh-cw" size={15} />{label}</button>;

  // What the operator sees right now: state, the one next action, and why anything else is unavailable.
  const panel: Record<Stage, { tone: Tone; chip: string; title: string; body: ReactNode; primary: ReactNode; secondary?: ReactNode }> = {
    loading: { tone: 'n4', chip: 'Reading', title: 'Reading the demo state…', body: 'The current upstream, trusted and served versions are being read from the persisted state.', primary: null },
    locked: { tone: 'n4', chip: 'Locked', title: 'Unlock demo control', body: 'Required to reset or publish the controlled test.', primary: unlockForm() },
    ready: {
      tone: 'tq', chip: 'Ready to run', title: 'Ready to run', body: <>Clean baseline: upstream, trusted and served are all <span className="mono">{sc.baselineLabel}</span>. Publishing sends one signed source update with the prepared <span className="mono">{sc.candidateLabel}</span> candidate.</>,
      primary: <button type="button" className="btn btn-go sbx-cta" onClick={() => action('publish')} disabled={busy || !auth || !atBaseline || running}><Icon name="arrow-up-right" size={18} />{busy ? 'Publishing…' : 'Publish controlled candidate'}</button>,
      secondary: resetControl('Reset baseline'),
    },
    published: {
      tone: 'co', chip: 'Candidate already published', title: 'Candidate already published', body: <>The controlled candidate has been processed; its incident is open for review. Reset to <span className="mono">{sc.baselineLabel}</span> before running the demo again.</>,
      primary: incidentHref ? <Link prefetch={false} className="btn btn-go sbx-cta" href={incidentHref}><Icon name="arrow-up-right" size={18} />Open incident</Link> : <span className="meta">No incident is recorded for this run.</span>,
      secondary: auth ? resetControl(`Reset demo to ${sc.baselineLabel}`) : <span className="sbx-why">Unlock demo control to reset the demo. {unlockForm(true)}</span>,
    },
    'off-baseline': {
      tone: 'am', chip: 'Not at baseline', title: 'Reset to the baseline first', body: <>The source is at a different fixture ({state ? <span className="mono">{state.fixture}</span> : '—'}). Reset to <span className="mono">{sc.baselineLabel}</span> to start the controlled test.</>,
      primary: auth ? resetControl(`Reset demo to ${sc.baselineLabel}`) : unlockForm(),
    },
    running: {
      tone: 'am', chip: 'Processing', title: 'Processing controlled candidate…', body: <>Istithbat is working through the pipeline below. Publishing again is disabled until it finishes.</>,
      primary: <a className="btn btn-ghost sbx-btn-s" href="#pipeline">Watch progress<Icon name="arrow-right" size={15} style={{ transform: 'rotate(90deg)' }} /></a>,
    },
  };
  const P = panel[stage];
  const step = (n: number) => {
    const done = n === 1 ? auth : n === 2 ? atBaseline || published || running : n === 3 ? published || running : n === 4 ? !!run && !running && published : n === 5 && false;
    const now = { locked: 1, 'off-baseline': auth ? 2 : 1, ready: 3, running: 4, published: 5, loading: 0 }[stage] === n;
    return done && !now ? 'done' : now ? 'now' : 'todo';
  };
  const STEPS = ['Unlock demo control', 'Ensure clean baseline', 'Publish controlled candidate', 'Watch Istithbat process it', 'Open incident'];

  return (
    <>
      <section className="sbx-top">
        <div className="wrap">
          <p className="sbx-kicker"><Icon name="flask-conical" size={15} />Controlled Istithbat demo</p>
          <h1 className="sbx-h1">Trigger one known source change and watch Istithbat respond.</h1>
          <p className="sbx-flowline" aria-label={`Istithbat will ${FLOW}`}>{FLOW.split(' → ').map((x, i) => <span key={x}>{i > 0 && <i aria-hidden="true">→</i>}{x}</span>)}</p>

          {/* Demo run: the operator console */}
          <div className="plate sbx-run" aria-labelledby="sbx-run-h">
            <ol className="sbx-steps" aria-label="Demo run">
              {STEPS.map((t, i) => { const st = step(i + 1); return <li key={t} data-st={st}><span className="sbx-n" aria-hidden="true">{st === 'done' ? <Icon name="check" size={13} stroke={2.4} /> : i + 1}</span><span>{t}</span>{st === 'now' && <span className="sr-only"> (current step)</span>}</li>; })}
            </ol>
            <div className="sbx-now" aria-live="polite">
              <span className="sbx-now-h"><Chip tone={P.tone}>{P.chip}</Chip>{state && <span className="meta">{versions}</span>}</span>
              <h2 id="sbx-run-h" className="sbx-now-t">{P.title}</h2>
              <p className="body">{P.body}</p>
              {P.primary && <div className="sbx-primary">{P.primary}</div>}
              {P.secondary && <div className="sbx-secondary">{P.secondary}</div>}
              {auth && stage !== 'locked' && (
                <p className="meta sbx-session"><Chip tone="tq" small>Demo control active</Chip>Not a reviewer permission. <button type="button" className="sbx-textbtn" disabled={busy} onClick={signOut}>Sign out of demo control</button></p>
              )}
            </div>
          </div>

          {(error || notice) && <div className="sbx-msgs">
            {error && <p className="sbx-msg err" role="alert"><Icon name="triangle-alert" size={16} />{error}</p>}
            {notice && <p className="sbx-msg ok" role="status"><Icon name="check" size={16} />{notice}</p>}
          </div>}
        </div>
      </section>

      {/* What Istithbat did with it */}
      <Band id="pipeline" labelledBy="h-pipe">
        <Rail layer="det" id="h-pipe" title="Pipeline">From the source update to a human review, from persisted steps.</Rail>
        <div className="main">
          <HeadRow title="Source update → human review" right={<span style={{ display: 'inline-flex', gap: 16, alignItems: 'center' }}>{run && <span className="meta">{run.status === 'RUNNING' ? (paused ? 'Live refresh paused' : 'Processing · live from persisted steps') : run.status === 'FAILED_CLOSED' ? 'Failed closed · held for a person' : 'Pipeline complete'}</span>}<button type="button" className="lnk sbx-lnk" onClick={refresh} disabled={busy}><Icon name="refresh-cw" size={14} />Check again</button></span>} />
          {!state ? <div className="plate"><p className="body" role="status">Reading the current run…</p></div>
            : !run ? (
              <div className="plate sbx-empty"><Mk layer="det" /><div><b>No pipeline for this source version yet</b><p className="body">Publishing the controlled candidate sends a signed source update. Istithbat fetches the upstream source and its persisted pipeline appears here.</p></div></div>
            ) : <>
              <div className="plate" style={{ paddingTop: 24, paddingBottom: 24 }}>
                <ol className="flow sbx-flow">
                  {demoStages.map((stg) => {
                    const status = stageStatus(run, stg.steps);
                    return <Step key={stg.name} href={incidentHref ? incidentHref + STAGE_HREF[stg.name] : null} layer={STAGE_LAYER[stg.name]} title={stg.name} sub={stg.description} state={status} now={status === 'Running'} />;
                  })}
                  <Step href={incidentHref ? `${incidentHref}#decision` : null} layer="hum" title="Human decision"
                    sub={run.status === 'RUNNING' ? 'The investigation is still running' : run.status === 'FAILED_CLOSED' ? 'Failed closed · review the recorded failure' : 'AI advises · policy governs · humans decide'}
                    state={run.status === 'RUNNING' ? 'Pending' : run.incidentId ? 'Now' : 'No incident'} now={run.status !== 'RUNNING' && !!run.incidentId} />
                </ol>
              </div>
              <div className="sbx-runfoot"><span className="meta">Run <Mono>{run.id.slice(0, 8)}</Mono></span>{incidentHref && <Link prefetch={false} className="lnk" href={incidentHref}>Open incident <Icon name="arrow-up-right" size={14} /></Link>}</div>
              {run.steps.some((s) => s.errorCode) && <p className="sbx-msg err" role="note"><Icon name="triangle-alert" size={16} />Recorded step errors: {run.steps.filter((s) => s.errorCode).map((s) => `${s.step}: ${s.errorCode}`).join('; ')}. A completed pipeline can still include failed analysis steps; the policy decision remains authoritative.</p>}
              {state.lastCheck?.status === 'FAILED' && <p className="sbx-msg err" role="note"><Icon name="triangle-alert" size={16} />The latest source check failed: {state.lastCheck.errorCode}. Published upstream and latest seen may differ.</p>}
            </>}
        </div>
      </Band>

      {/* The scenario: derived from the baseline and candidate fixtures on the server */}
      <Band id="change" labelledBy="h-change">
        <Rail layer="src" id="h-change" title="The controlled change">Exactly what the candidate changes, field by field.</Rail>
        <div className="main">
          <HeadRow title={<>Controlled candidate · <span className="mono">{sc.recordKey}</span></>} right={<span className="meta">{sc.changedFields} of {sc.totalFields} fields changed{sc.field && <> · <span className="mono">{sc.field}</span></>}</span>} />
          <div className="plate tight">
            {sc.field ? <ExactDiff oldValue={sc.oldValue} newValue={sc.newValue} oldLabel={sc.baselineLabel} newLabel={sc.candidateLabel}
              oldChip={<Chip tone="tq" small>Baseline</Chip>} newChip={<Chip tone="co" small>Candidate</Chip>} /> : <p className="body" style={{ padding: '16px 0' }}>The baseline and candidate fixtures are identical.</p>}
          </div>
        </div>
      </Band>

      {/* What the upstream publishes right now */}
      <Band id="source" labelledBy="h-src">
        <Rail layer="src" id="h-src" title="Upstream">What the controlled upstream publishes right now.</Rail>
        <div className="main">
          <HeadRow title="Published source" right={state ? <span className="meta">Last publish or reset · <time dateTime={state.publishedAt}>{dayTime(state.publishedAt)}</time></span> : undefined} />
          {!state ? <div className="plate"><p className="body" role="status">Reading the current source…</p></div> : (
            <div className="sub" style={{ rowGap: 24, alignItems: 'start' }}>
              <div className="c1-6 plate in l sbx-record" style={{ marginLeft: -24, paddingLeft: 24 }}>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>{sc.synthetic && <Chip tone="am" small>Synthetic record</Chip>}<Mono>{record?.canonical_key}</Mono></span>
                <p className="ar sbx-ar" dir="rtl" lang="ar">{String(record?.content.arabic_text ?? '')}</p>
                {sc.field && <div className="sbx-judg"><span className="cap">Current <span className="mono">{sc.field}</span></span><span className="ar" dir="rtl" lang="ar">{judgment}</span></div>}
              </div>
              <div className="c7-10 plate in r" style={{ marginRight: -24, paddingRight: 24 }}>
                <Kv k="Published label"><span title={versionHint(state.payload.upstreamVersionLabel)}><Mono>{versionText(state.payload.upstreamVersionLabel, null, 'label')}</Mono></span></Kv>
                <Kv k="Connector health"><Chip tone={statusTone(state.health)} small>{human(state.health)}</Chip></Kv>
                <Kv k="Latest seen by Istithbat"><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Mono>{ver(state.latestSeen)}</Mono>{state.latestSeen?.status && <Chip tone={statusTone(state.latestSeen.status)} small>{human(state.latestSeen.status)}</Chip>}</span></Kv>
                <Kv k="Trusted"><Mono>{ver(state.trusted)}</Mono></Kv>
                {state.served.map((g) => <Kv key={g.appId} k={<>Served · <Mono>{g.appId}</Mono></>}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Mono>{ver(g.version)}</Mono><Chip tone={statusTone(g.gatewayStatus)} small>{human(g.gatewayStatus)}</Chip></span></Kv>)}
                <Kv k="Fixture"><Mono>{state.fixture}</Mono></Kv>
                {sc.synthetic && <SyntheticRow />}
              </div>
            </div>
          )}
          {record && <details><summary>Full upstream record</summary><div className="raw" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(record, null, 2)}</div></details>}
        </div>
      </Band>

      {/* About: the longer explanation, below the operator flow */}
      <Band id="about" labelledBy="h-about">
        <Rail layer="pol" id="h-about" title="About this sandbox">How the controlled test is isolated.</Rail>
        <div className="main">
          <div className="plate sbx-about">
            <p className="body">The sandbox is a controlled upstream source inside the same Istithbat app and backend. Publishing replaces its current fixture with the prepared candidate and sends one signed source update; Istithbat then fetches, fingerprints, analyses, tests, traces and applies policy exactly as for any source, and a human decides.</p>
            <p className="body">Demo control can publish and reset fixtures only. It is separate from Reviewer Mode: it cannot sign a review decision. Reset returns upstream, trusted and served to the baseline and clears sandbox candidate incidents, reviews and pipeline state; the audit history is retained.</p>
            {sc.synthetic && <p className="meta">Controlled fixtures only. Their text, evaluator and references are fictional; this is not a religious authority or a real hadith provider.</p>}
          </div>
        </div>
      </Band>
      <div style={{ height: 96 }} />
    </>
  );
}

/** One stage on the Overview pipeline track; links into the incident once one exists. */
function Step({ href, layer, title, sub, state, now }: { href: string | null; layer: Layer; title: string; sub: ReactNode; state: string; now?: boolean }) {
  const body = <><span className="fmk"><Mk layer={layer} /></span><b>{title}</b><span>{sub}</span><i>{state}</i></>;
  return <li className={now ? 'now' : undefined} data-status={state}>{href ? <Link prefetch={false} className="fs" href={href}>{body}</Link> : <span className="fs">{body}</span>}</li>;
}
