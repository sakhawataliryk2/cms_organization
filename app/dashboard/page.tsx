'use client'

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { FiSearch, FiChevronDown, FiX, FiChevronLeft, FiChevronRight, FiCheckSquare, FiPlus, FiClock, FiCalendar, FiEdit2, FiUpload, FiFile, FiMessageSquare, FiTrash2, FiMonitor } from 'react-icons/fi';
import { useRouter } from 'nextjs-toploader/app';
import Link from 'next/link';
import { toast } from 'sonner';
import { ActivityReportGrid, type ActivityReportRow } from '@/components/ActivityReportGrid';
import { getNoteDateTimeValue } from '@/lib/noteUtils';

interface Task {
    id: string;
    title: string;
    description?: string;
    is_completed: boolean;
    created_at?: string;
    due_date?: string;
    due_time?: string;
    priority: string;
    status: string;
    created_by_name?: string;
    assigned_to_name?: string;
    job_seeker_name?: string;
    hiring_manager_name?: string;
    job_title?: string;
    lead_name?: string;
}

type TaskWithOwnerFields = Task & {
    created_by?: string | number;
    assigned_to?: string | number;
};

const isTaskOwnedByUser = (
    task: TaskWithOwnerFields,
    userId?: string | number
): boolean => {
    if (!userId) return false;
    const idStr = String(userId);
    if (task.created_by != null && String(task.created_by) === idStr) return true;
    if (task.assigned_to != null && String(task.assigned_to) === idStr) return true;
    return false;
};

interface Appointment {
    id: number;
    time: string;
    type: string;
    client: string;
    job: string;
    references: string[];
    owner: string;
    date?: string;
}

