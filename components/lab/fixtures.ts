/**
 * Local-only UI fixtures (the /lab stories, enabled by STRATA_LAB=1 on a dev machine). They exist
 * to test layout at scale — many incidents, apps, sources and events, long Arabic and English — and
 * are never read by a production route. Every name says "Fixture".
 */
import type { AuditEvent, BlastRadius } from '@/lib/contracts';
import type { BlastLabels } from '@/components/blast/BlastInstrument';
import type { GateLane } from '@/components/gateway/GateInstrument';
import type { IncidentRow } from '@/components/strata/IncidentList';
import type { RecordContext } from '@/components/record/RecordLedger';
import type { SourceView } from '@/components/sources/types';

type BNode = BlastRadius['nodes'][number];
const LONG_EN = 'Fixture Comparative Jurisprudence Knowledge Assistant for Multilingual Scholarly Review';
const LONG_AR = 'مساعد المعرفة التجريبي لمراجعة الأحكام الحديثية متعدد اللغات';

export function blastFixture(o: { apps: number; impacted: number; apis: number; stalePct?: number; long?: boolean }): { br: BlastRadius; labels: BlastLabels } {
  const node = (id: string, name: string, assetType: string, impact: BNode['impact'], path: string[], extra: Partial<BNode> = {}): BNode => ({
    id, name, assetType, impact, dependencyPaths: path.length ? [path] : [], derivationMode: 'GATEWAY_RESOLVED', derivedFromVersionId: 'v1',
    currentlyServesCandidate: false, servedVersionId: null, regressionEvidence: [], regressionRunIds: [], ...extra,
  });
  const base = ['src', 'rec', 'ds', 'ch', 'ix'];
  const nodes: BNode[] = [
    node('src', 'Fixture Source — synthetic', 'SOURCE', 'HEALTHY', [], { derivationMode: null, derivedFromVersionId: null }),
    node('rec', 'FIX-0001', 'RECORD', 'HEALTHY', [], { derivationMode: null, derivedFromVersionId: null }),
    node('ds', o.long ? 'Fixture Evidence Dataset with an Exceptionally Long Descriptive Name' : 'Fixture Dataset', 'DATASET', 'EXPOSED', base.slice(0, 3)),
    node('ch', 'Fixture Chunk Set', 'RAG_CHUNK', 'EXPOSED', base.slice(0, 4), { derivationMode: 'MATERIALIZED' }),
    node('ix', 'Fixture Index', 'KNOWLEDGE_INDEX', 'EXPOSED', base, { derivationMode: 'MATERIALIZED' }),
  ];
  const edges: BlastRadius['edges'] = [
    { id: 'e-s', from: 'src', to: 'rec', type: 'CONTAINS' }, { id: 'e-r', from: 'rec', to: 'ds', type: 'X' },
    { id: 'e-d', from: 'ds', to: 'ch', type: 'X' }, { id: 'e-c', from: 'ch', to: 'ix', type: 'X' },
  ];
  for (let a = 0; a < o.apis; a++) {
    const id = `api${a}`;
    nodes.push(node(id, a === 0 && o.long ? 'Fixture Retrieval API v2 (regional mirror)' : `Fixture API ${a + 1}`, 'API', 'EXPOSED', [...base, id], { derivationMode: a % 2 ? 'MATERIALIZED' : 'GATEWAY_RESOLVED' }));
    edges.push({ id: `e-i-${id}`, from: 'ix', to: id, type: 'X' });
  }
  for (let i = 0; i < o.apps; i++) {
    const api = `api${i % o.apis}`, id = `app${i}`;
    const impacted = i < o.impacted, protectedApp = impacted || i % 3 === 0;
    const stale = !protectedApp && (o.stalePct ?? 0.4) > 0 && i % Math.max(1, Math.round(1 / (o.stalePct ?? 0.4))) === 1;
    const name = o.long && i === 0 ? LONG_AR : o.long && i === 1 ? LONG_EN : `Fixture App ${String(i + 1).padStart(2, '0')}`;
    nodes.push(node(id, name, 'APPLICATION', impacted ? 'IMPACTED' : 'EXPOSED', [...base, api, id], {
      derivationMode: stale ? 'MATERIALIZED' : 'GATEWAY_RESOLVED', servedVersionId: protectedApp ? 'v1' : null,
      regressionEvidence: impacted ? [{ id: `run${i}a`, oldVersionId: 'v1', newVersionId: 'v2', baselineMatchesIncident: true }, { id: `run${i}b`, oldVersionId: 'v1', newVersionId: 'v2', baselineMatchesIncident: true }] : [],
      regressionRunIds: impacted ? [`run${i}a`, `run${i}b`] : [],
    }));
    edges.push({ id: `e-${api}-${id}`, from: api, to: id, type: 'X' });
  }
  const counts = { impacted: nodes.filter((n) => n.impact === 'IMPACTED').length, exposed: nodes.filter((n) => n.impact === 'EXPOSED').length, stale: 0 };
  const br: BlastRadius = {
    incidentId: 'fixture', sourceId: 'fixture-source', previousVersionId: 'v1', candidateVersionId: 'v2', incidentStatus: 'QUARANTINED', policyAction: 'QUARANTINE',
    trustedVersionId: 'v1', candidateServed: false, changes: [{ id: 'c1', canonicalKey: 'FIX-0001', fieldPath: 'judgment', fieldRole: 'SCHOLAR_JUDGMENT' }],
    nodes, edges, counts, traversalHash: 'f'.repeat(64), traversalStatus: 'LIVE', execution: null, history: [],
  } as unknown as BlastRadius;
  const runBatch = Object.fromEntries(nodes.flatMap((n) => n.regressionRunIds).map((r) => [r, 'batch fixture1']));
  return { br, labels: { sourceName: 'Fixture Source — synthetic', candidate: 'v2', previous: 'v1', trustedLabel: 'v1', versionLabel: { v1: 'v1', v2: 'v2' }, runBatch, changedWord: null, changedField: 'judgment', incidentHeld: true } };
}

