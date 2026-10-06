import { ExactDiff } from '@/components/strata/ExactDiff';
import { Chip, Kv } from '@/components/strata/primitives';
import { Icon } from '@/components/strata/icons';
import { blurIn, mask, prog } from '../../components/anim';
import { RUN } from '../../data/production';
import { cue } from '../stages';
import { useAbs } from '../time';

const S = 's05-exact-change' as const;

/** Detect: the product's ExactDiff renderer on the stored ar.grade values, with the run's fingerprints. */
export function DetectPanel() {
  const { frame } = useAbs();
  const f = (abs: number, d = 0.7) => prog(frame, abs, d);
  const t0 = cue(S, 'The hadith text');
  const tField = cue(S, 'Only the grading field');
  const tGone = cue(S, 'an explicit exception');
  const head = f(t0 - 0.6), unchanged = f(t0 + 0.2), oldRow = f(t0 + 0.6, 0.9), newRow = f(tField + 0.5, 1.0), hl = f(tGone, 0.8);
  return (
    <div style={{ width: 1240, ['--hl' as string]: hl }} className="detect">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, ...blurIn(head) }}>
        <h3 className="h3">Controlled candidate · <span className="mono">{RUN.recordKey}</span></h3>
        <span className="meta">Only <span className="mono">{RUN.field}</span> changed · hadith text unchanged</span>
      </div>
      <p style={{ margin: '14px 0 22px', fontSize: 34, lineHeight: '42px', fontWeight: 600, letterSpacing: '-.02em', ...blurIn(head, 10) }}>{RUN.headline}</p>
      <div className="plate tight" style={{ margin: 0, position: 'relative' }}>
        <div style={{ ['--old' as string]: oldRow, ['--new' as string]: newRow }} className="dx-host">
          <ExactDiff oldValue={RUN.oldValue} newValue={RUN.newValue} oldLabel={RUN.versions.trusted} newLabel={RUN.versions.latest}
            oldChip={<Chip tone="tq" small>Trusted</Chip>} newChip={<Chip tone="co" small>Candidate</Chip>} />
        </div>
        {/* masked reveals of the two rows, right-to-left like the Arabic they carry */}
        <style>{`
          .detect .dx-host .sub:nth-of-type(1){${css(mask(oldRow, true))};opacity:${0.2 + 0.8 * oldRow}}
          .detect .dx-host .sub:nth-of-type(2){${css(mask(newRow, true))};opacity:${0.2 + 0.8 * newRow}}
          .detect .dx-del>span{background:rgba(255,107,94,${0.16 * hl});border-radius:6px;box-shadow:0 0 0 ${6 * hl}px rgba(255,107,94,${0.08 * hl})}
        `}</style>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', columnGap: 32, marginTop: 18 }}>
        <div style={blurIn(unchanged, 8, 6)}><Kv k="Hadith text"><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', color: 'var(--tq)' }}><Icon name="check" size={16} />Unchanged</span></Kv></div>
        <div style={blurIn(f(tField + 0.9), 8, 6)}><Kv k="Field role"><span className="mono" style={{ color: 'var(--ink)' }}>{RUN.fieldRole}</span></Kv></div>
        <div style={blurIn(f(tGone + 0.6), 8, 6)}><Kv k="Fingerprint"><span className="mono" style={{ color: 'var(--ink-2)' }}>{RUN.fingerprint.old} → {RUN.fingerprint.new}</span></Kv></div>
      </div>
    </div>
  );
}

const css = (o: Record<string, string | number | undefined>) => Object.entries(o).filter(([, v]) => v != null).map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v}`).join(';');
