"use client"

import * as React from "react"
import Image from "next/image"
import { format, formatDistanceToNow } from "date-fns"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, AlertTriangle, History, LayoutDashboard, Activity, Stethoscope, HeartPulse, Hospital as HospitalIcon, Clock, CheckCircle2, Ambulance, ArrowRight, LogOut } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { InternalReportDetail, type InternalReportRecord, type InternalReportPatientRecord } from "@/components/admin/internal-report-detail"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { getPriorityDetails, PRIORITY_ORDER } from "@/lib/priority"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface BaseEntry {
  id: number
  name: string
}

interface HospitalRecord {
  id: string
  name: string
}

const HOSPITAL_NAME_OVERRIDES: Record<string, string> = {
  "Bulan Medicare Hospital / Pawa Hospital": "Bulan Medicare Hospital / Pawa Hospital",
  "SMMG - Bulan": "SMMG - Bulan",
  "Sorsogon Provincial Hospital": "Sorsogon Provincial Hospital",
  "SMMG-HSC (SorDoc)": "SMMG-HSC (SorDoc)",
  "Irosin District Hospital": "Irosin District Hospital",
  "Irosin General Hospital / IMAC": "Irosin General Hospital / IMAC",
}

type PatientStatus =
  | "pending"
  | "critical"
  | "healthy"
  | "discharged"
  | "dead"
  | "still_in_hospital"
  | "on_recovery"
  | "transferred"

const PATIENT_STATUS_VALUES: PatientStatus[] = [
  "pending",
  "critical",
  "healthy",
  "discharged",
  "dead",
  "still_in_hospital",
  "on_recovery",
  "transferred",
]

const ACTIONABLE_STATUSES: PatientStatus[] = PATIENT_STATUS_VALUES.filter((status) => status !== "pending")

const SUMMARY_STATUS_ORDER: PatientStatus[] = PATIENT_STATUS_VALUES.filter((status) =>
  status !== "transferred" && status !== "still_in_hospital"
)

const STATUS_METADATA: Record<PatientStatus, {
  label: string
  description: string
  icon: LucideIcon
  badgeClass: string
  iconClass: string
  cardBorderClass: string
}> = {
  pending: {
    label: "Pending",
    description: "Awaiting hospital action",
    icon: Clock,
    badgeClass: "bg-amber-100 text-amber-800",
    iconClass: "text-amber-500",
    cardBorderClass: "border-amber-200",
  },
  critical: {
    label: "Critical",
    description: "Requires immediate attention",
    icon: Activity,
    badgeClass: "bg-red-100 text-red-700",
    iconClass: "text-red-600",
    cardBorderClass: "border-red-200",
  },
  healthy: {
    label: "Healthy",
    description: "Recovered and cleared",
    icon: HeartPulse,
    badgeClass: "bg-emerald-100 text-emerald-700",
    iconClass: "text-emerald-600",
    cardBorderClass: "border-emerald-200",
  },
  discharged: {
    label: "Discharged",
    description: "Released from care",
    icon: CheckCircle2,
    badgeClass: "bg-blue-100 text-blue-700",
    iconClass: "text-blue-600",
    cardBorderClass: "border-blue-200",
  },
  dead: {
    label: "Deceased",
    description: "Reported fatalities",
    icon: AlertTriangle,
    badgeClass: "bg-neutral-200 text-neutral-700",
    iconClass: "text-neutral-500",
    cardBorderClass: "border-neutral-300",
  },
  still_in_hospital: {
    label: "Still in Hospital",
    description: "Undergoing treatment",
    icon: Stethoscope,
    badgeClass: "bg-indigo-100 text-indigo-700",
    iconClass: "text-indigo-600",
    cardBorderClass: "border-indigo-200",
  },
  on_recovery: {
    label: "On Recovery",
    description: "Stabilised and monitoring",
    icon: HospitalIcon,
    badgeClass: "bg-teal-100 text-teal-700",
    iconClass: "text-teal-600",
    cardBorderClass: "border-teal-200",
  },
  transferred: {
    label: "Transferred",
    description: "Moved to other facilities",
    icon: Ambulance,
    badgeClass: "bg-orange-100 text-orange-700",
    iconClass: "text-orange-600",
    cardBorderClass: "border-orange-200",
  },
}

