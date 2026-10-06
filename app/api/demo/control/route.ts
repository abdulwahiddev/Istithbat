import { NextRequest, NextResponse } from 'next/server';
import { makeModeCookie, requireSandbox, validateSecret } from '@/lib/server/demo-auth';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: requireSandbox(request), configured: Boolean(process.env.DEMO_SANDBOX_SECRET) }, {headers:{'cache-control':'no-store'}});
}
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({error:{code:'INVALID_ORIGIN',message:'Open demo control on this site.'}},{status:403});
  if (!process.env.DEMO_SANDBOX_SECRET) return NextResponse.json({error:{code:'NOT_CONFIGURED',message:'Sandbox control is not configured.'}},{status:503});
  const body = await request.json().catch(() => null);
  if (typeof body?.password !== 'string' || !validateSecret('sandbox',body.password)) return NextResponse.json({error:{code:'UNAUTHORIZED',message:'Sandbox credential was not accepted.'}},{status:401});
  const cookie = makeModeCookie('sandbox');
  const response = NextResponse.json({authenticated:true});
  response.cookies.set(cookie.name,cookie.value,cookie.options);
  return response;
}
export async function DELETE(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({error:{code:'INVALID_ORIGIN',message:'Open demo control on this site.'}},{status:403});
  const response = NextResponse.json({authenticated:false});
  response.cookies.delete('istithbat_sandbox');
  return response;
}
