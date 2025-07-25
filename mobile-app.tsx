"use client"

import { useState, useEffect } from "react"
import { RegisterPage } from "./components/register-page"
import { LoginPage } from "./components/login-page"
import {Dashboard} from "./components/dashboard" // Default import
import {AdminDashboard} from './components/admin-dashboard'; // Default import
import { supabase } from "@/lib/supabase" // Import supabase for logout

export default function MobileApp() {
  const [currentScreen, setCurrentScreen] = useState<"login" | "register" | "dashboard" | "admin">("login")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userData, setUserData] = useState<any>(null)

  useEffect(() => {
    // Check if user is already logged in and automatically redirect
    const storedUser = localStorage.getItem("mdrrmo_user")
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        setUserData(user)
        setIsLoggedIn(true)
        // Automatically set screen based on user type if logged in
        setCurrentScreen(user.user_type === "admin" ? "admin" : "dashboard")
      } catch (parseError) {
        console.error("Error parsing stored user data in MobileApp:", parseError);
        // If data is corrupted, clear it and force login
        localStorage.removeItem("mdrrmo_user");
        setIsLoggedIn(false);
        setUserData(null);
        setCurrentScreen("login"); // Fallback to login if parsing fails
      }
    } else {
      setCurrentScreen("login"); // Ensure it starts at login if no user is found
    }
  }, []) // Empty dependency array to run only once on mount

  // Handle successful registration
  const handleRegistrationSuccess = () => {
    setCurrentScreen("login")
  }

  // Handle successful login
  const handleLoginSuccess = (user: any) => {
    setUserData(user)
    setIsLoggedIn(true)
    setCurrentScreen(user.user_type === "admin" ? "admin" : "dashboard")
  }

  // Handle navigation to register
  const handleGoToRegister = () => {
    setCurrentScreen("register")
  }

  // Handle navigation to login
  const handleGoToLogin = () => {
    setCurrentScreen("login")
  }

  // Handle logout
  const handleLogout = async () => {
    try {
      // Clear local state first
      setUserData(null);
      setIsLoggedIn(false);
      setCurrentScreen("login");
      localStorage.removeItem("mdrrmo_user");
      
      // Then attempt to sign out from Supabase
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.warn("Supabase sign-out warning:", error.message);
          // Continue with logout flow even if Supabase sign-out fails
        }
      } catch (err) {
        console.warn("Error during Supabase sign-out (non-critical):", err);
        // Continue with logout flow even if Supabase sign-out fails
      }
    } catch (err) {
      console.error("Error during logout:", err);
      // Ensure we still reset the UI state even if there's an error
      setUserData(null);
      setIsLoggedIn(false);
      setCurrentScreen("login");
      localStorage.removeItem("mdrrmo_user");
    }
  }

  // If user is logged in, show appropriate dashboard
  if (isLoggedIn) {
    if (userData?.user_type === "admin") {
      return <AdminDashboard onLogout={handleLogout} userData={userData} />
    } else {
      return <Dashboard onLogout={handleLogout} userData={userData} />
    }
  }

  // Show login or register based on current screen
  switch (currentScreen) {
    case "register":
      return <RegisterPage onRegistrationSuccess={handleRegistrationSuccess} onGoToLogin={handleGoToLogin} />
    case "login":
    default:
      return <LoginPage onLoginSuccess={handleLoginSuccess} onGoToRegister={handleGoToRegister} />
  }
}
