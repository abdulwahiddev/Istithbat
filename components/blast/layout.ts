import type { BlastRadius } from '@/lib/contracts';

type Node = BlastRadius['nodes'][number];
type Impact = Node['impact'];
/** A collapsed group of assets in one column ("+7 more"), expandable in place. */
export type Summary = { ids: string[]; counts: Partial<Record<Impact, number>>; types: string[] };
export type Placed = Node & { depth: number; x: number; y: number; protectedApp: boolean; app: boolean; summary?: Summary };
export type PlacedEdge = {
  id: string; from: string; to: string; d: string; kind: 'src' | 'origin' | 'exp' | 'mat' | 'imp';
  /** Endpoints: x in % of the instrument width, y in px. Renderers build pixel paths from these. */
  a: { x: number; y: number }; b: { x: number; y: number };
};
export type LayoutOpts = {
  xs: number[]; centre: number; gap: number; height: number; skipSource?: boolean; minGap?: number;
  /** Columns with more assets than this collapse their lowest-priority assets into one summary node. */
  maxPerColumn?: number;
  /** Depths the reader has expanded. */
  expanded?: ReadonlySet<number>;
};

const isProtected = (n: Node) => n.assetType === 'APPLICATION' && n.servedVersionId !== null;
const TYPE_LABEL: Record<string, string> = { SOURCE: 'Source', RECORD: 'Record', DATASET: 'Dataset', RAG_CHUNK: 'Chunk', KNOWLEDGE_INDEX: 'Index', API: 'API', APPLICATION: 'Application' };
export const typeLabel = (t: string) => TYPE_LABEL[t] ?? t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, ' ');

/** Pixel path between two placed points: straight run, then one soft bend into the target row. */
export function edgePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  if (a.y === b.y) return `M${a.x} ${a.y} L${b.x} ${b.y}`;
  const bend = Math.min(64, Math.max(16, (b.x - a.x) * 0.42));
  return `M${a.x} ${a.y} L${b.x - bend} ${a.y} C${b.x - bend / 2} ${a.y} ${b.x - bend / 2} ${b.y} ${b.x} ${b.y}`;
}

/**
 * Deterministic layout from the persisted graph: column = dependency depth (source 0, record 1,
 * assets by path length), rows spread around the centre line. Within a column, branches that lead
 * to a protected app sit below the others (the frozen boards' reading order). The instrument grows
 * vertically with the busiest column; past `maxPerColumn`, the lowest-priority assets of a column
 * fold into one summary node (impacted and protected assets are never folded first). Pure.
 */
