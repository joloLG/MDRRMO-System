import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Verify ER team authentication
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData?.session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = sessionData.session.user.id

    // Verify user is ER team member
    const { data: profile } = await supabase
      .from("users")
      .select("id, user_type")
      .eq("id", userId)
      .maybeSingle()

    if (!profile || profile.user_type !== "er_team") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch all reference data in parallel
    const [barangaysResult, incidentTypesResult, hospitalsResult] = await Promise.all([
      supabase
        .from("barangays")
        .select("id, name")
        .order("name", { ascending: true }),
      supabase
        .from("incident_types")
        .select("id, name")
        .order("name", { ascending: true }),
      supabase
        .from("hospitals")
        .select("id, name")
        .order("name", { ascending: true })
    ])

    if (barangaysResult.error) {
      console.error("Error fetching barangays:", barangaysResult.error)
      throw barangaysResult.error
    }
    
    if (incidentTypesResult.error) {
      console.error("Error fetching incident types:", incidentTypesResult.error)
      throw incidentTypesResult.error
    }
    
    if (hospitalsResult.error) {
      console.error("Error fetching hospitals:", hospitalsResult.error)
      throw hospitalsResult.error
    }

    return NextResponse.json({
      ok: true,
      references: {
        barangays: barangaysResult.data ?? [],
        incidentTypes: incidentTypesResult.data ?? [],
        hospitals: hospitalsResult.data ?? []
      }
    })
  } catch (error: any) {
    console.error("Failed to fetch ER team references:", error)
    return NextResponse.json(
      { error: error?.message ?? "Failed to fetch reference data" },
      { status: 500 }
    )
  }
}
