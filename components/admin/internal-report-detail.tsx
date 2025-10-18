"use client"

import * as React from "react"
import Image from "next/image"
import { format } from "date-fns"
import tinycolor from "tinycolor2"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

import { Button } from "@/components/ui/button"

const FRONT_BODY_REGION_IDS = [
  "front_x3D__x22_right-thigh_x22_",
  "front_x3D__x22_left-thigh_x22_",
  "stomach",
  "front_x3D__x22_right-foot",
  "front_x3D__x22_left-foot_x22_",
  "front_x3D__x22_right-chest_x22_",
  "front_x3D__x22_left-chest_x22_",
  "front_x3D__x22_face_x22_",
  "front_x3D__x22_right-forearm_x22_",
  "front_x3D__x22_left_x5F_forearm_x22_",
  "front_x3D__x22_right-ribs_x22_",
  "front_x3D__x22_left_x5F_ribs_x22_",
  "front_x3D__x22_belly_x22_",
  "front_x3D__x22_left_x5F_arm_x22_",
  "front_x3D__x22_right-arm_x22_",
  "front_x3D__x22_neck_x22_",
  "front_x3D__x22_right-shoulder_x22_",
  "front_x3D__x22_left-shoulder_x22_",
  "front_x3D__x22_right-knee_x22_",
  "front_x3D__x22_left-knee_x22_",
  "front_x3D__x22_upper-head_x22_",
  "front_x3D__x22_right-hand_x22_",
  "front_x3D__x22_left-hand_x22_",
  "front_x3D__x22_right-neck_x22_",
  "front_x3D__x22_left_x5F_neck_x22_",
  "front_x3D__x22_right-finger_x22_",
  "front_x3D__x22_left-finger_x22_",
  "front-_x22_right-ankle_x22_",
  "front_x3D__x22_left-ankle_x22_",
  "front_x3D__x22_right-wrist_x22_",
  "front_x3D__x22_left-wrist_x22_",
  "front_x3D__x22_right-eyes_x22_",
  "front_x3D__x22_left-eye_x22_",
  "front_x3D__x22_mouth_x22_",
  "front_x3D__x22_chin_x22_",
  "front_x3D__x22_nose_x22_",
] as const

const BACK_BODY_REGION_IDS = [
  "back_x3D__x22_right-hand_x22_",
  "back_x3D__x22_right-thigh_x22_",
  "back_x3D__x22_left-thigh_x22_",
  "back_x3D__x22_left-ribs_x22_",
  "back_x3D__x22_right-ribs_x22_",
  "back_x3D__x22_head_x22_",
  "back_x3D__x22_lower-back_x22_",
  "back_x3D__x22_left-buttocks_x22_",
  "back_x3D__x22_right-buttocks_x22_",
  "back_x3D__x22_left-foot_x22_",
  "back_x3D__x22_right-foot_x22_",
  "back_x3D__x22_left-forearm_x22_",
  "back_x3D__x22_right-forearm_x22_",
  "back_x3D__x22_mid-back_x22_",
  "back_x3D__x22_right-calf_x22_",
  "back_x3D__x22_left-calf_x22_",
  "back_x22_right-upper-arm_x22_",
  "back_x3D__x22_left-upper-arm_x22_",
  "back_x3D__x22_upper-back_x22_",
  "back_x3D__x22_left-shoulder_x22_",
  "back_x3D__x22_right-shoulder_x22_",
  "back_x22_right-knee_x22_",
  "back_x3D__x22_left-knee_x22_",
  "back_x3D__x22_neck_x22_",
  "back_x3D__x22_left-hand_x22_",
  "back_x3D__x22_right-finger_x22_",
  "back_x3D__x22_left-finger_x22_",
  "back_x3D__x22_left-ears_x22_",
  "back_x3D__x22_right-ears_x22_",
  "back-_x22_right-ankle_x22_",
  "back_x3D__x22_left-ankle_x22_",
  "back_x3D__x22_left-elbow_x22_",
  "back_x3D__x22_right-elbow_x22_",
] as const

