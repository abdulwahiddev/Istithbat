import type { ProviderAdapter, ProviderRequest, ProviderResponse } from './types';

/**
 * Anthropic Messages API adapter using structured outputs (output_config.format).
 *
 * Plain fetch instead of @anthropic-ai/sdk because package.json is Codex-owned (Bible §18);
 * swapping to the SDK later only touches this file.
 *
 * Notes on current models:
 * - Forced tool_choice is rejected on Claude Opus 5.5 / Sonnet 5.5, so JSON is requested with
 *   output_config.format, not a forced tool call.
 * - Sampling parameters (temperature) are rejected with a 400 on Claude Opus 5.x, Opus 4.7+,
 *   Fable 5.x and Sonnet 5.x. For those models temperature is NOT sent and meta records null.
 *   D-15 asks for temperature 0; see docs/HANDOFF.md for the open decision.
 * - Server-side refusal fallbacks are deliberately NOT enabled: a silent switch to another model
 *   would break the "same model on both sides" regression invariant (Bible §8). A refusal fails
 *   closed instead.
 */
const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const TIMEOUT_MS = 90_000;

const NO_SAMPLING_PREFIXES = [
  'claude-opus-5',
  'claude-opus-4-7',
  'claude-opus-4-8',
  'claude-fable-',
  'claude-mythos-',
  'claude-sonnet-5',
];
/** Models that accept output_config.effort. */
const EFFORT_PREFIXES = ['claude-opus-', 'claude-fable-', 'claude-mythos-', 'claude-sonnet-5', 'claude-sonnet-4-6'];

export function acceptsTemperature(model: string): boolean {
  return !NO_SAMPLING_PREFIXES.some((p) => model.startsWith(p));
}

function acceptsEffort(model: string): boolean {
  return EFFORT_PREFIXES.some((p) => model.startsWith(p)) && !model.startsWith('claude-opus-4-1');
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}
interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
  stop_details?: { category?: string | null; explanation?: string | null } | null;
  error?: { type?: string; message?: string };
}

export function createAnthropicAdapter(apiKey: string): ProviderAdapter {
  return {
    name: 'anthropic',
    async call(req: ProviderRequest): Promise<ProviderResponse> {
      const temperatureSent = acceptsTemperature(req.model) ? req.temperature : null;
      const effortSent = acceptsEffort(req.model) ? req.effort : null;
      const outputConfig: Record<string, unknown> = {
        format: { type: 'json_schema', schema: req.jsonSchema },
      };
      if (effortSent) outputConfig.effort = effortSent;

      const body: Record<string, unknown> = {
        model: req.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: req.messages,
        output_config: outputConfig,
      };
      if (temperatureSent !== null) body.temperature = temperatureSent;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': API_VERSION,
          },
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

      let json: AnthropicResponse;
      try {
        json = (await res.json()) as AnthropicResponse;
      } catch {
        return { ok: false, reason: 'PROVIDER_ERROR', detail: `HTTP ${res.status}, non-JSON body`, temperatureSent, effortSent };
      }
      if (!res.ok) {
        const msg = json.error?.message?.slice(0, 300) ?? 'unknown error';
        return { ok: false, reason: 'PROVIDER_ERROR', detail: `HTTP ${res.status} ${json.error?.type ?? ''}: ${msg}`, temperatureSent, effortSent };
      }
      if (json.stop_reason === 'refusal') {
        const category = json.stop_details?.category ?? 'unspecified';
        return { ok: false, reason: 'PROVIDER_REFUSAL', detail: `model declined (category: ${category})`, temperatureSent, effortSent };
      }
      if (json.stop_reason === 'max_tokens') {
        return { ok: false, reason: 'TRUNCATED', detail: `output hit max_tokens=${req.maxTokens}`, temperatureSent, effortSent };
      }
      const text = (json.content ?? [])
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join('');
      return { ok: true, text, temperatureSent, effortSent };
    },
  };
}
