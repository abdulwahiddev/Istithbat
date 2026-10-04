import type { DiffChange } from '@/lib/diff/engine';

export type PolicyChange = Pick<DiffChange, 'changeType' | 'fieldRole' | 'fieldPath' | 'flags' | 'rolesPresent' | 'canonicalKey'> & { id?: string };

export function partitionChanges(changes: readonly PolicyChange[]) {
  const equivalent: PolicyChange[] = [];
  const substantive: PolicyChange[] = [];
  const operational: PolicyChange[] = [];
  for (const change of changes) {
    if (change.flags.includes('WHITESPACE_ONLY') || change.flags.includes('UNICODE_EQUIVALENT')) {
      equivalent.push(change);
    } else if (rolesForChange(change).every(role => role === 'OPERATIONAL_METADATA')) {
      operational.push(change);
    } else {
      substantive.push(change);
    }
  }
  return { equivalent, substantive, operational };
}

export function rolesForChange(change: PolicyChange) {
  return change.changeType === 'RECORD_ADDED' || change.changeType === 'RECORD_DELETED'
    ? change.rolesPresent?.length ? change.rolesPresent : ['UNCLASSIFIED'] as const
    : [change.fieldRole];
}
