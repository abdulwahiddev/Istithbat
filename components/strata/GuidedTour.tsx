'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Icon } from './icons';
import { currentIndex, type GuideData } from './guide-data';
import { useT } from './i18n/client';
import type { T } from './i18n/core';

/**
 * Guided tour: an optional, dismissible seven-stop path over the existing screens. It adds no route
 * and no privileged data: links point at the normal product pages, the version labels come from the
 * incident list the chrome already reads, and the only credentials it can show are the two
 * intentionally public demo credentials published in the README (sandbox key, review-preview
 * login), folded under "Demo access". Signer, control and webhook secrets never reach the browser.
 * The default experience is the normal app: the tour opens only from the header.
 */
type Open = boolean;
const STORAGE = 'istithbat.tour';

const Ctx = createContext<{ open: Open | null; seen: boolean; setOpen: (o: Open) => void }>({ open: null, seen: true, setOpen: () => {} });

export function GuidedTourRoot({ children }: { children: ReactNode }) {
  const [open, set] = useState<Open | null>(null);
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    let v: string | null = null;
    try { v = window.localStorage.getItem(STORAGE); } catch { /* storage blocked */ }
    set(v === 'open');
    setSeen(v !== null);
  }, []);
  const setOpen = useCallback((o: Open) => {
    set(o); setSeen(true);
    try { window.localStorage.setItem(STORAGE, o ? 'open' : 'closed'); } catch { /* in-memory only */ }
  }, []);
  return <Ctx.Provider value={{ open, seen, setOpen }}>{children}</Ctx.Provider>;
}

type Step = { key: string; title: string; line: string; href: string };
/** The held canonical demo incident: the tour's fallback when the incident list cannot be read. */
const CANONICAL_INCIDENT = '863d5b03-fc98-4d49-a2a6-ae9d6c3cf753';
const LAST = 'istithbat.tour.step';
function steps(d: GuideData, t: T): Step[] {
  const inc = `/incidents/${d.incidentId ?? CANONICAL_INCIDENT}`;
  return [
    { key: 'overview', title: t('Overview'), line: t('What is trusted, what is held, and what needs a decision.'), href: '/overview' },
    { key: 'sandbox', title: t('Sandbox'), line: t('Trigger the controlled HadeethEnc 10618 change and watch it arrive.'), href: '/sandbox' },
    { key: 'pipeline', title: t('Pipeline'), line: t('Fingerprint, exact diff, AI advisory, regression and policy, in order.'), href: '/overview#flow' },
    { key: 'incident', title: t('Incident'), line: t('The exact change from the source, kept apart from the AI reading.'), href: inc },
    { key: 'blast', title: t('Blast Radius'), line: t('What depends on the record, and which app is proven impacted.'), href: `${inc}/blast-radius` },
    { key: 'reviewer', title: t('Reviewer Preview'), line: t('Preview each decision with the preview login. Nothing is recorded.'), href: `${inc}#decision` },
    { key: 'gateway', title: t('Gateway'), line: t('What the protected app is served right now, and why.'), href: d.gatewayHref },
  ];
}

/** The fragment as the browser sees it. Next.js soft navigation uses pushState, which fires no
 *  hashchange, so the tour re-reads it on every route change, history step and short interval. */
function useHash(path: string) {
  const [hash, setHash] = useState('');
  useEffect(() => {
    const read = () => setHash((h) => (h === window.location.hash ? h : window.location.hash));
    read();
    window.addEventListener('hashchange', read);
    window.addEventListener('popstate', read);
    const id = window.setInterval(read, 300);
    return () => { window.removeEventListener('hashchange', read); window.removeEventListener('popstate', read); window.clearInterval(id); };
  }, [path]);
  return hash;
}

/** After a soft navigation to /page#id, scroll once the streamed section exists. */
function scrollToHashWhenReady(href: string) {
  const i = href.indexOf('#');
  if (i < 0) return;
  const id = href.slice(i + 1);
  const started = Date.now();
  const tick = () => {
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ block: 'start' }); return; }
    if (Date.now() - started < 8000) window.setTimeout(tick, 150);
  };
  window.setTimeout(tick, 60);
}

/** Header entry point. A small dot marks it until the tour has been opened once. */
export function GuidedTourButton() {
  const { open, seen, setOpen } = useContext(Ctx);
  const t = useT();
  return (
    <button type="button" className="tour-entry" aria-expanded={!!open} onClick={() => setOpen(!open)} title={t('Guided tour')}>
      <Icon name="list-checks" size={17} /><span>{t('Guided tour')}</span>{!seen && <i className="tour-new" aria-hidden="true" />}
    </button>
  );
}

const PUBLIC_ACCESS = [
  { key: 'sandbox', label: 'Sandbox key', value: 'IstithbatDemo2026!', note: 'Public hackathon demo access. Resets and publishes the controlled sandbox only.' },
  { key: 'user', label: 'Reviewer preview username', value: 'IslamicAIChallenge2026', note: null },
  { key: 'pass', label: 'Reviewer preview password', value: 'IstithbatReviewer2026!', note: 'Preview only. It cannot sign, approve or record a decision.' },
] as const;

