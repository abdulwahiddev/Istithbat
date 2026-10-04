import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateStructured } from '../generate';
import { readAiConfig, type AiConfig } from '../config';
import { createProvider } from '../providers';
import { createOpenAiAdapter, isOpenAiReasoningModel, redactProviderMessage } from '../providers/openai';
import { QaAnswerSchema } from '../schemas';

const KEY = 'sk-test-SECRETVALUE-0123456789abcdef';
const liveOpenAi: AiConfig = { mode: 'live', provider: 'openai', model: 'gpt-6-luna', apiKey: KEY, recordReplay: false };

const question = "What specifically does the source's grading field describe as sahih?";
const inputFor = (version: string, judgment: string) => ({
  question,
  knowledge_version: version,
  retrieved_records: [{ canonical_key: 'HAD-4821', content: { judgment } }],
});
const v13 = inputFor('v13', 'إسناده صحيح');
const v14 = inputFor('v14', 'صحيح');

const validQa = {
  answer: 'The grading field describes the isnad as sahih.',
  cited_record_keys: ['HAD-4821'],
  abstained: false,
  abstention_reason: null,
  uncertainty: 'Only the grading field was provided.',
};

function okBody(text: string) {
  return { status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text }] }] };
}
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Stubs global fetch with queued responses and records every request body. */
function stubFetch(...replies: Array<() => Response | Promise<Response>>) {
  const bodies: Record<string, unknown>[] = [];
  const headers: Record<string, string>[] = [];
  const fn = vi.fn(async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    headers.push(init.headers as Record<string, string>);
    const reply = replies[Math.min(bodies.length - 1, replies.length - 1)];
    return reply();
  });
  vi.stubGlobal('fetch', fn);
  return { fn, bodies, headers };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function qaText(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...validQa, ...overrides });
}

describe('provider registry', () => {
  it('createProvider("openai", key) returns the OpenAI adapter', () => {
    expect(createProvider('openai', KEY)?.name).toBe('openai');
  });
  it('keeps the Anthropic path', () => {
    expect(createProvider('anthropic', KEY)?.name).toBe('anthropic');
  });
  it('returns null for an unsupported provider, and generateStructured fails closed', async () => {
    expect(createProvider('acme', KEY)).toBeNull();
    const { fn } = stubFetch(() => jsonResponse(okBody(qaText())));
    const res = await generateStructured(
      { task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 },
      { config: { ...liveOpenAi, provider: 'acme' } },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('NOT_CONFIGURED');
    expect(fn).not.toHaveBeenCalled();
  });
  it('AI_PROVIDER=openai resolves OPENAI_API_KEY', () => {
    const c = readAiConfig({ AI_MODE: 'live', AI_PROVIDER: 'openai', AI_MODEL: 'gpt-6-luna', OPENAI_API_KEY: KEY } as unknown as NodeJS.ProcessEnv);
    expect(c.provider).toBe('openai');
    expect(c.apiKey).toBe(KEY);
  });
});

describe('OpenAI adapter request', () => {
  it('sends model, instructions, messages, strict JSON schema, max tokens and reasoning effort (no temperature)', async () => {
    const { bodies, headers } = stubFetch(() => jsonResponse(okBody(qaText())));
    const res = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 }, { config: liveOpenAi });
    expect(res.ok).toBe(true);
    const body = bodies[0] as Record<string, any>;
    expect(body.model).toBe('gpt-6-luna');
    expect(typeof body.instructions).toBe('string');
    expect(body.instructions.length).toBeGreaterThan(0);
    expect(body.input).toEqual([{ role: 'user', content: expect.stringContaining(question) }]);
    expect(body.text.format.type).toBe('json_schema');
    expect(body.text.format.strict).toBe(true);
    expect(body.text.format.schema.type).toBe('object');
    expect(body.text.format.schema.additionalProperties).toBe(false);
    expect(body.max_output_tokens).toBe(4000);
    expect(body.reasoning).toEqual({ effort: 'low' });
    expect(body).not.toHaveProperty('temperature');
    expect(body.store).toBe(false);
    expect(headers[0].authorization).toBe(`Bearer ${KEY}`);
    if (res.ok) {
      expect(res.meta).toMatchObject({ mode: 'live', provider: 'openai', model: 'gpt-6-luna', temperature: null, effort: 'low', attempts: 1, maxTokens: 4000 });
    }
  });

  it('sends temperature and no reasoning block for a non-reasoning model', async () => {
    const { bodies } = stubFetch(() => jsonResponse(okBody(qaText())));
    const res = await generateStructured(
      { task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 },
      { config: { ...liveOpenAi, model: 'gpt-4.1-mini' } },
    );
    expect(bodies[0]).toMatchObject({ temperature: 0 });
    expect(bodies[0]).not.toHaveProperty('reasoning');
    if (res.ok) expect(res.meta.temperature).toBe(0);
    expect(isOpenAiReasoningModel('gpt-6-luna')).toBe(true);
    expect(isOpenAiReasoningModel('o3')).toBe(true);
    expect(isOpenAiReasoningModel('gpt-4o-mini')).toBe(false);
  });
});

