import 'server-only';
import { versionText } from '@/components/strata/format';
import type { SourceDetail, SourceSummary } from '@/lib/contracts';
import { connectorFacts, type ConnectorFacts } from './connectors';
import type { GatewayItem } from './read';

/**
 * Per-source facts behind the lineage instrument, the ledger and the detail panel, from
 * GET /api/sources (summary, revisions, monitored count) and GET /api/gateway (latest seen,
 * trusted, served and any held candidate). Optional SourceDetail adds fingerprints and checks.
 *
 * Rules (handoff §11): served comes from the gateway binding, never inferred from trusted;
 * a trusted source without a binding is "Trusted, not served", never "not trusted".
 */
export type V = { id: string; label: string; revision: number; status: string; detectedAt: string };
export type SourceState = 'held' | 'investigating' | 'rejected' | 'agreement' | 'no-baseline';
export type SourceModel = {
  summary: SourceSummary;
  facts: ConnectorFacts;
  latest: V | null;
  trusted: V | null;
  served: V | null;
  appId: string | null;
  appName: string | null;
  bindingUpdatedAt: string | null;
  bound: boolean;
  held: { incidentId: string; incidentStatus: string; policyAction: string | null } | null;
  state: SourceState;
  changed: boolean;
  recordCount: number | null;
};

const v = (x: GatewayItem['latestSeen']): V | null => (x ? { id: x.id, label: x.label, revision: x.revisionNumber, status: x.status, detectedAt: x.detectedAt } : null);

export function sourceModel(summary: SourceSummary, gateway: GatewayItem[], detail?: SourceDetail | null): SourceModel {
  const facts = connectorFacts(summary);
  const rows = gateway.filter((g) => g.sourceId === summary.id);
  const g = rows.find((r) => r.binding) ?? rows[0] ?? null;
  const latest = v(g?.latestSeen ?? null), trusted = v(g?.latestTrusted ?? null);
  const bound = !!g?.binding && !!g.appId;
  const changed = !!latest && !!trusted && latest.id !== trusted.id;
  const held = g?.heldCandidate ? { incidentId: g.heldCandidate.incidentId, incidentStatus: g.heldCandidate.incidentStatus, policyAction: g.heldCandidate.policyAction } : null;
  const state: SourceState = !trusted ? 'no-baseline'
    : held ? (held.incidentStatus === 'ANALYZING' ? 'investigating' : 'held')
    : changed && latest!.status === 'REJECTED' ? 'rejected'
    : changed ? 'investigating'
    : 'agreement';
  if (detail && !facts.real) {
    const keys = [...new Set(detail.changes.map((c) => c.canonicalKey))];
    if (keys.length) facts.keys = keys.join(', ');
  }
  return {
    summary, facts, latest, trusted, served: bound ? v(g!.served) : null, appId: bound ? g!.appId : null, appName: bound ? g!.appName : null,
    bindingUpdatedAt: g?.binding?.updatedAt ?? null, bound, held, state, changed,
    recordCount: summary.monitoredRecordCount ?? null,
  };
}

/** "v14 · r1" */
/** Lineage label: provider label · rN, or rN alone when the provider publishes no label. */
export const vr = (x: { label: string; revision: number } | null | undefined) => (x ? versionText(x.label, x.revision) : null);
/** Compact label (badges, sentences): the provider label, or rN when the provider publishes none. */
export const vl = (x: { label: string; revision: number } | null | undefined) => (x ? versionText(x.label, x.revision, 'label') : '—');
