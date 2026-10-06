import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireReview, reviewUsername } from '@/lib/server/demo-auth';
import { InvalidReviewTransition } from '@/lib/gateway/promote';
import { reviewIncident } from '@/lib/governance/review';

export const runtime = 'nodejs';
export const maxDuration = 30;
const body = z.object({ decision: z.enum(['APPROVE','REJECT','KEEP_QUARANTINED','ESCALATE']), reviewer: z.string().trim().min(1).max(120).optional(), reason: z.string().trim().max(2000).optional() }).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ incidentId: string }> }) {
  if (!requireReview(request)) return NextResponse.json({error:{code:'UNAUTHORIZED',message:'Reviewer mode required'}},{status:401});
  const { incidentId } = await context.params;
  if (!z.uuid().safeParse(incidentId).success) return NextResponse.json({error:{code:'NOT_FOUND',message:'Incident not found'}},{status:404});
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({error:{code:'BAD_REQUEST',message:'Invalid review decision'}},{status:400});
  try {
    return NextResponse.json(await reviewIncident({incidentId,decision:parsed.data.decision,reviewer:reviewUsername(),reason:parsed.data.reason}));
  } catch (error) {
    if (error instanceof InvalidReviewTransition) return NextResponse.json({error:{code:'INVALID_REVIEW_TRANSITION',message:'Review transition is not permitted'}},{status:409});
    return NextResponse.json({error:{code:'GATEWAY_UPDATE_FAILED',message:'Review action failed safely'}},{status:502});
  }
}
