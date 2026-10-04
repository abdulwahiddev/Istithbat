import 'server-only';
import { getSql } from '@/lib/db/client';
import { getSourceDetail } from '@/lib/server/source-read';
import { IncidentAggregate, IncidentListItem } from '@/lib/contracts';
import { getPipelineRun } from '@/lib/pipeline/read';
import { nextPendingStep, type StepName } from '@/lib/pipeline/model';
import { STEP_HANDLERS } from '@/lib/pipeline/steps';
import { readBlastRadius } from '@/lib/blast-radius/service';

export async function listIncidents() {
  const sql=getSql();
  const rows=await sql`SELECT i.*,v.silent_mutation,v.upstream_version_label AS candidate_label,
    v.revision_number AS candidate_revision,v.raw_sha256 AS candidate_raw_sha256,
    p.upstream_version_label AS previous_label,p.revision_number AS previous_revision,
    c.canonical_key AS primary_key,c.field_path AS primary_field_path,c.field_role AS primary_field_role,
    (SELECT count(*)::int FROM changes ch WHERE ch.to_version_id=i.candidate_version_id) AS change_count,
    (SELECT count(*)::int FROM review_decisions d WHERE d.incident_id=i.id) AS review_count,
    r.id AS run_id,r.status AS pipeline_status,a.meta_json AS analysis_meta
    FROM incidents i JOIN source_versions v ON v.id=i.candidate_version_id
    LEFT JOIN source_versions p ON p.id=i.previous_version_id
    LEFT JOIN changes c ON c.id=i.primary_change_id
    LEFT JOIN pipeline_runs r ON r.source_version_id=i.candidate_version_id
    LEFT JOIN LATERAL (SELECT meta_json FROM analyses WHERE incident_id=i.id ORDER BY created_at DESC LIMIT 1) a ON true
    ORDER BY i.opened_at DESC,i.id DESC`;
  const runIds=rows.map(row=>row.run_id as string).filter(Boolean);
  const steps: Array<Record<string,any>>=runIds.length?await sql`SELECT run_id,step,item_key,status,attempts,error_code,output_ref,started_at,completed_at
    FROM pipeline_steps WHERE run_id=ANY(${sql.array(runIds)}::uuid[]) ORDER BY run_id,step,item_key`:[];
  const stepsByRun=new Map<string,Array<Record<string,any>>>();
  for(const step of steps) {
    const current=stepsByRun.get(step.run_id)??[];
    current.push(step);
    stepsByRun.set(step.run_id,current);
  }
  return rows.map(row=>{
    const runSteps=stepsByRun.get(row.run_id)??[];
    const nextStep=row.pipeline_status==='RUNNING'
      ? nextPendingStep(runSteps.filter(step=>Boolean(STEP_HANDLERS[step.step as StepName])) as Array<{step:StepName;status:string;item_key:string}>)?.step??null
      : null;
    return IncidentListItem.parse({
    id:row.id,sourceId:row.source_id,candidateVersionId:row.candidate_version_id,status:row.status,
    riskLevel:row.risk_level,title:row.title,summary:row.summary,openedAt:row.opened_at.toISOString(),
    pipelineStatus:row.pipeline_status??null,nextStep,
    silentMutation:row.silent_mutation,analysisMode:row.analysis_meta?.mode??null,
    candidateLabel:row.candidate_label,candidateRevision:row.candidate_revision,
    previousLabel:row.previous_label??null,previousRevision:row.previous_revision??null,
    primaryChange:row.primary_key?{canonicalKey:row.primary_key,fieldPath:row.primary_field_path,fieldRole:row.primary_field_role}:null,
    changeCount:row.change_count,hasCandidateSnapshot:Boolean(row.candidate_raw_sha256),reviewCount:row.review_count,
    analysisRecordedAt:row.analysis_meta?.recordedAt??null,
    pipelineSteps:runSteps.map(step=>({step:step.step,itemKey:step.item_key,status:step.status,attempts:step.attempts,
      errorCode:step.error_code,outputRef:step.output_ref,startedAt:step.started_at?.toISOString()??null,
      completedAt:step.completed_at?.toISOString()??null})),
  });});
}

