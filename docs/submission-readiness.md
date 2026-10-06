# Submission-readiness audit

**Date:** 6 October 2026. **Audited code baseline:** `8c03325bff64c8300956b833c09f24a3d76f2680` on public `main`, plus this documentation-only update. Production was inspected using GET requests and read-only SQL; no source/incident/review/release state was changed. Landing design, Strata, sandbox UI and reviewer UX are outside this audit's change scope.

## Readiness estimate: 85/100

This is an internal readiness estimate, **not an organizer score or a prediction of judging**. The rubric assesses verifiability and completion; recorded model limitations remain visible.

| Audit area | Points | Reason |
| --- | ---: | --- |
| Product availability and core loop | 23/25 | Live app/health/sandbox/evidence reads pass; historical end-to-end release proof exists. Fresh Production rehearsal of the newest continuation is deliberately pending authorization. |
| Public documentation and reproducibility | 20/20 | README now explains architecture, roles, demo, setup, variable names, code map, commands and scope; public supporting evidence is linked. |
| Technical evidence and safety | 17/20 | Measured fixtures/corpus/release evidence preserved; AI recall/regression limitations disclosed; seven optional DB tests not passed by the standard run. |
| Source attribution and secret hygiene | 13/15 | Source terms/register and font notices improved; no project-wide redistribution licence selected by the owner. |
| Submission delivery | 12/20 | Live product and public repo verified. Final deck, ≤2-minute video, private judge access handoff and portal submission receipt are not verified by repository evidence. |
| **Total** | **85/100** | Documentation and technical evidence are ready; final package/access confirmation remains an owner action. |

## Challenge compliance

The documented organizer requirements include a working solution link, public repo, operational/source/AI documentation, a PDF/PowerPoint presentation and a practical demo video no longer than two minutes. The deadline is **6 October 2026, 23:59 Asia/Riyadh**. The private organizer reference is not published here.

| Requirement | Status | Evidence / outstanding action |
| --- | --- | --- |
| Runnable complete product | **PASS** | READY deployment, 200 overview/sandbox/health, persisted held pipeline and three completed matched comparisons; historical full release cycles. |
| Public GitHub repository | **PASS** | GitHub API reports PUBLIC; [repository](https://github.com/abdulwahiddev/Istithbat). |
| Operating documentation | **PASS** | [README](../README.md) and [sandbox operations](sandbox-demo.md), isolated-development initialization and test/build commands. |
| Source/licence register | **PASS** for provider/source documentation; **NEEDS ATTENTION** for project code licence | [Source register](data-sources.md), [third-party register](third-party-register.md), retained original font notices. Root LICENSE absent; owner must choose intended redistribution rights. |
| AI/model/service disclosure | **PASS** | [AI disclosure](ai-and-safety.md): implemented providers, actual persisted model, structured output, matched conditions, safety boundaries, deterministic policy floor and human decisions. |
| No secrets in public repository | **PASS** for audited checks | Secret-path/public-variable check and actual configured credential-value scan; credentials excluded from docs. These checks are scoped evidence, not a claim of a formal penetration test. |
| Synthetic/anonymized demo data | **PASS** | Controlled fixture and dependency graph clearly synthetic; real connector evidence unchanged and attributed; bulk artifacts private. |
| Limitations explained | **PASS** | Actual AI metrics, small Production corpus, demo-only auth, provider quotas, optional DB tests and full-corpus import boundary documented. |
| Final presentation PDF/PowerPoint | **NEEDS ATTENTION** | Final export/accessibility and exact submission link not verified in this audit. Confirm outside the repo. |
| Practical video ≤2 minutes | **NEEDS ATTENTION** | Final video length, accessible link and consistency with actual demo state not verified. Confirm outside the repo. |
| Judge access to protected actions | **NEEDS ATTENTION** | Arrange private control/reviewer access or a recorded guided demo; verify credential handoff without publishing credentials. |
| Submission portal receipt | **NEEDS ATTENTION** | Owner must submit and confirm accessible links/files before the hard deadline. |

## Verification performed

- **181 tests passed; seven optional live database tests skipped.** No claim that skipped tests passed. No live model call or full remote-corpus refetch was initiated.
- Typecheck and Production build passed on the audited code baseline.
- The README's offline mock mutation command ran successfully: 40/40 deterministic synthetic fixtures. Mock AI output is plumbing evidence, not accuracy evidence.
- `pnpm check:secrets` and configured credential-value scans of current files and 637 reachable history blobs passed; documentation relative links checked. Provider names/variables only, no login credentials added.
- Production read-only inspection: `/overview`, `/sandbox`, `/api/health`, `/api/sandbox/status` and the held incident regression API returned **200**. Sandbox v14 r1 remains QUARANTINED; trusted/served v13 r1 remain intact. Three COMPLETE regressions retain Gemini `gemini-3.5-flash-lite` and question ordering. The pre-existing KEEP_QUARANTINED decision is retained; this audit creates no decisions or history.
- Production real baselines remain **3 HadeethEnc records / 11 QuranEnc ayat**. Full-corpus validation totals are artifacts, not database ingestion; see [technical evidence](technical-evidence.md).
- No runtime, schema, fixture, policy, model, UI or landing file was changed. Documentation/font-licence files only.

## Submission risks and owner actions

1. **Package/access verification is the remaining submission gate.** Confirm final deck, video, links and private judge instructions, then obtain the portal receipt. Files being present locally would not prove that judges can access them.
2. **Do not overstate AI performance.** Official complete results are 89.5% material recall and 57.5% regression accuracy. Show deterministic containment separately; do not represent an incomplete comparison/benchmark as a full success or a religious-correctness evaluation.
3. **Do not overstate corpus deployment.** 6,236 ayat and 3,574 Arabic hadiths were validated in private artifacts; Production still serves its small monitored baselines. Preserve private raw artifacts for offline reproduction and use the explicit validator if a judge wants an independent acquisition run.
4. **A new Production rehearsal is a separate destructive action.** Obtain explicit authorization before resetting the held incident. The newest continuation is verified with isolated route/fixture tests; do not present it as a freshly completed live reset→publish run.
5. **Choose a project licence if redistribution is intended.** Third-party notices are retained, but this audit cannot authorize the owner's copyright grant. Newly added landing assets should receive provenance/licence review by their owner before submission.
6. **Availability depends on provider quota.** Keep the current free-tier configuration as requested; arrange demo timing and document actual failure modes. No billing changes or quota promises were made.
