import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { getServerEnv } from '@/lib/server/env';
export const runtime='nodejs';
export async function GET() { try { getServerEnv(); await getSql()`SELECT 1`; return NextResponse.json({status:'ok',database:'connected'}); } catch { return NextResponse.json({status:'degraded',database:'unavailable'},{status:503}); } }
