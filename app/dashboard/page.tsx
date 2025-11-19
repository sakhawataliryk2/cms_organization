'use client'

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { FiSearch, FiChevronDown, FiX, FiChevronLeft, FiChevronRight, FiCheckSquare, FiPlus, FiClock } from 'react-icons/fi';
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

export default function Dashboard() {
    const { user } = useAuth();
    const router = useRouter();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoadingTasks, setIsLoadingTasks] = useState(true);
    const [tasksError, setTasksError] = useState<string | null>(null);

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
    const goToToday = () => {
        setCurrentDate(new Date());
        setSelectedDate(new Date());
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

    // Handle date click
    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
    };

    // Days with events (example: Saturdays)
    const hasEvent = (date: Date) => {
        return date.getDay() === 6; // Saturday
    };

    // Fetch tasks on component mount
    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        setIsLoadingTasks(true);
        setTasksError(null);
        try {
            const response = await fetch('/api/tasks');
            
            if (!response.ok) {
                throw new Error('Failed to fetch tasks');
            }

            const data = await response.json();
            // Get up to 5 recent tasks for dashboard
            const recentTasks = (data.tasks || []).slice(0, 5);
            setTasks(recentTasks);
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

    return (
        <div className="flex flex-col h-full">
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
                                    const hasEventDate = hasEvent(date);
                                    
                                    return (
                                        <button
                                            key={dayIndex}
                                            onClick={() => handleDateClick(date)}
                                            className={`
                                                text-center py-2 text-sm rounded transition-colors
                                                ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                                                ${isTodayDate ? 'bg-blue-100 font-semibold' : ''}
                                                ${isSelectedDate ? 'bg-blue-500 text-white' : ''}
                                                ${!isSelectedDate && !isTodayDate && isCurrentMonth ? 'hover:bg-gray-100' : ''}
                                                ${hasEventDate && !isSelectedDate ? 'bg-blue-50' : ''}
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
                </div>

                {/* Middle - Tasks */}
                <div className="bg-white rounded-md shadow overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-200 flex justify-between items-center">
                        <div>
                            <h2 className="text-lg font-semibold">Tasks Overview</h2>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Link
                                href="/dashboard/tasks/add"
                                className="text-blue-600 hover:text-blue-800 p-1"
                                title="Add Task"
                            >
                                <FiPlus size={18} />
                            </Link>
                            <Link
                                href="/dashboard/tasks"
                                className="text-gray-600 hover:text-gray-800 text-xs px-2 py-1 rounded hover:bg-gray-100"
                            >
                                View All
                            </Link>
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
                                    onClick={fetchTasks}
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
                                <p className="text-gray-600 text-sm">No tasks found</p>
                                <p className="text-gray-400 text-xs mt-2">
                                    Create your first task to get started
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
                                {tasks.map((task) => (
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
                                {tasks.length >= 5 && (
                                    <div className="pt-2 border-t border-gray-200">
                                        <Link
                                            href="/dashboard/tasks"
                                            className="text-center block text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        >
                                            View All Tasks →
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column */}
                <div className="flex flex-col space-y-4">
                    {/* Goals and Quotas */}
                    <div className="bg-white rounded-md shadow overflow-hidden">
                        <div className="p-2 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <h2 className="text-lg font-semibold">Goals and Quotas</h2>
                                <button className="bg-blue-500 text-white px-2 py-1 rounded text-xs">
                                    Goal
                                </button>
                                <button className="bg-gray-100 border border-gray-300 px-2 py-1 rounded text-xs">
                                    QUOTA
                                </button>
                                <div className="flex items-center">
                                    <button className="bg-gray-100 border border-gray-300 px-2 py-1 rounded-l text-xs">
                                        Filters
                                    </button>
                                    <button className="bg-gray-100 border border-gray-300 border-l-0 px-2 py-1 rounded-r text-xs">
                                        <FiChevronDown size={14} />
                                    </button>
                                </div>
                            </div>
                            <button className="text-gray-400 hover:text-gray-600">
                                <FiX size={18} />
                            </button>
                        </div>
                        <div className="p-4 flex flex-col items-center justify-center h-full">
                            {/* Empty state */}
                            <div className="text-center">
                                <div className="bg-gray-200 rounded-full p-4 inline-flex mx-auto mb-4">
                                    <FiSearch size={24} className="text-gray-500" />
                                </div>
                                <p className="text-gray-600">Hmm... Your search didn't return any results.</p>
                                <p className="text-gray-400 text-sm mt-2">
                                    Make sure everything is spelled correctly or try different keywords.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Rules of Engagement */}
                    <div className="bg-white rounded-md shadow overflow-hidden">
                        <div className="p-2 border-b border-gray-200">
                            <h2 className="text-lg font-semibold">Rules of engagement</h2>
                        </div>
                        <div className="p-6 flex justify-center">
                            <div className="bg-blue-500 rounded-md p-4 w-28 h-28 flex flex-col items-center justify-center text-white">
                                <div className="bg-white w-10 h-10 mb-2"></div>
                                <div className="text-center">
                                    <div className="text-sm">Rules of</div>
                                    <div className="text-sm">Engagement</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            {/* <div className="grid grid-cols-12 gap-4 mt-4">
                
                <div className="col-span-12 md:col-span-6 lg:col-span-4">
                    <div className="bg-gray-50 p-4">
                        <h2 className="font-bold mb-4">Select Date and Time Range</h2>

                        <div className="mb-4">
                            <label className="block mb-1">Start Date & Time:</label>
                            <input
                                type="text"
                                placeholder="Select start date and time"
                                className="w-full p-2 border border-gray-300 rounded"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block mb-1">End Date & Time:</label>
                            <input
                                type="text"
                                placeholder="Select end date and time"
                                className="w-full p-2 border border-gray-300 rounded"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>


                </div>

                
                <div className="hidden md:block md:col-span-2 lg:col-span-4"></div>

                
                <div className="col-span-12 md:col-span-4 lg:col-span-4 flex items-end justify-end">
                    <div className="text-right">
                        <div className="text-lg mb-1">Next</div>
                        <button
                            className="bg-teal-600 text-white w-24 h-10 rounded flex items-center justify-center"
                            onClick={handleNextClick}
                        >
                            <span className="transform translate-x-1">▶</span>
                        </button>
                    </div>
                </div>
            </div> */}
        </div>
    );
}