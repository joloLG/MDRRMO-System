"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Menu, User, LogOut, Bell } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface Notification { // Updated Notification interface
  id: string;
  emergency_report_id: string;
  message: string;
  is_read: boolean; // Corrected to match schema
  created_at: string; // Corrected to match schema
}

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
  const [notifications, setNotifications] = useState<Notification[]>([]) // Explicitly type notifications state
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    const checkSessionAndLoadUser = async () => {
      let userFromPropsOrStorage = null;

      // Prioritize user data from props
      if (userData) {
        userFromPropsOrStorage = userData;
      } else {
        // Fallback to localStorage if no userData prop
        const storedUser = localStorage.getItem("mdrrmo_user");
        if (storedUser) {
          try {
            userFromPropsOrStorage = JSON.parse(storedUser);
          } catch (parseError) {
            console.error("Error parsing stored user data in Dashboard:", parseError);
            localStorage.removeItem("mdrrmo_user"); // Clear corrupted data
            onLogout(); // Force logout if data is corrupted
            return;
          }
        }
      }

      // Verify Supabase session
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !sessionData?.session) {
          console.error("Supabase session invalid or not found:", sessionError);
          onLogout(); // Force logout if session is invalid
          return;
        }

        // If session is valid, ensure currentUser matches the session user
        // and has the necessary profile data (from your 'users' table)
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', sessionData.session.user.id)
          .single();

        if (profileError || !userProfile) {
          console.error("Error fetching user profile:", profileError);
          onLogout(); // Force logout if profile cannot be fetched
          return;
        }

        setCurrentUser(userProfile); // Set currentUser from fetched profile
        
        // Get user's location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              });
            },
            (error) => {
              console.error("Error getting location:", error);
            },
          );
        }

        // Load notifications after user is set
        loadNotifications(userProfile.id); // Pass user ID to loadNotifications
      } catch (error) {
        console.error("Unexpected error during session check:", error);
        onLogout(); // Catch any unexpected errors and force logout
      }
    };

    checkSessionAndLoadUser();

    // Set up real-time notifications for the current user
    let notificationsChannel: any;
    if (currentUser?.id) { // This will re-run when currentUser is set by checkSessionAndLoadUser
      notificationsChannel = supabase
        .channel(`user_notifications_channel_${currentUser.id}`) // Use a unique channel name
        .on(
          "postgres_changes",
          {
            event: "*", // Listen for INSERT, UPDATE, DELETE
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${currentUser.id}`, // Filter by user_id as per schema
          },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              console.log("New user notification received:", payload.new?.message);
            } else {
              console.log("User notification change received, reloading:", payload);
            }
            loadNotifications(currentUser.id); // Reload notifications to update the list
          },
        )
        .subscribe();
    }

    return () => {
      if (notificationsChannel) {
        supabase.removeChannel(notificationsChannel);
      }
    }
  }, [userData, onLogout, currentUser?.id]) // Depend on currentUser?.id to trigger notification subscription setup

  const loadNotifications = async (userId: string) => { // Accept userId as parameter
    if (!userId) return

    const { data, error } = await supabase
      .from("user_notifications")
      .select("*")
      .eq("user_id", userId) // Corrected column name to user_id
      .order("created_at", { ascending: false }) // Corrected column name to created_at

    if (!error && data) {
      setNotifications(data as Notification[]) // Cast data to Notification[]
    } else if (error) {
      console.error("Error loading user notifications:", error);
    }
  }

  const handleSOSClick = () => {
    setShowSOSConfirm(true)
  }

  const confirmSOS = async () => {
    if (!location || !currentUser) {
      console.error("Location not available or user not logged in");
      return;
    }

    setIsEmergencyActive(true)
    setShowSOSConfirm(false)

    try {
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

      // Create emergency report using exact schema names
      const { data: reportData, error: reportError } = await supabase
        .from("emergency_reports")
        .insert({
          user_id: currentUser.id, // Matches schema
          firstName: currentUser.firstName, // Matches schema
          middleName: currentUser.middleName || null, // Matches schema
          lastName: currentUser.lastName, // Matches schema
          mobileNumber: currentUser.mobileNumber, // Matches schema
          latitude: location.lat, // Matches schema
          longitude: location.lng, // Matches schema
          location_address: locationAddress, // Matches schema
          emergency_type: "SOS", // Matches schema
          status: "active", // Changed status from "pending" to "active"
          created_at: new Date().toISOString(), // Matches schema
          reportedAt: new Date().toISOString(), // Matches your schema's 'reportedAt' column
          reporterMobile: currentUser.mobileNumber, // Matches schema
        })
        .select()
        .single()

      if (reportError) {
        console.error("Error creating report:", reportError)
        // Log the full error object for detailed debugging
        console.error("Supabase Report Insert Error Details:", reportError);
        console.error("Failed to send emergency alert: Please check Supabase RLS policies for 'emergency_reports' INSERT operation, or schema constraints.");
        return
      }

      // Create admin notification using exact schema names
      await supabase.from("admin_notifications").insert({
        emergency_report_id: reportData.id, // Matches schema
        message: `🚨 NEW EMERGENCY ALERT: ${currentUser.firstName} ${currentUser.lastName} needs help at ${locationAddress}`,
        is_read: false, // Matches schema
        type: 'new_report', // Matches schema
        created_at: new Date().toISOString(), // Use created_at for consistency with admin-dashboard.tsx and schema
      })

      console.log("Emergency alert sent successfully!")

      // Optionally, create a user notification for confirmation
      await supabase.from("user_notifications").insert({
        user_id: currentUser.id, // Corrected to user_id
        emergency_report_id: reportData.id, // Corrected to emergency_report_id
        message: "Your emergency alert has been sent. Help is on the way!",
        is_read: false, // Corrected to is_read
        created_at: new Date().toISOString(), // Corrected to created_at
      });


      setTimeout(() => {
        setIsEmergencyActive(false)
      }, 5000)
    } catch (error: any) {
      console.error("SOS Error:", error)
      console.error("Failed to send emergency alert: " + error.message);
      setIsEmergencyActive(false)
    }
  }

  const cancelSOS = () => {
    setShowSOSConfirm(false)
  }

  const handleLogout = async () => {
    console.log("LOGOUT FUNCTION CALLED!")
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error signing out from Supabase:", error);
      }
    } catch (err) {
      console.error("Unexpected error during Supabase signOut:", err);
    } finally {
      localStorage.removeItem("mdrrmo_user")
      setShowUserMenu(false)
      onLogout()
    }
  }

  const handleUserMenuClick = (e: React.MouseEvent) => {
    console.log("User menu clicked!")
    e.preventDefault()
    e.stopPropagation()
    setShowUserMenu(!showUserMenu)
  }

  const markAllAsRead = async () => {
    if (!currentUser) return;
    const { error } = await supabase
      .from("user_notifications")
      .update({ is_read: true })
      .eq("user_id", currentUser.id)
      .eq("is_read", false);
    if (!error) {
      loadNotifications(currentUser.id);
    } else {
      console.error("Error marking all as read:", error);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true }) // Corrected to is_read
      .eq('id', notificationId);

    if (error) {
      console.error("Error marking notification as read:", error);
    } else {
      loadNotifications(currentUser.id);
    }
  };

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
            <span className="font-medium">SORSU-Students</span>
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
                {notifications.filter((n) => !n.is_read).length > 0 && ( // Use is_read
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {notifications.filter((n) => !n.is_read).length} {/* Use is_read */}
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
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
            {notifications.some(n => !n.is_read) && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded-full ml-2"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent dropdown from closing
                  markAllAsRead();
                }}
              >
                Mark all as read
              </Button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-gray-500 text-center">No notifications</div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 ${!notification.is_read ? "bg-blue-50" : ""}`} // Use is_read
                  onClick={async () => {
                    await markNotificationAsRead(notification.id);
                  }} // Mark as read on click
                  style={{ cursor: 'pointer' }}
                >
                  <p className="text-sm text-gray-800">{notification.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(notification.created_at).toLocaleString()}</p> {/* Use created_at */}
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
            <span className="text-2xl mb-1">🖥️</span>
            <span className="text-sm font-medium">Copyright © 2025 MDRRMO-Bulan Sorsogon</span>
          </Button>
        </div>
      </div>
    </div>
  )
}