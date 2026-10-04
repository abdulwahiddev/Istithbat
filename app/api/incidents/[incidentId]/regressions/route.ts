import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSql } from '@/lib/db/client';
import { RegressionDetail } from '@/lib/contracts';

export const runtime='nodejs';
export async function GET(_request:NextRequest,context:{params:Promise<{incidentId:string}>}) {
  const {incidentId}=await context.params;
  if(!z.uuid().safeParse(incidentId).success) return NextResponse.json({error:{code:'NOT_FOUND',message:'Incident not found'}},{status:404});
  const sql=getSql();
  const [incident]=await sql`SELECT id FROM incidents WHERE id=${incidentId}`;
  if(!incident) return NextResponse.json({error:{code:'NOT_FOUND',message:'Incident not found'}},{status:404});
  const rows=await sql`SELECT * FROM regression_runs WHERE incident_id=${incidentId} ORDER BY question_index,protected_app_id,created_at,id`;
  return NextResponse.json({incidentId,regressions:rows.map(row=>RegressionDetail.parse({
    id:row.id,incidentId:row.incident_id,pipelineRunId:row.pipeline_run_id,protectedAppId:row.protected_app_id,
    batchId:row.batch_id,sourceId:row.source_id,canonicalKey:row.canonical_key,identityHash:row.identity_hash,
    status:row.status,questionIndex:row.question_index,question:row.question,origin:row.question_origin,
    oldVersionId:row.old_version_id,newVersionId:row.new_version_id,config:row.config_json,
    modelConfigHash:row.model_config_hash,oldRetrieval:row.old_retrieval_json,newRetrieval:row.new_retrieval_json,
    oldAnswer:row.old_answer,newAnswer:row.new_answer,oldOutput:row.old_output_json,newOutput:row.new_output_json,
    oldMeta:row.old_meta_json,newMeta:row.new_meta_json,comparison:row.comparison_json,
    comparisonMeta:row.comparison_meta_json,result:row.result,materialChange:row.material_change,
    failure:row.failure_json,createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString(),
    completedAt:row.completed_at?.toISOString()??null,
  }))});
}
