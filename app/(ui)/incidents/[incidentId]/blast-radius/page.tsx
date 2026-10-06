import { getT, readReviewer } from '../../../_data/session';
import { notFound } from 'next/navigation';
import { BlastInstrument } from '@/components/blast/BlastInstrument';
import { GRAPH_LIMITS } from '@/lib/blast-radius/graph';
import { dayTime, evTime, plural, shortHash, versionText, word } from '@/components/strata/format';
import { Band, Chip, Dk, HandedToYou, HeadRow, Kv, Mk, Mono, PageHeader, Rail, ReadError, ReviewerStatus, Sep, SummaryDock } from '@/components/strata/primitives';
import { incidentSem } from '@/components/strata/semantics';
import { readBlast, readGatewayInventory, readIncidentItem, readRegressions, readSourceDetail, readShell } from '../../../_data/read';
import { summarizeIncident } from '../../../_data/incident-summary';

export const metadata = { title: 'Blast Radius · Istithbat' };
export const dynamic = 'force-dynamic';

export default async function BlastRadiusPage({ params }: { params: Promise<{ incidentId: string }> }) {
  const reviewer = await readReviewer();
  const t = await getT();
  const { incidentId } = await params;
  await readShell(); // queue the chrome's reads first so the skeleton streams immediately
  // Light path: the list row, the light summary and the Blast Radius read (not the full aggregate).
  const itemR = await readIncidentItem(incidentId);
  if (!itemR.ok) return <main id="main"><section style={{ padding: '72px 0 120px' }}><div className="wrap"><ReadError {...itemR.error} /></div></section></main>;
  const inc = itemR.data;
  if (!inc) notFound();
  const blast = await readBlast(inc.id);
  const regs = await readRegressions(inc.id);
  const src = await readSourceDetail(inc.sourceId);
  const gateway = await readGatewayInventory();
  const sum = await summarizeIncident(inc);
  const source = src.ok ? src.data : null;
  const g = gateway.ok ? gateway.data.find((x) => x.sourceId === inc.sourceId && x.binding) ?? null : null;
  const br = blast.ok ? blast.data : null;
  const sem = incidentSem({ status: inc.status, pipelineStatus: inc.pipelineStatus });
  const cand = versionText(inc.candidateLabel, inc.candidateRevision, 'label'), prev = inc.previousLabel ? versionText(inc.previousLabel, inc.previousRevision, 'label') : '—';
  const versionLabel: Record<string, string> = Object.fromEntries((source?.versions ?? []).map((v) => [v.id, versionText(v.upstreamLabel, v.revisionNumber, 'needed')]));
  const runBatch: Record<string, string> = Object.fromEntries((regs.ok ? regs.data : []).map((r) => [r.id, `batch ${r.batchId.slice(0, 8)}`]));
  const down = br ? br.nodes.filter((n) => n.assetType !== 'SOURCE' && n.assetType !== 'RECORD') : [];
  const impacted = down.filter((n) => n.impact === 'IMPACTED');
  const held = inc.status !== 'RESOLVED';
  const recordName = br?.nodes.find((n) => n.assetType === 'RECORD')?.name ?? sum.recordKey;
  const frozen = down.filter((n) => n.derivationMode === 'MATERIALIZED' && n.derivedFromVersionId === (br?.trustedVersionId ?? br?.previousVersionId)).length;

  return (
    <main id="main" className="scr-blast">
      <PageHeader
        crumbs={<><span>{t('Blast Radius')}</span><Sep /><Mono>{sum.recordKey}</Mono></>}
        synthetic={source?.source.isDemoFixture}
        title={br ? (() => { const k = new Set(br.changes.map((c) => c.canonicalKey)).size; const of = k > 1 ? t('of {k} changed records', { k }) : t('of this change'); return down.length ? <>{t(down.length === 1 ? '1 asset is downstream' : '{n} assets are downstream', { n: down.length })}<br />{of}.</> : <>{t('No asset is downstream')}<br />{of}.</>; })() : <>{t('The radius has')}<br />{t('not been traced yet.')}</>}
        lede={br ? <>{impacted.length ? t(impacted.length === 1 ? 'One protected app is proven to answer differently.' : '{n} protected apps are proven to answer differently.', { n: word(impacted.length), d: impacted.length }) : t('No protected app is proven to answer differently.')} {br.candidateServed ? <>{t('The candidate')} <Mono>{cand}</Mono> {t('is being served.')}</> : <>{t('None of them is being served')} <Mono>{cand}</Mono>.</>}</> : t('The BLAST_RADIUS step has not completed for this incident.')}
        status={<>
          <Dk k={t('Incident')}><Chip tone={sem.tone}>{t(sem.text)}</Chip></Dk>
          <Dk k={t('Candidate served')}>{br ? t(br.candidateServed ? 'Yes' : 'No') : '—'}</Dk>
          <Dk k={t('Traversal')}>{br ? <Mono>{br.traversalStatus}</Mono> : t('Pending')}</Dk>
        </>}
      />

      {!blast.ok ? <Band id="radius" labelledBy="h-radius" first><Rail layer="det" id="h-radius" title="Exposure">{t('Every asset downstream of the changed record.')}</Rail><div className="main"><ReadError {...blast.error} /></div></Band> : !br ? (
        <Band id="radius" labelledBy="h-radius" first>
          <Rail layer="det" id="h-radius" title="Exposure">{t('Every asset downstream of the changed record.')}</Rail>
          <div className="main"><HeadRow title={t('Dependency graph')} /><div className="plate"><b>{t('Not traced yet.')}</b><p className="body">{t(inc.pipelineStatus === 'RUNNING' ? 'The pipeline is still running; the radius appears when its step completes.' : 'No traversal is recorded for this incident.')}</p></div></div>
        </Band>
      ) : (
        <BlastInstrument br={br} labels={{
          sourceName: source?.source.name ?? inc.sourceId, candidate: cand, previous: prev, trustedLabel: g?.latestTrusted ? versionText(g.latestTrusted.label, g.latestTrusted.revisionNumber, 'label') : prev,
          versionLabel, runBatch, changedWord: sum.diff?.removed.length === 1 && !sum.diff.added.length ? sum.diff.removed[0] : null, changedField: sum.fieldPath,
          incidentHeld: held,
        }} />
      )}

      {br && (
        <Band id="traversal" labelledBy="h-trav">
          <Rail layer="det" id="h-trav" title="Reproducibility">{t('Deterministic; re-running gives the same hash.')}</Rail>
          <div className="main">
            <h3 className="h3">{t('Traversal')}</h3>
            <div className="plate tight">
              <div className="sub">
                <div className="c1-5">
                  <Kv k={t('Traversal hash')}><Mono>{shortHash(br.traversalHash)}</Mono></Kv>
                  <Kv k={t('Status')}><Mono>{br.traversalStatus}</Mono></Kv>
                  <Kv k={t('Computed')}><span dir="ltr">{dayTime(br.execution?.completedAt ?? br.history.at(-1)?.computedAt ?? null)}</span></Kv>
                </div>
                <div className="c6-10">
                  <Kv k={t('Graph')}>{t('{n} nodes · {e} edges', { n: br.nodes.length, e: br.edges.length })}</Kv>
                  <Kv k={t('Changed keys')}><Mono>{[...new Set(br.changes.map((c) => `${c.canonicalKey}${c.fieldPath ? ` · ${c.fieldPath}` : ''}`))].join(', ') || recordName}</Mono></Kv>
                  <Kv k={t('Limits')}>{t('{n} nodes · {e} edges', { n: GRAPH_LIMITS.nodes, e: GRAPH_LIMITS.edges })}</Kv>
                </div>
              </div>
            </div>
            <div className="plate tight">
              {br.history.map((h) => (
                <div key={`${h.phase}-${h.traversalHash}`} className="ev"><Mk layer="det" /><span className="tm mono">{evTime(h.computedAt)}</span><span className="w"><b>{t(h.phase === 'PIPELINE' ? 'Pipeline traversal' : 'Post-promotion recompute')}</b><span>{t('{i} impacted · {e} exposed · {s} stale', { i: h.counts.impacted, e: h.counts.exposed, s: h.counts.stale })}</span></span><span className="who-l mono">{h.phase}</span></div>
              ))}
              {!br.history.some((h) => h.phase === 'POST_PROMOTION') && (
                <div className="ev"><Mk layer="hum" style={{ background: 'var(--ink-4)' }} /><span className="tm mono">{t('after approval')}</span><span className="w"><b>{t('Post-promotion recompute')}</b><span>{t('Runs after the gate opens. A failure is audited and never rolls the promotion back.')}</span></span><span className="who-l mono">POST_PROMOTION</span></div>
              )}
            </div>
          </div>
        </Band>
      )}

      {held ? (
        <SummaryDock
          railText={t('The radius informs the decision. It never makes it.')}
          left={impacted.length ? <Chip tone="co">{t('Impact proven on {names}', { names: impacted.map((n) => n.name).join(t(' and ')) })}</Chip> : <Chip tone="am">{t('Exposure only, no proven impact')}</Chip>}
          right={<ReviewerStatus active={!!reviewer} />}
          question={impacted.length ? <>{impacted.map((n) => n.name).join(t(' and '))} {t(impacted.length === 1 ? 'answers differently with' : 'answer differently with')} <span className="mono" style={{ fontSize: 25 }}>{cand}</span>. {t('Should it be promoted?')}</> : <>{t('Should')} <span className="mono" style={{ fontSize: 25 }}>{cand}</span> {t('be promoted?')}</>}
          body={frozen ? t(frozen === 1 ? 'Approving switches the protected app and makes one frozen copy stale.' : 'Approving switches the protected app and makes {n} frozen copies stale.', { n: word(frozen).toLowerCase(), d: frozen }) : t('Approving switches the protected app.')}
          href={`/incidents/${inc.id}#decision`} cta={t('Review the evidence and decide')}
          helper={t(sum.policyAction === 'QUARANTINE' ? 'Policy requires a human for this change' : 'Held until a person decides')}
        />
      ) : (
        <SummaryDock
          railText={t('The radius informs the decision. This one is already decided.')}
          left={<Chip tone="n4">{t('Resolved')}</Chip>} right={<HandedToYou>{t('Signed')}</HandedToYou>}
          question={t('This incident has been decided.')} body={t('The record shows who signed, and what the gateway serves now.')}
          href={`/incidents/${inc.id}/record`} cta={t('Open the record')} helper={t('Entries already recorded cannot be edited')}
        />
      )}
    </main>
  );
}
