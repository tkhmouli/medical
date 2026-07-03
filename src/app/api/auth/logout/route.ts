import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';

/**
 * POST /api/auth/logout — Clear session cookie and redirect to login.
 */
export async function POST(request: NextRequest) {
  const url = new URL('/login', request.url);

  const response = NextResponse.redirect(url);

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
