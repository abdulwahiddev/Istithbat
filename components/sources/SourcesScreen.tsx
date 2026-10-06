'use client';
import { useState } from 'react';
import { css, type SourceView } from './types';
import { Icon, type IconName } from '@/components/strata/icons';
import { useT } from '@/components/strata/i18n/client';

/** Lineage entities: upstream provider → captured snapshot → trusted baseline → protected-app binding. */
const STAGE_ICON: IconName[] = ['globe', 'file-clock', 'shield-check', 'link'];

/**
 * Lineage instrument + selected-source detail (Sources board). Selection is driven by both the rows
 * and the segmented switch, and is mirrored into the URL (/sources/{id}) without a navigation.
 */
export function SourcesScreen({ views, initialId }: { views: SourceView[]; initialId: string }) {
  const [selId, setSelId] = useState(initialId);
  const t = useT();
  const sel = views.find((v) => v.id === selId) ?? views[0];
  const pick = (id: string) => {
    setSelId(id);
    try { window.history.replaceState(null, '', `/sources/${encodeURIComponent(id)}`); } catch { /* URL sync is a convenience */ }
  };
  if (!sel) return null;
  return (
    <>
      <section id="lineage" className="band" aria-labelledby="h-lin" style={{ paddingTop: 0 }}>
        <div className="wrap g">
          <div className="rail"><span className="mk mk-src" /><h2 id="h-lin">{t('Lineage')}</h2><p>{t('Upstream to production; select a source.')}</p></div>
          <div className="main">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}><h3 className="h3">{t('Version lineage')}</h3><span className="meta">{t('Trusted is not the same as served')}</span></div>
            <div className="plate tight" style={{ overflowX: 'auto' }}>
              <div className="lhead" aria-hidden="true"><span>{t('Source')}</span><span>{t('Upstream')}</span><span>{t('Latest snapshot')}</span><span>{t('Trusted baseline')}</span><span>{t('Protected-app binding')}</span></div>
              <div role="list" aria-label={t('Sources')}>
                {views.map((v) => (
                  <button key={v.id} type="button" className={`srcl${v.id === sel.id ? ' on' : ''}`} aria-pressed={v.id === sel.id} onClick={() => pick(v.id)} role="listitem"
                    aria-label={`${v.name}: latest ${v.stages[1].main}, ${v.stages[1].sub}; trusted ${v.stages[2].main}; ${v.stages[3].main}, ${v.stages[3].sub}`}>
                    <span className="lsrc">
                      <b style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="database" size={15} style={{ color: 'var(--ink-3)', flex: 'none' }} /><span dir="auto" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{v.name}</span></b>
                      <span className="meta">{t(v.kind)}</span>
                      <span className="lchips">
                        <span className="chip" style={{ padding: '1px 9px 1px 7px', fontSize: 12 }}><span className="dot" style={{ background: v.chips[1].tone }} />{t(v.chips[1].label)}</span>
                        {v.synthetic && <span className="pill" style={{ padding: '1px 10px', border: '1px solid var(--am-soft)', background: 'var(--am-soft)', color: 'var(--am-ink)', fontSize: 12 }}><span className="dot" style={{ background: 'var(--am)' }} />{t('Synthetic')}</span>}
                        <span className="meta" style={{ fontSize: 12 }}>{t(v.records)}</span>
                      </span>
                    </span>
                    {v.stages.map((g, i) => (
                      <span key={i} className="stg" style={css(i < 3 ? `--ln:${g.line};--ls:${g.lineStyle}` : '--ln:transparent;--ls:solid')}>
                        <span className={`sdot${g.dot.startsWith('background') ? ' fill' : ''}`} style={css(g.dot)}><Icon name={STAGE_ICON[i] ?? 'link'} size={13} /></span>
                        <b className={g.mono ? 'mono' : ''} title={g.hint} aria-label={g.hint ? `${g.main}, ${g.hint}` : undefined}>{g.main}</b>
                        <span>{t(g.sub)}</span>
                      </span>
                    ))}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', fontSize: 13, color: 'var(--ink-3)' }}>
              <span className="lk"><Icon name="globe" size={13} />{t('Upstream')}</span>
              <span className="lk"><Icon name="file-clock" size={13} />{t('Snapshot')}</span>
              <span className="lk"><Icon name="shield-check" size={13} />{t('Trusted')}</span>
              <span className="lk"><Icon name="link" size={13} />{t('Binding')}</span>
              <span aria-hidden="true" style={{ width: 1, height: 14, background: 'var(--line-2)', alignSelf: 'center' }} />
              <span className="lk"><span className="lkl" style={{ borderTop: '2px solid var(--tq)' }} />{t('Identical or serving')}</span>
              <span className="lk"><span className="lkl" style={{ borderTop: '2px dashed var(--co)' }} />{t('Held: not trusted')}</span>
              <span className="lk"><span className="lkl" style={{ borderTop: '2px dashed var(--line-2)' }} />{t('Trusted, no protected-app binding')}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="detail" className="band" aria-labelledby="h-det">
        <div className="wrap g">
          <div className="rail"><span className="mk mk-det" /><h2 id="h-det">{t('Source')}</h2><p>{t('Identity, versioning and checks.')}</p></div>
          <div className="main" key={sel.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h3 className="h3">{sel.name}</h3>
                <span className="meta">{sel.provider}</span>
              </div>
              <div className="mseg" role="group" aria-label={t('Select source')} style={{ marginTop: -7 }}>
                {views.map((v) => <button key={v.id} type="button" aria-pressed={v.id === sel.id} onClick={() => pick(v.id)}>{v.tab}</button>)}
              </div>
            </div>

            <div className="plate fade" style={{ paddingTop: 24, paddingBottom: 24 }}>
              <div className="sub" style={{ rowGap: 20, alignItems: 'start' }}>
                <div className="c1-6" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{sel.chips.map((c) => <span key={c.label} className="chip"><span className="dot" style={{ background: c.tone }} />{t(c.label)}</span>)}</span>
                  <p style={{ margin: 0, fontSize: 18, lineHeight: '28px', maxWidth: '34em' }}>{t(sel.sentence)}</p>
                </div>
                <div className="c7-10">
                  <div className="kv"><span>{t('Latest snapshot')}</span><span className="mono" title={sel.revisionHint}>{sel.latest}</span></div>
                  <div className="kv"><span>{t('Trusted baseline')}</span><span className="mono" title={sel.revisionHint}>{sel.trusted}</span></div>
                  <div className="kv"><span>{t('Served')}</span><span>{t(sel.served)}</span></div>
                  <div className="kv"><span>{t('Changed since baseline')}</span><span>{t(sel.changed)}</span></div>
                </div>
              </div>
            </div>

            <div className="sub fade" style={{ rowGap: 32, alignItems: 'start' }}>
              <div className="c1-5 plate in l" style={{ marginInlineStart: -24, paddingInlineStart: 24 }}>
                <div className="kv"><span>{t('Source id')}</span><span className="mono">{sel.id}</span></div>
                <div className="kv"><span>{t('Connector')}</span><span className="mono">{sel.connector}</span></div>
                <div className="kv"><span>{t('Scope')}</span><span>{t(sel.scope)}</span></div>
                <div className="kv"><span>{t('Canonical keys')}</span><span className="mono">{sel.keys}</span></div>
                <div className="kv"><span>{t('Content level')}</span><span className="mono">{sel.level}</span></div>
              </div>
              <div className="c6-10 plate in r" style={{ marginInlineEnd: -24, paddingInlineEnd: 24 }}>
                <div className="kv"><span>{t('Version strategy')}</span><span>{t(sel.strategy)}</span></div>
                <div className="kv"><span>{t('Revision rule')}</span><span>{t(sel.revision)}</span></div>
                <div className="kv"><span>{t('Silent mutation')}</span><span>{t(sel.silent)}</span></div>
                <div className="kv"><span>{t('Raw fingerprint')}</span><span className="mono">{sel.raw}</span></div>
                <div className="kv"><span>{t('Canonical fingerprint')}</span><span className="mono">{sel.canon}</span></div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span className="cap">{t('Recent checks')}</span>
              <div className="plate tight">
                {sel.checks.length ? sel.checks.map((k, i) => (
                  <div key={i} className="ev"><span className="dot" style={css(k.mk)} aria-hidden="true" /><span className="tm mono">{k.when}</span><span className="w"><b>{t(k.title)}</b><span>{t(k.note)}</span></span><span className="who-l mono">{k.code}</span></div>
                )) : <p className="body" style={{ padding: '16px 0' }}>{t('No check is recorded for this source.')}</p>}
              </div>
            </div>

            {/* Low-frequency disclosures: always reachable, never weighted like operational content. */}
            <div className="srcfoot">
              <span className="cap">{t('Source details')}</span>
              <details className="quiet">
                <summary>{t(sel.termsLabel)}</summary>
                <div className="raw" dir="ltr" style={{ whiteSpace: 'pre-wrap', fontFamily: "var(--font-instrument),'Instrument Sans',sans-serif", fontSize: 14, lineHeight: '22px' }}>{sel.terms}</div>
              </details>
              <details className="quiet">
                <summary>{t('Endpoint and integrity check')}</summary>
                <div className="raw" dir="ltr">{sel.endpoint}</div>
              </details>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
