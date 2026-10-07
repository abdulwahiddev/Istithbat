import 'server-only';
import { getSql } from '@/lib/db/client';
import { fixturePayload, SANDBOX_ID, type FixtureName } from '@/lib/connectors/sandbox';
import { SandboxConsoleState } from '@/lib/contracts';
import { mapPipelineRun } from '@/lib/pipeline/read';

export function mapSandboxState(row: Record<string, any>) {
  const version = (v: Record<string,any> | null) => v ? {id:v.id,label:v.upstream_version_label,revision:v.revision_number,status:v.status} : null;
  return SandboxConsoleState.parse({
    sourceId:SANDBOX_ID,fixture:row.fixture_name,payload:fixturePayload(row.fixture_name as FixtureName),
    publishedAt:new Date(row.updated_at).toISOString(),health:row.connector_health,
    latestSeen:version(row.seen),trusted:version(row.trusted),
    served:row.served.map((g:Record<string,any>)=>({appId:g.protected_app_id,gatewayStatus:g.gateway_status,version:version(g.version)})),
    pipeline:row.run ? mapPipelineRun(row.run,row.steps) : null,
    lastCheck:row.check ? {status:row.check.status,errorCode:row.check.error_code,checkedAt:new Date(row.check.checked_at).toISOString()} : null,
  });
}
export async function getSandboxConsoleState() {
  const [row] = await getSql()`SELECT ss.*,s.connector_health,to_jsonb(seen) AS seen,
    (SELECT to_jsonb(v) FROM source_versions v WHERE v.source_id=s.id AND v.status='TRUSTED' LIMIT 1) AS trusted,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('protected_app_id',g.protected_app_id,'gateway_status',g.gateway_status,'version',to_jsonb(v)) ORDER BY g.protected_app_id),'[]'::jsonb) FROM gateway_bindings g JOIN source_versions v ON v.id=g.served_version_id WHERE g.source_id=s.id) AS served,
    to_jsonb(r) AS run,
    (SELECT COALESCE(jsonb_agg(to_jsonb(ps)),'[]'::jsonb) FROM pipeline_steps ps WHERE ps.run_id=r.id) AS steps,
    (SELECT to_jsonb(c) FROM source_checks c WHERE c.source_id=s.id ORDER BY c.checked_at DESC,c.id DESC LIMIT 1) AS check
    FROM sandbox_state ss JOIN sources s ON s.id=ss.source_id
    LEFT JOIN LATERAL (SELECT v.* FROM source_versions v WHERE v.source_id=s.id ORDER BY v.detected_at DESC,v.id DESC LIMIT 1) seen ON true
    LEFT JOIN pipeline_runs r ON r.source_version_id=seen.id
    WHERE ss.source_id=${SANDBOX_ID}`;
  return row ? mapSandboxState(row) : null;
}

// Persist a recovery heartbeat before scheduling, so many polling clients can
// elect only one continuation. The runner itself separately claims the lease.
export async function claimStaleSandboxRecovery(runId: string): Promise<boolean> {
  const rows=await getSql()`UPDATE pipeline_runs r SET updated_at=now()
    WHERE r.id=${runId} AND r.status='RUNNING'
      AND r.updated_at < now() - interval '60 seconds'
      AND (r.lease_until IS NULL OR r.lease_until < now())
      AND r.source_version_id=(SELECT v.id FROM source_versions v
        WHERE v.source_id=${SANDBOX_ID} ORDER BY v.detected_at DESC,v.id DESC LIMIT 1)
    RETURNING r.id`;
  return rows.length>0;
}
