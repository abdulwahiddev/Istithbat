import { RESULT_TEXT } from '@/components/strata/semantics';
import { blurIn, prog } from '../../components/anim';
import { RUN } from '../../data/production';
import { sentenceAt } from '../../timing';
import { cue } from '../stages';
import { useAbs } from '../time';

const S = 's06-regression' as const;
const MATERIAL = RESULT_TEXT.MATERIAL_CHANGE; // product label: "Material change"

/**
 * Test: the matched-regression surface (product .kv matched-configuration rows, .tabs/.qtab
 * comparisons, the Behavior header's knowledge labels). Shows only verified run facts: three
 * matched comparisons, all MATERIAL. Answer texts are not shown (they belong to the incident).
 */
export function TestPanel() {
  const { frame } = useAbs();
  const f = (abs: number, d = 0.6) => prog(frame, abs, d);
  const s0 = sentenceAt(S, 0), s1 = sentenceAt(S, 1);
  const tAll = cue(S, 'All three');
  const rows: [string, number][] = [['Model, temperature, tokens', s0.start + 0.6], ['System prompt', s0.start + 1.3], ['Retrieval', s0.start + 2.0]];
  const kn = f(s1.start + 0.1);
  return (
    <div style={{ width: 1240 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, ...blurIn(f(s0.start - 0.8)) }}>
        <h3 className="h3">Matched regression · {RUN.regression.comparisons} comparisons</h3>
        <span className="meta">Same model · same prompt · same settings · only knowledge changes</span>
      </div>
      <div className="sub" style={{ marginTop: 22, rowGap: 24, alignItems: 'start' }}>
        <div className="c1-5 plate in" style={{ ...blurIn(f(s0.start - 0.4)) }}>
          {rows.map(([k, at]) => (
            <div key={k} className="kv" style={blurIn(f(at), 6, 6)}><span>{k}</span><span className="ok">Identical</span></div>
          ))}
          <div className="kv" style={{ borderBottom: 0, ...blurIn(kn, 6, 6), background: `rgba(34,211,197,${0.06 * kn})`, margin: '0 -12px', padding: '14px 12px', borderRadius: 10 }}>
            <span style={{ color: 'var(--ink)', fontWeight: 600 }}>Knowledge version</span>
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}><span className="cap">only variable</span><span className="mono" style={{ color: 'var(--ink)' }}>{RUN.versions.trusted} ≠ {RUN.versions.latest}</span></span>
          </div>
        </div>
        <div className="c6-10" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="plate in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24, padding: '16px 20px', ...blurIn(kn) }}>
            {([[RUN.versions.trusted, 'Trusted knowledge', 'var(--tq)', RUN.oldValue], [RUN.versions.latest, 'Candidate knowledge', 'var(--co)', RUN.newValue]] as const).map(([v, l, c, val]) => (
              <div key={v} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><span className="dot" style={{ background: c }} /><span className="mono" style={{ color: 'var(--ink)' }}>{v}</span><span style={{ color: 'var(--ink-3)' }}>{l}</span></span>
                <span className="meta mono" style={{ fontSize: 12 }}>{RUN.field}@{v}</span>
                <span className="ar" dir="rtl" lang="ar" style={{ fontSize: 24, lineHeight: '34px', textAlign: 'right', color: 'var(--ink)' }}>{val}</span>
              </div>
            ))}
          </div>
          <div className="tabs" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', ...blurIn(f(s0.start)) }}>
            {[0, 1, 2].map((i) => {
              const p = f(tAll + 0.25 + i * 0.35, 0.5);
              return (
                <div key={i} className="qtab" aria-pressed={p > 0.5} style={{ cursor: 'default' }}>
                  <span style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
                    <span style={{ opacity: 0.85 }}>Comparison {i + 1}</span>
                  </span>
                  <span className="chip" style={{ alignSelf: 'flex-start', padding: '1px 9px 1px 7px', fontSize: 12, ...blurIn(p, 4, 4) }}><span className="dot" style={{ background: 'var(--co)' }} />{MATERIAL}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28, paddingTop: 6, ...blurIn(f(tAll + 1.4)) }} className="scr-blast">
            <div className="radius" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', width: 180 }}>{[0, 1, 2].map((i) => <span key={i} style={{ background: 'var(--co)' }} />)}</div>
            <span className="cnt"><b style={{ color: 'var(--co-ink)' }}>{RUN.regression.material}</b><span className="cap">Material</span></span>
            <span className="cnt"><b style={{ color: 'var(--ink-3)' }}>{RUN.regression.nonMaterial}</b><span className="cap">Non-material</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
