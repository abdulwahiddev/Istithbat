export interface ProviderMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ProviderRequest {
  model: string;
  system: string;
  messages: ProviderMessage[];
  /** JSON Schema for the output (already sanitised for the provider). */
  jsonSchema: Record<string, unknown>;
  maxTokens: number;
  temperature: number;
  effort: 'low' | 'medium' | 'high';
}

export type ProviderResponse =
  | {
      ok: true;
      text: string;
      /** Temperature actually sent, or null when the model rejects sampling parameters. */
      temperatureSent: number | null;
      effortSent: string | null;
    }
  | {
      ok: false;
      reason: 'PROVIDER_ERROR' | 'PROVIDER_REFUSAL' | 'TRUNCATED';
      detail: string;
      temperatureSent: number | null;
      effortSent: string | null;
    };

export interface ProviderAdapter {
  name: string;
  call(req: ProviderRequest): Promise<ProviderResponse>;
}
