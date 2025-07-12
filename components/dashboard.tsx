"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Menu, User, LogOut } from "lucide-react"

interface DashboardProps {
  onLogout: () => void
  userData?: any
}

export function Dashboard({ onLogout, userData }: DashboardProps) {
  const [isEmergencyActive, setIsEmergencyActive] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

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
  }, [userData])

  const handleSOSClick = () => {
    setIsEmergencyActive(true)
    console.log("SOS Emergency Alert Sent!")

    setTimeout(() => {
      setIsEmergencyActive(false)
    }, 3000)
  }

  const handleLogout = () => {
    console.log("LOGOUT FUNCTION CALLED!")
    // Clear any stored user data
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

      {/* Full Screen User Menu Overlay */}
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
            {/* User greeting */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <p className="text-sm font-medium text-gray-900">Hi {currentUser?.firstName || "User"}!</p>
              <p className="text-xs text-gray-500">{currentUser?.email || currentUser?.username}</p>
            </div>

            {/* Logout button */}
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
            {isEmergencyActive ? "Emergency Alert Sent!" : "Click to send an Emergency"}
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

      {/* Emergency Logout Button - Always visible for testing */}
      <div className="fixed top-20 left-4 z-[99999]">
        <button
          onClick={() => {
            console.log("EMERGENCY LOGOUT BUTTON CLICKED!")
            localStorage.removeItem("mdrrmo_user")
            onLogout()
          }}
          className="bg-red-500 text-white px-4 py-2 rounded shadow-lg hover:bg-red-600 transition-colors"
        >
          Emergency Logout
        </button>
      </div>
    </div>
  )
}
