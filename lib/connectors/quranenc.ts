import { z } from 'zod';
import type { JsonValue } from '@/lib/hashing/canonicalize';
import { bodyJson, SourceFetchError } from './http-bundle';
import type { HttpConnector, NormalizedPayload } from './http-connector';

/**
 * QuranEnc.com (موسوعة القرآن الكريم): organizer-backed, read-only.
 * Official API: https://quranenc.com/api/v1 (documented at quranenc.com/en/home/api). No key.
 * Terms: translations may be downloaded and re-published with no modification, addition or
 * deletion, and with clear reference to the publisher and the source (QuranEnc.com).
 *
 * One Istithbat source = one translation, so different translations are never conflated.
 * The version label is the translation's own published `version`; `last_update` is kept as the
 * upstream timestamp. Scope (bounded MVP subset): two complete surahs.
 */

export const QURANENC_API = 'https://quranenc.com/api/v1';
export const QURANENC_TRANSLATION_KEY = 'english_saheeh';
export const QURANENC_LANGUAGE = 'en';
export const QURANENC_ID = `quranenc-${QURANENC_TRANSLATION_KEY.replace(/_/g, '-')}`;
/** Al-Fatiha and Al-Ikhlas: complete surahs, small and stable. */
export const QURANENC_SURAHS = ['1', '112'] as const;

export const translationsListUrl = () => `${QURANENC_API}/translations/list/${QURANENC_LANGUAGE}`;
export const suraUrl = (sura: string) => `${QURANENC_API}/translation/sura/${QURANENC_TRANSLATION_KEY}/${sura}`;

const translationEntry = z
  .object({
    key: z.string(),
    language_iso_code: z.string(),
    version: z.string().regex(/^[A-Za-z0-9._-]+$/),
    last_update: z.number().int().nonnegative(),
    title: z.string(),
    description: z.string().nullable().optional(),
    direction: z.string().optional(),
  })
  .passthrough();
const ayah = z
  .object({ id: z.string(), sura: z.string(), aya: z.string(), arabic_text: z.string().min(1), translation: z.string().min(1) })
  .passthrough();
const suraResponse = z.object({ result: z.array(ayah).min(1) });

export const quranencConnector: HttpConnector = {
  definition: {
    sourceId: QURANENC_ID,
    contentLevel: 'A',
    publishesVersionLabel: true,
    fieldRoles: {
      arabic_text: 'AUTHORITATIVE_TEXT',
      translation: 'TRANSLATION',
      footnotes: 'COMMENTARY',
      sura: 'PROVENANCE',
      aya: 'PROVENANCE',
      id: 'OPERATIONAL_METADATA',
      record_metadata: 'OPERATIONAL_METADATA',
      metadata: 'OPERATIONAL_METADATA',
    },
  },
  source: {
    id: QURANENC_ID,
    name: 'QuranEnc — English translation (Saheeh International)',
    provider: 'QuranEnc.com (Islamic Content Service Association)',
    sourceType: 'QURAN_TRANSLATION',
    connectorType: 'HTTP_API',
    endpoint: QURANENC_API,
    rightsNote:
      'Source: QuranEnc.com, translation "english_saheeh" (Noor International Center). Re-published without modification, addition or deletion, with clear reference to the publisher and source, per the QuranEnc terms. Read-only; never mutated by Istithbat. Snapshots are kept in private storage.',
  },
  requestUrls() {
    return [translationsListUrl(), ...QURANENC_SURAHS.map(suraUrl)];
  },
  normalize(responses) {
    const list = z.object({ translations: z.array(translationEntry) }).safeParse(bodyJson(responses, translationsListUrl()));
    if (!list.success) throw new SourceFetchError('malformed QuranEnc translations list');
    const entry = list.data.translations.find((t) => t.key === QURANENC_TRANSLATION_KEY);
    if (!entry) throw new SourceFetchError(`translation ${QURANENC_TRANSLATION_KEY} is not listed by QuranEnc`);
    if (entry.language_iso_code !== QURANENC_LANGUAGE) throw new SourceFetchError('translation language mismatch');

    const records = QURANENC_SURAHS.flatMap((sura) => {
      const parsed = suraResponse.safeParse(bodyJson(responses, suraUrl(sura)));
      if (!parsed.success) throw new SourceFetchError(`malformed QuranEnc response for surah ${sura}`);
      return parsed.data.result.map((a) => {
        if (a.sura !== sura) throw new SourceFetchError(`QuranEnc returned surah ${a.sura} for requested surah ${sura}`);
        return {
          canonical_key: `quranenc:${QURANENC_TRANSLATION_KEY}:${a.sura}:${a.aya}`,
          upstream_record_id: a.id,
          content: a as unknown as { [key: string]: JsonValue },
          metadata: {
            synthetic: false,
            provider: 'QuranEnc.com',
            translation_key: QURANENC_TRANSLATION_KEY,
            language_iso_code: entry.language_iso_code,
            source_url: suraUrl(sura),
          },
        };
      });
    });
    const keys = new Set(records.map((r) => r.canonical_key));
    if (keys.size !== records.length) throw new SourceFetchError('duplicate surah/ayah identity in QuranEnc response');

    const payload: NormalizedPayload = {
      upstreamVersionLabel: entry.version,
      upstreamPublishedAt: new Date(entry.last_update * 1000).toISOString(),
      records,
      metadata: {
        synthetic: false,
        provider: 'QuranEnc.com',
        connector: 'quranenc/1',
        api: QURANENC_API,
        // Identity of the one translation this source tracks, copied from the official list.
        translation: {
          key: entry.key,
          language_iso_code: entry.language_iso_code,
          version: entry.version,
          last_update: entry.last_update,
          title: entry.title,
          description: entry.description ?? null,
          direction: entry.direction ?? null,
        },
        terms: 'No modification, addition or deletion of the content; clearly refer to the publisher and the source (QuranEnc.com).',
      },
    };
    return payload;
  },
};
