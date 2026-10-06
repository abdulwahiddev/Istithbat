import type { CSSProperties, ReactNode } from 'react';
// The app's own stylesheets, imported verbatim (frozen Strata tokens + screen rules).
import '@/app/(ui)/strata/strata-shared.css';
import '@/app/(ui)/strata/strata-screens.css';
import '@/app/(ui)/strata/strata-app.css';
import './video-overrides.css';
import '../brand';

/**
 * Hosts real product components in the product's Hybrid Dark theme (`.s.dark`, identical markup to
 * the app). CSS keyframes are switched off exactly as the product's own reduced-motion rule does, so
 * every component renders its settled, true state; all motion is then driven by Remotion frames.
 */
export function ProductRoot({ children, style, className = '' }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return <div className={`s dark vid ${className}`} style={style}>{children}</div>;
}
