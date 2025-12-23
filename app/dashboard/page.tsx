'use client'

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { FiSearch, FiChevronDown, FiX, FiChevronLeft, FiChevronRight, FiCheckSquare, FiPlus, FiClock, FiCalendar, FiEdit2 } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Task {
    id: string;
    title: string;
    description?: string;
    is_completed: boolean;
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
    const [goalsSearchQuery, setGoalsSearchQuery] = useState('');
    const [isLoadingTasks, setIsLoadingTasks] = useState(true);
    const [tasksError, setTasksError] = useState<string | null>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
    const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
    const [showGoalsQuotas, setShowGoalsQuotas] = useState(true);

    // Activity Report (Goals & Quotas) - scoped to logged-in user + selected date range
    const toISODateInput = (d: Date) => d.toISOString().slice(0, 10);
    const getMonthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
    const [activityRange, setActivityRange] = useState<{ start: string; end: string }>(() => ({
        start: toISODateInput(getMonthStart(new Date())),
        end: toISODateInput(new Date()),
    }));
    const [isLoadingActivityReport, setIsLoadingActivityReport] = useState(false);
    const [activityReportError, setActivityReportError] = useState<string | null>(null);
    const [activityReport, setActivityReport] = useState<any>(null);

    const fetchActivityReport = async (range: { start: string; end: string }) => {
        if (!user?.id) return;
        if (!range.start || !range.end) return;
        if (range.start > range.end) return;

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
            console.error('Error fetching activity report:', err);
            setActivityReportError(err instanceof Error ? err.message : 'Failed to fetch activity report');
            setActivityReport(null);
        } finally {
            setIsLoadingActivityReport(false);
        }
    };

    // Refresh whenever date range changes
    useEffect(() => {
        const handle = setTimeout(() => {
            fetchActivityReport(activityRange);
        }, 250);
        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activityRange.start, activityRange.end, user?.id]);

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
        setSelectedDate(date);
        await fetchTasksForDate(date);
    };

    // Check if a date has tasks
    const hasTasks = (date: Date) => {
        if (allTasks.length === 0) return false;
        const dateString = formatDateForAPI(date);
        return allTasks.some((task: Task) => {
            if (!task.due_date) return false;
            const taskDate = new Date(task.due_date);
            return formatDateForAPI(taskDate) === dateString;
        });
    };

    // Format date to YYYY-MM-DD for API comparison
    const formatDateForAPI = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Check if a task's due_date matches the selected date
    const isTaskForDate = (task: Task, date: Date): boolean => {
        if (!task.due_date) return false;
        const taskDate = new Date(task.due_date);
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
            const allTasks = data.tasks || [];
            
            // Filter tasks for the selected date
            const dateString = formatDateForAPI(date);
            const tasksForDate = allTasks.filter((task: Task) => {
                if (!task.due_date) return false;
                const taskDate = new Date(task.due_date);
                return formatDateForAPI(taskDate) === dateString;
            });
            
            setTasks(tasksForDate);
            setFilteredTasks(tasksForDate);
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
    }, []);

    // Fetch appointments (using mock data similar to planner page)
    const fetchAppointments = async () => {
        setIsLoadingAppointments(true);
        setAppointmentsError(null);
        try {
            // Mock appointments data - in production, this would fetch from API
            const mockAppointments: Appointment[] = [
                {
                    id: 1,
                    time: '9:00 AM',
                    type: 'Meeting',
                    client: 'Tech Corp',
                    job: 'Senior Developer',
                    references: ['Stephanie Marcus', 'Sophia Esposito'],
                    owner: 'Devi Arnold',
                    date: new Date().toISOString().split('T')[0]
                },
                {
                    id: 2,
                    time: '9:30 AM',
                    type: 'Meeting',
                    client: 'Startup Inc',
                    job: 'Product Manager',
                    references: ['Toni Arruda', 'Allison Silva'],
                    owner: 'Briana Dozois',
                    date: new Date().toISOString().split('T')[0]
                },
                {
                    id: 3,
                    time: '10:00 AM',
                    type: 'Interview',
                    client: 'Consulting Firm',
                    job: 'Business Analyst',
                    references: ['Evan Waicberg', 'Rachel Howell'],
                    owner: 'Justin Shields',
                    date: new Date().toISOString().split('T')[0]
                },
                {
                    id: 4,
                    time: '2:00 PM',
                    type: 'Call',
                    client: 'Finance Co',
                    job: 'Financial Advisor',
                    references: ['Evan Waicberg'],
                    owner: 'Devi Arnold',
                    date: new Date().toISOString().split('T')[0]
                },
                {
                    id: 5,
                    time: '3:30 PM',
                    type: 'Meeting',
                    client: 'Marketing Agency',
                    job: 'Creative Director',
                    references: ['Stephanie Marcus'],
                    owner: 'Briana Dozois',
                    date: new Date().toISOString().split('T')[0]
                }
            ];
            
            // Filter appointments for today and upcoming
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const filteredAppointments = mockAppointments.filter((apt) => {
                if (!apt.date) return false;
                const aptDate = new Date(apt.date);
                aptDate.setHours(0, 0, 0, 0);
                return aptDate >= today;
            });
            
            // Sort by date and time
            filteredAppointments.sort((a, b) => {
                if (a.date !== b.date) {
                    return a.date!.localeCompare(b.date!);
                }
                return a.time.localeCompare(b.time);
            });
            
            setAppointments(filteredAppointments.slice(0, 5)); // Show up to 5 appointments
        } catch (err) {
            console.error('Error fetching appointments:', err);
            setAppointmentsError(err instanceof Error ? err.message : 'An error occurred while fetching appointments');
        } finally {
            setIsLoadingAppointments(false);
        }
    };

    // Fetch all tasks (for initial load or when no date is selected)
    const fetchAllTasks = async () => {
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
            const allTasksData = data.tasks || [];
            setAllTasks(allTasksData); // Store all tasks for calendar indicators
            
            // Get up to 5 recent tasks for dashboard when no date is selected
            const recentTasks = allTasksData.slice(0, 5);
            setTasks(recentTasks);
            setFilteredTasks(recentTasks);
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

    // Filter tasks based on search query
    useEffect(() => {
        if (!taskSearchQuery.trim()) {
            setFilteredTasks(tasks);
        } else {
            const filtered = tasks.filter(task => 
                task.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
                task.description?.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
                task.status?.toLowerCase().includes(taskSearchQuery.toLowerCase())
            );
            setFilteredTasks(filtered);
        }
    }, [taskSearchQuery, tasks]);

    // Handle close/return to home
    const handleClose = () => {
        router.push('/dashboard');
    };

    return (
        <div className="flex flex-col h-full relative">
            {/* X button in top right corner */}
            <Link
                href="/home"
                className="absolute top-2 right-2 z-10 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                aria-label="Close and return to home"
            >
                <FiX size={24} />
            </Link>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow mb-4">
                {/* Appointments Calendar */}
                <div className="bg-white rounded-md shadow overflow-hidden">
                    <div className="p-2 border-b border-gray-200">
                        <h2 className="text-lg font-semibold">Appointments</h2>
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
                                    
                                    return (
                                        <button
                                            key={dayIndex}
                                            onClick={() => handleDateClick(date)}
                                            className={`
                                                text-center py-2 text-sm rounded transition-colors relative
                                                ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                                                ${isTodayDate && !isSelectedDate ? 'bg-blue-100 font-semibold' : ''}
                                                ${isSelectedDate ? 'bg-blue-500 text-white font-semibold' : ''}
                                                ${!isSelectedDate && !isTodayDate && isCurrentMonth ? 'hover:bg-gray-100' : ''}
                                                ${hasTasksDate && !isSelectedDate && isCurrentMonth ? 'bg-green-50' : ''}
                                            `}
                                        >
                                            {day}
                                            {hasTasksDate && !isSelectedDate && (
                                                <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-green-500 rounded-full"></span>
                                            )}
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
                </div>

                {/* Middle - Tasks */}
                <div className="bg-white rounded-md shadow overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-200">
                        <h2 className="text-lg font-semibold mb-2">Tasks</h2>
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
                    <div className="p-4 flex-1 overflow-y-auto">
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
                                                <div className={`mt-1 ${task.is_completed ? 'text-green-600' : 'text-gray-400'}`}>
                                                    <FiCheckSquare size={16} />
                                                </div>
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
                                            {task.due_date && (
                                                <div className="flex items-center text-xs text-gray-500">
                                                    <FiClock size={12} className="mr-1" />
                                                    {formatDate(task.due_date)}
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
                        <button
                            type="button"
                            className="p-1.5 mr-8 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                            aria-label="Edit information"
                            onClick={() => {
                                // Handle edit action
                                console.log('Edit information');
                            }}
                        >
                            <FiEdit2 size={18} />
                        </button>
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto">
                        {isLoadingAppointments ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="text-gray-400 text-sm">Loading...</div>
                            </div>
                        ) : appointmentsError ? (
                            <div className="text-center py-8">
                                <p className="text-red-600 text-sm mb-2">Error loading information</p>
                                <p className="text-gray-400 text-xs">{appointmentsError}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {appointments.slice(0, 3).map((appointment) => (
                                    <div
                                        key={appointment.id}
                                        className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-start space-x-2 flex-1">
                                                <div className="mt-1 text-blue-600">
                                                    <FiCalendar size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-sm font-medium text-gray-900">
                                                        {appointment.type} - {appointment.client}
                                                    </h3>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {appointment.job}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                                            <div className="flex items-center text-xs text-gray-500">
                                                <FiClock size={12} className="mr-1" />
                                                {appointment.time}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                {/* Select Date and Time Range */}
                {/* <div className="bg-white rounded-md shadow overflow-hidden">
                    <div className="p-2 border-b border-gray-200">
                        <h2 className="text-lg font-semibold">Select Date and Time Range</h2>
                    </div>
                    <div className="p-4">
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time:</label>
                            <input
                                type="datetime-local"
                                value={startDateTime}
                                onChange={(e) => setStartDateTime(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time:</label>
                            <input
                                type="datetime-local"
                                value={endDateTime}
                                onChange={(e) => setEndDateTime(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                        </div>
                    </div>
                </div> */}

                {/* Goals and Quotas */}
                {/* {showGoalsQuotas && (
                    <div className="bg-white rounded-md shadow overflow-hidden">
                        <div className="p-2 border-b border-gray-200">
                            <h2 className="text-lg font-semibold mb-2">Goals and Quotas</h2>
                            
                            <div className="relative">
                                <FiSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search goals and quotas..."
                                    value={goalsSearchQuery}
                                    onChange={(e) => setGoalsSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="text-center mb-4">
                                <p className="text-gray-600 text-sm mb-2">View and manage your goals and quotas</p>
                                <Link
                                    href="/dashboard/goals"
                                    className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                                >
                                    Go to Goals & Quotas
                                </Link>
                            </div>
                            <div className="border-t border-gray-200 pt-4 mt-4">
                                <div className="grid grid-cols-2 gap-4 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-blue-600">0</div>
                                        <div className="text-xs text-gray-500 mt-1">Active Goals</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-green-600">0</div>
                                        <div className="text-xs text-gray-500 mt-1">Quotas Met</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )} */}

                {/* Rules of Engagement */}
                {/* <div className="bg-white rounded-md shadow overflow-hidden">
                    <div className="p-2 border-b border-gray-200">
                        <h2 className="text-lg font-semibold">Rules of engagement</h2>
                    </div>
                    <div className="p-6 flex justify-center">
                        <button className="bg-blue-500 rounded-md p-4 w-28 h-28 flex flex-col items-center justify-center text-white hover:bg-blue-600 transition-colors">
                            <div className="bg-white w-10 h-10 mb-2 rounded flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div className="text-center">
                                <div className="text-sm font-medium">Rules of</div>
                                <div className="text-sm font-medium">Engagement</div>
                            </div>
                        </button>
                    </div>
                </div> */}
            </div>

            {/* Activity Report Section */}
            <div className="px-6 pb-6 mt-8">
                {/* Activity Report Header */}
                <div className="mb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            ACTIVITY REPORT
                        </h2>
                        <div className="text-xs text-gray-500">
                            Counts are filtered to <span className="font-medium">{user?.name || user?.email || 'current user'}</span> and the selected date range.
                        </div>
                        {activityReportError && (
                            <div className="text-xs text-red-600 mt-1">{activityReportError}</div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Start</label>
                            <input
                                type="date"
                                value={activityRange.start}
                                onChange={(e) => setActivityRange(prev => ({ ...prev, start: e.target.value }))}
                                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">End</label>
                            <input
                                type="date"
                                value={activityRange.end}
                                onChange={(e) => setActivityRange(prev => ({ ...prev, end: e.target.value }))}
                                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                            />
                        </div>
                        <div className="text-xs text-gray-500 pb-1">
                            {isLoadingActivityReport ? 'Refreshing…' : (activityReport?.range ? `Range: ${activityReport.range.start} → ${activityReport.range.end}` : '')}
                        </div>
                    </div>
                </div>

                {/* Activity Report Grid */}
                <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
                    {/* Header Row */}
                    <div className="flex bg-gray-50 border-b border-gray-300">
                        <div className="w-32 p-3 border-r border-gray-300"></div>
                        <div className="w-24 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
                            Notes
                        </div>
                        <div className="w-20 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
                            <div>Goals</div>
                            <div className="text-xs font-normal text-gray-500">Quotas</div>
                        </div>
                        <div className="w-32 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
                            Added to System
                        </div>
                        <div className="w-20 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
                            <div>Goals</div>
                            <div className="text-xs font-normal text-gray-500">Quotas</div>
                        </div>
                        <div className="w-28 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
                            Inbound emails
                        </div>
                        <div className="w-20 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
                            <div>Goals</div>
                            <div className="text-xs font-normal text-gray-500">Quotas</div>
                        </div>
                        <div className="w-28 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
                            Outbound emails
                        </div>
                        <div className="w-20 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
                            <div>Goals</div>
                            <div className="text-xs font-normal text-gray-500">Quotas</div>
                        </div>
                        <div className="w-16 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
                            Calls
                        </div>
                        <div className="w-20 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
                            <div>Goals</div>
                            <div className="text-xs font-normal text-gray-500">Quotas</div>
                        </div>
                        <div className="w-16 p-3 text-sm font-medium text-gray-700">
                            Texts
                        </div>
                    </div>

                    {/* Data Rows */}
                    {[
                        { key: "organizations", category: "Organization", rowClass: "bg-white" },
                        { key: "jobs", category: "Jobs", rowClass: "bg-gray-50" },
                        { key: "job-seekers", category: "Job Seekers", rowClass: "bg-white" },
                        { key: "hiring-managers", category: "Hiring Managers", rowClass: "bg-gray-50" },
                        { key: "placements", category: "Placements", rowClass: "bg-white" },
                        { key: "leads", category: "Leads", rowClass: "bg-gray-50" },
                    ].map((row, index) => (
                        <div
                            key={index}
                            className={`flex border-b border-gray-300 last:border-b-0 ${row.rowClass}`}
                        >
                            {/* Category Name */}
                            <div className="w-32 p-3 border-r border-gray-300 text-sm font-medium text-gray-700">
                                {row.category}
                            </div>

                            {/* Notes Column */}
                            <div className="w-24 p-3 border-r border-gray-300">
                                <div className="text-sm text-gray-800 text-center">
                                    {isLoadingActivityReport
                                        ? "…"
                                        : (activityReport?.categories?.[row.key]?.notesCount ?? 0)}
                                </div>
                            </div>

                            {/* Notes - Goals/Quotas */}
                            <div className="w-20 p-3 border-r border-gray-300">
                                <div className="flex space-x-2">
                                    <input
                                        type="number"
                                        className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                                        placeholder=""
                                    />
                                    <input 
                                        type="number" 
                                        className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0" 
                                        placeholder=""
                                    />
                                </div>
                            </div>

                            {/* Added to System Column */}
                            <div className="w-32 p-3 border-r border-gray-300">
                                <div className="text-sm text-gray-800 text-center">
                                    {isLoadingActivityReport
                                        ? "…"
                                        : (activityReport?.categories?.[row.key]?.addedToSystem ?? 0)}
                                </div>
                            </div>

                            {/* Added to System - Goals/Quotas */}
                            <div className="w-20 p-3 border-r border-gray-300">
                                <div className="flex space-x-2">
                                    <input
                                        type="number"
                                        className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                                        placeholder=""
                                    />
                                    <input 
                                        type="number" 
                                        className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0" 
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Inbound emails Column */}
                            <div className="w-28 p-3 border-r border-gray-300">
                                <input
                                    type="number"
                                    className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                                    placeholder=""
                                />
                            </div>

                            {/* Inbound emails - Goals/Quotas */}
                            <div className="w-20 p-3 border-r border-gray-300">
                                <div className="flex space-x-2">
                                    <input
                                        type="number"
                                        className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                                        placeholder=""
                                    />
                                    <input 
                                        type="number" 
                                        className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0" 
                                        placeholder=""
                                    />
                                </div>
                            </div>

                            {/* Outbound emails Column */}
                            <div className="w-28 p-3 border-r border-gray-300">
                                <input
                                    type="number"
                                    className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                                    placeholder=""
                                />
                            </div>

                            {/* Outbound emails - Goals/Quotas */}
                            <div className="w-20 p-3 border-r border-gray-300">
                                <div className="flex space-x-2">
                                    <input
                                        type="number"
                                        className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                                        placeholder=""
                                    />
                                    <input 
                                        type="number" 
                                        className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0" 
                                        placeholder=""
                                    />
                                </div>
                            </div>

                            {/* Calls Column */}
                            <div className="w-16 p-3 border-r border-gray-300">
                                <input
                                    type="number"
                                    className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                                    placeholder=""
                                />
                            </div>

                            {/* Calls - Goals/Quotas */}
                            <div className="w-20 p-3 border-r border-gray-300">
                                <div className="flex space-x-2">
                                    <input
                                        type="number"
                                        className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                                        placeholder=""
                                    />
                                    <input 
                                        type="number" 
                                        className="w-8 text-sm border-0 bg-transparent focus:outline-none focus:ring-0" 
                                        placeholder=""
                                    />
                                </div>
                            </div>

                            {/* Texts Column */}
                            <div className="w-16 p-3">
                                <input
                                    type="number"
                                    className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
                                    placeholder=""
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

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
        </div>
    );
}