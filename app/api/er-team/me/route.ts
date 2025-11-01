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

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, user_type, firstName, lastName, email")
      .eq("id", userId)
      .maybeSingle()

    if (profileError) {
      console.error("[er-team me] profile error", profileError)
      return NextResponse.json({ error: "Failed to load user profile" }, { status: 500 })
    }

    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    if (!profile.user_type || profile.user_type.toLowerCase() !== "er_team") {
      return NextResponse.json({ error: "Account is not authorized for ER team access" }, { status: 403 })
    }

    const { data: mapping, error: mappingError } = await supabase
      .from("er_team_users")
      .select("er_team_id, er_team:er_teams(name)")
      .eq("user_id", userId)
      .maybeSingle()

    if (mappingError) {
      console.error("[er-team me] team mapping error", mappingError)
      return NextResponse.json({ error: "Unable to verify ER team assignment" }, { status: 500 })
    }

    if (!mapping) {
      return NextResponse.json({ error: "No ER team assignment found" }, { status: 403 })
    }

    const teamRecord = Array.isArray(mapping.er_team) ? mapping.er_team[0] : mapping.er_team

    return NextResponse.json({
      ok: true,
      user: {
        id: profile.id,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        email: profile.email ?? null,
      },
      team: {
        id: mapping.er_team_id,
        name: teamRecord?.name ?? null,
      },
    })
  } catch (error: any) {
    console.error("[er-team me] unexpected", error)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
