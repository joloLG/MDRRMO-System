"use client"

import { MakeReportForm } from "@/components/admin/make-report-form";
import { supabase } from "@/lib/supabase";
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from 'next/navigation';
import { useRouter } from "next/navigation";

interface Report {
  id: string;
  created_at: string;
  location_address: string;
  latitude: number;
  longitude: number;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  emergency_type?: string;
  er_team_id?: string;
  casualties?: number;
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

interface Hospital {
  id: string;
  name: string;
}

function MakeReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const incidentId = searchParams.get('incidentId');

  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [erTeams, setErTeams] = useState<ERTeam[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const fetchHospitals = useCallback(async () => {
    const { data, error } = await supabase
      .from('hospitals')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      console.error("Error fetching Hospitals:", error);
      setError(`Failed to load Hospitals: ${error.message}`);
      return [];
    }
    return data as Hospital[] || [];
  }, []);

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

        const hospitalsData = await fetchHospitals();
        setHospitals(hospitalsData);

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
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Make Report Form</h1>
      <div className="grid grid-cols-1 gap-6">
        <div className="flex justify-start mb-4">
          <Button
            variant="outline"
            className="bg-gray-200 hover:bg-gray-300 text-gray-800"
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>

        <MakeReportForm
          selectedReport={selectedReport}
          erTeams={erTeams}
          barangays={barangays}
          incidentTypes={incidentTypes}
          hospitals={hospitals}
          onReportSubmitted={() => {
            console.log("Report submitted.");
          }}
        />
      </div>
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
