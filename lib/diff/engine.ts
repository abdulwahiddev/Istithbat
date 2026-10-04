import type { ConnectorDefinition } from '@/lib/contracts';
import type { JsonValue } from '@/lib/hashing/canonicalize';
import { canonicalJson, hashJson } from '@/lib/hashing/canonicalize';
import { flagsForStrings, type DiffFlagValue } from './flags';

export type ChangeType =
  | 'RECORD_ADDED' | 'RECORD_DELETED' | 'FIELD_ADDED' | 'FIELD_DELETED'
  | 'FIELD_MODIFIED' | 'TYPE_CHANGED' | 'ARRAY_ITEM_ADDED'
  | 'ARRAY_ITEM_REMOVED' | 'ARRAY_REORDERED';
export type FieldRoleValue = ConnectorDefinition['fieldRoles'][string];
export type DiffChange = {
  canonicalKey: string;
  changeType: ChangeType;
  fieldPath: string | null;
  fieldRole: FieldRoleValue;
  oldValue: JsonValue | null;
  newValue: JsonValue | null;
  oldFieldHash: string | null;
  newFieldHash: string | null;
  flags: DiffFlagValue[];
  rolesPresent?: FieldRoleValue[];
};
export type DiffRecord = { canonical_key: string; upstream_record_id?: string; content: Record<string, JsonValue>; metadata: Record<string, JsonValue>; [key:string]: JsonValue|undefined };
export type DiffPayload = { records: DiffRecord[]; metadata?: Record<string, JsonValue>; upstreamVersionLabel?: string; upstreamPublishedAt?: string; [key:string]: JsonValue|DiffRecord[]|undefined };

function roleForPath(path: string, roles: ConnectorDefinition['fieldRoles']): FieldRoleValue {
  if (roles[path]) return roles[path];
  if (roles[`${path}[]`]) return roles[`${path}[]`];
  const arrayPath = path.replace(/\[\d+\]/gu, '[]');
  if (roles[arrayPath]) return roles[arrayPath];
  const arrayRoot = arrayPath.slice(0, arrayPath.indexOf('[]') + 2);
  if (arrayPath.includes('[]') && roles[arrayRoot]) return roles[arrayRoot];
  const root = path.split('.')[0];
  if (roles[root] && !Object.keys(roles).some(key => key.startsWith(`${root}.`))) return roles[root];
  return 'UNCLASSIFIED';
}

function typeOf(value: JsonValue): string {
  return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
}

function rolesInRecord(content: Record<string, JsonValue>, roles: ConnectorDefinition['fieldRoles']): FieldRoleValue[] {
  const found = new Set<FieldRoleValue>();
  function visit(value: JsonValue, path: string) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [field, child] of Object.entries(value)) visit(child, `${path}.${field}`);
    } else if (Array.isArray(value)) {
      for (const child of value) visit(child, `${path}[]`);
    } else found.add(roleForPath(path, roles));
  }
  for (const [field, value] of Object.entries(content)) visit(value, field);
  return [...found].sort();
}

