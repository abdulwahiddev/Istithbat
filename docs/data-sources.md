# Data sources

Istithbat monitors upstream Islamic knowledge sources. It never edits them. Real sources are read-only. The **Hadith Evidence Sandbox** is the only source Istithbat intentionally changes, and every altered candidate is a clearly labelled controlled test. Its current Production scenario preserves the original HadeethEnc 10618 record unchanged; the earlier fully synthetic fixtures remain available for tests and historical evaluation.

Terms were checked on **4 October 2026**.

| | Hadith Evidence Sandbox | HadeethEnc | QuranEnc |
|---|---|---|---|
| **Kind** | Controlled integrity-test simulator | Real, read-only | Real, read-only |
| **Istithbat source id** | `hadith-evidence-sandbox` | `hadeethenc` | `quranenc-english-saheeh` |
| **Provider** | Istithbat (demo infrastructure) | HadeethEnc.com (Islamic Content Service Association) | QuranEnc.com (Islamic Content Service Association) |
| **Official URL** | — | https://hadeethenc.com | https://quranenc.com |
| **Access method** | Internal endpoint `/api/sandbox/current` | Public REST API `https://hadeethenc.com/api/v1` (docs: hadeethenc.com/api-docs). No key | Public REST API `https://quranenc.com/api/v1` (docs: quranenc.com/en/home/api). No key |
| **Data used** | One source-derived HadeethEnc 10618 record per active sandbox version; earlier synthetic `HAD-4821` remains evaluation-only | 3 hadith entries (ids 2962, 4560, 1751). Each is fetched in Arabic and in English | Translation `english_saheeh` (Noor International Center), surahs 1 and 112. Also the translation's own `version` and `last_update` from the official translations list |
| **Purpose** | Controlled mutation demo and evaluation | Real-source integrity monitoring: snapshot, hash, diff, provenance | Real-source integrity monitoring: snapshot, hash, diff, provenance |
| **Terms / licence** | Authored for this project | No modification, addition or deletion of the content. The publisher and the source (HadeethEnc.com) must be credited clearly | Translations may be downloaded and re-published with no modification, addition or deletion. The publisher and the source (QuranEnc.com) must be credited clearly |
| **Attribution** | — | "Source: HadeethEnc.com", stored on the source record | "Source: QuranEnc.com, translation english_saheeh (Noor International Center)", stored on the source record |
| **Storage** | Repo fixtures, plus a private snapshot bucket | Exact response bytes are kept in the **private** snapshot bucket only | Exact response bytes are kept in the **private** snapshot bucket only |
| **Redistribution / public repo** | Original 10618 source fields retain attribution; altered grading is a separately labelled Istithbat test, never a provider publication | Runtime snapshots are not redistributed. The repo holds only small, unmodified test fixtures with attribution (`tests/fixtures/real/`) | Runtime snapshots are not redistributed. The repo holds only small, unmodified test fixtures with attribution (`tests/fixtures/real/`) |
| **Mutation policy** | The only intentionally mutated source. Only `ar.grade` changes in source-derived 10618; other original fields remain exact | Never mutated. A change is reported only if HadeethEnc itself changes its response | Never mutated. A change is reported only if QuranEnc itself changes its response |
| **Version label** | Fixture label (`v13`, `v14`) | None is published. The label is the literal `unversioned` | The translation's own published `version` (for example `1.1.2`) |

## How real sources are monitored

1. A source check fetches the connector's fixed, bounded set of official URLs. It sends no credentials.
2. The raw snapshot stores each response's exact bytes and its SHA-256. It contains no headers or timestamps, so identical upstream bytes always give an identical raw hash, which means **NO_CHANGE**.
3. The connector's normalizer maps the responses into the shared `SourcePayload`. Normalization keeps every upstream field verbatim and adds nothing. After that, canonicalization, record and field hashes, exact diff, policy and review are the same for every source.
4. If any request fails, or a response is malformed, empty or oversized, the check fails with `SOURCE_FETCH_FAILED`. The connector is then marked `DEGRADED`. No version is created and the previous evidence is kept.
5. A real source's first snapshot has nothing to compare against. It is accepted as the monitoring baseline only by an explicit, audited operator step (`BASELINE_ESTABLISHED`). Every later change goes through the normal pipeline, policy and human review.
6. *Silent mutation* means the same provider-published version label with a different content fingerprint. It is claimed only for providers that actually publish a version label. For HadeethEnc, a changed response is recorded as a new revision with its exact diff, but it is not called a silent mutation.

## Complete provider terms and version provenance

Official terms rechecked on 6 October 2026: [QuranEnc API/terms](https://quranenc.com/en/home/api/) and [HadeethEnc Terms and Policies](https://hadeethenc.com/en/home) (with [official API documentation](https://hadeethenc.com/api-docs)). The table above is a summary, not the entire publication permission.

Both sources require preserving content without edits, crediting source/publisher, retaining transcript information, identifying the published version where supplied, incorporating later provider updates, communicating translation observations to the provider, and avoiding inappropriate advertising alongside displayed religious content. These obligations apply independently of Istithbat's software licence. Immutable historical snapshots document an observed state; they are not presented as the provider's current religious authority.

QuranEnc's selected catalog attributes `english_saheeh` to **Noor International Center**, with observed version **1.1.2**. Preserve that actual metadata rather than inferring a different publisher from the translation key. HadeethEnc exposes no verified API version label; `unversioned` is an internal sentinel, not an invented provider version. Exact response bytes, original source fields and content attribution remain available in private evidence.

## Production corpus versus full-corpus validation

Production monitoring remains **three HadeethEnc records** and **eleven QuranEnc ayat**. The separate explicit validator completed two passes over **3,574 unique Arabic HadeethEnc records / 2,328 advertised English translations**, and **114 QuranEnc surahs / 6,236 ayat**. All raw/canonical/record/field hashes matched. HadeethEnc completeness is scoped to the documented Arabic root-category union and these supported languages.

The [public measured report](../evaluation/results/2026-10-06-real-corpus.md) and [machine-readable hashes](../evaluation/results/2026-10-06-real-corpus.json) describe private verification artifacts. They are not a full-corpus Production ingestion, a trust decision or a religious-correctness evaluation. No thousands-of-request download is part of standard tests. See [explicit invocation and pacing](../evaluation/corpus/README.md).

Software/services/models/font attribution is listed separately in the [third-party register](third-party-register.md).
