import 'server-only';
import { fixturePayload, sandboxConnector, type FixtureName } from '@/lib/connectors/sandbox';

/**
 * The one controlled test the sandbox runs: a baseline fixture and the candidate fixture that is
 * published over it. Everything the console shows about the scenario (versions, record, changed
 * field and its exact values, synthetic marker) is derived from these fixtures, so replacing the
 * scenario is a change here, not in the UI.
 */
export const SANDBOX_SCENARIO: { baseline: FixtureName; candidate: FixtureName } = {
  baseline: 'had-4821.v13.json',
  candidate: 'had-4821.v14.json',
};

export type SandboxScenario = {
  baselineFixture: FixtureName; candidateFixture: FixtureName;
  baselineLabel: string; candidateLabel: string;
  recordKey: string; field: string | null; fieldRole: string | null;
  oldValue: unknown; newValue: unknown; changedFields: number; totalFields: number;
  synthetic: boolean;
};

export function sandboxScenario(): SandboxScenario {
  const { baseline, candidate } = SANDBOX_SCENARIO;
  const a = fixturePayload(baseline), b = fixturePayload(candidate);
  const ra = a.records[0], rb = b.records.find((r) => r.canonical_key === ra?.canonical_key) ?? b.records[0];
  const keys = [...new Set([...Object.keys(ra?.content ?? {}), ...Object.keys(rb?.content ?? {})])];
  const changed = keys.filter((k) => JSON.stringify(ra?.content[k]) !== JSON.stringify(rb?.content[k]));
  const field = changed[0] ?? null;
  const roles = sandboxConnector.fieldRoles as Record<string, string>;
  return {
    baselineFixture: baseline, candidateFixture: candidate,
    baselineLabel: a.upstreamVersionLabel, candidateLabel: b.upstreamVersionLabel,
    recordKey: rb?.canonical_key ?? ra?.canonical_key ?? '—',
    field, fieldRole: field ? roles[field] ?? null : null,
    oldValue: field ? ra?.content[field] ?? null : null, newValue: field ? rb?.content[field] ?? null : null,
    changedFields: changed.length, totalFields: keys.length,
    synthetic: a.metadata.synthetic === true && b.metadata.synthetic === true,
  };
}
