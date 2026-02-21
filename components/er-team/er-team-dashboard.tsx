"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { clearErTeamSession, extendErTeamSession } from "@/lib/er-team-session"
import {
  loadDrafts as loadDraftsFromDB,
  upsertDraft,
  upsertDrafts,
  removeDraft,
  forceRefreshData,
  setCacheTimestamp,
} from "@/lib/er-team-storage"
import { Bell, RefreshCw, User, X } from "lucide-react"
import {
  ErTeamReportForm,
  DEFAULT_PATIENT_TEMPLATE,
  type ErTeamDraft,
  type ErTeamDraftStatus,
  type InjuryMap,
} from "./er-team-report-form"
import { ErTeamBottomNav, type ErTeamTab } from "./er-team-bottom-nav"
import { AccommodatedPage, DraftsPage, ErTeamProvider, HomePage, ReportFormPage, ReportsPage } from "./pages"
import { App } from '@capacitor/app'
import { CapacitorNotifications } from "@/lib/capacitor-notifications"

// Custom hooks
import { useErTeamProfile } from "@/lib/hooks/useErTeamProfile"
import { useAssignedIncidents, type AssignedIncident } from "@/lib/hooks/useAssignedIncidents"
import { useErTeamReports, type SyncedReport } from "@/lib/hooks/useErTeamReports"
import { useErTeamReferences } from "@/lib/hooks/useErTeamReferences"
import { useErTeamLocation } from "@/lib/hooks/useErTeamLocation"
import { useErTeamRealtime } from "@/lib/hooks/useErTeamRealtime"

const DASHBOARD_BACKGROUND_STYLE: React.CSSProperties = {
  backgroundImage: 'url("/images/mdrrmo_dashboard_bg.jpg")',
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
}

type NotificationEventType = "assignment" | "status_change"

interface TeamDispatchNotification {
  id: string
  eventType: NotificationEventType
  emergencyReportId: string
  erTeamId: number | null
  erTeamReportId: string | null
  reporterName: string | null
  incidentType: string | null
  locationAddress: string | null
  reportedAt: string | null
  respondedAt: string | null
  oldStatus: string | null
  newStatus: string | null
  createdAt: string
  previousTeamId: number | null
  originLatitude: number | null
  originLongitude: number | null
  incidentLatitude: number | null
  incidentLongitude: number | null
}

interface ErTeamDashboardProps {
  onLogout: () => Promise<void> | void
}

type LocalDraft = ErTeamDraft

const SUPABASE_CHANNEL_PREFIX = "er-team-dashboard-"
const ASSIGNED_REFRESH_DEBOUNCE_MS = 900
const MAX_DISPATCH_NOTIFICATIONS = 6
const DISPATCH_OVERLAY_DURATION_MS = 10_000
const VALID_DRAFT_STATUSES: ErTeamDraftStatus[] = ["draft", "pending_review", "in_review", "approved", "rejected"]

const deepCopy = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

function sanitizeInjuryView(source: unknown): Record<string, string[]> {
  if (!source || typeof source !== "object" || Array.isArray(source)) return {}
  const result: Record<string, string[]> = {}
  for (const [region, codes] of Object.entries(source as Record<string, unknown>)) {
    if (Array.isArray(codes)) {
      result[region] = codes.filter((code): code is string => typeof code === "string")
    }
  }
  return result
}

function createDraftForIncident(incident: AssignedIncident): LocalDraft {
  const nowIso = new Date().toISOString()
  const basePatientPayload = incident.er_team_report?.patient_payload
  const patientPayload = basePatientPayload && typeof basePatientPayload === "object"
    ? deepCopy(basePatientPayload as Record<string, any>)
    : (deepCopy(DEFAULT_PATIENT_TEMPLATE) as Record<string, any>)

  const baseIncidentPayload = incident.er_team_report?.incident_payload
  const incidentPayload = baseIncidentPayload && typeof baseIncidentPayload === "object"
    ? deepCopy(baseIncidentPayload as Record<string, any>)
    : {}

  // Auto-populate incident data from emergency report
  if (!incidentPayload.incidentDate && incident.created_at) {
    incidentPayload.incidentDate = incident.created_at.slice(0, 10)
  }
  if (!incidentPayload.incidentTime && incident.created_at) {
    incidentPayload.incidentTime = incident.created_at.slice(11, 16)
  }
  if (!incidentPayload.incidentTypeLabel && incident.emergency_type) {
    incidentPayload.incidentTypeLabel = incident.emergency_type
  }
  if (!incidentPayload.locationAddress && incident.location_address) {
    incidentPayload.locationAddress = incident.location_address
  }

  const baseInjuryPayload = incident.er_team_report?.injury_payload
  const injuryPayload: InjuryMap = {
    front: sanitizeInjuryView((baseInjuryPayload as InjuryMap | undefined)?.front) ?? {},
    back: sanitizeInjuryView((baseInjuryPayload as InjuryMap | undefined)?.back) ?? {},
  }

  const remoteStatus = incident.er_team_report?.status ?? "draft"
  const status: ErTeamDraftStatus = VALID_DRAFT_STATUSES.includes(remoteStatus as ErTeamDraftStatus)
    ? (remoteStatus as ErTeamDraftStatus)
    : "draft"

  const clientDraftId = typeof incident.er_team_report?.id === "string" && incident.er_team_report.id.length > 0
    ? incident.er_team_report.id
    : incident.id

  const syncedAt = incident.er_team_report?.synced_at ?? null
  const updatedAt = incident.er_team_report?.updated_at ?? nowIso

  return {
    clientDraftId,
    emergencyReportId: incident.id,
    status,
    updatedAt,
    synced: Boolean(incident.er_team_report),
    lastSyncError: null,
    submittedAt: syncedAt,
    patientsPayload: [{
      ...DEFAULT_PATIENT_TEMPLATE,
      ...patientPayload,
    }],
    injuryPayload,
    notes: typeof incident.er_team_report?.notes === "string" ? incident.er_team_report.notes : null,
    internalReportId: incident.er_team_report?.internal_report_id ?? null,
  }
}