function Copy({ value, label }: { value: string; label: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return; const id = setTimeout(() => setDone(false), 1600); return () => clearTimeout(id); }, [done]);
  return (
    <button type="button" className="tour-copy" aria-label={t('Copy {what}', { what: label })} onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); } catch { /* clipboard blocked */ } }}>
      <Icon name={done ? 'check' : 'copy'} size={14} /><span aria-live="polite">{done ? t('Copied') : t('Copy')}</span>
    </button>
  );
}

export function GuidedTour({ data }: { data: GuideData }) {
  const { open, setOpen } = useContext(Ctx);
  const path = usePathname() ?? '/';
  const t = useT();
  const hash = useHash(path);
  const [panel, setPanel] = useState<'none' | 'steps' | 'access'>('none');
  const [last, setLast] = useState(-1);
  const at = currentIndex(path, hash);
  // Remember the last stop, so an off-tour page (Sources, Record) offers to resume instead of restarting.
  useEffect(() => {
    if (at >= 0) { setLast(at); try { window.sessionStorage.setItem(LAST, String(at)); } catch { /* storage blocked */ } return; }
    try { const raw = window.sessionStorage.getItem(LAST); const v = raw === null ? -1 : Number(raw); if (Number.isInteger(v) && v >= 0 && v < 7) setLast(v); } catch { /* storage blocked */ }
  }, [at]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);
  if (!open) return null;
  const list = steps(data, t);
  const here = at >= 0 ? list[at] : null;
  const resume = !here && last >= 0 ? list[last] : null;
  const next = here ? list[at + 1] ?? null : resume ?? list[0];
  const prev = at > 0 ? list[at - 1] : null;
  const go = (s: Step) => scrollToHashWhenReady(s.href);
  const toggle = (p: 'steps' | 'access') => setPanel((cur) => (cur === p ? 'none' : p));

  return (
    <aside className="tour" aria-label={t('Guided tour')}>
      <div className="tour-head">
        <span className="tour-kicker"><Icon name="list-checks" size={14} />{t('Guided tour')}</span>
        <span className="tour-count" aria-label={here ? t('Step {n} of {total}', { n: at + 1, total: list.length }) : undefined}>{here ? <bdi dir="ltr">{at + 1} / {list.length}</bdi> : null}</span>
        <button type="button" className="tour-x" onClick={() => setOpen(false)} aria-label={t('Close the guided tour')}><Icon name="x" size={15} /></button>
      </div>
      <div className="tour-bar" aria-hidden="true">{list.map((s, i) => <span key={s.key} className={i === at ? 'on' : i < at ? 'done' : ''} />)}</div>
      <b className="tour-title">{here ? here.title : resume ? t('This page is outside the tour') : t('Seven short stops')}</b>
      <p className="tour-line">{here ? here.line : resume ? t('Continue where you left off: {title}.', { title: resume.title }) : t('From the source change to the decision and what production serves.')}</p>
      <p className="tour-state">{data.candidate && data.trusted && data.served
        ? <><bdi className="mono">{data.candidate}</bdi> {t('quarantined')} · {t('Trusted')} <bdi className="mono">{data.trusted}</bdi> · {t('Served')} <bdi className="mono">{data.served}</bdi></>
        : !data.candidate && data.served
          ? <>{t('Nothing is held')} · {t('Served')} <bdi className="mono">{data.served}</bdi></>
          : t('Demo state unavailable')}</p>
      <div className="tour-nav">
        {prev ? <Link href={prev.href} onClick={() => go(prev)} className="tour-prev"><Icon name="arrow-right" size={14} className="tour-back" />{t('Back')}</Link> : <span />}
        {next
          ? <Link href={next.href} onClick={() => go(next)} className="tour-next">{here ? t('Next: {title}', { title: next.title }) : resume ? t('Resume: {title}', { title: next.title }) : t('Start the tour')}<Icon name="arrow-right" size={14} /></Link>
          : <Link href={list[0].href} className="tour-next tour-again" onClick={() => setPanel('none')}>{t('Back to the start')}</Link>}
      </div>
      <div className="tour-more">
        <button type="button" className="tour-disc" aria-expanded={panel === 'steps'} aria-controls="tour-steps" onClick={() => toggle('steps')}>{t('All steps')}<Icon name="chevron-right" size={13} className="tour-chev" /></button>
        <button type="button" className="tour-disc" aria-expanded={panel === 'access'} aria-controls="tour-access" onClick={() => toggle('access')}><Icon name="lock-open" size={13} />{t('Demo access')}<Icon name="chevron-right" size={13} className="tour-chev" /></button>
      </div>
      {panel === 'steps' && (
        <ol id="tour-steps" className="tour-steps">
          {list.map((s, i) => (
            <li key={s.key}><Link href={s.href} onClick={() => go(s)} aria-current={i === at ? 'step' : undefined} title={s.line}><span className="tour-n">{i + 1}</span>{s.title}</Link></li>
          ))}
        </ol>
      )}
      {panel === 'access' && (
        <dl id="tour-access" className="tour-access">
          {PUBLIC_ACCESS.map((a) => (
            <div key={a.key}>
              <dt>{t(a.label)}</dt>
              <dd><code className="mono">{a.value}</code><Copy value={a.value} label={t(a.label)} /></dd>
              {a.note && <dd className="tour-note">{t(a.note)}</dd>}
            </div>
          ))}
        </dl>
      )}
    </aside>
  );
}