type SidebarView = "pending" | "history"

const SIDEBAR_ITEMS: Array<{ key: SidebarView; label: string; description: string; icon: LucideIcon }> = [
  {
    key: "pending",
    label: "Incoming Patients",
    description: "New transfers awaiting action",
    icon: LayoutDashboard,
  },
  {
    key: "history",
    label: "Patient History",
    description: "Completed and archived cases",
    icon: History,
  },
]

interface PatientWithReport {
  patient: InternalReportPatientRecord
  report: InternalReportRecord | null
}

interface PatientStatusHistoryEntry {
  id: string
  internal_report_patient_id: string
  hospital_id: string
  status: PatientStatus
  notes: string | null
  transfer_hospital_id: string | null
  created_at: string
  created_by: string | null
}

type HistoryFilter = PatientStatus | "all"

const normalizeStatus = (value: string | null | undefined): PatientStatus => {
  if (!value) return "pending"
  const normalized = value.toLowerCase() as PatientStatus
  return PATIENT_STATUS_VALUES.includes(normalized) ? normalized : "pending"
}

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return format(date, "PPP • hh:mm a")
}

const StatusBadge = ({ status }: { status: PatientStatus }) => {
  const meta = STATUS_METADATA[status]
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", meta.badgeClass)}>
      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  )
}

export interface HospitalDashboardShellProps {
  onLogout?: () => void
}

