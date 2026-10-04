import { NextResponse } from 'next/server';
import { getSourceDetail } from '@/lib/server/source-read';

export const runtime = 'nodejs';
export async function GET(_request: Request, context: {params: Promise<{sourceId:string}>}) {
  const {sourceId} = await context.params;
  const detail = await getSourceDetail(sourceId);
  if (!detail) return NextResponse.json({error:{code:'NOT_FOUND',message:'Source not found'}},{status:404});
  return NextResponse.json(detail);
}
