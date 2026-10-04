import { fetchWithTransientRetry } from './transient';
import type { ProviderAdapter, ProviderRequest, ProviderResponse } from './types';

/**
 * OpenAI Responses API adapter using Structured Outputs (text.format json_schema, strict).
 *
 * Plain fetch, like the Anthropic adapter, so no new dependency is needed.
 *
 * Notes:
 * - Reasoning models (o-series, gpt-5*, gpt-6*) take `reasoning.effort`. OpenAI's docs do not
 *   promise sampling parameters on them, so temperature is NOT sent and meta records null.
 *   Both regression sides use the same model, so the setting stays matched either way (Bible §8).
 * - Non-reasoning models (gpt-4o, gpt-4.1, ...) take `temperature` and no reasoning block.
 * - Reasoning tokens count toward max_output_tokens. A response that hits the limit comes back
 *   with status "incomplete" and is reported as TRUNCATED, never as a partial success.
 * - `store: false`: Istithbat persists its own evidence; nothing is kept provider-side.
 * - Errors are sanitised. OpenAI echoes a masked key fragment on 401, so key-like strings are
 *   redacted and the raw error object is never returned.
 */
const ENDPOINT = 'https://api.openai.com/v1/responses';
const TIMEOUT_MS = 90_000;
const SCHEMA_NAME = 'istithbat_output';

const NON_REASONING_PREFIXES = ['gpt-4', 'gpt-3.5', 'chatgpt-4o'];

export function isOpenAiReasoningModel(model: string): boolean {
  return !NON_REASONING_PREFIXES.some((p) => model.startsWith(p));
}

interface OpenAiContentPart {
  type: string;
  text?: string;
  refusal?: string;
}
interface OpenAiOutputItem {
  type: string;
  content?: OpenAiContentPart[];
}
interface OpenAiResponse {
  status?: string;
  output?: OpenAiOutputItem[];
  incomplete_details?: { reason?: string | null } | null;
  error?: { type?: string; code?: string | null; message?: string } | null;
}

/** Remove anything that looks like a credential before a provider message leaves the adapter. */
export function redactProviderMessage(message: string, apiKey: string): string {
  let out = message;
  if (apiKey) out = out.split(apiKey).join('[redacted]');
  return out.replace(/sk-[A-Za-z0-9_\-*.]{4,}/g, 'sk-[redacted]').slice(0, 300);
}

export function createOpenAiAdapter(apiKey: string): ProviderAdapter {
  return {
    name: 'openai',
    async call(req: ProviderRequest): Promise<ProviderResponse> {
      const reasoning = isOpenAiReasoningModel(req.model);
      const temperatureSent = reasoning ? null : req.temperature;
      const effortSent = reasoning ? req.effort : null;

      const body: Record<string, unknown> = {
        model: req.model,
        instructions: req.system,
        input: req.messages.map((m) => ({ role: m.role, content: m.content })),
        text: { format: { type: 'json_schema', name: SCHEMA_NAME, schema: req.jsonSchema, strict: true } },
        max_output_tokens: req.maxTokens,
        store: false,
      };
      if (effortSent) body.reasoning = { effort: effortSent };
      if (temperatureSent !== null) body.temperature = temperatureSent;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetchWithTransientRetry(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
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

      let json: OpenAiResponse;
      try {
        json = (await res.json()) as OpenAiResponse;
      } catch {
        return { ok: false, reason: 'PROVIDER_ERROR', detail: `HTTP ${res.status}, non-JSON body`, temperatureSent, effortSent };
      }
      if (!res.ok || json.status === 'failed') {
        const kind = json.error?.code ?? json.error?.type ?? '';
        const msg = redactProviderMessage(json.error?.message ?? 'unknown error', apiKey);
        return { ok: false, reason: 'PROVIDER_ERROR', detail: `HTTP ${res.status} ${kind}: ${msg}`, temperatureSent, effortSent };
      }
      if (json.status === 'incomplete') {
        const why = json.incomplete_details?.reason ?? 'unspecified';
        if (why === 'content_filter') {
          return { ok: false, reason: 'PROVIDER_REFUSAL', detail: 'response stopped by content filter', temperatureSent, effortSent };
        }
        return { ok: false, reason: 'TRUNCATED', detail: `output incomplete (${why}), max_output_tokens=${req.maxTokens}`, temperatureSent, effortSent };
      }

      const parts = (json.output ?? []).filter((i) => i.type === 'message').flatMap((i) => i.content ?? []);
      if (parts.some((p) => p.type === 'refusal')) {
        return { ok: false, reason: 'PROVIDER_REFUSAL', detail: 'model declined', temperatureSent, effortSent };
      }
      const text = parts
        .filter((p) => p.type === 'output_text' && typeof p.text === 'string')
        .map((p) => p.text)
        .join('');
      return { ok: true, text, temperatureSent, effortSent };
    },
  };
}
