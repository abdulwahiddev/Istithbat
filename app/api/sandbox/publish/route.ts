import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { requireControl } from '@/lib/server/demo-auth';
import { fixtureNames, SANDBOX_ID } from '@/lib/connectors/sandbox';
import { signWebhook } from '@/lib/server/webhook-signature';
export const runtime='nodejs';
export async function POST(request:NextRequest) { if(!requireControl(request)) return NextResponse.json({error:{code:'UNAUTHORIZED',message:'Demo control required'}},{status:401}); const body=await request.json().catch(()=>null); const fixture=body?.fixture; if(!fixtureNames.includes(fixture)) return NextResponse.json({error:{code:'INVALID_FIXTURE',message:'Unknown sandbox fixture'}},{status:400}); await getSql()`UPDATE sandbox_state SET fixture_name=${fixture},updated_at=now() WHERE source_id=${SANDBOX_ID}`; const webhookBody=JSON.stringify({sourceId:SANDBOX_ID}); const webhook=await fetch(new URL('/api/webhooks/source-update',request.url),{method:'POST',headers:{'content-type':'application/json','x-istithbat-signature':signWebhook(webhookBody)},body:webhookBody,cache:'no-store'}); return NextResponse.json({sourceId:SANDBOX_ID,fixture,webhookStatus:webhook.status,ingestion:'Packet 02'},{status:202}); }
