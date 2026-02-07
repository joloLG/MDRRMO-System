import { useState, useCallback, useEffect, useRef } from "react"
import { fetchWithRetry } from "@/lib/api-utils"
import { saveToCache, loadFromCache } from "@/lib/er-team-cache"
import { shouldForceRefresh, setCacheTimestamp } from "@/lib/er-team-storage"

export interface AssignedIncident {
  id: string
  status: string
  emergency_type: string | null
  location_address: string | null
  latitude: number | null
  longitude: number | null
  firstName: string | null
  lastName: string | null
  mobileNumber: string | null
  created_at: string
  responded_at: string | null
  resolved_at: string | null
  er_team_report?: {
    id: string
    status: string
    updated_at: string
    synced_at: string | null
    notes: string | null
    patient_payload?: Record<string, unknown> | null
    incident_payload?: Record<string, unknown> | null
    injury_payload?: Record<string, unknown> | null
    internal_report_id?: number | null
  } | null
}

const sortAssignedIncidents = (incidents: AssignedIncident[]) => {
  return [...incidents].sort((a, b) => {
    const timeA = Date.parse(a.responded_at ?? a.created_at ?? "")
    const timeB = Date.parse(b.responded_at ?? b.created_at ?? "")
    if (Number.isNaN(timeA) && Number.isNaN(timeB)) return 0
    if (Number.isNaN(timeA)) return 1
    if (Number.isNaN(timeB)) return -1
    return timeB - timeA
  })
}

