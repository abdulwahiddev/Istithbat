import 'server-only';
import { getSql } from '@/lib/db/client';
export type ResolveRequest={sourceId:string;canonicalKey:string;appId:string;requestedVersion?:string};
export async function resolveTrustedRecord(input:ResolveRequest) {
  const rows=input.requestedVersion ? await getSql()`SELECT r.canonical_key,r.content_json,r.metadata_json,v.id AS version_id,v.upstream_version_label,v.revision_number,s.is_demo_fixture FROM gateway_bindings g JOIN source_versions v ON v.id=g.served_version_id JOIN records r ON r.source_version_id=v.id JOIN sources s ON s.id=v.source_id WHERE g.source_id=${input.sourceId} AND g.protected_app_id=${input.appId} AND r.canonical_key=${input.canonicalKey} AND v.status='TRUSTED' AND v.upstream_version_label=${input.requestedVersion} LIMIT 1` : await getSql()`SELECT r.canonical_key,r.content_json,r.metadata_json,v.id AS version_id,v.upstream_version_label,v.revision_number,s.is_demo_fixture FROM gateway_bindings g JOIN source_versions v ON v.id=g.served_version_id JOIN records r ON r.source_version_id=v.id JOIN sources s ON s.id=v.source_id WHERE g.source_id=${input.sourceId} AND g.protected_app_id=${input.appId} AND r.canonical_key=${input.canonicalKey} AND v.status='TRUSTED' LIMIT 1`;
  return rows[0]??null;
}
export async function resolveVersionRecord(sourceId:string,canonicalKey:string,versionId:string) {
  const rows=await getSql()`SELECT r.canonical_key,r.content_json,r.metadata_json,v.id AS version_id,v.upstream_version_label,v.revision_number,s.is_demo_fixture FROM source_versions v JOIN records r ON r.source_version_id=v.id JOIN sources s ON s.id=v.source_id WHERE v.source_id=${sourceId} AND v.id=${versionId} AND r.canonical_key=${canonicalKey} LIMIT 1`;
  return rows[0]??null;
}
