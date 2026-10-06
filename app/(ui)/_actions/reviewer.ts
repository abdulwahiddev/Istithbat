'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { makeModeCookie, validateReviewCredentials } from '@/lib/server/demo-auth';

/**
 * D-11 reviewer mode. Both fields are checked on the server. The session is the existing
 * httpOnly, HMAC-signed cookie; credentials are never returned or stored client-side.
 */
export type UnlockState = { ok: boolean; error?: string };

export async function unlockReviewer(_prev: UnlockState, form: FormData): Promise<UnlockState> {
  const username = String(form.get('username') ?? '');
  const password = String(form.get('password') ?? '');
  let valid = false;
  try { valid = validateReviewCredentials(username, password); } catch { return { ok: false, error: 'Reviewer mode is not configured on this server.' }; }
  if (!valid) return { ok: false, error: 'Username or password was not accepted.' };
  const jar = await cookies();
  const c = makeModeCookie('review');
  jar.set(c.name, c.value, c.options);
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function lockReviewer(): Promise<void> {
  const jar = await cookies();
  jar.delete('istithbat_review');
  jar.delete('istithbat_reviewer'); // Remove the legacy unsigned display-name cookie.
  revalidatePath('/', 'layout');
}
