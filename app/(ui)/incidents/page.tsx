import { IncidentList } from '@/components/strata/IncidentList';
import type { IncidentSummary } from '@/components/strata/incident-model';
import { Band, Chip, Dk, HeadRow, PageHeader, Rail, ReadError, Sep } from '@/components/strata/primitives';
import { needsDecision } from '@/components/strata/semantics';
import { summarizeIncident } from '../_data/incident-summary';
import { incidentRow } from '../_data/incident-rows';
import { readIncidents, readShell, readSources } from '../_data/read';
import { getT } from '../_data/session';

export const metadata = { title: 'Incidents · Istithbat' };
export const dynamic = 'force-dynamic';

/** Summaries cost two reads each; past this many open incidents, rows fall back to the stored title. */
const SUMMARIZE = 8;

export default async function IncidentsPage() {
  await readShell();
  const t = await getT();
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
        crumbs={<><span>{t('Incidents')}</span><Sep /><span>{t('{n} recorded', { n: items.length })}</span></>}
        title={open.length ? <>{t(open.length === 1 ? '1 open incident.' : '{n} open incidents.', { n: open.length })}<br />{deciding ? t(deciding === 1 ? '1 needs a decision.' : '{n} need a decision.', { n: deciding }) : t('Still investigating.')}</> : <>{t('No open incidents.')}<br />{t('Nothing is held.')}</>}
        lede={t('One incident opens per meaningful source-version transition. Equivalent and metadata-only changes take the deterministic fast path and never appear here.')}
        status={<>
          <Dk k={t('Open')}>{open.length ? <Chip tone="co">{open.length}</Chip> : <Chip tone="tq">{t('None')}</Chip>}</Dk>
          <Dk k={t('Needs a decision')}>{deciding}</Dk>
          <Dk k={t('Resolved')}>{resolved.length}</Dk>
        </>}
      />
      <Band id="open" labelledBy="h-open" first>
        <Rail layer="det" id="h-open" title="Incidents">{t('Grouped by what a reviewer must do; newest first.')}</Rail>
        <div className="main">
          <HeadRow title={t('All incidents · {n}', { n: items.length })} right={<span className="meta mono">/api/incidents</span>} />
          {!list.ok ? <ReadError {...list.error} /> : <IncidentList rows={rows} />}
        </div>
      </Band>
      <div style={{ height: 120 }} />
    </main>
  );
}
