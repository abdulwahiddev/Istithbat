import { prepareSnapshot, type SnapshotEvidence } from '@/lib/hashing/snapshot';
import { sha256 } from '@/lib/hashing/canonicalize';
import { decodeBundle, SourceFetchError } from './http-bundle';
import { getHttpConnector } from './registry';

/**
 * Turns stored or freshly fetched raw bytes into integrity evidence, for any source.
 *
 * - Sandbox: the raw bytes are already a SourcePayload (unchanged Packet 02 behaviour).
 * - Real HTTP connectors: the raw bytes are the exact-bytes response bundle. The connector's pure
 *   normalizer produces the SourcePayload; canonical form, record and field hashes are then computed
 *   by the same shared code. The raw SHA-256 stays the hash of the exact stored bundle bytes.
 */
export function prepareSourceEvidence(sourceId: string, raw: Buffer): SnapshotEvidence {
  const connector = getHttpConnector(sourceId);
  if (!connector) return prepareSnapshot(raw);
  const bundle = decodeBundle(raw);
  if (bundle.connector !== sourceId) throw new SourceFetchError(`bundle belongs to ${bundle.connector}, not ${sourceId}`);
  const expected = connector.requestUrls();
  const actual = bundle.responses.map((r) => r.url);
  if (expected.length !== actual.length || expected.some((url, i) => url !== actual[i])) {
    throw new SourceFetchError('bundle request set does not match the connector');
  }
  const payload = connector.normalize(bundle.responses);
  if (payload.records.length === 0) throw new SourceFetchError('normalized payload has no records');
  const evidence = prepareSnapshot(Buffer.from(JSON.stringify(payload), 'utf8'));
  return { ...evidence, rawBytes: raw, rawSha256: sha256(raw) };
}
