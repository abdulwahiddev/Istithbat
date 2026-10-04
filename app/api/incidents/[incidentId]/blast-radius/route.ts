import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BlastRadius } from '@/lib/contracts';
import { readBlastRadius } from '@/lib/blast-radius/service';

export const runtime = 'nodejs';
export async function GET(_request: Request, context: { params: Promise<{ incidentId: string }> }) {
  const { incidentId } = await context.params;
  if (!z.uuid().safeParse(incidentId).success)
    return NextResponse.json({error:{code:'NOT_FOUND',message:'Incident not found'}},{status:404});
  const graph = await readBlastRadius(incidentId);
  return graph ? NextResponse.json(BlastRadius.parse(graph))
    : NextResponse.json({error:{code:'NOT_FOUND',message:'Incident not found'}},{status:404});
}
