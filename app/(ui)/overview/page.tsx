import { AutoRefresh } from '@/components/strata/AutoRefresh';
import Link from 'next/link';
import type { IncidentAggregate } from '@/lib/contracts';
type PipelineStepState = IncidentAggregate['pipelineSteps'][number];
import { FOLDED, LANE_MARK, narrate } from '@/components/strata/events';
import { evTime, word } from '@/components/strata/format';
import type { IncidentSummary } from '@/components/strata/incident-model';
import { summarizeIncident } from '../_data/incident-summary';
import { Band, Chip, Dk, Ev, HandedToYou, HeadRow, HeldBy, Lnk, Mk, Mono, PageHeader, Rail, ReadError, Sep, SummaryDock } from '@/components/strata/primitives';
import { leadIncident, needsDecision } from '@/components/strata/semantics';
import { IncidentCard } from '@/components/strata/IncidentCard';
import { readAudit, readGatewayInventory, readIncidents, readSources } from '../_data/read';
import { sourceModel, vr, type SourceModel } from '../_data/source-model';

export const metadata = { title: 'Overview · Istithbat' };
export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const incidents = await readIncidents();
  const sources = await readSources();
  const gateway = await readGatewayInventory();
  const audit = await readAudit({ limit: 12 });
  const gatewayItems = gateway.ok ? gateway.data : [];
  const bindingList = gatewayItems.filter((g) => g.binding && g.appId);
  const models: SourceModel[] = (sources.ok ? sources.data : []).map((s) => sourceModel(s, gatewayItems))
    .sort((a, b) => Number(b.state === 'held') - Number(a.state === 'held') || Number(b.bound) - Number(a.bound) || a.facts.title.localeCompare(b.facts.title));
  const list = incidents.ok ? incidents.data : [];
  const open = list.filter((i) => i.status !== 'RESOLVED').sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const lead = leadIncident(list);
  // Light summaries from persisted audit + source detail; the full aggregate is only needed on Incident Review.
  const summaries: IncidentSummary[] = [];
  for (const i of open.slice(0, 3)) summaries.push(await summarizeIncident(i));
  const leadSum = summaries.find((d) => d.item.id === lead?.id) ?? null;
  const held = open.filter(needsDecision);
  const quarantined = held.filter((i) => i.status === 'QUARANTINED').length;
  const records = models.reduce((n, m) => n + (m.recordCount ?? 0), 0);
  const versionLabel = new Map(models.flatMap((m) => [m.latest, m.trusted]).filter(Boolean).map((v) => [v!.id, vr(v)!]));
  for (const d of summaries) { versionLabel.set(d.item.candidateVersionId, `${d.item.candidateLabel} · r${d.item.candidateRevision}`); }
  const servingTrusted = bindingList.length > 0 && bindingList.every((b) => b.served?.status === 'TRUSTED');

  return (
    <main id="main" className="scr-overview">
      <AutoRefresh active={open.some((i) => i.pipelineStatus === 'RUNNING')} />
      <PageHeader
        crumbs={<><span>Overview</span><Sep /><span>{sources.ok ? `${models.length} sources · ${records} records monitored` : 'Sources unavailable'}</span></>}
        title={servingTrusted ? <>Production is serving<br />trusted knowledge.</> : bindingList.length ? <>Production is not on<br />a trusted version.</> : <>No protected app<br />is bound yet.</>}
        lede={held.length
          ? `${word(held.length)} ${held.length === 1 ? 'candidate is' : 'candidates are'} held for a human decision. Nothing reaches the protected app until a reviewer signs.`
          : open.length ? 'A candidate is being investigated. It stays unserved while the pipeline runs.' : 'Nothing is held. Every protected app reads its trusted version.'}
        status={<>
          <Dk k="Production">{servingTrusted ? <Chip tone="tq">Serving trusted</Chip> : <Chip tone="co">Not serving trusted</Chip>}</Dk>
          <Dk k="Held candidates">{held.length ? <Chip tone="co">{quarantined ? `${quarantined} quarantined` : `${held.length} held for review`}</Chip> : <Chip tone="tq">None</Chip>}</Dk>
          <Dk k="Protected apps">{bindingList.length ? <>{new Set(bindingList.map((b) => b.appId)).size} · <Mono>{[...new Set(bindingList.map((b) => b.appId))].join(', ')}</Mono></> : 'None'}</Dk>
        </>}
      />

      <Band id="sources" labelledBy="h-src" first>
        <Rail layer="src" id="h-src" title="Sources">Version state per source.</Rail>
        <div className="main">
          <HeadRow title="Source versions" right={<Lnk href="/sources">All sources</Lnk>} />
          {!sources.ok ? <ReadError {...sources.error} /> : (
            <div className="plate tight" style={{ overflowX: 'auto' }}>
              <div className="srow shead" aria-hidden="true">
                <span>Source</span><span>Latest seen</span><span /><span>Trusted</span><span /><span>Served</span><span style={{ textAlign: 'right' }}>State</span>
              </div>
              {models.map((m) => <SourceRow key={m.summary.id} m={m} incidentId={open.find((i) => i.sourceId === m.summary.id)?.id ?? null} />)}
            </div>
          )}
          <p className="body" style={{ color: 'var(--ink-3)' }}>
            Real sources are read-only: Istithbat never modifies them. Their first snapshot is trusted only by an explicit, audited baseline.{' '}
            {bindingList.length ? `Only ${[...new Set(bindingList.map((b) => b.sourceName.split(' — ')[0]))].join(' and ')} ${new Set(bindingList.map((b) => b.sourceId)).size === 1 ? 'is' : 'are'} bound to a protected app.` : 'No source is bound to a protected app.'}
          </p>
        </div>
      </Band>

      <Band id="flow" labelledBy="h-flow">
        <Rail layer="pol" id="h-flow" title="Pipeline">AI advises, policy governs, humans decide.</Rail>
        <div className="main">
          {leadSum ? <Flow s={leadSum} /> : <IdleFlow />}
        </div>
      </Band>

      <Band id="incidents" labelledBy="h-inc">
        <Rail layer="det" id="h-inc" title="Incidents">Open cases needing a decision.</Rail>
        <div className="main">
          <HeadRow title={open.length ? `Open incidents · ${open.length}` : 'No open incidents'} right={<span className="meta mono">/api/incidents</span>} />
          {!incidents.ok ? <ReadError {...incidents.error} /> : open.length === 0 ? (
            <div className="plate" style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Chip tone="tq">Nothing open</Chip><span className="body" style={{ color: 'var(--ink-3)' }}>An incident opens when a source version changes a substantive field.</span></div>
          ) : open.map((i) => {
            return <IncidentCard key={i.id} item={i} summary={summaries.find((x) => x.item.id === i.id) ?? null} />;
          })}
        </div>
      </Band>

      <Band id="record" labelledBy="h-rec">
        <Rail layer="det" id="h-rec" title="Audit">Latest append-only entries.</Rail>
        <div className="main">
          <HeadRow title="Recent audit events" right={lead ? <Lnk href={`/incidents/${lead.id}/record`}>Full record</Lnk> : undefined} />
          {!audit.ok ? <ReadError {...audit.error} /> : (
            <div className="plate tight">
              {audit.data.events.filter((e) => !FOLDED.test(e.eventType)).slice(0, 5).map((e) => {
                const n = narrate(e, { versionLabel: (id) => (id ? versionLabel.get(id) ?? null : null), servedLabel: bindingList[0]?.served?.label, appName: bindingList[0]?.appName ?? null });
                return <Ev key={e.id} mark={<Mk layer={LANE_MARK[n.lane]} />} time={evTime(e.createdAt)} title={n.title} note={n.line} code={e.eventType} titleStyle={n.lane === 2 ? { color: 'var(--pu-ink)' } : undefined} />;
              })}
              {audit.data.events.length === 0 && <p className="body" style={{ padding: '16px 0' }}>Nothing recorded yet.</p>}
            </div>
          )}
        </div>
      </Band>

      {lead && leadSum && needsDecision(lead) ? (
        <SummaryDock
          railText={held.length === 1 ? 'One case is waiting. Everything else is serving trusted knowledge.' : `${word(held.length)} cases are waiting.`}
          left={leadSum.policyCode ? <HeldBy code={leadSum.policyCode} /> : <Chip tone="am">Held for review</Chip>}
          right={<HandedToYou />}
          question={<>Should <span className="mono" style={{ fontSize: 25 }}>{lead.candidateLabel}</span> of {leadSum.sourceTitle} replace <span className="mono" style={{ fontSize: 25 }}>{lead.previousLabel ?? 'the trusted version'}</span>?</>}
          body="The evidence, the AI reading and the regression are on the incident."
          href={`/incidents/${lead.id}#decision`} cta="Review the evidence and decide"
          helper={leadSum.policyAction === 'QUARANTINE' ? 'Policy requires a human for this change' : 'Held until a person decides'}
        />
      ) : (
        <SummaryDock
          railText="Nothing is waiting. Every protected app is serving trusted knowledge."
          left={<Chip tone="tq">Nothing held</Chip>} right={<HandedToYou>Nothing to sign</HandedToYou>}
          question="Nothing is waiting for a decision." body="Policy holds a candidate the moment a substantive change needs a person."
          href="/incidents" cta="Open the incidents" helper="AI advises · policy governs · humans decide"
        />
      )}
    </main>
  );
}

