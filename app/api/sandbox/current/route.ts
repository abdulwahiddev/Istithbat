import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { fixtureBytes, SANDBOX_ID, type FixtureName } from '@/lib/connectors/sandbox';
export const runtime='nodejs';
export async function GET() { const rows=await getSql()`SELECT fixture_name FROM sandbox_state WHERE source_id=${SANDBOX_ID}`; if(!rows.length) return NextResponse.json({error:{code:'NOT_SEEDED',message:'Sandbox is not seeded'}},{status:503}); const bytes=fixtureBytes(rows[0].fixture_name as FixtureName); return new Response(bytes,{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-istithbat-synthetic':'true'}}); }
