"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Clock, User, FileText, CheckCircle2, ChevronLeft, ChevronRight, Flame, Car, Zap, Droplets, TreePine, Siren, AlertTriangle } from "lucide-react"
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

// Map emergency type to an appropriate icon
function getIncidentTypeIcon(type: string | null | undefined, size = "w-4 h-4") {
  const t = (type || '').toLowerCase()
  if (t.includes('fire')) return <Flame className={size} />
  if (t.includes('vehicular') || t.includes('vehicle') || t.includes('car') || t.includes('accident')) return <Car className={size} />
  if (t.includes('flood') || t.includes('water')) return <Droplets className={size} />
  if (t.includes('earthquake') || t.includes('landslide') || t.includes('natural')) return <TreePine className={size} />
  if (t.includes('electric') || t.includes('lightning')) return <Zap className={size} />
  if (t.includes('medical') || t.includes('health')) return <Siren className={size} />
  return <AlertTriangle className={size} />
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
      <CardHeader className="pb-2 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-orange-600" />
            Assigned Incidents
            <Badge variant="secondary" className="ml-1 bg-orange-100 text-orange-700 border-orange-200 text-[10px] px-1.5 py-0">
              {incidents.length}
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-2">
          {paginatedIncidents.map((incident) => {
            const isSelected = selectedIncidentId === incident.id
            const isResolved = incident.resolved_at || incident.status?.toLowerCase() === 'resolved' || incident.status?.toLowerCase() === 'completed'
            const hasReport = !!incident.er_team_report
            const reportStatus = incident.er_team_report?.status
            const reportApproved = reportStatus === 'approved'

            return (
              <div
                key={incident.id}
                className={cn(
                  "relative overflow-hidden rounded-lg border transition-all duration-150 cursor-pointer",
                  isSelected
                    ? "border-orange-400 bg-orange-50/60 shadow-md ring-1 ring-orange-200"
                    : "border-gray-200 bg-white hover:border-orange-200 hover:shadow-sm"
                )}
                onClick={() => onSelectIncident(incident.id)}
              >
                {/* Left accent bar */}
                <div className={cn(
                  "absolute top-0 left-0 bottom-0 w-1 rounded-l-lg",
                  isResolved ? "bg-green-500" : "bg-orange-500"
                )} />

                <div className="pl-3 pr-3 py-2.5">
                  {/* Row 1: Type icon + name + status badge */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className={cn(
                        "flex-shrink-0",
                        isResolved ? "text-green-600" : "text-orange-600"
                      )}>
                        {getIncidentTypeIcon(incident.emergency_type)}
                      </span>
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {incident.emergency_type || "Emergency"}
                      </h3>
                      {reportApproved && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      )}
                    </div>
                    <Badge className={cn("text-[10px] px-1.5 py-0 font-medium border", getStatusColor(incident.status || 'pending'))}>
                      {incident.status || 'Pending'}
                    </Badge>
                  </div>

                  {/* Row 2: Location */}
                  <div className="flex items-center gap-1.5 mb-1 text-xs text-gray-600">
                    <MapPin className="w-3 h-3 text-orange-500 flex-shrink-0" />
                    <span className="truncate">{incident.location_address || 'No location'}</span>
                  </div>

                  {/* Row 3: Reporter + time */}
                  <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
                    <div className="flex items-center gap-1 min-w-0">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">
                        {`${incident.firstName || ''} ${incident.lastName || ''}`.trim() || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>{formatDateTime(incident.created_at) || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Row 4: Report status (compact) */}
                  {hasReport && reportStatus && !reportApproved && (
                    <div className="mt-1">
                      <Badge className={cn("text-[10px] px-1.5 py-0 font-medium border", getReportStatusColor(reportStatus))}>
                        <FileText className="w-2.5 h-2.5 mr-0.5" />
                        {reportStatus.replace('_', ' ')}
                      </Badge>
                    </div>
                  )}

                  {/* Action Buttons - compact row */}
                  <div className="flex gap-1.5 mt-2">
                    {!reportApproved && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-[11px] border-blue-200 text-blue-600 hover:bg-blue-50 px-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenDraft(incident.id)
                        }}
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Report
                      </Button>
                    )}
                    {!isResolved && (
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-[11px] bg-green-500 hover:bg-green-600 text-white px-2"
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
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500">
              {startIndex + 1}-{Math.min(endIndex, incidents.length)} of {incidents.length}
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className="h-7 px-2 text-xs text-orange-600 border-orange-200 hover:bg-orange-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs font-medium text-gray-600 px-1">
                {currentPage}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="h-7 px-2 text-xs text-orange-600 border-orange-200 hover:bg-orange-50 disabled:opacity-50"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
