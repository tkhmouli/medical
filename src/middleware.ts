import { NextRequest, NextResponse } from 'next/server';

/**
 * Extracts the subdomain from a host string.
 * For "demo.localhost:3001" returns "demo".
 * For "clinic1.example.com" returns "clinic1".
 * Returns null if there's no subdomain.
 */
function extractSubdomain(host: string): string | null {
  const hostWithoutPort = host.split(':')[0];

  // Handle *.localhost pattern (e.g. demo.localhost)
  if (hostWithoutPort.endsWith('.localhost')) {
    const sub = hostWithoutPort.replace('.localhost', '');
    return sub || null;
  }

  const parts = hostWithoutPort.split('.');

  // Need at least 3 parts for a subdomain (sub.domain.tld)
  if (parts.length < 3) {
    return null;
  }

  return parts[0];
}

/**
 * Middleware resolves tenant subdomain and passes it to API routes via headers.
 * The actual DB lookup is done in API route handlers (Node.js runtime),
 * not here (Edge runtime can't use `pg`).
 */
export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const { pathname } = request.nextUrl;

  // Skip for health check
  if (pathname === '/api/health') {
    return NextResponse.next();
  }

  // Skip for bare hostnames with no dots (e.g. "localhost")
  if (!host.includes('.')) {
    return NextResponse.next();
  }

  const subdomain = extractSubdomain(host);

  // If no subdomain, let the request through without tenant context
  if (!subdomain) {
    return NextResponse.next();
  }

  // Pass the subdomain to API routes via header — they will resolve it to a tenant ID
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-subdomain', subdomain);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
