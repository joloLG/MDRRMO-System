"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase" // Assuming supabase is already configured
import { Bell, CheckCircle, LogOut } from "lucide-react" // Added LogOut icon

// Define interfaces for data structures
interface Notification {
  id: string;
  message: string;
  timestamp: string; // Supabase timestamps are typically ISO strings
  isRead: boolean;
  type: 'new_report' | 'report_update'; // Admin-specific notification types
  reportId?: string; // Optional: link to a specific report
}

interface Report {
  id: string;
  title: string;
  description: string;
  status: string; // e.g., 'pending', 'in-progress', 'resolved'
  reportedAt: string; // Supabase timestamps are typically ISO strings
  respondedAt?: string; // Supabase timestamps are typically ISO strings
  userId: string; // ID of the user who reported
}

// Props for the AdminDashboard component
interface AdminDashboardProps { // Renamed from AdminDashboardPageProps for consistency with named export
  onLogout: () => void; // Function to handle logout
  userData: any; // User data passed from MobileApp.tsx
}

// Changed to named export 'AdminDashboard'
export function AdminDashboard({ onLogout, userData }: AdminDashboardProps) {
  const [adminUser, setAdminUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingAction, setIsLoadingAction] = useState(false); // For actions like marking as read

  // Set admin user data from props
  useEffect(() => {
    if (userData) {
      setAdminUser(userData);
      // You might still add a check here to ensure the user actually has admin privileges
      // e.g., if (userData.user_type !== 'admin') { setError("Access Denied"); }
      setLoading(false); // User data is available, stop loading
    } else {
      // Fallback if userData is not immediately available (e.g., direct access without localStorage check)
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


  // Supabase Real-time Notifications Listener for Admins
  useEffect(() => {
    // Initial fetch of notifications
    const fetchInitialNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('type', 'new_report') // Admins get notifications for new reports
        .order('timestamp', { ascending: false });

      if (error) {
        console.error("Error fetching initial admin notifications:", error);
        setError("Failed to load notifications.");
        return [];
      }
      return data || [];
    };

    // Set up real-time subscription
    const notificationsChannel = supabase
      .channel('admin_notifications_channel')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'notifications',
          filter: 'type=eq.new_report' // Filter for new_report type
        },
        (payload) => {
          // Handle real-time changes
          // For simplicity, re-fetch all relevant notifications on any change
          fetchInitialNotifications().then(data => {
            const fetchedNotifications: Notification[] = data.map((item: any) => ({
              id: item.id,
              message: item.message,
              timestamp: item.timestamp,
              isRead: item.isRead,
              type: item.type,
              reportId: item.reportId,
            }));
            setNotifications(fetchedNotifications);
            setUnreadCount(fetchedNotifications.filter((n) => !n.isRead).length);
          });
        }
      )
      .subscribe();

    // Fetch initial data and then let real-time updates handle subsequent changes
    fetchInitialNotifications().then(data => {
      const fetchedNotifications: Notification[] = data.map((item: any) => ({
        id: item.id,
        message: item.message,
        timestamp: item.timestamp,
        isRead: item.isRead,
        type: item.type,
        reportId: item.reportId,
      }));
      setNotifications(fetchedNotifications);
      setUnreadCount(fetchedNotifications.filter((n) => !n.isRead).length);
    }).catch(err => {
      console.error("Error setting up initial notifications:", err);
      setError("Failed to load notifications.");
    });

    return () => {
      supabase.removeChannel(notificationsChannel); // Clean up subscription
    };
  }, []); // Empty dependency array means this runs once on mount

  // Supabase Real-time Reports Listener for Admins
  useEffect(() => {
    // Initial fetch of all reports
    const fetchInitialReports = async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('reportedAt', { ascending: false });

      if (error) {
        console.error("Error fetching initial reports:", error);
        setError("Failed to load reports.");
        return [];
      }
      return data || [];
    };

    // Set up real-time subscription
    const reportsChannel = supabase
      .channel('all_reports_channel')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'reports',
        },
        (payload) => {
          // For simplicity, re-fetch all reports on any change
          fetchInitialReports().then(data => {
            const fetchedReports: Report[] = data.map((item: any) => ({
              id: item.id,
              title: item.title,
              description: item.description,
              status: item.status,
              reportedAt: item.reportedAt,
              respondedAt: item.respondedAt,
              userId: item.userId,
            }));
            setAllReports(fetchedReports);
          });
        }
      )
      .subscribe();

    // Fetch initial data and then let real-time updates handle subsequent changes
    fetchInitialReports().then(data => {
      const fetchedReports: Report[] = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        status: item.status,
        reportedAt: item.reportedAt,
        respondedAt: item.respondedAt,
        userId: item.userId,
      }));
      setAllReports(fetchedReports);
    }).catch(err => {
      console.error("Error setting up initial reports:", err);
      setError("Failed to load reports.");
    });

    return () => {
      supabase.removeChannel(reportsChannel); // Clean up subscription
    };
  }, []); // Empty dependency array means this runs once on mount

  const markAllNotificationsAsRead = useCallback(async () => {
    setIsLoadingAction(true);
    try {
      // Update all unread notifications for admins (type 'new_report')
      const { error: updateError } = await supabase // Corrected syntax here
        .from('notifications')
        .update({ isRead: true })
        .eq('type', 'new_report')
        .eq('isRead', false); // Only update unread ones

      if (updateError) {
        console.error("Error marking admin notifications as read:", updateError);
        setError("Failed to mark notifications as read.");
        return;
      }

      // Optimistic update of local state
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err: any) { // Added type annotation for 'err'
      console.error("Error marking admin notifications as read:", err);
      setError("Failed to mark notifications as read: " + err.message); // Added message for clarity
    } finally {
      setIsLoadingAction(false);
    }
  }, [notifications]); // Dependency on notifications to ensure correct filter for unread


  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-lg">Loading Admin Dashboard...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600 text-lg">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
        <Button
          onClick={onLogout}
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md flex items-center"
        >
          <LogOut size={20} className="mr-2" /> Logout
        </Button>
      </div>

      {/* Notifications Section */}
      <Card className="mb-8 shadow-lg rounded-lg">
        <CardHeader className="bg-blue-600 text-white rounded-t-lg flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center">
            <Bell className="mr-2" size={24} /> Notifications
            {unreadCount > 0 && (
              <span className="ml-2 px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-full">
                {unreadCount} Unread
              </span>
            )}
          </CardTitle>
          {unreadCount > 0 && (
            <Button
              onClick={markAllNotificationsAsRead}
              disabled={isLoadingAction}
              className="bg-blue-800 hover:bg-blue-900 text-white text-sm py-1 px-3 rounded-full flex items-center"
            >
              <CheckCircle size={16} className="mr-1" />
              {isLoadingAction ? "Marking..." : "Mark All as Read"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-6">
          {notifications.length === 0 ? (
            <p className="text-gray-600">No new notifications.</p>
          ) : (
            <ul className="space-y-3">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`p-3 rounded-lg flex items-center ${
                    !notification.isRead ? "bg-blue-50 border border-blue-200 font-medium" : "bg-gray-50 text-gray-600"
                  }`}
                >
                  <span className="flex-grow">{notification.message}</span>
                  <span className="text-xs text-gray-500 ml-4">
                    {new Date(notification.timestamp).toLocaleString()} {/* Convert ISO string to Date */}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* All Reports History Section */}
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
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Report Title</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Reported By</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Reported At</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Responded At</th>
                  </tr>
                </thead>
                <tbody>
                  {allReports.map((report) => (
                    <tr key={report.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-800">{report.title}</td>
                      <td className="py-3 px-4 text-sm text-gray-800">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          report.status === 'resolved' ? 'bg-green-100 text-green-800' :
                          report.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800">{report.userId}</td> {/* Displaying user ID for now */}
                      <td className="py-3 px-4 text-sm text-gray-800">{new Date(report.reportedAt).toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-gray-800">
                        {report.respondedAt ? new Date(report.respondedAt).toLocaleString() : "N/A"}
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
  );
}
