import type { SourceDetail } from '@/lib/contracts';

export type Version = SourceDetail['versions'][number];
export type Change = SourceDetail['changes'][number];

export interface VersionRef {
  label: string;
  revision: number;
}

export function versionName(v: Pick<Version, 'upstreamLabel' | 'revisionNumber'>): string {
  return `${v.upstreamLabel} r${v.revisionNumber}`;
}

const byDetected = (a: Version, b: Version) => a.detectedAt.localeCompare(b.detectedAt) || a.id.localeCompare(b.id);

/**
 * Latest seen / latest trusted / currently served, resolved to concrete revisions.
 * - seen: the newest detected revision (the gateway's latest_seen label is the same value).
 * - trusted: the single TRUSTED version (DB-enforced, D-01).
 * - served: the gateway's served label, which only ever points at a TRUSTED version.
 */
export function releaseRefs(detail: SourceDetail): { seen: VersionRef | null; trusted: VersionRef | null; served: VersionRef | null } {
  const sorted = [...detail.versions].sort(byDetected);
  const latest = sorted.at(-1);
  const trusted = detail.versions.find((v) => v.status === 'TRUSTED');
  const servedLabel = detail.source.servedLabel;
  const served = servedLabel ? detail.versions.find((v) => v.status === 'TRUSTED' && v.upstreamLabel === servedLabel) : undefined;
  const ref = (v: Version | undefined): VersionRef | null => (v ? { label: v.upstreamLabel, revision: v.revisionNumber } : null);
  return {
    seen: ref(latest),
    trusted: ref(trusted),
    // If the gateway names a label we cannot resolve to a trusted revision, show the label alone.
    served: served ? ref(served) : servedLabel ? { label: servedLabel, revision: 0 } : null,
  };
}

export interface Transition {
  from: Version | null;
  to: Version;
  changes: Change[];
}

/** One transition per version that has a predecessor, newest first, with its persisted changes. */
export function transitions(detail: SourceDetail): Transition[] {
  const byId = new Map(detail.versions.map((v) => [v.id, v]));
  return [...detail.versions]
    .sort(byDetected)
    .filter((v) => v.previousVersionId)
    .map((to) => ({
      from: byId.get(to.previousVersionId as string) ?? null,
      to,
      changes: detail.changes.filter((c) => c.toVersionId === to.id),
    }))
    .reverse();
}

/** Each Silent Mutation revision paired with the revision it silently replaced. */
export function silentMutationPairs(versions: Version[]): Array<{ before: Version; after: Version }> {
  const byId = new Map(versions.map((v) => [v.id, v]));
  return versions
    .filter((v) => v.silentMutation)
    .map((after) => {
      const before =
        (after.previousVersionId ? byId.get(after.previousVersionId) : undefined) ??
        versions.find((b) => b.upstreamLabel === after.upstreamLabel && b.revisionNumber === after.revisionNumber - 1);
      return before ? { before, after } : null;
    })
    .filter((p): p is { before: Version; after: Version } => p !== null);
}
