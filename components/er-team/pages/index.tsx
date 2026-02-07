"use client"

// Export all page components
export { HomePage } from "./home-page"
export { DraftsPage } from "./drafts-page"
export { ReportFormPage } from "./report-form-page"
export { ReportsPage } from "./reports-page"
export { AccommodatedPage } from "./accommodated-page"

// Export context and provider
export { 
  ErTeamProvider, 
  useErTeam,
  type AssignedIncident,
  type SyncedReport,
  type ReferenceOption,
  type ReportsStatusFilter,
  type ErTeamTab
} from "./er-team-context"
