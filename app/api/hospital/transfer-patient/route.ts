import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error("[transfer-patient] getUser error", userError)
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const patientId = typeof body?.patientId === "string" ? body.patientId : null
    const targetHospitalId = typeof body?.targetHospitalId === "string" ? body.targetHospitalId : null
    const notes = typeof body?.notes === "string" ? body.notes : null

    if (!patientId || !targetHospitalId) {
      return NextResponse.json({ ok: false, error: "Missing patient or hospital" }, { status: 400 })
    }

    const { error: rpcError } = await supabase.rpc("transfer_patient_between_hospitals", {
      _patient_id: patientId,
      _target_hospital_id: targetHospitalId,
      _notes: notes,
    })

    if (rpcError) {
      console.error("[transfer-patient] rpc error", rpcError)
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("[transfer-patient] unexpected error", error)
    return NextResponse.json({ ok: false, error: error?.message ?? "Unexpected error" }, { status: 500 })
  }
}
