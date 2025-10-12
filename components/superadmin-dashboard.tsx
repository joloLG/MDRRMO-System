"use client"

import { useState, useEffect, useMemo } from "react"
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

  // Unban modal state
  const [showUnbanModal, setShowUnbanModal] = useState(false)
  const [unbanTarget, setUnbanTarget] = useState<UserWithDisplayInfo | null>(null)
  const [unbanReason, setUnbanReason] = useState<string>('')
  const [isSubmittingUnban, setIsSubmittingUnban] = useState(false)
  const [unbanError, setUnbanError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | User['user_type']>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all')
  const PAGE_SIZE = 15
  const [currentPage, setCurrentPage] = useState(1)

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

  const openUnbanDialog = (user: UserWithDisplayInfo) => {
    setUnbanTarget(user)
    setUnbanReason('')
    setUnbanError(null)
    setShowUnbanModal(true)
  }

  const handleUnban = async () => {
    if (!unbanTarget) return

    setIsSubmittingUnban(true)
    setUnbanError(null)
    try {
      // 1. Lift the ban
      await userQueries.updateUserBanStatus(unbanTarget.id, false, undefined, undefined)

      // 2. Notify the user via in-app notification
      try {
        await supabase.from('user_notifications').insert({
          user_id: unbanTarget.id,
          emergency_report_id: null,
          message: `Your account ban has been lifted. Message from admin: ${unbanReason || 'You may now use the app again.'}`,
        })
      } catch (e) { console.warn('In-app unban notification failed', e) }

      // 3. Notify the user via email
      try {
        await fetch('/api/send-unban-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: unbanTarget.email,
            name: `${unbanTarget.firstName} ${unbanTarget.lastName}`.trim(),
            reason: unbanReason || 'Your account access has been restored.',
          }),
        })
      } catch (e) { console.warn('Unban email failed to send', e) }

      // 4. Create an admin notification to trigger the overlay
      try {
        await supabase.from('admin_notifications').insert({
          type: 'user_unbanned',
          message: `User ${unbanTarget.firstName} ${unbanTarget.lastName} has been unbanned.`,
        })
      } catch (e) { console.warn('Admin unban overlay notification failed', e) }

      setShowUnbanModal(false)
      setUnbanTarget(null)
    } catch (e: any) {
      setUnbanError(e?.message || 'Failed to unban user.')
    } finally {
      setIsSubmittingUnban(false)
    }
  }

  const filteredUsers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = search.length === 0 || [
        `${user.firstName} ${user.middleName ? `${user.middleName} ` : ''}${user.lastName}`.toLowerCase(),
        user.email.toLowerCase(),
        user.mobileNumber?.toLowerCase() || ''
      ].some(value => value.includes(search));

      const matchesRole = roleFilter === 'all' || user.user_type === roleFilter;
      const matchesStatus = statusFilter === 'all'
        ? true
        : statusFilter === 'banned'
          ? !!user.is_banned
          : !user.is_banned;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const sortedUsers = useMemo(() => {
    const roleOrder: Record<string, number> = { superadmin: 0, admin: 1, responder: 2, user: 3 };
    return [...filteredUsers].sort((a, b) => {
      const roleA = roleOrder[a.user_type] || 3;
      const roleB = roleOrder[b.user_type] || 3;
      if (roleA !== roleB) return roleA - roleB;

      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [filteredUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, statusFilter]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE)), [sortedUsers.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedUsers.slice(start, start + PAGE_SIZE);
  }, [sortedUsers, currentPage]);

  const showingRange = useMemo(() => {
    const total = sortedUsers.length;
    if (total === 0) return { from: 0, to: 0, total };
    const from = (currentPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(total, currentPage * PAGE_SIZE);
    return { from, to, total };
  }, [sortedUsers.length, currentPage]);

  const goToPage = (page: number) => {
    setCurrentPage(prev => {
      const target = Math.min(Math.max(page, 1), totalPages);
      return target === prev ? prev : target;
    });
  };

  // Removed toggleBanUser, handleBanDateChange, handleBanReasonChange as they are no longer needed.

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-blue-100">
      <header className="bg-orange-500 shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 text-center">Superadmin Dashboard</h1>
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
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <CardTitle>User Management</CardTitle>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, email, or contact"
                  className="sm:w-64"
                />
                <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
                  <SelectTrigger className="sm:w-48">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="superadmin">Superadmin</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                  <SelectTrigger className="sm:w-44">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
                {paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-gray-500">
                      No users match the current filters.
                    </TableCell>
                  </TableRow>
                ) : paginatedUsers.map((user) => (
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
                            <Button variant="outline" size="sm" onClick={() => openUnbanDialog(user)}>Unban</Button>
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
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-600">
                {showingRange.total === 0
                  ? 'No results found.'
                  : `Showing ${showingRange.from}-${showingRange.to} of ${showingRange.total} users`}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1 || showingRange.total === 0}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {showingRange.total === 0 ? 0 : currentPage} of {showingRange.total === 0 ? 0 : totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages || showingRange.total === 0}
                >
                  Next
                </Button>
              </div>
            </div>
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

      {/* Unban Dialog */}
      <Dialog open={showUnbanModal} onOpenChange={setShowUnbanModal}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Unban User</DialogTitle>
            <DialogDescription>
              Provide a brief message for the user regarding the unban. This will be sent via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-700">
              User: {unbanTarget ? `${unbanTarget.firstName} ${unbanTarget.lastName} (${unbanTarget.email})` : ''}
            </div>
            <div>
              <label className="text-sm font-medium">Message / Reason for Unbanning</label>
              <Textarea 
                rows={4} 
                value={unbanReason} 
                onChange={(e) => setUnbanReason(e.target.value)} 
                placeholder="Example: Your access has been restored after a review. Please adhere to the community guidelines."
                className="mt-1"
              />
            </div>
            {unbanError && <div className="text-sm text-red-600">{unbanError}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowUnbanModal(false)} disabled={isSubmittingUnban}>Cancel</Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleUnban} disabled={isSubmittingUnban || !unbanReason.trim()}>
                {isSubmittingUnban ? 'Unbanning...' : 'Confirm Unban'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
