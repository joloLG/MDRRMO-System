"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { Bell, LogOut, CheckCircle, MapPin, Send, Map, Menu, FileText } from "lucide-react"
import { Sidebar } from "@/components/sidebar"

// Removed imports for DataManagement, ChartsDashboard, MakeReportForm as they are now separate pages

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
  resolved_at?: string;
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
  const [barangay, setBarangay] = useState<string>('');
  // Removed activeMenu state as it's no longer needed for main content switching

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

  // Consolidated Real-time Listener for Reports and Notifications
  useEffect(() => {
    const fetchAllDashboardData = async () => {
      try {
        const [reportsData, notificationsData] = await Promise.all([
          fetchAllReports(),
          fetchAdminNotifications(),
        ]);

        setAllReports(reportsData.map((item: any) => ({ ...item })));
        setActiveEmergenciesCount(reportsData.filter(r => r.status.trim().toLowerCase() === 'pending' || r.status.trim().toLowerCase() === 'active').length);
        setRespondedCount(reportsData.filter(r => r.status.trim().toLowerCase() === 'responded').length);
        setResolvedCount(reportsData.filter(r => r.status.trim().toLowerCase() === 'resolved').length);

        setNotifications(notificationsData);
        setUnreadCount(notificationsData.filter(n => !n.is_read).length);

      } catch (err: any) {
        console.error("Error fetching dashboard data:", err);
        setError(`Failed to load dashboard data: ${err.message}`);
      }
    };

    fetchAllDashboardData();

    // Set up real-time channel for emergency_reports
    const reportsChannel = supabase
      .channel('emergency-reports-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'emergency_reports' },
        (payload) => {
          console.log('Change received on emergency_reports, refetching all dashboard data:', payload);
          fetchAllDashboardData();
        }
      )
      .subscribe();

    // Set up real-time channel for admin_notifications
    const adminNotificationsChannel = supabase
      .channel('admin-notifications-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_notifications' },
        (payload) => {
          console.log('Change received on admin_notifications, refetching all dashboard data:', payload);
          fetchAllDashboardData();
        }
      )
      .subscribe();

    // Cleanup subscriptions on component unmount
    return () => {
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(adminNotificationsChannel);
    };
  }, [fetchAllReports, fetchAdminNotifications]);

  // Effect to get barangay from coordinates
  useEffect(() => {
    if (selectedReport?.latitude && selectedReport?.longitude) {
      setBarangay('Fetching...');
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${selectedReport.latitude}&lon=${selectedReport.longitude}`)
        .then(response => response.json())
        .then(data => {
          console.log('Reverse Geocoding API Response:', data);
          const address = data.address;
          const barangayName = address?.village || address?.suburb || address?.neighbourhood || address?.quarter || address?.city_district || 'N/A';
          setBarangay(barangayName);
        })
        .catch(error => {
          console.error('Error fetching barangay:', error);
          setBarangay('Unavailable');
        });
    }
  }, [selectedReport]);


const markAllNotificationsAsRead = useCallback(async () => {
  if (unreadCount === 0) return;
  const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
  if (unreadIds.length === 0) return;

  setIsLoadingAction(true);
  const { error } = await supabase
    .from('admin_notifications')
    .update({ is_read: true })
    .in('id', unreadIds);

  if (error) {
    console.error("Error marking all as read:", error);
    setError("Failed to mark all notifications as read.");
  } else {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }
  setIsLoadingAction(false);
}, [notifications, unreadCount]);

  const handleReportClick = (report: Report) => {
    setSelectedReport(report);
    // No need to set activeMenu here, as main dashboard is the only view
  };

  const handleNotificationClick = useCallback(async (notification: Notification) => {
    if (!notification.is_read) {
      const { error } = await supabase.from('admin_notifications').update({ is_read: true }).eq('id', notification.id);
      if (error) {
        console.error('Error marking notification as read:', error);
      } else {
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
    if (notification.emergency_report_id) {
      const report = allReports.find(r => r.id === notification.emergency_report_id);
      if (report) {
        handleReportClick(report);
      }
    }
    setShowNotificationsDropdown(false);
  }, [allReports]);

  const handleRespondToIncident = useCallback(async () => {
    if (!selectedReport) return;
    setIsLoadingAction(true);
    setError(null);
    try {
      const responseMessage = `Team ${selectedTeam} is responding.`;
      const { data: updatedReport, error: updateError } = await supabase.from('emergency_reports').update({ status: 'responded', admin_response: responseMessage, responded_at: new Date().toISOString() }).eq('id', selectedReport.id).select().single();
      if (updateError) throw updateError;

      const { error: notificationError } = await supabase.from('user_notifications').insert({ user_id: selectedReport.user_id, emergency_report_id: selectedReport.id, message: `Your emergency report for ${selectedReport.emergency_type} is OTW. Team ${selectedTeam} is responding.` });
      if (notificationError) console.error('Error sending user notification:', notificationError);

      await fetchAllReports();
      setSelectedReport(updatedReport as Report);
    } catch (err: any) {
      setError(`Failed to respond: ${err.message}. Check RLS policies.`);
    } finally {
      setIsLoadingAction(false);
    }
  }, [selectedReport, selectedTeam, fetchAllReports]);

  const handleRescueDone = useCallback(async () => {
    if (!selectedReport) return;
    setIsLoadingAction(true);
    setError(null);
    try {
      const { data: updatedReport, error: updateError } = await supabase
        .from('emergency_reports')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', selectedReport.id)
        .select()
        .single();
      if (updateError) throw updateError;

      const { error: notificationError } = await supabase.from('user_notifications').insert({
        user_id: selectedReport.user_id,
        emergency_report_id: selectedReport.id,
        message: 'The Rescue Operation is successful. Thank you for reporting an incident! Take care always!',
      });
      if (notificationError) console.error('Error sending user notification:', notificationError);

      setSelectedReport(updatedReport as Report);
    } catch (err: any) {
      setError(`Failed to mark as resolved: ${err.message}. Check RLS policies.`);
    } finally {
      setIsLoadingAction(false);
    }
  }, [selectedReport]);

  // This handleMakeReport is for the context-specific button (resolved incidents)
  const handleMakeReport = () => {
    if (selectedReport?.id) {
      // Open the Make Report page in a new tab, passing the incident ID as a query parameter
      window.open(`/admin/report?incidentId=${selectedReport.id}`, '_blank');
    } else {
      console.warn("No selected report to make a specific report for.");
    }
  };

  // Removed handleSidebarMenuItemClick as it's no longer needed for internal menu switching

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen text-red-500 font-sans">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center">
          {/* Removed onMenuItemClick prop */}
          <Sidebar />
          <h1 className="text-3xl font-bold text-gray-800 ml-4">Admin Dashboard</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}>
              <Bell className="h-6 w-6" />
              {unreadCount > 0 && <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
            </Button>
            {showNotificationsDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl z-20">
                <div className="p-4 font-bold border-b">Notifications</div>
                <ul className="max-h-96 overflow-y-auto">
                  {notifications.length > 0 ? notifications.map(n => (
                    <li key={n.id} onClick={() => handleNotificationClick(n)} className={`p-4 border-b hover:bg-gray-100 cursor-pointer ${!n.is_read ? 'font-semibold bg-blue-50' : ''}`}>
                      <p className="text-sm text-gray-700">{n.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                    </li>
                  )) : <li className="p-4 text-center text-gray-500">No new notifications.</li>}
                </ul>
                {notifications.length > 0 && (
                  <div className="p-2 border-t">
                    <Button
                      variant="link"
                      className="w-full"
                      onClick={markAllNotificationsAsRead}
                      disabled={isLoadingAction || unreadCount === 0}
                    >
                      Mark all as read
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <Button onClick={onLogout} variant="destructive"><LogOut className="mr-2 h-4 w-4" /> Logout</Button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow"><CardHeader><CardTitle>Active Emergencies</CardTitle></CardHeader><CardContent><p className="text-4xl font-bold text-red-600">{activeEmergenciesCount}</p></CardContent></Card>
            <Card className="shadow"><CardHeader><CardTitle>In-Progress</CardTitle></CardHeader><CardContent><p className="text-4xl font-bold text-yellow-600">{respondedCount}</p></CardContent></Card>
            <Card className="shadow"><CardHeader><CardTitle>Resolved Today</CardTitle></CardHeader><CardContent><p className="text-4xl font-bold text-green-600">{resolvedCount}</p></CardContent></Card>
        </div>

        {/* The main dashboard content remains here, as it's the default view */}
        <>
            <div className="lg:col-span-2">
              <Card className="shadow-lg h-full">
                <CardHeader className="bg-gray-800 text-white"><CardTitle className="flex items-center"><MapPin className="mr-3" />Incident Details & Actions</CardTitle></CardHeader>
                <CardContent className="p-6">
                  {selectedReport ? (
                    <div>
                      <h3 className="text-2xl font-bold mb-2">{selectedReport.emergency_type}</h3>
                      <p className="text-gray-600 mb-4">Reported by: <span className="font-medium">{selectedReport.firstName} {selectedReport.lastName}</span></p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                          <p className="text-sm text-gray-500">Location</p>
                          <div className="flex items-center">
                            <p className="font-semibold">{selectedReport.location_address}</p>
                            <Button
                              variant="link"
                              size="icon"
                              className="ml-2 h-5 w-5"
                              onClick={() => window.open(`http://maps.google.com/maps?q=${selectedReport.latitude},${selectedReport.longitude}`, '_blank')}
                            >
                              <Map className="h-5 w-5 text-blue-600" />
                            </Button>
                          </div>
                        </div>
                        <div><p className="text-sm text-gray-500">Barangay</p><p className="font-semibold">{barangay}</p></div>
                        <div><p className="text-sm text-gray-500">Contact</p><p className="font-semibold">{selectedReport.mobileNumber}</p></div>
                        <div><p className="text-sm text-gray-500">Reported At</p><p className="font-semibold">{new Date(selectedReport.created_at).toLocaleString()}</p></div>
                        <div><p className="text-sm text-gray-500">Status</p><p className={`font-bold ${selectedReport.status.trim().toLowerCase() === 'pending' || selectedReport.status.trim().toLowerCase() === 'active' ? 'text-red-600' : selectedReport.status.trim().toLowerCase() === 'responded' ? 'text-yellow-600' : 'text-green-600'}`}>{selectedReport.status}</p></div>
                      </div>
                      <div className="p-4 border rounded-lg bg-gray-50 mb-6">
                        <h4 className="font-semibold mb-3">Incident Actions</h4>
                        {(selectedReport.status.trim().toLowerCase() === 'pending' || selectedReport.status.trim().toLowerCase() === 'active') && (
                          <div className="space-y-4">
                            <div>
                              <label htmlFor="team-select" className="block text-sm font-medium mb-1">Select response team:</label>
                              <select id="team-select" value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="w-full p-2 border rounded-md shadow-sm"><option>TEAM 1</option><option>TEAM 2</option><option>TEAM 3</option></select>
                            </div>
                            <Button onClick={handleRespondToIncident} disabled={isLoadingAction} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center"><Send size={18} className="mr-2" />{isLoadingAction ? 'Responding...' : 'Respond'}</Button>
                          </div>
                        )}
                        {selectedReport.status.trim().toLowerCase() === 'responded' && (
                            <Button onClick={handleRescueDone} disabled={isLoadingAction} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center"><CheckCircle size={18} className="mr-2" />{isLoadingAction ? 'Resolving...' : 'Rescue Done'}</Button>
                        )}
                        {/* Make a Report Button - Only for resolved incidents */}
                        {selectedReport.status.trim().toLowerCase() === 'resolved' && (
                          <Button
                            onClick={handleMakeReport} // This will now open the Make Report page in a new tab
                            disabled={isLoadingAction}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center mt-4"
                          >
                            <FileText size={18} className="mr-2" /> Make a Report
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full"><p className="text-gray-500">Select a report to view details.</p></div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="shadow-lg h-full">
                <CardHeader className="bg-gray-800 text-white"><CardTitle>All Reports</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <tbody className="bg-white divide-y divide-gray-200">
                        {allReports.map((report) => (
                          <tr key={report.id} onClick={() => handleReportClick(report)} className={`hover:bg-gray-100 cursor-pointer ${selectedReport?.id === report.id ? 'bg-blue-100' : ''}`}>
                            <td className="px-4 py-3 whitespace-nowrap"><div className="text-sm font-medium">{report.firstName} {report.lastName}</div><div className="text-xs text-gray-500">{report.emergency_type}</div></td>
                            <td className="px-4 py-3 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${(report.status.trim().toLowerCase() === 'pending' || report.status.trim().toLowerCase() === 'active') ? 'bg-red-100 text-red-800' : report.status.trim().toLowerCase() === 'responded' ? 'bg-yellow-100 text-yellow-800' : report.status.trim().toLowerCase() === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{report.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
      </main>
    </div>
  );
}