"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Menu, User, LogOut, Bell } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface DashboardProps {
  onLogout: () => void
  userData?: any
}

export function Dashboard({ onLogout, userData }: DashboardProps) {
  const [isEmergencyActive, setIsEmergencyActive] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSOSConfirm, setShowSOSConfirm] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    // Get user data from props or localStorage
    if (userData) {
      setCurrentUser(userData)
    } else {
      const storedUser = localStorage.getItem("mdrrmo_user")
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser))
      }
    }

    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
        },
        (error) => {
          console.error("Error getting location:", error)
        },
      )
    }

    // Load notifications
    loadNotifications()

    // Set up real-time notifications
    const channel = supabase
      .channel("user_notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${currentUser?.id}`,
        },
        (payload) => {
          console.log("New notification:", payload)
          loadNotifications()
          // Show popup notification
          alert(payload.new.message)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userData, currentUser?.id])

  const loadNotifications = async () => {
    if (!currentUser?.id) return

    const { data, error } = await supabase
      .from("user_notifications")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })

    if (!error && data) {
      setNotifications(data)
    }
  }

  const handleSOSClick = () => {
    setShowSOSConfirm(true)
  }

  const confirmSOS = async () => {
    if (!location || !currentUser) {
      alert("Location not available or user not logged in")
      return
    }

    setIsEmergencyActive(true)
    setShowSOSConfirm(false)

    try {
      // Get address from coordinates (using a free geocoding service)
      let locationAddress = "Location unavailable"
      try {
        const response = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.lat}&longitude=${location.lng}&localityLanguage=en`,
        )
        const data = await response.json()
        locationAddress = data.display_name || `${location.lat}, ${location.lng}`
      } catch (err) {
        console.error("Geocoding error:", err)
        locationAddress = `${location.lat}, ${location.lng}`
      }

      // Create emergency report
      const { data: reportData, error: reportError } = await supabase
        .from("emergency_reports")
        .insert({
          user_id: currentUser.id,
          firstName: currentUser.firstName,
          middleName: currentUser.middleName || "",
          lastName: currentUser.lastName,
          mobileNumber: currentUser.mobileNumber,
          latitude: location.lat,
          longitude: location.lng,
          location_address: locationAddress,
          emergency_type: "SOS",
          status: "active",
        })
        .select()
        .single()

      if (reportError) {
        console.error("Error creating report:", reportError)
        alert("Failed to send emergency alert")
        return
      }

      // Create admin notification
      await supabase.from("admin_notifications").insert({
        emergency_report_id: reportData.id,
        message: `🚨 EMERGENCY ALERT: ${currentUser.firstName} ${currentUser.lastName} needs help at ${locationAddress}`,
      })

      console.log("Emergency alert sent successfully!")

      setTimeout(() => {
        setIsEmergencyActive(false)
      }, 5000)
    } catch (error) {
      console.error("SOS Error:", error)
      alert("Failed to send emergency alert")
      setIsEmergencyActive(false)
    }
  }

  const cancelSOS = () => {
    setShowSOSConfirm(false)
  }

  const handleLogout = () => {
    console.log("LOGOUT FUNCTION CALLED!")
    localStorage.removeItem("mdrrmo_user")
    setShowUserMenu(false)
    onLogout()
  }

  const handleUserMenuClick = (e: React.MouseEvent) => {
    console.log("User menu clicked!")
    e.preventDefault()
    e.stopPropagation()
    setShowUserMenu(!showUserMenu)
  }

  return (
    <div
      className="min-h-screen relative"
      style={{
        backgroundImage: "url('/images/mdrrmo_dashboard_bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black/30"></div>

      {/* Header */}
      <div className="relative z-10 bg-orange-500/95 backdrop-blur-sm text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Menu className="w-6 h-6" />
            <span className="font-medium">Menu</span>
          </div>

          <div className="text-center flex-1">
            <h1 className="text-lg font-bold">MDRRMO</h1>
            <p className="text-sm text-orange-100">Accident Reporting System</p>
          </div>

          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 hover:bg-orange-600 rounded transition-colors relative"
              >
                <Bell className="w-6 h-6" />
                {notifications.filter((n) => !n.is_read).length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {notifications.filter((n) => !n.is_read).length}
                  </span>
                )}
              </button>
            </div>

            {/* User Menu */}
            <div className="relative">
              <div
                className="flex items-center space-x-2 cursor-pointer hover:bg-orange-600 p-2 rounded transition-colors"
                onClick={handleUserMenuClick}
              >
                <User className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div className="fixed top-20 right-4 bg-white rounded-lg shadow-xl border border-gray-200 w-80 max-h-96 overflow-y-auto z-50">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-gray-500 text-center">No notifications</div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 ${!notification.is_read ? "bg-blue-50" : ""}`}
                >
                  <p className="text-sm text-gray-800">{notification.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(notification.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* User Menu Overlay */}
      {showUserMenu && (
        <div
          className="fixed inset-0 bg-black/20 flex items-start justify-end pt-16 pr-4"
          style={{ zIndex: 99999 }}
          onClick={() => setShowUserMenu(false)}
        >
          <div
            className="bg-white text-gray-800 rounded-lg shadow-2xl border border-gray-200 min-w-[200px] animate-in slide-in-from-top-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <p className="text-sm font-medium text-gray-900">Hi {currentUser?.firstName || "User"}!</p>
              <p className="text-xs text-gray-500">{currentUser?.email || currentUser?.username}</p>
            </div>
            <div className="p-2">
              <div
                onClick={(e) => {
                  console.log("LOGOUT CLICKED FROM OVERLAY!")
                  e.preventDefault()
                  e.stopPropagation()
                  handleLogout()
                }}
                className="flex items-center space-x-2 w-full p-3 hover:bg-red-50 hover:text-red-600 rounded text-left transition-colors cursor-pointer select-none"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium">Logout</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SOS Confirmation Modal */}
      {showSOSConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Send Emergency Alert?</h3>
              <p className="text-gray-600 mb-6">
                This will send your location and details to MDRRMO emergency responders.
              </p>
              <div className="flex space-x-3">
                <Button onClick={cancelSOS} variant="outline" className="flex-1 bg-transparent">
                  NO
                </Button>
                <Button onClick={confirmSOS} className="flex-1 bg-red-500 hover:bg-red-600">
                  YES, SEND ALERT
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-8">
        {/* SOS Button */}
        <div className="text-center mb-8">
          <div
            className={`w-48 h-48 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 shadow-2xl ${
              isEmergencyActive ? "bg-red-600 animate-pulse scale-110" : "bg-red-500 hover:bg-red-600 hover:scale-105"
            }`}
            onClick={handleSOSClick}
          >
            <div className="text-center">
              <AlertTriangle className="w-16 h-16 text-white mx-auto mb-2" />
              <span className="text-white text-3xl font-bold">SOS</span>
            </div>
          </div>
        </div>

        {/* Emergency Text */}
        <div className="text-center bg-white/90 backdrop-blur-sm rounded-lg p-6 shadow-lg max-w-sm">
          <p className="text-gray-800 text-lg font-semibold mb-2">
            {isEmergencyActive ? "Emergency Alert Sent!" : "Click SOS to send an Emergency"}
          </p>
          {isEmergencyActive && <p className="text-green-600 font-medium">Help is on the way. Stay calm and safe.</p>}
        </div>

        {/* Status Indicator */}
        {isEmergencyActive && (
          <div className="mt-6 bg-red-500 text-white px-6 py-3 rounded-full animate-bounce">
            <span className="font-bold">🚨 EMERGENCY ACTIVE 🚨</span>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-orange-500/95 backdrop-blur-sm text-white p-4 z-10">
        <div className="flex justify-center items-center">
          <Button variant="ghost" className="text-white hover:bg-orange-600 flex flex-col items-center px-8">
            <span className="text-2xl mb-1">📋</span>
            <span className="text-sm font-medium">Reports</span>
          </Button>
        </div>
      </div>
    </div>
  )
}


