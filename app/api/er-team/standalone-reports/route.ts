import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { z } from "zod"

const StandaloneReportPayloadSchema = z.object({
  reportTitle: z.string().min(1, "Report title is required"),
  reportDate: z.string(),
  incidentPayload: z.any().optional(), // Full incident details
  patientPayload: z.array(z.any()),
  injuryPayload: z.any().optional(),
  notes: z.string().optional(),
  status: z.enum(["draft", "pending_review"]).default("draft"),
})

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData?.session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = sessionData.session.user.id
    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get("id")

    // Get user's ER team
    const { data: mapping, error: mappingError } = await supabase
      .from("er_team_users")
      .select("er_team_id")
      .eq("user_id", userId)
      .maybeSingle()

    if (mappingError || !mapping) {
      return NextResponse.json({ error: "ER team assignment not found" }, { status: 403 })
    }

    if (reportId) {
      const { data, error } = await supabase
        .from("standalone_er_reports")
        .select("*")
        .eq("er_team_id", mapping.er_team_id)
        .eq("id", reportId)
        .single()

      if (error) {
        console.error("[standalone-reports GET] error:", error)
        return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 })
      }

      return NextResponse.json({ ok: true, report: data })
    }

    const { data, error } = await supabase
      .from("standalone_er_reports")
      .select("*")
      .eq("er_team_id", mapping.er_team_id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[standalone-reports GET] error:", error)
      return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, reports: reportId ? data : (data || []) })
  } catch (error: any) {
    console.error("[standalone-reports GET] unexpected error:", error)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData?.session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = sessionData.session.user.id

    // Verify ER team membership
    const { data: mapping, error: mappingError } = await supabase
      .from("er_team_users")
      .select("er_team_id")
      .eq("user_id", userId)
      .maybeSingle()

    if (mappingError || !mapping) {
      return NextResponse.json({ error: "ER team assignment not found" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = StandaloneReportPayloadSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { reportTitle, reportDate, incidentPayload, patientPayload, injuryPayload, notes, status } = parsed.data

    // Extract incident type and location for backward compatibility
    const incidentType = incidentPayload?.incidentType || patientPayload[0]?.typeOfEmergencySelections?.[0] || null
    const incidentLocation = incidentPayload?.incidentLocation || patientPayload[0]?.incidentLocation || null

    const { data, error } = await supabase
      .from("standalone_er_reports")
      .insert({
        er_team_id: mapping.er_team_id,
        submitted_by: userId,
        report_title: reportTitle,
        report_date: reportDate,
        incident_type: incidentType,
        incident_location: incidentLocation,
        incident_payload: incidentPayload || {},
        patient_payload: patientPayload,
        injury_payload: injuryPayload || {},
        notes: notes,
        status: status,
      })
      .select()
      .single()

    if (error) {
      console.error("[standalone-reports POST] insert error:", error)
      return NextResponse.json({ error: "Failed to create report" }, { status: 500 })
    }

    // Create admin notification if submitting for review
    if (status === "pending_review") {
      try {
        await supabase.from("admin_notifications").insert({
          type: "standalone_report",
          message: `New standalone PCR report submitted: ${reportTitle}`,
          metadata: { standalone_report_id: data.id },
          is_read: false,
        })
        console.log("[standalone-reports POST] Admin notification created")
      } catch (notifError) {
        console.error("[standalone-reports POST] Failed to create notification:", notifError)
      }
    }

    return NextResponse.json({ ok: true, report: data })
  } catch (error: any) {
    console.error("[standalone-reports POST] unexpected error:", error)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData?.session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = sessionData.session.user.id
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 })
    }

    // Verify report ownership
    const { data: existing, error: fetchError } = await supabase
      .from("standalone_er_reports")
      .select("id, submitted_by, status")
      .eq("id", id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    if (existing.submitted_by !== userId) {
      return NextResponse.json({ error: "Not authorized to update this report" }, { status: 403 })
    }

    if (!["draft", "rejected"].includes(existing.status)) {
      return NextResponse.json({ error: "Cannot update report in current status" }, { status: 400 })
    }

    // Extract incident type and location for backward compatibility
    const incidentType = updates.incidentPayload?.incidentType || updates.patientPayload?.[0]?.typeOfEmergencySelections?.[0] || null
    const incidentLocation = updates.incidentPayload?.incidentLocation || updates.patientPayload?.[0]?.incidentLocation || null

    const { data, error } = await supabase
      .from("standalone_er_reports")
      .update({
        report_title: updates.reportTitle,
        report_date: updates.reportDate,
        incident_type: incidentType,
        incident_location: incidentLocation,
        incident_payload: updates.incidentPayload || {},
        patient_payload: updates.patientPayload,
        injury_payload: updates.injuryPayload,
        notes: updates.notes,
        status: updates.status,
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[standalone-reports PUT] update error:", error)
      return NextResponse.json({ error: "Failed to update report" }, { status: 500 })
    }

    // Create notification if status changed to pending_review
    if (updates.status === "pending_review" && existing.status !== "pending_review") {
      try {
        await supabase.from("admin_notifications").insert({
          type: "standalone_report",
          message: `Standalone PCR report resubmitted: ${updates.reportTitle}`,
          metadata: { standalone_report_id: id },
          is_read: false,
        })
      } catch (notifError) {
        console.error("[standalone-reports PUT] Failed to create notification:", notifError)
      }
    }

    return NextResponse.json({ ok: true, report: data })
  } catch (error: any) {
    console.error("[standalone-reports PUT] unexpected error:", error)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
