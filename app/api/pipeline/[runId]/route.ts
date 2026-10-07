import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireControl } from '@/lib/server/demo-auth';
import { getPipelineRun } from '@/lib/pipeline/read';
import { advancePipeline, InvalidPipelineTransition } from '@/lib/pipeline/runner';
import { isStaleRun, schedulePipeline } from '@/lib/pipeline/continue';
import { claimStaleSandboxRecovery, getSandboxConsoleState } from '@/lib/server/sandbox-read';
import { STEP_ORDER } from '@/lib/pipeline/model';

export const runtime='nodejs';
export const maxDuration=180;
const bodySchema=z.object({expectedStep:z.enum(STEP_ORDER).optional(),continuationRemaining:z.number().int().min(0).max(32).optional()}).strict();

export async function GET(request:NextRequest,context:{params:Promise<{runId:string}>}) {
  const {runId}=await context.params;
  if (!z.uuid().safeParse(runId).success) return NextResponse.json({error:{code:'NOT_FOUND',message:'Pipeline run not found'}},{status:404});
  const run=await getPipelineRun(runId);
  if (isStaleRun(run)) {
    try {
      const sandbox=await getSandboxConsoleState();
      if (sandbox?.pipeline?.id===runId && await claimStaleSandboxRecovery(runId)) schedulePipeline(runId,request.url);
    } catch (error) { console.error('PIPELINE_RECOVERY_CHECK_FAILED',runId,error instanceof Error ? error.name : 'unknown'); }
  }
  return run?NextResponse.json(run,{headers:{'cache-control':'no-store'}}):NextResponse.json({error:{code:'NOT_FOUND',message:'Pipeline run not found'}},{status:404});
}

export async function POST(request:NextRequest,context:{params:Promise<{runId:string}>}) {
  if (!requireControl(request)) return NextResponse.json({error:{code:'UNAUTHORIZED',message:'Demo control required'}},{status:401});
  const {runId}=await context.params;
  if (!z.uuid().safeParse(runId).success) return NextResponse.json({error:{code:'NOT_FOUND',message:'Pipeline run not found'}},{status:404});
  const parsed=bodySchema.safeParse(await request.json().catch(()=>({})));
  if (!parsed.success) return NextResponse.json({error:{code:'BAD_REQUEST',message:'Invalid pipeline advance request'}},{status:400});
  try {
    // Continuation requests acknowledge quickly, then use the same after() runner.
    if (parsed.data.continuationRemaining !== undefined) {
      const run = await getPipelineRun(runId);
      if (!run) return NextResponse.json({error:{code:'NOT_FOUND',message:'Pipeline run not found'}},{status:404});
      if (run.status === 'RUNNING') schedulePipeline(runId, request.url, parsed.data.continuationRemaining);
      return NextResponse.json({runId, status:run.status}, {status:202});
    }
    const result=await advancePipeline(runId,20_000,parsed.data.expectedStep);
    if (result && ['WAITING','RETRYABLE_FAILURE'].includes(result.status)) schedulePipeline(runId,request.url);
    return result?NextResponse.json(result):NextResponse.json({error:{code:'NOT_FOUND',message:'Pipeline run not found'}},{status:404});
  } catch(error) {
    if(error instanceof InvalidPipelineTransition) return NextResponse.json({error:{code:'INVALID_PIPELINE_TRANSITION',message:'Requested step is not the next pending stage'}},{status:409});
    return NextResponse.json({error:{code:'DIFF_FAILED',message:'Pipeline advance failed safely'}},{status:502});
  }
}
