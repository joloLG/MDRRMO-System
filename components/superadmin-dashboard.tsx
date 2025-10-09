"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, LogOut, Info } from "lucide-react" // Removed Ban, CheckCircle, CalendarIcon
import { userQueries, type User, supabase } from "@/lib/supabase"
import { robustSignOut } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

// Removed isBanning, tempBanUntil, tempBanReason as they are no longer used for UI interaction
type UserWithDisplayInfo = Omit<User, 'user_type'> & {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  mobileNumber?: string;
  user_type: User['user_type'];
  created_at: string;
  isUpdating?: boolean; // Kept for role updates
}

export function SuperadminDashboard({ onLogoutAction }: { onLogoutAction: () => Promise<void> }) {
  const handleLogout = async () => {
    try {
      await robustSignOut()
      if (typeof onLogoutAction === 'function') {
        await onLogoutAction()
      }
    } finally {
      window.location.href = "/"
    }
  }

  const [users, setUsers] = useState<UserWithDisplayInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Ban modal state
  const [showBanModal, setShowBanModal] = useState(false)
  const [banTarget, setBanTarget] = useState<UserWithDisplayInfo | null>(null)
  const [banType, setBanType] = useState<'temporary' | 'permanent'>('temporary')
  const [banDays, setBanDays] = useState<string>('7')
  const [banReason, setBanReason] = useState<string>('')
  const [isSubmittingBan, setIsSubmittingBan] = useState(false)
  const [banError, setBanError] = useState<string | null>(null)

  // Fetch all users
  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const data = await userQueries.getAllUsers()
      setUsers(data.map(user => ({
        ...user,
        isUpdating: false,
      })))
    } catch (err) {
      console.error("Error fetching users:", err)
      setError("Failed to load users. Please try again later.")
    } finally {
      setIsLoading(false)
    }
  }

  // Set up real-time subscription for user updates
  useEffect(() => {
    fetchUsers();
    
    // Subscribe to user updates (still useful for role changes or external ban updates)
    const userSubscription = supabase
      .channel('user_changes')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'users' 
        }, 
        (payload: { new: User & { banned_until?: string | null; ban_reason?: string | null } }) => {
          // Update the user in the local state if they exist
          setUsers(currentUsers => 
            currentUsers.map(user => 
              user.id === payload.new.id 
                ? { 
                    ...user, 
                    ...payload.new,
                  } 
                : user
            )
          );
        }
      )
      .subscribe()

    // Cleanup subscription on component unmount
    return () => {
      supabase.removeChannel(userSubscription);
    };
  }, [])

  // Update user role
  const handleRoleChange = async (userId: string, newRole: User['user_type']) => {
    try {
      setUsers(users.map(user => 
        user.id === userId ? { ...user, isUpdating: true } : user
      ))

      await userQueries.updateUserRole(userId, newRole as User['user_type'])
      
      setUsers(users.map(user => 
        user.id === userId 
          ? { ...user, user_type: newRole as User['user_type'], isUpdating: false } 
          : user
      ))
    } catch (err) {
      console.error("Error updating user role:", err)
      setError("Failed to update user role. Please try again.")
    }
  }

  // Ban helpers
  const openBanDialog = (user: UserWithDisplayInfo) => {
    setBanTarget(user)
    setBanType('temporary')
    setBanDays('7')
    setBanReason('')
    setBanError(null)
    setShowBanModal(true)
  }

  const handleSubmitBan = async () => {
    if (!banTarget) return
    setIsSubmittingBan(true)
    setBanError(null)
    try {
      let bannedUntil: string | null = null
      if (banType === 'temporary') {
        const daysNum = parseInt(banDays || '0', 10)
        if (!Number.isFinite(daysNum) || daysNum <= 0) {
          setBanError('Please enter a valid number of days (> 0).')
          setIsSubmittingBan(false)
          return
        }
        bannedUntil = new Date(Date.now() + daysNum * 24 * 60 * 60 * 1000).toISOString()
      }

      await userQueries.updateUserBanStatus(banTarget.id, true, (banReason?.trim() || undefined), (bannedUntil ?? undefined))

      // In-app notification to the user (best-effort)
      try {
        await supabase.from('user_notifications').insert({
          user_id: banTarget.id,
          emergency_report_id: null,
          message: banType === 'permanent'
            ? `Your account has been permanently banned. Reason: ${banReason || 'No reason provided.'}`
            : `Your account has been banned for ${banDays} day(s). Reason: ${banReason || 'No reason provided.'}`,
        })
      } catch {}

      // Email notification (best-effort)
      try {
        await fetch('/api/send-ban-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: banTarget.email,
            name: `${banTarget.firstName} ${banTarget.lastName}`.trim(),
            reason: banReason || 'No reason provided.',
            until: bannedUntil,
            permanent: banType === 'permanent',
          }),
        })
      } catch {}

      setShowBanModal(false)
      setBanTarget(null)
    } catch (e: any) {
      setBanError(e?.message || 'Failed to ban user.')
    } finally {
      setIsSubmittingBan(false)
    }
  }

  const handleUnban = async (user: UserWithDisplayInfo) => {
    try {
      await userQueries.updateUserBanStatus(user.id, false, undefined, undefined)
      try {
        await supabase.from('user_notifications').insert({
          user_id: user.id,
          emergency_report_id: null,
          message: 'Your account ban has been lifted. You may now use the app again.',
        })
      } catch {}
    } catch (e) {
      console.error('Unban failed:', e)
      setError('Failed to unban user.')
    }
  }

  // Removed toggleBanUser, handleBanDateChange, handleBanReasonChange as they are no longer needed.

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }
  
  // Sort users with admins first, then by name
  const sortedUsers = [...users].sort((a, b) => {
    // First sort by role (superadmin > admin > responder > user)
    const roleOrder: Record<string, number> = { superadmin: 0, admin: 1, responder: 2, user: 3 };
    const roleA = roleOrder[a.user_type] || 3;
    const roleB = roleOrder[b.user_type] || 3;
    
    if (roleA !== roleB) return roleA - roleB;
    
    // If same role, sort by name
    const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
    const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Superadmin Dashboard</h1>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.firstName} {user.middleName ? `${user.middleName} ` : ''}{user.lastName}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.mobileNumber || 'N/A'}</TableCell>
                    <TableCell>
                      <Select
                        value={user.user_type}
                        onValueChange={(value) => {
                          // Prevent changing the role of superadmin users
                          if (user.user_type === 'superadmin') return;
                          handleRoleChange(user.id, value as User['user_type']);
                        }}
                        disabled={user.isUpdating || user.user_type === 'superadmin'}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="superadmin">Superadmin</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                              user.user_type === 'superadmin' 
                                ? 'bg-blue-100 text-blue-800' 
                                : user.is_banned 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-green-100 text-green-800'
                            )}>
                              {user.user_type === 'superadmin' ? 'Superadmin' : user.is_banned ? 'Banned' : 'Active'}
                              {(user.user_type === 'superadmin' || user.is_banned) && (
                                <Info className="ml-1 h-3 w-3" />
                              )}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {user.user_type === 'superadmin' ? (
                              <p>Superadmin accounts cannot be modified</p>
                            ) : user.is_banned ? (
                              <div className="space-y-1">
                                <p><strong>Reason:</strong> {user.ban_reason || 'No reason provided'}</p>
                                {user.banned_until && (
                                  <p><strong>Until:</strong> {new Date(user.banned_until).toLocaleString()}</p>
                                )}
                              </div>
                            ) : (
                              <p>User is active</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {user.user_type !== 'superadmin' && (
                          user.is_banned ? (
                            <Button variant="outline" size="sm" onClick={() => handleUnban(user)}>Unban</Button>
                          ) : (
                            <Button variant="destructive" size="sm" onClick={() => openBanDialog(user)}>Ban</Button>
                          )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Ban Dialog */}
      <Dialog open={showBanModal} onOpenChange={setShowBanModal}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
            <DialogDescription>
              Choose ban type and provide a reason. The user will be notified and blocked from using the app.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-700">
              User: {banTarget ? `${banTarget.firstName} ${banTarget.lastName} (${banTarget.email})` : ''}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Ban Type</label>
                <Select value={banType} onValueChange={(v) => setBanType(v as 'temporary' | 'permanent')}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="temporary">Temporary</SelectItem>
                    <SelectItem value="permanent">Permanent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {banType === 'temporary' && (
                <div>
                  <label className="text-sm font-medium">Days</label>
                  <Input type="number" min={1} value={banDays} onChange={(e) => setBanDays(e.target.value)} className="mt-1" />
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <Textarea rows={3} value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Describe the reason for banning..." className="mt-1" />
            </div>
            {banError && <div className="text-sm text-red-600">{banError}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBanModal(false)} disabled={isSubmittingBan}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleSubmitBan} disabled={isSubmittingBan || !banReason.trim()}>
                {isSubmittingBan ? 'Banning...' : 'Ban User'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
