import { createHash } from 'node:crypto';

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function normalizedStructure(value: JsonValue, path = ''): JsonValue {
  if (Array.isArray(value)) {
    const items = path === 'records'
      ? [...value].sort((left, right) => {
          const a = (left as { canonical_key?: string }).canonical_key;
          const b = (right as { canonical_key?: string }).canonical_key;
          if (typeof a !== 'string' || typeof b !== 'string') throw new Error('INVALID_CANONICAL_KEY');
          return a < b ? -1 : a > b ? 1 : 0;
        })
      : value;
    return items.map(item => normalizedStructure(item, `${path}[]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(field => [field, normalizedStructure(value[field], path ? `${path}.${field}` : field)]),
    );
  }
  return value;
}

export function canonicalJson(value: JsonValue): string {
  return JSON.stringify(normalizedStructure(value));
}

export function canonicalBytes(value: JsonValue): Buffer {
  return Buffer.from(canonicalJson(value), 'utf8');
}

export function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function hashJson(value: JsonValue): string {
  return sha256(canonicalBytes(value));
}

export function fieldHashes(content: Record<string, JsonValue>): Record<string, string> {
  const result: Record<string, string> = {};
  function visit(value: JsonValue, path: string) {
    result[path] = hashJson(value);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const field of Object.keys(value)) visit(value[field], `${path}.${field}`);
    }
  }
  for (const field of Object.keys(content)) visit(content[field], field);
  return result;
}
