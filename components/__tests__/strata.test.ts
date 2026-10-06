import { describe, expect, it } from 'vitest';
import type { BlastRadius } from '@/lib/contracts';
import { afterApproval, layoutGraph } from '../blast/layout';
import { atPath, isArabic, sameJson, wordDiff } from '../strata/diff';
import { FOLDED, narrate } from '../strata/events';
import { dayTime, evTime, shortHash, word } from '../strata/format';
import { changeHeadline, deltaText, incidentSem, leadIncident, needsDecision, policyFacts, twoLines } from '../strata/semantics';

describe('word diff (display only, text untouched)', () => {
  it('marks the removed qualifier and keeps bytes exact', () => {
    const d = wordDiff('إسناده صحيح', 'صحيح');
    expect(d.removed).toEqual(['إسناده']);
    expect(d.added).toEqual([]);
    expect(d.ops.map((o) => o.kind)).toEqual(['removed', 'same']);
    expect(d.old.map((s) => s.text).join(' ')).toBe('إسناده صحيح');
    expect(d.new.map((s) => s.text).join(' ')).toBe('صحيح');
  });
  it('never normalises harakat: a haraka change is a word change', () => {
    const d = wordDiff('خَلَقَ', 'خُلِقَ');
    expect(d.removed).toEqual(['خَلَقَ']);
    expect(d.added).toEqual(['خُلِقَ']);
  });
  it('reads declared paths and compares JSON regardless of key order', () => {
    expect(atPath({ ar: { hadeeth: 'x' } }, 'ar.hadeeth')).toBe('x');
    expect(atPath({ narrators: ['a'] }, 'narrators[]')).toEqual(['a']);
    expect(sameJson({ a: 1, b: { c: 'ي' } }, { b: { c: 'ي' }, a: 1 })).toBe(true);
    expect(sameJson({ a: 'يَ' }, { a: 'ي' })).toBe(false);
    expect(isArabic('إسناده صحيح')).toBe(true);
    expect(isArabic('page 12')).toBe(false);
  });
});

describe('headlines come from the deterministic diff only', () => {
  it('states a removed word in a grading field', () => {
    const h = changeHeadline('SCHOLAR_JUDGMENT', 'FIELD_MODIFIED', wordDiff('إسناده صحيح', 'صحيح'));
    expect(h).toBe('One word was removed from a grading field.');
    expect(twoLines(h)).toEqual(['One word was removed', 'from a grading field.']);
  });
  it('handles record add/delete and rewording', () => {
    expect(changeHeadline('AUTHORITATIVE_TEXT', 'RECORD_DELETED', null)).toBe('A record was deleted.');
    expect(changeHeadline('PROVENANCE', 'FIELD_MODIFIED', wordDiff('12', '13'))).toBe('A provenance field was reworded.');
  });
});

describe('policy facts are read from the engine definitions', () => {
  it('POL-002 is a judgment change with a quarantine floor', () => {
    expect(policyFacts('POL-002')).toMatchObject({ trigger: 'SCHOLAR_JUDGMENT', floorAction: 'QUARANTINE' });
    expect(policyFacts('POL-002')!.floor).toMatch(/^Quarantine, retest/);
    expect(policyFacts('POL-005')!.floorAction).toBe('ALLOW');
    expect(policyFacts(null)).toBeNull();
  });
});

describe('incident states', () => {
  const base = { status: 'QUARANTINED', pipelineStatus: 'COMPLETE', openedAt: '2026-10-05T20:55:07Z' } as const;
  it('a running pipeline is investigating, never held for review', () => {
    expect(incidentSem({ status: 'NEEDS_REVIEW', pipelineStatus: 'RUNNING' }).text).toBe('Investigating');
    expect(incidentSem({ status: 'NEEDS_REVIEW', pipelineStatus: 'COMPLETE' }).text).toBe('Held for review');
    expect(needsDecision({ status: 'NEEDS_REVIEW', pipelineStatus: 'RUNNING' })).toBe(false);
    expect(needsDecision(base)).toBe(true);
  });
  it('the lead incident is the newest one needing a decision', () => {
    const a = { ...base, openedAt: '2026-10-05T10:00:00Z' }, b = { ...base, status: 'NEEDS_REVIEW', pipelineStatus: 'RUNNING', openedAt: '2026-10-05T12:00:00Z' } as const;
    expect(leadIncident([b, a])).toBe(a);
    expect(leadIncident([{ ...base, status: 'RESOLVED' }])).toBeNull();
  });
  it('delta types read as advisory phrases', () => {
    expect(deltaText(['SCOPE_BROADENING', 'CONCLUSION_CHANGE'])).toBe('Scope broadened, conclusion changed');
    expect(deltaText([])).toBe('No difference');
  });
});

