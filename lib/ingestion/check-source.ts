import 'server-only';
import { getSql } from '@/lib/db/client';
import { getConnectorDefinition } from '@/lib/connectors/registry';
import { fetchSourceSnapshot } from '@/lib/connectors/fetch';
import { diffPayloads, type DiffChange } from '@/lib/diff/engine';
import { prepareSourceEvidence } from '@/lib/connectors/evidence';
import { sha256 } from '@/lib/hashing/canonicalize';
import { downloadSnapshot, uploadImmutable } from '@/lib/server/storage';
import { classifyObservation } from './classify';
import { enqueuePipeline } from '@/lib/pipeline/enqueue';
import { needsIncident } from '@/lib/pipeline/model';
import { snapshotPrefix } from './snapshot-path';

export type CheckTrigger = 'MANUAL' | 'WEBHOOK';
export type CheckResult = {
  status: 'NO_CHANGE' | 'NEW_VERSION';
  sourceId: string;
  versionId: string;
  upstreamLabel: string;
  revisionNumber: number;
  rawSha256: string;
  canonicalSha256: string;
  silentMutation: boolean;
  changeClass: 'SERIALIZATION_ONLY' | null;
  changes: DiffChange[];
  runId: string | null;
};

class IntegrityError extends Error {
  constructor(public readonly code: 'SOURCE_FETCH_FAILED' | 'SNAPSHOT_STORAGE_FAILED' | 'DIFF_FAILED') { super(code); }
}

class SandboxGenerationChanged extends Error {
  constructor() { super('SANDBOX_GENERATION_CHANGED'); }
}

