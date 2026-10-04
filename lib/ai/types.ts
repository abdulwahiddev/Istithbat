// lib/ai public types (D-15). Owner: Claude.
// Codex callers persist `meta` verbatim; lib/contracts may re-export these.

export const AI_TASKS = [
  'INCIDENT_ANALYSIS',
  'REGRESSION_QUESTIONS',
  'QA_ANSWER',
  'BEHAVIOR_DELTA',
  'SAFETY_ANSWER',
] as const;
export type AiTask = (typeof AI_TASKS)[number];

export const AI_MODES = ['live', 'mock', 'replay'] as const;
export type AiMode = (typeof AI_MODES)[number];

/** The only two error codes lib/ai ever returns (Bible §12). */
export type AiErrorCode = 'AI_ANALYSIS_FAILED' | 'REGRESSION_FAILED';

/**
 * Why a call failed, for audit/debugging. `detail` is a human-readable string;
 * `reason` is a stable machine code callers may branch on or store.
 */
export type AiFailureReason =
  | 'NOT_CONFIGURED' // live mode without provider/model/key
  | 'UNKNOWN_PROMPT' // no template for task + promptVersion
  | 'PROVIDER_ERROR' // transport / HTTP / timeout
  | 'PROVIDER_REFUSAL' // model declined (stop_reason=refusal)
  | 'TRUNCATED' // stop_reason=max_tokens
  | 'INVALID_OUTPUT' // not JSON, schema-invalid or failed a safety guard after the repair retry
  | 'REPLAY_MISSING' // replay mode, no recorded response for this input
  | 'MOCK_MISSING'; // mock mode, no canned output for this task

export interface AiMeta {
  provider: string; // e.g. 'anthropic', or 'mock' in mock mode
  model: string;
  promptId: string; // e.g. 'incident-analysis'
  promptVersion: string; // e.g. 'v1'
  /** Requested temperature. null when the model rejects sampling parameters (see providers/anthropic.ts). */
  temperature: number | null;
  maxTokens: number;
  inputHash: string; // sha256 hex of the stable-stringified input
  latencyMs: number;
  mode: AiMode;
  // ---- additive fields (beyond the D-15 minimum) ----
  /** Provider calls made: 1, or 2 when the repair retry ran. 0 for mock/replay. */
  attempts: number;
  /** replay only: when the live response was recorded (ISO 8601). UI must show it (D-15). */
  recordedAt: string | null;
  /** mock only: whether a canned output matched this exact input or the task default generator ran. */
  mockMatch: 'exact' | 'default' | null;
  /** effort level sent to the provider, if any. */
  effort: string | null;
}

export type AiResult<T> =
  | { ok: true; data: T; meta: AiMeta }
  | { ok: false; errorCode: AiErrorCode; reason: AiFailureReason; detail: string; meta: AiMeta };

export interface GenerateRequest<S> {
  task: AiTask;
  /** zod schema the output is validated against. Use the exported schemas in lib/ai/schemas. */
  schema: S;
  /** JSON-serialisable task input (e.g. the typed context packet). Never include secrets. */
  input: unknown;
  /** Prompt template version; defaults to the task's current version. */
  promptVersion?: string;
}
