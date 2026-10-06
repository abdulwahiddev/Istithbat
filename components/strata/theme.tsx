'use client';
import { Icon } from './icons';
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
        <Icon name="sun" size={18} />
      </button>
      <button type="button" aria-pressed={theme === 'dark'} aria-label="Dark theme" title="Dark" onClick={() => setTheme('dark')}>
        <Icon name="moon" size={17} />
      </button>
    </div>
  );
}
