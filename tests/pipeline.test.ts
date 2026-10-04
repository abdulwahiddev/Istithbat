import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeContextPacket, contextPacketHash } from '@/lib/analysis/context';
import { analyze } from '@/lib/analysis/analyze';
import { failureDisposition, isValidExpectedStep, needsIncident, nextPendingStep, primaryChange, stepsForCandidate, type EvidenceChange } from '@/lib/pipeline/model';

const fixture=(name:string)=>JSON.parse(readFileSync(new URL(`../demo/synthetic-fixtures/${name}`,import.meta.url),'utf8'));
const v13=fixture('had-4821.v13.json'),v14=fixture('had-4821.v14.json'),r2=fixture('had-4821.v14-r2.json');
const judgment:EvidenceChange={id:'judgment',canonicalKey:'HAD-4821',changeType:'FIELD_MODIFIED',fieldPath:'judgment',fieldRole:'SCHOLAR_JUDGMENT',flags:[],rolesPresent:[]};
const provenance:EvidenceChange={id:'page',canonicalKey:'HAD-4821',changeType:'FIELD_MODIFIED',fieldPath:'reference.page',fieldRole:'PROVENANCE',flags:[],rolesPresent:[]};

describe('Packet 03 deterministic routing',()=>{
  it('creates one incident path for substantive judgment and provenance drift',()=>{
    expect(needsIncident([judgment])).toBe(true);
    expect(needsIncident([provenance])).toBe(true);
    expect(primaryChange([provenance,judgment])?.id).toBe('judgment');
  });
  it('routes metadata, Unicode, whitespace and serialization-only evidence directly to pending policy',()=>{
    expect(needsIncident([])).toBe(false);
    expect(needsIncident([{...judgment,flags:['WHITESPACE_ONLY']}])).toBe(false);
    expect(needsIncident([{...judgment,flags:['UNICODE_EQUIVALENT']}])).toBe(false);
    expect(needsIncident([{...judgment,fieldRole:'OPERATIONAL_METADATA'}])).toBe(false);
    expect(needsIncident([{...judgment,changeType:'RECORD_ADDED',fieldRole:'UNCLASSIFIED',rolesPresent:['OPERATIONAL_METADATA']}])).toBe(false);
    expect(needsIncident([{...judgment,flags:['HARAKAT_ONLY']}])).toBe(true);
    expect(stepsForCandidate(true)).toEqual(['POLICY']);
  });
  it('never completes unregistered future stages and rejects skipped stages',()=>{
    const steps=stepsForCandidate(false).map(step=>({step,status:step==='INCIDENT'||step==='ANALYSIS'?'DONE':'PENDING'}));
    expect(nextPendingStep(steps)?.step).toBe('REGRESSION_QUESTIONS');
    expect(isValidExpectedStep('REGRESSION_QUESTIONS','POLICY')).toBe(false);
    expect(isValidExpectedStep('REGRESSION_QUESTIONS','REGRESSION_QUESTIONS')).toBe(true);
    expect(failureDisposition(1)).toBe('RETRY');
    expect(failureDisposition(2)).toBe('FAILED');
  });
});

describe('Packet 03 context packet',()=>{
  function packet(silent=false) {
    const old= silent?v14:v13, next=silent?r2:v14;
    const field=silent?'reference.page':'judgment';
    const oldValue=silent?old.records[0].content.reference.page:old.records[0].content.judgment;
    const newValue=silent?next.records[0].content.reference.page:next.records[0].content.judgment;
    return makeContextPacket({
      source:{id:'hadith-evidence-sandbox',name:'Synthetic Sandbox',provider:'Istithbat',source_type:'SANDBOX',content_level:'A',synthetic:true},
      candidate:{id:silent?'r2':'r1',label:'v14',revision:silent?2:1,upstream_published_at:next.upstreamPublishedAt,raw_sha256:'b'.repeat(64),canonical_sha256:'c'.repeat(64),silent_mutation:silent},
      previous:{id:silent?'r1':'v13',label:silent?'v14':'v13',revision:1,upstream_published_at:old.upstreamPublishedAt,raw_sha256:'a'.repeat(64),canonical_sha256:'d'.repeat(64)},
      trusted:{id:'v13',label:'v13',revision:1},primary_change_id:field,
      changes:[{id:field,canonical_key:'HAD-4821',change_type:'FIELD_MODIFIED',field_path:field,
        field_role:silent?'PROVENANCE':'SCHOLAR_JUDGMENT',old_value:oldValue,new_value:newValue,
        old_field_hash:'e'.repeat(64),new_field_hash:'f'.repeat(64),flags:[],roles_present:[]}],
      records:[{canonical_key:'HAD-4821',old_content:old.records[0].content,new_content:next.records[0].content,
        old_metadata:old.records[0].metadata,new_metadata:next.records[0].metadata}],
    });
  }
  it('preserves the exact synthetic judgment evidence, roles and trusted identity',()=>{
    const context=packet();
    expect(context.changes[0]).toMatchObject({field_path:'judgment',field_role:'SCHOLAR_JUDGMENT',old_value:'إسناده صحيح',new_value:'صحيح'});
    expect(context.trusted?.label).toBe('v13');
    expect(context.elements[0].kind).toBe('SYNTHETIC_MUTATION');
    expect(context.records[0].old_content).toEqual(v13.records[0].content);
    expect(contextPacketHash(context)).toBe(contextPacketHash(packet()));
  });
  it('keeps same-label revision 2 distinct with exact provenance diff',()=>{
    const context=packet(true);
    expect(context.candidate).toMatchObject({label:'v14',revision:2,silent_mutation:true});
    expect(context.changes[0]).toMatchObject({field_path:'reference.page',field_role:'PROVENANCE',old_value:12,new_value:13});
    expect(contextPacketHash(context)).not.toBe(contextPacketHash(packet()));
  });
  it('uses Claude’s structured mock analyzer and keeps its mode visible',async()=>{
    const result=await analyze(packet(),{config:{mode:'mock',provider:null,model:null,apiKey:null,recordReplay:false}});
    expect(result.ok).toBe(true);
    expect(result.meta.mode).toBe('mock');
    if(result.ok) expect(result.data.executive_summary).toContain('[Mock]');
  });
  it('keeps missing replay distinct from a successful analysis',async()=>{
    const result=await analyze(packet(),{config:{mode:'replay',provider:null,model:null,apiKey:null,recordReplay:false},replayRoot:'/tmp/istithbat-nonexistent-replay'});
    expect(result.ok).toBe(false);
    expect(result.meta.mode).toBe('replay');
    if(!result.ok) expect(result.errorCode).toBe('AI_ANALYSIS_FAILED');
  });
});
