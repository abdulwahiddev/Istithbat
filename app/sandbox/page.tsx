import { Instrument_Sans, Amiri } from 'next/font/google';
import { SandboxConsole } from './SandboxConsole';
import './sandbox.css';
const sans=Instrument_Sans({subsets:['latin'],weight:['400','500','600','700'],display:'swap',variable:'--font-instrument'});
const arabic=Amiri({subsets:['arabic','latin'],weight:['400','700'],display:'swap',variable:'--font-amiri'});
export const metadata={title:'Hadith Evidence Sandbox | Istithbat'};
export default function SandboxPage() {
  return <main className={`sandbox ${sans.variable} ${arabic.variable}`}><SandboxConsole /></main>;
}
