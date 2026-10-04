import { NextRequest, NextResponse } from 'next/server';
import { requireControl } from '@/lib/server/demo-auth';
import { resetDemo } from '@/lib/server/reset-demo';
export const runtime='nodejs';
export async function POST(request:NextRequest) { if(!requireControl(request)) return NextResponse.json({error:{code:'UNAUTHORIZED',message:'Demo control required'}},{status:401}); await resetDemo(); return NextResponse.json({reset:true,trustedLabel:'v13'}); }
