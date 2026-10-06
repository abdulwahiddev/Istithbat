import { notFound } from 'next/navigation';
import { GatewayLanes, type GateLane } from '@/components/gateway/GateInstrument';
import { FOLDED, LANE_MARK, narrate } from '@/components/strata/events';
import { dayTime, evTime, versionText } from '@/components/strata/format';
import { Band, Chip, Dk, Ev, HandedToYou, HeadRow, HeldBy, Lnk, Mk, Mono, PageHeader, Rail, ReadError, Sep, SummaryDock } from '@/components/strata/primitives';
import { summarizeIncident } from '../../_data/incident-summary';
import { readAudit, readGatewayInventory, readGatewayState, readIncidentItem, readSources, readShell } from '../../_data/read';

export const metadata = { title: 'Trust Gateway · Istithbat' };
export const dynamic = 'force-dynamic';

const vr = (v: { label: string; revisionNumber: number } | null | undefined) => (v ? versionText(v.label, v.revisionNumber) : '—');
/** Badge / sentence label: the provider label, or rN when the provider publishes none. */
const vb = (v: { label: string; revisionNumber: number } | null | undefined) => (v ? versionText(v.label, v.revisionNumber, 'label') : '—');

export default async function GatewayPage({ params }: { params: Promise<{ appId: string }> }) {
  const appId = decodeURIComponent((await params).appId);
  await readShell(); // queue the chrome's reads first so the skeleton streams immediately
  const inventory = await readGatewayInventory();
  if (!inventory.ok) return <main id="main" className="scr-gateway"><section style={{ padding: '72px 0 120px' }}><div className="wrap"><ReadError {...inventory.error} /></div></section></main>;
  const rows = inventory.data.filter((i) => i.appId === appId && i.binding);
  if (!rows.length) notFound();
  const primary = rows.find((r) => r.heldCandidate) ?? rows[0];
  const state = await readGatewayState(appId, primary.sourceId);
  if (!state.ok) return <main id="main" className="scr-gateway"><section style={{ padding: '72px 0 120px' }}><div className="wrap"><ReadError {...state.error} /></div></section></main>;
  if (!state.data) notFound();
  const g = state.data;
  const sources = await readSources();
  const source = sources.ok ? sources.data.find((s) => s.id === g.sourceId) ?? null : null;
  const heldItem = g.heldCandidate ? await readIncidentItem(g.heldCandidate.incidentId) : null;
  const inc = heldItem?.ok ? heldItem.data : null;
  const f = inc ? await summarizeIncident(inc) : null;
  const audit = await readAudit(inc ? { incidentId: inc.id, limit: 100 } : { limit: 100 });
  const versionIds = new Set([g.latestSeen.id, g.served.id, g.latestTrusted?.id].filter(Boolean) as string[]);
  const labelOf = new Map([g.latestSeen, g.served, g.latestTrusted].filter(Boolean).map((v) => [v!.id, vr(v)]));
  const history = audit.ok ? audit.data.events.filter((e) => !FOLDED.test(e.eventType) && (inc
    ? ['SOURCE_VERSION_DETECTED', 'POLICY_EVALUATED', 'VERSION_QUARANTINED', 'VERSION_PROMOTED', 'REVIEW_DECISION', 'BASELINE_SEEDED', 'BASELINE_ESTABLISHED'].includes(e.eventType)
    : (e.entityType === 'source_version' && versionIds.has(e.entityId)) || (e.entityType === 'source' && e.entityId === g.sourceId))).slice(0, 6) : [];
  const held = g.heldCandidate;
  const candidateLabel = held ? vb(held.version) : null;
  const policyCode = f?.policyCode ?? null;
  const allowCase = policyCode === 'POL-005';
  const synthetic = source?.isDemoFixture ?? false;
  const stateText = (st: string) => (st === 'QUARANTINED' ? 'Quarantined' : st === 'ANALYZING' ? 'Investigating' : 'Held for review');
  // Every source bound to this app, each with its own trusted/served versions and held candidate.
  const lanes: GateLane[] = rows.map((r) => ({
    sourceId: r.sourceId, sourceName: r.sourceName.split(' — ')[0], trusted: vb(r.latestTrusted), served: vb(r.served),
    candidate: r.heldCandidate ? { label: vb(r.heldCandidate.version), state: stateText(r.heldCandidate.incidentStatus), policyCode: r.sourceId === g.sourceId ? policyCode : null } : null,
  }));
  const heldCount = lanes.filter((l) => l.candidate).length;

  return (
    <main id="main" className="scr-gateway">
      <PageHeader
        crumbs={<><span>Trust Gateway</span><Sep /><span>{g.appName}</span></>}
        synthetic={synthetic}
        title={heldCount > 1 ? <>{heldCount} candidates are held.<br />Trusted versions keep serving.</> : held ? <>{vb(held.version)} is held.<br />{vb(g.served)} keeps serving.</> : heldCount ? <>One candidate is held.<br />Trusted versions keep serving.</> : <>Nothing is held.<br />{lanes.length > 1 ? 'Trusted versions are serving.' : `${vb(g.served)} is serving.`}</>}
        lede={held ? 'Production reads only the trusted version. The newest upstream version waits at the gate until a person signs.' : 'Production reads only the trusted version. Any new upstream version will wait at the gate until policy or a person releases it.'}
        status={<>
          <Dk k="Gateway"><Chip tone={g.served.status === 'TRUSTED' ? 'tq' : 'co'}>{g.served.status === 'TRUSTED' ? 'Serving trusted' : 'Not serving trusted'}</Chip></Dk>
          <Dk k="Protected app"><Mono>{g.appId}</Mono></Dk>
          <Dk k="Binding updated">{dayTime(g.binding.updatedAt)}</Dk>
        </>}
      />

      <Band id="gate" labelledBy="h-gate" first>
        <Rail layer="pol" id="h-gate" title="Gateway">What production reads and what waits outside.</Rail>
        <div className="main">
          <GatewayLanes appName={g.appName} lanes={lanes} initialSourceId={g.sourceId} />
        </div>
      </Band>

      <Band id="bindings" labelledBy="h-bind">
        <Rail layer="det" id="h-bind" title="Bindings">One row per protected app and source.</Rail>
        <div className="main">
          <HeadRow title="Gateway bindings" right={<span className="meta mono">gateway_bindings</span>} />
          <div className="plate tight" style={{ overflowX: 'auto' }}>
            <table className="tb">
              <thead><tr><th>Protected app</th><th>Source</th><th>Serves</th><th>Latest seen</th><th>Status</th><th style={{ textAlign: 'right' }}>Updated</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.binding!.id}>
                    <td><b style={{ fontWeight: 600 }}>{r.appName}</b><br /><span className="mono meta">{r.appId}</span></td>
                    <td>{r.sourceName.split(' — ')[0]}<br /><span className="mono meta">{r.sourceId}</span></td>
                    <td><span className="chip"><span className="dot" style={{ background: r.served?.status === 'TRUSTED' ? 'var(--tq)' : 'var(--co)' }} /><span className="mono">{vr(r.served)}</span></span></td>
                    <td><span className="chip"><span className="dot" style={{ background: r.heldCandidate ? 'var(--co)' : 'var(--tq)' }} /><span className="mono">{vr(r.latestSeen)}</span></span></td>
                    <td><span className="mono" style={{ fontSize: 13 }}>{r.gatewayStatus}</span></td>
                    <td style={{ textAlign: 'right', color: 'var(--ink-3)' }}>{dayTime(r.binding!.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sub" style={{ rowGap: 24 }}>
            <div className="c1-5" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="mono" style={{ fontSize: 13 }}>GATEWAY_RESOLVED</span><Chip tone="tq" small>Re-points with the gate</Chip></span>
              <p className="body">Assets that read through the gateway switch versions in the same transaction as the binding. They never go stale.</p>
            </div>
            <div className="c6-10" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="mono" style={{ fontSize: 13 }}>MATERIALIZED</span><Chip tone="am" small>Goes stale after promotion</Chip></span>
              <p className="body">Frozen copies keep the version they were built from. After a promotion they are marked stale until rebuilt.</p>
            </div>
          </div>
          <details>
            <summary>Gateway response for this binding</summary>
            <div className="raw">{`GET /api/gateway/${g.appId}/sources/${g.sourceId}\n\n${JSON.stringify(g, null, 2)}`}</div>
          </details>
        </div>
      </Band>

      <Band id="opening" labelledBy="h-open">
        <Rail layer="pol" id="h-open" title="Promotion">Only a signed approval or POL-005 can trust a version.</Rail>
        <div className="main">
          <HeadRow title="Promotion paths" />
          <div className="sub" style={{ rowGap: 16, alignItems: 'stretch' }}>
            <div className="c1-5 plate in l" style={{ marginLeft: -24, padding: '20px 20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: held && !allowCase ? '0 0 0 1px var(--ink),var(--plate-shadow)' : undefined }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><b style={{ fontSize: 17, fontWeight: 600 }}>Signed human approval</b>
                {held && !allowCase ? <span className="chip" style={{ padding: '1px 9px 1px 7px', fontSize: 12, color: 'var(--ink)' }}><Mk layer="hum" style={{ width: 7, height: 7 }} />This case</span> : <Chip tone="n4" small>No case open</Chip>}</span>
              <p className="body">A reviewer approves the incident. Required for every quarantined or review-held candidate.</p>
              <span className="meta"><span className="mono">REVIEW_DECISION · APPROVE</span></span>
            </div>
            <div className="c6-10 plate in r" style={{ marginRight: -24, padding: '20px 24px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10, background: 'transparent', border: '1px dashed var(--line-2)', boxShadow: 'none' }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><b style={{ fontSize: 17, fontWeight: 600 }}><span className="mono">POL-005</span> allow</b><Chip tone="n4" small>{held ? 'Not applicable' : 'Not in use'}</Chip></span>
              <p className="body">Deterministic fast path for metadata, whitespace, Unicode or serialization-only changes.{held && inc?.primaryChange?.fieldRole ? ` ${vb(held.version)} changed a ${inc.primaryChange.fieldRole === 'SCHOLAR_JUDGMENT' ? 'judgment' : inc.primaryChange.fieldRole.toLowerCase().replace(/_/g, ' ')}, so it cannot use it.` : ''}</p>
              <span className="meta"><span className="mono">ALLOW · no incident</span></span>
            </div>
          </div>
          <div className="plate" style={{ paddingTop: 28, paddingBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}><b style={{ fontSize: 17, fontWeight: 600 }}>Promotion transaction</b><span className="meta mono">promoteCandidateTx</span></div>
            <ol className="steps">
              <li><span className="n">1</span><span className="t">Lock the source, its bindings, the candidate, the trusted version and the policy evaluation</span><span className="m mono">FOR UPDATE</span></li>
              <li><span className="n">2</span><span className="t">Assert the transition is legal: every binding still serves the trusted version</span><span className="m mono">INVALID_REVIEW_TRANSITION</span></li>
              <li><span className="n">3</span><span className="t">Supersede {g.latestTrusted ? <span className="mono">{vb(g.latestTrusted)}</span> : 'the trusted version'}</span><span className="m mono">TRUSTED → SUPERSEDED</span></li>
              <li><span className="n">4</span><span className="t">Trust {candidateLabel ? <span className="mono">{candidateLabel}</span> : 'the candidate'}</span><span className="m mono">{held ? `${held.version.status} → TRUSTED` : '→ TRUSTED'}</span></li>
              <li><span className="n">5</span><span className="t">Re-point the gateway binding for {g.appName}</span><span className="m mono">served → {candidateLabel ?? 'candidate'}</span></li>
              <li><span className="n">6</span><span className="t">Re-point gateway-resolved derivations</span><span className="m mono">GATEWAY_RESOLVED</span></li>
              <li><span className="n">7</span><span className="t">Record the signed decision and resolve the incident</span><span className="m mono">REVIEW_DECISION</span></li>
              <li><span className="n">8</span><span className="t">Write the audit event</span><span className="m mono">VERSION_PROMOTED</span></li>
            </ol>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
              <span className="chip" style={{ color: 'var(--ink)' }}><span className="dot" style={{ background: 'var(--tq)' }} />All or nothing</span>
              <span className="body" style={{ color: 'var(--ink-3)' }}>If any step fails, the whole transaction rolls back and <span className="mono">{vb(g.served)}</span> keeps serving.</span>
            </div>
          </div>
        </div>
      </Band>

      <Band id="record" labelledBy="h-rec">
        <Rail layer="det" id="h-rec" title="Audit">Changes to what this binding serves.</Rail>
        <div className="main">
          <HeadRow title="Binding history" right={inc ? <Lnk href={`/incidents/${inc.id}/record`}>Full record</Lnk> : undefined} />
          {!audit.ok ? <ReadError {...audit.error} /> : (
            <div className="plate tight">
              {held && <Ev mark={<Mk layer="hum" style={{ background: 'var(--ink-4)' }} />} time="pending" title={`Decision on ${vb(held.version)}`} note="Not yet signed. The gate stays locked." code={<span style={{ fontFamily: 'inherit' }}>Reviewer</span>} />}
              {history.map((e) => {
                const n = narrate(e, { versionLabel: (id) => (id ? labelOf.get(id) ?? null : null), servedLabel: vb(g.served), appName: g.appName });
                return <Ev key={e.id} mark={<Mk layer={LANE_MARK[n.lane]} />} time={evTime(e.createdAt)} title={n.title} note={n.line} code={e.eventType} />;
              })}
              {!held && history.length === 0 && <p className="body" style={{ padding: '16px 0' }}>No recent entry for this binding in the latest page of the record.</p>}
            </div>
          )}
        </div>
      </Band>

      {held && inc ? (
        <SummaryDock
          railText="The gateway never decides. It waits for a signature."
          left={policyCode ? <HeldBy code={policyCode} verb="Locked by" /> : <Chip tone="am">Held for review</Chip>}
          right={<HandedToYou>Opens only on your signature</HandedToYou>}
          question={<>Should <span className="mono" style={{ fontSize: 25 }}>{vb(held.version)}</span> replace <span className="mono" style={{ fontSize: 25 }}>{vb(g.served)}</span> in production?</>}
          body="Review the evidence and sign on the incident. Approving runs the transaction above."
          href={`/incidents/${inc.id}#decision`} cta="Review the evidence and decide"
          helper={f?.policyAction === 'QUARANTINE' ? 'Policy requires a human for this change' : 'Held until a person decides'}
        />
      ) : (
        <SummaryDock
          railText="The gateway never decides. Nothing is waiting at the gate."
          left={<Chip tone="tq">Serving trusted <span className="mono">{vb(g.served)}</span></Chip>} right={<HandedToYou>Nothing to sign</HandedToYou>}
          question="Nothing is waiting at the gate." body="A held candidate appears here, and opens only on a reviewer’s signature."
          href="/incidents" cta="Open the incidents" helper="Only POL-005 or a signed approval can move a version to trusted"
        />
      )}
    </main>
  );
}
