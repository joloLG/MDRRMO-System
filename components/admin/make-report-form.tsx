"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react" // For success/error icons
// Removed next/navigation useRouter; navigation is handled via Links elsewhere

  // Interfaces for data types (re-defined here for clarity, but could be imported)
  interface Report {
    id: string;
    created_at: string; // Used for incident date/time reported
    location_address: string;
    latitude: number; // Added for potential pre-fill
    longitude: number; // Added for potential pre-fill
    firstName: string; // Added for potential pre-fill
    lastName: string; // Added for potential pre-fill
    mobileNumber: string; // Added for potential pre-fill
    emergency_type?: string; // For pre-filling incident type
    er_team_id?: string | number; // For pre-filling ER team (stored as text in DB but er_teams.id is integer)
    casualties?: number; // For pre-filling persons involved
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
  selectedReport: Report | null; // Null for general report, populated for resolved report context
  erTeams: ERTeam[];
  barangays: Barangay[];
  incidentTypes: IncidentType[];
  onReportSubmitted: () => void; // Callback to navigate back or close form
}

const BODY_PARTS_FRONT = [
  'Head',
  'Eyes',
  'Nose',
  'Mouth',
  'Neck',
  'Chest',
  'Upper Abdomen',
  'Lower Abdomen',
  'Pelvis/Groin',
  'Shoulder (Left)',
  'Shoulder (Right)',
  'Upper Arm (Left)',
  'Upper Arm (Right)',
  'Elbow (Left)',
  'Elbow (Right)',
  'Forearm (Left)',
  'Forearm (Right)',
  'Wrist (Left)',
  'Wrist (Right)',
  'Hand (Left)',
  'Hand (Right)',
  'Fingers (Left)',
  'Fingers (Right)',
  'Thigh (Left)',
  'Thigh (Right)',
  'Knee (Left)',
  'Knee (Right)',
  'Shin (Left)',
  'Shin (Right)',
  'Ankle (Left)',
  'Ankle (Right)',
  'Foot (Left)',
  'Foot (Right)',
  'Toes (Left)',
  'Toes (Right)'
];

const BODY_PARTS_BACK = [
  'Head (Back)',
  'Neck (Back)',
  'Upper Back',
  'Lower Back',
  'Shoulder Blade (Left)',
  'Shoulder Blade (Right)',
  'Upper Arm (Left Back)',
  'Upper Arm (Right Back)',
  'Elbow (Left Back)',
  'Elbow (Right Back)',
  'Forearm (Left Back)',
  'Forearm (Right Back)',
  'Wrist (Left Back)',
  'Wrist (Right Back)',
  'Hand (Left Back)',
  'Hand (Right Back)',
  'Fingers (Left Back)',
  'Fingers (Right Back)',
  'Buttocks',
  'Hip (Left Back)',
  'Hip (Right Back)',
  'Hamstring (Left)',
  'Hamstring (Right)',
  'Knee (Left Back)',
  'Knee (Right Back)',
  'Calf (Left)',
  'Calf (Right)',
  'Ankle (Left Back)',
  'Ankle (Right Back)',
  'Heel (Left)',
  'Heel (Right)',
  'Foot (Left Back)',
  'Foot (Right Back)',
  'Toes (Left Back)',
  'Toes (Right Back)'
];

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

