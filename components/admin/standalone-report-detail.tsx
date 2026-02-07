"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Calendar, User, MapPin, Activity, FileText, 
  CheckCircle, XCircle, Eye, Heart, Droplet, 
  Thermometer, Wind, AlertCircle, Clock
} from "lucide-react"
import { format } from "date-fns"
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/priority"
import { cn } from "@/lib/utils"

interface StandaloneReportDetailProps {
  report: {
    id: string
    report_title: string
    report_date: string
    incident_type?: string
    incident_location?: string
    incident_payload?: any
    status: "draft" | "pending_review" | "in_review" | "approved" | "rejected"
    patient_payload: any[]
    injury_payload?: any
    notes?: string
    review_notes?: string
    created_at: string
    updated_at: string
    er_team?: { id: number; name: string }
    submitter?: { id: string; email: string; full_name?: string }
  }
  isOpen: boolean
  onClose: () => void
  onReview?: (action: "approve" | "reject" | "in_review", notes: string) => Promise<void>
  isSubmitting?: boolean
}

const INJURY_TYPE_OPTIONS = [
  { code: "D", label: "Deformities", color: "#ef4444" },
  { code: "C", label: "Contusions", color: "#f97316" },
  { code: "A", label: "Abrasions", color: "#facc15" },
  { code: "P", label: "Penetrations", color: "#8b5cf6" },
  { code: "B", label: "Burns", color: "#fb7185" },
  { code: "T", label: "Tenderness", color: "#22d3ee" },
  { code: "L", label: "Lacerations", color: "#10b981" },
  { code: "S", label: "Swelling", color: "#6366f1" },
]

const REGION_LABELS: Record<string, string> = {
  "front_x3D__x22_right-thigh_x22_": "Front Right Thigh",
  "front_x3D__x22_left-thigh_x22_": "Front Left Thigh",
  "stomach": "Front Abdomen",
  "front_x3D__x22_right-foot": "Front Right Foot",
  "front_x3D__x22_left-foot_x22_": "Front Left Foot",
  "front_x3D__x22_right-chest_x22_": "Front Right Chest",
  "front_x3D__x22_left-chest_x22_": "Front Left Chest",
  "front_x3D__x22_face_x22_": "Face",
  "front_x3D__x22_right-forearm_x22_": "Front Right Forearm",
  "front_x3D__x22_left_x5F_forearm_x22_": "Front Left Forearm",
  "front_x3D__x22_right-ribs_x22_": "Front Right Ribs",
  "front_x3D__x22_left_x5F_ribs_x22_": "Front Left Ribs",
  "front_x3D__x22_belly_x22_": "Front Abdomen",
  "front_x3D__x22_left_x5F_arm_x22_": "Front Left Arm",
  "front_x3D__x22_right-arm_x22_": "Front Right Arm",
  "front_x3D__x22_neck_x22_": "Neck",
  "front_x3D__x22_right-shoulder_x22_": "Front Right Shoulder",
  "front_x3D__x22_left-shoulder_x22_": "Front Left Shoulder",
  "front_x3D__x22_right-knee_x22_": "Front Right Knee",
  "front_x3D__x22_left-knee_x22_": "Front Left Knee",
  "front_x3D__x22_upper-head_x22_": "Head",
  "front_x3D__x22_right-hand_x22_": "Front Right Hand",
  "front_x3D__x22_left-hand_x22_": "Front Left Hand",
  "front_x3D__x22_right-calf_x22_": "Front Right Calf",
  "front_x3D__x22_left-calf_x22_": "Front Left Calf",
  "front_x3D__x22_chest_x22_": "Chest",
  "front_x3D__x22_right-hip_x22_": "Front Right Hip",
  "front_x3D__x22_left-hip_x22_": "Front Left Hip",
  "front_x3D__x22_right-ankle_x22_": "Front Right Ankle",
  "front_x3D__x22_left-ankle_x22_": "Front Left Ankle",
  "back_x3D__x22_right-thigh_x22_": "Back Right Thigh",
  "back_x3D__x22_left-thigh_x22_": "Back Left Thigh",
  "back_x3D__x22_right-foot_x22_": "Back Right Foot",
  "back_x3D__x22_left-foot_x22_": "Back Left Foot",
  "back_x3D__x22_right-shoulder_x22_": "Back Right Shoulder",
  "back_x3D__x22_left-shoulder_x22_": "Back Left Shoulder",
  "back_x3D__x22_lower-back_x22_": "Lower Back",
  "back_x3D__x22_upper-back_x22_": "Upper Back",
  "back_x3D__x22_back_x22_": "Back Center",
  "back_x3D__x22_neck_x22_": "Back Neck",
}

