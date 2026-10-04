import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { verifyWebhook } from '@/lib/server/webhook-signature';
import { SANDBOX_ID } from '@/lib/connectors/sandbox';
export const runtime='nodejs';
export async function POST(request:NextRequest) { const body=await request.text(); if(!verifyWebhook(body,request.headers.get('x-istithbat-signature'))) return NextResponse.json({error:{code:'INVALID_SIGNATURE',message:'Invalid webhook signature'}},{status:401}); let parsed:unknown; try {parsed=JSON.parse(body);} catch {return NextResponse.json({error:{code:'BAD_REQUEST',message:'Invalid JSON'}},{status:400});} if(typeof parsed!=='object'||parsed===null||!('sourceId' in parsed)||parsed.sourceId!==SANDBOX_ID) return NextResponse.json({error:{code:'BAD_REQUEST',message:'Unknown source'}},{status:400}); await getSql()`INSERT INTO source_checks (source_id,trigger_type,status) VALUES (${SANDBOX_ID},'WEBHOOK','PENDING_INGESTION')`; return NextResponse.json({accepted:true,sourceId:SANDBOX_ID,ingestion:'Packet 02'},{status:202}); }
