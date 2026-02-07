"use client"

import * as React from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, Clock, Eye, CheckCircle, XCircle, AlertCircle, Calendar, User, MapPin, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/components/ui/use-toast"
import { StandaloneReportDetail } from "@/components/admin/standalone-report-detail"

interface StandaloneReport {
  id: string
  report_title: string
  report_date: string
  incident_type?: string
  incident_location?: string
  incident_payload?: any
  status: "draft" | "pending_review" | "in_review" | "approved" | "rejected"
  patient_payload: any[]
  injury_payload?: any
  notes?: string
  review_notes?: string
  created_at: string
  updated_at: string
  reviewed_at?: string
  reviewed_by?: string
  er_team?: { id: number; name: string }
  submitter?: { id: string; email: string; full_name?: string }
}

const STATUS_CONFIG = {
  draft: { label: "Draft", icon: FileText, className: "bg-gray-200 text-gray-800" },
  pending_review: { label: "Pending Review", icon: Clock, className: "bg-amber-200 text-amber-800" },
  in_review: { label: "In Review", icon: Eye, className: "bg-blue-200 text-blue-800" },
  approved: { label: "Approved", icon: CheckCircle, className: "bg-emerald-200 text-emerald-900" },
  rejected: { label: "Rejected", icon: XCircle, className: "bg-red-200 text-red-800" },
}

