"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { CalendarDays, CheckCircle2, ChevronDown, Info, XCircle } from "lucide-react" 
import { format } from "date-fns"
import tinycolor from "tinycolor2"

  interface Report {
    id: string;
    created_at: string; 
    location_address: string;
    latitude: number; 
    longitude: number; 
    firstName: string; 
    mobileNumber: string; 
    emergency_type?: string; 
    er_team_id?: string | number; 
    casualties?: number; 
    responded_at?: string | null;
    resolved_at?: string | null;
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

interface MakeReportFormProps {
  selectedReport: Report | null; 
  erTeams: ERTeam[];
  barangays: Barangay[];
  incidentTypes: IncidentType[];
  onReportSubmitted: () => void; 
}

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
];

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
];

const FRONT_SVG_PATH = "/body_part_front-01.svg";
const BACK_SVG_PATH = "/body_part_back-01.svg";

const STEP1_REQUIRED_FIELDS = [
  "incidentDate",
  "incidentTime",
  "incidentTypeId",
  "barangayId",
  "erTeamId",
  "preparedBy",
] as const;

const STEP2_REQUIRED_FIELDS = [
  "patientName",
  "patientNumber",
  "patientBirthday",
  "patientAge",
  "patientAddress",
  "patientSex",
  "evacPriority",
  "typeOfEmergencySelections",
  "incidentLocation",
  "moiPoiToi",
  "hospitalName",
  "receivingDate",
  "emtErtDate",
] as const;

const REQUIRED_FIELD_LABEL = "Required to fill-up";

type Step1Field = typeof STEP1_REQUIRED_FIELDS[number];
type Step2Field = typeof STEP2_REQUIRED_FIELDS[number];
type FieldKey = Step1Field | Step2Field;

const FIELD_STEP_MAP: Record<FieldKey, 1 | 2> = {
  incidentDate: 1,
  incidentTime: 1,
  incidentTypeId: 1,
  barangayId: 1,
  erTeamId: 1,
  preparedBy: 1,
  patientName: 2,
  patientNumber: 2,
  patientBirthday: 2,
  patientAge: 2,
  patientAddress: 2,
  patientSex: 2,
  evacPriority: 2,
  typeOfEmergencySelections: 2,
  incidentLocation: 2,
  moiPoiToi: 2,
  hospitalName: 2,
  receivingDate: 2,
  emtErtDate: 2,
};

const isValueEmpty = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  return value === null || value === undefined;
};

const generateInjuryColor = (seed: string) => {
  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = (hash * 47) % 360;
  return tinycolor({ h: hue, s: 0.55, l: 0.55 }).toHexString();
};

const injuryTypeColorMap: Record<string, string> = {};

const getColorForInjuryCode = (code: string) => {
  if (INJURY_TYPE_COLOR_MAP[code]) {
    return INJURY_TYPE_COLOR_MAP[code];
  }
  if (!injuryTypeColorMap[code]) {
    injuryTypeColorMap[code] = generateInjuryColor(code);
  }
  return injuryTypeColorMap[code];
};

const blendColors = (colors: string[]) => {
  if (colors.length === 0) return REGION_SELECTED_FILL;
  if (colors.length === 1) return colors[0];
  let mix = tinycolor(colors[0]);
  for (let i = 1; i < colors.length; i++) {
    mix = tinycolor.mix(mix, colors[i], 60 / Math.max(colors.length - 1, 1));
  }
  return mix.toHexString();
};

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
};

const getRegionLabel = (regionId: string) => REGION_LABELS[regionId] ?? regionId;

const parseDate = (value: string | undefined) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const formatDateValue = (value: string | undefined) => {
  const date = parseDate(value);
  return date ? format(date, 'PPP') : '';
};

interface DatePickerFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  error?: boolean;
  fromYear?: number;
  toYear?: number;
}

const DatePickerField: React.FC<DatePickerFieldProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder = 'Select date',
  disabled,
  required,
  allowClear = false,
  error = false,
  fromYear,
  toYear,
}) => {
  const [open, setOpen] = React.useState(false);
  const selectedDate = parseDate(value);

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange('');
      return;
    }
    const iso = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().split('T')[0];
    onChange(iso);
    setOpen(false);
  };

  return (
    <div className="space-y-1">
      <Label
        htmlFor={id}
        className={cn(
          "block text-sm font-medium",
          error ? "text-red-600" : "text-gray-700"
        )}
      >
        {label} {required ? <span className="text-red-500">*</span> : null}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground",
              error && "border-red-500 text-red-600 focus-visible:ring-red-500"
            )}
            disabled={disabled}
            aria-invalid={error}
          >
            <div className="flex flex-1 items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span className="truncate">
                  {selectedDate ? formatDateValue(value) : placeholder}
                </span>
              </div>
              {allowClear && value && (
                <span
                  role="button"
                  tabIndex={0}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500"
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      onChange('');
                    }
                  }}
                >
                  <XCircle className="h-4 w-4" />
                </span>
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[var(--trigger-width)]" align="start" data-trigger-width>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            initialFocus
            captionLayout="dropdown"
            fromYear={fromYear}
            toYear={toYear}
            className="w-full"
            classNames={{
              dropdowns: "flex w-full gap-2",
              dropdown_month: "flex-1",
              dropdown_year: "flex-1",
            }}
          />
          {allowClear && (
            <div className="flex justify-end border-t border-gray-100 bg-gray-50 p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {error ? (
        <p className="text-xs font-semibold text-red-500">{REQUIRED_FIELD_LABEL}</p>
      ) : null}
    </div>
  );
};

const HOSPITAL_OPTIONS = [
  'Bulan Medicare Hospital / Pawa Hospital',
  'SMMG - Bulan',
  'Sorsogon Provincial Hospital',
  'SMMG-HSC (SorDoc)',
  'Irosin District Hospital',
  'Irosin General Hospital / IMAC',
] as const;

const INJURY_TYPE_OPTIONS = [
  { code: 'D', label: 'Deformities', shortLabel: 'Deformity' },
  { code: 'C', label: 'Contusions', shortLabel: 'Contusion' },
  { code: 'A', label: 'Abrasions', shortLabel: 'Abrasion' },
  { code: 'P', label: 'Penetrations', shortLabel: 'Penetration' },
  { code: 'B', label: 'Burns', shortLabel: 'Burn' },
  { code: 'T', label: 'Tenderness', shortLabel: 'Tenderness' },
  { code: 'L', label: 'Lacerations', shortLabel: 'Laceration' },
  { code: 'S', label: 'Swelling', shortLabel: 'Swelling' }
];

const INJURY_TYPE_COLOR_MAP: Record<string, string> = {
  D: '#ef4444',
  C: '#f97316',
  A: '#facc15',
  P: '#8b5cf6',
  B: '#fb7185',
  T: '#22d3ee',
  L: '#10b981',
  S: '#6366f1',
};

const INJURY_TYPE_LOOKUP = INJURY_TYPE_OPTIONS.reduce<Record<string, { code: string; label: string; shortLabel: string }>>((acc, option) => {
  acc[option.code] = option;
  return acc;
}, {});

const REGION_DEFAULT_FILL = '#e2e8f0';
const REGION_HOVER_FILL = '#bfdbfe';
const REGION_SELECTED_FILL = '#2563eb';

const svgContentCache = new Map<string, string>();

