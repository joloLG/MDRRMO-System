"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { fetchWithRetry } from "@/lib/api-utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import {
  saveErTeamSession,
  saveErTeamUserData,
  loadErTeamSession,
  loadErTeamUserData,
  isErTeamSessionValid,
  clearErTeamSession,
  updateErTeamLastActive,
  extendErTeamSession,
} from "@/lib/er-team-session"
import {
  loadDrafts as loadDraftsFromDB,
  upsertDraft,
  upsertDrafts,
  loadReference,
  saveReference,
  removeDraft,
  saveAsset,
  loadAsset,
  forceRefreshData,
  setCacheTimestamp,
  shouldForceRefresh,
} from "@/lib/er-team-storage"
import { Bell, Loader2, RefreshCw, WifiOff, Wifi, User, X } from "lucide-react"
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
import { ErTeamBottomNav, type ErTeamTab } from "./er-team-bottom-nav"
import { AccommodatedPage, DraftsPage, ErTeamProvider, HomePage, ReportFormPage } from "./pages"

// Capacitor imports
import { CapacitorGeolocation, type LocationCoords, type LocationError } from "@/lib/capacitor-geolocation"
import { CapacitorNotifications } from "@/lib/capacitor-notifications"
import { App } from '@capacitor/app' // ADDED: Import App for state handling

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

