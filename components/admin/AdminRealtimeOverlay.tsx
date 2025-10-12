"use client"

import React, { useEffect, useRef, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useRouter } from "next/navigation"
import { Flame, Car } from "lucide-react"
import { getAlertSoundSignedUrl, clearAlertSoundCache } from '@/lib/alertSounds'

interface AdminNotificationRow {
  id: string
  type: string
  message: string
  created_at: string
  emergency_report_id?: string
}

type OverlayVariant = "default" | "fire" | "vehicular"

export default function AdminRealtimeOverlay() {
  const supabase = createClientComponentClient()
  const router = useRouter()

  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState<string>("")
  const [variant, setVariant] = useState<OverlayVariant>("default")

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [adminSoundPath, setAdminSoundPath] = useState<string | null>(null)

  useEffect(() => {
    const notifChannel = supabase
      .channel("admin-overlay-new-report")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        (payload: any) => {
          const row = payload?.new as AdminNotificationRow
          if (row?.type === "new_report") {
            void processNotification(row)
          }
        }
      )
      .subscribe()

    const loadAdminSound = async () => {
      try {
        const { data, error } = await supabase
          .from('alert_settings')
          .select('admin_incident_sound_path, active_file_path')
          .order('updated_at', { ascending: false })
          .limit(1)
        if (!error && data && data.length > 0) {
          const row = data[0] as any
          setAdminSoundPath(prev => {
            const next = row.admin_incident_sound_path || row.active_file_path || null
            if (prev && prev !== next) clearAlertSoundCache(prev)
            return next
          })
        } else {
          setAdminSoundPath(null)
        }
      } catch {
        setAdminSoundPath(null)
      }
    }
    void loadAdminSound()

    const settingsChannel = supabase
      .channel('admin-overlay-alert-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alert_settings' }, () => {
        void loadAdminSound()
      })
      .subscribe()

    return () => {
      try { supabase.removeChannel(notifChannel) } catch {}
      try { supabase.removeChannel(settingsChannel) } catch {}
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      stopSound()
    }
   
  }, [])

  const detectVariant = (text?: string): OverlayVariant => {
    const s = (text || "").toLowerCase()
    if (s.includes("fire")) return "fire"
    if (s.includes("vehicular") || s.includes("vehicle") || s.includes("accident")) return "vehicular"
    return "default"
  }

  const processNotification = async (row: AdminNotificationRow) => {
    let v: OverlayVariant = "default"
    let msg = row?.message || "New emergency report received"
    try {
      if (row?.emergency_report_id) {
        const { data } = await supabase
          .from('emergency_reports')
          .select('emergency_type')
          .eq('id', row.emergency_report_id)
          .single()
        if (data?.emergency_type) {
          v = detectVariant(data.emergency_type)
        } else {
          v = detectVariant(msg)
        }
      } else {
        v = detectVariant(msg)
      }
    } catch {}
    showOverlay(msg, v)
  }

  const showOverlay = (msg: string, v: OverlayVariant = "default") => {
    setMessage(msg)
    setVariant(v)
    setVisible(true)
    startSound()
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    dismissTimer.current = setTimeout(() => {
      hideOverlay()
    }, 5000)
  }

  const hideOverlay = () => {
    setVisible(false)
    stopSound()
  }

  const startSound = async () => {
    try {
      const enabled = typeof window !== 'undefined' ? localStorage.getItem('mdrrmo_admin_sound_enabled') === 'true' : true
      if (!enabled) return
      if (!audioRef.current) {
        audioRef.current = new Audio()
        audioRef.current.loop = true
        audioRef.current.volume = 1.0
      }

      let url: string | null = null
      if (adminSoundPath) {
        const signed = await getAlertSoundSignedUrl(adminSoundPath, 120)
        if (signed) {
          url = signed
        } else {
          console.warn('[AdminAlertSound] Signed URL unavailable', { path: adminSoundPath })
        }
      }

      audioRef.current.src = url || "/sounds/alert.mp3"
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
      <div className={`absolute inset-0 backdrop-blur-sm ${variant === 'fire' ? 'bg-orange-950/80' : variant === 'vehicular' ? 'bg-yellow-900/80' : 'bg-red-900/80'}`} />
      <div className={`relative z-10 max-w-md w-[92%] sm:w-[520px] bg-white rounded-lg shadow-2xl border-2 ${variant === 'fire' ? 'border-orange-500' : variant === 'vehicular' ? 'border-yellow-500' : 'border-red-600'}`}>
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            {variant === 'fire' ? (
              <Flame className="h-6 w-6 text-orange-600 animate-pulse" />
            ) : variant === 'vehicular' ? (
              <Car className="h-6 w-6 text-yellow-600" />
            ) : (
              <span className="text-red-700 text-xl">🚨</span>
            )}
            <span className={`${variant === 'fire' ? 'text-orange-700' : variant === 'vehicular' ? 'text-yellow-700' : 'text-red-700'} font-extrabold text-lg`}>
              {variant === 'fire' ? 'FIRE INCIDENT' : variant === 'vehicular' ? 'VEHICULAR ACCIDENT' : 'EMERGENCY ALERT'}
            </span>
          </div>
          <p className="text-gray-800 mb-4 break-words">{message}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => { hideOverlay(); router.push("/") }}
              className={`px-4 py-2 rounded-md text-white font-semibold focus:outline-none focus:ring-2 ${variant === 'fire' ? 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-400' : variant === 'vehicular' ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-400' : 'bg-red-600 hover:bg-red-700 focus:ring-red-400'}`}
            >
              Okay
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
