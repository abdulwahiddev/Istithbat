import Link from 'next/link';
import type { SourceSummary } from '@/lib/contracts';
import type { SourceDetailView, TransitionView, VersionView } from '@/app/(ui)/_data/sources';
import { ExactDiff, Hash, Mono, formatTimestamp } from '../evidence/Evidence';
import { ProvenanceBlock, ProvenanceTag } from '../provenance/Provenance';
import { ConnectorHealthBadge, ContentLevelTag, DiffFlagTag, FieldRoleTag, SilentMutationBadge, VersionStatusBadge } from '../status/Status';

export function versionName(v: Pick<VersionView, 'upstreamLabel' | 'revisionNumber'>): string {
  return `${v.upstreamLabel} r${v.revisionNumber}`;
}

// ------------------------------------------------------------------ Sources list

export function SourcesTable({ sources, query }: { sources: SourceSummary[]; query: string }) {
  return (
    <div className="ist-table-wrap">
      <table className="ist-table">
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">Sensitivity</th>
            <th scope="col">Connector</th>
            <th scope="col">Latest seen</th>
            <th scope="col">Latest trusted</th>
            <th scope="col">Currently served</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => {
            const untrusted = s.latestSeenLabel !== s.trustedLabel;
            return (
              <tr key={s.id}>
                <td>
                  <Link href={`/sources/${encodeURIComponent(s.id)}${query}`} className="ist-table__primary">
                    {s.name}
                  </Link>
                  <div className="ist-meta">{s.provider}</div>
                  {s.isDemoFixture && (
                    <div style={{ marginBlockStart: 6 }}>
                      <span className="ist-badge ist-badge--pending" title="D-13: fully synthetic">
                        Controlled synthetic source
                      </span>
                    </div>
                  )}
                </td>
                <td>
                  <ContentLevelTag level={s.contentLevel} />
                </td>
                <td>
                  <ConnectorHealthBadge health={s.connectorHealth} />
                </td>
                <td>
                  <span style={{ color: untrusted ? 'var(--amber)' : undefined, fontWeight: 600 }}>
                    <Mono>{s.latestSeenLabel ?? '—'}</Mono>
                  </span>
                  {untrusted && <div className="ist-meta">untrusted</div>}
                </td>
                <td>
                  <Mono>{s.trustedLabel ?? '—'}</Mono>
                </td>
                <td>
                  <span style={{ color: 'var(--turquoise)', fontWeight: 600 }}>
                    <Mono>{s.servedLabel ?? '—'}</Mono>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ Source detail header

export function SourceHeaderTags({ source }: { source: SourceSummary }) {
  return (
    <div className="ist-row" style={{ marginBlockStart: 12 }}>
      <ContentLevelTag level={source.contentLevel} />
      <ConnectorHealthBadge health={source.connectorHealth} />
      <span className="ist-tag">
        <Mono>{source.id}</Mono>
      </span>
      <span className="ist-tag">{source.sourceType.replace(/_/g, ' ').toLowerCase()}</span>
    </div>
  );
}

// ------------------------------------------------------------------ Version timeline

const DOT: Record<string, { color: string; filled: boolean }> = {
  TRUSTED: { color: 'var(--turquoise)', filled: true },
  ANALYZING: { color: 'var(--amber)', filled: false },
  QUARANTINED: { color: 'var(--coral)', filled: true },
  REJECTED: { color: 'var(--coral)', filled: false },
  SUPERSEDED: { color: 'var(--text-muted)', filled: false },
  PENDING: { color: 'var(--text-muted)', filled: false },
};

const EQUIVALENCE_TEXT: Record<string, string> = {
  SERIALIZATION_ONLY: 'serialization only (JSON key order; canonical hash unchanged)',
  WHITESPACE_ONLY: 'whitespace only (token sequence unchanged)',
  UNICODE_EQUIVALENT: 'Unicode-equivalent (NFC)',
  METADATA_ONLY: 'operational metadata only',
};

export function VersionTimeline({ versions }: { versions: VersionView[] }) {
  const ordered = [...versions].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  return (
    <ol className="ist-timeline">
      {ordered.map((v) => {
        const dot = DOT[v.status] ?? DOT.PENDING;
        return (
          <li key={v.id} className="ist-timeline__item">
            <span
              className={`ist-timeline__dot${dot.filled ? ' ist-timeline__dot--filled' : ''}`}
              style={{ ['--dot' as string]: dot.color }}
              aria-hidden="true"
            />
            <div>
              <div className="ist-timeline__head">
                <span className="ist-timeline__label">
                  <Mono>{versionName(v)}</Mono>
                </span>
                <VersionStatusBadge status={v.status} heldForReview={v.heldForReview} />
                {v.silentMutation && <SilentMutationBadge />}
                {v.changeClass === 'SERIALIZATION_ONLY' && <span className="ist-tag">Serialization-only</span>}
              </div>
              <div className="ist-meta">
                Detected {formatTimestamp(v.detectedAt)}
                {v.upstreamPublishedAt ? ` · upstream published ${formatTimestamp(v.upstreamPublishedAt)}` : ''}
              </div>
              <div className="ist-timeline__hashes">
                <Hash label="raw" value={v.rawSha256} />
                <Hash label="canonical" value={v.canonicalSha256} />
              </div>
              {v.autoPromotion && (
                <div className="ist-timeline__note">
                  <ProvenanceTag kind="deterministic">Auto-promoted · {v.autoPromotion.policyCode}</ProvenanceTag>{' '}
                  ALLOW + LOG: {EQUIVALENCE_TEXT[v.autoPromotion.equivalence] ?? v.autoPromotion.equivalence}. No incident, no AI
                  call; promoted through the same atomic gateway transaction at {formatTimestamp(v.autoPromotion.promotedAt)}.
                </div>
              )}
              {v.status === 'ANALYZING' && (
                <div className="ist-timeline__note">Stored and inspectable. Not trusted and not served.</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------------------------------------------ Silent mutation evidence

/** Pairs each silent-mutation revision with the previous revision of the same label. */
export function silentMutationPairs(versions: VersionView[]): Array<{ before: VersionView; after: VersionView }> {
  return versions
    .filter((v) => v.silentMutation)
    .map((after) => ({
      after,
      before: versions.find((b) => b.upstreamLabel === after.upstreamLabel && b.revisionNumber === after.revisionNumber - 1),
    }))
    .filter((p): p is { before: VersionView; after: VersionView } => !!p.before);
}

export function SilentMutationEvidence({ before, after }: { before: VersionView; after: VersionView }) {
  const canonicalSame = before.canonicalSha256 === after.canonicalSha256;
  return (
    <ProvenanceBlock kind="deterministic" label="Silent mutation evidence">
      <p style={{ margin: '0 0 12px', fontSize: 14 }}>
        Upstream label <Mono>{after.upstreamLabel}</Mono> was observed twice with different content fingerprints.
      </p>
      <div className="ist-table-wrap">
        <table className="ist-table">
          <thead>
            <tr>
              <th scope="col">Observed</th>
              <th scope="col">Label</th>
              <th scope="col">Raw SHA-256</th>
              <th scope="col">Canonical SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {[before, after].map((v) => (
              <tr key={v.id}>
                <td className="ist-meta">{formatTimestamp(v.detectedAt)}</td>
                <td>
                  <Mono>{versionName(v)}</Mono>
                </td>
                <td>
                  <Hash label="" value={v.rawSha256} head={10} />
                </td>
                <td>
                  <Hash label="" value={v.canonicalSha256} head={10} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="ist-dl" style={{ marginBlockStart: 14 }}>
        <dt>Finding</dt>
        <dd>Same provider label + different content fingerprint → silent mutation</dd>
        <dt>Content</dt>
        <dd>{canonicalSame ? 'Canonical hash unchanged: serialization-only, no record changed' : 'Canonical hash changed: record content differs (see exact changes below)'}</dd>
        <dt>Cause</dt>
        <dd>Unknown. A hash proves that content changed, not why. No motive is inferred.</dd>
      </dl>
    </ProvenanceBlock>
  );
}

// ------------------------------------------------------------------ Exact changes

export function TransitionChanges({ transition, versions }: { transition: TransitionView; versions: VersionView[] }) {
  const from = versions.find((v) => v.id === transition.fromVersionId);
  const to = versions.find((v) => v.id === transition.toVersionId);
  const fromName = from ? versionName(from) : 'previous';
  const toName = to ? versionName(to) : 'candidate';
  return (
    <div className="ist-stack" style={{ gap: 0 }}>
      <div className="ist-row" style={{ justifyContent: 'space-between', marginBlockEnd: 10 }}>
        <span className="ist-h3">
          <Mono>{fromName}</Mono> → <Mono>{toName}</Mono>
        </span>
        <span className="ist-meta">
          {transition.changes.length} {transition.changes.length === 1 ? 'change' : 'changes'}
        </span>
      </div>
      {transition.changes.length === 0 ? (
        <p className="ist-meta" style={{ margin: 0 }}>
          No record or field changed. The raw bytes differ only in serialization, so the diff is empty.
        </p>
      ) : (
        <div className="ist-table-wrap">
          <table className="ist-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: '24%' }}>Record · field</th>
                <th scope="col">Exact change (source values, unmodified)</th>
              </tr>
            </thead>
            <tbody>
              {transition.changes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="ist-table__primary">
                      <Mono>{c.canonicalKey}</Mono> · <Mono>{c.fieldPath ?? '(record)'}</Mono>
                    </div>
                    <div className="ist-row" style={{ marginBlockStart: 8 }}>
                      <FieldRoleTag role={c.fieldRole} />
                      <span className="ist-tag">
                        <Mono>{c.changeType}</Mono>
                      </span>
                      {c.flags.map((f) => (
                        <DiffFlagTag key={f} flag={f} />
                      ))}
                    </div>
                  </td>
                  <td>
                    <ExactDiff oldValue={c.oldValue} newValue={c.newValue} oldLabel={`${fromName} · ${from?.status === 'TRUSTED' || from?.status === 'SUPERSEDED' ? 'trusted' : 'previous'}`} newLabel={`${toName} · candidate`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Field roles

export function FieldRoleMap({ roles }: { roles: SourceDetailView['fieldRoles'] }) {
  const entries = Object.entries(roles);
  return (
    <dl className="ist-dl">
      {entries.map(([path, role]) => (
        <div key={path} style={{ display: 'contents' }}>
          <dt>
            <Mono>{path}</Mono>
          </dt>
          <dd>
            <FieldRoleTag role={role} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