export function diffPayloads(previous: DiffPayload, next: DiffPayload, roles: ConnectorDefinition['fieldRoles']): DiffChange[] {
  const changes: DiffChange[] = [];
  const before = new Map(previous.records.map(record => [record.canonical_key, record]));
  const after = new Map(next.records.map(record => [record.canonical_key, record]));
  if (before.size !== previous.records.length || after.size !== next.records.length) throw new Error('DUPLICATE_CANONICAL_KEY');

  function emit(key: string, changeType: ChangeType, path: string | null, oldValue: JsonValue | null, newValue: JsonValue | null, extra?: Pick<DiffChange, 'rolesPresent'>) {
    const flags = changeType === 'FIELD_MODIFIED' && typeof oldValue === 'string' && typeof newValue === 'string'
      ? flagsForStrings(oldValue, newValue)
      : [];
    const hasOld = !['RECORD_ADDED', 'FIELD_ADDED', 'ARRAY_ITEM_ADDED'].includes(changeType);
    const hasNew = !['RECORD_DELETED', 'FIELD_DELETED', 'ARRAY_ITEM_REMOVED'].includes(changeType);
    changes.push({canonicalKey:key,changeType,fieldPath:path,fieldRole:path ? roleForPath(path, roles) : 'UNCLASSIFIED',oldValue,newValue,oldFieldHash:hasOld ? hashJson(oldValue) : null,newFieldHash:hasNew ? hashJson(newValue) : null,flags,...extra});
  }

  function compare(key: string, path: string, left: JsonValue | undefined, right: JsonValue | undefined) {
    if (left === undefined) { emit(key, 'FIELD_ADDED', path, null, right ?? null); return; }
    if (right === undefined) { emit(key, 'FIELD_DELETED', path, left, null); return; }
    if (canonicalJson(left) === canonicalJson(right)) return;
    if (typeOf(left) !== typeOf(right)) { emit(key, 'TYPE_CHANGED', path, left, right); return; }
    if (Array.isArray(left) && Array.isArray(right)) {
      const oldItems = left.map(canonicalJson).sort();
      const newItems = right.map(canonicalJson).sort();
      if (left.length === right.length && oldItems.every((item, index) => item === newItems[index])) {
        emit(key, 'ARRAY_REORDERED', `${path}[]`, left, right); return;
      }
      for (let index = 0; index < Math.max(left.length, right.length); index++) {
        if (index >= left.length) emit(key, 'ARRAY_ITEM_ADDED', `${path}[${index}]`, null, right[index]);
        else if (index >= right.length) emit(key, 'ARRAY_ITEM_REMOVED', `${path}[${index}]`, left[index], null);
        else compare(key, `${path}[${index}]`, left[index], right[index]);
      }
      return;
    }
    if (left && right && typeof left === 'object' && typeof right === 'object') {
      const a = left as Record<string, JsonValue>, b = right as Record<string, JsonValue>;
      for (const field of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) compare(key, `${path}.${field}`, a[field], b[field]);
      return;
    }
    emit(key, 'FIELD_MODIFIED', path, left, right);
  }

  for (const key of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const oldRecord = before.get(key), newRecord = after.get(key);
    if (!oldRecord) {
      emit(key, 'RECORD_ADDED', null, null, newRecord!.content, {rolesPresent:rolesInRecord(newRecord!.content, roles)});
    } else if (!newRecord) {
      emit(key, 'RECORD_DELETED', null, oldRecord.content, null, {rolesPresent:rolesInRecord(oldRecord.content, roles)});
    } else if (oldRecord.upstream_record_id !== newRecord.upstream_record_id) {
      emit(key, 'RECORD_DELETED', null, oldRecord.content, null, {rolesPresent:rolesInRecord(oldRecord.content, roles)});
      emit(key, 'RECORD_ADDED', null, null, newRecord.content, {rolesPresent:rolesInRecord(newRecord.content, roles)});
    } else {
      for (const field of [...new Set([...Object.keys(oldRecord.content), ...Object.keys(newRecord.content)])].sort()) {
        compare(key, field, oldRecord.content[field], newRecord.content[field]);
      }
      for (const field of [...new Set([...Object.keys(oldRecord.metadata), ...Object.keys(newRecord.metadata)])].sort()) {
        compare(key, `record_metadata.${field}`, oldRecord.metadata[field], newRecord.metadata[field]);
      }
      for (const field of [...new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)])].sort()) {
        if (!['canonical_key','upstream_record_id','content','metadata'].includes(field)) {
          compare(key, `record.${field}`, oldRecord[field], newRecord[field]);
        }
      }
    }
  }
  const oldMeta = previous.metadata ?? {}, newMeta = next.metadata ?? {};
  for (const field of [...new Set([...Object.keys(oldMeta), ...Object.keys(newMeta)])].sort()) {
    compare('__source__', `metadata.${field}`, oldMeta[field], newMeta[field]);
  }
  for (const field of [...new Set([...Object.keys(previous), ...Object.keys(next)])].sort()) {
    if (!['records','metadata','upstreamVersionLabel','upstreamPublishedAt'].includes(field)) {
      compare('__source__', `source.${field}`, previous[field] as JsonValue | undefined, next[field] as JsonValue | undefined);
    }
  }
  return changes;
}
