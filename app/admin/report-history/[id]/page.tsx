"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { InternalReportDetail, type InternalReportRecord } from "@/components/admin/internal-report-detail"

interface BaseEntry {
  id: number
  name: string
}

const fetchSingleEntry = async (table: string, id: number) => {
  const { data, error } = await supabase
    .from(table)
    .select("id, name")
    .eq("id", id)
    .single()

  if (error) throw error
  return data as BaseEntry
}

const fetchInternalReportById = async (id: number) => {
  const { data, error } = await supabase
    .from("internal_reports")
    .select("*")
    .eq("id", id)
    .single()

  if (error) throw error
  return data as InternalReportRecord
}

const InternalReportDetailPage = () => {
  const params = useParams()
  const router = useRouter()
  const reportId = Number(params?.id)

  const [report, setReport] = React.useState<InternalReportRecord | null>(null)
  const [barangayName, setBarangayName] = React.useState<string>("")
  const [incidentTypeName, setIncidentTypeName] = React.useState<string>("")
  const [erTeamName, setErTeamName] = React.useState<string>("")
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const loadReport = async () => {
      if (!reportId || Number.isNaN(reportId)) {
        setError("Invalid report ID")
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const fetchedReport = await fetchInternalReportById(reportId)
        setReport(fetchedReport)

        const [barangay, incidentType, erTeam] = await Promise.all([
          fetchSingleEntry("barangays", fetchedReport.barangay_id),
          fetchSingleEntry("incident_types", fetchedReport.incident_type_id),
          fetchSingleEntry("er_teams", fetchedReport.er_team_id),
        ])

        setBarangayName(barangay?.name ?? "")
        setIncidentTypeName(incidentType?.name ?? "")
        setErTeamName(erTeam?.name ?? "")
      } catch (err: any) {
        console.error("Failed to load report detail:", err)
        setError(err?.message ?? "Failed to load report detail")
      } finally {
        setLoading(false)
      }
    }

    void loadReport()
  }, [reportId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center text-gray-600">
        Loading report detail...
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center justify-center text-red-600 space-y-4">
        <p>{error}</p>
        <button
          className="rounded bg-orange-500 px-4 py-2 text-white hover:bg-orange-600"
          onClick={() => router.back()}
        >
          Back to Report History
        </button>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center justify-center text-gray-600 space-y-4">
        <p>Report not found.</p>
        <button
          className="rounded bg-orange-500 px-4 py-2 text-white hover:bg-orange-600"
          onClick={() => router.back()}
        >
          Back to Report History
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <button
          className="mb-6 rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          onClick={() => router.back()}
        >
          Back to Report History
        </button>
        <InternalReportDetail
          report={report}
          barangayName={barangayName}
          incidentTypeName={incidentTypeName}
          erTeamName={erTeamName}
        />
      </div>
    </div>
  )
}

export default InternalReportDetailPage
