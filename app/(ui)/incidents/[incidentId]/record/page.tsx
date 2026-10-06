import { getT, readReviewer } from '../../../_data/session';
import { versionText } from '@/components/strata/format';
import { notFound } from 'next/navigation';
import { canReview } from '@/lib/governance/transitions';
import { RecordLedger } from '@/components/record/RecordLedger';
import { isArabic } from '@/components/strata/diff';
import { Band, Chip, Dk, HandedToYou, HeldBy, Mk, Mono, PageHeader, Rail, ReadError, ReviewerStatus, Sep, SummaryDock } from '@/components/strata/primitives';
import { readAudit, readGatewayInventory, readIncidentItem, readSourceDetail, readShell } from '../../../_data/read';
import { summarizeIncident } from '../../../_data/incident-summary';

export const metadata = { title: 'Record · Istithbat' };
export const dynamic = 'force-dynamic';

export default async function RecordPage({ params }: { params: Promise<{ incidentId: string }> }) {
  const reviewer = await readReviewer();
  const t = await getT();
  const { incidentId } = await params;
  await readShell(); // queue the chrome's reads first so the skeleton streams immediately
  // Light path: the list row, the persisted audit page and the source detail (not the full aggregate).
  const itemR = await readIncidentItem(incidentId);
  if (!itemR.ok) return <main id="main"><section style={{ padding: '72px 0 120px' }}><div className="wrap"><ReadError {...itemR.error} /></div></section></main>;
  const inc = itemR.data;
  if (!inc) notFound();
  const audit = await readAudit({ incidentId: inc.id, limit: 100 });
  const src = await readSourceDetail(inc.sourceId);
  const gateway = await readGatewayInventory();
  const sum = await summarizeIncident(inc);
  const g = gateway.ok ? gateway.data.find((x) => x.sourceId === inc.sourceId && x.binding) ?? null : null;
  const versions = src.ok && src.data ? src.data.versions : [];
  const versionLabel = Object.fromEntries(versions.map((v) => [v.id, versionText(v.upstreamLabel, v.revisionNumber)]));
  const candV = versions.find((v) => v.id === inc.candidateVersionId) ?? null;
  const prevV = candV?.previousVersionId ? versions.find((v) => v.id === candV.previousVersionId) ?? null : null;
  const open = inc.status !== 'RESOLVED';
  const cand = versionText(inc.candidateLabel, inc.candidateRevision, 'label');
  const latest = audit.ok ? audit.data.events.find((e) => !/^PIPELINE_STEP_/.test(e.eventType)) ?? null : null;
  const policy = (sum.policyAction ?? null) as 'ALLOW' | 'REVIEW' | 'QUARANTINE' | 'ESCALATE' | null;
  const approveAllowed = candV ? canReview('APPROVE', candV.status, inc.status, policy) : false;
  const oldV = sum.diff ? sum.diff.old.map((x) => x.text).join(' ') : null, newV = sum.diff ? sum.diff.new.map((x) => x.text).join(' ') : null;
  const base = `/incidents/${inc.id}`;

  return (
    <main id="main" className="scr-record">
      <PageHeader
        crumbs={<><span>{t('Record')}</span><Sep /><Mono>{sum.recordKey}</Mono></>}
        synthetic={src.ok && !!src.data?.source.isDemoFixture}
        title={open ? <>{t('Audit trail, awaiting')}<br />{t('a review decision.')}</> : <>{t('Audit trail, closed')}<br />{t('by a signed decision.')}</>}
        lede={`${t('From the source observation to {end}.', { end: t(open ? (inc.status === 'QUARANTINED' ? 'a quarantined candidate' : 'a held candidate') : 'a signed decision') })} ${t('Facts, AI advice, policy and people are recorded apart, each under its own actor.')}`}
        status={<>
          <Dk k={t('Latest entry')} style={{ fontSize: 13 }}>{latest ? <Mono>{latest.eventType}</Mono> : '—'}</Dk>
          <Dk k={t('Next entry')}>{open ? <span className="chip" style={{ color: 'var(--ink)' }}><Mk layer="hum" style={{ width: 8, height: 8 }} />{t('Your decision')}</span> : t('None pending')}</Dk>
          <Dk k={t('Edits to past entries')}><Chip tone="tq">{t('Rejected by the database')}</Chip></Dk>
        </>}
      />

      <Band id="record" labelledBy="h-rec" first>
        <Rail layer="src" id="h-rec" title="Record">{t('Each entry sits in the lane of the authority that wrote it.')}</Rail>
        <div className="main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}><h3 className="h3">{t('Audit ledger')}</h3><span className="meta">{t('AI advises. Policy governs. Humans decide.')}</span></div>
          {!audit.ok ? <ReadError {...audit.error} /> : (
            <RecordLedger initial={audit.data} ctx={{
              incidentId: inc.id, recordKey: sum.recordKey, candidateId: inc.candidateVersionId, candidateLabel: cand,
              previousId: prevV?.id ?? null, previousLabel: inc.previousLabel ? versionText(inc.previousLabel, inc.previousRevision, 'label') : null,
              servedLabel: g?.served ? versionText(g.served.label, g.served.revisionNumber, 'label') : null, appName: g?.appName ?? null, open, approveAllowed, versionLabel,
              change: sum.diff ? { field: sum.fieldPath, old: oldV, new: newV, arabic: !!oldV && isArabic(oldV) } : null,
              analysisMode: inc.analysisMode,
              links: { source: `${base}#source`, facts: `${base}#facts`, advisory: `${base}#advisory`, behavior: `${base}#behavior`, exposure: `${base}#exposure`, containment: `${base}#containment`, decision: `${base}#decision`, blast: `${base}/blast-radius`, gateway: g?.appId ? `/gateway/${g.appId}` : '/gateway', sources: `/sources/${inc.sourceId}` },
            }} />
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', fontSize: 13, color: 'var(--ink-3)' }}>
            <span className="lk"><span className="mk mk-src" style={{ width: 14 }} />{t('Source and integrity')}</span>
            <span className="lk"><span className="mk mk-det" style={{ background: 'var(--ink-2)' }} />{t('Deterministic engine')}</span>
            <span className="lk"><span className="mk mk-ai" />{t('AI advisory')}</span>
            <span className="lk"><span className="mk mk-pol" />{t('Policy')}</span>
            <span className="lk"><span className="mk mk-hum" />{t('Human, signed')}</span>
            <span className="lk" style={{ marginInlineStart: 'auto' }}>{t('Pipeline step events are folded into the entry they belong to')}</span>
          </div>
        </div>
      </Band>

      <Band id="integrity" labelledBy="h-int">
        <Rail layer="det" id="h-int" title="Integrity">{t('What protects the trail, stated exactly.')}</Rail>
        <div className="main">
          <h3 className="h3">{t('Ledger integrity')}</h3>
          <div className="sub" style={{ rowGap: 32, alignItems: 'start' }}>
            <div className="c1-6 plate l" style={{ marginRight: 0, paddingTop: 8, paddingBottom: 8 }}>
              <div className="grd"><span className="dot" style={{ background: 'var(--tq)' }} /><span className="w2"><b>{t('Past entries cannot be changed')}</b><span>{t('A database trigger rejects every update and delete on the audit table.')}</span></span><span className="mono gk">audit_events_append_only</span></div>
              <div className="grd"><span className="dot" style={{ background: 'var(--tq)' }} /><span className="w2"><b>{t('Each step is written once')}</b><span>{t('Every entry carries a unique idempotency key. A retry cannot add a second copy.')}</span></span><span className="mono gk">idempotency_key</span></div>
              <div className="grd"><span className="dot" style={{ background: 'var(--tq)' }} /><span className="w2"><b>{t('The evidence underneath is frozen')}</b><span>{t('Snapshot fields, records and changes reject updates once stored.')}</span></span><span className="mono gk">records_immutable</span></div>
              <div className="grd"><span className="dot" style={{ background: 'var(--ink-4)' }} /><span className="w2"><b>{t('Evidence can be re-proven on demand')}</b><span>{t('Re-hashes the stored raw and canonical snapshots and recomputes the diff. Results are not stored, so none is shown here; re-verifiable on demand with the demo-control credential.')}</span></span><span className="mono gk">verify</span></div>
            </div>
            <div className="c7-10 plate in r" style={{ marginLeft: 0, padding: '20px 24px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="cap">{t('What this is not')}</span>
              <p style={{ margin: 0, fontSize: 15, lineHeight: '24px', color: 'var(--ink-2)' }}>{t('Not a hash chain, not signed, not notarized outside Istithbat. The guards live in the database: they stop the application and its users from rewriting history. An operator with schema rights could still disable a trigger.')}</p>
            </div>
          </div>
        </div>
      </Band>

      {open ? (
        <SummaryDock
          railText={t('Nothing above decides. The record waits for a signature.')}
          left={sum.policyCode ? <HeldBy code={sum.policyCode} /> : <Chip tone="am">{t('Held for review')}</Chip>} right={<ReviewerStatus active={!!reviewer} />}
          question={t('The next entry is yours.')}
          body={<>{t('Signing appends one')} <span className="mono" style={{ fontSize: 13.5 }}>REVIEW_DECISION</span>.{approveAllowed && <> {t('An approval also appends')} <span className="mono" style={{ fontSize: 13.5 }}>VERSION_PROMOTED</span> {t('in the same transaction.')}</>}</>}
          href={`${base}#decision`} cta={t('Review the evidence and decide')} helper={t('Entries already recorded cannot be edited')}
        />
      ) : (
        <SummaryDock
          railText={t('Nothing above decides. This incident is decided.')}
          left={<Chip tone="n4">{t('Resolved')}</Chip>} right={<HandedToYou>{t('Signed')}</HandedToYou>}
          question={t('The decision is on the record.')} body={t('The signed entry and any promotion are above, in the human lane.')}
          href={base} cta={t('Open the incident')} helper={t('Entries already recorded cannot be edited')}
        />
      )}
    </main>
  );
}
