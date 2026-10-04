import 'server-only';
import { randomUUID } from 'node:crypto';
import { getSql } from '@/lib/db/client';
import type { JsonValue } from '@/lib/hashing/canonicalize';
import { failureDisposition, isValidExpectedStep, nextPendingStep, type StepName } from './model';
import { PipelineStepError } from './handlers';
import { STEP_HANDLERS } from './steps';

export class InvalidPipelineTransition extends Error { constructor() { super('INVALID_PIPELINE_TRANSITION'); } }

export type AdvanceResult = {
  runId:string;
  status:'BUSY'|'WAITING'|'RETRYABLE_FAILURE'|'COMPLETE';
  nextStep:StepName|null;
  completedSteps:number;
  incidentId:string|null;
};

function errorCode(error:unknown, step:StepName):string {
  if (error instanceof PipelineStepError) return error.code;
  if (error instanceof Error && error.message==='DIFF_FAILED') return 'DIFF_FAILED';
  if (step==='REGRESSION_QUESTIONS'||step==='REGRESSION_PAIR') return 'REGRESSION_FAILED';
  return step==='ANALYSIS'?'AI_ANALYSIS_FAILED':'DIFF_FAILED';
}

export async function advancePipeline(runId:string, budgetMs=20_000, expectedStep?:StepName):Promise<AdvanceResult|null> {
  const sql=getSql();
  const owner=randomUUID();
  const claimed=await sql`UPDATE pipeline_runs SET lease_owner=${owner},lease_until=now()+interval '90 seconds',updated_at=now()
    WHERE id=${runId} AND status='RUNNING' AND (lease_until IS NULL OR lease_until<now()) RETURNING id`;
  if (!claimed.length) {
    const rows=await sql`SELECT id,status,incident_id FROM pipeline_runs WHERE id=${runId}`;
    if (!rows.length) return null;
    return {runId,status:rows[0].status==='RUNNING'?'BUSY':'COMPLETE',nextStep:null,completedSteps:0,incidentId:rows[0].incident_id};
  }
  const deadline=Date.now()+budgetMs;
  let completedSteps=0;
  try {
    while (Date.now()<deadline) {
      const runs=await sql`SELECT source_version_id,incident_id FROM pipeline_runs WHERE id=${runId} AND lease_owner=${owner}`;
      if (!runs.length) return {runId,status:'BUSY',nextStep:null,completedSteps,incidentId:null};
      const run=runs[0];
      const steps=await sql`SELECT id,step,status,attempts FROM pipeline_steps WHERE run_id=${runId}`;
      const next=nextPendingStep(steps as unknown as Array<{id:string;step:StepName;status:string;attempts:number}>);
      if (!next) {
        await sql`UPDATE pipeline_runs SET status='COMPLETE',updated_at=now() WHERE id=${runId} AND lease_owner=${owner}`;
        return {runId,status:'COMPLETE',nextStep:null,completedSteps,incidentId:run.incident_id};
      }
      if (completedSteps===0 && !isValidExpectedStep(next.step,expectedStep)) throw new InvalidPipelineTransition();
      const handler=STEP_HANDLERS[next.step];
      if (!handler) return {runId,status:'WAITING',nextStep:next.step,completedSteps,incidentId:run.incident_id};
      if (next.attempts>=2) {
        const code=next.step==='ANALYSIS'?'AI_ANALYSIS_FAILED':next.step.startsWith('REGRESSION')?'REGRESSION_FAILED':'DIFF_FAILED';
        await sql.begin(async tx=>{
          const failed=await tx`UPDATE pipeline_steps SET status='FAILED',error_code=${code},completed_at=now()
            WHERE id=${next.id} AND status IN ('PENDING','RUNNING') RETURNING id`;
          if(failed.length) await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
            VALUES ('PIPELINE_STEP_FAILED','pipeline_step',${next.id},'system:pipeline',${tx.json({runId,step:next.step,attempt:next.attempts,errorCode:code,retryable:false,reason:'LEASE_EXPIRED'})},${`pipeline-failed:${next.id}:${next.attempts}`}) ON CONFLICT DO NOTHING`;
        });
        continue;
      }
      const started=await sql.begin(async tx=>{
        const rows=await tx`UPDATE pipeline_steps SET status='RUNNING',attempts=attempts+1,started_at=now(),error_code=NULL
          WHERE id=${next.id} AND status IN ('PENDING','RUNNING') AND attempts<2
            AND EXISTS (SELECT 1 FROM pipeline_runs WHERE id=${runId} AND lease_owner=${owner}) RETURNING attempts`;
        if(rows.length) {
          const attempt=rows[0].attempts as number;
          await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
            VALUES (${attempt===1?'PIPELINE_STEP_STARTED':'PIPELINE_RETRIED'},'pipeline_step',${next.id},'system:pipeline',${tx.json({runId,step:next.step,attempt})},${`pipeline-attempt:${next.id}:${attempt}`}) ON CONFLICT DO NOTHING`;
        }
        return rows[0]?.attempts as number|undefined;
      });
      if (!started) continue;
      try {
        const outputRef=await handler({runId,versionId:run.source_version_id,incidentId:run.incident_id});
        const completed=await sql.begin(async tx=>{
          const updated=await tx`UPDATE pipeline_steps SET status='DONE',error_code=NULL,output_ref=${outputRef},completed_at=now()
            WHERE id=${next.id} AND status='RUNNING' AND attempts=${started}
              AND EXISTS (SELECT 1 FROM pipeline_runs WHERE id=${runId} AND lease_owner=${owner}) RETURNING id`;
          if(updated.length) await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
            VALUES ('PIPELINE_STEP_COMPLETED','pipeline_step',${next.id},'system:pipeline',${tx.json({runId,step:next.step,attempt:started,outputRef})},${`pipeline-done:${next.id}`}) ON CONFLICT DO NOTHING`;
          return updated.length>0;
        });
        if(!completed) return {runId,status:'BUSY',nextStep:next.step,completedSteps,incidentId:run.incident_id};
        completedSteps++;
      } catch (error) {
        const code=errorCode(error,next.step);
        const failed=failureDisposition(started)==='FAILED';
        const meta=error instanceof PipelineStepError?error.meta:null;
        const recorded=await sql.begin(async tx=>{
          const updated=await tx`UPDATE pipeline_steps SET status=${failed?'FAILED':'PENDING'},error_code=${code},completed_at=${failed?new Date():null}
            WHERE id=${next.id} AND status='RUNNING' AND attempts=${started}
              AND EXISTS (SELECT 1 FROM pipeline_runs WHERE id=${runId} AND lease_owner=${owner}) RETURNING id`;
          if(updated.length) await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
            VALUES ('PIPELINE_STEP_FAILED','pipeline_step',${next.id},'system:pipeline',${tx.json({runId,step:next.step,attempt:started,errorCode:code,retryable:!failed,meta:meta as JsonValue|null})},${`pipeline-failed:${next.id}:${started}`}) ON CONFLICT DO NOTHING`;
          return updated.length>0;
        });
        if(!recorded) return {runId,status:'BUSY',nextStep:next.step,completedSteps,incidentId:run.incident_id};
        if (!failed) return {runId,status:'RETRYABLE_FAILURE',nextStep:next.step,completedSteps,incidentId:run.incident_id};
      }
    }
    const rows=await sql`SELECT incident_id FROM pipeline_runs WHERE id=${runId}`;
    const steps=await sql`SELECT step,status FROM pipeline_steps WHERE run_id=${runId}`;
    return {runId,status:'WAITING',nextStep:nextPendingStep(steps as unknown as Array<{step:StepName;status:string}>)?.step??null,completedSteps,incidentId:rows[0]?.incident_id??null};
  } finally {
    await sql`UPDATE pipeline_runs SET lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE id=${runId} AND lease_owner=${owner}`;
  }
}
