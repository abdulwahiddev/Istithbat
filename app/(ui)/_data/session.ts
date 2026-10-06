import 'server-only';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { requireReview, reviewUsername } from '@/lib/server/demo-auth';
import type { Theme } from '@/components/strata/theme';

/** The signed-in reviewer, only when the httpOnly review cookie verifies (D-11). */
export async function readReviewer(): Promise<{ name: string } | null> {
  const jar = await cookies();
  let ok = false;
  try {
    // requireReview reads only these two accessors; the cookie is verified by Codex's HMAC check.
    ok = requireReview({ headers: { get: () => null }, cookies: { get: (n: string) => jar.get(n) } } as unknown as NextRequest);
  } catch { ok = false; }
  if (!ok) return null;
  return { name: reviewUsername() };
}

export async function readTheme(): Promise<Theme> {
  return (await cookies()).get('istithbat_theme')?.value === 'dark' ? 'dark' : 'light';
}
