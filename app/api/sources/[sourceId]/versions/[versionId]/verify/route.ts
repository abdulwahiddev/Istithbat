import { NextRequest, NextResponse } from 'next/server';
import { requireControl } from '@/lib/server/demo-auth';
import { verifyStoredEvidence } from '@/lib/ingestion/verify-evidence';

export const runtime='nodejs';
export const maxDuration=30;

export async function POST(request:NextRequest,context:{params:Promise<{sourceId:string;versionId:string}>}) {
  if(!requireControl(request)) return NextResponse.json({error:{code:'UNAUTHORIZED',message:'Demo control required'}},{status:401});
  const {sourceId,versionId}=await context.params;
  try {
    const result=await verifyStoredEvidence(sourceId,versionId);
    if(!result) return NextResponse.json({error:{code:'NOT_FOUND',message:'Version not found'}},{status:404});
    return NextResponse.json(result,{status:result.valid?200:409});
  } catch {
    return NextResponse.json({error:{code:'SNAPSHOT_STORAGE_FAILED',message:'Evidence verification failed'}},{status:502});
  }
}
