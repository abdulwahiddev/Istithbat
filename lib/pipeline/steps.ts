import 'server-only';
import { ensureIncident, runAnalysis } from './handlers';
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
};
