import 'server-only';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/db/schema';
import { requireDatabaseUrl } from '@/lib/server/env';
let client: ReturnType<typeof postgres> | undefined;
export function getSql() { return client ??= postgres(requireDatabaseUrl(), { prepare: false, max: 1 }); }
export function getDb() { return drizzle(getSql(), { schema }); }
