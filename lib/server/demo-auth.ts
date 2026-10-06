import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
const ttlSeconds = 12 * 60 * 60;
type Mode = 'control' | 'review';
const keyFor = (mode: Mode) => { const value = process.env[mode === 'control' ? 'DEMO_CONTROL_SECRET' : 'DEMO_REVIEW_SECRET']; if (!value) throw new Error(`Missing ${mode} secret`); return value; };
function equal(a: string,b: string) { const left=Buffer.from(a); const right=Buffer.from(b); return left.length===right.length && timingSafeEqual(left,right); }
function mac(value: string,key: string) { return createHmac('sha256',key).update(value).digest('hex'); }
export function validateSecret(mode: Mode, provided: string) { return equal(provided,keyFor(mode)); }
export function reviewUsername() { const username=process.env.DEMO_REVIEW_USERNAME; if (!username) throw new Error('Missing review username'); return username; }
export function validateReviewCredentials(username: string, password: string) {
  const usernameMatches=equal(username,reviewUsername());
  const passwordMatches=equal(password,keyFor('review'));
  return usernameMatches && passwordMatches;
}
export function makeModeCookie(mode: Mode) { const expiry=Date.now()+ttlSeconds*1000; const payload=`${mode}.${expiry}`; return {name:`istithbat_${mode}`,value:`${payload}.${mac(payload,keyFor(mode))}`,options:{httpOnly:true,secure:true,sameSite:'strict' as const,path:'/',maxAge:ttlSeconds}}; }
function validCookie(mode: Mode,value: string | undefined) { if (!value) return false; const [actual, expiry, signature]=value.split('.'); if (actual!==mode || !expiry || !signature || Number(expiry)<Date.now()) return false; return equal(signature,mac(`${actual}.${expiry}`,keyFor(mode))); }
export function requireMode(request: NextRequest, mode: Mode) { if (mode==='review' && !process.env.DEMO_REVIEW_USERNAME) return false; const header=mode==='control' ? request.headers.get('x-demo-control-secret') : null; return (header && validateSecret(mode,header)) || validCookie(mode,request.cookies.get(`istithbat_${mode}`)?.value) ? true : false; }
export const requireControl=(request:NextRequest)=>requireMode(request,'control');
export const requireReview=(request:NextRequest)=>requireMode(request,'review');
