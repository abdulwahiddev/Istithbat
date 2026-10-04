import { describe,expect,it } from 'vitest';
import { qaConfig, modelConfigHash, regressionIdentity, assertQaMeta, assertSideMatch } from '@/lib/regression/config';
import { rankRecords, LEXICAL_CONFIG, PINNED_CONFIG, type RetrievedRecord } from '@/lib/regression/retrieve';
import { generateStructured, QaAnswerSchema, BehaviorDeltaSchema } from '@/lib/ai';
import type { AiMeta } from '@/lib/ai';

const record=(key:string,text:string):RetrievedRecord=>({source_id:'sandbox',source_version_id:'v13',canonical_key:key,
  record_hash:key,content:{judgment:text},metadata:{synthetic:true}});
const identityArgs={incidentId:'incident',runId:'run',sourceId:'sandbox',canonicalKey:'HAD-4821',
  baseVersionId:'v13',candidateVersionId:'v14',protectedAppId:'app',question:"What specifically does the source's grading field describe as sahih?",
  origin:'pinned',config:qaConfig(PINNED_CONFIG)};

describe('matched regression invariants',()=>{
  it('lexical ranking is version scoped, stable, and has no zero-score fallback',()=>{
    expect(rankRecords([record('B','إِسْنَادُهُ صَحِيح'),record('A','إسناده صحيح')],'اسناده',LEXICAL_CONFIG).map(r=>r.canonical_key)).toEqual(['A','B']);
    expect(rankRecords([record('A','صحيح')],'unrelated words',LEXICAL_CONFIG)).toEqual([]);
    expect(rankRecords([record('A','صحيح')],'A',LEXICAL_CONFIG).map(r=>r.canonical_key)).toEqual(['A']);
  });
  it('identity is stable and changes with version, question, config, or mode',()=>{
    const id=regressionIdentity(identityArgs);
    expect(regressionIdentity(identityArgs)).toBe(id);
    expect(regressionIdentity({...identityArgs,candidateVersionId:'v14-r2'})).not.toBe(id);
    expect(regressionIdentity({...identityArgs,question:'Different question'})).not.toBe(id);
    expect(regressionIdentity({...identityArgs,config:qaConfig(LEXICAL_CONFIG)})).not.toBe(id);
    expect(regressionIdentity({...identityArgs,config:{...identityArgs.config,mode:'replay'}})).not.toBe(id);
    expect(modelConfigHash(qaConfig(PINNED_CONFIG))).toBe(modelConfigHash(qaConfig(PINNED_CONFIG)));
  });
  it('requires both sides to use the exact same provider/model/prompt/temperature settings',()=>{
    const config=qaConfig(PINNED_CONFIG);
    const meta:AiMeta={provider:config.provider,model:config.model,promptId:config.prompt_id,promptVersion:config.prompt_version,
      temperature:config.temperature,maxTokens:config.max_tokens,inputHash:'a',latencyMs:0,mode:config.mode,
      attempts:0,recordedAt:null,mockMatch:'default',effort:null};
    expect(()=>assertQaMeta(meta,config)).not.toThrow();
    expect(()=>assertSideMatch(meta,{...meta,inputHash:'b'})).not.toThrow();
    expect(()=>assertSideMatch(meta,{...meta,model:'other'})).toThrow();
    expect(()=>assertSideMatch(meta,{...meta,temperature:null})).toThrow();
  });
  it('passes the exact pinned question to both model calls and never fixes the result',async()=>{
    const question=identityArgs.question;
    const input=(version:string,judgment:string)=>({question,knowledge_version:{id:version},
      retrieved_records:[{canonical_key:'HAD-4821',content:{judgment}}]});
    const old=await generateStructured({task:'QA_ANSWER',schema:QaAnswerSchema,input:input('v13','إسناده صحيح')});
    const candidate=await generateStructured({task:'QA_ANSWER',schema:QaAnswerSchema,input:input('v14','صحيح')});
    expect(old.ok&&candidate.ok).toBe(true);
    if(!old.ok||!candidate.ok) return;
    expect(old.meta.mode).toBe('mock');
    expect(old.meta.model).toBe(candidate.meta.model);
    expect(old.meta.promptVersion).toBe(candidate.meta.promptVersion);
    expect(old.meta.temperature).toBe(candidate.meta.temperature);
    expect(old.meta.inputHash).not.toBe(candidate.meta.inputHash);
    expect(old.data.answer).toContain('إسناده صحيح');
    expect(candidate.data.answer).toContain('صحيح');
    expect(old.data.answer).not.toBe(candidate.data.answer);
    const compared=await generateStructured({task:'BEHAVIOR_DELTA',schema:BehaviorDeltaSchema,
      input:{question,old_answer:old.data.answer,new_answer:candidate.data.answer}});
    expect(compared.ok).toBe(true);
    if(compared.ok) expect(compared.data.result).toBe('INCONCLUSIVE');
  });
});
