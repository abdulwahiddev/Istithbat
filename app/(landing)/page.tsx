import Link from 'next/link';
import { preload } from 'react-dom';
import { HeldHero } from '@/components/landing/HeldHero';

/**
 * Landing · hero only (Direction E · Held). The next landing section attaches at #after-hero.
 * Nav links point only at destinations that exist today. They do not prefetch: prefetching the
 * product routes preloads their stylesheet, which the landing page never applies.
 */
export default function Landing() {
  preload('/landing/e-plate-1920.jpg', { as: 'image', fetchPriority: 'high', media: '(min-width: 761px)' });
  preload('/landing/e-plate-mobile.jpg', { as: 'image', fetchPriority: 'high', media: '(max-width: 760px)' });
  return (
    <>
      <header className="lbar">
        <Link prefetch={false} className="lbrand" href="/" aria-label="Istithbat home">
          <img src="/brand/istithbat-symbol-on-dark.png" width={29} height={32} alt="" />
          <span className="ar-wm" lang="ar">استثبات</span><span className="lat">Istithbat</span>
        </Link>
        <nav className="lnav" aria-label="Product">
          <Link prefetch={false} href="/overview">Overview</Link>
          <Link prefetch={false} href="/incidents">Incidents</Link>
          <Link prefetch={false} href="/sources">Sources</Link>
        </nav>
        <div className="lbar-r">
          <Link prefetch={false} className="lbtn lbtn-g lbtn-s" href="/sandbox">Run live sandbox</Link>
          <Link prefetch={false} className="lbtn lbtn-p lbtn-s" href="/overview">Open Istithbat <span aria-hidden="true">↗</span></Link>
        </div>
      </header>
      <main id="main">
        <HeldHero />
        {/* Continuation point for the next landing section (not built yet). */}
        <div id="after-hero" className="lh-after" />
      </main>
    </>
  );
}
