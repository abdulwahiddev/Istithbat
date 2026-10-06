import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Amiri, Instrument_Sans, JetBrains_Mono, Newsreader } from 'next/font/google';
import { Chrome } from '@/components/strata/Chrome';
import { ThemeRoot } from '@/components/strata/theme';
import { lockReviewer, unlockReviewer } from './_actions/reviewer';
import { chromeData } from './_data/chrome';
import { readGatewayInventory, readIncidents, readSources } from './_data/read';
import { readReviewer, readTheme } from './_data/session';
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
  // Official identity (Istithbat Brand.png): the symbol on the Midnight Navy app tile.
  icons: {
    icon: [
      { url: '/brand/istithbat-favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/istithbat-favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/brand/istithbat-app-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180' }],
  },
};
export const dynamic = 'force-dynamic';

export default async function StrataLayout({ children }: { children: ReactNode }) {
  const route = (await headers()).get('x-istithbat-route');
  const theme = await readTheme();
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
  return (
    <ThemeRoot initial={theme} className={`${instrument.variable} ${newsreader.variable} ${jetbrains.variable} ${amiri.variable}`}>
      <a href="#main" className="sr-only">Skip to content</a>
      <Chrome data={chromeData(incidents, sources, gateway, reviewer)} actions={{ unlock: unlockReviewer, lock: lockReviewer }} />
      {children}
    </ThemeRoot>
  );
}
