"use client"

import { ReportHistoryTable } from "@/components/admin/report-history-table";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useCallback, useMemo } from "react";

// Define InternalReport interface
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

// Define BaseEntry for reference tables
interface BaseEntry {
  id: number;
  name: string;
}

// --- CONSTANT FOR REPORTS PER PAGE ---
const REPORTS_PER_PAGE = 10;
// -------------------------------------

export default function ReportHistoryPage() {
  const [internalReports, setInternalReports] = useState<InternalReport[]>([]);
  const [barangays, setBarangays] = useState<BaseEntry[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<BaseEntry[]>([]);
  const [erTeams, setErTeams] = useState<BaseEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching internal reports:", error);
      setError(`Failed to load internal reports: ${error.message || 'Unknown error'}. Please check your Supabase RLS policies.`);
      return [];
    }
    return data || [];
  }, []);

  // ... (fetchBarangays, fetchIncidentTypes, fetchErTeams remain the same)
  // Function to fetch Barangays
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
  
  // Reset page number whenever filters or search term change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedIncidentType, selectedBarangay, selectedErTeam]);


  // Memoized Filtering Logic (Slightly modified to exclude pagination)
  const filteredReports = useMemo(() => {
    return internalReports.filter(report => {
      // 1. Incident Type Filter
      if (selectedIncidentType !== 'all' && report.incident_type_id !== selectedIncidentType) {
        return false;
      }

      // 2. Barangay Filter
      if (selectedBarangay !== 'all' && report.barangay_id !== selectedBarangay) {
        return false;
      }

      // 3. ER Team Filter
      if (selectedErTeam !== 'all' && report.er_team_id !== selectedErTeam) {
        return false;
      }

      // 4. Search Term Filter (Checks report ID and Prepared By)
      const term = searchTerm.toLowerCase().trim();
      if (!term) {
        return true; // No search term
      }
      
      const preparedByMatch = report.prepared_by.toLowerCase().includes(term);
      const reportIdMatch = String(report.id).includes(term);
      const originalIdMatch = report.original_report_id?.toLowerCase().includes(term) ?? false;
      
      // Look up names for a more comprehensive search
      const barangayName = barangays.find(b => b.id === report.barangay_id)?.name.toLowerCase() ?? '';
      const incidentTypeName = incidentTypes.find(it => it.id === report.incident_type_id)?.name.toLowerCase() ?? '';
      const erTeamName = erTeams.find(et => et.id === report.er_team_id)?.name.toLowerCase() ?? '';

      const nameMatch = barangayName.includes(term) || incidentTypeName.includes(term) || erTeamName.includes(term);

      return preparedByMatch || reportIdMatch || originalIdMatch || nameMatch;
    });
  }, [internalReports, selectedIncidentType, selectedBarangay, selectedErTeam, searchTerm, barangays, incidentTypes, erTeams]);
  
  // --- New Pagination Logic ---
  const totalPages = Math.ceil(filteredReports.length / REPORTS_PER_PAGE);
  const startIndex = (currentPage - 1) * REPORTS_PER_PAGE;
  const endIndex = startIndex + REPORTS_PER_PAGE;
  const paginatedReports = filteredReports.slice(startIndex, endIndex);
  // ----------------------------


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
        // Pass the paginated reports
        internalReports={paginatedReports} 
        barangays={barangays}
        incidentTypes={incidentTypes}
        erTeams={erTeams}
        // Props for Search and Filters (No Change)
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedIncidentType={selectedIncidentType}
        setSelectedIncidentType={setSelectedIncidentType}
        selectedBarangay={selectedBarangay}
        setSelectedBarangay={setSelectedBarangay}
        selectedErTeam={selectedErTeam}
        setSelectedErTeam={setSelectedErTeam}
        // --- New Props for Pagination ---
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
        totalReports={filteredReports.length}
        // --------------------------------
      />
    </div>
  );
}