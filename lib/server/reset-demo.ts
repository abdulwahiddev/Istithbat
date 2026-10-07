import 'server-only';
import { getSql } from '@/lib/db/client';
import { SANDBOX_ID, fixtureBytes, sandboxConnector } from '@/lib/connectors/sandbox';
import { SOURCE_DERIVED_SCENARIO as scenario } from '@/lib/contracts/sandbox-scenario';
import { prepareSnapshot } from '@/lib/hashing/snapshot';
import { uploadImmutable } from '@/lib/server/storage';
import { randomUUID } from 'node:crypto';
export async function resetDemo(options?:{scenario?:'hadeethenc-10618'}) {
  // New files never replace the active simulator. Activation requires this explicit control action.
  const active=options?.scenario ? null : (await getSql()`SELECT fixture_name FROM sandbox_state WHERE source_id=${SANDBOX_ID}`)[0];
  const replacement=(options?.scenario===scenario.id || active?.fixture_name?.startsWith('hadeethenc-10618.')) ? prepareSnapshot(fixtureBytes(scenario.baselineFixture)) : null;
  const existingBaseline=replacement ? await getSql()`SELECT v.id FROM source_versions v JOIN records r ON r.source_version_id=v.id
    WHERE v.source_id=${SANDBOX_ID} AND v.upstream_version_label='v13' AND v.raw_sha256=${replacement.rawSha256} AND r.canonical_key=${scenario.canonicalKey} LIMIT 1` : [];
  const prefix=replacement && !existingBaseline.length ? `snapshots/${SANDBOX_ID}/source-derived-baselines/${randomUUID()}` : null;
  if(replacement && prefix) {
    await uploadImmutable(`${prefix}/raw.json`,replacement.rawBytes);
    await uploadImmutable(`${prefix}/canonical.json`,replacement.canonicalBytes);
  }
  await getSql().begin(async tx=>{
    // Serialize reset with ingestion, policy and blast-radius writes for this source.
    await tx`SELECT id FROM sources WHERE id=${SANDBOX_ID} FOR UPDATE`;
    let baseline;
    if(replacement) {
      baseline=await tx`SELECT v.id FROM source_versions v JOIN records r ON r.source_version_id=v.id WHERE v.source_id=${SANDBOX_ID} AND v.upstream_version_label='v13' AND v.raw_sha256=${replacement.rawSha256} AND r.canonical_key=${scenario.canonicalKey}`;
      if(!baseline.length) {
        if (!prefix) throw new Error('Seed baseline first');
        await tx`UPDATE source_versions SET status='SUPERSEDED' WHERE source_id=${SANDBOX_ID} AND status='TRUSTED'`;
        baseline=await tx`INSERT INTO source_versions (source_id,upstream_version_label,revision_number,upstream_published_at,raw_sha256,canonical_sha256,status,raw_snapshot_path,canonical_snapshot_path,record_count)
          SELECT ${SANDBOX_ID},'v13',COALESCE(MAX(revision_number),0)+1,${replacement.payload.upstreamPublishedAt!},${replacement.rawSha256},${replacement.canonicalSha256},'TRUSTED',${`${prefix}/raw.json`},${`${prefix}/canonical.json`},1 FROM source_versions WHERE source_id=${SANDBOX_ID} AND upstream_version_label='v13' RETURNING id`;
        const record=replacement.records[0];
        await tx`INSERT INTO records (source_version_id,canonical_key,upstream_record_id,content_json,metadata_json,record_hash,field_hashes) VALUES (${baseline[0].id},${record.record.canonical_key},${record.record.upstream_record_id!},${tx.json(record.record.content)},${tx.json(record.record.metadata)},${record.recordHash},${tx.json(record.fieldHashes)})`;
        await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json) VALUES ('BASELINE_SEEDED','source_version',${baseline[0].id},'demo:control',${tx.json({synthetic:true,sourceDerived:true,originalProvider:'HadeethEnc.com',originalRecordId:'10618',rawSha256:replacement.rawSha256})})`;
      }
      await tx`UPDATE sources SET name='HadeethEnc 10618 — controlled integrity sandbox',provider='Istithbat controlled simulator; original record from HadeethEnc',rights_note=${scenario.disclosure},field_roles_json=${tx.json(sandboxConnector.fieldRoles)} WHERE id=${SANDBOX_ID}`;
      await tx`DELETE FROM pinned_questions WHERE source_id=${SANDBOX_ID}`;
      await tx`INSERT INTO pinned_questions (source_id,canonical_key,question) VALUES (${SANDBOX_ID},${scenario.canonicalKey},${scenario.pinnedQuestion})`;
      await tx`UPDATE asset_source_records SET canonical_key=${scenario.canonicalKey} WHERE source_id=${SANDBOX_ID}`;
    } else baseline=await tx`SELECT id FROM source_versions WHERE source_id=${SANDBOX_ID} AND upstream_version_label='v13' AND revision_number=1`;
    if (!baseline.length) throw new Error('Seed baseline first');
    const id=baseline[0].id;
    const cancelledRuns=await tx`SELECT r.id FROM pipeline_runs r JOIN source_versions v ON v.id=r.source_version_id
      WHERE v.source_id=${SANDBOX_ID} AND r.status='RUNNING' FOR UPDATE OF r`;
    await tx`DELETE FROM regression_runs WHERE incident_id IN (SELECT id FROM incidents WHERE source_id=${SANDBOX_ID})`;
    await tx`DELETE FROM pipeline_steps WHERE run_id IN (SELECT id FROM pipeline_runs WHERE source_version_id IN (SELECT id FROM source_versions WHERE source_id=${SANDBOX_ID} AND id<>${id}))`;
    await tx`DELETE FROM pipeline_runs WHERE source_version_id IN (SELECT id FROM source_versions WHERE source_id=${SANDBOX_ID} AND id<>${id})`;
    await tx`DELETE FROM incident_asset_impacts WHERE incident_id IN (SELECT id FROM incidents WHERE source_id=${SANDBOX_ID})`;
    await tx`DELETE FROM review_decisions WHERE incident_id IN (SELECT id FROM incidents WHERE source_id=${SANDBOX_ID})`;
    await tx`DELETE FROM policy_evaluations WHERE source_version_id IN (SELECT id FROM source_versions WHERE source_id=${SANDBOX_ID})`;
    await tx`DELETE FROM analyses WHERE incident_id IN (SELECT id FROM incidents WHERE source_id=${SANDBOX_ID})`;
    await tx`DELETE FROM incidents WHERE source_id=${SANDBOX_ID}`;
    await tx`DELETE FROM changes WHERE to_version_id IN (SELECT id FROM source_versions WHERE source_id=${SANDBOX_ID} AND id<>${id})`;
    await tx`DELETE FROM source_checks WHERE source_id=${SANDBOX_ID}`;
    await tx`UPDATE gateway_bindings SET served_version_id=${id},latest_seen_version_id=${id},gateway_status='SERVING_TRUSTED',updated_at=now() WHERE source_id=${SANDBOX_ID}`;
    await tx`UPDATE asset_source_records SET derived_from_version_id=${id} WHERE source_id=${SANDBOX_ID}  `;
    await tx`DELETE FROM records WHERE source_version_id IN (SELECT id FROM source_versions WHERE source_id=${SANDBOX_ID} AND id<>${id} AND (${!replacement} OR upstream_version_label<>'v13'))`;
    await tx`DELETE FROM source_versions WHERE source_id=${SANDBOX_ID} AND id<>${id} AND (${!replacement} OR upstream_version_label<>'v13')`;
    await tx`UPDATE source_versions SET status='SUPERSEDED' WHERE source_id=${SANDBOX_ID} AND id<>${id} AND status='TRUSTED'`;
    await tx`UPDATE source_versions SET status='TRUSTED' WHERE id=${id}`;
    const [generation]=await tx`UPDATE sandbox_state SET fixture_name=${replacement?scenario.baselineFixture:'had-4821.v13.json'},updated_at=clock_timestamp() WHERE source_id=${SANDBOX_ID} RETURNING updated_at`;
    for(const run of cancelledRuns) await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
      VALUES ('DEMO_RUN_CANCELLED','pipeline_run',${run.id},'demo:control',${tx.json({sourceId:SANDBOX_ID,reason:'DEMO_RESET'})},${`demo-run-cancelled:${run.id}`}) ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json) VALUES ('DEMO_RESET','source',${SANDBOX_ID},'demo:control',${tx.json({baselineVersionId:id,generation:new Date(generation.updated_at).toISOString(),cancelledRunIds:cancelledRuns.map(run=>run.id),...(replacement?{scenario:scenario.id,sourceDerived:true}:{})})})`;
  });
  console.log('Demo reset to trusted v13; audit history retained');
}
