import { hashJson, type JsonValue } from '@/lib/hashing/canonicalize';

export type GraphInput = {
  incident: { id: string; sourceId: string; previousVersionId: string | null; candidateVersionId: string; status: string; policyAction: string | null };
  changes: { id: string; canonicalKey: string; fieldPath: string | null; fieldRole: string | null }[];
  assets: { id: string; name: string; assetType: string }[];
  mappings: { assetId: string; sourceId: string; canonicalKey: string; derivedFromVersionId: string; derivationMode: 'GATEWAY_RESOLVED' | 'MATERIALIZED'; derivedVersionStatus: string }[];
  dependencies: { from: string; to: string; type: string }[];
  protectedApps: { id: string; assetId: string; servedVersionId: string }[];
  regressions: { id: string; protectedAppId: string; oldVersionId: string; newVersionId: string; result: string; status: string }[];
  trustedVersionId: string | null;
};

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export const GRAPH_LIMITS = { nodes: 200, edges: 500 } as const;

/** Frozen D-06: incident-linked MATERIAL_CHANGE proves impact only on an exposed protected app asset. */
export function buildBlastRadius(input: GraphInput) {
  const sourceNodeId = `source:${input.incident.sourceId}`;
  const keys = [...new Set(input.changes.map(change => change.canonicalKey))].sort(compare);
  const assetById = new Map(input.assets.map(asset => [asset.id, asset]));
  const appByAsset = new Map(input.protectedApps.map(app => [app.assetId, app]));
  const mappings = input.mappings.filter(mapping => mapping.sourceId === input.incident.sourceId && keys.includes(mapping.canonicalKey))
    .sort((a, b) => compare(a.canonicalKey, b.canonicalKey) || compare(a.assetId, b.assetId));
  const outgoing = new Map<string, { from: string; to: string; type: string }[]>();
  for (const edge of input.dependencies) {
    if (!assetById.has(edge.from) || !assetById.has(edge.to)) throw new Error('BLAST_RADIUS_INVALID_EDGE');
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
  }
  for (const list of outgoing.values()) list.sort((a, b) => compare(a.to, b.to));
  const edgeMap = new Map<string, { id: string; from: string; to: string; type: string }>();
  const paths = new Map<string, string[][]>();
  const addEdge = (from: string, to: string, type: string) => {
    const id = `${from}->${to}`;
    edgeMap.set(id, { id, from, to, type });
    if (edgeMap.size > GRAPH_LIMITS.edges) throw new Error('BLAST_RADIUS_GRAPH_LIMIT');
  };
  for (const key of keys) {
    const recordNodeId = `record:${input.incident.sourceId}:${key}`;
    addEdge(sourceNodeId, recordNodeId, 'CONTAINS');
    const mapped = mappings.filter(mapping => mapping.canonicalKey === key);
    const mappedIds = new Set(mapped.map(mapping => mapping.assetId));
    const downstreamIds = new Set(input.dependencies.filter(edge => mappedIds.has(edge.from) && mappedIds.has(edge.to)).map(edge => edge.to));
    // Existing rows identify each derivation's source/version; edges identify the actual path.
    const roots = mapped.filter(mapping => !downstreamIds.has(mapping.assetId));
    const queue: { assetId: string; path: string[] }[] = [];
    const seen = new Set<string>();
    // Process roots first, then any disconnected cycle with a stable synthetic root.
    for (const mapping of [...roots, ...mapped]) {
      if (seen.has(mapping.assetId)) continue;
      if (!assetById.has(mapping.assetId)) throw new Error('BLAST_RADIUS_INVALID_MAPPING');
      addEdge(recordNodeId, `asset:${mapping.assetId}`, 'DEPENDS_ON');
      queue.push({ assetId: mapping.assetId, path: [sourceNodeId, recordNodeId, `asset:${mapping.assetId}`] });
      for (let cursor = queue.length - 1; cursor < queue.length; cursor++) {
        const current = queue[cursor];
        if (seen.has(current.assetId)) continue;
        seen.add(current.assetId);
        const existing = paths.get(current.assetId) ?? [];
        if (!existing.some(path => path.join('|') === current.path.join('|'))) paths.set(current.assetId, [...existing, current.path]);
        if (paths.size + keys.length + 1 > GRAPH_LIMITS.nodes) throw new Error('BLAST_RADIUS_GRAPH_LIMIT');
        for (const edge of outgoing.get(current.assetId) ?? []) {
          addEdge(`asset:${edge.from}`, `asset:${edge.to}`, edge.type);
          if (!seen.has(edge.to)) queue.push({ assetId: edge.to, path: [...current.path, `asset:${edge.to}`] });
        }
      }
    }
  }
  const assetNodes = [...paths.keys()].sort(compare).map(assetId => {
    const asset = assetById.get(assetId)!;
    const app = appByAsset.get(assetId);
    const map = mappings.find(mapping => mapping.assetId === assetId);
    const stale = map?.derivationMode === 'MATERIALIZED' && map.derivedVersionStatus === 'SUPERSEDED'
      && map.derivedFromVersionId !== input.trustedVersionId;
    const evidence = app ? input.regressions.filter(run => run.protectedAppId === app.id && run.status === 'COMPLETE'
      && run.result === 'MATERIAL_CHANGE' && run.newVersionId === input.incident.candidateVersionId)
      .sort((a, b) => compare(a.id, b.id)) : [];
    const impact = evidence.length ? 'IMPACTED' : stale ? 'STALE' : 'EXPOSED';
    return {
      id: `asset:${assetId}`, name: asset.name, assetType: asset.assetType, impact,
      dependencyPaths: paths.get(assetId)!, derivationMode: map?.derivationMode ?? null,
      derivedFromVersionId: map?.derivedFromVersionId ?? null,
      currentlyServesCandidate: app?.servedVersionId === input.incident.candidateVersionId,
      servedVersionId: app?.servedVersionId ?? null,
      regressionEvidence: evidence.map(run => ({ id: run.id, oldVersionId: run.oldVersionId,
        newVersionId: run.newVersionId, baselineMatchesIncident: run.oldVersionId === input.incident.previousVersionId })),
      regressionRunIds: evidence.map(run => run.id),
    };
  });
  const nodes = [
    { id: sourceNodeId, name: input.incident.sourceId, assetType: 'SOURCE', impact: 'HEALTHY', dependencyPaths: [], derivationMode: null, derivedFromVersionId: null, currentlyServesCandidate: false, servedVersionId: null, regressionEvidence: [], regressionRunIds: [] },
    ...keys.map(key => ({ id: `record:${input.incident.sourceId}:${key}`, name: key, assetType: 'RECORD', impact: 'HEALTHY', dependencyPaths: [], derivationMode: null, derivedFromVersionId: null, currentlyServesCandidate: false, servedVersionId: null, regressionEvidence: [], regressionRunIds: [] })),
    ...assetNodes,
  ];
  const edges = [...edgeMap.values()].sort((a, b) => compare(a.id, b.id));
  const counts = { exposed: assetNodes.filter(node => node.impact === 'EXPOSED').length,
    stale: assetNodes.filter(node => node.impact === 'STALE').length,
    impacted: assetNodes.filter(node => node.impact === 'IMPACTED').length };
  const evidence = input.changes.map(change => ({ ...change })).sort((a, b) => compare(a.canonicalKey, b.canonicalKey) || compare(a.id, b.id));
  const graph = { incidentId: input.incident.id, sourceId: input.incident.sourceId,
    previousVersionId: input.incident.previousVersionId, candidateVersionId: input.incident.candidateVersionId,
    incidentStatus: input.incident.status, policyAction: input.incident.policyAction,
    trustedVersionId: input.trustedVersionId, candidateServed: input.protectedApps.some(app => app.servedVersionId === input.incident.candidateVersionId),
    changes: evidence, nodes, edges, counts };
  return { ...graph, traversalHash: hashJson(graph as JsonValue) };
}
