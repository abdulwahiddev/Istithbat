# Real-source full-corpus validation — 6 October 2026

Additional read-only connector benchmark. This does **not** replace Packet 07, evaluate religious correctness, assign trust, or import records into Production. Provider content was fetched unchanged; controlled mutations use separate independently authored synthetic fixtures.

## Official accessible scope

- QuranEnc: complete selected `english_saheeh` translation, **114 surahs / 6,236 ayat**. Actual catalog publisher: **Noor International Center**; version **1.1.2**, last-update timestamp **1750772247**. [Official API and terms](https://quranenc.com/en/home/api/).
- HadeethEnc: **7 Arabic root categories**, **4,273 overlapping category memberships**, **3,574 unique Arabic hadith records**, with **2,328 advertised English translations**. Complete for the documented root-category union and these supported languages; not a claim to cover every website language or unpublished record. No provider version label. [Official API](https://hadeethenc.com/api-docs), [official Postman documentation](https://documenter.getpostman.com/view/5211979/TVev3j7q).
- Neither published API document supplies a numeric request quota. HadeethEnc documents page/per-page parameters (default 20) and comma-separated IDs for multiple details, but no maximum batch size. We chose pages/batches of 20 and serial request starts paced at one second; no quota response was observed in the first passes. QuranEnc needs 114 surah calls plus two catalog checks rather than 6,236 individual ayah calls.

## Results

| Source | Records per pass | First / repeat duration | Requests first / repeat | Repeat hashes |
| --- | ---: | ---: | ---: | --- |
| QuranEnc | 6,236 | 121.6 / 116.8 seconds | 116 / 116 | Raw, canonical, record and field hashes identical |
| HadeethEnc | 3,574 (2,328 English translations) | 518.7 / 526.7 seconds | 514 / 515 | Raw, canonical, record and field hashes identical |

**9,810 logical records validated per pass; 1,261 total requests.** Zero quota responses. HadeethEnc repeat recovered from one transient request failure; the initial runner counted the retry but did not log whether it was a network timeout, HTTP 408, or HTTP 5xx. Both catalogs stayed consistent and there were zero added, removed or changed records between passes.

All four private artifacts passed offline verification. QuranEnc reconstruction/hashing took roughly 0.12 seconds and unchanged diff 0.02 seconds; HadeethEnc roughly 0.6 and 0.08 seconds. See [exact machine-readable measurements and hashes](2026-10-06-real-corpus.json). Successful passes validate counts, identity uniqueness, category pagination, advertised languages, bookend catalogs, exact raw evidence, shared canonicalization, record hashes and field hashes. Offline verification reconstructs every record from preserved response bodies. No-change diff uses existing declared connector field roles.

## Storage and Production recommendation

**Keep the private benchmark artifacts; do not import the full corpus into Production before submission.** Reasons grounded in this run:

- First QuranEnc pass took **121.6 seconds**; HadeethEnc took **518.7 seconds**. The existing Production check endpoint has a **60-second** limit.
- Per pass, QuranEnc's bundled raw evidence is **7,272,893 bytes** and canonical snapshot **4,659,154 bytes**. HadeethEnc's raw bundle is **84,902,325 bytes** and canonical snapshot **28,400,448 bytes**. Raw preservation includes base64 overhead; canonical byte sizes are not estimates of compressed Postgres relation size.
- Record/field-hash artifacts add **3,646,786** and **7,111,080 bytes** respectively. Two passes and per-response copies use **410,000,646 bytes** of local artifact files; this intentionally redundant evidence is larger than one production snapshot.
- Production currently has **16 record rows**, with a **188,416-byte records relation** including indexes/TOAST (read-only measurement). A complete new scope would contain **9,810 logical records**, requiring substantial new record and change persistence. The current ingestion path writes records and changes individually; this benchmark does not claim to measure full DB-import runtime or final indexed/compressed storage.
- Existing scopes remain three hadiths and eleven ayat. Expansion is a record-set change through normal ingestion/policy/review, never a second baseline or automatic trust. A later import needs a deliberate background/batch ingestion plan and reviewed release, not a longer synchronous demo request.

Private raw bodies are excluded from Git. The public companion report contains counts, timing, hashes, attribution and scope only. Preserve the private folder with the report to reproduce verification offline. See [run instructions](../corpus/README.md).

## Verification

New tests cover polite queueing, transient/quota backoff, permanent failures, unofficial hosts, full Quran counts, paginated Hadeeth identity/count/language consistency, tampered raw bundles, and seven richer synthetic hash/diff/policy cases. No live API request runs in normal unit tests. The original small connector tests still pass. Final full suite: **164 passed, seven optional live DB tests skipped**. Typecheck and Production build passed. All four local migration hashes match Production via read-only SQL; no migration applied. Secret-path and staged secret-value checks passed. Production remains three/eleven trusted real records; v14 r1 remains held QUARANTINED, zero reviews, v13 r1 served. No UI, trust, policy, regression, audit-write, serving, frozen document or official Packet 07 result change.
