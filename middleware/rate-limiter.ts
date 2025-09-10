import { NextResponse } from 'next/server';

// Simple in-memory rate limiter
const rateLimits = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configuration
const RATE_LIMIT = {
  WINDOW_MS: 60 * 1000, // 1 minute
  MAX_REQUESTS: 60, // Max requests per window
  MESSAGE: 'Too many requests, please try again later.',
};

// Paths to apply rate limiting
const RATE_LIMITED_PATHS = [
  '/api/auth',
  '/api/users',
  '/api/reports',
  // Add other API routes that need rate limiting
];

// Simple in-memory rate limiter middleware
export async function rateLimitMiddleware(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const path = new URL(request.url).pathname;
  
  // Only apply rate limiting to specified paths
  if (!RATE_LIMITED_PATHS.some(p => path.startsWith(p))) {
    return NextResponse.next();
  }

  try {
    const now = Date.now();
    const key = `${ip}:${path}`;
    const rateLimit = rateLimits.get(key);

    // Clean up old rate limits
    rateLimits.forEach((value, key) => {
      if (value.resetTime < now) {
        rateLimits.delete(key);
      }
    });

    if (!rateLimit || rateLimit.resetTime < now) {
      // New rate limit window
      rateLimits.set(key, {
        count: 1,
        resetTime: now + RATE_LIMIT.WINDOW_MS,
      });
    } else {
      // Increment existing rate limit
      rateLimit.count += 1;
      rateLimits.set(key, rateLimit);
    }

    const currentCount = rateLimits.get(key)?.count || 0;
    const resetTime = rateLimits.get(key)?.resetTime || 0;
    const remaining = Math.max(0, RATE_LIMIT.MAX_REQUESTS - currentCount);

    // Set rate limit headers
    const response = currentCount > RATE_LIMIT.MAX_REQUESTS
      ? new NextResponse(RATE_LIMIT.MESSAGE, { status: 429 })
      : NextResponse.next();

    response.headers.set('X-RateLimit-Limit', RATE_LIMIT.MAX_REQUESTS.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', resetTime.toString());

    return response;
  } catch (error) {
    console.error('Rate limiter error:', error);
    // Fail open to avoid blocking traffic
    return NextResponse.next();
  }
}
