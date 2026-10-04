import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeBundle, fetchBundle, MAX_RESPONSE_BYTES, SourceFetchError, type Fetcher } from '@/lib/connectors/http-bundle';
import { prepareSourceEvidence } from '@/lib/connectors/evidence';
import { getConnectorDefinition, getHttpConnector, listHttpConnectors } from '@/lib/connectors/registry';
import { HADEETHENC_ID, hadeethUrl, hadeethencConnector } from '@/lib/connectors/hadeethenc';
import { QURANENC_ID, quranencConnector, suraUrl, translationsListUrl } from '@/lib/connectors/quranenc';
import { classifyObservation } from '@/lib/ingestion/classify';
import { diffPayloads } from '@/lib/diff/engine';

// Fixtures are unmodified official response bodies (see tests/fixtures/real/README.md).
// Anything altered below is altered in memory only, to exercise the diff engine.
const fixture = (name: string) => readFileSync(resolve('tests/fixtures/real', name));
const FIXTURES: Record<string, Buffer> = {
  ...Object.fromEntries(['2962', '4560', '1751'].flatMap((id) => ['ar', 'en'].map((l) => [hadeethUrl(id, l), fixture(`hadeethenc-${id}-${l}.json`)]))),
  [translationsListUrl()]: fixture('quranenc-translations-list-en.json'),
  [suraUrl('1')]: fixture('quranenc-english_saheeh-sura-1.json'),
  [suraUrl('112')]: fixture('quranenc-english_saheeh-sura-112.json'),
};

function fakeFetcher(overrides: Record<string, Buffer | { status?: number; type?: string; body?: Buffer; throws?: boolean }> = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, init });
    const o = overrides[url];
    if (o && !Buffer.isBuffer(o) && o.throws) throw new Error('network down');
    const body = Buffer.isBuffer(o) ? o : (o?.body ?? FIXTURES[url]);
    if (!body) return new Response('', { status: 404 });
    const status = (!Buffer.isBuffer(o) && o?.status) || 200;
    const type = (!Buffer.isBuffer(o) && o?.type) || 'application/json; charset=utf-8';
    return new Response(new Uint8Array(body), { status, headers: { 'content-type': type } });
  };
  return { fetcher, calls };
}

async function evidenceFor(id: string, overrides = {}) {
  const c = getHttpConnector(id)!;
  const raw = await fetchBundle(id, c.requestUrls(), fakeFetcher(overrides).fetcher);
  return { raw, evidence: prepareSourceEvidence(id, raw) };
}

describe('registry', () => {
  it('registers both real connectors next to the sandbox, as non-synthetic HTTP sources', () => {
    expect(listHttpConnectors().map((c) => c.source.id).sort()).toEqual([HADEETHENC_ID, QURANENC_ID].sort());
    expect(getConnectorDefinition('hadith-evidence-sandbox')?.publishesVersionLabel).toBe(true);
    expect(getConnectorDefinition(HADEETHENC_ID)?.publishesVersionLabel).toBe(false);
    expect(getConnectorDefinition(QURANENC_ID)?.publishesVersionLabel).toBe(true);
    for (const c of listHttpConnectors()) {
      expect(c.source.connectorType).toBe('HTTP_API');
      expect(c.requestUrls().every((u) => u.startsWith(c.source.endpoint))).toBe(true);
      expect(c.requestUrls().length).toBeLessThanOrEqual(6); // bounded scope
    }
  });
});

