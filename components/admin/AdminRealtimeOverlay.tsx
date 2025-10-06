"use client"

import React, { useEffect, useRef, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useRouter } from "next/navigation"

interface AdminNotificationRow {
  id: string
  type: string
  message: string
  created_at: string
  emergency_report_id?: string
}

export default function AdminRealtimeOverlay() {
  const supabase = createClientComponentClient()
  const router = useRouter()

  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState<string>("")

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const channel = supabase
      .channel("admin-overlay-new-report")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        (payload: any) => {
          const row = payload?.new as AdminNotificationRow
          if (row?.type === "new_report") {
            showOverlay(row?.message || "New emergency report received")
          }
        }
      )
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch {}
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      stopSound()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showOverlay = (msg: string) => {
    setMessage(msg)
    setVisible(true)
    startSound()
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    dismissTimer.current = setTimeout(() => {
      hideOverlay()
    }, 10000) // auto-dismiss after 10s
  }

  const hideOverlay = () => {
    setVisible(false)
    stopSound()
  }

  const startSound = () => {
    try {
      const enabled = typeof window !== 'undefined' ? localStorage.getItem('mdrrmo_admin_sound_enabled') === 'true' : true
      if (!enabled) return
      if (!audioRef.current) {
        audioRef.current = new Audio("/sounds/alert.mp3")
        audioRef.current.loop = true
        audioRef.current.volume = 1.0
      }
      audioRef.current.currentTime = 0
      void audioRef.current.play().catch(() => {})
    } catch {}
  }

  const stopSound = () => {
    try {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    } catch {}
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-red-900/80 backdrop-blur-sm" />
      <div className="relative z-10 max-w-md w-[92%] sm:w-[520px] bg-white rounded-lg shadow-2xl border-2 border-red-600">
        <div className="p-4 sm:p-6">
          <div className="flex items-center mb-3">
            <span className="text-red-700 font-extrabold text-lg mr-2">🚨 EMERGENCY ALERT</span>
          </div>
          <p className="text-gray-800 mb-4 break-words">{message}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => { hideOverlay(); router.push("/") }}
              className="px-4 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Okay
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
