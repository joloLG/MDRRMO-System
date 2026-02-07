"use client"

import React, { createContext, useContext, useState, useCallback } from "react"
import { type ErTeamDraft, type ErTeamDraftStatus } from "../er-team-report-form"
import { type LocationCoords } from "@/lib/capacitor-geolocation"

// ===== Types =====

export interface AssignedIncident {
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

export interface SyncedReport {
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

export interface ReferenceOption {
  id: string
  name: string
}

export type ReportsStatusFilter = "all" | ErTeamDraftStatus

export type ErTeamTab = "home" | "drafts" | "report-form" | "reports" | "accommodated"

// ===== Context =====

interface ErTeamContextType {
  // Data
  drafts: ErTeamDraft[]
  reports: SyncedReport[]
  assignedIncidents: AssignedIncident[]
  teamId: number | null
  teamName: string | null
  userLocation: LocationCoords | null
  locationPermission: 'granted' | 'denied' | 'prompt' | 'unknown' | string
  isOnline: boolean
  barangays: ReferenceOption[]
  incidentTypes: ReferenceOption[]
  
  // Loading states
  isLoading: boolean
  loadingReports: boolean
  assignedLoading: boolean
  
  // UI State
  activeTab: ErTeamTab
  activeDraftId: string | null
  isSheetOpen: boolean
  selectedIncidentId: string | null
  
  // Actions
  setActiveTab: (tab: ErTeamTab) => void
  setActiveDraftId: (id: string | null) => void
  setIsSheetOpen: (open: boolean) => void
  setSelectedIncidentId: (id: string | null) => void
  refreshReports: () => Promise<void>
  refreshAssignedIncidents: () => Promise<void>
  handleOpenDraft: (draftId: string) => void
  handleMarkResolved: (incidentId: string) => Promise<void>
  requestLocation: () => Promise<void>
  
  // Utilities
  formatDateTime: (value?: string | null) => string | null
  formatStatusLabel: (status: ErTeamDraftStatus) => string
}

const ErTeamContext = createContext<ErTeamContextType | null>(null)

export function useErTeam() {
  const context = useContext(ErTeamContext)
  if (!context) {
    throw new Error("useErTeam must be used within ErTeamProvider")
  }
  return context
}

interface ErTeamProviderProps {
  children: React.ReactNode
  value: ErTeamContextType
}

export function ErTeamProvider({ children, value }: ErTeamProviderProps) {
  return <ErTeamContext.Provider value={value}>{children}</ErTeamContext.Provider>
}
