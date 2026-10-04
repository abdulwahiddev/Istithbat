import { loadMutationFixtures } from '@/lib/evaluation/harness';
import { measureMutations } from '@/lib/evaluation/metrics';

const args=process.argv.slice(2);
const suiteIndex=args.indexOf('--suite');
const suite=suiteIndex<0?'mutations':args[suiteIndex+1];
if(suite!=='mutations') throw new Error('The safety suite belongs to Packet 04');
const fixtures=loadMutationFixtures();
if(fixtures.length!==40) throw new Error(`Expected 40 mutation fixtures, found ${fixtures.length}`);
const ids=new Set(fixtures.map(fixture=>fixture.id));
if(ids.size!==40) throw new Error('Duplicate mutation fixture IDs');
const results=measureMutations(fixtures);
console.log(JSON.stringify(results,null,2));
if(results.fixturePasses!==40) process.exitCode=1;