export function HospitalDashboardShell({ onLogout }: HospitalDashboardShellProps) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [hospital, setHospital] = React.useState<HospitalRecord | null>(null)
  const [hospitals, setHospitals] = React.useState<HospitalRecord[]>([])
  const [barangays, setBarangays] = React.useState<BaseEntry[]>([])
  const [incidentTypes, setIncidentTypes] = React.useState<BaseEntry[]>([])
  const [erTeams, setErTeams] = React.useState<BaseEntry[]>([])
  const [patients, setPatients] = React.useState<PatientWithReport[]>([])
  const [historyEntries, setHistoryEntries] = React.useState<PatientStatusHistoryEntry[]>([])
  const [activeView, setActiveView] = React.useState<SidebarView>("pending")
  const [historyFilter, setHistoryFilter] = React.useState<HistoryFilter>("all")
  const [selectedReport, setSelectedReport] = React.useState<InternalReportRecord | null>(null)
  const [selectedMeta, setSelectedMeta] = React.useState<{ barangay: string; incidentType: string; erTeam: string }>({
    barangay: "",
    incidentType: "",
    erTeam: "",
  })
  const [selectedActionPatient, setSelectedActionPatient] = React.useState<PatientWithReport | null>(null)
  const [actionStatus, setActionStatus] = React.useState<PatientStatus>("still_in_hospital")
  const [actionNotes, setActionNotes] = React.useState("")
  const [actionTransferHospitalId, setActionTransferHospitalId] = React.useState("")
  const [isSubmittingAction, setIsSubmittingAction] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [showActionDialog, setShowActionDialog] = React.useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = React.useState<Date | null>(null)
  const [isReportLoading, setIsReportLoading] = React.useState(false)
  const [reportError, setReportError] = React.useState<string | null>(null)
  const [selectedPatients, setSelectedPatients] = React.useState<InternalReportPatientRecord[]>([])

  const hospitalsById = React.useMemo(() => {
    const map: Record<string, HospitalRecord> = {}
    for (const entry of hospitals) {
      map[entry.id] = entry
    }
    return map
  }, [hospitals])

  const transferHospitals = React.useMemo(() => {
    const list = hospital ? hospitals.filter((entry) => entry.id !== hospital.id) : hospitals
    return list
  }, [hospital, hospitals])

  const getSafeStatus = React.useCallback((status: string | null | undefined) => normalizeStatus(status), [])

  const normalizeId = React.useCallback((value: number | string | null | undefined) => {
    if (value === null || value === undefined) return null
    return String(value)
  }, [])

  const getHospitalDisplayName = React.useCallback((value: number | string | null | undefined) => {
    const normalized = normalizeId(value)
    if (normalized === null) return "—"
    const record = hospitalsById[normalized]
    if (record?.name) return record.name
    if (HOSPITAL_NAME_OVERRIDES[normalized]) return HOSPITAL_NAME_OVERRIDES[normalized]
    return "—"
  }, [hospitalsById, normalizeId])

  const getBarangayName = React.useCallback((id: number | string | null | undefined) => {
    const normalized = normalizeId(id)
    if (normalized === null) return "—"
    return barangays.find((b) => normalizeId(b.id) === normalized)?.name ?? "—"
  }, [barangays, normalizeId])

  const getIncidentTypeName = React.useCallback((id: number | string | null | undefined) => {
    const normalized = normalizeId(id)
    if (normalized === null) return "—"
    return incidentTypes.find((it) => normalizeId(it.id) === normalized)?.name ?? "—"
  }, [incidentTypes, normalizeId])

  const getErTeamName = React.useCallback((id: number | string | null | undefined) => {
    const normalized = normalizeId(id)
    if (normalized === null) return "—"
    return erTeams.find((et) => normalizeId(et.id) === normalized)?.name ?? "—"
  }, [erTeams, normalizeId])

  const getPatientsForReport = React.useCallback(
    (reportId: number): InternalReportPatientRecord[] =>
      patients.filter((entry) => entry.report?.id === reportId).map((entry) => entry.patient),
    [patients]
  )

  const loadHospitalData = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      const user = authData?.user
      if (!user) {
        setError("You must be signed in to view hospital data.")
        setLoading(false)
        return
      }

      const { data: mapping, error: mappingError } = await supabase
        .from("hospital_users")
        .select("hospital_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (mappingError) throw mappingError
      if (!mapping) {
        setError("No hospital assignment found for this account. Please contact the MDRRMO administrator.")
        setLoading(false)
        return
      }

      const hospitalId = mapping.hospital_id

      const hospitalsPromise = fetch("/api/hospital/hospitals", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }).then(async (response) => {
        if (!response.ok) {
          let message = response.statusText
          try {
            const payload = await response.json()
            if (payload?.error) message = payload.error
          } catch {}
          throw new Error(message || "Failed to load hospitals")
        }

        return response.json()
      })

      const [hospitalsPayload, barangaysRes, incidentTypesRes, erTeamsRes, patientsRes, historyRes] = await Promise.all([
        hospitalsPromise,
        supabase.from("barangays").select("id, name").order("name", { ascending: true }),
        supabase.from("incident_types").select("id, name").order("name", { ascending: true }),
        supabase.from("er_teams").select("id, name").order("name", { ascending: true }),
        supabase
          .from("internal_report_patients")
          .select(`
            *,
            internal_report:internal_reports!internal_report_patients_internal_report_id_fkey (
              id,
              original_report_id,
              incident_type_id,
              incident_date,
              time_responded,
              barangay_id,
              er_team_id,
              persons_involved,
              number_of_responders,
              prepared_by,
              created_at,
              incident_location,
              moi_poi_toi
            )
          `)
          .eq("receiving_hospital_id", hospitalId)
          .order("created_at", { ascending: false }),
        supabase
          .from("patient_status_history")
          .select(`
            id,
            internal_report_patient_id,
            hospital_id,
            status,
            notes,
            transfer_hospital_id,
            created_at,
            created_by
          `)
          .eq("hospital_id", hospitalId)
          .order("created_at", { ascending: false })
          .limit(400),
      ])

      if (barangaysRes.error) throw barangaysRes.error
      if (incidentTypesRes.error) throw incidentTypesRes.error
      if (erTeamsRes.error) throw erTeamsRes.error
      if (patientsRes.error) throw patientsRes.error
      if (historyRes.error) throw historyRes.error

      const hospitalRows = ((hospitalsPayload?.hospitals ?? []) as Array<{ id: string; name: string | null }>).map((row) => ({
        id: row.id,
        name: typeof row.name === "string" && row.name.trim().length > 0
          ? row.name.trim()
          : HOSPITAL_NAME_OVERRIDES[row.id] ?? row.id,
      })) as HospitalRecord[]
      setHospitals(hospitalRows)
      const matchedHospital = hospitalRows.find((row) => row.id === hospitalId) ?? null
      setHospital(matchedHospital)

      setBarangays(barangaysRes.data as BaseEntry[])
      setIncidentTypes(incidentTypesRes.data as BaseEntry[])
      setErTeams(erTeamsRes.data as BaseEntry[])

      type PatientQueryRow = InternalReportPatientRecord & { internal_report: InternalReportRecord | InternalReportRecord[] | null }
      const patientEntries: PatientWithReport[] = (patientsRes.data ?? []).map((row) => {
        const { internal_report, ...patientData } = row as unknown as PatientQueryRow
        const normalizedReport = Array.isArray(internal_report)
          ? internal_report[0] ?? null
          : internal_report ?? null
        return {
          patient: patientData,
          report: normalizedReport,
        }
      })
      setPatients(patientEntries)

      type HistoryQueryRow = PatientStatusHistoryEntry & { status: string }
      const historyRows = (historyRes.data ?? []) as HistoryQueryRow[]
      setHistoryEntries(historyRows.map((row) => ({ ...row, status: normalizeStatus(row.status) })))

      setLastRefreshedAt(new Date())
    } catch (err: any) {
      console.error("Failed to load hospital dashboard:", err)
      const message = err?.message || "Unable to load hospital dashboard. Please try again later."
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadHospitalData()
  }, [loadHospitalData])

  React.useEffect(() => {
    if (!selectedActionPatient) return
    setActionStatus("still_in_hospital")
    setActionNotes(selectedActionPatient.patient.current_status_notes ?? "")
    setActionTransferHospitalId(selectedActionPatient.patient.current_transfer_hospital_id ?? "")
    setActionError(null)
  }, [selectedActionPatient])

  React.useEffect(() => {
    if (actionStatus !== "transferred") {
      setActionTransferHospitalId("")
    }
  }, [actionStatus])

  const statusCounts = React.useMemo(() => {
    const counts = PATIENT_STATUS_VALUES.reduce<Record<PatientStatus, number>>((acc, status) => {
      acc[status] = 0
      return acc
    }, {} as Record<PatientStatus, number>)

    for (const entry of patients) {
      const status = getSafeStatus(entry.patient.current_status)
      counts[status] = (counts[status] ?? 0) + 1
    }

    return counts
  }, [patients, getSafeStatus])

  const pendingPatients = React.useMemo(
    () =>
      patients
        .filter((entry) => getSafeStatus(entry.patient.current_status) === "pending")
        .sort((a, b) => {
          const aDate = new Date(a.patient.created_at ?? 0).getTime()
          const bDate = new Date(b.patient.created_at ?? 0).getTime()
          return bDate - aDate
        }),
    [patients, getSafeStatus]
  )

  const historyPatients = React.useMemo(
    () =>
      patients
        .filter((entry) => getSafeStatus(entry.patient.current_status) !== "pending")
        .sort((a, b) => {
          const aDate = new Date(a.patient.status_updated_at ?? a.patient.created_at ?? 0).getTime()
          const bDate = new Date(b.patient.status_updated_at ?? b.patient.created_at ?? 0).getTime()
          return bDate - aDate
        }),
    [patients, getSafeStatus]
  )

  const filteredHistoryPatients = React.useMemo(() => {
    if (historyFilter === "all") return historyPatients
    return historyPatients.filter((entry) => getSafeStatus(entry.patient.current_status) === historyFilter)
  }, [historyPatients, historyFilter, getSafeStatus])

  const latestHistoryByPatient = React.useMemo(() => {
    const map = new Map<string, PatientStatusHistoryEntry>()
    for (const entry of historyEntries) {
      if (!map.has(entry.internal_report_patient_id)) {
        map.set(entry.internal_report_patient_id, entry)
      }
    }
    return map
  }, [historyEntries])

  const fetchReportDetail = React.useCallback(
    async (reportId: number) => {
      setIsReportLoading(true)
      setReportError(null)

      try {
        const response = await fetch(`/api/hospital/internal-reports/${reportId}`)
        if (!response.ok) {
          let message = response.statusText || "Failed to load report detail"
          try {
            const payload = await response.json()
            if (payload?.error) message = payload.error
          } catch {}
          throw new Error(message)
        }

        const payload = (await response.json()) as {
          report: InternalReportRecord
          patients: InternalReportPatientRecord[]
          barangay: string
          incidentType: string
          erTeam: string
        }

        setSelectedReport(payload.report)
        setSelectedMeta({
          barangay: payload.barangay,
          incidentType: payload.incidentType,
          erTeam: payload.erTeam,
        })
        setSelectedPatients(payload.patients)
      } catch (error: any) {
        console.error("Failed to fetch report detail", error)
        setReportError(error?.message || "Failed to load report detail. Please try again.")
      } finally {
        setIsReportLoading(false)
      }
    },
    [],
  )

  const openReportForPatient = (patient: PatientWithReport) => {
    setReportError(null)
    const report = patient.report
    if (!report) {
      setReportError("Report detail unavailable for this patient.")
      setSelectedReport(null)
      setSelectedPatients([])
      setIsReportLoading(false)
      return
    }

    setSelectedReport(report)
    setSelectedMeta({
      barangay: getBarangayName(report.barangay_id),
      incidentType: getIncidentTypeName(report.incident_type_id),
      erTeam: getErTeamName(report.er_team_id),
    })

    const initialPatients = getPatientsForReport(report.id)
    setSelectedPatients(initialPatients)
    void fetchReportDetail(report.id)
  }

  const closeReportDialog = () => {
    setSelectedReport(null)
    setSelectedPatients([])
    setReportError(null)
    setIsReportLoading(false)
  }

  const openActionDialog = (patient: PatientWithReport) => {
    setSelectedActionPatient(patient)
    setShowActionDialog(true)
  }

  const closeActionDialog = () => {
    if (isSubmittingAction) return
    setSelectedActionPatient(null)
    setShowActionDialog(false)
    setActionNotes("")
    setActionTransferHospitalId("")
    setActionError(null)
  }

  const handleSubmitPatientAction = async () => {
    if (!selectedActionPatient) return
    const patient = selectedActionPatient.patient
    if (!patient.receiving_hospital_id) {
      setActionError("This patient has no hospital assignment.")
      return
    }

    const previousHospitalId = patient.receiving_hospital_id

    const isTransfer = actionStatus === "transferred"
    if (isTransfer && !actionTransferHospitalId) {
      setActionError("Please choose the receiving hospital for the transfer.")
      return
    }
    if (isTransfer && hospital && actionTransferHospitalId === hospital.id) {
      setActionError("Please select a different hospital when transferring a patient.")
      return
    }

    const trimmedNotes = actionNotes.trim()

    setIsSubmittingAction(true)
    setActionError(null)

    try {
      if (isTransfer) {
        const response = await fetch("/api/hospital/transfer-patient", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            patientId: patient.id,
            targetHospitalId: actionTransferHospitalId,
            notes: trimmedNotes || null,
          }),
        })

        if (!response.ok) {
          let message = response.statusText
          try {
            const payload = await response.json()
            if (payload?.error) {
              message = payload.error
            }
          } catch {}
          throw new Error(message || "Failed to transfer patient")
        }
      } else {
        await supabase.from("patient_status_history").insert({
          internal_report_patient_id: patient.id,
          hospital_id: previousHospitalId,
          status: actionStatus,
          notes: trimmedNotes ? trimmedNotes : null,
          transfer_hospital_id: null,
        })

        await supabase
          .from("internal_report_patients")
          .update({
            current_status: actionStatus,
            current_status_notes: trimmedNotes ? trimmedNotes : null,
            current_transfer_hospital_id: null,
          })
          .eq("id", patient.id)
      }

      closeActionDialog()
      await loadHospitalData()
    } catch (err: any) {
      console.error("Failed to update patient status:", err)
      const message = err?.message || "Unable to update patient status. Please try again."
      setActionError(message)
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const handleRefresh = () => {
    void loadHospitalData()
  }

  React.useEffect(() => {
    if (!hospital) return

    const channel = supabase
      .channel(`hospital-dashboard-${hospital.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "internal_report_patients",
          filter: `receiving_hospital_id=eq.${hospital.id}`,
        },
        () => {
          void loadHospitalData()
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patient_status_history",
          filter: `hospital_id=eq.${hospital.id}`,
        },
        () => {
          void loadHospitalData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [hospital, loadHospitalData])

  const pendingView = (
    <Card className="border-none shadow-lg">
      <CardHeader className="bg-white">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-gray-900">Pending Patient Transfers</CardTitle>
            <p className="text-sm text-gray-600">Review new patient transfers and record hospital actions.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span>Last refreshed:</span>
            <span className="font-medium text-gray-700">
              {lastRefreshedAt ? formatDistanceToNow(lastRefreshedAt, { addSuffix: true }) : "—"}
            </span>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="border-orange-300 text-orange-600 hover:bg-orange-50">
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50 uppercase tracking-wide text-xs text-gray-500">
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingPatients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-gray-500">
                    No pending patients at the moment.
                  </TableCell>
                </TableRow>
              ) : (
                pendingPatients.map((entry) => {
                  const patient = entry.patient
                  const report = entry.report
                  const priority = getPriorityDetails(patient.evacuation_priority)
                  return (
                    <TableRow key={patient.id} className="hover:bg-orange-50/60">
                      <TableCell className="max-w-[220px] font-medium text-gray-900">
                        {patient.patient_name || "Unnamed patient"}
                        <div className="text-xs text-gray-500">ID: {patient.id}</div>
                      </TableCell>
                      <TableCell>
                        {priority ? (
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-white", priority.colorClass)}>
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                            {priority.value}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {formatDateTime(patient.created_at)}
                        <div className="text-xs text-gray-500">
                          {patient.status_updated_at ? `Updated ${formatDistanceToNow(new Date(patient.status_updated_at), { addSuffix: true })}` : "Awaiting action"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={getSafeStatus(patient.current_status)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-50" onClick={() => openReportForPatient(entry)}>
                            View report
                          </Button>
                          <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => openActionDialog(entry)}>
                            Record action
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )

  const historyView = (
    <Card className="border-none shadow-lg">
      <CardHeader className="bg-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-gray-900">Patient History</CardTitle>
            <p className="text-sm text-gray-600">Completed cases automatically move here once an action is recorded.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={historyFilter} onValueChange={(value) => setHistoryFilter(value as HistoryFilter)}>
              <SelectTrigger className="w-[200px] bg-white text-sm">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ACTIONABLE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_METADATA[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="border-orange-300 text-orange-600 hover:bg-orange-50">
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50 uppercase tracking-wide text-xs text-gray-500">
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Transfer</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistoryPatients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-gray-500">
                    No historical patients for this filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredHistoryPatients.map((entry) => {
                  const patient = entry.patient
                  const latestHistory = latestHistoryByPatient.get(patient.id) ?? null
                  const status = getSafeStatus(patient.current_status)
                  const transferHospital = status === "transferred"
                    ? getHospitalDisplayName(patient.current_transfer_hospital_id)
                    : null

                  return (
                    <TableRow key={patient.id} className="hover:bg-orange-50/60">
                      <TableCell className="max-w-[240px] font-medium text-gray-900">
                        {patient.patient_name || "Unnamed patient"}
                        <div className="text-xs text-gray-500">ID: {patient.id}</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={status} />
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {formatDateTime(patient.status_updated_at)}
                        <div className="text-xs text-gray-500">
                          {patient.status_updated_at ? formatDistanceToNow(new Date(patient.status_updated_at), { addSuffix: true }) : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px] text-sm text-gray-700">
                        {latestHistory?.notes ? latestHistory.notes : <span className="text-gray-400">No notes</span>}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {transferHospital}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-50" onClick={() => openReportForPatient(entry)}>
                            View report
                          </Button>
                          <Button size="sm" variant="ghost" className="text-orange-600 hover:text-orange-700" onClick={() => openActionDialog(entry)}>
                            Update
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-orange-600">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="mt-3 text-sm font-medium">Loading hospital dashboard…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-6 text-center text-gray-700">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h1 className="mt-4 text-xl font-semibold text-gray-900">We hit a snag</h1>
        <p className="mt-2 max-w-sm text-sm text-gray-600">{error}</p>
        <Button className="mt-6 bg-orange-500 hover:bg-orange-600" onClick={handleRefresh}>
          Try again
        </Button>
      </div>
    )
  }

  if (!hospital) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-6 text-center text-gray-700">
        <AlertTriangle className="h-12 w-12 text-orange-500" />
        <h1 className="mt-4 text-xl font-semibold text-gray-900">Hospital assignment missing</h1>
        <p className="mt-2 max-w-sm text-sm text-gray-600">No hospital assignment found for this account. Please contact the MDRRMO administrator.</p>
      </div>
    )
  }

  return (
    <div
      className="relative min-h-screen"
      style={{
        backgroundImage: "url('/images/mdrrmo_dashboard_bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-black/35" />

      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 bg-orange-500/95 backdrop-blur-sm text-white px-4 py-6 shadow-lg sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Image
                src="/images/logo.png"
                alt="MDRRMO Bulan logo"
                width={84}
                height={84}
                className="h-20 w-20 rounded-full bg-white/90 p-2 object-contain shadow-sm"
                priority
              />
              <div>
                <p className="text-sm uppercase tracking-wide text-orange-100">MDRRMO Patient Transfer Portal</p>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{hospital ? `${hospital.name} Dashboard` : "Hospital Operations Dashboard"}</h1>
                <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                  <ArrowRight className="h-3.5 w-3.5" />
                  Empowering hospital coordination across Bulan
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-orange-100">
              {onLogout ? (
                <Button variant="outline" className="border-white bg-white text-gray-900 hover:bg-white/90" onClick={onLogout}>
                  <LogOut className="mr-2 h-4 w-4 text-gray-900" />
                  Logout
                </Button>
              ) : null}
              <Image
                src="/images/bulan-logo.png"
                alt="Bulan Municipality logo"
                width={84}
                height={84}
                className="h-20 w-20 rounded-full bg-white/90 p-2 object-contain shadow-sm"
                priority
              />
            </div>
          </div>
        </header>

        <main className="flex-1 w-full py-10">
          <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-8 px-4 sm:px-6 lg:flex-row lg:px-12 xl:gap-12">
            <aside className="w-full space-y-4 rounded-2xl bg-white/90 p-4 shadow-lg backdrop-blur lg:sticky lg:top-32 lg:w-80">
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-gray-900">Navigation</h2>
                {SIDEBAR_ITEMS.map((item) => {
                  const Icon = item.icon
                  const isActive = item.key === activeView
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveView(item.key)}
                      className={cn(
                        "w-full rounded-lg border px-4 py-3 text-left transition",
                        isActive
                          ? "border-orange-500 bg-orange-50 text-orange-700 shadow-sm"
                          : "border-transparent bg-white text-gray-700 hover:border-orange-200 hover:bg-orange-50/60"
                      )}
                    >
                      <span className="flex items-start gap-3">
                        <Icon className={cn("mt-0.5 h-5 w-5", isActive ? "text-orange-600" : "text-gray-400")} />
                        <span>
                          <span className="block text-sm font-semibold">{item.label}</span>
                          <span className="mt-0.5 block text-xs text-gray-500">{item.description}</span>
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </aside>

            <section className="flex-1 space-y-8 rounded-2xl bg-white/95 p-6 shadow-xl backdrop-blur lg:min-w-0 lg:p-8">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {SUMMARY_STATUS_ORDER.map((status) => {
                  const meta = STATUS_METADATA[status]
                  const Icon = meta.icon
                  return (
                    <Card key={status} className={cn("border bg-white shadow-sm", meta.cardBorderClass)}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">{meta.label}</CardTitle>
                        <Icon className={cn("h-5 w-5", meta.iconClass)} />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{statusCounts[status]}</div>
                        <p className="text-xs text-gray-500">{meta.description}</p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              {activeView === "pending" ? pendingView : historyView}
            </section>
          </div>
        </main>

        <footer className="bg-orange-500/95 py-4 text-white">
          <div className="mx-auto max-w-[1800px] px-4 text-center text-xs font-medium sm:px-6 sm:text-sm">
            © {new Date().getFullYear()} MDRRMO Bulan | Hospital portal
          </div>
        </footer>
      </div>

      <Dialog open={selectedReport !== null} onOpenChange={(open) => { if (!open) closeReportDialog() }}>
        <DialogContent className="border-none bg-white p-0 shadow-xl" style={{ width: "21.59cm", height: "33.02cm", maxWidth: "95vw", maxHeight: "90vh" }}>
          <VisuallyHidden>
            <DialogTitle>Internal report detail</DialogTitle>
          </VisuallyHidden>
          <DialogDescription className="sr-only">
            View the patient transfer report and body map diagrams.
          </DialogDescription>
          {selectedReport ? (
            <div className="h-full overflow-y-auto p-6 space-y-4">
              {reportError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {reportError}
                </div>
              ) : null}
              <InternalReportDetail
                report={selectedReport}
                patients={selectedPatients}
                barangayName={selectedMeta.barangay}
                incidentTypeName={selectedMeta.incidentType}
                erTeamName={selectedMeta.erTeam}
                restrictToPatientView
              />
              {isReportLoading ? (
                <p className="text-center text-sm text-gray-500">Refreshing latest report data…</p>
              ) : null}
            </div>
          ) : isReportLoading ? (
            <div className="flex h-48 items-center justify-center text-gray-600">Loading report…</div>
          ) : (
            <div className="flex h-48 items-center justify-center text-gray-600">Report detail unavailable.</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showActionDialog} onOpenChange={(open) => { if (!open) closeActionDialog() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">Record hospital action</DialogTitle>
            <DialogDescription>
              Update the patient status to move them into history and keep the MDRRMO informed.
            </DialogDescription>
          </DialogHeader>
          {selectedActionPatient ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-900">{selectedActionPatient.patient.patient_name || "Unnamed patient"}</p>
                <p className="text-gray-600">Report ID: {selectedActionPatient.report?.id ?? "—"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <StatusBadge status={getSafeStatus(selectedActionPatient.patient.current_status)} />
                  {selectedActionPatient.patient.status_updated_at ? (
                    <span>Last updated {formatDistanceToNow(new Date(selectedActionPatient.patient.status_updated_at), { addSuffix: true })}</span>
                  ) : (
                    <span>No previous updates</span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="patient-status">New status</Label>
                  <Select value={actionStatus} onValueChange={(value) => setActionStatus(value as PatientStatus)}>
                    <SelectTrigger id="patient-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIONABLE_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_METADATA[status].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {actionStatus === "transferred" ? (
                  <div className="space-y-2">
                    <Label htmlFor="transfer-hospital">Transfer to hospital</Label>
                    <Select value={actionTransferHospitalId} onValueChange={setActionTransferHospitalId}>
                      <SelectTrigger id="transfer-hospital">
                        <SelectValue placeholder="Select receiving hospital" />
                      </SelectTrigger>
                      <SelectContent>
                        {transferHospitals.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {getHospitalDisplayName(option.id)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="patient-notes">Notes (optional)</Label>
                  <Textarea
                    id="patient-notes"
                    placeholder="Add important context for this action"
                    value={actionNotes}
                    onChange={(event) => setActionNotes(event.target.value)}
                    rows={4}
                  />
                </div>

                {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
              </div>
            </div>
          ) : null}
          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" onClick={closeActionDialog} disabled={isSubmittingAction}>
              Cancel
            </Button>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={handleSubmitPatientAction} disabled={isSubmittingAction}>
              {isSubmittingAction ? "Saving…" : "Save status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
