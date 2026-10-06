import { isSourceDerived } from '@/lib/contracts/sandbox-scenario';
import { hashJson, type JsonValue } from '@/lib/hashing/canonicalize';

export type ContextElementKind =
  | 'AUTHORITATIVE_TEXT' | 'SCHOLAR_JUDGMENT' | 'PROVENANCE' | 'TRANSLATION'
  | 'COMMENTARY' | 'SURROUNDING_CONTEXT' | 'OPERATIONAL_METADATA' | 'SYNTHETIC_MUTATION';

export type ContextElement = { kind: ContextElementKind; canonical_key: string | null; field_path: string | null; value: JsonValue };
export type ContextPacket = {
  source: { id: string; name: string; provider: string; source_type: string; content_level: string; synthetic: boolean };
  candidate: { id: string; label: string; revision: number; upstream_published_at: string|null; raw_sha256: string; canonical_sha256: string; silent_mutation: boolean };
  previous: { id: string; label: string; revision: number; upstream_published_at: string|null; raw_sha256: string; canonical_sha256: string } | null;
  trusted: { id: string; label: string; revision: number } | null;
  primary_change_id: string;
  changes: Array<{
    id: string; canonical_key: string; change_type: string; field_path: string | null; field_role: string;
    old_value: JsonValue | null; new_value: JsonValue | null; old_field_hash: string | null; new_field_hash: string | null;
    flags: string[]; roles_present: string[];
  }>;
  records: Array<{ canonical_key: string; old_content: JsonValue | null; new_content: JsonValue | null; old_metadata: JsonValue | null; new_metadata: JsonValue | null }>;
  elements: ContextElement[];
};

export function contextPacketHash(packet: ContextPacket): string {
  return hashJson(packet as unknown as JsonValue);
}

export function makeContextPacket(input: Omit<ContextPacket, 'elements'>): ContextPacket {
  const elements: ContextElement[] = [];
  if (input.source.synthetic) elements.push({kind:'SYNTHETIC_MUTATION',canonical_key:null,field_path:null,value:input.records.some(r=>isSourceDerived(r.old_metadata as Record<string,unknown>)||isSourceDerived(r.new_metadata as Record<string,unknown>)) ? 'Original record preserved from HadeethEnc; only the candidate grading mutation is an Istithbat-created controlled test. Sandbox version labels are not HadeethEnc publications. No source text was modified.' : 'Controlled synthetic source; not a real hadith or provider mutation.'});
  for (const change of input.changes) {
    const kind: ContextElementKind = change.field_role === 'UNCLASSIFIED' ? 'SURROUNDING_CONTEXT' : change.field_role as ContextElementKind;
    elements.push({kind,canonical_key:change.canonical_key,field_path:change.field_path,value:{old:change.old_value,new:change.new_value,change_type:change.change_type,flags:change.flags}});
  }
  for (const record of input.records) {
    elements.push({kind:'SURROUNDING_CONTEXT',canonical_key:record.canonical_key,field_path:null,value:{old_content:record.old_content,new_content:record.new_content,old_metadata:record.old_metadata,new_metadata:record.new_metadata}});
  }
  return {...input,elements};
}
