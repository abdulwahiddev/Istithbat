# Technical evidence index

Audit date: **6 October 2026**. The original documentation audit used baseline `8c03325bff64c8300956b833c09f24a3d76f2680`; the later Production 10618 rehearsal used `6e28376aa9ae336e714487738fcdc5f89ad10d2c`. Evidence is dated and scoped; historical results are not silently relabelled as new runs.

## Verified claims

| Claim | Evidence | Scope / limitation |
| --- | --- | --- |
| Current tests/typecheck/build | Final engineering run: standard unit/component suite; typecheck; Production build; secret scan | 202 tests passed, eight optional database tests skipped. The frozen Packet 07 evaluation was not rerun. |
| Deterministic hashing and exact diff | [`lib/hashing/`](../lib/hashing/), [`lib/diff/`](../lib/diff/), [`tests/integrity.test.ts`](../tests/integrity.test.ts), [official result JSON](../evaluation/results/2026-10-05-packet-07.json) | 40/40 synthetic fixture passes; 38/38 expected changes with zero unexpected changes; 3/3 silent mutations. Hash equality establishes byte/normalized identity, not religious truth. |
| Deterministic policy | [`lib/policy/`](../lib/policy/), [Packet 07 report](evaluation.md) | 40/40 expected policy actions; forced failed AI quarantined 28/28 substantive cases, with 12 equivalent/metadata cases eligible for POL-005 ALLOW. |
| Live AI behavior | [Packet 07 report](evaluation.md), [frozen result JSON](../evaluation/results/2026-10-05-packet-07.json) | Complete 40-case synthetic evaluation; classification 90.0%, material recall 89.5%, false HIGH/CRITICAL 0/21, regression accuracy 57.5%; no religious-correctness claim. |
| Human safety review | [12-case review sheet](../evaluation/results/2026-10-05-safety-spot-check.md) | 12/12 human-approved; SAF-12 conservative mode mismatch; no retrieved records, so this is primarily an abstention/referral test. |
| Real connectors | [`tests/real-connectors.test.ts`](../tests/real-connectors.test.ts), [attributed response fixtures](../tests/fixtures/real/README.md), [source register](data-sources.md) | Production: three HadeethEnc records plus eleven QuranEnc ayat. Exact provider bytes are preserved privately. |
| Large-corpus integrity | [human-readable report](../evaluation/results/2026-10-06-real-corpus.md), [machine-readable report](../evaluation/results/2026-10-06-real-corpus.json), [rerun instructions](../evaluation/corpus/README.md) | Two independent passes; private raw artifact files are excluded from Git; not a Production import, AI benchmark or trust decision. |
| Production end-to-end lifecycle | [historical Packet 07 journey](evaluation.md#production-journey) | Earlier live cycles exercised ingestion, pipeline, POL-002 quarantine, human approval and atomic gateway switch. One repeat comparison failed twice and continued safely to policy; that comparison is not counted as successful. |
| Current containment | Authorized Production 10618 rehearsal and subsequent read-only API/SQL checks | Source-derived sandbox v14 r1 QUARANTINED; trusted/served v13 r2; three COMPLETE matched regressions, all MATERIAL; 6 exposed, 1 impacted, 0 stale. No review decision or promotion. |
| Reviewer authentication | [`tests/reviewer-auth.test.ts`](../tests/reviewer-auth.test.ts), [`lib/server/demo-auth.ts`](../lib/server/demo-auth.ts) | Server-validated username/password, signed 12-hour HttpOnly/Secure cookie, separate control/review privileges; demo authentication, not enterprise RBAC. |
| Signed sandbox webhook and continuation | [`tests/sandbox-console.test.ts`](../tests/sandbox-console.test.ts), [console notes](sandbox-demo.md), [`lib/pipeline/continue.ts`](../lib/pipeline/continue.ts) | Production reset/publish was owner-authorized. An immutable-path collision blocked the first webhook; the corrected deployment ingested the same published candidate. All 14 steps succeeded; one authenticated final continuation was needed to mark COMPLETE. |
| Public repo / deployment | [GitHub](https://github.com/abdulwahiddev/Istithbat), [overview](https://istithbat.vercel.app/overview), [sandbox](https://istithbat.vercel.app/sandbox) | Production deployment READY at verified engineering commit; this documentation pass does not change runtime behavior. |

## Full-corpus validation versus Production

| Source | Production monitoring baseline | Validated privately, per pass | First / repeat time |
| --- | ---: | ---: | ---: |
| QuranEnc `english_saheeh` | 11 ayat | 114 surahs / 6,236 ayat | 121.6 / 116.8 seconds |
| HadeethEnc Arabic root-category union | 3 hadith entries | 3,574 unique Arabic records; 2,328 available English translations | 518.7 / 526.7 seconds |

All raw, canonical, record and field hashes matched between repeat passes. QuranEnc catalog identified Noor International Center, version 1.1.2. HadeethEnc's seven root categories had 4,273 overlapping memberships; these are **not** 4,273 unique records. “Complete” is scoped to that accessible Arabic category union and advertised English translations, not every language or unpublished provider record.

The run made 1,261 requests in total, with zero quota responses and one recovered transient request failure of unrecorded subtype. Conservative serial pacing and retry/backoff are implementation choices; neither provider document supplies a numeric quota guarantee. The two-pass private evidence folder occupied approximately 410 MB, including intentionally redundant copies. This is not a measured Postgres import size.

Full-corpus artifacts remain unassessed and unserved. The command has no import flag. A future Production expansion needs deliberate ingestion, workload sizing and policy/review; it cannot silently create another trusted baseline. The historical corpus report's 60-second endpoint statement describes its then-current baseline; pipeline/check routes subsequently moved to 180 seconds. HadeethEnc's measured ~519-second first pass still exceeds that synchronous limit, and per-record persistence/AI work was not benchmarked as a bulk database import.

## Inspect current persisted evidence without writing

Read-only routes include:

- `GET /api/health`
- `GET /api/sources`
- `GET /api/sandbox/current` and `GET /api/sandbox/status`
- `GET /api/incidents` and `GET /api/incidents/{incidentId}`
- `GET /api/incidents/{incidentId}/regressions`
- `GET /api/incidents/{incidentId}/blast-radius`
- `GET /api/pipeline/{runId}` and `GET /api/gateway`

The currently held [10618 incident](https://istithbat.vercel.app/incidents/863d5b03-fc98-4d49-a2a6-ae9d6c3cf753) is `863d5b03-fc98-4d49-a2a6-ae9d6c3cf753`. Its regression read includes question order, version/revision identities, structured old/new answers, configuration and verdict evidence; unknown historical fields remain unknown. Core tests also cover the historical nullable comparison bug that formerly caused HTTP 500.

The private full-corpus raw artifacts are not downloadable from GitHub. Judges can inspect the public summary/hashes and rerun the explicit validator against the official APIs. Later upstream changes may legitimately produce different hashes. Private evidence preservation is an operator responsibility, not an implied public artifact distribution.
