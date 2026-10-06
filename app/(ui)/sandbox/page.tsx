import { SandboxConsole } from '@/components/sandbox/SandboxConsole';

export const metadata = { title: 'Hadith Evidence Sandbox · Istithbat' };
export const dynamic = 'force-dynamic';

/** The controlled synthetic upstream source, inside the Strata product shell (header, theme, tokens). */
export default function SandboxPage() {
  return <main id="main" className="scr-overview scr-sandbox"><SandboxConsole /></main>;
}
