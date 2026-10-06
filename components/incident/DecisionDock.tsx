'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Endpoints } from '@/lib/contracts';

type Decision = 'APPROVE' | 'REJECT' | 'KEEP_QUARANTINED' | 'ESCALATE';
export type DockProps = {
  incidentId: string;
  candidate: string; previous: string; served: string; appName: string; candidateState: string;
  /** decisions the governance transition table allows right now */
  allowed: Decision[];
  aiPill: string | null;
  reviewer: { name: string } | null;
  /** last recorded decision, if any */
  recorded: { decision: Decision; reviewer: string; at: string } | null;
  resolved: boolean;
};

const Glyph = ({ id }: { id: Decision }) => (
  id === 'APPROVE' ? <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10.5l4 4 8-9" /></svg>
  : id === 'REJECT' ? <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
  : id === 'KEEP_QUARANTINED' ? <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="9" width="11" height="8" rx="2" /><path d="M7 9V6.5a3 3 0 016 0V9" /></svg>
  : <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 16V4M5 9l5-5 5 5" /></svg>
);
const Arrow = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 11l6-6M6 5h5v5" /></svg>;
const Check = ({ style }: { style?: React.CSSProperties }) => <svg style={style} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg>;

/** The human act (Incident Review §07). AI advises, policy governs, the reviewer signs here. */
export function DecisionDock(p: DockProps) {
  const router = useRouter();
  const [d, setD] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');
  const [stage, setStage] = useState<'choose' | 'confirm' | 'sending' | 'done'>('choose');
  const [result, setResult] = useState<{ ok: boolean; title: string; body: string } | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (stage === 'confirm') confirmRef.current?.querySelector('button')?.focus(); }, [stage]);

  const c = p.candidate, prev = p.previous, app = p.appName;
  const O: Record<Decision, { label: string; summary: string; tag?: string; btn: string; confirmTitle: string; confirmBody: string; done: string; effects: [string, string, string][] }> = {
    APPROVE: { label: 'Approve', summary: `Promote ${c} to trusted. The gateway switches to it in one transaction.`, tag: 'Changes production', btn: 'Review approval',
      confirmTitle: `Promote ${c} to production?`, confirmBody: `${app} will read ${c} as soon as you sign. ${prev} becomes superseded.`, done: `${c} approved and now served`,
      effects: [[`Candidate ${c}`, p.candidateState, 'Trusted'], [`Previous ${prev}`, 'Trusted', 'Superseded'], [`${app} reads`, p.served, c], ['Incident', 'Open', 'Resolved']] },
    REJECT: { label: 'Reject', summary: `Refuse the candidate. ${prev} stays trusted and keeps serving.`, btn: 'Review rejection',
      confirmTitle: `Reject ${c}?`, confirmBody: `${c} is marked rejected. Production keeps serving ${p.served}.`, done: `${c} rejected · ${p.served} still served`,
      effects: [[`Candidate ${c}`, p.candidateState, 'Rejected'], [`${app} reads`, p.served, p.served], ['Incident', 'Open', 'Resolved']] },
    KEEP_QUARANTINED: { label: 'Keep quarantined', summary: `Leave ${c} contained while more evidence is gathered.`, btn: 'Review decision',
      confirmTitle: `Keep ${c} quarantined?`, confirmBody: `The incident stays open and ${p.served} keeps serving.`, done: `${c} kept in quarantine`,
      effects: [[`Candidate ${c}`, p.candidateState, 'Quarantined'], [`${app} reads`, p.served, p.served], ['Incident', 'Open', 'Open']] },
    ESCALATE: { label: 'Escalate', summary: 'Ask a qualified specialist before anyone decides.', btn: 'Review escalation',
      confirmTitle: 'Escalate to a specialist?', confirmBody: `${c} stays untrusted and the incident is flagged as escalated.`, done: 'Escalated to a specialist',
      effects: [[`Candidate ${c}`, p.candidateState, p.candidateState], [`${app} reads`, p.served, p.served], ['Incident', 'Open', 'Escalated']] },
  };
  const ids: Decision[] = ['APPROVE', 'REJECT', 'KEEP_QUARANTINED', 'ESCALATE'];
  const pick = d ? O[d] : null;
  const needsReason = d === 'KEEP_QUARANTINED';
  const reasonMissing = needsReason && !reason.trim();
  const blocked = !pick || reasonMissing || p.resolved;

  async function submit() {
    if (!d || !p.reviewer) return;
    setStage('sending');
    try {
      const res = await fetch(Endpoints.incidentReview(p.incidentId), {
        method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ decision: d, reviewer: p.reviewer.name, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
      });
      if (res.ok) { setResult({ ok: true, title: O[d].done, body: `Signed by ${p.reviewer.name} and appended to the record.` }); setStage('done'); router.refresh(); return; }
      const code = res.status;
      setResult({ ok: false, title: code === 409 ? 'Already decided' : code === 401 ? 'Reviewer mode required' : 'Nothing was changed',
        body: code === 409 ? 'This transition is no longer allowed; the incident has already been decided. The page shows the recorded outcome.'
          : code === 401 ? 'The review credential has expired. Unlock reviewer mode and sign again.'
          : 'The decision failed safely and was rolled back. Production keeps serving the trusted version.' });
      setStage('done');
      if (code === 409) router.refresh();
    } catch {
      setResult({ ok: false, title: 'Nothing was changed', body: 'The request did not reach the server. Production keeps serving the trusted version.' });
      setStage('done');
    }
  }

  return (
    <div className="desk">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 32px', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 40, lineHeight: '48px', fontWeight: 600, letterSpacing: '-.024em' }}>What should happen to <span className="mono" style={{ fontSize: 36 }}>{c}</span>?</h3>
          {p.aiPill && <span className="pill" style={{ fontSize: 14, color: 'var(--h-ai)', border: '1px dashed var(--h-ai-line)' }}><span className="mk mk-ai" style={{ background: 'var(--h-ai)' }} />{p.aiPill}</span>}
        </div>

        <fieldset className="sub" style={{ border: 0, margin: 0, padding: 0, rowGap: 16, minInlineSize: 0 }} disabled={p.resolved || stage === 'sending' || stage === 'done'}>
          <legend className="sr-only">Decision on {c}</legend>
          {ids.map((id, i) => {
            const o = O[id];
            const legal = p.allowed.includes(id);
            return (
              <label key={id} className="opt" style={{ gridColumn: i % 2 === 0 ? '1 / span 5' : '6 / span 5', ...(legal ? {} : { opacity: 0.5, cursor: 'not-allowed' }) }}>
                <input type="radio" name="decision" value={id} checked={d === id} disabled={!legal} onChange={() => { setD(id); setStage('choose'); }} />
                <span className="glyph" aria-hidden="true"><Glyph id={id} /></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <b style={{ fontSize: 18, lineHeight: '24px', letterSpacing: '-.006em' }}>{o.label}</b>
                  {o.tag && <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 7, background: 'var(--h-sel)', color: 'var(--h-sel-ink)' }}>{o.tag}</span>}
                </span>
                <span className="check" style={{ gridRow: 1, gridColumn: 3 }}><Check /></span>
                <span style={{ gridColumn: '2 / span 2', fontSize: 15, lineHeight: '22px', color: 'var(--h-ink-2)' }}>{legal ? o.summary : `${o.summary} Not allowed in the current state.`}</span>
              </label>
            );
          })}
        </fieldset>

        <div className="sub" style={{ rowGap: 32, alignItems: 'start' }}>
          <div className="c1-5" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 15, fontWeight: 600, paddingBottom: 12, borderBottom: '1px solid var(--h-line-2)' }}>What will happen</div>
            {!pick ? <p style={{ margin: 0, padding: '16px 0', fontSize: 15, lineHeight: '24px', color: 'var(--h-ink-2)' }}>Choose a decision to preview its exact effect.</p> : (
              <div className="fade" key={d}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) 20px minmax(0,1fr)', gap: '0 12px', padding: '12px 0 4px', fontSize: 13, color: 'var(--h-ink-3)' }}><span /><span>Now</span><span /><span>After</span></div>
                {pick.effects.map(([what, now, after]) => (
                  <div key={what} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) 20px minmax(0,1fr)', gap: '0 12px', padding: '13px 0', borderTop: '1px solid var(--h-line)', fontSize: 15, lineHeight: '22px', alignItems: 'baseline' }}>
                    <span style={{ color: 'var(--h-ink-2)' }}>{what}</span><span style={{ color: 'var(--h-ink-3)' }}>{now}</span><span aria-hidden="true" style={{ color: 'var(--h-ink-3)' }}>→</span>
                    <span style={now !== after ? { fontWeight: 600, color: 'var(--h-ink)' } : { color: 'var(--h-ink-3)' }}>{after}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="c6-10" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label htmlFor="reason" style={{ fontSize: 15, fontWeight: 600, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>Reason</span><span style={{ fontWeight: 400, fontSize: 14, color: 'var(--h-ink-3)' }}>{needsReason ? 'Required to keep quarantined' : 'Recorded with your decision'}</span>
              </label>
              <textarea id="reason" className="field" rows={4} value={reason} maxLength={2000} disabled={p.resolved || stage === 'sending' || stage === 'done'}
                onChange={(e) => setReason(e.target.value)} placeholder="In your words, why this decision" aria-required={needsReason} />
            </div>
            {stage === 'choose' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button type="button" className="btn btn-go" disabled={blocked} onClick={() => { if (!blocked) setStage('confirm'); }}>{p.resolved ? 'Already decided' : pick ? pick.btn : 'Choose a decision'}<Arrow /></button>
                <span style={{ fontSize: 14, lineHeight: '21px', color: 'var(--h-ink-3)' }} aria-live="polite">
                  {p.resolved && p.recorded ? `Decided by ${p.recorded.reviewer} · ${p.recorded.at}. The record is append-only.`
                    : !pick ? 'Your identity and reason are written to the append-only record.'
                    : reasonMissing ? `Add a reason to keep ${c} quarantined.` : 'You will confirm before anything is signed.'}
                </span>
              </div>
            )}
            {(stage === 'confirm' || stage === 'sending') && pick && (
              <div ref={confirmRef} role="alertdialog" aria-label="Confirm decision" className="confirm enter" style={{ display: 'flex', flexDirection: 'column', gap: 16, borderRadius: 16, background: 'var(--h-card)', border: '1px solid var(--h-sel)', padding: 20, boxShadow: 'var(--h-card-shadow-2)' }}>
                <p style={{ margin: 0, fontSize: 16, lineHeight: '24px' }}><b>{pick.confirmTitle}</b><br /><span style={{ color: 'var(--h-ink-2)' }}>{pick.confirmBody}</span></p>
                {!p.reviewer && <p style={{ margin: 0, fontSize: 14, lineHeight: '21px', color: 'var(--h-ink-2)' }}>Reviewer mode is locked. Unlock it from the reviewer pill in the header to sign.</p>}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-go" style={{ flex: 1 }} disabled={!p.reviewer || stage === 'sending'} onClick={submit}>
                    {stage === 'sending' ? 'Signing…' : p.reviewer ? `Sign as ${p.reviewer.name}` : 'Reviewer mode required'}<Arrow />
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={stage === 'sending'} onClick={() => setStage('choose')}>Back</button>
                </div>
              </div>
            )}
            {stage === 'done' && result && (
              <div role="status" className="confirm enter" style={{ display: 'flex', flexDirection: 'column', gap: 6, borderRadius: 16, background: 'var(--h-card)', border: '1px solid var(--h-line)', padding: 20 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {result.ok ? <span className="check" style={{ background: 'var(--h-sel)', borderColor: 'var(--h-sel)' }}><Check style={{ opacity: 1, transform: 'none' }} /></span> : <span className="check" aria-hidden="true">!</span>}
                  <b style={{ fontSize: 16 }}>{result.title}</b>
                </span>
                <span style={{ fontSize: 14, color: 'var(--h-ink-2)', paddingLeft: 32 }}>{result.body}</span>
                {!result.ok && <button type="button" onClick={() => setStage('choose')} style={{ alignSelf: 'flex-start', marginLeft: 24, font: 'inherit', fontSize: 14, background: 'transparent', border: 0, color: 'var(--h-ink)', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', minHeight: 44, padding: '0 8px' }}>Back to the decision</button>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
