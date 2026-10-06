'use client';
import { useState } from 'react';
import { wordDiff, type Seg } from '@/components/strata/diff';
import { useT } from '@/components/strata/i18n/client';

export type BehaviorQuestion = {
  id: string; origin: string; text: string; result: string | null; resultLabel: string; material: boolean;
  oldAnswer: string | null; newAnswer: string | null;
  verdict: { label: string; delta: string; why: string; uncertainties: string[]; confidence: string | null; mode: string | null } | null;
  failure: string | null;
  /** persisted matched configuration of this question's pair (null when not read) */
  config: { model: string | null; retrieval: string | null; hash: string | null; matched: boolean } | null;
};

/** Matched comparison: question tabs swap the answers, the highlighted words and the advisory verdict. */
export function Behavior({ questions, oldLabel, newLabel, recordKey }: { questions: BehaviorQuestion[]; oldLabel: string; newLabel: string; recordKey: string }) {
  const [q, setQ] = useState(0);
  const t = useT();
  const c = questions[q];
  if (!c) return null;
  const wd = c.oldAnswer != null && c.newAnswer != null ? wordDiff(c.oldAnswer, c.newAnswer) : null;
  const same = !!wd && !wd.removed.length && !wd.added.length;
  // When most words differ, underlining everything is noise: say the answers are reworded instead.
  const shared = wd ? wd.old.filter((x) => x.kind === 'same').length : 0;
  const reworded = !!wd && !same && shared < 0.4 * Math.min(wd.old.length, wd.new.length);
  const col = c.material ? 'var(--co)' : 'var(--tq)';
  return (
    <>
      <div className="tabs" role="group" aria-label={t('Matched questions')} style={questions.length < 3 ? { gridTemplateColumns: `repeat(${questions.length},minmax(0,1fr))` } : undefined}>
        {questions.map((x, i) => (
          <button key={x.id} type="button" className="qtab" aria-pressed={i === q} onClick={() => setQ(i)}>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: 'inherit', opacity: 0.85 }}>{t(x.origin)}</span>
              <span className="chip" style={{ marginInlineStart: 'auto', padding: '1px 9px 1px 7px', fontSize: 12 }}><span className="dot" style={{ background: x.material ? 'var(--co)' : x.result === 'FAILED' || x.result === 'INCONCLUSIVE' || !x.result ? 'var(--am)' : 'var(--tq)' }} />{t(x.resultLabel)}</span>
            </span>
            <span style={{ fontSize: 15, lineHeight: '22px' }} dir="auto">{x.text}</span>
          </button>
        ))}
      </div>

      <div className="plate" style={{ padding: '0 24px' }}>
        <div className="sub fade" key={c.id}>
          <div className="c1-5" style={{ padding: '32px 0 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}><span className="dot" style={{ background: 'var(--tq)' }} /><span className="mono" style={{ color: 'var(--ink)' }}>{oldLabel}</span><span style={{ color: 'var(--ink-3)' }}>{t('Trusted knowledge')}</span><span className="meta mono" style={{ marginInlineStart: 'auto', fontSize: 12 }}>{recordKey}@{oldLabel}</span></span>
            <p dir="auto" style={{ margin: 0, fontSize: 27, lineHeight: '38px', letterSpacing: '-.01em', textWrap: 'balance' }}>
              {wd ? <Words segs={wd.old} mark={reworded ? null : 'removed'} color="var(--tq)" /> : <span style={{ color: 'var(--ink-3)' }}>{t('No answer stored')}{c.failure ? ` · ${c.failure}` : ''}</span>}
            </p>
          </div>
          <div className="c6-10" style={{ position: 'relative', padding: '32px 0 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <span aria-hidden="true" style={{ position: 'absolute', insetInlineStart: -16, top: 0, bottom: 0, width: 1, background: 'var(--line)' }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}><span className="dot" style={{ background: 'var(--co)' }} /><span className="mono" style={{ color: 'var(--ink)' }}>{newLabel}</span><span style={{ color: 'var(--ink-3)' }}>{t('Candidate knowledge')}</span><span className="meta mono" style={{ marginInlineStart: 'auto', fontSize: 12 }}>{recordKey}@{newLabel}</span></span>
            <p dir="auto" style={{ margin: 0, fontSize: 27, lineHeight: '38px', letterSpacing: '-.01em', textWrap: 'balance' }}>
              {wd ? <Words segs={wd.new} mark={reworded ? null : 'added'} color={col} /> : <span style={{ color: 'var(--ink-3)' }}>{t('No answer stored')}</span>}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 16px', padding: '16px 0 18px', borderTop: '1px solid var(--line)', fontSize: 14, lineHeight: '22px' }}>
          <span style={{ color: 'var(--ink-3)' }}>{t('Words that differ')}</span>
          <span style={{ color: 'var(--ink)' }}>{!wd ? '—' : same ? t('None. Both answers match.') : reworded ? t('Reworded throughout · {s} of {n} words shared. The advisory verdict says whether the meaning changed.', { s: shared, n: wd.new.length }) : <bdi dir="ltr">{`${clip(wd.removed)}  →  ${clip(wd.added)}`}</bdi>}</span>
        </div>
      </div>
      <div className="sub" style={{ rowGap: 32, alignItems: 'stretch' }}>
        <div className="c1-5 plate in l fade" key={`c-${c.id}`} style={{ marginInlineStart: -24, paddingInlineStart: 24 }}>
          {c.config ? (() => { const k = c.config; const tt = t; const ok = (x: string) => <span className={k.matched ? 'ok' : ''} style={k.matched ? undefined : { color: 'var(--co-ink)', fontWeight: 600 }}>{k.matched ? tt(x) : tt('Differs')}</span>; return <>
            <div className="kv"><span>{t('Model')}{k.model && <> <span className="mono" style={{ color: 'var(--ink-3)' }}>{k.model}</span></>}{t(', temperature, tokens')}</span>{ok('Identical')}</div>
            <div className="kv"><span>{t('System prompt')}</span>{ok('Identical')}</div>
            <div className="kv"><span>{t('Retrieval')}{k.retrieval && <> <span className="mono" style={{ color: 'var(--ink-3)' }}>{k.retrieval}</span></>}</span>{ok('Identical')}</div>
            <div className="kv"><span>{t('Config hash')}</span><span className="mono" style={{ color: 'var(--ink-2)' }}>{k.hash ? `${k.hash.slice(0, 6)}…${k.hash.slice(-4)}` : '—'}</span></div>
          </>; })() : <div className="kv"><span>{t('Matched configuration')}</span><span>{t('Not readable')}</span></div>}
          <div className="kv"><span style={{ color: 'var(--ink)', fontWeight: 600 }}>{t('Knowledge version')}</span><span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}><span className="cap">{t('only variable')}</span><span className="mono" style={{ color: 'var(--ink)' }}>{oldLabel} ≠ {newLabel}</span></span></div>
        </div>
        <div className="c6-10 fade verdict" key={`v-${c.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 14, border: '1px dashed var(--pu-line)', borderRadius: 16, padding: 24, marginInlineEnd: -24, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="mk mk-ai" aria-hidden="true" /><span style={{ fontSize: 14, fontWeight: 600, color: 'var(--pu-ink)' }}>{t('Verdict · advisory')}</span>
            <span className="meta" style={{ marginInlineStart: 'auto' }}>{c.verdict?.confidence ? `${t('Confidence')} ${t(c.verdict.confidence)}` : t(c.verdict?.mode ?? '')}</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'baseline' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}><span className="dot" style={{ background: c.material ? 'var(--co)' : c.result === 'FAILED' || c.result === 'INCONCLUSIVE' || !c.result ? 'var(--am)' : 'var(--tq)' }} />{t(c.resultLabel)}</span>
            {c.verdict && <span style={{ fontSize: 14, color: 'var(--ink-3)' }}>{t(c.verdict.delta)}</span>}
          </div>
          {c.verdict?.why ? <p className="body" dir="auto">{c.verdict.why}</p> : <p className="body">{c.failure ? `${t('No comparison was stored:')} ${c.failure}.` : t('No comparison is stored for this question yet.')}</p>}
          {c.verdict && c.verdict.uncertainties.length > 0 && <p className="body" style={{ color: 'var(--ink-3)', fontSize: 14, lineHeight: '22px' }}><span style={{ fontWeight: 600, color: 'var(--pu-ink)' }}>{t('Uncertain.')}</span> <bdi dir="auto">{c.verdict.uncertainties.join(' ')}</bdi></p>}
          {c.verdict?.mode && c.verdict.confidence && <span className="meta">{t(c.verdict.mode)}</span>}
        </div>
      </div>
    </>
  );
}

const clip = (w: string[]) => (w.length ? (w.length > 10 ? `${w.slice(0, 10).join(' ')} …` : w.join(' ')) : '∅');

/** The answer with only its differing words underlined (word-level LCS, text untouched). */
function Words({ segs, mark, color }: { segs: Seg[]; mark: 'removed' | 'added' | null; color: string }) {
  return <>{segs.map((x, i) => <span key={i}>{i > 0 && ' '}{x.kind === mark ? <span style={{ textDecoration: `underline 2px ${color}`, textUnderlineOffset: 7 }}>{x.text}</span> : x.text}</span>)}</>;
}
