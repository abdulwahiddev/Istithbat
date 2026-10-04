import { acceptsTemperature, createAnthropicAdapter } from './anthropic';
import { createGeminiAdapter } from './gemini';
import { createOpenAiAdapter, isOpenAiReasoningModel } from './openai';
import type { ProviderAdapter } from './types';

export type { ProviderAdapter, ProviderRequest, ProviderResponse, ProviderMessage } from './types';
export { toProviderJsonSchema } from './json-schema';

/** One live provider (D-15). Add adapters here; callers never see which one is active. */
export function createProvider(name: string, apiKey: string): ProviderAdapter | null {
  switch (name) {
    case 'anthropic':
      return createAnthropicAdapter(apiKey);
    case 'openai':
      return createOpenAiAdapter(apiKey);
    case 'gemini':
      return createGeminiAdapter(apiKey);
    default:
      return null;
  }
}

/**
 * The temperature a live adapter will actually send for this provider/model (null = omitted),
 * i.e. what `meta.temperature` will record. Lets callers that pre-compute a matched configuration
 * (Packet 04 regression) stay provider-neutral. Must agree with each adapter's own rule.
 */
export function sentTemperature(provider: string, model: string, requested: number): number | null {
  switch (provider) {
    case 'anthropic':
      return acceptsTemperature(model) ? requested : null;
    case 'openai':
      return isOpenAiReasoningModel(model) ? null : requested;
    case 'gemini':
      return null;
    default:
      return requested;
  }
}
