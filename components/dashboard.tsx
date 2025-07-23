"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Menu, User, LogOut, Bell, History, Info, Phone, Edit, Mail, X, Send, FireExtinguisher, HeartPulse, Car, CloudRain, LandPlot, HelpCircle, Swords } from "lucide-react" // Added Swords for Armed Conflict
import { UserSidebar } from "./user_sidebar"
import { supabase } from "@/lib/supabase"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDistanceToNowStrict, parseISO } from 'date-fns';

interface Notification {
  id: string;
  emergency_report_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
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

interface Hotline {
  id: string;
  name: string;
  number: string;
  description?: string;
}

interface MdrrmoInfo {
  id: string;
  content: string;
}

interface DashboardProps {
  onLogout: () => void
  userData?: any
}

// Define Incident Types with their corresponding Lucide React icons
const INCIDENT_TYPES = [
  { type: 'Fire Incident', icon: FireExtinguisher }, // Changed name
  { type: 'Medical Emergency', icon: HeartPulse },
  { type: 'Vehicular Incident', icon: Car }, // Changed name
  { type: 'Weather Disturbance', icon: CloudRain }, // Changed name
  { type: 'Armed Conflict', icon: Swords }, // Changed name, new icon
  { type: 'Others', icon: HelpCircle },
];

export function Dashboard({ onLogout, userData }: DashboardProps) {
  const [isEmergencyActive, setIsEmergencyActive] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showSOSConfirm, setShowSOSConfirm] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [currentView, setCurrentView] = useState<'main' | 'reportHistory' | 'mdrrmoInfo' | 'hotlines' | 'userProfile' | 'sendFeedback'>('main');

  // States for User Profile editing
  const [editingMobileNumber, setEditingMobileNumber] = useState<string>('');
  const [editingUsername, setEditingUsername] = useState<string>('');
  const [profileEditSuccess, setProfileEditSuccess] = useState<string | null>(null);
  const [profileEditError, setProfileEditError] = useState<string | null>(null);

  // State for Send Feedback
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [feedbackSentMessage, setFeedbackSentMessage] = useState<string | null>(null);
  const [feedbackErrorMessage, setFeedbackErrorMessage] = useState<string | null>(null);

  // States for fetched data for new sections
  const [userReports, setUserReports] = useState<Report[]>([]);
  const [mdrrmoInformation, setMdrrmoInformation] = useState<MdrrmoInfo | null>(null);
  const [bulanHotlines, setBulanHotlines] = useState<Hotline[]>([]);

