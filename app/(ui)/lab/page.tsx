import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlastInstrument } from '@/components/blast/BlastInstrument';
import { GatewayLanes } from '@/components/gateway/GateInstrument';
import { blastFixture, DIFF_FIXTURES, incidentFixtures, laneFixtures, recordFixture, sourceFixtures } from '@/components/lab/fixtures';
import { RecordLedger } from '@/components/record/RecordLedger';
import { DecisionDock } from '@/components/incident/DecisionDock';
import { SourcesScreen } from '@/components/sources/SourcesScreen';
import { ExactDiff } from '@/components/strata/ExactDiff';
import { IncidentList } from '@/components/strata/IncidentList';
import { Chip, ReviewerStatus } from '@/components/strata/primitives';

export const metadata = { title: 'Fixture lab · Istithbat', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const STORIES = [
  'incidents-0', 'incidents-1', 'incidents-5', 'incidents-24',
  'blast-1', 'blast-2', 'blast-5', 'blast-12', 'blast-long',
  'gateway-1', 'gateway-3', 'gateway-7', 'sources-6', 'record', 'diff', 'dock-locked', 'dock-active',
] as const;

/**
 * Local fixture lab: renders the real UI components against synthetic fixtures to test scale and
 * long content. Off unless the server runs with STRATA_LAB=1 (a local dev flag); Production never
 * sets it, so this route 404s there and production screens only ever show persisted data.
 */
export default async function Lab({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (process.env.STRATA_LAB !== '1') notFound();
  const s = ((await searchParams).s ?? 'incidents-24') as (typeof STORIES)[number];
  const [kind, arg] = s.split('-');
  const n = Number(arg);
  return (
    <main id="main" className={kind === 'blast' ? 'scr-blast' : kind === 'sources' ? 'scr-sources' : kind === 'record' ? 'scr-record' : kind === 'gateway' ? 'scr-gateway' : 'scr-overview'}>
      <section className="phd">
        <div className="wrap" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Chip tone="am">Fixture lab · local only · not real data</Chip><b>{s}</b></span>
          <nav aria-label="Stories" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: 13 }}>
            {STORIES.map((x) => <Link key={x} href={`/lab?s=${x}`} aria-current={x === s ? 'page' : undefined} style={{ color: x === s ? 'var(--ink)' : 'var(--ink-3)', fontWeight: x === s ? 600 : 400 }}>{x}</Link>)}
          </nav>
        </div>
      </section>
      {kind === 'incidents' && <Section><IncidentList rows={incidentFixtures(n)} /></Section>}
      {kind === 'blast' && (() => {
        const cfg = arg === 'long' ? { apps: 4, impacted: 2, apis: 2, long: true } : { apps: n, impacted: n >= 5 ? 3 : 1, apis: n >= 5 ? 3 : n === 1 ? 1 : 2 };
        const f = blastFixture(cfg);
        return <BlastInstrument key={s} br={f.br} labels={f.labels} />;
      })()}
      {kind === 'gateway' && <Section><GatewayLanes key={s} appName="Fixture Protected App" lanes={laneFixtures(n, n === 1 ? 1 : n === 3 ? 2 : 3)} /></Section>}
      {kind === 'sources' && (() => { const v = sourceFixtures(n); return <SourcesScreen views={v} initialId={v[0].id} />; })()}
      {kind === 'record' && (() => { const f = recordFixture(); return <Section><RecordLedger ctx={f.ctx} initial={{ events: f.events, nextCursor: null }} /></Section>; })()}
      {kind === 'diff' && <Section>{DIFF_FIXTURES.map((d) => (
        <div key={d.label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="cap">{d.label}</span>
          <div className="plate tight"><ExactDiff oldValue={d.old} newValue={d.neu} oldLabel="v1" newLabel="v2" oldChip={<Chip tone="tq" small>Trusted</Chip>} newChip={<Chip tone="co" small>Candidate</Chip>} flags={d.flags} /></div>
        </div>
      ))}</Section>}
      {kind === 'dock' && (
        // The UI state only: `reviewer` is a fixture prop, not a session. Signing from here would hit
        // the real review route without a session and be refused (401); QA never clicks Sign.
        <section className="band" style={{ paddingTop: 0 }}><div className="wrap g"><div className="main" style={{ gap: 0 }}>
          <div className="handoff"><span /><span className="handoff-line" aria-hidden="true" /><ReviewerStatus active={arg === 'active'} /></div>
          <div className="handoff-drop" aria-hidden="true" />
          <DecisionDock key={s} incidentId="fixture" candidate="v2" previous="v1" served="v1" appName="Fixture Protected App" candidateState="Quarantined"
            allowed={['APPROVE', 'REJECT', 'KEEP_QUARANTINED', 'ESCALATE']} aiPill={null} reviewer={arg === 'active' ? { name: 'Fixture Reviewer' } : null} recorded={null} resolved={false} />
        </div></div></section>
      )}
      <div style={{ height: 120 }} />
    </main>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <section className="band" style={{ paddingTop: 0 }}><div className="wrap g"><div className="main">{children}</div></div></section>;
}
