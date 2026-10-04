import Link from 'next/link';
import type { IncidentListItem, SourceDetail, SourceSummary } from '@/lib/contracts';
import { ExactDiff, Hash, Mono, formatTimestamp } from '../evidence/Evidence';
import { ProvenanceBlock } from '../provenance/Provenance';
import { ConnectorHealthBadge, ContentLevelTag, DiffFlagTag, FieldRoleTag, SilentMutationBadge, VersionStatusBadge } from '../status/Status';
import { versionName, type Transition, type Version } from './derive';

// ------------------------------------------------------------------ Sources list

export function SourcesTable({ sources }: { sources: SourceSummary[] }) {
  return (
    <div className="ist-table-wrap">
      <table className="ist-table">
        <caption className="ist-sr-only">Monitored sources with their latest seen, trusted and served versions</caption>
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">Sensitivity</th>
            <th scope="col">Connector</th>
            <th scope="col">Latest seen</th>
            <th scope="col">Latest trusted</th>
            <th scope="col">Currently served</th>
            <th scope="col">Last checked</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => {
            const untrusted = !!s.latestSeenLabel && s.latestSeenLabel !== s.trustedLabel;
            return (
              <tr key={s.id}>
                <td>
                  <Link href={`/sources/${encodeURIComponent(s.id)}`} className="ist-table__primary">
                    {s.name}
                  </Link>
                  <div className="ist-meta">{s.provider}</div>
                  {s.isDemoFixture && (
                    <div style={{ marginBlockStart: 6 }}>
                      <span className="ist-badge ist-badge--pending" title="D-13: fully synthetic, not real hadith data">
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
                  {untrusted && <div className="ist-meta">untrusted candidate</div>}
                </td>
                <td>
                  <Mono>{s.trustedLabel ?? '—'}</Mono>
                </td>
                <td>
                  <span style={{ color: 'var(--turquoise)', fontWeight: 600 }}>
                    <Mono>{s.servedLabel ?? '—'}</Mono>
                  </span>
                </td>
                <td className="ist-meta">{formatTimestamp(s.lastCheckedAt ?? null)}</td>
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
      {source.lastCheckedAt && <span className="ist-meta">Last checked {formatTimestamp(source.lastCheckedAt)}</span>}
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

export function VersionTimeline({ versions, incidents }: { versions: Version[]; incidents: Map<string, IncidentListItem> }) {
  const ordered = [...versions].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt) || b.id.localeCompare(a.id));
  return (
    <ol className="ist-timeline">
      {ordered.map((v) => {
        const dot = DOT[v.status] ?? DOT.PENDING;
        const incident = incidents.get(v.id);
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
                <VersionStatusBadge status={v.status} />
                {v.silentMutation && <SilentMutationBadge />}
                {v.changeClass === 'SERIALIZATION_ONLY' && (
                  <span className="ist-tag" title="Raw bytes differ; canonical hash equal (D-14)">
                    Serialization-only
                  </span>
                )}
              </div>
              <div className="ist-meta">
                Detected {formatTimestamp(v.detectedAt)}
                {v.upstreamPublishedAt ? ` · upstream published ${formatTimestamp(v.upstreamPublishedAt)}` : ''}
                {v.recordCount !== undefined ? ` · ${v.recordCount} record${v.recordCount === 1 ? '' : 's'}` : ''}
              </div>
              <div className="ist-timeline__hashes">
                <Hash label="raw" value={v.rawSha256} />
                <Hash label="canonical" value={v.canonicalSha256} />
              </div>
              {v.status !== 'TRUSTED' && v.status !== 'SUPERSEDED' && (
                <div className="ist-timeline__note">Stored and inspectable. Not trusted and not served.</div>
              )}
              {incident && (
                <div className="ist-timeline__note">
                  <Link href={`/incidents/${incident.id}`}>Open incident for {versionName(v)} →</Link>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------------------------------------------ Silent mutation evidence

export function SilentMutationEvidence({ before, after, changes }: { before: Version; after: Version; changes: SourceDetail['changes'] }) {
  const canonicalSame = before.canonicalSha256 === after.canonicalSha256;
  const fields = changes.filter((c) => c.toVersionId === after.id && c.fieldPath).map((c) => c.fieldPath as string);
  return (
    <ProvenanceBlock kind="deterministic" label="Silent mutation evidence">
      <p style={{ margin: '0 0 12px', fontSize: 14 }}>
        Upstream label <Mono>{after.upstreamLabel}</Mono> did not change, but its content did. Istithbat recorded the second
        observation as internal revision <Mono>r{after.revisionNumber}</Mono>.
      </p>
      <div className="ist-table-wrap">
        <table className="ist-table">
          <caption className="ist-sr-only">Fingerprints of both observations of label {after.upstreamLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Observation</th>
              <th scope="col">Upstream label</th>
              <th scope="col">Raw SHA-256</th>
              <th scope="col">Canonical SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {[before, after].map((v) => (
              <tr key={v.id}>
                <td>
                  <Mono>r{v.revisionNumber}</Mono>
                  <div className="ist-meta">{formatTimestamp(v.detectedAt)}</div>
                </td>
                <td>
                  <Mono>{v.upstreamLabel}</Mono>
                </td>
                <td>
                  <Hash label="" value={v.rawSha256} />
                </td>
                <td>
                  <Hash label="" value={v.canonicalSha256} />
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
        <dd>
          {canonicalSame
            ? 'Canonical hash unchanged: serialization-only, no record changed.'
            : fields.length
              ? (
                  <>
                    Canonical hash changed. Field{fields.length > 1 ? 's' : ''} changed:{' '}
                    {fields.map((f, i) => (
                      <span key={f}>
                        {i > 0 && ', '}
                        <Mono>{f}</Mono>
                      </span>
                    ))}{' '}
                    (exact values below).
                  </>
                )
              : 'Canonical hash changed.'}
        </dd>
        <dt>Cause</dt>
        <dd>Unknown. A hash proves that content changed, not why. No motive is inferred.</dd>
      </dl>
    </ProvenanceBlock>
  );
}

// ------------------------------------------------------------------ Exact changes

export function ChangeRows({ changes, fromLabel, toLabel }: { changes: SourceDetail['changes']; fromLabel: string; toLabel: string }) {
  return (
    <div className="ist-table-wrap">
      <table className="ist-table">
        <caption className="ist-sr-only">
          Exact changes from {fromLabel} to {toLabel}
        </caption>
        <thead>
          <tr>
            <th scope="col" style={{ width: '28%' }}>
              Record · field
            </th>
            <th scope="col">Exact change (source values, unmodified)</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => (
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
                  {c.flags.length === 0 ? (
                    <span className="ist-meta" title="No equivalence flag: the change is substantive">
                      No equivalence flag
                    </span>
                  ) : (
                    c.flags.map((f) => <DiffFlagTag key={f} flag={f} />)
                  )}
                </div>
                {(c.oldFieldHash || c.newFieldHash) && (
                  <div className="ist-stack" style={{ gap: 2, marginBlockStart: 8 }}>
                    <span className="ist-meta">Field hashes</span>
                    <Hash label="old" value={c.oldFieldHash ?? null} />
                    <Hash label="new" value={c.newFieldHash ?? null} />
                  </div>
                )}
              </td>
              <td>
                <ExactDiff oldValue={c.oldValue} newValue={c.newValue} oldLabel={fromLabel} newLabel={toLabel} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sideLabel(v: Version | null, side: 'from' | 'to'): string {
  if (!v) return side === 'from' ? 'previous' : 'candidate';
  const role = v.status === 'TRUSTED' || v.status === 'SUPERSEDED' ? 'trusted' : side === 'to' ? 'candidate' : 'untrusted';
  return `${versionName(v)} · ${role}`;
}

export function TransitionChanges({ transition }: { transition: Transition }) {
  const { from, to, changes } = transition;
  return (
    <div className="ist-stack" style={{ gap: 0 }}>
      <div className="ist-row" style={{ justifyContent: 'space-between', marginBlockEnd: 10 }}>
        <h3 className="ist-h3">
          <Mono>{from ? versionName(from) : '—'}</Mono> → <Mono>{versionName(to)}</Mono>
          {to.silentMutation && (
            <span style={{ marginInlineStart: 10 }}>
              <SilentMutationBadge />
            </span>
          )}
        </h3>
        <span className="ist-meta">
          {changes.length} {changes.length === 1 ? 'change' : 'changes'}
        </span>
      </div>
      {changes.length === 0 ? (
        <p className="ist-meta" style={{ margin: 0 }}>
          {to.changeClass === 'SERIALIZATION_ONLY'
            ? 'No record or field changed. The raw bytes differ only in serialization, so the diff is empty.'
            : 'No record or field changes were persisted for this transition.'}
        </p>
      ) : (
        <ChangeRows changes={changes} fromLabel={sideLabel(from, 'from')} toLabel={sideLabel(to, 'to')} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Field roles

export function FieldRoleMap({ roles }: { roles: SourceDetail['fieldRoles'] }) {
  const entries = Object.entries(roles).sort(([a], [b]) => a.localeCompare(b));
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

// ------------------------------------------------------------------ Source checks

const CHECK_TEXT: Record<string, string> = {
  NEW_VERSION: 'New version stored',
  NO_CHANGE: 'No change (identical bytes)',
};

export function SourceChecks({ checks, versions }: { checks: NonNullable<SourceDetail['checks']>; versions: Version[] }) {
  const byId = new Map(versions.map((v) => [v.id, v]));
  return (
    <div className="ist-table-wrap">
      <table className="ist-table">
        <caption className="ist-sr-only">Recent source checks</caption>
        <thead>
          <tr>
            <th scope="col">Checked</th>
            <th scope="col">Trigger</th>
            <th scope="col">Result</th>
            <th scope="col">Raw SHA-256</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => {
            const v = c.sourceVersionId ? byId.get(c.sourceVersionId) : undefined;
            return (
              <tr key={c.id}>
                <td className="ist-meta">{formatTimestamp(c.checkedAt)}</td>
                <td>
                  <span className="ist-tag">{c.triggerType.toLowerCase()}</span>
                </td>
                <td>
                  {c.errorCode ? (
                    <span style={{ color: 'var(--coral)' }}>
                      Failed · <Mono>{c.errorCode}</Mono>
                    </span>
                  ) : (
                    CHECK_TEXT[c.status] ?? c.status
                  )}
                  {v && (
                    <div className="ist-meta">
                      → <Mono>{versionName(v)}</Mono>
                    </div>
                  )}
                </td>
                <td>
                  <Hash label="" value={c.rawSha256} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
