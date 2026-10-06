'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { PipelineRunState, SandboxConsoleState, type SandboxConsoleState as State } from '@/lib/contracts';
import { demoStages, pipelineFingerprint, stageStatus } from '@/lib/contracts/sandbox-progress';
import { ExactDiff } from '@/components/strata/ExactDiff';
import { Icon } from '@/components/strata/icons';
import { dayTime, versionHint, versionText } from '@/components/strata/format';
import { Band, Chip, Dk, HeadRow, Kv, Mk, Mono, PageHeader, Rail, Sep, type Layer, type Tone } from '@/components/strata/primitives';

/**
 * Hadith Evidence Sandbox: the controlled synthetic upstream source, presented in the Strata
 * product shell. The data flow is unchanged: state is read from /api/sandbox/status, the pipeline
 * is polled from /api/pipeline/{id}, and publish/reset require the demo-control session.
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
const BASELINE_JUDGMENT = 'إسناده صحيح', CANDIDATE_JUDGMENT = 'صحيح';

export function SandboxConsole() {
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
      const result = await readJson(kind === 'publish' ? '/api/sandbox/publish' : '/api/demo/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: kind === 'publish' ? JSON.stringify({ fixture: 'had-4821.v14.json' }) : '{}' });
      setNotice(kind === 'reset' ? 'Demo reset to v13. Audit history is retained.' : result.status === 'NO_CHANGE' ? 'Already published: the existing observation and pipeline are reused.' : 'Published upstream. Source update sent to Istithbat.');
      await readState(); signalDemoChange(result.runId ?? null); setPollEpoch((n) => n + 1); setConfirmReset(false);
    } catch (err) { setError((err as Error).message); await readState().catch(() => {}); }
    finally { setBusy(false); }
  }
  async function refresh() { setError(''); try { await readState(); setPollEpoch((n) => n + 1); setPaused(false); } catch (err) { setError((err as Error).message); } }

  const record = state?.payload.records[0];
  const judgment = String(record?.content.judgment ?? '');
  const primaryPublished = state?.fixture === 'had-4821.v14.json';
  const canPublish = state?.fixture === 'had-4821.v13.json';
  const run = state?.pipeline;
  const incidentHref = run?.incidentId ? `/incidents/${run.incidentId}` : null;

  return (
    <>
      <PageHeader
        crumbs={<><span>Sandbox</span><Sep /><span>Controlled synthetic upstream source</span></>}
        synthetic
        title={<>Hadith Evidence<br />Sandbox</>}
        lede="Publish a controlled change to a synthetic upstream source and watch Istithbat detect it, test it and hold it for a human decision. Its text, evaluator and references are fictional; it is not a religious authority or a real hadith provider."
        status={state ? <>
          <Dk k="Upstream publishes"><span title={versionHint(state.payload.upstreamVersionLabel)}><Mono>{versionText(state.payload.upstreamVersionLabel, null, 'label')}</Mono></span></Dk>
          <Dk k="Latest seen by Istithbat"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Mono>{ver(state.latestSeen)}</Mono>{state.latestSeen?.status && <Chip tone={statusTone(state.latestSeen.status)} small>{human(state.latestSeen.status)}</Chip>}</span></Dk>
          <Dk k="Trusted"><Mono>{ver(state.trusted)}</Mono></Dk>
          {state.served.map((g) => (
            <Dk key={g.appId} k={<>Served · <Mono>{g.appId}</Mono></>}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Mono>{ver(g.version)}</Mono><Chip tone={statusTone(g.gatewayStatus)} small>{human(g.gatewayStatus)}</Chip></span></Dk>
          ))}
        </> : <Dk k="Release state"><span className="meta" role="status">Reading persisted state…</span></Dk>}
      />

      {(error || notice) && (
        <section className="sbx-msgs"><div className="wrap">
          {error && <p className="sbx-msg err" role="alert"><Icon name="triangle-alert" size={16} />{error}</p>}
          {notice && <p className="sbx-msg ok" role="status"><Icon name="check" size={16} />{notice}</p>}
        </div></section>
      )}

      {/* 01 · the controlled change, with the control session beside the action it unlocks */}
      <Band id="change" labelledBy="h-change" first>
        <Rail layer="src" id="h-change" title="Source change">Publish the prepared v14 fixture; only the judgment wording changes.</Rail>
        <div className="main">
          <HeadRow title="Controlled source change" right={<button type="button" className="lnk sbx-lnk" onClick={refresh} disabled={busy}><Icon name="refresh-cw" size={14} />Check again</button>} />
          <div className="sub" style={{ rowGap: 24, alignItems: 'start' }}>
            <div className="c1-6 plate in l sbx-change" style={{ marginLeft: -24, paddingLeft: 24 }}>
              <ExactDiff oldValue={BASELINE_JUDGMENT} newValue={CANDIDATE_JUDGMENT} oldLabel="v13" newLabel="v14"
                oldChip={<Chip tone="tq" small>Baseline fixture</Chip>} newChip={<Chip tone="co" small>Candidate fixture</Chip>} />
              <div className="sbx-act">
                {state && primaryPublished
                  ? <span className="sbx-state"><Chip tone="co">v14 is published upstream</Chip><span className="meta">The observation and its pipeline are preserved; follow them below.</span></span>
                  : <button type="button" className="btn btn-go" onClick={() => action('publish')} disabled={!state || !auth || busy || !canPublish || running}>
                      {busy ? 'Publishing…' : 'Publish v14'}<Icon name="arrow-up-right" size={16} />
                    </button>}
                {state && !canPublish && !primaryPublished && <p className="meta">This source is beyond the baseline. Reset the demo before starting the primary v13 → v14 scenario.</p>}
                {state && canPublish && !auth && <p className="meta">Sign in to demo control to publish.</p>}
              </div>
            </div>
            <div className="c7-10 plate in r sbx-control" style={{ marginRight: -24, paddingRight: 24 }}>
              <ControlHead auth={auth} />
              {auth ? <>
                <p className="body">The control session can publish fixtures and reset the demo. It does not grant reviewer permission.</p>
                <button type="button" className="btn btn-ghost sbx-btn-s" disabled={busy} onClick={signOut}>Sign out of demo control</button>
              </> : (
                <form onSubmit={login} className="sbx-form">
                  <label htmlFor="control-password">Control credential</label>
                  <input id="control-password" className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={busy || !configured} />
                  <button type="submit" className="btn btn-go sbx-btn-s" disabled={busy || !configured}>{busy ? 'Checking…' : 'Sign in to demo control'}</button>
                  {!configured && <p className="meta" role="note">Demo control is not configured on this server.</p>}
                  <p className="meta">Separate from Reviewer Mode: control publishes and resets fixtures; only a reviewer can sign a decision.</p>
                </form>
              )}
            </div>
          </div>
        </div>
      </Band>

      {/* 02 · what Istithbat did with it */}
      <Band id="pipeline" labelledBy="h-pipe">
        <Rail layer="det" id="h-pipe" title="Pipeline">From the source update to a human review, from persisted steps.</Rail>
        <div className="main">
          <HeadRow title="Source update → human review" right={run ? <span className="meta">{run.status === 'RUNNING' ? (paused ? 'Live refresh paused · Check again to reconnect' : 'Processing · live from persisted steps') : run.status === 'FAILED_CLOSED' ? 'Failed closed · held for a person' : 'Pipeline complete'}</span> : undefined} />
          {!state ? <div className="plate"><p className="body" role="status">Reading the current run…</p></div>
            : !run ? (
              <div className="plate sbx-empty"><Mk layer="det" /><div><b>No pipeline for this source version yet</b><p className="body">Publishing v14 sends a signed source update. Istithbat fetches the upstream source and starts its persisted pipeline here.</p></div></div>
            ) : <>
              <div className="plate" style={{ paddingTop: 24, paddingBottom: 24 }}>
                <ol className="flow sbx-flow">
                  {demoStages.map((stage) => {
                    const status = stageStatus(run, stage.steps);
                    return <Step key={stage.name} href={incidentHref ? incidentHref + STAGE_HREF[stage.name] : null}
                      layer={STAGE_LAYER[stage.name]} title={stage.name} sub={stage.description} state={status} now={status === 'Running'} />;
                  })}
                  <Step href={incidentHref ? `${incidentHref}#decision` : null} layer="hum" title="Human decision"
                    sub={run.status === 'RUNNING' ? 'The investigation is still running' : run.status === 'FAILED_CLOSED' ? 'Failed closed · review the recorded failure' : 'AI advises · policy governs · humans decide'}
                    state={run.status === 'RUNNING' ? 'Pending' : run.incidentId ? 'Now' : 'No incident'} now={run.status !== 'RUNNING' && !!run.incidentId} />
                </ol>
              </div>
              <div className="sbx-runfoot">
                <span className="meta">Run <Mono>{run.id.slice(0, 8)}</Mono></span>
                {incidentHref && <Link prefetch={false} className="btn btn-go sbx-btn-s" href={incidentHref}>Open the incident<Icon name="arrow-up-right" size={16} /></Link>}
              </div>
              {run.steps.some((s) => s.errorCode) && <p className="sbx-msg err" role="note"><Icon name="triangle-alert" size={16} />Recorded step errors: {run.steps.filter((s) => s.errorCode).map((s) => `${s.step}: ${s.errorCode}`).join('; ')}. A completed pipeline can still include failed analysis steps; the policy decision remains authoritative.</p>}
              {state.lastCheck?.status === 'FAILED' && <p className="sbx-msg err" role="note"><Icon name="triangle-alert" size={16} />The latest source check failed: {state.lastCheck.errorCode}. Published upstream and latest seen may differ.</p>}
            </>}
        </div>
      </Band>

      {/* 03 · the record exactly as the upstream publishes it */}
      <Band id="source" labelledBy="h-src">
        <Rail layer="src" id="h-src" title="Upstream">What the synthetic provider publishes right now.</Rail>
        <div className="main">
          <HeadRow title="Published source" right={state ? <span className="meta">Last publish or reset · <time dateTime={state.publishedAt}>{dayTime(state.publishedAt)}</time></span> : undefined} />
          {!state ? <div className="plate"><p className="body" role="status">Reading the current source…</p></div> : (
            <div className="sub" style={{ rowGap: 24, alignItems: 'start' }}>
              <div className="c1-6 plate in l sbx-record" style={{ marginLeft: -24, paddingLeft: 24 }}>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}><Chip tone="am" small>Synthetic record</Chip><Mono>{record?.canonical_key}</Mono></span>
                <p className="ar sbx-ar" dir="rtl" lang="ar">{String(record?.content.arabic_text ?? '')}</p>
                <div className="sbx-judg"><span className="cap">Current judgment</span><span className="ar" dir="rtl" lang="ar">{judgment}</span></div>
              </div>
              <div className="c7-10 plate in r" style={{ marginRight: -24, paddingRight: 24 }}>
                <Kv k="Published label"><span title={versionHint(state.payload.upstreamVersionLabel)}><Mono>{versionText(state.payload.upstreamVersionLabel, null, 'label')}</Mono></span></Kv>
                <Kv k="Connector health"><Chip tone={statusTone(state.health)} small>{human(state.health)}</Chip></Kv>
                <Kv k="Latest seen by Istithbat"><Mono>{ver(state.latestSeen)}</Mono></Kv>
                <Kv k="Fixture"><Mono>{state.fixture}</Mono></Kv>
              </div>
            </div>
          )}
          {record && <details><summary>Full upstream record</summary><div className="raw" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(record, null, 2)}</div></details>}
        </div>
      </Band>

      {/* 04 · reset, deliberately last and confirmed */}
      <Band id="reset" labelledBy="h-reset">
        <Rail layer="pol" id="h-reset" title="Reset">Return the demo to its baseline.</Rail>
        <div className="main">
          <div className="plate sbx-reset">
            <div>
              <b>Reset the demo to v13</b>
              <p className="body">Returns upstream to v13, restores trusted and served v13, and clears sandbox candidate incidents, reviews and pipeline state. Existing audit history is retained.</p>
              {!auth && <p className="meta">Requires the demo-control session.</p>}
              {running && <p className="meta">Wait for the active pipeline to finish before resetting.</p>}
            </div>
            {confirmReset ? (
              <div className="sbx-confirm" role="alertdialog" aria-label="Confirm demo reset">
                <p><b>This clears the current sandbox investigation.</b> Reset now?</p>
                <div className="sbx-row">
                  <button type="button" className="btn btn-go sbx-btn-s" disabled={busy || !auth || running} onClick={() => action('reset')}>{busy ? 'Resetting…' : 'Confirm reset to v13'}</button>
                  <button type="button" className="btn btn-ghost sbx-btn-s" disabled={busy} onClick={() => setConfirmReset(false)}>Cancel</button>
                </div>
              </div>
            ) : <button type="button" className="btn btn-ghost sbx-btn-s" disabled={!auth || busy || running} onClick={() => setConfirmReset(true)}>Reset demo to v13</button>}
          </div>
          <p className="meta">Controlled fixtures only. No real upstream religious content is edited.</p>
        </div>
      </Band>
      <div style={{ height: 96 }} />
    </>
  );
}

function ControlHead({ auth }: { auth: boolean }) {
  return (
    <span className="sbx-chead"><b>Demo control</b>{auth ? <Chip tone="tq" small>Session active</Chip> : <span className="chip" style={{ color: 'var(--ink-2)' }}><Icon name="lock" size={14} />Locked</span>}</span>
  );
}

/** One stage on the Overview pipeline track; links into the incident once one exists. */
function Step({ href, layer, title, sub, state, now }: { href: string | null; layer: Layer; title: string; sub: ReactNode; state: string; now?: boolean }) {
  const body = <><span className="fmk"><Mk layer={layer} /></span><b>{title}</b><span>{sub}</span><i>{state}</i></>;
  return <li className={now ? 'now' : undefined} data-status={state}>{href ? <Link prefetch={false} className="fs" href={href}>{body}</Link> : <span className="fs">{body}</span>}</li>;
}
