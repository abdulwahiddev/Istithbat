import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSql } from '@/lib/db/client';
import { getGatewayInventory, getGatewayState } from '@/lib/gateway/read';
import { getAuditPage } from '@/lib/governance/read-audit';
import { IncidentAggregate } from '@/lib/contracts';
import heldIncident from '../components/__tests__/fixtures/incident-v14-r1.live.json';

vi.mock('@/lib/db/client',()=>({getSql:vi.fn()}));

const date=new Date('2026-10-04T12:00:00Z');
const version=(prefix:'seen'|'trusted'|'served',id:string|null,label:string|null,status:string|null)=>({
  [`${prefix}_id`]:id,[`${prefix}_label`]:label,[`${prefix}_revision`]:id?1:null,
  [`${prefix}_status`]:status,[`${prefix}_detected_at`]:id?date:null,
});
const unbound=(sourceId:string,label:string)=>({source_id:sourceId,source_name:sourceId,binding_id:null,
  app_id:null,app_name:null,gateway_status:null,binding_updated_at:null,held_incident_id:null,
  held_incident_status:null,held_policy_action:null,
  ...version('seen',`${sourceId}-v1`,label,'TRUSTED'),
  ...version('trusted',`${sourceId}-v1`,label,'TRUSTED'),...version('served',null,null,null)});
const sandbox={source_id:'hadith-evidence-sandbox',source_name:'Hadith Evidence Sandbox',binding_id:'binding-1',
  app_id:'islamic-qa-demo',app_name:'Islamic Q&A',gateway_status:'SERVING_TRUSTED',binding_updated_at:date,
  held_incident_id:null,held_incident_status:null,held_policy_action:null,
  ...version('seen','v13','v13','TRUSTED'),...version('trusted','v13','v13','TRUSTED'),
  ...version('served','v13','v13','TRUSTED')};

beforeEach(()=>vi.clearAllMocks());

describe('read-only UI contracts',()=>{
  it('keeps trusted real sources unbound and unserved',async()=>{
    vi.mocked(getSql).mockReturnValue((async()=>[sandbox,unbound('hadeethenc','unversioned'),
      unbound('quranenc-english-saheeh','1.1.2')]) as never);
    const inventory=await getGatewayInventory();
    expect(inventory.items).toHaveLength(3);
    for(const sourceId of ['hadeethenc','quranenc-english-saheeh']) {
      const item=inventory.items.find(row=>row.sourceId===sourceId)!;
      expect(item.latestTrusted?.status).toBe('TRUSTED');
      expect(item.served).toBeNull();
      expect(item.binding).toBeNull();
    }
    expect(inventory.items.find(row=>row.sourceId==='hadeethenc')?.latestSeen?.label).toBe('unversioned');
    expect(inventory.items.find(row=>row.sourceId==='hadith-evidence-sandbox')?.served?.label).toBe('v13');
  });

  it('represents held v14 r1 while v13 stays trusted and served',async()=>{
    vi.mocked(getSql).mockReturnValue((async()=>[{
      ...sandbox,...version('seen','v14-r1','v14','ANALYZING'),
      held_incident_id:heldIncident.id,held_incident_status:'NEEDS_REVIEW',held_policy_action:'REVIEW',
    }]) as never);
    const state=await getGatewayState('islamic-qa-demo','hadith-evidence-sandbox');
    expect(state?.latestSeen).toMatchObject({label:'v14',revisionNumber:1,status:'ANALYZING'});
    expect(state?.heldCandidate).toMatchObject({incidentId:heldIncident.id,policyAction:'REVIEW'});
    expect(state?.latestTrusted?.label).toBe('v13');
    expect(state?.served.label).toBe('v13');
    expect(IncidentAggregate.parse(heldIncident).analysis?.output.uncertainties).toHaveLength(1);
  });

  it('pages actual audit columns with a stable event cursor',async()=>{
    const rows=[1,2,3].map(n=>({id:`event-${n}`,event_type:'PIPELINE_STEP_COMPLETED',entity_type:'pipeline_step',
      entity_id:`step-${n}`,actor:'system:pipeline',metadata_json:{step:'POLICY',attempt:n},
      idempotency_key:`step-${n}`,created_at:date}));
    vi.mocked(getSql).mockReturnValue((async()=>rows) as never);
    const page=await getAuditPage({limit:2});
    expect(page.events.map(event=>event.id)).toEqual(['event-1','event-2']);
    expect(page.events[0]).toMatchObject({actor:'system:pipeline',metadata:{step:'POLICY',attempt:1},
      idempotencyKey:'step-1'});
    expect(page.nextCursor).toBe('event-2');
  });
});
