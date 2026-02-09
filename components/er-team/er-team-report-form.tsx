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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Pill, User, Activity, AlertCircle, Droplet, CalendarDays, XCircle, X, ArrowLeft, Search, MapPin } from "lucide-react"
import { FRONT_BODY_REGION_IDS, BACK_BODY_REGION_IDS } from "@/components/admin/make-report-form"
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/priority"
import { cn } from "@/lib/utils"
import { saveAsset, loadAsset } from "@/lib/er-team-storage"

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
  _needsSync?: boolean
  updatedAt: string
  synced: boolean
  lastSyncError?: string | null
  submittedAt?: string | null
  patientsPayload: ErTeamPatientPayload[] // Changed from single patientPayload to array
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
  barangays: ReferenceOption[]
  incidentInfo?: {
    reporterName: string
    incidentType: string
    locationAddress: string
  }
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
  // Injury data per patient
  injuryPayload?: InjuryMap
  // Legacy fields for backward compatibility
  firstName?: string
  middleName?: string
  lastName?: string
  suffix?: string
  contactNumber?: string
}

export const DEFAULT_INJURY_TEMPLATE: InjuryMap = {
  front: {},
  back: {},
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
  injuryPayload: DEFAULT_INJURY_TEMPLATE,
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

// Searchable barangay combobox component
function BarangaySearchInput({
  value,
  onChange,
  barangays,
  id,
  label,
  labelClassName,
}: {
  value: string
  onChange: (value: string) => void
  barangays: { id: string; name: string }[]
  id?: string
  label: string
  labelClassName?: string
}) {
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Sync query with external value when value changes and dropdown is closed
  React.useEffect(() => {
    if (!open) setQuery(value)
  }, [value, open])

  const filtered = React.useMemo(() => {
    if (!query.trim()) return barangays
    const q = query.toLowerCase()
    return barangays.filter((b) => b.name.toLowerCase().includes(q))
  }, [query, barangays])

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        // Reset query to selected value if user clicked away without selecting
        if (!barangays.some((b) => b.name === query)) {
          setQuery(value)
        }
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [value, query, barangays])

  return (
    <div ref={containerRef} className="relative">
      <Label htmlFor={id} className={labelClassName}>
        {label}
      </Label>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <Input
          ref={inputRef}
          id={id}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search barangay..."
          className="text-xs sm:text-sm pl-7 h-8"
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => {
              onChange("")
              setQuery("")
              setOpen(true)
              inputRef.current?.focus()
            }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-44 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {filtered.length > 0 ? (
            filtered.map((b) => (
              <button
                key={b.id}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-2 text-xs hover:bg-orange-50 transition-colors flex items-center gap-2",
                  value === b.name && "bg-orange-50 text-orange-700 font-medium"
                )}
                onClick={() => {
                  onChange(b.name)
                  setQuery(b.name)
                  setOpen(false)
                }}
              >
                <MapPin className="w-3 h-3 text-orange-400 flex-shrink-0" />
                {b.name}
              </button>
            ))
          ) : (
            <div className="px-3 py-4 text-xs text-gray-500 text-center">
              {barangays.length === 0 ? "Loading barangays..." : "No matching barangay"}
            </div>
          )}
        </div>
      )}
    </div>
  )
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
      // First check IndexedDB cache
      try {
        const cachedAsset = await loadAsset(svgPath)
        if (cachedAsset && cachedAsset.content && isMounted) {
          console.log(`Loaded SVG from cache: ${svgPath}`)
          setSvgContent(cachedAsset.content)
          return
        }
      } catch (cacheError) {
        console.warn("Failed to load SVG from cache", cacheError)
      }

      // Check in-memory cache
      if (svgContentCache.has(svgPath)) {
        const cached = svgContentCache.get(svgPath)
        if (cached && isMounted) {
          console.log(`Loaded SVG from memory: ${svgPath}`)
          setSvgContent(cached)
          return
        }
      }

      // Fetch from network and cache
      try {
        console.log(`Fetching SVG: ${svgPath}`)
        // Ensure we use the full URL with origin
        const fullUrl = svgPath.startsWith('http') ? svgPath : `${window.location.origin}${svgPath}`
        const response = await fetch(fullUrl, { 
          cache: 'force-cache',
          credentials: 'same-origin'
        })
        if (!response.ok) {
          throw new Error(`Failed to load SVG: ${response.status} ${response.statusText}`)
        }
        const text = await response.text()
        
        if (!text || text.trim().length === 0) {
          throw new Error('SVG content is empty')
        }
        
        console.log(`Successfully loaded SVG: ${svgPath}, length: ${text.length}`)
        svgContentCache.set(svgPath, text)
        if (isMounted) setSvgContent(text)

        // Cache in IndexedDB for offline use
        try {
          await saveAsset(svgPath, text, "image/svg+xml")
          console.log(`Cached SVG in IndexedDB: ${svgPath}`)
        } catch (cacheError) {
          console.warn("Failed to cache SVG in IndexedDB", cacheError)
        }
      } catch (error) {
        console.error(`Error loading ER team body diagram from ${svgPath}:`, error)
        // Set a minimal fallback SVG so it at least shows something
        const fallbackSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><text x="50%" y="50%" text-anchor="middle" fill="#999">Diagram unavailable</text></svg>'
        if (isMounted) setSvgContent(fallbackSvg)
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

const normalizeInjuryView = (source: unknown): Record<string, string[]> => {
  if (!source || typeof source !== "object" || Array.isArray(source)) return {}
  const result: Record<string, string[]> = {}
  for (const [region, codes] of Object.entries(source as Record<string, unknown>)) {
    if (Array.isArray(codes)) {
      result[region] = codes.filter((code): code is string => typeof code === "string")
    }
  }
  return result
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
  barangays,
  incidentInfo,
  onDraftChange,
  onSubmitForReview,
  onClose,
  isSubmitting = false,
}: ErTeamReportFormProps) {
  const [activeTab, setActiveTab] = React.useState<string>("patient")
  const [activePatientIndex, setActivePatientIndex] = React.useState<number>(0)

  const ensurePayloads = React.useCallback(() => {
    const currentDate = format(new Date(), "yyyy-MM-dd")
    
    // Ensure we have at least one patient
    const patientsPayload = Array.isArray(draft.patientsPayload) && draft.patientsPayload.length > 0
      ? draft.patientsPayload.map((patient) => {
          const merged = {
            ...DEFAULT_PATIENT_TEMPLATE,
            ...flattenLegacyPatientPayload(patient),
            ...(patient ?? {}),
          }
          
          // Auto-fill dates if empty
          if (!merged.receivingDate || merged.receivingDate === "") {
            merged.receivingDate = currentDate
          }
          if (!merged.emtErtDate || merged.emtErtDate === "") {
            merged.emtErtDate = currentDate
          }
          
          return merged
        })
      : [
          {
            ...DEFAULT_PATIENT_TEMPLATE,
            // Auto-fill dates for new patients
            receivingDate: currentDate,
            emtErtDate: currentDate,
            // Migrate global injury data to first patient for backward compatibility
            injuryPayload: draft.injuryPayload || DEFAULT_INJURY_TEMPLATE,
            ...flattenLegacyPatientPayload(draft.patientsPayload && draft.patientsPayload[0] ? draft.patientsPayload[0] : {}), // Backward compatibility
          },
        ]

    return { patientsPayload }
  }, [draft.patientsPayload, draft.injuryPayload])

  const { patientsPayload } = ensurePayloads()

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

  // Functions to manage multiple patients
  const addPatient = React.useCallback(() => {
    const newPatient = {
      ...DEFAULT_PATIENT_TEMPLATE,
      receivingDate: format(new Date(), "yyyy-MM-dd"),
      emtErtDate: format(new Date(), "yyyy-MM-dd"),
      injuryPayload: DEFAULT_INJURY_TEMPLATE, // Each patient gets their own injury data
    }
    updateDraft({
      patientsPayload: [...patientsPayload, newPatient]
    })
    setActivePatientIndex(patientsPayload.length)
  }, [patientsPayload, updateDraft])

  const removePatient = React.useCallback((index: number) => {
    if (patientsPayload.length <= 1) return // Keep at least one patient
    const newPatients = patientsPayload.filter((_, i) => i !== index)
    updateDraft({ patientsPayload: newPatients })
    if (activePatientIndex >= newPatients.length) {
      setActivePatientIndex(newPatients.length - 1)
    }
  }, [patientsPayload, activePatientIndex, updateDraft])

  const updatePatient = React.useCallback((index: number, partial: Partial<ErTeamPatientPayload>) => {
    const newPatients = [...patientsPayload]
    newPatients[index] = { ...newPatients[index], ...partial }
    updateDraft({ patientsPayload: newPatients })
  }, [patientsPayload, updateDraft])

  // Get current active patient
  const activePatient = patientsPayload[activePatientIndex] || patientsPayload[0]

  const [diagramView, setDiagramView] = React.useState<InjuryView>("front")
  const [activeRegionSelection, setActiveRegionSelection] = React.useState<{ view: InjuryView; region: string } | null>(null)

  const getInjuryMapForView = React.useCallback(
    (view: InjuryView) => {
      return view === "front" ? activePatient.injuryPayload?.front || {} : activePatient.injuryPayload?.back || {}
    },
    [activePatient.injuryPayload]
  )

  const updateInjuryMap = React.useCallback(
    (view: InjuryView, region: string, codes: string[]) => {
      const currentInjuryPayload = activePatient.injuryPayload || DEFAULT_INJURY_TEMPLATE
      const next = clone(currentInjuryPayload)
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
      updatePatient(activePatientIndex, { injuryPayload: next })
    },
    [activePatient.injuryPayload, activePatientIndex, updatePatient]
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
    Object.entries(activePatient.injuryPayload?.front || {}).forEach(([region, codes]) => {
      const primary = codes[0]
      if (primary) {
        result[region] = INJURY_TYPE_COLOR_MAP[primary] ?? REGION_ACTIVE_STROKE
      }
    })
    return result
  }, [activePatient.injuryPayload?.front])

  const backRegionColors = React.useMemo(() => {
    const result: Record<string, string> = {}
    Object.entries(activePatient.injuryPayload?.back || {}).forEach(([region, codes]) => {
      const primary = codes[0]
      if (primary) {
        result[region] = INJURY_TYPE_COLOR_MAP[primary] ?? REGION_ACTIVE_STROKE
      }
    })
    return result
  }, [activePatient.injuryPayload?.back])

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

  const handleFormSubmit = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()

    // When on patient tab, only navigate to injuries tab - NEVER submit
    if (activeTab === "patient") {
      setActiveTab("injuries")
      return // Explicit return to prevent any submission logic
    }

    // Only submit when on injuries tab
    if (activeTab === "injuries") {
      await onSubmitForReview({
        ...draft,
        patientsPayload,
      })
    }
  }, [activeTab, draft, patientsPayload, onSubmitForReview])

  const getSubmitButtonText = () => {
    if (activeTab === "patient") {
      return "Next"
    } else if (activeTab === "injuries") {
      return isSubmitting ? "Sending…" : "Submit for review"
    }
    return "Submit for review"
  }

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
      updatePatient(activePatientIndex, nextFields)
    },
    [activePatientIndex, updatePatient]
  )

  React.useEffect(() => {
    if (!activePatient.patientBirthday) {
      if (activePatient.patientAge !== DEFAULT_PATIENT_TEMPLATE.patientAge) {
        updatePatient(activePatientIndex, { patientAge: DEFAULT_PATIENT_TEMPLATE.patientAge })
      }
      return
    }
    const parsed = parseISO(activePatient.patientBirthday)
    if (!isValid(parsed)) {
      if (activePatient.patientAge !== DEFAULT_PATIENT_TEMPLATE.patientAge) {
        updatePatient(activePatientIndex, { patientAge: DEFAULT_PATIENT_TEMPLATE.patientAge })
      }
      return
    }
    const years = differenceInYears(new Date(), parsed)
    if (!Number.isNaN(years) && years >= 0 && String(years) !== activePatient.patientAge) {
      updatePatient(activePatientIndex, { patientAge: String(years) })
    }
  }, [activePatient.patientBirthday, activePatient.patientAge, activePatientIndex, updatePatient])

  const handleNotesChange = React.useCallback(
    (value: string) => {
      updateDraft({ notes: value })
    },
    [updateDraft]
  )

  const statusMeta = STATUS_BADGE[draft.status]

  // Auto-scroll focused input into view when mobile keyboard appears
  React.useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null
    if (!vv) return

    const handleResize = () => {
      const active = document.activeElement as HTMLElement | null
      if (
        active &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")
      ) {
        // Small delay to let the keyboard settle
        setTimeout(() => {
          active.scrollIntoView({ behavior: "smooth", block: "center" })
        }, 100)
      }
    }

    vv.addEventListener("resize", handleResize)
    return () => vv.removeEventListener("resize", handleResize)
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <header className="border-b border-orange-100 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500 px-3 py-2 text-white sm:px-6 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded-full hover:bg-white/20 transition-colors p-1.5"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate sm:text-base">Patient Care Report</h2>
            <div className="flex items-center gap-2 text-[10px] text-orange-100 sm:text-xs">
              {incidentInfo?.incidentType && <span>{incidentInfo.incidentType}</span>}
              {incidentInfo?.incidentType && incidentInfo?.locationAddress && <span>•</span>}
              {incidentInfo?.locationAddress && <span className="truncate">{incidentInfo.locationAddress}</span>}
            </div>
          </div>
          <Badge className={cn(statusMeta.className, "text-[10px] px-1.5 py-0")}>{statusMeta.label}</Badge>
        </div>
      </header>

      <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
          <div className="border-b border-gray-100 px-3 pt-2 sm:px-6 sm:pt-3">
            <TabsList className="grid grid-cols-2 rounded-xl bg-gray-100 p-1 text-[10px] sm:text-xs">
              <TabsTrigger value="patient" className="flex items-center justify-center gap-1">
                <User className="h-3 w-3" /> Patient
              </TabsTrigger>
              <TabsTrigger value="injuries" className="flex items-center justify-center gap-1">
                <Activity className="h-3 w-3" /> Injuries
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="patient" className="flex-1 overflow-y-auto px-3 py-3 sm:px-6 sm:py-5">
            <section className="space-y-3 sm:space-y-4">
              {/* Patient Tabs */}
              <div className="flex items-center justify-between">
                <Tabs value={`patient-${activePatientIndex}`} className="flex-1">
                  <TabsList className="grid grid-cols-4 gap-1">
                    {patientsPayload.map((_, index) => (
                      <TabsTrigger
                        key={index}
                        value={`patient-${index}`}
                        onClick={() => setActivePatientIndex(index)}
                        className="text-xs"
                      >
                        Patient {index + 1}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPatient}
                  className="ml-2"
                >
                  <User className="mr-1 h-4 w-4" />
                  Add Patient
                </Button>
              </div>

              {/* Remove Patient Button (only show if more than 1 patient) */}
              {patientsPayload.length > 1 && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removePatient(activePatientIndex)}
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    Remove Patient {activePatientIndex + 1}
                  </Button>
                </div>
              )}

              <Card className="border-none shadow-sm">
                <CardContent className="space-y-4 pt-3 sm:space-y-6 sm:pt-4">
                  <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 sm:gap-4 sm:text-xs">
                    <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> Patient details</span>
                    <span className="inline-flex items-center gap-1"><Pill className="h-3 w-3" /> Medical info</span>
                    <span className="inline-flex items-center gap-1"><Droplet className="h-3 w-3" /> Vitals</span>
                  </div>
                  <div className="grid gap-3 sm:gap-6 md:grid-cols-2">
                    <div>
                      <Label htmlFor="patient-name" className="block text-xs font-medium text-gray-700 mb-1 sm:text-sm">
                        Full name
                      </Label>
                      <Input
                        id="patient-name"
                        value={activePatient.patientName}
                        onChange={(event) => updatePatient(activePatientIndex, { patientName: event.target.value })}
                        placeholder="Juan Dela Cruz"
                        required
                        className="text-xs sm:text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="patient-number" className="block text-xs font-medium text-gray-700 mb-1 sm:text-sm">
                        Contact number
                      </Label>
                      <Input
                        id="patient-number"
                        value={activePatient.patientNumber}
                        onChange={(event) => updatePatient(activePatientIndex, { patientNumber: event.target.value.replace(/[^0-9]/g, "").slice(0, 11) })}
                        inputMode="tel"
                        placeholder="09XX XXX XXXX"
                        required
                        className="text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:gap-6 md:grid-cols-3">
                    <DatePickerField
                      id="patient-birthday"
                      label="Birthday"
                      value={activePatient.patientBirthday}
                      onChange={handleBirthdayChange}
                      required
                      initialFocus
                      captionLayout="dropdown"
                      fromYear={1950}
                      toYear={new Date().getFullYear()}
                    />
                    <div>
                      <Label htmlFor="patient-age" className="block text-xs font-medium text-gray-700 mb-1 sm:text-sm">
                        Age
                      </Label>
                      <Input
                        id="patient-age"
                        type="number"
                        min="0"
                        value={activePatient.patientAge}
                        readOnly
                        required
                        className="text-xs sm:text-sm"
                      />
                    </div>
                    <div>
                      <Label className="block text-xs font-medium text-gray-700 mb-1 sm:text-sm">Sex</Label>
                      <div className="flex items-center gap-2 sm:gap-3">
                        {(["male", "female"] as const).map((sexOption) => (
                          <label key={sexOption} className="inline-flex items-center gap-1 text-[10px] text-gray-700 sm:gap-2 sm:text-sm">
                            <Checkbox
                              checked={activePatient.patientSex === sexOption}
                              onCheckedChange={(checked) => updatePatient(activePatientIndex, { patientSex: checked ? sexOption : "" })}
                            />
                            {sexOption.charAt(0).toUpperCase() + sexOption.slice(1)}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:gap-6 md:grid-cols-2">
                    <div>
                      <Label htmlFor="patient-address" className="block text-xs font-medium text-gray-700 mb-1 sm:text-sm">
                        Address / Landmark
                      </Label>
                      <Textarea
                        id="patient-address"
                        value={activePatient.patientAddress}
                        onChange={(event) => updatePatient(activePatientIndex, { patientAddress: event.target.value })}
                        rows={2}
                        required
                        className="text-xs sm:text-sm"
                      />
                    </div>
                    <BarangaySearchInput
                      id="incident-location-patient"
                      label="Incident location (Barangay)"
                      labelClassName="block text-xs font-medium text-gray-700 mb-1 sm:text-sm"
                      value={activePatient.incidentLocation ?? ""}
                      onChange={(val) => updatePatient(activePatientIndex, { incidentLocation: val })}
                      barangays={barangays}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardContent className="space-y-2 pt-3 sm:space-y-3 sm:pt-4">
                  <p className="text-xs font-medium text-gray-800 sm:text-sm">Vitals</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                    <div>
                      <Label htmlFor="loc-avpu" className="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs">
                        LOC / AVPU
                      </Label>
                      <Input
                        id="loc-avpu"
                        value={activePatient.locAvpu}
                        onChange={(event) => updatePatient(activePatientIndex, { locAvpu: event.target.value })}
                        placeholder="e.g., Alert"
                        className="text-xs sm:text-sm h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="pulse-rate" className="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs">
                        Pulse Rate
                      </Label>
                      <Input
                        id="pulse-rate"
                        inputMode="numeric"
                        value={activePatient.pulseRate}
                        onChange={(event) => updatePatient(activePatientIndex, { pulseRate: event.target.value.replace(/[^0-9]/g, "") })}
                        placeholder="bpm"
                        className="text-xs sm:text-sm h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bpm" className="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs">
                        BPM
                      </Label>
                      <Input
                        id="bpm"
                        inputMode="numeric"
                        value={activePatient.bpm}
                        onChange={(event) => updatePatient(activePatientIndex, { bpm: event.target.value.replace(/[^0-9]/g, "") })}
                        placeholder="Beats per minute"
                        className="text-xs sm:text-sm h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="blood-pressure" className="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs">
                        Blood pressure
                      </Label>
                      <Input
                        id="blood-pressure"
                        value={activePatient.bloodPressure}
                        onChange={(event) => updatePatient(activePatientIndex, { bloodPressure: event.target.value })}
                        placeholder="e.g., 120/80"
                        className="text-xs sm:text-sm h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="respiratory-rate" className="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs">
                        Respiratory rate
                      </Label>
                      <Input
                        id="respiratory-rate"
                        inputMode="numeric"
                        value={activePatient.respiratoryRate}
                        onChange={(event) => updatePatient(activePatientIndex, { respiratoryRate: event.target.value.replace(/[^0-9]/g, "") })}
                        placeholder="e.g., 16"
                        className="text-xs sm:text-sm h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="oxygen-saturation" className="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs">
                        Oxygen saturation (%)
                      </Label>
                      <Input
                        id="oxygen-saturation"
                        inputMode="numeric"
                        value={activePatient.oxygenSaturation}
                        onChange={(event) => updatePatient(activePatientIndex, { oxygenSaturation: event.target.value.replace(/[^0-9]/g, "") })}
                        placeholder="e.g., 98"
                        className="text-xs sm:text-sm h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="temperature" className="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs">
                        Temperature (°C)
                      </Label>
                      <Input
                        id="temperature"
                        inputMode="decimal"
                        value={activePatient.temperature}
                        onChange={(event) => updatePatient(activePatientIndex, { temperature: event.target.value.replace(/[^0-9.]/g, "") })}
                        placeholder="e.g., 36.5"
                        className="text-xs sm:text-sm h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="pain-scale" className="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs">
                        Pain scale (0-10)
                      </Label>
                      <Input
                        id="pain-scale"
                        inputMode="numeric"
                        value={activePatient.painScale}
                        onChange={(event) => updatePatient(activePatientIndex, { painScale: event.target.value.replace(/[^0-9]/g, "").slice(0, 2) })}
                        className="text-xs sm:text-sm h-8"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
                    <div className="rounded-lg border shadow-sm p-2 space-y-2 sm:p-4 sm:space-y-3">
                      <p className="text-xs font-semibold text-gray-700 sm:text-sm">Glasgow Coma Scale (GCS)</p>
                      <div className="space-y-2 sm:space-y-3">
                        <div>
                          <Label className="text-[10px] font-semibold text-gray-600 mb-1 block sm:text-xs sm:mb-2">Eye (4-1)</Label>
                          <div className="grid grid-cols-4 gap-1 sm:gap-2">
                            {["4", "3", "2", "1"].map((value) => (
                              <Button
                                key={value}
                                type="button"
                                variant={activePatient.gcsEye === value ? "default" : "outline"}
                                className={cn(
                                  "py-1 text-xs sm:py-2 sm:text-sm",
                                  activePatient.gcsEye === value ? "bg-orange-500 text-white" : "bg-white text-gray-700 hover:bg-gray-50",
                                )}
                                onClick={() => updatePatient(activePatientIndex, { gcsEye: value })}
                              >
                                {value}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="text-[10px] font-semibold text-gray-600 mb-1 block sm:text-xs sm:mb-2">Verbal (5-1)</Label>
                          <div className="grid grid-cols-5 gap-1 sm:gap-2">
                            {["5", "4", "3", "2", "1"].map((value) => (
                              <Button
                                key={value}
                                type="button"
                                variant={activePatient.gcsVerbal === value ? "default" : "outline"}
                                className={cn(
                                  "py-1 text-xs sm:py-2 sm:text-sm",
                                  activePatient.gcsVerbal === value ? "bg-orange-500 text-white" : "bg-white text-gray-700 hover:bg-gray-50",
                                )}
                                onClick={() => updatePatient(activePatientIndex, { gcsVerbal: value })}
                              >
                                {value}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="text-[10px] font-semibold text-gray-600 mb-1 block sm:text-xs sm:mb-2">Motor (6-1)</Label>
                          <div className="grid grid-cols-6 gap-1 sm:gap-2">
                            {["6", "5", "4", "3", "2", "1"].map((value) => (
                              <Button
                                key={value}
                                type="button"
                                variant={activePatient.gcsMotor === value ? "default" : "outline"}
                                className={cn(
                                  "py-1 text-xs sm:py-2 sm:text-sm",
                                  activePatient.gcsMotor === value ? "bg-orange-500 text-white" : "bg-white text-gray-700 hover:bg-gray-50",
                                )}
                                onClick={() => updatePatient(activePatientIndex, { gcsMotor: value })}
                              >
                                {value}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-md bg-gray-50 px-2 py-1 sm:px-3 sm:py-2">
                        <span className="text-xs font-semibold text-gray-700 sm:text-sm">Total GCS</span>
                        <span className="text-sm font-bold text-gray-900 sm:text-lg">
                          {Number(activePatient.gcsEye || 0) + Number(activePatient.gcsVerbal || 0) + Number(activePatient.gcsMotor || 0)}
                        </span>
                      </div>
                      <div>
                        <Label htmlFor="gcs-other" className="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs">
                          Other remarks
                        </Label>
                        <Textarea
                          id="gcs-other"
                          value={activePatient.gcsOther}
                          onChange={(event) => updatePatient(activePatientIndex, { gcsOther: event.target.value })}
                          rows={2}
                          className="text-xs sm:text-sm"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border shadow-sm p-2 space-y-3 sm:p-4 sm:space-y-4">
                      <p className="text-xs font-semibold text-gray-700 sm:text-sm">Primary survey</p>
                      <div className="grid grid-cols-1 gap-2 sm:gap-3">
                        <div className="rounded-lg border shadow-sm p-2 sm:p-3">
                          <p className="text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs sm:mb-2">Airway (A)</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2">
                            {AIRWAY_OPTIONS.map((option) => (
                              <Button
                                key={option}
                                type="button"
                                variant={activePatient.airwaySelections.includes(option) ? "default" : "outline"}
                                className={cn(
                                  "justify-start text-[10px] py-1 sm:text-xs sm:py-2",
                                  activePatient.airwaySelections.includes(option)
                                    ? "bg-orange-100 text-orange-700 border-orange-400"
                                    : "bg-white text-gray-700 hover:bg-gray-50",
                                )}
                                onClick={() => {
                                  const existing = activePatient.airwaySelections
                                  const next = existing.includes(option)
                                    ? existing.filter((item) => item !== option)
                                    : [...existing, option]
                                  updatePatient(activePatientIndex, { airwaySelections: next })
                                }}
                              >
                                {option}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-lg border shadow-sm p-2 sm:p-3">
                          <p className="text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs sm:mb-2">Breathing (B)</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2">
                            {BREATHING_OPTIONS.map((option) => (
                              <Button
                                key={option}
                                type="button"
                                variant={activePatient.breathingSelections.includes(option) ? "default" : "outline"}
                                className={cn(
                                  "justify-start text-[10px] py-1 sm:text-xs sm:py-2",
                                  activePatient.breathingSelections.includes(option)
                                    ? "bg-orange-100 text-orange-700 border-orange-400"
                                    : "bg-white text-gray-700 hover:bg-gray-50",
                                )}
                                onClick={() => {
                                  const existing = activePatient.breathingSelections
                                  const next = existing.includes(option)
                                    ? existing.filter((item) => item !== option)
                                    : [...existing, option]
                                  updatePatient(activePatientIndex, { breathingSelections: next })
                                }}
                              >
                                {option}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-lg border shadow-sm p-2 sm:p-3">
                          <p className="text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs sm:mb-2">Circulation (C)</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2">
                            {CIRCULATION_OPTIONS.map((option) => (
                              <Button
                                key={option}
                                type="button"
                                variant={activePatient.circulationSelections.includes(option) ? "default" : "outline"}
                                className={cn(
                                  "justify-start text-[10px] py-1 sm:text-xs sm:py-2",
                                  activePatient.circulationSelections.includes(option)
                                    ? "bg-orange-100 text-orange-700 border-orange-400"
                                    : "bg-white text-gray-700 hover:bg-gray-50",
                                )}
                                onClick={() => {
                                  const existing = activePatient.circulationSelections
                                  const next = existing.includes(option)
                                    ? existing.filter((item) => item !== option)
                                    : [...existing, option]
                                  updatePatient(activePatientIndex, { circulationSelections: next })
                                }}
                              >
                                {option}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                        <BarangaySearchInput
                          id="incident-location-survey"
                          label="Incident Location"
                          labelClassName="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs"
                          value={activePatient.incidentLocation ?? ""}
                          onChange={(val) => updatePatient(activePatientIndex, { incidentLocation: val })}
                          barangays={barangays}
                        />
                        <div className="md:col-span-2">
                          <Label className="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs">Evacuation priority</Label>
                          <div className="grid grid-cols-2 gap-1 sm:gap-2">
                            {PRIORITY_LABELS.map((priority) => (
                              <Button
                                key={priority.value}
                                type="button"
                                variant={activePatient.evacPriority === priority.value ? "default" : "outline"}
                                className={cn(
                                  "justify-start text-[10px] py-1 sm:text-xs sm:py-2",
                                  activePatient.evacPriority === priority.value
                                    ? priority.value === "4"
                                      ? "bg-black text-white border-transparent"  // Pure black background for Priority 4
                                      : `${PRIORITY_COLORS[priority.value]} text-white border-transparent`
                                    : "bg-white text-gray-700 hover:bg-gray-50",
                                )}
                                onClick={() =>
                                  updatePatient(activePatientIndex, {
                                    evacPriority: activePatient.evacPriority === priority.value ? "" : priority.value,
                                  })
                                }
                              >
                                <span
                                  className={cn(
                                    "inline-flex h-2 w-2 rounded-full mr-1 sm:mr-2",
                                    activePatient.evacPriority === priority.value
                                      ? priority.value === "4"
                                        ? "bg-black"  // Keep black for Priority 4 when selected
                                        : "bg-white"  // White for other priorities when selected
                                      : priority.value === "2"
                                        ? "bg-yellow-400"
                                        : priority.value === "4"
                                          ? "bg-black"
                                          : "bg-red-500",
                                  )}
                                />
                                <span className="text-left">
                                  <span className="block text-[10px] font-semibold sm:text-sm">{priority.label}</span>
                                  <span className={cn("text-[9px] sm:text-[11px]", activePatient.evacPriority === priority.value ? "text-white/80" : "text-gray-500")}>
                                    {priority.description}
                                  </span>
                                </span>
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="moi-poi-toi" className="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs">
                            MOI / POI / TOI
                          </Label>
                          <Textarea
                            id="moi-poi-toi"
                            value={activePatient.moiPoiToi}
                            onChange={(event) => updatePatient(activePatientIndex, { moiPoiToi: event.target.value })}
                            rows={2}
                            required
                            className="text-xs sm:text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="noi" className="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs">
                            NOI (Nature of injury)
                          </Label>
                          <Textarea
                            id="noi"
                            value={activePatient.noi}
                            onChange={(event) => updatePatient(activePatientIndex, { noi: event.target.value })}
                            rows={2}
                            className="text-xs sm:text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="signs-symptoms" className="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs">
                            Signs & symptoms
                          </Label>
                          <Textarea
                            id="signs-symptoms"
                            value={activePatient.signsSymptoms}
                            onChange={(event) => updatePatient(activePatientIndex, { signsSymptoms: event.target.value })}
                            rows={2}
                            required
                            className="text-xs sm:text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs sm:mb-2">Emergency category</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 sm:gap-2">
                          {EMERGENCY_CATEGORY_OPTIONS.map((option) => (
                            <Button
                              key={option}
                              type="button"
                              variant={activePatient.typeOfEmergencySelections.includes(option) ? "default" : "outline"}
                              className={cn(
                                "justify-start text-[10px] py-1 sm:text-xs sm:py-2",
                                activePatient.typeOfEmergencySelections.includes(option)
                                  ? "bg-orange-500 text-white"
                                  : "bg-white text-gray-700 hover:bg-gray-50",
                              )}
                              onClick={() => {
                                const existing = activePatient.typeOfEmergencySelections
                                const next = existing.includes(option)
                                  ? existing.filter((item) => item !== option)
                                  : [...existing, option]
                                updatePatient(activePatientIndex, { typeOfEmergencySelections: next })
                              }}
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border shadow-sm p-2 space-y-3 sm:p-4 sm:space-y-4">
                    <p className="text-xs font-semibold text-gray-700 sm:text-sm">Transport & turnover</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                      <div>
                        <Label htmlFor="receiving-hospital" className="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs">
                          Receiving hospital
                        </Label>
                        <Select
                          value={activePatient.receivingHospitalId ?? ""}
                          onValueChange={(value: string) => updatePatient(activePatientIndex, { receivingHospitalId: value })}
                        >
                          <SelectTrigger id="receiving-hospital" className="text-xs sm:text-sm">
                            <SelectValue placeholder="Select hospital" />
                          </SelectTrigger>
                          <SelectContent className="max-h-56 overflow-y-auto">
                            {hospitals.length > 0 ? (
                              hospitals.map((hospital) => (
                                <SelectItem key={hospital.id} value={String(hospital.id)}>
                                  {hospital.name}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="px-2 py-4 text-xs text-gray-500 text-center">
                                Loading hospitals...
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <DatePickerField
                          id="receiving-date"
                          label="Receiving date"
                          value={activePatient.receivingDate}
                          onChange={(next) => updatePatient(activePatientIndex, { receivingDate: next })}
                          required
                        />
                      </div>
                      <div>
                        <DatePickerField
                          id="emt-date"
                          label="EMT/ERT date"
                          value={activePatient.emtErtDate}
                          onChange={(next) => updatePatient(activePatientIndex, { emtErtDate: next })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="turnover-in-charge" className="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs">
                          Turnover in-charge
                        </Label>
                        <Input
                          id="turnover-in-charge"
                          value={activePatient.turnoverInCharge}
                          onChange={(event) => updatePatient(activePatientIndex, { turnoverInCharge: event.target.value })}
                          required
                          className="text-xs sm:text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="blood-loss" className="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs sm:mb-2">
                          Blood loss level
                        </Label>
                        <div className="flex flex-wrap gap-1 sm:gap-2">
                          {BLOOD_LOSS_OPTIONS.map((option) => (
                            <Button
                              key={option}
                              type="button"
                              variant={activePatient.bloodLossLevel === option ? "default" : "outline"}
                              className={cn(
                                "px-2 py-1 text-[10px] sm:px-4 sm:py-2 sm:text-xs",
                                activePatient.bloodLossLevel === option
                                  ? "bg-orange-500 text-white"
                                  : "bg-white text-gray-700 hover:bg-gray-50",
                              )}
                              onClick={() => updatePatient(activePatientIndex, { bloodLossLevel: activePatient.bloodLossLevel === option ? "" : option })}
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="estimated-blood-loss" className="block text-[10px] font-semibold text-gray-600 mb-1 sm:text-xs">
                          Estimated blood loss (L)
                        </Label>
                        <Input
                          id="estimated-blood-loss"
                          inputMode="decimal"
                          value={activePatient.estimatedBloodLoss}
                          onChange={(event) => updatePatient(activePatientIndex, { estimatedBloodLoss: event.target.value.replace(/[^0-9.]/g, "") })}
                          placeholder="e.g., 0.5"
                          className="text-xs sm:text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="injuries" className="flex-1 overflow-y-auto px-3 py-3 sm:px-6 sm:py-5">
            <section className="space-y-3 sm:space-y-4">
              {/* Patient Tabs */}
              <div className="flex items-center justify-between">
                <Tabs value={`patient-${activePatientIndex}`} className="flex-1">
                  <TabsList className="grid grid-cols-4 gap-1">
                    {patientsPayload.map((_, index) => (
                      <TabsTrigger
                        key={index}
                        value={`patient-${index}`}
                        onClick={() => setActivePatientIndex(index)}
                        className="text-[10px] sm:text-xs"
                      >
                        Patient {index + 1}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPatient}
                  className="ml-2 text-xs sm:text-sm"
                >
                  <User className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Add Patient</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </div>

              {/* Remove Patient Button (only show if more than 1 patient) */}
              {patientsPayload.length > 1 && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removePatient(activePatientIndex)}
                    className="text-xs sm:text-sm"
                  >
                    <XCircle className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                    Remove Patient {activePatientIndex + 1}
                  </Button>
                </div>
              )}

              <Card className="border-none shadow-sm">
                <CardContent className="space-y-3 pt-3 sm:space-y-5 sm:pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-gray-800 sm:text-sm">Tap body regions to log injuries</p>
                      <p className="text-[10px] text-gray-500 sm:text-xs">Colors indicate the most severe injury logged on each region.</p>
                    </div>
                  </div>
                  <Tabs value={diagramView} onValueChange={handleChangeDiagramView} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 rounded-xl bg-gray-100 p-1 text-[10px] sm:text-sm">
                      <TabsTrigger value="front">Front</TabsTrigger>
                      <TabsTrigger value="back">Back</TabsTrigger>
                    </TabsList>
                    <TabsContent value="front" className="mt-3 sm:mt-4">
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
                    <TabsContent value="back" className="mt-3 sm:mt-4">
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
                  <div className="space-y-1 text-[10px] text-gray-600 sm:space-y-2 sm:text-xs">
                    <p className="font-semibold text-gray-700">Legend</p>
                    <div className="flex flex-wrap gap-1 sm:gap-2">
                      {INJURY_TYPE_OPTIONS.map((option) => (
                        <span key={option.code} className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 sm:px-3 sm:py-1">
                          <span
                            className="inline-flex h-2 w-2 rounded-full"
                            style={{ backgroundColor: INJURY_TYPE_COLOR_MAP[option.code] }}
                          />
                          <span className="text-[9px] sm:text-xs">{option.label}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Dialog open={Boolean(activeRegionSelection)} onOpenChange={(open) => !open && setActiveRegionSelection(null)}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      Select injuries for {activeRegionSelection ? normalizeRegionLabel(activeRegionSelection.region) : ""}
                    </DialogTitle>
                    <DialogDescription>
                      Choose all applicable injury types for this body region.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      {INJURY_TYPE_OPTIONS.map((option) => {
                        const isActive = activeRegionInjuries.includes(option.code)
                        return (
                          <Button
                            key={option.code}
                            type="button"
                            variant={isActive ? "default" : "outline"}
                            className={cn(
                              "justify-start",
                              isActive
                                ? "bg-orange-500 text-white hover:bg-orange-600"
                                : "bg-white text-gray-700 hover:bg-gray-50",
                            )}
                            onClick={() => handleToggleInjury(option.code)}
                          >
                            <span
                              className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full"
                              style={{ backgroundColor: INJURY_TYPE_COLOR_MAP[option.code], color: "#fff" }}
                            >
                              {option.code}
                            </span>
                            {option.label}
                          </Button>
                        )
                      })}
                    </div>
                    {activeRegionInjuries.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <p className="text-sm font-medium text-gray-700 w-full">Selected injuries:</p>
                        {activeRegionInjuries.map((code) => (
                          <Badge key={code} className="bg-orange-100 text-orange-700">
                            {INJURY_TYPE_OPTIONS.find((option) => option.code === code)?.label ?? code}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between gap-2">
                    <Button type="button" variant="outline" onClick={handleClearRegionInjuries}>
                      Clear region
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setActiveRegionSelection(null)}>
                      Done
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>


              <Card className="border-none shadow-sm">
                <CardContent className="space-y-4 pt-4">
                  <p className="text-sm font-semibold text-gray-800">Logged injuries summary</p>
                  <div className="space-y-3 text-xs text-gray-600">
                    <InjurySummaryList view="front" regionMap={activePatient.injuryPayload?.front || {}} />
                    <InjurySummaryList view="back" regionMap={activePatient.injuryPayload?.back || {}} />
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
                  getSubmitButtonText()
                )}
              </Button>
            </div>
          </div>
        </footer>
      </form>
    </div>
  )
}
