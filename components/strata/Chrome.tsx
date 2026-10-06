'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useActionState, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ThemeSwitch } from './theme';
import { Icon } from './icons';
import type { UnlockState } from '@/app/(ui)/_actions/reviewer';

export type ChromeIncident = {
  id: string; recordKey: string; candidateLabel: string; trustedLabel: string | null; servedLabel: string | null;
  status: string; needsDecision: boolean;
};
export type ChromeData = {
  /** Open incidents, lead first (newest needing a decision). */
  incidents: ChromeIncident[];
  decisionCount: number;
  /** The served state for the state bar when nothing is held. */
  served: { appName: string; trustedLabel: string | null; servedLabel: string | null } | null;
  gatewayHref: string;
  reviewer: { name: string } | null;
  /** Whether this deployment can verify a review credential at all (server-side check). */
  reviewAvailable: boolean;
};

type Actions = {
  unlock: (prev: UnlockState, form: FormData) => Promise<UnlockState>;
  lock: () => Promise<void>;
};

const NAV = ['overview', 'incidents', 'blast', 'gateway', 'sources', 'record'] as const;
type NavKey = (typeof NAV)[number];

function activeKey(path: string): NavKey | null {
  if (path.startsWith('/overview')) return 'overview';
  if (/^\/incidents\/[^/]+\/blast-radius/.test(path)) return 'blast';
  if (/^\/incidents\/[^/]+\/record/.test(path)) return 'record';
  if (path.startsWith('/incidents')) return 'incidents';
  if (path.startsWith('/gateway')) return 'gateway';
  if (path.startsWith('/sources')) return 'sources';
  return null;
}

/** Sticky chrome: header + incident-state bar as one glass unit (handoff §7). */
export function Chrome({ data, actions }: { data: ChromeData; actions: Actions }) {
  const path = usePathname() ?? '/';
  const router = useRouter();
  const pathId = path.match(/^\/incidents\/([^/]+)/)?.[1];
  const current = data.incidents.find((i) => i.id === pathId) ?? (pathId ? null : data.incidents[0] ?? null);
  const scope = data.incidents.find((i) => i.id === pathId) ?? data.incidents[0] ?? null;
  const active = activeKey(path);
  const n = data.decisionCount;

  const links: Record<NavKey, { href: string; label: string }> = {
    overview: { href: '/overview', label: 'Overview' },
    incidents: { href: '/incidents', label: 'Incidents' },
    blast: { href: scope ? `/incidents/${scope.id}/blast-radius` : '/incidents', label: 'Blast Radius' },
    gateway: { href: data.gatewayHref, label: 'Gateway' },
    sources: { href: '/sources', label: 'Sources' },
    record: { href: scope ? `/incidents/${scope.id}/record` : '/incidents', label: 'Record' },
  };

  return (
    <div className="chrome">
      <header style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px 24px', paddingTop: 14, paddingBottom: 14 }}>
          <Link href="/overview" aria-label="Istithbat — overview" className="brand">
            {/* Official identity (Istithbat Brand.png): transparent symbol + approved wordmark, per theme */}
            <img className="brand-on-light" src="/brand/istithbat-symbol-on-light.png" alt="" width={31} height={34} />
            <img className="brand-on-dark" src="/brand/istithbat-symbol-on-dark.png" alt="" width={31} height={34} />
            <img className="brand-latin brand-on-light" src="/brand/istithbat-wordmark-on-light.png" alt="" width={77} height={34} />
            <img className="brand-latin brand-on-dark" src="/brand/istithbat-wordmark-on-dark.png" alt="" width={77} height={34} />
          </Link>
          <nav aria-label="Primary">
            <NavSeg active={active}>
              {NAV.map((k) => (
                <Link key={k} href={links[k].href} data-nav={k} aria-current={active === k ? 'page' : undefined}>
                  {links[k].label}
                  {k === 'incidents' && n > 0 && <span className="badge" aria-label={`${n} open`}>{n}</span>}
                </Link>
              ))}
            </NavSeg>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ThemeSwitch />
            <button type="button" className="iconbtn" onClick={() => router.push('/incidents')}
              aria-label={n ? `Notifications, ${n} ${n === 1 ? 'incident needs' : 'incidents need'} a decision` : 'Notifications, nothing needs a decision'}>
              <Icon name="bell" size={18} />
              {n > 0 && <span className="bd" />}
            </button>
            <Reviewer reviewer={data.reviewer} available={data.reviewAvailable} actions={actions} />
          </div>
        </div>
      </header>
      <StateBar incident={current} served={data.served} />
    </div>
  );
}

/** The nav segment. On navigation the selected glass pill travels from the old item to the new one. */
function NavSeg({ active, children }: { active: NavKey | null; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<NavKey | null>(active);
  const [ind, setInd] = useState<{ x: number; w: number; on: boolean }>({ x: 0, w: 0, on: false });
  useLayoutEffect(() => {
    const seg = ref.current;
    const from = prev.current;
    prev.current = active;
    if (!seg || !active || !from || from === active) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = seg.getBoundingClientRect();
    const a = seg.querySelector<HTMLElement>(`[data-nav="${from}"]`)?.getBoundingClientRect();
    const b = seg.querySelector<HTMLElement>(`[data-nav="${active}"]`)?.getBoundingClientRect();
    if (!a || !b) return;
    setInd({ x: a.left - box.left, w: a.width, on: true });
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setInd({ x: b.left - box.left, w: b.width, on: true })));
    const t = setTimeout(() => setInd((s) => ({ ...s, on: false })), 260);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [active]);
  return (
    <div className={`seg${ind.on ? ' moving' : ''}`} ref={ref}>
      {ind.on && <span className="seg-ind" aria-hidden="true" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} />}
      {children}
    </div>
  );
}

