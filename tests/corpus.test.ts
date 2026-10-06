import {describe,it,expect,vi} from 'vitest';
import {CorpusHttp} from '../evaluation/corpus/http';
import counts from '../evaluation/corpus/quran-counts.json';
import {translationsListUrl,suraUrl} from '../lib/connectors/quranenc';
import {normalizeCorpus,rootsUrl} from '../evaluation/corpus/normalize';
import {encodeBundle,decodeBundle} from '../lib/connectors/http-bundle';
const response=(url:string,value:unknown)=>({url,status:200,body:Buffer.from(JSON.stringify(value))});
const root=[{id:'1',hadeeths_count:'2'}];
const pages=response('https://hadeethenc.com/api/v1/hadeeths/list/?language=ar&category_id=1&page=1&per_page=20',{meta:{current_page:'1',last_page:1,total_items:2,per_page:'20'},data:[{id:'2',translations:['ar','en']},{id:'1',translations:['ar']}]});
const raws=()=>[response(rootsUrl,root),pages,response('https://hadeethenc.com/api/v1/hadeeths/multiple/?language=ar&ids=1,2',[{id:2,hadeeth:'Synthetic Arabic test 2',reference:null},{id:1,hadeeth:'Synthetic Arabic test 1'}]),response('https://hadeethenc.com/api/v1/hadeeths/multiple/?language=en&ids=2',[{id:2,hadeeth:'Synthetic English test'}]),response(rootsUrl,root)];
describe('explicit corpus validation',()=>{
 it('deduplicates and orders identities, keeps nullable and unavailable translations unchanged',()=>{
  const payload=normalizeCorpus('hadeethenc',raws());expect(payload.records.map(r=>r.upstream_record_id)).toEqual(['1','2']);expect(payload.records[0].content.en).toBeUndefined();expect((payload.records[1].content.ar as any).reference).toBeNull();expect(payload.upstreamVersionLabel).toBe('unversioned');
 });
 it('rejects incomplete pages, missing details, catalog changes and duplicate identities',()=>{
  const missing=raws();missing.splice(3,1);expect(()=>normalizeCorpus('hadeethenc',missing)).toThrow('MISSING_LANGUAGE');
  const changed=raws();changed[4]=response(rootsUrl,[{id:'1',hadeeths_count:'3'}]);expect(()=>normalizeCorpus('hadeethenc',changed)).toThrow('CATALOG_CHANGED');
  const duplicate=raws();duplicate[2]=response(duplicate[2].url,[{id:1,hadeeth:'synthetic'},{id:1,hadeeth:'synthetic'}]);expect(()=>normalizeCorpus('hadeethenc',duplicate)).toThrow('DETAIL_IDENTITY_MISMATCH');
  const incomplete=raws();incomplete.splice(1,1);expect(()=>normalizeCorpus('hadeethenc',incomplete)).toThrow();
 });
 it('preserves exact response bytes and rejects tampered raw evidence',()=>{
  const raw=encodeBundle('hadeethenc-corpus/1',raws());expect(decodeBundle(raw).responses[2].body.equals(raws()[2].body)).toBe(true);
  const bundle=JSON.parse(raw.toString());bundle.responses[0].bodyBase64=Buffer.from('[]').toString('base64');expect(()=>decodeBundle(Buffer.from(JSON.stringify(bundle)))).toThrow();
 });
 it('retries only capacity/transient failures, honors retry-after and limits attempts',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response('',{status:429,headers:{'retry-after':'3'}})).mockResolvedValue(new Response('{}',{headers:{'content-type':'application/json'}}));const sleeps:number[]=[];
  const client=new CorpusHttp(fetcher,1000,async ms=>{sleeps.push(ms);});await client.get(rootsUrl);expect(client.stats).toMatchObject({requests:2,retries:1,quotaResponses:1});expect(sleeps[1]).toBeGreaterThanOrEqual(2990);
  const bad=vi.fn().mockResolvedValue(new Response('',{status:403}));await expect(new CorpusHttp(bad,0,async()=>{}).get(rootsUrl)).rejects.toThrow();expect(bad).toHaveBeenCalledTimes(1);
  const down=vi.fn().mockResolvedValue(new Response('',{status:503}));await expect(new CorpusHttp(down,0,async()=>{}).get(rootsUrl)).rejects.toThrow();expect(down).toHaveBeenCalledTimes(3);
 });
 it('rejects unofficial URLs without a network request',async()=>{const fetcher=vi.fn();await expect(new CorpusHttp(fetcher).get('https://example.com/api/v1/')).rejects.toThrow('UNOFFICIAL_URL');expect(fetcher).not.toHaveBeenCalled();});
});

it('validates all 114 QuranEnc surahs and rejects shifted/missing ayat',()=>{
 const catalog={translations:[{key:'english_saheeh',language_iso_code:'en',version:'test-1',last_update:0,title:'Synthetic transport test'}]};
 const responses=[response(translationsListUrl(),catalog),...Object.entries(counts).map(([sura,count])=>response(suraUrl(sura),{result:Array.from({length:count},(_,i)=>({id:`${sura}-${i+1}`,sura,aya:String(i+1),arabic_text:'Synthetic Arabic test placeholder',translation:'Synthetic translation placeholder'}))})),response(translationsListUrl(),catalog)];
 expect(normalizeCorpus('quranenc',responses).records).toHaveLength(6236);
 const broken=structuredClone(JSON.parse(responses[1].body.toString()));broken.result.pop();responses[1]=response(responses[1].url,broken);expect(()=>normalizeCorpus('quranenc',responses)).toThrow('QURAN_COUNT_MISMATCH');
});
it('queues concurrent callers with one request in flight',async()=>{
 let active=0,max=0;const starts:number[]=[];const fetcher=vi.fn(async()=>{active++;max=Math.max(max,active);starts.push(Date.now());await new Promise(r=>setTimeout(r,5));active--;return new Response('{}',{headers:{'content-type':'application/json'}});});
 const client=new CorpusHttp(fetcher,20);await Promise.all([client.get(rootsUrl),client.get(rootsUrl),client.get(rootsUrl)]);expect(max).toBe(1);expect(starts[2]-starts[0]).toBeGreaterThanOrEqual(35);
});
