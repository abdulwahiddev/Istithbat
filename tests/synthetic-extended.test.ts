import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {prepareSnapshot} from '../lib/hashing/snapshot';
import {diffPayloads} from '../lib/diff/engine';
import {sandboxConnector} from '../lib/connectors/sandbox';
import {classifyObservation} from '../lib/ingestion/classify';
import {evaluatePolicy} from '../lib/policy/rules';
import {isEquivalent} from '../lib/diff/flags';
const snapshot=(name:string)=>prepareSnapshot(readFileSync(`evaluation/synthetic-extended/${name}.json`));
const baseline=snapshot('base');
for(const name of ['long-judgment','translation','provenance','punctuation','harakat','multiple-fields','multiline']) it(`detects synthetic ${name} without altering upstream evidence`,()=>{
 const candidate=snapshot(name);expect(candidate.payload.metadata?.synthetic).toBe(true);expect(candidate.payload.records.every(r=>r.metadata.synthetic===true)).toBe(true);
 expect(classifyObservation({upstreamLabel:baseline.payload.upstreamVersionLabel,rawSha256:baseline.rawSha256,canonicalSha256:baseline.canonicalSha256},{upstreamLabel:candidate.payload.upstreamVersionLabel,rawSha256:candidate.rawSha256,canonicalSha256:candidate.canonicalSha256})).toMatchObject({status:'NEW_VERSION',silentMutation:true});
 const changes=diffPayloads(baseline.payload,candidate.payload,sandboxConnector.fieldRoles);expect(changes.length).toBeGreaterThan(0);expect(candidate.canonicalSha256).not.toBe(baseline.canonicalSha256);expect(changes.every(c=>c.oldFieldHash!==c.newFieldHash)).toBe(true);
 if(name==='harakat'||name==='punctuation') {expect(changes[0].flags).toContain(name==='harakat'?'HARAKAT_ONLY':'PUNCTUATION_ONLY');expect(isEquivalent(changes[0].flags)).toBe(false);}
 const policy=evaluatePolicy({sourceType:'SANDBOX',contentLevel:'A',silentMutation:true,serializationOnly:false,changes,advisory:{analysisTypes:[],maxRiskLevel:null,meaningChanged:false,recommendedAction:'ALLOW',materialChangeDetected:false,aiFailed:false,regressionFailed:false}});
 if(['long-judgment','punctuation','harakat','multiple-fields'].includes(name)) expect(policy.action).toBe('QUARANTINE');
 if(name==='provenance') expect(policy.action).toBe('REVIEW');
 if(name==='multiline') expect(policy.action).toBe('ALLOW');
 if(name==='long-judgment') expect(changes[0].fieldRole).toBe('SCHOLAR_JUDGMENT');
 if(name==='translation') expect(changes[0].fieldRole).toBe('TRANSLATION');
 if(name==='provenance') expect(changes.every(c=>c.fieldRole==='PROVENANCE')).toBe(true);
 if(name==='multiple-fields') expect(new Set(changes.map(c=>c.fieldRole)).size).toBe(3);
 expect(diffPayloads(candidate.payload,snapshot(name).payload,sandboxConnector.fieldRoles)).toEqual([]);
});
