"use client"

import { ReportHistoryTable } from "@/components/admin/report-history-table"
import { InternalReportDetail, type InternalReportRecord, type InternalReportPatientRecord } from "@/components/admin/internal-report-detail"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"
import { useState, useEffect, useCallback, useMemo } from "react"


interface ReportPatientStatus {
  id: string
  patient_name: string | null
  current_status: string | null
  receiving_hospital_id: string | null
  receiving_hospital_name: string | null
}

interface InternalReport {
  id: number;
  original_report_id: string | null;
  incident_type_id: number;
  incident_date: string; 
  time_responded: string | null; 
  barangay_id: number;
  er_team_id: number;
  persons_involved: number | null;
  number_of_responders: number | null;
  prepared_by: string;
  created_at: string;
  patients: ReportPatientStatus[];
}

interface BaseEntry {
  id: number;
  name: string;
}
const REPORTS_PER_PAGE = 10;

export default function ReportHistoryPage() {
  const [internalReports, setInternalReports] = useState<InternalReport[]>([]);
  const [barangays, setBarangays] = useState<BaseEntry[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<BaseEntry[]>([]);
  const [erTeams, setErTeams] = useState<BaseEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const [selectedReportDetail, setSelectedReportDetail] = useState<InternalReportRecord | null>(null);
  const [selectedPatients, setSelectedPatients] = useState<InternalReportPatientRecord[]>([]);
  const [selectedMeta, setSelectedMeta] = useState<{ barangay: string; incidentType: string; erTeam: string }>({
    barangay: "",
    incidentType: "",
    erTeam: "",
  });

  // State for Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIncidentType, setSelectedIncidentType] = useState<number | 'all'>('all');
  const [selectedBarangay, setSelectedBarangay] = useState<number | 'all'>('all');
  const [selectedErTeam, setSelectedErTeam] = useState<number | 'all'>('all');
  
  // --- New State for Pagination ---
  const [currentPage, setCurrentPage] = useState(1);
  // --------------------------------

  // Function to fetch Internal Reports (No change)
  const fetchInternalReports = useCallback(async () => {
    const { data, error } = await supabase
      .from('internal_reports')
      .select(`
        *,
        internal_report_patients (
          id,
          patient_name,
          current_status,
          receiving_hospital_id,
          receiving_hospital:hospitals!internal_report_patients_receiving_hospital_id_fkey ( name )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching internal reports:", error);
      setError(`Failed to load internal reports: ${error.message || 'Unknown error'}. Please check your Supabase RLS policies.`);
      return [];
    }
    const reports = (data || []).map((report: any) => {
      const patients = (report.internal_report_patients ?? []).map((patient: any) => ({
        id: patient.id,
        patient_name: patient.patient_name ?? null,
        current_status: patient.current_status ?? null,
        receiving_hospital_id: patient.receiving_hospital_id ?? null,
        receiving_hospital_name: patient.receiving_hospital?.name ?? null,
      })) as ReportPatientStatus[]

      const { internal_report_patients, ...rest } = report
      return {
        ...rest,
        patients,
      } as InternalReport
    })

    return reports;
  }, []);

  const fetchBarangays = useCallback(async () => {
    const { data, error } = await supabase
      .from('barangays')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      console.error("Error fetching Barangays:", error);
      setError(`Failed to load Barangays: ${error.message}`);
      return [];
    }
    return data as BaseEntry[] || [];
  }, []);

  // Function to fetch Incident Types
  const fetchIncidentTypes = useCallback(async () => {
    const { data, error } = await supabase
      .from('incident_types')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      console.error("Error fetching Incident Types:", error);
      setError(`Failed to load Incident Types: ${error.message}`);
      return [];
    }
    return data as BaseEntry[] || [];
  }, []);

  // Function to fetch ER Teams
  const fetchErTeams = useCallback(async () => {
    const { data, error } = await supabase
      .from('er_teams')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      console.error("Error fetching ER Teams:", error);
      setError(`Failed to load ER Teams: ${error.message}`);
      return [];
    }
    return data as BaseEntry[] || [];
  }, []);


  useEffect(() => {
    const loadReportHistoryData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [
          reportsData,
          barangaysData,
          incidentTypesData,
          erTeamsData
        ] = await Promise.all([
          fetchInternalReports(),
          fetchBarangays(),
          fetchIncidentTypes(),
          fetchErTeams()
        ]);

        setInternalReports(reportsData);
        setBarangays(barangaysData);
        setIncidentTypes(incidentTypesData);
        setErTeams(erTeamsData);

      } catch (err: any) {
        console.error("Error loading report history data:", err);
        setError(`Failed to load report history: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadReportHistoryData();

    // Set up real-time channels (No change)
    const internalReportsChannel = supabase
      .channel('report-history-internal-reports-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_reports' },
        () => { fetchInternalReports().then(setInternalReports); }
      )
      .subscribe();

    const barangaysChannel = supabase
      .channel('report-history-barangays-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'barangays' },
        () => { fetchBarangays().then(setBarangays); }
      )
      .subscribe();

    const incidentTypesChannel = supabase
      .channel('report-history-incident-types-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incident_types' },
        () => { fetchIncidentTypes().then(setIncidentTypes); }
      )
      .subscribe();

    const erTeamsChannel = supabase
      .channel('report-history-er-teams-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'er_teams' },
        () => { fetchErTeams().then(setErTeams); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(internalReportsChannel);
      supabase.removeChannel(barangaysChannel);
      supabase.removeChannel(incidentTypesChannel);
      supabase.removeChannel(erTeamsChannel);
    };
  }, [fetchInternalReports, fetchBarangays, fetchIncidentTypes, fetchErTeams]);

  const getBarangayNameById = useCallback(
    (id: number | null | undefined) => {
      if (id === null || id === undefined) return "";
      return barangays.find((barangay) => barangay.id === id)?.name ?? "";
    },
    [barangays],
  );

  const getIncidentTypeNameById = useCallback(
    (id: number | null | undefined) => {
      if (id === null || id === undefined) return "";
      return incidentTypes.find((incidentType) => incidentType.id === id)?.name ?? "";
    },
    [incidentTypes],
  );

  const getErTeamNameById = useCallback(
    (id: number | null | undefined) => {
      if (id === null || id === undefined) return "";
      return erTeams.find((erTeam) => erTeam.id === id)?.name ?? "";
    },
    [erTeams],
  );

  const handleViewReport = useCallback(
    async (report: InternalReport) => {
      setViewDialogOpen(true);
      setViewLoading(true);
      setViewError(null);
      setSelectedReportDetail(null);
      setSelectedPatients([]);

      try {
        const [reportRes, patientsRes] = await Promise.all([
          supabase.from("internal_reports").select("*").eq("id", report.id).maybeSingle(),
          supabase
            .from("internal_report_patients")
            .select(`
              *,
              receiving_hospital:hospitals!internal_report_patients_receiving_hospital_id_fkey ( name )
            `)
            .eq("internal_report_id", report.id)
            .order("created_at", { ascending: true }),
        ]);

        if (reportRes.error) throw reportRes.error;
        if (!reportRes.data) throw new Error("Report not found");
        if (patientsRes.error) throw patientsRes.error;

        const patientRows = (patientsRes.data ?? []).map((row: any) => {
          const { receiving_hospital, ...rest } = row;
          return {
            ...rest,
            receiving_hospital_name: receiving_hospital?.name ?? rest.receiving_hospital_name ?? null,
          } as InternalReportPatientRecord;
        });

        const reportDetail = reportRes.data as InternalReportRecord;
        setSelectedReportDetail(reportDetail);
        setSelectedPatients(patientRows);
        setSelectedMeta({
          barangay: getBarangayNameById(reportDetail.barangay_id),
          incidentType: getIncidentTypeNameById(reportDetail.incident_type_id),
          erTeam: getErTeamNameById(reportDetail.er_team_id),
        });
      } catch (err: any) {
        console.error("Failed to load report detail:", err);
        setViewError(err?.message ?? "Failed to load report detail.");
      } finally {
        setViewLoading(false);
      }
    },
    [getBarangayNameById, getIncidentTypeNameById, getErTeamNameById],
  );

  const handleCloseViewDialog = useCallback(() => {
    setViewDialogOpen(false);
    setViewError(null);
    setSelectedReportDetail(null);
    setSelectedPatients([]);
  }, []);

  // Reset page number whenever filters or search term change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedIncidentType, selectedBarangay, selectedErTeam]);

  // Memoized Filtering Logic (Slightly modified to exclude pagination)
  const filteredReports = useMemo(() => {
    return internalReports.filter(report => {
      if (selectedIncidentType !== 'all' && report.incident_type_id !== selectedIncidentType) {
        return false;
      }

      if (selectedBarangay !== 'all' && report.barangay_id !== selectedBarangay) {
        return false;
      }
      if (selectedErTeam !== 'all' && report.er_team_id !== selectedErTeam) {
        return false;
      }

      const term = searchTerm.toLowerCase().trim();
      if (!term) {
        return true;
      }
      
      const preparedByMatch = report.prepared_by.toLowerCase().includes(term);
      const reportIdMatch = String(report.id).includes(term);
      const originalIdMatch = report.original_report_id?.toLowerCase().includes(term) ?? false;
      
      const barangayName = barangays.find(b => b.id === report.barangay_id)?.name.toLowerCase() ?? '';
      const incidentTypeName = incidentTypes.find(it => it.id === report.incident_type_id)?.name.toLowerCase() ?? '';
      const erTeamName = erTeams.find(et => et.id === report.er_team_id)?.name.toLowerCase() ?? '';

      const nameMatch = barangayName.includes(term) || incidentTypeName.includes(term) || erTeamName.includes(term);

      return preparedByMatch || reportIdMatch || originalIdMatch || nameMatch;
    });
  }, [internalReports, selectedIncidentType, selectedBarangay, selectedErTeam, searchTerm, barangays, incidentTypes, erTeams]);
  
  const totalPages = Math.ceil(filteredReports.length / REPORTS_PER_PAGE);
  const startIndex = (currentPage - 1) * REPORTS_PER_PAGE;
  const endIndex = startIndex + REPORTS_PER_PAGE;
  const paginatedReports = filteredReports.slice(startIndex, endIndex);


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 flex items-center justify-center text-gray-600 font-sans">
        Loading report history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 flex items-center justify-center text-red-500 font-sans">
        Error loading report history: {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Admin Report History</h1>
      <ReportHistoryTable
        internalReports={paginatedReports} 
        barangays={barangays}
        incidentTypes={incidentTypes}
        erTeams={erTeams}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedIncidentType={selectedIncidentType}
        setSelectedIncidentType={setSelectedIncidentType}
        selectedBarangay={selectedBarangay}
        setSelectedBarangay={setSelectedBarangay}
        selectedErTeam={selectedErTeam}
        setSelectedErTeam={setSelectedErTeam}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
        totalReports={filteredReports.length}
        onViewReport={handleViewReport}
      />

      <Dialog open={viewDialogOpen} onOpenChange={(open) => { if (!open) handleCloseViewDialog(); }}>
        <DialogContent className="max-w-6xl w-full overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900">Internal Report Detail</DialogTitle>
            <DialogDescription>Review the complete incident report, patient information, and injury mapping.</DialogDescription>
          </DialogHeader>
          {viewLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-gray-600">Loading report…</div>
          ) : viewError ? (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">{viewError}</div>
          ) : selectedReportDetail ? (
            <div className="max-h-[70vh] overflow-y-auto pr-2">
              <InternalReportDetail
                report={selectedReportDetail}
                patients={selectedPatients}
                barangayName={selectedMeta.barangay}
                incidentTypeName={selectedMeta.incidentType}
                erTeamName={selectedMeta.erTeam}
              />
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-gray-500">Select a report to view its details.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}