const node = (id: string, assetType: string, impact: 'HEALTHY' | 'EXPOSED' | 'STALE' | 'IMPACTED', path: string[], extra: Partial<BlastRadius['nodes'][number]> = {}): BlastRadius['nodes'][number] => ({
  id, name: id, assetType, impact, dependencyPaths: path.length ? [path] : [], derivationMode: null, derivedFromVersionId: null,
  currentlyServesCandidate: false, servedVersionId: null, regressionEvidence: [], regressionRunIds: [], ...extra,
});
const graph: Pick<BlastRadius, 'nodes' | 'edges' | 'previousVersionId' | 'trustedVersionId'> = {
  previousVersionId: 'v13', trustedVersionId: 'v13',
  nodes: [
    node('source:s', 'SOURCE', 'HEALTHY', []), node('record:s:K', 'RECORD', 'HEALTHY', []),
    node('asset:ds', 'DATASET', 'EXPOSED', ['source:s', 'record:s:K', 'asset:ds'], { derivationMode: 'GATEWAY_RESOLVED', derivedFromVersionId: 'v13' }),
    node('asset:search', 'API', 'EXPOSED', ['source:s', 'record:s:K', 'asset:ds', 'asset:search'], { derivationMode: 'MATERIALIZED', derivedFromVersionId: 'v13' }),
    node('asset:qa', 'API', 'EXPOSED', ['source:s', 'record:s:K', 'asset:ds', 'asset:qa'], { derivationMode: 'GATEWAY_RESOLVED', derivedFromVersionId: 'v13' }),
    node('asset:explorer', 'APPLICATION', 'EXPOSED', ['source:s', 'record:s:K', 'asset:ds', 'asset:search', 'asset:explorer'], { derivationMode: 'MATERIALIZED', derivedFromVersionId: 'v13' }),
    node('asset:app', 'APPLICATION', 'IMPACTED', ['source:s', 'record:s:K', 'asset:ds', 'asset:qa', 'asset:app'], { derivationMode: 'GATEWAY_RESOLVED', derivedFromVersionId: 'v13', servedVersionId: 'v13', regressionRunIds: ['r1'] }),
  ],
  edges: [
    { id: 'e1', from: 'source:s', to: 'record:s:K', type: 'CONTAINS' }, { id: 'e2', from: 'record:s:K', to: 'asset:ds', type: 'DEPENDS_ON' },
    { id: 'e3', from: 'asset:ds', to: 'asset:search', type: 'X' }, { id: 'e4', from: 'asset:ds', to: 'asset:qa', type: 'X' },
    { id: 'e5', from: 'asset:search', to: 'asset:explorer', type: 'X' }, { id: 'e6', from: 'asset:qa', to: 'asset:app', type: 'X' },
  ],
};

describe('blast radius layout and preview', () => {
  const { nodes, edges } = layoutGraph(graph, { xs: [0, 12.5, 25, 37.5, 50, 66, 82], centre: 200, gap: 200, height: 400 });
  it('places columns by dependency depth and the protected branch below', () => {
    const at = Object.fromEntries(nodes.map((n) => [n.id, n]));
    expect(at['source:s'].x).toBe(0);
    expect(at['asset:ds'].x).toBe(25);
    expect(at['asset:search'].y).toBeLessThan(at['asset:qa'].y);
    expect(at['asset:app'].protectedApp).toBe(true);
    expect(at['asset:explorer'].protectedApp).toBe(false);
  });
  it('edge kinds carry meaning: origin, impact, frozen-to-frozen', () => {
    const kind = Object.fromEntries(edges.map((e) => [e.id, e.kind]));
    expect(kind).toMatchObject({ e1: 'src', e2: 'origin', e3: 'exp', e5: 'mat', e6: 'imp' });
  });
  it('If approved: only MATERIALIZED copies of the trusted version go stale (D-07); impact stays', () => {
    const after = Object.fromEntries(graph.nodes.map((n) => [n.id, afterApproval(n, graph)]));
    expect(after['asset:search']).toBe('STALE');
    expect(after['asset:explorer']).toBe('STALE');
    expect(after['asset:qa']).toBe('EXPOSED');
    expect(after['asset:app']).toBe('IMPACTED');
  });
});

describe('record narration', () => {
  const ev = (eventType: string, metadata: Record<string, unknown> = {}, entityType = 'source_version', entityId = 'v14') =>
    ({ id: 'e', eventType, entityType, entityId, actor: 'system:policy', metadata, createdAt: '2026-10-05T21:19:05Z' });
  const ctx = { versionLabel: (id: string | null | undefined) => (id === 'v14' ? 'v14 · r1' : null), servedLabel: 'v13' };
  it('places each authority in its own lane', () => {
    expect(narrate(ev('POLICY_EVALUATED', { policyCode: 'POL-002', action: 'QUARANTINE' }), ctx)).toMatchObject({ lane: 3, title: 'POL-002 matched', tone: 'co' });
    expect(narrate(ev('ANALYSIS_SUCCEEDED', { mode: 'replay' }, 'incident', 'i'), ctx)).toMatchObject({ lane: 2, line: 'Replayed response' });
    expect(narrate(ev('VERSION_QUARANTINED'), ctx)).toMatchObject({ lane: 3, title: 'v14 · r1 quarantined', line: 'The gateway stays on v13' });
    expect(narrate({ ...ev('REVIEW_DECISION', { decision: 'APPROVE' }, 'incident', 'i'), actor: 'reviewer:Abdullah' }, ctx).lane).toBe(4);
  });
  it('names versions removed by a reset neutrally, never inventing a label', () => {
    expect(narrate(ev('VERSION_PROMOTED', {}, 'source_version', 'gone'), ctx).title).toBe('A version promoted');
  });
  it('folds pipeline step events', () => {
    expect(FOLDED.test('PIPELINE_STEP_COMPLETED')).toBe(true);
    expect(FOLDED.test('REGRESSION_COMPARISON_COMPLETED')).toBe(false);
  });
});

describe('formatting', () => {
  it('renders UTC times and short hashes', () => {
    expect(dayTime('2026-10-04T00:00:12Z')).toBe('4 Oct, 00:00:12');
    expect(evTime('2026-10-04T00:00:47Z')).toBe('4 Oct 00:00:47');
    expect(shortHash('485cfd4a0000000000000000000000000000006fa6')).toBe('485cfd4a…6fa6');
    expect(word(7)).toBe('Seven');
  });
});
