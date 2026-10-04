import { notFound } from 'next/navigation';
import { PageTopbar } from '@/components/shell/AppShell';
import { SyntheticSourceBanner } from '@/components/banners/Banners';
import { ProvenanceBlock } from '@/components/provenance/Provenance';
import { ReleaseState } from '@/components/release/ReleaseState';
import {
  FieldRoleMap,
  SilentMutationEvidence,
  SourceChecks,
  SourceHeaderTags,
  TransitionChanges,
  VersionTimeline,
} from '@/components/sources/SourceViews';
import { releaseRefs, silentMutationPairs, transitions } from '@/components/sources/derive';
import { ErrorState } from '@/components/states/States';
import { readIncidentIndex, readSourceDetail } from '../../_data/read';

export const metadata = { title: 'Source detail · Istithbat' };
export const dynamic = 'force-dynamic';

export default async function SourceDetailPage({ params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params;
  const id = decodeURIComponent(sourceId);
  const [result, incidents] = await Promise.all([readSourceDetail(id), readIncidentIndex()]);

  const crumbs = [
    { label: 'Istithbat', href: '/sources' },
    { label: 'Sources', href: '/sources' },
  ];

  if (!result.ok) {
    return (
      <>
        <PageTopbar crumbs={[...crumbs, { label: id }]} />
        <main className="ist-content">
          <ErrorState title="This source is unavailable" message={result.error.message} code={result.error.code} />
        </main>
      </>
    );
  }
  const detail = result.data;
  if (!detail) notFound();

  const { source, versions } = detail;
  const refs = releaseRefs(detail);
  const pairs = silentMutationPairs(versions);
  const steps = transitions(detail);

  return (
    <>
      <PageTopbar
        crumbs={[...crumbs, { label: source.name }]}
        right={
          <button className="ist-btn" type="button" disabled title="Requires demo controls (DEMO_CONTROL_SECRET)">
            Check now
          </button>
        }
      />
      <main className="ist-content">
        {source.isDemoFixture && <SyntheticSourceBanner />}

        <div className="ist-page-head">
          <div>
            <div className="ist-eyebrow">Source</div>
            <h1 className="ist-h1">{source.name}</h1>
            <p className="ist-lede">{source.provider}</p>
            <SourceHeaderTags source={source} />
          </div>
        </div>

        <ReleaseState seen={refs.seen} trusted={refs.trusted} served={refs.served} />

        <section className="ist-section" style={{ marginBlockStart: 32 }} aria-labelledby="h-history">
          <div className="ist-grid-2">
            <div>
              <div className="ist-section__head">
                <h2 className="ist-h2" id="h-history">
                  Version history
                </h2>
                <span className="ist-meta">Immutable snapshots · newest first</span>
              </div>
              <ProvenanceBlock kind="deterministic" label="Snapshots and hashes">
                {versions.length ? (
                  <VersionTimeline versions={versions} incidents={incidents} />
                ) : (
                  <p className="ist-meta">No version has been stored yet.</p>
                )}
              </ProvenanceBlock>
            </div>
            <div className="ist-stack" style={{ gap: 24 }}>
              {pairs.map((p) => (
                <SilentMutationEvidence key={p.after.id} before={p.before} after={p.after} changes={detail.changes} />
              ))}
              <ProvenanceBlock kind="deterministic" label="Declared field roles">
                <p className="ist-meta" style={{ margin: '0 0 12px' }}>
                  Declared by the connector, never inferred or assigned by AI (D-02). Policy triggers read these roles.
                </p>
                <FieldRoleMap roles={detail.fieldRoles} />
              </ProvenanceBlock>
            </div>
          </div>
        </section>

        <section className="ist-section" aria-labelledby="h-changes">
          <div className="ist-section__head">
            <h2 className="ist-h2" id="h-changes">
              Exact record changes
            </h2>
            <span className="ist-meta">Keyed by stable canonical_key · values shown exactly as stored</span>
          </div>
          {steps.length === 0 ? (
            <p className="ist-meta">No version transitions yet. The trusted baseline is the only version seen.</p>
          ) : (
            <ProvenanceBlock kind="deterministic" label="Deterministic diff">
              <div className="ist-stack" style={{ gap: 28 }}>
                {steps.map((t) => (
                  <TransitionChanges key={t.to.id} transition={t} />
                ))}
              </div>
            </ProvenanceBlock>
          )}
          <div style={{ marginBlockStart: 24 }}>
            <ProvenanceBlock kind="analysis" label="Machine analysis">
              <p className="ist-meta" style={{ margin: 0 }}>
                None on this page. Interpretation of a change is shown on its incident, labelled as advisory. It never alters the evidence
                above and never rules on which grading is correct.
              </p>
            </ProvenanceBlock>
          </div>
        </section>

        {detail.checks && detail.checks.length > 0 && (
          <section className="ist-section" aria-labelledby="h-checks">
            <div className="ist-section__head">
              <h2 className="ist-h2" id="h-checks">
                Source checks
              </h2>
              <span className="ist-meta">Most recent {detail.checks.length} · a webhook only triggers a fetch; it is never the source</span>
            </div>
            <SourceChecks checks={detail.checks} versions={versions} />
          </section>
        )}
      </main>
    </>
  );
}
