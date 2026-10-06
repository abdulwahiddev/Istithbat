# Third-party software, services and attribution

Checked against installed package metadata and public provider terms on 6 October 2026. Versions resolve through `pnpm-lock.yaml`; this is a direct-dependency register, not an exhaustive transitive SBOM. Keep each dependency's distributed copyright/licence notices. A dependency licence does not license Istithbat's own code or third-party religious content.

## Direct software dependencies

| Software | Use | Licence recorded in package metadata |
| --- | --- | --- |
| [Next.js](https://github.com/vercel/next.js), [React / React DOM](https://github.com/facebook/react) | Application, server routes and UI | MIT |
| [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) | Database schema / ORM | Apache-2.0 |
| Drizzle Kit | Schema tooling | MIT |
| [postgres.js](https://github.com/porsager/postgres) | Server-side Postgres transactions | Unlicense |
| [Supabase JS](https://github.com/supabase/supabase-js) | Private snapshot Storage, server-side | MIT |
| [Zod](https://github.com/colinhacks/zod) | Shared contracts and structured-output validation | MIT |
| `server-only` | Server-module boundary | MIT |
| [React Flow / `@xyflow/react`](https://github.com/xyflow/xyflow) | Blast Radius graph display | MIT |
| [TypeScript](https://github.com/microsoft/TypeScript) | Type checking | Apache-2.0 |
| [Vitest](https://github.com/vitest-dev/vitest), [tsx](https://github.com/privatenumber/tsx) | Tests and scripts | MIT |

Type definition packages and transitive packages carry their own licences in installed distributions. Builds/installations must retain those notices; this register does not replace their licence text.

## Fonts and project assets

The current Strata/sandbox layouts use the following fonts, fetched through `next/font/google` and served with the build. Their original copyright notices and SIL Open Font License 1.1 texts are retained in this repository:

- [Instrument Sans licence](licenses/instrumentsans-OFL.txt), [upstream](https://github.com/google/fonts/tree/main/ofl/instrumentsans).
- [Newsreader licence](licenses/newsreader-OFL.txt), [upstream](https://github.com/google/fonts/tree/main/ofl/newsreader).
- [Amiri licence](licenses/amiri-OFL.txt), [upstream](https://github.com/google/fonts/tree/main/ofl/amiri).
- [JetBrains Mono licence](licenses/jetbrainsmono-OFL.txt), [upstream](https://github.com/google/fonts/tree/main/ofl/jetbrainsmono).

Font redistribution remains subject to each included licence, including reserved-name conditions if modified. No font binary or UI was changed by this audit. Brand assets and original synthetic fixtures are project material; no independent third-party religious authority is claimed by them. Newly added landing assets must receive their own provenance/licence review before submission; this audit does not inspect or change work-in-progress landing design.

## Hosted services and AI

| Service/provider | Role | Applicable terms |
| --- | --- | --- |
| [Supabase](https://supabase.com/) | Hosted Postgres and private Storage | [Terms of service](https://supabase.com/terms); server credentials remain private |
| [Vercel](https://vercel.com/) | Next.js hosting and deployment | [Terms](https://vercel.com/legal/terms); function/provider quotas affect availability |
| [GitHub](https://github.com/) | Public repository | [Terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) |
| Google Gemini API | Implemented AI adapter; inspected Production evidence uses `gemini-3.5-flash-lite` | [Gemini API terms](https://ai.google.dev/gemini-api/terms) |
| OpenAI API | Implemented optional AI adapter | [Business terms](https://openai.com/policies/business-terms/) |
| Anthropic API | Implemented optional AI adapter | [Commercial terms](https://www.anthropic.com/legal/commercial-terms) |

These are hosted API/service terms, not a claim that provider models are redistributed or licensed as project code. Only the configured provider is used for a given call. Actual model/mode/settings are persisted; see [AI disclosure](ai-and-safety.md). Claude and Codex were development assistants; Istithbat's runtime AI tasks are disclosed separately.

## Content and project licence status

[HadeethEnc/QuranEnc and synthetic-source terms](data-sources.md) are independent of software licences. Real responses/attribution are preserved; bulk raw validation artifacts stay private. The public repository currently has **no project-wide LICENSE file**. Public visibility permits judging and inspection; it does not itself grant an open-source redistribution licence. The project owner must choose and authorize that licence if redistribution rights are intended. This audit does not invent a grant on the owner's behalf.
