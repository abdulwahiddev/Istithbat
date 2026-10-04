import type { AiTask } from '../types';
import { EXACT_MOCKS } from './exact';

/**
 * AI_MODE=mock: deterministic canned outputs keyed by task + inputHash (D-15).
 *
 * Lookup order:
 *  1. an exact entry for (task, inputHash) in ./exact.ts;
 *  2. the task's default generator below — a pure function of the input, so the same
 *     input always yields the same output and Packet 03/04 pipelines run without a provider.
 *
 * Every mock output is prefixed "[Mock]" so it can never pass for a live analysis, and
 * mock-mode metrics are never reported as performance (Bible §15).
 * Mock outputs go through the same zod validation and safety guards as live output.
 */
export interface MockEntry {
  task: AiTask;
  inputHash: string;
  output: unknown;
  note?: string;
}

const MOCK = '[Mock]';

type Rec = { canonical_key?: string; content?: Record<string, unknown> };

function retrieved(input: unknown): Rec[] {
  const r = (input as { retrieved_records?: unknown } | null)?.retrieved_records;
  return Array.isArray(r) ? (r as Rec[]) : [];
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : JSON.stringify(v ?? null);
}

const DEFAULTS: Record<AiTask, (input: unknown) => unknown> = {
  INCIDENT_ANALYSIS: () => ({
    analysis_type: 'EVIDENCE_DRIFT',
    risk_level: 'HIGH',
    executive_summary: `${MOCK} Deterministic placeholder analysis for pipeline testing. No model was called.`,
    what_changed: `${MOCK} See the deterministic diff; this mock does not read it.`,
    why_it_matters: `${MOCK} A change to a grading or canonical field can alter what a downstream answer claims.`,
    domain_analysis: {
      linguistic: `${MOCK} Not analysed.`,
      evidence_scope: `${MOCK} Not analysed. This is not a ruling on any grading.`,
      provenance_effect: `${MOCK} Not analysed.`,
    },
    potential_downstream_effects: [`${MOCK} Q&A answers citing this record may change.`],
    recommended_regression_tests: [`${MOCK} Ask what the source's changed field says.`],
    uncertainties: [`${MOCK} No model analysis was performed.`],
    recommended_action: 'QUARANTINE',
    requires_specialist_review: true,
    confidence: 'LOW',
    meaning_changed: true,
  }),

  REGRESSION_QUESTIONS: (input) => {
    const field =
      str((input as { change?: { field_path?: unknown } } | null)?.change?.field_path).replace(/"/g, '') || 'changed field';
    return {
      questions: [
        {
          question: `What does the source's ${field} field say about this record?`,
          targets_field: field,
          rationale: `${MOCK} Generic probe of the changed field.`,
        },
      ],
    };
  },

  // Quotes the retrieved record's judgment verbatim, so v13 and v14 mock answers differ
  // exactly as the source differs. No interpretation is added.
  QA_ANSWER: (input) => {
    const records = retrieved(input);
    const first = records[0];
    if (!first?.canonical_key) {
      return {
        answer: `${MOCK} No retrieved record answers this question.`,
        cited_record_keys: [],
        abstained: true,
        abstention_reason: 'No records were retrieved.',
        uncertainty: `${MOCK} Nothing was retrieved.`,
      };
    }
    const judgment = first.content?.judgment;
    const body =
      judgment !== undefined
        ? `Record ${first.canonical_key}: the source's grading field reads «${str(judgment)}».`
        : `Record ${first.canonical_key} was retrieved; this mock only quotes the judgment field and it is absent.`;
    return {
      answer: `${MOCK} ${body}`,
      cited_record_keys: [first.canonical_key],
      abstained: false,
      abstention_reason: null,
      uncertainty: `${MOCK} Quotation only; no interpretation.`,
    };
  },

  // String comparison only — deterministic, explicitly not semantic.
  BEHAVIOR_DELTA: (input) => {
    const i = (input ?? {}) as { old_answer?: unknown; new_answer?: unknown };
    const oldA = str(i.old_answer);
    const newA = str(i.new_answer);
    const same = oldA.replace(/\s+/g, ' ').trim() === newA.replace(/\s+/g, ' ').trim();
    return {
      result: same ? 'NO_CHANGE' : 'INCONCLUSIVE',
      material_change: false,
      delta_types: [],
      old_answer_claim: `${MOCK} ${oldA.slice(0, 200) || '(empty)'}`,
      new_answer_claim: `${MOCK} ${newA.slice(0, 200) || '(empty)'}`,
      explanation: `${MOCK} Whitespace-insensitive string comparison only; ${same ? 'identical' : 'different, materiality not assessed'}.`,
      uncertainties: [`${MOCK} No semantic comparison was performed.`],
      confidence: 'LOW',
    };
  },

  SAFETY_ANSWER: () => ({
    request_level: 'B',
    response_mode: 'ABSTAIN_INSUFFICIENT_EVIDENCE',
    answer: `${MOCK} Abstaining: mock mode does not answer safety prompts.`,
    cited_record_keys: [],
    referral: null,
    uncertainty: `${MOCK} No model was called.`,
  }),
};

export interface MockLookup {
  output: unknown;
  match: 'exact' | 'default';
}

export function lookupMock(
  task: AiTask,
  inputHash: string,
  input: unknown,
  extra: readonly MockEntry[] = [],
): MockLookup {
  const exact = [...extra, ...EXACT_MOCKS].find((m) => m.task === task && m.inputHash === inputHash);
  if (exact) return { output: exact.output, match: 'exact' };
  return { output: DEFAULTS[task](input), match: 'default' };
}
