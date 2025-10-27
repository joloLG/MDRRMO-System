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
  const [hasCachedData, setHasCachedData] = useState(false);

  const cacheKey = useCallback((suffix: string) => `mdrrmo_form_${suffix}`, []);

  const readCache = useCallback((key: string) => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  const writeCache = useCallback((key: string, value: unknown) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, []);

  const fetchErTeams = useCallback(async () => {
    const { data, error } = await supabase
      .from('er_teams')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      console.error("Error fetching ER Teams:", error);
      throw error;
    }
    return (data as ERTeam[] | null) ?? [];
  }, []);

  const fetchBarangays = useCallback(async () => {
    const { data, error } = await supabase
      .from('barangays')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      console.error("Error fetching Barangays:", error);
      throw error;
    }
    return (data as Barangay[] | null) ?? [];
  }, []);

  const fetchIncidentTypes = useCallback(async () => {
    const { data, error } = await supabase
      .from('incident_types')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      console.error("Error fetching Incident Types:", error);
      throw error;
    }
    return (data as IncidentType[] | null) ?? [];
  }, []);

  const fetchHospitals = useCallback(async () => {
    const { data, error } = await supabase
      .from('hospitals')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      console.error("Error fetching Hospitals:", error);
      throw error;
    }
    return (data as Hospital[] | null) ?? [];
  }, []);

  useEffect(() => {
    const loadFormData = async () => {
      const cachedAvailable = hasCachedData;
      setError(null);
      if (!cachedAvailable) {
        setLoading(true);
      }
      try {
        const [erTeamsData, barangaysData, incidentTypesData] = await Promise.all([
          fetchErTeams(),
          fetchBarangays(),
          fetchIncidentTypes(),
        ]);
        setErTeams(erTeamsData);
        setBarangays(barangaysData);
        setIncidentTypes(incidentTypesData);
        writeCache(cacheKey('er_teams'), erTeamsData);
        writeCache(cacheKey('barangays'), barangaysData);
        writeCache(cacheKey('incident_types'), incidentTypesData);

        const hospitalsData = await fetchHospitals();
        setHospitals(hospitalsData);
        writeCache(cacheKey('hospitals'), hospitalsData);

        if (incidentId) {
          const { data: reportData, error: reportError } = await supabase
            .from('emergency_reports')
            .select('*')
            .eq('id', incidentId)
            .single();

          if (reportError) throw reportError;
          setSelectedReport(reportData as Report);
        }
        setHasCachedData(true);
      } catch (err: any) {
        console.error("Error loading form data:", err);
        if (!hasCachedData) {
          setError(`Failed to load form data: ${err.message}`);
        }
      } finally {
        setLoading(false);
      }
    };

    let cancelled = false;
    const applyCache = () => {
      if (typeof window === "undefined" || cancelled) return false;
      let found = false;
      const cachedErTeams = readCache(cacheKey('er_teams'));
      if (!cancelled && Array.isArray(cachedErTeams) && cachedErTeams.length) {
        setErTeams(cachedErTeams as ERTeam[]);
        found = true;
      }
      const cachedBarangays = readCache(cacheKey('barangays'));
      if (!cancelled && Array.isArray(cachedBarangays) && cachedBarangays.length) {
        setBarangays(cachedBarangays as Barangay[]);
        found = true;
      }
      const cachedIncidentTypes = readCache(cacheKey('incident_types'));
      if (!cancelled && Array.isArray(cachedIncidentTypes) && cachedIncidentTypes.length) {
        setIncidentTypes(cachedIncidentTypes as IncidentType[]);
        found = true;
      }
      const cachedHospitals = readCache(cacheKey('hospitals'));
      if (!cancelled && Array.isArray(cachedHospitals) && cachedHospitals.length) {
        setHospitals(cachedHospitals as Hospital[]);
        found = true;
      }
      if (!cancelled && found) {
        setHasCachedData(true);
        setLoading(false);
      }
      return found;
    };

    const cached = applyCache();
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
      cancelled = true;
      supabase.removeChannel(erTeamsChannel);
      supabase.removeChannel(barangaysChannel);
      supabase.removeChannel(incidentTypesChannel);
    };
  }, [incidentId, fetchErTeams, fetchBarangays, fetchIncidentTypes, fetchHospitals, cacheKey, readCache, writeCache, hasCachedData]);


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
