'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Icon } from './icons';
import type { GuideData } from './guide-data';
import { useT } from './i18n/client';
import type { T } from './i18n/core';

/**
 * Judge walkthrough: a dismissible seven-stop path over the existing screens. It adds no route,
 * no navigation system and no privileged data: links point at the normal product pages, the
 * version labels come from the same incident list the chrome already reads, and the only
 * credentials shown are the two intentionally public hackathon credentials published in the
 * README (sandbox key, review-preview login). The signer, control and webhook secrets never
 * reach this component.
 */
type Mode = 'bar' | 'open' | 'closed';
const STORAGE = 'istithbat.judge-guide';

const Ctx = createContext<{ mode: Mode | null; setMode: (m: Mode) => void }>({ mode: null, setMode: () => {} });

export function JudgeGuideRoot({ children }: { children: ReactNode }) {
  const [mode, set] = useState<Mode | null>(null);
  useEffect(() => {
    let m: Mode = 'bar';
    try { const v = window.localStorage.getItem(STORAGE); if (v === 'open' || v === 'closed' || v === 'bar') m = v; } catch { /* storage blocked: default */ }
    set(m);
  }, []);
  const setMode = useCallback((m: Mode) => { set(m); try { window.localStorage.setItem(STORAGE, m); } catch { /* in-memory only */ } }, []);
  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>;
}

type Step = { key: string; title: string; line: string; href: string };
function steps(d: GuideData, t: T): Step[] {
  const inc = d.incidentId ? `/incidents/${d.incidentId}` : '/incidents';
  return [
    { key: 'overview', title: t('Overview'), line: t('What is trusted, what is held, and what needs a decision.'), href: '/overview' },
    { key: 'sandbox', title: t('Sandbox'), line: t('The controlled HadeethEnc 10618 change: reset, publish, watch it arrive.'), href: '/sandbox' },
    { key: 'pipeline', title: t('Pipeline'), line: t('Fingerprint, exact diff, AI advisory, regression and policy, in order.'), href: '/overview#flow' },
    { key: 'incident', title: t('Incident'), line: t('The exact change from the source, kept apart from the AI reading.'), href: inc },
    { key: 'blast', title: t('Blast Radius'), line: t('What depends on the record, and which app is proven impacted.'), href: d.incidentId ? `${inc}/blast-radius` : '/incidents' },
    { key: 'reviewer', title: t('Reviewer Preview'), line: t('Sign in with the preview login; decisions are previewed, never recorded.'), href: d.incidentId ? `${inc}#decision` : '/incidents' },
    { key: 'gateway', title: t('Gateway'), line: t('What the protected app is served right now, and why.'), href: d.gatewayHref },
  ];
}

function currentIndex(path: string, hash: string): number {
  if (path.startsWith('/sandbox')) return 1;
  if (path.startsWith('/overview')) return hash === '#flow' ? 2 : 0;
  if (/^\/incidents\/[^/]+\/blast-radius/.test(path)) return 4;
  if (/^\/incidents\/[^/]+$/.test(path)) return hash === '#decision' ? 5 : 3;
  if (path.startsWith('/gateway')) return 6;
  return -1;
}

/** The header entry point: reopens the guide after it was dismissed. */
export function JudgeGuideButton() {
  const { mode, setMode } = useContext(Ctx);
  const t = useT();
  return (
    <button type="button" className="jg-entry" aria-expanded={mode === 'open'} onClick={() => setMode(mode === 'open' ? 'bar' : 'open')} title={t('Judge walkthrough')}>
      <Icon name="list-checks" size={17} /><span>{t('Judge walkthrough')}</span>
    </button>
  );
}

