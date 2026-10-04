import { createAnthropicAdapter } from './anthropic';
import { createOpenAiAdapter } from './openai';
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
    default:
      return null;
  }
}
