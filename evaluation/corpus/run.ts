import {mkdir,writeFile,readFile,appendFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {CorpusHttp} from './http';
import {normalizeCorpus,catalogMembership,corpusRoots,rootsUrl,surahs,type Raw} from './normalize';
import {translationsListUrl,suraUrl} from '../../lib/connectors/quranenc';
import {HADEETHENC_API} from '../../lib/connectors/hadeethenc';
import {encodeBundle,decodeBundle} from '../../lib/connectors/http-bundle';
import {prepareSnapshot} from '../../lib/hashing/snapshot';
import {diffPayloads} from '../../lib/diff/engine';
import {hadeethencConnector} from '../../lib/connectors/hadeethenc';
import {quranencConnector} from '../../lib/connectors/quranenc';
import {sha256} from '../../lib/hashing/canonicalize';
const args=process.argv.slice(2);const option=(name:string)=>args[args.indexOf(name)+1];
const output=resolve(args.includes('--out')?option('--out'):`private-data/corpus-runs/${new Date().toISOString().replaceAll(':','-')}`);
async function save(file:string,data:Buffer|string) {await writeFile(file,data,{mode:0o600,flag:'wx'});}
function evidence(source:string,raw:Buffer) {
  const decoded=decodeBundle(raw);if(decoded.connector!==`${source}-corpus/1`) throw new Error('CONNECTOR_MISMATCH');
  const start=performance.now();const snapshot=prepareSnapshot(Buffer.from(JSON.stringify(normalizeCorpus(source,decoded.responses))));
  const hashes=snapshot.records.map(r=>({key:r.record.canonical_key,hash:r.recordHash,fields:r.fieldHashes}));
  return {snapshot,hashes,hashMs:performance.now()-start,rawSha256:sha256(raw)};
}
async function pass(source:string,dir:string) {
  await mkdir(dir,{recursive:true,mode:0o700});const client=new CorpusHttp();const responses:Raw[]=[];const start=performance.now();
  async function get(url:string) {const raw=await client.get(url);responses.push(raw);const file=`response-${String(responses.length).padStart(4,'0')}.json`;await save(join(dir,file),raw.body);await appendFile(join(dir,'response-index.jsonl'),JSON.stringify({url,status:raw.status,file,sha256:sha256(raw.body)})+'\n',{mode:0o600});if(responses.length%25===0) console.log(`${source}: ${responses.length} successful requests`);return JSON.parse(raw.body.toString('utf8'));}
  try {
    if(source==='quranenc') {await get(translationsListUrl());for(const sura of surahs) await get(suraUrl(sura));await get(translationsListUrl());}
    else {
      const roots=corpusRoots(await get(rootsUrl));roots.sort((a,b)=>Number(a.id)-Number(b.id));
      for(const root of roots) {
        if(Number(root.hadeeths_count)===0) continue;
        let last=1;
        for(let page=1;page<=last;page++) {
          const value=await get(`${HADEETHENC_API}/hadeeths/list/?language=ar&category_id=${root.id}&page=${page}&per_page=20`);
          last=Number(value.meta.last_page);if(!Number.isInteger(last)||last<1||last>1000||last!==Math.ceil(root.hadeeths_count/20)||Number(value.meta.current_page)!==page||Number(value.meta.total_items)!==root.hadeeths_count||Number(value.meta.per_page)!==20) throw new Error('INVALID_PAGE_BOUND');
        }
      }
      const validated=catalogMembership(responses);
      for(const language of ['ar','en']) {
        const selected=[...validated.keys()].filter(id=>language==='ar'||validated.get(id)!.has(language)).sort((a,b)=>Number(a)-Number(b));
        for(let offset=0;offset<selected.length;offset+=20) await get(`${HADEETHENC_API}/hadeeths/multiple/?language=${language}&ids=${selected.slice(offset,offset+20).join(',')}`);
      }
      await get(rootsUrl);
    }
    const bundle=encodeBundle(`${source}-corpus/1`,responses);await save(join(dir,'raw-bundle.json'),bundle);
    const result=evidence(source,bundle);await save(join(dir,'canonical.json'),result.snapshot.canonicalBytes);await save(join(dir,'hashes.json'),JSON.stringify(result.hashes));
    const diffStart=performance.now();const changes=diffPayloads(result.snapshot.payload,result.snapshot.payload,(source==='quranenc'?quranencConnector:hadeethencConnector).definition.fieldRoles);const noChangeDiffMs=performance.now()-diffStart;if(changes.length) throw new Error('NONDETERMINISTIC_DIFF');
    const summary={noChangeDiffMs,source,complete:true,imported:false,trust:'UNASSESSED',records:result.hashes.length,upstreamVersion:result.snapshot.payload.upstreamVersionLabel,attribution:result.snapshot.payload.metadata,fetchSeconds:(performance.now()-start)/1000,hashMs:result.hashMs,rawSha256:result.rawSha256,canonicalSha256:result.snapshot.canonicalSha256,rawBundleBytes:bundle.length,canonicalBytes:result.snapshot.canonicalBytes.length,hashArtifactBytes:Buffer.byteLength(JSON.stringify(result.hashes)),...client.stats};
    await save(join(dir,'summary.json'),JSON.stringify(summary,null,2));return summary;
  } catch(error) {await save(join(dir,'failure.json'),JSON.stringify({complete:false,source,successfulResponses:responses.length,stats:client.stats,error:String(error)},null,2));throw error;}
}
if(args.includes('--verify')) {
  const dir=resolve(option('--verify'));const summary=JSON.parse(await readFile(join(dir,'summary.json'),'utf8'));const result=evidence(summary.source,await readFile(join(dir,'raw-bundle.json')));
  if(summary.complete!==true||summary.records!==result.hashes.length||result.rawSha256!==summary.rawSha256||result.snapshot.canonicalSha256!==summary.canonicalSha256||JSON.stringify(result.hashes)!==await readFile(join(dir,'hashes.json'),'utf8')||!result.snapshot.canonicalBytes.equals(await readFile(join(dir,'canonical.json')))) throw new Error('ARTIFACT_MISMATCH');
  const start=performance.now();const changes=diffPayloads(result.snapshot.payload,result.snapshot.payload,(summary.source==='quranenc'?quranencConnector:hadeethencConnector).definition.fieldRoles);if(changes.length) throw new Error('NONDETERMINISTIC_DIFF');
  console.log(JSON.stringify({verified:true,records:result.hashes.length,normalizeAndHashMs:result.hashMs,noChangeDiffMs:performance.now()-start}));
} else {
  const source=args.includes('--source')?option('--source'):'all';if(!['all','quranenc','hadeethenc'].includes(source)) throw new Error('UNKNOWN_SOURCE');
  await mkdir(output,{recursive:true,mode:0o700});
  for(const selected of source==='all'?['quranenc','hadeethenc']:[source]) {
    const first=await pass(selected,join(output,selected,'pass-1'));await new Promise(r=>setTimeout(r,1000));const second=await pass(selected,join(output,selected,'pass-2'));
    const firstHashes=JSON.parse(await readFile(join(output,selected,'pass-1','hashes.json'),'utf8')) as Array<{key:string;hash:string}>;const secondHashes=JSON.parse(await readFile(join(output,selected,'pass-2','hashes.json'),'utf8')) as Array<{key:string;hash:string}>;const a=new Map(firstHashes.map(r=>[r.key,r.hash]));const b=new Map(secondHashes.map(r=>[r.key,r.hash]));
    const comparison={addedKeys:[...b.keys()].filter(k=>!a.has(k)),removedKeys:[...a.keys()].filter(k=>!b.has(k)),changedKeys:[...a.keys()].filter(k=>b.has(k)&&a.get(k)!==b.get(k)),source:selected,first,second,repeat:{recordCountEqual:first.records===second.records,rawEqual:first.rawSha256===second.rawSha256,canonicalEqual:first.canonicalSha256===second.canonicalSha256}};
    await save(join(output,`${selected}-comparison.json`),JSON.stringify(comparison,null,2));console.log(JSON.stringify(comparison));
  }
}
