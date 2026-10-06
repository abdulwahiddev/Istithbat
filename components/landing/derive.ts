import { hadeethencConnector } from '@/lib/connectors/hadeethenc';
import { diffPayloads, type DiffPayload } from '@/lib/diff/engine';
import { hashJson } from '@/lib/hashing/canonicalize';
import { evaluatePolicy, type AdvisoryFacts, type PolicyInput } from '@/lib/policy/rules';
import { layoutGraph } from '@/components/blast/layout';
import { diffPieces } from '@/components/strata/ExactDiff';
import { wordDiff } from '@/components/strata/diff';
import { ROLE_TEXT, deltaText, policyFacts } from '@/components/strata/semantics';
import type { BlastRadius } from '@/lib/contracts';
import { SCENARIO, type Scenario } from './scenario';

/**
 * Everything the landing states about the scenario, computed on the server by the product's own
 * engines: the deterministic diff and field role (lib/diff + the HadeethEnc connector's declared
 * roles), field hashes (lib/hashing), the policy outcome (lib/policy) and the dependency layout
 * (components/blast). Nothing here is restated by hand, so changing scenario.ts cannot leave the
 * page claiming a rule or role the engine would not produce.
 */
export function deriveScenario(s: Scenario = SCENARIO) {
  const roles = hadeethencConnector.definition.fieldRoles;
  const [lang, key] = s.field.path.split('.');
  const record = (value: string): DiffPayload => ({
    upstreamVersionLabel: 'unversioned',
    records: [{ canonical_key: `${s.source.connectorId}:${s.source.recordId}`, upstream_record_id: s.source.recordId, content: { [lang]: { id: s.source.recordId, [key]: value } }, metadata: {} }],
  });
  const changes = diffPayloads(record(s.original.value), record(s.mutation.value), roles);
  if (changes.length !== 1) throw new Error(`landing scenario must produce exactly one change, got ${changes.length}`);
  const change = changes[0];

  const base: Omit<PolicyInput, 'advisory'> = {
    sourceType: 'HADITH', contentLevel: 'A', silentMutation: true, serializationOnly: false,
    changes: [{ canonicalKey: change.canonicalKey, changeType: change.changeType, fieldPath: change.fieldPath, fieldRole: change.fieldRole, flags: change.flags }],
  };
  const advisory = (o: Partial<AdvisoryFacts>): AdvisoryFacts => ({
    analysisTypes: [], maxRiskLevel: s.advisory.risk, meaningChanged: true, recommendedAction: s.advisory.recommendedAction,
    materialChangeDetected: s.regression.material > 0, aiFailed: false, regressionFailed: false, ...o,
  });
  const policy = evaluatePolicy({ ...base, advisory: advisory({}) });
  // The same change under different AI inputs: the deterministic floor holds whatever the AI says.
  const counterfactuals = [
    { when: `AI suggests ${s.advisory.recommendedAction.toLowerCase()}`, ...pick(policy) },
    { when: 'AI suggests allow', ...pick(evaluatePolicy({ ...base, advisory: advisory({ recommendedAction: 'ALLOW', maxRiskLevel: 'LOW', meaningChanged: false, materialChangeDetected: false }) })) },
    { when: 'AI fails to answer', ...pick(evaluatePolicy({ ...base, advisory: advisory({ recommendedAction: null, maxRiskLevel: null, meaningChanged: false, materialChangeDetected: false, aiFailed: true }) })) },
  ];
  const rule = policyFacts(policy.policyCode);

  const pieces = diffPieces(s.original.value, s.mutation.value);
  const removed = pieces.ops.filter((p) => p.kind === 'removed').map((p) => p.text.trim());
  const added = pieces.ops.filter((p) => p.kind === 'added').map((p) => p.text.trim());
  const answers = wordDiff(s.regression.oldAnswer, s.regression.newAnswer);

  return {
    s,
    change: {
      path: change.fieldPath ?? s.field.path,
      role: change.fieldRole,
      roleText: ROLE_TEXT[change.fieldRole] ?? change.fieldRole,
      type: change.changeType,
      flags: change.flags,
      oldHash: change.oldFieldHash ?? hashJson(s.original.value),
      newHash: change.newFieldHash ?? hashJson(s.mutation.value),
      pieces, removed, added,
    },
    policy: { code: policy.policyCode, action: policy.action, rule, counterfactuals },
    answers,
    delta: deltaText(s.regression.delta),
    radius: radius(s),
  };
}
const pick = (r: ReturnType<typeof evaluatePolicy>) => ({ code: r.policyCode, action: r.action });

export type Derived = ReturnType<typeof deriveScenario>;

/**
 * The scenario's dependency graph in the product's BlastRadius shape, placed by the product's own
 * layout. Impact follows the product rule: IMPACTED only for a protected app with a material
 * matched regression; other dependants are EXPOSED (a dependency fact, not a behaviour claim).
 */
function radius(s: Scenario) {
  const pathTo = (id: string): string[] => (id === 'source' ? ['source'] : id === 'record' ? ['source', 'record'] : [...pathTo(s.assets.find((a) => a.id === id)!.from), id]);
  const impacted = (a: Scenario['assets'][number]) => !!a.protected && s.regression.material > 0;
  const nodes = [
    { id: 'source', name: s.source.name, assetType: 'SOURCE', impact: 'HEALTHY', dependencyPaths: [], derivationMode: null, derivedFromVersionId: null, servedVersionId: null, regressionEvidence: [], regressionRunIds: [], currentlyServesCandidate: false },
    { id: 'record', name: `${s.source.recordId}`, assetType: 'RECORD', impact: 'HEALTHY', dependencyPaths: [], derivationMode: null, derivedFromVersionId: null, servedVersionId: null, regressionEvidence: [], regressionRunIds: [], currentlyServesCandidate: false },
    ...s.assets.map((a) => ({
      id: a.id, name: a.name, assetType: a.type, impact: impacted(a) ? 'IMPACTED' : 'EXPOSED', dependencyPaths: [pathTo(a.id)],
      derivationMode: a.mode, derivedFromVersionId: 'trusted', servedVersionId: a.protected ? 'trusted' : null,
      regressionEvidence: [], regressionRunIds: [], currentlyServesCandidate: false,
    })),
  ] as unknown as BlastRadius['nodes'];
  const edges = [{ id: 'e-record', from: 'source', to: 'record', type: 'CONTAINS' }, ...s.assets.map((a) => ({ id: `e-${a.id}`, from: a.from, to: a.id, type: 'DEPENDS_ON' }))] as BlastRadius['edges'];
  const lay = layoutGraph({ nodes, edges }, { xs: [1.5, 15, 29, 43, 57, 71, 86], centre: 140, gap: 150, height: 272, minGap: 90 });
  const down = s.assets.length;
  const imp = s.assets.filter(impacted).length;
  const stale = 0; // stale applies only to frozen copies after a promotion; nothing is promoted
  return { lay, down, imp, exp: down - imp - stale, stale, materialized: s.assets.filter((a) => a.mode === 'MATERIALIZED').map((a) => a.name) };
}
