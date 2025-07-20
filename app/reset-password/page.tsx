"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation" // Assuming Next.js App Router for useSearchParams
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { Eye, EyeOff, LogOut } from "lucide-react"

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams() // Hook to get URL search parameters

  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)
  const [isTokenValid, setIsTokenValid] = useState(false) // To check if the session is valid

  useEffect(() => {
    // Supabase automatically handles the session when redirecting from the reset email link.
    // We can check the session to confirm the user is authenticated for password reset.
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        setError("Invalid or expired password reset link. Please try again from the login page.")
        setIsTokenValid(false)
      } else {
        setIsTokenValid(true)
      }
    }

    // This effect runs once on component mount to validate the session from the URL.
    // The tokens are handled by Supabase's client-side library upon redirection.
    checkSession()
  }, [])

  const handlePasswordReset = async () => {
    setError("")
    setSuccess("")

    if (!newPassword || !confirmNewPassword) {
      setError("Please fill in both password fields.")
      return
    }

    if (newPassword !== confirmNewPassword) {
      setError("New passwords do not match.")
      return
    }

    // Password policy validation (same as registration)
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.")
      return
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError("Password must contain at least one uppercase letter.")
      return
    }
    if (!/[0-9]/.test(newPassword)) {
      setError("Password must contain at least one number.")
      return
    }
    if (/[^a-zA-Z0-9]/.test(newPassword)) {
      setError("Password must not contain special characters.")
      return
    }

    setIsLoading(true)

    try {
      // Update the user's password
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        setError("Error resetting password: " + updateError.message)
        return
      }

      setSuccess("Your password has been successfully reset. You can now log in with your new password.")
      setNewPassword("")
      setConfirmNewPassword("")

      // Redirect to login page after a short delay
      setTimeout(() => {
        router.push("/login") // Adjust this path if your login page is different
      }, 3000)

    } catch (err) {
      console.error("Password reset error:", err)
      setError("An unexpected error occurred during password reset. Please try again.")
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
          <CardTitle className="text-2xl font-bold">Reset Your Password</CardTitle>
          <p className="text-orange-100">MDRRMO Emergency Reporting System</p>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          {!isTokenValid ? (
            <div className="text-center">
              <p className="text-red-600 font-medium">{error || "Loading..."}</p>
              {error && (
                <Button
                  onClick={() => router.push("/login")}
                  className="mt-4 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Go to Login
                </Button>
              )}
            </div>
          ) : (
            <>
              {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>}
              {success && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">{success}</div>
              )}

              <div>
                <Label htmlFor="newPassword" className="text-gray-700 font-medium">
                  New Password *
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="border-orange-200 focus:border-orange-500 pr-10"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                    disabled={isLoading}
                  >
                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Password must be at least 6 characters, contain 1 uppercase letter, 1 number, and no special characters.
                </p>
              </div>

              <div>
                <Label htmlFor="confirmNewPassword" className="text-gray-700 font-medium">
                  Confirm New Password *
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="confirmNewPassword"
                    type={showConfirmNewPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="border-orange-200 focus:border-orange-500 pr-10"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                    disabled={isLoading}
                  >
                    {showConfirmNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <Button
                onClick={handlePasswordReset}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 text-lg"
                disabled={isLoading}
              >
                {isLoading ? "Resetting..." : "Reset Password"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
