import { PageTopbar } from '@/components/shell/AppShell';
import { PreviewDataBanner } from '@/components/banners/Banners';
import { ProvenanceTag } from '@/components/provenance/Provenance';
import { SourcesTable } from '@/components/sources/SourceViews';
import { loadSources, parseScenario } from '../_data/sources';
import { PreviewSwitcher } from '../_data/PreviewSwitcher';

export const metadata = { title: 'Sources · Istithbat' };

export default async function SourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const scenario = parseScenario((await searchParams).preview);
  const { sources, origin } = await loadSources(scenario);
  const query = origin === 'preview' ? `?preview=${scenario}` : '';

  return (
    <>
      <PageTopbar crumbs={[{ label: 'Istithbat', href: '/sources' }, { label: 'Sources' }]} />
      <main className="ist-content">
        {origin === 'preview' && (
          <PreviewDataBanner reason="The sources read endpoint is not available yet. Values below are derived from the synthetic fixture files and typed against lib/contracts.">
            <PreviewSwitcher current={scenario} basePath="/sources" />
          </PreviewDataBanner>
        )}
        <div className="ist-page-head">
          <div>
            <div className="ist-eyebrow">Connect · Detect</div>
            <h1 className="ist-h1">Sources</h1>
            <p className="ist-lede">
              Upstream knowledge sources Istithbat monitors. For each one, the version last seen upstream is kept separate from
              the version trusted and the version protected apps are actually served.
            </p>
          </div>
          <ProvenanceTag kind="deterministic">Snapshot + hash state</ProvenanceTag>
        </div>
        <SourcesTable sources={sources} query={query} />
        <p className="ist-meta" style={{ marginBlockStart: 16 }}>
          Real connectors (Quranpedia, Dorar) are best-effort and are not connected in this build. The Hadith Evidence Sandbox is
          the only intentionally mutated source.
        </p>
      </main>
    </>
  );
}
