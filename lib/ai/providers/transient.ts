/**
 * Bounded resend of an identical provider request on transient server errors.
 *
 * Only HTTP 500/502/503/504: the provider did not process the request, so resending the exact
 * same body cannot change the model configuration (Bible §8) or double-charge. 4xx (bad request,
 * auth, billing, quota) and network errors are never resent; they fail closed as before.
 */
export const TRANSIENT_STATUSES = new Set([500, 502, 503, 504]);
export const TRANSIENT_DELAYS_MS = [1_000, 3_000] as const;

export async function fetchWithTransientRetry(
  url: string,
  init: RequestInit,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<Response> {
  let res = await fetch(url, init);
  for (const delay of TRANSIENT_DELAYS_MS) {
    if (!TRANSIENT_STATUSES.has(res.status) || init.signal?.aborted) return res;
    await res.body?.cancel().catch(() => {});
    await sleep(delay);
    res = await fetch(url, init);
  }
  return res;
}
