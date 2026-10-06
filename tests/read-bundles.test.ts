import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSql } from '@/lib/db/client';
import { readBlastRadius } from '@/lib/blast-radius/service';
import { getSourceDetail } from '@/lib/server/source-read';
import { BlastRadius, SourceDetail } from '@/lib/contracts';

vi.mock('@/lib/db/client', () => ({ getSql: vi.fn() }));

const time = '2026-10-06T00:00:00.000Z';
const source = {
  id: 'source-1', name: 'Synthetic source', provider: 'Test', source_type: 'SANDBOX',
  connector_health: 'HEALTHY', is_demo_fixture: true, content_level: 'A',
  latest_seen_label: 'v14', latest_seen_revision: 1, monitored_record_count: 1,
  trusted_label: 'v13', trusted_revision: 1, served_label: 'v13', served_revision: 1,
  last_checked_at: new Date(time), connector_type: 'TEST', rights_note: null,
};
const version = (id: string, status: string, previous: string | null) => ({
  id, previous_version_id: previous, upstream_version_label: id, revision_number: 1,
  upstream_published_at: null, status, raw_sha256: 'a'.repeat(64), canonical_sha256: 'b'.repeat(64),
  silent_mutation: false, change_class: null, raw_snapshot_path: `${id}/raw`,
  canonical_snapshot_path: `${id}/canonical`, record_count: 1, detected_at: time,
});

beforeEach(() => vi.clearAllMocks());

describe('batched read paths', () => {
  it('reads a held source in two round trips without confusing seen, trusted and served', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([source])
      .mockResolvedValueOnce([{
        field_roles_json: { judgment: 'SCHOLAR_JUDGMENT' },
        versions: [version('v13', 'TRUSTED', null), version('v14', 'QUARANTINED', 'v13')],
        changes: [{ id: 'change-1', canonical_key: 'TEST-1', change_type: 'FIELD_MODIFIED',
          field_path: 'judgment', field_role: 'SCHOLAR_JUDGMENT', old_value: 'old', new_value: 'new',
          diff_flags: [], from_version_id: 'v13', to_version_id: 'v14', old_field_hash: null,
          new_field_hash: null, diff_json: { rolesPresent: ['SCHOLAR_JUDGMENT'] } }],
        checks: [], policies: [], incidents: [],
      }]);
    vi.mocked(getSql).mockReturnValue(query as never);
    const detail = await getSourceDetail('source-1');
    expect(query).toHaveBeenCalledTimes(2);
    expect(SourceDetail.parse(detail).source).toMatchObject({ latestSeenLabel: 'v14', trustedLabel: 'v13', servedLabel: 'v13' });
    expect(detail?.versions.map(row => row.status)).toEqual(['TRUSTED', 'QUARANTINED']);
    expect(detail?.changes[0]).toMatchObject({ canonicalKey: 'TEST-1', rolesPresent: ['SCHOLAR_JUDGMENT'] });
  });

  it('returns null for an unknown source without loading its history', async () => {
    const query = vi.fn().mockResolvedValue([]);
    vi.mocked(getSql).mockReturnValue(query as never);
    expect(await getSourceDetail('missing')).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('recomputes Blast Radius from one database snapshot and preserves persisted history', async () => {
    const query = vi.fn().mockResolvedValue([{
      incident: { id: 'incident-1', source_id: 'source-1', previous_version_id: 'v13',
        candidate_version_id: 'v14', status: 'QUARANTINED', effective_policy_action: 'QUARANTINE' },
      changes: [{ id: 'change-1', canonical_key: 'TEST-1', field_path: 'judgment', field_role: 'SCHOLAR_JUDGMENT' }],
      assets: [], mappings: [], dependencies: [], protected_apps: [], regressions: [],
      trusted: [{ id: 'v13' }], snapshots: [{ metadata_json: {
        phase: 'PIPELINE', traversalHash: 'prior-hash', counts: { exposed: 0, stale: 0, impacted: 0 }, graph: {},
      }, created_at: time }], step: null,
    }]);
    vi.mocked(getSql).mockReturnValue(query as never);
    const graph = await readBlastRadius('incident-1');
    expect(query).toHaveBeenCalledTimes(1);
    expect(BlastRadius.parse(graph)).toMatchObject({
      incidentStatus: 'QUARANTINED', policyAction: 'QUARANTINE', trustedVersionId: 'v13',
      candidateServed: false, traversalStatus: 'LIVE',
    });
    expect(graph?.history).toHaveLength(1);
    expect(graph?.history[0].traversalHash).toBe('prior-hash');
  });
});
