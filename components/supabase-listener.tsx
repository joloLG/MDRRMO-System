"use client"

import { useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export function SupabaseListener() {
  const supabase = createClientComponentClient()

  useEffect(() => {
    // 1) On mount, sync current session to cookies if present (handles pre-existing localStorage sessions)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'INITIAL_SESSION', session })
        }).catch(() => {})
      }
    })

    // 2) Listen for auth state changes and persist to cookies
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, session })
      }).catch(() => {})
    })

    return () => {
      try {
        subscription?.subscription?.unsubscribe?.()
      } catch {}
    }
  }, [supabase])

  return null
}
