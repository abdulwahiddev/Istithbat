import Link from 'next/link';
import type { IncidentAggregate, IncidentListItem } from '@/lib/contracts';
import { AiModeLabel } from '../banners/Banners';
import { Hash, Mono, SourceValue, formatTimestamp } from '../evidence/Evidence';
import { ProvenanceBlock } from '../provenance/Provenance';
import { FieldRoleTag, SilentMutationBadge, VersionStatusBadge } from '../status/Status';
import { ChangeRows } from '../sources/SourceViews';
import { versionName } from '../sources/derive';
import { contextElementKinds, readAnalysisOutput, type ContextPacketView } from './context';
import { stagesForIncident, type Stage, type StageState } from './pipeline';

// ------------------------------------------------------------------ status

const INCIDENT_STATUS: Record<string, { text: string; cls: string }> = {
  ANALYZING: { text: 'Analysing', cls: 'ist-badge--analysis' },
  NEEDS_REVIEW: { text: 'Needs review', cls: 'ist-badge--pending' },
  QUARANTINED: { text: 'Quarantined', cls: 'ist-badge--blocked' },
  RESOLVED: { text: 'Resolved', cls: 'ist-badge--muted' },
};
export function IncidentStatusBadge({ status }: { status: string }) {
  const s = INCIDENT_STATUS[status] ?? { text: status, cls: 'ist-badge--muted' };
  return (
    <span className={`ist-badge ${s.cls}`} title="Incident status (system state, not a verdict on the content)">
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      Incident · {s.text}
    </span>
  );
}

// ------------------------------------------------------------------ pipeline

const STATE_TEXT: Record<StageState, string> = {
  complete: 'Complete',
  active: 'In progress',
  next: 'Next',
  pending: 'Pending',
  retryable: 'Retrying',
  failed: 'Failed',
  'not-scheduled': 'Not scheduled',
  'not-reached': 'Not reached',
};

