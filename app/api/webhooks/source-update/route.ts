import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook } from '@/lib/server/webhook-signature';
import { SANDBOX_ID } from '@/lib/connectors/sandbox';
import { checkSource } from '@/lib/ingestion/check-source';
import { schedulePipeline } from '@/lib/pipeline/continue';

export const runtime = 'nodejs';
// Ingestion and the post-response pipeline share this function's lifetime.
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!verifyWebhook(body, request.headers.get('x-istithbat-signature'))) return NextResponse.json({error:{code:'INVALID_SIGNATURE',message:'Invalid webhook signature'}},{status:401});
  let parsed: unknown;
  try { parsed = JSON.parse(body); }
  catch { return NextResponse.json({error:{code:'BAD_REQUEST',message:'Invalid JSON'}},{status:400}); }
  if (typeof parsed !== 'object' || parsed === null || !('sourceId' in parsed) || parsed.sourceId !== SANDBOX_ID) {
    return NextResponse.json({error:{code:'BAD_REQUEST',message:'Unknown source'}},{status:400});
  }
  try {
    const result = await checkSource(SANDBOX_ID, 'WEBHOOK', request.url);
    if (result.runId) schedulePipeline(result.runId, request.url);
    return NextResponse.json(result, {status:result.status === 'NEW_VERSION' ? 202 : 200});
  } catch (error) {
    const code = error instanceof Error ? error.message : 'DIFF_FAILED';
    if (code === 'SANDBOX_GENERATION_CHANGED') return NextResponse.json({error:{code,message:'This source update was superseded by a demo reset.'}},{status:409});
    return NextResponse.json({error:{code,message:'Source integrity check failed'}},{status:502});
  }
}
