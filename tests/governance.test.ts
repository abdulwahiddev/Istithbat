import { describe, expect, it } from 'vitest';
import { evaluatePolicy, type AdvisoryFacts, type PolicyInput } from '@/lib/policy/rules';
import { canReview } from '@/lib/governance/transitions';
import { loadMutationFixtures } from '@/lib/evaluation/harness';
import { measurePolicyActions } from '@/lib/evaluation/governance';

const empty: AdvisoryFacts = { analysisTypes: [], maxRiskLevel: null, meaningChanged: false,
  recommendedAction: null, materialChangeDetected: false, aiFailed: false, regressionFailed: false };
function input(role: PolicyInput['changes'][number]['fieldRole'], advisory: Partial<AdvisoryFacts> = {}, flags: PolicyInput['changes'][number]['flags'] = []): PolicyInput {
  return { sourceType: 'SANDBOX', contentLevel: 'A', silentMutation: false, serializationOnly: false,
    changes: [{ canonicalKey: 'HAD-4821', changeType: 'FIELD_MODIFIED', fieldPath: 'judgment', fieldRole: role, flags }],
    advisory: { ...empty, ...advisory } };
}

describe('Packet 06 deterministic policy', () => {
  it('matches the frozen action for all 40 mutations and fails closed on substantive AI failure', () => {
    const result = measurePolicyActions(loadMutationFixtures());
    expect(result.total).toBe(40);
    expect(result.correct).toBe(40);
    expect(result.forcedAiFailureQuarantined).toBe(result.forcedAiFailureSubstantive);
  });
  it('quarantines authoritative text and judgment even when AI recommends ALLOW', () => {
    for (const role of ['AUTHORITATIVE_TEXT','SCHOLAR_JUDGMENT'] as const) {
      const result = evaluatePolicy(input(role,{ recommendedAction:'ALLOW', maxRiskLevel:'LOW' }));
      expect(result.action).toBe('QUARANTINE');
      expect(result.policyCode).toBe(role === 'AUTHORITATIVE_TEXT' ? 'POL-001' : 'POL-002');
    }
  });
  it('keeps the r2 provenance floor at REVIEW when AI recommends ALLOW', () => {
    const result = evaluatePolicy({ ...input('PROVENANCE',{ recommendedAction:'ALLOW', materialChangeDetected:true }), silentMutation:true });
    expect(result.policyCode).toBe('POL-004');
    expect(result.action).toBe('REVIEW');
  });
  it('allows equivalent judgment and metadata changes without an incident', () => {
    expect(evaluatePolicy(input('SCHOLAR_JUDGMENT',{},['WHITESPACE_ONLY'])).action).toBe('ALLOW');
    expect(evaluatePolicy(input('OPERATIONAL_METADATA')).policyCode).toBe('POL-005');
    expect(evaluatePolicy({ ...input('OPERATIONAL_METADATA'), changes:[], serializationOnly:true }).deterministic.equivalenceReason).toBe('serialization only');
  });
  it('treats harakat and punctuation as substantive and applies record deletion roles', () => {
    expect(evaluatePolicy(input('AUTHORITATIVE_TEXT',{},['HARAKAT_ONLY'])).action).toBe('QUARANTINE');
    expect(evaluatePolicy(input('SCHOLAR_JUDGMENT',{},['PUNCTUATION_ONLY'])).action).toBe('QUARANTINE');
    const deletion = input('UNCLASSIFIED');
    deletion.changes[0] = { ...deletion.changes[0], changeType:'RECORD_DELETED', rolesPresent:['AUTHORITATIVE_TEXT','SCHOLAR_JUDGMENT'] };
    expect(evaluatePolicy(deletion).policyCode).toBe('POL-001');
  });
  it('only raises actions from advisory facts and fails closed at A/C', () => {
    expect(evaluatePolicy(input('TRANSLATION',{ meaningChanged:true })).action).toBe('QUARANTINE');
    expect(evaluatePolicy(input('TRANSLATION',{ materialChangeDetected:true })).action).toBe('QUARANTINE');
    expect(evaluatePolicy(input('PROVENANCE',{ maxRiskLevel:'HIGH' })).action).toBe('QUARANTINE');
    expect(evaluatePolicy(input('PROVENANCE',{ aiFailed:true })).action).toBe('QUARANTINE');
    expect(evaluatePolicy(input('PROVENANCE',{ regressionFailed:true })).action).toBe('QUARANTINE');
    expect(evaluatePolicy({ ...input('PROVENANCE',{ aiFailed:true }), contentLevel:'B' }).action).toBe('REVIEW');
  });
  it('holds REVIEW without release and validates human transitions', () => {
    expect(canReview('APPROVE','ANALYZING','NEEDS_REVIEW','REVIEW')).toBe(true);
    expect(canReview('REJECT','QUARANTINED','QUARANTINED','QUARANTINE')).toBe(true);
    expect(canReview('KEEP_QUARANTINED','ANALYZING','NEEDS_REVIEW','REVIEW')).toBe(true);
    expect(canReview('ESCALATE','ANALYZING','NEEDS_REVIEW','REVIEW')).toBe(true);
    expect(canReview('APPROVE','TRUSTED','RESOLVED','QUARANTINE')).toBe(false);
    expect(canReview('APPROVE','ANALYZING','NEEDS_REVIEW','ALLOW')).toBe(false);
  });
});
