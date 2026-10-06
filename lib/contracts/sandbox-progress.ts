import type { PipelineRunState } from './index';
export function pipelineFingerprint(run: PipelineRunState | null) {
  return JSON.stringify(run ? [run.id,run.status,run.incidentId,run.steps.map(s=>[s.step,s.itemKey,s.status,s.attempts,s.errorCode])] : null);
}
export const demoStages=[
  {name:'Detect',description:'Snapshot, fingerprint and exact diff',steps:['INCIDENT']},
  {name:'Understand',description:'AI semantic and evidence analysis',steps:['ANALYSIS']},
  {name:'Test',description:'Matched behavioral regression',steps:['REGRESSION_QUESTIONS','REGRESSION_PAIR']},
  {name:'Trace',description:'Deterministic Blast Radius',steps:['BLAST_RADIUS']},
  {name:'Contain',description:'Policy evaluation',steps:['POLICY']},
] as const;
export function stageStatus(run:PipelineRunState, names: readonly string[]) {
  const steps=run.steps.filter(s=>names.includes(s.step));
  if (!steps.length) return 'Not scheduled';
  if (steps.some(s=>s.status==='FAILED')) return 'Failed';
  if (steps.every(s=>s.status==='DONE')) return 'Done';
  if (steps.some(s=>s.status==='RUNNING' || s.attempts>0)) return 'Running';
  return 'Pending';
}
