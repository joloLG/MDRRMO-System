"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { Bell, LogOut, CheckCircle, MapPin, Send, CheckSquare } from "lucide-react" // Added CheckSquare icon

// Define interfaces for data structures
interface Notification {
  id: string;
  emergency_report_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type: 'new_report' | 'report_update';
  reporterFirstName?: string;
  reporterLastName?: string;
  reporterMobileNumber?: string;
  reportLatitude?: number;
  reportLongitude?: number;
  reportLocationAddress?: string;
}

interface Report {
  id: string;
  user_id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  mobileNumber: string;
  latitude: number;
  longitude: number;
  location_address: string;
  emergency_type: string;
  status: string;
  admin_response?: string;
  created_at: string;
  responded_at?: string;
  resolved_at?: string; // Added resolved_at
  reportedAt: string;
  reporterMobile?: string;
}

// Props for the AdminDashboard component
interface AdminDashboardProps {
  onLogout: () => void;
  userData: any;
}

export function AdminDashboard({ onLogout, userData }: AdminDashboardProps) {
  const [adminUser, setAdminUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [activeEmergenciesCount, setActiveEmergenciesCount] = useState(0);
  const [respondedCount, setRespondedCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('TEAM 1');
  const [adminNotes, setAdminNotes] = useState<string>(''); // New state for admin notes

  // Set admin user data from props
  useEffect(() => {
    if (userData) {
      setAdminUser(userData);
      setLoading(false);
    } else {
      const storedUser = localStorage.getItem("mdrrmo_user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setAdminUser(parsedUser);
        } catch (parseError) {
          console.error("Error parsing stored user data:", parseError);
          setError("Corrupted user data in local storage. Please log in again.");
          localStorage.removeItem("mdrrmo_user");
        }
      } else {
        setError("Admin not logged in. Please log in as an administrator.");
      }
      setLoading(false);
    }
  }, [userData]);

  // Function to fetch notifications (used for initial load and real-time updates)
  const fetchAdminNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from('admin_notifications')
      .select(`
        *,
        emergency_report:emergency_report_id (
          id,
          firstName,
          lastName,
          mobileNumber,
          latitude,
          longitude,
          location_address,
          emergency_type,
          status,
          reportedAt,
          created_at,
          responded_at,
          resolved_at,
          user_id
        )
      `)
      .eq('type', 'new_report')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching admin notifications:", error);
      setError(`Failed to load notifications: ${error.message || 'Unknown error'}. Please check your Supabase RLS policies for 'admin_notifications' and 'emergency_reports' tables.`);
      return [];
    }

    const fetchedNotifications: Notification[] = data.map((item: any) => ({
      id: item.id,
      emergency_report_id: item.emergency_report_id,
      message: item.emergency_report ?
        `🚨 NEW EMERGENCY: ${item.emergency_report.firstName} ${item.emergency_report.lastName} at ${item.emergency_report.location_address || 'Unknown Location'}` :
        item.message,
      is_read: item.is_read,
      created_at: item.created_at,
      type: item.type,
      reporterFirstName: item.emergency_report?.firstName,
      reporterLastName: item.emergency_report?.lastName,
      reporterMobileNumber: item.emergency_report?.mobileNumber,
      reportLatitude: item.emergency_report?.latitude,
      reportLongitude: item.emergency_report?.longitude,
      reportLocationAddress: item.emergency_report?.location_address,
    }));

    return fetchedNotifications;
  }, []);

  // Supabase Real-time Notifications Listener for Admins
  useEffect(() => {
    fetchAdminNotifications().then(data => {
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    }).catch(err => {
      console.error("Error setting up initial notifications:", err);
      setError("Failed to load notifications.");
    });

    const notificationsChannel = supabase
      .channel('admin_notifications_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_notifications',
          filter: 'type=eq.new_report'
        },
        (payload) => {
          console.log("Admin notification received:", payload);
          fetchAdminNotifications().then(data => {
            setNotifications(data);
            setUnreadCount(data.filter((n) => !n.is_read).length);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
    };
  }, [fetchAdminNotifications]);


  // Function to fetch all reports (used for initial load and real-time updates)
  const fetchAllReports = useCallback(async () => {
    const { data, error } = await supabase
      .from('emergency_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching reports:", error);
      setError(`Failed to load reports: ${error.message || 'Unknown error'}. Please check your Supabase RLS policies for 'emergency_reports' table.`);
      return [];
    }
    return data || [];
  }, []);

  // Supabase Real-time Reports Listener for Admins
  useEffect(() => {
    fetchAllReports().then(data => {
      const fetchedReports: Report[] = data.map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        firstName: item.firstName,
        middleName: item.middleName,
        lastName: item.lastName,
        mobileNumber: item.mobileNumber,
        latitude: item.latitude,
        longitude: item.longitude,
        location_address: item.location_address,
        emergency_type: item.emergency_type,
        status: item.status,
        admin_response: item.admin_response,
        created_at: item.created_at,
        responded_at: item.responded_at,
        resolved_at: item.resolved_at,
        reportedAt: item.reportedAt,
        reporterMobile: item.reporterMobile,
      }));
      setAllReports(fetchedReports);

      setActiveEmergenciesCount(fetchedReports.filter(r => r.status === 'pending').length);
      setRespondedCount(fetchedReports.filter(r => r.status === 'in-progress').length);
      setResolvedCount(fetchedReports.filter(r => r.status === 'resolved').length);

      if (fetchedReports.length > 0 && !selectedReport) {
        setSelectedReport(fetchedReports[0]);
      }
    }).catch(err => {
      console.error("Error setting up initial reports:", err);
      setError("Failed to load reports.");
    });

    const reportsChannel = supabase
      .channel('all_reports_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_reports',
        },
        (payload) => {
          console.log("Report change received:", payload);
          fetchAllReports().then(data => {
            const fetchedReports: Report[] = data.map((item: any) => ({
              id: item.id,
              user_id: item.user_id,
              firstName: item.firstName,
              middleName: item.middleName,
              lastName: item.lastName,
              mobileNumber: item.mobileNumber,
              latitude: item.latitude,
              longitude: item.longitude,
              location_address: item.location_address,
              emergency_type: item.emergency_type,
              status: item.status,
              admin_response: item.admin_response,
              created_at: item.created_at,
              responded_at: item.responded_at,
              resolved_at: item.resolved_at,
              reportedAt: item.reportedAt,
              reporterMobile: item.reporterMobile,
            }));
            setAllReports(fetchedReports);

            setActiveEmergenciesCount(fetchedReports.filter(r => r.status === 'pending').length);
            setRespondedCount(fetchedReports.filter(r => r.status === 'in-progress').length);
            setResolvedCount(fetchedReports.filter(r => r.status === 'resolved').length);

            if (selectedReport && payload.eventType === 'UPDATE' && payload.new.id === selectedReport.id) {
              setSelectedReport(payload.new as Report);
            } else if (payload.eventType === 'INSERT' && !selectedReport) {
              setSelectedReport(payload.new as Report);
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reportsChannel);
    };
  }, [fetchAllReports, selectedReport]);

  const markAllNotificationsAsRead = useCallback(async () => {
    if (unreadCount === 0) return;

    setIsLoadingAction(true);
    try {
      const { error: updateError } = await supabase
        .from('admin_notifications')
        .update({ is_read: true })
        .eq('is_read', false);

      if (updateError) {
        console.error("Error marking admin notifications as read:", updateError);
        setError("Failed to mark notifications as read.");
      } else {
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    } catch (err: any) {
      console.error("Error marking notifications as read:", err);
      setError("Failed to mark notifications as read: " + err.message);
    } finally {
      setIsLoadingAction(false);
    }
  }, [unreadCount, notifications]);

  const handleReportClick = (report: Report) => {
    setSelectedReport(report);
    setAdminNotes(report.admin_response || ''); // Load existing admin notes
  };

  const handleNotificationClick = useCallback(async (notification: Notification) => {
    if (!notification.is_read) {
      const { error: updateError } = await supabase
        .from('admin_notifications')
        .update({ is_read: true })
        .eq('id', notification.id);

      if (updateError) {
        console.error("Error marking notification as read:", updateError);
        setError("Failed to mark notification as read.");
      } else {
        setNotifications(prev => prev.map(n =>
          n.id === notification.id ? { ...n, is_read: true } : n
        ));
        setUnreadCount(prev => prev > 0 ? prev - 1 : 0);
      }
    }

    if (notification.emergency_report_id) {
      const { data: reportData, error: reportError } = await supabase
        .from('emergency_reports')
        .select('*')
        .eq('id', notification.emergency_report_id)
        .single();

      if (reportError) {
        console.error("Error fetching report for notification:", reportError);
        setError(`Failed to load report details for notification: ${reportError.message || 'Unknown error'}. Please check your Supabase RLS policies for 'emergency_reports' SELECT operation.`);
      } else if (reportData) {
        setSelectedReport(reportData as Report);
        setAdminNotes(reportData.admin_response || ''); // Load notes when report is selected
      }
    }

    setShowNotificationsDropdown(false);
  }, []);

  const handleRespondToIncident = useCallback(async () => {
    if (!selectedReport) {
      setError("No report selected to respond to.");
      return;
    }
    setIsLoadingAction(true);
    setError(null);

    try {
      const { data: updatedReport, error: updateReportError } = await supabase
        .from('emergency_reports')
        .update({
          status: 'in-progress',
          admin_response: selectedTeam, // Store the selected team name
          responded_at: new Date().toISOString(),
        })
        .eq('id', selectedReport.id)
        .select()
        .single();

      if (updateReportError) {
        console.error("Error updating report status:", updateReportError);
        setError(`Failed to update report status: ${updateReportError.message}. Check RLS policies for 'emergency_reports' UPDATE.`);
        setIsLoadingAction(false);
        return;
      }

      setSelectedReport(updatedReport as Report);

      const userNotificationMessage = `Your emergency report (${selectedReport.emergency_type}) is OTW. Team ${selectedTeam} is responding.`;
      const { error: userNotificationError } = await supabase
        .from('user_notifications')
        .insert({
          user_id: selectedReport.user_id,
          emergency_report_id: selectedReport.id,
          message: userNotificationMessage,
          is_read: false,
          created_at: new Date().toISOString(),
        });

      if (userNotificationError) {
        console.error("Error sending user notification:", userNotificationError);
      }

      console.log(`Incident ${selectedReport.id} responded to by ${selectedTeam}. User notified.`);
      fetchAllReports();

    } catch (err: any) {
      console.error("Error responding to incident:", err);
      setError(`An unexpected error occurred: ${err.message}`);
    } finally {
      setIsLoadingAction(false);
    }
  }, [selectedReport, selectedTeam, fetchAllReports]);

  const handleResolveIncident = useCallback(async () => {
    if (!selectedReport) {
      setError("No report selected to resolve.");
      return;
    }
    setIsLoadingAction(true);
    setError(null);

    try {
      const { data: updatedReport, error: updateReportError } = await supabase
        .from('emergency_reports')
        .update({
          status: 'resolved', // Change status to 'resolved'
          admin_response: adminNotes, // Store admin notes here
          resolved_at: new Date().toISOString(), // Set resolved_at timestamp
        })
        .eq('id', selectedReport.id)
        .select()
        .single();

      if (updateReportError) {
        console.error("Error resolving report:", updateReportError);
        setError(`Failed to resolve report: ${updateReportError.message}. Check RLS policies for 'emergency_reports' UPDATE.`);
        setIsLoadingAction(false);
        return;
      }

      setSelectedReport(updatedReport as Report);

      const userNotificationMessage = `Your emergency report (${selectedReport.emergency_type}) has been resolved. Admin notes: ${adminNotes || 'N/A'}`;
      const { error: userNotificationError } = await supabase
        .from('user_notifications')
        .insert({
          user_id: selectedReport.user_id,
          emergency_report_id: selectedReport.id,
          message: userNotificationMessage,
          is_read: false,
          created_at: new Date().toISOString(),
        });

      if (userNotificationError) {
        console.error("Error sending user notification:", userNotificationError);
      }

      console.log(`Incident ${selectedReport.id} resolved. User notified.`);
      fetchAllReports();

    } catch (err: any) {
      console.error("Error resolving incident:", err);
      setError(`An unexpected error occurred: ${err.message}`);
    } finally {
      setIsLoadingAction(false);
    }
  }, [selectedReport, adminNotes, fetchAllReports]);


  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-lg">Loading Admin Dashboard...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600 text-lg">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Header */}
      <header className="bg-orange-600 text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold mr-2">MDRRMO Admin Dashboard</h1>
          <p className="text-orange-100 text-sm">Emergency Response Center</p>
        </div>
        <div className="relative">
          <Button
            onClick={() => setShowNotificationsDropdown(prev => !prev)}
            className="bg-orange-700 hover:bg-orange-800 text-white p-3 rounded-full relative"
          >
            <Bell size={24} />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 -mt-1 -mr-1 px-2 py-1 text-xs font-bold bg-red-500 rounded-full">
                {unreadCount}
              </span>
            )}
          </Button>
          {showNotificationsDropdown && (
            <Card className="absolute right-0 mt-2 w-80 bg-white shadow-lg rounded-lg z-20">
              <CardHeader className="bg-blue-600 text-white rounded-t-lg flex flex-row items-center justify-between p-3">
                <CardTitle className="text-base font-semibold">Emergency Notifications</CardTitle>
                {unreadCount > 0 && (
                  <Button
                    onClick={markAllNotificationsAsRead}
                    disabled={isLoadingAction}
                    className="bg-blue-800 hover:bg-blue-900 text-white text-xs py-1 px-2 rounded-full"
                  >
                    {isLoadingAction ? "Marking..." : "Mark All as Read"}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-3 max-h-60 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-gray-600 text-sm">No new notifications.</p>
                ) : (
                  <ul className="space-y-2">
                    {notifications.map((notification) => (
                      <li
                        key={notification.id}
                        className={`p-2 rounded-md text-sm cursor-pointer ${
                          !notification.is_read ? "bg-blue-50 border border-blue-200 font-medium" : "bg-gray-50 text-gray-600"
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <p>{notification.message}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
          <Button
            onClick={onLogout}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md ml-4 flex items-center"
          >
            <LogOut size={20} className="mr-2" /> Logout
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column - Emergency Stats */}
        <div className="md:col-span-2 grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <Card className="shadow-lg rounded-lg">
            <CardHeader className="bg-red-500 text-white rounded-t-lg">
              <CardTitle className="text-xl font-semibold flex items-center">
                Active Emergencies <Bell className="ml-2" size={20} />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-center">
              <p className="text-5xl font-bold text-red-600">{activeEmergenciesCount}</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg rounded-lg">
            <CardHeader className="bg-yellow-500 text-white rounded-t-lg">
              <CardTitle className="text-xl font-semibold flex items-center">
                Responded <CheckCircle className="ml-2" size={20} />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-center">
              <p className="text-5xl font-bold text-yellow-600">{respondedCount}</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg rounded-lg">
            <CardHeader className="bg-green-500 text-white rounded-t-lg">
              <CardTitle className="text-xl font-semibold flex items-center">
                Resolved <CheckCircle className="ml-2" size={20} />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-center">
              <p className="text-5xl font-bold text-green-600">{resolvedCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Location Map and Respond/Resolve Incident */}
        <div className="md:col-span-1 space-y-8">
          <Card className="shadow-lg rounded-lg">
            <CardHeader className="bg-purple-600 text-white rounded-t-lg">
              <CardTitle className="text-xl font-semibold">Location Map</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {selectedReport ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <MapPin size={48} className="mx-auto text-purple-600 mb-2" />
                    <h3 className="text-lg font-semibold text-gray-800">{selectedReport.firstName} {selectedReport.lastName}</h3>
                    <p className="text-gray-600 text-sm">{selectedReport.location_address}</p>
                  </div>
                  <div className="text-center">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedReport.latitude},${selectedReport.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Open in Google Maps
                    </a>
                  </div>
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-semibold text-gray-700">Contact Information</h4>
                    <p className="text-gray-600 text-sm">{selectedReport.mobileNumber || "N/A"}</p>
                  </div>

                  {/* Admin Notes Field */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-semibold text-gray-700 mb-2">Admin Notes:</h4>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add notes about the incident..."
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 resize-y"
                      rows={3}
                    ></textarea>
                  </div>

                  {/* Respond to Incident Section (Visible if status is 'pending') */}
                  {selectedReport.status === 'pending' && (
                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-semibold text-gray-700 mb-3">Respond to Incident</h4>
                      <div className="flex flex-col space-y-3">
                        <label htmlFor="response-team" className="text-sm font-medium text-gray-700">Select Team:</label>
                        <select
                          id="response-team"
                          value={selectedTeam}
                          onChange={(e) => setSelectedTeam(e.target.value)}
                          className="p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="TEAM 1">TEAM 1</option>
                          <option value="TEAM 2">TEAM 2</option>
                          <option value="TEAM 3">TEAM 3</option>
                        </select>
                        <Button
                          onClick={handleRespondToIncident}
                          disabled={isLoadingAction}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center"
                        >
                          <Send size={20} className="mr-2" />
                          {isLoadingAction ? "Responding..." : "Respond to Incident"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Resolve Incident Section (Visible if status is 'in-progress') */}
                  {selectedReport.status === 'in-progress' && (
                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-semibold text-gray-700 mb-3">Resolve Incident</h4>
                      <Button
                        onClick={handleResolveIncident}
                        disabled={isLoadingAction}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center"
                      >
                        <CheckSquare size={20} className="mr-2" />
                        {isLoadingAction ? "Resolving..." : "Mark as Resolved"}
                      </Button>
                    </div>
                  )}

                </div>
              ) : (
                <p className="text-gray-600 text-center">Select a report from the table to view its location.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section - All Reports History */}
        <div className="md:col-span-3">
          <Card className="shadow-lg rounded-lg">
            <CardHeader className="bg-orange-600 text-white rounded-t-lg">
              <CardTitle className="text-xl font-semibold">All Report History</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {allReports.length === 0 ? (
                <p className="text-gray-600">No reports have been submitted yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Report Type</th>
                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Status</th>
                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Reported By</th>
                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Contact</th>
                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Reported At</th>
                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Responded At</th>
                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Resolved At</th> {/* Added Resolved At */}
                      </tr>
                    </thead>
                    <tbody>
                      {allReports.map((report) => (
                        <tr
                          key={report.id}
                          className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50 cursor-pointer"
                          onClick={() => handleReportClick(report)}
                        >
                          <td className="py-3 px-4 text-sm text-gray-800">{report.emergency_type}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              report.status === 'resolved' ? 'bg-green-100 text-green-800' :
                              report.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800' // Pending status
                            }`}>
                              {report.status === 'in-progress' ? `OTW (${report.admin_response})` : report.status} {/* Show OTW with team */}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-800">{report.firstName} {report.lastName}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{report.mobileNumber || "N/A"}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{new Date(report.reportedAt).toLocaleString()}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">
                            {report.responded_at ? new Date(report.responded_at).toLocaleString() : "N/A"}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-800">
                            {report.resolved_at ? new Date(report.resolved_at).toLocaleString() : "N/A"} {/* Display resolved_at */}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
