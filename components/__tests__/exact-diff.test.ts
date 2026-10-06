import { describe, expect, it } from 'vitest';
import type { BlastRadius } from '@/lib/contracts';
import { layoutGraph } from '../blast/layout';
import { chooseLayout, diffPieces, expressiveSize, wsTokens } from '../strata/ExactDiff';

const join = (p: { text: string }[]) => p.map((x) => x.text).join('');

describe('exact diff (generic, byte-preserving)', () => {
  it('keeps every byte of multiline values, including leading space and newlines', () => {
    const s = '  first line\n\tsecond  line \n';
    expect(wsTokens(s).join('')).toBe(s);
    const d = diffPieces(s, '  first line\n\tthird  line \n');
    expect(join(d.old)).toBe(s);
    expect(join(d.neu)).toBe('  first line\n\tthird  line \n');
  });
  it('handles several insertions and deletions in one value', () => {
    const d = diffPieces('a b c d e', 'x b c y e z');
    expect(d.ops.filter((o) => o.kind === 'removed').map((o) => o.text.trim())).toEqual(['a', 'd']);
    expect(d.ops.filter((o) => o.kind === 'added').map((o) => o.text.trim())).toEqual(['x', 'y', 'z']);
  });
  it('treats a harakat or punctuation change as a word change, never normalised', () => {
    expect(diffPieces('خَلَقَ الله', 'خُلِقَ الله').ops.map((o) => o.kind)).toEqual(['removed', 'added', 'same']);
    expect(diffPieces('صحيح.', 'صحيح،').ops.map((o) => o.kind)).toEqual(['removed', 'added']);
  });
  it('handles empty and absent sides', () => {
    expect(diffPieces('', 'new').neu.map((p) => p.kind)).toEqual(['added']);
    expect(diffPieces('old', '').old.map((p) => p.kind)).toEqual(['removed']);
  });
  it('chooses a layout from the values, not from the record', () => {
    expect(chooseLayout('إسناده صحيح', 'صحيح')).toBe('expressive');
    expect(chooseLayout('short', 'two\nlines')).toBe('split');
    expect(chooseLayout('x'.repeat(41), 'y')).toBe('split');
    expect(chooseLayout({ a: 1 }, { a: 2 })).toBe('json');
    expect(chooseLayout(null, 'added')).toBe('expressive');
  });
  it('scales expressive type down as text grows', () => {
    expect(expressiveSize('صحيح', true)).toBeGreaterThan(expressiveSize('إسناده صحيح على شرط الشيخين', true));
    expect(expressiveSize('ok', false)).toBeLessThan(expressiveSize('صح', true));
  });
});

type N = BlastRadius['nodes'][number];
const n = (id: string, assetType: string, path: string[], name = id): N => ({
  id, name, assetType, impact: 'EXPOSED', dependencyPaths: [path], derivationMode: 'GATEWAY_RESOLVED', derivedFromVersionId: 'v1',
  currentlyServesCandidate: false, servedVersionId: null, regressionEvidence: [], regressionRunIds: [],
} as unknown as N);
const opts = { xs: [0, 12.5, 25, 37.5, 50, 66, 82], centre: 200, gap: 200, height: 400 };

describe('blast layout adapts to the graph', () => {
  it('keeps the frozen height for a record with no downstream assets', () => {
    const g = layoutGraph({ nodes: [n('s', 'SOURCE', []), n('r', 'RECORD', [])], edges: [{ id: 'e', from: 's', to: 'r', type: 'CONTAINS' }] }, opts);
    expect(g.height).toBe(400);
    expect(g.headings.map((h) => h.label)).toEqual(['Source', 'Record']);
  });
  it('grows for 20 assets in one column and keeps rows apart', () => {
    const many = Array.from({ length: 20 }, (_, i) => n(`a${i}`, 'DATASET', ['s', 'r', `a${i}`], `A very long dataset name number ${i}`));
    const g = layoutGraph({ nodes: [n('s', 'SOURCE', []), n('r', 'RECORD', []), ...many], edges: many.map((a, i) => ({ id: `e${i}`, from: 'r', to: a.id, type: 'X' })) }, opts);
    expect(g.height).toBeGreaterThan(400);
    const ys = g.nodes.filter((x) => x.assetType === 'DATASET').map((x) => x.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(90);
    expect(Math.min(...ys)).toBeGreaterThan(0);
    expect(Math.max(...ys)).toBeLessThan(g.height);
  });
});
