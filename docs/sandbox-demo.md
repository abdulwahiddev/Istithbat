# Controlled upstream demo console

Open `/sandbox`. This separate source simulator reflects its persisted active fixture. Existing HAD-4821 fixtures remain the fallback; the source-derived record 10618 scenario becomes active only after an explicit controlled reset. Original hadith text and official provider endpoints are never edited. See [scenario evidence](source-derived-demo.md).

## Controls

Sign in with the existing `DEMO_CONTROL_SECRET` using the control credential field. The server issues a separate 12-hour signed, Secure, HttpOnly, SameSite=Strict control cookie. Reviewer credentials and cookies do not grant control access; control access does not grant reviewer permission. Credentials are never embedded in a page or returned by the API.

Reset requires explicit confirmation. The existing reset transaction restores upstream/trusted/served v13 and clears sandbox candidate versions, incidents, reviews and pipeline state; the append-only audit history is retained. Do not reset while a pipeline is active. Reset is intentionally destructive to the sandbox investigation, so obtain the demo owner's authorization before a Production rehearsal.

Publish v14 invokes the existing publish API, sends its signed source-update webhook, fetches the current upstream payload, stores immutable snapshot evidence, computes the exact diff and enqueues the existing pipeline. No browser step-advancement requests are used. In the source-derived canonical scenario, only `ar.grade` changes from `صحيح دون قوله: (ولم يستدر)` to `صحيح`. The legacy synthetic fixture separately changes `judgment` from `إسناده صحيح` to `صحيح`.

## Persisted progress and protection

`GET /api/sandbox/current` still returns the exact provider fixture bytes. The new read-only `GET /api/sandbox/status` reconstructs console state in one database statement: current published fixture, publish/reset timestamp, connector health, latest observed version, trusted version, every bound application's served version, latest-version pipeline and its persisted steps, and the most recent integrity check.

The console polls `GET /api/pipeline/{runId}` about every 1.5 seconds while running, re-reading release state when step evidence changes. Polling does not overlap, stops on terminal state, pauses while hidden, and is bounded to ten minutes or five consecutive read failures. **Check again** reconnects after a pause. A page refresh reconstructs the run from the database. Duplicate API publication reuses the existing observation/run and retains the original publish timestamp. The console disables re-publishing an already published candidate.

Istithbat's shared existing refresh helper now polls lightweight incident/run reads while a pipeline is active. Heavy server-rendered page refreshes are coalesced to at most once every eight seconds during work, with a final refresh on completion. A browser storage notification after successful publish/reset asks other open same-origin Istithbat tabs to re-read; the returned actual run ID supports watching before the incident row exists. There is one shared refresher, not competing per-screen intervals. No inactive background polling or realtime subscription is introduced.

The Detect/Understand/Test/Trace/Contain statuses are derived from recorded pipeline steps. Errors remain visible. Candidate, trusted and served labels/statuses come from database truth; publishing is never a trust decision. The incident link uses the actual persisted incident ID. Human review remains a separate workflow.

## Serverless continuation

Previously, a webhook scheduled only one 20-second runner budget; a WAITING or retryable result could leave the run unfinished. Post-response continuation now sends an authenticated request to the existing pipeline route. That request acknowledges promptly and schedules the same leased runner. Continuation is capped at 32 handoffs; COMPLETE, FAILED_CLOSED and BUSY do not spawn another runner. Redirects are rejected and transport failures are logged with fixed codes, never credentials. Existing authorized manual resume remains available if transport fails; reads never advance work.

Pipeline routes allow 180 seconds so one existing 90-second provider timeout plus database work fits. The run lease is also 180 seconds. This changes orchestration lifetime only: model/prompt/settings/question matching, one model call per step attempt, two attempts, fail-closed policy and atomic human promotion remain unchanged. The connection pool remains `max: 1`.

## Verification boundary

Tests use unchanged synthetic fixtures, mocked database transactions and real route handlers for authorization, reset/publish/webhook wiring, continuation, duplicate handling and persisted read contracts. Earlier browser interaction QA intercepted writes. The 10618 validation additionally exercised actual reset, signed publication, live AI, persisted PostgreSQL evidence, authenticated KEEP_QUARANTINED review and gateway containment in an isolated local production build; snapshot I/O used a local Storage-compatible harness. See [measured results and limitations](source-derived-demo.md). Production verification remains read-only; its destructive reset requires separate authorization.

## Source-derived scenario activation (owner authorization required)

Deploying the implementation does not switch `sandbox_state`, seed a baseline or change the held incident. After explicit owner authorization, the authenticated console reset requests `scenario: hadeethenc-10618`; the confirmation identifies that it clears the current investigation. The reset creates/reuses a new immutable v13 revision, preserves the original v13 historical evidence, atomically updates sandbox source roles/pinned question/dependency record identities/gateway binding, and retains append-only audit history. No human approval is manufactured: this is an explicit controlled demo baseline establishment. Repeated ordinary resets retain the active scenario.

The canonical replacement uses `SANDBOX-HENC-10618` in the sandbox namespace, upstream record ID 10618. v13/v14 are **Istithbat sandbox versions**, not HadeethEnc releases. Publishing a fixture from an inactive scenario is rejected. Both raw/canonical source snapshots stay private. New fixtures live in `demo/source-derived/`; frozen synthetic fixtures and official Packet 07 evidence remain unchanged.

The console displays the real Arabic text, both original/candidate grades and the disclosure. Full unchanged English/provenance/reference fields are available under the full record. Candidate English grading duplicates are intentionally not synchronized. No new styling or reviewer authentication was introduced.
