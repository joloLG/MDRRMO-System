"use client"

import * as React from "react"
import Image from "next/image"
import { format } from "date-fns"
import { Loader2, AlertTriangle, LogOut } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InternalReportDetail, type InternalReportRecord, type InternalReportPatientRecord } from "@/components/admin/internal-report-detail"

interface BaseEntry {
  id: number
  name: string
}

interface HospitalRecord {
  id: string
  name: string
}

interface HospitalDashboardProps {
  onLogout: () => void
}

export function HospitalDashboard({ onLogout }: HospitalDashboardProps) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [hospital, setHospital] = React.useState<HospitalRecord | null>(null)
  const [reports, setReports] = React.useState<InternalReportRecord[]>([])
  const [patientMap, setPatientMap] = React.useState<Record<number, InternalReportPatientRecord[]>>({})
  const [barangays, setBarangays] = React.useState<BaseEntry[]>([])
  const [incidentTypes, setIncidentTypes] = React.useState<BaseEntry[]>([])
  const [erTeams, setErTeams] = React.useState<BaseEntry[]>([])
  const [selectedReport, setSelectedReport] = React.useState<InternalReportRecord | null>(null)
  const [selectedMeta, setSelectedMeta] = React.useState<{ barangay: string; incidentType: string; erTeam: string }>({
    barangay: "",
    incidentType: "",
    erTeam: "",
  })
  const [searchTerm, setSearchTerm] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)

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
          .from("hospital_users")
          .select("hospital_id")
          .eq("user_id", user.id)
          .maybeSingle()

        if (mappingError) throw mappingError
        if (!mapping) {
          setError("No hospital assignment found for this account. Please contact the MDRRMO administrator.")
          setLoading(false)
          return
        }

        const hospitalId = mapping.hospital_id

        const [hospitalRes, barangaysRes, incidentTypesRes, erTeamsRes, reportsRes] = await Promise.all([
          supabase.from("hospitals").select("id, name").eq("id", hospitalId).single(),
          supabase.from("barangays").select("id, name").order("name", { ascending: true }),
          supabase.from("incident_types").select("id, name").order("name", { ascending: true }),
          supabase.from("er_teams").select("id, name").order("name", { ascending: true }),
          supabase
            .from("internal_reports")
            .select("*")
            .eq("receiving_hospital_id", hospitalId)
            .order("incident_date", { ascending: false })
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
        const sortedReports = (reportsRes.data as InternalReportRecord[]).sort((a, b) => b.id - a.id)
        setReports(sortedReports)
        setCurrentPage(1)

        const reportIds = sortedReports.map((report) => report.id)
        if (reportIds.length > 0) {
          const { data: patientRows, error: patientError } = await supabase
            .from("internal_report_patients")
            .select("*")
            .in("internal_report_id", reportIds)

          if (patientError) throw patientError

          const grouped: Record<number, InternalReportPatientRecord[]> = {}
          for (const patient of (patientRows ?? []) as InternalReportPatientRecord[]) {
            if (!grouped[patient.internal_report_id]) grouped[patient.internal_report_id] = []
            grouped[patient.internal_report_id].push(patient)
          }
          setPatientMap(grouped)
        } else {
          setPatientMap({})
        }
      } catch (err: any) {
        console.error("Failed to load hospital dashboard:", err)
        const message = err?.message || "Unable to load hospital dashboard. Please try again later."
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void loadHospitalData()
  }, [])

  const getPatientsForReport = React.useCallback(
    (reportId: number): InternalReportPatientRecord[] => patientMap[reportId] ?? [],
    [patientMap]
  )

  const getBarangayName = React.useCallback((id: number | null | undefined) => {
    if (!id) return "—"
    return barangays.find((b) => b.id === id)?.name ?? "—"
  }, [barangays])

  const getIncidentTypeName = React.useCallback((id: number | null | undefined) => {
    if (!id) return "—"
    return incidentTypes.find((it) => it.id === id)?.name ?? "—"
  }, [incidentTypes])

  const getErTeamName = React.useCallback((id: number | null | undefined) => {
    if (!id) return "—"
    return erTeams.find((et) => et.id === id)?.name ?? "—"
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

  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const pageSize = 15

  const filteredReports = React.useMemo(() => {
    if (!searchTerm.trim()) return reports
    const term = searchTerm.toLowerCase()
    return reports.filter((report) => {
      const idMatch = report.id.toString().includes(term)
      const patients = getPatientsForReport(report.id)
      const patientMatch = patients.some((patient) => (patient.patient_name ?? "").toLowerCase().includes(term))
      const barangayMatch = getBarangayName(report.barangay_id).toLowerCase().includes(term)
      const incidentMatch = getIncidentTypeName(report.incident_type_id).toLowerCase().includes(term)
      return idMatch || patientMatch || barangayMatch || incidentMatch
    })
  }, [reports, searchTerm, getBarangayName, getIncidentTypeName, getPatientsForReport])

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / pageSize))

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const paginatedReports = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredReports.slice(start, start + pageSize)
  }, [filteredReports, currentPage])

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
                {reports.length > 0 ? format(new Date(reports[0].incident_date), "PPP • hh:mm a") : "—"}
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
          <CardHeader className="flex flex-col gap-3 bg-white pb-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl font-semibold text-gray-900">Transferred Patients</CardTitle>
                  <Badge variant="outline" className="border-orange-500 text-orange-600">
                    {filteredReports.length} Case{filteredReports.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  View patient details and injury diagrams for transfers endorsed to your hospital.
                </p>
              </div>
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by ID, patient, barangay, or incident"
                className="w-full sm:w-72"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="text-gray-700">Report ID</TableHead>
                    <TableHead className="text-gray-700">Incident Date</TableHead>
                    <TableHead className="text-gray-700">Patient Name</TableHead>
                    <TableHead className="text-gray-700">Incident Type</TableHead>
                    <TableHead className="text-gray-700">Prepared By</TableHead>
                    <TableHead className="text-gray-700">ER Team</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedReports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-gray-500">
                        {reports.length === 0 ? "No transfers recorded for your hospital yet." : "No matches found for your search."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedReports.map((report) => (
                      <TableRow
                        key={report.id}
                        className="cursor-pointer transition hover:bg-orange-50"
                        onClick={() => handleViewReport(report)}
                      >
                        <TableCell className="font-semibold text-gray-900">{report.id}</TableCell>
                        <TableCell className="text-gray-700">
                          {format(new Date(report.incident_date), "PPP • hh:mm a")}
                        </TableCell>
                        <TableCell className="text-gray-700">
                          {(() => {
                            const patients = getPatientsForReport(report.id)
                            if (patients.length === 0) return "—"
                            const firstName = patients[0]?.patient_name || "Unnamed patient"
                            return patients.length > 1 ? `${firstName} +${patients.length - 1}` : firstName
                          })()}
                        </TableCell>
                        <TableCell className="text-gray-700">{getIncidentTypeName(report.incident_type_id)}</TableCell>
                        <TableCell className="text-gray-700">{report.prepared_by || "—"}</TableCell>
                        <TableCell className="text-gray-700">{getErTeamName(report.er_team_id)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {filteredReports.length > pageSize && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 px-4 py-4 text-sm text-gray-600 sm:flex-row">
                <span>
                  Showing {(currentPage - 1) * pageSize + 1}–
                  {Math.min(currentPage * pageSize, filteredReports.length)} of {filteredReports.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
                    Previous
                  </Button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      <header className="bg-orange-600 py-6 shadow">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 text-white">
          <Image src="/images/logo.png" alt="MDRRMO Logo" width={72} height={72} className="hidden h-16 w-auto sm:block" />
          <div className="flex flex-1 items-center justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-wide text-orange-100">MDRRMO Patient Transfer Portal</p>
              <h1 className="text-2xl font-bold">Hospital Dashboard</h1>
            </div>
            <Button variant="outline" className="border-white text-black hover:bg-white/20" onClick={onLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
          <Image src="/images/bulan-logo.png" alt="Bulan Municipality Logo" width={72} height={72} className="hidden h-16 w-auto sm:block" />
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-6xl px-6">
        {renderContent()}
      </main>

      <Dialog open={selectedReport !== null} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent
          className="border-none bg-white p-0 shadow-xl"
          style={{ width: "21.59cm", height: "33.02cm", maxWidth: "95vw", maxHeight: "90vh" }}
        >
          <VisuallyHidden>
            <DialogTitle>Internal report detail</DialogTitle>
          </VisuallyHidden>
          <DialogDescription className="sr-only">
            View the read-only patient transfer report, including diagrams and injury legends, sized to legal bond paper dimensions.
          </DialogDescription>
          {selectedReport ? (
            <div className="h-full overflow-y-auto p-6">
              <InternalReportDetail
                report={selectedReport}
                patients={getPatientsForReport(selectedReport.id)}
                barangayName={selectedMeta.barangay}
                incidentTypeName={selectedMeta.incidentType}
                erTeamName={selectedMeta.erTeam}
                restrictToPatientView
              />
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-gray-600">Loading report...</div>
          )}
        </DialogContent>
      </Dialog>
      <div className="fixed bottom-0 left-0 right-0 bg-orange-500/95 backdrop-blur-sm text-white p-4 z-10">
        <div className="flex justify-center">
          <span className="text-center text-xs sm:text-sm font-medium">Copyright 2025 | Jolo Gracilla</span>
        </div>
      </div>
    </div>
  )
}
