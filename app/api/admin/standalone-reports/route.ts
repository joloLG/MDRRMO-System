import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { z } from "zod"

const ReviewPayloadSchema = z.object({
  reportId: z.string().uuid(),
  action: z.enum(["approve", "reject", "in_review"]),
  reviewNotes: z.string().optional(),
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

  const supabase = createRouteHandlerClient({ cookies })
  const { searchParams } = new URL(request.url)
  const reportId = searchParams.get("id")
  const status = searchParams.get("status")

  try {
    if (reportId) {
      const { data, error } = await supabase
        .from("standalone_er_reports")
        .select(`
          *,
          er_team:er_teams(id, name),
          submitter:users!standalone_er_reports_submitted_by_fkey(id, email, full_name)
        `)
        .eq("id", reportId)
        .single()

      if (error) {
        console.error("[admin standalone-reports GET] error:", error)
        return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 })
      }

      return NextResponse.json({ ok: true, report: data })
    }

    console.log("[admin standalone-reports GET] Fetching reports with status filter:", status)
    
    let query = supabase
      .from("standalone_er_reports")
      .select(`
        *,
        er_team:er_teams(id, name),
        submitter:users!standalone_er_reports_submitted_by_fkey(id, email, full_name)
      `)
      .order("created_at", { ascending: false })

    if (status) {
      const statuses = status.split(",").map(s => s.trim()).filter(Boolean)
      console.log("[admin standalone-reports GET] Filtering by statuses:", statuses)
      if (statuses.length > 0) {
        query = query.in("status", statuses)
      }
    }

    const { data, error } = await query

    if (error) {
      console.error("[admin standalone-reports GET] Database error:", error)
      return NextResponse.json({ error: "Failed to fetch reports", details: error.message }, { status: 500 })
    }

    console.log("[admin standalone-reports GET] Found reports:", data?.length || 0)
    if (data && data.length > 0) {
      console.log("[admin standalone-reports GET] First report:", data[0])
    }

    return NextResponse.json({ ok: true, reports: reportId ? data : (data || []) })
  } catch (error: any) {
    console.error("[admin standalone-reports GET] unexpected error:", error)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const adminCheck = await ensureAdminUser(request)
  if ("error" in adminCheck) return adminCheck.error
  const reviewerId = adminCheck.userId

  const supabase = createRouteHandlerClient({ cookies })

  try {
    const body = await request.json()
    const parsed = ReviewPayloadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { reportId, action, reviewNotes } = parsed.data

    const { data: existing, error: fetchError } = await supabase
      .from("standalone_er_reports")
      .select("id, status, er_team_id, report_title")
      .eq("id", reportId)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const nextStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "in_review"

    const { error: updateError } = await supabase
      .from("standalone_er_reports")
      .update({
        status: nextStatus,
        review_notes: reviewNotes,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", reportId)

    if (updateError) {
      console.error("[admin standalone-reports POST] update error:", updateError)
      return NextResponse.json({ error: "Failed to update report" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("[admin standalone-reports POST] unexpected error:", error)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
