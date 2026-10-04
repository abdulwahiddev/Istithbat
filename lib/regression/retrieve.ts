import 'server-only';
import { getSql } from '@/lib/db/client';
import { hashJson, type JsonValue } from '@/lib/hashing/canonicalize';

export const LEXICAL_CONFIG = {
  strategy: 'lexical-v1' as const,
  k: 3,
  fields: ['arabic_text','translation','judgment','scholar','reference'],
};
export const PINNED_CONFIG = {
  strategy: 'pinned-record-v1' as const,
  k: 1,
  fields: LEXICAL_CONFIG.fields,
};
export type RetrievalConfig = typeof LEXICAL_CONFIG | typeof PINNED_CONFIG;
export type RetrievedRecord = {
  source_id:string; source_version_id:string; canonical_key:string; record_hash:string;
  content:Record<string,JsonValue>; metadata:Record<string,JsonValue>;
};

function tokens(text:string):string[] {
  return text.toLowerCase().replace(/[\u064b-\u0652\u0670\u0640]/g,'').replace(/[إأآٱ]/g,'ا')
    .match(/[\p{L}\p{N}]+/gu)??[];
}

function fieldText(content:Record<string,JsonValue>):string {
  return LEXICAL_CONFIG.fields.map(field=>JSON.stringify(content[field]??'')).join(' ');
}

export async function retrieve(versionId:string, question:string, config:typeof LEXICAL_CONFIG=LEXICAL_CONFIG):Promise<RetrievedRecord[]> {
  const rows=await getSql()`SELECT v.source_id,r.source_version_id,r.canonical_key,r.record_hash,r.content_json,r.metadata_json
    FROM records r JOIN source_versions v ON v.id=r.source_version_id WHERE r.source_version_id=${versionId}`;
  const records=rows.map(row=>({source_id:row.source_id,source_version_id:row.source_version_id,
    canonical_key:row.canonical_key,record_hash:row.record_hash,content:row.content_json,metadata:row.metadata_json} as RetrievedRecord));
  return rankRecords(records,question,config);
}

export function rankRecords(records:readonly RetrievedRecord[],question:string,config:typeof LEXICAL_CONFIG=LEXICAL_CONFIG):RetrievedRecord[] {
  const query=new Set(tokens(question));
  return records.map(record=>{
    const terms=new Set(tokens(fieldText(record.content)));
    const score=[...query].filter(term=>terms.has(term)).length+(question.trim()===record.canonical_key?10:0);
    return {record,score};
  }).filter(entry=>entry.score>0).sort((a,b)=>b.score-a.score||a.record.canonical_key.localeCompare(b.record.canonical_key))
    .slice(0,config.k).map(entry=>entry.record);
}

/** Pinned configuration supplies identity; question text is never inspected. */
export async function resolvePinnedRecord(sourceId:string,canonicalKey:string,versionId:string):Promise<RetrievedRecord|null> {
  const rows=await getSql()`SELECT v.source_id,r.source_version_id,r.canonical_key,r.record_hash,r.content_json,r.metadata_json
    FROM records r JOIN source_versions v ON v.id=r.source_version_id
    WHERE v.source_id=${sourceId} AND v.id=${versionId} AND r.canonical_key=${canonicalKey} LIMIT 1`;
  const row=rows[0];
  return row?{source_id:row.source_id,source_version_id:row.source_version_id,canonical_key:row.canonical_key,
    record_hash:row.record_hash,content:row.content_json,metadata:row.metadata_json}:null;
}

export function retrievalEvidence(records:readonly RetrievedRecord[],config:RetrievalConfig) {
  return {config,records:records.map(record=>({source_id:record.source_id,source_version_id:record.source_version_id,
    canonical_key:record.canonical_key,record_hash:record.record_hash,content:record.content,metadata:record.metadata,
    context_hash:hashJson({content:record.content,metadata:record.metadata} as JsonValue)}))};
}