function StageGlyph({ state }: { state: StageState }) {
  const c = { width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': true } as const;
  if (state === 'complete')
    return (
      <svg {...c}>
        <circle cx="7" cy="7" r="6" fill="currentColor" opacity="0.2" stroke="currentColor" />
        <path d="M4 7.2 6.2 9.3 10 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  if (state === 'failed')
    return (
      <svg {...c}>
        <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" />
        <path d="M4.8 4.8l4.4 4.4M9.2 4.8l-4.4 4.4" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  if (state === 'active' || state === 'retryable')
    return (
      <svg {...c}>
        <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" opacity="0.35" />
        <path d="M7 1a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  return (
    <svg {...c}>
      <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeDasharray={state === 'next' ? undefined : '2.4 1.8'} />
    </svg>
  );
}

export function PipelineTrack({ stages }: { stages: Stage[] }) {
  return (
    <ol className="ist-track" aria-label="Investigation pipeline">
      {stages.map((s) => (
        <li key={s.key} className="ist-track__stage" data-state={s.state} aria-label={`${s.label}: ${STATE_TEXT[s.state]}. ${s.note}`}>
          <div className="ist-track__top">
            <span className="ist-track__state">
              <StageGlyph state={s.state} />
            </span>
            <span className="ist-track__label">{s.label}</span>
          </div>
          <span className="ist-track__state">{STATE_TEXT[s.state]}</span>
          <span className="ist-track__note">{s.note}</span>
        </li>
      ))}
    </ol>
  );
}

/** Compact seven-pip version for list rows. */
export function PipelinePips({ stages }: { stages: Stage[] }) {
  const done = stages.filter((s) => s.state === 'complete').length;
  const label = stages.map((s) => `${s.label}: ${STATE_TEXT[s.state]}`).join('; ');
  return (
    <div className="ist-stack" style={{ gap: 4 }}>
      <span className="ist-track ist-track--compact" role="img" aria-label={label}>
        {stages.map((s) => (
          <span key={s.key} className="ist-track__pip" data-state={s.state} title={`${s.label}: ${STATE_TEXT[s.state]}`} />
        ))}
      </span>
      <span className="ist-meta">
        {done}/{stages.length} stages complete
      </span>
    </div>
  );
}

export function PipelineStepTable({ inc }: { inc: IncidentAggregate }) {
  if (!inc.pipeline) return <p className="ist-meta">No pipeline run is recorded for this candidate.</p>;
  return (
    <details className="ist-details">
      <summary>
        Backend step log · run <Mono>{inc.pipeline.id.slice(0, 8)}</Mono> · {inc.pipeline.status.toLowerCase()}
      </summary>
      <div className="ist-table-wrap" style={{ marginBlockStart: 10 }}>
        <table className="ist-table">
          <caption className="ist-sr-only">Persisted pipeline steps</caption>
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">Status</th>
              <th scope="col">Attempts</th>
              <th scope="col">Started</th>
              <th scope="col">Completed</th>
              <th scope="col">Error</th>
            </tr>
          </thead>
          <tbody>
            {inc.pipelineSteps.map((s) => (
              <tr key={`${s.step}-${s.itemKey}`}>
                <td>
                  <Mono>
                    {s.step}
                    {s.itemKey ? `:${s.itemKey}` : ''}
                  </Mono>
                </td>
                <td>{s.status}</td>
                <td>{s.attempts}</td>
                <td className="ist-meta">{formatTimestamp(s.startedAt)}</td>
                <td className="ist-meta">{formatTimestamp(s.completedAt)}</td>
                <td>{s.errorCode ? <Mono>{s.errorCode}</Mono> : <span className="ist-meta">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ------------------------------------------------------------------ incident list

export function IncidentTable({ rows }: { rows: Array<{ item: IncidentListItem; detail: IncidentAggregate | null }> }) {
  return (
    <div className="ist-table-wrap">
      <table className="ist-table">
        <caption className="ist-sr-only">Incidents, newest first</caption>
        <thead>
          <tr>
            <th scope="col">Incident</th>
            <th scope="col">Exact change (deterministic)</th>
            <th scope="col">Pipeline</th>
            <th scope="col">Machine analysis</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item, detail }) => {
            const primary = detail?.changes.find((c) => c.id === detail.primaryChangeId) ?? detail?.changes[0];
            const extra = detail ? detail.changes.length - 1 : 0;
            return (
              <tr key={item.id}>
                <td>
                  <Link href={`/incidents/${item.id}`} className="ist-table__primary">
                    {detail ? (
                      <>
                        <Mono>{item.sourceId}</Mono> · <Mono>{versionName(detail.candidateVersion)}</Mono>
                      </>
                    ) : (
                      item.title
                    )}
                  </Link>
                  <div className="ist-row" style={{ marginBlockStart: 6 }}>
                    <IncidentStatusBadge status={item.status} />
                    {item.silentMutation && <SilentMutationBadge />}
                  </div>
                  <div className="ist-meta" style={{ marginBlockStart: 6 }}>
                    Opened {formatTimestamp(item.openedAt)} · <Mono>{item.id.slice(0, 8)}</Mono>
                  </div>
                </td>
                <td>
                  {primary ? (
                    <>
                      <div>
                        <Mono>{primary.canonicalKey}</Mono> · <Mono>{primary.fieldPath ?? '(record)'}</Mono>
                      </div>
                      <div className="ist-row" style={{ marginBlockStart: 6 }}>
                        <FieldRoleTag role={primary.fieldRole} />
                        {extra > 0 && <span className="ist-meta">+{extra} more</span>}
                      </div>
                      {detail?.previousVersion && (
                        <div className="ist-meta" style={{ marginBlockStart: 6 }}>
                          vs <Mono>{versionName(detail.previousVersion)}</Mono>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="ist-meta">Unavailable</span>
                  )}
                </td>
                <td>{detail ? <PipelinePips stages={stagesForIncident(detail)} /> : <span className="ist-meta">Unavailable</span>}</td>
                <td>
                  {item.analysisMode ? (
                    <div className="ist-stack" style={{ gap: 6, alignItems: 'flex-start' }}>
                      <AiModeLabel mode={item.analysisMode} recordedAt={detail?.analysis?.meta.recordedAt ?? null} />
                      {item.riskLevel && (
                        <span className="ist-meta" style={{ color: 'var(--text-analysis)' }}>
                          Advisory risk: {item.riskLevel.toLowerCase()}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="ist-meta">No analysis yet</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ deterministic evidence

export function DeterministicEvidence({ inc, packet }: { inc: IncidentAggregate; packet: ContextPacketView | null }) {
  const cand = inc.candidateVersion;
  const prev = inc.previousVersion;
  const trusted = packet?.trusted ?? null;
  const prevIsTrusted = !!prev && !!trusted && prev.id === trusted.id;
  const sameLabel = !!prev && prev.upstreamLabel === cand.upstreamLabel;
  const fromLabel = prev ? `${versionName(prev)} · ${prevIsTrusted ? 'trusted' : 'untrusted previous'}` : 'previous';
  const toLabel = `${versionName(cand)} · candidate`;
  const primary = inc.changes.find((c) => c.id === inc.primaryChangeId);
  const ordered = primary ? [primary, ...inc.changes.filter((c) => c.id !== primary.id)] : inc.changes;
  const kinds = contextElementKinds(packet);

  return (
    <ProvenanceBlock kind="deterministic" label="Deterministic evidence" aside={<span className="ist-meta">Computed by Istithbat · reproducible</span>}>
      <dl className="ist-kv" style={{ marginBlockEnd: 20 }}>
        <div>
          <dt>Candidate</dt>
          <dd className="ist-row" style={{ gap: 8 }}>
            <Mono>{versionName(cand)}</Mono>
            <VersionStatusBadge status={cand.status} />
          </dd>
        </div>
        <div>
          <dt>Compared against</dt>
          <dd>
            {prev ? <Mono>{versionName(prev)}</Mono> : '—'}
            <div className="ist-meta">{prevIsTrusted ? 'the trusted version' : 'previous observation (not trusted)'}</div>
          </dd>
        </div>
        <div>
          <dt>Trusted baseline</dt>
          <dd>
            {trusted ? <Mono>{`${trusted.label} r${trusted.revision}`}</Mono> : '—'}
            <div className="ist-meta">still served</div>
          </dd>
        </div>
        <div>
          <dt>Upstream label</dt>
          <dd>
            <Mono>{cand.upstreamLabel}</Mono>
            {cand.silentMutation && (
              <div className="ist-meta" style={{ color: 'var(--coral)' }}>
                unchanged from {prev ? versionName(prev) : 'previous'}: silent mutation
              </div>
            )}
          </dd>
        </div>
        <div>
          <dt>Candidate fingerprints</dt>
          <dd className="ist-stack" style={{ gap: 2 }}>
            <Hash label="raw" value={cand.rawSha256} />
            <Hash label="canonical" value={cand.canonicalSha256} />
          </dd>
        </div>
        <div>
          <dt>Context packet</dt>
          <dd className="ist-stack" style={{ gap: 2 }}>
            <Hash label="sha256" value={inc.contextPacketHash} />
            <span className="ist-meta">Exactly what the analysis step received</span>
          </dd>
        </div>
      </dl>

      {cand.silentMutation && prev && sameLabel && (
        <div className="ist-callout" style={{ marginBlockEnd: 20 }}>
          <div className="ist-row" style={{ marginBlockEnd: 8 }}>
            <SilentMutationBadge />
            <strong style={{ fontSize: 14 }}>
              Same upstream label <Mono>{cand.upstreamLabel}</Mono>, different content
            </strong>
          </div>
          <dl className="ist-dl">
            <dt>
              <Mono>{versionName(prev)}</Mono>
            </dt>
            <dd className="ist-row" style={{ gap: 16 }}>
              <Hash label="raw" value={prev.rawSha256} />
              <Hash label="canonical" value={prev.canonicalSha256} />
            </dd>
            <dt>
              <Mono>{versionName(cand)}</Mono>
            </dt>
            <dd className="ist-row" style={{ gap: 16 }}>
              <Hash label="raw" value={cand.rawSha256} />
              <Hash label="canonical" value={cand.canonicalSha256} />
            </dd>
            <dt>Cause</dt>
            <dd>Unknown. The fingerprint proves the content changed under the same label, not why.</dd>
          </dl>
        </div>
      )}

      <h3 className="ist-h3" style={{ marginBlockEnd: 10 }}>
        Exact changes <span className="ist-meta">({inc.changes.length}; primary change first)</span>
      </h3>
      {ordered.length ? (
        <ChangeRows changes={ordered} fromLabel={fromLabel} toLabel={toLabel} />
      ) : (
        <p className="ist-meta">No changes are attached to this incident.</p>
      )}

      {kinds.length > 0 && (
        <div className="ist-row" style={{ marginBlockStart: 14 }}>
          <span className="ist-meta">Typed context elements given to analysis:</span>
          {kinds.map((k) => (
            <span key={k} className="ist-tag">
              <Mono>{k}</Mono>
            </span>
          ))}
        </div>
      )}
    </ProvenanceBlock>
  );
}

// ------------------------------------------------------------------ source record

/** The candidate record exactly as the provider published it (from the persisted context packet). */
export function SourceRecordPanel({ packet, changedPaths, roles }: { packet: ContextPacketView | null; changedPaths: string[]; roles: Record<string, string> }) {
  const records = packet?.records ?? [];
  if (!records.length) return null;
  const changedTop = new Set(changedPaths.map((p) => p.split(/[.[]/)[0]));
  const roleOf = (key: string): string | null =>
    roles[key] ?? Object.entries(roles).find(([p]) => p.startsWith(`${key}.`) || p === `${key}[]`)?.[1] ?? null;
  return (
    <ProvenanceBlock kind="source" label="Source record · candidate as published" aside={<span className="ist-meta">Verbatim · not interpreted</span>}>
      {records.map((r) => {
        const content = r.new_content ?? {};
        const rows = Object.entries(content).sort(([a], [b]) => (ROLE_ORDER[roleOf(a) ?? ''] ?? 9) - (ROLE_ORDER[roleOf(b) ?? ''] ?? 9) || a.localeCompare(b));
        const primaryRows = rows.filter(([k]) => roleOf(k) !== 'OPERATIONAL_METADATA' || changedTop.has(k));
        const metaRows = rows.filter(([k]) => roleOf(k) === 'OPERATIONAL_METADATA' && !changedTop.has(k));
        return (
          <div key={r.canonical_key} className="ist-table-wrap">
            <table className="ist-table">
              <caption className="ist-sr-only">Fields of record {r.canonical_key} in the candidate version</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ width: '24%' }}>
                    <Mono>{r.canonical_key}</Mono>
                  </th>
                  <th scope="col">Value</th>
                </tr>
              </thead>
              <tbody>
                {primaryRows.map(([key, value]) => (
                  <RecordRow key={key} field={key} value={value} role={roleOf(key)} changed={changedTop.has(key)} />
                ))}
              </tbody>
            </table>
            {metaRows.length > 0 && (
              <details className="ist-details" style={{ padding: '10px 12px' }}>
                <summary>Operational metadata ({metaRows.length} fields, unchanged)</summary>
                <table className="ist-table">
                  <caption className="ist-sr-only">Unchanged operational metadata of {r.canonical_key}</caption>
                  <tbody>
                    {metaRows.map(([key, value]) => (
                      <RecordRow key={key} field={key} value={value} role={roleOf(key)} changed={false} />
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </div>
        );
      })}
    </ProvenanceBlock>
  );
}

const ROLE_ORDER: Record<string, number> = {
  AUTHORITATIVE_TEXT: 0,
  SCHOLAR_JUDGMENT: 1,
  TRANSLATION: 2,
  PROVENANCE: 3,
  COMMENTARY: 4,
  UNCLASSIFIED: 5,
  OPERATIONAL_METADATA: 6,
};

function RecordRow({ field, value, role, changed }: { field: string; value: unknown; role: string | null; changed: boolean }) {
  return (
    <tr style={changed ? { background: 'var(--amber-tint)' } : undefined}>
      <td style={{ width: '24%' }}>
        <Mono>{field}</Mono>
        <div className="ist-row" style={{ marginBlockStart: 4 }}>
          {role && <FieldRoleTag role={role} />}
          {changed && <span className="ist-badge ist-badge--pending">changed</span>}
        </div>
      </td>
      <td style={{ minWidth: 0 }}>
        <SourceValue value={value} />
      </td>
    </tr>
  );
}

// ------------------------------------------------------------------ machine analysis

export function MachineAnalysis({ inc }: { inc: IncidentAggregate }) {
  const a = inc.analysis;
  const analysisStep = inc.pipelineSteps.find((s) => s.step === 'ANALYSIS');
  if (!a) {
    const failed = analysisStep?.status === 'FAILED' || !!analysisStep?.errorCode;
    return (
      <ProvenanceBlock kind="analysis" label="Machine analysis · advisory">
        <p className="ist-meta" style={{ margin: 0 }}>
          {failed
            ? `Analysis unavailable: ${analysisStep?.errorCode ?? 'AI_ANALYSIS_FAILED'} (attempt ${analysisStep?.attempts ?? 0}). The deterministic evidence above is unaffected, and the candidate stays untrusted.`
            : 'No analysis has been recorded yet. The deterministic evidence above stands on its own.'}
        </p>
      </ProvenanceBlock>
    );
  }
  const out = readAnalysisOutput(a.output);
  const meta = a.meta;
  const hashMatches = a.contextPacketHash === inc.contextPacketHash;

  return (
    <ProvenanceBlock kind="analysis" label="Machine analysis · advisory" aside={<AiModeLabel mode={meta.mode} recordedAt={meta.recordedAt} />}>
      {meta.mode === 'mock' && (
        <div className="ist-banner ist-banner--preview" role="note" style={{ marginBlockEnd: 16 }}>
          <div className="ist-banner__body">
            <strong>AI analysis — mock mode</strong>
            <span className="ist-banner__meta">
              This is a deterministic placeholder produced without calling a model. It shows where analysis appears; it is not an
              assessment of this change.
            </span>
          </div>
        </div>
      )}

      {out ? (
        <div className="ist-stack" style={{ gap: 18 }}>
          <p style={{ margin: 0, fontSize: 16 }}>{out.executive_summary}</p>
          <dl className="ist-kv">
            <div>
              <dt>Analysis type</dt>
              <dd>
                <Mono>{out.analysis_type}</Mono>
              </dd>
            </div>
            <div>
              <dt>Advisory risk</dt>
              <dd>{out.risk_level.toLowerCase()}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{out.confidence.toLowerCase()}</dd>
            </div>
            <div>
              <dt>Meaning may have changed</dt>
              <dd>{out.meaning_changed ? 'yes' : 'no'}</dd>
            </div>
            <div>
              <dt>Specialist review suggested</dt>
              <dd>{out.requires_specialist_review ? 'yes' : 'no'}</dd>
            </div>
            <div>
              <dt>Recommended action</dt>
              <dd>
                <Mono>{out.recommended_action}</Mono>
                <div className="ist-meta">Advice only. Policy has {inc.policyEvaluation ? '' : 'not yet '}been evaluated.</div>
              </dd>
            </div>
          </dl>
          <dl className="ist-dl">
            <dt>What changed</dt>
            <dd>{out.what_changed}</dd>
            <dt>Why it may matter</dt>
            <dd>{out.why_it_matters}</dd>
            <dt>Linguistic</dt>
            <dd>{out.domain_analysis.linguistic}</dd>
            <dt>Evidence scope</dt>
            <dd>{out.domain_analysis.evidence_scope}</dd>
            <dt>Provenance effect</dt>
            <dd>{out.domain_analysis.provenance_effect}</dd>
            <dt>Downstream effects</dt>
            <dd>
              <ul className="ist-list">
                {out.potential_downstream_effects.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </dd>
            <dt>Uncertainties</dt>
            <dd>
              <ul className="ist-list">
                {out.uncertainties.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </dd>
          </dl>
        </div>
      ) : (
        <p className="ist-meta">The stored analysis does not match the expected structure, so it is not interpreted here. The raw output is below.</p>
      )}

      <div className="ist-row" style={{ marginBlockStart: 18, gap: '6px 18px' }}>
        <span className="ist-meta">
          Provider <Mono>{meta.provider}</Mono> · model <Mono>{meta.model}</Mono> · prompt <Mono>{String((meta as Record<string, unknown>).promptId ?? '')}</Mono>
          <Mono>@{meta.promptVersion}</Mono> · recorded {formatTimestamp(a.createdAt)}
        </span>
        <span className="ist-meta" style={{ color: hashMatches ? 'var(--turquoise)' : 'var(--coral)' }}>
          {hashMatches ? 'Analysed context hash matches this incident' : 'Analysed context hash differs from this incident'}
        </span>
      </div>
      <p className="ist-meta" style={{ marginBlockEnd: 0 }}>
        Analysis interprets a change. It does not rule on which grading is correct, and it cannot lower a policy action.
      </p>
      <details className="ist-details" style={{ marginBlockStart: 10 }}>
        <summary>Raw structured output</summary>
        <pre dir="ltr">{JSON.stringify(a.output, null, 2)}</pre>
      </details>
    </ProvenanceBlock>
  );
}

// ------------------------------------------------------------------ human decision

export function HumanDecision({ inc }: { inc: IncidentAggregate }) {
  return (
    <ProvenanceBlock kind="human" label="Human decision">
      {inc.reviews.length === 0 ? (
        <p className="ist-meta" style={{ margin: 0 }}>
          Not reached. No reviewer decision has been recorded. The candidate <Mono>{versionName(inc.candidateVersion)}</Mono> is untrusted
          and is not served; protected apps continue to receive the trusted version.
        </p>
      ) : (
        <p style={{ margin: 0 }}>
          {inc.reviews.length} review decision{inc.reviews.length === 1 ? '' : 's'} recorded.
        </p>
      )}
    </ProvenanceBlock>
  );
}

// ------------------------------------------------------------------ activity

export function ActivityLog({ inc }: { inc: IncidentAggregate }) {
  const events = (inc.audit as Array<{ id: string; eventType: string; actor: string; createdAt: string }>).filter((e) => e && e.id);
  if (!events.length) return <p className="ist-meta">No audit events recorded.</p>;
  return (
    <ol className="ist-timeline">
      {events.map((e) => (
        <li key={e.id} className="ist-timeline__item" style={{ paddingBlock: 8 }}>
          <span className="ist-timeline__dot" style={{ ['--dot' as string]: 'var(--border-strong)' }} aria-hidden="true" />
          <div className="ist-row" style={{ justifyContent: 'space-between' }}>
            <span>
              <Mono>{e.eventType}</Mono>
            </span>
            <span className="ist-row" style={{ gap: 12 }}>
              <span className="ist-meta">
                <Mono>{e.actor}</Mono>
              </span>
              <span className="ist-meta">{formatTimestamp(e.createdAt)}</span>
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
