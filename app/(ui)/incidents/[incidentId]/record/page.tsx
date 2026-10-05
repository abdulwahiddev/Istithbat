import { AutoRefresh } from '@/components/strata/AutoRefresh';
import { notFound } from 'next/navigation';
import { canReview } from '@/lib/governance/transitions';
import { RecordLedger } from '@/components/record/RecordLedger';
import { isArabic } from '@/components/strata/diff';
import { incidentFacts } from '@/components/strata/incident-model';
import { Band, Chip, Dk, HandedToYou, HeldBy, Mk, Mono, PageHeader, Rail, ReadError, Sep, SummaryDock } from '@/components/strata/primitives';
import { readAudit, readGatewayInventory, readIncidentDetail, readSourceDetail } from '../../../_data/read';

export const metadata = { title: 'Record · Istithbat' };
export const dynamic = 'force-dynamic';

export default async function RecordPage({ params }: { params: Promise<{ incidentId: string }> }) {
  const { incidentId } = await params;
  const detail = await readIncidentDetail(incidentId);
  if (!detail.ok) return <main id="main"><section style={{ padding: '72px 0 120px' }}><div className="wrap"><ReadError {...detail.error} /></div></section></main>;
  const inc = detail.data;
  if (!inc) notFound();
  const audit = await readAudit({ incidentId: inc.id, limit: 100 });
  const src = await readSourceDetail(inc.sourceId);
  const gateway = await readGatewayInventory();
  const g = gateway.ok ? gateway.data.find((x) => x.sourceId === inc.sourceId && x.binding) ?? null : null;
  const f = incidentFacts(inc);
  const versionLabel = Object.fromEntries((src.ok && src.data ? src.data.versions : [inc.candidateVersion, ...(inc.previousVersion ? [inc.previousVersion] : [])])
    .map((v) => [v.id, `${v.upstreamLabel} · r${v.revisionNumber}`]));
  const open = inc.status !== 'RESOLVED';
  const cand = inc.candidateVersion.upstreamLabel;
  const latest = audit.ok ? audit.data.events.find((e) => !/^PIPELINE_STEP_/.test(e.eventType)) ?? null : null;
  const policy = (inc.effectivePolicyAction ?? null) as 'ALLOW' | 'REVIEW' | 'QUARANTINE' | 'ESCALATE' | null;
  const approveAllowed = canReview('APPROVE', inc.candidateVersion.status, inc.status, policy);
  const base = `/incidents/${inc.id}`;

  return (
    <main id="main" className="scr-record">
      <AutoRefresh active={inc.pipeline?.status === 'RUNNING'} />
      <PageHeader
        crumbs={<><span>Record</span><Sep /><span><Mono>{f.recordKey}</Mono> · <Mono>{inc.previousVersion?.upstreamLabel ?? '—'} → {cand}</Mono></span></>}
        title={open ? <>Every step is on the record.<br />The next one is yours.</> : <>Every step is on the record.<br />The decision is signed.</>}
        lede={`From the source observation to ${open ? (inc.status === 'QUARANTINED' ? 'a quarantined candidate' : 'a held candidate') : 'a signed decision'}. Facts, AI advice, policy and people are recorded apart, each under its own actor.`}
        status={<>
          <Dk k="Latest entry" style={{ fontSize: 13 }}>{latest ? <Mono>{latest.eventType}</Mono> : '—'}</Dk>
          <Dk k="Next entry">{open ? <span className="chip" style={{ color: 'var(--ink)' }}><Mk layer="hum" style={{ width: 8, height: 8 }} />Your decision</span> : 'None pending'}</Dk>
          <Dk k="Edits to past entries"><Chip tone="tq">Rejected by the database</Chip></Dk>
        </>}
      />

      <Band id="record" labelledBy="h-rec" first>
        <Rail layer="src" id="h-rec" title="Record">The append-only trail for this incident. Each entry sits in the lane of the authority that wrote it. Select one to see its evidence.</Rail>
        <div className="main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}><h3 className="h3">From observation to decision</h3><span className="meta">AI advises. Policy governs. Humans decide.</span></div>
          {!audit.ok ? <ReadError {...audit.error} /> : (
            <RecordLedger initial={audit.data} ctx={{
              incidentId: inc.id, recordKey: f.recordKey, candidateId: inc.candidateVersion.id, candidateLabel: cand,
              previousId: inc.previousVersion?.id ?? null, previousLabel: inc.previousVersion?.upstreamLabel ?? null,
              servedLabel: g?.served?.label ?? null, appName: g?.appName ?? null, open, approveAllowed, versionLabel,
              change: f.primary ? { field: f.primary.fieldPath, old: f.oldV, new: f.newV, arabic: !!f.oldV && isArabic(f.oldV) } : null,
              analysisMode: inc.analysis?.meta.mode ?? null,
              links: { source: `${base}#source`, facts: `${base}#facts`, advisory: `${base}#advisory`, behavior: `${base}#behavior`, exposure: `${base}#exposure`, containment: `${base}#containment`, decision: `${base}#decision`, blast: `${base}/blast-radius`, gateway: g?.appId ? `/gateway/${g.appId}` : '/gateway', sources: `/sources/${inc.sourceId}` },
            }} />
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', fontSize: 13, color: 'var(--ink-3)' }}>
            <span className="lk"><span className="mk mk-src" style={{ width: 14 }} />Source and integrity</span>
            <span className="lk"><span className="mk mk-det" style={{ background: 'var(--ink-2)' }} />Deterministic engine</span>
            <span className="lk"><span className="mk mk-ai" />AI advisory</span>
            <span className="lk"><span className="mk mk-pol" />Policy</span>
            <span className="lk"><span className="mk mk-hum" />Human, signed</span>
            <span className="lk" style={{ marginLeft: 'auto' }}>Pipeline step events are folded into the entry they belong to</span>
          </div>
        </div>
      </Band>

      <Band id="integrity" labelledBy="h-int">
        <Rail layer="det" id="h-int" title="Integrity">What protects this trail, stated exactly. No stronger claim is made.</Rail>
        <div className="main">
          <h3 className="h3">Has anything been altered?</h3>
          <div className="sub" style={{ rowGap: 32, alignItems: 'start' }}>
            <div className="c1-6 plate l" style={{ marginRight: 0, paddingTop: 8, paddingBottom: 8 }}>
              <div className="grd"><span className="dot" style={{ background: 'var(--tq)' }} /><span className="w2"><b>Past entries cannot be changed</b><span>A database trigger rejects every update and delete on the audit table.</span></span><span className="mono gk">audit_events_append_only</span></div>
              <div className="grd"><span className="dot" style={{ background: 'var(--tq)' }} /><span className="w2"><b>Each step is written once</b><span>Every entry carries a unique idempotency key. A retry cannot add a second copy.</span></span><span className="mono gk">idempotency_key</span></div>
              <div className="grd"><span className="dot" style={{ background: 'var(--tq)' }} /><span className="w2"><b>The evidence underneath is frozen</b><span>Snapshot fields, records and changes reject updates once stored.</span></span><span className="mono gk">records_immutable</span></div>
              <div className="grd"><span className="dot" style={{ background: 'var(--ink-4)' }} /><span className="w2"><b>Evidence can be re-proven on demand</b><span>Re-hashes the stored raw and canonical snapshots and recomputes the diff. Results are not stored, so none is shown here; re-verifiable on demand with the demo-control credential.</span></span><span className="mono gk">verify</span></div>
            </div>
            <div className="c7-10 plate in r" style={{ marginLeft: 0, padding: '20px 24px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="cap">What this is not</span>
              <p style={{ margin: 0, fontSize: 15, lineHeight: '24px', color: 'var(--ink-2)' }}>Not a hash chain, not signed, not notarized outside Istithbat. The guards live in the database: they stop the application and its users from rewriting history. An operator with schema rights could still disable a trigger.</p>
            </div>
          </div>
        </div>
      </Band>

      {open ? (
        <SummaryDock
          railText="Nothing above decides. The record waits for a signature."
          left={f.policyCode ? <HeldBy code={f.policyCode} /> : <Chip tone="am">Held for review</Chip>} right={<HandedToYou />}
          question="The next entry is yours."
          body={<>Signing appends one <span className="mono" style={{ fontSize: 13.5 }}>REVIEW_DECISION</span>.{approveAllowed && <> An approval also appends <span className="mono" style={{ fontSize: 13.5 }}>VERSION_PROMOTED</span> in the same transaction.</>}</>}
          href={`${base}#decision`} cta="Review the evidence and decide" helper="Entries already recorded cannot be edited"
        />
      ) : (
        <SummaryDock
          railText="Nothing above decides. This incident is decided."
          left={<Chip tone="n4">Resolved</Chip>} right={<HandedToYou>Signed</HandedToYou>}
          question="The decision is on the record." body="The signed entry and any promotion are above, in the human lane."
          href={base} cta="Open the incident" helper="Entries already recorded cannot be edited"
        />
      )}
    </main>
  );
}
