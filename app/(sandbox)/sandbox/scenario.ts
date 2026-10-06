import 'server-only';
import { fixturePayload, sandboxConnector, type FixtureName } from '@/lib/connectors/sandbox';
import { SOURCE_DERIVED_SCENARIO } from '@/lib/contracts/sandbox-scenario';

/**
 * The one controlled test the sandbox runs: Codex's validated source-derived scenario (HadeethEnc
 * record 10618, original provenance kept; the candidate is an Istithbat-created mutation). Every
 * fact the console shows (versions, record, changed field and exact values, disclosure) is derived
 * from its baseline and candidate fixtures, so swapping scenarios is a change in the contract, not
 * in the UI.
 */
export const SANDBOX_SCENARIO = {
  id: SOURCE_DERIVED_SCENARIO.id,
  baseline: SOURCE_DERIVED_SCENARIO.baselineFixture as FixtureName,
  candidate: SOURCE_DERIVED_SCENARIO.candidateFixture as FixtureName,
};

export type SandboxScenario = {
  scenarioId: string;
  baselineFixture: FixtureName; candidateFixture: FixtureName;
  baselineLabel: string; candidateLabel: string;
  recordKey: string; field: string | null; fieldRole: string | null;
  oldValue: unknown; newValue: unknown; changedFields: number; totalFields: number;
  /** dotted path of the authoritative Arabic text in the record */
  textPath: string;
  sourceDerived: boolean; synthetic: boolean; disclosure: string | null;
};

/** {ar:{grade:'x'}} → {'ar.grade':'x'}; arrays stay leaf values. */
function flatten(o: Record<string, unknown>, pre = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    const p = pre ? `${pre}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v as Record<string, unknown>, p)); else out[p] = v;
  }
  return out;
}

export function sandboxScenario(): SandboxScenario {
  const { id, baseline, candidate } = SANDBOX_SCENARIO;
  const a = fixturePayload(baseline), b = fixturePayload(candidate);
  const ra = a.records[0], rb = b.records.find((r) => r.canonical_key === ra?.canonical_key) ?? b.records[0];
  const fa = flatten(ra?.content ?? {}), fb = flatten(rb?.content ?? {});
  const keys = [...new Set([...Object.keys(fa), ...Object.keys(fb)])];
  const changed = keys.filter((k) => JSON.stringify(fa[k]) !== JSON.stringify(fb[k]));
  const field = changed[0] ?? null;
  const roles = sandboxConnector.fieldRoles as Record<string, string>;
  const derived = a.metadata.source_derived === true;
  return {
    scenarioId: id, baselineFixture: baseline, candidateFixture: candidate,
    baselineLabel: a.upstreamVersionLabel, candidateLabel: b.upstreamVersionLabel,
    recordKey: rb?.canonical_key ?? ra?.canonical_key ?? '—',
    field, fieldRole: field ? roles[field] ?? null : null,
    oldValue: field ? fa[field] ?? null : null, newValue: field ? fb[field] ?? null : null,
    changedFields: changed.length, totalFields: keys.length,
    textPath: 'ar.hadeeth' in fa ? 'ar.hadeeth' : 'arabic_text',
    sourceDerived: derived,
    synthetic: !derived && a.metadata.synthetic === true,
    disclosure: typeof a.metadata.disclosure === 'string' ? a.metadata.disclosure : derived ? SOURCE_DERIVED_SCENARIO.disclosure : null,
  };
}
