"use client"

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { UserRole } from "./supabase"

// Extended session duration for ER Team (30 days in seconds)
const ER_TEAM_SESSION_DURATION = 30 * 24 * 60 * 60 // 30 days

// Storage keys for persistent session
const ER_TEAM_SESSION_KEY = "er_team_persistent_session"
const ER_TEAM_USER_KEY = "er_team_user_data"
const ER_TEAM_LAST_ACTIVE_KEY = "er_team_last_active"

interface PersistentSession {
  access_token: string
  refresh_token: string
  expires_at: number
  user_id: string
  user_role: UserRole
  team_id: number | null
  created_at: string
}

interface StoredUserData {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  user_type: UserRole
  teamId: number | null
  teamName: string | null
}

// Check if user is ER Team
export function isErTeamUser(userType: UserRole | string | undefined): boolean {
  return userType === "er_team"
}

// Save persistent session for ER Team
export function saveErTeamSession(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  userId: string,
  userRole: UserRole,
  teamId: number | null
): void {
  if (typeof window === "undefined") return

  const session: PersistentSession = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Date.now() + expiresIn * 1000,
    user_id: userId,
    user_role: userRole,
    team_id: teamId,
    created_at: new Date().toISOString(),
  }

  try {
    localStorage.setItem(ER_TEAM_SESSION_KEY, JSON.stringify(session))
    localStorage.setItem(ER_TEAM_LAST_ACTIVE_KEY, Date.now().toString())
    console.log("[ER Team] Persistent session saved")
  } catch (error) {
    console.error("[ER Team] Failed to save session:", error)
  }
}

// Save ER Team user data
export function saveErTeamUserData(userData: StoredUserData): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(ER_TEAM_USER_KEY, JSON.stringify(userData))
  } catch (error) {
    console.error("[ER Team] Failed to save user data:", error)
  }
}

// Load persistent session
export function loadErTeamSession(): PersistentSession | null {
  if (typeof window === "undefined") return null

  try {
    const stored = localStorage.getItem(ER_TEAM_SESSION_KEY)
    if (!stored) return null

    const session: PersistentSession = JSON.parse(stored)

    // Check if session is still valid (with 1 hour buffer)
    const bufferMs = 60 * 60 * 1000 // 1 hour
    if (Date.now() > session.expires_at - bufferMs) {
      console.log("[ER Team] Session expired or about to expire")
      return null
    }

    return session
  } catch (error) {
    console.error("[ER Team] Failed to load session:", error)
    return null
  }
}

// Load ER Team user data
export function loadErTeamUserData(): StoredUserData | null {
  if (typeof window === "undefined") return null

  try {
    const stored = localStorage.getItem(ER_TEAM_USER_KEY)
    if (!stored) return null

    return JSON.parse(stored) as StoredUserData
  } catch (error) {
    console.error("[ER Team] Failed to load user data:", error)
    return null
  }
}

// Clear ER Team session
export function clearErTeamSession(): void {
  if (typeof window === "undefined") return

  try {
    localStorage.removeItem(ER_TEAM_SESSION_KEY)
    localStorage.removeItem(ER_TEAM_USER_KEY)
    localStorage.removeItem(ER_TEAM_LAST_ACTIVE_KEY)
    console.log("[ER Team] Session cleared")
  } catch (error) {
    console.error("[ER Team] Failed to clear session:", error)
  }
}

// Update last active timestamp
export function updateErTeamLastActive(): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(ER_TEAM_LAST_ACTIVE_KEY, Date.now().toString())
  } catch (error) {
    // Silent fail - not critical
  }
}

// Check if ER Team session is valid (even offline)
export function isErTeamSessionValid(): boolean {
  if (typeof window === "undefined") return false

  const session = loadErTeamSession()
  if (!session) return false

  const userData = loadErTeamUserData()
  if (!userData) return false

  // For ER Team, we consider session valid if we have stored credentials
  // The actual token validation happens when online
  return userData.user_type === "er_team"
}

// Create Supabase client with ER Team session
export async function createErTeamClient() {
  const supabase = createClientComponentClient()

  // Try to restore session from persistent storage if offline
  const session = loadErTeamSession()
  if (session) {
    try {
      // Set the session manually
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })
      console.log("[ER Team] Session restored from storage")
    } catch (error) {
      console.error("[ER Team] Failed to restore session:", error)
    }
  }

  return supabase
}

// Extend session for ER Team (call this periodically when online)
export async function extendErTeamSession(supabase: ReturnType<typeof createClientComponentClient>): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.refreshSession()

    if (error || !data.session) {
      console.error("[ER Team] Failed to extend session:", error)
      return false
    }

    // Save the new session
    saveErTeamSession(
      data.session.access_token,
      data.session.refresh_token,
      data.session.expires_in,
      data.session.user.id,
      (data.session.user.user_metadata?.user_type as UserRole) || "er_team",
      data.session.user.user_metadata?.team_id || null
    )

    console.log("[ER Team] Session extended")
    return true
  } catch (error) {
    console.error("[ER Team] Error extending session:", error)
    return false
  }
}

// Check if we should attempt auto-login for ER Team
export function shouldAttemptErTeamAutoLogin(): boolean {
  if (typeof window === "undefined") return false

  const session = loadErTeamSession()
  const userData = loadErTeamUserData()

  return !!(session && userData && userData.user_type === "er_team")
}
