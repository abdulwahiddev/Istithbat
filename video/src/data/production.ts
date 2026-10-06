/**
 * VERIFIED PRODUCTION RUN — the only state this video shows.
 *
 * Values come from the product itself wherever it holds them (the sandbox scenario contract, the
 * diff engine, the policy table, the governance transitions, the Production asset graph seeded by
 * db/seed/index.ts) and from the verified results of the Production run for everything else.
 * Nothing here is illustrative. The asserts below fail the render if a derived fact disagrees.
 */
import { SOURCE_DERIVED_SCENARIO as SC } from '@/lib/contracts/sandbox-scenario';
import { wordDiff } from '@/components/strata/diff';
import { changeHeadline, policyFacts, ROLE_TEXT } from '@/components/strata/semantics';
import { canReview, type ReviewAction } from '@/lib/governance/transitions';
import type { BlastRadius } from '@/lib/contracts';

const diff = wordDiff(SC.originalGrade, SC.candidateGrade);

export const RUN = {
  provider: 'HadeethEnc',
  recordId: '10618',
  recordKey: SC.canonicalKey, // SANDBOX-HENC-10618
  disclosure: SC.disclosure,
  field: 'ar.grade',
  fieldRole: 'SCHOLAR_JUDGMENT',
  fieldRoleText: ROLE_TEXT.SCHOLAR_JUDGMENT,
  oldValue: SC.originalGrade, // صحيح دون قوله: (ولم يستدر)
  newValue: SC.candidateGrade, // صحيح
  removed: diff.removed, // the four removed words, as the product's diff computes them
  removedText: diff.removed.join(' '),
  headline: changeHeadline('SCHOLAR_JUDGMENT', 'FIELD_MODIFIED', diff), // product H1
  fingerprint: { old: '449efbaf', new: 'd3908502' },
  policy: { code: 'POL-002', action: 'QUARANTINE', facts: policyFacts('POL-002')! },
  regression: { comparisons: 3, material: 3, nonMaterial: 0 },
  blast: { exposed: 6, impacted: 1, stale: 0 },
  versions: { latest: 'v14', trusted: 'v13', served: 'v13' },
  candidateState: 'Quarantined', // product label for incident status QUARANTINED (semantics.incidentSem)
  app: 'Islamic Q&A',
  appId: 'islamic-qa-demo',
};

// Decisions the product's governance table allows for a QUARANTINED version/incident under a
// QUARANTINE policy action (lib/governance/transitions.canReview).
export const ALLOWED: ReviewAction[] = (['APPROVE', 'REJECT', 'KEEP_QUARANTINED', 'ESCALATE'] as const)
  .filter((d) => canReview(d, 'QUARANTINED', 'QUARANTINED', 'QUARANTINE'));

/**
 * Production dependency graph for the sandbox source: assets, edges and derivation modes exactly as
 * seeded (db/seed/index.ts); impacts as recorded by the run (6 EXPOSED, Islamic Q&A IMPACTED).
 */
const SRC = 'sandbox-source', REC = 'record';
type N = BlastRadius['nodes'][number];
const node = (id: string, name: string, assetType: string, path: string[], o: Partial<N> = {}): N => ({
  id, name, assetType, impact: 'EXPOSED', derivationMode: 'GATEWAY_RESOLVED', derivedFromVersionId: 'v13', servedVersionId: null,
  regressionEvidence: [], regressionRunIds: [], currentlyServesCandidate: false, dependencyPaths: [path], ...o,
});
const p = (...ids: string[]) => [SRC, REC, ...ids];
export const GRAPH: Pick<BlastRadius, 'nodes' | 'edges'> = {
  nodes: [
    node(SRC, 'HadeethEnc 10618 — controlled integrity sandbox', 'SOURCE', [SRC], { impact: 'HEALTHY', derivationMode: null, derivedFromVersionId: null }),
    node(REC, SC.canonicalKey, 'RECORD', [SRC, REC], { derivationMode: null, derivedFromVersionId: null }),
    node('sandbox-dataset', 'Synthetic Evidence Dataset', 'DATASET', p('sandbox-dataset')),
    node('sandbox-rag-chunk', 'Synthetic RAG Chunk', 'RAG_CHUNK', p('sandbox-dataset', 'sandbox-rag-chunk')),
    node('sandbox-index', 'Knowledge Index', 'KNOWLEDGE_INDEX', p('sandbox-dataset', 'sandbox-rag-chunk', 'sandbox-index')),
    node('sandbox-qa-api', 'Q&A API', 'API', p('sandbox-dataset', 'sandbox-rag-chunk', 'sandbox-index', 'sandbox-qa-api')),
    node('sandbox-search-api', 'Search API', 'API', p('sandbox-dataset', 'sandbox-rag-chunk', 'sandbox-index', 'sandbox-search-api'), { derivationMode: 'MATERIALIZED' }),
    node('sandbox-qa-app', 'Islamic Q&A (synthetic demo)', 'APPLICATION', p('sandbox-dataset', 'sandbox-rag-chunk', 'sandbox-index', 'sandbox-qa-api', 'sandbox-qa-app'), { impact: 'IMPACTED', servedVersionId: 'v13' }),
    node('sandbox-content-explorer', 'Content Explorer (synthetic demo)', 'APPLICATION', p('sandbox-dataset', 'sandbox-rag-chunk', 'sandbox-index', 'sandbox-search-api', 'sandbox-content-explorer'), { derivationMode: 'MATERIALIZED' }),
  ],
  edges: [
    [SRC, REC], [REC, 'sandbox-dataset'], ['sandbox-dataset', 'sandbox-rag-chunk'], ['sandbox-rag-chunk', 'sandbox-index'],
    ['sandbox-index', 'sandbox-qa-api'], ['sandbox-qa-api', 'sandbox-qa-app'], ['sandbox-index', 'sandbox-search-api'], ['sandbox-search-api', 'sandbox-content-explorer'],
  ].map(([from, to]) => ({ id: `${from}>${to}`, from, to, type: 'DERIVES' })),
};

// ---- guards: a derived value that disagrees with the verified run stops the render ----
const downstream = GRAPH.nodes.filter((n) => n.assetType !== 'SOURCE' && n.assetType !== 'RECORD');
const check = (ok: boolean, what: string) => { if (!ok) throw new Error(`Verified-fact check failed: ${what}`); };
check(diff.removed.length === 4 && diff.added.length === 0, '4 words removed, 0 added');
check(SC.originalGrade === 'صحيح دون قوله: (ولم يستدر)' && SC.candidateGrade === 'صحيح', 'ar.grade values');
check(downstream.filter((n) => n.impact === 'EXPOSED').length === RUN.blast.exposed, '6 EXPOSED');
check(downstream.filter((n) => n.impact === 'IMPACTED').length === RUN.blast.impacted, '1 IMPACTED');
check(downstream.filter((n) => n.impact === 'STALE').length === RUN.blast.stale, '0 STALE');
check(RUN.policy.facts.floorAction === 'QUARANTINE' && RUN.policy.facts.trigger === 'SCHOLAR_JUDGMENT', 'POL-002 floor');
check(RUN.regression.material + RUN.regression.nonMaterial === RUN.regression.comparisons, 'regression tally');
