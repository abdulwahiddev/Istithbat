import type { ReactNode } from 'react';
import { Amiri, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import './landing.css';

// Landing type roles match the product: Instrument Sans for UI, JetBrains Mono only for versions,
// hashes and IDs, Amiri for Arabic source text.
const instrument = Instrument_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-instrument', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains', display: 'swap' });
const amiri = Amiri({ subsets: ['arabic', 'latin'], weight: ['400', '700'], variable: '--font-amiri', display: 'swap' });

export const metadata = {
  title: 'Istithbat · Know when trusted knowledge changes',
  description: 'Istithbat detects source changes, tests their effect on AI answers, and keeps unreviewed knowledge out of production.',
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
export const viewport = { themeColor: '#08090B', colorScheme: 'dark' };

export default function LandingLayout({ children }: { children: ReactNode }) {
  return <div className={`lnd ${instrument.variable} ${jetbrains.variable} ${amiri.variable}`}>{children}</div>;
}
