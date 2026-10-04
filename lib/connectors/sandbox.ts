import 'server-only';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
export const SANDBOX_ID='hadith-evidence-sandbox';
export const fixtureNames=['had-4821.v13.json','had-4821.v14.json','had-4821.v14-r2.json'] as const;
export type FixtureName=typeof fixtureNames[number];
const record=z.object({canonical_key:z.string(),upstream_record_id:z.string().optional(),content:z.record(z.string(),z.unknown()),metadata:z.record(z.string(),z.unknown())});
export const payloadSchema=z.object({upstreamVersionLabel:z.string(),upstreamPublishedAt:z.string(),metadata:z.record(z.string(),z.unknown()),records:z.array(record)});
export type SourcePayload=z.infer<typeof payloadSchema>;
export const sandboxConnector={sourceId:SANDBOX_ID,contentLevel:'A' as const,fieldRoles:{arabic_text:'AUTHORITATIVE_TEXT',translation:'TRANSLATION',judgment:'SCHOLAR_JUDGMENT',scholar:'PROVENANCE','reference.book':'PROVENANCE','reference.volume':'PROVENANCE','reference.page':'PROVENANCE','narrators[]':'PROVENANCE',updated_at:'OPERATIONAL_METADATA',display_label:'OPERATIONAL_METADATA',source_url:'OPERATIONAL_METADATA',internal_id:'OPERATIONAL_METADATA',description:'OPERATIONAL_METADATA'}};
export function fixtureBytes(name: FixtureName) { return readFileSync(resolve('demo/synthetic-fixtures',name)); }
export function fixturePayload(name: FixtureName):SourcePayload { const parsed=payloadSchema.parse(JSON.parse(fixtureBytes(name).toString('utf8'))); if (parsed.metadata.synthetic!==true || parsed.records.some(r=>r.metadata.synthetic!==true)) throw new Error('Sandbox fixture lacks synthetic markers'); return parsed; }
