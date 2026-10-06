import 'server-only';
import { getSql } from '@/lib/db/client';
import { getSourceDetail } from '@/lib/server/source-read';
import { IncidentAggregate, IncidentListItem } from '@/lib/contracts';
import { mapPipelineRun } from '@/lib/pipeline/read';
import { nextPendingStep, type StepName } from '@/lib/pipeline/model';
import { STEP_HANDLERS } from '@/lib/pipeline/steps';
import { readBlastRadius } from '@/lib/blast-radius/service';
import { mapAuditEvent } from '@/lib/governance/read-audit';

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
  const [bundle]=await sql`SELECT
    (SELECT to_jsonb(a) FROM analyses a WHERE a.incident_id=${incidentId}
      ORDER BY a.created_at DESC,a.id DESC LIMIT 1) AS analysis,
    (SELECT to_jsonb(r) FROM pipeline_runs r WHERE r.source_version_id=${incident.candidate_version_id} LIMIT 1) AS run,
    (SELECT COALESCE(jsonb_agg(to_jsonb(s)),'[]'::jsonb) FROM pipeline_steps s JOIN pipeline_runs r ON r.id=s.run_id
      WHERE r.source_version_id=${incident.candidate_version_id}) AS steps,
    (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at),'[]'::jsonb)
      FROM regression_runs r WHERE r.incident_id=${incidentId}) AS regressions,
    (SELECT to_jsonb(p) FROM policy_evaluations p WHERE p.incident_id=${incidentId}
      AND p.is_effective=true LIMIT 1) AS policy,
    (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.created_at),'[]'::jsonb)
      FROM review_decisions d WHERE d.incident_id=${incidentId}) AS reviews,
    (SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at,e.id),'[]'::jsonb)
      FROM audit_events e WHERE (e.entity_type='incident' AND e.entity_id=${incidentId}) OR
      (e.entity_type='source_version' AND e.entity_id IN (${incident.candidate_version_id},${incident.previous_version_id??''})) OR
      (e.entity_type='regression_run' AND e.entity_id IN (SELECT id::text FROM regression_runs WHERE incident_id=${incidentId})) OR
      (e.entity_type='pipeline_run' AND e.entity_id IN (SELECT id::text FROM pipeline_runs WHERE incident_id=${incidentId})) OR
      (e.entity_type='pipeline_step' AND e.entity_id IN (SELECT s.id::text FROM pipeline_steps s JOIN pipeline_runs r ON r.id=s.run_id WHERE r.incident_id=${incidentId}))
      ) AS audit`;
  const regressions=bundle.regressions as Array<Record<string,any>>;
  const reviews=bundle.reviews as Array<Record<string,any>>;
  const auditRows=bundle.audit as Array<Record<string,any>>;
  const run=bundle.run?mapPipelineRun(bundle.run,bundle.steps):null;
  const blastRadius=await readBlastRadius(incidentId);
  const analysis=bundle.analysis;
  const policy=bundle.policy;
  return IncidentAggregate.parse({
    id:incident.id,sourceId:incident.source_id,status:incident.status,riskLevel:incident.risk_level,
    effectivePolicyAction:incident.effective_policy_action,title:incident.title,summary:incident.summary,
    candidateVersion:detail.versions.find(version=>version.id===incident.candidate_version_id),
    previousVersion:detail.versions.find(version=>version.id===incident.previous_version_id)??null,
    changes:detail.changes.filter(change=>change.toVersionId===incident.candidate_version_id),
    contextPacket:incident.context_packet_json,contextPacketHash:incident.context_packet_hash,primaryChangeId:incident.primary_change_id,
    analysis:analysis?{id:analysis.id,analysisType:analysis.analysis_type,riskLevel:analysis.risk_level,
      output:analysis.output_json,contextPacketHash:analysis.context_packet_hash,meta:analysis.meta_json,createdAt:new Date(analysis.created_at).toISOString()}:null,
    regressions:regressions.map(row=>({id:row.id,question:row.question,origin:row.question_origin,oldAnswer:row.old_answer,
      newAnswer:row.new_answer,result:row.result,oldVersionId:row.old_version_id,newVersionId:row.new_version_id})),
    pipeline:run,pipelineSteps:run?.steps??[],policyEvaluation:policy?{
      id:policy.id,sourceVersionId:policy.source_version_id,incidentId:policy.incident_id,
      policyCode:policy.policy_code,deterministic:policy.deterministic_facts_json,
      advisory:policy.advisory_facts_json,action:policy.action,evaluatedAt:new Date(policy.evaluated_at).toISOString(),
    }:null,reviews:reviews.map(row=>({id:row.id,incidentId:row.incident_id,decision:row.decision,reviewer:row.reviewer,
      reason:row.reason,previousVersionId:row.previous_version_id,candidateVersionId:row.candidate_version_id,
      createdAt:new Date(row.created_at).toISOString()})),
    blastRadius,audit:auditRows.map(row=>mapAuditEvent({...row,created_at:new Date(row.created_at)})),
  });
}
