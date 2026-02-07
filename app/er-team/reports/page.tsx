"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, FileText, Clock, CheckCircle, XCircle, Eye } from "lucide-react"
import { ErTeamReportForm } from "@/components/er-team/er-team-report-form"
import type { ErTeamDraft, ErTeamPatientPayload } from "@/components/er-team/er-team-report-form"
import { useErTeamReferences } from "@/lib/hooks/useErTeamReferences"
import { format } from "date-fns"
import { saveToCache, loadFromCache } from "@/lib/er-team-cache"

interface StandaloneReport {
  id: string
  report_title: string
  report_date: string
  incident_type?: string
  incident_location?: string
  status: "draft" | "pending_review" | "in_review" | "approved" | "rejected"
  patient_payload: ErTeamPatientPayload[]
  injury_payload?: any
  notes?: string
  created_at: string
  updated_at: string
}

const STATUS_CONFIG = {
  draft: { label: "Draft", icon: FileText, className: "bg-gray-200 text-gray-800" },
  pending_review: { label: "Pending Review", icon: Clock, className: "bg-amber-200 text-amber-800" },
  in_review: { label: "In Review", icon: Eye, className: "bg-blue-200 text-blue-800" },
  approved: { label: "Approved", icon: CheckCircle, className: "bg-emerald-200 text-emerald-900" },
  rejected: { label: "Rejected", icon: XCircle, className: "bg-red-200 text-red-800" },
}

export default function ErTeamReportsPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { hospitals, barangays } = useErTeamReferences()
  
  const [reports, setReports] = React.useState<StandaloneReport[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [showForm, setShowForm] = React.useState(false)
  const [activeDraft, setActiveDraft] = React.useState<ErTeamDraft | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const loadReports = React.useCallback(async () => {
    try {
      const response = await fetch("/api/er-team/standalone-reports", { credentials: "include" })
      if (response.ok) {
        const data = await response.json()
        setReports(data.reports || [])
      }
    } catch (error) {
      console.error("Failed to load reports:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadReports()
  }, [loadReports])

  const handleCreateNew = () => {
    const newDraft: ErTeamDraft = {
      clientDraftId: crypto.randomUUID(),
      emergencyReportId: "", // Standalone reports don't have emergency report
      status: "draft",
      updatedAt: new Date().toISOString(),
      synced: false,
      patientsPayload: [],
      injuryPayload: { front: {}, back: {} },
      notes: "",
    }
    setActiveDraft(newDraft)
    setShowForm(true)
  }

  const handleDraftChange = async (next: ErTeamDraft) => {
    setActiveDraft(next)
    // Auto-save draft to cache for offline support
    try {
      await saveToCache(`standalone-draft-${next.clientDraftId}`, next)
    } catch (error) {
      console.error("Failed to cache draft:", error)
    }
  }

  const handleSubmitForReview = async (draft: ErTeamDraft) => {
    setIsSubmitting(true)
    try {
      const currentDate = format(new Date(), "yyyy-MM-dd")
      
      // Build comprehensive incident payload
      const incidentPayload = {
        incidentType: draft.patientsPayload[0]?.typeOfEmergencySelections?.[0] || null,
        incidentLocation: draft.patientsPayload[0]?.incidentLocation || null,
        moiPoiToi: draft.patientsPayload[0]?.moiPoiToi || null,
        noi: draft.patientsPayload[0]?.noi || null,
        signsSymptoms: draft.patientsPayload[0]?.signsSymptoms || null,
        ...draft.incidentPayload,
      }
      
      const payload = {
        reportTitle: `PCR Report - ${currentDate}`,
        reportDate: new Date().toISOString(),
        incidentPayload,
        patientPayload: draft.patientsPayload.map(patient => ({
          ...patient,
          // Ensure each patient has their injury data
          injuryPayload: patient.injuryPayload || { front: {}, back: {} },
        })),
        injuryPayload: draft.injuryPayload || draft.patientsPayload[0]?.injuryPayload,
        notes: draft.notes,
        status: draft.status === "draft" ? "draft" : "pending_review",
      }

      // Try to submit online first
      const response = await fetch("/api/er-team/standalone-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to submit report")
      }

      // Clear any cached draft on successful submission
      await saveToCache(`standalone-draft-${draft.clientDraftId}`, null)
      
      await loadReports()
      setShowForm(false)
      setActiveDraft(null)
      
      alert("Report submitted successfully!")
    } catch (error: any) {
      console.error("Failed to submit report:", error)
      
      // If offline, save draft for later
      if (!navigator.onLine || error.message.includes("Failed to fetch")) {
        try {
          await saveToCache(`standalone-draft-${draft.clientDraftId}`, draft)
          alert("You're offline. Report saved as draft and will be submitted when you're back online.")
          setShowForm(false)
          setActiveDraft(null)
        } catch (cacheError) {
          alert("Failed to save draft offline: " + (cacheError as Error).message)
        }
      } else {
        alert(error.message || "Failed to submit report")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setShowForm(false)
    setActiveDraft(null)
  }

  if (showForm && activeDraft) {
    return (
      <div className="h-screen overflow-hidden">
        <ErTeamReportForm
          draft={activeDraft}
          hospitals={hospitals}
          barangays={barangays}
          onDraftChange={handleDraftChange}
          onSubmitForReview={handleSubmitForReview}
          onClose={handleClose}
          isSubmitting={isSubmitting}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">ER Team Reports</h1>
            <p className="mt-1 text-sm text-gray-600">Submit and manage standalone PCR reports</p>
          </div>
          <Button onClick={handleCreateNew} className="bg-orange-600 hover:bg-orange-700">
            <Plus className="mr-2 h-4 w-4" />
            New Report
          </Button>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-600 border-r-transparent"></div>
              <p className="text-sm text-gray-600">Loading reports...</p>
            </div>
          </div>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="mb-4 h-16 w-16 text-gray-400" />
              <h3 className="mb-2 text-lg font-semibold text-gray-900">No Reports Yet</h3>
              <p className="mb-4 text-center text-sm text-gray-600">
                Create your first standalone PCR report to get started
              </p>
              <Button onClick={handleCreateNew} className="bg-orange-600 hover:bg-orange-700">
                <Plus className="mr-2 h-4 w-4" />
                Create First Report
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => {
              const statusConfig = STATUS_CONFIG[report.status]
              const StatusIcon = statusConfig.icon
              const patientCount = Array.isArray(report.patient_payload) ? report.patient_payload.length : 0

              return (
                <Card key={report.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base font-semibold line-clamp-2">
                          {report.report_title}
                        </CardTitle>
                        <p className="mt-1 text-xs text-gray-500">
                          {format(new Date(report.report_date), "MMM dd, yyyy")}
                        </p>
                      </div>
                      <Badge className={statusConfig.className}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {report.incident_type && (
                        <div>
                          <span className="font-medium text-gray-700">Type:</span>{" "}
                          <span className="text-gray-600">{report.incident_type}</span>
                        </div>
                      )}
                      {report.incident_location && (
                        <div>
                          <span className="font-medium text-gray-700">Location:</span>{" "}
                          <span className="text-gray-600">{report.incident_location}</span>
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-gray-700">Patients:</span>{" "}
                        <span className="text-gray-600">{patientCount}</span>
                      </div>
                      <div className="pt-2">
                        <p className="text-xs text-gray-500">
                          Created {format(new Date(report.created_at), "MMM dd, yyyy h:mm a")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
