import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getSql } from '@/lib/db/client';
import { RegressionDetailResponse } from '@/lib/contracts';
import { GET } from '@/app/api/incidents/[incidentId]/regressions/route';

vi.mock('@/lib/db/client',()=>({getSql:vi.fn()}));

const incidentId='b0d0034d-62b6-4add-a2cb-ed0677160ed4';
const oldVersionId='1bf7ed48-391a-44d0-b637-e8ea52bd7cbc';
const newVersionId='ed9fa1bc-bcbe-49f9-9dee-75cae43d9c17';
const at=new Date('2026-10-05T21:18:09Z');
const answer=(value:string)=>({answer:value,cited_record_keys:['HAD-4821'],abstained:false,
  abstention_reason:null,uncertainty:'Synthetic test record only.'});
const comparison={
  deterministic:{old_answer_sha256:'a'.repeat(64),new_answer_sha256:'b'.repeat(64),
    answer_text_changed:true,normalized_text_changed:true,cited_keys_changed:false,
    structured_output_changed:true,base_record_hashes:['c'.repeat(64)],candidate_record_hashes:['d'.repeat(64)]},
  advisory:{result:'MATERIAL_CHANGE',material_change:true,delta_types:['MEANING_CHANGE'],
    old_answer_claim:'The chain is graded.',new_answer_claim:'The entry is graded.',
    explanation:'The qualification changed.',uncertainties:[],confidence:'HIGH'},
  classification:'MATERIAL_CHANGE',classification_source:'structured-ai',matched_config:true,
  model_config_hash:'e'.repeat(64),
};
const completed=(index:number,origin:'pinned'|'generated')=>({
  id:`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,
  incident_id:incidentId,pipeline_run_id:'11111111-1111-4111-8111-111111111111',
  protected_app_id:'islamic-qa-demo',batch_id:'22222222-2222-4222-8222-222222222222',
  source_id:'hadith-evidence-sandbox',canonical_key:'HAD-4821',identity_hash:'f'.repeat(64),
  status:'COMPLETE',question_index:index,question:index===0?'Pinned grading question':`Generated question ${index}`,
  question_origin:origin,old_version_id:oldVersionId,new_version_id:newVersionId,
  old_label:'v13',old_revision:1,new_label:'v14',new_revision:1,
  config_json:{provider:'gemini',model:'gemini-3.5-flash-lite',temperature:null},
  model_config_hash:'e'.repeat(64),old_retrieval_json:{records:[]},new_retrieval_json:{records:[]},
  old_answer:'The chain is graded.',new_answer:'The entry is graded.',
  old_output_json:answer('The chain is graded.'),new_output_json:answer('The entry is graded.'),
  old_meta_json:null,new_meta_json:null,comparison_json:comparison,comparison_meta_json:null,
  result:'MATERIAL_CHANGE',material_change:true,failure_json:null,created_at:at,updated_at:at,completed_at:at,
});
const request=()=>new NextRequest(`http://localhost/api/incidents/${incidentId}/regressions`);
const context=(id=incidentId)=>({params:Promise.resolve({incidentId:id})});
let exists=true;
let rows:Array<Record<string,unknown>>=[];
let queries:string[]=[];

beforeEach(()=>{
  exists=true;rows=[];queries=[];
  vi.mocked(getSql).mockReturnValue((async (parts:TemplateStringsArray)=>{
    const query=parts.join('?');queries.push(query);
    if(query.includes('SELECT id FROM incidents')) return exists?[{id:incidentId}]:[];
    if(query.includes('FROM regression_runs')) return rows;
    throw new Error(`Unexpected read: ${query}`);
  }) as never);
});

describe('GET incident regressions',()=>{
  it('returns all three production-shaped completed comparisons with the persisted wrapper',async()=>{
    rows=[completed(0,'pinned'),completed(1,'generated'),completed(2,'generated')];
    const response=await GET(request(),context());
    expect(response.status).toBe(200);
    const body=RegressionDetailResponse.parse(await response.json());
    expect(body.regressions.map(row=>[row.questionIndex,row.origin])).toEqual([
      [0,'pinned'],[1,'generated'],[2,'generated'],
    ]);
    expect(body.regressions[0]).toMatchObject({oldAnswer:'The chain is graded.',
      newAnswer:'The entry is graded.',result:'MATERIAL_CHANGE',materialChange:true,
      oldVersion:{id:oldVersionId,label:'v13',revisionNumber:1},
      newVersion:{id:newVersionId,label:'v14',revisionNumber:1},
      config:{model:'gemini-3.5-flash-lite',temperature:null},
      comparison:{classification:'MATERIAL_CHANGE',matched_config:true,
        advisory:{confidence:'HIGH',result:'MATERIAL_CHANGE'}},
    });
    expect(body.regressions[0].comparison?.model_config_hash).toBe(body.regressions[0].modelConfigHash);
    expect(queries[1]).toContain('ORDER BY r.question_index,r.protected_app_id,r.created_at,r.id');
  });

  it('preserves nullable fields on an older incomplete row instead of inventing evidence',async()=>{
    rows=[{...completed(0,'pinned'),status:'PENDING',question_index:null,config_json:null,
      model_config_hash:null,old_retrieval_json:null,new_retrieval_json:null,old_answer:null,new_answer:null,
      old_output_json:null,new_output_json:null,comparison_json:null,result:null,material_change:null,
      completed_at:null}];
    const response=await GET(request(),context());
    expect(response.status).toBe(200);
    const [row]=RegressionDetailResponse.parse(await response.json()).regressions;
    expect(row).toMatchObject({questionIndex:null,config:null,modelConfigHash:null,
      oldOutput:null,newOutput:null,comparison:null,result:null,materialChange:null,completedAt:null});
  });

  it('distinguishes an unknown incident from one with no regression rows',async()=>{
    exists=false;
    expect((await GET(request(),context())).status).toBe(404);
    exists=true;rows=[];
    const response=await GET(request(),context());
    expect(response.status).toBe(200);
    expect(RegressionDetailResponse.parse(await response.json()).regressions).toEqual([]);
    expect((await GET(request(),context('invalid-id'))).status).toBe(404);
  });
});
