import 'server-only';
import { ensureIncident, runAnalysis } from './handlers';
import { prepareRegressionQuestions, runRegressionPairStep } from '@/lib/regression/run';
import type { StepName } from './model';

export type StepContext = {runId:string;versionId:string;incidentId:string|null};
export type StepHandler = (context:StepContext) => Promise<string|null>;

/** Later packets attach their handlers here; the runner remains unchanged. */
export const STEP_HANDLERS: Partial<Record<StepName,StepHandler>> = {
  INCIDENT: context => ensureIncident(context.runId,context.versionId),
  ANALYSIS: context => {
    if (!context.incidentId) throw new Error('DIFF_FAILED');
    return runAnalysis(context.incidentId);
  },
  REGRESSION_QUESTIONS: context => {
    if (!context.incidentId) throw new Error('REGRESSION_FAILED');
    return prepareRegressionQuestions(context.runId,context.incidentId);
  },
  REGRESSION_PAIR: context => {
    if (!context.incidentId) throw new Error('REGRESSION_FAILED');
    return runRegressionPairStep(context.runId,context.incidentId);
  },
};
