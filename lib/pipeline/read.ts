import 'server-only';
import { getSql } from '@/lib/db/client';
import { PipelineRunState } from '@/lib/contracts';
import { nextPendingStep, type StepName } from './model';
import { STEP_HANDLERS } from './steps';

export async function getPipelineRun(runId:string) {
  const sql=getSql();
  const rows=await sql`SELECT * FROM pipeline_runs WHERE id=${runId}`;
  if(!rows.length) return null;
  const run=rows[0];
  const stepRows=await sql`SELECT * FROM pipeline_steps WHERE run_id=${runId}`;
  return mapPipelineRun(run,stepRows);
}

export function mapPipelineRun(run: Record<string,any>, stepRows: Array<Record<string,any>>) {
  const ordered=[...stepRows].sort((a,b)=>{
    const order=['INCIDENT','ANALYSIS','REGRESSION_QUESTIONS','REGRESSION_PAIR','BLAST_RADIUS','POLICY'];
    return order.indexOf(a.step)-order.indexOf(b.step) || a.item_key.localeCompare(b.item_key);
  });
  return PipelineRunState.parse({
    id:run.id,sourceVersionId:run.source_version_id,incidentId:run.incident_id,status:run.status,
    fastPath:run.fast_path,leaseUntil:run.lease_until ? new Date(run.lease_until).toISOString() : null,
    nextStep:run.status==='RUNNING' ? nextPendingStep(ordered.filter(step=>Boolean(STEP_HANDLERS[step.step as StepName])) as unknown as Array<{step:StepName;status:string}>)?.step??null : null,
    steps:ordered.map(row=>({step:row.step,itemKey:row.item_key,status:row.status,attempts:row.attempts,errorCode:row.error_code,
      outputRef:row.output_ref,startedAt:row.started_at ? new Date(row.started_at).toISOString() : null,
      completedAt:row.completed_at ? new Date(row.completed_at).toISOString() : null})),
    createdAt:new Date(run.created_at).toISOString(),updatedAt:new Date(run.updated_at).toISOString(),
  });
}
