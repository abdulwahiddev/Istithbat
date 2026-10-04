import { describe,it,expect } from 'vitest';
import { createHash } from 'node:crypto';
import { fixtureBytes, fixturePayload } from '../lib/connectors/sandbox';
import { SourceSummary } from '../lib/contracts';
import { sourceExample } from '../lib/contracts/examples';
import { signWebhook,verifyWebhook } from '../lib/server/webhook-signature';
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
describe('Packet 01 foundation',()=>{
  it('loads owner fixtures unchanged with synthetic markers',()=>{
    expect(digest(fixtureBytes('had-4821.v13.json'))).toBe('9bc91d4e230c4941e7856b8d8a8eaa2dccbcd268e468be0848159f904b3981d6');
    expect(digest(fixtureBytes('had-4821.v14.json'))).toBe('8c161f54de223c490244188d5639134352e9d67d313f28df37bcccc280555f57');
    expect(digest(fixtureBytes('had-4821.v14-r2.json'))).toBe('009901591fed88c2da771024f97ebc19f5de25c3847518c5258482e508b7c3f3');
    for(const name of ['had-4821.v13.json','had-4821.v14.json','had-4821.v14-r2.json'] as const) {const payload=fixturePayload(name); expect(payload.metadata.synthetic).toBe(true); expect(payload.records[0].canonical_key).toBe('HAD-4821');}
  });
  it('keeps published v14 evidence changed and v14-r2 same-label',()=>{
    const baseline=fixturePayload('had-4821.v13.json');const candidate=fixturePayload('had-4821.v14.json');const revision=fixturePayload('had-4821.v14-r2.json');
    expect(baseline.records[0].content.judgment).not.toBe(candidate.records[0].content.judgment);
    expect(candidate.upstreamVersionLabel).toBe(revision.upstreamVersionLabel);
    expect(candidate.upstreamPublishedAt).toBe(revision.upstreamPublishedAt);
  });
  it('validates the shared source contract',()=>expect(SourceSummary.parse(sourceExample).isDemoFixture).toBe(true));
  it('rejects a modified webhook body',()=>{process.env.DEMO_WEBHOOK_SECRET='test-secret-for-signature-only';const body='{"sourceId":"hadith-evidence-sandbox"}';const signature=signWebhook(body);expect(verifyWebhook(body,signature)).toBe(true);expect(verifyWebhook(body+' ',signature)).toBe(false);});
});
