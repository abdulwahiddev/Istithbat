import { z } from 'zod';
import { canonicalBytes, fieldHashes, hashJson, sha256, type JsonValue } from './canonicalize';
import type { DiffPayload, DiffRecord } from '@/lib/diff/engine';

const jsonRecord = z.record(z.string(), z.unknown());
const snapshotRecord = z.object({
  canonical_key: z.string().min(1),
  upstream_record_id: z.string().optional(),
  content: jsonRecord,
  metadata: jsonRecord,
}).passthrough();
const snapshotPayload = z.object({
  upstreamVersionLabel: z.string().regex(/^[A-Za-z0-9._-]+$/),
  upstreamPublishedAt: z.string().optional(),
  records: z.array(snapshotRecord),
  metadata: jsonRecord,
}).passthrough();

export type SnapshotRecordEvidence = {
  record: DiffRecord;
  recordHash: string;
  fieldHashes: Record<string, string>;
};
export type SnapshotEvidence = {
  payload: DiffPayload & { upstreamVersionLabel: string; upstreamPublishedAt?: string };
  rawBytes: Buffer;
  canonicalBytes: Buffer;
  rawSha256: string;
  canonicalSha256: string;
  records: SnapshotRecordEvidence[];
};

export function prepareSnapshot(rawBytes: Buffer): SnapshotEvidence {
  const raw = JSON.parse(rawBytes.toString('utf8')) as unknown;
  const parsed = snapshotPayload.parse(raw);
  const keys = new Set<string>();
  for (const record of parsed.records) {
    if (keys.has(record.canonical_key)) throw new Error('DUPLICATE_CANONICAL_KEY');
    keys.add(record.canonical_key);
  }
  const payload = parsed as unknown as SnapshotEvidence['payload'];
  const records = payload.records.map(record => ({
    record,
    recordHash: hashJson(record as unknown as JsonValue),
    fieldHashes: fieldHashes(record.content),
  }));
  const canonical = canonicalBytes(raw as JsonValue);
  return {payload,rawBytes,canonicalBytes:canonical,rawSha256:sha256(rawBytes),canonicalSha256:sha256(canonical),records};
}
