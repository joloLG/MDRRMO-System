import React from "react"
import AdminRealtimeOverlay from "@/components/admin/AdminRealtimeOverlay"
import UserNotificationOverlay from "@/components/admin/UserNotificationOverlay"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AdminRealtimeOverlay />
      <UserNotificationOverlay />
    </>
  )
}
