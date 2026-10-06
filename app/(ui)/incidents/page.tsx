import { IncidentList } from '@/components/strata/IncidentList';
import type { IncidentSummary } from '@/components/strata/incident-model';
import { Band, Chip, Dk, HeadRow, PageHeader, Rail, ReadError, Sep } from '@/components/strata/primitives';
import { needsDecision } from '@/components/strata/semantics';
import { summarizeIncident } from '../_data/incident-summary';
import { incidentRow } from '../_data/incident-rows';
import { readIncidents, readShell, readSources } from '../_data/read';

export const metadata = { title: 'Incidents · Istithbat' };
export const dynamic = 'force-dynamic';

/** Summaries cost two reads each; past this many open incidents, rows fall back to the stored title. */
const SUMMARIZE = 8;

export default async function IncidentsPage() {
  await readShell();
  const list = await readIncidents();
  const sources = await readSources();
  const nameOf = new Map((sources.ok ? sources.data : []).map((s) => [s.id, s.name.split(' — ')[0]]));
  const items = list.ok ? [...list.data].sort((a, b) => b.openedAt.localeCompare(a.openedAt)) : [];
  const open = items.filter((i) => i.status !== 'RESOLVED');
  const resolved = items.filter((i) => i.status === 'RESOLVED');
  const summaries = new Map<string, IncidentSummary>();
  for (const i of open.slice(0, SUMMARIZE)) summaries.set(i.id, await summarizeIncident(i));
  const deciding = open.filter(needsDecision).length;
  const rows = items.map((i) => incidentRow(i, summaries.get(i.id) ?? null, nameOf.get(i.sourceId) ?? i.sourceId));
  return (
    <main id="main" className="scr-overview">
      <PageHeader
        crumbs={<><span>Incidents</span><Sep /><span>{items.length} recorded</span></>}
        title={open.length ? <>{open.length} open {open.length === 1 ? 'incident' : 'incidents'}.<br />{deciding ? `${deciding} ${deciding === 1 ? 'needs' : 'need'} a decision.` : 'Still investigating.'}</> : <>No open incidents.<br />Nothing is held.</>}
        lede="One incident opens per meaningful source-version transition. Equivalent and metadata-only changes take the deterministic fast path and never appear here."
        status={<>
          <Dk k="Open">{open.length ? <Chip tone="co">{open.length}</Chip> : <Chip tone="tq">None</Chip>}</Dk>
          <Dk k="Needs a decision">{deciding}</Dk>
          <Dk k="Resolved">{resolved.length}</Dk>
        </>}
      />
      <Band id="open" labelledBy="h-open" first>
        <Rail layer="det" id="h-open" title="Incidents">Grouped by what a reviewer must do; newest first.</Rail>
        <div className="main">
          <HeadRow title={`All incidents · ${items.length}`} right={<span className="meta mono">/api/incidents</span>} />
          {!list.ok ? <ReadError {...list.error} /> : <IncidentList rows={rows} />}
        </div>
      </Band>
      <div style={{ height: 120 }} />
    </main>
  );
}