describe('OpenAI responses through generateStructured', () => {
  it('accepts a valid structured response', async () => {
    stubFetch(() => jsonResponse(okBody(qaText())));
    const res = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 }, { config: liveOpenAi });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.cited_record_keys).toEqual(['HAD-4821']);
  });

  it('rejects invalid JSON (after the one repair retry) — never a success', async () => {
    const { fn } = stubFetch(() => jsonResponse(okBody('not json {')));
    const res = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 }, { config: liveOpenAi });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('INVALID_OUTPUT');
      expect(res.errorCode).toBe('REGRESSION_FAILED');
    }
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('schema-invalid output triggers exactly one repair retry with the correction appended', async () => {
    const { fn, bodies } = stubFetch(
      () => jsonResponse(okBody(qaText({ cited_record_keys: ['HAD-9999'] }))), // guard: fabricated citation
      () => jsonResponse(okBody(qaText())),
    );
    const res = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 }, { config: liveOpenAi });
    expect(res.ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
    const retryInput = (bodies[1] as { input: Array<{ role: string; content: string }> }).input;
    expect(retryInput.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(retryInput[2].content).toContain('rejected');
    if (res.ok) expect(res.meta.attempts).toBe(2);
  });

  it('maps an HTTP error to PROVIDER_ERROR and redacts the key', async () => {
    stubFetch(() =>
      jsonResponse({ error: { type: 'invalid_request_error', code: 'invalid_api_key', message: `Incorrect API key provided: ${KEY}. Also sk-abc***wxyz.` } }, 401),
    );
    const res = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 }, { config: liveOpenAi });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('PROVIDER_ERROR');
      expect(res.detail).toContain('HTTP 401');
      expect(res.detail).not.toContain(KEY);
      expect(res.detail).not.toMatch(/sk-(?!\[redacted\])/);
      expect(JSON.stringify(res.meta)).not.toContain(KEY);
    }
  });

  it('fails safely on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError(`fetch failed (Authorization: Bearer ${KEY})`); }));
    const res = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 }, { config: liveOpenAi });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('PROVIDER_ERROR');
      expect(res.detail).toBe('network error');
    }
  });

  it('fails safely on a timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_u: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
      ),
    );
    const pending = createOpenAiAdapter(KEY).call({
      model: 'gpt-6-luna', system: 's', messages: [{ role: 'user', content: 'u' }], jsonSchema: { type: 'object' }, maxTokens: 10, temperature: 0, effort: 'low',
    });
    await vi.advanceTimersByTimeAsync(90_001);
    const res = await pending;
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('PROVIDER_ERROR');
      expect(res.detail).toMatch(/timeout/);
    }
  });

  it('reports an incomplete (max_output_tokens) response as TRUNCATED', async () => {
    stubFetch(() => jsonResponse({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [{ type: 'message', content: [{ type: 'output_text', text: '{"answer":"The gra' }] }] }));
    const res = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 }, { config: liveOpenAi });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('TRUNCATED');
  });

  it('reports a refusal as PROVIDER_REFUSAL', async () => {
    stubFetch(() => jsonResponse({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] }));
    const res = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 }, { config: liveOpenAi });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('PROVIDER_REFUSAL');
  });

  it('redactProviderMessage strips the exact key and sk- fragments', () => {
    expect(redactProviderMessage(`bad ${KEY} and sk-proj-AbC123***xyz`, KEY)).toBe('bad [redacted] and sk-[redacted]');
  });
});

describe('matched regression metadata (Bible §8)', () => {
  it('base and candidate calls differ only in the knowledge-specific input', async () => {
    const { bodies } = stubFetch(
      () => jsonResponse(okBody(qaText())),
      () => jsonResponse(okBody(qaText({ answer: 'The grading field describes the hadith as sahih.' }))),
    );
    const base = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 }, { config: liveOpenAi, now: () => 0 });
    const cand = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v14 }, { config: liveOpenAi, now: () => 0 });
    expect(base.ok && cand.ok).toBe(true);
    const strip = (m: Record<string, unknown>) => ({ ...m, inputHash: undefined });
    expect(strip(base.meta as never)).toEqual(strip(cand.meta as never));
    expect(base.meta.inputHash).not.toBe(cand.meta.inputHash);
    const [b, c] = bodies as Array<Record<string, any>>;
    const { input: bi, ...bRest } = b;
    const { input: ci, ...cRest } = c;
    expect(bRest).toEqual(cRest); // model, instructions, schema, max tokens, reasoning, store
    expect(bi).not.toEqual(ci);
  });
});

describe('mock mode is unchanged', () => {
  it('never calls the network even when an OpenAI provider is configured', async () => {
    const { fn } = stubFetch(() => jsonResponse(okBody(qaText())));
    const res = await generateStructured(
      { task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 },
      { config: { ...liveOpenAi, mode: 'mock' } },
    );
    expect(fn).not.toHaveBeenCalled();
    expect(res.meta).toMatchObject({ mode: 'mock', provider: 'mock', model: 'mock-v1' });
  });
});
