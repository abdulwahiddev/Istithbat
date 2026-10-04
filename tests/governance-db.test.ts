import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { getSql } from '@/lib/db/client';
import { InvalidReviewTransition, promoteCandidateTx } from '@/lib/gateway/promote';
import { evaluateCandidateTx } from '@/lib/policy/evaluate';
import { reviewIncidentTx } from '@/lib/governance/review';

const live = process.env.ISTITHBAT_LIVE_DB_TEST === '1';
const rollback = new Error('ROLLBACK_TEST_FIXTURE');

async function setup(tx: postgres.TransactionSql) {
  const id = `test-governance-${randomUUID()}`;
  const old = randomUUID(), candidate = randomUUID();
  const asset = `${id}-asset`, app = `${id}-app`;
  await tx`INSERT INTO sources (id,name,provider,source_type,connector_type,endpoint,connector_health,field_roles_json,content_level)
    VALUES (${id},'Transaction test','Istithbat','SANDBOX','TEST','https://example.invalid','HEALTHY',${tx.json({})},'A')`;
  await tx`INSERT INTO source_versions (id,source_id,upstream_version_label,revision_number,raw_sha256,canonical_sha256,status,raw_snapshot_path,canonical_snapshot_path,record_count)
    VALUES (${old},${id},'v13',1,${'a'.repeat(64)},${'b'.repeat(64)},'TRUSTED','test/old/raw','test/old/canonical',0),
      (${candidate},${id},'v14',1,${'c'.repeat(64)},${'d'.repeat(64)},'QUARANTINED','test/new/raw','test/new/canonical',0)`;
  await tx`INSERT INTO assets (id,name,asset_type,metadata_json) VALUES (${asset},'Test app','APPLICATION',${tx.json({})})`;
  await tx`INSERT INTO protected_apps (id,asset_id,name) VALUES (${app},${asset},'Test app')`;
  await tx`INSERT INTO gateway_bindings (protected_app_id,source_id,served_version_id,latest_seen_version_id) VALUES (${app},${id},${old},${candidate})`;
  await tx`INSERT INTO asset_source_records (asset_id,source_id,canonical_key,derived_from_version_id,derivation_mode) VALUES (${asset},${id},'TEST-1',${old},'GATEWAY_RESOLVED')`;
  const incident = (await tx`INSERT INTO incidents (source_id,candidate_version_id,status,title,effective_policy_action)
    VALUES (${id},${candidate},'QUARANTINED','Transaction test','QUARANTINE') RETURNING id`)[0].id as string;
  await tx`INSERT INTO policies (code,priority,trigger_json,action_json,enabled) VALUES ('POL-002',90,${tx.json({})},${tx.json({})},true) ON CONFLICT DO NOTHING`;
  const evaluation = (await tx`INSERT INTO policy_evaluations (source_version_id,incident_id,policy_code,matched,action)
    VALUES (${candidate},${incident},'POL-002',true,'QUARANTINE') RETURNING id`)[0].id as string;
  return { id, old, candidate, incident, evaluation, asset, app };
}