async function extractErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    try {
      const body = await response.json()
      if (body && typeof body.error === "string") return body.error
      if (body && typeof body.message === "string") return body.message
    } catch {
      // fall back to text handling below
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

interface UseAssignedIncidentsOptions {
  teamId: number | null
  isAuthorized: boolean
  isOnline: boolean
}

interface UseAssignedIncidentsResult {
  assignedIncidents: AssignedIncident[]
  assignedLoading: boolean
  assignedError: string | null
  refreshAssignedIncidents: () => Promise<void>
  setAssignedError: (error: string | null) => void
  updateIncident: (incident: AssignedIncident) => void
  instantUpdateIncident: (incidentUpdate: Partial<AssignedIncident> & { id: string }) => void
}

export function useAssignedIncidents({ teamId, isAuthorized, isOnline }: UseAssignedIncidentsOptions): UseAssignedIncidentsResult {
  const [assignedIncidents, setAssignedIncidents] = useState<AssignedIncident[]>([])
  const [assignedLoading, setAssignedLoading] = useState(false)
  const [assignedError, setAssignedError] = useState<string | null>(null)
  const lastRefreshRef = useRef<number>(0)

  const refreshAssignedIncidents = useCallback(async () => {
    console.log('🔄 refreshAssignedIncidents called')

    if (!isAuthorized || !teamId) {
      console.log('❌ Not authorized or no teamId', { isAuthorized, teamId })
      return
    }

    console.log('📡 Starting background refresh for team', teamId)
    
    // Check current state to determine if this is initial load
    // Only show loading on initial load to prevent list from vanishing
    setAssignedIncidents((currentIncidents) => {
      if (currentIncidents.length === 0) {
        console.log('📋 Initial load - showing loading state')
        setAssignedLoading(true)
      } else {
        console.log('🔄 Background refresh - keeping existing data visible')
      }
      return currentIncidents
    })
    
    setAssignedError(null)

    try {
      const cacheKey = `assigned-incidents-${teamId}`
      const cachedData = await loadFromCache<AssignedIncident[]>(cacheKey)
      
      if (cachedData) {
        console.log('📦 Using cached assigned incidents:', cachedData.length, 'items')
        setAssignedIncidents(cachedData)
      }

      if (!isOnline && !cachedData) {
        console.log('📴 Offline and no cached data available')
        setAssignedError("You're offline and no cached data is available.")
        return
      }

      if (!isOnline) {
        console.log('📴 Offline mode - using cached data')
        setAssignedError("You're currently offline. Using cached data.")
        return
      }

      console.log('🌐 Fetching assigned incidents from server')
      const response = await fetchWithRetry(`/api/er-team/assigned?_t=${Date.now()}`, {
        credentials: "include",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'X-Cache-Bypass': '1',
        },
        cache: 'no-store'
      })

      console.log('📥 Response status:', response.status)

      if (!response.ok) {
        const message = await extractErrorMessage(response)
        console.error('❌ API error:', message)
        throw new Error(message)
      }

      const body = await response.json()
      const incidents = Array.isArray(body?.incidents) ? body.incidents : []
      console.log('📋 Fetched incidents:', incidents.length, 'items')

      const filteredIncidents = incidents.filter((incident: AssignedIncident) => 
        !incident.er_team_report?.internal_report_id
      )
      console.log('🔍 Filtered incidents:', filteredIncidents.length, 'items')

      const ordered = sortAssignedIncidents(filteredIncidents)
      setAssignedIncidents(ordered)
      
      await saveToCache(cacheKey, ordered)
      await setCacheTimestamp()
      lastRefreshRef.current = Date.now()

      console.log('✅ Successfully updated assigned incidents')
    } catch (error: any) {
      console.error("❌ Failed to load assigned incidents", error)
      
      if (assignedIncidents.length > 0) {
        console.log('🔄 Falling back to existing state data')
        setAssignedError("Network error. Using existing data: " + (error?.message || 'Unknown error'))
      } else {
        try {
          const cacheKey = `assigned-incidents-${teamId}`
          const cachedData = await loadFromCache<AssignedIncident[]>(cacheKey)
          if (cachedData) {
            console.log('🔄 Falling back to cached data')
            setAssignedIncidents(cachedData)
            setAssignedError("Network error. Using cached data: " + (error?.message || 'Unknown error'))
          } else {
            throw error
          }
        } catch (cacheError) {
          setAssignedError(error?.message ?? "Unable to load assigned incidents")
        }
      }
    } finally {
      setAssignedLoading(false)
      console.log('🏁 refreshAssignedIncidents completed')
    }
  }, [isAuthorized, teamId, isOnline, assignedIncidents.length])

  const updateIncident = useCallback((incident: AssignedIncident) => {
    setAssignedIncidents((previous) => {
      const existingIndex = previous.findIndex((item) => item.id === incident.id)
      if (existingIndex === -1) {
        return sortAssignedIncidents([incident, ...previous])
      }
      const next = [...previous]
      next[existingIndex] = {
        ...next[existingIndex],
        ...incident,
      }
      return sortAssignedIncidents(next)
    })
  }, [])

  // Instant update function for realtime - no network calls, just state update
  const instantUpdateIncident = useCallback((incidentUpdate: Partial<AssignedIncident> & { id: string }) => {
    console.log('⚡ Instant incident update:', incidentUpdate.id)
    
    setAssignedIncidents((previous) => {
      const existingIndex = previous.findIndex((item) => item.id === incidentUpdate.id)
      
      if (existingIndex === -1) {
        // New incident - add it if it has enough data
        if (incidentUpdate.emergency_type !== undefined) {
          console.log('➕ Adding new incident to list')
          const newIncident = incidentUpdate as AssignedIncident
          return sortAssignedIncidents([newIncident, ...previous])
        }
        return previous
      }
      
      // Update existing incident
      console.log('🔄 Updating existing incident in list')
      const next = [...previous]
      next[existingIndex] = {
        ...next[existingIndex],
        ...incidentUpdate,
      }
      return sortAssignedIncidents(next)
    })

    // Update cache in background
    if (teamId) {
      void (async () => {
        try {
          const cacheKey = `assigned-incidents-${teamId}`
          const currentData = await loadFromCache<AssignedIncident[]>(cacheKey)
          if (currentData) {
            const existingIndex = currentData.findIndex((item) => item.id === incidentUpdate.id)
            if (existingIndex !== -1) {
              currentData[existingIndex] = { ...currentData[existingIndex], ...incidentUpdate }
            } else if (incidentUpdate.emergency_type !== undefined) {
              currentData.unshift(incidentUpdate as AssignedIncident)
            }
            await saveToCache(cacheKey, sortAssignedIncidents(currentData))
          }
        } catch (error) {
          console.warn('Failed to update cache:', error)
        }
      })()
    }
  }, [teamId])

  // Initial load
  useEffect(() => {
    if (isAuthorized && teamId) {
      void refreshAssignedIncidents()
    }
  }, [isAuthorized, teamId])

  return {
    assignedIncidents,
    assignedLoading,
    assignedError,
    refreshAssignedIncidents,
    setAssignedError,
    updateIncident,
    instantUpdateIncident,
  }
}