/** latest seen ≠ trusted = served, for the active incident; the served state only when nothing is held. */
function StateBar({ incident, served }: { incident: ChromeIncident | null; served: ChromeData['served'] }) {
  return (
    <div className="casebar" style={{ position: 'relative', background: 'var(--bar-bg)', borderBottom: '1px solid var(--line)' }}>
      <div className="wrap" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 28px', paddingTop: 10, paddingBottom: 10, fontSize: 14, minHeight: 37, boxSizing: 'content-box' }}>
        {incident ? (
          <>
            <span className="mono" style={{ color: 'var(--ink)' }}>{incident.recordKey}</span>
            <span style={{ width: 1, height: 16, background: 'var(--line-2)' }} aria-hidden="true" />
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--ink-3)' }}>Latest seen</span><span className="mono" style={{ color: 'var(--co-ink)' }}>{incident.candidateLabel}</span>
              <span style={{ color: incident.status === 'QUARANTINED' || incident.needsDecision ? 'var(--co-ink)' : 'var(--am-ink)' }}>{incident.status === 'QUARANTINED' || incident.needsDecision ? 'held' : 'investigating'}</span>
            </span>
            <span style={{ color: 'var(--ink-4)' }} aria-hidden="true">≠</span>
            <span className="sr-only">is not</span>
            <Served trusted={incident.trustedLabel} served={incident.servedLabel} />
            {incident.needsDecision && (
              <Link className="cta" href={`/incidents/${incident.id}#decision`} style={{ marginLeft: 'auto' }}>
                <Icon name="user-check" size={16} />Decision needed
              </Link>
            )}
          </>
        ) : served ? (
          <>
            <span style={{ color: 'var(--ink)' }}>{served.appName}</span>
            <span style={{ width: 1, height: 16, background: 'var(--line-2)' }} aria-hidden="true" />
            <Served trusted={served.trustedLabel} served={served.servedLabel} />
            <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>Nothing is held</span>
          </>
        ) : <span style={{ color: 'var(--ink-3)' }}>No protected-app binding</span>}
      </div>
    </div>
  );
}

function Served({ trusted, served }: { trusted: string | null; served: string | null }) {
  return (
    <>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--ink-3)' }}>Trusted</span><span className="mono">{trusted ?? '—'}</span></span>
      <span style={{ color: 'var(--ink-4)' }} aria-hidden="true">{trusted && trusted === served ? '=' : '≠'}</span>
      <span className="sr-only">{trusted && trusted === served ? 'equals' : 'is not'}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--ink-3)' }}>Served</span><span className="mono">{served ?? '—'}</span>{served && <span className="mk mk-det" style={{ width: 6, height: 6 }} aria-hidden="true" />}</span>
    </>
  );
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'R';

/** Reviewer pill. Signed in: name from the review session. Otherwise it opens the D-11 unlock. */
function Reviewer({ reviewer, available, actions }: { reviewer: ChromeData['reviewer']; available: boolean; actions: Actions }) {
  const [open, setOpen] = useState(false);
  const [state, submit, pending] = useActionState(actions.unlock, { ok: false });
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => { if (state.ok) { setOpen(false); router.refresh(); } }, [state, router]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);
  const label = reviewer ? `${reviewer.name}, reviewer mode` : available ? 'Reviewer mode is locked' : 'Reviewer mode is unavailable on this deployment';
  return (
    <div className="whobox" ref={box}>
      <button type="button" className="who" aria-label={label} title={reviewer ? 'Reviewer mode' : 'Unlock reviewer mode'} aria-expanded={open} aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)} style={{ font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
        <span className={`avatar${reviewer ? '' : ' locked'}`} style={{ boxShadow: 'none' }}>
          {reviewer ? initials(reviewer.name) : <Icon name="lock" size={16} />}
        </span>
        <span className="who-name">{reviewer ? reviewer.name : 'Reviewer mode'}</span>
      </button>
      {open && (
        <div className="unlock" role="dialog" aria-label={reviewer ? 'Reviewer mode' : 'Unlock reviewer mode'}>
          {reviewer ? (
            <>
              <p>Signed in as <b style={{ color: 'var(--ink)' }}>{reviewer.name}</b>. Decisions are recorded under this name.</p>
              <button type="button" className="ubtn" onClick={async () => { await actions.lock(); setOpen(false); router.refresh(); }}>Lock reviewer mode</button>
            </>
          ) : !available ? (
            <p>Reviewer sign-in is not configured on this deployment, so no decision can be signed here. Read-only views stay public.</p>
          ) : (
            <form action={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p>Only reviewers can sign decisions. Read-only views stay public.</p>
              <label>Name to sign with<input name="name" autoComplete="name" required maxLength={60} /></label>
              <label>Review credential<input name="secret" type="password" autoComplete="current-password" required /></label>
              {state.error && <p className="err" role="alert">{state.error}</p>}
              <button type="submit" className="ubtn" disabled={pending}>{pending ? 'Checking…' : 'Unlock reviewer mode'}</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
