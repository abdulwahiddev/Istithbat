import 'server-only';
import { getSql } from '@/lib/db/client';
import { generateStructured, RegressionQuestionsSchema, QaAnswerSchema, BehaviorDeltaSchema } from '@/lib/ai';
import type { AiMeta, QaAnswer } from '@/lib/ai';
import { hashJson, sha256, type JsonValue } from '@/lib/hashing/canonicalize';
import { PipelineStepError } from '@/lib/pipeline/handlers';
import { qaConfig, modelConfigHash, regressionIdentity, assertQaMeta, assertSideMatch, type QaConfig } from './config';
import { LEXICAL_CONFIG, PINNED_CONFIG, retrieve, resolvePinnedRecord, retrievalEvidence, type RetrievedRecord } from './retrieve';

const failure=(reason:string,meta:Record<string,unknown>|null=null)=>new PipelineStepError('REGRESSION_FAILED',reason,meta);

export async function prepareRegressionQuestions(runId:string,incidentId:string):Promise<string> {
  const sql=getSql();
  const [run]=await sql`SELECT r.source_version_id,r.incident_id,i.source_id,i.primary_change_id,i.candidate_version_id
    FROM pipeline_runs r JOIN incidents i ON i.id=r.incident_id WHERE r.id=${runId} AND i.id=${incidentId}`;
  if(!run||run.source_version_id!==run.candidate_version_id) throw failure('incident/run identity mismatch');
  const [analysis]=await sql`SELECT status FROM pipeline_steps WHERE run_id=${runId} AND step='ANALYSIS' AND item_key=''`;
  if(analysis?.status!=='DONE') throw failure('analysis prerequisite not complete');
  const [existing]=await sql`SELECT id FROM regression_runs WHERE pipeline_run_id=${runId} ORDER BY question_index,created_at LIMIT 1`;
  if(existing) return existing.id;
  const [change]=await sql`SELECT canonical_key,field_path,field_role,old_value,new_value,change_type FROM changes WHERE id=${run.primary_change_id}`;
  if(!change) throw failure('primary change missing');
  const bindings=await sql`SELECT g.protected_app_id,g.served_version_id,v.status FROM gateway_bindings g
    JOIN source_versions v ON v.id=g.served_version_id WHERE g.source_id=${run.source_id} ORDER BY g.protected_app_id`;
  if(!bindings.length||bindings.some(b=>b.status!=='TRUSTED')) throw failure('no trusted served base');
  const pinned=await sql`SELECT question,canonical_key FROM pinned_questions WHERE source_id=${run.source_id} AND canonical_key=${change.canonical_key} ORDER BY question`;
  const questions:{question:string;origin:'pinned'|'generated'}[]=pinned.slice(0,3).map(p=>({question:p.question,origin:'pinned'}));
  const needed=3-questions.length;
  if(needed>0) {
    const generated=await generateStructured({task:'REGRESSION_QUESTIONS',schema:RegressionQuestionsSchema,
      input:{change:{canonical_key:change.canonical_key,field_path:change.field_path,field_role:change.field_role,
        old_value:change.old_value,new_value:change.new_value,change_type:change.change_type},
        pinned_questions:questions.map(q=>q.question),needed},promptVersion:'v1'});
    if(!generated.ok) throw failure(generated.reason,generated.meta as unknown as Record<string,unknown>);
    for(const item of generated.data.questions) {
      if(questions.length===3) break;
      if(!questions.some(q=>q.question.trim().toLowerCase()===item.question.trim().toLowerCase()))
        questions.push({question:item.question,origin:'generated'});
    }
  }
  if(!questions.length) throw failure('no regression questions');
  const insertedIds:string[]=[];
  await sql.begin(async tx=>{
    for(const binding of bindings) for(let index=0;index<questions.length;index++) {
      const q=questions[index];
      const retrievalConfig=q.origin==='pinned'?PINNED_CONFIG:LEXICAL_CONFIG;
      const config=qaConfig(retrievalConfig);
      const identity=regressionIdentity({incidentId,runId,sourceId:run.source_id,canonicalKey:change.canonical_key,
        baseVersionId:binding.served_version_id,candidateVersionId:run.candidate_version_id,
        protectedAppId:binding.protected_app_id,question:q.question,origin:q.origin,config});
      const inserted=await tx`INSERT INTO regression_runs (incident_id,pipeline_run_id,source_id,canonical_key,identity_hash,status,
        question_index,protected_app_id,batch_id,question,question_origin,old_version_id,new_version_id,config_json,model_config_hash)
        VALUES (${incidentId},${runId},${run.source_id},${change.canonical_key},${identity},'PENDING',${index},
          ${binding.protected_app_id},${runId},${q.question},${q.origin},${binding.served_version_id},${run.candidate_version_id},
          ${tx.json(config as JsonValue)},${modelConfigHash(config)})
        ON CONFLICT DO NOTHING RETURNING id`;
      const rowId=inserted[0]?.id as string|undefined ?? (await tx`SELECT id FROM regression_runs WHERE identity_hash=${identity}`)[0]?.id as string|undefined;
      if(!rowId) throw failure('regression identity unavailable');
      insertedIds.push(rowId);
      const prefix=`${String(index).padStart(2,'0')}:${rowId}:`;
      for(const stage of ['0-base','1-candidate','2-compare'])
        await tx`INSERT INTO pipeline_steps (run_id,step,item_key,status) VALUES (${runId},'REGRESSION_PAIR',${prefix+stage},'PENDING')
          ON CONFLICT (run_id,step,item_key) DO NOTHING`;
      if(inserted.length) await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
        VALUES ('REGRESSION_STARTED','regression_run',${rowId},'system:regression',
          ${tx.json({incidentId,runId,questionIndex:index,origin:q.origin,identityHash:identity})},${`regression-started:${identity}`}) ON CONFLICT DO NOTHING`;
    }
  });
  return insertedIds[0];
}

function qaInput(question:string,version:Record<string,unknown>,records:RetrievedRecord[]) {
  return {question,knowledge_version:{id:version.id,label:version.upstream_version_label,revision:version.revision_number},
    retrieved_records:records.map(record=>({canonical_key:record.canonical_key,content:record.content,metadata:record.metadata,
      record_hash:record.record_hash}))};
}

async function runSide(row:Record<string,any>,side:'old'|'new'):Promise<string> {
  const sql=getSql();
  const answerCol=side==='old'?'old_answer':'new_answer';
  if(row[answerCol]!==null) return row.id;
  const versionId=side==='old'?row.old_version_id:row.new_version_id;
  const [version]=await sql`SELECT id,source_id,upstream_version_label,revision_number,status FROM source_versions WHERE id=${versionId}`;
  if(!version||version.source_id!==row.source_id) throw failure('version/source mismatch');
  const config=row.config_json as QaConfig;
  const currentConfig=qaConfig(config.retrieval_config);
  if(currentConfig.system_prompt_hash!==config.system_prompt_hash||
    currentConfig.output_schema_hash!==config.output_schema_hash||
    currentConfig.prompt_version!==config.prompt_version) throw failure('QA prompt or schema changed since pair creation');
  const records=row.question_origin==='pinned'
    ? [await resolvePinnedRecord(row.source_id,row.canonical_key,versionId)].filter((r):r is RetrievedRecord=>r!==null)
    : await retrieve(versionId,row.question,config.retrieval_config as typeof LEXICAL_CONFIG);
  if(row.question_origin==='pinned'&&records.length!==1) throw failure('pinned record missing');
  const evidence=retrievalEvidence(records,config.retrieval_config);
  const input=qaInput(row.question,version,records);
  const result=await generateStructured({task:'QA_ANSWER',schema:QaAnswerSchema,input,promptVersion:config.prompt_version});
  if(!result.ok) {
    await sql`UPDATE regression_runs SET status='FAILED',failure_json=${sql.json({side,reason:result.reason,meta:result.meta} as unknown as JsonValue)},updated_at=now() WHERE id=${row.id}`;
    throw failure(`${side} answer failed: ${result.reason}`,result.meta as unknown as Record<string,unknown>);
  }
  try { assertQaMeta(result.meta,config); } catch { throw failure('QA configuration mismatch'); }
  if(side==='new'&&row.old_meta_json) {
    try { assertSideMatch(row.old_meta_json as AiMeta,result.meta); } catch { throw failure('base/candidate settings differ'); }
  }
  const answer=result.data.answer;
  const actualConfig={...config,provider:result.meta.provider,model:result.meta.model,
    temperature:result.meta.temperature,effort:result.meta.effort};
  await sql.begin(async tx=>{
    if(side==='old') await tx`UPDATE regression_runs SET old_retrieval_json=${tx.json(evidence as JsonValue)},old_answer=${answer},
      old_output_json=${tx.json(result.data)},old_meta_json=${tx.json(result.meta as unknown as JsonValue)},status='BASE_DONE',failure_json=NULL,
      config_json=${tx.json(actualConfig as JsonValue)},model_config_hash=${modelConfigHash(actualConfig as QaConfig)},
      updated_at=now() WHERE id=${row.id} AND old_answer IS NULL`;
    else await tx`UPDATE regression_runs SET new_retrieval_json=${tx.json(evidence as JsonValue)},new_answer=${answer},
      new_output_json=${tx.json(result.data)},new_meta_json=${tx.json(result.meta as unknown as JsonValue)},status='ANSWERS_DONE',failure_json=NULL,
      updated_at=now() WHERE id=${row.id} AND new_answer IS NULL`;
    await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
      VALUES (${side==='old'?'REGRESSION_BASE_COMPLETED':'REGRESSION_CANDIDATE_COMPLETED'},'regression_run',${row.id},
        'system:regression',${tx.json({versionId,question:row.question,answerHash:sha256(answer),recordHashes:records.map(r=>r.record_hash),mode:result.meta.mode})},
        ${`regression-${side}:${row.identity_hash}`}) ON CONFLICT DO NOTHING`;
  });
  return row.id;
}

async function compare(row:Record<string,any>):Promise<string> {
  const sql=getSql();
  if(row.status==='COMPLETE') return row.id;
  if(!row.old_output_json||!row.new_output_json||!row.old_meta_json||!row.new_meta_json) throw failure('both answer sides required');
  const oldMeta=row.old_meta_json as AiMeta,newMeta=row.new_meta_json as AiMeta;
  try {assertSideMatch(oldMeta,newMeta);} catch {throw failure('base/candidate settings differ');}
  const old=row.old_output_json as QaAnswer, current=row.new_output_json as QaAnswer;
  const deterministic={old_answer_sha256:sha256(old.answer),new_answer_sha256:sha256(current.answer),
    answer_text_changed:old.answer!==current.answer,
    normalized_text_changed:old.answer.replace(/\s+/gu,' ').trim()!==current.answer.replace(/\s+/gu,' ').trim(),
    cited_keys_changed:hashJson(old.cited_record_keys as JsonValue)!==hashJson(current.cited_record_keys as JsonValue),
    structured_output_changed:hashJson(old as JsonValue)!==hashJson(current as JsonValue),
    base_record_hashes:(row.old_retrieval_json?.records??[]).map((r:{record_hash:string})=>r.record_hash),
    candidate_record_hashes:(row.new_retrieval_json?.records??[]).map((r:{record_hash:string})=>r.record_hash)};
  const result=await generateStructured({task:'BEHAVIOR_DELTA',schema:BehaviorDeltaSchema,
    input:{question:row.question,old_answer:old.answer,new_answer:current.answer,
      old_output:old,new_output:current,deterministic,source_id:row.source_id,canonical_key:row.canonical_key},promptVersion:'v1'});
  if(!result.ok) {
    await sql`UPDATE regression_runs SET status='FAILED',failure_json=${sql.json({side:'comparison',reason:result.reason,meta:result.meta} as unknown as JsonValue)},updated_at=now() WHERE id=${row.id}`;
    throw failure(`comparison failed: ${result.reason}`,result.meta as unknown as Record<string,unknown>);
  }
  const identical=!deterministic.structured_output_changed;
  const classification=identical?'NO_CHANGE':result.data.result;
  const comparison={deterministic,advisory:result.data,classification,
    classification_source:identical?'deterministic-identical-output':'structured-ai',
    matched_config:true,model_config_hash:row.model_config_hash};
  await sql.begin(async tx=>{
    await tx`UPDATE regression_runs SET result=${classification},material_change=${classification==='MATERIAL_CHANGE'},
      comparison_json=${tx.json(comparison as JsonValue)},comparison_meta_json=${tx.json(result.meta as unknown as JsonValue)},
      status='COMPLETE',failure_json=NULL,completed_at=now(),updated_at=now() WHERE id=${row.id} AND status<>'COMPLETE'`;
    await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
      VALUES ('REGRESSION_COMPARISON_COMPLETED','regression_run',${row.id},'system:regression',
      ${tx.json({result:classification,materialChange:classification==='MATERIAL_CHANGE',mode:result.meta.mode,
        modelConfigHash:row.model_config_hash,answerTextChanged:deterministic.answer_text_changed})},
      ${`regression-complete:${row.identity_hash}`}) ON CONFLICT DO NOTHING`;
  });
  return row.id;
}

export async function runRegressionPairStep(runId:string,incidentId:string):Promise<string> {
  const sql=getSql();
  const [step]=await sql`SELECT item_key FROM pipeline_steps WHERE run_id=${runId} AND step='REGRESSION_PAIR' AND status='RUNNING'
    ORDER BY item_key LIMIT 1`;
  if(!step) throw failure('running regression step missing');
  const parts=(step.item_key as string).split(':');
  if(parts.length!==3) throw failure('invalid regression step identity');
  const [,rowId,stage]=parts;
  const [row]=await sql`SELECT * FROM regression_runs WHERE id=${rowId} AND pipeline_run_id=${runId} AND incident_id=${incidentId}`;
  if(!row) throw failure('regression row missing');
  if(stage==='0-base') return runSide(row,'old');
  if(stage==='1-candidate') return runSide(row,'new');
  if(stage==='2-compare') return compare(row);
  throw failure('unknown regression stage');
}
