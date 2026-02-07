import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import {
  saveErTeamSession,
  saveErTeamUserData,
  loadErTeamSession,
  loadErTeamUserData,
  clearErTeamSession,
} from "@/lib/er-team-session"

const PROFILE_CACHE_KEY = "mdrrmo_er_team_profile"

interface ProfileCacheRecord {
  teamId: number | null
  teamName: string | null
  cachedAt: string
}

interface ErTeamUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
}

interface ErTeamInfo {
  id: number
  name: string | null
}

export type ProfileStatus = "loading" | "authorized" | "unauthorized" | "error"

interface UseErTeamProfileResult {
  profileStatus: ProfileStatus
  profileError: string | null
  teamId: number | null
  teamName: string | null
  userId: string | null
  userFirstName: string | null
  userLastName: string | null
  userEmail: string | null
  reloadProfile: () => void
  logout: () => void
}

const readCachedProfile = (): ProfileCacheRecord | null => {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ProfileCacheRecord
    if (!parsed || typeof parsed !== "object") return null
    return {
      teamId: typeof parsed.teamId === "number" ? parsed.teamId : null,
      teamName: typeof parsed.teamName === "string" ? parsed.teamName : null,
      cachedAt: typeof parsed.cachedAt === "string" ? parsed.cachedAt : new Date().toISOString(),
    }
  } catch (error) {
    console.warn("Failed to read cached ER team profile", error)
    return null
  }
}

const writeCachedProfile = (record: ProfileCacheRecord) => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(record))
  } catch (error) {
    console.warn("Failed to cache ER team profile", error)
  }
}

export function useErTeamProfile(): UseErTeamProfileResult {
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("loading")
  const [profileError, setProfileError] = useState<string | null>(null)
  const [teamId, setTeamId] = useState<number | null>(null)
  const [teamName, setTeamName] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userFirstName, setUserFirstName] = useState<string | null>(null)
  const [userLastName, setUserLastName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [reloadIndex, setReloadIndex] = useState(0)

  const reloadProfile = useCallback(() => {
    setReloadIndex((prev) => prev + 1)
  }, [])

  const logout = useCallback(() => {
    clearErTeamSession()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    const loadProfile = async () => {
      setProfileError(null)
      setProfileStatus("loading")

      if (!navigator.onLine) {
        const cache = readCachedProfile()
        if (cache) {
          setTeamId(cache.teamId)
          setTeamName(cache.teamName)
          setProfileStatus(cache.teamId ? "authorized" : "unauthorized")
          return
        }
      }

      try {
        const response = await fetch("/api/er-team/me", { credentials: "include", signal: controller.signal })
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean
          user?: { id: string; firstName: string | null; lastName: string | null; email: string | null }
          team?: { id: number; name: string | null }
          error?: string
        }

        if (!response.ok) {
          const message = payload?.error ?? (response.status === 429 ? "Too many profile checks. Please wait a moment and try again." : response.statusText)
          const err = new Error(message || "Failed to load ER team profile")
          ;(err as { status?: number }).status = response.status

          if (response.status === 401) {
            console.log('🔄 Session expired, attempting refresh...')
            try {
              const { data, error } = await supabase.auth.refreshSession()
              if (data.session && !error) {
                console.log('✅ Session refreshed, retrying profile load...')
                const retryResponse = await fetch("/api/er-team/me", { credentials: "include", signal: controller.signal })
                const retryPayload = (await retryResponse.json().catch(() => ({}))) as typeof payload

                if (retryResponse.ok && retryPayload.ok && retryPayload.team) {
                  const resolvedTeamId = typeof retryPayload.team?.id === "number" ? retryPayload.team.id : null
                  setTeamName(retryPayload.team?.name ?? null)
                  setTeamId(resolvedTeamId)
                  setUserId(retryPayload.user?.id ?? null)
                  setUserFirstName(retryPayload.user?.firstName ?? null)
                  setUserLastName(retryPayload.user?.lastName ?? null)
                  setUserEmail(retryPayload.user?.email ?? null)
                  setProfileStatus(resolvedTeamId ? "authorized" : "unauthorized")
                  writeCachedProfile({ teamId: resolvedTeamId, teamName: retryPayload.team?.name ?? null, cachedAt: new Date().toISOString() })
                  console.log("ER Team profile loaded after session refresh:", { resolvedTeamId, teamName: retryPayload.team?.name, userId: retryPayload.user?.id })
                  return
                }
              }
            } catch (refreshError) {
              console.error('❌ Session refresh failed:', refreshError)
            }
          }

          throw err
        }

        if (!isActive) return

        const user = payload?.user
        const team = payload?.team
        const resolvedTeamId = typeof team?.id === "number" ? team.id : null
        setTeamName(team?.name ?? null)
        setTeamId(resolvedTeamId)
        setUserId(user?.id ?? null)
        setUserFirstName(user?.firstName ?? null)
        setUserLastName(user?.lastName ?? null)
        setUserEmail(user?.email ?? null)
        setProfileStatus(resolvedTeamId ? "authorized" : "unauthorized")
        writeCachedProfile({ teamId: resolvedTeamId, teamName: team?.name ?? null, cachedAt: new Date().toISOString() })

        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session) {
          saveErTeamSession(
            sessionData.session.access_token,
            sessionData.session.refresh_token,
            sessionData.session.expires_in,
            sessionData.session.user.id,
            (sessionData.session.user.user_metadata?.user_type as any) || "er_team",
            resolvedTeamId
          )
          saveErTeamUserData({
            id: user?.id ?? "",
            email: user?.email ?? "",
            firstName: user?.firstName ?? null,
            lastName: user?.lastName ?? null,
            user_type: "er_team",
            teamId: resolvedTeamId,
            teamName: team?.name ?? null,
          })
        }

        console.log("ER Team profile loaded:", { resolvedTeamId, teamName: team?.name, userId: user?.id })
      } catch (error: any) {
        if (controller.signal.aborted || !isActive) return

        console.error("Failed to load ER team profile", error)
        const status = (error as { status?: number }).status
        const fallbackMessage = status === 429 ? "Too many profile checks. Please wait a moment and try again." : "Failed to load ER team assignment"
        const message = typeof error?.message === "string" && error.message.trim().length > 0 ? error.message : fallbackMessage
        
        const persistentSession = loadErTeamSession()
        const persistentUser = loadErTeamUserData()
        
        if (persistentSession && persistentUser) {
          console.log("[ER Team] Using persistent session despite error")
          setTeamId(persistentUser.teamId)
          setTeamName(persistentUser.teamName)
          setUserId(persistentUser.id)
          setUserFirstName(persistentUser.firstName)
          setUserLastName(persistentUser.lastName)
          setUserEmail(persistentUser.email)
          setProfileStatus("authorized")
          setProfileError("Offline mode - using cached credentials")
          return
        }
        
        const cache = readCachedProfile()
        if (cache) {
          setTeamId(cache.teamId)
          setTeamName(cache.teamName)
          setProfileStatus(cache.teamId ? "authorized" : "unauthorized")
          setProfileError(message)
        } else {
          setTeamId(null)
          setTeamName(null)
          setProfileError(message)
          setProfileStatus("error")
        }
      }
    }

    void loadProfile()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [reloadIndex])

  return {
    profileStatus,
    profileError,
    teamId,
    teamName,
    userId,
    userFirstName,
    userLastName,
    userEmail,
    reloadProfile,
    logout,
  }
}
