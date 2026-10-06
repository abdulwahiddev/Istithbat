'use client';
import Link from 'next/link';
import { useT } from '@/components/strata/i18n/client';
import { useMemo, useState } from 'react';
import { AuditPage, Endpoints, type AuditEvent } from '@/lib/contracts';
import { AUTHORITY, FOLDED, LANE_MARK, narrate, type Lane, type Narrated } from '@/components/strata/events';
import { clock, fullTime } from '@/components/strata/format';
import { Icon, type IconName } from '@/components/strata/icons';

export type RecordContext = {
  incidentId: string; recordKey: string; candidateId: string; candidateLabel: string; previousId: string | null; previousLabel: string | null;
  servedLabel: string | null; appName: string | null; open: boolean; approveAllowed: boolean;
  versionLabel: Record<string, string>;
  /** before/after of the primary change, for the detection entry */
  change: { field: string | null; old: string | null; new: string | null; arabic: boolean } | null;
  analysisMode: string | null;
  links: Record<NonNullable<Narrated['link']>['target'], string>;
};

const X = [16, 46, 76, 106, 136], NY = 25;
const st = (s: string) => Object.fromEntries(s.split(';').filter(Boolean).map((d) => { const i = d.indexOf(':'); return [d.slice(0, i).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), d.slice(i + 1)]; }));
const T = 'translate(-50%,-50%)';
/** Lane glyphs: the same Lucide family as the layer marks, drawn inside every event node. */
const LANE_ICON: IconName[] = ['database', 'fingerprint-pattern', 'sparkles', 'scale', 'user-check'];
/**
 * Event node: an icon tile in the authority's colour. A semantic tone (e.g. quarantine) fills the
 * tile; AI keeps the dashed advisory ring; unrecorded entries are hollow and dashed.
 */
function nodeStyle(lane: Lane, tone: string | null, pend: boolean): string {
  const base = `width:24px;height:24px;border-radius:50%;box-sizing:border-box;display:grid;place-items:center;transform:${T};box-shadow:0 0 0 3px var(--plate-a)`;
  if (pend) return `${base};border:1.5px dashed var(--ink-3);background:var(--plate-a);color:var(--ink-3)`;
  if (lane === 2) return `${base};border:1.5px dashed var(--pu);background:var(--pu-soft);color:var(--pu-ink)`;
  if (tone) return `${base};background:${tone};border:1.5px solid ${tone};color:var(--on-solid)`;
  const c = ['var(--ink-2)', 'var(--ink-2)', 'var(--pu)', 'var(--ink)', 'var(--ink)'][lane];
  return `${base};border:1.5px solid ${c};background:var(--plate-a);color:${c}`;
}
const TONE: Record<string, string> = { tq: 'var(--tq)', co: 'var(--co)', am: 'var(--am)' };

type Entry = {
  key: string; lane: Lane; tone: string | null; pend: boolean; group?: string; time: string; title: string; line: string; type: string;
  event: AuditEvent | null; n: Narrated; ba?: [string, string, string, string, string]; note?: { head: string; text: string; ai?: boolean }; payload: string; payloadLabel: string;
};

