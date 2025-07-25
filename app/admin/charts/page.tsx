"use client"

import { ChartsDashboard } from "@/components/admin/charts-dashboard";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useCallback } from "react";

// Define Report interface (needs to be consistent with admin-dashboard.tsx)
interface Report {
  id: string;
  emergency_type: string;
  status: string;
  created_at: string;
  // Add other properties if needed by ChartsDashboard
}

// Define InternalReport interface
interface InternalReport {
  id: number;
  original_report_id: string | null;
  incident_type_id: number;
  incident_date: string;
  barangay_id: number;
  er_team_id: number;
  persons_involved: number | null;
  number_of_responders: number | null;
  prepared_by: string;
  created_at: string;
}

// Define BaseEntry for reference tables
interface BaseEntry {
  id: number;
  name: string;
}

export default function ChartsPage() {
  const [allEmergencyReports, setAllEmergencyReports] = useState<Report[]>([]);
  const [allInternalReports, setAllInternalReports] = useState<InternalReport[]>([]);
  const [barangays, setBarangays] = useState<BaseEntry[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<BaseEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to fetch all emergency reports (for status charts)
  const fetchAllEmergencyReports = useCallback(async () => {
    const { data, error } = await supabase
      .from('emergency_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching emergency reports:", error);
      setError(`Failed to load emergency reports: ${error.message || 'Unknown error'}. Please check your Supabase RLS policies.`);
      return [];
    }
    return data || [];
  }, []);

  // Function to fetch all internal reports (for incident type and barangay charts)
  const fetchAllInternalReports = useCallback(async () => {
    const { data, error } = await supabase
      .from('internal_reports')
      .select('*')
      .order('incident_date', { ascending: false });

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

  useEffect(() => {
    const loadAllChartData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [
          emergencyReportsData,
          internalReportsData,
          barangaysData,
          incidentTypesData
        ] = await Promise.all([
          fetchAllEmergencyReports(),
          fetchAllInternalReports(),
          fetchBarangays(),
          fetchIncidentTypes()
        ]);

        setAllEmergencyReports(emergencyReportsData);
        setAllInternalReports(internalReportsData);
        setBarangays(barangaysData);
        setIncidentTypes(incidentTypesData);

      } catch (err: any) {
        console.error("Error loading chart data:", err);
        setError(`Failed to load chart data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadAllChartData();

    // Set up real-time channels for all relevant tables
    const emergencyReportsChannel = supabase
      .channel('charts-emergency-reports-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'emergency_reports' },
        () => { fetchAllEmergencyReports().then(setAllEmergencyReports); }
      )
      .subscribe();

    const internalReportsChannel = supabase
      .channel('charts-internal-reports-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_reports' },
        () => { fetchAllInternalReports().then(setAllInternalReports); }
      )
      .subscribe();

    const barangaysChannel = supabase
      .channel('charts-barangays-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'barangays' },
        () => { fetchBarangays().then(setBarangays); }
      )
      .subscribe();

    const incidentTypesChannel = supabase
      .channel('charts-incident-types-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incident_types' },
        () => { fetchIncidentTypes().then(setIncidentTypes); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(emergencyReportsChannel);
      supabase.removeChannel(internalReportsChannel);
      supabase.removeChannel(barangaysChannel);
      supabase.removeChannel(incidentTypesChannel);
    };
  }, [fetchAllEmergencyReports, fetchAllInternalReports, fetchBarangays, fetchIncidentTypes]);


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 flex items-center justify-center text-gray-600 font-sans">
        Loading chart data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 flex items-center justify-center text-red-500 font-sans">
        Error loading charts: {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Analytics & Charts</h1>
      <ChartsDashboard
        allEmergencyReports={allEmergencyReports}
        allInternalReports={allInternalReports}
        barangays={barangays}
        incidentTypes={incidentTypes}
      />
    </div>
  );
}