const SOURCES = [
  ['fx-a', 'Fixture Hadith Collection'], ['fx-b', 'Fixture Encyclopedia of Translated Narrations with a Very Long Provider Name'],
  ['fx-c', 'مصدر تجريبي للأحاديث المترجمة'], ['fx-d', 'Fixture Quran Translation API'], ['fx-e', 'Fixture Fatwa Archive'],
] as const;

export function incidentFixtures(n: number): IncidentRow[] {
  const states: [IncidentRow['group'], string, IncidentRow['mark']][] = [
    ['decide', 'Quarantined', 'impacted'], ['decide', 'Held for review', 'exposed'], ['investigating', 'Investigating', 'exposed'], ['resolved', 'Resolved', 'neutral'],
  ];
  const heads = [
    'One word was removed from a grading field', 'The English translation was reworded throughout',
    'تغيّر التشكيل في كلمة واحدة من متن الحديث', 'A narrator name changed in the chain of transmission and two punctuation marks moved',
    'Punctuation changed in the judgment field', 'The source reference was replaced',
  ];
  return Array.from({ length: n }, (_, i) => {
    const [group, stateText, mark] = states[i % states.length];
    const [sourceId, sourceName] = SOURCES[i % SOURCES.length];
    const d = new Date(Date.UTC(2026, 9, 5, 21, 0) - i * 3_600_000 * 7);
    return {
      id: `fx-${i}`, href: '#', recordKey: `FIX-${String(4800 + i).padStart(4, '0')}`, candidate: `v${14 + (i % 4)}`, sourceId, sourceName,
      headline: heads[i % heads.length], group, stateText, mark, policyCode: group === 'investigating' ? null : ['POL-002', 'POL-003', 'POL-001'][i % 3],
      openedAt: d.toISOString(), openedText: d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
      risk: i % 4 === 1 ? 'HIGH' : i % 4 === 0 ? 'MEDIUM' : null,
    };
  });
}

export function laneFixtures(n: number, held: number): GateLane[] {
  return Array.from({ length: n }, (_, i) => {
    const [sourceId, sourceName] = SOURCES[i % SOURCES.length];
    const t = `v${10 + i}`;
    return { sourceId: `${sourceId}-${i}`, sourceName, trusted: t, served: t, candidate: i < held ? { label: `v${11 + i}`, state: i % 2 ? 'Held for review' : 'Quarantined', policyCode: i % 2 ? null : 'POL-002' } : null };
  });
}

export function sourceFixtures(n: number): SourceView[] {
  const fill = (c: string) => `background:${c}`, ring = (c: string) => `border:2px solid ${c};background:var(--plate-a)`, hollow = 'border:2px solid var(--line-2);background:var(--plate-a)';
  return Array.from({ length: n }, (_, i) => {
    const [id, name] = SOURCES[i % SOURCES.length];
    const changed = i % 3 === 0, bound = i % 2 === 0;
    return {
      id: `${id}-${i}`, tab: name.split(' ')[1] ?? name, name, provider: 'Fixture provider', kind: i % 2 ? 'Real · read-only HTTP API' : 'Synthetic · webhook', synthetic: !(i % 2), records: `${(i + 1) * 7} records`,
      stages: [
        { main: 'fixture.example', sub: 'Publishes version labels', dot: fill('var(--ink-4)'), line: 'var(--line-2)', lineStyle: 'solid' },
        { main: changed ? `v${12 + i} · r1` : `v${11 + i} · r1`, sub: changed ? 'New version · held' : 'No change since baseline', dot: changed ? fill('var(--co)') : ring('var(--tq)'), line: changed ? 'var(--co)' : 'var(--tq)', lineStyle: changed ? 'dashed' : 'solid', mono: true },
        { main: `v${11 + i} · r1`, sub: 'Trusted', dot: fill('var(--tq)'), line: bound ? 'var(--tq)' : 'var(--line-2)', lineStyle: bound ? 'solid' : 'dashed', mono: true },
        bound ? { main: 'Fixture Protected App', sub: `Serves v${11 + i}`, dot: fill('var(--tq)'), line: 'transparent', lineStyle: 'solid' } : { main: 'No binding', sub: 'Trusted, not served', dot: hollow, line: 'transparent', lineStyle: 'solid' },
      ],
      chips: [{ label: changed ? 'Candidate held' : 'In agreement', tone: changed ? 'var(--co)' : 'var(--tq)' }, { label: 'Healthy', tone: 'var(--tq)' }],
      sentence: 'Fixture source used to test lineage layout with long names and many rows.', latest: `v${12 + i} · r1`, trusted: `v${11 + i} · r1`, served: bound ? 'Fixture Protected App' : 'Not served', changed: changed ? 'Yes' : 'No',
      connector: 'HTTP_FIXTURE', scope: 'Fixture scope', keys: 'FIX-*', level: 'A', strategy: 'Provider publishes a label', revision: 'r1 per label', silent: 'Detectable', raw: 'sha256:fixture', canon: 'sha256:fixture',
      checks: [], termsLabel: 'Terms and attribution', terms: 'Fixture attribution text. Required attribution remains reachable from the source details.', endpoint: 'GET https://fixture.example/api', held: null,
    };
  });
}

