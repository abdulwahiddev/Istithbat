import 'server-only';
import type { IncidentListItem, SourceSummary } from '@/lib/contracts';
import type { ChromeData } from '@/components/strata/Chrome';
import { leadIncident, needsDecision } from '@/components/strata/semantics';
import type { GatewayItem, ReadResult } from './read';
import { versionText } from '@/components/strata/format';

/** Chrome facts from the incident list, sources and bindings. Served state always comes from the gateway binding. */
export function chromeData(incidents: ReadResult<IncidentListItem[]>, sources: ReadResult<SourceSummary[]>, gateway: ReadResult<GatewayItem[]>, reviewer: { name: string } | null): ChromeData {
  const list = incidents.ok ? incidents.data : [];
  const bindingList = (gateway.ok ? gateway.data : []).filter((g) => g.binding && g.appId);
  const sourceById = new Map((sources.ok ? sources.data : []).map((s) => [s.id, s]));
  const lead = leadIncident(list);
  const open = list.filter((i) => i.status !== 'RESOLVED').sort((a, b) => (a === lead ? -1 : b === lead ? 1 : b.openedAt.localeCompare(a.openedAt)));
  const servedFor = (sourceId: string) => {
    const b = bindingList.find((x) => x.sourceId === sourceId);
    const s = sourceById.get(sourceId);
    return {
      trusted: b?.latestTrusted ? versionText(b.latestTrusted.label, b.latestTrusted.revisionNumber, 'label') : s?.trustedLabel ? versionText(s.trustedLabel, s.trustedRevision, 'label') : null,
      served: b?.served ? versionText(b.served.label, b.served.revisionNumber, 'label') : null,
    };
  };
  const firstBinding = bindingList[0];
  return {
    incidents: open.map((i) => ({
      id: i.id, recordKey: i.primaryChange?.canonicalKey ?? i.sourceId, candidateLabel: versionText(i.candidateLabel, i.candidateRevision, 'label'),
      trustedLabel: servedFor(i.sourceId).trusted, servedLabel: servedFor(i.sourceId).served, status: i.status, needsDecision: needsDecision(i),
    })),
    decisionCount: list.filter(needsDecision).length,
    served: firstBinding ? { appName: firstBinding.appName ?? firstBinding.appId!, trustedLabel: firstBinding.latestTrusted ? versionText(firstBinding.latestTrusted.label, firstBinding.latestTrusted.revisionNumber, 'label') : null, servedLabel: firstBinding.served ? versionText(firstBinding.served.label, firstBinding.served.revisionNumber, 'label') : null } : null,
    gatewayHref: firstBinding ? `/gateway/${encodeURIComponent(firstBinding.appId!)}` : '/gateway',
    reviewer,
    // Only whether sign-in can work here; the credential itself never leaves the server.
    reviewAvailable: Boolean(process.env.DEMO_REVIEW_SECRET),
  };
}
