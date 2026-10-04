import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateStructured } from '../generate';
import { readAiConfig, type AiConfig } from '../config';
import { createProvider } from '../providers';
import { redactGeminiMessage } from '../providers/gemini';
import { QaAnswerSchema } from '../schemas';

const KEY = 'AIzaTESTSECRET0123456789abcdefghijklmn';
const liveGemini: AiConfig = { mode: 'live', provider: 'gemini', model: 'gemini-3.8-flash', apiKey: KEY, recordReplay: false };
const input = (version: string, judgment: string) => ({
  question: "What specifically does the source's grading field describe as sahih?",
  knowledge_version: version,
  retrieved_records: [{ canonical_key: 'HAD-4821', content: { judgment } }],
});
const v13 = input('v13', 'إسناده صحيح');
const v14 = input('v14', 'صحيح');
const qa = (o: Record<string, unknown> = {}) =>
  JSON.stringify({ answer: 'The grading field describes the isnad as sahih.', cited_record_keys: ['HAD-4821'], abstained: false, abstention_reason: null, uncertainty: 'Only the grading field was provided.', ...o });
const ok = (text: string, finishReason = 'STOP') => ({ candidates: [{ content: { parts: [{ text, thought: false }] }, finishReason }] });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function stubFetch(...replies: Array<() => Response>) {
  const calls: Array<{ url: string; body: Record<string, any>; headers: Record<string, string> }> = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
    return replies[Math.min(calls.length - 1, replies.length - 1)]();
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls };
}
afterEach(() => vi.unstubAllGlobals());

describe('Gemini provider', () => {
  it('is registered, and AI_PROVIDER=gemini resolves GEMINI_API_KEY', () => {
    expect(createProvider('gemini', KEY)?.name).toBe('gemini');
    const c = readAiConfig({ AI_MODE: 'live', AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-3.8-flash', GEMINI_API_KEY: KEY } as unknown as NodeJS.ProcessEnv);
    expect(c.apiKey).toBe(KEY);
  });

  it('sends system instruction, contents, JSON schema and max tokens; key only in the header', async () => {
    const { calls } = stubFetch(() => json(ok(qa())));
    const res = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 }, { config: liveGemini });
    expect(res.ok).toBe(true);
    const { url, body, headers } = calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    expect(url).not.toContain(KEY);
    expect(headers['x-goog-api-key']).toBe(KEY);
    expect(body.systemInstruction.parts[0].text.length).toBeGreaterThan(0);
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: expect.stringContaining('sahih') }] }]);
    expect(body.generationConfig).toMatchObject({ responseMimeType: 'application/json', maxOutputTokens: 4000 });
    expect(body.generationConfig.responseJsonSchema.type).toBe('object');
    expect(body.generationConfig).not.toHaveProperty('temperature');
    if (res.ok) expect(res.meta).toMatchObject({ mode: 'live', provider: 'gemini', model: 'gemini-3.8-flash', temperature: null, effort: null, attempts: 1 });
  });

  it('runs one repair retry with the model turn mapped to role "model"', async () => {
    const { calls } = stubFetch(() => json(ok(qa({ cited_record_keys: ['HAD-0001'] }))), () => json(ok(qa())));
    const res = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 }, { config: liveGemini });
    expect(res.ok).toBe(true);
    expect(calls[1].body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
  });

  it('rejects invalid JSON after the repair retry', async () => {
    const { fn } = stubFetch(() => json(ok('{not json')));
    const res = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 }, { config: liveGemini });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('INVALID_OUTPUT');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('maps MAX_TOKENS to TRUNCATED and SAFETY to PROVIDER_REFUSAL', async () => {
    stubFetch(() => json(ok('{"answer":"The', 'MAX_TOKENS')));
    const t = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 }, { config: liveGemini });
    if (!t.ok) expect(t.reason).toBe('TRUNCATED');
    stubFetch(() => json(ok('', 'SAFETY')));
    const s = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 }, { config: liveGemini });
    if (!s.ok) expect(s.reason).toBe('PROVIDER_REFUSAL');
    expect(t.ok || s.ok).toBe(false);
  });

  it('maps HTTP errors to PROVIDER_ERROR and never leaks the key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch(() => json({ error: { code: 400, status: 'INVALID_ARGUMENT', message: `API key not valid: ${KEY}` } }, 400));
    const res = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 }, { config: liveGemini });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('PROVIDER_ERROR');
      expect(res.detail).not.toContain(KEY);
    }
    expect(String(warn.mock.calls[0][0])).not.toContain(KEY);
    expect(redactGeminiMessage(`x AIzaSyAbcdefghijklmnop y`, KEY)).toBe('x AIza[redacted] y');
    warn.mockRestore();
  });

  it('keeps base/candidate requests identical except the knowledge input', async () => {
    const { calls } = stubFetch(() => json(ok(qa())), () => json(ok(qa({ answer: 'The grading field describes the hadith as sahih.' }))));
    const a = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v13 }, { config: liveGemini, now: () => 0 });
    const b = await generateStructured({ task: 'QA_ANSWER', schema: QaAnswerSchema, input: v14 }, { config: liveGemini, now: () => 0 });
    expect({ ...a.meta, inputHash: '' }).toEqual({ ...b.meta, inputHash: '' });
    const { contents: ca, ...ra } = calls[0].body;
    const { contents: cb, ...rb } = calls[1].body;
    expect(ra).toEqual(rb);
    expect(ca).not.toEqual(cb);
  });
});
