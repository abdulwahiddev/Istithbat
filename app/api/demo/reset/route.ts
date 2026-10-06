import { NextRequest, NextResponse } from 'next/server';
import { requireControl } from '@/lib/server/demo-auth';
import { SOURCE_DERIVED_SCENARIO } from '@/lib/contracts/sandbox-scenario';
import { resetDemo } from '@/lib/server/reset-demo';
export const runtime='nodejs';
export async function POST(request:NextRequest) { if(!requireControl(request)) return NextResponse.json({error:{code:'UNAUTHORIZED',message:'Demo control required'}},{status:401}); const body=await request.json().catch(()=>null); if(body?.scenario && body.scenario!==SOURCE_DERIVED_SCENARIO.id) return NextResponse.json({error:{code:'INVALID_SCENARIO',message:'Unknown scenario'}},{status:400}); await resetDemo(body?.scenario ? {scenario:body.scenario} : undefined); return NextResponse.json({reset:true,trustedLabel:'v13'}); }