const escapeSelector = (value: string) => {
  if (typeof window !== 'undefined' && window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(value);
  }
  return value.replace(/([.#:[\\],=])/g, '\\$1');
};

interface InteractiveBodyDiagramProps {
  view: 'front' | 'back';
  svgPath: string;
  regionIds: string[];
  selectedRegions: string[];
  regionColors: Record<string, string>;
  onRegionSelect: (regionId: string) => void;
}

function InteractiveBodyDiagram({ view, svgPath, regionIds, selectedRegions, regionColors, onRegionSelect }: InteractiveBodyDiagramProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [svgContent, setSvgContent] = React.useState<string>('');

  React.useEffect(() => {
    let isMounted = true;
    const loadSvg = async () => {
      if (svgContentCache.has(svgPath)) {
        if (isMounted) setSvgContent(svgContentCache.get(svgPath) ?? '');
        return;
      }
      try {
        const response = await fetch(svgPath);
        if (!response.ok) throw new Error(`Failed to load SVG: ${response.status}`);
        const text = await response.text();
        svgContentCache.set(svgPath, text);
        if (isMounted) setSvgContent(text);
      } catch (error) {
        console.error('Error loading SVG diagram:', error);
        if (isMounted) setSvgContent('<svg></svg>');
      }
    };
    void loadSvg();
    return () => {
      isMounted = false;
    };
  }, [svgPath]);

  React.useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = svgContent;
  }, [svgContent]);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) return;

    svgElement.removeAttribute('width');
    svgElement.removeAttribute('height');
    svgElement.style.width = '100%';
    svgElement.style.height = 'auto';
    svgElement.style.maxWidth = '360px';
    svgElement.style.display = 'block';
    svgElement.style.margin = '0 auto';

    const selectedSet = new Set(selectedRegions);
    const cleanupFns: Array<() => void> = [];

    regionIds.forEach((regionId) => {
      const selector = `#${escapeSelector(regionId)}`;
      const regionElement = svgElement.querySelector<SVGGraphicsElement>(selector);
      if (!regionElement) return;

      const applyStyles = (isHover = false) => {
        const selectedColor = regionColors[regionId];
        const isActive = selectedSet.has(regionId);
        const strokeColor = selectedColor
          ? tinycolor(selectedColor).darken(20).toHexString()
          : isActive
            ? REGION_SELECTED_FILL
            : '#1f2937';
        const fillColor = selectedColor
          ? selectedColor
          : isHover
            ? REGION_HOVER_FILL
            : isActive
              ? REGION_SELECTED_FILL
              : REGION_DEFAULT_FILL;
        regionElement.style.cursor = 'pointer';
        regionElement.style.transition = 'fill 0.15s ease, stroke-width 0.15s ease';
        regionElement.style.stroke = strokeColor;
        regionElement.style.strokeWidth = selectedColor || isActive ? '2' : '1.2';
        regionElement.style.fill = fillColor;
        regionElement.style.opacity = selectedColor || isActive ? '0.95' : '1';
      };

      applyStyles();

      const handleMouseEnter = () => {
        if (!regionColors[regionId]) {
          applyStyles(true);
        }
      };

      const handleMouseLeave = () => {
        applyStyles();
      };

      const handleClick = () => {
        onRegionSelect(regionId);
      };

      regionElement.addEventListener('mouseenter', handleMouseEnter);
      regionElement.addEventListener('mouseleave', handleMouseLeave);
      regionElement.addEventListener('click', handleClick);

      cleanupFns.push(() => {
        regionElement.removeEventListener('mouseenter', handleMouseEnter);
        regionElement.removeEventListener('mouseleave', handleMouseLeave);
        regionElement.removeEventListener('click', handleClick);
      });
    });

    return () => {
      cleanupFns.forEach((fn) => fn());
    };
  }, [regionIds, selectedRegions, regionColors, onRegionSelect, svgContent]);

  return (
    <div className="w-full">
      <div ref={containerRef} className="w-full" aria-label={`${view} body diagram`} />
      {!svgContent && (
        <div className="py-6 text-center text-sm text-gray-400">Loading diagram…</div>
      )}
    </div>
  );
}

