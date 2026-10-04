import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { generateStructured } from '../generate';
import { readAiConfig, type AiConfig } from '../config';
import { hashInput, stableStringify } from '../hash';
import { toProviderJsonSchema } from '../providers/json-schema';
import { acceptsTemperature } from '../providers/anthropic';
import { writeReplay } from '../replay/store';
import type { ProviderAdapter, ProviderRequest } from '../providers/types';
import {
  BehaviorDeltaSchema,
  IncidentAnalysisSchema,
  QaAnswerSchema,
  RegressionQuestionsSchema,
  SafetyAnswerSchema,
} from '../schemas';

const mockCfg: AiConfig = { mode: 'mock', provider: null, model: null, apiKey: null, recordReplay: false };
const liveCfg: AiConfig = { mode: 'live', provider: 'fake', model: 'fake-model', apiKey: 'unused', recordReplay: false };

const v13Input = {
  question: "What specifically does the source's grading field describe as sahih?",
  knowledge_version: 'v13',
  retrieved_records: [{ canonical_key: 'HAD-4821', content: { judgment: 'إسناده صحيح' } }],
};

const validAnalysis = {
  analysis_type: 'EVIDENCE_DRIFT',
  risk_level: 'HIGH',
  executive_summary: 'The qualifier was removed.',
  what_changed: 'judgment: «إسناده صحيح» → «صحيح»',
  why_it_matters: 'Apparent scope may broaden from the chain to the report.',
  domain_analysis: { linguistic: 'Qualifier removed.', evidence_scope: 'May broaden. Not a ruling.', provenance_effect: 'None.' },
  potential_downstream_effects: ['Q&A may describe the hadith, not the isnad, as sahih.'],
  recommended_regression_tests: ['What does the grading field describe as sahih?'],
  uncertainties: ['No commentary context.'],
  recommended_action: 'QUARANTINE',
  requires_specialist_review: true,
  confidence: 'MODERATE',
  meaning_changed: true,
};

function fakeProvider(responses: string[]): ProviderAdapter & { calls: ProviderRequest[] } {
  const calls: ProviderRequest[] = [];
  return {
    name: 'fake',
    calls,
    async call(req) {
      calls.push(req);
      const text = responses[Math.min(calls.length - 1, responses.length - 1)];
      return { ok: true, text, temperatureSent: 0, effortSent: req.effort };
    },
  };
}

describe('hash', () => {
  it('is key-order independent and preserves Arabic exactly', () => {
    expect(stableStringify({ b: 1, a: 'خَلَقَ' })).toBe(stableStringify({ a: 'خَلَقَ', b: 1 }));
    expect(hashInput({ t: 'خَلَقَ' })).not.toBe(hashInput({ t: 'خُلِقَ' }));
  });
});

describe('config', () => {
  it('defaults to mock and never exposes a key for an unset provider', () => {
    const c = readAiConfig({} as NodeJS.ProcessEnv);
    expect(c.mode).toBe('mock');
    expect(c.apiKey).toBeNull();
  });
  it('reads <PROVIDER>_API_KEY', () => {
    const c = readAiConfig({ AI_MODE: 'live', AI_PROVIDER: 'anthropic', AI_MODEL: 'm', ANTHROPIC_API_KEY: 'x' } as unknown as NodeJS.ProcessEnv);
    expect(c.apiKey).toBe('x');
  });
});

describe('mock mode', () => {
  it('returns a deterministic, schema-valid, labelled output for every task', async () => {
    const cases = [
      ['INCIDENT_ANALYSIS', IncidentAnalysisSchema, { change: { field_path: 'judgment' } }],
      ['REGRESSION_QUESTIONS', RegressionQuestionsSchema, { change: { field_path: 'judgment' } }],
      ['QA_ANSWER', QaAnswerSchema, v13Input],
      ['BEHAVIOR_DELTA', BehaviorDeltaSchema, { old_answer: 'a', new_answer: 'b' }],
      ['SAFETY_ANSWER', SafetyAnswerSchema, { question: 'q', retrieved_records: [] }],
    ] as const;
    for (const [task, schema, input] of cases) {
      const a = await generateStructured({ task, schema, input }, { config: mockCfg });
      const b = await generateStructured({ task, schema, input }, { config: mockCfg });
      expect(a.ok, task).toBe(true);
      expect(a.meta.mode).toBe('mock');
      expect(a.meta.mockMatch).toBe('default');
      expect(a.meta.temperature).toBe(0);
      if (a.ok && b.ok) expect(stableStringify(a.data)).toBe(stableStringify(b.data));
      expect(JSON.stringify(a.ok && a.data)).toContain('[Mock]');
    }
  });

  it('QA mock quotes each version verbatim, so v13 and v14 differ', async () => {
    const v14 = { ...v13Input, retrieved_records: [{ canonical_key: 'HAD-4821', content: { judgment: 'صحيح' } }] };
    const a = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13Input }, { config: mockCfg });
    const b = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v14 }, { config: mockCfg });
    expect(a.ok && a.data.answer).toContain('«إسناده صحيح»');
    expect(b.ok && b.data.answer).toContain('«صحيح»');
  });

  it('exact mock entries win, and a malformed one fails safely with the task error code', async () => {
    const input = { change: { field_path: 'judgment' } };
    const r = await generateStructured(
      { task: 'INCIDENT_ANALYSIS', schema: IncidentAnalysisSchema, input },
      { config: mockCfg, extraMocks: [{ task: 'INCIDENT_ANALYSIS', inputHash: hashInput(input), output: { risk_level: 'HIGH' } }] },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorCode).toBe('AI_ANALYSIS_FAILED');
      expect(r.reason).toBe('INVALID_OUTPUT');
      expect(r.meta.mockMatch).toBe('exact');
    }
  });
});

