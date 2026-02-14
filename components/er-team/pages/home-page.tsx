"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Wifi, WifiOff, RefreshCw, Loader2, MapPin, Navigation, FileText, CheckCircle2, Flame, Car, Zap, Droplets, TreePine, Siren, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useErTeam } from "./er-team-context"
import { AssignedIncidentsList } from "../AssignedIncidentsList"
import dynamic from "next/dynamic"

const LocationMap = dynamic(() => import("@/components/LocationMap"), { ssr: false })

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

// Map emergency type to an appropriate icon
function getIncidentTypeIcon(type: string | null | undefined) {
  const t = (type || '').toLowerCase()
  if (t.includes('fire')) return <Flame className="w-5 h-5" />
  if (t.includes('vehicular') || t.includes('vehicle') || t.includes('car') || t.includes('accident')) return <Car className="w-5 h-5" />
  if (t.includes('flood') || t.includes('water')) return <Droplets className="w-5 h-5" />
  if (t.includes('earthquake') || t.includes('landslide') || t.includes('natural')) return <TreePine className="w-5 h-5" />
  if (t.includes('electric') || t.includes('lightning')) return <Zap className="w-5 h-5" />
  if (t.includes('medical') || t.includes('health')) return <Siren className="w-5 h-5" />
  return <AlertTriangle className="w-5 h-5" />
}

export function HomePage() {
  const {
    drafts,
    reports,
    assignedIncidents,
    teamName,
    isOnline,
    isLoading,
    loadingReports,
    assignedLoading,
    userLocation,
    locationPermission,
    selectedIncidentId,
    setSelectedIncidentId,
    handleOpenDraft,
    handleMarkResolved,
    requestLocation,
    refreshReports,
    refreshAssignedIncidents,
    formatDateTime,
    formatStatusLabel,
  } = useErTeam()

  // Get selected incident
  const selectedIncident = selectedIncidentId 
    ? assignedIncidents.find(incident => incident.id === selectedIncidentId) 
    : assignedIncidents[0]

  const selectedIncidentCoords = selectedIncident?.latitude && selectedIncident?.longitude
    ? { lat: selectedIncident.latitude, lng: selectedIncident.longitude }
    : null

  return (
    <div className="space-y-6">
      {/* Incident Location Map - Top Priority for Navigation */}
      {selectedIncidentCoords && (
        <Card className="border-0 bg-gradient-to-br from-white via-white to-blue-50/30 shadow-xl rounded-2xl">
          <CardHeader className="space-y-3 pb-4">
            {/* Incident Type as Title with Icon */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white shadow-lg animate-pulse">
                {getIncidentTypeIcon(selectedIncident?.emergency_type)}
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  {selectedIncident?.emergency_type || 'Emergency Incident'}
                  <Badge className={cn(
                    "text-xs font-medium border ml-1",
                    selectedIncident?.status?.toLowerCase() === 'resolved' || selectedIncident?.resolved_at
                      ? "bg-green-100 text-green-700 border-green-300"
                      : "bg-amber-100 text-amber-700 border-amber-300"
                  )}>
                    {selectedIncident?.status || 'Pending'}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-sm text-gray-600 flex items-center gap-1.5 mt-1">
                  <MapPin className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  {selectedIncident?.location_address || 'Location map'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100/50 shadow-sm">
              <LocationMap
                latitude={selectedIncidentCoords.lat}
                longitude={selectedIncidentCoords.lng}
                zoom={16}
                className="w-full h-72 rounded-lg shadow-sm"
              />
              
              {/* Action Buttons */}
              <div className="mt-4 space-y-2">
                {/* Navigation Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-white hover:bg-blue-50 border-blue-200 text-blue-700 font-semibold"
                  onClick={() => {
                    if (userLocation) {
                      const origin = `${userLocation.lat},${userLocation.lng}`
                      const dest = `${selectedIncidentCoords.lat},${selectedIncidentCoords.lng}`
                      const mapsUrl = `https://www.google.com/maps/dir/${origin}/${dest}/@${userLocation.lat},${userLocation.lng},15z`
                      window.open(mapsUrl, '_blank', 'noopener,noreferrer')
                    }
                  }}
                  disabled={!userLocation}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Get Directions
                </Button>

                {/* Action Buttons Row */}
                <div className="grid grid-cols-1 gap-2">
                  {/* Hide Report Form button if admin has approved the report */}
                  {!(selectedIncident?.er_team_report?.status === 'approved') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white hover:bg-blue-50 border-blue-300 text-blue-700 font-semibold"
                      onClick={() => {
                        if (selectedIncident?.id) {
                          const draft = drafts.find(d => d.emergencyReportId === selectedIncident.id)
                          if (draft) handleOpenDraft(draft.clientDraftId)
                        }
                      }}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Report Form
                    </Button>
                  )}
                </div>

                {/* Resolve Button (if not resolved) */}
                {selectedIncident && !selectedIncident.resolved_at && selectedIncident.status?.toLowerCase() !== 'resolved' && (
                  <Button
                    size="sm"
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold shadow-md"
                    onClick={() => selectedIncident?.id && handleMarkResolved(selectedIncident.id)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark as Resolved
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assigned Incidents List */}
      <AssignedIncidentsList
        incidents={assignedIncidents}
        selectedIncidentId={selectedIncidentId}
        onSelectIncident={setSelectedIncidentId}
        onOpenDraft={(incidentId) => {
          const draft = drafts.find(d => d.emergencyReportId === incidentId)
          if (draft) handleOpenDraft(draft.clientDraftId)
        }}
        onMarkResolved={handleMarkResolved}
        formatDateTime={formatDateTime}
        isLoading={assignedLoading}
      />

      {/* Quick Actions */}
      <Card className="border-0 bg-gradient-to-br from-white via-white to-green-50/30 shadow-xl rounded-2xl">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white shadow-lg">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-gray-900">Location Services</CardTitle>
              <CardDescription className="text-sm text-gray-600">
                Your location is automatically tracked for routing
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-white to-gray-50 p-4 rounded-xl border border-gray-100/50 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-700 font-medium">Permission Status:</span>
                <span className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                  locationPermission === 'granted' ? 'bg-green-100 text-green-700 border border-green-200' :
                  locationPermission === 'denied' ? 'bg-red-100 text-red-700 border border-red-200' :
                  'bg-gray-100 text-gray-700 border border-gray-200'
                )}>
                  {locationPermission === 'granted' ? 'Granted' :
                   locationPermission === 'denied' ? 'Denied' : 'Unknown'}
                </span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-white to-gray-50 p-4 rounded-xl border border-gray-100/50 shadow-sm">
              {userLocation ? (
                <div className="text-xs text-gray-600">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-700">Lat:</span>
                    <span className="font-mono">{userLocation.lat.toFixed(6)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">Lng:</span>
                    <span className="font-mono">{userLocation.lng.toFixed(6)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">Location not available</p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={requestLocation}>
                    Get Location
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
