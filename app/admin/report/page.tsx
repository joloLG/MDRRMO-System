"use client"

import { MakeReportForm } from "@/components/admin/make-report-form";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from 'next/navigation'; // For reading query parameters

// Interfaces for data types (needs to be consistent with admin-dashboard.tsx)
interface Report {
  id: string;
  created_at: string;
  location_address: string;
  latitude: number;
  longitude: number;
  firstName: string;
  lastName: string;
  mobileNumber: string;
}

interface Barangay {
  id: number;
  name: string;
}

interface ERTeam {
  id: number;
  name: string;
}

interface IncidentType {
  id: number;
  name: string;
}

function MakeReportContent() {
  const searchParams = useSearchParams();
  const incidentId = searchParams.get('incidentId'); // Get incidentId from URL query param

  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [erTeams, setErTeams] = useState<ERTeam[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    return data as ERTeam[] || [];
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
    return data as Barangay[] || [];
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
    return data as IncidentType[] || [];
  }, []);

  // Fetch all necessary data for the form
  useEffect(() => {
    const loadFormData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [erTeamsData, barangaysData, incidentTypesData] = await Promise.all([
          fetchErTeams(),
          fetchBarangays(),
          fetchIncidentTypes(),
        ]);
        setErTeams(erTeamsData);
        setBarangays(barangaysData);
        setIncidentTypes(incidentTypesData);

        if (incidentId) {
          const { data: reportData, error: reportError } = await supabase
            .from('emergency_reports')
            .select('*')
            .eq('id', incidentId)
            .single();

          if (reportError) throw reportError;
          setSelectedReport(reportData as Report);
        }
      } catch (err: any) {
        console.error("Error loading form data:", err);
        setError(`Failed to load form data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadFormData();

    // Setup real-time listeners for reference data
    const erTeamsChannel = supabase.channel('report-er-teams-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'er_teams' }, () => { fetchErTeams().then(setErTeams); })
      .subscribe();
    const barangaysChannel = supabase.channel('report-barangays-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barangays' }, () => { fetchBarangays().then(setBarangays); })
      .subscribe();
    const incidentTypesChannel = supabase.channel('report-incident-types-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incident_types' }, () => { fetchIncidentTypes().then(setIncidentTypes); })
      .subscribe();

    return () => {
      supabase.removeChannel(erTeamsChannel);
      supabase.removeChannel(barangaysChannel);
      supabase.removeChannel(incidentTypesChannel);
    };
  }, [incidentId, fetchErTeams, fetchBarangays, fetchIncidentTypes]);


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 flex items-center justify-center text-gray-600 font-sans">
        Loading form data...
      </div>
    );
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen text-red-500 font-sans">Error: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <MakeReportForm
        selectedReport={selectedReport}
        erTeams={erTeams}
        barangays={barangays}
        incidentTypes={incidentTypes}
        onReportSubmitted={() => {
          // You can redirect the user or show a success message here
          console.log("Report submitted, returning to dashboard or showing success.");
          // Example: window.close() if you want to close the tab after submission
          // Or redirect to the main admin dashboard: window.location.href = '/admin';
        }}
      />
    </div>
  );
}

export default function MakeReportPage() {
  return (
    <Suspense fallback={<div>Loading report form...</div>}>
      <MakeReportContent />
    </Suspense>
  );
}