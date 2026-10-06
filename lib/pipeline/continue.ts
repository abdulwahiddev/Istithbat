import 'server-only';
import { after } from 'next/server';
import { advancePipeline } from './runner';

// D-08: continue the existing leased step machine across serverless time slices.
// No additional model attempts and no browser-driven advancement.
export function schedulePipeline(runId: string, origin: string, remaining = 32) {
  after(async () => {
    const result = await advancePipeline(runId);
    if (!result || !['WAITING', 'RETRYABLE_FAILURE'].includes(result.status)) return;
    if (remaining <= 0) { console.error('PIPELINE_CONTINUATION_LIMIT', runId); return; }
    const secret = process.env.DEMO_CONTROL_SECRET;
    if (!secret) { console.error('PIPELINE_CONTINUATION_NOT_CONFIGURED', runId); return; }
    try {
      const response = await fetch(new URL(`/api/pipeline/${runId}`, origin), {
        method: 'POST', cache: 'no-store', redirect: 'error',
        headers: { 'content-type': 'application/json', 'x-demo-control-secret': secret },
        body: JSON.stringify({ continuationRemaining: remaining - 1 }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) console.error('PIPELINE_CONTINUATION_FAILED', runId, response.status);
    } catch { console.error('PIPELINE_CONTINUATION_UNAVAILABLE', runId); }
  });
}