export default function Dashboard() {
    const { user } = useAuth();
    const router = useRouter();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [startDateTime, setStartDateTime] = useState('');
    const [endDateTime, setEndDateTime] = useState('');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [allTasks, setAllTasks] = useState<Task[]>([]); // Store all tasks for calendar indicators
    const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
    const [taskSearchQuery, setTaskSearchQuery] = useState('');
    const [taskFilter, setTaskFilter] = useState<'all' | 'completed' | 'pending'>('all');
    const [goalsSearchQuery, setGoalsSearchQuery] = useState('');
    const [isLoadingTasks, setIsLoadingTasks] = useState(true);
    const [tasksError, setTasksError] = useState<string | null>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
    const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
    const [showGoalsQuotas, setShowGoalsQuotas] = useState(true);

    // Shared Documents state
    const [sharedDocuments, setSharedDocuments] = useState<any[]>([]);
    const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadDescription, setUploadDescription] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [editingDocumentId, setEditingDocumentId] = useState<number | null>(null);
    const [editDocumentDescription, setEditDocumentDescription] = useState('');
    const [isUpdatingDocument, setIsUpdatingDocument] = useState(false);

    // Broadcast Messages state
    const [broadcastMessages, setBroadcastMessages] = useState<any[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [isPostingMessage, setIsPostingMessage] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
    const [editMessageText, setEditMessageText] = useState('');
    const [isUpdatingMessage, setIsUpdatingMessage] = useState(false);
    const [isRefreshingDashboard, setIsRefreshingDashboard] = useState(false);

    // Activity Report (Goals & Quotas) - scoped to logged-in user + selected date range
    const toISODateInput = (d: Date) => d.toISOString().slice(0, 10);
    const getMonthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
    const [activityRange, setActivityRange] = useState<{ start: string; end: string }>(() => ({
        start: toISODateInput(getMonthStart(new Date())),
        end: toISODateInput(new Date()),
    }));
    const [dateRangeError, setDateRangeError] = useState<string | null>(null);
    const [isLoadingActivityReport, setIsLoadingActivityReport] = useState(false);
    const [activityReportError, setActivityReportError] = useState<string | null>(null);
    const [activityReport, setActivityReport] = useState<any>(null);

    // Activity Report detail modals (similar to Goals & Quotas)
    const [isLoadingActivityDetails, setIsLoadingActivityDetails] = useState(false);
    const [showActivityNotesModal, setShowActivityNotesModal] = useState(false);
    const [showActivityRecordsModal, setShowActivityRecordsModal] = useState(false);
    const [activityNotesDetails, setActivityNotesDetails] = useState<{
        category: string;
        notes: any[];
    } | null>(null);
    const [activityRecordsDetails, setActivityRecordsDetails] = useState<{
        category: string;
        records: any[];
    } | null>(null);

    // Helper: auth header for internal API calls
    const getAuthHeader = (): Record<string, string> => {
        if (typeof document === 'undefined') return {};
        const token = document.cookie.replace(
            /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
            '$1'
        );
        if (!token) return {};
        return {
            Authorization: `Bearer ${token}`,
        };
    };

    // Validate date range
    const validateDateRange = (start: string, end: string): boolean => {
        if (!start || !end) {
            setDateRangeError('Both start and end dates are required');
            return false;
        }
        if (start > end) {
            setDateRangeError('End date cannot be earlier than start date');
            return false;
        }
        setDateRangeError(null);
        return true;
    };

    const fetchActivityReport = async (range: { start: string; end: string }) => {
        if (!user?.id) return;
        if (!validateDateRange(range.start, range.end)) return;

        setIsLoadingActivityReport(true);
        setActivityReportError(null);
        try {
            const response = await fetch(
                `/api/activity-report?userId=${encodeURIComponent(user.id)}&start=${range.start}&end=${range.end}`
            );
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch activity report');
            }
            setActivityReport(data);
        } catch (err) {
            setActivityReportError(err instanceof Error ? err.message : 'Failed to fetch activity report');
            setActivityReport(null);
        } finally {
            setIsLoadingActivityReport(false);
        }
    };

    // Refresh whenever date range changes (only if valid)
    useEffect(() => {
        if (!validateDateRange(activityRange.start, activityRange.end)) {
            return;
        }
        const handle = setTimeout(() => {
            fetchActivityReport(activityRange);
        }, 250);
        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activityRange.start, activityRange.end, user?.id]);

    // Helpers to resolve date range for detail queries
    const getActivityRangeStartDate = () =>
        activityRange.start ? new Date(`${activityRange.start}T00:00:00`) : null;
    const getActivityRangeEndDate = () =>
        activityRange.end ? new Date(`${activityRange.end}T23:59:59.999`) : null;

    const isInActivityRange = (dateString: string | null | undefined) => {
        if (!dateString) return false;
        const d = new Date(dateString);
        if (Number.isNaN(d.getTime())) return false;
        const rangeStart = getActivityRangeStartDate();
        const rangeEnd = getActivityRangeEndDate();
        if (rangeStart && d < rangeStart) return false;
        if (rangeEnd && d > rangeEnd) return false;
        return true;
    };

    const activityCategoryApiMap: Record<string, string> = {
        Organization: 'organizations',
        Jobs: 'jobs',
        'Job Seekers': 'job-seekers',
        'Hiring Managers': 'hiring-managers',
        Placements: 'placements',
        Leads: 'leads',
    };

    const activityReportRows: ActivityReportRow[] = useMemo(() => {
        const categories = [
            { key: 'organizations', category: 'Organization' },
            { key: 'jobs', category: 'Jobs' },
            { key: 'job-seekers', category: 'Job Seekers' },
            { key: 'hiring-managers', category: 'Hiring Managers' },
            { key: 'placements', category: 'Placements' },
            { key: 'leads', category: 'Leads' },
        ];
        return categories.map(({ key, category }) => ({
            key,
            categoryLabel: category,
            notesCount: activityReport?.categories?.[key]?.notesCount ?? 0,
            addedToSystem: activityReport?.categories?.[key]?.addedToSystem ?? 0,
            inboundEmails: activityReport?.categories?.[key]?.inboundEmails ?? 0,
            outboundEmails: activityReport?.categories?.[key]?.outboundEmails ?? 0,
            calls: activityReport?.categories?.[key]?.calls ?? 0,
            texts: activityReport?.categories?.[key]?.texts ?? 0,
        }));
    }, [activityReport?.categories]);

    const activityResponseKeyMap: Record<string, string> = {
        Organization: 'organizations',
        Jobs: 'jobs',
        'Job Seekers': 'jobSeekers',
        'Hiring Managers': 'hiringManagers',
        Placements: 'placements',
        Leads: 'leads',
    };

    const handleActivityNotesClick = async (categoryLabel: string) => {
        if (!user?.id) return;
        const apiEndpoint = activityCategoryApiMap[categoryLabel];
        if (!apiEndpoint) return;

        // Placements notes list is not wired via API yet
        if (categoryLabel === 'Placements') {
            setActivityNotesDetails({
                category: categoryLabel,
                notes: [],
            });
            setShowActivityNotesModal(true);
            return;
        }

        setIsLoadingActivityDetails(true);
        try {
            const entitiesResponse = await fetch(`/api/${apiEndpoint}`, {
                headers: getAuthHeader(),
            });
            if (!entitiesResponse.ok) {
                setActivityNotesDetails({
                    category: categoryLabel,
                    notes: [],
                });
                setShowActivityNotesModal(true);
                return;
            }

            const entitiesData = await entitiesResponse.json();
            const responseKey =
                activityResponseKeyMap[categoryLabel] || apiEndpoint.replace('-', '');
            const entities =
                entitiesData[responseKey] ||
                entitiesData[categoryLabel.toLowerCase().replace(' ', '')] ||
                [];

            const notesList: any[] = [];
            for (const entity of entities) {
                if (!entity?.id) continue;
                try {
                    const notesResponse = await fetch(
                        `/api/${apiEndpoint}/${entity.id}/notes`,
                        { headers: getAuthHeader() }
                    );
                    if (!notesResponse.ok) continue;
                    const notesData = await notesResponse.json();
                    const notes = notesData.notes || [];
                    notes.forEach((note: any) => {
                        if (
                            String(note.created_by) === String(user.id) &&
                            isInActivityRange(getNoteDateTimeValue(note))
                        ) {
                            notesList.push({
                                ...note,
                                _entityId: entity.id,
                                _entityName:
                                    entity.name ||
                                    entity.job_title ||
                                    entity.full_name ||
                                    `${categoryLabel} #${entity.id}`,
                            });
                        }
                    });
                } catch {
                    // ignore per-entity errors
                }
            }

            setActivityNotesDetails({
                category: categoryLabel,
                notes: notesList,
            });
            setShowActivityNotesModal(true);
        } finally {
            setIsLoadingActivityDetails(false);
        }
    };

    const handleActivityRecordsClick = async (categoryLabel: string) => {
        if (!user?.id) return;
        const apiEndpoint = activityCategoryApiMap[categoryLabel];
        if (!apiEndpoint) return;

        setIsLoadingActivityDetails(true);
        try {
            const entitiesResponse = await fetch(`/api/${apiEndpoint}`, {
                headers: getAuthHeader(),
            });
            if (!entitiesResponse.ok) {
                setActivityRecordsDetails({
                    category: categoryLabel,
                    records: [],
                });
                setShowActivityRecordsModal(true);
                return;
            }

            const entitiesData = await entitiesResponse.json();
            const responseKey =
                activityResponseKeyMap[categoryLabel] || apiEndpoint.replace('-', '');
            const entities = entitiesData[responseKey] || [];

            const records: any[] = [];
            entities.forEach((entity: any) => {
                if (
                    String(entity.created_by) === String(user.id) &&
                    isInActivityRange(entity.created_at)
                ) {
                    records.push(entity);
                }
            });

            setActivityRecordsDetails({
                category: categoryLabel,
                records,
            });
            setShowActivityRecordsModal(true);
        } finally {
            setIsLoadingActivityDetails(false);
        }
    };

    // Navigation handlers
    const handleNextClick = () => {
        router.push('/dashboard/candidate-flow');
    };

    // Calendar days of week
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Month names
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Get calendar data for current month
    const getCalendarData = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        // First day of the month
        const firstDay = new Date(year, month, 1);
        const firstDayOfWeek = firstDay.getDay();

        // Last day of the month
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();

        // Days from previous month to show
        const daysFromPrevMonth = firstDayOfWeek;
        const prevMonth = new Date(year, month, 0);
        const daysInPrevMonth = prevMonth.getDate();

        const calendarDays: Array<{ day: number; isCurrentMonth: boolean; date: Date }> = [];

        // Add days from previous month
        for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
            const date = new Date(year, month - 1, daysInPrevMonth - i);
            calendarDays.push({ day: daysInPrevMonth - i, isCurrentMonth: false, date });
        }

        // Add days from current month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            calendarDays.push({ day, isCurrentMonth: true, date });
        }

        // Add days from next month to fill the grid
        const remainingDays = 42 - calendarDays.length; // 6 weeks * 7 days
        for (let day = 1; day <= remainingDays; day++) {
            const date = new Date(year, month + 1, day);
            calendarDays.push({ day, isCurrentMonth: false, date });
        }

        // Group into weeks
        const weeks: Array<Array<{ day: number; isCurrentMonth: boolean; date: Date }>> = [];
        for (let i = 0; i < calendarDays.length; i += 7) {
            weeks.push(calendarDays.slice(i, i + 7));
        }

        return weeks;
    };

    const calendarWeeks = getCalendarData();

    // Navigate to previous month
    const goToPreviousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    // Navigate to next month
    const goToNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    // Go to today
    const goToToday = async () => {
        const today = new Date();
        setCurrentDate(today);
        setSelectedDate(today);
        await fetchTasksForDate(today);
    };

    // Check if a date is today
    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    // Check if a date is selected
    const isSelected = (date: Date) => {
        if (!selectedDate) return false;
        return date.getDate() === selectedDate.getDate() &&
            date.getMonth() === selectedDate.getMonth() &&
            date.getFullYear() === selectedDate.getFullYear();
    };

    // Handle date click - fetch tasks for selected date
    const handleDateClick = async (date: Date) => {
        const selectedStr = formatDateForAPI(date);
        setActivityRange((prev) => {
            const start = prev.start;
            const end = prev.end;

            // If range not set yet, initialize to the selected date
            if (!start && !end) return { start: selectedStr, end: selectedStr };
            if (!start && end) return { start: selectedStr, end };
            if (start && !end) return { start, end: selectedStr };

            // Key rule: if selected date is inside the range, do nothing
            if (selectedStr >= start && selectedStr <= end) return prev;

            // Otherwise, adjust only the closest boundary to include selected date
            if (selectedStr < start) return { start: selectedStr, end };
            if (selectedStr > end) return { start, end: selectedStr };

            return prev;
        });
        setSelectedDate(date);
        await fetchTasksForDate(date);
    };

    // Format date to YYYY-MM-DD for API comparison
    const formatDateForAPI = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getTaskPrimaryDate = (task: Task): Date | null => {
        if (task.created_at) {
            const created = new Date(task.created_at);
            if (!Number.isNaN(created.getTime())) return created;
        }
        if (task.due_date) {
            const due = new Date(task.due_date);
            if (!Number.isNaN(due.getTime())) return due;
        }
        return null;
    };

    const sortTasksByRecent = (tasksToSort: Task[]): Task[] => {
        return [...tasksToSort].sort((a, b) => {
            const aDate = getTaskPrimaryDate(a);
            const bDate = getTaskPrimaryDate(b);
            if (!aDate && !bDate) return 0;
            if (!aDate) return 1;
            if (!bDate) return -1;
            // Newest first
            return bDate.getTime() - aDate.getTime();
        });
    };

    // Check has tasks (by Date Added, falling back to due_date)
    const hasTasks = (date: Date) => {
        if (allTasks.length === 0) return false;
        const target = formatDateForAPI(date);
        return allTasks.some((task: Task) => {
            const taskDate = getTaskPrimaryDate(task);
            if (!taskDate) return false;
            return formatDateForAPI(taskDate) === target;
        });
    };

    // Check if a date has appointments
    const hasAppointments = (date: Date) => {
        if (appointments.length === 0) return false;
        const dateString = formatDateForAPI(date);
        return appointments.some((apt: Appointment) => {
            if (!apt.date) return false;
            const aptDate = new Date(apt.date);
            return formatDateForAPI(aptDate) === dateString;
        });
    };

    // Appointments to display: when a calendar date is selected, show only that day's appointments; otherwise show all in range
    const displayedAppointments = selectedDate
        ? appointments.filter((apt: Appointment) => {
            if (!apt.date) return false;
            const aptDate = new Date(apt.date);
            return formatDateForAPI(aptDate) === formatDateForAPI(selectedDate);
        })
        : appointments;

    // Check if a date is within the selected date range
    const isInDateRange = (date: Date) => {
        if (!activityRange.start || !activityRange.end || dateRangeError) return true; // Show all if invalid
        const dateString = formatDateForAPI(date);
        return dateString >= activityRange.start && dateString <= activityRange.end;
    };

    // Check if a task's primary date (Date Added, then due_date) matches the selected date
    const isTaskForDate = (task: Task, date: Date): boolean => {
        const taskDate = getTaskPrimaryDate(task);
        if (!taskDate) return false;
        return formatDateForAPI(taskDate) === formatDateForAPI(date);
    };

    // Fetch tasks for a specific date
    const fetchTasksForDate = async (date: Date) => {
        setIsLoadingTasks(true);
        setTasksError(null);
        try {
            const response = await fetch('/api/tasks', {
                headers: {
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch tasks');
            }

            const data = await response.json();
            const allTasks = (data.tasks || []) as TaskWithOwnerFields[];

            console.log('allTasks:', allTasks);

            const userId = user?.id;
            const userTasks = userId
                ? allTasks.filter((task) => isTaskOwnedByUser(task, userId))
                : [];

            // Filter tasks for the selected date using primary date (Date Added, then due_date)
            const tasksForDate = userTasks.filter((task: Task) => isTaskForDate(task, date));
            const sortedForDate = sortTasksByRecent(tasksForDate);

            setTasks(sortedForDate);
            setFilteredTasks(sortedForDate);
        } catch (err) {
            console.error('Error fetching tasks:', err);
            setTasksError(err instanceof Error ? err.message : 'An error occurred while fetching tasks');
        } finally {
            setIsLoadingTasks(false);
        }
    };

    // Fetch all tasks on component mount (for initial load)
    useEffect(() => {
        fetchAllTasks();
        fetchAppointments();
        fetchSharedDocuments();
        fetchBroadcastMessages();
    }, []);

    // Refresh tasks and appointments when date range or calendar selection changes (only if valid)
    useEffect(() => {
        if (!validateDateRange(activityRange.start, activityRange.end)) {
            return;
        }
        // Include selected calendar date in fetch range so clicking a date shows its appointments
        let effectiveStart = activityRange.start;
        let effectiveEnd = activityRange.end;
        if (selectedDate) {
            const selectedStr = formatDateForAPI(selectedDate);
            if (selectedStr < effectiveStart) effectiveStart = selectedStr;
            if (selectedStr > effectiveEnd) effectiveEnd = selectedStr;
        }
        fetchAllTasks();
        fetchAppointments({ start: effectiveStart, end: effectiveEnd });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activityRange.start, activityRange.end, selectedDate]);

    // Fetch appointments with date range filtering
    const fetchAppointments = async (range?: { start: string; end: string }) => {
        setIsLoadingAppointments(true);
        setAppointmentsError(null);
        try {
            const dateRange = range || activityRange;
            if (!dateRange.start || !dateRange.end) {
                setAppointments([]);
                setIsLoadingAppointments(false);
                return;
            }

            const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
            const queryParams = new URLSearchParams({
                startDate: dateRange.start,
                endDate: dateRange.end,
            });

            const response = await fetch(`/api/planner/appointments?${queryParams.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch appointments');
            }

            const data = await response.json();
            let appointmentsList = data.appointments || data.data || [];

            // Keep only appointments that belong to the logged-in user
            const userId = user?.id;
            if (userId) {
                const userIdStr = String(userId);
                appointmentsList = appointmentsList.filter((apt: any) => {
                    const createdBy = apt.created_by ?? apt.user_id ?? apt.owner_id;
                    return createdBy != null && String(createdBy) === userIdStr;
                });
            }

            // Map API response to Appointment interface
            const mappedAppointments: Appointment[] = appointmentsList.map((apt: any) => ({
                id: apt.id,
                time: apt.time || '',
                type: apt.type || '',
                client: apt.client || apt.organization_name || '',
                job: apt.job || apt.job_title || '',
                references: apt.references || [],
                owner: apt.owner || apt.created_by_name || '',
                date: apt.date || apt.start_date || '',
            }));

            // Sort by date and time
            mappedAppointments.sort((a, b) => {
                if (!a.date || !b.date) return 0;
                if (a.date !== b.date) {
                    return a.date.localeCompare(b.date);
                }
                return a.time.localeCompare(b.time);
            });

            setAppointments(mappedAppointments);
        } catch (err) {
            console.error('Error fetching appointments:', err);
            setAppointmentsError(err instanceof Error ? err.message : 'An error occurred while fetching appointments');
            setAppointments([]);
        } finally {
            setIsLoadingAppointments(false);
        }
    };

    // Fetch all tasks with date range filtering
    const fetchAllTasks = async () => {
        setIsLoadingTasks(true);
        setTasksError(null);
        try {
            const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
            let url = '/api/tasks';

            // Add date range query parameters if available
            if (activityRange.start && activityRange.end) {
                const queryParams = new URLSearchParams({
                    startDate: activityRange.start,
                    endDate: activityRange.end,
                });
                url += `?${queryParams.toString()}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch tasks');
            }

            const data = await response.json();
            const allTasksData = (data.tasks || []) as TaskWithOwnerFields[];

            const userId = user?.id;
            const userTasks = userId
                ? allTasksData.filter((task) => isTaskOwnedByUser(task, userId))
                : [];

            // Store all user tasks (unsliced) for calendar indicators
            setAllTasks(userTasks);

            // Filter tasks by date range on frontend if backend doesn't support it,
            // using primary date (Date Added, then due_date)
            let filteredTasksData: Task[] = userTasks;
            if (activityRange.start && activityRange.end) {
                const startDate = new Date(activityRange.start);
                const endDate = new Date(activityRange.end);
                endDate.setHours(23, 59, 59, 999); // Include the entire end date

                filteredTasksData = userTasks.filter((task: Task) => {
                    const taskDate = getTaskPrimaryDate(task);
                    if (!taskDate) return false;
                    return taskDate >= startDate && taskDate <= endDate;
                });
            }

            const sortedTasks = sortTasksByRecent(filteredTasksData);
            setTasks(sortedTasks);
            setFilteredTasks(sortedTasks);
        } catch (err) {
            console.error('Error fetching tasks:', err);
            setTasksError(err instanceof Error ? err.message : 'An error occurred while fetching tasks');
        } finally {
            setIsLoadingTasks(false);
        }
    };

    // Format date for display
    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Get priority color
    const getPriorityColor = (priority: string) => {
        switch (priority?.toLowerCase()) {
            case 'high':
                return 'bg-red-100 text-red-800';
            case 'medium':
                return 'bg-yellow-100 text-yellow-800';
            case 'low':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    // Handle task click
    const handleTaskClick = (taskId: string) => {
        router.push(`/dashboard/tasks/view?id=${taskId}`);
    };

    // Toggle task completion status
    const handleToggleTaskComplete = async (task: Task, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigation when clicking checkbox

        const newCompletedStatus = !task.is_completed;

        try {
            const response = await fetch(`/api/tasks/${task.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                },
                body: JSON.stringify({
                    isCompleted: newCompletedStatus, // Backend expects camelCase
                    status: newCompletedStatus ? 'Completed' : (task.status === 'Completed' ? 'Open' : task.status || 'Open'),
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to update task');
            }

            // Update the task in local state with the response data if available
            const updatedTask = data.task || {
                ...task,
                is_completed: newCompletedStatus,
                status: newCompletedStatus ? 'Completed' : (task.status === 'Completed' ? 'Open' : task.status || 'Open')
            };

            setTasks((prevTasks) =>
                prevTasks.map((t) =>
                    t.id === task.id ? updatedTask : t
                )
            );
            setFilteredTasks((prevTasks) =>
                prevTasks.map((t) =>
                    t.id === task.id ? updatedTask : t
                )
            );
            setAllTasks((prevTasks) =>
                prevTasks.map((t) =>
                    t.id === task.id ? updatedTask : t
                )
            );
        } catch (err) {
            console.error('Error updating task:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to update task');
        }
    };

    // Filter tasks based on search query and completion status
    useEffect(() => {
        let filtered = tasks;

        // Apply completion status filter
        if (taskFilter === 'completed') {
            filtered = filtered.filter(task => task.is_completed === true);
        } else if (taskFilter === 'pending') {
            filtered = filtered.filter(task => task.is_completed === false);
        }
        // 'all' shows all tasks, so no filtering needed

        // Apply search query filter
        if (taskSearchQuery.trim()) {
            filtered = filtered.filter(task =>
                task.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
                task.description?.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
                task.status?.toLowerCase().includes(taskSearchQuery.toLowerCase())
            );
        }

        setFilteredTasks(filtered);
    }, [taskSearchQuery, taskFilter, tasks]);

    // Handle close/return to home
    const handleClose = () => {
        router.push('/dashboard');
    };

    const refreshDashboardData = async () => {
        setIsRefreshingDashboard(true);
        try {
            await Promise.all([
                fetchAllTasks(),
                fetchAppointments(),
                fetchSharedDocuments(),
                fetchBroadcastMessages(),
                fetchActivityReport(activityRange),
            ]);
            toast.success('Dashboard refreshed');
        } catch (err) {
            console.error('Error refreshing dashboard:', err);
            toast.error('Failed to refresh dashboard');
        } finally {
            setIsRefreshingDashboard(false);
        }
    };

    // Fetch shared documents
    const fetchSharedDocuments = async () => {
        setIsLoadingDocuments(true);
        try {
            const response = await fetch('/api/shared-documents', {
                headers: {
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setSharedDocuments(data.documents || []);
            }
        } catch (err) {
            console.error('Error fetching shared documents:', err);
        } finally {
            setIsLoadingDocuments(false);
        }
    };

    // Fetch broadcast messages
    const fetchBroadcastMessages = async () => {
        setIsLoadingMessages(true);
        try {
            const response = await fetch('/api/broadcast-messages?limit=10', {
                headers: {
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setBroadcastMessages(data.messages || []);
            }
        } catch (err) {
            console.error('Error fetching broadcast messages:', err);
        } finally {
            setIsLoadingMessages(false);
        }
    };

    // Handle file upload
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const allowedTypes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'text/plain',
                'text/csv',
                'application/rtf'
            ];
            const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf'];
            const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

            if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
                toast.error('Invalid file type. Please upload PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, or RTF files only.');
                e.target.value = '';
                return;
            }

            setUploadFile(file);
        }
    };

    // Upload document
    const handleUploadDocument = async () => {
        if (!uploadFile) {
            toast.error('Please select a file to upload');
            return;
        }

        setIsUploading(true);
        try {
            // Store file metadata (in production, upload actual file to storage service)
            const filePath = `uploads/shared/${Date.now()}_${uploadFile.name}`;

            const response = await fetch('/api/shared-documents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                },
                body: JSON.stringify({
                    file_name: uploadFile.name,
                    file_path: filePath,
                    file_size: uploadFile.size,
                    mime_type: uploadFile.type,
                    description: uploadDescription.trim() || null,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to upload document');
            }

            setShowUploadModal(false);
            setUploadFile(null);
            setUploadDescription('');
            fetchSharedDocuments();
        } catch (err) {
            console.error('Error uploading document:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to upload document');
        } finally {
            setIsUploading(false);
        }
    };

    // Post broadcast message
    const handlePostMessage = async () => {
        if (!newMessage.trim()) {
            toast.error('Please enter a message');
            return;
        }

        setIsPostingMessage(true);
        try {
            const response = await fetch('/api/broadcast-messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                },
                body: JSON.stringify({
                    message: newMessage.trim(),
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to post message');
            }

            setNewMessage('');
            fetchBroadcastMessages();
        } catch (err) {
            console.error('Error posting message:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to post message');
        } finally {
            setIsPostingMessage(false);
        }
    };

    // Delete document
    const handleDeleteDocument = async (id: number) => {
        if (!confirm('Are you sure you want to delete this document?')) {
            return;
        }

        try {
            const response = await fetch(`/api/shared-documents/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                },
            });

            if (!response.ok) {
                throw new Error('Failed to delete document');
            }

            fetchSharedDocuments();
        } catch (err) {
            console.error('Error deleting document:', err);
            toast.error('Failed to delete document');
        }
    };

    // Delete broadcast message
    const handleDeleteMessage = async (id: number) => {
        if (!confirm('Are you sure you want to delete this message?')) {
            return;
        }

        try {
            const response = await fetch(`/api/broadcast-messages/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                },
            });

            if (!response.ok) {
                throw new Error('Failed to delete message');
            }

            fetchBroadcastMessages();
        } catch (err) {
            console.error('Error deleting message:', err);
            toast.error('Failed to delete message');
        }
    };

    // Edit document description
    const handleEditDocument = (doc: any) => {
        setEditingDocumentId(doc.id);
        setEditDocumentDescription(doc.description || '');
    };

    // Cancel editing document
    const handleCancelEditDocument = () => {
        setEditingDocumentId(null);
        setEditDocumentDescription('');
    };

    // Update document description
    const handleUpdateDocument = async (id: number) => {
        setIsUpdatingDocument(true);
        try {
            const response = await fetch(`/api/shared-documents/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                },
                body: JSON.stringify({
                    description: editDocumentDescription.trim() || null,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to update document');
            }

            setEditingDocumentId(null);
            setEditDocumentDescription('');
            fetchSharedDocuments();
        } catch (err) {
            console.error('Error updating document:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to update document');
        } finally {
            setIsUpdatingDocument(false);
        }
    };

    // Edit message
    const handleEditMessage = (msg: any) => {
        setEditingMessageId(msg.id);
        setEditMessageText(msg.message || '');
    };

    // Cancel editing message
    const handleCancelEditMessage = () => {
        setEditingMessageId(null);
        setEditMessageText('');
    };

    // Update message
    const handleUpdateMessage = async (id: number) => {
        if (!editMessageText.trim()) {
            toast.error('Please enter a message');
            return;
        }

        setIsUpdatingMessage(true);
        try {
            const response = await fetch(`/api/broadcast-messages/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                },
                body: JSON.stringify({
                    message: editMessageText.trim(),
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to update message');
            }

            setEditingMessageId(null);
            setEditMessageText('');
            fetchBroadcastMessages();
        } catch (err) {
            console.error('Error updating message:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to update message');
        } finally {
            setIsUpdatingMessage(false);
        }
    };

    return (
        <div className="flex flex-col h-full relative">
            {/* X button in top right corner */}
            <div>
                <button
                    type="button"
                    onClick={refreshDashboardData}
                    disabled={isRefreshingDashboard}
                    className="absolute top-2 right-14 z-10 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-label="Refresh dashboard"
                    title="Refresh dashboard"
                >
                    <FiMonitor size={22} />
                </button>

                <Link
                    href="/home"
                    className="absolute top-2 right-2 z-10 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                    aria-label="Close and return to home"
                >
                    <FiX size={24} />
                </Link>
            </div>

            {/* Date Range Picker - Top Left */}
            <div className="mb-4 px-2">
                <div className="bg-white rounded-md shadow p-4 inline-block">
                    <div className="flex items-center gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                            <input
                                type="date"
                                value={activityRange.start}
                                onChange={(e) => {
                                    const newStart = e.target.value;
                                    setActivityRange(prev => ({ ...prev, start: newStart }));
                                    // Auto-correct end date if needed
                                    if (newStart && activityRange.end && newStart > activityRange.end) {
                                        setActivityRange({ start: newStart, end: newStart });
                                    }
                                }}
                                max={activityRange.end || undefined}
                                className={`px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${dateRangeError ? 'border-red-300' : 'border-gray-300'
                                    }`}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                            <input
                                type="date"
                                value={activityRange.end}
                                onChange={(e) => {
                                    const newEnd = e.target.value;
                                    setActivityRange(prev => ({ ...prev, end: newEnd }));
                                }}
                                min={activityRange.start || undefined}
                                className={`px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${dateRangeError ? 'border-red-300' : 'border-gray-300'
                                    }`}
                            />
                        </div>
                    </div>
                    {dateRangeError && (
                        <div className="mt-2 text-xs text-red-600">
                            {dateRangeError}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow mb-4">
                {/* Appointments Calendar */}
                <div className="bg-white rounded-md shadow overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-200">
                        <h2 className="text-lg font-semibold">Calendar</h2>
                    </div>
                    <div className="p-4">
                        {/* Calendar navigation */}
                        <div className="flex items-center justify-between mb-4">
                            <button
                                onClick={goToPreviousMonth}
                                className="p-1 hover:bg-gray-100 rounded"
                                aria-label="Previous month"
                            >
                                <FiChevronLeft size={20} className="text-gray-600" />
                            </button>
                            <div className="flex items-center space-x-2">
                                <h3 className="text-sm font-semibold text-gray-800">
                                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                                </h3>
                                <button
                                    onClick={goToToday}
                                    className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                                >
                                    Today
                                </button>
                            </div>
                            <button
                                onClick={goToNextMonth}
                                className="p-1 hover:bg-gray-100 rounded"
                                aria-label="Next month"
                            >
                                <FiChevronRight size={20} className="text-gray-600" />
                            </button>
                        </div>

                        {/* Calendar header */}
                        <div className="grid grid-cols-7 mb-2">
                            {daysOfWeek.map((day, index) => (
                                <div key={index} className="text-center py-2 text-xs font-medium text-gray-500">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar grid */}
                        {calendarWeeks.map((week, weekIndex) => (
                            <div key={weekIndex} className="grid grid-cols-7 mb-1">
                                {week.map((dayData, dayIndex) => {
                                    const { day, isCurrentMonth, date } = dayData;
                                    const isTodayDate = isToday(date);
                                    const isSelectedDate = isSelected(date);
                                    const hasTasksDate = hasTasks(date);
                                    const hasAppointmentsDate = hasAppointments(date);
                                    const inRange = isInDateRange(date);

                                    return (
                                        <button
                                            key={dayIndex}
                                            onClick={() => handleDateClick(date)}
                                            className={`
                                                text-center py-2 text-sm rounded transition-colors relative
                                                ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                                                ${!inRange && isCurrentMonth ? 'opacity-40' : ''}
                                                ${isTodayDate && !isSelectedDate ? 'bg-blue-100 font-semibold' : ''}
                                                ${isSelectedDate ? 'bg-blue-500 text-white font-semibold' : ''}
                                                ${!isSelectedDate && !isTodayDate && isCurrentMonth && inRange ? 'hover:bg-gray-100' : ''}
                                                ${hasTasksDate && !isSelectedDate && isCurrentMonth && inRange ? 'bg-green-50' : ''}
                                            `}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}

                        {/* Event button */}
                        <div className="mt-4">
                            <button
                                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-md text-sm font-medium transition-colors"
                                onClick={() => {
                                    if (selectedDate) {
                                        // Handle event creation for selected date
                                        console.log('Create event for:', selectedDate);
                                    }
                                }}
                            >
                                {selectedDate ? `Event on ${selectedDate.toLocaleDateString()}` : 'Event'}
                            </button>
                        </div>

                        {/* Available text */}
                        <div className="mt-4 text-center text-gray-400 text-xs">
                            Available
                        </div>
                    </div>

                    {/* Appointments List View */}
                    <div className="border-t border-gray-200">
                        <div className="p-2 border-b border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-700">Appointments</h3>
                        </div>
                        <div className="p-4 max-h-64 overflow-y-auto">
                            {isLoadingAppointments ? (
                                <div className="text-center py-4 text-sm text-gray-500">Loading appointments...</div>
                            ) : appointmentsError ? (
                                <div className="text-center py-4">
                                    <p className="text-sm text-red-600 mb-2">Error loading appointments</p>
                                    <p className="text-xs text-gray-500">{appointmentsError}</p>
                                    <button
                                        onClick={() => fetchAppointments()}
                                        className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                                    >
                                        Retry
                                    </button>
                                </div>
                            ) : appointments.length === 0 ? (
                                <div className="text-center py-4">
                                    <p className="text-sm text-gray-500">No appointments found</p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {activityRange.start && activityRange.end
                                            ? `in the selected date range`
                                            : 'Select a date range to view appointments'}
                                    </p>
                                </div>
                            ) : displayedAppointments.length === 0 ? (
                                <div className="text-center py-4">
                                    <p className="text-sm text-gray-500">No appointments on selected date</p>
                                    <p className="text-xs text-gray-400 mt-1">Select a date with appointments or clear selection</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {displayedAppointments.map((apt) => {
                                        const aptDateStr = apt.date ? formatDateForAPI(new Date(apt.date)) : '';
                                        const plannerUrl = aptDateStr
                                            ? `/dashboard/planner?date=${aptDateStr}&view=List${apt.id ? `&appointmentId=${apt.id}` : ''}`
                                            : '/dashboard/planner';
                                        return (
                                            <div
                                                key={apt.id}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => router.push(plannerUrl)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(plannerUrl); } }}
                                                className="p-2 border border-gray-200 rounded text-xs hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition-colors"
                                            >
                                                <div className="font-medium text-gray-700">
                                                    {apt.date && new Date(apt.date).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })} {apt.time}
                                                </div>
                                                <div className="text-gray-600 mt-1">
                                                    <div className="font-medium">{apt.type}</div>
                                                    {apt.client && <div>Client: {apt.client}</div>}
                                                    {apt.job && <div>Job: {apt.job}</div>}
                                                    {apt.owner && <div className="text-gray-500 text-xs mt-1">Owner: {apt.owner}</div>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Middle - Tasks */}
                <div className="bg-white rounded-md shadow overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-200">
                        <h2 className="text-lg font-semibold mb-2">Tasks</h2>

                        {/* Filter dropdown */}
                        <div className="mb-2">
                            <select
                                value={taskFilter}
                                onChange={(e) => setTaskFilter(e.target.value as 'all' | 'completed' | 'pending')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                            >
                                <option value="all">All Tasks</option>
                                <option value="pending">Tasks to Do</option>
                                <option value="completed">Completed Tasks</option>
                            </select>
                        </div>

                        {/* Search bar */}
                        <div className="relative">
                            <FiSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search tasks..."
                                value={taskSearchQuery}
                                onChange={(e) => setTaskSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                        </div>
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto max-h-96">
                        {isLoadingTasks ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="text-gray-400 text-sm">Loading tasks...</div>
                            </div>
                        ) : tasksError ? (
                            <div className="text-center py-8">
                                <p className="text-red-600 text-sm mb-2">Error loading tasks</p>
                                <p className="text-gray-400 text-xs">{tasksError}</p>
                                <button
                                    onClick={fetchAllTasks}
                                    className="mt-4 text-blue-600 hover:text-blue-800 text-xs"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : tasks.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="bg-gray-200 rounded-full p-4 inline-flex mx-auto mb-4">
                                    <FiCheckSquare size={24} className="text-gray-500" />
                                </div>
                                <p className="text-gray-600 text-sm">
                                    {selectedDate
                                        ? `No tasks found for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                        : 'No tasks found'}
                                </p>
                                <p className="text-gray-400 text-xs mt-2">
                                    {selectedDate
                                        ? 'Click on a different date or create a new task'
                                        : 'Create your first task to get started'}
                                </p>
                                <Link
                                    href="/dashboard/tasks/add"
                                    className="mt-4 inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-xs font-medium transition-colors"
                                >
                                    Add Task
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        onClick={() => handleTaskClick(task.id)}
                                        className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-start space-x-2 flex-1">
                                                <input
                                                    type="checkbox"
                                                    checked={!!task.is_completed}
                                                    onChange={(e) => handleToggleTaskComplete(task, e as unknown as React.MouseEvent)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                                                    title={task.is_completed ? 'Mark as incomplete' : 'Mark as complete'}
                                                    aria-label={task.is_completed ? 'Mark as incomplete' : 'Mark as complete'}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <h3 className={`text-sm font-medium truncate ${task.is_completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                                        {task.title}
                                                    </h3>
                                                    {task.description && (
                                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                                            {task.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                                            <div className="flex items-center space-x-2 flex-wrap">
                                                {task.priority && (
                                                    <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(task.priority)}`}>
                                                        {task.priority}
                                                    </span>
                                                )}
                                                {task.status && (
                                                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                                                        {task.status}
                                                    </span>
                                                )}
                                            </div>
                                            {task.created_at && (
                                                <div className="flex items-center text-xs text-gray-500">
                                                    <FiClock size={12} className="mr-1" />
                                                    {formatDate(task.created_at)}
                                                </div>
                                            )}
                                        </div>
                                        {(task.assigned_to_name || task.created_by_name) && (
                                            <div className="mt-2 text-xs text-gray-500">
                                                {task.assigned_to_name && (
                                                    <span>Assigned to: {task.assigned_to_name}</span>
                                                )}
                                                {task.created_by_name && (
                                                    <span className={task.assigned_to_name ? ' ml-2' : ''}>
                                                        Created by: {task.created_by_name}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {!selectedDate && filteredTasks.length >= 5 && (
                                    <div className="pt-2 border-t border-gray-200">
                                        <Link
                                            href="/dashboard/tasks"
                                            className="text-center block text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        >
                                            View All Tasks →
                                        </Link>
                                    </div>
                                )}
                                {selectedDate && (
                                    <div className="pt-2 border-t border-gray-200">
                                        <button
                                            onClick={async () => {
                                                setSelectedDate(null);
                                                await fetchAllTasks();
                                            }}
                                            className="text-center block w-full text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        >
                                            Show All Tasks →
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column - Information */}
                <div className="bg-white rounded-md shadow overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Information:</h2>
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto space-y-4">
                        {/* Shared Documents Section */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                                    <FiFile className="mr-2" size={16} />
                                    Shared Documents
                                </h3>
                                <button
                                    onClick={() => setShowUploadModal(true)}
                                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                                >
                                    <FiUpload size={12} className="mr-1" />
                                    Upload
                                </button>
                            </div>
                            {isLoadingDocuments ? (
                                <div className="text-xs text-gray-400 py-2">Loading documents...</div>
                            ) : sharedDocuments.length === 0 ? (
                                <div className="text-xs text-gray-400 py-2">No documents shared yet</div>
                            ) : (
                                <div className="space-y-2">
                                    {sharedDocuments.slice(0, 5).map((doc) => (
                                        <div
                                            key={doc.id}
                                            className="p-2 bg-gray-50 rounded text-xs hover:bg-gray-100"
                                        >
                                            {editingDocumentId === doc.id ? (
                                                <div className="space-y-2">
                                                    <div className="font-medium text-gray-700 truncate">
                                                        {doc.file_name}
                                                    </div>
                                                    <textarea
                                                        value={editDocumentDescription}
                                                        onChange={(e) => setEditDocumentDescription(e.target.value)}
                                                        placeholder="Add or edit description..."
                                                        className="w-full p-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                                                        rows={2}
                                                    />
                                                    <div className="flex items-center justify-end space-x-2">
                                                        <button
                                                            onClick={handleCancelEditDocument}
                                                            disabled={isUpdatingDocument}
                                                            className="text-xs text-gray-600 hover:text-gray-800 disabled:opacity-50"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateDocument(doc.id)}
                                                            disabled={isUpdatingDocument}
                                                            className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                                        >
                                                            {isUpdatingDocument ? 'Saving...' : 'Save'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-gray-700 truncate">
                                                            {doc.file_name}
                                                        </div>
                                                        {doc.description && (
                                                            <div className="text-gray-600 mt-1 break-words">
                                                                {doc.description}
                                                            </div>
                                                        )}
                                                        {doc.uploaded_by_name && (
                                                            <div className="text-gray-500 text-xs mt-1">
                                                                by {doc.uploaded_by_name}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center space-x-1 ml-2">
                                                        <button
                                                            onClick={() => handleEditDocument(doc)}
                                                            className="text-blue-600 hover:text-blue-800"
                                                            title="Edit"
                                                        >
                                                            <FiEdit2 size={12} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteDocument(doc.id)}
                                                            className="text-red-600 hover:text-red-800"
                                                            title="Delete"
                                                        >
                                                            <FiTrash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Broadcast Messages Section */}
                        <div className="border-t border-gray-200 pt-4">
                            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                                <FiMessageSquare className="mr-2" size={16} />
                                Broadcast Messages
                            </h3>

                            {/* Post Message Form */}
                            <div className="mb-3">
                                <textarea
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Write a message for all users..."
                                    className="w-full p-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    rows={2}
                                />
                                <button
                                    onClick={handlePostMessage}
                                    disabled={!newMessage.trim() || isPostingMessage}
                                    className="mt-1 w-full px-3 py-1.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isPostingMessage ? 'Posting...' : 'Post Message'}
                                </button>
                            </div>

                            {/* Messages List */}
                            {isLoadingMessages ? (
                                <div className="text-xs text-gray-400 py-2">Loading messages...</div>
                            ) : broadcastMessages.length === 0 ? (
                                <div className="text-xs text-gray-400 py-2">No messages yet</div>
                            ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {broadcastMessages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className="p-2 bg-gray-50 rounded text-xs"
                                        >
                                            {editingMessageId === msg.id ? (
                                                <div className="space-y-2">
                                                    <textarea
                                                        value={editMessageText}
                                                        onChange={(e) => setEditMessageText(e.target.value)}
                                                        placeholder="Write a message for all users..."
                                                        className="w-full p-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                                        rows={3}
                                                    />
                                                    <div className="flex items-center justify-end space-x-2">
                                                        <button
                                                            onClick={handleCancelEditMessage}
                                                            disabled={isUpdatingMessage}
                                                            className="text-xs text-gray-600 hover:text-gray-800 disabled:opacity-50"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateMessage(msg.id)}
                                                            disabled={!editMessageText.trim() || isUpdatingMessage}
                                                            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {isUpdatingMessage ? 'Saving...' : 'Save'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-gray-700 whitespace-pre-wrap break-words">
                                                            {msg.message}
                                                        </p>
                                                        <div className="text-gray-500 mt-1">
                                                            {msg.created_by_name || 'Unknown'} • {new Date(msg.created_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                                                        <button
                                                            onClick={() => handleEditMessage(msg)}
                                                            className="text-blue-600 hover:text-blue-800"
                                                            title="Edit"
                                                        >
                                                            <FiEdit2 size={12} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteMessage(msg.id)}
                                                            className="text-red-600 hover:text-red-800"
                                                            title="Delete"
                                                        >
                                                            <FiTrash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">

            </div>

            <ActivityReportGrid
                title="ACTIVITY REPORT"
                subtitle={`Counts are filtered to ${user?.name || user?.email || 'current user'} and the selected date range (${activityRange.start} to ${activityRange.end}).`}
                rows={activityReportRows}
                loading={isLoadingActivityReport}
                error={activityReportError}
                loadingDetails={isLoadingActivityDetails}
                onNotesClick={(row) => handleActivityNotesClick(row.categoryLabel)}
                onRecordsClick={(row) => handleActivityRecordsClick(row.categoryLabel)}
                notesModalOpen={showActivityNotesModal}
                notesDetails={activityNotesDetails}
                recordsModalOpen={showActivityRecordsModal}
                recordsDetails={activityRecordsDetails}
                onCloseNotes={() => { setShowActivityNotesModal(false); setActivityNotesDetails(null); }}
                onCloseRecords={() => { setShowActivityRecordsModal(false); setActivityRecordsDetails(null); }}
                userDisplayName={user?.name || user?.email}
            />

            {/* Next Button - Bottom Right */}
            <div className="flex justify-end mt-6 mb-4 px-6">
                <div className="text-right">
                    <div className="text-lg mb-1 text-gray-700">Next</div>
                    <button
                        className="bg-teal-600 hover:bg-teal-700 text-white w-24 h-10 rounded flex items-center justify-center transition-colors"
                        onClick={handleNextClick}
                        aria-label="Go to next page"
                    >
                        <span className="transform translate-x-1">▶</span>
                    </button>
                </div>
            </div>

            {/* Upload Document Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-999">
                    <div className="bg-white rounded shadow-xl max-w-md w-full mx-4">
                        <div className="flex justify-between items-center p-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold">Upload Shared Document</h2>
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    setUploadFile(null);
                                    setUploadDescription('');
                                }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <span className="text-2xl font-bold">×</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    File <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="file"
                                    onChange={handleFileSelect}
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf"
                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                                <div className="mt-1 text-xs text-gray-500">
                                    Accepted formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, RTF
                                </div>
                                {uploadFile && (
                                    <div className="mt-2 text-xs text-gray-600">
                                        Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(2)} KB)
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description (Optional)
                                </label>
                                <textarea
                                    value={uploadDescription}
                                    onChange={(e) => setUploadDescription(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                                    rows={3}
                                    placeholder="Add a description for this document..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    setUploadFile(null);
                                    setUploadDescription('');
                                }}
                                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 text-sm"
                                disabled={isUploading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUploadDocument}
                                disabled={!uploadFile || isUploading}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUploading ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}