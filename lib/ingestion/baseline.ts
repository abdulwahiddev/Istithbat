import type postgres from 'postgres';
import { getHttpConnector } from '@/lib/connectors/registry';

export type BaselineResult =
  | { status: 'ESTABLISHED'; sourceId: string; versionId: string; upstreamLabel: string; revisionNumber: number; rawSha256: string }
  | { status: 'ALREADY_TRUSTED'; sourceId: string; versionId: string }
  | { status: 'REFUSED'; sourceId: string; reason: string };

/**
 * Explicit, operator-run trust of a real source's FIRST observation as its monitoring baseline.
 *
 * The first snapshot of a real source has nothing to diff against, so the pipeline never runs for it
 * (it must not be auto-promoted as "metadata only"). Trusting it is an operator decision, recorded as
 * BASELINE_ESTABLISHED, exactly like the sandbox's seeded v13 baseline. It only ever applies when the
 * source has a single, predecessor-less, still-PENDING version and no trusted version. Every later
 * change goes through the normal pipeline, policy and human review.
 */
export async function establishBaseline(sql: postgres.Sql, sourceId: string, actor: string): Promise<BaselineResult> {
  if (!getHttpConnector(sourceId)) return { status: 'REFUSED', sourceId, reason: 'not a registered real connector' };
  return sql.begin(async (tx) => {
    const source = await tx`SELECT id,is_demo_fixture FROM sources WHERE id=${sourceId} FOR UPDATE`;
    if (!source.length) return { status: 'REFUSED' as const, sourceId, reason: 'source is not registered' };
    if (source[0].is_demo_fixture) return { status: 'REFUSED' as const, sourceId, reason: 'demo fixture sources are seeded, not baselined' };
    const trusted = await tx`SELECT id FROM source_versions WHERE source_id=${sourceId} AND status='TRUSTED'`;
    if (trusted.length) return { status: 'ALREADY_TRUSTED' as const, sourceId, versionId: trusted[0].id as string };
    const versions = await tx`SELECT * FROM source_versions WHERE source_id=${sourceId} ORDER BY detected_at,id FOR UPDATE`;
    if (versions.length !== 1) return { status: 'REFUSED' as const, sourceId, reason: `expected exactly one observed version, found ${versions.length}` };
    const v = versions[0];
    if (v.previous_version_id || v.status !== 'PENDING') return { status: 'REFUSED' as const, sourceId, reason: 'the only version is not an untouched initial observation' };
    await tx`UPDATE source_versions SET status='TRUSTED' WHERE id=${v.id} AND status='PENDING'`;
    await tx`INSERT INTO audit_events (event_type,entity_type,entity_id,actor,metadata_json,idempotency_key)
      VALUES ('BASELINE_ESTABLISHED','source_version',${v.id},${actor},${tx.json({
        sourceId, rawSha256: v.raw_sha256, canonicalSha256: v.canonical_sha256, upstreamLabel: v.upstream_version_label, revisionNumber: v.revision_number,
        reason: 'Initial observation of an organizer-approved real source accepted as its monitoring baseline; nothing earlier existed to compare.',
      })},${`baseline-established:${v.id}`}) ON CONFLICT DO NOTHING`;
    return { status: 'ESTABLISHED' as const, sourceId, versionId: v.id as string, upstreamLabel: v.upstream_version_label as string, revisionNumber: v.revision_number as number, rawSha256: v.raw_sha256 as string };
  });
}
