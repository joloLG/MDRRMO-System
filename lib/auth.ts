"use client"

import { supabase } from "@/lib/supabase"

/**
 * Robust sign-out that properly cleans up the session
 */
export async function robustSignOut(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      try {
        // Notify API about sign-out for cookie cleanup
        await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'SIGNED_OUT', session }),
          keepalive: true,
        })
      } catch {}
    }

    // Sign out locally
    try { await supabase.auth.signOut({ scope: 'local' } as any) } catch {}
    try { await supabase.auth.signOut() } catch {}

    // Local cleanup
    try { localStorage.removeItem('mdrrmo_user') } catch {}
    try { localStorage.removeItem('supabase.auth.token') } catch {}
  } catch (e) {
    console.warn('robustSignOut warning:', e)
  }
}
