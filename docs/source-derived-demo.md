# HadeethEnc 10618 — isolated end-to-end validation

**Scope:** production build running locally, actual PostgreSQL migrations/transactions, actual signed webhook and persisted pipeline, live Gemini. Snapshot I/O used an isolated Supabase-Storage-compatible HTTP harness, not the Production bucket. No Production mutation, merge, push or deployment. This is additional scenario evidence; official Packet 07 results remain unchanged.

## Source and provenance

Fresh official Arabic and English single-record API responses matched every preserved source field on 6 October 2026. Exact original `ar.grade`: `صحيح دون قوله: (ولم يستدر)`. The Arabic hadith and English translation remain verbatim. Only the controlled candidate `ar.grade` is `صحيح`; `en.grade_ar` retains the original exception.

- [Official original](https://hadeethenc.com/ar/browse/hadith/10618).
- [Arabic API](https://hadeethenc.com/api/v1/hadeeths/one/?language=ar&id=10618), [English API](https://hadeethenc.com/api/v1/hadeeths/one/?language=en&id=10618).
- [Acquisition provenance](../demo/source-derived/hadeethenc-10618.provenance.json).

Original record from HadeethEnc · candidate mutation created by Istithbat for demonstration and was not published by HadeethEnc. v13/v14 are internal sandbox labels; no HadeethEnc version label is claimed. HadeethEnc publication terms apply to the original, which remains untouched and attributed; no permission to publish a modified official provider record is asserted.

## Deterministic evidence

One `FIELD_MODIFIED`, `ar.grade`, `SCHOLAR_JUDGMENT`, no equivalence flags. Actual whitespace/LCS display diff: **four words removed, zero added**. Both hadith texts, references, attribution, explanations and all other source-derived fields match exactly.

| SHA-256 | Original sandbox v13 | Controlled sandbox v14 |
|---|---|---|
| Raw snapshot | `cb74382817a18673f117742fcbe81dcc4de427537cdada86cf131ad8da433672` | `771cd7b61b26116274984275e06f2eb17cc54190b3bbf0d1ace376a0f92858d1` |
| Canonical snapshot | `bbe505128dc6f90988cb8a01e60be83666105f2f9adda907b5e14e3f3997a356` | `e1cf30559b6b3620db03b57d78c5974ca48d48d15b992a2e74e961cbadfecb4e` |
| Sandbox record | `0464a2ad4349268baea1491be2df210a345651d60e872abe3b464477ca338fcb` | `b970812dbda59293a5fcc3f5a6d61ffb9a5d3ce833f9a36ab8a62b9146b44b0c` |
| ar.grade field | `449efbafdcc8926fd411fab277a3e5a6ae9fa9a7d8dcd61859f11bfe7d5cc173` | `d3908502420b0dbd7e6057e3038fd015317e66471651668aba7d1c3032b28410` |

The snapshot/record hashes include Istithbat wrappers and differ from upstream response hashes. Untouched original normalized provider record: `2af183fd55654a6869c91cc9ed407b9890a801b39ce6c7b78ab309cca6e72bea`. Fresh single-response raw hashes: Arabic `4b736fdac3b3e6c58d5bf51d427a5f5c08ca3e92e02f15d5061958ac136f3008`, English `d27c77f36e6da23be5ef2671fdf67fc146a7b8bb8398bb506d765b63c36bb944`. These are different acquisition requests from the preserved batch responses; their parsed source objects match exactly.

## Actual live AI analysis

Gemini `gemini-3.5-flash-lite`, live mode, unchanged v1 prompts/schemas, temperature/thinking omitted (recorded null). Analysis budget 8,000 tokens; Q&A and comparison 4,000 each. All 11 pipeline model calls succeeded on attempt one; all 14 pipeline steps completed on attempt one. No provider switch, quota failure, repair or fallback.

Input: persisted typed context packet with full original/candidate record, exact deterministic change, source attribution, controlled-test disclosure and version identities. Full structured outputs and metadata are retained privately. Actual analysis: **EVIDENCE_DRIFT, MEDIUM risk, REVIEW advisory, HIGH confidence, meaning_changed=true, requires_specialist_review=true**.

**Advisory limitation:** its uncertainties wrongly suggest the removal might be an original-publisher editorial correction. Persisted provenance establishes it is an Istithbat test mutation. Do not repeat that suggestion as fact or imply religious authenticity was determined.

## Actual matched regressions

The supported pipeline used one configured pinned question plus two live-generated questions. Each pair preserved provider/model, v1 system prompt, schema, token budget, actual settings, question, retrieval strategy and stable record key. Pinned retrieval k=1; generated lexical retrieval k=3; both returned the same record identity in their respective knowledge versions. Only version-scoped knowledge/evidence changed.

### Question 1 (pinned)

Quote the exact current ar.grade and en.grade_ar values separately. Does ar.grade explicitly exclude «ولم يستدر»? Identify any discrepancy between those two fields without treating one as a correction of the other. Describe only what the fields state, not whether the hadith is authentic.

**Trusted answer (verbatim):**

The source's ar.grade field reads "صحيح دون قوله: (ولم يستدر)", and the en.grade_ar field reads "صحيح دون قوله: (ولم يستدر)". The ar.grade field explicitly includes the phrase "دون قوله: (ولم يستدر)", which means "authentic except for his saying: (and he did not turn completely around)"; thus, it explicitly excludes that phrase. There is no discrepancy between ar.grade and en.grade_ar, as both fields contain identical Arabic text.

**Candidate answer (verbatim):**

The exact ar.grade value is "صحيح" and the exact en.grade_ar value is "صحيح دون قوله: (ولم يستدر)". The ar.grade field does not contain or mention the phrase "ولم يستدر", whereas the en.grade_ar field explicitly includes the exception "دون قوله: (ولم يستدر)" referring to that phrase.

**Actual Behavior Delta:** MATERIAL_CHANGE; confidence HIGH; tags MEANING_CHANGE, CONCLUSION_CHANGE, CITATION_CHANGE.

### Question 2 (generated)

What is the updated grading value of ar.grade following the modification?

**Trusted answer (verbatim):**

According to the retrieved record, the Arabic grading field (`ar.grade`) reads: "صحيح دون قوله: (ولم يستدر)".

**Candidate answer (verbatim):**

In the Arabic section of the retrieved record, the source's grade field reads "صحيح". In the English section, the source's grade field reads "Authentic hadith", and there is an additional field grade_ar that reads "صحيح دون قوله: (ولم يستدر)".

**Actual Behavior Delta:** MATERIAL_CHANGE; confidence HIGH; tags MEANING_CHANGE, ATTRIBUTION_CHANGE, CITATION_CHANGE.

### Question 3 (generated)

Does the current value of ar.grade contain any restriction or exception regarding the phrase «ولم يستدر»?

**Trusted answer (verbatim):**

Yes, the source's grade field reads: "صحيح دون قوله: (ولم يستدر)", which contains a restriction excluding the phrase «ولم يستدر».

**Candidate answer (verbatim):**

Yes, the source contains a restriction regarding the phrase. In the English record fields, the property grade_ar explicitly states: "صحيح دون قوله: (ولم يستدر)", which introduces an exception excluding the phrase «ولم يستدر» from the authentication.

**Actual Behavior Delta:** NON_MATERIAL_CHANGE; confidence HIGH; tags STYLISTIC_ONLY.

**Quality limitations:** the comparator emitted CITATION_CHANGE for both material pairs although deterministic cited keys were unchanged. Question 2 comparison also wrongly described the retained `en.grade_ar` field as newly added/moved and emitted ATTRIBUTION_CHANGE without an attribution edit. Question 3 candidate answered about `en.grade_ar` instead of the requested `ar.grade`; its NON_MATERIAL verdict describes the answers produced and does not prove correct field interpretation. The pinned pair accurately distinguished the two fields. Materiality counts alone are not a quality certification. No advisory output was rewritten or rerun to force materiality.

## Browser-driven repeat (second actual run)

The second rehearsal used the actual Sandbox sign-in, reset confirmation and Publish v14 buttons. Reset reused source-derived v13 r2 and retained the legacy immutable v13 r1 and append-only audit. The baseline was visibly trusted/served, with no pipeline. Publication then completed all 14 persisted steps on attempt one in **18.988 seconds**, without manual step advancement or page refresh. All 11 live pipeline calls succeeded on attempt one.

**Second analysis:** EVIDENCE_DRIFT, **HIGH** risk, **QUARANTINE** advisory, HIGH confidence, meaning_changed=true, requires_specialist_review=true. This differs from the first run’s MEDIUM/REVIEW, confirming AI output is not deterministic. Deterministic diff, POL-002 floor, serving containment and graph counts remained identical.

### Repeat question 1 (pinned)

Quote the exact current ar.grade and en.grade_ar values separately. Does ar.grade explicitly exclude «ولم يستدر»? Identify any discrepancy between those two fields without treating one as a correction of the other. Describe only what the fields state, not whether the hadith is authentic.

**Trusted answer (verbatim):**

The source's arabic grade field (ar.grade) reads: "صحيح دون قوله: (ولم يستدر)". The english record's arabic grade field (en.grade_ar) reads: "صحيح دون قوله: (ولم يستدر)". The ar.grade field explicitly excludes the phrase «ولم يستدر» by stating "دون قوله: (ولم يستدر)". There is no discrepancy between ar.grade and en.grade_ar, as both fields contain identical text.

**Candidate answer (verbatim):**

The retrieved record's ar.grade field states "صحيح". The en.grade_ar field states "صحيح دون قوله: (ولم يستدر)". The ar.grade field does not explicitly mention or exclude «ولم يستدر», whereas the en.grade_ar field explicitly excludes the phrase «ولم يستدر» from the grading.

**Actual Behavior Delta:** MATERIAL_CHANGE; confidence HIGH; tags ATTRIBUTION_CHANGE, MEANING_CHANGE, CONCLUSION_CHANGE.

### Repeat question 2 (generated)

What is the exact current value of the ar.grade field?

**Trusted answer (verbatim):**

The source's Arabic grade field reads exactly: "صحيح دون قوله: (ولم يستدر)".

**Candidate answer (verbatim):**

According to the retrieved records, the source's ar.grade field reads "صحيح". Additionally, the English section records a grade field as "Authentic hadith" and a grade_ar field as "صحيح دون قوله: (ولم يستدر)".

**Actual Behavior Delta:** MATERIAL_CHANGE; confidence HIGH; tags MEANING_CHANGE, CITATION_CHANGE.

### Repeat question 3 (generated)

Does the text of the ar.grade field mention any exception regarding the phrase «ولم يستدر»?

**Trusted answer (verbatim):**

Yes, the source's grade field reads: "صحيح دون قوله: (ولم يستدر)", which introduces an exception excluding the phrase "(ولم يستدر)" from the authentication.

**Candidate answer (verbatim):**

Yes, the retrieved record contains an Arabic grade field (specifically found under the English section data as grade_ar) that mentions an exception regarding the phrase «ولم يستدر». The field reads: "صحيح دون قوله: (ولم يستدر)".

**Actual Behavior Delta:** NON_MATERIAL_CHANGE; confidence HIGH; tags STYLISTIC_ONLY.

The repeat again yielded two MATERIAL and one NON_MATERIAL result. The same generated exception-question field substitution recurred. The comparator again over-tagged citation/attribution changes; the source’s attribution fields and cited record keys remain unchanged. These are reproducible advisory limitations, not hidden failures or a reason to modify the underlying evidence. Final local candidate remains QUARANTINED with no review decision yet; first-run KEEP_QUARANTINED evidence remains in the append-only audit after reset.
## Policy, gateway and graph

**POL-002 → QUARANTINE**, with a deterministic quarantine floor. AI REVIEW did not lower it. Latest seen: v14 r1 QUARANTINED. Trusted and served: original source-derived v13 r2 TRUSTED. The old synthetic v13 r1 remains immutable/SUPERSEDED. Actual gateway resolver returned the original exception-bearing grade. A further live protected Q&A request also answered from trusted v13 and quoted both original fields exactly. The actual stored-evidence verification endpoints returned HTTP 200/valid for both versions: raw, canonical, record and diff checks all matched.

**Six EXPOSED:** dataset, RAG chunk, knowledge index, Q&A API, search API, content explorer. **One IMPACTED:** protected Islamic Q&A application (`sandbox-qa-app`, protected-app ID `islamic-qa-demo`), linked to the two completed material comparisons. **Zero STALE:** no candidate was promoted. Two graph reads produced the identical traversal hash.

## Rehearsal and checks

Actual authenticated reset → baseline read → candidate publication → signed webhook → persisted detection/analysis/questions/three comparisons/Blast Radius/policy → held incident. Reset HTTP 200 (~22 ms), publish HTTP 202 (~50 ms). Persisted pipeline ran ~18.4 seconds; four-second measurement polling observed completion after ~20.2 seconds. These are local timings, not Production performance claims. Duplicate publish returned NO_CHANGE and reused the same version/run; no additional model calls. Sandbox polling displayed completion without manual refresh.

Browser reviewer sign-in, decision preview and actual KEEP_QUARANTINED signature worked in the isolated app. The candidate remained held; the served baseline stayed v13. No APPROVE/REJECT/promotion was performed on this scenario. Source provenance is disclosed on Sandbox and Incident Review; Incident Review labels these as sandbox versions.

The initial reset failed against the legacy database fixture allowlist and rolled back. Migration `0004_source_derived_sandbox` adds only the two declared fixture names; it does not activate the scenario or change existing rows. A live-database test covers every declared fixture and rejection of unknown names.

Final suite: **201/201 passed**, including eight actual PostgreSQL tests. Typecheck, production build, Drizzle consistency and secret checks passed. Existing synthetic fixture bytes and official Packet 07 evidence are unchanged.

## Recording / activation boundary

After separately authorized deployment/migration and Production activation: sign in to demo control → reset to record 10618 → verify trusted/served original baseline → publish controlled v14 → wait until every persisted stage completes → open incident → inspect exact diff, advisory limitations, matched answers, graph and POL-002 → stop before promotion. Allow variable provider latency; use the real progress indicator. An already-open Incident Review needs navigation/reload to show a new incident; the Sandbox polls automatically. Reviewer sign-in/signing reloads the page automatically.

Production still contains the earlier synthetic held incident. No Production reset was run. A future reset deletes that sandbox’s operational checks, changes, analyses, regression rows, pipeline rows, impact rows, policy evaluations, review rows and incident rows; candidate versions/records are deleted, baseline v13 histories and append-only audit are retained. It replaces the active record mapping, pinned question and serving baseline with source-derived 10618. This destructive activation requires explicit authorization.

Remaining limitations before a clean recording: AI field interpretation and comparator annotations above; final Production deployment/Storage/migration and authorized rehearsal are unverified. A local Storage-compatible harness does not certify hosted Supabase Storage permissions or remote provider latency.

## Landing facts (data only; preview untouched)

- Field `ar.grade`; four words removed; fingerprints `449efbaf → d3908502` are confirmed.
- Before regression: seven exposed, zero impacted, zero stale.
- After this actual run: **six EXPOSED, one IMPACTED, zero STALE**.
- Islamic Q&A is IMPACTED based on completed material regression, while it continues serving trusted v13.
- Each of two completed runs: two material comparisons, one non-material. Latest analysis HIGH/QUARANTINE/HIGH confidence; earlier analysis MEDIUM/REVIEW/HIGH confidence. AI values are recorded run outcomes, not fixed scenario constants.
- The Production domain has not yet activated this scenario. Do not present these local results as deployed Production state.
