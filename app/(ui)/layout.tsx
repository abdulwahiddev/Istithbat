import type { ReactNode } from 'react';
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Arabic, Noto_Naskh_Arabic } from 'next/font/google';
import { AppShell } from '@/components/shell/AppShell';
import { readAiConfig } from '@/lib/ai/config';
import './istithbat.css';

// Four faces, four jobs (Design System §03): Plex Sans for UI, Plex Sans Arabic for Arabic UI,
// Plex Mono for hashes/IDs/versions only, Noto Naskh Arabic for quoting source text only.
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-sans', display: 'swap' });
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '500', '600'], variable: '--font-plex-arabic', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });
const naskh = Noto_Naskh_Arabic({ subsets: ['arabic'], weight: ['400', '500'], variable: '--font-naskh', display: 'swap' });

export const metadata = {
  title: 'Istithbat | استثبات',
  description: 'Integrity and release governance for trusted Islamic knowledge in AI systems.',
  icons: { icon: '/brand/istithbat-icon.png' },
};

export default function UiLayout({ children }: { children: ReactNode }) {
  // Only the mode is read here (server-side); no provider credential reaches the client.
  const mode = readAiConfig().mode;
  return (
    <div className={`ist-fonts ${plexSans.variable} ${plexArabic.variable} ${plexMono.variable} ${naskh.variable}`}>
      <AppShell
        aiModeLabel={
          <span className="ist-badge ist-badge--muted" title="Server AI_MODE: live, mock (canned, for tests) or replay (recorded, always labelled)">
            AI mode: {mode}
          </span>
        }
      >{children}</AppShell>
    </div>
  );
}
