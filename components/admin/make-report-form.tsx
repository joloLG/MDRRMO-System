"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { CheckCircle2, XCircle } from "lucide-react" // For success/error icons

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

export function MakeReportForm({ selectedReport, erTeams, barangays, incidentTypes, onReportSubmitted }: MakeReportFormProps) {
  const [incidentDate, setIncidentDate] = React.useState('');
  const [incidentTime, setIncidentTime] = React.useState('');
  const [incidentTypeId, setIncidentTypeId] = React.useState<string | undefined>(undefined);
  const [barangayId, setBarangayId] = React.useState<string | undefined>(undefined);
  const [erTeamId, setErTeamId] = React.useState<string | undefined>(undefined);
  const [personsInvolved, setPersonsInvolved] = React.useState<string>('');
  const [numberOfResponders, setNumberOfResponders] = React.useState<string>('');
  const [preparedBy, setPreparedBy] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [formMessage, setFormMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [searchTerm, setSearchTerm] = React.useState(''); // For barangay search

  // Effect to pre-fill form if a selectedReport is provided (from resolved incident)
  React.useEffect(() => {
    if (selectedReport) {
      const reportDate = new Date(selectedReport.created_at);
      setIncidentDate(reportDate.toISOString().split('T')[0]); // YYYY-MM-DD
      setIncidentTime(reportDate.toTimeString().split(' ')[0].substring(0, 5)); // HH:MM
      // Optionally pre-fill other fields if available in selectedReport and relevant for internal_reports
      // For example, if you want to link the original reporter's name or location to the internal report
      // You might need to add corresponding fields to internal_reports table or a notes field.
      // For now, other fields remain empty for admin input as per your request.
    } else {
      // Clear fields for a general report
      setIncidentDate('');
      setIncidentTime('');
    }
    setIncidentTypeId(undefined);
    setBarangayId(undefined);
    setErTeamId(undefined);
    setPersonsInvolved('');
    setNumberOfResponders('');
    setPreparedBy('');
    setFormMessage(null); // Clear messages on report change
    setSearchTerm(''); // Clear search term
  }, [selectedReport]);

  const filteredBarangays = barangays.filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setIncidentDate('');
    setIncidentTime('');
    setIncidentTypeId(undefined);
    setBarangayId(undefined);
    setErTeamId(undefined);
    setPersonsInvolved('');
    setNumberOfResponders('');
    setPreparedBy('');
    setSearchTerm('');
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

    const incidentDateTime = new Date(`${incidentDate}T${incidentTime}:00Z`).toISOString(); // UTC timestamp

    try {
      const { data, error } = await supabase
        .from('internal_reports')
        .insert({
          original_report_id: selectedReport?.id || null, // Link to original if exists
          incident_type_id: parseInt(incidentTypeId),
          incident_date: incidentDateTime,
          time_responded: null, // Admin can update this later if needed
          barangay_id: parseInt(barangayId),
          er_team_id: parseInt(erTeamId),
          persons_involved: personsInvolved ? parseInt(personsInvolved) : null,
          number_of_responders: numberOfResponders ? parseInt(numberOfResponders) : null,
          prepared_by: preparedBy,
          created_at: new Date().toISOString(), // Timestamp of internal report creation
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
      <CardHeader className="bg-gray-800 text-white rounded-t-lg p-4">
        <CardTitle className="text-2xl font-bold">
          {selectedReport ? `Create Report for Incident ID: ${selectedReport.id.substring(0, 8)}...` : 'Create New Incident Report (Manual)'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 bg-white rounded-b-lg">
        {formMessage && (
          <div className={`p-3 mb-4 rounded-md flex items-center space-x-2 ${
            formMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {formMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            <p className="text-sm font-medium">{formMessage.text}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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

          <div>
            <Label htmlFor="barangayName" className="block text-sm font-medium text-gray-700 mb-1">Barangay Name</Label>
            <Input
              type="text"
              placeholder="Search or select barangay..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm mb-2"
            />
            <Select value={barangayId} onValueChange={setBarangayId} required>
              <SelectTrigger id="barangayName" className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm">
                <SelectValue placeholder="Select barangay" />
              </SelectTrigger>
              <SelectContent className="bg-white rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
                {filteredBarangays.length > 0 ? (
                  filteredBarangays.map(barangay => (
                    <SelectItem key={barangay.id} value={String(barangay.id)} className="p-2 hover:bg-gray-100 cursor-pointer">
                      {barangay.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-center text-gray-500">No matching barangays.</div>
                )}
              </SelectContent>
            </Select>
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
              <Label htmlFor="personsInvolved" className="block text-sm font-medium text-gray-700 mb-1">Persons Involved (Optional)</Label>
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

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition duration-200 ease-in-out"
            disabled={isLoading}
          >
            {isLoading ? 'Submitting Report...' : 'Submit Report'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}