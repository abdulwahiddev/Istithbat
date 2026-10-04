# Evaluation

This report records the Packet 07 run on 5 October 2026. The [machine-readable result](../evaluation/results/2026-10-05-packet-07.json) contains the measured fixture cases. The live AI evaluation is **incomplete**; no live model performance score is claimed.

## Source mutation and policy suite

The deterministic runner evaluated 40 unique synthetic mutation fixtures. It passed 40/40 fixtures and detected 38/38 expected field changes, with no unexpected changes. Change-type, field-role, and equivalence-flag checks each passed 38/38. All 3/3 Silent Mutation cases were detected. The policy runner matched the frozen expected action on 40/40 fixtures. Its forced AI failure check quarantined 28/28 substantive cases; 12 equivalent or metadata cases took the POL-005 ALLOW path.

These are deterministic fixture results, not claims about model performance or real third-party sources.

## AI and protected-app safety suites

The mock-mode plumbing run completed 40/40 analyses, 40/40 matched Q&A pairs, and 40/40 behavioral comparisons. The separate 12-prompt safety suite returned 12/12 schema-valid mock outputs. Mock outputs are excluded from performance claims.

The required live-mode run was attempted with Gemini. The local key was rejected by the provider (`HTTP 400 INVALID_ARGUMENT`), yielding 0/40 completed analyses, Q&A pairs, or comparisons and 0/12 valid safety outputs. These are execution failures, **not** a 0% accuracy or safety score. The connected Vercel integration cannot read the existing working Production secret. Live classification accuracy, material-change recall, false critical rate, regression detection, safety rubric, fabricated-source rate, and human spot-check therefore remain **unmeasured** in this run.

The safety suite uses a synthetic sandbox corpus and would primarily measure abstention, referral, and refusal to fabricate even when live execution succeeds. Its per-prompt rubric still needs a human spot-check before any safety claim.

## Production journey

On the Production deployment at commit `edcc9b5`, the controlled v13 → v14 journey ran twice through the simulator, ingestion, persisted pipeline, policy, review API, and protected Q&A. In both cycles, POL-002 quarantined v14 while Q&A continued to serve trusted v13. Human APPROVE then switched the gateway and Q&A to trusted v14, resolved the incident, and a duplicate approval returned 409. Duplicate source checks returned `NO_CHANGE`.

The first cycle completed all 14 pipeline steps. Its three live matched regressions classified two `MATERIAL_CHANGE` and one `NON_MATERIAL_CHANGE`; the protected app was regression-confirmed `IMPACTED`. A separate same-label v14 revision 2 followed r1 approval. All three r2 regressions compared r1 → r2, its graph evidence matched that incident, and r2 remained held and unserved. A duplicate r2 publish returned `NO_CHANGE`.

In the repeat r1 cycle, one behavioral-comparison step failed after two attempts. D-08 continued to POLICY, and POL-002 still quarantined the candidate. The other two comparisons were material. This incomplete comparison is not counted as a successful regression.

After verification, the protected reset restored one trusted and served v13, latest seen v13, no active incident, and live Q&A on v13. Baseline and first-cycle r1 stored snapshots passed hash verification. The Storage bucket is private. Unauthorized reset, publish, review, and webhook requests returned 401. This live demo proof does not replace the blocked 40-case live AI evaluation above.
