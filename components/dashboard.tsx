"use client"

  import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Capacitor } from "@capacitor/core"
import type { PluginListenerHandle } from "@capacitor/core"
import { App } from "@capacitor/app"
import { Geolocation } from "@capacitor/geolocation"
  import { Button } from "@/components/ui/button"
  import { AlertTriangle, Menu, User, LogOut, Bell, History, Info, Phone, Edit, Mail, X, Send, FireExtinguisher, HeartPulse, Car, CloudRain, LandPlot, HelpCircle, Swords, PersonStanding, MapPin, RefreshCcw, Megaphone } from "lucide-react" // Added Swords for Armed Conflict
  import { UserSidebar } from "./user_sidebar"
  import { LocationPermissionModal } from "./location-permission-modal"
import { supabase } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { Input } from "@/components/ui/input"
  import { Textarea } from "@/components/ui/textarea"
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
  import { formatDistanceToNowStrict, parseISO } from 'date-fns';
  import { FeedbackHistory } from "@/components/feedback-history"
import { ReportDetailModal } from "@/components/ReportDetailModal"
import { useAppStore } from '@/lib/store'
import { NotificationPermissionBanner } from './NotificationPermissionBanner'
  import type { AppState } from '@/lib/store'
  import { initMobileState, destroyMobileState, notifications$, userReports$ as mobileUserReports$, type MobileNotification, type MobileReport } from '@/lib/mobileState'
import { useRouter } from 'next/navigation'
import { usePushNotifications } from '@/components/providers/PushNotificationsProvider'

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
  casualties?: number;
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

interface Advisory {
  id: string;
  preset: string | null;
  title: string | null;
  body: string | null;
  expires_at: string | null;
  created_at: string | null;
  created_by: string | null;
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
  { type: 'Public Disturbance', icon: PersonStanding }, // Changed name, new icon
  { type: 'Others', icon: (props: any) => <HelpCircle className="text-orange-500" {...props} /> },
];

const formatMobileNumberForInput = (value: string | null | undefined) => {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length >= 12) {
    return `0${digits.slice(2, 12)}`;
  }
  if (digits.startsWith("0") && digits.length >= 11) {
    return digits.slice(0, 11);
  }
  if (digits.startsWith("9") && digits.length >= 10) {
    return `0${digits.slice(0, 10)}`;
  }
  return digits.slice(0, 11);
};

