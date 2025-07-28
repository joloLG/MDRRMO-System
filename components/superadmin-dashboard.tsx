"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Ban, CheckCircle, Loader2, LogOut } from "lucide-react"
import { userQueries, type User } from "@/lib/supabase"
import { cn } from "@/lib/utils"

type UserWithBanInfo = Omit<User, 'user_type'> & {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  mobileNumber?: string;
  user_type: User['user_type'];
  created_at: string;
  isBanning?: boolean;
  isUpdating?: boolean;
  tempBanUntil?: Date | null;
  tempBanReason?: string;
}

export function SuperadminDashboard({ onLogout }: { onLogout: () => Promise<void> }) {
  const [users, setUsers] = useState<UserWithBanInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [banDate, setBanDate] = useState<Date | undefined>(new Date())

  // Fetch all users
  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const data = await userQueries.getAllUsers()
      setUsers(data.map(user => ({
        ...user,
        isBanning: false,
        isUpdating: false,
        tempBanUntil: user.banned_until ? new Date(user.banned_until) : null,
        tempBanReason: user.ban_reason || ''
      })))
    } catch (err) {
      console.error("Error fetching users:", err)
      setError("Failed to load users. Please try again later.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
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

  // Toggle user ban status
  const toggleBanUser = async (userId: string, isCurrentlyBanned: boolean) => {
    try {
      setUsers(users.map(user => 
        user.id === userId ? { ...user, isBanning: true } : user
      ))

      if (isCurrentlyBanned) {
        // Unban user
        await userQueries.updateUserBanStatus(userId, false)
        setUsers(users.map(user => 
          user.id === userId 
            ? { 
                ...user, 
                is_banned: false, 
                banned_until: null, 
                ban_reason: null,
                isBanning: false 
              } 
            : user
        ))
      } else {
        // Ban user - use temp ban values from state
        const user = users.find(u => u.id === userId)
        if (user) {
          await userQueries.updateUserBanStatus(
            userId, 
            true, 
            user.tempBanReason || 'Violation of terms of service',
            user.tempBanUntil?.toISOString()
          )
          
          setUsers(users.map(u => 
            u.id === userId 
              ? { 
                  ...u, 
                  is_banned: true, 
                  banned_until: user.tempBanUntil?.toISOString() || null,
                  ban_reason: user.tempBanReason || null,
                  isBanning: false 
                } 
              : u
          ))
        }
      }
    } catch (err) {
      console.error("Error updating ban status:", err)
      setError("Failed to update user status. Please try again.")
    }
  }

  // Update temp ban date
  const handleBanDateChange = (userId: string, date: Date | undefined) => {
    setUsers(users.map(user => 
      user.id === userId 
        ? { ...user, tempBanUntil: date || null } 
        : user
    ))
  }

  // Update temp ban reason
  const handleBanReasonChange = (userId: string, reason: string) => {
    setUsers(users.map(user => 
      user.id === userId 
        ? { ...user, tempBanReason: reason } 
        : user
    ))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Superadmin Dashboard</h1>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
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
                          // Type assertion is safe here because we control the values in the SelectItems
                          handleRoleChange(user.id, value as User['user_type']);
                        }}
                        disabled={user.isUpdating}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="superadmin">Superadmin</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="responder">Responder</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {user.is_banned ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Banned
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant={user.is_banned ? "default" : "destructive"}
                              size="sm"
                              disabled={user.isBanning}
                            >
                              {user.isBanning ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : user.is_banned ? (
                                <CheckCircle className="h-4 w-4 mr-2" />
                              ) : (
                                <Ban className="h-4 w-4 mr-2" />
                              )}
                              {user.is_banned ? 'Unban' : 'Ban'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-4 space-y-4">
                            <div className="space-y-2">
                              <h4 className="font-medium leading-none">
                                {user.is_banned ? 'Unban User' : 'Ban User'}
                              </h4>
                              {!user.is_banned && (
                                <>
                                  <div className="space-y-2">
                                    <Label>Ban Until</Label>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !user.tempBanUntil && "text-muted-foreground"
                                          )}
                                        >
                                          <CalendarIcon className="mr-2 h-4 w-4" />
                                          {user.tempBanUntil ? (
                                            format(user.tempBanUntil, "PPP")
                                          ) : (
                                            <span>Select a date</span>
                                          )}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0">
                                        <Calendar
                                          mode="single"
                                          selected={user.tempBanUntil || undefined}
                                          onSelect={(date) => handleBanDateChange(user.id, date)}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="banReason">Reason</Label>
                                    <Input
                                      id="banReason"
                                      placeholder="Reason for ban"
                                      value={user.tempBanReason || ''}
                                      onChange={(e) => handleBanReasonChange(user.id, e.target.value)}
                                    />
                                  </div>
                                </>
                              )}
                              <div className="pt-2">
                                <Button
                                  className="w-full"
                                  onClick={() => toggleBanUser(user.id, !!user.is_banned)}
                                >
                                  {user.is_banned ? 'Unban User' : 'Confirm Ban'}
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
