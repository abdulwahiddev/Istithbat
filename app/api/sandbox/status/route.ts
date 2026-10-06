import { NextResponse } from 'next/server';
import { getSandboxConsoleState } from '@/lib/server/sandbox-read';
export const runtime='nodejs';
export async function GET() {
  try {
    const state=await getSandboxConsoleState();
    return state ? NextResponse.json(state,{headers:{'cache-control':'no-store'}}) : NextResponse.json({error:{code:'NOT_SEEDED',message:'Sandbox is not seeded.'}},{status:503});
  } catch { return NextResponse.json({error:{code:'READ_FAILED',message:'Sandbox state could not be read. Try again.'}},{status:503}); }
}
