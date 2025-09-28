import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

const PROTECTED_PREFIXES = ['/admin'];

const PUBLIC_PREFIXES = [
  '/_next',
  '/favicon.ico',
  '/public',
  '/auth',
  '/hotlines',
  '/mdrrmo-info',
  '/api', 
];

export async function authSessionMiddleware(request: NextRequest, response: NextResponse): Promise<NextResponse> {
  const url = new URL(request.url);
  const path = url.pathname;

  // In development, do not gate admin routes to prevent redirect loops during auth setup
  if (process.env.NODE_ENV !== 'production') {
    return response;
  }

  if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) {
    return response;
  }
  const supabase = createMiddlewareClient({ req: request, res: response });
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  if (isProtected) {
    if (error || !session) {
      const redirectUrl = new URL('/', request.url);
      return NextResponse.redirect(redirectUrl);
    }

    try {
      const { data: userProfile, error: roleError } = await supabase
        .from('users')
        .select('user_type')
        .eq('id', session.user.id)
        .single();

      if (!userProfile || roleError) {
        const redirectUrl = new URL('/', request.url);
        return NextResponse.redirect(redirectUrl);
      }

      if (!['admin', 'superadmin'].includes(userProfile.user_type)) {
        const redirectUrl = new URL('/', request.url);
        return NextResponse.redirect(redirectUrl);
      }
    } catch (e) {
      const redirectUrl = new URL('/', request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}
