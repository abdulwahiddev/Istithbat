import {z} from 'zod';
import type {JsonValue} from '../../lib/hashing/canonicalize';
import quranCounts from './quran-counts.json';
import { createQuranencConnector, translationsListUrl, suraUrl } from '../../lib/connectors/quranenc';
import { type NormalizedPayload } from '../../lib/connectors/http-connector';
import { HADEETHENC_API } from '../../lib/connectors/hadeethenc';
export const rootsUrl = `${HADEETHENC_API}/categories/roots/?language=ar`;
export const surahs = Array.from({length:114},(_,i)=>String(i+1));
export type Raw = {url:string;status:number;body:Buffer};
const json = (r:Raw) => JSON.parse(r.body.toString('utf8'));
const identity=z.union([z.string().regex(/^\d+$/),z.number().int().positive()]).transform(String);
const rootCatalog=z.array(z.object({id:identity,hadeeths_count:z.coerce.number().int().nonnegative()})).min(1);
const pageSchema=z.object({meta:z.object({current_page:z.coerce.number().int().positive(),last_page:z.coerce.number().int().positive(),total_items:z.coerce.number().int().nonnegative(),per_page:z.coerce.number().int().positive()}),data:z.array(z.object({id:identity,translations:z.array(z.string().min(1))}))});
export function normalizeCorpus(source:string, responses:Raw[]):NormalizedPayload {
  if(responses.some(r=>r.status!==200)) throw new Error('NON_SUCCESS_EVIDENCE');
  if(source==='quranenc') {
    if(responses.length!==116 || surahs.some(sura=>responses.filter(r=>r.url===suraUrl(sura)).length!==1)) throw new Error('RESPONSE_SCOPE_MISMATCH');
    const catalogs=responses.filter(r=>r.url===translationsListUrl());
    if(catalogs.length!==2 || JSON.stringify(json(catalogs[0]))!==JSON.stringify(json(catalogs[1]))) throw new Error('CATALOG_CHANGED');
    const payload=createQuranencConnector(surahs).normalize(responses);
    if(payload.records.length!==6236) throw new Error('QURAN_COUNT_MISMATCH');
    const ids=new Set<string>();
    for(const sura of surahs) {
      const records=payload.records.filter(r=>r.content.sura===sura);
      if(records.length!==quranCounts[sura as keyof typeof quranCounts]) throw new Error('SURAH_COUNT_MISMATCH');
      records.forEach((r,i)=>{if(r.content.aya!==String(i+1)||ids.has(r.upstream_record_id)) throw new Error('AYAH_IDENTITY_MISMATCH');ids.add(r.upstream_record_id);});
    }
    return payload;
  }
  if(source!=='hadeethenc') throw new Error('UNKNOWN_SOURCE');
  if(responses.some(r=>{const url=new URL(r.url);return url.origin!=='https://hadeethenc.com'||!['/api/v1/categories/roots/','/api/v1/hadeeths/list/','/api/v1/hadeeths/multiple/'].includes(url.pathname);})) throw new Error('RESPONSE_SCOPE_MISMATCH');
  const roots=responses.filter(r=>r.url===rootsUrl);
  if(roots.length!==2 || JSON.stringify(json(roots[0]))!==JSON.stringify(json(roots[1]))) throw new Error('CATALOG_CHANGED');
  const membership=catalogMembership(responses);
  const records=[...membership.keys()].sort((a,b)=>Number(a)-Number(b)).map(id=>({canonical_key:`hadeethenc:${id}`,upstream_record_id:id,content:{} as Record<string,JsonValue>,metadata:{synthetic:false,provider:'HadeethEnc.com',hadeeth_id:id,languages:[] as string[],source_urls:{} as Record<string,string>}}));
  const index=new Map(records.map(r=>[r.upstream_record_id,r]));
  for(const response of responses.filter(r=>r.url.includes('/hadeeths/multiple/'))) {
    const url=new URL(response.url);const language=url.searchParams.get('language')!;if(!['ar','en'].includes(language)) throw new Error('UNSUPPORTED_LANGUAGE');const expected=url.searchParams.get('ids')!.split(',');const body=json(response);
    if(!Array.isArray(body)||body.length!==expected.length) throw new Error('DETAIL_COUNT_MISMATCH');
    const seen=new Set<string>();
    for(const item of body) {
      const id=String(item.id);const record=index.get(id);
      if(!expected.includes(id)||seen.has(id)||!record||typeof item.hadeeth!=='string'||!item.hadeeth.length||record.content[language]) throw new Error('DETAIL_IDENTITY_MISMATCH');
      if(language==='en'&&!membership.get(id)!.has('en')) throw new Error('UNADVERTISED_LANGUAGE');
      seen.add(id);record.content[language]=item;record.metadata.languages.push(language);record.metadata.source_urls[language]=response.url;
    }
  }
  for(const record of records) if(!record.content.ar || (membership.get(record.upstream_record_id)!.has('en')&&!record.content.en)) throw new Error('MISSING_LANGUAGE');
  if(!records.length) throw new Error('EMPTY_CORPUS');
  return {upstreamVersionLabel:'unversioned',records,metadata:{synthetic:false,provider:'HadeethEnc.com',api:HADEETHENC_API,connector:'hadeethenc-corpus/1',scope:'Union of official Arabic root-category catalogs; Arabic plus available English translations',terms:'No modification, addition or deletion; clearly credit HadeethEnc.com and publisher. Private evidence only.'}};
}

/** Validate the complete discovery before requesting any detail batches. */
export function catalogMembership(responses:Raw[]):Map<string,Set<string>> {
  const membership=new Map<string,Set<string>>();
  const categories=corpusRoots(json(responses.find(r=>r.url===rootsUrl)!));
  for(const root of categories) {
    const pages=responses.filter(r=>new URL(r.url).searchParams.get('category_id')===String(root.id));
    if(root.hadeeths_count===0 && !pages.length) continue;
    if(!pages.length) throw new Error('MISSING_CATEGORY_PAGES');
    const first=pageSchema.parse(json(pages[0])); const total=Number(first.meta.total_items); const last=Number(first.meta.last_page);
    if(total!==Number(root.hadeeths_count)||pages.length!==last) throw new Error('CATEGORY_COUNT_MISMATCH');
    const seen=new Set<string>();
    pages.forEach((page,i)=>{
      const value=pageSchema.parse(json(page));
      if(Number(value.meta.current_page)!==i+1||Number(value.meta.total_items)!==total||Number(value.meta.last_page)!==last||Number(value.meta.per_page)!==20) throw new Error('PAGE_METADATA_MISMATCH');
      for(const item of value.data) {
        const id=String(item.id); if(seen.has(id)) throw new Error('DUPLICATE_CATEGORY_ID'); seen.add(id);
        const languages=new Set<string>(item.translations);
        if(membership.has(id)&&JSON.stringify([...membership.get(id)!].sort())!==JSON.stringify([...languages].sort())) throw new Error('LANGUAGE_CATALOG_CHANGED');
        membership.set(id,languages);
      }
    });
    if(seen.size!==total) throw new Error('CATEGORY_COUNT_MISMATCH');
  }
  return membership;
}

export function corpusRoots(value:unknown) {
  const categories=rootCatalog.parse(value);
  if(new Set(categories.map(r=>r.id)).size!==categories.length) throw new Error('DUPLICATE_ROOT_ID');
  return categories;
}