describe('HadeethEnc', () => {
  it('fetches, preserves exact upstream bytes and normalizes into the shared SourcePayload', async () => {
    const { raw, evidence } = await evidenceFor(HADEETHENC_ID);
    const decoded = decodeBundle(raw);
    for (const r of decoded.responses) expect(r.body.equals(FIXTURES[r.url])).toBe(true);
    expect(evidence.payload.upstreamVersionLabel).toBe('unversioned');
    expect(evidence.payload.metadata?.synthetic).toBe(false);
    expect(evidence.records.map((r) => r.record.canonical_key)).toEqual(['hadeethenc:2962', 'hadeethenc:4560', 'hadeethenc:1751']);
    expect(evidence.records.every((r) => r.record.metadata.synthetic === false)).toBe(true);
  });

  it('keeps Arabic, grading, translation and provenance verbatim', async () => {
    const { evidence } = await evidenceFor(HADEETHENC_ID);
    const rec = evidence.records.find((r) => r.record.canonical_key === 'hadeethenc:2962')!.record;
    const ar = JSON.parse(FIXTURES[hadeethUrl('2962', 'ar')].toString('utf8'));
    const en = JSON.parse(FIXTURES[hadeethUrl('2962', 'en')].toString('utf8'));
    const content = rec.content as Record<string, Record<string, unknown>>;
    expect(content.ar).toEqual(ar);
    expect(content.en).toEqual(en);
    expect(content.ar.hadeeth).toBe(ar.hadeeth); // harakat untouched
    expect(content.ar.hadeeth).toMatch(/[ً-ْ]/);
    expect(content.ar.reference).toContain('صحيح البخاري');
    expect(content.en.grade_ar).toBe(en.grade_ar);
    expect(rec.upstream_record_id).toBe('2962');
    expect(rec.metadata.source_urls).toEqual({ ar: hadeethUrl('2962', 'ar'), en: hadeethUrl('2962', 'en') });
  });

  it('repeat fetch of identical bytes is byte-identical evidence → NO_CHANGE', async () => {
    const a = await evidenceFor(HADEETHENC_ID);
    const b = await evidenceFor(HADEETHENC_ID);
    expect(a.evidence.rawSha256).toBe(b.evidence.rawSha256);
    expect(a.evidence.canonicalSha256).toBe(b.evidence.canonicalSha256);
    const fp = (e: typeof a.evidence) => ({ upstreamLabel: e.payload.upstreamVersionLabel, rawSha256: e.rawSha256, canonicalSha256: e.canonicalSha256 });
    expect(classifyObservation(fp(a.evidence), fp(b.evidence), { labelPublished: false }).status).toBe('NO_CHANGE');
  });

  it('a (test-only, in-memory) upstream grading change diffs as SCHOLAR_JUDGMENT and is not called a silent mutation of a label HadeethEnc never published', async () => {
    const before = await evidenceFor(HADEETHENC_ID);
    const ar = JSON.parse(FIXTURES[hadeethUrl('2962', 'ar')].toString('utf8'));
    const after = await evidenceFor(HADEETHENC_ID, { [hadeethUrl('2962', 'ar')]: Buffer.from(JSON.stringify({ ...ar, grade: 'TEST-ONLY' })) });
    const changes = diffPayloads(before.evidence.payload, after.evidence.payload, hadeethencConnector.definition.fieldRoles);
    expect(changes.map((c) => [c.canonicalKey, c.fieldPath, c.fieldRole])).toEqual([['hadeethenc:2962', 'ar.grade', 'SCHOLAR_JUDGMENT']]);
    const fp = (e: typeof before.evidence) => ({ upstreamLabel: e.payload.upstreamVersionLabel, rawSha256: e.rawSha256, canonicalSha256: e.canonicalSha256 });
    const c = classifyObservation(fp(before.evidence), fp(after.evidence), { labelPublished: false });
    expect(c.status).toBe('NEW_VERSION');
    expect(c.silentMutation).toBe(false);
  });
});

describe('QuranEnc', () => {
  it('uses the translation\'s own published version and timestamp; one source = one translation', async () => {
    const { evidence } = await evidenceFor(QURANENC_ID);
    const list = JSON.parse(FIXTURES[translationsListUrl()].toString('utf8')).translations as Array<{ key: string; version: string; last_update: number }>;
    const entry = list.find((t) => t.key === 'english_saheeh')!;
    expect(evidence.payload.upstreamVersionLabel).toBe(entry.version);
    expect(evidence.payload.upstreamPublishedAt).toBe(new Date(entry.last_update * 1000).toISOString());
    expect((evidence.payload.metadata?.translation as Record<string, unknown>).key).toBe('english_saheeh');
    // Other translations in the same list are never imported.
    expect(JSON.stringify(evidence.payload.metadata)).not.toContain('english_rwwad');
  });

  it('normalizes every ayah with stable surah/ayah/translation identity and exact Arabic', async () => {
    const { evidence } = await evidenceFor(QURANENC_ID);
    const keys = evidence.records.map((r) => r.record.canonical_key);
    expect(keys).toHaveLength(7 + 4);
    expect(keys).toContain('quranenc:english_saheeh:1:1');
    expect(keys).toContain('quranenc:english_saheeh:112:4');
    const s112 = JSON.parse(FIXTURES[suraUrl('112')].toString('utf8')).result[0];
    const rec = evidence.records.find((r) => r.record.canonical_key === 'quranenc:english_saheeh:112:1')!.record;
    expect(rec.content).toEqual(s112);
    expect(rec.content.arabic_text).toBe(s112.arabic_text);
    expect(rec.metadata).toMatchObject({ translation_key: 'english_saheeh', language_iso_code: 'en', synthetic: false });
  });

  it('a same-version upstream change is a silent mutation (QuranEnc publishes labels); role is TRANSLATION', async () => {
    const before = await evidenceFor(QURANENC_ID);
    const s112 = JSON.parse(FIXTURES[suraUrl('112')].toString('utf8'));
    s112.result[0].translation = 'TEST-ONLY';
    const after = await evidenceFor(QURANENC_ID, { [suraUrl('112')]: Buffer.from(JSON.stringify(s112)) });
    const changes = diffPayloads(before.evidence.payload, after.evidence.payload, quranencConnector.definition.fieldRoles);
    expect(changes.map((c) => [c.fieldPath, c.fieldRole])).toEqual([['translation', 'TRANSLATION']]);
    const fp = (e: typeof before.evidence) => ({ upstreamLabel: e.payload.upstreamVersionLabel, rawSha256: e.rawSha256, canonicalSha256: e.canonicalSha256 });
    expect(classifyObservation(fp(before.evidence), fp(after.evidence), { labelPublished: true }).silentMutation).toBe(true);
  });
});

