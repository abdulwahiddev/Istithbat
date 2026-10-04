import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { prepareSnapshot } from '@/lib/hashing/snapshot';
import { canonicalJson, hashJson } from '@/lib/hashing/canonicalize';
import { diffPayloads } from '@/lib/diff/engine';
import { flagsForStrings, isEquivalent } from '@/lib/diff/flags';
import { classifyObservation } from '@/lib/ingestion/classify';
import { sandboxConnector } from '@/lib/connectors/sandbox';

const bytes=(name:string)=>readFileSync(`demo/synthetic-fixtures/had-4821.${name}.json`);
const snapshot=(name:string)=>prepareSnapshot(bytes(name));
const mutated=(change:(payload:any)=>void)=>{
  const payload=JSON.parse(bytes('v13').toString('utf8'));
  change(payload);
  return prepareSnapshot(Buffer.from(JSON.stringify(payload)));
};
const compare=(a:ReturnType<typeof snapshot>,b:ReturnType<typeof snapshot>)=>diffPayloads(a.payload,b.payload,sandboxConnector.fieldRoles);

describe('Packet 02 deterministic integrity',()=>{
  it('reproduces the persisted v13 raw and canonical hashes from exact fixture bytes',()=>{
    const first=snapshot('v13'),second=snapshot('v13');
    expect(first.rawSha256).toBe('9bc91d4e230c4941e7856b8d8a8eaa2dccbcd268e468be0848159f904b3981d6');
    expect(first.canonicalSha256).toBe('c9385758b78f3c9b79a7814bff85506c9f9dbff75e900e3e6f065ba3021249cf');
    expect(second.rawSha256).toBe(first.rawSha256);
    expect(second.canonicalSha256).toBe(first.canonicalSha256);
    expect(compare(first,second)).toEqual([]);
  });

  it('separates raw key-order changes from canonical equality and still flags a same-label mutation',()=>{
    const first=snapshot('v13');
    const reversed=JSON.parse(bytes('v13').toString('utf8'));
    const raw=Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(reversed).reverse())));
    const next=prepareSnapshot(raw);
    expect(next.rawSha256).not.toBe(first.rawSha256);
    expect(next.canonicalSha256).toBe(first.canonicalSha256);
    expect(compare(first,next)).toEqual([]);
    expect(classifyObservation({upstreamLabel:'v13',rawSha256:first.rawSha256,canonicalSha256:first.canonicalSha256},{upstreamLabel:'v13',rawSha256:next.rawSha256,canonicalSha256:next.canonicalSha256})).toEqual({status:'NEW_VERSION',silentMutation:true,changeClass:'SERIALIZATION_ONLY'});
  });

  it('sorts records by stable canonical_key but preserves other array order',()=>{
    const first=JSON.parse(bytes('v13').toString('utf8'));
    const second=structuredClone(first);
    const additional=structuredClone(first.records[0]);
    additional.canonical_key='HAD-4822';
    first.records.push(additional);
    second.records.unshift(additional);
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(canonicalJson(['a','b'])).not.toBe(canonicalJson(['b','a']));
  });

  it('keeps NFC-equivalent strings hash-distinct and marks them equivalent only in the diff',()=>{
    const old='إسناده صحيح',next='إسناده صحيح';
    expect(old.normalize('NFC')).toBe(next.normalize('NFC'));
    expect(hashJson(old)).not.toBe(hashJson(next));
    expect(flagsForStrings(old,next)).toEqual(['UNICODE_EQUIVALENT']);
    expect(isEquivalent(flagsForStrings(old,next))).toBe(true);
  });

  it('marks line breaks with unchanged tokens as whitespace-equivalent',()=>{
    expect(flagsForStrings('إسناده صحيح','  إسناده\nصحيح  ')).toEqual(['WHITESPACE_ONLY']);
    expect(isEquivalent(flagsForStrings('إسناده صحيح','إسناده\nصحيح'))).toBe(true);
  });

  it('does not erase a word boundary',()=>{
    expect(flagsForStrings('لا يجوز','لايجوز')).toEqual([]);
  });

  it('detects controlled Arabic haraka changes as substantive',()=>{
    expect(hashJson('خَلَقَ')).not.toBe(hashJson('خُلِقَ'));
    expect(flagsForStrings('خَلَقَ','خُلِقَ')).toEqual(['HARAKAT_ONLY']);
    expect(isEquivalent(flagsForStrings('خَلَقَ','خُلِقَ'))).toBe(false);
  });

  it('detects punctuation without treating it as equivalent',()=>{
    expect(hashJson('إسناده صحيح')).not.toBe(hashJson('إسناده، صحيح'));
    expect(flagsForStrings('إسناده صحيح','إسناده، صحيح')).toEqual(['PUNCTUATION_ONLY']);
    expect(isEquivalent(flagsForStrings('إسناده صحيح','إسناده، صحيح'))).toBe(false);
  });

  it('detects the exact v13 to v14 judgment change and all three hash layers',()=>{
    const old=snapshot('v13'),next=snapshot('v14');
    const changes=compare(old,next);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({canonicalKey:'HAD-4821',changeType:'FIELD_MODIFIED',fieldPath:'judgment',fieldRole:'SCHOLAR_JUDGMENT',oldValue:'إسناده صحيح',newValue:'صحيح',flags:[]});
    expect(old.canonicalSha256).not.toBe(next.canonicalSha256);
    expect(old.records[0].recordHash).not.toBe(next.records[0].recordHash);
    expect(old.records[0].fieldHashes.judgment).not.toBe(next.records[0].fieldHashes.judgment);
    expect(changes[0].oldFieldHash).toBe(old.records[0].fieldHashes.judgment);
    expect(changes[0].newFieldHash).toBe(next.records[0].fieldHashes.judgment);
    expect(classifyObservation({upstreamLabel:'v13',rawSha256:old.rawSha256,canonicalSha256:old.canonicalSha256},{upstreamLabel:'v14',rawSha256:next.rawSha256,canonicalSha256:next.canonicalSha256}).silentMutation).toBe(false);
  });

  it('detects v14-r2 as a same-label content mutation with the exact provenance diff',()=>{
    const old=snapshot('v14'),next=snapshot('v14-r2');
    expect(old.payload.upstreamVersionLabel).toBe(next.payload.upstreamVersionLabel);
    expect(old.payload.upstreamPublishedAt).toBe(next.payload.upstreamPublishedAt);
    expect(classifyObservation({upstreamLabel:'v14',rawSha256:old.rawSha256,canonicalSha256:old.canonicalSha256},{upstreamLabel:'v14',rawSha256:next.rawSha256,canonicalSha256:next.canonicalSha256}).silentMutation).toBe(true);
    expect(compare(old,next)).toMatchObject([{canonicalKey:'HAD-4821',fieldPath:'reference.page',fieldRole:'PROVENANCE',oldValue:12,newValue:13}]);
  });

  it('surfaces unmapped fields as UNCLASSIFIED',()=>{
    const old=snapshot('v13'),next=mutated(payload=>{payload.records[0].content.grade_note='synthetic unknown field';});
    expect(compare(old,next)).toMatchObject([{changeType:'FIELD_ADDED',fieldPath:'grade_note',fieldRole:'UNCLASSIFIED'}]);
  });

  it('does not lose unknown source and record properties outside content',()=>{
    const old=snapshot('v13');
    const next=mutated(payload=>{payload.extra_source='synthetic source metadata';payload.records[0].extra_record='synthetic record metadata';});
    expect(compare(old,next)).toMatchObject([
      {changeType:'FIELD_ADDED',fieldPath:'record.extra_record',fieldRole:'UNCLASSIFIED'},
      {changeType:'FIELD_ADDED',fieldPath:'source.extra_source',fieldRole:'UNCLASSIFIED'},
    ]);
  });

  it('handles reprocessing the identical snapshot as NO_CHANGE',()=>{
    const evidence=snapshot('v13');
    expect(classifyObservation({upstreamLabel:'v13',rawSha256:evidence.rawSha256,canonicalSha256:evidence.canonicalSha256},{upstreamLabel:'v13',rawSha256:evidence.rawSha256,canonicalSha256:evidence.canonicalSha256}).status).toBe('NO_CHANGE');
  });

  it('does not mutate historical evidence while comparing a later version',()=>{
    const old=snapshot('v13');
    const previousBytes=Buffer.from(old.rawBytes);
    compare(old,snapshot('v14'));
    expect(old.rawBytes).toEqual(previousBytes);
    expect(old.records[0].record.content.judgment).toBe('إسناده صحيح');
  });

  it('counts all declared roles for record additions and respects provider identity changes',()=>{
    const old=snapshot('v13');
    const extra=mutated(payload=>{const record=structuredClone(payload.records[0]);record.canonical_key='HAD-4822';payload.records.push(record);});
    const added=compare(old,extra);
    expect(added).toHaveLength(1);
    expect(added[0].changeType).toBe('RECORD_ADDED');
    expect(added[0].rolesPresent).toContain('AUTHORITATIVE_TEXT');
    expect(added[0].rolesPresent).toContain('SCHOLAR_JUDGMENT');
    const reidentified=mutated(payload=>{payload.records[0].upstream_record_id='different-provider-id';});
    expect(compare(old,reidentified).map(change=>change.changeType)).toEqual(['RECORD_DELETED','RECORD_ADDED']);
  });
});
