"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { Eye, EyeOff, AlertCircle, Check, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"

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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [ageVerified, setAgeVerified] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError("") // Clear error on input change
    setSuccess("") // Clear success on input change
  }

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birthDateObj = new Date(birthDate);
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = today.getMonth() - birthDateObj.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
      age--;
    }
    return age;
  };

  const handleRegister = async () => {
    // Basic validation for required fields
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.username ||
      !formData.password ||
      !formData.confirmPassword ||
      !formData.mobileNumber ||
      !formData.birthday
    ) {
      setError("Please fill in all required fields")
      return
    }

    // Age verification (12+ years old)
    const age = calculateAge(formData.birthday);
    if (age < 12) {
      setError("You must be at least 12 years old to register.")
      return
    }
    
    // Terms and conditions check
    if (!acceptedTerms) {
      setError("You must accept the terms and conditions to register.")
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

        setShowSuccessModal(true)
        setSuccess("Successfully sent to your email, check your email to verify the account")
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
              Birthday *
            </Label>
            <div className="relative">
              <Input
                id="birthday"
                type="date"
                value={formData.birthday}
                onChange={(e) => {
                  handleInputChange("birthday", e.target.value);
                  if (e.target.value) {
                    const age = calculateAge(e.target.value);
                    setAgeVerified(age >= 12);
                  }
                }}
                className={`border-orange-200 focus:border-orange-500 ${formData.birthday && !ageVerified ? 'border-red-500' : ''}`}
                required
                disabled={isLoading}
                max={new Date().toISOString().split('T')[0]} // Prevent future dates
              />
              {formData.birthday && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {ageVerified ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <X className="h-4 w-4 text-red-500" />
                  )}
                </div>
              )}
            </div>
            {formData.birthday && !ageVerified && (
              <p className="text-sm text-red-500 mt-1">You must be at least 12 years old to register.</p>
            )}
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

          {/* Terms and Conditions */}
          <div className="flex items-start space-x-2 mt-2">
            <div className="mt-1">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-white"
              />
            </div>
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="terms"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                I accept the{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    setShowTerms(true)
                  }}
                  className="text-orange-500 hover:underline font-medium"
                >
                  Terms and Conditions
                </button>
              </label>
              <p className="text-xs text-gray-500">
                You must be at least 12 years old to register. By creating an account, you agree to our terms and conditions.
              </p>
            </div>
          </div>

          <Button
            onClick={handleRegister}
            disabled={isLoading || !ageVerified || !acceptedTerms}
            className={`w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded transition-colors ${
              !ageVerified || !acceptedTerms ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? "Registering..." : "Register"}
          </Button>

          <p className="text-center text-sm text-gray-600 mt-4">
            Already have an account?{" "}
            <span className="text-orange-500 font-medium cursor-pointer hover:underline" onClick={onGoToLogin}>
              Login here
            </span>
          </p>
        </CardContent>
      </Card>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-[425px] bg-white">
          <div className="flex flex-col items-center text-center p-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Registration Successful!</h3>
            <p className="text-gray-600 mb-6">{success}</p>
            <Button 
              asChild 
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => {
                window.location.href = '/';
              }}
            >
              <button>Okay</button>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Terms and Conditions Dialog */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-800">Terms and Conditions</DialogTitle>
            <DialogDescription className="text-gray-600">
              Please read these terms and conditions carefully before using our service.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 text-gray-700">
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-800">1. Account Registration</h3>
              <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials.</p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-800">2. User Responsibilities</h3>
              <p>You agree to use this service only for legitimate emergency reporting purposes. You must not use false information or impersonate others.</p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-800">3. Prohibited Activities</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Creating fake or misleading emergency reports</li>
                <li>Using the service for non-emergency purposes</li>
                <li>Harassing or abusing other users or emergency responders</li>
                <li>Violating any laws or regulations</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-800">4. Consequences of Misuse</h3>
              <p>Any violation of these terms may result in immediate account suspension or termination, and may be reported to the appropriate authorities.</p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-800">5. Privacy</h3>
              <p>Your personal information will be handled in accordance with our Privacy Policy. Emergency reports may be shared with appropriate authorities as needed.</p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowTerms(false)}
              className="border-orange-500 text-orange-500 hover:bg-orange-50"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