function SourceRow({ m, incidentId }: { m: SourceModel; incidentId: string | null }) {
  const s = m.summary;
  const latest = m.latest, trusted = m.trusted;
  const latestNote = m.changed
    ? <><span className="dot" style={{ background: m.state === 'investigating' ? 'var(--am)' : 'var(--co)' }} />{latest?.status === 'QUARANTINED' ? 'Quarantined' : latest?.status === 'REJECTED' ? 'Rejected' : m.state === 'investigating' ? 'Investigating' : 'Held for review'}</>
    : s.versionLabelPublished === false ? 'No label published' : m.facts.real ? 'Provider version' : 'Published label';
  return (
    <div className={`srow${m.state === 'held' ? ' held' : ''}`}>
      <div className="sname">
        <b>{m.facts.title}</b>
        <span className="meta">{m.facts.kindShort} · {m.facts.recordsPhrase(m.recordCount)}</span>
        {s.isDemoFixture ? <span className="pill" style={{ alignSelf: 'flex-start', padding: '2px 10px', border: '1px solid var(--am-soft)', background: 'var(--am-soft)', color: 'var(--am-ink)', fontSize: 12 }}><span className="dot" style={{ background: 'var(--am)' }} />Controlled synthetic source</span>
          : m.facts.subtitle && <span className="meta" style={{ fontSize: 12 }}>{m.facts.subtitle}</span>}
      </div>
      <div className="vc"><span className="v mono">{latest?.label ?? s.latestSeenLabel ?? '—'}</span><span className="vs">{latestNote}</span></div>
      <span className="op" aria-label={m.changed ? 'is not' : 'equals'}>{m.changed ? '≠' : '='}</span>
      <div className="vc"><span className="v mono">{trusted?.label ?? '—'}</span><span className="vs">{trusted ? <><span className="dot" style={{ background: 'var(--tq)' }} />{m.facts.real ? 'Baseline' : 'Trusted'}</> : 'No trusted version'}</span></div>
      {m.bound ? <span className="op" aria-label={m.served?.id === trusted?.id ? 'equals' : 'is not'}>{m.served?.id === trusted?.id ? '=' : '≠'}</span> : <span className="op" aria-hidden="true">·</span>}
      <div className="vc">
        {m.bound ? <><span className="v mono">{m.served?.label ?? '—'}</span><span className="vs">to {m.appName}</span></>
          : <><span className="v" style={{ color: 'var(--ink-3)' }}>—</span><span className="vs">No protected app</span></>}
      </div>
      <div className="sstate">
        {m.state === 'held' ? <><Chip tone="co" ink>Held for decision</Chip>{(m.held?.incidentId ?? incidentId) && <Lnk href={`/incidents/${m.held?.incidentId ?? incidentId}`}>Review</Lnk>}</>
          : m.state === 'investigating' ? <Chip tone="am">Investigating</Chip>
          : m.state === 'no-baseline' ? <Chip tone="am">No baseline</Chip>
          : <Chip tone="tq">In agreement</Chip>}
      </div>
    </div>
  );
}

