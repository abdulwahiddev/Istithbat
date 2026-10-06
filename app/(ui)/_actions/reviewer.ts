'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { makeModeCookie, validateSecret } from '@/lib/server/demo-auth';
import { REVIEWER_NAME_COOKIE } from '../_data/session';

/**
 * D-11 reviewer mode. The secret is checked on the server with the timing-safe helper and never
 * returned or stored client-side; the review credential is the httpOnly, HMAC-signed cookie that
 * lib/server/demo-auth issues. The reviewer's display name is a separate httpOnly cookie used only
 * to label the signature (the review route records it as `reviewer`).
 */
export type UnlockState = { ok: boolean; error?: string };

export async function unlockReviewer(_prev: UnlockState, form: FormData): Promise<UnlockState> {
  const secret = String(form.get('secret') ?? '');
  const name = String(form.get('name') ?? '').trim().slice(0, 60);
  if (!name) return { ok: false, error: 'Enter the name to sign with.' };
  let valid = false;
  try { valid = secret.length > 0 && validateSecret('review', secret); } catch { return { ok: false, error: 'Reviewer mode is not configured on this server.' }; }
  if (!valid) return { ok: false, error: 'That review credential was not accepted.' };
  const jar = await cookies();
  const c = makeModeCookie('review');
  jar.set(c.name, c.value, c.options);
  jar.set(REVIEWER_NAME_COOKIE, name, { ...c.options });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function lockReviewer(): Promise<void> {
  const jar = await cookies();
  jar.delete('istithbat_review');
  jar.delete(REVIEWER_NAME_COOKIE);
  revalidatePath('/', 'layout');
}
