import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://gbavcwwxgvwmaccwfuhi.supabase.co"
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiYXZjd3d4Z3Z3bWFjY3dmdWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzMDQxMzQsImV4cCI6MjA2Nzg4MDEzNH0.J8fG7ka0qstIYaMIuZCyiRPIUgGiR4t3X3WFFajypCI"

export const supabase = createClient(supabaseUrl, supabaseKey)

// User type
export type UserRole = 'superadmin' | 'admin' | 'user' | 'responder';

export interface User {
  id: string
  firstName: string
  middleName?: string
  lastName: string
  email: string
  mobileNumber?: string
  user_type: UserRole
  created_at: string
  updated_at?: string
  is_banned?: boolean
  banned_until?: string | null
  ban_reason?: string | null
}

// Check if user is superadmin
export const isSuperAdmin = (user: User | null): boolean => {
  return user?.user_type === 'superadmin';
}

// User queries
export const userQueries = {
  // Get all users (only accessible by superadmin)
  getAllUsers: async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as unknown as User[];
  },

  // Get user by ID
  getUserById: async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data as User;
  },

  // Update user role (only for superadmin)
  updateUserRole: async (userId: string, role: 'admin' | 'user' | 'superadmin' | 'responder') => {
    const { data, error } = await supabase
      .from('users')
      .update({ user_type: role })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data as User;
  },

  // Delete user (only for superadmin)
  deleteUser: async (userId: string) => {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);
    
    if (error) throw error;
    return true;
  },

  // Update user ban status
  updateUserBanStatus: async (
    userId: string, 
    isBanned: boolean, 
    banReason?: string, 
    bannedUntil?: string | null
  ) => {
    const updates = {
      is_banned: isBanned,
      banned_until: bannedUntil || null,
      ban_reason: banReason || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data as User;
  }
};