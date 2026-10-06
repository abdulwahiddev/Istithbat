import Link from 'next/link';
import { preload } from 'react-dom';
import { HeldHero } from '@/components/landing/HeldHero';
import { LandingFooter, LandingSections } from '@/components/landing/Sections';
import { BrandLockup } from '@/components/strata/BrandLockup';
import { Icon } from '@/components/strata/icons';

/**
 * Landing · the frozen hero (Direction E · Held), then the story below it from #after-hero:
 * exact change, reach, containment, evidence, the closing call to action and the footer.
 * Nav links point only at destinations that exist today. They do not prefetch: prefetching the
 * product routes preloads their stylesheet, which the landing page never applies.
 */
export default function Landing() {
  preload('/landing/e-plate-1920.jpg', { as: 'image', fetchPriority: 'high', media: '(min-width: 761px)' });
  preload('/landing/e-plate-mobile.jpg', { as: 'image', fetchPriority: 'high', media: '(max-width: 760px)' });
  return (
    <>
      {/* sticky shell: transparent at the top (hero unchanged), a quiet bar once scrolled */}
      <div className="lbar-shell">
        <header className="lbar">
          <Link prefetch={false} className="lbrand" href="/" aria-label="Istithbat (استثبات) home">
            <BrandLockup theme="dark" />
          </Link>
          <nav className="lnav" aria-label="Product">
            <Link prefetch={false} href="/overview">Overview</Link>
            <Link prefetch={false} href="/incidents">Incidents</Link>
            <Link prefetch={false} href="/sources">Sources</Link>
          </nav>
          <div className="lbar-r">
            {/* narrow screens only: the product links the pill nav carries on desktop */}
            <details className="lmenu">
              <summary aria-label="Menu"><span aria-hidden="true" /></summary>
              <nav aria-label="Product (menu)">
                <Link prefetch={false} href="/overview">Overview</Link>
                <Link prefetch={false} href="/incidents">Incidents</Link>
                <Link prefetch={false} href="/sources">Sources</Link>
                <Link prefetch={false} href="/sandbox">Run live sandbox</Link>
                <Link prefetch={false} className="lmenu-p" href="/overview">Open Istithbat <Icon name="arrow-up-right" size={15} /></Link>
              </nav>
            </details>
            <Link prefetch={false} className="lbtn lbtn-g lbtn-s" href="/sandbox">Run live sandbox</Link>
            <Link prefetch={false} className="lbtn lbtn-p lbtn-s" href="/overview">Open Istithbat <Icon name="arrow-up-right" size={16} /></Link>
          </div>
        </header>
      </div>
      <main id="main">
        <HeldHero />
        <div id="after-hero" className="lh-after" />
        <LandingSections />
      </main>
      <LandingFooter />
    </>
  );
}
