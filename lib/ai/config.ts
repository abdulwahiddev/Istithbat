import { z } from 'zod';
import { AI_MODES, type AiMode } from './types';

/**
 * AI configuration, read from server-only env (D-11). Parsed narrowly here instead of
 * via lib/server/env.ts so mock-mode tests do not need DB/Supabase variables.
 * The API key is read but never logged, returned in meta, or sent to the client.
 */
export interface AiConfig {
  mode: AiMode;
  provider: string | null; // 'anthropic'
  model: string | null;
  apiKey: string | null;
  /** When true (local rehearsal only), live responses are written to the replay store. */
  recordReplay: boolean;
}

const envSchema = z.object({
  AI_MODE: z.enum(AI_MODES).default('mock'),
  AI_PROVIDER: z.string().trim().toLowerCase().optional(),
  AI_MODEL: z.string().trim().optional(),
  AI_RECORD_REPLAY: z.enum(['0', '1']).optional(),
});

/** <PROVIDER>_API_KEY, e.g. ANTHROPIC_API_KEY (Bible §17). */
function apiKeyFor(provider: string | undefined, env: NodeJS.ProcessEnv): string | null {
  if (!provider) return null;
  const value = env[`${provider.toUpperCase()}_API_KEY`];
  return value && value.length > 0 ? value : null;
}

export function readAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const parsed = envSchema.parse({
    AI_MODE: env.AI_MODE || undefined,
    AI_PROVIDER: env.AI_PROVIDER || undefined,
    AI_MODEL: env.AI_MODEL || undefined,
    AI_RECORD_REPLAY: env.AI_RECORD_REPLAY || undefined,
  });
  return {
    mode: parsed.AI_MODE,
    provider: parsed.AI_PROVIDER ?? null,
    model: parsed.AI_MODEL ?? null,
    apiKey: apiKeyFor(parsed.AI_PROVIDER, env),
    recordReplay: parsed.AI_RECORD_REPLAY === '1' && !env.VERCEL,
  };
}
