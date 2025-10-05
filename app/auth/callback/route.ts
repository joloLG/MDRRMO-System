import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const next = searchParams.get("next") ?? "/"

  try {
    const supabase = createRouteHandlerClient({ cookies })
    // Exchange the code present in the full URL and persist cookies
    await supabase.auth.exchangeCodeForSession(request.url)
    return NextResponse.redirect(`${origin}${next}`)
  } catch {
    // Return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }
 }
