'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import LoadingScreen from '@/components/LoadingScreen';

interface Job {
    id: string;
    job_title: string;
    category: string;
    organization_name: string;
    worksite_location: string;
    status: string;
    created_at: string;
    employment_type: string;
    created_by_name: string;
}

export default function JobList() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
    const [selectAll, setSelectAll] = useState(false);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Sorting state
    const [sortField, setSortField] = useState<'id' | 'job_title' | 'category' | 'organization_name' | 'worksite_location' | 'status' | 'created_at' | 'created_by_name' | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Fetch jobs data when component mounts
    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        // Continued from the previous code - updating app/dashboard/jobs/page.tsx

        setIsLoading(true);
        try {
            const response = await fetch('/api/jobs', {
                headers: {
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch jobs');
            }

            const data = await response.json();
            console.log('Jobs data:', data);
            setJobs(data.jobs || []);
        } catch (err) {
            console.error('Error fetching jobs:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while fetching jobs');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredJobs = jobs.filter(
        (job) =>
            job.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.organization_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.id?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Handle sorting
    const handleSort = (field: 'id' | 'job_title' | 'category' | 'organization_name' | 'worksite_location' | 'status' | 'created_at' | 'created_by_name') => {
        if (sortField === field) {
            // Toggle direction if same field
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // Set new field with ascending direction
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Sort the filtered jobs
    const sortedJobs = [...filteredJobs].sort((a, b) => {
        if (!sortField) return 0;
        
        let aValue: string | number = '';
        let bValue: string | number = '';
        
        if (sortField === 'id') {
            // Sort numerically by ID
            aValue = parseInt(a.id) || 0;
            bValue = parseInt(b.id) || 0;
        } else if (sortField === 'job_title') {
            aValue = a.job_title?.toLowerCase() || '';
            bValue = b.job_title?.toLowerCase() || '';
        } else if (sortField === 'category') {
            aValue = a.category?.toLowerCase() || '';
            bValue = b.category?.toLowerCase() || '';
        } else if (sortField === 'organization_name') {
            aValue = a.organization_name?.toLowerCase() || '';
            bValue = b.organization_name?.toLowerCase() || '';
        } else if (sortField === 'worksite_location') {
            aValue = a.worksite_location?.toLowerCase() || '';
            bValue = b.worksite_location?.toLowerCase() || '';
        } else if (sortField === 'status') {
            aValue = a.status?.toLowerCase() || '';
            bValue = b.status?.toLowerCase() || '';
        } else if (sortField === 'created_at') {
            aValue = new Date(a.created_at).getTime() || 0;
            bValue = new Date(b.created_at).getTime() || 0;
        } else if (sortField === 'created_by_name') {
            aValue = a.created_by_name?.toLowerCase() || '';
            bValue = b.created_by_name?.toLowerCase() || '';
        }
        
        if (sortDirection === 'asc') {
            return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
            return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
    });

    const handleViewJob = (id: string) => {
        router.push(`/dashboard/jobs/view?id=${id}`);
    };

    const handleAddJob = () => {
        router.push('/dashboard/jobs/add');
    };

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedJobs([]);
        } else {
            setSelectedJobs(filteredJobs.map(job => job.id));
        }
        setSelectAll(!selectAll);
    };

    const handleSelectJob = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row click event

        if (selectedJobs.includes(id)) {
            setSelectedJobs(selectedJobs.filter(jobId => jobId !== id));
            if (selectAll) setSelectAll(false);
        } else {
            setSelectedJobs([...selectedJobs, id]);
            // If all jobs are now selected, update selectAll state
            if ([...selectedJobs, id].length === filteredJobs.length) {
                setSelectAll(true);
            }
        }
    };

    const deleteSelectedJobs = async () => {
        if (selectedJobs.length === 0) return;

        const confirmMessage = selectedJobs.length === 1
            ? 'Are you sure you want to delete this job?'
            : `Are you sure you want to delete these ${selectedJobs.length} jobs?`;

        if (!window.confirm(confirmMessage)) return;

        setIsLoading(true);

        try {
            // Create promises for all delete operations
            const deletePromises = selectedJobs.map(id =>
                fetch(`/api/jobs/${id}`, {
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
                throw new Error(`Failed to delete ${failures.length} jobs`);
            }

            // Refresh jobs after successful deletion
            await fetchJobs();

            // Clear selection after deletion
            setSelectedJobs([]);
            setSelectAll(false);
        } catch (err) {
            console.error('Error deleting jobs:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while deleting jobs');
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
        }).format(date);
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'open':
                return 'bg-green-100 text-green-800';
            case 'on hold':
                return 'bg-yellow-100 text-yellow-800';
            case 'filled':
                return 'bg-blue-100 text-blue-800';
            case 'closed':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    if (isLoading) {
        return <LoadingScreen message="Loading jobs..." />;
    }

    return (
        <div className="bg-white rounded-lg shadow">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
                <h1 className="text-xl font-bold">Jobs</h1>
                <div className="flex space-x-4">
                    {selectedJobs.length > 0 && (
                        <button
                            onClick={deleteSelectedJobs}
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Delete Selected ({selectedJobs.length})
                        </button>
                    )}
                    <button
                        onClick={handleAddJob}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Add Job
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
                        placeholder="Search jobs..."
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

            {/* Jobs Table */}
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
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <button
                                    onClick={() => handleSort('id')}
                                    className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                                >
                                    <span>ID</span>
                                    <div className="flex flex-col">
                                        <svg 
                                            className={`w-3 h-3 ${sortField === 'id' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} 
                                            fill="currentColor" 
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                                        </svg>
                                        <svg 
                                            className={`w-3 h-3 -mt-1 ${sortField === 'id' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} 
                                            fill="currentColor" 
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                        </svg>
                                    </div>
                                </button>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <button
                                    onClick={() => handleSort('job_title')}
                                    className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                                >
                                    <span>Title</span>
                                    <div className="flex flex-col">
                                        <svg 
                                            className={`w-3 h-3 ${sortField === 'job_title' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} 
                                            fill="currentColor" 
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                                        </svg>
                                        <svg 
                                            className={`w-3 h-3 -mt-1 ${sortField === 'job_title' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} 
                                            fill="currentColor" 
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                        </svg>
                                    </div>
                                </button>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <button
                                    onClick={() => handleSort('category')}
                                    className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                                >
                                    <span>Category</span>
                                    <div className="flex flex-col">
                                        <svg 
                                            className={`w-3 h-3 ${sortField === 'category' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} 
                                            fill="currentColor" 
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                                        </svg>
                                        <svg 
                                            className={`w-3 h-3 -mt-1 ${sortField === 'category' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} 
                                            fill="currentColor" 
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                        </svg>
                                    </div>
                                </button>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <button
                                    onClick={() => handleSort('organization_name')}
                                    className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                                >
                                    <span>Organization</span>
                                    <div className="flex flex-col">
                                        <svg 
                                            className={`w-3 h-3 ${sortField === 'organization_name' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} 
                                            fill="currentColor" 
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                                        </svg>
                                        <svg 
                                            className={`w-3 h-3 -mt-1 ${sortField === 'organization_name' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} 
                                            fill="currentColor" 
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                        </svg>
                                    </div>
                                </button>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <button
                                    onClick={() => handleSort('worksite_location')}
                                    className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                                >
                                    <span>Location</span>
                                    <div className="flex flex-col">
                                        <svg 
                                            className={`w-3 h-3 ${sortField === 'worksite_location' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} 
                                            fill="currentColor" 
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                                        </svg>
                                        <svg 
                                            className={`w-3 h-3 -mt-1 ${sortField === 'worksite_location' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} 
                                            fill="currentColor" 
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                        </svg>
                                    </div>
                                </button>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <button
                                    onClick={() => handleSort('status')}
                                    className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                                >
                                    <span>Status</span>
                                    <div className="flex flex-col">
                                        <svg 
                                            className={`w-3 h-3 ${sortField === 'status' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} 
                                            fill="currentColor" 
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                                        </svg>
                                        <svg 
                                            className={`w-3 h-3 -mt-1 ${sortField === 'status' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} 
                                            fill="currentColor" 
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                        </svg>
                                    </div>
                                </button>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <button
                                    onClick={() => handleSort('created_at')}
                                    className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                                >
                                    <span>Date Posted</span>
                                    <div className="flex flex-col">
                                        <svg 
                                            className={`w-3 h-3 ${sortField === 'created_at' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} 
                                            fill="currentColor" 
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                                        </svg>
                                        <svg 
                                            className={`w-3 h-3 -mt-1 ${sortField === 'created_at' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} 
                                            fill="currentColor" 
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                        </svg>
                                    </div>
                                </button>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <button
                                    onClick={() => handleSort('created_by_name')}
                                    className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                                >
                                    <span>Owner</span>
                                    <div className="flex flex-col">
                                        <svg 
                                            className={`w-3 h-3 ${sortField === 'created_by_name' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} 
                                            fill="currentColor" 
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                                        </svg>
                                        <svg 
                                            className={`w-3 h-3 -mt-1 ${sortField === 'created_by_name' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} 
                                            fill="currentColor" 
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                        </svg>
                                    </div>
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedJobs.length > 0 ? (
                            sortedJobs.map((job) => (
                                <tr
                                    key={job.id}
                                    className="hover:bg-gray-50 cursor-pointer"
                                    onClick={() => handleViewJob(job.id)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                                checked={selectedJobs.includes(job.id)}
                                                onChange={() => { }}
                                                onClick={(e) => handleSelectJob(job.id, e)}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                       J {job.id}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{job.job_title}</div>
                                        <div className="text-sm text-gray-500">{job.employment_type}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {job.category}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-blue-600">{job.organization_name || 'Not specified'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {job.worksite_location || 'Not specified'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(job.status)}`}>
                                            {job.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatDate(job.created_at)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {job.created_by_name || 'Unknown'}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={9} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                    {searchTerm ? 'No jobs found matching your search.' : 'No jobs found. Click "Add Job" to create one.'}
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
                            Showing <span className="font-medium">1</span> to <span className="font-medium">{sortedJobs.length}</span> of{' '}
                            <span className="font-medium">{sortedJobs.length}</span> results
                        </p>
                    </div>
                    {filteredJobs.length > 0 && (
                        <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <button className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                                    <span className="sr-only">Previous</span>
                                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                                    1
                                </button>
                                <button className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                                    <span className="sr-only">Next</span>
                                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </nav>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}