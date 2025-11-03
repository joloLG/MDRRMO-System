"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import {
  loadDrafts as loadDraftsFromDB,
  upsertDraft,
  upsertDrafts,
  loadReference,
  saveReference,
  removeDraft,
} from "@/lib/er-team-storage"
import { Bell, Loader2, RefreshCw, WifiOff, Wifi } from "lucide-react"
import {
  ErTeamReportForm,
  DEFAULT_PATIENT_TEMPLATE,
  DEFAULT_INJURY_TEMPLATE,
  HOSPITAL_OPTIONS,
  type ErTeamDraft,
  type ErTeamDraftStatus,
  type InjuryMap,
  type ReferenceOption,
  type ErTeamPatientPayload,
} from "./er-team-report-form"

// Capacitor imports
import { CapacitorGeolocation, type LocationCoords, type LocationError } from "@/lib/capacitor-geolocation"
import { CapacitorNotifications } from "@/lib/capacitor-notifications"

const LocationMap = dynamic(() => import("@/components/LocationMap"), { ssr: false })
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

interface AssignedIncident {
  id: string
  status: string
  emergency_type: string | null
  location_address: string | null
  latitude: number | null
  longitude: number | null
  firstName: string | null
  lastName: string | null
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

type LocalDraft = ErTeamDraft

interface SyncedReport {
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

interface ReferenceCache {
  barangays: ReferenceOption[]
  incidentTypes: ReferenceOption[]
}

const PROFILE_CACHE_KEY = "mdrrmo_er_team_profile"

interface ProfileCacheRecord {
  teamId: number | null
  teamName: string | null
  cachedAt: string
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

const deepCopy = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
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

async function migrateLegacyReferences() {
  if (typeof window === "undefined") return
  try {
    const raw = window.localStorage.getItem("mdrrmo_er_team_references")
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return
    if (Array.isArray(parsed.incidentTypes)) {
      await saveReference("incidentTypes", parsed.incidentTypes)
    }
    window.localStorage.removeItem("mdrrmo_er_team_references")
  } catch (error) {
    console.warn("Failed to migrate legacy ER references", error)
  }
}

const VALID_DRAFT_STATUSES: ErTeamDraftStatus[] = ["draft", "pending_review", "in_review", "approved", "rejected"]
const ASSIGNED_PAGE_SIZE = 10
const REPORTS_PAGE_SIZE = 10

type ReportsStatusFilter = "all" | ErTeamDraftStatus
const REPORT_STATUS_OPTIONS: ReportsStatusFilter[] = ["all", ...VALID_DRAFT_STATUSES]
const DISPATCH_OVERLAY_DURATION_MS = 10_000

const STATUS_BADGE_STYLES: Record<ErTeamDraftStatus, string> = {
  draft: "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 border border-gray-300 shadow-sm",
  pending_review: "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border border-amber-300 shadow-sm",
  in_review: "bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-300 shadow-sm",
  approved: "bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-300 shadow-sm",
  rejected: "bg-gradient-to-r from-red-100 to-pink-100 text-red-800 border border-red-300 shadow-sm",
}

const SYNC_BADGE_CLASSES: Record<"synced" | "pending", string> = {
  synced: "bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-300 shadow-sm",
  pending: "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border border-amber-300 shadow-sm",
}

const formatStatusLabel = (status: ErTeamDraftStatus) =>
  status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")

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

const formatStatusDisplay = (status?: string | null) => {
  if (!status) return null
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

const parseCoordinate = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const mapNotificationRow = (row: Record<string, any>): TeamDispatchNotification => {
  const payload = (row?.payload ?? {}) as Record<string, any>
  const reporterFirst = typeof payload.reporter_first_name === "string" ? payload.reporter_first_name : ""
  const reporterLast = typeof payload.reporter_last_name === "string" ? payload.reporter_last_name : ""
  const reporterName = `${reporterFirst} ${reporterLast}`.trim() || null

  const incidentType = typeof payload.incident_type === "string" ? payload.incident_type : null
  const locationAddress = typeof payload.location_address === "string" ? payload.location_address : null
  const reportedAt = typeof payload.reported_at === "string" ? payload.reported_at : null
  const respondedAt = typeof payload.responded_at === "string" ? payload.responded_at : null
  const previousTeamId =
    typeof payload.previous_er_team_id === "number"
      ? payload.previous_er_team_id
      : typeof payload.previous_er_team_id === "string"
        ? Number(payload.previous_er_team_id)
        : null
  const incidentLatitude = parseCoordinate(payload.incident_latitude)
  const incidentLongitude = parseCoordinate(payload.incident_longitude)

  return {
    id: String(row?.id ?? crypto.randomUUID()),
    eventType: row?.event_type === "status_change" ? "status_change" : "assignment",
    emergencyReportId: String(row?.emergency_report_id ?? ""),
    erTeamId: typeof row?.er_team_id === "number" ? row.er_team_id : null,
    erTeamReportId: typeof row?.er_team_report_id === "string" ? row.er_team_report_id : null,
    reporterName,
    incidentType,
    locationAddress,
    reportedAt,
    respondedAt,
    oldStatus: typeof row?.old_status === "string" ? row.old_status : null,
    newStatus: typeof row?.new_status === "string" ? row.new_status : null,
    createdAt: typeof row?.created_at === "string" ? row.created_at : new Date().toISOString(),
    previousTeamId,
    originLatitude: parseCoordinate(row?.origin_latitude),
    originLongitude: parseCoordinate(row?.origin_longitude),
    incidentLatitude,
    incidentLongitude,
  }
}

const isRowAssignedToTeam = (row: Record<string, any> | null | undefined, teamId: number): boolean => {
  if (!row || typeof row !== "object") return false
  const rowTeamId = typeof row.er_team_id === "number" ? row.er_team_id : null
  return rowTeamId === teamId
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
  const patientPayload: Partial<ErTeamPatientPayload> = basePatientPayload && typeof basePatientPayload === "object"
    ? deepCopy(basePatientPayload as Record<string, any>)
    : (deepCopy(DEFAULT_PATIENT_TEMPLATE) as Record<string, any>)

  const baseIncidentPayload = incident.er_team_report?.incident_payload
  const incidentPayload = baseIncidentPayload && typeof baseIncidentPayload === "object"
    ? deepCopy(baseIncidentPayload as Record<string, any>)
    : {}

  if (!incidentPayload.incidentDate && incident.created_at) {
    incidentPayload.incidentDate = incident.created_at.slice(0, 10)
  }
  if (!incidentPayload.incidentTime && incident.created_at) {
    incidentPayload.incidentTime = incident.created_at.slice(11, 16)
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
      estimatedBloodLoss: "",
      turnoverInCharge: "",
      receivingHospitalId: "",
      receivingDate: "",
      emtErtDate: "",
      firstName: "",
      middleName: "",
      lastName: "",
      suffix: "",
      contactNumber: "",
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

  const uniqueDrafts = mergedDrafts.filter((draft, index, self) => self.findIndex((candidate) => candidate.clientDraftId === draft.clientDraftId) === index)

  return uniqueDrafts.sort((a, b) => {
    const orderA = incidentOrder.get(a.emergencyReportId ?? "") ?? Number.MAX_SAFE_INTEGER
    const orderB = incidentOrder.get(b.emergencyReportId ?? "") ?? Number.MAX_SAFE_INTEGER
    return orderA - orderB
  })
}

const SUPABASE_CHANNEL_PREFIX = "er-team-dashboard-"
const ASSIGNED_REFRESH_DEBOUNCE_MS = 900
const ALERT_COOLDOWN_MS = 60_000
const ALERT_SOUND_PATH = "/sounds/alert.mp3"
const MAX_DISPATCH_NOTIFICATIONS = 6

export function ErTeamDashboard({ onLogout }: ErTeamDashboardProps) {
  const [isOnline, setIsOnline] = React.useState<boolean>(() => (typeof navigator !== "undefined" ? navigator.onLine : true))
  const [drafts, setDrafts] = React.useState<LocalDraft[]>([])
  const [reports, setReports] = React.useState<SyncedReport[]>([])
  const [loadingReports, setLoadingReports] = React.useState(true)
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadingError, setLoadingError] = React.useState<string | null>(null)
  const [activeDraftId, setActiveDraftId] = React.useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [barangays, setBarangays] = React.useState<ReferenceOption[]>([])
  const [incidentTypes, setIncidentTypes] = React.useState<ReferenceOption[]>([])
  const [referenceError, setReferenceError] = React.useState<string | null>(null)
  const [profileStatus, setProfileStatus] = React.useState<"loading" | "authorized" | "unauthorized" | "error">("loading")
  const [profileError, setProfileError] = React.useState<string | null>(null)
  const [teamId, setTeamId] = React.useState<number | null>(null)
  const [teamName, setTeamName] = React.useState<string | null>(null)
  const [profileReloadIndex, setProfileReloadIndex] = React.useState(0)
  const [assignedIncidents, setAssignedIncidents] = React.useState<AssignedIncident[]>([])
  const [assignedLoading, setAssignedLoading] = React.useState(false)
  const [lastAssignedRefresh, setLastAssignedRefresh] = React.useState<number>(0)
  const [assignedError, setAssignedError] = React.useState<string | null>(null)
  const [assignedPage, setAssignedPage] = React.useState(1)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [selectedIncidentId, setSelectedIncidentId] = React.useState<string | null>(null)
  const [resolvingIncidentId, setResolvingIncidentId] = React.useState<string | null>(null)
  const [userLocation, setUserLocation] = React.useState<LocationCoords | null>(null)
  const [locationPermission, setLocationPermission] = React.useState<'granted' | 'denied' | 'prompt' | 'unknown' | string>('unknown')
  const [locationError, setLocationError] = React.useState<string | null>(null)
  const [isGettingLocation, setIsGettingLocation] = React.useState(false)
  const [reportsStatusFilter, setReportsStatusFilter] = React.useState<ReportsStatusFilter>("all")
  const [reportsPage, setReportsPage] = React.useState(1)
  const [dispatchOverlay, setDispatchOverlay] = React.useState<TeamDispatchNotification | null>(null)
  const dispatchOverlayTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

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
    // Always select the latest assigned incident when dismissing overlay
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

  React.useEffect(() => {
    return () => {
      if (dispatchOverlayTimeoutRef.current) {
        clearTimeout(dispatchOverlayTimeoutRef.current)
        dispatchOverlayTimeoutRef.current = null
      }
    }
  }, [])

  const assignedIncidentIdsRef = React.useRef<Set<string>>(new Set())
  const [dispatchNotifications, setDispatchNotifications] = React.useState<TeamDispatchNotification[]>([])
  const [hasUnreadDispatchAlert, setHasUnreadDispatchAlert] = React.useState(false)
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = React.useState(false)
  const isNotificationDropdownOpenRef = React.useRef(false)
  const lastDispatchOverlayIdRef = React.useRef<string | null>(null)

  const latestAssignedIncident = assignedIncidents[0] ?? null
  const selectedIncident = latestAssignedIncident

  const canMarkSelectedIncidentResolved = React.useMemo(() => {
    if (!selectedIncident) return false
    const resolvedAt = selectedIncident.resolved_at
    const status = typeof selectedIncident.status === "string" ? selectedIncident.status.toLowerCase() : ""
    const erReportStatus = typeof selectedIncident.er_team_report?.status === "string" ? selectedIncident.er_team_report.status.toLowerCase() : ""
    const erReportResolvedAt = selectedIncident.er_team_report?.synced_at ?? null

    const isResolvedStatus = status === "resolved" || status === "completed"
    const isReportResolvedStatus = erReportStatus === "resolved" || erReportStatus === "completed"

    return !(resolvedAt || erReportResolvedAt || isResolvedStatus || isReportResolvedStatus)
  }, [selectedIncident])

  const selectedIncidentCoords = React.useMemo(() => {
    if (!selectedIncident) return null
    const lat = typeof (selectedIncident as any).latitude === "number" ? (selectedIncident as any).latitude : null
    const lng = typeof (selectedIncident as any).longitude === "number" ? (selectedIncident as any).longitude : null
    if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng }
    }
    return null
  }, [selectedIncident])

