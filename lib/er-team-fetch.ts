"use client"

import { fetchWithRetry as originalFetchWithRetry } from "./api-utils"
import {
  isErTeamUser,
  loadErTeamSession,
  saveErTeamSession,
  updateErTeamLastActive,
  shouldAttemptErTeamAutoLogin,
} from "./er-team-session"

// Custom fetch for ER Team that doesn't auto-logout on session issues
export async function fetchWithRetryForErTeam(
  input: RequestInfo | URL,
  options: RequestInit = {}
): Promise<Response> {
  // Update last active timestamp
  updateErTeamLastActive()

  // Check if we have a stored session for offline use
  const storedSession = loadErTeamSession()

  try {
    // Try the original fetch first
    const response = await originalFetchWithRetry(input, {
      ...options,
      skipAuthRefresh: true, // Don't use the auto-logout behavior
    })

    return response
  } catch (error: any) {
    // For ER Team, don't redirect to login on 401 - try to handle gracefully
    if (error.message?.includes("Session expired") || error.message?.includes("401")) {
      console.log("[ER Team] Session issue detected, attempting recovery...")

      // If we have a stored session, we can continue in offline mode
      if (storedSession) {
        console.log("[ER Team] Using stored session for offline mode")

        // Return a mock successful response for offline scenarios
        // The actual API call may fail, but the app should remain functional
        return new Response(
          JSON.stringify({
            ok: true,
            offline: true,
            message: "Operating in offline mode",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      }
    }

    // For other errors, throw them normally
    throw error
  }
}

// Check if ER Team is in offline mode
export function isErTeamOfflineMode(): boolean {
  if (typeof navigator === "undefined") return false

  const isOnline = navigator.onLine
  const hasStoredSession = shouldAttemptErTeamAutoLogin()

  // Offline mode = browser is offline OR we have stored session and want to use it
  return !isOnline || (hasStoredSession && !isOnline)
}

// Get current auth token for ER Team (from storage if needed)
export function getErTeamAuthToken(): string | null {
  const session = loadErTeamSession()
  return session?.access_token || null
}

// Handle 401 errors for ER Team without logout
export async function handleErTeamAuthError(
  response: Response,
  retryCallback: () => Promise<Response>
): Promise<Response> {
  // If not 401, return the response as-is
  if (response.status !== 401) {
    return response
  }

  const storedSession = loadErTeamSession()

  if (storedSession) {
    console.log("[ER Team] 401 received but have stored session, continuing offline")

    // Return a modified response that doesn't trigger logout
    return new Response(
      JSON.stringify({
        ok: false,
        offline: true,
        message: "Session refresh pending - operating offline",
      }),
      {
        status: 200, // Return 200 to prevent logout logic
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  // If no stored session, return the original 401
  return response
}
