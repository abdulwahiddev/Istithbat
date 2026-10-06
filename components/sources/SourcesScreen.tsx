'use client';
import { useState } from 'react';
import { css, type SourceView } from './types';

/**
 * Lineage instrument + selected-source detail (Sources board). Selection is driven by both the rows
 * and the segmented switch, and is mirrored into the URL (/sources/{id}) without a navigation.
 */
export function SourcesScreen({ views, initialId }: { views: SourceView[]; initialId: string }) {
  const [selId, setSelId] = useState(initialId);
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
          <div className="rail"><span className="mk mk-src" /><h2 id="h-lin">Lineage</h2><p>Upstream to production; select a source.</p></div>
          <div className="main">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}><h3 className="h3">Version lineage</h3><span className="meta">Trusted is not the same as served</span></div>
            <div className="plate tight" style={{ overflowX: 'auto' }}>
              <div className="lhead" aria-hidden="true"><span>Source</span><span>Upstream</span><span>Latest snapshot</span><span>Trusted baseline</span><span>Protected-app binding</span></div>
              <div role="list" aria-label="Sources">
                {views.map((v) => (
                  <button key={v.id} type="button" className={`srcl${v.id === sel.id ? ' on' : ''}`} aria-pressed={v.id === sel.id} onClick={() => pick(v.id)} role="listitem"
                    aria-label={`${v.name}: latest ${v.stages[1].main}, ${v.stages[1].sub}; trusted ${v.stages[2].main}; ${v.stages[3].main}, ${v.stages[3].sub}`}>
                    <span className="lsrc">
                      <b>{v.name}</b>
                      <span className="meta">{v.kind}</span>
                      <span className="lchips">
                        <span className="chip" style={{ padding: '1px 9px 1px 7px', fontSize: 12 }}><span className="dot" style={{ background: v.chips[1].tone }} />{v.chips[1].label}</span>
                        {v.synthetic && <span className="pill" style={{ padding: '1px 10px', border: '1px solid var(--am-soft)', background: 'var(--am-soft)', color: 'var(--am-ink)', fontSize: 12 }}><span className="dot" style={{ background: 'var(--am)' }} />Synthetic</span>}
                        <span className="meta" style={{ fontSize: 12 }}>{v.records}</span>
                      </span>
                    </span>
                    {v.stages.map((g, i) => (
                      <span key={i} className="stg" style={css(i < 3 ? `--ln:${g.line};--ls:${g.lineStyle}` : '--ln:transparent;--ls:solid')}>
                        <span className="sdot" style={css(g.dot)} />
                        <b className={g.mono ? 'mono' : ''}>{g.main}</b>
                        <span>{g.sub}</span>
                      </span>
                    ))}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', fontSize: 13, color: 'var(--ink-3)' }}>
              <span className="lk"><span className="lkl" style={{ borderTop: '2px solid var(--tq)' }} />Identical or serving</span>
              <span className="lk"><span className="lkl" style={{ borderTop: '2px dashed var(--co)' }} />Held: not trusted</span>
              <span className="lk"><span className="lkl" style={{ borderTop: '2px dashed var(--line-2)' }} />Trusted, no protected-app binding</span>
            </div>
          </div>
        </div>
      </section>

      <section id="detail" className="band" aria-labelledby="h-det">
        <div className="wrap g">
          <div className="rail"><span className="mk mk-det" /><h2 id="h-det">Source</h2><p>Identity, versioning and checks.</p></div>
          <div className="main" key={sel.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h3 className="h3">{sel.name}</h3>
                <span className="meta">{sel.provider}</span>
              </div>
              <div className="mseg" role="group" aria-label="Select source" style={{ marginTop: -7 }}>
                {views.map((v) => <button key={v.id} type="button" aria-pressed={v.id === sel.id} onClick={() => pick(v.id)}>{v.tab}</button>)}
              </div>
            </div>

            <div className="plate fade" style={{ paddingTop: 24, paddingBottom: 24 }}>
              <div className="sub" style={{ rowGap: 20, alignItems: 'start' }}>
                <div className="c1-6" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{sel.chips.map((c) => <span key={c.label} className="chip"><span className="dot" style={{ background: c.tone }} />{c.label}</span>)}</span>
                  <p style={{ margin: 0, fontSize: 18, lineHeight: '28px', maxWidth: '34em' }}>{sel.sentence}</p>
                </div>
                <div className="c7-10">
                  <div className="kv"><span>Latest snapshot</span><span className="mono">{sel.latest}</span></div>
                  <div className="kv"><span>Trusted baseline</span><span className="mono">{sel.trusted}</span></div>
                  <div className="kv"><span>Served</span><span>{sel.served}</span></div>
                  <div className="kv"><span>Changed since baseline</span><span>{sel.changed}</span></div>
                </div>
              </div>
            </div>

            <div className="sub fade" style={{ rowGap: 32, alignItems: 'start' }}>
              <div className="c1-5 plate in l" style={{ marginLeft: -24, paddingLeft: 24 }}>
                <div className="kv"><span>Source id</span><span className="mono">{sel.id}</span></div>
                <div className="kv"><span>Connector</span><span className="mono">{sel.connector}</span></div>
                <div className="kv"><span>Scope</span><span>{sel.scope}</span></div>
                <div className="kv"><span>Canonical keys</span><span className="mono">{sel.keys}</span></div>
                <div className="kv"><span>Content level</span><span className="mono">{sel.level}</span></div>
              </div>
              <div className="c6-10 plate in r" style={{ marginRight: -24, paddingRight: 24 }}>
                <div className="kv"><span>Version strategy</span><span>{sel.strategy}</span></div>
                <div className="kv"><span>Revision rule</span><span>{sel.revision}</span></div>
                <div className="kv"><span>Silent mutation</span><span>{sel.silent}</span></div>
                <div className="kv"><span>Raw fingerprint</span><span className="mono">{sel.raw}</span></div>
                <div className="kv"><span>Canonical fingerprint</span><span className="mono">{sel.canon}</span></div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span className="cap">Recent checks</span>
              <div className="plate tight">
                {sel.checks.length ? sel.checks.map((k, i) => (
                  <div key={i} className="ev"><span className="dot" style={css(k.mk)} aria-hidden="true" /><span className="tm mono">{k.when}</span><span className="w"><b>{k.title}</b><span>{k.note}</span></span><span className="who-l mono">{k.code}</span></div>
                )) : <p className="body" style={{ padding: '16px 0' }}>No check is recorded for this source.</p>}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <details>
                <summary>{sel.termsLabel}</summary>
                <div className="raw" style={{ whiteSpace: 'pre-wrap', fontFamily: "var(--font-instrument),'Instrument Sans',sans-serif", fontSize: 14, lineHeight: '22px' }}>{sel.terms}</div>
              </details>
              <details>
                <summary>Endpoint and integrity check</summary>
                <div className="raw">{sel.endpoint}</div>
              </details>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
