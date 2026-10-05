import 'server-only';
import { getSql } from '@/lib/db/client';
import { GatewayInventory, GatewayState, type GatewayInventory as Inventory } from '@/lib/contracts';

export async function getGatewayInventory(): Promise<Inventory> {
  const rows=await getSql()`SELECT s.id AS source_id,s.name AS source_name,
    g.id AS binding_id,g.protected_app_id AS app_id,g.gateway_status,g.updated_at AS binding_updated_at,
    a.name AS app_name,
    seen.id AS seen_id,seen.upstream_version_label AS seen_label,seen.revision_number AS seen_revision,
    seen.status AS seen_status,seen.detected_at AS seen_detected_at,
    trusted.id AS trusted_id,trusted.upstream_version_label AS trusted_label,trusted.revision_number AS trusted_revision,
    trusted.status AS trusted_status,trusted.detected_at AS trusted_detected_at,
    served.id AS served_id,served.upstream_version_label AS served_label,served.revision_number AS served_revision,
    served.status AS served_status,served.detected_at AS served_detected_at,
    held.id AS held_incident_id,held.status AS held_incident_status,held.effective_policy_action AS held_policy_action
    FROM sources s
    LEFT JOIN gateway_bindings g ON g.source_id=s.id
    LEFT JOIN protected_apps a ON a.id=g.protected_app_id
    LEFT JOIN source_versions served ON served.id=g.served_version_id
    LEFT JOIN LATERAL (SELECT v.* FROM source_versions v WHERE v.source_id=s.id
      ORDER BY v.detected_at DESC,v.id DESC LIMIT 1) fallback_seen ON true
    LEFT JOIN source_versions seen ON seen.id=COALESCE(g.latest_seen_version_id,fallback_seen.id)
    LEFT JOIN source_versions trusted ON trusted.source_id=s.id AND trusted.status='TRUSTED'
    LEFT JOIN LATERAL (SELECT i.id,i.status,i.effective_policy_action FROM incidents i
      WHERE i.candidate_version_id=seen.id AND i.status IN ('ANALYZING','NEEDS_REVIEW','QUARANTINED')
      ORDER BY i.opened_at DESC,i.id DESC LIMIT 1) held ON true
    ORDER BY s.id,g.protected_app_id`;
  return GatewayInventory.parse({items:rows.map(row=>{
    const version=(prefix:'seen'|'trusted'|'served')=>row[`${prefix}_id`]?{
      id:row[`${prefix}_id`],label:row[`${prefix}_label`],revisionNumber:row[`${prefix}_revision`],
      status:row[`${prefix}_status`],detectedAt:row[`${prefix}_detected_at`].toISOString(),
    }:null;
    const latestSeen=version('seen');
    return {
      appId:row.app_id??null,appName:row.app_name??null,sourceId:row.source_id,sourceName:row.source_name,
      binding:row.binding_id?{id:row.binding_id,appId:row.app_id,sourceId:row.source_id,
        updatedAt:row.binding_updated_at.toISOString()}:null,
      latestSeen,latestTrusted:version('trusted'),served:version('served'),gatewayStatus:row.gateway_status??null,
      heldCandidate:row.held_incident_id && latestSeen?{
        version:latestSeen,incidentId:row.held_incident_id,incidentStatus:row.held_incident_status,
        policyAction:row.held_policy_action??null,
      }:null,
    };
  })});
}

export async function getGatewayState(appId:string,sourceId:string) {
  const {items}=await getGatewayInventory();
  const item=items.find(value=>value.appId===appId && value.sourceId===sourceId);
  if(!item?.binding || !item.appName || !item.latestSeen || !item.served || !item.gatewayStatus) return null;
  return GatewayState.parse({...item,appId,appName:item.appName,binding:item.binding,
    latestSeen:item.latestSeen,served:item.served,gatewayStatus:item.gatewayStatus});
}