function mergeDraftsWithAssigned(existingDrafts: LocalDraft[], incidents: AssignedIncident[]): LocalDraft[] {
  const existingByIncident = new Map<string, LocalDraft>()
  existingDrafts.forEach((draft) => {
    if (draft.emergencyReportId) {
      existingByIncident.set(draft.emergencyReportId, draft)
    }
  })

  const incidentOrder = new Map<string, number>()
  incidents.forEach((incident, index) => {
    incidentOrder.set(incident.id, index)
  })

  const mergedDrafts = incidents.map((incident) => {
    const baseDraft = createDraftForIncident(incident)
    const existing = existingByIncident.get(incident.id)

    if (!existing) {
      return baseDraft
    }

    const nextUpdatedAt = (() => {
      const baseDate = Date.parse(baseDraft.updatedAt)
      const existingDate = Date.parse(existing.updatedAt)
      if (Number.isNaN(baseDate) && Number.isNaN(existingDate)) return baseDraft.updatedAt
      if (Number.isNaN(existingDate)) return baseDraft.updatedAt
      if (Number.isNaN(baseDate)) return existing.updatedAt
      return baseDate >= existingDate ? baseDraft.updatedAt : existing.updatedAt
    })()

    const merged: LocalDraft = {
      ...existing,
      clientDraftId: existing.clientDraftId || baseDraft.clientDraftId,
      emergencyReportId: incident.id,
      status: baseDraft.status,
      synced: existing.synced && baseDraft.synced,
      lastSyncError: existing.lastSyncError ?? null,
      submittedAt: baseDraft.submittedAt ?? existing.submittedAt ?? null,
      updatedAt: nextUpdatedAt,
      patientsPayload: existing.patientsPayload ?? baseDraft.patientsPayload,
      incidentPayload: existing.incidentPayload ?? baseDraft.incidentPayload,
      injuryPayload: existing.injuryPayload ?? baseDraft.injuryPayload,
      notes: existing.notes ?? baseDraft.notes ?? null,
      internalReportId: baseDraft.internalReportId ?? existing.internalReportId ?? null,
    }

    return merged
  })

  const uniqueDrafts = mergedDrafts.filter((draft, index, self) => 
    self.findIndex((candidate) => candidate.clientDraftId === draft.clientDraftId) === index
  )

  return uniqueDrafts.sort((a, b) => {
    const orderA = incidentOrder.get(a.emergencyReportId ?? "") ?? Number.MAX_SAFE_INTEGER
    const orderB = incidentOrder.get(b.emergencyReportId ?? "") ?? Number.MAX_SAFE_INTEGER
    return orderA - orderB
  })
}

const formatDateTime = (value?: string | null) => {
  if (!value) return null
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    })
  } catch {
    return null
  }
}

const formatStatusLabel = (status: ErTeamDraftStatus) =>
  status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")

