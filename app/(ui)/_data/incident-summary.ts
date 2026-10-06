import 'server-only';
import type { IncidentListItem } from '@/lib/contracts';
import { valueText, wordDiff } from '@/components/strata/diff';
import { changeHeadline } from '@/components/strata/semantics';
import type { IncidentSummary } from '@/components/strata/incident-model';
import { readAudit, readSourceDetail } from './read';

/**
 * A light incident summary for Overview and the incident list, built from persisted reads that are
 * far cheaper than the full aggregate: the incident-scoped audit page (policy code, blast counts,
 * regression results) and the source detail (the primary change's exact values).
 */
export async function summarizeIncident(item: IncidentListItem): Promise<IncidentSummary> {
  const audit = await readAudit({ incidentId: item.id, limit: 100 });
  const src = await readSourceDetail(item.sourceId);
  const events = audit.ok ? audit.data.events : [];
  const meta = (t: string) => events.find((e) => e.eventType === t)?.metadata as Record<string, unknown> | undefined;
  const created = meta('INCIDENT_CREATED');
  const changes = src.ok && src.data ? src.data.changes.filter((c) => c.toVersionId === item.candidateVersionId) : [];
  const primary = changes.find((c) => c.id === created?.primaryChangeId) ?? changes[0] ?? null;
  const oldV = valueText(primary?.oldValue), newV = valueText(primary?.newValue);
  const diff = oldV != null && newV != null ? wordDiff(oldV, newV) : null;
  const regs = events.filter((e) => e.eventType === 'REGRESSION_COMPARISON_COMPLETED').map((e) => String((e.metadata as Record<string, unknown>).result ?? ''));
  const blast = [...events].reverse().find((e) => e.eventType === 'BLAST_RADIUS_COMPUTED')?.metadata as { counts?: { exposed: number; stale: number; impacted: number } } | undefined;
  const policy = meta('POLICY_EVALUATED');
  return {
    item, diff, recordKey: item.primaryChange?.canonicalKey ?? item.sourceId,
    headline: changeHeadline(primary?.fieldRole ?? item.primaryChange?.fieldRole, primary?.changeType, diff),
    fieldPath: primary?.fieldPath ?? item.primaryChange?.fieldPath ?? null, changeCount: item.changeCount,
    policyCode: typeof policy?.policyCode === 'string' ? policy.policyCode : null,
    policyAction: typeof policy?.action === 'string' ? policy.action : null,
    regressionCount: regs.length, materialCount: regs.filter((r) => r === 'MATERIAL_CHANGE').length,
    counts: blast?.counts ?? null,
    analysed: events.some((e) => e.eventType === 'ANALYSIS_SUCCEEDED'),
    decided: events.some((e) => e.eventType === 'REVIEW_DECISION'),
    contentLevel: src.ok && src.data ? src.data.source.contentLevel : null,
    sourceTitle: src.ok && src.data ? src.data.source.name.split(' — ')[0] : item.sourceId,
    substantive: changes.length ? !changes.every((c) => c.flags.some((x) => x === 'WHITESPACE_ONLY' || x === 'UNICODE_EQUIVALENT')) : true,
  };
}
