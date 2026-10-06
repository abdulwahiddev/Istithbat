// Istithbat brand tokens, copied verbatim from the landing (app/(landing)/landing.css, scope .lnd,
// "Direction E · Held", Strata Hybrid Dark accents on the near-black ground). Do not invent new ones.
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/instrument-sans/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/amiri/400.css';
import '@fontsource/amiri/700.css';

export const C = {
  ground: '#08090B', well: '#0C0D10', plateA: '#111317', floatBg: '#121418', chipBg: '#15171B',
  chipLine: 'rgba(240,242,246,.11)',
  ink: '#F4F5F7', ink2: '#D5D8DE', ink3: '#A3A8B2', ink4: '#7F848E',
  line: 'rgba(240,242,246,.08)', line2: 'rgba(240,242,246,.15)', hover: 'rgba(240,242,246,.06)',
  glass: 'linear-gradient(180deg,rgba(240,242,246,.08),rgba(240,242,246,.03))', glassLine: 'rgba(240,242,246,.10)',
  glassHi: 'inset 0 1px 0 rgba(230,236,255,.12),inset 0 -1px 0 rgba(0,0,0,.35)',
  floatShadow: 'inset 0 1px 0 rgba(255,255,255,.04),0 18px 36px -18px rgba(0,0,0,.9)',
  tq: '#22D3C5', tqSoft: 'rgba(34,211,197,.14)',
  co: '#FF6B5E', coInk: '#FF9488',
  pu: '#8B5CF6', puInk: '#BBA6FF', puLine: 'rgba(139,92,246,.5)',
  am: '#F2B544', amInk: '#F2C46A', amSoft: 'rgba(242,181,68,.11)',
  // the cream of the trust-stack plate (landing coded fallback, components/landing/HeldHero.tsx)
  cream: '#E6E3DD',
} as const;

export const F = {
  sans: "'Instrument Sans', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
  ar: "'Amiri', serif",
} as const;

// Landing --ease: cubic-bezier(.2,.8,.2,1)
export const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

// Strata layer marks (components/strata/icons.tsx): source=database, deterministic=fingerprint,
// AI=sparkles, policy=scale, human=user-check; coloured as on the landing (.lm-*).
export const LAYER = {
  src: { icon: 'database', color: C.ink2 },
  det: { icon: 'fingerprint-pattern', color: C.tq },
  ai: { icon: 'sparkles', color: C.puInk },
  pol: { icon: 'scale', color: C.ink2 },
  hum: { icon: 'user-check', color: C.ink },
} as const;
export type Layer = keyof typeof LAYER;
