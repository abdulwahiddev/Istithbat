'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { PipelineRunState, SandboxConsoleState, type SandboxConsoleState as State } from '@/lib/contracts';
import { demoStages, pipelineFingerprint, stageStatus } from '@/lib/contracts/sandbox-progress';

function signalDemoChange(runId:string|null) {
  // Notify other open Istithbat tabs to re-read; never manufacture a backend state.
  try { localStorage.setItem('istithbat-demo-change',JSON.stringify({at:Date.now(),runId})); } catch { /* Browser storage may be disabled. */ }
  window.dispatchEvent(new Event('istithbat-demo-change'));
}
async function readJson(url:string, init?:RequestInit) {
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(init?.method==='POST'?75_000:20_000),...init});
  const body=await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? 'The request failed. Try again.');
  return body;
}
const label=(v:State['trusted'])=>v ? `${v.label} · r${v.revision}` : 'Not recorded';
export function SandboxConsole() {
  const [state,setState]=useState<State|null>(null);
  const [auth,setAuth]=useState(false);
  const [configured,setConfigured]=useState(true);
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [confirmReset,setConfirmReset]=useState(false);
  const [paused,setPaused]=useState(false);
  const [pollEpoch,setPollEpoch]=useState(0);
  const alive=useRef(true);
  const readState=useCallback(async()=>{
    const result=SandboxConsoleState.parse(await readJson('/api/sandbox/status'));
    if(alive.current) setState(result);
    return result;
  },[]);
  useEffect(()=>{
    alive.current=true;
    void Promise.all([readState(),readJson('/api/demo/control').then(v=>{if(alive.current){setAuth(v.authenticated);setConfigured(v.configured);}})]).catch(e=>{if(alive.current)setError(e.message);});
    return()=>{alive.current=false;};
  },[readState]);
  const runId=state?.pipeline?.id;
  const running=state?.pipeline?.status==='RUNNING';
  useEffect(()=>{
    if (!runId || !running) return;
    let cancelled=false;
    let timer:ReturnType<typeof setTimeout>;
    let previous=pipelineFingerprint(state.pipeline);
    const deadline=Date.now()+10*60_000;
    let failures=0;
    setPaused(false);
    async function poll() {
      if(cancelled) return;
      if(Date.now()>deadline){setPaused(true);return;}
      if(document.visibilityState==='visible') {
        try {
          const run=PipelineRunState.parse(await readJson(`/api/pipeline/${runId}`));
          if(cancelled)return;
          const fingerprint=pipelineFingerprint(run);
          if(fingerprint!==previous || run.status!=='RUNNING') {
            await readState();
            previous=fingerprint;
          }
          failures=0;
          if(run.status!=='RUNNING')return;
        } catch { if(++failures>=5){if(!cancelled){setError('Progress could not be refreshed. The persisted run is unchanged. Check again to reconnect.');setPaused(true);}return;} }
      }
      if(!cancelled)timer=setTimeout(poll,1500);
    }
    timer=setTimeout(poll,1500);
    return()=>{cancelled=true;clearTimeout(timer);};
    // The run identity and terminal state own the polling lifecycle, not every step update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[runId,running,readState,pollEpoch]);
  async function login(e:FormEvent) {
    e.preventDefault();setBusy(true);setError('');
    try {await readJson('/api/demo/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})});setAuth(true);}
    catch(e){setError((e as Error).message);}
    finally{setPassword('');setBusy(false);}
  }
  async function action(kind:'publish'|'reset') {
    setBusy(true);setError('');setNotice('');
    try {
      const result=await readJson(kind==='publish'?'/api/sandbox/publish':'/api/demo/reset',{method:'POST',headers:{'content-type':'application/json'},body:kind==='publish'?JSON.stringify({fixture:'had-4821.v14.json'}):'{}'});
      setNotice(kind==='reset'?'Demo reset to v13. Audit history is retained.':result.status==='NO_CHANGE'?'Already published: the existing observation and pipeline are reused.':'Published upstream. Source update sent to Istithbat.');
      await readState();signalDemoChange(result.runId??null);setPollEpoch(n=>n+1);setConfirmReset(false);
    } catch(e){setError((e as Error).message);await readState().catch(()=>{});}
    finally{setBusy(false);}
  }
  async function refresh() {setError('');try{await readState();setPollEpoch(n=>n+1);setPaused(false);}catch(e){setError((e as Error).message);}}
  const record=state?.payload.records[0];
  const judgment=String(record?.content.judgment??'');
  const primaryPublished=state?.fixture==='had-4821.v14.json';
  const canPublish=state?.fixture==='had-4821.v13.json';
  const run=state?.pipeline;
  return <div className="sandbox-wrap">
    <header className="sandbox-header"><Link prefetch={false} href="/overview" className="sandbox-brand">Istithbat <span>استثبات</span></Link><Link prefetch={false} href="/overview">Open Istithbat</Link></header>
    <section className="sandbox-intro"><span className="sandbox-badge">Controlled synthetic upstream source</span><h1>Hadith Evidence Sandbox</h1><p>Synthetic source used to demonstrate Istithbat’s integrity pipeline.</p><p className="sandbox-small">This is a controlled simulator. Its text, evaluator and references are fictional; it is not a religious authority or real hadith provider.</p></section>
    {error&&<div className="sandbox-alert" role="alert">{error}</div>}
    {notice&&<div className="sandbox-notice" role="status">{notice}</div>}
    <div className="sandbox-grid"><section className="sandbox-sheet">
      <div className="sandbox-section-head"><h2>Published source</h2><button className="sandbox-link" onClick={refresh} disabled={busy}>Check again</button></div>
      {!state?<p role="status">Reading the current source…</p>:<>
        <dl className="sandbox-facts"><div><dt>Published label</dt><dd>{state.payload.upstreamVersionLabel}</dd></div><div><dt>Connector health</dt><dd>{state.health}</dd></div><div><dt>Latest seen by Istithbat</dt><dd>{label(state.latestSeen)}</dd></div><div><dt>Last source publish / reset</dt><dd><time dateTime={state.publishedAt}>{new Date(state.publishedAt).toLocaleString()}</time></dd></div></dl>
        <div className="sandbox-record"><span className="sandbox-badge">Synthetic record · {record?.canonical_key}</span><p className="sandbox-arabic" dir="rtl" lang="ar">{String(record?.content.arabic_text??'')}</p><dl><dt>Current judgment</dt><dd className="sandbox-judgment" dir="rtl" lang="ar">{judgment}</dd></dl><details><summary>Full upstream record</summary><pre>{JSON.stringify(record,null,2)}</pre></details></div>
        <h2>Controlled source change</h2><p>Publish the existing v14 fixture. The evidence wording changes in <code>judgment</code>; the record remains clearly synthetic.</p>
        <div className="sandbox-diff"><div><span>v13 · baseline fixture</span><b dir="rtl" lang="ar">إسناده صحيح</b></div><span aria-hidden="true">→</span><div><span>v14 · candidate</span><b dir="rtl" lang="ar">صحيح</b></div></div>
        <button className="sandbox-primary" onClick={()=>action('publish')} disabled={!auth||busy||!canPublish||running}>{busy?'Working…':primaryPublished?'v14 is already published':'Publish v14'}</button>
        {!canPublish&&<p className="sandbox-small">{primaryPublished?'The published v14 observation is preserved. Use the existing run below.':'This source is beyond the baseline. Confirm a demo reset before starting the primary v13 → v14 scenario.'}</p>}
        {!auth&&<p className="sandbox-small">Sign in to demo control to publish or reset.</p>}
      </>}
    </section><aside className="sandbox-side">
      <section className="sandbox-sheet"><h2>Demo control</h2>{auth?<><p>Control session is active. This does not grant reviewer permission.</p><button className="sandbox-link" disabled={busy} onClick={async()=>{try{await readJson('/api/demo/control',{method:'DELETE'});setAuth(false);}catch(e){setError((e as Error).message);}}}>Sign out of control</button></>:<form onSubmit={login}><label htmlFor="control-password">Control credential</label><input id="control-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required disabled={busy||!configured}/><button className="sandbox-primary" disabled={busy||!configured}>Sign in to demo control</button>{!configured&&<p>Demo control is not configured on this server.</p>}</form>}</section>
      <section className="sandbox-sheet"><h2>Istithbat protection</h2>{state?<><dl className="sandbox-release"><div><dt>Latest seen</dt><dd>{label(state.latestSeen)}<small>{state.latestSeen?.status??'Unknown'}</small></dd></div><div><dt>Trusted</dt><dd>{label(state.trusted)}</dd></div>{state.served.map(g=><div key={g.appId}><dt>Served · {g.appId}</dt><dd>{label(g.version)}<small>{g.gatewayStatus}</small></dd></div>)}</dl><p className="sandbox-small">An upstream publish changes the source. Policy and human review govern what is trusted and served.</p></>:<p>Reading persisted release state…</p>}</section>
      <section className="sandbox-sheet"><h2>Reset the demo</h2><p>Return upstream to v13, restore trusted and served v13, and clear sandbox candidate incidents, reviews and pipeline state. Existing audit history is retained.</p>{confirmReset?<div className="sandbox-confirm"><p><strong>This clears the current sandbox investigation.</strong> Reset now?</p><button disabled={busy||!auth||running} onClick={()=>action('reset')}>Confirm reset to v13</button><button disabled={busy} onClick={()=>setConfirmReset(false)}>Cancel</button></div>:<button className="sandbox-secondary" disabled={!auth||busy||running} onClick={()=>setConfirmReset(true)}>Reset demo to v13</button>}{running&&<p className="sandbox-small">Wait for the active pipeline to finish before resetting.</p>}</section>
    </aside></div>
    <section className="sandbox-sheet sandbox-progress"><div className="sandbox-section-head"><h2>Source update → human review</h2>{run&&<span>{run.status==='RUNNING'?'Processing':run.status==='FAILED_CLOSED'?'Failed closed':'Pipeline complete'}</span>}</div>
      {!run?<p>No pipeline is recorded for this source version. Publishing v14 sends a signed source update; Istithbat fetches the upstream source and starts its persisted pipeline.</p>:<><p className="sandbox-small">Run <code>{run.id}</code>{paused?' · Live refresh paused. Check again to reconnect.':run.status==='RUNNING'?' · Live progress from persisted steps':''}</p><ol className="sandbox-stages">{demoStages.map(stage=>{const status=stageStatus(run,stage.steps);return <li key={stage.name} data-status={status}><span className="sandbox-stage-dot"/><div><b>{stage.name}</b><p>{stage.description}</p></div><span>{status}</span></li>;})}<li data-status={run.status==='RUNNING'?'Pending':'Ready'}><span className="sandbox-stage-dot"/><div><b>Human decision</b><p>{run.status==='RUNNING'?'The investigation is still running.':run.status==='FAILED_CLOSED'?'Pipeline failed closed. Review the recorded failure.':'AI advises. Policy governs. Humans decide.'}</p></div><span>{run.status==='RUNNING'?'Pending':run.incidentId?'Incident available':'No incident'}</span></li></ol>
      {run.steps.some(s=>s.errorCode)&&<p className="sandbox-alert">Recorded step errors: {run.steps.filter(s=>s.errorCode).map(s=>`${s.step}: ${s.errorCode}`).join('; ')}. A completed pipeline can still include failed analysis steps; the policy decision remains authoritative.</p>}
      {run.incidentId&&<Link prefetch={false} className="sandbox-primary sandbox-incident-link" href={`/incidents/${run.incidentId}`}>Open incident in Istithbat</Link>}
      {state.lastCheck?.status==='FAILED'&&<p className="sandbox-alert">The latest source check failed: {state.lastCheck.errorCode}. Published upstream and latest seen may differ.</p>}
      </>}
    </section><footer className="sandbox-footer">Controlled fixtures only. No real upstream religious content is edited.</footer>
  </div>;
}
