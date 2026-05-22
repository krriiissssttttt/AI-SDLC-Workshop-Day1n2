import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const protectedPaths = ['/', '/calendar'];

function getJwtSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return null;
  }

  return new TextEncoder().encode(secret);
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('session')?.value;
  if (!token) {
    return false;
  }

  const secret = getJwtSecret();
  if (!secret) {
    return false;
  }

  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isLoginRoute = pathname === '/login' || pathname.startsWith('/login/');
  const validSession = await hasValidSession(request);

  if (isLoginRoute && validSession) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!needsAuth) {
    return NextResponse.next();
  }

  if (validSession) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/', '/calendar/:path*', '/login/:path*'],
};
