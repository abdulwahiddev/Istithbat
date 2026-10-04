import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getSql } from '@/lib/db/client';
import { computeAndPersistBlastRadiusTx } from '@/lib/blast-radius/service';

const live = process.env.ISTITHBAT_LIVE_DB_TEST === '1';
const rollback = new Error('ROLLBACK_BLAST_FIXTURE');

describe.skipIf(!live)('Packet 05 live Postgres persistence', () => {
  it('persists one row per asset and one immutable audit snapshot across retries', async () => {
    let sourceId = '';
    await expect(getSql().begin(async tx => {
      sourceId = `test-blast-${randomUUID()}`;
      const old = randomUUID(), candidate = randomUUID();
      const dataset = `${sourceId}-dataset`, appAsset = `${sourceId}-app`, frozen = `${sourceId}-frozen`, app = `${sourceId}-protected`;
      await tx`INSERT INTO sources (id,name,provider,source_type,connector_type,endpoint,connector_health,field_roles_json,content_level)
        VALUES (${sourceId},'Blast test','Istithbat','SANDBOX','TEST','https://example.invalid','HEALTHY',${tx.json({})},'A')`;
      await tx`INSERT INTO source_versions (id,source_id,previous_version_id,upstream_version_label,revision_number,raw_sha256,canonical_sha256,status,raw_snapshot_path,canonical_snapshot_path,record_count)
        VALUES (${old},${sourceId},NULL,'v13',1,${'a'.repeat(64)},${'b'.repeat(64)},'SUPERSEDED','test/old/raw','test/old/canonical',0),
          (${candidate},${sourceId},${old},'v14',1,${'c'.repeat(64)},${'d'.repeat(64)},'TRUSTED','test/new/raw','test/new/canonical',0)`;
      const incident = (await tx`INSERT INTO incidents (source_id,previous_version_id,candidate_version_id,status,title,effective_policy_action)
        VALUES (${sourceId},${old},${candidate},'RESOLVED','Blast test','QUARANTINE') RETURNING id`)[0].id as string;
      await tx`INSERT INTO changes (from_version_id,to_version_id,canonical_key,change_type,field_path,field_role,diff_flags,diff_json)
        VALUES (${old},${candidate},'TEST-1','FIELD_MODIFIED','judgment','SCHOLAR_JUDGMENT',${tx.json([])},${tx.json({})})`;
      await tx`INSERT INTO assets (id,name,asset_type) VALUES (${dataset},'Dataset','DATASET'),(${appAsset},'Protected app','APPLICATION'),(${frozen},'Frozen artifact','APPLICATION')`;
      await tx`INSERT INTO dependencies (from_asset_id,to_asset_id) VALUES (${dataset},${appAsset}),(${dataset},${frozen})`;
      await tx`INSERT INTO asset_source_records (asset_id,source_id,canonical_key,derived_from_version_id,derivation_mode)
        VALUES (${dataset},${sourceId},'TEST-1',${candidate},'GATEWAY_RESOLVED'),
          (${appAsset},${sourceId},'TEST-1',${candidate},'GATEWAY_RESOLVED'),
          (${frozen},${sourceId},'TEST-1',${old},'MATERIALIZED')`;
      await tx`INSERT INTO protected_apps (id,asset_id,name) VALUES (${app},${appAsset},'Protected app')`;
      await tx`INSERT INTO gateway_bindings (protected_app_id,source_id,served_version_id,latest_seen_version_id)
        VALUES (${app},${sourceId},${candidate},${candidate})`;
      const regression = (await tx`INSERT INTO regression_runs (incident_id,protected_app_id,batch_id,question,question_origin,old_version_id,new_version_id,status,result)
        VALUES (${incident},${app},${randomUUID()},'Synthetic test question','pinned',${old},${candidate},'COMPLETE','MATERIAL_CHANGE') RETURNING id`)[0].id;
      const first = await computeAndPersistBlastRadiusTx(tx,incident,'PIPELINE');
      const second = await computeAndPersistBlastRadiusTx(tx,incident,'PIPELINE');
      expect(second).toBe(first);
      const impacts = await tx`SELECT asset_id,impact,regression_run_ids FROM incident_asset_impacts WHERE incident_id=${incident} ORDER BY asset_id`;
      expect(impacts).toHaveLength(3);
      expect(impacts.find(row => row.asset_id === appAsset)).toMatchObject({impact:'IMPACTED',regression_run_ids:[regression]});
      expect(impacts.find(row => row.asset_id === frozen)?.impact).toBe('STALE');
      expect((await tx`SELECT count(*)::int AS n FROM audit_events WHERE entity_id=${incident} AND event_type='BLAST_RADIUS_COMPUTED'`)[0].n).toBe(1);
      throw rollback;
    })).rejects.toBe(rollback);
    expect((await getSql()`SELECT id FROM sources WHERE id=${sourceId}`).length).toBe(0);
  }, 30_000);
});
