import { isSourceDerived, SOURCE_DERIVED_SCENARIO } from '@/lib/contracts/sandbox-scenario';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ContextPacket } from '@/lib/analysis/context';
import { canReview } from '@/lib/governance/transitions';
import { Behavior, type BehaviorQuestion } from '@/components/incident/Behavior';
import { ExactDiff } from '@/components/strata/ExactDiff';
import { DecisionDock } from '@/components/incident/DecisionDock';
import { ExposureTrack, GateMini } from '@/components/incident/Instruments';
import { atPath, isArabic, sameJson } from '@/components/strata/diff';
import { cap, dayTime, dayYear, plural, shortHash, versionHint, versionText } from '@/components/strata/format';
import { incidentFacts } from '@/components/strata/incident-model';
import { Band, Chip, HandedToYou, HeadRow, HeldBy, Kv, Lnk, Mk, Mono, Rail, ReadError, ReviewerStatus, SyntheticRow } from '@/components/strata/primitives';
import { aiSuggestion, analysisText, deltaText, incidentSem, policyFacts, RESULT_TEXT, ROLE_TEXT, twoLines } from '@/components/strata/semantics';
import { readGatewayInventory, readIncidentDetail, readRegressions, readSourceDetail, readShell } from '../../_data/read';
import { readReviewer } from '../../_data/session';

export const metadata = { title: 'Incident Review · Istithbat' };
export const dynamic = 'force-dynamic';

const ROLE_GROUP: Record<string, string> = {
  AUTHORITATIVE_TEXT: 'Authoritative text and translation', TRANSLATION: 'Authoritative text and translation', PROVENANCE: 'Provenance fields',
  OPERATIONAL_METADATA: 'Metadata', COMMENTARY: 'Commentary', SCHOLAR_JUDGMENT: 'Judgment', UNCLASSIFIED: 'Other fields',
};
const MODE: Record<string, string> = { replay: 'Replayed response', mock: 'Mock response, not a model', live: 'Live response' };

