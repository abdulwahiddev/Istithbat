# Explicit real-source corpus validation

This read-only integration benchmark is separate from unit tests, the small production connector scope, synthetic mutation fixtures, and the official Packet 07 evaluation. It uses no database, Storage, AI, or privileged credentials. It neither creates a baseline nor grants trust.

## Run

```sh
pnpm corpus:validate --source all --out private-data/corpus-runs/my-run
# Or --source quranenc / --source hadeethenc
pnpm corpus:validate --verify private-data/corpus-runs/my-run/quranenc/pass-1
```

Choose a new output directory. Existing evidence is never overwritten. `private-data/` is ignored; do not commit or publicly redistribute the response bodies. Keep the private artifact alongside its public hash report for reproducibility. Offline verification checks bundled raw body hashes, reconstructs normalized content, and verifies canonical bytes, record hashes, and field hashes. Live repeat passes are independent discoveries; differences are reported rather than edited away. Upstream changes can legitimately make a later run differ.

## Scope and checks

- **QuranEnc:** selected `english_saheeh` translation, all 114 complete surahs, 6,236 ayat. Catalog version, timestamp and publisher are copied from the official API. Catalogs bookend each pass and must agree. Per-surah count table observed from the official API on 2026-10-06 (`quran-counts.json`), sura identities, sequential ayah numbers, unique upstream IDs, unique canonical keys and total count are checked. Exact Arabic, translation, footnotes and unknown fields are retained.
- **HadeethEnc:** union of every page of the official Arabic root-category catalogs; Arabic plus English where the catalog advertises it. Category membership totals overlap and are not unique corpus counts. Root counts, page metadata, page totals, duplicates, catalog language consistency, detail batch identities and missing translations are checked. Complete means complete for this documented accessible scope, not every record in every website language or unpublished record. Provider publishes no version label; retain `unversioned`.
- HadeethEnc uses documented `per_page=20` and `hadeeths/multiple` batches of 20 IDs. Batch size 20 is our conservative choice, not a published provider limit. QuranEnc uses one request per complete surah.
- Global serial queue: one request in flight, at least one second between starts. Twenty-second request timeout, three total attempts for network/408/429/5xx only, exponential backoff starting at two seconds; honor longer `Retry-After`. Permanent HTTP/schema/count failures stop the run. Four MB response cap; 256 MB successful-body cap per pass. Partial successful bodies remain private evidence; incomplete passes get a failure report and never a success summary.
- Provider documentation gives no numeric request quota or official maximum detail batch size. This is a deliberately polite client policy, not a promise of unlimited provider capacity.

## Attribution and terms

Official documentation: [QuranEnc API and terms](https://quranenc.com/en/home/api/), [HadeethEnc API](https://hadeethenc.com/api-docs), [official HadeethEnc Postman documentation](https://documenter.getpostman.com/view/5211979/TVev3j7q).

QuranEnc catalog currently attributes `english_saheeh` to **Noor International Center**, version **1.1.2**. Use that actual publisher metadata, not an inference from the translation key. HadeethEnc attribution: **HadeethEnc.com, Encyclopedia of Translated Prophetic Hadiths**, Islamic Content Service Association. Keep the exact original response/transcript information. Both providers require no content modification/addition/deletion and clear publisher/source attribution. Their publication terms also require keeping current versions and appropriate presentation. These artifacts are private verification evidence, not rewritten religious material or public redistribution.

## Trust and production

Artifacts remain **UNASSESSED**, never TRUSTED or served. Existing real baselines, held sandbox and trusted/served versions are untouched. Expanding an existing production source changes its record set: it must go through the existing ingestion, policy and review process as additions; it cannot silently establish another baseline. Before any import, size the pipeline/context/diff workload and function runtime, preserve private immutable snapshots, and arrange explicit review. This command intentionally has no import flag.

## Synthetic coverage

`evaluation/synthetic-extended/` contains independently authored software-test text with explicit synthetic markers, fictional attribution, and no religious rulings or source claims. It covers longer Arabic judgment text, translation/provenance changes, punctuation, harakat, multiple fields, and multiline values through the existing hash/diff/field-role logic. It does not change the frozen demo fixtures or the official 40-case rubric/results.
