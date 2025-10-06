import React from "react"
import AdminRealtimeOverlay from "@/components/admin/AdminRealtimeOverlay"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      {/* Global emergency overlay across all admin pages */}
      <AdminRealtimeOverlay />
    </>
  )
}
