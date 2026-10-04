import { z } from 'zod';
import { AnalysisType, Confidence, RecommendedAction, RiskLevel } from './enums';

/**
 * INCIDENT_ANALYSIS output: the Bible §7 structured contract, field for field.
 * Advisory only — it can raise a policy action, never lower one, and never decides a trigger (D-12).
 */
export const IncidentAnalysisSchema = z.object({
  analysis_type: AnalysisType,
  risk_level: RiskLevel,
  executive_summary: z.string().min(1),
  what_changed: z.string().min(1),
  why_it_matters: z.string().min(1),
  domain_analysis: z.object({
    linguistic: z.string(),
    evidence_scope: z.string(),
    provenance_effect: z.string(),
  }),
  potential_downstream_effects: z.array(z.string()),
  recommended_regression_tests: z.array(z.string()),
  /** At least one: the analysis must always state what it cannot know. */
  uncertainties: z.array(z.string().min(1)).min(1),
  recommended_action: RecommendedAction,
  requires_specialist_review: z.boolean(),
  confidence: Confidence,
  /**
   * Additive (§12 advisory fact `meaning_changed`): does the change alter religious meaning,
   * scope, attribution, evidence strength, certainty or an important condition?
   */
  meaning_changed: z.boolean(),
});
export type IncidentAnalysis = z.infer<typeof IncidentAnalysisSchema>;
