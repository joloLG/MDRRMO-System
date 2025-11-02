import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

interface EmergencyReportWithDraft {
  id: string
  status: string
  emergency_type: string | null
  location_address: string | null
  latitude: number | null
  longitude: number | null
  firstName: string | null
  lastName: string | null
  created_at: string
  responded_at: string | null
  resolved_at: string | null
  er_team_report?: {
    id: string
    status: string
    updated_at: string
    synced_at: string | null
    notes: string | null
    internal_report_id?: number | null
  } | null
}

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData?.session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = sessionData.session.user.id

    const { data: mapping, error: mappingError } = await supabase
      .from("er_team_users")
      .select("er_team_id")
      .eq("user_id", userId)
      .maybeSingle()

    if (mappingError) {
      console.error("[er-team assigned] mapping error", mappingError)
      return NextResponse.json({ error: "Unable to verify ER team assignment" }, { status: 500 })
    }

    if (!mapping) {
      return NextResponse.json({ error: "No ER team assignment" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("emergency_reports")
      .select(
        `id, status, emergency_type, location_address, latitude, longitude, firstName, lastName, created_at, responded_at, resolved_at,
         er_team_report:er_team_reports!er_team_reports_emergency_report_id_fkey (
           id, status, updated_at, synced_at, notes, patient_payload, incident_payload, injury_payload, internal_report_id
         )`
      )
      .eq("er_team_id", mapping.er_team_id)
      .order("responded_at", { ascending: false })
      .order("created_at", { ascending: false })

    console.log("[er-team assigned] Query params:", { userId, er_team_id: mapping.er_team_id })
    console.log("[er-team assigned] Raw data from DB:", data)
    console.log("[er-team assigned] Query error:", error)

    if (error) {
      console.error("[er-team assigned] fetch error", error)
      return NextResponse.json({ error: "Failed to load assigned incidents" }, { status: 500 })
    }

    const emergencyIds = (data ?? []).map((row) => row.id)

    let adminCompletedIds = new Set<string>()
    if (emergencyIds.length > 0) {
      const { data: internalReports, error: internalReportsError } = await supabase
        .from("internal_reports")
        .select("original_report_id")
        .in("original_report_id", emergencyIds)

      if (internalReportsError) {
        console.error("[er-team assigned] internal reports lookup failed", internalReportsError)
      } else {
        adminCompletedIds = new Set(
          (internalReports ?? [])
            .map((entry) => entry.original_report_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        )
      }
    }

    console.log("[er-team assigned] Incidents before filtering:", (data ?? []).length)
    console.log("[er-team assigned] Admin completed IDs:", Array.from(adminCompletedIds))

    const incidents: EmergencyReportWithDraft[] = (data ?? [])
      .map((row) => {
        const report = Array.isArray(row.er_team_report) ? row.er_team_report[0] ?? null : (row.er_team_report as EmergencyReportWithDraft["er_team_report"] | null)
        return {
          id: row.id,
          status: row.status,
          emergency_type: row.emergency_type,
          location_address: row.location_address,
          latitude: typeof (row as any).latitude === "number" ? (row as any).latitude : null,
          longitude: typeof (row as any).longitude === "number" ? (row as any).longitude : null,
          firstName: row.firstName,
          lastName: row.lastName,
          created_at: row.created_at,
          responded_at: row.responded_at,
          resolved_at: row.resolved_at,
          er_team_report: report,
        }
      })

    console.log("[er-team assigned] Final incidents returned:", incidents.length, incidents)

    return NextResponse.json({ ok: true, incidents })
  } catch (error: any) {
    console.error("[er-team assigned] unexpected", error)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
