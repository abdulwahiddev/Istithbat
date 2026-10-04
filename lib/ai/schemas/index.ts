export * from './enums';
export * from './incident-analysis';
export * from './regression';

import { IncidentAnalysisSchema } from './incident-analysis';
import {
  BehaviorDeltaSchema,
  QaAnswerSchema,
  RegressionQuestionsSchema,
  SafetyAnswerSchema,
} from './regression';
import type { AiTask } from '../types';

/** Canonical output schema per task. Callers pass these as `schema` to generateStructured. */
export const TASK_SCHEMAS = {
  INCIDENT_ANALYSIS: IncidentAnalysisSchema,
  REGRESSION_QUESTIONS: RegressionQuestionsSchema,
  QA_ANSWER: QaAnswerSchema,
  BEHAVIOR_DELTA: BehaviorDeltaSchema,
  SAFETY_ANSWER: SafetyAnswerSchema,
} as const satisfies Record<AiTask, unknown>;
