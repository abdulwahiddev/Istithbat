import { AutoRefresh } from '@/components/strata/AutoRefresh';
import type { IncidentAggregate } from '@/lib/contracts';
import { IncidentCard } from '@/components/strata/IncidentCard';
import { word } from '@/components/strata/format';
import { Band, Chip, Dk, HeadRow, PageHeader, Rail, ReadError, Sep } from '@/components/strata/primitives';
import { needsDecision } from '@/components/strata/semantics';
import { readIncidentDetail, readIncidents } from '../_data/read';

export const metadata = { title: 'Incidents · Istithbat' };
export const dynamic = 'force-dynamic';

/** The incident list has no dedicated board: Strata tokens and the Overview "Incidents" row pattern (handoff §2). */
export default async function IncidentsPage() {
  const list = await readIncidents();
  const items = list.ok ? [...list.data].sort((a, b) => b.openedAt.localeCompare(a.openedAt)) : [];
  const open = items.filter((i) => i.status !== 'RESOLVED');
  const resolved = items.filter((i) => i.status === 'RESOLVED');
  const details = new Map<string, IncidentAggregate>();
  for (const i of open.slice(0, 6)) { const d = await readIncidentDetail(i.id); if (d.ok && d.data) details.set(i.id, d.data); }
  const deciding = open.filter(needsDecision).length;
  return (
    <main id="main" className="scr-overview">
      <AutoRefresh active={open.some((i) => i.pipelineStatus === 'RUNNING')} />
      <PageHeader
        crumbs={<><span>Incidents</span><Sep /><span>{items.length} recorded</span></>}
        title={open.length ? <>{word(open.length)} open {open.length === 1 ? 'incident' : 'incidents'}.<br />{deciding ? `${word(deciding)} ${deciding === 1 ? 'needs' : 'need'} a decision.` : 'Still investigating.'}</> : <>No open incidents.<br />Nothing is held.</>}
        lede="One incident opens per meaningful source-version transition. Equivalent and metadata-only changes take the deterministic fast path and never appear here."
        status={<>
          <Dk k="Open">{open.length ? <Chip tone="co">{open.length}</Chip> : <Chip tone="tq">None</Chip>}</Dk>
          <Dk k="Needs a decision">{deciding}</Dk>
          <Dk k="Resolved">{resolved.length}</Dk>
        </>}
      />
      <Band id="open" labelledBy="h-open" first>
        <Rail layer="det" id="h-open" title="Open">Cases that need a decision, newest first.</Rail>
        <div className="main">
          <HeadRow title={open.length ? `${open.length} open` : 'None open'} right={<span className="meta mono">/api/incidents</span>} />
          {!list.ok ? <ReadError {...list.error} /> : open.length === 0
            ? <div className="plate" style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Chip tone="tq">Nothing open</Chip><span className="body" style={{ color: 'var(--ink-3)' }}>An incident opens when a source version changes a substantive field.</span></div>
            : open.map((i) => <IncidentCard key={i.id} item={i} detail={details.get(i.id) ?? null} />)}
        </div>
      </Band>
      {resolved.length > 0 && (
        <Band id="resolved" labelledBy="h-res">
          <Rail layer="hum" id="h-res" title="Resolved">Decided cases. Their record stays append-only.</Rail>
          <div className="main">
            <HeadRow title={`${resolved.length} resolved`} />
            {resolved.map((i) => <IncidentCard key={i.id} item={i} detail={null} />)}
          </div>
        </Band>
      )}
      <div style={{ height: 120 }} />
    </main>
  );
}
