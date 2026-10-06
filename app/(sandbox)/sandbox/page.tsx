import { SandboxConsole } from '@/components/sandbox/SandboxConsole';
import { sandboxScenario } from './scenario';

export const metadata = { title: 'Demo sandbox · Istithbat' };
export const dynamic = 'force-dynamic';

/** Demo-control surface for the controlled test. Same app and backend; no product navigation. */
export default function SandboxPage() {
  return <main id="main" className="scr-overview scr-sandbox"><SandboxConsole scenario={sandboxScenario()} /></main>;
}
