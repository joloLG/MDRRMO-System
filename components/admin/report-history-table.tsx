"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Search, ChevronLeft, ChevronRight } from "lucide-react" // Added Chevron icons
import Link from "next/link";
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
  // Props for Search and Filters
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedIncidentType: number | 'all';
  setSelectedIncidentType: (id: number | 'all') => void;
  selectedBarangay: number | 'all';
  setSelectedBarangay: (id: number | 'all') => void;
  selectedErTeam: number | 'all';
  setSelectedErTeam: (id: number | 'all') => void;
  // --- New Props for Pagination ---
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  totalReports: number;
  // --------------------------------
}

export function ReportHistoryTable({ 
  internalReports, 
  barangays, 
  incidentTypes, 
  erTeams,
  searchTerm,
  setSearchTerm,
  selectedIncidentType,
  setSelectedIncidentType,
  selectedBarangay,
  setSelectedBarangay,
  selectedErTeam,
  setSelectedErTeam,
  // --- Pagination Props ---
  currentPage,
  setCurrentPage,
  totalPages,
  totalReports,
}: ReportHistoryTableProps) {

  const getBarangayName = (id: number) => barangays.find(b => b.id === id)?.name || 'N/A';
  const getIncidentTypeName = (id: number) => incidentTypes.find(it => it.id === id)?.name || 'N/A';
  const getErTeamName = (id: number) => erTeams.find(et => et.id === id)?.name || 'N/A'; 

  // Handlers for pagination buttons
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Back Button for Admin Dashboard */}
      <div className="flex justify-start mb-4">
        <Button
          variant="outline"
          className="bg-gray-200 hover:bg-gray-300 text-gray-800"
          asChild
        >
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Link>
        </Button>
      </div>

    <Card className="shadow-lg h-full rounded-lg">
      <CardHeader className="bg-orange-600 text-white rounded-t-lg p-4 flex justify-between items-center">
        {/* CardTitle is the "History of Admin Reports" text */}
        <CardTitle className="text-2xl font-bold">History of Admin Reports</CardTitle>
      </CardHeader>
      
      <CardContent className="p-6 bg-white rounded-b-lg">
        {/* --- Search and Filters Section --- */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
          {/* Search Input */}
          <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by ID, Prepared By, or Keyword..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg w-full"
              />
          </div>

          {/* Incident Type Filter */}
          <Select 
            value={String(selectedIncidentType)} 
            onValueChange={(value) => setSelectedIncidentType(value === 'all' ? 'all' : Number(value))}
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter by Incident Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Incident Types</SelectItem>
              {incidentTypes.map((type) => (
                <SelectItem key={type.id} value={String(type.id)}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Barangay Filter */}
          <Select 
            value={String(selectedBarangay)} 
            onValueChange={(value) => setSelectedBarangay(value === 'all' ? 'all' : Number(value))}
          >
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="Filter by Barangay" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Barangays</SelectItem>
              {barangays.map((barangay) => (
                <SelectItem key={barangay.id} value={String(barangay.id)}>
                  {barangay.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* ER Team Filter */}
          <Select 
            value={String(selectedErTeam)} 
            onValueChange={(value) => setSelectedErTeam(value === 'all' ? 'all' : Number(value))}
          >
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="Filter by ER Team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ER Teams</SelectItem>
              {erTeams.map((team) => (
                <SelectItem key={team.id} value={String(team.id)}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* ----------------------------------- */}

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
            <div className="text-center py-10 text-gray-500">No admin reports found matching the current filters.</div>
          )}
        </div>
        
        {/* --- Pagination Controls --- */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages} ({totalReports} reports total)
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                className="p-2 h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="p-2 h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {/* ----------------------------- */}

      </CardContent>
    </Card>
    </div>
  )
}