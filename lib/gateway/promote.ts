import 'server-only';
import type postgres from 'postgres';
import { getSql } from '@/lib/db/client';

export class InvalidReviewTransition extends Error {
  constructor() { super('INVALID_REVIEW_TRANSITION'); }
}

type Promotion = { sourceId: string; candidateVersionId: string; incidentId?: string; evaluationId: string; reviewer?: string; reason?: string };
export type PromotionOptions = { testThrowAfterTrust?: boolean };

/** Caller owns the transaction so policy evaluation and promotion commit together. */
export async function promoteCandidateTx(tx: postgres.TransactionSql, input: Promotion, options: PromotionOptions = {}) {
  const source = await tx`SELECT id FROM sources WHERE id=${input.sourceId} FOR UPDATE`;
  if (!source.length) throw new InvalidReviewTransition();
  const bindings = await tx`SELECT id,served_version_id FROM gateway_bindings WHERE source_id=${input.sourceId} ORDER BY id FOR UPDATE`;
  const candidateRows = await tx`SELECT id,status,source_id FROM source_versions WHERE id=${input.candidateVersionId} FOR UPDATE`;
  const candidate = candidateRows[0];
  const priorRows = await tx`SELECT id FROM source_versions WHERE source_id=${input.sourceId} AND status='TRUSTED' FOR UPDATE`;
  const priorId = priorRows[0]?.id as string | undefined;
  const evaluationRows = await tx`SELECT id,action,policy_code,incident_id FROM policy_evaluations WHERE id=${input.evaluationId} AND source_version_id=${input.candidateVersionId} AND is_effective=true FOR UPDATE`;
  const evaluation = evaluationRows[0];
  if (!candidate || candidate.source_id !== input.sourceId || !priorId || priorId === input.candidateVersionId || !evaluation) throw new InvalidReviewTransition();
  if (bindings.some(binding => binding.served_version_id !== priorId)) throw new InvalidReviewTransition();
  if (input.incidentId) {
    const incidentRows = await tx`SELECT id,status,candidate_version_id FROM incidents WHERE id=${input.incidentId} FOR UPDATE`;
    const incident = incidentRows[0];
    if (!incident || incident.candidate_version_id !== input.candidateVersionId || !['NEEDS_REVIEW','QUARANTINED'].includes(incident.status) || evaluation.incident_id !== input.incidentId || !['ANALYZING','QUARANTINED'].includes(candidate.status)) throw new InvalidReviewTransition();
  } else if (evaluation.action !== 'ALLOW' || evaluation.policy_code !== 'POL-005' || evaluation.incident_id !== null || !['PENDING','ANALYZING'].includes(candidate.status)) {
    throw new InvalidReviewTransition();
  }
  if (candidate.status === 'PENDING') await tx`UPDATE source_versions SET status='ANALYZING' WHERE id=${input.candidateVersionId}`;
  await tx`UPDATE source_versions SET status='SUPERSEDED' WHERE id=${priorId} AND status='TRUSTED'`;
  const trusted = await tx`UPDATE source_versions SET status='TRUSTED' WHERE id=${input.candidateVersionId} AND status IN ('ANALYZING','QUARANTINED') RETURNING id`;
  if (!trusted.length) throw new InvalidReviewTransition();
  if (options.testThrowAfterTrust && process.env.NODE_ENV === 'test') throw new Error('TEST_PROMOTION_ROLLBACK');
  await tx`UPDATE gateway_bindings SET served_version_id=${input.candidateVersionId},gateway_status='SERVING_TRUSTED',updated_at=now() WHERE source_id=${input.sourceId} AND served_version_id=${priorId}`;
  await tx`UPDATE asset_source_records SET derived_from_version_id=${input.candidateVersionId} WHERE source_id=${input.sourceId} AND derivation_mode='GATEWAY_RESOLVED' AND derived_from_version_id=${priorId}`;
  if (input.incidentId) {
    const decision = (await tx`INSERT INTO review_decisions (incident_id,decision,reviewer,reason,previous_version_id,candidate_version_id)
      VALUES (${input.incidentId},'APPROVE',${input.reviewer!},${input.reason ?? null},${priorId},${input.candidateVersionId}) RETURNING id`)[0];
    await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
      VALUES ('REVIEW_DECISION','incident',${input.incidentId},${`reviewer:${input.reviewer}`},${tx.json({decisionId:decision.id,decision:'APPROVE',candidateVersionId:input.candidateVersionId})},${`review-decision:${decision.id}`}) ON CONFLICT DO NOTHING`;
    await tx`UPDATE incidents SET status='RESOLVED',resolved_at=now() WHERE id=${input.incidentId}`;
  }
  await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
    VALUES ('VERSION_PROMOTED','source_version',${input.candidateVersionId},${input.incidentId ? `reviewer:${input.reviewer}` : 'policy:POL-005'},${tx.json({previousVersionId:priorId,candidateVersionId:input.candidateVersionId,evaluationId:input.evaluationId,incidentId:input.incidentId ?? null})},${`version-promoted:${input.candidateVersionId}`}) ON CONFLICT DO NOTHING`;
  return { previousVersionId: priorId, candidateVersionId: input.candidateVersionId };
}

export async function promoteCandidate(input: Promotion, options?: PromotionOptions) {
  return getSql().begin(tx => promoteCandidateTx(tx, input, options));
}