describe.skipIf(!live)('Packet 06 live Postgres transaction invariants', () => {
  it('rolls back every promotion write after injected failure', async () => {
    let sourceId = '';
    await expect(getSql().begin(async tx => {
      const fixture = await setup(tx); sourceId = fixture.id;
      await expect(promoteCandidateTx(tx,{sourceId:fixture.id,candidateVersionId:fixture.candidate,incidentId:fixture.incident,evaluationId:fixture.evaluation,reviewer:'test-reviewer'},{testThrowAfterTrust:true})).rejects.toThrow('TEST_PROMOTION_ROLLBACK');
      const rows = await tx`SELECT status FROM source_versions WHERE id=${fixture.candidate}`;
      expect(rows[0].status).toBe('TRUSTED');
      throw rollback;
    })).rejects.toBe(rollback);
    expect((await getSql()`SELECT id FROM sources WHERE id=${sourceId}`).length).toBe(0);
  }, 20_000);
  it('switches gateway and derivation atomically and rejects double approval', async () => {
    let sourceId = '';
    await expect(getSql().begin(async tx => {
      const fixture = await setup(tx); sourceId = fixture.id;
      const first = await reviewIncidentTx(tx,{incidentId:fixture.incident,decision:'APPROVE',reviewer:'test-reviewer'});
      expect(first.previousVersionId).toBe(fixture.old);
      const binding = (await tx`SELECT served_version_id FROM gateway_bindings WHERE protected_app_id=${fixture.app}`)[0];
      expect(binding.served_version_id).toBe(fixture.candidate);
      const derivation = (await tx`SELECT derived_from_version_id FROM asset_source_records WHERE asset_id=${fixture.asset}`)[0];
      expect(derivation.derived_from_version_id).toBe(fixture.candidate);
      await expect(reviewIncidentTx(tx,{incidentId:fixture.incident,decision:'APPROVE',reviewer:'test-reviewer'})).rejects.toBeInstanceOf(InvalidReviewTransition);
      throw rollback;
    })).rejects.toBe(rollback);
    expect((await getSql()`SELECT id FROM sources WHERE id=${sourceId}`).length).toBe(0);
  }, 20_000);
  it('applies REJECT, KEEP_QUARANTINED, and ESCALATE without moving the gateway', async () => {
    await expect(getSql().begin(async tx => {
      const rejected = await setup(tx);
      await reviewIncidentTx(tx,{incidentId:rejected.incident,decision:'REJECT',reviewer:'test-reviewer'});
      expect((await tx`SELECT status FROM source_versions WHERE id=${rejected.candidate}`)[0].status).toBe('REJECTED');
      expect((await tx`SELECT status FROM incidents WHERE id=${rejected.incident}`)[0].status).toBe('RESOLVED');

      const held = await setup(tx);
      await tx`UPDATE source_versions SET status='ANALYZING' WHERE id=${held.candidate}`;
      await tx`UPDATE incidents SET status='NEEDS_REVIEW',effective_policy_action='REVIEW' WHERE id=${held.incident}`;
      await tx`UPDATE policy_evaluations SET action='REVIEW' WHERE id=${held.evaluation}`;
      await reviewIncidentTx(tx,{incidentId:held.incident,decision:'ESCALATE',reviewer:'test-reviewer'});
      expect((await tx`SELECT status,escalated FROM incidents WHERE id=${held.incident}`)[0]).toMatchObject({status:'NEEDS_REVIEW',escalated:true});
      await expect(reviewIncidentTx(tx,{incidentId:held.incident,decision:'KEEP_QUARANTINED',reviewer:'test-reviewer'})).rejects.toBeInstanceOf(InvalidReviewTransition);
      await reviewIncidentTx(tx,{incidentId:held.incident,decision:'KEEP_QUARANTINED',reviewer:'test-reviewer',reason:'Needs specialist review'});
      expect((await tx`SELECT status FROM source_versions WHERE id=${held.candidate}`)[0].status).toBe('QUARANTINED');
      expect((await tx`SELECT status FROM incidents WHERE id=${held.incident}`)[0].status).toBe('QUARANTINED');
      const served = await tx`SELECT served_version_id FROM gateway_bindings WHERE source_id IN (${rejected.id},${held.id})`;
      expect(served.map(row=>row.served_version_id).sort()).toEqual([rejected.old,held.old].sort());
      throw rollback;
    })).rejects.toBe(rollback);
  }, 45_000);
  it('quarantines after failed AI evidence, preserves v13 service, and reuses one evaluation', async () => {
    await expect(getSql().begin(async tx => {
      const fixture = await setup(tx);
      await tx`DELETE FROM policy_evaluations WHERE id=${fixture.evaluation}`;
      await tx`UPDATE source_versions SET status='ANALYZING' WHERE id=${fixture.candidate}`;
      await tx`UPDATE incidents SET status='NEEDS_REVIEW',effective_policy_action=NULL WHERE id=${fixture.incident}`;
      await tx`INSERT INTO changes (from_version_id,to_version_id,canonical_key,change_type,field_path,field_role,diff_flags,diff_json)
        VALUES (${fixture.old},${fixture.candidate},'TEST-1','FIELD_MODIFIED','judgment','SCHOLAR_JUDGMENT',${tx.json([])},${tx.json({rolesPresent:[]})})`;
      const run = (await tx`INSERT INTO pipeline_runs (source_version_id,incident_id,status) VALUES (${fixture.candidate},${fixture.incident},'RUNNING') RETURNING id`)[0].id;
      await tx`INSERT INTO pipeline_steps (run_id,step,item_key,status,attempts,error_code) VALUES
        (${run},'INCIDENT','','DONE',1,NULL),(${run},'ANALYSIS','','FAILED',2,'AI_ANALYSIS_FAILED'),
        (${run},'REGRESSION_QUESTIONS','','FAILED',2,'REGRESSION_FAILED'),(${run},'BLAST_RADIUS','','PENDING',0,NULL),(${run},'POLICY','','PENDING',0,NULL)`;
      const first = await evaluateCandidateTx(tx,fixture.candidate,fixture.incident);
      const second = await evaluateCandidateTx(tx,fixture.candidate,fixture.incident);
      expect(second).toBe(first);
      const evaluations = await tx`SELECT policy_code,action,advisory_facts_json FROM policy_evaluations WHERE source_version_id=${fixture.candidate}`;
      expect(evaluations).toHaveLength(1);
      expect(evaluations[0]).toMatchObject({policy_code:'POL-002',action:'QUARANTINE'});
      expect(evaluations[0].advisory_facts_json).toMatchObject({aiFailed:true,regressionFailed:true});
      const state = (await tx`SELECT v.status,g.served_version_id FROM source_versions v JOIN gateway_bindings g ON g.source_id=v.source_id WHERE v.id=${fixture.candidate}`)[0];
      expect(state.status).toBe('QUARANTINED');
      expect(state.served_version_id).toBe(fixture.old);
      throw rollback;
    })).rejects.toBe(rollback);
  }, 20_000);
  it('auto-promotes a metadata-only POL-005 candidate without an incident', async () => {
    await expect(getSql().begin(async tx => {
      const fixture = await setup(tx);
      await tx`DELETE FROM policy_evaluations WHERE id=${fixture.evaluation}`;
      await tx`DELETE FROM incidents WHERE id=${fixture.incident}`;
      await tx`UPDATE source_versions SET status='PENDING' WHERE id=${fixture.candidate}`;
      await tx`INSERT INTO changes (from_version_id,to_version_id,canonical_key,change_type,field_path,field_role,diff_flags,diff_json)
        VALUES (${fixture.old},${fixture.candidate},'TEST-1','FIELD_MODIFIED','display_label','OPERATIONAL_METADATA',${tx.json([])},${tx.json({rolesPresent:[]})})`;
      const run = (await tx`INSERT INTO pipeline_runs (source_version_id,status,fast_path) VALUES (${fixture.candidate},'RUNNING',true) RETURNING id`)[0].id;
      await tx`INSERT INTO pipeline_steps (run_id,step,item_key,status) VALUES (${run},'POLICY','','PENDING')`;
      const evaluationId = await evaluateCandidateTx(tx,fixture.candidate,null);
      const evaluation = (await tx`SELECT policy_code,action,deterministic_facts_json FROM policy_evaluations WHERE id=${evaluationId}`)[0];
      expect(evaluation.policy_code).toBe('POL-005');
      expect(evaluation.action).toBe('ALLOW');
      expect(evaluation.deterministic_facts_json.equivalenceReason).toBe('metadata only');
      const binding = (await tx`SELECT served_version_id FROM gateway_bindings WHERE protected_app_id=${fixture.app}`)[0];
      expect(binding.served_version_id).toBe(fixture.candidate);
      expect((await tx`SELECT status FROM source_versions WHERE id=${fixture.old}`)[0].status).toBe('SUPERSEDED');
      expect((await tx`SELECT count(*)::int AS n FROM incidents WHERE candidate_version_id=${fixture.candidate}`)[0].n).toBe(0);
      throw rollback;
    })).rejects.toBe(rollback);
  }, 20_000);
});
