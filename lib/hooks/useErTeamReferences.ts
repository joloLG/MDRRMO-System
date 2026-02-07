import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { loadReference, saveReference } from "@/lib/er-team-storage"

export interface ReferenceOption {
  id: string
  name: string
}

interface UseErTeamReferencesResult {
  barangays: ReferenceOption[]
  incidentTypes: ReferenceOption[]
  hospitals: ReferenceOption[]
  referenceError: string | null
  isLoadingReferences: boolean
}

async function migrateLegacyReferences() {
  if (typeof window === "undefined") return
  try {
    const raw = window.localStorage.getItem("mdrrmo_er_team_references")
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return
    if (Array.isArray(parsed.incidentTypes)) {
      await saveReference("incidentTypes", parsed.incidentTypes)
    }
    window.localStorage.removeItem("mdrrmo_er_team_references")
  } catch (error) {
    console.warn("Failed to migrate legacy ER references", error)
  }
}

export function useErTeamReferences(): UseErTeamReferencesResult {
  const [barangays, setBarangays] = useState<ReferenceOption[]>([])
  const [incidentTypes, setIncidentTypes] = useState<ReferenceOption[]>([])
  const [hospitals, setHospitals] = useState<ReferenceOption[]>([])
  const [referenceError, setReferenceError] = useState<string | null>(null)
  const [isLoadingReferences, setIsLoadingReferences] = useState(true)

  const loadReferences = useCallback(async () => {
    const [
      { data: barangayData, error: barangayError },
      { data: incidentTypeData, error: incidentTypeError },
      { data: hospitalData, error: hospitalError }
    ] = await Promise.all([
      supabase.from("barangays").select("id, name").order("name", { ascending: true }),
      supabase.from("incident_types").select("id, name").order("name", { ascending: true }),
      supabase.from("hospitals").select("id, name").order("name", { ascending: true }),
    ])

    if (barangayError || incidentTypeError || hospitalError) {
      throw barangayError ?? incidentTypeError ?? hospitalError ?? new Error("Failed to load reference data")
    }

    const mappedBarangays: ReferenceOption[] = (barangayData ?? []).map((item) => ({ id: String(item.id), name: item.name ?? "" }))
    const mappedIncidentTypes: ReferenceOption[] = (incidentTypeData ?? []).map((item) => ({ id: String(item.id), name: item.name ?? "" }))
    const mappedHospitals: ReferenceOption[] = (hospitalData ?? []).map((item) => ({ id: String(item.id), name: item.name ?? "" }))

    return {
      barangays: mappedBarangays,
      incidentTypes: mappedIncidentTypes,
      hospitals: mappedHospitals,
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const bootstrapReferences = async () => {
      setIsLoadingReferences(true)
      try {
        // Load from cache first for immediate response
        const [barangaysCache, incidentTypesCache, hospitalsCache] = await Promise.all([
          loadReference("barangays"), 
          loadReference("incidentTypes"),
          loadReference("hospitals")
        ])

        if (!cancelled) {
          if (barangaysCache?.items?.length) setBarangays(barangaysCache.items)
          if (incidentTypesCache?.items?.length) setIncidentTypes(incidentTypesCache.items)
          if (hospitalsCache?.items?.length) setHospitals(hospitalsCache.items)
        }

        await migrateLegacyReferences()

        if (!navigator.onLine) {
          setReferenceError((prev) => prev ?? "Using cached reference data while offline.")
          setIsLoadingReferences(false)
          return
        }

        // Fetch fresh data
        const data = await loadReferences()
        if (cancelled) return

        setReferenceError(null)
        setBarangays(data.barangays)
        setIncidentTypes(data.incidentTypes)
        setHospitals(data.hospitals)

        // Save to cache
        await Promise.all([
          saveReference("barangays", data.barangays),
          saveReference("incidentTypes", data.incidentTypes),
          saveReference("hospitals", data.hospitals),
        ])
      } catch (error: any) {
        if (!cancelled) {
          console.error("Failed to load ER team references", error)
          setReferenceError(error?.message ?? "Failed to load reference data. Using cached values if available.")
        }
      } finally {
        if (!cancelled) {
          setIsLoadingReferences(false)
        }
      }
    }

    void bootstrapReferences()

    return () => {
      cancelled = true
    }
  }, [loadReferences])

  return {
    barangays,
    incidentTypes,
    hospitals,
    referenceError,
    isLoadingReferences,
  }
}