const INJURY_TYPE_LOOKUP = INJURY_TYPE_OPTIONS.reduce<Record<string, { code: string; label: string; shortLabel: string }>>((acc, option) => {
  acc[option.code] = option;
  return acc;
}, {});

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
  const [searchTerm, setSearchTerm] = React.useState(''); // For barangay search
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

  const selectedBodyPartsFront = React.useMemo(
    () => BODY_PARTS_FRONT.filter(part => (bodyPartInjuries[part] ?? []).length > 0),
    [bodyPartInjuries]
  );

  const selectedBodyPartsBack = React.useMemo(
    () => BODY_PARTS_BACK.filter(part => (bodyPartInjuries[part] ?? []).length > 0),
    [bodyPartInjuries]
  );

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
    const labels = getInjuryLabels(bodyPartInjuries[part] ?? []);
    const formatted = formatInjuryList(labels);
    return formatted ? `${part} (${formatted})` : part;
  }, [bodyPartInjuries, getInjuryLabels]);

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
        if (preparedBy) return; // don't overwrite if already set
        // Try localStorage first
        const raw = typeof window !== 'undefined' ? localStorage.getItem('mdrrmo_user') : null;
        if (raw) {
          try {
            const u = JSON.parse(raw);
            const full = deriveFullName(u);
            if (full) { setPreparedBy(full); return; }
          } catch {}
        }
        // Fallback: fetch current user profile from Supabase
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

  // Effect to pre-fill form if a selectedReport is provided (from resolved incident)
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
      // Optionally pre-fill other fields if available in selectedReport and relevant for internal_reports
      // For example, if you want to link the original reporter's name or location to the internal report
      // You might need to add corresponding fields to internal_reports table or a notes field.
      // For now, other fields remain empty for admin input as per your request.
    } else {
      // Clear fields for a general report
      setIncidentDate('');
      setIncidentTime('');
      // Only reset these fields when there's no selected report
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
    setFormMessage(null); // Clear messages on report change
  }, [selectedReport]);

  // Auto-fill ER Team, Persons Involved (casualties), and Incident Type based on selected report
  React.useEffect(() => {
    if (!selectedReport) return;

    // Prefill ER Team from the responding team stored on the report
    // Note: emergency_reports.er_team_id is stored as text, but er_teams.id is integer
    if (!erTeamId && selectedReport.er_team_id) {
      // Handle both string and number types for er_team_id
      const teamIdStr = typeof selectedReport.er_team_id === 'string' 
        ? selectedReport.er_team_id 
        : String(selectedReport.er_team_id);
      
      // Only set if the team exists in our erTeams list
      const teamExists = erTeams.find(team => String(team.id) === teamIdStr);
      if (teamExists) {
        setErTeamId(teamIdStr);
      }
    }

    // Prefill Persons Involved from casualties
    if (personsInvolved === '' && typeof selectedReport.casualties === 'number') {
      setPersonsInvolved(String(selectedReport.casualties));
    }

    // Prefill Incident Type by mapping emergency_type to incident_types
    if (!incidentTypeId && selectedReport.emergency_type && incidentTypes.length > 0) {
      // Create mapping from emergency_type to incident_types.name
      const typeMapping: { [key: string]: string } = {
        'Fire Incident': 'Fire Incident',
        'Medical Emergency': 'Medical Emergency', 
        'Vehicular Incident': 'Vehicular/Pedestrian Accident', // or 'Vehicular/Pedestrian Roadcrash Incident'
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
    }
  }, [barangayId, barangays, searchTerm]);

  const handleBarangaySelect = (barangay: Barangay) => {
    setBarangayId(String(barangay.id));
    setSearchTerm(barangay.name);
    setIsBarangayDropdownOpen(false);
  };

  const clearBarangaySelection = () => {
    setBarangayId(undefined);
    setSearchTerm('');
    setIsBarangayDropdownOpen(false);
    setIncidentLocation('');
  };

  const handleToggleTypeOfEmergency = (option: string) => {
    setTypeOfEmergencySelections((prev) =>
      prev.includes(option) ? prev.filter(item => item !== option) : [...prev, option]
    );
  };

  const handleSexSelection = (sex: 'male' | 'female') => {
    setPatientSex((prev) => (prev === sex ? '' : sex));
  };

  const handleEvacPrioritySelection = (priority: string) => {
    setEvacPriority((prev) => (prev === priority ? '' : priority));
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
      if (!incidentDate || !incidentTime || !incidentTypeId || !barangayId || !erTeamId || !preparedBy) {
        setFormMessage({ type: 'error', text: 'Please complete all required fields before proceeding.' });
        return;
      }
      setFormMessage(null);
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!patientName || !patientNumber || !patientBirthday || !patientAge || !patientAddress || !patientSex || !evacPriority || typeOfEmergencySelections.length === 0 || !incidentLocation || !moiPoiToi || !hospitalName || !receivingDate || !emtErtDate) {
        setFormMessage({ type: 'error', text: 'Please complete all Patients Information and Transfer of Care fields before continuing.' });
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage(null); // Clear previous messages
    setIsLoading(true);

    // Basic validation
    if (!incidentDate || !incidentTime || !incidentTypeId || !barangayId || !erTeamId || !preparedBy) {
      setFormMessage({ type: 'error', text: "Please fill in all required fields." });
      setIsLoading(false);
      return;
    }

    if (step !== 3) {
      setFormMessage({ type: 'error', text: 'Please proceed through all form steps before submitting.' });
      setIsLoading(false);
      return;
    }

    if (!patientName || !patientNumber || !patientBirthday || !patientAge || !patientAddress || !patientSex || !evacPriority || typeOfEmergencySelections.length === 0 || !incidentLocation || !moiPoiToi || !hospitalName || !receivingDate || !emtErtDate) {
      setFormMessage({ type: 'error', text: 'Please complete all Patients Information and Transfer of Care fields.' });
      setIsLoading(false);
      return;
    }

    const hasBodyPartSelections = Object.values(bodyPartInjuries).some(list => list.length > 0);
    if (!hasBodyPartSelections) {
      setFormMessage({ type: 'error', text: 'Select at least one body part and confirm its injury types.' });
      setIsLoading(false);
      return;
    }

    const incidentDateTime = new Date(`${incidentDate}T${incidentTime}:00Z`).toISOString(); // UTC timestamp
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
          original_report_id: selectedReport?.id || null, // Link to original if exists
          incident_type_id: parseInt(incidentTypeId),
          incident_date: incidentDateTime,
          time_responded: timeRespondedIso,
          barangay_id: parseInt(barangayId),
          er_team_id: parseInt(erTeamId),
          persons_involved: personsInvolved ? parseInt(personsInvolved) : null,
          number_of_responders: numberOfResponders ? parseInt(numberOfResponders) : null,
          prepared_by: preparedBy,
          created_at: new Date().toISOString(), // Timestamp of internal report creation
          patient_name: patientName,
          patient_contact_number: patientNumber,
          patient_birthday: patientBirthday,
          patient_age: patientAge ? parseInt(patientAge) : null,
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
      resetForm(); // Clear form fields
      // Optional: onReportSubmitted(); // Go back to dashboard after a short delay
    } catch (err: any) {
      console.error("Error submitting internal report:", err);
      setFormMessage({ type: 'error', text: `Failed to submit report: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  return (

    <Card className="shadow-lg h-full lg:col-span-3 rounded-lg">
      <CardHeader className="bg-orange-600 text-white rounded-t-lg p-4 flex justify-between items-center">
        <CardTitle className="text-2xl font-bold">
          {selectedReport ? `Create Report for Incident ID: ${selectedReport.id.substring(0, 8)}...` : 'Create New Incident Report (Manual)'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 bg-white rounded-b-lg">
        <Dialog open={!!activeBodyPartSelection} onOpenChange={(open) => {
          if (!open) handleCancelInjurySelection();
        }}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>
                {activeBodyPartSelection ? `${activeBodyPartSelection.view === 'front' ? 'Front' : 'Back'} Body - ${activeBodyPartSelection.part}` : 'Select Injuries'}
              </DialogTitle>
              <DialogDescription>
                Choose all injury types that apply to this body part, then confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {INJURY_TYPE_OPTIONS.map(({ code, label }) => {
                  const isSelected = pendingInjurySelection.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleInjuryTypeToggle(code)}
                      className={`border rounded-md px-3 py-2 text-sm text-left transition ${isSelected ? 'border-blue-600 bg-blue-50 font-semibold' : 'hover:bg-gray-50'}`}
                    >
                      <span className="font-semibold mr-2">{code}</span>
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="text-xs text-gray-500">
                Injury types will be recorded under this body part once you confirm.
              </div>
              {injurySelectionError && (
                <p className="text-sm text-red-600">{injurySelectionError}</p>
              )}
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={handleClearInjurySelection}>
                Clear Selection
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCancelInjurySelection}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmInjurySelection}>
                  OK
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {formMessage && (
          <div className={`p-3 mb-4 rounded-md flex items-center space-x-2 ${
            formMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {formMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            <p className="text-sm font-medium">{formMessage.text}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 && (
            <>
              <div className="flex items-center justify-between bg-gray-50 border rounded-md px-4 py-2 mb-4">
                <span className="text-sm font-medium text-gray-700">Step 1 of 3: Incident Details</span>
                <span className="text-xs text-gray-500">Complete this section then click Next</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="incidentDate" className="block text-sm font-medium text-gray-700 mb-1">Incident Date</Label>
                  <Input
                    id="incidentDate"
                    type="date"
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                    required
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="incidentTime" className="block text-sm font-medium text-gray-700 mb-1">Time Reported</Label>
                  <Input
                    id="incidentTime"
                    type="time"
                    value={incidentTime}
                    onChange={(e) => setIncidentTime(e.target.value)}
                    required
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="incidentType" className="block text-sm font-medium text-gray-700 mb-1">Incident Type</Label>
                <Select value={incidentTypeId} onValueChange={setIncidentTypeId} required>
                  <SelectTrigger id="incidentType" className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm">
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
                <Label htmlFor="barangaySearch" className="block text-sm font-medium text-gray-700 mb-1">Barangay Name</Label>
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
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
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
                {!barangayId && (
                  <p className="text-xs text-gray-500 mt-1">Select a barangay from the list to continue.</p>
                )}
              </div>

              <div>
                <Label htmlFor="erTeam" className="block text-sm font-medium text-gray-700 mb-1">ER Team</Label>
                <Select value={erTeamId} onValueChange={setErTeamId} required>
                  <SelectTrigger id="erTeam" className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="personsInvolved" className="block text-sm font-medium text-gray-700 mb-1">Number of Persons Involved</Label>
                  <Input
                    id="personsInvolved"
                    type="number"
                    value={personsInvolved}
                    onChange={(e) => setPersonsInvolved(e.target.value)}
                    min="0"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="numberOfResponders" className="block text-sm font-medium text-gray-700 mb-1">Number of Responders (Optional)</Label>
                  <Input
                    id="numberOfResponders"
                    type="number"
                    value={numberOfResponders}
                    onChange={(e) => setNumberOfResponders(e.target.value)}
                    min="0"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus-border-blue-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="timeRespondedDate" className="block text-sm font-medium text-gray-700 mb-1">Responded Date</Label>
                  <Input
                    id="timeRespondedDate"
                    type="date"
                    value={timeRespondedDate}
                    onChange={(e) => setTimeRespondedDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  />
                </div>
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
                <Label htmlFor="preparedBy" className="block text-sm font-medium text-gray-700 mb-1">Prepared By</Label>
                <Input
                  id="preparedBy"
                  type="text"
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition duration-200 ease-in-out"
                  onClick={handleNextStep}
                >
                  Next
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-center justify-between bg-gray-50 border rounded-md px-4 py-2 mb-4">
                <span className="text-sm font-medium text-gray-700">Step 2 of 3: Patients Information & Transfer of Care</span>
                <span className="text-xs text-gray-500">Review before proceeding</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="patientName" className="block text-sm font-medium text-gray-700 mb-1">Patient's Name</Label>
                  <Input
                    id="patientName"
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    required
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="patientNumber" className="block text-sm font-medium text-gray-700 mb-1">Patient's Contact Number</Label>
                  <Input
                    id="patientNumber"
                    type="tel"
                    value={patientNumber}
                    onChange={(e) => setPatientNumber(e.target.value)}
                    required
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="patientBirthday" className="block text-sm font-medium text-gray-700 mb-1">Birthday</Label>
                  <Input
                    id="patientBirthday"
                    type="date"
                    value={patientBirthday}
                    onChange={(e) => setPatientBirthday(e.target.value)}
                    required
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="patientAge" className="block text-sm font-medium text-gray-700 mb-1">Age</Label>
                  <Input
                    id="patientAge"
                    type="number"
                    min="0"
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                    required
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="patientSex" className="block text-sm font-medium text-gray-700 mb-1">Sex</Label>
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
                </div>
              </div>

              <div>
                <Label htmlFor="patientAddress" className="block text-sm font-medium text-gray-700 mb-1">Patient's Address</Label>
                <Input
                  id="patientAddress"
                  type="text"
                  value={patientAddress}
                  onChange={(e) => setPatientAddress(e.target.value)}
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus-border-blue-500 shadow-sm"
                />
              </div>

              <div className="rounded-lg border shadow-sm p-4 bg-white">
                <Label className="block text-sm font-medium text-gray-700 mb-1">Evacuation Priority</Label>
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
              </div>
              <div className="rounded-lg border shadow-sm p-4 bg-white">
                <Label className="block text-sm font-medium text-gray-700 mb-1">Type of Emergency</Label>
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
                  <Label htmlFor="incidentLocation" className="block text-sm font-medium text-gray-700 mb-1">Incident Location</Label>
                  <Input
                    id="incidentLocation"
                    type="text"
                    value={incidentLocation}
                    onChange={(e) => setIncidentLocation(e.target.value)}
                    required
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus-border-blue-500 shadow-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-filled from barangay selection. You may adjust if needed.</p>
                </div>
                <div>
                  <Label htmlFor="moiPoiToi" className="block text-sm font-medium text-gray-700 mb-1">MOI / POI / TOI</Label>
                  <Textarea
                    id="moiPoiToi"
                    value={moiPoiToi}
                    onChange={(e) => setMoiPoiToi(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                    rows={4}
                  />
                </div>
              </div>

              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Transfer of Care</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="hospitalName" className="block text-sm font-medium text-gray-700 mb-1">Hospital Name</Label>
                    <Input
                      id="hospitalName"
                      type="text"
                      value={hospitalName}
                      onChange={(e) => setHospitalName(e.target.value)}
                      required
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="receivingDate" className="block text-sm font-medium text-gray-700 mb-1">Receiving Date</Label>
                    <Input
                      id="receivingDate"
                      type="date"
                      value={receivingDate}
                      onChange={(e) => setReceivingDate(e.target.value)}
                      required
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus-border-blue-500 shadow-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emtErtDate" className="block text-sm font-medium text-gray-700 mb-1">EMT / ERT Date</Label>
                    <Input
                      id="emtErtDate"
                      type="date"
                      value={emtErtDate}
                      onChange={(e) => setEmtErtDate(e.target.value)}
                      required
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus-border-blue-500 shadow-sm"
                    />
                  </div>
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
              <div className="flex items-center justify-between bg-gray-50 border rounded-md px-4 py-2 mb-4">
                <span className="text-sm font-medium text-gray-700">Step 3 of 3: Body Part & Injury Details</span>
                <span className="text-xs text-gray-500">Select affected areas and injury types</span>
              </div>

              <div className="rounded-lg border shadow-sm p-4 bg-white">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Body Diagram</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-3">Front View</p>
                    <div className="grid gap-2 max-h-64 overflow-y-auto pr-1">
                      {BODY_PARTS_FRONT.map((part) => {
                        const isSelected = selectedBodyPartsFront.includes(part);
                        const injuries = bodyPartInjuries[part] ?? [];
                        const displayInjuries = injuries.length > 0 ? formatInjuryList(getInjuryLabels(injuries)) : null;
                        return (
                          <button
                            key={part}
                            type="button"
                            onClick={() => handleBodyPartToggle(part, 'front')}
                            className={`text-left border rounded-md px-3 py-2 transition ${isSelected ? 'border-blue-600 bg-blue-50 font-semibold' : 'hover:bg-gray-50'}`}
                          >
                            <span className="text-sm font-medium text-gray-800">{part}</span>
                            {displayInjuries && (
                              <span className="mt-1 block text-xs text-gray-600">
                                {displayInjuries}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-3">Back View</p>
                    <div className="grid gap-2 max-h-64 overflow-y-auto pr-1">
                      {BODY_PARTS_BACK.map((part) => {
                        const isSelected = selectedBodyPartsBack.includes(part);
                        const injuries = bodyPartInjuries[part] ?? [];
                        const displayInjuries = injuries.length > 0 ? formatInjuryList(getInjuryLabels(injuries)) : null;
                        return (
                          <button
                            key={part}
                            type="button"
                            onClick={() => handleBodyPartToggle(part, 'back')}
                            className={`text-left border rounded-md px-3 py-2 transition ${isSelected ? 'border-blue-600 bg-blue-50 font-semibold' : 'hover:bg-gray-50'}`}
                          >
                            <span className="text-sm font-medium text-gray-800">{part}</span>
                            {displayInjuries && (
                              <span className="mt-1 block text-xs text-gray-600">
                                {displayInjuries}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-xs text-gray-500">
                  Click a body region to assign injuries. A selection dialog will appear for you to confirm the injury types.
                </div>
              </div>

              <div className="rounded-lg border shadow-sm p-4 bg-white">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Selected Body Parts & Injuries</h3>
                {Object.keys(bodyPartInjuries).length === 0 ? (
                  <p className="text-sm text-gray-600">
                    No injuries recorded yet. Select a body part above to add the corresponding injury details.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {selectedBodyPartsFront.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">Front Body</p>
                        <ul className="list-disc ml-5 space-y-1 text-sm text-gray-700">
                          {selectedBodyPartsFront.map(part => (
                            <li key={part}>{summarizeBodyPart(part)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedBodyPartsBack.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">Back Body</p>
                        <ul className="list-disc ml-5 space-y-1 text-sm text-gray-700">
                          {selectedBodyPartsBack.map(part => (
                            <li key={part}>{summarizeBodyPart(part)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {uniqueInjurySummary && (
                      <div className="text-sm text-gray-600">
                        <span className="font-semibold text-gray-700">Injury Types:</span> {uniqueInjurySummary}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-lg border shadow-sm p-4 bg-white">
                <Label htmlFor="bodyPartNotes" className="block text-sm font-medium text-gray-700 mb-1">Additional Notes (Optional)</Label>
                <Textarea
                  id="bodyPartNotes"
                  value={moiPoiToi}
                  onChange={(e) => setMoiPoiToi(e.target.value)}
                  placeholder="Describe specifics about injuries, mechanism, or other observations."
                  className="w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  rows={4}
                />
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
  )
}
