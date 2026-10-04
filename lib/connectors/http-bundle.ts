import { createHash } from 'node:crypto';
import { z } from 'zod';

/**
 * Raw evidence for real HTTP connectors.
 *
 * A real source check makes a small, fixed set of official GET requests. The raw snapshot is a
 * deterministic bundle of those exact response bodies (base64, byte-for-byte) with each body's
 * SHA-256. It deliberately contains no timestamps or response headers, so identical upstream
 * bytes always produce an identical bundle and therefore an identical raw SHA-256 (NO_CHANGE),
 * while any upstream byte change produces a new raw fingerprint (D-14).
 */

export const BUNDLE_FORMAT = 'istithbat.http-raw-bundle/1';
export const MAX_RESPONSE_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 10_000;

export class SourceFetchError extends Error {
  constructor(public readonly detail: string) {
    // The message is the stable integrity error code; the detail is for tests/logs only.
    super('SOURCE_FETCH_FAILED');
  }
}

export interface BundleResponse {
  url: string;
  status: number;
  bodySha256: string;
  bodyBase64: string;
}

const bundleSchema = z.object({
  format: z.literal(BUNDLE_FORMAT),
  connector: z.string().min(1),
  responses: z
    .array(z.object({ url: z.string().url(), status: z.number().int(), bodySha256: z.string().length(64), bodyBase64: z.string() }))
    .min(1),
});

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

export function encodeBundle(connector: string, responses: Array<{ url: string; status: number; body: Buffer }>): Buffer {
  const bundle = {
    format: BUNDLE_FORMAT,
    connector,
    responses: responses.map((r) => ({ url: r.url, status: r.status, bodySha256: sha256(r.body), bodyBase64: r.body.toString('base64') })),
  };
  return Buffer.from(`${JSON.stringify(bundle, null, 1)}\n`, 'utf8');
}

/** Decodes and verifies a stored bundle. Each body must still match its recorded SHA-256. */
export function decodeBundle(raw: Buffer): { connector: string; responses: Array<{ url: string; status: number; body: Buffer }> } {
  let parsed: z.infer<typeof bundleSchema>;
  try {
    parsed = bundleSchema.parse(JSON.parse(raw.toString('utf8')));
  } catch {
    throw new SourceFetchError('raw bundle is not a valid istithbat HTTP bundle');
  }
  return {
    connector: parsed.connector,
    responses: parsed.responses.map((r) => {
      const body = Buffer.from(r.bodyBase64, 'base64');
      if (sha256(body) !== r.bodySha256) throw new SourceFetchError(`body hash mismatch for ${r.url}`);
      return { url: r.url, status: r.status, body };
    }),
  };
}

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Fetches each official URL once, in parallel, with a timeout and size cap. Any non-200,
 * non-JSON, empty or oversized response fails the whole check: no partial snapshot is ever stored.
 */
export async function fetchBundle(connector: string, urls: string[], fetcher: Fetcher = fetch): Promise<Buffer> {
  const responses = await Promise.all(
    urls.map(async (url) => {
      let response: Response;
      try {
        response = await fetcher(url, {
          method: 'GET',
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: { accept: 'application/json', 'user-agent': 'Istithbat-integrity-monitor/1.0 (read-only)' },
        });
      } catch {
        throw new SourceFetchError(`request failed or timed out: ${url}`);
      }
      if (response.status !== 200) throw new SourceFetchError(`HTTP ${response.status} from ${url}`);
      const type = response.headers.get('content-type') ?? '';
      if (!type.toLowerCase().includes('json')) throw new SourceFetchError(`non-JSON content-type from ${url}`);
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length === 0) throw new SourceFetchError(`empty body from ${url}`);
      if (body.length > MAX_RESPONSE_BYTES) throw new SourceFetchError(`oversized body from ${url}`);
      return { url, status: response.status, body };
    }),
  );
  return encodeBundle(connector, responses);
}

/** Parses one bundled body as JSON; malformed upstream JSON fails the check. */
export function bodyJson(responses: Array<{ url: string; body: Buffer }>, url: string): unknown {
  const match = responses.find((r) => r.url === url);
  if (!match) throw new SourceFetchError(`bundle is missing ${url}`);
  try {
    return JSON.parse(match.body.toString('utf8'));
  } catch {
    throw new SourceFetchError(`malformed JSON from ${url}`);
  }
}
