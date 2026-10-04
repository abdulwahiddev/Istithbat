import 'server-only';
import type postgres from 'postgres';
import { getSql } from '@/lib/db/client';
import { buildBlastRadius, type GraphInput } from './graph';
import type { JsonValue } from '@/lib/hashing/canonicalize';
import { PipelineStepError } from '@/lib/pipeline/handlers';

async function loadInput(tx: postgres.TransactionSql, incidentId: string): Promise<GraphInput | null> {
  const [incident] = await tx`SELECT id,source_id,previous_version_id,candidate_version_id,status,effective_policy_action
    FROM incidents WHERE id=${incidentId}`;
  if (!incident) return null;
  const [changes, assets, mappings, dependencies, protectedApps, regressions, trusted] = await Promise.all([
    tx`SELECT id,canonical_key,field_path,field_role FROM changes WHERE to_version_id=${incident.candidate_version_id} ORDER BY canonical_key,id`,
    tx`SELECT id,name,asset_type FROM assets ORDER BY id`,
    tx`SELECT m.asset_id,m.source_id,m.canonical_key,m.derived_from_version_id,m.derivation_mode,v.status AS derived_version_status
      FROM asset_source_records m JOIN source_versions v ON v.id=m.derived_from_version_id WHERE m.source_id=${incident.source_id} ORDER BY m.canonical_key,m.asset_id`,
    tx`SELECT from_asset_id,to_asset_id,dependency_type FROM dependencies ORDER BY from_asset_id,to_asset_id`,
    tx`SELECT p.id,p.asset_id,g.served_version_id FROM protected_apps p JOIN gateway_bindings g ON g.protected_app_id=p.id
      WHERE g.source_id=${incident.source_id} ORDER BY p.id`,
    tx`SELECT id,protected_app_id,old_version_id,new_version_id,result,status FROM regression_runs
      WHERE incident_id=${incidentId} ORDER BY id`,
    tx`SELECT id FROM source_versions WHERE source_id=${incident.source_id} AND status='TRUSTED'`,
  ]);
  return {
    incident: { id: incident.id, sourceId: incident.source_id, previousVersionId: incident.previous_version_id,
      candidateVersionId: incident.candidate_version_id, status: incident.status, policyAction: incident.effective_policy_action },
    changes: changes.map(row => ({ id: row.id, canonicalKey: row.canonical_key, fieldPath: row.field_path, fieldRole: row.field_role })),
    assets: assets.map(row => ({ id: row.id, name: row.name, assetType: row.asset_type })),
    mappings: mappings.map(row => ({ assetId: row.asset_id, sourceId: row.source_id, canonicalKey: row.canonical_key,
      derivedFromVersionId: row.derived_from_version_id, derivationMode: row.derivation_mode,
      derivedVersionStatus: row.derived_version_status })),
    dependencies: dependencies.map(row => ({ from: row.from_asset_id, to: row.to_asset_id, type: row.dependency_type })),
    protectedApps: protectedApps.map(row => ({ id: row.id, assetId: row.asset_id, servedVersionId: row.served_version_id })),
    regressions: regressions.map(row => ({ id: row.id, protectedAppId: row.protected_app_id,
      oldVersionId: row.old_version_id, newVersionId: row.new_version_id, result: row.result, status: row.status })),
    trustedVersionId: trusted[0]?.id ?? null,
  };
}

export async function readBlastRadius(incidentId: string) {
  return getSql().begin(async tx => {
    const input = await loadInput(tx, incidentId);
    if (!input) return null;
    const graph = buildBlastRadius(input);
    const snapshots = await tx`SELECT metadata_json,created_at FROM audit_events
      WHERE entity_type='incident' AND entity_id=${incidentId} AND event_type='BLAST_RADIUS_COMPUTED'
      ORDER BY created_at,id`;
    return { ...graph, traversalStatus: snapshots.some(row => row.metadata_json.traversalHash === graph.traversalHash) ? 'PERSISTED' : 'LIVE',
      history: snapshots.map(row => ({ phase: row.metadata_json.phase, traversalHash: row.metadata_json.traversalHash,
        computedAt: row.created_at.toISOString(), counts: row.metadata_json.counts, graph: row.metadata_json.graph })) };
  });
}

