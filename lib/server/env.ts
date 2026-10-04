import 'server-only';
import { z } from 'zod';
const serverSchema = z.object({
  DATABASE_URL: z.string().url(), DATABASE_URL_DIRECT: z.string().url().optional(),
  SUPABASE_URL: z.string().url(), SUPABASE_SERVICE_ROLE_KEY: z.string().min(1), SNAPSHOT_BUCKET: z.string().min(1),
  AI_PROVIDER: z.string().optional(), AI_MODEL: z.string().optional(), AI_MODE: z.enum(['live','mock','replay']).default('mock'),
  DEMO_REVIEW_SECRET: z.string().min(16), DEMO_CONTROL_SECRET: z.string().min(16), DEMO_WEBHOOK_SECRET: z.string().min(16),
  APP_BASE_URL: z.string().url(), QURANPEDIA_API_BASE: z.string().url().optional(), DORAR_API_BASE: z.string().url().optional(),
});
export function getServerEnv() { return serverSchema.parse(process.env); }
export function requireDatabaseUrl() { const url = process.env.DATABASE_URL; if (!url) throw new Error('DATABASE_URL required'); return url; }
