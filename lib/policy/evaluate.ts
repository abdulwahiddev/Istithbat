import 'server-only';
import { getSql } from '@/lib/db/client';
import type postgres from 'postgres';
import type { JsonValue } from '@/lib/hashing/canonicalize';
import { PipelineStepError } from '@/lib/pipeline/handlers';
import { promoteCandidateTx } from '@/lib/gateway/promote';
import { evaluatePolicy, POLICY_DEFINITIONS, type AdvisoryFacts, type PolicyAction, type PolicyInput } from './rules';
import type { PolicyChange } from './partition';

async function ensurePolicies(tx: postgres.TransactionSql) {
  for (const definition of POLICY_DEFINITIONS) {
    await tx`INSERT INTO policies (code,priority,trigger_json,action_json,enabled)
      VALUES (${definition.code},${definition.priority},${tx.json(definition.trigger)},${tx.json(definition.action)},true)
      ON CONFLICT (code) DO UPDATE SET priority=EXCLUDED.priority,trigger_json=EXCLUDED.trigger_json,action_json=EXCLUDED.action_json,enabled=true`;
  }
}

export async function loadPolicyInput(tx: postgres.TransactionSql, versionId: string, incidentId: string | null): Promise<PolicyInput> {
  const version = (await tx`SELECT v.*,s.source_type,s.content_level FROM source_versions v JOIN sources s ON s.id=v.source_id WHERE v.id=${versionId}`)[0];
  if (!version) throw new PipelineStepError('POLICY_EVALUATION_FAILED','Candidate version missing');
  const rawChanges = await tx`SELECT id,canonical_key,change_type,field_path,field_role,diff_flags,diff_json FROM changes WHERE to_version_id=${versionId} ORDER BY canonical_key,field_path NULLS FIRST,id`;
  if (version.previous_version_id && rawChanges.length === 0) {
    const previous = (await tx`SELECT canonical_sha256 FROM source_versions WHERE id=${version.previous_version_id}`)[0];
    if (!previous || previous.canonical_sha256 !== version.canonical_sha256) throw new PipelineStepError('POLICY_EVALUATION_FAILED','Empty diff does not match canonical snapshot');
  }
  const changes: PolicyChange[] = rawChanges.map(row => ({
    id: row.id, canonicalKey: row.canonical_key, changeType: row.change_type,
    fieldPath: row.field_path, fieldRole: row.field_role ?? 'UNCLASSIFIED',
    flags: row.diff_flags ?? [], rolesPresent: row.diff_json?.rolesPresent ?? [],
  }));
  const levels = await tx`SELECT DISTINCT COALESCE(new_record.content_level_override,old_record.content_level_override,${version.content_level}) AS level
    FROM changes c LEFT JOIN records new_record ON new_record.id=c.new_record_id
    LEFT JOIN records old_record ON old_record.id=c.old_record_id WHERE c.to_version_id=${versionId}`;
  const effectiveLevel = levels.some(row => row.level === 'A') ? 'A' : levels.some(row => row.level === 'C') ? 'C' : levels.some(row => row.level === 'B') ? 'B' : version.content_level;
  const run = (await tx`SELECT id FROM pipeline_runs WHERE source_version_id=${versionId}`)[0];
  const stepRows = run ? await tx`SELECT step,status FROM pipeline_steps WHERE run_id=${run.id}` : [];
  const analysis = incidentId ? (await tx`SELECT output_json FROM analyses WHERE incident_id=${incidentId} ORDER BY created_at DESC,id DESC LIMIT 1`)[0] : null;
  const regressions = incidentId ? await tx`SELECT result,status FROM regression_runs WHERE incident_id=${incidentId}` : [];
  const failed = (step: string) => stepRows.some(row => row.step === step && row.status === 'FAILED');
  const output = analysis?.output_json;
  const aiFailed = incidentId !== null && (failed('ANALYSIS') || (!analysis && stepRows.some(row => row.step === 'ANALYSIS' && row.status === 'DONE')));
  const regressionFailed = incidentId !== null && (failed('REGRESSION_QUESTIONS') || failed('REGRESSION_PAIR') || regressions.some(row => row.status === 'FAILED' || row.result === 'FAILED'));
  const risk = output?.risk_level;
  const recommendation = output?.recommended_action;
  const advisory: AdvisoryFacts = {
    analysisTypes: output?.analysis_type ? [output.analysis_type] : [],
    maxRiskLevel: ['LOW','MEDIUM','HIGH','CRITICAL'].includes(risk) ? risk : null,
    meaningChanged: output?.meaning_changed === true,
    recommendedAction: ['ALLOW','REVIEW','QUARANTINE','ESCALATE'].includes(recommendation) ? recommendation as PolicyAction : null,
    materialChangeDetected: regressions.some(row => row.status === 'COMPLETE' && row.result === 'MATERIAL_CHANGE'),
    aiFailed, regressionFailed,
  };
  return { sourceType: version.source_type, contentLevel: effectiveLevel, silentMutation: version.silent_mutation,
    serializationOnly: version.change_class === 'SERIALIZATION_ONLY', changes, advisory };
}

