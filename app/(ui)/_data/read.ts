import 'server-only';
import type { IncidentAggregate, IncidentListItem, SourceDetail, SourceSummary } from '@/lib/contracts';
import { getSourceDetail, listSources } from '@/lib/server/source-read';
import { getIncidentDetail, listIncidents } from '@/lib/analysis/read-incidents';

/**
 * UI read layer. Calls the same Codex-owned server functions that back
 * GET /api/sources, /api/sources/{id}, /api/incidents and /api/incidents/{id},
 * so pages render exactly what the public API returns.
 *
 * There is NO preview or fixture fallback: a failed read becomes an explicit error state.
 * Error details shown to users are generic; nothing from connection strings or stack traces leaks.
 */

export type ReadResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

async function attempt<T>(what: string, fn: () => Promise<T>): Promise<ReadResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    const name = err instanceof Error ? err.name : 'Error';
    // Log server-side for operators; never echo the raw message to the page.
    console.error(`[ui-read] ${what} failed: ${name}`);
    return {
      ok: false,
      error: {
        code: name === 'ZodError' ? 'CONTRACT_MISMATCH' : 'READ_FAILED',
        message:
          name === 'ZodError'
            ? `The ${what} response did not match the published contract.`
            : `The ${what} could not be read from the integrity database.`,
      },
    };
  }
}

export function readSources(): Promise<ReadResult<SourceSummary[]>> {
  return attempt('source list', () => listSources());
}

export function readSourceDetail(sourceId: string): Promise<ReadResult<SourceDetail | null>> {
  return attempt('source detail', () => getSourceDetail(sourceId));
}

export function readIncidents(): Promise<ReadResult<IncidentListItem[]>> {
  return attempt('incident list', () => listIncidents());
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readIncidentDetail(incidentId: string): Promise<ReadResult<IncidentAggregate | null>> {
  // Mirrors the API route: a non-UUID id is simply "not found", not a database error.
  if (!UUID.test(incidentId)) return Promise.resolve({ ok: true, data: null });
  return attempt('incident', () => getIncidentDetail(incidentId));
}

/**
 * The incident list contract has no version label or primary change, so each row is
 * enriched with its own aggregate (same contract as the detail page). Small N in this demo.
 */
export interface IncidentRow {
  item: IncidentListItem;
  detail: IncidentAggregate | null;
}

export async function readIncidentRows(): Promise<ReadResult<IncidentRow[]>> {
  const list = await readIncidents();
  if (!list.ok) return list;
  return attempt('incident list', async () =>
    Promise.all(list.data.map(async (item) => ({ item, detail: await getIncidentDetail(item.id) }))),
  );
}

/** Incidents keyed by candidate version, for cross-links from Source Detail. Failure is non-fatal there. */
export async function readIncidentIndex(): Promise<Map<string, IncidentListItem>> {
  const list = await readIncidents();
  return new Map(list.ok ? list.data.map((i) => [i.candidateVersionId, i]) : []);
}
