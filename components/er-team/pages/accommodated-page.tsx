"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { useErTeam } from "./er-team-context"

export function AccommodatedPage() {
  const { reports, drafts, assignedIncidents, formatDateTime } = useErTeam()

  // Calculate summary stats
  const totalAssigned = assignedIncidents.length
  const pendingDrafts = drafts.filter(d => d.status === 'draft').length
  const totalReports = reports.length
  const completedCount = reports.filter(r => r.status === 'approved').length

  const summaryCards = [
    { label: "Assigned", value: totalAssigned, detail: "Active incidents assigned", icon: "📋", bg: "from-blue-500 to-blue-600" },
    { label: "Drafts", value: pendingDrafts, detail: "Pending completion", icon: "⏳", bg: "from-amber-500 to-amber-600" },
    { label: "Reports", value: totalReports, detail: "Total submissions", icon: "📊", bg: "from-emerald-500 to-emerald-600" },
    { label: "Completed", value: completedCount, detail: "Approved/Completed", icon: "✅", bg: "from-green-500 to-green-600" },
  ]

  // Filter reports for display
  const completedReports = reports.filter(r => r.status === 'approved')
  const inProgressReports = reports.filter(r => 
    r.status === 'pending_review' || r.status === 'in_review'
  )

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summaryCards.map((card, index) => (
          <div
            key={card.label}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-white via-white to-gray-50/80 p-2 sm:p-4 lg:p-5 shadow-lg hover:shadow-xl transition-all border border-white/50 hover:-translate-y-1"
          >
            <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${card.bg} rounded-bl-3xl opacity-10 group-hover:opacity-20 transition-opacity`}></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.bg} flex items-center justify-center text-white text-lg shadow-md`}>
                  {card.icon}
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
        ))}
      </div>

      {/* Completed Rescues */}
      <Card className="border-0 bg-gradient-to-br from-white via-white to-green-50/30 shadow-xl rounded-2xl">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white shadow-lg">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-gray-900">Rescue Done / Accommodated</CardTitle>
              <CardDescription className="text-sm text-gray-600">
                Completed incidents and rescue operations
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {completedReports.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">No completed rescue operations yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Completed reports will appear here once approved.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {completedReports.map((report) => {
                const patientInfo = report.patient_payload as { 
                  patientInformation?: { firstName?: string; lastName?: string }
                } | undefined
                const patientName = patientInfo?.patientInformation
                  ? `${patientInfo.patientInformation.firstName || ''} ${patientInfo.patientInformation.lastName || ''}`.trim()
                  : 'Patient'

                return (
                  <div
                    key={report.id}
                    className="rounded-xl border border-green-100 bg-white/95 p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{patientName}</span>
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            Completed
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Completed: {formatDateTime(report.updated_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Report ID: {report.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* In Review Section */}
      {inProgressReports.length > 0 && (
        <Card className="border-0 bg-gradient-to-br from-white via-white to-amber-50/30 shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">In Review</CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Reports awaiting admin approval
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {inProgressReports.map((report) => {
              const patientInfo = report.patient_payload as { 
                patientInformation?: { firstName?: string; lastName?: string }
              } | undefined
              const patientName = patientInfo?.patientInformation
                ? `${patientInfo.patientInformation.firstName || ''} ${patientInfo.patientInformation.lastName || ''}`.trim()
                : 'Patient'

              return (
                <div
                  key={report.id}
                  className="rounded-xl border border-amber-100 bg-white/95 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-gray-900">{patientName}</span>
                      <p className="text-xs text-gray-500 mt-1">
                        Submitted: {formatDateTime(report.created_at)}
                      </p>
                    </div>
                    <Badge className={cn(
                      "capitalize",
                      report.status === 'pending_review' 
                        ? "bg-amber-100 text-amber-700 border-amber-200"
                        : "bg-blue-100 text-blue-700 border-blue-200"
                    )}>
                      {report.status === 'pending_review' ? 'Pending Review' : 'In Review'}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
