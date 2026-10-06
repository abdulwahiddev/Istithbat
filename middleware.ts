import { NextResponse, type NextRequest } from 'next/server';

// The UI layout validates dynamic pages before any route loading skeleton streams.
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set('x-istithbat-route', request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/incidents/:path*', '/sources/:path*', '/gateway/:path*'],
};
