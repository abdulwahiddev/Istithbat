import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTransientRetry } from '../providers/transient';
import { createGeminiAdapter } from '../providers/gemini';

const res = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
const noSleep = async () => {};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchWithTransientRetry', () => {
  it('resends the identical request after a 503 and returns the success', async () => {
    const bodies: string[] = [];
    const replies = [res(503), res(200, { ok: 1 })];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => { bodies.push(String(init.body)); return replies.shift()!; }));
    const r = await fetchWithTransientRetry('https://x', { method: 'POST', body: '{"a":1}' }, noSleep);
    expect(r.status).toBe(200);
    expect(bodies).toEqual(['{"a":1}', '{"a":1}']);
  });

  it('is bounded: at most 3 sends, then returns the last 5xx', async () => {
    const fn = vi.fn(async () => res(503));
    vi.stubGlobal('fetch', fn);
    const r = await fetchWithTransientRetry('https://x', { method: 'POST', body: '{}' }, noSleep);
    expect(r.status).toBe(503);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it.each([400, 401, 403, 404, 429])('never resends on %i', async (status) => {
    const fn = vi.fn(async () => res(status));
    vi.stubGlobal('fetch', fn);
    const r = await fetchWithTransientRetry('https://x', { method: 'POST' }, noSleep);
    expect(r.status).toBe(status);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not swallow network errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    await expect(fetchWithTransientRetry('https://x', {}, noSleep)).rejects.toThrow('fetch failed');
  });
});

describe('adapter with transient overload', () => {
  it('Gemini succeeds after one 503 without a second generateStructured attempt', async () => {
    vi.useFakeTimers();
    const ok = { candidates: [{ content: { parts: [{ text: '{"x":1}' }] }, finishReason: 'STOP' }] };
    const replies = [res(503, { error: { status: 'UNAVAILABLE', message: 'high demand' } }), res(200, ok)];
    const fn = vi.fn(async () => replies.shift()!);
    vi.stubGlobal('fetch', fn);
    const pending = createGeminiAdapter('k-long-enough-0123456789').call({
      model: 'gemini-3.8-flash', system: 's', messages: [{ role: 'user', content: 'u' }], jsonSchema: { type: 'object' }, maxTokens: 10, temperature: 0, effort: 'low',
    });
    await vi.advanceTimersByTimeAsync(1_000);
    const r = await pending;
    expect(r).toMatchObject({ ok: true, text: '{"x":1}' });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
