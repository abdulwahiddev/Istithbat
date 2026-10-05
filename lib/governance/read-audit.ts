import 'server-only';
import { getSql } from '@/lib/db/client';
import { AuditEvent, AuditPage } from '@/lib/contracts';

export function mapAuditEvent(row:Record<string,any>) {
  return AuditEvent.parse({id:row.id,eventType:row.event_type,entityType:row.entity_type,
    entityId:row.entity_id,actor:row.actor,metadata:row.metadata_json,
    idempotencyKey:row.idempotency_key??null,createdAt:row.created_at.toISOString()});
}

export async function getAuditPage({incidentId,before,limit=25}: {incidentId?:string;before?:string;limit?:number}={}) {
  const sql=getSql();
  const scope=incidentId?sql`EXISTS (SELECT 1 FROM incidents i WHERE i.id=${incidentId} AND (
    (e.entity_type='incident' AND e.entity_id=i.id::text) OR
    (e.entity_type='source_version' AND e.entity_id IN (i.candidate_version_id::text,i.previous_version_id::text)) OR
    (e.entity_type='regression_run' AND EXISTS (SELECT 1 FROM regression_runs rr WHERE rr.id::text=e.entity_id AND rr.incident_id=i.id)) OR
    (e.entity_type='pipeline_run' AND EXISTS (SELECT 1 FROM pipeline_runs pr WHERE pr.id::text=e.entity_id AND pr.incident_id=i.id)) OR
    (e.entity_type='pipeline_step' AND EXISTS (SELECT 1 FROM pipeline_steps ps JOIN pipeline_runs pr ON pr.id=ps.run_id WHERE ps.id::text=e.entity_id AND pr.incident_id=i.id))
  ))`:sql`true`;
  const cursor=before?sql`(e.created_at,e.id)<(SELECT c.created_at,c.id FROM audit_events c WHERE c.id=${before})`:sql`true`;
  const rows=await sql`SELECT e.* FROM audit_events e WHERE ${scope} AND ${cursor}
    ORDER BY e.created_at DESC,e.id DESC LIMIT ${limit+1}`;
  const hasMore=rows.length>limit;
  const events=rows.slice(0,limit).map(mapAuditEvent);
  return AuditPage.parse({events,nextCursor:hasMore?events.at(-1)?.id??null:null});
}
