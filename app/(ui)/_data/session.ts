import 'server-only';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { requireReview, requireReviewPreview, reviewUsername, reviewPreviewUsername } from '@/lib/server/demo-auth';
import type { Theme } from '@/components/strata/theme';
import { LOCALE_COOKIE, makeT, parseLocale, type Locale, type T } from '@/components/strata/i18n/core';

/** The signed-in reviewer, only when the httpOnly review cookie verifies (D-11). */
export async function readReviewer(): Promise<{ name: string; canSign: boolean } | null> {
  const jar = await cookies();
  let signer = false;
  let preview = false;
  const request = { headers: { get: () => null }, cookies: { get: (n: string) => jar.get(n) } } as unknown as NextRequest;
  try {
    signer = requireReview(request);
    preview = !signer && requireReviewPreview(request);
  } catch { return null; }
  if (signer) return { name: reviewUsername(), canSign: true };
  if (preview) return { name: reviewPreviewUsername(), canSign: false };
  return null;
}

export async function readTheme(): Promise<Theme> {
  return (await cookies()).get('istithbat_theme')?.value === 'dark' ? 'dark' : 'light';
}

/** UI language preference (non-privileged, like the theme). */
export async function readLocale(): Promise<Locale> {
  return parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}
/** Server-side label translator for the current request. */
export async function getT(): Promise<T> {
  return makeT(await readLocale());
}
