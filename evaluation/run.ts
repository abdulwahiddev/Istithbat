import { loadMutationFixtures } from '@/lib/evaluation/harness';
import { measureMutations } from '@/lib/evaluation/metrics';
import { measureAiRegressions, measureSafety, type EvalMode } from '@/lib/evaluation/ai';

const args=process.argv.slice(2);
const suiteIndex=args.indexOf('--suite');
const suite=suiteIndex<0?'mutations':args[suiteIndex+1];
if(suite!=='mutations'&&suite!=='safety') throw new Error('Expected --suite mutations|safety');
const aiIndex=args.indexOf('--ai');
const aiMode=aiIndex<0?null:args[aiIndex+1] as EvalMode;
if(aiMode!==null&&!['mock','live','replay'].includes(aiMode)) throw new Error('Expected --ai live|mock|replay');
if(suite==='safety') {
  const result=await measureSafety(aiMode??'mock');
  console.log(JSON.stringify(result,null,2));
  if(result.plumbing.validOutputs!==12) process.exitCode=1;
} else {
const fixtures=loadMutationFixtures();
if(fixtures.length!==40) throw new Error(`Expected 40 mutation fixtures, found ${fixtures.length}`);
const ids=new Set(fixtures.map(fixture=>fixture.id));
if(ids.size!==40) throw new Error('Duplicate mutation fixture IDs');
const results=measureMutations(fixtures);
console.log(JSON.stringify(results,null,2));
if(results.fixturePasses!==40) process.exitCode=1;
if(aiMode) {
  const ai=await measureAiRegressions(fixtures,aiMode);
  console.log(JSON.stringify(ai,null,2));
  if(ai.plumbing.analysisSucceeded!==40||ai.plumbing.qaPairsSucceeded!==40||ai.plumbing.comparisonsSucceeded!==40) process.exitCode=1;
}
}