export function recordFixture(): { ctx: RecordContext; events: AuditEvent[] } {
  const t = (m: number) => new Date(Date.UTC(2026, 9, 5, 20, 0) + m * 60_000).toISOString();
  const ev = (i: number, eventType: string, actor: string, metadata: Record<string, unknown> = {}, entityType = 'incident', entityId = 'fx-inc'): AuditEvent => ({ id: `fx-e${i}`, eventType, entityType, entityId, actor, metadata, createdAt: t(i) });
  const events: AuditEvent[] = [
    ev(0, 'BASELINE_SEEDED', 'system:seed', {}, 'source_version', 'v1'),
    ev(1, 'SOURCE_VERSION_DETECTED', 'system:connector', { changeCount: 3 }, 'source_version', 'v2'),
    ev(2, 'PIPELINE_STARTED', 'system:pipeline', { fastPath: false }),
    ev(3, 'CONTEXT_PACKET_ATTACHED', 'system:pipeline', { hash: 'a'.repeat(64) }),
    ev(4, 'INCIDENT_CREATED', 'system:pipeline'),
    ev(5, 'ANALYSIS_SUCCEEDED', 'ai:fixture-model', { mode: 'replay', riskLevel: 'HIGH' }),
    ...Array.from({ length: 6 }, (_, k) => ev(6 + k, 'REGRESSION_COMPARISON_COMPLETED', 'system:regression', { result: k % 3 ? 'MATERIAL_CHANGE' : 'NO_CHANGE', appId: `fixture-app-${k % 2}` })),
    ev(12, 'BLAST_RADIUS_COMPUTED', 'system:blast', { counts: { impacted: 4, exposed: 18, stale: 0 } }),
    ev(13, 'POLICY_EVALUATED', 'system:policy', { policyCode: 'POL-002', action: 'QUARANTINE' }),
    ev(14, 'VERSION_QUARANTINED', 'system:policy', {}, 'source_version', 'v2'),
  ];
  const ctx: RecordContext = {
    incidentId: 'fx-inc', recordKey: 'FIX-0001', candidateId: 'v2', candidateLabel: 'v2 · r1', previousId: 'v1', previousLabel: 'v1 · r1', servedLabel: 'v1', appName: 'Fixture Protected App',
    open: true, approveAllowed: true, versionLabel: { v1: 'v1 · r1', v2: 'v2 · r1' },
    change: { field: 'matn', old: 'قال رسول الله صلى الله عليه وسلم: إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى، فمن كانت هجرته إلى الله ورسوله فهجرته إلى الله ورسوله', new: 'قال رسولُ الله صلى الله عليه وسلم: إنّما الأعمالُ بالنيّات، وإنما لكل امرئٍ ما نوى', arabic: true },
    analysisMode: 'replay', links: { decision: '#', gateway: '#', blast: '#', source: '#', behavior: '#', advisory: '#' } as RecordContext['links'],
  };
  return { ctx, events };
}

export const DIFF_FIXTURES = [
  { label: 'Long Arabic, multiline, harakat', old: 'حدثنا عبد الله بن يوسف قال أخبرنا مالك\nعن نافع عن عبد الله بن عمر أن رسول الله صلى الله عليه وسلم قال: إذا جاء أحدكم الجمعة فليغتسل.', neu: 'حدثنا عبدُ الله بن يوسف قال أخبرنا مالكٌ\nعن نافع عن عبد الله بن عمر أن رسول الله صلى الله عليه وسلم قال: إذا جاء أحدكم إلى الجمعة فليغتسل', flags: ['HARAKAT_ONLY'] },
  { label: 'Long English, several operations', old: 'The narration is graded sound (sahih) by the compiler, who notes that its chain is continuous and every narrator is trustworthy.', neu: 'The narration is graded good (hasan) by a later compiler, who notes that its chain is continuous but one narrator is only acceptable.', flags: [] },
  { label: 'Short, punctuation only', old: 'صحيح.', neu: 'صحيح،', flags: ['PUNCTUATION_ONLY'] },
];
