import type { IncidentAggregate } from '@/lib/contracts';
import { valueText, wordDiff } from './diff';
import { changeHeadline } from './semantics';

/** Facts about an incident that several screens state the same way. Pure. */
export type AnalysisOut = {
  analysis_type?: string; risk_level?: string; executive_summary?: string; what_changed?: string; why_it_matters?: string;
  domain_analysis?: { linguistic?: string; evidence_scope?: string; provenance_effect?: string };
  uncertainties?: string[]; recommended_action?: string; requires_specialist_review?: boolean; confidence?: string; meaning_changed?: boolean;
};

export function primaryChange(inc: IncidentAggregate) {
  return inc.changes.find((c) => c.id === inc.primaryChangeId) ?? inc.changes[0] ?? null;
}

export function incidentFacts(inc: IncidentAggregate) {
  const primary = primaryChange(inc);
  const oldV = valueText(primary?.oldValue), newV = valueText(primary?.newValue);
  const diff = oldV != null && newV != null ? wordDiff(oldV, newV) : null;
  const out = (inc.analysis?.output ?? null) as AnalysisOut | null;
  const regs = inc.regressions;
  const material = regs.filter((r) => r.result === 'MATERIAL_CHANGE').length;
  const br = inc.blastRadius ?? null;
  return {
    primary, oldV, newV, diff,
    headline: changeHeadline(primary?.fieldRole, primary?.changeType, diff),
    recordKey: primary?.canonicalKey ?? inc.sourceId,
    candidate: `${inc.candidateVersion.upstreamLabel}`,
    candidateRev: inc.candidateVersion.revisionNumber,
    previous: inc.previousVersion?.upstreamLabel ?? null,
    analysis: out, analysisMode: inc.analysis?.meta.mode ?? null,
    regressionCount: regs.length, materialCount: material,
    counts: br?.counts ?? null, downstream: br ? br.nodes.filter((n) => n.assetType !== 'SOURCE' && n.assetType !== 'RECORD').length : null,
    policyCode: inc.policyEvaluation?.policyCode ?? null, policyAction: inc.policyEvaluation?.action ?? inc.effectivePolicyAction ?? null,
    decided: inc.reviews.at(-1) ?? null,
  };
}

export const modeLabel = (mode: string | null | undefined) =>
  mode === 'replay' ? 'Replayed response' : mode === 'mock' ? 'Mock response' : mode === 'live' ? 'Live response' : 'Not yet analysed';
