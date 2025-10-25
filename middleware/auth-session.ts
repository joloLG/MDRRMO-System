import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

// Edge runtime: use Web Crypto API
const sha256Hex = async (text: string): Promise<string> => {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

const ADMIN_PREFIXES = ['/admin'];
const HOSPITAL_PREFIXES = ['/hospital'];
const PROTECTED_PREFIXES = [...ADMIN_PREFIXES, ...HOSPITAL_PREFIXES];

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
  const isAdminRoute = ADMIN_PREFIXES.some((p) => path.startsWith(p));
  const isHospitalRoute = HOSPITAL_PREFIXES.some((p) => path.startsWith(p));
  if (isProtected) {
    if (error || !session) {
      const redirectUrl = new URL('/', request.url);
      return NextResponse.redirect(redirectUrl);
    }

    try {
      // Use service role client to bypass RLS for role checking
      const { createClient } = require('@supabase/supabase-js');
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: userProfile, error: roleError } = await serviceClient
        .from('users')
        .select('user_type')
        .eq('id', session.user.id)
        .single();

      if (!userProfile || roleError) {
        const redirectUrl = new URL('/', request.url);
        return NextResponse.redirect(redirectUrl);
      }

      if (isAdminRoute && !['admin', 'superadmin'].includes(userProfile.user_type)) {
        const redirectUrl = new URL('/', request.url);
        return NextResponse.redirect(redirectUrl);
      }

      if (isHospitalRoute && userProfile.user_type !== 'hospital') {
        const redirectUrl = new URL('/', request.url);
        return NextResponse.redirect(redirectUrl);
      }

      // Single-session enforcement removed for login simplicity
    } catch (e) {
      const redirectUrl = new URL('/', request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}
