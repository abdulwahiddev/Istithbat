import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireControl } from '@/lib/server/demo-auth';
import { getPipelineRun } from '@/lib/pipeline/read';
import { advancePipeline, InvalidPipelineTransition } from '@/lib/pipeline/runner';
import { STEP_ORDER } from '@/lib/pipeline/model';

export const runtime='nodejs';
export const maxDuration=30;
const bodySchema=z.object({expectedStep:z.enum(STEP_ORDER).optional()}).strict();

export async function GET(_request:NextRequest,context:{params:Promise<{runId:string}>}) {
  const {runId}=await context.params;
  if (!z.uuid().safeParse(runId).success) return NextResponse.json({error:{code:'NOT_FOUND',message:'Pipeline run not found'}},{status:404});
  const run=await getPipelineRun(runId);
  return run?NextResponse.json(run):NextResponse.json({error:{code:'NOT_FOUND',message:'Pipeline run not found'}},{status:404});
}

export async function POST(request:NextRequest,context:{params:Promise<{runId:string}>}) {
  if (!requireControl(request)) return NextResponse.json({error:{code:'UNAUTHORIZED',message:'Demo control required'}},{status:401});
  const {runId}=await context.params;
  if (!z.uuid().safeParse(runId).success) return NextResponse.json({error:{code:'NOT_FOUND',message:'Pipeline run not found'}},{status:404});
  const parsed=bodySchema.safeParse(await request.json().catch(()=>({})));
  if (!parsed.success) return NextResponse.json({error:{code:'BAD_REQUEST',message:'Invalid pipeline advance request'}},{status:400});
  try {
    const result=await advancePipeline(runId,20_000,parsed.data.expectedStep);
    return result?NextResponse.json(result):NextResponse.json({error:{code:'NOT_FOUND',message:'Pipeline run not found'}},{status:404});
  } catch(error) {
    if(error instanceof InvalidPipelineTransition) return NextResponse.json({error:{code:'INVALID_PIPELINE_TRANSITION',message:'Requested step is not the next pending stage'}},{status:409});
    return NextResponse.json({error:{code:'DIFF_FAILED',message:'Pipeline advance failed safely'}},{status:502});
  }
}
