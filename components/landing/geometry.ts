/**
 * Direction E · Held: overlay geometry, in % of the media box, measured from the re-graded
 * Higgsfield plates (docs/landing-hero/e-held.html). The held sheet comes from the still, the stack
 * from the stack-only plate. The trust boundary sits midway between them, slightly larger than both.
 */
export type Pt = [number, number];
type Measure = { sheet: Pt[]; stackTop: Pt[]; stackFB: Pt; stackLB: Pt; stackRB: Pt; card: Pt };

const DESKTOP: Measure = {
  sheet: [[38.9, 38.3], [63.3, 33.6], [92.5, 36.9], [73.5, 43.0]],
  stackTop: [[38.86, 56.7], [63.3, 48.5], [92.5, 52.5], [73.5, 62.4]], stackFB: [73.5, 82.6], stackLB: [38.9, 75.4], stackRB: [92.5, 69.5],
  card: [73.5, 90],
};
const MOBILE: Measure = {
  sheet: [[9.4, 27.1], [46.8, 21.5], [91.4, 25.5], [62.4, 32.6]],
  stackTop: [[9.4, 48.8], [46.8, 39.2], [91.4, 43.8], [62.4, 55.5]], stackFB: [62.4, 79.5], stackLB: [9.4, 70.9], stackRB: [91.4, 63.9],
  card: [62.4, 92],
};

export const pts = (a: Pt[]) => a.map((p) => p.map((n) => +n.toFixed(2)).join(',')).join(' ');

function build(G: Measure) {
  const mid = G.sheet.map((p, i): Pt => [(p[0] + G.stackTop[i][0]) / 2, (p[1] + G.stackTop[i][1]) / 2]);
  const cx = mid.reduce((a, p) => a + p[0], 0) / 4, cy = mid.reduce((a, p) => a + p[1], 0) / 4;
  const scale = (ps: Pt[], k: number) => ps.map((p): Pt => [cx + k * (p[0] - cx), cy + k * (p[1] - cy)]);
  const plane = scale(mid, 1.07), inner = scale(mid, 1.0);
  const T = G.stackTop, S = G.sheet;
  const sy = (S[0][1] + S[3][1]) / 2;
  return {
    ...G, plane, inner,
    /** the front of the boundary, directly beneath the candidate: drawn firmer once policy holds */
    stopEdge: [plane[0], plane[3], plane[2]] as Pt[],
    /** serving path: trusted top edge → down the stack's front corner → into the Islamic Q&A card */
    serveTop: [T[0], T[3], T[2]] as Pt[],
    serveDown: [T[3], G.stackFB, G.card] as Pt[],
    serve: [T[0], T[3], G.stackFB, G.card] as Pt[],
    scan: [[S[0][0] - 2, sy], [S[2][0] + 2, sy]] as Pt[],
  };
}

export const GEO = { desktop: build(DESKTOP), mobile: build(MOBILE) };
export type Geo = ReturnType<typeof build>;
