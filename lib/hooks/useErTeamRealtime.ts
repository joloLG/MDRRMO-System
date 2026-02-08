import { useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"
import type { AssignedIncident } from "./useAssignedIncidents"

interface UseErTeamRealtimeOptions {
  teamId: number | null
  isAuthorized: boolean
  userId: string | null
  assignedIncidents: AssignedIncident[]
  userLocation: { lat: number; lng: number } | null
  onAssignedIncidentChange: () => void
  onReportChange: () => void
  onInternalReportChange: () => void
  onNewDispatch?: (notification: any) => void
  onInstantIncidentUpdate?: (incident: Partial<AssignedIncident> & { id: string }) => void
}

const DEBOUNCE_MS = 900
const RECONNECT_DELAY_MS = 10000

export function useErTeamRealtime({
  teamId,
  isAuthorized,
  userId,
  assignedIncidents,
  userLocation,
  onAssignedIncidentChange,
  onReportChange,
  onInternalReportChange,
  onNewDispatch,
  onInstantIncidentUpdate,
}: UseErTeamRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const assignedIncidentIdsRef = useRef<Set<string>>(new Set())
  const lastRefreshRef = useRef<number>(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Update incident IDs ref
  useEffect(() => {
    assignedIncidentIdsRef.current = new Set(assignedIncidents.map((incident) => incident.id))
  }, [assignedIncidents])

  // Debounced refresh function
  const debouncedRefresh = useCallback((callback: () => void) => {
    const now = Date.now()
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // If enough time has passed, refresh immediately
    if (now - lastRefreshRef.current > DEBOUNCE_MS) {
      lastRefreshRef.current = now
      callback()
    } else {
      // Otherwise, debounce
      debounceTimerRef.current = setTimeout(() => {
        lastRefreshRef.current = Date.now()
        callback()
        debounceTimerRef.current = null
      }, DEBOUNCE_MS)
    }
  }, [])

  useEffect(() => {
    if (!isAuthorized || !teamId) {
      console.log('❌ Realtime: Not authorized or no teamId')
      return
    }

    console.log('🔗 Setting up realtime subscription for team', teamId)
    const channelName = `er-team-dashboard-${teamId}`
    const channel = supabase.channel(channelName)
    channelRef.current = channel

    // Handler for internal report changes
    const handleInternalReportChange = (payload: { new?: Record<string, any> | null; old?: Record<string, any> | null }) => {
      const candidateId = (payload?.new?.original_report_id ?? payload?.old?.original_report_id) as string | null | undefined
      if (!candidateId || !assignedIncidentIdsRef.current.has(candidateId)) {
        return
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return
      }
      debouncedRefresh(onInternalReportChange)
    }

    // Handler for ER team report changes
    const handleReportChange = (payload: { new?: Record<string, any> | null; old?: Record<string, any> | null; eventType?: string }) => {
      const rows = [payload?.new, payload?.old].filter(Boolean) as Record<string, any>[]
      const submittedByMatch = rows.some((row) => typeof row?.submitted_by === "string" && row.submitted_by === userId)
      const emergencyIdMatch = rows.some((row) => {
        const emergencyId = row?.emergency_report_id
        return typeof emergencyId === "string" && assignedIncidentIdsRef.current.has(emergencyId)
      })
      
      if (!submittedByMatch && !emergencyIdMatch) {
        return
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return
      }

      // Handle PCR report notifications
      const newRow = payload.new as any
      const oldRow = payload.old as any
      
      if (newRow && newRow.emergency_report_id && assignedIncidentIdsRef.current.has(newRow.emergency_report_id)) {
        const emergencyReport = assignedIncidents.find(inc => inc.id === newRow.emergency_report_id)
        
        if (emergencyReport && onNewDispatch) {
          let shouldNotify = false
          let eventType: 'assignment' | 'status_change' = 'assignment'
          
          if (payload.eventType === 'INSERT') {
            shouldNotify = true
          } else if (payload.eventType === 'UPDATE' && newRow.status !== oldRow?.status) {
            const resolvedStatuses = ['resolved', 'completed']
            if (!resolvedStatuses.includes(newRow.status?.toLowerCase())) {
              shouldNotify = true
              eventType = 'status_change'
            }
          }
          
          if (shouldNotify) {
            onNewDispatch({
              id: `pcr-${newRow.id}-${Date.now()}`,
              eventType,
              emergencyReportId: newRow.emergency_report_id,
              erTeamId: teamId,
              erTeamReportId: newRow.id,
              reporterName: `${emergencyReport.firstName ?? ''} ${emergencyReport.lastName ?? ''}`.trim() || 'Unknown reporter',
              incidentType: emergencyReport.emergency_type,
              locationAddress: emergencyReport.location_address,
              reportedAt: emergencyReport.created_at,
              respondedAt: emergencyReport.responded_at,
              createdAt: new Date().toISOString(),
              oldStatus: oldRow?.status,
              newStatus: newRow.status,
              previousTeamId: null,
              originLatitude: userLocation?.lat ?? null,
              originLongitude: userLocation?.lng ?? null,
              incidentLatitude: emergencyReport.latitude,
              incidentLongitude: emergencyReport.longitude,
            })
          }
        }
      }

      debouncedRefresh(() => {
        onReportChange()
        onAssignedIncidentChange()
      })
    }

    // Handler for emergency report changes
    const handleEmergencyReportChange = (payload: { new?: Record<string, any> | null; old?: Record<string, any> | null; eventType?: string }) => {
      console.log('🔔 Emergency report realtime event received:', payload.eventType)

      if (!payload.new) {
        return
      }

      const newRow = payload.new
      const oldRow = payload.old
      const newTeamId = newRow.er_team_id
      const oldTeamId = oldRow?.er_team_id
      const isAssignedToTeam = newTeamId != null && (newTeamId === teamId || String(newTeamId) === String(teamId))
      const wasAssignedToTeam = oldTeamId != null && (oldTeamId === teamId || String(oldTeamId) === String(teamId))
      
      // Check if this is a NEW assignment (team_id just changed to this team)
      const isNewAssignment = isAssignedToTeam && (!wasAssignedToTeam || oldTeamId !== newTeamId)
      
      // Check if responded_at was just filled (notification trigger)
      const respondedAtFilled = newRow.responded_at && (!oldRow?.responded_at)
      
      // Check if resolved_at was just filled (skip notification)
      const resolvedAtFilled = newRow.resolved_at && (!oldRow?.resolved_at)

      if (resolvedAtFilled) {
        console.log('Skipping notification for resolved_at being set')
        return
      }

      // Instant update for new assignments - no debounce!
      if (isNewAssignment && onInstantIncidentUpdate) {
        console.log('⚡ NEW ASSIGNMENT - Instant update!')
        const incidentUpdate: Partial<AssignedIncident> & { id: string } = {
          id: newRow.id,
          status: newRow.status || 'pending',
          emergency_type: newRow.emergency_type || null,
          location_address: newRow.location_address || null,
          latitude: parseFloat(newRow.latitude) || null,
          longitude: parseFloat(newRow.longitude) || null,
          firstName: newRow.firstName || null,
          lastName: newRow.lastName || null,
          mobileNumber: newRow.mobileNumber || null,
          created_at: newRow.created_at,
          responded_at: newRow.responded_at || null,
          resolved_at: newRow.resolved_at || null,
        }
        onInstantIncidentUpdate(incidentUpdate)
        
        // Also show notification
        if (onNewDispatch) {
          onNewDispatch({
            id: `emergency-${newRow.id}-${Date.now()}`,
            eventType: 'assignment',
            emergencyReportId: newRow.id,
            erTeamId: teamId,
            erTeamReportId: null,
            reporterName: `${newRow.firstName ?? ''} ${newRow.lastName ?? ''}`.trim() || 'Unknown reporter',
            incidentType: newRow.emergency_type,
            locationAddress: newRow.location_address,
            reportedAt: newRow.created_at,
            respondedAt: newRow.responded_at,
            createdAt: new Date().toISOString(),
            oldStatus: oldRow?.status,
            newStatus: newRow.status,
            previousTeamId: oldRow?.er_team_id,
            originLatitude: userLocation?.lat ?? null,
            originLongitude: userLocation?.lng ?? null,
            incidentLatitude: parseFloat(newRow.latitude) || null,
            incidentLongitude: parseFloat(newRow.longitude) || null,
          })
        }
      } else if (isAssignedToTeam && onInstantIncidentUpdate) {
        // Update existing incident instantly
        console.log('⚡ Update existing incident instantly')
        const incidentUpdate: Partial<AssignedIncident> & { id: string } = {
          id: newRow.id,
          status: newRow.status,
          responded_at: newRow.responded_at || null,
          resolved_at: newRow.resolved_at || null,
        }
        onInstantIncidentUpdate(incidentUpdate)
      } else if (!isAssignedToTeam && wasAssignedToTeam) {
        // Incident was removed from this team
        console.log('❌ Incident removed from team - refresh list')
        debouncedRefresh(onAssignedIncidentChange)
      }
    }

    // Subscribe to changes
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "emergency_reports" }, handleEmergencyReportChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_reports" }, handleInternalReportChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "er_team_reports" }, handleReportChange)
      .subscribe((status, err) => {
        console.log('🔗 Realtime subscription status:', status, err ? `Error: ${err}` : '')
        
        if (err) {
          console.error('❌ Realtime subscription error:', err)
          
          if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            console.log('🔄 Retrying realtime subscription in', RECONNECT_DELAY_MS / 1000, 'seconds...')
            setTimeout(() => {
              if (isAuthorized && teamId) {
                console.log('🔄 Attempting to reconnect...')
              }
            }, RECONNECT_DELAY_MS)
          }
        }
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to realtime channel:', channelName)
        }
      })

    // Cleanup
    return () => {
      console.log('Cleaning up realtime subscription for team', teamId)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [
    isAuthorized,
    teamId,
    userId,
    assignedIncidents,
    userLocation,
    onAssignedIncidentChange,
    onReportChange,
    onInternalReportChange,
    onNewDispatch,
    debouncedRefresh,
  ])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])
}
