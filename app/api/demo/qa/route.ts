import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSql } from '@/lib/db/client';
import { generateStructured, QaAnswerSchema } from '@/lib/ai';
import { LEXICAL_CONFIG, PINNED_CONFIG, retrieve, resolvePinnedRecord, retrievalEvidence } from '@/lib/regression/retrieve';

export const runtime='nodejs';
export const maxDuration=30;
const bodySchema=z.object({appId:z.string().min(1),sourceId:z.string().min(1),question:z.string().min(1).max(1000).optional(),
  pinnedQuestionId:z.uuid().optional()}).strict().refine(body=>Boolean(body.question||body.pinnedQuestionId));

export async function GET(request:NextRequest) {
  const appId=request.nextUrl.searchParams.get('appId');
  const sourceId=request.nextUrl.searchParams.get('sourceId');
  if(!appId||!sourceId) return NextResponse.json({error:{code:'BAD_REQUEST',message:'appId and sourceId required'}},{status:400});
  const sql=getSql();
  const [binding]=await sql`SELECT g.served_version_id,v.upstream_version_label,v.revision_number,v.status,s.is_demo_fixture
    FROM gateway_bindings g JOIN source_versions v ON v.id=g.served_version_id JOIN sources s ON s.id=g.source_id
    WHERE g.protected_app_id=${appId} AND g.source_id=${sourceId}`;
  if(!binding||binding.status!=='TRUSTED') return NextResponse.json({error:{code:'UNAVAILABLE',message:'No trusted served version'}},{status:503});
  const pinned=await sql`SELECT id,canonical_key,question FROM pinned_questions WHERE source_id=${sourceId} ORDER BY canonical_key,question`;
  return NextResponse.json({appId,sourceId,synthetic:binding.is_demo_fixture,
    servedVersion:{id:binding.served_version_id,label:binding.upstream_version_label,revision:binding.revision_number},
    pinnedQuestions:pinned.map(row=>({id:row.id,canonicalKey:row.canonical_key,question:row.question}))});
}

export async function POST(request:NextRequest) {
  const parsed=bodySchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:{code:'BAD_REQUEST',message:'Invalid question request'}},{status:400});
  const {appId,sourceId,pinnedQuestionId}=parsed.data;
  const sql=getSql();
  const [binding]=await sql`SELECT g.served_version_id,v.upstream_version_label,v.revision_number,v.status,s.is_demo_fixture
    FROM gateway_bindings g JOIN source_versions v ON v.id=g.served_version_id JOIN sources s ON s.id=g.source_id
    WHERE g.protected_app_id=${appId} AND g.source_id=${sourceId}`;
  if(!binding||binding.status!=='TRUSTED') return NextResponse.json({error:{code:'UNAVAILABLE',message:'No trusted served version'}},{status:503});
  let question=parsed.data.question;
  let canonicalKey:string|undefined;
  if(pinnedQuestionId) {
    const [pin]=await sql`SELECT question,canonical_key FROM pinned_questions WHERE id=${pinnedQuestionId} AND source_id=${sourceId}`;
    if(!pin) return NextResponse.json({error:{code:'BAD_REQUEST',message:'Pinned question unavailable'}},{status:400});
    if(question&&question!==pin.question) return NextResponse.json({error:{code:'BAD_REQUEST',message:'Pinned question text mismatch'}},{status:400});
    question=pin.question;
    canonicalKey=pin.canonical_key;
  }
  const records=canonicalKey
    ? [await resolvePinnedRecord(sourceId,canonicalKey,binding.served_version_id)].filter(record=>record!==null)
    : await retrieve(binding.served_version_id,question!,LEXICAL_CONFIG);
  if(canonicalKey&&records.length!==1) return NextResponse.json({error:{code:'UNAVAILABLE',message:'Pinned record unavailable'}},{status:503});
  const config=canonicalKey?PINNED_CONFIG:LEXICAL_CONFIG;
  const result=await generateStructured({task:'QA_ANSWER',schema:QaAnswerSchema,input:{question,
    knowledge_version:{id:binding.served_version_id,label:binding.upstream_version_label,revision:binding.revision_number},
    retrieved_records:records.map(record=>({canonical_key:record.canonical_key,content:record.content,
      metadata:record.metadata,record_hash:record.record_hash}))},promptVersion:'v1'});
  if(!result.ok) return NextResponse.json({error:{code:result.errorCode,message:'Answer unavailable'},
    meta:{provider:result.meta.provider,model:result.meta.model,mode:result.meta.mode,recordedAt:result.meta.recordedAt}},{status:502});
  return NextResponse.json({question,answer:result.data,meta:result.meta,
    sourceId,appId,synthetic:binding.is_demo_fixture,version:{id:binding.served_version_id,
      label:binding.upstream_version_label,revision:binding.revision_number,status:binding.status},
    retrieval:retrievalEvidence(records,config)});
}
