'use client';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useState, useTransition, type ReactNode } from 'react';
import { LOCALE_COOKIE, LOCALE_STORAGE, makeT, type Locale, type T } from './core';

const Ctx = createContext<{ locale: Locale; t: T; setLocale: (l: Locale) => void; pending: boolean }>({ locale: 'en', t: makeT('en'), setLocale: () => {}, pending: false });
export const useLocale = () => useContext(Ctx);
export const useT = () => useContext(Ctx).t;

/**
 * The language is a non-privileged preference, like the theme: a readable cookie lets the server
 * render the right labels and direction on first paint; the switch refreshes server components.
 */
export function LocaleRoot({ initial, children }: { initial: Locale; children: ReactNode }) {
  const [locale, set] = useState<Locale>(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  const setLocale = useCallback((l: Locale) => {
    set(l);
    try { document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`; } catch { /* cookies blocked */ }
    try { window.localStorage.setItem(LOCALE_STORAGE, l); } catch { /* storage blocked */ }
    start(() => router.refresh());
  }, [router]);
  const t = useMemo(() => makeT(locale), [locale]);
  return <Ctx.Provider value={{ locale, t, setLocale, pending }}>{children}</Ctx.Provider>;
}

/** EN | ع toggle. Each label is in its own language so it is findable from either side. */
export function LangSwitch() {
  const { locale, setLocale, pending } = useLocale();
  return (
    <div className="lsw" role="group" aria-label={locale === 'ar' ? 'اللغة' : 'Language'} aria-busy={pending || undefined}>
      <button type="button" lang="en" aria-pressed={locale === 'en'} onClick={() => setLocale('en')} title="English">EN</button>
      <button type="button" lang="ar" aria-pressed={locale === 'ar'} onClick={() => setLocale('ar')} title="العربية">ع</button>
    </div>
  );
}

/** Translate a plain label from anywhere (server or client tree). Only for literal UI strings. */
export function Tx({ children, vars }: { children: string; vars?: Record<string, string | number> }) {
  return <>{useT()(children, vars)}</>;
}