/** Authority-lane ledger + sticky inspector (Record board). Entries are persisted audit events, paged from GET /api/audit. */
export function RecordLedger({ ctx, initial }: { ctx: RecordContext; initial: { events: AuditEvent[]; nextCursor: string | null } }) {
  const t = useT();
  const [events, setEvents] = useState(initial.events);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState<'idle' | 'loading' | 'error'>('idle');
  const vl = (id: string | null | undefined) => (id ? ctx.versionLabel[id] ?? null : null);

  const entries = useMemo<Entry[]>(() => {
    const asc = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).filter((e) => !FOLDED.test(e.eventType));
    const out: Entry[] = [];
    let curGroup = '';
    for (const e of asc) {
      const n = narrate(e, { versionLabel: vl, servedLabel: ctx.servedLabel, appName: ctx.appName });
      const before = e.entityType === 'source_version' && e.entityId === ctx.previousId;
      const group = before ? 'Before this incident' : `${ctx.recordKey} · ${ctx.candidateLabel}`;
      const entry: Entry = {
        key: e.id, lane: n.lane, tone: n.tone ? TONE[n.tone] : null, pend: false, time: clock(e.createdAt), title: n.title, line: n.line, type: e.eventType,
        event: e, n, payload: JSON.stringify(e.metadata, null, 2), payloadLabel: 'Stored metadata',
      };
      if (group !== curGroup) { entry.group = group; curGroup = group; }
      if (e.eventType === 'SOURCE_VERSION_DETECTED' && e.entityId === ctx.candidateId && ctx.change && ctx.change.old !== null && ctx.change.new !== null)
        entry.ba = [`${ctx.previousLabel ?? 'previous'} · ${ctx.change.field ?? 'value'}`, `${ctx.candidateLabel} · ${ctx.change.field ?? 'value'}`, ctx.change.old, ctx.change.new, ctx.change.arabic ? 'ar arv' : ''];
      if (e.eventType === 'INCIDENT_CREATED') entry.ba = ['Incident', 'Incident', 'None', 'Needs review', ''];
      if (e.eventType === 'VERSION_QUARANTINED') entry.ba = [`${ctx.candidateLabel} · before`, `${ctx.candidateLabel} · after`, 'Analyzing', 'Quarantined', ''];
      if (e.eventType === 'VERSION_PROMOTED') entry.ba = ['Served · before', 'Served · after', vl(String((e.metadata as Record<string, unknown>).previousVersionId ?? '')) ?? '—', vl(e.entityId) ?? '—', 'mono baml'];
      if (e.eventType === 'PIPELINE_STARTED') entry.note = { head: 'Note.', text: 'Folds the PIPELINE_STEP_STARTED and PIPELINE_STEP_COMPLETED entries for each step of this run.' };
      if (e.eventType === 'ANALYSIS_SUCCEEDED' && (e.metadata as Record<string, unknown>).mode === 'replay') entry.note = { head: 'Replayed response.', text: 'Recorded earlier and played back. It is labelled wherever it appears.', ai: true };
      if (e.eventType === 'ANALYSIS_SUCCEEDED' && (e.metadata as Record<string, unknown>).mode === 'mock') entry.note = { head: 'Mock response.', text: 'A deterministic placeholder; no model was called.', ai: true };
      if (e.eventType === 'REGRESSION_COMPARISON_COMPLETED') entry.note = { head: 'Note.', text: 'The materiality verdict is advisory evidence. It can raise the policy outcome, never lower it. Folds the per-side regression entries.' };
      out.push(entry);
    }
    if (ctx.open) {
      const decision: Entry = {
        key: 'pending-decision', lane: 4, tone: null, pend: true, group: 'Next · not yet recorded', time: '—', title: 'Awaiting a reviewer’s signature', line: 'Approve, reject, keep quarantined or escalate', type: 'REVIEW_DECISION', event: null,
        n: { lane: 4, tone: null, title: 'Awaiting a reviewer’s signature', line: '', proves: 'Nothing is recorded here yet. Signing appends one REVIEW_DECISION under the reviewer’s name, with the decision and the candidate it applies to.', evidence: [{ k: 'Credential', v: 'Separate review credential' }], link: { label: 'Decide in Incident Review', target: 'decision' } },
        note: { head: 'Note.', text: `Reject, keep quarantined and escalate append only this entry, and ${ctx.candidateLabel} stays unserved.` },
        payload: JSON.stringify({ decisionId: '‹on signing›', decision: 'APPROVE | REJECT | KEEP_QUARANTINED | ESCALATE', candidateVersionId: ctx.candidateId }, null, 2), payloadLabel: 'What signing would store',
      };
      out.push(decision);
      if (ctx.approveAllowed) out.push({
        key: 'pending-promoted', lane: 4, tone: null, pend: true, time: '—', title: `Only if approved: ${ctx.candidateLabel} promoted`, line: `Gateway switches from ${ctx.servedLabel ?? 'the trusted version'} to ${ctx.candidateLabel}`, type: 'VERSION_PROMOTED', event: null,
        n: { lane: 4, tone: null, title: '', line: '', proves: 'Not recorded, and only possible after an approval. Promotion runs in one transaction: previous trusted superseded, candidate trusted, gateway switched, incident resolved. Any failure rolls all of it back.', evidence: [{ k: 'Repeat approval', v: 'Rejected' }], link: { label: 'Trust Gateway', target: 'gateway' } },
        ba: ['Served · now', 'Served · on approval', ctx.servedLabel ?? '—', ctx.candidateLabel, 'mono baml'],
        payload: JSON.stringify({ previousVersionId: ctx.previousId, candidateVersionId: ctx.candidateId, evaluationId: '‹stored›', incidentId: ctx.incidentId }, null, 2), payloadLabel: 'What signing would store',
      });
    }
    return out;
  }, [events, ctx]);

  const def = entries.find((e) => e.type === 'VERSION_QUARANTINED') ?? entries.filter((e) => !e.pend).at(-1) ?? entries[0];
  const [selKey, setSelKey] = useState<string | null>(null);
  const s = entries.find((e) => e.key === selKey) ?? def;

  async function loadEarlier() {
    if (!cursor) return;
    setLoading('loading');
    try {
      const res = await fetch(`${Endpoints.audit}?incidentId=${encodeURIComponent(ctx.incidentId)}&before=${encodeURIComponent(cursor)}&limit=100`);
      if (!res.ok) throw new Error(String(res.status));
      const page = AuditPage.parse(await res.json());
      setEvents((prev) => [...prev, ...page.events.filter((e) => !prev.some((p) => p.id === e.id))]);
      setCursor(page.nextCursor);
      setLoading('idle');
    } catch { setLoading('error'); }
  }

  const sv = (x: number, y0: string, y1: string | null, dash: boolean) => `left:${x}px;top:${y0};${y1 ? `height:${y1}` : 'bottom:0'};border-left-style:${dash ? 'dashed' : 'solid'}`;

  return (
    <div className="sub" style={{ rowGap: 32, alignItems: 'start' }}>
      <div className="c1-6 plate tight l" style={{ marginRight: 0 }}>
        <div className="lgh" aria-hidden="true">
          <span className="lanes">
            <span className="lh" style={{ left: 16 }}><span className="mk mk-src" style={{ width: 14 }} /></span>
            <span className="lh" style={{ left: 46 }}><span className="mk mk-det" style={{ background: 'var(--ink-2)' }} /></span>
            <span className="lh" style={{ left: 76 }}><span className="mk mk-ai" /></span>
            <span className="lh" style={{ left: 106 }}><span className="mk mk-pol" /></span>
            <span className="lh" style={{ left: 136 }}><span className="mk mk-hum" /></span>
          </span>
          <span>{t('Time')}</span><span>{t('Entry')}</span>
        </div>
        {cursor && (
          <div style={{ padding: '8px 0 12px' }}>
            <button type="button" className="lnk" onClick={loadEarlier} disabled={loading === 'loading'} style={{ font: 'inherit', fontSize: 14, fontWeight: 600, background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--ink)' }}>
              {t(loading === 'loading' ? 'Loading earlier entries…' : 'Load earlier entries')}
            </button>
            {loading === 'error' && <span className="meta" role="alert" style={{ marginInlineStart: 12 }}>{t('Earlier entries could not be read.')}</span>}
          </div>
        )}
        <div role="list" aria-label={t('Record entries')}>
          {entries.map((e, i) => {
            const prev = i > 0 ? entries[i - 1] : null;
            const pl = prev ? prev.lane : e.lane, last = i === entries.length - 1;
            const top = prev ? sv(X[pl], '0', `${NY}px`, e.pend) : 'display:none';
            const a = Math.min(X[pl], X[e.lane]), w = Math.abs(X[pl] - X[e.lane]);
            const hz = prev && w ? `left:${a}px;width:${w}px;top:${NY}px;border-top-style:${e.pend ? 'dashed' : 'solid'}` : 'display:none';
            const nextPend = !last && entries[i + 1].pend;
            const bot = last ? 'display:none' : sv(X[e.lane], `${NY}px`, null, nextPend);
            const on = e.key === s?.key;
            return (
              <div role="listitem" key={e.key}>
                {e.group && <div className="rgrp"><span className="trk"><span className="pv" style={st(prev ? sv(X[pl], '0', null, e.pend) : 'display:none')} /></span><span>{t(e.group)}</span></div>}
                <button type="button" className={`rrow${e.pend ? ' pend' : ''}${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setSelKey(e.key)}
                  aria-label={`${t(AUTHORITY[e.lane])}: ${t(e.title)}${e.pend ? t(', not yet recorded') : ''}`}>
                  <span className="trk" aria-hidden="true">
                    <span className="pv" style={st(top)} />
                    <span className="ph" style={st(hz)} />
                    <span className="pv" style={st(bot)} />
                    <span className="nd" style={st(`left:${X[e.lane]}px;${nodeStyle(e.lane, e.tone, e.pend)}`)}><Icon name={LANE_ICON[e.lane]} size={13} stroke={2} /></span>
                  </span>
                  <span className="tm2 mono" title={e.event ? fullTime(e.event.createdAt) : undefined}>{e.time}</span>
                  <span className="rtx">
                    <b>{t(e.title)}</b>
                    <span className="sub2">{t(e.line)}</span>
                    <span className="et mono">{e.type}{e.pend ? ` · ${t('not yet recorded')}` : ''}</span>
                  </span>
                </button>
              </div>
            );
          })}
          {entries.length === 0 && <p className="body" style={{ padding: '16px 0' }}>{t('Nothing is recorded for this incident yet.')}</p>}
        </div>
      </div>

      {s && (
        <div className="c7-10 insp">
          <div className="plate r fade" key={s.key} style={{ marginLeft: 0, paddingTop: 24, paddingBottom: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className="chip" style={{ color: 'var(--ink)' }}><span className={`mk mk-${LANE_MARK[s.lane]}`} />{t(AUTHORITY[s.lane])}</span>
              <span className="meta" style={{ fontSize: 12.5 }}>{t(s.pend ? 'Not yet recorded' : 'Recorded · append-only')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h4 style={{ margin: 0, fontSize: 22, lineHeight: '30px', fontWeight: 600, letterSpacing: '-.012em' }}>{t(s.title)}</h4>
              <span className="mono" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{s.type}</span>
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: '24px', color: 'var(--ink-2)' }}>{t(s.n.proves)}</p>
            <div>
              <div className="kv"><span>{t('Time')}</span><span className="mono">{s.event ? fullTime(s.event.createdAt) : '—'}</span></div>
              <div className="kv"><span>{t('Actor')}</span><span className="mono">{s.event?.actor ?? 'reviewer:‹you›'}</span></div>
              <div className="kv"><span>{t('Entity')}</span><span className="mono">{s.event ? `${s.event.entityType} · ${vl(s.event.entityId) ?? (s.event.entityType === 'incident' ? `${ctx.recordKey} ${ctx.candidateLabel}` : s.event.entityId.slice(0, 8))}` : `incident · ${ctx.recordKey} ${ctx.candidateLabel}`}</span></div>
              {s.n.evidence.map((k) => <div key={k.k} className="kv"><span>{t(k.k)}</span><span className={k.mono ? 'mono' : ''}>{k.mono && k.v.length > 24 ? `${k.v.slice(0, 8)}…${k.v.slice(-4)}` : k.v}</span></div>)}
            </div>
            {s.ba && (
              <div className="ba">
                <div><span className="cap">{t(s.ba[0])}</span><span className={`bav ${s.ba[4]}`} {...(s.ba[4].includes('ar') ? { lang: 'ar', dir: 'rtl' } : {})}>{s.ba[2]}</span></div>
                <span className="ba-ar flip-rtl" aria-label={t('becomes')}>→</span>
                <div><span className="cap">{t(s.ba[1])}</span><span className={`bav ${s.ba[4]}`} {...(s.ba[4].includes('ar') ? { lang: 'ar', dir: 'rtl' } : {})}>{s.ba[3]}</span></div>
              </div>
            )}
            {s.note && <p className={s.note.ai ? 'note ai' : 'note'}><b>{t(s.note.head)}</b> {t(s.note.text)}</p>}
            {s.n.link && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}><Link className="lnk" href={ctx.links[s.n.link.target]}>{t(s.n.link.label)} <span aria-hidden="true" className="flip-rtl">→</span></Link></div>}
          </div>
          <details style={{ marginTop: 16 }}>
            <summary>{t(s.payloadLabel)}</summary>
            <div className="raw" dir="ltr" style={{ whiteSpace: 'pre-wrap' }}>{s.payload}</div>
          </details>
        </div>
      )}
    </div>
  );
}
