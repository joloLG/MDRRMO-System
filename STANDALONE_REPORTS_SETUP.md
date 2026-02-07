# Standalone ER Team Reports - Setup & Testing Guide

## ✅ What's Been Implemented

### 1. **ER Team Side** (`components/er-team/pages/reports-page.tsx`)
- ✅ Reports tab in bottom navigation
- ✅ "New Report" button opens full PCR form in modal
- ✅ Form submission sends to `/api/er-team/standalone-reports`
- ✅ Sets status to "pending_review" automatically

### 2. **Admin Side** (`components/admin/standalone-reports-list.tsx`)
- ✅ Component positioned below admin report form with orange separator
- ✅ Real-time subscription listens for new reports on `standalone_er_reports` table
- ✅ Notification sound from `alert_sounds` storage bucket
- ✅ Toast notification displays when new report arrives
- ✅ Shows report cards with status badges
- ✅ Admin can review, approve, or reject reports

### 3. **API Endpoints**
- ✅ `/api/er-team/standalone-reports` - ER Team CRUD operations
- ✅ `/api/admin/standalone-reports` - Admin review operations
- ✅ Both endpoints include proper RLS policies

### 4. **Database Migration**
- ✅ File created: `supabase/migrations/20260207070000_standalone_er_reports.sql`
- ⚠️ **NEEDS TO BE APPLIED** - This is likely why admin isn't receiving reports

---

## 🚨 CRITICAL: Apply Database Migration

The `standalone_er_reports` table doesn't exist yet. Run this migration:

### Option 1: Supabase CLI (Recommended)
```bash
cd c:\Users\jlcha\mdrrmo-app
npx supabase db push
```

### Option 2: Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Open: `supabase/migrations/20260207070000_standalone_er_reports.sql`
3. Copy entire contents
4. Paste into SQL Editor
5. Click "Run"

### Option 3: Manual Test Query
Run this first to check if table exists:
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'standalone_er_reports'
);
```

---

## 🧪 Testing Workflow

### Step 1: ER Team Submits Report
1. Login as ER Team member
2. Click "Reports" tab (bottom navigation)
3. Click "New Report" button
4. Fill out PCR form:
   - Patient details
   - Incident information
   - Body diagrams (optional)
5. Click "Submit for Review"
6. ✅ Success: Form closes, report appears in list

### Step 2: Admin Receives Notification
**What should happen:**
1. 🔊 **Sound plays** from `alert_sounds` bucket
2. 🔔 **Toast notification** appears: "New ER Team Report"
3. 📊 **Report card appears** in "ER Team Submitted Reports" section
4. ⏰ Status shows "Pending Review" (amber badge)

**Where to look:**
- Admin Report Form page (`/admin/report`)
- Scroll below the main incident form
- Look for orange separator line: "ER Team Submitted Reports"
- Report cards appear below separator

### Step 3: Admin Reviews Report
1. Click on report card
2. Review dialog opens with full details
3. Admin can:
   - Mark "In Review" (blue badge)
   - Approve (green badge)
   - Reject with notes (red badge)

---

## 🐛 Troubleshooting

### Issue: Admin sees no reports
**Cause:** Database table doesn't exist
**Fix:** Apply migration (see above)

### Issue: Admin sees error message
**Check error message:**
- "relation does not exist" → Apply migration
- "ER team assignment not found" → User not mapped to ER team
- "Unauthorized" → User not logged in as admin

### Issue: No notification sound
**Check:**
1. Browser sound enabled (not muted)
2. LocalStorage: `mdrrmo_admin_sound_enabled` should be `true`
3. `alert_sounds` bucket has audio files
4. Check browser console for errors

### Issue: Real-time not working
**Check:**
1. Database migration applied
2. Supabase realtime enabled for `standalone_er_reports` table
3. Browser console shows subscription status
4. Network tab shows WebSocket connection

---

## 📋 Database Schema

```sql
standalone_er_reports (
  id UUID PRIMARY KEY,
  er_team_id INTEGER → er_teams(id),
  submitted_by UUID → auth.users(id),
  report_title TEXT,
  report_date TIMESTAMPTZ,
  patient_payload JSONB,
  injury_payload JSONB,
  incident_type TEXT,
  incident_location TEXT,
  incident_description TEXT,
  notes TEXT,
  status TEXT (draft|pending_review|in_review|approved|rejected),
  review_notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
)
```

---

## 🔔 Notification Flow

```
ER Team submits report (status: pending_review)
           ↓
Database INSERT on standalone_er_reports
           ↓
Real-time subscription triggers (admin page)
           ↓
playNotificationSound() → alert_sounds bucket → Audio plays
           ↓
toast() → "New ER Team Report" notification
           ↓
loadReports() → Refresh list → New card appears
```

---

## 📍 Admin UI Location

The standalone reports section appears on the **Admin Report Form** page:

```
┌─────────────────────────────────────────────┐
│  Make Report Form (Header)                  │
├─────────────────────────────────────────────┤
│                                             │
│  [Incident Details Form]                    │
│  Step 1, 2, 3...                           │
│                                             │
├─────────────────────────────────────────────┤
│  ═══ ER Team Submitted Reports ═══         │  ← Orange separator
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 📄 PCR Report - 2026-02-07          │   │
│  │ Status: Pending Review  🟡          │   │
│  │ Patients: 1                         │   │
│  │ Location: ...                       │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## ✅ Next Steps

1. **Apply database migration** (most critical)
2. **Test ER Team submission** from Reports tab
3. **Verify admin receives notification** with sound
4. **Test review workflow** (approve/reject)
5. **Verify sound plays** from alert_sounds bucket

---

## 📞 Support

If issues persist after applying migration:
1. Check browser console for errors
2. Check network tab for failed API calls
3. Verify ER Team user is mapped in `er_team_users` table
4. Verify admin user has `user_type = 'admin'` in `users` table
