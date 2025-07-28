"use client"

import { useState } from "react"
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { Eye, EyeOff } from "lucide-react" // Import icons from lucide-react

interface LoginPageProps {
  onLoginSuccess: (userData: any) => void
  onGoToRegister: () => void
}

export function LoginPage({ onLoginSuccess, onGoToRegister }: LoginPageProps) {
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false) // New state for password visibility
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false) // State for forgot password modal visibility
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("") // State for forgot password email input
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState("") // Message for forgot password flow

  const handleInputChange = (field: string, value: string) => {
    setLoginData((prev) => ({ ...prev, [field]: value }))
    setError("") // Clear error on input change
  }

  const handleLogin = async () => {
    if (!loginData.email || !loginData.password) {
      setError("Please fill in all fields")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      })

      if (error) {
        setError(error.message)
        return
      }

      if (data.user) {
        // Wait a moment for the user to be fully authenticated
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Get user profile with retry logic
        let profile = null
        let retries = 3

        while (retries > 0 && !profile) {
          try {
            const { data: profileData, error: profileError } = await supabase
              .from("users")
              .select("*")
              .eq("id", data.user.id)
              .single()

            if (profileError) {
              console.log("Profile error:", profileError)
              retries--
              if (retries > 0) {
                await new Promise((resolve) => setTimeout(resolve, 1000))
                continue
              }
              throw profileError
            }

            profile = profileData
          } catch (err) {
            console.log("Retry error:", err)
            retries--
            if (retries > 0) {
              await new Promise((resolve) => setTimeout(resolve, 1000))
            }
          }
        }

        if (!profile) {
          setError("Failed to load user profile. Please try again.")
          return
        }

        // Include the user_type in the profile data
        const userWithType = {
          ...profile,
          user_type: profile.user_type || 'user' // Default to 'user' if not specified
        };

        // Store user data in localStorage and notify parent component
        localStorage.setItem("mdrrmo_user", JSON.stringify(userWithType));
        onLoginSuccess(userWithType);
      }
    } catch (err) {
      console.error("Login error:", err)
      setError("Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      setForgotPasswordMessage("Please enter your email address.")
      return
    }

    setIsLoading(true)
    setForgotPasswordMessage("")
    setError("")

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: window.location.origin + '/reset-password', // Replace with your actual reset password page URL
      })

      if (error) {
        setForgotPasswordMessage("Error: " + error.message)
      } else {
        setForgotPasswordMessage("Password reset email sent! Please check your inbox.")
        setForgotPasswordEmail("") // Clear email input
      }
    } catch (err) {
      console.error("Forgot password error:", err)
      setForgotPasswordMessage("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: "url('/images/mdrrmo_login_register_bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black/40"></div>

      <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm shadow-2xl relative z-10">
        <CardHeader className="text-center bg-orange-500 text-white rounded-t-lg">
          <CardTitle className="text-2xl font-bold">MDRRMO Login</CardTitle>
          <p className="text-orange-100">Emergency Reporting System</p>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🚨</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-700">Welcome Back</h3>
          </div>

          {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>}

          <div>
            <Label htmlFor="email" className="text-gray-700 font-medium">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              value={loginData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              className="border-orange-200 focus:border-orange-500 mt-1"
              placeholder="Enter your email"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-gray-700 font-medium">
              Password
            </Label>
            <div className="relative mt-1">
              <Input
                id="password"
                type={showPassword ? "text" : "password"} 
                value={loginData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                className="border-orange-200 focus:border-orange-500 pr-10" 
                placeholder="Enter password"
                required
                disabled={isLoading}
              />
              <button
                type="button" // Important to prevent form submission
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />} {/* Toggle icon */}
              </button>
            </div>
          </div>

          <Button
            onClick={handleLogin}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 text-lg"
            disabled={isLoading}
          >
            {isLoading ? "Logging in..." : "LOGIN"}
          </Button>

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              <span
                className="text-orange-500 font-medium cursor-pointer hover:underline"
                onClick={() => setShowForgotPasswordModal(true)} // Open modal on click
              >
                Forgot Password?
              </span>
            </p>
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <span className="text-orange-500 font-medium cursor-pointer hover:underline" onClick={onGoToRegister}>
                Register here
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-white rounded-lg shadow-xl p-6 space-y-4">
            <CardTitle className="text-xl font-bold text-center text-gray-800">Reset Password</CardTitle>
            <p className="text-sm text-gray-600 text-center">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            {forgotPasswordMessage && (
              <div
                className={`px-4 py-3 rounded ${
                  forgotPasswordMessage.includes("Error") ? "bg-red-100 border-red-400 text-red-700" : "bg-green-100 border-green-400 text-green-700"
                }`}
              >
                {forgotPasswordMessage}
              </div>
            )}
            <div>
              <Label htmlFor="forgotPasswordEmail" className="text-gray-700 font-medium">
                Email Address
              </Label>
              <Input
                id="forgotPasswordEmail"
                type="email"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                className="mt-1 border-gray-300 focus:border-orange-500"
                placeholder="your.email@example.com"
                disabled={isLoading}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForgotPasswordModal(false)
                  setForgotPasswordMessage("")
                  setForgotPasswordEmail("")
                }}
                disabled={isLoading}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                onClick={handleForgotPassword}
                disabled={isLoading}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
