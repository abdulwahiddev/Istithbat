import { NextRequest, NextResponse } from 'next/server';
import { requireControl } from '@/lib/server/demo-auth';
import { getConnectorDefinition } from '@/lib/connectors/registry';
import { checkSource } from '@/lib/ingestion/check-source';
import { after } from 'next/server';
import { advancePipeline } from '@/lib/pipeline/runner';

export const runtime = 'nodejs';
// Ingestion and the post-response pipeline share this function's lifetime.
export const maxDuration = 60;

export async function POST(request: NextRequest, context: { params: Promise<{ sourceId: string }> }) {
  if (!requireControl(request)) return NextResponse.json({error:{code:'UNAUTHORIZED',message:'Demo control required'}},{status:401});
  const {sourceId} = await context.params;
  if (!getConnectorDefinition(sourceId)) return NextResponse.json({error:{code:'NOT_FOUND',message:'Source not available'}},{status:404});
  try {
    const result = await checkSource(sourceId, 'MANUAL', request.url);
    if (result.runId) after(() => advancePipeline(result.runId!));
    return NextResponse.json(result, {status:result.status === 'NEW_VERSION' ? 202 : 200});
  } catch (error) {
    const code = error instanceof Error ? error.message : 'DIFF_FAILED';
    return NextResponse.json({error:{code,message:'Source integrity check failed'}},{status:502});
  }
}
