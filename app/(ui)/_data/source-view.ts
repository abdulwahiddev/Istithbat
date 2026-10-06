import 'server-only';
import type { SourceDetail } from '@/lib/contracts';
import type { SourceView, Stage } from '@/components/sources/types';
import { evTime, plural, REVISION_NOTE, shortHash, versionHint } from '@/components/strata/format';
import { vl, vr, type SourceModel } from './source-model';

const fill = (c: string) => `background:${c}`;
const ring = (c: string) => `border:2px solid ${c};background:var(--plate-a)`;
const HOLLOW = 'border:2px solid var(--line-2);background:var(--plate-a)';
const TQ = 'var(--tq)', CO = 'var(--co)', AM = 'var(--am)', N = 'var(--line-2)';

/** Lineage stages and detail facts for one source. Every value is from the contracts. */
export function sourceView(m: SourceModel, detail: SourceDetail | null): SourceView {
  const s = m.summary, f = m.facts;
  const showRev = (x: SourceModel['latest']) => (x ? (f.real || x.revision > 1 ? vr(x)! : vl(x)) : '—');
  const heldLine = m.state === 'held' || m.state === 'rejected';
  const latestSub = !m.latest ? 'Nothing observed' : !m.changed ? (f.real ? 'No change since baseline' : 'Same as trusted')
    : m.state === 'held' ? `New version · ${m.held?.incidentStatus === 'QUARANTINED' ? 'held' : 'held for review'}`
    : m.state === 'rejected' ? 'Rejected · not trusted' : 'New version · investigating';
  const stages: Stage[] = [
    { main: f.upstream.main, sub: f.upstream.sub, dot: fill('var(--ink-4)'), line: N, lineStyle: 'solid' },
    { main: showRev(m.latest), sub: latestSub, dot: m.changed ? fill(heldLine ? CO : AM) : ring(TQ), line: m.changed ? (heldLine ? CO : AM) : TQ, lineStyle: m.changed ? 'dashed' : 'solid', mono: true, hint: m.latest ? versionHint(m.latest.label) : undefined },
    { main: m.trusted ? showRev(m.trusted) : 'None', sub: m.trusted ? (f.real ? 'Baseline trusted' : 'Trusted') : 'No trusted baseline', dot: m.trusted ? fill(TQ) : HOLLOW, line: m.bound ? TQ : N, lineStyle: m.bound ? 'solid' : 'dashed', mono: !!m.trusted, hint: m.trusted ? versionHint(m.trusted.label) : undefined },
    m.bound
      ? { main: m.appName ?? m.appId ?? 'Protected app', sub: `Serves ${vl(m.served)}`, dot: fill(TQ), line: 'transparent', lineStyle: 'solid' }
      : { main: 'No binding', sub: m.trusted ? 'Trusted, not served' : 'Not served', dot: HOLLOW, line: 'transparent', lineStyle: 'solid' },
  ];
  const changes = detail && m.latest && m.changed ? detail.changes.filter((c) => c.toVersionId === m.latest!.id) : [];
  const keys = [...new Set(changes.map((c) => c.canonicalKey))];
  const latestVersion = detail?.versions.find((x) => x.id === m.latest?.id) ?? null;
  const healthy = s.connectorHealth === 'HEALTHY';
  const chips = [
    s.isDemoFixture ? { label: 'Synthetic', tone: AM } : { label: 'Real', tone: 'var(--ink-3)' },
    { label: healthy ? 'Healthy' : s.connectorHealth.charAt(0) + s.connectorHealth.slice(1).toLowerCase(), tone: healthy ? TQ : AM },
    m.state === 'held' ? { label: 'Candidate held', tone: CO } : m.state === 'investigating' ? { label: 'Investigating', tone: AM } : m.state === 'rejected' ? { label: 'Candidate rejected', tone: CO } : m.state === 'no-baseline' ? { label: 'No baseline', tone: AM } : { label: 'Matches baseline', tone: TQ },
  ];
  const app = m.appName ?? 'the protected app';
  const sentence =
    m.state === 'held' ? `${vl(m.latest)} arrived by ${f.trigger} and changed ${plural(changes.length || 1, 'field')}. It is ${m.held?.incidentStatus === 'QUARANTINED' ? 'quarantined' : 'held for review'}; ${m.bound ? `production keeps serving the trusted ${vl(m.trusted)} to ${app}.` : 'nothing is served from it.'}`
    : m.state === 'investigating' ? `${vl(m.latest)} is being investigated. It stays unserved until policy and, where required, a person decide.`
    : m.state === 'rejected' ? `${vl(m.latest)} was rejected. ${m.bound ? `Production keeps serving the trusted ${vl(m.trusted)} to ${app}.` : 'Nothing is served from it.'}`
    : m.state === 'no-baseline' ? 'No version of this source has been trusted yet. Nothing is served from it.'
    : m.bound ? `Trusted and served: ${app} reads ${vl(m.served ?? m.trusted)}, the trusted version. Nothing is waiting.`
    : s.versionLabelPublished === false
      ? 'Trusted baseline, unchanged since it was established. It is not bound to a protected app, so nothing is served from it. That is a binding choice, not a trust gap.'
      : `Trusted baseline at the provider’s published version ${m.trusted!.label}. Not bound to a protected app, so nothing is served from it.`;
  const checks = (detail?.checks ?? []).slice(0, 3).map((c) => {
    const ver = detail?.versions.find((x) => x.id === c.sourceVersionId);
    const first = ver && !ver.previousVersionId;
    const title = c.status === 'NEW_VERSION' ? (first ? 'First observation' : `New version ${ver ? vr({ label: ver.upstreamLabel, revision: ver.revisionNumber }) : ''}`.trim())
      : c.status === 'NO_CHANGE' ? 'Repeat check' : c.status.charAt(0) + c.status.slice(1).toLowerCase().replace(/_/g, ' ');
    const note = c.status === 'NO_CHANGE' ? 'Identical raw bytes'
      : c.status === 'NEW_VERSION' ? (first ? `r${ver?.revisionNumber ?? 1} recorded · no pipeline for a first snapshot` : c.triggerType === 'WEBHOOK' ? 'Signed webhook, then server fetch' : `${c.triggerType.charAt(0)}${c.triggerType.slice(1).toLowerCase()} check, then server fetch`)
      : c.errorCode ?? 'Check did not complete';
    const tone = c.status === 'NO_CHANGE' ? TQ : c.status === 'NEW_VERSION' ? (first ? 'var(--ink-4)' : CO) : AM;
    return { when: evTime(c.checkedAt), title, note, code: c.status, mk: `width:8px;height:8px;background:${tone}` };
  });
  const latestLabel = m.latest ? `${vr(m.latest)}${m.changed ? ` · ${m.latest.status.toLowerCase()}` : ''}` : '—';
  return {
    id: s.id, tab: f.tab, name: f.title, provider: s.provider, kind: f.kind, synthetic: s.isDemoFixture,
    records: f.recordsPhrase(m.recordCount), stages, chips, sentence,
    latest: latestLabel, trusted: m.trusted ? `${vr(m.trusted)}${f.real ? ' · baseline' : ''}` : 'None',
    served: m.bound ? `${vl(m.served)} to ${app}` : 'Nothing · no protected-app binding',
    changed: m.changed ? `Yes · ${plural(changes.length, 'field')}${keys.length ? ` in ${keys.join(', ')}` : ''}` : 'No',
    connector: `${s.connectorType ?? s.sourceType} · ${f.real ? 'read-only' : 'sandbox'}`, scope: f.scope(m.recordCount), keys: f.keys, level: s.contentLevel,
    strategy: f.strategy, revision: f.revisionRule, silent: f.silent,
    raw: shortHash(latestVersion?.rawSha256), canon: shortHash(latestVersion?.canonicalSha256),
    checks, termsLabel: f.termsLabel, terms: f.terms, endpoint: f.endpointLines.join('\n'),
    held: m.state === 'held' ? { incidentId: m.held!.incidentId, label: vl(m.latest) } : null,
    revisionHint: s.versionLabelPublished === false ? REVISION_NOTE : undefined,
  };
}
