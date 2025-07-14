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
  recipientUserId: string;
  reportId?: string; // Optional: link to a specific report
  type?: string; // Optional: type of notification
}

interface Report {
  id: string;
  title: string;
  description: string;
  status: string; // e.g., 'pending', 'in-progress', 'resolved'
  reportedAt: string; // Supabase timestamps are typically ISO strings
  respondedAt?: string; // Supabase timestamps are typically ISO strings
  userId: string;
}

// Props for the DashboardPage component
interface DashboardPageProps {
  onLogout: () => void; // Function to handle logout
  userData: any; // User data passed from MobileApp.tsx
}

export default function DashboardPage({ onLogout, userData }: DashboardPageProps) {
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingAction, setIsLoadingAction] = useState(false); // For actions like marking as read

  // Set user data from props
  useEffect(() => {
    if (userData) {
      setUser(userData);
      setLoading(false); // User data is available, stop loading
    } else {
      // Fallback if userData is not immediately available (e.g., direct access without localStorage check)
      const storedUser = localStorage.getItem("mdrrmo_user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
        } catch (parseError) {
          console.error("Error parsing stored user data:", parseError);
          setError("Corrupted user data in local storage. Please log in again.");
          localStorage.removeItem("mdrrmo_user"); // Clear corrupted data
        }
      } else {
        setError("User not logged in. Please log in to view dashboard.");
      }
      setLoading(false);
    }
  }, [userData]);


  // Supabase Real-time Notifications Listener for User
  useEffect(() => {
    if (!user?.id) {
      // If user is not yet loaded, or not logged in, don't set up subscription
      return;
    }

    // Initial fetch of notifications for the current user
    const fetchInitialNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipientUserId', user.id) // Filter by recipient user ID
        .order('timestamp', { ascending: false });

      if (error) {
        console.error("Error fetching initial user notifications:", error);
        setError("Failed to load notifications.");
        return [];
      }
      return data || [];
    };

    // Set up real-time subscription
    const notificationsChannel = supabase
      .channel(`user_notifications_channel_${user.id}`) // Unique channel for each user
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'notifications',
          filter: `recipientUserId=eq.${user.id}` // Filter for current user's notifications
        },
        (payload) => {
          // Re-fetch all relevant notifications on any change
          fetchInitialNotifications().then(data => {
            const fetchedNotifications: Notification[] = data.map((item: any) => ({
              id: item.id,
              message: item.message,
              timestamp: item.timestamp,
              isRead: item.isRead,
              recipientUserId: item.recipientUserId,
              reportId: item.reportId,
              type: item.type,
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
        recipientUserId: item.recipientUserId,
        reportId: item.reportId,
        type: item.type,
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
  }, [user?.id]); // Re-run if user.id changes

  // Supabase Real-time Reports Listener for User
  useEffect(() => {
    if (!user?.id) {
      // If user is not yet loaded, or not logged in, don't set up subscription
      return;
    }

    // Initial fetch of user's reports
    const fetchInitialReports = async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('userId', user.id) // Filter by user ID
        .order('reportedAt', { ascending: false });

      if (error) {
        console.error("Error fetching initial user reports:", error);
        setError("Failed to load reports.");
        return [];
      }
      return data || [];
    };

    // Set up real-time subscription
    const reportsChannel = supabase
      .channel(`user_reports_channel_${user.id}`) // Unique channel for each user
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'reports',
          filter: `userId=eq.${user.id}` // Filter for current user's reports
        },
        (payload) => {
          // Re-fetch all reports on any change
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
            setReports(fetchedReports);
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
      setReports(fetchedReports);
    }).catch(err => {
      console.error("Error setting up initial reports:", err);
      setError("Failed to load reports.");
    });

    return () => {
      supabase.removeChannel(reportsChannel); // Clean up subscription
    };
  }, [user?.id]); // Re-run if user.id changes

  const markAllNotificationsAsRead = useCallback(async () => {
    if (!user?.id) return; // Ensure user is loaded

    setIsLoadingAction(true);
    try {
      // Update all unread notifications for the current user
      const { error } = await supabase
        .from('notifications')
        .update({ isRead: true })
        .eq('recipientUserId', user.id)
        .eq('isRead', false); // Only update unread ones

      if (error) {
        console.error("Error marking notifications as read:", error);
        setError("Failed to mark notifications as read.");
        return;
      }

      // Optimistic update of local state
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Error marking notifications as read:", err);
      setError("Failed to mark notifications as read.");
    } finally {
      setIsLoadingAction(false);
    }
  }, [user?.id, notifications]); // Dependency on user.id and notifications

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-lg">Loading Dashboard...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600 text-lg">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Welcome, {user?.firstName || "User"}!</h1>
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

      {/* Report History Section */}
      <Card className="shadow-lg rounded-lg">
        <CardHeader className="bg-orange-600 text-white rounded-t-lg">
          <CardTitle className="text-xl font-semibold">Your Report History</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {reports.length === 0 ? (
            <p className="text-gray-600">You haven't submitted any reports yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Report Title</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Reported At</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Responded At</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
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
