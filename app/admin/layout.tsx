"use client"

import React from "react"
import AdminRealtimeOverlay from "@/components/admin/AdminRealtimeOverlay"
import UserNotificationOverlay from "@/components/admin/UserNotificationOverlay"
import NotificationService from "@/components/admin/NotificationService"
import { AdminHeader } from "@/components/admin/AdminHeader"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <AdminHeader />
      <main className="flex-1">
        {children}
      </main>
      <AdminRealtimeOverlay />
      <UserNotificationOverlay />
      <NotificationService />
      <div id="toast-container" className="fixed top-4 right-4 z-[9999] space-y-2" />
    </div>
  )
}
