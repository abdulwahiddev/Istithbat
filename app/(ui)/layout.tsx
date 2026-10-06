import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Amiri, Instrument_Sans, JetBrains_Mono, Newsreader } from 'next/font/google';
import { AutoRefresh } from '@/components/strata/AutoRefresh';
import { Chrome } from '@/components/strata/Chrome';
import { ThemeRoot } from '@/components/strata/theme';
import { LocaleRoot } from '@/components/strata/i18n/client';
import { GuidedTour, GuidedTourRoot } from '@/components/strata/GuidedTour';
import { guideFrom } from '@/components/strata/guide-data';
import { lockReviewer, unlockReviewer } from './_actions/reviewer';
import { chromeData } from './_data/chrome';
import { readGatewayInventory, readIncidents, readSources } from './_data/read';
import { readLocale, readReviewer, readTheme } from './_data/session';
import './strata/strata-shared.css';
import './strata/strata-screens.css';
import './strata/strata-app.css';

// Strata type roles (handoff §5): Instrument Sans for UI, Newsreader italic only for the AI's own
// statement, JetBrains Mono only for hashes / IDs / versions, Amiri for Arabic source text.
const instrument = Instrument_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-instrument', display: 'swap' });
const newsreader = Newsreader({ subsets: ['latin'], style: ['italic'], axes: ['opsz'], variable: '--font-newsreader', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains', display: 'swap' });
const amiri = Amiri({ subsets: ['arabic', 'latin'], weight: ['400', '700'], variable: '--font-amiri', display: 'swap' });

export const metadata = {
  title: 'Istithbat | استثبات',
  description: 'Integrity and release governance for trusted Islamic knowledge in AI systems.',
  // Official mark, transparent (no tile) in the browser: ICO for Safari/legacy, PNGs, and an SVG that
  // swaps to the white-chevron variant in dark browser chrome. Only the iOS touch icon keeps the navy
  // tile, because iOS requires an opaque icon.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/brand/istithbat-favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/istithbat-favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/istithbat-favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180' }],
  },
};
export const dynamic = 'force-dynamic';

export default async function StrataLayout({ children }: { children: ReactNode }) {
  const route = (await headers()).get('x-istithbat-route');
  const theme = await readTheme();
  const locale = await readLocale();
  const reviewer = await readReviewer();
  const incidents = await readIncidents();
  const sources = await readSources();
  const gateway = await readGatewayInventory();
  // Chrome already needs these lists; checking here adds no database read.
  // A page-level notFound() runs too late once loading.tsx has streamed HTTP 200.
  if (route) {
    const parts = route.split('/').filter(Boolean);
    if (parts.length >= 2) {
      let id: string;
      try { id = decodeURIComponent(parts[1]); } catch { notFound(); }
      if (parts[0] === 'incidents' && incidents.ok && !incidents.data.some(item => item.id === id)) notFound();
      if (parts[0] === 'sources' && sources.ok && !sources.data.some(item => item.id === id)) notFound();
      if (parts[0] === 'gateway' && gateway.ok && !gateway.data.some(item => item.appId === id && item.binding)) notFound();
    }
  }
  const chrome = chromeData(incidents, sources, gateway, reviewer);
  return (
    <LocaleRoot initial={locale}>
    <ThemeRoot initial={theme} className={`${instrument.variable} ${newsreader.variable} ${jetbrains.variable} ${amiri.variable}`}>
      <GuidedTourRoot>
        <a href="#main" className="sr-only">Skip to content</a>
        <Chrome data={chrome} actions={{ unlock: unlockReviewer, lock: lockReviewer }} />
        <AutoRefresh active={incidents.ok && incidents.data.some(i => i.pipelineStatus === 'RUNNING')} />
        {children}
        <GuidedTour data={guideFrom(chrome)} />
      </GuidedTourRoot>
    </ThemeRoot>
    </LocaleRoot>
  );
}
