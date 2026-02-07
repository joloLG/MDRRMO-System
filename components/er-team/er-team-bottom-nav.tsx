"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { Home, FileText, ClipboardList, CheckCircle, FilePlus } from "lucide-react"
import type { ErTeamTab } from "./pages/er-team-context"

export type { ErTeamTab }

interface ErTeamBottomNavProps {
  activeTab: ErTeamTab
  onTabChange: (tab: ErTeamTab) => void
  draftCount?: number
}

const navItems: { id: ErTeamTab; label: string; icon: React.ElementType }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "drafts", label: "Drafts", icon: FileText },
  { id: "reports", label: "Reports", icon: FilePlus },
  { id: "accommodated", label: "Accommodated", icon: CheckCircle },
]

export function ErTeamBottomNav({ activeTab, onTabChange, draftCount = 0 }: ErTeamBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon
          const showBadge = item.id === "drafts" && draftCount > 0

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full relative transition-all duration-200",
                isActive
                  ? "text-orange-600 bg-orange-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "w-6 h-6 transition-all duration-200",
                    isActive ? "scale-110" : "scale-100"
                  )}
                />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {draftCount > 9 ? "9+" : draftCount}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] mt-1 font-medium transition-all duration-200",
                  isActive ? "opacity-100" : "opacity-80"
                )}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-orange-500 rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
