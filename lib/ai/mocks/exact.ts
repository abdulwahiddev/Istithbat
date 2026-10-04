import type { MockEntry } from './index';

/**
 * Exact canned outputs keyed by task + inputHash. Add entries when a test needs a
 * specific output for a specific input (compute the hash with hashInput from lib/ai/hash).
 * An entry whose `output` does not satisfy the schema is a valid way to exercise the
 * AI_ANALYSIS_FAILED / REGRESSION_FAILED path.
 */
export const EXACT_MOCKS: MockEntry[] = [];
