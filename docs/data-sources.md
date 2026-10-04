# Data sources

Istithbat monitors upstream Islamic knowledge sources. It never edits them. Real sources are read-only. The **Hadith Evidence Sandbox** is the only source Istithbat intentionally changes, and everything in it is synthetic.

Terms were checked on **4 October 2026**.

| | Hadith Evidence Sandbox | HadeethEnc | QuranEnc |
|---|---|---|---|
| **Kind** | Controlled synthetic demo source | Real, read-only | Real, read-only |
| **Istithbat source id** | `hadith-evidence-sandbox` | `hadeethenc` | `quranenc-english-saheeh` |
| **Provider** | Istithbat (demo infrastructure) | HadeethEnc.com (Islamic Content Service Association) | QuranEnc.com (Islamic Content Service Association) |
| **Official URL** | — | https://hadeethenc.com | https://quranenc.com |
| **Access method** | Internal endpoint `/api/sandbox/current` | Public REST API `https://hadeethenc.com/api/v1` (docs: hadeethenc.com/api-docs). No key | Public REST API `https://quranenc.com/api/v1` (docs: quranenc.com/en/home/api). No key |
| **Data used** | One synthetic record, `HAD-4821` | 3 hadith entries (ids 2962, 4560, 1751). Each is fetched in Arabic and in English | Translation `english_saheeh` (Noor International Center), surahs 1 and 112. Also the translation's own `version` and `last_update` from the official translations list |
| **Purpose** | Controlled mutation demo and evaluation | Real-source integrity monitoring: snapshot, hash, diff, provenance | Real-source integrity monitoring: snapshot, hash, diff, provenance |
| **Terms / licence** | Authored for this project | No modification, addition or deletion of the content. The publisher and the source (HadeethEnc.com) must be credited clearly | Translations may be downloaded and re-published with no modification, addition or deletion. The publisher and the source (QuranEnc.com) must be credited clearly |
| **Attribution** | — | "Source: HadeethEnc.com", stored on the source record | "Source: QuranEnc.com, translation english_saheeh (Noor International Center)", stored on the source record |
| **Storage** | Repo fixtures, plus a private snapshot bucket | Exact response bytes are kept in the **private** snapshot bucket only | Exact response bytes are kept in the **private** snapshot bucket only |
| **Redistribution / public repo** | Fixtures are public and fully synthetic | Runtime snapshots are not redistributed. The repo holds only small, unmodified test fixtures with attribution (`tests/fixtures/real/`) | Runtime snapshots are not redistributed. The repo holds only small, unmodified test fixtures with attribution (`tests/fixtures/real/`) |
| **Mutation policy** | The only intentionally mutated source. Every value is synthetic and labelled | Never mutated. A change is reported only if HadeethEnc itself changes its response | Never mutated. A change is reported only if QuranEnc itself changes its response |
| **Version label** | Fixture label (`v13`, `v14`) | None is published. The label is the literal `unversioned` | The translation's own published `version` (for example `1.1.2`) |

## How real sources are monitored

1. A source check fetches the connector's fixed, bounded set of official URLs. It sends no credentials.
2. The raw snapshot stores each response's exact bytes and its SHA-256. It contains no headers or timestamps, so identical upstream bytes always give an identical raw hash, which means **NO_CHANGE**.
3. The connector's normalizer maps the responses into the shared `SourcePayload`. Normalization keeps every upstream field verbatim and adds nothing. After that, canonicalization, record and field hashes, exact diff, policy and review are the same for every source.
4. If any request fails, or a response is malformed, empty or oversized, the check fails with `SOURCE_FETCH_FAILED`. The connector is then marked `DEGRADED`. No version is created and the previous evidence is kept.
5. A real source's first snapshot has nothing to compare against. It is accepted as the monitoring baseline only by an explicit, audited operator step (`BASELINE_ESTABLISHED`). Every later change goes through the normal pipeline, policy and human review.
6. *Silent mutation* means the same provider-published version label with a different content fingerprint. It is claimed only for providers that actually publish a version label. For HadeethEnc, a changed response is recorded as a new revision with its exact diff, but it is not called a silent mutation.