export function StandaloneReportsList() {
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const [reports, setReports] = React.useState<StandaloneReport[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedReport, setSelectedReport] = React.useState<StandaloneReport | null>(null)
  const [isDetailViewOpen, setIsDetailViewOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [debugMode, setDebugMode] = React.useState(false)

  // Play notification sound from alert_sounds bucket
  const playNotificationSound = React.useCallback(async () => {
    try {
      const soundEnabled = typeof window !== 'undefined' 
        ? localStorage.getItem('mdrrmo_admin_sound_enabled') !== 'false'
        : true

      if (!soundEnabled) return

      // Get notification sound from storage
      const { data: files } = await supabase.storage
        .from('alert_sounds')
        .list('', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } })

      if (files && files.length > 0) {
        const { data: urlData } = await supabase.storage
          .from('alert_sounds')
          .createSignedUrl(files[0].name, 60)

        if (urlData?.signedUrl) {
          const audio = new Audio(urlData.signedUrl)
          audio.volume = 0.5
          await audio.play().catch(e => console.error('Error playing sound:', e))
        }
      }
    } catch (error) {
      console.error('Error playing notification sound:', error)
    }
  }, [supabase])

  const loadReports = React.useCallback(async () => {
    try {
      console.log('[StandaloneReportsList] Loading reports directly from Supabase... Debug mode:', debugMode)
      
      // Query directly from Supabase - simplified without joins
      let query = supabase
        .from('standalone_er_reports')
        .select('*')
        .order('created_at', { ascending: false })

      // Apply status filter only if not in debug mode
      if (!debugMode) {
        query = query.in('status', ['pending_review', 'in_review'])
      }

      const { data, error: queryError } = await query

      console.log('[StandaloneReportsList] Query result:', { data, error: queryError })

      if (queryError) {
        console.error('[StandaloneReportsList] Supabase error:', queryError)
        setError(queryError.message || 'Failed to load reports')
        setReports([])
      } else {
        console.log('[StandaloneReportsList] Reports loaded:', data?.length || 0)
        setReports(data || [])
        setError(null)
      }
    } catch (error: any) {
      console.error('[StandaloneReportsList] Failed to load:', error)
      setError(error.message || "Network error")
      setReports([])
    } finally {
      setIsLoading(false)
    }
  }, [debugMode, supabase])

  React.useEffect(() => {
    loadReports()

    // Set up real-time subscription for new reports
    const channel = supabase
      .channel('standalone-reports-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'standalone_er_reports',
          filter: 'status=eq.pending_review'
        },
        async (payload) => {
          console.log('New standalone report received:', payload)
          
          // Play notification sound
          await playNotificationSound()

          // Show toast notification
          toast({
            title: "New ER Team Report",
            description: `A new standalone PCR report has been submitted for review.`,
          })

          // Reload reports
          await loadReports()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'standalone_er_reports'
        },
        async (payload) => {
          console.log('Standalone report updated:', payload)
          // Reload reports
          await loadReports()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadReports, playNotificationSound, supabase, toast])

  const handleReviewAction = async (action: "approve" | "reject" | "in_review", reviewNotes: string) => {
    if (!selectedReport) return

    setIsSubmitting(true)
    try {
      const statusMap = {
        approve: 'approved',
        reject: 'rejected',
        in_review: 'in_review'
      }

      const { data: { user } } = await supabase.auth.getUser()
      
      const { error: updateError } = await supabase
        .from('standalone_er_reports')
        .update({
          status: statusMap[action],
          review_notes: reviewNotes || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id || null
        })
        .eq('id', selectedReport.id)

      if (updateError) {
        throw new Error(updateError.message || "Failed to update report")
      }

      toast({
        title: `Report ${statusMap[action]}`,
        description: `The report has been ${statusMap[action]} successfully.`,
      })

      await loadReports()
      setIsDetailViewOpen(false)
      setSelectedReport(null)
    } catch (error: any) {
      console.error("Failed to update report:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update report",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const openDetailView = (report: StandaloneReport) => {
    setSelectedReport(report)
    setIsDetailViewOpen(true)
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ER Team Submitted Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="mb-3 h-12 w-12 text-red-500" />
            <p className="text-sm font-medium text-gray-900 mb-1">Failed to Load Reports</p>
            <p className="text-xs text-gray-600 mb-3">{error}</p>
            <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded border border-amber-200 max-w-md">
              <strong>Note:</strong> If you see "relation does not exist" error, run the database migration first:
              <code className="block mt-1 text-xs bg-white p-1 rounded">supabase/migrations/20260207070000_standalone_er_reports.sql</code>
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={loadReports}
              className="mt-4"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ER Team Submitted Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="mb-2 inline-block h-6 w-6 animate-spin rounded-full border-3 border-solid border-orange-600 border-r-transparent"></div>
              <p className="text-sm text-gray-600">Loading reports...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (reports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ER Team Submitted Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="mb-3 h-12 w-12 text-gray-400" />
            <p className="text-sm text-gray-600">No pending reports from ER Teams</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-600" />
              ER Team Submitted Reports
              <Badge variant="secondary">
                {reports.length}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsLoading(true)
                  loadReports()
                }}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button
                size="sm"
                variant={debugMode ? "default" : "outline"}
                onClick={() => setDebugMode(!debugMode)}
                className={debugMode ? "bg-amber-600 hover:bg-amber-700" : ""}
              >
                {debugMode ? "Show Pending Only" : "Show All Reports"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {reports.map((report) => {
              const statusConfig = STATUS_CONFIG[report.status]
              const StatusIcon = statusConfig.icon
              const patientCount = Array.isArray(report.patient_payload) ? report.patient_payload.length : 0

              return (
                <div
                  key={report.id}
                  className="rounded-lg border border-gray-200 p-4 hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{report.report_title}</h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(report.report_date), "MMM dd, yyyy")}
                        </span>
                        {report.er_team?.name && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {report.er_team.name}
                          </span>
                        )}
                        {report.incident_location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {report.incident_location}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge className={statusConfig.className}>
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {statusConfig.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    {report.incident_type && (
                      <div>
                        <span className="font-medium text-gray-700">Type:</span>{" "}
                        <span className="text-gray-600">{report.incident_type}</span>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-gray-700">Patients:</span>{" "}
                      <span className="text-gray-600">{patientCount}</span>
                    </div>
                  </div>

                  {report.notes && (
                    <div className="mb-3 rounded bg-gray-50 p-2 text-xs text-gray-700">
                      <span className="font-medium">Notes:</span> {report.notes}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => openDetailView(report)}
                      className="text-xs bg-orange-600 hover:bg-orange-700"
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      View Details
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {selectedReport && (
        <StandaloneReportDetail
          report={selectedReport}
          isOpen={isDetailViewOpen}
          onClose={() => {
            setIsDetailViewOpen(false)
            setSelectedReport(null)
          }}
          onReview={handleReviewAction}
          isSubmitting={isSubmitting}
        />
      )}
    </>
  )
}
