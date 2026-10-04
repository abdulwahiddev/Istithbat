import 'server-only';
import { getSql } from '@/lib/db/client';
import { getConnectorDefinition } from '@/lib/connectors/registry';
import { prepareSnapshot } from '@/lib/hashing/snapshot';
import { sha256 } from '@/lib/hashing/canonicalize';
import { diffPayloads } from '@/lib/diff/engine';
import { downloadSnapshot } from '@/lib/server/storage';

export async function verifyStoredEvidence(sourceId:string, versionId:string) {
  const sql=getSql();
  const connector=getConnectorDefinition(sourceId);
  if(!connector) return null;
  const versions=await sql`SELECT * FROM source_versions WHERE id=${versionId} AND source_id=${sourceId}`;
  if(!versions.length) return null;
  const version=versions[0];
  const [rawBytes,canonicalBytes]=await Promise.all([downloadSnapshot(version.raw_snapshot_path),downloadSnapshot(version.canonical_snapshot_path)]);
  const evidence=prepareSnapshot(rawBytes);
  const rawMatch=sha256(rawBytes)===version.raw_sha256;
  const canonicalMatch=sha256(canonicalBytes)===version.canonical_sha256 && evidence.canonicalSha256===version.canonical_sha256 && canonicalBytes.equals(evidence.canonicalBytes);
  const records=await sql`SELECT canonical_key,record_hash,field_hashes FROM records WHERE source_version_id=${versionId}`;
  const recordMap=new Map(records.map(row=>[row.canonical_key as string,row]));
  const recordMatches=recordMap.size===evidence.records.length && evidence.records.every(item=>{
    const stored=recordMap.get(item.record.canonical_key);
    return stored?.record_hash===item.recordHash && Object.entries(stored.field_hashes as Record<string,string>).every(([path,hash])=>item.fieldHashes[path]===hash);
  });
  let changeMatches=true;
  let changeCount=0;
  if(version.previous_version_id) {
    const older=await sql`SELECT raw_snapshot_path FROM source_versions WHERE id=${version.previous_version_id}`;
    if(!older.length) changeMatches=false;
    else {
      const oldEvidence=prepareSnapshot(await downloadSnapshot(older[0].raw_snapshot_path));
      const expected=diffPayloads(oldEvidence.payload,evidence.payload,connector.fieldRoles);
      const persisted=await sql`SELECT canonical_key,change_type,field_path,field_role,old_field_hash,new_field_hash,diff_flags FROM changes WHERE to_version_id=${versionId}`;
      changeCount=persisted.length;
      const signature=(item:any)=>JSON.stringify([item.canonical_key??item.canonicalKey,item.change_type??item.changeType,item.field_path??item.fieldPath,item.field_role??item.fieldRole,item.old_field_hash??item.oldFieldHash,item.new_field_hash??item.newFieldHash,item.diff_flags??item.flags]);
      changeMatches=JSON.stringify(persisted.map(signature).sort())===JSON.stringify(expected.map(signature).sort());
    }
  }
  return {sourceId,versionId,rawMatch,canonicalMatch,recordMatches,changeMatches,recordCount:records.length,changeCount,valid:rawMatch&&canonicalMatch&&recordMatches&&changeMatches};
}
