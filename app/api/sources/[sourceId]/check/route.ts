import { NextRequest, NextResponse } from 'next/server';
import { requireControl } from '@/lib/server/demo-auth';
import { getSql } from '@/lib/db/client';
import { SANDBOX_ID } from '@/lib/connectors/sandbox';
export const runtime='nodejs';
export async function POST(request:NextRequest,context:{params:Promise<{sourceId:string}>}) {
  if (!requireControl(request)) return NextResponse.json({error:{code:'UNAUTHORIZED',message:'Demo control required'}},{status:401});
  const {sourceId}=await context.params;
  if (sourceId!==SANDBOX_ID) return NextResponse.json({error:{code:'NOT_FOUND',message:'Source not available in Packet 01'}},{status:404});
  const response=await fetch(new URL('/api/sandbox/current',request.url),{cache:'no-store'}).catch(()=>null);
  if (!response?.ok) {
    await getSql()`INSERT INTO source_checks (source_id,trigger_type,status,error_code) VALUES (${sourceId},'MANUAL','FAILED','SOURCE_FETCH_FAILED')`;
    return NextResponse.json({error:{code:'SOURCE_FETCH_FAILED',message:'Sandbox fetch failed'}},{status:502});
  }
  const payload=await response.json();
  await getSql()`INSERT INTO source_checks (source_id,trigger_type,status) VALUES (${sourceId},'MANUAL','PENDING_INGESTION')`;
  return NextResponse.json({accepted:true,sourceId,upstreamLabel:payload.upstreamVersionLabel,ingestion:'Packet 02'},{status:202});
}
