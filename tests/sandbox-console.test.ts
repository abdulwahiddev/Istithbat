import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';

const mocks=vi.hoisted(()=>({query:vi.fn(),check:vi.fn(),advance:vi.fn(),callbacks:[] as Array<()=>Promise<unknown>>}));
vi.mock('@/lib/db/client',()=>({getSql:()=>mocks.query}));
vi.mock('@/lib/ingestion/check-source',()=>({checkSource:mocks.check}));
vi.mock('@/lib/pipeline/runner',()=>({advancePipeline:mocks.advance,InvalidPipelineTransition:class extends Error{}}));
vi.mock('next/server',async importOriginal=>({...await importOriginal<typeof import('next/server')>(),after:(callback:()=>Promise<unknown>)=>mocks.callbacks.push(callback)}));
import { GET as current } from '@/app/api/sandbox/current/route';
import { GET as status } from '@/app/api/sandbox/status/route';
import { GET as controlGet, POST as login, DELETE as logout } from '@/app/api/demo/control/route';
import { POST as publish } from '@/app/api/sandbox/publish/route';
import { POST as reset } from '@/app/api/demo/reset/route';
import { POST as checkRealSource } from '@/app/api/sources/[sourceId]/check/route';
import { POST as verifyEvidence } from '@/app/api/sources/[sourceId]/versions/[versionId]/verify/route';
import { POST as reviewPost } from '@/app/api/incidents/[incidentId]/review/route';
import { POST as webhook } from '@/app/api/webhooks/source-update/route';
import { GET as pipelineGet, POST as pipelinePost } from '@/app/api/pipeline/[runId]/route';
import { makeModeCookie, requireControl, requireReview, requireSandbox } from '@/lib/server/demo-auth';
import { getSandboxConsoleState, mapSandboxState } from '@/lib/server/sandbox-read';
import { schedulePipeline } from '@/lib/pipeline/continue';
import { SandboxConsoleState, PipelineRunState } from '@/lib/contracts';
import { pipelineFingerprint, stageStatus } from '@/lib/contracts/sandbox-progress';

const runId='00000000-0000-4000-8000-000000000001';
const incidentId='00000000-0000-4000-8000-000000000002';
const stamp='2026-10-06T00:00:00.000Z';
const version=(id:string,label:string,status:string)=>({id,upstream_version_label:label,revision_number:1,status});
function row(running=false){return {fixture_name:'had-4821.v14.json',updated_at:stamp,connector_health:'HEALTHY',seen:version('candidate','v14','QUARANTINED'),trusted:version('baseline','v13','TRUSTED'),served:[{protected_app_id:'islamic-qa-demo',gateway_status:'SERVING_TRUSTED',version:version('baseline','v13','TRUSTED')}],run:{id:runId,source_version_id:'candidate',incident_id:incidentId,status:running?'RUNNING':'COMPLETE',fast_path:false,lease_until:null,created_at:stamp,updated_at:stamp},steps:['INCIDENT','ANALYSIS','REGRESSION_QUESTIONS','REGRESSION_PAIR','REGRESSION_PAIR','REGRESSION_PAIR','BLAST_RADIUS','POLICY'].map((step,index)=>({step,item_key:step==='REGRESSION_PAIR'?String(index):'',status:running&&step==='POLICY'?'PENDING':'DONE',attempts:1,error_code:null,output_ref:null,started_at:stamp,completed_at:stamp})),check:{status:'NEW_VERSION',error_code:null,checked_at:stamp}};}
function req(path:string,body:unknown={},cookie?:string,headers:Record<string,string>={}){return new NextRequest(`https://example.test${path}`,{method:'POST',headers:{'content-type':'application/json',origin:'https://example.test',...(cookie?{cookie:`istithbat_sandbox=${cookie}`} : {}),...headers},body:JSON.stringify(body)});}
const oldEnv={...process.env};
beforeEach(()=>{vi.clearAllMocks();mocks.callbacks.length=0;process.env.DEMO_CONTROL_SECRET='test-control-only';process.env.DEMO_SANDBOX_SECRET='test-sandbox-only';process.env.DEMO_REVIEW_SECRET='test-review-only';process.env.DEMO_REVIEW_USERNAME='test-reviewer';process.env.DEMO_WEBHOOK_SECRET='test-webhook-only';});
afterEach(()=>{vi.unstubAllGlobals();for(const key of ['DEMO_CONTROL_SECRET','DEMO_SANDBOX_SECRET','DEMO_REVIEW_SECRET','DEMO_REVIEW_USERNAME','DEMO_WEBHOOK_SECRET']){if(oldEnv[key]===undefined)delete process.env[key];else process.env[key]=oldEnv[key];}});

