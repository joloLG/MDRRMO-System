import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://gbavcwwxgvwmaccwfuhi.supabase.co"
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiYXZjd3d4Z3Z3bWFjY3dmdWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzMDQxMzQsImV4cCI6MjA2Nzg4MDEzNH0.J8fG7ka0qstIYaMIuZCyiRPIUgGiR4t3X3WFFajypCI"

export const supabase = createClient(supabaseUrl, supabaseKey)

// Simple types
export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  username: string
  mobileNumber: string
}
