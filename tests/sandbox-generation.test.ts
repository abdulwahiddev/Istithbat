import { describe, expect, it, vi } from 'vitest';
import { fixtureBytes } from '@/lib/connectors/sandbox';

const mocks=vi.hoisted(()=>({query:vi.fn(),fetch:vi.fn()}));
vi.mock('@/lib/db/client',()=>({getSql:()=>mocks.query}));
vi.mock('@/lib/connectors/fetch',()=>({fetchSourceSnapshot:mocks.fetch}));
import { checkSource } from '@/lib/ingestion/check-source';

describe('sandbox reset generation boundary',()=>{
  it('rejects a webhook fetched before reset without creating a version or changing source health',async()=>{
    const statements:string[]=[];
    mocks.query.mockImplementation(async(parts:TemplateStringsArray)=>{
      const statement=parts.join('?');statements.push(statement);
      if(statement.includes('FROM sources s LEFT JOIN sandbox_state'))
        return [{endpoint:'sandbox://current',is_demo_fixture:true,sandbox_generation:'old-generation'}];
      if(statement.includes('FROM sources WHERE id=')) return [{id:'hadith-evidence-sandbox'}];
      if(statement.includes('FROM sandbox_state WHERE source_id=')) return [{sandbox_generation:'new-generation'}];
      return [];
    });
    Object.assign(mocks.query,{begin:async(callback:(tx:unknown)=>Promise<unknown>)=>callback(mocks.query)});
    mocks.fetch.mockResolvedValue(fixtureBytes('hadeethenc-10618.v14.json'));
    await expect(checkSource('hadith-evidence-sandbox','WEBHOOK','https://example.test')).rejects.toThrow('SANDBOX_GENERATION_CHANGED');
    expect(statements.some(statement=>statement.includes('INSERT INTO source_versions'))).toBe(false);
    expect(statements.some(statement=>statement.includes('INSERT INTO source_checks'))).toBe(false);
    expect(statements.some(statement=>statement.includes('UPDATE sources SET'))).toBe(false);
  });
});
