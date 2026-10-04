import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProvider, sentTemperature } from '../providers';
import { qaConfig, assertQaMeta } from '@/lib/regression/config';
import { PINNED_CONFIG } from '@/lib/regression/retrieve';
import { generateStructured, QaAnswerSchema } from '../index';

const req = (model: string) => ({
  model, system: 's', messages: [{ role: 'user' as const, content: 'u' }], jsonSchema: { type: 'object' }, maxTokens: 10, temperature: 0, effort: 'low' as const,
});
const bodies: Record<string, unknown> = {
  anthropic: { content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn' },
  openai: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{}' }] }] },
  gemini: { candidates: [{ content: { parts: [{ text: '{}' }] }, finishReason: 'STOP' }] },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('sentTemperature agrees with what each adapter actually sends', () => {
  const cases: Array<[string, string]> = [
    ['anthropic', 'claude-haiku-4-5'],
    ['anthropic', 'claude-opus-5-5'],
    ['openai', 'gpt-6-luna'],
    ['openai', 'gpt-4.1-mini'],
    ['gemini', 'gemini-3.5-flash-lite'],
  ];
  it.each(cases)('%s / %s', async (provider, model) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(bodies[provider]), { status: 200 })));
    const res = await createProvider(provider, 'k-0123456789abcdef')!.call(req(model));
    expect(res.temperatureSent).toBe(sentTemperature(provider, model, 0));
  });
});

describe('Packet 04 matched config is provider-neutral', () => {
  it.each([
    ['gemini', 'gemini-3.5-flash-lite', null],
    ['openai', 'gpt-6-luna', null],
    ['openai', 'gpt-4.1-mini', 0],
    ['anthropic', 'claude-haiku-4-5', 0],
  ] as const)('%s / %s expects temperature %s and accepts the live meta', async (provider, model, expected) => {
    vi.stubEnv('AI_MODE', 'live');
    vi.stubEnv('AI_PROVIDER', provider);
    vi.stubEnv('AI_MODEL', model);
    vi.stubEnv(`${provider.toUpperCase()}_API_KEY`, 'k-0123456789abcdef');
    const config = qaConfig(PINNED_CONFIG);
    expect(config.temperature).toBe(expected);
    const qa = JSON.stringify({ answer: 'a', cited_record_keys: ['HAD-4821'], abstained: false, abstention_reason: null, uncertainty: 'u' });
    const body =
      provider === 'gemini' ? { candidates: [{ content: { parts: [{ text: qa }] }, finishReason: 'STOP' }] }
      : provider === 'openai' ? { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: qa }] }] }
      : { content: [{ type: 'text', text: qa }], stop_reason: 'end_turn' };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
    const result = await generateStructured({
      task: 'QA_ANSWER', schema: QaAnswerSchema, promptVersion: config.prompt_version,
      input: { question: 'q', retrieved_records: [{ canonical_key: 'HAD-4821' }] },
    });
    expect(result.ok).toBe(true);
    expect(() => assertQaMeta(result.meta, config)).not.toThrow();
  });
});
