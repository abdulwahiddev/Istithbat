import 'server-only';
import { getSql } from '@/lib/db/client';
import { PipelineRunState } from '@/lib/contracts';
import { nextPendingStep, type StepName } from './model';

export async function getPipelineRun(runId:string) {
  const sql=getSql();
  const rows=await sql`SELECT * FROM pipeline_runs WHERE id=${runId}`;
  if(!rows.length) return null;
  const run=rows[0];
  const stepRows=await sql`SELECT * FROM pipeline_steps WHERE run_id=${runId}`;
  const ordered=[...stepRows].sort((a,b)=>{
    const order=['INCIDENT','ANALYSIS','REGRESSION_QUESTIONS','REGRESSION_PAIR','BLAST_RADIUS','POLICY'];
    return order.indexOf(a.step)-order.indexOf(b.step) || a.item_key.localeCompare(b.item_key);
  });
  return PipelineRunState.parse({
    id:run.id,sourceVersionId:run.source_version_id,incidentId:run.incident_id,status:run.status,
    fastPath:run.fast_path,leaseUntil:run.lease_until?.toISOString()??null,
    nextStep:nextPendingStep(ordered as unknown as Array<{step:StepName;status:string}>)?.step??null,
    steps:ordered.map(row=>({step:row.step,itemKey:row.item_key,status:row.status,attempts:row.attempts,errorCode:row.error_code,
      outputRef:row.output_ref,startedAt:row.started_at?.toISOString()??null,completedAt:row.completed_at?.toISOString()??null})),
    createdAt:run.created_at.toISOString(),updatedAt:run.updated_at.toISOString(),
  });
}
