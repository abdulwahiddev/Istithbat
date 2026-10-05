import 'server-only';
import { z } from 'zod';
import { AuditPage, GatewayInventory, GatewayState, RegressionDetailResponse, type IncidentAggregate, type IncidentListItem, type SourceDetail, type SourceSummary } from '@/lib/contracts';
import { getGatewayInventory, getGatewayState } from '@/lib/gateway/read';
import { getAuditPage } from '@/lib/governance/read-audit';
import { getSourceDetail, listSources } from '@/lib/server/source-read';
import { getIncidentDetail, listIncidents } from '@/lib/analysis/read-incidents';
import { GET as regressionsRoute } from '@/app/api/incidents/[incidentId]/regressions/route';

/**
 * UI read layer. Calls the same Codex-owned server functions that back the public API, so pages
 * render exactly what /api returns. There is no fixture fallback: a failed read is an explicit
 * error state. Error text shown to users is generic; nothing from connection strings leaks.
 *
 * Reads are serialised: the shared server client is a single pooled connection, and interleaving
 * many reads from concurrent renders on it has produced mixed or stalled results (see HANDOFF).
 */

export type ReadResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

let queue: Promise<unknown> = Promise.resolve();
const READ_TIMEOUT_MS = 20_000;

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('read timed out'), { name: 'TimeoutError' })), READ_TIMEOUT_MS);
    });
    return Promise.race([fn(), timeout]).finally(() => clearTimeout(timer));
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function attempt<T>(what: string, fn: () => Promise<T>): Promise<ReadResult<T>> {
  try {
    return { ok: true, data: await serial(fn) };
  } catch (err) {
    const name = err instanceof Error ? err.name : 'Error';
    console.error(`[ui-read] ${what} failed: ${name}`);
    return {
      ok: false,
      error: {
        code: name === 'ZodError' ? 'CONTRACT_MISMATCH' : name === 'TimeoutError' ? 'READ_TIMEOUT' : 'READ_FAILED',
        message: name === 'ZodError' ? `The ${what} did not match the published contract.` : `The ${what} could not be read from the integrity database.`,
      },
    };
  }
}

export const readSources = (): Promise<ReadResult<SourceSummary[]>> => attempt('source list', () => listSources());
export const readSourceDetail = (sourceId: string): Promise<ReadResult<SourceDetail | null>> => attempt('source detail', () => getSourceDetail(sourceId));
export const readIncidents = (): Promise<ReadResult<IncidentListItem[]>> => attempt('incident list', () => listIncidents());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isIncidentId = (id: string) => UUID.test(id);

export function readIncidentDetail(incidentId: string): Promise<ReadResult<IncidentAggregate | null>> {
  // Mirrors the API route: a non-UUID id is simply "not found", not a database error.
  if (!isIncidentId(incidentId)) return Promise.resolve({ ok: true, data: null });
  return attempt('incident', () => getIncidentDetail(incidentId));
}

export type RegressionDetailT = z.infer<typeof RegressionDetailResponse>['regressions'][number];

/** GET /api/incidents/{id}/regressions — full persisted Q&A and the typed BEHAVIOR_DELTA, through the route's own handler. */
export function readRegressions(incidentId: string): Promise<ReadResult<RegressionDetailT[]>> {
  if (!isIncidentId(incidentId)) return Promise.resolve({ ok: true, data: [] });
  return attempt('regression detail', async () => {
    const res = await regressionsRoute(new Request('http://internal/') as never, { params: Promise.resolve({ incidentId }) });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`regressions ${res.status}`);
    return RegressionDetailResponse.parse(await res.json()).regressions;
  });
}

export type GatewayItem = z.infer<typeof GatewayInventory>['items'][number];
export type GatewayStateT = z.infer<typeof GatewayState>;
export type AuditPageT = z.infer<typeof AuditPage>;

/** GET /api/gateway — bound and unbound source states, with held candidates. */
export const readGatewayInventory = (): Promise<ReadResult<GatewayItem[]>> =>
  attempt('gateway inventory', async () => GatewayInventory.parse(await getGatewayInventory()).items);

/** GET /api/gateway/{appId}/sources/{sourceId} — one binding in detail; null when it does not exist. */
export const readGatewayState = (appId: string, sourceId: string): Promise<ReadResult<GatewayStateT | null>> =>
  attempt('gateway binding', async () => { const s = await getGatewayState(appId, sourceId); return s ? GatewayState.parse(s) : null; });

/** GET /api/audit — persisted append-only events, newest first, paged by cursor. */
export function readAudit(q: { incidentId?: string; before?: string; limit?: number } = {}): Promise<ReadResult<AuditPageT>> {
  if (q.incidentId && !isIncidentId(q.incidentId)) return Promise.resolve({ ok: true, data: { events: [], nextCursor: null } });
  return attempt('record', async () => AuditPage.parse(await getAuditPage({ incidentId: q.incidentId, before: q.before, limit: Math.min(100, Math.max(1, q.limit ?? 25)) })));
}