describe('failure safety (no fake versions)', () => {
  const expectFetchFailure = async (p: Promise<unknown>) => {
    const err = await p.then(() => null, (e) => e);
    expect(err).toBeInstanceOf(SourceFetchError);
    expect((err as Error).message).toBe('SOURCE_FETCH_FAILED');
  };

  it('upstream HTTP error, network failure, non-JSON, empty and oversized bodies all fail the whole check', async () => {
    const url = hadeethUrl('2962', 'en');
    const urls = hadeethencConnector.requestUrls();
    await expectFetchFailure(fetchBundle(HADEETHENC_ID, urls, fakeFetcher({ [url]: { status: 503 } }).fetcher));
    await expectFetchFailure(fetchBundle(HADEETHENC_ID, urls, fakeFetcher({ [url]: { throws: true } }).fetcher));
    await expectFetchFailure(fetchBundle(HADEETHENC_ID, urls, fakeFetcher({ [url]: { type: 'text/html' } }).fetcher));
    await expectFetchFailure(fetchBundle(HADEETHENC_ID, urls, fakeFetcher({ [url]: Buffer.alloc(0) }).fetcher));
    await expectFetchFailure(fetchBundle(HADEETHENC_ID, urls, fakeFetcher({ [url]: Buffer.alloc(MAX_RESPONSE_BYTES + 1, 32) }).fetcher));
  });

  it('malformed or mismatched responses are rejected by the normalizer', async () => {
    await expectFetchFailure(evidenceFor(HADEETHENC_ID, { [hadeethUrl('4560', 'ar')]: Buffer.from('{not json') }));
    await expectFetchFailure(evidenceFor(HADEETHENC_ID, { [hadeethUrl('4560', 'ar')]: Buffer.from('{"id":"4560"}') }));
    await expectFetchFailure(evidenceFor(HADEETHENC_ID, { [hadeethUrl('4560', 'ar')]: Buffer.from('{"id":"9999","hadeeth":"x"}') }));
    await expectFetchFailure(evidenceFor(QURANENC_ID, { [translationsListUrl()]: Buffer.from('{"translations":[]}') }));
    await expectFetchFailure(evidenceFor(QURANENC_ID, { [suraUrl('1')]: Buffer.from('{"result":[]}') }));
  });

  it('a tampered stored bundle is detected', async () => {
    const { raw } = await evidenceFor(QURANENC_ID);
    const bundle = JSON.parse(raw.toString('utf8'));
    bundle.responses[1].bodyBase64 = Buffer.from('{"result":[]}').toString('base64');
    expect(() => prepareSourceEvidence(QURANENC_ID, Buffer.from(JSON.stringify(bundle)))).toThrow('SOURCE_FETCH_FAILED');
    expect(() => prepareSourceEvidence(HADEETHENC_ID, raw)).toThrow('SOURCE_FETCH_FAILED'); // bundle for another source
  });
});

describe('no secret leakage', () => {
  it('sends no credentials and stores no headers in the raw bundle', async () => {
    const { fetcher, calls } = fakeFetcher();
    const raw = await fetchBundle(QURANENC_ID, quranencConnector.requestUrls(), fetcher);
    for (const c of calls) {
      const headers = Object.keys((c.init.headers ?? {}) as Record<string, string>).map((h) => h.toLowerCase());
      expect(headers.sort()).toEqual(['accept', 'user-agent']);
      expect(c.init.method).toBe('GET');
    }
    const bundle = JSON.parse(raw.toString('utf8'));
    expect(Object.keys(bundle).sort()).toEqual(['connector', 'format', 'responses']);
    expect(Object.keys(bundle.responses[0]).sort()).toEqual(['bodyBase64', 'bodySha256', 'status', 'url']);
    expect(raw.toString('utf8')).not.toMatch(/authorization|api[_-]?key|secret|token/i);
  });
});
