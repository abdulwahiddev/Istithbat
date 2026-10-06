import type { ReactNode } from 'react';
import { Amiri, Instrument_Sans, JetBrains_Mono, Newsreader } from 'next/font/google';
import { SandboxBar } from '@/components/sandbox/SandboxBar';
import { ThemeRoot } from '@/components/strata/theme';
import { readTheme } from '../(ui)/_data/session';
import '../(ui)/strata/strata-shared.css';
import '../(ui)/strata/strata-screens.css';
import '../(ui)/strata/strata-app.css';

// Same type roles, tokens and themes as the product, without the product's navigation shell:
// the sandbox is a demo-control surface, not one of the six product screens.
const instrument = Instrument_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-instrument', display: 'swap' });
const newsreader = Newsreader({ subsets: ['latin'], style: ['italic'], axes: ['opsz'], variable: '--font-newsreader', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains', display: 'swap' });
const amiri = Amiri({ subsets: ['arabic', 'latin'], weight: ['400', '700'], variable: '--font-amiri', display: 'swap' });

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
  return (
    <ThemeRoot initial={theme} className={`${instrument.variable} ${newsreader.variable} ${jetbrains.variable} ${amiri.variable}`}>
      <a href="#main" className="sr-only">Skip to content</a>
      <SandboxBar />
      {children}
    </ThemeRoot>
  );
}
