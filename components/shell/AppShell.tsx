import Link from 'next/link';
import type { ReactNode } from 'react';
import { ProvenanceLegend } from '../provenance/Provenance';
import { NavLinks } from './NavLinks';

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="ist-crumbs" aria-label="Breadcrumb">
      {items.map((c, i) => (
        <span key={`${c.label}-${i}`} className="ist-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
          {i > 0 && <span className="ist-crumbs__sep" aria-hidden="true">/</span>}
          {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

/**
 * Application frame: sidebar navigation, page content, and a footer that keeps the
 * provenance legend on every screen. Page-specific breadcrumbs live in <PageTopbar>.
 */
export function AppShell({ children, aiModeLabel }: { children: ReactNode; aiModeLabel: ReactNode }) {
  return (
    <div className="ist-shell">
      <aside className="ist-sidebar">
        <Link href="/sources" className="ist-logo" aria-label="Istithbat home">
          {/* Official mark, cropped from the brand sheet; never redrawn. */}
          <img src="/brand/istithbat-mark.png" alt="" width={30} height={32} />
          <span className="ist-logo__words">
            <span className="ist-logo__en">Istithbat</span>
            <span className="ist-logo__ar" lang="ar">
              استثبات
            </span>
          </span>
        </Link>
        <div className="ist-context">
          <div className="ist-context__title">Knowledge integrity console</div>
          <div className="ist-context__meta">Track 04 · controlled demo</div>
        </div>
        <NavLinks />
        <div className="ist-sidebar__foot">Trace. Verify. Preserve.</div>
      </aside>
      <div className="ist-main">
        {children}
        <footer className="ist-footer">
          <ProvenanceLegend />
          <span className="ist-row" style={{ gap: 12 }}>
            {aiModeLabel}
            <span>Source text stays exact. AI advises · policy governs · humans decide.</span>
          </span>
        </footer>
      </div>
    </div>
  );
}

export function PageTopbar({ crumbs, right }: { crumbs: Crumb[]; right?: ReactNode }) {
  return (
    <header className="ist-topbar">
      <Breadcrumbs items={crumbs} />
      <div className="ist-topbar__right">{right}</div>
    </header>
  );
}