export function JudgeGuide({ data }: { data: GuideData }) {
  const { mode, setMode } = useContext(Ctx);
  const path = usePathname() ?? '/';
  const t = useT();
  const [hash, setHash] = useState('');
  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [path]);
  useEffect(() => {
    if (mode !== 'open') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMode('bar'); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode, setMode]);
  if (!mode || mode === 'closed') return null;
  const list = steps(data, t);
  const at = currentIndex(path, hash);
  const next = list[at + 1] ?? (at === -1 ? list[0] : null);
  const prev = at > 0 ? list[at - 1] : null;
  const go = (s: Step) => { if (s.href.includes('#')) setHash(s.href.slice(s.href.indexOf('#'))); };
  const here = at >= 0 ? list[at] : null;

  return (
    <aside className={`jg jg-${mode}`} aria-label={t('Judge walkthrough')}>
      <div className="jg-head">
        <span className="jg-kicker"><Icon name="list-checks" size={15} />{t('Judge walkthrough')}</span>
        <span className="jg-step">{here ? t('Step {n} of {total}', { n: at + 1, total: list.length }) : t('{total} steps', { total: list.length })}</span>
        <span className="jg-tools">
          <button type="button" className="jg-ib" onClick={() => setMode(mode === 'open' ? 'bar' : 'open')} aria-expanded={mode === 'open'} aria-label={mode === 'open' ? t('Collapse walkthrough') : t('Expand walkthrough')}>
            <Icon name="chevron-right" size={16} style={{ transform: mode === 'open' ? 'rotate(90deg)' : 'rotate(-90deg)' }} />
          </button>
          <button type="button" className="jg-ib" onClick={() => setMode('closed')} aria-label={t('Dismiss walkthrough')}><Icon name="x" size={16} /></button>
        </span>
      </div>
      <div className="jg-dots" aria-hidden="true">{list.map((s, i) => <span key={s.key} className={i === at ? 'on' : i < at ? 'done' : ''} />)}</div>
      <p className="jg-line">{here ? <><b>{here.title}.</b> {here.line}</> : t('Seven stops through the live demo. Start at the Overview.')}</p>
      <p className="jg-state">{data.candidate
        ? <>{t('Latest')} <span className="mono">{data.candidate}</span> {t('quarantined')} · {t('Trusted')} <span className="mono">{data.trusted ?? '—'}</span> · {t('Served')} <span className="mono">{data.served ?? '—'}</span></>
        : <>{t('Nothing is held')} · {t('Served')} <span className="mono">{data.served ?? '—'}</span></>}{mode === 'bar' && <> · <button type="button" className="jg-link" onClick={() => setMode('open')}>{t('Demo access')}</button></>}</p>
      <div className="jg-nav">
        {prev ? <Link href={prev.href} onClick={() => go(prev)} className="jg-prev">{prev.title}</Link> : <span />}
        {next
          ? <Link href={next.href} onClick={() => go(next)} className="jg-next">{t('Next: {title}', { title: next.title })}<Icon name="arrow-right" size={15} /></Link>
          : <Link href={list[0].href} className="jg-next jg-again">{t('Back to the start')}<Icon name="refresh-cw" size={14} /></Link>}
      </div>
      {mode === 'open' && (
        <div className="jg-more">
          <dl className="jg-notes">
            <div><dt>{t('Sandbox key')}</dt><dd><span className="jg-cred">{t('Key')} <code className="mono">IstithbatDemo2026!</code></span><span>{t('Public hackathon demo access. Resets and publishes only the controlled 10618 sandbox.')}</span></dd></div>
            <div><dt>{t('Reviewer preview')}</dt><dd><span className="jg-cred">{t('Username')} <code className="mono">IslamicAIChallenge2026</code></span><span className="jg-cred">{t('Password')} <code className="mono">IstithbatReviewer2026!</code></span><span>{t('Preview only: it cannot sign or record a decision.')}</span></dd></div>
          </dl>
          <ol className="jg-list">
            {list.map((s, i) => (
              <li key={s.key}>
                <Link href={s.href} onClick={() => go(s)} aria-current={i === at ? 'step' : undefined} className={i === at ? 'on' : undefined}>
                  <span className="jg-n">{i + 1}</span><span><b>{s.title}</b><span>{s.line}</span></span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
}
