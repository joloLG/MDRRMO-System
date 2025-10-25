import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error("[hospital-internal-report] getUser error", userError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const reportId = Number(params.id)
    if (!reportId || Number.isNaN(reportId)) {
      return NextResponse.json({ error: "Invalid report id" }, { status: 400 })
    }

    const { data: mapping, error: mappingError } = await supabase
      .from("hospital_users")
      .select("hospital_id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (mappingError) {
      console.error("[hospital-internal-report] mapping error", mappingError)
      return NextResponse.json({ error: "Unable to verify hospital assignment" }, { status: 500 })
    }

    if (!mapping) {
      return NextResponse.json({ error: "No hospital assignment" }, { status: 403 })
    }

    const hospitalId = mapping.hospital_id

    const { data: report, error: reportError } = await supabaseAdmin
      .from("internal_reports")
      .select(
        "id, original_report_id, incident_type_id, incident_date, time_responded, barangay_id, er_team_id, persons_involved, number_of_responders, prepared_by, created_at, incident_location, moi_poi_toi",
      )
      .eq("id", reportId)
      .maybeSingle()

    if (reportError) {
      console.error("[hospital-internal-report] report fetch error", reportError)
      return NextResponse.json({ error: "Failed to load report" }, { status: 500 })
    }

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const { data: patientRows, error: patientsError } = await supabaseAdmin
      .from("internal_report_patients")
      .select("*")
      .eq("internal_report_id", reportId)
      .eq("receiving_hospital_id", hospitalId)
      .order("created_at", { ascending: true })

    if (patientsError) {
      console.error("[hospital-internal-report] patients fetch error", patientsError)
      return NextResponse.json({ error: "Failed to load patients" }, { status: 500 })
    }

    if (!patientRows || patientRows.length === 0) {
      return NextResponse.json({ error: "Report not available for this hospital" }, { status: 404 })
    }

    const [barangayRes, incidentTypeRes, erTeamRes] = await Promise.all([
      supabaseAdmin.from("barangays").select("name").eq("id", report.barangay_id).maybeSingle(),
      supabaseAdmin.from("incident_types").select("name").eq("id", report.incident_type_id).maybeSingle(),
      supabaseAdmin.from("er_teams").select("name").eq("id", report.er_team_id).maybeSingle(),
    ])

    if (barangayRes.error) {
      console.error("[hospital-internal-report] barangay fetch error", barangayRes.error)
      return NextResponse.json({ error: "Failed to load barangay" }, { status: 500 })
    }

    if (incidentTypeRes.error) {
      console.error("[hospital-internal-report] incident type fetch error", incidentTypeRes.error)
      return NextResponse.json({ error: "Failed to load incident type" }, { status: 500 })
    }

    if (erTeamRes.error) {
      console.error("[hospital-internal-report] er team fetch error", erTeamRes.error)
      return NextResponse.json({ error: "Failed to load ER team" }, { status: 500 })
    }

    return NextResponse.json({
      report,
      patients: patientRows,
      barangay: barangayRes.data?.name ?? "",
      incidentType: incidentTypeRes.data?.name ?? "",
      erTeam: erTeamRes.data?.name ?? "",
    })
  } catch (error: any) {
    console.error("[hospital-internal-report] unexpected error", error)
    return NextResponse.json({ error: error?.message ?? "Unexpected error" }, { status: 500 })
  }
}
