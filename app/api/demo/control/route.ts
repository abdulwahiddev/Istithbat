import { NextRequest, NextResponse } from 'next/server';
import { makeModeCookie, requireControl, validateSecret } from '@/lib/server/demo-auth';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: requireControl(request), configured: Boolean(process.env.DEMO_CONTROL_SECRET) }, {headers:{'cache-control':'no-store'}});
}
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({error:{code:'INVALID_ORIGIN',message:'Open demo control on this site.'}},{status:403});
  if (!process.env.DEMO_CONTROL_SECRET) return NextResponse.json({error:{code:'NOT_CONFIGURED',message:'Demo control is not configured.'}},{status:503});
  const body = await request.json().catch(() => null);
  if (typeof body?.password !== 'string' || !validateSecret('control',body.password)) return NextResponse.json({error:{code:'UNAUTHORIZED',message:'Control credential was not accepted.'}},{status:401});
  const cookie = makeModeCookie('control');
  const response = NextResponse.json({authenticated:true});
  response.cookies.set(cookie.name,cookie.value,cookie.options);
  return response;
}
export async function DELETE(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({error:{code:'INVALID_ORIGIN',message:'Open demo control on this site.'}},{status:403});
  const response = NextResponse.json({authenticated:false});
  response.cookies.delete('istithbat_control');
  return response;
}
