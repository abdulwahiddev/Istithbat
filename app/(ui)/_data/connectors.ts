import 'server-only';
import type { SourceSummary } from '@/lib/contracts';
import { getHttpConnector } from '@/lib/connectors/registry';
import { HADEETHENC_HADITH_IDS, HADEETHENC_ID, HADEETHENC_LANGUAGES } from '@/lib/connectors/hadeethenc';
import { QURANENC_ID, QURANENC_SURAHS } from '@/lib/connectors/quranenc';
import { SANDBOX_ID } from '@/lib/connectors/sandbox';

/**
 * Descriptive connector facts for the Sources and Overview screens, taken from the connector code
 * itself (lib/connectors) and the source row. Nothing here is a measured value.
 */
export type ConnectorFacts = {
  title: string; subtitle: string | null; tab: string;
  kind: string; kindShort: string; real: boolean;
  recordsPhrase: (n: number | null) => string;
  scope: (n: number | null) => string;
  keys: string;
  upstream: { main: string; sub: string };
  strategy: string; revisionRule: string; silent: string;
  trigger: string;
  endpointLines: string[];
  termsLabel: string; terms: string;
};

const host = (url: string) => { try { return new URL(url).host; } catch { return url; } };
const splitName = (name: string) => { const [a, ...b] = name.split(' — '); return { title: a.trim(), subtitle: b.join(' — ').trim() || null }; };

export function connectorFacts(source: SourceSummary): ConnectorFacts {
  const { title, subtitle } = splitName(source.name);
  const http = getHttpConnector(source.id);
  const labelled = source.versionLabelPublished !== false;
  const silent = labelled ? `Detectable: ${source.id === QURANENC_ID ? 'version' : 'label'} is published` : 'Not claimed: provider issues no label';
  const terms = source.rightsNote ?? 'No rights note is recorded for this source.';

  if (source.id === SANDBOX_ID || source.isDemoFixture) {
    return {
      title, subtitle, tab: 'Sandbox', real: false, kind: 'Controlled synthetic · webhook', kindShort: `Synthetic · webhook · level ${source.contentLevel}`,
      recordsPhrase: (n) => (n == null ? 'records' : `${n} ${n === 1 ? 'record' : 'records'}`),
      scope: (n) => (n == null ? 'Synthetic fixture records' : `${n} synthetic ${n === 1 ? 'record' : 'records'}`),
      keys: '—', upstream: { main: 'Sandbox', sub: 'Publishes v-labels' },
      strategy: 'Provider publishes a label', revisionRule: 'r1 per label; r2+ for same-label changes', silent, trigger: 'webhook',
      endpointLines: ['trigger    WEBHOOK (signed) → server fetch', `source     ${source.provider}`],
      termsLabel: 'Synthetic content notice',
      terms: 'CONTROLLED SYNTHETIC SOURCE — not real hadith data. No real narration, no real scholar, no real provider, no real reference. Used only for the evidence-scope drift demo.',
    };
  }
  const urls = http?.requestUrls() ?? [];
  const base = { title, real: true, kind: `Real · read-only ${source.connectorType === 'HTTP_API' ? 'HTTP API' : source.connectorType ?? 'connector'}`, silent, trigger: 'a check', termsLabel: 'Terms and attribution', terms };
  const endpointLines = [...urls.map((u, i) => `${i === 0 ? 'endpoint' : '        '}   ${u}`), `requests   ${urls.length} per check · no key`, 'verify     re-verifiable on demand (demo-control credential)'];
  if (source.id === HADEETHENC_ID) {
    return {
      ...base, subtitle, tab: 'HadeethEnc', kindShort: `${base.kind.replace('Real · ', 'Real · ')} · level ${source.contentLevel}`,
      recordsPhrase: () => `${HADEETHENC_HADITH_IDS.length} hadiths, ${HADEETHENC_LANGUAGES.join(' + ')}`,
      scope: () => `Hadith ${HADEETHENC_HADITH_IDS.join(', ')} · ${HADEETHENC_LANGUAGES.join(' + ')}`,
      keys: 'hadeethenc:{id}', upstream: { main: host(http?.source.endpoint ?? 'hadeethenc.com'), sub: 'No version label' },
      strategy: 'Provider publishes no label; literal unversioned', revisionRule: 'A new raw fingerprint becomes a new revision', endpointLines,
    };
  }
  if (source.id === QURANENC_ID) {
    return {
      ...base, subtitle: subtitle ? `${subtitle} · surahs ${QURANENC_SURAHS.join(', ')}` : null, tab: 'QuranEnc', kindShort: `${base.kind} · level ${source.contentLevel}`,
      recordsPhrase: (n) => (n == null ? 'ayat' : `${n} ayat`),
      scope: (n) => `Surahs ${QURANENC_SURAHS.join(' and ')}${n == null ? '' : ` · ${n} ayat`}`,
      keys: 'quranenc:{key}:{sura}:{aya}', upstream: { main: host(http?.source.endpoint ?? 'quranenc.com'), sub: 'Publishes version' },
      strategy: 'Translation’s published version', revisionRule: 'r1 per version; r2+ for same-version changes', endpointLines,
    };
  }
  return {
    ...base, subtitle, tab: title, kindShort: `${base.kind} · level ${source.contentLevel}`,
    recordsPhrase: (n) => (n == null ? 'records' : `${n} records`), scope: (n) => (n == null ? '—' : `${n} records`), keys: '—',
    upstream: { main: http ? host(http.source.endpoint) : source.provider, sub: labelled ? 'Publishes version' : 'No version label' },
    strategy: labelled ? 'Provider publishes a label' : 'Provider publishes no label; literal unversioned', revisionRule: 'A new raw fingerprint becomes a new revision', endpointLines,
  };
}
