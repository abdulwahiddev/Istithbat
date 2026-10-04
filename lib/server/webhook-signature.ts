import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
function secret() { const key=process.env.DEMO_WEBHOOK_SECRET; if (!key) throw new Error('DEMO_WEBHOOK_SECRET required'); return key; }
export function signWebhook(body: string) { return `sha256=${createHmac('sha256',secret()).update(body).digest('hex')}`; }
export function verifyWebhook(body: string, signature: string | null) { if (!signature) return false; const expected=Buffer.from(signWebhook(body)); const actual=Buffer.from(signature); return expected.length===actual.length && timingSafeEqual(expected,actual); }
