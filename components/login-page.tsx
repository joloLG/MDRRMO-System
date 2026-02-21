"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"
import { Eye, EyeOff, Download, Share, Smartphone } from "lucide-react"
import { useAppStore } from '@/lib/store' // Import icons from lucide-react

interface LoginPageProps {
  onLoginSuccess: (userData: any) => void
  onGoToRegister: () => void
  onGoToRoleSelection?: () => void
}

export function LoginPage({ onLoginSuccess, onGoToRegister, onGoToRoleSelection }: LoginPageProps) {
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
  // If a user is banned, show message immediately after sign-in instead of proceeding
  const [banInfo, setBanInfo] = useState<{ reason?: string; until?: string | null } | null>(null)
  const [logoClicks, setLogoClicks] = useState(0) // Secret toggle for role selection
  
  // Platform detection and install options
  const [isAndroid, setIsAndroid] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const installPromptEvent = useAppStore(state => state.installPromptEvent)
  const setInstallPromptEvent = useAppStore(state => state.setInstallPromptEvent)

  const handleLogoClick = () => {
    setLogoClicks(prev => prev + 1)
  }

  // Handle navigation after render cycle
  useEffect(() => {
    if (logoClicks >= 7 && onGoToRoleSelection) {
      onGoToRoleSelection()
      setLogoClicks(0)
    }
  }, [logoClicks, onGoToRoleSelection])

  // Removed admin session restrictions - admins can now login from multiple devices/browsers simultaneously
  
  // Detect platform for install options
  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase()
    const isAndroidDevice = /android/.test(ua)
    const isIOSDevice = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
    
    setIsAndroid(isAndroidDevice && !isStandalone)
    setIsIOS(isIOSDevice && !isStandalone)
  }, [])
  
  const handleInstallPWA = () => {
    if (!installPromptEvent) return
    (installPromptEvent as any).prompt()
    setInstallPromptEvent(null)
  }

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

        // If profile indicates the account is banned, show a ban message instead of proceeding
        const banActive = !!profile.is_banned && (!profile.banned_until || new Date(profile.banned_until).getTime() > Date.now())
        if (banActive) {
          setBanInfo({ reason: profile.ban_reason || undefined, until: profile.banned_until ?? null })
          try { await supabase.auth.signOut() } catch {}
          return
        }

        // Check if account is pending approval
        const status = profile.status || 'active'
        if (status === 'pending_admin' || status === 'pending_hospital') {
          setError(`Your ${status === 'pending_admin' ? 'admin' : 'hospital'} account request is still waiting for MDRRMO Super Admin approval. Kindly wait for a while. Thank you for your patience!`)
          try { await supabase.auth.signOut() } catch {}
          return
        }

        // Check if account was rejected
        if (status === 'rejected') {
          setError("Your account request has been rejected by the MDRRMO Super Admin. Please contact support for more information.")
          try { await supabase.auth.signOut() } catch {}
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
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ((typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : '')
      // Route through server callback to persist cookies before landing on reset page
      const redirectTo = `${siteUrl}/auth/callback?next=/reset-password`

      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo
      })

      if (error) {
        const msg = (error.message || '').toLowerCase()
        if (msg.includes('redirect') || msg.includes('not a valid')) {
          setForgotPasswordMessage(
            `Error: ${error.message}. Please ensure your Supabase Auth settings allow this redirect URL: ${redirectTo}`
          )
        } else {
          setForgotPasswordMessage("Error: " + error.message)
        }
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

      <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm shadow-2xl relative z-10 auth-card-pop">
        <CardHeader className="text-center bg-orange-500 text-white rounded-t-lg">
          <CardTitle className="text-2xl font-bold">MDRRMO Login</CardTitle>
          <p className="text-orange-100">Emergency Reporting System</p>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="text-center mb-6">
            <div 
              className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 cursor-pointer hover:bg-orange-200 transition-colors"
              onClick={handleLogoClick}
            >
              <span className="text-3xl">🚨</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-700">Welcome Back</h3>
          </div>

          {banInfo ? (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                <div className="font-semibold mb-1">Account Banned</div>
                <p className="text-sm text-gray-800">Your account is currently banned and cannot sign in.</p>
                {banInfo.reason && (
                  <p className="text-sm mt-2"><span className="font-semibold">Reason:</span> {banInfo.reason}</p>
                )}
                <p className="text-sm mt-1">
                  <span className="font-semibold">Duration:</span>{' '}
                  {banInfo.until ? (
                    <>Until {new Date(banInfo.until).toLocaleString()}</>
                  ) : (
                    <>Permanent</>
                  )}
                </p>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setBanInfo(null)} className="bg-gray-800 hover:bg-gray-900 text-white">Back to Login</Button>
              </div>
            </div>
          ) : (
            <>
              {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!isLoading) {
                    handleLogin();
                  }
                }}
                className="space-y-4"
                noValidate
              >
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
                    autoComplete="email"
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
                      autoComplete="current-password"
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
                </div>

                <Button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 text-lg"
                  disabled={isLoading}
                >
                  {isLoading ? "Logging in..." : "LOGIN"}
                </Button>
              </form>

              <div className="text-center space-y-2">
                <p className="text-sm text-gray-600">
                  <span
                    className="text-orange-500 font-medium cursor-pointer hover:underline"
                    onClick={() => setShowForgotPasswordModal(true)}
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
                
                {/* Platform-specific install options */}
                {isAndroid && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                    <p className="text-xs text-gray-600 font-medium mb-2">Install MDRRMO App:</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs border-orange-300 text-orange-600 hover:bg-orange-50"
                        onClick={() => window.open('https://github.com/joloLG/MDRRMO-System/releases/tag/1.1.8', '_blank', 'noopener,noreferrer')}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download APK
                      </Button>
                      {installPromptEvent && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs border-green-300 text-green-600 hover:bg-green-50"
                          onClick={handleInstallPWA}
                        >
                          <Smartphone className="w-3 h-3 mr-1" />
                          Install via Browser
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                
                {isIOS && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                      onClick={() => setShowIOSInstructions(true)}
                    >
                      <Share className="w-3 h-3 mr-1" />
                      Add to Home Screen
                    </Button>
                  </div>
                )}
                
                <p className="text-xs text-gray-500 mt-2">Copyright © 2025 | Jolo Gracilla</p>
              </div>
            </>
          )}
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
      
      {/* iOS Add to Home Screen Instructions */}
      <Dialog open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add MDRRMO App to Home Screen</DialogTitle>
            <DialogDescription>
              For iPhone/iPad using Safari or other iOS browsers:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              1. Tap the <span className="inline-flex items-center gap-1 font-medium"><Share className="inline h-4 w-4" /> Share</span> button in the browser toolbar.
            </p>
            <p>
              2. Scroll and choose <span className="font-medium">Add to Home Screen</span>.
            </p>
            <p>
              3. Tap <span className="font-medium">Add</span> to confirm.
            </p>
            <p className="text-muted-foreground text-xs">
              Tip: On iPad or in landscape, the Share button may be at the top-right.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}