"use client"

import * as React from "react"

import { differenceInYears, format, isValid, parseISO } from "date-fns"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Pill, User, Activity, AlertCircle, Droplet, CalendarDays, XCircle } from "lucide-react"
import { FRONT_BODY_REGION_IDS, BACK_BODY_REGION_IDS } from "@/components/admin/make-report-form"
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/priority"
import { cn } from "@/lib/utils"

const FRONT_SVG_PATH = "/body_part_front-01.svg"
const BACK_SVG_PATH = "/body_part_back-01.svg"

export type ErTeamDraftStatus = "draft" | "pending_review" | "in_review" | "approved" | "rejected"

type InjuryView = "front" | "back"

export interface InjuryMap {
  front: Record<string, string[]>
  back: Record<string, string[]>
}

export interface ErTeamDraft {
  clientDraftId: string
  emergencyReportId: string
  status: ErTeamDraftStatus
  updatedAt: string
  synced: boolean
  lastSyncError?: string | null
  submittedAt?: string | null
  patientPayload: Record<string, any>
  incidentPayload?: Record<string, any>
  injuryPayload?: InjuryMap
  notes?: string | null
  internalReportId?: number | null
}

export interface ReferenceOption {
  id: string
  name: string
}

export interface ErTeamReportFormProps {
  draft: ErTeamDraft
  hospitals: ReferenceOption[]
  onDraftChange: (next: ErTeamDraft) => void
  onSubmitForReview: (draft: ErTeamDraft) => Promise<void>
  onClose: () => void
  isSubmitting?: boolean
}

export interface ErTeamPatientPayload {
  patientName: string
  patientNumber: string
  patientBirthday: string
  patientAge: string
  patientSex: "male" | "female" | ""
  patientAddress: string
  evacPriority: string
  typeOfEmergencySelections: string[]
  airwaySelections: string[]
  breathingSelections: string[]
  circulationSelections: string[]
  incidentLocation: string
  moiPoiToi: string
  noi: string
  signsSymptoms: string
  gcsEye: string
  gcsVerbal: string
  gcsMotor: string
  gcsOther: string
  locAvpu: string
  pulseRate: string
  bloodPressure: string
  bpm: string
  oxygenSaturation: string
  painScale: string
  temperature: string
  respiratoryRate: string
  bloodLossLevel: string
  estimatedBloodLoss: string
  turnoverInCharge: string
  receivingHospitalId: string
  receivingDate: string
  emtErtDate: string
  // Legacy fields for backward compatibility
  firstName?: string
  middleName?: string
  lastName?: string
  suffix?: string
  contactNumber?: string
}

export const DEFAULT_PATIENT_TEMPLATE: ErTeamPatientPayload = {
  patientName: "",
  patientNumber: "",
  patientBirthday: "",
  patientAge: "",
  patientSex: "",
  patientAddress: "",
  evacPriority: "",
  typeOfEmergencySelections: [],
  airwaySelections: [],
  breathingSelections: [],
  circulationSelections: [],
  incidentLocation: "",
  moiPoiToi: "",
  noi: "",
  signsSymptoms: "",
  gcsEye: "",
  gcsVerbal: "",
  gcsMotor: "",
  gcsOther: "",
  locAvpu: "",
  pulseRate: "",
  bloodPressure: "",
  bpm: "",
  oxygenSaturation: "",
  painScale: "",
  temperature: "",
  respiratoryRate: "",
  bloodLossLevel: "",
  estimatedBloodLoss: "",
  turnoverInCharge: "",
  receivingHospitalId: "",
  receivingDate: "",
  emtErtDate: "",
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  contactNumber: "",
}


const EMERGENCY_CATEGORY_OPTIONS = [
  "Cardiac",
  "Trauma",
  "OB-Gyn",
  "Neurologic",
  "Respiratory",
  "Pediatric",
  "Burn",
  "Medical",
  "Others",
] as const

const AIRWAY_OPTIONS = [
  "Patent",
  "Obstructed",
  "Needs suctioning",
  "Needs airway adjunct",
] as const

const BREATHING_OPTIONS = [
  "Normal",
  "Shallow",
  "Labored",
  "Bagged",
] as const

const CIRCULATION_OPTIONS = [
  "Radial",
  "Carotid",
  "None",
] as const

const BLOOD_LOSS_OPTIONS = ["Major", "Minor", "None"] as const

export const HOSPITAL_OPTIONS: ReferenceOption[] = [
  { id: "smmg_bulan", name: "SMMG - Bulan" },
  { id: "irosin_general_hospital", name: "Irosin General Hospital / IMAC" },
  { id: "bulan_medicare", name: "Bulan Medicare Hospital" },
  { id: "pawa_hospital", name: "Pawa Hospital" },
  { id: "smmg_hsc_sordoc", name: "SMMG-HSC (SorDoc)" },
  { id: "sorsogon_provincial", name: "Sorsogon Provincial Hospital" },
  { id: "irosin_district", name: "Irosin District Hospital" },
]

export const DEFAULT_INJURY_TEMPLATE: InjuryMap = {
  front: {},
  back: {},
}

