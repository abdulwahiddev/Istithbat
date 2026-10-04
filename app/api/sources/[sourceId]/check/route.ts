import { NextRequest, NextResponse } from 'next/server';
import { requireControl } from '@/lib/server/demo-auth';
import { SANDBOX_ID } from '@/lib/connectors/sandbox';
import { checkSource } from '@/lib/ingestion/check-source';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest, context: { params: Promise<{ sourceId: string }> }) {
  if (!requireControl(request)) return NextResponse.json({error:{code:'UNAUTHORIZED',message:'Demo control required'}},{status:401});
  const {sourceId} = await context.params;
  if (sourceId !== SANDBOX_ID) return NextResponse.json({error:{code:'NOT_FOUND',message:'Source not available'}},{status:404});
  try {
    const result = await checkSource(sourceId, 'MANUAL', request.url);
    return NextResponse.json(result, {status:result.status === 'NEW_VERSION' ? 202 : 200});
  } catch (error) {
    const code = error instanceof Error ? error.message : 'DIFF_FAILED';
    return NextResponse.json({error:{code,message:'Source integrity check failed'}},{status:502});
  }
}
