import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { securityHeadersMiddleware } from './middleware/security-headers';
import { rateLimitMiddleware } from './middleware/rate-limiter';

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  // Apply security headers to all responses
  const response = securityHeadersMiddleware(request);
  
  // Apply rate limiting to API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    const rateLimitedResponse = await rateLimitMiddleware(request);
    if (rateLimitedResponse.status === 429) {
      return rateLimitedResponse;
    }
  }
  
  return response;
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
