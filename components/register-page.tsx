"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { Eye, EyeOff } from "lucide-react" // Import icons from lucide-react

interface RegisterPageProps {
  onRegistrationSuccess: () => void
  onGoToLogin: () => void
}

export function RegisterPage({ onRegistrationSuccess, onGoToLogin }: RegisterPageProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    username: "",
    birthday: "",
    mobileNumber: "",
    password: "",
    confirmPassword: "", // Added confirm password field
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showPassword, setShowPassword] = useState(false) // State for main password visibility
  const [showConfirmPassword, setShowConfirmPassword] = useState(false) // State for confirm password visibility

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError("") // Clear error on input change
    setSuccess("") // Clear success on input change
  }

  const handleRegister = async () => {
    // Basic validation for required fields
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.username ||
      !formData.password ||
      !formData.confirmPassword || // Ensure confirm password is filled
      !formData.mobileNumber
    ) {
      setError("Please fill in all required fields")
      return
    }

    // Password match validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    // Password policy validation
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.")
      return
    }
    if (!/[A-Z]/.test(formData.password)) {
      setError("Password must contain at least one uppercase letter.")
      return
    }
    if (!/[0-9]/.test(formData.password)) {
      setError("Password must contain at least one number.")
      return
    }
    // Regex to check for special characters (anything not a letter, number, or common punctuation)
    // For this policy, we explicitly disallow special characters
    if (/[^a-zA-Z0-9]/.test(formData.password)) {
      setError("Password must not contain special characters.")
      return
    }

    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      if (authData.user) {
        // 2. Create user profile
        const { error: profileError } = await supabase.from("users").insert({
          id: authData.user.id,
          firstName: formData.firstName,
          middleName: formData.middleName || null,
          lastName: formData.lastName,
          email: formData.email,
          username: formData.username,
          birthday: formData.birthday || null,
          mobileNumber: formData.mobileNumber,
        })

        if (profileError) {
          setError("Registration failed: " + profileError.message)
          return
        }

        setSuccess("Registration successful! Please check your email to verify your account.")
        setTimeout(() => {
          onRegistrationSuccess()
        }, 3000)
      }
    } catch (err) {
      console.error("Registration error:", err)
      setError("Registration failed. Please try again.")
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
          <CardTitle className="text-2xl font-bold">MDRRMO Registration</CardTitle>
          <p className="text-orange-100">Emergency Reporting System</p>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">{success}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName" className="text-gray-700 font-medium">
                First Name *
              </Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                className="border-orange-200 focus:border-orange-500"
                required
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="middleName" className="text-gray-700 font-medium">
                Middle Name
              </Label>
              <Input
                id="middleName"
                value={formData.middleName}
                onChange={(e) => handleInputChange("middleName", e.target.value)}
                className="border-orange-200 focus:border-orange-500"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="lastName" className="text-gray-700 font-medium">
              Last Name *
            </Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => handleInputChange("lastName", e.target.value)}
              className="border-orange-200 focus:border-orange-500"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="email" className="text-gray-700 font-medium">
              Email Address *
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              className="border-orange-200 focus:border-orange-500"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="username" className="text-gray-700 font-medium">
              Username *
            </Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => handleInputChange("username", e.target.value)}
              className="border-orange-200 focus:border-orange-500"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="birthday" className="text-gray-700 font-medium">
              Birthday
            </Label>
            <Input
              id="birthday"
              type="date"
              value={formData.birthday}
              onChange={(e) => handleInputChange("birthday", e.target.value)}
              className="border-orange-200 focus:border-orange-500"
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="mobileNumber" className="text-gray-700 font-medium">
              Mobile Number *
            </Label>
            <Input
              id="mobileNumber"
              type="tel"
              value={formData.mobileNumber}
              onChange={(e) => handleInputChange("mobileNumber", e.target.value)}
              className="border-orange-200 focus:border-orange-500"
              placeholder="+63 XXX XXX XXXX"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-gray-700 font-medium">
              Password *
            </Label>
            <div className="relative mt-1">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                className="border-orange-200 focus:border-orange-500 pr-10"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Password must be at least 6 characters, contain 1 uppercase letter, 1 number, and no special characters.
            </p>
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">
              Confirm Password *
            </Label>
            <div className="relative mt-1">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                className="border-orange-200 focus:border-orange-500 pr-10"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                disabled={isLoading}
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <Button
            onClick={handleRegister}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 text-lg"
            disabled={isLoading}
          >
            {isLoading ? "Registering..." : "REGISTER"}
          </Button>

          <p className="text-center text-sm text-gray-600 mt-4">
            Already have an account?{" "}
            <span className="text-orange-500 font-medium cursor-pointer hover:underline" onClick={onGoToLogin}>
              Login here
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
