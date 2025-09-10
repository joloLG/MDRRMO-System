"use client"

import { useState, useEffect, useCallback } from "react"
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { Bell, LogOut, CheckCircle, MapPin, Send, Map, FileText, Calendar as CalendarIcon, FireExtinguisher, HeartPulse, Car, CloudRain, Swords, HelpCircle, PersonStanding, Navigation } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, isSameDay } from "date-fns"
import { cn } from "@/lib/utils"
import React from "react"

// Dynamically import the map component to avoid SSR issues
const LocationMap = dynamic(
  () => import('@/components/LocationMap'),
  { ssr: false }
);

// Define Notification interface
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

// Define Report interface
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
  casualties?: number;
}

// Define InternalReport interface (matching report-history-table.tsx)
interface InternalReport {
  id: number;
  original_report_id: string | null;
  incident_type_id: number;
  incident_date: string; // TIMESTAMPTZ
  time_responded: string | null; // TIMESTAMPTZ
  barangay_id: number;
  er_team_id: number;
  persons_involved: number | null;
  number_of_responders: number | null;
  prepared_by: string;
  created_at: string; // TIMESTAMPTZ
}

// Define BaseEntry for reference tables (used for ER Teams)
interface BaseEntry {
  id: number;
  name: string;
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
  const [internalReports, setInternalReports] = useState<InternalReport[]>([]);
  const [erTeams, setErTeams] = useState<BaseEntry[]>([]); // New state for ER Teams
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(''); // Store team ID instead of name
  const [barangay, setBarangay] = useState<string>('');

  // New states for filtering and modals
  const [resolvedFilterDate, setResolvedFilterDate] = useState<Date | undefined>(new Date());
  const [showActiveModal, setShowActiveModal] = useState(false);
  const [showRespondedModal, setShowRespondedModal] = useState(false);

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

  // Function to fetch notifications
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

  // Function to fetch all emergency reports
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

  // Function to fetch internal reports
  const fetchInternalReports = useCallback(async () => {
    const { data, error } = await supabase
      .from('internal_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching internal reports:", error);
      setError(`Failed to load internal reports: ${error.message || 'Unknown error'}. Please check your Supabase RLS policies.`);
      return [];
    }
    return data || [];
  }, []);

