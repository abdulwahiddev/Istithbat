import Link from 'next/link';
import type { IncidentAggregate, IncidentListItem } from '@/lib/contracts';
import { InlineDiff } from './arabic';
import { dayTime } from './format';
import { incidentFacts, modeLabel } from './incident-model';
import { Chip, type Tone } from './primitives';
import { incidentSem } from './semantics';

/** One open incident as a link card (Overview "Incidents" row; also the /incidents list). */
export function IncidentCard({ item, detail }: { item: IncidentListItem; detail: IncidentAggregate | null }) {
  const f = detail ? incidentFacts(detail) : null;
  const sem = incidentSem(item);
  return (
    <Link className="plate inc" href={`/incidents/${item.id}`}>
      <div className="sub" style={{ alignItems: 'center', rowGap: 16 }}>
        <div className="c1-6" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <span className="mono" style={{ fontSize: 14 }}>{item.primaryChange?.canonicalKey ?? item.sourceId}</span>
            <Chip tone={sem.tone as Tone} small ink>{sem.text}</Chip>
            {item.riskLevel && <span className="chip" style={{ padding: '1px 9px 1px 7px', fontSize: 12, borderStyle: 'dashed', borderColor: 'var(--pu-line)', color: 'var(--pu-ink)' }}>Risk {item.riskLevel.toLowerCase()} · advisory</span>}
          </span>
          <b style={{ fontSize: 20, lineHeight: '28px', fontWeight: 600 }}>{f ? f.headline.replace(/\.$/, '') : item.title}</b>
          {f?.diff && <InlineDiff oldSegs={f.diff.old} newSegs={f.diff.new} />}
        </div>
        <div className="c7-10">
          <div className="kv"><span>Held by</span>{f?.policyCode ? <span className="mono">{f.policyCode}</span> : <span>{item.pipelineStatus === 'RUNNING' ? 'Policy pending' : '—'}</span>}</div>
          <div className="kv"><span>Opened</span><span>{dayTime(item.openedAt)}</span></div>
          <div className="kv"><span>Analysis</span><span>{modeLabel(item.analysisMode)}</span></div>
          <div className="kv"><span>Silent mutation</span><span>{item.silentMutation ? 'Yes' : 'No'}</span></div>
        </div>
      </div>
      <span className="go-row">Open the review <span aria-hidden="true">→</span></span>
    </Link>
  );
}

