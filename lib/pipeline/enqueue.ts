import 'server-only';
import type postgres from 'postgres';
import { stepsForCandidate } from './model';

export async function enqueuePipeline(tx: postgres.TransactionSql, versionId: string, fastPath: boolean): Promise<string> {
  const inserted = await tx`INSERT INTO pipeline_runs (source_version_id,status,fast_path)
    VALUES (${versionId},'RUNNING',${fastPath}) ON CONFLICT (source_version_id) DO NOTHING RETURNING id`;
  const runId = inserted[0]?.id as string | undefined
    ?? (await tx`SELECT id FROM pipeline_runs WHERE source_version_id=${versionId}`)[0].id as string;
  if (inserted.length) {
    for (const step of stepsForCandidate(fastPath)) {
      await tx`INSERT INTO pipeline_steps (run_id,step,item_key,status) VALUES (${runId},${step},'','PENDING')`;
    }
    await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
      VALUES ('PIPELINE_STARTED','pipeline_run',${runId},'system:pipeline',${tx.json({versionId,fastPath})},${`pipeline-started:${runId}`}) ON CONFLICT DO NOTHING`;
  }
  return runId;
}
