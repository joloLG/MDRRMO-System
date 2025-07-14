"use client"

import { useState, useEffect } from "react" // Removed useCallback
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { Bell, LogOut } from "lucide-react" // Removed CheckCircle

// Define interfaces for data structures
interface Notification {
  id: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  type: 'new_report' | 'report_update';
  reportId?: string;
}

interface Report {
  id: string;
  title: string;
  description: string;
  status: string;
  reportedAt: string;
  respondedAt?: string;
  userId: string;
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

  // Fetch Admin Notifications once on load (NOT real-time)
  useEffect(() => {
    const fetchAdminNotifications = async () => {
      const { data, error } = await supabase
        .from('admin_notifications') // Corrected table name
        .select('*')
        .eq('type', 'new_report')
        .order('timestamp', { ascending: false });

      if (error) {
        console.error("Error fetching initial admin notifications:", error);
        setError("Failed to load notifications.");
      } else {
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
      }
    };
    fetchAdminNotifications();
  }, []); // Empty dependency array to fetch once on mount

  // Fetch All Reports once on load (NOT real-time)
  useEffect(() => {
    const fetchAllReports = async () => {
      const { data, error } = await supabase
        .from('emergency_reports') // Corrected table name
        .select('*')
        .order('reportedAt', { ascending: false });

      if (error) {
        console.error("Error fetching initial reports:", error);
        setError("Failed to load reports.");
      } else {
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
      }
    };
    fetchAllReports();
  }, []); // Empty dependency array to fetch once on mount

  // Removed markAllNotificationsAsRead function as it was part of real-time / new features

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

      {/* Notifications Section (No Mark All as Read button) */}
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
          {/* Mark All as Read button removed */}
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
                    {new Date(notification.timestamp).toLocaleString()}
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
                      <td className="py-3 px-4 text-sm text-gray-800">{report.userId}</td>
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
