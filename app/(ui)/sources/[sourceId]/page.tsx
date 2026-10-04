import { notFound } from 'next/navigation';
import { PageTopbar } from '@/components/shell/AppShell';
import { PreviewDataBanner, SyntheticSourceBanner } from '@/components/banners/Banners';
import { ProvenanceBlock } from '@/components/provenance/Provenance';
import { ReleaseState } from '@/components/release/ReleaseState';
import {
  FieldRoleMap,
  SilentMutationEvidence,
  SourceHeaderTags,
  TransitionChanges,
  VersionTimeline,
  silentMutationPairs,
} from '@/components/sources/SourceViews';
import { loadSourceDetail, parseScenario, type VersionView } from '../../_data/sources';
import { PreviewSwitcher } from '../../_data/PreviewSwitcher';

export const metadata = { title: 'Source detail · Istithbat' };

function ref(v: VersionView | undefined) {
  return v ? { label: v.upstreamLabel, revision: v.revisionNumber } : null;
}

export default async function SourceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sourceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sourceId } = await params;
  const scenario = parseScenario((await searchParams).preview);
  const view = await loadSourceDetail(decodeURIComponent(sourceId), scenario);
  if (!view) notFound();

  const { source, versions, transitions } = view;
  const byTime = [...versions].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  const latestSeen = byTime[0];
  const trusted = versions.find((v) => v.status === 'TRUSTED');
  // Served comes from the gateway's label; resolve to the trusted revision with that label.
  const served = versions.find((v) => v.status === 'TRUSTED' && v.upstreamLabel === source.servedLabel);
  const pairs = silentMutationPairs(versions);
  const newestFirst = [...transitions].reverse();

  return (
    <>
      <PageTopbar
        crumbs={[
          { label: 'Istithbat', href: '/sources' },
          { label: 'Sources', href: view.origin === 'preview' ? `/sources?preview=${scenario}` : '/sources' },
          { label: source.name },
        ]}
        right={
          <button className="ist-btn" type="button" disabled title="Requires demo controls (DEMO_CONTROL_SECRET)">
            Check now
          </button>
        }
      />
      <main className="ist-content">
        {source.isDemoFixture && <SyntheticSourceBanner />}
        {view.origin === 'preview' && (
          <PreviewDataBanner reason="The source-detail read endpoint is not available yet. Hashes are computed from the fixture files for display; the canonical hash here is a preview, not lib/hashing output.">
            <PreviewSwitcher current={scenario} basePath={`/sources/${encodeURIComponent(source.id)}`} />
          </PreviewDataBanner>
        )}

        <div className="ist-page-head">
          <div>
            <div className="ist-eyebrow">Source</div>
            <h1 className="ist-h1">{source.name}</h1>
            <p className="ist-lede">{source.provider}</p>
            <SourceHeaderTags source={source} />
          </div>
        </div>

        <ReleaseState seen={ref(latestSeen)} trusted={ref(trusted)} served={ref(served)} />

        <section className="ist-section" style={{ marginBlockStart: 32 }} aria-labelledby="h-history">
          <div className="ist-grid-2">
            <div>
              <div className="ist-section__head">
                <h2 className="ist-h2" id="h-history">Version history</h2>
                <span className="ist-meta">Immutable snapshots · newest first</span>
              </div>
              <ProvenanceBlock kind="deterministic" label="Snapshots and hashes">
                <VersionTimeline versions={versions} />
              </ProvenanceBlock>
            </div>
            <div className="ist-stack" style={{ gap: 24 }}>
              {pairs.map((p) => (
                <SilentMutationEvidence key={p.after.id} before={p.before} after={p.after} />
              ))}
              <ProvenanceBlock kind="deterministic" label="Declared field roles">
                <p className="ist-meta" style={{ margin: '0 0 12px' }}>
                  Declared by the connector, never inferred or assigned by AI (D-02). Policy triggers read these roles.
                </p>
                <FieldRoleMap roles={view.fieldRoles} />
              </ProvenanceBlock>
            </div>
          </div>
        </section>

        <section className="ist-section" aria-labelledby="h-changes">
          <div className="ist-section__head">
            <h2 className="ist-h2" id="h-changes">Exact record changes</h2>
            <span className="ist-meta">Keyed by stable canonical_key · harakat and punctuation preserved</span>
          </div>
          {newestFirst.length === 0 ? (
            <p className="ist-meta">No version transitions yet. The trusted baseline is the only version seen.</p>
          ) : (
            <ProvenanceBlock kind="deterministic" label="Deterministic diff">
              <div className="ist-stack" style={{ gap: 28 }}>
                {newestFirst.map((t) => (
                  <TransitionChanges key={`${t.fromVersionId}-${t.toVersionId}`} transition={t} versions={versions} />
                ))}
              </div>
            </ProvenanceBlock>
          )}
          <div style={{ marginBlockStart: 24 }}>
            <ProvenanceBlock kind="analysis" label="Machine analysis">
              <p className="ist-meta" style={{ margin: 0 }}>
                None on this page. Interpretation of a change (what it may mean, and whether answers shift) is shown in Incident
                Review, labelled as advisory. It never alters the evidence above and never rules on which grading is correct.
              </p>
            </ProvenanceBlock>
          </div>
        </section>
      </main>
    </>
  );
}