export function MakeReportForm({ selectedReport, erTeams, barangays, incidentTypes, onReportSubmitted }: MakeReportFormProps) {

  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [incidentDate, setIncidentDate] = React.useState('');
  const [incidentTime, setIncidentTime] = React.useState('');
  const [incidentTypeId, setIncidentTypeId] = React.useState<string | undefined>(undefined);
  const [barangayId, setBarangayId] = React.useState<string | undefined>(undefined);
  const [erTeamId, setErTeamId] = React.useState<string | undefined>(undefined);
  const [timeRespondedDate, setTimeRespondedDate] = React.useState('');
  const [timeRespondedTime, setTimeRespondedTime] = React.useState('');
  const [personsInvolved, setPersonsInvolved] = React.useState<string>('');
  const [numberOfResponders, setNumberOfResponders] = React.useState<string>('');
  const [preparedBy, setPreparedBy] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [formMessage, setFormMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [searchTerm, setSearchTerm] = React.useState(''); 
  const [isBarangayDropdownOpen, setIsBarangayDropdownOpen] = React.useState(false);
  const barangayDropdownRef = React.useRef<HTMLDivElement | null>(null);
  const [patientName, setPatientName] = React.useState('');
  const [patientNumber, setPatientNumber] = React.useState('');
  const [patientBirthday, setPatientBirthday] = React.useState('');
  const [patientAge, setPatientAge] = React.useState('');
  const [patientAddress, setPatientAddress] = React.useState('');
  const [patientSex, setPatientSex] = React.useState<'male' | 'female' | ''>('');
  const [evacPriority, setEvacPriority] = React.useState('');
  const [typeOfEmergencySelections, setTypeOfEmergencySelections] = React.useState<string[]>([]);
  const [airwaySelections, setAirwaySelections] = React.useState<string[]>([]);
  const [breathingSelections, setBreathingSelections] = React.useState<string[]>([]);
  const [circulationSelections, setCirculationSelections] = React.useState<string[]>([]);
  const [incidentLocation, setIncidentLocation] = React.useState('');
  const [moiPoiToi, setMoiPoiToi] = React.useState('');
  const [hospitalName, setHospitalName] = React.useState('');
  const [receivingDate, setReceivingDate] = React.useState('');
  const [emtErtDate, setEmtErtDate] = React.useState('');
  const [bodyPartInjuries, setBodyPartInjuries] = React.useState<Record<string, string[]>>({});
  const [activeBodyPartSelection, setActiveBodyPartSelection] = React.useState<{ part: string; view: 'front' | 'back' } | null>(null);
  const [pendingInjurySelection, setPendingInjurySelection] = React.useState<string[]>([]);
  const [injurySelectionError, setInjurySelectionError] = React.useState<string | null>(null);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<Partial<Record<FieldKey, boolean>>>({});

  const getFieldValue = React.useCallback((field: FieldKey) => {
    switch (field) {
      case "incidentDate":
        return incidentDate;
      case "incidentTime":
        return incidentTime;
      case "incidentTypeId":
        return incidentTypeId;
      case "barangayId":
        return barangayId;
      case "erTeamId":
        return erTeamId;
      case "preparedBy":
        return preparedBy;
      case "patientName":
        return patientName;
      case "patientNumber":
        return patientNumber;
      case "patientBirthday":
        return patientBirthday;
      case "patientAge":
        return patientAge;
      case "patientAddress":
        return patientAddress;
      case "patientSex":
        return patientSex;
      case "evacPriority":
        return evacPriority;
      case "typeOfEmergencySelections":
        return typeOfEmergencySelections;
      case "incidentLocation":
        return incidentLocation;
      case "moiPoiToi":
        return moiPoiToi;
      case "hospitalName":
        return hospitalName;
      case "receivingDate":
        return receivingDate;
      case "emtErtDate":
        return emtErtDate;
      default:
        return undefined;
    }
  }, [
    incidentDate,
    incidentTime,
    incidentTypeId,
    barangayId,
    erTeamId,
    preparedBy,
    patientName,
    patientNumber,
    patientBirthday,
    patientAge,
    patientAddress,
    patientSex,
    evacPriority,
    typeOfEmergencySelections,
    incidentLocation,
    moiPoiToi,
    hospitalName,
    receivingDate,
    emtErtDate,
  ]);

  const clearFieldError = React.useCallback((field: FieldKey) => {
    setValidationErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearFieldErrorIfFilled = React.useCallback((field: FieldKey, value: unknown) => {
    if (!isValueEmpty(value)) {
      clearFieldError(field);
    }
  }, [clearFieldError]);

  const isFieldInvalid = React.useCallback((field: FieldKey) => Boolean(validationErrors[field]), [validationErrors]);

  const validateFields = React.useCallback((fields: readonly FieldKey[]) => {
    const missing: FieldKey[] = [];
    fields.forEach((field) => {
      if (isValueEmpty(getFieldValue(field))) {
        missing.push(field);
      }
    });

    setValidationErrors((prev) => {
      const next = { ...prev };
      fields.forEach((field) => {
        if (missing.includes(field)) {
          next[field] = true;
        } else if (next[field]) {
          delete next[field];
        }
      });
      return next;
    });

    return missing;
  }, [getFieldValue]);

  const requireFields = React.useCallback((fields: readonly FieldKey[], message: string) => {
    const missing = validateFields(fields);
    if (missing.length > 0) {
      const firstMissing = missing[0];
      setStep(FIELD_STEP_MAP[firstMissing]);
      setFormMessage({ type: 'error', text: message });
      return false;
    }
    return true;
  }, [validateFields]);

  React.useEffect(() => {
    if (!patientBirthday) {
      setPatientAge('');
      return;
    }
    const parsed = new Date(patientBirthday);
    if (Number.isNaN(parsed.getTime())) {
      setPatientAge('');
      return;
    }
    const today = new Date();
    let age = today.getFullYear() - parsed.getFullYear();
    const monthDiff = today.getMonth() - parsed.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
      age -= 1;
    }
    const calculated = String(Math.max(age, 0));
    setPatientAge(calculated);
    clearFieldErrorIfFilled("patientAge", calculated);
  }, [patientBirthday, clearFieldErrorIfFilled]);

  const handlePatientNumberChange = React.useCallback((value: string) => {
    const digitsOnly = value.replace(/[^0-9]/g, '').slice(0, 11);
    setPatientNumber(digitsOnly);
    clearFieldErrorIfFilled("patientNumber", digitsOnly);
  }, [clearFieldErrorIfFilled]);

  const selectedBodyPartsFront = React.useMemo(
    () => FRONT_BODY_REGION_IDS.filter(part => (bodyPartInjuries[part] ?? []).length > 0),
    [bodyPartInjuries]
  );

  const selectedBodyPartsBack = React.useMemo(
    () => BACK_BODY_REGION_IDS.filter(part => (bodyPartInjuries[part] ?? []).length > 0),
    [bodyPartInjuries]
  );

  const highlightedRegionsFront = React.useMemo(() => {
    const set = new Set(selectedBodyPartsFront);
    if (activeBodyPartSelection?.view === 'front') {
      set.add(activeBodyPartSelection.part);
    }
    return Array.from(set);
  }, [selectedBodyPartsFront, activeBodyPartSelection]);

  const highlightedRegionsBack = React.useMemo(() => {
    const set = new Set(selectedBodyPartsBack);
    if (activeBodyPartSelection?.view === 'back') {
      set.add(activeBodyPartSelection.part);
    }
    return Array.from(set);
  }, [selectedBodyPartsBack, activeBodyPartSelection]);

  const regionColorsFront = React.useMemo(() => {
    const colors: Record<string, string> = {};
    FRONT_BODY_REGION_IDS.forEach((part) => {
      let injuries = bodyPartInjuries[part] ?? [];
      if (activeBodyPartSelection?.part === part && activeBodyPartSelection.view === 'front') {
        injuries = pendingInjurySelection.length > 0 ? pendingInjurySelection : injuries;
      }
      if (injuries.length > 0) {
        const injuryColors = injuries.map(getColorForInjuryCode);
        colors[part] = blendColors(injuryColors);
      }
    });
    return colors;
  }, [bodyPartInjuries, activeBodyPartSelection, pendingInjurySelection]);

  const regionColorsBack = React.useMemo(() => {
    const colors: Record<string, string> = {};
    BACK_BODY_REGION_IDS.forEach((part) => {
      let injuries = bodyPartInjuries[part] ?? [];
      if (activeBodyPartSelection?.part === part && activeBodyPartSelection.view === 'back') {
        injuries = pendingInjurySelection.length > 0 ? pendingInjurySelection : injuries;
      }
      if (injuries.length > 0) {
        const injuryColors = injuries.map(getColorForInjuryCode);
        colors[part] = blendColors(injuryColors);
      }
    });
    return colors;
  }, [bodyPartInjuries, activeBodyPartSelection, pendingInjurySelection]);

  const formatInjuryList = (injuries: string[]) => {
    if (injuries.length === 0) return '';
    if (injuries.length === 1) return injuries[0];
    if (injuries.length === 2) return `${injuries[0]} and ${injuries[1]}`;
    const allButLast = injuries.slice(0, -1).join(', ');
    return `${allButLast}, and ${injuries[injuries.length - 1]}`;
  };

  const getInjuryLabels = React.useCallback((codes: string[]) => {
    return codes.map(code => INJURY_TYPE_LOOKUP[code]?.shortLabel || INJURY_TYPE_LOOKUP[code]?.label || code);
  }, []);

  const summarizeBodyPart = React.useCallback((part: string) => {
    const partLabel = getRegionLabel(part);
    const labels = getInjuryLabels(bodyPartInjuries[part] ?? []);
    const formatted = formatInjuryList(labels);
    return formatted ? `${partLabel} (${formatted})` : partLabel;
  }, [bodyPartInjuries, getInjuryLabels]);

  const activeRegionLabel = React.useMemo(() => (
    activeBodyPartSelection ? getRegionLabel(activeBodyPartSelection.part) : ''
  ), [activeBodyPartSelection]);

  const uniqueInjuryCodes = React.useMemo(() => {
    const codes = new Set<string>();
    Object.values(bodyPartInjuries).forEach(list => {
      list.forEach(code => codes.add(code));
    });
    return Array.from(codes);
  }, [bodyPartInjuries]);

  const uniqueInjuryLabels = React.useMemo(() => getInjuryLabels(uniqueInjuryCodes), [getInjuryLabels, uniqueInjuryCodes]);
  const uniqueInjurySummary = uniqueInjuryLabels.length > 0 ? formatInjuryList(uniqueInjuryLabels) : '';

  // Auto-fill Prepared By from logged-in admin profile
  React.useEffect(() => {
    const deriveFullName = (u: any) => {
      const parts = [u?.firstName, u?.middleName, u?.lastName].filter(Boolean);
      const name = parts.join(' ').replace(/\s+/g, ' ').trim();
      return name || u?.username || u?.email || '';
    };

    const primePreparedBy = async () => {
      try {
        if (preparedBy) return; 
        const raw = typeof window !== 'undefined' ? localStorage.getItem('mdrrmo_user') : null;
        if (raw) {
          try {
            const u = JSON.parse(raw);
            const full = deriveFullName(u);
            if (full) { setPreparedBy(full); return; }
          } catch {}
        }
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData?.session?.user?.id;
        if (uid) {
          const { data: profile } = await supabase
            .from('users')
            .select('firstName, middleName, lastName, username, email')
            .eq('id', uid)
            .single();
          if (profile) {
            const full = deriveFullName(profile);
            if (full) setPreparedBy(full);
          }
        }
      } catch {}
    };
    void primePreparedBy();
  }, [preparedBy]);

  React.useEffect(() => {
    if (selectedReport) {
      const reportDate = new Date(selectedReport.created_at);
      setIncidentDate(reportDate.toISOString().split('T')[0]);
      setIncidentTime(reportDate.toTimeString().split(' ')[0].substring(0, 5));
      if (selectedReport.resolved_at) {
        const resolvedDate = new Date(selectedReport.resolved_at);
        setTimeRespondedDate(resolvedDate.toISOString().split('T')[0]);
        setTimeRespondedTime(resolvedDate.toTimeString().split(' ')[0].substring(0, 5));
      } else {
        setTimeRespondedDate('');
        setTimeRespondedTime('');
      }
    } else {
      setIncidentDate('');
      setIncidentTime('');
      setIncidentTypeId(undefined);
      setBarangayId(undefined);
      setErTeamId(undefined);
      setTimeRespondedDate('');
      setTimeRespondedTime('');
      setPersonsInvolved('');
      setNumberOfResponders('');
      setSearchTerm('');
      setIsBarangayDropdownOpen(false);
      setStep(1);
      setPatientName('');
      setPatientNumber('');
      setPatientBirthday('');
      setPatientAge('');
      setPatientAddress('');
      setPatientSex('');
      setEvacPriority('');
      setTypeOfEmergencySelections([]);
      setAirwaySelections([]);
      setBreathingSelections([]);
      setCirculationSelections([]);
      setBodyPartInjuries({});
      setActiveBodyPartSelection(null);
      setPendingInjurySelection([]);
      setIncidentLocation('');
      setMoiPoiToi('');
      setHospitalName('');
      setReceivingDate('');
      setEmtErtDate('');
    }
    setFormMessage(null); 
  }, [selectedReport]);

  React.useEffect(() => {
    if (!selectedReport) return;

    if (!erTeamId && selectedReport.er_team_id) {
      const teamIdStr = typeof selectedReport.er_team_id === 'string' 
        ? selectedReport.er_team_id 
        : String(selectedReport.er_team_id);
      
      const teamExists = erTeams.find(team => String(team.id) === teamIdStr);
      if (teamExists) {
        setErTeamId(teamIdStr);
      }
    }

    if (personsInvolved === '' && typeof selectedReport.casualties === 'number') {
      setPersonsInvolved(String(selectedReport.casualties));
    }
    if (!incidentTypeId && selectedReport.emergency_type && incidentTypes.length > 0) {
      const typeMapping: { [key: string]: string } = {
        'Fire Incident': 'Fire Incident',
        'Medical Emergency': 'Medical Emergency', 
        'Vehicular Incident': 'Vehicular/Pedestrian Accident', 
        'Weather Disturbance': 'Weather Disturbance',
        'Public Disturbance': 'Public Disturbance',
        'Others': 'Others'
      };

      const mappedType = typeMapping[selectedReport.emergency_type] || selectedReport.emergency_type;
      const match = incidentTypes.find((it) => it.name.toLowerCase() === mappedType.toLowerCase());
      if (match) {
        setIncidentTypeId(String(match.id));
      }
    }
  }, [selectedReport, erTeamId, personsInvolved, incidentTypeId, incidentTypes, erTeams]);

  const filteredBarangays = barangays.filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (barangayDropdownRef.current && !barangayDropdownRef.current.contains(event.target as Node)) {
        setIsBarangayDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  React.useEffect(() => {
    if (!barangayId) {
      setIncidentLocation('');
      return;
    }
    const match = barangays.find((b) => String(b.id) === barangayId);
    if (match && match.name !== searchTerm) {
      setSearchTerm(match.name);
    }
    if (match) {
      setIncidentLocation(match.name);
      clearFieldErrorIfFilled("incidentLocation", match.name);
    }
  }, [barangayId, barangays, searchTerm, clearFieldErrorIfFilled]);

  const handleBarangaySelect = (barangay: Barangay) => {
    const nextId = String(barangay.id);
    setBarangayId(nextId);
    clearFieldErrorIfFilled("barangayId", nextId);
    setSearchTerm(barangay.name);
    setIsBarangayDropdownOpen(false);
    setIncidentLocation(barangay.name);
    clearFieldErrorIfFilled("incidentLocation", barangay.name);
  };

  const clearBarangaySelection = () => {
    setBarangayId(undefined);
    setSearchTerm('');
    setIsBarangayDropdownOpen(false);
    setIncidentLocation('');
  };

  const handleToggleTypeOfEmergency = (option: string) => {
    setTypeOfEmergencySelections((prev) => {
      const next = prev.includes(option) ? prev.filter(item => item !== option) : [...prev, option];
      clearFieldErrorIfFilled("typeOfEmergencySelections", next);
      return next;
    });
  };

  const handleSexSelection = (sex: 'male' | 'female') => {
    setPatientSex((prev) => {
      const next = prev === sex ? '' : sex;
      clearFieldErrorIfFilled("patientSex", next);
      return next;
    });
  };

  const handleEvacPrioritySelection = (priority: string) => {
    setEvacPriority((prev) => {
      const next = prev === priority ? '' : priority;
      clearFieldErrorIfFilled("evacPriority", next);
      return next;
    });
  };

  const toggleSelection = (option: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]);
  };

  const handleAirwayToggle = (option: string) => {
    toggleSelection(option, setAirwaySelections);
  };

  const handleBreathingToggle = (option: string) => {
    toggleSelection(option, setBreathingSelections);
  };

  const handleCirculationToggle = (option: string) => {
    toggleSelection(option, setCirculationSelections);
  };

  const handleBodyPartToggle = (part: string, view: 'front' | 'back') => {
    setActiveBodyPartSelection({ part, view });
    setPendingInjurySelection(bodyPartInjuries[part] ?? []);
    setInjurySelectionError(null);
  };

  const handleInjuryTypeToggle = (code: string) => {
    setPendingInjurySelection(prev => prev.includes(code) ? prev.filter(item => item !== code) : [...prev, code]);
  };

  const handleConfirmInjurySelection = () => {
    if (!activeBodyPartSelection) return;
    if (pendingInjurySelection.length === 0) {
      setInjurySelectionError('Select at least one injury type for this body part.');
      return;
    }
    setBodyPartInjuries(prev => ({
      ...prev,
      [activeBodyPartSelection.part]: pendingInjurySelection,
    }));
    setActiveBodyPartSelection(null);
    setPendingInjurySelection([]);
    setInjurySelectionError(null);
  };

  const handleCancelInjurySelection = () => {
    setActiveBodyPartSelection(null);
    setPendingInjurySelection([]);
    setInjurySelectionError(null);
  };

  const handleClearInjurySelection = () => {
    if (!activeBodyPartSelection) return;
    setBodyPartInjuries(prev => {
      const { [activeBodyPartSelection.part]: _removed, ...rest } = prev;
      return rest;
    });
    setActiveBodyPartSelection(null);
    setPendingInjurySelection([]);
    setInjurySelectionError(null);
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!requireFields(STEP1_REQUIRED_FIELDS, 'Please complete all required incident details before continuing.')) {
        return;
      }
      setFormMessage(null);
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!requireFields(STEP2_REQUIRED_FIELDS, 'Please complete all patient and transfer fields before proceeding.')) {
        return;
      }
      setFormMessage(null);
      setStep(3);
    }
  };

  const handleBack = () => {
    setFormMessage(null);
    setStep((prev) => {
      if (prev === 3) return 2;
      if (prev === 2) return 1;
      return 1;
    });
  };

  const resetForm = () => {
    setIncidentDate('');
    setIncidentTime('');
    setIncidentTypeId(undefined);
    setBarangayId(undefined);
    setErTeamId(undefined);
    setTimeRespondedDate('');
    setTimeRespondedTime('');
    setPersonsInvolved('');
    setNumberOfResponders('');
    setPreparedBy('');
    setSearchTerm('');
    setStep(1);
    setPatientName('');
    setPatientNumber('');
    setPatientBirthday('');
    setPatientAge('');
    setPatientAddress('');
    setPatientSex('');
    setEvacPriority('');
    setTypeOfEmergencySelections([]);
    setAirwaySelections([]);
    setBreathingSelections([]);
    setCirculationSelections([]);
    setBodyPartInjuries({});
    setActiveBodyPartSelection(null);
    setPendingInjurySelection([]);
    setIncidentLocation('');
    setMoiPoiToi('');
    setHospitalName('');
    setReceivingDate('');
    setEmtErtDate('');
    setValidationErrors({});
    setFormMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage(null); 
    setIsLoading(true);

    if (!requireFields(STEP1_REQUIRED_FIELDS, 'Please fill in all required incident details.')) {
      setIsLoading(false);
      return;
    }

    if (!requireFields(STEP2_REQUIRED_FIELDS, 'Please complete all patient and transfer details.')) {
      setIsLoading(false);
      return;
    }

    if (step !== 3) {
      setStep(3);
      setFormMessage({ type: 'error', text: 'Please proceed through all form steps before submitting.' });
      setIsLoading(false);
      return;
    }

    if (!incidentTypeId || !barangayId || !erTeamId) {
      setFormMessage({ type: 'error', text: 'Missing required identifiers for incident type, barangay, or ER team.' });
      setIsLoading(false);
      return;
    }

    const hasBodyPartSelections = Object.values(bodyPartInjuries).some(list => list.length > 0);
    if (!hasBodyPartSelections) {
      setStep(3);
      setFormMessage({ type: 'error', text: 'Select at least one body part and confirm its injury types.' });
      setIsLoading(false);
      return;
    }

    const incidentDateTime = new Date(`${incidentDate}T${incidentTime}:00Z`).toISOString(); 
    const timeRespondedIso = timeRespondedDate && timeRespondedTime
      ? new Date(`${timeRespondedDate}T${timeRespondedTime}:00Z`).toISOString()
      : null;

    const frontSummary = selectedBodyPartsFront.map(part => summarizeBodyPart(part)).join('; ');
    const backSummary = selectedBodyPartsBack.map(part => summarizeBodyPart(part)).join('; ');
    const injuryTypesSummary = uniqueInjuryLabels.join(', ');

    try {
      const { data, error } = await supabase
        .from('internal_reports')
        .insert({
          original_report_id: selectedReport?.id || null, 
          incident_type_id: parseInt(incidentTypeId, 10),
          incident_date: incidentDateTime,
          time_responded: timeRespondedIso,
          barangay_id: parseInt(barangayId, 10),
          er_team_id: parseInt(erTeamId, 10),
          persons_involved: personsInvolved ? parseInt(personsInvolved, 10) : null,
          number_of_responders: numberOfResponders ? parseInt(numberOfResponders, 10) : null,
          prepared_by: preparedBy,
          created_at: new Date().toISOString(), 
          patient_name: patientName,
          patient_contact_number: patientNumber,
          patient_birthday: patientBirthday,
          patient_age: patientAge ? parseInt(patientAge, 10) : null,
          patient_address: patientAddress,
          patient_sex: patientSex || null,
          evacuation_priority: evacPriority || null,
          emergency_category: typeOfEmergencySelections.join(', '),
          airway_interventions: airwaySelections.join(', '),
          breathing_support: breathingSelections.join(', '),
          circulation_status: circulationSelections.join(', '),
          body_parts_front: frontSummary,
          body_parts_back: backSummary,
          injury_types: injuryTypesSummary,
          incident_location: incidentLocation,
          moi_poi_toi: moiPoiToi,
          receiving_hospital_name: hospitalName,
          receiving_hospital_date: receivingDate ? new Date(`${receivingDate}T00:00:00Z`).toISOString() : null,
          emt_ert_date: emtErtDate ? new Date(`${emtErtDate}T00:00:00Z`).toISOString() : null,
        })
        .select();

      if (error) throw error;

      console.log("Internal report submitted:", data);
      setFormMessage({ type: 'success', text: "Internal report submitted successfully!" });
      resetForm(); 
      setIsSuccessDialogOpen(true);
    } catch (err: any) {
      console.error("Error submitting internal report:", err);
        setFormMessage({ type: 'error', text: `Failed to submit report: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

const stepDescriptors: { id: 1 | 2 | 3; label: string; description: string }[] = React.useMemo(() => ([
  { id: 1, label: 'Incident', description: 'Incident basics & responders' },
  { id: 2, label: 'Patient', description: 'Patient profile & care' },
  { id: 3, label: 'Injuries', description: 'Body diagram & injury log' },
]), []);

const renderStepPill = (descriptor: { id: 1 | 2 | 3; label: string; description: string }) => {
  const isActive = descriptor.id === step;
  const isCompleted = descriptor.id < step;
  return (
    <button
      key={descriptor.id}
      type="button"
      onClick={() => setStep(descriptor.id)}
      className={`group flex items-center gap-3 rounded-full border px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 ${
        isActive
          ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm'
          : isCompleted
            ? 'border-green-500 bg-green-50 text-green-700'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
      }`}
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
        isActive
          ? 'bg-orange-500 text-white'
          : isCompleted
            ? 'bg-green-500 text-white'
            : 'bg-gray-100 text-gray-500'
      }`}>
        {descriptor.id}
      </span>
      <div className="text-left">
        <p className="text-sm font-semibold leading-tight">{descriptor.label}</p>
        <p className="text-xs text-gray-500 leading-tight">{descriptor.description}</p>
      </div>
    </button>
  );
};

const StepTooltip = ({ text }: { text: string }) => (
  <TooltipProvider delayDuration={150}>
    <Tooltip>
      <TooltipTrigger type="button" className="inline-flex items-center justify-center rounded-full border border-gray-200 p-1 text-gray-400 hover:text-gray-600 hover:border-gray-300">
        <Info className="h-4 w-4" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs text-gray-600">
        {text}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const SummaryRow = ({ label, value }: { label: string; value: React.ReactNode }) => {
  const displayValue =
    value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
      ? <span className="text-gray-400">—</span>
      : value;

  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="font-medium text-gray-600">{label}</span>
      <div className="text-gray-800 text-right break-words flex-1">{displayValue}</div>
    </div>
  );
};

return (
  <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
    <Card className="shadow-lg h-full rounded-lg">
      <CardHeader className="bg-orange-600 text-white rounded-t-lg p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-2xl font-bold">
            {selectedReport ? `Create Report for Incident ID: ${selectedReport.id.substring(0, 8)}...` : 'Create New Incident Report (Manual)'}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0 bg-white rounded-b-lg">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 sticky top-0 z-10 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {stepDescriptors.map(renderStepPill)}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {step === 1 && (
            <>
              <div className="flex items-center justify-between bg-white border rounded-md px-4 py-3 shadow-sm sticky top-[88px] z-10">
                <div className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white">1</span>
                  Incident Details
                </div>
                <StepTooltip text="Fill in date, time, location, and responding team details for this incident." />
              </div>

              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                <DatePickerField
                  id="incidentDate"
                  label="Incident Date"
                  value={incidentDate}
                  onChange={(next) => {
                    setIncidentDate(next);
                    clearFieldErrorIfFilled("incidentDate", next);
                  }}
                  required
                  error={isFieldInvalid("incidentDate")}
                />
                <div>
                  <Label
                    htmlFor="incidentTime"
                    className={cn(
                      "block text-sm font-medium mb-1",
                      isFieldInvalid("incidentTime") ? "text-red-600" : "text-gray-700"
                    )}
                  >
                    Time Reported
                  </Label>
                  <Input
                    id="incidentTime"
                    type="time"
                    value={incidentTime}
                    onChange={(e) => {
                      const next = e.target.value;
                      setIncidentTime(next);
                      clearFieldErrorIfFilled("incidentTime", next);
                    }}
                    required
                    className={cn(
                      "w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm",
                      isFieldInvalid("incidentTime") ? "border-red-500" : "border-gray-300"
                    )}
                  />
                  {isFieldInvalid("incidentTime") ? (
                    <p className="text-xs font-semibold text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="incidentType"
                      className={cn(
                        "block text-sm font-medium",
                        isFieldInvalid("incidentTypeId") ? "text-red-600" : "text-gray-700"
                      )}
                    >
                      Incident Type
                    </Label>
                    <StepTooltip text="Select the category that best captures this emergency." />
                  </div>
                  <Select
                    value={incidentTypeId}
                    onValueChange={(value) => {
                      setIncidentTypeId(value);
                      clearFieldErrorIfFilled("incidentTypeId", value);
                    }}
                    required
                  >
                    <SelectTrigger
                      id="incidentType"
                      className={cn(
                        "w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm",
                        isFieldInvalid("incidentTypeId") ? "border-red-500" : "border-gray-300"
                      )}
                    >
                      <SelectValue placeholder="Select incident type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
                      {incidentTypes.length > 0 ? (
                        incidentTypes.map(type => (
                          <SelectItem key={type.id} value={String(type.id)} className="p-2 hover:bg-gray-100 cursor-pointer">
                            {type.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-center text-gray-500">No incident types available.</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div ref={barangayDropdownRef} className="relative">
                  <Label
                    htmlFor="barangaySearch"
                    className={cn(
                      "block text-sm font-medium mb-1",
                      isFieldInvalid("barangayId") ? "text-red-600" : "text-gray-700"
                    )}
                  >
                    Barangay Name
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="barangaySearch"
                      type="text"
                      placeholder="Search barangay..."
                      value={searchTerm}
                      onFocus={() => setIsBarangayDropdownOpen(true)}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsBarangayDropdownOpen(true);
                      }}
                      className={cn(
                        "w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm",
                        isFieldInvalid("barangayId") ? "border-red-500" : "border-gray-300"
                      )}
                    />
                    {searchTerm && (
                      <Button type="button" variant="outline" className="px-3" onClick={clearBarangaySelection}>
                        Clear
                      </Button>
                    )}
                  </div>
                  {isBarangayDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredBarangays.length > 0 ? (
                        filteredBarangays.map((barangay) => (
                          <button
                            type="button"
                            key={barangay.id}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${barangayId === String(barangay.id) ? 'bg-gray-100 font-semibold' : ''}`}
                            onClick={() => handleBarangaySelect(barangay)}
                          >
                            {barangay.name}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500">No matching barangays.</div>
                      )}
                    </div>
                  )}
                  {isFieldInvalid("barangayId") ? (
                    <p className="text-xs font-semibold text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                  ) : !barangayId ? (
                    <p className="text-xs text-gray-500 mt-1">Select a barangay from the list to continue.</p>
                  ) : null}
                </div>

                <div>
                  <Label
                    htmlFor="erTeam"
                    className={cn(
                      "block text-sm font-medium mb-1",
                      isFieldInvalid("erTeamId") ? "text-red-600" : "text-gray-700"
                    )}
                  >
                    ER Team
                  </Label>
                  <Select
                    value={erTeamId}
                    onValueChange={(value) => {
                      setErTeamId(value);
                      clearFieldErrorIfFilled("erTeamId", value);
                    }}
                    required
                  >
                    <SelectTrigger
                      id="erTeam"
                      className={cn(
                        "w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm",
                        isFieldInvalid("erTeamId") ? "border-red-500" : "border-gray-300"
                      )}
                    >
                      <SelectValue placeholder="Select ER team" />
                    </SelectTrigger>
                    <SelectContent className="bg-white rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
                      {erTeams.length > 0 ? (
                        erTeams.map(team => (
                          <SelectItem key={team.id} value={String(team.id)} className="p-2 hover:bg-gray-100 cursor-pointer">
                            {team.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-center text-gray-500">No ER teams available.</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label
                    htmlFor="incidentLocation"
                    className={cn(
                      "block text-sm font-medium mb-1",
                      isFieldInvalid("incidentLocation") ? "text-red-600" : "text-gray-700"
                    )}
                  >
                    Incident Location
                  </Label>
                  <Input
                    id="incidentLocation"
                    type="text"
                    value={incidentLocation}
                    onChange={(e) => {
                      const next = e.target.value;
                      setIncidentLocation(next);
                      clearFieldErrorIfFilled("incidentLocation", next);
                    }}
                    required
                    className={cn(
                      "w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm",
                      isFieldInvalid("incidentLocation") ? "border-red-500" : "border-gray-300"
                    )}
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-filled from barangay selection. You may adjust if needed.</p>
                  {isFieldInvalid("incidentLocation") ? (
                    <p className="text-xs font-semibold text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                  ) : null}
                </div>
                <div>
                  <Label
                    htmlFor="moiPoiToi"
                    className={cn(
                      "block text-sm font-medium mb-1",
                      isFieldInvalid("moiPoiToi") ? "text-red-600" : "text-gray-700"
                    )}
                  >
                    MOI / POI / TOI
                  </Label>
                  <Textarea
                    id="moiPoiToi"
                    value={moiPoiToi}
                    onChange={(e) => {
                      const next = e.target.value;
                      setMoiPoiToi(next);
                      clearFieldErrorIfFilled("moiPoiToi", next);
                    }}
                    required
                    className={cn(
                      "w-full border rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm",
                      isFieldInvalid("moiPoiToi") ? "border-red-500" : "border-gray-300"
                    )}
                    rows={4}
                  />
                  {isFieldInvalid("moiPoiToi") ? (
                    <p className="text-xs font-semibold text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DatePickerField
                  id="timeRespondedDate"
                  label="Responded Date"
                  value={timeRespondedDate}
                  onChange={setTimeRespondedDate}
                  allowClear
                  placeholder="Select date"
                />
                <div>
                  <Label htmlFor="timeRespondedTime" className="block text-sm font-medium text-gray-700 mb-1">Responded Time</Label>
                  <Input
                    id="timeRespondedTime"
                    type="time"
                    value={timeRespondedTime}
                    onChange={(e) => setTimeRespondedTime(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label
                    htmlFor="preparedBy"
                    className={cn(
                      "block text-sm font-medium",
                      isFieldInvalid("preparedBy") ? "text-red-600" : "text-gray-700"
                    )}
                  >
                    Prepared By
                  </Label>
                  <StepTooltip text="Automatically fills from your profile if available. Update if another admin handles this report." />
                </div>
                <Input
                  id="preparedBy"
                  type="text"
                  value={preparedBy}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPreparedBy(next);
                    clearFieldErrorIfFilled("preparedBy", next);
                  }}
                  required
                  className={cn(
                    "w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm",
                    isFieldInvalid("preparedBy") ? "border-red-500" : "border-gray-300"
                  )}
                />
                {isFieldInvalid("preparedBy") ? (
                  <p className="text-xs font-semibold text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                ) : null}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition duration-200 ease-in-out"
                  onClick={handleNextStep}
                >
                  Next Step
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-center justify-between bg-white border rounded-md px-4 py-3 shadow-sm sticky top-[88px] z-10">
                <div className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white">2</span>
                  Patient Information & Transfer of Care
                </div>
                <StepTooltip text="Capture patient details, evacuation priority, and transfer notes." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label
                    htmlFor="patientName"
                    className={cn(
                      "block text-sm font-medium mb-1",
                      isFieldInvalid("patientName") ? "text-red-600" : "text-gray-700"
                    )}
                  >
                    Patient's Name
                  </Label>
                  <Input
                    id="patientName"
                    type="text"
                    value={patientName}
                    onChange={(e) => {
                      const next = e.target.value;
                      setPatientName(next);
                      clearFieldErrorIfFilled("patientName", next);
                    }}
                    required
                    className={cn(
                      "w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm",
                      isFieldInvalid("patientName") ? "border-red-500" : "border-gray-300"
                    )}
                  />
                  {isFieldInvalid("patientName") ? (
                    <p className="text-xs font-semibold text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                  ) : null}
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="patientNumber"
                      className={cn(
                        "block text-sm font-medium",
                        isFieldInvalid("patientNumber") ? "text-red-600" : "text-gray-700"
                      )}
                    >
                      Patient's Contact Number
                    </Label>
                    <StepTooltip text="Only accepts 11-digit Philippine mobile numbers starting with 09." />
                  </div>
                  <Input
                    id="patientNumber"
                    type="tel"
                    inputMode="numeric"
                    pattern="09[0-9]{9}"
                    value={patientNumber}
                    onChange={(e) => handlePatientNumberChange(e.target.value)}
                    placeholder="09xxxxxxxxx"
                    required
                    className={cn(
                      "w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm",
                      isFieldInvalid("patientNumber") ? "border-red-500" : "border-gray-300"
                    )}
                  />
                  {isFieldInvalid("patientNumber") ? (
                    <p className="text-xs font-semibold text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <DatePickerField
                  id="patientBirthday"
                  label="Birthday"
                  value={patientBirthday}
                  onChange={(next) => {
                    setPatientBirthday(next);
                    clearFieldErrorIfFilled("patientBirthday", next);
                  }}
                  required
                  placeholder="Select birthday"
                  fromYear={1900}
                  error={isFieldInvalid("patientBirthday")}
                />
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="patientAge"
                      className={cn(
                        "block text-sm font-medium",
                        isFieldInvalid("patientAge") ? "text-red-600" : "text-gray-700"
                      )}
                    >
                      Age
                    </Label>
                    <StepTooltip text="Automatically calculates after the birthday is set." />
                  </div>
                  <Input
                    id="patientAge"
                    type="number"
                    min="0"
                    value={patientAge}
                    readOnly
                    required
                    className={cn(
                      "w-full p-2 border rounded-md bg-gray-50 focus:ring-blue-500 focus:border-blue-500 shadow-sm",
                      isFieldInvalid("patientAge") ? "border-red-500" : "border-gray-300"
                    )}
                  />
                  {isFieldInvalid("patientAge") ? (
                    <p className="text-xs font-semibold text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                  ) : null}
                </div>
                <div>
                  <Label
                    htmlFor="patientSex"
                    className={cn(
                      "block text-sm font-medium mb-1",
                      isFieldInvalid("patientSex") ? "text-red-600" : "text-gray-700"
                    )}
                  >
                    Sex
                  </Label>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="sex-male"
                        checked={patientSex === 'male'}
                        onCheckedChange={() => handleSexSelection('male')}
                      />
                      <Label htmlFor="sex-male" className="text-sm text-gray-700">Male</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="sex-female"
                        checked={patientSex === 'female'}
                        onCheckedChange={() => handleSexSelection('female')}
                      />
                      <Label htmlFor="sex-female" className="text-sm text-gray-700">Female</Label>
                    </div>
                  </div>
                  {isFieldInvalid("patientSex") ? (
                    <p className="text-xs font-semibold text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                  ) : null}
                </div>
              </div>

              <div>
                <Label
                  htmlFor="patientAddress"
                  className={cn(
                    "block text-sm font-medium mb-1",
                    isFieldInvalid("patientAddress") ? "text-red-600" : "text-gray-700"
                  )}
                >
                  Patient's Address
                </Label>
                <Input
                  id="patientAddress"
                  type="text"
                  value={patientAddress}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPatientAddress(next);
                    clearFieldErrorIfFilled("patientAddress", next);
                  }}
                  required
                  className={cn(
                    "w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm",
                    isFieldInvalid("patientAddress") ? "border-red-500" : "border-gray-300"
                  )}
                />
                {isFieldInvalid("patientAddress") ? (
                  <p className="text-xs font-semibold text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                ) : null}
              </div>

              <div className="rounded-lg border shadow-sm p-4 bg-white">
                <Label
                  className={cn(
                    "block text-sm font-medium mb-1",
                    isFieldInvalid("evacPriority") ? "text-red-600" : "text-gray-700"
                  )}
                >
                  Evacuation Priority
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Red / Priority 1', value: 'priority_red' },
                    { label: 'Yellow / Priority 2', value: 'priority_yellow' },
                    { label: 'Green / Priority 3', value: 'priority_green' },
                    { label: 'Black / Priority 4', value: 'priority_black' },
                  ].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleEvacPrioritySelection(option.value)}
                      className={`border rounded-md px-3 py-2 text-sm text-left transition ${evacPriority === option.value ? 'border-orange-500 bg-orange-50 font-semibold' : 'hover:bg-gray-50'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {isFieldInvalid("evacPriority") ? (
                  <p className="text-xs font-semibold text-red-500 mt-2">{REQUIRED_FIELD_LABEL}</p>
                ) : null}
              </div>
              <div className="rounded-lg border shadow-sm p-4 bg-white">
                <Label
                  className={cn(
                    "block text-sm font-medium mb-1",
                    isFieldInvalid("typeOfEmergencySelections") ? "text-red-600" : "text-gray-700"
                  )}
                >
                  Type of Emergency
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['RTA', 'Medical', 'Trauma', 'Conduction', 'Psyche', 'Pedia', 'OB'].map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleToggleTypeOfEmergency(option)}
                      className={`border rounded-md px-3 py-2 text-sm transition ${typeOfEmergencySelections.includes(option) ? 'border-orange-500 bg-orange-50 font-semibold' : 'hover:bg-gray-50'}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {isFieldInvalid("typeOfEmergencySelections") ? (
                  <p className="text-xs font-semibold text-red-500 mt-2">{REQUIRED_FIELD_LABEL}</p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border shadow-sm p-4 bg-white">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Airway (A)</p>
                  <div className="grid grid-cols-1 gap-2">
                    {['Patent', 'NPA', 'OPA', 'Advanced Airway'].map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleAirwayToggle(option)}
                        className={`border rounded-md px-3 py-2 text-sm transition ${airwaySelections.includes(option) ? 'border-orange-500 bg-orange-50 font-semibold' : 'hover:bg-gray-50'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border shadow-sm p-4 bg-white">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Breathing (B)</p>
                  <div className="grid grid-cols-1 gap-2">
                    {['Dioxygen (O₂)', 'Canula', 'NRB', 'BVM'].map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleBreathingToggle(option)}
                        className={`border rounded-md px-3 py-2 text-sm transition ${breathingSelections.includes(option) ? 'border-orange-500 bg-orange-50 font-semibold' : 'hover:bg-gray-50'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border shadow-sm p-4 bg-white">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Circulation (C)</p>
                  <div className="grid grid-cols-1 gap-2">
                    {['Radial', 'Carotid', 'None'].map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleCirculationToggle(option)}
                        className={`border rounded-md px-3 py-2 text-sm transition ${circulationSelections.includes(option) ? 'border-orange-500 bg-orange-50 font-semibold' : 'hover:bg-gray-50'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label
                    htmlFor="incidentLocation"
                    className={cn(
                      "block text-sm font-medium mb-1",
                      isFieldInvalid("incidentLocation") ? "text-red-600" : "text-gray-700"
                    )}
                  >
                    Incident Location
                  </Label>
                  <Input
                    id="incidentLocation"
                    type="text"
                    value={incidentLocation}
                    onChange={(e) => {
                      const next = e.target.value;
                      setIncidentLocation(next);
                      clearFieldErrorIfFilled("incidentLocation", next);
                    }}
                    required
                    className={cn(
                      "w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm",
                      isFieldInvalid("incidentLocation") ? "border-red-500" : "border-gray-300"
                    )}
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-filled from barangay selection. You may adjust if needed.</p>
                  {isFieldInvalid("incidentLocation") ? (
                    <p className="text-xs font-semibold text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="moiPoiToi" className="block text-sm font-medium text-gray-700 mb-1">MOI / POI / TOI</Label>
                  <Textarea
                    id="moiPoiToi"
                    value={moiPoiToi}
                    onChange={(e) => {
                      const next = e.target.value;
                      setMoiPoiToi(next);
                      clearFieldErrorIfFilled("moiPoiToi", next);
                    }}
                    required
                    className={cn(
                      "w-full border rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm",
                      isFieldInvalid("moiPoiToi") ? "border-red-500" : "border-gray-300"
                    )}
                    rows={4}
                  />
                  {isFieldInvalid("moiPoiToi") ? (
                    <p className="text-xs font-semibold text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                  ) : null}
                </div>
              </div>

              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Transfer of Care</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label
                      htmlFor="hospitalName"
                      className={cn(
                        "block text-sm font-medium mb-1",
                        isFieldInvalid("hospitalName") ? "text-red-600" : "text-gray-700"
                      )}
                    >
                      Hospital Name
                    </Label>
                    <Select
                      value={hospitalName}
                      onValueChange={(value) => {
                        setHospitalName(value);
                        clearFieldErrorIfFilled("hospitalName", value);
                      }}
                      required
                    >
                      <SelectTrigger
                        id="hospitalName"
                        className={cn(
                          "w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm",
                          isFieldInvalid("hospitalName") ? "border-red-500" : "border-gray-300"
                        )}
                      >
                        <SelectValue placeholder="Select receiving hospital" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 bg-white">
                        {HOSPITAL_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option} className="text-sm">
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isFieldInvalid("hospitalName") ? (
                      <p className="text-xs font-semibold text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                    ) : null}
                  </div>
                  <DatePickerField
                    id="receivingDate"
                    label="Receiving Date"
                    value={receivingDate}
                    onChange={(next) => {
                      setReceivingDate(next);
                      clearFieldErrorIfFilled("receivingDate", next);
                    }}
                    required
                    error={isFieldInvalid("receivingDate")}
                  />
                  <DatePickerField
                    id="emtErtDate"
                    label="EMT / ERT Date"
                    value={emtErtDate}
                    onChange={(next) => {
                      setEmtErtDate(next);
                      clearFieldErrorIfFilled("emtErtDate", next);
                    }}
                    required
                    error={isFieldInvalid("emtErtDate")}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="px-6"
                  onClick={handleBack}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition duration-200 ease-in-out"
                  onClick={handleNextStep}
                  disabled={isLoading}
                >
                  Next
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex items-center justify-between bg-white border rounded-md px-4 py-3 shadow-sm sticky top-[88px] z-10">
                <div className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white">3</span>
                  Body Part & Injury Details
                </div>
                <StepTooltip text="Click regions on the diagrams to assign injuries, then confirm your selections." />
              </div>

              <div className="rounded-lg border shadow-sm p-4 bg-white">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Body Diagram</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-700">Front View</p>
                    <InteractiveBodyDiagram
                      view="front"
                      svgPath={FRONT_SVG_PATH}
                      regionIds={FRONT_BODY_REGION_IDS}
                      selectedRegions={highlightedRegionsFront}
                      regionColors={regionColorsFront}
                      onRegionSelect={(regionId) => handleBodyPartToggle(regionId, 'front')}
                    />
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-700">Back View</p>
                    <InteractiveBodyDiagram
                      view="back"
                      svgPath={BACK_SVG_PATH}
                      regionIds={BACK_BODY_REGION_IDS}
                      selectedRegions={highlightedRegionsBack}
                      regionColors={regionColorsBack}
                      onRegionSelect={(regionId) => handleBodyPartToggle(regionId, 'back')}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-xs text-gray-600">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: REGION_DEFAULT_FILL }} />
                      <span>Available region</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: REGION_HOVER_FILL }} />
                      <span>Hover highlight</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: REGION_SELECTED_FILL }} />
                      <span>Active without injuries yet</span>
                    </div>
                  </div>
                  <div className="md:col-span-1 lg:col-span-2">
                    <p className="font-medium text-gray-700 mb-2">Injury type colors</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {INJURY_TYPE_OPTIONS.map(({ code, label }) => (
                        <div key={code} className="flex items-center gap-2 rounded border border-gray-200 px-2 py-1">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: getColorForInjuryCode(code) }}
                          />
                          <span className="text-[11px] font-medium text-gray-700">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Dialog open={Boolean(activeBodyPartSelection)} onOpenChange={(open) => { if (!open) handleCancelInjurySelection(); }}>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-semibold text-gray-800">{activeRegionLabel ? `${activeRegionLabel} Injuries` : 'Select Injuries'}</DialogTitle>
                    <DialogDescription className="text-sm text-gray-500">
                      Choose all injury types that apply to this region. Confirm to lock in your selections.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {INJURY_TYPE_OPTIONS.map(({ code, label }) => {
                      const isActive = pendingInjurySelection.includes(code);
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => handleInjuryTypeToggle(code)}
                          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${isActive ? 'border-orange-500 bg-orange-50 font-semibold text-orange-700' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: getColorForInjuryCode(code) }}
                          />
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {injurySelectionError && (
                    <div className="mt-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                      <XCircle className="h-4 w-4" />
                      <span>{injurySelectionError}</span>
                    </div>
                  )}

                  <div className="mt-6 flex items-center justify-between">
                    <Button type="button" variant="ghost" onClick={handleClearInjurySelection}>
                      Clear Selection
                    </Button>
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" onClick={handleCancelInjurySelection}>
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleConfirmInjurySelection}>
                        Confirm
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="px-6"
                  onClick={handleBack}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition duration-200 ease-in-out"
                  disabled={isLoading}
                >
                  {isLoading ? 'Submitting...' : 'Submit Report'}
                </Button>
              </div>
            </>
          )}
        </form>
      </CardContent>
    </Card> 

    <aside className="xl:sticky xl:top-24 space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
      <Card className="shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-800">Live Summary</CardTitle>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-xs text-gray-500">Snapshot updates as you work through the steps.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <SummaryRow label="Incident Date" value={incidentDate || 'Pending'} />
          <SummaryRow label="Incident Time" value={incidentTime || 'Pending'} />
          <SummaryRow label="Barangay" value={searchTerm || 'Pending'} />
          <SummaryRow label="Incident Type" value={incidentTypes.find(it => String(it.id) === incidentTypeId)?.name ?? 'Pending'} />
          <div className="h-px bg-gray-100" />
          <SummaryRow label="Patient" value={patientName} />
          <SummaryRow label="Contact" value={patientNumber} />
          <SummaryRow label="Age" value={patientAge} />
          <SummaryRow label="Evac Priority" value={evacPriority || 'Pending'} />
          <SummaryRow label="Emergency Type" value={typeOfEmergencySelections.join(', ') || 'Pending'} />
          <div className="h-px bg-gray-100" />
          <SummaryRow label="Front Summary" value={selectedBodyPartsFront.map(part => summarizeBodyPart(part)).join('; ') || '—'} />
          <SummaryRow label="Back Summary" value={selectedBodyPartsBack.map(part => summarizeBodyPart(part)).join('; ') || '—'} />
        </CardContent>
      </Card>

    </aside>

    <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
      <DialogContent className="max-w-sm text-center" showCloseButton={false}>
        <DialogHeader className="items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-semibold text-gray-800">Report Submitted</DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            The incident report was saved successfully. You can review it anytime from the reports history dashboard.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => {
              setIsSuccessDialogOpen(false);
            }}
          >
            Add Another Report
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => {
              setIsSuccessDialogOpen(false);
              onReportSubmitted?.();
            }}
          >
            Back to Dashboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
);
}
