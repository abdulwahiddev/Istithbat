'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Main navigation (Bible §13). Screens not built yet are listed but inert, never faked. */
export interface NavItem {
  href: string;
  label: string;
  ready: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/overview', label: 'Overview', ready: false },
  { href: '/sources', label: 'Sources', ready: true },
  { href: '/review-queue', label: 'Review Queue', ready: false },
  { href: '/blast-radius', label: 'Blast Radius', ready: false },
  { href: '/trust-gateway', label: 'Trust Gateway', ready: false },
  { href: '/audit-log', label: 'Audit Log', ready: false },
  { href: '/settings', label: 'Settings', ready: false },
];

export function NavLinks() {
  const pathname = usePathname() ?? '/';
  return (
    <nav className="ist-nav" aria-label="Main">
      {NAV_ITEMS.map((item) => {
        if (!item.ready) {
          return (
            <span key={item.href} className="ist-nav__item" aria-disabled="true" title="Not built yet">
              {item.label}
              <span className="ist-nav__soon">soon</span>
            </span>
          );
        }
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className="ist-nav__item" aria-current={active ? 'page' : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
