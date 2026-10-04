import { evaluateFixture, type MutationFixture } from './harness';
import { evaluatePolicy, type AdvisoryFacts } from '@/lib/policy/rules';

const emptyAdvisory: AdvisoryFacts = { analysisTypes: [], maxRiskLevel: null, meaningChanged: false,
  recommendedAction: null, materialChangeDetected: false, aiFailed: false, regressionFailed: false };

export function measurePolicyActions(fixtures: MutationFixture[]) {
  const cases = fixtures.map(fixture => {
    const actual = evaluateFixture(fixture);
    const evaluation = evaluatePolicy({ sourceType: 'SANDBOX', contentLevel: 'A',
      silentMutation: actual.silentMutation, serializationOnly: actual.serializationOnly,
      changes: actual.changes, advisory: emptyAdvisory });
    return { id: fixture.id, expected: fixture.expected.policy_action, action: evaluation.action,
      policyCode: evaluation.policyCode, pass: evaluation.action === fixture.expected.policy_action };
  });
  const forcedFailure = fixtures.filter(fixture => evaluateFixture(fixture).changes.length > 0).map(fixture => {
    const actual = evaluateFixture(fixture);
    const result = evaluatePolicy({ sourceType: 'SANDBOX', contentLevel: 'A',
      silentMutation: actual.silentMutation, serializationOnly: actual.serializationOnly,
      changes: actual.changes, advisory: { ...emptyAdvisory, aiFailed: true } });
    return { id: fixture.id, action: result.action, substantive: result.deterministic.substantiveChangeIds.length > 0 || result.deterministic.fieldRolesChanged.length > 0 };
  });
  return { suite: 'policy-actions', total: cases.length, correct: cases.filter(item => item.pass).length,
    accuracy: cases.length ? cases.filter(item => item.pass).length / cases.length : 1,
    autoAllow: cases.filter(item => item.action === 'ALLOW').length,
    forcedAiFailureQuarantined: forcedFailure.filter(item => item.substantive && item.action === 'QUARANTINE').length,
    forcedAiFailureSubstantive: forcedFailure.filter(item => item.substantive).length,
    containment: 'verified separately against database and Trust Gateway', cases };
}
