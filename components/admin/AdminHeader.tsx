"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Menu,
  Bell,
  LogOut,
  Clock,
  BarChart,
  Settings,
  FileText,
  History,
  Info,
  Phone,
  Mail,
  Flame,
  Megaphone,
  Newspaper,
  Home,
  Volume2,
  VolumeX,
  ChevronDown,
} from "lucide-react"

interface Notification {
  id: string
  emergency_report_id: string
  message: string
  is_read: boolean
  created_at: string
  type: "new_report" | "report_update" | "report_review"
}

interface AdminHeaderProps {
  /** If provided, overrides fetched admin user data (used by main dashboard which already has it) */
  adminUser?: { firstName?: string; username?: string; lastName?: string } | null
  /** Notification state can be controlled externally by the main dashboard */
  externalNotifications?: Notification[]
  externalUnreadCount?: number
  onNotificationClick?: (n: Notification) => void
  onMarkAllRead?: () => void
  /** Sound state can be controlled externally */
  externalSoundEnabled?: boolean
  onToggleSound?: () => void
  /** Logout handler */
  onLogout?: () => void
  /** Broadcast handler */
  onTriggerBroadcast?: (type: "earthquake" | "tsunami") => void
  /** Connection status */
  connectionStatus?: "ok" | "degraded" | "offline"
  /** Loading state for actions */
  isLoadingAction?: boolean
}

const NAV_ITEMS = [
  { href: "/", label: "Main Dashboard", icon: Home },
  { href: "/admin/charts", label: "Charts & Analytics", icon: BarChart },
  { href: "/admin/heatmap", label: "Incident Heat Map", icon: Flame },
  { href: "/admin/data", label: "Data Management", icon: Settings },
  { href: "/admin/report", label: "Report Management", icon: FileText },
  { href: "/admin/narrative-reports", label: "Narrative Reports", icon: Newspaper },
  { href: "/admin/report-history", label: "History of Report", icon: History },
  { href: "/admin/mdrrmo-info", label: "MDRRMO Information", icon: Info },
  { href: "/admin/hotlines", label: "Hotlines Management", icon: Phone },
  { href: "/admin/alerts", label: "Alert Management", icon: Bell },
  { href: "/admin/advisory", label: "Advisory Management", icon: Megaphone },
  { href: "/admin/feedback", label: "Users Concern", icon: Mail },
]

