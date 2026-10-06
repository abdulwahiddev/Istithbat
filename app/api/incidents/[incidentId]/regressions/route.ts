import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSql } from '@/lib/db/client';
import { RegressionDetailResponse } from '@/lib/contracts';

export const runtime='nodejs';
export async function GET(_request:NextRequest,context:{params:Promise<{incidentId:string}>}) {
  const {incidentId}=await context.params;
  if(!z.uuid().safeParse(incidentId).success) return NextResponse.json({error:{code:'NOT_FOUND',message:'Incident not found'}},{status:404});
  const sql=getSql();
  const [incident]=await sql`SELECT id FROM incidents WHERE id=${incidentId}`;
  if(!incident) return NextResponse.json({error:{code:'NOT_FOUND',message:'Incident not found'}},{status:404});
  const rows=await sql`SELECT r.*,
    oldv.upstream_version_label AS old_label,oldv.revision_number AS old_revision,
    newv.upstream_version_label AS new_label,newv.revision_number AS new_revision
    FROM regression_runs r
    JOIN source_versions oldv ON oldv.id=r.old_version_id
    JOIN source_versions newv ON newv.id=r.new_version_id
    WHERE r.incident_id=${incidentId}
    ORDER BY r.question_index,r.protected_app_id,r.created_at,r.id`;
  return NextResponse.json(RegressionDetailResponse.parse({incidentId,regressions:rows.map(row=>({
    id:row.id,incidentId:row.incident_id,pipelineRunId:row.pipeline_run_id,protectedAppId:row.protected_app_id,
    batchId:row.batch_id,sourceId:row.source_id,canonicalKey:row.canonical_key,identityHash:row.identity_hash,
    status:row.status,questionIndex:row.question_index,question:row.question,origin:row.question_origin,
    oldVersionId:row.old_version_id,newVersionId:row.new_version_id,
    oldVersion:{id:row.old_version_id,label:row.old_label,revisionNumber:row.old_revision},
    newVersion:{id:row.new_version_id,label:row.new_label,revisionNumber:row.new_revision},config:row.config_json,
    modelConfigHash:row.model_config_hash,oldRetrieval:row.old_retrieval_json,newRetrieval:row.new_retrieval_json,
    oldAnswer:row.old_answer,newAnswer:row.new_answer,oldOutput:row.old_output_json,newOutput:row.new_output_json,
    oldMeta:row.old_meta_json,newMeta:row.new_meta_json,comparison:row.comparison_json,
    comparisonMeta:row.comparison_meta_json,result:row.result,materialChange:row.material_change,
    failure:row.failure_json,createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString(),
    completedAt:row.completed_at?.toISOString()??null,
  }))}));
}
