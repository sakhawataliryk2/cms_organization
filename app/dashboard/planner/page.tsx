'use client';

import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiX, FiPrinter, FiLock, FiUnlock, FiArrowUp, FiArrowDown, FiFilter } from 'react-icons/fi';
import { initializeOffice365Auth, isOffice365Authenticated, disconnectOffice365 } from '@/lib/office365';
import { TbGripVertical } from 'react-icons/tb';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import RecordNameResolver from '@/components/RecordNameResolver';

interface Appointment {
  id: number;
  date: string;
  start_time?: string;
  time: string;
  type: string;
  participant_type?: string;
  participant_id?: number;
  job_id?: number;
  client: string;
  job: string;
  references: string[];
  owner: string;
  owner_id?: number;
  description?: string;
  location?: string;
  duration?: number;
  status?: 'scheduled' | 'live' | 'completed';
  zoom_meeting_id?: number;
  zoom_join_url?: string;
  zoom_start_url?: string;
  zoom_password?: string;
}

type ColumnSortState = "asc" | "desc" | null;
type ColumnFilterState = string | null;

// Sortable Column Header Component
function SortableColumnHeader({
  id,
  columnKey,
  label,
  sortState,
  filterValue,
  onSort,
  onFilterChange,
  filterType,
  filterOptions,
}: {
  id: string;
  columnKey: string;
  label: string;
  sortState: ColumnSortState;
  filterValue: ColumnFilterState;
  onSort: () => void;
  onFilterChange: (value: string) => void;
  filterType: "text" | "select" | "number";
  filterOptions?: { label: string; value: string }[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterToggleRef = useRef<HTMLButtonElement>(null);
  const thRef = useRef<HTMLTableCellElement | null>(null);
  const [filterPosition, setFilterPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!showFilter || !filterToggleRef.current || !thRef.current) {
      setFilterPosition(null);
      return;
    }
    const btnRect = filterToggleRef.current.getBoundingClientRect();
    const thRect = thRef.current.getBoundingClientRect();
    setFilterPosition({
      top: btnRect.bottom + 4,
      left: thRect.left,
      width: Math.max(150, Math.min(250, thRect.width)),
    });
  }, [showFilter]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest(`[data-filter-toggle="${id}"]`)
      ) {
        setShowFilter(false);
      }
    };

    if (showFilter) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showFilter, id]);

  return (
    <th
      ref={(node) => {
        thRef.current = node;
        setNodeRef(node);
      }}
      style={style}
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border-r border-gray-200 relative group"
    >
      <div className="flex items-center gap-2">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder column"
          onClick={(e) => e.stopPropagation()}
        >
          <TbGripVertical size={16} />
        </button>

        {/* Column Label */}
        <span className="flex-1">{label}</span>

        {/* Sort Control */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSort();
          }}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title={sortState === "asc" ? "Sort descending" : sortState === "desc" ? "Sort ascending" : "Sort"}
        >
          {sortState === "asc" ? (
            <FiArrowUp size={14} />
          ) : sortState === "desc" ? (
            <FiArrowDown size={14} />
          ) : (
            <FiArrowDown size={14} className="opacity-30" />
          )}
        </button>

        {/* Filter Toggle */}
        <button
          ref={filterToggleRef}
          data-filter-toggle={id}
          onClick={(e) => {
            e.stopPropagation();
            setShowFilter(!showFilter);
          }}
          className={`text-gray-400 hover:text-gray-600 transition-colors ${filterValue ? "text-blue-600" : ""
            }`}
          title="Filter column"
        >
          <FiFilter size={14} />
        </button>
      </div>

      {/* Filter Dropdown (portal so it stays on top) */}
      {showFilter && filterPosition && typeof document !== "undefined" && createPortal(
        <div
          ref={filterRef}
          className="bg-white border border-gray-300 shadow-lg rounded p-2 z-50 min-w-[150px]"
          style={{
            position: "fixed",
            top: filterPosition.top,
            left: filterPosition.left,
            width: filterPosition.width,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {filterType === "text" && (
            <input
              type="text"
              value={filterValue || ""}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder={`Filter ${label.toLowerCase()}...`}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          )}
          {filterType === "number" && (
            <input
              type="number"
              value={filterValue || ""}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder={`Filter ${label.toLowerCase()}...`}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          )}
          {filterType === "select" && filterOptions && (
            <select
              value={filterValue || ""}
              onChange={(e) => onFilterChange(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            >
              <option value="">All</option>
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
          {filterValue && (
            <button
              onClick={() => {
                onFilterChange("");
                setShowFilter(false);
              }}
              className="mt-2 w-full px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
            >
              Clear Filter
            </button>
          )}
        </div>,
        document.body
      )}
    </th>
  );
}

const Planners = () => {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewType, setViewType] = useState<'Month' | 'Week' | 'Day' | 'List'>('Month');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPinned, setIsPinned] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    date: '',
    time: '',
    type: '',
    participant_type: '',
    participant_id: '',
    job_id: '',
    description: '',
    duration: 30,
  });
  const [isSavingAppointment, setIsSavingAppointment] = useState(false);
  
  // Lookup data for participants
  const [jobSeekers, setJobSeekers] = useState<any[]>([]);
  const [hiringManagers, setHiringManagers] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(false);

  // Column management for List view
  const [columnFields, setColumnFields] = useState<string[]>([
    'date', 'time', 'type', 'status', 'participant', 'job', 'duration', 'zoom'
  ]);
  const [columnSorts, setColumnSorts] = useState<Record<string, ColumnSortState>>({});
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});

  // Column management for Month view table (below calendar)
  const [monthTableColumnFields, setMonthTableColumnFields] = useState<string[]>([
    'time', 'type', 'status', 'participant', 'job', 'zoom', 'duration'
  ]);
  const [monthTableColumnSorts, setMonthTableColumnSorts] = useState<Record<string, ColumnSortState>>({});
  const [monthTableColumnFilters, setMonthTableColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [monthTableCurrentPage, setMonthTableCurrentPage] = useState(1);
  const [monthTableItemsPerPage, setMonthTableItemsPerPage] = useState(10);

  const searchParams = useSearchParams();
  // const router = useRouter();
  const [isOffice365Connected, setIsOffice365Connected] = useState(false);

  // Office 365 connection status and callback handling
  useEffect(() => {
    setIsOffice365Connected(isOffice365Authenticated());
  }, []);
  useEffect(() => {
    const connected = searchParams?.get('connected');
    const error = searchParams?.get('error');
    if (connected === 'true') {
      toast.success('Microsoft 365 connected. You can now send calendar invites from appointments.');
      setIsOffice365Connected(true);
      router.replace('/dashboard/planner', { scroll: false });
    } else if (error) {
      toast.error(`Microsoft 365 sign-in failed: ${decodeURIComponent(error)}`);
      router.replace('/dashboard/planner', { scroll: false });
    }
  }, [searchParams, router]);

  // Load pinned state from localStorage
  useEffect(() => {
    const pinned = localStorage.getItem('plannerPinned');
    if (pinned === 'true') {
      setIsPinned(true);
    }
  }, []);

  // Fetch lookup data for participants
  useEffect(() => {
    const fetchLookups = async () => {
      setIsLoadingLookups(true);
      try {
        const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

        // Fetch job seekers
        try {
          const jsResponse = await fetch(`${apiUrl}/api/job-seekers`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (jsResponse.ok) {
            const jsData = await jsResponse.json();
            setJobSeekers(jsData.jobSeekers || jsData.data || []);
          }
        } catch (jsError) {
          console.error('Error fetching job seekers:', jsError);
        }

        // Fetch hiring managers
        try {
          const hmResponse = await fetch(`${apiUrl}/api/hiring-managers`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (hmResponse.ok) {
            const hmData = await hmResponse.json();
            setHiringManagers(hmData.hiringManagers || hmData.data || []);
          }
        } catch (hmError) {
          console.error('Error fetching hiring managers:', hmError);
        }

        // Fetch organizations
        try {
          const orgResponse = await fetch(`${apiUrl}/api/organizations`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (orgResponse.ok) {
            const orgData = await orgResponse.json();
            setOrganizations(orgData.organizations || orgData.data || []);
          }
        } catch (orgError) {
          console.error('Error fetching organizations:', orgError);
        }

        // Fetch jobs
        try {
          const jobResponse = await fetch(`${apiUrl}/api/jobs`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (jobResponse.ok) {
            const jobData = await jobResponse.json();
            setJobs(jobData.jobs || jobData.data || []);
          }
        } catch (jobError) {
          console.error('Error fetching jobs:', jobError);
        }
      } catch (error) {
        console.error('Error fetching lookup data:', error);
      } finally {
        setIsLoadingLookups(false);
      }
    };

    fetchLookups();
  }, []);

  // Fetch appointments from API
  const fetchAppointments = async () => {
    setIsLoadingAppointments(true);
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const queryParams = new URLSearchParams({
        startDate: startOfMonth.toISOString().split('T')[0],
        endDate: endOfMonth.toISOString().split('T')[0],
      });

      const response = await fetch(`/api/planner/appointments?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to fetch appointments';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = `HTTP ${response.status}: ${response.statusText || errorMessage}`;
        }
        throw new Error(errorMessage);
      }

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing appointments response:', parseError);
        console.error('Response text:', responseText);
        throw new Error('Invalid response from server');
      }

      // Ensure we have valid data
      if (!data || (!data.appointments && !data.data && !Array.isArray(data))) {
        console.warn('Unexpected appointments response format:', data);
        setAppointments([]);
        return;
      }

      const appointmentsList = Array.isArray(data.appointments) 
        ? data.appointments 
        : Array.isArray(data.data) 
        ? data.data 
        : Array.isArray(data) 
        ? data 
        : [];
      
      // Map API response to Appointment interface
      const mappedAppointments: Appointment[] = appointmentsList.map((apt: any) => {
        try {
          // Handle time field - PostgreSQL TIME returns "HH:MM:SS" format
          let timeValue = apt.start_time || apt.time || '';
          if (timeValue && typeof timeValue === 'string') {
            // If it's a full datetime, extract time part
            if (timeValue.includes('T') || timeValue.includes(' ')) {
              const parts = timeValue.split(/[T ]/);
              if (parts.length > 1) {
                timeValue = parts[1].substring(0, 8); // Extract HH:MM:SS
              }
            }
            // If it's "HH:MM:SS", convert to "HH:MM" for display
            if (timeValue.length === 8 && timeValue.includes(':')) {
              timeValue = timeValue.substring(0, 5); // HH:MM
            }
          }

          // Determine participant display name based on participant_type
          let participantName = '';
          if (apt.participant_type && apt.participant_id) {
            // We'll fetch participant names separately, but store the info
            participantName = apt.participant_name || apt.client || '';
          } else {
            // Fallback to client field if participant info not available
            participantName = apt.client || apt.organization_name || '';
          }

          // Determine job display name
          const jobDisplayName = apt.job || apt.job_title || (apt.job_id ? `Job #${apt.job_id}` : '');

          return {
            id: apt.id || 0,
            date: apt.date || apt.start_date || '',
            time: timeValue,
            start_time: apt.start_time || apt.time || '',
            type: apt.type || '',
            participant_type: apt.participant_type || null,
            participant_id: apt.participant_id || null,
            job_id: apt.job_id || null,
            client: participantName, // Use participant name as client display
            job: jobDisplayName,
            references: Array.isArray(apt.references) ? apt.references : [],
            owner: apt.owner || apt.created_by_name || apt.owner_name || '',
            owner_id: apt.owner_id || null,
            description: apt.description || '',
            location: apt.location || '',
            duration: apt.duration || 30,
            status: apt.status || 'scheduled',
            zoom_meeting_id: apt.zoom_meeting_id || null,
            zoom_join_url: apt.zoom_join_url || null,
            zoom_start_url: apt.zoom_start_url || null,
            zoom_password: apt.zoom_password || null,
          };
        } catch (mapError) {
          console.error('Error mapping appointment:', mapError, apt);
          // Return a minimal valid appointment object
          return {
            id: apt.id || 0,
            date: apt.date || '',
            time: apt.start_time || apt.time || '',
            start_time: apt.start_time || apt.time || '',
            type: apt.type || '',
            client: '',
            job: '',
            references: [],
            owner: '',
            duration: 30,
            status: 'scheduled',
          };
        }
      });

      setAppointments(mappedAppointments);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      toast.error('Failed to load appointments. Please try again.');
      setAppointments([]);
    } finally {
      setIsLoadingAppointments(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [currentMonth]);

  // Reset current page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [columnFilters, columnSorts]);

  // Calendar data generation
  const getCalendarData = (currentMonth: Date) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    const daysFromPrevMonth = firstDayOfWeek;
    const prevMonth = new Date(year, month, 0);
    const daysInPrevMonth = prevMonth.getDate();
    
    const calendarData: Array<{ day: number; appointmentCount: number; isCurrentMonth: boolean; isToday: boolean; date: Date }> = [];
    
    // Helper function to normalize date strings for comparison
    const normalizeDateString = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    // Helper function to normalize appointment date
    const normalizeAppointmentDate = (dateStr: string): string => {
      if (!dateStr) return '';
      // Handle various date formats
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr; // Return as-is if invalid
      return normalizeDateString(date);
    };
    
    // Add days from previous month
    for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const date = new Date(year, month - 1, day);
      const dateString = normalizeDateString(date);
      const dayAppointments = appointments.filter(apt => {
        const aptDateStr = normalizeAppointmentDate(apt.date);
        return aptDateStr === dateString;
      });
      
      calendarData.push({
        day,
        appointmentCount: dayAppointments.length,
        isCurrentMonth: false,
        isToday: false,
        date
      });
    }
    
    // Add days from current month
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = normalizeDateString(date);
      const dayAppointments = appointments.filter(apt => {
        const aptDateStr = normalizeAppointmentDate(apt.date);
        return aptDateStr === dateString;
      });
      const isToday = date.getDate() === today.getDate() &&
                      date.getMonth() === today.getMonth() &&
                      date.getFullYear() === today.getFullYear();
      
      calendarData.push({
        day,
        appointmentCount: dayAppointments.length,
        isCurrentMonth: true,
        isToday,
        date
      });
    }
    
    // Add days from next month to fill the grid (42 days total for 6 weeks)
    const remainingDays = 42 - calendarData.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      const dateString = normalizeDateString(date);
      const dayAppointments = appointments.filter(apt => {
        const aptDateStr = normalizeAppointmentDate(apt.date);
        return aptDateStr === dateString;
      });
      
      calendarData.push({
        day,
        appointmentCount: dayAppointments.length,
        isCurrentMonth: false,
        isToday: false,
        date
      });
    }
    
    return calendarData;
  };

  const calendarData = getCalendarData(currentMonth);
  const selectedDayAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.date);
    return aptDate.toDateString() === selectedDate.toDateString();
  });

  // Column info helper
  const getColumnInfo = (key: string) => {
    const columnMap: Record<string, { filterType: "text" | "select" | "number"; label: string }> = {
      date: { filterType: "text", label: "Date" },
      time: { filterType: "text", label: "Time" },
      type: { filterType: "select", label: "Type" },
      status: { filterType: "select", label: "Status" },
      participant: { filterType: "text", label: "Participant" },
      job: { filterType: "text", label: "Job" },
      duration: { filterType: "number", label: "Duration" },
      zoom: { filterType: "select", label: "Zoom" },
    };
    return columnMap[key];
  };

  // Helper to map participant_type to RecordType
  const getParticipantRecordType = (participantType: string | null | undefined): string | null => {
    if (!participantType) return null;
    const typeMap: Record<string, string> = {
      'job_seeker': 'job-seeker',
      'hiring_manager': 'hiring-manager',
      'organization': 'organization',
      'internal': 'owner', // Internal users might not be clickable
    };
    return typeMap[participantType] || null;
  };

  // Column value getter
  const getColumnValue = (apt: Appointment, key: string): any => {
    switch (key) {
      case 'date':
        return new Date(apt.date).toLocaleDateString();
      case 'time':
        return apt.time || '—';
      case 'type':
        return apt.type || '—';
      case 'status':
        return apt.status || '—';
      case 'participant':
        return apt.client || '—';
      case 'job':
        return apt.job || '—';
      case 'duration':
        return apt.duration ? `${apt.duration} min` : '—';
      case 'zoom':
        return apt.zoom_join_url ? 'Yes' : 'No';
      default:
        return '—';
    }
  };

  // Filter and sort selected day appointments for Month view table
  const filteredAndSortedSelectedDayAppointments = useMemo(() => {
    let filtered = [...selectedDayAppointments];

    // Apply filters
    Object.entries(monthTableColumnFilters).forEach(([key, filterValue]) => {
      if (!filterValue) return;
      filtered = filtered.filter((apt) => {
        const value = String(getColumnValue(apt, key)).toLowerCase();
        return value.includes(filterValue.toLowerCase());
      });
    });

    // Apply sorts
    const sortKeys = Object.keys(monthTableColumnSorts).filter(
      (key) => monthTableColumnSorts[key] !== null
    );
    if (sortKeys.length > 0) {
      filtered.sort((a, b) => {
        for (const key of sortKeys) {
          const direction = monthTableColumnSorts[key];
          if (!direction) continue;
          const aVal = getColumnValue(a, key);
          const bVal = getColumnValue(b, key);
          let comparison = 0;
          if (typeof aVal === "string" && typeof bVal === "string") {
            comparison = aVal.localeCompare(bVal);
          } else {
            comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          }
          if (comparison !== 0) {
            return direction === "asc" ? comparison : -comparison;
          }
        }
        return 0;
      });
    } else {
      // Default sort by time if no sort is applied
      filtered.sort((a, b) => {
        const timeA = a.time || '';
        const timeB = b.time || '';
        return timeA.localeCompare(timeB);
      });
    }

    return filtered;
  }, [selectedDayAppointments, monthTableColumnFilters, monthTableColumnSorts]);

  // Handle month table column drag end
  const handleMonthTableColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setMonthTableColumnFields((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Handle month table column sort
  const handleMonthTableColumnSort = (key: string) => {
    setMonthTableColumnSorts((prev) => {
      const current = prev[key];
      let next: ColumnSortState = null;
      if (current === null) next = "asc";
      else if (current === "asc") next = "desc";
      else next = null;
      return { ...prev, [key]: next };
    });
  };

  // Handle month table column filter
  const handleMonthTableColumnFilter = (key: string, value: string) => {
    setMonthTableColumnFilters((prev) => ({
      ...prev,
      [key]: value || null,
    }));
  };

  // Reset month table page when filters change
  useEffect(() => {
    setMonthTableCurrentPage(1);
  }, [monthTableColumnFilters, monthTableColumnSorts, selectedDate]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };
  
  const totalAppointments = calendarData.reduce((sum, day) => sum + day.appointmentCount, 0);

  // Handle Add Appointment
  const handleAddClick = () => {
    const today = new Date();
    setAppointmentForm({
      date: today.toISOString().split('T')[0],
      time: '',
      type: '',
      participant_type: '',
      participant_id: '',
      job_id: '',
      description: '',
      duration: 30,
    });
    setShowAddModal(true);
  };

  // Handle Save Appointment
  const handleSaveAppointment = async () => {
    if (!appointmentForm.date || !appointmentForm.time || !appointmentForm.type) {
      toast.error('Please fill in all required fields (Date, Time, Type)');
      return;
    }

    setIsSavingAppointment(true);
    try {
      const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");

      // Safely parse participant_id and job_id
      const participantId = appointmentForm.participant_id && appointmentForm.participant_id.trim() !== ''
        ? parseInt(appointmentForm.participant_id, 10)
        : null;
      
      const jobId = appointmentForm.job_id && appointmentForm.job_id.trim() !== ''
        ? parseInt(appointmentForm.job_id, 10)
        : null;

      // Validate parsed values
      if (appointmentForm.participant_id && (isNaN(participantId!) || participantId! <= 0)) {
        toast.error('Invalid participant selected');
        setIsSavingAppointment(false);
        return;
      }

      if (appointmentForm.job_id && (isNaN(jobId!) || jobId! <= 0)) {
        toast.error('Invalid job selected');
        setIsSavingAppointment(false);
        return;
      }

      const requestBody = {
        date: appointmentForm.date,
        time: appointmentForm.time,
        type: appointmentForm.type,
        participant_type: appointmentForm.participant_type && appointmentForm.participant_type.trim() !== '' 
          ? appointmentForm.participant_type 
          : null,
        participant_id: participantId,
        job_id: jobId,
        description: appointmentForm.description && appointmentForm.description.trim() !== '' 
          ? appointmentForm.description 
          : null,
        duration: appointmentForm.duration || 30,
      };

      const response = await fetch('/api/planner/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        console.error('Response text:', responseText);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        throw new Error(responseData.message || responseData.error || 'Failed to create appointment');
      }

      toast.success('Appointment created successfully!');
      setShowAddModal(false);
      
      // Reset form
      setAppointmentForm({
        date: '',
        time: '',
        type: '',
        participant_type: '',
        participant_id: '',
        job_id: '',
        description: '',
        duration: 30,
      });
      
      fetchAppointments();
    } catch (err) {
      console.error('Error saving appointment:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save appointment';
      toast.error(errorMessage);
    } finally {
      setIsSavingAppointment(false);
    }
  };

  // Handle Print
  const handlePrint = () => {
    window.print();
  };

  // Handle Close
  const handleClose = () => {
    router.push('/dashboard');
  };

  // Handle Pin Toggle
  const handlePinToggle = () => {
    const newPinnedState = !isPinned;
    setIsPinned(newPinnedState);
    localStorage.setItem('plannerPinned', newPinnedState ? 'true' : 'false');
  };

  // Get appointments for List view (sorted chronologically)
  // Reset current page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [columnFilters, columnSorts]);

  const getListAppointments = () => {
    const sorted = [...appointments].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA.getTime() - dateB.getTime();
    });
    return sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  };

  // Render Week View
  const renderWeekView = () => {
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      weekDays.push(date);
    }

    return (
      <div className="px-6 py-6">
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((date, index) => {
            const dateString = date.toISOString().split('T')[0];
            const dayAppointments = appointments
              .filter(apt => apt.date === dateString)
              .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
            const isToday = date.toDateString() === new Date().toDateString();
            
            return (
              <div
                key={index}
                className={`min-h-[400px] border border-gray-200 p-2 ${isToday ? 'bg-blue-50 border-blue-300' : ''}`}
              >
                <div className={`text-sm font-medium mb-2 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                  {dayNames[date.getDay()]}
                </div>
                <div className={`text-lg font-bold mb-2 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                  {date.getDate()}
                </div>
                <div className="space-y-1">
                  {dayAppointments.length === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-2">No appointments</div>
                  ) : (
                    dayAppointments.map(apt => (
                      <div key={apt.id} className="p-2 bg-blue-100 rounded text-xs hover:bg-blue-200 transition-colors">
                        <div className="font-medium text-gray-900">{apt.time || '—'}</div>
                        <div className="text-gray-700 capitalize">{apt.type || '—'}</div>
                        {apt.client && (
                          <div className="text-gray-600 truncate" title={apt.client}>
                            {apt.client}
                          </div>
                        )}
                        {apt.status && (
                          <div className={`text-[10px] mt-1 px-1 rounded inline-block ${
                            apt.status === 'live' ? 'bg-red-500 text-white' :
                            apt.status === 'completed' ? 'bg-green-500 text-white' :
                            'bg-gray-200 text-gray-700'
                          }`}>
                            {apt.status}
                          </div>
                        )}
                        {apt.zoom_join_url && (
                          <a
                            href={apt.zoom_join_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-[10px] underline mt-1 block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Join Zoom
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render Day View
  const renderDayView = () => {
    const dateString = selectedDate.toISOString().split('T')[0];
    const dayAppointments = appointments
      .filter(apt => apt.date === dateString)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const isToday = selectedDate.toDateString() === new Date().toDateString();

    return (
      <div className="px-6 py-6">
        <div className={`border border-gray-200 p-4 rounded ${isToday ? 'bg-blue-50 border-blue-300' : ''}`}>
          <div className={`text-lg font-bold mb-4 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
            {dayNames[selectedDate.getDay()]}, {monthNames[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}
          </div>
          <div className="space-y-3">
            {dayAppointments.length === 0 ? (
              <div className="text-gray-500 text-center py-8">No appointments for this day</div>
            ) : (
              dayAppointments.map(apt => (
                <div key={apt.id} className="border border-gray-200 p-4 rounded bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="font-medium text-lg text-gray-900">{apt.time || '—'}</div>
                      <div className="text-gray-600 capitalize">{apt.type || '—'}</div>
                    </div>
                    {apt.status && (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        apt.status === 'live' ? 'bg-red-100 text-red-800' :
                        apt.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {apt.client && (
                      <div>
                        <span className="text-gray-500">Participant:</span>
                        <span className="ml-2 text-gray-900">{apt.client}</span>
                      </div>
                    )}
                    {apt.job && (
                      <div>
                        <span className="text-gray-500">Job:</span>
                        <span className="ml-2 text-gray-900">{apt.job}</span>
                      </div>
                    )}
                    {apt.duration && (
                      <div>
                        <span className="text-gray-500">Duration:</span>
                        <span className="ml-2 text-gray-900">{apt.duration} minutes</span>
                      </div>
                    )}
                  </div>
                  
                  {apt.description && (
                    <div className="text-gray-600 mt-3 p-2 bg-gray-50 rounded">
                      {apt.description}
                    </div>
                  )}
                  
                  {apt.zoom_join_url && (
                    <div className="mt-3 flex gap-2">
                      <a
                        href={apt.zoom_join_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                      >
                        Join Zoom Meeting
                      </a>
                      {apt.zoom_start_url && (
                        <a
                          href={apt.zoom_start_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                        >
                          Start Meeting (Host)
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // Handle column drag end
  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumnFields((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Handle column sort
  const handleColumnSort = (key: string) => {
    setColumnSorts((prev) => {
      const current = prev[key];
      let next: ColumnSortState = null;
      if (current === null) next = "asc";
      else if (current === "asc") next = "desc";
      else next = null;
      return { ...prev, [key]: next };
    });
  };

  // Handle column filter
  const handleColumnFilter = (key: string, value: string) => {
    setColumnFilters((prev) => ({
      ...prev,
      [key]: value || null,
    }));
  };

  // Filter and sort appointments
  const filteredAndSortedAppointments = useMemo(() => {
    let filtered = [...appointments];

    // Apply filters
    Object.entries(columnFilters).forEach(([key, filterValue]) => {
      if (!filterValue) return;
      filtered = filtered.filter((apt) => {
        const value = String(getColumnValue(apt, key)).toLowerCase();
        return value.includes(filterValue.toLowerCase());
      });
    });

    // Apply sorts
    const sortKeys = Object.keys(columnSorts).filter(
      (key) => columnSorts[key] !== null
    );
    if (sortKeys.length > 0) {
      filtered.sort((a, b) => {
        for (const key of sortKeys) {
          const direction = columnSorts[key];
          if (!direction) continue;
          const aVal = getColumnValue(a, key);
          const bVal = getColumnValue(b, key);
          let comparison = 0;
          if (typeof aVal === "string" && typeof bVal === "string") {
            comparison = aVal.localeCompare(bVal);
          } else {
            comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          }
          if (comparison !== 0) {
            return direction === "asc" ? comparison : -comparison;
          }
        }
        return 0;
      });
    }

    return filtered;
  }, [appointments, columnFilters, columnSorts]);

  // Render List View
  const renderListView = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedAppointments = filteredAndSortedAppointments.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredAndSortedAppointments.length / itemsPerPage);
    const totalItems = filteredAndSortedAppointments.length;

    const typeOptions = [
      { label: "Zoom Meeting", value: "zoom" },
      { label: "Interview", value: "Interview" },
      { label: "Meeting", value: "Meeting" },
      { label: "Phone Call", value: "Phone Call" },
      { label: "Follow-up", value: "Follow-up" },
      { label: "Assessment", value: "Assessment" },
      { label: "Other", value: "Other" },
    ];

    const statusOptions = [
      { label: "Scheduled", value: "scheduled" },
      { label: "Live", value: "live" },
      { label: "Completed", value: "completed" },
    ];

    const zoomOptions = [
      { label: "Yes", value: "Yes" },
      { label: "No", value: "No" },
    ];

    return (
      <div className="px-6 pb-6">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <DndContext collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <SortableContext
                      items={columnFields}
                      strategy={horizontalListSortingStrategy}
                    >
                      {columnFields.map((key) => {
                        const columnInfo = getColumnInfo(key);
                        if (!columnInfo) return null;

                        return (
                          <SortableColumnHeader
                            key={key}
                            id={key}
                            columnKey={key}
                            label={columnInfo.label}
                            sortState={columnSorts[key] || null}
                            filterValue={columnFilters[key] || null}
                            onSort={() => handleColumnSort(key)}
                            onFilterChange={(value) => handleColumnFilter(key, value)}
                            filterType={columnInfo.filterType}
                            filterOptions={
                              key === "type" ? typeOptions :
                              key === "status" ? statusOptions :
                              key === "zoom" ? zoomOptions :
                              undefined
                            }
                          />
                        );
                      })}
                    </SortableContext>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedAppointments.length > 0 ? (
                    paginatedAppointments.map((appointment) => (
                      <tr key={appointment.id} className="hover:bg-gray-50">
                        {columnFields.map((key) => {
                          const value = getColumnValue(appointment, key);
                          return (
                            <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {key === 'status' && appointment.status ? (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  appointment.status === 'live' ? 'bg-red-100 text-red-800' :
                                  appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                                </span>
                              ) : key === 'participant' && appointment.participant_type && appointment.participant_id ? (
                                <RecordNameResolver
                                  id={appointment.participant_id}
                                  type={getParticipantRecordType(appointment.participant_type) || 'organization'}
                                  clickable={appointment.participant_type !== 'internal'}
                                  fallback={appointment.client || '—'}
                                  className="text-sm"
                                />
                              ) : key === 'zoom' && appointment.zoom_join_url ? (
                                <a
                                  href={appointment.zoom_join_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Join
                                </a>
                              ) : key === 'type' ? (
                                <span className="capitalize">{value}</span>
                              ) : (
                                value
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columnFields.length} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {Object.keys(columnFilters).length > 0
                          ? "No appointments found matching your filters."
                          : "No appointments found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </DndContext>
        </div>

        {/* Pagination */}
        {totalPages > 0 && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 overflow-x-auto min-w-0">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{totalItems === 0 ? 0 : startIndex + 1}</span> to{" "}
                  <span className="font-medium">{Math.min(endIndex, totalItems)}</span> of{" "}
                  <span className="font-medium">{totalItems}</span> results
                </p>
              </div>
              {totalPages > 1 && (
                <div>
                  <nav
                    className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                    aria-label="Pagination"
                  >
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Previous</span>
                      <svg
                        className="h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              currentPage === page
                                ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                                : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            {page}
                          </button>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return (
                          <span
                            key={page}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                          >
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Next</span>
                      <svg
                        className="h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </nav>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
        }
      `}</style>
      <div className="min-h-screen bg-white relative">
        {/* Header/Navigation Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 no-print">
          <div className="flex items-center justify-between">
            {/* Left Side */}
            <div className="flex items-center space-x-4">
              {/* Calendar Icon */}
              <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
              
              {/* Month Navigation */}
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => navigateMonth('prev')}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-lg font-medium text-gray-900">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </span>
                <button 
                  onClick={() => navigateMonth('next')}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              {/* Total Appointments */}
              <div className="text-sm text-gray-600">
                {totalAppointments} APPOINTMENTS
              </div>
            </div>
            
            {/* Right Side */}
            <div className="flex items-center space-x-4">
              {/* Add Button */}
              <button 
                onClick={handleAddClick}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>ADD</span>
              </button>
              
              {/* View Type Selector */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(['Month', 'Week', 'Day', 'List'] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => {
                      setViewType(view);
                      if (view === 'Week' || view === 'Day') {
                        setSelectedDate(new Date());
                      }
                    }}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      viewType === view
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </div>

              {/* Microsoft 365 Connect — for calendar invites from Job Seeker / Hiring Manager / Jobs views */}
              {isOffice365Connected ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                    <span className="w-2 h-2 rounded-full bg-green-500" aria-hidden />
                    Microsoft 365 connected
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      disconnectOffice365();
                      setIsOffice365Connected(false);
                      toast.info('Microsoft 365 disconnected.');
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    initializeOffice365Auth().catch((err) => toast.error(err?.message || 'Failed to start sign-in'));
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100"
                >
                  Connect Microsoft 365
                </button>
              )}
              
              {/* Action Icons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePinToggle}
                  className="p-2 text-gray-600 hover:text-gray-800"
                  title={isPinned ? 'Unpin' : 'Pin'}
                >
                  {isPinned ? <FiLock size={20} /> : <FiUnlock size={20} />}
                </button>
                <button
                  onClick={handlePrint}
                  className="p-2 text-gray-600 hover:text-gray-800"
                  title="Print"
                >
                  <FiPrinter size={20} />
                </button>
                <button
                  onClick={handleClose}
                  className="p-2 text-gray-600 hover:text-gray-800"
                  title="Close"
                >
                  <FiX size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Content */}
        {viewType === 'Month' && (
          <div className="px-6 py-6">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {calendarData.map((dayData, index) => (
                <div
                  key={index}
                  className={`min-h-[80px] border border-gray-200 p-2 cursor-pointer hover:bg-gray-50 ${
                    dayData.isToday ? 'bg-blue-100 border-blue-300' : ''
                  }`}
                  onClick={() => setSelectedDate(dayData.date)}
                >
                  <div className="flex flex-col h-full">
                    <div className={`text-sm ${
                      dayData.isToday ? 'text-blue-600 font-semibold' : dayData.isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                    }`}>
                      {dayData.day}
                    </div>
                    <div className={`text-lg font-bold mt-1 ${
                      dayData.isToday ? 'text-blue-600' : dayData.isCurrentMonth ? 'text-blue-500' : 'text-gray-300'
                    }`}>
                      {dayData.appointmentCount || 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewType === 'Week' && renderWeekView()}
        {viewType === 'Day' && renderDayView()}
        {viewType === 'List' && renderListView()}

        {/* Appointment Details Section (Month View Only) */}
        {viewType === 'Month' && (
          <div className="px-6 pb-6 no-print">
            {/* Items Per Page */}
            <div className="bg-gray-50 px-4 py-2 border-x border-gray-200">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>ITEMS PER PAGE:</span>
                <select 
                  value={monthTableItemsPerPage} 
                  onChange={(e) => {
                    setMonthTableItemsPerPage(Number(e.target.value));
                    setMonthTableCurrentPage(1);
                  }}
                  className="border border-gray-300 rounded px-2 py-1 bg-white"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            
            {/* Appointments Table */}
            <div className="bg-white border border-gray-200 rounded-b-lg overflow-hidden">
              <DndContext collisionDetection={closestCenter} onDragEnd={handleMonthTableColumnDragEnd}>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <SortableContext
                          items={monthTableColumnFields}
                          strategy={horizontalListSortingStrategy}
                        >
                          {monthTableColumnFields.map((key) => {
                            const columnInfo = getColumnInfo(key);
                            if (!columnInfo) return null;

                            const typeOptions = [
                              { label: "Zoom Meeting", value: "zoom" },
                              { label: "Interview", value: "Interview" },
                              { label: "Meeting", value: "Meeting" },
                              { label: "Phone Call", value: "Phone Call" },
                              { label: "Follow-up", value: "Follow-up" },
                              { label: "Assessment", value: "Assessment" },
                              { label: "Other", value: "Other" },
                            ];

                            const statusOptions = [
                              { label: "Scheduled", value: "scheduled" },
                              { label: "Live", value: "live" },
                              { label: "Completed", value: "completed" },
                            ];

                            const zoomOptions = [
                              { label: "Yes", value: "Yes" },
                              { label: "No", value: "No" },
                            ];

                            return (
                              <SortableColumnHeader
                                key={key}
                                id={key}
                                columnKey={key}
                                label={columnInfo.label}
                                sortState={monthTableColumnSorts[key] || null}
                                filterValue={monthTableColumnFilters[key] || null}
                                onSort={() => handleMonthTableColumnSort(key)}
                                onFilterChange={(value) => handleMonthTableColumnFilter(key, value)}
                                filterType={columnInfo.filterType}
                                filterOptions={
                                  key === "type" ? typeOptions :
                                  key === "status" ? statusOptions :
                                  key === "zoom" ? zoomOptions :
                                  undefined
                                }
                              />
                            );
                          })}
                        </SortableContext>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(() => {
                        const startIndex = (monthTableCurrentPage - 1) * monthTableItemsPerPage;
                        const endIndex = startIndex + monthTableItemsPerPage;
                        const paginatedAppointments = filteredAndSortedSelectedDayAppointments.slice(startIndex, endIndex);
                        const totalPages = Math.ceil(filteredAndSortedSelectedDayAppointments.length / monthTableItemsPerPage);
                        const totalItems = filteredAndSortedSelectedDayAppointments.length;

                        if (paginatedAppointments.length === 0) {
                          return (
                            <tr>
                              <td colSpan={monthTableColumnFields.length} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                {Object.keys(monthTableColumnFilters).length > 0
                                  ? "No appointments found matching your filters."
                                  : "No appointments for selected date"}
                              </td>
                            </tr>
                          );
                        }

                        return paginatedAppointments.map((appointment) => (
                          <tr key={appointment.id} className="hover:bg-gray-50">
                            {monthTableColumnFields.map((key) => {
                              const value = getColumnValue(appointment, key);
                              return (
                                <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {key === 'status' && appointment.status ? (
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      appointment.status === 'live' ? 'bg-red-100 text-red-800' :
                                      appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                                    </span>
                                  ) : key === 'participant' && appointment.participant_type && appointment.participant_id ? (
                                    <RecordNameResolver
                                      id={appointment.participant_id}
                                      type={getParticipantRecordType(appointment.participant_type) || 'organization'}
                                      clickable={appointment.participant_type !== 'internal'}
                                      fallback={appointment.client || '—'}
                                      className="text-sm"
                                    />
                                  ) : key === 'zoom' && appointment.zoom_join_url ? (
                                    <div className="flex flex-col gap-1">
                                      <a
                                        href={appointment.zoom_join_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 text-xs"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Join
                                      </a>
                                      {appointment.zoom_start_url && (
                                        <a
                                          href={appointment.zoom_start_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-500 hover:text-blue-700 text-xs"
                                          title="Host start link"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          Start
                                        </a>
                                      )}
                                    </div>
                                  ) : key === 'type' ? (
                                    <span className="capitalize">{value}</span>
                                  ) : (
                                    value
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </DndContext>
              
              {/* Pagination */}
              {(() => {
                const startIndex = (monthTableCurrentPage - 1) * monthTableItemsPerPage;
                const endIndex = startIndex + monthTableItemsPerPage;
                const totalPages = Math.ceil(filteredAndSortedSelectedDayAppointments.length / monthTableItemsPerPage);
                const totalItems = filteredAndSortedSelectedDayAppointments.length;

                if (totalPages <= 1) return null;

                return (
                  <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 overflow-x-auto min-w-0">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => setMonthTableCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={monthTableCurrentPage === 1}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setMonthTableCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={monthTableCurrentPage === totalPages}
                        className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Showing <span className="font-medium">{totalItems === 0 ? 0 : startIndex + 1}</span> to{" "}
                          <span className="font-medium">{Math.min(endIndex, totalItems)}</span> of{" "}
                          <span className="font-medium">{totalItems}</span> results
                        </p>
                      </div>
                      <div>
                        <nav
                          className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                          aria-label="Pagination"
                        >
                          <button
                            onClick={() => setMonthTableCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={monthTableCurrentPage === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span className="sr-only">Previous</span>
                            <svg
                              className="h-5 w-5"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                            if (
                              page === 1 ||
                              page === totalPages ||
                              (page >= monthTableCurrentPage - 1 && page <= monthTableCurrentPage + 1)
                            ) {
                              return (
                                <button
                                  key={page}
                                  onClick={() => setMonthTableCurrentPage(page)}
                                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                    monthTableCurrentPage === page
                                      ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                                      : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                  }`}
                                >
                                  {page}
                                </button>
                              );
                            } else if (page === monthTableCurrentPage - 2 || page === monthTableCurrentPage + 2) {
                              return (
                                <span
                                  key={page}
                                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                                >
                                  ...
                                </span>
                              );
                            }
                            return null;
                          })}
                          <button
                            onClick={() => setMonthTableCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={monthTableCurrentPage === totalPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span className="sr-only">Next</span>
                            <svg
                              className="h-5 w-5"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Add Appointment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center px-4 z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-semibold text-gray-800">Add Appointment</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={appointmentForm.date}
                    onChange={(e) => setAppointmentForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={appointmentForm.time}
                    onChange={(e) => setAppointmentForm(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={appointmentForm.type}
                    onChange={(e) => setAppointmentForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select type</option>
                    <option value="zoom">Zoom Meeting</option>
                    <option value="Interview">Interview</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Phone Call">Phone Call</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Assessment">Assessment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    value={appointmentForm.duration}
                    onChange={(e) => setAppointmentForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 30 }))}
                    min="15"
                    step="15"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Participant Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Participant Type
                  </label>
                  <select
                    value={appointmentForm.participant_type}
                    onChange={(e) => setAppointmentForm(prev => ({ ...prev, participant_type: e.target.value, participant_id: '' }))}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select participant type</option>
                    <option value="job_seeker">Job Seeker</option>
                    <option value="hiring_manager">Hiring Manager</option>
                    <option value="organization">Organization</option>
                    <option value="internal">Internal</option>
                  </select>
                </div>

                {/* Participant Selector */}
                {appointmentForm.participant_type && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {appointmentForm.participant_type === 'job_seeker' ? 'Job Seeker' :
                       appointmentForm.participant_type === 'hiring_manager' ? 'Hiring Manager' :
                       appointmentForm.participant_type === 'organization' ? 'Organization' : 'Internal User'}
                    </label>
                    <select
                      value={appointmentForm.participant_id}
                      onChange={(e) => setAppointmentForm(prev => ({ ...prev, participant_id: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isLoadingLookups}
                    >
                      <option value="">Select {appointmentForm.participant_type.replace('_', ' ')}</option>
                      {appointmentForm.participant_type === 'job_seeker' && jobSeekers.map((js: any) => (
                        <option key={js.id} value={js.id}>
                          {js.full_name || `${js.first_name} ${js.last_name}`}
                        </option>
                      ))}
                      {appointmentForm.participant_type === 'hiring_manager' && hiringManagers.map((hm: any) => (
                        <option key={hm.id} value={hm.id}>
                          {hm.full_name || `${hm.first_name} ${hm.last_name}`}
                        </option>
                      ))}
                      {appointmentForm.participant_type === 'organization' && organizations.map((org: any) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Job Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job (Optional)</label>
                  <select
                    value={appointmentForm.job_id}
                    onChange={(e) => setAppointmentForm(prev => ({ ...prev, job_id: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoadingLookups}
                  >
                    <option value="">Select job (optional)</option>
                    {jobs.map((job: any) => (
                      <option key={job.id} value={job.id}>
                        {job.job_title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Description - Full Width */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description / Notes</label>
              <textarea
                value={appointmentForm.description}
                onChange={(e) => setAppointmentForm(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add any notes or description for this appointment..."
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                disabled={isSavingAppointment}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAppointment}
                disabled={isSavingAppointment || !appointmentForm.date || !appointmentForm.time || !appointmentForm.type}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingAppointment ? 'Saving...' : 'Save Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Planners;