  // New states for incident type buttons and cooldown
  const [selectedIncidentTypeForConfirmation, setSelectedIncidentTypeForConfirmation] = useState<string | null>(null);
  const [cooldownActive, setCooldownActive] = useState<boolean>(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0); // in seconds
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // New state for report credits, initialized from localStorage
  const [reportCredits, setReportCredits] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const storedCredits = localStorage.getItem('mdrrmo_reportCredits');
      return storedCredits ? Math.min(3, parseInt(storedCredits, 10)) : 3; // Max 3 credits
    }
    return 3; // Default to max 3 credits
  });
  
  // Track when credits were consumed for replenishment
  const [creditConsumptionTimes, setCreditConsumptionTimes] = useState<number[]>(() => {
    if (typeof window !== 'undefined') {
      const storedTimes = localStorage.getItem('mdrrmo_creditConsumptionTimes');
      return storedTimes ? JSON.parse(storedTimes) : [];
    }
    return [];
  });
  
  // Track active cooldown timers
  const [activeCooldowns, setActiveCooldowns] = useState<number[]>([]);

  // Function to load notifications for the current user
  const loadNotifications = useCallback(async (userId: string) => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("user_notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setNotifications(data as Notification[]);
    } else if (error) {
      console.error("Error loading user notifications:", error);
    }
  }, []);

  // Function to load user's report history
  const loadUserReports = useCallback(async (userId: string) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('emergency_reports')
      .select('*') // Select all columns for detailed history
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUserReports(data as Report[]);
    } else if (error) {
      console.error("Error loading user reports:", error);
    }
  }, []);

  // Function to load MDRRMO Information
  const loadMdrrmoInfo = useCallback(async () => {
    const { data, error } = await supabase
      .from('mdrrmo_info')
      .select('*')
      .single(); // Assuming only one row for general info

    if (!error && data) {
      setMdrrmoInformation(data as MdrrmoInfo);
    } else if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
      console.error("Error loading MDRRMO Information:", error);
    } else if (error && error.code === 'PGRST116') {
      console.log("No MDRRMO Information found. It might not be set by admin yet.");
      setMdrrmoInformation(null); // Explicitly set to null if no data
    }
  }, []);

  // Function to load Bulan Hotlines
  const loadBulanHotlines = useCallback(async () => {
    const { data, error } = await supabase
      .from('hotlines')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      setBulanHotlines(data as Hotline[]);
    } else if (error) {
      console.error("Error loading Bulan Hotlines:", error);
    }
  }, []);

  // Effect to load initial credits and consumption times from localStorage
  useEffect(() => {
    const storedCredits = localStorage.getItem('mdrrmo_reportCredits');
    const storedConsumptionTimes = localStorage.getItem('mdrrmo_creditConsumptionTimes');
    
    // Clean up old cooldown data if it exists
    if (localStorage.getItem('cooldownEndTime')) {
      localStorage.removeItem('cooldownEndTime');
    }
    
    // Initialize credits (max 3)
    if (storedCredits) {
      setReportCredits(Math.min(3, parseInt(storedCredits, 10)));
    }
    
    // Initialize consumption times and set up cooldowns
    if (storedConsumptionTimes) {
      try {
        const times = JSON.parse(storedConsumptionTimes);
        if (Array.isArray(times)) {
          setCreditConsumptionTimes(times);
        }
      } catch (e) {
        console.error('Error parsing stored credit consumption times:', e);
      }
    }
  }, []); // Run once on mount for initial setup

  // Effect to manage credit replenishment with individual cooldowns
  useEffect(() => {
    const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
    
    // Function to process cooldowns and update credits
    const processCooldowns = () => {
      const now = Date.now();
      
      // Process each cooldown that's ready to replenish
      const updatedCooldowns = activeCooldowns.filter(cooldownEnd => {
        return now < cooldownEnd; // Keep only active cooldowns
      });
      
      // Calculate how many credits should be replenished
      const creditsToReplenish = activeCooldowns.length - updatedCooldowns.length;
      
      if (creditsToReplenish > 0) {
        setReportCredits(prev => {
          const newCredits = Math.min(3, prev + creditsToReplenish);
          if (newCredits > 0) {
            setShowSOSConfirm(false); // Close any open SOS confirm modal if credits are available
          }
          return newCredits;
        });
      }
      
      // Update active cooldowns
      if (updatedCooldowns.length !== activeCooldowns.length) {
        setActiveCooldowns(updatedCooldowns);
      }
      
      // If we still have active cooldowns, schedule next check
      if (updatedCooldowns.length > 0) {
        const nextCooldown = Math.min(...updatedCooldowns) - now;
        return Math.max(1000, nextCooldown);
      }
      
      return null; // No active cooldowns
    };
    
    // Initial check
    const timeout = processCooldowns();
    
    // Set up timer for next check if needed
    let timer: NodeJS.Timeout | null = null;
    if (timeout !== null) {
      timer = setTimeout(processCooldowns, timeout);
    }
    
    // Cleanup function
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activeCooldowns]);
  
  // Effect to initialize cooldowns from credit consumption times
  useEffect(() => {
    if (creditConsumptionTimes.length > 0) {
      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;
      
      // Create cooldowns for each consumption time
      const newCooldowns = creditConsumptionTimes
        .filter(timestamp => (now - timestamp) < tenMinutes)
        .map(timestamp => timestamp + tenMinutes);
      
      setActiveCooldowns(newCooldowns);
    }
  }, [creditConsumptionTimes]);

  // Effect to persist report credits, consumption times, and cooldowns to localStorage
  useEffect(() => {
    localStorage.setItem('mdrrmo_reportCredits', reportCredits.toString());
    localStorage.setItem('mdrrmo_creditConsumptionTimes', JSON.stringify(creditConsumptionTimes));
    // Note: We don't persist activeCooldowns as they're recalculated on load
  }, [reportCredits, creditConsumptionTimes]);


  // Main useEffect for session, user data, and initial data loading
  useEffect(() => {
    const checkSessionAndLoadUser = async () => {
      let userFromPropsOrStorage = null;

      if (userData) {
        userFromPropsOrStorage = userData;
      } else {
        const storedUser = localStorage.getItem("mdrrmo_user");
        if (storedUser) {
          try {
            userFromPropsOrStorage = JSON.parse(storedUser);
          } catch (parseError) {
            console.error("Error parsing stored user data in Dashboard:", parseError);
            localStorage.removeItem("mdrrmo_user");
            onLogout();
            return;
          }
        }
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !sessionData?.session) {
          console.error("Supabase session invalid or not found:", sessionError);
          onLogout();
          return;
        }

        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', sessionData.session.user.id)
          .single();

        if (profileError || !userProfile) {
          console.error("Error fetching user profile:", profileError);
          onLogout();
          return;
        }

        setCurrentUser(userProfile);
        setEditingMobileNumber(userProfile.mobileNumber || '');
        setEditingUsername(userProfile.username || '');

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

        loadNotifications(userProfile.id);
        loadUserReports(userProfile.id);
        loadMdrrmoInfo();
        loadBulanHotlines();

      } catch (error) {
        console.error("Unexpected error during session check:", error);
        onLogout();
      }
    };

    checkSessionAndLoadUser();

    let notificationsChannel: any;
    if (currentUser?.id) {
      notificationsChannel = supabase
        .channel(`user_notifications_channel_${currentUser.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${currentUser.id}`,
          },
          (payload) => {
            console.log("User notification change received, reloading:", payload);
            loadNotifications(currentUser.id);
          },
        )
        .subscribe();
    }

    let userReportsChannel: any;
    if (currentUser?.id) {
      userReportsChannel = supabase
        .channel(`user_reports_channel_${currentUser.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'emergency_reports', filter: `user_id=eq.${currentUser.id}` },
          (payload) => {
            console.log('User report change received, reloading:', payload);
            loadUserReports(currentUser.id);
          }
        )
        .subscribe();
    }

    const mdrrmoInfoChannel = supabase
      .channel('mdrrmo_info_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mdrrmo_info' },
        (payload) => {
          console.log('MDRRMO Info change received, reloading:', payload);
          loadMdrrmoInfo();
        }
      )
      .subscribe();

    const hotlinesChannel = supabase
      .channel('hotlines_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hotlines' },
        (payload) => {
          console.log('Hotlines change received, reloading:', payload);
          loadBulanHotlines();
        }
      )
      .subscribe();


    return () => {
      if (notificationsChannel) {
        supabase.removeChannel(notificationsChannel);
      }
      if (userReportsChannel) {
        supabase.removeChannel(userReportsChannel);
      }
      supabase.removeChannel(mdrrmoInfoChannel);
      supabase.removeChannel(hotlinesChannel);
    }
  }, [userData, onLogout, currentUser?.id, loadNotifications, loadUserReports, loadMdrrmoInfo, loadBulanHotlines]);

  // Modified confirmSOS to accept emergencyType
  const confirmSOS = async (emergencyType: string) => {
    if (!location || !currentUser) {
      console.error("Location not available or user not logged in");
      return;
    }

    // Double-check credits before proceeding (in case of race conditions)
    const currentCredits = reportCredits;
    if (currentCredits <= 0) {
      console.log("No credits remaining. Cannot send alert.");
      setShowSOSConfirm(false);
      return;
    }

    // Immediately update UI to prevent double-clicks
    setIsEmergencyActive(true);
    setSelectedIncidentTypeForConfirmation(null);
    setShowSOSConfirm(false);
    
    // Record the time when credit was consumed (before the async operation)
    const consumptionTime = Date.now();
    
    // Immediately update the credit state to prevent double submissions
    setReportCredits(prev => {
      const newCredits = Math.max(0, prev - 1);
      return newCredits;
    });
    
    // Add a new cooldown timer for this consumption
    setActiveCooldowns(prev => [...prev, consumptionTime + (10 * 60 * 1000)]);
    
    // Save the consumption time for persistence
    setCreditConsumptionTimes(prev => [...prev, consumptionTime]);

    try {
      let locationAddress = "Location unavailable";
      try {
        // Use our local API endpoint to avoid CORS issues
        const response = await fetch(
          `/api/geocode?lat=${location.lat}&lon=${location.lng}`
        );
        
        if (!response.ok) {
          throw new Error(`Geocoding API error: ${response.status}`);
        }
        
        const data = await response.json();
        locationAddress = data.display_name || `${location.lat}, ${location.lng}`;
      } catch (err) {
        console.error("Geocoding error:", err);
        // Fallback to coordinates if geocoding fails
        locationAddress = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
      }

      const { data: reportData, error: reportError } = await supabase
        .from("emergency_reports")
        .insert({
          user_id: currentUser.id,
          firstName: currentUser.firstName,
          middleName: currentUser.middleName || null,
          lastName: currentUser.lastName,
          mobileNumber: currentUser.mobileNumber,
          latitude: location.lat,
          longitude: location.lng,
          location_address: locationAddress,
          emergency_type: emergencyType, // Use the passed emergencyType
          status: "active",
          created_at: new Date().toISOString(),
          reportedAt: new Date().toISOString(),
          reporterMobile: currentUser.mobileNumber,
        })
        .select()
        .single()

      if (reportError) {
        console.error("Error creating report:", reportError)
        console.error("Supabase Report Insert Error Details:", reportError);
        console.error("Failed to send emergency alert: Please check Supabase RLS policies for 'emergency_reports' INSERT operation, or schema constraints.");
        setIsEmergencyActive(false); // Deactivate if report fails
        return
      }

      await supabase.from("admin_notifications").insert({
        emergency_report_id: reportData.id,
        message: `🚨 NEW EMERGENCY ALERT: ${currentUser.firstName} ${currentUser.lastName} needs help for ${emergencyType} at ${locationAddress}`, // Include type in message
        is_read: false,
        type: 'new_report',
        created_at: new Date().toISOString(),
      })

      console.log(`Emergency alert for ${emergencyType} sent successfully!`)

      await supabase.from("user_notifications").insert({
        user_id: currentUser.id,
        emergency_report_id: reportData.id,
        message: `Your emergency alert for ${emergencyType} has been sent. Help is on the way!`,
        is_read: false,
        created_at: new Date().toISOString(),
      });

      // Visual active state for 5 seconds
      setTimeout(() => {
        setIsEmergencyActive(false);
      }, 5000);
    } catch (error: any) {
      console.error("SOS Error:", error)
      console.error("Failed to send emergency alert: " + error.message);
      setIsEmergencyActive(false)
      // Optionally, if the report fails due to a network error *after* credit deduction,
      // you might want to refund the credit here. For simplicity, we'll assume success
      // means credit is used.
    }
  }

  const cancelSOS = () => {
    setShowSOSConfirm(false)
    setSelectedIncidentTypeForConfirmation(null); // Clear confirmation if modal cancelled
    // No credit deduction or cooldown initiation here
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
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error("Error marking notification as read:", error);
    } else {
      loadNotifications(currentUser.id);
    }
  };

  // Handle Profile Update
  const handleProfileUpdate = async () => {
    if (!currentUser) {
      setProfileEditError("User not logged in.");
      return;
    }
    setProfileEditSuccess(null);
    setProfileEditError(null);

    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          mobileNumber: editingMobileNumber,
          username: editingUsername,
        })
        .eq('id', currentUser.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setCurrentUser(data);
      setProfileEditSuccess("Profile updated successfully!");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      setProfileEditError(`Failed to update profile: ${error.message || 'Unknown error'}. Please check your Supabase RLS policies for 'users' UPDATE operation.`);
    }
  };

  // Handle Send Feedback
  const handleSendFeedback = async () => {
    if (!currentUser || !feedbackText.trim()) {
      setFeedbackErrorMessage("Feedback cannot be empty.");
      return;
    }
    setFeedbackSentMessage(null);
    setFeedbackErrorMessage(null);

    try {
      const { error } = await supabase
        .from('user_feedback')
        .insert({
          user_id: currentUser.id,
          feedback_text: feedbackText,
          created_at: new Date().toISOString(),
          is_read: false,
        });

      if (error) {
        throw error;
      }

      setFeedbackText('');
      setFeedbackSentMessage("Feedback sent successfully!");
    } catch (error: any) {
      console.error("Error sending feedback:", error);
      setFeedbackErrorMessage(`Failed to send feedback: ${error.message || 'Unknown error'}. Please check your Supabase RLS policies for 'user_feedback' INSERT operation.`);
    }
  };

  // Handle click on an incident type button
  const handleIncidentTypeClick = (type: string) => {
    if (cooldownActive || reportCredits === 0) { // Disable if cooldown active or no credits
      console.log("Cannot send alert: Cooldown active or no credits remaining.");
      return;
    }
    // Always show confirmation modal on first click
    setSelectedIncidentTypeForConfirmation(type);
    setShowSOSConfirm(true);
  };

  // Format cooldown time for display
  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="min-h-screen relative flex flex-col"
      style={{
        backgroundImage: "url('/images/mdrrmo_dashboard_bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black/30 z-0"></div>

      {/* Header */}
      <div className="relative z-20 bg-orange-500/95 backdrop-blur-sm text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {/* Hamburger Menu Button - Always visible */}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="p-2 -ml-2 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
              aria-label="Toggle menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            {/* Desktop Title - Hidden on small screens */}
            <div className="hidden md:flex items-center space-x-3 ml-2">
              <span className="font-medium text-lg">SORSU-Students</span>
            </div>
          </div>

          <div className="text-center flex-1">
            <h1 className="text-xl sm:text-2xl font-bold">MDRRMO</h1>
            <p className="text-sm sm:text-base text-orange-100">Accident Reporting System</p>
          </div>

          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 hover:bg-orange-600 rounded-full transition-colors relative"
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
                className="flex items-center space-x-2 cursor-pointer hover:bg-orange-600 p-2 rounded-full transition-colors"
                onClick={handleUserMenuClick}
              >
                <User className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Sidebar Component */}
      <UserSidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        onChangeView={(view: string) => setCurrentView(view as "main" | "reportHistory" | "mdrrmoInfo" | "hotlines" | "userProfile" | "sendFeedback")}
      />

      {/* Notifications Dropdown - Positioned relative to header */}
      {showNotifications && (
        <div className="fixed top-20 right-4 bg-white rounded-lg shadow-xl border border-gray-200 w-72 sm:w-80 max-h-96 overflow-y-auto z-50">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
            {notifications.some(n => !n.is_read) && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded-full ml-2"
                onClick={(e) => {
                  e.stopPropagation();
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
                  className={`p-4 border-b border-gray-100 ${!notification.is_read ? "bg-blue-50" : ""}`}
                  onClick={async () => {
                    await markNotificationAsRead(notification.id);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <p className="text-sm text-gray-800">{notification.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(notification.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* User Menu Overlay (right side dropdown) - Positioned relative to header */}
      {showUserMenu && (
        <div
          className="fixed inset-0 bg-black/20 flex items-start justify-end pt-16 pr-4 z-40"
          onClick={() => setShowUserMenu(false)}
        >
          <div
            className="bg-white text-gray-800 rounded-lg shadow-2xl border border-gray-200 w-48 sm:w-56 animate-in slide-in-from-top-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <p className="text-sm font-medium text-gray-900">Hi {currentUser?.firstName || "User"}!</p>
              <p className="text-xs text-gray-500">{currentUser?.email || currentUser?.username}</p>
            </div>
            <div className="p-2">
              <div
                onClick={handleLogout}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Send Emergency Alert?</h3>
              <p className="text-gray-600 mb-6">
                This will send your location and details for a <span className="font-bold text-red-700">{selectedIncidentTypeForConfirmation}</span> emergency to MDRRMO emergency responders.
              </p>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                <Button onClick={cancelSOS} variant="outline" className="flex-1 bg-transparent">
                  NO
                </Button>
                <Button onClick={() => confirmSOS(selectedIncidentTypeForConfirmation!)} className="flex-1 bg-red-500 hover:bg-red-600">
                  YES, SEND ALERT
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area - Adjusted for sidebar on desktop */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-8 lg:ml-64">
        {currentView === 'main' && (
          <>
            <div className="text-center mb-8">
              {cooldownActive ? (
                <div className="bg-yellow-500 text-white px-6 py-3 rounded-full shadow-lg text-lg sm:text-xl font-bold">
                  Cooldown: {formatTime(cooldownRemaining)}
                </div>
              ) : (
                <p className="text-white text-lg sm:text-xl font-semibold mb-4 bg-black/50 p-3 rounded-lg shadow-md">
                  {reportCredits === 0 ? (
                    "No credits. Cooldown active."
                  ) : selectedIncidentTypeForConfirmation ?
                    `Click ${selectedIncidentTypeForConfirmation} again to confirm!` :
                    `Credits: ${reportCredits}. Select an emergency type below to send an alert.`
                  }
                </p>
              )}
            </div>

            {/* Incident Type Buttons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 max-w-2xl w-full mx-auto">
              {INCIDENT_TYPES.map((incident) => {
                const IconComponent = incident.icon;
                // Buttons are disabled if cooldown is active OR if credits are 0
                const isDisabled = cooldownActive || reportCredits === 0;

                return (
                  <Button
                    key={incident.type}
                    onClick={() => handleIncidentTypeClick(incident.type)}
                    className={`
                      flex flex-col items-center justify-center p-4 sm:p-6 rounded-lg shadow-lg text-white font-bold text-base sm:text-lg transition-all duration-200
                      ${isDisabled ? 'bg-gray-500 opacity-70 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}
                      ${selectedIncidentTypeForConfirmation === incident.type && !isDisabled ? 'ring-4 ring-red-300 scale-105' : ''}
                    `}
                    disabled={isDisabled}
                  >
                    <IconComponent className="w-8 h-8 sm:w-10 sm:h-10 mb-2" />
                    <span>{incident.type}</span>
                  </Button>
                );
              })}
            </div>

            {/* Emergency Active Status Indicator */}
            {isEmergencyActive && (
              <div className="mt-6 bg-red-500 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-full animate-bounce text-sm sm:text-base shadow-xl">
                <span className="font-bold">🚨 EMERGENCY ALERT SENT! 🚨</span>
              </div>
            )}
          </>
        )}

        {currentView === 'reportHistory' && (
          <Card className="w-full max-w-full lg:max-w-6xl bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4 sm:p-6">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800">Your Report History</CardTitle>
            </CardHeader>
            <CardContent>
              {userReports.length === 0 ? (
                <p className="text-gray-600 text-center py-4">No emergency reports found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th scope="col" className="px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">
                          Team Responded
                        </th>
                        <th scope="col" className="px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">
                          Time and Date Resolved
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {userReports.map((report) => (
                        <tr key={report.id}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{report.emergency_type}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              report.status.trim().toLowerCase() === 'pending' || report.status.trim().toLowerCase() === 'active'
                                ? 'bg-red-100 text-red-800'
                                : report.status.trim().toLowerCase() === 'responded'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                            }`}>
                              {report.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-normal text-sm text-gray-500">{report.admin_response || 'N/A'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{report.resolved_at ? new Date(report.resolved_at).toLocaleString() : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentView === 'mdrrmoInfo' && (
          <Card className="w-full max-w-full lg:max-w-4xl bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4 sm:p-6">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800">MDRRMO-Bulan Information</CardTitle>
            </CardHeader>
            <CardContent>
              {mdrrmoInformation ? (
                <div className="prose max-w-none text-gray-700 text-base sm:text-lg">
                  <p className="whitespace-pre-wrap">{mdrrmoInformation.content}</p>
                </div>
              ) : (
                <p className="text-gray-600 text-center py-4">No information available yet. Please check back later.</p>
              )}
            </CardContent>
          </Card>
        )}

        {currentView === 'hotlines' && (
          <Card className="w-full max-w-full lg:max-w-3xl bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4 sm:p-6">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800">Bulan Hotlines</CardTitle>
            </CardHeader>
            <CardContent>
              {bulanHotlines.length === 0 ? (
                <p className="text-gray-600 text-center py-4">No hotlines available yet. Please check back later.</p>
              ) : (
                <div className="space-y-4">
                  {bulanHotlines.map((hotline) => (
                    <div key={hotline.id} className="border-b pb-3 last:border-b-0">
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-800">{hotline.name}</h3>
                      <p className="text-blue-600 font-medium text-xl sm:text-2xl mt-1">
                        <a href={`tel:${hotline.number}`} className="hover:underline">{hotline.number}</a>
                      </p>
                      {hotline.description && <p className="text-sm sm:text-base text-gray-600 mt-1">{hotline.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentView === 'userProfile' && currentUser && (
          <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4 sm:p-6">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800">User Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <Input
                  id="username"
                  type="text"
                  value={editingUsername}
                  onChange={(e) => setEditingUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <Input
                  id="mobileNumber"
                  type="text"
                  value={editingMobileNumber}
                  onChange={(e) => setEditingMobileNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <Button onClick={handleProfileUpdate} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg">
                <Edit className="mr-2 h-4 w-4" /> Update Profile
              </Button>
              {profileEditSuccess && <p className="text-green-600 text-sm mt-2 text-center">{profileEditSuccess}</p>}
              {profileEditError && <p className="text-red-600 text-sm mt-2 text-center">{profileEditError}</p>}
            </CardContent>
          </Card>
        )}

        {currentView === 'sendFeedback' && currentUser && (
          <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4 sm:p-6">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800">Send Feedback</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-1">Your Feedback</label>
                <Textarea
                  id="feedback"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={5}
                  placeholder="Type your feedback here..."
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <Button onClick={handleSendFeedback} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg">
                <Send className="mr-2 h-4 w-4" /> Send Feedback
              </Button>
              {feedbackSentMessage && <p className="text-green-600 text-sm mt-2 text-center">{feedbackSentMessage}</p>}
              {feedbackErrorMessage && <p className="text-red-600 text-sm mt-2 text-center">{feedbackErrorMessage}</p>}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom Navigation - Adjusted for sidebar offset on desktop */}
      <div className="fixed bottom-0 left-0 right-0 bg-orange-500/95 backdrop-blur-sm text-white p-4 z-10 lg:pl-64">
        <div className="flex justify-center items-center">
          <span className="text-xs sm:text-sm font-medium">Copyright © 2025 MDRRMO-Bulan Sorsogon</span>
        </div>
      </div>
    </div>
  )
}
