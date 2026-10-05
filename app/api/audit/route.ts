import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSql } from '@/lib/db/client';
import { getAuditPage } from '@/lib/governance/read-audit';

export const runtime='nodejs';
export async function GET(request:NextRequest) {
  const params=request.nextUrl.searchParams;
  const incidentId=params.get('incidentId')??undefined;
  const before=params.get('before')??undefined;
  const rawLimit=params.get('limit');
  if((incidentId && !z.uuid().safeParse(incidentId).success) || (before && !z.uuid().safeParse(before).success) ||
      (rawLimit!==null && !/^[1-9]\d*$/.test(rawLimit))) {
    return NextResponse.json({error:{code:'BAD_REQUEST',message:'Invalid audit query'}},{status:400});
  }
  const limit=rawLimit===null?25:Number(rawLimit);
  if(limit>100) return NextResponse.json({error:{code:'BAD_REQUEST',message:'Audit limit must be at most 100'}},{status:400});
  if(incidentId) {
    const [incident]=await getSql()`SELECT id FROM incidents WHERE id=${incidentId}`;
    if(!incident) return NextResponse.json({error:{code:'NOT_FOUND',message:'Incident not found'}},{status:404});
  }
  return NextResponse.json(await getAuditPage({incidentId,before,limit}));
}
