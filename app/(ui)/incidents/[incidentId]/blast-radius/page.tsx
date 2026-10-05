import { AutoRefresh } from '@/components/strata/AutoRefresh';
import { notFound } from 'next/navigation';
import { BlastInstrument } from '@/components/blast/BlastInstrument';
import { GRAPH_LIMITS } from '@/lib/blast-radius/graph';
import { dayTime, evTime, shortHash, word } from '@/components/strata/format';
import { incidentFacts } from '@/components/strata/incident-model';
import { Band, Chip, Dk, HandedToYou, HeadRow, Kv, Mk, Mono, PageHeader, Rail, ReadError, Sep, SummaryDock, SyntheticPill } from '@/components/strata/primitives';
import { aiSuggestion, incidentSem } from '@/components/strata/semantics';
import { readGatewayInventory, readIncidentDetail, readRegressions, readSourceDetail } from '../../../_data/read';

export const metadata = { title: 'Blast Radius · Istithbat' };
export const dynamic = 'force-dynamic';

export default async function BlastRadiusPage({ params }: { params: Promise<{ incidentId: string }> }) {
  const { incidentId } = await params;
  const detail = await readIncidentDetail(incidentId);
  if (!detail.ok) return <main id="main"><section style={{ padding: '72px 0 120px' }}><div className="wrap"><ReadError {...detail.error} /></div></section></main>;
  const inc = detail.data;
  if (!inc) notFound();
  const regs = await readRegressions(inc.id);
  const src = await readSourceDetail(inc.sourceId);
  const gateway = await readGatewayInventory();
  const source = src.ok ? src.data : null;
  const g = gateway.ok ? gateway.data.find((x) => x.sourceId === inc.sourceId && x.binding) ?? null : null;
  const f = incidentFacts(inc);
  const br = inc.blastRadius ?? null;
  const sem = incidentSem({ status: inc.status, pipelineStatus: inc.pipeline?.status });
  const cand = inc.candidateVersion.upstreamLabel, prev = inc.previousVersion?.upstreamLabel ?? '—';
  const versionLabel: Record<string, string> = Object.fromEntries((source?.versions ?? []).map((v) => [v.id, v.revisionNumber > 1 ? `${v.upstreamLabel} r${v.revisionNumber}` : v.upstreamLabel]));
  const runBatch: Record<string, string> = Object.fromEntries((regs.ok ? regs.data : []).map((r) => [r.id, `batch ${r.batchId.slice(0, 8)}`]));
  const down = br ? br.nodes.filter((n) => n.assetType !== 'SOURCE' && n.assetType !== 'RECORD') : [];
  const impacted = down.filter((n) => n.impact === 'IMPACTED');
  const held = inc.status !== 'RESOLVED';
  const recordName = br?.nodes.find((n) => n.assetType === 'RECORD')?.name ?? f.recordKey;
  const frozen = down.filter((n) => n.derivationMode === 'MATERIALIZED' && n.derivedFromVersionId === (br?.trustedVersionId ?? br?.previousVersionId)).length;

  return (
    <main id="main" className="scr-blast">
      <AutoRefresh active={inc.pipeline?.status === 'RUNNING'} />
      <PageHeader
        crumbs={<><span>Blast Radius</span><Sep /><span>{source?.source.name.split(' — ')[0] ?? inc.sourceId}</span><Sep /><Mono style={{ color: 'var(--ink-2)' }}>{f.recordKey}</Mono>{source?.source.isDemoFixture && <SyntheticPill />}</>}
        title={br ? <>{br.changes.length === 1 ? 'One record changed.' : `${word(new Set(br.changes.map((c) => c.canonicalKey)).size)} records changed.`}<br />{word(down.length)} {down.length === 1 ? 'asset depends' : 'assets depend'} on it.</> : <>The radius has<br />not been traced yet.</>}
        lede={br ? <>{impacted.length ? `${word(impacted.length)} protected ${impacted.length === 1 ? 'app is' : 'apps are'} proven to answer differently.` : 'No protected app is proven to answer differently.'} {br.candidateServed ? <>The candidate <Mono>{cand}</Mono> is being served.</> : <>None of them is being served <Mono>{cand}</Mono>.</>}</> : 'The BLAST_RADIUS step has not completed for this incident.'}
        status={<>
          <Dk k="Incident"><Chip tone={sem.tone}>{sem.text}</Chip></Dk>
          <Dk k="Candidate served">{br ? (br.candidateServed ? 'Yes' : 'No') : '—'}</Dk>
          <Dk k="Traversal">{br ? <Mono>{br.traversalStatus}</Mono> : 'Pending'}</Dk>
        </>}
      />

      {!br ? (
        <Band id="radius" labelledBy="h-radius" first>
          <Rail layer="det" id="h-radius" title="Radius">Every asset that depends on the changed record, and what is proven about each.</Rail>
          <div className="main"><HeadRow title="Where the change could travel" /><div className="plate"><b>Not traced yet.</b><p className="body">{inc.pipeline?.status === 'RUNNING' ? 'The pipeline is still running; the radius appears when its step completes.' : 'No traversal is recorded for this incident.'}</p></div></div>
        </Band>
      ) : (
        <BlastInstrument br={br} labels={{
          sourceName: source?.source.name ?? inc.sourceId, candidate: cand, previous: prev, trustedLabel: g?.latestTrusted?.label ?? prev,
          versionLabel, runBatch, changedWord: f.diff?.removed.length === 1 && !f.diff.added.length ? f.diff.removed[0] : null, changedField: f.primary?.fieldPath ?? null,
          incidentHeld: held,
        }} />
      )}

      {br && (
        <Band id="traversal" labelledBy="h-trav">
          <Rail layer="det" id="h-trav" title="Traversal">How the radius was computed. Re-running it gives the same hash.</Rail>
          <div className="main">
            <h3 className="h3">A deterministic walk, upstream to downstream</h3>
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
          helper={[aiSuggestion(f.analysis), 'policy requires a human'].filter(Boolean).join(' · ')}
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