export default async function IncidentReviewPage({ params }: { params: Promise<{ incidentId: string }> }) {
  const { incidentId } = await params;
  await readShell(); // queue the chrome's reads first so the skeleton streams immediately
  const detail = await readIncidentDetail(incidentId);
  if (!detail.ok) return <main id="main"><section style={{ padding: '72px 0 120px' }}><div className="wrap"><ReadError {...detail.error} /></div></section></main>;
  const inc = detail.data;
  if (!inc) notFound();
  const regs = await readRegressions(inc.id);
  const src = await readSourceDetail(inc.sourceId);
  const gateway = await readGatewayInventory();
  const reviewer = await readReviewer();
  const source = src.ok ? src.data : null;
  const g = gateway.ok ? gateway.data.find((x) => x.sourceId === inc.sourceId && x.binding) ?? null : null;
  const f = incidentFacts(inc);
  const out = f.analysis;
  const synthetic = source?.source.isDemoFixture ?? false;
  const level = source?.source.contentLevel ?? null;
  const cand = versionText(inc.candidateVersion.upstreamLabel, inc.candidateVersion.revisionNumber, 'label'), prev = inc.previousVersion ? versionText(inc.previousVersion.upstreamLabel, inc.previousVersion.revisionNumber, 'label') : 'the previous version';
  const served = g?.served ? versionText(g.served.label, g.served.revisionNumber, 'label') : source?.source.servedLabel ? versionText(source.source.servedLabel, source.source.servedRevision, 'label') : '—';
  const appName = g?.appName ?? 'the protected app';
  const sem = incidentSem({ status: inc.status, pipelineStatus: inc.pipeline?.status });
  const running = inc.pipeline?.status === 'RUNNING';
  const held = inc.status === 'QUARANTINED' || (inc.status === 'NEEDS_REVIEW' && !running);
  const heldText = inc.status === 'QUARANTINED' ? 'Quarantined' : running ? 'Investigating' : inc.status === 'NEEDS_REVIEW' ? 'Held for review' : sem.text;
  const policy = policyFacts(f.policyCode);
  const [h1a, h1b] = twoLines(f.headline);
  const field = f.primary?.fieldPath ?? '(record)';

  // Full record from the sealed context packet: which other fields are byte-identical, and the authoritative text.
  const packet = (inc.contextPacket ?? null) as ContextPacket | null;
  const rec = packet?.records?.find((r) => r.canonical_key === f.recordKey) ?? packet?.records?.[0] ?? null;
  const oldC = (rec?.old_content ?? {}) as Record<string, unknown>, newC = (rec?.new_content ?? {}) as Record<string, unknown>;
  const sourceDerived = isSourceDerived(rec?.new_metadata as Record<string, unknown> | undefined);
  const topKeys = [...new Set([...Object.keys(oldC), ...Object.keys(newC)])];
  const changedTop = new Set(topKeys.filter((k) => !sameJson(oldC[k], newC[k])));
  const roles = source?.fieldRoles ?? {};
  const roleOfTop = (k: string) => Object.entries(roles).find(([p]) => p.replace(/\[\]$/, '').split('.')[0] === k)?.[1] ?? 'UNCLASSIFIED';
  const groups = new Map<string, { changed: boolean; keys: string[] }>();
  for (const k of topKeys) {
    if (k === field.split('.')[0]) continue;
    const gname = ROLE_GROUP[roleOfTop(k)] ?? 'Other fields';
    const cur = groups.get(gname) ?? { changed: false, keys: [] };
    groups.set(gname, { changed: cur.changed || changedTop.has(k), keys: [...cur.keys, k] });
  }
  const textPath = Object.entries(roles).find(([p, r]) => r === 'AUTHORITATIVE_TEXT' && typeof atPath(newC, p) === 'string')?.[0] ?? null;
  const recordText = textPath ? String(atPath(newC, textPath)) : null;
  const textChanged = textPath ? !sameJson(atPath(oldC, textPath), atPath(newC, textPath)) : false;
  const otherIdentical = topKeys.length ? topKeys.length - changedTop.size : null;

  // Matched regression: the latest batch against the protected app, questions in order.
  const allRegs = regs.ok ? regs.data : [];
  const latestBatch = [...allRegs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.batchId ?? null;
  const batch = allRegs.filter((r) => r.batchId === latestBatch).sort((a, b) => (a.questionIndex ?? 0) - (b.questionIndex ?? 0));
  // If the regressions endpoint fails, the incident aggregate still carries each question, both answers and the result.
  const fallback = !regs.ok;
  const fromAggregate: BehaviorQuestion[] = [...inc.regressions].sort((a, b) => Number(b.origin === 'pinned') - Number(a.origin === 'pinned')).map((r) => ({
    id: r.id, origin: r.origin === 'pinned' ? 'Pinned question' : 'Generated', text: r.question,
    result: r.result, resultLabel: r.result ? RESULT_TEXT[r.result] ?? cap(r.result) : 'Pending', material: r.result === 'MATERIAL_CHANGE',
    oldAnswer: r.oldAnswer, newAnswer: r.newAnswer, verdict: null,
    failure: 'the advisory comparison could not be read from the regression endpoint', config: null,
  }));
  const questionsDetail: BehaviorQuestion[] = batch.map((r) => {
    const cmp = r.comparison, adv = cmp?.advisory ?? null;
    const cfgR = (r.config ?? null) as { model?: string; retrieval_config?: { strategy?: string; k?: number } } | null;
    const cls = cmp?.classification ?? r.result;
    return {
      id: r.id, origin: r.origin === 'pinned' ? 'Pinned question' : 'Generated', text: r.question,
      result: cls ?? null, resultLabel: cls ? RESULT_TEXT[cls] ?? cap(cls) : r.status === 'FAILED' ? 'Failed' : 'Pending', material: cls === 'MATERIAL_CHANGE',
      oldAnswer: r.oldAnswer, newAnswer: r.newAnswer,
      verdict: adv ? { label: RESULT_TEXT[adv.result] ?? adv.result, delta: deltaText(adv.delta_types), why: adv.explanation, uncertainties: adv.uncertainties,
          confidence: adv.confidence.toLowerCase(), mode: MODE[String((r.comparisonMeta as { mode?: string } | null)?.mode ?? '')] ?? null }
        : cmp?.classification_source === 'deterministic-identical-output' ? { label: 'No change', delta: 'Identical output', why: 'Both runs produced byte-identical answers, so no model comparison was needed.', uncertainties: [], confidence: null, mode: 'Deterministic' }
        : null,
      failure: r.failure ? String((r.failure as { code?: string; errorCode?: string }).code ?? (r.failure as { errorCode?: string }).errorCode ?? 'stored failure') : null,
      config: { model: cfgR?.model ?? null, retrieval: cfgR?.retrieval_config?.strategy ? `${cfgR.retrieval_config.strategy}${cfgR.retrieval_config.k ? `, k=${cfgR.retrieval_config.k}` : ''}` : null,
        hash: cmp?.model_config_hash ?? r.modelConfigHash, matched: cmp?.matched_config ?? true },
    };
  });
  const questions = fallback ? fromAggregate : questionsDetail;
  const resultRows = fallback ? inc.regressions.map((r) => ({ result: r.result, status: r.result ? 'COMPLETE' : 'PENDING' })) : batch;
  const matCount = resultRows.filter((r) => r.result === 'MATERIAL_CHANGE').length;
  const batchDone = resultRows.length > 0 && resultRows.every((r) => r.status === 'COMPLETE' || r.status === 'FAILED');
  const blastDone = inc.pipelineSteps.some((s) => s.step === 'BLAST_RADIUS' && s.status === 'DONE');
  const br = inc.blastRadius ?? null;
  const downstream = br ? br.nodes.filter((n) => n.assetType !== 'SOURCE' && n.assetType !== 'RECORD') : [];
  const impactedApps = downstream.filter((n) => n.impact === 'IMPACTED');
  const decided = inc.reviews.at(-1) ?? null;
  const allowed = (['APPROVE', 'REJECT', 'KEEP_QUARANTINED', 'ESCALATE'] as const).filter((d) =>
    canReview(d, inc.candidateVersion.status, inc.status, (inc.effectivePolicyAction ?? null) as 'ALLOW' | 'REVIEW' | 'QUARANTINE' | 'ESCALATE' | null));
  const removedWords = f.diff?.removed ?? [];

  return (
    <main id="main" className="scr-incident">
      <section className="phd">
        <div className="wrap g" style={{ rowGap: 14, alignItems: 'start' }}>
          <nav aria-label="Breadcrumb" className="crumbs" style={{ gridColumn: '1 / -1' }}>
            <Link href="/incidents">Incidents</Link><span aria-hidden="true">/</span><Mono>{f.recordKey}</Mono>
          </nav>
          <div className="ph-lead" style={{ gridColumn: '1 / span 8', display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 6 }}>
            <h1 className="ph-title">{h1a}{h1b && <><br />{h1b}</>}</h1>
            <p className="meta" style={{ margin: 0, fontSize: 15 }}>Record <Mono style={{ color: 'var(--ink)' }}>{f.recordKey}</Mono> · field <Mono style={{ color: 'var(--ink)' }}>{field}</Mono> · {sourceDerived ? 'sandbox' : 'upstream'} <Mono style={{ color: 'var(--ink)' }}>{prev} → {cand}{inc.candidateVersion.revisionNumber > 1 ? ` r${inc.candidateVersion.revisionNumber}` : ''}</Mono>{inc.candidateVersion.upstreamPublishedAt ? `, ${sourceDerived ? 'sandbox published' : 'published'} ${dayYear(inc.candidateVersion.upstreamPublishedAt)}` : `, observed ${dayYear(inc.candidateVersion.detectedAt)}`}</p>
            {sourceDerived && <p className="meta" style={{ margin: 0, fontSize: 15 }}>{SOURCE_DERIVED_SCENARIO.disclosure} <a href="https://hadeethenc.com/ar/browse/hadith/10618">Original record 10618</a>.</p>}
          </div>
          <dl className="plate in ph-status" style={{ gridColumn: '9 / span 4', margin: '0 -24px', padding: '8px 24px' }}>
            <div className="kv"><dt>Status</dt><dd style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: sem.tone === 'co' ? 'var(--co-ink)' : sem.tone === 'am' ? 'var(--am-ink)' : 'var(--ink-2)', fontWeight: 600 }}><span className="dot" style={{ background: `var(--${sem.tone === 'n4' ? 'ink-4' : sem.tone})` }} />{sem.text}</dd></div>
            <div className="kv"><dt>Held by</dt><dd>{f.policyCode ? <Mono>{f.policyCode}</Mono> : inc.pipeline?.status === 'RUNNING' ? 'Policy pending' : '—'}</dd></div>
            <div className="kv"><dt>Source</dt><dd>{source?.source.name.split(' — ')[0] ?? inc.sourceId}</dd></div>
            <div className="kv"><dt>Waiting on</dt><dd style={{ fontWeight: 600 }}>{inc.status === 'RESOLVED' ? 'Nobody · decided' : inc.pipeline?.status === 'RUNNING' ? 'The pipeline' : 'Review decision'}</dd></div>
            {synthetic && <SyntheticRow />}
          </dl>
        </div>
      </section>

      <section aria-labelledby="brief-h">
        <div className="wrap">
          <div className="plate tight">
            <h2 id="brief-h" style={{ margin: 0, padding: '18px 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--ink-3)' }}>Case summary</h2>
            <a className="brief" href="#source"><span className="q"><Mk layer="src" />Change</span>
              <span className="a">{removedWords.length && !f.diff?.added.length ? <>«<bdi className={isArabic(removedWords.join(' ')) ? 'ar' : ''} lang={isArabic(removedWords.join(' ')) ? 'ar' : undefined} style={isArabic(removedWords.join(' ')) ? { fontSize: 21 } : undefined}>{removedWords.join(' ')}</bdi>» was removed from the {ROLE_TEXT[f.primary?.fieldRole ?? 'UNCLASSIFIED']?.toLowerCase() ?? 'field'} field.</> : <>{f.headline}</>}{' '}{otherIdentical !== null ? (otherIdentical === 0 ? 'No other field is present.' : `The other ${otherIdentical} ${otherIdentical === 1 ? 'field is' : 'fields are'} byte-identical.`) : ''}</span><span className="go">Source <span aria-hidden="true">→</span></span></a>
            <a className="brief" href="#facts"><span className="q"><Mk layer="det" />Policy trigger</span>
              <span className="a">{policy && f.policyCode ? <>A {ROLE_TEXT[f.primary?.fieldRole ?? 'UNCLASSIFIED']?.toLowerCase()} field{level ? ` on Level ${level} content` : ''} changed, so rule <Mono>{f.policyCode}</Mono> {policy.floorAction === 'ALLOW' ? 'allows it' : 'holds it'}, whatever AI says.</> : 'Policy has not evaluated this candidate yet. It stays unserved meanwhile.'}</span><span className="go">Facts <span aria-hidden="true">→</span></span></a>
            <a className="brief" href="#advisory"><span className="q"><Mk layer="ai" />AI assessment</span>
              <span className="a" style={{ color: 'var(--pu-ink-2)' }}>{out ? [out.risk_level && `${cap(out.risk_level)} risk`, out.confidence && `${out.confidence.toLowerCase()} confidence`].filter(Boolean).join(', ') + (out.risk_level || out.confidence ? '. ' : '') + firstSentence(out.why_it_matters ?? out.executive_summary ?? '') : 'No AI reading is recorded yet.'}</span><span className="go">Advisory <span aria-hidden="true">→</span></span></a>
            <a className="brief" href="#behavior"><span className="q"><Mk layer="det" />Behavioral impact</span>
              <span className="a">{resultRows.length && !batchDone ? `Regression is still running: ${resultRows.filter((r) => r.status === 'COMPLETE').length} of ${resultRows.length} matched questions compared so far.` : resultRows.length ? <>{matCount ? <span style={{ color: 'var(--co-ink)', fontWeight: 600 }}>Yes.</span> : <span style={{ fontWeight: 600 }}>No.</span>} With identical model settings, {matCount} of {resultRows.length} matched questions got materially different answers.</> : 'No matched regression is recorded yet.'}</span><span className="go">Behavior <span aria-hidden="true">→</span></span></a>
            <a className="brief" href="#exposure"><span className="q"><Mk layer="det" />Exposure</span>
              <span className="a">{br ? <>{plural(downstream.length, 'downstream asset')}. {!blastDone && !impactedApps.length ? 'Impact is not proven until the regression and trace steps finish' : impactedApps.length ? <span style={{ color: 'var(--co-ink)' }}>{impactedApps.map((a) => a.name).join(' and ')} {impactedApps.length === 1 ? 'is' : 'are'} impacted</span> : 'No protected app is proven impacted'}; {br.counts.exposed} {br.counts.exposed === 1 ? 'is' : 'are'} <span style={{ color: 'var(--am-ink)' }}>exposed</span>.</> : 'The blast radius has not been traced yet.'}</span><span className="go">Exposure <span aria-hidden="true">→</span></span></a>
            <a className="brief" href="#containment"><span className="q"><Mk layer="pol" />Production safeguard</span>
              <span className="a">{inc.status === 'RESOLVED' ? <>The Trust Gateway serves <Mono>{served}</Mono>.</> : <>The Trust Gateway still serves <Mono>{served}</Mono>. <Mono>{cand}</Mono> is {heldText.toLowerCase()} and unserved.</>}</span><span className="go">Containment <span aria-hidden="true">→</span></span></a>
            <a className="brief" href="#decision"><span className="q" style={{ color: 'var(--ink)' }}><Mk layer="hum" />Review decision</span>
              <span className="a">{inc.status === 'RESOLVED' && decided ? <>Decided: {decided.decision.toLowerCase().replace('_', ' ')} by {decided.reviewer}.</> : <>Approve, reject, keep quarantined or escalate <Mono>{cand}</Mono>.</>}</span><span className="go" style={{ color: 'var(--ink)' }}>Decide <span aria-hidden="true">→</span></span></a>
          </div>
        </div>
      </section>

      {/* 01 SOURCE */}
      <Band id="source" labelledBy="h-src">
        <Rail layer="src" id="h-src" title="Source">Values exactly as received, never normalized.</Rail>
        <div className="main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}><h3 className="h3">Exact change</h3><span className="meta">Field <Mono style={{ color: 'var(--ink-2)' }}>{field}</Mono></span></div>
          <div className="plate tight">
            <ExactDiff oldValue={f.primary?.oldValue ?? null} newValue={f.primary?.newValue ?? null} oldLabel={prev} newLabel={cand}
              oldChip={<Chip tone="tq">Trusted{inc.status !== 'RESOLVED' ? ', served' : ''}</Chip>} newChip={<Chip tone="co">Candidate, {inc.status === 'RESOLVED' ? 'decided' : 'held'}</Chip>}
              flags={f.primary?.flags ?? []} />
            <div className="sub" style={{ rowGap: 16, padding: '18px 0 22px', borderTop: '1px solid var(--line)' }}>
              <div className="c1-2 lv"><span>Snapshot</span><span className="mono">{inc.candidateVersion.rawSnapshotPath ? inc.candidateVersion.rawSnapshotPath.split('/').slice(-3).join('/') : shortHash(inc.candidateVersion.rawSha256)}</span></div>
              <div className="lv" style={{ gridColumn: '3 / span 2' }}><span>Received</span><span>{dayTime(inc.candidateVersion.detectedAt)}</span></div>
              <div className="lv" style={{ gridColumn: '5 / span 3' }}><span>Field role</span><span className="mono">{f.primary?.fieldRole ?? '—'}</span></div>
              <div className="lv" style={{ gridColumn: '8 / span 3' }}><span>Field hash</span><span className="mono">{(f.primary?.oldFieldHash ?? '—').slice(0, 8)} → {(f.primary?.newFieldHash ?? '—').slice(0, 8)}</span></div>
            </div>
          </div>
          <div className="sub" style={{ rowGap: 32, alignItems: 'start' }}>
            <div className="c1-6" style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>
              <span className="cap">Record text, {textChanged ? 'changed' : 'unchanged'}{synthetic && <span style={{ color: 'var(--ink-4)' }}> · synthetic test text</span>}</span>
              {recordText ? (isArabic(recordText)
                ? <p className="ar" lang="ar" dir="rtl" style={{ margin: 0, fontSize: 30, lineHeight: 1.95, color: 'var(--ink-2)', textAlign: 'right' }}>{recordText}</p>
                : <p className="body" style={{ fontSize: 18, lineHeight: '28px' }}>{recordText}</p>)
                : <p className="body">The record text is not part of the sealed packet.</p>}
            </div>
            <div className="c7-10 plate in r" style={{ marginRight: -24 }}>
              <div className="kv"><span className="mono" style={{ color: 'var(--ink)' }}>{field}</span><span style={{ color: 'var(--co-ink)', fontWeight: 600 }}>Changed</span></div>
              {[...groups].map(([name, gr]) => (
                <div key={name} className="kv"><span>{name === 'Metadata' && gr.keys.includes('updated_at') ? <>Metadata, incl. <Mono>updated_at</Mono></> : name}</span>{gr.changed ? <span style={{ color: 'var(--co-ink)', fontWeight: 600 }}>Changed</span> : <span className="ok">Identical</span>}</div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span className="prov"><Mk layer="src" />{synthetic ? 'Received by signed webhook, fetched by the server, stored unmodified.' : 'Fetched by the server from the provider, stored unmodified.'}</span>
            <details>
              <summary>Raw values and field hashes</summary>
              <div className="raw">{`field            ${field}  ·  ${f.primary?.fieldRole ?? ''}\n${prev.padEnd(16)} ${JSON.stringify(f.primary?.oldValue ?? null)}\n${cand.padEnd(16)} ${JSON.stringify(f.primary?.newValue ?? null)}\nold_field_hash   ${f.primary?.oldFieldHash ?? '—'}\nnew_field_hash   ${f.primary?.newFieldHash ?? '—'}\nraw_sha256       ${inc.candidateVersion.rawSha256}\ncanonical_sha256 ${inc.candidateVersion.canonicalSha256}\nsnapshot         ${inc.candidateVersion.rawSnapshotPath ?? '—'} · raw bytes retained`}</div>
            </details>
          </div>
        </div>
      </Band>

      {/* 02 FACTS */}
      <Band id="facts" labelledBy="h-facts">
        <Rail layer="det" id="h-facts" title="Deterministic">Reproducible from the bytes; only facts trigger policy.</Rail>
        <div className="main">
          <h3 className="h3">Deterministic evidence</h3>
          <div className="plate tight">
            <div className="sub">
              <div className="c1-5">
                <Kv k="Change type"><Mono>{f.primary?.changeType ?? '—'}</Mono></Kv>
                <Kv k="Field role, declared"><Mono>{f.primary?.fieldRole ?? '—'}</Mono></Kv>
                <Kv k="Equivalence">{f.primary?.flags.length ? f.primary.flags.join(', ') : 'None, so substantive'}</Kv>
              </div>
              <div className="c6-10">
                <Kv k="Content level"><Mono>{level ?? '—'}</Mono></Kv>
                <Kv k="Silent mutation">{inc.candidateVersion.silentMutation ? 'Yes, same label, different bytes' : source?.source.versionLabelPublished === false ? 'Not claimed: no label published' : 'No, label changed'}</Kv>
                <Kv k="Revision"><span title={versionHint(inc.candidateVersion.upstreamLabel)}><Mono>{versionText(inc.candidateVersion.upstreamLabel, inc.candidateVersion.revisionNumber)}</Mono></span></Kv>
              </div>
            </div>
          </div>
          <p className="body">{f.diff && !f.primary?.flags.length ? `${f.diff.removed.length + f.diff.added.length === 1 ? 'A whole word' : 'Whole words'} ${f.diff.removed.length && !f.diff.added.length ? 'left' : 'changed in'} the token sequence, so this is not a whitespace, Unicode, harakat or punctuation variant. ` : ''}The connector declares <Mono>{field}</Mono> a {ROLE_TEXT[f.primary?.fieldRole ?? 'UNCLASSIFIED']?.toLowerCase()} field; roles are never inferred by AI.</p>
        </div>
      </Band>

      {/* 03 AI ADVISORY */}
      <Band id="advisory" labelledBy="h-ai">
        <Rail layer="ai" id="h-ai" title="AI advisory" titleStyle={{ color: 'var(--pu-ink)' }}>Advisory only; it can raise the response, never lower it.</Rail>
        <div className="main">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', alignItems: 'center' }}>
            <h3 className="h3">AI assessment</h3>
            {inc.analysis && <span className="pill" style={{ border: '1px dashed var(--pu-line)', color: 'var(--pu-ink-2)' }}>{analysisText(inc.analysis.analysisType)}</span>}
            {inc.analysis && <span style={{ marginLeft: 'auto' }} className="meta">{inc.analysis.meta.mode === 'replay' ? `Replayed response${inc.analysis.meta.recordedAt ? ` (recorded ${dayTime(inc.analysis.meta.recordedAt)})` : ''}` : MODE[inc.analysis.meta.mode]} · {inc.analysis.meta.promptVersion}</span>}
          </div>
          {!inc.analysis || !out ? (
            <div className="plate adv" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <b style={{ color: 'var(--pu-ink)' }}>{inc.pipelineSteps.some((s) => s.step === 'ANALYSIS' && s.status === 'FAILED') ? 'The AI reading failed' : 'No AI reading recorded yet'}</b>
              <p className="body">Deterministic evidence above stands on its own. Policy fails closed on sensitive content when analysis fails.</p>
            </div>
          ) : (
            <div className="plate adv" style={{ paddingTop: 36, paddingBottom: 28, display: 'flex', flexDirection: 'column', gap: 36 }}>
              <div className="sub" style={{ rowGap: 24, alignItems: 'start' }}>
                <div className="c1-7" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <blockquote className="ai" style={{ margin: 0, fontSize: 30, lineHeight: '42px', color: 'var(--quote)' }}>“{out.executive_summary}”</blockquote>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: '22px', color: 'var(--ink-3)', maxWidth: 620 }}>Not a ruling on which grading is correct, only what the change may mean to a reader.{inc.analysis.meta.mode === 'mock' ? ' This is a deterministic mock placeholder; no model was called.' : ''}</p>
                </div>
                <dl className="c8-10" style={{ margin: 0, borderRadius: 14, border: '1px dashed var(--pu-line)', padding: '4px 16px' }}>
                  <div className="kv" style={{ borderBottom: '1px dashed var(--pu-line)' }}><dt>Risk</dt><dd style={{ color: 'var(--pu-ink-2)', fontWeight: 600 }}>{cap(out.risk_level ?? inc.analysis.riskLevel)}</dd></div>
                  <div className="kv" style={{ borderBottom: '1px dashed var(--pu-line)' }}><dt>Confidence</dt><dd style={{ color: 'var(--pu-ink-2)', fontWeight: 600 }}>{out.confidence ? cap(out.confidence) : '—'}</dd></div>
                  <div className="kv"><dt>Suggests</dt><dd style={{ color: 'var(--pu-ink-2)' }}>{out.recommended_action ? cap(out.recommended_action) : '—'}</dd></div>
                </dl>
              </div>
              <div className="sub" style={{ rowGap: 28, borderTop: '1px dashed var(--pu-line)', paddingTop: 28 }}>
                <div className="c1-5" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={{ fontSize: 14, fontWeight: 600, color: 'var(--pu-ink)' }}>Linguistic</span><p className="body">{out.domain_analysis?.linguistic || '—'}</p></div>
                <div className="c6-10" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={{ fontSize: 14, fontWeight: 600, color: 'var(--pu-ink)' }}>Evidence scope</span><p className="body">{out.domain_analysis?.evidence_scope || '—'}</p></div>
                <div className="c1-5" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={{ fontSize: 14, fontWeight: 600, color: 'var(--pu-ink)' }}>Uncertain</span><p className="body">{out.uncertainties?.join(' ') || '—'}</p></div>
                <div className="c6-10 prov" style={{ alignSelf: 'end', textAlign: 'right', maxWidth: 'none' }}><Mk layer="ai" /><Mono>{inc.analysis.meta.model}</Mono> · {inc.analysis.meta.mode === 'replay' ? 'recorded' : 'analysed'} {dayTime(inc.analysis.meta.recordedAt ?? inc.analysis.createdAt)}</div>
              </div>
            </div>
          )}
        </div>
      </Band>

      {/* 04 BEHAVIOR */}
      <Band id="behavior" labelledBy="h-beh">
        <Rail layer="det" id="h-beh" title="Behavioral regression">Matched regression; only the knowledge version changes.</Rail>
        <div className="main" style={{ gap: 32 }}>
          <div className="sub" style={{ alignItems: 'start', rowGap: 12 }}>
            <h3 className="h3 c1-7">Same model. Different knowledge.</h3>
            <p className="c8-10 body" style={{ color: 'var(--ink-3)', paddingBottom: 2 }}>Each question was asked twice with the same model, prompt and retrieval. Only the version of {f.recordKey} differed.</p>
          </div>
          {questions.length === 0 ? (
            <div className="plate"><b>No matched regression is recorded yet.</b><p className="body">{inc.pipeline?.status === 'RUNNING' ? 'The regression steps are still running.' : 'Behavior was not tested for this candidate.'}</p></div>
          ) : (
            <Behavior questions={questions} recordKey={f.recordKey}
              oldLabel={batch[0] ? versionText(batch[0].oldVersion.label, batch[0].oldVersion.revisionNumber, 'needed') : prev}
              newLabel={batch[0] ? versionText(batch[0].newVersion.label, batch[0].newVersion.revisionNumber, 'needed') : cand} />
          )}
          {fallback && questions.length > 0 && <span className="prov" role="note"><Mk layer="ai" />Answers and results are from the incident record. The advisory verdict, batch and config hash could not be read: <Mono>{`GET /api/incidents/${inc.id.slice(0, 8)}…/regressions`}</Mono> returned an error.</span>}
          {batch[0] && <span className="prov"><Mk layer="det" />Batch <Mono>{batch[0].batchId.slice(0, 8)}</Mono> against the protected app <Mono>{batch[0].protectedAppId}</Mono>, comparing <Mono>{versionText(batch[0].oldVersion.label, batch[0].oldVersion.revisionNumber)}</Mono> → <Mono>{versionText(batch[0].newVersion.label, batch[0].newVersion.revisionNumber)}</Mono>. Answers and retrieved records are stored for both runs.</span>}
        </div>
      </Band>

      {/* 05 EXPOSURE */}
      <Band id="exposure" labelledBy="h-exp">
        <Rail layer="det" id="h-exp" title="Exposure">The graph proves exposure; regression proves impact.</Rail>
        <div className="main">
          <HeadRow title="Dependency exposure" right={<Lnk href={`/incidents/${inc.id}/blast-radius`}>Open Blast Radius</Lnk>} />
          {!br ? <div className="plate"><b>The blast radius has not been traced yet.</b></div> : (
            <div className="plate" style={{ paddingTop: 28, paddingBottom: 32 }}>
              <div className="sub" style={{ alignItems: 'center', rowGap: 16, paddingBottom: 28, marginBottom: 28, borderBottom: '1px solid var(--line)' }}>
                <div className="c1-6" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="radius" role="img" aria-label={`Blast radius: ${br.counts.impacted} impacted, ${br.counts.exposed} exposed, ${br.counts.stale} stale`} style={{ gridTemplateColumns: `repeat(${Math.max(1, downstream.length)},minmax(0,1fr))` }}>
                    {[...downstream].sort((a, b) => (a.impact === 'IMPACTED' ? -1 : b.impact === 'IMPACTED' ? 1 : 0)).map((n) => <span key={n.id} style={n.impact === 'STALE' ? { background: 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--am)' } : { background: n.impact === 'IMPACTED' ? 'var(--co)' : 'var(--am)' }} />)}
                  </div>
                  <span className="cap">Blast radius · {plural(downstream.length, 'downstream asset')}</span>
                </div>
                <div className="c7-10" style={{ display: 'flex', justifyContent: 'flex-end', gap: 32 }}>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><b style={{ fontSize: 28, lineHeight: '32px', fontWeight: 600, color: 'var(--co-ink)' }}>{br.counts.impacted}</b><span className="cap">Impacted</span></span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><b style={{ fontSize: 28, lineHeight: '32px', fontWeight: 600, color: 'var(--am-ink)' }}>{br.counts.exposed}</b><span className="cap">Exposed</span></span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><b style={{ fontSize: 28, lineHeight: '32px', fontWeight: 600, color: br.counts.stale ? 'var(--am-ink)' : 'var(--ink-3)' }}>{br.counts.stale}</b><span className="cap">Stale</span></span>
                </div>
              </div>
              <div style={{ overflowX: 'auto', margin: '0 -8px', padding: '0 8px' }}><ExposureTrack br={br} /></div>
            </div>
          )}
          <p className="body" style={{ color: 'var(--ink-3)' }}>Exposure is a dependency fact. Only a protected app can be impacted, and only when a regression run proves a material change.{br?.counts.stale ? '' : ' Nothing is stale until a version is promoted.'}</p>
        </div>
      </Band>

      {/* 06 POLICY */}
      <Band id="containment" labelledBy="h-pol">
        <Rail layer="pol" id="h-pol" title="Policy">The rule holding the candidate.</Rail>
        <div className="main">
          <HeadRow title={held ? 'Production safeguards' : inc.status === 'RESOLVED' ? 'Production safeguards · decided' : 'Production safeguards · pipeline running'} right={<Lnk href={g?.appId ? `/gateway/${g.appId}` : '/gateway'}>Open Trust Gateway</Lnk>} />
          <div className="plate" style={{ paddingTop: 24, paddingBottom: 24 }}>
            {held && <div style={{ overflowX: 'auto', margin: '0 -8px', padding: '0 8px' }}><GateMini candidate={cand} trusted={served} appName={appName} policyCode={f.policyCode} heldText={heldText} /></div>}
            <div style={{ marginTop: held ? 20 : 0, borderTop: held ? '1px solid var(--line)' : 0 }}>
              <div className="sub">
                <div className="c1-5">
                  <Kv k="Rule">{f.policyCode ? <span><Mono>§ {f.policyCode}</Mono> {policy?.name}</span> : 'Not yet evaluated'}</Kv>
                  <Kv k="Trigger · fact">{policy?.trigger ? <span>Substantive <Mono>{policy.trigger}</Mono></span> : '—'}</Kv>
                </div>
                <div className="c6-10">
                  <Kv k="Floor">{policy?.floor ?? '—'}</Kv>
                  <Kv k="Advisory recorded"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Mk layer="ai" style={{ width: 8, height: 8 }} />{[out?.risk_level ? `${cap(out.risk_level)} risk` : null, resultRows.length ? (matCount ? 'material change' : 'no material change') : null].filter(Boolean).join(', ') || 'None'}</span></Kv>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '16px 0 4px', borderTop: '1px solid var(--line-2)' }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>Result</span>
                <span className="chip" style={{ fontSize: 14, color: 'var(--ink)' }}><span className="dot" style={{ background: held ? (inc.status === 'QUARANTINED' ? 'var(--co)' : 'var(--am)') : 'var(--ink-4)' }} />{inc.status === 'QUARANTINED' ? 'Quarantined until you decide' : inc.status === 'NEEDS_REVIEW' ? 'Held for review until you decide' : inc.status === 'RESOLVED' ? 'Resolved' : 'Pending'}</span>
              </div>
            </div>
          </div>
          <p className="body" style={{ color: 'var(--ink-3)' }}>Advisory facts can raise an action, never lower it.{policy && out?.recommended_action ? (out.recommended_action === policy.floorAction ? ' Here they agree with the rule’s floor.' : ` Here the AI suggested ${out.recommended_action.toLowerCase()}; the floor stands.`) : ''}</p>
        </div>
      </Band>

      {/* 07 HUMAN DECISION */}
      <section id="decision" aria-labelledby="h-dec" style={{ padding: '64px 0 120px' }}>
        <div className="wrap g">
          <Rail layer="hum" id="h-dec" title="Review decision" decision>{inc.status === 'RESOLVED' ? 'Decided and recorded.' : reviewer?.canSign ? 'Reviewer active. Your signature records a real decision.' : reviewer ? 'Judge preview active. No decision can be signed.' : 'Reviewer authentication required to sign a decision.'}</Rail>
          <div className="main" style={{ gap: 0 }}>
            <div className="handoff">
              {f.policyCode ? <HeldBy code={f.policyCode} /> : <Chip tone="am">Policy pending</Chip>}
              <span className="handoff-line" aria-hidden="true" />
              {inc.status === 'RESOLVED' ? <HandedToYou>Signed</HandedToYou> : <ReviewerStatus active={!!reviewer?.canSign} />}
            </div>
            <div className="handoff-drop" aria-hidden="true" />
            <DecisionDock incidentId={inc.id} candidate={cand} previous={prev} served={served} appName={appName} candidateState={heldText}
              allowed={allowed} aiPill={aiSuggestion(out)} reviewer={reviewer}
              recorded={decided ? { decision: decided.decision, reviewer: decided.reviewer, at: dayTime(decided.createdAt) } : null}
              resolved={inc.status === 'RESOLVED'} />
          </div>
        </div>
      </section>
    </main>
  );
}

/** The first sentence of an AI paragraph, for the one-line case summary; the full text stays in the advisory section. */
function firstSentence(t: string): string {
  const m = t.match(/^[\s\S]*?[.!?؟](?=\s|$)/);
  return (m ? m[0] : t).trim();
}