export function AdminHeader({
  adminUser: externalAdminUser,
  externalNotifications,
  externalUnreadCount,
  onNotificationClick,
  onMarkAllRead,
  externalSoundEnabled,
  onToggleSound,
  onLogout,
  onTriggerBroadcast,
  connectionStatus: externalConnectionStatus,
  isLoadingAction: externalIsLoadingAction,
}: AdminHeaderProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  // ─── Admin user (self-fetch if not provided) ───
  const [fetchedAdminUser, setFetchedAdminUser] = useState<{ firstName?: string; username?: string } | null>(null)
  useEffect(() => {
    if (externalAdminUser !== undefined) return
    const stored = typeof window !== "undefined" ? localStorage.getItem("mdrrmo_user") : null
    if (stored) {
      try {
        setFetchedAdminUser(JSON.parse(stored))
      } catch {
        /* ignore */
      }
    }
  }, [externalAdminUser])
  const adminUser = externalAdminUser !== undefined ? externalAdminUser : fetchedAdminUser

  // ─── Date / Time (PH) ───
  const phDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        weekday: "long",
        month: "long",
        day: "2-digit",
        year: "numeric",
      }),
    []
  )
  const phTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
    []
  )
  const [phDate, setPhDate] = useState<string>("")
  const [phTime, setPhTime] = useState<string>("")
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setPhDate(phDateFormatter.format(now))
      setPhTime(phTimeFormatter.format(now))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [phDateFormatter, phTimeFormatter])

  // ─── Greeting ───
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  }
  const [greeting, setGreeting] = useState<string>(getGreeting())
  useEffect(() => {
    const update = () => setGreeting(getGreeting())
    update()
    const interval = setInterval(update, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // ─── Self-managed notifications (for sub-pages that don't pass them) ───
  const [selfNotifications, setSelfNotifications] = useState<Notification[]>([])
  const [selfUnreadCount, setSelfUnreadCount] = useState(0)
  const usingExternalNotifications = externalNotifications !== undefined

  useEffect(() => {
    if (usingExternalNotifications) return
    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("id, emergency_report_id, message, is_read, created_at, type")
        .in("type", ["new_report", "report_review"])
        .order("created_at", { ascending: false })
        .limit(50)
      if (!error && data) {
        setSelfNotifications(data as Notification[])
        setSelfUnreadCount(data.filter((n: any) => !n.is_read).length)
      }
    }
    fetchNotifications()

    const channel = supabase
      .channel("admin-header-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notifications" }, () => {
        fetchNotifications()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [usingExternalNotifications])

  const notifications = usingExternalNotifications ? externalNotifications! : selfNotifications
  const unreadCount = externalUnreadCount !== undefined ? externalUnreadCount : selfUnreadCount

  // ─── Self-managed sound toggle (for sub-pages) ───
  const [selfSoundEnabled, setSelfSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("mdrrmo_admin_sound_enabled")
      if (stored === null) return true
      return stored !== "false"
    }
    return true
  })
  const soundEnabled = externalSoundEnabled !== undefined ? externalSoundEnabled : selfSoundEnabled

  const handleToggleSound = useCallback(() => {
    if (onToggleSound) {
      onToggleSound()
    } else {
      setSelfSoundEnabled((prev) => {
        const next = !prev
        if (typeof window !== "undefined") {
          localStorage.setItem("mdrrmo_admin_sound_enabled", String(next))
        }
        return next
      })
    }
  }, [onToggleSound])

  // ─── Self-managed broadcast (for sub-pages) ───
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false)
  const [pendingBroadcastType, setPendingBroadcastType] = useState<"earthquake" | "tsunami" | null>(null)
  const [broadcastMessage, setBroadcastMessage] = useState("")
  const [broadcastValidationError, setBroadcastValidationError] = useState<string | null>(null)
  const [selfIsLoadingAction, setSelfIsLoadingAction] = useState(false)

  const isLoadingAction = externalIsLoadingAction !== undefined ? externalIsLoadingAction : selfIsLoadingAction

  const handleTriggerBroadcast = useCallback(
    (type: "earthquake" | "tsunami") => {
      if (onTriggerBroadcast) {
        onTriggerBroadcast(type)
      } else {
        setPendingBroadcastType(type)
        setBroadcastMessage("")
        setBroadcastValidationError(null)
        setBroadcastModalOpen(true)
      }
    },
    [onTriggerBroadcast]
  )

  const confirmBroadcastAlert = useCallback(async () => {
    if (!pendingBroadcastType) return
    const label = pendingBroadcastType === "earthquake" ? "EARTHQUAKE ALERT" : "TSUNAMI ALERT"
    const trimmed = broadcastMessage.trim()
    if (!trimmed) {
      setBroadcastValidationError("Message is required.")
      return
    }
    setBroadcastValidationError(null)
    setSelfIsLoadingAction(true)
    try {
      const res = await fetch("/api/broadcast-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: pendingBroadcastType, title: label, body: trimmed }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `Failed to send ${label}`)
      }
      setBroadcastModalOpen(false)
      setPendingBroadcastType(null)
      setBroadcastMessage("")
    } catch (e: any) {
      console.error("Broadcast error:", e)
      setBroadcastValidationError(e?.message || "Broadcast failed")
    } finally {
      setSelfIsLoadingAction(false)
    }
  }, [pendingBroadcastType, broadcastMessage])

  // ─── Notifications dropdown ───
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false)
  const notificationsDropdownRef = useRef<HTMLDivElement>(null)
  const notificationsButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showNotificationsDropdown &&
        notificationsDropdownRef.current &&
        !notificationsDropdownRef.current.contains(event.target as Node) &&
        notificationsButtonRef.current &&
        !notificationsButtonRef.current.contains(event.target as Node)
      ) {
        setShowNotificationsDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showNotificationsDropdown])

  const handleNotificationClick = useCallback(
    async (n: Notification) => {
      if (onNotificationClick) {
        onNotificationClick(n)
        setShowNotificationsDropdown(false)
        return
      }
      // Self-managed: mark as read
      if (!n.is_read) {
        await supabase.from("admin_notifications").update({ is_read: true }).eq("id", n.id)
        setSelfNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
        setSelfUnreadCount((prev) => Math.max(0, prev - 1))
      }
      setShowNotificationsDropdown(false)
    },
    [onNotificationClick]
  )

  const handleMarkAllRead = useCallback(async () => {
    if (onMarkAllRead) {
      onMarkAllRead()
      return
    }
    // Self-managed
    const unreadIds = selfNotifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return
    await supabase.from("admin_notifications").update({ is_read: true }).in("id", unreadIds)
    setSelfNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setSelfUnreadCount(0)
  }, [onMarkAllRead, selfNotifications])

  // ─── Logout ───
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const handleLogout = useCallback(async () => {
    if (onLogout) {
      await onLogout()
    }
    if (typeof window !== "undefined") {
      window.location.href = "/"
    }
  }, [onLogout])

  // ─── Active path helper ───
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname === "/admin"
    return pathname?.startsWith(href) ?? false
  }

  const connectionStatus = externalConnectionStatus ?? "ok"

  return (
    <>
      {/* ── Broadcast Modal (self-managed for sub-pages) ── */}
      {!onTriggerBroadcast && (
        <Dialog open={broadcastModalOpen} onOpenChange={(open) => {
          setBroadcastModalOpen(open)
          if (!open) {
            setPendingBroadcastType(null)
            setBroadcastMessage("")
            setBroadcastValidationError(null)
          }
        }}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>
                {pendingBroadcastType === "earthquake"
                  ? "Earthquake Alert"
                  : pendingBroadcastType === "tsunami"
                  ? "Tsunami Alert"
                  : "Alert"}{" "}
                Message
              </DialogTitle>
              <DialogDescription>Compose the alert message that will be sent to all users.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="header-broadcast-message">Message</Label>
                <Textarea
                  id="header-broadcast-message"
                  rows={5}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Provide the alert details to be sent to all users."
                  disabled={selfIsLoadingAction}
                />
              </div>
              {broadcastValidationError && <p className="text-sm text-red-600">{broadcastValidationError}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setBroadcastModalOpen(false)
                  setPendingBroadcastType(null)
                  setBroadcastMessage("")
                  setBroadcastValidationError(null)
                }}
                disabled={selfIsLoadingAction}
              >
                Cancel
              </Button>
              <Button onClick={confirmBroadcastAlert} disabled={selfIsLoadingAction}>
                {selfIsLoadingAction ? "Sending…" : "Send Alert"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Logout Confirmation Dialog ── */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="w-80">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>Are you sure you want to log out of the admin dashboard?</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Confirm Logout
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── HEADER BAR ── */}
      <header className="sticky top-0 z-40 w-full bg-white shadow-lg border-b border-gray-200">
        <div className="flex items-center justify-between py-2 sm:py-3 px-4 sm:px-6">
          {/* LEFT: Hamburger + Title / User */}
          <div className="flex items-center gap-3">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-700 hover:bg-gray-100">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] sm:w-[320px] flex flex-col" aria-describedby={undefined}>
                <SheetHeader>
                  <SheetTitle className="text-lg font-bold text-gray-800">Admin Menu</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 mt-4 overflow-y-auto flex-1">
                  {NAV_ITEMS.map((item, index) => {
                    const Icon = item.icon
                    const active = isActive(item.href)
                    return (
                      <Button
                        key={item.href}
                        variant="ghost"
                        className={`justify-start gap-3 transition-all duration-300 ease-out animate-in slide-in-from-left-4 fade-in ${
                          active
                            ? "bg-orange-100 text-orange-800 font-semibold border-l-4 border-orange-500"
                            : "text-gray-700 hover:bg-gray-100 hover:translate-x-1"
                        }`}
                        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                        asChild
                      >
                        <Link href={item.href} onClick={() => setMenuOpen(false)}>
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      </Button>
                    )
                  })}
                </nav>
                <div className="mt-auto pt-4 text-xs text-gray-500 border-t flex items-center justify-center">
                  Copyright © 2025 | Jolo Gracilla
                </div>
              </SheetContent>
            </Sheet>

            <div className="hidden sm:block">
              <h1 className="text-lg sm:text-xl font-bold text-gray-800 leading-tight">Admin Dashboard</h1>
              {adminUser && (
                <p className="text-xs sm:text-sm text-gray-500 leading-tight">
                  {greeting}, {adminUser.firstName || adminUser.username || "Admin"}
                </p>
              )}
            </div>
            {/* Mobile: just show name */}
            <div className="block sm:hidden">
              {adminUser && (
                <span className="text-sm font-semibold text-gray-800">
                  {adminUser.firstName || adminUser.username || "Admin"}
                </span>
              )}
            </div>
          </div>

          {/* CENTER: Date & Time */}
          <div className="hidden md:flex flex-col items-center mx-2">
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-md px-3 py-1">
              <Clock className="h-4 w-4 text-gray-600" />
              <span className="font-mono tabular-nums text-lg sm:text-xl font-bold text-gray-800 leading-none">
                {phTime}
              </span>
            </div>
            <span className="text-xs sm:text-sm text-gray-500 mt-0.5">{phDate}</span>
          </div>

          {/* RIGHT: Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Tsunami & Earthquake */}
            <div className="hidden lg:flex items-center gap-1.5">
              <Button
                size="sm"
                className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-3"
                onClick={() => handleTriggerBroadcast("tsunami")}
                disabled={isLoadingAction}
              >
                TSUNAMI
              </Button>
              <Button
                size="sm"
                className="bg-orange-700 hover:bg-orange-800 text-white text-xs font-bold px-3"
                onClick={() => handleTriggerBroadcast("earthquake")}
                disabled={isLoadingAction}
              >
                EARTHQUAKE
              </Button>
            </div>

            {/* Connection status */}
            {connectionStatus !== "ok" && (
              <span
                className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                  connectionStatus === "offline"
                    ? "bg-red-100 text-red-800 border-red-300"
                    : "bg-yellow-100 text-yellow-800 border-yellow-300"
                }`}
              >
                {connectionStatus === "offline" ? "Offline" : "Degraded"}
              </span>
            )}

            {/* Sound Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-700 hover:bg-gray-100"
              onClick={handleToggleSound}
              title={soundEnabled ? "Disable alert sound" : "Enable alert sound"}
            >
              {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>

            {/* Notifications */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-700 hover:bg-gray-100"
                onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                ref={notificationsButtonRef}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-bold text-black">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
              {showNotificationsDropdown && (
                <div
                  className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl z-50 border border-gray-200"
                  ref={notificationsDropdownRef}
                >
                  <div className="p-3 font-bold border-b text-gray-800 flex items-center justify-between">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <ul className="max-h-80 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((n) => (
                        <li
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3 border-b hover:bg-gray-50 cursor-pointer transition-colors ${
                            !n.is_read ? "font-semibold bg-orange-50" : ""
                          }`}
                        >
                          <p className="text-sm text-gray-700 line-clamp-2">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                        </li>
                      ))
                    ) : (
                      <li className="p-4 text-center text-gray-400 text-sm">No notifications.</li>
                    )}
                  </ul>
                  {notifications.length > 0 && (
                    <div className="p-2 border-t">
                      <Button
                        variant="link"
                        className="w-full text-sm"
                        onClick={handleMarkAllRead}
                        disabled={isLoadingAction || unreadCount === 0}
                      >
                        Mark all as read
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Logout */}
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-700 hover:bg-gray-100 gap-1.5"
              onClick={() => setShowLogoutConfirm(true)}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline text-sm">Logout</span>
            </Button>
          </div>
        </div>

        {/* Mobile: Date/Time bar + alert buttons */}
        <div className="flex md:hidden items-center justify-between pb-2 gap-2 px-4 sm:px-6">
          <div className="flex items-center gap-1.5 bg-gray-100 rounded px-2 py-0.5">
            <Clock className="h-3 w-3 text-gray-600" />
            <span className="font-mono tabular-nums text-sm font-bold text-gray-800">{phTime}</span>
          </div>
          <span className="text-xs text-gray-500 truncate flex-1 text-center">{phDate}</span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              className="bg-red-700 hover:bg-red-800 text-white text-[10px] font-bold px-2 py-1 h-auto"
              onClick={() => handleTriggerBroadcast("tsunami")}
              disabled={isLoadingAction}
            >
              TSU
            </Button>
            <Button
              size="sm"
              className="bg-orange-700 hover:bg-orange-800 text-white text-[10px] font-bold px-2 py-1 h-auto"
              onClick={() => handleTriggerBroadcast("earthquake")}
              disabled={isLoadingAction}
            >
              EQ
            </Button>
          </div>
        </div>
      </header>
    </>
  )
}
