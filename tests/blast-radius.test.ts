import { describe, expect, it } from 'vitest';
import { buildBlastRadius, type GraphInput } from '@/lib/blast-radius/graph';
import { BlastRadius } from '@/lib/contracts';
import { nextPendingStep } from '@/lib/pipeline/model';

function fixture(): GraphInput {
  const old = 'v13', r1 = 'v14-r1';
  const ids = ['dataset','chunk','index','qa-api','qa-app','search-api','explorer'];
  const names = ['Synthetic Evidence Dataset','Synthetic RAG Chunk','Knowledge Index','Q&A API','Islamic Q&A','Search API','Content Explorer'];
  const types = ['DATASET','RAG_CHUNK','KNOWLEDGE_INDEX','API','APPLICATION','API','APPLICATION'];
  return {
    incident: { id:'incident-r1',sourceId:'sandbox',previousVersionId:old,candidateVersionId:r1,status:'RESOLVED',policyAction:'QUARANTINE' },
    changes:[{id:'change-1',canonicalKey:'HAD-4821',fieldPath:'judgment',fieldRole:'SCHOLAR_JUDGMENT'}],
    assets: ids.map((id,i)=>({id,name:names[i],assetType:types[i]})),
    mappings: ids.map(id=>({assetId:id,sourceId:'sandbox',canonicalKey:'HAD-4821',
      derivedFromVersionId:id==='search-api'||id==='explorer'?old:r1,
      derivationMode: id==='search-api'||id==='explorer'?'MATERIALIZED' as const:'GATEWAY_RESOLVED' as const,
      derivedVersionStatus:id==='search-api'||id==='explorer'?'SUPERSEDED':'TRUSTED'})),
    dependencies:[{from:'dataset',to:'chunk',type:'DATA_FLOW'},{from:'chunk',to:'index',type:'DATA_FLOW'},
      {from:'index',to:'qa-api',type:'DATA_FLOW'},{from:'qa-api',to:'qa-app',type:'DATA_FLOW'},
      {from:'index',to:'search-api',type:'DATA_FLOW'},{from:'search-api',to:'explorer',type:'DATA_FLOW'}],
    protectedApps:[{id:'protected-qa',assetId:'qa-app',servedVersionId:r1}],
    regressions:[{id:'regression-material',protectedAppId:'protected-qa',oldVersionId:old,newVersionId:r1,result:'MATERIAL_CHANGE',status:'COMPLETE'}],
    trustedVersionId:r1,
  };
}
const asset=(graph:ReturnType<typeof buildBlastRadius>,id:string)=>graph.nodes.find(node=>node.id===`asset:${id}`)!;

describe('Packet 05 deterministic Blast Radius',()=>{
  it('traverses the real record dependency path and marks only the protected app IMPACTED',()=>{
    const graph=buildBlastRadius(fixture());
    expect(asset(graph,'dataset').impact).toBe('EXPOSED');
    expect(asset(graph,'index').impact).toBe('EXPOSED');
    expect(asset(graph,'qa-api').impact).toBe('EXPOSED');
    expect(asset(graph,'qa-app').impact).toBe('IMPACTED');
    expect(asset(graph,'qa-app').dependencyPaths[0]).toEqual(['source:sandbox','record:sandbox:HAD-4821','asset:dataset','asset:chunk','asset:index','asset:qa-api','asset:qa-app']);
    expect(asset(graph,'qa-app').regressionRunIds).toEqual(['regression-material']);
    expect(graph.counts).toEqual({exposed:4,stale:2,impacted:1});
  });
  it('does not infer impact from a source change, non-material, inconclusive or missing regression',()=>{
    for(const result of ['NON_MATERIAL_CHANGE','INCONCLUSIVE','NO_CHANGE']) {
      const input=fixture(); input.regressions[0].result=result;
      expect(asset(buildBlastRadius(input),'qa-app').impact).toBe('EXPOSED');
    }
    const input=fixture(); input.regressions=[];
    expect(asset(buildBlastRadius(input),'qa-app').regressionRunIds).toEqual([]);
    expect(asset(buildBlastRadius(input),'qa-app').impact).toBe('EXPOSED');
  });
  it('preserves frozen v13 lineage as STALE while gateway followers resolve to r1',()=>{
    const graph=buildBlastRadius(fixture());
    expect(asset(graph,'explorer')).toMatchObject({impact:'STALE',derivationMode:'MATERIALIZED',derivedFromVersionId:'v13'});
    expect(asset(graph,'chunk')).toMatchObject({impact:'EXPOSED',derivationMode:'GATEWAY_RESOLVED',derivedFromVersionId:'v14-r1'});
    expect(asset(graph,'qa-app')).toMatchObject({currentlyServesCandidate:true,servedVersionId:'v14-r1'});
  });
  it('keeps r2 distinct and exposes the mismatch in its historical regression baseline',()=>{
    const input=fixture();
    input.incident={...input.incident,id:'incident-r2',previousVersionId:'v14-r1',candidateVersionId:'v14-r2',status:'NEEDS_REVIEW',policyAction:'REVIEW'};
    input.regressions=[{id:'r2-evidence',protectedAppId:'protected-qa',oldVersionId:'v13',newVersionId:'v14-r2',result:'MATERIAL_CHANGE',status:'COMPLETE'}];
    const graph=buildBlastRadius(input);
    expect(graph.candidateVersionId).toBe('v14-r2');
    expect(graph.candidateServed).toBe(false);
    expect(asset(graph,'qa-app').impact).toBe('IMPACTED');
    expect(asset(graph,'qa-app').currentlyServesCandidate).toBe(false);
    expect(asset(graph,'qa-app').regressionEvidence[0].baselineMatchesIncident).toBe(false);
    expect(graph.traversalHash).not.toBe(buildBlastRadius(fixture()).traversalHash);
  });
  it('is stable across input order and duplicate edges, and terminates on a cycle',()=>{
    const base=buildBlastRadius(fixture());
    const shuffled=fixture();
    shuffled.assets.reverse(); shuffled.mappings.reverse(); shuffled.dependencies.reverse(); shuffled.regressions.reverse();
    shuffled.dependencies.push({...shuffled.dependencies[0]});
    expect(buildBlastRadius(shuffled).traversalHash).toBe(base.traversalHash);
    const cycle=fixture(); cycle.dependencies.push({from:'qa-app',to:'dataset',type:'DATA_FLOW'});
    const graph=buildBlastRadius(cycle);
    expect(graph.nodes.filter(node=>node.id==='asset:qa-app')).toHaveLength(1);
    expect(graph.edges.length).toBeLessThan(20);
  });
  it('validates the graph contract and preserves D-08 terminal failure progression',()=>{
    const graph=buildBlastRadius(fixture());
    expect(BlastRadius.safeParse({...graph,traversalStatus:'PERSISTED',history:[]}).success).toBe(true);
    const next=nextPendingStep([{step:'BLAST_RADIUS' as const,status:'FAILED'},{step:'POLICY' as const,status:'PENDING'}]);
    expect(next?.step).toBe('POLICY');
  });
});