describe('live mode (fake provider)', () => {
  it('fails closed when not configured — never fakes a call', async () => {
    const r = await generateStructured(
      { task: 'INCIDENT_ANALYSIS', schema: IncidentAnalysisSchema, input: {} },
      { config: { ...liveCfg, apiKey: null } },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('NOT_CONFIGURED');
  });

  it('accepts valid output on the first attempt', async () => {
    const p = fakeProvider([JSON.stringify(validAnalysis)]);
    const r = await generateStructured({ task: 'INCIDENT_ANALYSIS', schema: IncidentAnalysisSchema, input: { x: 1 } }, { config: liveCfg, provider: p });
    expect(r.ok).toBe(true);
    expect(r.meta.attempts).toBe(1);
    expect(r.meta.promptId).toBe('incident-analysis');
    expect(p.calls[0].system).toContain('do not determine religious truth');
  });

  it('runs exactly one repair retry, then succeeds', async () => {
    const p = fakeProvider(['not json', JSON.stringify(validAnalysis)]);
    const r = await generateStructured({ task: 'INCIDENT_ANALYSIS', schema: IncidentAnalysisSchema, input: {} }, { config: liveCfg, provider: p });
    expect(r.ok).toBe(true);
    expect(r.meta.attempts).toBe(2);
    expect(p.calls[1].messages.at(-1)?.content).toContain('rejected');
  });

  it('returns AI_ANALYSIS_FAILED after two malformed outputs (no third call)', async () => {
    const p = fakeProvider(['{}', '{"analysis_type":"NOPE"}']);
    const r = await generateStructured({ task: 'INCIDENT_ANALYSIS', schema: IncidentAnalysisSchema, input: {} }, { config: liveCfg, provider: p });
    expect(p.calls).toHaveLength(2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorCode).toBe('AI_ANALYSIS_FAILED');
  });

  it('rejects an answer that cites a record it was not given (no fabricated sources)', async () => {
    const bad = JSON.stringify({ answer: 'x', cited_record_keys: ['HAD-9999'], abstained: false, abstention_reason: null, uncertainty: 'u' });
    const p = fakeProvider([bad, bad]);
    const r = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13Input }, { config: liveCfg, provider: p });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorCode).toBe('REGRESSION_FAILED');
      expect(r.detail).toContain('HAD-9999');
    }
  });

  it('rejects a Level D request answered without referral (no personalised rulings)', async () => {
    const bad = JSON.stringify({ request_level: 'D', response_mode: 'ANSWER_WITH_SOURCES', answer: 'x', cited_record_keys: [], referral: null, uncertainty: 'u' });
    const p = fakeProvider([bad, bad]);
    const r = await generateStructured({ task: 'SAFETY_ANSWER', schema: SafetyAnswerSchema, input: { retrieved_records: [] } }, { config: liveCfg, provider: p });
    expect(r.ok).toBe(false);
  });

  it('passes provider refusals through as a failure', async () => {
    const p: ProviderAdapter = { name: 'fake', call: async () => ({ ok: false, reason: 'PROVIDER_REFUSAL', detail: 'declined', temperatureSent: null, effortSent: null }) };
    const r = await generateStructured({ task: 'BEHAVIOR_DELTA', schema: BehaviorDeltaSchema, input: {} }, { config: liveCfg, provider: p });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('PROVIDER_REFUSAL');
  });
});

describe('replay mode', () => {
  const root = mkdtempSync(join(tmpdir(), 'istithbat-replay-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const replayCfg: AiConfig = { ...mockCfg, mode: 'replay' };

  it('fails when nothing was recorded — never falls back silently', async () => {
    const r = await generateStructured({ task: 'INCIDENT_ANALYSIS', schema: IncidentAnalysisSchema, input: { n: 1 } }, { config: replayCfg, replayRoot: root });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('REPLAY_MISSING');
  });

  it('returns the recorded response with its recordedAt timestamp', async () => {
    const input = { n: 2 };
    writeReplay(
      { task: 'INCIDENT_ANALYSIS', promptId: 'incident-analysis', promptVersion: 'v1', inputHash: hashInput(input), provider: 'anthropic', model: 'claude-opus-5-5', temperature: null, effort: 'medium', maxTokens: 8000, recordedAt: '2026-10-05T18:00:00.000Z', output: validAnalysis },
      root,
    );
    const r = await generateStructured({ task: 'INCIDENT_ANALYSIS', schema: IncidentAnalysisSchema, input }, { config: replayCfg, replayRoot: root });
    expect(r.ok).toBe(true);
    expect(r.meta.mode).toBe('replay');
    expect(r.meta.recordedAt).toBe('2026-10-05T18:00:00.000Z');
    expect(r.meta.model).toBe('claude-opus-5-5');
  });
});

describe('provider schema', () => {
  it('closes every object and strips unsupported constraints', () => {
    const s = toProviderJsonSchema(RegressionQuestionsSchema) as Record<string, unknown>;
    const text = JSON.stringify(s);
    expect(text).not.toContain('maxItems');
    expect(text).not.toContain('minLength');
    expect(s.additionalProperties).toBe(false);
  });
  it('knows which models reject temperature', () => {
    expect(acceptsTemperature('claude-opus-5-5')).toBe(false);
    expect(acceptsTemperature('claude-haiku-4-5')).toBe(true);
  });
});
