import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { z } from "zod"

const DraftPayloadSchema = z.object({
  clientDraftId: z.string().uuid(),
  emergencyReportId: z.string().uuid(),
  patientPayload: z.any(),
  incidentPayload: z.any().optional(),
  injuryPayload: z.any().optional(),
  notes: z.string().optional(),
  status: z.enum(["draft", "pending_review"]).default("draft"),
  submittedAt: z.string().datetime().optional(),
  internalReportId: z.number().int().positive().optional(),
})

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData?.session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsed = DraftPayloadSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 })
    }

    const userId = sessionData.session.user.id

    const { data: mapping, error: mappingError } = await supabase
      .from("er_team_users")
      .select("er_team_id")
      .eq("user_id", userId)
      .maybeSingle()

    if (mappingError) {
      console.error("[er-team draft] mapping error", mappingError)
      return NextResponse.json({ error: "Unable to verify ER team assignment" }, { status: 500 })
    }

    if (!mapping) {
      return NextResponse.json({ error: "No ER team assignment" }, { status: 403 })
    }

    const { clientDraftId, status, submittedAt, patientPayload, incidentPayload, injuryPayload, notes, emergencyReportId, internalReportId } = parsed.data

    const { data: emergencyReport, error: emergencyReportError } = await supabase
      .from("emergency_reports")
      .select("id, er_team_id")
      .eq("id", emergencyReportId)
      .maybeSingle()

    if (emergencyReportError) {
      console.error("[er-team draft] emergency report lookup error", emergencyReportError)
      return NextResponse.json({ error: "Failed to verify emergency report" }, { status: 500 })
    }

    if (!emergencyReport) {
      return NextResponse.json({ error: "Emergency report not found" }, { status: 404 })
    }

    const normalizeTeamId = (value: unknown) => {
      if (typeof value === "number") return value
      if (typeof value === "string") {
        const parsed = Number(value)
        return Number.isNaN(parsed) ? value : parsed
      }
      return value
    }

    const incidentTeamId = normalizeTeamId(emergencyReport.er_team_id)
    const userTeamId = normalizeTeamId(mapping.er_team_id)

    if (incidentTeamId !== userTeamId) {
      return NextResponse.json(
        {
          error: "Incident is not assigned to your ER team",
          details: {
            incidentId: emergencyReportId,
            incidentTeamId,
            userTeamId,
          },
        },
        { status: 403 }
      )
    }

    const { data, error } = await supabase
      .from("er_team_reports")
      .upsert(
        {
          id: clientDraftId,
          er_team_id: mapping.er_team_id,
          submitted_by: userId,
          emergency_report_id: emergencyReportId,
          internal_report_id: internalReportId ?? null,
          status,
          patient_payload: patientPayload,
          incident_payload: incidentPayload ?? null,
          injury_payload: injuryPayload ?? null,
          notes: notes ?? null,
          synced_at: submittedAt ? new Date(submittedAt).toISOString() : null,
        },
        { onConflict: "id" }
      )
      .select()
      .single()

    if (error) {
      console.error("[er-team draft] upsert error", error)
      return NextResponse.json({ error: "Failed to save draft" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, report: data })
  } catch (error: any) {
    console.error("[er-team draft] unexpected", error)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
