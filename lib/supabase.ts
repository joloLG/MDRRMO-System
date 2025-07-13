import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://wycvqsokitwulmvixwac.supabase.co"
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5Y3Zxc29raXR3dWxtdml4d2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzODM3NDgsImV4cCI6MjA2Nzk1OTc0OH0.6RRASaLVDrAV0--eyhwHnnGN5IplrgR5XA3sh98WksQ"

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
