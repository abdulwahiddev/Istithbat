import { z } from 'zod';
import type { JsonValue } from '@/lib/hashing/canonicalize';
import { bodyJson, SourceFetchError } from './http-bundle';
import { UNVERSIONED_LABEL, type HttpConnector, type NormalizedPayload } from './http-connector';

/**
 * HadeethEnc.com (موسوعة الأحاديث النبوية): organizer-backed, read-only.
 * Official API: https://hadeethenc.com/api/v1 (documented at hadeethenc.com/api-docs). No key.
 * Terms: no modification, addition or deletion of content; clearly credit the publisher and source.
 *
 * Scope (bounded MVP subset): a fixed list of hadith IDs, each fetched in Arabic and English.
 * Both responses are kept verbatim inside one record, so the Arabic `reference` (book/volume/page)
 * and the English translation are preserved side by side without flattening or re-wording.
 * HadeethEnc publishes no version label or timestamp, so the label is the literal 'unversioned'.
 */

export const HADEETHENC_ID = 'hadeethenc';
export const HADEETHENC_API = 'https://hadeethenc.com/api/v1';
/** Fixed representative subset; extending it changes the record set and is recorded as RECORD_ADDED. */
export const HADEETHENC_HADITH_IDS = ['2962', '4560', '1751'] as const;
export const HADEETHENC_LANGUAGES = ['ar', 'en'] as const;

export function hadeethUrl(id: string, language: string): string {
  return `${HADEETHENC_API}/hadeeths/one/?language=${language}&id=${id}`;
}

// Only the identity and the hadith text are required; every other field is optional and kept
// exactly as received. Unknown upstream fields pass through (and diff as UNCLASSIFIED → REVIEW).
const hadeethResponse = z
  .object({ id: z.union([z.string(), z.number()]).transform(String), hadeeth: z.string().min(1) })
  .passthrough();

export const hadeethencConnector: HttpConnector = {
  definition: {
    sourceId: HADEETHENC_ID,
    contentLevel: 'A',
    publishesVersionLabel: false,
    // Declared, never inferred (D-02). `ar.*` is the Arabic response; `en.*` is the English
    // response, which also carries the Arabic original in its `*_ar` fields.
    fieldRoles: {
      'ar.hadeeth': 'AUTHORITATIVE_TEXT',
      'ar.hadeeth_intro': 'AUTHORITATIVE_TEXT',
      'ar.title': 'AUTHORITATIVE_TEXT',
      'ar.grade': 'SCHOLAR_JUDGMENT',
      'ar.attribution': 'PROVENANCE',
      'ar.reference': 'PROVENANCE',
      'ar.explanation': 'COMMENTARY',
      'ar.hints[]': 'COMMENTARY',
      'ar.words_meanings[]': 'COMMENTARY',
      'ar.categories[]': 'OPERATIONAL_METADATA',
      'ar.translations[]': 'OPERATIONAL_METADATA',
      'ar.id': 'OPERATIONAL_METADATA',
      'en.hadeeth_ar': 'AUTHORITATIVE_TEXT',
      'en.hadeeth_intro_ar': 'AUTHORITATIVE_TEXT',
      'en.grade_ar': 'SCHOLAR_JUDGMENT',
      'en.attribution_ar': 'PROVENANCE',
      'en.explanation_ar': 'COMMENTARY',
      'en.hints_ar[]': 'COMMENTARY',
      'en.words_meanings_ar[]': 'COMMENTARY',
      'en.hadeeth': 'TRANSLATION',
      'en.hadeeth_intro': 'TRANSLATION',
      'en.title': 'TRANSLATION',
      // A translated grading still states a judgment; changes to it are judgment changes.
      'en.grade': 'SCHOLAR_JUDGMENT',
      'en.attribution': 'PROVENANCE',
      'en.explanation': 'COMMENTARY',
      'en.hints[]': 'COMMENTARY',
      'en.words_meanings[]': 'COMMENTARY',
      'en.categories[]': 'OPERATIONAL_METADATA',
      'en.translations[]': 'OPERATIONAL_METADATA',
      'en.id': 'OPERATIONAL_METADATA',
      record_metadata: 'OPERATIONAL_METADATA',
      metadata: 'OPERATIONAL_METADATA',
    },
  },
  source: {
    id: HADEETHENC_ID,
    name: 'HadeethEnc — Encyclopedia of Translated Prophetic Hadiths',
    provider: 'HadeethEnc.com (Islamic Content Service Association)',
    sourceType: 'HADITH',
    connectorType: 'HTTP_API',
    endpoint: HADEETHENC_API,
    rightsNote:
      'Source: HadeethEnc.com. Content used without modification, addition or deletion, with clear attribution to the publisher and source, per the HadeethEnc API terms. Read-only; never mutated by Istithbat. Snapshots are kept in private storage and are not redistributed.',
  },
  requestUrls() {
    return HADEETHENC_HADITH_IDS.flatMap((id) => HADEETHENC_LANGUAGES.map((lang) => hadeethUrl(id, lang)));
  },
  normalize(responses) {
    const records = HADEETHENC_HADITH_IDS.map((id) => {
      const byLanguage: Record<string, JsonValue> = {};
      const sourceUrls: Record<string, JsonValue> = {};
      for (const lang of HADEETHENC_LANGUAGES) {
        const url = hadeethUrl(id, lang);
        const parsed = hadeethResponse.safeParse(bodyJson(responses, url));
        if (!parsed.success) throw new SourceFetchError(`malformed HadeethEnc response for id ${id} (${lang})`);
        if (parsed.data.id !== id) throw new SourceFetchError(`HadeethEnc returned id ${parsed.data.id} for requested id ${id}`);
        // Verbatim: the upstream object as received (re-parsed, so key order is irrelevant to the canonical form).
        byLanguage[lang] = JSON.parse(responses.find((r) => r.url === url)!.body.toString('utf8')) as JsonValue;
        sourceUrls[lang] = url;
      }
      return {
        canonical_key: `hadeethenc:${id}`,
        upstream_record_id: id,
        content: byLanguage,
        metadata: { synthetic: false, provider: 'HadeethEnc.com', hadeeth_id: id, languages: [...HADEETHENC_LANGUAGES], source_urls: sourceUrls },
      };
    });
    if (records.length === 0) throw new SourceFetchError('HadeethEnc produced no records');
    const payload: NormalizedPayload = {
      upstreamVersionLabel: UNVERSIONED_LABEL,
      records,
      metadata: {
        synthetic: false,
        provider: 'HadeethEnc.com',
        connector: 'hadeethenc/1',
        api: HADEETHENC_API,
        version_label: 'none published by provider',
        terms: 'No modification, addition or deletion of the content; clearly refer to the publisher and the source (HadeethEnc.com).',
      },
    };
    return payload;
  },
};
