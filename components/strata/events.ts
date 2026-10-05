import type { AuditEvent } from '@/lib/contracts';
import type { z } from 'zod';
import { humanize, plural } from './format';
import { analysisText, RESULT_TEXT } from './semantics';

type Ev = z.infer<typeof AuditEvent>;

/**
 * Narration for append-only audit entries. Wording describes what an entry type proves (copy from the
 * frozen Record board); every value comes from the stored entry. Lanes are the writing authority:
 * 0 source and integrity · 1 deterministic engine · 2 AI advisory · 3 policy · 4 human, signed.
 */
export type Lane = 0 | 1 | 2 | 3 | 4;
export type EventTone = 'tq' | 'co' | 'am' | null;
export type Narrated = {
  lane: Lane; tone: EventTone; title: string; line: string; proves: string;
  evidence: Array<{ k: string; v: string; mono?: boolean }>;
  link?: { label: string; target: 'source' | 'facts' | 'advisory' | 'behavior' | 'exposure' | 'containment' | 'decision' | 'blast' | 'gateway' | 'sources' };
};

export type EventContext = {
  /** version id → "v14 · r1" */
  versionLabel: (id: string | null | undefined) => string | null;
  servedLabel?: string | null;
  appName?: string | null;
};

const s = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null);
const counts = (m: Record<string, unknown>) => {
  const c = (m.counts ?? {}) as Record<string, unknown>;
  return typeof c.impacted === 'number' ? `${c.impacted} impacted · ${c.exposed ?? 0} exposed · ${c.stale ?? 0} stale` : null;
};
const modeText = (m: unknown) => (m === 'replay' ? 'replayed response' : m === 'mock' ? 'mock response, not a model' : m === 'live' ? 'live response' : null);

/** Step events are folded into the entry they belong to (handoff §9 Record). */
export const FOLDED = /^(PIPELINE_STEP_|REGRESSION_STARTED|REGRESSION_BASE_COMPLETED|REGRESSION_CANDIDATE_COMPLETED)/;

