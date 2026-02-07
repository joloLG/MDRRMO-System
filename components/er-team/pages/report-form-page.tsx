"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ClipboardList, Plus, Info } from "lucide-react"
import { useErTeam } from "./er-team-context"

export function ReportFormPage() {
  const { drafts, selectedIncidentId, setSelectedIncidentId, handleOpenDraft } = useErTeam()

  const primaryDraft = React.useMemo(() => {
    if (selectedIncidentId) {
      return drafts.find((draft) => draft.emergencyReportId === selectedIncidentId) ?? null
    }
    return drafts[0] ?? null
  }, [drafts, selectedIncidentId])

  const handleCreateNewReport = () => {
    if (!primaryDraft) return
    if (primaryDraft.emergencyReportId) {
      setSelectedIncidentId(primaryDraft.emergencyReportId)
    }
    handleOpenDraft(primaryDraft.clientDraftId)
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 bg-gradient-to-br from-white via-white to-blue-50/30 shadow-xl rounded-2xl">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-lg">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-gray-900">New Report Form</CardTitle>
              <CardDescription className="text-sm text-gray-600">
                Open a PCR draft linked to your assigned incidents
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-100/50">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-sm text-blue-800">
                  Access your latest assigned PCR draft. You can continue editing
                  offline and it will sync automatically once you are back online.
                </p>
                <p className="text-xs text-blue-600">
                  Drafts are created when incidents are dispatched to your ER team.
                </p>
              </div>
            </div>
          </div>

          <Button 
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white py-6 text-lg font-semibold"
            onClick={handleCreateNewReport}
            disabled={!primaryDraft}
          >
            <Plus className="w-5 h-5 mr-2" />
            {primaryDraft ? "Open Assigned Report" : "No Drafts Available"}
          </Button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <h4 className="font-semibold text-gray-900 mb-2">What you can report:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Medical emergencies</li>
                <li>• Accident incidents</li>
                <li>• Rescue operations</li>
                <li>• Patient transfers</li>
              </ul>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <h4 className="font-semibold text-gray-900 mb-2">Report includes:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Patient information</li>
                <li>• Incident details</li>
                <li>• Injury documentation</li>
                <li>• Hospital transfer info</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Standalone Reports (placeholder) */}
      <Card className="border-0 bg-white shadow-lg rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-900">Recent Reports</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Your recently submitted standalone reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">Standalone reports are not available yet.</p>
            <p className="text-xs mt-1">Use your assigned incident drafts for now.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
