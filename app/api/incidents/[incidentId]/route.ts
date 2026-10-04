import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getIncidentDetail } from '@/lib/analysis/read-incidents';

export const runtime='nodejs';
export async function GET(_request:Request,context:{params:Promise<{incidentId:string}>}) {
  const {incidentId}=await context.params;
  if(!z.uuid().safeParse(incidentId).success) return NextResponse.json({error:{code:'NOT_FOUND',message:'Incident not found'}},{status:404});
  const detail=await getIncidentDetail(incidentId);
  return detail?NextResponse.json(detail):NextResponse.json({error:{code:'NOT_FOUND',message:'Incident not found'}},{status:404});
}
