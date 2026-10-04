import type { DiffFlagValue } from '@/lib/diff/flags';
import type { FieldRoleValue } from '@/lib/diff/engine';

export type EvidenceChange = {
  id: string;
  canonicalKey: string;
  changeType: string;
  fieldPath: string | null;
  fieldRole: FieldRoleValue;
  flags: DiffFlagValue[];
  rolesPresent: FieldRoleValue[];
};

export const STEP_ORDER = [
  'INCIDENT', 'ANALYSIS', 'REGRESSION_QUESTIONS', 'REGRESSION_PAIR', 'BLAST_RADIUS', 'POLICY',
] as const;
export type StepName = typeof STEP_ORDER[number];

export function isSubstantive(change: EvidenceChange): boolean {
  const metadataOnlyRecord = ['RECORD_ADDED','RECORD_DELETED'].includes(change.changeType)
    && change.rolesPresent.length > 0
    && change.rolesPresent.every(role => role === 'OPERATIONAL_METADATA');
  return change.fieldRole !== 'OPERATIONAL_METADATA'
    && !metadataOnlyRecord
    && !change.flags.includes('WHITESPACE_ONLY')
    && !change.flags.includes('UNICODE_EQUIVALENT');
}

export function needsIncident(changes: readonly EvidenceChange[]): boolean {
  return changes.some(isSubstantive);
}

const rolePriority: Record<FieldRoleValue, number> = {
  AUTHORITATIVE_TEXT: 7,
  SCHOLAR_JUDGMENT: 6,
  PROVENANCE: 5,
  TRANSLATION: 4,
  UNCLASSIFIED: 3,
  COMMENTARY: 2,
  OPERATIONAL_METADATA: 1,
};
const compareText=(a:string,b:string)=>a<b?-1:a>b?1:0;

function changePriority(change: EvidenceChange): number {
  return Math.max(rolePriority[change.fieldRole], ...change.rolesPresent.map(role => rolePriority[role]));
}

export function primaryChange(changes: readonly EvidenceChange[]): EvidenceChange | null {
  return [...changes].filter(isSubstantive).sort((a, b) =>
    changePriority(b) - changePriority(a)
    || compareText(a.canonicalKey,b.canonicalKey)
    || compareText(a.fieldPath??'',b.fieldPath??'')
    || compareText(a.id,b.id),
  )[0] ?? null;
}

export function stepsForCandidate(fastPath: boolean): StepName[] {
  return fastPath ? ['POLICY'] : ['INCIDENT', 'ANALYSIS', 'REGRESSION_QUESTIONS', 'BLAST_RADIUS', 'POLICY'];
}

export function nextPendingStep<T extends { step: StepName; status: string }>(steps: readonly T[]): T | null {
  return [...steps].sort((a, b) => STEP_ORDER.indexOf(a.step) - STEP_ORDER.indexOf(b.step))
    .find(step => step.status !== 'DONE' && step.status !== 'FAILED') ?? null;
}

export function isValidExpectedStep(next:StepName|null, expected:StepName|undefined):boolean {
  return expected===undefined || expected===next;
}

export function failureDisposition(attempts:number):'RETRY'|'FAILED' {
  return attempts>=2?'FAILED':'RETRY';
}
