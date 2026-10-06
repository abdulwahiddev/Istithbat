# Istithbat | استثبات

Integrity and release governance for organizations consuming Islamic knowledge in AI and digital products. Istithbat detects upstream changes, preserves exact evidence, tests their behavioral effects, and keeps unreviewed candidates from silently reaching a protected app.

**AI advises. Policy governs. Humans decide.** Hashes prove that content changed; they do not determine religious truth, hadith authenticity or a fatwa.

- **Product:** [istithbat.vercel.app/overview](https://istithbat.vercel.app/overview)
- **Controlled upstream simulator:** [istithbat.vercel.app/sandbox](https://istithbat.vercel.app/sandbox)
- **Public repository:** [abdulwahiddev/Istithbat](https://github.com/abdulwahiddev/Istithbat)
- **Evidence:** [technical evidence](docs/technical-evidence.md), [evaluation](docs/evaluation.md), [source register](docs/data-sources.md)

## How it works

```mermaid
flowchart LR
  S[Official source or labelled synthetic sandbox] --> N[Immutable raw and canonical snapshots]
  N --> H[Snapshot, record and field SHA-256]
  H --> D[Exact diff and declared field roles]
  D --> A[AI semantic and evidence analysis]
  A --> R[Matched behavioral regression]
  R --> B[Deterministic Blast Radius]
  B --> P[Policy evaluation]
  P --> G[Trust Gateway: serve trusted version]
  P --> U[Human review of held candidate]
  U --> T[Atomic approval and promotion]
  T --> G
  D --> E[Append-only audit]
  P --> E
  U --> E
  G --> Q[Protected Q&A app]
```

| Responsibility | What it does |
| --- | --- |
| Deterministic integrity | Preserves raw responses; canonicalizes and hashes snapshots, records and fields; records exact changes, equivalence flags and version identity. |
| AI | Explains semantic/evidence significance, generates targeted questions and advises on matched old/new answers. Structured output is schema-validated. It never establishes religious truth or grants trust. |
| Behavioral regression | Same provider, model, prompt, settings, question and retrieval configuration; only the knowledge version changes. Persisted configuration hashes and answer evidence support inspection. |
| Blast Radius | Traverses persisted dependencies; distinguishes EXPOSED, STALE and regression-confirmed IMPACTED assets. |
| Policy | Applies a deterministic rule floor. AI advice may only raise the action. REVIEW/QUARANTINE never release a candidate. Only POL-005 ALLOW for equivalent/operational changes can promote automatically. |
| Human and gateway | Sensitive held changes require a human decision. Approval promotes atomically; the gateway otherwise retains the served trusted version. Latest seen, trusted and served are separate states. |
| Audit | Records ingestion, pipeline attempts, policy, review and release actions; database guards enforce append-only history. |

## The demo

The canonical replacement scenario uses **HadeethEnc record 10618**, copied from verified corpus evidence. Its Arabic hadith, English translation, attribution and references remain unchanged. Only the controlled candidate's `ar.grade` changes:

`صحيح دون قوله: (ولم يستدر)` → `صحيح`

**Real source record · controlled test mutation.** Original record from HadeethEnc; candidate mutation created by Istithbat for demonstration and **not published by HadeethEnc**. Internal v13/v14 labels are sandbox test versions. The retained English `grade_ar` still contains the exception; the inconsistency is deliberately surfaced, not silently rewritten.

An isolated end-to-end rehearsal with actual PostgreSQL and live Gemini completed: POL-002 quarantined the candidate, trusted v13 remained served, and three matched comparisons returned two material changes and one non-material change. **AI caveats remain:** a generated answer confused grading fields, and comparator annotations overstated citation/attribution changes. See [the full evidence and limitations](docs/source-derived-demo.md). This scenario has not been deployed or activated in Production. The existing wholly synthetic HAD-4821 held incident remains the fallback until an owner-authorized reset. The console reflects whichever scenario is actually active. Reset now explicitly activates the original record 10618 baseline; publishing its controlled v14 then runs the real pipeline and deterministic POL-002. The gateway retains the trusted baseline while the candidate is held.

Demo Control and Reviewer sessions are separate. Credentials are supplied privately, never in this repository. Do not reset or publish on shared Production without owner authorization. See [scenario evidence and limitations](docs/source-derived-demo.md) and [console operation](docs/sandbox-demo.md).

## Real sources and measured scope

| Source | Production demo corpus | Separate full-corpus validation, 6 October 2026 |
| --- | --- | --- |
| [HadeethEnc](https://hadeethenc.com/) | 3 Arabic hadith entries with their English responses | 3,574 unique Arabic records and 2,328 available English translations; complete documented Arabic root-category union for these languages |
| [QuranEnc](https://quranenc.com/) | 11 ayat, surahs 1 and 112, selected `english_saheeh` translation; publisher metadata identifies Noor International Center | 114 surahs / 6,236 ayat of that translation |
| Controlled sandbox | One record per test version; existing synthetic fallback retained until authorized activation | Source-derived 10618 scenario plus separate synthetic evaluation cases; real provider endpoints remain untouched |

Both real APIs are read-only. Raw, canonical, record and field hashes were identical across two independent full-corpus passes. **These are private validation artifacts, not a full-corpus Production import or trust approval.** See the [measured report](evaluation/results/2026-10-06-real-corpus.md), [reproducible command](evaluation/corpus/README.md) and [provider terms/attribution](docs/data-sources.md).

## AI disclosure and limitations

Main implements **Gemini, OpenAI and Anthropic** adapters, with explicit live, mock and replay modes. The official complete 40-case evaluation and the persisted held Production comparisons used **Gemini `gemini-3.5-flash-lite`**. Persisted per-call metadata is the evidence for the model actually used; deployment defaults can change. [AI and safety disclosure](docs/ai-and-safety.md) explains schema validation, matched conditions and failure behavior.

The official synthetic evaluation measured **90.0% classification accuracy**, **89.5% material recall**, **0/21 false HIGH/CRITICAL classifications** and **57.5% regression detection accuracy**. These advisory model limitations are disclosed; they are not a claim of religious correctness. Deterministic mutation/policy tests passed 40/40. See [denominators, safety review and failure details](docs/evaluation.md).

Current scope: one controlled protected app, a small real-source baseline, deterministic lexical retrieval and a bounded serverless pipeline. Demo authentication is not enterprise RBAC. Quotas/provider availability can fail; a step that fails twice may continue to POLICY for a fail-closed decision. Missing/failed AI evidence cannot silently release substantive content. No embeddings, broad production-corpus deployment or autonomous religious judgments are claimed.

## Run locally

Use **Node.js 22+** (Production uses Node 24), the pnpm version declared in `package.json`, and a separate development database/private Storage bucket. Do not point initialization commands at the shared demo database.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Fill the required server configuration in the ignored `.env.local`; select mock mode for credential-free AI development, or add the selected provider's key for live AI. A working local core loop still needs Postgres and private Storage. Required variable **names only**:

| Purpose | Variables |
| --- | --- |
| Database | `DATABASE_URL`; `DATABASE_URL_DIRECT` for migrations, or the configured database connection as fallback |
| Private snapshot Storage | `SUPABASE_URL`, `SNAPSHOT_BUCKET`, `SUPABASE_SECRET_KEY`; optional legacy fallback `SUPABASE_SERVICE_ROLE_KEY` |
| AI mode and live configuration | `AI_MODE`; `AI_PROVIDER`, `AI_MODEL` for live mode; one of `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` |
| Separate demo privileges | `DEMO_CONTROL_SECRET`, `DEMO_WEBHOOK_SECRET`, `DEMO_REVIEW_USERNAME`, `DEMO_REVIEW_SECRET` |
| Application origin | `APP_BASE_URL` |
| Optional local replay recording | `AI_RECORD_REPLAY` |

Use independent strong demo secrets (at least 16 characters). Create the named snapshot bucket as private before seeding; privileged access stays server-side. Never add a `NEXT_PUBLIC_` credential. No source API key is needed for the implemented HadeethEnc/QuranEnc connectors.

Initialize **your development database only**. These commands explicitly load the ignored environment file; the seed writes a trusted synthetic v13 and its demo dependency graph:

```sh
node --env-file=.env.local --import tsx db/migrate.ts
node --env-file=.env.local --conditions=react-server --import tsx db/seed/index.ts
pnpm dev
```

Open local `/overview` and `/sandbox`. To register the optional real sources in a development database, use `db/seed/real-sources.ts` with the same environment loading; this creates no versions or trust. First observations and explicit audited real-baseline establishment are separate operator actions, not automatic trust. See the [source lifecycle](docs/data-sources.md).

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm check:secrets
pnpm start
# Offline synthetic evaluation; no remote source requests:
pnpm eval --suite mutations --ai mock
# Optional read-only remote corpus validation, outside normal unit tests:
pnpm corpus:validate --source all --out "$CORPUS_OUTPUT_DIR"
```

Standard tests do not fetch full remote corpora. Optional database integration tests are skipped unless explicitly enabled against a test database. Live evaluations consume provider quota and do not run as part of ordinary unit tests.

## Code and evidence map

| Area | Location |
| --- | --- |
| DB/schema/migrations | [`db/`](db/), [`lib/db/`](lib/db/) |
| Official connectors and raw evidence | [`lib/connectors/`](lib/connectors/), [`lib/ingestion/`](lib/ingestion/) |
| Hashes and exact diff | [`lib/hashing/`](lib/hashing/), [`lib/diff/`](lib/diff/) |
| AI adapters/prompts/schemas | [`lib/ai/`](lib/ai/), [`lib/analysis/`](lib/analysis/) |
| Matched regression and retrieval | [`lib/regression/`](lib/regression/) |
| Blast Radius | [`lib/blast-radius/`](lib/blast-radius/) |
| Policy, review, atomic release | [`lib/policy/`](lib/policy/), [`lib/governance/`](lib/governance/), [`lib/gateway/`](lib/gateway/) |
| Persisted orchestration and APIs | [`lib/pipeline/`](lib/pipeline/), [`app/api/`](app/api/) |
| Tests and reproducible benchmarks | [`tests/`](tests/), [`evaluation/`](evaluation/), [`technical evidence`](docs/technical-evidence.md) |

Stack: Next.js 15, React 19, TypeScript, Supabase Postgres/private Storage, postgres.js/Drizzle, Zod, React Flow, Vitest and Vercel. Claude and Codex assisted development; AI runtime behavior is separately disclosed above. [Third-party licences/services](docs/third-party-register.md) and [submission-readiness audit](docs/submission-readiness.md) record remaining obligations. This public repository does not yet declare a project-wide redistribution licence; third-party content retains its own terms.
