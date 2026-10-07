import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({query:vi.fn(),upload:vi.fn(),transaction:vi.fn()}));
vi.mock('@/lib/db/client',()=>({getSql:()=>mocks.query}));
vi.mock('@/lib/server/storage',()=>({uploadImmutable:mocks.upload}));
import { resetDemo } from '@/lib/server/reset-demo';
import { SOURCE_DERIVED_SCENARIO as scenario } from '@/lib/contracts/sandbox-scenario';
import { POST as publish } from '@/app/api/sandbox/publish/route';
import { NextRequest } from 'next/server';
beforeEach(()=>{vi.clearAllMocks();mocks.query.mockResolvedValue([]);mocks.upload.mockResolvedValue(undefined);mocks.transaction.mockImplementation(async callback=>{
 const tx=Object.assign(vi.fn(async(strings:TemplateStringsArray)=>{
  const text=strings.join('?');
  if(text.includes('INSERT INTO source_versions'))return [{id:'new-baseline'}];
  if(text.includes('UPDATE sandbox_state'))return [{updated_at:'2026-10-07T00:00:00Z'}];
  return [];
 }),{json:(value:unknown)=>value});
 (mocks.transaction as any).tx=tx;
 return callback(tx);
});Object.assign(mocks.query,{begin:mocks.transaction});});
describe('explicit source-derived activation, isolated transaction seam only',()=>{
 it('uploads immutable evidence then creates a new baseline revision, source mapping and pinned question atomically without overwriting old evidence',async()=>{
  await resetDemo({scenario:scenario.id});
  expect(mocks.upload).toHaveBeenCalledTimes(2);
  expect(mocks.transaction).toHaveBeenCalledTimes(1);
  const tx=(mocks.transaction as any).tx;
  const text=tx.mock.calls.map((c:any[])=>c[0].join('?')).join('\n');
  const values=tx.mock.calls.flatMap((c:any[])=>c.slice(1));
  expect(text).toContain("COALESCE(MAX(revision_number),0)+1");
  expect(text).toContain("UPDATE source_versions SET status='SUPERSEDED'");
  expect(text).not.toContain('UPDATE records');expect(text).not.toContain('DELETE FROM audit_events');
  expect(text).toContain("upstream_version_label<>'v13'");
  expect(values).toContain(scenario.canonicalKey);expect(values).toContain(scenario.pinnedQuestion);expect(values).toContain(scenario.baselineFixture);
 });
 it('does not begin activation if immutable snapshot storage fails',async()=>{
  mocks.upload.mockRejectedValueOnce(new Error('SNAPSHOT_STORAGE_FAILED'));
  await expect(resetDemo({scenario:scenario.id})).rejects.toThrow('SNAPSHOT_STORAGE_FAILED');expect(mocks.transaction).not.toHaveBeenCalled();
 });
 it('reuses the existing source-derived baseline on repeated resets without requiring storage uploads',async()=>{
  mocks.query.mockResolvedValue([{id:'existing-baseline'}]);
  mocks.transaction.mockImplementation(async callback=>{
    const tx=Object.assign(vi.fn(async(strings:TemplateStringsArray)=>{
      const text=strings.join('?');
      if(text.includes('SELECT v.id FROM source_versions')) return [{id:'existing-baseline'}];
      if(text.includes('UPDATE sandbox_state')) return [{updated_at:'2026-10-07T00:00:00Z'}];
      return [];
    }),{json:(value:unknown)=>value});
    return callback(tx);
  });
  await resetDemo({scenario:scenario.id});
  await resetDemo({scenario:scenario.id});
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(mocks.transaction).toHaveBeenCalledTimes(2);
 });
 it('never accepts an unauthenticated candidate publication or activation',async()=>{
  const response=await publish(new NextRequest('https://example.test/api/sandbox/publish',{method:'POST',body:JSON.stringify({fixture:scenario.candidateFixture}),headers:{'content-type':'application/json'}}));
  expect(response.status).toBe(401);expect(mocks.query).not.toHaveBeenCalled();expect(mocks.upload).not.toHaveBeenCalled();
 });
});
