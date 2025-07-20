"use client"

import { ReportHistoryTable } from "@/components/admin/report-history-table";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useCallback } from "react";

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

export default function ReportHistoryPage() {
  const [internalReports, setInternalReports] = useState<InternalReport[]>([]);
  const [barangays, setBarangays] = useState<BaseEntry[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<BaseEntry[]>([]);
  const [erTeams, setErTeams] = useState<BaseEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to fetch Internal Reports
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

    // Set up real-time channels for all relevant tables
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
        internalReports={internalReports}
        barangays={barangays}
        incidentTypes={incidentTypes}
        erTeams={erTeams}
      />
    </div>
  );
}