const flattenLegacyPatientPayload = (source: unknown): Partial<ErTeamPatientPayload> => {
  if (!source || typeof source !== "object") return {}

  const raw = source as Record<string, any>
  const info = (raw.patientInformation && typeof raw.patientInformation === "object" && raw.patientInformation) || {}
  const assessment = (raw.assessment && typeof raw.assessment === "object" && raw.assessment) || {}
  const vitalSigns = (raw.vitalSigns && typeof raw.vitalSigns === "object" && raw.vitalSigns) || {}
  const gcs = (vitalSigns.GCS && typeof vitalSigns.GCS === "object" && vitalSigns.GCS) || {}
  const medicalHistory = (raw.medicalHistory && typeof raw.medicalHistory === "object" && raw.medicalHistory) || {}
  const transport = (raw.transport && typeof raw.transport === "object" && raw.transport) || {}

  const getString = (...values: unknown[]): string | undefined => {
    for (const value of values) {
      if (typeof value === "string") {
        const trimmed = value.trim()
        if (trimmed.length > 0) return trimmed
      }
    }
    return undefined
  }

  const getArray = (...values: unknown[]): string[] => {
    for (const value of values) {
      if (Array.isArray(value)) {
        const filtered = value.filter((item): item is string => typeof item === "string")
        if (filtered.length > 0) return filtered
      }
    }
    return []
  }

  const fullNameParts = [info.firstName, info.middleName, info.lastName, info.suffix]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
  const fullName = fullNameParts.length > 0 ? fullNameParts.join(" ") : undefined

  const result: Partial<ErTeamPatientPayload> = {}

  const patientName = getString(raw.patientName, assessment.patientName, fullName)
  if (patientName) result.patientName = patientName

  const patientNumber = getString(raw.patientNumber, info.patientNumber, info.contactNumber, raw.contactNumber)
  if (patientNumber) result.patientNumber = patientNumber

  const patientBirthday = getString(raw.patientBirthday, info.birthday)
  if (patientBirthday) result.patientBirthday = patientBirthday

  const patientAge = getString(raw.patientAge, info.age)
  if (patientAge) result.patientAge = patientAge

  const patientSex = getString(raw.patientSex, info.sex)
  if (patientSex === "male" || patientSex === "female") {
    result.patientSex = patientSex
  }

  const patientAddress = getString(raw.patientAddress, info.address)
  if (patientAddress) result.patientAddress = patientAddress

  const evacPriority = getString(raw.evacPriority, assessment.evacPriority)
  if (evacPriority) result.evacPriority = evacPriority

  const typeOfEmergencySelections = getArray(raw.typeOfEmergencySelections, assessment.typeOfEmergencySelections)
  if (typeOfEmergencySelections) result.typeOfEmergencySelections = typeOfEmergencySelections

  const airwaySelections = getArray(raw.airwaySelections)
  if (airwaySelections) result.airwaySelections = airwaySelections

  const breathingSelections = getArray(raw.breathingSelections)
  if (breathingSelections) result.breathingSelections = breathingSelections

  const circulationSelections = getArray(raw.circulationSelections)
  if (circulationSelections) result.circulationSelections = circulationSelections

  const incidentLocation = getString(raw.incidentLocation, assessment.incidentLocation)
  if (incidentLocation) result.incidentLocation = incidentLocation

  const moiPoiToi = getString(raw.moiPoiToi, assessment.moiPoiToi)
  if (moiPoiToi) result.moiPoiToi = moiPoiToi

  const noi = getString(raw.noi, assessment.noi)
  if (noi) result.noi = noi

  const signsSymptoms = getString(raw.signsSymptoms, assessment.signsSymptoms)
  if (signsSymptoms) result.signsSymptoms = signsSymptoms

  const gcsEye = getString(raw.gcsEye, gcs.eye)
  if (gcsEye) result.gcsEye = gcsEye

  const gcsVerbal = getString(raw.gcsVerbal, gcs.verbal)
  if (gcsVerbal) result.gcsVerbal = gcsVerbal

  const gcsMotor = getString(raw.gcsMotor, gcs.motor)
  if (gcsMotor) result.gcsMotor = gcsMotor

  const gcsOther = getString(raw.gcsOther, vitalSigns.GCSOther)
  if (gcsOther) result.gcsOther = gcsOther

  const locAvpu = getString(raw.locAvpu, assessment.locAvpu)
  if (locAvpu) result.locAvpu = locAvpu

  const pulseRate = getString(raw.pulseRate, raw.heartRate, vitalSigns.pulseRate, vitalSigns.heartRate)
  if (pulseRate) result.pulseRate = pulseRate

  const bloodPressure = getString(raw.bloodPressure, vitalSigns.bloodPressure)
  if (bloodPressure) result.bloodPressure = bloodPressure

  const bpm = getString(raw.bpm, vitalSigns.bpm)
  if (bpm) result.bpm = bpm

  const oxygenSaturation = getString(raw.oxygenSaturation, vitalSigns.oxygenSaturation)
  if (oxygenSaturation) result.oxygenSaturation = oxygenSaturation

  const painScale = getString(raw.painScale, vitalSigns.painScale)
  if (painScale) result.painScale = painScale

  const temperature = getString(raw.temperature, vitalSigns.temperature)
  if (temperature) result.temperature = temperature

  const respiratoryRate = getString(raw.respiratoryRate, vitalSigns.respiratoryRate)
  if (respiratoryRate) result.respiratoryRate = respiratoryRate

  const bloodLossLevel = getString(raw.bloodLossLevel, assessment.bloodLossLevel)
  if (bloodLossLevel) result.bloodLossLevel = bloodLossLevel

  const estimatedBloodLoss = getString(raw.estimatedBloodLoss, assessment.estimatedBloodLoss)
  if (estimatedBloodLoss) result.estimatedBloodLoss = estimatedBloodLoss

  const turnoverInCharge = getString(raw.turnoverInCharge, assessment.turnoverInCharge)
  if (turnoverInCharge) result.turnoverInCharge = turnoverInCharge

  const receivingHospitalId = getString(raw.receivingHospitalId, transport.receivingHospitalId)
  if (receivingHospitalId) result.receivingHospitalId = receivingHospitalId


  const emtErtDate = getString(raw.emtErtDate, transport.emtErtDate)
  if (emtErtDate) result.emtErtDate = emtErtDate

  const contactNumber = getString(raw.contactNumber, info.contactNumber)
  if (contactNumber) result.contactNumber = contactNumber

  if (typeof info.firstName === "string") result.firstName = info.firstName
  if (typeof info.middleName === "string") result.middleName = info.middleName
  if (typeof info.lastName === "string") result.lastName = info.lastName
  if (typeof info.suffix === "string") result.suffix = info.suffix

  return result
}

