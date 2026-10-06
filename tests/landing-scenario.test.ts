import { describe, expect, it } from 'vitest';
import { deriveScenario } from '@/components/landing/derive';
import { EVIDENCE, SCENARIO, type Scenario } from '@/components/landing/scenario';
import quranCounts from '@/evaluation/corpus/quran-counts.json';

describe('landing scenario', () => {
  const d = deriveScenario();

  it('classifies the exact change with the HadeethEnc connector roles', () => {
    expect(d.change.path).toBe(SCENARIO.field.path);
    expect(d.change.role).toBe('SCHOLAR_JUDGMENT');
    expect(d.change.type).toBe('FIELD_MODIFIED');
    expect(d.change.flags).toEqual([]);
    expect(d.change.oldHash).not.toBe(d.change.newHash);
  });

  it('shows exactly the removed words and nothing added', () => {
    expect(d.change.removed.join(' ')).toBe('دون قوله: (ولم يستدر)');
    expect(d.change.added).toEqual([]);
    const kept = d.change.pieces.neu.map((p) => p.text).join('');
    expect(kept).toBe(SCENARIO.mutation.value);
  });

  it('is held by POL-002 whatever the AI says', () => {
    expect(d.policy.code).toBe('POL-002');
    expect(d.policy.action).toBe('QUARANTINE');
    for (const c of d.policy.counterfactuals) expect(c).toMatchObject({ code: 'POL-002', action: 'QUARANTINE' });
  });

  it('never shows impact on provisional regression values', () => {
    expect(d.radius.down).toBe(SCENARIO.assets.length);
    const draft: Scenario = { ...SCENARIO, status: 'draft' };
    expect(deriveScenario(draft).radius.imp).toBe(0);
    expect(deriveScenario(draft).radius.pending).toBe(SCENARIO.assets.filter((a) => a.protected).length);
    expect(deriveScenario(draft).radius.graph.nodes.some((n) => n.state === 'impacted')).toBe(false);
    // every downstream asset is exposed while impact is unproven; pending is a subset, not a bucket
    expect(deriveScenario(draft).radius.exp).toBe(SCENARIO.assets.length);
  });

  it('marks only a protected app with a recorded, validated material regression as impacted', () => {
    const real: Scenario = { ...SCENARIO, status: 'validated', regression: { ...SCENARIO.regression, answers: 'recorded', matched: 3, material: 2 } };
    expect(deriveScenario(real).radius.imp).toBe(SCENARIO.assets.filter((a) => a.protected).length);
    expect(deriveScenario(real).radius.pending).toBe(0);
    const none: Scenario = { ...real, regression: { ...real.regression, material: 0 } };
    expect(deriveScenario(none).radius.imp).toBe(0);
  });

  it('refuses a scenario that is not exactly one field change', () => {
    expect(() => deriveScenario({ ...SCENARIO, mutation: { ...SCENARIO.mutation, value: SCENARIO.original.value } })).toThrow();
  });

  it('draws the Quran evidence from the real per-surah counts it claims', () => {
    const counts = Object.values(quranCounts as Record<string, number>);
    expect(counts.length).toBe(EVIDENCE.corpus.surahs);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(EVIDENCE.corpus.ayat);
  });
});
