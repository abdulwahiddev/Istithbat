import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { resolve } from 'node:path';
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL_DIRECT or DATABASE_URL required');
const client = postgres(url, { prepare: false, max: 1 });
try {
  await migrate(drizzle(client), { migrationsFolder: resolve('db/migrations') });
  console.log('Drizzle migrations applied');
} finally { await client.end(); }
