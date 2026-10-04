import postgres from 'postgres';
import { establishBaseline } from '../lib/ingestion/baseline';

// Usage: pnpm baseline:real <sourceId> [<sourceId> ...]   (operator action; audited)
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL required');
const ids = process.argv.slice(2);
if (!ids.length) throw new Error('usage: establish-real-baseline <sourceId>...');
const sql = postgres(url, { prepare: false, max: 1 });
try {
  for (const id of ids) console.log(JSON.stringify(await establishBaseline(sql, id, 'operator:baseline-script')));
} finally { await sql.end(); }
