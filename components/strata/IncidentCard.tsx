import Link from 'next/link';
import type { IncidentListItem } from '@/lib/contracts';
import { InlineDiff } from './arabic';
import { dayTime } from './format';
import { modeLabel, type IncidentSummary } from './incident-model';
import { isArabic } from './diff';
import { Chip, type Tone } from './primitives';
import { incidentSem } from './semantics';
import { Tx } from './i18n/client';

/** One open incident as a link card (Overview "Incidents" row; also the /incidents list). */
export function IncidentCard({ item, summary: f }: { item: IncidentListItem; summary: IncidentSummary | null }) {
  const sem = incidentSem(item);
  return (
    <Link className="plate inc" href={`/incidents/${item.id}`}>
      <div className="sub" style={{ alignItems: 'center', rowGap: 16 }}>
        <div className="c1-6" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <span className="mono" style={{ fontSize: 14 }}>{item.primaryChange?.canonicalKey ?? item.sourceId}</span>
            <Chip tone={sem.tone as Tone} small ink><Tx>{sem.text}</Tx></Chip>
            {item.riskLevel && <span className="chip" style={{ padding: '1px 9px 1px 7px', fontSize: 12, borderStyle: 'dashed', borderColor: 'var(--pu-line)', color: 'var(--pu-ink)' }}><Tx>{`Risk ${item.riskLevel.toLowerCase()} · advisory`}</Tx></span>}
          </span>
          <b style={{ fontSize: 20, lineHeight: '28px', fontWeight: 600 }}>{f ? <Tx>{f.headline.replace(/\.$/, '')}</Tx> : item.title}</b>
          {f?.diff && <InlineDiff oldSegs={f.diff.old} newSegs={f.diff.new} arabic={isArabic(f.diff.old.map((x) => x.text).join(' '))} />}
        </div>
        <div className="c7-10">
          <div className="kv"><span><Tx>Held by</Tx></span>{f?.policyCode ? <span className="mono">{f.policyCode}</span> : <span>{item.pipelineStatus === 'RUNNING' ? <Tx>Policy pending</Tx> : '—'}</span>}</div>
          <div className="kv"><span><Tx>Opened</Tx></span><span dir="ltr">{dayTime(item.openedAt)}</span></div>
          <div className="kv"><span><Tx>Analysis</Tx></span><span><Tx>{modeLabel(item.analysisMode)}</Tx></span></div>
          <div className="kv"><span><Tx>Silent mutation</Tx></span><span><Tx>{item.silentMutation ? 'Yes' : 'No'}</Tx></span></div>
        </div>
      </div>
      <span className="go-row"><Tx>Open the review</Tx> <span aria-hidden="true" className="flip-rtl">→</span></span>
    </Link>
  );
}