const FRONT_SVG_PATH = "/body_part_front-01.svg"
const BACK_SVG_PATH = "/body_part_back-01.svg"

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
  "front_x3D__x22_belly_x22_": "Front Lower Abdomen",
  "front_x3D__x22_left_x5F_arm_x22_": "Front Left Upper Arm",
  "front_x3D__x22_right-arm_x22_": "Front Right Upper Arm",
  "front_x3D__x22_neck_x22_": "Front Neck",
  "front_x3D__x22_right-shoulder_x22_": "Front Right Shoulder",
  "front_x3D__x22_left-shoulder_x22_": "Front Left Shoulder",
  "front_x3D__x22_right-knee_x22_": "Front Right Knee",
  "front_x3D__x22_left-knee_x22_": "Front Left Knee",
  "front_x3D__x22_upper-head_x22_": "Top of Head (Front)",
  "front_x3D__x22_right-hand_x22_": "Front Right Hand",
  "front_x3D__x22_left-hand_x22_": "Front Left Hand",
  "front_x3D__x22_right-neck_x22_": "Front Right Neck",
  "front_x3D__x22_left_x5F_neck_x22_": "Front Left Neck",
  "front_x3D__x22_right-finger_x22_": "Front Right Fingers",
  "front_x3D__x22_left-finger_x22_": "Front Left Fingers",
  "front-_x22_right-ankle_x22_": "Front Right Ankle",
  "front_x3D__x22_left-ankle_x22_": "Front Left Ankle",
  "front_x3D__x22_right-wrist_x22_": "Front Right Wrist",
  "front_x3D__x22_left-wrist_x22_": "Front Left Wrist",
  "front_x3D__x22_right-eyes_x22_": "Right Eye",
  "front_x3D__x22_left-eye_x22_": "Left Eye",
  "front_x3D__x22_mouth_x22_": "Mouth",
  "front_x3D__x22_chin_x22_": "Chin",
  "front_x3D__x22_nose_x22_": "Nose",
  "back_x3D__x22_right-hand_x22_": "Back Right Hand",
  "back_x3D__x22_right-thigh_x22_": "Back Right Thigh",
  "back_x3D__x22_left-thigh_x22_": "Back Left Thigh",
  "back_x3D__x22_left-ribs_x22_": "Back Left Ribs",
  "back_x3D__x22_right-ribs_x22_": "Back Right Ribs",
  "back_x3D__x22_head_x22_": "Back Head",
  "back_x3D__x22_lower-back_x22_": "Lower Back",
  "back_x3D__x22_left-buttocks_x22_": "Left Buttock",
  "back_x3D__x22_right-buttocks_x22_": "Right Buttock",
  "back_x3D__x22_left-foot_x22_": "Back Left Foot",
  "back_x3D__x22_right-foot_x22_": "Back Right Foot",
  "back_x3D__x22_left-forearm_x22_": "Back Left Forearm",
  "back_x3D__x22_right-forearm_x22_": "Back Right Forearm",
  "back_x3D__x22_mid-back_x22_": "Mid Back",
  "back_x3D__x22_right-calf_x22_": "Back Right Calf",
  "back_x3D__x22_left-calf_x22_": "Back Left Calf",
  "back_x22_right-upper-arm_x22_": "Back Right Upper Arm",
  "back_x3D__x22_left-upper-arm_x22_": "Back Left Upper Arm",
  "back_x3D__x22_upper-back_x22_": "Upper Back",
  "back_x3D__x22_left-shoulder_x22_": "Back Left Shoulder",
  "back_x3D__x22_right-shoulder_x22_": "Back Right Shoulder",
  "back_x22_right-knee_x22_": "Back Right Knee",
  "back_x3D__x22_left-knee_x22_": "Back Left Knee",
  "back_x3D__x22_neck_x22_": "Back Neck",
  "back_x3D__x22_left-hand_x22_": "Back Left Hand",
  "back_x3D__x22_right-finger_x22_": "Back Right Fingers",
  "back_x3D__x22_left-finger_x22_": "Back Left Fingers",
  "back_x3D__x22_left-ears_x22_": "Left Ear (Back)",
  "back_x3D__x22_right-ears_x22_": "Right Ear (Back)",
  "back-_x22_right-ankle_x22_": "Back Right Ankle",
  "back_x3D__x22_left-ankle_x22_": "Back Left Ankle",
  "back_x3D__x22_left-elbow_x22_": "Back Left Elbow",
  "back_x3D__x22_right-elbow_x22_": "Back Right Elbow",
}

