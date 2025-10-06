import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { event, session } = await req.json()

    const sha256Hex = (input: string) =>
      crypto.createHash('sha256').update(input).digest('hex')

    // Service role client for DB updates (bypass RLS). Requires server-side secret.
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin = SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false }
        })
      : null

    // Consider a lock stale after this many milliseconds
    const STALE_TTL_MS = 5 * 60 * 1000 // 5 minutes

    // Helper to upsert active session hash for admin-like users
    const upsertActiveSession = async () => {
      try {
        const userId = session?.user?.id
        const refreshToken: string | undefined = session?.refresh_token
        if (!userId || !refreshToken) return { ok: true }

        // Read profile with admin client if available to avoid RLS hiccups
        const { data: profile, error: profileError } = admin
          ? await admin.from('users')
              .select('user_type, active_session_token_hash, active_session_set_at')
              .eq('id', userId)
              .single()
          : await supabase
              .from('users')
              .select('user_type, active_session_token_hash, active_session_set_at')
              .eq('id', userId)
              .single()

        if (profileError || !profile) return { ok: true } // If profile not found, do nothing

        const isAdmin = ['admin', 'superadmin'].includes(profile.user_type)
        if (!isAdmin) return { ok: true }

        const currentHash = sha256Hex(refreshToken)

        // If there is a different active session, reject this one
        if (
          profile.active_session_token_hash &&
          profile.active_session_token_hash !== currentHash
        ) {
          // Allow takeover if the existing lock appears stale
          const setAt = profile.active_session_set_at ? new Date(profile.active_session_set_at).getTime() : 0
          const isStale = !setAt || (Date.now() - setAt) > STALE_TTL_MS
          if (!isStale) {
            // Clear cookies for this request to prevent concurrent admin session
            await supabase.auth.signOut()
            return { ok: false, conflict: true }
          }
        }

        // Claim or refresh the active session
        if (admin) {
          await admin
            .from('users')
            .update({
              active_session_token_hash: currentHash,
              active_session_set_at: new Date().toISOString(),
            })
            .eq('id', userId)
        } else {
          await supabase
            .from('users')
            .update({
              active_session_token_hash: currentHash,
              active_session_set_at: new Date().toISOString(),
            })
            .eq('id', userId)
        }
        return { ok: true }
      } catch (e) {
        // Silently ignore DB errors to avoid blocking auth; logs help diagnose
        console.error('active-session upsert failed:', e)
        return { ok: true }
      }
    }

    if (event === 'SIGNED_OUT') {
      // Best-effort: identify and clear only if this device holds the lock
      try {
        if (session?.user?.id && session?.refresh_token) {
          const userId = session.user.id
          const hash = sha256Hex(session.refresh_token)
          // Ensure cookies carry the correct session if we rely on RLS
          if (!admin) {
            try { await supabase.auth.setSession(session) } catch {}
          }
          if (admin) {
            await admin
              .from('users')
              .update({ active_session_token_hash: null, active_session_set_at: null })
              .eq('id', userId)
              .eq('active_session_token_hash', hash)
          } else {
            await supabase
              .from('users')
              .update({ active_session_token_hash: null, active_session_set_at: null })
              .eq('id', userId)
              .eq('active_session_token_hash', hash)
          }
        }
      } catch (e) {
        console.warn('active-session clear on SIGNED_OUT failed:', e)
      }
      await supabase.auth.signOut()
      return NextResponse.json({ ok: true })
    }

    // For SIGNED_IN, TOKEN_REFRESHED, PASSWORD_RECOVERY, INITIAL_SESSION, etc.
    // Persist cookies first to authorize RLS reads, then enforce single-session.
    if (session) {
      await supabase.auth.setSession(session)
      const res = await upsertActiveSession()
      if (!res.ok && (res as any).conflict) {
        return NextResponse.json(
          { ok: false, error: 'active_session_exists' },
          { status: 409 }
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Error in /api/auth/callback:', e)
    return NextResponse.json({ ok: false, error: 'callback_failed' }, { status: 500 })
  }
}
