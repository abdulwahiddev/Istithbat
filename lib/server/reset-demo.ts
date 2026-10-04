import 'server-only';
import { getSql } from '@/lib/db/client';
import { SANDBOX_ID } from '@/lib/connectors/sandbox';
export async function resetDemo() {
  await getSql().begin(async tx=>{
    const baseline=await tx`SELECT id FROM source_versions WHERE source_id=${SANDBOX_ID} AND upstream_version_label='v13' AND revision_number=1`;
    if (!baseline.length) throw new Error('Seed baseline first');
    const id=baseline[0].id;
    await tx`DELETE FROM pipeline_steps WHERE run_id IN (SELECT id FROM pipeline_runs WHERE source_version_id IN (SELECT id FROM source_versions WHERE source_id=${SANDBOX_ID} AND id<>${id}))`;
    await tx`DELETE FROM pipeline_runs WHERE source_version_id IN (SELECT id FROM source_versions WHERE source_id=${SANDBOX_ID} AND id<>${id})`;
    await tx`DELETE FROM incident_asset_impacts WHERE incident_id IN (SELECT id FROM incidents WHERE source_id=${SANDBOX_ID})`;
    await tx`DELETE FROM review_decisions WHERE incident_id IN (SELECT id FROM incidents WHERE source_id=${SANDBOX_ID})`;
    await tx`DELETE FROM regression_runs WHERE incident_id IN (SELECT id FROM incidents WHERE source_id=${SANDBOX_ID})`;
    await tx`DELETE FROM policy_evaluations WHERE source_version_id IN (SELECT id FROM source_versions WHERE source_id=${SANDBOX_ID})`;
    await tx`DELETE FROM analyses WHERE incident_id IN (SELECT id FROM incidents WHERE source_id=${SANDBOX_ID})`;
    await tx`DELETE FROM incidents WHERE source_id=${SANDBOX_ID}`;
    await tx`DELETE FROM changes WHERE to_version_id IN (SELECT id FROM source_versions WHERE source_id=${SANDBOX_ID} AND id<>${id})`;
    await tx`DELETE FROM source_checks WHERE source_id=${SANDBOX_ID}`;
    await tx`UPDATE gateway_bindings SET served_version_id=${id},latest_seen_version_id=${id},gateway_status='SERVING_TRUSTED',updated_at=now() WHERE source_id=${SANDBOX_ID}`;
    await tx`UPDATE asset_source_records SET derived_from_version_id=${id} WHERE source_id=${SANDBOX_ID}  `;
    await tx`DELETE FROM records WHERE source_version_id IN (SELECT id FROM source_versions WHERE source_id=${SANDBOX_ID} AND id<>${id})`;
    await tx`DELETE FROM source_versions WHERE source_id=${SANDBOX_ID} AND id<>${id}`;
    await tx`UPDATE source_versions SET status='TRUSTED' WHERE id=${id}`;
    await tx`UPDATE sandbox_state SET fixture_name='had-4821.v13.json',updated_at=now() WHERE source_id=${SANDBOX_ID}`;
    await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json) VALUES ('DEMO_RESET','source',${SANDBOX_ID},'demo:control',${tx.json({baselineVersionId:id})})`;
  });
  console.log('Demo reset to trusted v13; audit history retained');
}
