"use client"

import React from "react"
import { AlertTriangle, Waves } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BroadcastAlertData {
  type: "earthquake" | "tsunami"
  title: string
  body: string
  createdAt?: string | null
}

interface UserBroadcastOverlayProps {
  alert: BroadcastAlertData
  onDismiss: () => void
  onPlaySound: () => void
}

const typeStyles: Record<BroadcastAlertData["type"], { accent: string; icon: React.ReactNode; label: string }> = {
  earthquake: {
    accent: "bg-red-600",
    icon: <AlertTriangle className="h-8 w-8 text-white" />,
    label: "Earthquake Alert",
  },
  tsunami: {
    accent: "bg-blue-600",
    icon: <Waves className="h-8 w-8 text-white" />,
    label: "Tsunami Alert",
  },
}

export function UserBroadcastOverlay({ alert, onDismiss, onPlaySound }: UserBroadcastOverlayProps) {
  const style = typeStyles[alert.type]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className={`flex items-center gap-3 px-5 py-4 ${style.accent}`}>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
            {style.icon}
          </div>
          <div className="text-white">
            <p className="text-sm uppercase tracking-wide opacity-80">Urgent Broadcast</p>
            <h2 className="text-xl font-semibold">{style.label}</h2>
          </div>
        </div>
        <div className="space-y-4 px-5 py-6 text-gray-800">
          <div>
            <h3 className="text-lg font-semibold">{alert.title || style.label}</h3>
            {alert.createdAt && (
              <p className="text-sm text-gray-500">{new Date(alert.createdAt).toLocaleString()}</p>
            )}
          </div>
          {alert.body && <p className="text-base leading-relaxed">{alert.body}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onPlaySound} className="w-full sm:w-auto">
              Replay alert sound
            </Button>
            <Button onClick={onDismiss} className="w-full sm:w-auto">
              Dismiss alert
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
