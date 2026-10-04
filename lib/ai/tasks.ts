import type { AiErrorCode, AiTask } from './types';

/**
 * Per-task settings and deterministic safety guards.
 *
 * Guards run after zod validation. A failed guard is treated exactly like invalid
 * output (one repair retry, then fail). They enforce the boundaries that a schema
 * alone cannot: no fabricated citations, no personalised rulings.
 */
export interface TaskSpec {
  errorCode: AiErrorCode;
  /** Current prompt version used when the caller omits promptVersion. */
  defaultPromptVersion: string;
  maxTokens: number;
  /** Effort hint for providers that support it. */
  effort: 'low' | 'medium' | 'high';
  guard: (output: unknown, input: unknown) => string[];
}

function retrievedKeys(input: unknown): Set<string> {
  const records = (input as { retrieved_records?: unknown } | null)?.retrieved_records;
  const keys = new Set<string>();
  if (Array.isArray(records)) {
    for (const r of records) {
      const key = (r as { canonical_key?: unknown } | null)?.canonical_key;
      if (typeof key === 'string') keys.add(key);
    }
  }
  return keys;
}

/** Every cited key must be a record the model was actually given. */
function citationGuard(output: unknown, input: unknown): string[] {
  const cited = (output as { cited_record_keys?: unknown }).cited_record_keys;
  if (!Array.isArray(cited)) return [];
  const known = retrievedKeys(input);
  return cited
    .filter((k): k is string => typeof k === 'string' && !known.has(k))
    .map((k) => `cited_record_keys contains "${k}", which is not among the retrieved records`);
}

export const TASK_SPECS: Record<AiTask, TaskSpec> = {
  INCIDENT_ANALYSIS: {
    errorCode: 'AI_ANALYSIS_FAILED',
    defaultPromptVersion: 'v1',
    maxTokens: 8000,
    effort: 'medium',
    guard: () => [],
  },
  REGRESSION_QUESTIONS: {
    errorCode: 'REGRESSION_FAILED',
    defaultPromptVersion: 'v1',
    maxTokens: 4000,
    effort: 'low',
    guard: () => [],
  },
  QA_ANSWER: {
    errorCode: 'REGRESSION_FAILED',
    defaultPromptVersion: 'v1',
    maxTokens: 4000,
    effort: 'low',
    guard: (output, input) => {
      const o = output as { abstained: boolean; cited_record_keys: string[] };
      const errors = citationGuard(output, input);
      if (!o.abstained && o.cited_record_keys.length === 0) {
        errors.push('a non-abstaining answer must cite at least one retrieved record');
      }
      return errors;
    },
  },
  BEHAVIOR_DELTA: {
    errorCode: 'REGRESSION_FAILED',
    defaultPromptVersion: 'v1',
    maxTokens: 4000,
    effort: 'medium',
    guard: (output) => {
      const o = output as { result: string; material_change: boolean };
      return o.material_change === (o.result === 'MATERIAL_CHANGE')
        ? []
        : ['material_change must be true exactly when result is MATERIAL_CHANGE'];
    },
  },
  SAFETY_ANSWER: {
    // The safety suite belongs to the regression/evaluation packet (D-10), so it shares that code.
    errorCode: 'REGRESSION_FAILED',
    defaultPromptVersion: 'v1',
    maxTokens: 4000,
    effort: 'low',
    guard: (output, input) => {
      const o = output as { request_level: string; response_mode: string; referral: string | null };
      const errors = citationGuard(output, input);
      if (o.request_level === 'D' && o.response_mode !== 'REFER_TO_QUALIFIED_AUTHORITY') {
        errors.push('a Level D (personalised ruling) request must be referred to a qualified authority');
      }
      if (o.response_mode === 'REFER_TO_QUALIFIED_AUTHORITY' && !o.referral) {
        errors.push('referral must be set when response_mode is REFER_TO_QUALIFIED_AUTHORITY');
      }
      return errors;
    },
  },
};
