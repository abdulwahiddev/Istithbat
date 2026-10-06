import type { ReactNode } from 'react';
import { Amiri, IBM_Plex_Sans_Arabic, Instrument_Sans, JetBrains_Mono, Newsreader } from 'next/font/google';
import { SandboxBar } from '@/components/sandbox/SandboxBar';
import { ThemeRoot } from '@/components/strata/theme';
import { LocaleRoot } from '@/components/strata/i18n/client';
import { GuidedTour, GuidedTourRoot } from '@/components/strata/GuidedTour';
import { guideFrom } from '@/components/strata/guide-data';
import { chromeData } from '../(ui)/_data/chrome';
import { readGatewayInventory, readIncidents, readSources } from '../(ui)/_data/read';
import { readLocale, readTheme } from '../(ui)/_data/session';
import '../(ui)/strata/strata-shared.css';
import '../(ui)/strata/strata-screens.css';
import '../(ui)/strata/strata-app.css';

// Same type roles, tokens and themes as the product, without the product's navigation shell:
// the sandbox is a demo-control surface, not one of the six product screens.
const instrument = Instrument_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-instrument', display: 'swap' });
const newsreader = Newsreader({ subsets: ['latin'], style: ['italic'], axes: ['opsz'], variable: '--font-newsreader', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains', display: 'swap' });
const amiri = Amiri({ subsets: ['arabic', 'latin'], weight: ['400', '700'], variable: '--font-amiri', display: 'swap' });
// Arabic interface face (labels, nav, headings). Arabic subset only and no metric fallback, so Latin
// text keeps Instrument Sans and Amiri stays reserved for Arabic source text.
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '500', '600', '700'], variable: '--font-plex-arabic', display: 'swap', adjustFontFallback: false, fallback: [], preload: false });

export const metadata = {
  title: 'Demo sandbox · Istithbat',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/brand/istithbat-favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/istithbat-favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180' }],
  },
};
export const dynamic = 'force-dynamic';

export default async function SandboxLayout({ children }: { children: ReactNode }) {
  const theme = await readTheme();
  const locale = await readLocale();
  // The same read-only lists the product chrome uses, only to point the walkthrough at the live incident.
  const [incidents, sources, gateway] = await Promise.all([readIncidents(), readSources(), readGatewayInventory()]);
  const guide = guideFrom(chromeData(incidents, sources, gateway, null));
  return (
    <LocaleRoot initial={locale}>
    <ThemeRoot initial={theme} className={`${instrument.variable} ${newsreader.variable} ${jetbrains.variable} ${amiri.variable} ${plexArabic.variable}`}>
      <GuidedTourRoot>
        <a href="#main" className="sr-only">Skip to content</a>
        <SandboxBar />
        {children}
        <GuidedTour data={guide} />
      </GuidedTourRoot>
    </ThemeRoot>
    </LocaleRoot>
  );
}
