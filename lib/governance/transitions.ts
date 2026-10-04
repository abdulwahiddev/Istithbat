import type { PolicyAction } from '@/lib/policy/rules';

export type ReviewAction = 'APPROVE' | 'REJECT' | 'KEEP_QUARANTINED' | 'ESCALATE';
export const REVIEW_TRANSITIONS: Record<ReviewAction, { version: readonly string[]; incident: readonly string[] }> = {
  APPROVE: { version: ['ANALYZING','QUARANTINED'], incident: ['NEEDS_REVIEW','QUARANTINED'] },
  REJECT: { version: ['ANALYZING','QUARANTINED'], incident: ['NEEDS_REVIEW','QUARANTINED'] },
  KEEP_QUARANTINED: { version: ['ANALYZING','QUARANTINED'], incident: ['NEEDS_REVIEW','QUARANTINED'] },
  ESCALATE: { version: ['ANALYZING','QUARANTINED'], incident: ['NEEDS_REVIEW','QUARANTINED'] },
};

export function canReview(action: ReviewAction, version: string, incident: string, policyAction: PolicyAction | null) {
  return REVIEW_TRANSITIONS[action].version.includes(version)
    && REVIEW_TRANSITIONS[action].incident.includes(incident)
    && policyAction !== null && policyAction !== 'ALLOW';
}
