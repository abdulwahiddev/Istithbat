import 'server-only';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { SANDBOX_FIXTURES } from '@/lib/contracts/sandbox-scenario';
import { hadeethencConnector } from './hadeethenc';
export const SANDBOX_ID='hadith-evidence-sandbox';
export const fixtureNames=SANDBOX_FIXTURES;
export type FixtureName=typeof fixtureNames[number];
const record=z.object({canonical_key:z.string(),upstream_record_id:z.string().optional(),content:z.record(z.string(),z.unknown()),metadata:z.record(z.string(),z.unknown())});
export const payloadSchema=z.object({upstreamVersionLabel:z.string(),upstreamPublishedAt:z.string(),metadata:z.record(z.string(),z.unknown()),records:z.array(record)});
export type SourcePayload=z.infer<typeof payloadSchema>;
export const sandboxConnector={sourceId:SANDBOX_ID,contentLevel:'A' as const,fieldRoles:{...hadeethencConnector.definition.fieldRoles,arabic_text:'AUTHORITATIVE_TEXT',translation:'TRANSLATION',judgment:'SCHOLAR_JUDGMENT',scholar:'PROVENANCE','reference.book':'PROVENANCE','reference.volume':'PROVENANCE','reference.page':'PROVENANCE','narrators[]':'PROVENANCE',updated_at:'OPERATIONAL_METADATA',display_label:'OPERATIONAL_METADATA',source_url:'OPERATIONAL_METADATA',internal_id:'OPERATIONAL_METADATA',description:'OPERATIONAL_METADATA'} as const};
export function fixtureBytes(name: FixtureName) {
  if (!fixtureNames.includes(name)) throw new Error('Unknown sandbox fixture');
  return readFileSync(resolve(name.startsWith('hadeethenc-10618.')?'demo/source-derived':'demo/synthetic-fixtures',name));
}
export function fixturePayload(name: FixtureName):SourcePayload { const parsed=payloadSchema.parse(JSON.parse(fixtureBytes(name).toString('utf8'))); if (parsed.metadata.synthetic!==true || parsed.records.some(r=>r.metadata.synthetic!==true)) throw new Error('Sandbox fixture lacks synthetic markers'); return parsed; }
