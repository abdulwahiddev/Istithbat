import type { BlastRadius } from '@/lib/contracts';

type Node = BlastRadius['nodes'][number];
export type Placed = Node & { depth: number; x: number; y: number; protectedApp: boolean; app: boolean };
export type PlacedEdge = { id: string; from: string; to: string; d: string; kind: 'src' | 'origin' | 'exp' | 'mat' | 'imp' };

/**
 * Deterministic layout from the persisted graph: column = dependency depth (source 0, record 1,
 * assets by path length), rows spread around the centre line. Within a column, branches that lead
 * to a protected app sit below the others (the frozen boards' reading order). Pure.
 */
export function layoutGraph(br: Pick<BlastRadius, 'nodes' | 'edges'>, opts: { xs: number[]; centre: number; gap: number; height: number; skipSource?: boolean }) {
  const kids = new Map<string, string[]>();
  for (const e of br.edges) kids.set(e.from, [...(kids.get(e.from) ?? []), e.to]);
  const byId = new Map(br.nodes.map((n) => [n.id, n]));
  const isProtected = (n: Node) => n.assetType === 'APPLICATION' && n.servedVersionId !== null;
  const leads = new Map<string, boolean>();
  const leadsTo = (id: string, seen = new Set<string>()): boolean => {
    if (leads.has(id)) return leads.get(id)!;
    if (seen.has(id)) return false;
    seen.add(id);
    const n = byId.get(id);
    const r = (!!n && isProtected(n)) || (kids.get(id) ?? []).some((k) => leadsTo(k, seen));
    leads.set(id, r);
    return r;
  };
  const depth = (n: Node) => (n.assetType === 'SOURCE' ? 0 : n.assetType === 'RECORD' ? 1 : Math.max(2, (n.dependencyPaths[0]?.length ?? 3) - 1));
  const nodes = br.nodes.filter((n) => !(opts.skipSource && n.assetType === 'SOURCE'));
  const cols = new Map<number, Node[]>();
  for (const n of nodes) cols.set(depth(n), [...(cols.get(depth(n)) ?? []), n]);
  const placed: Placed[] = [];
  const minDepth = opts.skipSource ? 1 : 0;
  for (const [d, list] of cols) {
    list.sort((a, b) => Number(leadsTo(a.id)) - Number(leadsTo(b.id)) || a.name.localeCompare(b.name));
    const k = list.length;
    const gap = k > 1 ? Math.min(opts.gap, (opts.height - 80) / (k - 1)) : 0;
    list.forEach((n, i) => placed.push({ ...n, depth: d, x: opts.xs[Math.min(d - minDepth, opts.xs.length - 1)], y: opts.centre + (i - (k - 1) / 2) * gap, protectedApp: isProtected(n), app: n.assetType === 'APPLICATION' }));
  }
  const at = new Map(placed.map((p) => [p.id, p]));
  const edges: PlacedEdge[] = br.edges.filter((e) => at.has(e.from) && at.has(e.to)).map((e) => {
    const a = at.get(e.from)!, b = at.get(e.to)!;
    const d = a.y === b.y ? `M${a.x} ${a.y} L${b.x} ${b.y}` : `M${a.x} ${a.y} L${b.x - 6} ${a.y} C${b.x - 3} ${a.y} ${b.x - 3} ${b.y} ${b.x} ${b.y}`;
    const kind: PlacedEdge['kind'] = a.assetType === 'SOURCE' ? 'src' : a.assetType === 'RECORD' ? 'origin'
      : b.impact === 'IMPACTED' ? 'imp' : a.derivationMode === 'MATERIALIZED' && b.derivationMode === 'MATERIALIZED' ? 'mat' : 'exp';
    return { id: e.id, from: e.from, to: e.to, d, kind };
  });
  return { nodes: placed, edges };
}

/** D-07 preview: what each asset would be if the candidate were promoted, from the same stored facts. */
export function afterApproval(n: Node, br: Pick<BlastRadius, 'previousVersionId' | 'trustedVersionId'>): Node['impact'] {
  if (n.assetType === 'SOURCE' || n.assetType === 'RECORD') return n.impact;
  if (n.impact === 'IMPACTED') return 'IMPACTED';
  if (n.derivationMode === 'MATERIALIZED' && n.derivedFromVersionId && n.derivedFromVersionId === (br.trustedVersionId ?? br.previousVersionId)) return 'STALE';
  return n.impact;
}
