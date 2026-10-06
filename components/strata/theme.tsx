'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/**
 * Light Strata is the default; Hybrid Dark is the same markup with `.dark` on the root.
 * The choice is a non-privileged preference: a readable cookie lets the server render the right
 * root class (no flash before first paint) and localStorage mirrors it (handoff §3). The OS
 * colour-scheme preference is deliberately ignored.
 */
export type Theme = 'light' | 'dark';
export const THEME_COOKIE = 'istithbat_theme';
export const THEME_STORAGE = 'istithbat.theme';

const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({ theme: 'light', setTheme: () => {} });
export const useTheme = () => useContext(Ctx);

export function ThemeRoot({ initial, className, children }: { initial: Theme; className: string; children: ReactNode }) {
  const [theme, set] = useState<Theme>(initial);
  const setTheme = useCallback((t: Theme) => {
    set(t);
    try { document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`; } catch { /* cookies blocked: in-memory only */ }
    try { window.localStorage.setItem(THEME_STORAGE, t); } catch { /* storage blocked: cookie still applies */ }
  }, []);
  return (
    <Ctx.Provider value={{ theme, setTheme }}>
      <div className={`s${theme === 'dark' ? ' dark' : ''} ${className}`}>{children}</div>
    </Ctx.Provider>
  );
}

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="tsw" role="group" aria-label="Theme" data-theme={theme}>
      <span className="tsw-ind" aria-hidden="true" />
      <button type="button" aria-pressed={theme === 'light'} aria-label="Light theme" title="Light" onClick={() => setTheme('light')}>
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="10" cy="10" r="3.4" /><path d="M10 2.6v1.7M10 15.7v1.7M2.6 10h1.7M15.7 10h1.7M4.8 4.8l1.2 1.2M14 14l1.2 1.2M4.8 15.2L6 14M14 6l1.2-1.2" /></svg>
      </button>
      <button type="button" aria-pressed={theme === 'dark'} aria-label="Dark theme" title="Dark" onClick={() => setTheme('dark')}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M16.2 12.4A6.6 6.6 0 017.6 3.8a6.6 6.6 0 108.6 8.6z" /></svg>
      </button>
    </div>
  );
}
