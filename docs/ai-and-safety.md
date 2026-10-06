# AI, policy and safety disclosure

Audited against `main` on 6 October 2026. This describes runtime code, separately from Claude/Codex assistance with implementation and design.

## Supported providers and modes

`lib/ai/providers/index.ts` implements Gemini (Google), OpenAI and Anthropic adapters. Requests are server-side; the selected key is read from `GEMINI_API_KEY`, `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`. Providers/models are external services, not models trained by Istithbat. See the [third-party register](third-party-register.md).

- **live:** structured provider calls, validated against Zod schemas and citation/safety guards.
- **mock:** deterministic software-test responses, labelled mock; not live performance evidence.
- **replay:** explicitly recorded responses; a missing replay fails, without silently changing mode.

The official Packet 07 evaluation and the currently held Production incident's persisted analysis/regression evidence used Gemini `gemini-3.5-flash-lite`. This is a dated statement about inspected evidence, not a guarantee that a future deployment selects the same model. Recorded metadata includes mode, provider/model, prompt identity/version, actual settings and output provenance. No uncommitted model-routing experiment is represented as a supported main-branch feature.

## Responsibilities

AI analyzes semantic and evidentiary significance, writes investigation summaries, proposes targeted regression questions, and advises on old/new answer differences. The protected app answers only from retrieved records, or abstains/refers. It must not fabricate sources or issue personalized religious rulings.

AI does **not** establish Qur'anic correctness, authenticate hadith, settle scholarly disagreement, issue fatwas or directly mark content TRUSTED. Content level and connector field roles are declared metadata. Hashing, exact diff, retrieval, dependency traversal and the policy floor are deterministic.

Policy triggers come from deterministic facts. AI may only raise the effective action; it cannot lower a rule's protection. REVIEW and QUARANTINE leave the candidate unserved. Sensitive held updates require human review. The explicit exception is deterministic **POL-005 ALLOW** for equivalent/operational changes, which can promote automatically without an AI or human approval call. Human APPROVE and eligible POL-005 ALLOW use the same atomic release transaction. REJECT/KEEP_QUARANTINED/ESCALATE do not promote.

## Matched regression

**Same provider. Same model. Same prompt. Same settings. Same question. Only the knowledge version changes.**

Both Q&A sides share prompt/version/system-prompt hash, output schema, token budget, actual temperature/effort behavior, tools and retrieval configuration. Retrieval is deterministic, lexical and scoped to the selected source version; the pinned question targets its record. Actual retrieved content may differ because the version differs. Configuration/identity hashes, structured answers, retrieval evidence and comparison metadata are persisted. A settings mismatch fails the comparison rather than producing a matched result.

The requested task temperature is zero where the provider/model supports it. The Gemini adapter omits temperature/thinking parameters and records `null` for both; it does **not** claim Gemini requests used temperature zero. OpenAI/Anthropic adapters likewise record omitted settings where required. Matching settings controls experimental conditions; it does not prove a hosted model is mathematically deterministic.

## Fail closed

A pipeline step gets at most one model call per attempt and two step attempts. If it fails twice, the pipeline may continue to POLICY for a fail-closed decision. Failed or missing AI/regression evidence remains distinguishable from success. Malformed structured output, fabricated citations, missing configuration, refusal, quota/transport failures and missing replay are reported rather than replaced with fabricated answers. Deterministic policy still protects substantive candidates. A terminal policy failure itself retains quarantine.

The serverless runner is persisted, leased and idempotent. Bounded authenticated continuation uses the existing runner; it does not add model attempts or change the matched pair. Human promotion is an atomic Postgres transaction; audit history is append-only.

## Measured limits

[Packet 07](evaluation.md) measured 36/40 correct analysis classes, 17/19 material cases recalled, 0/21 false HIGH/CRITICAL classifications and 23/40 correct behavioral comparisons. Material recall fell just below the 90% target; regression produced 15 false positives and two false negatives. Deterministic mutation and policy checks passed 40/40 independently of those advisory model results.

The 12-case safety suite used no retrieved records: it primarily establishes refusal/abstention behavior for those prompts, not correctness across a real religious corpus. A human approved all 12 answers; one conservative referral was an expected-mode mismatch. Full-corpus connector validation checks acquisition/integrity/counts, not theological accuracy or LLM behavior over that full corpus. Free-tier quotas, model revisions and upstream changes may affect later runs.
