import { hadeethencConnector } from '@/lib/connectors/hadeethenc';
import { diffPayloads, type DiffPayload } from '@/lib/diff/engine';
import { hashJson } from '@/lib/hashing/canonicalize';
import { evaluatePolicy, type AdvisoryFacts, type PolicyInput } from '@/lib/policy/rules';
import { edgePath, layoutGraph } from '@/components/blast/layout';
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

/** Design width of the graph in px; the rendered graph scales uniformly from it. */
export const GRAPH_W = 1200;

/**
 * The scenario's dependency graph in the product's BlastRadius shape, placed by the product's own
 * layout (components/blast/layout) and routed with its own edge geometry (edgePath). Impact
 * follows the product rule: IMPACTED only for a protected app with a material matched regression.
 * While the regression is not a recorded, validated run, such an app is PENDING: exposed, with its
 * impact awaiting validation. It is never drawn as impacted on provisional values.
 */
function radius(s: Scenario) {
  const verified = s.status === 'validated' && s.regression.answers === 'recorded';
  const pathTo = (id: string): string[] => (id === 'source' ? ['source'] : id === 'record' ? ['source', 'record'] : [...pathTo(s.assets.find((a) => a.id === id)!.from), id]);
  const candidate = (a: Scenario['assets'][number]) => !!a.protected && s.regression.material > 0;
  const impact = (a: Scenario['assets'][number]) => (candidate(a) ? (verified ? 'IMPACTED' : 'PENDING') : 'EXPOSED');
  const nodes = [
    { id: 'source', name: s.source.name, assetType: 'SOURCE', impact: 'HEALTHY', dependencyPaths: [], derivationMode: null, derivedFromVersionId: null, servedVersionId: null, regressionEvidence: [], regressionRunIds: [], currentlyServesCandidate: false },
    { id: 'record', name: `${s.source.recordId}`, assetType: 'RECORD', impact: 'HEALTHY', dependencyPaths: [], derivationMode: null, derivedFromVersionId: null, servedVersionId: null, regressionEvidence: [], regressionRunIds: [], currentlyServesCandidate: false },
    ...s.assets.map((a) => ({
      id: a.id, name: a.name, assetType: a.type, impact: impact(a) === 'IMPACTED' ? 'IMPACTED' : 'EXPOSED', dependencyPaths: [pathTo(a.id)],
      derivationMode: a.mode, derivedFromVersionId: 'trusted', servedVersionId: a.protected ? 'trusted' : null,
      regressionEvidence: [], regressionRunIds: [], currentlyServesCandidate: false,
    })),
  ] as unknown as BlastRadius['nodes'];
  const edges = [{ id: 'e-record', from: 'source', to: 'record', type: 'CONTAINS' }, ...s.assets.map((a) => ({ id: `e-${a.id}`, from: a.from, to: a.id, type: 'DEPENDS_ON' }))] as BlastRadius['edges'];
  const H = 272;
  const lay = layoutGraph({ nodes, edges }, { xs: [1, 14, 27, 40, 53, 66, 80], centre: 142, gap: 150, height: H, minGap: 90 });
  const px = (x: number) => (x / 100) * GRAPH_W;
  const state = (id: string, type: string) => type === 'SOURCE' ? 'neutral' : type === 'RECORD' ? 'changed' : impact(s.assets.find((a) => a.id === id)!).toLowerCase() as 'exposed' | 'pending' | 'impacted';
  const graph = {
    w: GRAPH_W, h: lay.height,
    headings: lay.headings.map((h) => ({ depth: h.depth, x: h.x, label: h.label })),
    nodes: lay.nodes.map((n) => ({ id: n.id, name: n.name, type: n.assetType, depth: n.depth, x: n.x, y: n.y, app: n.app, protectedApp: n.protectedApp, mode: n.derivationMode, state: state(n.id, n.assetType) })),
    edges: lay.edges.map((e) => {
      const from = lay.nodes.find((n) => n.id === e.from)!, to = lay.nodes.find((n) => n.id === e.to)!;
      return { id: e.id, from: e.from, to: e.to, kind: e.kind, fromDepth: from.depth, path: edgePath({ x: px(e.a.x), y: e.a.y }, { x: px(e.b.x), y: e.b.y }), toState: state(to.id, to.assetType) };
    }),
  };
  const down = s.assets.length;
  const imp = s.assets.filter((a) => impact(a) === 'IMPACTED').length;
  const pending = s.assets.filter((a) => impact(a) === 'PENDING').length;
  const stale = 0; // stale applies only to frozen copies after a promotion; nothing is promoted
  // pending is a subset of exposed: without proven material impact, the product counts the app as EXPOSED
  return { graph, verified, down, imp, pending, exp: down - imp - stale, stale, pendingNames: s.assets.filter((a) => impact(a) === 'PENDING').map((a) => a.name) };
}

/**
 * The hero's facts, from the same derivation as the sections below it, so the hero and the page
 * can never describe different incidents. Serializable (the hero is a client component).
 * Provisional semantics (AI advisory, matched regression) are flagged, never asserted.
 */
export function heroFacts(d: Derived) {
  const { s, change: c } = d;
  const verified = d.radius.verified;
  return {
    recordKey: `${s.source.connectorId}:${s.source.recordId}`,
    fieldPath: c.path,
    removedCount: c.removed.length,
    removedText: c.removed.join(' '),
    oldPieces: c.pieces.old.map((p) => ({ text: p.text, removed: p.kind === 'removed' })),
    newValue: s.mutation.value,
    oldHash: c.oldHash.slice(0, 8), newHash: c.newHash.slice(0, 8),
    trusted: s.original.version, candidate: s.mutation.version, appName: s.app.name, policyCode: d.policy.code,
    advisory: { label: s.advisory.label, provisional: s.status !== 'validated' },
    regression: verified
      ? { provisional: false, changed: s.regression.material, matched: s.regression.matched }
      : { provisional: true, changed: null, matched: null },
  };
}
export type HeroFacts = ReturnType<typeof heroFacts>;