const REGION_LABELS: Record<string, string> = {
  "front_x3D__x22_right-thigh_x22_": "Front Right Thigh",
  "front_x3D__x22_left-thigh_x22_": "Front Left Thigh",
  stomach: "Front Abdomen",
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
  "front_x3D__x22_right-upper-arm_x22_": "Front Right Upper Arm",
  "front_x3D__x22_left-upper-arm_x22_": "Front Left Upper Arm",
  "front_x3D__x22_right-wrist_x22_": "Front Right Wrist",
  "front_x3D__x22_left-wrist_x22_": "Front Left Wrist",
  "front_x3D__x22_chin_x22_": "Chin",
  "front_x3D__x22_forehead_x22_": "Forehead",
  "back_x3D__x22_right-thigh_x22_": "Back Right Thigh",
  "back_x3D__x22_left-thigh_x22_": "Back Left Thigh",
  "back_x3D__x22_right-foot_x22_": "Back Right Foot",
  "back_x3D__x22_left-foot_x22_": "Back Left Foot",
  "back_x3D__x22_right-shoulder_x22_": "Back Right Shoulder",
  "back_x3D__x22_left-shoulder_x22_": "Back Left Shoulder",
  "back_x3D__x22_right-forearm_x22_": "Back Right Forearm",
  "back_x3D__x22_left-forearm_x22_": "Back Left Forearm",
  "back_x3D__x22_right-calf_x22_": "Back Right Calf",
  "back_x3D__x22_left-calf_x22_": "Back Left Calf",
  "back_x3D__x22_right-knee_x22_": "Back Right Knee",
  "back_x3D__x22_left-knee_x22_": "Back Left Knee",
  "back_x3D__x22_right-ankle_x22_": "Back Right Ankle",
  "back_x3D__x22_left-ankle_x22_": "Back Left Ankle",
  "back_x3D__x22_right-hip_x22_": "Back Right Hip",
  "back_x3D__x22_left-hip_x22_": "Back Left Hip",
  "back_x3D__x22_lower-back_x22_": "Lower Back",
  "back_x3D__x22_upper-back_x22_": "Upper Back",
  "back_x3D__x22_right-hand_x22_": "Back Right Hand",
  "back_x3D__x22_left-hand_x22_": "Back Left Hand",
  "back_x3D__x22_right-elbow_x22_": "Back Right Elbow",
  "back_x3D__x22_left-elbow_x22_": "Back Left Elbow",
  "back_x3D__x22_right-wrist_x22_": "Back Right Wrist",
  "back_x3D__x22_left-wrist_x22_": "Back Left Wrist",
  "back_x3D__x22_right-upper-arm_x22_": "Back Right Upper Arm",
  "back_x3D__x22_left-upper-arm_x22_": "Back Left Upper Arm",
  "back_x3D__x22_back-of-head_x22_": "Back of Head",
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

const INJURY_TYPE_OPTIONS = [
  { code: "D", label: "Deformities" },
  { code: "C", label: "Contusions" },
  { code: "A", label: "Abrasions" },
  { code: "P", label: "Penetrations" },
  { code: "B", label: "Burns" },
  { code: "T", label: "Tenderness" },
  { code: "L", label: "Lacerations" },
  { code: "S", label: "Swelling" },
] as const

const INJURY_TYPE_COLOR_MAP: Record<string, string> = {
  D: "#ef4444",
  C: "#f97316",
  A: "#facc15",
  P: "#8b5cf6",
  B: "#fb7185",
  T: "#22d3ee",
  L: "#10b981",
  S: "#6366f1",
}

const DEFAULT_REGION_FILL = "#f3f4f6"
const REGION_ACTIVE_STROKE = "#fb923c"
const REGION_HOVER_FILL = "#bfdbfe"
const REGION_SELECTED_FILL = "#f97316"

const svgContentCache = new Map<string, string>()

const escapeSelector = (value: string) => {
  if (typeof window !== "undefined" && window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value)
  }
  return value.replace(/([.#:[\],=])/g, "\\$1")
}

const darkenHexColor = (hex: string, amount = 0.15) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!match) return hex
  const toChannel = (value: string) => Math.max(0, Math.min(255, Math.floor(parseInt(value, 16) * (1 - amount))))
  const r = toChannel(match[1])
  const g = toChannel(match[2])
  const b = toChannel(match[3])
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

interface BodyDiagramProps {
  view: "front" | "back"
  svgPath: string
  regionIds: readonly string[]
  regionColors: Record<string, string>
  activeRegionId: string | null
  onRegionSelect: (regionId: string) => void
}

const BodyDiagram: React.FC<BodyDiagramProps> = ({ view, svgPath, regionIds, regionColors, activeRegionId, onRegionSelect }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [svgContent, setSvgContent] = React.useState<string>("")

  React.useEffect(() => {
    let isMounted = true
    const loadSvg = async () => {
      if (svgContentCache.has(svgPath)) {
        if (isMounted) setSvgContent(svgContentCache.get(svgPath) ?? "")
        return
      }
      try {
        const response = await fetch(svgPath)
        if (!response.ok) throw new Error(`Failed to load SVG (${response.status})`)
        const text = await response.text()
        svgContentCache.set(svgPath, text)
        if (isMounted) setSvgContent(text)
      } catch (error) {
        console.error("Error loading ER team body diagram", error)
        if (isMounted) setSvgContent("<svg></svg>")
      }
    }
    void loadSvg()
    return () => {
      isMounted = false
    }
  }, [svgPath])

  React.useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = svgContent
  }, [svgContent])

  React.useEffect(() => {
    if (!containerRef.current) return
    const svgElement = containerRef.current.querySelector("svg")
    if (!svgElement) return

    svgElement.removeAttribute("width")
    svgElement.removeAttribute("height")
    svgElement.style.width = "100%"
    svgElement.style.height = "auto"
    svgElement.style.maxWidth = "360px"
    svgElement.style.display = "block"
    svgElement.style.margin = "0 auto"

    const cleanupFns: Array<() => void> = []

    regionIds.forEach((regionId) => {
      const selector = `#${escapeSelector(regionId)}`
      const regionElement = svgElement.querySelector<SVGGraphicsElement>(selector)
      if (!regionElement) return

      const applyStyles = (isHover = false) => {
        const assignedColor = regionColors[regionId]
        const isActive = activeRegionId === regionId
        const fillColor = assignedColor
          ? assignedColor
          : isActive
            ? REGION_SELECTED_FILL
            : isHover
              ? REGION_HOVER_FILL
              : DEFAULT_REGION_FILL
        const strokeColor = assignedColor
          ? darkenHexColor(assignedColor, 0.25)
          : isActive
            ? REGION_ACTIVE_STROKE
            : "#1f2937"

        regionElement.style.cursor = "pointer"
        regionElement.style.transition = "fill 0.15s ease, stroke-width 0.15s ease"
        regionElement.style.fill = fillColor
        regionElement.style.stroke = strokeColor
        regionElement.style.strokeWidth = assignedColor || isActive ? "2" : "1.2"
        regionElement.style.opacity = assignedColor || isActive ? "0.95" : "1"
      }

      applyStyles()

      const handleMouseEnter = () => {
        if (!regionColors[regionId]) {
          applyStyles(true)
        }
      }

      const handleMouseLeave = () => {
        applyStyles()
      }

      const handleClick = () => {
        onRegionSelect(regionId)
      }

      regionElement.addEventListener("mouseenter", handleMouseEnter)
      regionElement.addEventListener("mouseleave", handleMouseLeave)
      regionElement.addEventListener("click", handleClick)

      cleanupFns.push(() => {
        regionElement.removeEventListener("mouseenter", handleMouseEnter)
        regionElement.removeEventListener("mouseleave", handleMouseLeave)
        regionElement.removeEventListener("click", handleClick)
      })
    })

    return () => {
      cleanupFns.forEach((fn) => fn())
    }
  }, [regionIds, regionColors, activeRegionId, onRegionSelect, svgContent])

  return (
    <div className="w-full">
      <div ref={containerRef} className="w-full" aria-label={`${view} body diagram`} />
      {!svgContent && <div className="py-6 text-center text-sm text-gray-400">Loading diagram…</div>}
    </div>
  )
}

