import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageTopbar } from '@/components/shell/AppShell';
import { SyntheticSourceBanner } from '@/components/banners/Banners';
import { Mono, formatTimestamp } from '@/components/evidence/Evidence';
import {
  ActivityLog,
  DeterministicEvidence,
  HumanDecision,
  IncidentStatusBadge,
  MachineAnalysis,
  PipelineStepTable,
  PipelineTrack,
  SourceRecordPanel,
} from '@/components/incidents/IncidentViews';
import { readContextPacket } from '@/components/incidents/context';
import { stagesForIncident } from '@/components/incidents/pipeline';
import { versionName } from '@/components/sources/derive';
import { SilentMutationBadge } from '@/components/status/Status';
import { ErrorState } from '@/components/states/States';
import { readIncidentDetail, readIncidents, readSourceDetail } from '../../_data/read';

export const metadata = { title: 'Incident · Istithbat' };
export const dynamic = 'force-dynamic';

export default async function IncidentPage({ params }: { params: Promise<{ incidentId: string }> }) {
  const { incidentId } = await params;
  const crumbs = [
    { label: 'Istithbat', href: '/sources' },
    { label: 'Incidents', href: '/incidents' },
  ];
  const result = await readIncidentDetail(incidentId);

  if (!result.ok) {
    return (
      <>
        <PageTopbar crumbs={[...crumbs, { label: incidentId.slice(0, 8) }]} />
        <main className="ist-content">
          <ErrorState title="This incident is unavailable" message={result.error.message} code={result.error.code} />
        </main>
      </>
    );
  }
  const inc = result.data;
  if (!inc) notFound();

  const [source, list] = await Promise.all([readSourceDetail(inc.sourceId), readIncidents()]);
  const openedAt = list.ok ? (list.data.find((i) => i.id === inc.id)?.openedAt ?? null) : null;
  const src = source.ok ? source.data : null;
  const packet = readContextPacket(inc.contextPacket);
  const stages = stagesForIncident(inc);
  const synthetic = src?.source.isDemoFixture ?? packet?.source?.synthetic ?? false;
  const runFailedClosed = inc.pipeline?.status === 'FAILED_CLOSED';

  return (
    <>
      <PageTopbar crumbs={[...crumbs, { label: `${inc.sourceId} · ${versionName(inc.candidateVersion)}` }]} />
      <main className="ist-content">
        {synthetic && (
          <SyntheticSourceBanner>
            This incident concerns a controlled synthetic record. The judgment, grader, narrator and reference values are invented demo data.
          </SyntheticSourceBanner>
        )}

        {/* L1 · Finding */}
        <div className="ist-page-head">
          <div>
            <div className="ist-eyebrow">Incident</div>
            <h1 className="ist-h1">
              {src?.source.name ?? inc.sourceId} · <Mono>{versionName(inc.candidateVersion)}</Mono>
            </h1>
            <div className="ist-row" style={{ marginBlockStart: 10 }}>
              <IncidentStatusBadge status={inc.status} />
              {inc.candidateVersion.silentMutation && <SilentMutationBadge />}
              <span className="ist-meta">
                <Mono>{inc.id}</Mono>{openedAt ? ` · opened ${formatTimestamp(openedAt)}` : ''}
              </span>
            </div>
            <p className="ist-lede" style={{ marginBlockStart: 12 }}>
              {inc.changes.length} exact change{inc.changes.length === 1 ? '' : 's'} detected in{' '}
              <Link href={`/sources/${encodeURIComponent(inc.sourceId)}`}>{src?.source.name ?? inc.sourceId}</Link>. The candidate is not
              trusted and is not served while the investigation is open.
            </p>
          </div>
        </div>

        <section aria-labelledby="h-pipeline" style={{ marginBlockEnd: 32 }}>
          <div className="ist-section__head">
            <h2 className="ist-h2" id="h-pipeline">
              Investigation pipeline
            </h2>
            <span className="ist-meta">From persisted step state · nothing is simulated</span>
          </div>
          {runFailedClosed && (
            <ErrorState title="Pipeline failed closed" message="A step failed after its retries. The candidate remains untrusted and unserved." />
          )}
          <PipelineTrack stages={stages} />
          <div style={{ marginBlockStart: 10 }}>
            <PipelineStepTable inc={inc} />
          </div>
        </section>

        {/* L3 · Deterministic evidence first, then L2 machine analysis, kept visibly apart */}
        <section className="ist-section" aria-labelledby="h-evidence">
          <div className="ist-section__head">
            <h2 className="ist-h2" id="h-evidence">
              What changed
            </h2>
          </div>
          <DeterministicEvidence inc={inc} packet={packet} />
        </section>

        <section className="ist-section" aria-labelledby="h-analysis">
          <div className="ist-section__head">
            <h2 className="ist-h2" id="h-analysis">
              What it might mean
            </h2>
          </div>
          <MachineAnalysis inc={inc} />
        </section>

        {/* L4 · Source & provenance */}
        <section className="ist-section" aria-labelledby="h-source">
          <div className="ist-section__head">
            <h2 className="ist-h2" id="h-source">
              Source record
            </h2>
            <span className="ist-meta">From the persisted context packet</span>
          </div>
          <SourceRecordPanel
            packet={packet}
            changedPaths={inc.changes.map((c) => c.fieldPath ?? '').filter(Boolean)}
            roles={src?.fieldRoles ?? {}}
          />
          {!packet?.records?.length && <p className="ist-meta">The source record is not included in this incident’s context.</p>}
        </section>

        <section className="ist-section" aria-labelledby="h-decision">
          <div className="ist-section__head">
            <h2 className="ist-h2" id="h-decision">
              Decision
            </h2>
          </div>
          <HumanDecision inc={inc} />
        </section>

        {/* L6 · Audit */}
        <section className="ist-section" aria-labelledby="h-activity">
          <div className="ist-section__head">
            <h2 className="ist-h2" id="h-activity">
              Activity
            </h2>
            <span className="ist-meta">Append-only audit events</span>
          </div>
          <ActivityLog inc={inc} />
        </section>
      </main>
    </>
  );
}
