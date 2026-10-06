import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
const ttlSeconds = 12 * 60 * 60;
type Mode = 'control' | 'sandbox' | 'review' | 'review_preview';
const secretName: Record<Mode, string> = { control: 'DEMO_CONTROL_SECRET', sandbox: 'DEMO_SANDBOX_SECRET', review: 'DEMO_REVIEW_SECRET', review_preview: 'DEMO_REVIEW_PREVIEW_SECRET' };
const keyFor = (mode: Mode) => { const value = process.env[secretName[mode]]; if (!value) throw new Error(`Missing ${secretName[mode]}`); return value; };
function equal(a: string,b: string) { const left=Buffer.from(a); const right=Buffer.from(b); return left.length===right.length && timingSafeEqual(left,right); }
function mac(value: string,key: string) { return createHmac('sha256',key).update(value).digest('hex'); }
export function validateSecret(mode: Mode, provided: string) { return equal(provided,keyFor(mode)); }
export function reviewUsername() { const username=process.env.DEMO_REVIEW_USERNAME; if (!username) throw new Error('Missing review username'); return username; }
export function validateReviewCredentials(username: string, password: string) {
  const usernameMatches=equal(username,reviewUsername());
  const passwordMatches=equal(password,keyFor('review'));
  return usernameMatches && passwordMatches;
}
export function reviewPreviewUsername() { const username=process.env.DEMO_REVIEW_PREVIEW_USERNAME; if (!username) throw new Error('Missing preview username'); return username; }
export function validateReviewPreviewCredentials(username: string, password: string) { return equal(username,reviewPreviewUsername()) && equal(password,keyFor('review_preview')); }
export function makeModeCookie(mode: Mode) { const expiry=Date.now()+ttlSeconds*1000; const payload=`${mode}.${expiry}`; return {name:`istithbat_${mode}`,value:`${payload}.${mac(payload,keyFor(mode))}`,options:{httpOnly:true,secure:true,sameSite:'strict' as const,path:'/',maxAge:ttlSeconds}}; }
function validCookie(mode: Mode,value: string | undefined) { if (!value) return false; const [actual, expiry, signature]=value.split('.'); if (value.split('.').length!==3 || actual!==mode || !expiry || !signature || !Number.isFinite(Number(expiry)) || Number(expiry)<Date.now()) return false; return equal(signature,mac(`${actual}.${expiry}`,keyFor(mode))); }
export function requireMode(request: NextRequest, mode: Mode) { if (!process.env[secretName[mode]]) return false; if (mode==='review' && !process.env.DEMO_REVIEW_USERNAME) return false; if (mode==='review_preview' && !process.env.DEMO_REVIEW_PREVIEW_USERNAME) return false; const header=mode==='control' ? request.headers.get('x-demo-control-secret') : null; return (header && validateSecret(mode,header)) || validCookie(mode,request.cookies.get(`istithbat_${mode}`)?.value) ? true : false; }
export const requireControl=(request:NextRequest)=>requireMode(request,'control');
export const requireSandbox=(request:NextRequest)=>requireMode(request,'sandbox');
export const requireReview=(request:NextRequest)=>requireMode(request,'review');
export const requireReviewPreview=(request:NextRequest)=>requireMode(request,'review_preview');
