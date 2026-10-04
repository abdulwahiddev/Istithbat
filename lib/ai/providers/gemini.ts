import type { ProviderAdapter, ProviderRequest, ProviderResponse } from './types';

/**
 * Gemini API adapter (models.generateContent) with JSON-schema structured output
 * (generationConfig.responseMimeType + responseJsonSchema).
 *
 * Plain fetch, like the other adapters, so no new dependency is needed.
 *
 * Notes:
 * - The key goes in the x-goog-api-key header, never in the URL (URLs end up in logs).
 * - Temperature and thinking settings are NOT sent: current Gemini models are tuned around their
 *   defaults. meta records temperature null and effort null. Both regression sides use the same
 *   model and request shape, so the setting stays matched (Bible §8).
 * - finishReason MAX_TOKENS → TRUNCATED; safety/recitation/prohibited blocks → PROVIDER_REFUSAL.
 * - Errors are sanitised: key-like strings are redacted and the raw error object never leaves.
 */
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 90_000;

const REFUSAL_REASONS = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY']);

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; status?: string; message?: string };
}

/** Remove anything that looks like a credential before a provider message leaves the adapter. */
export function redactGeminiMessage(message: string, apiKey: string): string {
  let out = message;
  if (apiKey) out = out.split(apiKey).join('[redacted]');
  return out.replace(/AIza[0-9A-Za-z_\-]{10,}/g, 'AIza[redacted]').slice(0, 300);
}

export function createGeminiAdapter(apiKey: string): ProviderAdapter {
  return {
    name: 'gemini',
    async call(req: ProviderRequest): Promise<ProviderResponse> {
      const temperatureSent = null;
      const effortSent = null;

      const body = {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: req.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: req.jsonSchema,
          maxOutputTokens: req.maxTokens,
        },
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(`${BASE}/${encodeURIComponent(req.model)}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err) {
        const detail = controller.signal.aborted ? `timeout after ${TIMEOUT_MS} ms` : 'network error';
        void err; // never surface raw errors: they can echo request headers
        return { ok: false, reason: 'PROVIDER_ERROR', detail, temperatureSent, effortSent };
      } finally {
        clearTimeout(timer);
      }

      let json: GeminiResponse;
      try {
        json = (await res.json()) as GeminiResponse;
      } catch {
        return { ok: false, reason: 'PROVIDER_ERROR', detail: `HTTP ${res.status}, non-JSON body`, temperatureSent, effortSent };
      }
      if (!res.ok || json.error) {
        const msg = redactGeminiMessage(json.error?.message ?? 'unknown error', apiKey);
        return { ok: false, reason: 'PROVIDER_ERROR', detail: `HTTP ${res.status} ${json.error?.status ?? ''}: ${msg}`, temperatureSent, effortSent };
      }
      if (json.promptFeedback?.blockReason) {
        return { ok: false, reason: 'PROVIDER_REFUSAL', detail: `prompt blocked (${json.promptFeedback.blockReason})`, temperatureSent, effortSent };
      }
      const candidate = json.candidates?.[0];
      const finish = candidate?.finishReason ?? 'UNKNOWN';
      if (finish === 'MAX_TOKENS') {
        return { ok: false, reason: 'TRUNCATED', detail: `output hit maxOutputTokens=${req.maxTokens}`, temperatureSent, effortSent };
      }
      if (REFUSAL_REASONS.has(finish)) {
        return { ok: false, reason: 'PROVIDER_REFUSAL', detail: `model declined (finishReason: ${finish})`, temperatureSent, effortSent };
      }
      const text = (candidate?.content?.parts ?? [])
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text)
        .join('');
      return { ok: true, text, temperatureSent, effortSent };
    },
  };
}