  // Function to fetch ER Teams
  const fetchErTeams = useCallback(async () => {
    const { data, error } = await supabase
      .from('er_teams')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      console.error("Error fetching ER Teams:", error);
      setError(`Failed to load ER Teams: ${error.message}`);
      return [];
    }
    return data as BaseEntry[] || [];
  }, []);

  const handleLogout = async () => {
    try {
      // First try to sign out with scope 'local' which works better with SSR
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      
      // Clear local session data
      await supabase.auth.setSession({ access_token: "", refresh_token: "" });
      
      // Clear any remaining session data
      localStorage.removeItem('supabase.auth.token');
      
      // Call the parent's logout handler
      onLogout();
      
      // Force a full page reload to ensure all auth state is cleared
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (error) {
      console.warn('Error during sign out, forcing logout:', error);
      // Ensure we still log the user out even if there's an error
      onLogout();
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  };

  // Consolidated Real-time Listener for Reports, Notifications, and ER Teams
  useEffect(() => {
    const fetchAllDashboardData = async () => {
      try {
        const [reportsData, notificationsData, internalReportsData, erTeamsData] = await Promise.all([
          fetchAllReports(),
          fetchAdminNotifications(),
          fetchInternalReports(),
          fetchErTeams(), // Fetch ER Teams
        ]);

        setAllReports(reportsData.map((item: any) => ({ ...item })));
        setInternalReports(internalReportsData.map((item: any) => ({ ...item })));
        setErTeams(erTeamsData); // Set ER Teams

        // Set initial selectedTeamId if teams are available and not already set
        if (erTeamsData.length > 0 && !selectedTeamId) {
          setSelectedTeamId(String(erTeamsData[0].id)); // Select the first team by default
        }

        setNotifications(notificationsData);
        setUnreadCount(notificationsData.filter(n => !n.is_read).length);

      } catch (err: any) {
        console.error("Error fetching dashboard data:", err);
        setError(`Failed to load dashboard data: ${err.message}`);
      }
    };

    fetchAllDashboardData();

    // Set up real-time channels for all relevant tables
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

    const internalReportsChannel = supabase
      .channel('dashboard-internal-reports-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_reports' },
        (payload) => {
          console.log('Change received on internal_reports, refetching internal reports:', payload);
          // Debugging: Log selectedReport.id and relevant internal reports
          console.log('Selected Report ID:', selectedReport?.id);
          console.log('Internal Reports (original_report_id):', internalReports.map(ir => ir.original_report_id));
          fetchInternalReports().then(setInternalReports);
        }
      )
      .subscribe();

    const erTeamsChannel = supabase
      .channel('dashboard-er-teams-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'er_teams' },
        (payload) => {
          console.log('Change received on er_teams, refetching ER teams:', payload);
          fetchErTeams().then(setErTeams);
        }
      )
      .subscribe();

    // Cleanup subscriptions on component unmount
    return () => {
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(adminNotificationsChannel);
      supabase.removeChannel(internalReportsChannel);
      supabase.removeChannel(erTeamsChannel);
    };
  }, [fetchAllReports, fetchAdminNotifications, fetchInternalReports, fetchErTeams, selectedReport, internalReports]); // Added selectedReport and internalReports to dependencies for logging

  // Effect to get barangay from coordinates
  useEffect(() => {
    if (selectedReport?.latitude && selectedReport?.longitude) {
      setBarangay('Fetching...');
      fetch(`/api/geocode?lat=${selectedReport.latitude}&lon=${selectedReport.longitude}`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to fetch location data');
          }
          return response.json();
        })
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
    
    // Get all unread notification IDs
    const unreadNotifications = notifications.filter(n => !n.is_read);
    const unreadIds = unreadNotifications.map(n => n.id);
    
    if (unreadIds.length === 0) return;

    console.log(`Attempting to mark ${unreadIds.length} notifications as read`);
    setIsLoadingAction(true);
    setError(null);
    
    try {
      // First, update the UI optimistically
      setNotifications(prev => 
        prev.map(n => ({
          ...n,
          is_read: true
        }))
      );
      setUnreadCount(0);
      
      // Then update the database
      console.log('Updating notifications in database...');
      
      // Try updating all at once first
      const { data, error } = await supabase
        .from('admin_notifications')
        .update({ is_read: true })
        .in('id', unreadIds)
        .select(); // Add select to see what was updated
        
      if (error) {
        console.error('Batch update failed, trying one by one:', error);
        
        // If batch update fails, try updating one by one
        for (const id of unreadIds) {
          const { error: singleError } = await supabase
            .from('admin_notifications')
            .update({ is_read: true })
            .eq('id', id);
            
          if (singleError) {
            console.error(`Failed to update notification ${id}:`, singleError);
            // Continue with next notification even if one fails
          }
        }
      } else {
        console.log('Successfully updated notifications:', data);
      }
      
      // Force a refresh of notifications to ensure sync
      const refreshedNotifications = await fetchAdminNotifications();
      setNotifications(refreshedNotifications);
      setUnreadCount(refreshedNotifications.filter(n => !n.is_read).length);
      
    } catch (error) {
      console.error("Error in markAllNotificationsAsRead:", error);
      setError("Failed to mark all notifications as read. Please try again.");
      
      // Revert optimistic update on error
      const refreshedNotifications = await fetchAdminNotifications();
      setNotifications(refreshedNotifications);
      setUnreadCount(refreshedNotifications.filter(n => !n.is_read).length);
    } finally {
      setIsLoadingAction(false);
    }
  }, [notifications, unreadCount]);

  const handleReportClick = useCallback((report: Report) => {
    setSelectedReport(report);
    // Only reset the selected team if we're clicking on a different report
    if (!selectedReport || selectedReport.id !== report.id) {
      if (erTeams.length > 0) {
        // Set to the first team's ID
        setSelectedTeamId(String(erTeams[0].id));
      } else {
        setSelectedTeamId('');
      }
    }
  }, [erTeams, selectedReport]);

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
    if (!selectedReport || !selectedTeamId) {
      setError('Please select a team before responding.');
      return;
    }
    
    setIsLoadingAction(true);
    setError(null);
    
    try {
      // Find the selected team
      const selectedTeamObj = erTeams.find(team => team.id === parseInt(selectedTeamId));
      if (!selectedTeamObj) {
        throw new Error('Selected team not found');
      }
      
      const responseMessage = `Team ${selectedTeamObj.name} is responding.`;
      const updateData = { 
        status: 'responded', 
        admin_response: responseMessage, 
        responded_at: new Date().toISOString(),
        er_team_id: selectedTeamObj.id // Store the team ID in the report
      };
      
      const { data: updatedReport, error: updateError } = await supabase
        .from('emergency_reports')
        .update(updateData)
        .eq('id', selectedReport.id)
        .select()
        .single();
        
      if (updateError) throw updateError;

      // Send notification to user
      const selectedTeam = erTeams.find(team => team.id === parseInt(selectedTeamId));
      const teamName = selectedTeam ? selectedTeam.name : 'a response team';
      
      const { error: notificationError } = await supabase
        .from('user_notifications')
        .insert({ 
          user_id: selectedReport.user_id, 
          emergency_report_id: selectedReport.id, 
          message: `Your emergency report for ${selectedReport.emergency_type} is OTW. Team ${teamName} is responding.` 
        });
        
      if (notificationError) {
        console.error('Error sending user notification:', notificationError);
      }

      // Refresh data
      await fetchAllReports();
      setSelectedReport(updatedReport as Report);
      
    } catch (err: any) {
      setError(`Failed to respond: ${err.message}. Check RLS policies.`);
      console.error('Error in handleRespondToIncident:', err);
    } finally {
      setIsLoadingAction(false);
    }
  }, [selectedReport, selectedTeamId, erTeams, fetchAllReports]);

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

  // Check if an internal report already exists for the selected emergency report
  const hasInternalReportBeenMade = React.useMemo(() => {
    if (!selectedReport?.id) return false;
    return internalReports.some(ir => ir.original_report_id === selectedReport.id);
  }, [selectedReport?.id, internalReports]);
  
  // Debug log - only when the value changes
  React.useEffect(() => {
    if (selectedReport?.id) {
      console.log(`hasInternalReportBeenMade for ${selectedReport.id}:`, hasInternalReportBeenMade);
    }
  }, [selectedReport?.id, hasInternalReportBeenMade]);

  // This handleMakeReport is for the context-specific button (resolved incidents)
  const handleMakeReport = () => {
    if (selectedReport?.id) {
      window.open(`/admin/report?incidentId=${selectedReport.id}`, '_blank');
    } else {
      console.warn("No selected report to make a specific report for.");
    }
  };

  // Filtered counts for dashboard cards
  const totalReportsCount = allReports.length;
  const activeEmergenciesCount = allReports.filter(r => r.status.trim().toLowerCase() === 'active' || r.status.trim().toLowerCase() === 'pending').length;
  const respondedCount = allReports.filter(r => r.status.trim().toLowerCase() === 'responded').length;

  const filteredResolvedCount = React.useMemo(() => {
    if (!resolvedFilterDate) return 0;
    return allReports.filter(r =>
      r.status.trim().toLowerCase() === 'resolved' &&
      isSameDay(new Date(r.resolved_at || r.created_at), resolvedFilterDate) // Use resolved_at if available, otherwise created_at
    ).length;
  }, [allReports, resolvedFilterDate]);


  // Filtered lists for modals
  const activeReportsList = allReports.filter(r => r.status.trim().toLowerCase() === 'active' || r.status.trim().toLowerCase() === 'pending');
  const respondedReportsList = allReports.filter(r => r.status.trim().toLowerCase() === 'responded');


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
          <Sidebar/>
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
            <Card className="shadow cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowActiveModal(true)}>
              <CardHeader><CardTitle>Active Emergencies</CardTitle></CardHeader>
              <CardContent><p className="text-4xl font-bold text-red-600">{activeEmergenciesCount}</p></CardContent>
            </Card>
            <Card className="shadow cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowRespondedModal(true)}>
              <CardHeader><CardTitle>In-Progress</CardTitle></CardHeader>
              <CardContent><p className="text-4xl font-bold text-yellow-600">{respondedCount}</p></CardContent>
            </Card>
            <Card className="shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[120px] justify-start text-left font-normal",
                        !resolvedFilterDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {resolvedFilterDate ? format(resolvedFilterDate, "MM/dd") : <span>Date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={resolvedFilterDate}
                      onSelect={setResolvedFilterDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold text-green-600">{filteredResolvedCount}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {resolvedFilterDate ? `for ${format(resolvedFilterDate, "PPP")}` : "Select a date"}
                </p>
              </CardContent>
            </Card>
        </div>

        {/* The main dashboard content remains here, as it's the default view */}
        <>
            <div className="lg:col-span-2">
              <Card className="shadow-lg h-full">
                <CardHeader className="bg-orange-600 text-white"><CardTitle className="flex items-center"><MapPin className="mr-3" />Incident Details & Actions</CardTitle></CardHeader>
                <CardContent className="p-6">
                  {selectedReport ? (
                    <div>
                      <div className="flex items-center mb-4">
                        {selectedReport.emergency_type === 'Fire Incident' && <FireExtinguisher className="h-8 w-8 text-red-500 mr-3" />}
                        {selectedReport.emergency_type === 'Medical Emergency' && <HeartPulse className="h-8 w-8 text-red-500 mr-3" />}
                        {selectedReport.emergency_type === 'Vehicular Incident' && <Car className="h-8 w-8 text-blue-500 mr-3" />}
                        {selectedReport.emergency_type === 'Weather Disturbance' && <CloudRain className="h-8 w-8 text-blue-300 mr-3" />}
                        {selectedReport.emergency_type === 'Public Disturbance' && <PersonStanding className="h-8 w-8 text-orange-500 mr-3" />}
                        {selectedReport.emergency_type === 'Others' && <HelpCircle className="h-8 w-8 text-gray-500 mr-3" />}
                        <div>
                          <h3 className="text-2xl font-bold">{selectedReport.emergency_type}</h3>
                          <span className="text-sm text-gray-500">Reported Emergency Type</span>
                        </div>
                      </div>
                      <p className="text-gray-600 mb-4">Reported by: <span className="font-medium">{selectedReport.firstName} {selectedReport.lastName}</span></p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="md:col-span-2">
                          <p className="text-sm text-gray-500 mb-1">Location</p>
                          <div className="w-full max-w-md mx-auto rounded-lg overflow-hidden border border-gray-200">
                            <LocationMap 
                              latitude={selectedReport.latitude} 
                              longitude={selectedReport.longitude}
                              zoom={15}
                              className="w-full"
                            />
                            <div className="flex justify-center gap-3 p-2 bg-gray-50">
                              <a 
                                href={`https://www.openstreetmap.org/?mlat=${selectedReport.latitude}&mlon=${selectedReport.longitude}&zoom=15`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center"
                              >
                                <MapPin className="h-3 w-3 mr-1" />
                                Open in OSM
                              </a>
                              <a 
                                href={`https://www.google.com/maps?q=${selectedReport.latitude},${selectedReport.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center"
                              >
                                <MapPin className="h-3 w-3 mr-1" />
                                Open in Google Maps
                              </a>
                            </div>
                          </div>
                        </div>
                        <div><p className="text-sm text-gray-500">Barangay</p><p className="font-semibold">{barangay}</p></div>
                        <div><p className="text-sm text-gray-500">Contact</p><p className="font-semibold">{selectedReport.mobileNumber}</p></div>
                        <div><p className="text-sm text-gray-500">Reported At</p><p className="font-semibold">{new Date(selectedReport.created_at).toLocaleString()}</p></div>
                        <div><p className="text-sm text-gray-500">Status</p><p className={`font-bold ${selectedReport.status.trim().toLowerCase() === 'pending' || selectedReport.status.trim().toLowerCase() === 'active' ? 'text-red-600' : selectedReport.status.trim().toLowerCase() === 'responded' ? 'text-yellow-600' : 'text-green-600'}`}>{selectedReport.status}</p></div>
                        <div>
                          <p className="text-sm text-gray-500">Casualties</p>
                          <p className="font-semibold">{selectedReport.casualties ?? 0}</p>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg bg-gray-50 mb-6">
                        <h4 className="font-semibold mb-3">Incident Actions</h4>
                        {(selectedReport.status.trim().toLowerCase() === 'pending' || selectedReport.status.trim().toLowerCase() === 'active') && (
                          <div className="space-y-4">
                            <div>
                              <label htmlFor="team-select" className="block text-sm font-medium mb-1">Select response team:</label>
                              {/* Modified Select component */}
                              <Select 
                                value={selectedTeamId} 
                                onValueChange={setSelectedTeamId}
                              >
                                <SelectTrigger className="w-full p-2 border border-gray-300 rounded-md shadow-sm">
                                  <SelectValue placeholder="Select ER team" />
                                </SelectTrigger>
                                <SelectContent className="bg-white rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
                                  {erTeams.length > 0 ? (
                                    erTeams.map(team => (
                                      <SelectItem 
                                        key={team.id} 
                                        value={String(team.id)} 
                                        className="p-2 hover:bg-gray-100 cursor-pointer"
                                      >
                                        {team.name}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <div className="p-2 text-center text-gray-500">No ER teams available.</div>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button onClick={handleRespondToIncident} disabled={isLoadingAction} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center"><Send size={18} className="mr-2" />{isLoadingAction ? 'Responding...' : 'Respond'}</Button>
                          </div>
                        )}
                        {selectedReport.status.trim().toLowerCase() === 'responded' && (
                            <Button onClick={handleRescueDone} disabled={isLoadingAction} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center"><CheckCircle size={18} className="mr-2" />{isLoadingAction ? 'Resolving...' : 'Rescue Done'}</Button>
                        )}
                        {/* Make a Report Button - Only for resolved incidents and if no internal report exists */}
                        {selectedReport.status.trim().toLowerCase() === 'resolved' && !hasInternalReportBeenMade && (
                          <Button
                            onClick={handleMakeReport}
                            disabled={isLoadingAction}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center mt-4"
                          >
                            <FileText size={18} className="mr-2" /> Make a Report
                          </Button>
                        )}
                        {selectedReport.status.trim().toLowerCase() === 'resolved' && hasInternalReportBeenMade && (
                          <p className="text-sm text-gray-500 text-center mt-4">
                            <CheckCircle className="inline-block h-4 w-4 mr-1 text-green-500" /> Internal report already created for this incident.
                          </p>
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
                <CardHeader className="bg-orange-600 text-white"><CardTitle>All Reports</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-y-auto max-h-[400px] custom-scrollbar"> {/* Added custom-scrollbar class */}
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

      {/* Active Reports Modal */}
      <Dialog open={showActiveModal} onOpenChange={setShowActiveModal}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Active / Pending Emergencies</DialogTitle>
            <DialogDescription>
              List of all emergency reports currently in 'active' or 'pending' status.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {activeReportsList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reporter</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reported At</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {activeReportsList.map(report => (
                      <tr key={report.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { handleReportClick(report); setShowActiveModal(false); }}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{report.firstName} {report.lastName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.emergency_type}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.location_address}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${report.status.trim().toLowerCase() === 'pending' || report.status.trim().toLowerCase() === 'active' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                            {report.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{format(new Date(report.created_at), 'PPP HH:mm')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">No active or pending reports.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Responded Reports Modal */}
      <Dialog open={showRespondedModal} onOpenChange={setShowRespondedModal}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>In-Progress (Responded) Emergencies</DialogTitle>
            <DialogDescription>
              List of all emergency reports currently in 'responded' status.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {respondedReportsList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reporter</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responded At</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {respondedReportsList.map(report => (
                      <tr key={report.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { handleReportClick(report); setShowRespondedModal(false); }}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{report.firstName} {report.lastName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.emergency_type}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.location_address}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800`}>
                            {report.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.responded_at ? format(new Date(report.responded_at), 'PPP HH:mm') : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">No in-progress reports.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}