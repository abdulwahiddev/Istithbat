import { z } from 'zod';

// Keywords provider structured-output engines reject. They are still enforced
// client-side, because every response is re-validated with the original zod schema.
const STRIPPED_KEYS = new Set([
  '$schema',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
  'uniqueItems',
  'pattern',
  'format',
  'default',
]);

function sanitize(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitize);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (STRIPPED_KEYS.has(key)) continue;
    out[key] = sanitize(value);
  }
  if (out.type === 'object') {
    out.additionalProperties = false;
    if (out.properties && typeof out.properties === 'object') {
      out.required = Object.keys(out.properties as object);
    }
  }
  return out;
}

/** zod schema → provider-safe JSON Schema (every object closed, every property required). */
export function toProviderJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { io: 'output', unrepresentable: 'any' });
  return sanitize(json) as Record<string, unknown>;
}