  const latestIncidentLabels = React.useMemo(
    () => ({
      assigned: selectedIncident
        ? formatDateTime(selectedIncident.responded_at ?? selectedIncident.created_at)
        : null,
      reported: selectedIncident ? formatDateTime(selectedIncident.created_at) : null,
      responded: selectedIncident ? formatDateTime(selectedIncident.responded_at) : null,
      resolved: selectedIncident ? formatDateTime(selectedIncident.resolved_at) : null,
    }),
    [selectedIncident]
  )

  const checkLocationPermission = React.useCallback(async () => {
    try {
      const result = await CapacitorGeolocation.checkPermissions()
      setLocationPermission(result.location)
    } catch (error) {
      console.warn('Permission API not supported:', error)
      setLocationPermission('unknown')
    }
  }, [])

  const requestLocation = React.useCallback(async () => {
    setIsGettingLocation(true)
    setLocationError(null)

    try {
      const coords = await CapacitorGeolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      })

      setUserLocation(coords)
      setLocationPermission('granted')
      console.log('ER Team location obtained:', coords)
    } catch (error: any) {
      console.error('Failed to get location:', error)
      let errorMessage = 'Failed to get your location'

      if (error.code === 1) {
        errorMessage = 'Location permission denied. Please enable location access.'
        setLocationPermission('denied')
      } else if (error.code === 2) {
        errorMessage = 'Location information is unavailable'
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out'
      }

      setLocationError(errorMessage)
    } finally {
      setIsGettingLocation(false)
    }
  }, [])

  const openGoogleMapsDirections = React.useCallback((destination: { lat: number; lng: number }) => {
    if (!userLocation) {
      setLocationError('Your location is not available. Please get your location first.')
      return
    }

    // Create Google Maps URL with origin (ER team location) and destination (incident location)
    const origin = `${userLocation.lat},${userLocation.lng}`
    const dest = `${destination.lat},${destination.lng}`
    const mapsUrl = `https://www.google.com/maps/dir/${origin}/${dest}/@${userLocation.lat},${userLocation.lng},15z`

    // Open in new tab/window
    window.open(mapsUrl, '_blank', 'noopener,noreferrer')
  }, [userLocation])

  // Automatically get location when component mounts and periodically update
  React.useEffect(() => {
    const autoRequestLocation = async () => {
      // Only auto-request if we don't already have location and permission is granted or prompt
      if (userLocation || locationPermission === 'denied' || locationPermission === 'unknown') {
        return
      }

      console.log('🌍 Auto-requesting ER team location...')
      await requestLocation()
    }

    // Check permission first, then auto-request location
    void checkLocationPermission().then(() => {
      void autoRequestLocation()
    })

    // Set up periodic location updates (every 1 minute)
    const locationInterval = setInterval(() => {
      if (locationPermission === 'granted' && navigator.onLine) {
        console.log('🔄 Periodic location update for ER team')
        void requestLocation()
      }
    }, 1 * 60 * 1000) // 1 minute

    return () => {
      clearInterval(locationInterval)
    }
  }, [userLocation, locationPermission, checkLocationPermission, requestLocation])

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

