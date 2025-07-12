"use client"

import { useState } from "react"
import { RegisterPage } from "./components/register-page"
import { LoginPage } from "./components/login-page"
import { Dashboard } from "./components/dashboard"

export default function MobileApp() {
  const [currentScreen, setCurrentScreen] = useState<"login" | "register" | "dashboard">("login")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userData, setUserData] = useState<any>(null)

  // Handle successful registration
  const handleRegistrationSuccess = () => {
    setCurrentScreen("login")
  }

  // Handle successful login
  const handleLoginSuccess = (user: any) => {
    setUserData(user)
    setIsLoggedIn(true)
    setCurrentScreen("dashboard")
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
  const handleLogout = () => {
    setUserData(null)
    setIsLoggedIn(false)
    setCurrentScreen("login")
  }

  // If user is logged in, show dashboard
  if (isLoggedIn) {
    return <Dashboard onLogout={handleLogout} userData={userData} />
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
