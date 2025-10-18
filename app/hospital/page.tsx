"use client"

import * as React from "react"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, AlertTriangle } from "lucide-react"
import { InternalReportDetail, type InternalReportRecord } from "@/components/admin/internal-report-detail"

interface BaseEntry {
  id: number
  name: string
}

interface HospitalRecord {
  id: string
  name: string
}

export default function HospitalDashboardPage() {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [hospital, setHospital] = React.useState<HospitalRecord | null>(null)
  const [reports, setReports] = React.useState<InternalReportRecord[]>([])
  const [barangays, setBarangays] = React.useState<BaseEntry[]>([])
  const [incidentTypes, setIncidentTypes] = React.useState<BaseEntry[]>([])
  const [erTeams, setErTeams] = React.useState<BaseEntry[]>([])
  const [selectedReport, setSelectedReport] = React.useState<InternalReportRecord | null>(null)
  const [selectedMeta, setSelectedMeta] = React.useState<{ barangay: string; incidentType: string; erTeam: string }>({
    barangay: "",
    incidentType: "",
    erTeam: "",
  })

  React.useEffect(() => {
    const loadHospitalData = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        const user = authData?.user
        if (!user) {
          setError("You must be signed in to view hospital transfers.")
          setLoading(false)
          return
        }

        const { data: mapping, error: mappingError } = await supabase
          .from('hospital_users')
          .select('hospital_id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (mappingError) throw mappingError
        if (!mapping) {
          setError("No hospital assignment found for this account. Please contact the MDRRMO administrator.")
          setLoading(false)
          return
        }

        const hospitalId = mapping.hospital_id

        const [hospitalRes, barangaysRes, incidentTypesRes, erTeamsRes, reportsRes] = await Promise.all([
          supabase.from('hospitals').select('id, name').eq('id', hospitalId).single(),
          supabase.from('barangays').select('id, name').order('name', { ascending: true }),
          supabase.from('incident_types').select('id, name').order('name', { ascending: true }),
          supabase.from('er_teams').select('id, name').order('name', { ascending: true }),
          supabase
            .from('internal_reports')
            .select('*')
            .eq('receiving_hospital_id', hospitalId)
            .order('incident_date', { ascending: false })
        ])

        if (hospitalRes.error) throw hospitalRes.error
        if (barangaysRes.error) throw barangaysRes.error
        if (incidentTypesRes.error) throw incidentTypesRes.error
        if (erTeamsRes.error) throw erTeamsRes.error
        if (reportsRes.error) throw reportsRes.error

        setHospital(hospitalRes.data as HospitalRecord)
        setBarangays(barangaysRes.data as BaseEntry[])
        setIncidentTypes(incidentTypesRes.data as BaseEntry[])
        setErTeams(erTeamsRes.data as BaseEntry[])
        setReports(reportsRes.data as InternalReportRecord[])
      } catch (err: any) {
        console.error('Failed to load hospital dashboard:', err)
        const message = err?.message || 'Unable to load hospital dashboard. Please try again later.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void loadHospitalData()
  }, [])

  const getBarangayName = React.useCallback((id: number | null | undefined) => {
    if (!id) return '—'
    return barangays.find((b) => b.id === id)?.name ?? '—'
  }, [barangays])

  const getIncidentTypeName = React.useCallback((id: number | null | undefined) => {
    if (!id) return '—'
    return incidentTypes.find((it) => it.id === id)?.name ?? '—'
  }, [incidentTypes])

  const getErTeamName = React.useCallback((id: number | null | undefined) => {
    if (!id) return '—'
    return erTeams.find((et) => et.id === id)?.name ?? '—'
  }, [erTeams])

  const handleViewReport = (report: InternalReportRecord) => {
    setSelectedReport(report)
    setSelectedMeta({
      barangay: getBarangayName(report.barangay_id),
      incidentType: getIncidentTypeName(report.incident_type_id),
      erTeam: getErTeamName(report.er_team_id),
    })
  }

  const closeDialog = () => {
    setSelectedReport(null)
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex h-72 flex-col items-center justify-center gap-3 text-orange-600">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="text-sm font-medium">Loading patient transfers...</p>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex h-72 flex-col items-center justify-center gap-4 text-center">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <div>
            <p className="text-lg font-semibold text-gray-800">We hit a snag</p>
            <p className="text-sm text-gray-600">{error}</p>
          </div>
        </div>
      )
    }

    if (!hospital) {
      return (
        <div className="flex h-72 flex-col items-center justify-center text-gray-600">
          Hospital assignment not found. Please contact the MDRRMO administrator.
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <Card className="border-none shadow-lg">
          <CardHeader className="bg-orange-600 text-white">
            <CardTitle className="text-2xl font-bold">{hospital.name}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 text-sm text-gray-700 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-gray-500">Total Transfers</p>
              <p className="text-xl font-semibold text-gray-900">{reports.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Most Recent Transfer</p>
              <p className="text-base font-medium text-gray-900">
                {reports.length > 0 ? format(new Date(reports[0].incident_date), 'PPP • hh:mm a') : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Unique Barangays</p>
              <p className="text-xl font-semibold text-gray-900">
                {new Set(reports.map((report) => report.barangay_id)).size}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <CardHeader className="flex flex-col gap-2 bg-white pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold text-gray-900">Transferred Patients</CardTitle>
              <Badge variant="outline" className="border-orange-500 text-orange-600">
                {reports.length} Case{reports.length === 1 ? '' : 's'}
              </Badge>
            </div>
            <p className="text-sm text-gray-600">
              View patient details and injury diagrams for transfers endorsed to your hospital.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="text-gray-700">Report ID</TableHead>
                    <TableHead className="text-gray-700">Incident Date</TableHead>
                    <TableHead className="text-gray-700">Patient Name</TableHead>
                    <TableHead className="text-gray-700">Barangay</TableHead>
                    <TableHead className="text-gray-700">Prepared By</TableHead>
                    <TableHead className="text-gray-700">ER Team</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-gray-500">
                        No transfers recorded for your hospital yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reports.map((report) => (
                      <TableRow
                        key={report.id}
                        className="cursor-pointer transition hover:bg-orange-50"
                        onClick={() => handleViewReport(report)}
                      >
                        <TableCell className="font-semibold text-gray-900">{report.id}</TableCell>
                        <TableCell className="text-gray-700">
                          {format(new Date(report.incident_date), 'PPP • hh:mm a')}
                        </TableCell>
                        <TableCell className="text-gray-700">{report.patient_name || '—'}</TableCell>
                        <TableCell className="text-gray-700">{getBarangayName(report.barangay_id)}</TableCell>
                        <TableCell className="text-gray-700">{report.prepared_by || '—'}</TableCell>
                        <TableCell className="text-gray-700">{getErTeamName(report.er_team_id)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      <header className="bg-orange-600 py-6 shadow">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-white">
          <div>
            <p className="text-sm uppercase tracking-wide text-orange-100">MDRRMO Patient Transfer Portal</p>
            <h1 className="text-2xl font-bold">Hospital Dashboard</h1>
          </div>
          <Button variant="secondary" className="bg-white/20 text-white hover:bg-white/30" disabled>
            View Only Access
          </Button>
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-6xl px-6">
        {renderContent()}
      </main>

      <Dialog open={selectedReport !== null} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-5xl border-none bg-white p-0 shadow-xl">
          {selectedReport ? (
            <div className="max-h-[85vh] overflow-y-auto p-6">
              <InternalReportDetail
                report={selectedReport}
                barangayName={selectedMeta.barangay}
                incidentTypeName={selectedMeta.incidentType}
                erTeamName={selectedMeta.erTeam}
              />
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-gray-600">Loading report...</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
