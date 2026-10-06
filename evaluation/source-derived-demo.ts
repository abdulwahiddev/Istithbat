/** Explicit local-only preflight: no database, Storage, source publish, or trust write. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateStructured, IncidentAnalysisSchema, QaAnswerSchema, BehaviorDeltaSchema, RegressionQuestionsSchema } from '../lib/ai';
import { prepareSnapshot } from '../lib/hashing/snapshot';
import { diffPayloads } from '../lib/diff/engine';
import { hadeethencConnector } from '../lib/connectors/hadeethenc';
import { makeContextPacket } from '../lib/analysis/context';
import { qaConfig, assertQaMeta, assertSideMatch } from '../lib/regression/config';
import { PINNED_CONFIG, LEXICAL_CONFIG, rankRecords } from '../lib/regression/retrieve';
import { hashJson, sha256, type JsonValue } from '../lib/hashing/canonicalize';
import { SOURCE_DERIVED_SCENARIO } from '../lib/contracts/sandbox-scenario';
import { evaluatePolicy } from '../lib/policy/rules';
const args=process.argv.slice(2);
if (!args.includes('--live') || process.env.AI_MODE!=='live') throw new Error('Explicit --live and AI_MODE=live required; no mock result accepted');
const out=resolve(args.includes('--out')?args[args.indexOf('--out')+1]:'private-data/source-derived-demo/preflight.json');
const base=prepareSnapshot(await readFile('demo/source-derived/hadeethenc-10618.v13.json'));
const candidate=prepareSnapshot(await readFile('demo/source-derived/hadeethenc-10618.v14.json'));
const changes=diffPayloads(base.payload,candidate.payload,hadeethencConnector.definition.fieldRoles);
if(changes.length!==1||changes[0].fieldPath!=='ar.grade'||changes[0].fieldRole!=='SCHOLAR_JUDGMENT')throw new Error('Unexpected fixture mutation');
const question=SOURCE_DERIVED_SCENARIO.pinnedQuestion;
const source={id:'hadith-evidence-sandbox',name:'HadeethEnc 10618 — controlled integrity test',provider:'Istithbat controlled simulator; original record provenance HadeethEnc.com',source_type:'HADITH_EVIDENCE',content_level:'A',synthetic:true};
const version=(snap:typeof base,id:string)=>({id,label:snap.payload.upstreamVersionLabel!,revision:1,upstream_published_at:snap.payload.upstreamPublishedAt??null,raw_sha256:snap.rawSha256,canonical_sha256:snap.canonicalSha256});
const packet=makeContextPacket({source,candidate:{...version(candidate,'local-candidate'),silent_mutation:false},previous:version(base,'local-baseline'),trusted:{id:'local-baseline',label:'v13',revision:1},primary_change_id:'local-grade-change',changes:changes.map(c=>({id:'local-grade-change',canonical_key:c.canonicalKey,change_type:c.changeType,field_path:c.fieldPath,field_role:c.fieldRole,old_value:c.oldValue,new_value:c.newValue,old_field_hash:c.oldFieldHash,new_field_hash:c.newFieldHash,flags:c.flags,roles_present:c.rolesPresent??[]})),records:[{canonical_key:base.payload.records[0].canonical_key,old_content:base.payload.records[0].content,new_content:candidate.payload.records[0].content,old_metadata:base.payload.records[0].metadata,new_metadata:candidate.payload.records[0].metadata}]});
const report:Record<string,any>={scope:'Local live AI preflight; no persistence or Production mutation',startedAt:new Date().toISOString(),question,changes,analysis:null,generatedQuestions:null,pairs:[],policy:null,executionComplete:false};
await mkdir(resolve(out,'..'),{recursive:true});
await writeFile(out,JSON.stringify(report)+'\n',{mode:0o600,flag:'wx'});
const save=()=>writeFile(out,JSON.stringify(report,null,2)+'\n',{mode:0o600});
const pause=()=>new Promise(r=>setTimeout(r,10_000));
const inherited=args.includes('--generated-only') ? JSON.parse(await readFile(args[args.indexOf('--from')+1],'utf8')) : null;
if(inherited) {report.analysis=inherited.analysis;report.generatedQuestions=inherited.generatedQuestions;}
else {await pause();report.analysis=await generateStructured({task:'INCIDENT_ANALYSIS',schema:IncidentAnalysisSchema,input:packet,promptVersion:'v1'});await save();}
console.log(JSON.stringify({stage:'analysis',ok:report.analysis.ok,data:report.analysis.data??null}));
if(!report.analysis.ok) process.exitCode=1;
else if (!args.includes('--analysis-only')) {
 if(!inherited) {await pause();report.generatedQuestions=await generateStructured({task:'REGRESSION_QUESTIONS',schema:RegressionQuestionsSchema,input:{change:{canonical_key:changes[0].canonicalKey,field_path:changes[0].fieldPath,field_role:changes[0].fieldRole,old_value:changes[0].oldValue,new_value:changes[0].newValue,change_type:changes[0].changeType},pinned_questions:[question],needed:2},promptVersion:'v1'});await save();}
 const questions=inherited ? inherited.generatedQuestions.data.questions.map((q:{question:string})=>q.question) : [question,question,question];
 for(let trial=0;trial<questions.length;trial++) {
  const question=questions[trial];
  const config=qaConfig(inherited?LEXICAL_CONFIG:PINNED_CONFIG);
  const qaInput=(snapshot:typeof base,id:string)=>({question,knowledge_version:{id,label:snapshot.payload.upstreamVersionLabel,revision:1},retrieved_records:(inherited?rankRecords(snapshot.records.map(r=>({source_id:source.id,source_version_id:id,canonical_key:r.record.canonical_key,content:r.record.content,metadata:r.record.metadata,record_hash:r.recordHash})),question):snapshot.records.map(r=>({canonical_key:r.record.canonical_key,content:r.record.content,metadata:r.record.metadata,record_hash:r.recordHash}))).map(r=>({canonical_key:r.canonical_key,content:r.content,metadata:r.metadata,record_hash:r.record_hash}))});
  await pause();const old=await generateStructured({task:'QA_ANSWER',schema:QaAnswerSchema,input:qaInput(base,'local-baseline'),promptVersion:config.prompt_version});
  const pair:Record<string,any>={trial:trial+1,question,origin:inherited?'generated':'pinned',config,old,new:null,comparison:null};report.pairs.push(pair);await save();
  if(!old.ok){process.exitCode=1;break;}assertQaMeta(old.meta,config);
  await pause();const current=await generateStructured({task:'QA_ANSWER',schema:QaAnswerSchema,input:qaInput(candidate,'local-candidate'),promptVersion:config.prompt_version});pair.new=current;await save();
  if(!current.ok){process.exitCode=1;break;}assertQaMeta(current.meta,config);assertSideMatch(old.meta,current.meta);
  const deterministic={old_answer_sha256:sha256(old.data.answer),new_answer_sha256:sha256(current.data.answer),answer_text_changed:old.data.answer!==current.data.answer,normalized_text_changed:old.data.answer.replace(/\s+/gu,' ').trim()!==current.data.answer.replace(/\s+/gu,' ').trim(),cited_keys_changed:hashJson(old.data.cited_record_keys as JsonValue)!==hashJson(current.data.cited_record_keys as JsonValue),structured_output_changed:hashJson(old.data as JsonValue)!==hashJson(current.data as JsonValue),base_record_hashes:base.records.map(r=>r.recordHash),candidate_record_hashes:candidate.records.map(r=>r.recordHash)};
  await pause();pair.comparison=await generateStructured({task:'BEHAVIOR_DELTA',schema:BehaviorDeltaSchema,input:{question,old_answer:old.data.answer,new_answer:current.data.answer,old_output:old.data,new_output:current.data,deterministic,source_id:source.id,canonical_key:base.payload.records[0].canonical_key},promptVersion:'v1'});await save();
  console.log(JSON.stringify({trial:trial+1,old:old.data.answer,new:current.data.answer,comparison:pair.comparison.data??pair.comparison.reason}));
  if(!pair.comparison.ok){process.exitCode=1;break;}
 }
 const a=report.analysis.data;report.policy=evaluatePolicy({sourceType:'HADITH_EVIDENCE',contentLevel:'A',silentMutation:false,serializationOnly:false,changes,advisory:{analysisTypes:[a.analysis_type],maxRiskLevel:a.risk_level,meaningChanged:a.meaning_changed,recommendedAction:a.recommended_action,materialChangeDetected:report.pairs.some((p:any)=>p.comparison?.data?.material_change),aiFailed:false,regressionFailed:report.pairs.some((p:any)=>!p.comparison?.ok)}});
 report.executionComplete=report.generatedQuestions.ok&&report.pairs.length===(inherited?2:3)&&report.pairs.every((p:any)=>p.comparison?.ok)&&report.policy.policyCode==='POL-002'&&report.policy.action==='QUARANTINE';
 if(!report.executionComplete)process.exitCode=1;
}
report.completedAt=new Date().toISOString();await save();console.log(JSON.stringify({executionComplete:report.executionComplete,requiresHumanQualityReview:true,policy:report.policy?.policyCode}));