describe('sandbox persisted read reconstruction',()=>{
 it('preserves exact upstream fixture bytes without adding console metadata',async()=>{
  mocks.query.mockResolvedValueOnce([{fixture_name:'had-4821.v13.json'}]);
  expect(await (await current()).text()).toBe(readFileSync('demo/synthetic-fixtures/had-4821.v13.json','utf8'));
 });
 it('reconstructs a held completed pipeline with three matched questions and v13 still served',async()=>{
  mocks.query.mockResolvedValue([row()]);
  const response=await status(new NextRequest('https://example.test/api/sandbox/status'));expect(response.status).toBe(200);
  const state=SandboxConsoleState.parse(await response.json());
  expect(state.latestSeen).toMatchObject({label:'v14',status:'QUARANTINED'});
  expect(state.trusted?.label).toBe('v13');expect(state.served[0].version?.label).toBe('v13');
  expect(state.pipeline?.incidentId).toBe(incidentId);
  expect(state.pipeline?.steps.filter(s=>s.step==='REGRESSION_PAIR')).toHaveLength(3);
  const afterRefresh=await getSandboxConsoleState();expect(pipelineFingerprint(afterRefresh!.pipeline)).toBe(pipelineFingerprint(state.pipeline));
  expect(mocks.query).toHaveBeenCalledTimes(2); // one statement per read
 });
 it('supports baseline/no active run and a reset followed by a new running candidate',()=>{
  const baseline={...row(),fixture_name:'had-4821.v13.json',seen:version('baseline','v13','TRUSTED'),run:null,steps:[],check:null};
  expect(mapSandboxState(baseline).pipeline).toBeNull();
  const resumed=mapSandboxState(row(true));expect(resumed.pipeline?.nextStep).toBe('POLICY');
 });
 it('preserves unknown versions and failed-closed step evidence rather than inventing success',()=>{
  const data=row();data.run.status='FAILED_CLOSED';data.steps[1].status='FAILED';data.steps[1].error_code='AI_ANALYSIS_FAILED' as never;
  const state=mapSandboxState({...data,trusted:null,served:[]});
  expect(state.trusted).toBeNull();expect(state.served).toEqual([]);
  expect(stageStatus(state.pipeline!,['ANALYSIS'])).toBe('Failed');
  expect(state.pipeline?.status).toBe('FAILED_CLOSED');
 });
 it('reports a missing seed without emitting fabricated source or pipeline state',async()=>{
  mocks.query.mockResolvedValue([]);expect((await current()).status).toBe(503);expect((await status(new NextRequest('https://example.test/api/sandbox/status'))).status).toBe(503);
 });
 it('reschedules only the current stale unleased sandbox run and preserves persisted steps',async()=>{
  const request=new NextRequest('https://example.test/api/sandbox/status');
  const stale=row(true);
  mocks.query.mockResolvedValueOnce([stale]).mockResolvedValueOnce([{id:runId}]);
  expect((await status(request)).status).toBe(200);
  expect(mocks.callbacks).toHaveLength(1);
  mocks.query.mockResolvedValueOnce([stale]).mockResolvedValueOnce([]);
  expect((await status(request)).status).toBe(200);
  expect(mocks.callbacks).toHaveLength(1);
  expect(mocks.advance).not.toHaveBeenCalled();
  const leased=row(true);leased.run.lease_until=new Date(Date.now()+60_000).toISOString() as never;
  mocks.query.mockResolvedValueOnce([leased]);
  expect((await status(request)).status).toBe(200);
  expect(mocks.callbacks).toHaveLength(1);
  const fresh=row(true);fresh.run.updated_at=new Date().toISOString();
  mocks.query.mockResolvedValueOnce([fresh]);
  expect((await status(request)).status).toBe(200);
  expect(mocks.callbacks).toHaveLength(1);
 });
 it('recovers a stale run from pipeline polling only when it is the current sandbox run',async()=>{
  const stale=row(true);
  mocks.query.mockResolvedValueOnce([stale.run]).mockResolvedValueOnce(stale.steps).mockResolvedValueOnce([stale]).mockResolvedValueOnce([{id:runId}]);
  const response=await pipelineGet(new NextRequest(`https://example.test/api/pipeline/${runId}`),{params:Promise.resolve({runId})});
  expect(response.status).toBe(200);
  expect(PipelineRunState.parse(await response.json()).nextStep).toBe('POLICY');
  expect(mocks.callbacks).toHaveLength(1);
  mocks.query.mockResolvedValueOnce([stale.run]).mockResolvedValueOnce(stale.steps).mockResolvedValueOnce([]);
  expect((await pipelineGet(new NextRequest(`https://example.test/api/pipeline/${runId}`),{params:Promise.resolve({runId})})).status).toBe(200);
  expect(mocks.callbacks).toHaveLength(1);
 });
});

