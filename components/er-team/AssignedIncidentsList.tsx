"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Clock, Phone, User, FileText, Navigation, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const ITEMS_PER_PAGE = 15

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

interface AssignedIncidentsListProps {
  incidents: AssignedIncident[]
  selectedIncidentId: string | null
  onSelectIncident: (id: string) => void
  onOpenDraft: (incidentId: string) => void
  onMarkResolved: (incidentId: string) => void
  formatDateTime: (value?: string | null) => string | null
  isLoading?: boolean
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'resolved':
    case 'completed':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'responded':
    case 'in_progress':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'pending':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

const getReportStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'pending_review':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'in_review':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'rejected':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'draft':
      return 'bg-gray-100 text-gray-700 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

export function AssignedIncidentsList({
  incidents,
  selectedIncidentId,
  onSelectIncident,
  onOpenDraft,
  onMarkResolved,
  formatDateTime,
  isLoading = false,
}: AssignedIncidentsListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Calculate pagination
  const totalPages = Math.ceil(incidents.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedIncidents = incidents.slice(startIndex, endIndex)

  // Reset to page 1 when incidents change (realtime update)
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1)
    }
  }

  // Only show loading skeleton on initial load (when no data exists)
  // If data exists, keep showing it during background updates
  if (isLoading && incidents.length === 0) {
    return (
      <Card className="border-0 bg-gradient-to-br from-white via-white to-orange-50/20 shadow-xl rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-orange-600" />
            Assigned Incidents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-gray-100 h-32 rounded-xl"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!isLoading && incidents.length === 0) {
    return (
      <Card className="border-0 bg-gradient-to-br from-white via-white to-orange-50/20 shadow-xl rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-orange-600" />
            Assigned Incidents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mx-auto flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Assigned Incidents</h3>
            <p className="text-sm text-gray-500">You currently have no incidents assigned to your team.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 bg-gradient-to-br from-white via-white to-orange-50/20 shadow-xl rounded-2xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-orange-600" />
            Assigned Incidents
            <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-700 border-orange-200">
              {incidents.length}
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {paginatedIncidents.map((incident) => {
            const isSelected = selectedIncidentId === incident.id
            const isExpanded = expandedId === incident.id
            const isResolved = incident.resolved_at || incident.status?.toLowerCase() === 'resolved' || incident.status?.toLowerCase() === 'completed'
            const hasReport = !!incident.er_team_report
            const reportStatus = incident.er_team_report?.status

            return (
              <div
                key={incident.id}
                className={cn(
                  "group relative overflow-hidden rounded-xl border-2 transition-all duration-200 cursor-pointer",
                  isSelected
                    ? "border-orange-400 bg-gradient-to-br from-orange-50 to-white shadow-lg ring-2 ring-orange-200"
                    : "border-gray-200 bg-white hover:border-orange-200 hover:shadow-md"
                )}
                onClick={() => onSelectIncident(incident.id)}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3 w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
                )}
                
                {/* Top gradient accent */}
                <div className={cn(
                  "absolute top-0 left-0 right-0 h-1",
                  isResolved ? "bg-gradient-to-r from-green-400 to-emerald-500" : "bg-gradient-to-r from-orange-400 to-red-500"
                )}></div>

                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center shadow-sm",
                          isResolved ? "bg-gradient-to-br from-green-500 to-emerald-500" : "bg-gradient-to-br from-orange-500 to-red-500"
                        )}>
                          {isResolved ? (
                            <CheckCircle2 className="w-5 h-5 text-white" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 truncate">
                            {incident.emergency_type || "Emergency Incident"}
                          </h3>
                          <p className="text-xs text-gray-500 font-mono">
                            ID: {incident.id.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <Badge className={cn("text-xs font-medium border", getStatusColor(incident.status || 'pending'))}>
                      {incident.status || 'Pending'}
                    </Badge>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-700">
                      <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">
                        {`${incident.firstName || ''} ${incident.lastName || ''}`.trim() || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{incident.mobileNumber || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700 sm:col-span-2">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{incident.location_address || 'No location'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 text-xs">
                      <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span>Reported: {formatDateTime(incident.created_at) || 'N/A'}</span>
                    </div>
                    {incident.responded_at && (
                      <div className="flex items-center gap-2 text-gray-600 text-xs">
                        <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <span>Responded: {formatDateTime(incident.responded_at) || 'N/A'}</span>
                      </div>
                    )}
                  </div>

                  {/* Report Status Indicator */}
                  {hasReport && reportStatus === 'approved' ? (
                    <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="text-sm text-emerald-700 font-medium">
                        Report approved by admin for this incident.
                      </span>
                    </div>
                  ) : hasReport && reportStatus && (
                    <div className="mb-3">
                      <Badge className={cn("text-xs font-medium border", getReportStatusColor(reportStatus))}>
                        <FileText className="w-3 h-3 mr-1" />
                        Report: {reportStatus.replace('_', ' ')}
                      </Badge>
                    </div>
                  )}

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-2 text-sm">
                      {incident.resolved_at && (
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="font-medium">Resolved: {formatDateTime(incident.resolved_at)}</span>
                        </div>
                      )}
                      {hasReport && incident.er_team_report?.notes && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs font-semibold text-gray-700 mb-1">Notes:</p>
                          <p className="text-xs text-gray-600">{incident.er_team_report.notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs border-orange-300 text-orange-600 hover:bg-orange-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedId(isExpanded ? null : incident.id)
                      }}
                    >
                      <ChevronDown className={cn("w-3 h-3 mr-1 transition-transform", isExpanded && "rotate-180")} />
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenDraft(incident.id)
                      }}
                    >
                      <FileText className="w-3 h-3 mr-1" />
                      Report
                    </Button>
                    {!isResolved && (
                      <Button
                        size="sm"
                        className="flex-1 text-xs bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                        onClick={(e) => {
                          e.stopPropagation()
                          onMarkResolved(incident.id)
                        }}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-600">
                Showing <span className="font-semibold">{startIndex + 1}</span> to{" "}
                <span className="font-semibold">{Math.min(endIndex, incidents.length)}</span> of{" "}
                <span className="font-semibold">{incidents.length}</span> incidents
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className="text-orange-600 border-orange-300 hover:bg-orange-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-1 px-3 py-1 bg-orange-50 rounded-lg border border-orange-200">
                <span className="text-sm font-semibold text-orange-700">
                  Page {currentPage} of {totalPages}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="text-orange-600 border-orange-300 hover:bg-orange-50 disabled:opacity-50"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
