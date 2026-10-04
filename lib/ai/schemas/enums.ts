import { z } from 'zod';

// Domain enums copied verbatim from Bible Appendix A.
// TEMPORARY HOME: once Codex publishes these in lib/contracts, this file should
// re-export them from there instead of defining them (one source of truth).

export const RiskLevel = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const AnalysisType = z.enum([
  'SEMANTIC_DRIFT',
  'EVIDENCE_DRIFT',
  'TRANSLATION_DRIFT',
  'PROVENANCE_DRIFT',
  'METADATA_CHANGE',
  'CANONICAL_TEXT_CHANGE',
  'MIXED_CHANGE',
]);
export type AnalysisType = z.infer<typeof AnalysisType>;

export const RecommendedAction = z.enum(['ALLOW', 'REVIEW', 'QUARANTINE', 'ESCALATE']);
export type RecommendedAction = z.infer<typeof RecommendedAction>;

/** RegressionResult minus FAILED: FAILED is a pipeline outcome, never a model judgement. */
export const ModelRegressionResult = z.enum([
  'NO_CHANGE',
  'NON_MATERIAL_CHANGE',
  'MATERIAL_CHANGE',
  'INCONCLUSIVE',
]);
export type ModelRegressionResult = z.infer<typeof ModelRegressionResult>;

export const ContentLevel = z.enum(['A', 'B', 'C', 'D']);
export type ContentLevel = z.infer<typeof ContentLevel>;

/** Context element kinds (Bible §7 Context Builder). Every element in a context packet carries one. */
export const ContextElementKind = z.enum([
  'AUTHORITATIVE_TEXT',
  'SCHOLAR_JUDGMENT',
  'PROVENANCE',
  'TRANSLATION',
  'COMMENTARY',
  'SURROUNDING_CONTEXT',
  'OPERATIONAL_METADATA',
  'SYNTHETIC_MUTATION',
]);
export type ContextElementKind = z.infer<typeof ContextElementKind>;

/** Verbal confidence band. The design system never shows a lone number or "certain". */
export const Confidence = z.enum(['LOW', 'MODERATE', 'HIGH']);
export type Confidence = z.infer<typeof Confidence>;
