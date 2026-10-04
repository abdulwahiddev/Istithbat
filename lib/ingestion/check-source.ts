import 'server-only';
import { getSql } from '@/lib/db/client';
import { getConnectorDefinition } from '@/lib/connectors/registry';
import { SANDBOX_ID } from '@/lib/connectors/sandbox';
import { fetchSourceSnapshot } from '@/lib/connectors/fetch';
import { diffPayloads, type DiffChange } from '@/lib/diff/engine';
import { prepareSnapshot } from '@/lib/hashing/snapshot';
import { sha256 } from '@/lib/hashing/canonicalize';
import { downloadSnapshot, uploadImmutable } from '@/lib/server/storage';
import { classifyObservation } from './classify';

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
};

class IntegrityError extends Error {
  constructor(public readonly code: 'SOURCE_FETCH_FAILED' | 'SNAPSHOT_STORAGE_FAILED' | 'DIFF_FAILED') { super(code); }
}

export async function checkSource(sourceId: string, trigger: CheckTrigger, origin: string): Promise<CheckResult> {
  const connector = getConnectorDefinition(sourceId);
  if (!connector || sourceId !== SANDBOX_ID) throw new IntegrityError('SOURCE_FETCH_FAILED');
  let rawSha256: string | null = null;
  try {
    const endpoints=await getSql()`SELECT endpoint FROM sources WHERE id=${sourceId}`;
    if(!endpoints.length) throw new IntegrityError('SOURCE_FETCH_FAILED');
    const raw = await fetchSourceSnapshot(sourceId,endpoints[0].endpoint,origin);
    const incoming = prepareSnapshot(raw);
    if (incoming.payload.metadata?.synthetic !== true || incoming.payload.records.some(record => record.metadata.synthetic !== true)) {
      throw new IntegrityError('DIFF_FAILED');
    }
    rawSha256 = incoming.rawSha256;
    return await getSql().begin(async tx => {
      const source = await tx`SELECT id FROM sources WHERE id=${sourceId} FOR UPDATE`;
      if (!source.length) throw new IntegrityError('DIFF_FAILED');
      let previousRows = await tx`SELECT v.* FROM gateway_bindings g JOIN source_versions v ON v.id=g.latest_seen_version_id WHERE g.source_id=${sourceId} ORDER BY g.updated_at DESC LIMIT 1`;
      if (!previousRows.length) previousRows = await tx`SELECT * FROM source_versions WHERE source_id=${sourceId} ORDER BY detected_at DESC,id DESC LIMIT 1`;
      const previous = previousRows[0];
      const classification = classifyObservation(previous ? {upstreamLabel:previous.upstream_version_label,rawSha256:previous.raw_sha256,canonicalSha256:previous.canonical_sha256} : undefined, {upstreamLabel:incoming.payload.upstreamVersionLabel,rawSha256:incoming.rawSha256,canonicalSha256:incoming.canonicalSha256});
      if (classification.status === 'NO_CHANGE') {
        await tx`INSERT INTO source_checks (source_id,trigger_type,status,raw_sha256,source_version_id) VALUES (${sourceId},${trigger},'NO_CHANGE',${incoming.rawSha256},${previous.id})`;
        await tx`UPDATE sources SET last_checked_at=now(),connector_health='HEALTHY' WHERE id=${sourceId}`;
        return {status:'NO_CHANGE',sourceId,versionId:previous.id,upstreamLabel:previous.upstream_version_label,revisionNumber:previous.revision_number,rawSha256:incoming.rawSha256,canonicalSha256:previous.canonical_sha256,silentMutation:Boolean(previous.silent_mutation),changeClass:previous.change_class,changes:[]} as CheckResult;
      }
      let changes: DiffChange[] = [];
      if (previous) {
        let oldRaw: Buffer, oldCanonical: Buffer;
        try {
          [oldRaw, oldCanonical] = await Promise.all([downloadSnapshot(previous.raw_snapshot_path), downloadSnapshot(previous.canonical_snapshot_path)]);
        } catch { throw new IntegrityError('SNAPSHOT_STORAGE_FAILED'); }
        if (sha256(oldRaw) !== previous.raw_sha256 || sha256(oldCanonical) !== previous.canonical_sha256) throw new IntegrityError('SNAPSHOT_STORAGE_FAILED');
        const priorEvidence = prepareSnapshot(oldRaw);
        if (priorEvidence.canonicalSha256 !== previous.canonical_sha256) throw new IntegrityError('SNAPSHOT_STORAGE_FAILED');
        changes = diffPayloads(priorEvidence.payload, incoming.payload, connector.fieldRoles);
      }
      const label = incoming.payload.upstreamVersionLabel;
      const revisions = await tx`SELECT COALESCE(MAX(revision_number),0)::int AS max_revision FROM source_versions WHERE source_id=${sourceId} AND upstream_version_label=${label}`;
      const revisionNumber = Number(revisions[0].max_revision) + 1;
      const prefix = `snapshots/${sourceId}/${label}/r${revisionNumber}`;
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
      await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json) VALUES ('SOURCE_VERSION_DETECTED','source_version',${versionId},'system:integrity',${tx.json({sourceId,previousVersionId:previous?.id??null,rawSha256:incoming.rawSha256,canonicalSha256:incoming.canonicalSha256,silentMutation,changeClass,changeCount:changes.length})})`;
      return {status:'NEW_VERSION',sourceId,versionId,upstreamLabel:label,revisionNumber,rawSha256:incoming.rawSha256,canonicalSha256:incoming.canonicalSha256,silentMutation,changeClass,changes};
    });
  } catch (error) {
    const code = error instanceof IntegrityError ? error.code : error instanceof Error && error.message==='SOURCE_FETCH_FAILED' ? 'SOURCE_FETCH_FAILED' : 'DIFF_FAILED';
    await getSql()`INSERT INTO source_checks (source_id,trigger_type,status,error_code,raw_sha256) VALUES (${sourceId},${trigger},'FAILED',${code},${rawSha256})`;
    await getSql()`UPDATE sources SET last_checked_at=now(),connector_health='DEGRADED' WHERE id=${sourceId}`;
    throw new IntegrityError(code);
  }
}
