import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getSql } from '@/lib/db/client';
import { SANDBOX_FIXTURES } from '@/lib/contracts/sandbox-scenario';
const live=process.env.ISTITHBAT_LIVE_DB_TEST==='1';
const rollback=new Error('ROLLBACK_SOURCE_DERIVED_FIXTURE');
describe.skipIf(!live)('source-derived fixture database compatibility',()=>{
 it('accepts every declared fixture while still rejecting undeclared names',async()=>{
  await expect(getSql().begin(async tx=>{
   const id=`test-fixtures-${randomUUID()}`;
   await tx`INSERT INTO sources (id,name,provider,source_type,connector_type,endpoint,content_level) VALUES (${id},'Fixture validation','Istithbat','SANDBOX','TEST','https://example.invalid','A')`;
   await tx`INSERT INTO sandbox_state (source_id,fixture_name) VALUES (${id},${SANDBOX_FIXTURES[0]})`;
   for(const fixture of SANDBOX_FIXTURES){
    await tx`UPDATE sandbox_state SET fixture_name=${fixture} WHERE source_id=${id}`;
    expect((await tx`SELECT fixture_name FROM sandbox_state WHERE source_id=${id}`)[0].fixture_name).toBe(fixture);
   }
   await expect(tx.savepoint(async scoped=>{
    await scoped`UPDATE sandbox_state SET fixture_name='undeclared.json' WHERE source_id=${id}`;
   })).rejects.toMatchObject({code:'23514',constraint_name:'sandbox_state_fixture_name_check'});
   throw rollback;
  })).rejects.toBe(rollback);
 });
});