export async function computeAndPersistBlastRadius(incidentId: string, phase: 'PIPELINE' | 'POST_PROMOTION') {
  return getSql().begin(tx => computeAndPersistBlastRadiusTx(tx, incidentId, phase));
}

export async function computeAndPersistBlastRadiusTx(tx: postgres.TransactionSql, incidentId: string, phase: 'PIPELINE' | 'POST_PROMOTION') {
    const [incident] = await tx`SELECT source_id,candidate_version_id FROM incidents WHERE id=${incidentId}`;
    if (!incident) throw new PipelineStepError('BLAST_RADIUS_FAILED','Incident missing');
    await tx`SELECT id FROM sources WHERE id=${incident.source_id} FOR SHARE`;
    const input = await loadInput(tx, incidentId);
    if (!input || !input.changes.length) throw new PipelineStepError('BLAST_RADIUS_FAILED','Changed record evidence missing');
    const graph = buildBlastRadius(input);
    for (const node of graph.nodes.filter(node => node.id.startsWith('asset:'))) {
      const assetId = node.id.slice('asset:'.length);
      await tx`INSERT INTO incident_asset_impacts (incident_id,asset_id,impact,dependency_path_json,regression_run_ids)
        VALUES (${incidentId},${assetId},${node.impact},${tx.json(node.dependencyPaths as JsonValue)},${tx.json(node.regressionRunIds)})
        ON CONFLICT (incident_id,asset_id) DO UPDATE SET impact=EXCLUDED.impact,
          dependency_path_json=EXCLUDED.dependency_path_json,regression_run_ids=EXCLUDED.regression_run_ids,updated_at=now()`;
    }
    const assetIds = graph.nodes.filter(node => node.id.startsWith('asset:')).map(node => node.id.slice('asset:'.length));
    await tx`DELETE FROM incident_asset_impacts WHERE incident_id=${incidentId} AND asset_id NOT IN ${tx(assetIds.length ? assetIds : [''])}`;
    await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
      VALUES ('BLAST_RADIUS_COMPUTED','incident',${incidentId},'system:blast-radius',
        ${tx.json({ phase, traversalHash: graph.traversalHash, counts: graph.counts, graph } as unknown as JsonValue)},
        ${`blast-radius:${incidentId}:${phase}:${graph.traversalHash}`}) ON CONFLICT DO NOTHING`;
    return graph.traversalHash;
}

export async function runBlastRadius(runId: string, incidentId: string) {
  const sql = getSql();
  const [run] = await sql`SELECT source_version_id,incident_id FROM pipeline_runs WHERE id=${runId}`;
  if (!run || run.incident_id !== incidentId) throw new PipelineStepError('BLAST_RADIUS_FAILED','Run/incident mismatch');
  const steps = await sql`SELECT step,status FROM pipeline_steps WHERE run_id=${runId}
    AND step IN ('INCIDENT','ANALYSIS','REGRESSION_QUESTIONS','REGRESSION_PAIR')`;
  if (steps.some(step => step.status !== 'DONE' && step.status !== 'FAILED'))
    throw new PipelineStepError('BLAST_RADIUS_FAILED','Prerequisite evidence not terminal');
  return computeAndPersistBlastRadius(incidentId, 'PIPELINE');
}

/** Promotion has already committed. Recompute failure is audited and cannot reverse trust. */
export async function recomputeAfterPromotion(incidentId: string) {
  try {
    await computeAndPersistBlastRadius(incidentId, 'POST_PROMOTION');
  } catch (error) {
    try {
      const sql = getSql();
      await sql`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
        VALUES ('BLAST_RADIUS_RECOMPUTE_FAILED','incident',${incidentId},'system:blast-radius',
          ${sql.json({ reason: error instanceof Error ? error.message : 'unknown' })},
          ${`blast-radius-recompute-failed:${incidentId}`}) ON CONFLICT DO NOTHING`;
    } catch { /* Promotion remains committed even if the non-critical audit write fails. */ }
  }
}
