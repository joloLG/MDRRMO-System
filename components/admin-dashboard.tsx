"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bell, MapPin, User, Phone, Clock, CheckCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface AdminDashboardProps {
  onLogout: () => void
  userData: any
}

export function AdminDashboard({ onLogout, userData }: AdminDashboardProps) {
  const [notifications, setNotifications] = useState<any[]>([])
  const [emergencyReports, setEmergencyReports] = useState<any[]>([])
  const [selectedReport, setSelectedReport] = useState<any>(null)
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    loadNotifications()
    loadEmergencyReports()

    // Set up real-time notifications
    const channel = supabase
      .channel("admin_notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admin_notifications",
        },
        (payload) => {
          console.log("New admin notification:", payload)
          loadNotifications()
          loadEmergencyReports()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadNotifications = async () => {
    const { data, error } = await supabase
      .from("admin_notifications")
      .select(`
        *,
        emergency_reports (
          id,
          firstName,
          lastName,
          latitude,
          longitude,
          location_address,
          status,
          created_at
        )
      `)
      .order("created_at", { ascending: false })

    if (!error && data) {
      setNotifications(data)
    }
  }

  const loadEmergencyReports = async () => {
    const { data, error } = await supabase
      .from("emergency_reports")
      .select("*")
      .order("created_at", { ascending: false })

    if (!error && data) {
      setEmergencyReports(data)
    }
  }

  const handleRespondToEmergency = async (reportId: string) => {
    try {
      // Update report status
      const { error: updateError } = await supabase
        .from("emergency_reports")
        .update({
          status: "responded",
          responded_at: new Date().toISOString(),
          admin_response: "Emergency team dispatched",
        })
        .eq("id", reportId)

      if (updateError) {
        console.error("Error updating report:", updateError)
        return
      }

      // Get the report details
      const report = emergencyReports.find((r) => r.id === reportId)
      if (!report) return

      // Send notification to user
      await supabase.from("user_notifications").insert({
        user_id: report.user_id,
        emergency_report_id: reportId,
        message: "🚨 MDRRMO Emergency Team is on the Way! Stay calm and safe.",
      })

      // Mark admin notification as read
      await supabase.from("admin_notifications").update({ is_read: true }).eq("emergency_report_id", reportId)

      // Reload data
      loadNotifications()
      loadEmergencyReports()

      alert("Response sent to user!")
    } catch (error) {
      console.error("Error responding to emergency:", error)
      alert("Failed to send response")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-red-500"
      case "responded":
        return "bg-yellow-500"
      case "resolved":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-orange-500 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">MDRRMO Admin Dashboard</h1>
            <p className="text-orange-100">Emergency Response Center</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-orange-600 rounded transition-colors"
            >
              <Bell className="w-6 h-6" />
              {notifications.filter((n) => !n.is_read).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {notifications.filter((n) => !n.is_read).length}
                </span>
              )}
            </button>
            <Button
              onClick={onLogout}
              variant="outline"
              className="text-white border-white hover:bg-orange-600 bg-transparent"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Statistics Cards */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Emergencies</p>
                    <p className="text-2xl font-bold text-red-600">
                      {emergencyReports.filter((r) => r.status === "active").length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <Bell className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Responded</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {emergencyReports.filter((r) => r.status === "responded").length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Resolved</p>
                    <p className="text-2xl font-bold text-green-600">
                      {emergencyReports.filter((r) => r.status === "resolved").length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Emergency Reports List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Emergency Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {emergencyReports.map((report) => (
                    <div
                      key={report.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedReport(report)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">
                              {report.firstName} {report.middleName} {report.lastName}
                            </span>
                            <Badge className={`${getStatusColor(report.status)} text-white`}>
                              {report.status.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                            <Phone className="w-4 h-4" />
                            <span>{report.mobileNumber}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                            <MapPin className="w-4 h-4" />
                            <span>{report.location_address}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4" />
                            <span>{new Date(report.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                        {report.status === "active" && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRespondToEmergency(report.id)
                            }}
                            className="bg-green-500 hover:bg-green-600"
                            size="sm"
                          >
                            Respond
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Map View */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Location Map</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedReport ? (
                  <div className="space-y-4">
                    <div className="bg-gray-100 rounded-lg p-4 h-64 flex items-center justify-center">
                      <div className="text-center">
                        <MapPin className="w-12 h-12 text-red-500 mx-auto mb-2" />
                        <p className="font-medium">
                          {selectedReport.firstName} {selectedReport.lastName}
                        </p>
                        <p className="text-sm text-gray-600">{selectedReport.location_address}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          Lat: {selectedReport.latitude}
                          <br />
                          Lng: {selectedReport.longitude}
                        </p>
                        <a
                          href={`https://www.google.com/maps?q=${selectedReport.latitude},${selectedReport.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-2 text-blue-500 hover:underline text-sm"
                        >
                          Open in Google Maps
                        </a>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Contact Information</h4>
                      <p className="text-sm">
                        <strong>Name:</strong> {selectedReport.firstName} {selectedReport.middleName}{" "}
                        {selectedReport.lastName}
                      </p>
                      <p className="text-sm">
                        <strong>Phone:</strong> {selectedReport.mobileNumber}
                      </p>
                      <p className="text-sm">
                        <strong>Status:</strong> {selectedReport.status}
                      </p>
                      <p className="text-sm">
                        <strong>Time:</strong> {new Date(selectedReport.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    Select an emergency report to view location
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div className="fixed top-20 right-4 bg-white rounded-lg shadow-xl border border-gray-200 w-80 max-h-96 overflow-y-auto z-50">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800">Emergency Notifications</h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-gray-500 text-center">No notifications</div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${!notification.is_read ? "bg-red-50" : ""}`}
                  onClick={() => {
                    if (notification.emergency_reports) {
                      setSelectedReport(notification.emergency_reports)
                      setShowNotifications(false)
                    }
                  }}
                >
                  <p className="text-sm text-gray-800">{notification.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(notification.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
