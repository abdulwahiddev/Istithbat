# Hadith Evidence Sandbox — synthetic demo fixtures

> **CONTROLLED SYNTHETIC SOURCE — not real hadith data.**
> Everything in these files is invented for the Istithbat demo and evaluation:
> - no real narration;
> - nothing attributed to the Prophet ﷺ;
> - no real scholar, provider or reference.

**Status:** pre-build static data, authored before the 4–6 Oct build window as a specification (Build Bible v1.3 §3, §19; DECISIONS D-13). Packet 01 loads these files **unchanged**.

## Files

| File | Upstream label | Role |
|---|---|---|
| `had-4821.v13.json` | `v13` | **Trusted baseline.** Seeded as TRUSTED by Packet 01. |
| `had-4821.v14.json` | `v14` | **Controlled evidence-scope change.** Published by the sandbox's "Publish v14" action. |
| `had-4821.v14-r2.json` | `v14` (same label) | **Silent Mutation.** Same upstream label and published date as v14, different content fingerprint. Published by "Publish v14-r2". |

The file names use `r2` for readability only. Upstream never sends a revision number: Istithbat assigns `revision_number` itself, per `(source, upstream_label)` (D-14). The first observation of label `v14` becomes r1 and this file becomes r2.

## Shape

Each file is one complete upstream payload. Its field names come from the Bible's connector contract (§12) and field map (§5, D-02):

- top level: `upstreamVersionLabel`, `upstreamPublishedAt`, `metadata`, `records[]`
- each record: `canonical_key`, `upstream_record_id`, `content { … }`, `metadata { … }`

| Field path | Declared role (D-02) |
|---|---|
| `arabic_text` | AUTHORITATIVE_TEXT |
| `translation` | TRANSLATION |
| `judgment` | SCHOLAR_JUDGMENT |
| `scholar`, `reference.*`, `narrators[]` | PROVENANCE |
| `updated_at`, `display_label`, `source_url`, `internal_id`, `description` | OPERATIONAL_METADATA |

Source-level declarations (`is_demo_fixture = true`, `content_level = A`, the field-role map) are Istithbat configuration. They belong to Packet 01's connector definition, not to the upstream payload.

Synthetic markers:
- `metadata.synthetic = true` at payload level and on every record.
- `scholar` keeps the product field name; only its **value** is a synthetic identity (`synthetic_evaluator_a` / `demo_grader`).
- `arabic_text` begins «نص تجريبي —» ("test text —") and states that it is not hadith and not quoted from any source.
- `source_url` uses the reserved `.invalid` domain, so it can never resolve to a real site.

## Exact differences

### v13 → v14 (the demo's Evidence Drift)

| Path | v13 | v14 |
|---|---|---|
| `upstreamVersionLabel` | `v13` | `v14` |
| `upstreamPublishedAt` | `2026-09-01T00:00:00Z` | `2026-10-04T00:00:00Z` |
| `records[HAD-4821].content.judgment` | «إسناده صحيح» | «صحيح» |

- Nothing else changes. `updated_at` is deliberately left unchanged, so the diff shows exactly **one** field change.
- The judgment change is a controlled, synthetic scope-broadening example: from a judgment on the isnad to an unqualified judgment. It is **not** a claim about any real grading.
- Deterministic expectation (D-12): a substantive `SCHOLAR_JUDGMENT` change, so **POL-002** sets a floor of QUARANTINE + regression + human review.

### v14 (r1) → v14-r2 (Silent Mutation)

| Path | v14 (r1) | v14-r2 |
|---|---|---|
| `upstreamVersionLabel` | `v14` | `v14` (unchanged) |
| `upstreamPublishedAt` | `2026-10-04T00:00:00Z` | `2026-10-04T00:00:00Z` (unchanged) |
| `records[HAD-4821].content.reference.page` | `12` | `13` |

- This is the smallest meaningful change: a one-field citation change that introduces no new Arabic and no real-world attribution. Label and timestamp stay the same, so only the content fingerprint reveals it.
- Deterministic expectation (D-12, D-14):
  - raw and canonical hashes change under the same label, so `silent_mutation = true`;
  - a substantive `PROVENANCE` change, so **POL-004** sets a floor of REVIEW. The candidate stays untrusted and unserved until a human approves. AI may raise this to QUARANTINE at HIGH/CRITICAL risk.
- Cause is recorded as UNKNOWN. Never infer intent.

## Pinned demo question (D-16)

> "What specifically does the source's grading field describe as sahih?"

- Packet 01 seeds it as the pinned question for `canonical_key = HAD-4821`. It is deliberately **not** part of the upstream payload, so it can never affect the source's hashes.
- **No regression result is stored anywhere in these fixtures.** Classifications come from real runs only.

## Rules

- Do not edit these files during the build. Any change alters their hashes and must be recorded in `docs/HANDOFF.md`.
- Do not add real hadith text, real scholars, real books or real provider names.
- Evaluation mutations (Appendix B) are generated from `had-4821.v13.json` by Packet 02 as JSON Patch fixtures. They are not added here.
