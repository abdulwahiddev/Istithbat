import { NextRequest, NextResponse } from 'next/server';
import { claimStaleSandboxRecovery, getSandboxConsoleState } from '@/lib/server/sandbox-read';
import { isStaleRun, schedulePipeline } from '@/lib/pipeline/continue';
export const runtime='nodejs';
export const maxDuration=180;
export async function GET(request: NextRequest) {
  try {
    const state=await getSandboxConsoleState();
    const run=state?.pipeline;
    // Recover only the currently published sandbox run. The persisted runner
    // lease and step idempotency guard concurrent status reads and retries.
    if (run && isStaleRun(run) && await claimStaleSandboxRecovery(run.id)) schedulePipeline(run.id,request.url);
    return state ? NextResponse.json(state,{headers:{'cache-control':'no-store'}}) : NextResponse.json({error:{code:'NOT_SEEDED',message:'Sandbox is not seeded.'}},{status:503});
  } catch { return NextResponse.json({error:{code:'READ_FAILED',message:'Sandbox state could not be read. Try again.'}},{status:503}); }
}
