import type { PolicyChange } from './partition';
import { partitionChanges, rolesForChange } from './partition';

export type PolicyAction = 'ALLOW' | 'REVIEW' | 'QUARANTINE' | 'ESCALATE';
export type PolicyCode = 'POL-001' | 'POL-002' | 'POL-003' | 'POL-004' | 'POL-005';
export type AdvisoryFacts = {
  analysisTypes: string[];
  maxRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  meaningChanged: boolean;
  recommendedAction: PolicyAction | null;
  materialChangeDetected: boolean;
  aiFailed: boolean;
  regressionFailed: boolean;
  incidentFailed?: boolean;
  blastRadius?: { exposed: number; stale: number; impacted: number };
};
export type PolicyInput = {
  sourceType: string;
  contentLevel: 'A' | 'B' | 'C';
  silentMutation: boolean;
  serializationOnly: boolean;
  changes: PolicyChange[];
  advisory: AdvisoryFacts;
};
export const POLICY_DEFINITIONS = [
  { code: 'POL-001', priority: 100, role: 'AUTHORITATIVE_TEXT', floor: 'QUARANTINE' },
  { code: 'POL-002', priority: 90, role: 'SCHOLAR_JUDGMENT', floor: 'QUARANTINE' },
  { code: 'POL-003', priority: 80, role: 'TRANSLATION', floor: 'REVIEW' },
  { code: 'POL-004', priority: 70, role: 'PROVENANCE', floor: 'REVIEW' },
  { code: 'POL-005', priority: 10, role: null, floor: 'ALLOW' },
] as const;
const rank: Record<PolicyAction, number> = { ALLOW: 0, REVIEW: 1, QUARANTINE: 2, ESCALATE: 3 };
const stronger = (a: PolicyAction, b: PolicyAction): PolicyAction => rank[a] >= rank[b] ? a : b;

export function evaluatePolicy(input: PolicyInput) {
  const partition = partitionChanges(input.changes);
  const substantive = partition.substantive;
  const roles = [...new Set(substantive.flatMap(rolesForChange))];
  const highRisk = input.advisory.maxRiskLevel === 'HIGH' || input.advisory.maxRiskLevel === 'CRITICAL';
  const sensitiveFailure = (input.contentLevel === 'A' || input.contentLevel === 'C')
    && substantive.length > 0 && (input.advisory.aiFailed || input.advisory.regressionFailed);
  const matches: { code: PolicyCode | 'DEFAULT'; floor: PolicyAction; action: PolicyAction; reason: string }[] = [];
  if (substantive.length === 0) matches.push({ code: 'POL-005', floor: 'ALLOW', action: 'ALLOW', reason: input.serializationOnly ? 'serialization only' : partition.equivalent.some(change => change.flags.includes('WHITESPACE_ONLY')) ? 'whitespace-equivalent' : partition.equivalent.some(change => change.flags.includes('UNICODE_EQUIVALENT')) ? 'Unicode-equivalent' : 'metadata only' });
  if (roles.includes('AUTHORITATIVE_TEXT')) matches.push({ code: 'POL-001', floor: 'QUARANTINE', action: 'QUARANTINE', reason: 'substantive authoritative text' });
  if (roles.includes('SCHOLAR_JUDGMENT')) matches.push({ code: 'POL-002', floor: 'QUARANTINE', action: 'QUARANTINE', reason: 'substantive scholar judgment' });
  if (roles.includes('TRANSLATION')) matches.push({ code: 'POL-003', floor: 'REVIEW', action: input.advisory.meaningChanged || input.advisory.materialChangeDetected || sensitiveFailure ? 'QUARANTINE' : 'REVIEW', reason: 'substantive translation' });
  if (roles.includes('PROVENANCE')) matches.push({ code: 'POL-004', floor: 'REVIEW', action: highRisk || (sensitiveFailure && input.advisory.aiFailed) ? 'QUARANTINE' : 'REVIEW', reason: 'substantive provenance' });
  if (roles.includes('UNCLASSIFIED') || roles.includes('COMMENTARY')) matches.push({ code: 'DEFAULT', floor: 'REVIEW', action: highRisk || input.advisory.meaningChanged || (sensitiveFailure && input.advisory.aiFailed) ? 'QUARANTINE' : 'REVIEW', reason: 'substantive unclassified or commentary' });
  let action: PolicyAction = matches.reduce<PolicyAction>((result, match) => stronger(result, match.action), 'ALLOW');
  if (sensitiveFailure) action = stronger(action, 'QUARANTINE');
  if (substantive.length > 0 && input.advisory.recommendedAction) action = stronger(action, input.advisory.recommendedAction);
  const winner = [...matches].sort((a, b) => rank[b.action] - rank[a.action] || (POLICY_DEFINITIONS.find(d => d.code === b.code)?.priority ?? 0) - (POLICY_DEFINITIONS.find(d => d.code === a.code)?.priority ?? 0))[0];
  return {
    policyCode: winner?.code === 'DEFAULT' ? null : winner?.code ?? null,
    action, matches,
    deterministic: {
      sourceType: input.sourceType, contentLevel: input.contentLevel, silentMutation: input.silentMutation,
      serializationOnly: input.serializationOnly, fieldRolesChanged: roles,
      changeTypes: [...new Set(substantive.map(change => change.changeType))],
      substantiveChangeIds: substantive.map(change => change.id).filter(Boolean),
      equivalentChanges: partition.equivalent.map(change => ({ id: change.id ?? null, canonicalKey: change.canonicalKey, fieldPath: change.fieldPath, flags: change.flags })),
      operationalChangeIds: partition.operational.map(change => change.id).filter(Boolean),
      matchedRules: matches.map(match => ({ code: match.code, floor: match.floor, reason: match.reason })),
      equivalenceReason: winner?.code === 'POL-005' ? winner.reason : null,
    },
    advisory: { ...input.advisory, sensitiveFailure, escalations: matches.filter(match => match.action !== match.floor).map(match => match.code), recommendedActionApplied: substantive.length > 0 && input.advisory.recommendedAction !== null && rank[input.advisory.recommendedAction] > rank[winner?.floor ?? 'ALLOW'] },
  };
}
