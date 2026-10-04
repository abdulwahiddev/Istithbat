import 'server-only';
import { z } from 'zod';
const privilegedStorageKey = z.preprocess(
  value => value === '[SENSITIVE]' ? undefined : value,
  z.string().min(1).optional(),
);

const serverSchema = z.object({
  DATABASE_URL: z.string().url(), DATABASE_URL_DIRECT: z.string().url().optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: privilegedStorageKey,
  SUPABASE_SERVICE_ROLE_KEY: privilegedStorageKey,
  SNAPSHOT_BUCKET: z.string().min(1),
  AI_PROVIDER: z.string().optional(), AI_MODEL: z.string().optional(), AI_MODE: z.enum(['live','mock','replay']).default('mock'),
  DEMO_REVIEW_SECRET: z.string().min(16), DEMO_CONTROL_SECRET: z.string().min(16), DEMO_WEBHOOK_SECRET: z.string().min(16),
  APP_BASE_URL: z.string().url(), QURANPEDIA_API_BASE: z.string().url().optional(), DORAR_API_BASE: z.string().url().optional(),
}).refine(
  env => Boolean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY),
  { message: 'A server-side Supabase Storage key is required', path: ['SUPABASE_SECRET_KEY'] },
).transform(env => ({
  ...env,
  SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY!,
}));
export function getServerEnv() { return serverSchema.parse(process.env); }
export function requireDatabaseUrl() { const url = process.env.DATABASE_URL; if (!url) throw new Error('DATABASE_URL required'); return url; }
