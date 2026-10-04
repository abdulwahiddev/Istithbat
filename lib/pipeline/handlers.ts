import 'server-only';
import { getSql } from '@/lib/db/client';
import { hashJson, type JsonValue } from '@/lib/hashing/canonicalize';
import { loadContextPacket } from '@/lib/analysis/load-context';
import { contextPacketHash, type ContextPacket } from '@/lib/analysis/context';
import { analyze } from '@/lib/analysis/analyze';
import { primaryChange, type EvidenceChange } from './model';

export class PipelineStepError extends Error {
  constructor(public readonly code: string, public readonly reason: string, public readonly meta: Record<string,unknown> | null = null) { super(code); }
}

export async function ensureIncident(runId: string, versionId: string): Promise<string> {
  const sql = getSql();
  const existing = await sql`SELECT id FROM incidents WHERE candidate_version_id=${versionId}`;
  if (existing.length) return existing[0].id as string;
  const rows = await sql`SELECT c.id,c.canonical_key,c.change_type,c.field_path,c.field_role,c.diff_flags,c.diff_json
    FROM changes c WHERE c.to_version_id=${versionId}`;
  const changes: EvidenceChange[] = rows.map(row => ({id:row.id,canonicalKey:row.canonical_key,changeType:row.change_type,fieldPath:row.field_path,fieldRole:row.field_role,flags:row.diff_flags,rolesPresent:row.diff_json?.rolesPresent??[]}));
  const primary = primaryChange(changes);
  if (!primary) throw new PipelineStepError('DIFF_FAILED','Incident step received an equivalent-only version');
  const packet = await loadContextPacket(versionId, primary.id);
  const packetHash = contextPacketHash(packet);
  return sql.begin(async tx => {
    const title = `Source change: ${packet.source.name} — ${packet.candidate.label} r${packet.candidate.revision}`;
    const inserted = await tx`INSERT INTO incidents (source_id,previous_version_id,candidate_version_id,primary_change_id,status,title,context_packet_json,context_packet_hash)
      VALUES (${packet.source.id},${packet.previous?.id??null},${versionId},${primary.id},'ANALYZING',${title},${tx.json(packet)},${packetHash})
      ON CONFLICT (candidate_version_id) DO NOTHING RETURNING id`;
    const incidentId = inserted[0]?.id as string | undefined
      ?? (await tx`SELECT id FROM incidents WHERE candidate_version_id=${versionId}`)[0].id as string;
    await tx`UPDATE pipeline_runs SET incident_id=${incidentId},updated_at=now() WHERE id=${runId} AND incident_id IS DISTINCT FROM ${incidentId}`;
    if (inserted.length) {
      await tx`UPDATE source_versions SET status='ANALYZING' WHERE id=${versionId} AND status='PENDING'`;
      await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
        VALUES ('INCIDENT_CREATED','incident',${incidentId},'system:pipeline',${tx.json({versionId,previousVersionId:packet.previous?.id??null,primaryChangeId:primary.id,silentMutation:packet.candidate.silent_mutation})},${`incident-created:${incidentId}`}) ON CONFLICT DO NOTHING`;
      await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
        VALUES ('CONTEXT_PACKET_ATTACHED','incident',${incidentId},'system:pipeline',${tx.json({contextPacketHash:packetHash,changeCount:packet.changes.length})},${`context-attached:${incidentId}`}) ON CONFLICT DO NOTHING`;
      await tx`UPDATE incidents SET status='NEEDS_REVIEW' WHERE id=${incidentId} AND status='ANALYZING'`;
    }
    return incidentId;
  });
}

export async function runAnalysis(incidentId: string): Promise<string> {
  const sql = getSql();
  const incidents = await sql`SELECT id,primary_change_id,context_packet_json,context_packet_hash FROM incidents WHERE id=${incidentId}`;
  if (!incidents.length || !incidents[0].context_packet_json || !incidents[0].context_packet_hash) throw new PipelineStepError('DIFF_FAILED','Incident context missing');
  const incident = incidents[0];
  const prior = await sql`SELECT id FROM analyses WHERE incident_id=${incidentId} AND context_packet_hash=${incident.context_packet_hash} ORDER BY created_at LIMIT 1`;
  if (prior.length) return prior[0].id as string;
  const packet = incident.context_packet_json as ContextPacket;
  const result = await analyze(packet);
  if (!result.ok) throw new PipelineStepError(result.errorCode,result.reason,result.meta as unknown as Record<string,unknown>);
  const {data,meta} = result;
  const identityHash = hashJson({incidentId,analysisType:data.analysis_type,contextPacketHash:incident.context_packet_hash,promptId:meta.promptId,promptVersion:meta.promptVersion,provider:meta.provider,model:meta.model,mode:meta.mode,temperature:meta.temperature,maxTokens:meta.maxTokens,effort:meta.effort} as JsonValue);
  return sql.begin(async tx => {
    const inserted = await tx`INSERT INTO analyses (incident_id,change_id,analysis_type,risk_level,output_json,context_packet_hash,provider,model,prompt_version,meta_json,identity_hash)
      VALUES (${incidentId},${incident.primary_change_id},${data.analysis_type},${data.risk_level},${tx.json(data)},${incident.context_packet_hash},${meta.provider},${meta.model},${meta.promptVersion},${tx.json(meta as unknown as JsonValue)},${identityHash})
      ON CONFLICT DO NOTHING RETURNING id`;
    const analysisId = inserted[0]?.id as string | undefined
      ?? (await tx`SELECT id FROM analyses WHERE identity_hash=${identityHash}`)[0].id as string;
    if (inserted.length) {
      await tx`UPDATE incidents SET risk_level=${data.risk_level},summary=${data.executive_summary} WHERE id=${incidentId} AND status IN ('ANALYZING','NEEDS_REVIEW')`;
      await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
        VALUES ('ANALYSIS_SUCCEEDED','incident',${incidentId},'system:pipeline',${tx.json({analysisId,contextPacketHash:incident.context_packet_hash,provider:meta.provider,model:meta.model,promptVersion:meta.promptVersion,mode:meta.mode,recordedAt:meta.recordedAt})},${`analysis-succeeded:${analysisId}`}) ON CONFLICT DO NOTHING`;
    }
    return analysisId;
  });
}
