"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, getWeek, getDate, getMonth, getYear, eachDayOfInterval, eachMonthOfInterval } from 'date-fns';
import { Calendar as CalendarIcon, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Define Report interface (from emergency_reports)
interface EmergencyReport {
  id: string;
  emergency_type: string;
  status: string;
  created_at: string; // Timestamp from emergency_reports
}

// Define InternalReport interface
interface InternalReport {
  id: number;
  incident_type_id: number;
  incident_date: string; // Timestamp from internal_reports
  barangay_id: number;
  created_at: string;
}

// Define BaseEntry for reference tables
interface BaseEntry {
  id: number;
  name: string;
}

interface ChartsDashboardProps {
  allEmergencyReports: EmergencyReport[];
  allInternalReports: InternalReport[];
  barangays: BaseEntry[];
  incidentTypes: BaseEntry[];
}

// Custom Tooltip for Pie Chart
const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 bg-white border border-gray-300 rounded-md shadow-md text-sm">
        <p className="font-semibold">{`${payload[0].name}: ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Bar Chart
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 bg-white border border-gray-300 rounded-md shadow-md text-sm">
        <p className="font-semibold">{`${label}`}</p>
        {payload.map((entry: any, index: number) => (
          <p key={`item-${index}`} style={{ color: entry.color }}>
            {`${entry.name}: ${entry.value}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function ChartsDashboard({ allEmergencyReports, allInternalReports, barangays, incidentTypes }: ChartsDashboardProps) {
  // State for Pie Chart (Barangay Incidents)
  const [pieChartPeriod, setPieChartPeriod] = React.useState<string>('daily'); // 'daily', 'weekly', 'monthly', 'yearly'
  const [pieChartDate, setPieChartDate] = React.useState<Date | undefined>(new Date()); // For daily/weekly
  const [pieChartMonth, setPieChartMonth] = React.useState<string>(format(new Date(), 'MM')); // For monthly
  const [pieChartYear, setPieChartYear] = React.useState<string>(format(new Date(), 'yyyy')); // For monthly/yearly
  const [pieStartDateRange, setPieStartDateRange] = React.useState<Date | undefined>(new Date()); // For weekly range
  const [pieEndDateRange, setPieEndDateRange] = React.useState<Date | undefined>(new Date()); // For weekly range
  const [pieStartTime, setPieStartTime] = React.useState<string>('00:00'); // HH:MM
  const [pieEndTime, setPieEndTime] = React.useState<string>('23:59'); // HH:MM

  // State for Bar Chart (Incident Types)
  const [barIncidentPeriod, setBarIncidentPeriod] = React.useState<string>('monthly'); // 'monthly', 'yearly'
  const [barIncidentMonth, setBarIncidentMonth] = React.useState<string>(format(new Date(), 'MM')); // For monthly
  const [barIncidentYear, setBarIncidentYear] = React.useState<string>(format(new Date(), 'yyyy')); // For monthly/yearly

  // State for Bar Chart (Report Status Counts)
  const [barStatusPeriod, setBarStatusPeriod] = React.useState<string>('daily'); // 'daily', 'weekly', 'monthly', 'yearly'
  const [barStatusDate, setBarStatusDate] = React.useState<Date | undefined>(new Date()); // For daily/weekly
  const [barStatusMonth, setBarStatusMonth] = React.useState<string>(format(new Date(), 'MM')); // For monthly
  const [barStatusYear, setBarStatusYear] = React.useState<string>(format(new Date(), 'yyyy')); // For monthly/yearly
  const [barStatusStartDateRange, setBarStatusStartDateRange] = React.useState<Date | undefined>(new Date()); // For weekly range
  const [barStatusEndDateRange, setBarStatusEndDateRange] = React.useState<Date | undefined>(new Date()); // For weekly range


  // Generate years for dropdowns (e.g., current year - 5 to current year + 1)
  const years = React.useMemo(() => {
    const currentYearNum = new Date().getFullYear();
    const yearsArray = [];
    for (let i = currentYearNum - 5; i <= currentYearNum + 1; i++) {
      yearsArray.push(String(i));
    }
    return yearsArray;
  }, []);

  // Months for dropdowns
  const months = [
    { value: '01', label: 'January' }, { value: '02', label: 'February' }, { value: '03', label: 'March' },
    { value: '04', label: 'April' }, { value: '05', label: 'May' }, { value: '06', label: 'June' },
    { value: '07', label: 'July' }, { value: '08', label: 'August' }, { value: '09', label: 'September' },
    { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];

  // Colors for Incident Types Bar Chart
  const INCIDENT_TYPE_COLORS = [
    '#4CAF50', '#2196F3', '#FFC107', '#FF5722', '#9C27B0', '#00BCD4', '#FFEB3B', '#8BC34A', '#E91E63', '#607D8B'
  ];

  // Helper function to get color for an incident type
  const getIncidentTypeColor = (index: number) => INCIDENT_TYPE_COLORS[index % INCIDENT_TYPE_COLORS.length];

  // --- Data Processing for Charts ---

  // Helper to get date range based on period and selected date/month/year
  const getPeriodDateRange = (period: string, date?: Date, month?: string, year?: string, startDateRange?: Date, endDateRange?: Date) => {
    let start: Date;
    let end: Date;

    const currentSelectedDate = date || new Date(); // Fallback to current date if undefined

    switch (period) {
      case 'daily':
        start = startOfDay(currentSelectedDate);
        end = endOfDay(currentSelectedDate);
        break;
      case 'weekly':
        start = startDateRange ? startOfDay(startDateRange) : startOfWeek(currentSelectedDate, { weekStartsOn: 0 });
        end = endDateRange ? endOfDay(endDateRange) : endOfWeek(currentSelectedDate, { weekStartsOn: 0 });
        break;
      case 'monthly':
        const monthDate = new Date(parseInt(year || format(new Date(), 'yyyy')), parseInt(month || format(new Date(), 'MM')) - 1, 1);
        start = startOfMonth(monthDate);
        end = endOfMonth(monthDate);
        break;
      case 'yearly':
        const yearDate = new Date(parseInt(year || format(new Date(), 'yyyy')), 0, 1);
        start = startOfYear(yearDate);
        end = endOfYear(yearDate);
        break;
      default: // Default to daily if period is not recognized
        start = startOfDay(currentSelectedDate);
        end = endOfDay(currentSelectedDate);
    }
    return { start, end };
  };

  // Pie Chart Data: Incidents per Barangay
  const getBarangayIncidentData = React.useCallback(() => {
    const { start: periodStart, end: periodEnd } = getPeriodDateRange(
      pieChartPeriod,
      pieChartDate,
      pieChartMonth,
      pieChartYear,
      pieStartDateRange,
      pieEndDateRange
    );

    const [startHour, startMinute] = pieStartTime.split(':').map(Number);
    const [endHour, endMinute] = pieEndTime.split(':').map(Number);

    const filterStart = new Date(periodStart);
    filterStart.setHours(startHour, startMinute, 0, 0);

    const filterEnd = new Date(periodEnd);
    filterEnd.setHours(endHour, endMinute, 59, 999);

    const filteredReports = allInternalReports.filter(report => {
      const incidentDate = parseISO(report.incident_date);
      return incidentDate >= filterStart && incidentDate <= filterEnd;
    });

    const barangayCounts: { [key: string]: number } = {};
    filteredReports.forEach(report => {
      const barangayName = barangays.find(b => b.id === report.barangay_id)?.name || 'Unknown Barangay';
      barangayCounts[barangayName] = (barangayCounts[barangayName] || 0) + 1;
    });

    return Object.keys(barangayCounts).map(name => ({
      name,
      value: barangayCounts[name],
    }));
  }, [allInternalReports, barangays, pieChartPeriod, pieChartDate, pieChartMonth, pieChartYear, pieStartDateRange, pieEndDateRange, pieStartTime, pieEndTime]);

  const pieChartData = getBarangayIncidentData();
  const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c', '#00bfa5'];


  // Bar Chart Data: Incident Types (Monthly/Yearly)
  const getIncidentTypeBarData = React.useCallback(() => {
    const currentYear = parseInt(barIncidentYear || format(new Date(), 'yyyy'));
    const currentMonth = parseInt(barIncidentMonth || format(new Date(), 'MM'));

    if (barIncidentPeriod === 'yearly') {
      // Data for yearly view (months on X-axis, incident types as bars)
      const data: { [key: string]: any }[] = eachMonthOfInterval({
        start: new Date(currentYear, 0, 1),
        end: new Date(currentYear, 11, 31)
      }).map(date => {
        const monthLabel = format(date, 'MMM');
        const monthData: { [key: string]: any } = { month: monthLabel };
        incidentTypes.forEach(type => {
          monthData[type.name] = 0; // Initialize counts for all incident types to 0
        });
        return monthData;
      });

      allInternalReports.forEach(report => {
        const incidentDate = parseISO(report.incident_date);
        if (incidentDate.getFullYear() === currentYear) {
          const monthIndex = incidentDate.getMonth(); // 0-11
          const incidentTypeName = incidentTypes.find(it => it.id === report.incident_type_id)?.name;
          if (incidentTypeName) {
            data[monthIndex][incidentTypeName]++;
          }
        }
      });
      return data;

    } else { // barIncidentPeriod === 'monthly'
      // Data for monthly view (days on X-axis, incident types as bars)
      const { start: periodStart, end: periodEnd } = getPeriodDateRange(
        barIncidentPeriod,
        undefined,
        barIncidentMonth,
        barIncidentYear
      );

      const data: { [key: string]: any }[] = eachDayOfInterval({
        start: periodStart,
        end: periodEnd
      }).map(date => {
        const dayLabel = format(date, 'd'); // Day of month
        const dayData: { [key: string]: any } = { day: dayLabel };
        incidentTypes.forEach(type => {
          dayData[type.name] = 0; // Initialize counts for all incident types to 0
        });
        return dayData;
      });

      allInternalReports.forEach(report => {
        const incidentDate = parseISO(report.incident_date);
        if (incidentDate >= periodStart && incidentDate <= periodEnd) {
          const dayOfMonth = incidentDate.getDate(); // 1-31
          const incidentTypeName = incidentTypes.find(it => it.id === report.incident_type_id)?.name;
          if (incidentTypeName) {
            // Find the correct day object in the data array
            const targetDayData = data.find(item => parseInt(item.day) === dayOfMonth);
            if (targetDayData) {
              targetDayData[incidentTypeName]++;
            }
          }
        }
      });
      return data;
    }
  }, [allInternalReports, incidentTypes, barIncidentPeriod, barIncidentMonth, barIncidentYear]);

  const incidentTypeBarData = getIncidentTypeBarData();


  // Bar Chart Data: Report Status Counts (Daily/Weekly/Monthly/Yearly)
  const getReportStatusData = React.useCallback(() => {
    const { start: periodStart, end: periodEnd } = getPeriodDateRange(
      barStatusPeriod,
      barStatusDate,
      barStatusMonth,
      barStatusYear,
      barStatusStartDateRange,
      barStatusEndDateRange
    );

    const filteredReports = allEmergencyReports.filter(report => {
      const reportDate = parseISO(report.created_at);
      return reportDate >= periodStart && reportDate <= periodEnd;
    });

    const allCount = filteredReports.length;
    const resolvedCount = filteredReports.filter(r => r.status.trim().toLowerCase() === 'resolved').length;
    const activeCount = filteredReports.filter(r => r.status.trim().toLowerCase() === 'pending' || r.status.trim().toLowerCase() === 'active' || r.status.trim().toLowerCase() === 'responded').length;

    return [
      { name: 'All Reports', count: allCount, color: '#0088FE' },
      { name: 'Active/In-Progress', count: activeCount, color: '#FFBB28' },
      { name: 'Resolved', count: resolvedCount, color: '#00C49F' },
    ];
  }, [allEmergencyReports, barStatusPeriod, barStatusDate, barStatusMonth, barStatusYear, barStatusStartDateRange, barStatusEndDateRange]);

  const reportStatusBarData = getReportStatusData();

  // --- PDF Download Function ---
  const handleDownloadPdf = async (chartId: string, chartTitle: string) => {
    const chartElement = document.getElementById(chartId);
    if (!chartElement) {
      console.error(`Chart element with ID ${chartId} not found.`);
      return;
    }

    // Temporarily hide scrollbars if they appear on elements, for cleaner capture
    const originalOverflow = chartElement.style.overflow;
    chartElement.style.overflow = 'hidden';

    try {
      const canvas = await html2canvas(chartElement, {
        scale: 2, // Increase scale for better resolution
        useCORS: true, // Important if your charts load external resources (e.g., fonts, images)
        logging: true,
      });

      chartElement.style.overflow = originalOverflow; // Restore original overflow

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = canvas.height * imgWidth / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${chartTitle.replace(/\s/g, '_').toLowerCase()}_chart.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      chartElement.style.overflow = originalOverflow; // Ensure overflow is restored even on error
    }
  };


  // --- Render ---

  return (
    <div className="grid grid-cols-1 gap-6"> {/* Removed lg:col-span-2 xl:col-span-3 from parent grid */}
      {/* Pie Chart: Incidents per Barangay */}
      <Card id="barangay-incident-chart" className="shadow-lg col-span-full"> {/* Changed to col-span-full */}
        <CardHeader className="bg-gray-800 text-white rounded-t-lg p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold">Incidents by Barangay</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-gray-700"
            onClick={() => handleDownloadPdf('barangay-incident-chart', 'Barangay Incidents')}
          >
            <Download className="h-4 w-4 mr-2" /> PDF
          </Button>
        </CardHeader>
        <CardContent className="p-6 bg-white rounded-b-lg">
          <p className="text-sm text-gray-600 mb-4">Filter by period, date range, and time range for admin-recorded incidents.</p>
          <div className="flex flex-col gap-4 mb-6">
            <Select value={pieChartPeriod} onValueChange={setPieChartPeriod}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Day</SelectItem>
                <SelectItem value="weekly">Week</SelectItem>
                <SelectItem value="monthly">Month</SelectItem>
                <SelectItem value="yearly">Year</SelectItem>
              </SelectContent>
            </Select>

            {pieChartPeriod === 'daily' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !pieChartDate && "text-muted-foreground"
                    )}
                  >
                    <span> {/* Added span to wrap children */}
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {pieChartDate ? format(pieChartDate, "PPP") : <span>Select Day</span>}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={pieChartDate}
                    onSelect={setPieChartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}

            {pieChartPeriod === 'weekly' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !pieStartDateRange && "text-muted-foreground"
                      )}
                    >
                      <span> {/* Added span to wrap children */}
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {pieStartDateRange ? format(pieStartDateRange, "PPP") : <span>Start Date</span>}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={pieStartDateRange}
                      onSelect={setPieStartDateRange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !pieEndDateRange && "text-muted-foreground"
                      )}
                    >
                      <span> {/* Added span to wrap children */}
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {pieEndDateRange ? format(pieEndDateRange, "PPP") : <span>End Date</span>}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={pieEndDateRange}
                      onSelect={setPieEndDateRange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {(pieChartPeriod === 'monthly' || pieChartPeriod === 'yearly') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pieChartPeriod === 'monthly' && (
                  <Select value={pieChartMonth} onValueChange={setPieChartMonth}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map(month => (
                        <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={pieChartYear} onValueChange={setPieChartYear}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                type="time"
                value={pieStartTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPieStartTime(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
              />
              <Input
                type="time"
                value={pieEndTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPieEndTime(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
              />
            </div>
          </div>
          {pieChartData.length > 0 ? (
            // Re-typed ResponsiveContainer and its child PieChart
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ paddingLeft: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-500 h-[350px] flex items-center justify-center">
              No incident data for the selected filters.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bar Chart: Incident Types (Monthly/Yearly) */}
      <Card id="incident-type-chart" className="shadow-lg col-span-full"> {/* Changed to col-span-full */}
        <CardHeader className="bg-gray-800 text-white rounded-t-lg p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold">Incident Types by Period</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-gray-700"
            onClick={() => handleDownloadPdf('incident-type-chart', 'Incident Types')}
          >
            <Download className="h-4 w-4 mr-2" /> PDF
          </Button>
        </CardHeader>
        <CardContent className="p-6 bg-white rounded-b-lg">
          <p className="text-sm text-gray-600 mb-4">Filter by month or year for incidents recorded by admin.</p>
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
            <Select value={barIncidentPeriod} onValueChange={setBarIncidentPeriod}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Select Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Month</SelectItem>
                <SelectItem value="yearly">Year</SelectItem>
              </SelectContent>
            </Select>
            {barIncidentPeriod === 'monthly' && (
              <Select value={barIncidentMonth} onValueChange={setBarIncidentMonth}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={barIncidentYear} onValueChange={setBarIncidentYear}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {incidentTypeBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>                  
              <BarChart
                data={incidentTypeBarData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                {barIncidentPeriod === 'yearly' ? (
                  <XAxis dataKey="month" />
                ) : (
                  <XAxis dataKey="day" />
                )}
                <YAxis allowDecimals={false} />
                <Tooltip content={<CustomBarTooltip />} />
                <Legend />
                {incidentTypes.map((type, index) => (
                  <Bar
                    key={type.id}
                    dataKey={type.name}
                    fill={getIncidentTypeColor(index)}
                    name={type.name}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-500 h-[350px] flex items-center justify-center"> {/* Adjusted height */}
              No incident type data for the selected period.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bar Chart: All Reports, Active, Resolved (Daily/Weekly/Monthly/Yearly) */}
      <Card id="report-status-chart" className="shadow-lg col-span-full"> {/* Changed to col-span-full */}
        <CardHeader className="bg-gray-800 text-white rounded-t-lg p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold">Emergency Report Status Overview</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-gray-700"
            onClick={() => handleDownloadPdf('report-status-chart', 'Report Status Overview')}
          >
            <Download className="h-4 w-4 mr-2" /> PDF
          </Button>
        </CardHeader>
        <CardContent className="p-6 bg-white rounded-b-lg">
          <p className="text-sm text-gray-600 mb-4">Filter by period and date for all emergency reports.</p>
          <div className="flex flex-col gap-4 mb-6">
            <Select value={barStatusPeriod} onValueChange={setBarStatusPeriod}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Day</SelectItem>
                <SelectItem value="weekly">Week</SelectItem>
                <SelectItem value="monthly">Month</SelectItem>
                <SelectItem value="yearly">Year</SelectItem>
              </SelectContent>
            </Select>

            {barStatusPeriod === 'daily' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !barStatusDate && "text-muted-foreground"
                    )}
                  >
                    <span> {/* Added span to wrap children */}
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {barStatusDate ? format(barStatusDate, "PPP") : <span>Select Day</span>}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={barStatusDate}
                    onSelect={setBarStatusDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}

            {barStatusPeriod === 'weekly' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !barStatusStartDateRange && "text-muted-foreground"
                      )}
                    >
                      <span> {/* Added span to wrap children */}
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {barStatusStartDateRange ? format(barStatusStartDateRange, "PPP") : <span>Start Date</span>}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={barStatusStartDateRange}
                      onSelect={setBarStatusStartDateRange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !barStatusEndDateRange && "text-muted-foreground"
                      )}
                    >
                      <span> {/* Added span to wrap children */}
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {barStatusEndDateRange ? format(barStatusEndDateRange, "PPP") : <span>End Date</span>}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={barStatusEndDateRange}
                      onSelect={setBarStatusEndDateRange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {(barStatusPeriod === 'monthly' || barStatusPeriod === 'yearly') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {barStatusPeriod === 'monthly' && (
                  <Select value={barStatusMonth} onValueChange={setBarStatusMonth}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map(month => (
                        <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={barStatusYear} onValueChange={setBarStatusYear}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {reportStatusBarData.length > 0 && reportStatusBarData.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={reportStatusBarData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip content={<CustomBarTooltip />} />
                <Legend />
                <Bar dataKey="count">
                  {reportStatusBarData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-500 h-[300px] flex items-center justify-center">
              No emergency report data for the selected period.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
