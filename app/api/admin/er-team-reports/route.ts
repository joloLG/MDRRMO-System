import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { z } from "zod"

import { supabaseAdmin } from "@/lib/supabaseAdmin"

const ReviewPayloadSchema = z.object({
  reportId: z.string().uuid(),
  action: z.enum(["approve", "reject", "in_review"]),
  notes: z.string().optional(),
})

async function ensureAdminUser(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !sessionData?.session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const userId = sessionData.session.user.id
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, user_type")
    .eq("id", userId)
    .maybeSingle()

  if (profileError || !profile || !["admin", "superadmin"].includes(profile.user_type)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { userId }
}

export async function GET(request: NextRequest) {
  const adminCheck = await ensureAdminUser(request)
  if ("error" in adminCheck) return adminCheck.error

  const { searchParams } = new URL(request.url)
  const reportId = searchParams.get("reportId")
  const statusParam = searchParams.get("status")

  let query = supabaseAdmin
    .from("er_team_reports")
    .select(
      `id, status, er_team_id, submitted_by, patient_payload, incident_payload, injury_payload, notes, created_at, updated_at,
       emergency_report_id,
       emergency_report:emergency_reports (id, status, emergency_type, location_address, created_at, responded_at, resolved_at, er_team_id),
       internal_report_id,
       internal_report:internal_reports (id, incident_date, time_responded, barangay_id, er_team_id, prepared_by)`
    )
    .order("created_at", { ascending: false })

  if (reportId) {
    query = query.eq("id", reportId)
  }

  if (!reportId && statusParam) {
    const statuses = statusParam.split(",").map((value) => value.trim()).filter(Boolean)
    if (statuses.length > 0) {
      query = query.in("status", statuses)
    }
  }

  const { data, error } = await query

  if (error) {
    console.error("[admin er reports] fetch error", error)
    return NextResponse.json({ error: "Failed to load ER team reports" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, reports: data ?? [] })
}

export async function POST(request: NextRequest) {
  const adminCheck = await ensureAdminUser(request)
  if ("error" in adminCheck) return adminCheck.error
  const reviewerId = adminCheck.userId

  const parsed = ReviewPayloadSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 })
  }

  const { reportId, action, notes } = parsed.data

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("er_team_reports")
    .select("id, status, notes")
    .eq("id", reportId)
    .maybeSingle()

  if (fetchError) {
    console.error("[admin er reports] fetch single error", fetchError)
    return NextResponse.json({ error: "Failed to load report" }, { status: 500 })
  }

  if (!existing) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 })
  }

  const nextStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "in_review"

  const { error: updateError } = await supabaseAdmin
    .from("er_team_reports")
    .update({
      status: nextStatus,
      notes: notes ?? existing.notes,
    })
    .eq("id", reportId)

  if (updateError) {
    console.error("[admin er reports] update error", updateError)
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
