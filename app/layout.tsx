import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SupabaseListener } from "@/components/supabase-listener"
import { SWRProvider } from "@/components/providers/SWRProvider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "MDRRMO Mobile App",
  description: "Emergency Reporting System",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Keep Supabase session in sync with cookies so middleware can authorize /admin routes */}
        <SupabaseListener />
        <SWRProvider>
          {children}
        </SWRProvider>
      </body>
    </html>
  )
}