type StepView = { href: string; mk: 'src' | 'det' | 'ai' | 'pol' | 'hum'; title: string; sub: React.ReactNode; state: string; now?: boolean };

function groupState(steps: PipelineStepState[], names: string[]): string {
  const g = steps.filter((s) => names.includes(s.step));
  if (!g.length) return 'Pending';
  if (g.some((s) => s.status === 'FAILED')) return 'Failed';
  if (g.some((s) => s.status === 'RUNNING')) return 'Running';
  if (g.every((s) => s.status === 'DONE')) return 'Done';
  return 'Pending';
}

function Flow({ s: f }: { s: IncidentSummary }) {
  const inc = f.item;
  const steps = inc.pipelineSteps;
  const base = `/incidents/${inc.id}`;
  const decided = inc.status === 'RESOLVED' || f.decided;
  const views: StepView[] = [
    { href: `${base}#source`, mk: 'src', title: 'Change detected', sub: <>{f.changeCount} {f.changeCount === 1 ? 'field' : 'fields'}{f.fieldPath && <> · <span className="mono">{f.fieldPath}</span></>}</>, state: 'Done' },
    { href: `${base}#facts`, mk: 'det', title: 'Facts', sub: <>{f.substantive ? 'Substantive' : 'Equivalent'}{f.contentLevel ? ` · level ${f.contentLevel}` : ''}</>, state: 'Done' },
    { href: `${base}#advisory`, mk: 'ai', title: 'Analysis', sub: <span style={{ color: 'var(--pu-ink)' }}>{f.analysed ? `${inc.riskLevel ? `${inc.riskLevel.charAt(0)}${inc.riskLevel.slice(1).toLowerCase()} risk` : 'Recorded'} · advisory` : 'Advisory'}</span>, state: groupState(steps, ['ANALYSIS']) },
    { href: `${base}#behavior`, mk: 'det', title: 'Regression', sub: f.regressionCount && groupState(steps, ['REGRESSION_QUESTIONS', 'REGRESSION_PAIR']) === 'Done' ? <><span className="dot" style={{ background: f.materialCount ? 'var(--co)' : 'var(--tq)' }} /> {f.materialCount ? `${f.materialCount} of ${f.regressionCount} material` : 'No material change'}</> : 'Matched questions', state: groupState(steps, ['REGRESSION_QUESTIONS', 'REGRESSION_PAIR']) },
    { href: `${base}/blast-radius`, mk: 'det', title: 'Blast radius', sub: f.counts && groupState(steps, ['BLAST_RADIUS']) === 'Done' ? `${f.counts.impacted} impacted · ${f.counts.exposed} exposed` : 'Dependency walk', state: groupState(steps, ['BLAST_RADIUS']) },
    { href: `${base}#containment`, mk: 'pol', title: 'Policy', sub: f.policyCode ? <><span className="mono">{f.policyCode}</span> · {String(f.policyAction ?? '').toLowerCase()}</> : 'Deterministic rules', state: groupState(steps, ['POLICY']) },
    { href: `${base}#decision`, mk: 'hum', title: 'Review decision', sub: decided ? 'Decided' : 'Awaiting a reviewer', state: decided ? 'Done' : 'Pending' },
  ];
  const firstOpen = views.findIndex((v) => v.state !== 'Done');
  if (firstOpen >= 0) { views[firstOpen].now = true; views[firstOpen].state = views[firstOpen].state === 'Pending' ? 'Now' : views[firstOpen].state; }
  const meta = inc.pipelineStatus === 'RUNNING' ? 'Pipeline running · results arrive step by step'
    : inc.pipelineStatus === 'FAILED_CLOSED' ? 'Pipeline failed closed · held for a person'
    : decided ? 'Decided and recorded' : 'Pipeline complete · awaiting a reviewer';
  return (
    <>
      <HeadRow title={<>Pipeline · <span className="mono">{f.recordKey}</span></>} right={<span className="meta">{meta}</span>} />
      <div className="plate" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <ol className="flow">
          {views.map((v) => (
            <li key={v.title} className={v.now ? 'now' : undefined}>
              <Link className="fs" href={v.href} aria-current={v.now ? 'step' : undefined}>
                <span className="fmk"><Mk layer={v.mk} /></span><b>{v.title}</b><span>{v.sub}</span><i>{v.state}</i>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

function IdleFlow() {
  const steps: Array<[StepView['mk'], string, string]> = [
    ['src', 'Change detected', 'Every check is hashed'], ['det', 'Facts', 'Declared roles and levels'], ['ai', 'Analysis', 'Advisory only'],
    ['det', 'Regression', 'Same model, two versions'], ['det', 'Blast radius', 'Dependency walk'], ['pol', 'Policy', 'Deterministic rules'], ['hum', 'Human decision', 'Signs every release'],
  ];
  return (
    <>
      <HeadRow title="Pipeline idle" right={<span className="meta">No candidate under review</span>} />
      <div className="plate" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <ol className="flow">
          {steps.map(([mk, t, s]) => (
            <li key={t}><div className="fs"><span className="fmk"><Mk layer={mk} /></span><b>{t}</b><span style={mk === 'ai' ? { color: 'var(--pu-ink)' } : undefined}>{s}</span><i>Idle</i></div></li>
          ))}
        </ol>
      </div>
    </>
  );
}
