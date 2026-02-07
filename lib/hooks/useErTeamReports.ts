import { useState, useCallback, useEffect } from "react"
import { fetchWithRetry } from "@/lib/api-utils"
import { saveToCache, loadFromCache } from "@/lib/er-team-cache"
import { setCacheTimestamp } from "@/lib/er-team-storage"
import type { ErTeamDraftStatus } from "@/components/er-team/er-team-report-form"

export interface SyncedReport {
  id: string
  status: ErTeamDraftStatus
  patient_payload: Record<string, unknown>
  incident_payload: Record<string, unknown> | null
  injury_payload: Record<string, unknown> | null
  notes: string | null
  created_at: string
  updated_at: string
  synced_at: string | null
}

async function extractErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    try {
      const body = await response.json()
      if (body && typeof body.error === "string") return body.error
      if (body && typeof body.message === "string") return body.message
    } catch {
      // fall back
    }
  }

  try {
    const text = await response.text()
    if (text) return text
  } catch {
    // ignore
  }

  if (response.status === 429) {
    return "Too many requests. Please wait a moment and try again."
  }

  return response.statusText || "Request failed"
}

interface UseErTeamReportsOptions {
  isAuthorized: boolean
  teamId: number | null
  isOnline: boolean
}

interface UseErTeamReportsResult {
  reports: SyncedReport[]
  loadingReports: boolean
  reportsError: string | null
  refreshReports: () => Promise<void>
}

export function useErTeamReports({ isAuthorized, teamId, isOnline }: UseErTeamReportsOptions): UseErTeamReportsResult {
  const [reports, setReports] = useState<SyncedReport[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [reportsError, setReportsError] = useState<string | null>(null)

  const refreshReports = useCallback(async () => {
    if (!isAuthorized || !teamId) {
      return
    }

    setLoadingReports(true)
    setReportsError(null)

    if (!isOnline) {
      console.log('📴 refreshReports: Offline mode')
      try {
        const cachedReports = await loadFromCache<SyncedReport[]>('er-team-reports')
        if (cachedReports) {
          console.log('📦 Using cached reports:', cachedReports.length, 'items')
          setReports(cachedReports)
          setReportsError("You're currently offline. Using cached reports.")
        } else {
          setReportsError("You're offline and no cached reports are available.")
        }
      } catch (error) {
        console.error('❌ Error loading cached reports:', error)
        setReportsError("Failed to load cached reports. Please check your connection.")
      } finally {
        setLoadingReports(false)
      }
      return
    }

    try {
      console.log('🌐 Fetching reports from /api/er-team/reports')
      const response = await fetchWithRetry(`/api/er-team/reports?_t=${Date.now()}`, {
        credentials: "include",
        maxRetries: 3,
        retryDelay: 1000
      })

      if (!response.ok) {
        const message = await extractErrorMessage(response)
        throw new Error(message)
      }

      const payload = await response.json().catch(() => ({})) as { reports?: SyncedReport[] }
      const fetchedReports = Array.isArray(payload?.reports) ? payload.reports : []
      
      console.log('📋 Fetched reports:', fetchedReports.length, 'items')
      setReports(fetchedReports)
      
      await saveToCache('er-team-reports', fetchedReports)
      await setCacheTimestamp()
      
    } catch (error: any) {
      console.error("❌ Failed to load ER team reports", error)
      
      try {
        const cachedReports = await loadFromCache<SyncedReport[]>('er-team-reports')
        if (cachedReports) {
          console.log('🔄 Falling back to cached reports')
          setReports(cachedReports)
          setReportsError("Network error. Using cached reports: " + (error?.message || 'Unknown error'))
        } else {
          throw error
        }
      } catch (cacheError) {
        setReportsError(error?.message ?? "Unable to load reports")
      }
    } finally {
      setLoadingReports(false)
    }
  }, [isAuthorized, teamId, isOnline])

  // Initial load
  useEffect(() => {
    if (isAuthorized && teamId) {
      void refreshReports()
    }
  }, [isAuthorized, teamId])

  // Refresh when coming back online
  useEffect(() => {
    if (isOnline && isAuthorized && teamId) {
      void refreshReports()
    }
  }, [isOnline])

  return {
    reports,
    loadingReports,
    reportsError,
    refreshReports,
  }
}