const REGION_LABEL_TO_ID = Object.entries(REGION_LABELS).reduce<Record<string, string>>((acc, [regionId, label]) => {
  acc[label] = regionId
  return acc
}, {})

const INJURY_TYPE_OPTIONS = [
  { code: "D", label: "Deformities", shortLabel: "Deformity" },
  { code: "C", label: "Contusions", shortLabel: "Contusion" },
  { code: "A", label: "Abrasions", shortLabel: "Abrasion" },
  { code: "P", label: "Penetrations", shortLabel: "Penetration" },
  { code: "B", label: "Burns", shortLabel: "Burn" },
  { code: "T", label: "Tenderness", shortLabel: "Tenderness" },
  { code: "L", label: "Lacerations", shortLabel: "Laceration" },
  { code: "S", label: "Swelling", shortLabel: "Swelling" },
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

const INJURY_TYPE_LOOKUP = INJURY_TYPE_OPTIONS.reduce<Record<string, { code: string; label: string; shortLabel: string }>>((acc, option) => {
  acc[option.code] = option
  return acc
}, {})

const INJURY_LABEL_TO_CODE = INJURY_TYPE_OPTIONS.reduce<Record<string, string>>((acc, option) => {
  acc[option.label.toLowerCase()] = option.code
  acc[option.shortLabel.toLowerCase()] = option.code
  return acc
}, {})

const blendColors = (colors: string[]): string => {
  if (colors.length === 0) return "#2563eb"
  if (colors.length === 1) return colors[0]
  let mix = tinycolor(colors[0])
  for (let i = 1; i < colors.length; i++) {
    mix = tinycolor.mix(mix, colors[i], 60 / Math.max(colors.length - 1, 1))
  }
  return mix.toHexString()
}

const REGION_DEFAULT_FILL = "#e2e8f0"

const escapeSelector = (value: string) => {
  if (typeof window !== "undefined" && window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value)
  }
  return value.replace(/([.#:[\],=])/g, "\\$1")
}

const getRegionFillColor = (injuryCodes: string[] | undefined) => {
  if (!injuryCodes || injuryCodes.length === 0) {
    return REGION_DEFAULT_FILL
  }
  const colors = injuryCodes
    .map((code) => INJURY_TYPE_COLOR_MAP[code])
    .filter((color): color is string => Boolean(color))

  if (colors.length === 0) {
    return REGION_DEFAULT_FILL
  }

  return blendColors(colors)
}

const getRegionStrokeColor = (fillColor: string, hasInjury: boolean) => {
  return hasInjury ? tinycolor(fillColor).darken(20).toHexString() : "#1f2937"
}

const parseBodySummary = (summary: string | null | undefined) => {
  const result = new Map<string, string[]>()
  if (!summary) return result

  const entries = summary
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)

  entries.forEach((entry) => {
    const match = entry.match(/^(.*?)\s*(?:\((.*?)\))?$/)
    if (!match) return

    const regionLabel = match[1].trim()
    const regionId = REGION_LABEL_TO_ID[regionLabel]
    if (!regionId) return

    const injuriesSegment = match[2]?.trim()
    if (!injuriesSegment) {
      result.set(regionId, [])
      return
    }

    const normalizedSegment = injuriesSegment.toLowerCase()
    const injuries = injuriesSegment
      .replace(/\.$/, "")
      .split(/,\s*|\s+and\s+|\/|\s*&\s*/i)
      .map((injury) => injury.trim().toLowerCase())
      .map((injury) => {
        if (!injury) return undefined
        if (INJURY_LABEL_TO_CODE[injury]) {
          return INJURY_LABEL_TO_CODE[injury]
        }
        if (injury.length === 1) {
          const upper = injury.toUpperCase()
          if (INJURY_TYPE_LOOKUP[upper]) {
            return upper
          }
        }
        return undefined
      })
      .filter((code): code is string => Boolean(code))

    let codes = injuries

    if (codes.length === 0) {
      codes = INJURY_TYPE_OPTIONS.filter((option) => {
        const labelLower = option.label.toLowerCase()
        const shortLower = option.shortLabel.toLowerCase()
        return (
          normalizedSegment.includes(labelLower) ||
          normalizedSegment.includes(shortLower) ||
          normalizedSegment.includes(option.code.toLowerCase())
        )
      }).map((option) => option.code)
    }

    if (codes.length > 0) {
      result.set(regionId, Array.from(new Set(codes)))
    }
  })

  return result
}

interface ReadOnlyBodyDiagramProps {
  view: "front" | "back"
  regionMap: Map<string, string[]>
}

function ReadOnlyBodyDiagram({ view, regionMap }: ReadOnlyBodyDiagramProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [svgContent, setSvgContent] = React.useState<string>("")

  const svgPath = view === "front" ? FRONT_SVG_PATH : BACK_SVG_PATH
  const regionIds = view === "front" ? FRONT_BODY_REGION_IDS : BACK_BODY_REGION_IDS

  React.useEffect(() => {
    let isMounted = true
    const loadSvg = async () => {
      try {
        const response = await fetch(svgPath)
        if (!response.ok) throw new Error(`Failed to load SVG: ${response.status}`)
        const text = await response.text()
        if (isMounted) setSvgContent(text)
      } catch (error) {
        console.error("Error loading SVG diagram:", error)
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

    regionIds.forEach((regionId) => {
      const selector = `#${escapeSelector(regionId)}`
      const regionElement = svgElement.querySelector<SVGGraphicsElement>(selector)
      if (!regionElement) return

      const injuryCodes = regionMap.get(regionId)
      const hasInjury = Boolean(injuryCodes && injuryCodes.length > 0)
      const fillColor = getRegionFillColor(injuryCodes)
      const strokeColor = getRegionStrokeColor(fillColor, hasInjury)

      regionElement.style.fill = fillColor
      regionElement.style.stroke = strokeColor
      regionElement.style.strokeWidth = hasInjury ? "2" : "1.2"
      regionElement.style.opacity = hasInjury ? "0.95" : "1"
    })
  }, [regionIds, regionMap, svgContent])

  return (
    <div className="w-full">
      <div ref={containerRef} className="w-full" aria-label={`${view} body diagram`} />
      {!svgContent && (
        <div className="py-6 text-center text-sm text-gray-400">Loading diagram…</div>
      )}
    </div>
  )
}

export interface InternalReportRecord {
  id: number
  original_report_id: string | null
  incident_type_id: number
  incident_date: string
  time_responded: string | null
  barangay_id: number
  er_team_id: number
  persons_involved: number | null
  number_of_responders: number | null
  prepared_by: string
  created_at: string
  patient_name: string | null
  patient_contact_number: string | null
  patient_birthday: string | null
  patient_age: number | null
  patient_address: string | null
  patient_sex: string | null
  evacuation_priority: string | null
  emergency_category: string | null
  airway_interventions: string | null
  breathing_support: string | null
  circulation_status: string | null
  body_parts_front: string | null
  body_parts_back: string | null
  injury_types: string | null
  incident_location: string | null
  moi_poi_toi: string | null
  receiving_hospital_name: string | null
  receiving_hospital_date: string | null
  emt_ert_date: string | null
}

interface ReportDetailProps {
  report: InternalReportRecord
  barangayName: string
  incidentTypeName: string
  erTeamName: string
}

const parseCommaSeparated = (value: string | null | undefined) => {
  if (!value) return [] as string[]
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export function InternalReportDetail({ report, barangayName, incidentTypeName, erTeamName }: ReportDetailProps) {
  const headerRef = React.useRef<HTMLDivElement | null>(null)
  const bodyRef = React.useRef<HTMLDivElement | null>(null)

  const frontRegions = React.useMemo(() => parseBodySummary(report.body_parts_front), [report.body_parts_front])
  const backRegions = React.useMemo(() => parseBodySummary(report.body_parts_back), [report.body_parts_back])

  const uniqueInjuryCodes = React.useMemo(() => {
    const codes = new Set<string>()
    frontRegions.forEach((injuries) => injuries.forEach((code) => codes.add(code)))
    backRegions.forEach((injuries) => injuries.forEach((code) => codes.add(code)))
    return Array.from(codes)
  }, [frontRegions, backRegions])

  const legendItems = React.useMemo(
    () =>
      uniqueInjuryCodes.map((code) => ({
        code,
        label: INJURY_TYPE_LOOKUP[code]?.label ?? code,
        color: INJURY_TYPE_COLOR_MAP[code] ?? "#2563eb",
      })),
    [uniqueInjuryCodes]
  )

  const regionLegendEntries = React.useMemo(() => {
    const entries: {
      key: string
      orientation: "front" | "back"
      label: string
      color: string
      injuries: string[]
    }[] = []

    const processMap = (map: Map<string, string[]>, orientation: "front" | "back") => {
      map.forEach((codes, regionId) => {
        if (!codes || codes.length === 0) return
        const label = REGION_LABELS[regionId] ?? regionId
        const color = getRegionFillColor(codes)
        const injuries = codes.map((code) => INJURY_TYPE_LOOKUP[code]?.label ?? code)
        entries.push({ key: `${orientation}-${regionId}`, orientation, label, color, injuries })
      })
    }

    processMap(frontRegions, "front")
    processMap(backRegions, "back")

    return entries
  }, [frontRegions, backRegions])

  const emergencyCategories = React.useMemo(() => parseCommaSeparated(report.emergency_category), [report.emergency_category])
  const airwayInterventions = React.useMemo(() => parseCommaSeparated(report.airway_interventions), [report.airway_interventions])
  const breathingSupport = React.useMemo(() => parseCommaSeparated(report.breathing_support), [report.breathing_support])
  const circulationStatus = React.useMemo(() => parseCommaSeparated(report.circulation_status), [report.circulation_status])

  const handleDownloadPdf = React.useCallback(async () => {
    if (!headerRef.current || !bodyRef.current) return

    const pdf = new jsPDF("p", "mm", "legal")
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const marginX = 12
    const marginTop = 12
    const usableWidth = pageWidth - marginX * 2

    const headerCanvas = await html2canvas(headerRef.current, { scale: 2 })
    const headerImgData = headerCanvas.toDataURL("image/png")
    const headerHeightMm = (headerCanvas.height * usableWidth) / headerCanvas.width

    const bodyCanvas = await html2canvas(bodyRef.current, { scale: 2 })
    const pxPerMm = bodyCanvas.width / usableWidth
    const availableHeightMm = pageHeight - marginTop - headerHeightMm - 8
    const availableHeightPx = availableHeightMm * pxPerMm

    let yOffset = 0
    let isFirstPage = true

    while (yOffset < bodyCanvas.height) {
      if (!isFirstPage) {
        pdf.addPage("legal")
      }

      pdf.addImage(headerImgData, "PNG", marginX, marginTop, usableWidth, headerHeightMm)

      const sliceHeightPx = Math.min(availableHeightPx, bodyCanvas.height - yOffset)
      const sliceCanvas = document.createElement("canvas")
      sliceCanvas.width = bodyCanvas.width
      sliceCanvas.height = sliceHeightPx
      const ctx = sliceCanvas.getContext("2d")
      if (!ctx) break
      ctx.drawImage(
        bodyCanvas,
        0,
        yOffset,
        bodyCanvas.width,
        sliceHeightPx,
        0,
        0,
        bodyCanvas.width,
        sliceHeightPx
      )

      const sliceData = sliceCanvas.toDataURL("image/png")
      const sliceHeightMm = sliceHeightPx / pxPerMm

      pdf.addImage(
        sliceData,
        "PNG",
        marginX,
        marginTop + headerHeightMm + 4,
        usableWidth,
        sliceHeightMm
      )

      yOffset += sliceHeightPx
      isFirstPage = false
    }

    pdf.save(`internal-report-${report.id}.pdf`)
  }, [report.id])

  const formatDateTime = (isoString: string | null | undefined, withTime = false) => {
    if (!isoString) return "—"
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) return "—"
    return withTime ? format(date, "PPP • hh:mm a") : format(date, "PPP")
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleDownloadPdf}>
          Download PDF
        </Button>
      </div>

      <div className="mx-auto max-w-4xl bg-white p-8 sm:p-10 shadow-lg">
        <header ref={headerRef} className="flex flex-col gap-6 border-b border-gray-200 pb-6">
          <div className="flex items-center justify-between">
            <Image src="/images/bulan-logo.png" alt="Bulan Municipality Logo" width={80} height={80} className="h-16 w-auto" />
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-gray-500">Republic of the Philippines</p>
              <p className="text-sm font-semibold uppercase text-gray-700">Local Government Unit of Bulan Sorsogon</p>
              <p className="text-base font-bold uppercase text-gray-800">Municipal Disaster Risk Reduction and Management Office</p>
            </div>
            <Image src="/images/logo.png" alt="MDRRMO Logo" width={80} height={80} className="h-16 w-auto" />
          </div>

          <div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-3">
            <div>
              <h2 className="text-xs font-semibold uppercase text-gray-500">Internal Report ID</h2>
              <p className="font-medium text-gray-900">{report.id}</p>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase text-gray-500">Prepared By</h2>
              <p className="font-medium text-gray-900">{report.prepared_by || "—"}</p>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase text-gray-500">Date Created</h2>
              <p className="font-medium text-gray-900">{formatDateTime(report.created_at, true)}</p>
            </div>
          </div>
        </header>

        <main ref={bodyRef} className="mt-6 space-y-8 text-gray-800">
          <section>
            <h3 className="text-lg font-semibold text-gray-900">Incident Details</h3>
            <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Incident Type</p>
                <p className="font-medium text-gray-900">{incidentTypeName || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Incident Date &amp; Time</p>
                <p className="font-medium text-gray-900">{formatDateTime(report.incident_date, true)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Time Responded</p>
                <p className="font-medium text-gray-900">{formatDateTime(report.time_responded, true)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Barangay</p>
                <p className="font-medium text-gray-900">{barangayName || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">ER Team</p>
                <p className="font-medium text-gray-900">{erTeamName || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Incident Location</p>
                <p className="font-medium text-gray-900">{report.incident_location || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Persons Involved</p>
                <p className="font-medium text-gray-900">{report.persons_involved ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Responders</p>
                <p className="font-medium text-gray-900">{report.number_of_responders ?? "—"}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase text-gray-500">MOI / POI / TOI</p>
                <p className="font-medium text-gray-900 whitespace-pre-line">{report.moi_poi_toi || "—"}</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900">Patient Information</h3>
            <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Patient Name</p>
                <p className="font-medium text-gray-900">{report.patient_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Contact Number</p>
                <p className="font-medium text-gray-900">{report.patient_contact_number || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Birthday</p>
                <p className="font-medium text-gray-900">{formatDateTime(report.patient_birthday)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Age</p>
                <p className="font-medium text-gray-900">{report.patient_age ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Sex</p>
                <p className="font-medium text-gray-900">{report.patient_sex ? report.patient_sex.toUpperCase() : "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Evacuation Priority</p>
                <p className="font-medium text-gray-900">{report.evacuation_priority || "—"}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase text-gray-500">Address</p>
                <p className="font-medium text-gray-900">{report.patient_address || "—"}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase text-gray-500">Emergency Categories</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {emergencyCategories.length > 0 ? (
                    emergencyCategories.map((category) => (
                      <span key={category} className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                        {category}
                      </span>
                    ))
                  ) : (
                    <p className="font-medium text-gray-900">—</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900">Primary Assessment</h3>
            <div className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Airway Interventions</p>
                <ul className="mt-1 space-y-1">
                  {airwayInterventions.length > 0 ? (
                    airwayInterventions.map((item) => (
                      <li key={item} className="text-gray-900">• {item}</li>
                    ))
                  ) : (
                    <li className="text-gray-900">• —</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Breathing Support</p>
                <ul className="mt-1 space-y-1">
                  {breathingSupport.length > 0 ? (
                    breathingSupport.map((item) => (
                      <li key={item} className="text-gray-900">• {item}</li>
                    ))
                  ) : (
                    <li className="text-gray-900">• —</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Circulation Status</p>
                <ul className="mt-1 space-y-1">
                  {circulationStatus.length > 0 ? (
                    circulationStatus.map((item) => (
                      <li key={item} className="text-gray-900">• {item}</li>
                    ))
                  ) : (
                    <li className="text-gray-900">• —</li>
                  )}
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900">Injury Overview</h3>
            <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">Front View</p>
                <ReadOnlyBodyDiagram view="front" regionMap={frontRegions} />
                <p className="text-xs text-gray-600">Highlighted regions correspond to confirmed injuries on the patient's front body.</p>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">Back View</p>
                <ReadOnlyBodyDiagram view="back" regionMap={backRegions} />
                <p className="text-xs text-gray-600">Highlighted regions correspond to confirmed injuries on the patient's back body.</p>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold text-gray-700">Body Region Legend</h4>
              <div className="mt-2 grid gap-2">
                {regionLegendEntries.length > 0 ? (
                  regionLegendEntries.map(({ key, orientation, label, color, injuries }) => (
                    <div key={key} className="flex items-start gap-3 rounded border border-gray-200 bg-white p-3 text-sm shadow-sm">
                      <span className="mt-0.5 h-4 w-4 rounded-full" style={{ backgroundColor: color }} />
                      <div>
                        <p className="font-semibold text-gray-800">
                          {label}
                          <span className="ml-2 text-xs font-medium uppercase text-gray-500">{orientation}</span>
                        </p>
                        <p className="text-xs text-gray-600">
                          {injuries.length > 0 ? injuries.join(", ") : "No specific injury noted"}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-600">No highlighted body regions recorded for this report.</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold text-gray-700">Injury Type Legend</h4>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {legendItems.length > 0 ? (
                  legendItems.map((item) => (
                    <div key={item.code} className="flex items-center gap-3 rounded border border-gray-200 bg-gray-50 p-3 text-sm">
                      <span className="h-4 w-4 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-medium text-gray-800">{item.label}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-600">No injuries recorded for this report.</p>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Front Summary</p>
                <p className="whitespace-pre-line font-medium text-gray-900">{report.body_parts_front || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Back Summary</p>
                <p className="whitespace-pre-line font-medium text-gray-900">{report.body_parts_back || "—"}</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900">Transfer of Care</h3>
            <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Receiving Hospital</p>
                <p className="font-medium text-gray-900">{report.receiving_hospital_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Receiving Date</p>
                <p className="font-medium text-gray-900">{formatDateTime(report.receiving_hospital_date)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">EMT / ERT Date</p>
                <p className="font-medium text-gray-900">{formatDateTime(report.emt_ert_date)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Injury Types Summary</p>
                <p className="font-medium text-gray-900">{report.injury_types || "—"}</p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
