import { beforeEach,describe,expect,it,vi } from 'vitest';
import { PipelineStepError } from '@/lib/pipeline/handlers';
import { qaConfig } from '@/lib/regression/config';
import { PINNED_CONFIG } from '@/lib/regression/retrieve';
import type { AiMeta } from '@/lib/ai';

const state=vi.hoisted(()=>({row:{} as Record<string,any>,meta:{} as Record<string,any>,stepStage:'0-base',calls:0,
  inputs:[] as unknown[],audits:0}));

vi.mock('@/lib/db/client',()=>{
  const sql:any=async (parts:TemplateStringsArray,...values:unknown[])=>{
    const query=parts.join('?');
    if(query.includes('SELECT item_key FROM pipeline_steps')) return [{item_key:`00:regression-id:${state.stepStage}`}];
    if(query.includes('SELECT * FROM regression_runs')) return [state.row];
    if(query.includes('SELECT id,source_id,upstream_version_label')) return [{id:values[0],source_id:'sandbox',
      upstream_version_label:values[0]==='base-version'?'v13':'v14',revision_number:1,status:values[0]==='base-version'?'TRUSTED':'ANALYZING'}];
    if(query.includes('FROM records r JOIN source_versions v')) return [{source_id:'sandbox',source_version_id:'base-version',
      canonical_key:'HAD-4821',record_hash:values[1]==='base-version'?'persisted-hash':'candidate-hash',
      content_json:{judgment:values[1]==='base-version'?'إسناده صحيح':'صحيح'},metadata_json:{synthetic:true}}];
    if(query.includes("UPDATE regression_runs SET status='FAILED'")) {
      state.row.status='FAILED';state.row.failure_json=values[0];return [];
    }
    if(query.includes('UPDATE regression_runs SET old_retrieval_json')) {
      state.row.old_retrieval_json=values[0];state.row.old_answer=values[1];
      state.row.old_output_json=values[2];state.row.old_meta_json=values[3];
      state.row.config_json=values[4];state.row.model_config_hash=values[5];
      state.row.status='BASE_DONE';state.row.failure_json=null;return [{id:'regression-id'}];
    }
    if(query.includes('UPDATE regression_runs SET new_retrieval_json')) {
      state.row.new_retrieval_json=values[0];state.row.new_answer=values[1];
      state.row.new_output_json=values[2];state.row.new_meta_json=values[3];
      state.row.status='ANSWERS_DONE';state.row.failure_json=null;return [{id:'regression-id'}];
    }
    if(query.includes('INSERT INTO audit_events')) {state.audits++;return [];}
    throw new Error(`Unexpected SQL in regression retry test: ${query.slice(0,100)}`);
  };
  sql.json=(value:unknown)=>value;
  sql.begin=async (fn:(tx:typeof sql)=>Promise<unknown>)=>fn(sql);
  return {getSql:()=>sql};
});

vi.mock('@/lib/ai',async importOriginal=>{
  const actual=await importOriginal<typeof import('@/lib/ai')>();
  return {...actual,generateStructured:async (request:{input:unknown})=>{
    state.calls++;state.inputs.push(request.input);
    if(state.calls===1) return {ok:false,errorCode:'REGRESSION_FAILED',reason:'PROVIDER_ERROR',detail:'temporary provider error',meta:state.meta};
    const records=(request.input as {retrieved_records:{content:{judgment:string}}[]}).retrieved_records;
    return {ok:true,data:{answer:`[Mock] Source field reads ${records[0].content.judgment}`,cited_record_keys:['HAD-4821'],
      abstained:false,abstention_reason:null,uncertainty:'[Mock] Quote only.'},meta:state.meta};
  }};
});

import { runRegressionPairStep } from '@/lib/regression/run';

beforeEach(()=>{
  const config=qaConfig(PINNED_CONFIG);
  state.calls=0;state.inputs=[];state.audits=0;state.stepStage='0-base';
  state.meta={provider:config.provider,model:config.model,promptId:config.prompt_id,promptVersion:config.prompt_version,
    temperature:config.temperature,maxTokens:config.max_tokens,inputHash:'input-hash',latencyMs:0,mode:config.mode,
    attempts:0,recordedAt:null,mockMatch:'default',effort:null} satisfies AiMeta;
  state.row={id:'regression-id',pipeline_run_id:'run-id',incident_id:'incident-id',source_id:'sandbox',
    canonical_key:'HAD-4821',old_version_id:'base-version',new_version_id:'candidate-version',
    question:"What specifically does the source's grading field describe as sahih?",question_origin:'pinned',
    config_json:config,old_answer:null,new_answer:null,old_meta_json:null,new_meta_json:null,
    status:'PENDING',identity_hash:'stable-identity'};
});

describe('durable regression side retry',()=>{
  it('retains failure, retries the same question, then reuses the successful base answer',async()=>{
    await expect(runRegressionPairStep('run-id','incident-id')).rejects.toBeInstanceOf(PipelineStepError);
    expect(state.row.status).toBe('FAILED');
    expect(state.row.failure_json.side).toBe('old');
    expect(state.row.old_answer).toBeNull();
    expect(await runRegressionPairStep('run-id','incident-id')).toBe('regression-id');
    expect(state.row.status).toBe('BASE_DONE');
    expect(state.row.old_retrieval_json.records[0].record_hash).toBe('persisted-hash');
    expect(state.row.old_meta_json.mode).toBe('mock');
    expect((state.inputs[0] as {question:string}).question).toBe(state.row.question);
    expect((state.inputs[1] as {question:string}).question).toBe(state.row.question);
    expect(await runRegressionPairStep('run-id','incident-id')).toBe('regression-id');
    expect(state.calls).toBe(2);
    expect(state.audits).toBe(1);
  });
  it('keeps a successful base side when the candidate call fails, then resumes that side',async()=>{
    state.stepStage='1-candidate';
    state.row.old_answer='[Mock] Source field reads إسناده صحيح';
    state.row.old_meta_json=state.meta;
    state.row.status='BASE_DONE';
    await expect(runRegressionPairStep('run-id','incident-id')).rejects.toBeInstanceOf(PipelineStepError);
    expect(state.row.status).toBe('FAILED');
    expect(state.row.failure_json.side).toBe('new');
    expect(state.row.old_answer).toContain('إسناده صحيح');
    expect(state.row.new_answer).toBeNull();
    await expect(runRegressionPairStep('run-id','incident-id')).resolves.toBe('regression-id');
    expect(state.row.status).toBe('ANSWERS_DONE');
    expect(state.row.old_answer).toContain('إسناده صحيح');
    expect(state.row.new_answer).toContain('صحيح');
    expect(state.row.new_retrieval_json.records[0].record_hash).toBe('candidate-hash');
    expect(state.calls).toBe(2);
  });
});