export function narrate(e: Ev, ctx: EventContext): Narrated {
  const m = e.metadata as Record<string, unknown>;
  const known = ctx.versionLabel(e.entityType === 'source_version' ? e.entityId : s(m.versionId) ?? s(m.candidateVersionId));
  // Versions removed by a protected demo reset are no longer readable; name them neutrally.
  const label = known ?? 'A version';
  switch (e.eventType) {
    case 'BASELINE_SEEDED':
      return { lane: 0, tone: 'tq', title: `${label} seeded as the trusted baseline`, line: m.synthetic === true ? 'Synthetic fixture' : 'Seeded baseline',
        proves: 'The version production serves today, and the reference every later change is compared against.',
        evidence: [...(s(m.rawSha256) ? [{ k: 'Raw SHA-256', v: s(m.rawSha256)!, mono: true }] : []), { k: 'Synthetic', v: m.synthetic === true ? 'Yes' : 'No' }], link: { label: 'Sources', target: 'sources' } };
    case 'BASELINE_ESTABLISHED':
      return { lane: 0, tone: 'tq', title: `${label} established as the trusted baseline`, line: 'Explicit operator baseline · audited',
        proves: 'A real source’s first snapshot is trusted only by this explicit, audited step; nothing is auto-promoted on first sight.', evidence: [], link: { label: 'Sources', target: 'sources' } };
    case 'SOURCE_VERSION_DETECTED': {
      const n = typeof m.changeCount === 'number' ? m.changeCount : null;
      return { lane: 0, tone: null, title: `${label} observed`, line: m.baselineObservation === true ? 'First observation · no pipeline' : n !== null ? `${plural(n, 'change')} against the trusted version` : 'New version stored',
        proves: 'The exact bytes received were stored, hashed and diffed in one transaction. The diff is deterministic: no model is involved.',
        evidence: [...(s(m.rawSha256) ? [{ k: 'Raw SHA-256', v: s(m.rawSha256)!, mono: true }] : []), { k: 'Silent mutation', v: m.silentMutation === true ? 'Yes · same label, different bytes' : 'No' }],
        link: { label: 'Exact change', target: 'source' } };
    }
    case 'PIPELINE_STARTED':
      return { lane: 1, tone: null, title: m.fastPath === true ? 'Deterministic fast path started' : 'Full review pipeline started', line: m.fastPath === true ? 'No substantive change: no AI, no regression' : 'A meaningful change: no fast path',
        proves: m.fastPath === true ? 'No substantive change outside operational metadata, so the candidate goes straight to policy.' : 'The change touched a substantive field, so the candidate was routed to analysis, regression, blast radius and policy.',
        evidence: [{ k: 'Fast path', v: m.fastPath === true ? 'Yes' : 'No' }] };
    case 'INCIDENT_CREATED':
      return { lane: 1, tone: null, title: 'Incident opened', line: 'One incident per meaningful version transition',
        proves: 'One incident per meaningful version transition. The primary change is ranked deterministically.', evidence: [] };
    case 'CONTEXT_PACKET_ATTACHED':
      return { lane: 1, tone: null, title: 'Evidence packet sealed for analysis', line: 'Exactly what the AI may read · hashed',
        proves: 'The AI reads only this packet. Its hash is recorded, so the analysis can be traced to the exact evidence it saw.',
        evidence: [...(s(m.contextPacketHash) ? [{ k: 'Packet hash', v: s(m.contextPacketHash)!, mono: true }] : []), ...(typeof m.changeCount === 'number' ? [{ k: 'Changes in packet', v: String(m.changeCount) }] : [])] };
    case 'ANALYSIS_SUCCEEDED':
      return { lane: 2, tone: null, title: 'AI reading recorded', line: humanize([s(m.analysisType) ? analysisText(s(m.analysisType)) : null, modeText(m.mode)].filter(Boolean).join(' · ') || 'Advisory reading'),
        proves: 'An advisory reading of the change, tied to the sealed packet. It can raise the policy outcome, never lower it, and it does not grade the hadith.',
        evidence: [...(s(m.model) ? [{ k: 'Model', v: s(m.model)!, mono: true }] : []), ...(s(m.promptVersion) ? [{ k: 'Prompt', v: s(m.promptVersion)!, mono: true }] : []), ...(modeText(m.mode) ? [{ k: 'Mode', v: humanize(modeText(m.mode)!) }] : [])],
        link: { label: 'AI reading', target: 'advisory' } };
    case 'ANALYSIS_FAILED':
      return { lane: 2, tone: 'am', title: 'AI reading failed', line: 'Deterministic evidence stays available', proves: 'The analysis could not be completed. Policy fails closed on sensitive content.', evidence: [] };
    case 'REGRESSION_COMPARISON_COMPLETED': {
      const r = s(m.result);
      return { lane: 1, tone: r === 'MATERIAL_CHANGE' ? 'co' : null, title: `Regression compared${ctx.appName ? ` on ${ctx.appName}` : ''}`, line: r ? RESULT_TEXT[r] ?? humanize(r) : 'Comparison recorded',
        proves: 'The same question was asked against both versions with an identical model configuration. Only the knowledge version differed.',
        evidence: [...(r ? [{ k: 'Result', v: RESULT_TEXT[r] ?? r }] : []), ...(s(m.modelConfigHash) ? [{ k: 'Config hash', v: s(m.modelConfigHash)!, mono: true }] : []), ...(modeText(m.mode) ? [{ k: 'Mode', v: humanize(modeText(m.mode)!) }] : [])],
        link: { label: 'Behavior', target: 'behavior' } };
    }
    case 'REGRESSION_MODEL_FALLBACK':
      return { lane: 1, tone: 'am', title: 'Regression moved to the fallback model', line: 'Before any answer was saved', proves: 'The first model failed on a provider error before a base answer existed, so the pair used the next model on both sides.', evidence: [] };
    case 'BLAST_RADIUS_COMPUTED':
      return { lane: 1, tone: null, title: s(m.phase) === 'POST_PROMOTION' ? 'Blast radius recomputed after promotion' : 'Blast radius computed', line: counts(m) ?? 'Traversal stored',
        proves: 'A deterministic walk of the dependency graph. Re-running it produces the same traversal hash.',
        evidence: [...(s(m.phase) ? [{ k: 'Phase', v: s(m.phase)!, mono: true }] : []), ...(s(m.traversalHash) ? [{ k: 'Traversal hash', v: s(m.traversalHash)!, mono: true }] : [])],
        link: { label: 'Blast Radius', target: 'blast' } };
    case 'BLAST_RADIUS_RECOMPUTE_FAILED':
      return { lane: 1, tone: 'am', title: 'Post-promotion recompute failed', line: 'Audited; the promotion stands', proves: 'A failed recompute is recorded and never rolls the promotion back.', evidence: [] };
    case 'POLICY_EVALUATED': {
      const code = s(m.policyCode), act = s(m.action);
      return { lane: 3, tone: act === 'QUARANTINE' || act === 'ESCALATE' ? 'co' : act === 'REVIEW' ? 'am' : 'tq', title: code ? `${code} matched` : 'Policy evaluated', line: act ? `Action ${act.toLowerCase()}` : 'Evaluated',
        proves: 'A fixed rule, not a model, set the outcome. Advisory facts can raise an action, never lower it.',
        evidence: [...(code ? [{ k: 'Policy', v: code, mono: true }] : []), ...(act ? [{ k: 'Action', v: act, mono: true }] : [])],
        link: { label: 'Policy gate', target: 'containment' } };
    }
    case 'POLICY_FAILED_CLOSED':
      return { lane: 3, tone: 'co', title: 'Policy failed closed', line: 'The candidate stays quarantined', proves: 'Policy evaluation failed, so the candidate is held rather than released.', evidence: [] };
    case 'VERSION_QUARANTINED':
      return { lane: 3, tone: 'co', title: `${label} quarantined`, line: ctx.servedLabel ? `The gateway stays on ${ctx.servedLabel}` : 'Held and unserved',
        proves: 'The candidate is held and unserved. The protected app keeps reading the trusted version until a reviewer signs.', evidence: [], link: { label: 'Trust Gateway', target: 'gateway' } };
    case 'REVIEW_DECISION': {
      const d = s(m.decision);
      return { lane: 4, tone: null, title: `Human decision · ${d ? humanize(d).toLowerCase() : 'recorded'}`, line: e.actor.replace(/^reviewer:/, 'Signed by '),
        proves: 'A signed human decision under the separate review credential, appended with the candidate it applies to.', evidence: d ? [{ k: 'Decision', v: d, mono: true }] : [], link: { label: 'Decision', target: 'decision' } };
    }
    case 'VERSION_PROMOTED': {
      const byPolicy = e.actor.startsWith('policy:');
      return { lane: byPolicy ? 3 : 4, tone: 'tq', title: `${label} promoted`, line: `Gateway switched from ${ctx.versionLabel(s(m.previousVersionId)) ?? 'the previous version'} to ${known ?? 'the candidate'}`,
        proves: 'Promotion runs in one transaction: previous trusted superseded, candidate trusted, gateway switched, incident resolved.', evidence: [], link: { label: 'Trust Gateway', target: 'gateway' } };
    }
    case 'DEMO_RESET':
      return { lane: 1, tone: null, title: 'Demo reset to the trusted baseline', line: 'Sandbox only; real sources untouched', proves: 'A protected reset returned the sandbox to its trusted baseline.', evidence: [] };
    default:
      return { lane: e.actor.startsWith('reviewer:') ? 4 : e.actor.startsWith('policy:') ? 3 : 1, tone: null, title: humanize(e.eventType), line: e.actor, proves: 'A recorded entry.', evidence: [] };
  }
}

export const LANE_MARK = ['src', 'det', 'ai', 'pol', 'hum'] as const;
export const AUTHORITY = ['Source and integrity', 'Deterministic engine', 'AI advisory', 'Policy', 'Human, signed'] as const;
