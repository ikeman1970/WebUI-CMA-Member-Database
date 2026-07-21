import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/dashboard') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/regions';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard']
};
