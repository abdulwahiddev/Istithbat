import type { ConnectorDefinition } from '@/lib/contracts';
import type { JsonValue } from '@/lib/hashing/canonicalize';

/** Normalized output every real connector produces: the existing SourcePayload shape (Bible §12). */
export interface NormalizedPayload {
  [key: string]: JsonValue;
  upstreamVersionLabel: string;
  records: Array<{ canonical_key: string; upstream_record_id: string; content: { [key: string]: JsonValue }; metadata: { [key: string]: JsonValue } }>;
  metadata: { [key: string]: JsonValue };
}

/**
 * A real, read-only HTTP connector. Source-specific code ends at `normalize`; everything after
 * (canonicalize, hash, diff, policy, pipeline) is the shared, source-neutral integrity engine.
 */
export interface HttpConnector {
  definition: ConnectorDefinition & { publishesVersionLabel: boolean };
  source: {
    id: string;
    name: string;
    provider: string;
    sourceType: string;
    connectorType: 'HTTP_API';
    /** Official API base, stored on the source row and checked before every fetch. */
    endpoint: string;
    rightsNote: string;
  };
  /** The fixed, bounded set of official URLs fetched by one check. */
  requestUrls(): string[];
  /** Pure and deterministic: the same bundle always yields the same payload. Throws SourceFetchError on malformed input. */
  normalize(responses: Array<{ url: string; body: Buffer }>): NormalizedPayload;
}

/** Literal label for providers that publish no version. Never presented as an upstream version. */
export const UNVERSIONED_LABEL = 'unversioned';