export async function getIncidentDetail(incidentId:string) {
  const sql=getSql();
  const rows=await sql`SELECT * FROM incidents WHERE id=${incidentId}`;
  if(!rows.length) return null;
  const incident=rows[0];
  const detail=await getSourceDetail(incident.source_id);
  if(!detail) return null;
  const [analysisRows,runRows,regressions,policyRows,reviews,auditRows]=await Promise.all([
    sql`SELECT * FROM analyses WHERE incident_id=${incidentId} ORDER BY created_at DESC,id DESC LIMIT 1`,
    sql`SELECT id FROM pipeline_runs WHERE source_version_id=${incident.candidate_version_id} LIMIT 1`,
    sql`SELECT * FROM regression_runs WHERE incident_id=${incidentId} ORDER BY created_at`,
    sql`SELECT * FROM policy_evaluations WHERE incident_id=${incidentId} AND is_effective=true LIMIT 1`,
    sql`SELECT * FROM review_decisions WHERE incident_id=${incidentId} ORDER BY created_at`,
    sql`SELECT * FROM audit_events WHERE (entity_type='incident' AND entity_id=${incidentId}) OR
      (entity_type='pipeline_run' AND entity_id IN (SELECT id::text FROM pipeline_runs WHERE incident_id=${incidentId})) OR
      (entity_type='pipeline_step' AND entity_id IN (SELECT s.id::text FROM pipeline_steps s JOIN pipeline_runs r ON r.id=s.run_id WHERE r.incident_id=${incidentId}))
      ORDER BY created_at,id`,
  ]);
  const run=runRows[0]?await getPipelineRun(runRows[0].id):null;
  const blastRadius=await readBlastRadius(incidentId);
  const analysis=analysisRows[0];
  return IncidentAggregate.parse({
    id:incident.id,sourceId:incident.source_id,status:incident.status,riskLevel:incident.risk_level,
    effectivePolicyAction:incident.effective_policy_action,title:incident.title,summary:incident.summary,
    candidateVersion:detail.versions.find(version=>version.id===incident.candidate_version_id),
    previousVersion:detail.versions.find(version=>version.id===incident.previous_version_id)??null,
    changes:detail.changes.filter(change=>change.toVersionId===incident.candidate_version_id),
    contextPacket:incident.context_packet_json,contextPacketHash:incident.context_packet_hash,primaryChangeId:incident.primary_change_id,
    analysis:analysis?{id:analysis.id,analysisType:analysis.analysis_type,riskLevel:analysis.risk_level,
      output:analysis.output_json,contextPacketHash:analysis.context_packet_hash,meta:analysis.meta_json,createdAt:analysis.created_at.toISOString()}:null,
    regressions:regressions.map(row=>({id:row.id,question:row.question,origin:row.question_origin,oldAnswer:row.old_answer,
      newAnswer:row.new_answer,result:row.result,oldVersionId:row.old_version_id,newVersionId:row.new_version_id})),
    pipeline:run,pipelineSteps:run?.steps??[],policyEvaluation:policyRows[0]?{
      id:policyRows[0].id,sourceVersionId:policyRows[0].source_version_id,incidentId:policyRows[0].incident_id,
      policyCode:policyRows[0].policy_code,deterministic:policyRows[0].deterministic_facts_json,
      advisory:policyRows[0].advisory_facts_json,action:policyRows[0].action,evaluatedAt:policyRows[0].evaluated_at.toISOString(),
    }:null,reviews:reviews.map(row=>({id:row.id,incidentId:row.incident_id,decision:row.decision,reviewer:row.reviewer,
      reason:row.reason,previousVersionId:row.previous_version_id,candidateVersionId:row.candidate_version_id,
      createdAt:row.created_at.toISOString()})),
    blastRadius,audit:auditRows.map(row=>({id:row.id,eventType:row.event_type,entityType:row.entity_type,entityId:row.entity_id,
      actor:row.actor,metadata:row.metadata_json,createdAt:row.created_at.toISOString()})),
  });
}