const normalizeRegionLabel = (region: string) => {
  if (!region) return "Unnamed region"
  const mapped = REGION_LABELS[region]
  if (mapped) return mapped

  const cleaned = region
    .replace(/^front_x3D__x22_/, "")
    .replace(/^back_x3D__x22_/, "")
    .replace(/_x22_/g, "")
    .replace(/_x5F_/g, "_")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!cleaned) return region

  return cleaned
    .split(" ")
    .map((segment) => (segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : segment))
    .join(" ")
}

const STATUS_CONFIG = {
  draft: { label: "Draft", icon: FileText, className: "bg-gray-200 text-gray-800" },
  pending_review: { label: "Pending Review", icon: Clock, className: "bg-amber-200 text-amber-800" },
  in_review: { label: "In Review", icon: Eye, className: "bg-blue-200 text-blue-800" },
  approved: { label: "Approved", icon: CheckCircle, className: "bg-emerald-200 text-emerald-900" },
  rejected: { label: "Rejected", icon: XCircle, className: "bg-red-200 text-red-800" },
}

export function StandaloneReportDetail({
  report,
  isOpen,
  onClose,
  onReview,
  isSubmitting = false,
}: StandaloneReportDetailProps) {
  const [reviewNotes, setReviewNotes] = React.useState(report.review_notes || "")
  const [activePatientIndex, setActivePatientIndex] = React.useState(0)

  const statusConfig = STATUS_CONFIG[report.status]
  const StatusIcon = statusConfig.icon
  const patients = Array.isArray(report.patient_payload) ? report.patient_payload : []
  const activePatient = patients[activePatientIndex] || {}
  const incidentPayload = report.incident_payload || {}

  const handleReviewAction = async (action: "approve" | "reject" | "in_review") => {
    if (onReview) {
      await onReview(action, reviewNotes)
    }
  }

  const renderInjurySummary = (injuryMap: any, view: "front" | "back") => {
    if (!injuryMap || typeof injuryMap !== "object") return null
    const regions = injuryMap[view] || {}
    const entries = Object.entries(regions).filter(([, injuries]) => injuries && (injuries as any[]).length > 0)

    if (entries.length === 0) {
      return <p className="text-xs text-gray-500">No injuries on {view} view</p>
    }

    return (
      <div className="space-y-2">
        {entries.map(([region, injuries]) => (
          <div key={`${view}-${region}`} className="rounded-lg bg-gray-50 p-2">
            <p className="text-xs font-semibold text-gray-700 mb-1">{normalizeRegionLabel(region)}</p>
            <div className="flex flex-wrap gap-1">
              {(injuries as string[]).map((code) => {
                const injuryType = INJURY_TYPE_OPTIONS.find((opt) => opt.code === code)
                return (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-gray-600 border"
                  >
                    <span
                      className="inline-flex h-2 w-2 rounded-full"
                      style={{ backgroundColor: injuryType?.color || "#cbd5e1" }}
                    />
                    {injuryType?.label || code}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900">
                {report.report_title}
              </DialogTitle>
              <p className="text-sm text-gray-600 mt-1">Standalone ER Team PCR Report</p>
            </div>
            <Badge className={statusConfig.className}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {statusConfig.label}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="patients">Patients</TabsTrigger>
            <TabsTrigger value="injuries">Injuries</TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-600" />
                  Report Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Report Date:</span>{" "}
                  <span className="text-gray-600">
                    {format(new Date(report.report_date), "MMM dd, yyyy")}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Created:</span>{" "}
                  <span className="text-gray-600">
                    {format(new Date(report.created_at), "MMM dd, yyyy HH:mm")}
                  </span>
                </div>
                {report.er_team?.name && (
                  <div>
                    <span className="font-medium text-gray-700">ER Team:</span>{" "}
                    <span className="text-gray-600">{report.er_team.name}</span>
                  </div>
                )}
                {report.submitter && (
                  <div>
                    <span className="font-medium text-gray-700">Submitted By:</span>{" "}
                    <span className="text-gray-600">
                      {report.submitter.full_name || report.submitter.email}
                    </span>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="font-medium text-gray-700">Patients Count:</span>{" "}
                  <span className="text-gray-600">{patients.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-orange-600" />
                  Incident Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {report.incident_type && (
                  <div>
                    <span className="font-medium text-gray-700">Incident Type:</span>{" "}
                    <Badge variant="outline">{report.incident_type}</Badge>
                  </div>
                )}
                {report.incident_location && (
                  <div>
                    <span className="font-medium text-gray-700">Location:</span>{" "}
                    <span className="text-gray-600">{report.incident_location}</span>
                  </div>
                )}
                {incidentPayload.moiPoiToi && (
                  <div>
                    <span className="font-medium text-gray-700 block mb-1">MOI / POI / TOI:</span>
                    <p className="text-gray-600 bg-gray-50 rounded p-2">{incidentPayload.moiPoiToi}</p>
                  </div>
                )}
                {incidentPayload.noi && (
                  <div>
                    <span className="font-medium text-gray-700 block mb-1">Nature of Injury:</span>
                    <p className="text-gray-600 bg-gray-50 rounded p-2">{incidentPayload.noi}</p>
                  </div>
                )}
                {incidentPayload.signsSymptoms && (
                  <div>
                    <span className="font-medium text-gray-700 block mb-1">Signs & Symptoms:</span>
                    <p className="text-gray-600 bg-gray-50 rounded p-2">{incidentPayload.signsSymptoms}</p>
                  </div>
                )}
                {report.notes && (
                  <div>
                    <span className="font-medium text-gray-700 block mb-1">ER Team Notes:</span>
                    <p className="text-gray-600 bg-gray-50 rounded p-2">{report.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patients" className="space-y-4 mt-4">
            {patients.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {patients.map((_, index) => (
                  <Button
                    key={index}
                    variant={activePatientIndex === index ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActivePatientIndex(index)}
                    className={activePatientIndex === index ? "bg-orange-600" : ""}
                  >
                    Patient {index + 1}
                  </Button>
                ))}
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-orange-600" />
                  Patient Information {patients.length > 1 ? `- Patient ${activePatientIndex + 1}` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                {activePatient.patientName && (
                  <div>
                    <span className="font-medium text-gray-700">Name:</span>{" "}
                    <span className="text-gray-600">{activePatient.patientName}</span>
                  </div>
                )}
                {activePatient.patientAge && (
                  <div>
                    <span className="font-medium text-gray-700">Age:</span>{" "}
                    <span className="text-gray-600">{activePatient.patientAge}</span>
                  </div>
                )}
                {activePatient.patientSex && (
                  <div>
                    <span className="font-medium text-gray-700">Sex:</span>{" "}
                    <span className="text-gray-600 capitalize">{activePatient.patientSex}</span>
                  </div>
                )}
                {activePatient.patientNumber && (
                  <div>
                    <span className="font-medium text-gray-700">Contact:</span>{" "}
                    <span className="text-gray-600">{activePatient.patientNumber}</span>
                  </div>
                )}
                {activePatient.patientAddress && (
                  <div className="col-span-2">
                    <span className="font-medium text-gray-700">Address:</span>{" "}
                    <span className="text-gray-600">{activePatient.patientAddress}</span>
                  </div>
                )}
                {activePatient.evacPriority && (
                  <div className="col-span-2">
                    <span className="font-medium text-gray-700 block mb-2">Evacuation Priority:</span>
                    {PRIORITY_LABELS.find((p) => p.value === activePatient.evacPriority) && (
                      <Badge
                        className={cn(
                          "text-white",
                          activePatient.evacPriority === "4"
                            ? "bg-black"
                            : PRIORITY_COLORS[activePatient.evacPriority as "1" | "2" | "3" | "4"]
                        )}
                      >
                        {PRIORITY_LABELS.find((p) => p.value === activePatient.evacPriority)?.label}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-orange-600" />
                  Assessment & Vital Signs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {activePatient.typeOfEmergencySelections && activePatient.typeOfEmergencySelections.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700 block mb-2">Emergency Categories:</span>
                    <div className="flex flex-wrap gap-2">
                      {activePatient.typeOfEmergencySelections.map((cat: string) => (
                        <Badge key={cat} variant="secondary">{cat}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {activePatient.pulseRate && (
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-500" />
                      <div>
                        <span className="font-medium text-gray-700">Pulse Rate:</span>{" "}
                        <span className="text-gray-600">{activePatient.pulseRate} bpm</span>
                      </div>
                    </div>
                  )}
                  {activePatient.bloodPressure && (
                    <div className="flex items-center gap-2">
                      <Droplet className="h-4 w-4 text-blue-500" />
                      <div>
                        <span className="font-medium text-gray-700">Blood Pressure:</span>{" "}
                        <span className="text-gray-600">{activePatient.bloodPressure}</span>
                      </div>
                    </div>
                  )}
                  {activePatient.temperature && (
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4 text-orange-500" />
                      <div>
                        <span className="font-medium text-gray-700">Temperature:</span>{" "}
                        <span className="text-gray-600">{activePatient.temperature}°C</span>
                      </div>
                    </div>
                  )}
                  {activePatient.respiratoryRate && (
                    <div className="flex items-center gap-2">
                      <Wind className="h-4 w-4 text-cyan-500" />
                      <div>
                        <span className="font-medium text-gray-700">Respiratory Rate:</span>{" "}
                        <span className="text-gray-600">{activePatient.respiratoryRate}</span>
                      </div>
                    </div>
                  )}
                  {activePatient.oxygenSaturation && (
                    <div>
                      <span className="font-medium text-gray-700">O2 Saturation:</span>{" "}
                      <span className="text-gray-600">{activePatient.oxygenSaturation}%</span>
                    </div>
                  )}
                  {activePatient.painScale && (
                    <div>
                      <span className="font-medium text-gray-700">Pain Scale:</span>{" "}
                      <span className="text-gray-600">{activePatient.painScale}/10</span>
                    </div>
                  )}
                </div>

                {activePatient.gcsEye || activePatient.gcsVerbal || activePatient.gcsMotor ? (
                  <div>
                    <span className="font-medium text-gray-700 block mb-2">Glasgow Coma Scale:</span>
                    <div className="grid grid-cols-3 gap-2">
                      {activePatient.gcsEye && (
                        <div className="bg-gray-50 rounded p-2">
                          <span className="text-xs text-gray-600">Eye:</span>{" "}
                          <span className="font-medium">{activePatient.gcsEye}</span>
                        </div>
                      )}
                      {activePatient.gcsVerbal && (
                        <div className="bg-gray-50 rounded p-2">
                          <span className="text-xs text-gray-600">Verbal:</span>{" "}
                          <span className="font-medium">{activePatient.gcsVerbal}</span>
                        </div>
                      )}
                      {activePatient.gcsMotor && (
                        <div className="bg-gray-50 rounded p-2">
                          <span className="text-xs text-gray-600">Motor:</span>{" "}
                          <span className="font-medium">{activePatient.gcsMotor}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {activePatient.airwaySelections && activePatient.airwaySelections.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700 block mb-1">Airway:</span>
                    <div className="flex flex-wrap gap-1">
                      {activePatient.airwaySelections.map((sel: string) => (
                        <Badge key={sel} variant="outline" className="text-xs">{sel}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {activePatient.breathingSelections && activePatient.breathingSelections.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700 block mb-1">Breathing:</span>
                    <div className="flex flex-wrap gap-1">
                      {activePatient.breathingSelections.map((sel: string) => (
                        <Badge key={sel} variant="outline" className="text-xs">{sel}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {activePatient.circulationSelections && activePatient.circulationSelections.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700 block mb-1">Circulation:</span>
                    <div className="flex flex-wrap gap-1">
                      {activePatient.circulationSelections.map((sel: string) => (
                        <Badge key={sel} variant="outline" className="text-xs">{sel}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-orange-600" />
                  Hospital & Transfer
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                {activePatient.receivingHospitalId && (
                  <div>
                    <span className="font-medium text-gray-700">Receiving Hospital:</span>{" "}
                    <span className="text-gray-600">{activePatient.receivingHospitalId}</span>
                  </div>
                )}
                {activePatient.receivingDate && (
                  <div>
                    <span className="font-medium text-gray-700">Receiving Date:</span>{" "}
                    <span className="text-gray-600">{activePatient.receivingDate}</span>
                  </div>
                )}
                {activePatient.turnoverInCharge && (
                  <div>
                    <span className="font-medium text-gray-700">Turnover In-Charge:</span>{" "}
                    <span className="text-gray-600">{activePatient.turnoverInCharge}</span>
                  </div>
                )}
                {activePatient.bloodLossLevel && (
                  <div>
                    <span className="font-medium text-gray-700">Blood Loss:</span>{" "}
                    <Badge variant="outline">{activePatient.bloodLossLevel}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="injuries" className="space-y-4 mt-4">
            {patients.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {patients.map((_, index) => (
                  <Button
                    key={index}
                    variant={activePatientIndex === index ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActivePatientIndex(index)}
                    className={activePatientIndex === index ? "bg-orange-600" : ""}
                  >
                    Patient {index + 1}
                  </Button>
                ))}
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  Injury Documentation {patients.length > 1 ? `- Patient ${activePatientIndex + 1}` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Front View</h4>
                  {renderInjurySummary(activePatient.injuryPayload || report.injury_payload, "front")}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Back View</h4>
                  {renderInjurySummary(activePatient.injuryPayload || report.injury_payload, "back")}
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-gray-800 mb-3">Injury Legend</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {INJURY_TYPE_OPTIONS.map((option) => (
                      <div key={option.code} className="flex items-center gap-2">
                        <span
                          className="inline-flex h-3 w-3 rounded-full"
                          style={{ backgroundColor: option.color }}
                        />
                        <span className="text-sm text-gray-700">{option.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="review" className="space-y-4 mt-4">
            {report.review_notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Previous Review Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded p-3">{report.review_notes}</p>
                </CardContent>
              </Card>
            )}

            {onReview && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add Review Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="review-notes">Review Notes (Optional)</Label>
                    <Textarea
                      id="review-notes"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add feedback or notes for the ER Team..."
                      rows={4}
                      className="mt-2"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t">
                    <Button
                      onClick={() => handleReviewAction("in_review")}
                      variant="outline"
                      disabled={isSubmitting}
                      className="flex-1"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Mark In Review
                    </Button>
                    <Button
                      onClick={() => handleReviewAction("approve")}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      disabled={isSubmitting}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleReviewAction("reject")}
                      variant="destructive"
                      disabled={isSubmitting}
                      className="flex-1"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
