import type { ReactNode } from 'react';
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
  icons: { icon: '/brand/istithbat-icon.png' },
};
export const dynamic = 'force-dynamic';

export default async function StrataLayout({ children }: { children: ReactNode }) {
  const theme = await readTheme();
  const reviewer = await readReviewer();
  const incidents = await readIncidents();
  const sources = await readSources();
  const gateway = await readGatewayInventory();
  return (
    <ThemeRoot initial={theme} className={`${instrument.variable} ${newsreader.variable} ${jetbrains.variable} ${amiri.variable}`}>
      <a href="#main" className="sr-only">Skip to content</a>
      <Chrome data={chromeData(incidents, sources, gateway, reviewer)} actions={{ unlock: unlockReviewer, lock: lockReviewer }} />
      {children}
    </ThemeRoot>
  );
}
