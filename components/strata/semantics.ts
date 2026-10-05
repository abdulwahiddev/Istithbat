import type { IncidentListItem } from '@/lib/contracts';
import { POLICY_DEFINITIONS } from '@/lib/policy/rules';
import type { Tone } from './primitives';
import { humanize, lowerWord, word } from './format';
import type { Seg } from './diff';

/** One semantic vocabulary for every screen: tone = meaning, never decoration (Strata §5). */

export const ROLE_TEXT: Record<string, string> = {
  AUTHORITATIVE_TEXT: 'Authoritative text', SCHOLAR_JUDGMENT: 'Scholar judgment', PROVENANCE: 'Provenance',
  TRANSLATION: 'Translation', COMMENTARY: 'Commentary', OPERATIONAL_METADATA: 'Operational metadata', UNCLASSIFIED: 'Unclassified',
};

const ROLE_NOUN: Record<string, string> = {
  AUTHORITATIVE_TEXT: 'the source text', SCHOLAR_JUDGMENT: 'a grading field', PROVENANCE: 'a provenance field',
  TRANSLATION: 'a translation', COMMENTARY: 'a commentary field', OPERATIONAL_METADATA: 'a metadata field', UNCLASSIFIED: 'a field',
};

/** Answer-first H1 for an incident, from the deterministic diff only. */
export function changeHeadline(fieldRole: string | null | undefined, changeType: string | null | undefined, diff: { removed: Seg['text'][]; added: Seg['text'][] } | null): string {
  const noun = ROLE_NOUN[fieldRole ?? 'UNCLASSIFIED'] ?? 'a field';
  if (changeType === 'RECORD_ADDED') return 'A record was added.';
  if (changeType === 'RECORD_DELETED') return 'A record was deleted.';
  if (diff) {
    const r = diff.removed.length, a = diff.added.length;
    if (r && !a) return `${word(r)} ${r === 1 ? 'word was' : 'words were'} removed from ${noun}.`;
    if (a && !r) return `${word(a)} ${a === 1 ? 'word was' : 'words were'} added to ${noun}.`;
    if (a && r) return `${cap1(noun)} was reworded.`;
  }
  return `${cap1(noun)} changed.`;
}
const cap1 = (s: string) => s.replace(/^a /, 'A ').replace(/^the /, 'The ');

/** Line break before the last clause, matching the two-line H1 rhythm of the boards. */
export function twoLines(sentence: string): [string, string] {
  const at = sentence.lastIndexOf(' from ') > 0 ? sentence.lastIndexOf(' from ') : sentence.lastIndexOf(' to ');
  return at > 0 ? [sentence.slice(0, at), sentence.slice(at + 1)] : [sentence, ''];
}

export type Sem = { tone: Tone; text: string };

export function incidentSem(i: { status: string; pipelineStatus?: string | null }): Sem {
  if (i.status === 'RESOLVED') return { tone: 'n4', text: 'Resolved' };
  if (i.status === 'QUARANTINED') return { tone: 'co', text: 'Quarantined' };
  if (i.pipelineStatus === 'RUNNING' || i.status === 'ANALYZING') return { tone: 'am', text: 'Investigating' };
  return { tone: 'am', text: 'Held for review' };
}

export const analysisText = (t: string | null | undefined) => (t ? humanize(t) : 'Analysis');

export const RESULT_TEXT: Record<string, string> = {
  MATERIAL_CHANGE: 'Material change', NON_MATERIAL_CHANGE: 'Non-material change', NO_CHANGE: 'No change', INCONCLUSIVE: 'Inconclusive', FAILED: 'Failed',
};

const DELTA_TEXT: Record<string, string> = {
  SCOPE_BROADENING: 'Scope broadened', SCOPE_NARROWING: 'Scope narrowed', MEANING_CHANGE: 'Meaning changed', ATTRIBUTION_CHANGE: 'Attribution changed',
  EVIDENCE_STRENGTH_CHANGE: 'Evidence strength changed', CERTAINTY_CHANGE: 'Certainty changed', TRANSLATION_MEANING_CHANGE: 'Translation meaning changed',
  CITATION_CHANGE: 'Citation changed', CONCLUSION_CHANGE: 'Conclusion changed', CONDITION_OMITTED: 'Condition omitted', CONDITION_ADDED: 'Condition added', STYLISTIC_ONLY: 'Stylistic only',
};
export function deltaText(types: string[] | undefined): string {
  if (!types?.length) return 'No difference';
  const t = types.map((x) => DELTA_TEXT[x] ?? humanize(x));
  return [t[0], ...t.slice(1).map((s) => s.charAt(0).toLowerCase() + s.slice(1))].join(', ');
}

/** "AI suggests specialist review" / "AI suggests quarantine" — always advisory wording. */
export function aiSuggestion(out: { requires_specialist_review?: boolean; recommended_action?: string } | null): string | null {
  if (!out) return null;
  if (out.requires_specialist_review) return 'AI suggests specialist review';
  return out.recommended_action ? `AI suggests ${out.recommended_action.toLowerCase()}` : null;
}

/** Rule facts come from the engine's own definitions (lib/policy/rules), never restated here. */
const ROLE_SHORT: Record<string, string> = {
  AUTHORITATIVE_TEXT: 'canonical text', SCHOLAR_JUDGMENT: 'judgment', TRANSLATION: 'translation', PROVENANCE: 'attribution', OPERATIONAL_METADATA: 'metadata only',
};
export function policyFacts(code: string | null | undefined): { name: string; trigger: string | null; floor: string; floorAction: string } | null {
  const def = POLICY_DEFINITIONS.find((p) => p.code === code);
  if (!def) return null;
  const trigger = def.trigger as { fieldRole?: string; noSubstantiveOutside?: string };
  const action = def.action as { floor: string; specialistReview?: boolean; regression?: boolean; humanReview?: boolean };
  const role = trigger.fieldRole ?? trigger.noSubstantiveOutside ?? null;
  const floor = [cap1Word(action.floor), action.regression && 'retest', action.specialistReview && 'specialist review', action.humanReview && 'review'].filter(Boolean).join(', ');
  return { name: `${ROLE_SHORT[role ?? ''] ?? 'substantive'} change`, trigger: role, floor, floorAction: action.floor };
}
const cap1Word = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** Lead incident for the chrome and incident-scoped nav: the newest one needing a decision, else the newest open. */
export function leadIncident<T extends Pick<IncidentListItem, 'status' | 'pipelineStatus' | 'openedAt'>>(list: T[]): T | null {
  const open = list.filter((i) => i.status !== 'RESOLVED').sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  return open.find((i) => needsDecision(i)) ?? open[0] ?? null;
}
export const needsDecision = (i: Pick<IncidentListItem, 'status' | 'pipelineStatus'>) =>
  i.status !== 'RESOLVED' && i.status !== 'ANALYZING' && i.pipelineStatus !== 'RUNNING';

export { lowerWord };
