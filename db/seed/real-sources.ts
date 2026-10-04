import postgres from 'postgres';
import { listHttpConnectors } from '../../lib/connectors/registry';

// Registers the real, read-only connectors (HadeethEnc, QuranEnc). Idempotent. Creates no versions:
// the first snapshot is taken by a normal source check, and its baseline is established explicitly.
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL required');
const sql = postgres(url, { prepare: false, max: 1 });
try {
  for (const c of listHttpConnectors()) {
    const s = c.source;
    await sql`INSERT INTO sources (id,name,provider,source_type,connector_type,endpoint,connector_health,is_demo_fixture,rights_note,field_roles_json,content_level)
      VALUES (${s.id},${s.name},${s.provider},${s.sourceType},${s.connectorType},${s.endpoint},'HEALTHY',false,${s.rightsNote},${sql.json(c.definition.fieldRoles)},${c.definition.contentLevel})
      ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,provider=EXCLUDED.provider,source_type=EXCLUDED.source_type,connector_type=EXCLUDED.connector_type,
        endpoint=EXCLUDED.endpoint,rights_note=EXCLUDED.rights_note,field_roles_json=EXCLUDED.field_roles_json,content_level=EXCLUDED.content_level`;
    console.log(`registered ${s.id}`);
  }
} finally { await sql.end(); }