  const insertOrUpdateIncident = React.useCallback((incident: AssignedIncident) => {
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

  React.useEffect(() => {
    assignedIncidentIdsRef.current = new Set(assignedIncidents.map((incident) => incident.id))
  }, [assignedIncidents])

  React.useEffect(() => {
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
          setIsLoading(false)
          return
        }
      }

      try {
        const response = await fetch("/api/er-team/me", { credentials: "include", signal: controller.signal })
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean
          team?: { id: number; name: string | null }
          error?: string
        }

        if (!response.ok) {
          const message = payload?.error ?? (response.status === 429 ? "Too many profile checks. Please wait a moment and try again." : response.statusText)
          const err = new Error(message || "Failed to load ER team profile")
          ;(err as { status?: number }).status = response.status

          // If unauthorized, try to refresh the session
          if (response.status === 401) {
            console.log('🔄 Session expired, attempting refresh...')
            try {
              const { data, error } = await supabase.auth.refreshSession()
              if (data.session && !error) {
                console.log('✅ Session refreshed, retrying profile load...')
                // Retry the profile load after session refresh
                const retryResponse = await fetch("/api/er-team/me", { credentials: "include", signal: controller.signal })
                const retryPayload = (await retryResponse.json().catch(() => ({}))) as typeof payload

                if (retryResponse.ok && retryPayload.ok && retryPayload.team) {
                  const resolvedTeamId = typeof retryPayload.team?.id === "number" ? retryPayload.team.id : null
                  setTeamName(retryPayload.team?.name ?? null)
                  setTeamId(resolvedTeamId)
                  setProfileStatus(resolvedTeamId ? "authorized" : "unauthorized")
                  writeCachedProfile({ teamId: resolvedTeamId, teamName: retryPayload.team?.name ?? null, cachedAt: new Date().toISOString() })
                  console.log("ER Team profile loaded after session refresh:", { resolvedTeamId, teamName: retryPayload.team?.name, userId })
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

        const team = payload?.team
        const resolvedTeamId = typeof team?.id === "number" ? team.id : null
        setTeamName(team?.name ?? null)
        setTeamId(resolvedTeamId)
        setProfileStatus(resolvedTeamId ? "authorized" : "unauthorized")
        writeCachedProfile({ teamId: resolvedTeamId, teamName: team?.name ?? null, cachedAt: new Date().toISOString() })

        console.log("ER Team profile loaded:", { resolvedTeamId, teamName: team?.name, userId })
      } catch (error: any) {
        if (controller.signal.aborted || !isActive) {
          return
        }

        console.error("Failed to load ER team profile", error)
        const status = (error as { status?: number }).status
        const fallbackMessage = status === 429 ? "Too many profile checks. Please wait a moment and try again." : "Failed to load ER team assignment"
        const message = typeof error?.message === "string" && error.message.trim().length > 0 ? error.message : fallbackMessage
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
  }, [profileReloadIndex])

  React.useEffect(() => {
    if (profileStatus !== "authorized" || !teamId) {
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
          setLoadingError((prev) => prev ?? "Unable to load local drafts")
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [profileStatus, teamId, applyDraftMerge])

  const activeDraft = React.useMemo(
    () => drafts.find((item) => item.clientDraftId === activeDraftId) ?? null,
    [drafts, activeDraftId]
  )

  const refreshReports = React.useCallback(async () => {
    if (profileStatus !== "authorized" || !teamId) {
      return
    }

    if (!navigator.onLine) {
      setLoadingReports(false)
      setLoadingError((prev) => prev ?? "Reports will refresh when you're back online.")
      return
    }

    setLoadingReports(true)
    setLoadingError(null)
    try {
      const response = await fetch("/api/er-team/reports", { credentials: "include" })
      if (!response.ok) {
        const message = await extractErrorMessage(response)
        throw new Error(message)
      }
      const payload = (await response.json().catch(() => ({}))) as { reports: SyncedReport[] }
      setReports(payload.reports ?? [])
    } catch (error: any) {
      console.error("Failed to load ER team reports", error)
      setLoadingError(error?.message ?? "Unable to load reports")
    } finally {
      setLoadingReports(false)
    }
  }, [profileStatus, teamId])

  const refreshAssignedIncidents = React.useCallback(async () => {
    console.log('🔄 refreshAssignedIncidents called')

    if (profileStatus !== "authorized" || !teamId) {
      console.log('❌ refreshAssignedIncidents: Not authorized or no teamId', { profileStatus, teamId })
      return
    }

    console.log('📡 refreshAssignedIncidents: Starting for team', teamId)

    if (!navigator.onLine) {
      console.log('📴 refreshAssignedIncidents: Offline, skipping')
      setAssignedLoading(false)
      setAssignedError((prev) => prev ?? "Assigned incidents will refresh when you're back online.")
      return
    }

    console.log('🚀 refreshAssignedIncidents: Making API call')
    setAssignedLoading(true)
    setAssignedError(null)

    try {
      console.log('🌐 Fetching from /api/er-team/assigned')
      const response = await fetch("/api/er-team/assigned", { credentials: "include" })

      console.log('📥 Response status:', response.status)
      console.log('📥 Response ok:', response.ok)

      if (!response.ok) {
        const message = await extractErrorMessage(response)
        console.error('❌ API error:', message)
        throw new Error(message)
      }

      const body = (await response.json().catch(() => ({}))) as { incidents?: AssignedIncident[] }
      console.log('📦 Raw API response:', body)

      const incidents = Array.isArray(body?.incidents) ? body.incidents : []
      console.log('📋 Parsed incidents:', incidents.length, 'items')

      const filteredIncidents = incidents.filter((incident) => !incident.er_team_report?.internal_report_id)
      console.log('🔍 Filtered incidents:', filteredIncidents.length, 'items')

      const ordered = sortAssignedIncidents(filteredIncidents)
      console.log('📊 Final ordered incidents:', ordered.length, 'items')

      setAssignedIncidents(ordered)
      applyDraftMerge(ordered)

      console.log('✅ Successfully set assigned incidents')
    } catch (error: any) {
      console.error("❌ Failed to load assigned incidents", error)
      setAssignedError(error?.message ?? "Unable to load assigned incidents")
    } finally {
      setAssignedLoading(false)
      console.log('🏁 refreshAssignedIncidents completed')
    }
  }, [profileStatus, teamId, applyDraftMerge])

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

        setAssignedIncidents((prev) =>
          prev.map((incident) =>
            incident.id === incidentId
              ? {
                  ...incident,
                  responded_at: payload?.respondedAt ?? incident.responded_at ?? new Date().toISOString(),
                  resolved_at: payload?.resolvedAt ?? new Date().toISOString(),
                  status: payload?.status ?? incident.status,
                }
              : incident,
          ),
        )
      } catch (error: any) {
        console.error("[er-team] failed to mark incident responded", error)
        setAssignedError((prev) => prev ?? (error?.message ?? "Failed to mark incident as responded."))
      } finally {
        setResolvingIncidentId(null)
        void refreshAssignedIncidents()
      }
    },
    [refreshAssignedIncidents],
  )

  React.useEffect(() => {
    refreshAssignedIncidents()
  }, [refreshAssignedIncidents])

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
  }, [refreshAssignedIncidents])

  const loadReferences = React.useCallback(async () => {
    const [{ data: barangayData, error: barangayError }, { data: incidentTypeData, error: incidentTypeError }] = await Promise.all([
      supabase.from("barangays").select("id, name").order("name", { ascending: true }),
      supabase.from("incident_types").select("id, name").order("name", { ascending: true }),
    ])

    if (barangayError || incidentTypeError) {
      throw barangayError ?? incidentTypeError ?? new Error("Failed to load reference data")
    }

    const mappedBarangays: ReferenceOption[] = (barangayData ?? []).map((item) => ({ id: String(item.id), name: item.name ?? "" }))
    const mappedIncidentTypes: ReferenceOption[] = (incidentTypeData ?? []).map((item) => ({ id: String(item.id), name: item.name ?? "" }))

    return {
      barangays: mappedBarangays,
      incidentTypes: mappedIncidentTypes,
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    const bootstrapReferences = async () => {
      try {
        const [barangaysCache, incidentTypesCache] = await Promise.all([loadReference("barangays"), loadReference("incidentTypes")])

        if (!cancelled) {
          if (barangaysCache?.items?.length) setBarangays(barangaysCache.items)
          if (incidentTypesCache?.items?.length) setIncidentTypes(incidentTypesCache.items)
        }

        await migrateLegacyReferences()
        if (!navigator.onLine) {
          setReferenceError((prev) => prev ?? "Using cached reference data while offline.")
          return
        }

        const data = await loadReferences()
        if (cancelled) return
        setReferenceError(null)
        setBarangays(data.barangays)
        setIncidentTypes(data.incidentTypes)
        await Promise.all([
          saveReference("barangays", data.barangays),
          saveReference("incidentTypes", data.incidentTypes),
        ])
      } catch (error: any) {
        if (!cancelled) {
          console.error("Failed to load ER team references", error)
          setReferenceError(error?.message ?? "Failed to load reference data. Using cached values if available.")
        }
      }
    }

    void bootstrapReferences()
    return () => {
      cancelled = true
    }
  }, [loadReferences])

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

  React.useEffect(() => {
    if (isOnline) {
      void refreshReports()
      void (async () => {
        const cache = readCachedProfile()
        if (!cache) {
          return
        }
        setTeamId(cache.teamId)
        setTeamName(cache.teamName)
      })()
    }
  }, [isOnline, refreshReports])

  React.useEffect(() => {
    let cancelled = false
    setLoadingReports(true)
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return
        const session = data.session
        if (!session) {
          setUserId(null)
          setLoadingReports(false)
          return
        }
        setUserId(session.user.id)
        void refreshReports()
      })
      .catch((error) => {
        console.error("Failed to resolve ER team session", error)
        if (!cancelled) {
          setLoadingReports(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [refreshReports])

  React.useEffect(() => {
    if (profileStatus !== "authorized" || !teamId) {
      console.log('❌ Realtime subscription: Not authorized or no teamId', { profileStatus, teamId })
      return
    }

    console.log('🔗 Setting up realtime subscription for team', teamId)
    const channel = supabase.channel(`${SUPABASE_CHANNEL_PREFIX}${teamId}`)
    console.log('📡 Created channel:', `${SUPABASE_CHANNEL_PREFIX}${teamId}`)

    const handleInternalReportChange = (payload: { new?: Record<string, any> | null; old?: Record<string, any> | null }) => {
      const candidateId = (payload?.new?.original_report_id ?? payload?.old?.original_report_id) as string | null | undefined
      if (!candidateId || !assignedIncidentIdsRef.current.has(candidateId)) {
        return
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return
      }
      void refreshAssignedIncidents()
    }

    const handleReportChange = (payload: { new?: Record<string, any> | null; old?: Record<string, any> | null }) => {
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
      const payloadWithEvent = payload as { new?: Record<string, any> | null; old?: Record<string, any> | null; eventType?: string }
      const newRow = payloadWithEvent.new as any
      const oldRow = payloadWithEvent.old as any
      if (newRow && newRow.emergency_report_id && assignedIncidentIdsRef.current.has(newRow.emergency_report_id)) {
        const emergencyReport = assignedIncidents.find(inc => inc.id === newRow.emergency_report_id)
        if (emergencyReport) {
          const reporterName = `${emergencyReport.firstName ?? ''} ${emergencyReport.lastName ?? ''}`.trim() || 'Unknown reporter'

          let notificationMessage = ''
          let eventType: NotificationEventType = 'assignment'

          if (payloadWithEvent.eventType === 'INSERT') {
            notificationMessage = `New PCR draft started for ${emergencyReport.emergency_type ?? 'incident'}`
          } else if (payloadWithEvent.eventType === 'UPDATE' && newRow.status !== oldRow?.status) {
            // Skip notifications for resolved/completed status changes
            const resolvedStatuses = ['resolved', 'completed']
            if (resolvedStatuses.includes(newRow.status?.toLowerCase())) {
              console.log('Skipping notification for resolved/completed status change')
              return
            }
            eventType = 'status_change'
            notificationMessage = `PCR report status changed to ${formatStatusDisplay(newRow.status)}`
          }

          if (notificationMessage) {
            const notificationId = `pcr-${newRow.id}-${Date.now()}`
            const notification: TeamDispatchNotification = {
              id: notificationId,
              eventType,
              emergencyReportId: newRow.emergency_report_id,
              erTeamId: teamId,
              erTeamReportId: newRow.id,
              reporterName,
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
            }

            setDispatchNotifications(prev => [notification, ...prev.slice(0, MAX_DISPATCH_NOTIFICATIONS - 1)])
            setHasUnreadDispatchAlert(true)
          }
        }
      }

      void refreshReports()
      const now = Date.now()
      if (!assignedLoading && now - lastAssignedRefresh > ASSIGNED_REFRESH_DEBOUNCE_MS) {
        setLastAssignedRefresh(now)
        void refreshAssignedIncidents()
      }
    }

    const handleEmergencyReportChange = (payload: { new?: Record<string, any> | null; old?: Record<string, any> | null }) => {
      console.log('🔔 Emergency report realtime event received:', payload)

      if (!payload.new) {
        console.log('⚠️ No new row in payload, skipping')
        return
      }

      const newRow = payload.new
      console.log('📊 Processing new row:', newRow)

      // Check if this report is assigned to our team (handle both number and string comparisons)
      const newTeamId = newRow.er_team_id
      const oldTeamId = payload.old?.er_team_id
      const isAssignedToTeam = newTeamId != null && (newTeamId === teamId || String(newTeamId) === String(teamId))
      const wasAssignedToTeam = oldTeamId != null && (oldTeamId === teamId || String(oldTeamId) === String(teamId))

      console.log('👥 Team assignment check:', {
        teamId,
        newTeamId,
        oldTeamId,
        isAssignedToTeam,
        wasAssignedToTeam,
        teamIdType: typeof teamId,
        newTeamIdType: typeof newTeamId
      })

      // Check if responded_at was just filled (notification trigger)
      const respondedAtFilled = newRow.responded_at && (!payload.old?.responded_at)

      // Check if resolved_at was just filled (skip notification trigger)
      const resolvedAtFilled = newRow.resolved_at && (!payload.old?.resolved_at)

      console.log('⏰ Response check:', {
        newRespondedAt: newRow.responded_at,
        oldRespondedAt: payload.old?.responded_at,
        respondedAtFilled,
        newResolvedAt: newRow.resolved_at,
        oldResolvedAt: payload.old?.resolved_at,
        resolvedAtFilled
      })

      // Skip notifications for resolved status changes
      if (resolvedAtFilled) {
        console.log('Skipping notification for resolved_at being set')
        return
      }

      if (respondedAtFilled && isAssignedToTeam) {
        console.log('📢 Creating notification for new assignment')
        // Create notification for new assignment/response
        const reporterName = `${newRow.firstName ?? ''} ${newRow.lastName ?? ''}`.trim() || 'Unknown reporter'

        const notificationId = `emergency-${newRow.id}-${Date.now()}`
        const notification: TeamDispatchNotification = {
          id: notificationId,
          eventType: 'assignment',
          emergencyReportId: newRow.id,
          erTeamId: teamId,
          erTeamReportId: null,
          reporterName,
          incidentType: newRow.emergency_type,
          locationAddress: newRow.location_address,
          reportedAt: newRow.created_at,
          respondedAt: newRow.responded_at,
          createdAt: new Date().toISOString(),
          oldStatus: payload.old?.status,
          newStatus: newRow.status,
          previousTeamId: payload.old?.er_team_id,
          originLatitude: userLocation?.lat ?? null,
          originLongitude: userLocation?.lng ?? null,
          incidentLatitude: parseCoordinate(newRow.latitude),
          incidentLongitude: parseCoordinate(newRow.longitude),
        }

        setDispatchNotifications(prev => [notification, ...prev.slice(0, MAX_DISPATCH_NOTIFICATIONS - 1)])
        setHasUnreadDispatchAlert(true)

        // Show notification overlay and play alert sound
        if (lastDispatchOverlayIdRef.current !== notificationId) {
          showDispatchOverlay(notification)
          lastDispatchOverlayIdRef.current = notificationId
        }

        // Use Capacitor notifications for alert sound and notification
        CapacitorNotifications.showDispatchAlert({
          title: 'ER Team Dispatch Alert',
          body: `${notification.incidentType ?? "Incident"}: ${notification.locationAddress ?? "Location pending"}`,
          id: notificationId.toString(),
          sound: true,
          extra: {
            emergencyReportId: notification.emergencyReportId,
            eventType: notification.eventType,
          }
        }).catch((error) => {
          console.warn('Failed to show Capacitor notification:', error)
        })

        console.log('✅ ER Team notified of new assignment:', notification)
      }

      // Always refresh assigned incidents when there's any change to emergency_reports
      // This ensures the ER team gets the latest data even if team assignment logic has issues
      console.log('🔄 Emergency report change detected - refreshing assigned incidents for team', teamId)
      const now = Date.now()
      if (!assignedLoading && now - lastAssignedRefresh > ASSIGNED_REFRESH_DEBOUNCE_MS) {
        setLastAssignedRefresh(now)
        console.log('⚡ Triggering refreshAssignedIncidents due to emergency_reports change')
        void refreshAssignedIncidents()
      } else {
        console.log('⏳ Skipping refresh - loading or debounce active')
      }
    }

    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "emergency_reports" }, handleEmergencyReportChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_reports" }, handleInternalReportChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "er_team_reports" }, handleReportChange)
      .subscribe((status, err) => {
        console.log('🔗 Realtime subscription status:', status, err ? `Error: ${err}` : '')
        if (err) {
          console.error('❌ Realtime subscription error:', err)
          // Set up retry logic for connection issues
          if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            console.log('🔄 Retrying realtime subscription in 10 seconds...')
            setTimeout(() => {
              if (profileStatus === "authorized" && teamId) {
                console.log('🔄 Retrying realtime subscription setup...')
                // The useEffect will re-run and recreate the subscription
              }
            }, 10000)
          }
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to realtime channel:', `${SUPABASE_CHANNEL_PREFIX}${teamId}`)
        }
      })

    return () => {
      console.log('Cleaning up realtime subscription for team', teamId)
      supabase.removeChannel(channel)
    }
  }, [
    profileStatus,
    teamId,
    insertOrUpdateIncident,
    assignedLoading,
    lastAssignedRefresh,
    refreshAssignedIncidents,
    refreshReports,
    userId,
    applyDraftMerge,
    assignedIncidents,
    userLocation,
  ])

  const handleProfileReload = React.useCallback(() => {
    setProfileReloadIndex((prev) => prev + 1)
  }, [])

  const handleOpenDraft = React.useCallback((draftId: string) => {
    if (profileStatus !== "authorized" || !teamId) {
      return
    }
    setActiveDraftId(draftId)
    setIsSheetOpen(true)
  }, [profileStatus, teamId])

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
      if (profileStatus !== "authorized") {
        return draft
      }

      if (!draft.emergencyReportId) {
        setAssignedError((prev) => prev ?? "This draft is missing its assigned incident. Refresh assigned incidents and try again.")
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
    [assignedIncidents, profileStatus, refreshAssignedIncidents, syncDraft]
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
    [assignedIncidents, handleDraftSync, refreshReports, refreshAssignedIncidents]
  )

  React.useEffect(() => {
    if (profileStatus !== "authorized" || !teamId) {
      setAssignedIncidents([])
      setAssignedError(null)
      setAssignedLoading(false)
      return
    }
    void refreshAssignedIncidents()
  }, [profileStatus, teamId, refreshAssignedIncidents])

  React.useEffect(() => {
    if (profileStatus !== "authorized" || !teamId) {
      return
    }

    // Set up periodic refresh as fallback for realtime subscription
    const intervalId = setInterval(() => {
      if (!assignedLoading) {
        console.log('Periodic refresh: checking for new assigned incidents')
        void refreshAssignedIncidents()
      }
    }, 30000) // Refresh every 30 seconds as fallback

    return () => {
      clearInterval(intervalId)
    }
  }, [profileStatus, teamId, assignedLoading, refreshAssignedIncidents])

  const assignedIncidentLookup = React.useMemo(() => {
    const map = new Map<string, AssignedIncident>()
    assignedIncidents.forEach((incident) => {
      map.set(incident.id, incident)
    })
    return map
  }, [assignedIncidents])

  const totalAssignedPages = React.useMemo(() => Math.ceil(drafts.length / ASSIGNED_PAGE_SIZE), [drafts.length])

  const pagedDrafts = React.useMemo(() => {
    if (drafts.length === 0) {
      return []
    }
    const start = (assignedPage - 1) * ASSIGNED_PAGE_SIZE
    return drafts.slice(start, start + ASSIGNED_PAGE_SIZE)
  }, [drafts, assignedPage])

  React.useEffect(() => {
    setAssignedPage(1)
  }, [assignedIncidents.length])

  React.useEffect(() => {
    const pages = Math.ceil(drafts.length / ASSIGNED_PAGE_SIZE)
    if (pages === 0) {
      if (assignedPage !== 1) {
        setAssignedPage(1)
      }
      return
    }
    if (assignedPage > pages) {
      setAssignedPage(pages)
    }
  }, [drafts.length, assignedPage])

  const assignedStats = React.useMemo(() => {
    const pendingSync = drafts.filter((draft) => !draft.synced).length
    const awaitingReview = drafts.filter((draft) => draft.status === "pending_review" || draft.status === "in_review").length
    const rejected = drafts.filter((draft) => draft.status === "rejected").length
    return {
      total: drafts.length,
      pendingSync,
      awaitingReview,
      rejected,
    }
  }, [drafts])

  const submittedStats = React.useMemo(() => {
    const approved = reports.filter((report) => report.status === "approved").length
    const rejected = reports.filter((report) => report.status === "rejected").length
    return {
      total: reports.length,
      approved,
      rejected,
    }
  }, [reports])

  const summaryCards = React.useMemo(
    () => [
      {
        label: "Active assignments",
        value: assignedStats.total,
        detail: assignedStats.total > 0 ? "Assigned incidents awaiting action" : "No active assignments",
      },
      {
        label: "Pending sync",
        value: assignedStats.pendingSync,
        detail: assignedStats.pendingSync > 0 ? "Open the draft workspace to sync." : "All drafts synced.",
      },
      {
        label: "Awaiting review",
        value: assignedStats.awaitingReview,
        detail: assignedStats.awaitingReview > 0 ? "Waiting for admin review." : "Nothing queued for review.",
      },
      {
        label: "Approved reports",
        value: submittedStats.approved,
        detail:
          submittedStats.total > 0
            ? `${submittedStats.approved} of ${submittedStats.total} approved`
            : "No submissions yet.",
      },
    ],
    [assignedStats, submittedStats]
  )

  const sortedReports = React.useMemo(
    () =>
      [...reports].sort((a, b) => {
        const aTime = Date.parse(a.updated_at || a.created_at)
        const bTime = Date.parse(b.updated_at || b.created_at)
        if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0
        if (Number.isNaN(aTime)) return 1
        if (Number.isNaN(bTime)) return -1
        return bTime - aTime
      }),
    [reports]
  )

  const filteredReports = React.useMemo(() => {
    if (reportsStatusFilter === "all") {
      return sortedReports
    }
    return sortedReports.filter((report) => report.status === reportsStatusFilter)
  }, [sortedReports, reportsStatusFilter])

  const totalReportsPages = Math.ceil(filteredReports.length / REPORTS_PAGE_SIZE)
  const maxReportsPage = Math.max(1, totalReportsPages)

  React.useEffect(() => {
    setReportsPage((previous) => {
      if (previous < 1) return 1
      if (previous > maxReportsPage) return maxReportsPage
      return previous
    })
  }, [maxReportsPage])

  const pagedReports = React.useMemo(() => {
    const startIndex = (reportsPage - 1) * REPORTS_PAGE_SIZE
    return filteredReports.slice(startIndex, startIndex + REPORTS_PAGE_SIZE)
  }, [filteredReports, reportsPage])

  if (isLoading || profileStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center" style={DASHBOARD_BACKGROUND_STYLE}>
        <div className="rounded-lg bg-orange-50/85 px-6 py-4 text-sm text-orange-700 shadow-lg backdrop-blur">
          Loading ER team dashboard…
        </div>
      </div>
    )
  }

  if (profileStatus === "error") {
    return (
      <div className="min-h-screen" style={DASHBOARD_BACKGROUND_STYLE}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-orange-50/85 px-4 text-center backdrop-blur-sm">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Unable to verify ER team assignment</h1>
            <p className="mt-2 text-sm text-gray-600">{profileError ?? "An unexpected error occurred while checking your ER team access."}</p>
          </div>
          <Button onClick={handleProfileReload} className="bg-orange-600 hover:bg-orange-700">
            Retry
          </Button>
          <Button variant="ghost" onClick={onLogout} className="text-sm text-orange-600 hover:text-orange-700">
            Sign out
          </Button>
        </div>
      </div>
    )
  }

  if (profileStatus === "unauthorized" || !teamId) {
    return (
      <div className="min-h-screen" style={DASHBOARD_BACKGROUND_STYLE}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-orange-50/85 px-4 text-center backdrop-blur-sm">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">ER team access pending</h1>
            <p className="mt-2 text-sm text-gray-600">
              Your account does not have an ER team assignment yet. Please contact an administrator to complete your access.
            </p>
          </div>
          <Button onClick={handleProfileReload} className="bg-orange-600 hover:bg-orange-700">
            Check again
          </Button>
          <Button variant="ghost" onClick={onLogout} className="text-sm text-orange-600 hover:text-orange-700">
            Sign out
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20" style={{ ...DASHBOARD_BACKGROUND_STYLE, backgroundBlendMode: "overlay" }}>
      <div className="flex min-h-screen flex-col">
        {dispatchOverlay ? (
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
                {dispatchOverlay.locationAddress ? (
                  <div className="rounded-2xl border border-orange-100 bg-orange-50/80 px-4 py-3 text-sm text-orange-800">
                    <p className="font-medium">Location</p>
                    <p>{dispatchOverlay.locationAddress}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-3 justify-end">
                  <Button variant="outline" onClick={handleDismissDispatchOverlay} className="border-orange-200 text-orange-600 hover:bg-orange-50">
                    Dismiss
                  </Button>
                  {(() => {
                    const overlayIncident = assignedIncidents.find((incident) => incident.id === dispatchOverlay.emergencyReportId)
                    const overlayDraft = drafts.find((draft) => draft.emergencyReportId === dispatchOverlay.emergencyReportId)
                    const canOpenOverlayDraft = Boolean(overlayDraft)
                    return canOpenOverlayDraft ? (
                      <Button
                        className="bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg hover:from-orange-600 hover:to-red-600"
                        onClick={() => {
                          if (overlayDraft) {
                            handleOpenDraft(overlayDraft.clientDraftId)
                            handleDismissDispatchOverlay()
                          }
                        }}
                      >
                        Open Draft
                      </Button>
                    ) : overlayIncident ? (
                      <Button
                        variant="outline"
                        className="border-orange-200 text-orange-600 hover:bg-orange-50"
                        onClick={() => {
                          setSelectedIncidentId(overlayIncident.id)
                          handleDismissDispatchOverlay()
                        }}
                      >
                        View Incident
                      </Button>
                    ) : null
                  })()}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <header className="sticky top-0 z-20 flex flex-col gap-1 bg-gradient-to-r from-orange-500 via-orange-600 to-red-500/95 px-4 py-1 text-white shadow-xl backdrop-blur-sm border-b border-orange-400/30 sm:px-6 min-h-[56px] h-14 w-full">
          <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-sm font-bold sm:text-base bg-gradient-to-r from-white to-orange-100 bg-clip-text text-transparent">ER TEAM DASHBOARD</h1>
                {profileError ? (
                  <p className="mt-2 text-xs sm:text-sm text-red-200 bg-red-500/20 px-3 py-1 rounded-md border border-red-400/30">{profileError}</p>
                ) : null}
              </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Refresh data"
                onClick={async () => {
                  await Promise.all([refreshAssignedIncidents(), refreshReports()])
                }}
                disabled={!isOnline}
                className="text-white/90 hover:bg-white/20 hover:text-white rounded-full p-2 transition-all duration-200 backdrop-blur-sm"
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
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
                    {hasUnreadDispatchAlert ? (
                      <span className="absolute -top-1 -right-1 inline-flex h-3 w-3 rounded-full bg-red-500 animate-ping"></span>
                    ) : null}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 border-orange-200/50 bg-white/95 backdrop-blur-md p-0 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-orange-100/50 px-4 py-3 bg-gradient-to-r from-orange-50 to-white">
                    <span className="text-sm font-semibold text-orange-900">Dispatch notifications</span>
                    {dispatchNotifications.length > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleMarkAllAsRead}
                        className="h-auto px-3 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50 rounded-full transition-colors"
                      >
                        Mark as Read
                      </Button>
                    ) : null}
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
                          const timeLabel =
                            formatDateTime(notification.respondedAt ?? notification.createdAt) ?? "Just now"
                          const incidentIdLabel = notification.emergencyReportId.slice(0, 8)
                          const originLat = notification.originLatitude
                          const originLng = notification.originLongitude
                          const destLat = notification.incidentLatitude
                          const destLng = notification.incidentLongitude
                          const hasOrigin = typeof originLat === "number" && typeof originLng === "number"
                          const hasDestination = typeof destLat === "number" && typeof destLng === "number"
                          const gmapsUrl = hasDestination
                            ? hasOrigin
                              ? `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}`
                              : `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`
                            : null
                          return (
                            <li key={notification.id} className="px-4 py-4 hover:bg-orange-50/30 transition-colors">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="font-semibold text-gray-900 truncate">{notification.reporterName}</span>
                                    <span className="text-xs text-gray-500 flex-shrink-0">{timeLabel}</span>
                                  </div>
                                  {notification.incidentType ? (
                                    <div className="mb-2">
                                      <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                                        {notification.incidentType}
                                      </span>
                                    </div>
                                  ) : null}
                                  <div className="text-xs text-gray-600 mb-2">
                                    <span className="font-medium">ID:</span> <span className="font-mono text-gray-500">{incidentIdLabel}</span>
                                    {notification.erTeamReportId && (
                                      <>
                                        {" • "}
                                        <span className="font-medium">PCR:</span> <span className="font-mono text-gray-500">{notification.erTeamReportId.slice(0, 8)}</span>
                                      </>
                                    )}
                                  </div>
                                  {notification.locationAddress ? (
                                    <div className="text-xs text-gray-500 mb-2">{notification.locationAddress}</div>
                                  ) : null}
                                  {notification.eventType === "status_change" && notification.newStatus ? (
                                    <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-sky-700">
                                      {formatStatusDisplay(notification.newStatus)}
                                    </div>
                                  ) : notification.eventType === "assignment" && notification.erTeamReportId ? (
                                    <div className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-orange-700">
                                      PCR Draft Started
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                              {gmapsUrl ? (
                                <div className="mt-3">
                                  <a
                                    href={gmapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-full"
                                  >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                    </svg>
                                    Open route in Google Maps
                                  </a>
                                </div>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="ghost" onClick={onLogout} className="text-white/90 hover:bg-white/20 hover:text-white rounded-full px-4 py-2 transition-all duration-200 backdrop-blur-sm font-medium">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-6 px-4 py-6 sm:px-6">
          <div className="flex justify-end">
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
              {teamName ? <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full"></span>Logged in as {teamName}</span> : null}
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
                isOnline
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-gray-100 text-gray-700 border border-gray-200'
              }`}>
                {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                {isOnline ? "Online" : "Offline - Draft mode"}
              </span>
            </div>
          </div>
          {referenceError ? (
            <div
              className="rounded-lg border border-red-200 bg-orange-50 px-4 py-3 text-xs text-red-700 shadow-sm animate-in fade-in-0 slide-in-from-left-4"
              style={{ animationDuration: "500ms" }}
            >
              {referenceError}
            </div>
          ) : null}

          <div
            className="grid grid-cols-2 gap-4 lg:grid-cols-4 animate-in fade-in-0 slide-in-from-bottom-4 delay-100"
            style={{ animationDuration: "500ms" }}
          >
            {summaryCards.slice(0, 2).map((card, index) => {
              const icons = [
                { icon: "📋", bg: "from-blue-500 to-blue-600" },
                { icon: "⏳", bg: "from-amber-500 to-amber-600" },
                { icon: "📊", bg: "from-emerald-500 to-emerald-600" },
                { icon: "✅", bg: "from-green-500 to-green-600" },
              ];
              return (
                <div
                  key={card.label}
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-white via-white to-gray-50/80 p-2 sm:p-4 lg:p-5 shadow-lg hover:shadow-xl transition-all border border-white/50 hover:-translate-y-1 animate-in fade-in-0 slide-in-from-bottom-4"
                  style={{ animationDelay: `${index * 100}ms`, animationDuration: "500ms" }}
                >
                  <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${icons[index]?.bg} rounded-bl-3xl opacity-10 group-hover:opacity-20 transition-opacity`}></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${icons[index]?.bg} flex items-center justify-center text-white text-lg shadow-md`}>
                        {icons[index]?.icon}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">{card.label}</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{card.detail}</p>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-red-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
                </div>
              );
            })}
          </div>

          <div
            className="grid grid-cols-2 gap-4 lg:grid-cols-2 animate-in fade-in-0 slide-in-from-bottom-4 delay-300"
            style={{ animationDuration: "500ms" }}
          >
            {summaryCards.slice(2).map((card, index) => {
              const icons = [
                { icon: "👥", bg: "from-purple-500 to-purple-600" },
                { icon: "📋", bg: "from-teal-500 to-teal-600" },
              ];
              const actualIndex = index + 2;
              return (
                <div
                  key={card.label}
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-white via-white to-gray-50/80 p-2 sm:p-4 lg:p-5 shadow-lg hover:shadow-xl transition-all border border-white/50 hover:-translate-y-1 animate-in fade-in-0 slide-in-from-bottom-4"
                  style={{ animationDelay: `${(index + 2) * 100}ms`, animationDuration: "500ms" }}
                >
                  <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${icons[index]?.bg} rounded-bl-3xl opacity-10 group-hover:opacity-20 transition-opacity`}></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${icons[index]?.bg} flex items-center justify-center text-white text-lg shadow-md`}>
                        {icons[index]?.icon}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">{card.label}</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{card.detail}</p>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-red-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                </div>
              );
            })}
          </div>

          {selectedIncident ? (
            <Card
              className="group relative overflow-hidden border-0 bg-gradient-to-br from-white via-white to-orange-50/30 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl animate-in fade-in-0 slide-in-from-bottom-4 delay-500"
              style={{ animationDuration: "500ms" }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-orange-200/20 to-red-200/20 rounded-bl-full"></div>
              <CardHeader className="space-y-3 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white shadow-lg">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-gray-900 group-hover:text-orange-900 transition-colors">Incident Action Assigned</CardTitle>
                    <CardDescription className="text-sm text-gray-600 mt-1">
                      {latestIncidentLabels.assigned ? `Team assigned ${latestIncidentLabels.assigned}` : "Awaiting team assignment"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="bg-gradient-to-r from-gray-50 to-white p-4 rounded-xl border border-gray-100/50 shadow-sm">
                  <div className="text-sm font-semibold text-gray-900 mb-2">
                    {`${selectedIncident.firstName ?? ""} ${selectedIncident.lastName ?? ""}`.trim() ||
                      `Incident ${selectedIncident.id.slice(0, 8)}`}
                  </div>
                  {selectedIncident.emergency_type ? (
                    <div className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded-full mb-2">
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                      {selectedIncident.emergency_type}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                    {latestIncidentLabels.reported ? (
                      <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-md">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        Reported {latestIncidentLabels.reported}
                      </span>
                    ) : null}
                    {latestIncidentLabels.responded ? (
                      <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-md">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        Responded {latestIncidentLabels.responded}
                      </span>
                    ) : null}
                    {latestIncidentLabels.resolved ? (
                      <span className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-1 rounded-md">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        Resolved {latestIncidentLabels.resolved}
                      </span>
                    ) : null}
                  </div>
                </div>

                {selectedIncidentCoords ? (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">Incident Location</p>
                    </div>
                    <LocationMap
                      latitude={selectedIncidentCoords.lat}
                      longitude={selectedIncidentCoords.lng}
                      zoom={16}
                      className="w-full h-48 rounded-lg shadow-sm"
                    />
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-600 bg-white/70 p-2 rounded-md">
                      <span><strong className="text-gray-700">Lat:</strong> {selectedIncidentCoords.lat.toFixed(5)}</span>
                      <span><strong className="text-gray-700">Lng:</strong> {selectedIncidentCoords.lng.toFixed(5)}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openGoogleMapsDirections(selectedIncidentCoords)}
                        disabled={!userLocation}
                        className="flex-1 bg-white hover:bg-blue-50 border-blue-200 text-blue-700 hover:text-blue-800 transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                        Get Directions
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-gray-100 to-gray-50 p-4 rounded-xl border border-gray-200/50 text-center">
                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-sm text-gray-600">Incident location coordinates are not available for this report.</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 shadow-sm hover:shadow-md"
                    onClick={() => {
                      const draft = drafts.find((item) => item.emergencyReportId === selectedIncident.id)
                      if (draft) {
                        handleOpenDraft(draft.clientDraftId)
                      }
                    }}
                    disabled={!drafts.some((draft) => draft.emergencyReportId === selectedIncident.id)}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Open Draft
                  </Button>
                  {canMarkSelectedIncidentResolved ? (
                    <Button
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
                      disabled={resolvingIncidentId === selectedIncident.id || !isOnline}
                      onClick={() => handleMarkResolved(selectedIncident.id)}
                    >
                      {resolvingIncidentId === selectedIncident.id ? (
                        <>
                          <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Processing...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Mark Resolved
                        </>
                      )}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Location Services Section */}
          <div
            className="animate-in fade-in-0 slide-in-from-bottom-4 delay-700"
            style={{ animationDuration: "500ms" }}
          >
            <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-white via-white to-green-50/30 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-green-200/20 to-blue-200/20 rounded-bl-full"></div>
              <CardHeader className="space-y-3 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white shadow-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-gray-900 group-hover:text-green-900 transition-colors">Location Services</CardTitle>
                    <CardDescription className="text-sm text-gray-600 mt-1">
                      Your location is automatically tracked for routing and navigation
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-white to-gray-50 p-4 rounded-xl border border-gray-100/50 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-700 font-medium">Permission Status:</span>
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                      locationPermission === 'granted' ? 'bg-green-100 text-green-700 border border-green-200' :
                      locationPermission === 'denied' ? 'bg-red-100 text-red-700 border border-red-200' :
                      locationPermission === 'prompt' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                      'bg-gray-100 text-gray-700 border border-gray-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        locationPermission === 'granted' ? 'bg-green-500' :
                        locationPermission === 'denied' ? 'bg-red-500' :
                        locationPermission === 'prompt' ? 'bg-yellow-500' :
                        'bg-gray-500'
                      }`}></span>
                      {locationPermission === 'granted' ? 'Granted' :
                       locationPermission === 'denied' ? 'Denied' :
                       locationPermission === 'prompt' ? 'Prompt' : 'Unknown'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-100/50">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium text-blue-900">Auto-update: Every 1 minute</span>
                    </div>
                    <p className="text-blue-700">Location automatically updates when online and location permissions are granted.</p>
                  </div>
                  {locationError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <p className="text-xs text-red-700 font-medium">{locationError}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-gradient-to-br from-white to-gray-50 p-4 rounded-xl border border-gray-100/50 shadow-sm">
                  {userLocation ? (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">Current Location</p>
                      </div>
                      <div className="text-xs text-gray-600 bg-white p-3 rounded-md border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-700">Latitude:</span>
                          <span className="font-mono text-gray-900">{userLocation.lat.toFixed(6)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-700">Longitude:</span>
                          <span className="font-mono text-gray-900">{userLocation.lng.toFixed(6)}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Ready for Google Maps routing
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500 italic">
                        Location not available. Please enable location permissions in your browser.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card
          className="animate-in fade-in-0 slide-in-from-bottom-4 delay-900 group relative overflow-hidden border-0 bg-gradient-to-br from-white via-white to-purple-50/30 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl"
          style={{ animationDuration: "500ms" }}
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-200/20 to-pink-200/20 rounded-bl-full"></div>
            <CardHeader className="space-y-4 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-gray-900 group-hover:text-purple-900 transition-colors">Assigned Incidents</CardTitle>
                    <CardDescription className="text-sm text-gray-600 mt-1">
                      Focus on the drafts currently assigned to your team
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                  <span className="font-medium">Team ID:</span>
                  <span className="font-mono text-gray-700">{teamId}</span>
                  <span className="mx-1">•</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => void refreshAssignedIncidents()}
                  disabled={!isOnline || assignedLoading}
                  className="bg-white hover:bg-blue-50 border-blue-200 text-blue-700 hover:text-blue-800 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${assignedLoading ? 'animate-spin' : ''}`} />
                  {assignedLoading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {assignedError ? (
                <div className="rounded-md border border-red-200 bg-white/70 px-3 py-2 text-xs text-red-600">
                  {assignedError}
                </div>
              ) : null}
              {assignedLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading assigned incidents…
                </div>
              ) : drafts.length === 0 ? (
                <p className="text-sm text-gray-500">No assigned incidents available right now.</p>
              ) : (
                <div className="space-y-4">
                  {pagedDrafts.map((draft) => {
                    const incident = assignedIncidentLookup.get(draft.emergencyReportId)
                    const patientInfo = draft.patientsPayload?.[0]
                    const patientName = patientInfo
                      ? `${patientInfo.firstName ?? ""} ${patientInfo.lastName ?? ""}`.trim() || "Unnamed patient"
                      : "Unnamed patient"
                    const reporterName = incident
                      ? `${incident.firstName ?? ""} ${incident.lastName ?? ""}`.trim()
                      : ""
                    const incidentLabel =
                      reporterName.length > 0
                        ? reporterName
                        : draft.emergencyReportId
                          ? `Incident ${draft.emergencyReportId.slice(0, 8)}`
                          : "Linked incident"
                    const createdAtLabel = formatDateTime(incident?.created_at)
                    const respondedAtLabel = formatDateTime(incident?.responded_at)
                    const resolvedAtLabel = formatDateTime(incident?.resolved_at)
                    const submittedAtLabel = formatDateTime(draft.submittedAt)
                    const statusClass = STATUS_BADGE_STYLES[draft.status] ?? STATUS_BADGE_STYLES.draft
                    const syncClass = draft.synced ? SYNC_BADGE_CLASSES.synced : SYNC_BADGE_CLASSES.pending
                    return (
                      <div
                        key={draft.clientDraftId}
                        className={cn(
                          "rounded-xl border bg-white/95 p-4 shadow-sm transition hover:-translate-y-[1px] hover:border-orange-200 hover:shadow-md",
                          draft.emergencyReportId === selectedIncidentId
                            ? "border-orange-300 ring-2 ring-orange-200"
                            : "border-orange-100"
                        )}
                        onClick={() => {
                          if (draft.emergencyReportId) {
                            setSelectedIncidentId(draft.emergencyReportId)
                          }
                        }}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900">{incidentLabel}</span>
                              {incident?.emergency_type ? (
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-orange-500">
                                  {incident.emergency_type}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-gray-600">
                              Patient: <span className="font-medium text-gray-700">{patientName}</span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                              {createdAtLabel ? <span>Reported {createdAtLabel}</span> : null}
                              {incident?.responded_at ? (
                    <span>Team assigned {formatDateTime(incident.responded_at)}</span>
                  ) : (
                    incident?.created_at ? <span>Team assigned {formatDateTime(incident.created_at)}</span> : null
                  )}
                              {respondedAtLabel ? <span>Responded {respondedAtLabel}</span> : null}
                              {resolvedAtLabel ? <span>Resolved {resolvedAtLabel}</span> : null}
                              {submittedAtLabel ? <span>Submitted {submittedAtLabel}</span> : null}
                            </div>
                            {draft.lastSyncError ? (
                              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                {draft.lastSyncError}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex flex-col items-stretch gap-2 sm:items-end">
                            <Badge className={cn("w-fit px-3 py-1 text-xs font-medium capitalize", statusClass)}>
                              {formatStatusLabel(draft.status)}
                            </Badge>
                            <span
                              className={cn(
                                "inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                                syncClass
                              )}
                            >
                              {draft.synced ? "Synced" : "Pending sync"}
                            </span>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-orange-300 text-orange-600 hover:bg-white"
                                onClick={() => void handleOpenDraft(draft.clientDraftId)}
                              >
                                Open
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {drafts.length > 0 && totalAssignedPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-orange-100 pt-4 text-xs text-gray-600">
                  <span>
                    Page {assignedPage} of {totalAssignedPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-orange-300 text-orange-600 hover:bg-orange-50"
                      onClick={() => setAssignedPage((prev) => Math.max(1, prev - 1))}
                      disabled={assignedPage <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-orange-300 text-orange-600 hover:bg-orange-50"
                      onClick={() => setAssignedPage((prev) => Math.min(totalAssignedPages, prev + 1))}
                      disabled={assignedPage >= totalAssignedPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div
            className="animate-in fade-in-0 slide-in-from-bottom-4 delay-1100"
            style={{ animationDuration: "500ms" }}
          >
            <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-white via-white to-slate-50/30 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl">
            <CardHeader className="space-y-3 lg:flex lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
              <div>
                <CardTitle className="text-base font-semibold text-gray-900">Submitted reports</CardTitle>
                <p className="mt-1 text-sm text-gray-500">Latest synced submissions from your team.</p>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>Status:</span>
                  <select
                    className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    value={reportsStatusFilter}
                    onChange={(event) => setReportsStatusFilter(event.target.value as ReportsStatusFilter)}
                  >
                    {REPORT_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option === "all" ? "All statuses" : formatStatusLabel(option)}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  variant="outline"
                  onClick={() => void refreshReports()}
                  disabled={!isOnline || loadingReports}
                  className="border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingReports ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading reports…
                </div>
              ) : loadingError ? (
                <div className="text-sm text-red-600">{loadingError}</div>
              ) : filteredReports.length === 0 ? (
                <p className="text-sm text-gray-500">No submitted reports yet.</p>
              ) : (
                <div className="space-y-4">
                  {pagedReports.map((report) => {
                    const statusClass = STATUS_BADGE_STYLES[report.status] ?? STATUS_BADGE_STYLES.draft
                    const createdLabel = formatDateTime(report.created_at)
                    const updatedLabel = formatDateTime(report.updated_at)
                    const syncedLabel = formatDateTime(report.synced_at)
                    const notes = typeof report.notes === "string" && report.notes.trim().length > 0 ? report.notes : null
                    const patientInfo = report.patient_payload?.patientInformation as
                      | { firstName?: string | null; lastName?: string | null }
                      | undefined
                    const patientName = patientInfo
                      ? `${patientInfo.firstName ?? ""} ${patientInfo.lastName ?? ""}`.trim() || null
                      : null
                    const isDraftReport = report.status === "draft"
                    const matchingDraft = isDraftReport
                      ? drafts.find((draft) => draft.clientDraftId === report.id)
                      : undefined
                    const canOpenDraftFromReport = Boolean(matchingDraft)
                    return (
                      <button
                        key={report.id}
                        type="button"
                        disabled={!canOpenDraftFromReport}
                        onClick={() => {
                          if (matchingDraft) {
                            handleOpenDraft(matchingDraft.clientDraftId)
                          }
                        }}
                        className={cn(
                          "w-full rounded-xl border border-gray-200 bg-white/95 p-4 text-left shadow-sm transition",
                          canOpenDraftFromReport
                            ? "hover:-translate-y-[1px] hover:border-orange-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300"
                            : "cursor-not-allowed opacity-70"
                        )}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900">
                                {patientName ?? `Report ${report.id.slice(0, 8)}`}
                              </span>
                              <Badge className={cn("w-fit px-3 py-1 text-xs font-medium capitalize", statusClass)}>
                                {formatStatusLabel(report.status)}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                              {createdLabel ? <span>Created {createdLabel}</span> : null}
                              {updatedLabel ? <span>Updated {updatedLabel}</span> : null}
                              {syncedLabel ? <span>Synced {syncedLabel}</span> : null}
                            </div>
                            {notes ? <p className="text-sm text-gray-600 line-clamp-3">{notes}</p> : null}
                          </div>
                          <div className="flex flex-col items-end gap-1 text-xs text-gray-500">
                            <span>Report ID: {report.id}</span>
                            {isDraftReport ? (
                              <span className="text-[11px] font-medium text-orange-600">
                                {canOpenDraftFromReport ? "Click to resume draft" : "Draft not available locally"}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {filteredReports.length > REPORTS_PAGE_SIZE ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 text-xs text-gray-600">
                  <span>
                    Page {reportsPage} of {totalReportsPages || 1}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-300 text-gray-700 hover:bg-gray-50"
                      onClick={() => setReportsPage((prev) => Math.max(1, prev - 1))}
                      disabled={reportsPage <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-300 text-gray-700 hover:bg-gray-50"
                      onClick={() => setReportsPage((prev) => Math.min(totalReportsPages || 1, prev + 1))}
                      disabled={reportsPage >= (totalReportsPages || 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        </main>

        <Sheet
          open={isSheetOpen}
          onOpenChange={(open) => {
            setIsSheetOpen(open)
            if (!open) {
              setActiveDraftId(null)
            }
          }}
        >
          <SheetContent side="bottom" className="h-[92vh] overflow-hidden border-t-4 border-t-orange-200 p-0">
            <div className="flex h-full flex-col bg-orange-50">
              <SheetHeader className="border-b border-orange-100 bg-white px-4 py-3 text-left">
                <SheetTitle className="text-base font-semibold text-orange-900">PCR Draft workspace</SheetTitle>
                <SheetDescription className="text-xs text-gray-500">
                  Update patient details, injuries, and submit for review when ready.
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto">
                {activeDraft ? (
                  <ErTeamReportForm
                    draft={activeDraft}
                    hospitals={HOSPITAL_OPTIONS}
                    onDraftChange={(next) => {
                      setDrafts((previous) =>
                        previous.map((draft) => (draft.clientDraftId === next.clientDraftId ? next : draft))
                      )
                    }}
                    onSubmitForReview={handleSubmitForReview}
                    onClose={() => setActiveDraftId(null)}
                    isSubmitting={isSubmitting}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-sm text-gray-500">
                    Select a draft to continue.
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
