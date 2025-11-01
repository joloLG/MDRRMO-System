import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

interface RespondBody {
  incidentId?: string
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !sessionData?.session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = sessionData.session.user.id
    const body = (await request.json().catch(() => ({}))) as RespondBody
    const incidentId = typeof body?.incidentId === "string" ? body.incidentId.trim() : ""

    if (!incidentId) {
      return NextResponse.json({ error: "Missing incidentId" }, { status: 400 })
    }

    const { data: mapping, error: mappingError } = await supabase
      .from("er_team_users")
      .select("er_team_id")
      .eq("user_id", userId)
      .maybeSingle()

    if (mappingError) {
      console.error("[er-team respond] mapping error", mappingError)
      return NextResponse.json({ error: "Unable to verify ER team assignment" }, { status: 500 })
    }

    const rawTeamId = mapping?.er_team_id
    const teamId = typeof rawTeamId === "number" ? rawTeamId : Number(rawTeamId)

    if (!Number.isFinite(teamId)) {
      return NextResponse.json({ error: "No ER team assignment" }, { status: 403 })
    }

    const { data: incident, error: incidentError } = await supabase
      .from("emergency_reports")
      .select("id, er_team_id, responded_at, resolved_at, status")
      .eq("id", incidentId)
      .maybeSingle()

    if (incidentError) {
      console.error("[er-team respond] incident fetch error", incidentError)
      return NextResponse.json({ error: "Failed to load incident" }, { status: 500 })
    }

    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 })
    }

    const incidentTeamId = typeof incident.er_team_id === "number" ? incident.er_team_id : Number(incident.er_team_id)
    if (!Number.isFinite(incidentTeamId) || incidentTeamId !== teamId) {
      return NextResponse.json({ error: "Incident not assigned to your team" }, { status: 403 })
    }

    if (incident.resolved_at) {
      return NextResponse.json({ ok: true, resolvedAt: incident.resolved_at, status: incident.status })
    }

    const resolvedAt = new Date().toISOString()
    const nextStatus = "resolved"

    const { data: updateResult, error: updateError } = await supabase
      .from("emergency_reports")
      .update({ responded_at: incident.responded_at ?? resolvedAt, resolved_at: resolvedAt, status: nextStatus })
      .eq("id", incidentId)
      .eq("er_team_id", teamId)
      .select("responded_at, resolved_at, status")
      .maybeSingle()

    if (updateError) {
      console.error("[er-team respond] update error", updateError)
      return NextResponse.json({ error: "Failed to update incident" }, { status: 500 })
    }

    if (!updateResult) {
      return NextResponse.json({ error: "Incident update failed" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, respondedAt: updateResult.responded_at, resolvedAt: updateResult.resolved_at, status: updateResult.status })
  } catch (error) {
    console.error("[er-team respond] unexpected", error)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