export function layoutGraph(br: Pick<BlastRadius, 'nodes' | 'edges'>, opts: LayoutOpts) {
  const kids = new Map<string, string[]>();
  for (const e of br.edges) kids.set(e.from, [...(kids.get(e.from) ?? []), e.to]);
  const byId = new Map(br.nodes.map((n) => [n.id, n]));
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
  const cols = new Map<number, (Node & { summary?: Summary })[]>();
  for (const n of nodes) cols.set(depth(n), [...(cols.get(depth(n)) ?? []), n]);

  // Fold long columns. Priority: impacted, protected, on a protected branch, then the rest by name.
  const folded = new Map<string, string>();
  const max = opts.maxPerColumn ?? Infinity;
  for (const [d, list] of cols) {
    if (list.length <= max || opts.expanded?.has(d)) continue;
    const rank = (n: Node) => (n.impact === 'IMPACTED' ? 0 : isProtected(n) ? 1 : leadsTo(n.id) ? 2 : 3);
    const ordered = [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    const keep = ordered.slice(0, Math.max(1, max - 1)), hide = ordered.slice(keep.length);
    const id = `summary:${d}`;
    for (const h of hide) folded.set(h.id, id);
    const counts: Summary['counts'] = {};
    for (const h of hide) counts[h.impact] = (counts[h.impact] ?? 0) + 1;
    const types = [...new Set(hide.map((h) => h.assetType))];
    cols.set(d, [...keep, {
      ...hide[0], id, name: `${hide.length} more`, impact: counts.STALE ? 'STALE' : 'EXPOSED', servedVersionId: null,
      regressionEvidence: [], regressionRunIds: [], currentlyServesCandidate: false, dependencyPaths: [],
      assetType: types.length === 1 ? types[0] : 'MIXED', summary: { ids: hide.map((h) => h.id), counts, types },
    }]);
  }

  const placed: Placed[] = [];
  const minDepth = opts.skipSource ? 1 : 0;
  const maxRows = Math.max(1, ...[...cols.values()].map((l) => l.length));
  const minGap = opts.minGap ?? 96;
  // Rows sit between 70px from the top (column headings) and 70px from the bottom (two-line cards).
  const height = Math.max(opts.height, (maxRows - 1) * minGap + 190);
  const centre = height === opts.height ? opts.centre : height / 2;
  for (const [d, list] of cols) {
    // Summary first (top), then the frozen reading order: protected branches below.
    list.sort((a, b) => Number(!a.summary) - Number(!b.summary) || Number(leadsTo(a.id)) - Number(leadsTo(b.id)) || a.name.localeCompare(b.name));
    const k = list.length;
    const gap = k > 1 ? Math.min(opts.gap, (height - 140) / (k - 1)) : 0;
    list.forEach((n, i) => placed.push({ ...n, depth: d, x: opts.xs[Math.min(d - minDepth, opts.xs.length - 1)], y: centre + (i - (k - 1) / 2) * gap, protectedApp: !n.summary && isProtected(n), app: n.assetType === 'APPLICATION' }));
  }
  const at = new Map(placed.map((p) => [p.id, p]));
  const seenEdge = new Set<string>();
  const edges: PlacedEdge[] = [];
  for (const e of br.edges) {
    const from = folded.get(e.from) ?? e.from, to = folded.get(e.to) ?? e.to;
    const a = at.get(from), b = at.get(to);
    if (!a || !b || from === to || seenEdge.has(`${from}>${to}`)) continue;
    seenEdge.add(`${from}>${to}`);
    const d = a.y === b.y ? `M${a.x} ${a.y} L${b.x} ${b.y}` : `M${a.x} ${a.y} L${b.x - 6} ${a.y} C${b.x - 3} ${a.y} ${b.x - 3} ${b.y} ${b.x} ${b.y}`;
    const kind: PlacedEdge['kind'] = a.assetType === 'SOURCE' ? 'src' : a.assetType === 'RECORD' ? 'origin'
      : b.impact === 'IMPACTED' ? 'imp' : a.derivationMode === 'MATERIALIZED' && b.derivationMode === 'MATERIALIZED' ? 'mat' : 'exp';
    edges.push({ id: from === e.from && to === e.to ? e.id : `${from}>${to}`, from, to, d, kind, a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } });
  }
  // Column headings name the asset types actually present at each depth.
  const headings = [...cols.entries()].sort((a, b) => a[0] - b[0]).map(([d, list]) => ({
    depth: d, x: opts.xs[Math.min(d - minDepth, opts.xs.length - 1)],
    label: [...new Set(list.flatMap((n) => (n.summary ? n.summary.types : [n.assetType])).map(typeLabel))].join(' · '),
  }));
  return { nodes: placed, edges, height, headings };
}

/** D-07 preview: what each asset would be if the candidate were promoted, from the same stored facts. */
export function afterApproval(n: Node, br: Pick<BlastRadius, 'previousVersionId' | 'trustedVersionId'>): Node['impact'] {
  if (n.assetType === 'SOURCE' || n.assetType === 'RECORD') return n.impact;
  if (n.impact === 'IMPACTED') return 'IMPACTED';
  if (n.derivationMode === 'MATERIALIZED' && n.derivedFromVersionId && n.derivedFromVersionId === (br.trustedVersionId ?? br.previousVersionId)) return 'STALE';
  return n.impact;
}