export function Dashboard({ onLogout, userData }: DashboardProps) {
  const router = useRouter();
  const { playAlertSound, showBroadcastAlert } = usePushNotifications();
  const [isEmergencyActive, setIsEmergencyActive] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showSOSConfirm, setShowSOSConfirm] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  // Enhanced location permission handling
  const isNativePlatform = useMemo(() => Capacitor.isNativePlatform(), []);
  const locationPermissionGrantedRef = useRef<boolean>(false);
  const locationWatchIdRef = useRef<string | number | null>(null);

  const stopLocationWatch = useCallback(() => {
    if (locationWatchIdRef.current == null) return;
    if (isNativePlatform) {
      Geolocation.clearWatch({ id: locationWatchIdRef.current as string }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.geolocation?.clearWatch) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current as number);
    }
    locationWatchIdRef.current = null;
  }, [isNativePlatform]);

  const startLocationWatch = useCallback(() => {
    if (locationWatchIdRef.current != null) return;
    if (isNativePlatform) {
      Geolocation.watchPosition({ enableHighAccuracy: true, maximumAge: 1000 }, (position, err) => {
        if (err) {
          console.warn('Native geolocation watch error:', err);
          locationPermissionGrantedRef.current = false;
          if ((err as any)?.code === 1) {
            setLocationError('location_denied');
            setShowLocationModal(true);
          }
          void stopLocationWatch();
          return;
        }
        if (position?.coords) {
          setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          setLocationError(null);
          locationPermissionGrantedRef.current = true;
        }
      })
        .then(id => {
          locationWatchIdRef.current = id;
        })
        .catch(error => {
          console.warn('Failed to start native geolocation watch:', error);
        });
    } else if (typeof navigator !== 'undefined' && navigator.geolocation?.watchPosition) {
      const watchId = navigator.geolocation.watchPosition(
        pos => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationError(null);
          locationPermissionGrantedRef.current = true;
        },
        err => {
          console.warn('Browser geolocation watch error:', err);
          if (err.code === err.PERMISSION_DENIED) {
            locationPermissionGrantedRef.current = false;
            setLocationError('location_denied');
            setShowLocationModal(true);
            stopLocationWatch();
          }
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
      );
      locationWatchIdRef.current = watchId;
    }
  }, [isNativePlatform, stopLocationWatch]);

  const checkLocationPermission = useCallback(async (): Promise<boolean> => {
    if (isNativePlatform) {
      try {
        const permission = await Geolocation.checkPermissions();
        const locationPermission = permission.location;

        const ensurePermissionGranted = async () => {
          if (locationPermission === 'granted') {
            return true;
          }

          const requestResult = await Geolocation.requestPermissions();
          const requestedLocationPermission = requestResult.location;
          return requestedLocationPermission === 'granted';
        };

        const granted = await ensurePermissionGranted();
        if (!granted) {
            setLocationError('location_denied');
            setShowLocationModal(true);
            locationPermissionGrantedRef.current = false;
            stopLocationWatch();
            return false;
        }

        locationPermissionGrantedRef.current = true;
        startLocationWatch();
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationError(null);
        setShowLocationModal(false);
        return true;
      } catch (error: any) {
        console.error('Capacitor geolocation error:', error);
        const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
        if (message.includes('location services are not enabled') || message.includes('location service needs to be enabled')) {
          setLocationError('location_services_disabled');
        } else {
          setLocationError('location_error');
        }
        setShowLocationModal(true);
        locationPermissionGrantedRef.current = false;
        stopLocationWatch();
        return false;
      }
    }

    if (!navigator.geolocation) {
      setLocationError('not_supported');
      setShowLocationModal(true);
      locationPermissionGrantedRef.current = false;
      stopLocationWatch();
      return false;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });

      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      setLocationError(null);
      setShowLocationModal(false);
      locationPermissionGrantedRef.current = true;
      startLocationWatch();
      return true;
    } catch (error: any) {
      console.error('Error getting location:', error);

      if (error.code === error.PERMISSION_DENIED) {
        setLocationError('location_denied');
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        setLocationError('location_unavailable');
      } else if (error.code === error.TIMEOUT) {
        setLocationError('location_timeout');
      } else {
        setLocationError('location_error');
      }

      setShowLocationModal(true);
      locationPermissionGrantedRef.current = false;
      stopLocationWatch();
      return false;
    }
  }, [isNativePlatform, startLocationWatch, stopLocationWatch]);

  const ensureLocationReady = useCallback(async () => {
    if (locationPermissionGrantedRef.current) {
      startLocationWatch();
    } else {
      await checkLocationPermission();
    }
  }, [checkLocationPermission, startLocationWatch]);

  // Handle location permission request from modal
  const handleRequestLocation = useCallback(async (): Promise<boolean> => {
    if (isNativePlatform) {
      return checkLocationPermission();
    }

    if (!navigator.permissions) {
      // Fallback for browsers that don't support the Permissions API
      return checkLocationPermission();
    }

    try {
      const permissionStatus = await navigator.permissions.query({ 
        name: 'geolocation' as PermissionName 
      });

      const handlePermissionChange = () => {
        if (permissionStatus.state === 'granted') {
          void checkLocationPermission();
        } else if (permissionStatus.state === 'denied') {
          setLocationError('location_denied');
          setShowLocationModal(true);
        }
      };

      permissionStatus.onchange = handlePermissionChange;

      if (permissionStatus.state === 'granted') {
        return checkLocationPermission();
      }

      if (permissionStatus.state === 'prompt') {
        setShowLocationModal(true);
        const granted = await checkLocationPermission();
        if (!granted) {
          setShowLocationModal(true);
        }
        return granted;
      }

      setLocationError('location_denied');
      setShowLocationModal(true);
      return false;
    } catch (error) {
      console.error('Error checking location permission:', error);
      setShowLocationModal(true);
      return false;
    }
  }, [checkLocationPermission, isNativePlatform]);

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [currentView, setCurrentView] = useState<'main' | 'reportHistory' | 'mdrrmoInfo' | 'hotlines' | 'userProfile' | 'sendFeedback'>('main');
  const [hasLoadedUserData, setHasLoadedUserData] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [reportPage, setReportPage] = useState<number>(1);
  const PAGE_SIZE = 10;
  const MIN_HIDDEN_MS_BEFORE_REFRESH = 5000; // Skip refresh for quick tab switches (<5s)

  // State for deep-linked report modal
  const [deepLinkedReport, setDeepLinkedReport] = useState<Report | null>(null);
  const [isReportDetailModalOpen, setIsReportDetailModalOpen] = useState(false);

  // Minimal Zustand sync (currentUser provisioning for other components if needed)
  const setStoreCurrentUser = useAppStore((s: AppState) => s.setCurrentUser)

  // Refs for click outside detection
  const notificationsRef = useRef<HTMLDivElement>(null);
  const notificationsButtonRef = useRef<HTMLButtonElement>(null);
  const isResumingRef = useRef<boolean>(false);
  const lastResumeAtRef = useRef<number>(0);
  const RESUME_COOLDOWN_MS = 1000; // Tighter throttle: single refresh within ~1s on resume
  const lastHiddenAtRef = useRef<number | null>(null);

  // States for User Profile editing
  const [editingMobileNumber, setEditingMobileNumber] = useState<string>('');
  const [editingUsername, setEditingUsername] = useState<string>('');
  const [profileEditSuccess, setProfileEditSuccess] = useState<string | null>(null);
  const [profileEditError, setProfileEditError] = useState<string | null>(null);
  const [mobileNumberError, setMobileNumberError] = useState<string | null>(null);
  const [profileOtpMessageId, setProfileOtpMessageId] = useState<string | null>(null);
  const [profileOtpCode, setProfileOtpCode] = useState<string>('');
  const [profileOtpError, setProfileOtpError] = useState<string | null>(null);
  const [profileOtpSuccess, setProfileOtpSuccess] = useState<string | null>(null);
  const [isProfileOtpSending, setIsProfileOtpSending] = useState<boolean>(false);
  const [isProfileOtpVerifying, setIsProfileOtpVerifying] = useState<boolean>(false);
  const [isProfileOtpVerified, setIsProfileOtpVerified] = useState<boolean>(false);
  const [profileOtpResendTimer, setProfileOtpResendTimer] = useState<number>(0);

  const resetProfileOtpProgress = (verified: boolean) => {
    setIsProfileOtpVerified(verified);
    setProfileOtpMessageId(null);
    setProfileOtpCode('');
    setProfileOtpError(null);
    setProfileOtpSuccess(null);
    setProfileOtpResendTimer(0);
    setIsProfileOtpSending(false);
    setIsProfileOtpVerifying(false);
  };

  const formattedCurrentMobile = useMemo(() => {
    if (!currentUser?.mobileNumber) return '';
    const raw = String(currentUser.mobileNumber).replace(/\D/g, '');
    if (raw.startsWith('63') && raw.length === 12) {
      return `0${raw.slice(2)}`;
    }
    if (raw.startsWith('0') && raw.length === 11) {
      return raw;
    }
    if (raw.startsWith('9') && raw.length === 10) {
      return `0${raw}`;
    }
    return raw;
  }, [currentUser?.mobileNumber]);

  const mobileNumberHasChanged = useMemo(() => {
    if (!formattedCurrentMobile) {
      return editingMobileNumber.length > 0;
    }
    return editingMobileNumber !== formattedCurrentMobile;
  }, [formattedCurrentMobile, editingMobileNumber]);

  const profileMobileDisplay = useMemo(() => formattedCurrentMobile, [formattedCurrentMobile]);

  useEffect(() => {
    if (profileOtpResendTimer <= 0) return;
    const timer = setInterval(() => {
      setProfileOtpResendTimer(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [profileOtpResendTimer]);

  // Ban gate: if user is banned (permanent or until future), block app usage and show notice
  const isUserBanned = useMemo(() => {
    const u = currentUser;
    if (!u || !u.is_banned) return false;
    // Permanent ban if no banned_until; otherwise ban active until future date
    if (!u.banned_until) return true;
    const until = new Date(u.banned_until).getTime();
    return isFinite(until) && until > Date.now();
  }, [currentUser]);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNotifications && 
          notificationsRef.current && 
          !notificationsRef.current.contains(event.target as Node) &&
          notificationsButtonRef.current &&
          !notificationsButtonRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // State for Send Feedback
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [feedbackSentMessage, setFeedbackSentMessage] = useState<string | null>(null);
  const [feedbackErrorMessage, setFeedbackErrorMessage] = useState<string | null>(null);

  // States for fetched data for new sections
  const [userReports, setUserReports] = useState<Report[]>([]);
  const [mdrrmoInformation, setMdrrmoInformation] = useState<MdrrmoInfo | null>(null);
  const [bulanHotlines, setBulanHotlines] = useState<Hotline[]>([]);
  const [activeAdvisory, setActiveAdvisory] = useState<Advisory | null>(null);

  const reportsSource = userReports;
  const notificationsSource = notifications;
  const unreadNotificationsCount = useMemo(() => (notificationsSource || []).filter(n => !n.is_read).length, [notificationsSource]);
  const totalReportPages = useMemo(() => Math.max(1, Math.ceil((reportsSource?.length || 0) / PAGE_SIZE)), [reportsSource?.length]);
  const paginatedReports = useMemo(() => {
    const src = reportsSource || [];
    const start = (reportPage - 1) * PAGE_SIZE;
    return src.slice(start, start + PAGE_SIZE);
  }, [reportsSource, reportPage]);

  useEffect(() => {
    if (reportPage > totalReportPages) setReportPage(totalReportPages);
  }, [totalReportPages, reportPage]);

  // New states for incident type buttons and cooldown
  const [selectedIncidentTypeForConfirmation, setSelectedIncidentTypeForConfirmation] = useState<string | null>(null);
  const [customEmergencyType, setCustomEmergencyType] = useState<string>('');
  const [showCustomEmergencyInput, setShowCustomEmergencyInput] = useState<boolean>(false);
  const [casualties, setCasualties] = useState<string>('');
  const [cooldownActive, setCooldownActive] = useState<boolean>(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0); // in seconds
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // New state for report credits, initialized from localStorage with user-specific keys
  const [reportCredits, setReportCredits] = useState<number>(3); // Default to max 3 credits
  
  // Track when credits were consumed for replenishment
  const [creditConsumptionTimes, setCreditConsumptionTimes] = useState<number[]>([]);
  const provisionalTimeRef = useRef<number | null>(null);
  
  // Get user-specific storage key
  const getCreditStorageKey = useCallback((suffix: string) => {
    return currentUser ? `mdrrmo_${currentUser.id}_${suffix}` : null;
  }, [currentUser?.id]);
  
  // Load user's credits when user changes
  useEffect(() => {
    if (!currentUser?.id) return;
    
    const creditsKey = getCreditStorageKey('reportCredits');
    const timesKey = getCreditStorageKey('creditConsumptionTimes');
    
    if (creditsKey && timesKey) {
      // Load consumption times (source of truth) and compute credits
      const storedTimes = localStorage.getItem(timesKey);
      if (storedTimes) {
        try {
          const parsedTimes = JSON.parse(storedTimes);
          if (Array.isArray(parsedTimes)) {
            // Keep only last 10 minutes
            const now = Date.now();
            const tenMinutes = 10 * 60 * 1000;
            const validTimes = parsedTimes.filter((ts: number) => (now - ts) < tenMinutes);
            setCreditConsumptionTimes(validTimes);
            const used = validTimes.length;
            setReportCredits(Math.max(0, 3 - used));
          }
        } catch (e) {
          console.error('Error parsing stored credit times:', e);
          setCreditConsumptionTimes([]);
          setReportCredits(3);
        }
      } else {
        setCreditConsumptionTimes([]);
        setReportCredits(3);
      }
    }
  }, [currentUser?.id, getCreditStorageKey]);
  
  // Track active cooldown timers
  const [activeCooldowns, setActiveCooldowns] = useState<number[]>([]);

  // Recompute credits and cooldowns based on stored consumption times
  const reconcileCooldownsAndCredits = useCallback(() => {
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;

    // Keep only recent consumption timestamps (within last 10 minutes)
    const validTimes = creditConsumptionTimes.filter(ts => (now - ts) < tenMinutes);
    if (validTimes.length !== creditConsumptionTimes.length) {
      setCreditConsumptionTimes(validTimes);
    }

    // Build cooldown deadlines from valid times
    const newCooldowns = validTimes.map(ts => ts + tenMinutes);
    setActiveCooldowns(newCooldowns);

    // Compute credits from remaining uses
    const used = validTimes.length;
    const newCredits = Math.max(0, 3 - used);
    setReportCredits(newCredits);

    // Update cooldown visual states
    if (newCooldowns.length > 0) {
      const nextMs = Math.max(0, Math.min(...newCooldowns) - now);
      setCooldownRemaining(Math.ceil(nextMs / 1000));
      setCooldownActive(newCredits === 0);
    } else {
      setCooldownRemaining(0);
      setCooldownActive(false);
    }
  }, [creditConsumptionTimes]);

  useEffect(() => {
    if (activeCooldowns.length === 0) {
      setCooldownRemaining(0);
      setCooldownActive(false);
      return;
    }

    const tick = () => {
      const now = Date.now();
      const nextExpiry = Math.min(...activeCooldowns);
      const msRemaining = Math.max(0, nextExpiry - now);
      const secondsRemaining = Math.ceil(msRemaining / 1000);
      setCooldownRemaining(secondsRemaining > 0 ? secondsRemaining : 0);
      setCooldownActive(reportCredits === 0 && secondsRemaining > 0);
      if (msRemaining <= 0) {
        reconcileCooldownsAndCredits();
      }
    };

    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [activeCooldowns, reconcileCooldownsAndCredits, reportCredits]);

  // Realtime channel refs
  const notificationsChannelRef = useRef<RealtimeChannel | null>(null);
  const userReportsChannelRef = useRef<RealtimeChannel | null>(null);
  const mdrrmoInfoChannelRef = useRef<RealtimeChannel | null>(null);
  const hotlinesChannelRef = useRef<RealtimeChannel | null>(null);
  const broadcastAlertsChannelRef = useRef<RealtimeChannel | null>(null);
  const advisoriesChannelRef = useRef<RealtimeChannel | null>(null);

  const cleanupRealtime = useCallback(() => {
    try {
      if (notificationsChannelRef.current) {
        supabase.removeChannel(notificationsChannelRef.current);
        notificationsChannelRef.current = null;
      }
      if (userReportsChannelRef.current) {
        supabase.removeChannel(userReportsChannelRef.current);
        userReportsChannelRef.current = null;
      }
      if (mdrrmoInfoChannelRef.current) {
        supabase.removeChannel(mdrrmoInfoChannelRef.current);
        mdrrmoInfoChannelRef.current = null;
      }
      if (hotlinesChannelRef.current) {
        supabase.removeChannel(hotlinesChannelRef.current);
        hotlinesChannelRef.current = null;
      }
      if (broadcastAlertsChannelRef.current) {
        supabase.removeChannel(broadcastAlertsChannelRef.current);
        broadcastAlertsChannelRef.current = null;
      }
      if (advisoriesChannelRef.current) {
        supabase.removeChannel(advisoriesChannelRef.current);
        advisoriesChannelRef.current = null;
      }
    } catch {}
  }, []);

  // setupRealtime is defined after loader functions

  // Function to load notifications for the current user
  const loadNotifications = useCallback(async (userId: string) => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("user_notifications")
      .select("id, emergency_report_id, message, is_read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50); // Limit for low bandwidth environments

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
      .select('id, emergency_type, status, admin_response, resolved_at, created_at') // Narrow columns for lower egress
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100); // Limit for low bandwidth environments

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
      .select('id, content')
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
      .select('id, name, number, description')
      .order('name', { ascending: true });

    if (!error && data) {
      setBulanHotlines(data as Hotline[]);
    } else if (error) {
      console.error("Error loading Bulan Hotlines:", error);
    }
  }, []);

  // Function to load Active Advisory (only non-expired advisories are returned via RLS)
  const loadActiveAdvisory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('advisories')
        .select('id, preset, title, body, expires_at, created_at, created_by')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) {
        console.error('Error loading advisories:', error);
        setActiveAdvisory(null);
        return;
      }
      const row = (data || [])[0] as Advisory | undefined;
      setActiveAdvisory(row || null);
    } catch (e) {
      console.error('Error loading advisories:', e);
      setActiveAdvisory(null);
    }
  }, []);

  // Auto-refresh advisory display exactly at expiry so Welcome card returns
  useEffect(() => {
    if (!activeAdvisory?.expires_at) return;
    const expiryMs = new Date(activeAdvisory.expires_at).getTime();
    const now = Date.now();
    if (!isFinite(expiryMs) || expiryMs <= now) return;
    const delay = Math.min(Math.max(0, expiryMs - now + 300), 24 * 60 * 60 * 1000); // cap 24h
    const timer = setTimeout(() => { void loadActiveAdvisory(); }, delay);
    return () => clearTimeout(timer);
  }, [activeAdvisory?.expires_at, loadActiveAdvisory]);

  // Realtime setup after loaders are defined
  const setupRealtime = useCallback((userId: string) => {
    if (!userId) return;
    // Ensure clean state
    cleanupRealtime();

    notificationsChannelRef.current = supabase
      .channel(`user_notifications_channel_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          void loadNotifications(userId)
          try {
            // Play a lightweight notification sound for new inserts only
            // Avoid playing for updates/deletes
            if ((payload as any)?.eventType === 'INSERT') {
              void playAlertSound('notification')
            }
          } catch {}
        }
      )
      .subscribe();

    userReportsChannelRef.current = supabase
      .channel(`user_reports_channel_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'emergency_reports', filter: `user_id=eq.${userId}` },
        (payload) => {
          loadUserReports(userId);
          // Refine cooldown with server timestamp
          if (payload.eventType === 'INSERT' && payload.new.user_id === userId) {
            const serverCreatedAt = new Date(payload.new.created_at).getTime();
            setCreditConsumptionTimes(prev => {
              const newTimes = [...prev];
              if (provisionalTimeRef.current) {
                const index = newTimes.indexOf(provisionalTimeRef.current);
                if (index > -1) {
                  newTimes[index] = serverCreatedAt;
                } else {
                  newTimes.push(serverCreatedAt);
                }
                provisionalTimeRef.current = null;
              } else {
                newTimes.push(serverCreatedAt);
              }
              return newTimes.sort((a, b) => a - b);
            });
          }
        }
      )
      .subscribe();

    mdrrmoInfoChannelRef.current = supabase
      .channel('mdrrmo_info_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mdrrmo_info' },
        () => loadMdrrmoInfo()
      )
      .subscribe();

    hotlinesChannelRef.current = supabase
      .channel('hotlines_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hotlines' },
        () => loadBulanHotlines()
      )
      .subscribe();

    // Listen for broadcast alerts (earthquake/tsunami) for all users
    broadcastAlertsChannelRef.current = supabase
      .channel('broadcast_alerts_channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'broadcast_alerts' },
        (payload: any) => {
          try {
            console.log('[BroadcastAlert] incoming', payload?.new);
            const t = String(payload?.new?.type || '').toLowerCase();
            const title = payload?.new?.title || 'MDRRMO Alert';
            const body = payload?.new?.body || '';
            // Show a lightweight in-app notice
            try { console.log('[Broadcast Alert]', title, body); } catch {}
            if (t === 'earthquake' || t === 'tsunami') {
              showBroadcastAlert({
                type: t as 'earthquake' | 'tsunami',
                title,
                body,
                createdAt: payload?.new?.created_at || null,
              });
              if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                try {
                  navigator.vibrate?.([400, 200, 400]);
                } catch {}
              }
              void playAlertSound(t as 'earthquake' | 'tsunami');
            }
          } catch {}
        }
      )
      .subscribe();

    // Advisories: watch for create/update/expire and refresh active advisory
    advisoriesChannelRef.current = supabase
      .channel('advisories_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'advisories' },
        () => { void loadActiveAdvisory(); }
      )
      .subscribe();
  }, [cleanupRealtime, loadNotifications, loadUserReports, loadMdrrmoInfo, loadBulanHotlines, playAlertSound, showBroadcastAlert]);

  // Unified refresh helper to fetch all user-dependent data
  const refreshUserData = useCallback(async (userId: string) => {
    try {
      await Promise.all([
        loadNotifications(userId),
        loadUserReports(userId),
      ]);
    } catch (e) {
      console.warn('Partial failure while refreshing user lists:', e);
    }

    // Fetch global data in parallel (not user-dependent)
    void loadMdrrmoInfo();
    void loadBulanHotlines();
    void loadActiveAdvisory();
  }, [loadNotifications, loadUserReports, loadMdrrmoInfo, loadBulanHotlines, loadActiveAdvisory]);

  // Shared refresh helper (optionally shows overlay)
  const runRefresh = useCallback(async (showSpinner: boolean) => {
    const now = Date.now();
    if (now - lastResumeAtRef.current < RESUME_COOLDOWN_MS) return;
    lastResumeAtRef.current = now;

    if (isResumingRef.current) return;
    isResumingRef.current = true;

    const hideAt = Date.now() + 1000;
    if (showSpinner) setIsRefreshing(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) {
        onLogout();
        return;
      }
      await Promise.allSettled([
        loadNotifications(uid),
        loadUserReports(uid),
      ]);
      void loadMdrrmoInfo();
      void loadBulanHotlines();
      void loadActiveAdvisory();
    } catch (e) {
      console.warn('refresh error:', e);
    } finally {
      if (showSpinner) {
        const remaining = hideAt - Date.now();
        if (remaining > 0) {
          await new Promise(res => setTimeout(res, remaining));
        }
        setIsRefreshing(false);
      }
      isResumingRef.current = false;
    }
  }, [RESUME_COOLDOWN_MS, onLogout, loadNotifications, loadUserReports, loadMdrrmoInfo, loadBulanHotlines, loadActiveAdvisory, isNativePlatform]);

  const quickRefresh = useCallback(async () => {
    await runRefresh(true);
  }, [runRefresh]);

  const silentRefresh = useCallback(async () => {
    await runRefresh(false);
  }, [runRefresh]);

  // Force full re-initialization (session -> user -> data -> realtime -> location -> cooldowns)
  const forceReinit = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user?.id) {
        onLogout();
        return;
      }
      const userId = sessionData.session.user.id;
      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      if (!userProfile) {
        onLogout();
        return;
      }
      setCurrentUser(userProfile);
      setEditingMobileNumber(formatMobileNumberForInput(userProfile.mobileNumber));
      setEditingUsername(userProfile.username || '');

      await refreshUserData(userId);
      setupRealtime(userId);

      // Try to refresh location silently
      await checkLocationPermission();

      // Reconcile credits/cooldowns
      reconcileCooldownsAndCredits();
    } catch (e) {
      console.warn('forceReinit error:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [onLogout, refreshUserData, setupRealtime, checkLocationPermission, reconcileCooldownsAndCredits]);

  // Removed old generic, non-user-scoped localStorage loader to prevent resets across app restarts

  // Effect to sync credits from storage on an interval (no cross-effects to avoid loops)
  useEffect(() => {
    const timesKey = getCreditStorageKey('creditConsumptionTimes');
    if (!timesKey) return;

    const updateFromStorage = () => {
      const storedTimes = localStorage.getItem(timesKey);
      let consumptionTimes: number[] = [];
      if (storedTimes) {
        try {
          const parsed = JSON.parse(storedTimes);
          if (Array.isArray(parsed)) {
            consumptionTimes = parsed;
          }
        } catch {}
      }

      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;
      const validTimes = consumptionTimes.filter(ts => (now - ts) < tenMinutes);

      // Persist pruned list if it changed length
      if (validTimes.length !== consumptionTimes.length) {
        localStorage.setItem(timesKey, JSON.stringify(validTimes));
      }

      // Update state only if actually changed (prevents render loops)
      setCreditConsumptionTimes(prev => {
        if (prev.length === validTimes.length && prev.every((v, i) => v === validTimes[i])) return prev;
        return validTimes;
      });

      const newCredits = Math.max(0, 3 - validTimes.length);
      setReportCredits(prev => (prev === newCredits ? prev : newCredits));
    };

    updateFromStorage();
    const interval = setInterval(updateFromStorage, 1000);
    return () => clearInterval(interval);
  }, [getCreditStorageKey]);
  
  // Effect to initialize cooldowns from credit consumption times
  useEffect(() => {
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;
    const newCooldowns = creditConsumptionTimes
      .filter(timestamp => (now - timestamp) < tenMinutes)
      .map(timestamp => timestamp + tenMinutes);

    setActiveCooldowns(newCooldowns);

    if (newCooldowns.length > 0) {
      const nextMs = Math.max(0, Math.min(...newCooldowns) - now);
      setCooldownRemaining(Math.ceil(nextMs / 1000));
    } else {
      setCooldownRemaining(0);
    }

    setCooldownActive(reportCredits === 0 && newCooldowns.length > 0);
  }, [creditConsumptionTimes, reportCredits]);

  // Effect to persist report credits, consumption times to user-specific localStorage
  useEffect(() => {
    if (!currentUser?.id) return;
    
    const creditsKey = getCreditStorageKey('reportCredits');
    const timesKey = getCreditStorageKey('creditConsumptionTimes');
    
    if (creditsKey && timesKey) {
      localStorage.setItem(creditsKey, reportCredits.toString());
      localStorage.setItem(timesKey, JSON.stringify(creditConsumptionTimes));
    }
  }, [reportCredits, creditConsumptionTimes, currentUser?.id, getCreditStorageKey]);


  // Main effect for initialization, data fetching, and real-time subscriptions
  useEffect(() => {
    let locationInitTimer: ReturnType<typeof setTimeout> | null = null;

    const initialize = async () => {
      // 1. Get session and user profile
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session?.user) {
        onLogout();
        return;
      }
      const user = sessionData.session.user;

      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !userProfile) {
        onLogout();
        return;
      }

      setCurrentUser(userProfile);
      setStoreCurrentUser(userProfile);
      setEditingMobileNumber(formatMobileNumberForInput(userProfile.mobileNumber));
      setEditingUsername(userProfile.username || '');

      // 2. Initial data fetch
      await Promise.all([
        loadNotifications(user.id),
        loadUserReports(user.id),
        loadMdrrmoInfo(),
        loadBulanHotlines(),
        loadActiveAdvisory(),
      ]);

      // 3. Set up real-time subscriptions
      setupRealtime(user.id);
      
      // 4. Handle location
      locationInitTimer = setTimeout(() => {
        void ensureLocationReady();
      }, 100);
      
      // 5. Reconcile credits
      reconcileCooldownsAndCredits();
    };
    
    initialize();

    // Listen for auth changes to re-initialize
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user?.id !== currentUser?.id) {
          initialize();
        }
      } else if (event === 'SIGNED_OUT') {
        onLogout();
      }
    });

    return () => {
      cleanupRealtime();
      authListener?.subscription?.unsubscribe();
      if (locationInitTimer) {
        clearTimeout(locationInitTimer);
      }
    };
  }, []); // Run only once on mount

  // Web: silent refresh when returning from background after minimum hidden duration
  useEffect(() => {
    if (isNativePlatform) return;
    const handleVisibility = () => {
      if (typeof document === 'undefined') return;
      const state = document.visibilityState;
      if (state === 'hidden') {
        lastHiddenAtRef.current = Date.now();
      } else if (state === 'visible') {
        const hiddenFor = lastHiddenAtRef.current ? Date.now() - lastHiddenAtRef.current : Number.POSITIVE_INFINITY;
        lastHiddenAtRef.current = null;
        void ensureLocationReady();
        if (hiddenFor >= MIN_HIDDEN_MS_BEFORE_REFRESH) {
          void silentRefresh();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isNativePlatform, silentRefresh, ensureLocationReady]);

  // Native: silent refresh on resume (runs in background) and check for deep-link intent
  useEffect(() => {
    if (!isNativePlatform) return;
    let resumeListener: PluginListenerHandle | undefined;
    App.addListener('resume', () => {
      void ensureLocationReady();
      if (currentUser?.id) {
        void silentRefresh();
        // Check for notification intent on resume
        const intentKey = `mdrrmo_${currentUser.id}_notificationIntent`;
        const intent = localStorage.getItem(intentKey);
        if (intent) {
          try {
            const { emergencyReportId, timestamp } = JSON.parse(intent);
            // Only handle if recent (e.g., within last minute)
            if (Date.now() - timestamp < 60000) {
              const report = userReports.find(r => r.id === emergencyReportId);
              if (report) {
                setDeepLinkedReport(report);
                setIsReportDetailModalOpen(true);
              }
            }
          } catch (e) {
            console.error("Error parsing notification intent:", e);
          }
          localStorage.removeItem(intentKey); // Clear intent after handling
        }
      }
    })
      .then((handle: PluginListenerHandle) => { resumeListener = handle; })
      .catch(() => {});
    return () => {
      try { resumeListener?.remove(); } catch {}
    };
  }, [isNativePlatform, silentRefresh, currentUser?.id, ensureLocationReady, userReports]);

  // Heartbeat to check for deep-link intent on web
  useEffect(() => {
    if (isNativePlatform || !currentUser?.id) return;

    const checkIntent = () => {
      const intentKey = `mdrrmo_${currentUser.id}_notificationIntent`;
      const intent = localStorage.getItem(intentKey);
      if (intent) {
        try {
          const { emergencyReportId, timestamp } = JSON.parse(intent);
          if (Date.now() - timestamp < 60000) {
            const report = userReports.find(r => r.id === emergencyReportId);
            if (report) {
              setDeepLinkedReport(report);
              setIsReportDetailModalOpen(true);
            }
          }
        } catch (e) {
          console.error("Error parsing notification intent:", e);
        }
        localStorage.removeItem(intentKey); // Clear intent after handling
      }
    };

    const interval = setInterval(checkIntent, 1000);
    return () => clearInterval(interval);
  }, [currentUser?.id, isNativePlatform, userReports]);

  // Native (Ionic/Capacitor) mobile state: subscribe to RxJS streams
  useEffect(() => {
    if (!isNativePlatform || !currentUser?.id) return;
    initMobileState(currentUser.id);
    const notifSub = notifications$.subscribe((list: MobileNotification[]) => setNotifications(list as any));
    const reportsSub = mobileUserReports$.subscribe((list: MobileReport[]) => setUserReports(list as any));
    return () => {
      try { notifSub.unsubscribe() } catch {}
      try { reportsSub.unsubscribe() } catch {}
      destroyMobileState();
    };
  }, [isNativePlatform, currentUser?.id]);


  // Modified confirmSOS to accept emergencyType
  const confirmSOS = async (emergencyType: string) => {
    if (!currentUser) {
      console.error("User not logged in");
      return;
    }

    // Ensure we have a fresh location right before sending
    let effectiveLocation = location;
    if (!effectiveLocation) {
      try {
        if (isNativePlatform) {
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
          effectiveLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(effectiveLocation);
        } else if (navigator.geolocation) {
          const pos: GeolocationPosition = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
          });
          effectiveLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(effectiveLocation);
        }
      } catch (e) {
        console.error('Unable to acquire location for SOS:', e);
      }
    }
    if (!effectiveLocation) {
      alert('Location is required to send an emergency alert. Please enable location services and try again.');
      return;
    }

    // Check if casualties are required and valid
    const requiresCasualties = [
      'Medical Emergency', 
      'Vehicular Incident', 
      'Public Disturbance'
    ].includes(selectedIncidentTypeForConfirmation || '');

    if (requiresCasualties) {
      if (!casualties) {
        alert('Please enter the number of casualties before sending the alert.');
        return;
      }
      
      const casualtiesNum = parseInt(casualties);
      if (isNaN(casualtiesNum) || casualtiesNum < 0) {
        alert('Please enter a valid number of casualties (0 or greater).');
        return;
      }
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
    setShowSOSConfirm(false);
    
    // Record a provisional time when credit was consumed
    const consumptionTime = Date.now();
    provisionalTimeRef.current = consumptionTime;
    
    // Immediately update the credit state to prevent double submissions
    setReportCredits(prev => {
      const newCredits = Math.max(0, prev - 1);
      return newCredits;
    });
    
    // Add a new cooldown timer for this consumption
    setActiveCooldowns(prev => [...prev, consumptionTime + (10 * 60 * 1000)]);
    
    // Save the consumption time for persistence
    setCreditConsumptionTimes(prev => [...prev, consumptionTime]);

    // Persist immediately to avoid losing state if app is closed quickly
    try {
      const timesKey = getCreditStorageKey('creditConsumptionTimes');
      const creditsKey = getCreditStorageKey('reportCredits');
      if (timesKey) {
        const nextTimes = [...creditConsumptionTimes, consumptionTime];
        localStorage.setItem(timesKey, JSON.stringify(nextTimes));
      }
      if (creditsKey) {
        const nextCredits = Math.max(0, reportCredits - 1);
        localStorage.setItem(creditsKey, nextCredits.toString());
      }
    } catch {}

    try {
      let locationAddress = "Location unavailable";
      try {
        // Use our local API endpoint to avoid CORS issues
        const response = await fetch(
          `/api/geocode?lat=${effectiveLocation.lat}&lon=${effectiveLocation.lng}`
        );
        
        if (!response.ok) {
          throw new Error(`Geocoding API error: ${response.status}`);
        }
        
        const data = await response.json();
        locationAddress = data.display_name || `${effectiveLocation.lat}, ${effectiveLocation.lng}`;
      } catch (err) {
        console.error("Geocoding error:", err);
        // Fallback to coordinates if geocoding fails
        locationAddress = `${effectiveLocation.lat.toFixed(6)}, ${effectiveLocation.lng.toFixed(6)}`;
      }

      // Determine the emergency type to store
      const reportEmergencyType = selectedIncidentTypeForConfirmation === 'Others' 
        ? `Other: ${customEmergencyType}` 
        : emergencyType;

      // Check if casualties are required for this emergency type
      const requiresCasualties = [
        'Medical Emergency', 
        'Vehicular Incident', 
        'Public Disturbance'
      ].includes(selectedIncidentTypeForConfirmation || '');

      // Prepare report data with type assertion to include casualties
      const reportPayload: Omit<Report, 'id'> = {
        user_id: currentUser.id,
        firstName: currentUser.firstName,
        middleName: currentUser.middleName || null,
        lastName: currentUser.lastName,
        mobileNumber: currentUser.mobileNumber,
        latitude: effectiveLocation.lat,
        longitude: effectiveLocation.lng,
        location_address: locationAddress,
        emergency_type: reportEmergencyType,
        status: "active",
        created_at: new Date().toISOString(),
        reportedAt: new Date().toISOString(),
        reporterMobile: currentUser.mobileNumber,
      };

      // Add casualties to report if required
      if (requiresCasualties && casualties) {
        // Use type assertion to add casualties
        (reportPayload as any).casualties = parseInt(casualties) || 0;
      }

      const { data: reportData, error: reportError } = await supabase
        .from("emergency_reports")
        .insert(reportPayload)
        .select()
        .single()

      if (reportError) {
        console.error("Error creating report:", reportError);
        console.error("Supabase Report Insert Error Details:", reportError);
        console.error("Failed to send emergency alert: Please check Supabase RLS policies for 'emergency_reports' INSERT operation, or schema constraints.");
        setIsEmergencyActive(false); // Deactivate if report fails
        // Refund credit if report fails
        setCreditConsumptionTimes(prev => prev.filter(t => t !== consumptionTime));
        setReportCredits(prev => Math.min(3, prev + 1));
        return;
      }

      await supabase.from("admin_notifications").insert({
        emergency_report_id: reportData.id,
        message: `🚨 NEW EMERGENCY ALERT: ${currentUser.firstName} ${currentUser.lastName} reported: ${reportEmergencyType} at ${locationAddress}`,
        is_read: false,
        type: 'new_report',
        created_at: new Date().toISOString(),
      });

      console.log(`Emergency alert for ${reportEmergencyType} sent successfully!`);

      await supabase.from("user_notifications").insert({
        user_id: currentUser.id,
        emergency_report_id: reportData.id,
        message: `Your emergency alert for "${reportEmergencyType}" has been sent. Help is on the way!`,
        is_read: false,
        created_at: new Date().toISOString(),
      });

      // Reset the form after successful submission
      setSelectedIncidentTypeForConfirmation(null);
      setCustomEmergencyType('');
      setShowCustomEmergencyInput(false);

      // Visual active state for 5 seconds
      setTimeout(() => {
        setIsEmergencyActive(false);
      }, 5000);
    } catch (error: any) {
      console.error("SOS Error:", error);
      console.error("Failed to send emergency alert: " + error.message);
      setIsEmergencyActive(false);
      // Optionally, if the report fails due to a network error *after* credit deduction,
      // you might want to refund the credit here.
    }
  }

  const cancelSOS = () => {
    setShowSOSConfirm(false);
    setShowCustomEmergencyInput(false);
    setSelectedIncidentTypeForConfirmation(null);
    setCustomEmergencyType('');
    setCasualties(''); // Reset casualties state
    // Reset any selected incident type to clear the "click again to confirm" text
    // No credit deduction or cooldown initiation here
  }

  const handleLogout = async () => {
    console.log("LOGOUT FUNCTION CALLED!")
    try {
      // Clear local session first
      localStorage.removeItem("mdrrmo_user");
      setShowUserMenu(false);
      
      // Then call the parent's logout handler which will handle the Supabase sign out
      onLogout();
    } catch (err) {
      console.error("Error during logout:", err);
      // Even if there's an error, we should still proceed with the logout
      onLogout();
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
      await loadNotifications(currentUser.id);
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
      await loadNotifications(currentUser.id);
    }
  };

  const sendProfileOtp = async () => {
    if (!mobileNumberHasChanged) {
      setProfileOtpError("Mobile number has not changed.");
      setProfileOtpSuccess(null);
      return;
    }
    if (editingMobileNumber.length !== 10) {
      setMobileNumberError('Please complete the mobile number (10 digits required).');
      setProfileOtpError("Please provide a valid mobile number before requesting a code.");
      setProfileOtpSuccess(null);
      return;
    }

    setIsProfileOtpSending(true);
    setProfileOtpError(null);
    setProfileOtpSuccess(null);
    setProfileOtpCode('');

    try {
      const response = await fetch("/api/semaphore/otp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mobileNumber: editingMobileNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to send verification code.");
      }

      if (!data?.messageId) {
        throw new Error("Semaphore did not return a verification reference.");
      }

      setProfileOtpMessageId(data.messageId);
      setProfileOtpSuccess("Verification code sent to your mobile number.");
      setIsProfileOtpVerified(false);
      setProfileOtpResendTimer(60);
    } catch (error: any) {
      setProfileOtpError(error?.message || "Failed to send verification code.");
    } finally {
      setIsProfileOtpSending(false);
    }
  };

  const verifyProfileOtp = async () => {
    if (!profileOtpMessageId) {
      setProfileOtpError("Please request a verification code first.");
      return;
    }

    if (!profileOtpCode.trim()) {
      setProfileOtpError("Please enter the verification code.");
      return;
    }

    setIsProfileOtpVerifying(true);
    setProfileOtpError(null);
    setProfileOtpSuccess(null);

    try {
      const response = await fetch("/api/semaphore/otp/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messageId: profileOtpMessageId, code: profileOtpCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Verification failed.");
      }

      setIsProfileOtpVerified(true);
      setProfileOtpSuccess("Mobile number verified.");
    } catch (error: any) {
      setIsProfileOtpVerified(false);
      setProfileOtpError(error?.message || "Verification failed.");
    } finally {
      setIsProfileOtpVerifying(false);
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

    // Validate mobile number
    if (!/^09\d{9}$/.test(editingMobileNumber)) {
      setMobileNumberError('Please provide a valid mobile number starting with 09 (11 digits).');
      return;
    }

    if (mobileNumberHasChanged && !isProfileOtpVerified) {
      setProfileEditError("Please verify the new mobile number before updating.");
      setProfileOtpError("Please verify the new mobile number before updating.");
      return;
    }

    try {
      const digits = editingMobileNumber.replace(/\D/g, '');
      const fullMobileNumber = digits.startsWith('09') ? `63${digits.slice(1)}` : digits;
      const { data, error } = await supabase
        .from('users')
        .update({
          mobileNumber: fullMobileNumber,
          username: editingUsername,
        })
        .eq('id', currentUser.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setCurrentUser(data);
      setEditingMobileNumber(formatMobileNumberForInput(data.mobileNumber));
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
    if (cooldownActive || reportCredits === 0) {
      console.log("Cannot send alert: Cooldown active or no credits remaining.");
      return;
    }
    
    // Reset casualties when changing incident type
    setCasualties('');
    
    if (type === 'Others') {
      setShowCustomEmergencyInput(true);
      setSelectedIncidentTypeForConfirmation('Others');
    } else {
      setShowCustomEmergencyInput(false);
      setSelectedIncidentTypeForConfirmation(type);
      setShowSOSConfirm(true);
    }
  };

  // Format cooldown time for display
  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isUserBanned) {
    return (
      <div className="min-h-screen bg-white">
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm shadow-2xl">
            <CardHeader className="bg-red-600 text-white rounded-t-lg">
              <CardTitle className="text-xl font-bold">Account Banned</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <p className="text-gray-800">Your account is currently banned and you cannot use the app.</p>
              {currentUser?.ban_reason && (
                <p className="text-sm"><span className="font-semibold">Reason:</span> {currentUser.ban_reason}</p>
              )}
              {currentUser?.banned_until ? (
                <p className="text-sm">
                  <span className="font-semibold">Duration:</span>{' '}
                  Until {new Date(currentUser.banned_until).toLocaleString()}
                </p>
              ) : (
                <p className="text-sm">This ban is currently permanent.</p>
              )}
              <p className="text-sm text-gray-600">
                If you believe this is an error, please contact MDRRMO support.
              </p>
              <Button onClick={() => router.push('/')} className="w-full">Return to Login</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-100 pb-20 lg:pb-24"
      style={{
        backgroundImage: "url('/images/mdrrmo_dashboard_bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Report Detail Modal for deep-linking */}
      <ReportDetailModal
        report={deepLinkedReport}
        isOpen={isReportDetailModalOpen}
        onClose={() => setIsReportDetailModalOpen(false)}
      />

      {/* Global Refreshing Overlay */}
      {isRefreshing && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute top-2 right-2 bg-black/60 text-white px-3 py-2 rounded-md text-sm flex items-center space-x-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span>Refreshing…</span>
          </div>
        </div>
      )}
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black/30 z-0"></div>
      
      {/* Location Permission Modal */}
      <LocationPermissionModal
        open={showLocationModal}
        onOpenChange={setShowLocationModal}
        onRequestPermission={handleRequestLocation}
        error={locationError}
      />

      {/* Header */}
      <div className="sticky top-0 z-30 bg-orange-500/95 backdrop-blur-sm text-white p-4 shadow-lg">
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
              <span className="font-medium text-lg">BULAN EMERGENCY APP</span>
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
                ref={notificationsButtonRef}
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 hover:bg-orange-600 rounded-full transition-colors relative"
                aria-label={showNotifications ? 'Hide notifications' : 'Show notifications'}
                aria-expanded={showNotifications}
              >
                <Bell className="w-6 h-6" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>
            </div>

            {/* Manual Refresh */}
            <div className="relative">
              <button
                onClick={() => window.location.reload()}
                className="p-2 hover:bg-orange-600 rounded-full transition-colors"
                aria-label="Refresh now"
                title="Refresh now"
              >
                <RefreshCcw className="w-6 h-6" />
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
        <div 
          ref={notificationsRef}
          className="fixed top-20 right-4 bg-white rounded-lg shadow-xl border border-gray-200 w-72 sm:w-80 max-h-96 overflow-y-auto z-50 animate-in fade-in-50 slide-in-from-top-2"
        >
          <div className="sticky top-0 bg-white z-10 p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
            <button
              onClick={() => setShowNotifications(false)}
              className="text-gray-500 hover:text-gray-700 transition-colors p-1 -mr-2"
              aria-label="Close notifications"
            >
              <X className="w-5 h-5" />
            </button>
            {(notificationsSource || []).some(n => !n.is_read) && (
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
            {(notificationsSource?.length || 0) === 0 ? (
              <div className="p-4 text-gray-500 text-center">No notifications</div>
            ) : (
              notificationsSource!.map((notification) => (
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
              <p className="text-sm font-medium text-gray-900">Hi {currentUser?.username || currentUser?.firstName || "User"}!</p>
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

      {/* Custom Emergency Type Input Modal */}
      {showCustomEmergencyInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Describe Emergency</h3>
              <p className="text-gray-600 mb-4">
                Please describe the type of emergency you're reporting.
              </p>
              <Textarea
                value={customEmergencyType}
                onChange={(e) => setCustomEmergencyType(e.target.value)}
                placeholder="E.g., Power outage, Gas leak, etc."
                className="w-full mb-4 min-h-[100px]"
              />
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <Button 
                  onClick={() => {
                    setShowCustomEmergencyInput(false);
                    setCustomEmergencyType('');
                  }} 
                  variant="outline" 
                  className="flex-1"
                >
                  CANCEL
                </Button>
                <Button 
                  onClick={() => {
                    if (customEmergencyType.trim()) {
                      setShowCustomEmergencyInput(false);
                      setShowSOSConfirm(true);
                    }
                  }}
                  disabled={!customEmergencyType.trim()}
                  className="flex-1 bg-red-500 hover:bg-red-600"
                >
                  CONFIRM
                </Button>
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
              <p className="text-gray-600 mb-4">
                This will send your location and details for a <span className="font-bold text-red-700">
                  {selectedIncidentTypeForConfirmation === 'Others' ? customEmergencyType : selectedIncidentTypeForConfirmation}
                </span> emergency to MDRRMO emergency responders.
              </p>
              
              {/* Casualties Input for relevant emergency types */}
              {['Medical Emergency', 'Vehicular Incident', 'Public Disturbance'].includes(selectedIncidentTypeForConfirmation || '') && (
                <div className="mb-4">
                  <label htmlFor="casualties" className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Casualties *
                  </label>
                  <Input
                    id="casualties"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Enter number of casualties"
                    value={casualties}
                    onChange={(e) => {
                      // Only allow numeric input
                      const value = e.target.value;
                      if (value === '' || /^\d+$/.test(value)) {
                        setCasualties(value);
                      }
                    }}
                    className="w-full"
                  />
                  {!casualties && (
                    <p className="mt-1 text-sm text-red-600">Please enter the number of casualties</p>
                  )}
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                <Button onClick={cancelSOS} variant="outline" className="flex-1 bg-transparent">
                  NO
                </Button>
                <Button 
                  onClick={() => confirmSOS(selectedIncidentTypeForConfirmation === 'Others' ? customEmergencyType : selectedIncidentTypeForConfirmation!)} 
                  disabled={['Medical Emergency', 'Vehicular Incident', 'Public Disturbance'].includes(selectedIncidentTypeForConfirmation || '') && !casualties}
                  className={`flex-1 bg-red-500 ${!['Medical Emergency', 'Vehicular Incident', 'Public Disturbance'].includes(selectedIncidentTypeForConfirmation || '') || casualties ? 'hover:bg-red-600' : 'opacity-50 cursor-not-allowed'}`}
                >
                  YES, SEND ALERT
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area - Adjusted for sidebar on desktop */}
      <div className="relative z-10 flex-1 flex flex-col items-center p-4 sm:p-8 lg:ml-64">
        {currentView === 'main' && (
          <>
            {/* Welcome Card with Logo */}
            {activeAdvisory ? (
              <Card className="w-full max-w-2xl mx-auto mb-6 bg-white/90 backdrop-blur-sm shadow-lg rounded-lg border border-orange-300">
                <CardHeader className="pb-2 flex flex-col items-center justify-center">
                  <Megaphone className="w-12 h-12 text-orange-600 mb-2" />
                  <CardTitle className="text-lg sm:text-xl font-bold text-orange-700 text-center mt-2">{activeAdvisory.title || 'MDRRMO Advisory'}</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-gray-700 text-sm sm:text-base whitespace-pre-wrap">
                  {activeAdvisory.body || ''}
                </CardContent>
              </Card>
            ) : (
              <Card className="w-full max-w-2xl mx-auto mb-6 bg-white/90 backdrop-blur-sm shadow-lg rounded-lg border border-orange-300">
                <CardHeader className="pb-2 flex flex-col items-center justify-center">
                  <img
                    src="/images/logo.png"
                    alt="MDRRMO Logo"
                    className="w-20 h-20 object-contain mb-2 mx-auto"
                    style={{ maxWidth: '80px', maxHeight: '80px' }}
                  />
                  <CardTitle className="text-lg sm:text-xl font-bold text-orange-700 text-center mt-2">WELCOME TO MDRRMO INCIDENT REPORTING SYSTEM APP</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-gray-700 text-sm sm:text-base">
                  SCROLL DOWN AND CLICK ANY INCIDENT TYPE TO SEND AN EMERGENCY ALERT TO MDRRMO RESPONDERS.
                
                  <CardContent className="text-center text-red-700 text-sm sm:text-base"></CardContent>
                  Available max credit is 3, Every Credits will be refreshed in 10 minutes
                </CardContent>
              </Card>
            )}
            <div className="text-center mb-8">
              <div className="space-y-2">
                <p className="text-white text-lg sm:text-xl font-semibold bg-black/50 p-3 rounded-lg shadow-md">
                  {`You have ${reportCredits} Credits left`}
                </p>
                {cooldownActive && (
                  <div className="bg-yellow-500 text-white px-6 py-3 rounded-full shadow-lg text-lg sm:text-xl font-bold">
                    Cooldown: {formatTime(cooldownRemaining)}
                  </div>
                )}
              </div>
            </div>

            {/* Incident Type Buttons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 max-w-3xl w-full mx-auto mb-24">
              {INCIDENT_TYPES.map((incident) => {
                const IconComponent = incident.icon;
                // Buttons are disabled if cooldown is active OR if credits are 0
                const isDisabled = cooldownActive || reportCredits === 0;
                const isSelected = selectedIncidentTypeForConfirmation === incident.type;

                return (
                  <div 
                    key={incident.type}
                    className={`relative group ${isDisabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={isDisabled ? undefined : () => handleIncidentTypeClick(incident.type)}
                  >
                    <div className={`
                      flex flex-col items-center justify-center p-5 sm:p-6 rounded-lg 
                      bg-white/75 border-2 border-orange-400 shadow-md hover:shadow-lg 
                      transition-all duration-200 h-full backdrop-blur-sm
                      ${isSelected ? 'ring-2 ring-orange-500 scale-[1.02]' : ''}
                      ${isDisabled ? 'bg-gray-100/75' : 'hover:bg-orange-50/75'}
                    `}>
                      <div className={`
                        w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center 
                        mb-3 transition-colors duration-200
                        ${isDisabled ? 'bg-gray-300' : 'bg-orange-100 group-hover:bg-orange-200'}
                        ${isSelected ? 'bg-orange-200' : ''}
                      `}>
                        <IconComponent className={`
                          w-8 h-8 sm:w-10 sm:h-10 
                          ${isDisabled ? 'text-gray-600' : incident.type === 'Others' ? 'text-orange-500' : 'text-orange-600'}
                        `} />
                      </div>
                      <span className={`
                        text-center font-semibold text-sm sm:text-base
                        ${isDisabled ? 'text-gray-600' : 'text-gray-800'}
                      `}>
                        {incident.type}
                      </span>
                    </div>
                    {isSelected && !isDisabled && (
                      <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        !
                      </div>
                    )}
                  </div>
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
          <Card className="w-full max-w-full lg:max-w-6xl bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4 sm:p-6 mb-20">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800">Your Report History</CardTitle>
            </CardHeader>
            <CardContent>
              {(reportsSource?.length || 0) === 0 ? (
                <p className="text-gray-600 text-center py-4">No emergency reports found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
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
                      {paginatedReports.map((report: Report) => (
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
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-gray-600">
                      Page {reportPage} of {totalReportPages}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setReportPage(p => Math.max(1, p - 1))}
                        disabled={reportPage <= 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setReportPage(p => Math.min(totalReportPages, p + 1))}
                        disabled={reportPage >= totalReportPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
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
                    type="tel" 
                    value={editingMobileNumber} 
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
                      if (value.length <= 11) {
                        const hasChanged = formattedCurrentMobile ? value !== formattedCurrentMobile : value.length > 0;
                        setEditingMobileNumber(value);
                        if (!/^09\d{0,9}$/.test(value)) {
                          setMobileNumberError('Please enter a valid PH mobile number starting with 09.');
                        } else if (value.length < 11) {
                          setMobileNumberError('Please complete the mobile number (11 digits required).');
                        } else {
                          setMobileNumberError(null);
                        }
                        resetProfileOtpProgress(!hasChanged);
                      }
                    }}
                    maxLength={11}
                    className={`${mobileNumberError ? 'border-red-500' : ''}`}
                    placeholder="09XXXXXXXXX"
                  />
                  {mobileNumberError && <p className="mt-2 text-sm text-red-600">{mobileNumberError}</p>}
                  <p className="mt-2 text-sm text-gray-600">Current saved number: {profileMobileDisplay || 'Not set'}</p>
                  {mobileNumberHasChanged && (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          id="profileOtpCode"
                          value={profileOtpCode}
                          onChange={(e) => setProfileOtpCode(e.target.value.replace(/\D/g, ''))}
                          maxLength={6}
                          placeholder="Enter code"
                          disabled={isProfileOtpVerified}
                          className="w-28 sm:w-32"
                        />
                        <Button
                          type="button"
                          onClick={sendProfileOtp}
                          disabled={isProfileOtpSending || profileOtpResendTimer > 0 || isProfileOtpVerified}
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                          {isProfileOtpSending
                            ? 'Sending...'
                            : profileOtpResendTimer > 0
                              ? `Resend in ${profileOtpResendTimer}s`
                              : isProfileOtpVerified
                                ? 'Verified'
                                : 'Send OTP'}
                        </Button>
                        <Button
                          type="button"
                          onClick={verifyProfileOtp}
                          disabled={isProfileOtpVerifying || !profileOtpMessageId || !profileOtpCode.trim() || isProfileOtpVerified}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {isProfileOtpVerifying ? 'Verifying...' : 'Verify'}
                        </Button>
                      </div>
                      {profileOtpError && <p className="text-sm text-red-600">{profileOtpError}</p>}
                      {profileOtpSuccess && <p className="text-sm text-green-600">{profileOtpSuccess}</p>}
                    </div>
                  )}
              </div>
              <Button onClick={handleProfileUpdate} disabled={!!mobileNumberError} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg">
                <Edit className="mr-2 h-4 w-4" /> Update Profile
              </Button>
              {profileEditSuccess && <p className="text-green-600 text-sm mt-2 text-center">{profileEditSuccess}</p>}

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
              {/* Feedback History section below the send form */}
              <div className="mt-8">
                <FeedbackHistory userId={currentUser.id} />
              </div>
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