const formatStatusDisplay = (status?: string | null) => {
  if (!status) return null
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
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

async function migrateLegacyDrafts() {
  if (typeof window === "undefined") return
  try {
    const raw = window.localStorage.getItem("mdrrmo_er_team_local_drafts")
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    const normalized: LocalDraft[] = parsed
      .map((item: LocalDraft & { emergencyReportId?: string }) => ({
        ...item,
        emergencyReportId: typeof item.emergencyReportId === "string" ? item.emergencyReportId : "",
        status: (item.status ?? "draft") as ErTeamDraftStatus,
      }))
      .filter((item) => item.emergencyReportId)
    if (normalized.length > 0) {
      await upsertDrafts(normalized)
    }
    window.localStorage.removeItem("mdrrmo_er_team_local_drafts")
  } catch (error) {
    console.warn("Failed to migrate legacy ER drafts", error)
  }
}

export function ErTeamDashboard({ onLogout }: ErTeamDashboardProps) {
  // Network status
  const [isOnline, setIsOnline] = React.useState<boolean>(() => 
    (typeof navigator !== "undefined" ? navigator.onLine : true)
  )

  // Custom hooks for data management
  const profile = useErTeamProfile()
  const { 
    assignedIncidents, 
    assignedLoading, 
    assignedError, 
    refreshAssignedIncidents,
    setAssignedError,
    updateIncident,
    instantUpdateIncident,
  } = useAssignedIncidents({
    teamId: profile.teamId,
    isAuthorized: profile.profileStatus === "authorized",
    isOnline,
  })

  const { 
    reports, 
    loadingReports, 
    reportsError, 
    refreshReports 
  } = useErTeamReports({
    isAuthorized: profile.profileStatus === "authorized",
    teamId: profile.teamId,
    isOnline,
  })

  const { 
    barangays, 
    incidentTypes,
    hospitals,
    referenceError 
  } = useErTeamReferences()

  const {
    userLocation,
    locationPermission,
    requestLocation,
  } = useErTeamLocation()

  // Local state
  const [drafts, setDrafts] = React.useState<LocalDraft[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [activeDraftId, setActiveDraftId] = React.useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [selectedIncidentId, setSelectedIncidentId] = React.useState<string | null>(null)
  const [resolvingIncidentId, setResolvingIncidentId] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState<ErTeamTab>("home")
  const [dispatchOverlay, setDispatchOverlay] = React.useState<TeamDispatchNotification | null>(null)
  const [dispatchNotifications, setDispatchNotifications] = React.useState<TeamDispatchNotification[]>([])
  const [hasUnreadDispatchAlert, setHasUnreadDispatchAlert] = React.useState(false)
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = React.useState(false)
  const [lastAssignedRefresh, setLastAssignedRefresh] = React.useState<number>(0)

  // Notification handler for realtime
  const handleNewDispatch = React.useCallback((notification: TeamDispatchNotification) => {
    setDispatchNotifications(prev => [notification, ...prev.slice(0, MAX_DISPATCH_NOTIFICATIONS - 1)])
    setHasUnreadDispatchAlert(true)
    
    // Show overlay
    if (lastDispatchOverlayIdRef.current !== notification.id) {
      setDispatchOverlay(notification)
      if (dispatchOverlayTimeoutRef.current) {
        clearTimeout(dispatchOverlayTimeoutRef.current)
      }
      dispatchOverlayTimeoutRef.current = setTimeout(() => {
        setDispatchOverlay(null)
        dispatchOverlayTimeoutRef.current = null
      }, DISPATCH_OVERLAY_DURATION_MS)
      lastDispatchOverlayIdRef.current = notification.id
    }

    // Use Capacitor notifications
    CapacitorNotifications.showDispatchAlert({
      title: 'ER Team Dispatch Alert',
      body: `${notification.incidentType ?? "Incident"}: ${notification.locationAddress ?? "Location pending"}`,
      id: notification.id.toString(),
      sound: true,
      extra: {
        emergencyReportId: notification.emergencyReportId,
        eventType: notification.eventType,
      }
    }).catch((error) => {
      console.warn('Failed to show Capacitor notification:', error)
    })
  }, [])

  // Optimized realtime subscriptions
  useErTeamRealtime({
    teamId: profile.teamId,
    isAuthorized: profile.profileStatus === "authorized",
    userId: profile.userId,
    assignedIncidents,
    userLocation,
    onAssignedIncidentChange: refreshAssignedIncidents,
    onReportChange: refreshReports,
    onInternalReportChange: refreshAssignedIncidents,
    onNewDispatch: handleNewDispatch,
    onInstantIncidentUpdate: instantUpdateIncident,
  })

  const dispatchOverlayTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const assignedIncidentIdsRef = React.useRef<Set<string>>(new Set())
  const lastDispatchOverlayIdRef = React.useRef<string | null>(null)

  // Derived state
  const latestAssignedIncident = assignedIncidents[0] ?? null
  const selectedIncident = selectedIncidentId 
    ? assignedIncidents.find(incident => incident.id === selectedIncidentId) ?? latestAssignedIncident
    : latestAssignedIncident

  const activeDraft = React.useMemo(
    () => drafts.find((item) => item.clientDraftId === activeDraftId) ?? null,
    [drafts, activeDraftId]
  )

  // Update incident IDs ref
  React.useEffect(() => {
    assignedIncidentIdsRef.current = new Set(assignedIncidents.map((incident) => incident.id))
  }, [assignedIncidents])

  // Load drafts when authorized
  React.useEffect(() => {
    if (profile.profileStatus !== "authorized" || !profile.teamId) {
      setDrafts((prev) => (prev.length > 0 ? [] : prev))
      setIsLoading((prev) => (prev ? false : prev))
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        await migrateLegacyDrafts()
        const storedDrafts = await loadDraftsFromDB()
        if (!cancelled) {
          setDrafts(storedDrafts)
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Failed to load ER team drafts", error)
        if (!cancelled) {
          setDrafts([])
          setIsLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [profile.profileStatus, profile.teamId])

  // Merge drafts with assigned incidents
  const applyDraftMerge = React.useCallback((incidents: AssignedIncident[]) => {
    setDrafts((prevDrafts) => {
      const nextDrafts = mergeDraftsWithAssigned(prevDrafts, incidents)
      void (async () => {
        const nextIds = new Set(nextDrafts.map((draft) => draft.clientDraftId))
        await Promise.all(
          prevDrafts
            .filter((draft) => !nextIds.has(draft.clientDraftId))
            .map((draft: LocalDraft) => removeDraft(draft.clientDraftId))
        )
        await upsertDrafts(nextDrafts)
      })()
      return nextDrafts
    })
  }, [])

  // Apply draft merge when incidents change
  React.useEffect(() => {
    if (assignedIncidents.length > 0) {
      applyDraftMerge(assignedIncidents)
    }
  }, [assignedIncidents, applyDraftMerge])

  // Auto-select first incident
  React.useEffect(() => {
    if (!latestAssignedIncident) {
      if (selectedIncidentId !== null) {
        setSelectedIncidentId(null)
      }
      return
    }

    if (!selectedIncidentId) {
      setSelectedIncidentId(latestAssignedIncident.id)
      return
    }

    const stillAssigned = assignedIncidents.some((incident) => incident.id === selectedIncidentId)
    if (!stillAssigned) {
      setSelectedIncidentId(latestAssignedIncident.id)
    }
  }, [assignedIncidents, latestAssignedIncident, selectedIncidentId])

  // Network status listeners
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Refresh when coming online
  React.useEffect(() => {
    if (isOnline && profile.profileStatus === "authorized") {
      void refreshReports()
      void refreshAssignedIncidents()
    }
  }, [isOnline, profile.profileStatus, refreshReports, refreshAssignedIncidents])

  // Periodic session extension
  React.useEffect(() => {
    const extendSession = async () => {
      if (navigator.onLine && profile.profileStatus === "authorized") {
        console.log("[ER Team] Extending session...")
        const success = await extendErTeamSession(supabase)
        if (success) {
          console.log("[ER Team] Session extended successfully")
        }
      }
    }

    const initialTimeout = setTimeout(() => {
      void extendSession()
    }, 5 * 60 * 1000)

    const interval = setInterval(() => {
      void extendSession()
    }, 15 * 60 * 1000)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [profile.profileStatus])

  // Periodic refresh and app state management
  React.useEffect(() => {
    if (profile.profileStatus !== "authorized" || !profile.teamId) {
      return
    }

    const intervalId = setInterval(() => {
      if (!assignedLoading) {
        console.log('Periodic refresh: checking for new assigned incidents')
        void refreshAssignedIncidents()
      }
    }, 30000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !assignedLoading) {
        console.log('Tab became visible: refreshing assigned incidents')
        void refreshAssignedIncidents()
        void refreshReports()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const handleAppStateChange = async ({ isActive }: { isActive: boolean }) => {
      if (isActive) {
        console.log('📱 App became active (foreground): refreshing all data')
        try {
          await forceRefreshData()
          await Promise.all([
            refreshAssignedIncidents(), 
            refreshReports()
          ])
        } catch (err) {
          console.error('Error refreshing data on app resume:', err)
        }
      }
    }
    
    const listenerPromise = App.addListener('appStateChange', handleAppStateChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      listenerPromise.then(handle => handle.remove())
    }
  }, [profile.profileStatus, profile.teamId, assignedLoading, refreshAssignedIncidents, refreshReports])

  // Sync draft to server
  const syncDraft = React.useCallback(async (draft: LocalDraft): Promise<LocalDraft> => {
    if (!draft.emergencyReportId) {
      return {
        ...draft,
        synced: false,
        lastSyncError: "Draft is missing its assigned incident linkage.",
        updatedAt: new Date().toISOString(),
      }
    }

    if (!navigator.onLine) {
      return {
        ...draft,
        synced: false,
        lastSyncError: "Offline – will retry when connection is restored.",
        updatedAt: new Date().toISOString(),
      }
    }

    try {
      const response = await fetch("/api/er-team/reports/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          clientDraftId: draft.clientDraftId,
          emergencyReportId: draft.emergencyReportId,
          status: draft.status,
          patientPayload: draft.patientsPayload ?? [],
          incidentPayload: draft.incidentPayload ?? undefined,
          injuryPayload: draft.injuryPayload ?? undefined,
          notes: typeof draft.notes === "string" ? draft.notes : undefined,
          submittedAt: draft.submittedAt ?? new Date().toISOString(),
          internalReportId: typeof draft.internalReportId === "number" ? draft.internalReportId : undefined,
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        report?: {
          synced_at?: string | null
          updated_at?: string
          internal_report_id?: number | null
        }
        error?: string
        details?: Record<string, unknown>
      }

      if (!response.ok) {
        const message = typeof payload?.error === "string" && payload.error.length > 0 ? payload.error : response.statusText
        const err = new Error(message || "Failed to save draft")
        ;(err as { status?: number }).status = response.status
        if (payload?.details) {
          ;(err as { details?: Record<string, unknown> }).details = payload.details
        }
        throw err
      }

      const submittedAt = payload?.report?.synced_at ?? new Date().toISOString()
      return {
        ...draft,
        synced: true,
        lastSyncError: null,
        submittedAt,
        updatedAt: payload?.report?.updated_at ?? submittedAt,
        internalReportId: payload?.report?.internal_report_id ?? draft.internalReportId ?? null,
      }
    } catch (error: any) {
      console.error("Failed to sync ER draft", error)
      const status = (error as { status?: number }).status
      const details = (error as { details?: Record<string, unknown> }).details
      const message = typeof error?.message === "string" && error.message.length > 0 ? error.message : "Failed to sync"
      
      if (status === 403 || message.toLowerCase().includes("not assigned")) {
        const incidentTeamId = typeof details?.incidentTeamId === "number" ? details.incidentTeamId : undefined
        const userTeamId = typeof details?.userTeamId === "number" ? details.userTeamId : undefined
        const incidentId = typeof details?.incidentId === "string" ? details.incidentId : undefined
        setAssignedError(
          incidentTeamId && userTeamId
            ? `Incident ${incidentId ?? ""} is assigned to team ${incidentTeamId}, but you are logged in under team ${userTeamId}. Refreshing assigned incidents…`
            : "This incident is no longer assigned to your ER team. Refreshing assigned incidents…"
        )
        void refreshAssignedIncidents()
      }
      
      return {
        ...draft,
        synced: false,
        lastSyncError: message,
        updatedAt: new Date().toISOString(),
      }
    }
  }, [refreshAssignedIncidents, setAssignedError])

  // Mark incident as resolved
  const handleMarkResolved = React.useCallback(
    async (incidentId: string) => {
      if (!incidentId) return
      setResolvingIncidentId(incidentId)
      setAssignedError(null)
      
      try {
        const response = await fetch("/api/er-team/incident/respond", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ incidentId }),
        })

        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean
          respondedAt?: string | null
          resolvedAt?: string | null
          status?: string | null
          error?: string
        }

        if (!response.ok || payload?.ok !== true) {
          const message = payload?.error ?? response.statusText ?? "Failed to mark as responded"
          throw new Error(message)
        }

        // Update incident locally
        const incident = assignedIncidents.find(i => i.id === incidentId)
        if (incident) {
          updateIncident({
            ...incident,
            responded_at: payload?.respondedAt ?? incident.responded_at ?? new Date().toISOString(),
            resolved_at: payload?.resolvedAt ?? new Date().toISOString(),
            status: payload?.status ?? incident.status,
          })
        }
      } catch (error: any) {
        console.error("[er-team] failed to mark incident responded", error)
        if (!assignedError) {
          setAssignedError(error?.message ?? "Failed to mark incident as responded.")
        }
      } finally {
        setResolvingIncidentId(null)
        void refreshAssignedIncidents()
      }
    },
    [assignedIncidents, refreshAssignedIncidents, setAssignedError, updateIncident],
  )

  // Draft handlers
  const handleOpenDraft = React.useCallback((draftId: string) => {
    if (profile.profileStatus !== "authorized" || !profile.teamId) {
      return
    }
    setActiveDraftId(draftId)
    setIsSheetOpen(true)
  }, [profile.profileStatus, profile.teamId])

  const handleCloseSheet = React.useCallback(() => {
    setIsSheetOpen(false)
    setActiveDraftId(null)
  }, [])

  const handleDraftChange = React.useCallback((nextDraft: ErTeamDraft) => {
    setDrafts((prev) => {
      const normalized: LocalDraft = {
        ...nextDraft,
        synced: false,
        lastSyncError: null,
        updatedAt: new Date().toISOString(),
      }
      return prev.map((item) => (item.clientDraftId === normalized.clientDraftId ? normalized : item))
    })
    const normalized: LocalDraft = {
      ...nextDraft,
      synced: false,
      lastSyncError: null,
      updatedAt: new Date().toISOString(),
    }
    void upsertDraft(normalized)
  }, [])

  const handleDraftSync = React.useCallback(
    async (draft: LocalDraft) => {
      if (profile.profileStatus !== "authorized") {
        return draft
      }

      if (!draft.emergencyReportId) {
        if (!assignedError) {
          setAssignedError("This draft is missing its assigned incident. Refresh assigned incidents and try again.")
        }
        return {
          ...draft,
          synced: false,
          lastSyncError: "Draft is missing its assigned incident linkage.",
        }
      }

      const isStillAssigned = assignedIncidents.some((incident) => incident.id === draft.emergencyReportId)
      if (!isStillAssigned) {
        setAssignedError("This incident is no longer assigned to your ER team. Refreshing assigned incidents…")
        void refreshAssignedIncidents()
        return {
          ...draft,
          synced: false,
          lastSyncError: "Incident is no longer assigned to your ER team.",
        }
      }

      const result = await syncDraft(draft)
      setDrafts((prev) => prev.map((item) => (item.clientDraftId === draft.clientDraftId ? result : item)))
      await upsertDraft(result)
      return result
    },
    [assignedIncidents, profile.profileStatus, refreshAssignedIncidents, syncDraft, setAssignedError]
  )

  const handleSubmitForReview = React.useCallback(
    async (draft: ErTeamDraft) => {
      if (!draft.emergencyReportId) {
        setAssignedError("This draft no longer has an incident linked to it. Please refresh assigned incidents and try again.")
        return
      }

      const isStillAssigned = assignedIncidents.some((incident) => incident.id === draft.emergencyReportId)
      if (!isStillAssigned) {
        setAssignedError("This incident is no longer assigned to your ER team. Refreshing assigned incidents…")
        void refreshAssignedIncidents()
        return
      }

      try {
        setIsSubmitting(true)
        const result = await handleDraftSync({ ...draft, status: "pending_review" })
        if (result.synced) {
          setActiveDraftId(null)
          setIsSheetOpen(false)
          await Promise.all([refreshReports(), refreshAssignedIncidents()])
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    [assignedIncidents, handleDraftSync, refreshReports, refreshAssignedIncidents, setAssignedError]
  )

  // Notification handlers
  const showDispatchOverlay = React.useCallback((notification: TeamDispatchNotification) => {
    setDispatchOverlay(notification)
    if (dispatchOverlayTimeoutRef.current) {
      clearTimeout(dispatchOverlayTimeoutRef.current)
    }
    dispatchOverlayTimeoutRef.current = setTimeout(() => {
      setDispatchOverlay(null)
      dispatchOverlayTimeoutRef.current = null
    }, DISPATCH_OVERLAY_DURATION_MS)
  }, [])

  const handleDismissDispatchOverlay = React.useCallback(() => {
    const latestIncident = assignedIncidents[0]
    if (latestIncident) {
      setSelectedIncidentId(latestIncident.id)
    }
    if (dispatchOverlayTimeoutRef.current) {
      clearTimeout(dispatchOverlayTimeoutRef.current)
      dispatchOverlayTimeoutRef.current = null
    }
    setDispatchOverlay(null)
  }, [assignedIncidents])

  const handleNotificationPopoverChange = React.useCallback((open: boolean) => {
    setIsNotificationDropdownOpen(open)
    if (open) {
      setHasUnreadDispatchAlert(false)
    }
  }, [])

  const handleClearDispatchNotifications = React.useCallback(() => {
    setDispatchNotifications([])
    setHasUnreadDispatchAlert(false)
    setIsNotificationDropdownOpen(false)
  }, [])

  const handleMarkAllAsRead = React.useCallback(() => {
    setHasUnreadDispatchAlert(false)
    setIsNotificationDropdownOpen(false)
  }, [])

  // Cleanup overlay timeout
  React.useEffect(() => {
    return () => {
      if (dispatchOverlayTimeoutRef.current) {
        clearTimeout(dispatchOverlayTimeoutRef.current)
        dispatchOverlayTimeoutRef.current = null
      }
    }
  }, [])

  // Context value
  const contextValue = React.useMemo(
    () => ({
      drafts,
      reports,
      assignedIncidents,
      teamId: profile.teamId,
      teamName: profile.teamName,
      userLocation,
      locationPermission,
      isOnline,
      barangays,
      incidentTypes,
      isLoading,
      loadingReports,
      assignedLoading,
      activeTab,
      activeDraftId,
      isSheetOpen,
      selectedIncidentId,
      setActiveTab,
      setActiveDraftId,
      setIsSheetOpen,
      setSelectedIncidentId,
      refreshReports,
      refreshAssignedIncidents,
      handleOpenDraft,
      handleMarkResolved,
      requestLocation,
      formatDateTime,
      formatStatusLabel,
    }),
    [
      drafts,
      reports,
      assignedIncidents,
      profile.teamId,
      profile.teamName,
      userLocation,
      locationPermission,
      isOnline,
      barangays,
      incidentTypes,
      isLoading,
      loadingReports,
      assignedLoading,
      activeTab,
      activeDraftId,
      isSheetOpen,
      selectedIncidentId,
      refreshReports,
      refreshAssignedIncidents,
      handleOpenDraft,
      handleMarkResolved,
      requestLocation,
    ]
  )

  // Loading state
  if (isLoading || profile.profileStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center" style={DASHBOARD_BACKGROUND_STYLE}>
        <div className="rounded-lg bg-orange-50/85 px-6 py-4 text-sm text-orange-700 shadow-lg backdrop-blur">
          Loading ER team dashboard…
        </div>
      </div>
    )
  }

  // Error state
  if (profile.profileStatus === "error") {
    return (
      <div className="min-h-screen" style={DASHBOARD_BACKGROUND_STYLE}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-orange-50/85 px-4 text-center backdrop-blur-sm">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Unable to verify ER team assignment</h1>
            <p className="mt-2 text-sm text-gray-600">{profile.profileError ?? "An unexpected error occurred while checking your ER team access."}</p>
          </div>
          <Button onClick={profile.reloadProfile} className="bg-orange-600 hover:bg-orange-700">
            Retry
          </Button>
          <Button variant="ghost" onClick={() => {
            profile.logout()
            onLogout()
          }} className="text-sm text-orange-600 hover:text-orange-700">
            Sign out
          </Button>
        </div>
      </div>
    )
  }

  // Unauthorized state
  if (profile.profileStatus === "unauthorized" || !profile.teamId) {
    return (
      <div className="min-h-screen" style={DASHBOARD_BACKGROUND_STYLE}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-orange-50/85 px-4 text-center backdrop-blur-sm">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">ER team access pending</h1>
            <p className="mt-2 text-sm text-gray-600">
              Your account does not have an ER team assignment yet. Please contact an administrator to complete your access.
            </p>
          </div>
          <Button onClick={profile.reloadProfile} className="bg-orange-600 hover:bg-orange-700">
            Check again
          </Button>
          <Button variant="ghost" onClick={() => {
            profile.logout()
            onLogout()
          }} className="text-sm text-orange-600 hover:text-orange-700">
            Sign out
          </Button>
        </div>
      </div>
    )
  }

  // Main dashboard
  return (
    <ErTeamProvider value={contextValue}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20" style={{ ...DASHBOARD_BACKGROUND_STYLE, backgroundBlendMode: "overlay" }}>
        <div className="flex min-h-screen flex-col">
          {/* Dispatch Overlay */}
          {dispatchOverlay && (
            <div className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center bg-black/40 px-4 py-8">
              <div className="pointer-events-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-white/30 bg-white/95 shadow-[0_28px_80px_-24px_rgba(16,24,40,0.45)] backdrop-blur-lg">
                <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 px-6 py-5 text-white">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/25 text-white">
                        <Bell className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/80">New Dispatch</p>
                        <h2 className="text-xl font-semibold leading-tight">{dispatchOverlay.incidentType ?? "Incident assignment"}</h2>
                      </div>
                    </div>
                    <Button variant="ghost" onClick={handleDismissDispatchOverlay} className="text-white hover:bg-white/20">
                      Close
                    </Button>
                  </div>
                </div>
                <div className="space-y-6 px-6 py-6 text-gray-900">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-orange-600">Reporter</p>
                      <p className="text-base font-medium text-gray-900">{dispatchOverlay.reporterName ?? "Unknown"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-orange-600">Reported</p>
                      <p className="text-base text-gray-700">{dispatchOverlay.reportedAt ? formatDateTime(dispatchOverlay.reportedAt) ?? dispatchOverlay.reportedAt : "Just now"}</p>
                    </div>
                  </div>
                  {dispatchOverlay.locationAddress && (
                    <div className="rounded-2xl border border-orange-100 bg-orange-50/80 px-4 py-3 text-sm text-orange-800">
                      <p className="font-medium">Location</p>
                      <p>{dispatchOverlay.locationAddress}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 justify-end">
                    <Button variant="outline" onClick={handleDismissDispatchOverlay} className="border-orange-200 text-orange-600 hover:bg-orange-50">
                      Dismiss
                    </Button>
                    {(() => {
                      const overlayDraft = drafts.find((draft) => draft.emergencyReportId === dispatchOverlay.emergencyReportId)
                      return overlayDraft ? (
                        <Button
                          className="bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg hover:from-orange-600 hover:to-red-600"
                          onClick={() => {
                            handleOpenDraft(overlayDraft.clientDraftId)
                            handleDismissDispatchOverlay()
                          }}
                        >
                          Open Draft
                        </Button>
                      ) : null
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <header className="sticky top-0 z-20 flex flex-col gap-1 bg-gradient-to-r from-orange-500 via-orange-600 to-red-500/95 px-4 py-1 text-white shadow-xl backdrop-blur-sm border-b border-orange-400/30 sm:px-6 min-h-[56px] h-14 w-full safe-top">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-sm font-bold sm:text-base bg-gradient-to-r from-white to-orange-100 bg-clip-text text-transparent">ER TEAM DASHBOARD</h1>
                {profile.profileError && (
                  <p className="mt-2 text-xs sm:text-sm text-red-200 bg-red-500/20 px-3 py-1 rounded-md border border-red-400/30">{profile.profileError}</p>
                )}
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Refresh data"
                  onClick={() => window.location.reload()}
                  disabled={!isOnline}
                  className="text-white/90 hover:bg-white/20 hover:text-white rounded-full p-2 transition-all duration-200 backdrop-blur-sm"
                >
                  <RefreshCw className="h-5 w-5" />
                </Button>

                {/* Notifications Popover */}
                <Popover open={isNotificationDropdownOpen} onOpenChange={handleNotificationPopoverChange}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={hasUnreadDispatchAlert ? "View new dispatch notification" : "Dispatch notifications"}
                      className={cn(
                        "relative text-white/90 hover:bg-white/20 hover:text-white rounded-full p-2 transition-all duration-200 backdrop-blur-sm",
                        hasUnreadDispatchAlert && "text-white bg-white/20 animate-pulse",
                      )}
                    >
                      <Bell className="h-5 w-5" />
                      {hasUnreadDispatchAlert && (
                        <span className="absolute -top-1 -right-1 inline-flex h-3 w-3 rounded-full bg-red-500 animate-ping"></span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 border-orange-200/50 bg-white/95 backdrop-blur-md p-0 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-orange-100/50 px-4 py-3 bg-gradient-to-r from-orange-50 to-white">
                      <span className="text-sm font-semibold text-orange-900">Dispatch notifications</span>
                      {dispatchNotifications.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleMarkAllAsRead}
                          className="h-auto px-3 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50 rounded-full transition-colors"
                        >
                          Mark as Read
                        </Button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {dispatchNotifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-gray-500">
                          <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                          When an admin dispatches a new incident to your team, it will appear here.
                        </div>
                      ) : (
                        <ul className="divide-y divide-orange-100/30">
                          {dispatchNotifications.map((notification) => {
                            const timeLabel = formatDateTime(notification.respondedAt ?? notification.createdAt) ?? "Just now"
                            return (
                              <li key={notification.id} className="px-4 py-4 hover:bg-orange-50/30 transition-colors">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <span className="font-semibold text-gray-900 truncate">{notification.reporterName}</span>
                                      <span className="text-xs text-gray-500 flex-shrink-0">{timeLabel}</span>
                                    </div>
                                    {notification.incidentType && (
                                      <div className="mb-2">
                                        <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                                          {notification.incidentType}
                                        </span>
                                      </div>
                                    )}
                                    {notification.locationAddress && (
                                      <div className="text-xs text-gray-500 mb-2">{notification.locationAddress}</div>
                                    )}
                                  </div>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* User Profile Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="User profile"
                      className="text-white/90 hover:bg-white/20 hover:text-white rounded-full p-2 transition-all duration-200 backdrop-blur-sm"
                    >
                      <User className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 border-orange-200/50 bg-white/95 backdrop-blur-md p-0 shadow-2xl">
                    <div className="p-4 border-b border-orange-100/50">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white">
                          <User className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 truncate">
                            {profile.userFirstName && profile.userLastName ? `${profile.userFirstName} ${profile.userLastName}` : "User"}
                          </div>
                          <div className="text-sm text-gray-500 truncate">{profile.userEmail || "No email"}</div>
                          {profile.teamName && (
                            <div className="text-xs text-orange-600 font-medium mt-1">
                              {profile.teamName} Team
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors mb-1"
                        onClick={async () => {
                          try {
                            await forceRefreshData()
                            await Promise.all([refreshAssignedIncidents(), refreshReports()])
                          } catch (error) {
                            console.error("Error during manual refresh:", error)
                          }
                        }}
                      >
                        <RefreshCw className="w-4 h-4 mr-3" />
                        Force Refresh Data
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-start text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Sign out
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-orange-200/50">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-orange-900">Sign out confirmation</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to sign out? You will need to log in again to access the dashboard.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="border-orange-200 text-orange-700 hover:bg-orange-50">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                clearErTeamSession()
                                onLogout()
                              }}
                              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                            >
                              Sign out
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 space-y-6 px-4 py-6 sm:px-6 pb-24">
            {activeTab === "home" ? (
              <HomePage />
            ) : activeTab === "drafts" ? (
              <DraftsPage />
            ) : activeTab === "report-form" ? (
              <ReportFormPage />
            ) : activeTab === "reports" ? (
              <ReportsPage />
            ) : (
              <AccommodatedPage />
            )}
          </main>

          {/* Bottom Navigation */}
          <ErTeamBottomNav
            activeTab={activeTab}
            onTabChange={setActiveTab}
            draftCount={drafts.filter((draft) => draft.status === "draft").length}
          />

          {/* Draft Sheet */}
          <Sheet
            open={isSheetOpen}
            onOpenChange={(open) => {
              setIsSheetOpen(open)
              if (!open) {
                setActiveDraftId(null)
              }
            }}
          >
            <SheetContent side="bottom" className="flex h-full flex-col overflow-hidden p-0">
              <div className="relative flex-1 min-h-0 overflow-y-auto">
                {activeDraft && (
                  <ErTeamReportForm
                    draft={activeDraft}
                    hospitals={hospitals}
                    barangays={barangays}
                    incidentInfo={(() => {
                      const incident = assignedIncidents.find(i => i.id === activeDraft.emergencyReportId)
                      if (!incident) return undefined
                      return {
                        reporterName: `${incident.firstName || ''} ${incident.lastName || ''}`.trim() || 'Unknown Reporter',
                        incidentType: incident.emergency_type || 'Unknown Type',
                        locationAddress: incident.location_address || 'Unknown Location'
                      }
                    })()}
                    onDraftChange={handleDraftChange}
                    onSubmitForReview={handleSubmitForReview}
                    onClose={() => {
                      setActiveDraftId(null)
                      setIsSheetOpen(false)
                      setActiveTab('home')
                    }}
                    isSubmitting={isSubmitting}
                  />
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </ErTeamProvider>
  )
}
