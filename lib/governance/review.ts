import 'server-only';
import { getSql } from '@/lib/db/client';
import { InvalidReviewTransition, promoteCandidateTx } from '@/lib/gateway/promote';
import { canReview, type ReviewAction } from './transitions';
import type { PolicyAction } from '@/lib/policy/rules';
import type postgres from 'postgres';
import { recomputeAfterPromotion } from '@/lib/blast-radius/service';

export type ReviewRequest = { incidentId: string; decision: ReviewAction; reviewer: string; reason?: string };

export async function reviewIncident(input: ReviewRequest) {
  if (!input.reviewer.trim() || (input.decision === 'KEEP_QUARANTINED' && !input.reason?.trim())) throw new InvalidReviewTransition();
  const result = await getSql().begin(tx => reviewIncidentTx(tx,input));
  if (input.decision === 'APPROVE') await recomputeAfterPromotion(input.incidentId);
  return result;
}

export async function reviewIncidentTx(tx: postgres.TransactionSql, input: ReviewRequest) {
    if (!input.reviewer.trim() || (input.decision === 'KEEP_QUARANTINED' && !input.reason?.trim())) throw new InvalidReviewTransition();
    const incidentRows = await tx`SELECT id,source_id,candidate_version_id,status,effective_policy_action FROM incidents WHERE id=${input.incidentId}`;
    const incident = incidentRows[0];
    if (!incident) throw new InvalidReviewTransition();
    // The source lock serializes reviews with ALLOW promotions and other reviews.
    await tx`SELECT id FROM sources WHERE id=${incident.source_id} FOR UPDATE`;
    const lockedIncident = (await tx`SELECT * FROM incidents WHERE id=${input.incidentId} FOR UPDATE`)[0];
    const candidate = (await tx`SELECT id,source_id,status FROM source_versions WHERE id=${lockedIncident.candidate_version_id} FOR UPDATE`)[0];
    const evaluation = (await tx`SELECT id,action FROM policy_evaluations WHERE source_version_id=${lockedIncident.candidate_version_id} AND incident_id=${input.incidentId} AND is_effective=true FOR UPDATE`)[0];
    if (!candidate || candidate.source_id !== incident.source_id || !evaluation || evaluation.action !== lockedIncident.effective_policy_action
      || !canReview(input.decision,candidate.status,lockedIncident.status,lockedIncident.effective_policy_action as PolicyAction | null)) throw new InvalidReviewTransition();
    if (input.decision === 'APPROVE') {
      const promotion = await promoteCandidateTx(tx,{sourceId:incident.source_id,candidateVersionId:lockedIncident.candidate_version_id,incidentId:input.incidentId,evaluationId:evaluation.id,reviewer:input.reviewer.trim(),reason:input.reason?.trim()});
      return { decision: input.decision, incidentId: input.incidentId, ...promotion };
    }
    let priorId: string | null = null;
    if (input.decision === 'REJECT') {
      await tx`UPDATE source_versions SET status='REJECTED' WHERE id=${lockedIncident.candidate_version_id}`;
      await tx`UPDATE incidents SET status='RESOLVED',resolved_at=now() WHERE id=${input.incidentId}`;
    } else if (input.decision === 'KEEP_QUARANTINED') {
      await tx`UPDATE source_versions SET status='QUARANTINED' WHERE id=${lockedIncident.candidate_version_id}`;
      await tx`UPDATE incidents SET status='QUARANTINED' WHERE id=${input.incidentId}`;
    } else {
      await tx`UPDATE incidents SET escalated=true WHERE id=${input.incidentId}`;
    }
    priorId = (await tx`SELECT id FROM source_versions WHERE source_id=${incident.source_id} AND status='TRUSTED'`)[0]?.id ?? null;
    const decision = (await tx`INSERT INTO review_decisions (incident_id,decision,reviewer,reason,previous_version_id,candidate_version_id)
      VALUES (${input.incidentId},${input.decision},${input.reviewer.trim()},${input.reason?.trim() ?? null},${priorId},${lockedIncident.candidate_version_id}) RETURNING id`)[0];
    await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
      VALUES ('REVIEW_DECISION','incident',${input.incidentId},${`reviewer:${input.reviewer.trim()}`},${tx.json({decisionId:decision.id,decision:input.decision,candidateVersionId:lockedIncident.candidate_version_id})},${`review-decision:${decision.id}`}) ON CONFLICT DO NOTHING`;
    return { decision: input.decision, incidentId: input.incidentId, candidateVersionId: lockedIncident.candidate_version_id, previousVersionId: priorId };
}
