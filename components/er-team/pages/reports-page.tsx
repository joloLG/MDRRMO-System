"use client"

import * as React from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Plus, FileText, Clock, CheckCircle, XCircle, Eye } from "lucide-react"
import { format } from "date-fns"
import { useErTeam } from "./er-team-context"
import { ErTeamReportForm, type ErTeamDraft, DEFAULT_PATIENT_TEMPLATE } from "../er-team-report-form"
import type { ErTeamPatientPayload } from "../er-team-report-form"
import { useErTeamReferences } from "@/lib/hooks/useErTeamReferences"

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

export function ReportsPage() {
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
    // Create a new standalone draft
    const newDraft: ErTeamDraft = {
      clientDraftId: crypto.randomUUID(),
      emergencyReportId: "standalone", // Mark as standalone
      status: "draft",
      updatedAt: new Date().toISOString(),
      synced: false,
      patientsPayload: [{ ...DEFAULT_PATIENT_TEMPLATE }],
      injuryPayload: { front: {}, back: {} },
      notes: "",
    }
    setActiveDraft(newDraft)
    setShowForm(true)
  }

  const handleDraftChange = (next: ErTeamDraft) => {
    setActiveDraft(next)
  }

  const handleSubmitForReview = async (draft: ErTeamDraft) => {
    setIsSubmitting(true)
    try {
      const currentDate = format(new Date(), "yyyy-MM-dd")
      
      const payload = {
        reportTitle: `PCR Report - ${currentDate}`,
        reportDate: new Date().toISOString(),
        incidentType: draft.patientsPayload[0]?.typeOfEmergencySelections?.join(", ") || undefined,
        incidentLocation: draft.patientsPayload[0]?.incidentLocation || undefined,
        incidentDescription: draft.notes || undefined,
        patientPayload: draft.patientsPayload,
        injuryPayload: draft.injuryPayload,
        notes: draft.notes,
        status: "pending_review",
      }

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

      await loadReports()
      setShowForm(false)
      setActiveDraft(null)
    } catch (error: any) {
      console.error("Failed to submit report:", error)
      alert(error.message || "Failed to submit report")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setShowForm(false)
    setActiveDraft(null)
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-600 border-r-transparent"></div>
          <p className="text-sm text-gray-600">Loading reports...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">My Reports</h2>
            <p className="mt-1 text-sm text-gray-600">Standalone PCR reports submitted by your team</p>
          </div>
          <Button onClick={handleCreateNew} className="bg-orange-600 hover:bg-orange-700">
            <Plus className="mr-2 h-4 w-4" />
            New Report
          </Button>
        </div>

      {reports.length === 0 ? (
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
        <div className="grid gap-4 sm:grid-cols-2">
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

      {/* Form Modal for Creating New Report */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-full">
          {activeDraft && (
            <ErTeamReportForm
              draft={activeDraft}
              hospitals={hospitals}
              barangays={barangays}
              incidentInfo={{
                reporterName: "Standalone Report",
                incidentType: "PCR Report",
                locationAddress: "N/A",
              }}
              onDraftChange={handleDraftChange}
              onSubmitForReview={handleSubmitForReview}
              onClose={handleClose}
              isSubmitting={isSubmitting}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