export async function checkSource(sourceId: string, trigger: CheckTrigger, origin: string): Promise<CheckResult> {
  const connector = getConnectorDefinition(sourceId);
  if (!connector) throw new IntegrityError('SOURCE_FETCH_FAILED');
  const labelPublished = connector.publishesVersionLabel !== false;
  let rawSha256: string | null = null;
  try {
    const endpoints=await getSql()`SELECT s.endpoint,s.is_demo_fixture,ss.updated_at::text AS sandbox_generation
      FROM sources s LEFT JOIN sandbox_state ss ON ss.source_id=s.id WHERE s.id=${sourceId}`;
    if(!endpoints.length) throw new IntegrityError('SOURCE_FETCH_FAILED');
    const raw = await fetchSourceSnapshot(sourceId,endpoints[0].endpoint,origin);
    const incoming = prepareSourceEvidence(sourceId, raw);
    // The demo fixture must carry synthetic markers everywhere; a real source must never carry them.
    const markedSynthetic = (value: unknown) => (value as { synthetic?: unknown } | undefined)?.synthetic === true;
    if (endpoints[0].is_demo_fixture
      ? !markedSynthetic(incoming.payload.metadata) || incoming.payload.records.some(record => !markedSynthetic(record.metadata))
      : markedSynthetic(incoming.payload.metadata) || incoming.payload.records.some(record => markedSynthetic(record.metadata))) {
      throw new IntegrityError('DIFF_FAILED');
    }
    rawSha256 = incoming.rawSha256;
    return await getSql().begin(async tx => {
      const source = await tx`SELECT id FROM sources WHERE id=${sourceId} FOR UPDATE`;
      if (!source.length) throw new IntegrityError('DIFF_FAILED');
      // A reset can happen after the webhook fetched old fixture bytes. Reject
      // that observation before it creates a new version in the reset generation.
      if (endpoints[0].is_demo_fixture) {
        const [current]=await tx`SELECT updated_at::text AS sandbox_generation FROM sandbox_state WHERE source_id=${sourceId}`;
        if (!current || !endpoints[0].sandbox_generation || current.sandbox_generation!==endpoints[0].sandbox_generation)
          throw new SandboxGenerationChanged();
      }
      let previousRows = await tx`SELECT v.* FROM gateway_bindings g JOIN source_versions v ON v.id=g.latest_seen_version_id WHERE g.source_id=${sourceId} ORDER BY g.updated_at DESC LIMIT 1`;
      if (!previousRows.length) previousRows = await tx`SELECT * FROM source_versions WHERE source_id=${sourceId} ORDER BY detected_at DESC,id DESC LIMIT 1`;
      const previous = previousRows[0];
      const classification = classifyObservation(previous ? {upstreamLabel:previous.upstream_version_label,rawSha256:previous.raw_sha256,canonicalSha256:previous.canonical_sha256} : undefined, {upstreamLabel:incoming.payload.upstreamVersionLabel,rawSha256:incoming.rawSha256,canonicalSha256:incoming.canonicalSha256}, {labelPublished});
      if (classification.status === 'NO_CHANGE') {
        await tx`INSERT INTO source_checks (source_id,trigger_type,status,raw_sha256,source_version_id) VALUES (${sourceId},${trigger},'NO_CHANGE',${incoming.rawSha256},${previous.id})`;
        await tx`UPDATE sources SET last_checked_at=now(),connector_health='HEALTHY' WHERE id=${sourceId}`;
        let runId: string | null = null;
        // A version with no predecessor is a source's initial baseline observation: there is no
        // transition to evaluate, so no pipeline runs (it must never be auto-promoted as "metadata only").
        if (previous.status !== 'TRUSTED' && previous.previous_version_id) {
          const storedChanges = await tx`SELECT id,canonical_key,change_type,field_path,field_role,diff_flags,diff_json FROM changes WHERE to_version_id=${previous.id}`;
          const meaningful = needsIncident(storedChanges.map(row => ({id:row.id,canonicalKey:row.canonical_key,changeType:row.change_type,fieldPath:row.field_path,fieldRole:row.field_role,flags:row.diff_flags,rolesPresent:row.diff_json?.rolesPresent??[]})));
          runId = await enqueuePipeline(tx, previous.id, !meaningful);
        }
        return {status:'NO_CHANGE',sourceId,versionId:previous.id,upstreamLabel:previous.upstream_version_label,revisionNumber:previous.revision_number,rawSha256:incoming.rawSha256,canonicalSha256:previous.canonical_sha256,silentMutation:Boolean(previous.silent_mutation),changeClass:previous.change_class,changes:[],runId} as CheckResult;
      }
      let changes: DiffChange[] = [];
      if (previous) {
        let oldRaw: Buffer, oldCanonical: Buffer;
        try {
          [oldRaw, oldCanonical] = await Promise.all([downloadSnapshot(previous.raw_snapshot_path), downloadSnapshot(previous.canonical_snapshot_path)]);
        } catch { throw new IntegrityError('SNAPSHOT_STORAGE_FAILED'); }
        if (sha256(oldRaw) !== previous.raw_sha256 || sha256(oldCanonical) !== previous.canonical_sha256) throw new IntegrityError('SNAPSHOT_STORAGE_FAILED');
        const priorEvidence = prepareSourceEvidence(sourceId, oldRaw);
        if (priorEvidence.canonicalSha256 !== previous.canonical_sha256) throw new IntegrityError('SNAPSHOT_STORAGE_FAILED');
        changes = diffPayloads(priorEvidence.payload, incoming.payload, connector.fieldRoles);
      }
      const label = incoming.payload.upstreamVersionLabel;
      const revisions = await tx`SELECT COALESCE(MAX(revision_number),0)::int AS max_revision FROM source_versions WHERE source_id=${sourceId} AND upstream_version_label=${label}`;
      const revisionNumber = Number(revisions[0].max_revision) + 1;
      const prefix = snapshotPrefix(sourceId,label,revisionNumber,Boolean(endpoints[0].is_demo_fixture));
      const rawPath = `${prefix}/raw.json`, canonicalPath = `${prefix}/canonical.json`;
      try {
        await uploadImmutable(rawPath, incoming.rawBytes);
        await uploadImmutable(canonicalPath, incoming.canonicalBytes);
      } catch { throw new IntegrityError('SNAPSHOT_STORAGE_FAILED'); }
      const {silentMutation,changeClass} = classification;
      const versionRows = await tx`INSERT INTO source_versions (source_id,previous_version_id,upstream_version_label,revision_number,upstream_published_at,raw_sha256,canonical_sha256,status,silent_mutation,change_class,raw_snapshot_path,canonical_snapshot_path,record_count,detected_at) VALUES (${sourceId},${previous?.id??null},${label},${revisionNumber},${incoming.payload.upstreamPublishedAt??null},${incoming.rawSha256},${incoming.canonicalSha256},'PENDING',${silentMutation},${changeClass},${rawPath},${canonicalPath},${incoming.records.length},clock_timestamp()) RETURNING id`;
      const versionId = versionRows[0].id as string;
      const oldRecords = previous ? await tx`SELECT id,canonical_key FROM records WHERE source_version_id=${previous.id}` : [];
      const oldIds = new Map(oldRecords.map(row => [row.canonical_key as string, row.id as string]));
      const newIds = new Map<string,string>();
      for (const evidence of incoming.records) {
        const record = evidence.record;
        const inserted = await tx`INSERT INTO records (source_version_id,canonical_key,upstream_record_id,content_json,metadata_json,record_hash,field_hashes) VALUES (${versionId},${record.canonical_key},${record.upstream_record_id??null},${tx.json(record.content)},${tx.json(record.metadata)},${evidence.recordHash},${tx.json(evidence.fieldHashes)}) RETURNING id`;
        newIds.set(record.canonical_key, inserted[0].id as string);
      }
      for (const change of changes) {
        const hasOld = !['RECORD_ADDED','FIELD_ADDED','ARRAY_ITEM_ADDED'].includes(change.changeType);
        const hasNew = !['RECORD_DELETED','FIELD_DELETED','ARRAY_ITEM_REMOVED'].includes(change.changeType);
        await tx`INSERT INTO changes (from_version_id,to_version_id,canonical_key,old_record_id,new_record_id,change_type,field_path,field_role,old_value,new_value,old_field_hash,new_field_hash,diff_flags,diff_json) VALUES (${previous?.id??null},${versionId},${change.canonicalKey},${oldIds.get(change.canonicalKey)??null},${newIds.get(change.canonicalKey)??null},${change.changeType},${change.fieldPath},${change.fieldRole},${hasOld ? tx.json(change.oldValue) : null},${hasNew ? tx.json(change.newValue) : null},${change.oldFieldHash},${change.newFieldHash},${tx.json(change.flags)},${tx.json({rolesPresent:change.rolesPresent??[]})})`;
      }
      await tx`UPDATE gateway_bindings SET latest_seen_version_id=${versionId},updated_at=now() WHERE source_id=${sourceId}`;
      await tx`UPDATE sources SET last_checked_at=now(),connector_health='HEALTHY' WHERE id=${sourceId}`;
      await tx`INSERT INTO source_checks (source_id,trigger_type,status,raw_sha256,source_version_id) VALUES (${sourceId},${trigger},'NEW_VERSION',${incoming.rawSha256},${versionId})`;
      await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json) VALUES ('SOURCE_VERSION_DETECTED','source_version',${versionId},'system:integrity',${tx.json({sourceId,previousVersionId:previous?.id??null,rawSha256:incoming.rawSha256,canonicalSha256:incoming.canonicalSha256,silentMutation,changeClass,changeCount:changes.length,baselineObservation:!previous})})`;
      const meaningful = needsIncident(changes.map((change,index) => ({id:String(index),canonicalKey:change.canonicalKey,changeType:change.changeType,fieldPath:change.fieldPath,fieldRole:change.fieldRole,flags:change.flags,rolesPresent:change.rolesPresent??[]})));
      const runId = previous ? await enqueuePipeline(tx, versionId, !meaningful) : null;
      return {status:'NEW_VERSION',sourceId,versionId,upstreamLabel:label,revisionNumber,rawSha256:incoming.rawSha256,canonicalSha256:incoming.canonicalSha256,silentMutation,changeClass,changes,runId};
    });
  } catch (error) {
    if (error instanceof SandboxGenerationChanged) throw error;
    const code = error instanceof IntegrityError ? error.code : error instanceof Error && error.message==='SOURCE_FETCH_FAILED' ? 'SOURCE_FETCH_FAILED' : 'DIFF_FAILED';
    await getSql()`INSERT INTO source_checks (source_id,trigger_type,status,error_code,raw_sha256) VALUES (${sourceId},${trigger},'FAILED',${code},${rawSha256})`;
    await getSql()`UPDATE sources SET last_checked_at=now(),connector_health='DEGRADED' WHERE id=${sourceId}`;
    throw new IntegrityError(code);
  }
}
