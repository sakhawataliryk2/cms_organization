'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import LoadingScreen from '@/components/LoadingScreen';

interface Task {
    id: string;
    title: string;
    description?: string;
    is_completed: boolean;
    due_date?: string;
    due_time?: string;
    job_seeker_name?: string;
    hiring_manager_name?: string;
    job_title?: string;
    lead_name?: string;
    placement_id?: string;
    owner?: string;
    priority: string;
    status: string;
    created_by_name?: string;
    assigned_to_name?: string;
    created_at: string;
}

export default function TaskList() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
    const [selectAll, setSelectAll] = useState(false);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortField, setSortField] = useState<string>('created_at');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Fetch tasks data when component mounts
    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        setIsLoading(true);
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
            console.log('Tasks data:', data);
            setTasks(data.tasks || []);
        } catch (err) {
            console.error('Error fetching tasks:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while fetching tasks');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredTasks = tasks.filter(
        (task) =>
            (task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
            (task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
            (task.id?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
            (task.owner?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
            (task.job_seeker_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
            (task.hiring_manager_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
            (task.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
            (task.lead_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    );

    // Sort tasks
    const sortedTasks = [...filteredTasks].sort((a, b) => {
        let aValue: any = a[sortField as keyof Task];
        let bValue: any = b[sortField as keyof Task];

        // Handle null/undefined values
        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';

        // Convert to strings for comparison
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();

        if (sortDirection === 'asc') {
            return aStr.localeCompare(bStr);
        } else {
            return bStr.localeCompare(aStr);
        }
    });

    const handleViewTask = (id: string) => {
        router.push(`/dashboard/tasks/view?id=${id}`);
    };

    const handleAddTask = () => {
        router.push('/dashboard/tasks/add');
    };

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getSortIcon = (field: string) => {
        if (sortField !== field) return '↕️';
        return sortDirection === 'asc' ? '↑' : '↓';
    };

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedTasks([]);
        } else {
            setSelectedTasks(sortedTasks.map(task => task.id));
        }
        setSelectAll(!selectAll);
    };

    const handleSelectTask = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row click event

        if (selectedTasks.includes(id)) {
            setSelectedTasks(selectedTasks.filter(taskId => taskId !== id));
            if (selectAll) setSelectAll(false);
        } else {
            setSelectedTasks([...selectedTasks, id]);
            // If all tasks are now selected, update selectAll state
            if ([...selectedTasks, id].length === sortedTasks.length) {
                setSelectAll(true);
            }
        }
    };

    const deleteSelectedTasks = async () => {
        if (selectedTasks.length === 0) return;

        const confirmMessage = selectedTasks.length === 1
            ? 'Are you sure you want to delete this task?'
            : `Are you sure you want to delete these ${selectedTasks.length} tasks?`;

        if (!window.confirm(confirmMessage)) return;

        setIsLoading(true);

        try {
            // Create promises for all delete operations
            const deletePromises = selectedTasks.map(id =>
                fetch(`/api/tasks/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                    }
                })
            );

            // Execute all delete operations
            const results = await Promise.allSettled(deletePromises);

            // Check for failures
            const failures = results.filter(result => result.status === 'rejected');

            if (failures.length > 0) {
                throw new Error(`Failed to delete ${failures.length} tasks`);
            }

            // Refresh tasks after successful deletion
            await fetchTasks();

            // Clear selection after deletion
            setSelectedTasks([]);
            setSelectAll(false);
        } catch (err) {
            console.error('Error deleting tasks:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while deleting tasks');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleTaskComplete = async (taskId: string, isCompleted: boolean) => {
        if (!taskId) {
            console.error('Task ID is required');
            return;
        }

        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                },
                body: JSON.stringify({
                    isCompleted: !isCompleted,
                    status: !isCompleted ? 'Completed' : 'Pending'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update task');
            }

            // Refresh tasks
            await fetchTasks();
        } catch (err) {
            console.error('Error updating task:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while updating the task');
        }
    };

    const formatDateTime = (date?: string, time?: string) => {
        if (!date) return '';

        try {
            const dateObj = new Date(date);
            let formatted = new Intl.DateTimeFormat('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric'
            }).format(dateObj);

            if (time) {
                formatted += ` ${time}`;
            }

            return formatted;
        } catch (error) {
            console.error('Error formatting date:', error);
            return '';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'in progress':
                return 'bg-blue-100 text-blue-800';
            case 'overdue':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority.toLowerCase()) {
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

    if (isLoading) {
        return <LoadingScreen message="Loading tasks..." />;
    }

    return (
        <div className="bg-white rounded-lg shadow">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
                <h1 className="text-xl font-bold">Tasks</h1>
                <div className="flex space-x-4">
                    {selectedTasks.length > 0 && (
                        <button
                            onClick={deleteSelectedTasks}
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Delete Selected ({selectedTasks.length})
                        </button>
                    )}
                    <button
                        onClick={handleAddTask}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Add Task
                    </button>
                </div>
            </div>

            {/* Error message */}
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
                    <p>{error}</p>
                </div>
            )}

            {/* Search and Filter */}
            <div className="p-4 border-b border-gray-200">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search tasks..."
                        className="w-full p-2 pl-10 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div className="absolute left-3 top-2.5 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Tasks Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                        checked={selectAll}
                                        onChange={handleSelectAll}
                                    />
                                </div>
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('id')}
                            >
                                ID {getSortIcon('id')}
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('is_completed')}
                            >
                                Completed? {getSortIcon('is_completed')}
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('due_date')}
                            >
                                Due Date & Time {getSortIcon('due_date')}
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('job_seeker_name')}
                            >
                                Job Seeker {getSortIcon('job_seeker_name')}
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('hiring_manager_name')}
                            >
                                Hiring Manager {getSortIcon('hiring_manager_name')}
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('job_title')}
                            >
                                Job {getSortIcon('job_title')}
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('lead_name')}
                            >
                                Lead {getSortIcon('lead_name')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Placement
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('owner')}
                            >
                                Owner {getSortIcon('owner')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedTasks.length > 0 ? (
                            sortedTasks.map((task) => (
                                <tr
                                    key={task.id}
                                    className="hover:bg-gray-50 cursor-pointer"
                                    onClick={() => handleViewTask(task.id)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                                checked={selectedTasks.includes(task.id)}
                                                onChange={() => { }}
                                                onClick={(e) => handleSelectTask(task.id, e)}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        T {task.id}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleTaskComplete(task.id, task.is_completed);
                                            }}
                                            className={`px-2 py-1 rounded text-xs font-semibold ${task.is_completed
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                                }`}
                                        >
                                            {task.is_completed ? '✓ Yes' : '○ No'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatDateTime(task.due_date, task.due_time) || 'Not set'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                                        {task.job_seeker_name || 'Not specified'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                                        {task.hiring_manager_name || 'Not specified'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                                        {task.job_title || 'Not specified'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                                        {task.lead_name || 'Not specified'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {task.placement_id || 'Not specified'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {task.owner || task.created_by_name || 'Unknown'}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={10} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                    {searchTerm ? 'No tasks found matching your search.' : 'No tasks found. Click "Add Task" to create one.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                    <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                        Previous
                    </button>
                    <button className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                        Next
                    </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm text-gray-700">
                            Showing <span className="font-medium">1</span> to <span className="font-medium">{sortedTasks.length}</span> of{' '}
                            <span className="font-medium">{sortedTasks.length}</span> results
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}