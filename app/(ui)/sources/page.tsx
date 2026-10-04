import { PageTopbar } from '@/components/shell/AppShell';
import { ProvenanceTag } from '@/components/provenance/Provenance';
import { SourcesTable } from '@/components/sources/SourceViews';
import { EmptyState, ErrorState } from '@/components/states/States';
import { readSources } from '../_data/read';

export const metadata = { title: 'Sources · Istithbat' };
export const dynamic = 'force-dynamic';

export default async function SourcesPage() {
  const result = await readSources();

  return (
    <>
      <PageTopbar crumbs={[{ label: 'Istithbat', href: '/sources' }, { label: 'Sources' }]} />
      <main className="ist-content">
        <div className="ist-page-head">
          <div>
            <div className="ist-eyebrow">Connect · Detect</div>
            <h1 className="ist-h1">Sources</h1>
            <p className="ist-lede">
              Upstream knowledge sources Istithbat monitors. For each one, the version last seen upstream is kept separate from the
              version that is trusted and the version protected apps are actually served.
            </p>
          </div>
          <ProvenanceTag kind="deterministic">Snapshot + hash state</ProvenanceTag>
        </div>

        {!result.ok ? (
          <ErrorState title="Sources are unavailable" message={result.error.message} code={result.error.code} />
        ) : result.data.length === 0 ? (
          <EmptyState title="No sources are registered">No upstream source has been connected yet.</EmptyState>
        ) : (
          <>
            <SourcesTable sources={result.data} />
            <p className="ist-meta" style={{ marginBlockStart: 16 }}>
              Real connectors (Quranpedia, Dorar) are best-effort and are not connected in this build. The Hadith Evidence Sandbox is the
              only intentionally mutated source.
            </p>
          </>
        )}
      </main>
    </>
  );
}
