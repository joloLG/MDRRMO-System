import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET(_request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error("[hospital-hospitals] getUser error", userError)
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const { data: mapping, error: mappingError } = await supabase
      .from("hospital_users")
      .select("hospital_id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (mappingError) {
      console.error("[hospital-hospitals] mapping error", mappingError)
      return NextResponse.json({ ok: false, error: "Unable to verify hospital assignment" }, { status: 500 })
    }

    if (!mapping) {
      return NextResponse.json({ ok: false, error: "No hospital assignment" }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin.from("hospitals").select("id, name").order("name", { ascending: true })

    if (error) {
      console.error("[hospital-hospitals] fetch error", error)
      return NextResponse.json({ ok: false, error: "Failed to load hospitals" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, hospitals: data ?? [] })
  } catch (error: any) {
    console.error("[hospital-hospitals] unexpected error", error)
    return NextResponse.json({ ok: false, error: error?.message ?? "Unexpected error" }, { status: 500 })
  }
}
