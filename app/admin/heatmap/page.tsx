import { IncidentHeatMap } from "@/components/admin/IncidentHeatMap"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

interface BaseEntry {
  id: number
  name: string
}

export default async function AdminHeatMapPage() {
  let error: string | null = null
  let barangays: BaseEntry[] = []
  let incidentTypes: BaseEntry[] = []
  let erTeams: BaseEntry[] = []

  try {
    const [bRes, tRes, eRes] = await Promise.all([
      supabaseAdmin.from('barangays').select('id, name').order('name', { ascending: true }),
      supabaseAdmin.from('incident_types').select('id, name').order('name', { ascending: true }),
      supabaseAdmin.from('er_teams').select('id, name').order('name', { ascending: true }),
    ])

    if (bRes.error) {
      console.error('[admin/heatmap] barangays error', bRes.error)
      error = 'Failed to load barangays'
    } else {
      barangays = (bRes.data as BaseEntry[]) ?? []
    }

    if (tRes.error) {
      console.error('[admin/heatmap] incident types error', tRes.error)
      error = error ?? 'Failed to load incident types'
    } else {
      incidentTypes = (tRes.data as BaseEntry[]) ?? []
    }

    if (eRes.error) {
      console.error('[admin/heatmap] er teams error', eRes.error)
      error = error ?? 'Failed to load ER teams'
    } else {
      erTeams = (eRes.data as BaseEntry[]) ?? []
    }
  } catch (e: any) {
    console.error('[admin/heatmap] unexpected error', e)
    error = e?.message || 'Failed to load reference data'
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Incident Heat Map</h1>
      {error && (
        <Card className="max-w-xl">
          <CardContent className="p-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
      <IncidentHeatMap barangays={barangays} incidentTypes={incidentTypes} erTeams={erTeams} />
    </div>
  )
}