describe('separate sandbox session and protected mutations',()=>{
 it('rejects unauthenticated controls, wrong password and cross-origin login; accepts signed HttpOnly sandbox session',async()=>{
  expect((await publish(req('/api/sandbox/publish',{fixture:'had-4821.v14.json'}))).status).toBe(401);
  expect((await reset(req('/api/demo/reset'))).status).toBe(401);
  expect((await login(req('/api/demo/control',{password:'wrong'}))).status).toBe(401);
  expect((await login(req('/api/demo/control',{password:'test-sandbox-only'},undefined,{origin:'https://other.test'}))).status).toBe(403);
  const response=await login(req('/api/demo/control',{password:'test-sandbox-only'}));
  const cookie=response.cookies.get('istithbat_sandbox')!;
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');expect(response.headers.get('set-cookie')).toContain('Secure');
  expect(requireSandbox(req('/',{},cookie.value))).toBe(true);expect(requireControl(req('/',{},cookie.value))).toBe(false);expect(requireReview(req('/',{},cookie.value))).toBe(false);
  expect((await controlGet(req('/',{},cookie.value))).status).toBe(200);
  expect((await logout(req('/api/demo/control'))).headers.get('set-cookie')).toContain('istithbat_sandbox=;');
  expect(mocks.query).not.toHaveBeenCalled();
 });
 it('rejects reviewer credentials, tampered cookies and missing control configuration',async()=>{
  expect((await login(req('/api/demo/control',{password:'test-review-only'}))).status).toBe(401);
  expect((await login(req('/api/demo/control',{password:'test-control-only'}))).status).toBe(401);
  expect(requireSandbox(req('/',{},makeModeCookie('sandbox').value+'x'))).toBe(false);
  delete process.env.DEMO_SANDBOX_SECRET;
  expect(requireSandbox(req('/',{},'sandbox.invalid.invalid'))).toBe(false);
  expect((await login(req('/api/demo/control',{password:'x'}))).status).toBe(503);
 });
 it('never grants public sandbox access to real-source checks, pipeline mutation, verification or human review',async()=>{
  const cookie=makeModeCookie('sandbox').value;
  const request=(path:string)=>req(path,{},cookie);
  expect((await checkRealSource(request('/api/sources/hadeethenc/check'),{params:Promise.resolve({sourceId:'hadeethenc'})})).status).toBe(401);
  expect((await verifyEvidence(request('/api/sources/hadeethenc/versions/v13/verify'),{params:Promise.resolve({sourceId:'hadeethenc',versionId:'v13'})})).status).toBe(401);
  expect((await pipelinePost(request(`/api/pipeline/${runId}`),{params:Promise.resolve({runId})})).status).toBe(401);
  expect((await reviewPost(request(`/api/incidents/${incidentId}/review`),{params:Promise.resolve({incidentId})})).status).toBe(401);
  expect(mocks.query).not.toHaveBeenCalled();
 });
 it('does not let the private control cookie unlock sandbox-only actions',async()=>{
  const privateCookie=makeModeCookie('control');
  const request=new NextRequest('https://example.test/api/demo/reset',{method:'POST',headers:{cookie:`${privateCookie.name}=${privateCookie.value}`,'content-type':'application/json'},body:'{}'});
  expect((await reset(request)).status).toBe(401);
  expect((await publish(request)).status).toBe(401);
 });
 it('publishes only an existing fixture and delivers a verifiable signed webhook with the actual run ID',async()=>{
  const cookie=makeModeCookie('sandbox').value;
  expect((await publish(req('/api/sandbox/publish',{fixture:'arbitrary.json'},cookie))).status).toBe(400);
  mocks.query.mockResolvedValue([{source_id:'hadith-evidence-sandbox'}]);
  mocks.check.mockResolvedValue({status:'NEW_VERSION',runId,versionId:'candidate'});
  vi.stubGlobal('fetch',vi.fn(async(url:URL,init:RequestInit)=>webhook(new NextRequest(url,{...init,signal:init.signal??undefined}))));
  const response=await publish(req('/api/sandbox/publish',{fixture:'had-4821.v14.json'},cookie));
  expect(response.status).toBe(202);expect(await response.json()).toMatchObject({published:true,webhookSent:true,runId});
  expect(mocks.check).toHaveBeenCalledWith('hadith-evidence-sandbox','WEBHOOK','https://example.test/api/webhooks/source-update');
  expect(mocks.callbacks).toHaveLength(1);
  expect(mocks.advance).not.toHaveBeenCalled(); // post-response work, not a second browser stage call
 });
 it('reuses the actual existing run for duplicate publish, and reports upstream delivery failure honestly',async()=>{
  const cookie=makeModeCookie('sandbox').value;
  mocks.query.mockResolvedValue([{source_id:'hadith-evidence-sandbox'}]);
  mocks.check.mockResolvedValue({status:'NO_CHANGE',runId,versionId:'candidate'});
  vi.stubGlobal('fetch',vi.fn(async(url:URL,init:RequestInit)=>webhook(new NextRequest(url,{...init,signal:init.signal??undefined}))));
  const repeated=await publish(req('/api/sandbox/publish',{fixture:'had-4821.v14.json'},cookie));
  expect(await repeated.json()).toMatchObject({status:'NO_CHANGE',runId});
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('network')));
  const failed=await publish(req('/api/sandbox/publish',{fixture:'had-4821.v14.json'},cookie));
  expect(failed.status).toBe(502);expect(await failed.json()).toMatchObject({published:true,webhookSent:false});
 });
 it('uses the existing transactional reset semantics and retains the audit trail',async()=>{
  const query=vi.fn(async(parts:TemplateStringsArray)=>{
    const statement=parts.join('?');
    if(statement.includes('SELECT v.id FROM source_versions')) return [{id:'baseline'}];
    if(statement.includes('SELECT id FROM source_versions WHERE source_id=')) return [{id:'baseline'}];
    if(statement.includes("r.status='RUNNING'")) return [{id:runId}];
    if(statement.includes('UPDATE sandbox_state')) return [{updated_at:stamp}];
    return [];
  });
  Object.assign(query,{json:(v:unknown)=>v});
  Object.assign(mocks.query,{begin:async(callback:(tx:unknown)=>Promise<void>)=>callback(query)});
  mocks.query.mockResolvedValueOnce([{fixture_name:'had-4821.v14.json'}]);
  const response=await reset(req('/api/demo/reset',{},makeModeCookie('sandbox').value));
  expect(await response.json()).toEqual({reset:true,trustedLabel:'v13'});
  const statements=query.mock.calls.map(([parts])=>parts.join('?')).join('\n');
  expect(statements).toContain('DELETE FROM pipeline_runs');expect(statements).toContain('UPDATE gateway_bindings SET served_version_id=');
  expect(statements).toContain('INSERT INTO audit_events');expect(statements).not.toContain('DELETE FROM audit_events');
  expect(statements).toContain('FOR UPDATE OF r');expect(statements).toContain('DEMO_RUN_CANCELLED');
  expect(statements).toContain('clock_timestamp()');
 });
});