export async function evaluateCandidate(versionId: string, incidentId: string | null) {
  return getSql().begin(tx => evaluateCandidateTx(tx,versionId,incidentId));
}

export async function evaluateCandidateTx(tx: postgres.TransactionSql, versionId: string, incidentId: string | null) {
    const existing = await tx`SELECT id FROM policy_evaluations WHERE source_version_id=${versionId} AND is_effective=true`;
    if (existing.length) return existing[0].id as string;
    const version = (await tx`SELECT source_id,status FROM source_versions WHERE id=${versionId}`)[0];
    if (!version || !['PENDING','ANALYZING'].includes(version.status)) throw new PipelineStepError('POLICY_EVALUATION_FAILED','Candidate state invalid');
    await tx`SELECT id FROM sources WHERE id=${version.source_id} FOR UPDATE`;
    const locked = await tx`SELECT id FROM policy_evaluations WHERE source_version_id=${versionId} AND is_effective=true`;
    if (locked.length) return locked[0].id as string;
    const run = (await tx`SELECT id,fast_path FROM pipeline_runs WHERE source_version_id=${versionId}`)[0];
    if (!run) throw new PipelineStepError('POLICY_EVALUATION_FAILED','Pipeline run missing');
    const prerequisiteSteps = await tx`SELECT step,status FROM pipeline_steps WHERE run_id=${run.id} AND step NOT IN ('POLICY','BLAST_RADIUS')`;
    if (prerequisiteSteps.some(step => step.status !== 'DONE' && step.status !== 'FAILED')) throw new PipelineStepError('POLICY_EVALUATION_FAILED','Evidence steps not terminal');
    const input = await loadPolicyInput(tx,versionId,incidentId);
    const result = evaluatePolicy(input);
    const incidentFailed = prerequisiteSteps.some(step => step.step === 'INCIDENT' && step.status === 'FAILED');
    if (incidentFailed && incidentId === null && result.action !== 'ALLOW') {
      result.action = 'QUARANTINE';
      result.advisory.incidentFailed = true;
    }
    if ((result.action === 'ALLOW' && incidentId !== null) || (result.action !== 'ALLOW' && incidentId === null && !incidentFailed)) throw new PipelineStepError('POLICY_EVALUATION_FAILED','Incident and policy action mismatch');
    if (incidentId) {
      const incident = (await tx`SELECT id,status,candidate_version_id FROM incidents WHERE id=${incidentId} FOR UPDATE`)[0];
      if (!incident || incident.candidate_version_id !== versionId || incident.status !== 'NEEDS_REVIEW') throw new PipelineStepError('POLICY_EVALUATION_FAILED','Incident state invalid');
    }
    await ensurePolicies(tx);
    const row = (await tx`INSERT INTO policy_evaluations (source_version_id,incident_id,policy_code,deterministic_facts_json,advisory_facts_json,matched,action,is_effective)
      VALUES (${versionId},${incidentId},${result.policyCode},${tx.json(result.deterministic as unknown as JsonValue)},${tx.json(result.advisory as unknown as JsonValue)},true,${result.action},true) RETURNING id`)[0];
    const evaluationId = row.id as string;
    await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
      VALUES ('POLICY_EVALUATED','source_version',${versionId},'system:policy',${tx.json({evaluationId,policyCode:result.policyCode,action:result.action,incidentId,incidentFailed,matchedRules:result.matches.map(match=>match.code),equivalenceReason:result.deterministic.equivalenceReason})},${`policy-evaluated:${versionId}:${evaluationId}`}) ON CONFLICT DO NOTHING`;
    if (result.action === 'ALLOW') {
      await promoteCandidateTx(tx,{sourceId:version.source_id,candidateVersionId:versionId,evaluationId});
    } else if (result.action === 'QUARANTINE') {
      await tx`UPDATE source_versions SET status='QUARANTINED' WHERE id=${versionId} AND status IN ('PENDING','ANALYZING')`;
      if (incidentId) await tx`UPDATE incidents SET status='QUARANTINED',effective_policy_action='QUARANTINE' WHERE id=${incidentId}`;
      await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
        VALUES ('VERSION_QUARANTINED','source_version',${versionId},'system:policy',${tx.json({evaluationId,incidentId})},${`version-quarantined:${versionId}`}) ON CONFLICT DO NOTHING`;
    } else {
      await tx`UPDATE incidents SET effective_policy_action=${result.action},escalated=${result.action === 'ESCALATE'} WHERE id=${incidentId}`;
    }
    return evaluationId;
}
