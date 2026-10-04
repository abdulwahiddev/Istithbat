import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { fixtureBytes, fixturePayload, SANDBOX_ID, sandboxConnector } from '../../lib/connectors/sandbox';
import { uploadImmutable } from '../../lib/server/storage';
const url=process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL required');
const sql=postgres(url,{prepare:false,max:1});
const raw=fixtureBytes('had-4821.v13.json');
const payload=fixturePayload('had-4821.v13.json');
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a < b ? -1 : a > b ? 1 : 0)):v);
const canonicalBytes=Buffer.from(canonical(payload));
const rawHash=hash(raw), canonicalHash=hash(canonicalBytes);
const prefix=`snapshots/${SANDBOX_ID}/v13/r1`;
const rawPath=`${prefix}/raw.json`, canonicalPath=`${prefix}/canonical.json`;
try {
  await uploadImmutable(rawPath,raw);
  await uploadImmutable(canonicalPath,canonicalBytes);
  await sql.begin(async tx=>{
    await tx`INSERT INTO sources (id,name,provider,source_type,connector_type,endpoint,is_demo_fixture,rights_note,field_roles_json,content_level) VALUES (${SANDBOX_ID},'Hadith Evidence Sandbox','Istithbat synthetic demo infrastructure','HADITH_EVIDENCE','HTTP_SANDBOX',${process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL}/api/sandbox/current` : '/api/sandbox/current'},true,'Fully synthetic; fixtures authored for this project',${tx.json(sandboxConnector.fieldRoles)},'A') ON CONFLICT (id) DO UPDATE SET field_roles_json=EXCLUDED.field_roles_json,content_level=EXCLUDED.content_level`;
    const versions=await tx`INSERT INTO source_versions (source_id,upstream_version_label,revision_number,upstream_published_at,raw_sha256,canonical_sha256,status,raw_snapshot_path,canonical_snapshot_path,record_count) VALUES (${SANDBOX_ID},'v13',1,${payload.upstreamPublishedAt},${rawHash},${canonicalHash},'TRUSTED',${rawPath},${canonicalPath},${payload.records.length}) ON CONFLICT (source_id,upstream_version_label,revision_number) DO UPDATE SET source_id=EXCLUDED.source_id RETURNING id,raw_sha256,status`;
    const version=versions[0];
    if (version.raw_sha256!==rawHash) throw new Error('Existing baseline fixture hash mismatch');
    for (const record of payload.records) {
      const fieldHashes=Object.fromEntries(Object.entries(record.content).map(([k,v])=>[k,hash(canonical(v))]));
      await tx`INSERT INTO records (source_version_id,canonical_key,upstream_record_id,content_json,metadata_json,record_hash,field_hashes) VALUES (${version.id},${record.canonical_key},${record.upstream_record_id??null},${tx.json(record.content as any)},${tx.json(record.metadata as any)},${hash(canonical(record))},${tx.json(fieldHashes)}) ON CONFLICT (source_version_id,canonical_key) DO NOTHING`;
    }
    const assets=[['sandbox-dataset','Synthetic Evidence Dataset','DATASET'],['sandbox-rag-chunk','Synthetic RAG Chunk','RAG_CHUNK'],['sandbox-index','Knowledge Index','KNOWLEDGE_INDEX'],['sandbox-qa-api','Q&A API','API'],['sandbox-qa-app','Islamic Q&A (synthetic demo)','APPLICATION'],['sandbox-search-api','Search API','API'],['sandbox-content-explorer','Content Explorer (synthetic demo)','APPLICATION']];
    for (const [id,name,type] of assets) await tx`INSERT INTO assets (id,name,asset_type) VALUES (${id},${name},${type}) ON CONFLICT (id) DO NOTHING`;
    for (let i=0;i<4;i++) await tx`INSERT INTO dependencies (from_asset_id,to_asset_id) VALUES (${assets[i][0]},${assets[i+1][0]}) ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO dependencies (from_asset_id,to_asset_id) VALUES ('sandbox-index','sandbox-search-api'),('sandbox-search-api','sandbox-content-explorer') ON CONFLICT DO NOTHING`;
    for (const [id] of assets) await tx`INSERT INTO asset_source_records (asset_id,source_id,canonical_key,derived_from_version_id,derivation_mode) VALUES (${id},${SANDBOX_ID},'HAD-4821',${version.id},${id === 'sandbox-search-api' || id === 'sandbox-content-explorer' ? 'MATERIALIZED' : 'GATEWAY_RESOLVED'}) ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO protected_apps (id,asset_id,name,description) VALUES ('islamic-qa-demo','sandbox-qa-app','Islamic Q&A','Controlled synthetic demo application') ON CONFLICT (id) DO NOTHING`;
    await tx`INSERT INTO gateway_bindings (protected_app_id,source_id,served_version_id,latest_seen_version_id) VALUES ('islamic-qa-demo',${SANDBOX_ID},${version.id},${version.id}) ON CONFLICT (protected_app_id,source_id) DO NOTHING`;
    await tx`INSERT INTO pinned_questions (source_id,canonical_key,question) VALUES (${SANDBOX_ID},'HAD-4821','What specifically does the source''s grading field describe as sahih?') ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO sandbox_state (source_id,fixture_name) VALUES (${SANDBOX_ID},'had-4821.v13.json') ON CONFLICT (source_id) DO NOTHING`;
    const prior=await tx`SELECT 1 FROM audit_events WHERE event_type='BASELINE_SEEDED' AND entity_id=${version.id} LIMIT 1`;
    if (!prior.length) await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json) VALUES ('BASELINE_SEEDED','source_version',${version.id},'system:seed',${tx.json({synthetic:true,rawSha256:rawHash})})`;
  });
  console.log(`Seeded synthetic trusted v13; raw SHA-256 ${rawHash}`);
} finally { await sql.end(); }
