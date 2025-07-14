"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase" // Assuming supabase is already configured
import { Bell, CheckCircle } from "lucide-react" // For notification icon and read icon

// Firebase Imports (ensure these are correctly installed: npm install firebase)
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, orderBy, onSnapshot, updateDoc, doc, getDocs } from 'firebase/firestore';

// Define interfaces for data structures
interface Notification {
  id: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  recipientUserId: string;
  reportId?: string; // Optional: link to a specific report
}

interface Report {
  id: string;
  title: string;
  description: string;
  status: string; // e.g., 'pending', 'in-progress', 'resolved'
  reportedAt: Date; // Timestamp when report was created
  respondedAt?: Date; // Timestamp when MDRRMO responded
  userId: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Firebase instances
  const [db, setDb] = useState<any>(null);
  const [auth, setAuth] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Initialize Firebase and authenticate
  useEffect(() => {
    try {
      const appId = process.env.NEXT_PUBLIC_APP_ID || 'default-app-id';
      const firebaseConfig = JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG || '{}');

      const app = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      const unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (currentUser) => {
        if (currentUser) {
          setUserId(currentUser.uid);
        } else {
          // Sign in anonymously if no user is logged in via custom token
          try {
            await signInAnonymously(firebaseAuth);
            setUserId(firebaseAuth.currentUser?.uid || crypto.randomUUID()); // Fallback for anonymous
          } catch (authError) {
            console.error("Firebase Auth Error:", authError);
            setError("Failed to authenticate with Firebase for real-time features.");
          }
        }
        setLoading(false); // Auth state ready
      });

      return () => unsubscribeAuth();
    } catch (e) {
      console.error("Firebase Initialization Error:", e);
      setError("Failed to initialize Firebase. Real-time features may not work.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch logged-in user data from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("mdrrmo_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      // Handle case where user is not logged in or session expired
      // Redirect to login or show appropriate message
      setError("User not logged in. Please log in to view dashboard.");
      setLoading(false);
    }
  }, []);

  // Real-time Notifications Listener
  useEffect(() => {
    if (!db || !userId) return; // Ensure Firebase is initialized and userId is available

    const notificationsCollectionRef = collection(db, `artifacts/${process.env.NEXT_PUBLIC_APP_ID}/public/data/notifications`);
    const q = query(
      notificationsCollectionRef,
      where("recipientUserId", "==", userId),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotifications: Notification[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(), // Convert Firestore Timestamp to Date object
      })) as Notification[];

      setNotifications(fetchedNotifications);
      setUnreadCount(fetchedNotifications.filter((n) => !n.isRead).length);
    }, (err) => {
      console.error("Error fetching real-time notifications:", err);
      setError("Failed to load real-time notifications.");
    });

    return () => unsubscribe(); // Clean up listener on component unmount
  }, [db, userId]); // Re-run if db or userId changes

  // Fetch User's Reports (also make it real-time for status updates)
  useEffect(() => {
    if (!db || !user?.id) return; // Ensure Firebase is initialized and user ID is available

    const reportsCollectionRef = collection(db, `artifacts/${process.env.NEXT_PUBLIC_APP_ID}/public/data/reports`);
    const q = query(
      reportsCollectionRef,
      where("userId", "==", user.id),
      orderBy("reportedAt", "desc") // Order by report time
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReports: Report[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        reportedAt: doc.data().reportedAt.toDate(), // Convert Firestore Timestamp to Date
        respondedAt: doc.data().respondedAt ? doc.data().respondedAt.toDate() : undefined, // Optional
      })) as Report[];
      setReports(fetchedReports);
    }, (err) => {
      console.error("Error fetching real-time reports:", err);
      setError("Failed to load real-time report history.");
    });

    return () => unsubscribe(); // Clean up listener
  }, [db, user?.id]); // Re-run if db or user.id changes

  const markAllNotificationsAsRead = useCallback(async () => {
    if (!db || !userId) return;

    setLoading(true);
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead);
      const batch = db.batch(); // Use a batch write for efficiency

      unreadNotifications.forEach(notification => {
        const notificationRef = doc(db, `artifacts/${process.env.NEXT_PUBLIC_APP_ID}/public/data/notifications`, notification.id);
        batch.update(notificationRef, { isRead: true });
      });

      await batch.commit();
      setUnreadCount(0); // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true }))); // Update local state
    } catch (err) {
      console.error("Error marking notifications as read:", err);
      setError("Failed to mark notifications as read.");
    } finally {
      setLoading(false);
    }
  }, [db, userId, notifications]);


  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-lg">Loading Dashboard...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600 text-lg">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Welcome, {user?.firstName || "User"}!</h1>

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
              disabled={loading}
              className="bg-blue-800 hover:bg-blue-900 text-white text-sm py-1 px-3 rounded-full flex items-center"
            >
              <CheckCircle size={16} className="mr-1" />
              {loading ? "Marking..." : "Mark All as Read"}
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
                    {notification.timestamp.toLocaleString()}
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
                      <td className="py-3 px-4 text-sm text-gray-800">{report.reportedAt.toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-gray-800">
                        {report.respondedAt ? report.respondedAt.toLocaleString() : "N/A"}
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
