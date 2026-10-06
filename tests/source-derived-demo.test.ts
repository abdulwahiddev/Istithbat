import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fixtureBytes, sandboxConnector } from '@/lib/connectors/sandbox';
import { SOURCE_DERIVED_SCENARIO as scenario } from '@/lib/contracts/sandbox-scenario';
import { prepareSnapshot } from '@/lib/hashing/snapshot';
import { wordDiff } from '@/components/strata/diff';
import { hashJson, type JsonValue } from '@/lib/hashing/canonicalize';
import { diffPayloads } from '@/lib/diff/engine';
import { evaluatePolicy } from '@/lib/policy/rules';
import { buildBlastRadius, type GraphInput } from '@/lib/blast-radius/graph';
const sql=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/db/client',()=>({getSql:()=>sql}));
import { resolvePinnedRecord } from '@/lib/regression/retrieve';
import { resolveTrustedRecord } from '@/lib/gateway/resolve';
const base=prepareSnapshot(fixtureBytes(scenario.baselineFixture));
const candidate=prepareSnapshot(fixtureBytes(scenario.candidateFixture));
const original=base.payload.records[0];
const changes=diffPayloads(base.payload,candidate.payload,sandboxConnector.fieldRoles);
describe('HadeethEnc 10618 controlled integrity scenario',()=>{
 it('reconstructs the exact validated source record hash, including both language objects and original metadata',()=>{
  const reconstructed={canonical_key:'hadeethenc:10618',upstream_record_id:original.upstream_record_id,content:original.content,metadata:original.metadata.original_provenance};
  expect(hashJson(reconstructed as JsonValue)).toBe('2af183fd55654a6869c91cc9ed407b9890a801b39ce6c7b78ab309cca6e72bea');
  expect(original.metadata.original_record_hash).toBe(hashJson(reconstructed as JsonValue));
  const provenance=JSON.parse(readFileSync('demo/source-derived/hadeethenc-10618.provenance.json','utf8'));
  expect(original.metadata.original_provenance).toEqual(provenance.original_metadata);
  expect(original.metadata.acquisition).toEqual(provenance.raw_acquisition);
 });
 it('changes exactly ar.grade, preserving all other content, record metadata and source metadata',()=>{
  const restored=structuredClone(candidate.payload.records[0]);
  (restored.content.ar as Record<string,JsonValue>).grade=scenario.originalGrade;
  expect(restored).toEqual(original);
  expect(candidate.payload.metadata).toEqual(base.payload.metadata);
  for(const language of ['ar','en']) {
   expect(Buffer.from(String((candidate.payload.records[0].content[language] as any).hadeeth))).toEqual(Buffer.from(String((original.content[language] as any).hadeeth)));
  }
  expect((candidate.payload.records[0].content.en as any).grade_ar).toBe(scenario.originalGrade);
  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({canonicalKey:scenario.canonicalKey,changeType:'FIELD_MODIFIED',fieldPath:'ar.grade',fieldRole:'SCHOLAR_JUDGMENT',oldValue:scenario.originalGrade,newValue:scenario.candidateGrade,flags:[]});
 });
 it('reproduces the recorded field fingerprints and exact display word delta',()=>{
  expect(base.records[0].fieldHashes['ar.grade']).toBe('449efbafdcc8926fd411fab277a3e5a6ae9fa9a7d8dcd61859f11bfe7d5cc173');
  expect(candidate.records[0].fieldHashes['ar.grade']).toBe('d3908502420b0dbd7e6057e3038fd015317e66471651668aba7d1c3032b28410');
  expect(wordDiff(scenario.originalGrade,scenario.candidateGrade)).toMatchObject({removed:['دون','قوله:','(ولم','يستدر)'],added:[]});
 });
 it('quarantines under unchanged POL-002 even with AI ALLOW or unavailable regression',()=>{
  for(const failed of [false,true]) {
   const result=evaluatePolicy({sourceType:'HADITH_EVIDENCE',contentLevel:'A',silentMutation:false,serializationOnly:false,changes,advisory:{analysisTypes:[],maxRiskLevel:null,meaningChanged:false,recommendedAction:'ALLOW',materialChangeDetected:false,aiFailed:failed,regressionFailed:failed}});
   expect(result.policyCode).toBe('POL-002');expect(result.action).toBe('QUARANTINE');
  }
 });
 it('separates original provider provenance from sandbox version identity and candidate authorship',()=>{
  for(const snapshot of [base,candidate]) {
   expect(snapshot.payload.metadata).toMatchObject({provider:'Istithbat controlled integrity simulator',version_scope:'Sandbox test versions; not HadeethEnc-published versions',source_derived:true});
   expect(snapshot.payload.metadata?.disclosure).toBe(scenario.disclosure);
   expect(original.metadata.original_provenance).toMatchObject({provider:'HadeethEnc.com',synthetic:false,hadeeth_id:'10618'});
  }
 });
 it('pinned retrieval selects the intended record in each version and the held gateway still resolves only the trusted baseline',async()=>{
  for(const snapshot of [base,candidate]) {
   const record=snapshot.records[0];sql.mockResolvedValueOnce([{source_id:'hadith-evidence-sandbox',source_version_id:snapshot.payload.upstreamVersionLabel,canonical_key:scenario.canonicalKey,record_hash:record.recordHash,content_json:record.record.content,metadata_json:record.record.metadata}]);
   const result=await resolvePinnedRecord('hadith-evidence-sandbox',scenario.canonicalKey,snapshot.payload.upstreamVersionLabel);
   expect(result?.canonical_key).toBe(scenario.canonicalKey);expect(result?.record_hash).toBe(record.recordHash);
  }
  sql.mockResolvedValueOnce([{canonical_key:scenario.canonicalKey,content_json:original.content,version_id:'base',upstream_version_label:'v13'}]);
  const served=await resolveTrustedRecord({sourceId:'hadith-evidence-sandbox',canonicalKey:scenario.canonicalKey,appId:'islamic-qa-demo'});
  expect(served?.content_json).toEqual(original.content);
  const query=sql.mock.calls.at(-1)![0].join('?');expect(query).toContain("v.status='TRUSTED'");expect(query).toContain('v.id=g.served_version_id');
 });
 it('computes deterministic exposure and only marks the app impacted with completed material regression evidence',()=>{
  const graph:GraphInput={incident:{id:'incident',sourceId:'hadith-evidence-sandbox',previousVersionId:'base',candidateVersionId:'candidate',status:'QUARANTINED',policyAction:'QUARANTINE'},changes:[{id:'grade',canonicalKey:scenario.canonicalKey,fieldPath:'ar.grade',fieldRole:'SCHOLAR_JUDGMENT'}],assets:[{id:'dataset',name:'Source-derived dataset',assetType:'DATASET'},{id:'qa',name:'Protected app',assetType:'APPLICATION'}],mappings:[{assetId:'dataset',sourceId:'hadith-evidence-sandbox',canonicalKey:scenario.canonicalKey,derivedFromVersionId:'base',derivationMode:'GATEWAY_RESOLVED',derivedVersionStatus:'TRUSTED'}],dependencies:[{from:'dataset',to:'qa',type:'DEPENDS_ON'}],protectedApps:[{id:'islamic-qa-demo',assetId:'qa',servedVersionId:'base'}],regressions:[],trustedVersionId:'base'};
  expect(buildBlastRadius(graph).counts).toEqual({exposed:2,stale:0,impacted:0});
  graph.regressions=[{id:'r',protectedAppId:'islamic-qa-demo',oldVersionId:'base',newVersionId:'candidate',result:'MATERIAL_CHANGE',status:'COMPLETE'}];
  const a=buildBlastRadius(graph);expect(a.counts).toEqual({exposed:1,stale:0,impacted:1});expect(a.candidateServed).toBe(false);expect(buildBlastRadius(structuredClone(graph)).traversalHash).toBe(a.traversalHash);
 });
});