describe('automatic server-side continuation',()=>{
 it('continues WAITING with one authenticated request, acknowledges quickly and schedules the same runner',async()=>{
  mocks.advance.mockResolvedValue({status:'WAITING',runId});
  const data=row(true);mocks.query.mockResolvedValueOnce([data.run]).mockResolvedValueOnce(data.steps);
  vi.stubGlobal('fetch',vi.fn(async(url:URL,init:RequestInit)=>pipelinePost(new NextRequest(url,{...init,signal:init.signal??undefined}),{params:Promise.resolve({runId})})));
  schedulePipeline(runId,'https://example.test/api/webhooks/source-update');
  await mocks.callbacks.shift()!();
  expect(mocks.advance).toHaveBeenCalledTimes(1);expect(mocks.callbacks).toHaveLength(1);
  const call=vi.mocked(fetch).mock.calls[0];
  expect(JSON.parse(call[1]!.body as string)).toEqual({continuationRemaining:31});
 });
 it('continues a retryable attempt but stops on complete, failed-closed, or another live lease',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response('{}',{status:202}));vi.stubGlobal('fetch',fetcher);
  for(const status of ['COMPLETE','FAILED_CLOSED','BUSY']){mocks.advance.mockResolvedValue({status});schedulePipeline(runId,'https://example.test');await mocks.callbacks.shift()!();}
  expect(fetcher).not.toHaveBeenCalled();
  mocks.advance.mockResolvedValue({status:'RETRYABLE_FAILURE'});schedulePipeline(runId,'https://example.test');await mocks.callbacks.shift()!();expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('bounds continuation, rejects unsigned webhooks and validates persisted pipeline read output',async()=>{
  const consoleError=vi.spyOn(console,'error').mockImplementation(()=>{});
  mocks.advance.mockResolvedValue({status:'WAITING'});const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  schedulePipeline(runId,'https://example.test',0);await mocks.callbacks.shift()!();expect(fetcher).not.toHaveBeenCalled();consoleError.mockRestore();
  expect((await webhook(req('/api/webhooks/source-update',{sourceId:'hadith-evidence-sandbox'}))).status).toBe(401);
  const data=row();mocks.query.mockResolvedValueOnce([data.run]).mockResolvedValueOnce(data.steps);
  const response=await pipelineGet(new NextRequest('https://example.test/api/pipeline/'+runId),{params:Promise.resolve({runId})});
  expect(PipelineRunState.parse(await response.json()).status).toBe('COMPLETE');
  expect((await pipelineGet(new NextRequest('https://example.test'),{params:Promise.resolve({runId:'invalid'})})).status).toBe(404);
 });
});
