import { AR } from './ar';
import { RULES } from './rules';

/**
 * UI-label translation only. Keys are the exact English strings the UI already renders, so English
 * output is byte-identical (t returns its input) and a missing Arabic entry falls back to English
 * instead of breaking. Never pass source evidence, record text, hashes, versions, IDs or policy
 * codes through t(): those stay canonical.
 */
export type Locale = 'en' | 'ar';
export const LOCALE_COOKIE = 'istithbat_lang';
export const LOCALE_STORAGE = 'istithbat.lang';
export const dirOf = (l: Locale) => (l === 'ar' ? 'rtl' : 'ltr');
export type Vars = Record<string, string | number>;
export type T = (en: string, vars?: Vars) => string;

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s);

export function makeT(locale: Locale): T {
  if (locale !== 'ar') return (en, vars) => fill(en, vars);
  const tr = (en: string): string => {
    const hit = AR[en];
    if (hit !== undefined) return hit;
    for (const [re, fn] of RULES) { const m = en.match(re); if (m) return fn(m, tr); }
    // "A · B · C" facts: translate each part on its own; untranslatable parts stay as they are.
    if (en.includes(' · ')) { const parts = en.split(' · '); const out = parts.map(tr); if (out.some((x, i) => x !== parts[i])) return out.join(' · '); }
    return en;
  };
  return (en, vars) => fill(tr(en), vars);
}
export const parseLocale = (v: string | undefined | null): Locale => (v === 'ar' ? 'ar' : 'en');
