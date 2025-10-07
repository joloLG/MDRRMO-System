import { BehaviorSubject } from 'rxjs'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabase'

export interface MobileNotification {
  id: string
  emergency_report_id: string
  message: string
  is_read: boolean
  created_at: string
}

export interface MobileReport {
  id: string
  emergency_type: string
  status: string
  admin_response?: string
  resolved_at?: string
  created_at: string
}

const makeKey = (userId: string, suffix: string) => `mdrrmo_${userId}_${suffix}`

export const notifications$ = new BehaviorSubject<MobileNotification[]>([])
export const userReports$ = new BehaviorSubject<MobileReport[]>([])

let initializedFor: string | null = null
let teardown: (() => void) | null = null
let lastResumeAt = 0
const RESUME_COOLDOWN_MS = 1000

async function fetchNotifications(userId: string) {
  const { data, error } = await supabase
    .from('user_notifications')
    .select('id, emergency_report_id, message, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (!error && Array.isArray(data)) {
    notifications$.next(data as any)
    try { localStorage.setItem(makeKey(userId, 'notifications'), JSON.stringify(data)) } catch {}
  }
}

async function fetchUserReports(userId: string) {
  const { data, error } = await supabase
    .from('emergency_reports')
    .select('id, emergency_type, status, admin_response, resolved_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (!error && Array.isArray(data)) {
    userReports$.next(data as any)
    try { localStorage.setItem(makeKey(userId, 'userReports'), JSON.stringify(data)) } catch {}
  }
}

export function initMobileState(userId: string) {
  if (!Capacitor.isNativePlatform()) return
  if (initializedFor === userId && teardown) return
  initializedFor = userId

  // Load cached data first for instant UI
  try {
    const cachedN = localStorage.getItem(makeKey(userId, 'notifications'))
    if (cachedN) notifications$.next(JSON.parse(cachedN))
  } catch {}
  try {
    const cachedR = localStorage.getItem(makeKey(userId, 'userReports'))
    if (cachedR) userReports$.next(JSON.parse(cachedR))
  } catch {}

  // Initial fetch
  void fetchNotifications(userId)
  void fetchUserReports(userId)

  // Realtime channels
  const notifsCh = supabase
    .channel(`mobile_user_notifications_${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` }, () => {
      void fetchNotifications(userId)
    })
    .subscribe()

  const reportsCh = supabase
    .channel(`mobile_user_reports_${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports', filter: `user_id=eq.${userId}` }, () => {
      void fetchUserReports(userId)
    })
    .subscribe()

  // App resume: throttle to 1s
  const resume = async () => {
    const now = Date.now()
    if (now - lastResumeAt < RESUME_COOLDOWN_MS) return
    lastResumeAt = now
    await Promise.allSettled([
      fetchNotifications(userId),
      fetchUserReports(userId),
    ])
  }
  let resumeHandle: any
  App.addListener('resume', () => { void resume() }).then(h => { resumeHandle = h }).catch(() => {})

  teardown = () => {
    try { supabase.removeChannel(notifsCh) } catch {}
    try { supabase.removeChannel(reportsCh) } catch {}
    try { resumeHandle?.remove?.() } catch {}
  }
}

export function destroyMobileState() {
  try { teardown?.() } catch {}
  teardown = null
  initializedFor = null
}
