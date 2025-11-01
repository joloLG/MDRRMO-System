import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

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
      console.error("[er-team list] mapping error", mappingError)
      return NextResponse.json({ error: "Unable to verify ER team assignment" }, { status: 500 })
    }

    if (!mapping) {
      return NextResponse.json({ error: "No ER team assignment" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("er_team_reports")
      .select("id, status, patient_payload, incident_payload, injury_payload, notes, created_at, updated_at, synced_at")
      .eq("submitted_by", userId)
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("[er-team list] fetch error", error)
      return NextResponse.json({ error: "Failed to load ER team reports" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, reports: data ?? [] })
  } catch (error: any) {
    console.error("[er-team list] unexpected", error)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
