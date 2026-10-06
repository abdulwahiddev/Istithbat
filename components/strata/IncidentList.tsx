'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { StateMark, type StateKey } from './entity';
import { Icon } from './icons';
import { useT } from './i18n/client';

export type IncidentGroup = 'decide' | 'investigating' | 'resolved';
export type IncidentRow = {
  id: string; href: string; recordKey: string; candidate: string; sourceId: string; sourceName: string;
  headline: string; group: IncidentGroup; stateText: string; mark: StateKey;
  policyCode: string | null; openedAt: string; openedText: string; risk: string | null;
};

const GROUPS: { key: IncidentGroup; label: string; empty: string }[] = [
  { key: 'decide', label: 'Needs a decision', empty: 'Nothing is waiting for a reviewer.' },
  { key: 'investigating', label: 'Investigating', empty: 'No pipeline is running.' },
  { key: 'resolved', label: 'Resolved', empty: 'No decided incidents yet.' },
];
const RESOLVED_PREVIEW = 5;

/**
 * Incident list: grouped by what a reviewer must do (decide → investigating → resolved), newest
 * first inside each group, filterable by state and by source. Every row is one link to its review.
 */
export function IncidentList({ rows }: { rows: IncidentRow[] }) {
  const [filter, setFilter] = useState<'all' | IncidentGroup>('all');
  const t = useT();
  const [source, setSource] = useState('all');
  const [showResolved, setShowResolved] = useState(false);
  const sources = useMemo(() => [...new Map(rows.map((r) => [r.sourceId, r.sourceName])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const scoped = rows.filter((r) => source === 'all' || r.sourceId === source);
  const count = (g: IncidentGroup) => scoped.filter((r) => r.group === g).length;
  const visibleGroups = GROUPS.filter((g) => filter === 'all' || filter === g.key);

  if (!rows.length) {
    return (
      <div className="plate" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className="chip"><StateMark s="healthy" />{t('Nothing open')}</span>
        <span className="body" style={{ color: 'var(--ink-3)' }}>{t('An incident opens when a source version changes a substantive field. Equivalent changes take the deterministic fast path.')}</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="ilbar">
        <div className="mseg" role="group" aria-label={t('Filter by state')}>
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t('All')} <span className="n">{scoped.length}</span></button>
          {GROUPS.map((g) => <button key={g.key} type="button" aria-pressed={filter === g.key} onClick={() => setFilter(g.key)}>{t(g.label)} <span className="n">{count(g.key)}</span></button>)}
        </div>
        {sources.length > 1 && (
          <label className="ilsrc"><span>{t('Source')}</span>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">{t('All sources')} · {sources.length}</option>
              {sources.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
        )}
      </div>
      {visibleGroups.map((g) => {
        let list = scoped.filter((r) => r.group === g.key).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
        if (filter === 'all' && !list.length) return null;
        const folded = g.key === 'resolved' && filter === 'all' && !showResolved && list.length > RESOLVED_PREVIEW;
        const total = list.length;
        if (folded) list = list.slice(0, RESOLVED_PREVIEW);
        return (
          <section key={g.key} className="plate tight il" aria-label={`${t(g.label)}, ${total}`}>
            <h3 className="ilg">{t(g.label)}<span className="n">{total}</span></h3>
            {total === 0 ? <p className="body" style={{ padding: '14px 0', color: 'var(--ink-3)' }}>{t(g.empty)}</p> : (
              <ul>
                <li className="ilhd" aria-hidden="true"><span>{t('State')}</span><span>{t('Change')}</span><span>{t('Source')}</span><span>{t('Policy')}</span><span>{t('Opened')}</span><span /></li>
                {list.map((r) => (
                  <li key={r.id}>
                    <Link className="ilrow" href={r.href} prefetch={false}>
                      <span className="ils"><StateMark s={r.mark} />{t(r.stateText)}</span>
                      <span className="ilm">
                        <span className="ilk"><span className="mono">{r.recordKey}</span><span className="mono" style={{ color: 'var(--ink-3)' }}>{r.candidate}</span>{r.risk && <span className="ilr">{t(`Risk ${r.risk.toLowerCase()} · advisory`)}</span>}</span>
                        <b dir="auto">{t(r.headline)}</b>
                      </span>
                      <span className="ilx" title={r.sourceName} dir="auto">{r.sourceName}</span>
                      <span className="ilx mono">{r.policyCode ?? '—'}</span>
                      <span className="ilx ilt" dir="ltr">{r.openedText}</span>
                      <Icon name="chevron-right" size={16} style={{ color: 'var(--ink-3)' }} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {folded && <button type="button" className="lnk ilmore" onClick={() => setShowResolved(true)}>{t('Show all {n} resolved', { n: total })}</button>}
          </section>
        );
      })}
    </div>
  );
}
