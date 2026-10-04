import 'server-only';
import { getSql } from '@/lib/db/client';
import { SourceDetail, SourceSummary, type SourceSummary as SourceSummaryType } from '@/lib/contracts';
import { getConnectorDefinition } from '@/lib/connectors/registry';

export async function listSources(): Promise<SourceSummaryType[]> {
  const rows = await getSql()`SELECT s.*,COALESCE(seen_binding.upstream_version_label,seen_fallback.upstream_version_label) AS latest_seen_label,trusted.upstream_version_label AS trusted_label,served.upstream_version_label AS served_label
    FROM sources s
    LEFT JOIN LATERAL (SELECT v.upstream_version_label FROM gateway_bindings g JOIN source_versions v ON v.id=g.latest_seen_version_id WHERE g.source_id=s.id ORDER BY g.updated_at DESC LIMIT 1) seen_binding ON true
    LEFT JOIN LATERAL (SELECT v.upstream_version_label FROM source_versions v WHERE v.source_id=s.id ORDER BY v.detected_at DESC,v.id DESC LIMIT 1) seen_fallback ON true
    LEFT JOIN LATERAL (SELECT v.upstream_version_label FROM source_versions v WHERE v.source_id=s.id AND v.status='TRUSTED' LIMIT 1) trusted ON true
    LEFT JOIN LATERAL (SELECT v.upstream_version_label FROM gateway_bindings g JOIN source_versions v ON v.id=g.served_version_id WHERE g.source_id=s.id ORDER BY g.updated_at DESC LIMIT 1) served ON true
    ORDER BY s.id`;
  return rows.map(row => SourceSummary.parse({
    id:row.id,name:row.name,provider:row.provider,sourceType:row.source_type,connectorHealth:row.connector_health,
    isDemoFixture:row.is_demo_fixture,contentLevel:row.content_level,latestSeenLabel:row.latest_seen_label,
    trustedLabel:row.trusted_label,servedLabel:row.served_label,lastCheckedAt:row.last_checked_at?.toISOString()??null,
    connectorType:row.connector_type,rightsNote:row.rights_note??null,
    versionLabelPublished:getConnectorDefinition(row.id)?.publishesVersionLabel??true,
  }));
}

export async function getSourceDetail(sourceId: string) {
  const source = (await listSources()).find(item => item.id === sourceId);
  if (!source) return null;
  const sql = getSql();
  const [sourceRows,versions,changes,checks,policyRows,incidentRows] = await Promise.all([
    sql`SELECT field_roles_json FROM sources WHERE id=${sourceId}`,
    sql`SELECT * FROM source_versions WHERE source_id=${sourceId} ORDER BY detected_at ASC,id ASC`,
    sql`SELECT c.* FROM changes c JOIN source_versions v ON v.id=c.to_version_id WHERE v.source_id=${sourceId} ORDER BY v.detected_at ASC,c.field_path ASC NULLS FIRST,c.id ASC`,
    sql`SELECT * FROM source_checks WHERE source_id=${sourceId} ORDER BY checked_at DESC,id DESC LIMIT 25`,
    sql`SELECT e.source_version_id,e.policy_code,e.action,e.deterministic_facts_json,e.evaluated_at FROM policy_evaluations e
      JOIN source_versions v ON v.id=e.source_version_id WHERE v.source_id=${sourceId} AND e.is_effective=true`,
    sql`SELECT i.candidate_version_id,i.status,r.status AS pipeline_status FROM incidents i
      LEFT JOIN pipeline_runs r ON r.source_version_id=i.candidate_version_id WHERE i.source_id=${sourceId}`,
  ]);
  const policyByVersion=new Map(policyRows.map(row=>[row.source_version_id as string,row]));
  const incidentByVersion=new Map(incidentRows.map(row=>[row.candidate_version_id as string,row]));
  return SourceDetail.parse({
    source,fieldRoles:sourceRows[0].field_roles_json,
    versions:versions.map(row => ({
      id:row.id,previousVersionId:row.previous_version_id,upstreamLabel:row.upstream_version_label,
      revisionNumber:row.revision_number,upstreamPublishedAt:row.upstream_published_at?.toISOString()??null,
      status:row.status,rawSha256:row.raw_sha256,canonicalSha256:row.canonical_sha256,
      silentMutation:row.silent_mutation,changeClass:row.change_class,
      rawSnapshotPath:row.raw_snapshot_path,canonicalSnapshotPath:row.canonical_snapshot_path,
      recordCount:row.record_count,detectedAt:row.detected_at.toISOString(),
      heldForReview:row.status==='ANALYZING' && incidentByVersion.get(row.id)?.status==='NEEDS_REVIEW'
        && incidentByVersion.get(row.id)?.pipeline_status==='COMPLETE' && policyByVersion.get(row.id)?.action==='REVIEW',
      autoPromotion:policyByVersion.get(row.id)?.policy_code==='POL-005' && policyByVersion.get(row.id)?.action==='ALLOW'
        ? {policyCode:'POL-005',equivalence:policyByVersion.get(row.id)?.deterministic_facts_json?.equivalenceReason ?? 'metadata only',promotedAt:policyByVersion.get(row.id)!.evaluated_at.toISOString()} : null,
    })),
    changes:changes.map(row => ({
      id:row.id,canonicalKey:row.canonical_key,changeType:row.change_type,fieldPath:row.field_path,
      fieldRole:row.field_role,oldValue:row.old_value,newValue:row.new_value,flags:row.diff_flags,
      fromVersionId:row.from_version_id,toVersionId:row.to_version_id,
      oldFieldHash:row.old_field_hash,newFieldHash:row.new_field_hash,
      rolesPresent:row.diff_json?.rolesPresent??[],
    })),
    checks:checks.map(row => ({id:row.id,triggerType:row.trigger_type,status:row.status,errorCode:row.error_code,
      rawSha256:row.raw_sha256,sourceVersionId:row.source_version_id,checkedAt:row.checked_at.toISOString()})),
  });
}
