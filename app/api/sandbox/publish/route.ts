import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { requireSandbox } from '@/lib/server/demo-auth';
import { fixtureNames, SANDBOX_ID } from '@/lib/connectors/sandbox';
import { signWebhook } from '@/lib/server/webhook-signature';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:NextRequest) {
  if(!requireSandbox(request)) return NextResponse.json({error:{code:'UNAUTHORIZED',message:'Sandbox access required'}},{status:401});
  const body=await request.json().catch(()=>null);
  const fixture=body?.fixture;
  if(!fixtureNames.includes(fixture)) return NextResponse.json({error:{code:'INVALID_FIXTURE',message:'Unknown sandbox fixture'}},{status:400});
  const updated=await getSql()`UPDATE sandbox_state SET fixture_name=${fixture},updated_at=CASE WHEN fixture_name=${fixture} THEN updated_at ELSE clock_timestamp() END WHERE source_id=${SANDBOX_ID} AND (fixture_name LIKE 'hadeethenc-10618.%')=${fixture.startsWith('hadeethenc-10618.')} RETURNING source_id`;
  if(!updated.length) return NextResponse.json({error:{code:'NOT_SEEDED',message:'Sandbox is missing or the requested scenario is not active. Reset the selected scenario before publishing.'}},{status:503});
  const webhookBody=JSON.stringify({sourceId:SANDBOX_ID});
  let webhook: Response;
  try { webhook=await fetch(new URL('/api/webhooks/source-update',request.url),{method:'POST',headers:{'content-type':'application/json','x-istithbat-signature':signWebhook(webhookBody)},body:webhookBody,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(50_000)}); }
  catch { return NextResponse.json({sourceId:SANDBOX_ID,fixture,published:true,webhookSent:false,error:{code:'SOURCE_FETCH_FAILED',message:'Published upstream, but the source update could not be delivered. Check the source state before retrying.'}},{status:502}); }
  const result=await webhook.json().catch(()=>({error:{code:'DIFF_FAILED',message:'Invalid ingestion response'}}));
  return NextResponse.json({sourceId:SANDBOX_ID,fixture,published:true,webhookSent:webhook.ok,...result},{status:webhook.status});
}