const INJURY_TYPE_LOOKUP = INJURY_TYPE_OPTIONS.reduce<Record<string, { code: string; label: string }>>((acc, option) => {
  acc[option.code] = option
  return acc
}, {})

interface InjurySummaryListProps {
  view: "front" | "back"
  regionMap: Record<string, string[]>
}

function InjurySummaryList({ view, regionMap }: InjurySummaryListProps) {
  const entries = Object.entries(regionMap).filter(([, injuries]) => injuries && injuries.length > 0)

  if (entries.length === 0) {
    return <p className="text-xs text-gray-500">No injuries logged on the {view} view.</p>
  }

  return (
    <div className="space-y-2">
      {entries.map(([region, injuries]) => (
        <div key={`${view}-${region}`} className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-700">{normalizeRegionLabel(region)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {injuries.map((code) => (
              <span key={code} className="inline-flex items-center gap-2 rounded-full bg-white px-2 py-1 text-xs text-gray-600">
                <span
                  className="inline-flex h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: INJURY_TYPE_COLOR_MAP[code] ?? "#cbd5f5" }}
                />
                {INJURY_TYPE_LOOKUP[code]?.label ?? code}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const clone = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

const parseDate = (value: string | undefined) => {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const formatDateValue = (value: string | undefined) => {
  const date = parseDate(value)
  return date ? format(date, "PPP") : ""
}

interface DatePickerFieldProps {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  required?: boolean
  allowClear?: boolean
  fromYear?: number
  toYear?: number
  captionLayout?: React.ComponentProps<typeof Calendar>["captionLayout"]
  initialFocus?: boolean
}

const DatePickerField: React.FC<DatePickerFieldProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder = "Select date",
  required,
  allowClear = false,
  fromYear,
  toYear,
  captionLayout,
  initialFocus,
}) => {
  const [open, setOpen] = React.useState(false)
  const selectedDate = parseDate(value)

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange("")
      return
    }
    const iso = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().split("T")[0]
    onChange(iso)
    setOpen(false)
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="block text-xs uppercase text-gray-500">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn("w-full justify-start text-left text-sm", !selectedDate && "text-muted-foreground")}
          >
            <div className="flex flex-1 items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span className="truncate">{selectedDate ? formatDateValue(value) : placeholder}</span>
              </div>
              {allowClear && value ? (
                <span
                  role="button"
                  tabIndex={0}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                  onClick={(event) => {
                    event.stopPropagation()
                    onChange("")
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      event.stopPropagation()
                      onChange("")
                    }
                  }}
                >
                  <XCircle className="h-4 w-4" />
                </span>
              ) : null}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            initialFocus={initialFocus}
            captionLayout={captionLayout}
            fromYear={fromYear}
            toYear={toYear}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

const STATUS_BADGE: Record<ErTeamDraftStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-200 text-gray-800" },
  pending_review: { label: "Pending review", className: "bg-amber-200 text-amber-800" },
  in_review: { label: "In review", className: "bg-blue-200 text-blue-800" },
  approved: { label: "Approved", className: "bg-emerald-200 text-emerald-900" },
  rejected: { label: "Needs revision", className: "bg-red-200 text-red-800" },
}

export function ErTeamReportForm({
  draft,
  hospitals,
  onDraftChange,
  onSubmitForReview,
  onClose,
  isSubmitting = false,
}: ErTeamReportFormProps) {
  const [activeTab, setActiveTab] = React.useState<string>("patient")

  const ensurePayloads = React.useCallback(() => {
    const patientPayload: ErTeamPatientPayload = {
      ...DEFAULT_PATIENT_TEMPLATE,
      ...flattenLegacyPatientPayload(draft.patientPayload),
      ...(draft.patientPayload ?? {}),
    }

    if (!Array.isArray(patientPayload.typeOfEmergencySelections)) {
      patientPayload.typeOfEmergencySelections = []
    }

    const normalizeInjuryView = (view: unknown): Record<string, string[]> => {
      if (!view || typeof view !== "object" || Array.isArray(view)) return {}
      const result: Record<string, string[]> = {}
      for (const [region, codes] of Object.entries(view as Record<string, unknown>)) {
        if (Array.isArray(codes)) {
          result[region] = codes.filter((code): code is string => typeof code === "string")
        }
      }
      return result
    }

    const injuryPayload: InjuryMap = {
      front: normalizeInjuryView(draft.injuryPayload?.front),
      back: normalizeInjuryView(draft.injuryPayload?.back),
    }

    return { patientPayload, injuryPayload }
  }, [draft.patientPayload, draft.injuryPayload])

  const { patientPayload, injuryPayload } = ensurePayloads()

  const updateDraft = React.useCallback(
    (partial: Partial<ErTeamDraft>) => {
      onDraftChange({
        ...draft,
        ...partial,
        updatedAt: new Date().toISOString(),
      })
    },
    [draft, onDraftChange]
  )

  const [diagramView, setDiagramView] = React.useState<InjuryView>("front")
  const [activeRegionSelection, setActiveRegionSelection] = React.useState<{ view: InjuryView; region: string } | null>(null)

  const getInjuryMapForView = React.useCallback(
    (view: InjuryView) => {
      return view === "front" ? injuryPayload.front : injuryPayload.back
    },
    [injuryPayload.front, injuryPayload.back]
  )

  const updateInjuryMap = React.useCallback(
    (view: InjuryView, region: string, codes: string[]) => {
      const next = clone(injuryPayload)
      const viewMap = { ...(view === "front" ? next.front : next.back) }
      if (codes.length) {
        viewMap[region] = codes
      } else {
        delete viewMap[region]
      }
      if (view === "front") {
        next.front = viewMap
      } else {
        next.back = viewMap
      }
      updateDraft({ injuryPayload: next })
    },
    [injuryPayload, updateDraft]
  )

  const handleRegionSelect = React.useCallback(
    (view: InjuryView, regionId: string) => {
      setDiagramView(view)
      setActiveRegionSelection({ view, region: regionId })
    },
    []
  )

  const handleToggleInjury = React.useCallback(
    (code: string) => {
      if (!activeRegionSelection) return
      const { view, region } = activeRegionSelection
      const current = getInjuryMapForView(view)[region] ?? []
      const next = current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code]
      updateInjuryMap(view, region, next)
    },
    [activeRegionSelection, getInjuryMapForView, updateInjuryMap]
  )

  const handleClearRegionInjuries = React.useCallback(() => {
    if (!activeRegionSelection) return
    const { view, region } = activeRegionSelection
    updateInjuryMap(view, region, [])
    setActiveRegionSelection(null)
  }, [activeRegionSelection, updateInjuryMap])

  const frontRegionColors = React.useMemo(() => {
    const result: Record<string, string> = {}
    Object.entries(injuryPayload.front).forEach(([region, codes]) => {
      const primary = codes[0]
      if (primary) {
        result[region] = INJURY_TYPE_COLOR_MAP[primary] ?? REGION_ACTIVE_STROKE
      }
    })
    return result
  }, [injuryPayload.front])

  const backRegionColors = React.useMemo(() => {
    const result: Record<string, string> = {}
    Object.entries(injuryPayload.back).forEach(([region, codes]) => {
      const primary = codes[0]
      if (primary) {
        result[region] = INJURY_TYPE_COLOR_MAP[primary] ?? REGION_ACTIVE_STROKE
      }
    })
    return result
  }, [injuryPayload.back])

  const activeRegionInjuries = React.useMemo(() => {
    if (!activeRegionSelection) return []
    const { view, region } = activeRegionSelection
    return getInjuryMapForView(view)[region] ?? []
  }, [activeRegionSelection, getInjuryMapForView])

  const handleChangeDiagramView = React.useCallback((value: string) => {
    if (value === "front" || value === "back") {
      setDiagramView(value)
      if (activeRegionSelection && activeRegionSelection.view !== value) {
        setActiveRegionSelection(null)
      }
    }
  }, [activeRegionSelection])

  const handlePatientField = React.useCallback(
    (partial: Partial<ErTeamPatientPayload>) => {
      updateDraft({
        patientPayload: {
          ...patientPayload,
          ...partial,
        },
      })
    },
    [patientPayload, updateDraft]
  )

  const handleBirthdayChange = React.useCallback(
    (value: string) => {
      const nextFields: Partial<ErTeamPatientPayload> = { patientBirthday: value }
      const parsed = value ? parseISO(value) : null
      if (parsed && isValid(parsed)) {
        const years = differenceInYears(new Date(), parsed)
        if (!Number.isNaN(years) && years >= 0) {
          nextFields.patientAge = String(years)
        }
      } else if (!value) {
        nextFields.patientAge = DEFAULT_PATIENT_TEMPLATE.patientAge
      }
      handlePatientField(nextFields)
    },
    [handlePatientField]
  )

  React.useEffect(() => {
    if (!patientPayload.patientBirthday) {
      if (patientPayload.patientAge !== DEFAULT_PATIENT_TEMPLATE.patientAge) {
        handlePatientField({ patientAge: DEFAULT_PATIENT_TEMPLATE.patientAge })
      }
      return
    }
    const parsed = parseISO(patientPayload.patientBirthday)
    if (!isValid(parsed)) return
    const years = differenceInYears(new Date(), parsed)
    if (Number.isNaN(years) || years < 0) return
    const nextAge = String(years)
    if (nextAge !== patientPayload.patientAge) {
      handlePatientField({ patientAge: nextAge })
    }
  }, [handlePatientField, patientPayload.patientAge, patientPayload.patientBirthday])

  const handleNotesChange = React.useCallback(
    (value: string) => {
      updateDraft({ notes: value })
    },
    [updateDraft]
  )

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      await onSubmitForReview(draft)
    },
    [draft, onSubmitForReview]
  )

  const statusMeta = STATUS_BADGE[draft.status]

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-lg ring-1 ring-orange-100 sm:rounded-3xl">
      <header className="border-b border-orange-100 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500 px-4 py-4 text-white sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-orange-100">Patient Care Report</p>
            <h2 className="text-lg font-semibold">Draft #{draft.clientDraftId.slice(0, 8)}</h2>
            <p className="mt-1 text-xs text-orange-100">
              Last updated {new Date(draft.updatedAt).toLocaleString()} {draft.synced ? "• Synced" : "• Draft mode"}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
            {draft.lastSyncError ? (
              <span className="flex items-center gap-1 text-xs text-red-200">
                <AlertCircle className="h-3 w-3" /> {draft.lastSyncError}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
          <div className="border-b border-gray-100 px-4 pt-3 sm:px-6">
            <TabsList className="grid grid-cols-2 rounded-xl bg-gray-100 p-1 text-xs sm:text-sm">
              <TabsTrigger value="patient" className="flex items-center justify-center gap-1">
                <User className="h-3 w-3" /> Patient
              </TabsTrigger>
              <TabsTrigger value="injuries" className="flex items-center justify-center gap-1">
                <Activity className="h-3 w-3" /> Injuries
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="patient" className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <section className="space-y-4">
              <Card className="border-none shadow-sm">
                <CardContent className="space-y-4 pt-4">
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> Patient details</span>
                    <span className="inline-flex items-center gap-1"><Pill className="h-3 w-3" /> Medical info</span>
                    <span className="inline-flex items-center gap-1"><Droplet className="h-3 w-3" /> Vitals</span>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <Label htmlFor="patient-name" className="block text-sm font-medium text-gray-700 mb-1">
                        Full name
                      </Label>
                      <Input
                        id="patient-name"
                        value={patientPayload.patientName}
                        onChange={(event) => handlePatientField({ patientName: event.target.value })}
                        placeholder="Juan Dela Cruz"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="patient-number" className="block text-sm font-medium text-gray-700 mb-1">
                        Contact number
                      </Label>
                      <Input
                        id="patient-number"
                        value={patientPayload.patientNumber}
                        onChange={(event) => handlePatientField({ patientNumber: event.target.value.replace(/[^0-9]/g, "").slice(0, 11) })}
                        inputMode="tel"
                        placeholder="09XX XXX XXXX"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-3">
                    <DatePickerField
                      id="patient-birthday"
                      label="Birthday"
                      value={patientPayload.patientBirthday}
                      onChange={handleBirthdayChange}
                      required
                      initialFocus
                      captionLayout="dropdown"
                      fromYear={1950}
                      toYear={new Date().getFullYear()}
                    />
                    <div>
                      <Label htmlFor="patient-age" className="block text-sm font-medium text-gray-700 mb-1">
                        Age
                      </Label>
                      <Input
                        id="patient-age"
                        type="number"
                        min="0"
                        value={patientPayload.patientAge}
                        readOnly
                        required
                      />
                    </div>
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-1">Sex</Label>
                      <div className="flex items-center gap-3">
                        {(["male", "female"] as const).map((sexOption) => (
                          <label key={sexOption} className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <Checkbox
                              checked={patientPayload.patientSex === sexOption}
                              onCheckedChange={(checked) => handlePatientField({ patientSex: checked ? sexOption : "" })}
                            />
                            {sexOption.charAt(0).toUpperCase() + sexOption.slice(1)}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <Label htmlFor="patient-address" className="block text-sm font-medium text-gray-700 mb-1">
                        Address / Landmark
                      </Label>
                      <Textarea
                        id="patient-address"
                        value={patientPayload.patientAddress}
                        onChange={(event) => handlePatientField({ patientAddress: event.target.value })}
                        rows={2}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="incident-location" className="block text-sm font-medium text-gray-700 mb-1">
                        Incident location
                      </Label>
                      <Textarea
                        id="incident-location"
                        value={patientPayload.incidentLocation}
                        onChange={(event) => handlePatientField({ incidentLocation: event.target.value })}
                        rows={2}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardContent className="space-y-3 pt-4">
                  <p className="text-sm font-medium text-gray-800">Vitals</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="blood-pressure" className="block text-xs font-semibold text-gray-600 mb-1">
                        Blood pressure
                      </Label>
                      <Input
                        id="blood-pressure"
                        value={patientPayload.bloodPressure}
                        onChange={(event) => handlePatientField({ bloodPressure: event.target.value })}
                        placeholder="120/80"
                      />
                    </div>
                    <div>
                      <Label htmlFor="pulse-rate" className="block text-xs font-semibold text-gray-600 mb-1">
                        Pulse rate
                      </Label>
                      <Input
                        id="pulse-rate"
                        value={patientPayload.pulseRate}
                        onChange={(event) => handlePatientField({ pulseRate: event.target.value })}
                        placeholder="80 bpm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="loc-avpu" className="block text-xs font-semibold text-gray-600 mb-1">
                        LOC / AVPU
                      </Label>
                      <Input
                        id="loc-avpu"
                        value={patientPayload.locAvpu}
                        onChange={(event) => handlePatientField({ locAvpu: event.target.value })}
                        placeholder="Alert"
                      />
                    </div>
                    <div>
                      <Label htmlFor="oxygen-saturation" className="block text-xs font-semibold text-gray-600 mb-1">
                        O₂ saturation (%)
                      </Label>
                      <Input
                        id="oxygen-saturation"
                        value={patientPayload.oxygenSaturation}
                        onChange={(event) => handlePatientField({ oxygenSaturation: event.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="respiratory-rate" className="block text-xs font-semibold text-gray-600 mb-1">
                        Respiratory rate (RR)
                      </Label>
                      <Input
                        id="respiratory-rate"
                        value={patientPayload.respiratoryRate}
                        onChange={(event) => handlePatientField({ respiratoryRate: event.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="temperature" className="block text-xs font-semibold text-gray-600 mb-1">
                        Temperature (°C)
                      </Label>
                      <Input
                        id="temperature"
                        value={patientPayload.temperature}
                        onChange={(event) => handlePatientField({ temperature: event.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="bpm" className="block text-xs font-semibold text-gray-600 mb-1">
                        BPM
                      </Label>
                      <Input
                        id="bpm"
                        value={patientPayload.bpm}
                        onChange={(event) => handlePatientField({ bpm: event.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="pain-scale" className="block text-xs font-semibold text-gray-600 mb-1">
                        Pain (1-10)
                      </Label>
                      <Input
                        id="pain-scale"
                        type="number"
                        min="0"
                        max="10"
                        value={patientPayload.painScale}
                        onChange={(event) => handlePatientField({ painScale: event.target.value.replace(/[^0-9]/g, "").slice(0, 2) })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-lg border shadow-sm p-4 space-y-3">
                      <p className="text-sm font-semibold text-gray-700">Glasgow Coma Scale (GCS)</p>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs font-semibold text-gray-600 mb-2 block">Eye (4-1)</Label>
                          <div className="grid grid-cols-4 gap-2">
                            {["4", "3", "2", "1"].map((value) => (
                              <Button
                                key={value}
                                type="button"
                                variant={patientPayload.gcsEye === value ? "default" : "outline"}
                                className={cn(
                                  "py-2",
                                  patientPayload.gcsEye === value ? "bg-orange-500 text-white" : "bg-white text-gray-700 hover:bg-gray-50",
                                )}
                                onClick={() => handlePatientField({ gcsEye: value })}
                              >
                                {value}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-gray-600 mb-2 block">Verbal (5-1)</Label>
                          <div className="grid grid-cols-5 gap-2">
                            {["5", "4", "3", "2", "1"].map((value) => (
                              <Button
                                key={value}
                                type="button"
                                variant={patientPayload.gcsVerbal === value ? "default" : "outline"}
                                className={cn(
                                  "py-2",
                                  patientPayload.gcsVerbal === value ? "bg-orange-500 text-white" : "bg-white text-gray-700 hover:bg-gray-50",
                                )}
                                onClick={() => handlePatientField({ gcsVerbal: value })}
                              >
                                {value}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-gray-600 mb-2 block">Motor (6-1)</Label>
                          <div className="grid grid-cols-6 gap-2">
                            {["6", "5", "4", "3", "2", "1"].map((value) => (
                              <Button
                                key={value}
                                type="button"
                                variant={patientPayload.gcsMotor === value ? "default" : "outline"}
                                className={cn(
                                  "py-2",
                                  patientPayload.gcsMotor === value ? "bg-orange-500 text-white" : "bg-white text-gray-700 hover:bg-gray-50",
                                )}
                                onClick={() => handlePatientField({ gcsMotor: value })}
                              >
                                {value}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                        <span className="text-sm font-semibold text-gray-700">Total GCS</span>
                        <span className="text-lg font-bold text-gray-900">
                          {Number(patientPayload.gcsEye || 0) + Number(patientPayload.gcsVerbal || 0) + Number(patientPayload.gcsMotor || 0)}
                        </span>
                      </div>
                      <div>
                        <Label htmlFor="gcs-other" className="block text-xs font-semibold text-gray-600 mb-1">
                          Other remarks
                        </Label>
                        <Textarea
                          id="gcs-other"
                          value={patientPayload.gcsOther}
                          onChange={(event) => handlePatientField({ gcsOther: event.target.value })}
                          rows={2}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border shadow-sm p-4 space-y-4">
                      <p className="text-sm font-semibold text-gray-700">Primary survey</p>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="rounded-lg border shadow-sm p-3">
                          <p className="text-xs font-semibold text-gray-600 mb-2">Airway (A)</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {AIRWAY_OPTIONS.map((option) => (
                              <Button
                                key={option}
                                type="button"
                                variant={patientPayload.airwaySelections.includes(option) ? "default" : "outline"}
                                className={cn(
                                  "justify-start",
                                  patientPayload.airwaySelections.includes(option)
                                    ? "bg-orange-100 text-orange-700 border-orange-400"
                                    : "bg-white text-gray-700 hover:bg-gray-50",
                                )}
                                onClick={() => {
                                  const existing = patientPayload.airwaySelections
                                  const next = existing.includes(option)
                                    ? existing.filter((item) => item !== option)
                                    : [...existing, option]
                                  handlePatientField({ airwaySelections: next })
                                }}
                              >
                                {option}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-lg border shadow-sm p-3">
                          <p className="text-xs font-semibold text-gray-600 mb-2">Breathing (B)</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {BREATHING_OPTIONS.map((option) => (
                              <Button
                                key={option}
                                type="button"
                                variant={patientPayload.breathingSelections.includes(option) ? "default" : "outline"}
                                className={cn(
                                  "justify-start",
                                  patientPayload.breathingSelections.includes(option)
                                    ? "bg-orange-100 text-orange-700 border-orange-400"
                                    : "bg-white text-gray-700 hover:bg-gray-50",
                                )}
                                onClick={() => {
                                  const existing = patientPayload.breathingSelections
                                  const next = existing.includes(option)
                                    ? existing.filter((item) => item !== option)
                                    : [...existing, option]
                                  handlePatientField({ breathingSelections: next })
                                }}
                              >
                                {option}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-lg border shadow-sm p-3">
                          <p className="text-xs font-semibold text-gray-600 mb-2">Circulation (C)</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {CIRCULATION_OPTIONS.map((option) => (
                              <Button
                                key={option}
                                type="button"
                                variant={patientPayload.circulationSelections.includes(option) ? "default" : "outline"}
                                className={cn(
                                  "justify-start",
                                  patientPayload.circulationSelections.includes(option)
                                    ? "bg-orange-100 text-orange-700 border-orange-400"
                                    : "bg-white text-gray-700 hover:bg-gray-50",
                                )}
                                onClick={() => {
                                  const existing = patientPayload.circulationSelections
                                  const next = existing.includes(option)
                                    ? existing.filter((item) => item !== option)
                                    : [...existing, option]
                                  handlePatientField({ circulationSelections: next })
                                }}
                              >
                                {option}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="incident-location" className="block text-xs font-semibold text-gray-600 mb-1">
                            Incident location
                          </Label>
                          <Input
                            id="incident-location"
                            value={patientPayload.incidentLocation}
                            onChange={(event) => handlePatientField({ incidentLocation: event.target.value })}
                            required
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label className="block text-xs font-semibold text-gray-600 mb-1">Evacuation priority</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {PRIORITY_LABELS.map((priority) => (
                              <Button
                                key={priority.value}
                                type="button"
                                variant={patientPayload.evacPriority === priority.value ? "default" : "outline"}
                                className={cn(
                                  "justify-start",
                                  patientPayload.evacPriority === priority.value
                                    ? `${PRIORITY_COLORS[priority.value]} text-white`
                                    : "bg-white text-gray-700 hover:bg-gray-50",
                                )}
                                onClick={() =>
                                  handlePatientField({
                                    evacPriority: patientPayload.evacPriority === priority.value ? "" : priority.value,
                                  })
                                }
                              >
                                <span
                                  className={cn(
                                    "inline-flex h-2.5 w-2.5 rounded-full",
                                    PRIORITY_COLORS[priority.value],
                                    patientPayload.evacPriority !== priority.value && "bg-gray-300",
                                  )}
                                />
                                <span className="ml-2 text-left">
                                  <span className="block text-sm font-semibold">{priority.label}</span>
                                  <span className={cn("text-[11px]", patientPayload.evacPriority === priority.value ? "text-white/80" : "text-gray-500")}> 
                                    {priority.description}
                                  </span>
                                </span>
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <Label htmlFor="moi-poi-toi" className="block text-xs font-semibold text-gray-600 mb-1">
                            MOI / POI / TOI
                          </Label>
                          <Textarea
                            id="moi-poi-toi"
                            value={patientPayload.moiPoiToi}
                            onChange={(event) => handlePatientField({ moiPoiToi: event.target.value })}
                            rows={2}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="noi" className="block text-xs font-semibold text-gray-600 mb-1">
                            NOI (Nature of injury)
                          </Label>
                          <Textarea
                            id="noi"
                            value={patientPayload.noi}
                            onChange={(event) => handlePatientField({ noi: event.target.value })}
                            rows={2}
                          />
                        </div>
                        <div>
                          <Label htmlFor="signs-symptoms" className="block text-xs font-semibold text-gray-600 mb-1">
                            Signs & symptoms
                          </Label>
                          <Textarea
                            id="signs-symptoms"
                            value={patientPayload.signsSymptoms}
                            onChange={(event) => handlePatientField({ signsSymptoms: event.target.value })}
                            rows={2}
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-2">Emergency category</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {EMERGENCY_CATEGORY_OPTIONS.map((option) => (
                            <Button
                              key={option}
                              type="button"
                              variant={patientPayload.typeOfEmergencySelections.includes(option) ? "default" : "outline"}
                              className={cn(
                                "justify-start",
                                patientPayload.typeOfEmergencySelections.includes(option)
                                  ? "bg-orange-500 text-white"
                                  : "bg-white text-gray-700 hover:bg-gray-50",
                              )}
                              onClick={() => {
                                const existing = patientPayload.typeOfEmergencySelections
                                const next = existing.includes(option)
                                  ? existing.filter((item) => item !== option)
                                  : [...existing, option]
                                handlePatientField({ typeOfEmergencySelections: next })
                              }}
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border shadow-sm p-4 space-y-4">
                    <p className="text-sm font-semibold text-gray-700">Transport & turnover</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="receiving-hospital" className="block text-xs font-semibold text-gray-600 mb-1">
                          Receiving hospital
                        </Label>
                        <Select
                          value={patientPayload.receivingHospitalId ?? ""}
                          onValueChange={(value: string) => handlePatientField({ receivingHospitalId: value })}
                        >
                          <SelectTrigger id="receiving-hospital">
                            <SelectValue placeholder="Select hospital" />
                          </SelectTrigger>
                          <SelectContent className="max-h-56 overflow-y-auto">
                            {hospitals.map((hospital) => (
                              <SelectItem key={hospital.id} value={hospital.id}>
                                {hospital.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <DatePickerField
                          id="receiving-date"
                          label="Receiving date"
                          value={patientPayload.receivingDate}
                          onChange={(next) => handlePatientField({ receivingDate: next })}
                          required
                        />
                      </div>
                      <div>
                        <DatePickerField
                          id="emt-date"
                          label="EMT/ERT date"
                          value={patientPayload.emtErtDate}
                          onChange={(next) => handlePatientField({ emtErtDate: next })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="turnover-in-charge" className="block text-xs font-semibold text-gray-600 mb-1">
                          Turnover in-charge
                        </Label>
                        <Input
                          id="turnover-in-charge"
                          value={patientPayload.turnoverInCharge}
                          onChange={(event) => handlePatientField({ turnoverInCharge: event.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="blood-loss" className="block text-xs font-semibold text-gray-600 mb-2">
                          Blood loss level
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {BLOOD_LOSS_OPTIONS.map((option) => (
                            <Button
                              key={option}
                              type="button"
                              variant={patientPayload.bloodLossLevel === option ? "default" : "outline"}
                              className={cn(
                                "px-4",
                                patientPayload.bloodLossLevel === option
                                  ? "bg-orange-500 text-white"
                                  : "bg-white text-gray-700 hover:bg-gray-50",
                              )}
                              onClick={() => handlePatientField({ bloodLossLevel: patientPayload.bloodLossLevel === option ? "" : option })}
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="estimated-blood-loss" className="block text-xs font-semibold text-gray-600 mb-1">
                          Estimated blood loss (L)
                        </Label>
                        <Input
                          id="estimated-blood-loss"
                          value={patientPayload.estimatedBloodLoss}
                          onChange={(event) => handlePatientField({ estimatedBloodLoss: event.target.value })}
                          placeholder="e.g., 0.5"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="injuries" className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <section className="space-y-4">
              <Card className="border-none shadow-sm">
                <CardContent className="space-y-5 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-800">Tap body regions to log injuries</p>
                      <p className="text-xs text-gray-500">Colors indicate the most severe injury logged on each region.</p>
                    </div>
                  </div>
                  <Tabs value={diagramView} onValueChange={handleChangeDiagramView} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 rounded-xl bg-gray-100 p-1 text-sm">
                      <TabsTrigger value="front">Front</TabsTrigger>
                      <TabsTrigger value="back">Back</TabsTrigger>
                    </TabsList>
                    <TabsContent value="front" className="mt-4">
                      <BodyDiagram
                        view="front"
                        svgPath={FRONT_SVG_PATH}
                        regionIds={FRONT_BODY_REGION_IDS}
                        regionColors={frontRegionColors}
                        activeRegionId={activeRegionSelection?.view === "front" ? activeRegionSelection.region : null}
                        onRegionSelect={(regionId: string) => {
                          handleRegionSelect("front", regionId)
                          setActiveRegionSelection({ view: "front", region: regionId })
                        }}
                      />
                    </TabsContent>
                    <TabsContent value="back" className="mt-4">
                      <BodyDiagram
                        view="back"
                        svgPath={BACK_SVG_PATH}
                        regionIds={BACK_BODY_REGION_IDS}
                        regionColors={backRegionColors}
                        activeRegionId={activeRegionSelection?.view === "back" ? activeRegionSelection.region : null}
                        onRegionSelect={(regionId: string) => {
                          handleRegionSelect("back", regionId)
                          setActiveRegionSelection({ view: "back", region: regionId })
                        }}
                      />
                    </TabsContent>
                  </Tabs>
                  <div className="space-y-2 text-xs text-gray-600">
                    <p className="font-semibold text-gray-700">Legend</p>
                    <div className="flex flex-wrap gap-2">
                      {INJURY_TYPE_OPTIONS.map((option) => (
                        <span key={option.code} className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1">
                          <span
                            className="inline-flex h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: INJURY_TYPE_COLOR_MAP[option.code] }}
                          />
                          {option.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {activeRegionSelection ? (
                <Card className="border-none shadow-sm">
                  <CardContent className="space-y-4 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Selected region</p>
                        <p className="text-xs text-gray-500">
                          {REGION_LABELS[activeRegionSelection.region] ?? activeRegionSelection.region} ({activeRegionSelection.view})
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={handleClearRegionInjuries}>
                        Clear region
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {INJURY_TYPE_OPTIONS.map((option) => {
                        const isActive = activeRegionInjuries.includes(option.code)
                        return (
                          <Button
                            key={option.code}
                            type="button"
                            variant={isActive ? "default" : "outline"}
                            className={isActive ? "bg-orange-500 hover:bg-orange-600" : "border-gray-200"}
                            onClick={() => handleToggleInjury(option.code)}
                          >
                            {option.label}
                          </Button>
                        )
                      })}
                    </div>
                    {activeRegionInjuries.length === 0 ? (
                      <p className="text-xs text-gray-500">Select one or more injury types to log for this body region.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {activeRegionInjuries.map((code) => (
                          <Badge key={code} className="bg-orange-100 text-orange-700">
                            {INJURY_TYPE_OPTIONS.find((option) => option.code === code)?.label ?? code}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-none shadow-sm">
                  <CardContent className="pt-4 text-sm text-gray-500">
                    Tap a body region to begin logging injuries.
                  </CardContent>
                </Card>
              )}

              <Card className="border-none shadow-sm">
                <CardContent className="space-y-4 pt-4">
                  <p className="text-sm font-semibold text-gray-800">Logged injuries summary</p>
                  <div className="space-y-3 text-xs text-gray-600">
                    <InjurySummaryList view="front" regionMap={injuryPayload.front} />
                    <InjurySummaryList view="back" regionMap={injuryPayload.back} />
                  </div>
                </CardContent>
              </Card>

            </section>
          </TabsContent>
        </Tabs>

        <footer className="sticky bottom-0 mt-auto border-t border-gray-100 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={onClose} className="order-2 sm:order-1">
              Close
            </Button>
            <div className="flex flex-1 flex-col gap-3 sm:order-2 sm:flex-row">
              <Button
                type="submit"
                className="flex-1 bg-orange-500 text-white hover:bg-orange-600"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                  </span>
                ) : (
                  "Submit for review"
                )}
              </Button>
            </div>
          </div>
        </footer>
      </form>
    </div>
  )
}
