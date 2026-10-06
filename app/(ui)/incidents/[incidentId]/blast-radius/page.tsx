import { AutoRefresh } from '@/components/strata/AutoRefresh';
import { notFound } from 'next/navigation';
import { BlastInstrument } from '@/components/blast/BlastInstrument';
import { GRAPH_LIMITS } from '@/lib/blast-radius/graph';
import { dayTime, evTime, plural, shortHash, word } from '@/components/strata/format';
import { Band, Chip, Dk, HandedToYou, HeadRow, Kv, Mk, Mono, PageHeader, Rail, ReadError, Sep, SummaryDock } from '@/components/strata/primitives';
import { incidentSem } from '@/components/strata/semantics';
import { readBlast, readGatewayInventory, readIncidentItem, readRegressions, readSourceDetail } from '../../../_data/read';
import { summarizeIncident } from '../../../_data/incident-summary';

export const metadata = { title: 'Blast Radius · Istithbat' };
export const dynamic = 'force-dynamic';

export default async function BlastRadiusPage({ params }: { params: Promise<{ incidentId: string }> }) {
  const { incidentId } = await params;
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
  const cand = inc.candidateLabel, prev = inc.previousLabel ?? '—';
  const versionLabel: Record<string, string> = Object.fromEntries((source?.versions ?? []).map((v) => [v.id, v.revisionNumber > 1 ? `${v.upstreamLabel} r${v.revisionNumber}` : v.upstreamLabel]));
  const runBatch: Record<string, string> = Object.fromEntries((regs.ok ? regs.data : []).map((r) => [r.id, `batch ${r.batchId.slice(0, 8)}`]));
  const down = br ? br.nodes.filter((n) => n.assetType !== 'SOURCE' && n.assetType !== 'RECORD') : [];
  const impacted = down.filter((n) => n.impact === 'IMPACTED');
  const held = inc.status !== 'RESOLVED';
  const recordName = br?.nodes.find((n) => n.assetType === 'RECORD')?.name ?? sum.recordKey;
  const frozen = down.filter((n) => n.derivationMode === 'MATERIALIZED' && n.derivedFromVersionId === (br?.trustedVersionId ?? br?.previousVersionId)).length;

  return (
    <main id="main" className="scr-blast">
      <AutoRefresh active={inc.pipelineStatus === 'RUNNING'} />
      <PageHeader
        crumbs={<><span>Blast Radius</span><Sep /><Mono>{sum.recordKey}</Mono></>}
        synthetic={source?.source.isDemoFixture}
        title={br ? (() => { const k = new Set(br.changes.map((c) => c.canonicalKey)).size; const of = k > 1 ? `of ${k} changed records` : 'of this change'; return down.length ? <>{plural(down.length, 'asset')} {down.length === 1 ? 'is' : 'are'} downstream<br />{of}.</> : <>No asset is downstream<br />{of}.</>; })() : <>The radius has<br />not been traced yet.</>}
        lede={br ? <>{impacted.length ? `${word(impacted.length)} protected ${impacted.length === 1 ? 'app is' : 'apps are'} proven to answer differently.` : 'No protected app is proven to answer differently.'} {br.candidateServed ? <>The candidate <Mono>{cand}</Mono> is being served.</> : <>None of them is being served <Mono>{cand}</Mono>.</>}</> : 'The BLAST_RADIUS step has not completed for this incident.'}
        status={<>
          <Dk k="Incident"><Chip tone={sem.tone}>{sem.text}</Chip></Dk>
          <Dk k="Candidate served">{br ? (br.candidateServed ? 'Yes' : 'No') : '—'}</Dk>
          <Dk k="Traversal">{br ? <Mono>{br.traversalStatus}</Mono> : 'Pending'}</Dk>
        </>}
      />

      {!blast.ok ? <Band id="radius" labelledBy="h-radius" first><Rail layer="det" id="h-radius" title="Exposure">Every asset downstream of the changed record.</Rail><div className="main"><ReadError {...blast.error} /></div></Band> : !br ? (
        <Band id="radius" labelledBy="h-radius" first>
          <Rail layer="det" id="h-radius" title="Exposure">Every asset downstream of the changed record.</Rail>
          <div className="main"><HeadRow title="Dependency graph" /><div className="plate"><b>Not traced yet.</b><p className="body">{inc.pipelineStatus === 'RUNNING' ? 'The pipeline is still running; the radius appears when its step completes.' : 'No traversal is recorded for this incident.'}</p></div></div>
        </Band>
      ) : (
        <BlastInstrument br={br} labels={{
          sourceName: source?.source.name ?? inc.sourceId, candidate: cand, previous: prev, trustedLabel: g?.latestTrusted?.label ?? prev,
          versionLabel, runBatch, changedWord: sum.diff?.removed.length === 1 && !sum.diff.added.length ? sum.diff.removed[0] : null, changedField: sum.fieldPath,
          incidentHeld: held,
        }} />
      )}

      {br && (
        <Band id="traversal" labelledBy="h-trav">
          <Rail layer="det" id="h-trav" title="Reproducibility">Deterministic; re-running gives the same hash.</Rail>
          <div className="main">
            <h3 className="h3">Traversal</h3>
            <div className="plate tight">
              <div className="sub">
                <div className="c1-5">
                  <Kv k="Traversal hash"><Mono>{shortHash(br.traversalHash)}</Mono></Kv>
                  <Kv k="Status"><Mono>{br.traversalStatus}</Mono></Kv>
                  <Kv k="Computed">{dayTime(br.execution?.completedAt ?? br.history.at(-1)?.computedAt ?? null)}</Kv>
                </div>
                <div className="c6-10">
                  <Kv k="Graph">{br.nodes.length} nodes · {br.edges.length} edges</Kv>
                  <Kv k="Changed keys"><Mono>{[...new Set(br.changes.map((c) => `${c.canonicalKey}${c.fieldPath ? ` · ${c.fieldPath}` : ''}`))].join(', ') || recordName}</Mono></Kv>
                  <Kv k="Limits">{GRAPH_LIMITS.nodes} nodes · {GRAPH_LIMITS.edges} edges</Kv>
                </div>
              </div>
            </div>
            <div className="plate tight">
              {br.history.map((h) => (
                <div key={`${h.phase}-${h.traversalHash}`} className="ev"><Mk layer="det" /><span className="tm mono">{evTime(h.computedAt)}</span><span className="w"><b>{h.phase === 'PIPELINE' ? 'Pipeline traversal' : 'Post-promotion recompute'}</b><span>{h.counts.impacted} impacted · {h.counts.exposed} exposed · {h.counts.stale} stale</span></span><span className="who-l mono">{h.phase}</span></div>
              ))}
              {!br.history.some((h) => h.phase === 'POST_PROMOTION') && (
                <div className="ev"><Mk layer="hum" style={{ background: 'var(--ink-4)' }} /><span className="tm mono">after approval</span><span className="w"><b>Post-promotion recompute</b><span>Runs after the gate opens. A failure is audited and never rolls the promotion back.</span></span><span className="who-l mono">POST_PROMOTION</span></div>
              )}
            </div>
          </div>
        </Band>
      )}

      {held ? (
        <SummaryDock
          railText="The radius informs the decision. It never makes it."
          left={impacted.length ? <Chip tone="co">Impact proven on {impacted.map((n) => n.name).join(' and ')}</Chip> : <Chip tone="am">Exposure only, no proven impact</Chip>}
          right={<HandedToYou />}
          question={impacted.length ? <>{impacted.map((n) => n.name).join(' and ')} {impacted.length === 1 ? 'answers' : 'answer'} differently with <span className="mono" style={{ fontSize: 25 }}>{cand}</span>. Should it be promoted?</> : <>Should <span className="mono" style={{ fontSize: 25 }}>{cand}</span> be promoted?</>}
          body={`Approving switches the protected app${frozen ? ` and makes ${word(frozen).toLowerCase()} frozen ${frozen === 1 ? 'copy' : 'copies'} stale` : ''}.`}
          href={`/incidents/${inc.id}#decision`} cta="Review the evidence and decide"
          helper={sum.policyAction === 'QUARANTINE' ? 'Policy requires a human for this change' : 'Held until a person decides'}
        />
      ) : (
        <SummaryDock
          railText="The radius informs the decision. This one is already decided."
          left={<Chip tone="n4">Resolved</Chip>} right={<HandedToYou>Signed</HandedToYou>}
          question="This incident has been decided." body="The record shows who signed, and what the gateway serves now."
          href={`/incidents/${inc.id}/record`} cta="Open the record" helper="Entries already recorded cannot be edited"
        />
      )}
    </main>
  );
}
