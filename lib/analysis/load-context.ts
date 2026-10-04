import 'server-only';
import { getSql } from '@/lib/db/client';
import type { JsonValue } from '@/lib/hashing/canonicalize';
import { makeContextPacket, type ContextPacket } from './context';

export async function loadContextPacket(versionId: string, primaryChangeId: string): Promise<ContextPacket> {
  const sql = getSql();
  const versionRows = await sql`SELECT v.*, s.name AS source_name, s.provider, s.source_type, s.content_level, s.is_demo_fixture
    FROM source_versions v JOIN sources s ON s.id=v.source_id WHERE v.id=${versionId}`;
  if (!versionRows.length) throw new Error('DIFF_FAILED');
  const version = versionRows[0];
  const [priorRows, trustedRows, changeRows] = await Promise.all([
    version.previous_version_id ? sql`SELECT * FROM source_versions WHERE id=${version.previous_version_id}` : Promise.resolve([]),
    sql`SELECT id,upstream_version_label,revision_number FROM source_versions WHERE source_id=${version.source_id} AND status='TRUSTED' LIMIT 1`,
    sql`SELECT * FROM changes WHERE to_version_id=${versionId} ORDER BY canonical_key,field_path NULLS FIRST,id`,
  ]);
  if (!changeRows.some(row => row.id === primaryChangeId)) throw new Error('DIFF_FAILED');
  const prior = priorRows[0];
  const changedKeys = new Set(changeRows.map(row => row.canonical_key as string));
  const [oldRecords, newRecords] = await Promise.all([
    prior ? sql`SELECT canonical_key,content_json,metadata_json FROM records WHERE source_version_id=${prior.id}` : Promise.resolve([]),
    sql`SELECT canonical_key,content_json,metadata_json FROM records WHERE source_version_id=${versionId}`,
  ]);
  const oldMap = new Map(oldRecords.map(row => [row.canonical_key as string, row]));
  const newMap = new Map(newRecords.map(row => [row.canonical_key as string, row]));
  const orderedChanges=[...changeRows].sort((a,b)=>{
    const compare=(x:string,y:string)=>x<y?-1:x>y?1:0;
    return compare(a.canonical_key,b.canonical_key)||compare(a.field_path??'',b.field_path??'')||compare(a.id,b.id);
  });
  const packet = makeContextPacket({
    source:{id:version.source_id,name:version.source_name,provider:version.provider,source_type:version.source_type,content_level:version.content_level,synthetic:version.is_demo_fixture},
    candidate:{id:version.id,label:version.upstream_version_label,revision:version.revision_number,upstream_published_at:version.upstream_published_at?.toISOString()??null,raw_sha256:version.raw_sha256,canonical_sha256:version.canonical_sha256,silent_mutation:version.silent_mutation},
    previous:prior ? {id:prior.id,label:prior.upstream_version_label,revision:prior.revision_number,upstream_published_at:prior.upstream_published_at?.toISOString()??null,raw_sha256:prior.raw_sha256,canonical_sha256:prior.canonical_sha256} : null,
    trusted:trustedRows[0] ? {id:trustedRows[0].id,label:trustedRows[0].upstream_version_label,revision:trustedRows[0].revision_number} : null,
    primary_change_id:primaryChangeId,
    changes:orderedChanges.map(row => ({
      id:row.id,canonical_key:row.canonical_key,change_type:row.change_type,field_path:row.field_path,field_role:row.field_role,
      old_value:row.old_value as JsonValue|null,new_value:row.new_value as JsonValue|null,
      old_field_hash:row.old_field_hash,new_field_hash:row.new_field_hash,
      flags:row.diff_flags as string[],roles_present:row.diff_json?.rolesPresent??[],
    })),
    records:[...changedKeys].sort().filter(key => key !== '__source__').map(key => ({
      canonical_key:key,
      old_content:(oldMap.get(key)?.content_json??null) as JsonValue|null,
      new_content:(newMap.get(key)?.content_json??null) as JsonValue|null,
      old_metadata:(oldMap.get(key)?.metadata_json??null) as JsonValue|null,
      new_metadata:(newMap.get(key)?.metadata_json??null) as JsonValue|null,
    })),
  });
  return packet;
}
