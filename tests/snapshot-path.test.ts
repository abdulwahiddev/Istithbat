import { describe, expect, it } from 'vitest';
import { snapshotPrefix } from '@/lib/ingestion/snapshot-path';

describe('immutable snapshot paths after demo reset',()=>{
  it('does not reuse a sandbox Storage path when revision numbers repeat',()=>{
    const first=snapshotPrefix('hadith-evidence-sandbox','v14',1,true);
    const second=snapshotPrefix('hadith-evidence-sandbox','v14',1,true);
    expect(first).toMatch(/^snapshots\/hadith-evidence-sandbox\/v14\/r1\/[0-9a-f-]{36}$/);
    expect(second).not.toBe(first);
  });
  it('preserves established paths for real connectors',()=>{
    expect(snapshotPrefix('hadeethenc','v14',1,false)).toBe('snapshots/hadeethenc/v14/r1');
  });
});
