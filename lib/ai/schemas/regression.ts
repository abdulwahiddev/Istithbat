import { z } from 'zod';
import { Confidence, ContentLevel, ModelRegressionResult } from './enums';

// ---------- REGRESSION_QUESTIONS ----------
/**
 * Generated questions only. The caller (Packet 04) puts pinned questions first and
 * fills up to 3 with these (D-16); lib/ai never decides the final set.
 */
export const RegressionQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1),
        /** Field path the question probes, e.g. "judgment". */
        targets_field: z.string().min(1),
        rationale: z.string().min(1),
      }),
    )
    .min(1)
    .max(3),
});
export type RegressionQuestions = z.infer<typeof RegressionQuestionsSchema>;

// ---------- QA_ANSWER (protected app, one knowledge version) ----------
export const QaAnswerSchema = z.object({
  answer: z.string().min(1),
  /** canonical_keys of retrieved records the answer relies on. Must be a subset of the input's retrieved records. */
  cited_record_keys: z.array(z.string()),
  abstained: z.boolean(),
  abstention_reason: z.string().nullable(),
  uncertainty: z.string().min(1),
});
export type QaAnswer = z.infer<typeof QaAnswerSchema>;

// ---------- BEHAVIOR_DELTA (old vs new answer under identical configuration) ----------
/** Kinds of material change from the Bible §8 definition. */
export const DeltaType = z.enum([
  'SCOPE_BROADENING',
  'SCOPE_NARROWING',
  'MEANING_CHANGE',
  'ATTRIBUTION_CHANGE',
  'EVIDENCE_STRENGTH_CHANGE',
  'CERTAINTY_CHANGE',
  'TRANSLATION_MEANING_CHANGE',
  'CITATION_CHANGE',
  'CONCLUSION_CHANGE',
  'CONDITION_OMITTED',
  'CONDITION_ADDED',
  'STYLISTIC_ONLY',
]);
export type DeltaType = z.infer<typeof DeltaType>;

export const BehaviorDeltaSchema = z.object({
  result: ModelRegressionResult,
  material_change: z.boolean(),
  delta_types: z.array(DeltaType),
  old_answer_claim: z.string().min(1),
  new_answer_claim: z.string().min(1),
  explanation: z.string().min(1),
  uncertainties: z.array(z.string()),
  confidence: Confidence,
});
export type BehaviorDelta = z.infer<typeof BehaviorDeltaSchema>;

// ---------- SAFETY_ANSWER (safety suite / protected app boundary behaviour) ----------
export const SafetyResponseMode = z.enum([
  'ANSWER_WITH_SOURCES',
  'ANSWER_WITH_UNCERTAINTY',
  'CORRECT_PREMISE',
  'ABSTAIN_INSUFFICIENT_EVIDENCE',
  'REFER_TO_QUALIFIED_AUTHORITY',
]);
export type SafetyResponseMode = z.infer<typeof SafetyResponseMode>;

export const SafetyAnswerSchema = z.object({
  /** Level of the USER REQUEST (D-03): D = personalised fatwa / individual case. */
  request_level: ContentLevel,
  response_mode: SafetyResponseMode,
  answer: z.string().min(1),
  cited_record_keys: z.array(z.string()),
  referral: z.string().nullable(),
  uncertainty: z.string().min(1),
});
export type SafetyAnswer = z.infer<typeof SafetyAnswerSchema>;
