"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { Button } from "@/components/ui/button" // Import Button
import { ArrowLeft } from "lucide-react" // Import ArrowLeft icon
import { useRouter } from "next/navigation"; // Import useRouter

// Define InternalReport interface (must match your database schema)
interface InternalReport {
  id: number;
  original_report_id: string | null;
  incident_type_id: number;
  incident_date: string; // TIMESTAMPTZ
  time_responded: string | null; // TIMESTAMPTZ
  barangay_id: number;
  er_team_id: number;
  persons_involved: number | null;
  number_of_responders: number | null;
  prepared_by: string;
  created_at: string; // TIMESTAMPTZ
}

// Define BaseEntry for reference tables (Barangays, Incident Types, ER Teams)
interface BaseEntry {
  id: number;
  name: string;
}

interface ReportHistoryTableProps {
  internalReports: InternalReport[];
  barangays: BaseEntry[];
  incidentTypes: BaseEntry[];
  erTeams: BaseEntry[];
}

export function ReportHistoryTable({ internalReports, barangays, incidentTypes, erTeams }: ReportHistoryTableProps) {
  const router = useRouter(); // Initialize useRouter

  const getBarangayName = (id: number) => barangays.find(b => b.id === id)?.name || 'N/A';
  const getIncidentTypeName = (id: number) => incidentTypes.find(it => it.id === id)?.name || 'N/A';
  const getErTeamName = (id: number) => erTeams.find(et => et.id === et.id)?.name || 'N/A';

  return (
    <Card className="shadow-lg h-full rounded-lg">
      <CardHeader className="bg-gray-800 text-white rounded-t-lg p-4 flex justify-between items-center"> {/* Added flex and items-center */}
        <CardTitle className="text-2xl font-bold">History of Admin Reports</CardTitle>
        <Button
          variant="outline"
          className="bg-gray-200 hover:bg-gray-300 text-gray-800"
          onClick={() => router.push('/')} 
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back 
        </Button>
      </CardHeader>
      <CardContent className="p-6 bg-white rounded-b-lg">
        <div className="overflow-x-auto">
          {internalReports.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100">
                  <TableHead className="w-[100px] font-semibold text-gray-700">Report ID</TableHead>
                  <TableHead className="font-semibold text-gray-700">Original Incident ID</TableHead>
                  <TableHead className="font-semibold text-gray-700">Incident Type</TableHead>
                  <TableHead className="font-semibold text-gray-700">Incident Date & Time</TableHead>
                  <TableHead className="font-semibold text-gray-700">Barangay</TableHead>
                  <TableHead className="font-semibold text-gray-700">ER Team</TableHead>
                  <TableHead className="font-semibold text-gray-700">Persons Involved</TableHead>
                  <TableHead className="font-semibold text-gray-700">Number of Responders</TableHead>
                  <TableHead className="font-semibold text-gray-700">Prepared By</TableHead>
                  <TableHead className="font-semibold text-gray-700">Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {internalReports.map((report) => (
                  <TableRow key={report.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-gray-800">{report.id}</TableCell>
                    <TableCell className="text-gray-700">{report.original_report_id ? report.original_report_id.substring(0, 8) + '...' : 'N/A'}</TableCell>
                    <TableCell className="text-gray-700">{getIncidentTypeName(report.incident_type_id)}</TableCell>
                    <TableCell className="text-gray-700">{format(new Date(report.incident_date), 'PPP HH:mm')}</TableCell>
                    <TableCell className="text-gray-700">{getBarangayName(report.barangay_id)}</TableCell>
                    <TableCell className="text-gray-700">{getErTeamName(report.er_team_id)}</TableCell>
                    <TableCell className="text-gray-700">{report.persons_involved ?? 'N/A'}</TableCell>
                    <TableCell className="text-gray-700">{report.number_of_responders ?? 'N/A'}</TableCell>
                    <TableCell className="text-gray-700">{report.prepared_by}</TableCell>
                    <TableCell className="text-gray-700">{format(new Date(report.created_at), 'PPP HH:mm')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10 text-gray-500">No admin reports found.</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
