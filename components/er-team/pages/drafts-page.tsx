"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, RefreshCw, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useErTeam } from "./er-team-context"

// Status badge styles
const STATUS_BADGE_STYLES: Record<string, string> = {
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

export function DraftsPage() {
  const {
    drafts,
    assignedIncidents,
    isOnline,
    isLoading,
    handleOpenDraft,
    formatDateTime,
    formatStatusLabel,
  } = useErTeam()

  // Create lookup for incident details
  const incidentLookup = React.useMemo(() => {
    const map = new Map()
    assignedIncidents.forEach(incident => {
      map.set(incident.id, incident)
    })
    return map
  }, [assignedIncidents])

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 bg-gradient-to-br from-white via-white to-purple-50/30 shadow-xl rounded-2xl">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-gray-900">My Drafts</CardTitle>
              <CardDescription className="text-sm text-gray-600">
                All your saved report drafts ({drafts.length} total)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading drafts…
            </div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">No drafts available yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Drafts are created when incidents are assigned to your team.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {drafts.map((draft) => {
                const incident = incidentLookup.get(draft.emergencyReportId)
                const patientInfo = draft.patientsPayload?.[0]
                const patientName = patientInfo
                  ? `${patientInfo.firstName ?? ""} ${patientInfo.lastName ?? ""}`.trim() || "Unnamed patient"
                  : "Unnamed patient"
                const reporterName = incident
                  ? `${incident.firstName ?? ""} ${incident.lastName ?? ""}`.trim()
                  : ""
                const incidentLabel = reporterName || `Incident ${draft.emergencyReportId?.slice(0, 8) || 'Unknown'}`
                const statusClass = STATUS_BADGE_STYLES[draft.status] || STATUS_BADGE_STYLES.draft
                const syncClass = draft.synced ? SYNC_BADGE_CLASSES.synced : SYNC_BADGE_CLASSES.pending

                return (
                  <div
                    key={draft.clientDraftId}
                    className="rounded-xl border border-orange-100 bg-white/95 p-4 shadow-sm hover:border-orange-200 hover:shadow-md transition"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{incidentLabel}</span>
                          {incident?.emergency_type && (
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-orange-500">
                              {incident.emergency_type}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600">
                          Patient: <span className="font-medium text-gray-700">{patientName}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          {draft.updatedAt && (
                            <span>Updated {formatDateTime(draft.updatedAt)}</span>
                          )}
                        </div>
                        {draft.lastSyncError && (
                          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                            {draft.lastSyncError}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-stretch gap-2 sm:items-end">
                        <Badge className={cn("w-fit px-3 py-1 text-xs font-medium capitalize", statusClass)}>
                          {formatStatusLabel(draft.status)}
                        </Badge>
                        <span className={cn(
                          "inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                          syncClass
                        )}>
                          {draft.synced ? "Synced" : "Pending sync"}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-orange-300 text-orange-600 hover:bg-orange-50"
                          onClick={() => handleOpenDraft(draft.clientDraftId)}
                        >
                          Open Draft
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