describe('matched settings and source-derived context',()=>{
 it('rejects mismatched model metadata and explicitly attributes only the original to HadeethEnc',async()=>{
  const {assertSideMatch,qaConfig}=await import('@/lib/regression/config');
  const {PINNED_CONFIG}=await import('@/lib/regression/retrieve');
  const config=qaConfig(PINNED_CONFIG);
  const meta={provider:config.provider,model:config.model,mode:config.mode,promptId:config.prompt_id,promptVersion:config.prompt_version,temperature:config.temperature,maxTokens:config.max_tokens,effort:null} as any;
  expect(()=>assertSideMatch(meta,{...meta})).not.toThrow();expect(()=>assertSideMatch(meta,{...meta,model:'different'})).toThrow('REGRESSION_CONFIG_MISMATCH');
  const {makeContextPacket}=await import('@/lib/analysis/context');
  const context=makeContextPacket({source:{id:'hadith-evidence-sandbox',name:'Controlled simulator',provider:'Istithbat',source_type:'HADITH_EVIDENCE',content_level:'A',synthetic:true},candidate:{id:'candidate',label:'v14',revision:1,upstream_published_at:null,raw_sha256:candidate.rawSha256,canonical_sha256:candidate.canonicalSha256,silent_mutation:false},previous:null,trusted:null,primary_change_id:'grade',changes:[],records:[{canonical_key:scenario.canonicalKey,old_content:original.content,new_content:candidate.payload.records[0].content,old_metadata:original.metadata,new_metadata:candidate.payload.records[0].metadata}]});
  expect(context.elements[0].value).toContain('Istithbat-created controlled test');expect(context.elements[0].value).toContain('not HadeethEnc publications');
 });
 it('supports normal lexical reads of nested source records without requiring duplicated flattened source fields',async()=>{
  const {rankRecords}=await import('@/lib/regression/retrieve');
  const record=base.records[0];expect(rankRecords([{source_id:'hadith-evidence-sandbox',source_version_id:'base',canonical_key:scenario.canonicalKey,record_hash:record.recordHash,content:record.record.content,metadata:record.record.metadata}],'ولم يستدر')).toHaveLength(1);
 });
});