const saveToCache = async <T,>(key: string, data: T): Promise<void> => {
  try {
    const cacheData = {
      data,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(`er-cache-${key}`, JSON.stringify(cacheData));
  } catch (error) {
    console.error(`Failed to save ${key} to cache:`, error);
  }
};

const loadFromCache = async <T,>(key: string, maxAgeMinutes = 60): Promise<T | null> => {
  try {
    const cached = localStorage.getItem(`er-cache-${key}`);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const cacheDate = new Date(timestamp);
    const now = new Date();
    const diffMinutes = (now.getTime() - cacheDate.getTime()) / (1000 * 60);

    if (diffMinutes > maxAgeMinutes) {
      console.log(`Cache for ${key} is stale (${diffMinutes.toFixed(1)} minutes old)`);
      return null;
    }

    return data as T;
  } catch (error) {
    console.error(`Failed to load ${key} from cache:`, error);
    return null;
  }
};

async function preloadSvgAssets() {
  if (typeof window === "undefined" || !navigator.onLine) return

  const assets = [
    "/body_part_front-01.svg",
    "/body_part_back-01.svg"
  ]

  for (const assetPath of assets) {
    try {
      // Check if already cached
      const cached = await loadAsset(assetPath)
      if (cached) continue

      // Fetch and cache
      const response = await fetch(assetPath)
      if (response.ok) {
        const content = await response.text()
        await saveAsset(assetPath, content, "image/svg+xml")
        console.log(`Preloaded SVG asset: ${assetPath}`)
      }
    } catch (error) {
      console.warn(`Failed to preload SVG asset ${assetPath}:`, error)
    }
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
  const [userFirstName, setUserFirstName] = React.useState<string | null>(null)
  const [userLastName, setUserLastName] = React.useState<string | null>(null)
  const [userEmail, setUserEmail] = React.useState<string | null>(null)
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
  const [activeTab, setActiveTab] = React.useState<ErTeamTab>("home")

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
  const selectedIncident = selectedIncidentId 
    ? assignedIncidents.find(incident => incident.id === selectedIncidentId) ?? latestAssignedIncident
    : latestAssignedIncident

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
          user?: { id: string; firstName: string | null; lastName: string | null; email: string | null }
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

        // Save persistent session for ER Team
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
        if (controller.signal.aborted || !isActive) {
          return
        }

        console.error("Failed to load ER team profile", error)
        const status = (error as { status?: number }).status
        const fallbackMessage = status === 429 ? "Too many profile checks. Please wait a moment and try again." : "Failed to load ER team assignment"
        const message = typeof error?.message === "string" && error.message.trim().length > 0 ? error.message : fallbackMessage
        
        // For ER Team, try to use persistent session even on error
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

    setLoadingReports(true)
    setLoadingError(null)

    // Try to load from cache first for immediate response
    if (!navigator.onLine) {
      console.log('📴 refreshReports: Offline mode')
      try {
        const cachedReports = await loadFromCache<SyncedReport[]>('er-team-reports')
        if (cachedReports) {
          console.log('📦 Using cached reports:', cachedReports.length, 'items')
          setReports(cachedReports)
          setLoadingError("You're currently offline. Using cached reports.")
        } else {
          setLoadingError("You're offline and no cached reports are available.")
        }
      } catch (error) {
        console.error('❌ Error loading cached reports:', error)
        setLoadingError("Failed to load cached reports. Please check your connection.")
      } finally {
        setLoadingReports(false)
      }
      return
    }

    try {
      console.log('🌐 Fetching reports from /api/er-team/reports')
      // Append timestamp to force cache busting on mobile devices
      // This defeats aggressive WebView/Chrome caching
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
      const reports = Array.isArray(payload?.reports) ? payload.reports : []
      
      console.log('📋 Fetched reports:', reports.length, 'items')
      setReports(reports)
      
      // Update cache
      await saveToCache('er-team-reports', reports)
      await setCacheTimestamp()
      
    } catch (error: any) {
      console.error("❌ Failed to load ER team reports", error)
      
      // Fall back to cached data if available
      try {
        const cachedReports = await loadFromCache<SyncedReport[]>('er-team-reports')
        if (cachedReports) {
          console.log('🔄 Falling back to cached reports')
          setReports(cachedReports)
          setLoadingError("Network error. Using cached reports: " + (error?.message || 'Unknown error'))
        } else {
          throw error // Re-throw if no cached data available
        }
      } catch (cacheError) {
        setLoadingError(error?.message ?? "Unable to load reports")
      }
    } finally {
      setLoadingReports(false)
    }
  }, [profileStatus, teamId])

  const refreshAssignedIncidents = React.useCallback(async () => {
    console.log('🔄 refreshAssignedIncidents called');

    if (profileStatus !== "authorized" || !teamId) {
      console.log('❌ refreshAssignedIncidents: Not authorized or no teamId', { profileStatus, teamId });
      return;
    }

    console.log('📡 refreshAssignedIncidents: Starting for team', teamId);
    setAssignedLoading(true);
    setAssignedError(null);

    try {
      // First try to load from cache for immediate response
      const cacheKey = `assigned-incidents-${teamId}`;
      const cachedData = await loadFromCache<AssignedIncident[]>(cacheKey);
      
      if (cachedData) {
        console.log('📦 Using cached assigned incidents:', cachedData.length, 'items');
        setAssignedIncidents(cachedData);
        applyDraftMerge(cachedData);
      }

      // Check if we need to force refresh
      const forceRefresh = await shouldForceRefresh(5); // 5 minutes cache TTL
      if (!navigator.onLine && !cachedData) {
        console.log('📴 Offline and no cached data available');
        setAssignedError("You're offline and no cached data is available.");
        return;
      }

      if (!navigator.onLine) {
        console.log('📴 Offline mode - using cached data');
        setAssignedError("You're currently offline. Using cached data.");
        return;
      }

      console.log('🌐 Fetching assigned incidents from server');
      // Adding timestamp query param to force a fresh fetch on mobile devices
      // This defeats aggressive WebView/Chrome caching
      const response = await fetchWithRetry(`/api/er-team/assigned?_t=${Date.now()}`, {
        credentials: "include",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'X-Cache-Bypass': '1',
        },
        cache: 'no-store'
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const message = await extractErrorMessage(response);
        console.error('❌ API error:', message);
        throw new Error(message);
      }

      const body = await response.json();
      const incidents = Array.isArray(body?.incidents) ? body.incidents : [];
      console.log('📋 Fetched incidents:', incidents.length, 'items');

      // Filter out incidents with internal reports
      const filteredIncidents = incidents.filter((incident: AssignedIncident) => 
        !incident.er_team_report?.internal_report_id
      );
      console.log('🔍 Filtered incidents:', filteredIncidents.length, 'items');

      // Sort and update state
      const ordered = sortAssignedIncidents(filteredIncidents);
      setAssignedIncidents(ordered);
      
      // Save to cache with shorter TTL for mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      await saveToCache(cacheKey, ordered); // TTL is now handled by the saveToCache function
      
      await setCacheTimestamp();
      applyDraftMerge(ordered);

      console.log('✅ Successfully updated assigned incidents');
    } catch (error: any) {
      console.error("❌ Failed to load assigned incidents", error);
      
      // If we have cached data, use it even if it's stale
      if (assignedIncidents.length > 0) {
        console.log('🔄 Falling back to existing state data');
        setAssignedError("Network error. Using existing data: " + (error?.message || 'Unknown error'));
      } else {
        // Try to load from cache as last resort
        try {
          const cacheKey = `assigned-incidents-${teamId}`;
          const cachedData = await loadFromCache<AssignedIncident[]>(cacheKey);
          if (cachedData) {
            console.log('🔄 Falling back to cached data');
            setAssignedIncidents(cachedData);
            setAssignedError("Network error. Using cached data: " + (error?.message || 'Unknown error'));
            applyDraftMerge(cachedData);
          } else {
            throw error; // Re-throw if no cached data available
          }
        } catch (cacheError) {
          setAssignedError(error?.message ?? "Unable to load assigned incidents");
        }
      }
    } finally {
      setAssignedLoading(false);
      console.log('🏁 refreshAssignedIncidents completed');
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

        // Preload SVG assets for offline use
        void preloadSvgAssets()
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

  // Periodic session extension for ER Team (every 15 minutes when online)
  React.useEffect(() => {
    const extendSession = async () => {
      if (navigator.onLine && profileStatus === "authorized") {
        console.log("[ER Team] Extending session...")
        const success = await extendErTeamSession(supabase)
        if (success) {
          console.log("[ER Team] Session extended successfully")
        } else {
          console.log("[ER Team] Session extension skipped or failed")
        }
      }
    }

    // Initial extension after 5 minutes
    const initialTimeout = setTimeout(() => {
      void extendSession()
    }, 5 * 60 * 1000)

    // Periodic extension every 15 minutes
    const interval = setInterval(() => {
      void extendSession()
    }, 15 * 60 * 1000)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [profileStatus])

  React.useEffect(() => {
    if (isOnline) {
      void refreshReports()
      void refreshAssignedIncidents()
      void (async () => {
        const cache = readCachedProfile()
        if (!cache) {
          return
        }
        setTeamId(cache.teamId)
        setTeamName(cache.teamName)
      })()
    }
  }, [isOnline, refreshReports, refreshAssignedIncidents])

  // Force refresh data on mount for mobile apps to ensure they get latest data
  React.useEffect(() => {
    const forceRefreshForMobile = async () => {
      if (profileStatus === "authorized" && teamId) {
        try {
          // Check if we need to force refresh based on cache timestamp
          const shouldRefresh = await shouldForceRefresh(5) // Force refresh every 5 minutes for mobile
          if (shouldRefresh) {
            console.log('📱 Mobile app detected - forcing data refresh')
            await forceRefreshData()
            await setCacheTimestamp()
            // Refresh data after clearing cache
            await Promise.all([refreshAssignedIncidents(), refreshReports()])
          }
        } catch (error) {
          console.error('❌ Error during mobile force refresh:', error)
          // If there's a database error, still try to refresh data
          try {
            await Promise.all([refreshAssignedIncidents(), refreshReports()])
          } catch (refreshError) {
            console.error('❌ Error refreshing data after force refresh failed:', refreshError)
          }
        }
      }
    }

    void forceRefreshForMobile()

    // Set up periodic force refresh for mobile apps every 10 minutes (reduced frequency)
    const mobileRefreshInterval = setInterval(() => {
      if (profileStatus === "authorized" && teamId && navigator.onLine) {
        void forceRefreshForMobile()
      }
    }, 10 * 60 * 1000) // 10 minutes instead of 5

    return () => clearInterval(mobileRefreshInterval)
  }, [profileStatus, teamId, refreshAssignedIncidents, refreshReports])

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

    // Add visibility change listener for when user returns to tab (Desktop/Web)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !assignedLoading) {
        console.log('Tab became visible: refreshing assigned incidents')
        void refreshAssignedIncidents()
        void refreshReports()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Add App State listener for native Capacitor apps
    // This is CRITICAL for mobile apps as they don't always trigger visibilitychange
    const handleAppStateChange = async ({ isActive }: { isActive: boolean }) => {
      if (isActive) {
        console.log('📱 App became active (foreground): refreshing all data')
        try {
          // Force clear some cache if needed
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
    
    // Add the listener
    const listenerPromise = App.addListener('appStateChange', handleAppStateChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      listenerPromise.then(handle => handle.remove())
    }
  }, [profileStatus, teamId, assignedLoading, refreshAssignedIncidents, refreshReports])

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

  const contextValue = React.useMemo(
    () => ({
      drafts,
      reports,
      assignedIncidents,
      teamId,
      teamName,
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
      teamId,
      teamName,
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
    <ErTeamProvider value={contextValue}>
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
                  onClick={() => {
                    window.location.reload()
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
                            {userFirstName && userLastName ? `${userFirstName} ${userLastName}` : "User"}
                          </div>
                          <div className="text-sm text-gray-500 truncate">{userEmail || "No email"}</div>
                          {teamName && (
                            <div className="text-xs text-orange-600 font-medium mt-1">
                              {teamName} Team
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
                        <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
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

          <main className="flex-1 space-y-6 px-4 py-6 sm:px-6 pb-24">
            {activeTab === "home" ? (
              <HomePage />
            ) : activeTab === "drafts" ? (
              <DraftsPage />
            ) : activeTab === "report-form" ? (
              <ReportFormPage />
            ) : (
              <AccommodatedPage />
            )}
          </main>

          <ErTeamBottomNav
            activeTab={activeTab}
            onTabChange={setActiveTab}
            draftCount={drafts.filter((draft) => draft.status === "draft").length}
          />

          <Sheet
            open={isSheetOpen}
            onOpenChange={(open) => {
              setIsSheetOpen(open)
              if (!open) {
                setActiveDraftId(null)
              }
            }}
          >
            <SheetContent side="bottom" className="flex h-[92vh] flex-col overflow-hidden border-t-4 border-t-orange-200 p-0">
              <SheetHeader>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-gray-900">
                    {activeDraft
                      ? `Draft ${activeDraft.emergencyReportId?.slice(0, 8) || activeDraft.clientDraftId.slice(0, 8)}`
                      : "Untitled Draft"}
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Close sheet"
                    onClick={() => setIsSheetOpen(false)}
                    className="text-gray-500 hover:bg-gray-100 rounded-full p-2 transition-all duration-200"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </SheetHeader>
              <div className="flex-1 min-h-0 overflow-y-auto">
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
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </ErTeamProvider>
  )
}