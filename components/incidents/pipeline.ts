import type { IncidentAggregate } from '@/lib/contracts';

/**
 * Maps the persisted pipeline (D-08) onto the product's conceptual stages:
 * CONNECT → DETECT → UNDERSTAND → TEST → TRACE → CONTAIN → HUMAN DECISION.
 *
 * Every stage state is derived from backend facts only. A stage is never shown as complete
 * unless its step rows are DONE (or, for CONNECT/DETECT, the persisted version and diff exist).
 */

export type StageState =
  | 'complete' // all step rows DONE
  | 'active' // a step is RUNNING, or some steps DONE and others not yet
  | 'next' // all PENDING, and the run's nextStep is in this stage
  | 'pending' // all PENDING, later in the order
  | 'retryable' // a step failed an attempt and is waiting to be retried
  | 'failed' // a step is FAILED (pipeline continues to POLICY, which fails closed)
  | 'not-scheduled' // the run has no step rows for this stage (e.g. D-05 fast path)
  | 'not-reached'; // human decision: no review decision recorded

export type StepState = IncidentAggregate['pipelineSteps'][number];

export interface Stage {
  key: 'CONNECT' | 'DETECT' | 'UNDERSTAND' | 'TEST' | 'TRACE' | 'CONTAIN' | 'DECIDE';
  label: string;
  question: string;
  state: StageState;
  steps: StepState[];
  /** Short factual note shown under the stage. */
  note: string;
}

export interface PipelineInput {
  hasCandidateSnapshot: boolean;
  changeCount: number;
  silentMutation: boolean;
  steps: StepState[];
  nextStep: string | null;
  reviewCount: number;
}

const STAGE_STEPS: Record<'UNDERSTAND' | 'TEST' | 'TRACE' | 'CONTAIN', readonly string[]> = {
  UNDERSTAND: ['INCIDENT', 'ANALYSIS'],
  TEST: ['REGRESSION_QUESTIONS', 'REGRESSION_PAIR'],
  TRACE: ['BLAST_RADIUS'],
  CONTAIN: ['POLICY'],
};

export function stateFromSteps(steps: StepState[], nextStep: string | null): StageState {
  if (steps.length === 0) return 'not-scheduled';
  if (steps.some((s) => s.status === 'FAILED')) return 'failed';
  if (steps.some((s) => s.status === 'RUNNING')) return 'active';
  if (steps.some((s) => s.status === 'PENDING' && s.errorCode)) return 'retryable';
  if (steps.every((s) => s.status === 'DONE')) return 'complete';
  if (steps.some((s) => s.status === 'DONE')) return 'active';
  return nextStep && steps.some((s) => s.step === nextStep) ? 'next' : 'pending';
}

function stepNote(state: StageState, steps: StepState[]): string {
  const done = steps.filter((s) => s.status === 'DONE').length;
  switch (state) {
    case 'complete':
      return `${done}/${steps.length} step${steps.length === 1 ? '' : 's'} done`;
    case 'active':
      return `${done}/${steps.length} done · in progress`;
    case 'next':
      return 'Queued next · not started';
    case 'pending':
      return 'Not started';
    case 'retryable': {
      const s = steps.find((x) => x.errorCode);
      return `Attempt ${s?.attempts ?? 1} failed (${s?.errorCode}) · will retry`;
    }
    case 'failed': {
      const s = steps.find((x) => x.status === 'FAILED');
      return `Failed: ${s?.errorCode ?? 'unknown error'} · candidate stays untrusted`;
    }
    case 'not-scheduled':
      return 'Not scheduled for this run';
    default:
      return '';
  }
}

export function pipelineStages(input: PipelineInput): Stage[] {
  const stepStage = (key: keyof typeof STAGE_STEPS) => input.steps.filter((s) => STAGE_STEPS[key].includes(s.step));
  const fromSteps = (key: keyof typeof STAGE_STEPS, label: string, question: string): Stage => {
    const steps = stepStage(key);
    const state = stateFromSteps(steps, input.nextStep);
    return { key, label, question, state, steps, note: stepNote(state, steps) };
  };

  return [
    {
      key: 'CONNECT',
      label: 'Connect',
      question: 'Was the upstream payload fetched and preserved?',
      state: input.hasCandidateSnapshot ? 'complete' : 'pending',
      steps: [],
      note: input.hasCandidateSnapshot ? 'Immutable snapshot stored' : 'No snapshot',
    },
    {
      key: 'DETECT',
      label: 'Detect',
      question: 'What exactly changed?',
      state: input.hasCandidateSnapshot ? 'complete' : 'pending',
      steps: [],
      note: input.hasCandidateSnapshot
        ? `${input.changeCount} exact change${input.changeCount === 1 ? '' : 's'}${input.silentMutation ? ' · silent mutation' : ''}`
        : 'Not run',
    },
    fromSteps('UNDERSTAND', 'Understand', 'What might the change mean?'),
    fromSteps('TEST', 'Test', 'Do AI answers change?'),
    fromSteps('TRACE', 'Trace', 'Which downstream assets depend on it?'),
    fromSteps('CONTAIN', 'Contain', 'What does policy require?'),
    {
      key: 'DECIDE',
      label: 'Human decision',
      question: 'Approve, reject, keep quarantined or escalate?',
      state: input.reviewCount > 0 ? 'complete' : 'not-reached',
      steps: [],
      note: input.reviewCount > 0 ? `${input.reviewCount} decision${input.reviewCount === 1 ? '' : 's'} recorded` : 'Not reached',
    },
  ];
}

export function stagesForIncident(inc: IncidentAggregate): Stage[] {
  return pipelineStages({
    hasCandidateSnapshot: Boolean(inc.candidateVersion?.rawSha256),
    changeCount: inc.changes.length,
    silentMutation: inc.candidateVersion.silentMutation,
    steps: inc.pipelineSteps,
    nextStep: inc.pipeline?.nextStep ?? null,
    reviewCount: inc.reviews.length,
  });
}
