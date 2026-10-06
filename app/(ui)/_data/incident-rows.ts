import type { IncidentListItem } from '@/lib/contracts';
import type { IncidentRow } from '@/components/strata/IncidentList';
import type { IncidentSummary } from '@/components/strata/incident-model';
import { dayTime } from '@/components/strata/format';
import { incidentSem, needsDecision } from '@/components/strata/semantics';

/** One row per incident, from the persisted list (and the light summary for the newest open ones). */
export function incidentRow(i: IncidentListItem, f: IncidentSummary | null, sourceName: string): IncidentRow {
  const group = i.status === 'RESOLVED' ? 'resolved' : needsDecision(i) ? 'decide' : 'investigating';
  const sem = incidentSem(i);
  return {
    id: i.id, href: `/incidents/${i.id}`, recordKey: i.primaryChange?.canonicalKey ?? i.sourceId, candidate: i.candidateLabel,
    sourceId: i.sourceId, sourceName, headline: (f?.headline ?? i.title).replace(/\.$/, ''), group, stateText: sem.text,
    mark: group === 'resolved' ? 'neutral' : i.status === 'QUARANTINED' ? 'impacted' : 'exposed',
    policyCode: f?.policyCode ?? null, openedAt: i.openedAt, openedText: dayTime(i.openedAt), risk: i.riskLevel,
  };
}

