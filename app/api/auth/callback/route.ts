import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { event, session } = await req.json()

    // Update or clear the auth cookies based on the auth event
    if (event === 'SIGNED_OUT') {
      await supabase.auth.signOut()
    } else {
      // For SIGNED_IN, TOKEN_REFRESHED, PASSWORD_RECOVERY, etc.
      // The helpers handle setting the proper cookies from the session
      await supabase.auth.setSession(session)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Error in /api/auth/callback:', e)
    return NextResponse.json({ ok: false, error: 'callback_failed' }, { status: 500 })
  }
}
